'use client';

import React, { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useDocumentLibrary } from '@/hooks/useDocumentLibrary';
import { AppShell } from '@/components/shell/AppShell';
import { MicroLabel } from '@/components/shell/MicroLabel';
import { tokenize } from '@/lib/tokenize';
import { trackEvent } from '@/lib/telemetry';

type OptionKey = 'pdf' | 'link' | 'text' | 'scan';

interface Option {
  key: OptionKey;
  title: string;
  sub: string;
  glyph: React.ReactNode;
  disabled?: boolean;
  comingSoon?: boolean;
}

export function NewScreen() {
  const router = useRouter();
  const { documents, addDocument, addTextDocument } = useDocumentLibrary();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const [expanded, setExpanded] = useState<OptionKey | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [textError, setTextError] = useState<string | null>(null);

  const [textTitle, setTextTitle] = useState('');
  const [textContent, setTextContent] = useState('');
  const [isSavingText, setIsSavingText] = useState(false);
  const wordCount = useMemo(() => tokenize(textContent).length, [textContent]);
  const isSaveDisabled = textContent.trim().length === 0 || isSavingText;

  const recentImports = useMemo(
    () =>
      [...documents]
        .sort((a, b) => b.addedAt - a.addedAt)
        .slice(0, 3)
        .map((d) => {
          if (d.kind === 'pdf') return d.fileName || d.title;
          if (d.textPreview)
            return d.title + ' · ' + d.textPreview.slice(0, 32).trim() + '…';
          return d.title;
        }),
    [documents]
  );

  const handleFileUpload = async (file: File) => {
    setIsUploading(true);
    setUploadError(null);
    try {
      const doc = await addDocument(file);
      trackEvent('library_upload_success', {
        kind: 'pdf',
        sizeBytes: file.size,
      });
      router.push(`/reader/${doc.id}`);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Failed to upload');
      trackEvent('library_upload_failed', { kind: 'pdf' });
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveText = async () => {
    setIsSavingText(true);
    setTextError(null);
    try {
      const doc = await addTextDocument({
        title: textTitle.trim() || undefined,
        content: textContent,
      });
      trackEvent('library_text_saved', { kind: 'text', words: wordCount });
      setTextTitle('');
      setTextContent('');
      router.push(`/reader/${doc.id}`);
    } catch (e) {
      setTextError(e instanceof Error ? e.message : 'Failed to save text');
    } finally {
      setIsSavingText(false);
    }
  };

  const options: Option[] = [
    {
      key: 'pdf',
      title: 'Upload PDF',
      sub: 'up to 50 MB · works offline',
      glyph: (
        <span style={{ fontFamily: 'var(--font-mono), monospace', fontSize: 11, fontWeight: 600 }}>
          PDF
        </span>
      ),
    },
    {
      key: 'link',
      title: 'Paste a link',
      sub: 'articles · blog posts · arXiv',
      glyph: (
        <span style={{ fontFamily: 'var(--font-mono), monospace', fontSize: 11, fontWeight: 600 }}>
          ⌘V
        </span>
      ),
      disabled: true,
      comingSoon: true,
    },
    {
      key: 'text',
      title: 'Paste text',
      sub: 'paste into the editor',
      glyph: (
        <span style={{ fontFamily: 'var(--font-mono), monospace', fontSize: 11, fontWeight: 600 }}>
          Tt
        </span>
      ),
    },
    {
      key: 'scan',
      title: 'Scan a page',
      sub: 'OCR with your camera',
      glyph: (
        <svg width="16" height="14" viewBox="0 0 16 14" aria-hidden="true">
          <rect x="1" y="3" width="14" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.3" fill="none" />
          <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.3" fill="none" />
          <rect x="5" y="1" width="6" height="2.5" rx="0.5" stroke="currentColor" strokeWidth="1.3" fill="none" />
        </svg>
      ),
      disabled: true,
      comingSoon: true,
    },
  ];

  const handleOptionClick = (o: Option) => {
    if (o.disabled) return;
    if (o.key === 'pdf') {
      fileInputRef.current?.click();
    } else if (o.key === 'text') {
      setExpanded((curr) => {
        const next = curr === 'text' ? null : 'text';
        if (next === 'text') {
          requestAnimationFrame(() => {
            textAreaRef.current?.focus({ preventScroll: true });
            textAreaRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
          });
        }
        return next;
      });
    }
  };

  return (
    <AppShell>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,.pdf"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileUpload(file);
          e.target.value = '';
        }}
      />

      {/* Header */}
      <div style={{ padding: 'max(58px, calc(20px + env(safe-area-inset-top))) 20px 0' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 10,
          }}
        >
          <button
            onClick={() => router.back()}
            style={{
              background: 'transparent',
              border: 0,
              color: 'var(--muted)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 14,
              padding: '10px 8px 10px 0',
              minHeight: 44,
              fontFamily: 'inherit',
            }}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
              <path
                d="M7 1L3 5l4 4"
                stroke="var(--ink)"
                strokeWidth="1.5"
                fill="none"
                strokeLinecap="round"
              />
            </svg>
            Cancel
          </button>
          <MicroLabel>New</MicroLabel>
          <div style={{ width: 60 }} />
        </div>

        <h1
          style={{
            fontSize: 34,
            fontWeight: 600,
            margin: '28px 0 6px',
            letterSpacing: 0,
            lineHeight: 1.05,
          }}
        >
          What are you reading?
        </h1>
        <div style={{ fontSize: 14, color: 'var(--muted)' }}>
          Choose a PDF, paste text, or add a link.
        </div>
      </div>

      {/* Options */}
      <div style={{ padding: '28px 20px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {options.map((o) => (
          <div key={o.key}>
            <button
              onClick={() => handleOptionClick(o)}
              disabled={o.disabled}
              aria-label={o.title}
              style={{
                width: '100%',
                padding: '16px 14px',
                borderRadius: 14,
                background: 'var(--bg-elevated)',
                border: '1px solid var(--rule)',
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                color: 'var(--ink)',
                cursor: o.disabled ? 'not-allowed' : 'pointer',
                opacity: o.disabled ? 0.55 : 1,
                textAlign: 'left',
                fontFamily: 'inherit',
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background:
                    o.key === 'pdf' && !o.disabled
                      ? 'var(--accent)'
                      : 'var(--bg-elevated)',
                  border: o.key === 'pdf' && !o.disabled ? 0 : '1px solid var(--rule)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: o.key === 'pdf' && !o.disabled ? '#fff' : 'var(--ink)',
                }}
              >
                {o.glyph}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 500,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  {o.title}
                  {o.comingSoon && (
                    <span
                      style={{
                        fontSize: 9,
                        fontFamily: 'var(--font-mono), monospace',
                        color: 'var(--accent)',
                        letterSpacing: '0.15em',
                        textTransform: 'uppercase',
                        border: '1px solid var(--accent-20)',
                        padding: '2px 6px',
                        borderRadius: 4,
                        background: 'var(--accent-10)',
                      }}
                    >
                      soon
                    </span>
                  )}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--muted)',
                    marginTop: 2,
                    fontFamily: 'var(--font-mono), monospace',
                    letterSpacing: '0.08em',
                  }}
                >
                  {o.sub}
                </div>
              </div>
              {!o.disabled && (
                <svg width="8" height="14" viewBox="0 0 8 14" aria-hidden="true">
                  <path
                    d="M1 1l6 6-6 6"
                    stroke="var(--muted)"
                    strokeWidth="1.5"
                    fill="none"
                    strokeLinecap="round"
                  />
                </svg>
              )}
            </button>

            {/* Inline text editor */}
            {expanded === 'text' && o.key === 'text' && (
              <div
                style={{
                  marginTop: 10,
                  padding: 14,
                  borderRadius: 14,
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--rule)',
                  scrollMarginBottom: 'calc(120px + env(safe-area-inset-bottom))',
                }}
              >
                <input
                  type="text"
                  placeholder="Title (optional)"
                  value={textTitle}
                  onChange={(e) => setTextTitle(e.target.value)}
                  style={inputStyle}
                />
                <textarea
                  placeholder="Paste your text here…"
                  value={textContent}
                  onChange={(e) => {
                    setTextContent(e.target.value);
                    if (textError) setTextError(null);
                  }}
                  ref={textAreaRef}
                  style={{ ...inputStyle, minHeight: 120, resize: 'vertical', marginTop: 8 }}
                />
                {textError && (
                  <div
                    style={{
                      marginTop: 8,
                      color: 'var(--accent)',
                      fontSize: 12,
                      lineHeight: 1.4,
                    }}
                  >
                    {textError}
                  </div>
                )}
                <div
                  style={{
                    marginTop: 10,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span
                    style={{
                      fontSize: 10,
                      fontFamily: 'var(--font-mono), monospace',
                      color: 'var(--muted)',
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                    }}
                  >
                    {wordCount} {wordCount === 1 ? 'word' : 'words'}
                  </span>
                  <button
                    onClick={handleSaveText}
                    disabled={isSaveDisabled}
                    style={{
                      padding: '8px 16px',
                      minHeight: 44,
                      borderRadius: 999,
                      background: isSaveDisabled ? 'var(--bg-elevated)' : 'var(--accent)',
                      color: isSaveDisabled ? 'var(--muted)' : '#fff',
                      border: isSaveDisabled ? '1px solid var(--rule)' : 0,
                      cursor: isSaveDisabled ? 'not-allowed' : 'pointer',
                      fontSize: 11,
                      letterSpacing: '0.2em',
                      textTransform: 'uppercase',
                      fontWeight: 600,
                      fontFamily: 'inherit',
                    }}
                  >
                    {isSavingText ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}

        {uploadError && (
          <div
            style={{
              marginTop: 4,
              padding: 10,
              borderRadius: 8,
              background: 'var(--accent-10)',
              border: '1px solid var(--accent-20)',
              color: 'var(--accent)',
              fontSize: 12,
            }}
          >
            {uploadError}
          </div>
        )}

        {isUploading && (
          <div
            style={{
              marginTop: 4,
              padding: 10,
              borderRadius: 8,
              background: 'var(--bg-elevated)',
              border: '1px solid var(--rule)',
              color: 'var(--muted)',
              fontSize: 12,
            }}
          >
            Uploading…
          </div>
        )}

        {/* Recent imports */}
        <div style={{ marginTop: 20 }}>
          <MicroLabel style={{ marginBottom: 10 }}>Recent imports</MicroLabel>
          {recentImports.length === 0 ? (
            <div
              style={{
                padding: '10px 0',
                borderTop: '1px solid var(--rule)',
                fontSize: 12,
                color: 'var(--muted)',
                fontFamily: 'var(--font-mono), monospace',
                letterSpacing: '0.05em',
              }}
            >
              Nothing yet.
            </div>
          ) : (
            recentImports.map((s, i) => (
              <div
                key={i}
                style={{
                  padding: '10px 0',
                  borderTop: '1px solid var(--rule)',
                  fontSize: 12,
                  color: 'var(--muted)',
                  fontFamily: 'var(--font-mono), monospace',
                  letterSpacing: '0.05em',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={s}
              >
                {s}
              </div>
            ))
          )}
        </div>
      </div>
    </AppShell>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--bg)',
  color: 'var(--ink)',
  fontSize: 16,
  borderRadius: 10,
  padding: '10px 12px',
  border: '1px solid var(--rule)',
  outline: 'none',
  fontFamily: 'inherit',
};
