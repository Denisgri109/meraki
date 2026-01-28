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
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Card, ScreenBackground } from '../../components/ui';
import { colors, spacing } from '../../theme';

type Stats = {
    totalMasters: number;
    activeMasters: number;
    totalServices: number;
    activeServices: number;
    todayAppointments: number;
    pendingAppointments: number;
};

export function OwnerDashboardScreen() {
    const navigation = useNavigation<any>();
    const { profile } = useAuth();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [stats, setStats] = useState<Stats>({
        totalMasters: 0,
        activeMasters: 0,
        totalServices: 0,
        activeServices: 0,
        todayAppointments: 0,
        pendingAppointments: 0,
    });

    useFocusEffect(
        useCallback(() => {
            fetchDashboardData();
        }, [])
    );

    const fetchDashboardData = async () => {
        try {
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

            // Fetch today's appointments - use separate Date objects to avoid mutation
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);
            const todayEnd = new Date();
            todayEnd.setHours(23, 59, 59, 999);

            const { count: todayCount } = await supabase
                .from('appointments')
                .select('*', { count: 'exact', head: true })
                .gte('start_time', todayStart.toISOString())
                .lt('start_time', todayEnd.toISOString())
                .in('status', ['confirmed', 'pending', 'completed']);

            const { count: pendingCount } = await supabase
                .from('appointments')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'pending');

            setStats({
                totalMasters: mastersCount || 0,
                activeMasters: activeMastersCount || 0,
                totalServices: servicesCount || 0,
                activeServices: activeServicesCount || 0,
                todayAppointments: todayCount || 0,
                pendingAppointments: pendingCount || 0,
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

                    {/* Quick Actions */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Quick Actions</Text>
                        <View style={styles.actionsRow}>
                            <TouchableOpacity
                                style={styles.actionButton}
                                onPress={() => navigation.navigate('MasterForm')}
                            >
                                <Text style={styles.actionIcon}>👤+</Text>
                                <Text style={styles.actionText}>Add Master</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.actionButton}
                                onPress={() => navigation.navigate('ServiceForm')}
                            >
                                <Text style={styles.actionIcon}>✨+</Text>
                                <Text style={styles.actionText}>Add Service</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Stats Grid */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Overview</Text>
                        <View style={styles.statsGrid}>
                            <TouchableOpacity onPress={() => navigation.navigate('Masters')}>
                                <Card style={styles.statCard} variant="elevated">
                                    <Text style={styles.statValue}>{stats.activeMasters}/{stats.totalMasters}</Text>
                                    <Text style={styles.statLabel}>Active Masters</Text>
                                </Card>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => navigation.navigate('Services')}>
                                <Card style={styles.statCard} variant="elevated">
                                    <Text style={styles.statValue}>{stats.activeServices}/{stats.totalServices}</Text>
                                    <Text style={styles.statLabel}>Active Services</Text>
                                </Card>
                            </TouchableOpacity>
                            <Card style={styles.statCard} variant="elevated">
                                <Text style={styles.statValue}>{stats.todayAppointments}</Text>
                                <Text style={styles.statLabel}>Today's Bookings</Text>
                            </Card>
                            <Card style={styles.statCard} variant="elevated">
                                <Text style={[styles.statValue, stats.pendingAppointments > 0 && styles.pendingValue]}>
                                    {stats.pendingAppointments}
                                </Text>
                                <Text style={styles.statLabel}>Pending</Text>
                            </Card>
                        </View>
                    </View>

                    {/* Management Sections */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Management</Text>
                        <TouchableOpacity onPress={() => navigation.navigate('Masters')}>
                            <Card style={styles.menuCard}>
                                <Text style={styles.menuIcon}>👥</Text>
                                <View style={styles.menuInfo}>
                                    <Text style={styles.menuTitle}>Manage Masters</Text>
                                    <Text style={styles.menuSubtitle}>Add, edit, or remove team members</Text>
                                </View>
                                <Text style={styles.menuArrow}>→</Text>
                            </Card>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => navigation.navigate('Services')}>
                            <Card style={styles.menuCard}>
                                <Text style={styles.menuIcon}>✨</Text>
                                <View style={styles.menuInfo}>
                                    <Text style={styles.menuTitle}>Manage Services</Text>
                                    <Text style={styles.menuSubtitle}>Configure service offerings</Text>
                                </View>
                                <Text style={styles.menuArrow}>→</Text>
                            </Card>
                        </TouchableOpacity>
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
    qrIcon: { fontSize: 20 },
    section: { marginBottom: spacing.xl },
    sectionTitle: {
        fontSize: 12,
        fontWeight: '600',
        color: colors.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: 1.5,
        marginBottom: spacing.md
    },
    actionsRow: {
        flexDirection: 'row',
        gap: spacing.md
    },
    actionButton: {
        flex: 1,
        backgroundColor: colors.surfaceLight,
        borderRadius: 12,
        padding: spacing.lg,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.border,
    },
    actionIcon: { fontSize: 32, marginBottom: spacing.sm },
    actionText: { fontSize: 14, fontWeight: '600', color: colors.text },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm
    },
    statCard: {
        width: '48%',
        minWidth: 150,
        alignItems: 'center',
        padding: spacing.md
    },
    statValue: { fontSize: 28, fontWeight: '700', color: colors.text },
    pendingValue: { color: '#F59E0B' },
    statLabel: { fontSize: 11, color: colors.textSecondary, marginTop: spacing.xs },
    menuCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.md,
        marginBottom: spacing.sm
    },
    menuIcon: { fontSize: 32, marginRight: spacing.md },
    menuInfo: { flex: 1 },
    menuTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
    menuSubtitle: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
    menuArrow: { fontSize: 20, color: colors.textSecondary },
});

export default OwnerDashboardScreen;
