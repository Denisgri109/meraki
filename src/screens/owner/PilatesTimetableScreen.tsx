import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
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

type TabId = 'schedule' | 'sessions' | 'instructors' | 'settings';

const TABS: { id: TabId; label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }[] = [
    { id: 'schedule', label: 'Schedule', icon: 'calendar-month-outline' },
    { id: 'sessions', label: 'Sessions', icon: 'clock-outline' },
    { id: 'instructors', label: 'Hosts', icon: 'account-group-outline' },
    { id: 'settings', label: 'Settings', icon: 'cog-outline' },
];

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
    const { showAlert, showConfirm } = useModal();

    const [activeTab, setActiveTab] = useState<TabId>('schedule');
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
        operating_days: [0, 1, 2, 3, 4, 5, 6] as number[],
    });
    const [editingSession, setEditingSession] = useState<PilatesSession | null>(null);
    const [sessionForm, setSessionForm] = useState({ host_id: '', capacity: '6', level: 'All levels', status: 'scheduled', notes: '' });

    const [editingTemplate, setEditingTemplate] = useState<PilatesTemplate | null>(null);
    const [editTemplateForm, setEditTemplateForm] = useState({
        day_of_week: 1,
        start_time: '18:00',
        host_id: '',
        capacity: '6',
        duration_minutes: '50',
        level: 'All levels',
        starts_on: todayDate(),
        notes: '',
    });
    const [editingHost, setEditingHost] = useState<PilatesHost | null>(null);
    const [editHostForm, setEditHostForm] = useState({
        display_name: '',
        is_active: true,
    });

    const groupedSessions = useMemo(() => {
        return sessions.reduce<Record<string, PilatesSession[]>>((acc, session) => {
            const date = new Date(session.starts_at);
            const key = date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
            acc[key] = [...(acc[key] || []), session];
            return acc;
        }, {});
    }, [sessions]);

    const bookedCount = (session: PilatesSession) => session.pilates_session_bookings?.filter(item => item.status === 'booked').length || 0;

    const upcomingCount = useMemo(() => sessions.filter(s => s.status !== 'cancelled').length, [sessions]);
    const activeTemplateCount = useMemo(() => templates.filter(t => t.is_active).length, [templates]);
    const bookingCount = useMemo(
        () => sessions.reduce((acc, s) => acc + (s.pilates_session_bookings?.filter(b => b.status === 'booked').length || 0), 0),
        [sessions],
    );

    const loadData = useCallback(async () => {
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
                const settings = settingsRes.data as Tables<'pilates_settings'>;
                setSettingsForm({
                    default_capacity: String(settings.default_capacity),
                    default_session_duration_minutes: String(settings.default_session_duration_minutes),
                    buffer_minutes: String(settings.buffer_minutes),
                    equipment_provided: settings.equipment_provided,
                    require_health_declaration: settings.require_health_declaration,
                    default_level: settings.default_level,
                    equipment_notes: settings.equipment_notes || '',
                    location_notes: settings.location_notes || '',
                    operating_days: Array.isArray(settings.operating_days) && settings.operating_days.length > 0
                        ? (settings.operating_days as number[])
                        : [0, 1, 2, 3, 4, 5, 6],
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
    }, [service.id, user?.id, showAlert]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const saveSettings = async () => {
        if (!user?.id) return;
        setSaving(true);
        try {
            const operatingDays = settingsForm.operating_days.length > 0
                ? [...new Set(settingsForm.operating_days)].sort((a, b) => a - b)
                : [0, 1, 2, 3, 4, 5, 6];
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
                operating_days: operatingDays,
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

    const deleteTemplate = async (templateId: string) => {
        showConfirm(
            'Delete Weekly Slot',
            'Are you sure you want to delete this weekly timetable slot? This will stop future sessions from being generated, but won\'t automatically delete already generated sessions.',
            async () => {
                setSaving(true);
                try {
                    const { error } = await supabase
                        .from('pilates_schedule_templates')
                        .delete()
                        .eq('id', templateId);
                    if (error) throw error;
                    loadData();
                } catch (error: any) {
                    showAlert('Error', error.message || 'Failed to delete weekly class slot', 'error');
                } finally {
                    setSaving(false);
                }
            }
        );
    };

    const openEditTemplate = (template: PilatesTemplate) => {
        setEditingTemplate(template);
        setEditTemplateForm({
            day_of_week: template.day_of_week,
            start_time: template.start_time.slice(0, 5),
            host_id: template.host_id || '',
            capacity: String(template.capacity),
            duration_minutes: String(template.duration_minutes),
            level: template.level,
            starts_on: template.starts_on,
            notes: template.notes || '',
        });
    };

    const saveTemplate = async () => {
        if (!editingTemplate) return;
        if (!editTemplateForm.host_id) {
            showAlert('Missing Host', 'Choose a host for this slot.', 'error');
            return;
        }
        setSaving(true);
        try {
            const { error } = await supabase
                .from('pilates_schedule_templates')
                .update({
                    day_of_week: Number(editTemplateForm.day_of_week),
                    start_time: editTemplateForm.start_time,
                    host_id: editTemplateForm.host_id,
                    capacity: Number(editTemplateForm.capacity),
                    duration_minutes: Number(editTemplateForm.duration_minutes),
                    level: editTemplateForm.level,
                    starts_on: editTemplateForm.starts_on,
                    notes: editTemplateForm.notes.trim() || null,
                })
                .eq('id', editingTemplate.id);
            if (error) throw error;
            setEditingTemplate(null);
            loadData();
        } catch (error: any) {
            showAlert('Error', error.message || 'Failed to update weekly class slot', 'error');
        } finally {
            setSaving(false);
        }
    };

    const deleteHost = async (hostId: string) => {
        showConfirm(
            'Delete Instructor',
            'Are you sure you want to delete this instructor? This will set them to null on all associated classes and sessions.',
            async () => {
                setSaving(true);
                try {
                    const { error } = await supabase
                        .from('pilates_hosts')
                        .delete()
                        .eq('id', hostId);
                    if (error) throw error;
                    loadData();
                } catch (error: any) {
                    showAlert('Error', error.message || 'Failed to delete instructor', 'error');
                } finally {
                    setSaving(false);
                }
            }
        );
    };

    const openEditHost = (host: PilatesHost) => {
        setEditingHost(host);
        setEditHostForm({
            display_name: host.display_name,
            is_active: host.is_active,
        });
    };

    const saveHost = async () => {
        if (!editingHost) return;
        if (!editHostForm.display_name.trim()) {
            showAlert('Missing Name', 'Enter a display name.', 'error');
            return;
        }
        setSaving(true);
        try {
            const { error } = await supabase
                .from('pilates_hosts')
                .update({
                    display_name: editHostForm.display_name.trim(),
                    is_active: editHostForm.is_active,
                })
                .eq('id', editingHost.id);
            if (error) throw error;
            setEditingHost(null);
            loadData();
        } catch (error: any) {
            showAlert('Error', error.message || 'Failed to update instructor', 'error');
        } finally {
            setSaving(false);
        }
    };

    const toggleOperatingDay = (day: number) => {
        const current = new Set(settingsForm.operating_days);
        if (current.has(day)) {
            if (current.size === 1) return; // keep at least one
            current.delete(day);
        } else {
            current.add(day);
        }
        setSettingsForm({ ...settingsForm, operating_days: [...current].sort((a, b) => a - b) });
    };

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
                    <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel="Go back" onPress={() => navigation.goBack()} style={styles.backButton}>
                        <MaterialIcons name="arrow-back" size={22} color={colors.text} />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.title} numberOfLines={1}>{service.name}</Text>
                        <Text style={styles.subtitle}>Pilates · {service.duration_minutes} min · £{Number(service.base_price ?? 0).toFixed(2)}</Text>
                    </View>
                </View>

                <View style={styles.statStrip}>
                    <View style={[styles.statCard, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}>
                        <View style={styles.statLabelRow}>
                            <MaterialCommunityIcons name="calendar-month" size={11} color="#047857" />
                            <Text style={[styles.statLabel, { color: '#047857' }]}>Upcoming</Text>
                        </View>
                        <Text style={[styles.statValue, { color: '#064E3B' }]}>{upcomingCount}</Text>
                    </View>
                    <View style={[styles.statCard, { backgroundColor: '#F5F3FF', borderColor: '#DDD6FE' }]}>
                        <View style={styles.statLabelRow}>
                            <MaterialIcons name="schedule" size={11} color="#6D28D9" />
                            <Text style={[styles.statLabel, { color: '#6D28D9' }]}>Slots</Text>
                        </View>
                        <Text style={[styles.statValue, { color: '#4C1D95' }]}>{activeTemplateCount}</Text>
                    </View>
                    <View style={[styles.statCard, { backgroundColor: '#FDF2F8', borderColor: '#FBCFE8' }]}>
                        <View style={styles.statLabelRow}>
                            <MaterialIcons name="star" size={11} color="#BE185D" />
                            <Text style={[styles.statLabel, { color: '#BE185D' }]}>Bookings</Text>
                        </View>
                        <Text style={[styles.statValue, { color: '#831843' }]}>{bookingCount}</Text>
                    </View>
                    <View style={[styles.statCard, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}>
                        <View style={styles.statLabelRow}>
                            <MaterialIcons name="people" size={11} color="#1D4ED8" />
                            <Text style={[styles.statLabel, { color: '#1D4ED8' }]}>Hosts</Text>
                        </View>
                        <Text style={[styles.statValue, { color: '#1E3A8A' }]}>{hosts.length}</Text>
                    </View>
                </View>

                <View style={styles.tabBar}>
                    {TABS.map(tab => {
                        const active = activeTab === tab.id;
                        return (
                            <TouchableOpacity
                                key={tab.id}
                                style={[styles.tabButton, active && styles.tabButtonActive]}
                                onPress={() => setActiveTab(tab.id)}
                                activeOpacity={0.7}
                            >
                                <MaterialCommunityIcons name={tab.icon} size={15} color={active ? '#FFFFFF' : colors.textSecondary} />
                                <Text style={[styles.tabText, active && styles.tabTextActive]}>{tab.label}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                    {activeTab === 'schedule' && (
                        <>
                            <Card style={styles.section}>
                                <View style={styles.sectionHeader}>
                                    <View style={[styles.sectionIcon, { backgroundColor: '#FDF2F8' }]}>
                                        <MaterialCommunityIcons name="plus" size={18} color="#BE185D" />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.sectionTitle}>Add weekly class</Text>
                                        <Text style={styles.sectionHint}>Recurring slot. Sessions auto-generate for 5 weeks.</Text>
                                    </View>
                                </View>

                                <Text style={styles.fieldLabel}>Day of week</Text>
                                <View style={styles.chipRow}>
                                    {DAYS.map(day => (
                                        <TouchableOpacity
                                            key={day.value}
                                            style={[styles.chip, templateForm.day_of_week === day.value && styles.chipActive]}
                                            onPress={() => setTemplateForm({ ...templateForm, day_of_week: day.value })}
                                        >
                                            <Text style={[styles.chipText, templateForm.day_of_week === day.value && styles.chipTextActive]}>{day.label}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>

                                <View style={styles.row}>
                                    <View style={styles.half}>
                                        <Text style={styles.fieldLabel}>Start time</Text>
                                        <TextInput
                                            style={styles.input}
                                            value={templateForm.start_time}
                                            onChangeText={(v) => setTemplateForm({ ...templateForm, start_time: v })}
                                            placeholder="18:00"
                                            placeholderTextColor={colors.textSecondary}
                                        />
                                    </View>
                                    <View style={styles.half}>
                                        <Text style={styles.fieldLabel}>Spaces</Text>
                                        <TextInput
                                            style={styles.input}
                                            value={templateForm.capacity}
                                            onChangeText={(v) => setTemplateForm({ ...templateForm, capacity: v })}
                                            placeholder="6"
                                            placeholderTextColor={colors.textSecondary}
                                            keyboardType="number-pad"
                                        />
                                    </View>
                                </View>

                                <Text style={styles.fieldLabel}>Instructor</Text>
                                {hosts.length === 0 ? (
                                    <Text style={styles.warningText}>Add an instructor in the Hosts tab first.</Text>
                                ) : (
                                    <View style={styles.chipRow}>
                                        {hosts.map(host => (
                                            <TouchableOpacity
                                                key={host.id}
                                                style={[styles.chip, templateForm.host_id === host.id && styles.chipActive]}
                                                onPress={() => setTemplateForm({ ...templateForm, host_id: host.id })}
                                            >
                                                <Text style={[styles.chipText, templateForm.host_id === host.id && styles.chipTextActive]}>{host.display_name}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                )}

                                <Text style={styles.fieldLabel}>Level</Text>
                                <View style={styles.chipRow}>
                                    {LEVELS.map(level => (
                                        <TouchableOpacity
                                            key={level}
                                            style={[styles.chip, templateForm.level === level && styles.chipActive]}
                                            onPress={() => setTemplateForm({ ...templateForm, level })}
                                        >
                                            <Text style={[styles.chipText, templateForm.level === level && styles.chipTextActive]}>{level}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>

                                <View style={styles.row}>
                                    <View style={styles.half}>
                                        <Text style={styles.fieldLabel}>Minutes</Text>
                                        <TextInput
                                            style={styles.input}
                                            value={templateForm.duration_minutes}
                                            onChangeText={(v) => setTemplateForm({ ...templateForm, duration_minutes: v })}
                                            placeholder="50"
                                            placeholderTextColor={colors.textSecondary}
                                            keyboardType="number-pad"
                                        />
                                    </View>
                                    <View style={styles.half}>
                                        <Text style={styles.fieldLabel}>Starts on</Text>
                                        <TextInput
                                            style={styles.input}
                                            value={templateForm.starts_on}
                                            onChangeText={(v) => setTemplateForm({ ...templateForm, starts_on: v })}
                                            placeholder="YYYY-MM-DD"
                                            placeholderTextColor={colors.textSecondary}
                                        />
                                    </View>
                                </View>

                                <Text style={styles.fieldLabel}>Notes (optional)</Text>
                                <TextInput
                                    style={[styles.input, styles.textArea]}
                                    value={templateForm.notes}
                                    onChangeText={(v) => setTemplateForm({ ...templateForm, notes: v })}
                                    placeholder="Focus on core strength..."
                                    placeholderTextColor={colors.textSecondary}
                                    multiline
                                />

                                <Button title={saving ? 'Adding...' : 'Add weekly class'} onPress={createTemplate} disabled={saving} />
                            </Card>

                            <Card style={styles.section}>
                                <View style={styles.sectionHeader}>
                                    <View style={[styles.sectionIcon, { backgroundColor: '#ECFDF5' }]}>
                                        <MaterialCommunityIcons name="calendar-month" size={18} color="#047857" />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.sectionTitle}>Weekly timetable</Text>
                                        <Text style={styles.sectionHint}>{templates.length} slot{templates.length === 1 ? '' : 's'}</Text>
                                    </View>
                                </View>

                                {templates.length === 0 ? (
                                    <View style={styles.emptyState}>
                                        <View style={[styles.emptyIcon, { backgroundColor: '#FDF2F8' }]}>
                                            <MaterialCommunityIcons name="calendar-blank-outline" size={26} color="#BE185D" />
                                        </View>
                                        <Text style={styles.emptyTitle}>No weekly classes yet</Text>
                                        <Text style={styles.emptyHint}>Add your first recurring class above.</Text>
                                    </View>
                                ) : (
                                    templates.map(template => {
                                        const host = hosts.find(item => item.id === template.host_id);
                                        const dayLabel = DAYS.find(day => day.value === template.day_of_week)?.label || '';
                                        return (
                                            <View key={template.id} style={[styles.templateCard, !template.is_active && styles.templateCardPaused]}>
                                                <View style={{ flex: 1 }}>
                                                    <Text style={styles.templateDay}>{dayLabel} · {template.start_time.slice(0, 5)}</Text>
                                                    <Text style={styles.templateHost}>{host?.display_name || 'No host'}</Text>
                                                    <Text style={styles.templateMeta}>{template.level} · {template.capacity} spots · {template.duration_minutes} min</Text>
                                                </View>
                                                <View style={styles.templateActions}>
                                                    <TouchableOpacity onPress={() => openEditTemplate(template)} style={styles.iconButton} accessibilityLabel="Edit template">
                                                        <MaterialCommunityIcons name="pencil" size={18} color={colors.textSecondary} />
                                                    </TouchableOpacity>
                                                    <TouchableOpacity onPress={() => deleteTemplate(template.id)} style={styles.iconButton} accessibilityLabel="Delete template">
                                                        <MaterialCommunityIcons name="trash-can-outline" size={18} color="#EF4444" />
                                                    </TouchableOpacity>
                                                    <Switch
                                                        value={template.is_active}
                                                        onValueChange={() => toggleTemplate(template)}
                                                        trackColor={{ false: '#E5E7EB', true: '#10B981' }}
                                                    />
                                                </View>
                                            </View>
                                        );
                                    })
                                )}
                            </Card>
                        </>
                    )}

                    {activeTab === 'sessions' && (
                        <Card style={styles.section}>
                            <View style={styles.sectionHeader}>
                                <View style={[styles.sectionIcon, { backgroundColor: '#F5F3FF' }]}>
                                    <MaterialIcons name="schedule" size={18} color="#6D28D9" />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.sectionTitle}>Upcoming sessions</Text>
                                    <Text style={styles.sectionHint}>Tap a session to override defaults.</Text>
                                </View>
                            </View>

                            {sessions.length === 0 ? (
                                <View style={styles.emptyState}>
                                    <View style={[styles.emptyIcon, { backgroundColor: '#F5F3FF' }]}>
                                        <MaterialCommunityIcons name="clock-outline" size={26} color="#6D28D9" />
                                    </View>
                                    <Text style={styles.emptyTitle}>No upcoming sessions</Text>
                                    <Text style={styles.emptyHint}>Add a weekly class to start generating sessions.</Text>
                                </View>
                            ) : (
                                Object.entries(groupedSessions).map(([dateLabel, items]) => (
                                    <View key={dateLabel} style={styles.dayGroup}>
                                        <Text style={styles.dayTitle}>{dateLabel}</Text>
                                        {items.map(session => {
                                            const count = bookedCount(session);
                                            const full = count >= session.capacity;
                                            const cancelled = session.status === 'cancelled';
                                            return (
                                                <TouchableOpacity
                                                    key={session.id}
                                                    style={[
                                                        styles.sessionCard,
                                                        cancelled && styles.sessionCardCancelled,
                                                        !cancelled && full && styles.sessionCardFull,
                                                    ]}
                                                    onPress={() => openSession(session)}
                                                    activeOpacity={0.85}
                                                >
                                                    <View style={{ flex: 1 }}>
                                                        <Text style={styles.sessionTime}>
                                                            {new Date(session.starts_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </Text>
                                                        <Text style={styles.sessionHost}>{session.host?.display_name || 'No host'}</Text>
                                                        <Text style={styles.templateMeta}>
                                                            {session.level}
                                                            {cancelled ? ' · cancelled' : full ? ' · full' : ''}
                                                        </Text>
                                                    </View>
                                                    <View style={[
                                                        styles.spotsBadge,
                                                        cancelled
                                                            ? { backgroundColor: '#FEE2E2' }
                                                            : full
                                                                ? { backgroundColor: '#FEF3C7' }
                                                                : { backgroundColor: '#D1FAE5' },
                                                    ]}>
                                                        <Text style={[
                                                            styles.spotsText,
                                                            cancelled
                                                                ? { color: '#B91C1C' }
                                                                : full
                                                                    ? { color: '#92400E' }
                                                                    : { color: '#047857' },
                                                        ]}>{count}/{session.capacity}</Text>
                                                    </View>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                ))
                            )}
                        </Card>
                    )}

                    {activeTab === 'instructors' && (
                        <>
                            <Card style={styles.section}>
                                <View style={styles.sectionHeader}>
                                    <View style={[styles.sectionIcon, { backgroundColor: '#EFF6FF' }]}>
                                        <MaterialCommunityIcons name="account-plus-outline" size={18} color="#1D4ED8" />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.sectionTitle}>Add an instructor</Text>
                                        <Text style={styles.sectionHint}>Pick from your team or add external.</Text>
                                    </View>
                                </View>

                                {hostProfiles.length > 0 && (
                                    <>
                                        <Text style={styles.fieldLabel}>From your team</Text>
                                        <View style={styles.chipRow}>
                                            {hostProfiles.map(profile => (
                                                <TouchableOpacity
                                                    key={profile.id}
                                                    style={[styles.chip, selectedProfileId === profile.id && styles.chipActive]}
                                                    onPress={() => { setSelectedProfileId(profile.id); setHostName(''); }}
                                                >
                                                    <Text style={[styles.chipText, selectedProfileId === profile.id && styles.chipTextActive]}>{profile.full_name || 'Unnamed'}</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    </>
                                )}

                                <Text style={styles.fieldLabel}>Or external instructor</Text>
                                <TextInput
                                    style={styles.input}
                                    value={hostName}
                                    onChangeText={(v) => { setHostName(v); setSelectedProfileId(''); }}
                                    placeholder="e.g. Sarah Thompson"
                                    placeholderTextColor={colors.textSecondary}
                                />
                                <Button title={saving ? 'Adding...' : 'Add instructor'} onPress={createHost} disabled={saving} />
                            </Card>

                            <Card style={styles.section}>
                                <View style={styles.sectionHeader}>
                                    <View style={[styles.sectionIcon, { backgroundColor: '#ECFDF5' }]}>
                                        <MaterialCommunityIcons name="account-group" size={18} color="#047857" />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.sectionTitle}>Roster</Text>
                                        <Text style={styles.sectionHint}>{hosts.length} instructor{hosts.length === 1 ? '' : 's'}</Text>
                                    </View>
                                </View>

                                {hosts.length === 0 ? (
                                    <View style={styles.emptyState}>
                                        <View style={[styles.emptyIcon, { backgroundColor: '#EFF6FF' }]}>
                                            <MaterialCommunityIcons name="account-group-outline" size={26} color="#1D4ED8" />
                                        </View>
                                        <Text style={styles.emptyTitle}>No instructors yet</Text>
                                        <Text style={styles.emptyHint}>Add your first host above.</Text>
                                    </View>
                                ) : (
                                    hosts.map(host => (
                                        <View key={host.id} style={styles.hostRow}>
                                            <View style={styles.avatar}>
                                                <Text style={styles.avatarText}>{(host.display_name || '?').slice(0, 1).toUpperCase()}</Text>
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.hostRowName}>
                                                    {host.display_name}
                                                    {!host.is_active && <Text style={{ color: '#EF4444', fontSize: 10, fontWeight: '400' }}> (Inactive)</Text>}
                                                </Text>
                                                <Text style={styles.hostRowMeta}>{host.profile_id ? 'Team member' : 'External instructor'}</Text>
                                            </View>
                                            <View style={styles.hostActions}>
                                                <TouchableOpacity onPress={() => openEditHost(host)} style={styles.iconButton} accessibilityLabel="Edit instructor">
                                                    <MaterialCommunityIcons name="pencil" size={18} color={colors.textSecondary} />
                                                </TouchableOpacity>
                                                <TouchableOpacity onPress={() => deleteHost(host.id)} style={styles.iconButton} accessibilityLabel="Delete instructor">
                                                    <MaterialCommunityIcons name="trash-can-outline" size={18} color="#EF4444" />
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    ))
                                )}
                            </Card>
                        </>
                    )}

                    {activeTab === 'settings' && (
                        <Card style={styles.section}>
                            <View style={styles.sectionHeader}>
                                <View style={[styles.sectionIcon, { backgroundColor: '#ECFDF5' }]}>
                                    <MaterialCommunityIcons name="cog-outline" size={18} color="#047857" />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.sectionTitle}>Default class settings</Text>
                                    <Text style={styles.sectionHint}>Used when generating new weekly classes.</Text>
                                </View>
                            </View>

                            <View style={styles.row}>
                                <View style={styles.half}>
                                    <Text style={styles.fieldLabel}>Default capacity</Text>
                                    <TextInput
                                        style={styles.input}
                                        value={settingsForm.default_capacity}
                                        onChangeText={(v) => setSettingsForm({ ...settingsForm, default_capacity: v })}
                                        placeholder="6"
                                        placeholderTextColor={colors.textSecondary}
                                        keyboardType="number-pad"
                                    />
                                </View>
                                <View style={styles.half}>
                                    <Text style={styles.fieldLabel}>Session length</Text>
                                    <TextInput
                                        style={styles.input}
                                        value={settingsForm.default_session_duration_minutes}
                                        onChangeText={(v) => setSettingsForm({ ...settingsForm, default_session_duration_minutes: v })}
                                        placeholder="50"
                                        placeholderTextColor={colors.textSecondary}
                                        keyboardType="number-pad"
                                    />
                                </View>
                            </View>

                            <Text style={styles.fieldLabel}>Default level</Text>
                            <View style={styles.chipRow}>
                                {LEVELS.map(level => (
                                    <TouchableOpacity
                                        key={level}
                                        style={[styles.chip, settingsForm.default_level === level && styles.chipActive]}
                                        onPress={() => setSettingsForm({ ...settingsForm, default_level: level })}
                                    >
                                        <Text style={[styles.chipText, settingsForm.default_level === level && styles.chipTextActive]}>{level}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <Text style={styles.fieldLabel}>Operating days</Text>
                            <View style={styles.chipRow}>
                                {DAYS.map(day => {
                                    const isOn = settingsForm.operating_days.includes(day.value);
                                    return (
                                        <TouchableOpacity
                                            key={day.value}
                                            style={[styles.chip, isOn && styles.chipActive]}
                                            onPress={() => toggleOperatingDay(day.value)}
                                        >
                                            <Text style={[styles.chipText, isOn && styles.chipTextActive]}>{day.label}</Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                            <Text style={styles.helperText}>Days marked off won&apos;t generate new classes. Existing bookings are kept.</Text>

                            <Text style={styles.fieldLabel}>Equipment notes</Text>
                            <TextInput
                                style={[styles.input, styles.textArea]}
                                value={settingsForm.equipment_notes}
                                onChangeText={(v) => setSettingsForm({ ...settingsForm, equipment_notes: v })}
                                placeholder="e.g. We provide mats and reformers. Bring grip socks."
                                placeholderTextColor={colors.textSecondary}
                                multiline
                            />

                            <Text style={styles.fieldLabel}>Location notes</Text>
                            <TextInput
                                style={[styles.input, styles.textArea]}
                                value={settingsForm.location_notes}
                                onChangeText={(v) => setSettingsForm({ ...settingsForm, location_notes: v })}
                                placeholder="e.g. 2nd floor. Use the side entrance."
                                placeholderTextColor={colors.textSecondary}
                                multiline
                            />

                            <View style={styles.switchRow}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.switchTitle}>Equipment provided</Text>
                                    <Text style={styles.switchHint}>Studio supplies the gear</Text>
                                </View>
                                <Switch
                                    value={settingsForm.equipment_provided}
                                    onValueChange={(v) => setSettingsForm({ ...settingsForm, equipment_provided: v })}
                                    trackColor={{ false: '#E5E7EB', true: '#10B981' }}
                                />
                            </View>
                            <View style={styles.switchRow}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.switchTitle}>Health declaration</Text>
                                    <Text style={styles.switchHint}>Clients confirm fitness to attend</Text>
                                </View>
                                <Switch
                                    value={settingsForm.require_health_declaration}
                                    onValueChange={(v) => setSettingsForm({ ...settingsForm, require_health_declaration: v })}
                                    trackColor={{ false: '#E5E7EB', true: '#10B981' }}
                                />
                            </View>

                            <Button title={saving ? 'Saving...' : 'Save default settings'} onPress={saveSettings} disabled={saving} />
                        </Card>
                    )}
                </ScrollView>

                {editingSession && (
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalCard}>
                            <View style={styles.modalHeader}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.modalKicker}>EDIT CLASS</Text>
                                    <Text style={styles.modalTitle}>
                                        {new Date(editingSession.starts_at).toLocaleString([], {
                                            weekday: 'short',
                                            month: 'short',
                                            day: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit',
                                        })}
                                    </Text>
                                </View>
                                <TouchableOpacity
                                    accessibilityRole="button"
                                    accessibilityLabel="Close" onPress={() => setEditingSession(null)} style={styles.modalClose}>
                                    <MaterialIcons name="close" size={22} color={colors.text} />
                                </TouchableOpacity>
                            </View>
                            <Text style={styles.modalHint}>Override defaults for this single class only.</Text>

                            <Text style={styles.fieldLabel}>Instructor</Text>
                            <View style={styles.chipRow}>
                                <TouchableOpacity
                                    style={[styles.chip, sessionForm.host_id === '' && styles.chipActive]}
                                    onPress={() => setSessionForm({ ...sessionForm, host_id: '' })}
                                >
                                    <Text style={[styles.chipText, sessionForm.host_id === '' && styles.chipTextActive]}>None</Text>
                                </TouchableOpacity>
                                {hosts.map(host => (
                                    <TouchableOpacity
                                        key={host.id}
                                        style={[styles.chip, sessionForm.host_id === host.id && styles.chipActive]}
                                        onPress={() => setSessionForm({ ...sessionForm, host_id: host.id })}
                                    >
                                        <Text style={[styles.chipText, sessionForm.host_id === host.id && styles.chipTextActive]}>{host.display_name}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <Text style={styles.fieldLabel}>Spaces</Text>
                            <TextInput
                                style={styles.input}
                                value={sessionForm.capacity}
                                onChangeText={(v) => setSessionForm({ ...sessionForm, capacity: v })}
                                keyboardType="number-pad"
                                placeholder="6"
                                placeholderTextColor={colors.textSecondary}
                            />

                            <Text style={styles.fieldLabel}>Level</Text>
                            <View style={styles.chipRow}>
                                {LEVELS.map(level => (
                                    <TouchableOpacity
                                        key={level}
                                        style={[styles.chip, sessionForm.level === level && styles.chipActive]}
                                        onPress={() => setSessionForm({ ...sessionForm, level })}
                                    >
                                        <Text style={[styles.chipText, sessionForm.level === level && styles.chipTextActive]}>{level}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <Text style={styles.fieldLabel}>Status</Text>
                            <View style={styles.chipRow}>
                                {['scheduled', 'cancelled'].map(status => (
                                    <TouchableOpacity
                                        key={status}
                                        style={[styles.chip, sessionForm.status === status && styles.chipActive]}
                                        onPress={() => setSessionForm({ ...sessionForm, status })}
                                    >
                                        <Text style={[styles.chipText, sessionForm.status === status && styles.chipTextActive]}>{status}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <Text style={styles.fieldLabel}>Notes (optional)</Text>
                            <TextInput
                                style={[styles.input, styles.textArea]}
                                value={sessionForm.notes}
                                onChangeText={(v) => setSessionForm({ ...sessionForm, notes: v })}
                                placeholder="Override notes shown to booked clients"
                                placeholderTextColor={colors.textSecondary}
                                multiline
                            />

                            <Button title={saving ? 'Saving...' : 'Save changes'} onPress={saveSession} disabled={saving} />
                        </View>
                    </View>
                )}

                {editingTemplate && (
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalCard}>
                            <View style={styles.modalHeader}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.modalKicker}>EDIT WEEKLY CLASS</Text>
                                    <Text style={styles.modalTitle}>Class Slot Details</Text>
                                </View>
                                <TouchableOpacity
                                    accessibilityRole="button"
                                    accessibilityLabel="Close" onPress={() => setEditingTemplate(null)} style={styles.modalClose}>
                                    <MaterialIcons name="close" size={22} color={colors.text} />
                                </TouchableOpacity>
                            </View>
                            <Text style={styles.modalHint}>Update the settings for this recurring weekly class slot.</Text>

                            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: '80%' }} contentContainerStyle={{ paddingBottom: 24 }}>
                                <Text style={styles.fieldLabel}>Day of week</Text>
                                <View style={styles.chipRow}>
                                    {DAYS.map(day => (
                                        <TouchableOpacity
                                            key={day.value}
                                            style={[styles.chip, editTemplateForm.day_of_week === day.value && styles.chipActive]}
                                            onPress={() => setEditTemplateForm({ ...editTemplateForm, day_of_week: day.value })}
                                        >
                                            <Text style={[styles.chipText, editTemplateForm.day_of_week === day.value && styles.chipTextActive]}>{day.label}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>

                                <View style={styles.row}>
                                    <View style={styles.half}>
                                        <Text style={styles.fieldLabel}>Start time</Text>
                                        <TextInput
                                            style={styles.input}
                                            value={editTemplateForm.start_time}
                                            onChangeText={(v) => setEditTemplateForm({ ...editTemplateForm, start_time: v })}
                                            placeholder="e.g. 18:00"
                                            placeholderTextColor={colors.textSecondary}
                                        />
                                    </View>
                                    <View style={styles.half}>
                                        <Text style={styles.fieldLabel}>Duration (min)</Text>
                                        <TextInput
                                            style={styles.input}
                                            value={editTemplateForm.duration_minutes}
                                            onChangeText={(v) => setEditTemplateForm({ ...editTemplateForm, duration_minutes: v })}
                                            keyboardType="number-pad"
                                        />
                                    </View>
                                </View>

                                <Text style={styles.fieldLabel}>Instructor</Text>
                                <View style={styles.chipRow}>
                                    {hosts.map(host => (
                                        <TouchableOpacity
                                            key={host.id}
                                            style={[styles.chip, editTemplateForm.host_id === host.id && styles.chipActive]}
                                            onPress={() => setEditTemplateForm({ ...editTemplateForm, host_id: host.id })}
                                        >
                                            <Text style={[styles.chipText, editTemplateForm.host_id === host.id && styles.chipTextActive]}>{host.display_name}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>

                                <View style={styles.row}>
                                    <View style={styles.half}>
                                        <Text style={styles.fieldLabel}>Capacity</Text>
                                        <TextInput
                                            style={styles.input}
                                            value={editTemplateForm.capacity}
                                            onChangeText={(v) => setEditTemplateForm({ ...editTemplateForm, capacity: v })}
                                            keyboardType="number-pad"
                                        />
                                    </View>
                                    <View style={styles.half}>
                                        <Text style={styles.fieldLabel}>Starts on</Text>
                                        <TextInput
                                            style={styles.input}
                                            value={editTemplateForm.starts_on}
                                            onChangeText={(v) => setEditTemplateForm({ ...editTemplateForm, starts_on: v })}
                                            placeholder="YYYY-MM-DD"
                                            placeholderTextColor={colors.textSecondary}
                                        />
                                    </View>
                                </View>

                                <Text style={styles.fieldLabel}>Level</Text>
                                <View style={styles.chipRow}>
                                    {LEVELS.map(level => (
                                        <TouchableOpacity
                                            key={level}
                                            style={[styles.chip, editTemplateForm.level === level && styles.chipActive]}
                                            onPress={() => setEditTemplateForm({ ...editTemplateForm, level })}
                                        >
                                            <Text style={[styles.chipText, editTemplateForm.level === level && styles.chipTextActive]}>{level}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>

                                <Text style={styles.fieldLabel}>Notes (optional)</Text>
                                <TextInput
                                    style={[styles.input, styles.textArea]}
                                    value={editTemplateForm.notes}
                                    onChangeText={(v) => setEditTemplateForm({ ...editTemplateForm, notes: v })}
                                    placeholder="Focus on core strength..."
                                    placeholderTextColor={colors.textSecondary}
                                    multiline
                                />

                                <Button title={saving ? 'Saving...' : 'Save changes'} onPress={saveTemplate} disabled={saving} />
                            </ScrollView>
                        </View>
                    </View>
                )}

                {editingHost && (
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalCard}>
                            <View style={styles.modalHeader}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.modalKicker}>EDIT INSTRUCTOR</Text>
                                    <Text style={styles.modalTitle}>Instructor Profile</Text>
                                </View>
                                <TouchableOpacity
                                    accessibilityRole="button"
                                    accessibilityLabel="Close" onPress={() => setEditingHost(null)} style={styles.modalClose}>
                                    <MaterialIcons name="close" size={22} color={colors.text} />
                                </TouchableOpacity>
                            </View>

                            <Text style={styles.fieldLabel}>Display Name</Text>
                            <TextInput
                                style={styles.input}
                                value={editHostForm.display_name}
                                onChangeText={(v) => setEditHostForm({ ...editHostForm, display_name: v })}
                                placeholder="e.g. Sarah Thompson"
                                placeholderTextColor={colors.textSecondary}
                            />

                            <View style={styles.switchRow}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.switchTitle}>Active instructor</Text>
                                    <Text style={styles.switchHint}>Unchecking hides them from new class options</Text>
                                </View>
                                <Switch
                                    value={editHostForm.is_active}
                                    onValueChange={(v) => setEditHostForm({ ...editHostForm, is_active: v })}
                                    trackColor={{ false: '#E5E7EB', true: '#10B981' }}
                                />
                            </View>

                            <Button title={saving ? 'Saving...' : 'Save changes'} onPress={saveHost} disabled={saving} />
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

    header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
    backButton: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.04)', alignItems: 'center', justifyContent: 'center' },
    title: { fontSize: 20, fontWeight: '700', color: colors.text },
    subtitle: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },

    statStrip: { flexDirection: 'row', gap: 8, paddingHorizontal: spacing.lg, marginBottom: spacing.md },
    statCard: { flex: 1, paddingVertical: 10, paddingHorizontal: 10, borderRadius: 14, borderWidth: 1 },
    statLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
    statLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
    statValue: { fontSize: 18, fontWeight: '800' },

    tabBar: { flexDirection: 'row', marginHorizontal: spacing.lg, marginBottom: spacing.md, padding: 4, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.7)', borderWidth: 1, borderColor: colors.border, gap: 4 },
    tabButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 9, paddingHorizontal: 6, borderRadius: 10 },
    tabButtonActive: { backgroundColor: '#10B981' },
    tabText: { fontSize: 11, fontWeight: '700', color: colors.textSecondary },
    tabTextActive: { color: '#FFFFFF' },

    content: { paddingHorizontal: spacing.lg, paddingBottom: 40 },
    section: { marginBottom: spacing.lg, padding: spacing.lg },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: spacing.md },
    sectionIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    sectionTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
    sectionHint: { fontSize: 11, color: colors.textSecondary, marginTop: 1 },

    fieldLabel: { fontSize: 11, fontWeight: '800', color: colors.textSecondary, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 6, marginTop: 4 },
    helperText: { fontSize: 11, color: colors.textSecondary, marginTop: -spacing.sm, marginBottom: spacing.md, lineHeight: 15 },
    warningText: { fontSize: 12, color: '#B45309', backgroundColor: '#FEF3C7', padding: 10, borderRadius: 10, marginBottom: spacing.md },

    row: { flexDirection: 'row', gap: spacing.md },
    half: { flex: 1 },
    input: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, color: colors.text, marginBottom: spacing.md, backgroundColor: 'rgba(255,255,255,0.7)', fontSize: 14 },
    textArea: { minHeight: 64, textAlignVertical: 'top' },

    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: spacing.md },
    chip: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.05)', borderWidth: 1, borderColor: 'transparent' },
    chipActive: { backgroundColor: '#10B981', borderColor: '#059669' },
    chipText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
    chipTextActive: { color: '#FFFFFF' },

    switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, marginBottom: 2 },
    switchTitle: { color: colors.text, fontWeight: '700', fontSize: 13 },
    switchHint: { color: colors.textSecondary, fontSize: 11, marginTop: 2 },

    templateCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, borderRadius: 14, backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#A7F3D0', marginBottom: spacing.sm },
    templateCardPaused: { backgroundColor: '#F9FAFB', borderColor: '#E5E7EB', opacity: 0.7 },
    templateDay: { fontSize: 10, fontWeight: '800', color: '#047857', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 2 },
    templateHost: { fontWeight: '800', color: colors.text, fontSize: 14, marginBottom: 2 },
    templateMeta: { color: colors.textSecondary, fontSize: 11 },
    templateActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    hostActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    iconButton: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.04)' },

    emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xl, gap: 8 },
    emptyIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
    emptyTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
    emptyHint: { fontSize: 12, color: colors.textSecondary, textAlign: 'center' },

    dayGroup: { marginBottom: spacing.md },
    dayTitle: { color: colors.textSecondary, fontWeight: '800', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: spacing.sm },

    sessionCard: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderRadius: 14, borderWidth: 1, borderColor: '#DDD6FE', backgroundColor: '#FAF5FF', marginBottom: spacing.sm },
    sessionCardCancelled: { backgroundColor: '#FEF2F2', borderColor: '#FECACA', opacity: 0.6 },
    sessionCardFull: { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' },
    sessionTime: { fontSize: 17, fontWeight: '800', color: colors.text, marginBottom: 2 },
    sessionHost: { fontSize: 13, fontWeight: '700', color: '#6D28D9', marginBottom: 2 },
    spotsBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
    spotsText: { fontWeight: '800', fontSize: 11 },

    hostRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: 'rgba(255,255,255,0.7)', marginBottom: spacing.sm },
    avatar: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#ECFDF5', alignItems: 'center', justifyContent: 'center' },
    avatarText: { fontSize: 16, fontWeight: '800', color: '#047857' },
    hostRowName: { fontWeight: '800', color: colors.text, fontSize: 14, marginBottom: 2 },
    hostRowMeta: { color: colors.textSecondary, fontSize: 11 },

    modalOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
    modalCard: { width: '100%', maxHeight: '85%', borderRadius: 24, backgroundColor: '#FFFFFF', padding: spacing.lg },
    modalHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
    modalKicker: { fontSize: 10, fontWeight: '800', color: '#7C3AED', letterSpacing: 1, marginBottom: 2 },
    modalTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
    modalHint: { fontSize: 12, color: colors.textSecondary, marginBottom: spacing.md },
    modalClose: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.04)' },
});

export default PilatesTimetableScreen;
