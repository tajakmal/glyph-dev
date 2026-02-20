'use client';

import React, { useState, useMemo } from 'react';
import { useDocumentLibrary } from '@/hooks/useDocumentLibrary';
import { UploadZone } from '@/components/library/UploadZone';
import { LibraryGrid } from '@/components/library/LibraryGrid';
import { tokenize } from '@/lib/tokenize';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { getFeatureFlag } from '@/lib/feature-flags';
import { trackEvent } from '@/lib/telemetry';

export default function HomePage() {
  const { documents, isLoading, addDocument, addTextDocument, removeDocument, updateDocument } = useDocumentLibrary();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [kindFilter, setKindFilter] = useState<'all' | 'pdf' | 'text'>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'title' | 'added'>('recent');

  // Paste Text panel state
  const [textTitle, setTextTitle] = useState('');
  const [textContent, setTextContent] = useState('');
  const [isSavingText, setIsSavingText] = useState(false);
  const isLibrarySearchEnabled = getFeatureFlag('library_search_enabled');

  // Compute word count for the pasted text
  const wordCount = useMemo(() => {
    return tokenize(textContent).length;
  }, [textContent]);

  const filteredDocuments = useMemo(() => {
    let next = [...documents];
    const normalizedQuery = searchQuery.trim().toLowerCase();

    if (kindFilter !== 'all') {
      next = next.filter((doc) => doc.kind === kindFilter);
    }

    if (normalizedQuery.length > 0) {
      next = next.filter((doc) => {
        const haystack = `${doc.title} ${doc.fileName || ''} ${doc.textPreview || ''}`.toLowerCase();
        return haystack.includes(normalizedQuery);
      });
    }

    next.sort((a, b) => {
      if (sortBy === 'title') {
        return a.title.localeCompare(b.title);
      }
      if (sortBy === 'added') {
        return b.addedAt - a.addedAt;
      }
      return b.lastOpenedAt - a.lastOpenedAt;
    });

    return next;
  }, [documents, searchQuery, kindFilter, sortBy]);

  // Check if save button should be disabled (empty or whitespace only)
  const isSaveDisabled = textContent.trim().length === 0 || isSavingText;

  const handleFileSelect = async (file: File) => {
    setIsUploading(true);
    setUploadError(null);

    try {
      await addDocument(file);
      trackEvent('library_upload_success', {
        kind: 'pdf',
        sizeBytes: file.size,
      });
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Failed to upload file');
      trackEvent('library_upload_failed', {
        kind: 'pdf',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleRename = (id: string, newTitle: string) => {
    updateDocument(id, { title: newTitle });
  };

  const handleSaveText = async () => {
    setIsSavingText(true);
    try {
      await addTextDocument({
        title: textTitle.trim() || undefined,
        content: textContent,
      });
      trackEvent('library_text_saved', {
        kind: 'text',
        words: wordCount,
      });
      // Clear inputs after save
      setTextTitle('');
      setTextContent('');
    } finally {
      setIsSavingText(false);
    }
  };

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <header className="relative text-center mb-8">
          <div className="absolute right-0 top-0">
            <ThemeToggle />
          </div>
          <h1 className="text-4xl font-bold text-zinc-100 tracking-tight">GLYPH</h1>
          <p className="text-zinc-500 mt-2">Speed reading, one word at a time</p>
        </header>

        {/* Upload Zone and Paste Text */}
        <section className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* PDF Upload */}
          <UploadZone
            onFileSelect={handleFileSelect}
            isUploading={isUploading}
            error={uploadError}
          />

          {/* Paste Text Panel */}
          <div className="rounded-2xl border border-zinc-700 bg-zinc-900 p-4">
            <div className="flex flex-col h-full">
              <input
                type="text"
                placeholder="Title (optional)"
                value={textTitle}
                onChange={(e) => setTextTitle(e.target.value)}
                className="w-full bg-zinc-800 text-zinc-100 text-sm rounded-lg px-3 py-2 mb-3 border border-zinc-700 focus:outline-none focus:border-red-500/50 placeholder:text-zinc-500"
              />
              <textarea
                placeholder="Paste your text here..."
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                className="flex-1 min-h-[80px] w-full bg-zinc-800 text-zinc-100 text-sm rounded-lg px-3 py-2 mb-3 border border-zinc-700 focus:outline-none focus:border-red-500/50 placeholder:text-zinc-500 resize-none"
              />
              <div className="flex items-center justify-between">
                <span className="text-zinc-500 text-xs">
                  {wordCount} {wordCount === 1 ? 'word' : 'words'}
                </span>
                <button
                  onClick={handleSaveText}
                  disabled={isSaveDisabled}
                  className={`
                    px-4 py-1.5 text-sm font-medium rounded-lg transition-colors
                    ${isSaveDisabled
                      ? 'bg-zinc-700 text-zinc-500 cursor-not-allowed'
                      : 'bg-red-600 text-white hover:bg-red-500'
                    }
                  `}
                >
                  {isSavingText ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Library */}
        <section>
          <h2 className="text-lg font-medium text-zinc-300 mb-4">
            Your Library {documents.length > 0 && `(${filteredDocuments.length}/${documents.length} documents)`}
          </h2>

          {isLibrarySearchEnabled && (
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search title, filename, or preview..."
                className="w-full md:flex-1 bg-zinc-900 text-zinc-100 text-sm rounded-lg px-3 py-2 border border-zinc-700 focus:outline-none focus:border-red-500/50 placeholder:text-zinc-500"
                aria-label="Search your library"
              />
              <select
                value={kindFilter}
                onChange={(e) => setKindFilter(e.target.value as 'all' | 'pdf' | 'text')}
                className="bg-zinc-900 text-zinc-100 text-sm rounded-lg px-3 py-2 border border-zinc-700 focus:outline-none focus:border-red-500/50"
                aria-label="Filter library by document type"
              >
                <option value="all">All types</option>
                <option value="pdf">PDF</option>
                <option value="text">Text</option>
              </select>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'recent' | 'title' | 'added')}
                className="bg-zinc-900 text-zinc-100 text-sm rounded-lg px-3 py-2 border border-zinc-700 focus:outline-none focus:border-red-500/50"
                aria-label="Sort library"
              >
                <option value="recent">Sort: Last opened</option>
                <option value="added">Sort: Recently added</option>
                <option value="title">Sort: Title</option>
              </select>
            </div>
          )}

          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="spinner w-8 h-8 border-2 border-zinc-600 border-t-red-500 rounded-full" />
            </div>
          ) : filteredDocuments.length === 0 && documents.length > 0 ? (
            <div className="text-center py-12 text-zinc-500">
              <p>No documents match your filters.</p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setKindFilter('all');
                  setSortBy('recent');
                }}
                className="mt-3 px-3 py-1.5 text-sm bg-zinc-800 text-zinc-200 rounded-lg hover:bg-zinc-700 transition-colors"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <LibraryGrid
              documents={filteredDocuments}
              onDelete={removeDocument}
              onRename={handleRename}
            />
          )}
        </section>
      </div>
    </main>
  );
}
