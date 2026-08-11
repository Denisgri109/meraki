import React, { useState, useCallback, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    StyleSheet,
    TouchableOpacity,
    Modal,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    StyleProp,
    TextStyle,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useEditMode } from '../../contexts/EditContext';
import { getTextFallback } from '../../lib/mobileContent';
import { MerakiText } from '../ui/MerakiText';
import { colors, spacing, layout } from '../../theme';

interface EditableTextProps {
    /** `global_settings` key, e.g. 'mobile.home.hero_tagline'. */
    contentKey: string;
    /**
     * Factory default. Omit to use the value registered in `mobileContent.ts`,
     * which keeps this screen and the Customize App screen in lockstep.
     */
    fallback?: string;
    style?: StyleProp<TextStyle>;
    numberOfLines?: number;
    /** Show a taller editor for paragraph copy. */
    multiline?: boolean;
    /** Human label shown in the editor sheet, e.g. 'Hero Headline'. */
    label?: string;
}

/**
 * Owner-editable text. Renders as plain text for everyone; while an owner has
 * Visual Edit Mode on it gains a dashed highlight and opens a save/cancel
 * editor sheet on tap. Non-owners can never reach the editor (and RLS blocks
 * the write regardless).
 */
export function EditableText({
    contentKey,
    fallback,
    style,
    numberOfLines,
    multiline = false,
    label,
}: EditableTextProps) {
    const { isEditMode, canEdit, getContent, updateContent, clearContent } = useEditMode();

    const defaultValue = fallback ?? getTextFallback(contentKey);
    const value = getContent(contentKey, defaultValue);
    const isCustom = value !== defaultValue;
    const editable = isEditMode && canEdit;

    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState(value);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Re-seed the draft whenever the sheet opens so it never shows stale text.
    useEffect(() => {
        if (open) {
            setDraft(value);
            setError(null);
        }
    }, [open, value]);

    const handleSave = useCallback(async () => {
        setSaving(true);
        const { error: saveError } = await updateContent(contentKey, draft);
        setSaving(false);
        if (saveError) {
            setError(saveError);
            return;
        }
        setOpen(false);
    }, [contentKey, draft, updateContent]);

    const handleRestoreDefault = useCallback(async () => {
        setSaving(true);
        const { error: clearError } = await clearContent(contentKey);
        setSaving(false);
        if (clearError) {
            setError(clearError);
            return;
        }
        setOpen(false);
    }, [contentKey, clearContent]);

    if (!editable) {
        return (
            <MerakiText style={style} numberOfLines={numberOfLines}>
                {value}
            </MerakiText>
        );
    }

    return (
        <>
            {/* Stays a <Text>, so turning edit mode on never reflows the screen —
                the highlight is drawn on the text node itself. */}
            <MerakiText
                style={[style, styles.editableHighlight]}
                numberOfLines={numberOfLines}
                onPress={() => setOpen(true)}
                suppressHighlighting
                accessibilityRole="button"
                accessibilityLabel={`Edit ${label ?? contentKey}`}
                accessibilityHint="Opens the text editor"
            >
                {value}
            </MerakiText>

            <Modal
                visible={open}
                transparent
                animationType="fade"
                onRequestClose={() => setOpen(false)}
            >
                <KeyboardAvoidingView
                    style={styles.overlay}
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                >
                    <View style={styles.sheet}>
                        <View style={styles.sheetHeader}>
                            <MaterialIcons name="edit" size={20} color="#EC4899" />
                            <Text style={styles.sheetTitle} numberOfLines={1}>
                                {label ?? 'Edit text'}
                            </Text>
                            <TouchableOpacity
                                onPress={() => setOpen(false)}
                                style={styles.closeButton}
                                accessibilityLabel="Close editor"
                            >
                                <MaterialIcons name="close" size={22} color={colors.textMuted} />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.sheetHint}>
                            Saved changes are published to every user immediately.
                        </Text>

                        <TextInput
                            style={[styles.input, multiline && styles.inputMultiline]}
                            value={draft}
                            onChangeText={setDraft}
                            multiline={multiline}
                            autoFocus
                            placeholder={defaultValue}
                            placeholderTextColor={colors.textMuted}
                            textAlignVertical={multiline ? 'top' : 'center'}
                        />

                        {error ? <Text style={styles.errorText}>{error}</Text> : null}

                        <View style={styles.actions}>
                            <TouchableOpacity
                                style={[styles.button, styles.cancelButton]}
                                onPress={() => setOpen(false)}
                                disabled={saving}
                            >
                                <Text style={styles.cancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.button, styles.saveButton, saving && styles.buttonDisabled]}
                                onPress={handleSave}
                                disabled={saving}
                            >
                                {saving ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <Text style={styles.saveText}>Save</Text>
                                )}
                            </TouchableOpacity>
                        </View>

                        {isCustom && (
                            <TouchableOpacity
                                style={styles.restoreButton}
                                onPress={handleRestoreDefault}
                                disabled={saving}
                            >
                                <MaterialIcons name="restore" size={15} color="#EF4444" />
                                <Text style={styles.restoreText}>Restore original text</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </>
    );
}

const styles = StyleSheet.create({
    editableHighlight: {
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: '#EC4899',
        borderRadius: 6,
        backgroundColor: 'rgba(236, 72, 153, 0.08)',
    },
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    sheet: {
        backgroundColor: '#fff',
        borderRadius: layout.borderRadius.lg,
        padding: spacing.lg,
        width: '100%',
        maxWidth: 420,
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
        marginTop: 2,
        marginBottom: spacing.md,
    },
    input: {
        borderWidth: 1.5,
        borderColor: '#EC4899',
        borderRadius: layout.borderRadius.md,
        paddingHorizontal: spacing.md,
        paddingVertical: Platform.OS === 'ios' ? 12 : 10,
        fontSize: 15,
        color: colors.text,
        backgroundColor: colors.surface,
    },
    inputMultiline: {
        minHeight: 120,
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

export default EditableText;
