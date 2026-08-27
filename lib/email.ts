import { Resend } from 'resend';

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

export async function sendCredentialsEmail(
  toEmail: string,
  name: string,
  password: string
): Promise<{ ok: boolean; error?: string }> {
  const resend = getResend();
  if (!resend) return { ok: false, error: 'RESEND_API_KEY not configured' };

  try {
    await resend.emails.send({
      from: 'OuterJoin <noreply@outerjoin.co.za>',
      to: toEmail,
      subject: '1oone Rep Dashboard — Your Login Credentials',
      html: `
        <div style="font-family: system-ui, sans-serif; max-width: 500px; margin: 0 auto;">
          <div style="background: #E04E2A; padding: 20px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 1.2rem;">1oone Rep Dashboard</h1>
          </div>
          <div style="padding: 24px; background: white; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
            <p style="color: #374151; font-size: 0.95rem;">Hi ${name},</p>
            <p style="color: #374151; font-size: 0.95rem;">Your account has been created. Here are your login credentials:</p>
            <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 16px 0;">
              <p style="margin: 4px 0; font-size: 0.9rem;"><strong>Email:</strong> ${toEmail}</p>
              <p style="margin: 4px 0; font-size: 0.9rem;"><strong>Password:</strong> ${password}</p>
            </div>
            <p style="color: #6b7280; font-size: 0.85rem;">You will be asked to change your password on first login.</p>
            <p style="color: #9ca3af; font-size: 0.75rem; margin-top: 24px;">This is an automated message from the 1oone Rep Dashboard.</p>
          </div>
        </div>
      `,
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Email send failed' };
  }
}

/**
 * Sends a one-time reset link. Deliberately carries no password — a hash cannot be
 * reversed, so there is nothing to "resend", and a password in an inbox outlives the
 * reset itself.
 */
export async function sendPasswordResetEmail(
  toEmail: string,
  name: string,
  resetUrl: string,
  ttlMinutes: number
): Promise<{ ok: boolean; error?: string }> {
  const resend = getResend();
  if (!resend) return { ok: false, error: 'RESEND_API_KEY not configured' };

  try {
    await resend.emails.send({
      from: 'OuterJoin <noreply@outerjoin.co.za>',
      to: toEmail,
      subject: 'Reset your 1oone Rep Dashboard password',
      html: `
        <div style="font-family: system-ui, sans-serif; max-width: 500px; margin: 0 auto;">
          <div style="background: #E04E2A; padding: 20px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 1.2rem;">1oone Rep Dashboard</h1>
          </div>
          <div style="padding: 24px; background: white; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
            <p style="color: #374151; font-size: 0.95rem;">Hi ${name},</p>
            <p style="color: #374151; font-size: 0.95rem;">We received a request to reset the password for your 1oone Rep Dashboard account. Click the button below to choose a new one.</p>
            <div style="text-align: center; margin: 24px 0;">
              <a href="${resetUrl}" style="display: inline-block; background: #E04E2A; color: white; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-size: 0.95rem; font-weight: 600;">Reset My Password</a>
            </div>
            <p style="color: #6b7280; font-size: 0.85rem;">This link works once and expires in ${ttlMinutes} minutes.</p>
            <p style="color: #6b7280; font-size: 0.85rem;">If the button does not work, copy this address into your browser:</p>
            <p style="color: #3D6273; font-size: 0.75rem; word-break: break-all;">${resetUrl}</p>
            <p style="color: #6b7280; font-size: 0.85rem;">Did not request this? You can ignore this email. Your password stays as it is.</p>
            <p style="color: #9ca3af; font-size: 0.75rem; margin-top: 24px;">This is an automated message from the 1oone Rep Dashboard.</p>
          </div>
        </div>
      `,
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Email send failed' };
  }
}
