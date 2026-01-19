'use client';

import { use } from 'react';
import { PDFViewer } from '@/components/pdf/PDFViewer';

interface ReaderPageProps {
  params: Promise<{ id: string }>;
}

export default function ReaderPage({ params }: ReaderPageProps) {
  const { id } = use(params);

  return (
    <main className="h-screen flex flex-col bg-zinc-950">
      {/* Toolbar will be added in later task */}
      <div className="flex-1 overflow-hidden">
        <PDFViewer documentId={id} />
      </div>
    </main>
  );
}
