'use client';

import { use } from 'react';
import { ReturnScreen } from '@/components/reader/ReturnScreen';

interface ReturnPageProps {
  params: Promise<{ id: string }>;
}

export default function ReturnPage({ params }: ReturnPageProps) {
  const { id } = use(params);
  return (
    <main className="app-viewport" style={{ background: 'var(--paper)' }}>
      <ReturnScreen documentId={id} />
    </main>
  );
}
