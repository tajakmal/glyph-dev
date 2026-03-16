'use client';

import { useSyncExternalStore } from 'react';

const STORAGE_KEY = 'glyph:theme';
const THEME_CHANGE_EVENT = 'glyph:theme-change';

type Theme = 'light' | 'dark';

function getThemeFromDom(): Theme {
  if (typeof document === 'undefined') return 'dark';
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

function subscribeTheme(callback: () => void): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handler = () => callback();
  window.addEventListener(THEME_CHANGE_EVENT, handler);
  return () => window.removeEventListener(THEME_CHANGE_EVENT, handler);
}

function subscribeHydration(): () => void {
  return () => {};
}

function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
}

export function ThemeToggle({ className = '' }: { className?: string }) {
  const mounted = useSyncExternalStore(
    subscribeHydration,
    () => true,
    () => false
  );
  const theme = useSyncExternalStore(
    subscribeTheme,
    getThemeFromDom,
    () => 'dark'
  );

  const handleToggle = () => {
    const nextTheme: Theme = theme === 'dark' ? 'light' : 'dark';
    applyTheme(nextTheme);
    try {
      localStorage.setItem(STORAGE_KEY, nextTheme);
    } catch {
      // Ignore storage errors (private mode, etc.)
    }
  };

  const isDark = theme === 'dark';

  if (!mounted) {
    return (
      <div
        className={`h-[38px] w-[72px] rounded-full ${className}`}
        style={{ background: '#d3d1c7' }}
        aria-hidden="true"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      className={`relative inline-flex h-[38px] w-[72px] items-center rounded-full p-0 border-0 cursor-pointer ${className}`}
      style={{
        background: isDark ? '#3f3f46' : '#d3d1c7',
        transition: 'background 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
        WebkitTapHighlightColor: 'transparent',
      }}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
    >
      {/* Thumb with icon inside */}
      <span
        className="absolute flex items-center justify-center"
        style={{
          width: 30,
          height: 30,
          borderRadius: '50%',
          background: isDark ? '#18181b' : '#fff',
          top: 4,
          left: 4,
          transform: isDark ? 'translateX(34px)' : 'translateX(0)',
          transition: 'transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.5s ease',
        }}
      >
        {/* Sun icon */}
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
          style={{
            position: 'absolute',
            opacity: isDark ? 0 : 1,
            transform: isDark ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'opacity 0.3s ease, transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
        >
          <circle cx="12" cy="12" r="5" fill="#ba7517" />
          <line x1="12" y1="1" x2="12" y2="4" stroke="#ba7517" strokeWidth="2" strokeLinecap="round" />
          <line x1="12" y1="20" x2="12" y2="23" stroke="#ba7517" strokeWidth="2" strokeLinecap="round" />
          <line x1="4.22" y1="4.22" x2="6.34" y2="6.34" stroke="#ba7517" strokeWidth="2" strokeLinecap="round" />
          <line x1="17.66" y1="17.66" x2="19.78" y2="19.78" stroke="#ba7517" strokeWidth="2" strokeLinecap="round" />
          <line x1="1" y1="12" x2="4" y2="12" stroke="#ba7517" strokeWidth="2" strokeLinecap="round" />
          <line x1="20" y1="12" x2="23" y2="12" stroke="#ba7517" strokeWidth="2" strokeLinecap="round" />
          <line x1="4.22" y1="19.78" x2="6.34" y2="17.66" stroke="#ba7517" strokeWidth="2" strokeLinecap="round" />
          <line x1="17.66" y1="6.34" x2="19.78" y2="4.22" stroke="#ba7517" strokeWidth="2" strokeLinecap="round" />
        </svg>
        {/* Moon icon */}
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
          style={{
            position: 'absolute',
            opacity: isDark ? 1 : 0,
            transform: isDark ? 'rotate(0deg)' : 'rotate(-90deg)',
            transition: 'opacity 0.3s ease, transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" fill="#e4e4e7" />
        </svg>
      </span>
    </button>
  );
}

export default ThemeToggle;
