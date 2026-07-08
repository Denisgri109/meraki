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

function isLocalOrPrivateIP(hostname: string): boolean {
    // Strip trailing dot which is valid in DNS but bypasses simple string checks
    const lowerHost = hostname.toLowerCase().replace(/\.$/, '');

    if (lowerHost === 'localhost') return true;
    if (lowerHost.endsWith('.local') || lowerHost.endsWith('.internal')) return true;

    // Block common SSRF DNS bypass services
    const bypassDomains = ['.nip.io', '.sslip.io', '.xip.io', 'vcap.me', 'localtest.me', 'lvh.me'];
    if (bypassDomains.some(d => lowerHost.endsWith(d))) return true;

    // Reject 0.0.0.0 and :: (can map to localhost)
    if (lowerHost === '0.0.0.0' || lowerHost === '::' || lowerHost === '[::]') return true;

    // IPv4 check
    const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    const match = lowerHost.match(ipv4Regex);
    if (match) {
        const parts = match.slice(1).map(Number);
        if (
            parts[0] === 127 || // 127.0.0.0/8 loopback
            parts[0] === 10 || // 10.0.0.0/8 private
            parts[0] === 0 || // 0.0.0.0/8 "this network"
            (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) || // 172.16.0.0/12 private
            (parts[0] === 192 && parts[1] === 168) || // 192.168.0.0/16 private
            (parts[0] === 169 && parts[1] === 254) // 169.254.0.0/16 link-local
        ) {
            return true;
        }
    }

    // IPv6 Loopback
    if (lowerHost === '[::1]' || lowerHost === '::1') return true;

    // General IPv6 private/local ranges (fc00::/7 unique local, fe80::/10 link-local)
    // We only check bracketed IPv6 to avoid false positives on domains like fda.gov
    if (lowerHost.startsWith('[fc') || lowerHost.startsWith('[fd') || lowerHost.startsWith('[fe8') || lowerHost.startsWith('[fe9') || lowerHost.startsWith('[fea') || lowerHost.startsWith('[feb')) {
        return true;
    }

    // IPv4-mapped IPv6 addresses (e.g., ::ffff:127.0.0.1 which becomes [::ffff:7f00:1])
    if (lowerHost.startsWith('[::ffff:') || lowerHost.startsWith('::ffff:')) {
        // For simplicity and security, we block all IPv4-mapped IPv6 addresses
        // because determining if it maps to a private IPv4 without a full parser is complex.
        return true;
    }

    return false;
}

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

        if (isLocalOrPrivateIP(parsedUrl.hostname)) {
            setError('Invalid URL: Local or private networks are not allowed');
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
