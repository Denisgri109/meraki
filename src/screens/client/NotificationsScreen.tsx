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
import { MaterialIcons } from '@expo/vector-icons';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { safeSupabaseFetch } from '../../lib/supabaseApi';
import { useAuth } from '../../contexts/AuthContext';
import { ScreenBackground, MerakiText } from '../../components/ui';
import { colors, spacing } from '../../theme';
import { safeGoBack } from '../../navigation/navigationUtils';
import { useMenuBackHandler } from '../../hooks/useMenuBackHandler';

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

const NOTIFICATION_ICONS: Record<string, { name: string; color: string }> = {
    booking: { name: 'calendar-today', color: '#3B82F6' },
    reminder: { name: 'alarm', color: '#F59E0B' },
    promo: { name: 'celebration', color: '#C8A04D' },
    system: { name: 'campaign', color: '#6B7280' },
    payment: { name: 'credit-card', color: '#10B981' },
    message: { name: 'chat-bubble', color: '#8B5CF6' },
    low_stock: { name: 'inventory', color: '#EF4444' },
};

export function NotificationsScreen() {
    const navigation = useNavigation<any>();
    const handleBack = useMenuBackHandler();
    const { user, profile } = useAuth();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [showSettings, setShowSettings] = useState(false);
    const [settings, setSettings] = useState({
        pushEnabled: true,
        bookingReminders: true,
        bookingUpdates: true,
        messages: true,
        consultations: true,
        academy: true,
        stockAlerts: true,
    });
    const [savingSettings, setSavingSettings] = useState(false);

    const isMaster = profile?.is_master || profile?.role === 'master' || profile?.role === 'owner';

    useEffect(() => {
        if (profile?.notification_preferences) {
            const prefs = profile.notification_preferences as any;
            setSettings({
                pushEnabled: prefs.push_enabled ?? true,
                bookingReminders: prefs.booking_reminders ?? true,
                bookingUpdates: prefs.booking_updates ?? true,
                messages: prefs.messages ?? true,
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

        return () => { subscription.unsubscribe(); };
    }, [user?.id]);

    const fetchNotifications = async () => {
        if (!user) { setLoading(false); return; }

        try {
            // First fetch the latest profile preferences to ensure cleared_at is fresh
            let clearedAt = 0;
            try {
                const { data: profileData } = await safeSupabaseFetch(
                    supabase.from('profiles').select('notification_preferences').eq('id', user.id).single() as any,
                    { timeout: 3000 }
                );
                const prefs = (profileData as any)?.notification_preferences || {};
                if (prefs.cleared_at) {
                    clearedAt = new Date(prefs.cleared_at).getTime();
                }
            } catch (e) { console.warn('Error fetching cleared_at, gracefully degrading to 0:', e); }

            const field = isMaster ? 'master_id' : 'client_id';
            const allNotifications: Notification[] = [];

            // 1. Fetch unread messages as notifications
            try {
                const conversationsPromise = (supabase as any)
                    .from('conversations').select('id').eq(field, user.id);
                const { data: conversations } = await safeSupabaseFetch(conversationsPromise, { timeout: 5000 });

                if (conversations && (conversations as any[]).length > 0) {
                    const convIds = (conversations as any[]).map((c: any) => c.id);
                    const messagesPromise = (supabase as any)
                        .from('messages').select('*')
                        .in('conversation_id', convIds)
                        .neq('sender_id', user.id)
                        .order('created_at', { ascending: false }).limit(10);
                    const { data: messages } = await safeSupabaseFetch(messagesPromise, { timeout: 5000 });

                    if (messages && (messages as any[]).length > 0) {
                        const senderIds = Array.from(new Set((messages as any[]).map(m => m.sender_id)));
                        const sendersPromise = supabase.from('profiles').select('id, full_name').in('id', senderIds);
                        const { data: sendersData } = await safeSupabaseFetch(sendersPromise as any, { timeout: 3000 });

                        const sendersMap = new Map(((sendersData as any[]) || []).map(sender => [sender.id, sender]));

                        for (const msg of (messages as any[])) {
                            const sender = sendersMap.get(msg.sender_id);
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
            } catch (e) { console.log('Message notifications error:', e); }

            // 2. Fetch appointment notifications
            try {
                const appointmentField = isMaster ? 'master_id' : 'client_id';
                const appointmentsPromise = supabase.from('appointments')
                    .select(`id, status, start_time, created_at, service_name,
                        service:services(name),
                        client:profiles!appointments_client_id_fkey(full_name),
                        master:profiles!appointments_master_id_fkey(full_name)`)
                    .eq(appointmentField, user.id)
                    .order('created_at', { ascending: false }).limit(5);
                const { data: appointments } = await safeSupabaseFetch(appointmentsPromise as any, { timeout: 8000 });

                if (appointments) {
                    for (const apt of (appointments as any[])) {
                        const { service: aptService, client: aptClient, master: aptMaster } = apt as any;
                        let title = '', body = '';

                        if (isMaster) {
                            if (apt.status === 'pending') { title = 'New Booking Request'; body = `${aptClient?.full_name || 'Client'} requested ${aptService?.name || apt.service_name || 'a service'}`; }
                            else if (apt.status === 'confirmed') { title = 'Booking Confirmed'; body = `Appointment with ${aptClient?.full_name || 'Client'} confirmed`; }
                        } else {
                            if (apt.status === 'confirmed') { title = 'Booking Confirmed'; body = `Your appointment with ${aptMaster?.full_name || 'Specialist'} is confirmed`; }
                            else if (apt.status === 'pending') { title = 'Booking Pending'; body = `Waiting for ${aptMaster?.full_name || 'Specialist'} to confirm`; }
                        }

                        if (title) {
                            allNotifications.push({
                                id: `apt-${apt.id}`, title, body, type: 'booking',
                                read: true, created_at: apt.created_at || new Date().toISOString(),
                            });
                        }
                    }
                }
            } catch (e) { console.log('Appointment notifications error:', e); }

            // 3. Fetch low stock notifications for owners
            if (profile?.role === 'owner' && settings.stockAlerts) {
                try {
                    const { data: lowStockProducts } = await (supabase as any)
                        .from('products').select('id, name, stock_count, low_stock_threshold').eq('is_active', true);
                    if (lowStockProducts) {
                        for (const product of lowStockProducts as any[]) {
                            if (product.stock_count < (product.low_stock_threshold || 5)) {
                                allNotifications.push({
                                    id: `lowstock-${product.id}`,
                                    title: product.stock_count === 0 ? 'Out of Stock' : 'Low Stock Alert',
                                    body: product.stock_count === 0
                                        ? `${product.name} is out of stock!`
                                        : `${product.name} has only ${product.stock_count} units left`,
                                    type: 'low_stock', read: false, created_at: product.updated_at || product.created_at || new Date().toISOString(), productId: product.id,
                                });
                            }
                        }
                    }
                } catch (e) { console.log('Low stock notifications error:', e); }
            }

            allNotifications.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

            // Filter out notifications older than clearedAt
            const activeNotifications = allNotifications.filter(n => new Date(n.created_at).getTime() > clearedAt);

            setNotifications(activeNotifications);
        } catch (error) { console.error('Error fetching notifications:', error); }
        finally { setLoading(false); setRefreshing(false); }
    };

    const onRefresh = () => { setRefreshing(true); fetchNotifications(); };

    const handleNotificationPress = async (notification: Notification) => {
        if (notification.type === 'message' && !notification.read) {
            const msgId = notification.id.replace('msg-', '');
            const updateMessage = async () => {
                try {
                    await (supabase as any).from('messages').update({ read_at: new Date().toISOString() }).eq('id', msgId);
                } catch (e) { console.log('Mark read error:', e); }
            };
            updateMessage();
            setNotifications(prev => prev.map(n => n.id === notification.id ? { ...n, read: true } : n));
        }
        if (notification.type === 'message' && notification.data?.conversationId) {
            navigation.navigate('Messages' as never);
        }
    };

    const markAllAsRead = async () => {
        // Mark messages as read in DB
        const unreadMessages = notifications.filter(n => n.type === 'message' && !n.read);
        if (unreadMessages.length > 0) {
            const messageIds = unreadMessages.map(n => n.id.replace('msg-', ''));
            const updateMessages = async () => {
                try {
                    await (supabase as any).from('messages').update({ read_at: new Date().toISOString() }).in('id', messageIds);
                } catch (e) { /* Ignore */ }
            };
            updateMessages();
        }

        // Save cleared_at time to db to hide everything up to now
        if (user?.id) {
            const now = new Date().toISOString();
            const currentPrefs = profile?.notification_preferences as any || {};
            const updatedPrefs = { ...currentPrefs, cleared_at: now };
            const updateProfiles = async () => {
                try {
                    await supabase.from('profiles').update({ notification_preferences: updatedPrefs }).eq('id', user.id);
                } catch (e) { console.log('Error saving cleared_at:', e); }
            };
            updateProfiles();
        }

        // Clear local UI instantly
        setNotifications([]);
    };

    const toggleSetting = async (key: keyof typeof settings) => {
        const newSettings = { ...settings, [key]: !settings[key] };
        setSettings(newSettings);
        if (user?.id) {
            setSavingSettings(true);
            try {
                const dbPrefs = {
                    push_enabled: newSettings.pushEnabled, booking_reminders: newSettings.bookingReminders,
                    booking_updates: newSettings.bookingUpdates,
                    messages: newSettings.messages,
                    consultations: newSettings.consultations, academy: newSettings.academy,
                    stock_alerts: newSettings.stockAlerts,
                };
                await supabase.from('profiles').update({ notification_preferences: dbPrefs }).eq('id', user.id);
            } catch (e) { console.log('Error saving notification preferences:', e); setSettings(settings); }
            finally { setSavingSettings(false); }
        }
    };

    const unreadCount = notifications.filter(n => !n.read).length;

    if (loading) {
        return (
            <ScreenBackground>
                <SafeAreaView style={styles.container}>
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={colors.primary} />
                    </View>
                </SafeAreaView>
            </ScreenBackground>
        );
    }

    const SettingRow = ({ label, desc, value, onToggle }: { label: string; desc: string; value: boolean; onToggle: () => void }) => (
        <View style={styles.settingRow}>
            <View style={{ flex: 1, marginRight: 12 }}>
                <MerakiText style={styles.settingLabel}>{label}</MerakiText>
                <MerakiText style={styles.settingDesc}>{desc}</MerakiText>
            </View>
            <Switch
                value={value}
                onValueChange={onToggle}
                trackColor={{ false: 'rgba(0, 0, 0, 0.06)', true: 'rgba(200, 160, 77, 0.4)' }}
                thumbColor={value ? colors.primary : 'rgba(0, 0, 0, 0.25)'}
            />
        </View>
    );

    return (
        <ScreenBackground>
            <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity
                        style={styles.backBtn}
                        onPress={handleBack}
                    >
                        <MaterialIcons name="arrow-back" size={22} color="rgba(0, 0, 0, 0.55)" />
                    </TouchableOpacity>
                    <MerakiText style={styles.headerTitle}>Notifications</MerakiText>
                    <TouchableOpacity style={styles.settingsBtn} onPress={() => setShowSettings(!showSettings)}>
                        <MaterialIcons name={showSettings ? 'close' : 'settings'} size={20} color="rgba(0, 0, 0, 0.40)" />
                    </TouchableOpacity>
                </View>

                {/* Unread badge & mark all read */}
                {unreadCount > 0 && !showSettings && (
                    <View style={styles.unreadBar}>
                        <View style={styles.unreadBadge}>
                            <MerakiText style={styles.unreadBadgeText}>{unreadCount} unread</MerakiText>
                        </View>
                        <TouchableOpacity onPress={markAllAsRead}>
                            <MerakiText style={styles.markAllText}>Mark all read</MerakiText>
                        </TouchableOpacity>
                    </View>
                )}

                <ScrollView
                    contentContainerStyle={styles.content}
                    showsVerticalScrollIndicator={false}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
                >
                    {showSettings ? (
                        /* Settings Panel */
                        <View>
                            <MerakiText style={styles.sectionLabel}>NOTIFICATION PREFERENCES</MerakiText>
                            <View style={styles.settingsCard}>
                                <SettingRow label="Push Notifications" desc="Receive push notifications" value={settings.pushEnabled} onToggle={() => toggleSetting('pushEnabled')} />
                                <SettingRow label="Booking Reminders" desc="Reminders before appointments" value={settings.bookingReminders} onToggle={() => toggleSetting('bookingReminders')} />
                                <SettingRow label="Booking Updates" desc="New bookings & cancellations" value={settings.bookingUpdates} onToggle={() => toggleSetting('bookingUpdates')} />
                                <SettingRow label="Messages" desc="New message notifications" value={settings.messages} onToggle={() => toggleSetting('messages')} />
                                <SettingRow label="Consultations" desc="Photo consultation updates" value={settings.consultations} onToggle={() => toggleSetting('consultations')} />
                                <SettingRow label="Academy" desc="Submission & feedback alerts" value={settings.academy} onToggle={() => toggleSetting('academy')} />
                                {profile?.role === 'owner' && (
                                    <SettingRow label="Stock Alerts" desc="Low inventory notifications" value={settings.stockAlerts} onToggle={() => toggleSetting('stockAlerts')} />
                                )}
                            </View>

                        </View>
                    ) : (
                        /* Notifications Feed */
                        <View>
                            {notifications.length > 0 ? (
                                notifications.map((notification) => {
                                    const iconConfig = NOTIFICATION_ICONS[notification.type] || { name: 'notifications', color: '#6B7280' };
                                    return (
                                        <TouchableOpacity
                                            key={notification.id}
                                            style={[styles.notifCard, !notification.read && styles.notifUnread]}
                                            onPress={() => handleNotificationPress(notification)}
                                            activeOpacity={0.7}
                                        >
                                            <View style={[styles.notifIconWrap, { backgroundColor: `${iconConfig.color}15` }]}>
                                                <MaterialIcons name={iconConfig.name as any} size={22} color={iconConfig.color} />
                                            </View>
                                            <View style={styles.notifContent}>
                                                <MerakiText style={styles.notifTitle}>{notification.title}</MerakiText>
                                                <MerakiText style={styles.notifBody} numberOfLines={2}>{notification.body}</MerakiText>
                                                <MerakiText style={styles.notifTime}>
                                                    {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                                                </MerakiText>
                                            </View>
                                            {!notification.read && <View style={styles.unreadDot} />}
                                        </TouchableOpacity>
                                    );
                                })
                            ) : (
                                <View style={styles.emptyState}>
                                    <View style={styles.emptyIconWrap}>
                                        <MaterialIcons name="notifications-none" size={48} color="rgba(0, 0, 0, 0.10)" />
                                    </View>
                                    <MerakiText style={styles.emptyTitle}>No notifications yet</MerakiText>
                                    <MerakiText style={styles.emptyDesc}>
                                        When you receive bookings, messages, or updates, they'll appear here.
                                    </MerakiText>
                                </View>
                            )}
                        </View>
                    )}
                </ScrollView>
            </SafeAreaView>
        </ScreenBackground>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    content: { paddingHorizontal: 20, paddingBottom: 40 },

    // Header
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 20, paddingVertical: 14,
    },
    backBtn: {
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: 'rgba(0, 0, 0, 0.03)',
        borderWidth: 1, borderColor: 'rgba(0, 0, 0, 0.06)',
        alignItems: 'center', justifyContent: 'center',
    },
    headerTitle: { fontSize: 17, fontWeight: '600', color: '#1A1A1A' },
    settingsBtn: {
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: 'rgba(0, 0, 0, 0.03)',
        borderWidth: 1, borderColor: 'rgba(0, 0, 0, 0.06)',
        alignItems: 'center', justifyContent: 'center',
    },

    // Unread bar
    unreadBar: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 20, paddingBottom: 12,
    },
    unreadBadge: {
        backgroundColor: 'rgba(200, 160, 77, 0.15)',
        paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12,
    },
    unreadBadgeText: { fontSize: 12, fontWeight: '700', color: colors.primary },
    markAllText: { fontSize: 13, color: 'rgba(0, 0, 0, 0.35)', fontWeight: '500' },

    // Section label
    sectionLabel: {
        fontSize: 11, fontWeight: '700', color: 'rgba(0, 0, 0, 0.25)',
        letterSpacing: 1.5, marginBottom: 12, marginTop: 4,
    },

    // Settings
    settingsCard: {
        backgroundColor: 'rgba(0, 0, 0, 0.03)',
        borderRadius: 16, borderWidth: 1, borderColor: 'rgba(0, 0, 0, 0.06)',
        overflow: 'hidden',
    },
    settingRow: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        padding: 16,
        borderBottomWidth: 1, borderBottomColor: 'rgba(0, 0, 0, 0.03)',
    },
    settingLabel: { fontSize: 14, fontWeight: '600', color: '#1A1A1A' },
    settingDesc: { fontSize: 11, color: 'rgba(0, 0, 0, 0.25)', marginTop: 2 },

    // Notification Card
    notifCard: {
        flexDirection: 'row', alignItems: 'flex-start',
        backgroundColor: 'rgba(0, 0, 0, 0.02)',
        borderRadius: 14, padding: 14, marginBottom: 8,
        borderWidth: 1, borderColor: 'rgba(0, 0, 0, 0.04)',
        gap: 12,
    },
    notifUnread: {
        backgroundColor: 'rgba(0, 0, 0, 0.05)',
        borderColor: 'rgba(200, 160, 77, 0.15)',
    },
    notifIconWrap: {
        width: 40, height: 40, borderRadius: 12,
        alignItems: 'center', justifyContent: 'center',
    },
    notifContent: { flex: 1 },
    notifTitle: { fontSize: 14, fontWeight: '600', color: '#1A1A1A', marginBottom: 3 },
    notifBody: { fontSize: 12, color: 'rgba(0, 0, 0, 0.40)', lineHeight: 17 },
    notifTime: { fontSize: 11, color: 'rgba(0, 0, 0, 0.12)', marginTop: 5 },
    unreadDot: {
        width: 8, height: 8, borderRadius: 4,
        backgroundColor: colors.primary, marginTop: 6,
    },

    // Empty State
    emptyState: { alignItems: 'center', paddingTop: 60 },
    emptyIconWrap: {
        width: 80, height: 80, borderRadius: 40,
        backgroundColor: 'rgba(0, 0, 0, 0.03)',
        alignItems: 'center', justifyContent: 'center', marginBottom: 20,
    },
    emptyTitle: { fontSize: 17, fontWeight: '600', color: '#1A1A1A', marginBottom: 8 },
    emptyDesc: { fontSize: 13, color: 'rgba(0, 0, 0, 0.25)', textAlign: 'center', maxWidth: 260 },
});

export default NotificationsScreen;
