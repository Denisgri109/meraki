import React, { useState, useEffect } from 'react';
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
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, CommonActions } from '@react-navigation/native';
import { format, addDays, isSameDay, differenceInHours } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { safeSupabaseFetch } from '../../lib/supabaseApi';
import { useAuth } from '../../contexts/AuthContext';
import { Card, Button, ScreenBackground } from '../../components/ui';
import { useModal } from '../../contexts/ModalContext';
import { colors, spacing } from '../../theme';
import { eurosToCents } from '../../services/stripeService';

// Cancellation policy constants
const CANCELLATION_WINDOW_HOURS = 24;

type Appointment = {
    id: string;
    start_time: string;
    end_time: string;
    status: string;
    price: number;
    notes: string | null;
    service_id: string;
    master_id: string;
    stripe_payment_intent_id: string | null;
    deposit_amount: number | null;
    deposit_paid: boolean | null;
    proposed_start_time: string | null;
    proposed_end_time: string | null;
    reschedule_initiated_by: string | null;
    service: { name: string; duration_minutes: number } | null;
    master: { full_name: string; push_token?: string } | null;
};

export function AppointmentListScreen() {
    const navigation = useNavigation<any>();
    const { user, checkSession } = useAuth();
    const { showAlert, showConfirm } = useModal();

    // State
    const [subTab, setSubTab] = useState<'upcoming' | 'past'>('upcoming'); // For appointments
    const [appointments, setAppointments] = useState<Appointment[]>([]);

    // UI State
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Reschedule/Cancel State
    const [appointmentToCancel, setAppointmentToCancel] = useState<Appointment | null>(null);
    const [isLateCancellation, setIsLateCancellation] = useState(false);
    const [cancellationLoading, setCancellationLoading] = useState(false);
    const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
    const [showRescheduleModal, setShowRescheduleModal] = useState(false);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [selectedTime, setSelectedTime] = useState<string | null>(null);
    const [rescheduleLoading, setRescheduleLoading] = useState(false);

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
                    service:services(name, duration_minutes),
                    master:profiles!appointments_master_id_fkey(full_name, push_token)
                `)
                // @ts-ignore - user check handled above
                .eq('client_id', user?.id)
                .order('start_time', { ascending: false });

            const { data, error } = await safeSupabaseFetch(queryPromise as any, { timeout: 8000 });
            if (error) throw error;

            // Filter out orphaned appointments (where service or master was deleted)
            const validAppointments = ((data as unknown as Appointment[]) || []).filter(
                apt => apt.service !== null && apt.master !== null
            );
            setAppointments(validAppointments);
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
        showConfirm(
            'Cancel Appointment',
            'Are you sure you want to cancel this appointment?',
            () => confirmCancel(appointment),
            {
                confirmText: 'Yes, Cancel',
                cancelText: 'No, Keep it',
                type: 'info'
            }
        );
    };

    // Send notification to Master about cancellation
    const notifyMasterOfCancellation = async (apt: Appointment) => {
        const masterPushToken = apt.master?.push_token;
        if (!masterPushToken) return;

        try {
            await fetch('https://exp.host/--/api/v2/push/send', {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    to: masterPushToken,
                    sound: 'default',
                    title: 'Appointment Canceled',
                    body: `${user?.user_metadata?.full_name || 'Client'} canceled their appointment. The slot is open again.`,
                    data: { appointmentId: apt.id },
                }),
            });
        } catch (e) {
            console.error('Failed to send cancellation notification:', e);
        }
    };

    const confirmCancel = async (appointment: Appointment) => {
        setCancellationLoading(true);

        try {
            // Release payment hold, no charge
            if (appointment.stripe_payment_intent_id) {
                try {
                    await supabase.functions.invoke('cancel-payment', {
                        body: {
                            payment_intent_id: appointment.stripe_payment_intent_id,
                        }
                    });
                } catch (e) {
                    console.error('Failed to release payment hold:', e);
                }
            }

            // Update appointment status
            const { error } = await supabase
                .from('appointments')
                .update({
                    status: 'cancelled_free',
                    cancellation_reason: 'Cancellation by client',
                } as any)
                .eq('id', appointment.id);

            if (error) throw error;

            // Notify master
            await notifyMasterOfCancellation(appointment);

            showAlert('Appointment Canceled', 'Your appointment has been canceled successfully.', 'success');

            fetchAppointments();
        } catch (error: any) {
            showAlert('Error', error.message, 'error');
        } finally {
            setCancellationLoading(false);
        }
    };

    const handleReschedule = (appointment: Appointment) => {
        setSelectedAppointment(appointment);
        setSelectedDate(null);
        setSelectedTime(null);
        setShowRescheduleModal(true);
    };

    // Notify master of reschedule
    const notifyMasterOfReschedule = async (apt: Appointment, newTime: Date, needsApproval: boolean) => {
        const masterPushToken = apt.master?.push_token;
        if (!masterPushToken) return;

        const message = needsApproval
            ? `${user?.user_metadata?.full_name || 'Client'} wants to move today's appt to ${format(newTime, 'EEEE, MMM d at HH:mm')}. Approve or decline?`
            : `${user?.user_metadata?.full_name || 'Client'} moved their appointment to ${format(newTime, 'EEEE, MMM d at HH:mm')}.`;

        try {
            await fetch('https://exp.host/--/api/v2/push/send', {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    to: masterPushToken,
                    sound: 'default',
                    title: needsApproval ? 'Reschedule Request' : 'Appointment Rescheduled',
                    body: message,
                    data: { appointmentId: apt.id },
                }),
            });
        } catch (e) {
            console.error('Failed to send reschedule notification:', e);
        }
    };

    const confirmReschedule = async () => {
        if (!selectedAppointment || !selectedDate || !selectedTime) {
            showAlert('Error', 'Please select a new date and time', 'error');
            return;
        }

        setRescheduleLoading(true);
        try {
            const [hours, minutes] = selectedTime.split(':').map(Number);
            const newStartTime = new Date(selectedDate);
            newStartTime.setHours(hours, minutes, 0, 0);

            const duration = selectedAppointment.service?.duration_minutes || 60;
            const newEndTime = new Date(newStartTime.getTime() + duration * 60000);

            const isLateReschedule = isWithinCancellationWindow(selectedAppointment.start_time);

            if (isLateReschedule) {
                // Late reschedule: Requires Master approval
                const { error } = await supabase
                    .from('appointments')
                    .update({
                        proposed_start_time: newStartTime.toISOString(),
                        proposed_end_time: newEndTime.toISOString(),
                        status: 'reschedule_pending',
                        reschedule_initiated_by: user?.id,
                    } as any)
                    .eq('id', selectedAppointment.id);

                if (error) throw error;

                await notifyMasterOfReschedule(selectedAppointment, newStartTime, true);
                showAlert('Request Sent', 'This is a late reschedule. Your request has been sent to the master for approval.', 'info');
            } else {
                // Early reschedule: Instant update, no approval needed
                const { error } = await supabase
                    .from('appointments')
                    .update({
                        start_time: newStartTime.toISOString(),
                        end_time: newEndTime.toISOString(),
                        status: 'confirmed',
                    } as any)
                    .eq('id', selectedAppointment.id);

                if (error) throw error;

                await notifyMasterOfReschedule(selectedAppointment, newStartTime, false);
                showAlert('Success', 'Your appointment has been rescheduled.', 'success');
            }

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

        showConfirm(
            'Approve Reschedule',
            `Accept new time: ${format(new Date(apt.proposed_start_time), 'EEEE, MMM d at HH:mm')}?`,
            async () => {
                try {
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

                    // Notify master
                    const masterPushToken = apt.master?.push_token;
                    if (masterPushToken) {
                        await fetch('https://exp.host/--/api/v2/push/send', {
                            method: 'POST',
                            headers: {
                                'Accept': 'application/json',
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                to: masterPushToken,
                                sound: 'default',
                                title: 'Reschedule Approved',
                                body: `${user?.user_metadata?.full_name || 'Client'} approved your reschedule request.`,
                                data: { appointmentId: apt.id },
                            }),
                        });
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
        setSelectedAppointment(apt);
        setSelectedDate(null);
        setSelectedTime(null);
        setShowRescheduleModal(true);
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
    const upcomingAppointments = appointments.filter(
        apt => new Date(apt.start_time) >= now && apt.status !== 'cancelled'
    );
    const pastAppointments = appointments.filter(
        apt => new Date(apt.start_time) < now || apt.status === 'cancelled'
    );

    // Helpers
    const statusColors: Record<string, { bg: string; text: string }> = {
        pending: { bg: '#FEF3C7', text: '#92400E' },
        confirmed: { bg: '#DBEAFE', text: '#1E40AF' },
        completed: { bg: '#D1FAE5', text: '#065F46' },
        cancelled: { bg: '#FEE2E2', text: '#991B1B' },
        cancelled_free: { bg: '#FEE2E2', text: '#991B1B' },
        cancelled_charge: { bg: '#FEE2E2', text: '#991B1B' },
        reschedule_pending: { bg: 'rgba(200, 160, 77, 0.15)', text: colors.primary },
        no_show: { bg: '#F3F4F6', text: '#374151' },
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
            no_show: 'No Show',
        };
        return statusLabels[status] || status.charAt(0).toUpperCase() + status.slice(1);
    };

    const availableDates = Array.from({ length: 14 }, (_, i) => addDays(new Date(), i + 1));
    const timeSlots = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'];

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

                {/* Premium Pill Tabs */}
                {/* Premium Pill Tabs - Styled to match BookAndChatScreen CustomTabBar */}
                <View style={styles.tabContainer}>
                    <View style={styles.tabBar}>
                        <TouchableOpacity
                            style={[styles.tabItem]}
                            onPress={() => setSubTab('upcoming')}
                        >
                            {subTab === 'upcoming' && (
                                <LinearGradient
                                    colors={[colors.primary, colors.champagne]}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={[StyleSheet.absoluteFillObject, { borderRadius: 10 }]}
                                />
                            )}
                            <Text style={[styles.tabText, subTab === 'upcoming' && styles.tabTextActive]}>
                                Upcoming ({upcomingAppointments.length})
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.tabItem]}
                            onPress={() => setSubTab('past')}
                        >
                            {subTab === 'past' && (
                                <LinearGradient
                                    colors={[colors.primary, colors.champagne]}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={[StyleSheet.absoluteFillObject, { borderRadius: 10 }]}
                                />
                            )}
                            <Text style={[styles.tabText, subTab === 'past' && styles.tabTextActive]}>
                                Past ({pastAppointments.length})
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>

                <ScrollView
                    contentContainerStyle={styles.content}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} />
                    }
                    showsVerticalScrollIndicator={false}
                >
                    {/* --- APPOINTMENTS LIST --- */}
                    {(subTab === 'upcoming' ? upcomingAppointments : pastAppointments).length > 0 ? (
                        (subTab === 'upcoming' ? upcomingAppointments : pastAppointments).map((apt) => {
                            const date = new Date(apt.start_time);
                            const statusStyle = statusColors[apt.status] || statusColors.pending;
                            const canModify = subTab === 'upcoming' && apt.status !== 'cancelled';

                            return (
                                <Card key={apt.id} style={styles.card} variant="glass">
                                    <View style={styles.cardHeader}>
                                        <View>
                                            <Text style={styles.cardTitle}>
                                                {apt.service?.name || 'Service'}
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
                    )}
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

                        <ScrollView style={styles.modalContent}>
                            <Text style={styles.sectionTitle}>Select New Date</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.datesRow}>
                                {availableDates.map((date) => (
                                    <TouchableOpacity
                                        key={date.toISOString()}
                                        style={[
                                            styles.dateCard,
                                            selectedDate && isSameDay(date, selectedDate) && styles.dateCardActive,
                                        ]}
                                        onPress={() => setSelectedDate(date)}
                                    >
                                        <Text style={[
                                            styles.dateDayName,
                                            selectedDate && isSameDay(date, selectedDate) && styles.dateTextActive,
                                        ]}>
                                            {format(date, 'EEE')}
                                        </Text>
                                        <Text style={[
                                            styles.dateDay,
                                            selectedDate && isSameDay(date, selectedDate) && styles.dateTextActive,
                                        ]}>
                                            {format(date, 'd')}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>

                            <Text style={styles.sectionTitle}>Select New Time</Text>
                            <View style={styles.timesGrid}>
                                {timeSlots.map((time) => (
                                    <TouchableOpacity
                                        key={time}
                                        style={[
                                            styles.timeSlot,
                                            selectedTime === time && styles.timeSlotActive,
                                        ]}
                                        onPress={() => setSelectedTime(time)}
                                    >
                                        <Text style={[
                                            styles.timeSlotText,
                                            selectedTime === time && styles.timeSlotTextActive,
                                        ]}>
                                            {time}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <Button
                                title={rescheduleLoading ? "Proposing..." : (isWithinCancellationWindow(selectedAppointment?.start_time || '') ? "Request Late Reschedule" : "Confirm Reschedule")}
                                onPress={confirmReschedule}
                                loading={rescheduleLoading}
                                disabled={rescheduleLoading || !selectedDate || !selectedTime}
                                style={styles.confirmButton}
                            />

                            {isWithinCancellationWindow(selectedAppointment?.start_time || '') && (
                                <Text style={styles.rescheduleWarning}>
                                    * This appointment is starting soon. Your reschedule request will require master approval.
                                </Text>
                            )}
                        </ScrollView>
                    </ScreenBackground>
                </SafeAreaView>
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
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderRadius: 12,
        padding: 2,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
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
        color: 'rgba(255,255,255,0.4)',
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
        backgroundColor: 'rgba(255,255,255,0.05)',
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
        color: '#FFF',
    },
    // Reschedule Modal
    modalContainer: {
        flex: 1,
        backgroundColor: colors.background,
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
    timeSlotText: {
        fontSize: 14,
        color: colors.text,
        fontWeight: '500',
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
        color: '#FFF',
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
