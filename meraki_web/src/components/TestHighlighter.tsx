'use client';

import React, { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { getHighlightTarget, clearHighlightTarget, type HighlightInfo } from '@/lib/test-panel';
import { CheckCircle2, X, ExternalLink } from 'lucide-react';

/**
 * Global component that shows a floating banner after a test-panel seed action
 * navigates to a target page. If the page has elements with `data-row-id` matching
 * the seeded row, it scrolls to and highlights that element.
 *
 * Place in the dashboard layout alongside <TestPanel />.
 */
export function TestHighlighter() {
  const pathname = usePathname();
  const [info, setInfo] = useState<HighlightInfo | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const target = getHighlightTarget();
    if (!target) return;

    // Only activate if we arrived at the expected page (within 15 seconds)
    const isCorrectPage = pathname?.startsWith(target.navigateTo);
    const isFresh = Date.now() - target.timestamp < 15_000;

    if (!isCorrectPage || !isFresh) {
      // Stale or wrong page — clear and ignore
      if (!isFresh) clearHighlightTarget();
      return;
    }

    setInfo(target);
    setVisible(true);
    clearHighlightTarget();

    // Try to find and highlight the matching row element
    if (target.rowId) {
      const tryHighlight = (attempt: number) => {
        const el = document.querySelector(`[data-row-id="${target.rowId}"]`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.classList.add('test-highlight-pulse');
          setTimeout(() => el.classList.remove('test-highlight-pulse'), 3000);
          return;
        }
        if (attempt < 10) {
          setTimeout(() => tryHighlight(attempt + 1), 500);
        }
      };
      // Start polling after a short delay to let the page render
      setTimeout(() => tryHighlight(0), 300);
    }

    // Auto-dismiss banner after 6 seconds
    const timer = setTimeout(() => setVisible(false), 6000);
    return () => clearTimeout(timer);
  }, [pathname]);

  if (!visible || !info) return null;

  return (
    <>
      {/* CSS for highlight animation */}
      <style>{`
        @keyframes test-highlight-ring {
          0% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.5); }
          50% { box-shadow: 0 0 0 6px rgba(99, 102, 241, 0.25); }
          100% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0); }
        }
        .test-highlight-pulse {
          animation: test-highlight-ring 1s ease-out 3;
          outline: 2px solid rgb(99, 102, 241);
          outline-offset: 2px;
          border-radius: 12px;
        }
      `}</style>

      {/* Floating banner */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9998] animate-fade-in">
        <div className="flex items-center gap-3 bg-white border border-gray-200 shadow-2xl rounded-2xl px-5 py-3 max-w-md">
          <CheckCircle2 size={18} className="text-green-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-800 truncate">{info.label}</p>
            <p className="text-[11px] text-gray-400">
              Seeded successfully
              {info.rowId && <> · <code className="text-[10px] bg-gray-100 px-1 py-0.5 rounded">{info.rowId.slice(0, 8)}…</code></>}
            </p>
          </div>
          <button
            onClick={() => setVisible(false)}
            className="p-1 rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <X size={14} className="text-gray-400" />
          </button>
        </div>
      </div>
    </>
  );
}
