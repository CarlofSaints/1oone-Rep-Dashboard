import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { loadUsers, saveUsers } from '@/lib/userData';
import { requireLogin, noCacheHeaders } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const user = await requireLogin(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { currentPassword, newPassword } = await req.json();
    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: 'Both passwords required' }, { status: 400 });
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 });
    }

    const users = await loadUsers();
    const idx = users.findIndex(u => u.id === user.id);
    if (idx === -1) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    users[idx].passwordHash = await bcrypt.hash(newPassword, 10);
    users[idx].forcePasswordChange = false;
    await saveUsers(users);

    const session = {
      id: users[idx].id,
      email: users[idx].email,
      name: users[idx].name,
      surname: users[idx].surname,
      role: users[idx].role,
      forcePasswordChange: false,
    };

    return NextResponse.json(session, { headers: noCacheHeaders() });
  } catch (err) {
    console.error('Change password error:', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
