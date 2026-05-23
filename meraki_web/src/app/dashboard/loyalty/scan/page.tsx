'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/Toast';
import {
  ArrowLeft, Camera, Radio, Loader2, X, Sparkles, Gift, Star, RefreshCw, ScanLine,
} from 'lucide-react';

// html5-qrcode is browser-only; load lazily
type Html5QrcodeModule = typeof import('html5-qrcode');

interface LoyaltyCard {
  id: string;
  master_id: string;
  name: string;
  description: string | null;
  stamps_required: number;
  reward_type: string;
  reward_value: number | null;
  is_active: boolean | null;
}

interface MasterInfo {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
}

type ScanResult =
  | { kind: 'points'; points: number; message?: string }
  | { kind: 'stamp'; cardName: string; masterName: string; collected: number; required: number; rewardAvailable: boolean; message?: string };

const QR_REGION_ID = 'meraki-qr-reader';

export default function LoyaltyScanPage() {
  const router = useRouter();
  const { user, role, loading: authLoading } = useAuth();
  const supabase = createClient();
  const { showToast } = useToast();

  const isClient = role === 'client';

  // Mode: camera | nfc
  const [mode, setMode] = useState<'camera' | 'nfc'>('camera');

  // Camera state
  const scannerRef = useRef<import('html5-qrcode').Html5Qrcode | null>(null);
  const moduleRef = useRef<Html5QrcodeModule | null>(null);
  const lastDecodedRef = useRef<{ text: string; at: number } | null>(null);
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // NFC state
  const [nfcSupported, setNfcSupported] = useState(false);
  const [nfcReading, setNfcReading] = useState(false);
  const nfcAbortRef = useRef<AbortController | null>(null);

  // Processing scan
  const [processing, setProcessing] = useState(false);

  // Card-selection modal (when scanning a master with multiple loyalty cards)
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerMaster, setPickerMaster] = useState<MasterInfo | null>(null);
  const [pickerCards, setPickerCards] = useState<LoyaltyCard[]>([]);

  // Last result banner
  const [lastResult, setLastResult] = useState<ScanResult | null>(null);

  // Role guard
  useEffect(() => {
    if (authLoading) return;
    if (role && role !== 'client') {
      router.replace('/dashboard/loyalty');
    }
  }, [authLoading, role, router]);

  // Detect NFC support (Web NFC: Chromium Android only)
  useEffect(() => {
    if (typeof window !== 'undefined' && 'NDEFReader' in window) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNfcSupported(true);
    }
  }, []);

  // ─── Stamp / Points handlers ────────────────────────────────────────────
  const fetchMasterCards = useCallback(
    async (masterId: string): Promise<{ master: MasterInfo | null; cards: LoyaltyCard[] }> => {
      const [{ data: master }, { data: cards }] = await Promise.all([
        supabase.from('profiles').select('id, full_name, avatar_url').eq('id', masterId).single(),
        supabase
          .from('loyalty_cards')
          .select('*')
          .eq('master_id', masterId)
          .eq('is_active', true)
          .order('created_at', { ascending: true }),
      ]);
      return {
        master: (master as unknown as MasterInfo) ?? null,
        cards: (cards as unknown as LoyaltyCard[]) ?? [],
      };
    },
    [supabase],
  );

  const handleAddStamp = useCallback(
    async (cardId: string, master: MasterInfo | null, card: LoyaltyCard) => {
      if (!user) return;
      setProcessing(true);
      try {
        const { data, error } = await supabase.rpc('add_loyalty_stamp', {
          p_client_id: user.id,
          p_loyalty_card_id: cardId,
        });
        if (error) throw error;
        const row = Array.isArray(data) ? data[0] : data;
        const result = row as { success: boolean; new_total: number; reward_available: boolean; message: string } | null;
        if (!result || result.success === false) {
          showToast(result?.message || 'Failed to add stamp', 'error');
          return;
        }
        setLastResult({
          kind: 'stamp',
          cardName: card.name,
          masterName: master?.full_name || 'Master',
          collected: result.new_total,
          required: card.stamps_required,
          rewardAvailable: result.reward_available,
          message: result.message,
        });
        showToast(result.reward_available ? 'Reward unlocked! 🎉' : `Stamp added • ${result.new_total}/${card.stamps_required}`, 'success');
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Failed to add stamp', 'error');
      } finally {
        setProcessing(false);
        setPickerOpen(false);
      }
    },
    [user, supabase, showToast],
  );

  const handleStampScan = useCallback(
    async (masterId: string) => {
      if (!user) return;
      if (masterId === user.id) {
        showToast('You can\u2019t scan your own QR', 'error');
        return;
      }
      setProcessing(true);
      try {
        const { master, cards } = await fetchMasterCards(masterId);
        if (!master) {
          showToast('Master not found', 'error');
          return;
        }
        if (cards.length === 0) {
          showToast('This master has no active loyalty card', 'error');
          return;
        }
        if (cards.length === 1) {
          await handleAddStamp(cards[0].id, master, cards[0]);
          return;
        }
        // Multiple cards → ask client to choose
        setPickerMaster(master);
        setPickerCards(cards);
        setPickerOpen(true);
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Stamp failed', 'error');
      } finally {
        setProcessing(false);
      }
    },
    [user, fetchMasterCards, handleAddStamp, showToast],
  );

  const handlePointsScan = useCallback(
    async (code: string) => {
      if (!user) return;
      setProcessing(true);
      try {
        const { data, error } = await supabase.rpc('process_qr_scan', {
          p_client_id: user.id,
          p_code: code,
        });
        if (error) throw error;
        const result = data as { success: boolean; points?: number; message?: string } | null;
        if (!result?.success) {
          showToast(result?.message || 'Invalid QR code', 'error');
          return;
        }
        setLastResult({ kind: 'points', points: result.points ?? 0, message: result.message });
        showToast(`+${result.points ?? 0} points earned!`, 'success');
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Scan failed', 'error');
      } finally {
        setProcessing(false);
      }
    },
    [user, supabase, showToast],
  );

  const processDecodedText = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text) return;

      // Debounce duplicate decodes (camera fires many frames)
      const now = Date.now();
      if (lastDecodedRef.current && lastDecodedRef.current.text === text && now - lastDecodedRef.current.at < 3000) {
        return;
      }
      lastDecodedRef.current = { text, at: now };

      if (text.startsWith('stamp:')) {
        const masterId = text.slice('stamp:'.length).trim();
        if (!isUuid(masterId)) {
          showToast('Invalid stamp QR', 'error');
          return;
        }
        await handleStampScan(masterId);
      } else if (text.startsWith('qr:')) {
        const code = text.slice('qr:'.length).trim();
        if (!code) {
          showToast('Invalid QR code', 'error');
          return;
        }
        await handlePointsScan(code);
      } else {
        // Allow raw codes (legacy / NFC plain text) — try as points QR first
        await handlePointsScan(text);
      }
    },
    [handleStampScan, handlePointsScan, showToast],
  );

  // ─── Camera scanner lifecycle ────────────────────────────────────────────
  const stopScanner = useCallback(async () => {
    const inst = scannerRef.current;
    if (!inst) return;
    try {
      const state = inst.getState();
      // 2 = SCANNING, 3 = PAUSED in html5-qrcode
      if (state === 2 || state === 3) {
        await inst.stop();
      }
      await inst.clear();
    } catch {
      // ignore
    }
    scannerRef.current = null;
    setScanning(false);
  }, []);

  const startScanner = useCallback(async () => {
    setCameraError(null);
    try {
      if (!moduleRef.current) {
        moduleRef.current = await import('html5-qrcode');
      }
      const { Html5Qrcode } = moduleRef.current;
      const inst = new Html5Qrcode(QR_REGION_ID, { verbose: false });
      scannerRef.current = inst;
      await inst.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 }, aspectRatio: 1 },
        (decodedText) => {
          void processDecodedText(decodedText);
        },
        () => {
          // ignore per-frame errors
        },
      );
      setScanning(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to start camera';
      setCameraError(msg);
      setScanning(false);
    }
  }, [processDecodedText]);

  // Auto-start camera when in camera mode
  useEffect(() => {
    if (!isClient) return;
    if (mode !== 'camera') {
      void stopScanner();
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void startScanner();
    return () => {
      void stopScanner();
    };
  }, [mode, isClient, startScanner, stopScanner]);

  // ─── NFC scanner lifecycle ───────────────────────────────────────────────
  const stopNfc = useCallback(() => {
    nfcAbortRef.current?.abort();
    nfcAbortRef.current = null;
    setNfcReading(false);
  }, []);

  const startNfc = useCallback(async () => {
    if (!nfcSupported) {
      showToast('NFC not supported on this device', 'error');
      return;
    }
    try {
      const ctrl = new AbortController();
      nfcAbortRef.current = ctrl;
      // @ts-expect-error: NDEFReader exists in Chromium Android
      const reader = new window.NDEFReader();
      await reader.scan({ signal: ctrl.signal });
      setNfcReading(true);
      reader.onreading = (event: { message: { records: Array<{ recordType: string; data: ArrayBuffer; encoding?: string }> }; serialNumber: string }) => {
        const decoder = new TextDecoder();
        for (const record of event.message.records) {
          if (record.recordType === 'text' || record.recordType === 'url') {
            const text = decoder.decode(record.data);
            // strip URL prefix if it's a URL pointing to our scheme
            const stripped = text.replace(/^https?:\/\/[^?#]*[?#]?(?:meraki=)?/, '');
            void processDecodedText(stripped || text);
          }
        }
      };
      reader.onreadingerror = () => {
        showToast('NFC read error', 'error');
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to start NFC';
      showToast(msg, 'error');
      setNfcReading(false);
    }
  }, [nfcSupported, processDecodedText, showToast]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (mode !== 'nfc') stopNfc();
    return () => stopNfc();
  }, [mode, stopNfc]);

  // ─── Render ──────────────────────────────────────────────────────────────
  if (authLoading || !isClient) {
    return (
      <div className="max-w-2xl mx-auto p-8 flex items-center justify-center">
        <Loader2 className="animate-spin text-[var(--color-brand-pink-dark)]" size={28} />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/dashboard/loyalty"
          className="w-10 h-10 rounded-full bg-[var(--color-surface-light)] hover:bg-[var(--color-brand-pink-light)] flex items-center justify-center transition-colors"
        >
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Scan to Earn</h1>
          <p className="text-sm text-[var(--color-text-muted)]">Earn stamps and points at the salon</p>
        </div>
      </div>

      {/* Mode toggle */}
      <div className="flex p-1 mb-6 rounded-xl bg-[var(--color-surface-light)]">
        <button
          onClick={() => setMode('camera')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-lg transition-all cursor-pointer ${
            mode === 'camera'
              ? 'bg-white shadow-sm text-[var(--color-text-primary)]'
              : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
          }`}
        >
          <Camera size={14} /> QR Camera
        </button>
        <button
          onClick={() => setMode('nfc')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-lg transition-all cursor-pointer ${
            mode === 'nfc'
              ? 'bg-white shadow-sm text-[var(--color-text-primary)]'
              : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
          }`}
        >
          <Radio size={14} /> NFC Tag
        </button>
      </div>

      {/* Camera mode */}
      {mode === 'camera' && (
        <div className="glass-card p-5 mb-6">
          <div className="relative rounded-2xl overflow-hidden bg-black aspect-square">
            <div id={QR_REGION_ID} className="w-full h-full [&_video]:object-cover [&_video]:!w-full [&_video]:!h-full" />
            {/* Overlay frame */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="w-3/5 aspect-square border-2 border-white/80 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]">
                <div className="w-full h-full relative">
                  <ScanLine className="absolute inset-0 m-auto text-white/70 animate-pulse" size={40} />
                </div>
              </div>
            </div>
            {/* Status pill */}
            <div className="absolute top-3 left-3 flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/50 backdrop-blur-sm text-white text-xs font-medium">
              <span className={`w-1.5 h-1.5 rounded-full ${scanning ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
              {scanning ? 'Scanning…' : 'Idle'}
            </div>
            {/* Processing overlay */}
            {processing && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                <Loader2 className="animate-spin text-white" size={32} />
              </div>
            )}
          </div>

          {cameraError && (
            <div className="mt-4 p-4 rounded-xl bg-red-50 text-red-700 text-sm flex items-start gap-2">
              <X size={16} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">Camera unavailable</p>
                <p className="text-xs mt-0.5">{cameraError}</p>
                <button
                  onClick={() => void startScanner()}
                  className="inline-flex items-center gap-1 mt-2 px-3 py-1.5 rounded-full bg-red-600 text-white text-xs font-bold cursor-pointer"
                >
                  <RefreshCw size={12} /> Retry
                </button>
              </div>
            </div>
          )}

          <p className="text-xs text-[var(--color-text-muted)] mt-3 text-center">
            Point your camera at the master&apos;s QR code to collect a stamp or earn points.
          </p>
        </div>
      )}

      {/* NFC mode */}
      {mode === 'nfc' && (
        <div className="glass-card p-8 mb-6 text-center">
          <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br from-violet-400 to-pink-400 flex items-center justify-center shadow-lg mb-4">
            <Radio size={36} className="text-white" />
          </div>
          {!nfcSupported ? (
            <>
              <p className="font-bold text-[var(--color-text-primary)]">NFC not supported</p>
              <p className="text-sm text-[var(--color-text-muted)] mt-1">
                Web NFC works on Chrome / Edge for Android. Use the camera scanner instead.
              </p>
            </>
          ) : nfcReading ? (
            <>
              <p className="font-bold text-[var(--color-text-primary)]">Tap an NFC tag…</p>
              <p className="text-sm text-[var(--color-text-muted)] mt-1">Hold your phone near the master&apos;s NFC sticker.</p>
              <button
                onClick={stopNfc}
                className="mt-4 inline-flex items-center gap-1.5 px-5 py-2 rounded-full bg-[var(--color-surface-light)] text-[var(--color-text-secondary)] text-sm font-semibold cursor-pointer"
              >
                <X size={14} /> Stop
              </button>
            </>
          ) : (
            <>
              <p className="font-bold text-[var(--color-text-primary)]">Ready to scan</p>
              <p className="text-sm text-[var(--color-text-muted)] mt-1">Tap the button, then hold your phone near the salon&apos;s NFC tag.</p>
              <button
                onClick={() => void startNfc()}
                className="mt-4 inline-flex items-center gap-1.5 px-5 py-2 rounded-full btn-pink text-sm font-bold cursor-pointer hover:scale-105 transition-transform"
              >
                <Radio size={14} /> Start NFC scan
              </button>
            </>
          )}
        </div>
      )}

      {/* Last scan result */}
      {lastResult && (
        <div className="glass-card p-5 mb-6 border border-emerald-200 bg-gradient-to-br from-emerald-50/70 to-white">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-400 flex items-center justify-center shrink-0">
              <Sparkles size={18} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              {lastResult.kind === 'points' ? (
                <>
                  <p className="font-bold text-[var(--color-text-primary)]">+{lastResult.points} points earned!</p>
                  <p className="text-xs text-[var(--color-text-muted)]">{lastResult.message || 'Keep visiting to unlock rewards'}</p>
                </>
              ) : (
                <>
                  <p className="font-bold text-[var(--color-text-primary)]">
                    {lastResult.rewardAvailable ? 'Reward unlocked!' : 'Stamp added'}
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {lastResult.cardName} • {lastResult.masterName} • {lastResult.collected}/{lastResult.required}
                  </p>
                </>
              )}
            </div>
          </div>
          {lastResult.kind === 'stamp' && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {Array.from({ length: lastResult.required }).map((_, i) => {
                const filled = i < lastResult.collected;
                return (
                  <div
                    key={i}
                    className={`w-7 h-7 rounded-lg flex items-center justify-center border ${
                      filled
                        ? 'bg-gradient-to-br from-amber-400 to-pink-400 border-transparent shadow-sm'
                        : 'bg-white/60 border-black/5'
                    }`}
                  >
                    <Star size={12} className={filled ? 'text-white' : 'text-black/10'} />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Help card */}
      <div className="glass-card p-5">
        <p className="text-xs uppercase tracking-wider font-bold text-[var(--color-text-muted)] mb-2">How it works</p>
        <ul className="space-y-1.5 text-sm text-[var(--color-text-secondary)]">
          <li className="flex gap-2"><span className="text-amber-500">•</span> Scan the master&apos;s <strong>Stamp QR</strong> after each appointment to fill your card.</li>
          <li className="flex gap-2"><span className="text-amber-500">•</span> Scan the salon&apos;s <strong>Points QR</strong> to earn loyalty points (rotates after every scan).</li>
          <li className="flex gap-2"><span className="text-amber-500">•</span> Redeem rewards from the loyalty page once you&apos;ve collected enough.</li>
        </ul>
      </div>

      {/* Card picker modal */}
      {pickerOpen && pickerMaster && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)' }}
          onClick={() => !processing && setPickerOpen(false)}
        >
          <div
            className="bg-white rounded-2xl p-6 w-full max-w-md max-h-[85vh] overflow-y-auto shadow-2xl animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-[var(--color-text-primary)]">Choose a card</h2>
                <p className="text-xs text-[var(--color-text-muted)]">{pickerMaster.full_name} has multiple loyalty cards</p>
              </div>
              <button
                onClick={() => !processing && setPickerOpen(false)}
                disabled={processing}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[var(--color-surface-light)] cursor-pointer disabled:opacity-50"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-2.5">
              {pickerCards.map((card) => (
                <button
                  key={card.id}
                  disabled={processing}
                  onClick={() => void handleAddStamp(card.id, pickerMaster, card)}
                  className="w-full flex items-center gap-3 p-4 rounded-xl border border-[var(--color-border-light)] bg-white hover:bg-[var(--color-brand-pink-light)] hover:border-[var(--color-brand-pink)] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-left"
                >
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-pink-400 flex items-center justify-center shrink-0">
                    <Gift size={18} className="text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-[var(--color-text-primary)] truncate">{card.name}</p>
                    <p className="text-xs text-[var(--color-text-muted)] truncate">
                      {card.stamps_required} stamps → {rewardLabel(card)}
                    </p>
                  </div>
                </button>
              ))}
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
        #${QR_REGION_ID} video { width: 100% !important; height: 100% !important; object-fit: cover; }
      `}</style>
    </div>
  );
}

function isUuid(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

function rewardLabel(card: LoyaltyCard) {
  switch (card.reward_type) {
    case 'free_service':
      return 'Free service';
    case 'discount_percent':
      return `${card.reward_value ?? ''}% off`;
    case 'discount_amount':
      return `\u20AC${card.reward_value ?? ''} off`;
    default:
      return 'Reward';
  }
}
