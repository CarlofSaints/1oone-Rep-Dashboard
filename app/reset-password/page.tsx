'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import PasswordInput from '@/components/PasswordInput';

const SESSION_KEY = '1oone_session';

type Status = 'checking' | 'valid' | 'invalid';

export default function ResetPasswordPage() {
  const [status, setStatus] = useState<Status>('checking');
  const [token, setToken] = useState('');
  const [name, setName] = useState('');
  const [linkError, setLinkError] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // The token is read straight off the URL rather than via useSearchParams, which
  // would need a Suspense boundary to build.
  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get('token') || '';
    setToken(raw);

    if (!raw) {
      setLinkError('This reset link is not valid. Please request a new one.');
      setStatus('invalid');
      return;
    }

    // A stale session would otherwise bounce the user straight back out again.
    localStorage.removeItem(SESSION_KEY);

    fetch(`/api/auth/reset-password?token=${encodeURIComponent(raw)}`, { cache: 'no-store' })
      .then(res => res.json())
      .then(data => {
        if (data.valid) {
          setName(data.name || '');
          setStatus('valid');
        } else {
          setLinkError(data.message || 'This reset link is not valid. Please request a new one.');
          setStatus('invalid');
        }
      })
      .catch(() => {
        setLinkError('Could not check this link. Please try again.');
        setStatus('invalid');
      });
  }, []);

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
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      });

      const data = await res.json();
      if (!res.ok) {
        // A link that died between page load and submit becomes a dead-link screen,
        // not an inline error the user can retype their way out of.
        if (data.reason) {
          setLinkError(data.error);
          setStatus('invalid');
          return;
        }
        setError(data.error || 'Failed to reset password');
        setSaving(false);
        return;
      }

      window.location.href = '/login?reset=1';
    } catch {
      setError('Network error');
      setSaving(false);
    }
  }

  const shell = (children: React.ReactNode) => (
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
        {children}
      </div>
    </div>
  );

  if (status === 'checking') {
    return shell(
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '2rem', fontWeight: 800, color: '#E04E2A', marginBottom: 4 }}>1oone</div>
        <p style={{ color: '#6b7280', fontSize: '0.85rem', margin: 0 }}>Checking your reset link...</p>
      </div>
    );
  }

  if (status === 'invalid') {
    return shell(
      <>
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#E04E2A', marginBottom: 4 }}>1oone</div>
          <h1 style={{ fontSize: '1.1rem', color: '#374151', margin: 0, fontWeight: 600 }}>
            Link No Longer Works
          </h1>
        </div>

        <div
          style={{
            background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8,
            padding: '1rem', marginBottom: '1.5rem',
          }}
        >
          <p style={{ color: '#b91c1c', fontSize: '0.85rem', margin: 0, lineHeight: 1.5 }}>
            {linkError}
          </p>
        </div>

        <Link
          href="/forgot-password"
          className="btn btn-primary"
          style={{ width: '100%', justifyContent: 'center', padding: '0.65rem', fontSize: '0.9rem', textDecoration: 'none', marginBottom: '0.75rem' }}
        >
          Request a New Link
        </Link>

        <div style={{ textAlign: 'center' }}>
          <Link href="/login" style={{ color: '#3D6273', fontSize: '0.8rem', textDecoration: 'none', fontWeight: 500 }}>
            Back to sign in
          </Link>
        </div>
      </>
    );
  }

  return shell(
    <>
      <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
        <div style={{ fontSize: '2rem', fontWeight: 800, color: '#E04E2A', marginBottom: 4 }}>1oone</div>
        <h1 style={{ fontSize: '1.1rem', color: '#374151', margin: 0, fontWeight: 600 }}>
          Set a New Password
        </h1>
        <p style={{ color: '#9ca3af', fontSize: '0.8rem', margin: '8px 0 0' }}>
          {name ? `Hi ${name}, choose a new password below.` : 'Choose a new password below.'}
        </p>
      </div>

      <form onSubmit={handleSubmit}>
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
    </>
  );
}
