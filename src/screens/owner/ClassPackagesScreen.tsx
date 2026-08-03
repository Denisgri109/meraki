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
import { supabase } from '../../lib/supabase';
import {
    createPackage,
    listAllPackages,
    updatePackage,
    ClassPackage,
} from '../../services/classPassService';

const EMPTY_FORM = { name: '', description: '', totalCredits: '', priceEuros: '', validityDays: '', sortOrder: '0' };

export function ClassPackagesScreen() {
    const navigation = useNavigation<any>();
    const { user, role } = useAuth();
    const { showAlert } = useModal();

    const [packages, setPackages] = useState<ClassPackage[]>([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState<ClassPackage | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [form, setForm] = useState(EMPTY_FORM);
    const [saving, setSaving] = useState(false);

    const isOwner = role === 'owner';

    const fetchPackages = useCallback(async () => {
        setLoading(true);
        try {
            setPackages(await listAllPackages());
        } catch (error: any) {
            showAlert('Error', error.message || 'Failed to load packages', 'error');
        } finally {
            setLoading(false);
        }
    }, [showAlert]);

    useFocusEffect(
        useCallback(() => {
            if (isOwner) fetchPackages();
        }, [isOwner, fetchPackages])
    );

    const openCreate = () => {
        setEditing(null);
        setForm(EMPTY_FORM);
        setShowModal(true);
    };

    const openEdit = (pkg: ClassPackage) => {
        setEditing(pkg);
        setForm({
            name: pkg.name,
            description: pkg.description || '',
            totalCredits: String(pkg.total_credits),
            priceEuros: (pkg.price_cents / 100).toFixed(2),
            validityDays: pkg.validity_days != null ? String(pkg.validity_days) : '',
            sortOrder: String(pkg.sort_order ?? 0),
        });
        setShowModal(true);
    };

    const handleSave = async () => {
        Keyboard.dismiss();
        if (!user?.id) return;
        if (form.name.trim().length < 2) {
            showAlert('Validation', 'Name must be at least 2 characters', 'error');
            return;
        }
        const credits = parseInt(form.totalCredits, 10);
        if (!Number.isInteger(credits) || credits <= 0) {
            showAlert('Validation', 'Total credits must be a positive whole number', 'error');
            return;
        }
        const euros = parseFloat(form.priceEuros);
        if (Number.isNaN(euros) || euros < 0) {
            showAlert('Validation', 'Enter a valid price', 'error');
            return;
        }
        const validity = form.validityDays.trim() === '' ? null : parseInt(form.validityDays, 10);
        if (validity !== null && (!Number.isInteger(validity) || validity <= 0)) {
            showAlert('Validation', 'Validity days must be a positive whole number or blank', 'error');
            return;
        }

        setSaving(true);
        try {
            if (editing) {
                const updated = await updatePackage(editing.id, {
                    name: form.name.trim(),
                    description: form.description.trim() || null,
                    total_credits: credits,
                    price_cents: Math.round(euros * 100),
                    validity_days: validity,
                    sort_order: parseInt(form.sortOrder, 10) || 0,
                });
                setPackages((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
                showAlert('Saved', `Package "${updated.name}" updated.`, 'success');
            } else {
                const created = await createPackage({
                    ownerId: user.id,
                    name: form.name.trim(),
                    description: form.description.trim() || undefined,
                    totalCredits: credits,
                    priceCents: Math.round(euros * 100),
                    validityDays: validity,
                    sortOrder: parseInt(form.sortOrder, 10) || 0,
                });
                setPackages((prev) => [created, ...prev]);
                showAlert('Created', `Package "${created.name}" created!`, 'success');
            }
            setShowModal(false);
            setEditing(null);
            setForm(EMPTY_FORM);
        } catch (error: any) {
            showAlert('Error', error.message || 'Failed to save package', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleToggle = async (pkg: ClassPackage) => {
        try {
            const updated = await updatePackage(pkg.id, { is_active: !pkg.is_active });
            setPackages((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
            showAlert('Updated', `${pkg.name} ${updated.is_active ? 'activated' : 'deactivated'}`, 'success');
        } catch (error: any) {
            showAlert('Error', error.message || 'Failed to update package', 'error');
        }
    };

    const handleDelete = (pkg: ClassPackage) => {
        Alert.alert(
            'Delete Package',
            `Delete "${pkg.name}"? This only works if no passes reference it.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const { error } = await supabase.from('class_packages').delete().eq('id', pkg.id);
                            if (error) throw error;
                            setPackages((prev) => prev.filter((p) => p.id !== pkg.id));
                            showAlert('Deleted', 'Package deleted', 'success');
                        } catch (error: any) {
                            showAlert('Error', error.message || 'Failed to delete package (passes may reference it)', 'error');
                        }
                    },
                },
            ]
        );
    };

    if (!isOwner) {
        return (
            <ScreenBackground>
                <SafeAreaView style={styles.container} edges={['top']}>
                    <View style={styles.centerMessage}>
                        <MaterialCommunityIcons name="lock-outline" size={48} color={colors.textSecondary} />
                        <Text style={styles.emptyTitle}>Owners only</Text>
                        <Text style={styles.emptyText}>Only the salon owner can manage class packages.</Text>
                    </View>
                </SafeAreaView>
            </ScreenBackground>
        );
    }

    const activeCount = packages.filter((p) => p.is_active).length;

    return (
        <ScreenBackground>
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <MaterialIcons name="arrow-back" size={22} color={colors.text} />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.title}>Class Packages</Text>
                        <Text style={styles.subtitle}>
                            {packages.length} package{packages.length === 1 ? '' : 's'} · {activeCount} active
                        </Text>
                    </View>
                    <TouchableOpacity style={styles.createButton} onPress={openCreate}>
                        <MaterialIcons name="add" size={18} color="#FFF" />
                        <Text style={styles.createButtonText}>Create</Text>
                    </TouchableOpacity>
                </View>

                <ScrollView contentContainerStyle={styles.content}>
                    {loading ? (
                        <View style={styles.loadingBox}>
                            <ActivityIndicator size="large" color={colors.text} />
                        </View>
                    ) : packages.length === 0 ? (
                        <Card style={styles.emptyCard}>
                            <MaterialCommunityIcons name="ticket-outline" size={36} color={colors.textMuted} />
                            <Text style={styles.emptyTitle}>No packages yet</Text>
                            <Text style={styles.emptyText}>Create a class package to start selling passes.</Text>
                        </Card>
                    ) : (
                        packages.map((pkg) => (
                            <Card key={pkg.id} style={[styles.packageCard, !pkg.is_active && styles.packageCardInactive]}>
                                <View style={styles.packageTopRow}>
                                    <View style={styles.packageIcon}>
                                        <MaterialCommunityIcons name="layers-outline" size={16} color="#FFF" />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <View style={styles.packageTitleRow}>
                                            <Text style={styles.packageName} numberOfLines={1}>{pkg.name}</Text>
                                            <View style={[styles.statusChip, pkg.is_active ? styles.statusActive : styles.statusInactive]}>
                                                <Text style={[styles.statusChipText, pkg.is_active ? styles.statusActiveText : styles.statusInactiveText]}>
                                                    {pkg.is_active ? 'Active' : 'Hidden'}
                                                </Text>
                                            </View>
                                        </View>
                                        {!!pkg.description && (
                                            <Text style={styles.packageDesc} numberOfLines={2}>{pkg.description}</Text>
                                        )}
                                        <Text style={styles.packageMeta}>
                                            {pkg.total_credits} classes · {pkg.validity_days ? `${pkg.validity_days}d validity` : 'No expiry'}
                                        </Text>
                                    </View>
                                    <Text style={styles.packagePrice}>€{(pkg.price_cents / 100).toFixed(2)}</Text>
                                </View>

                                <View style={styles.packageActions}>
                                    <TouchableOpacity
                                        style={[styles.actionButton, styles.editButton]}
                                        onPress={() => openEdit(pkg)}
                                    >
                                        <MaterialIcons name="edit" size={13} color="#1F2937" />
                                        <Text style={styles.editButtonText}>Edit</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.actionButton, pkg.is_active ? styles.toggleOff : styles.toggleOn]}
                                        onPress={() => handleToggle(pkg)}
                                    >
                                        <Text style={[styles.actionButtonText, pkg.is_active ? styles.toggleOffText : styles.toggleOnText]}>
                                            {pkg.is_active ? 'Hide' : 'Activate'}
                                        </Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => handleDelete(pkg)} style={styles.deleteButton}>
                                        <MaterialIcons name="delete-outline" size={16} color="#EF4444" />
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
                    <View style={styles.modalBackdrop}>
                        <View style={styles.modalSheet}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>{editing ? 'Edit Package' : 'Create Package'}</Text>
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
                                    placeholder="10-Class Pass"
                                    placeholderTextColor={colors.textMuted}
                                    editable={!saving}
                                />

                                <Text style={styles.label}>DESCRIPTION (OPTIONAL)</Text>
                                <TextInput
                                    style={styles.input}
                                    value={form.description}
                                    onChangeText={(t) => setForm({ ...form, description: t })}
                                    placeholder="Shown to clients on the purchase card"
                                    placeholderTextColor={colors.textMuted}
                                    editable={!saving}
                                />

                                <Text style={styles.label}>TOTAL CREDITS *</Text>
                                <TextInput
                                    style={styles.input}
                                    value={form.totalCredits}
                                    onChangeText={(t) => setForm({ ...form, totalCredits: t })}
                                    placeholder="10"
                                    placeholderTextColor={colors.textMuted}
                                    keyboardType="number-pad"
                                    editable={!saving}
                                />

                                <Text style={styles.label}>PRICE (EUR) *</Text>
                                <TextInput
                                    style={styles.input}
                                    value={form.priceEuros}
                                    onChangeText={(t) => setForm({ ...form, priceEuros: t })}
                                    placeholder="150.00"
                                    placeholderTextColor={colors.textMuted}
                                    keyboardType="decimal-pad"
                                    editable={!saving}
                                />

                                <Text style={styles.label}>VALIDITY DAYS (BLANK = NO EXPIRY)</Text>
                                <TextInput
                                    style={styles.input}
                                    value={form.validityDays}
                                    onChangeText={(t) => setForm({ ...form, validityDays: t })}
                                    placeholder="90"
                                    placeholderTextColor={colors.textMuted}
                                    keyboardType="number-pad"
                                    editable={!saving}
                                />

                                <Text style={styles.label}>SORT ORDER</Text>
                                <TextInput
                                    style={styles.input}
                                    value={form.sortOrder}
                                    onChangeText={(t) => setForm({ ...form, sortOrder: t })}
                                    placeholder="0"
                                    placeholderTextColor={colors.textMuted}
                                    keyboardType="number-pad"
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
                                        <Text style={styles.submitButtonText}>{editing ? 'Save Changes' : 'Create Package'}</Text>
                                    )}
                                </TouchableOpacity>
                            </ScrollView>
                        </View>
                    </View>
                </Modal>
            </SafeAreaView>
        </ScreenBackground>
    );
}

const VIOLET = '#8B5CF6';
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
        backgroundColor: '#000',
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 9,
    },
    createButtonText: { color: '#FFF', fontWeight: '700', fontSize: 13 },
    content: { padding: spacing.lg, paddingTop: 0, paddingBottom: 40 },
    loadingBox: { padding: spacing.xl, alignItems: 'center' },
    emptyCard: { padding: spacing.xl, alignItems: 'center', marginTop: spacing.lg },
    emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginTop: spacing.sm },
    emptyText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xs },
    centerMessage: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
    packageCard: { padding: spacing.md, marginBottom: spacing.sm },
    packageCardInactive: { opacity: 0.6 },
    packageTopRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
    packageIcon: {
        width: 34,
        height: 34,
        borderRadius: 12,
        backgroundColor: VIOLET,
        alignItems: 'center',
        justifyContent: 'center',
    },
    packageTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    packageName: { fontSize: 15, fontWeight: '700', color: colors.text, flexShrink: 1 },
    packageDesc: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
    packageMeta: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
    packagePrice: { fontSize: 17, fontWeight: '800', color: colors.text },
    statusChip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
    statusActive: { backgroundColor: '#D1FAE5' },
    statusInactive: { backgroundColor: '#F3F4F6' },
    statusChipText: { fontSize: 9, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
    statusActiveText: { color: '#047857' },
    statusInactiveText: { color: '#4B5563' },
    packageActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        marginTop: spacing.sm,
        paddingTop: spacing.sm,
        borderTopWidth: 1,
        borderTopColor: 'rgba(0,0,0,0.06)',
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 8,
    },
    editButton: { backgroundColor: '#F3F4F6' },
    editButtonText: { fontSize: 10, fontWeight: '700', color: '#1F2937', letterSpacing: 0.5, textTransform: 'uppercase' },
    toggleOff: { backgroundColor: '#FEF2F2' },
    toggleOn: { backgroundColor: '#ECFDF5' },
    actionButtonText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
    toggleOffText: { color: '#DC2626' },
    toggleOnText: { color: '#059669' },
    deleteButton: { padding: 6, marginLeft: 'auto' },
    modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
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

export default ClassPackagesScreen;
