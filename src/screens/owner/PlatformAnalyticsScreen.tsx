import React, { useState, useEffect } from 'react';
import {
    View,
    StyleSheet,
    ScrollView,
    ActivityIndicator,
    TouchableOpacity,
    Dimensions,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../lib/supabase';
import { ScreenBackground, MerakiText, Card, Button } from '../../components/ui';
import { colors, spacing, layout, gradients } from '../../theme';

const { width } = Dimensions.get('window');

type AnalyticsStats = {
    totalRevenue: number;
    totalBookings: number;
    activeClients: number;
    averageBookingValue: number;
};

export function PlatformAnalyticsScreen() {
    const navigation = useNavigation();
    const [loading, setLoading] = useState(true);
    const [timeRange, setTimeRange] = useState<'week' | 'month' | 'year'>('month');
    const [stats, setStats] = useState<AnalyticsStats>({
        totalRevenue: 12450.50,
        totalBookings: 184,
        activeClients: 92,
        averageBookingValue: 67.66,
    });

    useEffect(() => {
        // In a real app, fetch from Supabase based on timeRange
        const timer = setTimeout(() => setLoading(false), 800);
        return () => clearTimeout(timer);
    }, [timeRange]);

    if (loading) {
        return (
            <ScreenBackground>
                <SafeAreaView style={styles.container}>
                    <ActivityIndicator size="large" color={colors.accent} style={styles.loader} />
                </SafeAreaView>
            </ScreenBackground>
        );
    }

    return (
        <ScreenBackground>
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <MaterialCommunityIcons name="chevron-left" size={28} color={colors.text} />
                    </TouchableOpacity>
                    <MerakiText variant="h2" style={styles.headerTitle}>Platform Analytics</MerakiText>
                </View>

                <ScrollView contentContainerStyle={styles.scrollContent}>
                    {/* Time Range Selector */}
                    <View style={styles.timeSelector}>
                        {(['week', 'month', 'year'] as const).map((range) => (
                            <TouchableOpacity
                                key={range}
                                style={[styles.timeOption, timeRange === range && styles.timeOptionActive]}
                                onPress={() => setTimeRange(range)}
                            >
                                <MerakiText
                                    variant="caption"
                                    color={timeRange === range ? colors.textInvert : colors.textSecondary}
                                    style={styles.timeText}
                                >
                                    {range.toUpperCase()}
                                </MerakiText>
                                {timeRange === range && (
                                    <LinearGradient
                                        colors={gradients.primary as any}
                                        style={StyleSheet.absoluteFill}
                                    />
                                )}
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Revenue Hero */}
                    <Card variant="glass" style={styles.revenueHero}>
                        <MerakiText variant="label" color={colors.textSecondary}>TOTAL REVENUE</MerakiText>
                        <MerakiText style={styles.revenueAmount}>€{stats.totalRevenue.toLocaleString()}</MerakiText>
                        <View style={styles.trendRow}>
                            <MaterialCommunityIcons name="trending-up" size={20} color={colors.success} />
                            <MerakiText variant="caption" color={colors.success} style={{ marginLeft: 4 }}>
                                +12.4% vs last period
                            </MerakiText>
                        </View>
                        <LinearGradient
                            colors={['transparent', 'rgba(212, 138, 130, 0.05)']}
                            style={styles.heroGlow}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                        />
                    </Card>

                    {/* Secondary Stats Grid */}
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

                    {/* Placeholder for Chart */}
                    <Card variant="glass" style={styles.chartCard}>
                        <View style={styles.chartHeader}>
                            <MerakiText variant="bodyBold">Revenue Trend</MerakiText>
                            <MaterialCommunityIcons name="dots-vertical" size={20} color={colors.textMuted} />
                        </View>
                        <View style={styles.chartPlaceholder}>
                            <View style={styles.chartBars}>
                                {[40, 65, 45, 80, 55, 90, 70].map((h, i) => (
                                    <View key={i} style={styles.barContainer}>
                                        <LinearGradient
                                            colors={i === 5 ? (gradients.primary as any) : (['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)'] as any)}
                                            style={[styles.bar, { height: `${h}%` }]}
                                        />
                                    </View>
                                ))}
                            </View>
                            <View style={styles.chartLabels}>
                                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((l, i) => (
                                    <MerakiText key={i} variant="caption" color={colors.textMuted} style={styles.label}>{l}</MerakiText>
                                ))}
                            </View>
                        </View>
                    </Card>

                    {/* Key Metrics */}
                    <View style={styles.metricsSection}>
                        <MerakiText variant="label" color={colors.textMuted} style={styles.sectionLabel}>PERFORMANCE METRICS</MerakiText>
                        <MetricRow label="Average Booking Value" value={`€${stats.averageBookingValue}`} icon="cash-multiple" color="#FBBF24" />
                        <MetricRow label="Client Retention Rate" value="78%" icon="account-heart" color="#F472B6" />
                        <MetricRow label="Booking Conversion" value="24%" icon="bullseye-arrow" color="#4ADE80" />
                    </View>

                </ScrollView>
            </SafeAreaView>
        </ScreenBackground>
    );
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
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.05)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        marginLeft: spacing.md,
    },
    scrollContent: {
        paddingHorizontal: spacing.lg,
        paddingBottom: 40,
    },
    timeSelector: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 12,
        padding: 4,
        marginBottom: spacing.xl,
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
    revenueHero: {
        padding: spacing.xl,
        alignItems: 'center',
        marginBottom: spacing.lg,
        overflow: 'hidden',
    },
    revenueAmount: {
        fontSize: 42,
        fontWeight: '800',
        color: colors.text,
        marginVertical: spacing.sm,
    },
    trendRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    heroGlow: {
        ...StyleSheet.absoluteFillObject,
        zIndex: -1,
    },
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
        height: 200,
        justifyContent: 'flex-end',
    },
    chartBars: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        height: 160,
        paddingHorizontal: 10,
    },
    barContainer: {
        width: 30,
        height: '100%',
        justifyContent: 'flex-end',
    },
    bar: {
        width: '100%',
        borderRadius: 15,
    },
    chartLabels: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: spacing.md,
        paddingHorizontal: 10,
    },
    label: {
        width: 30,
        textAlign: 'center',
    },
    metricsSection: {
        marginBottom: spacing.xl,
    },
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
