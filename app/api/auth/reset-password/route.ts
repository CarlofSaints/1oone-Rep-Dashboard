import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { loadUsers, saveUsers } from '@/lib/userData';
import { noCacheHeaders } from '@/lib/auth';
import { lookupResetToken, consumeResetTokensForUser } from '@/lib/resetTokens';

export const dynamic = 'force-dynamic';

function reasonMessage(reason: 'unknown' | 'used' | 'expired'): string {
  if (reason === 'expired') return 'This reset link has expired. Please request a new one.';
  if (reason === 'used') return 'This reset link has already been used. Please request a new one.';
  return 'This reset link is not valid. Please request a new one.';
}

/**
 * Checked when the page loads so a dead link says so up front, rather than after the
 * user has typed a new password twice.
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token') || '';
  if (!token) {
    return NextResponse.json({ valid: false, reason: 'unknown' }, { headers: noCacheHeaders() });
  }

  const lookup = await lookupResetToken(token);
  if (!lookup.valid) {
    return NextResponse.json(
      { valid: false, reason: lookup.reason, message: reasonMessage(lookup.reason) },
      { headers: noCacheHeaders() }
    );
  }

  const users = await loadUsers();
  const user = users.find(u => u.id === lookup.record.userId);
  if (!user) {
    return NextResponse.json(
      { valid: false, reason: 'unknown', message: reasonMessage('unknown') },
      { headers: noCacheHeaders() }
    );
  }

  return NextResponse.json({ valid: true, name: user.name, email: user.email }, { headers: noCacheHeaders() });
}

export async function POST(req: NextRequest) {
  try {
    const { token, newPassword } = await req.json();

    if (!token || !newPassword) {
      return NextResponse.json({ error: 'Token and new password required' }, { status: 400 });
    }
    if (newPassword.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    const lookup = await lookupResetToken(token);
    if (!lookup.valid) {
      return NextResponse.json(
        { error: reasonMessage(lookup.reason), reason: lookup.reason },
        { status: 400 }
      );
    }

    const users = await loadUsers();
    const idx = users.findIndex(u => u.id === lookup.record.userId);
    if (idx === -1) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const hash = await bcrypt.hash(newPassword, 10);

    // Burn the token before writing the password. If the write then fails the user
    // simply requests another link; a token left live after use cannot be undone.
    await consumeResetTokensForUser(lookup.record.userId);

    users[idx].passwordHash = hash;
    users[idx].forcePasswordChange = false;
    await saveUsers(users);

    console.log('[reset-password] Password reset completed for', users[idx].email);

    return NextResponse.json({ ok: true, email: users[idx].email }, { headers: noCacheHeaders() });
  } catch (err) {
    console.error('[reset-password] Failed:', err);
    return NextResponse.json({ error: 'Failed to reset password' }, { status: 500 });
  }
}
