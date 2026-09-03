import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Image,
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
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useModal } from '../../contexts/ModalContext';
import { Card, ScreenBackground } from '../../components/ui';
import { colors, spacing } from '../../theme';

interface InstructorProfile {
    id: string;
    full_name: string | null;
    email: string | null;
    phone: string | null;
    avatar_url: string | null;
    city: string | null;
    specialties: string[] | null;
    is_master: boolean | null;
    is_authorized_instructor: boolean | null;
    can_view_qr_pay: boolean | null;
    master_status: string | null;
}

const EMERALD = '#10B981';
const EMERALD_DARK = '#047857';
const EMERALD_BG = '#ECFDF5';
const PINK_DARK = '#C47A90';

export function InstructorsScreen() {
    const navigation = useNavigation<any>();
    const { role } = useAuth();
    const { showAlert } = useModal();

    const [instructors, setInstructors] = useState<InstructorProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [togglingId, setTogglingId] = useState<string | null>(null);
    const [togglingQrId, setTogglingQrId] = useState<string | null>(null);

    const isOwner = role === 'owner';

    const fetchInstructors = useCallback(async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('id, full_name, email, phone, avatar_url, city, specialties, is_master, is_authorized_instructor, can_view_qr_pay, master_status')
                .eq('is_master', true)
                .order('full_name');
            if (error) throw error;
            setInstructors((data as unknown as InstructorProfile[]) || []);
        } catch (error: any) {
            showAlert('Error', error.message || 'Failed to load instructors', 'error');
        } finally {
            setLoading(false);
        }
    }, [showAlert]);

    useFocusEffect(
        useCallback(() => {
            if (isOwner) fetchInstructors();
        }, [isOwner, fetchInstructors])
    );

    const handleToggleAuthorization = async (instructorId: string, currentAuth: boolean) => {
        setTogglingId(instructorId);
        try {
            const { error } = await (supabase as any)
                .from('profiles')
                .update({ is_authorized_instructor: !currentAuth })
                .eq('id', instructorId);
            if (error) throw error;
            setInstructors((prev) =>
                prev.map((i) => (i.id === instructorId ? { ...i, is_authorized_instructor: !currentAuth } : i))
            );
            showAlert(
                'Updated',
                !currentAuth
                    ? 'Instructor authorized — can now view client waivers'
                    : 'Instructor deauthorized — waiver access revoked',
                'success'
            );
        } catch (error: any) {
            showAlert('Error', error.message || 'Failed to update authorization', 'error');
        } finally {
            setTogglingId(null);
        }
    };

    const handleToggleQrPay = async (instructorId: string, currentQr: boolean) => {
        setTogglingQrId(instructorId);
        try {
            const { error } = await (supabase as any)
                .from('profiles')
                .update({ can_view_qr_pay: !currentQr })
                .eq('id', instructorId);
            if (error) throw error;
            setInstructors((prev) =>
                prev.map((i) => (i.id === instructorId ? { ...i, can_view_qr_pay: !currentQr } : i))
            );
            showAlert(
                'Updated',
                !currentQr ? 'Instructor can now view QR payment codes' : 'QR payment code access revoked',
                'success'
            );
        } catch (error: any) {
            showAlert('Error', error.message || 'Failed to update QR Pay access', 'error');
        } finally {
            setTogglingQrId(null);
        }
    };

    if (!isOwner) {
        return (
            <ScreenBackground>
                <SafeAreaView style={styles.container} edges={['top']}>
                    <View style={styles.centerMessage}>
                        <MaterialCommunityIcons name="lock-outline" size={48} color={colors.textSecondary} />
                        <Text style={styles.emptyTitle}>Owner Access Required</Text>
                        <Text style={styles.emptyText}>
                            Only the Studio Owner can manage instructor authorizations.
                        </Text>
                    </View>
                </SafeAreaView>
            </ScreenBackground>
        );
    }

    const filteredInstructors = instructors.filter(
        (i) =>
            !search ||
            i.full_name?.toLowerCase().includes(search.toLowerCase()) ||
            i.email?.toLowerCase().includes(search.toLowerCase())
    );

    const authorizedCount = instructors.filter((i) => i.is_authorized_instructor === true).length;
    const qrPayCount = instructors.filter((i) => i.can_view_qr_pay === true).length;

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
                        <Text style={styles.title}>Instructors</Text>
                        <Text style={styles.subtitle}>Authorize instructors to view signed client waivers</Text>
                    </View>
                    <TouchableOpacity
                        style={styles.inviteButton}
                        onPress={() => navigation.navigate('MasterInvite')}
                    >
                        <MaterialIcons name="person-add" size={16} color="#FFF" />
                        <Text style={styles.inviteButtonText}>Invite</Text>
                    </TouchableOpacity>
                </View>

                <ScrollView contentContainerStyle={styles.content}>
                    <View style={styles.statsRow}>
                        <Card style={styles.statCard}>
                            <Text style={styles.statLabel}>TOTAL MASTERS</Text>
                            <Text style={styles.statValue}>{instructors.length}</Text>
                        </Card>
                        <Card style={styles.statCard}>
                            <Text style={styles.statLabel}>WAIVER ACCESS</Text>
                            <Text style={[styles.statValue, { color: EMERALD }]}>{authorizedCount}</Text>
                            <Text style={styles.statHint}>Can view client waivers</Text>
                        </Card>
                        <Card style={styles.statCard}>
                            <Text style={styles.statLabel}>QR PAY ACCESS</Text>
                            <Text style={[styles.statValue, { color: PINK_DARK }]}>{qrPayCount}</Text>
                            <Text style={styles.statHint}>Can present payment QRs</Text>
                        </Card>
                    </View>

                    <View style={styles.infoBanner}>
                        <MaterialIcons name="info-outline" size={16} color={EMERALD} />
                        <Text style={styles.infoBannerText}>
                            Toggle Authorize to grant waiver access, and QR Pay to let an instructor present the studio's payment QR codes to clients in-person. Only the Owner can change these settings.
                        </Text>
                    </View>

                    <View style={styles.searchBox}>
                        <MaterialIcons name="search" size={18} color={colors.textMuted} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search by name or email..."
                            placeholderTextColor={colors.textMuted}
                            value={search}
                            onChangeText={setSearch}
                        />
                    </View>

                    {loading ? (
                        <View style={styles.loadingBox}>
                            <ActivityIndicator size="large" color={EMERALD} />
                        </View>
                    ) : filteredInstructors.length === 0 ? (
                        <Card style={styles.emptyCard}>
                            <MaterialCommunityIcons name="account-group-outline" size={36} color={colors.textMuted} />
                            <Text style={styles.emptyTitle}>No instructors found</Text>
                            <Text style={styles.emptyText}>Invite a master account to get started</Text>
                        </Card>
                    ) : (
                        filteredInstructors.map((instructor) => {
                            const isAuthorized = instructor.is_authorized_instructor === true;
                            const isQrPay = instructor.can_view_qr_pay === true;
                            const isToggling = togglingId === instructor.id;
                            const isTogglingQr = togglingQrId === instructor.id;
                            return (
                                <Card key={instructor.id} style={styles.instructorCard}>
                                    <View style={styles.instructorRow}>
                                        <View style={styles.avatar}>
                                            {instructor.avatar_url ? (
                                                <Image source={{ uri: instructor.avatar_url }} style={styles.avatarImage} />
                                            ) : (
                                                <Text style={styles.avatarInitial}>
                                                    {instructor.full_name?.charAt(0) || '?'}
                                                </Text>
                                            )}
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <View style={styles.nameRow}>
                                                <Text style={styles.instructorName} numberOfLines={1}>
                                                    {instructor.full_name || 'Unnamed'}
                                                </Text>
                                            </View>
                                            <View style={styles.chipsRow}>
                                                {isAuthorized ? (
                                                    <View style={[styles.chip, styles.chipAuthorized]}>
                                                        <Text style={[styles.chipText, styles.chipAuthorizedText]}>Authorized</Text>
                                                    </View>
                                                ) : (
                                                    <View style={[styles.chip, styles.chipIdle]}>
                                                        <Text style={[styles.chipText, styles.chipIdleText]}>Not Authorized</Text>
                                                    </View>
                                                )}
                                                {isQrPay && (
                                                    <View style={[styles.chip, styles.chipQr]}>
                                                        <Text style={[styles.chipText, styles.chipQrText]}>QR Pay</Text>
                                                    </View>
                                                )}
                                            </View>
                                            {!!instructor.email && (
                                                <Text style={styles.instructorMeta} numberOfLines={1}>
                                                    {instructor.email}{instructor.city ? ` · ${instructor.city}` : ''}
                                                </Text>
                                            )}
                                        </View>
                                    </View>

                                    <View style={styles.togglesRow}>
                                        {isToggling ? (
                                            <ActivityIndicator size="small" color={EMERALD} style={{ flex: 1 }} />
                                        ) : (
                                            <TouchableOpacity
                                                style={[styles.toggleButton, isAuthorized ? styles.toggleAuthorized : styles.toggleIdle]}
                                                onPress={() => handleToggleAuthorization(instructor.id, isAuthorized)}
                                            >
                                                <MaterialCommunityIcons
                                                    name={isAuthorized ? 'shield-check-outline' : 'shield-off-outline'}
                                                    size={14}
                                                    color={isAuthorized ? '#FFF' : '#4B5563'}
                                                />
                                                <Text style={[styles.toggleButtonText, isAuthorized ? { color: '#FFF' } : { color: '#4B5563' }]}>
                                                    {isAuthorized ? 'Authorized' : 'Authorize'}
                                                </Text>
                                            </TouchableOpacity>
                                        )}
                                        {isTogglingQr ? (
                                            <ActivityIndicator size="small" color={PINK_DARK} style={{ flex: 1 }} />
                                        ) : (
                                            <TouchableOpacity
                                                style={[styles.toggleButton, isQrPay ? styles.toggleQrActive : styles.toggleIdle]}
                                                onPress={() => handleToggleQrPay(instructor.id, isQrPay)}
                                            >
                                                <MaterialIcons
                                                    name="smartphone"
                                                    size={14}
                                                    color={isQrPay ? '#FFF' : '#4B5563'}
                                                />
                                                <Text style={[styles.toggleButtonText, isQrPay ? { color: '#FFF' } : { color: '#4B5563' }]}>
                                                    {isQrPay ? 'QR Pay On' : 'QR Pay'}
                                                </Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                </Card>
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
    inviteButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: EMERALD,
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 9,
    },
    inviteButtonText: { color: '#FFF', fontWeight: '700', fontSize: 13 },
    content: { padding: spacing.lg, paddingTop: 0, paddingBottom: 40 },
    statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
    statCard: { flex: 1, padding: spacing.md },
    statLabel: { fontSize: 9, fontWeight: '700', color: colors.textMuted, letterSpacing: 1 },
    statValue: { fontSize: 24, fontWeight: '800', color: colors.text, marginTop: 4 },
    statHint: { fontSize: 10, color: colors.textMuted, marginTop: 2 },
    infoBanner: {
        flexDirection: 'row',
        gap: spacing.sm,
        alignItems: 'flex-start',
        backgroundColor: EMERALD_BG,
        borderLeftWidth: 3,
        borderLeftColor: EMERALD,
        borderRadius: 12,
        padding: spacing.md,
        marginBottom: spacing.md,
    },
    infoBannerText: { flex: 1, fontSize: 12, color: '#065F46', lineHeight: 17 },
    searchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.08)',
        backgroundColor: colors.inputBackground,
        borderRadius: 14,
        paddingHorizontal: 12,
        marginBottom: spacing.md,
    },
    searchInput: { flex: 1, paddingVertical: 10, fontSize: 14, color: colors.text },
    loadingBox: { padding: spacing.xl, alignItems: 'center' },
    emptyCard: { padding: spacing.xl, alignItems: 'center' },
    emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginTop: spacing.sm },
    emptyText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xs },
    centerMessage: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
    instructorCard: { padding: spacing.md, marginBottom: spacing.sm },
    instructorRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
    avatar: {
        width: 44,
        height: 44,
        borderRadius: 999,
        backgroundColor: EMERALD,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    avatarImage: { width: 44, height: 44 },
    avatarInitial: { color: '#FFF', fontWeight: '700', fontSize: 17 },
    nameRow: { flexDirection: 'row', alignItems: 'center' },
    instructorName: { fontSize: 15, fontWeight: '700', color: colors.text },
    chipsRow: { flexDirection: 'row', gap: 6, marginTop: 3 },
    chip: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999 },
    chipAuthorized: { backgroundColor: EMERALD_BG },
    chipIdle: { backgroundColor: '#F3F4F6' },
    chipQr: { backgroundColor: '#FDF2F8' },
    chipText: { fontSize: 9, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
    chipAuthorizedText: { color: EMERALD_DARK },
    chipIdleText: { color: '#6B7280' },
    chipQrText: { color: PINK_DARK },
    instructorMeta: { fontSize: 12, color: colors.textMuted, marginTop: 3 },
    togglesRow: {
        flexDirection: 'row',
        gap: spacing.sm,
        marginTop: spacing.sm,
        paddingTop: spacing.sm,
        borderTopWidth: 1,
        borderTopColor: 'rgba(0,0,0,0.06)',
    },
    toggleButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        borderRadius: 10,
        paddingVertical: 8,
    },
    toggleAuthorized: { backgroundColor: EMERALD },
    toggleQrActive: { backgroundColor: PINK_DARK },
    toggleIdle: { backgroundColor: '#F3F4F6' },
    toggleButtonText: { fontSize: 12, fontWeight: '700' },
});

export default InstructorsScreen;
