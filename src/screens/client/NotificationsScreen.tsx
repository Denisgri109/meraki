import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Switch,
    ActivityIndicator,
    RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { safeSupabaseFetch } from '../../lib/supabaseApi';
import { useAuth } from '../../contexts/AuthContext';
import { Card, ScreenBackground } from '../../components/ui';
import { colors, spacing } from '../../theme';

type Notification = {
    id: string;
    title: string;
    body: string;
    type: string;
    read: boolean;
    created_at: string;
    data?: any;
    productId?: string;
};

const NOTIFICATION_ICONS: Record<string, string> = {
    booking: '📅',
    reminder: '⏰',
    promo: '🎉',
    system: '📢',
    payment: '💳',
    message: '💬',
    low_stock: '📦',
};

export function NotificationsScreen() {
    const navigation = useNavigation<any>();
    const { user, profile } = useAuth();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [settings, setSettings] = useState({
        pushEnabled: true,
        bookingReminders: true,
        bookingUpdates: true,
        aftercare: true,
        messages: true,
        promotions: true,
        consultations: true,
        academy: true,
        stockAlerts: true, // Owner only
    });
    const [savingSettings, setSavingSettings] = useState(false);

    const isMaster = profile?.is_master || profile?.role === 'master' || profile?.role === 'owner';

    // Load preferences from profile on mount
    useEffect(() => {
        if (profile?.notification_preferences) {
            const prefs = profile.notification_preferences as any;
            setSettings({
                pushEnabled: prefs.push_enabled ?? true,
                bookingReminders: prefs.booking_reminders ?? true,
                bookingUpdates: prefs.booking_updates ?? true,
                aftercare: prefs.aftercare ?? true,
                messages: prefs.messages ?? true,
                promotions: prefs.promotions ?? true,
                consultations: prefs.consultations ?? true,
                academy: prefs.academy ?? true,
                stockAlerts: prefs.stock_alerts ?? true,
            });
        }
    }, [profile?.notification_preferences]);

    useFocusEffect(
        useCallback(() => {
            fetchNotifications();
        }, [user?.id])
    );

    // Real-time subscription for new messages
    useEffect(() => {
        if (!user?.id) return;

        const subscription = supabase
            .channel('notification_messages')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
            }, () => {
                fetchNotifications();
            })
            .subscribe();

        return () => {
            subscription.unsubscribe();
        };
    }, [user?.id]);

    const fetchNotifications = async () => {
        if (!user) {
            setLoading(false);
            return;
        }

        try {
            const field = isMaster ? 'master_id' : 'client_id';
            const allNotifications: Notification[] = [];

            // 1. Fetch unread messages as notifications
            try {
                const conversationsPromise = (supabase as any)
                    .from('conversations')
                    .select('id')
                    .eq(field, user.id);

                const { data: conversations } = await safeSupabaseFetch(conversationsPromise, { timeout: 5000 });

                if (conversations && (conversations as any[]).length > 0) {
                    const convIds = (conversations as any[]).map((c: any) => c.id);

                    const messagesPromise = (supabase as any)
                        .from('messages')
                        .select('*')
                        .in('conversation_id', convIds)
                        .neq('sender_id', user.id)
                        .order('created_at', { ascending: false })
                        .limit(10);

                    const { data: messages } = await safeSupabaseFetch(messagesPromise, { timeout: 5000 });

                    if (messages) {
                        for (const msg of (messages as any[])) {
                            const senderPromise = supabase
                                .from('profiles')
                                .select('full_name')
                                .eq('id', msg.sender_id)
                                .single();

                            const { data: sender } = await safeSupabaseFetch(senderPromise as any, { timeout: 3000 });

                            allNotifications.push({
                                id: `msg-${msg.id}`,
                                title: `Message from ${(sender as any)?.full_name || 'User'}`,
                                body: msg.media_type ? '📷 Sent a photo' : msg.content || 'New message',
                                type: 'message',
                                read: !!msg.read_at,
                                created_at: msg.created_at,
                                data: { conversationId: msg.conversation_id },
                            });
                        }
                    }
                }
            } catch (e) {
                console.log('Message notifications error:', e);
            }

            // 2. Fetch appointment notifications
            try {
                const appointmentField = isMaster ? 'master_id' : 'client_id';
                const appointmentsPromise = supabase
                    .from('appointments')
                    .select(`
                        id, status, start_time, created_at,
                        service:services(name),
                        client:profiles!appointments_client_id_fkey(full_name),
                        master:profiles!appointments_master_id_fkey(full_name)
                    `)
                    .eq(appointmentField, user.id)
                    .order('created_at', { ascending: false })
                    .limit(5);

                const { data: appointments } = await safeSupabaseFetch(appointmentsPromise as any, { timeout: 8000 });

                if (appointments) {
                    for (const apt of (appointments as any[])) {
                        const aptService = apt.service as any;
                        const aptClient = apt.client as any;
                        const aptMaster = apt.master as any;

                        let title = '';
                        let body = '';

                        if (isMaster) {
                            if (apt.status === 'pending') {
                                title = 'New Booking Request';
                                body = `${aptClient?.full_name || 'Client'} requested ${aptService?.name || 'a service'}`;
                            } else if (apt.status === 'confirmed') {
                                title = 'Booking Confirmed';
                                body = `Appointment with ${aptClient?.full_name || 'Client'} confirmed`;
                            }
                        } else {
                            if (apt.status === 'confirmed') {
                                title = 'Booking Confirmed';
                                body = `Your appointment with ${aptMaster?.full_name || 'Specialist'} is confirmed`;
                            } else if (apt.status === 'pending') {
                                title = 'Booking Pending';
                                body = `Waiting for ${aptMaster?.full_name || 'Specialist'} to confirm`;
                            }
                        }

                        if (title) {
                            allNotifications.push({
                                id: `apt-${apt.id}`,
                                title,
                                body,
                                type: 'booking',
                                read: true, // Appointments are considered "read"
                                created_at: apt.created_at || new Date().toISOString(),
                            });
                        }
                    }
                }
            } catch (e) {
                console.log('Appointment notifications error:', e);
            }

            // 3. Fetch low stock notifications for owners
            if (profile?.role === 'owner' && settings.stockAlerts) {
                try {
                    const { data: lowStockProducts } = await (supabase as any)
                        .from('products')
                        .select('id, name, stock_count, low_stock_threshold')
                        .eq('is_active', true);

                    if (lowStockProducts) {
                        for (const product of lowStockProducts as any[]) {
                            if (product.stock_count < (product.low_stock_threshold || 5)) {
                                allNotifications.push({
                                    id: `lowstock-${product.id}`,
                                    title: product.stock_count === 0 ? '🚨 Out of Stock' : '⚠️ Low Stock Alert',
                                    body: product.stock_count === 0
                                        ? `${product.name} is out of stock!`
                                        : `${product.name} has only ${product.stock_count} units left`,
                                    type: 'low_stock',
                                    read: false,
                                    created_at: new Date().toISOString(),
                                    productId: product.id,
                                });
                            }
                        }
                    }
                } catch (e) {
                    console.log('Low stock notifications error:', e);
                }
            }

            // Sort by date
            allNotifications.sort((a, b) =>
                new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            );

            setNotifications(allNotifications);
        } catch (error) {
            console.error('Error fetching notifications:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchNotifications();
    };

    const handleNotificationPress = async (notification: Notification) => {
        // Mark as read if it's a message
        if (notification.type === 'message' && !notification.read) {
            try {
                const msgId = notification.id.replace('msg-', '');
                await (supabase as any)
                    .from('messages')
                    .update({ read_at: new Date().toISOString() })
                    .eq('id', msgId);
            } catch (e) {
                console.log('Mark read error:', e);
            }

            setNotifications(prev =>
                prev.map(n => n.id === notification.id ? { ...n, read: true } : n)
            );
        }

        // Navigate to relevant screen
        if (notification.type === 'message' && notification.data?.conversationId) {
            // Navigate to messages - the parent navigator handles this
            navigation.navigate('Messages' as never);
        }
    };

    const markAllAsRead = async () => {
        // Mark all message notifications as read
        const unreadMessages = notifications.filter(n => n.type === 'message' && !n.read);

        for (const n of unreadMessages) {
            try {
                const msgId = n.id.replace('msg-', '');
                await (supabase as any)
                    .from('messages')
                    .update({ read_at: new Date().toISOString() })
                    .eq('id', msgId);
            } catch (e) {
                // Ignore
            }
        }

        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    };

    const toggleSetting = async (key: keyof typeof settings) => {
        const newSettings = { ...settings, [key]: !settings[key] };
        setSettings(newSettings);

        // Save to database
        if (user?.id) {
            setSavingSettings(true);
            try {
                const dbPrefs = {
                    push_enabled: newSettings.pushEnabled,
                    booking_reminders: newSettings.bookingReminders,
                    booking_updates: newSettings.bookingUpdates,
                    aftercare: newSettings.aftercare,
                    messages: newSettings.messages,
                    promotions: newSettings.promotions,
                    consultations: newSettings.consultations,
                    academy: newSettings.academy,
                    stock_alerts: newSettings.stockAlerts,
                };
                await supabase
                    .from('profiles')
                    .update({ notification_preferences: dbPrefs })
                    .eq('id', user.id);
            } catch (e) {
                console.log('Error saving notification preferences:', e);
                // Revert on error
                setSettings(settings);
            } finally {
                setSavingSettings(false);
            }
        }
    };

    const unreadCount = notifications.filter(n => !n.read).length;

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
                        <TouchableOpacity onPress={() => navigation.goBack()}>
                            <Text style={styles.backButton}>← Back</Text>
                        </TouchableOpacity>
                        <View style={styles.headerRow}>
                            <Text style={styles.title}>Notifications</Text>
                            {unreadCount > 0 && (
                                <TouchableOpacity onPress={markAllAsRead}>
                                    <Text style={styles.markAllRead}>Mark all read</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>

                    {/* Settings */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Preferences</Text>
                        <Card style={styles.settingsCard}>
                            <View style={styles.settingRow}>
                                <View style={styles.settingInfo}>
                                    <Text style={styles.settingLabel}>Push Notifications</Text>
                                    <Text style={styles.settingDesc}>Receive push notifications</Text>
                                </View>
                                <Switch
                                    value={settings.pushEnabled}
                                    onValueChange={() => toggleSetting('pushEnabled')}
                                    trackColor={{ false: colors.surfaceLight, true: colors.text }}
                                    thumbColor={colors.background}
                                />
                            </View>
                            <View style={styles.settingRow}>
                                <View style={styles.settingInfo}>
                                    <Text style={styles.settingLabel}>Booking Reminders</Text>
                                    <Text style={styles.settingDesc}>Reminders before appointments</Text>
                                </View>
                                <Switch
                                    value={settings.bookingReminders}
                                    onValueChange={() => toggleSetting('bookingReminders')}
                                    trackColor={{ false: colors.surfaceLight, true: colors.text }}
                                    thumbColor={colors.background}
                                />
                            </View>
                            <View style={styles.settingRow}>
                                <View style={styles.settingInfo}>
                                    <Text style={styles.settingLabel}>Booking Updates</Text>
                                    <Text style={styles.settingDesc}>New bookings & cancellations</Text>
                                </View>
                                <Switch
                                    value={settings.bookingUpdates}
                                    onValueChange={() => toggleSetting('bookingUpdates')}
                                    trackColor={{ false: colors.surfaceLight, true: colors.text }}
                                    thumbColor={colors.background}
                                />
                            </View>
                            <View style={styles.settingRow}>
                                <View style={styles.settingInfo}>
                                    <Text style={styles.settingLabel}>Aftercare</Text>
                                    <Text style={styles.settingDesc}>Post-appointment care tips</Text>
                                </View>
                                <Switch
                                    value={settings.aftercare}
                                    onValueChange={() => toggleSetting('aftercare')}
                                    trackColor={{ false: colors.surfaceLight, true: colors.text }}
                                    thumbColor={colors.background}
                                />
                            </View>
                            <View style={styles.settingRow}>
                                <View style={styles.settingInfo}>
                                    <Text style={styles.settingLabel}>Messages</Text>
                                    <Text style={styles.settingDesc}>New message notifications</Text>
                                </View>
                                <Switch
                                    value={settings.messages}
                                    onValueChange={() => toggleSetting('messages')}
                                    trackColor={{ false: colors.surfaceLight, true: colors.text }}
                                    thumbColor={colors.background}
                                />
                            </View>
                            <View style={styles.settingRow}>
                                <View style={styles.settingInfo}>
                                    <Text style={styles.settingLabel}>Promotions</Text>
                                    <Text style={styles.settingDesc}>Special offers and discounts</Text>
                                </View>
                                <Switch
                                    value={settings.promotions}
                                    onValueChange={() => toggleSetting('promotions')}
                                    trackColor={{ false: colors.surfaceLight, true: colors.text }}
                                    thumbColor={colors.background}
                                />
                            </View>
                            <View style={styles.settingRow}>
                                <View style={styles.settingInfo}>
                                    <Text style={styles.settingLabel}>Consultations</Text>
                                    <Text style={styles.settingDesc}>Photo consultation updates</Text>
                                </View>
                                <Switch
                                    value={settings.consultations}
                                    onValueChange={() => toggleSetting('consultations')}
                                    trackColor={{ false: colors.surfaceLight, true: colors.text }}
                                    thumbColor={colors.background}
                                />
                            </View>
                            <View style={styles.settingRow}>
                                <View style={styles.settingInfo}>
                                    <Text style={styles.settingLabel}>Academy</Text>
                                    <Text style={styles.settingDesc}>Submission & feedback alerts</Text>
                                </View>
                                <Switch
                                    value={settings.academy}
                                    onValueChange={() => toggleSetting('academy')}
                                    trackColor={{ false: colors.surfaceLight, true: colors.text }}
                                    thumbColor={colors.background}
                                />
                            </View>
                            {profile?.role === 'owner' && (
                                <View style={styles.settingRow}>
                                    <View style={styles.settingInfo}>
                                        <Text style={styles.settingLabel}>Stock Alerts</Text>
                                        <Text style={styles.settingDesc}>Low inventory notifications</Text>
                                    </View>
                                    <Switch
                                        value={settings.stockAlerts}
                                        onValueChange={() => toggleSetting('stockAlerts')}
                                        trackColor={{ false: colors.surfaceLight, true: colors.text }}
                                        thumbColor={colors.background}
                                    />
                                </View>
                            )}
                        </Card>
                    </View>

                    {/* Notifications List */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Recent</Text>
                        {notifications.length > 0 ? (
                            notifications.map((notification) => (
                                <TouchableOpacity
                                    key={notification.id}
                                    onPress={() => handleNotificationPress(notification)}
                                >
                                    <Card style={!notification.read ? [styles.notificationCard, styles.unreadCard] as any : styles.notificationCard}>
                                        <Text style={styles.notificationIcon}>
                                            {NOTIFICATION_ICONS[notification.type] || '📢'}
                                        </Text>
                                        <View style={styles.notificationContent}>
                                            <Text style={styles.notificationTitle}>
                                                {notification.title}
                                            </Text>
                                            <Text style={styles.notificationBody} numberOfLines={2}>
                                                {notification.body}
                                            </Text>
                                            <Text style={styles.notificationTime}>
                                                {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                                            </Text>
                                        </View>
                                        {!notification.read && <View style={styles.unreadDot} />}
                                    </Card>
                                </TouchableOpacity>
                            ))
                        ) : (
                            <Card style={styles.emptyCard}>
                                <Text style={styles.emptyIcon}>🔔</Text>
                                <Text style={styles.emptyText}>No notifications yet</Text>
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
    header: { marginBottom: spacing.xl },
    backButton: { color: colors.textSecondary, fontSize: 16, marginBottom: spacing.md },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    title: { fontSize: 28, fontWeight: '600', color: colors.text },
    markAllRead: { fontSize: 14, color: colors.textSecondary },
    section: { marginBottom: spacing.xl },
    sectionTitle: { fontSize: 14, fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: spacing.md },
    settingsCard: { padding: 0 },
    settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
    settingInfo: { flex: 1 },
    settingLabel: { fontSize: 15, fontWeight: '500', color: colors.text },
    settingDesc: { fontSize: 12, color: colors.textMuted, marginTop: spacing.xs },
    notificationCard: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.sm, padding: spacing.md },
    unreadCard: { borderLeftWidth: 3, borderLeftColor: '#3B82F6' },
    notificationIcon: { fontSize: 24, marginRight: spacing.md },
    notificationContent: { flex: 1 },
    notificationTitle: { fontSize: 15, fontWeight: '600', color: colors.text, marginBottom: spacing.xs },
    notificationBody: { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
    notificationTime: { fontSize: 11, color: colors.textMuted, marginTop: spacing.xs },
    unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#3B82F6' },
    emptyCard: { padding: spacing.xl, alignItems: 'center' },
    emptyIcon: { fontSize: 48, marginBottom: spacing.md, opacity: 0.5 },
    emptyText: { fontSize: 14, color: colors.textSecondary },
});

export default NotificationsScreen;
