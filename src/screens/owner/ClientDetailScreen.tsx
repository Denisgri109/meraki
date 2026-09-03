// T10 — Owner client detail: contact card, upcoming bookings, passes, waiver chip,
// Message (openConversationWith → Chat), Add to Booking. Owner-only guard.

import React, { useCallback, useState } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute, RouteProp, CommonActions } from '@react-navigation/native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { ScreenBackground, MerakiText, Card } from '../../components/ui';
import { colors, spacing } from '../../theme';
import { safeGoBack } from '../../navigation/navigationUtils';
import {
    getClientDetail,
    openConversationWith,
    CURRENT_WAIVER_TERMS_VERSION,
    DirectoryProfile,
    ClientDetailBundle,
} from '../../services/clientManagementService';
import { supabase } from '../../lib/supabase';

type Params = { ClientDetail: { clientId: string } };

export function ClientDetailScreen() {
    const navigation = useNavigation<any>();
    const route = useRoute<RouteProp<Params, 'ClientDetail'>>();
    const { clientId } = route.params;
    const { user, profile } = useAuth();
    const isOwner = profile?.role === 'owner';

    const [bundle, setBundle] = useState<ClientDetailBundle | null>(null);
    const [loading, setLoading] = useState(true);
    const [messaging, setMessaging] = useState(false);

    const load = useCallback(async () => {
        if (!isOwner) return;
        setLoading(true);
        const { data, error } = await getClientDetail(clientId);
        if (!error) setBundle(data);
        else console.warn('client detail load failed:', error);
        setLoading(false);
    }, [isOwner, clientId]);

    useFocusEffect(useCallback(() => { void load(); }, [load]));

    if (!isOwner) {
        return (
            <ScreenBackground>
                <SafeAreaView style={styles.container} edges={['top']}>
                    <View style={styles.header}>
                        <TouchableOpacity
                            accessibilityRole="button"
                            accessibilityLabel="Go back" onPress={() => safeGoBack(navigation)} style={styles.backButton}>
                            <MaterialIcons name="arrow-back" size={22} color={colors.text} />
                        </TouchableOpacity>
                        <MerakiText style={styles.title}>Client</MerakiText>
                        <View style={{ width: 40 }} />
                    </View>
                    <View style={styles.centerMessage}>
                        <MaterialIcons name="lock-outline" size={48} color={colors.textMuted} />
                        <MerakiText style={styles.emptyTitle}>Restricted</MerakiText>
                    </View>
                </SafeAreaView>
            </ScreenBackground>
        );
    }

    const client = bundle?.profile ?? null;
    const waiverSigned = bundle?.waiver?.terms_version === CURRENT_WAIVER_TERMS_VERSION;

    const handleMessage = async () => {
        if (!user || !client) return;
        setMessaging(true);
        try {
            const { conversationId, error } = await openConversationWith(client.id, user.id);
            if (error || !conversationId) throw new Error(error || 'Failed to open conversation');

            // Look up avatar for the Chat header
            const { data: p } = await supabase
                .from('profiles')
                .select('avatar_url')
                .eq('id', client.id)
                .maybeSingle();

            navigation.dispatch(
                CommonActions.navigate({
                    name: 'Chat',
                    params: {
                        conversationId,
                        otherUser: { full_name: client.full_name, avatar_url: (p as any)?.avatar_url ?? null, id: client.id },
                    },
                })
            );
        } catch (e: any) {
            console.warn('open chat failed:', e?.message);
        } finally {
            setMessaging(false);
        }
    };

    return (
        <ScreenBackground>
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={styles.header}>
                    <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel="Go back" onPress={() => safeGoBack(navigation)} style={styles.backButton}>
                        <MaterialIcons name="arrow-back" size={22} color={colors.text} />
                    </TouchableOpacity>
                    <MerakiText style={styles.title} numberOfLines={1}>{client?.full_name || 'Client'}</MerakiText>
                    <View style={{ width: 40 }} />
                </View>

                {loading && !bundle ? (
                    <View style={styles.centerMessage}><ActivityIndicator color="#C47A90" /></View>
                ) : !client ? (
                    <View style={styles.centerMessage}>
                        <MaterialIcons name="person-off" size={40} color={colors.textMuted} />
                        <MerakiText style={styles.emptyTitle}>Client not found</MerakiText>
                    </View>
                ) : (
                    <ScrollView contentContainerStyle={styles.body}>
                        {/* Contact card */}
                        <Card style={styles.card}>
                            <View style={styles.cardHead}>
                                <View style={styles.avatar}>
                                    <MerakiText style={styles.avatarText}>
                                        {(client.full_name || client.email || '?').charAt(0).toUpperCase()}
                                    </MerakiText>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <MerakiText style={styles.name}>{client.full_name || 'Unnamed'}</MerakiText>
                                    {!!client.email && <MerakiText style={styles.line}>{client.email}</MerakiText>}
                                    {!!client.phone && <MerakiText style={styles.line}>{client.phone}</MerakiText>}
                                    {!!client.created_at && (
                                        <MerakiText style={styles.mutedLine}>
                                            Member since {new Date(client.created_at).toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' })}
                                        </MerakiText>
                                    )}
                                </View>
                            </View>
                            <View style={styles.actionsRow}>
                                <TouchableOpacity style={styles.primaryButton} onPress={handleMessage} disabled={messaging} activeOpacity={0.85}>
                                    {messaging ? <ActivityIndicator color="#fff" /> : (
                                        <>
                                            <MaterialIcons name="chat-bubble-outline" size={16} color="#fff" />
                                            <MerakiText style={styles.primaryButtonText}>Message</MerakiText>
                                        </>
                                    )}
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.secondaryButton}
                                    onPress={() => navigation.navigate('AddToBooking', { clientId: client.id })}
                                    activeOpacity={0.85}
                                >
                                    <MaterialIcons name="event-available" size={16} color="#C47888" />
                                    <MerakiText style={styles.secondaryButtonText}>Add to Booking</MerakiText>
                                </TouchableOpacity>
                            </View>
                        </Card>

                        {/* Waiver status */}
                        <Card style={styles.card}>
                            <View style={styles.rowBetween}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                    <MaterialCommunityIcons
                                        name={waiverSigned ? 'shield-check-outline' : 'shield-alert-outline'}
                                        size={20}
                                        color={waiverSigned ? '#047857' : '#B45309'}
                                    />
                                    <View>
                                        <MerakiText style={styles.sectionTitle}>Pilates Waiver</MerakiText>
                                        <MerakiText style={styles.mutedLine}>
                                            {waiverSigned
                                                ? `Signed (v${bundle?.waiver?.terms_version})${bundle?.waiver?.signed_at ? ` · ${new Date(bundle.waiver.signed_at).toLocaleDateString('en-IE')}` : ''}`
                                                : 'Pending — must sign v3.0 in the app before class'}
                                        </MerakiText>
                                    </View>
                                </View>
                                <View style={[styles.chip, waiverSigned ? styles.chipOk : styles.chipWarn]}>
                                    <MerakiText style={[styles.chipText, waiverSigned ? styles.chipTextOk : styles.chipTextWarn]}>
                                        {waiverSigned ? 'Signed' : 'Pending'}
                                    </MerakiText>
                                </View>
                            </View>
                        </Card>

                        {/* Upcoming bookings */}
                        <Card style={styles.card}>
                            <MerakiText style={styles.sectionTitle}>Upcoming bookings</MerakiText>
                            {bundle?.upcoming?.length ? (
                                bundle.upcoming.map(a => (
                                    <View key={a.id} style={styles.bookingRow}>
                                        <View style={{ flex: 1 }}>
                                            <MerakiText style={styles.bookingName} numberOfLines={1}>{a.service_name || 'Appointment'}</MerakiText>
                                            <MerakiText style={styles.mutedLine}>
                                                {new Date(a.start_time).toLocaleString('en-IE', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                            </MerakiText>
                                        </View>
                                        <View style={{ alignItems: 'flex-end' }}>
                                            <MerakiText style={styles.bookingPrice}>€{(a.price ?? 0).toFixed(2)}</MerakiText>
                                            <MerakiText style={styles.bookingStatus}>{a.status}</MerakiText>
                                        </View>
                                    </View>
                                ))
                            ) : (
                                <MerakiText style={styles.mutedLine}>No upcoming bookings.</MerakiText>
                            )}
                        </Card>

                        {/* Passes */}
                        <Card style={[styles.card, { marginBottom: spacing.xl * 2 }]}>
                            <MerakiText style={styles.sectionTitle}>Class passes</MerakiText>
                            {bundle?.passes?.length ? (
                                bundle.passes.map((p, i) => (
                                    <View key={i} style={styles.bookingRow}>
                                        <MerakiText style={styles.bookingName}>{p.name}</MerakiText>
                                        <MerakiText style={styles.mutedLine}>
                                            {p.remaining_credits}/{p.initial_credits} left
                                            {p.expires_at ? ` · exp ${new Date(p.expires_at).toLocaleDateString('en-IE')}` : ''}
                                        </MerakiText>
                                    </View>
                                ))
                            ) : (
                                <MerakiText style={styles.mutedLine}>No active passes.</MerakiText>
                            )}
                        </Card>
                    </ScrollView>
                )}
            </SafeAreaView>
        </ScreenBackground>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
    backButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    title: { fontSize: 20, fontWeight: '700', color: colors.text, flexShrink: 1 },
    centerMessage: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
    emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginTop: spacing.sm },
    body: { padding: spacing.md },
    card: { marginBottom: spacing.md, padding: spacing.md },
    cardHead: { flexDirection: 'row', gap: 14, alignItems: 'center' },
    avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#C47A90', alignItems: 'center', justifyContent: 'center' },
    avatarText: { color: '#fff', fontSize: 20, fontWeight: '700' },
    name: { fontSize: 18, fontWeight: '700', color: colors.text },
    line: { fontSize: 13, color: colors.text, marginTop: 2 },
    mutedLine: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
    actionsRow: { flexDirection: 'row', gap: 10, marginTop: spacing.md },
    primaryButton: { flex: 1, backgroundColor: '#000', borderRadius: 12, height: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
    primaryButtonText: { color: '#fff', fontSize: 14, fontWeight: '700' },
    secondaryButton: { flex: 1, backgroundColor: 'rgba(196,120,136,0.10)', borderRadius: 12, height: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: 'rgba(196,120,136,0.35)' },
    secondaryButtonText: { color: '#C47888', fontSize: 14, fontWeight: '700' },
    sectionTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
    rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
    chipOk: { backgroundColor: 'rgba(16,185,129,0.12)' },
    chipWarn: { backgroundColor: 'rgba(245,158,11,0.15)' },
    chipText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
    chipTextOk: { color: '#047857' },
    chipTextWarn: { color: '#B45309' },
    bookingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(0,0,0,0.08)' },
    bookingName: { fontSize: 14, fontWeight: '600', color: colors.text },
    bookingPrice: { fontSize: 14, fontWeight: '700', color: colors.text },
    bookingStatus: { fontSize: 10, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', marginTop: 2 },
});
