'use client';

import { useState, useEffect, useMemo, type Dispatch, type SetStateAction } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Search, Star, Clock, ArrowRight, ArrowLeft, Calendar, CheckCircle2, Sparkles, User, Scissors, SlidersHorizontal, Loader2, ChevronLeft, ChevronRight, AlertCircle, CreditCard, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import type { Tables } from '@/types/database';
import type { SavedCard } from '@/components/PaymentMethodsManager';
import { CardBrandBadge } from '@/components/PaymentMethodsManager';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY as string);

type BookingError = Error & {
  context?: {
    json?: () => Promise<{ error?: string }>;
  };
};

type BookingUser = {
  id: string;
};

type BookingDraft = {
  step: number;
  selectedServiceId: string | null;
  selectedMasterId: string | null;
  selectedPilatesSessionId: string | null;
  selectedDate: string;
  selectedTime: string;
  calendarMonth: string;
  selectedCategory: string;
  searchQuery: string;
  isMasterPreselected: boolean;
};

interface CheckoutFormProps {
  user: BookingUser | null;
  profile: { email?: string | null; stripe_customer_id?: string | null } | null;
  selectedService: Service | null;
  selectedMaster: Master | null;
  selectedPilatesSession: PilatesSession | null;
  selectedDate: string;
  selectedTime: string;
  onBookSuccess: () => void;
  submitting: boolean;
  setSubmitting: Dispatch<SetStateAction<boolean>>;
}

function CheckoutForm({ user, profile, selectedService, selectedMaster, selectedPilatesSession, selectedDate, selectedTime, onBookSuccess, submitting, setSubmitting }: CheckoutFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const supabase = createClient();
  const [savedCards, setSavedCards] = useState<SavedCard[]>([]);
  const [loadingCards, setLoadingCards] = useState(true);
  const [selectedPm, setSelectedPm] = useState<string>('new');

  useEffect(() => {
    const load = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('list-payment-methods', { body: {} });
        if (!error && data?.paymentMethods?.length) {
          setSavedCards(data.paymentMethods);
          const def = data.paymentMethods.find((c: SavedCard) => c.isDefault);
          setSelectedPm(def ? def.id : data.paymentMethods[0].id);
        }
      } catch { /* ignore */ }
      setLoadingCards(false);
    };
    load();
  }, [supabase]);

  const usingSavedCard = selectedPm !== 'new';

  const handleBook = async () => {
    if (!stripe || !user || !selectedService || !selectedDate || !selectedTime) return;
    if (!usingSavedCard && !elements) return;
    const isPilates = selectedService.category === 'Pilates';
    if (isPilates && !selectedPilatesSession) return;
    if (!isPilates && !selectedMaster) return;
    const appointmentStartDate = isPilates ? null : getAppointmentDateTime(selectedDate, selectedTime);
    if (!isPilates && !appointmentStartDate) {
      alert('Please choose a valid future date and time before booking.');
      return;
    }
    const bookingMasterId = selectedPilatesSession?.host?.profile_id || selectedPilatesSession?.owner_id || selectedMaster?.id;
    const bookingHostName = selectedPilatesSession?.host?.display_name || selectedMaster?.full_name || 'Pilates host';
    if (!bookingMasterId) return;
    if (bookingMasterId === user.id) {
      alert('You cannot book an appointment with yourself.');
      return;
    }
    setSubmitting(true);
    try {
      let paymentMethodId: string;
      let setupIntentId: string | null = null;
      let customerId: string | undefined = profile?.stripe_customer_id || undefined;

      if (usingSavedCard) {
        paymentMethodId = selectedPm;
      } else {
        const cardElement = elements!.getElement(CardElement);
        if (!cardElement) throw new Error('Enter your card details');

        const { data: setupIntentData, error: setupError } = await supabase.functions.invoke('setup-intent', {
          body: { user_email: profile?.email, customer_id: customerId },
        });
        if (setupError) throw setupError;

        const { setupIntent, error: confirmSetupError } = await stripe.confirmCardSetup(
          setupIntentData.clientSecret,
          { payment_method: { card: cardElement } }
        );
        if (confirmSetupError) throw confirmSetupError;

        paymentMethodId = setupIntent!.payment_method as string;
        setupIntentId = setupIntentData.setupIntentId;
        customerId = setupIntentData.customerId;
      }

      const amountToPay = Math.round(selectedService.base_price * 100);

      const { data: paymentIntentData, error: piError } = await supabase.functions.invoke('create-payment-intent', {
        body: {
          amount: amountToPay,
          currency: 'eur',
          customer_id: customerId,
          payment_method_id: paymentMethodId,
          master_id: bookingMasterId,
          description: `Booking with ${bookingHostName}`,
          capture_method: 'automatic',
        }
      });
      if (piError) throw piError;

      const { error: confirmPaymentError } = await stripe.confirmCardPayment(
        paymentIntentData.clientSecret,
        usingSavedCard ? { payment_method: paymentMethodId } : undefined
      );
      if (confirmPaymentError) throw confirmPaymentError;

      const { error: bookError } = isPilates && selectedPilatesSession
        ? await supabase.rpc('book_pilates_session', {
          p_session_id: selectedPilatesSession.id,
          p_stripe_setup_intent_id: setupIntentId ?? undefined,
          p_stripe_payment_intent_id: paymentIntentData.paymentIntentId,
          p_deposit_amount: selectedService.base_price,
          p_deposit_payment_intent_id: paymentIntentData.paymentIntentId,
        })
        : await supabase.rpc(
          'book_appointment_with_confirmation',
          {
              p_master_id: bookingMasterId,
              p_service_id: selectedService.id,
              p_start_time: appointmentStartDate!.toISOString(),
              p_stripe_setup_intent_id: setupIntentId ?? undefined,
              p_stripe_payment_intent_id: paymentIntentData.paymentIntentId,
              p_deposit_amount: selectedService.base_price,
              p_deposit_payment_intent_id: paymentIntentData.paymentIntentId,
          }
        );
      if (bookError) throw bookError;

      onBookSuccess();
    } catch (err: unknown) {
      console.error('Booking failed:', err);
      const bookingError = err as BookingError;
      let msg = bookingError.message || 'Failed to create booking. Please try again.';
      if (bookingError.context && typeof bookingError.context.json === 'function') {
        try { const errData = await bookingError.context.json(); if (errData && errData.error) msg = errData.error; } catch {}
      }
      alert(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full">
      <div className="p-4 bg-white/60 border border-white rounded-xl mb-6 shadow-sm">
         <h4 className="font-bold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
            <CreditCard size={18} /> Payment Details
         </h4>

         {loadingCards ? (
           <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)] py-4">
             <Loader2 size={16} className="animate-spin" /> Loading payment methods...
           </div>
         ) : savedCards.length > 0 ? (
           <div className="space-y-2 mb-4">
             {savedCards.map(card => (
               <label
                 key={card.id}
                 className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                   selectedPm === card.id
                     ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5 ring-1 ring-[var(--color-primary)]/20'
                     : 'border-[var(--color-border-light)] hover:border-[var(--color-primary)]/30'
                 }`}
               >
                 <input
                   type="radio"
                   name="payment_method"
                   value={card.id}
                   checked={selectedPm === card.id}
                   onChange={() => setSelectedPm(card.id)}
                   className="accent-[var(--color-primary)]"
                 />
                 <CardBrandBadge brand={card.brand} />
                 <span className="font-semibold text-sm text-[var(--color-text-primary)]">•••• {card.last4}</span>
                 <span className="text-xs text-[var(--color-text-muted)]">{String(card.expMonth).padStart(2, '0')}/{card.expYear}</span>
                 {card.isDefault && (
                   <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 ml-auto">Default</span>
                 )}
               </label>
             ))}
             <label
               className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                 selectedPm === 'new'
                   ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5 ring-1 ring-[var(--color-primary)]/20'
                   : 'border-[var(--color-border-light)] hover:border-[var(--color-primary)]/30'
               }`}
             >
               <input
                 type="radio"
                 name="payment_method"
                 value="new"
                 checked={selectedPm === 'new'}
                 onChange={() => setSelectedPm('new')}
                 className="accent-[var(--color-primary)]"
               />
               <Plus size={16} className="text-[var(--color-text-muted)]" />
               <span className="text-sm font-medium text-[var(--color-text-secondary)]">Use a new card</span>
             </label>
           </div>
         ) : null}

         {(!usingSavedCard || savedCards.length === 0) && (
           <div className="p-4 bg-white rounded-lg border border-pink-100 shadow-inner">
             <CardElement options={{
               style: {
                 base: { fontSize: '16px', color: '#424770', '::placeholder': { color: '#aab7c4' } },
                 invalid: { color: '#9e2146' },
               },
             }} />
           </div>
         )}

         <p className="text-xs text-[var(--color-text-secondary)] mt-3">
           You will be charged €{selectedService?.base_price ?? 0} today for your booking.
         </p>
      </div>
      <button
        onClick={handleBook}
        disabled={submitting || !stripe || (!usingSavedCard && !elements)}
        className="w-full btn-primary py-4 text-lg font-bold shadow-xl shadow-pink-500/20 hover:shadow-2xl hover:shadow-pink-500/30 hover:-translate-y-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {submitting ? 'Confirming Appointment...' : 'Confirm & Book Appointment'}
      </button>
    </div>
  );
}

interface Service {
  id: string;
  name: string;
  description: string | null;
  base_price: number;
  duration_minutes: number;
  category: string | null;
  image_url: string | null;
  created_by: string | null;
}

interface Master {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  specialties: string | null;
  city: string | null;
}

type PilatesSettings = Tables<'pilates_settings'>;
type PilatesHost = Tables<'pilates_hosts'>;
type PilatesBooking = Pick<Tables<'pilates_session_bookings'>, 'id' | 'status'>;
type PilatesSession = Tables<'pilates_class_sessions'> & {
  host: PilatesHost | null;
  pilates_session_bookings: PilatesBooking[] | null;
};

const fallbackImages = [
  'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=400&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=400&q=80&auto=format&fit=crop',
];

const SERVICE_CATEGORIES = ['All', 'Nails', 'Lashes', 'Brows', 'Hair', 'Makeup', 'Skincare', 'Pilates', 'Other'];
const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DEFAULT_AVAILABILITY_START = '09:00';
const DEFAULT_AVAILABILITY_END = '19:00';
const BOOKING_DRAFT_STORAGE_PREFIX = 'meraki:booking:draft:';

type MasterAvailability = {
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_available: boolean;
};

type BlockedSlot = {
  start_time: string;
  end_time: string;
};

const normalizeTimeString = (value: string | null | undefined) => {
  if (!value) return '';
  const trimmed = value.slice(0, 5);
  return TIME_PATTERN.test(trimmed) ? trimmed : '';
};

const generateTimeSlotsForRange = (start: string, end: string) => {
  const startNorm = normalizeTimeString(start) || DEFAULT_AVAILABILITY_START;
  const endNorm = normalizeTimeString(end) || DEFAULT_AVAILABILITY_END;
  const [startHour, startMin] = startNorm.split(':').map(Number);
  const [endHour, endMin] = endNorm.split(':').map(Number);
  const slots: string[] = [];
  let hour = startHour;
  let minute = startMin;
  while (hour < endHour || (hour === endHour && minute < endMin)) {
    slots.push(`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);
    minute += 30;
    if (minute >= 60) {
      minute = 0;
      hour += 1;
    }
  }
  return slots;
};

const getStartOfToday = () => {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth(), today.getDate());
};

const toDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getDateFromKey = (dateKey: string) => {
  if (!DATE_KEY_PATTERN.test(dateKey)) return null;
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
};

const isSelectableDateKey = (dateKey: string) => {
  const date = getDateFromKey(dateKey);
  return Boolean(date && date >= getStartOfToday());
};

const getAppointmentDateTime = (dateKey: string, time: string) => {
  if (!isSelectableDateKey(dateKey) || !TIME_PATTERN.test(time)) return null;
  const date = getDateFromKey(dateKey);
  if (!date) return null;
  const [hours, minutes] = time.split(':').map(Number);
  date.setHours(hours, minutes, 0, 0);
  if (Number.isNaN(date.getTime()) || date.getTime() <= Date.now()) return null;
  return date;
};

const buildCalendarWeeks = (month: Date) => {
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
  const startDay = new Date(firstDay);
  startDay.setDate(firstDay.getDate() - firstDay.getDay());

  return Array.from({ length: 6 }, (_, weekIndex) =>
    Array.from({ length: 7 }, (_, dayIndex) => {
      const date = new Date(startDay);
      date.setDate(startDay.getDate() + weekIndex * 7 + dayIndex);
      return date;
    })
  );
};

const formatDateLabel = (dateKey: string) => {
  const date = getDateFromKey(dateKey);
  if (!date) return dateKey;
  return date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
};

const parseBookingDraft = (value: string | null) => {
  if (!value) return null;
  try {
    const draft = JSON.parse(value) as Partial<BookingDraft>;
    return {
      step: typeof draft.step === 'number' && draft.step >= 1 && draft.step <= 4 ? draft.step : 1,
      selectedServiceId: typeof draft.selectedServiceId === 'string' ? draft.selectedServiceId : null,
      selectedMasterId: typeof draft.selectedMasterId === 'string' ? draft.selectedMasterId : null,
      selectedPilatesSessionId: typeof draft.selectedPilatesSessionId === 'string' ? draft.selectedPilatesSessionId : null,
      selectedDate: typeof draft.selectedDate === 'string' && DATE_KEY_PATTERN.test(draft.selectedDate) ? draft.selectedDate : '',
      selectedTime: typeof draft.selectedTime === 'string' && TIME_PATTERN.test(draft.selectedTime) ? draft.selectedTime : '',
      calendarMonth: typeof draft.calendarMonth === 'string' && DATE_KEY_PATTERN.test(draft.calendarMonth) ? draft.calendarMonth : '',
      selectedCategory: typeof draft.selectedCategory === 'string' ? draft.selectedCategory : 'All',
      searchQuery: typeof draft.searchQuery === 'string' ? draft.searchQuery : '',
      isMasterPreselected: draft.isMasterPreselected === true,
    };
  } catch {
    return null;
  }
};

export default function BookingPage() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const supabase = createClient();
  const draftStorageKey = user?.id ? `${BOOKING_DRAFT_STORAGE_PREFIX}${user.id}` : null;
  const initialBookingDraft = useMemo(() => {
    if (!draftStorageKey || typeof window === 'undefined') return null;
    return parseBookingDraft(sessionStorage.getItem(draftStorageKey));
  }, [draftStorageKey]);

  const [step, setStep] = useState(() => initialBookingDraft?.step ?? 1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState(() => initialBookingDraft?.searchQuery ?? '');
  const [selectedCategory, setSelectedCategory] = useState(() => initialBookingDraft?.selectedCategory ?? 'All');

  // Data
  const [services, setServices] = useState<Service[]>([]);
  const [masters, setMasters] = useState<Master[]>([]);
  
  // Selections
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(() => initialBookingDraft?.selectedServiceId ?? null);
  const [selectedMasterId, setSelectedMasterId] = useState<string | null>(() => initialBookingDraft?.selectedMasterId ?? null);
  const [selectedPilatesSessionId, setSelectedPilatesSessionId] = useState<string | null>(() => initialBookingDraft?.selectedPilatesSessionId ?? null);
  const [selectedDate, setSelectedDate] = useState<string>(() => initialBookingDraft?.selectedDate ?? '');
  const [selectedTime, setSelectedTime] = useState<string>(() => initialBookingDraft?.selectedTime ?? '');
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const restoredCalendarMonth = initialBookingDraft?.calendarMonth ? getDateFromKey(initialBookingDraft.calendarMonth) : null;
    if (restoredCalendarMonth) {
      return new Date(restoredCalendarMonth.getFullYear(), restoredCalendarMonth.getMonth(), 1);
    }
    const today = getStartOfToday();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [isMasterPreselected, setIsMasterPreselected] = useState(() => initialBookingDraft?.isMasterPreselected ?? false);
  const [pilatesSettings, setPilatesSettings] = useState<PilatesSettings | null>(null);
  const [pilatesSessions, setPilatesSessions] = useState<PilatesSession[]>([]);
  const [loadingPilatesSessions, setLoadingPilatesSessions] = useState(false);
  const [masterAvailability, setMasterAvailability] = useState<MasterAvailability[]>([]);
  const [blockedSlots, setBlockedSlots] = useState<BlockedSlot[]>([]);
  const [bookedSlotKeys, setBookedSlotKeys] = useState<string[]>([]);
  const [isFetchingSlots, setIsFetchingSlots] = useState(false);
  const selectedService = useMemo(
    () => services.find((service) => service.id === selectedServiceId) ?? null,
    [selectedServiceId, services]
  );
  const selectedMaster = useMemo(
    () => masters.find((master) => master.id === selectedMasterId) ?? null,
    [selectedMasterId, masters]
  );
  const selectedPilatesSession = useMemo(
    () => pilatesSessions.find((session) => session.id === selectedPilatesSessionId) ?? null,
    [pilatesSessions, selectedPilatesSessionId]
  );

  useEffect(() => {
    if (!draftStorageKey) return;

    if (step === 5) {
      sessionStorage.removeItem(draftStorageKey);
      return;
    }

    const draft: BookingDraft = {
      step,
      selectedServiceId,
      selectedMasterId,
      selectedPilatesSessionId,
      selectedDate,
      selectedTime,
      calendarMonth: toDateKey(calendarMonth),
      selectedCategory,
      searchQuery,
      isMasterPreselected,
    };

    sessionStorage.setItem(draftStorageKey, JSON.stringify(draft));
  }, [calendarMonth, draftStorageKey, isMasterPreselected, searchQuery, selectedCategory, selectedDate, selectedMasterId, selectedPilatesSessionId, selectedServiceId, selectedTime, step]);

  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [servicesRes, mastersRes] = await Promise.all([
          supabase.from('services').select('*').eq('is_active', true).limit(30),
          supabase.from('profiles').select('id, full_name, avatar_url, specialties, city').eq('is_master', true).limit(20),
        ]);
        const loadedServices = ((servicesRes.data as unknown as Service[]) || []);
        setServices(loadedServices);
        const loadedMasters = ((mastersRes.data as unknown as Master[]) || []).filter((master) => master.id !== user?.id);
        setMasters(loadedMasters);

        // Check for masterId parameter in the URL
        if (typeof window !== 'undefined') {
          const params = new URLSearchParams(window.location.search);
          const masterIdUrl = params.get('masterId');
          if (masterIdUrl && masterIdUrl !== user?.id) {
            const preSelected = loadedMasters.find(m => m.id === masterIdUrl);
            if (preSelected) {
              setSelectedMasterId(preSelected.id);
              setIsMasterPreselected(true);
            }
          }
        }
      } catch (err) {
        console.error('Error fetching booking data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [supabase, user?.id]);

  useEffect(() => {
    const fetchPilatesSettings = async () => {
      if (selectedService?.category !== 'Pilates') {
        setPilatesSettings(null);
        return;
      }

      const { data } = await supabase
        .from('pilates_settings')
        .select('*')
        .eq('service_id', selectedService.id)
        .maybeSingle();

      setPilatesSettings(data || null);
    };

    fetchPilatesSettings();
  }, [selectedService?.id, selectedService?.category, supabase]);

  useEffect(() => {
    const fetchPilatesSessions = async () => {
      if (selectedService?.category !== 'Pilates') {
        setPilatesSessions([]);
        setSelectedPilatesSessionId(null);
        return;
      }

      setLoadingPilatesSessions(true);
      try {
        const startDate = new Date().toISOString().slice(0, 10);
        const endDate = new Date(Date.now() + 35 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        await supabase.rpc('ensure_pilates_sessions', {
          p_service_id: selectedService.id,
          p_start_date: startDate,
          p_end_date: endDate,
        });
        const { data, error } = await supabase
          .from('pilates_class_sessions')
          .select('*, host:pilates_hosts(*), pilates_session_bookings(id, status)')
          .eq('service_id', selectedService.id)
          .gte('starts_at', new Date().toISOString())
          .lt('starts_at', new Date(Date.now() + 35 * 24 * 60 * 60 * 1000).toISOString())
          .eq('status', 'scheduled')
          .order('starts_at');
        if (error) throw error;
        setPilatesSessions(((data as unknown as PilatesSession[]) || []).filter((session) => {
          const hostId = session.host?.profile_id || session.owner_id;
          return hostId !== user?.id;
        }));
      } catch (err) {
        console.error('Error loading Pilates sessions:', err);
      } finally {
        setLoadingPilatesSessions(false);
      }
    };

    fetchPilatesSessions();
  }, [selectedService?.id, selectedService?.category, supabase, user?.id]);

  const isPilatesService = selectedService?.category === 'Pilates';
  const today = getStartOfToday();
  const minimumCalendarMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const calendarWeeks = buildCalendarWeeks(calendarMonth);
  const canViewPreviousMonth = calendarMonth.getTime() > minimumCalendarMonth.getTime();
  const selectedDateLabel = selectedDate ? formatDateLabel(selectedDate) : 'Choose a day';
  const selectedHostId = selectedPilatesSession?.host?.profile_id || selectedPilatesSession?.owner_id || selectedMaster?.id;
  const isSelfBooking = Boolean(user?.id && selectedHostId === user.id);

  useEffect(() => {
    if (!selectedMasterId || isPilatesService) {
      setMasterAvailability([]);
      setBlockedSlots([]);
      return;
    }
    let cancelled = false;
    const fetchMasterSchedule = async () => {
      try {
        const [availabilityRes, blockedRes] = await Promise.all([
          supabase
            .from('master_availability')
            .select('day_of_week, start_time, end_time, is_available')
            .eq('master_id', selectedMasterId),
          supabase
            .from('blocked_slots')
            .select('start_time, end_time')
            .eq('master_id', selectedMasterId),
        ]);
        if (cancelled) return;
        setMasterAvailability((availabilityRes.data as MasterAvailability[]) || []);
        setBlockedSlots((blockedRes.data as BlockedSlot[]) || []);
      } catch (err) {
        if (!cancelled) console.error('Error loading master schedule:', err);
      }
    };
    fetchMasterSchedule();
    return () => {
      cancelled = true;
    };
  }, [selectedMasterId, isPilatesService, supabase]);

  useEffect(() => {
    if (!selectedMasterId || isPilatesService || !selectedDate || !DATE_KEY_PATTERN.test(selectedDate)) {
      setBookedSlotKeys([]);
      return;
    }
    let cancelled = false;
    const fetchBooked = async () => {
      setIsFetchingSlots(true);
      try {
        const { data } = await supabase
          .from('appointments')
          .select('start_time')
          .eq('master_id', selectedMasterId)
          .gte('start_time', `${selectedDate}T00:00:00`)
          .lt('start_time', `${selectedDate}T23:59:59`)
          .in('status', ['pending', 'confirmed']);
        if (cancelled) return;
        const keys = ((data as { start_time: string }[]) || []).map((apt) => {
          const d = new Date(apt.start_time);
          return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        });
        setBookedSlotKeys(keys);
      } catch (err) {
        if (!cancelled) console.error('Error fetching booked slots:', err);
      } finally {
        if (!cancelled) setIsFetchingSlots(false);
      }
    };
    fetchBooked();
    return () => {
      cancelled = true;
    };
  }, [selectedMasterId, isPilatesService, selectedDate, supabase]);

  const selectedDayAvailability = useMemo(() => {
    if (!selectedDate) return null;
    const date = getDateFromKey(selectedDate);
    if (!date) return null;
    const dayOfWeek = date.getDay();
    return (
      masterAvailability.find((a) => a.day_of_week === dayOfWeek && a.is_available) || null
    );
  }, [selectedDate, masterAvailability]);

  const timeSlots = useMemo(() => {
    if (isPilatesService) return [];
    if (!selectedDayAvailability) return [];
    return generateTimeSlotsForRange(
      selectedDayAvailability.start_time,
      selectedDayAvailability.end_time
    );
  }, [isPilatesService, selectedDayAvailability]);

  const isTimeSlotDisabled = (time: string) => {
    if (!selectedDate || isFetchingSlots) return true;
    const appointmentDate = getAppointmentDateTime(selectedDate, time);
    if (!appointmentDate) return true;
    if (bookedSlotKeys.includes(time)) return true;
    for (const blocked of blockedSlots) {
      const blockStart = new Date(blocked.start_time);
      const blockEnd = new Date(blocked.end_time);
      if (appointmentDate >= blockStart && appointmentDate < blockEnd) return true;
    }
    return false;
  };

  useEffect(() => {
    if (!selectedTime) return;
    if (isPilatesService) return;
    if (timeSlots.length > 0 && !timeSlots.includes(selectedTime)) {
      setSelectedTime('');
      return;
    }
    if (bookedSlotKeys.includes(selectedTime)) {
      setSelectedTime('');
    }
  }, [bookedSlotKeys, isPilatesService, selectedTime, timeSlots]);

  const dateTimeValidationMessage = isSelfBooking
    ? 'You cannot book an appointment with yourself.'
    : isPilatesService
    ? (!selectedPilatesSession ? 'Choose one available Pilates class.' : '')
    : !selectedDate
      ? 'Pick a day to see available times.'
      : !selectedDayAvailability
        ? 'This professional is not available on this day. Choose another date.'
        : !selectedTime
          ? 'Choose an available time for this date.'
          : isTimeSlotDisabled(selectedTime)
            ? 'This date and time is no longer available. Pick another slot.'
            : '';
  const canContinueToConfirmation = isPilatesService ? Boolean(selectedPilatesSession) && !dateTimeValidationMessage : !dateTimeValidationMessage;

  const changeCalendarMonth = (monthOffset: number) => {
    setCalendarMonth((currentMonth) => {
      const nextMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + monthOffset, 1);
      return nextMonth < minimumCalendarMonth ? minimumCalendarMonth : nextMonth;
    });
  };

  const selectDateFromCalendar = (dateKey: string) => {
    if (!isSelectableDateKey(dateKey)) return;
    setSelectedDate(dateKey);
    setSelectedTime('');
  };

  const handleContinueToConfirmation = () => {
    if (!canContinueToConfirmation) return;
    setStep(4);
  };

  const normalizedSearchQuery = searchQuery.toLowerCase();
  const filteredServices = services.filter((service) => {
    const matchesCategory = selectedCategory === 'All' || service.category === selectedCategory;
    const matchesSearch = service.name.toLowerCase().includes(normalizedSearchQuery);
    return matchesCategory && matchesSearch;
  });
  const visibleCategories = SERVICE_CATEGORIES.filter((category) => {
    return category === 'All' || services.some((service) => service.category === category);
  });
  const getBookedCount = (session: PilatesSession) => session.pilates_session_bookings?.filter((booking) => booking.status === 'booked').length || 0;
  const getSpotsLeft = (session: PilatesSession) => Math.max(0, session.capacity - getBookedCount(session));
  const selectPilatesSession = (session: PilatesSession) => {
    const startsAt = new Date(session.starts_at);
    setSelectedPilatesSessionId(session.id);
    setSelectedDate(toDateKey(startsAt));
    setSelectedTime(startsAt.toTimeString().slice(0, 5));
  };
  const groupedPilatesSessions = pilatesSessions.reduce<Record<string, PilatesSession[]>>((acc, session) => {
    const key = new Date(session.starts_at).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
    acc[key] = [...(acc[key] || []), session];
    return acc;
  }, {});

  return (
    <div className="w-full max-w-4xl mx-auto animate-fade-in pb-20 relative">
      
      {/* Decorative background blobs for extra vibrancy */}
      <div className="blob-pink fixed top-10 right-0 opacity-50 -z-10" />
      <div className="blob-purple fixed bottom-0 left-0 opacity-50 -z-10" />
      <div className="blob-mint fixed top-1/3 left-0 opacity-30 -z-10" />
      
      {/* Colorful Step Progress Indicator */}
      <div className="flex items-center justify-center gap-0 mb-8 px-4">
        {['Service', 'Professional', 'Date & Time', 'Confirm'].map((label, idx) => {
          const stepNum = idx + 1;
          const isCompleted = step > stepNum;
          const isActive = step === stepNum;
          return (
            <div key={label} className="flex items-center" style={{ flex: idx < 3 ? 1 : undefined }}>
              <div className="flex flex-col items-center gap-1.5">
                <div className={`step-dot ${isCompleted ? 'step-dot-completed' : isActive ? 'step-dot-active' : 'step-dot-inactive'}`} />
                <span className={`text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${isActive ? 'text-[var(--color-brand-pink-dark)]' : isCompleted ? 'text-emerald-500' : 'text-[var(--color-text-muted)]'}`}>
                  {label}
                </span>
              </div>
              {idx < 3 && (
                <div className={`step-line mx-2 ${isCompleted ? 'step-line-active' : 'step-line-inactive'}`} />
              )}
            </div>
          );
        })}
      </div>
      
      {/* Hero Banner (Only show on step 1) */}
      {step === 1 && (
        <div style={{ position: 'relative', borderRadius: 'var(--radius-2xl)', overflow: 'hidden', marginBottom: '40px', height: '220px' }}>
          <img src="https://images.unsplash.com/photo-1560066984-138dadb4c035?w=1600&q=80&auto=format&fit=crop" alt="Book a beauty service" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.7), rgba(0,0,0,0.3), transparent)' }} />
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: 'white', padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <Sparkles size={16} style={{ color: '#F9A8D4' }} />
              <span style={{ fontSize: '12px', letterSpacing: '3px', textTransform: 'uppercase', color: '#F9A8D4', fontWeight: 700 }}>Book Now</span>
            </div>
            <h1 style={{ fontSize: '36px', fontWeight: 700, textShadow: '0 2px 10px rgba(0,0,0,0.3)', margin: 0 }}>Find Your Perfect Service</h1>
          </div>
        </div>
      )}



      {/* STEP 1: Select Service */}
      {step === 1 && (
        <div className="animate-fade-in relative z-10">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-[var(--color-text-primary)]">Select a Service</h2>
            {isMasterPreselected && selectedMaster && (
              <div className="text-sm font-semibold text-violet-600 bg-violet-100 px-3 py-1.5 rounded-full">
                Booking with {selectedMaster.full_name}
              </div>
            )}
          </div>
          
          {/* Search Bar */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '32px', width: '100%' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', pointerEvents: 'none' }} />
              <input 
                type="text" 
                placeholder="Search services..." 
                value={searchQuery} 
                onChange={(e) => setSearchQuery(e.target.value)} 
                className="input-glass shadow-md shadow-pink-100/30" 
                style={{ paddingLeft: '44px', width: '100%', boxSizing: 'border-box' }} 
              />
            </div>
            <button style={{ width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-lg)', background: 'var(--color-surface-light)', border: 'none', cursor: 'pointer', flexShrink: 0 }} className="shadow-md hover:shadow-lg transition-shadow">
              <SlidersHorizontal size={18} style={{ color: 'var(--color-text-secondary)' }} />
            </button>
          </div>

          <div className="flex gap-2 mb-8 overflow-x-auto pb-1">
            {visibleCategories.map((category) => {
              const isActive = selectedCategory === category;
              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => setSelectedCategory(category)}
                  className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all cursor-pointer ${
                    isActive
                      ? 'bg-gradient-to-r from-pink-500 to-violet-600 text-white shadow-md'
                      : 'bg-white/60 text-[var(--color-text-secondary)] border border-white hover:text-[var(--color-text-primary)]'
                  }`}
                >
                  {category}
                </button>
              );
            })}
          </div>
          
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1,2,3].map(i => <div key={i} className="glass-card h-64 shimmer" />)}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredServices.length === 0 ? (
                <div className="col-span-full glass-card p-12 text-center relative overflow-hidden">
                   <div className="absolute top-0 right-0 w-32 h-32 bg-pink-100/50 rounded-bl-full mix-blend-multiply" />
                   <div className="text-[var(--color-text-muted)] text-lg">No services found matching &quot;{searchQuery}&quot;</div>
                </div>
              ) : filteredServices.map((service, idx) => (
                <div
                  key={service.id}
                  onClick={() => {
                    setSelectedServiceId(service.id);
                    setSelectedPilatesSessionId(null);
                    setSelectedDate('');
                    setSelectedTime('');
                    if (service.category === 'Pilates') {
                      setSelectedMasterId(null);
                      setStep(3);
                    } else {
                      setStep(isMasterPreselected ? 3 : 2);
                    }
                  }}
                  className="glass-card overflow-hidden hover:shadow-xl hover:-translate-y-2 hover:border-pink-500/30 transition-all duration-300 cursor-pointer group"
                >
                  <div className="h-40 relative overflow-hidden">
                    <img
                      src={service.image_url || fallbackImages[idx % fallbackImages.length]}
                      alt={service.name}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    <div className="absolute bottom-3 right-3 w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-opacity">
                      <ArrowRight size={18} className="text-pink-500" />
                    </div>
                  </div>
                  <div className="p-5">
                    <h3 className="font-bold text-[var(--color-text-primary)] group-hover:text-pink-600 transition-colors">{service.name}</h3>
                    <div className="flex items-center justify-between mt-4">
                      <div className="flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] bg-[var(--color-surface-light)] px-2 py-1 rounded-md">
                        <Clock size={14} /> <span>{service.duration_minutes} min</span>
                      </div>
                      <span className="text-lg font-bold text-gradient-pink">£{service.base_price?.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* STEP 2: Select Master */}
      {step === 2 && (
        <div className="animate-fade-in">
          <button onClick={() => setStep(1)} className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] mb-6 transition-colors">
            <ArrowLeft size={16} /> Back to Services
          </button>
          
          <div className="bg-gradient-to-r from-pink-50 to-violet-50 border border-pink-100 rounded-2xl p-4 mb-8 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-400 to-violet-500 flex items-center justify-center shadow-md">
                <Scissors size={20} className="text-white" />
              </div>
              <div>
                <p className="text-xs font-semibold text-pink-600 uppercase tracking-widest">Selected Service</p>
                <p className="text-lg font-bold text-[var(--color-text-primary)]">{selectedService?.name}</p>
              </div>
            </div>
            <div className="text-right hidden sm:block">
              <p className="text-sm font-bold text-violet-700">£{selectedService?.base_price?.toFixed(2)} • {selectedService?.duration_minutes} min</p>
            </div>
          </div>

          <h2 className="text-2xl font-bold text-[var(--color-text-primary)] mb-6">Choose a Professional</h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {masters.map((master) => (
              <div
                key={master.id}
                onClick={() => { setSelectedMasterId(master.id); setStep(3); }}
                className="glass-card p-5 hover:shadow-xl hover:border-violet-500/30 transition-all duration-300 cursor-pointer group flex items-center gap-5"
              >
                <div className="w-16 h-16 rounded-full overflow-hidden bg-[var(--color-surface-light)] border-2 border-white shadow-md flex-shrink-0">
                  {master.avatar_url ? (
                    <img src={master.avatar_url} alt={master.full_name || ''} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xl font-bold text-[var(--color-text-muted)] bg-gradient-to-br from-gray-100 to-gray-200">
                      {master.full_name?.charAt(0) || '?'}
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-[var(--color-text-primary)] group-hover:text-violet-600 transition-colors">{master.full_name}</h3>
                  <p className="text-sm text-[var(--color-text-secondary)]">{master.specialties || 'Beauty Professional'}</p>
                </div>
                <div className="w-8 h-8 rounded-full bg-[var(--color-surface-light)] flex items-center justify-center group-hover:bg-violet-100 group-hover:text-violet-600 transition-colors">
                  <ArrowRight size={16} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* STEP 3: Select Date & Time */}
      {step === 3 && (
        <div className="animate-fade-in">
          <button onClick={() => setStep(selectedService?.category === 'Pilates' || isMasterPreselected ? 1 : 2)} className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] mb-6 transition-colors">
            <ArrowLeft size={16} /> Back to {selectedService?.category === 'Pilates' || isMasterPreselected ? 'Services' : 'Professionals'}
          </button>

          <h2 className="text-2xl font-bold text-[var(--color-text-primary)] mb-6">{selectedService?.category === 'Pilates' ? 'Choose a Pilates Class' : 'Select Date & Time'}</h2>

          {selectedService?.category === 'Pilates' ? (
            <div className="glass-card p-6">
              {loadingPilatesSessions ? (
                <div className="flex items-center justify-center gap-2 py-12 text-[var(--color-text-muted)]">
                  <Loader2 size={18} className="animate-spin" /> Loading classes...
                </div>
              ) : pilatesSessions.length === 0 ? (
                <p className="text-center text-[var(--color-text-muted)] py-12">No Pilates classes are available yet.</p>
              ) : (
                <div className="space-y-6">
                  {Object.entries(groupedPilatesSessions).map(([dateLabel, sessions]) => (
                    <div key={dateLabel}>
                      <p className="text-xs font-bold uppercase tracking-widest text-[var(--color-text-muted)] mb-3">{dateLabel}</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {sessions.map((session) => {
                          const spotsLeft = getSpotsLeft(session);
                          const isFull = spotsLeft <= 0;
                          const isSelected = selectedPilatesSession?.id === session.id;
                          return (
                            <button
                              key={session.id}
                              disabled={isFull}
                              onClick={() => selectPilatesSession(session)}
                              className={`text-left rounded-2xl border p-4 transition-all ${isSelected ? 'border-emerald-500 bg-emerald-50 shadow-md scale-[1.01]' : isFull ? 'border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed' : 'border-violet-100 bg-white hover:-translate-y-1 hover:shadow-md'}`}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-lg font-bold text-[var(--color-text-primary)]">{new Date(session.starts_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                <span className={`rounded-full px-3 py-1 text-xs font-bold ${isFull ? 'bg-gray-200 text-gray-500' : 'bg-emerald-100 text-emerald-700'}`}>{isFull ? 'Full' : `${spotsLeft} spots left`}</span>
                              </div>
                              <p className="mt-2 font-semibold text-violet-700">{session.host?.display_name || 'Pilates host'}</p>
                              <p className="mt-1 text-sm text-[var(--color-text-muted)]">{session.level} · {Math.round((new Date(session.ends_at).getTime() - new Date(session.starts_at).getTime()) / 60000)} min</p>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-[1.08fr_0.92fr] gap-8">
              <div className="glass-card p-6 overflow-hidden relative">
                <div className="absolute -top-16 -right-16 w-40 h-40 bg-pink-300/20 rounded-full blur-3xl" />
                <div className="relative z-10">
                  <div className="flex items-start justify-between gap-4 mb-5">
                    <div>
                      <h3 className="font-bold text-lg flex items-center gap-2">
                        <Calendar size={18} className="text-pink-500" /> Pick a Date
                      </h3>
                      <p className="text-sm text-[var(--color-text-muted)] mt-1">Select a day from the calendar only.</p>
                    </div>
                    <div className="rounded-2xl bg-white/70 border border-white px-4 py-2 text-right shadow-sm">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-pink-500">Selected</p>
                      <p className="text-sm font-bold text-[var(--color-text-primary)]">{selectedDateLabel}</p>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-white/70 bg-white/60 p-3 shadow-inner">
                    <div className="flex items-center justify-between mb-3 px-1">
                      <button
                        type="button"
                        onClick={() => changeCalendarMonth(-1)}
                        disabled={!canViewPreviousMonth}
                        className="w-10 h-10 rounded-full bg-white text-[var(--color-text-secondary)] shadow-sm hover:text-pink-600 hover:shadow-md transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                        aria-label="Previous month"
                      >
                        <ChevronLeft size={18} className="mx-auto" />
                      </button>
                      <div className="text-center">
                        <p className="text-lg font-extrabold text-[var(--color-text-primary)]">
                          {calendarMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                        </p>
                        <p className="text-xs text-[var(--color-text-muted)]">Past dates are blocked</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => changeCalendarMonth(1)}
                        className="w-10 h-10 rounded-full bg-white text-[var(--color-text-secondary)] shadow-sm hover:text-violet-600 hover:shadow-md transition-all"
                        aria-label="Next month"
                      >
                        <ChevronRight size={18} className="mx-auto" />
                      </button>
                    </div>

                    <table className="w-full table-fixed border-separate border-spacing-1">
                      <thead>
                        <tr>
                          {WEEKDAY_LABELS.map((day) => (
                            <th key={day} className="pb-2 text-center text-[11px] font-extrabold uppercase tracking-wider text-[var(--color-text-muted)]">
                              {day}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {calendarWeeks.map((week, weekIndex) => (
                          <tr key={weekIndex}>
                            {week.map((date) => {
                              const dateKey = toDateKey(date);
                              const isCurrentMonth = date.getMonth() === calendarMonth.getMonth();
                              const isToday = dateKey === toDateKey(today);
                              const isSelected = selectedDate === dateKey;
                              const isSelectable = isCurrentMonth && isSelectableDateKey(dateKey);

                              return (
                                <td key={dateKey} className="p-0.5 align-middle">
                                  <button
                                    type="button"
                                    onClick={() => selectDateFromCalendar(dateKey)}
                                    disabled={!isSelectable}
                                    aria-pressed={isSelected}
                                    className={`relative w-full aspect-square rounded-2xl text-sm font-bold transition-all ${
                                      isSelected
                                        ? 'bg-gradient-to-br from-pink-500 to-violet-600 text-white shadow-lg shadow-pink-500/25 scale-105'
                                        : isSelectable
                                          ? 'bg-white text-[var(--color-text-primary)] hover:-translate-y-0.5 hover:bg-pink-50 hover:text-pink-600 hover:shadow-md'
                                          : 'bg-transparent text-gray-300 cursor-not-allowed'
                                    }`}
                                  >
                                    <span>{date.getDate()}</span>
                                    {isToday && (
                                      <span className={`absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full ${isSelected ? 'bg-white' : 'bg-pink-500'}`} />
                                    )}
                                  </button>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="glass-card p-6 overflow-hidden relative">
                <div className="absolute -bottom-16 -left-16 w-44 h-44 bg-violet-300/20 rounded-full blur-3xl" />
                <div className="relative z-10">
                  <div className="flex items-start justify-between gap-4 mb-5">
                    <div>
                      <h3 className="font-bold text-lg flex items-center gap-2"><Clock size={18} className="text-violet-500" /> Available Times</h3>
                      <p className="text-sm text-[var(--color-text-muted)] mt-1">{selectedDate ? selectedDateLabel : 'Pick a date first'}</p>
                    </div>
                    {selectedTime && (
                      <div className="rounded-2xl bg-violet-50 px-4 py-2 text-right shadow-sm">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-violet-500">Time</p>
                        <p className="text-sm font-bold text-violet-700">{selectedTime}</p>
                      </div>
                    )}
                  </div>

                  {!selectedDate ? (
                    <div className="min-h-56 flex items-center justify-center p-8 border-2 border-dashed border-violet-100 bg-white/40 rounded-3xl">
                      <p className="text-[var(--color-text-muted)] text-center">Choose a day from the calendar to reveal available appointment times.</p>
                    </div>
                  ) : timeSlots.length === 0 ? (
                    <div className="min-h-56 flex items-center justify-center p-8 border-2 border-dashed border-amber-200 bg-amber-50/40 rounded-3xl">
                      <p className="text-[var(--color-text-muted)] text-center">This professional is not available on this day. Pick another date.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {timeSlots.map((time) => {
                        const isSelected = selectedTime === time;
                        const isDisabled = isTimeSlotDisabled(time);

                        return (
                          <button
                            key={time}
                            type="button"
                            onClick={() => {
                              if (!isDisabled) setSelectedTime(time);
                            }}
                            disabled={isDisabled}
                            className={`py-3.5 rounded-2xl text-sm font-bold transition-all border ${
                              isSelected
                                ? 'bg-gradient-to-br from-pink-500 to-violet-600 text-white shadow-lg shadow-violet-500/25 scale-105 border-transparent'
                                : isDisabled
                                  ? 'bg-gray-100/60 text-gray-300 border-transparent cursor-not-allowed'
                                  : 'bg-white/80 text-[var(--color-text-primary)] border-white hover:-translate-y-0.5 hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700 hover:shadow-md'
                            }`}
                          >
                            {time}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {dateTimeValidationMessage && (
            <div className="mt-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm font-semibold text-amber-800 shadow-sm">
              <AlertCircle size={18} className="mt-0.5 flex-shrink-0" />
              <span>{dateTimeValidationMessage}</span>
            </div>
          )}

          <div className="mt-8 flex justify-end">
            <button
              onClick={handleContinueToConfirmation}
              disabled={!canContinueToConfirmation}
              className="btn-primary px-8 py-3 text-lg disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              Continue to Confirmation
              <ArrowRight size={18} className="inline ml-2 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: Confirm */}
      {step === 4 && (
        <div className="animate-fade-in w-full max-w-2xl mx-auto">
          <button onClick={() => setStep(3)} className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] mb-6 transition-colors">
            <ArrowLeft size={16} /> Back to Date & Time
          </button>

          <div className="glass-card w-full p-8 rounded-[2rem] shadow-2xl relative overflow-hidden">
            {/* Decorative background blur */}
            <div className="absolute -top-20 -right-20 w-64 h-64 bg-pink-400/20 rounded-full blur-[80px]" />
            <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-violet-400/20 rounded-full blur-[80px]" />
            
            <div className="relative z-10">
              <h2 className="text-3xl font-bold text-center mb-8 text-[var(--color-text-primary)]">Confirm Booking</h2>
              
              <div className="space-y-6 mb-8">
                <div className="flex items-center justify-between p-4 rounded-xl bg-white/50 border border-white/40 shadow-sm">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-pink-100 flex items-center justify-center text-pink-600">
                      <Scissors size={20} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-1">Service</p>
                      <p className="font-bold text-[var(--color-text-primary)]">{selectedService?.name}</p>
                    </div>
                  </div>
                  <p className="font-bold text-lg text-gradient-pink">£{selectedService?.base_price?.toFixed(2)}</p>
                </div>

                <div className="flex items-center justify-between p-4 rounded-xl bg-white/50 border border-white/40 shadow-sm">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-violet-100 flex items-center justify-center text-violet-600 overflow-hidden">
                      {selectedMaster?.avatar_url ? (
                        <img src={selectedMaster.avatar_url} className="w-full h-full object-cover" alt="Master" />
                      ) : <User size={20} />}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-1">{selectedService?.category === 'Pilates' ? 'Host' : 'Professional'}</p>
                      <p className="font-bold text-[var(--color-text-primary)]">{selectedPilatesSession?.host?.display_name || selectedMaster?.full_name}</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 rounded-xl bg-white/50 border border-white/40 shadow-sm">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                      <Calendar size={20} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-1">Date & Time</p>
                      <p className="font-bold text-[var(--color-text-primary)]">{selectedDateLabel} at {selectedTime}</p>
                    </div>
                  </div>
                  <p className="font-medium text-[var(--color-text-secondary)]">{selectedService?.duration_minutes} min</p>
                </div>

                {selectedService?.category === 'Pilates' && pilatesSettings && (
                  <div className="p-4 rounded-xl bg-emerald-50/80 border border-emerald-100 shadow-sm">
                    <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider mb-3">Pilates Session</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-[var(--color-text-secondary)]">
                      <span>Level: <strong className="text-[var(--color-text-primary)]">{pilatesSettings.default_level || 'All levels'}</strong></span>
                      <span>Spaces left: <strong className="text-[var(--color-text-primary)]">{selectedPilatesSession ? getSpotsLeft(selectedPilatesSession) : pilatesSettings.default_capacity || 6}</strong></span>
                      <span>{pilatesSettings.equipment_provided ? 'Equipment provided' : 'Bring your own equipment'}</span>
                      {pilatesSettings.require_health_declaration && <span>Health declaration required</span>}
                    </div>
                  </div>
                )}
              </div>

              <Elements stripe={stripePromise}>
                <CheckoutForm 
                  user={user}
                  profile={profile}
                  selectedService={selectedService}
                  selectedMaster={selectedMaster}
                  selectedPilatesSession={selectedPilatesSession}
                  selectedDate={selectedDate}
                  selectedTime={selectedTime}
                  onBookSuccess={() => setStep(5)}
                  submitting={submitting}
                  setSubmitting={setSubmitting}
                />
              </Elements>
            </div>
          </div>
        </div>
      )}

      {/* STEP 5: Success */}
      {step === 5 && (
        <div className="animate-fade-in max-w-lg mx-auto text-center pt-10">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center mx-auto mb-6 shadow-xl shadow-emerald-500/30 animate-bounce-gentle">
            <CheckCircle2 size={48} className="text-white" />
          </div>
          <h2 className="text-3xl font-bold text-[var(--color-text-primary)] mb-4">Booking Confirmed!</h2>
          <p className="text-[var(--color-text-secondary)] mb-8 text-lg">
            Your appointment with <span className="font-bold text-[var(--color-text-primary)]">{selectedMaster?.full_name}</span> has been confirmed for <span className="font-bold text-[var(--color-text-primary)]">{selectedDateLabel}</span> at <span className="font-bold text-[var(--color-text-primary)]">{selectedTime}</span>.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button onClick={() => router.push('/dashboard/appointments')} className="btn-primary px-8 py-3">
              View My Appointments
            </button>
            <button onClick={() => setStep(1)} className="px-8 py-3 rounded-xl font-bold bg-[var(--color-surface-light)] hover:bg-[var(--color-border)] text-[var(--color-text-primary)] transition-colors">
              Book Another
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
