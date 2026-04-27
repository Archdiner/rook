import { NextResponse } from 'next/server';
import { Resend } from 'resend';

// Initialize Resend with environment variable
// Users must add RESEND_API_KEY to their .env file
const resend = new Resend(process.env.RESEND_API_KEY || 're_dummy_key');

export async function POST(request: Request) {
  try {
    const { url, email } = await request.json();

    if (!url || !email) {
      return NextResponse.json(
        { error: 'URL and Email are required.' },
        { status: 400 }
      );
    }

    // Send the email to sar367@cornell.edu
    const data = await resend.emails.send({
      from: 'Forge Intake <onboarding@resend.dev>',
      to: 'sar367@cornell.edu',
      subject: `New Forge Audit Request: ${url}`,
      html: `
        <h2>New Audit Request Received</h2>
        <p><strong>Website URL:</strong> <a href="${url}">${url}</a></p>
        <p><strong>Contact Email:</strong> ${email}</p>
        <br/>
        <p><em>This request was submitted via the Forge landing page.</em></p>
      `,
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Resend API Error:', error);
    return NextResponse.json(
      { error: 'Failed to submit request.' },
      { status: 500 }
    );
  }
}
