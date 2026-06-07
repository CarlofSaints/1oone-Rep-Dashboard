'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Role } from '@/lib/types';

interface NavItem {
  label: string;
  href: string;
  icon: string;
  roles: Role[];
}

const TOP_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0h4', roles: ['super_admin', 'admin', 'viewer'] },
  { label: 'Call Cycle', href: '/call-cycle', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', roles: ['super_admin', 'admin', 'viewer'] },
];

const CONTROL_ITEMS: NavItem[] = [
  { label: 'Users', href: '/admin/users', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z', roles: ['super_admin', 'admin'] },
  { label: 'Roles', href: '/admin/roles', icon: 'M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z', roles: ['super_admin'] },
  { label: 'Settings', href: '/settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z', roles: ['super_admin'] },
];

const SIDEBAR_KEY = '1oone_sidebar_open';
const CONTROL_KEY = '1oone_control_open';
const SIDEBAR_W = 240;
const TOPBAR_H = 52;

interface SidebarProps {
  role: Role;
  name: string;
  onLogout: () => void;
}

function SvgIcon({ path }: { path: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d={path} />
    </svg>
  );
}

function BurgerIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={{ transition: 'transform 0.2s', transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

export default function Sidebar({ role, name, onLogout }: SidebarProps) {
  const pathname = usePathname();
  const visibleTopItems = TOP_ITEMS.filter(item => item.roles.includes(role));
  const visibleControlItems = CONTROL_ITEMS.filter(item => item.roles.includes(role));
  const showControlCentre = visibleControlItems.length > 0;

  const [open, setOpen] = useState(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem(SIDEBAR_KEY) !== 'false';
  });

  const [controlOpen, setControlOpen] = useState(() => {
    if (typeof window === 'undefined') return true;
    const stored = localStorage.getItem(CONTROL_KEY);
    if (stored !== null) return stored !== 'false';
    return role === 'super_admin' || role === 'admin';
  });

  useEffect(() => {
    document.body.dataset.sidebarClosed = String(!open);
  }, [open]);

  function toggle() {
    setOpen(prev => {
      const next = !prev;
      localStorage.setItem(SIDEBAR_KEY, String(next));
      return next;
    });
  }

  function toggleControl() {
    setControlOpen(prev => {
      const next = !prev;
      localStorage.setItem(CONTROL_KEY, String(next));
      return next;
    });
  }

  function renderNavItem(item: NavItem) {
    const active = pathname === item.href;
    return (
      <Link
        key={item.href}
        href={item.href}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
          padding: '0.6rem 0.75rem',
          borderRadius: 8,
          color: active ? '#fff' : 'rgba(255,255,255,0.65)',
          background: active ? '#E04E2A' : 'transparent',
          textDecoration: 'none',
          fontSize: '0.85rem',
          fontWeight: active ? 600 : 400,
          marginBottom: 2,
          transition: 'background 0.15s, color 0.15s',
        }}
        onMouseEnter={e => {
          if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)';
        }}
        onMouseLeave={e => {
          if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent';
        }}
      >
        <SvgIcon path={item.icon} />
        {item.label}
      </Link>
    );
  }

  return (
    <>
      {/* Top bar — visible when sidebar is closed */}
      {!open && (
        <div
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, height: TOPBAR_H,
            background: '#3D6273', display: 'flex', alignItems: 'center',
            gap: '0.75rem', padding: '0 1rem', zIndex: 101,
            boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
          }}
        >
          <button
            onClick={toggle}
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.8)', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}
            title="Open menu"
          >
            <BurgerIcon />
          </button>
          <span style={{ color: '#fff', fontSize: '0.9rem', fontWeight: 600 }}>1oone</span>
          <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.7rem' }}>Rep Dashboard</span>
        </div>
      )}

      {/* Sidebar drawer */}
      <aside
        style={{
          width: SIDEBAR_W, minHeight: '100vh', background: '#3D6273',
          display: 'flex', flexDirection: 'column', position: 'fixed',
          left: open ? 0 : -SIDEBAR_W, top: 0, bottom: 0, zIndex: 102,
          transition: 'left 0.25s ease',
        }}
      >
        {/* Logo + burger toggle */}
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: '#fff', fontSize: '1.1rem', fontWeight: 700 }}>1oone</div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.7rem', marginTop: 2 }}>
              Rep Dashboard
            </div>
          </div>
          <button
            onClick={toggle}
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', flexShrink: 0 }}
            title="Close menu"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '0.75rem 0.5rem', overflowY: 'auto' }}>
          {visibleTopItems.map(item => renderNavItem(item))}

          {/* Control Centre — collapsible */}
          {showControlCentre && (
            <>
              <div style={{ marginTop: '0.75rem', marginBottom: '0.25rem' }}>
                <button
                  onClick={toggleControl}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%',
                    padding: '0.5rem 0.75rem', background: 'none', border: 'none',
                    color: 'rgba(255,255,255,0.45)', fontSize: '0.7rem', fontWeight: 600,
                    letterSpacing: '0.04em', textTransform: 'uppercase', cursor: 'pointer',
                    borderRadius: 6, transition: 'color 0.15s',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.7)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.45)'; }}
                >
                  <ChevronIcon open={controlOpen} />
                  Control Centre
                </button>
              </div>
              {controlOpen && (
                <div style={{ paddingLeft: '0.25rem' }}>
                  {visibleControlItems.map(item => renderNavItem(item))}
                </div>
              )}
            </>
          )}
        </nav>

        {/* User footer */}
        <div
          style={{
            padding: '0.75rem 1rem', borderTop: '1px solid rgba(255,255,255,0.1)',
            color: 'rgba(255,255,255,0.7)', fontSize: '0.8rem',
          }}
        >
          <div style={{ fontWeight: 500, color: '#fff', marginBottom: 4 }}>{name}</div>
          <div style={{ marginBottom: 8, textTransform: 'capitalize' }}>{role.replace(/_/g, ' ')}</div>
          <button
            onClick={onLogout}
            style={{
              background: 'rgba(255,255,255,0.1)', border: 'none',
              color: 'rgba(255,255,255,0.7)', padding: '0.35rem 0.75rem',
              borderRadius: 6, cursor: 'pointer', fontSize: '0.75rem', width: '100%',
            }}
          >
            Sign Out
          </button>
        </div>
      </aside>
    </>
  );
}
