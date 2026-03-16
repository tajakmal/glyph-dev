'use client';

import React, { useRef, useEffect } from 'react';
import type { PDFPageProxy } from 'pdfjs-dist';
import type { TextLayer as TextLayerType } from 'pdfjs-dist';
import type { SearchMatch } from '@/types';
import { getTextContent } from '@/lib/pdf-utils';
import { tokenize } from '@/lib/tokenize';

interface PDFTextLayerProps {
  /** PDF page proxy */
  page: PDFPageProxy;
  /** Current zoom level */
  zoom: number;
  /** Callback when text is selected */
  onTextSelect?: (selection: TextSelection) => void;
  /** Search matches for this page */
  searchMatches?: SearchMatch[];
  /** Index of the active match (global index across all pages) */
  activeMatchIndex?: number;
  /** All matches (to calculate if this page has active match) */
  allMatches?: SearchMatch[];
}

export interface TextSelection {
  /** Selected text content */
  text: string;
  /** Page number (1-based) */
  page: number;
  /** Bounding rectangles of selection (page coordinates) */
  rects: DOMRect[];
  /** Range object for the selection */
  range: Range | null;
  /** Word index on the page where selection starts (0-based, optional) */
  startWordOnPage?: number;
}

// Helper function to escape HTML (prevents XSS)
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export function PDFTextLayer({
  page,
  zoom,
  onTextSelect,
  searchMatches = [],
  activeMatchIndex = -1,
  allMatches = [],
}: PDFTextLayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textLayerRef = useRef<TextLayerType | null>(null);
  // Store full page text for word index calculation fallback
  const pageTextRef = useRef<string>('');

  // Calculate the active match for this page
  const pageIndex = page.pageNumber - 1;
  const activeMatch = allMatches[activeMatchIndex];
  const activeMatchOnThisPage = activeMatch?.pageIndex === pageIndex ? activeMatch : null;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let isMounted = true;

    const renderTextLayer = async () => {
      // Cancel previous text layer if any
      if (textLayerRef.current) {
        textLayerRef.current.cancel();
        textLayerRef.current = null;
      }

      // Clear existing content
      container.innerHTML = '';

      // Dynamically import TextLayer to avoid SSR issues (DOMMatrix not available on server)
      const { TextLayer } = await import('pdfjs-dist');

      // Get text content from PDF
      const textContent = await getTextContent(page);
      if (!isMounted) return;

      // Store full page text for fallback word index calculation
      pageTextRef.current = textContent.items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ');

      // Get viewport
      const viewport = page.getViewport({ scale: zoom });

      // Use pdfjs-dist's built-in TextLayer for pixel-perfect positioning
      const textLayer = new TextLayer({
        textContentSource: textContent,
        container,
        viewport,
      });
      textLayerRef.current = textLayer;

      await textLayer.render();
      if (!isMounted) return;

      // --- Post-process: add word-level attributes and sub-spans ---
      // CRITICAL: Tokenize the full joined page text (same method as buildPageWordCounts)
      // to ensure word indices are consistent with the speed reader's word indexing.
      const fullPageText = pageTextRef.current;
      const allPageWords = tokenize(fullPageText);

      // Build a map: for each word in allPageWords, find its character position
      // in the fullPageText so we can match it to the correct text div.
      const wordCharPositions: { word: string; charStart: number }[] = [];
      {
        let searchFrom = 0;
        for (const word of allPageWords) {
          const idx = fullPageText.indexOf(word, searchFrom);
          wordCharPositions.push({ word, charStart: idx >= 0 ? idx : searchFrom });
          searchFrom = (idx >= 0 ? idx : searchFrom) + word.length;
        }
      }

      // Map words to divs by tracking character ranges per div.
      // Each text item contributes its str length + 1 (for the space join separator).
      let divCharStart = 0;
      const divRanges: { start: number; end: number; divIndex: number }[] = [];
      textLayer.textContentItemsStr.forEach((str, i) => {
        const len = str.length;
        divRanges.push({ start: divCharStart, end: divCharStart + len, divIndex: i });
        divCharStart += len + 1; // +1 for the space separator in join(' ')
      });

      // Assign words to divs
      const divWords: Map<number, { wordIndex: number; word: string }[]> = new Map();
      wordCharPositions.forEach(({ word, charStart }, globalIdx) => {
        // Find which div this word belongs to
        for (const range of divRanges) {
          if (charStart >= range.start && charStart < range.end) {
            if (!divWords.has(range.divIndex)) {
              divWords.set(range.divIndex, []);
            }
            divWords.get(range.divIndex)!.push({ wordIndex: globalIdx, word });
            break;
          }
        }
      });

      // Apply word spans to each div
      textLayer.textDivs.forEach((div, index) => {
        const words = divWords.get(index);
        if (!words || words.length === 0) return;

        div.dataset.wordStart = String(words[0].wordIndex);
        div.dataset.wordEnd = String(words[words.length - 1].wordIndex);

        // Replace div content with per-word sub-spans
        const originalText = div.textContent || '';
        div.textContent = '';

        let charPos = 0;
        words.forEach(({ wordIndex, word }) => {
          const wordStart = originalText.indexOf(word, charPos);

          // Add leading whitespace as text node
          if (wordStart > charPos) {
            div.appendChild(document.createTextNode(originalText.slice(charPos, wordStart)));
          }

          // Create word span
          const wordSpan = document.createElement('span');
          wordSpan.textContent = word;
          wordSpan.dataset.wordIndex = String(wordIndex);
          wordSpan.style.display = 'inline';
          div.appendChild(wordSpan);

          charPos = (wordStart >= 0 ? wordStart : charPos) + word.length;
        });

        // Add trailing text
        if (charPos < originalText.length) {
          div.appendChild(document.createTextNode(originalText.slice(charPos)));
        }
      });

      // --- Post-process: apply search highlighting ---
      if (searchMatches.length > 0) {
        applySearchHighlights(textLayer, searchMatches, activeMatchOnThisPage);
      }
    };

    renderTextLayer();

    return () => {
      isMounted = false;
      if (textLayerRef.current) {
        textLayerRef.current.cancel();
        textLayerRef.current = null;
      }
    };
  }, [page, zoom, searchMatches, activeMatchOnThisPage]);

  // Handle selection events (mouseup + touchend for mobile)
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !onTextSelect) return;

    const handleSelectionEnd = () => {
      // Small delay for touch to let browser selection settle
      requestAnimationFrame(() => {
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed) return;

        const text = selection.toString().trim();
        if (!text) return;

        const range = selection.getRangeAt(0);
        if (!container.contains(range.commonAncestorContainer)) return;

        // Get bounding rects
        const rects = Array.from(range.getClientRects());
        const containerRect = container.getBoundingClientRect();
        const pageRects = rects.map(rect => new DOMRect(
          rect.x - containerRect.x,
          rect.y - containerRect.y,
          rect.width,
          rect.height
        ));

        // Calculate startWordOnPage from word sub-spans
        let startWordOnPage: number | undefined = undefined;

        // Try to find the word span at the selection start
        let startElement: Element | null = null;
        if (range.startContainer.nodeType === Node.TEXT_NODE) {
          startElement = range.startContainer.parentElement;
        } else {
          startElement = range.startContainer as Element;
        }

        // Check if we're inside a word sub-span
        const wordSpan = startElement?.closest?.('span[data-word-index]') as HTMLSpanElement | null;
        if (wordSpan) {
          startWordOnPage = parseInt(wordSpan.dataset.wordIndex || '', 10);
          if (!Number.isFinite(startWordOnPage)) startWordOnPage = undefined;
        }

        // Fallback: check parent div's word-start attribute
        if (startWordOnPage === undefined) {
          const parentDiv = startElement?.closest?.('span[data-word-start], div[data-word-start]') as HTMLElement | null;
          if (parentDiv) {
            const spanWordStart = parseInt(parentDiv.dataset.wordStart || '', 10);
            if (Number.isFinite(spanWordStart)) {
              // Count words in prefix text
              let localPrefix = '';
              if (range.startContainer.nodeType === Node.TEXT_NODE) {
                localPrefix = range.startContainer.textContent?.slice(0, range.startOffset) || '';
              }
              const localOffset = tokenize(localPrefix).length;
              startWordOnPage = spanWordStart + localOffset;
            }
          }
        }

        // Final fallback: text search
        if (startWordOnPage === undefined && pageTextRef.current) {
          const selectionIndex = pageTextRef.current.indexOf(text);
          if (selectionIndex >= 0) {
            const textBeforeSelection = pageTextRef.current.substring(0, selectionIndex);
            startWordOnPage = tokenize(textBeforeSelection).length;
          }
        }

        onTextSelect({
          text,
          page: page.pageNumber,
          rects: pageRects,
          range: range.cloneRange(),
          startWordOnPage,
        });
      });
    };

    container.addEventListener('mouseup', handleSelectionEnd);
    container.addEventListener('touchend', handleSelectionEnd);
    return () => {
      container.removeEventListener('mouseup', handleSelectionEnd);
      container.removeEventListener('touchend', handleSelectionEnd);
    };
  }, [page, onTextSelect]);

  return (
    <div
      ref={containerRef}
      className="textLayer"
      data-testid={`pdf-text-layer-${page.pageNumber}`}
    />
  );
}

/**
 * Apply search highlighting to the already-rendered text layer divs.
 * Injects <mark> elements for search matches.
 */
function applySearchHighlights(
  textLayer: TextLayerType,
  searchMatches: SearchMatch[],
  activeMatchOnThisPage: SearchMatch | null | undefined,
) {
  let charPosition = 0;

  textLayer.textDivs.forEach((div, index) => {
    const text = textLayer.textContentItemsStr[index];
    if (!text) {
      return;
    }

    const itemStart = charPosition;
    const itemEnd = charPosition + text.length;

    // Find matches that overlap with this text item
    const overlappingMatches = searchMatches.filter(match =>
      match.startIndex < itemEnd && match.endIndex > itemStart
    );

    if (overlappingMatches.length > 0) {
      // Need to rebuild the div content with search highlights
      // Save word spans data first
      const wordSpans = Array.from(div.querySelectorAll('span[data-word-index]'));
      const wordData = wordSpans.map(span => ({
        wordIndex: span.getAttribute('data-word-index'),
        text: span.textContent || '',
      }));

      // Build highlighted HTML
      let html = '';
      let lastIndex = 0;

      for (const match of overlappingMatches) {
        const relStart = Math.max(0, match.startIndex - itemStart);
        const relEnd = Math.min(text.length, match.endIndex - itemStart);

        if (relStart > lastIndex) {
          html += escapeHtml(text.slice(lastIndex, relStart));
        }

        const isActive = activeMatchOnThisPage?.matchIndex === match.matchIndex;
        const activeClass = isActive ? ' search-match-active' : '';
        html += `<mark class="pdf-search-highlight${activeClass}">${escapeHtml(text.slice(relStart, relEnd))}</mark>`;
        lastIndex = relEnd;
      }

      if (lastIndex < text.length) {
        html += escapeHtml(text.slice(lastIndex));
      }

      div.innerHTML = html;

      // Re-apply word index data attributes to the div (sub-spans are lost but div-level data preserved)
      // Word-level spans get rebuilt on next non-search render
      if (wordData.length > 0) {
        div.dataset.wordStart = wordData[0].wordIndex || '';
        div.dataset.wordEnd = wordData[wordData.length - 1].wordIndex || '';
      }
    }

    charPosition += text.length;
  });
}
