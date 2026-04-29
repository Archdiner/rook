import { z } from 'zod';

import { isValidEmail, isValidUrl } from '@/utils/validation';

export const DISCOVERY_Q3_OPTIONS = [
  'Looked at analytics',
  'Watched session replays',
  'Asked users directly',
  'Hired a contractor or agency',
  'Used Cursor or another AI tool to make changes',
  'Nothing — gave up',
  'Other',
] as const;

export const DISCOVERY_Q5_OPTIONS = [
  'Yes, immediately',
  'Yes, if I trusted the source',
  'Probably not',
] as const;

export const DISCOVERY_Q6_OPTIONS = ['Yes', 'Maybe', 'No'] as const;

const Q3_VALID = new Set<string>(DISCOVERY_Q3_OPTIONS);
const Q5_VALID = new Set<string>(DISCOVERY_Q5_OPTIONS);
const Q6_VALID = new Set<string>(DISCOVERY_Q6_OPTIONS);

export interface DiscoveryPayload {
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

const looseDiscoveryShape = z.object({
  website_field: z.unknown().optional(),
  q1: z.unknown().optional(),
  q2: z.unknown().optional(),
  q3: z.unknown().optional(),
  q3_other: z.unknown().optional(),
  q4: z.unknown().optional(),
  q4_note: z.unknown().optional(),
  q5: z.unknown().optional(),
  q6: z.unknown().optional(),
  q7: z.unknown().optional(),
  q7_email: z.unknown().optional(),
  q8: z.unknown().optional(),
  q8_url: z.unknown().optional(),
});

export const discoveryPayloadSchema = looseDiscoveryShape.superRefine((b, ctx) => {
  if (typeof b.website_field === 'string' && b.website_field.trim() !== '') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Submission rejected.',
      path: ['website_field'],
    });
    return;
  }

  if (b.q1 !== 'yes' && b.q1 !== 'no') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Question 1 must be answered.',
      path: ['q1'],
    });
    return;
  }

  if (b.q1 === 'no') {
    return;
  }

  const q4 = typeof b.q4 === 'number' ? b.q4 : Number.NaN;
  if (!Number.isInteger(q4) || q4 < 1 || q4 > 5) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Question 4 must be a number between 1 and 5.',
      path: ['q4'],
    });
    return;
  }

  const q5 = typeof b.q5 === 'string' ? b.q5 : '';
  if (!Q5_VALID.has(q5)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Question 5 must be one of the listed options.',
      path: ['q5'],
    });
    return;
  }

  const q6 = typeof b.q6 === 'string' ? b.q6 : '';
  if (!Q6_VALID.has(q6)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Question 6 must be one of the listed options.',
      path: ['q6'],
    });
    return;
  }

  if (b.q7 !== 'yes' && b.q7 !== 'no') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Question 7 must be answered.',
      path: ['q7'],
    });
    return;
  }

  if (b.q7 === 'yes') {
    const q7Email = typeof b.q7_email === 'string' ? b.q7_email.trim() : '';
    if (!isValidEmail(q7Email)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'A valid email is required to schedule a call.',
        path: ['q7_email'],
      });
      return;
    }
  }

  if (b.q8 !== 'yes' && b.q8 !== 'no') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Question 8 must be answered.',
      path: ['q8'],
    });
    return;
  }

  if (b.q8 === 'yes') {
    const q8Url = typeof b.q8_url === 'string' ? b.q8_url.trim() : '';
    if (!isValidUrl(q8Url)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'A valid site URL is required for the audit.',
        path: ['q8_url'],
      });
    }
  }
});

function buildDiscoveryPayload(body: Record<string, unknown>): DiscoveryPayload {
  if (body.q1 === 'no') {
    return {
      q1: 'no',
      website_field: typeof body.website_field === 'string' ? body.website_field : '',
    };
  }

  const q3Raw = Array.isArray(body.q3) ? body.q3 : [];
  const q3 = q3Raw.filter((v): v is string => typeof v === 'string' && Q3_VALID.has(v));

  let q7Email = '';
  if (body.q7 === 'yes') {
    q7Email = typeof body.q7_email === 'string' ? body.q7_email.trim() : '';
  }

  let q8Url = '';
  if (body.q8 === 'yes') {
    q8Url = typeof body.q8_url === 'string' ? body.q8_url.trim() : '';
  }

  const q4 = typeof body.q4 === 'number' ? body.q4 : null;

  return {
    q1: 'yes',
    q2: typeof body.q2 === 'string' ? body.q2.trim() : '',
    q3,
    q3_other: typeof body.q3_other === 'string' ? body.q3_other.trim() : '',
    q4,
    q4_note: typeof body.q4_note === 'string' ? body.q4_note.trim() : '',
    q5: typeof body.q5 === 'string' ? body.q5 : '',
    q6: typeof body.q6 === 'string' ? body.q6 : '',
    q7: body.q7 as 'yes' | 'no',
    q7_email: q7Email,
    q8: body.q8 as 'yes' | 'no',
    q8_url: q8Url,
    website_field: '',
  };
}

export function validateDiscoveryPayload(
  body: unknown
): { ok: true; data: DiscoveryPayload } | { ok: false; error: string } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'Invalid payload.' };
  }

  const parsed = discoveryPayloadSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, error: first?.message ?? 'Invalid payload.' };
  }

  const record = body as Record<string, unknown>;
  return { ok: true, data: buildDiscoveryPayload(record) };
}
