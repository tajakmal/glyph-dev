import { use } from 'react';
import { ArchiveDetail } from '@/components/archive/ArchiveDetail';

interface ArchiveDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function ArchiveDetailPage({
  params,
}: ArchiveDetailPageProps) {
  const { id } = use(params);
  return <ArchiveDetail archiveId={id} />;
}
