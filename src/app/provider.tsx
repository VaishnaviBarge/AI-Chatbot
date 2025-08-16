'use client';

import { NhostProvider } from '@nhost/react';
import { nhost } from '@/app/nhost'; 

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <NhostProvider nhost={nhost}>
      {children}
    </NhostProvider>
  );
}
