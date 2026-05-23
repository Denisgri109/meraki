'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/contexts/NotificationsContext';
import { createClient } from '@/lib/supabase/client';
import { Calendar, ShoppingBag, GraduationCap, Gift, Search, ArrowRight, Sparkles, Star, TrendingUp, Heart, MessageSquare, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import StaffDashboard from './StaffDashboard';

const quickActions = [
  { href: '/dashboard/booking', label: 'Book Now', icon: Calendar, gradient: 'from-pink-400 to-rose-300', img: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=400&q=80&auto=format&fit=crop' },
  { href: '/dashboard/discover', label: 'Discover', icon: Search, gradient: 'from-violet-400 to-purple-300', img: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=400&q=80&auto=format&fit=crop' },
  { href: '/dashboard/shop', label: 'Shop', icon: ShoppingBag, gradient: 'from-amber-400 to-orange-300', img: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=400&q=80&auto=format&fit=crop' },
  { href: '/dashboard/academy', label: 'Academy', icon: GraduationCap, gradient: 'from-blue-400 to-cyan-300', img: 'https://images.unsplash.com/photo-1487412912498-0447578fcca8?w=400&q=80&auto=format&fit=crop' },
  { href: '/dashboard/loyalty', label: 'Rewards', icon: Gift, gradient: 'from-emerald-400 to-teal-300', img: 'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=400&q=80&auto=format&fit=crop' },
];

export interface DashboardAppointment {
  id: string;
  start_time: string;
  service_name: string | null;
  service: { name: string | null } | null;
  services?: { name: string | null } | null;
  master_profiles?: { full_name: string | null } | null;
}

export default function DashboardPage() {
  const { role } = useAuth();

  // Owners and masters see a real operations dashboard (matches mobile)
  if (role === 'owner' || role === 'master') {
    return <StaffDashboard />;
  }

  return <ClientHome />;
}

function ClientHome() {
  const { profile, role, user } = useAuth();
  const { unreadMessages } = useNotifications();
  const supabase = createClient();
  const [stats, setStats] = useState({ bookings: 0, services: 0, appointments: [] as DashboardAppointment[] });
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);

  const fetchDashboardInfo = useCallback(async () => {
    try {
      setLoading(true);
      let nextDbError: string | null = null;

      const { count: servicesCount, error: sErr } = await supabase
        .from('services')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      if (sErr) {
        console.error('[Dashboard] services error:', sErr);
        nextDbError = sErr.message;
      }

      let bookingsCount = 0;
      let upcomingApts: DashboardAppointment[] = [];

      if (user) {
        const col = role === 'master' ? 'master_id' : 'client_id';

        const { count, error: bErr } = await supabase
          .from('appointments')
          .select('*', { count: 'exact', head: true })
          .eq(col, user.id)
          .eq('status', 'completed');

        if (bErr) console.error('[Dashboard] bookings error:', bErr);
        if (bErr) nextDbError = bErr.message;
        bookingsCount = count || 0;

        const { data: apts, error: aErr } = await supabase
          .from('appointments')
          .select(`id, start_time, service_name, service:services(name)`)
          .eq(col, user.id)
          .gte('start_time', new Date().toISOString())
          .order('start_time', { ascending: true })
          .limit(3);

        if (aErr) console.error('[Dashboard] appointments error:', aErr);
        if (aErr) nextDbError = aErr.message;
        upcomingApts = (apts as DashboardAppointment[]) || [];
      }

      setStats({
        bookings: bookingsCount,
        services: servicesCount || 0,
        appointments: upcomingApts,
      });
      setDbError(nextDbError);
    } catch (err: unknown) {
      console.error('[Dashboard] fetch error:', err);
      setDbError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [user, role, supabase]);

  // Initial fetch
  useEffect(() => {
    const init = async () => {
      await fetchDashboardInfo();
    };
    init();
  }, [fetchDashboardInfo]);

  // Re-fetch when tab becomes visible (session may have just refreshed)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchDashboardInfo();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [fetchDashboardInfo]);

  const firstName = profile?.full_name?.split(' ')[0] || 'there';

  return (
    <div className="animate-fade-in">
      {/* ── Hero Welcome Banner ───────────── */}
      <div style={{ position: 'relative', borderRadius: 'var(--radius-2xl)', overflow: 'hidden', marginBottom: '40px', height: '300px' }}>
        <img src="https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?w=1600&q=80&auto=format&fit=crop" alt="Beauty salon atmosphere" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.7), rgba(0,0,0,0.4), rgba(0,0,0,0.1))' }} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: 'white', padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <Sparkles size={18} style={{ color: 'var(--color-brand-pink)' }} />
            <span style={{ fontSize: '12px', letterSpacing: '3px', textTransform: 'uppercase', color: 'var(--color-brand-pink)', fontWeight: 700 }}>Welcome Back</span>
            <Sparkles size={18} style={{ color: 'var(--color-brand-pink)' }} />
          </div>
          <h1 style={{ fontSize: '48px', fontWeight: 700, marginBottom: '12px', textShadow: '0 2px 10px rgba(0,0,0,0.3)', margin: '0 0 12px 0' }}>
            Hello, {firstName}
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: '15px', maxWidth: '500px', fontWeight: 500 }}>
            {role === 'master'
              ? "Here's your schedule overview for today."
              : role === 'owner'
                ? "Here's your platform performance today."
                : 'Ready to book your next beauty experience?'}
          </p>
          <Link
            href="/dashboard/booking"
            className="btn-pink"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginTop: '24px', padding: '12px 32px', fontSize: '14px', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}
          >
            Book Now <ArrowRight size={16} />
          </Link>
        </div>
      </div>

      {/* DB Error banner (debug) */}
      {dbError && (
        <div className="glass-card p-4 mb-6 border-l-4 border-red-400 bg-red-50/50">
          <p className="text-sm text-red-600 font-medium">⚠️ Database error: {dbError}</p>
        </div>
      )}

      {/* Alerts */}
      {unreadMessages > 0 && (
        <div className="mb-8">
          <Link
            href="/dashboard/chat"
            className="glass-card p-4 flex items-center justify-between border border-pink-100 hover:shadow-md transition-all bg-gradient-to-r from-pink-50/80 to-rose-50/40"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-400 to-rose-300 flex items-center justify-center">
                <MessageSquare size={18} className="text-white" />
              </div>
              <div>
                <p className="font-semibold text-sm text-[var(--color-text-primary)]">
                  {unreadMessages} Unread Message{unreadMessages !== 1 ? 's' : ''}
                </p>
                <p className="text-xs text-[var(--color-text-muted)]">Tap to open inbox</p>
              </div>
            </div>
            <ChevronRight size={18} className="text-[var(--color-text-muted)]" />
          </Link>
        </div>
      )}

      {/* ── Quick Actions ────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-10">
        {quickActions.map((action, idx) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.href}
              href={action.href}
              className={`group relative rounded-[var(--radius-xl)] overflow-hidden h-40 hover:-translate-y-2 hover:shadow-xl transition-all duration-300 animate-slide-up stagger-${idx + 1}`}
              style={{ animationFillMode: 'both' }}
            >
              <img src={action.img} alt={action.label} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
              <div className={`absolute inset-0 bg-gradient-to-t ${action.gradient} opacity-30 group-hover:opacity-40 transition-opacity`} />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                    <Icon size={16} className="text-white" />
                  </div>
                  <span className="text-sm font-bold text-white drop-shadow-md">{action.label}</span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* ── Stats + Upcoming Grid ────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
        {/* Stats Cards */}
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="glass-card-pink p-6 flex flex-col gap-3 hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-pink-400 to-rose-300 flex items-center justify-center shadow-md animate-float">
              <Star size={20} className="text-white" />
            </div>
            <div>
              <p className="text-3xl font-bold text-[var(--color-text-primary)]">{loading ? '—' : ((profile as Record<string, unknown>)?.loyalty_points as number || 0)}</p>
              <p className="text-sm font-medium text-[var(--color-text-secondary)] mt-1">Loyalty Points</p>
            </div>
          </div>
          <div className="glass-card-purple p-6 flex flex-col gap-3 hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-400 to-purple-300 flex items-center justify-center shadow-md animate-float" style={{ animationDelay: '0.5s' }}>
              <Calendar size={20} className="text-white" />
            </div>
            <div>
              <p className="text-3xl font-bold text-[var(--color-text-primary)]">{loading ? '—' : stats.bookings}</p>
              <p className="text-sm font-medium text-[var(--color-text-secondary)] mt-1">Completed</p>
            </div>
          </div>
          <div className="glass-card p-6 flex flex-col gap-3 hover:shadow-lg hover:-translate-y-1 transition-all duration-300" style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.06), rgba(34,197,94,0.04))' }}>
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-400 to-cyan-300 flex items-center justify-center shadow-md animate-float" style={{ animationDelay: '1s' }}>
              <TrendingUp size={20} className="text-white" />
            </div>
            <div>
              <p className="text-3xl font-bold text-[var(--color-text-primary)]">{loading ? '—' : stats.services}</p>
              <p className="text-sm font-medium text-[var(--color-text-secondary)] mt-1">Services</p>
            </div>
          </div>
        </div>

        {/* Upcoming Appointments */}
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-[var(--color-text-primary)]">Upcoming</h2>
            <Link href="/dashboard/appointments" className="text-sm font-semibold text-[var(--color-brand-pink-dark)] hover:opacity-80 transition-opacity">
              View All →
            </Link>
          </div>
          {loading ? (
            <div className="space-y-3">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="shimmer h-16 rounded-xl" />
              ))}
            </div>
          ) : stats.appointments.length > 0 ? (
            <div className="space-y-3">
              {stats.appointments.map((apt) => {
                const dateObj = new Date(apt.start_time);
                return (
                  <div key={apt.id} className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-pink-50 to-purple-50 border border-pink-100/50 hover:shadow-md transition-all">
                    <div className="w-12 h-12 rounded-xl bg-white border border-pink-100 flex flex-col items-center justify-center shrink-0 shadow-sm">
                      <span className="text-[10px] font-bold text-pink-400 uppercase">
                        {dateObj.toLocaleDateString('en-GB', { month: 'short' })}
                      </span>
                      <span className="text-sm font-bold text-[var(--color-primary)]">
                        {dateObj.getDate()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
                        {apt.service?.name || apt.service_name || 'Appointment'}
                      </p>
                      <p className="text-xs text-[var(--color-text-muted)]">
                        {dateObj.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <ArrowRight size={14} className="text-pink-300" />
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-pink-100 to-purple-100 flex items-center justify-center mb-4 animate-float">
                <Calendar size={28} className="text-pink-300" />
              </div>
              <p className="text-sm text-[var(--color-text-secondary)] mb-4">No upcoming appointments</p>
              <Link href="/dashboard/booking" className="btn-pink px-6 py-2.5 text-xs">
                Book Now
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* ── Featured Section ─────────────────────────────── */}
      <div className="glass-card gradient-border-glow p-8 mb-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-pink-200/30 to-transparent rounded-bl-full" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-purple-200/20 to-transparent rounded-tr-full" />
        <div className="blob-mint -top-16 left-1/3 opacity-40" style={{ width: '150px', height: '150px' }} />
        <div className="relative z-10 flex flex-col sm:flex-row items-center gap-6">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-pink-400 to-purple-400 flex items-center justify-center shadow-lg animate-float shrink-0">
            <Heart size={32} className="text-white" />
          </div>
          <div className="text-center sm:text-left flex-1">
            <h3 className="text-xl font-bold text-[var(--color-text-primary)] mb-1">Discover Your Perfect Look</h3>
            <p className="text-sm text-[var(--color-text-secondary)] max-w-md">
              Browse our curated collection of beauty services, shop premium products, and learn from expert courses.
            </p>
          </div>
          <Link href="/dashboard/discover" className="btn-primary px-6 py-3 text-sm whitespace-nowrap shrink-0">
            Explore Now
          </Link>
        </div>
      </div>
    </div>
  );
}
