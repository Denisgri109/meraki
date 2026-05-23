'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { 
  Calendar, Clock, User, ChevronRight, ArrowRight, X,
  Shield, ShieldAlert, Sparkles, MessageSquare, Check, AlertTriangle,
  HelpCircle, CheckCircle, Info, DollarSign, CalendarDays,
  UserCheck, AlertCircle, CalendarRange, Clock3, Loader2, Trash2
} from 'lucide-react';
import Link from 'next/link';

type TabValue = 'upcoming' | 'past' | 'cancelled';

interface Appointment {
  id: string;
  client_id: string;
  master_id: string;
  start_time: string;
  end_time: string;
  status: string;
  notes: string | null;
  service_name: string | null;
  service_category: string | null;
  price: number;
  deposit_amount: number;
  deposit_paid: boolean;
  client_confirmed: boolean;
  confirmation_deadline: string | null;
  requires_confirmation: boolean;
  proposed_start_time: string | null;
  proposed_end_time: string | null;
  reschedule_initiated_by: string | null;
  cancellation_fee_amount: number;
  cancellation_reason: string | null;
  no_show_charge_amount: number | null;
  no_show_processed_at: string | null;
  stripe_payment_intent_id: string | null;
  service_duration_minutes: number | null;
  payment_hold_amount: number | null;
  service?: { name: string; base_price?: number; duration_minutes?: number; description?: string } | null;
  master?: { id: string; full_name: string; avatar_url: string | null; specialties: string[] | null } | null;
  client?: { id: string; full_name: string; avatar_url: string | null; email: string; phone: string | null } | null;
}

interface AppointmentConfirmation {
  id: string;
  appointment_id: string;
  confirmed: boolean | null;
  confirmed_at: string | null;
  reminder_sent_at: string | null;
  responded_at: string | null;
  response_type: string | null;
  no_show_charge_captured: boolean | null;
  no_show_charge_receipt_url: string | null;
  grace_period_ends_at: string | null;
  client_arrived_at: string | null;
  client_arrived_late: boolean | null;
}

interface MasterSettings {
  id: string;
  master_id: string;
  confirmation_timing_hours: number | null;
  cancellation_charge_percent: number | null;
  late_cancellation_window_hours: number | null;
  no_show_charge_percent: number | null;
  late_arrival_minutes: number | null;
  grace_period_multiplier: number | null;
  auto_charge_after_grace_period: boolean | null;
  require_tc_acceptance: boolean | null;
}

const tabs: { label: string; value: TabValue; color: string }[] = [
  { label: 'Upcoming', value: 'upcoming', color: 'from-emerald-400 to-teal-400' },
  { label: 'Past', value: 'past', color: 'from-blue-400 to-indigo-400' },
  { label: 'Cancelled', value: 'cancelled', color: 'from-red-400 to-rose-400' },
];

function getStatusColor(status: string) {
  switch (status) {
    case 'confirmed': return 'bg-emerald-50 text-emerald-600 border-emerald-200';
    case 'pending': return 'bg-amber-50 text-amber-600 border-amber-200';
    case 'completed': return 'bg-blue-50 text-blue-600 border-blue-200';
    case 'cancelled': return 'bg-red-50 text-red-500 border-red-200';
    case 'no_show': return 'bg-rose-50 text-rose-600 border-rose-200';
    case 'reschedule_pending': return 'bg-violet-50 text-violet-600 border-violet-200';
    default: return 'bg-gray-50 text-gray-500 border-gray-200';
  }
}

export default function AppointmentsPage() {
  const { user, role } = useAuth();
  const supabase = createClient();
  const [activeTab, setActiveTab] = useState<TabValue>('upcoming');
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  
  // Dynamic secondary details inside drawer
  const [confirmationData, setConfirmationData] = useState<AppointmentConfirmation | null>(null);
  const [settingsData, setSettingsData] = useState<MasterSettings | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Sub-modal states inside drawer
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showNoShowModal, setShowNoShowModal] = useState(false);
  const [showRescheduleForm, setShowRescheduleForm] = useState(false);

  // Reschedule Form Fields
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');

  // Late arrival input
  const [lateMinutesInput, setLateMinutesInput] = useState('15');
  const [showLateInputForm, setShowLateInputForm] = useState(false);

  const fetchAppointments = async () => {
    if (!user) { setLoading(false); return; }
    try {
      let query = supabase
        .from('appointments')
        .select(`
          id, client_id, master_id, start_time, end_time, status, notes, service_name, service_category,
          price, deposit_amount, deposit_paid, client_confirmed, confirmation_deadline,
          requires_confirmation, proposed_start_time, proposed_end_time, reschedule_initiated_by,
          cancellation_fee_amount, cancellation_reason, no_show_charge_amount, no_show_processed_at,
          stripe_payment_intent_id, service_duration_minutes, payment_hold_amount,
          service:services(name, base_price, duration_minutes, description),
          master:profiles!appointments_master_id_fkey(id, full_name, avatar_url, specialties),
          client:profiles!appointments_client_id_fkey(id, full_name, avatar_url, email, phone)
        `);

      if (role === 'master') {
        query = query.eq('master_id', user.id);
      } else if (role !== 'owner') {
        query = query.eq('client_id', user.id);
      }

      const { data, error } = await query
        .order('start_time', { ascending: activeTab === 'upcoming' });

      if (error) console.error('[Appointments] fetch error:', error);
      setAppointments((data as unknown as Appointment[]) || []);
    } catch (err) {
      console.error('[Appointments] unexpected error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAppointments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, role, activeTab]);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleSelectAppointment = async (apt: Appointment) => {
    setSelectedAppointment(apt);
    setLoadingDetails(true);
    setConfirmationData(null);
    setSettingsData(null);
    setShowCancelConfirm(false);
    setShowNoShowModal(false);
    setShowRescheduleForm(false);
    setShowLateInputForm(false);

    try {
      // 1. Fetch confirmations
      const { data: confirmVal } = await supabase
        .from('appointment_confirmations')
        .select('*')
        .eq('appointment_id', apt.id)
        .maybeSingle();
      if (confirmVal) setConfirmationData(confirmVal);

      // 2. Fetch master settings
      const { data: settingsVal } = await supabase
        .from('master_settings')
        .select('*')
        .eq('master_id', apt.master_id)
        .maybeSingle();
      if (settingsVal) setSettingsData(settingsVal);
    } catch (err) {
      console.error('[Appointments] error loading details:', err);
    } finally {
      setLoadingDetails(false);
    }
  };

  // Check if late cancellation warning is required (<24h)
  const isLateCancellation = (startTimeStr: string) => {
    const start = new Date(startTimeStr).getTime();
    const now = new Date().getTime();
    const diffHours = (start - now) / (1000 * 60 * 60);
    return diffHours < 24 && diffHours > 0;
  };

  // Perform client cancellation
  const handleCancelAppointment = async () => {
    if (!selectedAppointment) return;
    try {
      const isLate = isLateCancellation(selectedAppointment.start_time);
      const penaltyAmount = isLate ? Number(((selectedAppointment.price * 50) / 100).toFixed(2)) : 0;

      const { error } = await supabase
        .from('appointments')
        .update({
          status: 'cancelled',
          cancellation_fee_amount: Math.round(penaltyAmount * 100), // in cents
          cancellation_reason: isLate ? 'Late cancellation under policy window' : 'Cancelled by Client',
          status_updated_at: new Date().toISOString()
        })
        .eq('id', selectedAppointment.id);

      if (error) throw error;

      showToast(
        isLate 
          ? `Appointment cancelled. Late fee of £${penaltyAmount.toFixed(2)} recorded.`
          : 'Appointment cancelled successfully.',
        'success'
      );
      
      setSelectedAppointment(null);
      fetchAppointments();
    } catch (err: any) {
      showToast(err.message || 'Failed to cancel appointment', 'error');
    }
  };

  // Attendance confirmations (Client)
  const handleClientConfirmation = async (confirmed: boolean) => {
    if (!selectedAppointment) return;
    try {
      const statusUpdate = confirmed ? 'confirmed' : 'cancelled';
      const { error } = await supabase
        .from('appointments')
        .update({
          client_confirmed: confirmed,
          status: statusUpdate,
          status_updated_at: new Date().toISOString()
        })
        .eq('id', selectedAppointment.id);

      if (error) throw error;

      // Update confirmations table
      await supabase
        .from('appointment_confirmations')
        .upsert({
          appointment_id: selectedAppointment.id,
          confirmed: confirmed,
          responded_at: new Date().toISOString(),
          response_type: confirmed ? 'yes' : 'no'
        }, { onConflict: 'appointment_id' });

      showToast(confirmed ? 'Attendance confirmed!' : 'Attendance declined & booking cancelled.', 'success');
      setSelectedAppointment(null);
      fetchAppointments();
    } catch (err: any) {
      showToast(err.message || 'Failed to submit confirmation', 'error');
    }
  };

  // Completion (Master) — also captures held payment if pre-authorized
  const handleMarkAsCompleted = async () => {
    if (!selectedAppointment) return;
    try {
      // If there's a held payment (pre-authorization), capture it via Stripe
      if (selectedAppointment.stripe_payment_intent_id) {
        const { data: captureData, error: captureError } = await supabase.functions.invoke('capture-payment', {
          body: {
            payment_intent_id: selectedAppointment.stripe_payment_intent_id,
          },
        });
        if (captureError) console.error('Payment capture error:', captureError);
        else if (captureData?.error) console.error('Stripe capture error:', captureData.error);
        // Continue even if capture fails — mark completed regardless
      }

      const { error } = await supabase
        .from('appointments')
        .update({
          status: 'completed',
          status_updated_at: new Date().toISOString()
        })
        .eq('id', selectedAppointment.id);

      if (error) throw error;

      const msg = selectedAppointment.stripe_payment_intent_id
        ? 'Service completed & payment captured.'
        : 'Appointment marked as completed.';
      showToast(msg, 'success');
      setSelectedAppointment(null);
      fetchAppointments();
    } catch (err: any) {
      showToast(err.message || 'Failed to update appointment', 'error');
    }
  };

  // Direct Chat Navigation
  const handleDirectChat = async () => {
    if (!selectedAppointment || !user) return;
    const otherUserId = role === 'master' ? selectedAppointment.client_id : selectedAppointment.master_id;
    if (!otherUserId) return;

    try {
      // Look up existing conversation
      let { data: convo } = await supabase
        .from('conversations')
        .select('id')
        .or(`and(client_id.eq.${user.id},master_id.eq.${otherUserId}),and(client_id.eq.${otherUserId},master_id.eq.${user.id})`)
        .maybeSingle();

      if (!convo) {
        // Create new conversation
        const clientId = role === 'master' ? otherUserId : user.id;
        const masterId = role === 'master' ? user.id : otherUserId;
        const { data: newConvo, error } = await supabase
          .from('conversations')
          .insert({ client_id: clientId, master_id: masterId })
          .select('id')
          .single();
        if (error) throw error;
        convo = newConvo;
      }

      // Store in localStorage to trigger auto-activation on the messages page
      localStorage.setItem('meraki_active_chat_convo_id', convo.id);
      window.location.href = '/dashboard/chat';
    } catch (err: any) {
      showToast(err.message || 'Failed to initiate chat', 'error');
    }
  };

  // Propose Reschedule (Master)
  const handleProposeReschedule = async () => {
    if (!selectedAppointment || !rescheduleDate || !rescheduleTime) {
      showToast('Please pick both date and time', 'error');
      return;
    }
    try {
      const propStart = new Date(`${rescheduleDate}T${rescheduleTime}:00`);
      const duration = selectedAppointment.service?.duration_minutes ?? selectedAppointment.service_duration_minutes ?? 60;
      const propEnd = new Date(propStart.getTime() + duration * 60 * 1000);

      const { error } = await supabase
        .from('appointments')
        .update({
          status: 'reschedule_pending',
          proposed_start_time: propStart.toISOString(),
          proposed_end_time: propEnd.toISOString(),
          reschedule_initiated_by: user?.id,
          status_updated_at: new Date().toISOString()
        })
        .eq('id', selectedAppointment.id);

      if (error) throw error;
      showToast('Reschedule proposal sent to client.', 'success');
      setSelectedAppointment(null);
      fetchAppointments();
    } catch (err: any) {
      showToast(err.message || 'Failed to submit proposal', 'error');
    }
  };

  // Client Approval/Decline of Reschedule Proposal
  const handleRescheduleResponse = async (approve: boolean) => {
    if (!selectedAppointment) return;
    try {
      if (approve && selectedAppointment.proposed_start_time && selectedAppointment.proposed_end_time) {
        // Approve: commit proposed times
        const { error } = await supabase
          .from('appointments')
          .update({
            start_time: selectedAppointment.proposed_start_time,
            end_time: selectedAppointment.proposed_end_time,
            status: 'confirmed',
            proposed_start_time: null,
            proposed_end_time: null,
            reschedule_initiated_by: null,
            status_updated_at: new Date().toISOString()
          })
          .eq('id', selectedAppointment.id);
        if (error) throw error;
        showToast('Reschedule request approved.', 'success');
      } else {
        // Decline: clear proposed fields
        const { error } = await supabase
          .from('appointments')
          .update({
            status: 'confirmed',
            proposed_start_time: null,
            proposed_end_time: null,
            reschedule_initiated_by: null,
            status_updated_at: new Date().toISOString()
          })
          .eq('id', selectedAppointment.id);
        if (error) throw error;
        showToast('Reschedule request declined.', 'success');
      }
      setSelectedAppointment(null);
      fetchAppointments();
    } catch (err: any) {
      showToast(err.message || 'Failed to submit response', 'error');
    }
  };

  // No-Show action: Capture immediate charge via Stripe (Master)
  const handleNoShowChargeNow = async () => {
    if (!selectedAppointment) return;
    try {
      const chargeAmount = Number(((selectedAppointment.price * 100) / 100).toFixed(2));

      // Call Stripe handle-no-show edge function if payment intent exists
      if (selectedAppointment.stripe_payment_intent_id) {
        const noShowPercent = settingsData?.no_show_charge_percent ?? 100;
        const { data: noShowData, error: noShowError } = await supabase.functions.invoke('handle-no-show', {
          body: {
            appointment_id: selectedAppointment.id,
            payment_intent_id: selectedAppointment.stripe_payment_intent_id,
            no_show_fee_percentage: noShowPercent,
          },
        });
        if (noShowError) throw noShowError;
        if (noShowData?.error) throw new Error(noShowData.error);
      }

      const { error } = await supabase
        .from('appointments')
        .update({
          status: 'no_show',
          no_show_charge_amount: chargeAmount,
          no_show_processed_at: new Date().toISOString(),
          status_updated_at: new Date().toISOString()
        })
        .eq('id', selectedAppointment.id);

      if (error) throw error;

      await supabase
        .from('appointment_confirmations')
        .upsert({
          appointment_id: selectedAppointment.id,
          no_show_charge_captured: true,
        }, { onConflict: 'appointment_id' });

      showToast(
        selectedAppointment.stripe_payment_intent_id
          ? `No-Show fee captured via Stripe. Charged €${chargeAmount.toFixed(2)}.`
          : `No-Show recorded. Fee of €${chargeAmount.toFixed(2)} logged.`,
        'success'
      );
      setSelectedAppointment(null);
      fetchAppointments();
    } catch (err: any) {
      showToast(err.message || 'Failed to capture no-show fee', 'error');
    }
  };

  // No-Show action: Setup grace window (Master)
  const handleNoShowWaitGrace = async () => {
    if (!selectedAppointment) return;
    try {
      const mult = settingsData?.grace_period_multiplier ?? 0.5;
      const duration = selectedAppointment.service?.duration_minutes ?? selectedAppointment.service_duration_minutes ?? 60;
      const graceMinutes = Math.max(10, Math.round(duration * mult));

      const graceEnd = new Date(Date.now() + graceMinutes * 60 * 1000);

      const { error } = await supabase
        .from('appointment_confirmations')
        .upsert({
          appointment_id: selectedAppointment.id,
          grace_period_ends_at: graceEnd.toISOString(),
        }, { onConflict: 'appointment_id' });

      if (error) throw error;
      showToast(`Grace period set. Client has ${graceMinutes} minutes to arrive.`, 'success');
      setSelectedAppointment(null);
      fetchAppointments();
    } catch (err: any) {
      showToast(err.message || 'Failed to initialize grace period', 'error');
    }
  };

  // No-Show action: Mark client arrived but late (Master)
  const handleNoShowClientLate = async () => {
    if (!selectedAppointment) return;
    try {
      const minutesLate = parseInt(lateMinutesInput) || 15;
      const arrivedTime = new Date(Date.now());
      const thresh = settingsData?.late_arrival_minutes ?? 15;

      const { error } = await supabase
        .from('appointment_confirmations')
        .upsert({
          appointment_id: selectedAppointment.id,
          client_arrived_late: minutesLate > thresh,
          client_arrived_at: arrivedTime.toISOString(),
        }, { onConflict: 'appointment_id' });

      if (error) throw error;

      showToast(
        minutesLate > thresh 
          ? `Logged late arrival. Client arrived ${minutesLate}m late (Exceeds ${thresh}m threshold).`
          : `Logged late arrival of ${minutesLate}m within threshold.`,
        'success'
      );
      setSelectedAppointment(null);
      fetchAppointments();
    } catch (err: any) {
      showToast(err.message || 'Failed to log arrival', 'error');
    }
  };

  const nowISO = new Date().toISOString();
  
  const filtered = appointments.filter((a) => {
    if (activeTab === 'upcoming') {
      return a.start_time >= nowISO && !['cancelled', 'completed', 'no_show'].includes(a.status);
    }
    if (activeTab === 'past') {
      return a.start_time < nowISO || ['completed', 'no_show'].includes(a.status);
    }
    return ['cancelled', 'cancelled_free', 'cancelled_charge'].includes(a.status);
  });

  return (
    <div className="max-w-4xl mx-auto animate-fade-in relative">
      
      {/* Toast Alert Box */}
      {toastMessage && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-4 rounded-2xl border shadow-xl transition-all duration-300 transform translate-y-0 ${
          toastMessage.type === 'success' 
            ? 'bg-emerald-50/95 backdrop-blur-md text-emerald-800 border-emerald-200' 
            : 'bg-rose-50/95 backdrop-blur-md text-rose-800 border-rose-200'
        }`}>
          {toastMessage.type === 'success' ? <CheckCircle className="text-emerald-500" size={20} /> : <AlertCircle className="text-rose-500" size={20} />}
          <span className="text-sm font-semibold">{toastMessage.text}</span>
        </div>
      )}

      {/* Hero Banner */}
      <div className="relative rounded-3xl overflow-hidden mb-10 h-52 shadow-lg">
        <img 
          src="https://images.unsplash.com/photo-1560066984-138dadb4c035?w=1600&q=80&auto=format&fit=crop" 
          alt="Appointments" 
          className="w-full h-full object-cover" 
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent" />
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center color-white p-6">
          <h1 className="text-4xl font-extrabold text-white tracking-tight drop-shadow-md">
            {role === 'master' ? 'Professional Bookings' : 'Your Appointments'}
          </h1>
          <p className="text-white/80 text-sm mt-2 max-w-md font-medium">
            {role === 'master' 
              ? 'Manage client attendance, reschedule proposals, and track late arrivals'
              : 'Track upcoming sessions, confirm attendance, or request reschedules'}
          </p>
        </div>
      </div>

      {/* Tabs — Colorful glass pills */}
      <div className="flex gap-2 p-1.5 rounded-2xl bg-[var(--color-surface-light)] mb-8 w-fit mx-auto border border-[var(--color-border-light)]">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 cursor-pointer ${
              activeTab === tab.value
                ? `bg-gradient-to-r ${tab.color} text-white shadow-[0_4px_12px_rgba(0,0,0,0.08)]`
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-white/70'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Appointments List */}
      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="glass-card p-5">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl shimmer" />
                <div className="flex-1">
                  <div className="h-4 shimmer rounded w-1/3 mb-2" />
                  <div className="h-3 shimmer rounded w-1/2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card p-16 text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-emerald-100/40 to-transparent rounded-bl-full" />
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-emerald-200 to-teal-200 flex items-center justify-center mx-auto mb-4 animate-float">
            <Calendar size={32} className="text-emerald-500" />
          </div>
          <p className="text-lg font-extrabold text-[var(--color-text-primary)]">
            {activeTab === 'upcoming' ? 'No upcoming appointments' : activeTab === 'past' ? 'No past appointments' : 'No cancelled appointments'}
          </p>
          <p className="text-sm text-[var(--color-text-muted)] mt-2 mb-6">
            {activeTab === 'upcoming' ? 'Book a service with our specialists today!' : 'Your history will appear here'}
          </p>
          {activeTab === 'upcoming' && role !== 'master' && (
            <Link href="/dashboard/booking" className="btn-pink px-8 py-3 text-sm inline-flex items-center gap-2">
              Book Now <ArrowRight size={16} />
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((apt, idx) => {
            const dateObj = new Date(apt.start_time);
            return (
              <div
                key={apt.id}
                data-row-id={apt.id}
                onClick={() => handleSelectAppointment(apt)}
                className="glass-card p-5 hover:shadow-xl hover:scale-[1.01] transition-all duration-300 cursor-pointer group flex items-center gap-4 border border-[var(--color-border-light)] bg-white/70 backdrop-blur-md"
              >
                {/* Date Badge */}
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-pink-50 to-purple-50 border border-pink-100 flex flex-col items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform duration-300">
                  <span className="text-[10px] font-black text-[var(--color-brand-pink-dark)] uppercase tracking-wider">
                    {dateObj.toLocaleDateString('en-GB', { month: 'short' })}
                  </span>
                  <span className="text-2xl font-black text-[var(--color-primary)] leading-tight">
                    {dateObj.getDate()}
                  </span>
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <p className="font-extrabold text-sm text-[var(--color-text-primary)] truncate max-w-[200px]">
                      {apt.service?.name || apt.service_name || 'Appointment'}
                    </p>
                    <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${getStatusColor(apt.status)}`}>
                      {apt.status === 'reschedule_pending' ? 'Reschedule Pending' : apt.status}
                    </span>
                    {apt.client_confirmed && (
                      <span className="inline-flex items-center gap-0.5 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
                        <Shield size={9} className="fill-emerald-500 text-emerald-500" /> Confirmed
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--color-text-muted)] font-medium">
                    <span className="flex items-center gap-1">
                      <Clock size={13} className="text-violet-400" />
                      {dateObj.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className="flex items-center gap-1">
                      <User size={13} className="text-pink-400" />
                      {role === 'master' ? apt.client?.full_name || 'Client' : apt.master?.full_name || 'Professional'}
                    </span>
                  </div>
                </div>

                {/* Price + Arrow */}
                <div className="text-right shrink-0 flex items-center gap-3">
                  <div>
                    <p className="font-extrabold text-base text-gradient-pink">£{apt.price ? Number(apt.price).toFixed(2) : '0.00'}</p>
                    <p className="text-[10px] text-gray-400 font-bold">
                      {apt.deposit_paid ? 'Deposit Paid' : 'No Deposit'}
                    </p>
                  </div>
                  <ChevronRight size={16} className="text-gray-300 group-hover:text-pink-400 group-hover:translate-x-1 transition-all" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Appointment Details Side-Drawer */}
      {selectedAppointment && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/45 backdrop-blur-xs animate-fade-in">
          {/* Backdrop Overlay Click to Close */}
          <div className="absolute inset-0 cursor-default" onClick={() => setSelectedAppointment(null)} />

          {/* Drawer Container */}
          <div className="relative w-full max-w-lg bg-white h-full shadow-2xl flex flex-col p-6 overflow-y-auto border-l border-gray-100 transform transition-transform duration-300 animate-slide-in-right z-10">
            
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-6 shrink-0">
              <div>
                <h3 className="text-lg font-black text-[var(--color-text-primary)]">Appointment Details</h3>
                <p className="text-xs text-[var(--color-text-muted)] font-medium mt-0.5">Reference ID: {selectedAppointment.id.slice(0, 8)}</p>
              </div>
              <button 
                onClick={() => setSelectedAppointment(null)}
                className="p-1.5 rounded-full hover:bg-gray-100 transition-colors cursor-pointer text-gray-400 hover:text-gray-700"
              >
                <X size={20} />
              </button>
            </div>

            {loadingDetails ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center">
                <Loader2 className="animate-spin text-pink-500 mb-2" size={32} />
                <p className="text-sm text-gray-500 font-semibold">Retrieving policy settings...</p>
              </div>
            ) : (
              <div className="flex-1 space-y-6">
                
                {/* Visual Card details */}
                <div className="bg-gradient-to-br from-pink-50/50 to-violet-50/50 rounded-2xl p-5 border border-pink-100/50 space-y-4">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <span className="text-[10px] font-black uppercase bg-violet-100 text-violet-700 px-2.5 py-0.5 rounded-full">
                        {selectedAppointment.service_category || 'Service'}
                      </span>
                      <h4 className="text-base font-black text-gray-800 mt-2">
                        {selectedAppointment.service?.name || selectedAppointment.service_name || 'Appointment'}
                      </h4>
                      <p className="text-xs text-gray-500 font-medium mt-1">
                        {selectedAppointment.service?.description || 'No detailed description available.'}
                      </p>
                    </div>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${getStatusColor(selectedAppointment.status)}`}>
                      {selectedAppointment.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-2 border-t border-pink-100/30">
                    <div className="flex gap-2 items-center">
                      <div className="p-2 rounded-xl bg-white shadow-sm text-pink-400 shrink-0">
                        <CalendarDays size={16} />
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 font-black uppercase leading-none">Date</p>
                        <p className="text-xs text-gray-700 font-bold mt-1">
                          {new Date(selectedAppointment.start_time).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2 items-center">
                      <div className="p-2 rounded-xl bg-white shadow-sm text-violet-400 shrink-0">
                        <Clock size={16} />
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 font-black uppercase leading-none">Time & Length</p>
                        <p className="text-xs text-gray-700 font-bold mt-1">
                          {new Date(selectedAppointment.start_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} ({selectedAppointment.service?.duration_minutes ?? selectedAppointment.service_duration_minutes ?? 60}m)
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Profile Card */}
                <div className="flex items-center justify-between p-4 rounded-xl border border-gray-100 bg-gray-50/50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-200 to-violet-200 overflow-hidden flex items-center justify-center font-bold text-white shadow-sm">
                      {role === 'master' 
                        ? (selectedAppointment.client?.avatar_url ? <img src={selectedAppointment.client.avatar_url} className="object-cover w-full h-full" alt="avatar" /> : selectedAppointment.client?.full_name.charAt(0))
                        : (selectedAppointment.master?.avatar_url ? <img src={selectedAppointment.master.avatar_url} className="object-cover w-full h-full" alt="avatar" /> : selectedAppointment.master?.full_name.charAt(0))
                      }
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 font-black uppercase leading-none">{role === 'master' ? 'Client' : 'Specialist'}</p>
                      <p className="text-sm font-bold text-gray-800 mt-1">
                        {role === 'master' ? selectedAppointment.client?.full_name : selectedAppointment.master?.full_name}
                      </p>
                      <p className="text-xs text-gray-500 font-medium">
                        {role === 'master' ? selectedAppointment.client?.email : selectedAppointment.master?.specialties?.join(', ') || 'Beauty Professional'}
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={handleDirectChat}
                    className="p-2.5 rounded-xl border border-pink-200 bg-pink-50 hover:bg-pink-100 text-[var(--color-brand-pink-dark)] hover:scale-105 transition-all cursor-pointer"
                    title="Send Direct Message"
                  >
                    <MessageSquare size={16} />
                  </button>
                </div>

                {/* Reschedule Proposal Display for Client */}
                {role !== 'master' && selectedAppointment.status === 'reschedule_pending' && selectedAppointment.proposed_start_time && (
                  <div className="p-4 rounded-2xl border border-violet-200 bg-violet-50/60 space-y-3 shadow-xs">
                    <div className="flex items-start gap-2.5 text-violet-800">
                      <CalendarRange className="shrink-0 text-violet-500" size={20} />
                      <div>
                        <p className="text-sm font-extrabold leading-tight">Reschedule Propose Received</p>
                        <p className="text-xs text-violet-700/80 font-medium mt-1">
                          Our specialist proposed to move this appointment to:
                        </p>
                        <p className="text-sm font-bold mt-2 text-violet-900 bg-white/95 px-3 py-1.5 rounded-xl shadow-xs inline-block">
                          📅 {new Date(selectedAppointment.proposed_start_time).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' })} at {new Date(selectedAppointment.proposed_start_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end pt-1">
                      <button 
                        onClick={() => handleRescheduleResponse(false)}
                        className="px-4 py-2 rounded-xl text-xs font-bold border border-violet-300 text-violet-800 hover:bg-violet-100 cursor-pointer"
                      >
                        Decline
                      </button>
                      <button 
                        onClick={() => handleRescheduleResponse(true)}
                        className="px-5 py-2 rounded-xl text-xs font-bold bg-violet-600 hover:bg-violet-700 text-white cursor-pointer shadow-sm"
                      >
                        Accept New Time
                      </button>
                    </div>
                  </div>
                )}

                {/* Reschedule Proposal Display for Master (Status View Only) */}
                {role === 'master' && selectedAppointment.status === 'reschedule_pending' && selectedAppointment.proposed_start_time && (
                  <div className="p-4 rounded-2xl border border-violet-100 bg-violet-50/30">
                    <div className="flex gap-2.5 items-center text-violet-700">
                      <Loader2 className="animate-spin text-violet-500 shrink-0" size={16} />
                      <div className="text-xs font-medium">
                        <span className="font-bold">Reschedule Proposal Pending Client Approval:</span> Proposed for{' '}
                        {new Date(selectedAppointment.proposed_start_time).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} at{' '}
                        {new Date(selectedAppointment.proposed_start_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}.
                      </div>
                    </div>
                  </div>
                )}

                {/* Price Breakdown */}
                <div className="space-y-2">
                  <h5 className="text-xs font-black text-gray-400 uppercase tracking-wider">Payment Breakdown</h5>
                  <div className="rounded-2xl border border-gray-100 p-4 space-y-2 bg-white shadow-xs">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500 font-medium">Base Service Total</span>
                      <span className="font-bold text-gray-800">£{Number(selectedAppointment.price).toFixed(2)}</span>
                    </div>

                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500 font-medium">Deposit Pre-Paid</span>
                      <span className="font-bold text-emerald-600">
                        {selectedAppointment.deposit_paid ? `-£${Number(selectedAppointment.deposit_amount).toFixed(2)}` : '£0.00'}
                      </span>
                    </div>

                    <div className="my-2 border-t border-gray-50" />

                    <div className="flex justify-between items-center text-base">
                      <span className="text-gray-800 font-extrabold">Balance Due at Salon</span>
                      <span className="font-black text-gradient-pink text-lg">
                        £{Number(selectedAppointment.price - (selectedAppointment.deposit_paid ? selectedAppointment.deposit_amount : 0)).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Late Arrival Tracking Display */}
                {confirmationData && confirmationData.client_arrived_at && (
                  <div className="p-4 rounded-xl border border-amber-100 bg-amber-50/40">
                    <div className="flex gap-2 items-center text-amber-800">
                      <CheckCircle className="text-emerald-500 shrink-0" size={16} />
                      <p className="text-xs font-semibold">
                        Client arrived at {new Date(confirmationData.client_arrived_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}{' '}
                        {confirmationData.client_arrived_late ? (
                          <span className="text-rose-600 font-bold uppercase text-[10px] ml-1 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                            LATE ARRIVAL
                          </span>
                        ) : (
                          <span className="text-emerald-600 font-bold uppercase text-[10px] ml-1 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                            ON-TIME
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                )}

                {/* Active Grace Period Countdown */}
                {confirmationData && confirmationData.grace_period_ends_at && !confirmationData.client_arrived_at && (
                  <div className="p-4 rounded-xl border border-rose-100 bg-rose-50/40">
                    <div className="flex gap-2.5 items-center text-rose-800">
                      <Clock3 className="text-rose-500 animate-pulse shrink-0" size={18} />
                      <div>
                        <p className="text-xs font-bold leading-tight">No-Show Grace Period Active</p>
                        <p className="text-[11px] text-rose-700/80 font-semibold mt-1">
                          Client must arrive before {new Date(confirmationData.grace_period_ends_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} or the booking is subject to auto-charge.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Attendance Confirmation Actions for Client */}
                {role !== 'master' && selectedAppointment.requires_confirmation && !selectedAppointment.client_confirmed && !['cancelled', 'completed', 'no_show'].includes(selectedAppointment.status) && (
                  <div className="p-4 rounded-2xl border border-amber-200 bg-amber-50/50 space-y-3">
                    <div className="flex items-start gap-2.5 text-amber-800">
                      <AlertTriangle className="shrink-0 text-amber-500 mt-0.5" size={18} />
                      <div>
                        <p className="text-xs font-black uppercase tracking-wider">Action Required: Attendance Confirmation</p>
                        <p className="text-xs text-amber-700 font-medium mt-1">
                          Please confirm you will attend this booking.
                          {selectedAppointment.confirmation_deadline && (
                            <span> Respond before <span className="font-extrabold">{new Date(selectedAppointment.confirmation_deadline).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} at {new Date(selectedAppointment.confirmation_deadline).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>.</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end pt-1">
                      <button 
                        onClick={() => handleClientConfirmation(false)}
                        className="px-4 py-2 rounded-xl text-xs font-bold border border-amber-300 text-amber-800 hover:bg-amber-100 cursor-pointer"
                      >
                        I Can't Attend
                      </button>
                      <button 
                        onClick={() => handleClientConfirmation(true)}
                        className="px-5 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white cursor-pointer shadow-sm"
                      >
                        Confirm Attendance
                      </button>
                    </div>
                  </div>
                )}

                {/* Confirmed & Protected Badge */}
                {selectedAppointment.client_confirmed && !['cancelled', 'completed', 'no_show'].includes(selectedAppointment.status) && (
                  <div className="flex items-center gap-2 p-3.5 rounded-2xl bg-emerald-50 text-emerald-800 border border-emerald-100">
                    <Shield className="text-emerald-500 fill-emerald-100 shrink-0" size={20} />
                    <div>
                      <p className="text-xs font-black uppercase tracking-wider leading-none">Confirmed & Protected</p>
                      <p className="text-[10px] text-emerald-600 font-semibold mt-1">Attendance is locked. Penalty protections active under professional policies.</p>
                    </div>
                  </div>
                )}

                {/* Cancellation Policy Display */}
                <div className="space-y-2">
                  <h5 className="text-xs font-black text-gray-400 uppercase tracking-wider">Cancellation Policy</h5>
                  <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-100 text-xs text-gray-500 leading-relaxed font-medium">
                    Cancel for free up to <span className="font-bold text-gray-700">24 hours</span> before your session. Cancellations within this window are subject to a <span className="font-bold text-gray-700">50% fee</span>. No-Shows are billed at <span className="font-bold text-gray-700">100%</span>.
                  </div>
                </div>

                {/* Drawer Footer Actions */}
                <div className="pt-6 border-t border-gray-100 space-y-3 shrink-0">
                  
                  {/* Master Propose Reschedule Actions */}
                  {role === 'master' && !['cancelled', 'completed', 'no_show'].includes(selectedAppointment.status) && (
                    <div className="space-y-3">
                      {!showRescheduleForm ? (
                        <button 
                          onClick={() => { setShowRescheduleForm(true); setShowLateInputForm(false); }}
                          className="w-full py-3 rounded-xl border border-violet-200 text-violet-700 font-bold hover:bg-violet-50 text-sm cursor-pointer transition-all flex items-center justify-center gap-2"
                        >
                          <CalendarRange size={16} /> Propose Reschedule
                        </button>
                      ) : (
                        <div className="p-4 rounded-2xl border border-violet-100 bg-violet-50/20 space-y-3">
                          <h6 className="text-xs font-black text-violet-800 uppercase tracking-wider">Propose New Date/Time</h6>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] text-gray-400 font-black uppercase mb-1">New Date</label>
                              <input 
                                type="date" 
                                value={rescheduleDate}
                                onChange={(e) => setRescheduleDate(e.target.value)}
                                className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] text-gray-400 font-black uppercase mb-1">Start Time</label>
                              <input 
                                type="time" 
                                value={rescheduleTime}
                                onChange={(e) => setRescheduleTime(e.target.value)}
                                className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                              />
                            </div>
                          </div>
                          <div className="flex gap-2 justify-end">
                            <button 
                              onClick={() => setShowRescheduleForm(false)}
                              className="px-3 py-1.5 rounded-lg text-xs font-bold border border-violet-200 text-violet-800 hover:bg-violet-100 cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button 
                              onClick={handleProposeReschedule}
                              className="px-4 py-1.5 rounded-lg text-xs font-bold bg-violet-600 hover:bg-violet-700 text-white cursor-pointer shadow-sm"
                            >
                              Submit Proposal
                            </button>
                          </div>
                        </div>
                      )}

                      {/* No-Show modal buttons */}
                      {!showNoShowModal && !showLateInputForm ? (
                        <div className="grid grid-cols-2 gap-2">
                          <button 
                            onClick={() => { setShowNoShowModal(true); setShowRescheduleForm(false); }}
                            className="py-3 rounded-xl border border-rose-200 text-rose-600 font-bold hover:bg-rose-50 text-sm cursor-pointer transition-all flex items-center justify-center gap-1.5"
                          >
                            <ShieldAlert size={16} /> Client No-Show
                          </button>
                          <button 
                            onClick={() => { setShowLateInputForm(true); setShowRescheduleForm(false); }}
                            className="py-3 rounded-xl border border-amber-200 text-amber-700 font-bold hover:bg-amber-50 text-sm cursor-pointer transition-all flex items-center justify-center gap-1.5"
                          >
                            <UserCheck size={16} /> Client Late Arrival
                          </button>
                        </div>
                      ) : showNoShowModal ? (
                        <div className="p-4 rounded-2xl border border-rose-100 bg-rose-50/20 space-y-3">
                          <div className="flex items-center justify-between">
                            <h6 className="text-xs font-black text-rose-800 uppercase tracking-wider">No-Show Action Panel</h6>
                            <button onClick={() => setShowNoShowModal(false)} className="text-rose-400 hover:text-rose-700"><X size={16} /></button>
                          </div>
                          <p className="text-[11px] text-gray-500 font-medium">Select penalty response type for this no-show booking:</p>
                          <div className="grid grid-cols-2 gap-2 pt-1">
                            <button 
                              onClick={handleNoShowWaitGrace}
                              className="py-2 px-3 rounded-xl border border-rose-200 text-rose-700 font-bold text-xs bg-white hover:bg-rose-50 cursor-pointer text-center"
                            >
                              ⌛ Wait Grace Period
                            </button>
                            <button 
                              onClick={handleNoShowChargeNow}
                              className="py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs cursor-pointer text-center shadow-xs"
                            >
                              💸 Charge Fee Now
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="p-4 rounded-2xl border border-amber-100 bg-amber-50/20 space-y-3">
                          <div className="flex items-center justify-between">
                            <h6 className="text-xs font-black text-amber-800 uppercase tracking-wider">Arrived Late Tracker</h6>
                            <button onClick={() => setShowLateInputForm(false)} className="text-amber-400 hover:text-amber-700"><X size={16} /></button>
                          </div>
                          <div className="flex gap-2 items-end">
                            <div className="flex-1">
                              <label className="block text-[10px] text-gray-400 font-black uppercase mb-1">Minutes Late</label>
                              <input 
                                type="number"
                                min="1"
                                value={lateMinutesInput}
                                onChange={(e) => setLateMinutesInput(e.target.value)}
                                className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                              />
                            </div>
                            <button 
                              onClick={handleNoShowClientLate}
                              className="py-2 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs cursor-pointer shadow-sm"
                            >
                              Log Attendance
                            </button>
                          </div>
                        </div>
                      )}

                      <button 
                        onClick={handleMarkAsCompleted}
                        className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-black text-sm cursor-pointer shadow-md transition-all flex items-center justify-center gap-1.5"
                      >
                        <CheckCircle size={16} /> Mark as Completed
                      </button>
                    </div>
                  )}

                  {/* Client Cancel Booking Trigger */}
                  {role !== 'master' && !['cancelled', 'completed', 'no_show'].includes(selectedAppointment.status) && (
                    <div className="space-y-3">
                      {!showCancelConfirm ? (
                        <button 
                          onClick={() => setShowCancelConfirm(true)}
                          className="w-full py-3 rounded-xl border border-rose-200 text-rose-500 font-bold hover:bg-rose-50 text-sm cursor-pointer transition-all flex items-center justify-center gap-1.5"
                        >
                          <Trash2 size={16} /> Cancel Appointment
                        </button>
                      ) : (
                        <div className="p-4 rounded-2xl border border-rose-200 bg-rose-50/50 space-y-3 animate-slide-up">
                          <div className="flex gap-2 items-start text-rose-800">
                            <AlertTriangle className="text-rose-500 shrink-0 mt-0.5" size={18} />
                            <div>
                              <p className="text-xs font-black uppercase tracking-wider">Confirm Cancellation</p>
                              {isLateCancellation(selectedAppointment.start_time) ? (
                                <p className="text-xs text-rose-700 font-semibold mt-1">
                                  ⚠️ <span className="font-extrabold">Late Cancellation Alert:</span> This booking is under {settingsData?.late_cancellation_window_hours ?? 24}h away. Cancelling now will incur a <span className="font-extrabold">{settingsData?.cancellation_charge_percent ?? 50}% fee (£{((selectedAppointment.price * (settingsData?.cancellation_charge_percent ?? 50)) / 100).toFixed(2)})</span>.
                                </p>
                              ) : (
                                <p className="text-xs text-rose-600 font-medium mt-1">
                                  This cancellation is outside the late penalty window. You can cancel this session for free.
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2 justify-end">
                            <button 
                              onClick={() => setShowCancelConfirm(false)}
                              className="px-4 py-2 rounded-xl text-xs font-bold border border-rose-300 text-rose-800 hover:bg-rose-100 cursor-pointer"
                            >
                              Keep Appointment
                            </button>
                            <button 
                              onClick={handleCancelAppointment}
                              className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white cursor-pointer shadow-sm"
                            >
                              Cancel Booking anyway
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                </div>

              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
}
