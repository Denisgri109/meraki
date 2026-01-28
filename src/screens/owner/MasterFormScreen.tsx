import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TextInput,
    TouchableOpacity,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { Button, ScreenBackground } from '../../components/ui';
import { colors, spacing } from '../../theme';
import { Profile } from '../../types/database';
import { validateIrishPhone, formatIrishPhone, normalizeIrishPhone } from '../../utils/validation';

type MasterProfile = Profile & {
    master_status?: string;
    commission_rate?: number;
    is_pending_signup?: boolean;
};

type RouteParams = {
    MasterForm: { master?: MasterProfile };
};

const STATUS_OPTIONS = ['active', 'pending', 'suspended', 'inactive'];

export function MasterFormScreen() {
    const navigation = useNavigation<any>();
    const route = useRoute<RouteProp<RouteParams, 'MasterForm'>>();
    const existingMaster = route.params?.master;
    const isEditing = !!existingMaster;

    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        full_name: existingMaster?.full_name || '',
        email: existingMaster?.email || '',
        phone: existingMaster?.phone || '',
        bio: existingMaster?.bio || '',
        master_status: existingMaster?.master_status || 'active',
        commission_rate: existingMaster?.commission_rate || 0.2,
    });

    const handleSave = async () => {
        if (!formData.full_name.trim()) {
            Alert.alert('Error', 'Please enter a name');
            return;
        }
        if (!formData.email.trim()) {
            Alert.alert('Error', 'Please enter an email');
            return;
        }

        // Validate phone if provided
        if (formData.phone.trim()) {
            const phoneValidation = validateIrishPhone(formData.phone);
            if (!phoneValidation.valid) {
                Alert.alert('Error', phoneValidation.error || 'Invalid phone number');
                return;
            }
        }

        setLoading(true);
        try {
            const normalizedPhone = formData.phone.trim() ? normalizeIrishPhone(formData.phone) : null;

            if (isEditing) {
                // Update existing master
                if (existingMaster.is_pending_signup) {
                    const { error } = await (supabase as any)
                        .from('pending_masters')
                        .update({
                            email: formData.email.trim().toLowerCase(),
                            full_name: formData.full_name.trim(),
                            phone: normalizedPhone,
                            bio: formData.bio.trim() || null,
                            master_status: formData.master_status,
                            commission_rate: formData.commission_rate,
                        })
                        .eq('id', existingMaster.id);

                    if (error) throw error;
                } else {
                    const { error } = await supabase
                        .from('profiles')
                        .update({
                            full_name: formData.full_name.trim(),
                            phone: normalizedPhone,
                            bio: formData.bio.trim() || null,
                            master_status: formData.master_status,
                            commission_rate: formData.commission_rate,
                        })
                        .eq('id', existingMaster.id);

                    if (error) throw error;
                }
                Alert.alert('Success', 'Master updated successfully');
            } else {
                // Check if email exists
                const { data: existingProfile } = await supabase
                    .from('profiles')
                    .select('id, role')
                    .eq('email', formData.email.trim().toLowerCase())
                    .single();

                if (existingProfile) {
                    // Update existing user to master
                    const { error } = await supabase
                        .from('profiles')
                        .update({
                            full_name: formData.full_name.trim(),
                            phone: normalizedPhone,
                            bio: formData.bio.trim() || null,
                            role: 'master',
                            is_master: true,
                            master_status: formData.master_status,
                            commission_rate: formData.commission_rate,
                        })
                        .eq('id', existingProfile.id);

                    if (error) throw error;
                    Alert.alert('Success', 'User promoted to Master');
                } else {
                    // Add to pending_masters table for users who haven't signed up yet
                    const { error: insertError } = await (supabase as any)
                        .from('pending_masters')
                        .insert({
                            email: formData.email.trim().toLowerCase(),
                            full_name: formData.full_name.trim(),
                            phone: normalizedPhone,
                            bio: formData.bio.trim() || null,
                            master_status: formData.master_status,
                            commission_rate: formData.commission_rate,
                        });

                    if (insertError) {
                        if (insertError.code === '23505') {
                            Alert.alert('Already Pending', 'This email is already registered as a pending master.');
                            return;
                        }
                        throw insertError;
                    }
                    Alert.alert('Success', 'Master invitation created! When this person signs up with this email, they will automatically have master access.');
                }
            }
            navigation.goBack();
        } catch (error: any) {
            console.error('Error saving master:', error);
            Alert.alert('Error', error.message || 'Failed to save master');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = () => {
        if (!isEditing) return;

        const isPending = existingMaster?.is_pending_signup;
        Alert.alert(
            isPending ? 'Revoke Invite' : 'Remove Master',
            isPending
                ? 'Are you sure you want to revoke this invitation? This cannot be undone.'
                : 'Are you sure you want to remove this master? This will demote them to a regular client.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: isPending ? 'Revoke' : 'Remove',
                    style: 'destructive',
                    onPress: async () => {
                        setLoading(true);
                        try {
                            let error;
                            if (isPending) {
                                const { error: deleteError } = await (supabase as any)
                                    .from('pending_masters')
                                    .delete()
                                    .eq('id', existingMaster.id);
                                error = deleteError;
                            } else {
                                const { error: updateError } = await supabase
                                    .from('profiles')
                                    .update({
                                        role: 'client',
                                        is_master: false,
                                        master_status: null,
                                        commission_rate: null,
                                    })
                                    .eq('id', existingMaster.id);
                                error = updateError;
                            }

                            if (error) throw error;
                            Alert.alert('Success', isPending ? 'Invitation revoked' : 'Master removed');
                            navigation.goBack();
                        } catch (error: any) {
                            console.error('Error removing master:', error);
                            Alert.alert('Error', error.message || 'Failed to remove master');
                        } finally {
                            setLoading(false);
                        }
                    },
                },
            ]
        );
    };

    const handlePhoneBlur = () => {
        if (formData.phone.trim()) {
            const validation = validateIrishPhone(formData.phone);
            if (validation.valid) {
                setFormData({ ...formData, phone: formatIrishPhone(formData.phone) });
            }
        }
    };

    return (
        <ScreenBackground>
            <SafeAreaView style={styles.container} edges={['top']}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()}>
                        <Text style={styles.backButton}>← Back</Text>
                    </TouchableOpacity>
                    <Text style={styles.title}>{isEditing ? 'Edit Master' : 'Add Master'}</Text>
                    <View style={{ width: 60 }} />
                </View>

                <ScrollView contentContainerStyle={styles.content}>
                    {/* Basic Info */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Basic Information</Text>

                        <Text style={styles.label}>Full Name *</Text>
                        <TextInput
                            style={styles.input}
                            value={formData.full_name}
                            onChangeText={(v) => setFormData({ ...formData, full_name: v })}
                            placeholder="Enter full name"
                            placeholderTextColor={colors.textMuted}
                        />

                        <Text style={styles.label}>Email *</Text>
                        <TextInput
                            style={[styles.input, isEditing && styles.inputDisabled]}
                            value={formData.email}
                            onChangeText={(v) => setFormData({ ...formData, email: v })}
                            placeholder="Enter email address"
                            placeholderTextColor={colors.textMuted}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            editable={!isEditing}
                        />

                        <Text style={styles.label}>Phone (Ireland)</Text>
                        <TextInput
                            style={styles.input}
                            value={formData.phone}
                            onChangeText={(v) => setFormData({ ...formData, phone: v })}
                            onBlur={handlePhoneBlur}
                            placeholder="+353 87 123 4567"
                            placeholderTextColor={colors.textMuted}
                            keyboardType="phone-pad"
                        />
                        <Text style={styles.phoneHint}>Enter Irish mobile number</Text>

                        <Text style={styles.label}>Bio</Text>
                        <TextInput
                            style={[styles.input, styles.textArea]}
                            value={formData.bio}
                            onChangeText={(v) => setFormData({ ...formData, bio: v })}
                            placeholder="Enter bio or description"
                            placeholderTextColor={colors.textMuted}
                            multiline
                            numberOfLines={4}
                        />
                    </View>

                    {/* Status & Commission */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Status & Commission</Text>

                        <Text style={styles.label}>Status</Text>
                        <View style={styles.statusOptions}>
                            {STATUS_OPTIONS.map((status) => (
                                <TouchableOpacity
                                    key={status}
                                    style={[
                                        styles.statusOption,
                                        formData.master_status === status && styles.statusOptionActive,
                                    ]}
                                    onPress={() => setFormData({ ...formData, master_status: status })}
                                >
                                    <Text style={[
                                        styles.statusOptionText,
                                        formData.master_status === status && styles.statusOptionTextActive,
                                    ]}>
                                        {status.charAt(0).toUpperCase() + status.slice(1)}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <Text style={styles.label}>Commission Rate: {(formData.commission_rate * 100).toFixed(0)}%</Text>
                        <View style={styles.commissionRow}>
                            {[0.1, 0.15, 0.2, 0.25, 0.3].map((rate) => (
                                <TouchableOpacity
                                    key={rate}
                                    style={[
                                        styles.commissionOption,
                                        formData.commission_rate === rate && styles.commissionOptionActive,
                                    ]}
                                    onPress={() => setFormData({ ...formData, commission_rate: rate })}
                                >
                                    <Text style={[
                                        styles.commissionText,
                                        formData.commission_rate === rate && styles.commissionTextActive,
                                    ]}>
                                        {(rate * 100).toFixed(0)}%
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    {/* Actions */}
                    <View style={styles.actions}>
                        <Button
                            title={loading ? 'Saving...' : (isEditing ? 'Save Changes' : 'Add Master')}
                            onPress={handleSave}
                            disabled={loading}
                        />

                        {isEditing && (
                            <TouchableOpacity
                                style={styles.deleteButton}
                                onPress={handleDelete}
                                disabled={loading}
                            >
                                <Text style={styles.deleteButtonText}>Remove Master</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </ScrollView>
            </SafeAreaView>
        </ScreenBackground>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: spacing.lg,
        paddingBottom: spacing.md,
    },
    backButton: { fontSize: 16, color: colors.text },
    title: { fontSize: 20, fontWeight: '600', color: colors.text },
    content: { padding: spacing.lg },
    section: { marginBottom: spacing.xl },
    sectionTitle: {
        fontSize: 12,
        fontWeight: '600',
        color: colors.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: 1.5,
        marginBottom: spacing.md,
    },
    label: {
        fontSize: 14,
        color: colors.text,
        marginBottom: spacing.xs,
        fontWeight: '500',
    },
    input: {
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: spacing.md,
        color: colors.text,
        fontSize: 16,
        borderWidth: 1,
        borderColor: colors.border,
        marginBottom: spacing.md,
    },
    inputDisabled: {
        opacity: 0.5,
    },
    textArea: {
        height: 100,
        textAlignVertical: 'top',
    },
    phoneHint: {
        fontSize: 11,
        color: colors.textMuted,
        marginTop: -spacing.sm,
        marginBottom: spacing.md,
    },
    statusOptions: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
        marginBottom: spacing.md,
    },
    statusOption: {
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        borderRadius: 8,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
    },
    statusOptionActive: {
        backgroundColor: '#8B5CF6',
        borderColor: '#8B5CF6',
    },
    statusOptionText: { fontSize: 14, color: colors.textSecondary },
    statusOptionTextActive: { color: '#fff', fontWeight: '600' },
    commissionRow: {
        flexDirection: 'row',
        gap: spacing.sm,
    },
    commissionOption: {
        flex: 1,
        paddingVertical: spacing.sm,
        alignItems: 'center',
        borderRadius: 8,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
    },
    commissionOptionActive: {
        backgroundColor: '#8B5CF6',
        borderColor: '#8B5CF6',
    },
    commissionText: { fontSize: 14, color: colors.textSecondary },
    commissionTextActive: { color: '#fff', fontWeight: '600' },
    actions: { marginTop: spacing.lg },
    deleteButton: {
        marginTop: spacing.md,
        padding: spacing.md,
        alignItems: 'center',
    },
    deleteButtonText: { color: '#EF4444', fontSize: 16, fontWeight: '600' },
});

export default MasterFormScreen;
