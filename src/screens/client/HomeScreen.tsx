import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    RefreshControl,
    Dimensions,
    ActivityIndicator,
    Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { format, isToday, isTomorrow, parseISO, differenceInDays } from 'date-fns';
import { useAuth } from '../../contexts/AuthContext';
import { useCart } from '../../contexts/CartContext';
import { supabase } from '../../lib/supabase';
import { colors, spacing, layout } from '../../theme/colors';
import { Card, Button, ScreenBackground } from '../../components/ui';

const { width } = Dimensions.get('window');

// Quick actions configuration
const QUICK_ACTIONS = [
    { id: '1', label: 'Loyalty', icon: '⭐', route: 'LoyaltyPoints' },
    { id: '2', label: 'Orders', icon: '📦', route: 'Orders' },
    { id: '3', label: 'Messages', icon: '💬', route: 'Book', params: { screen: 'Messages' } },
    { id: '4', label: 'Support', icon: '🎧', route: 'HelpSupport' },
    { id: '5', label: 'Promo', icon: '🔥', route: 'Shop' },
    { id: '6', label: 'Profile', icon: '👤', route: 'Profile' },
];

interface Appointment {
    id: string;
    start_time: string;
    end_time: string;
    status: string;
    service?: { name: string; duration_minutes: number; price: number };
    master?: { full_name: string };
}

interface RecentOrder {
    id: string;
    total: number;
    status: string;
    created_at: string;
}

interface FeaturedMaster {
    id: string;
    full_name: string;
    avatar_url: string | null;
    bio: string | null;
}

import { safeSupabaseFetch } from '../../lib/supabaseApi';

// ... imports remain the same

export function ClientHomeScreen() {
    const navigation = useNavigation<any>();
    const { profile, user, checkSession } = useAuth();
    const { getItemCount } = useCart();
    const [refreshing, setRefreshing] = useState(false);
    const [loading, setLoading] = useState(true);

    // Real data state
    const [loyaltyPoints, setLoyaltyPoints] = useState(0);
    const [nextAppointment, setNextAppointment] = useState<Appointment | null>(null);
    const [upcomingAppointments, setUpcomingAppointments] = useState<Appointment[]>([]);
    const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
    const [featuredMasters, setFeaturedMasters] = useState<FeaturedMaster[]>([]);
    const [totalVisits, setTotalVisits] = useState(0);
    const [totalOrders, setTotalOrders] = useState(0);

    const fetchHomeData = async () => {
        if (!user) return;

        // Validate session before attempting fetch
        const isSessionValid = await checkSession();
        if (!isSessionValid) {
            setLoading(false);
            setRefreshing(false);
            return;
        }

        try {
            // Fetch loyalty points from profile
            const profilePromise = (supabase as any)
                .from('profiles')
                .select('loyalty_points')
                .eq('id', user.id)
                .single();

            const { data: profileData } = await safeSupabaseFetch(profilePromise, {
                timeout: 5000,
                errorMessage: 'Failed to load loyalty data'
            });

            if (profileData) {
                setLoyaltyPoints((profileData as any).loyalty_points || 0);
            }

            // Fetch upcoming appointments
            const now = new Date().toISOString();
            const appointmentsPromise = (supabase as any)
                .from('appointments')
                .select(`
                    id,
                    start_time,
                    end_time,
                    status,
                    service:services (name, duration_minutes, base_price),
                    master:profiles!appointments_master_id_fkey (full_name)
                `)
                .eq('client_id', user.id)
                .in('status', ['confirmed', 'pending'])
                .gte('start_time', now)
                .order('start_time', { ascending: true })
                .limit(5);

            const { data: appointments } = await safeSupabaseFetch(appointmentsPromise, { timeout: 8000 });

            setUpcomingAppointments((appointments as any) || []);
            setNextAppointment((appointments as any)?.[0] || null);

            // Count total completed visits
            const visitsPromise = (supabase as any)
                .from('appointments')
                .select('*', { count: 'exact', head: true })
                .eq('client_id', user.id)
                .eq('status', 'completed');

            const { count: visitCount } = await visitsPromise; // Count is separate property, safe to await directly or wrap if needed
            // Note: count query is usually fast, but for consistency we could wrap it. 
            // Keeping it simple since it's a HEAD request.

            setTotalVisits(visitCount || 0);

            // Fetch recent orders
            const ordersPromise = (supabase as any)
                .from('orders')
                .select('id, total, status, created_at')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(3);

            const { data: orders } = await safeSupabaseFetch(ordersPromise, { timeout: 5000 });

            setRecentOrders((orders as any) || []);

            // Fetch featured masters (users who are masters or owners)
            const mastersPromise = (supabase as any)
                .from('profiles')
                .select('id, full_name, avatar_url, bio')
                .or('is_master.eq.true,role.eq.master,role.eq.owner')
                .limit(10);

            const { data: masters } = await safeSupabaseFetch(mastersPromise, { timeout: 5000 });
            setFeaturedMasters((masters as FeaturedMaster[]) || []);

        } catch (error) {
            console.error('Error fetching home data:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchHomeData();
        }, [user])
    );

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchHomeData();
    };

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good Morning';
        if (hour < 18) return 'Good Afternoon';
        return 'Good Evening';
    };

    const formatNextVisit = () => {
        if (!nextAppointment) return 'No upcoming visits';

        const date = parseISO(nextAppointment.start_time);
        const time = format(date, 'HH:mm');

        if (isToday(date)) return `Today, ${time}`;
        if (isTomorrow(date)) return `Tomorrow, ${time}`;

        const daysAway = differenceInDays(date, new Date());
        if (daysAway < 7) return format(date, 'EEEE, HH:mm');

        return format(date, 'MMM d, HH:mm');
    };

    const navigateTo = (route: string) => {
        if (route === 'Shop') {
            navigation.navigate('Shop');
        } else {
            navigation.navigate(route);
        }
    };

    const cartCount = getItemCount();

    return (
        <ScreenBackground>
            <SafeAreaView style={styles.content}>
                <ScrollView
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
                    }
                    contentContainerStyle={styles.scrollContent}
                >
                    {/* Header Section */}
                    <View style={styles.header}>
                        <View>
                            <Text style={styles.greeting}>{getGreeting()},</Text>
                            <Text style={styles.userName}>{profile?.full_name?.split(' ')[0] || 'Guest'}</Text>
                        </View>
                        <View style={styles.headerRight}>
                            <TouchableOpacity
                                style={styles.qrScannerBtn}
                                onPress={() => navigation.navigate('QRScanner')}
                            >
                                <MaterialCommunityIcons name="qrcode-scan" size={22} color={colors.text} />
                            </TouchableOpacity>
                            {cartCount > 0 && (
                                <TouchableOpacity
                                    style={styles.cartBtn}
                                    onPress={() => navigation.navigate('Shop', { screen: 'Cart' })}
                                >
                                    <Text style={styles.cartIcon}>🛒</Text>
                                    <View style={styles.cartBadge}>
                                        <Text style={styles.cartBadgeText}>{cartCount}</Text>
                                    </View>
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity
                                style={styles.profileBtn}
                                onPress={() => navigation.navigate('Menu')}
                            >
                                <Text style={styles.profileInitial}>
                                    {profile?.full_name?.[0] || '?'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Stats Card */}
                    <Card variant="glass" style={styles.statsCard}>
                        <View style={styles.statsRow}>
                            <TouchableOpacity style={styles.statItem} onPress={() => navigateTo('LoyaltyPoints')}>
                                <Text style={styles.statLabel}>Loyalty Points</Text>
                                <Text style={styles.statValue}>
                                    {loading ? '...' : loyaltyPoints.toLocaleString()}
                                </Text>
                            </TouchableOpacity>
                            <View style={styles.statDivider} />
                            <TouchableOpacity style={styles.statItem} onPress={() => nextAppointment && navigateTo('Book')}>
                                <Text style={styles.statLabel}>Next Visit</Text>
                                <Text style={styles.statValue}>
                                    {loading ? '...' : formatNextVisit()}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </Card>

                    {/* Upcoming Appointment Banner */}
                    {nextAppointment && (
                        <TouchableOpacity
                            style={styles.appointmentBanner}
                            onPress={() => navigateTo('Book')}
                        >
                            <LinearGradient
                                colors={['rgba(139,92,246,0.2)', 'rgba(59,130,246,0.2)']}
                                style={styles.appointmentGradient}
                            >
                                <View style={styles.appointmentLeft}>
                                    <Text style={styles.appointmentIcon}>📅</Text>
                                    <View>
                                        <Text style={styles.appointmentTitle}>
                                            {nextAppointment.service?.name || 'Appointment'}
                                        </Text>
                                        <Text style={styles.appointmentTime}>
                                            {formatNextVisit()} • {nextAppointment.master?.full_name}
                                        </Text>
                                    </View>
                                </View>
                                <Text style={styles.appointmentArrow}>›</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    )}

                    {/* Main CTA Grid */}
                    <View style={styles.ctaSection}>
                        <Text style={styles.sectionTitle}>What would you like to do?</Text>
                        <View style={styles.ctaGrid}>
                            <TouchableOpacity
                                style={[styles.ctaCard, styles.ctaPrimary]}
                                onPress={() => navigation.navigate('Book')}
                            >
                                <LinearGradient
                                    colors={[colors.primary, colors.secondary]}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={styles.ctaGradient}
                                >
                                    <Text style={styles.ctaIcon}>📅</Text>
                                    <Text style={styles.ctaTitle}>Book Appointment</Text>
                                    <Text style={styles.ctaSubtitle}>Schedule your next visit</Text>
                                </LinearGradient>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.ctaCard, styles.ctaSecondary]}
                                onPress={() => navigation.navigate('Shop')}
                            >
                                <View style={styles.ctaContent}>
                                    <Text style={styles.ctaIcon}>🛍️</Text>
                                    <Text style={styles.ctaTitle}>Shop Products</Text>
                                    <Text style={styles.ctaSubtitleDark}>Browse our collection</Text>
                                </View>
                            </TouchableOpacity>
                        </View>

                        {/* Second Row */}
                        <View style={[styles.ctaGrid, { marginTop: spacing.md }]}>
                            <TouchableOpacity
                                style={[styles.ctaCard, styles.ctaSecondary]}
                                onPress={() => navigation.navigate('Academy')}
                            >
                                <View style={styles.ctaContent}>
                                    <Text style={styles.ctaIcon}>🎓</Text>
                                    <Text style={styles.ctaTitle}>Academy</Text>
                                    <Text style={styles.ctaSubtitleDark}>Learn new skills</Text>
                                </View>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.ctaCard, styles.ctaSecondary]}
                                onPress={() => navigation.navigate('Book', { screen: 'Messages' })}
                            >
                                <View style={styles.ctaContent}>
                                    <Text style={styles.ctaIcon}>💬</Text>
                                    <Text style={styles.ctaTitle}>Messages</Text>
                                    <Text style={styles.ctaSubtitleDark}>Chat with your stylist</Text>
                                </View>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Quick Actions Grid */}
                    <View style={styles.actionsSection}>
                        <Text style={styles.sectionTitle}>Quick Actions</Text>
                        <View style={styles.actionsGrid}>
                            {QUICK_ACTIONS.map((action) => (
                                <TouchableOpacity
                                    key={action.id}
                                    style={styles.actionGridItem}
                                    onPress={() => navigateTo(action.route)}
                                >
                                    <View style={styles.actionIconBg}>
                                        <Text style={styles.actionIcon}>{action.icon}</Text>
                                    </View>
                                    <Text style={styles.actionLabel}>{action.label}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    {/* Featured Masters */}
                    {featuredMasters.length > 0 && (
                        <View style={styles.featuredMastersSection}>
                            <View style={styles.sectionHeader}>
                                <Text style={styles.sectionTitle}>Featured Masters</Text>
                                <TouchableOpacity onPress={() => navigation.navigate('Book')}>
                                    <Text style={styles.seeAll}>See All</Text>
                                </TouchableOpacity>
                            </View>
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={styles.mastersScroll}
                            >
                                {featuredMasters.map((master) => (
                                    <TouchableOpacity
                                        key={master.id}
                                        style={styles.masterCard}
                                        onPress={() => navigation.navigate('MasterDetail', { masterId: master.id })}
                                    >
                                        {master.avatar_url ? (
                                            <View style={styles.masterImageContainer}>
                                                <Image
                                                    source={{ uri: master.avatar_url }}
                                                    style={styles.masterImagePlaceholder}
                                                    resizeMode="cover"
                                                />
                                            </View>
                                        ) : (
                                            <View style={styles.masterAvatarFallback}>
                                                <Text style={styles.masterAvatarText}>
                                                    {master.full_name?.[0] || '?'}
                                                </Text>
                                            </View>
                                        )}
                                        <Text style={styles.masterCardName} numberOfLines={1}>
                                            {master.full_name || 'Master'}
                                        </Text>
                                        {master.bio && (
                                            <Text style={styles.masterCardBio} numberOfLines={2}>
                                                {master.bio}
                                            </Text>
                                        )}
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>
                    )}

                    {/* My Stats Card */}
                    <View style={styles.myStatsSection}>
                        <Text style={styles.sectionTitle}>Your Journey</Text>
                        <View style={styles.myStatsGrid}>
                            <View style={styles.myStatCard}>
                                <Text style={styles.myStatValue}>{totalVisits}</Text>
                                <Text style={styles.myStatLabel}>Total Visits</Text>
                            </View>
                            <View style={styles.myStatCard}>
                                <Text style={styles.myStatValue}>{loyaltyPoints}</Text>
                                <Text style={styles.myStatLabel}>Points Earned</Text>
                            </View>
                            <View style={styles.myStatCard}>
                                <Text style={styles.myStatValue}>{totalOrders}</Text>
                                <Text style={styles.myStatLabel}>Orders</Text>
                            </View>
                        </View>
                    </View>

                    {/* Recent Orders */}
                    {recentOrders.length > 0 && (
                        <View style={styles.recentSection}>
                            <View style={styles.sectionHeader}>
                                <Text style={styles.sectionTitle}>Recent Orders</Text>
                                <TouchableOpacity onPress={() => navigateTo('Orders')}>
                                    <Text style={styles.seeAll}>See All</Text>
                                </TouchableOpacity>
                            </View>
                            {recentOrders.slice(0, 2).map((order) => (
                                <TouchableOpacity
                                    key={order.id}
                                    style={styles.orderCard}
                                    onPress={() => navigateTo('Orders')}
                                >
                                    <View style={styles.orderInfo}>
                                        <Text style={styles.orderId}>
                                            Order #{order.id.slice(0, 8).toUpperCase()}
                                        </Text>
                                        <Text style={styles.orderDate}>
                                            {format(parseISO(order.created_at), 'MMM d, yyyy')}
                                        </Text>
                                    </View>
                                    <View style={styles.orderRight}>
                                        <Text style={styles.orderTotal}>€{order.total.toFixed(2)}</Text>
                                        <View style={[
                                            styles.orderStatus,
                                            order.status === 'delivered' && styles.orderStatusDelivered,
                                            order.status === 'confirmed' && styles.orderStatusConfirmed,
                                        ]}>
                                            <Text style={styles.orderStatusText}>{order.status}</Text>
                                        </View>
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}

                    {/* Featured Promo */}
                    <View style={styles.featuredSection}>
                        <Text style={styles.sectionTitle}>Featured</Text>
                        <Card variant="elevated" style={styles.featuredCard} noPadding>
                            <LinearGradient
                                colors={['transparent', 'rgba(0,0,0,0.8)']}
                                style={styles.featuredOverlay}
                            />
                            <View style={[styles.featuredImagePlaceholder, { backgroundColor: colors.surfaceLight }]} />
                            <View style={styles.featuredContent}>
                                <Text style={styles.featuredTag}>NEW ARRIVAL</Text>
                                <Text style={styles.featuredTitle}>Summer Collection</Text>
                                <Button
                                    title="Shop Now"
                                    size="sm"
                                    variant="primary"
                                    style={styles.featuredBtn}
                                    onPress={() => navigation.navigate('Shop')}
                                />
                            </View>
                        </Card>
                    </View>

                </ScrollView>
            </SafeAreaView>
        </ScreenBackground>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    content: { flex: 1 },
    scrollContent: { padding: spacing.lg, paddingBottom: 100 },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.xl,
    },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    greeting: { fontSize: 14, color: colors.textSecondary, marginBottom: 4 },
    userName: { fontSize: 28, fontWeight: '700', color: colors.text, letterSpacing: -0.5 },
    qrScannerBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: colors.surfaceLight,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: colors.border,
        marginRight: spacing.sm,
    },
    qrIcon: { fontSize: 20 },
    cartBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: colors.surfaceLight,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: colors.border,
        position: 'relative',
    },
    cartIcon: { fontSize: 18 },
    cartBadge: {
        position: 'absolute',
        top: -4,
        right: -4,
        backgroundColor: colors.primary,
        borderRadius: 10,
        minWidth: 18,
        height: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cartBadgeText: { color: colors.text, fontSize: 10, fontWeight: '700' },
    profileBtn: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: colors.surfaceLight,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: colors.border,
    },
    profileInitial: { fontSize: 20, fontWeight: '600', color: colors.primary },
    statsCard: { marginBottom: spacing.lg },
    statsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    statItem: { flex: 1, alignItems: 'center' },
    statDivider: { width: 1, height: 30, backgroundColor: colors.borderLight },
    statLabel: { fontSize: 12, color: colors.textMuted, marginBottom: 4 },
    statValue: { fontSize: 16, fontWeight: '600', color: colors.text },
    appointmentBanner: { marginBottom: spacing.lg },
    appointmentGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderRadius: 16,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: 'rgba(139,92,246,0.3)',
    },
    appointmentLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    appointmentIcon: { fontSize: 28 },
    appointmentTitle: { fontSize: 14, fontWeight: '600', color: colors.text },
    appointmentTime: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
    appointmentArrow: { fontSize: 24, color: colors.textMuted },
    ctaSection: { marginBottom: spacing.xl },
    sectionTitle: { fontSize: 18, fontWeight: '600', color: colors.text, marginBottom: spacing.md },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
    seeAll: { fontSize: 14, color: colors.primary, fontWeight: '500' },
    ctaGrid: { flexDirection: 'row', gap: spacing.md },
    ctaCard: { flex: 1, height: 140, borderRadius: layout.borderRadius.md, overflow: 'hidden' },
    ctaPrimary: {},
    ctaSecondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
    ctaGradient: { flex: 1, padding: spacing.md, justifyContent: 'flex-end' },
    ctaContent: { flex: 1, padding: spacing.md, justifyContent: 'flex-end' },
    ctaIcon: { fontSize: 24, marginBottom: spacing.sm },
    ctaTitle: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 2 },
    ctaSubtitle: { fontSize: 11, color: 'rgba(255,255,255,0.7)' },
    ctaSubtitleDark: { fontSize: 11, color: colors.textMuted },
    actionsSection: { marginBottom: spacing.xl },
    actionsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.md,
    },
    actionGridItem: {
        width: (width - spacing.lg * 2 - spacing.md * 2) / 3,
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: 16,
        paddingVertical: spacing.md,
        borderWidth: 1,
        borderColor: colors.border,
    },
    actionsScroll: { paddingHorizontal: spacing.lg },
    actionItem: { alignItems: 'center', marginRight: spacing.lg },
    actionIconBg: {
        width: 56,
        height: 56,
        borderRadius: 20,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    actionIcon: { fontSize: 20 },
    actionLabel: { fontSize: 12, color: colors.textSecondary },
    myStatsSection: { marginBottom: spacing.xl },
    myStatsGrid: { flexDirection: 'row', gap: spacing.md },
    myStatCard: {
        flex: 1,
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: spacing.md,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.border,
    },
    myStatValue: { fontSize: 24, fontWeight: '700', color: colors.text },
    myStatLabel: { fontSize: 11, color: colors.textMuted, marginTop: 4 },
    recentSection: { marginBottom: spacing.xl },
    orderCard: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: spacing.md,
        marginBottom: spacing.sm,
        borderWidth: 1,
        borderColor: colors.border,
    },
    orderInfo: {},
    orderId: { fontSize: 14, fontWeight: '600', color: colors.text },
    orderDate: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
    orderRight: { alignItems: 'flex-end' },
    orderTotal: { fontSize: 16, fontWeight: '700', color: colors.text },
    orderStatus: {
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
        borderRadius: 4,
        backgroundColor: 'rgba(255,255,255,0.1)',
        marginTop: 4,
    },
    orderStatusDelivered: { backgroundColor: 'rgba(34,197,94,0.1)' },
    orderStatusConfirmed: { backgroundColor: 'rgba(59,130,246,0.1)' },
    orderStatusText: { fontSize: 10, color: colors.textSecondary, textTransform: 'capitalize' },
    featuredSection: { marginBottom: spacing.lg },
    featuredCard: { height: 200, marginTop: spacing.sm },
    featuredImagePlaceholder: { ...StyleSheet.absoluteFillObject },
    featuredOverlay: { ...StyleSheet.absoluteFillObject },
    featuredContent: { flex: 1, justifyContent: 'flex-end', padding: spacing.lg },
    featuredTag: { fontSize: 10, fontWeight: '700', color: colors.accent, marginBottom: 4, letterSpacing: 1 },
    featuredTitle: { fontSize: 24, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
    featuredBtn: { alignSelf: 'flex-start' },
    featuredMastersSection: { marginBottom: spacing.xl },
    mastersScroll: { paddingRight: spacing.lg },
    masterCard: {
        width: 140,
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: spacing.md,
        marginRight: spacing.md,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: 'center',
    },
    masterImageContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        overflow: 'hidden',
        marginBottom: spacing.sm,
    },
    masterImagePlaceholder: {
        width: 80,
        height: 80,
        borderRadius: 40,
    },
    masterAvatarFallback: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: colors.surfaceLight,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.sm,
        borderWidth: 2,
        borderColor: colors.primary,
    },
    masterAvatarText: {
        fontSize: 32,
        fontWeight: '600',
        color: colors.primary,
    },
    masterCardName: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.text,
        textAlign: 'center',
        marginBottom: 4,
    },
    masterCardBio: {
        fontSize: 11,
        color: colors.textMuted,
        textAlign: 'center',
        lineHeight: 14,
    },
});

export default ClientHomeScreen;
