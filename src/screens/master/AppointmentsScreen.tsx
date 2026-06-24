import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
    View,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    Modal,
    TextInput,
    FlatList,
    Keyboard,
    TouchableWithoutFeedback,
    RefreshControl,
} from 'react-native';
import PagerView from 'react-native-pager-view';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { format, addDays, isSameDay } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { Button, ScreenBackground, MerakiModal, MerakiModalProps, MerakiText } from '../../components/ui';
import { colors, spacing } from '../../theme';
import { cancelAndRefund } from '../../services/stripeService';

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
    service_name: string | null;
    service_category: string | null;
    service: { name: string; duration_minutes: number } | null;
    client: { full_name: string; phone: string | null; push_token?: string } | null;
    deposit_amount?: number | null;
    deposit_paid?: boolean | null;
};

export function MasterAppointmentsScreen() {
    const { user } = useAuth();
    const navigation = useNavigation<any>();
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState<'upcoming' | 'completed'>('upcoming');
    const pagerRef = useRef<PagerView>(null);

    // Search & Filter
    const [searchQuery, setSearchQuery] = useState('');
    const [filterDate, setFilterDate] = useState<Date | null>(null); // If null, show all dates
    const [showDatePicker, setShowDatePicker] = useState(false);

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
                    service_name,
                    service_category,
                    service:services(name, duration_minutes),
                    client:profiles!appointments_client_id_fkey(full_name, phone, push_token),
                    confirmation:appointment_confirmations(confirmed, confirmed_at)
                `)
                .eq('master_id', user.id)
                .order('start_time', { ascending: true });

            if (error) throw error;

            // Filter out appointments with null client (orphaned data)
            const validAppointments = ((data as unknown as Appointment[]) || []).filter(
                apt => apt.client !== null
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

    // Legacy: Accept booking — no longer needed since bookings arrive pre-confirmed.
    // Kept for backward compatibility with any old 'pending'/'awaiting_confirmation' appointments.
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

    // Legacy: Decline booking — no longer needed since bookings arrive pre-confirmed.
    // Kept for backward compatibility with any old 'pending'/'awaiting_confirmation' appointments.
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
                setModalConfig(prev => ({
                    ...prev,
                    title: 'Completing Appointment...',
                    message: 'Capturing payment and finishing...',
                    loading: true,
                    hideCancel: true
                }));
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
            onConfirm: async () => {
                setModalConfig(prev => ({
                    ...prev,
                    title: 'Approving...',
                    message: 'Processing cancellation approval...',
                    loading: true,
                    hideCancel: true
                }));
                await updateAppointmentStatus(id, 'cancelled_free');
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

    // Owner/Master initiated cancel
    const handleCancelAppointment = (id: string) => {
        setModalConfig({
            visible: true,
            title: 'Cancel Appointment',
            message: 'Are you sure you want to cancel this appointment? The client will be fully refunded and notified.',
            confirmText: 'Yes, Cancel',
            confirmDestructive: true,
            type: 'warning',
            onClose: () => setModalConfig(prev => ({ ...prev, visible: false })),
            onConfirm: async () => {
                setModalConfig(prev => ({
                    ...prev,
                    title: 'Cancelling...',
                    message: 'Processing cancellation and refund...',
                    loading: true,
                    hideCancel: true
                }));

                try {
                    await cancelAndRefund(id, 'master');
                    fetchAppointments();
                    
                    setModalConfig({
                        visible: true,
                        title: 'Success',
                        message: 'Appointment cancelled successfully. The client has been refunded.',
                        type: 'success',
                        onClose: () => setModalConfig(prev => ({ ...prev, visible: false })),
                        confirmText: 'OK',
                        hideCancel: true
                    });
                } catch (e: any) {
                    console.error('Failed to cancel appointment:', e);
                    setModalConfig({
                        visible: true,
                        title: 'Cancellation Error',
                        message: e.message || 'Could not cancel appointment.',
                        type: 'error',
                        onClose: () => setModalConfig(prev => ({ ...prev, visible: false })),
                        confirmText: 'OK',
                        hideCancel: true
                    });
                }
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
                await supabase.functions.invoke('send-push-notification', { body: {
                        to: clientPushToken,
                        sound: 'default',
                        title: 'Reschedule Request',
                        body: `Master ${user?.user_metadata?.full_name || ''} proposed a new time for your appointment.`,
                        data: { appointmentId: appointmentToReschedule.id },
                    } });
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

    const filteredAppointments = useMemo(() => {
        let data = appointments;
        // 1. Filter by Date
        if (filterDate) {
            data = data.filter(a => isSameDay(new Date(a.start_time), filterDate));
        }
        // 2. Filter by Search (Client Name)
        if (searchQuery) {
            const lower = searchQuery.toLowerCase();
            data = data.filter(a =>
                a.client?.full_name?.toLowerCase().includes(lower) ||
                a.service?.name?.toLowerCase().includes(lower)
            );
        }
        return data;
    }, [appointments, filterDate, searchQuery]);

    const upcomingList = useMemo(() => filteredAppointments.filter(apt => {
        const isFuture = new Date(apt.start_time) >= now;
        const isConfirmed = apt.status === 'confirmed';
        // If specific date is selected, show all confirmed. If no date (All), only show future confirmed.
        const showConfirmed = filterDate ? isConfirmed : (isFuture && isConfirmed);

        return showConfirmed ||
            apt.status === 'reschedule_pending' ||
            apt.status === 'pending_reschedule' ||
            apt.status === 'awaiting_confirmation' ||
            apt.status === 'pending' ||
            apt.status === 'pending_cancellation';
    }), [filteredAppointments, now, filterDate]);

    const completedList = useMemo(() => filteredAppointments.filter(apt =>
        apt.status === 'completed' || apt.status === 'cancelled' || apt.status === 'cancelled_free' || apt.status === 'cancelled_charge'
    ), [filteredAppointments]);

    const onPageSelected = (e: any) => {
        const index = e.nativeEvent.position;
        setActiveTab(index === 0 ? 'upcoming' : 'completed');
    };

    const handleTabPress = (tab: 'upcoming' | 'completed') => {
        setActiveTab(tab);
        pagerRef.current?.setPage(tab === 'upcoming' ? 0 : 1);
    };

    const handleDateChange = (event: any, selectedDate?: Date) => {
        setShowDatePicker(false);
        if (selectedDate) {
            setFilterDate(selectedDate);
        }
    };

    const renderAppointmentItem = useCallback(({ item: apt }: { item: Appointment }) => {
        const date = new Date(apt.start_time);
        const isPending = apt.status === 'pending' || apt.status === 'awaiting_confirmation';
        const isReschedule = apt.status === 'pending_reschedule' || apt.status === 'reschedule_pending';
        const isConfirmed = apt.status === 'confirmed';
        const isCompleted = apt.status === 'completed';
        const isCancelled = apt.status === 'cancelled' || apt.status === 'cancelled_free' || apt.status === 'cancelled_charge';

        // Status badge config
        const getStatusBadge = () => {
            if (isConfirmed && apt.confirmation?.confirmed) return { label: 'Confirmed', color: '#22C55E', bg: 'rgba(34,197,94,0.1)', border: 'rgba(34,197,94,0.2)' };
            if (isConfirmed) return { label: 'Confirmed', color: '#22C55E', bg: 'rgba(34,197,94,0.1)', border: 'rgba(34,197,94,0.2)' };
            if (isPending) return { label: 'Pending', color: '#D4AF37', bg: 'rgba(212,175,55,0.1)', border: 'rgba(212,175,55,0.2)' };
            if (isReschedule) return { label: 'Reschedule', color: colors.primary, bg: 'rgba(236,19,55,0.1)', border: 'rgba(236,19,55,0.2)' };
            if (isCompleted) return { label: 'Completed', color: '#6366F1', bg: 'rgba(99,102,241,0.1)', border: 'rgba(99,102,241,0.2)' };
            if (isCancelled) return { label: 'Cancelled', color: '#EF4444', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.2)' };
            return null;
        };
        const badge = getStatusBadge();

        return (
            <View style={styles.stitchCard}>
                {/* Client Info Row */}
                <View style={styles.stitchClientRow}>
                    <View style={styles.stitchAvatar}>
                        <MerakiText variant="label" color="#fff" style={styles.stitchAvatarText}>
                            {apt.client?.full_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2) || '?'}
                        </MerakiText>
                    </View>
                    <View style={styles.stitchClientInfo}>
                        <MerakiText variant="body" color={colors.text} style={styles.stitchClientName}>{apt.client?.full_name || 'Client'}</MerakiText>
                        <MerakiText variant="caption" color={colors.textSecondary}>{apt.service?.name || apt.service_name || 'Service'}</MerakiText>
                        <View style={styles.stitchTimeRow}>
                            <MaterialCommunityIcons name="clock-outline" size={12} color={colors.textSecondary} />
                            <MerakiText variant="caption" color={colors.textSecondary}>
                                {format(date, 'HH:mm')} ({apt.service?.duration_minutes} min)
                            </MerakiText>
                        </View>
                    </View>
                    <View style={styles.stitchRightColumn}>
                        {badge && (
                            <View style={[styles.stitchBadge, { backgroundColor: badge.bg, borderColor: badge.border }]}>
                                <MerakiText variant="caption" color={badge.color} style={styles.stitchBadgeText}>{badge.label}</MerakiText>
                            </View>
                        )}
                        <View style={styles.stitchTimeDate}>
                            <MerakiText variant="body" color={colors.primary} style={styles.stitchTime}>{format(date, 'HH:mm')}</MerakiText>
                            <MerakiText variant="caption" color={colors.textSecondary} style={styles.stitchDate}>{format(date, 'MMM d')}</MerakiText>
                        </View>
                    </View>
                </View>

                {/* Reschedule proposed time */}
                {isReschedule && apt.proposed_start_time && apt.reschedule_initiated_by !== user?.id && (
                    <View style={styles.stitchProposed}>
                        <MerakiText variant="caption" color={colors.textMuted}>Proposed new time:</MerakiText>
                        <MerakiText variant="body" color={colors.text} style={{ fontWeight: '600' }}>
                            {format(new Date(apt.proposed_start_time), 'EEEE, MMM d \'at\' HH:mm')}
                        </MerakiText>
                    </View>
                )}

                {/* Notes */}
                {apt.notes && (
                    <View style={styles.stitchNotes}>
                        <MaterialCommunityIcons name="note-text-outline" size={13} color={colors.textMuted} />
                        <MerakiText variant="caption" color={colors.textMuted} style={{ fontStyle: 'italic', flex: 1 }}>{apt.notes}</MerakiText>
                    </View>
                )}

                {/* Price row */}
                <View style={styles.stitchPriceRow}>
                    <MerakiText variant="body" color={colors.text} style={{ fontWeight: '700' }}>€{apt.price}</MerakiText>
                    {apt.deposit_paid && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <View style={styles.stitchDepositBadge}>
                                <MerakiText variant="caption" color="#22C55E" style={{ fontWeight: '600', fontSize: 10 }}>
                                    <MaterialCommunityIcons name="check" size={10} color="#22C55E" /> €{apt.deposit_amount} paid
                                </MerakiText>
                            </View>
                        </View>
                    )}
                </View>

                {isPending && new Date(apt.start_time) > now && (
                    <View style={styles.stitchActionRow}>
                        <View style={styles.stitchActionIcons} />
                        <View style={styles.stitchActionButtons}>
                            <TouchableOpacity style={styles.stitchSmallBtn} onPress={() => handleCancelAppointment(apt.id)}>
                                <MerakiText variant="caption" color={colors.textSecondary} style={styles.stitchSmallBtnText}>Cancel</MerakiText>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                {/* Confirmed — Quick Action Row */}
                {isConfirmed && new Date(apt.start_time) > now && (
                    <View style={styles.stitchActionRow}>
                        <View style={styles.stitchActionIcons} />
                        <View style={styles.stitchActionButtons}>
                            <TouchableOpacity style={styles.stitchSmallBtn} onPress={() => handleCancelAppointment(apt.id)}>
                                <MerakiText variant="caption" color={colors.textSecondary} style={styles.stitchSmallBtnText}>Cancel</MerakiText>
                            </TouchableOpacity>
                            {apt.service_category === 'Pilates' ? (
                                <TouchableOpacity style={styles.stitchSmallBtnPrimary} onPress={() => navigation.navigate('MyServices')}>
                                    <MerakiText variant="caption" color={colors.primary} style={styles.stitchSmallBtnText}>Studio Config</MerakiText>
                                </TouchableOpacity>
                            ) : (
                                <TouchableOpacity style={styles.stitchSmallBtnPrimary} onPress={() => handleRescheduleAppointment(apt)}>
                                    <MerakiText variant="caption" color={colors.primary} style={styles.stitchSmallBtnText}>Reschedule</MerakiText>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                )}

                {/* Confirmed — Past (needs completion) */}
                {isConfirmed && new Date(apt.start_time) <= now && (
                    <View style={styles.stitchActionRow}>
                        <View />
                        <TouchableOpacity style={styles.stitchSmallBtnPrimary} onPress={() => handleComplete(apt.id)}>
                            <MerakiText variant="caption" color={colors.primary} style={styles.stitchSmallBtnText}>Complete</MerakiText>
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        );
    }, [activeTab, user?.id, now]);

    const renderEmptyState = (type: 'upcoming' | 'completed') => (
        <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
                <MaterialCommunityIcons name="calendar-blank-outline" size={36} color={colors.textMuted} />
            </View>
            <MerakiText variant="body" color={colors.text} style={styles.emptyTitle}>
                {type === 'upcoming' ? 'No Upcoming Appointments' : 'No Completed Appointments'}
            </MerakiText>
            <MerakiText variant="caption" color={colors.textSecondary} style={styles.emptyText}>
                {type === 'upcoming'
                    ? 'Your schedule is clear. New bookings will appear here.'
                    : 'Completed appointments will be shown here.'}
            </MerakiText>
        </View>
    );

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
                {/* Header — Stitch Style */}
                <View style={styles.header}>
                    <MerakiText variant="h1">Appointments</MerakiText>
                </View>

                {/* Search & Filter */}
                <View style={styles.searchContainer}>
                    <View style={styles.searchBar}>
                        <MaterialCommunityIcons name="magnify" size={20} color={colors.textSecondary} />
                        <TextInput
                            placeholder="Search client or service..."
                            placeholderTextColor={colors.textSecondary}
                            style={styles.searchInput}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                        {searchQuery.length > 0 && (
                            <TouchableOpacity onPress={() => setSearchQuery('')} style={{ marginRight: 8 }}>
                                <MaterialCommunityIcons name="close-circle" size={18} color={colors.textSecondary} />
                            </TouchableOpacity>
                        )}

                        {/* Date Filter Button in Search Bar */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', borderLeftWidth: 1, borderLeftColor: colors.border, paddingLeft: 10 }}>
                            {filterDate && (
                                <TouchableOpacity onPress={() => setFilterDate(null)} style={{ marginRight: 4 }}>
                                    <MaterialCommunityIcons name="close" size={16} color={colors.textSecondary} />
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity onPress={() => setShowDatePicker(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                <MaterialCommunityIcons
                                    name="calendar-month"
                                    size={20}
                                    color={filterDate ? colors.primary : colors.textSecondary}
                                />
                                {filterDate && (
                                    <MerakiText variant="caption" color={colors.primary} style={{ fontWeight: '700' }}>
                                        {format(filterDate, 'MMM d')}
                                    </MerakiText>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>

                {showDatePicker && (
                    <DateTimePicker
                        value={filterDate || new Date()}
                        mode="date"
                        display="default"
                        onChange={handleDateChange}
                    />
                )}

                {/* 2-Tab Segmented Pill */}
                <View style={styles.tabsContainer}>
                    <View style={styles.tabBar}>
                        <TouchableOpacity
                            style={[styles.tabItem, activeTab === 'upcoming' && styles.tabItemActive]}
                            onPress={() => handleTabPress('upcoming')}
                        >
                            <MerakiText variant="label" style={[styles.tabText, activeTab === 'upcoming' && styles.tabTextActive]}>
                                Upcoming
                            </MerakiText>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.tabItem, activeTab === 'completed' && styles.tabItemActive]}
                            onPress={() => handleTabPress('completed')}
                        >
                            <MerakiText variant="label" style={[styles.tabText, activeTab === 'completed' && styles.tabTextActive]}>
                                Completed
                            </MerakiText>
                        </TouchableOpacity>
                    </View>
                </View>

                <PagerView
                    ref={pagerRef}
                    style={styles.pagerView}
                    initialPage={0}
                    onPageSelected={onPageSelected}
                >
                    {/* Page 1: Upcoming */}
                    <View key="upcoming" style={styles.page}>
                        <FlatList
                            data={upcomingList}
                            keyExtractor={item => item.id}
                            renderItem={renderAppointmentItem}
                            contentContainerStyle={styles.content}
                            refreshControl={
                                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} />
                            }
                            ListEmptyComponent={() => renderEmptyState('upcoming')}
                            showsVerticalScrollIndicator={false}
                        />
                    </View>

                    {/* Page 2: Completed */}
                    <View key="completed" style={styles.page}>
                        <FlatList
                            data={completedList}
                            keyExtractor={item => item.id}
                            renderItem={renderAppointmentItem}
                            contentContainerStyle={styles.content}
                            refreshControl={
                                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} />
                            }
                            ListEmptyComponent={() => renderEmptyState('completed')}
                            showsVerticalScrollIndicator={false}
                        />
                    </View>
                </PagerView>
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
                                <MerakiText variant="body" color={colors.textSecondary}>Cancel</MerakiText>
                            </TouchableOpacity>
                            <MerakiText variant="h2" color={colors.text}>Reschedule</MerakiText>
                            <View style={{ width: 60 }} />
                        </View>

                        <ScrollView style={styles.modalContent}>
                            <MerakiText variant="label" color={colors.textSecondary} style={styles.sectionTitle}>Select New Date</MerakiText>
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
                                        <MerakiText
                                            variant="caption"
                                            color={selectedDate && isSameDay(date, selectedDate) ? colors.textInvert : colors.textSecondary}
                                            style={styles.dateDayName}
                                        >
                                            {format(date, 'EEE')}
                                        </MerakiText>
                                        <MerakiText
                                            variant="body"
                                            color={selectedDate && isSameDay(date, selectedDate) ? colors.textInvert : colors.text}
                                            style={[
                                                styles.dateDay,
                                                selectedDate && isSameDay(date, selectedDate) && styles.dateTextActive
                                            ]}
                                        >
                                            {format(date, 'd')}
                                        </MerakiText>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>

                            <MerakiText variant="label" color={colors.textSecondary} style={styles.sectionTitle}>Select New Time</MerakiText>
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
                                        <MerakiText
                                            variant="body"
                                            color={selectedTime === time ? colors.textInvert : colors.text}
                                            style={[
                                                styles.timeText,
                                                selectedTime === time && styles.timeTextActive
                                            ]}
                                        >
                                            {time}
                                        </MerakiText>
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

    // ─── Header ───
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.lg,
        paddingBottom: spacing.sm,
    },
    title: { fontSize: 28, fontWeight: '700', color: colors.text },

    // Search
    searchContainer: {
        paddingHorizontal: spacing.lg,
        marginBottom: spacing.md,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: 12,
        paddingHorizontal: spacing.md,
        height: 48,
        borderWidth: 1,
        borderColor: colors.border,
    },
    searchInput: {
        flex: 1,
        height: '100%',
        color: colors.text,
        marginLeft: spacing.sm,
        fontSize: 14,
    },

    // Date Chips
    dateChip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: 'rgba(0, 0, 0, 0.04)',
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.08)',
    },
    dateChipActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    dateChipText: {
        color: colors.textSecondary,
        fontWeight: '600',
    },
    dateChipTextActive: {
        color: '#fff',
    },

    // Pager
    pagerView: { flex: 1 },
    page: { flex: 1 },

    // ─── 2-Tab Navigation ───
    tabsContainer: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
    tabBar: {
        flexDirection: 'row',
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 4,
        borderWidth: 1,
        borderColor: colors.border,
    },
    tabItem: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 12,
    },
    tabItemActive: {
        backgroundColor: colors.primary,
    },
    tabText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
    tabTextActive: { color: '#FFFFFF', fontWeight: '700' },

    // ─── Content ───
    content: { padding: spacing.lg, paddingBottom: 100 },

    // ─── Stitch Appointment Card ───
    stitchCard: {
        backgroundColor: 'rgba(0, 0, 0, 0.03)',
        borderRadius: 20,
        padding: spacing.lg,
        marginBottom: spacing.md,
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.05)',
    },
    stitchBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
        borderWidth: 1,
        marginBottom: 4,
        alignSelf: 'flex-end',
    },
    stitchBadgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },

    // Client Row
    stitchClientRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
        marginTop: 4,
    },
    stitchAvatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    stitchAvatarText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
    stitchClientInfo: { flex: 1, gap: 2 },
    stitchClientName: { fontSize: 16, fontWeight: '600' },
    stitchTimeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
    stitchRightColumn: { alignItems: 'flex-end' },
    stitchTimeDate: { alignItems: 'flex-end' },
    stitchTime: { fontSize: 18, fontWeight: '700' },
    stitchDate: { fontSize: 12, marginTop: 2 },

    // Proposed / Notes
    stitchProposed: {
        marginTop: spacing.sm,
        paddingTop: spacing.sm,
        borderTopWidth: 1,
        borderTopColor: 'rgba(0, 0, 0, 0.05)',
    },
    stitchNotes: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 6,
        marginTop: spacing.sm,
        paddingTop: spacing.sm,
        borderTopWidth: 1,
        borderTopColor: 'rgba(0, 0, 0, 0.05)',
    },

    // Price row
    stitchPriceRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: spacing.sm,
        paddingTop: spacing.sm,
        borderTopWidth: 1,
        borderTopColor: 'rgba(0, 0, 0, 0.05)',
    },
    stitchDepositBadge: {
        backgroundColor: 'rgba(34,197,94,0.15)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
    },

    // Accept / Decline
    stitchAcceptDecline: {
        flexDirection: 'row',
        gap: 10,
        marginTop: spacing.md,
        paddingTop: spacing.sm,
        borderTopWidth: 1,
        borderTopColor: 'rgba(0, 0, 0, 0.05)',
    },
    stitchAcceptButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 12,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    stitchDeclineButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 12,
        backgroundColor: 'rgba(0, 0, 0, 0.05)',
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.08)',
        alignItems: 'center',
        justifyContent: 'center',
    },

    // Quick Action Row (confirmed)
    stitchActionRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: spacing.sm,
        paddingTop: spacing.sm,
        borderTopWidth: 1,
        borderTopColor: 'rgba(0, 0, 0, 0.05)',
    },
    stitchActionIcons: { flexDirection: 'row', gap: 8 },
    stitchIconBtn: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: 'rgba(0, 0, 0, 0.05)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    stitchActionButtons: { flexDirection: 'row', gap: 8 },
    stitchSmallBtn: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 10,
        backgroundColor: 'rgba(0, 0, 0, 0.05)',
    },
    stitchSmallBtnPrimary: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 10,
        backgroundColor: 'rgba(236,19,55,0.1)',
        borderWidth: 1,
        borderColor: 'rgba(236,19,55,0.2)',
    },
    stitchSmallBtnText: { fontSize: 12, fontWeight: '600' },

    // ─── Empty State ───
    emptyState: { alignItems: 'center', paddingVertical: spacing.xxxl },
    emptyIconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(0, 0, 0, 0.04)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.lg,
    },
    emptyTitle: { fontSize: 18, fontWeight: '600', color: colors.text, marginBottom: spacing.sm },
    emptyText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', paddingHorizontal: spacing.xl },

    // ─── Modal & Picker ───
    modalContainer: {
        flex: 1,
        backgroundColor: colors.baseBackground,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0, 0, 0, 0.08)',
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
        marginBottom: spacing.md,
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
        borderColor: colors.border,
    },
    dateCardActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    dateDayName: { fontSize: 12, color: colors.textSecondary, marginBottom: spacing.xs },
    dateDay: { fontSize: 20, fontWeight: '600', color: colors.text },
    dateTextActive: { color: colors.textInvert },
    timesGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
        marginBottom: spacing.xl,
    },
    timeSlot: {
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        borderRadius: 12,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
    },
    timeSlotActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    timeText: { fontSize: 14, fontWeight: '500', color: colors.text },
    timeTextActive: { color: colors.textInvert },
});

export default MasterAppointmentsScreen;
