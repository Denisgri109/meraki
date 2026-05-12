import React, { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useModal } from '../../contexts/ModalContext';
import { Button, Card, ScreenBackground } from '../../components/ui';
import { colors, spacing } from '../../theme';
import { Service, Tables, TablesInsert } from '../../types/database';

type RouteParams = {
    PilatesTimetable: { service: Service };
};

type PilatesHost = Tables<'pilates_hosts'>;
type PilatesTemplate = Tables<'pilates_schedule_templates'>;
type PilatesSessionRow = Tables<'pilates_class_sessions'>;
type PilatesBooking = Pick<Tables<'pilates_session_bookings'>, 'id' | 'status'>;
type PilatesSession = PilatesSessionRow & {
    host: PilatesHost | null;
    pilates_session_bookings: PilatesBooking[] | null;
};
type HostProfile = Pick<Tables<'profiles'>, 'id' | 'full_name' | 'role'>;

const DAYS = [
    { value: 0, label: 'Sun' },
    { value: 1, label: 'Mon' },
    { value: 2, label: 'Tue' },
    { value: 3, label: 'Wed' },
    { value: 4, label: 'Thu' },
    { value: 5, label: 'Fri' },
    { value: 6, label: 'Sat' },
];
const LEVELS = ['Beginner', 'Intermediate', 'Advanced', 'All levels'];
const todayDate = () => new Date().toISOString().slice(0, 10);
const endDate = () => new Date(Date.now() + 35 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
const plusDaysIso = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

export function PilatesTimetableScreen() {
    const navigation = useNavigation<any>();
    const route = useRoute<RouteProp<RouteParams, 'PilatesTimetable'>>();
    const service = route.params.service;
    const { user } = useAuth();
    const { showAlert } = useModal();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [hosts, setHosts] = useState<PilatesHost[]>([]);
    const [hostProfiles, setHostProfiles] = useState<HostProfile[]>([]);
    const [templates, setTemplates] = useState<PilatesTemplate[]>([]);
    const [sessions, setSessions] = useState<PilatesSession[]>([]);
    const [selectedProfileId, setSelectedProfileId] = useState('');
    const [hostName, setHostName] = useState('');
    const [templateForm, setTemplateForm] = useState({
        day_of_week: 1,
        start_time: '18:00',
        host_id: '',
        capacity: '6',
        duration_minutes: '50',
        level: 'All levels',
        starts_on: todayDate(),
        notes: '',
    });
    const [settingsForm, setSettingsForm] = useState({
        default_capacity: '6',
        default_session_duration_minutes: '50',
        buffer_minutes: '10',
        equipment_provided: true,
        require_health_declaration: true,
        default_level: 'All levels',
        equipment_notes: '',
        location_notes: '',
    });
    const [editingSession, setEditingSession] = useState<PilatesSession | null>(null);
    const [sessionForm, setSessionForm] = useState({ host_id: '', capacity: '6', level: 'All levels', status: 'scheduled', notes: '' });

    const groupedSessions = useMemo(() => {
        return sessions.reduce<Record<string, PilatesSession[]>>((acc, session) => {
            const date = new Date(session.starts_at);
            const key = date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
            acc[key] = [...(acc[key] || []), session];
            return acc;
        }, {});
    }, [sessions]);

    useEffect(() => {
        loadData();
    }, [service.id, user?.id]);

    const loadData = async () => {
        if (!user?.id) return;
        setLoading(true);
        try {
            await supabase.rpc('ensure_pilates_sessions', {
                p_service_id: service.id,
                p_start_date: todayDate(),
                p_end_date: endDate(),
            });

            const [hostsRes, profilesRes, templatesRes, settingsRes, sessionsRes] = await Promise.all([
                supabase.from('pilates_hosts').select('*').eq('owner_id', user.id).order('display_name'),
                supabase.from('profiles').select('id, full_name, role').in('role', ['owner', 'master']).order('full_name'),
                supabase.from('pilates_schedule_templates').select('*').eq('service_id', service.id).order('day_of_week').order('start_time'),
                supabase.from('pilates_settings').select('*').eq('service_id', service.id).maybeSingle(),
                supabase
                    .from('pilates_class_sessions')
                    .select('*, host:pilates_hosts(*), pilates_session_bookings(id, status)')
                    .eq('service_id', service.id)
                    .gte('starts_at', new Date().toISOString())
                    .lt('starts_at', plusDaysIso(35))
                    .order('starts_at'),
            ]);

            if (hostsRes.error) throw hostsRes.error;
            if (profilesRes.error) throw profilesRes.error;
            if (templatesRes.error) throw templatesRes.error;
            if (settingsRes.error) throw settingsRes.error;
            if (sessionsRes.error) throw sessionsRes.error;

            setHosts(hostsRes.data || []);
            setHostProfiles((profilesRes.data as HostProfile[]) || []);
            setTemplates(templatesRes.data || []);
            setSessions((sessionsRes.data as unknown as PilatesSession[]) || []);

            if (settingsRes.data) {
                const settings = settingsRes.data;
                setSettingsForm({
                    default_capacity: String(settings.default_capacity),
                    default_session_duration_minutes: String(settings.default_session_duration_minutes),
                    buffer_minutes: String(settings.buffer_minutes),
                    equipment_provided: settings.equipment_provided,
                    require_health_declaration: settings.require_health_declaration,
                    default_level: settings.default_level,
                    equipment_notes: settings.equipment_notes || '',
                    location_notes: settings.location_notes || '',
                });
                setTemplateForm(prev => ({
                    ...prev,
                    capacity: String(settings.default_capacity),
                    duration_minutes: String(settings.default_session_duration_minutes),
                    level: settings.default_level,
                }));
            }
        } catch (error: any) {
            showAlert('Error', error.message || 'Failed to load Pilates timetable', 'error');
        } finally {
            setLoading(false);
        }
    };

    const saveSettings = async () => {
        if (!user?.id) return;
        setSaving(true);
        try {
            const { error } = await supabase.from('pilates_settings').upsert({
                owner_id: user.id,
                service_id: service.id,
                default_capacity: Number(settingsForm.default_capacity),
                default_session_duration_minutes: Number(settingsForm.default_session_duration_minutes),
                buffer_minutes: Number(settingsForm.buffer_minutes),
                equipment_provided: settingsForm.equipment_provided,
                require_health_declaration: settingsForm.require_health_declaration,
                default_level: settingsForm.default_level,
                equipment_notes: settingsForm.equipment_notes.trim() || null,
                location_notes: settingsForm.location_notes.trim() || null,
            }, { onConflict: 'service_id' });
            if (error) throw error;
            showAlert('Saved', 'Pilates details saved.', 'success');
            loadData();
        } catch (error: any) {
            showAlert('Error', error.message || 'Failed to save details', 'error');
        } finally {
            setSaving(false);
        }
    };

    const createHost = async () => {
        if (!user?.id) return;
        const profile = hostProfiles.find(item => item.id === selectedProfileId);
        const displayName = profile?.full_name || hostName.trim();
        if (!displayName) {
            showAlert('Missing Host', 'Choose a profile or enter a host name.', 'error');
            return;
        }
        setSaving(true);
        try {
            const { error } = await supabase.from('pilates_hosts').insert({
                owner_id: user.id,
                profile_id: profile?.id || null,
                display_name: displayName,
            });
            if (error) throw error;
            setSelectedProfileId('');
            setHostName('');
            loadData();
        } catch (error: any) {
            showAlert('Error', error.message || 'Failed to add host', 'error');
        } finally {
            setSaving(false);
        }
    };

    const createTemplate = async () => {
        if (!user?.id) return;
        if (!templateForm.host_id) {
            showAlert('Missing Host', 'Choose a host for this slot.', 'error');
            return;
        }
        setSaving(true);
        try {
            const payload: TablesInsert<'pilates_schedule_templates'> = {
                owner_id: user.id,
                service_id: service.id,
                host_id: templateForm.host_id,
                day_of_week: Number(templateForm.day_of_week),
                start_time: templateForm.start_time,
                duration_minutes: Number(templateForm.duration_minutes),
                capacity: Number(templateForm.capacity),
                level: templateForm.level,
                starts_on: templateForm.starts_on || todayDate(),
                notes: templateForm.notes.trim() || null,
                is_active: true,
            };
            const { error } = await supabase.from('pilates_schedule_templates').insert(payload);
            if (error) throw error;
            setTemplateForm(prev => ({ ...prev, notes: '' }));
            loadData();
        } catch (error: any) {
            showAlert('Error', error.message || 'Failed to add weekly class', 'error');
        } finally {
            setSaving(false);
        }
    };

    const toggleTemplate = async (template: PilatesTemplate) => {
        setSaving(true);
        try {
            const { error } = await supabase
                .from('pilates_schedule_templates')
                .update({ is_active: !template.is_active })
                .eq('id', template.id);
            if (error) throw error;
            loadData();
        } catch (error: any) {
            showAlert('Error', error.message || 'Failed to update weekly class', 'error');
        } finally {
            setSaving(false);
        }
    };

    const openSession = (session: PilatesSession) => {
        setEditingSession(session);
        setSessionForm({
            host_id: session.host_id || '',
            capacity: String(session.capacity),
            level: session.level,
            status: session.status,
            notes: session.notes || '',
        });
    };

    const saveSession = async () => {
        if (!editingSession) return;
        setSaving(true);
        try {
            const { error } = await supabase
                .from('pilates_class_sessions')
                .update({
                    host_id: sessionForm.host_id || null,
                    capacity: Number(sessionForm.capacity),
                    level: sessionForm.level,
                    status: sessionForm.status,
                    notes: sessionForm.notes.trim() || null,
                    is_override: true,
                })
                .eq('id', editingSession.id);
            if (error) throw error;
            setEditingSession(null);
            loadData();
        } catch (error: any) {
            showAlert('Error', error.message || 'Failed to update session', 'error');
        } finally {
            setSaving(false);
        }
    };

    const bookedCount = (session: PilatesSession) => session.pilates_session_bookings?.filter(item => item.status === 'booked').length || 0;

    if (loading) {
        return (
            <ScreenBackground>
                <SafeAreaView style={styles.center}>
                    <ActivityIndicator size="large" color={colors.text} />
                </SafeAreaView>
            </ScreenBackground>
        );
    }

    return (
        <ScreenBackground>
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <MaterialIcons name="arrow-back" size={22} color={colors.text} />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.title}>Pilates Timetable</Text>
                        <Text style={styles.subtitle}>{service.name}</Text>
                    </View>
                </View>

                <ScrollView contentContainerStyle={styles.content}>
                    <Card style={styles.section}>
                        <Text style={styles.sectionTitle}>Class Details</Text>
                        <View style={styles.row}>
                            <TextInput style={[styles.input, styles.half]} value={settingsForm.default_capacity} onChangeText={(v) => setSettingsForm({ ...settingsForm, default_capacity: v })} placeholder="Capacity" keyboardType="number-pad" />
                            <TextInput style={[styles.input, styles.half]} value={settingsForm.default_session_duration_minutes} onChangeText={(v) => setSettingsForm({ ...settingsForm, default_session_duration_minutes: v })} placeholder="Minutes" keyboardType="number-pad" />
                        </View>
                        <View style={styles.chipRow}>{LEVELS.map(level => <TouchableOpacity key={level} style={[styles.chip, settingsForm.default_level === level && styles.chipActive]} onPress={() => setSettingsForm({ ...settingsForm, default_level: level })}><Text style={[styles.chipText, settingsForm.default_level === level && styles.chipTextActive]}>{level}</Text></TouchableOpacity>)}</View>
                        <TextInput style={[styles.input, styles.textArea]} value={settingsForm.equipment_notes} onChangeText={(v) => setSettingsForm({ ...settingsForm, equipment_notes: v })} placeholder="Equipment notes" multiline />
                        <TextInput style={[styles.input, styles.textArea]} value={settingsForm.location_notes} onChangeText={(v) => setSettingsForm({ ...settingsForm, location_notes: v })} placeholder="Location notes" multiline />
                        <View style={styles.switchRow}><Text style={styles.switchText}>Equipment provided</Text><Switch value={settingsForm.equipment_provided} onValueChange={(v) => setSettingsForm({ ...settingsForm, equipment_provided: v })} /></View>
                        <View style={styles.switchRow}><Text style={styles.switchText}>Health declaration</Text><Switch value={settingsForm.require_health_declaration} onValueChange={(v) => setSettingsForm({ ...settingsForm, require_health_declaration: v })} /></View>
                        <Button title={saving ? 'Saving...' : 'Save Details'} onPress={saveSettings} disabled={saving} />
                    </Card>

                    <Card style={styles.section}>
                        <Text style={styles.sectionTitle}>Hosts</Text>
                        <View style={styles.chipRow}>{hostProfiles.map(profile => <TouchableOpacity key={profile.id} style={[styles.chip, selectedProfileId === profile.id && styles.chipActive]} onPress={() => { setSelectedProfileId(profile.id); setHostName(''); }}><Text style={[styles.chipText, selectedProfileId === profile.id && styles.chipTextActive]}>{profile.full_name || 'Unnamed'}</Text></TouchableOpacity>)}</View>
                        <TextInput style={styles.input} value={hostName} onChangeText={(v) => { setHostName(v); setSelectedProfileId(''); }} placeholder="Or type external host name" />
                        <Button title="Add Host" onPress={createHost} disabled={saving} />
                        <View style={styles.chipRow}>{hosts.map(host => <View key={host.id} style={styles.hostPill}><Text style={styles.hostPillText}>{host.display_name}</Text></View>)}</View>
                    </Card>

                    <Card style={styles.section}>
                        <Text style={styles.sectionTitle}>Add Weekly Class</Text>
                        <View style={styles.chipRow}>{DAYS.map(day => <TouchableOpacity key={day.value} style={[styles.chip, templateForm.day_of_week === day.value && styles.chipActive]} onPress={() => setTemplateForm({ ...templateForm, day_of_week: day.value })}><Text style={[styles.chipText, templateForm.day_of_week === day.value && styles.chipTextActive]}>{day.label}</Text></TouchableOpacity>)}</View>
                        <View style={styles.row}>
                            <TextInput style={[styles.input, styles.half]} value={templateForm.start_time} onChangeText={(v) => setTemplateForm({ ...templateForm, start_time: v })} placeholder="18:00" />
                            <TextInput style={[styles.input, styles.half]} value={templateForm.capacity} onChangeText={(v) => setTemplateForm({ ...templateForm, capacity: v })} placeholder="Capacity" keyboardType="number-pad" />
                        </View>
                        <View style={styles.chipRow}>{hosts.map(host => <TouchableOpacity key={host.id} style={[styles.chip, templateForm.host_id === host.id && styles.chipActive]} onPress={() => setTemplateForm({ ...templateForm, host_id: host.id })}><Text style={[styles.chipText, templateForm.host_id === host.id && styles.chipTextActive]}>{host.display_name}</Text></TouchableOpacity>)}</View>
                        <View style={styles.chipRow}>{LEVELS.map(level => <TouchableOpacity key={level} style={[styles.chip, templateForm.level === level && styles.chipActive]} onPress={() => setTemplateForm({ ...templateForm, level })}><Text style={[styles.chipText, templateForm.level === level && styles.chipTextActive]}>{level}</Text></TouchableOpacity>)}</View>
                        <View style={styles.row}>
                            <TextInput style={[styles.input, styles.half]} value={templateForm.duration_minutes} onChangeText={(v) => setTemplateForm({ ...templateForm, duration_minutes: v })} placeholder="Minutes" keyboardType="number-pad" />
                            <TextInput style={[styles.input, styles.half]} value={templateForm.starts_on} onChangeText={(v) => setTemplateForm({ ...templateForm, starts_on: v })} placeholder="YYYY-MM-DD" />
                        </View>
                        <TextInput style={[styles.input, styles.textArea]} value={templateForm.notes} onChangeText={(v) => setTemplateForm({ ...templateForm, notes: v })} placeholder="Notes" multiline />
                        <Button title="Add Weekly Class" onPress={createTemplate} disabled={saving} />
                    </Card>

                    <Card style={styles.section}>
                        <Text style={styles.sectionTitle}>Weekly Timetable</Text>
                        {templates.map(template => {
                            const host = hosts.find(item => item.id === template.host_id);
                            return (
                                <View key={template.id} style={styles.templateCard}>
                                    <View>
                                        <Text style={styles.templateTitle}>{DAYS.find(day => day.value === template.day_of_week)?.label} · {template.start_time.slice(0, 5)}</Text>
                                        <Text style={styles.templateMeta}>{host?.display_name || 'No host'} · {template.capacity} spots · {template.level}</Text>
                                    </View>
                                    <Switch value={template.is_active} onValueChange={() => toggleTemplate(template)} />
                                </View>
                            );
                        })}
                        {templates.length === 0 && <Text style={styles.emptyText}>No weekly classes yet.</Text>}
                    </Card>

                    <Card style={styles.section}>
                        <Text style={styles.sectionTitle}>Upcoming Sessions</Text>
                        {Object.entries(groupedSessions).map(([dateLabel, items]) => (
                            <View key={dateLabel} style={styles.dayGroup}>
                                <Text style={styles.dayTitle}>{dateLabel}</Text>
                                {items.map(session => {
                                    const count = bookedCount(session);
                                    const full = count >= session.capacity;
                                    return (
                                        <TouchableOpacity key={session.id} style={[styles.sessionCard, session.status === 'cancelled' && styles.cancelledCard, full && styles.fullCard]} onPress={() => openSession(session)}>
                                            <View>
                                                <Text style={styles.sessionTime}>{new Date(session.starts_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                                                <Text style={styles.templateMeta}>{session.host?.display_name || 'No host'} · {session.level}</Text>
                                            </View>
                                            <Text style={styles.spotsText}>{count}/{session.capacity}</Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        ))}
                        {sessions.length === 0 && <Text style={styles.emptyText}>No upcoming sessions yet.</Text>}
                    </Card>
                </ScrollView>

                {editingSession && (
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalCard}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.sectionTitle}>Edit Session</Text>
                                <TouchableOpacity onPress={() => setEditingSession(null)}><MaterialIcons name="close" size={22} color={colors.text} /></TouchableOpacity>
                            </View>
                            <View style={styles.chipRow}>{hosts.map(host => <TouchableOpacity key={host.id} style={[styles.chip, sessionForm.host_id === host.id && styles.chipActive]} onPress={() => setSessionForm({ ...sessionForm, host_id: host.id })}><Text style={[styles.chipText, sessionForm.host_id === host.id && styles.chipTextActive]}>{host.display_name}</Text></TouchableOpacity>)}</View>
                            <TextInput style={styles.input} value={sessionForm.capacity} onChangeText={(v) => setSessionForm({ ...sessionForm, capacity: v })} keyboardType="number-pad" placeholder="Capacity" />
                            <View style={styles.chipRow}>{LEVELS.map(level => <TouchableOpacity key={level} style={[styles.chip, sessionForm.level === level && styles.chipActive]} onPress={() => setSessionForm({ ...sessionForm, level })}><Text style={[styles.chipText, sessionForm.level === level && styles.chipTextActive]}>{level}</Text></TouchableOpacity>)}</View>
                            <View style={styles.chipRow}>{['scheduled', 'cancelled'].map(status => <TouchableOpacity key={status} style={[styles.chip, sessionForm.status === status && styles.chipActive]} onPress={() => setSessionForm({ ...sessionForm, status })}><Text style={[styles.chipText, sessionForm.status === status && styles.chipTextActive]}>{status}</Text></TouchableOpacity>)}</View>
                            <TextInput style={[styles.input, styles.textArea]} value={sessionForm.notes} onChangeText={(v) => setSessionForm({ ...sessionForm, notes: v })} placeholder="Override notes" multiline />
                            <Button title="Save Session" onPress={saveSession} disabled={saving} />
                        </View>
                    </View>
                )}
            </SafeAreaView>
        </ScreenBackground>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, paddingBottom: spacing.md },
    backButton: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.04)', alignItems: 'center', justifyContent: 'center' },
    title: { fontSize: 22, fontWeight: '700', color: colors.text },
    subtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
    content: { padding: spacing.lg, paddingTop: 0, paddingBottom: 40 },
    section: { marginBottom: spacing.lg, padding: spacing.lg },
    sectionTitle: { fontSize: 14, fontWeight: '700', color: colors.text, textTransform: 'uppercase', letterSpacing: 1, marginBottom: spacing.md },
    row: { flexDirection: 'row', gap: spacing.md },
    half: { flex: 1 },
    input: { borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingHorizontal: spacing.md, paddingVertical: 12, color: colors.text, marginBottom: spacing.md, backgroundColor: 'rgba(255,255,255,0.7)' },
    textArea: { minHeight: 74, textAlignVertical: 'top' },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.md },
    chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.05)' },
    chipActive: { backgroundColor: '#10B981' },
    chipText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
    chipTextActive: { color: '#FFFFFF' },
    hostPill: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: '#ECFDF5' },
    hostPillText: { color: '#047857', fontWeight: '700', fontSize: 12 },
    switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
    switchText: { color: colors.text, fontWeight: '600' },
    templateCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, borderRadius: 16, backgroundColor: '#F0FDF4', marginBottom: spacing.sm },
    templateTitle: { fontWeight: '800', color: colors.text, marginBottom: 2 },
    templateMeta: { color: colors.textSecondary, fontSize: 12 },
    emptyText: { color: colors.textSecondary, textAlign: 'center', paddingVertical: spacing.md },
    dayGroup: { marginBottom: spacing.md },
    dayTitle: { color: colors.textSecondary, fontWeight: '800', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, marginBottom: spacing.sm },
    sessionCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, borderRadius: 16, borderWidth: 1, borderColor: '#DDD6FE', backgroundColor: '#F5F3FF', marginBottom: spacing.sm },
    cancelledCard: { opacity: 0.45, backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
    fullCard: { opacity: 0.6 },
    sessionTime: { fontSize: 17, fontWeight: '800', color: colors.text, marginBottom: 2 },
    spotsText: { fontWeight: '800', color: '#047857' },
    modalOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
    modalCard: { width: '100%', borderRadius: 24, backgroundColor: '#FFFFFF', padding: spacing.lg },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
});

export default PilatesTimetableScreen;
