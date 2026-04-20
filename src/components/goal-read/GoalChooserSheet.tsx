'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  DEFAULT_NEXT_MIN,
  MAX_GOAL_WORDS,
  MIN_FOCUS_WORDS,
  NEXT_MIN_PRESETS,
  type GoalRange,
} from '@/lib/goal-read/types';
import { snapToSentenceEnd, snapToSentenceStart } from '@/lib/goal-read/snap';

export interface GoalChooserSheetProps {
  open: boolean;
  onClose: () => void;

  /** If present, chooser is in "selection mode" (range already implied). */
  selectionRange: GoalRange | null;

  /** Required for "next N minutes" mode. First fully-visible word index. */
  idleStartWordIndex: number | null;

  words: string[];
  wpm: number;

  /** User has API key configured. Focus read card is disabled otherwise. */
  apiKeyConfigured: boolean;

  /** Runs when user picks Plain speed-read. */
  onPlainSpeedRead: (startAt?: number) => void;

  /** Runs when user picks Focus read. Resolved range is passed. */
  onFocusRead: (range: GoalRange) => void;
}

export function GoalChooserSheet({
  open,
  onClose,
  selectionRange,
  idleStartWordIndex,
  words,
  wpm,
  apiKeyConfigured,
  onPlainSpeedRead,
  onFocusRead,
}: GoalChooserSheetProps) {
  const router = useRouter();
  const [selectedMinutes, setSelectedMinutes] = useState<number>(DEFAULT_NEXT_MIN);
  const [focusExpanded, setFocusExpanded] = useState(false);
  const [keyCalloutOpen, setKeyCalloutOpen] = useState(false);

  // Reset transient state when the sheet reopens (storing-prev-render pattern).
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setSelectedMinutes(DEFAULT_NEXT_MIN);
      setFocusExpanded(false);
      setKeyCalloutOpen(false);
    }
  }

  const isSelectionMode = selectionRange !== null;

  const computedIdleRange = useMemo<GoalRange | null>(() => {
    if (isSelectionMode || idleStartWordIndex == null) return null;
    const start = snapToSentenceStart(words, idleStartWordIndex);
    const proposedEnd = Math.min(
      words.length - 1,
      start + selectedMinutes * wpm - 1
    );
    const end = snapToSentenceEnd(words, proposedEnd, words.length - 1);
    return { startWord: start, endWord: end };
  }, [isSelectionMode, idleStartWordIndex, words, selectedMinutes, wpm]);

  const activeRange = selectionRange ?? computedIdleRange;
  const rangeWordCount = activeRange
    ? activeRange.endWord - activeRange.startWord + 1
    : 0;
  const rangeTooLarge = rangeWordCount > MAX_GOAL_WORDS;

  if (!open) return null;

  const handleFocusClick = () => {
    if (!apiKeyConfigured) {
      setKeyCalloutOpen(true);
      return;
    }
    if (isSelectionMode) {
      if (!activeRange || rangeTooLarge) return;
      onFocusRead(activeRange);
    } else {
      if (!focusExpanded) {
        setFocusExpanded(true);
        return;
      }
      if (!activeRange || rangeTooLarge) return;
      onFocusRead(activeRange);
    }
  };

  const handlePlainClick = () => {
    if (isSelectionMode && selectionRange) {
      onPlainSpeedRead(selectionRange.startWord);
    } else if (idleStartWordIndex != null) {
      onPlainSpeedRead(idleStartWordIndex);
    } else {
      onPlainSpeedRead();
    }
  };

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(20,17,12,0.45)',
          zIndex: 90,
          animation: 'fade-in 180ms ease-out',
        }}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Speed read"
        className="sheet-in"
        style={sheetStyle}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div className="micro-label" style={{ color: 'var(--paper-muted)' }}>
            Speed read
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={closeBtn}
          >
            ✕
          </button>
        </div>

        <ChooserCard
          title="Plain speed-read"
          subtitle="Jump right in."
          glyph="⚡"
          onClick={handlePlainClick}
        />

        <div style={{ height: 10 }} />

        <ChooserCard
          title="Focus read"
          subtitle="AI primer + comprehension quiz."
          glyph="◎"
          accent
          disabled={!apiKeyConfigured}
          onClick={handleFocusClick}
        >
          {!apiKeyConfigured && keyCalloutOpen && (
            <div style={calloutStyle}>
              Configure your Anthropic API key in Settings
              <button
                style={{
                  marginLeft: 8,
                  background: 'transparent',
                  border: 0,
                  color: 'var(--accent)',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  fontSize: 11,
                  textDecoration: 'underline',
                  padding: 0,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  router.push('/settings');
                }}
              >
                Open Settings →
              </button>
            </div>
          )}

          {apiKeyConfigured && !isSelectionMode && focusExpanded && (
            <div style={{ marginTop: 14 }}>
              <div
                className="micro-label"
                style={{ color: 'var(--paper-muted)', marginBottom: 8 }}
              >
                How long?
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {NEXT_MIN_PRESETS.map((m) => (
                  <button
                    key={m}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedMinutes(m);
                    }}
                    style={{
                      height: 34,
                      padding: '0 14px',
                      borderRadius: 17,
                      border: `1px solid ${
                        selectedMinutes === m
                          ? 'var(--paper-ink)'
                          : 'var(--paper-rule)'
                      }`,
                      background:
                        selectedMinutes === m ? 'var(--paper-ink)' : 'transparent',
                      color:
                        selectedMinutes === m ? 'var(--paper)' : 'var(--paper-ink)',
                      fontFamily: 'inherit',
                      fontSize: 13,
                      cursor: 'pointer',
                    }}
                  >
                    {m} min
                  </button>
                ))}
              </div>
              <div
                style={{
                  marginTop: 10,
                  fontSize: 11,
                  color: 'var(--paper-muted)',
                }}
              >
                {activeRange && !rangeTooLarge
                  ? `~${rangeWordCount.toLocaleString()} words at ${wpm} wpm`
                  : rangeTooLarge
                  ? `Section is too long for focus read (max ${MAX_GOAL_WORDS.toLocaleString()} words).`
                  : 'Nothing to read from here.'}
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (activeRange && !rangeTooLarge) onFocusRead(activeRange);
                }}
                disabled={!activeRange || rangeTooLarge}
                style={{
                  marginTop: 14,
                  width: '100%',
                  height: 44,
                  borderRadius: 999,
                  border: 0,
                  background:
                    !activeRange || rangeTooLarge
                      ? 'var(--paper-rule)'
                      : 'var(--accent)',
                  color: '#fff',
                  fontFamily: 'var(--font-mono), monospace',
                  letterSpacing: '0.2em',
                  textTransform: 'uppercase',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: !activeRange || rangeTooLarge ? 'not-allowed' : 'pointer',
                }}
              >
                Start focus read
              </button>
            </div>
          )}

          {apiKeyConfigured && isSelectionMode && activeRange && rangeTooLarge && (
            <div
              style={{
                marginTop: 8,
                fontSize: 12,
                color: 'var(--paper-muted)',
              }}
            >
              Selection is {rangeWordCount.toLocaleString()} words — focus read
              works best on sections up to {MAX_GOAL_WORDS.toLocaleString()}. Try
              a smaller selection or start a plain speed-read.
            </div>
          )}
        </ChooserCard>
      </div>
    </>
  );
}

interface ChooserCardProps {
  title: string;
  subtitle: string;
  glyph: string;
  accent?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children?: React.ReactNode;
}

function ChooserCard({
  title,
  subtitle,
  glyph,
  accent,
  disabled,
  onClick,
  children,
}: ChooserCardProps) {
  return (
    <div
      onClick={onClick}
      style={{
        cursor: 'pointer',
        borderRadius: 16,
        border: `1px solid ${accent && !disabled ? 'var(--accent)' : 'var(--paper-rule)'}`,
        background: disabled ? 'rgba(20,17,12,0.02)' : 'var(--paper)',
        padding: 16,
        opacity: disabled ? 0.55 : 1,
        transition: 'background 140ms ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        <div
          aria-hidden="true"
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            background: accent ? 'var(--accent-10)' : 'rgba(20,17,12,0.04)',
            color: accent ? 'var(--accent)' : 'var(--paper-ink)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 18,
            flexShrink: 0,
          }}
        >
          {glyph}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: 'var(--paper-ink)',
              letterSpacing: '-0.01em',
            }}
          >
            {title}
          </div>
          <div
            style={{
              fontSize: 13,
              color: 'var(--paper-muted)',
              marginTop: 3,
            }}
          >
            {subtitle}
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}

const sheetStyle: React.CSSProperties = {
  position: 'absolute',
  left: 12,
  right: 12,
  bottom: 'calc(20px + env(safe-area-inset-bottom))',
  zIndex: 91,
  borderRadius: 20,
  background: 'var(--paper)',
  border: '1px solid var(--paper-rule)',
  boxShadow: '0 16px 40px rgba(20,17,12,0.22)',
  padding: 18,
  maxWidth: 520,
  margin: '0 auto',
};

const closeBtn: React.CSSProperties = {
  width: 26,
  height: 26,
  borderRadius: 13,
  border: 0,
  background: 'rgba(20,17,12,0.06)',
  color: 'var(--paper-ink)',
  cursor: 'pointer',
  fontSize: 12,
  padding: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const calloutStyle: React.CSSProperties = {
  marginTop: 12,
  padding: '10px 12px',
  borderRadius: 10,
  background: 'rgba(20,17,12,0.05)',
  color: 'var(--paper-ink)',
  fontSize: 12,
  lineHeight: 1.4,
};
