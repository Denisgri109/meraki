import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    StyleSheet,
    ScrollView,
    RefreshControl,
    ActivityIndicator,
    TouchableOpacity,
    Dimensions,
} from 'react-native';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { format, startOfDay, endOfDay } from 'date-fns';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { supabase } from '../../lib/supabase';
import { safeSupabaseFetch } from '../../lib/supabaseApi';
import { useAuth } from '../../contexts/AuthContext';
import { useModal } from '../../contexts/ModalContext';
import { Card, ScreenBackground, MerakiText } from '../../components/ui';
import { colors, spacing, layout, gradients } from '../../theme';
import { getDeviceTimezone } from '../../utils/timezone';

const { width } = Dimensions.get('window');

type Appointment = {
    id: string;
    start_time: string;
    status: string;
    price: number;
    service: { name: string } | null;
    client: { full_name: string } | null;
};

type RecentMessage = {
    id: string;
    content: string | null;
    media_type: string | null;
    created_at: string;
    sender_name: string;
    conversation_id: string;
};

type Stats = {
    totalServices: number;
    activeServices: number;
    todayAppointments: number;
    pendingAppointments: number;
    todayEarnings: number;
    unreadMessages: number;
};

const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
};

export function OwnerDashboardScreen() {
    const navigation = useNavigation<any>();
    const { profile, user, refreshProfile } = useAuth();
    const { showAlert } = useModal();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [stats, setStats] = useState<Stats>({
        totalServices: 0,
        activeServices: 0,
        todayAppointments: 0,
        pendingAppointments: 0,
        todayEarnings: 0,
        unreadMessages: 0,
    });
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [recentMessages, setRecentMessages] = useState<RecentMessage[]>([]);

    useFocusEffect(
        useCallback(() => {
            fetchDashboardData();

            // Real-time subscription for message updates
            const channel = supabase
                .channel('owner_dashboard_messages')
                .on(
                    'postgres_changes',
                    {
                        event: 'INSERT',
                        schema: 'public',
                        table: 'messages',
                    },
                    () => {
                        fetchDashboardData();
                    }
                )
                .subscribe();

            return () => {
                supabase.removeChannel(channel);
            };
        }, [user?.id])
    );

    useEffect(() => {
        const checkLocationSettings = async () => {
            if (!profile || !user || (profile.timezone && profile.city && profile.country)) return;
            try {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== 'granted') {
                    showAlert('Location Access Important', 'To accurately show your city and timezone to clients, please enable location permissions.', 'info');
                    return;
                }
                let newTimezone = profile.timezone;
                if (!newTimezone) {
                    newTimezone = getDeviceTimezone();
                }
                let city = profile.city;
                let country = profile.country;
                let currency = profile.currency;
                if (!city || !country) {
                    const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
                    const [geocode] = await Location.reverseGeocodeAsync({ latitude: location.coords.latitude, longitude: location.coords.longitude });
                    if (geocode) {
                        city = city || geocode.city || geocode.subregion || null;
                        country = country || geocode.country || null;
                        if (!currency && geocode.isoCountryCode) {
                            const COUNTRY_CURRENCY_MAP: Record<string, string> = {
                                GB: 'GBP', US: 'USD', CA: 'CAD', AU: 'AUD', NZ: 'NZD',
                                JP: 'JPY', CN: 'CNY', KR: 'KRW', SG: 'SGD', AE: 'AED',
                                BR: 'BRL', RU: 'RUB', CH: 'CHF', IN: 'INR', MX: 'MXN', ZA: 'ZAR',
                            };
                            const mapped = COUNTRY_CURRENCY_MAP[geocode.isoCountryCode];
                            if (mapped) {
                                currency = mapped;
                            } else if (['DE', 'FR', 'ES', 'IT', 'NL', 'BE', 'AT', 'PT', 'IE', 'FI'].includes(geocode.isoCountryCode)) {
                                currency = 'EUR';
                            }
                        }
                    }
                }
                const updates: any = {};
                if (!profile.timezone && newTimezone) updates.timezone = newTimezone;
                if (!profile.city && city) updates.city = city;
                if (!profile.country && country) updates.country = country;
                if (!profile.currency && currency) updates.currency = currency;
                if (Object.keys(updates).length > 0) {
                    await supabase.from('profiles').update(updates).eq('id', user.id);
                    refreshProfile();
                }
            } catch (err) {
                console.log('Location auto-detect skipped:', err);
            }
        };
        checkLocationSettings();
    }, [profile?.id]);

    const fetchDashboardData = async () => {
        if (!user) return;
        try {
            const todayStart = startOfDay(new Date()).toISOString();
            const todayEnd = endOfDay(new Date()).toISOString();

            // Services
            const { count: servicesCount } = await supabase.from('services').select('*', { count: 'exact', head: true }).eq('created_by', user.id);
            const { count: activeServicesCount } = await supabase.from('services').select('*', { count: 'exact', head: true }).eq('created_by', user.id).eq('is_active', true);

            // Today's Stats
            const todayPromise = supabase.from('appointments').select(`id, start_time, status, price, service:services(name), client:profiles!appointments_client_id_fkey(full_name)`).eq('master_id', user.id).gte('start_time', todayStart).lt('start_time', todayEnd).in('status', ['confirmed', 'pending', 'completed']).order('start_time');
            const { data: todayData } = await safeSupabaseFetch(todayPromise as any);

            // Upcoming confirmed
            const allAppointmentsPromise = supabase.from('appointments').select(`id, start_time, status, price, service:services(name), client:profiles!appointments_client_id_fkey(full_name)`).eq('master_id', user.id).eq('status', 'confirmed').gte('start_time', new Date().toISOString()).order('start_time', { ascending: true }).limit(5);
            const { data: allAppointmentsData } = await safeSupabaseFetch(allAppointmentsPromise as any);

            const { count: pendingCount } = await supabase.from('appointments').select('*', { count: 'exact', head: true }).eq('master_id', user.id).eq('status', 'pending');

            // Unread messages count
            let unreadCount = 0;
            const { data: conversations } = await safeSupabaseFetch(supabase.from('conversations').select('id').or(`participant1_id.eq.${user.id},participant2_id.eq.${user.id}`) as any);
            if (conversations && (conversations as any[]).length > 0) {
                const convIds = (conversations as any[]).map((c: any) => c.id);
                const { count } = await supabase.from('messages').select('*', { count: 'exact', head: true }).in('conversation_id', convIds).neq('sender_id', user.id).eq('is_read', false);
                unreadCount = count || 0;
            }

            // Recent messages for banner
            let recentMsgs: RecentMessage[] = [];
            if (conversations && (conversations as any[]).length > 0) {
                const convIds = (conversations as any[]).map((c: any) => c.id);
                const { data: msgs } = await safeSupabaseFetch(supabase.from('messages').select('*').in('conversation_id', convIds).neq('sender_id', user.id).eq('is_read', false).order('created_at', { ascending: false }).limit(10) as any);
                const latestBySender = new Map();
                ((msgs as any[]) || []).forEach((msg: any) => { if (!latestBySender.has(msg.sender_id)) latestBySender.set(msg.sender_id, msg); });
                const uniqueMessages = Array.from(latestBySender.values()).slice(0, 3);
                recentMsgs = await Promise.all(uniqueMessages.map(async (msg: any) => {
                    const { data: sender } = await safeSupabaseFetch(supabase.from('profiles').select('full_name').eq('id', msg.sender_id).single() as any);
                    return { id: msg.id, content: msg.content, media_type: msg.media_type, created_at: msg.created_at, sender_name: (sender as any)?.full_name || 'Client', conversation_id: msg.conversation_id };
                }));
            }

            const todayEarnings = ((todayData as any[]) || []).filter(apt => apt.status === 'completed').reduce((sum, apt) => sum + (apt.price || 0), 0);

            setAppointments((allAppointmentsData as unknown as Appointment[]) || []);
            setRecentMessages(recentMsgs);
            setStats({
                totalServices: servicesCount || 0,
                activeServices: activeServicesCount || 0,
                todayAppointments: ((todayData as any[]) || []).filter(apt => apt.status !== 'completed').length,
                pendingAppointments: pendingCount || 0,
                todayEarnings,
                unreadMessages: unreadCount,
            });
        } catch (error) {
            console.error('Error fetching owner data:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleRefresh = () => { setRefreshing(true); fetchDashboardData(); };

    if (loading) return (
        <ScreenBackground>
            <SafeAreaView style={styles.container}><ActivityIndicator size="large" color={colors.accent} style={styles.loader} /></SafeAreaView>
        </ScreenBackground>
    );

    return (
        <ScreenBackground>
            <SafeAreaView style={styles.container} edges={['top']}>
                <ScrollView contentContainerStyle={styles.scrollContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.accent} />}>
                    {/* Header */}
                    <View style={styles.header}>
                        <View>
                            <MerakiText style={styles.greeting}>{getGreeting()},</MerakiText>
                            <MerakiText style={styles.userName}>{profile?.full_name?.split(' ')[0] || 'Owner'}</MerakiText>
                        </View>
                        <View style={styles.headerIcons}>
                            <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('LoyaltyQR')}>
                                <MaterialIcons name="qr-code-scanner" size={20} color="rgba(255,255,255,0.7)" />
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('PlatformAnalytics')}>
                                <MaterialCommunityIcons name="finance" size={20} color="rgba(255,255,255,0.7)" />
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('Notifications')}>
                                <MaterialIcons name="notifications-none" size={22} color="rgba(255,255,255,0.7)" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Business Stats Grid */}
                    <View style={styles.statsGrid}>
                        <Card variant="glass" style={styles.statCard}>
                            <MerakiText variant="h2" color={colors.accent}>€{stats.todayEarnings}</MerakiText>
                            <MerakiText variant="caption" color={colors.textMuted}>Daily Rev</MerakiText>
                        </Card>
                        <Card variant="glass" style={styles.statCard}>
                            <MerakiText variant="h2" color={colors.success}>{stats.activeServices}</MerakiText>
                            <MerakiText variant="caption" color={colors.textMuted}>Live Services</MerakiText>
                        </Card>
                        <Card variant="glass" style={[styles.statCard, stats.pendingAppointments > 0 && styles.pendingStat]}>
                            <MerakiText variant="h2" color={stats.pendingAppointments > 0 ? colors.error : colors.text}>{stats.pendingAppointments}</MerakiText>
                            <MerakiText variant="caption" color={colors.textMuted}>To Action</MerakiText>
                        </Card>
                    </View>

                    {/* Business Control — from Master */}
                    <View style={styles.section}>
                        <MerakiText variant="label" color={colors.textMuted} style={styles.sectionLabel}>BUSINESS CONTROL</MerakiText>
                        <View style={styles.actionsGrid}>
                            <ActionButton icon="calendar-month" label="Schedule" onPress={() => navigation.navigate('Availability')} color="#A78BFA" />
                            <ActionButton icon="card-account-details-star" label="Portfolio" onPress={() => navigation.navigate('Portfolio')} color="#34D399" />
                            <ActionButton icon="room-service" label="Services" onPress={() => navigation.navigate('MyServices')} color="#60A5FA" />
                            <ActionButton icon="clock-check" label="Availability" onPress={() => navigation.navigate('Availability')} color="#F472B6" />
                            <ActionButton icon="ticket-confirmation" label="Loyalty" onPress={() => navigation.navigate('LoyaltyCardBuilder')} color="#FBBF24" />
                            <ActionButton icon="cog" label="Settings" onPress={() => navigation.navigate('Settings')} color="#94A3B8" />
                        </View>
                    </View>

                    {/* Management Sections */}
                    <View style={styles.section}>
                        <MerakiText variant="label" color={colors.textMuted} style={styles.sectionLabel}>INVENTORY & LOGISTICS</MerakiText>
                        <View style={styles.actionsGrid}>
                            <ManagementCard icon="package-variant-closed" label="Inventory" onPress={() => navigation.navigate('Inventory')} color="#F19A3E" halfWidth />
                            <ManagementCard icon="truck-delivery" label="Supplies" onPress={() => navigation.navigate('OwnerSupplies')} color="#4ADE80" halfWidth />
                        </View>
                    </View>

                    <View style={styles.section}>
                        <MerakiText variant="label" color={colors.textMuted} style={styles.sectionLabel}>MARKETING & LOYALTY</MerakiText>
                        <View style={styles.actionsGrid}>
                            <ManagementCard icon="bullhorn" label="Campaigns" onPress={() => navigation.navigate('AftercareCampaigns')} color="#F472B6" />
                            <ManagementCard icon="card-bulleted" label="Loyalty" onPress={() => navigation.navigate('LoyaltyCardBuilder')} color="#FBBF24" />
                            <ManagementCard icon="chat-question" label="Consultations" onPress={() => navigation.navigate('BookingConsultations')} color="#8B5CF6" />
                        </View>
                    </View>

                    {/* Messages Banner */}
                    {stats.unreadMessages > 0 && (
                        <TouchableOpacity style={styles.messagesBanner} onPress={() => navigation.navigate('Messages')}>
                            <LinearGradient colors={gradients.secondary as any} style={styles.bannerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                                <View style={styles.bannerContent}>
                                    <View style={styles.bannerLeft}>
                                        <MaterialCommunityIcons name="message-alert" size={24} color="#FFF" />
                                        <MerakiText variant="bodyBold" color="#FFF" style={{ marginLeft: 12 }}>
                                            {stats.unreadMessages} Unread Messages
                                        </MerakiText>
                                    </View>
                                    <MaterialCommunityIcons name="chevron-right" size={20} color="#FFF" />
                                </View>
                            </LinearGradient>
                        </TouchableOpacity>
                    )}

                    {/* Appointment Overview */}
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <MerakiText variant="label" color={colors.textMuted}>LIVE OPERATIONS</MerakiText>
                            <TouchableOpacity onPress={() => navigation.navigate('Appointments')}>
                                <MerakiText variant="caption" color={colors.accent}>RECORDS →</MerakiText>
                            </TouchableOpacity>
                        </View>
                        {appointments.length > 0 ? (
                            appointments.map((apt) => (
                                <Card key={apt.id} variant="glass" style={styles.appointmentCard} noPadding>
                                    <TouchableOpacity style={styles.aptRow}>
                                        <View style={styles.timeBlock}>
                                            <MerakiText variant="bodyBold" color={colors.accent}>{format(new Date(apt.start_time), 'HH:mm')}</MerakiText>
                                        </View>
                                        <View style={styles.infoBlock}>
                                            <MerakiText variant="bodyBold" numberOfLines={1}>{apt.service?.name || 'Service'}</MerakiText>
                                            <MerakiText variant="caption" color={colors.textSecondary}>{apt.client?.full_name || 'Client'}</MerakiText>
                                        </View>
                                        <View style={styles.statusDot} />
                                    </TouchableOpacity>
                                </Card>
                            ))
                        ) : (
                            <Card variant="glass" style={styles.emptyCard}>
                                <MaterialCommunityIcons name="store" size={48} color={colors.textMuted} style={{ opacity: 0.3, marginBottom: spacing.sm }} />
                                <MerakiText variant="body" color={colors.textMuted}>No bookings today</MerakiText>
                            </Card>
                        )}
                    </View>
                </ScrollView>
            </SafeAreaView>
        </ScreenBackground>
    );
}

const ActionButton = ({ icon, label, onPress, color }: any) => (
    <TouchableOpacity style={styles.actionBtnContainer} onPress={onPress}>
        <Card variant="glass" style={styles.actionCard} noPadding>
            <View style={[styles.iconWrapper, { backgroundColor: `${color}15` }]}>
                <MaterialCommunityIcons name={icon} size={24} color={color} />
            </View>
            <MerakiText variant="label" style={styles.actionLabel}>{label}</MerakiText>
        </Card>
    </TouchableOpacity>
);

const ManagementCard = ({ icon, label, onPress, color, halfWidth }: any) => (
    <TouchableOpacity style={halfWidth ? styles.mgtCardContainerHalf : styles.mgtCardContainer} onPress={onPress}>
        <Card variant="glass" style={styles.mgtCard} noPadding>
            <View style={[styles.iconBox, { backgroundColor: `${color}15` }]}>
                <MaterialCommunityIcons name={icon} size={28} color={color} />
            </View>
            <MerakiText variant="bodyBold" style={styles.mgtLabel}>{label}</MerakiText>
        </Card>
    </TouchableOpacity>
);

const styles = StyleSheet.create({
    container: { flex: 1 },
    loader: { flex: 1, justifyContent: 'center' },
    scrollContent: { paddingHorizontal: spacing.lg, paddingBottom: 100 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, marginBottom: 24 },
    greeting: { fontSize: 13, color: 'rgba(255,255,255,0.4)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 2 },
    userName: { fontSize: 28, fontWeight: '700', color: '#fff', letterSpacing: -0.5 },
    headerIcons: { flexDirection: 'row', gap: 8 },
    iconBtn: {
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
        alignItems: 'center', justifyContent: 'center',
    },
    statsGrid: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xl },
    statCard: { flex: 1, alignItems: 'center', paddingVertical: spacing.md },
    pendingStat: { borderColor: colors.error, borderWidth: 1 },
    section: { marginBottom: spacing.xl },
    sectionLabel: { marginBottom: spacing.md },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
    actionsGrid: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
    // Business Control action buttons
    actionBtnContainer: { width: (width - spacing.lg * 2 - spacing.sm * 2) / 3 },
    actionCard: { alignItems: 'center', paddingVertical: spacing.md },
    iconWrapper: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
    actionLabel: { textAlign: 'center' },
    // Management cards (original owner sections)
    mgtCardContainer: { width: (width - spacing.lg * 2 - spacing.sm * 2) / 3 },
    mgtCardContainerHalf: { width: (width - spacing.lg * 2 - spacing.sm) / 2 },
    mgtCard: { alignItems: 'center', paddingVertical: spacing.lg },
    iconBox: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
    mgtLabel: { fontSize: 13 },
    // Messages banner
    messagesBanner: { borderRadius: layout.borderRadius.md, overflow: 'hidden', marginBottom: spacing.xl },
    bannerGradient: { padding: spacing.md },
    bannerContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    bannerLeft: { flexDirection: 'row', alignItems: 'center' },
    // Appointment cards
    appointmentCard: { marginBottom: spacing.sm },
    aptRow: { flexDirection: 'row', alignItems: 'center', padding: spacing.md },
    timeBlock: { width: 60 },
    infoBlock: { flex: 1 },
    statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
    emptyCard: { alignItems: 'center', paddingVertical: spacing.xxl },
});

export default OwnerDashboardScreen;
