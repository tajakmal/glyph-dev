'use client';

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'glyph:theme';

type Theme = 'light' | 'dark';

function getThemeFromDom(): Theme {
  if (typeof document === 'undefined') return 'dark';
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
}

export function ThemeToggle({ className = '' }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>('dark');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const current = getThemeFromDom();
    setTheme(current);
    setMounted(true);
  }, []);

  const handleToggle = () => {
    const nextTheme: Theme = theme === 'dark' ? 'light' : 'dark';
    applyTheme(nextTheme);
    try {
      localStorage.setItem(STORAGE_KEY, nextTheme);
    } catch {
      // Ignore storage errors (private mode, etc.)
    }
    setTheme(nextTheme);
  };

  if (!mounted) {
    return (
      <div
        className={`h-9 w-[72px] rounded-full border border-zinc-700 bg-zinc-800/80 ${className}`}
        aria-hidden="true"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      className={`relative inline-flex h-9 w-[72px] items-center rounded-full border border-zinc-700 bg-zinc-800/80 p-1 transition-colors hover:bg-zinc-700 ${className}`}
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    >
      <span
        className={`absolute left-1 top-1 h-7 w-7 rounded-full bg-zinc-100 shadow transition-transform duration-200 ${
          theme === 'dark' ? 'translate-x-0' : 'translate-x-8'
        }`}
      />
      <span className="relative z-10 flex w-full items-center justify-between px-1">
        <svg
          className={`h-4 w-4 transition-colors ${
            theme === 'light' ? 'text-zinc-900' : 'text-zinc-500'
          }`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2" />
          <path d="M12 20v2" />
          <path d="M4.93 4.93l1.41 1.41" />
          <path d="M17.66 17.66l1.41 1.41" />
          <path d="M2 12h2" />
          <path d="M20 12h2" />
          <path d="M4.93 19.07l1.41-1.41" />
          <path d="M17.66 6.34l1.41-1.41" />
        </svg>
        <svg
          className={`h-4 w-4 transition-colors ${
            theme === 'dark' ? 'text-zinc-900' : 'text-zinc-500'
          }`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
        </svg>
      </span>
    </button>
  );
}

export default ThemeToggle;
