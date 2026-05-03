'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

type TabKey = 'library' | 'new' | 'marks' | 'settings';

interface Tab {
  key: TabKey;
  label: string;
  href: string;
  icon: React.ReactNode;
}

const TABS: Tab[] = [
  {
    key: 'library',
    label: 'Library',
    href: '/',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
        <rect x="2" y="2" width="5" height="14" rx="1" stroke="currentColor" strokeWidth="1.3" fill="none" />
        <rect x="9" y="2" width="4" height="14" rx="1" stroke="currentColor" strokeWidth="1.3" fill="none" />
        <rect x="14.5" y="3" width="2.5" height="12" rx="0.5" stroke="currentColor" strokeWidth="1.2" fill="none" />
      </svg>
    ),
  },
  {
    key: 'new',
    label: 'New',
    href: '/new',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
        <path d="M9 3v12M3 9h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    key: 'marks',
    label: 'Marks',
    href: '/marks',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
        <path d="M4 2h10v14l-5-3-5 3V2z" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    key: 'settings',
    label: 'Tune',
    href: '/settings',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
        <circle cx="9" cy="9" r="2.2" stroke="currentColor" strokeWidth="1.3" fill="none" />
        <path
          d="M9 2v2M9 14v2M2 9h2M14 9h2M4 4l1.4 1.4M12.6 12.6L14 14M4 14l1.4-1.4M12.6 5.4L14 4"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
];

function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function BottomTabBar() {
  const pathname = usePathname() || '/';
  return (
    <nav
      aria-label="Primary"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 40,
        padding:
          '10px max(10px, env(safe-area-inset-right)) calc(10px + env(safe-area-inset-bottom)) max(10px, env(safe-area-inset-left))',
        background:
          'linear-gradient(180deg, rgba(10,10,10,0) 0%, var(--bg) 60%)',
        pointerEvents: 'none',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          width: 'min(440px, 100%)',
          margin: '0 auto',
          display: 'flex',
          background: 'var(--bg-glass)',
          WebkitBackdropFilter: 'blur(20px)',
          backdropFilter: 'blur(20px)',
          borderRadius: 24,
          border: '1px solid var(--rule)',
          padding: 4,
          pointerEvents: 'auto',
        }}
      >
        {TABS.map((t) => {
          const active = isActive(pathname, t.href);
          return (
            <Link
              key={t.key}
              href={t.href}
              aria-current={active ? 'page' : undefined}
              style={{
                flex: 1,
                padding: '10px 6px',
                minHeight: 58,
                borderRadius: 20,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 3,
                background: active ? 'var(--accent)' : 'transparent',
                color: active ? 'var(--accent-on)' : 'var(--muted)',
                textDecoration: 'none',
                transition: 'background 180ms ease, color 180ms ease',
              }}
            >
              {t.icon}
              <span
                style={{
                  fontSize: 9,
                  fontFamily: 'var(--font-mono), ui-monospace, monospace',
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase',
                  fontWeight: 600,
                }}
              >
                {t.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
