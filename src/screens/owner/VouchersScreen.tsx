import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Keyboard,
    Modal,
    ScrollView,
    StyleSheet,
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
    createVoucher,
    deleteVoucher,
    listVouchers,
    toggleVoucherActive,
    Voucher,
    DiscountType,
} from '../../services/voucherService';

const DISCOUNT_TYPES: { value: DiscountType; label: string; desc: string; icon: string; color: [string, string] }[] = [
    { value: 'free_month', label: 'Free Month', desc: '100% off a 1-month Pilates membership', icon: 'gift-outline', color: ['#F472B6', '#FB7185'] },
    { value: 'percentage', label: 'Percentage Off', desc: 'X% off any single booking or package', icon: 'percent-outline', color: ['#A78BFA', '#8B5CF6'] },
    { value: 'free_trial', label: 'Free Trial Class', desc: '100% off a single class booking', icon: 'star-outline', color: ['#34D399', '#14B8A6'] },
    { value: 'fixed_amount', label: 'Fixed Cash Discount', desc: 'Fixed amount off (e.g., EUR 15)', icon: 'cash-outline', color: ['#FBBF24', '#F97316'] },
];

const EMPTY_FORM = { code: '', discountType: 'percentage' as DiscountType, discountValue: '', maxUses: '1', description: '' };

function discountLabel(v: Voucher): string {
    switch (v.discount_type) {
        case 'free_month': return 'Free Month (100% off)';
        case 'free_trial': return 'Free Trial Class (100% off)';
        case 'percentage': return `${v.discount_value}% off`;
        case 'fixed_amount':
        case 'fixed': return `EUR ${(v.discount_value / 100).toFixed(2)} off`;
        default: return v.discount_type;
    }
}

function daysLeft(expiresAt: string): number {
    return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
}

export function VouchersScreen() {
    const navigation = useNavigation<any>();
    const { user, role } = useAuth();
    const { showAlert } = useModal();

    const [vouchers, setVouchers] = useState<Voucher[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [form, setForm] = useState(EMPTY_FORM);
    const [saving, setSaving] = useState(false);

    const isOwner = role === 'owner';

    const fetchVouchers = useCallback(async () => {
        setLoading(true);
        try {
            const data = await listVouchers();
            setVouchers(data);
        } catch (error: any) {
            showAlert('Error', error.message || 'Failed to load vouchers', 'error');
        } finally {
            setLoading(false);
        }
    }, [showAlert]);

    useFocusEffect(
        useCallback(() => {
            if (isOwner) fetchVouchers();
        }, [isOwner, fetchVouchers])
    );

    const handleCreate = async () => {
        Keyboard.dismiss();
        if (form.code.trim().length < 3) {
            showAlert('Validation', 'Code must be at least 3 characters', 'error');
            return;
        }
        const dv = Number(form.discountValue);
        if ((form.discountType === 'percentage' || form.discountType === 'fixed_amount') && (!Number.isFinite(dv) || dv <= 0)) {
            showAlert('Validation', 'Enter a valid discount value', 'error');
            return;
        }
        if (!user?.id) return;

        const discountValue =
            form.discountType === 'percentage'
                ? Number(form.discountValue)
                : form.discountType === 'fixed_amount'
                    ? Math.round(Number(form.discountValue) * 100)
                    : 100;

        setSaving(true);
        try {
            const voucher = await createVoucher({
                code: form.code,
                discountType: form.discountType,
                discountValue,
                maxUses: Number(form.maxUses) || 1,
                description: form.description,
                createdBy: user.id,
            });
            setVouchers((prev) => [voucher, ...prev]);
            showAlert('Created', `Voucher ${voucher.code} created!`, 'success');
            setShowCreate(false);
            setForm(EMPTY_FORM);
        } catch (error: any) {
            showAlert('Error', error.message || 'Failed to create voucher', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleToggle = async (v: Voucher) => {
        try {
            const voucher = await toggleVoucherActive(v.id, !v.is_active);
            setVouchers((prev) => prev.map((x) => (x.id === voucher.id ? voucher : x)));
            showAlert('Updated', `${voucher.code} ${voucher.is_active ? 'activated' : 'deactivated'}`, 'success');
        } catch (error: any) {
            showAlert('Error', error.message || 'Failed to update voucher', 'error');
        }
    };

    const handleDelete = (v: Voucher) => {
        Alert.alert('Delete Voucher', `Delete voucher "${v.code}"? This cannot be undone.`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    try {
                        await deleteVoucher(v.id);
                        setVouchers((prev) => prev.filter((x) => x.id !== v.id));
                        showAlert('Deleted', 'Voucher deleted', 'success');
                    } catch (error: any) {
                        showAlert('Error', error.message || 'Failed to delete voucher', 'error');
                    }
                },
            },
        ]);
    };

    if (!isOwner) {
        return (
            <ScreenBackground>
                <SafeAreaView style={styles.container} edges={['top']}>
                    <View style={styles.centerMessage}>
                        <MaterialCommunityIcons name="lock-outline" size={48} color={colors.textSecondary} />
                        <Text style={styles.emptyTitle}>Owners only</Text>
                        <Text style={styles.emptyText}>Only salon owners can manage vouchers.</Text>
                    </View>
                </SafeAreaView>
            </ScreenBackground>
        );
    }

    const activeCount = vouchers.filter((v) => v.is_active && daysLeft(v.expires_at) > 0).length;
    const redeemedCount = vouchers.reduce((sum, v) => sum + v.current_uses, 0);

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
                        <Text style={styles.title}>Voucher Management</Text>
                        <Text style={styles.subtitle}>Create and monitor discount codes</Text>
                    </View>
                    <TouchableOpacity style={styles.createButton} onPress={() => setShowCreate(true)}>
                        <MaterialIcons name="add" size={18} color="#FFF" />
                        <Text style={styles.createButtonText}>Create</Text>
                    </TouchableOpacity>
                </View>

                <ScrollView contentContainerStyle={styles.content}>
                    <View style={styles.statsRow}>
                        <Card style={styles.statCard}>
                            <MaterialCommunityIcons name="ticket-percent-outline" size={14} color={colors.accent} />
                            <Text style={styles.statLabel}>TOTAL</Text>
                            <Text style={styles.statValue}>{vouchers.length}</Text>
                        </Card>
                        <Card style={styles.statCard}>
                            <MaterialIcons name="power-settings-new" size={14} color="#10B981" />
                            <Text style={styles.statLabel}>ACTIVE</Text>
                            <Text style={styles.statValue}>{activeCount}</Text>
                        </Card>
                        <Card style={styles.statCard}>
                            <MaterialIcons name="people-outline" size={14} color="#F59E0B" />
                            <Text style={styles.statLabel}>REDEEMED</Text>
                            <Text style={styles.statValue}>{redeemedCount}</Text>
                        </Card>
                    </View>

                    {loading ? (
                        <View style={styles.loadingBox}>
                            <ActivityIndicator size="large" color={colors.text} />
                        </View>
                    ) : vouchers.length === 0 ? (
                        <Card style={styles.emptyCard}>
                            <MaterialCommunityIcons name="ticket-percent-outline" size={36} color={colors.textMuted} />
                            <Text style={styles.emptyTitle}>No vouchers yet</Text>
                            <Text style={styles.emptyText}>Create your first discount code to get started.</Text>
                        </Card>
                    ) : (
                        vouchers.map((v) => {
                            const left = daysLeft(v.expires_at);
                            const expired = left <= 0;
                            const exhausted = v.current_uses >= v.max_uses;
                            const isActive = v.is_active && !expired && !exhausted;
                            return (
                                <Card key={v.id} style={[styles.voucherCard, !isActive && styles.voucherCardInactive]}>
                                    <View style={styles.voucherTopRow}>
                                        <View style={styles.voucherIcon}>
                                            <MaterialIcons name="local-offer" size={20} color={colors.accent} />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <View style={styles.codeRow}>
                                                <Text style={styles.codeText}>{v.code}</Text>
                                                <View style={[
                                                    styles.statusChip,
                                                    isActive ? styles.statusActive : expired ? styles.statusExpired : styles.statusInactive,
                                                ]}>
                                                    <Text style={[
                                                        styles.statusChipText,
                                                        isActive ? styles.statusActiveText : expired ? styles.statusExpiredText : styles.statusInactiveText,
                                                    ]}>
                                                        {isActive ? 'Active' : expired ? 'Expired' : exhausted ? 'Exhausted' : 'Inactive'}
                                                    </Text>
                                                </View>
                                            </View>
                                            <Text style={styles.discountText}>{discountLabel(v)}</Text>
                                            {!!v.description && (
                                                <Text style={styles.descText} numberOfLines={1}>{v.description}</Text>
                                            )}
                                        </View>
                                    </View>

                                    <View style={styles.voucherMetaRow}>
                                        <View style={styles.metaItem}>
                                            <MaterialIcons name="people-outline" size={12} color={colors.textMuted} />
                                            <Text style={styles.metaText}>{v.current_uses} / {v.max_uses}</Text>
                                        </View>
                                        <View style={styles.metaItem}>
                                            <MaterialIcons name="schedule" size={12} color={expired ? '#EF4444' : colors.textMuted} />
                                            <Text style={[styles.metaText, expired && { color: '#EF4444' }]}>
                                                {expired ? 'Expired' : `${left}d left`}
                                            </Text>
                                        </View>
                                        <TouchableOpacity
                                            style={[styles.toggleButton, v.is_active ? styles.toggleOff : styles.toggleOn]}
                                            onPress={() => handleToggle(v)}
                                        >
                                            <Text style={[styles.toggleButtonText, v.is_active ? styles.toggleOffText : styles.toggleOnText]}>
                                                {v.is_active ? 'Deactivate' : 'Activate'}
                                            </Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            accessibilityRole="button"
                                            accessibilityLabel="Delete" onPress={() => handleDelete(v)} style={styles.deleteButton}>
                                            <MaterialIcons name="delete-outline" size={16} color="#EF4444" />
                                        </TouchableOpacity>
                                    </View>
                                </Card>
                            );
                        })
                    )}
                </ScrollView>

                {/* Create Voucher Modal */}
                <Modal visible={showCreate} transparent animationType="slide" onRequestClose={() => setShowCreate(false)}>
                    <View style={styles.modalBackdrop}>
                        <View style={styles.modalSheet}>
                            <View style={styles.modalHeader}>
                                <View style={styles.modalHeaderLeft}>
                                    <View style={styles.modalHeaderIcon}>
                                        <MaterialCommunityIcons name="ticket-percent-outline" size={18} color="#FFF" />
                                    </View>
                                    <View>
                                        <Text style={styles.modalTitle}>Create Voucher</Text>
                                        <Text style={styles.modalSubtitle}>Expires in 7 days · Benefit valid 7 days after redemption</Text>
                                    </View>
                                </View>
                                <TouchableOpacity
                                    accessibilityRole="button"
                                    accessibilityLabel="Close" onPress={() => setShowCreate(false)} style={styles.closeButton}>
                                    <MaterialIcons name="close" size={18} color={colors.textSecondary} />
                                </TouchableOpacity>
                            </View>

                            <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
                                <Text style={styles.label}>VOUCHER CODE *</Text>
                                <TextInput
                                    style={[styles.input, styles.codeInput]}
                                    value={form.code}
                                    onChangeText={(t) => setForm({ ...form, code: t.toUpperCase() })}
                                    placeholder="SUMMER50"
                                    placeholderTextColor={colors.textMuted}
                                    autoCapitalize="characters"
                                    editable={!saving}
                                />

                                <Text style={styles.label}>DISCOUNT TYPE *</Text>
                                <View style={styles.typeGrid}>
                                    {DISCOUNT_TYPES.map((dt) => {
                                        const selected = form.discountType === dt.value;
                                        return (
                                            <TouchableOpacity
                                                key={dt.value}
                                                style={[styles.typeCard, selected && styles.typeCardSelected]}
                                                onPress={() => setForm({ ...form, discountType: dt.value })}
                                                disabled={saving}
                                            >
                                                <View style={[styles.typeIcon, { backgroundColor: dt.color[1] }]}>
                                                    <MaterialCommunityIcons name={dt.icon as any} size={15} color="#FFF" />
                                                </View>
                                                <Text style={styles.typeLabel}>{dt.label}</Text>
                                                <Text style={styles.typeDesc}>{dt.desc}</Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>

                                {(form.discountType === 'percentage' || form.discountType === 'fixed_amount') && (
                                    <>
                                        <Text style={styles.label}>
                                            {form.discountType === 'percentage' ? 'PERCENTAGE (%) *' : 'AMOUNT (EUR) *'}
                                        </Text>
                                        <TextInput
                                            style={styles.input}
                                            value={form.discountValue}
                                            onChangeText={(t) => setForm({ ...form, discountValue: t })}
                                            placeholder={form.discountType === 'percentage' ? '50' : '15.00'}
                                            placeholderTextColor={colors.textMuted}
                                            keyboardType="decimal-pad"
                                            editable={!saving}
                                        />
                                    </>
                                )}

                                <Text style={styles.label}>MAX USES</Text>
                                <TextInput
                                    style={styles.input}
                                    value={form.maxUses}
                                    onChangeText={(t) => setForm({ ...form, maxUses: t })}
                                    placeholder="1"
                                    placeholderTextColor={colors.textMuted}
                                    keyboardType="number-pad"
                                    editable={!saving}
                                />

                                <Text style={styles.label}>DESCRIPTION (OPTIONAL)</Text>
                                <TextInput
                                    style={styles.input}
                                    value={form.description}
                                    onChangeText={(t) => setForm({ ...form, description: t })}
                                    placeholder="Summer promo — 50% off any booking"
                                    placeholderTextColor={colors.textMuted}
                                    editable={!saving}
                                />

                                <View style={styles.warningBanner}>
                                    <MaterialIcons name="error-outline" size={13} color="#B45309" />
                                    <Text style={styles.warningText}>
                                        This voucher will expire in 7 days. Benefits (free month/trial) must be used within 7 days of redemption.
                                    </Text>
                                </View>

                                <TouchableOpacity
                                    style={[styles.submitButton, saving && { opacity: 0.6 }]}
                                    onPress={handleCreate}
                                    disabled={saving}
                                >
                                    {saving ? (
                                        <ActivityIndicator size="small" color="#FFF" />
                                    ) : (
                                        <MaterialIcons name="add" size={16} color="#FFF" />
                                    )}
                                    <Text style={styles.submitButtonText}>{saving ? 'Creating…' : 'Create Voucher'}</Text>
                                </TouchableOpacity>
                            </ScrollView>
                        </View>
                    </View>
                </Modal>
            </SafeAreaView>
        </ScreenBackground>
    );
}

const PINK = '#E8A0B4';
const PINK_LIGHT = '#FDE8ED';
const PINK_DARK = '#C47A90';

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        padding: spacing.lg,
        paddingBottom: spacing.md,
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
        backgroundColor: PINK_DARK,
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 9,
    },
    createButtonText: { color: '#FFF', fontWeight: '700', fontSize: 13 },
    content: { padding: spacing.lg, paddingTop: 0, paddingBottom: 40 },
    statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
    statCard: { flex: 1, padding: spacing.md },
    statLabel: {
        fontSize: 10,
        fontWeight: '700',
        color: colors.textMuted,
        letterSpacing: 1,
        marginTop: 4,
    },
    statValue: { fontSize: 20, fontWeight: '900', color: colors.text, marginTop: 2 },
    loadingBox: { padding: spacing.xl, alignItems: 'center' },
    emptyCard: { padding: spacing.xl, alignItems: 'center', marginTop: spacing.lg },
    emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginTop: spacing.sm },
    emptyText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xs },
    centerMessage: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
    voucherCard: { padding: spacing.md, marginBottom: spacing.sm },
    voucherCardInactive: { opacity: 0.6 },
    voucherTopRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
    voucherIcon: {
        width: 44,
        height: 44,
        borderRadius: 14,
        backgroundColor: PINK_LIGHT,
        alignItems: 'center',
        justifyContent: 'center',
    },
    codeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    codeText: { fontSize: 17, fontWeight: '800', color: colors.text, fontFamily: 'monospace' as any },
    statusChip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
    statusActive: { backgroundColor: '#D1FAE5' },
    statusExpired: { backgroundColor: '#FEE2E2' },
    statusInactive: { backgroundColor: '#F3F4F6' },
    statusChipText: { fontSize: 9, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
    statusActiveText: { color: '#047857' },
    statusExpiredText: { color: '#B91C1C' },
    statusInactiveText: { color: '#4B5563' },
    discountText: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
    descText: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
    voucherMetaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        marginTop: spacing.sm,
        paddingTop: spacing.sm,
        borderTopWidth: 1,
        borderTopColor: 'rgba(0,0,0,0.06)',
    },
    metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    metaText: { fontSize: 12, color: colors.textMuted },
    toggleButton: {
        marginLeft: 'auto',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
    },
    toggleOff: { backgroundColor: '#FEF2F2' },
    toggleOn: { backgroundColor: '#ECFDF5' },
    toggleButtonText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
    toggleOffText: { color: '#DC2626' },
    toggleOnText: { color: '#059669' },
    deleteButton: { padding: 6 },
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'flex-end',
    },
    modalSheet: {
        backgroundColor: '#FFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '92%',
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.06)',
    },
    modalHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
    modalHeaderIcon: {
        width: 36,
        height: 36,
        borderRadius: 12,
        backgroundColor: PINK_DARK,
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
    modalSubtitle: { fontSize: 10, color: colors.textMuted, marginTop: 1 },
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
    codeInput: { fontWeight: '700', letterSpacing: 1 },
    typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    typeCard: {
        width: '47%',
        flexGrow: 1,
        padding: spacing.md,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.08)',
    },
    typeCardSelected: {
        borderColor: PINK,
        backgroundColor: PINK_LIGHT,
    },
    typeIcon: {
        width: 30,
        height: 30,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    typeLabel: { fontSize: 12, fontWeight: '700', color: colors.text },
    typeDesc: { fontSize: 10, color: colors.textMuted, marginTop: 2 },
    warningBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        backgroundColor: '#FFFBEB',
        borderWidth: 1,
        borderColor: '#FDE68A',
        borderRadius: 12,
        padding: 10,
        marginTop: spacing.md,
    },
    warningText: { flex: 1, fontSize: 11, fontWeight: '600', color: '#92400E' },
    submitButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        backgroundColor: PINK_DARK,
        borderRadius: 14,
        paddingVertical: 14,
        marginTop: spacing.lg,
        marginBottom: spacing.md,
    },
    submitButtonText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
});

export default VouchersScreen;
