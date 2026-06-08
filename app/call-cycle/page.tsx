'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth, authFetch } from '@/lib/useAuth';
import Sidebar from '@/components/Sidebar';
import Toast from '@/components/Toast';
import UploadZone from '@/components/UploadZone';
import type { CallCycleEntry, CallCycleUploadMeta } from '@/lib/types';

function formatSchedule(weeks: Record<number, string>): string {
  const parts: string[] = [];
  const keys = Object.keys(weeks).map(Number).sort((a, b) => a - b);
  for (const k of keys) {
    parts.push(`W${k}: ${weeks[k]}`);
  }
  return parts.join(', ');
}

export default function CallCyclePage() {
  const { session, loading: authLoading, logout } = useAuth();
  const [index, setIndex] = useState<CallCycleUploadMeta[]>([]);
  const [merged, setMerged] = useState<CallCycleEntry[]>([]);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [search, setSearch] = useState('');
  const [repFilter, setRepFilter] = useState('');

  function loadData() {
    authFetch('/api/call-cycle')
      .then(r => r.json())
      .then(data => {
        setIndex(data.index || []);
        setMerged(data.merged || []);
      })
      .catch(() => setToast({ msg: 'Failed to load call cycle data', type: 'error' }));
  }

  useEffect(() => {
    if (session) loadData();
  }, [session]);

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await authFetch('/api/call-cycle', { method: 'POST', body: formData });
      const data = await res.json();
      if (res.ok) {
        setToast({ msg: `Uploaded ${data.rowCount} entries`, type: 'success' });
        loadData();
      } else {
        setToast({ msg: data.error || 'Upload failed', type: 'error' });
      }
    } catch {
      setToast({ msg: 'Upload failed', type: 'error' });
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this upload?')) return;
    try {
      const res = await authFetch('/api/call-cycle', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        setToast({ msg: 'Upload deleted', type: 'success' });
        loadData();
      } else {
        setToast({ msg: 'Delete failed', type: 'error' });
      }
    } catch {
      setToast({ msg: 'Delete failed', type: 'error' });
    }
  }

  const reps = useMemo(() => {
    const set = new Set(merged.map(e => e.repName || e.repEmail));
    return Array.from(set).sort();
  }, [merged]);

  const filtered = useMemo(() => {
    let rows = merged;
    if (repFilter) rows = rows.filter(e => (e.repName || e.repEmail) === repFilter);
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(e =>
        e.storeName.toLowerCase().includes(q) ||
        e.storeCode.toLowerCase().includes(q) ||
        e.repName.toLowerCase().includes(q) ||
        e.repEmail.toLowerCase().includes(q) ||
        (e.channel || '').toLowerCase().includes(q)
      );
    }
    return rows;
  }, [merged, repFilter, search]);

  const isAdmin = session?.role === 'super_admin' || session?.role === 'admin';

  if (authLoading || !session) {
    return <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>Loading...</div>;
  }

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar role={session.role} name={`${session.name} ${session.surname}`} onLogout={logout} />
      <main style={{ flex: 1, padding: '2rem', minHeight: '100vh' }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#111827', marginBottom: '0.25rem' }}>Call Cycle</h1>
        <p style={{ color: '#6b7280', fontSize: '0.85rem', marginBottom: '1.5rem' }}>Upload and manage scheduled store visits</p>

        {/* Upload */}
        {isAdmin && (
          <div style={{ maxWidth: 500, marginBottom: '2rem' }}>
            <UploadZone onFile={handleUpload} loading={uploading} label="Drop call cycle Excel here or click to browse" />
            <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: 8 }}>
              Perigee SCHEDULE format: User Email, First Name, Surname, Store ID, Store Name, Channel, Cycle, Cycle Start Date, WEEK1-WEEK4
            </div>
          </div>
        )}

        {/* Upload History */}
        {index.length > 0 && (
          <div style={{ background: 'white', borderRadius: 12, padding: '1.25rem', border: '1px solid #e5e7eb', marginBottom: '2rem', maxWidth: 620 }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#374151', marginBottom: '0.75rem' }}>Upload History</h2>
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              {index.map(meta => (
                <div key={meta.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', background: '#f9fafb', borderRadius: 8, fontSize: '0.8rem' }}>
                  <div>
                    <div style={{ fontWeight: 500 }}>{meta.fileName}</div>
                    <div style={{ color: '#6b7280', fontSize: '0.75rem' }}>
                      {meta.rowCount} entries — {new Date(meta.uploadedAt).toLocaleString('en-ZA')} by {meta.uploadedBy}
                    </div>
                  </div>
                  {isAdmin && (
                    <button onClick={() => handleDelete(meta.id)} style={{ color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem' }}>
                      Delete
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Merged Preview */}
        <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#374151', margin: 0 }}>
              Merged Call Cycle ({filtered.length} entries)
            </h2>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <select className="select" value={repFilter} onChange={e => setRepFilter(e.target.value)} style={{ width: 200 }}>
                <option value="">All Reps</option>
                {reps.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <input className="input" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: 200 }} />
            </div>
          </div>

          {filtered.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
              {merged.length === 0 ? 'No call cycle uploaded yet.' : 'No entries match the filters.'}
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Rep</th>
                    <th>Store Name</th>
                    <th>Store Code</th>
                    <th>Channel</th>
                    <th>Cycle</th>
                    <th>Start Date</th>
                    <th>Schedule</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, 500).map((e, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 500 }}>{e.repName || e.repEmail}</td>
                      <td>{e.storeName}</td>
                      <td>{e.storeCode}</td>
                      <td>{e.channel || '-'}</td>
                      <td>
                        <span style={{
                          padding: '2px 8px', borderRadius: 12, fontSize: '0.75rem', fontWeight: 500,
                          background: '#dbeafe', color: '#1e40af',
                        }}>
                          {e.cycleLength}wk
                        </span>
                      </td>
                      <td style={{ fontSize: '0.8rem', color: '#6b7280' }}>{e.cycleStartDate}</td>
                      <td style={{ fontSize: '0.8rem' }}>{formatSchedule(e.weeks)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length > 500 && (
                <div style={{ padding: '0.5rem', textAlign: 'center', color: '#6b7280', fontSize: '0.8rem' }}>
                  Showing 500 of {filtered.length} entries
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
