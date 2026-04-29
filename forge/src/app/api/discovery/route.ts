import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { put } from '@vercel/blob';
import { randomUUID } from 'crypto';

import { type DiscoveryPayload, validateDiscoveryPayload } from '@/lib/discovery/schema';

const RECIPIENT = 'sar367@cornell.edu';

function getResendClient() {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    throw new Error('RESEND_API_KEY is not set');
  }
  return new Resend(key);
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

/** One blob per submission (no read-modify-write; avoids concurrent overwrite). */
async function putDiscoveryRecordBlob(record: object, id: string): Promise<void> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    console.warn('[discovery] BLOB_READ_WRITE_TOKEN not set — skipping blob write. Email is source-of-truth.');
    return;
  }

  const yyyymm = new Date().toISOString().slice(0, 7);
  const pathname = `discovery-responses/${yyyymm}/${id}.json`;
  const body = JSON.stringify(record);

  await put(pathname, body, {
    access: 'public',
    contentType: 'application/json',
    allowOverwrite: false,
    addRandomSuffix: false,
    token,
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = validateDiscoveryPayload(body);
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
      await putDiscoveryRecordBlob(record, id);
    } catch (err) {
      console.error('[discovery] blob write failed; email already sent.', err);
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
