// T11 — Owner AddToBooking: pilates session list or beauty (service → master → date → slots)
// then owner_book_for_client via clientManagementService (T08) with client notification.

import React, { useCallback, useEffect, useState } from 'react';
import { View, ScrollView, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import { useAuth } from '../../contexts/AuthContext';
import { useModal } from '../../contexts/ModalContext';
import { ScreenBackground, MerakiText, Card } from '../../components/ui';
import { colors, spacing } from '../../theme';
import { safeGoBack } from '../../navigation/navigationUtils';
import { supabase } from '../../lib/supabase';
import { addClientToPilatesSession, addClientToBeautyAppointment } from '../../services/clientManagementService';

type Params = { AddToBooking: { clientId: string } };
type Tab = 'pilates' | 'beauty';

interface SessionOption {
    id: string;
    starts_at: string;
    capacity: number;
    booked: number;
    service_name: string;
    base_price: number | null;
}
interface ServiceOption { id: string; name: string; duration_minutes: number | null; base_price: number | null; }
interface MasterOption { id: string; full_name: string | null; }
interface SlotOption { slot_start: string; }

export function AddToBookingScreen() {
    const navigation = useNavigation<any>();
    const route = useRoute<RouteProp<Params, 'AddToBooking'>>();
    const { clientId } = route.params;
    const { user, profile } = useAuth();
    const { showAlert } = useModal();
    const isOwner = profile?.role === 'owner';

    const [tab, setTab] = useState<Tab>('pilates');
    const [notes, setNotes] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const [clientName, setClientName] = useState<string>('');

    // Pilatessessions w/ booked counts
    const [sessions, setSessions] = useState<SessionOption[]>([]);
    const [selectedSession, setSelectedSession] = useState<SessionOption | null>(null);

    // Beauty
    const [services, setServices] = useState<ServiceOption[]>([]);
    const [masters, setMasters] = useState<MasterOption[]>([]);
    const [serviceId, setServiceId] = useState<string>('');
    const [masterId, setMasterId] = useState<string>('');
    const [date, setDate] = useState<Date | null>(null);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [slots, setSlots] = useState<SlotOption[]>([]);
    const [slotsLoading, setSlotsLoading] = useState(false);
    const [selectedSlot, setSelectedSlot] = useState<string>('');

    const loadBasics = useCallback(async () => {
        const { data: client } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', clientId)
            .maybeSingle();
        setClientName((client as any)?.full_name || 'Client');

        const { data: raw } = await supabase
            .from('pilates_class_sessions')
            .select('id, starts_at, capacity, service:services(name, base_price)')
            .eq('status', 'scheduled')
            .gt('starts_at', new Date().toISOString())
            .order('starts_at', { ascending: true })
            .limit(40);
        const rows = (raw || []) as unknown as Array<{ id: string; starts_at: string; capacity: number; service: { name: string; base_price: number | null } | null }>;
        if (rows.length) {
            const ids = rows.map(r => r.id);
            const { data: bookings } = await supabase
                .from('pilates_session_bookings')
                .select('session_id')
                .in('session_id', ids)
                .eq('status', 'booked');
            const counts = new Map<string, number>();
            for (const b of (bookings || []) as Array<{ session_id: string }>) {
                counts.set(b.session_id, (counts.get(b.session_id) || 0) + 1);
            }
            setSessions(rows.map(r => ({
                id: r.id,
                starts_at: r.starts_at,
                capacity: r.capacity,
                booked: counts.get(r.id) || 0,
                service_name: r.service?.name || 'Pilates class',
                base_price: r.service?.base_price ?? null,
            })));
        } else {
            setSessions([]);
        }

        const { data: svc } = await supabase.from('services').select('id, name, duration_minutes, base_price').eq('is_active', true).neq('category', 'Pilates').order('name');
        setServices((svc as ServiceOption[]) || []);
    }, [clientId]);

    // Professionals for the chosen service come from master_services (owners who
    // offer services included) — matches how the client booking flow lists them.
    useEffect(() => {
        setMasters([]);
        setMasterId('');
        if (!serviceId) return;
        const loadPros = async () => {
            const { data, error } = await supabase
                .from('master_services')
                .select('master_id, profiles:master_id(id, full_name)')
                .eq('service_id', serviceId);
            if (error) { console.warn('pros load failed:', error.message); return; }
            const pros = ((data || []) as Array<{ master_id: string; profiles: { id: string; full_name: string | null } | null }>)
                .map(r => ({ id: r.master_id, full_name: r.profiles?.full_name ?? null }));
            setMasters(pros);
            if (pros.length === 1) setMasterId(pros[0].id);
        };
        void loadPros();
    }, [serviceId]);

    useEffect(() => { void loadBasics(); }, [loadBasics]);

    // Beauty slots
    useEffect(() => {
        setSelectedSlot('');
        setSlots([]);
        if (!serviceId || !masterId || !date) return;
        const svc = services.find(s => s.id === serviceId);
        const loadSlots = async () => {
            setSlotsLoading(true);
            try {
                const { data, error } = await supabase.rpc('get_available_slots', {
                    p_date: format(date, 'yyyy-MM-dd'),
                    p_master_id: masterId,
                    p_service_duration: svc?.duration_minutes ?? undefined,
                } as any);
                if (error) throw error;
                setSlots((data as SlotOption[]) || []);
            } catch (e: any) {
                void showAlert(e?.message || 'Could not load available times.', 'Error');
            } finally {
                setSlotsLoading(false);
            }
        };
        void loadSlots();
    }, [serviceId, masterId, date, services]);

    if (!isOwner) {
        return (
            <ScreenBackground>
                <SafeAreaView style={styles.container} edges={['top']}>
                    <View style={styles.header}>
                        <TouchableOpacity onPress={() => safeGoBack(navigation)} style={styles.backButton}>
                            <MaterialIcons name="arrow-back" size={22} color={colors.text} />
                        </TouchableOpacity>
                        <MerakiText style={styles.title}>Add to Booking</MerakiText>
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

    const handleConfirm = async () => {
        if (!user) return;
        setSubmitting(true);
        try {
            if (tab === 'pilates') {
                if (!selectedSession) { await showAlert('Pick a session first.', 'Add to Booking'); return; }
                const res = await addClientToPilatesSession(clientId, selectedSession.id, notes.trim() || undefined, {
                    ownerUserId: user.id,
                    serviceLabel: selectedSession.service_name,
                    startsAt: selectedSession.starts_at,
                });
                if (res.error) { await showAlert(res.error, 'Booking Error'); return; }
                await showAlert(`${clientName} added to ${selectedSession.service_name}.\nConfirmed — pay at venue. The client was notified.`, 'Added');
                safeGoBack(navigation);
            } else {
                if (!serviceId || !masterId || !selectedSlot) { await showAlert('Pick a service, master and time slot.', 'Add to Booking'); return; }
                const svc = services.find(s => s.id === serviceId);
                const res = await addClientToBeautyAppointment(clientId, masterId, serviceId, new Date(selectedSlot).toISOString(), notes.trim() || undefined, {
                    ownerUserId: user.id,
                    serviceLabel: svc?.name || 'appointment',
                });
                if (res.error) { await showAlert(res.error, 'Booking Error'); return; }
                await showAlert(`${clientName} booked for ${svc?.name || 'appointment'}.\nConfirmed — pay at venue. The client was notified.`, 'Added');
                safeGoBack(navigation);
            }
        } catch (e: any) {
            await showAlert(e?.message || 'Booking failed', 'Booking Error');
        } finally {
            setSubmitting(false);
        }
    };

    const canSubmit = !submitting && (tab === 'pilates' ? !!selectedSession : (!!serviceId && !!masterId && !!selectedSlot));

    return (
        <ScreenBackground>
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => safeGoBack(navigation)} style={styles.backButton}>
                        <MaterialIcons name="arrow-back" size={22} color={colors.text} />
                    </TouchableOpacity>
                    <MerakiText style={styles.title} numberOfLines={1}>Add {clientName || 'client'}</MerakiText>
                    <View style={{ width: 40 }} />
                </View>

                <View style={styles.tabRow}>
                    {(['pilates', 'beauty'] as Tab[]).map(t => (
                        <TouchableOpacity key={t} style={[styles.tab, tab === t && styles.tabActive]} onPress={() => setTab(t)}>
                            <MerakiText style={[styles.tabText, tab === t && styles.tabTextActive]}>
                                {t === 'pilates' ? 'Pilates Class' : 'Beauty Appointment'}
                            </MerakiText>
                        </TouchableOpacity>
                    ))}
                </View>
                <MerakiText style={styles.note}>Booking is created confirmed &amp; unpaid — client pays at the venue.</MerakiText>

                <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
                    {tab === 'pilates' ? (
                        sessions.length === 0 ? (
                            <MerakiText style={styles.mutedCenter}>No upcoming scheduled pilates sessions.</MerakiText>
                        ) : (
                            sessions.map(s => {
                                const left = s.capacity - s.booked;
                                const full = left <= 0;
                                const active = selectedSession?.id === s.id;
                                return (
                                    <TouchableOpacity
                                        key={s.id}
                                        disabled={full}
                                        style={[styles.sessionCard, active && styles.sessionCardActive, full && { opacity: 0.4 }]}
                                        onPress={() => setSelectedSession(s)}
                                        activeOpacity={0.8}
                                    >
                                        <View style={{ flex: 1 }}>
                                            <MerakiText style={styles.sessionName}>{s.service_name}</MerakiText>
                                            <MerakiText style={styles.mutedLine}>
                                                {new Date(s.starts_at).toLocaleString('en-IE', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                                {s.base_price != null && ` · €${s.base_price.toFixed(2)}`}
                                            </MerakiText>
                                        </View>
                                        <View style={[styles.spotsChip, full ? styles.spotsFull : styles.spotsOk]}>
                                            <MerakiText style={[styles.spotsChipText, full ? styles.spotsFullText : styles.spotsOkText]}>
                                                {full ? 'FULL' : `${left} left`}
                                            </MerakiText>
                                        </View>
                                    </TouchableOpacity>
                                );
                            })
                        )
                    ) : (
                        <>
                            <MerakiText style={styles.label}>Service</MerakiText>
                            <View style={styles.wrapRow}>
                                {services.map(s => (
                                    <TouchableOpacity key={s.id} style={[styles.pill, serviceId === s.id && styles.pillActive]} onPress={() => setServiceId(s.id)}>
                                        <MerakiText style={[styles.pillText, serviceId === s.id && styles.pillTextActive]}>{s.name}</MerakiText>
                                    </TouchableOpacity>
                                ))}
                            </View>
                            <MerakiText style={styles.label}>Master</MerakiText>
                            <View style={styles.wrapRow}>
                                {masters.length === 0 && serviceId ? (
                                    <MerakiText style={styles.mutedLine}>No professional offers this service.</MerakiText>
                                ) : (
                                    masters.map(m => (
                                        <TouchableOpacity key={m.id} style={[styles.pill, masterId === m.id && styles.pillActive]} onPress={() => setMasterId(m.id)}>
                                            <MerakiText style={[styles.pillText, masterId === m.id && styles.pillTextActive]}>{m.full_name || 'Staff'}</MerakiText>
                                        </TouchableOpacity>
                                    ))
                                )}
                            </View>
                            <MerakiText style={styles.label}>Date</MerakiText>
                            <TouchableOpacity
                                style={styles.dateButton}
                                onPress={() => setShowDatePicker(true)}
                                activeOpacity={0.8}
                            >
                                <MaterialIcons name="event" size={18} color={date ? '#C47888' : colors.textMuted} />
                                <MerakiText style={[styles.dateButtonText, !date && { color: colors.textMuted }]}>
                                    {date ? format(date, "EEEE, d MMM yyyy") : 'Choose date'}
                                </MerakiText>
                            </TouchableOpacity>
                            {showDatePicker && (
                                <DateTimePicker
                                    value={date || new Date()}
                                    mode="date"
                                    display="default"
                                    minimumDate={new Date()}
                                    onChange={(event: any, picked?: Date) => {
                                        setShowDatePicker(false);
                                        if (picked && event?.type !== 'dismissed') setDate(picked);
                                    }}
                                />
                            )}
                            <MerakiText style={styles.label}>
                                {slotsLoading ? 'Finding slots…' : (serviceId && masterId && date ? (slots.length ? 'Available times' : 'No free slots this day') : 'Time')}
                            </MerakiText>
                            <View style={styles.wrapRow}>
                                {slots.map(s => (
                                    <TouchableOpacity key={s.slot_start} style={[styles.pill, selectedSlot === s.slot_start && styles.pillActive]} onPress={() => setSelectedSlot(s.slot_start)}>
                                        <MerakiText style={[styles.pillText, selectedSlot === s.slot_start && styles.pillTextActive]}>
                                            {new Date(s.slot_start).toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit' })}
                                        </MerakiText>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </>
                    )}

                    <MerakiText style={styles.label}>Notes (optional)</MerakiText>
                    <TextInput
                        style={[styles.input, { height: 72, textAlignVertical: 'top', paddingTop: 12 }]}
                        placeholder="Booking notes…"
                        placeholderTextColor={colors.textMuted}
                        value={notes}
                        onChangeText={setNotes}
                        multiline
                    />

                    <TouchableOpacity style={[styles.confirmButton, !canSubmit && { opacity: 0.4 }]} disabled={!canSubmit} onPress={handleConfirm} activeOpacity={0.85}>
                        {submitting ? <ActivityIndicator color="#fff" /> : <MerakiText style={styles.confirmText}>Add to booking</MerakiText>}
                    </TouchableOpacity>
                    <View style={{ height: spacing.xl * 2 }} />
                </ScrollView>
            </SafeAreaView>
        </ScreenBackground>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
    backButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    title: { fontSize: 20, fontWeight: '700', color: colors.text, flexShrink: 1 },
    tabRow: { flexDirection: 'row', gap: 8, paddingHorizontal: spacing.md, marginTop: spacing.xs },
    tab: { flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: colors.inputBackground, alignItems: 'center' },
    tabActive: { backgroundColor: '#000' },
    tabText: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
    tabTextActive: { color: '#fff' },
    note: { fontSize: 11, color: colors.textMuted, paddingHorizontal: spacing.md, marginTop: spacing.xs },
    body: { padding: spacing.md },
    label: { fontSize: 12, fontWeight: '700', color: colors.text, marginTop: spacing.md, marginBottom: 6 },
    mutedLine: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
    mutedCenter: { fontSize: 13, color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl },
    dateButton: {
        flexDirection: 'row', alignItems: 'center', gap: 10,
        backgroundColor: colors.inputBackground, borderRadius: 14,
        paddingHorizontal: 14, height: 48,
    },
    dateButtonText: { fontSize: 14, fontWeight: '600', color: colors.text },
    input: { backgroundColor: colors.inputBackground, borderRadius: 14, paddingHorizontal: 14, height: 48, fontSize: 14, color: colors.text },
    sessionCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.inputBackground, borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1.5, borderColor: 'transparent' },
    sessionCardActive: { borderColor: '#C47888', backgroundColor: 'rgba(196,120,136,0.08)' },
    sessionName: { fontSize: 14, fontWeight: '700', color: colors.text },
    spotsChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
    spotsOk: { backgroundColor: 'rgba(16,185,129,0.12)' },
    spotsFull: { backgroundColor: 'rgba(239,68,68,0.12)' },
    spotsChipText: { fontSize: 10, fontWeight: '700' },
    spotsOkText: { color: '#047857' },
    spotsFullText: { color: '#B91C1C' },
    wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    pill: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, backgroundColor: colors.inputBackground },
    pillActive: { backgroundColor: '#000' },
    pillText: { fontSize: 12, fontWeight: '600', color: colors.text },
    pillTextActive: { color: '#fff' },
    confirmButton: { backgroundColor: '#000', borderRadius: 14, height: 50, alignItems: 'center', justifyContent: 'center', marginTop: spacing.md },
    confirmText: { color: '#fff', fontSize: 15, fontWeight: '700' },
    centerMessage: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
    emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginTop: spacing.sm },
});
