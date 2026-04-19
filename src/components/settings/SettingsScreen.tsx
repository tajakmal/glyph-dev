'use client';

import React, { useEffect, useState } from 'react';
import type { UserPreferences } from '@/types';
import { getPreferences, setPreferences } from '@/lib/storage';
import { AppShell } from '@/components/shell/AppShell';
import { MicroLabel } from '@/components/shell/MicroLabel';
import { HeroHeading } from '@/components/shell/HeroHeading';

type ThemeChoice = 'dark' | 'paper' | 'auto';

function readTheme(): ThemeChoice {
  if (typeof window === 'undefined') return 'dark';
  const stored = localStorage.getItem('glyph:theme');
  if (stored === 'light') return 'paper';
  if (stored === 'dark') return 'dark';
  return 'auto';
}

function writeTheme(choice: ThemeChoice) {
  const root = document.documentElement;
  if (choice === 'auto') {
    localStorage.removeItem('glyph:theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.dataset.theme = prefersDark ? 'dark' : 'light';
    root.style.colorScheme = prefersDark ? 'dark' : 'light';
  } else if (choice === 'paper') {
    localStorage.setItem('glyph:theme', 'light');
    root.dataset.theme = 'light';
    root.style.colorScheme = 'light';
  } else {
    localStorage.setItem('glyph:theme', 'dark');
    root.dataset.theme = 'dark';
    root.style.colorScheme = 'dark';
  }
}

export function SettingsScreen() {
  const [prefs, setPrefs] = useState<UserPreferences | null>(null);
  const [themeChoice, setThemeChoice] = useState<ThemeChoice>('dark');

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrating from localStorage is a client-only read
    setPrefs(getPreferences());
     
    setThemeChoice(readTheme());
  }, []);

  const update = (patch: Partial<UserPreferences>) => {
    if (!prefs) return;
    const next = { ...prefs, ...patch };
    setPrefs(next);
    setPreferences(next);
  };

  const handleThemeChange = (choice: ThemeChoice) => {
    setThemeChoice(choice);
    writeTheme(choice);
  };

  if (!prefs) {
    return (
      <AppShell>
        <div style={{ padding: 58 }}>
          <MicroLabel>Settings</MicroLabel>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div style={{ padding: '58px 20px 0' }}>
        <MicroLabel>Settings</MicroLabel>
        <HeroHeading size="md" style={{ marginTop: 10 }}>
          Tune the
          <br />
          reading.
        </HeroHeading>
      </div>

      <div style={{ padding: '24px 20px 0' }}>
        <SectionLabel>Reading</SectionLabel>
        <SettingRow title="Default WPM" value={`${prefs.defaultWpm}`}>
          <div style={{ marginTop: 10 }}>
            <input
              className="glyph-range"
              type="range"
              min={120}
              max={650}
              step={10}
              value={prefs.defaultWpm}
              onChange={(e) => update({ defaultWpm: +e.target.value })}
              style={{ width: '100%' }}
              aria-label="Default words per minute"
            />
            <div
              style={{
                marginTop: 4,
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 9,
                fontFamily: 'var(--font-mono), monospace',
                color: 'var(--muted)',
                letterSpacing: '0.1em',
              }}
            >
              <span>120</span>
              <span>{prefs.defaultWpm}</span>
              <span>650</span>
            </div>
          </div>
        </SettingRow>
        <SettingRow
          title="Expressive pacing"
          toggle
          toggleValue={prefs.expressivePacing}
          onToggle={(v) => update({ expressivePacing: v })}
        />
        <SettingRow
          title="Auto-pause on interruption"
          toggle
          toggleValue={prefs.autoPauseOnInterrupt}
          onToggle={(v) => update({ autoPauseOnInterrupt: v })}
        />
        <SettingRow title="Speed mode" value={prefs.speedReadMode === 'ghost' ? 'Ghost' : 'Single word'}>
          <div style={{ marginTop: 10, display: 'flex', gap: 4 }}>
            {(
              [
                { key: 'single' as const, label: 'Single' },
                { key: 'ghost' as const, label: 'Ghost' },
              ] as const
            ).map((opt) => {
              const active = prefs.speedReadMode === opt.key;
              return (
                <button
                  key={opt.key}
                  onClick={() => update({ speedReadMode: opt.key })}
                  style={segmentBtnStyle(active)}
                  aria-pressed={active}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </SettingRow>

        <SectionLabel>Appearance</SectionLabel>
        <SettingRow
          title="Theme"
          value={themeChoice === 'paper' ? 'Paper' : themeChoice === 'auto' ? 'Auto' : 'Dark'}
        >
          <div style={{ marginTop: 10, display: 'flex', gap: 4 }}>
            {(
              [
                { key: 'dark' as const, label: 'Dark' },
                { key: 'paper' as const, label: 'Paper' },
                { key: 'auto' as const, label: 'Auto' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.key}
                onClick={() => handleThemeChange(opt.key)}
                style={segmentBtnStyle(themeChoice === opt.key)}
                aria-pressed={themeChoice === opt.key}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </SettingRow>
        <SettingRow
          title="Reading font"
          value={
            prefs.readingFont === 'fraunces'
              ? 'Fraunces'
              : prefs.readingFont === 'space-grotesk'
              ? 'Space Grotesk'
              : 'System'
          }
        >
          <div style={{ marginTop: 10, display: 'flex', gap: 4 }}>
            {(
              [
                { key: 'fraunces' as const, label: 'Fraunces' },
                { key: 'space-grotesk' as const, label: 'Grotesk' },
                { key: 'system' as const, label: 'System' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.key}
                onClick={() => update({ readingFont: opt.key })}
                style={segmentBtnStyle(prefs.readingFont === opt.key)}
                aria-pressed={prefs.readingFont === opt.key}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </SettingRow>
        <SettingRow
          title="Text size"
          value={
            prefs.textSize === 'sm' ? 'Small' : prefs.textSize === 'lg' ? 'Large' : 'Medium'
          }
        >
          <div style={{ marginTop: 10, display: 'flex', gap: 4 }}>
            {(
              [
                { key: 'sm' as const, label: 'Sm' },
                { key: 'md' as const, label: 'Md' },
                { key: 'lg' as const, label: 'Lg' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.key}
                onClick={() => update({ textSize: opt.key })}
                style={segmentBtnStyle(prefs.textSize === opt.key)}
                aria-pressed={prefs.textSize === opt.key}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </SettingRow>

        <SectionLabel>About</SectionLabel>
        <SettingRow title="Glyph" value="v1.0 · 2026" />
        <SettingRow title="Made to make knowledge accessible." />
        <div style={{ height: 48 }} />
      </div>
    </AppShell>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <MicroLabel tone="accent" style={{ marginBottom: 10, marginTop: 10 }}>
      {children}
    </MicroLabel>
  );
}

interface SettingRowProps {
  title: string;
  value?: string;
  toggle?: boolean;
  toggleValue?: boolean;
  onToggle?: (v: boolean) => void;
  children?: React.ReactNode;
}

function SettingRow({ title, value, toggle, toggleValue, onToggle, children }: SettingRowProps) {
  return (
    <div style={{ padding: '14px 0', borderTop: '1px solid var(--rule)' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <div style={{ fontSize: 14, color: 'var(--ink)' }}>{title}</div>
        {toggle ? (
          <button
            aria-pressed={!!toggleValue}
            aria-label={`Toggle ${title}`}
            onClick={() => onToggle?.(!toggleValue)}
            style={{
              width: 40,
              height: 22,
              borderRadius: 11,
              background: toggleValue ? 'var(--accent)' : 'var(--rule-strong)',
              position: 'relative',
              border: 0,
              cursor: 'pointer',
              padding: 0,
              transition: 'background 180ms ease',
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: 2,
                left: toggleValue ? 20 : 2,
                width: 18,
                height: 18,
                borderRadius: '50%',
                background: '#fff',
                transition: 'left 180ms ease',
              }}
            />
          </button>
        ) : value ? (
          <div
            style={{
              fontSize: 12,
              fontFamily: 'var(--font-mono), monospace',
              color: 'var(--muted)',
              letterSpacing: '0.1em',
            }}
          >
            {value}
          </div>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function segmentBtnStyle(active: boolean): React.CSSProperties {
  return {
    flex: 1,
    padding: '7px 0',
    textAlign: 'center',
    borderRadius: 8,
    background: active ? 'var(--accent)' : 'transparent',
    color: active ? '#fff' : 'var(--ink)',
    border: `1px solid ${active ? 'var(--accent)' : 'var(--rule)'}`,
    fontSize: 10,
    fontFamily: 'var(--font-mono), monospace',
    letterSpacing: '0.15em',
    textTransform: 'uppercase',
    cursor: 'pointer',
    fontWeight: 600,
  };
}
