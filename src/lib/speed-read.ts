import { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';

/**
 * Session storage key for speed read state.
 * Used to return to the exact word position after speed reading.
 */
export const SPEEDREAD_SESSION_KEY = 'glyph:speedread-session';

/**
 * Speed read session state for returning to document.
 */
export interface SpeedReadSession {
  documentId: string;
  kind: 'pdf' | 'text';
  wordIndex: number;
}

/**
 * Get speed read session from sessionStorage.
 */
export function getSpeedReadSession(): SpeedReadSession | null {
  if (typeof window === 'undefined') return null;

  try {
    const stored = sessionStorage.getItem(SPEEDREAD_SESSION_KEY);
    if (!stored) return null;
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

/**
 * Save speed read session to sessionStorage.
 */
export function saveSpeedReadSession(session: SpeedReadSession): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(SPEEDREAD_SESSION_KEY, JSON.stringify(session));
}

/**
 * Clear speed read session from sessionStorage.
 */
export function clearSpeedReadSession(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(SPEEDREAD_SESSION_KEY);
}

/**
 * Navigate to speed reader with text
 * Uses URL params for small text (<2000 chars), sessionStorage for larger
 */
export function navigateToSpeedRead(
  router: AppRouterInstance,
  text: string,
  options?: {
    returnPath?: string;
    documentId?: string;
  }
) {
  // Store return path
  if (options?.returnPath) {
    sessionStorage.setItem('glyph:speedread-return', options.returnPath);
  }

  // Small text: use URL params
  if (text.length < 2000) {
    router.push(`/speed-read?text=${encodeURIComponent(text)}`);
    return;
  }

  // Large text: use sessionStorage
  sessionStorage.setItem('glyph:speedread-text', text);
  router.push('/speed-read?source=session');
}

/**
 * Navigate to speed reader for full document.
 * Optionally start at a specific word index.
 */
export function navigateToDocumentSpeedRead(
  router: AppRouterInstance,
  documentId: string,
  options?: {
    returnPath?: string;
    startWordIndex?: number;
    kind?: 'pdf' | 'text';
  }
) {
  if (options?.returnPath) {
    sessionStorage.setItem('glyph:speedread-return', options.returnPath);
  }

  let url = `/speed-read?documentId=${documentId}`;

  if (options?.startWordIndex !== undefined && options.startWordIndex > 0) {
    url += `&startIndex=${options.startWordIndex}`;
  }

  if (options?.kind) {
    url += `&kind=${options.kind}`;
  }

  router.push(url);
}
