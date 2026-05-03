'use client';

import React from 'react';
import { useReaderContext } from '@/contexts/ReaderContext';
import { GoalProvider, useGoalContext } from '@/contexts/GoalContext';
import { PDFViewer } from '@/components/pdf/PDFViewer';
import { TextReader } from '@/components/text/TextReader';
import { SpeedReadPanel } from '@/components/speed-read/SpeedReadPanel';
import { PrimerModal } from '@/components/goal-read/PrimerModal';
import { QuizModal } from '@/components/goal-read/QuizModal';
import { BetweenChunksScreen } from '@/components/goal-read/BetweenChunksScreen';
import { FinalSummaryScreen } from '@/components/goal-read/FinalSummaryScreen';
import { SourceModal } from '@/components/goal-read/SourceModal';

export function UnifiedReaderLayout() {
  const { viewMode, documentId, documentKind, currentPage, error } = useReaderContext();

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
    <GoalProvider>
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
            <PDFViewer documentId={documentId} initialPage={currentPage} />
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

        <GoalOverlays />
      </div>
    </GoalProvider>
  );
}

function GoalOverlays() {
  const { session, showSource } = useGoalContext();
  const activeState = session?.state.kind;

  return (
    <>
      <PrimerModal />
      {activeState === 'quiz' && !showSource && <QuizModal />}
      {activeState === 'betweenChunks' && <BetweenChunksScreen />}
      {activeState === 'finalSummary' && <FinalSummaryScreen />}
      {showSource && <SourceModal />}
    </>
  );
}
