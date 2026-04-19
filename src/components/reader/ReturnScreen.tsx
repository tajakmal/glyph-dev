'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { DocumentMeta } from '@/types';
import {
  getDocument,
  getText,
} from '@/lib/storage';
import { tokenize } from '@/lib/tokenize';
import { MicroLabel } from '@/components/shell/MicroLabel';

interface SessionReceipt {
  documentId: string;
  startIndex: number;
  endIndex: number;
  startedAt: number;
  endedAt: number;
  avgWpm: number;
  wpm: number;
  chunkSize: number;
  reason: 'close' | 'end';
}

interface ReturnScreenProps {
  documentId: string;
}

function formatDuration(ms: number): string {
  const secs = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function ReturnScreen({ documentId }: ReturnScreenProps) {
  const router = useRouter();
  const [receipt, setReceipt] = useState<SessionReceipt | null>(null);
  const [meta, setMeta] = useState<DocumentMeta | null>(null);
  const [text, setText] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('glyph:speedread-session-receipt');
      if (!raw) {
        router.replace(`/reader/${documentId}`);
        return;
      }
      const parsed = JSON.parse(raw) as SessionReceipt;
      if (parsed.documentId !== documentId) {
        router.replace(`/reader/${documentId}`);
        return;
      }
      sessionStorage.removeItem('glyph:speedread-session-receipt');
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrating from sessionStorage is a client-only read
      setReceipt(parsed);

      const docMeta = getDocument(documentId);
       
      if (docMeta) setMeta(docMeta);

      if (docMeta?.kind === 'text') {
        getText(documentId).then((t) => {
          if (t) setText(t);
          setHydrated(true);
        });
      } else {
        setHydrated(true);
      }
    } catch {
      router.replace(`/reader/${documentId}`);
    }
  }, [documentId, router]);

  const excerpt = useMemo(() => {
    if (!receipt) return null;
    if (!text) return null;

    // Split into paragraphs, find which paragraph contains endIndex
    const paragraphs = text.split(/\n+/).filter((p) => p.trim().length > 0);
    let wordAcc = 0;
    let foundParagraphIdx = -1;
    for (let i = 0; i < paragraphs.length; i++) {
      const words = tokenize(paragraphs[i]);
      if (receipt.endIndex < wordAcc + words.length) {
        foundParagraphIdx = i;
        break;
      }
      wordAcc += words.length;
    }
    if (foundParagraphIdx === -1) {
      foundParagraphIdx = paragraphs.length - 1;
    }
    const before = paragraphs[foundParagraphIdx - 1]?.trim() ?? null;
    const focal = paragraphs[foundParagraphIdx]?.trim() ?? null;
    const after = paragraphs[foundParagraphIdx + 1]?.trim() ?? null;
    return { before, focal, after };
  }, [receipt, text]);

  if (!receipt) {
    return (
      <div
        style={{
          height: '100%',
          background: 'var(--paper)',
          color: 'var(--paper-ink)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          className="spinner"
          style={{
            width: 28,
            height: 28,
            border: '2px solid rgba(20,17,12,0.15)',
            borderTopColor: 'var(--accent)',
            borderRadius: '50%',
          }}
        />
      </div>
    );
  }

  const duration = receipt.endedAt - receipt.startedAt;
  const wordsRead = Math.max(0, receipt.endIndex - receipt.startIndex);

  return (
    <div
      style={{
        width: '100%',
        minHeight: '100vh',
        background: 'var(--paper)',
        color: 'var(--paper-ink)',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'var(--font-sans), system-ui, sans-serif',
      }}
    >
      {/* Top bar */}
      <div
        style={{
          padding: 'max(env(safe-area-inset-top), 20px) 16px 10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--paper-rule)',
          gap: 12,
        }}
      >
        <button
          onClick={() => router.replace(`/reader/${documentId}`)}
          aria-label="Back to reader"
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: 'transparent',
            border: 0,
            color: 'var(--paper-ink)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
          }}
        >
          <svg width="10" height="12" viewBox="0 0 10 12" aria-hidden="true">
            <path
              d="M7 1L3 6l4 5"
              stroke="var(--paper-ink)"
              strokeWidth="1.5"
              fill="none"
              strokeLinecap="round"
            />
          </svg>
        </button>
        <MicroLabel style={{ color: 'var(--paper-muted)' }}>You just read</MicroLabel>
        <div style={{ width: 32 }} />
      </div>

      {/* Content */}
      <div
        style={{
          flex: 1,
          padding: '24px 22px calc(40px + env(safe-area-inset-bottom))',
          overflow: 'auto',
        }}
      >
        {/* Session receipt */}
        <div
          style={{
            padding: 16,
            borderRadius: 14,
            background: 'rgba(255,90,61,0.09)',
            border: '1px solid rgba(255,90,61,0.22)',
            marginBottom: 20,
          }}
        >
          <div
            className="micro-label"
            style={{ color: 'var(--accent)', marginBottom: 10 }}
          >
            Session · just now
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 12,
            }}
          >
            {[
              [wordsRead.toLocaleString(), 'words'],
              [formatDuration(duration), 'duration'],
              [`${receipt.avgWpm}`, 'wpm avg'],
            ].map(([v, l]) => (
              <div key={l}>
                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 700,
                    letterSpacing: '-0.02em',
                    color: 'var(--paper-ink)',
                  }}
                >
                  {v}
                </div>
                <div
                  className="micro-label"
                  style={{ color: 'var(--paper-muted)', marginTop: 2 }}
                >
                  {l}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Re-read passage */}
        {meta?.kind === 'text' && excerpt && hydrated && (
          <>
            <MicroLabel
              style={{ color: 'var(--paper-muted)', marginBottom: 10 }}
            >
              Re-read on the page
            </MicroLabel>
            {excerpt.before && (
              <p
                style={{
                  fontFamily: 'var(--font-serif), Georgia, serif',
                  fontSize: 15,
                  lineHeight: 1.65,
                  margin: '0 0 12px',
                  color: 'rgba(20,17,12,0.55)',
                }}
              >
                {excerpt.before.length > 140
                  ? '…' + excerpt.before.slice(-138)
                  : excerpt.before}
              </p>
            )}
            {excerpt.focal && (
              <p
                style={{
                  fontFamily: 'var(--font-serif), Georgia, serif',
                  fontSize: 16,
                  lineHeight: 1.65,
                  margin: '0 0 12px',
                  color: 'var(--paper-ink)',
                  background: 'var(--accent-10)',
                  padding: '8px 10px',
                  borderLeft: '2px solid var(--accent)',
                  borderRadius: 4,
                }}
              >
                {excerpt.focal}
              </p>
            )}
            {excerpt.after && (
              <p
                style={{
                  fontFamily: 'var(--font-serif), Georgia, serif',
                  fontSize: 15,
                  lineHeight: 1.65,
                  margin: '0 0 12px',
                  color: 'rgba(20,17,12,0.55)',
                }}
              >
                {excerpt.after.length > 140
                  ? excerpt.after.slice(0, 138) + '…'
                  : excerpt.after}
              </p>
            )}
          </>
        )}

        {meta?.kind === 'pdf' && (
          <>
            <MicroLabel
              style={{ color: 'var(--paper-muted)', marginBottom: 10 }}
            >
              Re-read on the page
            </MicroLabel>
            <p
              style={{
                fontFamily: 'var(--font-serif), Georgia, serif',
                fontSize: 15,
                lineHeight: 1.65,
                color: 'var(--paper-muted)',
              }}
            >
              Tap Continue ↓ to jump to where you left off in {meta.title}.
            </p>
          </>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
          <button
            onClick={() => {
              router.replace(
                `/reader/${documentId}?mode=speed-read&start=${receipt.startIndex}`
              );
            }}
            style={{
              flex: 1,
              height: 46,
              borderRadius: 23,
              background: 'var(--paper-ink)',
              color: 'var(--paper)',
              border: 0,
              fontSize: 11,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Read again
          </button>
          <button
            onClick={() => router.replace(`/reader/${documentId}`)}
            style={{
              flex: 1,
              height: 46,
              borderRadius: 23,
              background: 'transparent',
              color: 'var(--paper-ink)',
              border: '1px solid var(--paper-ink)',
              fontSize: 11,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Continue ↓
          </button>
        </div>
      </div>
    </div>
  );
}
