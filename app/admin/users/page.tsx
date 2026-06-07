'use client';

import { useState, useEffect } from 'react';
import { useAuth, authFetch } from '@/lib/useAuth';
import Sidebar from '@/components/Sidebar';
import Toast from '@/components/Toast';
import PasswordInput from '@/components/PasswordInput';
import type { Role } from '@/lib/types';

interface UserRow {
  id: string;
  email: string;
  name: string;
  surname: string;
  role: Role;
  forcePasswordChange: boolean;
  createdAt: string;
}

const ROLES: Role[] = ['super_admin', 'admin', 'viewer'];

function generatePassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let pw = '';
  for (let i = 0; i < 10; i++) pw += chars[Math.floor(Math.random() * chars.length)];
  return pw;
}

export default function UsersPage() {
  const { session, loading: authLoading, logout } = useAuth(['super_admin', 'admin']);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editUser, setEditUser] = useState<UserRow | null>(null);

  // Form state
  const [formEmail, setFormEmail] = useState('');
  const [formName, setFormName] = useState('');
  const [formSurname, setFormSurname] = useState('');
  const [formRole, setFormRole] = useState<Role>('viewer');
  const [formPassword, setFormPassword] = useState('');
  const [formSendEmail, setFormSendEmail] = useState(true);
  const [formForce, setFormForce] = useState(true);
  const [saving, setSaving] = useState(false);

  // Change password state
  const [changePwUser, setChangePwUser] = useState<string | null>(null);
  const [newPw, setNewPw] = useState('');

  function loadUsers() {
    authFetch('/api/users').then(r => r.json()).then(data => {
      if (Array.isArray(data)) setUsers(data);
    }).catch(() => {});
  }

  useEffect(() => {
    if (session) loadUsers();
  }, [session]);

  function resetForm() {
    setFormEmail('');
    setFormName('');
    setFormSurname('');
    setFormRole('viewer');
    setFormPassword(generatePassword());
    setFormSendEmail(true);
    setFormForce(true);
    setEditUser(null);
  }

  function openCreate() {
    resetForm();
    setShowForm(true);
  }

  function openEdit(u: UserRow) {
    setEditUser(u);
    setFormEmail(u.email);
    setFormName(u.name);
    setFormSurname(u.surname);
    setFormRole(u.role);
    setFormPassword('');
    setFormSendEmail(false);
    setFormForce(u.forcePasswordChange);
    setShowForm(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      if (editUser) {
        // Update
        const body: Record<string, unknown> = {
          id: editUser.id,
          name: formName,
          surname: formSurname,
          role: formRole,
          forcePasswordChange: formForce,
        };
        if (formPassword) body.password = formPassword;
        const res = await authFetch('/api/users', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (res.ok) {
          setToast({ msg: 'User updated', type: 'success' });
          setShowForm(false);
          loadUsers();
        } else {
          setToast({ msg: data.error || 'Update failed', type: 'error' });
        }
      } else {
        // Create
        if (!formEmail || !formName || !formSurname || !formPassword) {
          setToast({ msg: 'All fields required', type: 'error' });
          setSaving(false);
          return;
        }
        const res = await authFetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: formEmail,
            name: formName,
            surname: formSurname,
            role: formRole,
            password: formPassword,
            sendEmail: formSendEmail,
          }),
        });
        const data = await res.json();
        if (res.ok) {
          let msg = 'User created';
          if (formSendEmail) {
            msg += data.emailSent ? ' — credentials emailed' : ` — email failed: ${data.emailError || 'unknown'}`;
          }
          setToast({ msg, type: data.emailSent || !formSendEmail ? 'success' : 'info' });
          setShowForm(false);
          loadUsers();
        } else {
          setToast({ msg: data.error || 'Create failed', type: 'error' });
        }
      }
    } catch {
      setToast({ msg: 'Failed', type: 'error' });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this user permanently?')) return;
    try {
      const res = await authFetch('/api/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        setToast({ msg: 'User deleted', type: 'success' });
        loadUsers();
      } else {
        const data = await res.json();
        setToast({ msg: data.error || 'Delete failed', type: 'error' });
      }
    } catch {
      setToast({ msg: 'Delete failed', type: 'error' });
    }
  }

  async function handleResetPw(userId: string) {
    if (!newPw) return;
    try {
      const res = await authFetch('/api/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: userId, password: newPw, forcePasswordChange: true }),
      });
      if (res.ok) {
        setToast({ msg: 'Password reset — user will be forced to change on login', type: 'success' });
        setChangePwUser(null);
        setNewPw('');
        loadUsers();
      } else {
        setToast({ msg: 'Reset failed', type: 'error' });
      }
    } catch {
      setToast({ msg: 'Reset failed', type: 'error' });
    }
  }

  if (authLoading || !session) {
    return <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>Loading...</div>;
  }

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar role={session.role} name={`${session.name} ${session.surname}`} onLogout={logout} />
      <main style={{ flex: 1, padding: '2rem', minHeight: '100vh' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#111827', marginBottom: '0.25rem' }}>Users</h1>
            <p style={{ color: '#6b7280', fontSize: '0.85rem', margin: 0 }}>Manage dashboard users</p>
          </div>
          <button className="btn btn-primary" onClick={openCreate}>+ Add User</button>
        </div>

        {/* Create/Edit Form */}
        {showForm && (
          <div style={{ background: 'white', borderRadius: 12, padding: '1.5rem', border: '1px solid #e5e7eb', maxWidth: 500, marginBottom: '2rem' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#374151', marginBottom: '1rem' }}>
              {editUser ? 'Edit User' : 'New User'}
            </h2>
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#374151', marginBottom: 4 }}>First Name</label>
                  <input className="input" value={formName} onChange={e => setFormName(e.target.value)} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#374151', marginBottom: 4 }}>Surname</label>
                  <input className="input" value={formSurname} onChange={e => setFormSurname(e.target.value)} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#374151', marginBottom: 4 }}>Email</label>
                <input className="input" type="email" value={formEmail} onChange={e => setFormEmail(e.target.value)} disabled={!!editUser} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#374151', marginBottom: 4 }}>Role</label>
                <select className="select" value={formRole} onChange={e => setFormRole(e.target.value as Role)} style={{ width: '100%' }}>
                  {ROLES.map(r => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#374151', marginBottom: 4 }}>
                  {editUser ? 'New Password (leave blank to keep)' : 'Password'}
                </label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <div style={{ flex: 1 }}>
                    <PasswordInput value={formPassword} onChange={setFormPassword} placeholder={editUser ? 'Leave blank to keep' : 'Password'} />
                  </div>
                  {!editUser && (
                    <button className="btn btn-outline" onClick={() => setFormPassword(generatePassword())} style={{ whiteSpace: 'nowrap', fontSize: '0.75rem' }}>
                      Generate
                    </button>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '1.5rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: '#374151', cursor: 'pointer' }}>
                  <input type="checkbox" checked={formForce} onChange={e => setFormForce(e.target.checked)} />
                  Force password change on login
                </label>
                {!editUser && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: '#374151', cursor: 'pointer' }}>
                    <input type="checkbox" checked={formSendEmail} onChange={e => setFormSendEmail(e.target.checked)} />
                    Email credentials
                  </label>
                )}
              </div>
              {!editUser && formPassword && (
                <div style={{ padding: '0.75rem', background: '#f9fafb', borderRadius: 8, fontSize: '0.8rem', border: '1px solid #e5e7eb' }}>
                  <div style={{ color: '#6b7280', marginBottom: 4 }}>Credentials to share:</div>
                  <div><strong>Email:</strong> {formEmail || '(enter email)'}</div>
                  <div><strong>Password:</strong> {formPassword}</div>
                </div>
              )}
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving...' : editUser ? 'Update User' : 'Create User'}
                </button>
                <button className="btn btn-outline" onClick={() => setShowForm(false)}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* Users Table */}
        <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'auto' }}>
          {users.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>No users yet.</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Force PW</th>
                  <th>Created</th>
                  <th style={{ cursor: 'default' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 500 }}>{u.name} {u.surname}</td>
                    <td>{u.email}</td>
                    <td>
                      <span style={{
                        padding: '2px 8px', borderRadius: 12, fontSize: '0.75rem', fontWeight: 600,
                        background: u.role === 'super_admin' ? '#fee2e2' : u.role === 'admin' ? '#dbeafe' : '#f3f4f6',
                        color: u.role === 'super_admin' ? '#991b1b' : u.role === 'admin' ? '#1e40af' : '#374151',
                      }}>
                        {u.role.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td>{u.forcePasswordChange ? 'Yes' : 'No'}</td>
                    <td style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                      {new Date(u.createdAt).toLocaleDateString('en-ZA')}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="btn btn-outline" style={{ fontSize: '0.7rem', padding: '2px 6px' }} onClick={() => openEdit(u)}>Edit</button>
                        <button
                          className="btn btn-outline"
                          style={{ fontSize: '0.7rem', padding: '2px 6px' }}
                          onClick={() => { setChangePwUser(u.id); setNewPw(generatePassword()); }}
                        >
                          Reset PW
                        </button>
                        {u.id !== session?.id && (
                          <button className="btn btn-danger" style={{ fontSize: '0.7rem', padding: '2px 6px' }} onClick={() => handleDelete(u.id)}>Delete</button>
                        )}
                      </div>
                      {changePwUser === u.id && (
                        <div style={{ marginTop: 6, display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <input className="input" value={newPw} onChange={e => setNewPw(e.target.value)} style={{ width: 140, fontSize: '0.75rem' }} />
                          <button className="btn btn-primary" style={{ fontSize: '0.7rem', padding: '2px 8px' }} onClick={() => handleResetPw(u.id)}>Set</button>
                          <button className="btn btn-outline" style={{ fontSize: '0.7rem', padding: '2px 8px' }} onClick={() => setChangePwUser(null)}>Cancel</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
