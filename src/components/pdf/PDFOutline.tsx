'use client';

import React, { useState } from 'react';
import type { PDFOutlineItem } from '@/types';

interface PDFOutlineProps {
  outline: PDFOutlineItem[];
  onItemClick: (page: number) => void;
  isLoading?: boolean;
}

interface OutlineItemProps {
  item: PDFOutlineItem;
  depth: number;
  onItemClick: (page: number) => void;
}

function OutlineItem({ item, depth, onItemClick }: OutlineItemProps) {
  const [isExpanded, setIsExpanded] = useState(depth < 2);
  const hasChildren = item.items && item.items.length > 0;

  return (
    <div>
      <div
        className={`
          flex items-center gap-2 py-1.5 px-3 cursor-pointer
          hover:bg-zinc-800/50 text-sm transition-colors
          ${depth === 0 ? 'font-medium text-zinc-200' : 'text-zinc-400'}
        `}
        style={{ paddingLeft: `${12 + depth * 16}px` }}
        onClick={() => onItemClick(item.page)}
      >
        {hasChildren && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            className="p-0.5 hover:bg-zinc-700 rounded"
          >
            <svg
              className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}
        <span className="flex-1 truncate">{item.title}</span>
        <span className="text-zinc-600 text-xs">{item.page}</span>
      </div>

      {hasChildren && isExpanded && (
        <div>
          {item.items.map((child, index) => (
            <OutlineItem
              key={index}
              item={child}
              depth={depth + 1}
              onItemClick={onItemClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function PDFOutline({ outline, onItemClick, isLoading }: PDFOutlineProps) {
  if (isLoading) {
    return (
      <div className="p-4 text-zinc-500 text-sm text-center">
        Loading table of contents...
      </div>
    );
  }

  if (outline.length === 0) {
    return (
      <div className="p-4 text-zinc-500 text-sm text-center">
        No table of contents available for this document.
      </div>
    );
  }

  return (
    <div className="py-2">
      {outline.map((item, index) => (
        <OutlineItem
          key={index}
          item={item}
          depth={0}
          onItemClick={onItemClick}
        />
      ))}
    </div>
  );
}
