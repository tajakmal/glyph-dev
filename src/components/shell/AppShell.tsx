import React from 'react';
import { BottomTabBar } from './BottomTabBar';

interface AppShellProps {
  children: React.ReactNode;
  /** Hide bottom tab bar (for in-reader full bleed screens) */
  hideTabBar?: boolean;
  /** Override background (e.g. paper for reader, keep default for library) */
  background?: string;
}

/**
 * Mobile-first app shell. Caps content at 440px on wide viewports and
 * reserves space at the bottom for the floating tab bar.
 */
export function AppShell({ children, hideTabBar, background }: AppShellProps) {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: background || 'var(--bg)',
        color: 'var(--ink)',
        position: 'relative',
      }}
    >
      <div
        style={{
          maxWidth: 440,
          margin: '0 auto',
          minHeight: '100vh',
          position: 'relative',
          paddingBottom: hideTabBar
            ? 'env(safe-area-inset-bottom)'
            : 'calc(96px + env(safe-area-inset-bottom))',
        }}
      >
        {children}
      </div>
      {!hideTabBar && <BottomTabBar />}
    </div>
  );
}
