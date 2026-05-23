'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/Toast';
import {
  DollarSign, TrendingUp, Clock, CreditCard, ExternalLink,
  Loader2, ArrowUpRight, ArrowDownRight, Calendar, Filter,
  CheckCircle, AlertCircle, Wallet, Landmark, Settings,
  ChevronDown, RefreshCw, Ban, Eye, FileText, Download,
  ArrowRight, Receipt
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────
interface EarningsTransaction {
  id: string;
  appointment_id: string | null;
  amount: number;
  currency: string;
  status: string;
  payment_type: string;
  description: string | null;
  created_at: string;
  client_name: string | null;
  service_name: string | null;
}

interface PayoutInfo {
  status: string;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  details_submitted: boolean;
}

interface PayoutRecord {
  id: string;
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

type PeriodFilter = '7d' | '30d' | '90d' | 'year' | 'all';
type StatusFilter = 'all' | 'succeeded' | 'pending' | 'refunded';

const periodOptions: { value: PeriodFilter; label: string }[] = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: 'year', label: 'This year' },
  { value: 'all', label: 'All time' },
];

const statusOptions: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'succeeded', label: 'Completed' },
  { value: 'pending', label: 'Pending' },
  { value: 'refunded', label: 'Refunded' },
];

function getStatusBadge(status: string) {
  switch (status) {
    case 'succeeded': return 'bg-emerald-50 text-emerald-600 border-emerald-200';
    case 'pending': return 'bg-amber-50 text-amber-600 border-amber-200';
    case 'refunded': return 'bg-red-50 text-red-500 border-red-200';
    case 'requires_capture': return 'bg-blue-50 text-blue-600 border-blue-200';
    default: return 'bg-gray-50 text-gray-500 border-gray-200';
  }
}

function getStatusLabel(status: string) {
  switch (status) {
    case 'succeeded': return 'Completed';
    case 'pending': return 'Pending';
    case 'refunded': return 'Refunded';
    case 'requires_capture': return 'Held';
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

type TabValue = 'overview' | 'transactions' | 'payouts' | 'reports' | 'settings';

const tabs: { label: string; value: TabValue; icon: React.ElementType }[] = [
  { label: 'Overview', value: 'overview', icon: TrendingUp },
  { label: 'Transactions', value: 'transactions', icon: DollarSign },
  { label: 'Payouts', value: 'payouts', icon: Wallet },
  { label: 'Reports', value: 'reports', icon: FileText },
  { label: 'Settings', value: 'settings', icon: Settings },
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

export default function EarningsPage() {
  const { user, profile, role } = useAuth();
  const supabase = createClient();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<TabValue>('overview');
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<EarningsTransaction[]>([]);
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('30d');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [connectStatus, setConnectStatus] = useState<PayoutInfo | null>(null);
  const [connectLoading, setConnectLoading] = useState(false);
  const [onboardingLoading, setOnboardingLoading] = useState(false);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [payoutRecords, setPayoutRecords] = useState<PayoutRecord[]>([]);
  const [payoutsLoading, setPayoutsLoading] = useState(false);

  // ─── Load payouts ────────────────────────────────────────────────
  const loadPayouts = useCallback(async () => {
    if (!user) return;
    setPayoutsLoading(true);
    try {
      const { data, error } = await supabase
        .from('payouts')
        .select('*')
        .eq('master_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setPayoutRecords((data || []) as PayoutRecord[]);
    } catch (err) {
      console.error('Failed to load payouts:', err);
    } finally {
      setPayoutsLoading(false);
    }
  }, [user, supabase]);

  useEffect(() => { loadPayouts(); }, [loadPayouts]);

  // ─── Load transactions ──────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      try {
        // Get all payments linked to this master's appointments
        let query = supabase
          .from('payments')
          .select('id, amount, currency, status, payment_type, description, created_at, appointment_id')
          .order('created_at', { ascending: false });

        // Filter by appointments where this user is the master
        const { data: masterAppointments } = await supabase
          .from('appointments')
          .select('id, service_name, client:profiles!appointments_client_id_fkey(full_name)')
          .eq('master_id', user.id);

        const appointmentIds = (masterAppointments || []).map(a => a.id);
        const appointmentMap = new Map(
          (masterAppointments || []).map(a => [a.id, {
            service_name: a.service_name,
            client_name: (a.client as unknown as { full_name: string } | null)?.full_name || null,
          }])
        );

        if (appointmentIds.length > 0) {
          query = query.in('appointment_id', appointmentIds);
        } else {
          // No appointments = no earnings
          setTransactions([]);
          setLoading(false);
          return;
        }

        const periodStart = getPeriodStart(periodFilter);
        if (periodStart) {
          query = query.gte('created_at', periodStart);
        }

        if (statusFilter !== 'all') {
          query = query.eq('status', statusFilter);
        }

        const { data, error } = await query;
        if (error) throw error;

        const txns: EarningsTransaction[] = (data || []).filter(p => p.created_at).map(p => {
          const info = p.appointment_id ? appointmentMap.get(p.appointment_id) : null;
          return {
            ...p,
            created_at: p.created_at!,
            appointment_id: p.appointment_id || null,
            currency: p.currency || 'EUR',
            description: p.description || null,
            client_name: info?.client_name || null,
            service_name: info?.service_name || null,
          };
        });

        setTransactions(txns);
      } catch (err) {
        console.error('Failed to load transactions:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user, supabase, periodFilter, statusFilter]);

  // ─── Load Stripe Connect status ────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const checkConnect = async () => {
      setConnectLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke('stripe-connect-status', { body: {} });
        if (!error && data) {
          setConnectStatus(data);
        }
      } catch {
        // silent
      } finally {
        setConnectLoading(false);
      }
    };
    checkConnect();
  }, [user, supabase]);

  // ─── Computed stats ─────────────────────────────────────────────
  const stats = useMemo(() => {
    const completed = transactions.filter(t => t.status === 'succeeded');
    const pending = transactions.filter(t => t.status === 'pending' || t.status === 'requires_capture');
    const refunded = transactions.filter(t => t.status === 'refunded');
    const totalEarned = completed.reduce((sum, t) => sum + t.amount, 0);
    const totalPending = pending.reduce((sum, t) => sum + t.amount, 0);
    const totalRefunded = refunded.reduce((sum, t) => sum + t.amount, 0);
    return {
      totalEarned,
      totalPending,
      totalRefunded,
      transactionCount: transactions.length,
      completedCount: completed.length,
    };
  }, [transactions]);

  // ─── Stripe Connect actions ─────────────────────────────────────
  const handleConnectOnboarding = async () => {
    setOnboardingLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('stripe-connect-onboarding', { body: {} });
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (err) {
      showToast('Failed to start Stripe Connect onboarding', 'error');
      console.error(err);
    } finally {
      setOnboardingLoading(false);
    }
  };

  const handleOpenDashboard = async () => {
    setDashboardLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('stripe-connect-dashboard', { body: {} });
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (err) {
      showToast('Failed to open Stripe Dashboard', 'error');
      console.error(err);
    } finally {
      setDashboardLoading(false);
    }
  };

  const handleRefreshStatus = async () => {
    setConnectLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('stripe-connect-status', { body: {} });
      if (!error && data) {
        setConnectStatus(data);
        showToast('Connect status refreshed', 'success');
      }
    } catch {
      showToast('Failed to refresh status', 'error');
    } finally {
      setConnectLoading(false);
    }
  };

  if (role !== 'master') {
    return (
      <div className="max-w-4xl mx-auto py-12 text-center">
        <div className="glass-card p-12">
          <Ban size={48} className="mx-auto text-[var(--color-text-muted)] mb-4" />
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-2">Master Earnings</h1>
          <p className="text-[var(--color-text-secondary)]">This page is available for masters only.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[var(--color-text-primary)]">Earnings</h1>
          <p className="text-[var(--color-text-secondary)] text-sm mt-1">Track your income and manage payouts</p>
        </div>
        <div className="flex items-center gap-2">
          {connectStatus?.status === 'active' ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-600 text-xs font-semibold border border-emerald-200">
              <CheckCircle size={14} /> Stripe Connected
            </span>
          ) : connectStatus?.status === 'pending' ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 text-amber-600 text-xs font-semibold border border-amber-200">
              <Clock size={14} /> Setup Pending
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-50 text-gray-500 text-xs font-semibold border border-gray-200">
              <AlertCircle size={14} /> Not Connected
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-[var(--color-surface-light)] rounded-2xl">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
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

      {/* ─── Overview Tab ──────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="glass-card p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center">
                  <DollarSign size={20} className="text-emerald-600" />
                </div>
                <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Total Earned</span>
              </div>
              <p className="text-2xl font-bold text-[var(--color-text-primary)]">{formatCurrency(stats.totalEarned)}</p>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">{stats.completedCount} completed payments</p>
            </div>

            <div className="glass-card p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center">
                  <Clock size={20} className="text-amber-600" />
                </div>
                <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Pending</span>
              </div>
              <p className="text-2xl font-bold text-[var(--color-text-primary)]">{formatCurrency(stats.totalPending)}</p>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">Awaiting capture/completion</p>
            </div>

            <div className="glass-card p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-red-100 to-rose-100 flex items-center justify-center">
                  <ArrowDownRight size={20} className="text-red-500" />
                </div>
                <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Refunded</span>
              </div>
              <p className="text-2xl font-bold text-[var(--color-text-primary)]">{formatCurrency(stats.totalRefunded)}</p>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">Total refunds issued</p>
            </div>

            <div className="glass-card p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-100 to-purple-100 flex items-center justify-center">
                  <TrendingUp size={20} className="text-violet-600" />
                </div>
                <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Net Earnings</span>
              </div>
              <p className="text-2xl font-bold text-[var(--color-text-primary)]">{formatCurrency(stats.totalEarned - stats.totalRefunded)}</p>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">After refunds</p>
            </div>
          </div>

          {/* Stripe Connect Banner */}
          {(!connectStatus || connectStatus.status !== 'active') && (
            <div className="glass-card p-6 border-l-4 border-l-[var(--color-primary)]">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[var(--color-brand-pink)] to-[var(--color-brand-pink-dark)] flex items-center justify-center shrink-0">
                  <Landmark size={24} className="text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-[var(--color-text-primary)]">Connect your bank account</h3>
                  <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">
                    Set up Stripe Connect to receive payouts directly to your bank account. Complete the onboarding to start receiving payments.
                  </p>
                </div>
                <button
                  onClick={handleConnectOnboarding}
                  disabled={onboardingLoading}
                  className="btn-pink px-5 py-2.5 text-sm flex items-center gap-2 shrink-0"
                >
                  {onboardingLoading ? <Loader2 size={16} className="animate-spin" /> : <ExternalLink size={16} />}
                  {connectStatus?.status === 'pending' ? 'Continue Setup' : 'Get Started'}
                </button>
              </div>
            </div>
          )}

          {/* Recent Transactions */}
          <div className="glass-card overflow-hidden">
            <div className="px-6 py-4 border-b border-[var(--color-border-light)] flex items-center justify-between">
              <h3 className="font-bold text-[var(--color-text-primary)]">Recent Transactions</h3>
              <button onClick={() => setActiveTab('transactions')} className="text-xs font-semibold text-[var(--color-primary)] hover:underline flex items-center gap-1 cursor-pointer">
                View all <ArrowUpRight size={12} />
              </button>
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={24} className="animate-spin text-[var(--color-text-muted)]" />
              </div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-12">
                <DollarSign size={32} className="mx-auto text-[var(--color-text-muted)] mb-2" />
                <p className="text-sm text-[var(--color-text-muted)]">No transactions yet</p>
              </div>
            ) : (
              <div className="divide-y divide-[var(--color-border-light)]">
                {transactions.slice(0, 5).map(txn => (
                  <div key={txn.id} className="px-6 py-4 flex items-center gap-4">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                      txn.status === 'succeeded' ? 'bg-emerald-50' :
                      txn.status === 'refunded' ? 'bg-red-50' : 'bg-amber-50'
                    }`}>
                      {txn.status === 'succeeded' ? <ArrowUpRight size={16} className="text-emerald-600" /> :
                       txn.status === 'refunded' ? <ArrowDownRight size={16} className="text-red-500" /> :
                       <Clock size={16} className="text-amber-600" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
                        {txn.service_name || txn.description || 'Payment'}
                      </p>
                      <p className="text-xs text-[var(--color-text-muted)]">
                        {txn.client_name && `${txn.client_name} · `}{formatDateTime(txn.created_at)}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-sm font-bold ${txn.status === 'refunded' ? 'text-red-500' : 'text-[var(--color-text-primary)]'}`}>
                        {txn.status === 'refunded' ? '-' : '+'}{formatCurrency(txn.amount)}
                      </p>
                      <span className={`inline-block text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full border ${getStatusBadge(txn.status)}`}>
                        {getStatusLabel(txn.status)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Transactions Tab ──────────────────────────────────────── */}
      {activeTab === 'transactions' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="glass-card p-4 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Calendar size={16} className="text-[var(--color-text-muted)]" />
              <select
                value={periodFilter}
                onChange={e => setPeriodFilter(e.target.value as PeriodFilter)}
                className="input-glass text-sm py-1.5 px-3 pr-8"
              >
                {periodOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <Filter size={16} className="text-[var(--color-text-muted)]" />
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value as StatusFilter)}
                className="input-glass text-sm py-1.5 px-3 pr-8"
              >
                {statusOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="ml-auto text-xs text-[var(--color-text-muted)]">
              {transactions.length} transaction{transactions.length !== 1 ? 's' : ''}
            </div>
          </div>

          {/* Transactions List */}
          <div className="glass-card overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 size={24} className="animate-spin text-[var(--color-text-muted)]" />
              </div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-16">
                <DollarSign size={40} className="mx-auto text-[var(--color-text-muted)] mb-3" />
                <p className="text-[var(--color-text-secondary)] font-medium">No transactions found</p>
                <p className="text-xs text-[var(--color-text-muted)] mt-1">Adjust your filters or check back later</p>
              </div>
            ) : (
              <div className="divide-y divide-[var(--color-border-light)]">
                {transactions.map(txn => (
                  <div key={txn.id} className="px-6 py-4 flex items-center gap-4 hover:bg-[var(--color-surface-light)] transition-colors">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                      txn.status === 'succeeded' ? 'bg-emerald-50' :
                      txn.status === 'refunded' ? 'bg-red-50' : 'bg-amber-50'
                    }`}>
                      {txn.status === 'succeeded' ? <ArrowUpRight size={18} className="text-emerald-600" /> :
                       txn.status === 'refunded' ? <ArrowDownRight size={18} className="text-red-500" /> :
                       <Clock size={18} className="text-amber-600" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
                        {txn.service_name || txn.description || 'Payment'}
                      </p>
                      <p className="text-xs text-[var(--color-text-muted)]">
                        {txn.client_name && <span className="text-[var(--color-text-secondary)]">{txn.client_name}</span>}
                        {txn.client_name && ' · '}
                        {formatDate(txn.created_at)}
                      </p>
                      {txn.payment_type && (
                        <span className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider">{txn.payment_type}</span>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-sm font-bold ${txn.status === 'refunded' ? 'text-red-500' : 'text-[var(--color-text-primary)]'}`}>
                        {txn.status === 'refunded' ? '-' : '+'}{formatCurrency(txn.amount)}
                      </p>
                      <span className={`inline-block mt-1 text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full border ${getStatusBadge(txn.status)}`}>
                        {getStatusLabel(txn.status)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Payouts Tab ───────────────────────────────────────────── */}
      {activeTab === 'payouts' && (
        <div className="space-y-6">
          {/* Connect Status Card */}
          <div className="glass-card p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-violet-200 to-purple-200 flex items-center justify-center">
                <Landmark size={20} className="text-violet-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-[var(--color-text-primary)]">Stripe Connect</h3>
                <p className="text-xs text-[var(--color-text-muted)]">Your payout account status</p>
              </div>
              <button
                onClick={handleRefreshStatus}
                disabled={connectLoading}
                className="p-2 rounded-xl hover:bg-[var(--color-surface-light)] transition-colors cursor-pointer"
                title="Refresh status"
              >
                <RefreshCw size={16} className={`text-[var(--color-text-muted)] ${connectLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {connectLoading && !connectStatus ? (
              <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
                <Loader2 size={16} className="animate-spin" /> Checking account status...
              </div>
            ) : connectStatus ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-xl bg-[var(--color-surface-light)]">
                    <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1">Status</p>
                    <p className={`text-sm font-bold ${connectStatus.status === 'active' ? 'text-emerald-600' : connectStatus.status === 'pending' ? 'text-amber-600' : 'text-gray-500'}`}>
                      {connectStatus.status === 'active' ? 'Active' : connectStatus.status === 'pending' ? 'Pending' : 'Not Connected'}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-[var(--color-surface-light)]">
                    <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1">Charges</p>
                    <p className={`text-sm font-bold ${connectStatus.charges_enabled ? 'text-emerald-600' : 'text-red-500'}`}>
                      {connectStatus.charges_enabled ? 'Enabled' : 'Disabled'}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-[var(--color-surface-light)]">
                    <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1">Payouts</p>
                    <p className={`text-sm font-bold ${connectStatus.payouts_enabled ? 'text-emerald-600' : 'text-red-500'}`}>
                      {connectStatus.payouts_enabled ? 'Enabled' : 'Disabled'}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-[var(--color-surface-light)]">
                    <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1">Details</p>
                    <p className={`text-sm font-bold ${connectStatus.details_submitted ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {connectStatus.details_submitted ? 'Submitted' : 'Incomplete'}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {connectStatus.status === 'active' && (
                    <button
                      onClick={handleOpenDashboard}
                      disabled={dashboardLoading}
                      className="btn-pink px-4 py-2 text-sm flex items-center gap-2"
                    >
                      {dashboardLoading ? <Loader2 size={14} className="animate-spin" /> : <ExternalLink size={14} />}
                      Open Stripe Dashboard
                    </button>
                  )}
                  {connectStatus.status !== 'active' && (
                    <button
                      onClick={handleConnectOnboarding}
                      disabled={onboardingLoading}
                      className="btn-pink px-4 py-2 text-sm flex items-center gap-2"
                    >
                      {onboardingLoading ? <Loader2 size={14} className="animate-spin" /> : <ExternalLink size={14} />}
                      {connectStatus.status === 'pending' ? 'Continue Onboarding' : 'Connect Bank Account'}
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-6">
                <Landmark size={32} className="mx-auto text-[var(--color-text-muted)] mb-2" />
                <p className="text-sm text-[var(--color-text-secondary)]">No Stripe Connect account found</p>
                <button
                  onClick={handleConnectOnboarding}
                  disabled={onboardingLoading}
                  className="btn-pink px-5 py-2 text-sm mt-4 flex items-center gap-2 mx-auto"
                >
                  {onboardingLoading ? <Loader2 size={14} className="animate-spin" /> : <Landmark size={14} />}
                  Connect Bank Account
                </button>
              </div>
            )}
          </div>

          {/* Payout Schedule Info */}
          <div className="glass-card p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-sky-200 to-cyan-200 flex items-center justify-center">
                <Wallet size={20} className="text-sky-600" />
              </div>
              <div>
                <h3 className="font-bold text-[var(--color-text-primary)]">Automatic Payout Schedule</h3>
                <p className="text-xs text-[var(--color-text-muted)]">Payouts are scheduled automatically via Stripe</p>
              </div>
            </div>
            <div className="rounded-xl bg-[var(--color-surface-light)] p-4 text-sm text-[var(--color-text-secondary)]">
              <p>Stripe processes payouts on a rolling basis. After funds are available in your Stripe account, they are automatically transferred to your connected bank account.</p>
              <p className="mt-2 text-xs text-[var(--color-text-muted)]">
                Default schedule: <strong>Daily automatic payouts</strong> (2-day rolling basis). Adjust in your Stripe Dashboard → Settings → Payouts.
              </p>
            </div>
          </div>

          {/* Payout History */}
          <div className="glass-card overflow-hidden">
            <div className="px-6 py-4 border-b border-[var(--color-border-light)] flex items-center justify-between">
              <h3 className="font-bold text-[var(--color-text-primary)]">Payout History</h3>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--color-text-muted)]">
                  {payoutRecords.filter(p => p.status === 'pending').length} pending · {payoutRecords.filter(p => p.status === 'completed').length} completed
                </span>
                <button onClick={loadPayouts} disabled={payoutsLoading} className="p-1.5 rounded-lg hover:bg-[var(--color-surface-light)] transition-colors cursor-pointer">
                  <RefreshCw size={14} className={`text-[var(--color-text-muted)] ${payoutsLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>
            {payoutsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={24} className="animate-spin text-[var(--color-text-muted)]" />
              </div>
            ) : payoutRecords.length === 0 ? (
              <div className="text-center py-12">
                <Receipt size={32} className="mx-auto text-[var(--color-text-muted)] mb-2" />
                <p className="text-sm text-[var(--color-text-muted)]">No payouts yet</p>
                <p className="text-xs text-[var(--color-text-muted)] mt-1">Payouts appear here once processed by Stripe</p>
              </div>
            ) : (
              <div className="divide-y divide-[var(--color-border-light)]">
                {payoutRecords.map(payout => (
                  <div key={payout.id} className="px-6 py-4 flex items-center gap-4 hover:bg-[var(--color-surface-light)] transition-colors">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                      payout.status === 'completed' ? 'bg-emerald-50' :
                      payout.status === 'failed' ? 'bg-red-50' :
                      payout.status === 'in_transit' ? 'bg-blue-50' : 'bg-amber-50'
                    }`}>
                      {payout.status === 'completed' ? <CheckCircle size={18} className="text-emerald-600" /> :
                       payout.status === 'failed' ? <AlertCircle size={18} className="text-red-500" /> :
                       payout.status === 'in_transit' ? <ArrowRight size={18} className="text-blue-600" /> :
                       <Clock size={18} className="text-amber-600" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                        Payout {payout.stripe_payout_id ? `#${payout.stripe_payout_id.slice(-8).toUpperCase()}` : ''}
                      </p>
                      <p className="text-xs text-[var(--color-text-muted)]">
                        {payout.period_start && payout.period_end
                          ? `${formatDate(payout.period_start)} — ${formatDate(payout.period_end)}`
                          : formatDate(payout.created_at)}
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

      {/* ─── Reports Tab ───────────────────────────────────────────── */}
      {activeTab === 'reports' && (
        <div className="space-y-6">
          <div className="glass-card p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-200 to-blue-200 flex items-center justify-center">
                <FileText size={20} className="text-indigo-600" />
              </div>
              <div>
                <h3 className="font-bold text-[var(--color-text-primary)]">Earnings Report</h3>
                <p className="text-xs text-[var(--color-text-muted)]">Summary for {periodOptions.find(o => o.value === periodFilter)?.label}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--color-surface-light)]">
                <span className="text-sm text-[var(--color-text-secondary)]">Total Earned</span>
                <span className="text-sm font-bold text-[var(--color-text-primary)]">{formatCurrency(stats.totalEarned)}</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--color-surface-light)]">
                <span className="text-sm text-[var(--color-text-secondary)]">Pending</span>
                <span className="text-sm font-semibold text-amber-600">{formatCurrency(stats.totalPending)}</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--color-surface-light)]">
                <span className="text-sm text-[var(--color-text-secondary)]">Refunded</span>
                <span className="text-sm font-semibold text-red-500">-{formatCurrency(stats.totalRefunded)}</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--color-surface-light)]">
                <span className="text-sm font-bold text-[var(--color-text-primary)]">Net Earnings</span>
                <span className="text-sm font-bold text-[var(--color-text-primary)]">{formatCurrency(stats.totalEarned - stats.totalRefunded)}</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--color-surface-light)]">
                <span className="text-sm text-[var(--color-text-secondary)]">Transactions</span>
                <span className="text-sm font-semibold text-[var(--color-text-secondary)]">{stats.transactionCount}</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--color-surface-light)]">
                <span className="text-sm text-[var(--color-text-secondary)]">Payouts Received</span>
                <span className="text-sm font-semibold text-[var(--color-text-secondary)]">{payoutRecords.filter(p => p.status === 'completed').length}</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => {
                  const rows = [
                    ['Date', 'Service', 'Client', 'Amount', 'Status', 'Type'],
                    ...transactions.map(t => [
                      formatDate(t.created_at),
                      t.service_name || '',
                      t.client_name || '',
                      t.amount.toFixed(2),
                      getStatusLabel(t.status),
                      t.payment_type || '',
                    ]),
                  ];
                  const csv = rows.map(r => r.map(c => `"${(c || '').replace(/"/g, '""')}"`).join(',')).join('\n');
                  const blob = new Blob([csv], { type: 'text/csv' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `earnings-report-${periodFilter}.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                  showToast('Report downloaded', 'success');
                }}
                className="btn-pink px-4 py-2 text-sm flex items-center gap-2"
              >
                <Download size={14} /> Export Transactions CSV
              </button>
              <button
                onClick={() => {
                  const rows = [
                    ['Date', 'Amount', 'Status', 'Period Start', 'Period End', 'Stripe ID'],
                    ...payoutRecords.map(p => [
                      formatDate(p.created_at),
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
              {connectStatus?.status === 'active' && (
                <button
                  onClick={handleOpenDashboard}
                  disabled={dashboardLoading}
                  className="px-4 py-2 text-sm rounded-xl border border-[var(--color-border-light)] hover:bg-[var(--color-surface-light)] transition-colors flex items-center gap-2 cursor-pointer"
                >
                  {dashboardLoading ? <Loader2 size={14} className="animate-spin" /> : <ExternalLink size={14} />}
                  Full Reports in Stripe
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── Settings Tab ──────────────────────────────────────────── */}
      {activeTab === 'settings' && (
        <div className="space-y-6">
          {/* Payout Settings Card */}
          <div className="glass-card p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-200 to-blue-200 flex items-center justify-center">
                <Settings size={20} className="text-indigo-600" />
              </div>
              <div>
                <h3 className="font-bold text-[var(--color-text-primary)]">Payout Settings</h3>
                <p className="text-xs text-[var(--color-text-muted)]">Configure your payout preferences</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-xl bg-[var(--color-surface-light)] p-4">
                <p className="text-sm font-medium text-[var(--color-text-primary)] mb-1">Commission Rate</p>
                <p className="text-2xl font-bold text-[var(--color-primary)]">{((profile as Record<string, unknown>)?.commission_rate as number || 0.20) * 100}%</p>
                <p className="text-xs text-[var(--color-text-muted)] mt-1">Platform commission on each booking. Contact your salon owner to adjust.</p>
              </div>

              <div className="rounded-xl bg-[var(--color-surface-light)] p-4">
                <p className="text-sm font-medium text-[var(--color-text-primary)] mb-1">Payout Method</p>
                {connectStatus?.status === 'active' ? (
                  <div className="flex items-center gap-2">
                    <CheckCircle size={16} className="text-emerald-600" />
                    <span className="text-sm text-emerald-600 font-semibold">Bank account connected via Stripe</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <AlertCircle size={16} className="text-amber-600" />
                    <span className="text-sm text-amber-600 font-semibold">No bank account connected</span>
                  </div>
                )}
                <p className="text-xs text-[var(--color-text-muted)] mt-1">
                  Payout schedule, bank details, and tax info can be managed directly in your Stripe Dashboard.
                </p>
              </div>

              {connectStatus?.status === 'active' && (
                <button
                  onClick={handleOpenDashboard}
                  disabled={dashboardLoading}
                  className="btn-pink px-5 py-2.5 text-sm flex items-center gap-2"
                >
                  {dashboardLoading ? <Loader2 size={14} className="animate-spin" /> : <ExternalLink size={14} />}
                  Manage in Stripe Dashboard
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
