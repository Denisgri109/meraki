import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Modal,
    Platform,
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
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import { useModal } from '../../contexts/ModalContext';
import { Card, ScreenBackground } from '../../components/ui';
import { colors, spacing } from '../../theme';
import {
    createCampaign,
    deleteCampaign,
    listCampaigns,
    updateCampaign,
    AftercareCampaign,
    CampaignType,
} from '../../services/aftercareService';

const CAMPAIGN_TYPES: { value: CampaignType; label: string; color: string }[] = [
    { value: 'aftercare', label: 'Aftercare', color: '#10B981' },
    { value: 'promotion', label: 'Promotion', color: '#F59E0B' },
    { value: 'vacation', label: 'Vacation', color: '#3B82F6' },
    { value: 'announcement', label: 'Announcement', color: '#8B5CF6' },
];

const EMPTY_FORM = {
    name: '',
    message: '',
    campaignType: 'aftercare' as CampaignType,
    isRecurring: true,
    daysAfterAppointment: '2',
    sendDate: '',
    serviceCategory: '',
};

export function AftercareCampaignsScreen() {
    const navigation = useNavigation<any>();
    const { user } = useAuth();
    const { showAlert } = useModal();

    const [campaigns, setCampaigns] = useState<AftercareCampaign[]>([]);
    const [loading, setLoading] = useState(true);

    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState<AftercareCampaign | null>(null);
    const [form, setForm] = useState(EMPTY_FORM);
    const [saving, setSaving] = useState(false);

    const load = useCallback(async () => {
        if (!user?.id) return;
        setLoading(true);
        try {
            setCampaigns(await listCampaigns(user.id));
        } catch (error: any) {
            showAlert('Error', error.message || 'Failed to load campaigns', 'error');
        } finally {
            setLoading(false);
        }
    }, [user?.id, showAlert]);

    useFocusEffect(
        useCallback(() => {
            load();
        }, [load])
    );

    const openCreate = () => {
        setEditing(null);
        setForm(EMPTY_FORM);
        setShowModal(true);
    };

    const openEdit = (c: AftercareCampaign) => {
        setEditing(c);
        setForm({
            name: c.name,
            message: c.message,
            campaignType: (c.campaign_type || 'aftercare') as CampaignType,
            isRecurring: !!c.is_recurring,
            daysAfterAppointment: c.days_after_appointment ? String(c.days_after_appointment) : '',
            sendDate: c.send_date || '',
            serviceCategory: c.service_category || '',
        });
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!user?.id) return;
        if (!form.name.trim()) {
            showAlert('Validation', 'Campaign name is required', 'error');
            return;
        }
        if (!form.message.trim()) {
            showAlert('Validation', 'Message content is required', 'error');
            return;
        }
        const days = parseInt(form.daysAfterAppointment, 10);
        if (form.isRecurring && (!Number.isInteger(days) || days <= 0)) {
            showAlert('Validation', 'Days after appointment must be a positive number', 'error');
            return;
        }
        if (!form.isRecurring && !form.sendDate.trim()) {
            showAlert('Validation', 'One-time campaigns need a send date', 'error');
            return;
        }

        setSaving(true);
        try {
            if (editing) {
                const updated = await updateCampaign(editing.id, {
                    name: form.name,
                    message: form.message,
                    campaignType: form.campaignType,
                    isRecurring: form.isRecurring,
                    daysAfterAppointment: form.isRecurring ? days : null,
                    sendDate: form.isRecurring ? null : form.sendDate.trim(),
                    serviceCategory: form.serviceCategory,
                });
                setCampaigns((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
                showAlert('Saved', 'Campaign updated', 'success');
            } else {
                const created = await createCampaign(user.id, {
                    name: form.name,
                    message: form.message,
                    campaignType: form.campaignType,
                    isRecurring: form.isRecurring,
                    daysAfterAppointment: form.isRecurring ? days : null,
                    sendDate: form.isRecurring ? null : form.sendDate.trim(),
                    serviceCategory: form.serviceCategory,
                });
                setCampaigns((prev) => [created, ...prev]);
                showAlert('Created', 'Campaign created — it will send automatically on schedule', 'success');
            }
            setShowModal(false);
            setEditing(null);
            setForm(EMPTY_FORM);
        } catch (error: any) {
            showAlert('Error', error.message || 'Failed to save campaign', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleToggle = async (c: AftercareCampaign) => {
        try {
            const updated = await updateCampaign(c.id, { isActive: !c.is_active });
            setCampaigns((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
        } catch (error: any) {
            showAlert('Error', error.message || 'Failed to update campaign', 'error');
        }
    };

    const handleDelete = (c: AftercareCampaign) => {
        Alert.alert('Delete Campaign', `Delete "${c.name}"? Scheduled sends will stop.`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    try {
                        await deleteCampaign(c.id);
                        setCampaigns((prev) => prev.filter((p) => p.id !== c.id));
                        showAlert('Deleted', 'Campaign deleted', 'success');
                    } catch (error: any) {
                        showAlert('Error', error.message || 'Failed to delete campaign', 'error');
                    }
                },
            },
        ]);
    };

    const typeColor = (t: string) => CAMPAIGN_TYPES.find((x) => x.value === t)?.color || colors.textMuted;

    return (
        <ScreenBackground>
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <MaterialIcons name="arrow-back" size={22} color={colors.text} />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.title}>Aftercare & Campaigns</Text>
                        <Text style={styles.subtitle}>Automated follow-up messages after appointments</Text>
                    </View>
                    <TouchableOpacity style={styles.createButton} onPress={openCreate}>
                        <MaterialIcons name="add" size={18} color="#FFF" />
                        <Text style={styles.createButtonText}>New</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.infoBannerWrap}>
                    <View style={styles.infoBanner}>
                        <MaterialIcons name="info-outline" size={16} color={EMERALD} />
                        <Text style={styles.infoBannerText}>
                            Recurring campaigns send automatically after completed appointments, e.g. aftercare tips 2 days later.
                        </Text>
                    </View>
                </View>

                <ScrollView contentContainerStyle={styles.content}>
                    {loading ? (
                        <View style={styles.loadingBox}>
                            <ActivityIndicator size="large" color={colors.text} />
                        </View>
                    ) : campaigns.length === 0 ? (
                        <Card style={styles.emptyCard}>
                            <MaterialCommunityIcons name="bell-outline" size={36} color={colors.textMuted} />
                            <Text style={styles.emptyTitle}>No campaigns yet</Text>
                            <Text style={styles.emptyText}>
                                Create an aftercare campaign so clients automatically get care tips after their appointments.
                            </Text>
                        </Card>
                    ) : (
                        campaigns.map((c) => (
                            <Card key={c.id} style={[styles.campaignCard, !c.is_active && styles.campaignCardInactive]}>
                                <View style={styles.campaignTopRow}>
                                    <View style={[styles.typeDot, { backgroundColor: typeColor(c.campaign_type) }]} />
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.campaignName} numberOfLines={1}>{c.name}</Text>
                                        <Text style={styles.campaignMeta}>
                                            {c.campaign_type}{c.is_recurring && c.days_after_appointment
                                                ? ` · ${c.days_after_appointment}d after appointment`
                                                : c.send_date ? ` · sends ${c.send_date}` : ''}
                                        </Text>
                                    </View>
                                    <Switch
                                        value={!!c.is_active}
                                        onValueChange={() => handleToggle(c)}
                                        trackColor={{ false: '#E5E7EB', true: '#A7F3D0' }}
                                        thumbColor={c.is_active ? '#059669' : '#9CA3AF'}
                                    />
                                </View>
                                <Text style={styles.campaignMessage} numberOfLines={2}>{c.message}</Text>
                                <View style={styles.campaignActions}>
                                    <TouchableOpacity style={styles.editButton} onPress={() => openEdit(c)}>
                                        <MaterialIcons name="edit" size={12} color="#1F2937" />
                                        <Text style={styles.editButtonText}>Edit</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => handleDelete(c)} style={styles.deleteButton}>
                                        <MaterialIcons name="delete-outline" size={15} color="#EF4444" />
                                    </TouchableOpacity>
                                </View>
                            </Card>
                        ))
                    )}
                </ScrollView>

                <Modal
                    visible={showModal}
                    transparent
                    animationType="slide"
                    onRequestClose={() => !saving && setShowModal(false)}
                >
                    <KeyboardAvoidingView
                        style={styles.modalBackdrop}
                        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    >
                        <View style={styles.modalSheet}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>{editing ? 'Edit Campaign' : 'New Campaign'}</Text>
                                <TouchableOpacity onPress={() => setShowModal(false)} disabled={saving} style={styles.closeButton}>
                                    <MaterialIcons name="close" size={18} color={colors.textSecondary} />
                                </TouchableOpacity>
                            </View>

                            <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
                                <Text style={styles.label}>NAME *</Text>
                                <TextInput
                                    style={styles.input}
                                    value={form.name}
                                    onChangeText={(t) => setForm({ ...form, name: t })}
                                    placeholder="Post-session care tips"
                                    placeholderTextColor={colors.textMuted}
                                    editable={!saving}
                                />

                                <Text style={styles.label}>TYPE</Text>
                                <View style={styles.typeRow}>
                                    {CAMPAIGN_TYPES.map((t) => (
                                        <TouchableOpacity
                                            key={t.value}
                                            style={[styles.typeChip, form.campaignType === t.value && { backgroundColor: t.color }]}
                                            onPress={() => setForm({ ...form, campaignType: t.value })}
                                            disabled={saving}
                                        >
                                            <Text style={[styles.typeChipText, form.campaignType === t.value && { color: '#FFF' }]}>
                                                {t.label}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>

                                <View style={styles.switchRow}>
                                    <Text style={styles.switchLabel}>Recurring after appointments</Text>
                                    <Switch
                                        value={form.isRecurring}
                                        onValueChange={(v) => setForm({ ...form, isRecurring: v })}
                                        trackColor={{ false: '#E5E7EB', true: '#A7F3D0' }}
                                        thumbColor={form.isRecurring ? '#059669' : '#9CA3AF'}
                                        disabled={saving}
                                    />
                                </View>

                                {form.isRecurring ? (
                                    <>
                                        <Text style={styles.label}>DAYS AFTER APPOINTMENT *</Text>
                                        <TextInput
                                            style={styles.input}
                                            value={form.daysAfterAppointment}
                                            onChangeText={(t) => setForm({ ...form, daysAfterAppointment: t })}
                                            placeholder="2"
                                            placeholderTextColor={colors.textMuted}
                                            keyboardType="number-pad"
                                            editable={!saving}
                                        />
                                    </>
                                ) : (
                                    <>
                                        <Text style={styles.label}>SEND DATE (YYYY-MM-DD) *</Text>
                                        <TextInput
                                            style={styles.input}
                                            value={form.sendDate}
                                            onChangeText={(t) => setForm({ ...form, sendDate: t })}
                                            placeholder="2026-09-01"
                                            placeholderTextColor={colors.textMuted}
                                            editable={!saving}
                                        />
                                    </>
                                )}

                                <Text style={styles.label}>SERVICE CATEGORY (OPTIONAL — LIMIT TO ONE CATEGORY)</Text>
                                <TextInput
                                    style={styles.input}
                                    value={form.serviceCategory}
                                    onChangeText={(t) => setForm({ ...form, serviceCategory: t })}
                                    placeholder="e.g. Lashes, Nails, Pilates"
                                    placeholderTextColor={colors.textMuted}
                                    editable={!saving}
                                />

                                <Text style={styles.label}>MESSAGE *</Text>
                                <TextInput
                                    style={[styles.input, styles.messageInput]}
                                    value={form.message}
                                    onChangeText={(t) => setForm({ ...form, message: t })}
                                    placeholder="Hi! Here are your aftercare tips: avoid water on lashes for 24h..."
                                    placeholderTextColor={colors.textMuted}
                                    multiline
                                    numberOfLines={4}
                                    textAlignVertical="top"
                                    editable={!saving}
                                />

                                <TouchableOpacity
                                    style={[styles.submitButton, saving && { opacity: 0.6 }]}
                                    onPress={handleSave}
                                    disabled={saving}
                                >
                                    {saving ? (
                                        <ActivityIndicator size="small" color="#FFF" />
                                    ) : (
                                        <Text style={styles.submitButtonText}>
                                            {editing ? 'Save Changes' : 'Create Campaign'}
                                        </Text>
                                    )}
                                </TouchableOpacity>
                            </ScrollView>
                        </View>
                    </KeyboardAvoidingView>
                </Modal>
            </SafeAreaView>
        </ScreenBackground>
    );
}

const EMERALD = '#10B981';
const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        padding: spacing.lg,
        paddingBottom: spacing.sm,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: 'rgba(0,0,0,0.04)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.08)',
    },
    title: { fontSize: 22, fontWeight: '700', color: colors.text },
    subtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
    createButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#000',
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 9,
    },
    createButtonText: { color: '#FFF', fontWeight: '700', fontSize: 13 },
    infoBannerWrap: { paddingHorizontal: spacing.lg },
    infoBanner: {
        flexDirection: 'row',
        gap: spacing.sm,
        alignItems: 'flex-start',
        backgroundColor: '#ECFDF5',
        borderLeftWidth: 3,
        borderLeftColor: EMERALD,
        borderRadius: 12,
        padding: spacing.md,
        marginBottom: spacing.md,
    },
    infoBannerText: { flex: 1, fontSize: 12, color: '#065F46', lineHeight: 17 },
    content: { padding: spacing.lg, paddingTop: 0, paddingBottom: 40 },
    loadingBox: { padding: spacing.xl, alignItems: 'center' },
    emptyCard: { padding: spacing.xl, alignItems: 'center' },
    emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginTop: spacing.sm },
    emptyText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xs, lineHeight: 20 },
    campaignCard: { padding: spacing.md, marginBottom: spacing.sm },
    campaignCardInactive: { opacity: 0.6 },
    campaignTopRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    typeDot: { width: 10, height: 10, borderRadius: 5 },
    campaignName: { fontSize: 15, fontWeight: '700', color: colors.text },
    campaignMeta: { fontSize: 11, color: colors.textMuted, marginTop: 1, textTransform: 'capitalize' },
    campaignMessage: { fontSize: 13, color: colors.textSecondary, marginTop: 6, lineHeight: 18 },
    campaignActions: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: spacing.sm,
        paddingTop: spacing.sm,
        borderTopWidth: 1,
        borderTopColor: 'rgba(0,0,0,0.06)',
        gap: spacing.sm,
    },
    editButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 8,
        backgroundColor: '#F3F4F6',
    },
    editButtonText: { fontSize: 10, fontWeight: '700', color: '#1F2937' },
    deleteButton: { padding: 6, marginLeft: 'auto' },
    modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    modalSheet: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '92%' },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.06)',
    },
    modalTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
    closeButton: { padding: 6 },
    modalBody: { padding: spacing.lg },
    label: {
        fontSize: 10,
        fontWeight: '700',
        color: colors.textSecondary,
        letterSpacing: 1,
        marginBottom: 6,
        marginTop: spacing.sm,
    },
    input: {
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.08)',
        backgroundColor: colors.inputBackground,
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 14,
        color: colors.text,
    },
    messageInput: { minHeight: 90 },
    typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    typeChip: {
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 999,
        backgroundColor: '#F3F4F6',
    },
    typeChipText: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
    switchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: spacing.md,
    },
    switchLabel: { fontSize: 14, fontWeight: '600', color: colors.text },
    submitButton: {
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#000',
        borderRadius: 14,
        paddingVertical: 14,
        marginTop: spacing.lg,
        marginBottom: spacing.md,
    },
    submitButtonText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
});

export default AftercareCampaignsScreen;
