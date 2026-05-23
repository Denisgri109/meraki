'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/Toast';
import {
  DollarSign, TrendingUp, ShoppingBag, GraduationCap, Clock,
  Users, CreditCard, ExternalLink, Loader2, ArrowUpRight,
  ArrowDownRight, Calendar, Filter, CheckCircle, AlertCircle,
  Wallet, BarChart3, Settings, RefreshCw, Ban, FileText,
  ChevronDown, Percent, RotateCcw, Receipt, Download, Eye
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────
interface PaymentRow {
  id: string;
  amount: number;
  currency: string | null;
  status: string;
  payment_type: string;
  description: string | null;
  created_at: string;
  appointment_id: string | null;
  order_id: string | null;
  stripe_payment_intent_id: string;
  user_id: string | null;
}

interface AppointmentInfo {
  id: string;
  master_id: string;
  service_name: string | null;
  price: number;
  client_name: string | null;
  master_name: string | null;
  commission_rate: number;
}

interface OrderInfo {
  id: string;
  total: number;
  status: string;
  user_name: string | null;
}

interface MasterCommission {
  master_id: string;
  master_name: string;
  avatar_url: string | null;
  total_revenue: number;
  commission_rate: number;
  commission_amount: number;
  net_to_master: number;
  booking_count: number;
}

interface RefundablePayment {
  id: string;
  amount: number;
  currency: string;
  status: string;
  stripe_payment_intent_id: string;
  description: string | null;
  created_at: string;
  client_name: string | null;
}

interface OwnerPayoutRecord {
  id: string;
  master_id: string | null;
  master_name: string | null;
  amount: number;
  currency: string;
  status: string;
  stripe_payout_id: string | null;
  period_start: string | null;
  period_end: string | null;
  notes: string | null;
  created_at: string;
  completed_at: string | null;
}

type TabValue = 'overview' | 'shop' | 'academy' | 'commissions' | 'payouts' | 'refunds' | 'reports';
type PeriodFilter = '7d' | '30d' | '90d' | 'year' | 'all';

const periodOptions: { value: PeriodFilter; label: string }[] = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: 'year', label: 'This year' },
  { value: 'all', label: 'All time' },
];

const tabs: { label: string; value: TabValue; icon: React.ElementType }[] = [
  { label: 'Overview', value: 'overview', icon: BarChart3 },
  { label: 'Shop Sales', value: 'shop', icon: ShoppingBag },
  { label: 'Academy', value: 'academy', icon: GraduationCap },
  { label: 'Commissions', value: 'commissions', icon: Percent },
  { label: 'Payouts', value: 'payouts', icon: Wallet },
  { label: 'Refunds', value: 'refunds', icon: RotateCcw },
  { label: 'Reports', value: 'reports', icon: FileText },
];

function getPayoutStatusBadge(status: string) {
  switch (status) {
    case 'completed': return 'bg-emerald-50 text-emerald-600 border-emerald-200';
    case 'pending': return 'bg-amber-50 text-amber-600 border-amber-200';
    case 'in_transit': return 'bg-blue-50 text-blue-600 border-blue-200';
    case 'failed': return 'bg-red-50 text-red-500 border-red-200';
    default: return 'bg-gray-50 text-gray-500 border-gray-200';
  }
}

function getPayoutStatusLabel(status: string) {
  switch (status) {
    case 'completed': return 'Completed';
    case 'pending': return 'Pending';
    case 'in_transit': return 'In Transit';
    case 'failed': return 'Failed';
    default: return status;
  }
}

function formatCurrency(amount: number, currency = 'EUR') {
  return new Intl.NumberFormat('en-IE', { style: 'currency', currency }).format(amount);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleDateString('en-IE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function getPeriodStart(period: PeriodFilter): string | null {
  if (period === 'all') return null;
  const now = new Date();
  if (period === '7d') now.setDate(now.getDate() - 7);
  else if (period === '30d') now.setDate(now.getDate() - 30);
  else if (period === '90d') now.setDate(now.getDate() - 90);
  else if (period === 'year') { now.setMonth(0); now.setDate(1); }
  return now.toISOString();
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'succeeded': return 'bg-emerald-50 text-emerald-600 border-emerald-200';
    case 'pending': return 'bg-amber-50 text-amber-600 border-amber-200';
    case 'refunded': return 'bg-red-50 text-red-500 border-red-200';
    default: return 'bg-gray-50 text-gray-500 border-gray-200';
  }
}

export default function FinancePage() {
  const { user, profile, role } = useAuth();
  const supabase = createClient();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<TabValue>('overview');
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('30d');
  const [loading, setLoading] = useState(true);

  // Data
  const [shopPayments, setShopPayments] = useState<PaymentRow[]>([]);
  const [bookingPayments, setBookingPayments] = useState<PaymentRow[]>([]);
  const [orderInfoMap, setOrderInfoMap] = useState<Map<string, OrderInfo>>(new Map());
  const [appointmentInfoMap, setAppointmentInfoMap] = useState<Map<string, AppointmentInfo>>(new Map());
  const [masterCommissions, setMasterCommissions] = useState<MasterCommission[]>([]);
  const [academyRevenue, setAcademyRevenue] = useState(0);
  const [academyEnrollments, setAcademyEnrollments] = useState(0);

  // Refund
  const [refundablePayments, setRefundablePayments] = useState<RefundablePayment[]>([]);
  const [refundModalPayment, setRefundModalPayment] = useState<RefundablePayment | null>(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('requested_by_customer');
  const [refundProcessing, setRefundProcessing] = useState(false);

  // Stripe portal
  const [portalLoading, setPortalLoading] = useState(false);

  // Payouts
  const [ownerPayouts, setOwnerPayouts] = useState<OwnerPayoutRecord[]>([]);
  const [payoutsLoading, setPayoutsLoading] = useState(false);

  // ─── Load payouts ─────────────────────────────────────────────
  const loadPayouts = useCallback(async () => {
    if (!user) return;
    setPayoutsLoading(true);
    try {
      const { data: payoutsData, error } = await supabase
        .from('payouts')
        .select('*, master:profiles!payouts_master_id_fkey(full_name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      const records: OwnerPayoutRecord[] = (payoutsData || []).map((p: Record<string, unknown>) => ({
        id: p.id as string,
        master_id: p.master_id as string | null,
        master_name: (p.master as unknown as { full_name: string } | null)?.full_name || null,
        amount: p.amount as number,
        currency: (p.currency as string) || 'eur',
        status: (p.status as string) || 'pending',
        stripe_payout_id: p.stripe_payout_id as string | null,
        period_start: p.period_start as string | null,
        period_end: p.period_end as string | null,
        notes: p.notes as string | null,
        created_at: p.created_at as string,
        completed_at: p.completed_at as string | null,
      }));
      setOwnerPayouts(records);
    } catch (err) {
      console.error('Failed to load payouts:', err);
    } finally {
      setPayoutsLoading(false);
    }
  }, [user, supabase]);

  useEffect(() => { loadPayouts(); }, [loadPayouts]);

  // ─── Load data ──────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const periodStart = getPeriodStart(periodFilter);

      // 1. Load all payments
      let paymentQuery = supabase
        .from('payments')
        .select('*')
        .order('created_at', { ascending: false });

      if (periodStart) paymentQuery = paymentQuery.gte('created_at', periodStart);

      const { data: allPayments } = await paymentQuery;
      const payments = (allPayments || []).filter(p => p.created_at) as PaymentRow[];

      // Separate by type
      const shop = payments.filter(p => p.order_id);
      const booking = payments.filter(p => p.appointment_id && !p.order_id);
      setShopPayments(shop);
      setBookingPayments(booking);

      // 2. Load order info for shop payments
      const oMap = new Map<string, OrderInfo>();
      const orderIds = [...new Set(shop.map(p => p.order_id).filter(Boolean))] as string[];
      if (orderIds.length > 0) {
        const { data: orders } = await supabase
          .from('orders')
          .select('id, total, status, user_id, user:profiles!orders_user_id_fkey(full_name)')
          .in('id', orderIds);

        (orders || []).forEach((o: Record<string, unknown>) => {
          oMap.set(o.id as string, {
            id: o.id as string,
            total: o.total as number,
            status: o.status as string,
            user_name: (o.user as unknown as { full_name: string } | null)?.full_name || null,
          });
        });
        setOrderInfoMap(oMap);
      }

      // 3. Load appointment info for booking payments + commissions
      const aMap = new Map<string, AppointmentInfo>();
      const appointmentIds = [...new Set(booking.map(p => p.appointment_id).filter(Boolean))] as string[];
      if (appointmentIds.length > 0) {
        const { data: appointments } = await supabase
          .from('appointments')
          .select(`
            id, master_id, service_name, price,
            client:profiles!appointments_client_id_fkey(full_name),
            master:profiles!appointments_master_id_fkey(full_name, commission_rate)
          `)
          .in('id', appointmentIds);

        (appointments || []).forEach(a => {
          const client = a.client as unknown as { full_name: string } | null;
          const master = a.master as unknown as { full_name: string; commission_rate: number | null } | null;
          aMap.set(a.id, {
            id: a.id,
            master_id: a.master_id,
            service_name: a.service_name,
            price: a.price,
            client_name: client?.full_name || null,
            master_name: master?.full_name || null,
            commission_rate: master?.commission_rate ?? 0.20,
          });
        });
        setAppointmentInfoMap(aMap);

        // Build commission breakdown by master
        const masterMap = new Map<string, MasterCommission>();
        booking.filter(p => p.status === 'succeeded').forEach(p => {
          const info = p.appointment_id ? aMap.get(p.appointment_id) : null;
          if (!info) return;
          const existing = masterMap.get(info.master_id);
          const commRate = info.commission_rate;
          const commAmount = p.amount * commRate;
          if (existing) {
            existing.total_revenue += p.amount;
            existing.commission_amount += commAmount;
            existing.net_to_master += (p.amount - commAmount);
            existing.booking_count += 1;
          } else {
            masterMap.set(info.master_id, {
              master_id: info.master_id,
              master_name: info.master_name || 'Unknown',
              avatar_url: null,
              total_revenue: p.amount,
              commission_rate: commRate,
              commission_amount: commAmount,
              net_to_master: p.amount - commAmount,
              booking_count: 1,
            });
          }
        });
        setMasterCommissions(Array.from(masterMap.values()));
      }

      // 4. Academy revenue (from course_enrollments)
      let enrollQuery = supabase
        .from('course_enrollments')
        .select('id, course:courses(price)');
      if (periodStart) enrollQuery = enrollQuery.gte('enrolled_at', periodStart);

      const { data: enrollments } = await enrollQuery;
      const enrollCount = (enrollments || []).length;
      const acRevenue = (enrollments || []).reduce((sum, e) => {
        const course = e.course as unknown as { price: number } | null;
        return sum + (course?.price || 0);
      }, 0);
      setAcademyRevenue(acRevenue);
      setAcademyEnrollments(enrollCount);

      // 5. Refundable payments (succeeded, have stripe PI)
      const refundable: RefundablePayment[] = payments
        .filter(p => p.status === 'succeeded' && p.stripe_payment_intent_id)
        .map(p => {
          const oInfo = p.order_id ? oMap.get(p.order_id) : null;
          const apptInfo = p.appointment_id ? aMap.get(p.appointment_id) : null;
          return {
            id: p.id,
            amount: p.amount,
            currency: p.currency || 'EUR',
            status: p.status,
            stripe_payment_intent_id: p.stripe_payment_intent_id,
            description: p.description || (apptInfo?.service_name ? `Booking: ${apptInfo.service_name}` : oInfo ? 'Shop Order' : 'Payment'),
            created_at: p.created_at,
            client_name: apptInfo?.client_name || oInfo?.user_name || null,
          };
        });
      setRefundablePayments(refundable);

    } catch (err) {
      console.error('Failed to load finance data:', err);
    } finally {
      setLoading(false);
    }
  }, [user, supabase, periodFilter]);

  useEffect(() => { loadData(); }, [loadData]);

  // ─── Computed stats ─────────────────────────────────────────────
  const stats = useMemo(() => {
    const shopTotal = shopPayments.filter(p => p.status === 'succeeded').reduce((s, p) => s + p.amount, 0);
    const bookingTotal = bookingPayments.filter(p => p.status === 'succeeded').reduce((s, p) => s + p.amount, 0);
    const totalCommission = masterCommissions.reduce((s, m) => s + m.commission_amount, 0);
    const totalRefunded = [...shopPayments, ...bookingPayments].filter(p => p.status === 'refunded').reduce((s, p) => s + p.amount, 0);
    return {
      shopTotal,
      bookingTotal,
      academyTotal: academyRevenue,
      totalRevenue: shopTotal + bookingTotal + academyRevenue,
      totalCommission,
      totalRefunded,
      netRevenue: shopTotal + bookingTotal + academyRevenue - totalRefunded,
    };
  }, [shopPayments, bookingPayments, masterCommissions, academyRevenue]);

  // ─── Refund handler ─────────────────────────────────────────────
  const handleRefund = async () => {
    if (!refundModalPayment) return;
    setRefundProcessing(true);
    try {
      const amountCents = refundAmount ? Math.round(parseFloat(refundAmount) * 100) : undefined;
      const { data, error } = await supabase.functions.invoke('process-refund', {
        body: {
          payment_intent_id: refundModalPayment.stripe_payment_intent_id,
          amount: amountCents,
          reason: refundReason,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      showToast(`Refund of ${amountCents ? formatCurrency(parseFloat(refundAmount)) : 'full amount'} processed`, 'success');
      setRefundModalPayment(null);
      setRefundAmount('');
      loadData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Refund failed', 'error');
    } finally {
      setRefundProcessing(false);
    }
  };

  // ─── Stripe Portal ─────────────────────────────────────────────
  const handleOpenPortal = async () => {
    setPortalLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-portal-session', { body: {} });
      if (error) throw error;
      if (data?.url) window.open(data.url, '_blank');
    } catch (err) {
      showToast('Failed to open billing portal', 'error');
      console.error(err);
    } finally {
      setPortalLoading(false);
    }
  };

  // ─── Stripe Dashboard (owner) ──────────────────────────────────
  const handleOwnerDashboard = async () => {
    setPortalLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('stripe-connect-dashboard', { body: {} });
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, '_blank');
      } else {
        showToast('No Stripe Dashboard available. Connect your account first.', 'error');
      }
    } catch {
      showToast('Failed to open Stripe Dashboard', 'error');
    } finally {
      setPortalLoading(false);
    }
  };

  if (role !== 'owner') {
    return (
      <div className="max-w-4xl mx-auto py-12 text-center">
        <div className="glass-card p-12">
          <Ban size={48} className="mx-auto text-[var(--color-text-muted)] mb-4" />
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-2">Owner Finance</h1>
          <p className="text-[var(--color-text-secondary)]">This page is available for salon owners only.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[var(--color-text-primary)]">Finance</h1>
          <p className="text-[var(--color-text-secondary)] text-sm mt-1">Revenue tracking, commissions, and payouts</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={periodFilter}
            onChange={e => setPeriodFilter(e.target.value as PeriodFilter)}
            className="input-glass text-sm py-2 px-3 pr-8"
          >
            {periodOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <button onClick={loadData} disabled={loading} className="p-2 rounded-xl hover:bg-[var(--color-surface-light)] transition-colors cursor-pointer" title="Refresh">
            <RefreshCw size={16} className={`text-[var(--color-text-muted)] ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-[var(--color-surface-light)] rounded-2xl overflow-x-auto">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap cursor-pointer ${
                activeTab === tab.value
                  ? 'bg-white shadow-sm text-[var(--color-text-primary)]'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
              }`}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ─── Overview ──────────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Stats grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={DollarSign} gradient="from-emerald-100 to-teal-100" iconColor="text-emerald-600" label="Total Revenue" value={formatCurrency(stats.totalRevenue)} sub={`${shopPayments.length + bookingPayments.length} transactions`} />
            <StatCard icon={ShoppingBag} gradient="from-pink-100 to-rose-100" iconColor="text-pink-600" label="Shop Sales" value={formatCurrency(stats.shopTotal)} sub={`${shopPayments.filter(p=>p.status==='succeeded').length} orders`} />
            <StatCard icon={CreditCard} gradient="from-sky-100 to-cyan-100" iconColor="text-sky-600" label="Booking Revenue" value={formatCurrency(stats.bookingTotal)} sub={`${bookingPayments.filter(p=>p.status==='succeeded').length} bookings`} />
            <StatCard icon={GraduationCap} gradient="from-violet-100 to-purple-100" iconColor="text-violet-600" label="Academy Revenue" value={formatCurrency(stats.academyTotal)} sub={`${academyEnrollments} enrollments`} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard icon={Percent} gradient="from-amber-100 to-orange-100" iconColor="text-amber-600" label="Total Commission" value={formatCurrency(stats.totalCommission)} sub="From master services" />
            <StatCard icon={ArrowDownRight} gradient="from-red-100 to-rose-100" iconColor="text-red-500" label="Total Refunded" value={formatCurrency(stats.totalRefunded)} sub="Refunds processed" />
            <StatCard icon={TrendingUp} gradient="from-emerald-100 to-teal-100" iconColor="text-emerald-600" label="Net Revenue" value={formatCurrency(stats.netRevenue)} sub="After refunds" />
          </div>

          {/* Quick Actions */}
          <div className="glass-card p-6">
            <h3 className="font-bold text-[var(--color-text-primary)] mb-4">Quick Actions</h3>
            <div className="flex flex-wrap gap-3">
              <button onClick={handleOwnerDashboard} disabled={portalLoading} className="btn-pink px-4 py-2 text-sm flex items-center gap-2">
                {portalLoading ? <Loader2 size={14} className="animate-spin" /> : <ExternalLink size={14} />}
                Stripe Dashboard
              </button>
              <button onClick={handleOpenPortal} disabled={portalLoading} className="px-4 py-2 text-sm rounded-xl border border-[var(--color-border-light)] hover:bg-[var(--color-surface-light)] transition-colors flex items-center gap-2 cursor-pointer">
                <CreditCard size={14} /> Customer Portal
              </button>
              <button onClick={() => setActiveTab('refunds')} className="px-4 py-2 text-sm rounded-xl border border-[var(--color-border-light)] hover:bg-[var(--color-surface-light)] transition-colors flex items-center gap-2 cursor-pointer">
                <RotateCcw size={14} /> Process Refund
              </button>
              <button onClick={() => setActiveTab('reports')} className="px-4 py-2 text-sm rounded-xl border border-[var(--color-border-light)] hover:bg-[var(--color-surface-light)] transition-colors flex items-center gap-2 cursor-pointer">
                <Download size={14} /> Reports
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Shop Sales ────────────────────────────────────────────── */}
      {activeTab === 'shop' && (
        <div className="space-y-4">
          <div className="glass-card p-5 flex items-center gap-4">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-pink-200 to-rose-200 flex items-center justify-center">
              <ShoppingBag size={20} className="text-pink-600" />
            </div>
            <div>
              <h3 className="font-bold text-[var(--color-text-primary)]">Shop Sales Revenue</h3>
              <p className="text-xs text-[var(--color-text-muted)]">{shopPayments.length} transactions in period</p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-2xl font-bold text-[var(--color-text-primary)]">{formatCurrency(stats.shopTotal)}</p>
              <p className="text-xs text-[var(--color-text-muted)]">Total shop revenue</p>
            </div>
          </div>

          <PaymentsList
            payments={shopPayments}
            loading={loading}
            getLabel={p => {
              const order = p.order_id ? orderInfoMap.get(p.order_id) : null;
              return order ? `Order #${p.order_id?.slice(0, 8).toUpperCase()}` : (p.description || 'Shop Payment');
            }}
            getSubLabel={p => {
              const order = p.order_id ? orderInfoMap.get(p.order_id) : null;
              return order?.user_name || '';
            }}
            emptyIcon={ShoppingBag}
            emptyText="No shop sales in this period"
          />
        </div>
      )}

      {/* ─── Academy ───────────────────────────────────────────────── */}
      {activeTab === 'academy' && (
        <div className="space-y-4">
          <div className="glass-card p-5 flex items-center gap-4">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-violet-200 to-purple-200 flex items-center justify-center">
              <GraduationCap size={20} className="text-violet-600" />
            </div>
            <div>
              <h3 className="font-bold text-[var(--color-text-primary)]">Academy Revenue</h3>
              <p className="text-xs text-[var(--color-text-muted)]">From course enrollments</p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-2xl font-bold text-[var(--color-text-primary)]">{formatCurrency(academyRevenue)}</p>
              <p className="text-xs text-[var(--color-text-muted)]">{academyEnrollments} enrollments</p>
            </div>
          </div>

          <div className="glass-card p-6">
            <p className="text-sm text-[var(--color-text-secondary)]">
              Academy revenue tracks total enrollment value across all published courses. When Stripe payment integration is enabled for course purchases, payment transactions will appear here.
            </p>
            <p className="text-xs text-[var(--color-text-muted)] mt-3">
              Currently, course enrollment is direct. Revenue shown is based on course price × enrollments for the selected period.
            </p>
          </div>
        </div>
      )}

      {/* ─── Commissions ───────────────────────────────────────────── */}
      {activeTab === 'commissions' && (
        <div className="space-y-4">
          <div className="glass-card p-5 flex items-center gap-4">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-200 to-orange-200 flex items-center justify-center">
              <Percent size={20} className="text-amber-600" />
            </div>
            <div>
              <h3 className="font-bold text-[var(--color-text-primary)]">Commission Tracking</h3>
              <p className="text-xs text-[var(--color-text-muted)]">Platform commission from master services</p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-2xl font-bold text-[var(--color-text-primary)]">{formatCurrency(stats.totalCommission)}</p>
              <p className="text-xs text-[var(--color-text-muted)]">Total earned</p>
            </div>
          </div>

          <div className="glass-card overflow-hidden">
            <div className="px-6 py-3 border-b border-[var(--color-border-light)] grid grid-cols-6 gap-4 text-[10px] uppercase tracking-wider font-semibold text-[var(--color-text-muted)]">
              <span className="col-span-2">Master</span>
              <span className="text-right">Revenue</span>
              <span className="text-right">Rate</span>
              <span className="text-right">Commission</span>
              <span className="text-right">Net to Master</span>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={24} className="animate-spin text-[var(--color-text-muted)]" />
              </div>
            ) : masterCommissions.length === 0 ? (
              <div className="text-center py-12">
                <Users size={32} className="mx-auto text-[var(--color-text-muted)] mb-2" />
                <p className="text-sm text-[var(--color-text-muted)]">No commission data for this period</p>
              </div>
            ) : (
              <div className="divide-y divide-[var(--color-border-light)]">
                {masterCommissions.map(mc => (
                  <div key={mc.master_id} className="px-6 py-4 grid grid-cols-6 gap-4 items-center hover:bg-[var(--color-surface-light)] transition-colors">
                    <div className="col-span-2 flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[var(--color-brand-pink)] to-[var(--color-brand-pink-dark)] flex items-center justify-center text-white text-sm font-semibold shrink-0">
                        {mc.master_name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">{mc.master_name}</p>
                        <p className="text-[10px] text-[var(--color-text-muted)]">{mc.booking_count} booking{mc.booking_count !== 1 ? 's' : ''}</p>
                      </div>
                    </div>
                    <p className="text-sm font-medium text-[var(--color-text-primary)] text-right">{formatCurrency(mc.total_revenue)}</p>
                    <p className="text-sm text-[var(--color-text-secondary)] text-right">{(mc.commission_rate * 100).toFixed(0)}%</p>
                    <p className="text-sm font-bold text-amber-600 text-right">{formatCurrency(mc.commission_amount)}</p>
                    <p className="text-sm font-medium text-emerald-600 text-right">{formatCurrency(mc.net_to_master)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Payouts ───────────────────────────────────────────────── */}
      {activeTab === 'payouts' && (
        <div className="space-y-4">
          <div className="glass-card p-5 flex items-center gap-4">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-200 to-teal-200 flex items-center justify-center">
              <Wallet size={20} className="text-emerald-600" />
            </div>
            <div>
              <h3 className="font-bold text-[var(--color-text-primary)]">Payout Tracking</h3>
              <p className="text-xs text-[var(--color-text-muted)]">Automatic scheduled payouts to masters</p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs text-[var(--color-text-muted)]">
                {ownerPayouts.filter(p => p.status === 'pending').length} pending · {ownerPayouts.filter(p => p.status === 'completed').length} completed
              </span>
              <button onClick={loadPayouts} disabled={payoutsLoading} className="p-1.5 rounded-lg hover:bg-[var(--color-surface-light)] transition-colors cursor-pointer">
                <RefreshCw size={14} className={`text-[var(--color-text-muted)] ${payoutsLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          <div className="glass-card p-5">
            <div className="rounded-xl bg-[var(--color-surface-light)] p-4 text-sm text-[var(--color-text-secondary)]">
              <p>Payouts are processed automatically on a rolling schedule via Stripe Connect. Each master receives their earnings minus platform commission directly to their connected bank account.</p>
              <p className="mt-2 text-xs text-[var(--color-text-muted)]">
                Default schedule: <strong>Daily automatic payouts</strong> (2-day rolling basis). Adjust per-master schedules in Stripe Dashboard.
              </p>
            </div>
          </div>

          <div className="glass-card overflow-hidden">
            <div className="px-6 py-3 border-b border-[var(--color-border-light)] flex items-center justify-between">
              <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">Payout History</h4>
              <span className="text-xs text-[var(--color-text-muted)]">{ownerPayouts.length} total</span>
            </div>
            {payoutsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={24} className="animate-spin text-[var(--color-text-muted)]" />
              </div>
            ) : ownerPayouts.length === 0 ? (
              <div className="text-center py-12">
                <Wallet size={32} className="mx-auto text-[var(--color-text-muted)] mb-2" />
                <p className="text-sm text-[var(--color-text-muted)]">No payouts recorded yet</p>
                <p className="text-xs text-[var(--color-text-muted)] mt-1">Payouts appear here once Stripe processes them</p>
              </div>
            ) : (
              <div className="divide-y divide-[var(--color-border-light)]">
                {ownerPayouts.map(payout => (
                  <div key={payout.id} className="px-6 py-4 flex items-center gap-4 hover:bg-[var(--color-surface-light)] transition-colors">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                      payout.status === 'completed' ? 'bg-emerald-50' :
                      payout.status === 'failed' ? 'bg-red-50' :
                      payout.status === 'in_transit' ? 'bg-blue-50' : 'bg-amber-50'
                    }`}>
                      {payout.status === 'completed' ? <CheckCircle size={18} className="text-emerald-600" /> :
                       payout.status === 'failed' ? <AlertCircle size={18} className="text-red-500" /> :
                       payout.status === 'in_transit' ? <ArrowUpRight size={18} className="text-blue-600" /> :
                       <Clock size={18} className="text-amber-600" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                        {payout.master_name || 'Unknown Master'}
                        {payout.stripe_payout_id && <span className="text-[var(--color-text-muted)] font-normal"> · #{payout.stripe_payout_id.slice(-8).toUpperCase()}</span>}
                      </p>
                      <p className="text-xs text-[var(--color-text-muted)]">
                        {payout.period_start && payout.period_end
                          ? `${formatDate(payout.period_start)} — ${formatDate(payout.period_end)}`
                          : formatDateTime(payout.created_at)}
                      </p>
                      {payout.notes && <p className="text-xs text-[var(--color-text-muted)] mt-0.5 truncate">{payout.notes}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-[var(--color-text-primary)]">
                        {formatCurrency(payout.amount / 100, payout.currency?.toUpperCase() || 'EUR')}
                      </p>
                      <span className={`inline-block mt-1 text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full border ${getPayoutStatusBadge(payout.status)}`}>
                        {getPayoutStatusLabel(payout.status)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Refunds ───────────────────────────────────────────────── */}
      {activeTab === 'refunds' && (
        <div className="space-y-4">
          <div className="glass-card p-5 flex items-center gap-4">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-red-200 to-rose-200 flex items-center justify-center">
              <RotateCcw size={20} className="text-red-500" />
            </div>
            <div>
              <h3 className="font-bold text-[var(--color-text-primary)]">Refund Processing</h3>
              <p className="text-xs text-[var(--color-text-muted)]">Issue partial or full refunds</p>
            </div>
          </div>

          <div className="glass-card overflow-hidden">
            <div className="px-6 py-3 border-b border-[var(--color-border-light)] flex items-center justify-between">
              <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">Refundable Payments</h4>
              <span className="text-xs text-[var(--color-text-muted)]">{refundablePayments.length} payment{refundablePayments.length !== 1 ? 's' : ''}</span>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={24} className="animate-spin text-[var(--color-text-muted)]" />
              </div>
            ) : refundablePayments.length === 0 ? (
              <div className="text-center py-12">
                <RotateCcw size={32} className="mx-auto text-[var(--color-text-muted)] mb-2" />
                <p className="text-sm text-[var(--color-text-muted)]">No refundable payments found</p>
              </div>
            ) : (
              <div className="divide-y divide-[var(--color-border-light)]">
                {refundablePayments.map(p => (
                  <div key={p.id} className="px-6 py-4 flex items-center gap-4 hover:bg-[var(--color-surface-light)] transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">{p.description}</p>
                      <p className="text-xs text-[var(--color-text-muted)]">
                        {p.client_name && `${p.client_name} · `}{formatDateTime(p.created_at)}
                      </p>
                    </div>
                    <p className="text-sm font-bold text-[var(--color-text-primary)]">{formatCurrency(p.amount)}</p>
                    <button
                      onClick={() => { setRefundModalPayment(p); setRefundAmount(''); }}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
                    >
                      Refund
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* No-Show Fee Refunds info */}
          <div className="glass-card p-5">
            <div className="flex items-center gap-3 mb-3">
              <AlertCircle size={18} className="text-amber-600" />
              <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">No-Show Fee Refunds</h4>
            </div>
            <p className="text-sm text-[var(--color-text-secondary)]">
              No-show fee charges appear in the refundable list above. Select any no-show charge payment and issue a partial or full refund to return the fee to the client.
            </p>
          </div>
        </div>
      )}

      {/* ─── Reports ───────────────────────────────────────────────── */}
      {activeTab === 'reports' && (
        <div className="space-y-4">
          <div className="glass-card p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-200 to-blue-200 flex items-center justify-center">
                <FileText size={20} className="text-indigo-600" />
              </div>
              <div>
                <h3 className="font-bold text-[var(--color-text-primary)]">Financial Reports</h3>
                <p className="text-xs text-[var(--color-text-muted)]">Summary for {periodOptions.find(o => o.value === periodFilter)?.label}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <ReportRow label="Shop Sales" value={formatCurrency(stats.shopTotal)} />
              <ReportRow label="Booking Revenue" value={formatCurrency(stats.bookingTotal)} />
              <ReportRow label="Academy Revenue" value={formatCurrency(stats.academyTotal)} />
              <ReportRow label="Total Revenue" value={formatCurrency(stats.totalRevenue)} bold />
              <ReportRow label="Commission Earned" value={formatCurrency(stats.totalCommission)} />
              <ReportRow label="Total Refunded" value={`-${formatCurrency(stats.totalRefunded)}`} negative />
              <ReportRow label="Net Revenue" value={formatCurrency(stats.netRevenue)} bold />
              <ReportRow label="Academy Enrollments" value={String(academyEnrollments)} />
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => {
                  const allPayments = [...shopPayments, ...bookingPayments].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                  const rows = [
                    ['Date', 'Type', 'Description', 'Amount', 'Status', 'Client'],
                    ...allPayments.map(p => {
                      const order = p.order_id ? orderInfoMap.get(p.order_id) : null;
                      const appt = p.appointment_id ? appointmentInfoMap.get(p.appointment_id) : null;
                      return [
                        formatDate(p.created_at),
                        p.order_id ? 'Shop' : 'Booking',
                        appt?.service_name || (order ? `Order #${p.order_id?.slice(0, 8)}` : (p.description || 'Payment')),
                        p.amount.toFixed(2),
                        p.status,
                        appt?.client_name || order?.user_name || '',
                      ];
                    }),
                  ];
                  const csv = rows.map(r => r.map(c => `"${(c || '').replace(/"/g, '""')}"`).join(',')).join('\n');
                  const blob = new Blob([csv], { type: 'text/csv' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `finance-report-${periodFilter}.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                  showToast('Financial report downloaded', 'success');
                }}
                className="btn-pink px-4 py-2 text-sm flex items-center gap-2"
              >
                <Download size={14} /> Export Transactions CSV
              </button>
              <button
                onClick={() => {
                  const rows = [
                    ['Date', 'Master', 'Amount', 'Status', 'Period Start', 'Period End', 'Stripe ID'],
                    ...ownerPayouts.map(p => [
                      formatDate(p.created_at),
                      p.master_name || '',
                      (p.amount / 100).toFixed(2),
                      getPayoutStatusLabel(p.status),
                      p.period_start ? formatDate(p.period_start) : '',
                      p.period_end ? formatDate(p.period_end) : '',
                      p.stripe_payout_id || '',
                    ]),
                  ];
                  const csv = rows.map(r => r.map(c => `"${(c || '').replace(/"/g, '""')}"`).join(',')).join('\n');
                  const blob = new Blob([csv], { type: 'text/csv' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `payouts-report.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                  showToast('Payouts report downloaded', 'success');
                }}
                className="px-4 py-2 text-sm rounded-xl border border-[var(--color-border-light)] hover:bg-[var(--color-surface-light)] transition-colors flex items-center gap-2 cursor-pointer"
              >
                <Download size={14} /> Export Payouts CSV
              </button>
              <button onClick={handleOwnerDashboard} disabled={portalLoading} className="px-4 py-2 text-sm rounded-xl border border-[var(--color-border-light)] hover:bg-[var(--color-surface-light)] transition-colors flex items-center gap-2 cursor-pointer">
                {portalLoading ? <Loader2 size={14} className="animate-spin" /> : <ExternalLink size={14} />}
                Full Reports in Stripe
              </button>
              <button onClick={handleOpenPortal} disabled={portalLoading} className="px-4 py-2 text-sm rounded-xl border border-[var(--color-border-light)] hover:bg-[var(--color-surface-light)] transition-colors flex items-center gap-2 cursor-pointer">
                <CreditCard size={14} /> Customer Billing Portal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Refund Modal ──────────────────────────────────────────── */}
      {refundModalPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4" onClick={() => setRefundModalPayment(null)}>
          <div className="glass-card w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-lg text-[var(--color-text-primary)] mb-1">Process Refund</h3>
            <p className="text-sm text-[var(--color-text-secondary)] mb-4">
              {refundModalPayment.description} — {formatCurrency(refundModalPayment.amount)}
            </p>

            <div className="space-y-4">
              <div>
                <label className="label-upper">Refund Amount (leave empty for full refund)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--color-text-muted)]">&euro;</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={refundModalPayment.amount}
                    value={refundAmount}
                    onChange={e => setRefundAmount(e.target.value)}
                    placeholder={refundModalPayment.amount.toFixed(2)}
                    className="input-glass w-full pl-8"
                  />
                </div>
                <p className="text-[10px] text-[var(--color-text-muted)] mt-1">
                  Max: {formatCurrency(refundModalPayment.amount)}
                </p>
              </div>

              <div>
                <label className="label-upper">Reason</label>
                <select value={refundReason} onChange={e => setRefundReason(e.target.value)} className="input-glass w-full">
                  <option value="requested_by_customer">Requested by customer</option>
                  <option value="duplicate">Duplicate charge</option>
                  <option value="fraudulent">Fraudulent</option>
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={() => setRefundModalPayment(null)} className="flex-1 px-4 py-2.5 rounded-xl border border-[var(--color-border-light)] text-sm font-medium hover:bg-[var(--color-surface-light)] transition-colors cursor-pointer">
                  Cancel
                </button>
                <button
                  onClick={handleRefund}
                  disabled={refundProcessing}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  {refundProcessing ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                  {refundAmount ? `Refund ${formatCurrency(parseFloat(refundAmount) || 0)}` : 'Full Refund'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Reusable components ─────────────────────────────────────────────
function StatCard({ icon: Icon, gradient, iconColor, label, value, sub }: {
  icon: React.ElementType; gradient: string; iconColor: string; label: string; value: string; sub: string;
}) {
  return (
    <div className="glass-card p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-10 h-10 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center`}>
          <Icon size={20} className={iconColor} />
        </div>
        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">{label}</span>
      </div>
      <p className="text-2xl font-bold text-[var(--color-text-primary)]">{value}</p>
      <p className="text-xs text-[var(--color-text-muted)] mt-1">{sub}</p>
    </div>
  );
}

function ReportRow({ label, value, bold, negative }: { label: string; value: string; bold?: boolean; negative?: boolean }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--color-surface-light)]">
      <span className={`text-sm ${bold ? 'font-bold text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)]'}`}>{label}</span>
      <span className={`text-sm font-semibold ${negative ? 'text-red-500' : bold ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)]'}`}>{value}</span>
    </div>
  );
}

function PaymentsList({ payments, loading, getLabel, getSubLabel, emptyIcon: EmptyIcon, emptyText }: {
  payments: PaymentRow[]; loading: boolean; getLabel: (p: PaymentRow) => string; getSubLabel: (p: PaymentRow) => string; emptyIcon: React.ElementType; emptyText: string;
}) {
  if (loading) {
    return (
      <div className="glass-card flex items-center justify-center py-16">
        <Loader2 size={24} className="animate-spin text-[var(--color-text-muted)]" />
      </div>
    );
  }

  if (payments.length === 0) {
    return (
      <div className="glass-card text-center py-16">
        <EmptyIcon size={40} className="mx-auto text-[var(--color-text-muted)] mb-3" />
        <p className="text-[var(--color-text-secondary)] font-medium">{emptyText}</p>
      </div>
    );
  }

  return (
    <div className="glass-card overflow-hidden divide-y divide-[var(--color-border-light)]">
      {payments.map(p => (
        <div key={p.id} className="px-6 py-4 flex items-center gap-4 hover:bg-[var(--color-surface-light)] transition-colors">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
            p.status === 'succeeded' ? 'bg-emerald-50' : p.status === 'refunded' ? 'bg-red-50' : 'bg-amber-50'
          }`}>
            {p.status === 'succeeded' ? <ArrowUpRight size={16} className="text-emerald-600" /> :
             p.status === 'refunded' ? <ArrowDownRight size={16} className="text-red-500" /> :
             <Clock size={16} className="text-amber-600" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">{getLabel(p)}</p>
            <p className="text-xs text-[var(--color-text-muted)]">
              {getSubLabel(p)}{getSubLabel(p) && ' · '}{formatDateTime(p.created_at)}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className={`text-sm font-bold ${p.status === 'refunded' ? 'text-red-500' : 'text-[var(--color-text-primary)]'}`}>
              {formatCurrency(p.amount)}
            </p>
            <span className={`inline-block mt-1 text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full border ${getStatusBadge(p.status)}`}>
              {p.status === 'succeeded' ? 'Paid' : p.status === 'refunded' ? 'Refunded' : p.status}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
