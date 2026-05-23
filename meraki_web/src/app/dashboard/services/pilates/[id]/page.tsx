'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Activity, ArrowLeft, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/Toast';
import { PilatesTimetableManager } from '@/components/PilatesTimetableManager';
import type { Tables } from '@/types/database';

type Service = Tables<'services'>;

export default function PilatesStudioPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user, profile, loading: authLoading } = useAuth();
  const supabase = useMemo(() => createClient(), []);
  const { showToast } = useToast();
  const [service, setService] = useState<Service | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const isOwner = profile?.role === 'owner';
  const serviceId = params?.id;

  const load = useCallback(async () => {
    if (!user?.id || !serviceId) return;
    setLoading(true);
    setNotFound(false);
    try {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('id', serviceId)
        .eq('created_by', user.id)
        .maybeSingle();
      if (error) throw error;
      if (!data || data.category !== 'Pilates') {
        setNotFound(true);
        return;
      }
      setService(data as Service);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to load Pilates studio', 'error');
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [user?.id, serviceId, supabase, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  // Non-owners are redirected back; only owners manage timetable.
  useEffect(() => {
    if (!authLoading && profile && !isOwner) {
      router.replace('/dashboard/services');
    }
  }, [authLoading, profile, isOwner, router]);

  if (loading || authLoading) {
    return (
      <div className="max-w-6xl mx-auto animate-fade-in">
        <div className="glass-card flex items-center justify-center gap-2 py-32 text-[var(--color-text-muted)]">
          <Loader2 size={20} className="animate-spin" /> Loading Pilates studio...
        </div>
      </div>
    );
  }

  if (notFound || !service) {
    return (
      <div className="max-w-3xl mx-auto animate-fade-in">
        <div className="glass-card flex flex-col items-center justify-center gap-4 p-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-100 text-rose-600">
            <Activity size={28} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[var(--color-text-primary)]">Studio not found</h1>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">This Pilates studio doesn&apos;t exist or you don&apos;t have access to manage it.</p>
          </div>
          <Link
            href="/dashboard/services"
            className="btn-primary inline-flex items-center gap-2 px-5 py-2.5 text-sm"
          >
            <ArrowLeft size={16} /> Back to services
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto animate-fade-in">
      {/* HERO HEADER */}
      <div
        style={{
          position: 'relative',
          borderRadius: 'var(--radius-2xl)',
          overflow: 'hidden',
          marginBottom: '24px',
          height: '200px',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://images.unsplash.com/photo-1518611012118-696072aa579a?w=1600&q=80&auto=format&fit=crop"
          alt="Pilates studio"
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to top, rgba(6,78,59,0.85), rgba(6,78,59,0.55), transparent)',
          }}
        />
        <div className="absolute inset-0 flex flex-col justify-between p-6 text-white">
          <div>
            <Link
              href="/dashboard/services"
              className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-white backdrop-blur-sm hover:bg-white/25 transition-all"
            >
              <ArrowLeft size={12} /> Services
            </Link>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <Activity size={16} style={{ color: '#A7F3D0' }} />
              <span className="text-[11px] font-bold uppercase tracking-[0.3em]" style={{ color: '#A7F3D0' }}>
                Pilates studio
              </span>
              {!service.is_active && (
                <span className="text-[10px] font-bold uppercase tracking-widest rounded-full bg-white/20 px-2 py-0.5">
                  Paused
                </span>
              )}
            </div>
            <h1 style={{ fontSize: '32px', fontWeight: 700, textShadow: '0 2px 12px rgba(0,0,0,0.35)', margin: 0 }}>
              {service.name}
            </h1>
            <p className="text-sm mt-1.5" style={{ color: 'rgba(255,255,255,0.85)' }}>
              {service.duration_minutes} min · £{service.base_price?.toFixed(2)} per class
            </p>
          </div>
        </div>
      </div>

      <PilatesTimetableManager service={service} onServiceUpdate={load} />
    </div>
  );
}
