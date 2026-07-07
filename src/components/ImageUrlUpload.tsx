import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { colors, layout } from '../theme/colors';
import { spacing } from '../theme/spacing';

interface ImageUrlUploadProps {
    onUpload: (publicUrl: string) => void;
    bucket?: string;
    pathPrefix?: string;
    userId?: string;
    label?: string;
    compact?: boolean;
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_SIZE = 10 * 1024 * 1024;

export function ImageUrlUpload({
    onUpload,
    bucket = 'site-images',
    pathPrefix = 'uploads',
    userId = 'anonymous',
    label = 'Add image by URL',
    compact = false,
}: ImageUrlUploadProps) {
    const [url, setUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const handleUpload = async () => {
        const trimmed = url.trim();
        if (!trimmed) {
            setError('Please paste an image URL');
            return;
        }

        let parsedUrl: URL;
        try {
            parsedUrl = new URL(trimmed);
        } catch {
            setError('Invalid URL format');
            return;
        }

        if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
            setError('Only HTTP(S) URLs are allowed');
            return;
        }

        setLoading(true);
        setError(null);
        setSuccess(false);

        try {
            const response = await fetch(trimmed);
            if (!response.ok) {
                throw new Error(`Failed to fetch image (${response.status})`);
            }

            const contentType = response.headers.get('content-type') || '';
            const matchedType = ALLOWED_TYPES.find((t) => contentType.includes(t));

            if (!matchedType) {
                throw new Error(`Unsupported image type: ${contentType}`);
            }

            const arrayBuffer = await response.arrayBuffer();

            if (arrayBuffer.byteLength > MAX_SIZE) {
                throw new Error(`Image too large (${(arrayBuffer.byteLength / 1024 / 1024).toFixed(1)} MB). Max: 10 MB`);
            }

            const ext = matchedType.split('/')[1];
            const fileName = `${pathPrefix}/${userId}/${Date.now()}.${ext}`;

            const { error: uploadError } = await supabase.storage
                .from(bucket)
                .upload(fileName, arrayBuffer, {
                    contentType: matchedType,
                    upsert: false,
                });

            if (uploadError) throw uploadError;

            const { data: publicUrlData } = supabase.storage
                .from(bucket)
                .getPublicUrl(fileName);

            onUpload(publicUrlData.publicUrl);
            setSuccess(true);
            setUrl('');
            setTimeout(() => setSuccess(false), 2000);
        } catch (err: any) {
            setError(err?.message || 'Upload failed');
        } finally {
            setLoading(false);
        }
    };

    if (compact) {
        return (
            <View style={styles.compactContainer}>
                <View style={styles.compactInputWrap}>
                    <MaterialIcons name="link" size={16} color={colors.textMuted} style={styles.compactIcon} />
                    <TextInput
                        style={styles.compactInput}
                        value={url}
                        onChangeText={setUrl}
                        placeholder="Paste image URL..."
                        placeholderTextColor={colors.textMuted}
                        keyboardType="url"
                        autoCapitalize="none"
                        autoCorrect={false}
                        editable={!loading}
                    />
                </View>
                <TouchableOpacity
                    style={[styles.compactButton, (!url.trim() || loading) && styles.buttonDisabled]}
                    onPress={handleUpload}
                    disabled={!url.trim() || loading}
                >
                    {loading ? (
                        <ActivityIndicator size="small" color="#fff" />
                    ) : success ? (
                        <MaterialIcons name="check" size={16} color="#fff" />
                    ) : (
                        <Text style={styles.compactButtonText}>Add</Text>
                    )}
                </TouchableOpacity>
                {error ? <Text style={styles.errorText}>{error}</Text> : null}
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.labelRow}>
                <MaterialIcons name="cloud-upload" size={18} color={colors.textMuted} />
                <Text style={styles.label}>{label}</Text>
            </View>
            <View style={styles.inputRow}>
                <TextInput
                    style={styles.input}
                    value={url}
                    onChangeText={setUrl}
                    placeholder="https://example.com/image.jpg"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="url"
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!loading}
                />
                <TouchableOpacity
                    style={[styles.button, (!url.trim() || loading) && styles.buttonDisabled]}
                    onPress={handleUpload}
                    disabled={!url.trim() || loading}
                >
                    {loading ? (
                        <ActivityIndicator size="small" color="#fff" />
                    ) : success ? (
                        <MaterialIcons name="check" size={18} color="#fff" />
                    ) : (
                        <Text style={styles.buttonText}>Upload</Text>
                    )}
                </TouchableOpacity>
            </View>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        borderWidth: 1.5,
        borderColor: colors.borderLight,
        borderStyle: 'dashed',
        borderRadius: layout.borderRadius.lg,
        padding: spacing.md,
        backgroundColor: colors.surfaceLight,
    },
    labelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        marginBottom: spacing.sm,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.textSecondary,
    },
    inputRow: {
        flexDirection: 'row',
        gap: spacing.sm,
    },
    input: {
        flex: 1,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: layout.borderRadius.md,
        paddingHorizontal: spacing.md,
        paddingVertical: Platform.OS === 'ios' ? 12 : 10,
        fontSize: 14,
        color: colors.text,
        backgroundColor: colors.surface,
    },
    button: {
        backgroundColor: colors.accent,
        borderRadius: layout.borderRadius.md,
        paddingHorizontal: spacing.lg,
        alignItems: 'center',
        justifyContent: 'center',
    },
    buttonDisabled: {
        opacity: 0.5,
    },
    buttonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    errorText: {
        fontSize: 12,
        color: colors.error,
        marginTop: spacing.xs,
    },
    compactContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        flexWrap: 'wrap',
    },
    compactInputWrap: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: layout.borderRadius.md,
        backgroundColor: colors.surface,
        minHeight: 38,
    },
    compactIcon: {
        paddingLeft: spacing.sm,
    },
    compactInput: {
        flex: 1,
        paddingHorizontal: spacing.sm,
        fontSize: 13,
        color: colors.text,
        paddingVertical: 8,
    },
    compactButton: {
        backgroundColor: colors.accent,
        borderRadius: layout.borderRadius.md,
        paddingHorizontal: spacing.md,
        paddingVertical: 8,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 38,
    },
    compactButtonText: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '600',
    },
});
