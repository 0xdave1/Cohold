'use client';

import { type ReactNode } from 'react';
import { useAuthStore } from '@/stores/auth.store';

/**
 * Auth bootstrap wrapper component.
 * Blocks children until Zustand hydration is complete.
 * 
 * Architecture:
 * - Zustand localStorage is the ONLY source of truth
 * - Cookie is for Next.js middleware only (not used to initialize state)
 * - No bootstrap logic needed - just wait for hydration
 */
export function AuthBootstrap({ children }: { children: ReactNode }) {
  const hasHydrated = useAuthStore((s) => s.hasHydrated);

  if (!hasHydrated) {
    return null;
  }

  return <>{children}</>;
}
