'use client';

/**
 * Session archive — primers, summaries, and quizzes from past reading sessions.
 * Stored in localStorage under `glyph:archived-sessions` as a JSON array sorted
 * newest-first.
 *
 * Persistence is best-effort: quota failures are swallowed so the read flow
 * never breaks. If the archive outgrows storage the oldest entries are
 * trimmed (MAX_ARCHIVE_ENTRIES).
 */

import { getFromStorage, setToStorage } from '@/lib/storage';
import type {
  ArchivedChunk,
  ArchivedSession,
  ArchivedQuestion,
  ArchivedWordRange,
} from '@/types/archive';

const ARCHIVE_KEY = 'glyph:archived-sessions';
const MAX_ARCHIVE_ENTRIES = 200;

/**
 * Normalize a raw archive entry. Returns null if required fields are missing —
 * this guards against both schema drift and hand-edited storage.
 */
function normalizeSession(raw: unknown): ArchivedSession | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;

  if (typeof r.id !== 'string' || !r.id) return null;
  if (typeof r.documentId !== 'string' || !r.documentId) return null;
  if (typeof r.documentTitle !== 'string') return null;
  if (typeof r.createdAt !== 'number') return null;
  if (r.kind !== 'goal' && r.kind !== 'free') return null;

  const range = normalizeRange(r.range);
  if (!range) return null;

  const wpm = typeof r.wpm === 'number' ? r.wpm : 320;
  const summary = typeof r.summary === 'string' ? r.summary : '';

  const anchors: Array<{ text: string }> = [];
  if (Array.isArray(r.anchors)) {
    for (const a of r.anchors) {
      if (a && typeof (a as { text?: unknown }).text === 'string') {
        anchors.push({ text: (a as { text: string }).text });
      }
    }
  }

  const chunks: ArchivedChunk[] = [];
  if (Array.isArray(r.chunks)) {
    for (const c of r.chunks) {
      const chunk = normalizeChunk(c);
      if (chunk) chunks.push(chunk);
    }
  }

  const totalQuestions = chunks.reduce((n, c) => n + c.questions.length, 0);
  const totalCorrect = chunks.reduce(
    (n, c) =>
      n +
      c.questions.reduce(
        (m, q) => m + (q.chosenIndex === q.correctIndex ? 1 : 0),
        0
      ),
    0
  );

  const base = {
    id: r.id,
    documentId: r.documentId,
    documentTitle: r.documentTitle,
    createdAt: r.createdAt,
    range,
    wpm,
    summary,
    anchors,
    chunks,
    totalCorrect,
    totalQuestions,
  };

  if (r.kind === 'goal') {
    return { ...base, kind: 'goal' };
  }
  return {
    ...base,
    kind: 'free',
    readDurationMs:
      typeof r.readDurationMs === 'number' ? r.readDurationMs : undefined,
    readAvgWpm:
      typeof r.readAvgWpm === 'number' ? r.readAvgWpm : undefined,
  };
}

function normalizeRange(raw: unknown): ArchivedWordRange | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.startWord !== 'number' || typeof r.endWord !== 'number') {
    return null;
  }
  return { startWord: r.startWord, endWord: r.endWord };
}

function normalizeChunk(raw: unknown): ArchivedChunk | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const range = normalizeRange(r.range);
  if (!range) return null;
  if (typeof r.index !== 'number') return null;
  const miniPrimer = typeof r.miniPrimer === 'string' ? r.miniPrimer : '';

  const questions: ArchivedQuestion[] = [];
  if (Array.isArray(r.questions)) {
    for (const q of r.questions) {
      const question = normalizeQuestion(q);
      if (question) questions.push(question);
    }
  }

  return { index: r.index, range, miniPrimer, questions };
}

function normalizeQuestion(raw: unknown): ArchivedQuestion | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== 'string' || !r.id) return null;
  if (typeof r.question !== 'string') return null;
  if (!Array.isArray(r.choices) || r.choices.length !== 4) return null;
  const choices = r.choices.map((c) => (typeof c === 'string' ? c : ''));
  if (choices.some((c) => !c)) return null;
  const correctIndex = r.correctIndex;
  if (
    typeof correctIndex !== 'number' ||
    !Number.isInteger(correctIndex) ||
    correctIndex < 0 ||
    correctIndex > 3
  ) {
    return null;
  }
  const source = normalizeRange(r.source);
  if (!source) return null;
  const chosenRaw = r.chosenIndex;
  let chosenIndex: number | null = null;
  if (typeof chosenRaw === 'number' && chosenRaw >= 0 && chosenRaw <= 3) {
    chosenIndex = chosenRaw;
  }
  const explanation =
    typeof r.explanation === 'string' ? r.explanation : undefined;

  return {
    id: r.id,
    question: r.question,
    choices: choices as [string, string, string, string],
    correctIndex: correctIndex as 0 | 1 | 2 | 3,
    source,
    explanation,
    chosenIndex,
  };
}

/**
 * Read all archived sessions, newest first.
 * Swallows malformed entries but returns the rest.
 */
export function getArchivedSessions(): ArchivedSession[] {
  const raw = getFromStorage<unknown[]>(ARCHIVE_KEY, []);
  if (!Array.isArray(raw)) return [];
  const out: ArchivedSession[] = [];
  for (const item of raw) {
    const s = normalizeSession(item);
    if (s) out.push(s);
  }
  out.sort((a, b) => b.createdAt - a.createdAt);
  return out;
}

export function getArchivedSessionsForDocument(
  documentId: string
): ArchivedSession[] {
  return getArchivedSessions().filter((s) => s.documentId === documentId);
}

export function getArchivedSession(id: string): ArchivedSession | null {
  return getArchivedSessions().find((s) => s.id === id) ?? null;
}

/**
 * Save or overwrite an archived session (by id). Trims oldest entries if the
 * archive exceeds MAX_ARCHIVE_ENTRIES.
 */
export function saveArchivedSession(session: ArchivedSession): void {
  const sessions = getArchivedSessions();
  const existingIdx = sessions.findIndex((s) => s.id === session.id);
  if (existingIdx >= 0) {
    sessions[existingIdx] = session;
  } else {
    sessions.unshift(session);
  }
  // Resort and cap
  sessions.sort((a, b) => b.createdAt - a.createdAt);
  const trimmed = sessions.slice(0, MAX_ARCHIVE_ENTRIES);
  setToStorage(ARCHIVE_KEY, trimmed);
}

export function deleteArchivedSession(id: string): void {
  const sessions = getArchivedSessions();
  setToStorage(
    ARCHIVE_KEY,
    sessions.filter((s) => s.id !== id)
  );
}

export function deleteArchivedSessionsForDocument(documentId: string): void {
  const sessions = getArchivedSessions();
  setToStorage(
    ARCHIVE_KEY,
    sessions.filter((s) => s.documentId !== documentId)
  );
}
