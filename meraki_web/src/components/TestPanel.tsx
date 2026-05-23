'use client';

import React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { FlaskConical } from 'lucide-react';
import { TEST_EMAILS } from '@/lib/test-panel';

/**
 * Floating Action Button — navigates to the dedicated /dashboard/test-panel page.
 * Only visible for whitelisted test accounts.
 */
export function TestPanel() {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();

  const userEmail = user?.email?.toLowerCase();
  const isTestAccount = userEmail && TEST_EMAILS.includes(userEmail);
  const isOnTestPanel = pathname === '/dashboard/test-panel';

  if (!isTestAccount || isOnTestPanel) return null;

  return (
    <button
      onClick={() => router.push('/dashboard/test-panel')}
      className="fixed bottom-6 right-6 z-[9999] w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-xl hover:shadow-2xl hover:scale-105 transition-all flex items-center justify-center cursor-pointer group"
      title="QA Test Panel"
      aria-label="Open test panel"
    >
      <FlaskConical size={24} className="group-hover:rotate-12 transition-transform" />
      <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-white animate-pulse" />
    </button>
  );
}
