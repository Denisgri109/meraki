import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
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
import QRCode from 'react-native-qrcode-svg';
import { useAuth } from '../../contexts/AuthContext';
import { useModal } from '../../contexts/ModalContext';
import { Card, ScreenBackground } from '../../components/ui';
import { ImageUrlUpload } from '../../components/ImageUrlUpload';
import { colors, spacing } from '../../theme';
import {
    createQrPayCode,
    deleteQrPayCode,
    listQrPayCodes,
    updateQrPayCode,
    QrPayCode,
} from '../../services/qrPayService';

type SourceMode = 'image' | 'payload';

export function QrPaymentsScreen() {
    const navigation = useNavigation<any>();
    const { user, profile, role } = useAuth();
    const { showAlert } = useModal();

    const isOwner = role === 'owner';
    const canView = isOwner || (role === 'master' && profile?.can_view_qr_pay === true);

    const [codes, setCodes] = useState<QrPayCode[]>([]);
    const [loading, setLoading] = useState(true);
    const [fullscreen, setFullscreen] = useState<QrPayCode | null>(null);

    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState<QrPayCode | null>(null);
    const [providerName, setProviderName] = useState('');
    const [sourceMode, setSourceMode] = useState<SourceMode>('image');
    const [imageUrl, setImageUrl] = useState('');
    const [payload, setPayload] = useState('');
    const [displayOrder, setDisplayOrder] = useState('0');
    const [saving, setSaving] = useState(false);

    const loadCodes = useCallback(async () => {
        if (!canView) return;
        setLoading(true);
        try {
            setCodes(await listQrPayCodes(isOwner));
        } catch (error: any) {
            showAlert('Error', error.message || 'Failed to load payment codes', 'error');
        } finally {
            setLoading(false);
        }
    }, [canView, isOwner, showAlert]);

    useFocusEffect(
        useCallback(() => {
            loadCodes();
        }, [loadCodes])
    );

    const openCreate = () => {
        setEditing(null);
        setProviderName('');
        setSourceMode('image');
        setImageUrl('');
        setPayload('');
        setDisplayOrder('0');
        setShowModal(true);
    };

    const openEdit = (code: QrPayCode) => {
        setEditing(code);
        setProviderName(code.provider_name);
        setSourceMode(code.qr_image_url ? 'image' : 'payload');
        setImageUrl(code.qr_image_url || '');
        setPayload(code.qr_payload || '');
        setDisplayOrder(String(code.display_order ?? 0));
        setShowModal(true);
    };

    const handleSave = async () => {
        Keyboard.dismiss();
        if (!providerName.trim()) {
            showAlert('Validation', 'Provider name is required.', 'error');
            return;
        }
        const nextImageUrl = sourceMode === 'image' ? imageUrl.trim() : null;
        const nextPayload = sourceMode === 'payload' ? payload.trim() : null;
        if (!nextImageUrl && !nextPayload) {
            showAlert('Validation', 'Provide a QR image or a QR payload.', 'error');
            return;
        }
        if (!user?.id) return;

        setSaving(true);
        try {
            if (editing) {
                const updated = await updateQrPayCode(editing.id, {
                    providerName: providerName.trim(),
                    qrImageUrl: nextImageUrl,
                    qrPayload: nextPayload,
                    displayOrder: parseInt(displayOrder, 10) || 0,
                });
                setCodes((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
                showAlert('Saved', 'Payment method updated.', 'success');
            } else {
                const created = await createQrPayCode({
                    providerName: providerName.trim(),
                    qrImageUrl: nextImageUrl,
                    qrPayload: nextPayload,
                    displayOrder: parseInt(displayOrder, 10) || 0,
                    createdBy: user.id,
                });
                setCodes((prev) => [created, ...prev]);
                showAlert('Created', 'Payment method added.', 'success');
            }
            setShowModal(false);
            setEditing(null);
        } catch (error: any) {
            showAlert('Error', error.message || 'Failed to save payment method', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleToggle = async (code: QrPayCode) => {
        try {
            const updated = await updateQrPayCode(code.id, { isActive: !code.is_active });
            setCodes((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
        } catch (error: any) {
            showAlert('Error', error.message || 'Failed to update', 'error');
        }
    };

    const handleDelete = (code: QrPayCode) => {
        Alert.alert('Delete Payment Method', `Delete "${code.provider_name}"? This cannot be undone.`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    try {
                        await deleteQrPayCode(code.id);
                        setCodes((prev) => prev.filter((c) => c.id !== code.id));
                        showAlert('Deleted', 'Payment method deleted', 'success');
                    } catch (error: any) {
                        showAlert('Error', error.message || 'Failed to delete', 'error');
                    }
                },
            },
        ]);
    };

    const renderQr = (code: QrPayCode, size: number) => {
        if (code.qr_image_url) {
            return (
                <Image
                    source={{ uri: code.qr_image_url }}
                    style={{ width: size, height: size, borderRadius: 12 }}
                    resizeMode="contain"
                />
            );
        }
        if (code.qr_payload) {
            return <QRCode value={code.qr_payload} size={size} />;
        }
        return (
            <View style={[styles.qrFallback, { width: size, height: size }]}>
                <MaterialIcons name="qr-code" size={size / 2.5} color={colors.textMuted} />
            </View>
        );
    };

    if (!canView) {
        return (
            <ScreenBackground>
                <SafeAreaView style={styles.container} edges={['top']}>
                    <View style={styles.header}>
                        <TouchableOpacity
                            accessibilityRole="button"
                            accessibilityLabel="Go back" onPress={() => navigation.goBack()} style={styles.backButton}>
                            <MaterialIcons name="arrow-back" size={22} color={colors.text} />
                        </TouchableOpacity>
                        <Text style={styles.title}>QR Payments</Text>
                        <View style={{ width: 40 }} />
                    </View>
                    <View style={styles.centerMessage}>
                        <MaterialCommunityIcons name="lock-outline" size={48} color={colors.textSecondary} />
                        <Text style={styles.emptyTitle}>Restricted</Text>
                        <Text style={styles.emptyText}>
                            Payment codes are only available to the owner and authorized instructors.
                        </Text>
                    </View>
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
                        <Text style={styles.title}>QR Payments</Text>
                        <Text style={styles.subtitle}>
                            {isOwner ? 'Manage payment codes staff can show clients' : 'Show these codes to clients for in-person payment'}
                        </Text>
                    </View>
                    {isOwner && (
                        <TouchableOpacity testID="qr-pay-add" style={styles.createButton} onPress={openCreate}>
                            <MaterialIcons name="add" size={18} color="#FFF" />
                            <Text style={styles.createButtonText}>Add</Text>
                        </TouchableOpacity>
                    )}
                </View>

                <ScrollView contentContainerStyle={styles.content}>
                    {loading ? (
                        <View style={styles.loadingBox}>
                            <ActivityIndicator size="large" color={colors.text} />
                        </View>
                    ) : codes.length === 0 ? (
                        <Card style={styles.emptyCard}>
                            <MaterialIcons name="qr-code" size={36} color={colors.textMuted} />
                            <Text style={styles.emptyTitle}>No payment codes available</Text>
                            <Text style={styles.emptyText}>
                                {isOwner ? 'Add your first payment method to get started.' : 'Ask the owner to add payment codes.'}
                            </Text>
                        </Card>
                    ) : (
                        <View style={styles.grid}>
                            {codes.map((code) => (
                                <Card key={code.id} style={[styles.codeCard, !code.is_active && styles.codeCardInactive]}>
                                    <TouchableOpacity
                                        activeOpacity={0.85}
                                        onPress={() => setFullscreen(code)}
                                        style={styles.codeCardInner}
                                    >
                                        <View style={styles.codeQrWrap}>{renderQr(code, 120)}</View>
                                        <Text style={styles.codeName} numberOfLines={1}>{code.provider_name}</Text>
                                    </TouchableOpacity>

                                    {isOwner && (
                                        <View style={styles.codeActions}>
                                            <TouchableOpacity
                                                style={[styles.smallButton, code.is_active ? styles.toggleOff : styles.toggleOn]}
                                                testID="qr-pay-toggle-active"
                                                onPress={() => handleToggle(code)}
                                            >
                                                <Text style={[styles.smallButtonText, code.is_active ? styles.toggleOffText : styles.toggleOnText]}>
                                                    {code.is_active ? 'Hide' : 'Show'}
                                                </Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity style={styles.smallButton} onPress={() => openEdit(code)}>
                                                <MaterialIcons name="edit" size={13} color="#1F2937" />
                                                <Text style={styles.smallButtonText}>Edit</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                accessibilityRole="button"
                                                accessibilityLabel="Delete" testID="qr-pay-delete" style={styles.deleteButton} onPress={() => handleDelete(code)}>
                                                <MaterialIcons name="delete-outline" size={15} color="#EF4444" />
                                            </TouchableOpacity>
                                        </View>
                                    )}
                                </Card>
                            ))}
                        </View>
                    )}
                </ScrollView>

                {/* Fullscreen QR overlay for presenting to a client */}
                <Modal
                    visible={!!fullscreen}
                    animationType="fade"
                    onRequestClose={() => setFullscreen(null)}
                >
                    <View style={styles.fullscreenWrap}>
                        <TouchableOpacity
                            accessibilityRole="button"
                            accessibilityLabel="Close"
                            style={styles.fullscreenClose}
                            onPress={() => setFullscreen(null)}
                        >
                            <MaterialIcons name="close" size={22} color="#FFF" />
                        </TouchableOpacity>
                        {fullscreen && (
                            <View style={styles.fullscreenCard}>
                                <Text style={styles.fullscreenName}>{fullscreen.provider_name}</Text>
                                <View style={styles.fullscreenQr}>
                                    {renderQr(fullscreen, 260)}
                                </View>
                                <Text style={styles.fullscreenHint}>Ask the client to scan this code with their banking app</Text>
                            </View>
                        )}
                    </View>
                </Modal>

                {/* Add/Edit modal (owner) */}
                <Modal
                    visible={showModal}
                    transparent
                    animationType="slide"
                    onRequestClose={() => !saving && setShowModal(false)}
                >
                    <View style={styles.modalBackdrop}>
                        <View style={styles.modalSheet}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>{editing ? 'Edit Payment Method' : 'Add Payment Method'}</Text>
                                <TouchableOpacity
                                    accessibilityRole="button"
                                    accessibilityLabel="Close" onPress={() => setShowModal(false)} disabled={saving} style={styles.closeButton}>
                                    <MaterialIcons name="close" size={18} color={colors.textSecondary} />
                                </TouchableOpacity>
                            </View>

                            <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
                                <Text style={styles.label}>PROVIDER NAME *</Text>
                                <TextInput
                                    style={styles.input}
                                    testID="qr-pay-provider-name"
                                    value={providerName}
                                    onChangeText={setProviderName}
                                    placeholder="Revolut, Bizum, Bank Transfer..."
                                    placeholderTextColor={colors.textMuted}
                                    editable={!saving}
                                />

                                <Text style={styles.label}>QR SOURCE *</Text>
                                <View style={styles.sourceRow}>
                                    {(['image', 'payload'] as const).map((mode) => (
                                        <TouchableOpacity
                                            key={mode}
                                            style={[styles.sourceOption, sourceMode === mode && styles.sourceOptionSelected]}
                                            onPress={() => setSourceMode(mode)}
                                            disabled={saving}
                                        >
                                            <View style={[styles.radioOuter, sourceMode === mode && styles.radioOuterSelected]}>
                                                {sourceMode === mode && <View style={styles.radioInner} />}
                                            </View>
                                            <Text style={styles.sourceOptionText}>
                                                {mode === 'image' ? 'QR Image' : 'QR Payload (text/URL)'}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>

                                {sourceMode === 'image' ? (
                                    <View style={styles.sourceBody}>
                                        {!!imageUrl && (
                                            <Image source={{ uri: imageUrl }} style={styles.imagePreview} resizeMode="contain" />
                                        )}
                                        <ImageUrlUpload
                                            label={editing ? 'Replace image by URL' : 'Add image by URL'}
                                            onUpload={(url) => setImageUrl(url)}
                                            userId={user?.id}
                                            pathPrefix="qr-pay"
                                        />
                                    </View>
                                ) : (
                                    <View style={styles.sourceBody}>
                                        <TextInput
                                            style={styles.input}
                                            testID="qr-pay-payload"
                                            value={payload}
                                            onChangeText={setPayload}
                                            placeholder="IBAN, payment link, or payload text to encode as QR"
                                            placeholderTextColor={colors.textMuted}
                                            multiline
                                            numberOfLines={2}
                                            editable={!saving}
                                        />
                                        {!!payload && (
                                            <View style={styles.payloadPreview}>
                                                <QRCode value={payload} size={120} />
                                            </View>
                                        )}
                                    </View>
                                )}

                                <Text style={styles.label}>DISPLAY ORDER</Text>
                                <TextInput
                                    style={styles.input}
                                    value={displayOrder}
                                    onChangeText={setDisplayOrder}
                                    placeholder="0"
                                    placeholderTextColor={colors.textMuted}
                                    keyboardType="number-pad"
                                    editable={!saving}
                                />

                                <TouchableOpacity
                                    style={[styles.submitButton, saving && { opacity: 0.6 }]}
                                    testID="qr-pay-save"
                                    onPress={handleSave}
                                    disabled={saving}
                                >
                                    {saving ? (
                                        <ActivityIndicator size="small" color="#FFF" />
                                    ) : (
                                        <Text style={styles.submitButtonText}>{editing ? 'Save Changes' : 'Add Payment Method'}</Text>
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
    emptyText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xs, lineHeight: 20 },
    centerMessage: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
    codeCard: { width: '47%', padding: spacing.md, alignItems: 'center' },
    codeCardInactive: { opacity: 0.55 },
    codeCardInner: { alignItems: 'center', width: '100%' },
    codeQrWrap: {
        padding: 8,
        backgroundColor: '#FFF',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.06)',
        marginBottom: 8,
    },
    qrFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#F5F5F5', borderRadius: 12 },
    codeName: { fontSize: 14, fontWeight: '700', color: colors.text },
    codeActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: spacing.sm,
        paddingTop: spacing.sm,
        borderTopWidth: 1,
        borderTopColor: 'rgba(0,0,0,0.06)',
        width: '100%',
        justifyContent: 'center',
    },
    smallButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        backgroundColor: '#F3F4F6',
    },
    smallButtonText: { fontSize: 10, fontWeight: '700', color: '#374151', letterSpacing: 0.3, textTransform: 'uppercase' },
    toggleOff: { backgroundColor: '#FEF2F2' },
    toggleOn: { backgroundColor: '#ECFDF5' },
    toggleOffText: { color: '#DC2626' },
    toggleOnText: { color: '#059669' },
    deleteButton: { padding: 4 },
    fullscreenWrap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' },
    fullscreenClose: { position: 'absolute', top: 56, right: 24, padding: 8, zIndex: 2 },
    fullscreenCard: { backgroundColor: '#FFF', borderRadius: 24, padding: spacing.xl, alignItems: 'center' },
    fullscreenName: { fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: spacing.md },
    fullscreenQr: { padding: spacing.md },
    fullscreenHint: { fontSize: 12, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.md },
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
    sourceRow: { flexDirection: 'row', gap: spacing.sm },
    sourceOption: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.08)',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    sourceOptionSelected: { borderColor: '#000', backgroundColor: '#F8F8F8' },
    sourceOptionText: { fontSize: 12, fontWeight: '600', color: colors.text },
    radioOuter: {
        width: 18,
        height: 18,
        borderRadius: 999,
        borderWidth: 2,
        borderColor: '#D1D5DB',
        alignItems: 'center',
        justifyContent: 'center',
    },
    radioOuterSelected: { borderColor: '#000' },
    radioInner: { width: 9, height: 9, borderRadius: 999, backgroundColor: '#000' },
    sourceBody: { marginTop: spacing.sm },
    imagePreview: { width: '100%', height: 140, borderRadius: 12, backgroundColor: '#F5F5F5', marginBottom: spacing.sm },
    payloadPreview: { alignItems: 'center', padding: spacing.md },
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

export default QrPaymentsScreen;
