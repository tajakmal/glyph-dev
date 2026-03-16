'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import type { DocumentMeta } from '@/types';

function formatRelativeTime(timestamp: number | undefined, now: number): string | null {
  if (!timestamp) return null;
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

interface DocumentCardProps {
  document: DocumentMeta;
  onDelete: (id: string) => void;
  onRename: (id: string, newTitle: string) => void;
}

export function DocumentCard({ document, onDelete, onRename }: DocumentCardProps) {
  const router = useRouter();
  const [showMenu, setShowMenu] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(document.title);

  const handleClick = () => {
    router.push(`/reader/${document.id}`);
  };

  const handleMenuToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu((prev) => !prev);
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

  const progressPercent = document.readingProgress != null
    ? Math.round(document.readingProgress * 100)
    : null;
  const hasProgress = progressPercent !== null && progressPercent > 0;

  // lastReadAt is computed from props only — the `now` value is passed from parent
  // or we accept slight staleness since cards re-mount on navigation
  const [lastReadLabel] = useState(() => formatRelativeTime(document.lastReadAt, Date.now()));

  return (
    <div className="relative">
      <div
        className="
          group w-full rounded-xl bg-zinc-900 border border-zinc-800
          cursor-pointer transition-all duration-200
          hover:scale-[1.02] hover:shadow-lg hover:border-red-500/50
        "
        onClick={handleClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleClick();
          }
        }}
        aria-label={`Open ${document.title}`}
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
              {document.kind === 'text' ? (
                <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 6h16M4 12h16M4 18h12" />
                </svg>
              ) : (
                <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              )}
            </div>
          )}
          {/* Menu button */}
          <button
            onClick={handleMenuToggle}
            className="absolute top-1.5 right-1.5 p-1.5 rounded-lg bg-black/40 text-white sm:opacity-0 sm:group-hover:opacity-100 transition-opacity hover:bg-black/60 z-10"
            aria-label="Document options"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="5" r="2" />
              <circle cx="12" cy="12" r="2" />
              <circle cx="12" cy="19" r="2" />
            </svg>
          </button>
          {/* Text badge for text documents */}
          {document.kind === 'text' && (
            <div className="absolute top-2 left-2 bg-zinc-700/90 text-zinc-300 text-xs font-medium px-2 py-0.5 rounded">
              Text
            </div>
          )}
          {/* Reading progress bar */}
          {hasProgress && (
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-zinc-700/50">
              <div
                className="h-full bg-orange-400/80 transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
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
          {document.kind === 'text' ? (
            <>
              <p className="text-zinc-500 text-xs mt-1">
                {document.wordCount ?? 0} {document.wordCount === 1 ? 'word' : 'words'}
                {hasProgress && <span className="text-orange-400/70"> • {progressPercent}%</span>}
              </p>
              {lastReadLabel ? (
                <p className="text-zinc-600 text-xs mt-0.5">{lastReadLabel}</p>
              ) : (
                <p className="text-zinc-600 text-xs mt-0.5 truncate" title={document.textPreview || 'No preview'}>
                  {document.textPreview || 'No preview'}
                </p>
              )}
            </>
          ) : (
            <>
              <p className="text-zinc-500 text-xs mt-1">
                {document.pageCount} pages • {formatFileSize(document.fileSize)}
                {hasProgress && <span className="text-orange-400/70"> • {progressPercent}%</span>}
              </p>
              <p className="text-zinc-600 text-xs mt-0.5">
                {lastReadLabel || `Last read: p.${document.lastReadPage}`}
              </p>
            </>
          )}
        </div>
      </div>

      {/* Dropdown Menu */}
      {showMenu && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowMenu(false)}
          />
          <div className="absolute right-0 top-0 z-50 mt-8 mr-1 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl py-1 min-w-[140px]">
            <button
              className="w-full px-3 py-2 text-left text-sm text-zinc-200 hover:bg-zinc-700 flex items-center gap-2"
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(false);
                router.push(`/reader/${document.id}`);
              }}
            >
              <svg className="w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              Open
            </button>
            <button
              className="w-full px-3 py-2 text-left text-sm text-zinc-200 hover:bg-zinc-700 flex items-center gap-2"
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(false);
                router.push(`/reader/${document.id}?mode=speed-read`);
              }}
            >
              <svg className="w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Speed Read
            </button>
            <button
              className="w-full px-3 py-2 text-left text-sm text-zinc-200 hover:bg-zinc-700 flex items-center gap-2"
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(false);
                setIsRenaming(true);
              }}
            >
              <svg className="w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Rename
            </button>
            <hr className="my-1 border-zinc-700" />
            <button
              className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-zinc-700 flex items-center gap-2"
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(false);
                if (confirm('Delete this document? This cannot be undone.')) {
                  onDelete(document.id);
                }
              }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
}
