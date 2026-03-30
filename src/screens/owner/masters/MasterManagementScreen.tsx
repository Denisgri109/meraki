/**
 * MasterManagementScreen — Owner's hub for managing all beauty masters.
 * 
 * Top-tab layout:
 *   Active Masters | Applications | Invited
 * 
 * Follows the existing Merakí dark luxe design system.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    RefreshControl,
    ActivityIndicator,
    Image,
    Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ScreenBackground, Card, MerakiText } from '../../../components/ui';
import { colors, spacing, layout } from '../../../theme';
import {
    fetchActiveMasters,
    fetchPendingMasters,
    fetchMasterCounts,
    type MasterProfile,
    type PendingMaster,
} from '../../../services/masterManagementService';

const { width } = Dimensions.get('window');

type Tab = 'active' | 'invited';

export function MasterManagementScreen() {
    const navigation = useNavigation<any>();
    const [activeTab, setActiveTab] = useState<Tab>('active');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const [masters, setMasters] = useState<MasterProfile[]>([]);
    const [invited, setInvited] = useState<PendingMaster[]>([]);
    const [counts, setCounts] = useState({ activeMasters: 0, pendingInvitations: 0 });

    const loadData = useCallback(async () => {
        try {
            const [mastersRes, invitedRes, countsRes] = await Promise.all([
                fetchActiveMasters(),
                fetchPendingMasters(),
                fetchMasterCounts(),
            ]);
            setMasters(mastersRes.data || []);
            setInvited(invitedRes.data || []);
            setCounts(countsRes);
        } catch (e) {
            console.error('MasterManagement load error:', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

    const handleRefresh = () => { setRefreshing(true); loadData(); };

    const tabs: { key: Tab; label: string; count: number }[] = [
        { key: 'active', label: 'Active', count: counts.activeMasters },
        { key: 'invited', label: 'Invited', count: counts.pendingInvitations },
    ];

    // ─── Renderers ───────────────────────────────────────────────────────────

    const renderMasterCard = ({ item }: { item: MasterProfile }) => (
        <TouchableOpacity
            onPress={() => navigation.navigate('MasterDetail', { master: item })}
            activeOpacity={0.7}
        >
            <Card variant="glass" style={styles.card} noPadding>
                <View style={styles.cardContent}>
                    <View style={styles.avatarContainer}>
                        {item.avatar_url ? (
                            <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
                        ) : (
                            <LinearGradient
                                colors={['rgba(212,168,83,0.25)', 'rgba(212,168,83,0.08)']}
                                style={styles.avatar}
                            >
                                <MerakiText style={styles.avatarInitial}>
                                    {(item.full_name || 'M').charAt(0).toUpperCase()}
                                </MerakiText>
                            </LinearGradient>
                        )}
                        <View style={[
                            styles.statusDot,
                            { backgroundColor: item.master_status === 'active' ? colors.success : colors.warning }
                        ]} />
                    </View>
                    <View style={styles.cardInfo}>
                        <MerakiText variant="bodyBold" numberOfLines={1}>{item.full_name || 'Unknown'}</MerakiText>
                        <MerakiText variant="caption" color={colors.textSecondary} numberOfLines={1}>
                            {item.specialties?.join(', ') || 'Beauty Professional'}
                        </MerakiText>
                        <View style={styles.metaRow}>
                            {item.city && (
                                <View style={styles.metaChip}>
                                    <MaterialIcons name="location-on" size={12} color={colors.textMuted} />
                                    <MerakiText variant="caption" color={colors.textMuted}>{item.city}</MerakiText>
                                </View>
                            )}
                            {item.is_verified && (
                                <View style={styles.metaChip}>
                                    <MaterialIcons name="verified" size={12} color={colors.accent} />
                                    <MerakiText variant="caption" color={colors.accent}>Verified</MerakiText>
                                </View>
                            )}
                        </View>
                    </View>
                    <MaterialIcons name="chevron-right" size={22} color={colors.textMuted} />
                </View>
            </Card>
        </TouchableOpacity>
    );

    const renderInvitedCard = ({ item }: { item: PendingMaster }) => (
        <Card variant="glass" style={styles.card} noPadding>
            <View style={styles.cardContent}>
                <LinearGradient
                    colors={['rgba(88,166,255,0.20)', 'rgba(88,166,255,0.05)']}
                    style={styles.avatar}
                >
                    <MaterialCommunityIcons name="email-send" size={22} color="#58A6FF" />
                </LinearGradient>
                <View style={styles.cardInfo}>
                    <MerakiText variant="bodyBold" numberOfLines={1}>{item.full_name}</MerakiText>
                    <MerakiText variant="caption" color={colors.textSecondary} numberOfLines={1}>{item.email}</MerakiText>
                    <View style={styles.metaRow}>
                        <View style={[styles.statusBadge, { backgroundColor: 'rgba(88,166,255,0.12)' }]}>
                            <MerakiText variant="caption" color="#58A6FF">
                                {item.master_status === 'invited' ? 'Pending Signup' : item.master_status}
                            </MerakiText>
                        </View>
                    </View>
                </View>
            </View>
        </Card>
    );

    const renderEmptyState = (message: string, icon: string) => (
        <View style={styles.emptyState}>
            <MaterialCommunityIcons name={icon as any} size={56} color={colors.textMuted} style={{ opacity: 0.3 }} />
            <MerakiText variant="body" color={colors.textMuted} style={{ marginTop: spacing.md, textAlign: 'center' }}>
                {message}
            </MerakiText>
        </View>
    );

    const getListData = () => {
        switch (activeTab) {
            case 'active': return masters;
            case 'invited': return invited;
        }
    };

    const getRenderer = () => {
        switch (activeTab) {
            case 'active': return renderMasterCard as any;
            case 'invited': return renderInvitedCard as any;
        }
    };

    const getEmptyMessage = () => {
        switch (activeTab) {
            case 'active': return 'No active masters yet';
            case 'invited': return 'No pending invitations';
        }
    };

    if (loading) return (
        <ScreenBackground>
            <SafeAreaView style={styles.container}>
                <ActivityIndicator size="large" color={colors.accent} style={{ flex: 1 }} />
            </SafeAreaView>
        </ScreenBackground>
    );

    return (
        <ScreenBackground>
            <SafeAreaView style={styles.container} edges={['top']}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <MaterialIcons name="arrow-back" size={22} color={colors.text} />
                    </TouchableOpacity>
                    <MerakiText variant="h3" style={styles.headerTitle}>Master Management</MerakiText>
                    <TouchableOpacity
                        style={styles.addBtn}
                        onPress={() => navigation.navigate('MasterInvite')}
                    >
                        <MaterialIcons name="person-add" size={20} color={colors.accent} />
                    </TouchableOpacity>
                </View>

                {/* Summary Stats */}
                <View style={styles.statsRow}>
                    <LinearGradient colors={['rgba(63,185,80,0.10)', 'rgba(63,185,80,0.02)']} style={styles.statCard}>
                        <MerakiText style={styles.statValue}>{counts.activeMasters}</MerakiText>
                        <MerakiText variant="caption" color={colors.textMuted}>Active</MerakiText>
                    </LinearGradient>
                    <LinearGradient colors={['rgba(88,166,255,0.10)', 'rgba(88,166,255,0.02)']} style={styles.statCard}>
                        <MerakiText style={styles.statValue}>{counts.pendingInvitations}</MerakiText>
                        <MerakiText variant="caption" color={colors.textMuted}>Invited</MerakiText>
                    </LinearGradient>
                </View>

                {/* Tabs */}
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
                            {tab.count > 0 && (
                                <View style={[
                                    styles.tabBadge,
                                    activeTab === tab.key && styles.tabBadgeActive
                                ]}>
                                    <MerakiText style={styles.tabBadgeText}>{tab.count}</MerakiText>
                                </View>
                            )}
                        </TouchableOpacity>
                    ))}
                </View>

                {/* List */}
                <FlatList
                    data={getListData() as any[]}
                    keyExtractor={(item: any) => item.id}
                    renderItem={getRenderer()}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.accent} />
                    }
                    ListEmptyComponent={renderEmptyState(getEmptyMessage(), 'account-group')}
                    showsVerticalScrollIndicator={false}
                />
            </SafeAreaView>
        </ScreenBackground>
    );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getTimeAgo(dateString: string | null): string {
    if (!dateString) return 'Recently';
    const diff = Date.now() - new Date(dateString).getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Today';
    if (days === 1) return '1 day ago';
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    return `${Math.floor(days / 30)}mo ago`;
}

// ─── Styles ──────────────────────────────────────────────────────────────────

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
    addBtn: {
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: 'rgba(212,168,83,0.12)',
        borderWidth: 1, borderColor: 'rgba(212,168,83,0.20)',
        alignItems: 'center', justifyContent: 'center',
    },

    statsRow: {
        flexDirection: 'row',
        paddingHorizontal: spacing.lg,
        gap: spacing.sm,
        marginBottom: spacing.lg,
    },
    statCard: {
        flex: 1,
        borderRadius: layout.borderRadius.lg,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.05)',
        alignItems: 'center',
    },
    statValue: { fontSize: 24, fontWeight: '700' as any, color: '#1A1A1A', letterSpacing: -0.5 },

    tabBar: {
        flexDirection: 'row',
        paddingHorizontal: spacing.lg,
        marginBottom: spacing.md,
        gap: spacing.sm,
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.sm + 2,
        borderRadius: layout.borderRadius.md,
        backgroundColor: 'rgba(0, 0, 0, 0.02)',
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.05)',
        gap: 6,
    },
    tabActive: {
        backgroundColor: 'rgba(212,168,83,0.08)',
        borderColor: 'rgba(212,168,83,0.20)',
    },
    tabBadge: {
        backgroundColor: 'rgba(0, 0, 0, 0.08)',
        borderRadius: 10,
        minWidth: 20,
        height: 20,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 6,
    },
    tabBadgeActive: { backgroundColor: 'rgba(212,168,83,0.20)' },
    tabBadgeText: { fontSize: 11, fontWeight: '700' as any, color: '#FFFFFF' },

    listContent: { paddingHorizontal: spacing.lg, paddingBottom: 120 },

    card: { marginBottom: spacing.sm },
    cardContent: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.md,
        gap: spacing.md,
    },
    avatarContainer: { position: 'relative' },
    avatar: {
        width: 48, height: 48, borderRadius: 24,
        alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
    },
    avatarInitial: { fontSize: 20, fontWeight: '700' as any, color: '#FFFFFF' },
    statusDot: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 12,
        height: 12,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: colors.surface,
    },
    cardInfo: { flex: 1 },
    metaRow: { flexDirection: 'row', gap: 8, marginTop: 4, flexWrap: 'wrap' },
    metaChip: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 8,
    },
    reviewBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },

    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.xxxl,
    },
});

export default MasterManagementScreen;
