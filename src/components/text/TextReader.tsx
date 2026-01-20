'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { DocumentMeta } from '@/types';
import { getDocument, getText, updateLastOpened, deleteDocumentComplete } from '@/lib/storage';

interface TextReaderProps {
  documentId: string;
}

type SidebarTab = 'bookmarks' | 'notes';

export function TextReader({ documentId }: TextReaderProps) {
  const router = useRouter();
  const [meta, setMeta] = useState<DocumentMeta | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window === 'undefined') return true;
    const stored = localStorage.getItem('glyph:sidebar-open');
    return stored !== null ? JSON.parse(stored) : true;
  });
  const [activeTab, setActiveTab] = useState<SidebarTab>('bookmarks');
  const [isBookmarked, setIsBookmarked] = useState(false);

  // Persist sidebar state
  useEffect(() => {
    localStorage.setItem('glyph:sidebar-open', JSON.stringify(sidebarOpen));
  }, [sidebarOpen]);

  // Load document metadata and content
  useEffect(() => {
    async function loadDocument() {
      setIsLoading(true);
      setError(null);

      try {
        // Get document metadata
        const docMeta = getDocument(documentId);
        if (!docMeta) {
          setError('Document not found');
          setIsLoading(false);
          return;
        }

        setMeta(docMeta);

        // Update lastOpenedAt
        updateLastOpened(documentId);

        // Get text content from IndexedDB
        const content = await getText(documentId);
        if (content === null) {
          setError('Text content not found');
          setIsLoading(false);
          return;
        }

        setTextContent(content);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load document');
      } finally {
        setIsLoading(false);
      }
    }

    loadDocument();
  }, [documentId]);

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((prev: boolean) => !prev);
  }, []);

  const handleNavigateHome = useCallback(() => {
    router.push('/');
  }, [router]);

  const handleDelete = useCallback(async () => {
    await deleteDocumentComplete(documentId);
    router.push('/');
  }, [documentId, router]);

  const handleSpeedRead = useCallback(() => {
    // Placeholder - will be implemented in a later task
  }, []);

  const handleBookmarkToggle = useCallback(() => {
    // Placeholder - will be implemented in a later task
    setIsBookmarked(prev => !prev);
  }, []);

  // Keyboard shortcut for sidebar toggle
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.key === 's' || e.key === 'S') {
        toggleSidebar();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleSidebar]);

  // Document title
  const documentTitle = meta?.title || 'Untitled Document';

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col h-full bg-zinc-950">
        <div className="flex items-center justify-center h-full">
          <div className="spinner w-8 h-8 border-2 border-zinc-600 border-t-red-500 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  // Error state: document not found
  if (error === 'Document not found') {
    return (
      <div className="flex flex-col h-full bg-zinc-950">
        <div className="flex flex-col items-center justify-center h-full text-zinc-400">
          <svg className="w-16 h-16 mb-4 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-lg mb-2">Document not found</p>
          <p className="text-sm text-zinc-500 mb-6">This document may have been deleted.</p>
          <button
            onClick={handleNavigateHome}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg transition-colors"
          >
            Back to Library
          </button>
        </div>
      </div>
    );
  }

  // Error state: text content missing
  if (error === 'Text content not found') {
    return (
      <div className="flex flex-col h-full bg-zinc-950">
        <div className="flex flex-col items-center justify-center h-full text-zinc-400">
          <svg className="w-16 h-16 mb-4 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <p className="text-lg mb-2">Text content not found</p>
          <p className="text-sm text-zinc-500 mb-6">The content for this document is missing from storage.</p>
          <button
            onClick={handleDelete}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
          >
            Delete Document
          </button>
        </div>
      </div>
    );
  }

  // Generic error state
  if (error) {
    return (
      <div className="flex flex-col h-full bg-zinc-950">
        <div className="flex flex-col items-center justify-center h-full text-zinc-400">
          <svg className="w-16 h-16 mb-4 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <p className="text-lg mb-2">Failed to load document</p>
          <p className="text-sm text-zinc-500 mb-6">{error}</p>
          <button
            onClick={handleNavigateHome}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg transition-colors"
          >
            Back to Library
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Top Bar */}
      <div className="h-12 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between px-4">
        {/* Left: Sidebar toggle, Home button, and title */}
        <div className="flex items-center gap-3">
          <button
            onClick={toggleSidebar}
            className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors"
            aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <button
            onClick={handleNavigateHome}
            className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors"
            aria-label="Back to library"
            title="Back to Library"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </button>
          <span className="text-zinc-300 text-sm font-medium truncate max-w-[300px]" title={documentTitle}>
            {documentTitle}
          </span>
        </div>

        {/* Center: Position indicator placeholder */}
        <div className="flex items-center gap-2 text-zinc-500 text-sm">
          {/* Position indicator will be added in a later task */}
        </div>

        {/* Right: Speed Read, Bookmark */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleSpeedRead}
            className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors"
            aria-label="Speed read document"
            title="Speed read document"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </button>
          <button
            onClick={handleBookmarkToggle}
            className={`p-2 rounded-lg transition-colors ${
              isBookmarked
                ? 'text-red-500 bg-red-500/10'
                : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'
            }`}
            aria-label={isBookmarked ? 'Remove bookmark' : 'Bookmark this position'}
            aria-pressed={isBookmarked}
          >
            <svg className="w-5 h-5" fill={isBookmarked ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        {sidebarOpen && (
          <div className="w-[280px] h-full bg-zinc-900 border-r border-zinc-800 flex flex-col">
            {/* Sidebar Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800">
              <h2 className="text-zinc-200 text-sm font-medium truncate flex-1" title={documentTitle}>
                {documentTitle}
              </h2>
              <button
                onClick={toggleSidebar}
                className="p-1 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded"
                aria-label="Close sidebar"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                </svg>
              </button>
            </div>

            {/* Sidebar Tabs */}
            <div className="flex border-b border-zinc-800">
              <button
                onClick={() => setActiveTab('bookmarks')}
                className={`flex-1 py-2 text-sm transition-colors ${
                  activeTab === 'bookmarks'
                    ? 'text-red-500 border-b-2 border-red-500'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Bookmarks
              </button>
              <button
                onClick={() => setActiveTab('notes')}
                className={`flex-1 py-2 text-sm transition-colors ${
                  activeTab === 'notes'
                    ? 'text-red-500 border-b-2 border-red-500'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Notes
              </button>
            </div>

            {/* Sidebar Content */}
            <div className="flex-1 overflow-y-auto">
              {activeTab === 'bookmarks' && (
                <div className="p-4 text-zinc-500 text-sm text-center">
                  No bookmarks yet.
                  <br />
                  Use the bookmark button to save your position.
                </div>
              )}
              {activeTab === 'notes' && (
                <div className="p-4 text-zinc-500 text-sm text-center">
                  No notes yet.
                  <br />
                  Select text to add highlights and notes.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Text Content Area */}
        <div className="flex-1 overflow-auto bg-zinc-950">
          <div className="max-w-3xl mx-auto px-8 py-12">
            <div className="prose prose-invert prose-zinc max-w-none">
              {textContent?.split('\n').map((paragraph, index) => (
                <p key={index} className="text-zinc-300 text-base leading-relaxed mb-4 whitespace-pre-wrap">
                  {paragraph || '\u00A0'}
                </p>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
