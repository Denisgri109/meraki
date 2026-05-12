import React, { useState, useCallback } from 'react';
import {
    View,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    RefreshControl,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Card, ScreenBackground, MerakiText } from '../../components/ui';
import { colors, spacing } from '../../theme';
import { SHIPPING_STATUS_CONFIG, ShippingStatus, getCountryName } from '../../utils/shippingUtils';

type Order = {
    id: string;
    created_at: string;
    total: number;
    status: string;
    shipping_status: ShippingStatus | null;
    shipping_name: string | null;
    shipping_city: string | null;
    shipping_country: string | null;
    shipping_cost: number | null;
    user_id: string;
    customer: {
        full_name: string | null;
        avatar_url: string | null;
        email: string | null;
    } | null;
    order_items: {
        id: string;
        product_name: string;
        quantity: number;
        price: number;
    }[];
};

export function OwnerOrdersScreen() {
    const navigation = useNavigation<any>();
    const { user } = useAuth();
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    useFocusEffect(
        useCallback(() => {
            fetchOrders();
        }, [user?.id])
    );

    const fetchOrders = async () => {
        try {
            const { data, error } = await (supabase as any)
                .from('orders')
                .select(`
                    id, created_at, total, status,
                    shipping_status, shipping_name, shipping_phone, shipping_address,
                    shipping_city, shipping_postal_code, shipping_country, shipping_cost,
                    user_id,
                    customer:profiles!orders_user_id_fkey(full_name, avatar_url, email),
                    order_items(id, product_name, quantity, price)
                `)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setOrders(data || []);
        } catch (error) {
            console.error('Error fetching orders:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleRefresh = () => {
        setRefreshing(true);
        fetchOrders();
    };

    const getStatusConfig = (status: string | null) => {
        const s = (status || 'pending') as ShippingStatus;
        return SHIPPING_STATUS_CONFIG[s] || SHIPPING_STATUS_CONFIG.pending;
    };

    if (loading) return (
        <ScreenBackground>
            <SafeAreaView style={styles.container}>
                <ActivityIndicator size="large" color={colors.accent} style={styles.loader} />
            </SafeAreaView>
        </ScreenBackground>
    );

    return (
        <ScreenBackground>
            <SafeAreaView style={styles.container} edges={['top']}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <MerakiText variant="h2">Customer Orders</MerakiText>
                    <View style={{ width: 40 }} />
                </View>

                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={handleRefresh}
                            tintColor={colors.accent}
                        />
                    }
                >
                    {orders.length === 0 ? (
                        <Card variant="glass" style={styles.emptyCard}>
                            <MaterialCommunityIcons
                                name="package-variant"
                                size={48}
                                color={colors.textMuted}
                                style={{ opacity: 0.3, marginBottom: spacing.sm }}
                            />
                            <MerakiText variant="body" color={colors.textMuted}>
                                No orders yet
                            </MerakiText>
                        </Card>
                    ) : (
                        orders.map((order) => {
                            const statusConfig = getStatusConfig(order.shipping_status);
                            const itemCount = order.order_items?.length || 0;

                            return (
                                <TouchableOpacity
                                    key={order.id}
                                    activeOpacity={0.7}
                                    onPress={() => navigation.navigate('OrderDetail', { order })}
                                >
                                    <Card variant="glass" style={styles.orderCard} noPadding>
                                        <View style={styles.orderContent}>
                                            {/* Top row: customer + date */}
                                            <View style={styles.orderTopRow}>
                                                <View style={styles.customerInfo}>
                                                    <View style={styles.customerAvatar}>
                                                        <MerakiText variant="bodyBold" color="#FFF">
                                                            {(order.shipping_name || order.customer?.full_name || '?')[0].toUpperCase()}
                                                        </MerakiText>
                                                    </View>
                                                    <View style={styles.customerText}>
                                                        <MerakiText variant="bodyBold" numberOfLines={1}>
                                                            {order.shipping_name || order.customer?.full_name || 'Unknown'}
                                                        </MerakiText>
                                                        <MerakiText variant="caption" color={colors.textMuted}>
                                                            {format(new Date(order.created_at), 'dd MMM yyyy, HH:mm')}
                                                        </MerakiText>
                                                    </View>
                                                </View>
                                                <View style={[styles.statusBadge, { backgroundColor: `${statusConfig.color}20` }]}>
                                                    <MaterialCommunityIcons
                                                        name={statusConfig.icon as any}
                                                        size={14}
                                                        color={statusConfig.color}
                                                    />
                                                    <MerakiText variant="caption" color={statusConfig.color} style={{ marginLeft: 4 }}>
                                                        {statusConfig.label}
                                                    </MerakiText>
                                                </View>
                                            </View>

                                            {/* Middle: items summary */}
                                            <View style={styles.orderMiddle}>
                                                <MerakiText variant="caption" color={colors.textSecondary}>
                                                    {itemCount} {itemCount === 1 ? 'item' : 'items'}
                                                    {order.shipping_city ? ` · ${order.shipping_city}` : ''}
                                                    {order.shipping_country ? `, ${getCountryName(order.shipping_country)}` : ''}
                                                </MerakiText>
                                            </View>

                                            {/* Bottom: total */}
                                            <View style={styles.orderBottom}>
                                                <MerakiText variant="h3" color={colors.accent}>
                                                    €{(order.total || 0).toFixed(2)}
                                                </MerakiText>
                                                <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />
                                            </View>
                                        </View>
                                    </Card>
                                </TouchableOpacity>
                            );
                        })
                    )}
                </ScrollView>
            </SafeAreaView>
        </ScreenBackground>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    loader: { flex: 1, justifyContent: 'center' },
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
        backgroundColor: 'rgba(0, 0, 0, 0.04)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    scrollContent: {
        paddingHorizontal: spacing.lg,
        paddingBottom: 120,
    },
    emptyCard: {
        alignItems: 'center',
        paddingVertical: spacing.xxl,
    },
    orderCard: {
        marginBottom: spacing.md,
    },
    orderContent: {
        padding: spacing.md,
    },
    orderTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: spacing.sm,
    },
    customerInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginRight: spacing.sm,
    },
    customerAvatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(200, 160, 77, 0.3)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: spacing.sm,
    },
    customerText: {
        flex: 1,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    orderMiddle: {
        marginBottom: spacing.sm,
        paddingLeft: 36 + spacing.sm,
    },
    orderBottom: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingLeft: 36 + spacing.sm,
    },
});

export default OwnerOrdersScreen;
