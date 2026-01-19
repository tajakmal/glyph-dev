'use client';

import React, { useState } from 'react';
import { useDocumentLibrary } from '@/hooks/useDocumentLibrary';
import { UploadZone } from '@/components/library/UploadZone';
import { LibraryGrid } from '@/components/library/LibraryGrid';

export default function HomePage() {
  const { documents, isLoading, addDocument, removeDocument, updateDocument } = useDocumentLibrary();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFileSelect = async (file: File) => {
    setIsUploading(true);
    setUploadError(null);

    try {
      await addDocument(file);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Failed to upload file');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRename = (id: string, newTitle: string) => {
    updateDocument(id, { title: newTitle });
  };

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-zinc-100 tracking-tight">GLYPH</h1>
          <p className="text-zinc-500 mt-2">Speed reading, one word at a time</p>
        </header>

        {/* Upload Zone */}
        <section className="mb-8">
          <UploadZone
            onFileSelect={handleFileSelect}
            isUploading={isUploading}
            error={uploadError}
          />
        </section>

        {/* Library */}
        <section>
          <h2 className="text-lg font-medium text-zinc-300 mb-4">
            Your Library {documents.length > 0 && `(${documents.length} documents)`}
          </h2>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="spinner w-8 h-8 border-2 border-zinc-600 border-t-red-500 rounded-full" />
            </div>
          ) : (
            <LibraryGrid
              documents={documents}
              onDelete={removeDocument}
              onRename={handleRename}
            />
          )}
        </section>
      </div>
    </main>
  );
}
