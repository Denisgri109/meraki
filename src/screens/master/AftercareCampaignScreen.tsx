
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
import { useModal } from '../../contexts/ModalContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Card, Button, ScreenBackground } from '../../components/ui';
import { colors, spacing } from '../../theme';

type Campaign = {
    id: string;
    name: string;
    message: string;
    campaign_type: 'aftercare' | 'promotion' | 'vacation' | 'announcement';
    is_recurring: boolean;
    days_after_appointment: number | null;
    service_category: string | null;
    start_date: string | null;
    end_date: string | null;
    is_active: boolean;
};

const CAMPAIGN_TYPES = [
    { value: 'aftercare', label: 'Aftercare Reminder', icon: '💆', description: 'Sent X days after appointment' },
    { value: 'promotion', label: 'Promotion', icon: '🎉', description: 'Special offer for clients' },
    { value: 'vacation', label: 'Vacation Notice', icon: '🏖️', description: 'Let clients know you\'re away' },
    { value: 'announcement', label: 'Announcement', icon: '📢', description: 'General update for clients' },
];

const AFTERCARE_OPTIONS = [7, 14, 21, 30, 45, 60, 90];
const CUSTOM_OPTION = 'custom';

export function AftercareCampaignScreen() {
    const navigation = useNavigation<any>();
    const { user } = useAuth();
    const { showAlert, showConfirm } = useModal();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [showEditor, setShowEditor] = useState(false);
    const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);

    // Form state
    const [name, setName] = useState('');
    const [message, setMessage] = useState('');
    const [campaignType, setCampaignType] = useState<Campaign['campaign_type']>('aftercare');
    const [isRecurring, setIsRecurring] = useState(true);
    const [daysAfter, setDaysAfter] = useState(30);
    const [isCustomDays, setIsCustomDays] = useState(false);
    const [customDays, setCustomDays] = useState('');
    const [startDate, setStartDate] = useState<Date | null>(null);
    const [endDate, setEndDate] = useState<Date | null>(null);
    const [showStartPicker, setShowStartPicker] = useState(false);
    const [showEndPicker, setShowEndPicker] = useState(false);

    useEffect(() => {
        loadCampaigns();
    }, []);

    const loadCampaigns = async () => {
        if (!user) return;
        try {
            const { data, error } = await (supabase as any)
                .from('aftercare_campaigns')
                .select('*')
                .eq('master_id', user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setCampaigns(data || []);
        } catch (error) {
            console.error('Error loading campaigns:', error);
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setName('');
        setMessage('');
        setCampaignType('aftercare');
        setIsRecurring(true);
        setDaysAfter(30);
        setIsCustomDays(false);
        setCustomDays('');
        setStartDate(null);
        setEndDate(null);
        setEditingCampaign(null);
    };

    const openEditor = (campaign?: Campaign) => {
        if (campaign) {
            setEditingCampaign(campaign);
            setName(campaign.name);
            setMessage(campaign.message);
            setCampaignType(campaign.campaign_type);
            setIsRecurring(campaign.is_recurring);

            // Check if days_after_appointment is a preset value or custom
            const campaignDays = campaign.days_after_appointment || 30;
            if (AFTERCARE_OPTIONS.includes(campaignDays)) {
                setDaysAfter(campaignDays);
                setIsCustomDays(false);
                setCustomDays('');
            } else {
                setIsCustomDays(true);
                setCustomDays(campaignDays.toString());
                setDaysAfter(campaignDays);
            }

            setStartDate(campaign.start_date ? new Date(campaign.start_date) : null);
            setEndDate(campaign.end_date ? new Date(campaign.end_date) : null);
        } else {
            resetForm();
        }
        setShowEditor(true);
    };

    const handleSave = async () => {
        if (!user) return;
        if (!name.trim() || !message.trim()) {
            showAlert('Error', 'Please fill in all required fields', 'error');
            return;
        }

        // Calculate final days value
        let finalDaysAfter = daysAfter;
        if (isCustomDays) {
            const parsedCustomDays = parseInt(customDays, 10);
            if (isNaN(parsedCustomDays) || parsedCustomDays <= 0) {
                showAlert('Error', 'Please enter a valid number of days', 'error');
                return;
            }
            finalDaysAfter = parsedCustomDays;
        }

        setSaving(true);
        try {
            const campaignData = {
                master_id: user.id,
                name: name.trim(),
                message: message.trim(),
                campaign_type: campaignType,
                is_recurring: campaignType === 'aftercare' ? isRecurring : false,
                days_after_appointment: campaignType === 'aftercare' ? finalDaysAfter : null,
                start_date: ['vacation', 'promotion'].includes(campaignType) && startDate
                    ? startDate.toISOString().split('T')[0] : null,
                end_date: ['vacation', 'promotion'].includes(campaignType) && endDate
                    ? endDate.toISOString().split('T')[0] : null,
                is_active: true,
            };


            if (editingCampaign) {
                const { error } = await (supabase as any)
                    .from('aftercare_campaigns')
                    .update(campaignData)
                    .eq('id', editingCampaign.id);
                if (error) throw error;
            } else {
                const { error } = await (supabase as any)
                    .from('aftercare_campaigns')
                    .insert(campaignData);
                if (error) throw error;
            }

            await loadCampaigns();
            setShowEditor(false);
            resetForm();
            showAlert('Success', editingCampaign ? 'Campaign updated!' : 'Campaign created!', 'success');
        } catch (error: any) {
            showAlert('Error', error.message || 'Failed to save campaign', 'error');
        } finally {
            setSaving(false);
        }
    };

    const toggleCampaignActive = async (campaign: Campaign) => {
        try {
            const { error } = await (supabase as any)
                .from('aftercare_campaigns')
                .update({ is_active: !campaign.is_active })
                .eq('id', campaign.id);

            if (error) throw error;
            await loadCampaigns();
        } catch (error: any) {
            showAlert('Error', error.message, 'error');
        }
    };

    const deleteCampaign = (campaign: Campaign) => {
        showConfirm(
            'Delete Campaign',
            `Are you sure you want to delete "${campaign.name}" ? `,
            async () => {
                try {
                    const { error } = await (supabase as any)
                        .from('aftercare_campaigns')
                        .delete()
                        .eq('id', campaign.id);
                    if (error) throw error;
                    await loadCampaigns();
                } catch (error: any) {
                    showAlert('Error', error.message, 'error');
                }
            },
            {
                type: 'warning',
                confirmText: 'Delete',
                cancelText: 'Cancel'
            }
        );
    };

    const getCampaignIcon = (type: Campaign['campaign_type']) => {
        return CAMPAIGN_TYPES.find(t => t.value === type)?.icon || '📢';
    };

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    };

    const renderEditor = () => (
        <Modal visible={showEditor} animationType="slide" onRequestClose={() => setShowEditor(false)}>
            <ScreenBackground>
                <SafeAreaView style={styles.editorContainer}>
                    <View style={styles.editorHeader}>
                        <TouchableOpacity onPress={() => setShowEditor(false)}>
                            <Text style={styles.cancelButton}>Cancel</Text>
                        </TouchableOpacity>
                        <Text style={styles.editorTitle}>
                            {editingCampaign ? 'Edit Campaign' : 'New Campaign'}
                        </Text>
                        <TouchableOpacity onPress={handleSave} disabled={saving}>
                            <Text style={[styles.saveButton, saving && styles.disabledButton]}>
                                {saving ? 'Saving...' : 'Save'}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    <ScrollView contentContainerStyle={styles.editorContent}>
                        {/* Campaign Type */}
                        <View style={styles.field}>
                            <Text style={styles.label}>Campaign Type</Text>
                            {CAMPAIGN_TYPES.map((type) => (
                                <TouchableOpacity
                                    key={type.value}
                                    style={[styles.typeOption, campaignType === type.value && styles.typeOptionSelected]}
                                    onPress={() => setCampaignType(type.value as any)}
                                >
                                    <Text style={styles.typeIcon}>{type.icon}</Text>
                                    <View style={styles.typeInfo}>
                                        <Text style={[styles.typeLabel, campaignType === type.value && styles.typeLabelSelected]}>
                                            {type.label}
                                        </Text>
                                        <Text style={styles.typeDesc}>{type.description}</Text>
                                    </View>
                                    {campaignType === type.value && (
                                        <MaterialCommunityIcons name="check" size={20} color={colors.primary} />
                                    )}
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* Name */}
                        <View style={styles.field}>
                            <Text style={styles.label}>Campaign Name *</Text>
                            <TextInput
                                style={styles.input}
                                value={name}
                                onChangeText={setName}
                                placeholder="e.g., Brow Touch-up Reminder"
                                placeholderTextColor={colors.textMuted}
                            />
                        </View>

                        {/* Message */}
                        <View style={styles.field}>
                            <Text style={styles.label}>Message *</Text>
                            <TextInput
                                style={[styles.input, styles.textArea]}
                                value={message}
                                onChangeText={setMessage}
                                placeholder="Hi {name}! It's time for your touch-up appointment..."
                                placeholderTextColor={colors.textMuted}
                                multiline
                                numberOfLines={4}
                            />
                            <Text style={styles.hint}>Use {'{name}'} for client's name</Text>
                        </View>

                        {/* Aftercare Options */}
                        {campaignType === 'aftercare' && (
                            <>
                                <View style={styles.field}>
                                    <Text style={styles.label}>Send After (days)</Text>
                                    <View style={styles.daysOptions}>
                                        {AFTERCARE_OPTIONS.map((days) => (
                                            <TouchableOpacity
                                                key={days}
                                                style={[styles.daysOption, !isCustomDays && daysAfter === days && styles.daysOptionSelected]}
                                                onPress={() => {
                                                    setDaysAfter(days);
                                                    setIsCustomDays(false);
                                                    setCustomDays('');
                                                }}
                                            >
                                                <Text style={[styles.daysText, !isCustomDays && daysAfter === days && styles.daysTextSelected]}>
                                                    {days}d
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                        <TouchableOpacity
                                            style={[styles.daysOption, isCustomDays && styles.daysOptionSelected]}
                                            onPress={() => {
                                                setIsCustomDays(true);
                                                if (!customDays) {
                                                    setCustomDays('');
                                                }
                                            }}
                                        >
                                            <Text style={[styles.daysText, isCustomDays && styles.daysTextSelected]}>
                                                Custom
                                            </Text>
                                        </TouchableOpacity>
                                    </View>

                                    {isCustomDays && (
                                        <View style={styles.customDaysContainer}>
                                            <TextInput
                                                style={styles.customDaysInput}
                                                value={customDays}
                                                onChangeText={setCustomDays}
                                                placeholder="Enter days..."
                                                placeholderTextColor={colors.textMuted}
                                                keyboardType="number-pad"
                                                autoFocus
                                            />
                                            <Text style={styles.customDaysLabel}>days</Text>
                                        </View>
                                    )}
                                </View>

                                <View style={styles.switchRow}>
                                    <View>
                                        <Text style={styles.switchLabel}>Recurring</Text>
                                        <Text style={styles.switchHint}>Send after every appointment</Text>
                                    </View>
                                    <Switch
                                        value={isRecurring}
                                        onValueChange={setIsRecurring}
                                        trackColor={{ false: colors.border, true: colors.primary }}
                                    />
                                </View>
                            </>
                        )}

                        {/* Date Range for Vacation/Promotion */}
                        {['vacation', 'promotion'].includes(campaignType) && (
                            <View style={styles.field}>
                                <Text style={styles.label}>Date Range</Text>
                                <View style={styles.dateRow}>
                                    <TouchableOpacity
                                        style={styles.dateButton}
                                        onPress={() => setShowStartPicker(true)}
                                    >
                                        <MaterialCommunityIcons name="calendar" size={18} color={colors.textSecondary} />
                                        <Text style={styles.dateText}>
                                            {startDate ? startDate.toLocaleDateString() : 'Start Date'}
                                        </Text>
                                    </TouchableOpacity>
                                    <Text style={styles.dateSeparator}>to</Text>
                                    <TouchableOpacity
                                        style={styles.dateButton}
                                        onPress={() => setShowEndPicker(true)}
                                    >
                                        <MaterialCommunityIcons name="calendar" size={18} color={colors.textSecondary} />
                                        <Text style={styles.dateText}>
                                            {endDate ? endDate.toLocaleDateString() : 'End Date'}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}
                    </ScrollView>

                    {showStartPicker && (
                        <DateTimePicker
                            value={startDate || new Date()}
                            mode="date"
                            display="default"
                            onChange={(_: any, date: Date | undefined) => {
                                setShowStartPicker(false);
                                if (date) setStartDate(date);
                            }}
                        />
                    )}
                    {showEndPicker && (
                        <DateTimePicker
                            value={endDate || new Date()}
                            mode="date"
                            display="default"
                            onChange={(_: any, date: Date | undefined) => {
                                setShowEndPicker(false);
                                if (date) setEndDate(date);
                            }}
                        />
                    )}
                </SafeAreaView>
            </ScreenBackground>
        </Modal>
    );

    return (
        <ScreenBackground>
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <View style={styles.headerRow}>
                        <View>
                            <Text style={styles.title}>Campaigns</Text>
                            <Text style={styles.subtitle}>Aftercare, promos & announcements</Text>
                        </View>
                        <TouchableOpacity style={styles.addButton} onPress={() => openEditor()}>
                            <MaterialCommunityIcons name="plus" size={24} color={colors.text} />
                        </TouchableOpacity>
                    </View>
                </View>

                <ScrollView contentContainerStyle={styles.content}>
                    {campaigns.length === 0 ? (
                        <Card style={styles.emptyCard}>
                            <Text style={styles.emptyIcon}>📬</Text>
                            <Text style={styles.emptyTitle}>No Campaigns Yet</Text>
                            <Text style={styles.emptyText}>
                                Create aftercare reminders, promotions, or vacation notices
                            </Text>
                            <Button
                                title="Create Campaign"
                                onPress={() => openEditor()}
                                style={{ marginTop: spacing.lg }}
                            />
                        </Card>
                    ) : (
                        campaigns.map((campaign) => (
                            <Card key={campaign.id} style={[styles.campaignCard, !campaign.is_active && styles.campaignInactive] as any}>
                                <View style={styles.campaignHeader}>
                                    <Text style={styles.campaignIcon}>{getCampaignIcon(campaign.campaign_type)}</Text>
                                    <View style={styles.campaignInfo}>
                                        <Text style={styles.campaignName}>{campaign.name}</Text>
                                        <Text style={styles.campaignType}>
                                            {CAMPAIGN_TYPES.find(t => t.value === campaign.campaign_type)?.label}
                                        </Text>
                                    </View>
                                    <View style={[styles.statusBadge, campaign.is_active ? styles.activeBadge : styles.inactiveBadge]}>
                                        <Text style={styles.statusText}>{campaign.is_active ? 'Active' : 'Paused'}</Text>
                                    </View>
                                </View>

                                <Text style={styles.campaignMessage} numberOfLines={2}>{campaign.message}</Text>

                                {campaign.campaign_type === 'aftercare' && (
                                    <View style={styles.campaignMeta}>
                                        <Text style={styles.metaText}>
                                            📅 {campaign.days_after_appointment} days after appointment
                                            {campaign.is_recurring && ' • Recurring'}
                                        </Text>
                                    </View>
                                )}

                                {['vacation', 'promotion'].includes(campaign.campaign_type) && campaign.start_date && (
                                    <View style={styles.campaignMeta}>
                                        <Text style={styles.metaText}>
                                            📅 {formatDate(campaign.start_date)} - {formatDate(campaign.end_date)}
                                        </Text>
                                    </View>
                                )}

                                <View style={styles.campaignActions}>
                                    <TouchableOpacity style={styles.actionBtn} onPress={() => openEditor(campaign)}>
                                        <MaterialCommunityIcons name="pencil" size={18} color={colors.text} />
                                        <Text style={styles.actionText}>Edit</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.actionBtn} onPress={() => toggleCampaignActive(campaign)}>
                                        <MaterialCommunityIcons
                                            name={campaign.is_active ? 'pause' : 'play'}
                                            size={18}
                                            color={colors.text}
                                        />
                                        <Text style={styles.actionText}>{campaign.is_active ? 'Pause' : 'Activate'}</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.actionBtn} onPress={() => deleteCampaign(campaign)}>
                                        <MaterialCommunityIcons name="trash-can-outline" size={18} color="#EF4444" />
                                        <Text style={[styles.actionText, { color: '#EF4444' }]}>Delete</Text>
                                    </TouchableOpacity>
                                </View>
                            </Card>
                        ))
                    )}
                </ScrollView>

                {renderEditor()}
            </SafeAreaView>
        </ScreenBackground>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
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
        marginRight: spacing.md,
    },
    // backButtonText: { fontSize: 16, color: colors.primary, fontWeight: '500' },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    title: { fontSize: 28, fontWeight: '600', color: colors.text },
    subtitle: { fontSize: 14, color: colors.textSecondary, marginTop: spacing.xs },
    addButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
    },
    content: { padding: spacing.lg, paddingBottom: 100 },
    emptyCard: { alignItems: 'center', padding: spacing.xl },
    emptyIcon: { fontSize: 48, marginBottom: spacing.md },
    emptyTitle: { fontSize: 18, fontWeight: '600', color: colors.text, marginBottom: spacing.xs },
    emptyText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center' },
    campaignCard: { marginBottom: spacing.md, padding: spacing.lg },
    campaignInactive: { opacity: 0.6 },
    campaignHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
    campaignIcon: { fontSize: 28, marginRight: spacing.md },
    campaignInfo: { flex: 1 },
    campaignName: { fontSize: 16, fontWeight: '600', color: colors.text },
    campaignType: { fontSize: 12, color: colors.textSecondary },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    activeBadge: { backgroundColor: 'rgba(16, 185, 129, 0.2)' },
    inactiveBadge: { backgroundColor: 'rgba(156, 163, 175, 0.2)' },
    statusText: { fontSize: 11, fontWeight: '600', color: colors.text },
    campaignMessage: { fontSize: 14, color: colors.textSecondary, marginBottom: spacing.sm },
    campaignMeta: { marginBottom: spacing.sm },
    metaText: { fontSize: 12, color: colors.textMuted },
    campaignActions: { flexDirection: 'row', gap: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md },
    actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    actionText: { fontSize: 13, color: colors.text },
    // Editor
    editorContainer: { flex: 1 },
    editorHeader: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
        borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    cancelButton: { fontSize: 16, color: colors.textSecondary },
    saveButton: { fontSize: 16, color: colors.primary, fontWeight: '600' },
    disabledButton: { opacity: 0.5 },
    editorTitle: { fontSize: 18, fontWeight: '600', color: colors.text },
    editorContent: { padding: spacing.lg },
    field: { marginBottom: spacing.lg },
    label: { fontSize: 12, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.sm },
    input: {
        backgroundColor: 'rgba(0, 0, 0, 0.04)', borderRadius: 12,
        padding: spacing.md, fontSize: 16, color: colors.text,
        borderWidth: 1, borderColor: colors.border,
    },
    textArea: { height: 100, textAlignVertical: 'top' },
    hint: { fontSize: 11, color: colors.textMuted, marginTop: 4 },
    typeOption: {
        flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderRadius: 12,
        backgroundColor: colors.surface, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border,
    },
    typeOptionSelected: { borderColor: colors.primary, backgroundColor: 'rgba(200, 160, 77, 0.1)' },
    typeIcon: { fontSize: 24, marginRight: spacing.md },
    typeInfo: { flex: 1 },
    typeLabel: { fontSize: 16, color: colors.text },
    typeLabelSelected: { fontWeight: '600' },
    typeDesc: { fontSize: 12, color: colors.textMuted },
    daysOptions: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
    daysOption: {
        paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8,
        backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    },
    daysOptionSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
    daysText: { fontSize: 14, fontWeight: '600', color: colors.text },
    daysTextSelected: { color: '#fff' },
    customDaysContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: spacing.md,
        gap: spacing.sm
    },
    customDaysInput: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.04)',
        borderRadius: 8,
        padding: spacing.md,
        fontSize: 16,
        color: colors.text,
        borderWidth: 1,
        borderColor: colors.primary,
        minWidth: 100,
    },
    customDaysLabel: {
        fontSize: 14,
        color: colors.textSecondary,
        fontWeight: '500'
    },
    switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
    switchLabel: { fontSize: 16, color: colors.text },
    switchHint: { fontSize: 12, color: colors.textMuted },
    dateRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    dateButton: {
        flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
        padding: spacing.md, borderRadius: 12, backgroundColor: colors.surface,
        borderWidth: 1, borderColor: colors.border,
    },
    dateText: { fontSize: 14, color: colors.text },
    dateSeparator: { fontSize: 14, color: colors.textMuted },
});

export default AftercareCampaignScreen;
