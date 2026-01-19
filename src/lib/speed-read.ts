import { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';

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
 * Navigate to speed reader for full document
 */
export function navigateToDocumentSpeedRead(
  router: AppRouterInstance,
  documentId: string,
  returnPath?: string
) {
  if (returnPath) {
    sessionStorage.setItem('glyph:speedread-return', returnPath);
  }

  router.push(`/speed-read?documentId=${documentId}`);
}
