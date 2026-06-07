'use client';

import { useState, useEffect } from 'react';
import { useAuth, authFetch } from '@/lib/useAuth';
import Sidebar from '@/components/Sidebar';
import Toast from '@/components/Toast';
import type { Role, PermissionKey, RolePermissions } from '@/lib/types';
import { ALL_PERMISSIONS, PERMISSION_LABELS } from '@/lib/types';

const ROLES: Role[] = ['super_admin', 'admin', 'viewer'];

export default function RolesPage() {
  const { session, loading: authLoading, logout } = useAuth('super_admin');
  const [perms, setPerms] = useState<RolePermissions | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null);

  useEffect(() => {
    if (!session) return;
    authFetch('/api/role-permissions')
      .then(r => r.json())
      .then(data => setPerms(data))
      .catch(() => setToast({ msg: 'Failed to load permissions', type: 'error' }));
  }, [session]);

  function togglePerm(role: Role, perm: PermissionKey) {
    if (!perms) return;
    // Don't allow removing anything from super_admin
    if (role === 'super_admin') return;

    setPerms(prev => {
      if (!prev) return prev;
      const current = prev[role] || [];
      const has = current.includes(perm);
      return {
        ...prev,
        [role]: has ? current.filter(p => p !== perm) : [...current, perm],
      };
    });
  }

  async function handleSave() {
    if (!perms) return;
    setSaving(true);
    try {
      const res = await authFetch('/api/role-permissions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(perms),
      });
      setToast({ msg: res.ok ? 'Permissions saved' : 'Save failed', type: res.ok ? 'success' : 'error' });
    } catch {
      setToast({ msg: 'Save failed', type: 'error' });
    } finally {
      setSaving(false);
    }
  }

  if (authLoading || !session) {
    return <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>Loading...</div>;
  }

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar role={session.role} name={`${session.name} ${session.surname}`} onLogout={logout} />
      <main style={{ flex: 1, padding: '2rem', minHeight: '100vh' }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#111827', marginBottom: '0.25rem' }}>Roles & Permissions</h1>
        <p style={{ color: '#6b7280', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
          Configure which permissions each role has. Super Admin always has all permissions.
        </p>

        {!perms ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>Loading...</div>
        ) : (
          <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ position: 'sticky', left: 0, zIndex: 2, background: '#E04E2A', minWidth: 180 }}>Permission</th>
                  {ROLES.map(role => (
                    <th key={role} style={{ textAlign: 'center', minWidth: 120 }}>
                      {role.replace(/_/g, ' ')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ALL_PERMISSIONS.map(perm => (
                  <tr key={perm}>
                    <td style={{ fontWeight: 500, position: 'sticky', left: 0, background: 'white', zIndex: 1 }}>
                      {PERMISSION_LABELS[perm]}
                    </td>
                    {ROLES.map(role => {
                      const has = (perms[role] || []).includes(perm);
                      const isSuperAdmin = role === 'super_admin';
                      return (
                        <td key={role} style={{ textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={isSuperAdmin ? true : has}
                            onChange={() => togglePerm(role, perm)}
                            disabled={isSuperAdmin}
                            style={{ cursor: isSuperAdmin ? 'not-allowed' : 'pointer', width: 18, height: 18, accentColor: '#E04E2A' }}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ marginTop: '1.25rem' }}>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Permissions'}
          </button>
        </div>
      </main>

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
