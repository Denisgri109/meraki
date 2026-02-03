import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    RefreshControl,
    ActivityIndicator,
    TouchableOpacity,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { format, startOfDay, endOfDay } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { safeSupabaseFetch } from '../../lib/supabaseApi';
import { useAuth } from '../../contexts/AuthContext';
import { Card, ScreenBackground } from '../../components/ui';
import { colors, spacing } from '../../theme';

type Appointment = {
    id: string;
    start_time: string;
    status: string;
    price: number;
    service: { name: string } | null;
    client: { full_name: string } | null;
};

type Stats = {
    totalMasters: number;
    activeMasters: number;
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
        totalMasters: 0,
        activeMasters: 0,
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
            const today = new Date();
            const todayStart = startOfDay(today).toISOString();
            const todayEnd = endOfDay(today).toISOString();

            // Fetch masters count
            const { count: mastersCount } = await supabase
                .from('profiles')
                .select('*', { count: 'exact', head: true })
                .eq('role', 'master');

            const { count: activeMastersCount } = await supabase
                .from('profiles')
                .select('*', { count: 'exact', head: true })
                .eq('role', 'master')
                .eq('master_status', 'active');

            // Fetch services count
            const { count: servicesCount } = await supabase
                .from('services')
                .select('*', { count: 'exact', head: true });

            const { count: activeServicesCount } = await supabase
                .from('services')
                .select('*', { count: 'exact', head: true })
                .eq('is_active', true);

            // Fetch today's appointments (for stats)
            const todayPromise = supabase
                .from('appointments')
                .select(`
                    id, start_time, status, price,
                    service:services(name),
                    client:profiles!appointments_client_id_fkey(full_name)
                `)
                .gte('start_time', todayStart)
                .lt('start_time', todayEnd)
                .in('status', ['confirmed', 'pending', 'completed'])
                .order('start_time');

            const { data: todayData } = await safeSupabaseFetch(todayPromise as any, { timeout: 8000 });

            // Fetch ALL appointments for schedule (newest first)
            const allAppointmentsPromise = supabase
                .from('appointments')
                .select(`
                    id, start_time, status, price,
                    service:services(name),
                    client:profiles!appointments_client_id_fkey(full_name)
                `)
                .eq('master_id', user.id)
                .eq('status', 'confirmed')
                .gte('start_time', new Date().toISOString())
                .order('start_time', { ascending: true })
                .limit(20);

            const { data: allAppointmentsData } = await safeSupabaseFetch(allAppointmentsPromise as any, { timeout: 8000 });

            const { count: pendingCount } = await supabase
                .from('appointments')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'pending');

            // Calculate today's earnings from completed appointments
            const todayEarnings = ((todayData as any[]) || [])
                .filter((apt: any) => apt.status === 'completed')
                .reduce((sum: number, apt: any) => sum + (apt.price || 0), 0);

            setAppointments((allAppointmentsData as unknown as Appointment[]) || []);
            setStats({
                totalMasters: mastersCount || 0,
                activeMasters: activeMastersCount || 0,
                totalServices: servicesCount || 0,
                activeServices: activeServicesCount || 0,
                todayAppointments: ((todayData as any[]) || []).filter((apt: any) => apt.status !== 'completed').length,
                pendingAppointments: pendingCount || 0,
                todayEarnings,
            });
        } catch (error) {
            console.error('Error fetching dashboard data:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchDashboardData();
    };

    if (loading) {
        return (
            <ScreenBackground>
                <SafeAreaView style={styles.container}>
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={colors.text} />
                    </View>
                </SafeAreaView>
            </ScreenBackground>
        );
    }

    return (
        <ScreenBackground>
            <SafeAreaView style={styles.container} edges={['top']}>
                <ScrollView
                    contentContainerStyle={styles.content}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} />
                    }
                >
                    {/* Header */}
                    <View style={styles.header}>
                        <View>
                            <Text style={styles.greeting}>Owner Dashboard</Text>
                            <Text style={styles.name}>{profile?.full_name || 'Owner'}</Text>
                        </View>
                        <TouchableOpacity
                            style={styles.qrGeneratorBtn}
                            onPress={() => navigation.navigate('LoyaltyQR')}
                        >
                            <MaterialCommunityIcons name="qrcode" size={22} color={colors.text} />
                        </TouchableOpacity>
                    </View>

                    {/* Personal Tools */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>My Tools</Text>
                        <View style={styles.quickActionsGrid}>
                            <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('Portfolio')}>
                                <View style={[styles.actionIcon, { backgroundColor: 'rgba(139, 92, 246, 0.2)' }]}>
                                    <MaterialCommunityIcons name="image-multiple" size={24} color="#A78BFA" />
                                </View>
                                <Text style={styles.actionLabel}>Portfolio</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('MyServices')}>
                                <View style={[styles.actionIcon, { backgroundColor: 'rgba(16, 185, 129, 0.2)' }]}>
                                    <MaterialCommunityIcons name="format-list-checks" size={24} color="#34D399" />
                                </View>
                                <Text style={styles.actionLabel}>My Services</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('Availability')}>
                                <View style={[styles.actionIcon, { backgroundColor: 'rgba(59, 130, 246, 0.2)' }]}>
                                    <MaterialCommunityIcons name="clock-outline" size={24} color="#60A5FA" />
                                </View>
                                <Text style={styles.actionLabel}>Availability</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Business Management */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Business Management</Text>
                        <View style={styles.quickActionsGrid}>
                            <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('MasterForm')}>
                                <View style={[styles.actionIcon, { backgroundColor: 'rgba(6, 182, 212, 0.2)' }]}>
                                    <MaterialCommunityIcons name="account-plus" size={24} color="#22D3EE" />
                                </View>
                                <Text style={styles.actionLabel}>Add Master</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('ServiceForm')}>
                                <View style={[styles.actionIcon, { backgroundColor: 'rgba(251, 191, 36, 0.2)' }]}>
                                    <MaterialCommunityIcons name="star-plus" size={24} color="#FBBF24" />
                                </View>
                                <Text style={styles.actionLabel}>Add Service</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('Masters')}>
                                <View style={[styles.actionIcon, { backgroundColor: 'rgba(99, 102, 241, 0.2)' }]}>
                                    <MaterialCommunityIcons name="account-group" size={24} color="#818CF8" />
                                </View>
                                <Text style={styles.actionLabel}>Masters</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('Services')}>
                                <View style={[styles.actionIcon, { backgroundColor: 'rgba(244, 114, 182, 0.2)' }]}>
                                    <MaterialCommunityIcons name="view-list" size={24} color="#F472B6" />
                                </View>
                                <Text style={styles.actionLabel}>Services</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('Inventory')}>
                                <View style={[styles.actionIcon, { backgroundColor: 'rgba(236, 72, 153, 0.2)' }]}>
                                    <MaterialCommunityIcons name="package-variant-closed" size={24} color="#EC4899" />
                                </View>
                                <Text style={styles.actionLabel}>Inventory</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Stats */}
                    <View style={styles.statsRow}>
                        <TouchableOpacity onPress={() => navigation.navigate('Masters')}>
                            <Card style={styles.statCard} variant="elevated">
                                <Text style={styles.statValue}>{stats.activeMasters}/{stats.totalMasters}</Text>
                                <Text style={styles.statLabel}>Masters</Text>
                            </Card>
                        </TouchableOpacity>
                        <Card style={styles.statCard} variant="elevated">
                            <Text style={styles.statValue}>{stats.todayAppointments}</Text>
                            <Text style={styles.statLabel}>Today</Text>
                        </Card>
                        <Card style={[styles.statCard, stats.pendingAppointments > 0 ? styles.pendingCard : undefined]} variant="elevated">
                            <Text style={[styles.statValue, stats.pendingAppointments > 0 ? styles.pendingValue : undefined]}>
                                {stats.pendingAppointments}
                            </Text>
                            <Text style={styles.statLabel}>Pending</Text>
                        </Card>
                    </View>

                    {/* Schedule */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Schedule</Text>
                        {appointments.length > 0 ? (
                            appointments.map((apt) => (
                                <Card key={apt.id} style={styles.appointmentCard}>
                                    <View style={styles.appointmentTime}>
                                        <Text style={styles.dateText}>{format(new Date(apt.start_time), 'MMM d')}</Text>
                                        <Text style={styles.timeText}>{format(new Date(apt.start_time), 'HH:mm')}</Text>
                                    </View>
                                    <View style={styles.appointmentInfo}>
                                        <Text style={styles.serviceName}>{apt.service?.name || 'Service'}</Text>
                                        <Text style={styles.clientName}>{apt.client?.full_name || 'Client'}</Text>
                                    </View>
                                    <View style={[styles.statusDot, apt.status === 'completed' && styles.statusCompleted]} />
                                </Card>
                            ))
                        ) : (
                            <Card variant="glass" style={styles.emptyCard}>
                                <Text style={styles.emptyIcon}>📅</Text>
                                <Text style={styles.emptyText}>No appointments yet</Text>
                            </Card>
                        )}
                    </View>
                </ScrollView>
            </SafeAreaView>
        </ScreenBackground>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    content: { padding: spacing.lg },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xl, paddingTop: spacing.md },
    greeting: { fontSize: 14, color: colors.textSecondary },
    name: { fontSize: 28, fontWeight: '600', color: colors.text },
    qrGeneratorBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: colors.surfaceLight,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: colors.border,
    },
    section: { marginBottom: spacing.xl },
    sectionTitle: { fontSize: 12, fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: spacing.md },
    quickActionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    actionButton: { width: '31%', alignItems: 'center', backgroundColor: colors.surface, padding: spacing.md, borderRadius: 12 },
    actionIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
    actionLabel: { fontSize: 11, fontWeight: '600', color: colors.text, textAlign: 'center' },
    statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xl },
    statCard: { flex: 1, alignItems: 'center', padding: spacing.md },
    pendingCard: { borderWidth: 2, borderColor: '#F59E0B' },
    statValue: { fontSize: 24, fontWeight: '700', color: colors.text },
    pendingValue: { color: '#F59E0B' },
    statLabel: { fontSize: 11, color: colors.textSecondary, marginTop: spacing.xs },
    appointmentCard: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm, padding: spacing.md },
    appointmentTime: { marginRight: spacing.md },
    timeText: { fontSize: 16, fontWeight: '600', color: colors.text },
    dateText: { fontSize: 11, color: colors.textSecondary, marginBottom: 2 },
    appointmentInfo: { flex: 1 },
    serviceName: { fontSize: 14, fontWeight: '500', color: colors.text },
    clientName: { fontSize: 12, color: colors.textSecondary },
    statusDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#3B82F6' },
    statusCompleted: { backgroundColor: '#22C55E' },
    emptyCard: { alignItems: 'center', padding: spacing.xl },
    emptyIcon: { fontSize: 48, marginBottom: spacing.md, opacity: 0.5 },
    emptyText: { fontSize: 14, color: colors.textSecondary },
});

export default OwnerDashboardScreen;
