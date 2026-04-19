'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Legacy route. Speed reading now always happens inside /reader/[id]?mode=speed-read
 * via the ReaderProvider. Bounce anyone who lands here back to the library.
 */
export default function SpeedReadRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/');
  }, [router]);
  return null;
}
