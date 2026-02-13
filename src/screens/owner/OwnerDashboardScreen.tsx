import React, { useState, useCallback } from 'react';
import {
    View,
    StyleSheet,
    ScrollView,
    RefreshControl,
    ActivityIndicator,
    TouchableOpacity,
    Dimensions,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { format, startOfDay, endOfDay } from 'date-fns';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../lib/supabase';
import { safeSupabaseFetch } from '../../lib/supabaseApi';
import { useAuth } from '../../contexts/AuthContext';
import { Card, ScreenBackground, MerakiText } from '../../components/ui';
import { colors, spacing, layout, gradients } from '../../theme';

const { width } = Dimensions.get('window');

type Appointment = {
    id: string;
    start_time: string;
    status: string;
    price: number;
    service: { name: string } | null;
    client: { full_name: string } | null;
};

type Stats = {
    totalServices: number;
    activeServices: number;
    todayAppointments: number;
    pendingAppointments: number;
    todayEarnings: number;
};

export function OwnerDashboardScreen() {
    const navigation = useNavigation<any>();
    const { profile, user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [stats, setStats] = useState<Stats>({
        totalServices: 0,
        activeServices: 0,
        todayAppointments: 0,
        pendingAppointments: 0,
        todayEarnings: 0,
    });
    const [appointments, setAppointments] = useState<Appointment[]>([]);

    useFocusEffect(
        useCallback(() => {
            fetchDashboardData();
        }, [user?.id])
    );

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
            const todayEarnings = ((todayData as any[]) || []).filter(apt => apt.status === 'completed').reduce((sum, apt) => sum + (apt.price || 0), 0);

            setAppointments((allAppointmentsData as unknown as Appointment[]) || []);
            setStats({
                totalServices: servicesCount || 0,
                activeServices: activeServicesCount || 0,
                todayAppointments: ((todayData as any[]) || []).filter(apt => apt.status !== 'completed').length,
                pendingAppointments: pendingCount || 0,
                todayEarnings,
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
                            <MerakiText variant="label" color={colors.textSecondary}>BUSINESS HUB</MerakiText>
                            <MerakiText variant="h1">{profile?.full_name?.split(' ')[0] || 'Owner'}</MerakiText>
                        </View>
                        <TouchableOpacity style={styles.analyticsButton} onPress={() => navigation.navigate('PlatformAnalytics')}>
                            <LinearGradient colors={gradients.premium as any} style={styles.analyticsGradient}>
                                <MaterialCommunityIcons name="finance" size={24} color="#FFF" />
                            </LinearGradient>
                        </TouchableOpacity>
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
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: spacing.xl },
    analyticsButton: { borderRadius: 16, overflow: 'hidden' },
    analyticsGradient: { padding: 12 },
    statsGrid: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xl },
    statCard: { flex: 1, alignItems: 'center', paddingVertical: spacing.md },
    pendingStat: { borderColor: colors.error, borderWidth: 1 },
    section: { marginBottom: spacing.xl },
    sectionLabel: { marginBottom: spacing.md },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
    actionsGrid: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
    mgtCardContainer: { width: (width - spacing.lg * 2 - spacing.sm * 2) / 3 },
    mgtCardContainerHalf: { width: (width - spacing.lg * 2 - spacing.sm) / 2 },
    mgtCard: { alignItems: 'center', paddingVertical: spacing.lg },
    iconBox: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
    mgtLabel: { fontSize: 13 },
    appointmentCard: { marginBottom: spacing.sm },
    aptRow: { flexDirection: 'row', alignItems: 'center', padding: spacing.md },
    timeBlock: { width: 60 },
    infoBlock: { flex: 1 },
    statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
    emptyCard: { alignItems: 'center', paddingVertical: spacing.xxl },
});

export default OwnerDashboardScreen;
