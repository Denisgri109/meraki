'use client';

import React, { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { ToastProvider } from '@/components/Toast';
import { Footer } from '@/components/Footer';
import { MainNavbar } from '@/components/MainNavbar';
import { NotificationsProvider } from '@/contexts/NotificationsContext';
import { TestPanel } from '@/components/TestPanel';
import { TestHighlighter } from '@/components/TestHighlighter';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { loading, session, profile } = useAuth();

  useEffect(() => {
    if (!loading && !session) {
      router.replace('/login');
    }
  }, [loading, router, session]);

  // Gate masters who haven't completed onboarding — mirrors mobile MasterOnboardingScreen
  useEffect(() => {
    if (loading || !session || !profile) return;
    const isMaster = profile.role === 'master';
    const onboardingDone = profile.onboarding_completed === true;
    const onOnboarding = pathname?.startsWith('/dashboard/onboarding');

    if (isMaster && !onboardingDone && !onOnboarding) {
      router.replace('/dashboard/onboarding');
    } else if ((!isMaster || onboardingDone) && onOnboarding) {
      router.replace('/dashboard');
    }
  }, [loading, session, profile, pathname, router]);

  // Only show the full-screen splash on initial load (before any session).
  // Once a session exists, keep children mounted so transient `loading`
  // toggles (e.g. tab return / token refresh) don't unmount and reset
  // in-progress UI such as the booking flow.
  if (loading && !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-background)]">
        <div className="text-center animate-fade-in">
          <h1 className="text-3xl font-[family-name:var(--font-playfair)] italic text-[var(--color-primary)] mb-2">Merakí</h1>
          <div className="w-8 h-8 border-2 border-[var(--color-brand-pink)] border-t-transparent rounded-full animate-spin mx-auto mt-4" />
        </div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col gradient-mesh relative">
      {/* Decorative background blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="blob-pink -top-20 -right-20 opacity-40" />
        <div className="blob-purple -bottom-32 -left-20 opacity-30" />
        <div className="blob-mint top-1/3 -right-32 opacity-25" />
        <div className="blob-coral -bottom-10 right-1/4 opacity-20" />
      </div>
      <NotificationsProvider>
        <MainNavbar />

        {/* ── Page Content ───────────────────────────────────────────── */}
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <ToastProvider>{children}</ToastProvider>
        </main>
        <Footer />
        <TestPanel />
        <TestHighlighter />
      </NotificationsProvider>
    </div>
  );
}
