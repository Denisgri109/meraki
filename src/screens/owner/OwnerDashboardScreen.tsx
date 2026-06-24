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
import { getDeviceTimezone, formatCurrency } from '../../utils/timezone';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

type Stats = {
    totalServices: number;
    activeServices: number;
    todayAppointments: number;
    pendingAppointments: number;
    todayEarnings: number;
    unreadMessages: number;
    totalClients: number;
    pendingConsultations: number;
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
        totalClients: 0,
        pendingConsultations: 0,
    });
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [recentMessages, setRecentMessages] = useState<RecentMessage[]>([]);
    const [activityFeed, setActivityFeed] = useState<ActivityFeedItem[]>([]);

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

            // Create promises for parallel execution
            const servicesCountPromise = supabase.from('services').select('*', { count: 'exact', head: true });
            const activeServicesCountPromise = supabase.from('services').select('*', { count: 'exact', head: true }).eq('is_active', true);
            const todayPromise = supabase.from('appointments').select(`id, start_time, status, price, service_name, service:services(name), client:profiles!appointments_client_id_fkey(full_name)`).gte('start_time', todayStart).lt('start_time', todayEnd).in('status', ['confirmed', 'pending', 'completed']).order('start_time');
            const allAppointmentsPromise = supabase.from('appointments').select(`id, start_time, status, price, service_name, service:services(name), client:profiles!appointments_client_id_fkey(full_name)`).eq('status', 'confirmed').gte('start_time', new Date().toISOString()).order('start_time', { ascending: true }).limit(5);
            const pendingCountPromise = supabase.from('appointments').select('*', { count: 'exact', head: true }).eq('status', 'pending');
            const todayPaymentsPromise = supabase.from('payments').select('amount').gte('created_at', todayStart).lt('created_at', todayEnd).eq('status', 'succeeded');
            const conversationsPromise = safeSupabaseFetch(supabase.from('conversations').select('id').or(`participant1_id.eq.${user.id},participant2_id.eq.${user.id}`) as any);
            const lastViewedPromise = AsyncStorage.getItem('last_consultations_view');

            // Execute all independent queries concurrently
            const [
                { count: servicesCount },
                { count: activeServicesCount },
                { data: todayData },
                { data: allAppointmentsData },
                { count: pendingCount },
                { data: conversations },
                lastViewed,
                { data: todayPaymentsData }
            ] = await Promise.all([
                servicesCountPromise,
                activeServicesCountPromise,
                safeSupabaseFetch(todayPromise as any),
                safeSupabaseFetch(allAppointmentsPromise as any),
                pendingCountPromise,
                conversationsPromise,
                lastViewedPromise,
                safeSupabaseFetch(todayPaymentsPromise as any)
            ]);

            // Today's unique clients
            const todayClients = new Set(
                ((todayData as any[]) || []).filter(apt => apt.client?.full_name).map((apt: any) => apt.client?.full_name)
            );
            const totalClientsCount = todayClients.size;

            // Unread messages count
            let unreadCount = 0;
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

                if (uniqueMessages.length > 0) {
                    const senderIds = [...new Set(uniqueMessages.map((msg: any) => msg.sender_id))];
                    const { data: senders } = await safeSupabaseFetch(
                        supabase.from('profiles').select('id, full_name').in('id', senderIds) as any
                    );

                    const senderMap = new Map();
                    ((senders as any[]) || []).forEach(s => senderMap.set(s.id, s.full_name));

                    recentMsgs = uniqueMessages.map((msg: any) => ({
                        id: msg.id,
                        content: msg.content,
                        media_type: msg.media_type,
                        created_at: msg.created_at,
                        sender_name: senderMap.get(msg.sender_id) || 'Client',
                        conversation_id: msg.conversation_id
                    }));
                }
            }

            const todayEarnings = ((todayPaymentsData as any[]) || []).reduce((sum, p) => sum + ((p.amount || 0) / 100), 0);

            // Fetch pending consultations count
            let consultationsQuery = supabase
                .from('booking_consultations')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'pending');

            if (lastViewed) {
                consultationsQuery = consultationsQuery.gt('created_at', lastViewed);
            }

            const { count: pendingConsultationsCount } = await consultationsQuery;

            setAppointments((allAppointmentsData as unknown as Appointment[]) || []);
            setRecentMessages(recentMsgs);
            setStats({
                totalServices: servicesCount || 0,
                activeServices: activeServicesCount || 0,
                todayAppointments: ((todayData as any[]) || []).filter(apt => apt.status !== 'completed').length,
                pendingAppointments: pendingCount || 0,
                todayEarnings,
                unreadMessages: unreadCount,
                totalClients: totalClientsCount,
                pendingConsultations: pendingConsultationsCount || 0,
            });
        } catch (error) {
            console.error('Error fetching owner data:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }

        // --- Activity Feed (runs after main data, non-blocking) ---
        try {
            const feedItems: ActivityFeedItem[] = [];

            // Execute feed queries concurrently
            const pendingConsultsPromise = supabase
                .from('booking_consultations')
                .select(`id, created_at, service:services(name), client:profiles!booking_consultations_client_id_fkey(full_name)`)
                .eq('master_id', user.id)
                .eq('status', 'pending')
                .order('created_at', { ascending: false })
                .limit(5);

            const reschedulesPromise = supabase
                .from('appointments')
                .select(`id, proposed_start_time, service_name, service:services(name), client:profiles!appointments_client_id_fkey(full_name)`)
                .eq('master_id', user.id)
                .not('proposed_start_time', 'is', null)
                .in('status', ['confirmed', 'pending', 'reschedule_pending']);

            const [
                { data: pendingConsultsData },
                { data: rescheduleData }
            ] = await Promise.all([
                pendingConsultsPromise,
                reschedulesPromise
            ]);

            (pendingConsultsData || []).forEach((c: any) => {
                feedItems.push({
                    id: `consult-${c.id}`,
                    title: 'New Consultation Request',
                    description: `${c.client?.full_name || 'Client'} wants a consultation for ${c.service?.name || 'a service'}.`,
                    icon: 'assignment',
                    iconColor: '#F59E0B',
                    iconBg: 'rgba(245, 158, 11, 0.12)',
                    route: 'BookingConsultations',
                });
            });

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
        } catch (e) { console.error('Activity feed error:', e); }
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
                                <MaterialIcons name="qr-code-scanner" size={20} color="rgba(0, 0, 0, 0.55)" />
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('PlatformAnalytics')}>
                                <MaterialCommunityIcons name="finance" size={20} color="rgba(0, 0, 0, 0.55)" />
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
                            <MerakiText style={styles.heroValue}>{formatCurrency(stats.todayEarnings, profile?.currency || undefined)}</MerakiText>
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
                                <MerakiText style={styles.heroSmallLabel}>{stats.totalClients === 1 ? 'Client Today' : 'Clients Today'}</MerakiText>
                            </LinearGradient>
                        </View>
                    </View>

                    {/* Messages Banner */}
                    {stats.unreadMessages > 0 && (
                        <TouchableOpacity style={styles.messagesBanner} onPress={() => navigation.navigate('Messages')}>
                            <LinearGradient colors={['rgba(244, 114, 182, 0.12)', 'rgba(244, 114, 182, 0.03)']} style={styles.bannerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                                <View style={styles.bannerContent}>
                                    <View style={styles.bannerLeft}>
                                        <View style={[styles.heroIconCircle, { backgroundColor: 'rgba(244, 114, 182, 0.15)', marginRight: 12 }]}>
                                            <MaterialCommunityIcons name="message-alert" size={18} color="#F472B6" />
                                        </View>
                                        <MerakiText variant="bodyBold" color="#1A1A1A">
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
                                    <TouchableOpacity style={styles.aptRow} onPress={() => navigation.navigate('Appointments')}>
                                        <View style={styles.timeBlock}>
                                            <MerakiText variant="bodyBold" color={colors.accent}>{format(new Date(apt.start_time), 'HH:mm')}</MerakiText>
                                        </View>
                                        <View style={styles.infoBlock}>
                                            <MerakiText variant="bodyBold" numberOfLines={1}>{apt.service?.name || apt.service_name || 'Service'}</MerakiText>
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

                    {/* Business Control */}
                    <View style={styles.section}>
                        <MerakiText variant="label" color={colors.textMuted} style={styles.sectionLabel}>BUSINESS CONTROL</MerakiText>
                        <View style={styles.buttonGrid}>
                            <DashboardButton icon="account-group" label="Masters" onPress={() => navigation.navigate('MasterManagement')} color="#EE2B5B" />
                            <DashboardButton icon="chat-question" label="Consultations" onPress={() => navigation.navigate('BookingConsultations')} color="#8B5CF6" badgeCount={stats.pendingConsultations} />
                            <DashboardButton icon="card-account-details-star" label="Portfolio" onPress={() => navigation.navigate('Portfolio')} color="#34D399" />
                            <DashboardButton icon="yoga" label="Pilates" onPress={() => navigation.navigate('PilatesHub')} color="#38BDF8" />
                            <DashboardButton icon="room-service" label="Services" onPress={() => navigation.navigate('MyServices')} color="#60A5FA" />
                            <DashboardButton icon="clock-check" label="Availability" onPress={() => navigation.navigate('Availability')} color="#F472B6" />
                            <DashboardButton icon="ticket-confirmation" label="Loyalty" onPress={() => navigation.navigate('LoyaltyCardBuilder')} color="#FBBF24" />
                            <DashboardButton icon="cog" label="Settings" onPress={() => navigation.navigate('Settings')} color="#94A3B8" />
                        </View>
                    </View>

                    {/* Management Sections */}
                    <View style={styles.section}>
                        <MerakiText variant="label" color={colors.textMuted} style={styles.sectionLabel}>INVENTORY & LOGISTICS</MerakiText>
                        <View style={styles.buttonGrid}>
                            <DashboardButton icon="shopping" label="Orders" onPress={() => navigation.navigate('CustomerOrders')} color="#EC4899" />
                            <DashboardButton icon="package-variant-closed" label="Inventory" onPress={() => navigation.navigate('Inventory')} color="#F19A3E" />
                            <DashboardButton icon="truck-delivery" label="Supplies" onPress={() => navigation.navigate('OwnerSupplies')} color="#4ADE80" />
                        </View>
                    </View>

                    <View style={styles.section}>
                        <MerakiText variant="label" color={colors.textMuted} style={styles.sectionLabel}>MARKETING & LOYALTY</MerakiText>
                        <View style={styles.buttonGrid}>
                            <DashboardButton icon="card-bulleted" label="Loyalty" onPress={() => navigation.navigate('LoyaltyCardBuilder')} color="#FBBF24" />
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

const DashboardButton = ({ icon, label, onPress, color, badgeCount }: any) => (
    <TouchableOpacity style={styles.dashBtnWrap} onPress={onPress} activeOpacity={0.7}>
        <View style={styles.dashBtn}>
            <View style={[styles.dashBtnIcon, { backgroundColor: `${color}12` }]}>
                <MaterialCommunityIcons name={icon} size={24} color={color} />
                {badgeCount > 0 && (
                    <View style={styles.badgeContainer}>
                        <MerakiText style={styles.badgeText}>{badgeCount > 99 ? '99+' : badgeCount}</MerakiText>
                    </View>
                )}
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
    },
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
    },
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
    badgeContainer: { position: 'absolute', top: -4, right: -4, backgroundColor: '#FF453A', borderRadius: 10, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3, borderWidth: 1.5, borderColor: 'rgba(20,20,25,0.9)' },
    badgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700', textAlign: 'center', includeFontPadding: false, textAlignVertical: 'center', lineHeight: 12 },
    // Messages banner
    messagesBanner: { borderRadius: layout.borderRadius.lg, overflow: 'hidden', marginBottom: spacing.xl, borderWidth: 1, borderColor: 'rgba(244, 114, 182, 0.15)' },
    bannerGradient: { padding: spacing.lg },
    bannerContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    bannerLeft: { flexDirection: 'row', alignItems: 'center' },
    bannerRight: { flexDirection: 'row', alignItems: 'center' },
    // Appointment cards
    appointmentCard: { marginBottom: spacing.sm },
    aptRow: { flexDirection: 'row', alignItems: 'center', padding: spacing.md },
    timeBlock: { width: 60 },
    infoBlock: { flex: 1 },
    statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
    emptyCard: { alignItems: 'center', paddingVertical: spacing.xxl },
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

export default OwnerDashboardScreen;
