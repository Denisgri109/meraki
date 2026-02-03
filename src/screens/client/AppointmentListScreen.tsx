import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    Alert,
    Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { format, addDays, isSameDay, differenceInHours } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { safeSupabaseFetch } from '../../lib/supabaseApi';
import { useAuth } from '../../contexts/AuthContext';
import { Card, Button, ScreenBackground } from '../../components/ui';
import { colors, spacing } from '../../theme';
import { eurosToCents } from '../../services/stripeService';

// Cancellation policy constants
const CANCELLATION_WINDOW_HOURS = 24;
const LATE_CANCEL_FEE_PERCENTAGE = 50;

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
    service: { name: string; duration_minutes: number } | null;
    master: { full_name: string; push_token?: string } | null;
};

export function AppointmentListScreen() {
    const navigation = useNavigation<any>();
    const { user, checkSession } = useAuth();

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

    // Calculate penalty fee
    const calculatePenaltyFee = (price: number): number => {
        return Math.round(price * (LATE_CANCEL_FEE_PERCENTAGE / 100));
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
        const isLate = isWithinCancellationWindow(appointment.start_time);
        setIsLateCancellation(isLate);
        setAppointmentToCancel(appointment);
    };

    // Send notification to Master about cancellation
    const notifyMasterOfCancellation = async (apt: Appointment, wasCharged: boolean, feeAmount?: number) => {
        const masterPushToken = apt.master?.push_token;
        if (!masterPushToken) return;

        const message = wasCharged
            ? `${user?.user_metadata?.full_name || 'Client'} canceled late. A €${feeAmount?.toFixed(2)} fee has been charged.`
            : `${user?.user_metadata?.full_name || 'Client'} canceled their appointment. The slot is open again.`;

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
                    title: wasCharged ? 'Late Cancellation Fee Charged' : 'Appointment Canceled',
                    body: message,
                    data: { appointmentId: apt.id },
                }),
            });
        } catch (e) {
            console.error('Failed to send cancellation notification:', e);
        }
    };

    const confirmCancel = async () => {
        if (!appointmentToCancel) return;
        setCancellationLoading(true);

        try {
            if (isLateCancellation) {
                // Late cancellation: Capture penalty fee
                const penaltyFee = calculatePenaltyFee(appointmentToCancel.price);

                // Capture partial payment for late cancellation
                if (appointmentToCancel.stripe_payment_intent_id) {
                    try {
                        await supabase.functions.invoke('capture-payment', {
                            body: {
                                payment_intent_id: appointmentToCancel.stripe_payment_intent_id,
                                amount_to_capture: eurosToCents(penaltyFee),
                            }
                        });
                    } catch (e) {
                        console.error('Failed to capture penalty:', e);
                        // Continue with cancellation even if payment capture fails
                    }
                }

                // Update appointment status
                const { error } = await supabase
                    .from('appointments')
                    .update({
                        status: 'cancelled_charge',
                        cancellation_fee_amount: eurosToCents(penaltyFee),
                        cancellation_reason: 'Late cancellation by client',
                    } as any)
                    .eq('id', appointmentToCancel.id);

                if (error) throw error;

                // Notify master
                await notifyMasterOfCancellation(appointmentToCancel, true, penaltyFee);

                Alert.alert(
                    'Appointment Canceled',
                    `A cancellation fee of €${penaltyFee.toFixed(2)} has been charged.`
                );
            } else {
                // Early cancellation: Release payment hold, no charge
                if (appointmentToCancel.stripe_payment_intent_id) {
                    try {
                        await supabase.functions.invoke('cancel-payment', {
                            body: {
                                payment_intent_id: appointmentToCancel.stripe_payment_intent_id,
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
                        cancellation_reason: 'Early cancellation by client',
                    } as any)
                    .eq('id', appointmentToCancel.id);

                if (error) throw error;

                // Notify master
                await notifyMasterOfCancellation(appointmentToCancel, false);

                Alert.alert('Appointment Canceled', 'Your appointment has been canceled successfully.');
            }

            setAppointmentToCancel(null);
            setIsLateCancellation(false);
            fetchAppointments();
        } catch (error: any) {
            Alert.alert('Error', error.message);
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
            Alert.alert('Error', 'Please select a new date and time');
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
                Alert.alert('Request Sent', 'This is a late reschedule. Your request has been sent to the master for approval.');
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
                Alert.alert('Success', 'Your appointment has been rescheduled.');
            }

            setShowRescheduleModal(false);
            fetchAppointments();
        } catch (error: any) {
            Alert.alert('Error', error.message);
        } finally {
            setRescheduleLoading(false);
        }
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

            navigation.navigate('Chat', {
                conversationId,
                otherUser: { full_name: appointment.master?.full_name },
            });
        } catch (error: any) {
            Alert.alert('Error', error.message);
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
        reschedule_pending: { bg: 'rgba(139, 92, 246, 0.15)', text: colors.primary },
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

                {/* Sub Tabs (Only for Appointments) */}
                <View style={styles.subTabs}>
                    <TouchableOpacity
                        style={[styles.subTab, subTab === 'upcoming' && styles.subTabActive]}
                        onPress={() => setSubTab('upcoming')}
                    >
                        <Text style={[styles.subTabText, subTab === 'upcoming' && styles.subTabTextActive]}>
                            Upcoming ({upcomingAppointments.length})
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.subTab, subTab === 'past' && styles.subTabActive]}
                        onPress={() => setSubTab('past')}
                    >
                        <Text style={[styles.subTabText, subTab === 'past' && styles.subTabTextActive]}>
                            Past ({pastAppointments.length})
                        </Text>
                    </TouchableOpacity>
                </View>

                <ScrollView
                    contentContainerStyle={styles.content}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} />
                    }
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
                                            <Text style={styles.detailIcon}>📅</Text>
                                            <Text style={styles.detailText}>
                                                {format(date, 'EEEE, MMMM d, yyyy')}
                                            </Text>
                                        </View>
                                        <View style={styles.detailRow}>
                                            <Text style={styles.detailIcon}>🕐</Text>
                                            <Text style={styles.detailText}>
                                                {format(date, 'HH:mm')} • {apt.service?.duration_minutes || 60} min
                                            </Text>
                                        </View>
                                    </View>

                                    <View style={styles.cardFooter}>
                                        <Text style={styles.price}>€{apt.price}</Text>
                                        {canModify && (
                                            <View style={styles.actionButtons}>
                                                <TouchableOpacity
                                                    style={styles.chatButton}
                                                    onPress={() => handleChat(apt)}
                                                >
                                                    <Text style={styles.chatButtonText}>💬</Text>
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
                            <Text style={styles.emptyIcon}>
                                {subTab === 'upcoming' ? '📅' : '📋'}
                            </Text>
                            <Text style={styles.emptyText}>
                                {subTab === 'upcoming' ? 'No upcoming appointments' : 'No past appointments'}
                            </Text>
                            {subTab === 'upcoming' && (
                                <Button
                                    title="Book Appointment"
                                    onPress={() => navigation.navigate('BookNew')}
                                    style={{ marginTop: spacing.md, width: '50%', alignSelf: 'center' }}
                                />
                            )}
                        </View>
                    )}
                </ScrollView>
            </SafeAreaView>

            {/* Modals */}
            <Modal
                visible={!!appointmentToCancel}
                animationType="fade"
                transparent={true}
                onRequestClose={() => setAppointmentToCancel(null)}
            >
                <View style={styles.overlayContainer}>
                    <TouchableOpacity
                        style={styles.backdrop}
                        activeOpacity={1}
                        onPress={() => setAppointmentToCancel(null)}
                    />
                    <View style={styles.dialogContainer}>
                        <Text style={styles.dialogTitle}>Cancel Appointment</Text>
                        <Text style={styles.dialogMessage}>
                            {isLateCancellation && appointmentToCancel
                                ? `You are canceling within ${CANCELLATION_WINDOW_HOURS} hours of your appointment. Per our policy, you will be charged ${LATE_CANCEL_FEE_PERCENTAGE}% (€${calculatePenaltyFee(appointmentToCancel.price).toFixed(2)}).`
                                : 'Are you sure you want to cancel this appointment?'}
                        </Text>
                        {isLateCancellation && (
                            <View style={styles.warningBox}>
                                <Text style={styles.warningText}>⚠️ Late cancellation fee applies</Text>
                            </View>
                        )}
                        <View style={styles.dialogButtons}>
                            <TouchableOpacity
                                style={styles.dialogButtonCancel}
                                onPress={() => {
                                    setAppointmentToCancel(null);
                                    setIsLateCancellation(false);
                                }}
                                disabled={cancellationLoading}
                            >
                                <Text style={styles.dialogButtonCancelText}>No, Keep it</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.dialogButtonConfirm}
                                onPress={confirmCancel}
                                disabled={cancellationLoading}
                            >
                                <Text style={styles.dialogButtonConfirmText}>
                                    {cancellationLoading ? 'Processing...' : (isLateCancellation ? 'Cancel & Pay Fee' : 'Yes, Cancel')}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

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
        </ScreenBackground>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        padding: spacing.lg,
        paddingBottom: 100,
    },
    subTabs: {
        flexDirection: 'row',
        paddingHorizontal: spacing.lg,
        marginTop: spacing.md,
        borderRadius: 12,
        backgroundColor: colors.surface, // Dark background
        marginHorizontal: spacing.lg,
        padding: 4,
        borderWidth: 1,
        borderColor: colors.border,
    },
    subTab: {
        flex: 1,
        paddingVertical: 8,
        alignItems: 'center',
        borderRadius: 10,
    },
    subTabActive: {
        backgroundColor: colors.primary, // Pop with primary color
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    subTabText: {
        fontSize: 13,
        fontWeight: '500',
        color: colors.textSecondary,
    },
    subTabTextActive: {
        color: '#FFFFFF',
        fontWeight: '600',
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
        fontSize: 14,
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
    emptyIcon: {
        fontSize: 48,
        marginBottom: spacing.md,
        opacity: 0.5,
    },
    emptyText: {
        fontSize: 16,
        color: colors.textSecondary,
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
});
