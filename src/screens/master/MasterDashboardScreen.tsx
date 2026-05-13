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
import { Card, ScreenBackground, MerakiText } from '../../components/ui';
import { useModal } from '../../contexts/ModalContext';
import { colors, spacing, layout, gradients } from '../../theme';
import { getDeviceTimezone, COMMON_TIMEZONES, COMMON_COUNTRIES } from '../../utils/timezone';

const { width } = Dimensions.get('window');

type Appointment = {
    id: string;
    start_time: string;
    status: string;
    price: number;
    service_name: string | null;
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

type ActivityFeedItem = {
    id: string;
    title: string;
    description: string;
    icon: string;
    iconColor: string;
    iconBg: string;
    route?: string;
};

const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
};

export function MasterDashboardScreen() {
    const navigation = useNavigation<any>();
    const { profile, user, refreshProfile } = useAuth();
    const { showAlert } = useModal();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [stats, setStats] = useState({
        todayAppointments: 0,
        todayEarnings: 0,
        pendingRequests: 0,
        unreadMessages: 0,
        activeServices: 0,
        totalClients: 0,
    });
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [recentMessages, setRecentMessages] = useState<RecentMessage[]>([]);
    const [activityFeed, setActivityFeed] = useState<ActivityFeedItem[]>([]);

    useFocusEffect(
        useCallback(() => {
            fetchDashboardData();

            // Real-time subscription for message updates
            const channel = supabase
                .channel('dashboard_messages')
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
                const deviceTimezone = getDeviceTimezone();
                const matchedTimezone = COMMON_TIMEZONES.find(tz => tz.value === deviceTimezone);
                if (matchedTimezone && !profile.timezone) newTimezone = matchedTimezone.value;
                let newCity = profile.city;
                let newCountry = profile.country;
                let newCurrency = profile.currency;
                const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
                const addresses = await Location.reverseGeocodeAsync({ latitude: location.coords.latitude, longitude: location.coords.longitude });
                if (addresses?.length > 0) {
                    const address = addresses[0];
                    if (!newCity && (address.city || address.subregion)) newCity = address.city || address.subregion || '';
                    if (!newCountry && address.isoCountryCode) {
                        const matchedCountry = COMMON_COUNTRIES.find(c => c.value === address.isoCountryCode);
                        if (matchedCountry) {
                            newCountry = matchedCountry.value;
                            if (!newCurrency) {
                                const countryMap: Record<string, string> = { GB: 'GBP', US: 'USD', DE: 'EUR', FR: 'EUR', ES: 'EUR', IT: 'EUR', CA: 'CAD', AU: 'AUD' };
                                if (countryMap[newCountry]) newCurrency = countryMap[newCountry];
                            }
                        }
                    }
                }
                if (newTimezone !== profile.timezone || newCity !== profile.city || newCountry !== profile.country || newCurrency !== profile.currency) {
                    await supabase.from('profiles').update({ timezone: newTimezone, city: newCity, country: newCountry, currency: newCurrency }).eq('id', user.id);
                    await refreshProfile();
                }
            } catch (error) { console.log('Auto-detect error:', error); }
        };
        checkLocationSettings();
    }, [profile?.id]);

    const fetchDashboardData = async () => {
        if (!user) return;
        try {
            const todayStart = startOfDay(new Date()).toISOString();
            const todayEnd = endOfDay(new Date()).toISOString();
            const todayPromise = supabase.from('appointments').select(`id, start_time, status, price, service_name, service:services(name), client:profiles!appointments_client_id_fkey(full_name)`).eq('master_id', user.id).gte('start_time', todayStart).lt('start_time', todayEnd).in('status', ['confirmed', 'pending', 'completed']).order('start_time');
            const { data: todayData } = await safeSupabaseFetch(todayPromise as any);
            const allAppointmentsPromise = supabase.from('appointments').select(`id, start_time, status, price, service_name, service:services(name), client:profiles!appointments_client_id_fkey(full_name)`).eq('master_id', user.id).eq('status', 'confirmed').gte('start_time', new Date().toISOString()).order('start_time', { ascending: true }).limit(5);
            const { data: allAppointmentsData } = await safeSupabaseFetch(allAppointmentsPromise as any);
            const pendingPromise = supabase.from('appointments').select('*', { count: 'exact', head: true }).eq('master_id', user.id).eq('status', 'pending');
            const { count: pendingCount } = await safeSupabaseFetch(pendingPromise as any) as any;

            // Active services
            const { count: activeServicesCount } = await supabase.from('services').select('*', { count: 'exact', head: true }).eq('created_by', user.id).eq('is_active', true);

            // Total unique clients
            const { data: clientsData } = await supabase.from('appointments').select('client_id').eq('master_id', user.id).not('client_id', 'is', null);
            const uniqueClients = new Set((clientsData || []).map((a: any) => a.client_id));
            const totalClientsCount = uniqueClients.size;

            // Messages
            const convsPromise = (supabase as any).from('conversations').select('id').eq('master_id', user.id);
            const { data: conversations } = await safeSupabaseFetch(convsPromise);
            let unreadCount = 0;
            let recentMsgs: RecentMessage[] = [];
            if (conversations && (conversations as any[]).length > 0) {
                const convIds = (conversations as any[]).map(c => c.id);
                // Changed `is('read_at', null)` to `eq('is_read', false)` since the db has an is_read property now.
                const msgsPromise = (supabase as any).from('messages').select('*').in('conversation_id', convIds).neq('sender_id', user.id).eq('is_read', false).order('created_at', { ascending: false });
                const { data: messages } = await safeSupabaseFetch(msgsPromise);
                const latestBySender = new Map<string, any>();
                for (const msg of ((messages as any[]) || [])) { if (!latestBySender.has(msg.sender_id)) latestBySender.set(msg.sender_id, msg); }
                unreadCount = latestBySender.size;
                const uniqueMessages = Array.from(latestBySender.values()).slice(0, 3);
                recentMsgs = await Promise.all(uniqueMessages.map(async (msg: any) => {
                    const { data: sender } = await safeSupabaseFetch(supabase.from('profiles').select('full_name').eq('id', msg.sender_id).single() as any);
                    return { id: msg.id, content: msg.content, media_type: msg.media_type, created_at: msg.created_at, sender_name: (sender as any)?.full_name || 'Client', conversation_id: msg.conversation_id };
                }));
            }
            const todayEarnings = ((todayData as any[]) || []).filter(apt => apt.status === 'completed').reduce((sum, apt) => sum + (apt.price || 0), 0);
            setAppointments((allAppointmentsData as unknown as Appointment[]) || []);
            setRecentMessages(recentMsgs);
            setStats({ todayAppointments: ((todayData as any[]) || []).filter(apt => apt.status !== 'completed').length, todayEarnings, pendingRequests: pendingCount || 0, unreadMessages: unreadCount, activeServices: activeServicesCount || 0, totalClients: totalClientsCount });

            // --- Activity Feed: Pending consultations + client reschedules ---
            const feedItems: ActivityFeedItem[] = [];

            // Pending consultations
            const { data: pendingConsults } = await supabase
                .from('booking_consultations')
                .select(`id, status, created_at, service:services(name), client:profiles!booking_consultations_client_id_fkey(full_name)`)
                .eq('master_id', user.id)
                .eq('status', 'pending')
                .order('created_at', { ascending: false })
                .limit(5);

            (pendingConsults || []).forEach((c: any) => {
                feedItems.push({
                    id: `consult-${c.id}`,
                    title: 'New Consultation Request',
                    description: `${c.client?.full_name || 'Client'} wants a consultation for ${c.service?.name || 'a service'}.`,
                    icon: 'assignment',
                    iconColor: '#F59E0B',
                    iconBg: 'rgba(245, 158, 11, 0.12)',
                    route: 'Appointments',
                });
            });

            // Recent client-initiated reschedules (informational for master)
            const { data: rescheduleData } = await supabase
                .from('appointments')
                .select(`id, start_time, proposed_start_time, reschedule_initiated_by, service_name, service:services(name), client:profiles!appointments_client_id_fkey(full_name)`)
                .eq('master_id', user.id)
                .not('proposed_start_time', 'is', null)
                .in('status', ['confirmed', 'pending', 'reschedule_pending']);

            (rescheduleData || []).forEach((apt: any) => {
                feedItems.push({
                    id: `reschedule-${apt.id}`,
                    title: 'Appointment Rescheduled',
                    description: `${apt.client?.full_name || 'Client'} rescheduled ${apt.service?.name || apt.service_name || 'appointment'} to ${format(new Date(apt.proposed_start_time), 'MMM d, HH:mm')}.`,
                    icon: 'swap-horiz',
                    iconColor: '#60A5FA',
                    iconBg: 'rgba(96, 165, 250, 0.12)',
                    route: 'Appointments',
                });
            });

            setActivityFeed(feedItems);
        } catch (error) { console.error('Error fetching dashboard:', error); } finally { setLoading(false); setRefreshing(false); }
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
                            <MerakiText style={styles.userName}>{profile?.full_name?.split(' ')[0] || 'Master'}</MerakiText>
                        </View>
                        <View style={styles.headerIcons}>
                            <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('LoyaltyQR')}>
                                <MaterialIcons name="qr-code-scanner" size={20} color="rgba(0, 0, 0, 0.55)" />
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('Notifications')}>
                                <MaterialIcons name="notifications-none" size={22} color="rgba(0, 0, 0, 0.55)" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Hero Stats */}
                    <View style={styles.heroStats}>
                        <LinearGradient
                            colors={['rgba(212,168,83,0.12)', 'rgba(212,168,83,0.03)']}
                            style={styles.heroCard}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                        >
                            <View style={styles.heroIconRow}>
                                <View style={styles.heroIconCircle}>
                                    <MaterialCommunityIcons name="cash-multiple" size={18} color={colors.accent} />
                                </View>
                            </View>
                            <MerakiText style={styles.heroValue}>€{stats.todayEarnings}</MerakiText>
                            <MerakiText style={styles.heroLabel}>Revenue Today</MerakiText>
                        </LinearGradient>
                        <View style={styles.heroSecondaryCol}>
                            <LinearGradient
                                colors={['rgba(63,185,80,0.10)', 'rgba(63,185,80,0.02)']}
                                style={styles.heroSmallCard}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                            >
                                <MerakiText style={styles.heroSmallValue}>{stats.activeServices}</MerakiText>
                                <MerakiText style={styles.heroSmallLabel}>{stats.activeServices === 1 ? 'Service' : 'Services'}</MerakiText>
                            </LinearGradient>
                            <LinearGradient
                                colors={['rgba(88,166,255,0.10)', 'rgba(88,166,255,0.02)']}
                                style={styles.heroSmallCard}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                            >
                                <MerakiText style={styles.heroSmallValue}>{stats.totalClients}</MerakiText>
                                <MerakiText style={styles.heroSmallLabel}>{stats.totalClients === 1 ? 'Client' : 'Clients'}</MerakiText>
                            </LinearGradient>
                        </View>
                    </View>

                    {/* Messages Banner */}
                    {stats.unreadMessages > 0 && (
                        <TouchableOpacity style={styles.messagesBanner} onPress={() => navigation.navigate('Messages')}>
                            <LinearGradient colors={['rgba(40,40,45,0.95)', 'rgba(25,25,30,0.95)']} style={styles.bannerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                                <View style={styles.bannerContent}>
                                    <View style={styles.bannerLeft}>
                                        <View style={[styles.heroIconCircle, { backgroundColor: 'rgba(244, 114, 182, 0.15)', marginRight: 12 }]}>
                                            <MaterialCommunityIcons name="message-alert" size={18} color="#F472B6" />
                                        </View>
                                        <MerakiText variant="bodyBold" color="#FFF">
                                            {stats.unreadMessages} Unread Message{stats.unreadMessages !== 1 ? 's' : ''}
                                        </MerakiText>
                                    </View>
                                    <View style={styles.bannerRight}>
                                        <MerakiText variant="caption" color="rgba(0, 0, 0, 0.40)" style={{ marginRight: 8 }}>VIEW</MerakiText>
                                        <MaterialCommunityIcons name="chevron-right" size={20} color="rgba(0, 0, 0, 0.40)" />
                                    </View>
                                </View>
                            </LinearGradient>
                        </TouchableOpacity>
                    )}

                    {/* Activity Feed */}
                    {activityFeed.length > 0 && (
                        <View style={styles.section}>
                            <View style={styles.sectionHeader}>
                                <MerakiText variant="label" color={colors.textMuted}>ACTIVITY</MerakiText>
                                <TouchableOpacity onPress={() => navigation.navigate('Appointments')}>
                                    <MerakiText variant="caption" color={colors.accent}>VIEW ALL</MerakiText>
                                </TouchableOpacity>
                            </View>
                            {activityFeed.slice(0, 4).map((item) => (
                                <TouchableOpacity
                                    key={item.id}
                                    style={styles.feedCard}
                                    onPress={() => item.route && navigation.navigate(item.route)}
                                    activeOpacity={0.7}
                                >
                                    <View style={[styles.feedIconWrap, { backgroundColor: item.iconBg }]}>
                                        <MaterialIcons name={item.icon as any} size={20} color={item.iconColor} />
                                    </View>
                                    <View style={{ flex: 1, marginLeft: 12 }}>
                                        <MerakiText variant="bodyBold" style={{ fontSize: 13 }}>{item.title}</MerakiText>
                                        <MerakiText variant="caption" color="rgba(0, 0, 0, 0.35)" numberOfLines={2}>{item.description}</MerakiText>
                                    </View>
                                    <MaterialCommunityIcons name="chevron-right" size={18} color="rgba(0, 0, 0, 0.12)" />
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}

                    {/* Upcoming Schedule */}
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <MerakiText variant="label" color={colors.textMuted}>UPCOMING APPOINTMENTS</MerakiText>
                            <TouchableOpacity onPress={() => navigation.navigate('Appointments')}>
                                <MerakiText variant="caption" color={colors.accent}>VIEW ALL</MerakiText>
                            </TouchableOpacity>
                        </View>
                        {appointments.length > 0 ? (
                            appointments.map((apt) => (
                                <Card key={apt.id} variant="glass" style={styles.appointmentCard} noPadding>
                                    <TouchableOpacity style={styles.appointmentRow}>
                                        <View style={styles.timeBlock}>
                                            <MerakiText variant="bodyBold" color={colors.accent}>{format(new Date(apt.start_time), 'HH:mm')}</MerakiText>
                                            <MerakiText variant="caption" color={colors.textMuted}>{format(new Date(apt.start_time), 'MMM d')}</MerakiText>
                                        </View>
                                        <View style={styles.divider} />
                                        <View style={styles.aptInfo}>
                                            <MerakiText variant="bodyBold">{apt.service?.name || apt.service_name || 'Service'}</MerakiText>
                                            <MerakiText variant="caption" color={colors.textSecondary}>{apt.client?.full_name || 'Client'}</MerakiText>
                                        </View>
                                        <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />
                                    </TouchableOpacity>
                                </Card>
                            ))
                        ) : (
                            <Card variant="glass" style={styles.emptyCard}>
                                <MaterialCommunityIcons name="calendar-blank-outline" size={40} color={colors.textMuted} style={{ opacity: 0.3, marginBottom: spacing.sm }} />
                                <MerakiText variant="body" color={colors.textMuted}>No upcoming bookings</MerakiText>
                            </Card>
                        )}
                    </View>

                    {/* Quick Actions */}
                    <View style={styles.section}>
                        <MerakiText variant="label" color={colors.textMuted} style={styles.sectionLabel}>BUSINESS CONTROL</MerakiText>
                        <View style={styles.buttonGrid}>
                            <DashboardButton icon="card-account-details-star" label="Portfolio" onPress={() => navigation.navigate('Portfolio')} color="#34D399" />
                            <DashboardButton icon="room-service" label="Services" onPress={() => navigation.navigate('MyServices')} color="#60A5FA" />
                            <DashboardButton icon="clock-check" label="Availability" onPress={() => navigation.navigate('Availability')} color="#F472B6" />
                            <DashboardButton icon="ticket-confirmation" label="Loyalty" onPress={() => navigation.navigate('LoyaltyCardBuilder')} color="#FBBF24" />
                            <DashboardButton icon="cog" label="Settings" onPress={() => navigation.navigate('BusinessSettings')} color="#94A3B8" />
                        </View>
                    </View>
                </ScrollView>
            </SafeAreaView>
        </ScreenBackground>
    );
}

const GRID_COLUMNS = 3;
const GRID_GAP = 10;
const GRID_PADDING = spacing.lg * 2;
const BUTTON_WIDTH = (width - GRID_PADDING - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS;

const DashboardButton = ({ icon, label, onPress, color }: any) => (
    <TouchableOpacity style={styles.dashBtnWrap} onPress={onPress} activeOpacity={0.7}>
        <View style={styles.dashBtn}>
            <View style={[styles.dashBtnIcon, { backgroundColor: `${color}12` }]}>
                <MaterialCommunityIcons name={icon} size={24} color={color} />
            </View>
            <MerakiText variant="body" numberOfLines={1} style={styles.dashBtnLabel}>{label}</MerakiText>
        </View>
    </TouchableOpacity>
);

const styles = StyleSheet.create({
    container: { flex: 1 },
    loader: { flex: 1, justifyContent: 'center' },
    scrollContent: { paddingHorizontal: spacing.lg, paddingBottom: 100 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, marginBottom: 24 },
    greeting: { fontSize: 13, color: 'rgba(0, 0, 0, 0.35)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 2 },
    userName: { fontSize: 28, fontWeight: '700', color: '#1A1A1A', letterSpacing: -0.5 },
    headerIcons: { flexDirection: 'row', gap: 8 },
    iconBtn: {
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: 'rgba(0, 0, 0, 0.03)',
        borderWidth: 1, borderColor: 'rgba(0, 0, 0, 0.06)',
        alignItems: 'center', justifyContent: 'center',
    },
    heroStats: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xl },
    heroCard: {
        flex: 1.2,
        borderRadius: layout.borderRadius.xl,
        padding: spacing.lg,
        borderWidth: 1,
        borderColor: 'rgba(212,168,83,0.15)',
        justifyContent: 'flex-end',
    } as any,
    heroIconRow: { marginBottom: 12 },
    heroIconCircle: {
        width: 32, height: 32, borderRadius: 10,
        backgroundColor: 'rgba(212,168,83,0.12)',
        alignItems: 'center', justifyContent: 'center',
    },
    heroValue: { fontSize: 32, fontWeight: '800' as any, color: '#1A1A1A', letterSpacing: -1, marginBottom: 2 },
    heroLabel: { fontSize: 12, color: 'rgba(0, 0, 0, 0.35)', textTransform: 'uppercase' as any, letterSpacing: 0.8 },
    heroSecondaryCol: { flex: 0.8, gap: spacing.sm },
    heroSmallCard: {
        flex: 1,
        borderRadius: layout.borderRadius.lg,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.05)',
        justifyContent: 'center',
        alignItems: 'center',
    } as any,
    heroSmallValue: { fontSize: 24, fontWeight: '700' as any, color: '#1A1A1A', letterSpacing: -0.5 },
    heroSmallLabel: { fontSize: 11, color: 'rgba(0, 0, 0, 0.25)', textTransform: 'uppercase' as any, letterSpacing: 0.5, marginTop: 2 },
    section: { marginBottom: spacing.xl },
    sectionLabel: { marginBottom: spacing.md, fontSize: 11, letterSpacing: 1 },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
    // Dashboard buttons — vertical cards
    buttonGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -(GRID_GAP / 2) },
    dashBtnWrap: { width: BUTTON_WIDTH, marginHorizontal: GRID_GAP / 2, marginBottom: GRID_GAP },
    dashBtn: {
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.03)',
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.06)',
        borderRadius: 16,
        paddingVertical: 16,
        paddingHorizontal: 8,
        gap: 12,
    },
    dashBtnIcon: {
        width: 48,
        height: 48,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    dashBtnLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#1A1A1A',
        textAlign: 'center',
    },
    messagesBanner: { borderRadius: layout.borderRadius.lg, overflow: 'hidden', marginBottom: spacing.xl, borderWidth: 1, borderColor: 'rgba(0, 0, 0, 0.04)' },
    bannerGradient: { padding: spacing.lg },
    bannerContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    bannerLeft: { flexDirection: 'row', alignItems: 'center' },
    bannerRight: { flexDirection: 'row', alignItems: 'center' },
    appointmentCard: { marginBottom: spacing.sm, borderRadius: layout.borderRadius.lg },
    appointmentRow: { flexDirection: 'row', alignItems: 'center', padding: spacing.md },
    timeBlock: { width: 60, alignItems: 'center' },
    divider: { width: 1, height: '80%', backgroundColor: 'rgba(0, 0, 0, 0.08)', marginHorizontal: spacing.md },
    aptInfo: { flex: 1 },
    emptyCard: { alignItems: 'center', padding: spacing.xl, borderRadius: layout.borderRadius.lg },
    emptyEmoji: { fontSize: 40, marginBottom: spacing.sm, opacity: 0.3 },
    // Activity Feed
    feedCard: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.03)', borderRadius: 14,
        borderWidth: 1, borderColor: 'rgba(0, 0, 0, 0.06)',
        padding: 14, marginBottom: 8, gap: 0,
    },
    feedIconWrap: {
        width: 40, height: 40, borderRadius: 12,
        alignItems: 'center', justifyContent: 'center',
    },
});

export default MasterDashboardScreen;
