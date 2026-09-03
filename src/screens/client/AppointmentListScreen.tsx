import React, { useState, useEffect, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    Modal,
} from 'react-native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, CommonActions } from '@react-navigation/native';
import { format, addDays, isSameDay, differenceInHours, startOfDay, isBefore, setHours, setMinutes } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { safeSupabaseFetch } from '../../lib/supabaseApi';
import { useAuth } from '../../contexts/AuthContext';
import { Card, Button, ScreenBackground } from '../../components/ui';
import { useModal } from '../../contexts/ModalContext';
import { colors, spacing } from '../../theme';
import { eurosToCents, centsToEuros, cancelAndRefund, CancelAndRefundResult } from '../../services/stripeService';

// Cancellation policy constants
const CANCELLATION_WINDOW_HOURS = 24;

type Appointment = {
    id: string;
    start_time: string;
    end_time: string;
    status: string;
    price: number;
    notes: string | null;
    service_id: string | null;
    master_id: string;
    stripe_payment_intent_id: string | null;
    deposit_amount: number | null;
    deposit_paid: boolean | null;
    proposed_start_time: string | null;
    proposed_end_time: string | null;
    reschedule_initiated_by: string | null;
    service_name: string | null;
    service_category: string | null;
    service: { name: string; duration_minutes: number; category?: string } | null;
    master: { full_name: string } | null;
};

type Consultation = {
    id: string;
    client_id: string;
    service_id: string;
    master_id: string | null;
    status: string;
    created_at: string | null;
    responded_at: string | null;
    additional_notes: string | null;
    service: { name: string } | null;
    master: { full_name: string } | null;
};

export function AppointmentListScreen() {
    const navigation = useNavigation<any>();
    const { user, checkSession } = useAuth();
    const { showAlert, showConfirm } = useModal();

    // State
    const [subTab, setSubTab] = useState<'upcoming' | 'past' | 'consultations'>('upcoming');
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [consultations, setConsultations] = useState<Consultation[]>([]);

    // UI State
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Reschedule/Cancel State
    const [appointmentToCancel, setAppointmentToCancel] = useState<Appointment | null>(null);
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [isLateCancellation, setIsLateCancellation] = useState(false);
    const [cancellationLoading, setCancellationLoading] = useState(false);
    const [cancellationResult, setCancellationResult] = useState<CancelAndRefundResult | null>(null);
    const [showRefundReceiptModal, setShowRefundReceiptModal] = useState(false);
    const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
    const [showRescheduleModal, setShowRescheduleModal] = useState(false);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [selectedTime, setSelectedTime] = useState<string | null>(null);
    const [rescheduleLoading, setRescheduleLoading] = useState(false);

    // Reschedule availability data (mirrors booking flow)
    const [rescheduleMasterAvailability, setRescheduleMasterAvailability] = useState<any[]>([]);
    const [rescheduleBlockedSlots, setRescheduleBlockedSlots] = useState<any[]>([]);
    const [rescheduleBookedSlots, setRescheduleBookedSlots] = useState<string[]>([]);
    const [reschedulePilatesSessions, setReschedulePilatesSessions] = useState<any[]>([]);
    const [selectedPilatesSession, setSelectedPilatesSession] = useState<any>(null);
    const [rescheduleDataLoading, setRescheduleDataLoading] = useState(false);
    const [isFetchingSlots, setIsFetchingSlots] = useState(false);

    // Helper: Check if appointment is within cancellation window (late change)
    const isWithinCancellationWindow = (startTime: string): boolean => {
        const appointmentDate = new Date(startTime);
        const hoursUntil = differenceInHours(appointmentDate, new Date());
        return hoursUntil < CANCELLATION_WINDOW_HOURS;
    };

    useEffect(() => {
        fetchAppointments();
    }, []);

    const fetchAppointments = async () => {
        if (!user) return;

        try {
            const isSessionValid = await checkSession();
            if (!isSessionValid) {
                setLoading(false);
                setRefreshing(false);
                return;
            }

            const queryPromise = supabase
                .from('appointments')
                .select(`
                    id,
                    start_time,
                    end_time,
                    status,
                    price,
                    notes,
                    service_id,
                    master_id,
                    stripe_payment_intent_id,
                    deposit_amount,
                    deposit_paid,
                    proposed_start_time,
                    proposed_end_time,
                    reschedule_initiated_by,
                    service_name,
                    service_category,
                    service:services(name, duration_minutes, category),
                    master:profiles!appointments_master_id_fkey(full_name)
                `)
                .eq('client_id', user!.id)
                .order('start_time', { ascending: false });

            const { data, error } = await safeSupabaseFetch(queryPromise as any, { timeout: 8000 });
            if (error) throw error;

            // Filter out orphaned appointments (where master was deleted)
            const validAppointments = ((data as unknown as Appointment[]) || []).filter(
                apt => apt.master !== null
            );
            setAppointments(validAppointments);

            // Also fetch pending/active booking consultations
            try {
                const { data: consultData } = await supabase
                    .from('booking_consultations')
                    .select(`
                        id,
                        client_id,
                        service_id,
                        master_id,
                        status,
                        created_at,
                        responded_at,
                        additional_notes,
                        service:services(name),
                        master:profiles!booking_consultations_master_id_fkey(full_name)
                    `)
                    .eq('client_id', user!.id)
                    .in('status', ['pending', 'approved', 'declined', 'chat_requested'])
                    .order('created_at', { ascending: false });

                setConsultations((consultData as unknown as Consultation[]) || []);
            } catch (consultError) {
                console.error('Error fetching consultations:', consultError);
            }
        } catch (error) {
            console.error('Error fetching appointments:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchAppointments();
    };

    // --- Appointment Handlers ---

    const handleCancel = (appointment: Appointment) => {
        const late = isWithinCancellationWindow(appointment.start_time);
        setAppointmentToCancel(appointment);
        setIsLateCancellation(late);
        setShowCancelModal(true);
    };

    // Send notification to Master about cancellation
    const notifyMasterOfCancellation = async (apt: Appointment) => {
        if (!apt.master_id) return;

        try {
            await supabase.functions.invoke('send-push-notification', { body: {
                    userId: apt.master_id,
                    title: 'Appointment Canceled',
                    body: `${user?.user_metadata?.full_name || 'Client'} canceled their appointment. The slot is open again.`,
                    data: { appointmentId: apt.id },
                } });
        } catch (e) {
            console.error('Failed to send cancellation notification:', e);
        }
    };

    const confirmCancel = async () => {
        if (!appointmentToCancel) return;
        setCancellationLoading(true);

        try {
            const isPilatesBooking =
                appointmentToCancel.service_category === 'Pilates' ||
                appointmentToCancel.service?.category === 'Pilates';

            // Money first — cancel-and-refund refuses an appointment that is
            // already marked cancelled, and it is a no-op when no Stripe
            // payment is attached (credit-funded classes).
            const result = await cancelAndRefund(
                appointmentToCancel.id,
                'client',
            );

            // ── Then Pilates housekeeping. `cancel_pilates_booking` is what
            // releases the seat (pilates_session_bookings → 'cancelled') and
            // returns the class credit when the cancellation is outside the
            // policy window. This screen used to skip it entirely, so a
            // cancelled class stayed full for everyone else and any class
            // credit spent on it was simply lost.
            if (isPilatesBooking) {
                const { data: pilatesResult, error: pilatesError } = await (supabase as any).rpc(
                    'cancel_pilates_booking',
                    { p_appointment_id: appointmentToCancel.id },
                );
                if (pilatesError) {
                    console.error('Failed to release the Pilates seat:', pilatesError);
                } else if ((pilatesResult as any)?.refunded) {
                    (result as CancelAndRefundResult & { credit_note?: string }).credit_note =
                        '1 class credit was returned to your pass.';
                }
            }

            // Notify master
            await notifyMasterOfCancellation(appointmentToCancel);

            // Close the cancel modal and show the refund receipt
            setShowCancelModal(false);
            setCancellationResult(result);
            setShowRefundReceiptModal(true);

            fetchAppointments();
        } catch (error: any) {
            setShowCancelModal(false);
            showAlert('Error', error.message || 'Failed to cancel appointment', 'error');
        } finally {
            setCancellationLoading(false);
        }
    };

    const closeCancelModal = () => {
        setShowCancelModal(false);
        setAppointmentToCancel(null);
    };

    const closeRefundReceipt = () => {
        setShowRefundReceiptModal(false);
        setCancellationResult(null);
        setAppointmentToCancel(null);
    };

    const handleReschedule = async (appointment: Appointment) => {
        setSelectedAppointment(appointment);
        setSelectedDate(null);
        setSelectedTime(null);
        setSelectedPilatesSession(null);
        setRescheduleBookedSlots([]);
        setShowRescheduleModal(true);
        setRescheduleDataLoading(true);

        try {
            // Fetch master availability and blocked slots (mirrors SelectDateTimeScreen)
            const [availRes, blockedRes] = await Promise.all([
                safeSupabaseFetch(
                    supabase.from('master_availability').select('*').eq('master_id', appointment.master_id).order('day_of_week') as any,
                    { timeout: 5000 }
                ),
                safeSupabaseFetch(
                    supabase.from('blocked_slots').select('*').eq('master_id', appointment.master_id) as any,
                    { timeout: 5000 }
                ),
            ]);

            setRescheduleMasterAvailability((availRes.data as any[]) || []);
            setRescheduleBlockedSlots((blockedRes.data as any[]) || []);

            // For Pilates services, fetch upcoming sessions
            if (appointment.service?.category === 'Pilates' && appointment.service_id) {
                try {
                    const startDate = new Date().toISOString().slice(0, 10);
                    const endDate = new Date(Date.now() + 35 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
                    await supabase.rpc('ensure_pilates_sessions', {
                        p_service_id: appointment.service_id,
                        p_start_date: startDate,
                        p_end_date: endDate,
                    });
                    const { data: sessionsData } = await supabase
                        .from('pilates_class_sessions')
                        .select('*, host:pilates_hosts(*), pilates_session_bookings(id, status)')
                        .eq('service_id', appointment.service_id)
                        .gte('starts_at', new Date().toISOString())
                        .lt('starts_at', new Date(Date.now() + 35 * 24 * 60 * 60 * 1000).toISOString())
                        .eq('status', 'scheduled')
                        .order('starts_at');

                    setReschedulePilatesSessions(
                        ((sessionsData as any[]) || []).filter((session: any) => {
                            const hostId = session.host?.profile_id || session.owner_id;
                            return hostId !== user?.id;
                        })
                    );
                } catch (e) {
                    console.error('Error fetching Pilates sessions for reschedule:', e);
                }
            } else {
                setReschedulePilatesSessions([]);
            }
        } catch (error) {
            console.error('Error fetching reschedule data:', error);
        } finally {
            setRescheduleDataLoading(false);
        }
    };

    // Fetch booked slots when reschedule date changes (mirrors SelectDateTimeScreen)
    const fetchRescheduleBookedSlots = async (date: Date, masterId: string) => {
        try {
            setIsFetchingSlots(true);
            const dateStr = format(date, 'yyyy-MM-dd');
            const { data } = await safeSupabaseFetch(
                supabase
                    .from('appointments')
                    .select('start_time')
                    .eq('master_id', masterId)
                    .gte('start_time', `${dateStr}T00:00:00`)
                    .lt('start_time', `${dateStr}T23:59:59`)
                    .in('status', ['pending', 'confirmed']) as any,
                { timeout: 5000 }
            );
            const booked = ((data as any[]) || []).map((apt: any) => {
                const d = new Date(apt.start_time);
                return `${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`;
            });
            setRescheduleBookedSlots(booked);

            // Clear selected time if it's now booked
            if (selectedTime) {
                const [h, m] = selectedTime.split(':').map(Number);
                const timeKey = `${h}:${m.toString().padStart(2, '0')}`;
                if (booked.includes(timeKey)) {
                    setSelectedTime(null);
                }
            }
        } catch (error) {
            console.error('Error fetching booked slots:', error);
        } finally {
            setIsFetchingSlots(false);
        }
    };

    // Handle date selection in reschedule modal
    const handleRescheduleDateSelect = (date: Date) => {
        setSelectedDate(date);
        setSelectedTime(null);
        if (selectedAppointment) {
            fetchRescheduleBookedSlots(date, selectedAppointment.master_id);
        }
    };

    // Check if a day is available for the master (mirrors SelectDateTimeScreen)
    const isRescheduleDayAvailable = (date: Date): boolean => {
        const dayOfWeek = date.getDay();
        return rescheduleMasterAvailability.some(
            (a: any) => a.day_of_week === dayOfWeek && a.is_available
        );
    };

    // Generate time slots for a given day based on master availability (mirrors SelectDateTimeScreen)
    const generateRescheduleTimeSlots = (): Date[] => {
        if (!selectedDate) return [];
        const dayOfWeek = selectedDate.getDay();
        const dayAvailability = rescheduleMasterAvailability.find(
            (a: any) => a.day_of_week === dayOfWeek && a.is_available
        );
        if (!dayAvailability) return [];

        const slots: Date[] = [];
        const [startHour, startMin] = dayAvailability.start_time.split(':').map(Number);
        const [endHour, endMin] = dayAvailability.end_time.split(':').map(Number);

        let currentHour = startHour;
        let currentMin = startMin || 0;
        while (currentHour < endHour || (currentHour === endHour && currentMin < endMin)) {
            slots.push(setMinutes(setHours(new Date(), currentHour), currentMin));
            currentMin += 30;
            if (currentMin >= 60) { currentMin = 0; currentHour++; }
        }
        return slots;
    };

    const parsedRescheduleBlockedSlots = useMemo(() => {
        return rescheduleBlockedSlots.map(blocked => ({
            startMs: new Date(blocked.start_time).getTime(),
            endMs: new Date(blocked.end_time).getTime()
        }));
    }, [rescheduleBlockedSlots]);

    // Check if a reschedule time slot is available (mirrors SelectDateTimeScreen)
    const isRescheduleSlotAvailable = (slot: Date): boolean => {
        if (!selectedDate) return false;
        const timeKey = `${slot.getHours()}:${slot.getMinutes().toString().padStart(2, '0')}`;

        // Already booked
        if (rescheduleBookedSlots.includes(timeKey)) return false;

        // In the past
        const slotDateTime = new Date(selectedDate);
        slotDateTime.setHours(slot.getHours(), slot.getMinutes());
        if (isBefore(slotDateTime, new Date())) return false;

        const slotTimeMs = slotDateTime.getTime();

        // Blocked
        for (const blocked of parsedRescheduleBlockedSlots) {
            if (slotTimeMs >= blocked.startMs && slotTimeMs < blocked.endMs) return false;
        }
        return true;
    };

    // Pilates helpers for reschedule
    const getPilatesBookedCount = (session: any) =>
        session.pilates_session_bookings?.filter((b: any) => b.status === 'booked').length || 0;
    const getPilatesSpotsLeft = (session: any) =>
        Math.max(0, session.capacity - getPilatesBookedCount(session));
    const groupedReschedulePilates = reschedulePilatesSessions.reduce<Record<string, any[]>>((acc, session) => {
        const date = new Date(session.starts_at);
        const key = date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
        acc[key] = [...(acc[key] || []), session];
        return acc;
    }, {});

    const rescheduleTimeSlots = generateRescheduleTimeSlots();
    const rescheduleAvailableDates = Array.from({ length: 14 }, (_, i) => addDays(startOfDay(new Date()), i));

    // Notify master of reschedule
    const notifyMasterOfReschedule = async (apt: Appointment, newTime: Date) => {
        if (!apt.master_id) return;

        const oldTime = new Date(apt.start_time);
        const formatStr = 'EEEE, MMM d HH:mm';
        const message = `${user?.user_metadata?.full_name || 'Client'} rescheduled their appointment from ${format(oldTime, formatStr)} to ${format(newTime, formatStr)}.`;

        try {
            await supabase.functions.invoke('send-push-notification', { body: {
                    userId: apt.master_id,
                    title: 'Appointment Rescheduled',
                    body: message,
                    data: { type: 'appointment_reminder', appointmentId: apt.id },
                } });
        } catch (e) {
            console.error('Failed to send reschedule notification:', e);
        }
    };

    const confirmReschedule = async () => {
        const isPilates = selectedAppointment?.service?.category === 'Pilates';

        if (isPilates) {
            if (!selectedAppointment || !selectedPilatesSession) {
                showAlert('Error', 'Please select a class session', 'error');
                return;
            }
        } else {
            if (!selectedAppointment || !selectedDate || !selectedTime) {
                showAlert('Error', 'Please select a new date and time', 'error');
                return;
            }
        }

        setRescheduleLoading(true);
        try {
            let newStartTime: Date;
            let newEndTime: Date;

            if (isPilates && selectedPilatesSession) {
                newStartTime = new Date(selectedPilatesSession.starts_at);
                newEndTime = new Date(selectedPilatesSession.ends_at);
            } else {
                const [hours, minutes] = selectedTime!.split(':').map(Number);
                newStartTime = new Date(selectedDate!);
                newStartTime.setHours(hours, minutes, 0, 0);
                const duration = selectedAppointment!.service?.duration_minutes || 60;
                newEndTime = new Date(newStartTime.getTime() + duration * 60000);
            }

            // Early reschedule: Instant update, no approval needed
            const { error } = await supabase
                .from('appointments')
                .update({
                    start_time: newStartTime.toISOString(),
                    end_time: newEndTime.toISOString(),
                    status: 'confirmed',
                    // Clear out any old reschedule data
                    proposed_start_time: null,
                    proposed_end_time: null,
                    reschedule_initiated_by: null,
                } as any)
                .eq('id', selectedAppointment!.id);

            if (error) throw error;

            if (isPilates && selectedPilatesSession) {
                const { error: bookingError } = await supabase
                    .from('pilates_session_bookings')
                    .update({ session_id: selectedPilatesSession.id })
                    .eq('appointment_id', selectedAppointment!.id);
                if (bookingError) throw bookingError;
            }

            await notifyMasterOfReschedule(selectedAppointment!, newStartTime);
            showAlert('Success', 'Your appointment has been rescheduled.', 'success');

            setShowRescheduleModal(false);
            fetchAppointments();
        } catch (error: any) {
            showAlert('Error', error.message, 'error');
        } finally {
            setRescheduleLoading(false);
        }
    };

    // Handle client approving master's reschedule proposal
    const handleApproveMasterReschedule = async (apt: Appointment) => {
        if (!apt.proposed_start_time || !apt.proposed_end_time) return;

        const isPilates = apt.service_category === 'Pilates' || apt.service?.category === 'Pilates';

        showConfirm(
            'Approve Reschedule',
            `Accept new time: ${format(new Date(apt.proposed_start_time), 'EEEE, MMM d at HH:mm')}?`,
            async () => {
                try {
                    let newSessionId = null;
                    if (isPilates) {
                        const { data: sessionData, error: sessionError } = await supabase
                            .from('pilates_class_sessions')
                            .select('id')
                            .eq('starts_at', apt.proposed_start_time)
                            .eq('ends_at', apt.proposed_end_time)
                            .eq('service_id', apt.service_id)
                            .eq('status', 'scheduled')
                            .maybeSingle();

                        if (sessionError || !sessionData) {
                            showAlert('Error', 'No matching scheduled Pilates session found for the proposed time.', 'error');
                            return;
                        }
                        newSessionId = sessionData.id;
                    }

                    const { error } = await supabase
                        .from('appointments')
                        .update({
                            start_time: apt.proposed_start_time,
                            end_time: apt.proposed_end_time,
                            proposed_start_time: null,
                            proposed_end_time: null,
                            reschedule_initiated_by: null,
                            status: 'confirmed',
                        } as any)
                        .eq('id', apt.id);

                    if (error) throw error;

                    if (isPilates && newSessionId) {
                        const { error: bookingError } = await supabase
                            .from('pilates_session_bookings')
                            .update({ session_id: newSessionId })
                            .eq('appointment_id', apt.id);
                        if (bookingError) throw bookingError;
                    }

                    // Notify master
                    if (apt.master_id) {
                        await supabase.functions.invoke('send-push-notification', { body: {
                                userId: apt.master_id,
                                title: 'Reschedule Approved',
                                body: `${user?.user_metadata?.full_name || 'Client'} approved your reschedule request.`,
                                data: { type: 'appointment_reminder', appointmentId: apt.id },
                            } });
                    }

                    showAlert('Success', 'Appointment rescheduled successfully.', 'success');
                    fetchAppointments();
                } catch (error: any) {
                    showAlert('Error', error.message, 'error');
                }
            },
            {
                confirmText: 'Approve',
                cancelText: 'Cancel'
            }
        );
    };

    // Handle client counter-proposing a different time
    const handleCounterPropose = (apt: Appointment) => {
        handleReschedule(apt);
    };

    const handleChat = async (appointment: Appointment) => {
        if (!user || !appointment.master_id) return;
        try {
            const { data: existing } = await (supabase as any)
                .from('conversations')
                .select('id')
                .eq('client_id', user.id)
                .eq('master_id', appointment.master_id)
                .single();

            let conversationId = existing?.id;

            if (!conversationId) {
                const { data: newConv, error } = await (supabase as any)
                    .from('conversations')
                    .insert({ client_id: user.id, master_id: appointment.master_id })
                    .select()
                    .single();
                if (error) throw error;
                conversationId = newConv.id;
            }

            navigation.dispatch(
                CommonActions.navigate({
                    name: 'Chat',
                    params: {
                        conversationId,
                        otherUser: { full_name: appointment.master?.full_name },
                    },
                })
            );
        } catch (error: any) {
            showAlert('Error', error.message, 'error');
        }
    };

    // --- Data Preparation ---

    const now = new Date();
    const upcomingAppointments = appointments
        .filter(apt => new Date(apt.start_time) >= now && !apt.status.startsWith('cancelled'))
        .sort((a, b) => {
            // Priority sort: actionable items first (reschedule proposals need attention)
            const getPriority = (apt: Appointment) => {
                if ((apt.status === 'pending_reschedule' || apt.status === 'reschedule_pending') && apt.reschedule_initiated_by !== user?.id) return 0;
                // Legacy pending/awaiting_confirmation — same priority as confirmed
                return 1;
            };
            const pA = getPriority(a);
            const pB = getPriority(b);
            if (pA !== pB) return pA - pB;
            return new Date(a.start_time).getTime() - new Date(b.start_time).getTime();
        });
    const pastAppointments = appointments.filter(
        apt => new Date(apt.start_time) < now || apt.status.startsWith('cancelled')
    );

    // Helpers
    const statusColors: Record<string, { bg: string; text: string }> = {
        pending: { bg: '#FEF3C7', text: '#92400E' },
        confirmed: { bg: '#DBEAFE', text: '#1E40AF' },
        completed: { bg: '#D1FAE5', text: '#065F46' },
        cancelled: { bg: '#FEE2E2', text: '#991B1B' },
        cancelled_free: { bg: '#FEE2E2', text: '#991B1B' },
        cancelled_charge: { bg: '#FEE2E2', text: '#991B1B' },
        reschedule_pending: { bg: '#EDE9FE', text: '#7C3AED' },
        no_show: { bg: '#FFE4E6', text: '#E11D48' },
    };

    // Format status for display
    const formatStatus = (status: string): string => {
        const statusLabels: Record<string, string> = {
            pending: 'Pending',
            confirmed: 'Confirmed',
            completed: 'Completed',
            cancelled: 'Cancelled',
            cancelled_free: 'Cancelled',
            cancelled_charge: 'Cancelled (Fee)',
            reschedule_pending: 'Reschedule Pending',
            no_show: 'No-Show',
        };
        return statusLabels[status] || status.charAt(0).toUpperCase() + status.slice(1);
    };

    // Consultation status config
    const consultationStatusConfig: Record<string, { bg: string; text: string; label: string; icon: string }> = {
        pending: { bg: 'rgba(210, 153, 34, 0.15)', text: '#D29922', label: 'Consultation Pending', icon: 'hourglass-top' },
        approved: { bg: 'rgba(63, 185, 80, 0.15)', text: '#3FB950', label: 'Approved – Book Now', icon: 'check-circle' },
        declined: { bg: 'rgba(248, 81, 73, 0.15)', text: '#F85149', label: 'Declined', icon: 'cancel' },
        chat_requested: { bg: 'rgba(88, 166, 255, 0.15)', text: '#58A6FF', label: 'Chat Requested', icon: 'chat-bubble' },
    };

    const handleContinueBooking = (consultation: Consultation) => {
        if (consultation.service_id && consultation.master_id) {
            navigation.navigate('BookNew', {
                screen: 'ServiceDetail',
                params: { serviceId: consultation.service_id },
            });
        }
    };

    const handleViewConsultation = (consultation: Consultation) => {
        navigation.navigate('BookNew', {
            screen: 'ConsultationWaiting',
            params: {
                consultationId: consultation.id,
                serviceId: consultation.service_id,
                masterId: consultation.master_id,
            },
        });
    };


    if (loading && !refreshing) {
        return (
            <ScreenBackground>
                <SafeAreaView style={styles.container}>
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={colors.text} />
                    </View>
                </SafeAreaView>
            </ScreenBackground>
        );
    }

    return (
        <ScreenBackground>
            <SafeAreaView style={styles.container} edges={[]}>

                {/* Premium Pill Tabs — 3-tab layout */}
                <View style={styles.tabContainer}>
                    <View style={styles.tabBar}>
                        {(['upcoming', 'past', 'consultations'] as const).map((tab) => {
                            const labels = {
                                upcoming: `Upcoming (${upcomingAppointments.length})`,
                                past: `Past (${pastAppointments.length})`,
                                consultations: `Consults (${consultations.length})`,
                            };
                            return (
                                <TouchableOpacity
                                    key={tab}
                                    style={[styles.tabItem]}
                                    onPress={() => setSubTab(tab)}
                                >
                                    {subTab === tab && (
                                        <LinearGradient
                                            colors={['#E8A0B4', '#D4789C']}
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 1 }}
                                            style={[StyleSheet.absoluteFillObject, { borderRadius: 10 }]}
                                        />
                                    )}
                                    <Text style={[styles.tabText, subTab === tab && styles.tabTextActive]}>
                                        {labels[tab]}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>

                <ScrollView
                    contentContainerStyle={styles.content}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} />
                    }
                    showsVerticalScrollIndicator={false}
                >
                    {/* --- CONSULTATIONS TAB --- */}
                    {subTab === 'consultations' && (
                        <>
                            {consultations.length > 0 ? (
                                consultations.map((consult) => {
                                    const config = consultationStatusConfig[consult.status] || consultationStatusConfig.pending;
                                    return (
                                        <Card key={`consult-${consult.id}`} style={styles.card} variant="glass">
                                            <View style={styles.cardHeader}>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                                                    <View style={{
                                                        width: 36, height: 36, borderRadius: 18,
                                                        backgroundColor: config.bg,
                                                        justifyContent: 'center', alignItems: 'center',
                                                    }}>
                                                        <MaterialIcons name={config.icon as any} size={18} color={config.text} />
                                                    </View>
                                                    <View style={{ flex: 1 }}>
                                                        <Text style={styles.cardTitle}>
                                                            {consult.service?.name || 'Service'}
                                                        </Text>
                                                        <Text style={styles.cardSubtitle}>
                                                            {consult.master?.full_name ? `with ${consult.master.full_name}` : 'Awaiting specialist'}
                                                        </Text>
                                                    </View>
                                                </View>
                                                <View style={[styles.statusBadge, { backgroundColor: config.bg }]}>
                                                    <Text style={[styles.statusText, { color: config.text }]}>
                                                        {config.label}
                                                    </Text>
                                                </View>
                                            </View>

                                            <View style={styles.cardDetails}>
                                                <View style={styles.detailRow}>
                                                    <MaterialIcons name="assignment" size={16} color={colors.textSecondary} style={styles.detailIcon} />
                                                    <Text style={styles.detailText}>Consultation Request</Text>
                                                </View>
                                                {consult.created_at && (
                                                    <View style={styles.detailRow}>
                                                        <MaterialIcons name="event" size={16} color={colors.textSecondary} style={styles.detailIcon} />
                                                        <Text style={styles.detailText}>
                                                            Submitted {format(new Date(consult.created_at), 'MMM d, yyyy')}
                                                        </Text>
                                                    </View>
                                                )}
                                            </View>

                                            <View style={styles.cardFooter}>
                                                <TouchableOpacity
                                                    style={[styles.rescheduleButton, { paddingHorizontal: 14 }]}
                                                    onPress={() => handleViewConsultation(consult)}
                                                >
                                                    <Text style={styles.rescheduleButtonText}>View Details</Text>
                                                </TouchableOpacity>
                                                {consult.status === 'approved' && (
                                                    <TouchableOpacity
                                                        style={[styles.rescheduleButton, {
                                                            backgroundColor: 'rgba(63, 185, 80, 0.15)',
                                                            borderColor: 'rgba(63, 185, 80, 0.3)',
                                                            paddingHorizontal: 14,
                                                        }]}
                                                        onPress={() => handleContinueBooking(consult)}
                                                    >
                                                        <Text style={[styles.rescheduleButtonText, { color: '#3FB950' }]}>Book Now</Text>
                                                    </TouchableOpacity>
                                                )}
                                            </View>
                                        </Card>
                                    );
                                })
                            ) : (
                                <View style={styles.emptyState}>
                                    <View style={styles.emptyIconContainer}>
                                        <MaterialIcons name="assignment" size={36} color={colors.textMuted} />
                                    </View>
                                    <Text style={styles.emptyTitle}>No Consultations</Text>
                                    <Text style={styles.emptyText}>
                                        Your consultation requests will appear here.
                                    </Text>
                                </View>
                            )}
                        </>
                    )}

                    {/* --- APPOINTMENTS LIST (Upcoming / Past tabs) --- */}
                    {subTab !== 'consultations' && ((subTab === 'upcoming' ? upcomingAppointments : pastAppointments).length > 0 ? (
                        (subTab === 'upcoming' ? upcomingAppointments : pastAppointments).map((apt) => {
                            const date = new Date(apt.start_time);
                            const statusStyle = statusColors[apt.status] || statusColors.pending;
                            const canModify = subTab === 'upcoming' && !apt.status.startsWith('cancelled');

                            return (
                                <Card key={apt.id} style={styles.card} variant="glass">
                                    <View style={styles.cardHeader}>
                                        <View>
                                            <Text style={styles.cardTitle}>
                                                {apt.service?.name || apt.service_name || 'Service'}
                                            </Text>
                                            <Text style={styles.cardSubtitle}>
                                                with {apt.master?.full_name || 'Specialist'}
                                            </Text>
                                        </View>
                                        <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
                                            <Text style={[styles.statusText, { color: statusStyle.text }]}>
                                                {formatStatus(apt.status)}
                                            </Text>
                                        </View>
                                    </View>

                                    <View style={styles.cardDetails}>
                                        <View style={styles.detailRow}>
                                            <MaterialIcons name="event" size={16} color={colors.textSecondary} style={styles.detailIcon} />
                                            <Text style={styles.detailText}>
                                                {format(date, 'EEEE, MMMM d, yyyy')}
                                            </Text>
                                        </View>
                                        <View style={styles.detailRow}>
                                            <MaterialIcons name="schedule" size={16} color={colors.textSecondary} style={styles.detailIcon} />
                                            <Text style={styles.detailText}>
                                                {format(date, 'HH:mm')} • {apt.service?.duration_minutes || 60} min
                                            </Text>
                                        </View>
                                    </View>

                                    {/* Master-initiated reschedule proposal */}
                                    {(apt.status === 'pending_reschedule' || apt.status === 'reschedule_pending') &&
                                        apt.proposed_start_time &&
                                        apt.reschedule_initiated_by !== user?.id && (
                                            <View style={styles.rescheduleProposalBox}>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                                                    <MaterialIcons name="auto-awesome" size={16} color={colors.primary} />
                                                    <Text style={[styles.rescheduleProposalTitle, { marginBottom: 0 }]}>
                                                        New time proposed by {apt.master?.full_name || 'specialist'}
                                                    </Text>
                                                </View>
                                                <Text style={styles.rescheduleProposalTime}>
                                                    {format(new Date(apt.proposed_start_time), 'EEEE, MMM d at HH:mm')}
                                                </Text>
                                                <View style={styles.rescheduleProposalActions}>
                                                    <TouchableOpacity
                                                        style={styles.approveRescheduleButton}
                                                        onPress={() => handleApproveMasterReschedule(apt)}
                                                    >
                                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                                            <MaterialIcons name="check" size={16} color="#FFF" />
                                                            <Text style={styles.approveRescheduleText}>Approve</Text>
                                                        </View>
                                                    </TouchableOpacity>
                                                    <TouchableOpacity
                                                        style={styles.counterProposeButton}
                                                        onPress={() => handleCounterPropose(apt)}
                                                    >
                                                        <Text style={styles.counterProposeText}>Suggest Different</Text>
                                                    </TouchableOpacity>
                                                </View>
                                            </View>
                                        )
                                    }

                                    <View style={styles.cardFooter}>
                                        <View>
                                            <Text style={styles.price}>€{apt.price}</Text>
                                            {apt.deposit_paid && (
                                                <Text style={styles.depositPaidText}>
                                                    Paid: €{apt.deposit_amount}
                                                </Text>
                                            )}
                                        </View>
                                        {canModify && (
                                            <View style={styles.actionButtons}>
                                                <TouchableOpacity
                                                    style={styles.chatButton}
                                                    onPress={() => handleChat(apt)}
                                                >
                                                    <MaterialIcons name="chat-bubble-outline" size={16} color={colors.text} />
                                                </TouchableOpacity>
                                                {new Date(apt.start_time) > new Date() && (
                                                    <>
                                                        <TouchableOpacity
                                                            style={styles.rescheduleButton}
                                                            onPress={() => handleReschedule(apt)}
                                                        >
                                                            <Text style={styles.rescheduleButtonText}>Reschedule</Text>
                                                        </TouchableOpacity>
                                                        <TouchableOpacity
                                                            style={styles.cancelButton}
                                                            onPress={() => handleCancel(apt)}
                                                        >
                                                            <Text style={styles.cancelButtonText}>Cancel</Text>
                                                        </TouchableOpacity>
                                                    </>
                                                )}
                                            </View>
                                        )}
                                    </View>
                                </Card>
                            );
                        })
                    ) : (
                        <View style={styles.emptyState}>
                            <View style={styles.emptyIconContainer}>
                                <MaterialIcons
                                    name={subTab === 'upcoming' ? 'event-available' : 'history'}
                                    size={36}
                                    color={colors.textMuted}
                                />
                            </View>
                            <Text style={styles.emptyTitle}>
                                {subTab === 'upcoming' ? 'No Upcoming Appointments' : 'No Past Appointments'}
                            </Text>
                            <Text style={styles.emptyText}>
                                {subTab === 'upcoming'
                                    ? 'Your schedule is clear. Book an appointment to get started.'
                                    : 'Completed appointments will appear here.'}
                            </Text>
                            {subTab === 'upcoming' && (
                                <Button
                                    title="Book Appointment"
                                    onPress={() => navigation.navigate('BookNew')}
                                    style={{ marginTop: spacing.lg, width: '60%', alignSelf: 'center' }}
                                />
                            )}
                        </View>
                    ))}
                </ScrollView>
            </SafeAreaView>

            {/* Modals */}
            <Modal
                visible={showRescheduleModal}
                animationType="slide"
                transparent={false}
                onRequestClose={() => setShowRescheduleModal(false)}
            >
                <SafeAreaView style={styles.modalContainer}>
                    <ScreenBackground>
                        <View style={styles.modalHeader}>
                            <TouchableOpacity onPress={() => setShowRescheduleModal(false)}>
                                <Text style={styles.modalCancel}>Cancel</Text>
                            </TouchableOpacity>
                            <Text style={styles.modalTitle}>Reschedule</Text>
                            <View style={{ width: 60 }} />
                        </View>

                        <ScrollView contentContainerStyle={[styles.modalContent, { paddingBottom: 60 }]}>
                            {rescheduleDataLoading ? (
                                <View style={{ paddingVertical: 60, alignItems: 'center' }}>
                                    <ActivityIndicator size="large" color={colors.text} />
                                    <Text style={{ color: colors.textSecondary, marginTop: spacing.md, fontSize: 14 }}>
                                        Loading availability...
                                    </Text>
                                </View>
                            ) : selectedAppointment?.service?.category === 'Pilates' ? (
                                /* ── Pilates: Show class sessions ── */
                                <View>
                                    <Text style={styles.sectionTitle}>Choose a Class</Text>
                                    {reschedulePilatesSessions.length > 0 ? (
                                        Object.entries(groupedReschedulePilates).map(([dateLabel, sessions]) => (
                                            <View key={dateLabel} style={{ marginBottom: spacing.lg }}>
                                                <Text style={{
                                                    fontSize: 12, fontWeight: '700', color: colors.textSecondary,
                                                    textTransform: 'uppercase', letterSpacing: 1, marginBottom: spacing.sm,
                                                }}>{dateLabel}</Text>
                                                {(sessions as any[]).map((session: any) => {
                                                    const spotsLeft = getPilatesSpotsLeft(session);
                                                    const isCurrentDate = selectedAppointment ? isSameDay(new Date(session.starts_at), new Date(selectedAppointment.start_time)) : false;
                                                    const isFull = spotsLeft <= 0;
                                                    const isSelected = selectedPilatesSession?.id === session.id;
                                                    const isDisabled = isFull || isCurrentDate;
                                                    return (
                                                        <TouchableOpacity
                                                            key={session.id}
                                                            style={[
                                                                {
                                                                    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                                                                    padding: spacing.md, borderRadius: 18, borderWidth: 1,
                                                                    borderColor: isSelected ? '#10B981' : isCurrentDate ? colors.primary : '#DDD6FE',
                                                                    backgroundColor: isSelected ? '#ECFDF5' : isCurrentDate ? 'rgba(109, 40, 217, 0.05)' : '#F5F3FF',
                                                                    marginBottom: spacing.sm, opacity: isDisabled ? 0.45 : 1,
                                                                },
                                                            ]}
                                                            disabled={isDisabled}
                                                            onPress={() => setSelectedPilatesSession(session)}
                                                        >
                                                            <View>
                                                                <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 2 }}>
                                                                    {new Date(session.starts_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                </Text>
                                                                <Text style={{ fontSize: 14, fontWeight: '700', color: '#6D28D9', marginBottom: 2 }}>
                                                                    {session.host?.display_name || 'Pilates host'}
                                                                </Text>
                                                                <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                                                                    {session.level} · {Math.round((new Date(session.ends_at).getTime() - new Date(session.starts_at).getTime()) / 60000)} min
                                                                </Text>
                                                            </View>
                                                            <View style={{
                                                                paddingHorizontal: spacing.sm, paddingVertical: spacing.xs,
                                                                borderRadius: 999, backgroundColor: isCurrentDate ? 'rgba(109, 40, 217, 0.15)' : isFull ? '#E5E7EB' : '#D1FAE5',
                                                            }}>
                                                                <Text style={{
                                                                    fontSize: 12, fontWeight: '800',
                                                                    color: isCurrentDate ? colors.primary : isFull ? colors.textMuted : '#047857',
                                                                }}>
                                                                    {isCurrentDate ? 'Current' : isFull ? 'Full' : `${spotsLeft} left`}
                                                                </Text>
                                                            </View>
                                                        </TouchableOpacity>
                                                    );
                                                })}
                                            </View>
                                        ))
                                    ) : (
                                        <View style={{
                                            padding: spacing.xl, alignItems: 'center',
                                            backgroundColor: 'rgba(0, 0, 0, 0.02)', borderRadius: 12,
                                            borderWidth: 1, borderColor: colors.border,
                                        }}>
                                            <Text style={{ fontSize: 14, color: colors.textSecondary, textAlign: 'center' }}>
                                                No Pilates classes are available for rescheduling.
                                            </Text>
                                        </View>
                                    )}
                                </View>
                            ) : (
                                /* ── Regular services: Date + Time selection ── */
                                <View>
                                    <Text style={styles.sectionTitle}>Select New Date</Text>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.datesRow}>
                                        {rescheduleAvailableDates.map((date) => {
                                            const isSelected = selectedDate && isSameDay(date, selectedDate);
                                            const isCurrentDate = selectedAppointment ? isSameDay(date, new Date(selectedAppointment.start_time)) : false;
                                            const isAvailable = !isCurrentDate && (rescheduleMasterAvailability.length === 0 || isRescheduleDayAvailable(date));
                                            return (
                                                <TouchableOpacity
                                                    key={date.toISOString()}
                                                    style={[
                                                        styles.dateCard,
                                                        isSelected && styles.dateCardActive,
                                                        isCurrentDate && { borderColor: colors.primary, backgroundColor: 'rgba(109, 40, 217, 0.05)' },
                                                        (!isAvailable && !isCurrentDate) && { opacity: 0.4, backgroundColor: colors.surfaceLight },
                                                        isCurrentDate && { opacity: 0.6 },
                                                    ]}
                                                    onPress={() => isAvailable && handleRescheduleDateSelect(date)}
                                                    disabled={!isAvailable}
                                                >
                                                    <Text style={[
                                                        styles.dateDayName,
                                                        isSelected && styles.dateTextActive,
                                                        isCurrentDate && { color: colors.primary },
                                                        (!isAvailable && !isCurrentDate) && { color: colors.textMuted },
                                                     ]}>
                                                        {format(date, 'EEE')}
                                                    </Text>
                                                    <Text style={[
                                                        styles.dateDay,
                                                        isSelected && styles.dateTextActive,
                                                        isCurrentDate && { color: colors.primary },
                                                        (!isAvailable && !isCurrentDate) && { color: colors.textMuted },
                                                     ]}>
                                                        {format(date, 'd')}
                                                    </Text>
                                                    {isCurrentDate && (
                                                        <Text style={{ fontSize: 8, fontWeight: '700', color: colors.primary, marginTop: 2 }}>Current</Text>
                                                    )}
                                                    {!isAvailable && !isCurrentDate && (
                                                        <Text style={{ fontSize: 9, color: colors.textMuted, marginTop: 2 }}>Off</Text>
                                                    )}
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </ScrollView>

                                    <Text style={styles.sectionTitle}>Select New Time</Text>
                                    {selectedDate ? (
                                        rescheduleTimeSlots.length > 0 ? (
                                            <View style={styles.timesGrid}>
                                                {rescheduleTimeSlots.map((slot) => {
                                                    const timeStr = format(slot, 'HH:mm');
                                                    const available = isRescheduleSlotAvailable(slot);
                                                    const isSelected = selectedTime === timeStr;
                                                    return (
                                                        <TouchableOpacity
                                                            key={timeStr}
                                                            style={[
                                                                styles.timeSlot,
                                                                (!available || isFetchingSlots) && styles.timeSlotUnavailable,
                                                                isSelected && styles.timeSlotActive,
                                                            ]}
                                                            onPress={() => available && !isFetchingSlots && setSelectedTime(timeStr)}
                                                            disabled={!available || isFetchingSlots}
                                                        >
                                                            <Text style={[
                                                                styles.timeSlotText,
                                                                (!available || isFetchingSlots) && styles.timeSlotTextUnavailable,
                                                                isSelected && styles.timeSlotTextActive,
                                                            ]}>
                                                                {timeStr}
                                                            </Text>
                                                        </TouchableOpacity>
                                                    );
                                                })}
                                            </View>
                                        ) : (
                                            <View style={{
                                                padding: spacing.xl, alignItems: 'center',
                                                backgroundColor: 'rgba(0, 0, 0, 0.02)', borderRadius: 12,
                                                borderWidth: 1, borderColor: colors.border,
                                            }}>
                                                <Text style={{ fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 }}>
                                                    {rescheduleMasterAvailability.length === 0
                                                        ? "This specialist hasn't set their availability yet. Please try another day or contact them directly."
                                                        : 'No time slots available for this day. Please select a different date.'}
                                                </Text>
                                            </View>
                                        )
                                    ) : (
                                        <View style={{ padding: spacing.lg, alignItems: 'center' }}>
                                            <Text style={{ fontSize: 14, color: colors.textMuted }}>
                                                Please select a date first
                                            </Text>
                                        </View>
                                    )}
                                </View>
                            )}

                            <Button
                                title={rescheduleLoading ? "Rescheduling..." : "Confirm Reschedule"}
                                onPress={confirmReschedule}
                                loading={rescheduleLoading}
                                disabled={rescheduleLoading || (
                                    selectedAppointment?.service?.category === 'Pilates'
                                        ? !selectedPilatesSession
                                        : !selectedDate || !selectedTime
                                )}
                                style={styles.confirmButton}
                            />
                        </ScrollView>
                    </ScreenBackground>
                </SafeAreaView>
            </Modal>

            {/* ── Cancellation Confirmation Modal ── */}
            <Modal
                visible={showCancelModal}
                animationType="fade"
                transparent
                onRequestClose={closeCancelModal}
            >
                <View style={cancelStyles.overlay}>
                    <TouchableOpacity style={cancelStyles.backdrop} activeOpacity={1} onPress={closeCancelModal} />
                    <View style={cancelStyles.container}>
                        {/* Header */}
                        <View style={cancelStyles.headerRow}>
                            <View style={[cancelStyles.iconCircle, isLateCancellation ? cancelStyles.iconCircleWarning : cancelStyles.iconCircleNormal]}>
                                <MaterialIcons
                                    name={isLateCancellation ? 'warning' : 'event-busy'}
                                    size={28}
                                    color={isLateCancellation ? '#F59E0B' : '#EF4444'}
                                />
                            </View>
                        </View>
                        <Text style={cancelStyles.title}>Cancel Appointment</Text>

                        {appointmentToCancel && (
                            <>
                                {/* Appointment Details */}
                                <View style={cancelStyles.detailsCard}>
                                    <Text style={cancelStyles.serviceName}>
                                        {appointmentToCancel.service?.name || appointmentToCancel.service_name || 'Service'}
                                    </Text>
                                    <Text style={cancelStyles.masterName}>
                                        with {appointmentToCancel.master?.full_name || 'Specialist'}
                                    </Text>
                                    <View style={cancelStyles.detailLine}>
                                        <MaterialIcons name="event" size={14} color={colors.textSecondary} />
                                        <Text style={cancelStyles.detailLineText}>
                                            {format(new Date(appointmentToCancel.start_time), 'EEEE, MMMM d, yyyy')}
                                        </Text>
                                    </View>
                                    <View style={cancelStyles.detailLine}>
                                        <MaterialIcons name="schedule" size={14} color={colors.textSecondary} />
                                        <Text style={cancelStyles.detailLineText}>
                                            {format(new Date(appointmentToCancel.start_time), 'HH:mm')}
                                        </Text>
                                    </View>
                                </View>

                                {/* Late Cancellation Warning */}
                                {isLateCancellation && (
                                    <View style={cancelStyles.warningBanner}>
                                        <MaterialIcons name="info-outline" size={18} color="#92400E" />
                                        <Text style={cancelStyles.warningText}>
                                            This appointment is within 24 hours. A 50% late cancellation fee will apply.
                                        </Text>
                                    </View>
                                )}

                                {/* Refund Breakdown */}
                                <View style={cancelStyles.refundBreakdown}>
                                    <Text style={cancelStyles.breakdownTitle}>Refund Summary</Text>
                                    <View style={cancelStyles.breakdownRow}>
                                        <Text style={cancelStyles.breakdownLabel}>Amount Paid</Text>
                                        <Text style={cancelStyles.breakdownValue}>
                                            €{appointmentToCancel.deposit_amount ?? appointmentToCancel.price}
                                        </Text>
                                    </View>
                                    {isLateCancellation && (
                                        <View style={cancelStyles.breakdownRow}>
                                            <Text style={[cancelStyles.breakdownLabel, { color: '#EF4444' }]}>
                                                Late Cancellation Fee (50%)
                                            </Text>
                                            <Text style={[cancelStyles.breakdownValue, { color: '#EF4444' }]}>
                                                -€{((appointmentToCancel.deposit_amount ?? appointmentToCancel.price) * 0.5).toFixed(2)}
                                            </Text>
                                        </View>
                                    )}
                                    <View style={cancelStyles.divider} />
                                    <View style={cancelStyles.breakdownRow}>
                                        <Text style={cancelStyles.breakdownTotalLabel}>You'll Receive</Text>
                                        <Text style={cancelStyles.breakdownTotalValue}>
                                            €{(
                                                (appointmentToCancel.deposit_amount ?? appointmentToCancel.price) *
                                                (isLateCancellation ? 0.5 : 1)
                                            ).toFixed(2)}
                                        </Text>
                                    </View>
                                </View>

                                {/* Estimated Timeline */}
                                <View style={cancelStyles.timelineBanner}>
                                    <MaterialIcons name="access-time" size={16} color={colors.textSecondary} />
                                    <Text style={cancelStyles.timelineText}>
                                        {isLateCancellation
                                            ? 'Your refund will appear in your account within 5-10 business days.'
                                            : 'Your hold will be released. Funds typically appear within 1-3 business days.'}
                                    </Text>
                                </View>
                            </>
                        )}

                        {/* Buttons */}
                        <View style={cancelStyles.buttonRow}>
                            <TouchableOpacity
                                style={cancelStyles.keepButton}
                                onPress={closeCancelModal}
                                disabled={cancellationLoading}
                            >
                                <Text style={cancelStyles.keepButtonText}>Keep Appointment</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[cancelStyles.confirmCancelButton, cancellationLoading && { opacity: 0.6 }]}
                                onPress={confirmCancel}
                                disabled={cancellationLoading}
                            >
                                {cancellationLoading ? (
                                    <ActivityIndicator size="small" color="#FFF" />
                                ) : (
                                    <Text style={cancelStyles.confirmCancelButtonText}>Confirm Cancellation</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* ── Refund Receipt Modal (shown after successful cancellation) ── */}
            <Modal
                visible={showRefundReceiptModal}
                animationType="fade"
                transparent
                onRequestClose={closeRefundReceipt}
            >
                <View style={cancelStyles.overlay}>
                    <TouchableOpacity style={cancelStyles.backdrop} activeOpacity={1} onPress={closeRefundReceipt} />
                    <View style={cancelStyles.container}>
                        {/* Success Icon */}
                        <View style={cancelStyles.headerRow}>
                            <View style={cancelStyles.iconCircleSuccess}>
                                <MaterialIcons name="check-circle" size={32} color="#10B981" />
                            </View>
                        </View>
                        <Text style={cancelStyles.title}>Appointment Cancelled</Text>
                        <Text style={cancelStyles.subtitle}>
                            {cancellationResult?.is_late_cancellation
                                ? 'A late cancellation fee has been applied.'
                                : 'Your appointment has been successfully cancelled.'}
                        </Text>

                        {cancellationResult && (
                            <>
                                {/* Refund Details */}
                                <View style={cancelStyles.refundBreakdown}>
                                    <Text style={cancelStyles.breakdownTitle}>Refund Details</Text>
                                    <View style={cancelStyles.breakdownRow}>
                                        <Text style={cancelStyles.breakdownLabel}>Original Amount</Text>
                                        <Text style={cancelStyles.breakdownValue}>
                                            €{(cancellationResult.original_amount_cents / 100).toFixed(2)}
                                        </Text>
                                    </View>
                                    {cancellationResult.fee_amount_cents > 0 && (
                                        <View style={cancelStyles.breakdownRow}>
                                            <Text style={[cancelStyles.breakdownLabel, { color: '#EF4444' }]}>
                                                Cancellation Fee
                                            </Text>
                                            <Text style={[cancelStyles.breakdownValue, { color: '#EF4444' }]}>
                                                -€{(cancellationResult.fee_amount_cents / 100).toFixed(2)}
                                            </Text>
                                        </View>
                                    )}
                                    <View style={cancelStyles.divider} />
                                    <View style={cancelStyles.breakdownRow}>
                                        <Text style={cancelStyles.breakdownTotalLabel}>Refund Amount</Text>
                                        <Text style={[cancelStyles.breakdownTotalValue, { color: '#10B981' }]}>
                                            €{(cancellationResult.refund_amount_cents / 100).toFixed(2)}
                                        </Text>
                                    </View>
                                </View>

                                {/* Timeline */}
                                <View style={cancelStyles.timelineBanner}>
                                    <MaterialIcons name="access-time" size={16} color={colors.textSecondary} />
                                    <Text style={cancelStyles.timelineText}>
                                        {cancellationResult.estimated_arrival}
                                    </Text>
                                </View>

                                {cancellationResult.refund_id && (
                                    <Text style={cancelStyles.refundIdText}>
                                        Ref: {cancellationResult.refund_id}
                                    </Text>
                                )}
                            </>
                        )}

                        {/* Done Button */}
                        <TouchableOpacity style={cancelStyles.doneButton} onPress={closeRefundReceipt}>
                            <Text style={cancelStyles.doneButtonText}>Done</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </ScreenBackground >
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    // New Tab Styles (Matching BookAndChatScreen)
    tabContainer: {
        paddingHorizontal: 20,
        paddingBottom: 8,
        paddingTop: 4,
        backgroundColor: 'transparent',
    },
    tabBar: {
        flexDirection: 'row',
        backgroundColor: 'rgba(0, 0, 0, 0.03)',
        borderRadius: 12,
        padding: 2,
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.06)',
    },
    tabItem: {
        flex: 1,
        paddingVertical: 8,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 10,
        gap: 1,
    },
    tabText: {
        fontSize: 13, // Slightly larger than the top nav
        fontWeight: '600',
        color: 'rgba(0, 0, 0, 0.35)',
    },
    tabTextActive: {
        color: '#FFFFFF',
        fontWeight: '700',
    },

    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        padding: spacing.md,
        paddingBottom: 100,
    },


    card: {
        padding: spacing.md,
        marginBottom: spacing.md,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: spacing.md,
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.text,
        marginBottom: 2,
    },
    cardSubtitle: {
        fontSize: 14,
        color: colors.textSecondary,
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '600',
    },
    cardDetails: {
        marginBottom: spacing.md,
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
    },
    detailIcon: {
        marginRight: spacing.sm,
        width: 20,
    },
    detailText: {
        fontSize: 14,
        color: colors.text,
    },
    cardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: spacing.sm,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    price: {
        fontSize: 16,
        fontWeight: '700',
        color: colors.primary,
    },
    actionButtons: {
        flexDirection: 'row',
        gap: spacing.sm,
    },
    chatButton: {
        padding: 8,
        borderRadius: 20,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
    },
    chatButtonText: {
        fontSize: 16,
    },
    rescheduleButton: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
    },
    rescheduleButtonText: {
        fontSize: 12,
        fontWeight: '500',
        color: colors.text,
    },
    cancelButton: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#FEE2E2',
    },
    cancelButtonText: {
        fontSize: 12,
        fontWeight: '500',
        color: '#991B1B',
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: spacing.xxxl,
    },
    emptyIconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(0, 0, 0, 0.04)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.lg
    },
    emptyIcon: {
        fontSize: 36,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: colors.text,
        marginBottom: spacing.sm
    },
    emptyText: {
        fontSize: 14,
        color: colors.textSecondary,
        textAlign: 'center',
        paddingHorizontal: spacing.xl,
    },
    // Modal Styles
    overlayContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
    },
    dialogContainer: {
        width: '85%',
        backgroundColor: colors.surface,
        borderRadius: 20,
        padding: spacing.xl,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 10,
        elevation: 10,
    },
    dialogTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: colors.text,
        marginBottom: spacing.sm,
        textAlign: 'center',
    },
    dialogMessage: {
        fontSize: 15,
        color: colors.textSecondary,
        textAlign: 'center',
        marginBottom: spacing.lg,
        lineHeight: 22,
    },
    warningBox: {
        backgroundColor: '#FEF3C7',
        padding: spacing.md,
        borderRadius: 12,
        marginBottom: spacing.lg,
    },
    warningText: {
        color: '#92400E',
        fontSize: 13,
        fontWeight: '600',
        textAlign: 'center',
    },
    dialogButtons: {
        flexDirection: 'row',
        gap: spacing.md,
    },
    dialogButtonCancel: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 12,
        backgroundColor: colors.background,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: 'center',
    },
    dialogButtonCancelText: {
        fontSize: 15,
        fontWeight: '600',
        color: colors.text,
    },
    dialogButtonConfirm: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 12,
        backgroundColor: '#EF4444',
        alignItems: 'center',
    },
    dialogButtonConfirmText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#1A1A1A',
    },
    // Reschedule Modal
    modalContainer: {
        flex: 1,
        backgroundColor: colors.baseBackground,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    modalCancel: {
        fontSize: 16,
        color: colors.primary,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: colors.text,
    },
    modalContent: {
        padding: spacing.lg,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.text,
        marginTop: spacing.md,
        marginBottom: spacing.md,
    },
    datesRow: {
        marginBottom: spacing.lg,
    },
    dateCard: {
        width: 60,
        height: 70,
        borderRadius: 12,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: spacing.sm,
    },
    dateCardActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    dateDayName: {
        fontSize: 12,
        color: colors.textSecondary,
        marginBottom: 4,
    },
    dateDay: {
        fontSize: 18,
        fontWeight: '700',
        color: colors.text,
    },
    dateTextActive: {
        color: '#FFF',
    },
    timesGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
        marginBottom: spacing.xl,
    },
    timeSlot: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 12,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        width: '30%',
        alignItems: 'center',
    },
    timeSlotActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    timeSlotUnavailable: {
        backgroundColor: colors.surfaceLight,
        opacity: 0.3,
    },
    timeSlotText: {
        fontSize: 14,
        color: colors.text,
        fontWeight: '500',
    },
    timeSlotTextUnavailable: {
        color: colors.textMuted,
    },
    timeSlotTextActive: {
        color: '#FFF',
    },
    confirmButton: {
        marginTop: spacing.md,
    },
    rescheduleWarning: {
        marginTop: spacing.md,
        fontSize: 13,
        color: '#D97706',
        textAlign: 'center',
        fontStyle: 'italic',
    },
    depositPaidText: {
        fontSize: 12,
        color: '#059669',
        marginTop: 2,
        fontWeight: '500',
    },
    // Master-initiated reschedule proposal styles
    rescheduleProposalBox: {
        backgroundColor: 'rgba(200, 160, 77, 0.1)',
        borderRadius: 12,
        padding: spacing.md,
        marginBottom: spacing.md,
        borderWidth: 1,
        borderColor: 'rgba(200, 160, 77, 0.3)',
    },
    rescheduleProposalTitle: {
        fontSize: 14,
        color: colors.primary,
        fontWeight: '600',
        marginBottom: 6,
    },
    rescheduleProposalTime: {
        fontSize: 16,
        color: colors.text,
        fontWeight: '700',
        marginBottom: spacing.md,
    },
    rescheduleProposalActions: {
        flexDirection: 'row',
        gap: spacing.sm,
    },
    approveRescheduleButton: {
        flex: 1,
        backgroundColor: colors.primary,
        paddingVertical: 10,
        borderRadius: 10,
        alignItems: 'center',
    },
    approveRescheduleText: {
        color: '#1A1A1A',
        fontSize: 14,
        fontWeight: '600',
    },
    counterProposeButton: {
        flex: 1,
        backgroundColor: colors.surface,
        paddingVertical: 10,
        borderRadius: 10,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.border,
    },
    counterProposeText: {
        color: colors.text,
        fontSize: 14,
        fontWeight: '600',
    },
});

// ── Cancellation Modal Styles ──
const cancelStyles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
    },
    container: {
        width: '90%',
        maxWidth: 400,
        backgroundColor: colors.surface,
        borderRadius: 24,
        padding: 24,
        borderWidth: 1,
        borderColor: colors.border,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
        elevation: 12,
    },
    headerRow: {
        alignItems: 'center',
        marginBottom: 12,
    },
    iconCircle: {
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
    },
    iconCircleNormal: {
        backgroundColor: 'rgba(239, 68, 68, 0.12)',
    },
    iconCircleWarning: {
        backgroundColor: 'rgba(245, 158, 11, 0.12)',
    },
    iconCircleSuccess: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: 'rgba(16, 185, 129, 0.12)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: colors.text,
        textAlign: 'center',
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 14,
        color: colors.textSecondary,
        textAlign: 'center',
        marginBottom: 16,
        lineHeight: 20,
    },
    detailsCard: {
        backgroundColor: 'rgba(0, 0, 0, 0.03)',
        borderRadius: 14,
        padding: 14,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.05)',
    },
    serviceName: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.text,
        marginBottom: 2,
    },
    masterName: {
        fontSize: 13,
        color: colors.textSecondary,
        marginBottom: 10,
    },
    detailLine: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 4,
    },
    detailLineText: {
        fontSize: 13,
        color: colors.textSecondary,
    },
    warningBanner: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
        backgroundColor: '#FEF3C7',
        borderRadius: 12,
        padding: 12,
        marginBottom: 14,
    },
    warningText: {
        flex: 1,
        fontSize: 13,
        fontWeight: '500',
        color: '#92400E',
        lineHeight: 18,
    },
    refundBreakdown: {
        backgroundColor: 'rgba(0, 0, 0, 0.03)',
        borderRadius: 14,
        padding: 14,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.05)',
    },
    breakdownTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.text,
        marginBottom: 10,
    },
    breakdownRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    breakdownLabel: {
        fontSize: 13,
        color: colors.textSecondary,
    },
    breakdownValue: {
        fontSize: 13,
        fontWeight: '500',
        color: colors.text,
    },
    divider: {
        height: 1,
        backgroundColor: colors.border,
        marginVertical: 8,
    },
    breakdownTotalLabel: {
        fontSize: 15,
        fontWeight: '700',
        color: colors.text,
    },
    breakdownTotalValue: {
        fontSize: 17,
        fontWeight: '700',
        color: colors.primary,
    },
    timelineBanner: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
        backgroundColor: 'rgba(0, 0, 0, 0.02)',
        borderRadius: 12,
        padding: 12,
        marginBottom: 18,
    },
    timelineText: {
        flex: 1,
        fontSize: 12,
        color: colors.textSecondary,
        lineHeight: 17,
    },
    refundIdText: {
        fontSize: 11,
        color: colors.textMuted,
        textAlign: 'center',
        marginBottom: 14,
        fontFamily: 'monospace',
    },
    buttonRow: {
        flexDirection: 'row',
        gap: 10,
    },
    keepButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 14,
        backgroundColor: 'rgba(0, 0, 0, 0.05)',
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: 'center',
    },
    keepButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.text,
    },
    confirmCancelButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 14,
        backgroundColor: '#EF4444',
        alignItems: 'center',
    },
    confirmCancelButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1A1A1A',
    },
    doneButton: {
        width: '100%',
        paddingVertical: 14,
        borderRadius: 14,
        backgroundColor: colors.primary,
        alignItems: 'center',
    },
    doneButtonText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1A1A1A',
    },
});
