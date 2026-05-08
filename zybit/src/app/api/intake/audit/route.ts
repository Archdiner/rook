import { NextResponse } from 'next/server';
import { runStructuralAudit } from '@/lib/intake/structuralAudit';
import { emailProspect, emailFoundersFallback } from '@/lib/intake/emailProspect';

// Shared secret header guards this internal endpoint from public access.
const AUDIT_SECRET = process.env.INTAKE_AUDIT_SECRET;

export async function POST(request: Request) {
  const secret = request.headers.get('x-intake-audit-secret');
  if (!AUDIT_SECRET || secret !== AUDIT_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: { email?: string; url?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { email, url } = body ?? {};
  if (!email || !url) {
    return NextResponse.json({ error: 'email and url are required' }, { status: 400 });
  }

  const result = await runStructuralAudit(url);

  if (result.status === 'ok') {
    await emailProspect(email, result.finding);
  } else {
    const reason =
      result.status === 'spa'
        ? 'SPA detected — no static HTML to analyse'
        : result.status === 'no_finding'
          ? 'no structural finding detected'
          : result.reason;

    await emailFoundersFallback(url, reason, email);
  }

  return NextResponse.json({ status: result.status });
}
