'use client';

import React from 'react';
import type { DocumentMeta } from '@/types';
import { DocumentCard } from './DocumentCard';

interface LibraryGridProps {
  documents: DocumentMeta[];
  onDelete: (id: string) => void;
  onRename: (id: string, newTitle: string) => void;
}

export function LibraryGrid({ documents, onDelete, onRename }: LibraryGridProps) {
  if (documents.length === 0) {
    return (
      <div className="text-center py-12 text-zinc-500">
        <p>No documents yet.</p>
        <p className="text-sm mt-1">Upload a PDF or paste text to get started.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      {documents.map((doc) => (
        <DocumentCard
          key={doc.id}
          document={doc}
          onDelete={onDelete}
          onRename={onRename}
        />
      ))}
    </div>
  );
}
