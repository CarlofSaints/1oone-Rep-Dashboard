import { NextRequest, NextResponse } from 'next/server';
import { loadUsers } from '@/lib/userData';
import { noCacheHeaders } from '@/lib/auth';
import { createResetToken, getAppBaseUrl, RESET_TTL_MINUTES } from '@/lib/resetTokens';
import { sendPasswordResetEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';

/**
 * The same answer goes back whether or not the address is on file. This endpoint is
 * public and unauthenticated, so any difference in response — wording, status, timing
 * of a "not found" — turns it into an oracle for enumerating who has an account.
 */
const GENERIC = {
  ok: true,
  message: 'If that email is registered, a reset link is on its way.',
};

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email required' }, { status: 400 });
    }

    const target = email.trim().toLowerCase();
    const users = await loadUsers();
    const user = users.find(u => u.email.toLowerCase() === target);

    if (!user) {
      console.warn('[forgot-password] No account matches', target);
      return NextResponse.json(GENERIC, { headers: noCacheHeaders() });
    }

    const created = await createResetToken(user.id, user.email);
    if (!created) {
      console.warn('[forgot-password] Cooldown still active for', user.email);
      return NextResponse.json(GENERIC, { headers: noCacheHeaders() });
    }

    const base = getAppBaseUrl(req);
    if (!base) {
      console.error('[forgot-password] Could not resolve a base URL — set APP_URL on Vercel');
      return NextResponse.json(GENERIC, { headers: noCacheHeaders() });
    }

    const resetUrl = `${base}/reset-password?token=${created.token}`;
    const sent = await sendPasswordResetEmail(user.email, user.name, resetUrl, RESET_TTL_MINUTES);

    // The user only ever sees GENERIC, so the server log is the single place this
    // failure can surface. Make it findable.
    if (sent.ok) {
      console.log('[forgot-password] Resend ACCEPTED reset email for', user.email, '— accepted is not delivered');
    } else {
      console.error('[forgot-password] Resend REJECTED reset email for', user.email, '—', sent.error);
    }

    return NextResponse.json(GENERIC, { headers: noCacheHeaders() });
  } catch (err) {
    console.error('[forgot-password] Failed:', err);
    return NextResponse.json(GENERIC, { headers: noCacheHeaders() });
  }
}
