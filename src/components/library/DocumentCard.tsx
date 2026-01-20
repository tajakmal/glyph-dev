'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import type { DocumentMeta } from '@/types';

interface DocumentCardProps {
  document: DocumentMeta;
  onDelete: (id: string) => void;
  onRename: (id: string, newTitle: string) => void;
}

export function DocumentCard({ document, onDelete, onRename }: DocumentCardProps) {
  const router = useRouter();
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 });
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(document.title);

  const handleClick = () => {
    router.push(`/reader/${document.id}`);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenuPos({ x: e.clientX, y: e.clientY });
    setShowContextMenu(true);
  };

  const handleRenameSubmit = () => {
    if (renameValue.trim() && renameValue !== document.title) {
      onRename(document.id, renameValue.trim());
    }
    setIsRenaming(false);
  };

  const formatFileSize = (bytes?: number) => {
    if (typeof bytes !== 'number' || Number.isNaN(bytes)) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <>
      <div
        className="
          w-[200px] rounded-xl bg-zinc-900 border border-zinc-800
          cursor-pointer transition-all duration-200
          hover:scale-[1.02] hover:shadow-lg hover:border-red-500/50
        "
        onClick={handleClick}
        onContextMenu={handleContextMenu}
      >
        {/* Thumbnail */}
        <div className="relative aspect-[0.714] bg-zinc-800 rounded-t-xl overflow-hidden">
          {document.thumbnailDataUrl ? (
            <Image
              src={document.thumbnailDataUrl}
              alt={document.title}
              fill
              className="object-cover"
              unoptimized
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-zinc-600">
              <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="p-3">
          {isRenaming ? (
            <input
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={handleRenameSubmit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRenameSubmit();
                if (e.key === 'Escape') setIsRenaming(false);
              }}
              className="w-full bg-zinc-800 text-zinc-100 text-sm font-medium rounded px-2 py-1"
              autoFocus
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <h3 className="text-zinc-100 text-sm font-medium truncate" title={document.title}>
              {document.title}
            </h3>
          )}
          <p className="text-zinc-500 text-xs mt-1">
            {document.pageCount} pages • {formatFileSize(document.fileSize)}
          </p>
          <p className="text-zinc-600 text-xs mt-0.5">
            Last read: p.{document.lastReadPage}
          </p>
        </div>
      </div>

      {/* Context Menu */}
      {showContextMenu && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowContextMenu(false)}
          />
          <div
            className="fixed z-50 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl py-1 min-w-[160px]"
            style={{ left: contextMenuPos.x, top: contextMenuPos.y }}
          >
            <button
              className="w-full px-4 py-2 text-left text-sm text-zinc-200 hover:bg-zinc-700"
              onClick={(e) => {
                e.stopPropagation();
                setShowContextMenu(false);
                router.push(`/reader/${document.id}`);
              }}
            >
              Open
            </button>
            <button
              className="w-full px-4 py-2 text-left text-sm text-zinc-200 hover:bg-zinc-700"
              onClick={(e) => {
                e.stopPropagation();
                setShowContextMenu(false);
                router.push(`/speed-read?documentId=${document.id}`);
              }}
            >
              Speed Read
            </button>
            <button
              className="w-full px-4 py-2 text-left text-sm text-zinc-200 hover:bg-zinc-700"
              onClick={(e) => {
                e.stopPropagation();
                setShowContextMenu(false);
                setIsRenaming(true);
              }}
            >
              Rename
            </button>
            <hr className="my-1 border-zinc-700" />
            <button
              className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-zinc-700"
              onClick={(e) => {
                e.stopPropagation();
                setShowContextMenu(false);
                if (confirm('Delete this document? This cannot be undone.')) {
                  onDelete(document.id);
                }
              }}
            >
              Delete
            </button>
          </div>
        </>
      )}
    </>
  );
}
