'use client';

import React from 'react';
import { useReaderContext } from '@/contexts/ReaderContext';
import { PDFViewer } from '@/components/pdf/PDFViewer';
import { TextReader } from '@/components/text/TextReader';
import { SpeedReadPanel } from '@/components/speed-read/SpeedReadPanel';

export function UnifiedReaderLayout() {
  const { viewMode, documentId, documentKind, error } = useReaderContext();

  if (error) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg)',
          color: 'var(--muted)',
          padding: 24,
          textAlign: 'center',
        }}
      >
        <div>
          <p style={{ fontSize: 18, fontWeight: 600, color: 'var(--ink)' }}>
            Failed to load document
          </p>
          <p style={{ fontSize: 13, marginTop: 6 }}>{error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', position: 'relative' }}>
      {/* PDF/Text viewer — always mounted to preserve scroll state */}
      <div
        style={{
          height: '100%',
          position: viewMode === 'pdf' ? 'relative' : 'absolute',
          inset: viewMode === 'pdf' ? undefined : 0,
          visibility: viewMode === 'pdf' ? 'visible' : 'hidden',
        }}
        aria-hidden={viewMode !== 'pdf'}
      >
        {documentKind === 'pdf' ? (
          <PDFViewer documentId={documentId} />
        ) : (
          <TextReader documentId={documentId} />
        )}
      </div>

      {/* Speed read panel — full screen overlay */}
      {viewMode === 'speed-read' && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 10 }}>
          <SpeedReadPanel />
        </div>
      )}
    </div>
  );
}
