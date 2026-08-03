import React, { useCallback, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Linking,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useModal } from '../../contexts/ModalContext';
import { Card, ScreenBackground } from '../../components/ui';
import { colors, spacing } from '../../theme';
import { processRefund } from '../../services/stripeService';

interface PaymentRow {
    id: string;
    amount: number;
    currency: string | null;
    status: string;
    description: string | null;
    created_at: string;
    appointment_id: string | null;
    order_id: string | null;
    stripe_payment_intent_id: string;
}

interface PayoutRecord {
    id: string;
    master_id: string | null;
    master_name: string | null;
    amount: number;
    currency: string;
    status: string;
    period_start: string | null;
    period_end: string | null;
    created_at: string;
}

interface MasterCommission {
    masterId: string;
    masterName: string;
    totalRevenue: number;
    commissionRate: number;
    commissionAmount: number;
    netToMaster: number;
    bookingCount: number;
}

type PeriodFilter = '7d' | '30d' | '90d' | 'all';

const PERIODS: { value: PeriodFilter; label: string }[] = [
    { value: '7d', label: '7D' },
    { value: '30d', label: '30D' },
    { value: '90d', label: '90D' },
    { value: 'all', label: 'All' },
];

function getPeriodStart(period: PeriodFilter): string | null {
    const now = new Date();
    switch (period) {
        case '7d': return new Date(now.getTime() - 7 * 86400000).toISOString();
        case '30d': return new Date(now.getTime() - 30 * 86400000).toISOString();
        case '90d': return new Date(now.getTime() - 90 * 86400000).toISOString();
        default: return null;
    }
}

const eur = (cents: number) => `€${(cents / 100).toFixed(2)}`;

const openStripeUrl = async (url: string) => {
    const parsed = new URL(url);
    if (parsed.protocol === 'https:' && (parsed.hostname === 'stripe.com' || parsed.hostname.endsWith('.stripe.com'))) {
        await Linking.openURL(url);
    } else {
        throw new Error('Invalid Stripe URL');
    }
};

export function OwnerFinanceScreen() {
    const navigation = useNavigation<any>();
    const { user, role } = useAuth();
    const { showAlert } = useModal();

    const isOwner = role === 'owner';

    const [period, setPeriod] = useState<PeriodFilter>('30d');
    const [loading, setLoading] = useState(true);
    const [payments, setPayments] = useState<PaymentRow[]>([]);
    const [payouts, setPayouts] = useState<PayoutRecord[]>([]);
    const [academyRevenue, setAcademyRevenue] = useState(0);
    const [appointmentsMap, setAppointmentsMap] = useState<Map<string, { masterId: string; masterName: string; commissionRate: number }>>(new Map());

    const [refundTarget, setRefundTarget] = useState<PaymentRow | null>(null);
    const [refundAmount, setRefundAmount] = useState('');
    const [refundProcessing, setRefundProcessing] = useState(false);
    const [stripeLoading, setStripeLoading] = useState(false);

    const loadData = useCallback(async () => {
        if (!user?.id) return;
        setLoading(true);
        try {
            const periodStart = getPeriodStart(period);

            let paymentQuery = supabase
                .from('payments')
                .select('*')
                .order('created_at', { ascending: false });
            if (periodStart) paymentQuery = paymentQuery.gte('created_at', periodStart);

            let enrollQuery = supabase
                .from('course_enrollments')
                .select('id, course:courses(price)');
            if (periodStart) enrollQuery = enrollQuery.gte('enrolled_at', periodStart);

            let payoutQuery = supabase
                .from('payouts')
                .select('*, master:profiles!payouts_master_id_fkey(full_name)')
                .order('created_at', { ascending: false });
            if (periodStart) payoutQuery = payoutQuery.gte('created_at', periodStart);

            const [paymentsRes, enrollRes, payoutsRes] = await Promise.all([paymentQuery, enrollQuery, payoutQuery]);

            const rows = ((paymentsRes.data || []).filter((p: any) => p.created_at) || []) as unknown as PaymentRow[];
            setPayments(rows);

            const academyCents = ((enrollRes.data || []) as any[])
                .reduce((sum, e) => sum + (Number(e.course?.price) || 0) * 100, 0);
            setAcademyRevenue(academyCents);

            const bookingAppointmentIds = [...new Set(rows.filter((p) => p.appointment_id && !p.order_id).map((p) => p.appointment_id!.toString()))];
            if (bookingAppointmentIds.length > 0) {
                const { data: appointments } = await supabase
                    .from('appointments')
                    .select('id, master_id, master:profiles!appointments_master_id_fkey(full_name, commission_rate)')
                    .in('id', bookingAppointmentIds);
                const map = new Map<string, { masterId: string; masterName: string; commissionRate: number }>();
                ((appointments || []) as any[]).forEach((a) => {
                    map.set(a.id, {
                        masterId: a.master_id,
                        masterName: a.master?.full_name || 'Unknown',
                        commissionRate: a.master?.commission_rate ?? 0.2,
                    });
                });
                setAppointmentsMap(map);
            } else {
                setAppointmentsMap(new Map());
            }

            const payoutRecords = ((payoutsRes.data || []) as any[]).map((p) => ({
                id: p.id,
                master_id: p.master_id ?? null,
                master_name: p.master?.full_name ?? null,
                amount: p.amount,
                currency: p.currency || 'eur',
                status: p.status || 'pending',
                period_start: p.period_start ?? null,
                period_end: p.period_end ?? null,
                created_at: p.created_at,
            }));
            setPayouts(payoutRecords);
        } catch (error: any) {
            showAlert('Error', error.message || 'Failed to load finance data', 'error');
        } finally {
            setLoading(false);
        }
    }, [user?.id, period, showAlert]);

    useFocusEffect(
        useCallback(() => {
            if (isOwner) loadData();
        }, [isOwner, loadData])
    );

    const stats = useMemo(() => {
        const succeeded = payments.filter((p) => p.status === 'succeeded');
        const shopRevenue = succeeded.filter((p) => p.order_id).reduce((s, p) => s + p.amount, 0);
        const bookingRevenue = succeeded.filter((p) => p.appointment_id && !p.order_id).reduce((s, p) => s + p.amount, 0);
        const commissions = succeeded
            .filter((p) => p.appointment_id && !p.order_id)
            .reduce((s, p) => {
                const info = appointmentsMap.get(String(p.appointment_id));
                return s + (p.amount / 100) * (info?.commissionRate ?? 0.2);
            }, 0);
        return {
            shopRevenue,
            bookingRevenue,
            totalRevenue: shopRevenue + bookingRevenue + academyRevenue,
            commissionCents: Math.round(commissions * 100),
        };
    }, [payments, academyRevenue, appointmentsMap]);

    const commissions = useMemo<MasterCommission[]>(() => {
        const map = new Map<string, MasterCommission>();
        payments
            .filter((p) => p.status === 'succeeded' && p.appointment_id && !p.order_id)
            .forEach((p) => {
                const info = appointmentsMap.get(String(p.appointment_id));
                if (!info) return;
                const amountEuros = p.amount / 100;
                const comm = amountEuros * info.commissionRate;
                const existing = map.get(info.masterId);
                if (existing) {
                    existing.totalRevenue += amountEuros;
                    existing.commissionAmount += comm;
                    existing.netToMaster += amountEuros - comm;
                    existing.bookingCount += 1;
                } else {
                    map.set(info.masterId, {
                        masterId: info.masterId,
                        masterName: info.masterName,
                        totalRevenue: amountEuros,
                        commissionRate: info.commissionRate,
                        commissionAmount: comm,
                        netToMaster: amountEuros - comm,
                        bookingCount: 1,
                    });
                }
            });
        return Array.from(map.values()).sort((a, b) => b.totalRevenue - a.totalRevenue);
    }, [payments, appointmentsMap]);

    const refundablePayments = useMemo(() => {
        return payments.filter((p) => p.status === 'succeeded' && p.stripe_payment_intent_id);
    }, [payments]);

    const handleRefund = async () => {
        if (!refundTarget) return;
        const parsed = refundAmount.trim() ? parseFloat(refundAmount) : NaN;
        const amountCents = Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 100) : undefined;

        setRefundProcessing(true);
        try {
            await processRefund(refundTarget.stripe_payment_intent_id, amountCents, 'requested_by_customer');

            if (!amountCents) {
                await (supabase as any)
                    .from('payments')
                    .update({ status: 'refunded' })
                    .eq('id', refundTarget.id);
            }

            showAlert(
                'Refund processed',
                amountCents ? `Refunded ${eur(amountCents)}` : 'Full amount refunded',
                'success'
            );
            setRefundTarget(null);
            setRefundAmount('');
            loadData();
        } catch (error: any) {
            let msg = error.message || 'Refund failed';
            if (msg.toLowerCase().includes('already been refunded')) {
                await (supabase as any)
                    .from('payments')
                    .update({ status: 'refunded' })
                    .eq('id', refundTarget.id);
                msg = 'Payment was already refunded — status updated.';
                setRefundTarget(null);
                setRefundAmount('');
                await loadData();
            }
            showAlert(msg.includes('already refunded') ? 'Already refunded' : 'Refund failed', msg, msg.includes('already refunded') ? 'success' : 'error');
        } finally {
            setRefundProcessing(false);
        }
    };

    const handleStripeLink = async (source: 'portal' | 'dashboard') => {
        setStripeLoading(true);
        try {
            const fn = source === 'portal' ? 'create-portal-session' : 'stripe-connect-dashboard';
            const { data, error } = await supabase.functions.invoke(fn, { body: {} });
            if (error) throw error;
            if (data?.url) {
                await openStripeUrl(data.url);
            } else {
                showAlert('Unavailable', 'No Stripe session URL was returned. Connect your Stripe account first.', 'error');
            }
        } catch (error: any) {
            showAlert('Stripe', error.message || 'Failed to open Stripe', 'error');
        } finally {
            setStripeLoading(false);
        }
    };

    if (!isOwner) {
        return (
            <ScreenBackground>
                <SafeAreaView style={styles.container} edges={['top']}>
                    <View style={styles.centerMessage}>
                        <MaterialCommunityIcons name="lock-outline" size={48} color={colors.textSecondary} />
                        <Text style={styles.emptyTitle}>Owners only</Text>
                        <Text style={styles.emptyText}>Platform finance is restricted to the owner.</Text>
                    </View>
                </SafeAreaView>
            </ScreenBackground>
        );
    }

    const pendingPayouts = payouts.filter((p) => p.status === 'pending');

    return (
        <ScreenBackground>
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <MaterialIcons name="arrow-back" size={22} color={colors.text} />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.title}>Finance</Text>
                        <Text style={styles.subtitle}>Platform revenue, refunds & payouts</Text>
                    </View>
                </View>

                <View style={styles.periodRow}>
                    {PERIODS.map((p) => (
                        <TouchableOpacity
                            key={p.value}
                            style={[styles.periodChip, period === p.value && styles.periodChipActive]}
                            onPress={() => setPeriod(p.value)}
                        >
                            <Text style={[styles.periodChipText, period === p.value && styles.periodChipTextActive]}>
                                {p.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {loading ? (
                    <View style={styles.loadingBox}>
                        <ActivityIndicator size="large" color={colors.text} />
                    </View>
                ) : (
                    <ScrollView contentContainerStyle={styles.content}>
                        {/* Overview */}
                        <Card style={styles.overviewCard}>
                            <Text style={styles.overviewLabel}>TOTAL REVENUE</Text>
                            <Text style={styles.overviewValue}>{eur(stats.totalRevenue)}</Text>
                            <View style={styles.overviewSplit}>
                                <View style={styles.overviewItem}>
                                    <MaterialIcons name="storefront" size={13} color={colors.textMuted} />
                                    <Text style={styles.overviewItemText}>Shop {eur(stats.shopRevenue)}</Text>
                                </View>
                                <View style={styles.overviewItem}>
                                    <MaterialIcons name="event" size={13} color={colors.textMuted} />
                                    <Text style={styles.overviewItemText}>Bookings {eur(stats.bookingRevenue)}</Text>
                                </View>
                                <View style={styles.overviewItem}>
                                    <MaterialIcons name="school" size={13} color={colors.textMuted} />
                                    <Text style={styles.overviewItemText}>Academy {eur(academyRevenue)}</Text>
                                </View>
                            </View>
                            <View style={styles.overviewFooterRow}>
                                <View style={styles.overviewItem}>
                                    <MaterialIcons name="savings" size={13} color="#047857" />
                                    <Text style={[styles.overviewItemText, { color: '#047857', fontWeight: '700' }]}>
                                        Platform commission {eur(stats.commissionCents)}
                                    </Text>
                                </View>
                                <View style={styles.overviewItem}>
                                    <MaterialIcons name="schedule" size={13} color="#B45309" />
                                    <Text style={[styles.overviewItemText, { color: '#B45309', fontWeight: '700' }]}>
                                        {pendingPayouts.length} pending payout{pendingPayouts.length === 1 ? '' : 's'}
                                    </Text>
                                </View>
                            </View>
                        </Card>

                        {/* Stripe links */}
                        <View style={styles.linksRow}>
                            <TouchableOpacity
                                style={styles.linkCard}
                                onPress={() => handleStripeLink('portal')}
                                disabled={stripeLoading}
                            >
                                {stripeLoading ? (
                                    <ActivityIndicator size="small" color={colors.text} />
                                ) : (
                                    <>
                                        <MaterialIcons name="open-in-new" size={18} color={colors.text} />
                                        <Text style={styles.linkCardText}>Billing Portal</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.linkCard}
                                onPress={() => handleStripeLink('dashboard')}
                                disabled={stripeLoading}
                            >
                                {stripeLoading ? (
                                    <ActivityIndicator size="small" color={colors.text} />
                                ) : (
                                    <>
                                        <MaterialIcons name="dashboard" size={18} color={colors.text} />
                                        <Text style={styles.linkCardText}>Stripe Dashboard</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>

                        {/* Commissions by master */}
                        <Text style={styles.sectionTitle}>COMMISSIONS BY MASTER</Text>
                        {commissions.length === 0 ? (
                            <Card style={styles.emptyCard}>
                                <Text style={styles.emptyText}>No booking revenue in this period.</Text>
                            </Card>
                        ) : (
                            commissions.map((mc) => (
                                <Card key={mc.masterId} style={styles.rowCard}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.rowTitle}>{mc.masterName}</Text>
                                        <Text style={styles.rowMeta}>
                                            {mc.bookingCount} booking{mc.bookingCount === 1 ? '' : 's'} · rate {(mc.commissionRate * 100).toFixed(0)}%
                                        </Text>
                                    </View>
                                    <View style={{ alignItems: 'flex-end' }}>
                                        <Text style={styles.rowValue}>€{mc.totalRevenue.toFixed(2)}</Text>
                                        <Text style={styles.rowMeta}>commission €{mc.commissionAmount.toFixed(2)}</Text>
                                    </View>
                                </Card>
                            ))
                        )}

                        {/* Payouts */}
                        <Text style={styles.sectionTitle}>PAYOUTS</Text>
                        {payouts.length === 0 ? (
                            <Card style={styles.emptyCard}>
                                <Text style={styles.emptyText}>No payouts recorded in this period.</Text>
                            </Card>
                        ) : (
                            payouts.slice(0, 10).map((p) => (
                                <Card key={p.id} style={styles.rowCard}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.rowTitle}>{p.master_name || 'Platform'}</Text>
                                        <Text style={styles.rowMeta}>
                                            {p.period_start && p.period_end
                                                ? `${p.period_start} → ${p.period_end}`
                                                : new Date(p.created_at).toLocaleDateString('en-IE')}
                                        </Text>
                                    </View>
                                    <View style={{ alignItems: 'flex-end' }}>
                                        <Text style={styles.rowValue}>{eur(p.amount)}</Text>
                                        <Text style={[
                                            styles.payoutStatus,
                                            { color: p.status === 'completed' ? '#047857' : p.status === 'pending' ? '#B45309' : '#6B7280' },
                                        ]}>
                                            {p.status}
                                        </Text>
                                    </View>
                                </Card>
                            ))
                        )}

                        {/* Refunds */}
                        <Text style={styles.sectionTitle}>REFUNDABLE PAYMENTS</Text>
                        {refundablePayments.length === 0 ? (
                            <Card style={styles.emptyCard}>
                                <Text style={styles.emptyText}>No succeeded payments in this period.</Text>
                            </Card>
                        ) : (
                            refundablePayments.slice(0, 20).map((p) => (
                                <Card key={p.id} style={styles.rowCard}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.rowTitle} numberOfLines={1}>
                                            {p.description || (p.order_id ? 'Shop order' : 'Booking payment')}
                                        </Text>
                                        <Text style={styles.rowMeta}>
                                            {new Date(p.created_at).toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' })}
                                            {p.order_id ? ' · Shop' : ' · Booking'}
                                        </Text>
                                    </View>
                                    <Text style={styles.rowValue}>{eur(p.amount)}</Text>
                                    <TouchableOpacity
                                        style={styles.refundButton}
                                        onPress={() => {
                                            setRefundTarget(p);
                                            setRefundAmount('');
                                        }}
                                    >
                                        <MaterialIcons name="undo" size={13} color="#DC2626" />
                                        <Text style={styles.refundButtonText}>Refund</Text>
                                    </TouchableOpacity>
                                </Card>
                            ))
                        )}
                    </ScrollView>
                )}

                {/* Refund modal */}
                <Modal
                    visible={!!refundTarget}
                    transparent
                    animationType="slide"
                    onRequestClose={() => !refundProcessing && setRefundTarget(null)}
                >
                    <KeyboardAvoidingView
                        style={styles.modalBackdrop}
                        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    >
                        <View style={styles.modalSheet}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>Refund payment</Text>
                                <TouchableOpacity onPress={() => setRefundTarget(null)} disabled={refundProcessing} style={styles.closeButton}>
                                    <MaterialIcons name="close" size={18} color={colors.textSecondary} />
                                </TouchableOpacity>
                            </View>
                            <View style={styles.modalBody}>
                                {refundTarget && (
                                    <>
                                        <Text style={styles.refundSummary} numberOfLines={2}>
                                            {refundTarget.description || 'Payment'} — {eur(refundTarget.amount)}
                                        </Text>
                                        <Text style={styles.label}>AMOUNT (EUR, BLANK = FULL REFUND)</Text>
                                        <TextInput
                                            style={styles.input}
                                            value={refundAmount}
                                            onChangeText={setRefundAmount}
                                            placeholder={eur(refundTarget.amount).replace('€', '')}
                                            placeholderTextColor={colors.textMuted}
                                            keyboardType="decimal-pad"
                                            editable={!refundProcessing}
                                        />
                                        <View style={styles.warningBanner}>
                                            <MaterialIcons name="error-outline" size={13} color="#B45309" />
                                            <Text style={styles.warningText}>
                                                Refunds are processed immediately through Stripe and cannot be reversed.
                                            </Text>
                                        </View>
                                        <TouchableOpacity
                                            style={[styles.submitButton, refundProcessing && { opacity: 0.6 }]}
                                            onPress={handleRefund}
                                            disabled={refundProcessing}
                                        >
                                            {refundProcessing ? (
                                                <ActivityIndicator size="small" color="#FFF" />
                                            ) : (
                                                <Text style={styles.submitButtonText}>
                                                    {refundAmount.trim() ? `Refund €${parseFloat(refundAmount).toFixed(2)}` : 'Refund Full Amount'}
                                                </Text>
                                            )}
                                        </TouchableOpacity>
                                    </>
                                )}
                            </View>
                        </View>
                    </KeyboardAvoidingView>
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
        gap: spacing.md,
        padding: spacing.lg,
        paddingBottom: spacing.sm,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: 'rgba(0,0,0,0.04)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.08)',
    },
    title: { fontSize: 22, fontWeight: '700', color: colors.text },
    subtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
    periodRow: {
        flexDirection: 'row',
        gap: spacing.sm,
        paddingHorizontal: spacing.lg,
        marginBottom: spacing.sm,
    },
    periodChip: {
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 999,
        backgroundColor: '#F3F4F6',
    },
    periodChipActive: { backgroundColor: '#000' },
    periodChipText: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
    periodChipTextActive: { color: '#FFF' },
    loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
    content: { padding: spacing.lg, paddingTop: spacing.sm, paddingBottom: 40 },
    overviewCard: { padding: spacing.lg, marginBottom: spacing.md },
    overviewLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1.5, color: colors.textMuted },
    overviewValue: { fontSize: 32, fontWeight: '800', color: colors.text, marginTop: 4 },
    overviewSplit: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.md },
    overviewItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    overviewItemText: { fontSize: 12, color: colors.textSecondary },
    overviewFooterRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: spacing.md,
        paddingTop: spacing.md,
        borderTopWidth: 1,
        borderTopColor: 'rgba(0,0,0,0.06)',
    },
    linksRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
    linkCard: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.1)',
        borderRadius: 14,
        paddingVertical: 14,
        backgroundColor: '#FFF',
    },
    linkCardText: { fontSize: 13, fontWeight: '700', color: colors.text },
    sectionTitle: {
        fontSize: 12,
        fontWeight: '700',
        color: colors.textSecondary,
        letterSpacing: 1.2,
        marginTop: spacing.md,
        marginBottom: spacing.sm,
    },
    rowCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        padding: spacing.md,
        marginBottom: spacing.sm,
    },
    rowTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
    rowMeta: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
    rowValue: { fontSize: 15, fontWeight: '800', color: colors.text },
    payoutStatus: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
    emptyCard: { padding: spacing.lg, alignItems: 'center' },
    emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginTop: spacing.sm },
    emptyText: { fontSize: 13, color: colors.textSecondary, textAlign: 'center' },
    centerMessage: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
    refundButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        paddingHorizontal: 8,
        paddingVertical: 5,
        borderRadius: 8,
        backgroundColor: '#FEF2F2',
        marginLeft: spacing.sm,
    },
    refundButtonText: { fontSize: 10, fontWeight: '700', color: '#DC2626' },
    modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    modalSheet: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24 },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.06)',
    },
    modalTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
    closeButton: { padding: 6 },
    modalBody: { padding: spacing.lg },
    refundSummary: { fontSize: 14, fontWeight: '600', color: colors.text },
    label: {
        fontSize: 10,
        fontWeight: '700',
        color: colors.textSecondary,
        letterSpacing: 1,
        marginBottom: 6,
        marginTop: spacing.md,
    },
    input: {
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.08)',
        backgroundColor: colors.inputBackground,
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 14,
        color: colors.text,
    },
    warningBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        backgroundColor: '#FFFBEB',
        borderWidth: 1,
        borderColor: '#FDE68A',
        borderRadius: 12,
        padding: 10,
        marginTop: spacing.md,
    },
    warningText: { flex: 1, fontSize: 11, fontWeight: '600', color: '#92400E' },
    submitButton: {
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#DC2626',
        borderRadius: 14,
        paddingVertical: 14,
        marginTop: spacing.lg,
        marginBottom: spacing.md,
    },
    submitButtonText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
});

export default OwnerFinanceScreen;
