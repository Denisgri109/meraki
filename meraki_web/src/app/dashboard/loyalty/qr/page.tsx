'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/Toast';
import { QRCodeSVG } from 'qrcode.react';
import {
  ArrowLeft, RefreshCw, Maximize2, Minimize2, Settings, Loader2,
  Sparkles, Ticket, Save, X,
} from 'lucide-react';

interface QrRow {
  id: string;
  user_id: string;
  code: string;
  points_value: number | null;
  scans_count: number | null;
  is_active: boolean | null;
  updated_at: string | null;
}

type QrMode = 'points' | 'stamp';

export default function LoyaltyQrPage() {
  const router = useRouter();
  const { user, role, profile, loading: authLoading } = useAuth();
  const supabase = createClient();
  const { showToast } = useToast();

  const isMasterOrOwner = role === 'master' || role === 'owner';

  const [loading, setLoading] = useState(true);
  const [qr, setQr] = useState<QrRow | null>(null);
  const [mode, setMode] = useState<QrMode>('points');
  const [rotating, setRotating] = useState(false);

  // Points config modal
  const [configOpen, setConfigOpen] = useState(false);
  const [pointsInput, setPointsInput] = useState('50');
  const [savingPoints, setSavingPoints] = useState(false);

  // Fullscreen
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Role guard
  useEffect(() => {
    if (authLoading) return;
    if (!isMasterOrOwner) router.replace('/dashboard/loyalty');
  }, [authLoading, isMasterOrOwner, router]);

  // ─── Load QR code ────────────────────────────────────────────────────────
  const loadQr = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase.rpc('ensure_loyalty_qr_code', { p_user_id: user.id });
      if (error) throw error;
      const row = Array.isArray(data) ? (data[0] as QrRow | undefined) : (data as QrRow | null);
      if (row) {
        setQr(row);
        setPointsInput(String(row.points_value ?? 50));
      }
    } catch (err) {
      console.error('[LoyaltyQR] load error:', err);
      showToast(err instanceof Error ? err.message : 'Failed to load QR code', 'error');
    } finally {
      setLoading(false);
    }
  }, [user, supabase, showToast]);

  useEffect(() => {
    if (!user || !isMasterOrOwner) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadQr();
  }, [user, isMasterOrOwner, loadQr]);

  // ─── Realtime subscription: code rotates server-side after each client scan
  useEffect(() => {
    if (!user || !isMasterOrOwner) return;
    const channel = supabase
      .channel(`loyalty_qr:${user.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'loyalty_qr_codes', filter: `user_id=eq.${user.id}` },
        (payload) => {
          const next = payload.new as QrRow;
          setQr((prev) => (prev ? { ...prev, ...next } : next));
          setPointsInput(String(next.points_value ?? 50));
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user, isMasterOrOwner, supabase]);

  // ─── Manual rotation ────────────────────────────────────────────────────
  const handleRotate = useCallback(async () => {
    if (!user) return;
    setRotating(true);
    try {
      const { data, error } = await supabase.rpc('regenerate_loyalty_qr_code', { p_user_id: user.id });
      if (error) throw error;
      const newCode = data as string | null;
      if (newCode) {
        setQr((prev) => (prev ? { ...prev, code: newCode } : prev));
      }
      showToast('QR rotated', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to rotate QR', 'error');
    } finally {
      setRotating(false);
    }
  }, [user, supabase, showToast]);

  // ─── Save points value ──────────────────────────────────────────────────
  const handleSavePoints = useCallback(async () => {
    if (!user) return;
    const val = parseInt(pointsInput, 10);
    if (!Number.isFinite(val) || val < 1 || val > 10000) {
      showToast('Points must be between 1 and 10,000', 'error');
      return;
    }
    setSavingPoints(true);
    try {
      const { error } = await supabase.rpc('set_loyalty_qr_points_value', {
        p_user_id: user.id,
        p_points: val,
      });
      if (error) throw error;
      setQr((prev) => (prev ? { ...prev, points_value: val } : prev));
      showToast(`Points per scan set to ${val}`, 'success');
      setConfigOpen(false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save', 'error');
    } finally {
      setSavingPoints(false);
    }
  }, [user, pointsInput, supabase, showToast]);

  // ─── Fullscreen ─────────────────────────────────────────────────────────
  const enterFullscreen = useCallback(async () => {
    const el = wrapperRef.current;
    if (!el) return;
    try {
      if (el.requestFullscreen) await el.requestFullscreen();
    } catch {
      // ignore
    }
  }, []);

  const exitFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // ─── Derived values ─────────────────────────────────────────────────────
  const stampValue = user ? `stamp:${user.id}` : '';
  const pointsValue = qr?.code ? `qr:${qr.code}` : '';
  const displayValue = mode === 'points' ? pointsValue : stampValue;
  const masterName = profile?.full_name || 'Your salon';
  const pointsPerScan = qr?.points_value ?? 50;

  if (authLoading || !isMasterOrOwner) {
    return (
      <div className="max-w-3xl mx-auto p-8 flex items-center justify-center">
        <Loader2 className="animate-spin text-[var(--color-brand-pink-dark)]" size={28} />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/loyalty"
            className="w-10 h-10 rounded-full bg-[var(--color-surface-light)] hover:bg-[var(--color-brand-pink-light)] flex items-center justify-center transition-colors"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Loyalty QR</h1>
            <p className="text-sm text-[var(--color-text-muted)]">Display your QR for clients to scan</p>
          </div>
        </div>
        <button
          onClick={() => setConfigOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[var(--color-surface-light)] text-[var(--color-text-secondary)] text-sm font-semibold hover:bg-[var(--color-brand-pink-light)] hover:text-[var(--color-brand-pink-dark)] transition-colors cursor-pointer"
        >
          <Settings size={14} /> Points config
        </button>
      </div>

      {/* Mode toggle */}
      <div className="flex p-1 mb-6 rounded-xl bg-[var(--color-surface-light)]">
        <button
          onClick={() => setMode('points')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-lg transition-all cursor-pointer ${
            mode === 'points'
              ? 'bg-white shadow-sm text-[var(--color-text-primary)]'
              : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
          }`}
        >
          <Sparkles size={14} /> Points QR
        </button>
        <button
          onClick={() => setMode('stamp')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-lg transition-all cursor-pointer ${
            mode === 'stamp'
              ? 'bg-white shadow-sm text-[var(--color-text-primary)]'
              : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
          }`}
        >
          <Ticket size={14} /> Stamp QR
        </button>
      </div>

      {/* QR display card (also acts as fullscreen target) */}
      <div
        ref={wrapperRef}
        className={`relative ${
          isFullscreen
            ? 'fixed inset-0 z-50 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex flex-col items-center justify-center p-8 text-white'
            : 'rounded-[var(--radius-2xl)] p-8 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white shadow-2xl mb-6 overflow-hidden'
        }`}
      >
        {!isFullscreen && (
          <>
            <div className="absolute right-0 top-0 w-48 h-48 bg-gradient-to-bl from-pink-500/20 to-transparent rounded-full -mr-16 -mt-16 pointer-events-none" />
            <div className="absolute left-1/2 bottom-0 w-32 h-32 bg-gradient-to-t from-purple-500/15 to-transparent rounded-full -mb-12 pointer-events-none" />
          </>
        )}

        <div className={`relative z-10 flex flex-col items-center ${isFullscreen ? 'w-full max-w-2xl' : ''}`}>
          {isFullscreen && (
            <p className="text-white/60 text-xs uppercase tracking-[0.3em] mb-4">{masterName}</p>
          )}
          <div className="flex items-center gap-2 mb-4">
            <div
              className={`rounded-2xl flex items-center justify-center shadow-lg ${
                isFullscreen ? 'w-12 h-12 bg-gradient-to-br from-amber-400 to-pink-400' : 'w-10 h-10 bg-gradient-to-br from-amber-400 to-pink-400'
              }`}
            >
              {mode === 'points' ? (
                <Sparkles size={isFullscreen ? 24 : 18} className="text-white" />
              ) : (
                <Ticket size={isFullscreen ? 24 : 18} className="text-white" />
              )}
            </div>
            <div>
              <h3 className={`font-bold ${isFullscreen ? 'text-2xl' : 'text-lg'}`}>
                {mode === 'points' ? `Earn ${pointsPerScan} points` : 'Collect a stamp'}
              </h3>
              <p className={`text-white/70 ${isFullscreen ? 'text-sm' : 'text-xs'}`}>
                {mode === 'points' ? 'Rotates after each scan' : 'Static QR — points to your loyalty cards'}
              </p>
            </div>
          </div>

          <div className={`bg-white rounded-3xl shadow-2xl ${isFullscreen ? 'p-12' : 'p-8'}`}>
            {loading ? (
              <div className={`${isFullscreen ? 'w-[420px] h-[420px]' : 'w-[260px] h-[260px]'} flex items-center justify-center`}>
                <Loader2 className="animate-spin text-[var(--color-brand-pink-dark)]" size={32} />
              </div>
            ) : displayValue ? (
              <QRCodeSVG
                value={displayValue}
                size={isFullscreen ? 420 : 260}
                level="H"
                bgColor="white"
                fgColor="#1a1a1a"
              />
            ) : (
              <div className={`${isFullscreen ? 'w-[420px] h-[420px]' : 'w-[260px] h-[260px]'} flex items-center justify-center text-gray-400 text-sm`}>
                No QR available
              </div>
            )}
          </div>

          {/* Stats */}
          {mode === 'points' && qr && !isFullscreen && (
            <div className="grid grid-cols-2 gap-3 w-full mt-6 max-w-sm">
              <div className="rounded-xl bg-white/5 backdrop-blur-sm p-3 text-center">
                <p className="text-[10px] uppercase tracking-wider text-white/50 font-bold">Points / scan</p>
                <p className="text-2xl font-bold mt-1">{pointsPerScan}</p>
              </div>
              <div className="rounded-xl bg-white/5 backdrop-blur-sm p-3 text-center">
                <p className="text-[10px] uppercase tracking-wider text-white/50 font-bold">Total scans</p>
                <p className="text-2xl font-bold mt-1">{qr.scans_count ?? 0}</p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className={`flex items-center gap-2 ${isFullscreen ? 'mt-8' : 'mt-6'}`}>
            {mode === 'points' && (
              <button
                onClick={() => void handleRotate()}
                disabled={rotating}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white text-sm font-semibold cursor-pointer transition-all backdrop-blur-sm disabled:opacity-50"
              >
                {rotating ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                Rotate now
              </button>
            )}
            {!isFullscreen ? (
              <button
                onClick={() => void enterFullscreen()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-white text-gray-900 text-sm font-bold cursor-pointer hover:scale-105 transition-transform shadow-lg"
              >
                <Maximize2 size={14} /> Full screen
              </button>
            ) : (
              <button
                onClick={() => void exitFullscreen()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-white text-gray-900 text-sm font-bold cursor-pointer hover:scale-105 transition-transform shadow-lg"
              >
                <Minimize2 size={14} /> Exit full screen
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Help */}
      {!isFullscreen && (
        <div className="glass-card p-5">
          <p className="text-xs uppercase tracking-wider font-bold text-[var(--color-text-muted)] mb-2">How clients scan</p>
          <ul className="space-y-1.5 text-sm text-[var(--color-text-secondary)]">
            <li className="flex gap-2"><span className="text-amber-500">•</span> They open <strong>Loyalty → Scan</strong> in the Meraki app or website.</li>
            <li className="flex gap-2"><span className="text-amber-500">•</span> Camera reads the QR; if you have multiple loyalty cards they pick one.</li>
            <li className="flex gap-2"><span className="text-amber-500">•</span> Points QR auto-rotates after each scan to prevent abuse.</li>
          </ul>
        </div>
      )}

      {/* Points config modal */}
      {configOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)' }}
          onClick={() => !savingPoints && setConfigOpen(false)}
        >
          <div
            className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-[var(--color-text-primary)]">Points per scan</h2>
              <button
                onClick={() => !savingPoints && setConfigOpen(false)}
                disabled={savingPoints}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[var(--color-surface-light)] cursor-pointer disabled:opacity-50"
              >
                <X size={16} />
              </button>
            </div>
            <p className="text-sm text-[var(--color-text-muted)] mb-4">
              How many loyalty points clients earn each time they scan your Points QR. Default is 50.
            </p>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={10000}
              value={pointsInput}
              onChange={(e) => setPointsInput(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-[var(--color-surface-light)] border border-[var(--color-border-light)] text-base font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-pink)]"
            />
            <div className="flex flex-wrap gap-2 mt-3">
              {[10, 25, 50, 100, 250].map((v) => (
                <button
                  key={v}
                  onClick={() => setPointsInput(String(v))}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-colors ${
                    pointsInput === String(v)
                      ? 'bg-[var(--color-brand-pink)] text-white'
                      : 'bg-[var(--color-surface-light)] text-[var(--color-text-secondary)] hover:bg-[var(--color-brand-pink-light)]'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3 mt-6">
              <button
                onClick={() => !savingPoints && setConfigOpen(false)}
                disabled={savingPoints}
                className="flex-1 px-5 py-3 rounded-full bg-[var(--color-surface-light)] text-[var(--color-text-secondary)] text-sm font-semibold hover:bg-gray-200 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleSavePoints()}
                disabled={savingPoints}
                className="flex-1 flex items-center justify-center gap-1.5 px-5 py-3 rounded-full btn-pink text-sm font-bold cursor-pointer hover:scale-105 transition-transform disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {savingPoints ? <Loader2 size={14} className="animate-spin" /> : <><Save size={14} /> Save</>}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.92) translateY(8px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .animate-scale-in { animation: scaleIn 0.25s ease-out; }
      `}</style>
    </div>
  );
}
