/**
 * Type definitions for the Glyph PDF Reader application.
 * This file contains all TypeScript interfaces and type definitions used throughout the app.
 */

// =============================================================================
// Document & Library Types
// =============================================================================

export type DocumentKind = 'pdf' | 'text';

/**
 * Shared metadata for documents in the library.
 */
interface DocumentMetaBase {
  /** Unique identifier (UUID v4) */
  id: string;
  /** Display title (from PDF metadata or filename) */
  title: string;
  /** Document kind */
  kind: DocumentKind;
  /** Unix timestamp (ms) when added to library */
  addedAt: number;
  /** Unix timestamp (ms) when last opened */
  lastOpenedAt: number;
  /** Word count (text documents only) */
  wordCount?: number;
  /** Preview text (first ~160 chars, trimmed) */
  textPreview?: string;
  /** Original filename with extension (PDF docs) */
  fileName?: string;
  /** Total number of pages (PDF docs) */
  pageCount?: number;
  /** File size in bytes (PDF docs) */
  fileSize?: number;
  /** Last read page (1-based), for resume functionality */
  lastReadPage?: number;
  /** Base64 JPEG data URL of first page thumbnail */
  thumbnailDataUrl?: string;
  /** Last word index read (0-based), for speed read resume */
  lastWordIndex?: number;
  /** Reading progress (0-1) */
  readingProgress?: number;
  /** Total word count (cached for progress calculation) */
  totalWords?: number;
  /** Last used WPM for this document */
  speedReadWpm?: number;
  /** Unix timestamp (ms) of last reading session */
  lastReadAt?: number;
}

/**
 * Metadata for a PDF document in the library.
 * Stores information about the document for display and resume functionality.
 */
export interface PDFDocumentMeta extends DocumentMetaBase {
  kind: 'pdf';
  fileName: string;
  pageCount: number;
  fileSize: number;
  lastReadPage: number;
}

/**
 * Metadata for a text document in the library.
 */
export interface TextDocumentMeta extends DocumentMetaBase {
  kind: 'text';
}

export type DocumentMeta = PDFDocumentMeta | TextDocumentMeta;

// =============================================================================
// Bookmark Types
// =============================================================================

interface BookmarkBase {
  /** Unique identifier (UUID v4) */
  id: string;
  /** Foreign key to DocumentMeta.id */
  documentId: string;
  /** Optional user-defined label */
  label?: string;
  /** Unix timestamp (ms) when created */
  createdAt: number;
}

/**
 * A bookmark within a PDF document.
 * Allows users to save and quickly navigate to specific pages.
 */
export interface PDFBookmark extends BookmarkBase {
  kind: 'pdf';
  /** Page number (1-based) */
  page: number;
}

/**
 * A bookmark within a text document.
 */
export interface TextBookmark extends BookmarkBase {
  kind: 'text';
  /** Word index (0-based) */
  wordIndex: number;
  /** End word index (0-based, inclusive) — present for range bookmarks */
  endWordIndex?: number;
}

export type Bookmark = PDFBookmark | TextBookmark;

// =============================================================================
// Highlight Types
// =============================================================================

/**
 * Available colors for text highlights.
 */
export type HighlightColor = 'yellow' | 'green' | 'blue' | 'pink' | 'orange';

/**
 * Bounding rectangle for a highlight, using normalized coordinates.
 * All values are percentages (0-1) for zoom independence.
 */
export interface HighlightRect {
  /** X position as percentage of page width (0-1) */
  x: number;
  /** Y position as percentage of page height (0-1) */
  y: number;
  /** Width as percentage of page width (0-1) */
  width: number;
  /** Height as percentage of page height (0-1) */
  height: number;
}

interface HighlightBase {
  /** Unique identifier (UUID v4) */
  id: string;
  /** Foreign key to DocumentMeta.id */
  documentId: string;
  /** Highlight kind */
  kind: 'pdf' | 'text';
  /** Highlight color */
  color: HighlightColor;
  /** The highlighted text content */
  text: string;
  /** Optional user note/annotation */
  note?: string;
  /** Unix timestamp (ms) when created */
  createdAt: number;
  /** Unix timestamp (ms) when last modified */
  updatedAt?: number;
}

/**
 * A text highlight within a PDF document.
 * Includes the highlighted text, visual rectangles, and optional notes.
 */
export interface PDFHighlight extends HighlightBase {
  kind: 'pdf';
  /** Page number (1-based) */
  page: number;
  /** Bounding rectangles for the highlight (normalized coordinates) */
  rects: HighlightRect[];
}

/**
 * A text highlight within a text document.
 */
export interface TextHighlight extends HighlightBase {
  kind: 'text';
  /** Start word index (0-based) */
  startWord: number;
  /** End word index (0-based, inclusive) */
  endWord: number;
}

export type Highlight = PDFHighlight | TextHighlight;

// =============================================================================
// PDF Viewer State Types
// =============================================================================

/**
 * Current state of the PDF viewer UI.
 * Used to persist and restore viewer state between sessions.
 */
export interface PDFViewerState {
  /** Current zoom level (1 = 100%) */
  zoom: number;
  /** Current scroll position (pixels from top) */
  scrollTop: number;
  /** Current page in view (1-based) */
  currentPage: number;
  /** Sidebar visibility */
  sidebarOpen: boolean;
  /** Active sidebar tab */
  sidebarTab: 'contents' | 'bookmarks' | 'highlights';
  /** Search bar visibility */
  searchOpen: boolean;
  /** Current search query */
  searchQuery: string;
  /** Current search match index (0-based) */
  searchMatchIndex: number;
}

// =============================================================================
// Search Types
// =============================================================================

/**
 * A single search match result within a PDF document.
 */
export interface SearchMatch {
  /** Page index (0-based) */
  pageIndex: number;
  /** Match index within page */
  matchIndex: number;
  /** The matched text */
  text: string;
  /** Character start index in page text */
  startIndex: number;
  /** Character end index in page text */
  endIndex: number;
}

// =============================================================================
// PDF Outline Types
// =============================================================================

/**
 * An item in the PDF table of contents/outline.
 * Supports nested structure for sub-sections.
 */
export interface PDFOutlineItem {
  /** Section title */
  title: string;
  /** Destination page (1-based) */
  page: number;
  /** Nested items (for sub-sections) */
  items: PDFOutlineItem[];
}

// =============================================================================
// User Preferences Types
// =============================================================================

/**
 * User preferences for the application.
 * Persisted to localStorage for consistent experience across sessions.
 */
export interface UserPreferences {
  /** Default zoom level */
  defaultZoom: number;
  /** Default sidebar state (legacy — the mobile revamp no longer uses a sidebar) */
  defaultSidebarOpen: boolean;
  /** Show page numbers in viewer */
  showPageNumbers: boolean;
  /** Default WPM for speed reader */
  defaultWpm: number;
  /** Expressive pacing on punctuation / long words */
  expressivePacing: boolean;
  /** Auto-pause the speed reader when tab loses focus / interruption */
  autoPauseOnInterrupt: boolean;
  /** Speed-reader word mode */
  speedReadMode: 'single' | 'ghost';
  /** Reading font family for text reader body */
  readingFont: 'fraunces' | 'space-grotesk' | 'system';
  /** Text size multiplier for reader body */
  textSize: 'sm' | 'md' | 'lg';
}

// =============================================================================
// Storage Constants
// =============================================================================

/**
 * LocalStorage keys used by the application.
 * All keys are prefixed with 'glyph:' to avoid collisions.
 */
export const STORAGE_KEYS = {
  DOCUMENTS: 'glyph:documents',
  BOOKMARKS: 'glyph:bookmarks',
  HIGHLIGHTS: 'glyph:highlights',
  PREFERENCES: 'glyph:preferences',
  VIEWER_STATE: 'glyph:viewer-state',
} as const;

/**
 * IndexedDB configuration for storing PDF binary data.
 * Separate from localStorage due to size constraints.
 */
export const INDEXEDDB_CONFIG = {
  DB_NAME: 'glyph-db',
  DB_VERSION: 3,
  STORE_PDFS: 'pdfs',
  STORE_TEXTS: 'texts',
} as const;

// =============================================================================
// Validation Constants
// =============================================================================

/**
 * Validation rules and limits used throughout the application.
 */
export const VALIDATION = {
  /** Maximum file size in bytes (50MB) */
  MAX_FILE_SIZE: 50 * 1024 * 1024,
  /** Maximum length for highlight notes */
  MAX_NOTE_LENGTH: 2000,
  /** Maximum length for bookmark labels */
  MAX_LABEL_LENGTH: 100,
  /** Supported MIME types for upload */
  SUPPORTED_TYPES: ['application/pdf'],
  /** Minimum zoom level (50%) */
  MIN_ZOOM: 0.5,
  /** Maximum zoom level (300%) */
  MAX_ZOOM: 3.0,
  /** Zoom increment step */
  ZOOM_STEP: 0.25,
} as const;

// =============================================================================
// Highlight Color Map
// =============================================================================

/**
 * Color definitions for highlights.
 * Includes both background color (with transparency) and solid hex color.
 */
export const HIGHLIGHT_COLORS: Record<HighlightColor, { bg: string; hex: string }> = {
  yellow: { bg: 'rgba(253, 224, 71, 0.4)', hex: '#fde047' },
  green: { bg: 'rgba(134, 239, 172, 0.4)', hex: '#86efac' },
  blue: { bg: 'rgba(147, 197, 253, 0.4)', hex: '#93c5fd' },
  pink: { bg: 'rgba(249, 168, 212, 0.4)', hex: '#f9a8d4' },
  orange: { bg: 'rgba(253, 186, 116, 0.4)', hex: '#fdba74' },
};
