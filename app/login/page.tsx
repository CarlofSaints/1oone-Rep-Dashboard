'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import PasswordInput from '@/components/PasswordInput';

const SESSION_KEY = '1oone_session';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [justReset, setJustReset] = useState(false);

  // Set by /reset-password on success, so the landing here reads as a finished job
  // rather than a bounce back to the start.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('reset') === '1') {
      setJustReset(true);
      window.history.replaceState({}, '', '/login');
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Login failed');
        setLoading(false);
        return;
      }

      localStorage.setItem(SESSION_KEY, JSON.stringify(data));
      window.location.href = data.forcePasswordChange ? '/change-password' : '/';
    } catch {
      setError('Network error');
      setLoading(false);
    }
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
          padding: '2.5rem 2rem', width: '100%', maxWidth: 400,
          boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#E04E2A', marginBottom: 4 }}>1oone</div>
          <h1 style={{ fontSize: '1.1rem', color: '#374151', margin: 0, fontWeight: 600 }}>
            Rep Dashboard
          </h1>
          <p style={{ color: '#9ca3af', fontSize: '0.8rem', margin: '4px 0 0' }}>
            Sign in to your account
          </p>
        </div>

        {justReset && (
          <div
            style={{
              background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8,
              padding: '0.75rem 1rem', marginBottom: '1.25rem',
            }}
          >
            <p style={{ color: '#15803d', fontSize: '0.82rem', margin: 0, lineHeight: 1.5, textAlign: 'center' }}>
              Password updated. Sign in with your new password.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', color: '#374151', marginBottom: 4, fontWeight: 500 }}>
              Email
            </label>
            <input
              className="input"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoFocus
              placeholder="you@company.com"
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', color: '#374151', marginBottom: 4, fontWeight: 500 }}>
              Password
            </label>
            <PasswordInput value={password} onChange={setPassword} placeholder="Enter password" required />
          </div>

          {error && (
            <div style={{ color: '#dc2626', fontSize: '0.8rem', marginBottom: '1rem', textAlign: 'center' }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ width: '100%', justifyContent: 'center', padding: '0.65rem', fontSize: '0.9rem' }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '1rem' }}>
          <Link
            href="/forgot-password"
            style={{ color: '#3D6273', fontSize: '0.8rem', textDecoration: 'none', fontWeight: 500 }}
          >
            Forgot your password?
          </Link>
        </div>
      </div>
    </div>
  );
}
