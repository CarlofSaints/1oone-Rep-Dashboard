'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not send the reset link');
        setLoading(false);
        return;
      }

      setSent(true);
      setLoading(false);
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
          padding: '2.5rem 2rem', width: '100%', maxWidth: 420,
          boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#E04E2A', marginBottom: 4 }}>1oone</div>
          <h1 style={{ fontSize: '1.1rem', color: '#374151', margin: 0, fontWeight: 600 }}>
            Forgot Your Password?
          </h1>
          <p style={{ color: '#9ca3af', fontSize: '0.8rem', margin: '8px 0 0' }}>
            {sent
              ? 'Check your inbox for the next step.'
              : 'Enter your email and we will send you a link to set a new one.'}
          </p>
        </div>

        {sent ? (
          <>
            <div
              style={{
                background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8,
                padding: '1rem', marginBottom: '1.5rem',
              }}
            >
              <p style={{ color: '#15803d', fontSize: '0.85rem', margin: 0, lineHeight: 1.5 }}>
                If that email is registered, a reset link is on its way. The link works
                once and expires in 60 minutes.
              </p>
              <p style={{ color: '#16a34a', fontSize: '0.78rem', margin: '8px 0 0', lineHeight: 1.5 }}>
                Nothing after a few minutes? Check your spam folder, or ask an
                administrator to confirm the address on your account.
              </p>
            </div>

            <button
              type="button"
              className="btn btn-outline"
              onClick={() => { setSent(false); setEmail(''); }}
              style={{ width: '100%', justifyContent: 'center', padding: '0.65rem', fontSize: '0.9rem', marginBottom: '0.75rem' }}
            >
              Try a different email
            </button>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '1.5rem' }}>
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

            {error && (
              <div style={{ color: '#dc2626', fontSize: '0.8rem', marginBottom: '1rem', textAlign: 'center' }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ width: '100%', justifyContent: 'center', padding: '0.65rem', fontSize: '0.9rem', marginBottom: '0.75rem' }}
            >
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>
        )}

        <div style={{ textAlign: 'center' }}>
          <Link
            href="/login"
            style={{ color: '#3D6273', fontSize: '0.8rem', textDecoration: 'none', fontWeight: 500 }}
          >
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
