import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Alert,
    TextInput,
    Modal,
    Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Card, Button, ScreenBackground } from '../../components/ui';
import { colors, spacing } from '../../theme';

// Types for master settings
interface MasterBusinessSettings {
    confirmation_timing_hours: number;
    cancellation_charge_percent: number;
    late_cancellation_window_hours: number;
    no_show_charge_percent: number;
    late_arrival_minutes: number;
    terms_and_conditions: string | null;
    require_tc_acceptance: boolean;
    accepts_new_clients: boolean;
    is_visible_globally: boolean;
}

const DEFAULT_SETTINGS: MasterBusinessSettings = {
    confirmation_timing_hours: 24,
    cancellation_charge_percent: 50,
    late_cancellation_window_hours: 24,
    no_show_charge_percent: 100,
    late_arrival_minutes: 15,
    terms_and_conditions: null,
    require_tc_acceptance: true,
    accepts_new_clients: true,
    is_visible_globally: true,
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

const PERCENTAGE_OPTIONS = [
    { value: 0, label: '0% (No charge)' },
    { value: 25, label: '25%' },
    { value: 50, label: '50%' },
    { value: 75, label: '75%' },
    { value: 100, label: '100% (Full charge)' },
];

type PickerType = 'confirmation' | 'late_arrival' | 'cancellation_percent' | 'noshow_percent' | null;

export function BusinessSettingsScreen() {
    const navigation = useNavigation();
    const { user } = useAuth();

    const [settings, setSettings] = useState<MasterBusinessSettings>(DEFAULT_SETTINGS);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [pickerVisible, setPickerVisible] = useState<PickerType>(null);
    const [tcModalVisible, setTcModalVisible] = useState(false);
    const [tcDraft, setTcDraft] = useState('');

    useEffect(() => {
        loadSettings();
    }, []);

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
                    cancellation_charge_percent: data.cancellation_charge_percent ?? 50,
                    late_cancellation_window_hours: data.late_cancellation_window_hours ?? 24,
                    no_show_charge_percent: data.no_show_charge_percent ?? 100,
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

            Alert.alert('Success', 'Your business settings have been saved!');
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to save settings');
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

        let items: { value: number; label: string }[] = [];
        let title = '';
        let currentValue: number = 0;

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
            case 'cancellation_percent':
                items = PERCENTAGE_OPTIONS;
                title = 'Late Cancellation Charge';
                currentValue = settings.cancellation_charge_percent;
                break;
            case 'noshow_percent':
                items = PERCENTAGE_OPTIONS;
                title = 'No-Show Charge';
                currentValue = settings.no_show_charge_percent;
                break;
        }

        const onSelect = (value: number) => {
            switch (pickerVisible) {
                case 'confirmation':
                    setSettings({ ...settings, confirmation_timing_hours: value });
                    break;
                case 'late_arrival':
                    setSettings({ ...settings, late_arrival_minutes: value });
                    break;
                case 'cancellation_percent':
                    setSettings({ ...settings, cancellation_charge_percent: value });
                    break;
                case 'noshow_percent':
                    setSettings({ ...settings, no_show_charge_percent: value });
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
                            <Text style={styles.modalTitle}>{title}</Text>
                            <TouchableOpacity onPress={() => setPickerVisible(null)}>
                                <Text style={styles.modalClose}>✕</Text>
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
                                            <Text style={styles.checkmark}>✓</Text>
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
            onRequestClose={() => setTcModalVisible(false)}
        >
            <SafeAreaView style={styles.tcModalContainer}>
                <View style={styles.tcModalHeader}>
                    <TouchableOpacity onPress={() => setTcModalVisible(false)}>
                        <Text style={styles.tcHeaderButton}>Cancel</Text>
                    </TouchableOpacity>
                    <Text style={styles.tcHeaderTitle}>Terms & Conditions</Text>
                    <TouchableOpacity onPress={saveTc}>
                        <Text style={[styles.tcHeaderButton, styles.tcSaveButton]}>Save</Text>
                    </TouchableOpacity>
                </View>
                <TextInput
                    style={styles.tcInput}
                    multiline
                    placeholder="Enter your Terms & Conditions here...

Example:
- Cancellation Policy: Appointments cancelled within 24 hours will be charged 50%.
- Late Arrivals: If you are more than 15 minutes late, the appointment may be cancelled.
- Payment: Full payment is due at the time of service.
- Consultations: Certain services require a consultation before booking."
                    placeholderTextColor={colors.textMuted}
                    value={tcDraft}
                    onChangeText={setTcDraft}
                    textAlignVertical="top"
                />
            </SafeAreaView>
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
                        <Text style={styles.backButtonText}>← Back</Text>
                    </TouchableOpacity>
                    <View>
                        <Text style={styles.title}>Business Settings</Text>
                        <Text style={styles.subtitle}>Configure your booking policies and preferences</Text>
                    </View>
                </View>

                <ScrollView contentContainerStyle={styles.content}>
                    {/* Confirmation Timing */}
                    <Card style={styles.section}>
                        <Text style={styles.sectionTitle}>📅 Appointment Confirmations</Text>
                        <Text style={styles.sectionDescription}>
                            When should clients receive confirmation reminders?
                        </Text>
                        <TouchableOpacity
                            style={styles.selector}
                            onPress={() => setPickerVisible('confirmation')}
                        >
                            <Text style={styles.selectorText}>
                                {CONFIRMATION_OPTIONS.find(o => o.value === settings.confirmation_timing_hours)?.label || '24 hours before'}
                            </Text>
                            <Text style={styles.selectorArrow}>›</Text>
                        </TouchableOpacity>
                    </Card>

                    {/* Late Arrival Policy */}
                    <Card style={styles.section}>
                        <Text style={styles.sectionTitle}>⏰ Late Arrival Policy</Text>
                        <Text style={styles.sectionDescription}>
                            After how many minutes is a client considered late? Late arrivals can be marked as no-show.
                        </Text>
                        <TouchableOpacity
                            style={styles.selector}
                            onPress={() => setPickerVisible('late_arrival')}
                        >
                            <Text style={styles.selectorText}>
                                {LATE_ARRIVAL_OPTIONS.find(o => o.value === settings.late_arrival_minutes)?.label || '15 minutes'}
                            </Text>
                            <Text style={styles.selectorArrow}>›</Text>
                        </TouchableOpacity>
                    </Card>

                    {/* Cancellation Charge */}
                    <Card style={styles.section}>
                        <Text style={styles.sectionTitle}>💸 Late Cancellation Charge</Text>
                        <Text style={styles.sectionDescription}>
                            What percentage to charge when clients cancel within {settings.late_cancellation_window_hours} hours of appointment?
                        </Text>
                        <TouchableOpacity
                            style={styles.selector}
                            onPress={() => setPickerVisible('cancellation_percent')}
                        >
                            <Text style={styles.selectorText}>
                                {PERCENTAGE_OPTIONS.find(o => o.value === settings.cancellation_charge_percent)?.label || '50%'}
                            </Text>
                            <Text style={styles.selectorArrow}>›</Text>
                        </TouchableOpacity>
                    </Card>

                    {/* No-Show Charge */}
                    <Card style={styles.section}>
                        <Text style={styles.sectionTitle}>🚫 No-Show Charge</Text>
                        <Text style={styles.sectionDescription}>
                            What percentage to charge when clients confirm but don't show up?
                        </Text>
                        <TouchableOpacity
                            style={styles.selector}
                            onPress={() => setPickerVisible('noshow_percent')}
                        >
                            <Text style={styles.selectorText}>
                                {PERCENTAGE_OPTIONS.find(o => o.value === settings.no_show_charge_percent)?.label || '100%'}
                            </Text>
                            <Text style={styles.selectorArrow}>›</Text>
                        </TouchableOpacity>
                    </Card>

                    {/* Terms & Conditions */}
                    <Card style={styles.section}>
                        <Text style={styles.sectionTitle}>📋 Terms & Conditions</Text>
                        <Text style={styles.sectionDescription}>
                            Set your booking terms. Clients must accept these before booking.
                        </Text>

                        <TouchableOpacity
                            style={styles.tcButton}
                            onPress={() => {
                                setTcDraft(settings.terms_and_conditions || '');
                                setTcModalVisible(true);
                            }}
                        >
                            <Text style={styles.tcButtonText}>
                                {settings.terms_and_conditions ? '✏️ Edit Terms' : '➕ Add Terms'}
                            </Text>
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

                    {/* Visibility Settings */}
                    <Card style={styles.section}>
                        <Text style={styles.sectionTitle}>👀 Visibility</Text>

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
        marginBottom: spacing.sm,
        alignSelf: 'flex-start',
        paddingVertical: spacing.xs,
        paddingHorizontal: spacing.xs,
        marginLeft: -spacing.xs,
    },
    backButtonText: { fontSize: 16, color: colors.primary, fontWeight: '500' },
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
        backgroundColor: 'rgba(255,255,255,0.05)',
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

    switchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    switchLabel: { flex: 1, marginRight: spacing.md },
    switchTitle: { fontSize: 16, color: colors.text, fontWeight: '500' },
    switchDescription: { fontSize: 13, color: colors.textMuted, marginTop: 2 },

    tcButton: {
        backgroundColor: 'rgba(139, 92, 246, 0.2)',
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
        backgroundColor: 'rgba(255,255,255,0.03)',
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
        backgroundColor: colors.background,
    },
    tcModalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    tcHeaderButton: {
        fontSize: 16,
        color: colors.textSecondary,
    },
    tcSaveButton: {
        color: colors.primary,
        fontWeight: '600',
    },
    tcHeaderTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: colors.text,
    },
    tcInput: {
        flex: 1,
        padding: spacing.lg,
        fontSize: 16,
        color: colors.text,
        lineHeight: 24,
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
        backgroundColor: 'rgba(139, 92, 246, 0.2)',
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
