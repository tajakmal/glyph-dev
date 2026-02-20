'use client';

import React, { useState, useCallback, useRef } from 'react';

interface UploadZoneProps {
  onFileSelect: (file: File) => Promise<void>;
  isUploading?: boolean;
  error?: string | null;
}

/**
 * Drag-and-drop upload zone for PDF files
 *
 * States:
 * - Default: Dashed border, upload icon + text
 * - Drag over: Solid border, blue tint
 * - Uploading: Progress spinner
 * - Error: Red border, error message
 */
export function UploadZone({ onFileSelect, isUploading, error }: UploadZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      await onFileSelect(file);
    }
  }, [onFileSelect]);

  const handleClick = () => {
    inputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await onFileSelect(file);
      // Reset input
      e.target.value = '';
    }
  };

  return (
    <div
      className={`
        relative h-[120px] rounded-2xl border-2 border-dashed
        flex items-center justify-center cursor-pointer
        transition-all duration-200
        ${isDragOver ? 'border-blue-500 bg-blue-500/10' : 'border-zinc-700 hover:border-zinc-600'}
        ${error ? 'border-red-500 bg-red-500/10' : ''}
        ${isUploading ? 'pointer-events-none' : ''}
      `}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
      aria-label="Upload PDF document"
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,application/pdf"
        className="hidden"
        onChange={handleFileChange}
      />

      {isUploading ? (
        <div className="flex flex-col items-center gap-2">
          <div className="spinner w-8 h-8 border-2 border-zinc-600 border-t-red-500 rounded-full" />
          <span className="text-zinc-400 text-sm">Uploading...</span>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center gap-2 text-red-400">
          <span className="text-sm">{error}</span>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 text-zinc-400">
          {/* Upload Icon */}
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <span className="text-sm">Drag & drop PDF here or click to browse</span>
        </div>
      )}
    </div>
  );
}
