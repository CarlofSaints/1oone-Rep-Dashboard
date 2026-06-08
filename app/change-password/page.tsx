'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import PasswordInput from '@/components/PasswordInput';

const SESSION_KEY = '1oone_session';

interface Session {
  id: string;
  email: string;
  name: string;
  surname: string;
  role: string;
  forcePasswordChange: boolean;
}

export default function ChangePasswordPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) {
      router.replace('/login');
      return;
    }
    try {
      setSession(JSON.parse(raw));
    } catch {
      router.replace('/login');
    }
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setSaving(true);
    try {
      const headers = new Headers({ 'Content-Type': 'application/json' });
      if (session) headers.set('x-user-id', session.id);

      const res = await fetch('/api/users/change-password', {
        method: 'POST',
        headers,
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to change password');
        setSaving(false);
        return;
      }

      // Update session with forcePasswordChange: false
      localStorage.setItem(SESSION_KEY, JSON.stringify(data));
      router.replace('/');
    } catch {
      setError('Network error');
      setSaving(false);
    }
  }

  if (!session) {
    return <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>Loading...</div>;
  }

  return (
    <div
      style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg, #3D6273 0%, #2D2D2D 100%)',
        padding: '1rem',
      }}
    >
      <div
        style={{
          background: 'rgba(255,255,255,0.97)', borderRadius: 16,
          padding: '2.5rem 2rem', width: '100%', maxWidth: 420,
          boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#E04E2A', marginBottom: 4 }}>1oone</div>
          <h1 style={{ fontSize: '1.1rem', color: '#374151', margin: 0, fontWeight: 600 }}>
            Change Your Password
          </h1>
          <p style={{ color: '#9ca3af', fontSize: '0.8rem', margin: '8px 0 0' }}>
            Hi {session.name}, please set a new password to continue.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', color: '#374151', marginBottom: 4, fontWeight: 500 }}>
              Current Password
            </label>
            <PasswordInput value={currentPassword} onChange={setCurrentPassword} placeholder="Enter current password" required />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', color: '#374151', marginBottom: 4, fontWeight: 500 }}>
              New Password
            </label>
            <PasswordInput value={newPassword} onChange={setNewPassword} placeholder="At least 6 characters" required />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', color: '#374151', marginBottom: 4, fontWeight: 500 }}>
              Confirm New Password
            </label>
            <PasswordInput value={confirmPassword} onChange={setConfirmPassword} placeholder="Confirm new password" required />
          </div>

          {error && (
            <div style={{ color: '#dc2626', fontSize: '0.8rem', marginBottom: '1rem', textAlign: 'center' }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={saving}
            style={{ width: '100%', justifyContent: 'center', padding: '0.65rem', fontSize: '0.9rem' }}
          >
            {saving ? 'Saving...' : 'Set New Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
