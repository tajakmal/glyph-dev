'use client';

import React, { useEffect, useRef, useState } from 'react';
import { VALIDATION } from '@/types';

interface NoteComposerProps {
  title: string;
  context?: string;
  placeholder?: string;
  saveLabel?: string;
  onSave: (note: string) => void;
  onClose: () => void;
}

export function NoteComposer({
  title,
  context,
  placeholder = 'Add a note...',
  saveLabel = 'Save note',
  onSave,
  onClose,
}: NoteComposerProps) {
  const [note, setNote] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const trimmed = note.trim();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 160,
        background: 'rgba(20,17,12,0.45)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        padding: '20px 12px calc(20px + env(safe-area-inset-bottom))',
      }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="sheet-in"
        style={{
          width: '100%',
          maxWidth: 460,
          borderRadius: 20,
          background: 'var(--paper)',
          color: 'var(--paper-ink)',
          border: '1px solid var(--paper-rule)',
          boxShadow: '0 22px 60px rgba(20,17,12,0.32)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '14px 16px',
            borderBottom: '1px solid var(--paper-rule)',
            display: 'flex',
            justifyContent: 'space-between',
            gap: 12,
            alignItems: 'center',
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontFamily: 'var(--font-mono), monospace',
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              fontWeight: 700,
              color: 'var(--paper-muted)',
            }}
          >
            {title}
          </div>
          <button
            onClick={onClose}
            aria-label="Close note composer"
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              border: 0,
              background: 'transparent',
              color: 'var(--paper-muted)',
              cursor: 'pointer',
              padding: 0,
              fontSize: 18,
            }}
          >
            x
          </button>
        </div>

        <div style={{ padding: 16 }}>
          {context && (
            <div
              style={{
                fontFamily: 'var(--font-serif), Georgia, serif',
                fontSize: 14,
                lineHeight: 1.5,
                color: 'var(--paper-muted)',
                borderLeft: '2px solid var(--accent)',
                paddingLeft: 10,
                marginBottom: 12,
              }}
            >
              &ldquo;{context.length > 180 ? context.slice(0, 178) + '...' : context}&rdquo;
            </div>
          )}
          <textarea
            ref={textareaRef}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder={placeholder}
            maxLength={VALIDATION.MAX_NOTE_LENGTH}
            rows={5}
            style={{
              width: '100%',
              resize: 'vertical',
              minHeight: 118,
              borderRadius: 12,
              border: '1px solid var(--paper-rule)',
              background: 'rgba(20,17,12,0.04)',
              color: 'var(--paper-ink)',
              padding: '12px 14px',
              font: 'inherit',
              fontSize: 15,
              lineHeight: 1.45,
              outline: 'none',
            }}
          />
          <div
            style={{
              marginTop: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <div
              style={{
                flex: 1,
                fontSize: 10,
                fontFamily: 'var(--font-mono), monospace',
                letterSpacing: '0.12em',
                color: 'var(--paper-muted)',
              }}
            >
              {note.length}/{VALIDATION.MAX_NOTE_LENGTH}
            </div>
            <button
              onClick={onClose}
              style={{
                height: 42,
                padding: '0 16px',
                borderRadius: 21,
                border: '1px solid var(--paper-rule)',
                background: 'transparent',
                color: 'var(--paper-ink)',
                cursor: 'pointer',
                fontFamily: 'var(--font-mono), monospace',
                fontSize: 10,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                fontWeight: 700,
              }}
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (trimmed) onSave(trimmed);
              }}
              disabled={!trimmed}
              style={{
                height: 42,
                padding: '0 18px',
                borderRadius: 21,
                border: 0,
                background: trimmed ? 'var(--accent)' : 'var(--paper-rule)',
                color: trimmed ? '#fff' : 'var(--paper-muted)',
                cursor: trimmed ? 'pointer' : 'not-allowed',
                fontFamily: 'var(--font-mono), monospace',
                fontSize: 10,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                fontWeight: 700,
              }}
            >
              {saveLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
