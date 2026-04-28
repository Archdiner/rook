import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { put, head, BlobNotFoundError } from '@vercel/blob';
import { randomUUID } from 'crypto';

const RECIPIENT = 'sar367@cornell.edu';
const Q3_VALID = new Set([
  'Looked at analytics',
  'Watched session replays',
  'Asked users directly',
  'Hired a contractor or agency',
  'Used Cursor or another AI tool to make changes',
  'Nothing — gave up',
  'Other',
]);
const Q5_VALID = new Set(['Yes, immediately', 'Yes, if I trusted the source', 'Probably not']);
const Q6_VALID = new Set(['Yes', 'Maybe', 'No']);

interface DiscoveryPayload {
  q1: 'yes' | 'no';
  q2?: string;
  q3?: string[];
  q3_other?: string;
  q4?: number | null;
  q4_note?: string;
  q5?: string;
  q6?: string;
  q7?: 'yes' | 'no' | '';
  q7_email?: string;
  q8?: 'yes' | 'no' | '';
  q8_url?: string;
  website_field?: string;
}

function getResendClient() {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    throw new Error('RESEND_API_KEY is not set');
  }
  return new Resend(key);
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidUrl(value: string): boolean {
  try {
    const u = new URL(value.startsWith('http') ? value : `https://${value}`);
    return Boolean(u.hostname);
  } catch {
    return false;
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function tableRow(label: string, value: string): { label: string; value: string } {
  return { label, value };
}

function renderRows(rows: Array<{ label: string; value: string }>): string {
  return rows
    .map((row, idx) => {
      const borderStyle = idx === rows.length - 1 ? '' : 'border-bottom: 1px solid #D9CFB0;';
      return `
    <tr style="${borderStyle}">
      <td style="padding: 12px 0; color: #5A4F3A; width: 200px; vertical-align: top;">${escapeHtml(row.label)}</td>
      <td style="padding: 12px 0; font-weight: 400; vertical-align: top;">${row.value}</td>
    </tr>`;
    })
    .join('');
}

function validatePayload(body: unknown): { ok: true; data: DiscoveryPayload } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Invalid payload.' };
  }
  const b = body as Record<string, unknown>;

  if (typeof b.website_field === 'string' && b.website_field.trim() !== '') {
    return { ok: false, error: 'Submission rejected.' };
  }

  if (b.q1 !== 'yes' && b.q1 !== 'no') {
    return { ok: false, error: 'Question 1 must be answered.' };
  }

  if (b.q1 === 'no') {
    return {
      ok: true,
      data: {
        q1: 'no',
        website_field: typeof b.website_field === 'string' ? b.website_field : '',
      },
    };
  }

  const q3Raw = Array.isArray(b.q3) ? b.q3 : [];
  const q3 = q3Raw.filter((v): v is string => typeof v === 'string' && Q3_VALID.has(v));

  const q4 = typeof b.q4 === 'number' ? b.q4 : NaN;
  if (!Number.isInteger(q4) || q4 < 1 || q4 > 5) {
    return { ok: false, error: 'Question 4 must be a number between 1 and 5.' };
  }

  const q5 = typeof b.q5 === 'string' ? b.q5 : '';
  if (!Q5_VALID.has(q5)) {
    return { ok: false, error: 'Question 5 must be one of the listed options.' };
  }

  const q6 = typeof b.q6 === 'string' ? b.q6 : '';
  if (!Q6_VALID.has(q6)) {
    return { ok: false, error: 'Question 6 must be one of the listed options.' };
  }

  if (b.q7 !== 'yes' && b.q7 !== 'no') {
    return { ok: false, error: 'Question 7 must be answered.' };
  }
  let q7Email = '';
  if (b.q7 === 'yes') {
    q7Email = typeof b.q7_email === 'string' ? b.q7_email.trim() : '';
    if (!isValidEmail(q7Email)) {
      return { ok: false, error: 'A valid email is required to schedule a call.' };
    }
  }

  if (b.q8 !== 'yes' && b.q8 !== 'no') {
    return { ok: false, error: 'Question 8 must be answered.' };
  }
  let q8Url = '';
  if (b.q8 === 'yes') {
    q8Url = typeof b.q8_url === 'string' ? b.q8_url.trim() : '';
    if (!isValidUrl(q8Url)) {
      return { ok: false, error: 'A valid site URL is required for the audit.' };
    }
  }

  return {
    ok: true,
    data: {
      q1: 'yes',
      q2: typeof b.q2 === 'string' ? b.q2.trim() : '',
      q3,
      q3_other: typeof b.q3_other === 'string' ? b.q3_other.trim() : '',
      q4,
      q4_note: typeof b.q4_note === 'string' ? b.q4_note.trim() : '',
      q5,
      q6,
      q7: b.q7,
      q7_email: q7Email,
      q8: b.q8,
      q8_url: q8Url,
      website_field: '',
    },
  };
}

function renderEmailHtml(data: DiscoveryPayload, id: string, timestamp: string): string {
  const rows: Array<{ label: string; value: string }> = [];
  rows.push(tableRow('Q1 · Spent meaningful time?', data.q1 === 'yes' ? 'Yes' : 'No'));

  if (data.q1 === 'yes') {
    const url = data.q2 || '';
    rows.push(
      tableRow(
        'Q2 · Product URL',
        url
          ? `<a href="${escapeHtml(url)}" style="color: #7A4A1A;">${escapeHtml(url)}</a>`
          : '<span style="color:#9A8F7A;">—</span>'
      )
    );

    const q3List = (data.q3 ?? []).map((v) => `• ${escapeHtml(v)}`).join('<br/>');
    rows.push(
      tableRow(
        'Q3 · What did you try?',
        q3List || '<span style="color:#9A8F7A;">— (none selected)</span>'
      )
    );
    if (data.q3_other) {
      rows.push(tableRow('Q3 · Other detail', escapeHtml(data.q3_other)));
    }

    rows.push(tableRow('Q4 · Did it work? (1–5)', String(data.q4 ?? '')));
    if (data.q4_note) {
      rows.push(tableRow('Q4 · Notes', escapeHtml(data.q4_note)));
    }

    rows.push(tableRow('Q5 · Would ship 3 evidenced changes?', escapeHtml(data.q5 ?? '')));
    rows.push(tableRow('Q6 · Pay $199/mo with refund?', escapeHtml(data.q6 ?? '')));

    rows.push(tableRow('Q7 · 30-min call this week?', data.q7 === 'yes' ? 'Yes' : 'No'));
    if (data.q7 === 'yes' && data.q7_email) {
      rows.push(
        tableRow(
          'Q7 · Email',
          `<a href="mailto:${escapeHtml(data.q7_email)}" style="color: #7A4A1A;">${escapeHtml(
            data.q7_email
          )}</a>`
        )
      );
    }

    rows.push(tableRow('Q8 · Free audit as design partner?', data.q8 === 'yes' ? 'Yes' : 'No'));
    if (data.q8 === 'yes' && data.q8_url) {
      rows.push(
        tableRow(
          'Q8 · Site URL',
          `<a href="${escapeHtml(data.q8_url)}" style="color: #7A4A1A;">${escapeHtml(data.q8_url)}</a>`
        )
      );
    }
  }

  return `
    <div style="font-family: Georgia, serif; max-width: 640px; margin: 0 auto; color: #0E0C09; background: #FAFAF8; padding: 32px;">
      <div style="border-bottom: 2px solid #0E0C09; padding-bottom: 16px; margin-bottom: 24px;">
        <h1 style="font-size: 24px; font-weight: 400; margin: 0;">New Discovery Response</h1>
        <p style="font-size: 13px; color: #5A4F3A; margin: 6px 0 0; letter-spacing: 0.1em; text-transform: uppercase;">Forge · Phase 0 · ${timestamp}</p>
        <p style="font-size: 12px; color: #9A8F7A; margin: 4px 0 0; font-family: 'SFMono-Regular', Menlo, monospace;">id: ${id}</p>
      </div>

      <table style="width: 100%; border-collapse: collapse; font-size: 15px;">
        ${renderRows(rows)}
      </table>

      <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #D9CFB0; font-size: 13px; color: #5A4F3A; font-style: italic;">
        Submitted via the /discovery survey.
      </div>
    </div>
  `;
}

async function appendToBlob(record: object): Promise<void> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    console.warn('[discovery] BLOB_READ_WRITE_TOKEN not set — skipping blob append. Email is source-of-truth.');
    return;
  }

  const yyyymm = new Date().toISOString().slice(0, 7);
  const pathname = `discovery-responses/${yyyymm}.jsonl`;
  const newLine = JSON.stringify(record) + '\n';

  let existing = '';
  try {
    const meta = await head(pathname, { token });
    const res = await fetch(meta.url, { cache: 'no-store' });
    if (res.ok) {
      existing = await res.text();
    } else {
      console.warn(`[discovery] blob fetch returned ${res.status}; treating as empty.`);
    }
  } catch (err) {
    if (err instanceof BlobNotFoundError) {
      // First write for this month — proceed with empty existing.
    } else {
      console.error('[discovery] blob head failed; skipping append to avoid data loss.', err);
      return;
    }
  }

  await put(pathname, existing + newLine, {
    access: 'public',
    contentType: 'application/x-ndjson',
    allowOverwrite: true,
    addRandomSuffix: false,
    token,
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = validatePayload(body);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    const data = result.data;

    const id = randomUUID();
    const submittedAt = new Date();
    const timestamp = submittedAt.toLocaleString('en-US', {
      timeZone: 'America/New_York',
      dateStyle: 'full',
      timeStyle: 'short',
    });

    const subjectUrl = data.q2 || data.q8_url || 'no URL';

    const { error } = await getResendClient().emails.send({
      from: 'Forge Discovery <onboarding@resend.dev>',
      to: RECIPIENT,
      subject: `New Forge Discovery Response — ${subjectUrl}`,
      html: renderEmailHtml(data, id, timestamp),
    });

    if (error) {
      console.error('Resend API Error:', error);
      return NextResponse.json(
        { error: 'Failed to submit response. Please try again.' },
        { status: 500 }
      );
    }

    const record = {
      id,
      submitted_at: submittedAt.toISOString(),
      ...data,
    };
    delete (record as { website_field?: string }).website_field;

    try {
      await appendToBlob(record);
    } catch (err) {
      console.error('[discovery] blob append failed; email already sent.', err);
    }

    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error('Discovery Error:', error);
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}
