import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { format } from 'date-fns';
import { Card, ScreenBackground } from '../../components/ui';
import { colors, spacing } from '../../theme';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { centsToEuros } from '../../services/stripeService';

interface Payment {
    id: string;
    amount: number;
    currency: string;
    status: string;
    payment_type: string;
    description: string | null;
    created_at: string;
    appointment_id: string | null;
    order_id: string | null;
}

const STATUS_COLORS: Record<string, string> = {
    succeeded: '#22C55E',
    requires_capture: '#F59E0B',
    processing: '#3B82F6',
    failed: '#EF4444',
    cancelled: '#9CA3AF',
    refunded: '#8B5CF6',
};

const STATUS_LABELS: Record<string, string> = {
    succeeded: 'Paid',
    requires_capture: 'Authorized',
    processing: 'Processing',
    failed: 'Failed',
    cancelled: 'Cancelled',
    refunded: 'Refunded',
};

const TYPE_ICONS: Record<string, string> = {
    booking: '💅',
    shop: '🛍️',
    no_show: '⚠️',
};

export function PaymentHistoryScreen() {
    const navigation = useNavigation();
    const { user } = useAuth();
    const [payments, setPayments] = useState<Payment[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

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

    if (loading) {
        return (
            <ScreenBackground>
                <SafeAreaView style={styles.container}>
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={colors.primary} />
                    </View>
                </SafeAreaView>
            </ScreenBackground>
        );
    }

    return (
        <ScreenBackground>
            <SafeAreaView style={styles.container} edges={['top']}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()}>
                        <Text style={styles.backButton}>← Back</Text>
                    </TouchableOpacity>
                    <Text style={styles.title}>Payment History</Text>
                    <Text style={styles.subtitle}>All your transactions</Text>
                </View>

                <ScrollView
                    contentContainerStyle={styles.content}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} />
                    }
                >
                    {payments.length > 0 ? (
                        payments.map((payment) => (
                            <Card key={payment.id} style={styles.paymentCard}>
                                <View style={styles.paymentHeader}>
                                    <View style={styles.paymentTypeContainer}>
                                        <Text style={styles.paymentIcon}>
                                            {TYPE_ICONS[payment.payment_type] || '💳'}
                                        </Text>
                                        <View>
                                            <Text style={styles.paymentType}>
                                                {payment.payment_type === 'booking' ? 'Appointment' :
                                                    payment.payment_type === 'shop' ? 'Shop Order' :
                                                        payment.payment_type === 'no_show' ? 'No-Show Fee' : 'Payment'}
                                            </Text>
                                            <Text style={styles.paymentDate}>
                                                {format(new Date(payment.created_at), 'MMM d, yyyy • HH:mm')}
                                            </Text>
                                        </View>
                                    </View>
                                    <View style={styles.paymentAmountContainer}>
                                        <Text style={styles.paymentAmount}>
                                            €{centsToEuros(payment.amount).toFixed(2)}
                                        </Text>
                                        <View style={[
                                            styles.statusBadge,
                                            { backgroundColor: `${STATUS_COLORS[payment.status] || '#9CA3AF'}20` }
                                        ]}>
                                            <Text style={[
                                                styles.statusText,
                                                { color: STATUS_COLORS[payment.status] || '#9CA3AF' }
                                            ]}>
                                                {STATUS_LABELS[payment.status] || payment.status}
                                            </Text>
                                        </View>
                                    </View>
                                </View>
                                {payment.description && (
                                    <Text style={styles.paymentDescription} numberOfLines={2}>
                                        {payment.description}
                                    </Text>
                                )}
                            </Card>
                        ))
                    ) : (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyIcon}>💳</Text>
                            <Text style={styles.emptyText}>No payments yet</Text>
                            <Text style={styles.emptySubtext}>
                                Your payment history will appear here
                            </Text>
                        </View>
                    )}
                </ScrollView>
            </SafeAreaView>
        </ScreenBackground>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { padding: spacing.lg },
    backButton: { color: colors.textSecondary, fontSize: 16, marginBottom: spacing.md },
    title: { fontSize: 28, fontWeight: '600', color: colors.text },
    subtitle: { fontSize: 14, color: colors.textSecondary, marginTop: spacing.xs },
    content: { padding: spacing.lg, paddingTop: 0 },
    paymentCard: { marginBottom: spacing.md, padding: spacing.lg },
    paymentHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start'
    },
    paymentTypeContainer: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    paymentIcon: { fontSize: 24, marginRight: spacing.md },
    paymentType: { fontSize: 16, fontWeight: '600', color: colors.text },
    paymentDate: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
    paymentAmountContainer: { alignItems: 'flex-end' },
    paymentAmount: { fontSize: 18, fontWeight: '700', color: colors.text },
    statusBadge: {
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
        borderRadius: 6,
        marginTop: spacing.xs
    },
    statusText: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase' },
    paymentDescription: {
        fontSize: 13,
        color: colors.textSecondary,
        marginTop: spacing.md,
        paddingTop: spacing.md,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    emptyState: { alignItems: 'center', paddingVertical: spacing.xxxl },
    emptyIcon: { fontSize: 64, marginBottom: spacing.lg, opacity: 0.5 },
    emptyText: { fontSize: 18, color: colors.text, fontWeight: '500' },
    emptySubtext: { fontSize: 14, color: colors.textSecondary, marginTop: spacing.xs },
});

export default PaymentHistoryScreen;
