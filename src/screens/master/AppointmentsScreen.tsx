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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format, isToday, isTomorrow, parseISO, addDays, isSameDay } from 'date-fns';
import { Modal } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Card, Button, ScreenBackground } from '../../components/ui';
import { colors, spacing } from '../../theme';

type Appointment = {
    id: string;
    start_time: string;
    end_time: string;
    status: string;
    price: number;
    notes: string | null;
    proposed_start_time: string | null;
    proposed_end_time: string | null;
    stripe_payment_intent_id: string | null;
    reschedule_initiated_by: string | null;
    service: { name: string; duration_minutes: number } | null;
    client: { full_name: string; phone: string | null; push_token?: string } | null;
};

export function MasterAppointmentsScreen() {
    const { user } = useAuth();
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');

    // Reschedule State
    const [showRescheduleModal, setShowRescheduleModal] = useState(false);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [selectedTime, setSelectedTime] = useState<string | null>(null);
    const [rescheduleLoading, setRescheduleLoading] = useState(false);
    const [appointmentToReschedule, setAppointmentToReschedule] = useState<Appointment | null>(null);

    // Generate next 14 days
    const availableDates = Array.from({ length: 14 }, (_, i) => addDays(new Date(), i + 1));
    const timeSlots = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'];

    useEffect(() => {
        fetchAppointments();
    }, []);

    const fetchAppointments = async () => {
        if (!user) return;

        try {
            const { data, error } = await supabase
                .from('appointments')
                .select(`
                    id,
                    start_time,
                    end_time,
                    status,
                    price,
                    notes,
                    proposed_start_time,
                    proposed_end_time,
                    stripe_payment_intent_id,
                    reschedule_initiated_by,
                    service:services(name, duration_minutes),
                    client:profiles!appointments_client_id_fkey(full_name, phone, push_token)
                `)
                .eq('master_id', user.id)
                .order('start_time', { ascending: true });

            if (error) throw error;

            // Filter out appointments with null service or client (orphaned data)
            const validAppointments = ((data as unknown as Appointment[]) || []).filter(
                apt => apt.service !== null && apt.client !== null
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

    const updateAppointmentStatus = async (appointmentId: string, newStatus: string) => {
        try {
            const { error } = await supabase
                .from('appointments')
                .update({ status: newStatus as any })
                .eq('id', appointmentId);

            if (error) throw error;
            fetchAppointments();
            Alert.alert('Success', `Appointment ${newStatus}`);
        } catch (error: any) {
            Alert.alert('Error', error.message);
        }
    };

    const handleConfirm = (id: string) => {
        Alert.alert('Confirm Appointment', 'Accept this booking?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Confirm', onPress: () => updateAppointmentStatus(id, 'confirmed') },
        ]);
    };

    const handleDecline = (id: string) => {
        Alert.alert('Decline Appointment', 'Are you sure you want to decline?', [
            { text: 'No', style: 'cancel' },
            { text: 'Yes, Decline', style: 'destructive', onPress: () => updateAppointmentStatus(id, 'cancelled') },
        ]);
    };

    const handleComplete = (id: string) => {
        Alert.alert('Complete Appointment', 'Mark this appointment as completed?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Complete', onPress: async () => {
                    // Capture the payment on completion
                    const apt = appointments.find(a => a.id === id);
                    if (apt?.stripe_payment_intent_id) {
                        try {
                            const { error } = await supabase.functions.invoke('capture-payment', {
                                body: { payment_intent_id: apt.stripe_payment_intent_id }
                            });
                            if (error) console.error('Payment capture error:', error);
                        } catch (e) {
                            console.error('Failed to capture payment:', e);
                        }
                    }
                    updateAppointmentStatus(id, 'completed');
                }
            },
        ]);
    };

    const handleNoShowAppointment = (apt: Appointment) => {
        Alert.alert(
            'Mark as No-Show',
            `Client didn't show up? This will charge their card €${apt.price.toFixed(2)} as a no-show fee.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Charge No-Show Fee',
                    style: 'destructive',
                    onPress: async () => {
                        if (!apt.stripe_payment_intent_id) {
                            Alert.alert('Error', 'No payment authorization found for this appointment');
                            return;
                        }
                        try {
                            const { data, error } = await supabase.functions.invoke('handle-no-show', {
                                body: {
                                    appointment_id: apt.id,
                                    payment_intent_id: apt.stripe_payment_intent_id,
                                    no_show_fee_percentage: 100, // Charge full amount
                                }
                            });
                            if (error) throw error;

                            // Update appointment status
                            await supabase
                                .from('appointments')
                                .update({ status: 'no_show' } as any)
                                .eq('id', apt.id);

                            // Send notification to client
                            const clientPushToken = apt.client?.push_token;
                            if (clientPushToken) {
                                await fetch('https://exp.host/--/api/v2/push/send', {
                                    method: 'POST',
                                    headers: {
                                        'Accept': 'application/json',
                                        'Content-Type': 'application/json',
                                    },
                                    body: JSON.stringify({
                                        to: clientPushToken,
                                        sound: 'default',
                                        title: 'No-Show Fee Charged',
                                        body: `You were charged €${apt.price.toFixed(2)} for missing your appointment.`,
                                        data: { appointmentId: apt.id },
                                    }),
                                });
                            }

                            Alert.alert('No-Show Recorded', `€${apt.price.toFixed(2)} has been charged to the client.`);
                            fetchAppointments();
                        } catch (error: any) {
                            Alert.alert('Error', error.message || 'Failed to process no-show charge');
                        }
                    },
                },
            ]
        );
    };

    const handleApproveCancellation = (id: string) => {
        // No longer needed - cancellations are now automatic
        // This function is kept for backwards compatibility if there are legacy pending_cancellation statuses
        Alert.alert('Approve Cancellation', 'Accept this cancellation request?', [
            { text: 'No', style: 'cancel' },
            { text: 'Yes, Cancel', style: 'destructive', onPress: () => updateAppointmentStatus(id, 'cancelled_free') },
        ]);
    };

    const handleRejectCancellation = (id: string) => {
        // Legacy function - kept for backwards compatibility
        Alert.alert('Reject Cancellation', 'Keep this appointment as confirmed?', [
            { text: 'No', style: 'cancel' },
            { text: 'Yes, Keep', onPress: () => updateAppointmentStatus(id, 'confirmed') },
        ]);
    };

    const handleApproveReschedule = async (apt: Appointment) => {
        if (!apt.proposed_start_time || !apt.proposed_end_time) return;

        Alert.alert('Approve Reschedule', `Accept new time: ${format(new Date(apt.proposed_start_time), 'MMM d, HH:mm')}?`, [
            { text: 'No', style: 'cancel' },
            {
                text: 'Yes, Approve', onPress: async () => {
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
                        fetchAppointments();
                        Alert.alert('Success', 'Reschedule approved');
                    } catch (error: any) {
                        Alert.alert('Error', error.message);
                    }
                }
            },
        ]);
    };

    const handleRejectReschedule = (id: string) => {
        Alert.alert('Reject Reschedule', 'Keep the original time?', [
            { text: 'No', style: 'cancel' },
            {
                text: 'Yes, Keep Original', onPress: async () => {
                    try {
                        const { error } = await supabase
                            .from('appointments')
                            .update({
                                proposed_start_time: null,
                                proposed_end_time: null,
                                reschedule_initiated_by: null,
                                status: 'confirmed',
                            } as any)
                            .eq('id', id);

                        if (error) throw error;
                        fetchAppointments();
                        Alert.alert('Success', 'Kept original time');
                    } catch (error: any) {
                        Alert.alert('Error', error.message);
                    }
                }
            },
        ]);
    };

    // Owner/Master initiated cancel
    const handleCancelAppointment = (id: string) => {
        Alert.alert(
            'Cancel Appointment',
            'Are you sure you want to cancel this appointment? The client will be notified.',
            [
                { text: 'No, Keep It', style: 'cancel' },
                {
                    text: 'Yes, Cancel',
                    style: 'destructive',
                    onPress: () => updateAppointmentStatus(id, 'cancelled'),
                },
            ]
        );
    };

    // Owner/Master initiated reschedule
    const handleRescheduleAppointment = (apt: Appointment) => {
        setAppointmentToReschedule(apt);
        setSelectedDate(null);
        setSelectedTime(null);
        setShowRescheduleModal(true);
    };

    const confirmReschedule = async () => {
        if (!appointmentToReschedule || !selectedDate || !selectedTime) {
            Alert.alert('Error', 'Please select a new date and time');
            return;
        }

        setRescheduleLoading(true);
        try {
            const [hours, minutes] = selectedTime.split(':').map(Number);
            const newStartTime = new Date(selectedDate);
            newStartTime.setHours(hours, minutes, 0, 0);

            const duration = appointmentToReschedule.service?.duration_minutes || 60;
            const newEndTime = new Date(newStartTime.getTime() + duration * 60000);

            // Update Appointment
            const { error } = await supabase
                .from('appointments')
                .update({
                    proposed_start_time: newStartTime.toISOString(),
                    proposed_end_time: newEndTime.toISOString(),
                    status: 'pending_reschedule',
                    reschedule_initiated_by: user?.id,
                } as any)
                .eq('id', appointmentToReschedule.id);

            if (error) throw error;

            // Send Push Notification to Client
            const clientPushToken = (appointmentToReschedule as any).client?.push_token;
            if (clientPushToken) {
                await fetch('https://exp.host/--/api/v2/push/send', {
                    method: 'POST',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        to: clientPushToken,
                        sound: 'default',
                        title: 'Reschedule Request',
                        body: `Master ${user?.user_metadata?.full_name || ''} proposed a new time for your appointment.`,
                        data: { appointmentId: appointmentToReschedule.id },
                    }),
                });
            }

            Alert.alert('Request Sent', 'Reschedule request sent to client.');
            setShowRescheduleModal(false);
            fetchAppointments();
        } catch (error: any) {
            Alert.alert('Error', error.message);
        } finally {
            setRescheduleLoading(false);
        }
    };

    const now = new Date();
    // Instant Book: No more pending tab - appointments are confirmed immediately
    // Only show reschedule requests that need approval
    const rescheduleRequests = appointments.filter(apt =>
        apt.status === 'reschedule_pending' || apt.status === 'pending_reschedule'
    );
    const upcomingAppointments = appointments.filter(
        apt => new Date(apt.start_time) >= now && apt.status === 'confirmed'
    );
    const pastAppointments = appointments.filter(
        apt => new Date(apt.start_time) < now || apt.status === 'completed' || apt.status === 'cancelled' || apt.status === 'cancelled_free' || apt.status === 'cancelled_charge'
    );

    const getDisplayedAppointments = () => {
        switch (activeTab) {
            case 'upcoming': return [...rescheduleRequests, ...upcomingAppointments];
            case 'past': return pastAppointments;
        }
    };

    const formatDateLabel = (dateStr: string) => {
        const date = parseISO(dateStr);
        if (isToday(date)) return 'Today';
        if (isTomorrow(date)) return 'Tomorrow';
        return format(date, 'EEEE, MMM d');
    };

    if (loading) {
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
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={styles.header}>
                    <Text style={styles.title}>Appointments</Text>
                </View>

                {/* Tabs - Instant Book: Only Upcoming and Past */}
                <View style={styles.tabs}>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'upcoming' && styles.tabActive]}
                        onPress={() => setActiveTab('upcoming')}
                    >
                        <Text style={[styles.tabText, activeTab === 'upcoming' && styles.tabTextActive]}>
                            Upcoming {rescheduleRequests.length > 0 ? `(${rescheduleRequests.length} pending)` : ''}
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'past' && styles.tabActive]}
                        onPress={() => setActiveTab('past')}
                    >
                        <Text style={[styles.tabText, activeTab === 'past' && styles.tabTextActive]}>
                            Past
                        </Text>
                    </TouchableOpacity>
                </View>

                <ScrollView
                    contentContainerStyle={styles.content}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} />
                    }
                >
                    {getDisplayedAppointments().length > 0 ? (
                        getDisplayedAppointments().map((apt) => {
                            const date = new Date(apt.start_time);

                            return (
                                <Card key={apt.id} style={styles.appointmentCard}>
                                    <View style={styles.dateHeader}>
                                        <Text style={styles.dateLabel}>{formatDateLabel(apt.start_time)}</Text>
                                        <Text style={styles.timeLabel}>{format(date, 'HH:mm')}</Text>
                                    </View>

                                    <View style={styles.appointmentBody}>
                                        <Text style={styles.serviceName}>{apt.service?.name || 'Service'}</Text>
                                        <Text style={styles.clientName}>{apt.client?.full_name || 'Client'}</Text>
                                        {apt.client?.phone && (
                                            <Text style={styles.clientPhone}>📞 {apt.client.phone}</Text>
                                        )}
                                        {apt.notes && (
                                            <Text style={styles.notes}>📝 {apt.notes}</Text>
                                        )}
                                    </View>

                                    <View style={styles.appointmentFooter}>
                                        <Text style={styles.price}>€{apt.price}</Text>
                                        <Text style={styles.duration}>{apt.service?.duration_minutes} min</Text>
                                    </View>


                                    {/* Instant Book: No pending status - appointments are confirmed immediately */}

                                    {/* Legacy: Show pending_cancellation UI if there are old records */}
                                    {apt.status === 'pending_cancellation' && (
                                        <View>
                                            <View style={styles.requestBadge}>
                                                <Text style={styles.requestBadgeText}>🚫 Legacy Cancellation Request</Text>
                                            </View>
                                            <View style={styles.actionButtons}>
                                                <TouchableOpacity
                                                    style={styles.declineButton}
                                                    onPress={() => handleRejectCancellation(apt.id)}
                                                >
                                                    <Text style={styles.declineButtonText}>Reject</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    style={[styles.confirmButton, { backgroundColor: '#EF4444' }]}
                                                    onPress={() => handleApproveCancellation(apt.id)}
                                                >
                                                    <Text style={styles.confirmButtonText}>Approve Cancel</Text>
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    )}

                                    {/* Show approve/reject for client-initiated late reschedules */}
                                    {(apt.status === 'pending_reschedule' || apt.status === 'reschedule_pending') && apt.proposed_start_time && apt.reschedule_initiated_by !== user?.id && (
                                        <View>
                                            <View style={styles.requestBadge}>
                                                <Text style={styles.requestBadgeText}>📅 Reschedule Request</Text>
                                            </View>
                                            <View style={styles.proposedTime}>
                                                <Text style={styles.proposedTimeLabel}>Proposed new time:</Text>
                                                <Text style={styles.proposedTimeValue}>
                                                    {format(new Date(apt.proposed_start_time), 'EEEE, MMM d \'at\' HH:mm')}
                                                </Text>
                                            </View>
                                            <View style={styles.actionButtons}>
                                                <TouchableOpacity
                                                    style={styles.declineButton}
                                                    onPress={() => handleRejectReschedule(apt.id)}
                                                >
                                                    <Text style={styles.declineButtonText}>Keep Original</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    style={styles.confirmButton}
                                                    onPress={() => handleApproveReschedule(apt)}
                                                >
                                                    <Text style={styles.confirmButtonText}>Approve</Text>
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    )}

                                    {apt.status === 'confirmed' && new Date(apt.start_time) > now && (
                                        <View style={styles.actionButtons}>
                                            <TouchableOpacity
                                                style={styles.declineButton}
                                                onPress={() => handleCancelAppointment(apt.id)}
                                            >
                                                <Text style={styles.declineButtonText}>Cancel</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={[styles.confirmButton, { backgroundColor: colors.primary }]}
                                                onPress={() => handleRescheduleAppointment(apt)}
                                            >
                                                <Text style={styles.confirmButtonText}>Reschedule</Text>
                                            </TouchableOpacity>
                                        </View>
                                    )}

                                    {apt.status === 'confirmed' && new Date(apt.start_time) <= now && (
                                        <View style={styles.actionButtons}>
                                            <TouchableOpacity
                                                style={styles.completeButton}
                                                onPress={() => handleComplete(apt.id)}
                                            >
                                                <Text style={styles.completeButtonText}>Complete</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={[styles.declineButton, { flex: 1, backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: '#EF4444' }]}
                                                onPress={() => handleNoShowAppointment(apt)}
                                            >
                                                <Text style={[styles.declineButtonText, { color: '#EF4444' }]}>No-Show</Text>
                                            </TouchableOpacity>
                                        </View>
                                    )}
                                </Card>
                            );
                        })
                    ) : (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyIcon}>📅</Text>
                            <Text style={styles.emptyText}>
                                {activeTab === 'upcoming' ? 'No upcoming appointments' : 'No past appointments'}
                            </Text>
                        </View>
                    )}
                </ScrollView>
            </SafeAreaView>

            {/* Reschedule Modal */}
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
                                            styles.timeText,
                                            selectedTime === time && styles.timeTextActive,
                                        ]}>
                                            {time}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <Button
                                title={rescheduleLoading ? 'Updating...' : 'Propose New Time'}
                                onPress={confirmReschedule}
                                fullWidth
                                disabled={!selectedDate || !selectedTime || rescheduleLoading}
                            />
                        </ScrollView>
                    </ScreenBackground>
                </SafeAreaView>
            </Modal>
        </ScreenBackground>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.md },
    title: { fontSize: 28, fontWeight: '600', color: colors.text },

    // Modal & Picker Styles
    modalContainer: { flex: 1 },
    modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
    modalCancel: { color: colors.textSecondary, fontSize: 16 },
    modalTitle: { fontSize: 18, fontWeight: '600', color: colors.text },
    modalContent: { padding: spacing.lg },
    sectionTitle: { fontSize: 14, fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: spacing.md },
    datesRow: { marginBottom: spacing.xl },
    dateCard: { width: 64, padding: spacing.md, alignItems: 'center', borderRadius: 16, backgroundColor: colors.surface, marginRight: spacing.sm, borderWidth: 1, borderColor: colors.border },
    dateCardActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    dateDayName: { fontSize: 12, color: colors.textSecondary, marginBottom: spacing.xs },
    dateDay: { fontSize: 20, fontWeight: '600', color: colors.text },
    dateTextActive: { color: colors.text },
    timesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.xl },
    timeSlot: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
    timeSlotActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    timeText: { fontSize: 14, fontWeight: '500', color: colors.text },
    timeTextActive: { color: colors.text },
    tabs: { flexDirection: 'row', paddingHorizontal: spacing.lg, marginBottom: spacing.md },
    tab: { flex: 1, paddingVertical: spacing.md, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
    tabActive: { borderBottomColor: colors.text },
    tabText: { fontSize: 13, fontWeight: '500', color: colors.textSecondary },
    tabTextActive: { color: colors.text },
    content: { padding: spacing.lg },
    appointmentCard: { marginBottom: spacing.md, padding: spacing.lg },
    dateHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.md, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
    dateLabel: { fontSize: 14, fontWeight: '600', color: colors.text },
    timeLabel: { fontSize: 16, fontWeight: '700', color: colors.text },
    appointmentBody: { marginBottom: spacing.md },
    serviceName: { fontSize: 18, fontWeight: '600', color: colors.text, marginBottom: spacing.xs },
    clientName: { fontSize: 14, color: colors.textSecondary, marginBottom: spacing.xs },
    clientPhone: { fontSize: 13, color: colors.textMuted, marginBottom: spacing.xs },
    notes: { fontSize: 13, color: colors.textMuted, fontStyle: 'italic' },
    appointmentFooter: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
    price: { fontSize: 20, fontWeight: '700', color: colors.text },
    duration: { fontSize: 14, color: colors.textSecondary },
    actionButtons: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
    declineButton: { flex: 1, paddingVertical: spacing.md, borderRadius: 8, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
    declineButtonText: { color: colors.textSecondary, fontWeight: '500' },
    confirmButton: { flex: 1, paddingVertical: spacing.md, borderRadius: 8, backgroundColor: colors.text, alignItems: 'center' },
    confirmButtonText: { color: colors.background, fontWeight: '600' },
    completeButton: { flex: 1, paddingVertical: spacing.md, borderRadius: 8, backgroundColor: '#22C55E', alignItems: 'center' },
    completeButtonText: { color: 'white', fontWeight: '600' },
    emptyState: { alignItems: 'center', paddingVertical: spacing.xxxl },
    emptyIcon: { fontSize: 64, marginBottom: spacing.lg, opacity: 0.5 },
    emptyText: { fontSize: 16, color: colors.textSecondary },
    requestBadge: { backgroundColor: 'rgba(139, 92, 246, 0.15)', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 8, marginTop: spacing.md, alignItems: 'center' },
    requestBadgeText: { fontSize: 14, fontWeight: '600', color: colors.primary },
    proposedTime: { backgroundColor: colors.surface, padding: spacing.md, borderRadius: 8, marginTop: spacing.sm },
    proposedTimeLabel: { fontSize: 12, color: colors.textMuted, marginBottom: spacing.xs },
    proposedTimeValue: { fontSize: 16, fontWeight: '600', color: colors.text },
});

export default MasterAppointmentsScreen;
