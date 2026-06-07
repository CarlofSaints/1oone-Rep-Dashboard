import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { loadUsers, saveUsers, User } from '@/lib/userData';
import { requireRole, noCacheHeaders } from '@/lib/auth';
import { sendCredentialsEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const user = await requireRole(req, ['super_admin', 'admin']);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const users = await loadUsers();
  const safe = users.map(({ passwordHash, ...rest }) => rest);
  return NextResponse.json(safe, { headers: noCacheHeaders() });
}

export async function POST(req: NextRequest) {
  const user = await requireRole(req, ['super_admin', 'admin']);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { email, name, surname, role, password, sendEmail } = body;

    if (!email || !name || !surname || !role || !password) {
      return NextResponse.json({ error: 'All fields required' }, { status: 400 });
    }

    const users = await loadUsers();
    if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
      return NextResponse.json({ error: 'Email already exists' }, { status: 409 });
    }

    const hash = await bcrypt.hash(password, 10);
    const newUser: User = {
      id: crypto.randomUUID(),
      email,
      name,
      surname,
      passwordHash: hash,
      role,
      forcePasswordChange: true,
      createdAt: new Date().toISOString(),
    };

    users.push(newUser);
    await saveUsers(users);

    let emailResult: { ok: boolean; error?: string } = { ok: false, error: 'Not sent' };
    if (sendEmail) {
      emailResult = await sendCredentialsEmail(email, name, password);
    }

    const { passwordHash, ...safe } = newUser;
    return NextResponse.json({ user: safe, emailSent: emailResult.ok, emailError: emailResult.error }, { headers: noCacheHeaders() });
  } catch (err) {
    console.error('Create user error:', err);
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const currentUser = await requireRole(req, ['super_admin', 'admin']);
  if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { id, name, surname, role, password, forcePasswordChange } = body;

    if (!id) return NextResponse.json({ error: 'User ID required' }, { status: 400 });

    const users = await loadUsers();
    const idx = users.findIndex(u => u.id === id);
    if (idx === -1) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    if (name !== undefined) users[idx].name = name;
    if (surname !== undefined) users[idx].surname = surname;
    if (role !== undefined) users[idx].role = role;
    if (forcePasswordChange !== undefined) users[idx].forcePasswordChange = forcePasswordChange;
    if (password) {
      users[idx].passwordHash = await bcrypt.hash(password, 10);
    }

    await saveUsers(users);

    const { passwordHash, ...safe } = users[idx];
    return NextResponse.json(safe, { headers: noCacheHeaders() });
  } catch (err) {
    console.error('Update user error:', err);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const currentUser = await requireRole(req, ['super_admin']);
  if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: 'User ID required' }, { status: 400 });

    const users = await loadUsers();
    const filtered = users.filter(u => u.id !== id);
    if (filtered.length === users.length) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    await saveUsers(filtered);
    return NextResponse.json({ ok: true }, { headers: noCacheHeaders() });
  } catch (err) {
    console.error('Delete user error:', err);
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
  }
}
