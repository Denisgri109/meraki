'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/contexts/NotificationsContext';
import { createClient } from '@/lib/supabase/client';
import {
  Calendar,
  Users,
  ShoppingBag,
  Package,
  Settings,
  Clock,
  MessageSquare,
  TrendingUp,
  GraduationCap,
  Gift,
  ChevronRight,
  BarChart3,
  AlertCircle,
} from 'lucide-react';

type ApptRow = {
  id: string;
  start_time: string;
  status: string;
  price: number | null;
  service_name: string | null;
  service: { name: string | null } | null;
  client: { full_name: string | null } | null;
};

type Stats = {
  todayAppointments: number;
  todayEarnings: number;
  pendingAppointments: number;
  activeServices: number;
  totalClients: number;
  lowStockCount: number;
};

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 18) return 'Good Afternoon';
  return 'Good Evening';
};

const formatCurrency = (amount: number, currency: string | null | undefined) => {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency || 'EUR',
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency || '€'}${Math.round(amount)}`;
  }
};

export default function StaffDashboard() {
  const { profile, user, role } = useAuth();
  const { unreadMessages } = useNotifications();
  const supabase = createClient();
  const isOwner = role === 'owner';

  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats>({
    todayAppointments: 0,
    todayEarnings: 0,
    pendingAppointments: 0,
    activeServices: 0,
    totalClients: 0,
    lowStockCount: 0,
  });
  const [appointments, setAppointments] = useState<ApptRow[]>([]);

  const fetchAll = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      let nextErr: string | null = null;

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date(todayStart);
      todayEnd.setDate(todayEnd.getDate() + 1);

      // Owners see all platform data; masters see their own
      const masterFilter = <T extends { eq: (col: string, val: string) => T }>(q: T): T =>
        isOwner ? q : q.eq('master_id', user.id);

      // Today's appointments (for stats)
      const todayQ = masterFilter(
        supabase
          .from('appointments')
          .select('id, start_time, status, price, service_name, service:services(name), client:profiles!appointments_client_id_fkey(full_name)')
          .gte('start_time', todayStart.toISOString())
          .lt('start_time', todayEnd.toISOString())
          .in('status', ['confirmed', 'pending', 'completed'])
          .order('start_time'),
      );
      const { data: todayData, error: tErr } = await todayQ;
      if (tErr) {
        console.error('[StaffDashboard] today appts:', tErr);
        nextErr = tErr.message;
      }
      const todayList = (todayData as ApptRow[]) || [];

      // Upcoming confirmed appointments (next 5)
      const upcomingQ = masterFilter(
        supabase
          .from('appointments')
          .select('id, start_time, status, price, service_name, service:services(name), client:profiles!appointments_client_id_fkey(full_name)')
          .eq('status', 'confirmed')
          .gte('start_time', new Date().toISOString())
          .order('start_time', { ascending: true })
          .limit(5),
      );
      const { data: upcomingData, error: uErr } = await upcomingQ;
      if (uErr) console.error('[StaffDashboard] upcoming appts:', uErr);

      // Pending count
      const pendingQ = masterFilter(
        supabase.from('appointments').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      );
      const { count: pendingCount, error: pErr } = await pendingQ;
      if (pErr) console.error('[StaffDashboard] pending:', pErr);

      // Active services (owner: all platform; master: own)
      let activeServicesCount = 0;
      if (isOwner) {
        const { count } = await supabase
          .from('services')
          .select('*', { count: 'exact', head: true })
          .eq('is_active', true);
        activeServicesCount = count || 0;
      } else {
        const { count } = await supabase
          .from('services')
          .select('*', { count: 'exact', head: true })
          .eq('created_by', user.id)
          .eq('is_active', true);
        activeServicesCount = count || 0;
      }

      // Total unique clients
      const clientsQ = masterFilter(
        supabase.from('appointments').select('client_id').not('client_id', 'is', null),
      );
      const { data: clientsRows } = await clientsQ;
      const totalClients = new Set(((clientsRows as { client_id: string }[]) || []).map((r) => r.client_id)).size;

      // Today earnings (completed only)
      const todayEarnings = todayList
        .filter((a) => a.status === 'completed')
        .reduce((sum, a) => sum + (a.price || 0), 0);

      // Low-stock products (owner only)
      let lowStockCount = 0;
      if (isOwner) {
        try {
          const { data: lowStock } = await supabase
            .from('products')
            .select('id, stock_count, low_stock_threshold')
            .eq('is_active', true);
          lowStockCount = ((lowStock as { stock_count: number | null; low_stock_threshold: number | null }[]) || [])
            .filter((p) => (p.stock_count ?? 0) <= (p.low_stock_threshold ?? 5))
            .length;
        } catch {
          /* products table may not have those cols */
        }
      }

      setStats({
        todayAppointments: todayList.filter((a) => a.status !== 'completed').length,
        todayEarnings,
        pendingAppointments: pendingCount || 0,
        activeServices: activeServicesCount,
        totalClients,
        lowStockCount,
      });
      setAppointments((upcomingData as ApptRow[]) || []);
      setDbError(nextErr);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      console.error('[StaffDashboard] error:', err);
      setDbError(msg);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, isOwner]);

  // fetchAll is async data fetching; setState within is intentional.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') fetchAll();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [fetchAll]);

  // Realtime: refresh stats whenever appointments / products change
  useEffect(() => {
    if (!user) return;
    const apptChannel = supabase
      .channel(`staff-dashboard-appts-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => {
        fetchAll();
      })
      .subscribe();

    const productsChannel = isOwner
      ? supabase
          .channel(`staff-dashboard-products-${user.id}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => {
            fetchAll();
          })
          .subscribe()
      : null;

    return () => {
      supabase.removeChannel(apptChannel);
      if (productsChannel) supabase.removeChannel(productsChannel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, isOwner]);

  const firstName = profile?.full_name?.split(' ')[0] || (isOwner ? 'Owner' : 'Master');
  const currency = (profile?.currency as string | undefined) || 'EUR';

  const businessActions = isOwner
    ? [
        { href: '/dashboard/masters', icon: Users, label: 'Masters', color: '#EE2B5B' },
        { href: '/dashboard/orders', icon: Package, label: 'Orders', color: '#F472B6' },
        { href: '/dashboard/services', icon: Calendar, label: 'Services', color: '#60A5FA' },
        { href: '/dashboard/availability', icon: Clock, label: 'Availability', color: '#F472B6' },
        { href: '/dashboard/inventory', icon: Package, label: 'Inventory', color: '#F19A3E' },
        { href: '/dashboard/shop', icon: ShoppingBag, label: 'Shop', color: '#34D399' },
        { href: '/dashboard/analytics', icon: BarChart3, label: 'Analytics', color: '#8B5CF6' },
        { href: '/dashboard/loyalty', icon: Gift, label: 'Loyalty', color: '#FBBF24' },
        { href: '/dashboard/academy', icon: GraduationCap, label: 'Academy', color: '#06B6D4' },
        { href: '/dashboard/settings', icon: Settings, label: 'Settings', color: '#94A3B8' },
      ]
    : [
        { href: '/dashboard/services', icon: Calendar, label: 'Services', color: '#60A5FA' },
        { href: '/dashboard/availability', icon: Clock, label: 'Availability', color: '#F472B6' },
        { href: '/dashboard/appointments', icon: Calendar, label: 'Appointments', color: '#EE2B5B' },
        { href: '/dashboard/loyalty', icon: Gift, label: 'Loyalty', color: '#FBBF24' },
        { href: '/dashboard/academy', icon: GraduationCap, label: 'Academy', color: '#06B6D4' },
        { href: '/dashboard/settings', icon: Settings, label: 'Settings', color: '#94A3B8' },
      ];

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-[var(--color-text-muted)] mb-1">
            {greeting()},
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold text-[var(--color-text-primary)]">
            {firstName}
          </h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">
            {isOwner ? 'Platform overview & operations' : "Today's schedule overview"}
          </p>
        </div>
      </div>

      {dbError && (
        <div className="glass-card p-4 mb-6 border-l-4 border-red-400 bg-red-50/60 flex items-center gap-2">
          <AlertCircle size={16} className="text-red-500" />
          <p className="text-sm text-red-600 font-medium">Database error: {dbError}</p>
        </div>
      )}

      {/* Hero Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="md:col-span-1 glass-card p-6 bg-gradient-to-br from-amber-50 to-orange-50/40 border border-amber-100/60 hover:shadow-lg transition-all">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-300 flex items-center justify-center mb-4 shadow-sm">
            <TrendingUp size={18} className="text-white" />
          </div>
          <p className="text-3xl font-bold text-[var(--color-text-primary)] tracking-tight">
            {loading ? '—' : formatCurrency(stats.todayEarnings, currency)}
          </p>
          <p className="text-xs font-semibold tracking-wider uppercase text-[var(--color-text-muted)] mt-1">
            {isOwner ? 'Revenue Today' : 'Earnings Today'}
          </p>
        </div>
        <div className="md:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Today" value={loading ? '—' : stats.todayAppointments} accent="from-pink-400 to-rose-300" />
          <StatCard label="Pending" value={loading ? '—' : stats.pendingAppointments} accent="from-violet-400 to-purple-300" />
          <StatCard label="Services" value={loading ? '—' : stats.activeServices} accent="from-emerald-400 to-teal-300" />
          <StatCard label="Clients" value={loading ? '—' : stats.totalClients} accent="from-blue-400 to-cyan-300" />
        </div>
      </div>

      {/* Alerts */}
      {(unreadMessages > 0 || (isOwner && stats.lowStockCount > 0)) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
          {unreadMessages > 0 && (
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
          )}
          {isOwner && stats.lowStockCount > 0 && (
            <Link
              href="/dashboard/inventory"
              className="glass-card p-4 flex items-center justify-between border border-amber-100 hover:shadow-md transition-all bg-gradient-to-r from-amber-50/80 to-orange-50/40"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-400 flex items-center justify-center">
                  <Package size={18} className="text-white" />
                </div>
                <div>
                  <p className="font-semibold text-sm text-[var(--color-text-primary)]">
                    {stats.lowStockCount} Low-stock Product{stats.lowStockCount !== 1 ? 's' : ''}
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)]">Restock soon</p>
                </div>
              </div>
              <ChevronRight size={18} className="text-[var(--color-text-muted)]" />
            </Link>
          )}
        </div>
      )}

      {/* Upcoming Appointments */}
      <section className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-bold tracking-[0.2em] uppercase text-[var(--color-text-muted)]">
            Upcoming Appointments
          </h2>
          <Link
            href="/dashboard/appointments"
            className="text-xs font-semibold text-[var(--color-brand-pink-dark)] hover:opacity-80 inline-flex items-center gap-1"
          >
            View all <ChevronRight size={14} />
          </Link>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="shimmer h-16 rounded-xl" />
            ))}
          </div>
        ) : appointments.length === 0 ? (
          <div className="glass-card p-10 text-center">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-pink-100 to-purple-100 flex items-center justify-center mx-auto mb-3">
              <Calendar size={24} className="text-pink-300" />
            </div>
            <p className="text-sm text-[var(--color-text-secondary)]">No upcoming bookings</p>
          </div>
        ) : (
          <div className="space-y-3">
            {appointments.map((apt) => {
              const d = new Date(apt.start_time);
              return (
                <Link
                  key={apt.id}
                  href="/dashboard/appointments"
                  className="glass-card p-4 flex items-center gap-4 hover:shadow-lg hover:-translate-y-0.5 transition-all"
                >
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-pink-50 to-purple-50 border border-pink-100 flex flex-col items-center justify-center shrink-0">
                    <span className="text-[10px] font-bold uppercase text-pink-400 tracking-wider">
                      {d.toLocaleDateString(undefined, { month: 'short' })}
                    </span>
                    <span className="text-base font-bold text-[var(--color-text-primary)] leading-tight">
                      {d.getDate()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
                      {apt.service?.name || apt.service_name || 'Service'}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)] truncate">
                      {apt.client?.full_name || 'Client'} ·{' '}
                      {d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-[var(--color-text-secondary)] shrink-0">
                    {apt.price ? formatCurrency(apt.price, currency) : ''}
                  </span>
                  <ChevronRight size={16} className="text-[var(--color-text-muted)] shrink-0" />
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* Business Control */}
      <section className="mb-10">
        <h2 className="text-xs font-bold tracking-[0.2em] uppercase text-[var(--color-text-muted)] mb-4">
          {isOwner ? 'Business Control' : 'Manage'}
        </h2>
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          {businessActions.map((a) => {
            const Icon = a.icon;
            return (
              <Link
                key={a.href}
                href={a.href}
                className="glass-card p-4 flex flex-col items-center gap-3 hover:shadow-lg hover:-translate-y-1 transition-all duration-200"
              >
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center"
                  style={{ backgroundColor: `${a.color}1A` }}
                >
                  <Icon size={20} style={{ color: a.color }} />
                </div>
                <span className="text-xs font-semibold text-[var(--color-text-primary)] text-center">
                  {a.label}
                </span>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: number | string; accent: string }) {
  return (
    <div className="glass-card p-4 hover:shadow-md transition-all">
      <div className={`w-2 h-2 rounded-full bg-gradient-to-br ${accent} mb-3`} />
      <p className="text-2xl font-bold text-[var(--color-text-primary)] tracking-tight">{value}</p>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mt-1">
        {label}
      </p>
    </div>
  );
}
