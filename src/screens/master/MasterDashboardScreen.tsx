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
    });
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [recentMessages, setRecentMessages] = useState<RecentMessage[]>([]);

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
            const todayPromise = supabase.from('appointments').select(`id, start_time, status, price, service:services(name), client:profiles!appointments_client_id_fkey(full_name)`).eq('master_id', user.id).gte('start_time', todayStart).lt('start_time', todayEnd).in('status', ['confirmed', 'pending', 'completed']).order('start_time');
            const { data: todayData } = await safeSupabaseFetch(todayPromise as any);
            const allAppointmentsPromise = supabase.from('appointments').select(`id, start_time, status, price, service:services(name), client:profiles!appointments_client_id_fkey(full_name)`).eq('master_id', user.id).eq('status', 'confirmed').gte('start_time', new Date().toISOString()).order('start_time', { ascending: true }).limit(5);
            const { data: allAppointmentsData } = await safeSupabaseFetch(allAppointmentsPromise as any);
            const pendingPromise = supabase.from('appointments').select('*', { count: 'exact', head: true }).eq('master_id', user.id).eq('status', 'pending');
            const { count: pendingCount } = await safeSupabaseFetch(pendingPromise as any) as any;

            // Messages
            const convsPromise = (supabase as any).from('conversations').select('id').eq('master_id', user.id);
            const { data: conversations } = await safeSupabaseFetch(convsPromise);
            let unreadCount = 0;
            let recentMsgs: RecentMessage[] = [];
            if (conversations && (conversations as any[]).length > 0) {
                const convIds = (conversations as any[]).map(c => c.id);
                const msgsPromise = (supabase as any).from('messages').select('*').in('conversation_id', convIds).neq('sender_id', user.id).is('read_at', null).order('created_at', { ascending: false });
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
            setStats({ todayAppointments: ((todayData as any[]) || []).filter(apt => apt.status !== 'completed').length, todayEarnings, pendingRequests: pendingCount || 0, unreadMessages: unreadCount });
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
                                <MaterialIcons name="qr-code-scanner" size={20} color="rgba(255,255,255,0.7)" />
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('Notifications')}>
                                <MaterialIcons name="notifications-none" size={22} color="rgba(255,255,255,0.7)" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Quick Stats Grid */}
                    <View style={styles.statsGrid}>
                        <Card variant="glass" style={styles.statCard}>
                            <MerakiText variant="h2" color={colors.accent}>{stats.todayAppointments}</MerakiText>
                            <MerakiText variant="caption" color={colors.textMuted}>Today</MerakiText>
                        </Card>
                        <Card variant="glass" style={styles.statCard}>
                            <MerakiText variant="h2" color={colors.success}>€{stats.todayEarnings}</MerakiText>
                            <MerakiText variant="caption" color={colors.textMuted}>Earned</MerakiText>
                        </Card>
                        <Card variant="glass" style={[styles.statCard, stats.pendingRequests > 0 && styles.activeStat]}>
                            <MerakiText variant="h2" color={stats.pendingRequests > 0 ? colors.error : colors.text}>{stats.pendingRequests}</MerakiText>
                            <MerakiText variant="caption" color={colors.textMuted}>Pending</MerakiText>
                        </Card>
                    </View>

                    {/* Quick Actions */}
                    <View style={styles.section}>
                        <MerakiText variant="label" color={colors.textMuted} style={styles.sectionLabel}>BUSINESS CONTROL</MerakiText>
                        <View style={styles.actionsGrid}>
                            <ActionButton icon="calendar-month" label="Schedule" onPress={() => navigation.navigate('Schedule')} color="#A78BFA" />
                            <ActionButton icon="card-account-details-star" label="Portfolio" onPress={() => navigation.navigate('Portfolio')} color="#34D399" />
                            <ActionButton icon="room-service" label="Services" onPress={() => navigation.navigate('MyServices')} color="#60A5FA" />
                            <ActionButton icon="clock-check" label="Availability" onPress={() => navigation.navigate('Availability')} color="#F472B6" />
                            <ActionButton icon="ticket-confirmation" label="Loyalty" onPress={() => navigation.navigate('LoyaltyCardBuilder')} color="#FBBF24" />
                            <ActionButton icon="cog" label="Settings" onPress={() => navigation.navigate('BusinessSettings')} color="#94A3B8" />
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
                                            <MerakiText variant="bodyBold">{apt.service?.name || 'Service'}</MerakiText>
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
    activeStat: { borderColor: colors.error, borderWidth: 1 },
    section: { marginBottom: spacing.xl },
    sectionLabel: { marginBottom: spacing.md },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
    actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    actionBtnContainer: { width: (width - spacing.lg * 2 - spacing.sm * 2) / 3 },
    actionCard: { alignItems: 'center', paddingVertical: spacing.md },
    iconWrapper: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
    actionLabel: { textAlign: 'center' },
    messagesBanner: { borderRadius: layout.borderRadius.md, overflow: 'hidden', marginBottom: spacing.xl },
    bannerGradient: { padding: spacing.md },
    bannerContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    bannerLeft: { flexDirection: 'row', alignItems: 'center' },
    appointmentCard: { marginBottom: spacing.sm },
    appointmentRow: { flexDirection: 'row', alignItems: 'center', padding: spacing.md },
    timeBlock: { width: 60, alignItems: 'center' },
    divider: { width: 1, height: '80%', backgroundColor: 'rgba(255,255,255,0.1)', marginHorizontal: spacing.md },
    aptInfo: { flex: 1 },
    emptyCard: { alignItems: 'center', padding: spacing.xl },
    emptyEmoji: { fontSize: 40, marginBottom: spacing.sm, opacity: 0.3 },
});

export default MasterDashboardScreen;
