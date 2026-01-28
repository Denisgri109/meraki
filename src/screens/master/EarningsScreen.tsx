import React, { useState, useEffect } from 'react';
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
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Card } from '../../components/ui';
import { ScreenBackground } from '../../components/ui';
import { colors, spacing } from '../../theme';

type Period = 'week' | 'month' | 'all';

export function MasterEarningsScreen() {
    const { user } = useAuth();
    const [earnings, setEarnings] = useState({
        total: 0,
        completed: 0,
        pending: 0,
        appointmentsCount: 0,
    });
    const [period, setPeriod] = useState<Period>('week');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        fetchEarnings();
    }, [period]);

    const fetchEarnings = async () => {
        if (!user) return;

        try {
            let dateFilter = {};
            const now = new Date();

            if (period === 'week') {
                const weekStart = startOfWeek(now, { weekStartsOn: 1 });
                const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
                dateFilter = {
                    gte: weekStart.toISOString(),
                    lt: weekEnd.toISOString(),
                };
            } else if (period === 'month') {
                const monthStart = startOfMonth(now);
                const monthEnd = endOfMonth(now);
                dateFilter = {
                    gte: monthStart.toISOString(),
                    lt: monthEnd.toISOString(),
                };
            }

            let query = supabase
                .from('appointments')
                .select('price, status')
                .eq('master_id', user.id);

            if (period !== 'all') {
                query = query
                    .gte('start_time', (dateFilter as any).gte)
                    .lt('start_time', (dateFilter as any).lt);
            }

            const { data, error } = await query;

            if (error) throw error;

            const completedAppointments = (data || []).filter(apt => apt.status === 'completed');
            const pendingAppointments = (data || []).filter(apt => apt.status === 'pending' || apt.status === 'confirmed');

            setEarnings({
                total: completedAppointments.reduce((sum, apt) => sum + (apt.price || 0), 0),
                completed: completedAppointments.length,
                pending: pendingAppointments.length,
                appointmentsCount: (data || []).length,
            });
        } catch (error) {
            console.error('Error fetching earnings:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchEarnings();
    };

    if (loading) {
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
                <View style={styles.header}>
                    <Text style={styles.title}>Earnings</Text>
                </View>

                {/* Period Tabs */}
                <View style={styles.tabs}>
                    {(['week', 'month', 'all'] as Period[]).map((p) => (
                        <TouchableOpacity
                            key={p}
                            style={[styles.tab, period === p && styles.tabActive]}
                            onPress={() => setPeriod(p)}
                        >
                            <Text style={[styles.tabText, period === p && styles.tabTextActive]}>
                                {p === 'week' ? 'This Week' : p === 'month' ? 'This Month' : 'All Time'}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                <ScrollView
                    contentContainerStyle={styles.content}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} />
                    }
                >
                    {/* Total Earnings */}
                    <Card style={styles.totalCard}>
                        <Text style={styles.totalLabel}>Total Earnings</Text>
                        <Text style={styles.totalAmount}>€{earnings.total.toFixed(2)}</Text>
                        <Text style={styles.totalSubtext}>
                            From {earnings.completed} completed appointments
                        </Text>
                    </Card>

                    {/* Stats Grid */}
                    <View style={styles.statsGrid}>
                        <Card style={styles.statCard}>
                            <Text style={styles.statIcon}>✅</Text>
                            <Text style={styles.statValue}>{earnings.completed}</Text>
                            <Text style={styles.statLabel}>Completed</Text>
                        </Card>
                        <Card style={styles.statCard}>
                            <Text style={styles.statIcon}>⏳</Text>
                            <Text style={styles.statValue}>{earnings.pending}</Text>
                            <Text style={styles.statLabel}>Pending</Text>
                        </Card>
                    </View>

                    {/* Average */}
                    <Card style={styles.avgCard}>
                        <View style={styles.avgRow}>
                            <Text style={styles.avgLabel}>Average per appointment</Text>
                            <Text style={styles.avgValue}>
                                €{earnings.completed > 0 ? (earnings.total / earnings.completed).toFixed(2) : '0.00'}
                            </Text>
                        </View>
                    </Card>
                </ScrollView>
            </SafeAreaView>
        </ScreenBackground>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.md },
    title: { fontSize: 28, fontWeight: '600', color: colors.text },
    tabs: { flexDirection: 'row', paddingHorizontal: spacing.lg, marginBottom: spacing.md },
    tab: { flex: 1, paddingVertical: spacing.sm, alignItems: 'center', borderRadius: 8, marginHorizontal: spacing.xs },
    tabActive: { backgroundColor: colors.text },
    tabText: { fontSize: 13, fontWeight: '500', color: colors.textSecondary },
    tabTextActive: { color: colors.background },
    content: { padding: spacing.lg },
    totalCard: { padding: spacing.xl, marginBottom: spacing.lg, alignItems: 'center' },
    totalLabel: { fontSize: 14, color: colors.textSecondary, marginBottom: spacing.sm },
    totalAmount: { fontSize: 48, fontWeight: '700', color: colors.text },
    totalSubtext: { fontSize: 14, color: colors.textMuted, marginTop: spacing.sm },
    statsGrid: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg },
    statCard: { flex: 1, padding: spacing.lg, alignItems: 'center' },
    statIcon: { fontSize: 28, marginBottom: spacing.sm },
    statValue: { fontSize: 28, fontWeight: '700', color: colors.text },
    statLabel: { fontSize: 12, color: colors.textSecondary, marginTop: spacing.xs },
    avgCard: { padding: spacing.lg },
    avgRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    avgLabel: { fontSize: 14, color: colors.textSecondary },
    avgValue: { fontSize: 20, fontWeight: '600', color: colors.text },
});

export default MasterEarningsScreen;
