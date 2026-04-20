'use client';

import React, { useCallback, useEffect } from 'react';
import { useGoalContext } from '@/contexts/GoalContext';
import { QuestionCard } from './QuestionCard';

export function QuizModal() {
  const {
    session,
    answer,
    completeQuiz,
    revealSource,
    activeQuestionIndex,
    setActiveQuestionIndex,
    exitGoal,
  } = useGoalContext();

  const chunkIndex =
    session?.state.kind === 'quiz' ? session.state.chunkIndex : null;

  const chunk =
    session && chunkIndex !== null ? session.chunks[chunkIndex] : null;
  const totalQ = chunk?.quiz.length ?? 0;
  const safeIdx = Math.max(0, Math.min(totalQ - 1, activeQuestionIndex));
  const question = chunk?.quiz[safeIdx] ?? null;
  const selection =
    question && session && chunkIndex !== null
      ? session.answers[chunkIndex]?.[question.id]
      : undefined;
  const selectedIndex = typeof selection === 'number' ? selection : null;

  const handleSelect = useCallback(
    (choiceIndex: number) => {
      if (!question || chunkIndex === null) return;
      answer(chunkIndex, question, choiceIndex);
    },
    [question, chunkIndex, answer]
  );

  const handleNext = useCallback(() => {
    if (chunkIndex === null) return;
    if (safeIdx < totalQ - 1) {
      setActiveQuestionIndex(safeIdx + 1);
    } else {
      completeQuiz(chunkIndex);
    }
  }, [chunkIndex, safeIdx, totalQ, setActiveQuestionIndex, completeQuiz]);

  const handleShowSource = useCallback(() => {
    if (!question || chunkIndex === null) return;
    revealSource(chunkIndex, question);
  }, [question, chunkIndex, revealSource]);

  // Keyboard shortcuts: A/B/C/D, 1/2/3/4, Enter, S. Esc is intentionally
  // ignored — users must tap Exit goal to leave.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!question || chunkIndex === null) return;
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        return;
      }
      if (e.key === 'Enter') {
        if (selectedIndex !== null) {
          e.preventDefault();
          handleNext();
        }
        return;
      }
      if (e.key === 's' || e.key === 'S') {
        if (selectedIndex !== null) {
          e.preventDefault();
          handleShowSource();
        }
        return;
      }
      const lower = e.key.toLowerCase();
      const idxFromLetter = ['a', 'b', 'c', 'd'].indexOf(lower);
      if (idxFromLetter !== -1) {
        if (selectedIndex === null) {
          e.preventDefault();
          handleSelect(idxFromLetter);
        }
        return;
      }
      const idxFromDigit = ['1', '2', '3', '4'].indexOf(e.key);
      if (idxFromDigit !== -1) {
        if (selectedIndex === null) {
          e.preventDefault();
          handleSelect(idxFromDigit);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [question, chunkIndex, selectedIndex, handleNext, handleSelect, handleShowSource]);

  if (!session || chunkIndex === null || !chunk || !question) return null;

  const chunkLabel = `Chunk ${chunkIndex + 1} of ${session.chunks.length}`;

  return (
    <>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(8,8,8,0.72)',
          zIndex: 110,
          animation: 'fade-in 160ms ease-out',
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${chunkLabel} quiz`}
        className="modal"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 111,
          maxWidth: 560,
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--bg)',
          color: 'var(--ink)',
          overflow: 'hidden',
        }}
      >
        {/* Top bar */}
        <div
          style={{
            padding: 'max(env(safe-area-inset-top), 18px) 20px 12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid var(--rule)',
          }}
        >
          <div className="micro-label" style={{ color: 'var(--muted)' }}>
            {chunkLabel} · Quiz
          </div>
          <button
            onClick={exitGoal}
            aria-label="Exit goal"
            className="micro-label"
            style={{
              background: 'transparent',
              border: 0,
              color: 'var(--muted)',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            Exit goal
          </button>
        </div>

        {/* Progress dots */}
        <div
          style={{
            display: 'flex',
            gap: 6,
            padding: '12px 20px 0',
          }}
        >
          {chunk.quiz.map((q, i) => {
            const chosen = session.answers[chunkIndex]?.[q.id];
            const answered = typeof chosen === 'number';
            const correct = answered && chosen === q.correctIndex;
            const isActive = i === safeIdx;
            return (
              <div
                key={i}
                aria-hidden="true"
                style={{
                  flex: 1,
                  height: 3,
                  borderRadius: 2,
                  background: isActive
                    ? 'var(--accent)'
                    : answered
                    ? correct
                      ? 'rgba(134, 239, 172, 0.55)'
                      : 'rgba(248, 113, 113, 0.6)'
                    : 'rgba(242,239,232,0.12)',
                }}
              />
            );
          })}
        </div>

        <div style={{ padding: '24px 20px 0', flex: 1, overflow: 'auto' }}>
          <QuestionCard
            key={question.id}
            question={question}
            selection={selectedIndex}
            onSelect={handleSelect}
          />
        </div>

        {/* Footer actions */}
        <div
          style={{
            padding: '12px 20px calc(16px + env(safe-area-inset-bottom))',
            borderTop: '1px solid var(--rule)',
            display: 'flex',
            gap: 10,
            alignItems: 'center',
          }}
        >
          <button
            onClick={handleShowSource}
            disabled={selectedIndex === null}
            style={{
              height: 44,
              padding: '0 16px',
              borderRadius: 22,
              border: '1px solid var(--rule)',
              background: 'transparent',
              color: selectedIndex === null ? 'var(--muted)' : 'var(--ink)',
              cursor: selectedIndex === null ? 'not-allowed' : 'pointer',
              fontFamily: 'var(--font-mono), monospace',
              fontSize: 10,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              fontWeight: 600,
            }}
          >
            Show source
          </button>
          <div style={{ flex: 1 }} />
          <button
            onClick={handleNext}
            disabled={selectedIndex === null}
            style={{
              height: 44,
              padding: '0 20px',
              borderRadius: 22,
              border: 0,
              background:
                selectedIndex === null ? 'var(--rule)' : 'var(--accent)',
              color: selectedIndex === null ? 'var(--muted)' : '#fff',
              cursor: selectedIndex === null ? 'not-allowed' : 'pointer',
              fontFamily: 'var(--font-mono), monospace',
              fontSize: 11,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              fontWeight: 700,
            }}
          >
            {safeIdx < totalQ - 1 ? 'Next question' : 'See chunk results'}
          </button>
        </div>
      </div>
    </>
  );
}
