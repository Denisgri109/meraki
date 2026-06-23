import React, { useState, useCallback, useRef } from 'react';
import {
    View,
    StyleSheet,
    ScrollView,
    ActivityIndicator,
    TouchableOpacity,
    Dimensions,
    RefreshControl,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import PagerView from 'react-native-pager-view';
import {
    startOfWeek,
    startOfMonth,
    startOfYear,
    subDays,
    format,
    eachDayOfInterval,
    eachWeekOfInterval,
    eachMonthOfInterval,
    isSameDay,
    isSameWeek,
    isSameMonth,
} from 'date-fns';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { ScreenBackground, MerakiText, Card } from '../../components/ui';
import { colors, spacing, gradients } from '../../theme';

const { width } = Dimensions.get('window');

const ANALYTICS_TABS = [
    { id: 'overview', label: 'Overview' },
    { id: 'revenue', label: 'Revenue' },
    { id: 'metrics', label: 'Metrics' },
] as const;

type TimeRange = 'week' | 'month' | 'year';

type AnalyticsStats = {
    totalRevenue: number;
    totalBookings: number;
    completedBookings: number;
    activeClients: number;
    averageBookingValue: number;
    retentionRate: number;
    conversionRate: number;
    revenueTrend: { label: string; value: number }[];
    previousRevenue: number;
};

const getTimeRangeStart = (range: TimeRange): Date => {
    const now = new Date();
    switch (range) {
        case 'week':
            return startOfWeek(now, { weekStartsOn: 1 });
        case 'month':
            return startOfMonth(now);
        case 'year':
            return startOfYear(now);
    }
};

const getPreviousRangeStart = (range: TimeRange): Date => {
    const now = new Date();
    switch (range) {
        case 'week':
            return subDays(startOfWeek(now, { weekStartsOn: 1 }), 7);
        case 'month': {
            const s = startOfMonth(now);
            return new Date(s.getFullYear(), s.getMonth() - 1, 1);
        }
        case 'year':
            return new Date(now.getFullYear() - 1, 0, 1);
    }
};

export function PlatformAnalyticsScreen() {
    const navigation = useNavigation();
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [timeRange, setTimeRange] = useState<TimeRange>('month');
    const [activeTab, setActiveTab] = useState(0);
    const pagerRef = useRef<PagerView>(null);
    const [stats, setStats] = useState<AnalyticsStats>({
        totalRevenue: 0,
        totalBookings: 0,
        completedBookings: 0,
        activeClients: 0,
        averageBookingValue: 0,
        retentionRate: 0,
        conversionRate: 0,
        revenueTrend: [],
        previousRevenue: 0,
    });

    const fetchAnalytics = useCallback(async () => {
        if (!user) return;
        try {
            const rangeStart = getTimeRangeStart(timeRange);
            const prevStart = getPreviousRangeStart(timeRange);
            const now = new Date();

            // Current period appointments
            const { data: currentAppointments } = await supabase
                .from('appointments')
                .select('id, price, status, client_id, start_time')
                .gte('start_time', rangeStart.toISOString())
                .lte('start_time', now.toISOString());

            const appointments = currentAppointments || [];

            // Current period payments
            const { data: currentPaymentsData } = await supabase
                .from('payments')
                .select('amount, created_at')
                .eq('status', 'succeeded')
                .gte('created_at', rangeStart.toISOString())
                .lte('created_at', now.toISOString());
            const currentPayments = currentPaymentsData || [];

            // Previous period revenue (for trend comparison)
            const { data: prevPaymentsData } = await supabase
                .from('payments')
                .select('amount')
                .eq('status', 'succeeded')
                .gte('created_at', prevStart.toISOString())
                .lt('created_at', rangeStart.toISOString());

            const previousRevenue = (prevPaymentsData || []).reduce(
                (sum, p) => sum + ((p.amount || 0) / 100),
                0
            );

            // Calculate stats
            const completed = appointments.filter((a) => a.status === 'completed');
            const totalRevenue = currentPayments.reduce((sum, p) => sum + ((p.amount || 0) / 100), 0);
            const totalBookings = appointments.length;
            const completedBookings = completed.length;

            // Unique clients
            const clientIds = new Set(appointments.map((a) => a.client_id).filter(Boolean));
            const activeClients = clientIds.size;

            // Average booking value
            const totalBookingRevenue = completed.reduce((sum, a) => sum + (a.price || 0), 0);
            const averageBookingValue = completedBookings > 0 ? totalBookingRevenue / completedBookings : 0;

            // Retention rate: clients with >1 booking / total clients
            const clientBookingCounts: Record<string, number> = {};
            appointments.forEach((a) => {
                if (a.client_id) {
                    clientBookingCounts[a.client_id] = (clientBookingCounts[a.client_id] || 0) + 1;
                }
            });
            const returningClients = Object.values(clientBookingCounts).filter((c) => c > 1).length;
            const retentionRate = activeClients > 0 ? (returningClients / activeClients) * 100 : 0;

            // Conversion rate: completed / total
            const conversionRate = totalBookings > 0 ? (completedBookings / totalBookings) * 100 : 0;

            // Revenue trend breakdown
            const validPayments = currentPayments
                .filter((p) => p.created_at !== null)
                .map((p) => ({ ...p, created_at: p.created_at! }));
            const revenueTrend = buildRevenueTrend(validPayments, timeRange, rangeStart, now);

            setStats({
                totalRevenue,
                totalBookings,
                completedBookings,
                activeClients,
                averageBookingValue,
                retentionRate,
                conversionRate,
                revenueTrend,
                previousRevenue,
            });
        } catch (error) {
            console.error('Error fetching analytics:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [user?.id, timeRange]);

    useFocusEffect(
        useCallback(() => {
            setLoading(true);
            fetchAnalytics();
        }, [fetchAnalytics])
    );

    const handleRefresh = () => {
        setRefreshing(true);
        fetchAnalytics();
    };

    const handleTabPress = (index: number) => {
        setActiveTab(index);
        pagerRef.current?.setPage(index);
    };

    const handlePageSelected = (e: any) => {
        setActiveTab(e.nativeEvent.position);
    };

    const handleTimeRange = (range: TimeRange) => {
        setTimeRange(range);
        setLoading(true);
    };

    const revenueChange = stats.previousRevenue > 0
        ? ((stats.totalRevenue - stats.previousRevenue) / stats.previousRevenue) * 100
        : stats.totalRevenue > 0 ? 100 : 0;

    if (loading && !refreshing) {
        return (
            <ScreenBackground>
                <SafeAreaView style={styles.container} edges={['top']}>
                    <ActivityIndicator size="large" color={colors.accent} style={styles.loader} />
                </SafeAreaView>
            </ScreenBackground>
        );
    }

    return (
        <ScreenBackground>
            <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <MaterialCommunityIcons name="chevron-left" size={28} color={colors.text} />
                    </TouchableOpacity>
                    <MerakiText variant="h2" style={styles.headerTitle}>Platform Analytics</MerakiText>
                    <View style={{ width: 40 }} />
                </View>

                {/* Time Range Selector */}
                <View style={styles.timeSelectorContainer}>
                    <View style={styles.timeSelector}>
                        {(['week', 'month', 'year'] as const).map((range) => (
                            <TouchableOpacity
                                key={range}
                                style={[styles.timeOption, timeRange === range && styles.timeOptionActive]}
                                onPress={() => handleTimeRange(range)}
                            >
                                {timeRange === range && (
                                    <LinearGradient
                                        colors={gradients.primary as any}
                                        style={StyleSheet.absoluteFill}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 0 }}
                                    />
                                )}
                                <MerakiText
                                    variant="caption"
                                    color={timeRange === range ? '#FFFFFF' : colors.textSecondary}
                                    style={styles.timeText}
                                >
                                    {range.toUpperCase()}
                                </MerakiText>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Swipeable Tabs */}
                <View style={styles.tabsContainer}>
                    <View style={styles.tabBar}>
                        {ANALYTICS_TABS.map((tab, index) => (
                            <TouchableOpacity
                                key={tab.id}
                                style={[styles.tabItem, activeTab === index && styles.tabItemActive]}
                                onPress={() => handleTabPress(index)}
                            >
                                <MerakiText
                                    variant="label"
                                    style={[styles.tabText, activeTab === index && styles.tabTextActive]}
                                >
                                    {tab.label}
                                </MerakiText>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Pager */}
                <PagerView
                    ref={pagerRef}
                    style={styles.pagerView}
                    initialPage={0}
                    onPageSelected={handlePageSelected}
                >
                    {/* Page 1: Overview */}
                    <View key="overview" style={styles.page}>
                        <ScrollView
                            contentContainerStyle={styles.scrollContent}
                            refreshControl={
                                <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.accent} />
                            }
                            showsVerticalScrollIndicator={false}
                        >
                            {/* Revenue Hero */}
                            <Card variant="glass" style={styles.revenueHero}>
                                <MerakiText variant="label" color={colors.textSecondary}>TOTAL REVENUE</MerakiText>
                                <MerakiText style={styles.revenueAmount}>
                                    €{stats.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </MerakiText>
                                <View style={styles.trendRow}>
                                    <MaterialCommunityIcons
                                        name={revenueChange >= 0 ? 'trending-up' : 'trending-down'}
                                        size={20}
                                        color={revenueChange >= 0 ? colors.success : colors.error}
                                    />
                                    <MerakiText
                                        variant="caption"
                                        color={revenueChange >= 0 ? colors.success : colors.error}
                                        style={{ marginLeft: 4 }}
                                    >
                                        {revenueChange >= 0 ? '+' : ''}{revenueChange.toFixed(1)}% vs last period
                                    </MerakiText>
                                </View>
                                <LinearGradient
                                    colors={['transparent', 'rgba(212, 138, 130, 0.05)']}
                                    style={styles.heroGlow}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                />
                            </Card>

                            {/* Stats Grid */}
                            <View style={styles.statsGrid}>
                                <Card variant="glass" style={styles.statBox}>
                                    <View style={[styles.iconBox, { backgroundColor: 'rgba(96, 165, 250, 0.1)' }]}>
                                        <MaterialCommunityIcons name="calendar-check" size={22} color="#60A5FA" />
                                    </View>
                                    <MerakiText variant="h3">{stats.totalBookings}</MerakiText>
                                    <MerakiText variant="caption" color={colors.textMuted}>Bookings</MerakiText>
                                </Card>
                                <Card variant="glass" style={styles.statBox}>
                                    <View style={[styles.iconBox, { backgroundColor: 'rgba(167, 139, 250, 0.1)' }]}>
                                        <MaterialCommunityIcons name="account-group" size={22} color="#A78BFA" />
                                    </View>
                                    <MerakiText variant="h3">{stats.activeClients}</MerakiText>
                                    <MerakiText variant="caption" color={colors.textMuted}>Active Clients</MerakiText>
                                </Card>
                            </View>

                            {/* Quick Summary Cards */}
                            <Card variant="glass" style={styles.summaryCard}>
                                <View style={styles.summaryRow}>
                                    <View style={styles.summaryItem}>
                                        <MerakiText variant="caption" color={colors.textMuted}>Completed</MerakiText>
                                        <MerakiText variant="h3" color={colors.success}>{stats.completedBookings}</MerakiText>
                                    </View>
                                    <View style={styles.summaryDivider} />
                                    <View style={styles.summaryItem}>
                                        <MerakiText variant="caption" color={colors.textMuted}>Avg Value</MerakiText>
                                        <MerakiText variant="h3" color={colors.accent}>
                                            €{stats.averageBookingValue.toFixed(0)}
                                        </MerakiText>
                                    </View>
                                    <View style={styles.summaryDivider} />
                                    <View style={styles.summaryItem}>
                                        <MerakiText variant="caption" color={colors.textMuted}>Conversion</MerakiText>
                                        <MerakiText variant="h3" color="#4ADE80">
                                            {stats.conversionRate.toFixed(0)}%
                                        </MerakiText>
                                    </View>
                                </View>
                            </Card>
                        </ScrollView>
                    </View>

                    {/* Page 2: Revenue Trend */}
                    <View key="revenue" style={styles.page}>
                        <ScrollView
                            contentContainerStyle={styles.scrollContent}
                            refreshControl={
                                <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.accent} />
                            }
                            showsVerticalScrollIndicator={false}
                        >
                            <Card variant="glass" style={styles.chartCard}>
                                <View style={styles.chartHeader}>
                                    <MerakiText variant="bodyBold">Revenue Trend</MerakiText>
                                    <MerakiText variant="caption" color={colors.textMuted}>
                                        {timeRange === 'week' ? 'Daily' : timeRange === 'month' ? 'Weekly' : 'Monthly'}
                                    </MerakiText>
                                </View>
                                {stats.revenueTrend.length > 0 ? (
                                    <View style={styles.chartPlaceholder}>
                                        <View style={styles.chartBars}>
                                            {stats.revenueTrend.map((item, i) => {
                                                const maxVal = Math.max(...stats.revenueTrend.map((t) => t.value), 1);
                                                const heightPct = (item.value / maxVal) * 100;
                                                const isHighest = item.value === maxVal && item.value > 0;
                                                return (
                                                    <View key={i} style={styles.barContainer}>
                                                        <LinearGradient
                                                            colors={
                                                                isHighest
                                                                    ? (gradients.primary as any)
                                                                    : (['rgba(0, 0, 0, 0.10)', 'rgba(0, 0, 0, 0.03)'] as any)
                                                            }
                                                            style={[styles.bar, { height: `${Math.max(heightPct, 3)}%` }]}
                                                        />
                                                        {item.value > 0 && (
                                                            <MerakiText variant="caption" color={colors.textMuted} style={styles.barValue}>
                                                                €{item.value >= 1000 ? `${(item.value / 1000).toFixed(1)}k` : item.value.toFixed(0)}
                                                            </MerakiText>
                                                        )}
                                                    </View>
                                                );
                                            })}
                                        </View>
                                        <View style={styles.chartLabels}>
                                            {stats.revenueTrend.map((item, i) => (
                                                <MerakiText
                                                    key={i}
                                                    variant="caption"
                                                    color={colors.textMuted}
                                                    style={styles.label}
                                                >
                                                    {item.label}
                                                </MerakiText>
                                            ))}
                                        </View>
                                    </View>
                                ) : (
                                    <View style={styles.emptyChart}>
                                        <MaterialCommunityIcons name="chart-bar" size={48} color={colors.textMuted} style={{ opacity: 0.3 }} />
                                        <MerakiText variant="body" color={colors.textMuted} style={{ marginTop: spacing.sm }}>
                                            No revenue data for this period
                                        </MerakiText>
                                    </View>
                                )}
                            </Card>

                            {/* Revenue Breakdown */}
                            <Card variant="glass" style={styles.breakdownCard}>
                                <MerakiText variant="label" color={colors.textMuted} style={{ marginBottom: spacing.md }}>
                                    REVENUE BREAKDOWN
                                </MerakiText>
                                <View style={styles.breakdownRow}>
                                    <MerakiText variant="body">This Period</MerakiText>
                                    <MerakiText variant="bodyBold" color={colors.accent}>
                                        €{stats.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </MerakiText>
                                </View>
                                <View style={styles.breakdownRow}>
                                    <MerakiText variant="body">Previous Period</MerakiText>
                                    <MerakiText variant="bodyBold" color={colors.textSecondary}>
                                        €{stats.previousRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </MerakiText>
                                </View>
                                <View style={[styles.breakdownRow, { borderBottomWidth: 0 }]}>
                                    <MerakiText variant="body">Change</MerakiText>
                                    <MerakiText
                                        variant="bodyBold"
                                        color={revenueChange >= 0 ? colors.success : colors.error}
                                    >
                                        {revenueChange >= 0 ? '+' : ''}{revenueChange.toFixed(1)}%
                                    </MerakiText>
                                </View>
                            </Card>
                        </ScrollView>
                    </View>

                    {/* Page 3: Performance Metrics */}
                    <View key="metrics" style={styles.page}>
                        <ScrollView
                            contentContainerStyle={styles.scrollContent}
                            refreshControl={
                                <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.accent} />
                            }
                            showsVerticalScrollIndicator={false}
                        >
                            <MerakiText variant="label" color={colors.textMuted} style={styles.sectionLabel}>
                                PERFORMANCE METRICS
                            </MerakiText>

                            <MetricRow
                                label="Average Booking Value"
                                value={`€${stats.averageBookingValue.toFixed(2)}`}
                                icon="cash-multiple"
                                color="#FBBF24"
                            />
                            <MetricRow
                                label="Client Retention Rate"
                                value={`${stats.retentionRate.toFixed(1)}%`}
                                icon="account-heart"
                                color="#F472B6"
                            />
                            <MetricRow
                                label="Booking Conversion"
                                value={`${stats.conversionRate.toFixed(1)}%`}
                                icon="bullseye-arrow"
                                color="#4ADE80"
                            />
                            <MetricRow
                                label="Total Bookings"
                                value={`${stats.totalBookings}`}
                                icon="calendar-multiple"
                                color="#60A5FA"
                            />
                            <MetricRow
                                label="Completed Bookings"
                                value={`${stats.completedBookings}`}
                                icon="check-circle"
                                color="#34D399"
                            />
                            <MetricRow
                                label="Unique Clients"
                                value={`${stats.activeClients}`}
                                icon="account-group"
                                color="#A78BFA"
                            />
                        </ScrollView>
                    </View>
                </PagerView>
            </SafeAreaView>
        </ScreenBackground>
    );
}

function buildRevenueTrend(
    payments: { amount: number; created_at: string }[],
    range: TimeRange,
    rangeStart: Date,
    now: Date
): { label: string; value: number }[] {
    if (range === 'week') {
        const days = eachDayOfInterval({ start: rangeStart, end: now });
        return days.map((day) => ({
            label: format(day, 'EEE').charAt(0),
            value: payments
                .filter((p) => isSameDay(new Date(p.created_at), day))
                .reduce((s, p) => s + ((p.amount || 0) / 100), 0),
        }));
    } else if (range === 'month') {
        const weeks = eachWeekOfInterval({ start: rangeStart, end: now }, { weekStartsOn: 1 });
        return weeks.map((weekStart, i) => ({
            label: `W${i + 1}`,
            value: payments
                .filter((p) => isSameWeek(new Date(p.created_at), weekStart, { weekStartsOn: 1 }))
                .reduce((s, p) => s + ((p.amount || 0) / 100), 0),
        }));
    } else {
        const months = eachMonthOfInterval({ start: rangeStart, end: now });
        return months.map((monthStart) => ({
            label: format(monthStart, 'MMM').substring(0, 3),
            value: payments
                .filter((p) => isSameMonth(new Date(p.created_at), monthStart))
                .reduce((s, p) => s + ((p.amount || 0) / 100), 0),
        }));
    }
}

const MetricRow = ({ label, value, icon, color }: any) => (
    <Card variant="glass" style={styles.metricCard} noPadding>
        <View style={styles.metricRow}>
            <View style={[styles.metricIcon, { backgroundColor: `${color}15` }]}>
                <MaterialCommunityIcons name={icon} size={20} color={color} />
            </View>
            <MerakiText variant="body" style={{ flex: 1, marginLeft: 12 }}>{label}</MerakiText>
            <MerakiText variant="bodyBold" color={colors.textSecondary}>{value}</MerakiText>
        </View>
    </Card>
);

const styles = StyleSheet.create({
    container: { flex: 1 },
    loader: { flex: 1, justifyContent: 'center' },
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
        backgroundColor: 'rgba(0, 0, 0, 0.04)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
    },

    // Time Selector
    timeSelectorContainer: {
        paddingHorizontal: spacing.lg,
        marginBottom: spacing.sm,
    },
    timeSelector: {
        flexDirection: 'row',
        backgroundColor: 'rgba(0, 0, 0, 0.04)',
        borderRadius: 12,
        padding: 4,
    },
    timeOption: {
        flex: 1,
        height: 36,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    timeOptionActive: {
        elevation: 2,
    },
    timeText: {
        zIndex: 1,
        fontWeight: '700',
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

    // Content
    scrollContent: {
        paddingHorizontal: spacing.lg,
        paddingBottom: 40,
    },

    // Revenue Hero
    revenueHero: {
        padding: spacing.xl,
        alignItems: 'center',
        marginBottom: spacing.lg,
        overflow: 'hidden',
    },
    revenueAmount: {
        fontSize: 42,
        lineHeight: 54,
        fontWeight: '800',
        color: colors.text,
        marginVertical: spacing.md,
        paddingVertical: 4,
    },
    trendRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    heroGlow: {
        ...StyleSheet.absoluteFillObject,
        zIndex: -1,
    },

    // Stats Grid
    statsGrid: {
        flexDirection: 'row',
        gap: spacing.sm,
        marginBottom: spacing.lg,
    },
    statBox: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: spacing.lg,
    },
    iconBox: {
        width: 40,
        height: 40,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },

    // Summary Card
    summaryCard: {
        padding: spacing.lg,
        marginBottom: spacing.lg,
    },
    summaryRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    summaryItem: {
        flex: 1,
        alignItems: 'center',
    },
    summaryDivider: {
        width: 1,
        height: 40,
        backgroundColor: 'rgba(0, 0, 0, 0.06)',
    },

    // Chart Card
    chartCard: {
        padding: spacing.lg,
        marginBottom: spacing.xl,
    },
    chartHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.xl,
    },
    chartPlaceholder: {
        height: 220,
        justifyContent: 'flex-end',
    },
    chartBars: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        height: 180,
        paddingHorizontal: 4,
    },
    barContainer: {
        flex: 1,
        height: '100%',
        justifyContent: 'flex-end',
        alignItems: 'center',
        marginHorizontal: 2,
    },
    bar: {
        width: '80%',
        borderRadius: 8,
        minHeight: 4,
    },
    barValue: {
        fontSize: 9,
        marginBottom: 2,
        position: 'absolute',
        top: -16,
    },
    chartLabels: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: spacing.md,
        paddingHorizontal: 4,
    },
    label: {
        flex: 1,
        textAlign: 'center',
        fontSize: 10,
    },
    emptyChart: {
        height: 200,
        alignItems: 'center',
        justifyContent: 'center',
    },

    // Revenue Breakdown
    breakdownCard: {
        padding: spacing.lg,
        marginBottom: spacing.lg,
    },
    breakdownRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0, 0, 0, 0.05)',
    },

    // Performance Metrics
    sectionLabel: {
        marginBottom: spacing.md,
    },
    metricCard: {
        marginBottom: spacing.sm,
    },
    metricRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.md,
    },
    metricIcon: {
        width: 36,
        height: 36,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
});

export default PlatformAnalyticsScreen;
