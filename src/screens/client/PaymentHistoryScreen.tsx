import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    FlatList,
} from 'react-native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { format } from 'date-fns';
import PagerView from 'react-native-pager-view';
import { safeGoBack } from '../../navigation/navigationUtils';
import { useMenuBackHandler } from '../../hooks/useMenuBackHandler';
import { ScreenBackground, MerakiText } from '../../components/ui';
import { colors, spacing } from '../../theme';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { centsToEuros } from '../../services/stripeService';

interface Payment {
    id: string;
    amount: number;
    currency: string;
    status: string;
    payment_type: 'booking' | 'shop' | 'no_show';
    description: string | null;
    created_at: string;
    appointment_id: string | null;
    order_id: string | null;
}

const HISTORY_TABS = [
    { id: 'all', label: 'All' },
    { id: 'booking', label: 'Bookings' },
    { id: 'shop', label: 'Orders' },
] as const;

type HistoryTab = typeof HISTORY_TABS[number]['id'];

export function PaymentHistoryScreen() {
    const navigation = useNavigation<any>();
    const handleBack = useMenuBackHandler();
    const { user } = useAuth();
    const [payments, setPayments] = useState<Payment[]>([]);
    const [activeTab, setActiveTab] = useState<number>(0);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const pagerRef = useRef<PagerView>(null);

    const fetchPayments = useCallback(async () => {
        if (!user) return;

        try {
            const { data, error } = await (supabase as any)
                .from('payments')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setPayments(data || []);
        } catch (error) {
            console.error('Error fetching payments:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [user]);

    useEffect(() => {
        fetchPayments();
    }, [fetchPayments]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchPayments();
    };

    const handleTabPress = (index: number) => {
        setActiveTab(index);
        pagerRef.current?.setPage(index);
    };

    const handlePageSelected = (e: any) => {
        setActiveTab(e.nativeEvent.position);
    };

    const getStatusStyle = (status: string) => {
        switch (status) {
            case 'succeeded':
                return { bg: 'rgba(34, 197, 94, 0.1)', text: '#22C55E', border: 'rgba(34, 197, 94, 0.2)' };
            case 'requires_capture':
                return { bg: 'rgba(234, 179, 8, 0.1)', text: '#EAB308', border: 'rgba(234, 179, 8, 0.2)' };
            case 'processing':
                return { bg: 'rgba(59, 130, 246, 0.1)', text: '#3B82F6', border: 'rgba(59, 130, 246, 0.2)' };
            case 'failed':
            case 'cancelled':
                return { bg: 'rgba(239, 68, 68, 0.1)', text: '#EF4444', border: 'rgba(239, 68, 68, 0.2)' };
            case 'refunded':
                return { bg: 'rgba(139, 92, 246, 0.1)', text: '#8B5CF6', border: 'rgba(139, 92, 246, 0.2)' };
            default:
                return { bg: 'rgba(107, 114, 128, 0.1)', text: '#9CA3AF', border: 'rgba(107, 114, 128, 0.2)' };
        }
    };

    const getIconForType = (type: string) => {
        switch (type) {
            case 'booking':
                return 'calendar-check';
            case 'shop':
                return 'shopping';
            case 'no_show':
                return 'alert-circle';
            default:
                return 'credit-card';
        }
    };

    const formatStatus = (status: string) => {
        const labels: Record<string, string> = {
            succeeded: 'Paid',
            requires_capture: 'Authorized',
            processing: 'Processing',
            failed: 'Failed',
            cancelled: 'Cancelled',
            refunded: 'Refunded',
        };
        return labels[status] || status.charAt(0).toUpperCase() + status.slice(1);
    };

    const renderPaymentItem = ({ item: payment }: { item: Payment }) => {
        const statusStyle = getStatusStyle(payment.status);
        const iconName = getIconForType(payment.payment_type);

        return (
            <View key={payment.id} style={styles.stitchCard}>
                {/* Top Row: Icon + Type + Amount */}
                <View style={styles.cardHeader}>
                    <View style={styles.typeContainer}>
                        <View style={styles.iconContainer}>
                            <MaterialCommunityIcons name={iconName} size={20} color={colors.primary} />
                        </View>
                        <View>
                            <MerakiText variant="body" color={colors.text} style={styles.paymentType}>
                                {payment.payment_type === 'booking' ? 'Appointment' :
                                    payment.payment_type === 'shop' ? 'Shop Order' :
                                        payment.payment_type === 'no_show' ? 'No-Show Fee' : 'Payment'}
                            </MerakiText>
                            <MerakiText variant="caption" color={colors.textSecondary}>
                                {format(new Date(payment.created_at), 'MMM d, yyyy • HH:mm')}
                            </MerakiText>
                        </View>
                    </View>
                    <View style={styles.amountContainer}>
                        <MerakiText variant="h3" color={colors.text}>
                            €{centsToEuros(payment.amount).toFixed(2)}
                        </MerakiText>
                    </View>
                </View>

                {/* Description (if any) */}
                {payment.description && (
                    <View style={styles.descriptionContainer}>
                        <MerakiText variant="caption" color={colors.textSecondary} numberOfLines={2}>
                            {payment.description}
                        </MerakiText>
                    </View>
                )}

                {/* Footer: ID + Status Badge */}
                <View style={styles.cardFooter}>
                    <MerakiText variant="caption" color={colors.textMuted} style={styles.idText}>
                        ID: {payment.id.slice(0, 8).toUpperCase()}
                    </MerakiText>
                    <View style={[
                        styles.statusBadge,
                        { backgroundColor: statusStyle.bg, borderColor: statusStyle.border }
                    ]}>
                        <MerakiText
                            variant="caption"
                            style={[styles.statusText, { color: statusStyle.text }]}
                        >
                            {formatStatus(payment.status)}
                        </MerakiText>
                    </View>
                </View>
            </View>
        );
    };

    const renderList = (filterType: HistoryTab) => {
        const filteredData = filterType === 'all'
            ? payments
            : payments.filter(p => p.payment_type === filterType);

        if (loading && !refreshing) {
            return (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.text} />
                </View>
            );
        }

        if (filteredData.length === 0) {
            return (
                <ScrollView
                    contentContainerStyle={styles.emptyStateContainer}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} />
                    }
                >
                    <View style={styles.emptyState}>
                        <View style={styles.emptyIconContainer}>
                            <MaterialCommunityIcons name="history" size={36} color={colors.textMuted} />
                        </View>
                        <MerakiText variant="body" color={colors.text} style={styles.emptyText}>
                            No {filterType === 'all' ? 'payments' : filterType === 'booking' ? 'bookings' : 'orders'} found
                        </MerakiText>
                    </View>
                </ScrollView>
            );
        }

        return (
            <FlatList
                data={filteredData}
                renderItem={renderPaymentItem}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.content}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} />
                }
                showsVerticalScrollIndicator={false}
            />
        );
    };

    return (
        <ScreenBackground>
            <SafeAreaView style={styles.container} edges={['top']}>
                {/* Header — Stitch Style */}
                <View style={styles.header}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={handleBack}
                    >
                        <MaterialIcons name="arrow-back" size={20} color={colors.text} />
                    </TouchableOpacity>
                    <MerakiText variant="h1" style={styles.headerTitle}>Order History</MerakiText>
                    <View style={styles.headerRightPlaceholder} />
                </View>

                {/* Tabs */}
                <View style={styles.tabsContainer}>
                    <View style={styles.tabBar}>
                        {HISTORY_TABS.map((tab, index) => (
                            <TouchableOpacity
                                key={tab.id}
                                style={[
                                    styles.tabItem,
                                    activeTab === index && styles.tabItemActive
                                ]}
                                onPress={() => handleTabPress(index)}
                            >
                                <MerakiText
                                    variant="label"
                                    style={[
                                        styles.tabText,
                                        activeTab === index && styles.tabTextActive
                                    ]}
                                >
                                    {tab.label}
                                </MerakiText>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Content Pager */}
                <PagerView
                    ref={pagerRef}
                    style={styles.pagerView}
                    initialPage={0}
                    onPageSelected={handlePageSelected}
                >
                    <View key="all" style={styles.page}>
                        {renderList('all')}
                    </View>
                    <View key="booking" style={styles.page}>
                        {renderList('booking')}
                    </View>
                    <View key="shop" style={styles.page}>
                        {renderList('shop')}
                    </View>
                </PagerView>
            </SafeAreaView>
        </ScreenBackground>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    pagerView: { flex: 1 },
    page: { flex: 1 },

    // Header
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: colors.text,
    },
    headerRightPlaceholder: { width: 40 },

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

    // Content
    content: {
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.xxl
    },

    // Card
    stitchCard: {
        backgroundColor: 'rgba(30, 30, 35, 0.70)',
        borderRadius: 16,
        padding: spacing.md,
        marginBottom: spacing.md,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.06)',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: spacing.sm,
    },
    typeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: 'rgba(200, 160, 77, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.sm,
    },
    paymentType: {
        fontWeight: '600',
        marginBottom: 2,
    },
    amountContainer: {
        alignItems: 'flex-end',
    },

    // Description
    descriptionContainer: {
        marginTop: spacing.xs,
        marginBottom: spacing.md,
        paddingLeft: 48 + spacing.sm, // Align with text start
    },

    // Footer
    cardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: spacing.sm,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255, 255, 255, 0.06)',
    },
    idText: {
        fontSize: 10,
        fontFamily: 'monospace',
        opacity: 0.7,
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
        borderWidth: 1,
    },
    statusText: {
        fontSize: 10,
        fontWeight: '700',
        textTransform: 'uppercase',
    },

    // Empty State
    emptyStateContainer: {
        flexGrow: 1,
        justifyContent: 'center',
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: spacing.xxl,
        marginTop: spacing.xl,
    },
    emptyIconContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    emptyText: {
        fontSize: 16,
        fontWeight: '500',
        opacity: 0.8,
    },
});

export default PaymentHistoryScreen;
