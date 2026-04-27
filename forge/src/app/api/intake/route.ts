import { NextResponse } from 'next/server';
import { Resend } from 'resend';

function getResendClient() {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    throw new Error('RESEND_API_KEY is not set');
  }
  return new Resend(key);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, url } = body;

    // Validate required fields
    if (!name || !email || !url) {
      return NextResponse.json(
        { error: 'Name, email, and website URL are required.' },
        { status: 400 }
      );
    }

    // Basic email format check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: 'Please provide a valid email address.' },
        { status: 400 }
      );
    }

    const timestamp = new Date().toLocaleString('en-US', {
      timeZone: 'America/New_York',
      dateStyle: 'full',
      timeStyle: 'short',
    });

    const { data, error } = await getResendClient().emails.send({
      from: 'Forge Intake <onboarding@resend.dev>',
      to: 'sar367@cornell.edu',
      subject: `New Forge Survey Request — ${url}`,
      html: `
        <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; color: #0E0C09;">
          <div style="border-bottom: 2px solid #0E0C09; padding-bottom: 16px; margin-bottom: 24px;">
            <h1 style="font-size: 24px; font-weight: 400; margin: 0;">New Survey Request</h1>
            <p style="font-size: 13px; color: #5A4F3A; margin: 6px 0 0; letter-spacing: 0.1em; text-transform: uppercase;">Forge Intake · ${timestamp}</p>
          </div>

          <table style="width: 100%; border-collapse: collapse; font-size: 16px;">
            <tr style="border-bottom: 1px solid #D9CFB0;">
              <td style="padding: 12px 0; color: #5A4F3A; width: 120px; vertical-align: top;">Name</td>
              <td style="padding: 12px 0; font-weight: 400;">${name}</td>
            </tr>
            <tr style="border-bottom: 1px solid #D9CFB0;">
              <td style="padding: 12px 0; color: #5A4F3A; vertical-align: top;">Email</td>
              <td style="padding: 12px 0;"><a href="mailto:${email}" style="color: #7A4A1A;">${email}</a></td>
            </tr>
            <tr>
              <td style="padding: 12px 0; color: #5A4F3A; vertical-align: top;">Website</td>
              <td style="padding: 12px 0;"><a href="${url}" style="color: #7A4A1A;">${url}</a></td>
            </tr>
          </table>

          <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #D9CFB0; font-size: 13px; color: #5A4F3A; font-style: italic;">
            Submitted via the Forge landing page.
          </div>
        </div>
      `,
    });

    if (error) {
      console.error('Resend API Error:', error);
      return NextResponse.json(
        { error: 'Failed to submit request. Please try again.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, id: data?.id });
  } catch (error) {
    console.error('Intake Error:', error);
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}
