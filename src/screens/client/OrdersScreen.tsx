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
import PagerView from 'react-native-pager-view';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, CommonActions } from '@react-navigation/native';
import { format, addDays, isSameDay, differenceInHours } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { safeGoBack } from '../../navigation/navigationUtils';
import { useMenuBackHandler } from '../../hooks/useMenuBackHandler';
import { safeSupabaseFetch } from '../../lib/supabaseApi';
import { useAuth } from '../../contexts/AuthContext';
import { Card, Button, ScreenBackground, MerakiText } from '../../components/ui';
import { useModal } from '../../contexts/ModalContext';
import { colors, spacing } from '../../theme';
import { cancelPaymentIntent, capturePayment, eurosToCents, cancelAndRefund } from '../../services/stripeService';

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
    service_name: string | null;
    service_category: string | null;
    service: { name: string; duration_minutes: number; category?: string } | null;
    master: { full_name: string; push_token?: string } | null;
};

type ProductOrder = {
    id: string;
    total: number;
    status: string;
    created_at: string;
    items?: {
        id: string;
        product_name: string;
        quantity: number;
        price: number;
    }[];
};

export function OrdersScreen() {
    const navigation = useNavigation<any>();
    const handleBack = useMenuBackHandler();
    const { user, checkSession } = useAuth();
    const { showAlert, showModal } = useModal();

    // State
    const pagerRef = React.useRef<PagerView>(null);
    const [activeTab, setActiveTab] = useState<'appointments' | 'products'>('appointments');
    const [subTab, setSubTab] = useState<'upcoming' | 'past'>('upcoming'); // For appointments
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [productOrders, setProductOrders] = useState<ProductOrder[]>([]);

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
        fetchData();
    }, [activeTab]);

    const fetchData = async () => {
        if (!user) return;

        const isSessionValid = await checkSession();
        if (!isSessionValid) {
            setLoading(false);
            setRefreshing(false);
            return;
        }

        if (activeTab === 'appointments') {
            await fetchAppointments();
        } else {
            await fetchProductOrders();
        }
    };

    const fetchAppointments = async () => {
        if (!user?.id) return;

        try {
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
                    service_name,
                    service_category,
                    service:services(name, duration_minutes, category),
                    master:profiles!appointments_master_id_fkey(full_name, push_token)
                `)
                .eq('client_id', user.id)
                .order('start_time', { ascending: false });

            const { data, error } = await safeSupabaseFetch(queryPromise, { timeout: 8000 });
            if (error) throw error;

            // Filter out orphaned appointments (where master was deleted)
            const validAppointments = ((data as unknown as Appointment[]) || []).filter(
                apt => apt.master !== null
            );
            setAppointments(validAppointments);
        } catch (error) {
            console.error('Error fetching appointments:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const fetchProductOrders = async () => {
        try {
            if (!user?.id) return;

            // First fetch orders
            const { data: ordersData, error: ordersError } = await supabase
                .from('orders')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (ordersError) throw ordersError;

            const orders = (ordersData as unknown as ProductOrder[]) || [];

            // Then fetch items for these orders
            const orderIds = orders.map(o => o.id);
            if (orderIds.length > 0) {
                const { data: itemsData, error: itemsError } = await supabase
                    .from('order_items')
                    .select('*')
                    .in('order_id', orderIds);

                if (itemsError) throw itemsError;

                // Combine
                const ordersWithItems = orders.map(order => ({
                    ...order,
                    items: (itemsData as any[]).filter(item => item.order_id === order.id)
                }));

                setProductOrders(ordersWithItems);
            } else {
                setProductOrders([]);
            }

        } catch (error) {
            console.error('Error fetching product orders:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchData();
    };

    // --- Appointment Handlers ---

    const handleCancel = (appointment: Appointment) => {
        const isLate = isWithinCancellationWindow(appointment.start_time);

        let message = 'Are you sure you want to cancel this appointment?';
        if (isLate) {
            message = 'You are cancelling within 24 hours of the appointment. A 50% cancellation fee will apply. Only half of your payment will be refunded. Do you wish to proceed?';
        } else {
            message = 'You are cancelling more than 24 hours in advance. You will receive a full refund. Do you wish to proceed?';
        }

        showModal({
            title: 'Cancel Appointment',
            message,
            confirmText: 'Yes, Cancel',
            cancelText: 'No, Keep it',
            type: 'warning', // changed from info to warning for cancellations
            onConfirm: () => confirmCancel(appointment, isLate),
        });
    };

    // Send notification to Master about cancellation
    const notifyMasterOfCancellation = async (apt: Appointment) => {
        const masterPushToken = apt.master?.push_token;
        if (!masterPushToken) return;

        try {
            await supabase.functions.invoke('send-push-notification', { body: {
                    to: masterPushToken,
                    sound: 'default',
                    title: 'Appointment Canceled',
                    body: `${user?.user_metadata?.full_name || 'Client'} canceled their appointment. The slot is open again.`,
                    data: { appointmentId: apt.id },
                } });
        } catch (e) {
            console.error('Failed to send cancellation notification:', e);
        }
    };

    const confirmCancel = async (appointment: Appointment, isLate: boolean) => {
        // Morph the modal into a loading state
        showModal({
            title: 'Cancelling...',
            message: 'Processing your cancellation and refund...',
            loading: true,
            hideCancel: true,
            type: 'warning',
        });

        try {
            // Cancel and refund using the edge function (handles both DB and Stripe automatically)
            await cancelAndRefund(appointment.id, 'client');

            // Notify master
            await notifyMasterOfCancellation(appointment);

            showAlert('Appointment Canceled', 'Your appointment has been canceled successfully.', 'success');

            fetchData();
        } catch (error: any) {
            console.error('Failed to cancel appointment:', error);
            showAlert('Error', error.message || 'Could not cancel appointment.', 'error');
        }
    };

    const handleReschedule = (appointment: Appointment) => {
        if (appointment.service_category === 'Pilates' || appointment.service?.category === 'Pilates') {
            showAlert(
                'Reschedule Class',
                'Please reschedule Pilates classes from the Appointments tab under the Book section.',
                'info'
            );
            navigation.navigate('Book');
            return;
        }
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
            await supabase.functions.invoke('send-push-notification', { body: {
                    to: masterPushToken,
                    sound: 'default',
                    title: needsApproval ? 'Reschedule Request' : 'Appointment Rescheduled',
                    body: message,
                    data: { appointmentId: apt.id },
                } });
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

    const handleChat = async (appointment: Appointment) => {
        if (!user || !appointment.master_id) return;
        try {
            const { data: existing } = await supabase
                .from('conversations')
                .select('id')
                .eq('client_id', user.id)
                .eq('master_id', appointment.master_id)
                .single();

            let conversationId = existing?.id;

            if (!conversationId) {
                const { data: newConv, error } = await supabase
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
        apt => new Date(apt.start_time) >= now && !apt.status.startsWith('cancelled')
    );
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

    // New Product Statuses
    const productStatusColors: Record<string, { bg: string; text: string }> = {
        confirmed: { bg: '#DBEAFE', text: '#1E40AF' },
        processing: { bg: '#FEF3C7', text: '#92400E' },
        shipped: { bg: 'rgba(200, 160, 77, 0.1)', text: colors.primary },
        completed: { bg: '#D1FAE5', text: '#065F46' },
        cancelled: { bg: '#FEE2E2', text: '#991B1B' },
    };

    const availableDates = Array.from({ length: 14 }, (_, i) => addDays(new Date(), i + 1));
    const timeSlots = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'];

    if (loading && !refreshing) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.text} />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <ScreenBackground>
            <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
                {/* Header — Stitch Style */}
                <View style={styles.header}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={handleBack}
                    >
                        <MaterialIcons name="arrow-back" size={20} color={colors.text} />
                    </TouchableOpacity>
                    <MerakiText variant="h1" style={styles.headerTitle}>My Orders</MerakiText>
                    <View style={styles.headerRightPlaceholder} />
                </View>

                {/* Main Tabs (Bookings vs Shop) */}
                <View style={styles.tabsContainer}>
                    <View style={styles.tabBar}>
                        <TouchableOpacity
                            style={[styles.tabItem, activeTab === 'appointments' && styles.tabItemActive]}
                            onPress={() => {
                                setActiveTab('appointments');
                                pagerRef.current?.setPage(0);
                            }}
                        >
                            <MerakiText variant="label" style={[styles.tabText, activeTab === 'appointments' && styles.tabTextActive]}>
                                Bookings
                            </MerakiText>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.tabItem, activeTab === 'products' && styles.tabItemActive]}
                            onPress={() => {
                                setActiveTab('products');
                                pagerRef.current?.setPage(1);
                            }}
                        >
                            <MerakiText variant="label" style={[styles.tabText, activeTab === 'products' && styles.tabTextActive]}>
                                Shop Orders
                            </MerakiText>
                        </TouchableOpacity>
                    </View>
                </View>

                <PagerView
                    ref={pagerRef}
                    style={styles.pagerView}
                    initialPage={0}
                    onPageSelected={(e) => setActiveTab(e.nativeEvent.position === 0 ? 'appointments' : 'products')}
                >
                    {/* Page 1: Appointments */}
                    <View key="appointments" style={{ flex: 1 }}>
                        <View style={styles.subTabsContainer}>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subTabsContent}>
                                <TouchableOpacity
                                    style={[styles.subTab, subTab === 'upcoming' && styles.subTabActive]}
                                    onPress={() => setSubTab('upcoming')}
                                >
                                    <MerakiText style={[styles.subTabText, subTab === 'upcoming' && styles.subTabTextActive]}>
                                        Upcoming ({upcomingAppointments.length})
                                    </MerakiText>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.subTab, subTab === 'past' && styles.subTabActive]}
                                    onPress={() => setSubTab('past')}
                                >
                                    <MerakiText style={[styles.subTabText, subTab === 'past' && styles.subTabTextActive]}>
                                        Past ({pastAppointments.length})
                                    </MerakiText>
                                </TouchableOpacity>
                            </ScrollView>
                        </View>

                        <ScrollView
                            contentContainerStyle={styles.content}
                            refreshControl={
                                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} />
                            }
                        >
                            {(subTab === 'upcoming' ? upcomingAppointments : pastAppointments).length > 0 ? (
                                (subTab === 'upcoming' ? upcomingAppointments : pastAppointments).map((apt) => {
                                    const date = new Date(apt.start_time);
                                    const statusStyle = statusColors[apt.status] || statusColors.pending;
                                    const canModify = subTab === 'upcoming' && !apt.status.startsWith('cancelled');

                                    return (
                                        <View key={apt.id} style={styles.stitchCard}>
                                            {/* Client Info Row: Avatar + Name/Service + Time/Date */}
                                            <View style={styles.stitchClientRow}>
                                                <View style={styles.stitchAvatar}>
                                                    <MerakiText variant="label" color="#fff" style={styles.stitchAvatarText}>
                                                        {apt.master?.full_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2) || '?'}
                                                    </MerakiText>
                                                </View>
                                                <View style={styles.stitchClientInfo}>
                                                    <MerakiText variant="body" color={colors.text} style={styles.stitchClientName}>{apt.service?.name || apt.service_name || 'Service'}</MerakiText>
                                                    <MerakiText variant="caption" color={colors.textSecondary}>{apt.master?.full_name || 'Specialist'}</MerakiText>
                                                    {subTab === 'upcoming' && (
                                                        <View style={styles.stitchTimeRow}>
                                                            <MaterialCommunityIcons name="clock-outline" size={12} color={colors.textSecondary} />
                                                            <MerakiText variant="caption" color={colors.textSecondary}>
                                                                {format(date, 'HH:mm')} ({apt.service?.duration_minutes} min)
                                                            </MerakiText>
                                                        </View>
                                                    )}
                                                </View>
                                                <View style={styles.stitchRightColumn}>
                                                    <View style={[styles.stitchBadge, { backgroundColor: statusStyle.bg, borderColor: statusStyle.bg }]}>
                                                        <MerakiText variant="caption" color={statusStyle.text} style={styles.stitchBadgeText}>{formatStatus(apt.status)}</MerakiText>
                                                    </View>
                                                    <View style={styles.stitchTimeDate}>
                                                        <MerakiText variant="body" color={colors.primary} style={styles.stitchTime}>{format(date, 'HH:mm')}</MerakiText>
                                                        <MerakiText variant="caption" color={colors.textSecondary} style={styles.stitchDate}>{format(date, 'MMM d')}</MerakiText>
                                                    </View>
                                                </View>
                                            </View>

                                            {/* Price row */}
                                            <View style={styles.stitchPriceRow}>
                                                <MerakiText variant="body" color={colors.text} style={{ fontWeight: '700' }}>€{apt.price}</MerakiText>
                                                {canModify && (
                                                    <View style={styles.actionButtons}>
                                                        <TouchableOpacity
                                                            style={styles.chatButton}
                                                            onPress={() => handleChat(apt)}
                                                        >
                                                            <MaterialCommunityIcons name="chat-outline" size={16} color={colors.primary} />
                                                        </TouchableOpacity>
                                                    </View>
                                                )}
                                            </View>

                                            {/* Action Buttons */}
                                            {canModify && (
                                                <View style={styles.stitchActionButtons}>
                                                    <TouchableOpacity
                                                        style={styles.stitchSmallBtn}
                                                        onPress={() => handleCancel(apt)}
                                                    >
                                                        <MerakiText variant="caption" color={colors.error} style={styles.stitchSmallBtnText}>Cancel</MerakiText>
                                                    </TouchableOpacity>
                                                    <TouchableOpacity
                                                        style={styles.stitchSmallBtnPrimary}
                                                        onPress={() => handleReschedule(apt)}
                                                    >
                                                        <MerakiText variant="caption" color={colors.primary} style={styles.stitchSmallBtnText}>Reschedule</MerakiText>
                                                    </TouchableOpacity>
                                                </View>
                                            )}
                                        </View>
                                    );
                                })
                            ) : (
                                <View style={styles.emptyState}>
                                    <View style={styles.emptyIconContainer}>
                                        {subTab === 'upcoming'
                                            ? <MaterialCommunityIcons name="calendar-blank-outline" size={36} color={colors.textMuted} />
                                            : <MaterialCommunityIcons name="clipboard-text-outline" size={36} color={colors.textMuted} />
                                        }
                                    </View>
                                    <MerakiText variant="body" color={colors.text} style={styles.emptyTitle}>
                                        {subTab === 'upcoming' ? 'No Upcoming Appointments' : 'No Past Appointments'}
                                    </MerakiText>
                                    <MerakiText variant="caption" color={colors.textSecondary} style={styles.emptyText}>
                                        {subTab === 'upcoming'
                                            ? 'Your schedule is clear. Book a new service!'
                                            : 'Your past appointments will appear here.'}
                                    </MerakiText>
                                </View>
                            )}
                        </ScrollView>
                    </View>

                    {/* Page 2: Product Orders */}
                    <View key="products" style={{ flex: 1 }}>
                        <ScrollView
                            contentContainerStyle={styles.content}
                            refreshControl={
                                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} />
                            }
                        >
                            {productOrders.length > 0 ? (
                                productOrders.map((order) => {
                                    const orderDate = new Date(order.created_at);
                                    const statusStyle = productStatusColors[order.status] || productStatusColors.confirmed;

                                    return (
                                        <View key={order.id} style={styles.stitchCard}>
                                            <View style={styles.cardHeader}>
                                                <View>
                                                    <MerakiText variant="body" style={styles.cardTitle}>Order #{order.id.slice(0, 8).toUpperCase()}</MerakiText>
                                                    <MerakiText variant="caption" style={styles.cardSubtitle}>
                                                        {format(orderDate, 'MMM d, yyyy • HH:mm')}
                                                    </MerakiText>
                                                </View>
                                                <View style={[styles.stitchBadge, { backgroundColor: statusStyle.bg, borderColor: statusStyle.bg }]}>
                                                    <MerakiText variant="caption" style={[styles.stitchBadgeText, { color: statusStyle.text }]}>
                                                        {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                                                    </MerakiText>
                                                </View>
                                            </View>

                                            <View style={styles.cardDetails}>
                                                {order.items?.map((item, index) => (
                                                    <View key={index} style={styles.orderItemRow}>
                                                        <MerakiText variant="body" style={styles.orderItemName} numberOfLines={1}>
                                                            {item.quantity}x {item.product_name}
                                                        </MerakiText>
                                                        <MerakiText variant="body" style={styles.orderItemPrice}>
                                                            €{(item.price * item.quantity).toFixed(2)}
                                                        </MerakiText>
                                                    </View>
                                                ))}
                                            </View>

                                            <View style={styles.cardFooter}>
                                                <View style={{ flex: 1 }} />
                                                <MerakiText variant="h3" style={styles.price}>€{order.total.toFixed(2)}</MerakiText>
                                            </View>
                                        </View>
                                    );
                                })
                            ) : (
                                <View style={styles.emptyState}>
                                    <View style={styles.emptyIconContainer}>
                                        <MaterialCommunityIcons name="shopping-outline" size={36} color={colors.textMuted} />
                                    </View>
                                    <MerakiText variant="body" color={colors.text} style={styles.emptyText}>No orders yet</MerakiText>
                                    <TouchableOpacity
                                        style={styles.shopNowButton}
                                        onPress={() => navigation.navigate('Shop')}
                                    >
                                        <MerakiText style={styles.shopNowButtonText}>Go to Shop</MerakiText>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </ScrollView>
                    </View>
                </PagerView>

            </SafeAreaView>

            {/* Modals remain unchanged ... */}
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
                            <MerakiText variant="h3">Reschedule</MerakiText>
                            <View style={{ width: 60 }} />
                        </View>

                        <ScrollView style={styles.modalContent}>
                            <MerakiText variant="label" style={styles.sectionTitle}>Select New Date</MerakiText>
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
                                        <MerakiText variant="caption" style={[
                                            styles.dateDayName,
                                            selectedDate && isSameDay(date, selectedDate) && styles.dateTextActive,
                                        ]}>
                                            {format(date, 'EEE')}
                                        </MerakiText>
                                        <MerakiText variant="h3" style={[
                                            styles.dateDay,
                                            selectedDate && isSameDay(date, selectedDate) && styles.dateTextActive,
                                        ]}>
                                            {format(date, 'd')}
                                        </MerakiText>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>

                            <MerakiText variant="label" style={styles.sectionTitle}>Select New Time</MerakiText>
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
                                        <MerakiText variant="body" style={[
                                            styles.timeText,
                                            selectedTime === time && styles.timeTextActive,
                                        ]}>
                                            {time}
                                        </MerakiText>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <TouchableOpacity
                                style={[styles.confirmButton, { opacity: (selectedDate && selectedTime) ? 1 : 0.5 }]}
                                onPress={confirmReschedule}
                                disabled={!selectedDate || !selectedTime || rescheduleLoading}
                            >
                                {rescheduleLoading ? (
                                    <ActivityIndicator color="white" />
                                ) : (
                                    <MerakiText variant="body" style={{ color: 'white', fontWeight: 'bold' }}>Confirm Reschedule</MerakiText>
                                )}
                            </TouchableOpacity>
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
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.lg,
        paddingBottom: spacing.sm,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(0, 0, 0, 0.05)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.06)',
    },
    headerTitle: {
        flex: 1,
        textAlign: 'center',
    },
    headerRightPlaceholder: {
        width: 40,
    },
    // Tabs
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

    pagerView: { flex: 1 },

    subTabsContainer: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
    subTabsContent: { flexDirection: 'row', gap: 8 },
    subTab: {
        paddingHorizontal: 16,
        paddingVertical: 6,
        borderRadius: 20,
        backgroundColor: 'rgba(0, 0, 0, 0.03)',
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.06)',
    },
    subTabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    subTabText: { fontSize: 13, color: colors.textSecondary },
    subTabTextActive: { color: '#fff', fontWeight: '600' },

    content: { padding: spacing.lg, paddingTop: 0 },

    // Stitch Card
    stitchCard: {
        marginBottom: spacing.md,
        padding: spacing.md,
        backgroundColor: 'rgba(0, 0, 0, 0.03)',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.06)',
    },
    stitchClientRow: { flexDirection: 'row', marginBottom: spacing.md },
    stitchAvatar: {
        width: 48,
        height: 48,
        borderRadius: 16,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: spacing.md,
    },
    stitchAvatarText: { fontSize: 18, fontWeight: '700' },
    stitchClientInfo: { flex: 1, justifyContent: 'center' },
    stitchClientName: { fontWeight: '600', marginBottom: 2 },
    stitchTimeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
    stitchRightColumn: { alignItems: 'flex-end', justifyContent: 'space-between' },
    stitchBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
        borderWidth: 1,
        marginBottom: 4,
    },
    stitchBadgeText: { fontSize: 10, fontWeight: '600', textTransform: 'capitalize' },
    stitchTimeDate: { alignItems: 'flex-end' },
    stitchTime: { fontWeight: '700' },
    stitchDate: { fontSize: 11 },

    stitchPriceRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: spacing.sm,
        marginTop: spacing.sm,
        borderTopWidth: 1,
        borderTopColor: 'rgba(0, 0, 0, 0.05)',
    },
    stitchActionButtons: {
        flexDirection: 'row',
        gap: spacing.sm,
        marginTop: spacing.md,
    },
    stitchSmallBtn: {
        flex: 1,
        paddingVertical: 8,
        borderRadius: 10,
        backgroundColor: 'rgba(0, 0, 0, 0.03)',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.06)',
    },
    stitchSmallBtnPrimary: {
        flex: 1,
        paddingVertical: 8,
        borderRadius: 10,
        backgroundColor: 'rgba(200, 160, 77, 0.1)',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(200, 160, 77, 0.2)',
    },
    stitchSmallBtnText: { fontWeight: '600', fontSize: 12 },

    // Keeping some legacy styles for Product Orders which I partly refactored
    cardTitle: { fontWeight: '600', color: colors.text, marginBottom: 2 },
    cardSubtitle: { fontSize: 13, color: colors.textSecondary },
    cardDetails: { marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: 'rgba(0, 0, 0, 0.06)' },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: 'rgba(0, 0, 0, 0.06)' },

    // Order Item
    orderItemRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
    orderItemName: { flex: 1, color: colors.textSecondary, marginRight: spacing.sm },
    orderItemPrice: { color: colors.text, fontWeight: '500' },
    price: { fontSize: 18, fontWeight: '700', color: colors.primary },

    actionButtons: { flexDirection: 'row', gap: spacing.sm },
    chatButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(0, 0, 0, 0.03)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.06)',
    },

    emptyState: { alignItems: 'center', paddingVertical: spacing.xxxl },
    emptyIconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(0, 0, 0, 0.02)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.md,
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.05)',
    },
    emptyTitle: { fontSize: 18, fontWeight: '600', marginBottom: 8 },
    emptyText: { fontSize: 14, textAlign: 'center', maxWidth: 240 },
    shopNowButton: { marginTop: spacing.lg, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, backgroundColor: colors.primary, borderRadius: 12 },
    shopNowButtonText: { color: 'white', fontWeight: '600' },

    // Modals
    modalContainer: {
        flex: 1,
        backgroundColor: colors.baseBackground,
    },
    modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: 'rgba(0, 0, 0, 0.08)' },
    modalCancel: { color: colors.textSecondary, fontSize: 16 },
    modalTitle: { fontSize: 18, fontWeight: '600', color: colors.text },
    modalContent: { padding: spacing.lg },
    sectionTitle: { fontSize: 14, fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: spacing.md },
    datesRow: { marginBottom: spacing.xl },
    dateCard: { width: 64, padding: spacing.md, alignItems: 'center', borderRadius: 16, backgroundColor: colors.surface, marginRight: spacing.sm, borderWidth: 1, borderColor: colors.border },
    dateCardActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    dateDayName: { fontSize: 12, color: colors.textSecondary, marginBottom: spacing.xs },
    dateDay: { fontSize: 20, fontWeight: '600', color: colors.text },
    dateTextActive: { color: colors.textInvert },
    timesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.xl },
    timeSlot: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
    timeSlotActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    timeText: { fontSize: 14, fontWeight: '500', color: colors.text },
    timeTextActive: { color: colors.textInvert },

    confirmButton: {
        marginTop: spacing.xl,
        backgroundColor: colors.primary,
        paddingVertical: spacing.md,
        borderRadius: 12,
        alignItems: 'center',
    },
    // Dialog
    overlayContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.85)' },
    dialogContainer: { width: '100%', maxWidth: 340, backgroundColor: colors.surface, borderRadius: 24, padding: spacing.xl, borderWidth: 1, borderColor: colors.border, shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.5, shadowRadius: 20, elevation: 10 },
    dialogTitle: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: spacing.sm, textAlign: 'center' },
    dialogMessage: { fontSize: 16, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.xl, lineHeight: 22 },
    dialogButtons: { flexDirection: 'row', gap: spacing.md },
    dialogButtonCancel: { flex: 1, paddingVertical: spacing.md, borderRadius: 12, backgroundColor: colors.surfaceLight, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
    dialogButtonCancelText: { fontSize: 16, fontWeight: '600', color: colors.text },
    dialogButtonConfirm: { flex: 1, paddingVertical: spacing.md, borderRadius: 12, backgroundColor: 'rgba(239, 68, 68, 0.2)', alignItems: 'center', borderWidth: 1, borderColor: colors.error },
    dialogButtonConfirmText: { fontSize: 16, fontWeight: '600', color: colors.error },
    warningBox: { backgroundColor: 'rgba(245, 158, 11, 0.15)', padding: spacing.md, borderRadius: 8, marginBottom: spacing.lg, borderWidth: 1, borderColor: 'rgba(245, 158, 11, 0.3)' },
    warningText: { color: '#F59E0B', fontSize: 14, fontWeight: '600', textAlign: 'center' },
});

export default OrdersScreen;
