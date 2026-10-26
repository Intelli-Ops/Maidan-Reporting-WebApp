'use strict';

const config = require('../config');

// Thin wrapper over Brevo's transactional email REST API — no SDK, since it's
// a single endpoint. Whoever owns the Brevo account (client, in production;
// whoever's testing, for now) supplies BREVO_API_KEY/BREVO_SENDER_EMAIL in
// their own .env — nothing here is tied to a specific account.
async function sendEmail({ to, subject, html }) {
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': config.brevoApiKey,
    },
    body: JSON.stringify({
      sender: { email: config.brevoSenderEmail, name: config.brevoSenderName },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Brevo send failed (${response.status}): ${body.slice(0, 300)}`);
  }
}

// Light-only, table-based layout (safest across email clients) with inline
// styles throughout — most clients strip <style> blocks, so anything that
// actually needs to render reliably has to be inline. The color-scheme meta
// tags stop Gmail/Apple Mail from auto-inverting this into a dark palette on
// devices with dark mode on.
function buildOtpEmailHtml(otp) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>Password Reset Code</title>
</head>
<body style="margin:0; padding:0; background-color:#F4F6FA; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F4F6FA;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px; background-color:#ffffff; border-radius:18px; overflow:hidden; box-shadow:0 2px 28px rgba(18,53,111,0.10);">

          <tr>
            <td style="height:5px; line-height:5px; font-size:0; background-color:#1E4FA0;">&nbsp;</td>
          </tr>
          <tr>
            <td style="height:2px; line-height:2px; font-size:0; background-color:#C6F135;">&nbsp;</td>
          </tr>

          <tr>
            <td style="padding:36px 40px 4px 40px; text-align:center;">
              <div style="font-size:12px; font-weight:700; letter-spacing:2.5px; color:#1E4FA0; text-transform:uppercase;">Maidan Sports Complex</div>
            </td>
          </tr>
          <tr>
            <td style="padding:10px 40px 0 40px; text-align:center;">
              <div style="font-size:23px; font-weight:650; color:#14171F; letter-spacing:-0.2px;">Reset your password</div>
            </td>
          </tr>
          <tr>
            <td style="padding:14px 40px 0 40px; text-align:center;">
              <p style="font-size:15px; line-height:1.6; color:#64748B; margin:0;">
                Enter this code to set a new password for your account.
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:28px 40px 6px 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background-color:#EAF0FC; border-radius:14px; padding:24px; text-align:center;">
                    <span style="font-family:'SF Mono',Menlo,Consolas,monospace; font-variant-numeric:tabular-nums; font-size:36px; font-weight:700; letter-spacing:9px; color:#12356F;">${otp}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:10px 40px 0 40px; text-align:center;">
              <p style="font-size:13px; color:#94A3B8; margin:0;">Expires 10 minutes after this email was sent.</p>
            </td>
          </tr>

          <tr>
            <td style="padding:28px 40px 32px 40px; text-align:center;">
              <p style="font-size:13px; line-height:1.6; color:#94A3B8; margin:0;">
                Didn't request this? You can safely ignore this email — your password won't be changed.
              </p>
            </td>
          </tr>

          <tr>
            <td style="border-top:1px solid #EEF1F6; padding:18px 40px; text-align:center;">
              <p style="font-size:12px; color:#B6BECC; margin:0;">
                Maidan Sports Complex &middot; automated message, please don't reply
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

module.exports = { sendEmail, buildOtpEmailHtml };
