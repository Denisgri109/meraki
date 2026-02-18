import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Alert,
    Modal,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { Card, ScreenBackground, MerakiText } from '../../components/ui';
import { colors, spacing } from '../../theme';
import {
    SHIPPING_STATUS_CONFIG,
    ShippingStatus,
    getCountryName,
} from '../../utils/shippingUtils';

const STATUS_FLOW: ShippingStatus[] = ['pending', 'processing', 'shipped', 'delivered'];

export function OwnerOrderDetailScreen() {
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const [order, setOrder] = useState(route.params?.order);
    const [updating, setUpdating] = useState(false);
    const [previousStatus, setPreviousStatus] = useState<ShippingStatus | null>(null);
    const [showUndoBanner, setShowUndoBanner] = useState(false);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [pendingStatus, setPendingStatus] = useState<ShippingStatus | null>(null);
    const [undoTimer, setUndoTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

    const currentStatus = (order?.shipping_status || 'pending') as ShippingStatus;
    const statusConfig = SHIPPING_STATUS_CONFIG[currentStatus] || SHIPPING_STATUS_CONFIG.pending;

    // Fetch full order data on mount to ensure we have everything
    useEffect(() => {
        fetchFullOrder();
    }, []);

    const fetchFullOrder = async () => {
        if (!order?.id) return;
        try {
            const { data, error } = await (supabase as any)
                .from('orders')
                .select(`
                    id, created_at, total, status, notes,
                    shipping_status, shipping_name, shipping_phone, shipping_address,
                    shipping_city, shipping_postal_code, shipping_country, shipping_cost,
                    user_id,
                    customer:profiles!orders_user_id_fkey(full_name, avatar_url, email),
                    order_items(id, product_name, quantity, price)
                `)
                .eq('id', order.id)
                .single();

            if (error) throw error;
            if (data) setOrder(data);
        } catch (err) {
            console.error('Error fetching full order:', err);
        }
    };

    // Cleanup undo timer on unmount
    useEffect(() => {
        return () => {
            if (undoTimer) clearTimeout(undoTimer);
        };
    }, [undoTimer]);

    const confirmStatusChange = (newStatus: ShippingStatus) => {
        setPendingStatus(newStatus);
        setShowConfirmModal(true);
    };

    const handleUpdateStatus = async (newStatus: ShippingStatus) => {
        setShowConfirmModal(false);
        setUpdating(true);
        const oldStatus = currentStatus;

        try {
            const { error } = await (supabase as any)
                .from('orders')
                .update({ shipping_status: newStatus })
                .eq('id', order.id);

            if (error) throw error;

            setPreviousStatus(oldStatus);
            setOrder({ ...order, shipping_status: newStatus });
            setShowUndoBanner(true);

            // Auto-hide undo banner after 8 seconds
            if (undoTimer) clearTimeout(undoTimer);
            const timer = setTimeout(() => {
                setShowUndoBanner(false);
                setPreviousStatus(null);
            }, 8000);
            setUndoTimer(timer);
        } catch (err: any) {
            Alert.alert('Error', err.message);
        } finally {
            setUpdating(false);
        }
    };

    const handleUndo = async () => {
        if (!previousStatus) return;
        setUpdating(true);
        setShowUndoBanner(false);
        if (undoTimer) clearTimeout(undoTimer);

        try {
            const { error } = await (supabase as any)
                .from('orders')
                .update({ shipping_status: previousStatus })
                .eq('id', order.id);

            if (error) throw error;

            setOrder({ ...order, shipping_status: previousStatus });
            setPreviousStatus(null);
        } catch (err: any) {
            Alert.alert('Error', err.message);
        } finally {
            setUpdating(false);
        }
    };

    const getNextStatus = (): ShippingStatus | null => {
        const idx = STATUS_FLOW.indexOf(currentStatus);
        if (idx < 0 || idx >= STATUS_FLOW.length - 1) return null;
        return STATUS_FLOW[idx + 1];
    };

    const nextStatus = getNextStatus();
    const subtotal = (order?.total || 0) - (order?.shipping_cost || 0);
    const items = order?.order_items || [];

    return (
        <ScreenBackground>
            <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <MerakiText variant="h2">Order Detail</MerakiText>
                    <View style={{ width: 40 }} />
                </View>

                {/* Undo Banner */}
                {showUndoBanner && previousStatus && (
                    <View style={styles.undoBanner}>
                        <View style={styles.undoContent}>
                            <MaterialCommunityIcons name="check-circle" size={20} color="#4ADE80" />
                            <MerakiText variant="body" style={styles.undoText}>
                                Status updated to "{SHIPPING_STATUS_CONFIG[currentStatus].label}"
                            </MerakiText>
                        </View>
                        <TouchableOpacity
                            style={styles.undoButton}
                            onPress={handleUndo}
                            disabled={updating}
                        >
                            <MerakiText variant="bodyBold" color={colors.accent}>
                                UNDO
                            </MerakiText>
                        </TouchableOpacity>
                    </View>
                )}

                <ScrollView contentContainerStyle={styles.scrollContent}>
                    {/* Order ID + Date */}
                    <View style={styles.orderIdRow}>
                        <MerakiText variant="caption" color={colors.textMuted}>
                            ORDER #{order?.id?.slice(0, 8).toUpperCase()}
                        </MerakiText>
                        <MerakiText variant="caption" color={colors.textMuted}>
                            {order?.created_at ? format(new Date(order.created_at), 'dd MMM yyyy, HH:mm') : ''}
                        </MerakiText>
                    </View>

                    {/* Shipping Status */}
                    <Card variant="glass" style={styles.statusCard}>
                        <View style={styles.statusHeaderRow}>
                            <MerakiText variant="label" color={colors.textMuted}>SHIPPING STATUS</MerakiText>
                            <View style={[styles.statusBadge, { backgroundColor: `${statusConfig.color}20` }]}>
                                <MaterialCommunityIcons
                                    name={statusConfig.icon as any}
                                    size={16}
                                    color={statusConfig.color}
                                />
                                <MerakiText variant="bodyBold" color={statusConfig.color} style={{ marginLeft: 6 }}>
                                    {statusConfig.label}
                                </MerakiText>
                            </View>
                        </View>

                        {/* Status Timeline */}
                        <View style={styles.timeline}>
                            {STATUS_FLOW.map((status, index) => {
                                const config = SHIPPING_STATUS_CONFIG[status];
                                const currentIdx = STATUS_FLOW.indexOf(currentStatus);
                                const isActive = index <= currentIdx;
                                const isCurrent = status === currentStatus;

                                return (
                                    <View key={status} style={styles.timelineItem}>
                                        <View style={[
                                            styles.timelineDot,
                                            isActive && { backgroundColor: config.color },
                                            isCurrent && { borderWidth: 2, borderColor: '#FFF' },
                                        ]}>
                                            <MaterialCommunityIcons
                                                name={config.icon as any}
                                                size={14}
                                                color={isActive ? '#FFF' : colors.textMuted}
                                            />
                                        </View>
                                        {index < STATUS_FLOW.length - 1 && (
                                            <View style={[
                                                styles.timelineLine,
                                                isActive && index < currentIdx && { backgroundColor: config.color },
                                            ]} />
                                        )}
                                        <MerakiText
                                            variant="caption"
                                            color={isActive ? colors.text : colors.textMuted}
                                            style={styles.timelineLabel}
                                        >
                                            {config.label}
                                        </MerakiText>
                                    </View>
                                );
                            })}
                        </View>

                        {/* Update Status Button */}
                        {nextStatus && (
                            <TouchableOpacity
                                style={[styles.updateBtn, { backgroundColor: SHIPPING_STATUS_CONFIG[nextStatus].color }]}
                                onPress={() => confirmStatusChange(nextStatus)}
                                disabled={updating}
                            >
                                {updating ? (
                                    <ActivityIndicator color="#FFF" size="small" />
                                ) : (
                                    <>
                                        <MaterialCommunityIcons
                                            name={SHIPPING_STATUS_CONFIG[nextStatus].icon as any}
                                            size={18}
                                            color="#FFF"
                                        />
                                        <MerakiText variant="bodyBold" color="#FFF" style={{ marginLeft: 8 }}>
                                            Mark as {SHIPPING_STATUS_CONFIG[nextStatus].label}
                                        </MerakiText>
                                    </>
                                )}
                            </TouchableOpacity>
                        )}
                    </Card>

                    {/* Customer Info */}
                    <Card variant="glass" style={styles.sectionCard}>
                        <MerakiText variant="label" color={colors.textMuted} style={styles.cardLabel}>
                            CUSTOMER
                        </MerakiText>
                        <View style={styles.detailRow}>
                            <MaterialCommunityIcons name="account" size={18} color={colors.accent} />
                            <MerakiText variant="body" style={styles.detailText}>
                                {order?.customer?.full_name || order?.shipping_name || 'Unknown'}
                            </MerakiText>
                        </View>
                        {order?.customer?.email && (
                            <View style={styles.detailRow}>
                                <MaterialCommunityIcons name="email-outline" size={18} color={colors.accent} />
                                <MerakiText variant="body" style={styles.detailText}>
                                    {order.customer.email}
                                </MerakiText>
                            </View>
                        )}
                    </Card>

                    {/* Shipping Address */}
                    <Card variant="glass" style={styles.sectionCard}>
                        <MerakiText variant="label" color={colors.textMuted} style={styles.cardLabel}>
                            SHIPPING ADDRESS
                        </MerakiText>
                        <View style={styles.detailRow}>
                            <MaterialCommunityIcons name="account" size={18} color={colors.accent} />
                            <MerakiText variant="body" style={styles.detailText}>
                                {order?.shipping_name || 'N/A'}
                            </MerakiText>
                        </View>
                        {order?.shipping_phone ? (
                            <View style={styles.detailRow}>
                                <MaterialCommunityIcons name="phone" size={18} color={colors.accent} />
                                <MerakiText variant="body" style={styles.detailText}>
                                    {order.shipping_phone}
                                </MerakiText>
                            </View>
                        ) : null}
                        {order?.shipping_address ? (
                            <View style={styles.detailRow}>
                                <MaterialCommunityIcons name="map-marker" size={18} color={colors.accent} />
                                <MerakiText variant="body" style={styles.detailText}>
                                    {order.shipping_address}
                                </MerakiText>
                            </View>
                        ) : null}
                        <View style={styles.detailRow}>
                            <MaterialCommunityIcons name="city" size={18} color={colors.accent} />
                            <MerakiText variant="body" style={styles.detailText}>
                                {[order?.shipping_city, order?.shipping_postal_code].filter(Boolean).join(', ') || 'N/A'}
                            </MerakiText>
                        </View>
                        <View style={styles.detailRow}>
                            <MaterialCommunityIcons name="earth" size={18} color={colors.accent} />
                            <MerakiText variant="body" style={styles.detailText}>
                                {order?.shipping_country ? getCountryName(order.shipping_country) : 'N/A'}
                            </MerakiText>
                        </View>
                    </Card>

                    {/* Items */}
                    <Card variant="glass" style={styles.sectionCard}>
                        <MerakiText variant="label" color={colors.textMuted} style={styles.cardLabel}>
                            ITEMS ORDERED ({items.length})
                        </MerakiText>
                        {items.length > 0 ? (
                            items.map((item: any, index: number) => (
                                <View key={item.id || index} style={[
                                    styles.itemRow,
                                    index === items.length - 1 && { borderBottomWidth: 0 },
                                ]}>
                                    <View style={styles.itemBullet}>
                                        <MerakiText variant="caption" color={colors.accent}>
                                            {item.quantity}x
                                        </MerakiText>
                                    </View>
                                    <View style={styles.itemInfo}>
                                        <MerakiText variant="body" numberOfLines={2}>
                                            {item.product_name || 'Unknown Product'}
                                        </MerakiText>
                                        <MerakiText variant="caption" color={colors.textMuted}>
                                            €{(item.price || 0).toFixed(2)} each
                                        </MerakiText>
                                    </View>
                                    <MerakiText variant="bodyBold" color={colors.accent}>
                                        €{((item.price || 0) * (item.quantity || 1)).toFixed(2)}
                                    </MerakiText>
                                </View>
                            ))
                        ) : (
                            <View style={styles.emptyItems}>
                                <MaterialCommunityIcons name="package-variant" size={32} color={colors.textMuted} style={{ opacity: 0.3 }} />
                                <MerakiText variant="caption" color={colors.textMuted} style={{ marginTop: 8 }}>
                                    No items found
                                </MerakiText>
                            </View>
                        )}
                    </Card>

                    {/* Order Total */}
                    <Card variant="glass" style={styles.sectionCard}>
                        <MerakiText variant="label" color={colors.textMuted} style={styles.cardLabel}>
                            PAYMENT SUMMARY
                        </MerakiText>
                        <View style={styles.totalRow}>
                            <MerakiText variant="body" color={colors.textSecondary}>Subtotal</MerakiText>
                            <MerakiText variant="body" color={colors.textSecondary}>
                                €{subtotal.toFixed(2)}
                            </MerakiText>
                        </View>
                        <View style={styles.totalRow}>
                            <MerakiText variant="body" color={colors.textSecondary}>Shipping</MerakiText>
                            <MerakiText variant="body" color={colors.textSecondary}>
                                €{(order?.shipping_cost || 0).toFixed(2)}
                            </MerakiText>
                        </View>
                        <View style={styles.totalDivider} />
                        <View style={styles.totalRow}>
                            <MerakiText variant="h3">Total</MerakiText>
                            <MerakiText variant="h2" color={colors.accent}>
                                €{(order?.total || 0).toFixed(2)}
                            </MerakiText>
                        </View>
                    </Card>

                    {/* Notes */}
                    {order?.notes ? (
                        <Card variant="glass" style={styles.sectionCard}>
                            <MerakiText variant="label" color={colors.textMuted} style={styles.cardLabel}>
                                CUSTOMER NOTES
                            </MerakiText>
                            <MerakiText variant="body" color={colors.textSecondary}>
                                {order.notes}
                            </MerakiText>
                        </Card>
                    ) : null}
                </ScrollView>

                {/* Confirmation Modal */}
                <Modal
                    visible={showConfirmModal}
                    transparent
                    animationType="fade"
                    onRequestClose={() => setShowConfirmModal(false)}
                >
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalBackdrop} />
                        <View style={styles.modalContainer}>
                            {pendingStatus && (
                                <>
                                    <View style={[styles.modalIconBox, { backgroundColor: `${SHIPPING_STATUS_CONFIG[pendingStatus].color}20` }]}>
                                        <MaterialCommunityIcons
                                            name={SHIPPING_STATUS_CONFIG[pendingStatus].icon as any}
                                            size={32}
                                            color={SHIPPING_STATUS_CONFIG[pendingStatus].color}
                                        />
                                    </View>
                                    <MerakiText variant="h3" style={styles.modalTitle}>
                                        Update Shipping Status
                                    </MerakiText>
                                    <MerakiText variant="body" color={colors.textSecondary} style={styles.modalMessage}>
                                        Are you sure you want to mark this order as{' '}
                                        <MerakiText variant="bodyBold" color={SHIPPING_STATUS_CONFIG[pendingStatus].color}>
                                            {SHIPPING_STATUS_CONFIG[pendingStatus].label}
                                        </MerakiText>
                                        ?
                                    </MerakiText>
                                    <View style={styles.modalButtons}>
                                        <TouchableOpacity
                                            style={styles.modalCancelBtn}
                                            onPress={() => setShowConfirmModal(false)}
                                        >
                                            <MerakiText variant="bodyBold" color={colors.text}>Cancel</MerakiText>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[styles.modalConfirmBtn, { backgroundColor: SHIPPING_STATUS_CONFIG[pendingStatus].color }]}
                                            onPress={() => handleUpdateStatus(pendingStatus)}
                                        >
                                            <MerakiText variant="bodyBold" color="#FFF">Confirm</MerakiText>
                                        </TouchableOpacity>
                                    </View>
                                </>
                            )}
                        </View>
                    </View>
                </Modal>
            </SafeAreaView>
        </ScreenBackground>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
    },
    backBtn: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.05)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    scrollContent: {
        paddingHorizontal: spacing.lg,
        paddingBottom: 120,
    },
    orderIdRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: spacing.md,
    },
    // Undo Banner
    undoBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginHorizontal: spacing.lg,
        marginBottom: spacing.sm,
        paddingHorizontal: spacing.md,
        paddingVertical: 12,
        backgroundColor: 'rgba(74, 222, 128, 0.1)',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: 'rgba(74, 222, 128, 0.2)',
    },
    undoContent: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        gap: 8,
    },
    undoText: {
        flex: 1,
        fontSize: 13,
        color: colors.text,
    },
    undoButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 10,
        backgroundColor: 'rgba(200, 160, 77, 0.15)',
        borderWidth: 1,
        borderColor: 'rgba(200, 160, 77, 0.25)',
    },
    // Status Card
    statusCard: {
        marginBottom: spacing.md,
    },
    statusHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.lg,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
    },
    timeline: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: spacing.lg,
    },
    timelineItem: {
        alignItems: 'center',
        flex: 1,
        position: 'relative',
    },
    timelineDot: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 6,
    },
    timelineLine: {
        position: 'absolute',
        top: 16,
        left: '60%',
        right: '-40%',
        height: 2,
        backgroundColor: 'rgba(255,255,255,0.1)',
        zIndex: -1,
    },
    timelineLabel: {
        fontSize: 10,
        textAlign: 'center',
    },
    updateBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 14,
    },
    // Section Card
    sectionCard: {
        marginBottom: spacing.md,
    },
    cardLabel: {
        marginBottom: spacing.md,
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.sm,
        gap: spacing.sm,
    },
    detailText: {
        flex: 1,
    },
    // Items
    itemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.sm + 2,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
    },
    itemBullet: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: 'rgba(200, 160, 77, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: spacing.sm,
    },
    itemInfo: {
        flex: 1,
        marginRight: spacing.md,
    },
    emptyItems: {
        alignItems: 'center',
        paddingVertical: spacing.xl,
    },
    // Totals
    totalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
    totalDivider: {
        height: 1,
        backgroundColor: colors.border,
        marginVertical: spacing.sm,
    },
    // Confirmation Modal
    modalOverlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.lg,
    },
    modalBackdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.85)',
    },
    modalContainer: {
        width: '100%',
        maxWidth: 340,
        backgroundColor: colors.surface,
        borderRadius: 24,
        padding: spacing.xl,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
        elevation: 10,
    },
    modalIconBox: {
        width: 64,
        height: 64,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.md,
    },
    modalTitle: {
        textAlign: 'center',
        marginBottom: spacing.sm,
    },
    modalMessage: {
        textAlign: 'center',
        marginBottom: spacing.xl,
        lineHeight: 22,
    },
    modalButtons: {
        flexDirection: 'row',
        gap: spacing.md,
        width: '100%',
    },
    modalCancelBtn: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 14,
        backgroundColor: 'rgba(255,255,255,0.06)',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.border,
    },
    modalConfirmBtn: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 14,
        alignItems: 'center',
    },
});

export default OwnerOrderDetailScreen;
