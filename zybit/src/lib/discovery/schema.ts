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

/** Coerces typical JSON/form values into number | null | undefined for q4. */
const optionalNullableQ4 = z.preprocess((val) => {
  if (val === undefined || val === null) return val;
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const t = val.trim();
    if (t === '') return undefined;
    const n = Number(t);
    return Number.isFinite(n) ? n : Number.NaN;
  }
  return Number.NaN;
}, z.union([z.number(), z.null()]).optional());

const looseDiscoveryShape = z.object({
  website_field: z.string().optional(),
  q1: z.enum(['yes', 'no']).optional(),
  q2: z.string().optional(),
  q3: z.array(z.string()).optional(),
  q3_other: z.string().optional(),
  q4: optionalNullableQ4,
  q4_note: z.string().optional(),
  q5: z.string().optional(),
  q6: z.string().optional(),
  q7: z.enum(['yes', 'no', '']).optional(),
  q7_email: z.string().optional(),
  q8: z.enum(['yes', 'no', '']).optional(),
  q8_url: z.string().optional(),
});

type LooseDiscoveryInput = z.infer<typeof looseDiscoveryShape>;

export const discoveryPayloadSchema = looseDiscoveryShape.superRefine((b, ctx) => {
  if ((b.website_field?.trim() ?? '') !== '') {
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

  const q4 = typeof b.q4 === 'number' && !Number.isNaN(b.q4) ? b.q4 : Number.NaN;
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

function buildDiscoveryPayload(body: LooseDiscoveryInput): DiscoveryPayload {
  if (body.q1 === 'no') {
    return {
      q1: 'no',
      website_field: body.website_field ?? '',
    };
  }

  const q3 = (body.q3 ?? []).filter((v) => Q3_VALID.has(v));

  let q7Email = '';
  if (body.q7 === 'yes') {
    q7Email = (body.q7_email ?? '').trim();
  }

  let q8Url = '';
  if (body.q8 === 'yes') {
    q8Url = (body.q8_url ?? '').trim();
  }

  const q4 = typeof body.q4 === 'number' ? body.q4 : null;

  return {
    q1: 'yes',
    q2: (body.q2 ?? '').trim(),
    q3,
    q3_other: (body.q3_other ?? '').trim(),
    q4,
    q4_note: (body.q4_note ?? '').trim(),
    q5: body.q5 ?? '',
    q6: body.q6 ?? '',
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

  return { ok: true, data: buildDiscoveryPayload(parsed.data) };
}
