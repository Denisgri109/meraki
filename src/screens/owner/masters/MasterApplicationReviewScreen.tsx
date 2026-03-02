/**
 * MasterApplicationReviewScreen — Owner reviews a master application.
 * 
 * Based on the design mockup in stitch_merak_premium_login/master_application_review/
 * 
 * Features:
 *   - Profile overview with avatar, name, specialty, application date
 *   - Tab navigation: Profile | Portfolio | Documents
 *   - Approve / Reject actions with confirmation
 *   - Chat shortcut to contact applicant
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
    Dimensions,
    Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ScreenBackground, Card, MerakiText, Button, Input } from '../../../components/ui';
import { MerakiModal } from '../../../components/ui';
import { colors, spacing, layout } from '../../../theme';
import {
    approveApplication,
    rejectApplication,
    type MasterApplication,
} from '../../../services/masterManagementService';
import { useAuth } from '../../../contexts/AuthContext';

const { width } = Dimensions.get('window');

type ReviewTab = 'profile' | 'portfolio' | 'documents';

type ParamList = {
    MasterApplicationReview: { application: MasterApplication };
};

export function MasterApplicationReviewScreen() {
    const navigation = useNavigation<any>();
    const route = useRoute<RouteProp<ParamList, 'MasterApplicationReview'>>();
    const { user } = useAuth();
    const { application } = route.params;

    const [activeTab, setActiveTab] = useState<ReviewTab>('profile');
    const [processing, setProcessing] = useState(false);
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [rejectionReason, setRejectionReason] = useState('');

    const handleApprove = () => {
        Alert.alert(
            'Approve Master',
            `Are you sure you want to approve ${application.full_name} as a beauty master? Their account will be upgraded immediately.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Approve',
                    style: 'default',
                    onPress: async () => {
                        if (!user) return;
                        setProcessing(true);
                        const { success, error } = await approveApplication(application.id, user.id);
                        setProcessing(false);
                        if (success) {
                            Alert.alert('Approved!', `${application.full_name} is now an active master on Merakí.`, [
                                { text: 'OK', onPress: () => navigation.goBack() }
                            ]);
                        } else {
                            Alert.alert('Error', error?.message || 'Failed to approve application');
                        }
                    },
                },
            ]
        );
    };

    const handleReject = async () => {
        if (!user || !rejectionReason.trim()) {
            Alert.alert('Required', 'Please provide a reason for rejection.');
            return;
        }
        setProcessing(true);
        const { success, error } = await rejectApplication(application.id, user.id, rejectionReason.trim());
        setProcessing(false);
        setShowRejectModal(false);
        if (success) {
            Alert.alert('Rejected', 'The application has been rejected.', [
                { text: 'OK', onPress: () => navigation.goBack() }
            ]);
        } else {
            Alert.alert('Error', error?.message || 'Failed to reject application');
        }
    };

    const getTimeAgo = (dateString: string | null): string => {
        if (!dateString) return 'Recently';
        const diff = Date.now() - new Date(dateString).getTime();
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        if (days === 0) return 'Applied today';
        if (days === 1) return 'Applied 1 day ago';
        return `Applied ${days} days ago`;
    };

    const tabs: { key: ReviewTab; label: string }[] = [
        { key: 'profile', label: 'Profile' },
        { key: 'portfolio', label: 'Portfolio' },
        { key: 'documents', label: 'Documents' },
    ];

    return (
        <ScreenBackground>
            <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <MaterialIcons name="arrow-back" size={22} color={colors.text} />
                    </TouchableOpacity>
                    <MerakiText variant="bodyBold" style={styles.headerTitle} numberOfLines={1}>
                        Application: {application.full_name}
                    </MerakiText>
                </View>

                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                    {/* Profile Hero */}
                    <View style={styles.profileHero}>
                        <LinearGradient
                            colors={['rgba(238,43,91,0.15)', 'rgba(238,43,91,0.03)']}
                            style={styles.avatarLarge}
                        >
                            <MerakiText style={styles.avatarLargeText}>
                                {(application.full_name || 'A').charAt(0).toUpperCase()}
                            </MerakiText>
                        </LinearGradient>
                        <MerakiText variant="h2" style={styles.applicantName}>{application.full_name}</MerakiText>
                        <MerakiText variant="body" color={colors.textSecondary}>
                            {application.specialties?.join(', ') || 'Beauty Professional'}
                        </MerakiText>
                        <View style={styles.timeBadge}>
                            <MaterialIcons name="schedule" size={14} color="#EE2B5B" />
                            <MerakiText variant="caption" color="#EE2B5B">{getTimeAgo(application.created_at)}</MerakiText>
                        </View>
                    </View>

                    {/* Tab Navigation */}
                    <View style={styles.tabBar}>
                        {tabs.map(tab => (
                            <TouchableOpacity
                                key={tab.key}
                                style={[styles.tab, activeTab === tab.key && styles.tabActive]}
                                onPress={() => setActiveTab(tab.key)}
                            >
                                <MerakiText
                                    variant="label"
                                    color={activeTab === tab.key ? colors.accent : colors.textMuted}
                                >
                                    {tab.label}
                                </MerakiText>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Tab Content */}
                    {activeTab === 'profile' && (
                        <View style={styles.tabContent}>
                            {/* Bio */}
                            {application.bio && (
                                <Card variant="glass" style={styles.section}>
                                    <MerakiText variant="label" color={colors.textMuted} style={styles.sectionTitle}>
                                        PROFESSIONAL BIO
                                    </MerakiText>
                                    <MerakiText variant="body" color={colors.textSecondary}>
                                        {application.bio}
                                    </MerakiText>
                                </Card>
                            )}

                            {/* Contact */}
                            <Card variant="glass" style={styles.section}>
                                <MerakiText variant="label" color={colors.textMuted} style={styles.sectionTitle}>
                                    CONTACT INFORMATION
                                </MerakiText>
                                <View style={styles.detailRow}>
                                    <MaterialIcons name="email" size={18} color={colors.textMuted} />
                                    <MerakiText variant="body" color={colors.textSecondary}>{application.email}</MerakiText>
                                </View>
                                {application.phone && (
                                    <View style={styles.detailRow}>
                                        <MaterialIcons name="phone" size={18} color={colors.textMuted} />
                                        <MerakiText variant="body" color={colors.textSecondary}>{application.phone}</MerakiText>
                                    </View>
                                )}
                            </Card>

                            {/* Location */}
                            {application.city && (
                                <Card variant="glass" style={styles.section}>
                                    <MerakiText variant="label" color={colors.textMuted} style={styles.sectionTitle}>
                                        LOCATION
                                    </MerakiText>
                                    <View style={styles.locationCard}>
                                        <MaterialIcons name="location-on" size={24} color={colors.accent} />
                                        <View style={{ flex: 1 }}>
                                            <MerakiText variant="bodyBold">{application.city}</MerakiText>
                                            <MerakiText variant="caption" color={colors.textSecondary}>
                                                {application.country_code} · {application.timezone}
                                            </MerakiText>
                                        </View>
                                    </View>
                                </Card>
                            )}

                            {/* Specialties */}
                            {application.specialties && application.specialties.length > 0 && (
                                <Card variant="glass" style={styles.section}>
                                    <MerakiText variant="label" color={colors.textMuted} style={styles.sectionTitle}>
                                        OFFERED SERVICES
                                    </MerakiText>
                                    <View style={styles.tagsContainer}>
                                        {application.specialties.map((s, i) => (
                                            <View key={i} style={styles.tag}>
                                                <MerakiText variant="caption" color={colors.text}>{s}</MerakiText>
                                            </View>
                                        ))}
                                    </View>
                                </Card>
                            )}

                            {/* Experience */}
                            {application.years_of_experience != null && (
                                <Card variant="glass" style={styles.section}>
                                    <MerakiText variant="label" color={colors.textMuted} style={styles.sectionTitle}>
                                        EXPERIENCE
                                    </MerakiText>
                                    <MerakiText variant="h2" color={colors.accent}>
                                        {application.years_of_experience} {application.years_of_experience === 1 ? 'Year' : 'Years'}
                                    </MerakiText>
                                </Card>
                            )}

                            {/* Notes from applicant */}
                            {application.notes && (
                                <Card variant="glass" style={styles.section}>
                                    <MerakiText variant="label" color={colors.textMuted} style={styles.sectionTitle}>
                                        APPLICANT NOTES
                                    </MerakiText>
                                    <MerakiText variant="body" color={colors.textSecondary}>
                                        {application.notes}
                                    </MerakiText>
                                </Card>
                            )}
                        </View>
                    )}

                    {activeTab === 'portfolio' && (
                        <View style={styles.tabContent}>
                            {application.portfolio_urls && application.portfolio_urls.length > 0 ? (
                                <View style={styles.portfolioGrid}>
                                    {application.portfolio_urls.map((url, i) => (
                                        <TouchableOpacity
                                            key={i}
                                            style={styles.portfolioItem}
                                            onPress={() => Linking.openURL(url).catch(() => {})}
                                        >
                                            <Image source={{ uri: url }} style={styles.portfolioImage} />
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            ) : (
                                <View style={styles.emptyTab}>
                                    <MaterialCommunityIcons name="image-multiple" size={48} color={colors.textMuted} style={{ opacity: 0.3 }} />
                                    <MerakiText variant="body" color={colors.textMuted} style={{ marginTop: spacing.md }}>
                                        No portfolio images submitted
                                    </MerakiText>
                                </View>
                            )}
                        </View>
                    )}

                    {activeTab === 'documents' && (
                        <View style={styles.tabContent}>
                            {application.certifications && application.certifications.length > 0 ? (
                                <View style={styles.documentsList}>
                                    {application.certifications.map((cert, i) => (
                                        <Card key={i} variant="glass" style={styles.documentCard}>
                                            <View style={styles.documentRow}>
                                                <View style={styles.docIcon}>
                                                    <MaterialCommunityIcons name="file-certificate" size={24} color={colors.accent} />
                                                </View>
                                                <View style={{ flex: 1 }}>
                                                    <MerakiText variant="bodyBold" numberOfLines={1}>{cert}</MerakiText>
                                                    <MerakiText variant="caption" color={colors.textMuted}>Certification</MerakiText>
                                                </View>
                                            </View>
                                        </Card>
                                    ))}
                                </View>
                            ) : (
                                <View style={styles.emptyTab}>
                                    <MaterialCommunityIcons name="file-document-outline" size={48} color={colors.textMuted} style={{ opacity: 0.3 }} />
                                    <MerakiText variant="body" color={colors.textMuted} style={{ marginTop: spacing.md }}>
                                        No documents submitted
                                    </MerakiText>
                                </View>
                            )}
                        </View>
                    )}
                </ScrollView>

                {/* Bottom Action Bar */}
                <View style={styles.bottomBar}>
                    <LinearGradient
                        colors={['rgba(15,15,19,0)', 'rgba(15,15,19,0.95)', 'rgba(15,15,19,1)']}
                        style={styles.bottomGradient}
                    >
                        <View style={styles.bottomActions}>
                            <TouchableOpacity
                                style={styles.rejectBtn}
                                onPress={() => setShowRejectModal(true)}
                                disabled={processing}
                            >
                                <MerakiText variant="bodyBold" color={colors.error}>Reject</MerakiText>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.approveBtn}
                                onPress={handleApprove}
                                disabled={processing}
                            >
                                <LinearGradient
                                    colors={['#D4A853', '#B8912E']}
                                    style={styles.approveBtnGradient}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                >
                                    {processing ? (
                                        <ActivityIndicator color="#FFF" size="small" />
                                    ) : (
                                        <>
                                            <MaterialIcons name="verified" size={18} color="#FFF" />
                                            <MerakiText variant="bodyBold" color="#FFF" style={{ marginLeft: 8 }}>
                                                Approve Master
                                            </MerakiText>
                                        </>
                                    )}
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    </LinearGradient>
                </View>

                {/* Rejection Modal */}
                <MerakiModal
                    visible={showRejectModal}
                    onClose={() => setShowRejectModal(false)}
                    title="Reject Application"
                >
                    <View style={styles.modalContent}>
                        <MerakiText variant="body" color={colors.textSecondary} style={{ marginBottom: spacing.md }}>
                            Please provide a reason for rejecting {application.full_name}'s application:
                        </MerakiText>
                        <Input
                            placeholder="Reason for rejection..."
                            value={rejectionReason}
                            onChangeText={setRejectionReason}
                            multiline
                            numberOfLines={4}
                            style={{ minHeight: 100 }}
                        />
                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={styles.modalCancelBtn}
                                onPress={() => setShowRejectModal(false)}
                            >
                                <MerakiText variant="bodyBold" color={colors.textSecondary}>Cancel</MerakiText>
                            </TouchableOpacity>
                            <Button
                                title={processing ? 'Rejecting...' : 'Confirm Rejection'}
                                onPress={handleReject}
                                variant="primary"
                                disabled={processing || !rejectionReason.trim()}
                            />
                        </View>
                    </View>
                </MerakiModal>
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
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
        alignItems: 'center', justifyContent: 'center',
    },
    headerTitle: { flex: 1, marginLeft: spacing.md },
    scrollContent: { paddingBottom: 140 },

    // Profile Hero
    profileHero: { alignItems: 'center', paddingHorizontal: spacing.lg, marginBottom: spacing.xl },
    avatarLarge: {
        width: 100, height: 100, borderRadius: 50,
        alignItems: 'center', justifyContent: 'center',
        marginBottom: spacing.md,
    },
    avatarLargeText: { fontSize: 40, fontWeight: '700' as any, color: '#fff' },
    applicantName: { marginBottom: 4 },
    timeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: spacing.sm,
        backgroundColor: 'rgba(238,43,91,0.08)',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
    },

    // Tabs
    tabBar: {
        flexDirection: 'row',
        paddingHorizontal: spacing.lg,
        marginBottom: spacing.lg,
        gap: spacing.sm,
    },
    tab: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: spacing.sm + 2,
        borderRadius: layout.borderRadius.md,
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
    },
    tabActive: {
        backgroundColor: 'rgba(212,168,83,0.08)',
        borderColor: 'rgba(212,168,83,0.20)',
    },
    tabContent: { paddingHorizontal: spacing.lg },

    // Sections
    section: { padding: spacing.lg, marginBottom: spacing.md },
    sectionTitle: { marginBottom: spacing.sm, fontSize: 11, letterSpacing: 1 },
    detailRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
    locationCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    tagsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    tag: {
        backgroundColor: 'rgba(212,168,83,0.10)',
        borderWidth: 1,
        borderColor: 'rgba(212,168,83,0.20)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
    },

    // Portfolio
    portfolioGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
    },
    portfolioItem: {
        width: (width - spacing.lg * 2 - spacing.sm) / 2,
        height: (width - spacing.lg * 2 - spacing.sm) / 2,
        borderRadius: layout.borderRadius.lg,
        overflow: 'hidden',
    },
    portfolioImage: { width: '100%', height: '100%' },

    // Documents
    documentsList: { gap: spacing.sm },
    documentCard: { padding: spacing.md },
    documentRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    docIcon: {
        width: 44, height: 44, borderRadius: 12,
        backgroundColor: 'rgba(212,168,83,0.12)',
        alignItems: 'center', justifyContent: 'center',
    },

    // Empty
    emptyTab: { alignItems: 'center', paddingVertical: spacing.xxxl },

    // Bottom Bar
    bottomBar: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
    },
    bottomGradient: {
        paddingTop: 40,
        paddingBottom: 32,
        paddingHorizontal: spacing.lg,
    },
    bottomActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    rejectBtn: {
        paddingHorizontal: spacing.lg,
        paddingVertical: 14,
        borderRadius: layout.borderRadius.lg,
        borderWidth: 1,
        borderColor: 'rgba(248,81,73,0.20)',
        backgroundColor: 'rgba(248,81,73,0.06)',
    },
    approveBtn: { flex: 1, borderRadius: layout.borderRadius.lg, overflow: 'hidden' },
    approveBtnGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        paddingHorizontal: spacing.lg,
    },

    // Modal
    modalContent: { paddingTop: spacing.md },
    modalActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: spacing.md,
        marginTop: spacing.lg,
    },
    modalCancelBtn: {
        paddingHorizontal: spacing.lg,
        paddingVertical: 12,
        borderRadius: layout.borderRadius.md,
    },
});

export default MasterApplicationReviewScreen;
