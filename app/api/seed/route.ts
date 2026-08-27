import { NextRequest, NextResponse } from 'next/server';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { loadUsers, saveUsers, User } from '@/lib/userData';
import { noCacheHeaders } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * This repo is PUBLIC. Nothing in this file may be a credential: the guard reads
 * SEED_SECRET from the environment, and the seeded password is minted fresh and
 * returned once to the caller who already proved they hold that secret.
 */

function secretMatches(supplied: string, configured: string): boolean {
  const a = Buffer.from(supplied);
  const b = Buffer.from(configured);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Readable-ish, still 96 bits of entropy. */
function generatePassword(): string {
  return randomBytes(12).toString('base64url');
}

export async function GET(req: NextRequest) {
  try {
    const configured = process.env.SEED_SECRET;

    // Distinguished from a wrong secret on purpose. "403 Invalid secret" when the
    // env var is simply missing is the kind of failure that costs an hour.
    if (!configured) {
      console.error('[seed] SEED_SECRET is not configured — seed endpoint is disabled');
      return NextResponse.json(
        { error: 'Seed endpoint is disabled: SEED_SECRET is not configured on this deployment' },
        { status: 503, headers: noCacheHeaders() }
      );
    }

    const secret = req.nextUrl.searchParams.get('secret') || '';
    if (!secretMatches(secret, configured)) {
      console.warn('[seed] Rejected a seed attempt with a bad secret');
      return NextResponse.json({ error: 'Invalid secret' }, { status: 403, headers: noCacheHeaders() });
    }

    const existing = await loadUsers();
    const seedEmail = 'carl@outerjoin.co.za';
    const temporaryPassword = generatePassword();
    const hash = await bcrypt.hash(temporaryPassword, 10);

    // forcePasswordChange is set either way: a password that has travelled through a
    // URL response is a one-time key, not a password to keep.
    const found = existing.find(u => u.email.toLowerCase() === seedEmail);
    if (found) {
      found.passwordHash = hash;
      found.forcePasswordChange = true;
      found.role = 'super_admin';
      await saveUsers(existing);
      console.log('[seed] Reset the super admin password for', seedEmail);
      return NextResponse.json(
        {
          ok: true,
          user: seedEmail,
          action: 'password_reset',
          temporaryPassword,
          note: 'Shown once. Sign in with it now and you will be asked to set a new password.',
          totalUsers: existing.length,
        },
        { headers: noCacheHeaders() }
      );
    }

    const seedUser: User = {
      id: crypto.randomUUID(),
      email: seedEmail,
      name: 'Carl',
      surname: 'Dos Santos',
      passwordHash: hash,
      role: 'super_admin',
      forcePasswordChange: true,
      createdAt: new Date().toISOString(),
    };

    existing.push(seedUser);
    await saveUsers(existing);
    console.log('[seed] Created the super admin', seedEmail);

    return NextResponse.json(
      {
        ok: true,
        user: seedEmail,
        action: 'created',
        temporaryPassword,
        note: 'Shown once. Sign in with it now and you will be asked to set a new password.',
        totalUsers: existing.length,
      },
      { headers: noCacheHeaders() }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[seed] Failed:', msg);
    return NextResponse.json({ error: 'Seed failed', detail: msg }, { status: 500 });
  }
}
