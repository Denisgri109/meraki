import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    Modal,
    Switch,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Card, Button, ScreenBackground, MerakiText } from '../../components/ui';
import { useModal } from '../../contexts/ModalContext';
import { colors, spacing } from '../../theme';

// Types for master settings
interface MasterBusinessSettings {
    confirmation_timing_hours: number;
    late_arrival_minutes: number;
    terms_and_conditions: string | null;
    require_tc_acceptance: boolean;
    accepts_new_clients: boolean;
    is_visible_globally: boolean;
}

interface PilatesSettings {
    default_capacity: number;
    default_session_duration_minutes: number;
    buffer_minutes: number;
    equipment_provided: boolean;
    require_health_declaration: boolean;
    default_level: string;
    equipment_notes: string;
    location_notes: string;
}

const DEFAULT_SETTINGS: MasterBusinessSettings = {
    confirmation_timing_hours: 24,
    late_arrival_minutes: 15,
    terms_and_conditions: null,
    require_tc_acceptance: true,
    accepts_new_clients: true,
    is_visible_globally: true,
};

const DEFAULT_PILATES_SETTINGS: PilatesSettings = {
    default_capacity: 6,
    default_session_duration_minutes: 50,
    buffer_minutes: 10,
    equipment_provided: true,
    require_health_declaration: true,
    default_level: 'All levels',
    equipment_notes: '',
    location_notes: '',
};

const CONFIRMATION_OPTIONS = [
    { value: 12, label: '12 hours before' },
    { value: 24, label: '24 hours before' },
    { value: 72, label: '72 hours before' },
];

const LATE_ARRIVAL_OPTIONS = [
    { value: 10, label: '10 minutes' },
    { value: 15, label: '15 minutes' },
    { value: 20, label: '20 minutes' },
    { value: 30, label: '30 minutes' },
];

const PILATES_LEVEL_OPTIONS = [
    { value: 'Beginner', label: 'Beginner' },
    { value: 'Intermediate', label: 'Intermediate' },
    { value: 'Advanced', label: 'Advanced' },
    { value: 'All levels', label: 'All levels' },
];

const PERCENTAGE_OPTIONS = [
    { value: 0, label: '0% (No charge)' },
    { value: 25, label: '25%' },
    { value: 50, label: '50%' },
    { value: 75, label: '75%' },
    { value: 100, label: '100% (Full charge)' },
];

type PickerType = 'confirmation' | 'late_arrival' | 'pilates_level' | 'cancellation_percent' | 'noshow_percent' | null;

export function BusinessSettingsScreen() {
    const navigation = useNavigation();
    const { user, profile } = useAuth();
    const { showAlert } = useModal();

    const [settings, setSettings] = useState<MasterBusinessSettings>(DEFAULT_SETTINGS);
    const [pilatesSettings, setPilatesSettings] = useState<PilatesSettings>(DEFAULT_PILATES_SETTINGS);
    const [pilatesServiceId, setPilatesServiceId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [pickerVisible, setPickerVisible] = useState<PickerType>(null);
    const [tcModalVisible, setTcModalVisible] = useState(false);
    const [tcDraft, setTcDraft] = useState('');
    const canManagePilates = profile?.role === 'owner';

    useEffect(() => {
        loadSettings();
    }, [user?.id, profile?.role]);

    const loadSettings = async () => {
        if (!user) return;
        setLoading(true);

        try {
            // Try to get existing settings (cast to any since table types not yet generated)
            const { data, error } = await (supabase as any)
                .from('master_settings')
                .select('*')
                .eq('master_id', user.id)
                .single();

            if (error && error.code !== 'PGRST116') {
                // Not a "not found" error
                console.error('Error loading settings:', error);
            }

            if (data) {
                setSettings({
                    confirmation_timing_hours: data.confirmation_timing_hours ?? 24,
                    late_arrival_minutes: data.late_arrival_minutes ?? 15,
                    terms_and_conditions: data.terms_and_conditions,
                    require_tc_acceptance: data.require_tc_acceptance ?? true,
                    accepts_new_clients: data.accepts_new_clients ?? true,
                    is_visible_globally: data.is_visible_globally ?? true,
                });
                setTcDraft(data.terms_and_conditions || '');
            } else {
                // Create default settings (upsert to avoid conflict if row already exists)
                await (supabase as any)
                    .from('master_settings')
                    .upsert(
                        { master_id: user.id },
                        { onConflict: 'master_id' }
                    );
            }

            if (canManagePilates) {
                const { data: serviceData, error: serviceError } = await supabase
                    .from('services')
                    .select('id')
                    .eq('created_by', user.id)
                    .eq('category', 'Pilates')
                    .eq('is_active', true)
                    .limit(1)
                    .maybeSingle();

                if (serviceError) {
                    console.error('Error loading Pilates service:', serviceError);
                }

                setPilatesServiceId(serviceData?.id || null);

                if (serviceData?.id) {
                    const { data: pilatesData, error: pilatesError } = await supabase
                        .from('pilates_settings')
                        .select('*')
                        .eq('service_id', serviceData.id)
                        .maybeSingle();

                    if (pilatesError) {
                        console.error('Error loading Pilates settings:', pilatesError);
                    }

                    if (pilatesData) {
                        setPilatesSettings({
                            default_capacity: pilatesData.default_capacity ?? 6,
                            default_session_duration_minutes: pilatesData.default_session_duration_minutes ?? 50,
                            buffer_minutes: pilatesData.buffer_minutes ?? 10,
                            equipment_provided: pilatesData.equipment_provided ?? true,
                            require_health_declaration: pilatesData.require_health_declaration ?? true,
                            default_level: pilatesData.default_level || 'All levels',
                            equipment_notes: pilatesData.equipment_notes || '',
                            location_notes: pilatesData.location_notes || '',
                        });
                    }
                }
            }
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!user) return;

        setSaving(true);
        try {
            const { error } = await (supabase as any)
                .from('master_settings')
                .upsert(
                    {
                        master_id: user.id,
                        ...settings,
                        terms_updated_at: settings.terms_and_conditions ? new Date().toISOString() : null,
                        updated_at: new Date().toISOString(),
                    },
                    { onConflict: 'master_id' }
                );

            if (error) throw error;

            if (canManagePilates && pilatesServiceId) {
                const { error: pilatesError } = await supabase
                    .from('pilates_settings')
                    .upsert(
                        {
                            owner_id: user.id,
                            service_id: pilatesServiceId,
                            ...pilatesSettings,
                            equipment_notes: pilatesSettings.equipment_notes.trim() || null,
                            location_notes: pilatesSettings.location_notes.trim() || null,
                        },
                        { onConflict: 'service_id' }
                    );

                if (pilatesError) throw pilatesError;
            }

            showAlert('Success', 'Your business settings have been saved!', 'success');
        } catch (error: any) {
            showAlert('Error', error.message || 'Failed to save settings', 'error');
        } finally {
            setSaving(false);
        }
    };

    const saveTc = () => {
        setSettings({ ...settings, terms_and_conditions: tcDraft || null });
        setTcModalVisible(false);
    };

    const renderPicker = () => {
        if (!pickerVisible) return null;

        let items: { value: number | string; label: string }[] = [];
        let title = '';
        let currentValue: number | string = 0;

        switch (pickerVisible) {
            case 'confirmation':
                items = CONFIRMATION_OPTIONS;
                title = 'Confirmation Timing';
                currentValue = settings.confirmation_timing_hours;
                break;
            case 'late_arrival':
                items = LATE_ARRIVAL_OPTIONS;
                title = 'Late Arrival Window';
                currentValue = settings.late_arrival_minutes;
                break;
            case 'pilates_level':
                items = PILATES_LEVEL_OPTIONS;
                title = 'Default Pilates Level';
                currentValue = pilatesSettings.default_level;
                break;

        }

        const onSelect = (value: number | string) => {
            switch (pickerVisible) {
                case 'confirmation':
                    setSettings({ ...settings, confirmation_timing_hours: Number(value) });
                    break;
                case 'late_arrival':
                    setSettings({ ...settings, late_arrival_minutes: Number(value) });
                    break;
                case 'pilates_level':
                    setPilatesSettings({ ...pilatesSettings, default_level: String(value) });
                    break;

            }
            setPickerVisible(null);
        };

        return (
            <Modal
                visible={true}
                transparent
                animationType="slide"
                onRequestClose={() => setPickerVisible(null)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setPickerVisible(null)}
                >
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <MerakiText variant="body" color={colors.text} style={{ fontWeight: '600' }}>{title}</MerakiText>
                            <TouchableOpacity onPress={() => setPickerVisible(null)}>
                                <MaterialCommunityIcons name="close" size={22} color={colors.textMuted} />
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={styles.optionsScroll}>
                            {items.map((item) => {
                                const isSelected = item.value === currentValue;
                                return (
                                    <TouchableOpacity
                                        key={item.value}
                                        style={[
                                            styles.optionItem,
                                            isSelected && styles.optionItemSelected
                                        ]}
                                        onPress={() => onSelect(item.value)}
                                    >
                                        <Text style={[
                                            styles.optionText,
                                            isSelected && styles.optionTextSelected
                                        ]}>
                                            {item.label}
                                        </Text>
                                        {isSelected && (
                                            <MaterialCommunityIcons name="check" size={18} color={colors.primary} />
                                        )}
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </View>
                </TouchableOpacity>
            </Modal>
        );
    };

    const renderTcModal = () => (
        <Modal
            visible={tcModalVisible}
            animationType="slide"
            presentationStyle="fullScreen"
            onRequestClose={() => setTcModalVisible(false)}
        >
            <ScreenBackground>
                <SafeAreaView style={styles.tcModalContainer} edges={['top']}>
                    <View style={styles.tcModalHeader}>
                        <TouchableOpacity onPress={() => setTcModalVisible(false)} style={styles.backButton}>
                            <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
                        </TouchableOpacity>
                        <View style={{ flex: 1 }}>
                            <MerakiText variant="h1">Terms & Conditions</MerakiText>
                            <MerakiText variant="caption" color={colors.textSecondary}>Edit your booking terms</MerakiText>
                        </View>
                    </View>

                    <View style={styles.tcContentArea}>
                        <Card style={styles.tcInputCard}>
                            <TextInput
                                style={styles.tcInput}
                                multiline
                                placeholder={"Enter your Terms & Conditions here...\n\nExample:\n- Cancellation Policy: Appointments cancelled within 24 hours will be charged 50%.\n- Late Arrivals: If you are more than 15 minutes late, the appointment may be cancelled.\n- Payment: Full payment is due at the time of service.\n- Consultations: Certain services require a consultation before booking."}
                                placeholderTextColor={colors.textMuted}
                                value={tcDraft}
                                onChangeText={setTcDraft}
                                textAlignVertical="top"
                            />
                        </Card>
                    </View>

                    <View style={styles.tcBottomBar}>
                        <Button
                            title="Save Terms"
                            onPress={saveTc}
                            fullWidth
                        />
                    </View>
                </SafeAreaView>
            </ScreenBackground>
        </Modal>
    );

    if (loading) {
        return (
            <ScreenBackground>
                <SafeAreaView style={styles.loadingContainer}>
                    <Text style={styles.loadingText}>Loading settings...</Text>
                </SafeAreaView>
            </ScreenBackground>
        );
    }

    return (
        <ScreenBackground>
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <View>
                        <MerakiText variant="h1">Business Settings</MerakiText>
                        <MerakiText variant="caption" color={colors.textSecondary}>Configure your booking policies and preferences</MerakiText>
                    </View>
                </View>

                <ScrollView contentContainerStyle={styles.content}>
                    {/* Confirmation Timing */}
                    <Card style={styles.section}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.xs }}>
                            <MaterialCommunityIcons name="calendar-check" size={20} color={colors.accent} />
                            <MerakiText variant="body" color={colors.text} style={{ fontWeight: '600', fontSize: 18 }}>Appointment Confirmations</MerakiText>
                        </View>
                        <MerakiText variant="caption" color={colors.textSecondary} style={{ marginBottom: spacing.md }}>
                            When should clients receive confirmation reminders?
                        </MerakiText>
                        <TouchableOpacity
                            style={styles.selector}
                            onPress={() => setPickerVisible('confirmation')}
                        >
                            <Text style={styles.selectorText}>
                                {CONFIRMATION_OPTIONS.find(o => o.value === settings.confirmation_timing_hours)?.label || '24 hours before'}
                            </Text>
                            <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />
                        </TouchableOpacity>
                    </Card>

                    {/* Late Arrival Policy */}
                    <Card style={styles.section}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.xs }}>
                            <MaterialCommunityIcons name="clock-alert-outline" size={20} color={colors.accent} />
                            <MerakiText variant="body" color={colors.text} style={{ fontWeight: '600', fontSize: 18 }}>Late Arrival Policy</MerakiText>
                        </View>
                        <MerakiText variant="caption" color={colors.textSecondary} style={{ marginBottom: spacing.md }}>
                            After how many minutes is a client considered late? Late arrivals can be marked as no-show.
                        </MerakiText>
                        <TouchableOpacity
                            style={styles.selector}
                            onPress={() => setPickerVisible('late_arrival')}
                        >
                            <Text style={styles.selectorText}>
                                {LATE_ARRIVAL_OPTIONS.find(o => o.value === settings.late_arrival_minutes)?.label || '15 minutes'}
                            </Text>
                            <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />
                        </TouchableOpacity>
                    </Card>

                    {/* No-Show Charge */}
                    <Card style={styles.section}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.xs }}>
                            <MaterialCommunityIcons name="account-cancel-outline" size={20} color={colors.accent} />
                            <MerakiText variant="body" color={colors.text} style={{ fontWeight: '600', fontSize: 18 }}>No-Show Charge</MerakiText>
                        </View>
                        <MerakiText variant="caption" color={colors.textSecondary} style={{ marginBottom: spacing.md }}>
                            Clients who confirm but don't show up will be charged 100% of the service price.
                        </MerakiText>
                        <View style={styles.selector}>
                            <Text style={styles.selectorText}>100%</Text>
                        </View>
                    </Card>

                    {/* Terms & Conditions */}
                    <Card style={styles.section}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.xs }}>
                            <MaterialCommunityIcons name="clipboard-text-outline" size={20} color={colors.accent} />
                            <MerakiText variant="body" color={colors.text} style={{ fontWeight: '600', fontSize: 18 }}>Terms & Conditions</MerakiText>
                        </View>
                        <MerakiText variant="caption" color={colors.textSecondary} style={{ marginBottom: spacing.md }}>
                            Set your booking terms. Clients must accept these before booking.
                        </MerakiText>

                        <TouchableOpacity
                            style={styles.tcButton}
                            onPress={() => {
                                setTcDraft(settings.terms_and_conditions || '');
                                setTcModalVisible(true);
                            }}
                        >
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <MaterialCommunityIcons name={settings.terms_and_conditions ? 'pencil' : 'plus'} size={16} color={colors.primary} />
                                <Text style={styles.tcButtonText}>
                                    {settings.terms_and_conditions ? 'Edit Terms' : 'Add Terms'}
                                </Text>
                            </View>
                        </TouchableOpacity>

                        {settings.terms_and_conditions && (
                            <View style={styles.tcPreview}>
                                <Text style={styles.tcPreviewText} numberOfLines={3}>
                                    {settings.terms_and_conditions}
                                </Text>
                            </View>
                        )}

                        <View style={styles.switchRow}>
                            <View style={styles.switchLabel}>
                                <Text style={styles.switchTitle}>Require Acceptance</Text>
                                <Text style={styles.switchDescription}>
                                    Clients must accept T&C before booking
                                </Text>
                            </View>
                            <Switch
                                value={settings.require_tc_acceptance}
                                onValueChange={(value) =>
                                    setSettings({ ...settings, require_tc_acceptance: value })
                                }
                                trackColor={{ false: colors.border, true: colors.primary }}
                                thumbColor={colors.text}
                            />
                        </View>
                    </Card>

                    {canManagePilates && pilatesServiceId && (
                    <Card style={styles.section}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.xs }}>
                            <MaterialCommunityIcons name="yoga" size={20} color={colors.accent} />
                            <MerakiText variant="body" color={colors.text} style={{ fontWeight: '600', fontSize: 18 }}>Pilates Settings</MerakiText>
                        </View>
                        <MerakiText variant="caption" color={colors.textSecondary} style={{ marginBottom: spacing.md }}>
                            Configure session details that differ from standard beauty bookings.
                        </MerakiText>

                        <View style={styles.formRow}>
                            <View style={styles.formHalf}>
                                <Text style={styles.inputLabel}>Default Capacity</Text>
                                <TextInput
                                    style={styles.input}
                                    value={String(pilatesSettings.default_capacity)}
                                    onChangeText={(value) => setPilatesSettings({ ...pilatesSettings, default_capacity: Number(value) || 1 })}
                                    keyboardType="number-pad"
                                />
                            </View>
                            <View style={styles.formHalf}>
                                <Text style={styles.inputLabel}>Session Duration</Text>
                                <TextInput
                                    style={styles.input}
                                    value={String(pilatesSettings.default_session_duration_minutes)}
                                    onChangeText={(value) => setPilatesSettings({ ...pilatesSettings, default_session_duration_minutes: Number(value) || 50 })}
                                    keyboardType="number-pad"
                                />
                            </View>
                        </View>

                        <View style={styles.formRow}>
                            <View style={styles.formHalf}>
                                <Text style={styles.inputLabel}>Buffer Minutes</Text>
                                <TextInput
                                    style={styles.input}
                                    value={String(pilatesSettings.buffer_minutes)}
                                    onChangeText={(value) => setPilatesSettings({ ...pilatesSettings, buffer_minutes: Number(value) || 0 })}
                                    keyboardType="number-pad"
                                />
                            </View>
                            <View style={styles.formHalf}>
                                <Text style={styles.inputLabel}>Default Level</Text>
                                <TouchableOpacity
                                    style={styles.selector}
                                    onPress={() => setPickerVisible('pilates_level')}
                                >
                                    <Text style={styles.selectorText}>{pilatesSettings.default_level}</Text>
                                    <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />
                                </TouchableOpacity>
                            </View>
                        </View>

                        <View style={styles.switchRow}>
                            <View style={styles.switchLabel}>
                                <Text style={styles.switchTitle}>Equipment Provided</Text>
                                <Text style={styles.switchDescription}>Clients can attend without bringing their own equipment</Text>
                            </View>
                            <Switch
                                value={pilatesSettings.equipment_provided}
                                onValueChange={(value) => setPilatesSettings({ ...pilatesSettings, equipment_provided: value })}
                                trackColor={{ false: colors.border, true: colors.primary }}
                                thumbColor={colors.text}
                            />
                        </View>

                        <View style={[styles.switchRow, { marginTop: spacing.md }]}>
                            <View style={styles.switchLabel}>
                                <Text style={styles.switchTitle}>Require Health Declaration</Text>
                                <Text style={styles.switchDescription}>Show safety requirement before clients complete booking</Text>
                            </View>
                            <Switch
                                value={pilatesSettings.require_health_declaration}
                                onValueChange={(value) => setPilatesSettings({ ...pilatesSettings, require_health_declaration: value })}
                                trackColor={{ false: colors.border, true: colors.primary }}
                                thumbColor={colors.text}
                            />
                        </View>

                        <Text style={[styles.inputLabel, { marginTop: spacing.md }]}>Equipment Notes</Text>
                        <TextInput
                            style={[styles.input, styles.multilineInput]}
                            value={pilatesSettings.equipment_notes}
                            onChangeText={(value) => setPilatesSettings({ ...pilatesSettings, equipment_notes: value })}
                            placeholder="Tell clients what is provided or what to bring..."
                            placeholderTextColor={colors.textMuted}
                            multiline
                            textAlignVertical="top"
                        />

                        <Text style={[styles.inputLabel, { marginTop: spacing.md }]}>Location Notes</Text>
                        <TextInput
                            style={[styles.input, styles.multilineInput]}
                            value={pilatesSettings.location_notes}
                            onChangeText={(value) => setPilatesSettings({ ...pilatesSettings, location_notes: value })}
                            placeholder="Studio room, parking, entry details..."
                            placeholderTextColor={colors.textMuted}
                            multiline
                            textAlignVertical="top"
                        />
                    </Card>
                    )}

                    {/* Visibility Settings */}
                    <Card style={styles.section}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.xs }}>
                            <MaterialCommunityIcons name="eye-outline" size={20} color={colors.accent} />
                            <MerakiText variant="body" color={colors.text} style={{ fontWeight: '600', fontSize: 18 }}>Visibility</MerakiText>
                        </View>

                        <View style={styles.switchRow}>
                            <View style={styles.switchLabel}>
                                <Text style={styles.switchTitle}>Accept New Clients</Text>
                                <Text style={styles.switchDescription}>
                                    Allow new clients to book with you
                                </Text>
                            </View>
                            <Switch
                                value={settings.accepts_new_clients}
                                onValueChange={(value) =>
                                    setSettings({ ...settings, accepts_new_clients: value })
                                }
                                trackColor={{ false: colors.border, true: colors.primary }}
                                thumbColor={colors.text}
                            />
                        </View>

                        <View style={[styles.switchRow, { marginTop: spacing.md }]}>
                            <View style={styles.switchLabel}>
                                <Text style={styles.switchTitle}>Show in Global Discovery</Text>
                                <Text style={styles.switchDescription}>
                                    Appear in search results for clients in your area
                                </Text>
                            </View>
                            <Switch
                                value={settings.is_visible_globally}
                                onValueChange={(value) =>
                                    setSettings({ ...settings, is_visible_globally: value })
                                }
                                trackColor={{ false: colors.border, true: colors.primary }}
                                thumbColor={colors.text}
                            />
                        </View>
                    </Card>
                </ScrollView>

                <View style={styles.bottomBar}>
                    <Button
                        title={saving ? 'Saving...' : 'Save Changes'}
                        onPress={handleSave}
                        loading={saving}
                        fullWidth
                    />
                </View>

                {renderPicker()}
                {renderTcModal()}
            </SafeAreaView>
        </ScreenBackground>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: { color: colors.text, fontSize: 16 },
    header: {
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.lg,
        paddingBottom: spacing.md,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: 'rgba(0, 0, 0, 0.04)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.08)',
        marginBottom: spacing.sm,
    },
    title: { fontSize: 28, fontWeight: '600', color: colors.text },
    subtitle: { fontSize: 14, color: colors.textSecondary, marginTop: spacing.xs },
    content: { padding: spacing.lg, paddingBottom: 100 },

    section: { marginBottom: spacing.lg, padding: spacing.lg },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: colors.text,
        marginBottom: spacing.xs,
    },
    sectionDescription: {
        fontSize: 14,
        color: colors.textSecondary,
        marginBottom: spacing.md,
    },

    selector: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'rgba(0, 0, 0, 0.04)',
        borderRadius: 12,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: colors.border,
    },
    selectorText: {
        fontSize: 16,
        color: colors.text,
        flex: 1,
    },
    selectorArrow: {
        fontSize: 20,
        color: colors.textMuted,
        marginLeft: spacing.sm,
    },

    formRow: {
        flexDirection: 'row',
        gap: spacing.md,
        marginBottom: spacing.md,
    },
    formHalf: {
        flex: 1,
    },
    inputLabel: {
        fontSize: 13,
        color: colors.textSecondary,
        marginBottom: spacing.xs,
        fontWeight: '500',
    },
    input: {
        backgroundColor: 'rgba(0, 0, 0, 0.04)',
        borderRadius: 12,
        padding: spacing.md,
        color: colors.text,
        fontSize: 16,
        borderWidth: 1,
        borderColor: colors.border,
    },
    multilineInput: {
        minHeight: 88,
    },

    switchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    switchLabel: { flex: 1, marginRight: spacing.md },
    switchTitle: { fontSize: 16, color: colors.text, fontWeight: '500' },
    switchDescription: { fontSize: 13, color: colors.textMuted, marginTop: 2 },

    tcButton: {
        backgroundColor: 'rgba(200, 160, 77, 0.2)',
        borderRadius: 12,
        padding: spacing.md,
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    tcButtonText: {
        fontSize: 16,
        color: colors.primary,
        fontWeight: '600',
    },
    tcPreview: {
        backgroundColor: 'rgba(0, 0, 0, 0.02)',
        borderRadius: 8,
        padding: spacing.sm,
        marginBottom: spacing.md,
    },
    tcPreviewText: {
        fontSize: 13,
        color: colors.textSecondary,
        fontStyle: 'italic',
    },

    tcModalContainer: {
        flex: 1,
    },
    tcModalHeader: {
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.lg,
        paddingBottom: spacing.md,
    },
    tcContentArea: {
        flex: 1,
        padding: spacing.lg,
    },
    tcInputCard: {
        flex: 1,
        padding: spacing.lg,
    },
    tcInput: {
        flex: 1,
        fontSize: 16,
        color: colors.text,
        lineHeight: 24,
    },
    tcBottomBar: {
        padding: spacing.lg,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },

    bottomBar: {
        padding: spacing.lg,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },

    // Modal styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: colors.surface,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: '70%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: colors.text,
    },
    modalClose: {
        fontSize: 20,
        color: colors.textMuted,
        padding: spacing.sm,
    },
    optionsScroll: {
        padding: spacing.md,
    },
    optionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.md,
        borderRadius: 8,
        marginBottom: spacing.xs,
    },
    optionItemSelected: {
        backgroundColor: 'rgba(200, 160, 77, 0.2)',
    },
    optionText: {
        fontSize: 16,
        color: colors.text,
        flex: 1,
    },
    optionTextSelected: {
        color: colors.primary,
        fontWeight: '500',
    },
    checkmark: {
        fontSize: 18,
        color: colors.primary,
        fontWeight: '600',
    },
});

export default BusinessSettingsScreen;
