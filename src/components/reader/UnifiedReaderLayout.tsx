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
      <div className="h-full flex items-center justify-center text-zinc-400">
        <div className="text-center">
          <p className="text-lg mb-2">Failed to load document</p>
          <p className="text-sm text-zinc-500">{error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full relative">
      {/* PDF/Text viewer — always mounted to preserve scroll state */}
      <div
        className={viewMode === 'pdf' ? 'h-full' : 'h-full absolute inset-0 invisible'}
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
        <div className="absolute inset-0 z-10">
          <SpeedReadPanel />
        </div>
      )}
    </div>
  );
}
