'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getApiKey } from '@/lib/chat';
import { useChat, type DisplayTurn } from './useChat';

interface ChatPanelProps {
  open: boolean;
  onClose: () => void;
  documentId: string;
  docText: string | null;
  pendingQuote: string | null;
  onQuoteConsumed: () => void;
}

export function ChatPanel({
  open,
  onClose,
  documentId,
  docText,
  pendingQuote,
  onQuoteConsumed,
}: ChatPanelProps) {
  const router = useRouter();
  const { turns, streaming, error, send, reset, abort } = useChat(
    documentId,
    docText
  );
  const [draft, setDraft] = useState('');
  const [hasKey, setHasKey] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 768px)');
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrating from localStorage is a client-only read
    setHasKey(!!getApiKey());
  }, [open]);

  useEffect(() => {
    if (!open || !pendingQuote) return;
    if (textareaRef.current) textareaRef.current.focus();
  }, [open, pendingQuote]);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [turns, streaming]);

  useEffect(() => {
    return () => {
      abort();
    };
  }, [abort]);

  const handleSend = () => {
    const trimmed = draft.trim();
    if (!trimmed || streaming) return;
    const quote = pendingQuote || undefined;
    setDraft('');
    onQuoteConsumed();
    void send(trimmed, quote);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleOpenSettings = () => {
    onClose();
    router.push('/settings');
  };

  if (!open) return null;

  const panelStyle: React.CSSProperties = isMobile
    ? {
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        top: 'auto',
        height: '75vh',
        zIndex: 45,
        background: 'var(--paper)',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        border: '1px solid var(--paper-rule)',
        boxShadow: '0 -16px 40px rgba(20,17,12,0.2)',
        display: 'flex',
        flexDirection: 'column',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }
    : {
        position: 'fixed',
        right: 0,
        top: 0,
        bottom: 0,
        width: 400,
        zIndex: 45,
        background: 'var(--paper)',
        borderLeft: '1px solid var(--paper-rule)',
        boxShadow: '-16px 0 40px rgba(20,17,12,0.15)',
        display: 'flex',
        flexDirection: 'column',
      };

  return (
    <>
      {isMobile && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(20,17,12,0.35)',
            zIndex: 44,
          }}
        />
      )}
      <div className="sheet-in" style={panelStyle} role="dialog" aria-label="Ask Claude">
        <Header
          onClose={onClose}
          onReset={turns.length > 0 ? reset : undefined}
        />

        {!hasKey ? (
          <SetupCTA onOpenSettings={handleOpenSettings} />
        ) : (
          <>
            <div
              ref={listRef}
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '16px 16px 8px',
              }}
            >
              {turns.length === 0 && !pendingQuote && <EmptyState />}
              {turns.map((turn, i) => (
                <TurnBubble key={i} turn={turn} />
              ))}
            </div>

            {pendingQuote && (
              <PendingQuote
                quote={pendingQuote}
                onRemove={onQuoteConsumed}
              />
            )}

            {error && !streaming && (
              <div
                style={{
                  padding: '8px 16px',
                  fontSize: 12,
                  color: 'var(--accent)',
                  fontFamily: 'var(--font-mono), monospace',
                }}
              >
                {error}
              </div>
            )}

            <Composer
              draft={draft}
              setDraft={setDraft}
              onSend={handleSend}
              onKeyDown={handleKeyDown}
              streaming={streaming}
              textareaRef={textareaRef}
              onAbort={abort}
            />
          </>
        )}
      </div>
    </>
  );
}

function Header({
  onClose,
  onReset,
}: {
  onClose: () => void;
  onReset?: () => void;
}) {
  return (
    <div
      style={{
        padding: '14px 16px',
        borderBottom: '1px solid var(--paper-rule)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontFamily: 'var(--font-mono), monospace',
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: 'var(--paper-ink)',
          fontWeight: 700,
        }}
      >
        Ask Claude
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        {onReset && (
          <button
            onClick={onReset}
            aria-label="Clear chat"
            title="Clear chat"
            style={iconBtnStyle}
          >
            ↻
          </button>
        )}
        <button
          onClick={onClose}
          aria-label="Close chat"
          style={iconBtnStyle}
        >
          ✕
        </button>
      </div>
    </div>
  );
}

function TurnBubble({ turn }: { turn: DisplayTurn }) {
  const isUser = turn.role === 'user';
  return (
    <div
      style={{
        marginBottom: 14,
        display: 'flex',
        flexDirection: 'column',
        alignItems: isUser ? 'flex-end' : 'flex-start',
      }}
    >
      {isUser && turn.quote && (
        <QuoteBlock quote={turn.quote} align="right" />
      )}
      <div
        style={{
          maxWidth: '88%',
          padding: '10px 14px',
          borderRadius: 16,
          background: isUser
            ? 'var(--accent)'
            : turn.errored
            ? 'rgba(255,90,61,0.08)'
            : 'var(--paper-rule)',
          color: isUser ? '#fff' : 'var(--paper-ink)',
          fontSize: 14,
          lineHeight: 1.5,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {turn.content}
        {turn.streaming && !turn.content && <StreamingDots />}
        {turn.streaming && turn.content && (
          <span
            aria-hidden="true"
            style={{
              display: 'inline-block',
              width: 6,
              height: 14,
              background: 'currentColor',
              marginLeft: 2,
              verticalAlign: '-2px',
              opacity: 0.7,
              animation: 'glyph-cursor-blink 1s steps(2) infinite',
            }}
          />
        )}
      </div>
    </div>
  );
}

function StreamingDots() {
  return (
    <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
      <Dot delay={0} />
      <Dot delay={150} />
      <Dot delay={300} />
    </span>
  );
}

function Dot({ delay }: { delay: number }) {
  return (
    <span
      style={{
        width: 6,
        height: 6,
        borderRadius: '50%',
        background: 'currentColor',
        opacity: 0.5,
        animation: `glyph-dot-pulse 1.2s ${delay}ms ease-in-out infinite`,
      }}
    />
  );
}

function QuoteBlock({
  quote,
  align,
}: {
  quote: string;
  align: 'left' | 'right';
}) {
  return (
    <div
      style={{
        maxWidth: '88%',
        marginBottom: 4,
        padding: '6px 10px',
        borderLeft: '2px solid var(--accent)',
        background: 'rgba(255,90,61,0.06)',
        borderRadius: 4,
        fontSize: 12,
        fontStyle: 'italic',
        color: 'var(--muted)',
        textAlign: align,
        lineHeight: 1.4,
        wordBreak: 'break-word',
      }}
    >
      “{quote.length > 240 ? quote.slice(0, 240) + '…' : quote}”
    </div>
  );
}

function PendingQuote({
  quote,
  onRemove,
}: {
  quote: string;
  onRemove: () => void;
}) {
  return (
    <div
      style={{
        margin: '0 16px 8px',
        padding: '8px 10px',
        borderLeft: '2px solid var(--accent)',
        background: 'rgba(255,90,61,0.08)',
        borderRadius: 6,
        fontSize: 12,
        color: 'var(--paper-ink)',
        display: 'flex',
        gap: 8,
        alignItems: 'flex-start',
      }}
    >
      <div style={{ flex: 1, fontStyle: 'italic', lineHeight: 1.4 }}>
        “{quote.length > 200 ? quote.slice(0, 200) + '…' : quote}”
      </div>
      <button
        onClick={onRemove}
        aria-label="Remove quote"
        style={{
          background: 'transparent',
          border: 0,
          color: 'var(--muted)',
          cursor: 'pointer',
          fontSize: 14,
          lineHeight: 1,
          padding: 2,
        }}
      >
        ✕
      </button>
    </div>
  );
}

function Composer({
  draft,
  setDraft,
  onSend,
  onKeyDown,
  streaming,
  textareaRef,
  onAbort,
}: {
  draft: string;
  setDraft: (v: string) => void;
  onSend: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  streaming: boolean;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  onAbort: () => void;
}) {
  return (
    <div
      style={{
        padding: '10px 12px 14px',
        borderTop: '1px solid var(--paper-rule)',
        display: 'flex',
        gap: 8,
        alignItems: 'flex-end',
      }}
    >
      <textarea
        ref={textareaRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Ask about the text…"
        rows={1}
        style={{
          flex: 1,
          resize: 'none',
          padding: '10px 12px',
          borderRadius: 14,
          border: '1px solid var(--paper-rule)',
          background: 'var(--paper)',
          color: 'var(--paper-ink)',
          fontSize: 14,
          fontFamily: 'inherit',
          lineHeight: 1.4,
          minHeight: 40,
          maxHeight: 160,
          outline: 'none',
        }}
      />
      {streaming ? (
        <button
          onClick={onAbort}
          aria-label="Stop"
          style={sendBtnStyle(true)}
        >
          ■
        </button>
      ) : (
        <button
          onClick={onSend}
          disabled={!draft.trim()}
          aria-label="Send"
          style={sendBtnStyle(!!draft.trim())}
        >
          ↑
        </button>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div
      style={{
        padding: '32px 8px',
        textAlign: 'center',
        fontSize: 13,
        color: 'var(--muted)',
        lineHeight: 1.5,
      }}
    >
      Select a passage in the text and tap{' '}
      <strong style={{ color: 'var(--paper-ink)' }}>Ask</strong> to start a
      conversation about it.
    </div>
  );
}

function SetupCTA({ onOpenSettings }: { onOpenSettings: () => void }) {
  return (
    <div
      style={{
        flex: 1,
        padding: '32px 20px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        gap: 12,
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontFamily: 'var(--font-mono), monospace',
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: 'var(--muted)',
        }}
      >
        Set up Claude
      </div>
      <div style={{ fontSize: 14, color: 'var(--paper-ink)', lineHeight: 1.5 }}>
        Glyph uses your own Anthropic API key — your key and your reading stay on this device and never touch our servers.
      </div>
      <button
        onClick={onOpenSettings}
        style={{
          marginTop: 4,
          padding: '10px 18px',
          borderRadius: 14,
          background: 'var(--accent)',
          color: '#fff',
          border: 0,
          cursor: 'pointer',
          fontSize: 11,
          fontFamily: 'var(--font-mono), monospace',
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          fontWeight: 700,
        }}
      >
        Open settings
      </button>
    </div>
  );
}

const iconBtnStyle: React.CSSProperties = {
  width: 30,
  height: 30,
  borderRadius: 8,
  background: 'transparent',
  color: 'var(--muted)',
  border: 0,
  cursor: 'pointer',
  fontSize: 14,
};

function sendBtnStyle(active: boolean): React.CSSProperties {
  return {
    width: 40,
    height: 40,
    borderRadius: '50%',
    background: active ? 'var(--accent)' : 'var(--paper-rule)',
    color: active ? '#fff' : 'var(--muted)',
    border: 0,
    cursor: active ? 'pointer' : 'not-allowed',
    fontSize: 16,
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  };
}
