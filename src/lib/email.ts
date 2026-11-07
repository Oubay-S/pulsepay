// ============================================================
// PulsePay — Transactional Email (Resend)
// Follow-ups carry the private client-page link. Email is optional:
// the client page works on its own if Resend is not configured.
// ============================================================

import { Resend } from 'resend';
import { formatDate, formatMoney } from '@/lib/client-portal/format';

export interface FollowUpEmailInput {
  to: string;
  clientName: string;
  businessName: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  dueDate: string;
  url: string;
}

export interface FollowUpEmailContent {
  subject: string;
  html: string;
  text: string;
}

export interface EmailResult {
  sent: boolean;
  skipped: boolean;
  error?: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildFollowUpEmail(input: FollowUpEmailInput): FollowUpEmailContent {
  const firstName = input.clientName.trim().split(/\s+/)[0] || 'there';
  const amount = formatMoney(input.amount, input.currency);
  const dueDate = formatDate(input.dueDate);

  const subject = `A note from ${input.businessName} about invoice ${input.invoiceNumber}`;

  const text = [
    `Hi ${firstName},`,
    '',
    `${input.businessName} asked us to follow up on invoice ${input.invoiceNumber} for ${amount}, due ${dueDate}.`,
    '',
    'If you have a question about the work or need more time to pay, you can reply directly on your private page. You will see any options that fit the business rules.',
    '',
    input.url,
    '',
    'If you have already paid, please ignore this message.',
    '',
    `PulsePay, on behalf of ${input.businessName}`,
  ].join('\n');

  const html = `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background:#f3f6fb;font-family:Inter,Segoe UI,Arial,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f6fb;padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e1e8f2;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="padding:22px 26px 0;">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="width:38px;height:38px;border-radius:11px;background:#2453d6;color:#ffffff;font-size:12px;font-weight:800;text-align:center;vertical-align:middle;">PP</td>
                    <td style="padding-left:10px;">
                      <div style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#8493a8;">PulsePay</div>
                      <div style="font-size:13px;font-weight:700;color:#0f172a;">${escapeHtml(
                        input.businessName
                      )}</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 26px 0;">
                <p style="margin:0;font-size:15px;line-height:1.55;">Hi ${escapeHtml(firstName)},</p>
                <p style="margin:10px 0 0;font-size:14px;line-height:1.6;color:#5a6b84;">
                  ${escapeHtml(input.businessName)} asked us to follow up on invoice
                  <strong style="color:#0f172a;">${escapeHtml(input.invoiceNumber)}</strong>.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 26px 0;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e1e8f2;border-radius:12px;background:#f7f9fd;">
                  <tr>
                    <td style="padding:14px 16px;">
                      <div style="font-size:9px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;color:#8493a8;">Invoice amount</div>
                      <div style="margin-top:3px;font-size:28px;font-weight:800;letter-spacing:-0.03em;color:#0f172a;">${escapeHtml(
                        amount
                      )}</div>
                      <div style="margin-top:3px;font-size:11px;color:#5a6b84;">Due ${escapeHtml(
                        dueDate
                      )}</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 26px 0;">
                <p style="margin:0;font-size:13.5px;line-height:1.6;color:#5a6b84;">
                  If you have a question about the work or need more time to pay, reply on your
                  private page. You will see any options that fit the business rules.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 26px 0;">
                <a href="${escapeHtml(
                  input.url
                )}" style="display:inline-block;padding:12px 18px;border-radius:9px;background:#2453d6;color:#ffffff;font-size:13px;font-weight:700;text-decoration:none;">View invoice &amp; reply</a>
              </td>
            </tr>
            <tr>
              <td style="padding:22px 26px 24px;">
                <p style="margin:0;font-size:11px;line-height:1.55;color:#8493a8;">
                  If you have already paid, please ignore this message. This private link was sent
                  by PulsePay on behalf of ${escapeHtml(input.businessName)}.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject, html, text };
}

export async function sendFollowUpEmail(input: FollowUpEmailInput): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    return { sent: false, skipped: true };
  }

  const content = buildFollowUpEmail(input);
  const from = process.env.EMAIL_FROM || 'PulsePay <onboarding@resend.dev>';

  try {
    const resend = new Resend(apiKey);
    const result = await resend.emails.send({
      from,
      to: input.to,
      subject: content.subject,
      html: content.html,
      text: content.text,
    });

    if (result.error) {
      return {
        sent: false,
        skipped: false,
        error: result.error.message || 'Resend rejected the message.',
      };
    }

    return { sent: true, skipped: false };
  } catch (error: unknown) {
    return {
      sent: false,
      skipped: false,
      error: error instanceof Error ? error.message : 'The email could not be sent.',
    };
  }
}
