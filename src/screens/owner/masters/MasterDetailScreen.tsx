/**
 * MasterDetailScreen — Owner views/edits an active master's profile.
 * 
 * Features:
 *   - View master profile details
 *   - Edit verification, specialties
 *   - Deactivate / reactivate master account
 */
import React, { useState } from 'react';
import {
    View,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Image,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ScreenBackground, Card, MerakiText, Input, Button } from '../../../components/ui';
import { colors, spacing, layout } from '../../../theme';
import {
    updateMasterProfile,
    deactivateMaster,
    reactivateMaster,
    type MasterProfile,
} from '../../../services/masterManagementService';

type ParamList = {
    MasterDetail: { master: MasterProfile };
};

export function MasterDetailScreen() {
    const navigation = useNavigation<any>();
    const route = useRoute<RouteProp<ParamList, 'MasterDetail'>>();
    const { master } = route.params;

    const [isVerified, setIsVerified] = useState(master.is_verified || false);
    const [saving, setSaving] = useState(false);
    const [deactivating, setDeactivating] = useState(false);
    const isActive = master.master_status === 'active';

    const handleSave = async () => {
        setSaving(true);
        const { success, error } = await updateMasterProfile(master.id, {
            is_verified: isVerified,
        });
        setSaving(false);
        if (success) {
            Alert.alert('Saved', 'Master profile has been updated.', [
                { text: 'OK', onPress: () => navigation.goBack() }
            ]);
        } else {
            Alert.alert('Error', error?.message || 'Failed to update profile');
        }
    };

    const handleToggleActive = () => {
        const action = isActive ? 'deactivate' : 'reactivate';
        Alert.alert(
            `${isActive ? 'Deactivate' : 'Reactivate'} Master`,
            `Are you sure you want to ${action} ${master.full_name}?${isActive ? ' They will no longer be able to receive bookings.' : ''}`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: isActive ? 'Deactivate' : 'Reactivate',
                    style: isActive ? 'destructive' : 'default',
                    onPress: async () => {
                        setDeactivating(true);
                        const fn = isActive ? deactivateMaster : reactivateMaster;
                        const { success, error } = await fn(master.id);
                        setDeactivating(false);
                        if (success) {
                            Alert.alert('Done', `${master.full_name} has been ${action}d.`, [
                                { text: 'OK', onPress: () => navigation.goBack() }
                            ]);
                        } else {
                            Alert.alert('Error', error?.message || `Failed to ${action} master`);
                        }
                    },
                },
            ]
        );
    };

    return (
        <ScreenBackground>
            <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <MaterialIcons name="arrow-back" size={22} color={colors.text} />
                    </TouchableOpacity>
                    <MerakiText variant="h3" style={styles.headerTitle}>Master Profile</MerakiText>
                    <View style={{ width: 40 }} />
                </View>

                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                    {/* Profile Hero */}
                    <View style={styles.profileHero}>
                        {master.avatar_url ? (
                            <Image source={{ uri: master.avatar_url }} style={styles.avatarLarge} />
                        ) : (
                            <LinearGradient
                                colors={['rgba(212,168,83,0.25)', 'rgba(212,168,83,0.08)']}
                                style={styles.avatarLarge}
                            >
                                <MerakiText style={styles.avatarText}>
                                    {(master.full_name || 'M').charAt(0).toUpperCase()}
                                </MerakiText>
                            </LinearGradient>
                        )}
                        <MerakiText variant="h2" style={{ marginTop: spacing.md }}>{master.full_name}</MerakiText>
                        <MerakiText variant="body" color={colors.textSecondary}>
                            {master.specialties?.join(', ') || 'Beauty Professional'}
                        </MerakiText>
                        <View style={styles.statusRow}>
                            <View style={[
                                styles.statusChip,
                                { backgroundColor: isActive ? 'rgba(63,185,80,0.12)' : 'rgba(248,81,73,0.12)' }
                            ]}>
                                <View style={[
                                    styles.statusDotSmall,
                                    { backgroundColor: isActive ? colors.success : colors.error }
                                ]} />
                                <MerakiText variant="caption" color={isActive ? colors.success : colors.error}>
                                    {isActive ? 'Active' : 'Deactivated'}
                                </MerakiText>
                            </View>
                            {master.is_verified && (
                                <View style={[styles.statusChip, { backgroundColor: 'rgba(212,168,83,0.12)' }]}>
                                    <MaterialIcons name="verified" size={14} color={colors.accent} />
                                    <MerakiText variant="caption" color={colors.accent}>Verified</MerakiText>
                                </View>
                            )}
                        </View>
                    </View>

                    {/* Info Cards */}
                    <Card variant="glass" style={styles.section}>
                        <MerakiText variant="label" color={colors.textMuted} style={styles.sectionTitle}>
                            CONTACT
                        </MerakiText>
                        {master.email && (
                            <View style={styles.infoRow}>
                                <MaterialIcons name="email" size={18} color={colors.textMuted} />
                                <MerakiText variant="body" color={colors.textSecondary}>{master.email}</MerakiText>
                            </View>
                        )}
                        {master.phone && (
                            <View style={styles.infoRow}>
                                <MaterialIcons name="phone" size={18} color={colors.textMuted} />
                                <MerakiText variant="body" color={colors.textSecondary}>{master.phone}</MerakiText>
                            </View>
                        )}
                        {master.city && (
                            <View style={styles.infoRow}>
                                <MaterialIcons name="location-on" size={18} color={colors.textMuted} />
                                <MerakiText variant="body" color={colors.textSecondary}>{master.city}{master.country ? `, ${master.country}` : ''}</MerakiText>
                            </View>
                        )}
                    </Card>

                    {master.bio && (
                        <Card variant="glass" style={styles.section}>
                            <MerakiText variant="label" color={colors.textMuted} style={styles.sectionTitle}>BIO</MerakiText>
                            <MerakiText variant="body" color={colors.textSecondary}>{master.bio}</MerakiText>
                        </Card>
                    )}

                    {/* Editable Fields */}
                    <Card variant="glass" style={styles.section}>
                        <MerakiText variant="label" color={colors.textMuted} style={styles.sectionTitle}>
                            VERIFICATION
                        </MerakiText>
                        <TouchableOpacity
                            style={styles.toggleRow}
                            onPress={() => setIsVerified(!isVerified)}
                        >
                            <View style={{ flex: 1 }}>
                                <MerakiText variant="bodyBold">Verified Badge</MerakiText>
                                <MerakiText variant="caption" color={colors.textSecondary}>
                                    Shows a verified badge on the master's profile
                                </MerakiText>
                            </View>
                            <View style={[styles.toggle, isVerified && styles.toggleActive]}>
                                <View style={[styles.toggleKnob, isVerified && styles.toggleKnobActive]} />
                            </View>
                        </TouchableOpacity>
                    </Card>

                    {/* Save Button */}
                    <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
                        <LinearGradient
                            colors={['#E8A0B4', '#C47A90']}
                            style={styles.saveBtnGradient}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                        >
                            {saving ? (
                                <ActivityIndicator color="#FFF" size="small" />
                            ) : (
                                <MerakiText variant="bodyBold" color="#FFF">Save Changes</MerakiText>
                            )}
                        </LinearGradient>
                    </TouchableOpacity>

                    {/* Deactivate / Reactivate */}
                    <TouchableOpacity
                        style={[
                            styles.dangerBtn,
                            !isActive && styles.reactivateBtn
                        ]}
                        onPress={handleToggleActive}
                        disabled={deactivating}
                    >
                        {deactivating ? (
                            <ActivityIndicator color={isActive ? colors.error : colors.success} size="small" />
                        ) : (
                            <>
                                <MaterialCommunityIcons
                                    name={isActive ? 'account-off' : 'account-check'}
                                    size={18}
                                    color={isActive ? colors.error : colors.success}
                                />
                                <MerakiText variant="bodyBold" color={isActive ? colors.error : colors.success} style={{ marginLeft: 8 }}>
                                    {isActive ? 'Deactivate Account' : 'Reactivate Account'}
                                </MerakiText>
                            </>
                        )}
                    </TouchableOpacity>
                </ScrollView>
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
        paddingVertical: spacing.md,
    },
    backBtn: {
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: 'rgba(0, 0, 0, 0.03)',
        borderWidth: 1, borderColor: 'rgba(0, 0, 0, 0.06)',
        alignItems: 'center', justifyContent: 'center',
    },
    headerTitle: { flex: 1, marginLeft: spacing.md },
    scrollContent: { paddingHorizontal: spacing.lg, paddingBottom: 120 },

    profileHero: { alignItems: 'center', marginBottom: spacing.xl },
    avatarLarge: {
        width: 88, height: 88, borderRadius: 44,
        alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
    },
    avatarText: { fontSize: 36, fontWeight: '700' as any, color: '#FFFFFF' },
    statusRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
    statusChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    statusDotSmall: { width: 8, height: 8, borderRadius: 4 },

    section: { padding: spacing.lg, marginBottom: spacing.md },
    sectionTitle: { marginBottom: spacing.sm, fontSize: 11, letterSpacing: 1 },
    infoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },

    toggleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    toggle: {
        width: 48, height: 28, borderRadius: 14,
        backgroundColor: 'rgba(0, 0, 0, 0.08)',
        padding: 2,
        justifyContent: 'center',
    },
    toggleActive: { backgroundColor: 'rgba(212,168,83,0.30)' },
    toggleKnob: {
        width: 24, height: 24, borderRadius: 12,
        backgroundColor: 'rgba(0, 0, 0, 0.40)',
    },
    toggleKnobActive: {
        backgroundColor: colors.accent,
        alignSelf: 'flex-end',
    },

    saveBtn: { borderRadius: layout.borderRadius.lg, overflow: 'hidden', marginTop: spacing.md },
    saveBtnGradient: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
    },

    dangerBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        marginTop: spacing.md,
        borderRadius: layout.borderRadius.lg,
        borderWidth: 1,
        borderColor: 'rgba(248,81,73,0.20)',
        backgroundColor: 'rgba(248,81,73,0.06)',
    },
    reactivateBtn: {
        borderColor: 'rgba(63,185,80,0.20)',
        backgroundColor: 'rgba(63,185,80,0.06)',
    },
});

export default MasterDetailScreen;
