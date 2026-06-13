import React, { useState, useEffect } from 'react';
import {
    View,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Card, ScreenBackground, MerakiText } from '../../components/ui';
import { colors, spacing } from '../../theme';
import { formatCurrency } from '../../utils/timezone';

type Period = 'week' | 'month' | 'all';

export function MasterEarningsScreen() {
    const navigation = useNavigation<any>();
    const { user, profile } = useAuth();
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

    const periodLabels: Record<Period, string> = {
        week: 'This Week',
        month: 'This Month',
        all: 'All Time',
    };

    if (loading) {
        return (
            <ScreenBackground>
                <SafeAreaView style={styles.container} edges={['top']}>
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={colors.accent} />
                    </View>
                </SafeAreaView>
            </ScreenBackground>
        );
    }

    return (
        <ScreenBackground>
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={styles.header}>
                    <View style={styles.headerTopRow}>
                        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                            <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
                        </TouchableOpacity>
                        <View style={styles.headerTitleContainer}>
                            <MerakiText variant="h1">Earnings</MerakiText>
                            <MerakiText variant="caption" color={colors.textMuted}>
                                {period === 'week' && format(new Date(), "'Week of' MMM d")}
                                {period === 'month' && format(new Date(), 'MMMM yyyy')}
                                {period === 'all' && 'Lifetime'}
                            </MerakiText>
                        </View>
                    </View>
                </View>

                {/* Period Selector Pills */}
                <View style={styles.pillContainer}>
                    <View style={styles.pillRow}>
                        {(['week', 'month', 'all'] as Period[]).map((p) => (
                            <TouchableOpacity
                                key={p}
                                style={[styles.pill, period === p && styles.pillActive]}
                                onPress={() => setPeriod(p)}
                            >
                                <MerakiText
                                    variant="label"
                                    color={period === p ? colors.background : colors.textSecondary}
                                >
                                    {periodLabels[p]}
                                </MerakiText>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                <ScrollView
                    contentContainerStyle={styles.content}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
                    }
                    showsVerticalScrollIndicator={false}
                >
                    {/* Hero Earnings Card */}
                    <Card variant="glass" style={styles.heroCard}>
                        <View style={styles.heroIconRow}>
                            <View style={styles.heroIconBg}>
                                <MaterialCommunityIcons name="cash-multiple" size={24} color={colors.accent} />
                            </View>
                        </View>
                        <MerakiText variant="caption" color={colors.textSecondary} style={styles.heroLabel}>
                            Total Earnings
                        </MerakiText>
                        <MerakiText variant="h1" color={colors.accent} style={styles.heroAmount}>
                            {formatCurrency(earnings.total, profile?.currency || undefined)}
                        </MerakiText>
                        <MerakiText variant="caption" color={colors.textMuted}>
                            From {earnings.completed} completed appointments
                        </MerakiText>
                    </Card>

                    {/* Stats Grid */}
                    <View style={styles.statsGrid}>
                        <Card variant="glass" style={styles.statCard}>
                            <View style={[styles.statIconBg, { backgroundColor: 'rgba(34,197,94,0.12)' }]}>
                                <MaterialCommunityIcons name="check-circle-outline" size={22} color={colors.success} />
                            </View>
                            <MerakiText variant="h2" style={styles.statValue}>{earnings.completed}</MerakiText>
                            <MerakiText variant="caption" color={colors.textMuted}>Completed</MerakiText>
                        </Card>
                        <Card variant="glass" style={styles.statCard}>
                            <View style={[styles.statIconBg, { backgroundColor: 'rgba(212,168,83,0.12)' }]}>
                                <MaterialCommunityIcons name="clock-outline" size={22} color={colors.accent} />
                            </View>
                            <MerakiText variant="h2" style={styles.statValue}>{earnings.pending}</MerakiText>
                            <MerakiText variant="caption" color={colors.textMuted}>Pending</MerakiText>
                        </Card>
                    </View>

                    {/* Average Per Appointment */}
                    <Card variant="glass" style={styles.avgCard}>
                        <View style={styles.avgRow}>
                            <View style={styles.avgLeft}>
                                <MaterialCommunityIcons name="chart-line-variant" size={20} color={colors.accent} />
                                <MerakiText variant="body" color={colors.textSecondary} style={{ marginLeft: spacing.sm }}>
                                    Average per appointment
                                </MerakiText>
                            </View>
                            <MerakiText variant="h2" color={colors.accent}>
                                {formatCurrency(earnings.completed > 0 ? (earnings.total / earnings.completed) : 0, profile?.currency || undefined)}
                            </MerakiText>
                        </View>
                    </Card>

                    {/* Total Appointments Info */}
                    <Card variant="glass" style={styles.avgCard}>
                        <View style={styles.avgRow}>
                            <View style={styles.avgLeft}>
                                <MaterialCommunityIcons name="calendar-multiple" size={20} color={colors.info} />
                                <MerakiText variant="body" color={colors.textSecondary} style={{ marginLeft: spacing.sm }}>
                                    Total appointments
                                </MerakiText>
                            </View>
                            <MerakiText variant="h2" color={colors.text}>
                                {earnings.appointmentsCount}
                            </MerakiText>
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
    header: {
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.lg,
        paddingBottom: spacing.sm,
    },
    headerTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: 'rgba(0, 0, 0, 0.04)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.08)',
    },
    headerTitleContainer: {
        flex: 1,
    },
    pillContainer: {
        paddingHorizontal: spacing.lg,
        marginBottom: spacing.md,
    },
    pillRow: {
        flexDirection: 'row',
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: 4,
    },
    pill: {
        flex: 1,
        paddingVertical: spacing.sm,
        alignItems: 'center',
        borderRadius: 10,
    },
    pillActive: {
        backgroundColor: colors.accent,
    },
    content: { padding: spacing.lg, paddingBottom: 100 },
    heroCard: {
        padding: spacing.xl,
        marginBottom: spacing.lg,
        alignItems: 'center',
    },
    heroIconRow: { marginBottom: spacing.md },
    heroIconBg: {
        width: 48,
        height: 48,
        borderRadius: 14,
        backgroundColor: 'rgba(212,168,83,0.12)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    heroLabel: { marginBottom: spacing.xs },
    heroAmount: { marginBottom: spacing.xs },
    statsGrid: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg },
    statCard: { flex: 1, padding: spacing.lg, alignItems: 'center' },
    statIconBg: {
        width: 40,
        height: 40,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.sm,
    },
    statValue: { marginBottom: 2 },
    avgCard: { padding: spacing.lg, marginBottom: spacing.md },
    avgRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    avgLeft: { flexDirection: 'row', alignItems: 'center' },
});

export default MasterEarningsScreen;
