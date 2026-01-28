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
import { format, isToday, startOfDay, endOfDay } from 'date-fns';
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

type RecentMessage = {
    id: string;
    content: string | null;
    media_type: string | null;
    created_at: string;
    sender_name: string;
    conversation_id: string;
};

export function MasterDashboardScreen() {
    const navigation = useNavigation<any>();
    const { profile, user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [stats, setStats] = useState({
        todayAppointments: 0,
        todayEarnings: 0,
        pendingRequests: 0,
        unreadMessages: 0,
    });
    const [todaysAppointments, setTodaysAppointments] = useState<Appointment[]>([]);
    const [recentMessages, setRecentMessages] = useState<RecentMessage[]>([]);

    useFocusEffect(
        useCallback(() => {
            fetchDashboardData();
        }, [user?.id])
    );

    // Real-time subscription for new messages
    useEffect(() => {
        if (!user?.id) return;

        const subscription = supabase
            .channel('master_messages')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
            }, (payload) => {
                // Refetch data when new message comes in
                fetchDashboardData();
            })
            .subscribe();

        return () => {
            subscription.unsubscribe();
        };
    }, [user?.id]);

    const fetchDashboardData = async () => {
        if (!user) return;

        try {
            const today = new Date();
            const todayStart = startOfDay(today).toISOString();
            const todayEnd = endOfDay(today).toISOString();

            // Fetch today's appointments
            const todayPromise = supabase
                .from('appointments')
                .select(`
                    id, start_time, status, price,
                    service:services(name),
                    client:profiles!appointments_client_id_fkey(full_name)
                `)
                .eq('master_id', user.id)
                .gte('start_time', todayStart)
                .lt('start_time', todayEnd)
                .in('status', ['confirmed', 'pending', 'completed'])
                .order('start_time');

            const { data: todayData } = await safeSupabaseFetch(todayPromise as any, { timeout: 8000 });

            // Fetch pending requests count
            const pendingPromise = supabase
                .from('appointments')
                .select('*', { count: 'exact', head: true })
                .eq('master_id', user.id)
                .eq('status', 'pending');

            const { count: pendingCount } = await safeSupabaseFetch(pendingPromise as any, { timeout: 8000 }) as any;

            // Fetch unread messages count - get conversations where master is involved
            let unreadCount = 0;
            let recentMsgs: RecentMessage[] = [];

            try {
                // Get master's conversations
                const conversationsPromise = (supabase as any)
                    .from('conversations')
                    .select('id, client_id')
                    .eq('master_id', user.id);

                const { data: conversations } = await safeSupabaseFetch(conversationsPromise, { timeout: 5000 });

                if (conversations && (conversations as any[]).length > 0) {
                    const convIds = (conversations as any[]).map((c: any) => c.id);

                    // Get all unread messages (not sent by this master)
                    const messagesPromise = (supabase as any)
                        .from('messages')
                        .select('*')
                        .in('conversation_id', convIds)
                        .neq('sender_id', user.id)
                        .is('read_at', null)
                        .order('created_at', { ascending: false });

                    const { data: messages } = await safeSupabaseFetch(messagesPromise, { timeout: 5000 });

                    // Group by sender - keep only most recent message per person
                    const latestBySender = new Map<string, any>();
                    for (const msg of ((messages as any[]) || [])) {
                        if (!latestBySender.has(msg.sender_id)) {
                            latestBySender.set(msg.sender_id, msg);
                        }
                    }

                    unreadCount = latestBySender.size; // Count unique senders

                    // Get sender details for grouped messages
                    const uniqueMessages = Array.from(latestBySender.values()).slice(0, 5);
                    if (uniqueMessages.length > 0) {
                        recentMsgs = await Promise.all(
                            uniqueMessages.map(async (msg: any) => {
                                const senderPromise = supabase
                                    .from('profiles')
                                    .select('full_name')
                                    .eq('id', msg.sender_id)
                                    .single();

                                const { data: sender } = await safeSupabaseFetch(senderPromise as any, { timeout: 3000 });

                                return {
                                    id: msg.id,
                                    content: msg.content,
                                    media_type: msg.media_type,
                                    created_at: msg.created_at,
                                    sender_name: (sender as any)?.full_name || 'Client',
                                    conversation_id: msg.conversation_id,
                                };
                            })
                        );
                    }
                }
            } catch (e) {
                console.log('Messages fetch error:', e);
            }

            // Calculate today's earnings from completed appointments
            const todayEarnings = ((todayData as any[]) || [])
                .filter((apt: any) => apt.status === 'completed')
                .reduce((sum: number, apt: any) => sum + (apt.price || 0), 0);

            setTodaysAppointments((todayData as unknown as Appointment[]) || []);
            setRecentMessages(recentMsgs);
            setStats({
                todayAppointments: ((todayData as any[]) || []).filter((apt: any) => apt.status !== 'completed').length,
                todayEarnings,
                pendingRequests: pendingCount || 0,
                unreadMessages: unreadCount,
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

    const handleOpenChat = (conversationId: string) => {
        navigation.navigate('ChatList');
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
                            <Text style={styles.greeting}>Welcome back,</Text>
                            <Text style={styles.name}>{profile?.full_name || 'Master'}</Text>
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
                        <Text style={styles.sectionTitle}>Manage Business</Text>
                        <View style={styles.quickActionsGrid}>
                            <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('Portfolio')}>
                                <View style={[styles.actionIcon, { backgroundColor: 'rgba(139, 92, 246, 0.2)' }]}>
                                    <MaterialCommunityIcons name="image-multiple" size={24} color="#A78BFA" />
                                </View>
                                <Text style={styles.actionLabel}>Portfolio</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('BlockedSlots')}>
                                <View style={[styles.actionIcon, { backgroundColor: 'rgba(239, 68, 68, 0.2)' }]}>
                                    <MaterialCommunityIcons name="calendar-lock" size={24} color="#F87171" />
                                </View>
                                <Text style={styles.actionLabel}>Blocked Slots</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('MyServices')}>
                                <View style={[styles.actionIcon, { backgroundColor: 'rgba(16, 185, 129, 0.2)' }]}>
                                    <MaterialCommunityIcons name="format-list-checks" size={24} color="#34D399" />
                                </View>
                                <Text style={styles.actionLabel}>My Services</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Stats */}
                    <View style={styles.statsRow}>
                        <Card style={styles.statCard} variant="elevated">
                            <Text style={styles.statValue}>{stats.todayAppointments}</Text>
                            <Text style={styles.statLabel}>Today</Text>
                        </Card>
                        <Card style={styles.statCard} variant="elevated">
                            <Text style={styles.statValue}>€{stats.todayEarnings}</Text>
                            <Text style={styles.statLabel}>Earned</Text>
                        </Card>
                        <TouchableOpacity onPress={() => navigation.navigate('Messages')}>
                            <Card style={stats.unreadMessages > 0 ? [styles.statCard, styles.messageCard] as any : styles.statCard} variant="elevated">
                                <Text style={styles.statValue}>{stats.unreadMessages}</Text>
                                <Text style={styles.statLabel}>Messages</Text>
                            </Card>
                        </TouchableOpacity>
                    </View>

                    {/* Recent Messages */}
                    {recentMessages.length > 0 && (
                        <View style={styles.section}>
                            <View style={styles.sectionHeader}>
                                <Text style={styles.sectionTitle}>New Messages</Text>
                                <TouchableOpacity onPress={() => navigation.navigate('Messages')}>
                                    <Text style={styles.viewAll}>View All →</Text>
                                </TouchableOpacity>
                            </View>
                            {recentMessages.slice(0, 3).map((msg) => (
                                <TouchableOpacity
                                    key={msg.id}
                                    onPress={() => navigation.navigate('ChatList')}
                                >
                                    <Card style={styles.messageCard2}>
                                        <View style={styles.messageAvatar}>
                                            <Text style={styles.avatarText}>{msg.sender_name[0]}</Text>
                                        </View>
                                        <View style={styles.messageInfo}>
                                            <Text style={styles.senderName}>{msg.sender_name}</Text>
                                            <Text style={styles.messagePreview} numberOfLines={1}>
                                                {msg.media_type ? '📷 Photo' : msg.content || 'New message'}
                                            </Text>
                                        </View>
                                        <View style={styles.unreadDot} />
                                    </Card>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}

                    {/* Today's Schedule */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Today's Schedule</Text>
                        {todaysAppointments.length > 0 ? (
                            todaysAppointments.map((apt) => (
                                <Card key={apt.id} style={styles.appointmentCard}>
                                    <View style={styles.appointmentTime}>
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
                                <Text style={styles.emptyIcon}>☀️</Text>
                                <Text style={styles.emptyText}>No appointments today</Text>
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
    qrIcon: { fontSize: 20 },
    statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xl },
    statCard: { flex: 1, alignItems: 'center', padding: spacing.md },
    messageCard: { borderWidth: 2, borderColor: '#3B82F6' },
    statValue: { fontSize: 28, fontWeight: '700', color: colors.text },
    statLabel: { fontSize: 11, color: colors.textSecondary, marginTop: spacing.xs },
    section: { marginBottom: spacing.xl },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
    sectionTitle: { fontSize: 12, fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1.5 },
    viewAll: { fontSize: 12, color: colors.text, fontWeight: '500' },
    messageCard2: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm, padding: spacing.md },
    messageAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceLight, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md },
    avatarText: { fontSize: 16, fontWeight: '600', color: colors.text },
    messageInfo: { flex: 1 },
    senderName: { fontSize: 14, fontWeight: '500', color: colors.text, marginBottom: 2 },
    messagePreview: { fontSize: 12, color: colors.textSecondary },
    unreadDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#3B82F6' },
    appointmentCard: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm, padding: spacing.md },
    appointmentTime: { marginRight: spacing.md },
    timeText: { fontSize: 16, fontWeight: '600', color: colors.text },
    appointmentInfo: { flex: 1 },
    serviceName: { fontSize: 14, fontWeight: '500', color: colors.text },
    clientName: { fontSize: 12, color: colors.textSecondary },
    statusDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#3B82F6' },
    statusCompleted: { backgroundColor: '#22C55E' },
    emptyCard: { alignItems: 'center', padding: spacing.xl },
    emptyIcon: { fontSize: 48, marginBottom: spacing.md, opacity: 0.5 },
    emptyText: { fontSize: 14, color: colors.textSecondary },
    quickActionsGrid: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
    actionButton: { flex: 1, alignItems: 'center', backgroundColor: colors.surface, padding: spacing.md, borderRadius: 12 },
    actionIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
    actionLabel: { fontSize: 12, fontWeight: '600', color: colors.text, textAlign: 'center' },
});

export default MasterDashboardScreen;
