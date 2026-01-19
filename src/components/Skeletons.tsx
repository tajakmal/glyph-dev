'use client';

import React from 'react';

/**
 * Skeleton loader for document cards in the library grid.
 */
export function DocumentCardSkeleton() {
  return (
    <div className="w-[200px] rounded-xl bg-zinc-900 border border-zinc-800 animate-pulse">
      <div className="aspect-[0.714] bg-zinc-800 rounded-t-xl" />
      <div className="p-3 space-y-2">
        <div className="h-4 bg-zinc-800 rounded w-3/4" />
        <div className="h-3 bg-zinc-800 rounded w-1/2" />
      </div>
    </div>
  );
}

/**
 * Skeleton loader for sidebar content (outline, bookmarks, highlights).
 */
export function SidebarContentSkeleton() {
  return (
    <div className="p-3 space-y-3 animate-pulse">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="flex gap-2">
          <div className="w-4 h-4 bg-zinc-800 rounded flex-shrink-0" />
          <div className="flex-1 h-4 bg-zinc-800 rounded" />
        </div>
      ))}
    </div>
  );
}

/**
 * Skeleton loader for a PDF page placeholder.
 */
export function PageSkeleton({ height = 800 }: { height?: number }) {
  return (
    <div
      className="bg-zinc-800 animate-pulse rounded flex items-center justify-center"
      style={{ height, marginBottom: 16 }}
    >
      <div className="text-zinc-600 text-sm">Loading...</div>
    </div>
  );
}

/**
 * Skeleton loader for the PDF viewer initial state.
 */
export function PDFViewerSkeleton() {
  return (
    <div className="flex flex-col h-full">
      {/* Controls skeleton */}
      <div className="h-12 bg-zinc-900 border-b border-zinc-800 animate-pulse flex items-center px-4 gap-4">
        <div className="w-8 h-8 bg-zinc-800 rounded" />
        <div className="flex-1 h-4 bg-zinc-800 rounded max-w-xs" />
        <div className="flex gap-2">
          <div className="w-8 h-8 bg-zinc-800 rounded" />
          <div className="w-8 h-8 bg-zinc-800 rounded" />
          <div className="w-8 h-8 bg-zinc-800 rounded" />
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar skeleton */}
        <div className="w-64 bg-zinc-900 border-r border-zinc-800 animate-pulse">
          <SidebarContentSkeleton />
        </div>

        {/* Viewer area skeleton */}
        <div className="flex-1 flex flex-col items-center py-4 bg-zinc-900 overflow-auto">
          <PageSkeleton />
          <PageSkeleton />
          <PageSkeleton />
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton loader for list items (used in sidebar lists).
 */
export function ListItemSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-2 animate-pulse">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex items-center gap-2 p-2">
          <div className="w-4 h-4 bg-zinc-800 rounded flex-shrink-0" />
          <div className="flex-1">
            <div className="h-4 bg-zinc-800 rounded w-3/4 mb-1" />
            <div className="h-3 bg-zinc-800 rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Skeleton loader for the library view.
 */
export function LibrarySkeleton() {
  return (
    <div className="p-6">
      {/* Header skeleton */}
      <div className="flex items-center justify-between mb-6 animate-pulse">
        <div className="h-8 bg-zinc-800 rounded w-48" />
        <div className="flex gap-2">
          <div className="w-32 h-10 bg-zinc-800 rounded" />
          <div className="w-10 h-10 bg-zinc-800 rounded" />
        </div>
      </div>

      {/* Grid skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
        {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
          <DocumentCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

/**
 * Generic text skeleton with configurable width.
 */
export function TextSkeleton({
  width = '100%',
  height = 16,
  className = '',
}: {
  width?: string | number;
  height?: number;
  className?: string;
}) {
  return (
    <div
      className={`bg-zinc-800 rounded animate-pulse ${className}`}
      style={{ width, height }}
    />
  );
}

/**
 * Spinner component for inline loading states.
 */
export function Spinner({ size = 24, className = '' }: { size?: number; className?: string }) {
  return (
    <div
      className={`spinner border-2 border-zinc-600 border-t-red-500 rounded-full animate-spin ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
