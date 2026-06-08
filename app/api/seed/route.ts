import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { loadUsers, saveUsers, User } from '@/lib/userData';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const secret = req.nextUrl.searchParams.get('secret');
    if (secret !== '1oone-seed-2026') {
      return NextResponse.json({ error: 'Invalid secret' }, { status: 403 });
    }

    const existing = await loadUsers();
    const seedEmail = 'carl@outerjoin.co.za';
    const hash = await bcrypt.hash('1oone2026', 10);

    const found = existing.find(u => u.email.toLowerCase() === seedEmail);
    if (found) {
      // Reset password for existing super admin
      found.passwordHash = hash;
      found.forcePasswordChange = false;
      found.role = 'super_admin';
      await saveUsers(existing);
      return NextResponse.json({ ok: true, user: seedEmail, action: 'password_reset', totalUsers: existing.length });
    }

    const seedUser: User = {
      id: crypto.randomUUID(),
      email: seedEmail,
      name: 'Carl',
      surname: 'Dos Santos',
      passwordHash: hash,
      role: 'super_admin',
      forcePasswordChange: false,
      createdAt: new Date().toISOString(),
    };

    existing.push(seedUser);
    await saveUsers(existing);
    return NextResponse.json({ ok: true, user: seedEmail, action: 'created', totalUsers: existing.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Seed error:', msg);
    return NextResponse.json({ error: 'Seed failed', detail: msg }, { status: 500 });
  }
}
