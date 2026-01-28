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
import { format, addDays, isSameDay } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { safeSupabaseFetch } from '../../lib/supabaseApi';
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
    service_id: string;
    master_id: string;
    service: { name: string; duration_minutes: number } | null;
    master: { full_name: string } | null;
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
    const { user, checkSession } = useAuth();

    // State
    const [activeTab, setActiveTab] = useState<'appointments' | 'products'>('appointments');
    const [subTab, setSubTab] = useState<'upcoming' | 'past'>('upcoming'); // For appointments
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [productOrders, setProductOrders] = useState<ProductOrder[]>([]);

    // UI State
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Reschedule/Cancel State
    const [appointmentToCancel, setAppointmentToCancel] = useState<Appointment | null>(null);
    const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
    const [showRescheduleModal, setShowRescheduleModal] = useState(false);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [selectedTime, setSelectedTime] = useState<string | null>(null);
    const [rescheduleLoading, setRescheduleLoading] = useState(false);

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
                    service:services(name, duration_minutes),
                    master:profiles!appointments_master_id_fkey(full_name)
                `)
                // @ts-ignore - user check handled above
                .eq('client_id', user?.id)
                .order('start_time', { ascending: false });

            const { data, error } = await safeSupabaseFetch(queryPromise as any, { timeout: 8000 });
            if (error) throw error;
            setAppointments((data as unknown as Appointment[]) || []);
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
            const { data: ordersData, error: ordersError } = await (supabase as any)
                .from('orders')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (ordersError) throw ordersError;

            const orders = (ordersData as unknown as ProductOrder[]) || [];

            // Then fetch items for these orders
            const orderIds = orders.map(o => o.id);
            if (orderIds.length > 0) {
                const { data: itemsData, error: itemsError } = await (supabase as any)
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
        setAppointmentToCancel(appointment);
    };

    const confirmCancel = async () => {
        if (!appointmentToCancel) return;
        try {
            const { error } = await supabase
                .from('appointments')
                .update({ status: 'pending_cancellation' })
                .eq('id', appointmentToCancel.id);

            if (error) throw error;
            setAppointmentToCancel(null);
            fetchAppointments();
            Alert.alert('Request Sent', 'Your cancellation request has been sent to the master for approval.');
        } catch (error: any) {
            Alert.alert('Error', error.message);
        }
    };

    const handleReschedule = (appointment: Appointment) => {
        setSelectedAppointment(appointment);
        setSelectedDate(null);
        setSelectedTime(null);
        setShowRescheduleModal(true);
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

            const { error } = await supabase
                .from('appointments')
                .update({
                    proposed_start_time: newStartTime.toISOString(),
                    proposed_end_time: newEndTime.toISOString(),
                    status: 'pending_reschedule',
                } as any)
                .eq('id', selectedAppointment.id);

            if (error) throw error;
            Alert.alert('Request Sent', 'Reschedule request sent to master.');
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
        no_show: { bg: '#F3F4F6', text: '#374151' },
    };

    // New Product Statuses
    const productStatusColors: Record<string, { bg: string; text: string }> = {
        confirmed: { bg: '#DBEAFE', text: '#1E40AF' },
        processing: { bg: '#FEF3C7', text: '#92400E' },
        shipped: { bg: 'rgba(139, 92, 246, 0.1)', text: colors.primary },
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
            <SafeAreaView style={styles.container} edges={['top']}>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.title}>My Orders</Text>
                </View>

                {/* Main Tabs (Bookings vs Shop) */}
                <View style={styles.mainTabs}>
                    <TouchableOpacity
                        style={[styles.mainTab, activeTab === 'appointments' && styles.mainTabActive]}
                        onPress={() => setActiveTab('appointments')}
                    >
                        <Text style={[styles.mainTabText, activeTab === 'appointments' && styles.mainTabTextActive]}>
                            Bookings
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.mainTab, activeTab === 'products' && styles.mainTabActive]}
                        onPress={() => setActiveTab('products')}
                    >
                        <Text style={[styles.mainTabText, activeTab === 'products' && styles.mainTabTextActive]}>
                            Shop Orders
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Sub Tabs (Only for Appointments) */}
                {activeTab === 'appointments' && (
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
                )}

                <ScrollView
                    contentContainerStyle={styles.content}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} />
                    }
                >
                    {activeTab === 'appointments' ? (
                        // --- APPOINTMENTS LIST ---
                        (subTab === 'upcoming' ? upcomingAppointments : pastAppointments).length > 0 ? (
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
                                                    {apt.status.charAt(0).toUpperCase() + apt.status.slice(1)}
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
                            </View>
                        )
                    ) : (
                        // --- PRODUCT ORDERS LIST ---
                        productOrders.length > 0 ? (
                            productOrders.map((order) => {
                                const orderDate = new Date(order.created_at);
                                const statusStyle = productStatusColors[order.status] || productStatusColors.confirmed;

                                return (
                                    <Card key={order.id} style={styles.card} variant="glass">
                                        <View style={styles.cardHeader}>
                                            <View>
                                                <Text style={styles.cardTitle}>Order #{order.id.slice(0, 8).toUpperCase()}</Text>
                                                <Text style={styles.cardSubtitle}>
                                                    {format(orderDate, 'MMM d, yyyy • HH:mm')}
                                                </Text>
                                            </View>
                                            <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
                                                <Text style={[styles.statusText, { color: statusStyle.text }]}>
                                                    {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                                                </Text>
                                            </View>
                                        </View>

                                        <View style={styles.cardDetails}>
                                            {order.items?.map((item, index) => (
                                                <View key={index} style={styles.orderItemRow}>
                                                    <Text style={styles.orderItemName} numberOfLines={1}>
                                                        {item.quantity}x {item.product_name}
                                                    </Text>
                                                    <Text style={styles.orderItemPrice}>
                                                        €{(item.price * item.quantity).toFixed(2)}
                                                    </Text>
                                                </View>
                                            ))}
                                        </View>

                                        <View style={styles.cardFooter}>
                                            <View style={styles.paymentMethod}>
                                                <Text style={styles.paymentMethodIcon}>💵</Text>
                                                <Text style={styles.paymentMethodText}>Cash on Delivery</Text>
                                            </View>
                                            <Text style={styles.price}>Total: €{order.total.toFixed(2)}</Text>
                                        </View>
                                    </Card>
                                );
                            })
                        ) : (
                            <View style={styles.emptyState}>
                                <Text style={styles.emptyIcon}>🛍️</Text>
                                <Text style={styles.emptyText}>No orders yet</Text>
                                <TouchableOpacity
                                    style={styles.shopNowButton}
                                    onPress={() => navigation.navigate('Shop')}
                                >
                                    <Text style={styles.shopNowButtonText}>Go to Shop</Text>
                                </TouchableOpacity>
                            </View>
                        )
                    )}
                </ScrollView>
            </SafeAreaView>

            {/* Modals remain unchanged ... */}
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
                            Are you sure you want to cancel this appointment? This action cannot be undone.
                        </Text>
                        <View style={styles.dialogButtons}>
                            <TouchableOpacity
                                style={styles.dialogButtonCancel}
                                onPress={() => setAppointmentToCancel(null)}
                            >
                                <Text style={styles.dialogButtonCancelText}>No, Keep it</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.dialogButtonConfirm}
                                onPress={confirmCancel}
                            >
                                <Text style={styles.dialogButtonConfirmText}>Yes, Cancel</Text>
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
                                            styles.timeText,
                                            selectedTime === time && styles.timeTextActive,
                                        ]}>
                                            {time}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <Button
                                title={rescheduleLoading ? 'Updating...' : 'Confirm Reschedule'}
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
    header: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm },
    title: { fontSize: 28, fontWeight: '600', color: colors.text },

    // Tabs
    mainTabs: { flexDirection: 'row', paddingHorizontal: spacing.lg, marginBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
    mainTab: { marginRight: spacing.xl, paddingVertical: spacing.md },
    mainTabActive: { borderBottomWidth: 2, borderBottomColor: colors.primary },
    mainTabText: { fontSize: 16, fontWeight: '500', color: colors.textSecondary },
    mainTabTextActive: { color: colors.text, fontWeight: '600' },

    subTabs: { flexDirection: 'row', paddingHorizontal: spacing.lg, marginBottom: spacing.md, gap: spacing.md },
    subTab: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.05)' },
    subTabActive: { backgroundColor: colors.surfaceLight },
    subTabText: { fontSize: 13, color: colors.textSecondary },
    subTabTextActive: { color: colors.text, fontWeight: '500' },

    content: { padding: spacing.lg },

    // Card
    card: { marginBottom: spacing.md, padding: spacing.lg },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.md },
    cardTitle: { fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: 2 },
    cardSubtitle: { fontSize: 13, color: colors.textSecondary },

    statusBadge: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: 6 },
    statusText: { fontSize: 11, fontWeight: '600' },

    cardDetails: { marginBottom: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' },
    detailRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
    detailIcon: { fontSize: 16, marginRight: spacing.sm },
    detailText: { fontSize: 14, color: colors.textSecondary },

    // Order Item
    orderItemRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
    orderItemName: { flex: 1, color: colors.textSecondary, fontSize: 14, marginRight: spacing.sm },
    orderItemPrice: { color: colors.text, fontSize: 14, fontWeight: '500' },

    // Footer
    cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' },
    price: { fontSize: 18, fontWeight: '700', color: colors.primary },
    paymentMethod: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    paymentMethodIcon: { fontSize: 16 },
    paymentMethodText: { fontSize: 12, color: colors.textSecondary },

    actionButtons: { flexDirection: 'row', gap: spacing.sm },
    chatButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
    chatButtonText: { fontSize: 16 },
    rescheduleButton: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: 10, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, justifyContent: 'center', height: 36 },
    rescheduleButtonText: { fontSize: 12, fontWeight: '500', color: colors.text },
    cancelButton: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: 10, backgroundColor: 'rgba(239, 68, 68, 0.1)', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.3)', height: 36 },
    cancelButtonText: { fontSize: 12, fontWeight: '600', color: colors.error },

    emptyState: { alignItems: 'center', paddingVertical: spacing.xxxl },
    emptyIcon: { fontSize: 56, marginBottom: spacing.lg, opacity: 0.5 },
    emptyText: { fontSize: 16, fontWeight: '500', color: colors.text, marginBottom: spacing.xs },
    shopNowButton: { marginTop: spacing.lg, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, backgroundColor: colors.primary, borderRadius: 12 },
    shopNowButtonText: { color: 'white', fontWeight: '600' },

    // Modals
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
});

export default OrdersScreen;
