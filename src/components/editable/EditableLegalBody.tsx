import React, { useState, useCallback, ReactNode } from 'react';
import {
    View,
    Text,
    TextInput,
    StyleSheet,
    TouchableOpacity,
    Modal,
    ActivityIndicator,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useEditMode } from '../../contexts/EditContext';
import { colors, spacing, layout } from '../../theme';

interface EditableLegalBodyProps {
    /** `global_settings` key, e.g. 'legal.tos_body'. Shared with meraki-WEB. */
    contentKey: string;
    /** Human label used on the edit trigger, e.g. 'Terms of Service'. */
    label: string;
    /** Plain-text seed used when the owner starts editing from the default. */
    defaultText: string;
    /** Rich built-in document rendered while no override exists. */
    children: ReactNode;
}

/**
 * Legal document body an owner can replace with their own text.
 *
 * - No override saved → renders the built-in `children`.
 * - Override saved   → renders the custom text with line breaks preserved.
 * - Owner + edit mode → shows an "Edit document" trigger.
 *
 * Uses the same `legal.*` keys as the website, so one edit updates both.
 */
export function EditableLegalBody({
    contentKey,
    label,
    defaultText,
    children,
}: EditableLegalBodyProps) {
    const { isEditMode, canEdit, content, updateContent, clearContent } = useEditMode();
    const override = content[contentKey] ?? '';

    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const startEditing = useCallback(() => {
        setDraft(override || defaultText);
        setError(null);
        setEditing(true);
    }, [override, defaultText]);

    const save = useCallback(async () => {
        setSaving(true);
        // Saving text identical to the factory default restores the rich version.
        const trimmed = draft.trim();
        const result =
            trimmed === '' || trimmed === defaultText.trim()
                ? await clearContent(contentKey)
                : await updateContent(contentKey, draft);
        setSaving(false);
        if (result.error) {
            setError(result.error);
            return;
        }
        setEditing(false);
    }, [contentKey, draft, defaultText, updateContent, clearContent]);

    const restoreDefault = useCallback(async () => {
        setSaving(true);
        const { error: clearError } = await clearContent(contentKey);
        setSaving(false);
        if (clearError) {
            setError(clearError);
            return;
        }
        setEditing(false);
    }, [contentKey, clearContent]);

    return (
        <View>
            {isEditMode && canEdit && (
                <TouchableOpacity
                    style={styles.trigger}
                    onPress={startEditing}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel={`Edit ${label}`}
                >
                    <MaterialIcons name="edit-document" size={15} color="#fff" />
                    <Text style={styles.triggerText}>Edit {label}</Text>
                </TouchableOpacity>
            )}

            {override ? <Text style={styles.overrideBody}>{override}</Text> : children}

            <Modal
                visible={editing}
                transparent
                animationType="slide"
                onRequestClose={() => setEditing(false)}
            >
                <KeyboardAvoidingView
                    style={styles.overlay}
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                >
                    <View style={styles.sheet}>
                        <View style={styles.sheetHeader}>
                            <MaterialIcons name="edit-document" size={20} color="#EC4899" />
                            <Text style={styles.sheetTitle} numberOfLines={1}>
                                {label}
                            </Text>
                            <TouchableOpacity
                                onPress={() => setEditing(false)}
                                style={styles.closeButton}
                                accessibilityLabel="Close editor"
                            >
                                <MaterialIcons name="close" size={22} color={colors.textMuted} />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.sheetHint}>
                            Plain text — blank lines separate sections. Clearing the box restores
                            the built-in document. Published to the app and website.
                        </Text>

                        <ScrollView style={styles.inputScroll} keyboardShouldPersistTaps="handled">
                            <TextInput
                                style={styles.input}
                                value={draft}
                                onChangeText={setDraft}
                                multiline
                                textAlignVertical="top"
                                accessibilityLabel={`${label} body editor`}
                            />
                        </ScrollView>

                        {error ? <Text style={styles.errorText}>{error}</Text> : null}

                        <View style={styles.actions}>
                            <TouchableOpacity
                                style={[styles.button, styles.cancelButton]}
                                onPress={() => setEditing(false)}
                                disabled={saving}
                            >
                                <Text style={styles.cancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.button, styles.saveButton, saving && styles.buttonDisabled]}
                                onPress={save}
                                disabled={saving}
                            >
                                {saving ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <Text style={styles.saveText}>Save & Publish</Text>
                                )}
                            </TouchableOpacity>
                        </View>

                        {Boolean(override) && (
                            <TouchableOpacity
                                style={styles.restoreButton}
                                onPress={restoreDefault}
                                disabled={saving}
                            >
                                <MaterialIcons name="restore" size={15} color="#EF4444" />
                                <Text style={styles.restoreText}>Restore built-in document</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    trigger: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: 6,
        backgroundColor: '#EC4899',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
        marginBottom: spacing.md,
    },
    triggerText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#fff',
    },
    overrideBody: {
        fontSize: 14,
        lineHeight: 22,
        color: colors.textSecondary,
    },
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    sheet: {
        backgroundColor: '#fff',
        borderTopLeftRadius: layout.borderRadius.xl,
        borderTopRightRadius: layout.borderRadius.xl,
        padding: spacing.lg,
        maxHeight: '92%',
    },
    sheetHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    sheetTitle: {
        flex: 1,
        fontSize: 17,
        fontWeight: '700',
        color: colors.text,
    },
    closeButton: {
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sheetHint: {
        fontSize: 12,
        color: colors.textMuted,
        lineHeight: 17,
        marginTop: 2,
        marginBottom: spacing.md,
    },
    inputScroll: {
        maxHeight: 340,
    },
    input: {
        borderWidth: 1.5,
        borderColor: '#EC4899',
        borderRadius: layout.borderRadius.md,
        padding: spacing.md,
        fontSize: 13,
        lineHeight: 20,
        minHeight: 260,
        color: colors.text,
        backgroundColor: colors.surface,
    },
    errorText: {
        fontSize: 12,
        color: colors.error,
        marginTop: spacing.xs,
    },
    actions: {
        flexDirection: 'row',
        gap: spacing.sm,
        marginTop: spacing.md,
    },
    button: {
        flex: 1,
        paddingVertical: 13,
        borderRadius: layout.borderRadius.md,
        alignItems: 'center',
        justifyContent: 'center',
    },
    buttonDisabled: {
        opacity: 0.6,
    },
    cancelButton: {
        backgroundColor: colors.surfaceLight,
        borderWidth: 1,
        borderColor: colors.border,
    },
    cancelText: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.textSecondary,
    },
    saveButton: {
        backgroundColor: '#EC4899',
    },
    saveText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#fff',
    },
    restoreButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        marginTop: spacing.sm,
        paddingVertical: 10,
    },
    restoreText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#EF4444',
    },
});

export default EditableLegalBody;
