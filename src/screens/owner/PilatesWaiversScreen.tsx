import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useModal } from '../../contexts/ModalContext';
import { Card, ScreenBackground } from '../../components/ui';
import { colors, spacing } from '../../theme';
import { Tables } from '../../types/database';

type WaiverRow = Tables<'pilates_waivers'> & {
    profile: { full_name: string | null; email: string | null; phone: string | null } | null;
};

const EMERALD = '#10B981';
const EMERALD_DARK = '#047857';
const EMERALD_BG = '#ECFDF5';

export function PilatesWaiversScreen() {
    const navigation = useNavigation<any>();
    const { role } = useAuth();
    const { showAlert } = useModal();
    const [loading, setLoading] = useState(true);
    const [waivers, setWaivers] = useState<WaiverRow[]>([]);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const isStaff = role === 'owner' || role === 'master';

    const loadWaivers = useCallback(async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('pilates_waivers')
                .select('*, profile:profiles!pilates_waivers_user_id_fkey(full_name, email, phone)')
                .order('signed_at', { ascending: false });
            if (error) throw error;
            setWaivers((data || []) as unknown as WaiverRow[]);
        } catch (error: any) {
            showAlert('Error', error.message || 'Failed to load waivers', 'error');
        } finally {
            setLoading(false);
        }
    }, [showAlert]);

    useFocusEffect(
        useCallback(() => {
            loadWaivers();
        }, [loadWaivers])
    );

    const renderRow = (icon: string, label: string, value: string | null | undefined) => {
        if (!value) return null;
        return (
            <View style={styles.detailRow}>
                <MaterialIcons name={icon as any} size={13} color={EMERALD_DARK} />
                <Text style={styles.detailText}>
                    <Text style={styles.detailLabel}>{label}: </Text>
                    {value}
                </Text>
            </View>
        );
    };

    const renderBool = (label: string, value: boolean | null) => (
        <View style={styles.detailRow}>
            <MaterialIcons
                name={value ? 'check-circle' : 'radio-button-unchecked'}
                size={13}
                color={value ? EMERALD_DARK : colors.textMuted}
            />
            <Text style={styles.detailText}>
                <Text style={styles.detailLabel}>{label}: </Text>
                {value ? 'Yes' : 'No'}
            </Text>
        </View>
    );

    const renderExpanded = (w: WaiverRow) => {
        const isV3 = w.injuries_joint_problems != null;
        return (
            <View style={styles.expandedBody}>
                <Text style={styles.expandedSection}>EMERGENCY CONTACT</Text>
                {renderRow('person', 'Name', w.emergency_contact_name)}
                {renderRow('family-restroom', 'Relationship', w.emergency_contact_relationship)}
                {renderRow('phone', 'Phone', w.emergency_contact_phone)}

                {isV3 ? (
                    <>
                        <Text style={styles.expandedSection}>HEALTH SCREENING (v3)</Text>
                        {renderRow('healing', 'Injuries / joint problems', w.injuries_joint_problems)}
                        {renderRow('fitness-center', 'Pilates experience', w.pilates_experience)}
                        {renderBool('Illnesses or disabilities', w.has_illnesses)}
                        {w.has_illnesses ? renderRow('medication', 'Illness details', w.illness_details) : null}
                        {renderRow('pregnant-woman', 'Pregnancy status', w.pregnancy_status)}
                        {renderRow('medical-services', 'Medication', w.medication_details)}
                        {renderRow('directions-run', 'Exercise history', w.exercise_history)}
                        {renderBool('Recommended by practitioner', w.practitioner_recommended)}
                        {renderRow('flag', 'Goals', w.goals_expectations)}
                        {renderBool('Osteoporosis / Osteopenia', w.has_bone_condition)}
                    </>
                ) : (
                    <>
                        <Text style={styles.expandedSection}>INJURY DISCLOSURE (v2)</Text>
                        {renderBool('Has injuries', w.has_injuries)}
                        {renderRow('healing', 'Details', w.injury_details)}
                        {renderRow('edit', 'Signature', w.signature_name)}
                    </>
                )}

                <Text style={styles.expandedSection}>CONSENT</Text>
                {renderBool('Terms of Use', w.agreed_terms_of_use)}
                {renderBool('Liability waiver', w.agreed_liability_waiver)}
                {renderBool('Email marketing', w.agreed_email_marketing)}
                {renderBool('SMS marketing', w.agreed_sms_marketing)}
            </View>
        );
    };

    if (!isStaff) {
        return (
            <ScreenBackground>
                <SafeAreaView style={styles.container} edges={['top']}>
                    <View style={styles.header}>
                        <TouchableOpacity
                            accessibilityRole="button"
                            accessibilityLabel="Go back" onPress={() => navigation.goBack()} style={styles.backButton}>
                            <MaterialIcons name="arrow-back" size={22} color={colors.text} />
                        </TouchableOpacity>
                        <Text style={styles.title}>Signed Waivers</Text>
                        <View style={{ width: 40 }} />
                    </View>
                    <View style={styles.centerMessage}>
                        <MaterialCommunityIcons name="lock-outline" size={48} color={colors.textSecondary} />
                        <Text style={styles.emptyTitle}>Staff only</Text>
                        <Text style={styles.emptyText}>Only owners and masters can view signed waivers.</Text>
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
                        <Text style={styles.title}>Signed Waivers</Text>
                        <Text style={styles.subtitle}>Pilates health screening & liability</Text>
                    </View>
                </View>

                <ScrollView contentContainerStyle={styles.content}>
                    {loading ? (
                        <View style={styles.loadingBox}>
                            <ActivityIndicator size="large" color={colors.text} />
                        </View>
                    ) : waivers.length === 0 ? (
                        <Card style={styles.emptyCard}>
                            <MaterialCommunityIcons name="file-document-outline" size={36} color={EMERALD} />
                            <Text style={styles.emptyTitle}>No waivers yet</Text>
                            <Text style={styles.emptyText}>
                                Signed health screenings will appear here once clients complete them.
                            </Text>
                        </Card>
                    ) : (
                        waivers.map((w) => {
                            const expanded = expandedId === w.id;
                            const name = w.profile?.full_name || w.profile?.email || 'Unknown client';
                            return (
                                <TouchableOpacity
                                    key={w.id}
                                    style={styles.waiverRow}
                                    activeOpacity={0.8}
                                    onPress={() => setExpandedId(expanded ? null : w.id)}
                                >
                                    <View style={styles.waiverHeaderRow}>
                                        <View style={styles.waiverIcon}>
                                            <MaterialCommunityIcons name="shield-check" size={20} color={EMERALD} />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.waiverName} numberOfLines={1}>{name}</Text>
                                            <Text style={styles.waiverMeta}>
                                                {new Date(w.signed_at).toLocaleDateString('en-IE', {
                                                    day: 'numeric', month: 'short', year: 'numeric',
                                                })}
                                                {` · v${w.terms_version || '?'}`}
                                            </Text>
                                        </View>
                                        <MaterialIcons
                                            name={expanded ? 'expand-less' : 'expand-more'}
                                            size={22}
                                            color={colors.textSecondary}
                                        />
                                    </View>
                                    {expanded && renderExpanded(w)}
                                </TouchableOpacity>
                            );
                        })
                    )}
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
    content: { padding: spacing.lg, paddingTop: 0, paddingBottom: 40 },
    loadingBox: { padding: spacing.xl, alignItems: 'center' },
    emptyCard: { padding: spacing.xl, alignItems: 'center' },
    emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginTop: spacing.sm },
    emptyText: {
        fontSize: 14,
        color: colors.textSecondary,
        textAlign: 'center',
        marginTop: spacing.xs,
        lineHeight: 20,
    },
    centerMessage: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
    waiverRow: {
        borderRadius: 16,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.08)',
        padding: spacing.md,
        marginBottom: spacing.sm,
    },
    waiverHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    waiverIcon: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: EMERALD_BG,
        alignItems: 'center',
        justifyContent: 'center',
    },
    waiverName: { fontWeight: '700', color: colors.text, fontSize: 15 },
    waiverMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
    expandedBody: {
        marginTop: spacing.md,
        paddingTop: spacing.md,
        borderTopWidth: 1,
        borderTopColor: 'rgba(0,0,0,0.06)',
    },
    expandedSection: {
        fontSize: 11,
        fontWeight: '700',
        color: colors.textSecondary,
        letterSpacing: 1,
        marginTop: spacing.sm,
        marginBottom: 6,
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 6,
        marginBottom: 4,
    },
    detailText: { flex: 1, fontSize: 13, color: colors.text, lineHeight: 18 },
    detailLabel: { fontWeight: '600', color: colors.textSecondary },
});

export default PilatesWaiversScreen;
