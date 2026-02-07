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
import { LinearGradient } from 'expo-linear-gradient';
import { format, isToday, isTomorrow, parseISO, addDays, isSameDay } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Card, Button, ScreenBackground, MerakiModal, MerakiModalProps } from '../../components/ui';
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
    confirmation_deadline: string | null;
    confirmation: { confirmed: boolean | null; confirmed_at: string | null } | null;
    service: { name: string; duration_minutes: number } | null;
    client: { full_name: string; phone: string | null; push_token?: string } | null;
    deposit_amount?: number | null;
    deposit_paid?: boolean | null;
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

    // Modal State
    const [modalConfig, setModalConfig] = useState<MerakiModalProps>({
        visible: false,
        title: '',
        onClose: () => setModalConfig(prev => ({ ...prev, visible: false })),
    });

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
                    deposit_amount,
                    deposit_paid,
                    reschedule_initiated_by,
                    confirmation_deadline,
                    service:services(name, duration_minutes),
                    client:profiles!appointments_client_id_fkey(full_name, phone, push_token),
                    confirmation:appointment_confirmations(confirmed, confirmed_at)
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
            setModalConfig({
                visible: true,
                title: 'Success',
                message: `Appointment ${newStatus}`,
                type: 'success',
                onClose: () => setModalConfig(prev => ({ ...prev, visible: false })),
                confirmText: 'OK',
                hideCancel: true
            });
        } catch (error: any) {
            setModalConfig({
                visible: true,
                title: 'Error',
                message: error.message,
                type: 'error',
                onClose: () => setModalConfig(prev => ({ ...prev, visible: false })),
                confirmText: 'OK',
                hideCancel: true
            });
        }
    };

    const handleConfirm = (id: string) => {
        setModalConfig({
            visible: true,
            title: 'Confirm Appointment',
            message: 'Accept this booking?',
            confirmText: 'Confirm',
            type: 'info',
            onClose: () => setModalConfig(prev => ({ ...prev, visible: false })),
            onConfirm: () => {
                updateAppointmentStatus(id, 'confirmed');
                setModalConfig(prev => ({ ...prev, visible: false }));
            }
        });
    };

    const handleDecline = (id: string) => {
        setModalConfig({
            visible: true,
            title: 'Decline Appointment',
            message: 'Are you sure you want to decline?',
            confirmText: 'Yes, Decline',
            confirmDestructive: true,
            type: 'warning',
            onClose: () => setModalConfig(prev => ({ ...prev, visible: false })),
            onConfirm: () => {
                updateAppointmentStatus(id, 'cancelled');
                setModalConfig(prev => ({ ...prev, visible: false }));
            }
        });
    };

    const handleComplete = (id: string) => {
        setModalConfig({
            visible: true,
            title: 'Complete Appointment',
            message: 'Mark this appointment as completed?',
            confirmText: 'Complete',
            type: 'success',
            onClose: () => setModalConfig(prev => ({ ...prev, visible: false })),
            onConfirm: async () => {
                setModalConfig(prev => ({ ...prev, visible: false })); // Close modal first
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
        });
    };



    const handleApproveCancellation = (id: string) => {
        // No longer needed - cancellations are now automatic
        // This function is kept for backwards compatibility if there are legacy pending_cancellation statuses
        setModalConfig({
            visible: true,
            title: 'Approve Cancellation',
            message: 'Accept this cancellation request?',
            confirmText: 'Yes, Cancel',
            confirmDestructive: true,
            type: 'warning',
            onClose: () => setModalConfig(prev => ({ ...prev, visible: false })),
            onConfirm: () => {
                updateAppointmentStatus(id, 'cancelled_free');
                setModalConfig(prev => ({ ...prev, visible: false }));
            }
        });
    };

    const handleRejectCancellation = (id: string) => {
        // Legacy function - kept for backwards compatibility
        setModalConfig({
            visible: true,
            title: 'Reject Cancellation',
            message: 'Keep this appointment as confirmed?',
            confirmText: 'Yes, Keep',
            type: 'info',
            onClose: () => setModalConfig(prev => ({ ...prev, visible: false })),
            onConfirm: () => {
                updateAppointmentStatus(id, 'confirmed');
                setModalConfig(prev => ({ ...prev, visible: false }));
            }
        });
    };

    const handleApproveReschedule = async (apt: Appointment) => {
        if (!apt.proposed_start_time || !apt.proposed_end_time) return;

        setModalConfig({
            visible: true,
            title: 'Approve Reschedule',
            message: `Accept new time: ${format(new Date(apt.proposed_start_time), 'MMM d, HH:mm')}?`,
            confirmText: 'Yes, Approve',
            type: 'info',
            onClose: () => setModalConfig(prev => ({ ...prev, visible: false })),
            onConfirm: async () => {
                setModalConfig(prev => ({ ...prev, visible: false }));
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
                    setModalConfig({
                        visible: true,
                        title: 'Success',
                        message: 'Reschedule approved',
                        type: 'success',
                        onClose: () => setModalConfig(prev => ({ ...prev, visible: false })),
                        confirmText: 'OK',
                        hideCancel: true
                    });
                } catch (error: any) {
                    setModalConfig({
                        visible: true,
                        title: 'Error',
                        message: error.message,
                        type: 'error',
                        onClose: () => setModalConfig(prev => ({ ...prev, visible: false })),
                        confirmText: 'OK',
                        hideCancel: true
                    });
                }
            }
        });
    };

    const handleRejectReschedule = (id: string) => {
        setModalConfig({
            visible: true,
            title: 'Reject Reschedule',
            message: 'Keep the original time?',
            confirmText: 'Yes, Keep Original',
            type: 'info',
            onClose: () => setModalConfig(prev => ({ ...prev, visible: false })),
            onConfirm: async () => {
                setModalConfig(prev => ({ ...prev, visible: false }));
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
                    setModalConfig({
                        visible: true,
                        title: 'Success',
                        message: 'Kept original time',
                        type: 'success',
                        onClose: () => setModalConfig(prev => ({ ...prev, visible: false })),
                        confirmText: 'OK',
                        hideCancel: true
                    });
                } catch (error: any) {
                    setModalConfig({
                        visible: true,
                        title: 'Error',
                        message: error.message,
                        type: 'error',
                        onClose: () => setModalConfig(prev => ({ ...prev, visible: false })),
                        confirmText: 'OK',
                        hideCancel: true
                    });
                }
            }
        });
    };

    // Owner/Master initiated cancel
    const handleCancelAppointment = (id: string) => {
        setModalConfig({
            visible: true,
            title: 'Cancel Appointment',
            message: 'Are you sure you want to cancel this appointment? The client will be notified.',
            confirmText: 'Yes, Cancel',
            confirmDestructive: true,
            type: 'warning',
            onClose: () => setModalConfig(prev => ({ ...prev, visible: false })),
            onConfirm: () => {
                updateAppointmentStatus(id, 'cancelled');
                setModalConfig(prev => ({ ...prev, visible: false }));
            }
        });
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
            setModalConfig({
                visible: true,
                title: 'Error',
                message: 'Please select a new date and time',
                type: 'error',
                onClose: () => setModalConfig(prev => ({ ...prev, visible: false })),
                confirmText: 'OK',
                hideCancel: true
            });
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

            setShowRescheduleModal(false);
            fetchAppointments();
            setModalConfig({
                visible: true,
                title: 'Request Sent',
                message: 'Reschedule request sent to client.',
                type: 'success',
                onClose: () => setModalConfig(prev => ({ ...prev, visible: false })),
                confirmText: 'OK',
                hideCancel: true
            });
        } catch (error: any) {
            setModalConfig({
                visible: true,
                title: 'Error',
                message: error.message,
                type: 'error',
                onClose: () => setModalConfig(prev => ({ ...prev, visible: false })),
                confirmText: 'OK',
                hideCancel: true
            });
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

    // Get status accent color
    const getStatusAccent = (status: string) => {
        switch (status) {
            case 'confirmed': return ['#22C55E', '#16A34A'];
            case 'pending_reschedule':
            case 'reschedule_pending': return [colors.primary, colors.secondary];
            case 'awaiting_confirmation': return ['#F59E0B', '#D97706'];
            case 'completed': return ['#6366F1', '#4F46E5'];
            case 'cancelled':
            case 'cancelled_free':
            case 'cancelled_charge': return ['#EF4444', '#DC2626'];
            default: return [colors.primary, colors.primaryDark];
        }
    };

    return (
        <ScreenBackground>
            <SafeAreaView style={styles.container} edges={['top']}>
                {/* Premium Header */}
                <View style={styles.header}>
                    <Text style={styles.title}>Appointments</Text>
                    <Text style={styles.subtitle}>
                        {upcomingAppointments.length} upcoming • {pastAppointments.length} completed
                    </Text>
                </View>

                {/* Premium Pill-Style Tabs */}
                <View style={styles.tabsContainer}>
                    <View style={styles.tabs}>
                        <TouchableOpacity
                            style={[styles.tab, activeTab === 'upcoming' && styles.tabActive]}
                            onPress={() => setActiveTab('upcoming')}
                        >
                            {activeTab === 'upcoming' && (
                                <LinearGradient
                                    colors={[colors.primary, colors.secondary]}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={styles.tabGradient}
                                />
                            )}
                            <Text style={[styles.tabText, activeTab === 'upcoming' && styles.tabTextActive]}>
                                Upcoming {rescheduleRequests.length > 0 ? `(${rescheduleRequests.length})` : ''}
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.tab, activeTab === 'past' && styles.tabActive]}
                            onPress={() => setActiveTab('past')}
                        >
                            {activeTab === 'past' && (
                                <LinearGradient
                                    colors={[colors.primary, colors.secondary]}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={styles.tabGradient}
                                />
                            )}
                            <Text style={[styles.tabText, activeTab === 'past' && styles.tabTextActive]}>
                                Past
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
                    {getDisplayedAppointments().length > 0 ? (
                        getDisplayedAppointments().map((apt) => {
                            const date = new Date(apt.start_time);
                            const accentColors = getStatusAccent(apt.status);

                            return (
                                <Card key={apt.id} style={styles.appointmentCard} variant="glass">
                                    {/* Gradient Accent Border */}
                                    <LinearGradient
                                        colors={accentColors as any}
                                        style={styles.cardAccent}
                                    />

                                    <View style={styles.cardInner}>
                                        {/* Date/Time Header */}
                                        <View style={styles.dateHeader}>
                                            <View style={styles.dateInfo}>
                                                <Text style={styles.dateLabel}>{formatDateLabel(apt.start_time)}</Text>
                                                <View style={styles.timeBadge}>
                                                    <Text style={styles.timeLabel}>{format(date, 'HH:mm')}</Text>
                                                </View>
                                            </View>
                                            <View style={styles.durationBadge}>
                                                <Text style={styles.durationText}>{apt.service?.duration_minutes} min</Text>
                                            </View>
                                        </View>

                                        {/* Service & Client Info */}
                                        <View style={styles.appointmentBody}>
                                            <Text style={styles.serviceName}>{apt.service?.name || 'Service'}</Text>
                                            <View style={styles.clientRow}>
                                                <View style={styles.clientAvatar}>
                                                    <Text style={styles.clientInitial}>
                                                        {apt.client?.full_name?.[0] || '?'}
                                                    </Text>
                                                </View>
                                                <View>
                                                    <Text style={styles.clientName}>{apt.client?.full_name || 'Client'}</Text>
                                                    {apt.client?.phone && (
                                                        <Text style={styles.clientPhone}>{apt.client.phone}</Text>
                                                    )}
                                                </View>
                                            </View>
                                            {apt.notes && (
                                                <View style={styles.notesBox}>
                                                    <Text style={styles.notes}>📝 {apt.notes}</Text>
                                                </View>
                                            )}
                                        </View>

                                        {/* Price Footer */}
                                        <View style={styles.appointmentFooter}>
                                            <View style={styles.priceSection}>
                                                <Text style={styles.priceLabel}>Total</Text>
                                                <Text style={styles.price}>€{apt.price}</Text>
                                            </View>
                                            {apt.deposit_paid && (
                                                <View style={styles.depositInfo}>
                                                    <View style={styles.depositPaid}>
                                                        <Text style={styles.depositPaidText}>✓ Paid: €{apt.deposit_amount}</Text>
                                                    </View>
                                                    <Text style={styles.depositDue}>
                                                        Due: €{(apt.price - (apt.deposit_amount || 0)).toFixed(2)}
                                                    </Text>
                                                </View>
                                            )}
                                        </View>

                                        {/* Status Badge: Awaiting Confirmation */}
                                        {apt.status === 'awaiting_confirmation' && (
                                            <View style={styles.statusSection}>
                                                <LinearGradient
                                                    colors={['rgba(245, 158, 11, 0.1)', 'rgba(217, 119, 6, 0.1)']}
                                                    style={styles.statusGradientBg}
                                                >
                                                    <Text style={styles.awaitingBadgeText}>
                                                        ⏳ Awaiting Client Confirmation
                                                    </Text>
                                                    {apt.confirmation_deadline && (
                                                        <Text style={styles.deadlineText}>
                                                            Confirm by: {format(new Date(apt.confirmation_deadline), 'MMM d, HH:mm')}
                                                        </Text>
                                                    )}
                                                </LinearGradient>
                                            </View>
                                        )}

                                        {/* Status Badge: Confirmed with No-Show Protection */}
                                        {apt.status === 'confirmed' && apt.confirmation?.confirmed && (
                                            <View style={styles.statusSection}>
                                                <LinearGradient
                                                    colors={['rgba(34, 197, 94, 0.1)', 'rgba(22, 163, 74, 0.1)']}
                                                    style={styles.statusGradientBg}
                                                >
                                                    <Text style={styles.confirmedBadgeText}>✅ Confirmed & Protected</Text>
                                                    <Text style={styles.protectionText}>No-show protection active</Text>
                                                </LinearGradient>
                                            </View>
                                        )}

                                        {/* Legacy: Pending Cancellation */}
                                        {apt.status === 'pending_cancellation' && (
                                            <View>
                                                <View style={styles.requestBadge}>
                                                    <Text style={styles.requestBadgeText}>🚫 Cancellation Request</Text>
                                                </View>
                                                <View style={styles.actionButtons}>
                                                    <TouchableOpacity
                                                        style={styles.secondaryButton}
                                                        onPress={() => handleRejectCancellation(apt.id)}
                                                    >
                                                        <Text style={styles.secondaryButtonText}>Reject</Text>
                                                    </TouchableOpacity>
                                                    <TouchableOpacity
                                                        style={styles.dangerButton}
                                                        onPress={() => handleApproveCancellation(apt.id)}
                                                    >
                                                        <Text style={styles.dangerButtonText}>Approve</Text>
                                                    </TouchableOpacity>
                                                </View>
                                            </View>
                                        )}

                                        {/* Reschedule Request */}
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
                                                        style={styles.secondaryButton}
                                                        onPress={() => handleRejectReschedule(apt.id)}
                                                    >
                                                        <Text style={styles.secondaryButtonText}>Keep Original</Text>
                                                    </TouchableOpacity>
                                                    <TouchableOpacity
                                                        style={styles.primaryButton}
                                                        onPress={() => handleApproveReschedule(apt)}
                                                    >
                                                        <LinearGradient
                                                            colors={[colors.primary, colors.secondary]}
                                                            start={{ x: 0, y: 0 }}
                                                            end={{ x: 1, y: 0 }}
                                                            style={styles.buttonGradient}
                                                        >
                                                            <Text style={styles.primaryButtonText}>Approve</Text>
                                                        </LinearGradient>
                                                    </TouchableOpacity>
                                                </View>
                                            </View>
                                        )}

                                        {/* Confirmed - Future */}
                                        {apt.status === 'confirmed' && new Date(apt.start_time) > now && (
                                            <View style={styles.actionButtons}>
                                                <TouchableOpacity
                                                    style={styles.secondaryButton}
                                                    onPress={() => handleCancelAppointment(apt.id)}
                                                >
                                                    <Text style={styles.secondaryButtonText}>Cancel</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    style={styles.primaryButton}
                                                    onPress={() => handleRescheduleAppointment(apt)}
                                                >
                                                    <LinearGradient
                                                        colors={[colors.primary, colors.secondary]}
                                                        start={{ x: 0, y: 0 }}
                                                        end={{ x: 1, y: 0 }}
                                                        style={styles.buttonGradient}
                                                    >
                                                        <Text style={styles.primaryButtonText}>Reschedule</Text>
                                                    </LinearGradient>
                                                </TouchableOpacity>
                                            </View>
                                        )}

                                        {/* Confirmed - Past (needs completion) */}
                                        {apt.status === 'confirmed' && new Date(apt.start_time) <= now && (
                                            <View style={styles.actionButtons}>
                                                <TouchableOpacity
                                                    style={[styles.primaryButton, { flex: 1 }]}
                                                    onPress={() => handleComplete(apt.id)}
                                                >
                                                    <LinearGradient
                                                        colors={['#22C55E', '#16A34A']}
                                                        start={{ x: 0, y: 0 }}
                                                        end={{ x: 1, y: 0 }}
                                                        style={styles.buttonGradient}
                                                    >
                                                        <Text style={styles.primaryButtonText}>✓ Mark Complete</Text>
                                                    </LinearGradient>
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
                                <Text style={styles.emptyIcon}>📅</Text>
                            </View>
                            <Text style={styles.emptyTitle}>
                                {activeTab === 'upcoming' ? 'No Upcoming Appointments' : 'No Past Appointments'}
                            </Text>
                            <Text style={styles.emptyText}>
                                {activeTab === 'upcoming'
                                    ? 'Your schedule is clear. New bookings will appear here.'
                                    : 'Completed appointments will be shown here.'}
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
            <MerakiModal {...modalConfig} />
        </ScreenBackground>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    // Header
    header: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm },
    title: { fontSize: 28, fontWeight: '700', color: colors.text, marginBottom: 4 },
    subtitle: { fontSize: 14, color: colors.textSecondary },

    // Premium Pill Tabs
    tabsContainer: { paddingHorizontal: spacing.lg, marginBottom: spacing.md },
    tabs: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 16,
        padding: 4
    },
    tab: {
        flex: 1,
        paddingVertical: 12,
        alignItems: 'center',
        borderRadius: 12,
        overflow: 'hidden',
    },
    tabActive: {},
    tabGradient: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: 12,
        opacity: 0.9
    },
    tabText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary, zIndex: 1 },
    tabTextActive: { color: '#fff' },

    // Content
    content: { padding: spacing.lg },

    // Appointment Card
    appointmentCard: {
        marginBottom: spacing.md,
        padding: 0,
        overflow: 'hidden',
        borderRadius: 20,
    },
    cardAccent: {
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: 4,
        borderTopLeftRadius: 20,
        borderBottomLeftRadius: 20
    },
    cardInner: { padding: spacing.lg, paddingLeft: spacing.lg + 4 },

    // Date/Time Header
    dateHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.md,
        paddingBottom: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.08)'
    },
    dateInfo: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    dateLabel: { fontSize: 14, fontWeight: '600', color: colors.text },
    timeBadge: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8
    },
    timeLabel: { fontSize: 14, fontWeight: '700', color: colors.text },
    durationBadge: {
        backgroundColor: 'rgba(255,255,255,0.08)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8
    },
    durationText: { fontSize: 12, color: colors.textSecondary, fontWeight: '500' },

    // Body
    appointmentBody: { marginBottom: spacing.md },
    serviceName: { fontSize: 18, fontWeight: '600', color: colors.text, marginBottom: spacing.sm },
    clientRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
    clientAvatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    clientInitial: { fontSize: 16, fontWeight: '600', color: '#fff' },
    clientName: { fontSize: 15, color: colors.text, fontWeight: '500' },
    clientPhone: { fontSize: 13, color: colors.textMuted },
    notesBox: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        padding: spacing.sm,
        borderRadius: 8,
        marginTop: spacing.sm
    },
    notes: { fontSize: 13, color: colors.textMuted, fontStyle: 'italic' },

    // Footer / Price
    appointmentFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        paddingTop: spacing.md,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.08)'
    },
    priceSection: {},
    priceLabel: { fontSize: 12, color: colors.textMuted, marginBottom: 2 },
    price: { fontSize: 22, fontWeight: '700', color: colors.text },
    duration: { fontSize: 14, color: colors.textSecondary },
    depositInfo: { alignItems: 'flex-end' },
    depositPaid: {
        backgroundColor: 'rgba(34, 197, 94, 0.15)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6
    },
    depositPaidText: { fontSize: 12, color: '#22C55E', fontWeight: '600' },
    depositDue: { fontSize: 12, color: '#EF4444', fontWeight: '500', marginTop: 4 },

    // Status Sections
    statusSection: { marginTop: spacing.md },
    statusGradientBg: {
        padding: spacing.md,
        borderRadius: 12,
        alignItems: 'center'
    },
    awaitingBadgeText: { fontSize: 14, fontWeight: '600', color: '#F59E0B' },
    confirmedBadgeText: { fontSize: 14, fontWeight: '600', color: '#22C55E' },
    deadlineText: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
    protectionText: { fontSize: 12, color: '#22C55E', marginTop: 4 },

    // Request Badge
    requestBadge: {
        backgroundColor: 'rgba(139, 92, 246, 0.15)',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: 8,
        marginTop: spacing.md,
        alignItems: 'center'
    },
    requestBadgeText: { fontSize: 14, fontWeight: '600', color: colors.primary },
    proposedTime: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        padding: spacing.md,
        borderRadius: 12,
        marginTop: spacing.sm
    },
    proposedTimeLabel: { fontSize: 12, color: colors.textMuted, marginBottom: 4 },
    proposedTimeValue: { fontSize: 16, fontWeight: '600', color: colors.text },

    // Action Buttons
    actionButtons: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
    primaryButton: {
        flex: 1,
        borderRadius: 12,
        overflow: 'hidden'
    },
    buttonGradient: {
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center'
    },
    primaryButtonText: { color: '#fff', fontWeight: '600', fontSize: 15 },
    secondaryButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)',
    },
    secondaryButtonText: { color: colors.textSecondary, fontWeight: '600', fontSize: 15 },
    dangerButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        backgroundColor: 'rgba(239, 68, 68, 0.15)',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(239, 68, 68, 0.3)',
    },
    dangerButtonText: { color: '#EF4444', fontWeight: '600', fontSize: 15 },

    // Legacy button styles (for backwards compat)
    declineButton: {
        flex: 1,
        paddingVertical: spacing.md,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)',
    },
    declineButtonText: { color: colors.textSecondary, fontWeight: '500' },
    confirmButton: {
        flex: 1,
        paddingVertical: spacing.md,
        borderRadius: 12,
        backgroundColor: colors.text,
        alignItems: 'center'
    },
    confirmButtonText: { color: colors.background, fontWeight: '600' },
    completeButton: {
        flex: 1,
        paddingVertical: spacing.md,
        borderRadius: 12,
        backgroundColor: '#22C55E',
        alignItems: 'center'
    },
    completeButtonText: { color: 'white', fontWeight: '600' },

    // Empty State
    emptyState: { alignItems: 'center', paddingVertical: spacing.xxxl },
    emptyIconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(255,255,255,0.05)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.lg
    },
    emptyIcon: { fontSize: 36 },
    emptyTitle: { fontSize: 18, fontWeight: '600', color: colors.text, marginBottom: spacing.sm },
    emptyText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', paddingHorizontal: spacing.xl },

    // Modal & Picker Styles
    modalContainer: { flex: 1 },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.1)'
    },
    modalCancel: { color: colors.textSecondary, fontSize: 16 },
    modalTitle: { fontSize: 18, fontWeight: '600', color: colors.text },
    modalContent: { padding: spacing.lg },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: spacing.md
    },
    datesRow: { marginBottom: spacing.xl },
    dateCard: {
        width: 64,
        padding: spacing.md,
        alignItems: 'center',
        borderRadius: 16,
        backgroundColor: colors.surface,
        marginRight: spacing.sm,
        borderWidth: 1,
        borderColor: colors.border
    },
    dateCardActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    dateDayName: { fontSize: 12, color: colors.textSecondary, marginBottom: spacing.xs },
    dateDay: { fontSize: 20, fontWeight: '600', color: colors.text },
    dateTextActive: { color: colors.text },
    timesGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
        marginBottom: spacing.xl
    },
    timeSlot: {
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        borderRadius: 12,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border
    },
    timeSlotActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    timeText: { fontSize: 14, fontWeight: '500', color: colors.text },
    timeTextActive: { color: colors.text },

    // Legacy status badges (for backwards compat)
    statusBadgeContainer: { marginTop: spacing.md, alignItems: 'center' },
    statusBadge: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 8, alignItems: 'center' },
    statusBadgeText: { fontSize: 14, fontWeight: '600' },
    awaitingBadge: { backgroundColor: 'rgba(255, 193, 7, 0.15)', borderWidth: 1, borderColor: 'rgba(255, 193, 7, 0.3)' },
    confirmedBadge: { backgroundColor: 'rgba(34, 197, 94, 0.15)', borderWidth: 1, borderColor: 'rgba(34, 197, 94, 0.3)' },
});

export default MasterAppointmentsScreen;
