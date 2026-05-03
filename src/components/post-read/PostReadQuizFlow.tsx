'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { v4 as uuidv4 } from 'uuid';
import { usePostReadGeneration } from '@/hooks/usePostReadGeneration';
import type { PostReadQuestion } from '@/lib/post-read/types';
import { QuestionCard } from '@/components/goal-read/QuestionCard';
import { saveArchivedSession } from '@/lib/archive';
import type { ArchivedFreeSession } from '@/types/archive';

interface PostReadQuizFlowProps {
  documentId: string;
  documentTitle: string;
  words: string[];
  range: { startWord: number; endWord: number };
  wpm: number;
  /** Duration of the underlying free-read session, in ms (if known). */
  readDurationMs?: number;
  /** Average WPM during the free-read session. */
  readAvgWpm?: number;
  /** Called when the user dismisses the flow (either before start or after done). */
  onClose: () => void;
  /**
   * Called when the user wants to jump back into speed-reading this passage.
   * The ReturnScreen re-launches the reader; this flow just signals intent.
   */
  onReadAgain: () => void;
  /** Optional: surface a URL for opening the archive detail view. */
  getArchiveUrl?: (archiveId: string) => string;
}

type Phase = 'recap' | 'quiz' | 'done' | 'error';

/**
 * Post-session quiz flow. Drives:
 *   1. Streaming recap + reflection questions ("What did I just read?").
 *   2. ABCD comprehension quiz.
 *   3. Score screen, archived so the reader can revisit later.
 */
export function PostReadQuizFlow({
  documentId,
  documentTitle,
  words,
  range,
  wpm,
  readDurationMs,
  readAvgWpm,
  onClose,
  onReadAgain,
  getArchiveUrl,
}: PostReadQuizFlowProps) {
  const generation = usePostReadGeneration();
  const {
    streaming,
    summaryText,
    payload,
    error,
    start,
    reset,
    abort,
  } = generation;

  const [phase, setPhase] = useState<Phase>('recap');
  const [activeIdx, setActiveIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const startedRef = useRef(false);
  const [archiveId] = useState(() => uuidv4());
  const [savedToArchive, setSavedToArchive] = useState(false);

  // Kick off generation once.
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    start({ words, range });
    return () => {
      abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deliberate one-shot
  }, []);

  // Error handoff so retry works cleanly.
  useEffect(() => {
    if (error) setPhase('error');
  }, [error]);

  const quiz = payload?.quiz ?? null;
  const total = quiz?.length ?? 0;
  const safeIdx = Math.max(0, Math.min(total - 1, activeIdx));
  const currentQuestion: PostReadQuestion | null =
    quiz && quiz[safeIdx] ? quiz[safeIdx] : null;
  const selection = currentQuestion
    ? answers[currentQuestion.id] ?? null
    : null;
  const selectedIndex = typeof selection === 'number' ? selection : null;

  const score = useMemo(() => {
    if (!quiz) return { correct: 0, total: 0 };
    let correct = 0;
    for (const q of quiz) {
      if (answers[q.id] === q.correctIndex) correct++;
    }
    return { correct, total: quiz.length };
  }, [quiz, answers]);

  // Persist to archive whenever we have a payload AND the user has started
  // the quiz phase. Writing on every answer means partial progress is saved
  // if the user navigates away.
  useEffect(() => {
    if (!payload) return;
    if (phase !== 'quiz' && phase !== 'done') return;
    const chunk = {
      index: 0,
      range,
      miniPrimer: '',
      questions: payload.quiz.map((q) => ({
        id: q.id,
        question: q.question,
        choices: q.choices,
        correctIndex: q.correctIndex,
        source: q.source,
        explanation: q.explanation,
        chosenIndex:
          typeof answers[q.id] === 'number' ? answers[q.id] : null,
      })),
    };
    const entry: ArchivedFreeSession = {
      kind: 'free',
      id: archiveId,
      documentId,
      documentTitle,
      createdAt: Date.now(),
      range,
      wpm,
      summary: payload.summary,
      anchors: payload.keyQuestions.map((text) => ({ text })),
      chunks: [chunk],
      totalQuestions: chunk.questions.length,
      totalCorrect: chunk.questions.reduce(
        (n, q) => n + (q.chosenIndex === q.correctIndex ? 1 : 0),
        0
      ),
      readDurationMs,
      readAvgWpm,
    };
    try {
      saveArchivedSession(entry);
      setSavedToArchive(true);
    } catch {
      // non-fatal
    }
  }, [
    payload,
    phase,
    answers,
    archiveId,
    documentId,
    documentTitle,
    range,
    wpm,
    readDurationMs,
    readAvgWpm,
  ]);

  const handleSelect = useCallback(
    (choiceIndex: number) => {
      if (!currentQuestion) return;
      setAnswers((prev) => ({ ...prev, [currentQuestion.id]: choiceIndex }));
    },
    [currentQuestion]
  );

  const handleNext = useCallback(() => {
    if (!quiz) return;
    if (safeIdx < quiz.length - 1) {
      setActiveIdx(safeIdx + 1);
    } else {
      setPhase('done');
    }
  }, [quiz, safeIdx]);

  const handleStartQuiz = useCallback(() => {
    setPhase('quiz');
    setActiveIdx(0);
  }, []);

  const handleRetry = useCallback(() => {
    reset();
    setPhase('recap');
    setActiveIdx(0);
    setAnswers({});
    start({ words, range });
  }, [reset, start, words, range]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Post-reading quiz"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 130,
        background: 'var(--bg)',
        color: 'var(--ink)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Top bar */}
      <div
        style={{
          padding: 'max(env(safe-area-inset-top), 18px) 20px 12px',
          borderBottom: '1px solid var(--rule)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <button
          onClick={onClose}
          aria-label="Close post-read quiz"
          className="micro-label"
          style={closeBtnStyle}
        >
          ← Back
        </button>
        <div className="micro-label" style={{ color: 'var(--muted)' }}>
          {phase === 'done'
            ? 'Review'
            : phase === 'quiz'
            ? `Quiz · ${safeIdx + 1}/${total}`
            : '✦ What you just read'}
        </div>
        <div style={{ width: 44 }} />
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflow: 'auto', padding: '24px 20px 20px' }}>
        {phase === 'error' ? (
          <div>
            <div
              style={{
                padding: 16,
                borderRadius: 14,
                border: '1px solid rgba(255, 90, 61, 0.28)',
                background: 'rgba(255, 90, 61, 0.08)',
                color: 'var(--ink)',
                fontSize: 14,
                lineHeight: 1.5,
                marginBottom: 16,
              }}
            >
              Couldn&rsquo;t generate a recap — {error}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={handleRetry} style={primaryBtnStyle}>
                Retry
              </button>
              <button onClick={onClose} style={secondaryBtnStyle}>
                Close
              </button>
            </div>
          </div>
        ) : phase === 'done' ? (
          <DoneView
            score={score}
            payload={payload}
            answers={answers}
            archiveUrl={
              savedToArchive && getArchiveUrl
                ? getArchiveUrl(archiveId)
                : null
            }
            onReadAgain={onReadAgain}
            onClose={onClose}
          />
        ) : phase === 'quiz' ? (
          currentQuestion ? (
            <QuizPhase
              question={currentQuestion}
              selection={selectedIndex}
              onSelect={handleSelect}
              onNext={handleNext}
              isLast={safeIdx >= total - 1}
              idx={safeIdx}
              total={total}
              answers={answers}
              questions={quiz ?? []}
              setActiveIdx={setActiveIdx}
            />
          ) : null
        ) : (
          <RecapPhase
            streaming={streaming}
            summaryText={summaryText}
            keyQuestions={payload?.keyQuestions ?? []}
            ready={!!payload}
            onStartQuiz={handleStartQuiz}
            onClose={onClose}
          />
        )}
      </div>
    </div>
  );
}

function RecapPhase({
  streaming,
  summaryText,
  keyQuestions,
  ready,
  onStartQuiz,
  onClose,
}: {
  streaming: boolean;
  summaryText: string;
  keyQuestions: string[];
  ready: boolean;
  onStartQuiz: () => void;
  onClose: () => void;
}) {
  return (
    <>
      <div
        className="micro-label"
        style={{ color: 'var(--muted)', marginBottom: 10 }}
      >
        ✦ Recap
      </div>
      <div
        style={{
          fontFamily: 'var(--font-sans), system-ui, sans-serif',
          fontSize: 17,
          lineHeight: 1.55,
          color: 'var(--ink)',
          whiteSpace: 'pre-wrap',
          marginBottom: 24,
        }}
      >
        {summaryText ? (
          <>
            {summaryText}
            {streaming && (
              <span
                aria-hidden="true"
                style={{
                  display: 'inline-block',
                  width: 7,
                  height: 16,
                  marginLeft: 4,
                  background: 'var(--accent)',
                  verticalAlign: 'middle',
                  animation: 'glyph-cursor-blink 900ms infinite',
                }}
              />
            )}
          </>
        ) : streaming ? (
          <SummarySkeleton />
        ) : (
          <span style={{ color: 'var(--muted)' }}>Thinking…</span>
        )}
      </div>

      {keyQuestions.length > 0 && (
        <div>
          <div
            className="micro-label"
            style={{ color: 'var(--muted)', marginBottom: 10 }}
          >
            Questions to sit with
          </div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {keyQuestions.map((q, i) => (
              <li
                key={i}
                style={{
                  fontSize: 15,
                  lineHeight: 1.5,
                  color: 'var(--ink)',
                  display: 'flex',
                  gap: 10,
                  marginBottom: 10,
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    color: 'var(--accent)',
                    flexShrink: 0,
                    marginTop: 2,
                  }}
                >
                  ✦
                </span>
                <span>{q}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div
        style={{
          display: 'flex',
          gap: 10,
          marginTop: 28,
          paddingBottom: 'calc(env(safe-area-inset-bottom))',
        }}
      >
        <button onClick={onClose} style={secondaryBtnStyle}>
          Skip
        </button>
        <button
          onClick={onStartQuiz}
          disabled={!ready}
          style={{
            ...primaryBtnStyle,
            background: ready ? 'var(--accent)' : 'var(--rule)',
            color: ready ? '#fff' : 'var(--muted)',
            cursor: ready ? 'pointer' : 'not-allowed',
          }}
        >
          {ready ? 'Start quiz' : 'Generating…'}
        </button>
      </div>
    </>
  );
}

function QuizPhase({
  question,
  selection,
  onSelect,
  onNext,
  isLast,
  idx,
  total,
  answers,
  questions,
  setActiveIdx,
}: {
  question: PostReadQuestion;
  selection: number | null;
  onSelect: (choiceIndex: number) => void;
  onNext: () => void;
  isLast: boolean;
  idx: number;
  total: number;
  answers: Record<string, number>;
  questions: PostReadQuestion[];
  setActiveIdx: (i: number) => void;
}) {
  const handlePrev = useCallback(() => {
    if (idx > 0) setActiveIdx(idx - 1);
  }, [idx, setActiveIdx]);

  return (
    <>
      {/* Progress dots */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 22 }}>
        {questions.map((q, i) => {
          const chosen = answers[q.id];
          const answered = typeof chosen === 'number';
          const correct = answered && chosen === q.correctIndex;
          const isActive = i === idx;
          return (
            <div
              key={q.id}
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

      <QuestionCard
        key={question.id}
        // QuestionCard accepts a compatible shape (same fields).
        question={{
          id: question.id,
          question: question.question,
          choices: question.choices,
          correctIndex: question.correctIndex,
          source: question.source,
          explanation: question.explanation,
        }}
        selection={selection}
        onSelect={onSelect}
      />

      <div
        style={{
          marginTop: 24,
          display: 'flex',
          gap: 10,
          alignItems: 'center',
          paddingBottom: 'calc(env(safe-area-inset-bottom))',
        }}
      >
        <button
          onClick={handlePrev}
          disabled={idx === 0}
          style={{
            ...secondaryBtnStyle,
            opacity: idx === 0 ? 0.45 : 1,
            cursor: idx === 0 ? 'not-allowed' : 'pointer',
          }}
        >
          Back
        </button>
        <div style={{ flex: 1 }} />
        <button
          onClick={onNext}
          disabled={selection === null}
          style={{
            ...primaryBtnStyle,
            background: selection === null ? 'var(--rule)' : 'var(--accent)',
            color: selection === null ? 'var(--muted)' : '#fff',
            cursor: selection === null ? 'not-allowed' : 'pointer',
          }}
        >
          {isLast ? 'See results' : `Next · ${idx + 1}/${total}`}
        </button>
      </div>
    </>
  );
}

function DoneView({
  score,
  payload,
  answers,
  archiveUrl,
  onReadAgain,
  onClose,
}: {
  score: { correct: number; total: number };
  payload: { quiz: PostReadQuestion[] } | null;
  answers: Record<string, number>;
  archiveUrl: string | null;
  onReadAgain: () => void;
  onClose: () => void;
}) {
  const pct =
    score.total > 0 ? Math.round((score.correct / score.total) * 100) : 0;
  return (
    <div style={{ paddingBottom: 'calc(env(safe-area-inset-bottom))' }}>
      <div
        style={{
          fontSize: 72,
          fontWeight: 700,
          letterSpacing: 0,
          lineHeight: 0.92,
          color: 'var(--accent)',
        }}
      >
        {score.correct}
        <span style={{ fontSize: 32, color: 'var(--muted)', fontWeight: 500 }}>
          {' '}
          / {score.total}
        </span>
      </div>
      <div
        className="micro-label"
        style={{ color: 'var(--muted)', marginTop: 8 }}
      >
        {pct}% · saved to archive
      </div>

      <div style={{ marginTop: 24 }}>
        {(payload?.quiz ?? []).map((q, i) => {
          const chosen = answers[q.id];
          const correct = typeof chosen === 'number' && chosen === q.correctIndex;
          return (
            <details
              key={q.id}
              style={{
                borderTop: '1px solid var(--rule)',
                padding: '12px 0',
              }}
            >
              <summary
                style={{
                  display: 'flex',
                  gap: 10,
                  alignItems: 'flex-start',
                  cursor: 'pointer',
                  listStyle: 'none',
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 24,
                    height: 24,
                    borderRadius: 6,
                    background: correct
                      ? 'rgba(134, 239, 172, 0.18)'
                      : 'rgba(249, 168, 212, 0.18)',
                    color: correct ? '#86efac' : '#f9a8d4',
                    fontSize: 13,
                    fontWeight: 700,
                    flexShrink: 0,
                    marginTop: 1,
                  }}
                >
                  {correct ? '✓' : '✕'}
                </span>
                <span
                  style={{
                    fontSize: 14,
                    lineHeight: 1.45,
                    color: 'var(--ink)',
                    fontWeight: 500,
                  }}
                >
                  Q{i + 1}. {q.question}
                </span>
              </summary>
              <div style={{ paddingLeft: 34, marginTop: 8 }}>
                <div
                  style={{
                    fontSize: 13,
                    color: 'var(--muted-strong)',
                    marginBottom: 4,
                  }}
                >
                  Correct: {q.choices[q.correctIndex]}
                </div>
                {typeof chosen === 'number' && chosen !== q.correctIndex && (
                  <div
                    style={{
                      fontSize: 13,
                      color: 'var(--muted)',
                      marginBottom: 4,
                    }}
                  >
                    Your answer: {q.choices[chosen]}
                  </div>
                )}
                {q.explanation && (
                  <div
                    style={{
                      fontSize: 13,
                      lineHeight: 1.5,
                      color: 'var(--muted-strong)',
                      marginTop: 6,
                    }}
                  >
                    {q.explanation}
                  </div>
                )}
              </div>
            </details>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
        <button onClick={onReadAgain} style={secondaryBtnStyle}>
          Read again
        </button>
        <button onClick={onClose} style={primaryBtnStyle}>
          Done
        </button>
      </div>

      {archiveUrl && (
        <div style={{ marginTop: 14, textAlign: 'center' }}>
          <a
            href={archiveUrl}
            style={{
              fontSize: 11,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: 'var(--muted)',
              textDecoration: 'none',
              fontFamily: 'var(--font-mono), monospace',
            }}
          >
            View in archive →
          </a>
        </div>
      )}
    </div>
  );
}

function SummarySkeleton() {
  return (
    <div
      aria-hidden="true"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        opacity: 0.5,
      }}
    >
      {[0.95, 0.88, 0.72].map((w, i) => (
        <div
          key={i}
          style={{
            height: 14,
            width: `${w * 100}%`,
            background: 'var(--rule)',
            borderRadius: 6,
            animation: `pulse 1.4s ${i * 0.12}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

const closeBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: 0,
  color: 'var(--muted)',
  cursor: 'pointer',
  padding: '6px 10px 6px 0',
};

const primaryBtnStyle: React.CSSProperties = {
  flex: 1,
  height: 48,
  padding: '0 18px',
  borderRadius: 24,
  border: 0,
  background: 'var(--accent)',
  color: '#fff',
  cursor: 'pointer',
  fontFamily: 'var(--font-mono), monospace',
  fontSize: 11,
  letterSpacing: '0.2em',
  textTransform: 'uppercase',
  fontWeight: 700,
};

const secondaryBtnStyle: React.CSSProperties = {
  height: 48,
  padding: '0 18px',
  borderRadius: 24,
  border: '1px solid var(--rule)',
  background: 'transparent',
  color: 'var(--ink)',
  cursor: 'pointer',
  fontFamily: 'var(--font-mono), monospace',
  fontSize: 11,
  letterSpacing: '0.2em',
  textTransform: 'uppercase',
  fontWeight: 600,
};
