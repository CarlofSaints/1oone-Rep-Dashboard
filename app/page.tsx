'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth, authFetch } from '@/lib/useAuth';
import Sidebar from '@/components/Sidebar';
import Toast from '@/components/Toast';

interface RepMTDSummary {
  repEmail: string;
  repName: string;
  daysWorked: number;
  avgHoursPerDay: number;
  totalVisits: number;
  scheduledVisits: number;
  unscheduledVisits: number;
  expectedVisits: number;
  adherencePercent: number;
}

interface StoreVisitDetail {
  date: string;
  storeName: string;
  storeCode: string;
  checkIn: string;
  checkOut: string;
  durationMinutes: number;
  scheduled: boolean;
}

interface RepDaySummary {
  repEmail: string;
  repName: string;
  date: string;
  firstCheckIn: string;
  lastCheckOut: string;
  hoursWorked: number;
  totalVisits: number;
  scheduledVisits: number;
  unscheduledVisits: number;
  expectedVisits: number;
  uniqueStoresVisited: number;
  stores: StoreVisitDetail[];
}

interface DashboardData {
  daySummaries: RepDaySummary[];
  mtdSummary: RepMTDSummary[];
  totalVisits: number;
  totalScheduledVisits: number;
  totalUnscheduledVisits: number;
  totalExpectedVisits: number;
  totalReps: number;
}

type SortCol = 'repName' | 'daysWorked' | 'avgHoursPerDay' | 'totalVisits' | 'scheduledVisits' | 'unscheduledVisits' | 'expectedVisits' | 'adherencePercent';

function getMonthRange(): { from: string; to: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const from = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const to = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { from, to };
}

export default function DashboardPage() {
  const { session, loading: authLoading, logout } = useAuth();
  const [tab, setTab] = useState<'summary' | 'detail'>('summary');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [sortCol, setSortCol] = useState<SortCol>('repName');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [selectedRep, setSelectedRep] = useState<string>('');
  const [detailSearch, setDetailSearch] = useState('');

  useEffect(() => {
    const { from, to } = getMonthRange();
    setDateFrom(from);
    setDateTo(to);
  }, []);

  useEffect(() => {
    if (!session || !dateFrom || !dateTo) return;
    setLoading(true);
    authFetch(`/api/dashboard?from=${dateFrom}&to=${dateTo}`)
      .then(r => r.json())
      .then(d => setData(d))
      .catch(() => setToast({ msg: 'Failed to load dashboard', type: 'error' }))
      .finally(() => setLoading(false));
  }, [session, dateFrom, dateTo]);

  const sortedMTD = useMemo(() => {
    if (!data) return [];
    const sorted = [...data.mtdSummary].sort((a, b) => {
      const av = a[sortCol];
      const bv = b[sortCol];
      if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv as string) : (bv as string).localeCompare(av);
      return sortDir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
    return sorted;
  }, [data, sortCol, sortDir]);

  const storeDetails = useMemo(() => {
    if (!data) return [];
    let stores: StoreVisitDetail[] = [];
    for (const ds of data.daySummaries) {
      if (selectedRep && ds.repEmail !== selectedRep) continue;
      stores.push(...ds.stores);
    }
    if (detailSearch) {
      const q = detailSearch.toLowerCase();
      stores = stores.filter(s =>
        s.storeName.toLowerCase().includes(q) ||
        s.storeCode.toLowerCase().includes(q) ||
        s.date.includes(q)
      );
    }
    return stores.sort((a, b) => b.date.localeCompare(a.date) || a.storeName.localeCompare(b.storeName));
  }, [data, selectedRep, detailSearch]);

  function handleSort(col: SortCol) {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  }

  function sortArrow(col: SortCol) {
    if (sortCol !== col) return '';
    return sortDir === 'asc' ? ' \u25B2' : ' \u25BC';
  }

  if (authLoading || !session) {
    return <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>Loading...</div>;
  }

  const totalVisits = data?.totalVisits ?? 0;
  const totalScheduled = data?.totalScheduledVisits ?? 0;
  const totalUnscheduled = data?.totalUnscheduledVisits ?? 0;
  const totalExpected = data?.totalExpectedVisits ?? 0;
  const avgAdherence = sortedMTD.length > 0
    ? Math.round(sortedMTD.reduce((s, r) => s + r.adherencePercent, 0) / sortedMTD.length)
    : 0;
  const avgHours = sortedMTD.length > 0
    ? Math.round(sortedMTD.reduce((s, r) => s + r.avgHoursPerDay, 0) / sortedMTD.length * 10) / 10
    : 0;

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar role={session.role} name={`${session.name} ${session.surname}`} onLogout={logout} />
      <main style={{ flex: 1, padding: '2rem', minHeight: '100vh' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
          <div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#111827', marginBottom: '0.25rem' }}>Dashboard</h1>
            <p style={{ color: '#6b7280', fontSize: '0.85rem', margin: 0 }}>
              Rep visit summary and store detail
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input type="date" className="input" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ width: 150 }} />
            <span style={{ color: '#9ca3af' }}>to</span>
            <input type="date" className="input" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ width: 150 }} />
          </div>
        </div>

        {/* KPI Cards — 6 cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          <div className="kpi-card">
            <div style={{ color: '#6b7280', fontSize: '0.75rem', marginBottom: 4 }}>Total Visits</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#E04E2A' }}>{loading ? '...' : totalVisits}</div>
          </div>
          <div className="kpi-card">
            <div style={{ color: '#6b7280', fontSize: '0.75rem', marginBottom: 4 }}>Scheduled</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#16a34a' }}>{loading ? '...' : totalScheduled}</div>
          </div>
          <div className="kpi-card">
            <div style={{ color: '#6b7280', fontSize: '0.75rem', marginBottom: 4 }}>Unscheduled</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#d97706' }}>{loading ? '...' : totalUnscheduled}</div>
          </div>
          <div className="kpi-card">
            <div style={{ color: '#6b7280', fontSize: '0.75rem', marginBottom: 4 }}>Expected</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#3D6273' }}>{loading ? '...' : totalExpected}</div>
          </div>
          <div className="kpi-card">
            <div style={{ color: '#6b7280', fontSize: '0.75rem', marginBottom: 4 }}>Avg Adherence</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: avgAdherence >= 80 ? '#16a34a' : avgAdherence >= 50 ? '#d97706' : '#dc2626' }}>{loading ? '...' : `${avgAdherence}%`}</div>
          </div>
          <div className="kpi-card">
            <div style={{ color: '#6b7280', fontSize: '0.75rem', marginBottom: 4 }}>Avg Hours/Day</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#374151' }}>{loading ? '...' : avgHours}</div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          <button
            className={tab === 'summary' ? 'btn btn-primary' : 'btn btn-outline'}
            onClick={() => setTab('summary')}
          >
            Rep Summary
          </button>
          <button
            className={tab === 'detail' ? 'btn btn-primary' : 'btn btn-outline'}
            onClick={() => setTab('detail')}
          >
            Store Detail
          </button>
        </div>

        {tab === 'summary' && (
          <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'auto' }}>
            {loading ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>Loading...</div>
            ) : sortedMTD.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
                No visit data for this period. Import visits from Settings or wait for the cron.
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th onClick={() => handleSort('repName')}>Rep Name{sortArrow('repName')}</th>
                    <th onClick={() => handleSort('daysWorked')}>Days Worked{sortArrow('daysWorked')}</th>
                    <th onClick={() => handleSort('avgHoursPerDay')}>Avg Hrs/Day{sortArrow('avgHoursPerDay')}</th>
                    <th onClick={() => handleSort('totalVisits')}>Total Visits{sortArrow('totalVisits')}</th>
                    <th onClick={() => handleSort('scheduledVisits')}>Scheduled{sortArrow('scheduledVisits')}</th>
                    <th onClick={() => handleSort('unscheduledVisits')}>Unscheduled{sortArrow('unscheduledVisits')}</th>
                    <th onClick={() => handleSort('expectedVisits')}>Expected{sortArrow('expectedVisits')}</th>
                    <th onClick={() => handleSort('adherencePercent')}>Adherence %{sortArrow('adherencePercent')}</th>
                    <th style={{ cursor: 'default' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {sortedMTD.map(rep => (
                    <tr key={rep.repEmail}>
                      <td style={{ fontWeight: 500 }}>{rep.repName}</td>
                      <td>{rep.daysWorked}</td>
                      <td>{rep.avgHoursPerDay}</td>
                      <td>{rep.totalVisits}</td>
                      <td style={{ color: '#16a34a', fontWeight: 500 }}>{rep.scheduledVisits}</td>
                      <td style={{ color: rep.unscheduledVisits > 0 ? '#d97706' : '#6b7280' }}>{rep.unscheduledVisits}</td>
                      <td>{rep.expectedVisits}</td>
                      <td>
                        <span style={{
                          padding: '2px 8px', borderRadius: 12, fontSize: '0.8rem', fontWeight: 600,
                          background: rep.adherencePercent >= 80 ? '#dcfce7' : rep.adherencePercent >= 50 ? '#fef3c7' : '#fee2e2',
                          color: rep.adherencePercent >= 80 ? '#166534' : rep.adherencePercent >= 50 ? '#92400e' : '#991b1b',
                        }}>
                          {rep.adherencePercent}%
                        </span>
                      </td>
                      <td>
                        <button
                          className="btn btn-outline"
                          style={{ fontSize: '0.75rem', padding: '2px 8px' }}
                          onClick={() => { setSelectedRep(rep.repEmail); setTab('detail'); }}
                        >
                          View Stores
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {tab === 'detail' && (
          <div>
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
              <select
                className="select"
                value={selectedRep}
                onChange={e => setSelectedRep(e.target.value)}
                style={{ width: 250 }}
              >
                <option value="">All Reps</option>
                {data?.mtdSummary.map(r => (
                  <option key={r.repEmail} value={r.repEmail}>{r.repName}</option>
                ))}
              </select>
              <input
                className="input"
                placeholder="Search store name or code..."
                value={detailSearch}
                onChange={e => setDetailSearch(e.target.value)}
                style={{ width: 250 }}
              />
            </div>

            <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'auto' }}>
              {loading ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>Loading...</div>
              ) : storeDetails.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
                  No store visits found for the selected filters.
                </div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Store Name</th>
                      <th>Store Code</th>
                      <th>Check In</th>
                      <th>Check Out</th>
                      <th>Duration</th>
                      <th>Scheduled</th>
                    </tr>
                  </thead>
                  <tbody>
                    {storeDetails.slice(0, 500).map((s, i) => (
                      <tr key={i}>
                        <td>{s.date}</td>
                        <td style={{ fontWeight: 500 }}>{s.storeName}</td>
                        <td>{s.storeCode}</td>
                        <td>{s.checkIn}</td>
                        <td>{s.checkOut}</td>
                        <td>{s.durationMinutes > 0 ? `${Math.floor(s.durationMinutes / 60)}h ${s.durationMinutes % 60}m` : '-'}</td>
                        <td>
                          <span style={{
                            padding: '2px 8px', borderRadius: 12, fontSize: '0.75rem', fontWeight: 600,
                            background: s.scheduled ? '#dcfce7' : '#fee2e2',
                            color: s.scheduled ? '#166534' : '#991b1b',
                          }}>
                            {s.scheduled ? 'Yes' : 'No'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {storeDetails.length > 500 && (
                <div style={{ padding: '0.5rem', textAlign: 'center', color: '#6b7280', fontSize: '0.8rem' }}>
                  Showing 500 of {storeDetails.length} rows
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
