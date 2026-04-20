'use client';

import React from 'react';
import type { QuizQuestion } from '@/lib/goal-read/types';

interface QuestionCardProps {
  question: QuizQuestion;
  /** Selected choice index, or null if no answer yet */
  selection: number | null;
  onSelect: (choiceIndex: number) => void;
}

export function QuestionCard({
  question,
  selection,
  onSelect,
}: QuestionCardProps) {
  const answered = selection !== null;
  return (
    <div>
      <div
        style={{
          fontSize: 17,
          lineHeight: 1.45,
          color: 'var(--ink)',
          marginBottom: 18,
          fontWeight: 500,
        }}
      >
        {question.question}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {question.choices.map((choice, idx) => {
          const isSelection = selection === idx;
          const isCorrect = idx === question.correctIndex;
          let bg = 'rgba(242,239,232,0.03)';
          let border = '1px solid var(--rule)';
          let color = 'var(--ink)';
          let badgeBg = 'rgba(242,239,232,0.08)';
          let badgeColor = 'var(--ink)';

          if (answered) {
            if (isCorrect) {
              bg = 'rgba(134, 239, 172, 0.12)';
              border = '1px solid rgba(134, 239, 172, 0.6)';
              badgeBg = 'rgba(134, 239, 172, 0.2)';
              badgeColor = '#86efac';
            } else if (isSelection) {
              bg = 'rgba(249, 168, 212, 0.12)';
              border = '1px solid rgba(249, 168, 212, 0.6)';
              badgeBg = 'rgba(249, 168, 212, 0.2)';
              badgeColor = '#f9a8d4';
            } else {
              color = 'var(--muted-strong)';
            }
          }

          const letter = String.fromCharCode(65 + idx); // A/B/C/D

          return (
            <button
              key={idx}
              onClick={() => !answered && onSelect(idx)}
              disabled={answered}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: '14px 14px',
                borderRadius: 12,
                background: bg,
                border,
                color,
                cursor: answered ? 'default' : 'pointer',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
                fontFamily: 'inherit',
                fontSize: 15,
                lineHeight: 1.4,
                transition: 'background 160ms ease, border 160ms ease',
              }}
              aria-label={`Answer ${letter}: ${choice}`}
              aria-pressed={isSelection}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 6,
                  background: badgeBg,
                  color: badgeColor,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: 'var(--font-mono), monospace',
                  fontSize: 11,
                  fontWeight: 700,
                  flexShrink: 0,
                  marginTop: 1,
                }}
              >
                {letter}
              </span>
              <span>{choice}</span>
            </button>
          );
        })}
      </div>

      {answered && question.explanation && (
        <div
          style={{
            marginTop: 16,
            padding: 12,
            borderRadius: 10,
            background: 'rgba(242,239,232,0.04)',
            fontSize: 13,
            lineHeight: 1.5,
            color: 'var(--muted-strong)',
            animation: 'fade-in 200ms ease-out',
          }}
        >
          {question.explanation}
        </div>
      )}
    </div>
  );
}
