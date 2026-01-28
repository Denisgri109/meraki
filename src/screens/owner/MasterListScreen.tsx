import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    RefreshControl,
    ActivityIndicator,
    TouchableOpacity,
    TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { Card, ScreenBackground } from '../../components/ui';
import { colors, spacing } from '../../theme';
import { Profile } from '../../types/database';

type MasterProfile = Profile & {
    master_status?: string;
    commission_rate?: number;
    is_pending_signup?: boolean;
};

const STATUS_COLORS: Record<string, string> = {
    active: '#22C55E',
    pending: '#F59E0B',
    suspended: '#EF4444',
    inactive: '#6B7280',
};

export function MasterListScreen() {
    const navigation = useNavigation<any>();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [masters, setMasters] = useState<MasterProfile[]>([]);
    const [filteredMasters, setFilteredMasters] = useState<MasterProfile[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<string | null>(null);

    useFocusEffect(
        useCallback(() => {
            fetchMasters();
        }, [])
    );

    const fetchMasters = async () => {
        try {
            const [profilesResult, pendingResult] = await Promise.all([
                supabase
                    .from('profiles')
                    .select('*')
                    .eq('role', 'master')
                    .order('full_name'),
                (supabase as any)
                    .from('pending_masters')
                    .select('*')
                    .order('created_at', { ascending: false })
            ]);

            if (profilesResult.error) throw profilesResult.error;
            if (pendingResult.error) throw pendingResult.error;

            const realMasters = profilesResult.data || [];
            // Map pending masters to match MasterProfile structure
            const pendingMasters = (pendingResult.data || []).map((m: any) => ({
                ...m,
                role: 'master',
                master_status: 'pending', // Override status for list display
                is_pending_signup: true
            }));

            // Combine pending first, then active
            const allMasters = [...pendingMasters, ...realMasters];
            setMasters(allMasters);
            applyFilters(allMasters, searchQuery, statusFilter);
        } catch (error) {
            console.error('Error fetching masters:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const applyFilters = (data: MasterProfile[], query: string, status: string | null) => {
        let filtered = data;

        if (query) {
            const lowerQuery = query.toLowerCase();
            filtered = filtered.filter(m =>
                m.full_name?.toLowerCase().includes(lowerQuery) ||
                m.email.toLowerCase().includes(lowerQuery)
            );
        }

        if (status) {
            filtered = filtered.filter(m => m.master_status === status);
        }

        setFilteredMasters(filtered);
    };

    const handleSearch = (query: string) => {
        setSearchQuery(query);
        applyFilters(masters, query, statusFilter);
    };

    const handleStatusFilter = (status: string | null) => {
        setStatusFilter(status === statusFilter ? null : status);
        applyFilters(masters, searchQuery, status === statusFilter ? null : status);
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchMasters();
    };

    const renderMasterCard = ({ item }: { item: MasterProfile }) => (
        <TouchableOpacity onPress={() => navigation.navigate('MasterForm', { master: item })}>
            <Card style={styles.masterCard}>
                <View style={styles.avatarContainer}>
                    <Text style={styles.avatarText}>
                        {item.full_name?.[0]?.toUpperCase() || item.email[0].toUpperCase()}
                    </Text>
                </View>
                <View style={styles.masterInfo}>
                    <Text style={styles.masterName}>{item.full_name || 'No Name'}</Text>
                    <Text style={styles.masterEmail}>{item.email}</Text>
                    <View style={styles.statusRow}>
                        <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[item.master_status || 'active'] + '20' }]}>
                            <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[item.master_status || 'active'] }]} />
                            <Text style={[styles.statusText, { color: STATUS_COLORS[item.master_status || 'active'] }]}>
                                {(item.master_status || 'active').charAt(0).toUpperCase() + (item.master_status || 'active').slice(1)}
                            </Text>
                        </View>
                        {item.commission_rate !== undefined && (
                            <Text style={styles.commission}>{(item.commission_rate * 100).toFixed(0)}% commission</Text>
                        )}
                    </View>
                </View>
                <Text style={styles.arrow}>→</Text>
            </Card>
        </TouchableOpacity>
    );

    if (loading) {
        return (
            <ScreenBackground>
                <SafeAreaView style={styles.container}>
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={colors.text} />
                    </View>
                </SafeAreaView>
            </ScreenBackground>
        );
    }

    return (
        <ScreenBackground>
            <SafeAreaView style={styles.container} edges={['top']}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()}>
                        <Text style={styles.backButton}>← Back</Text>
                    </TouchableOpacity>
                    <Text style={styles.title}>Masters</Text>
                    <TouchableOpacity onPress={() => navigation.navigate('MasterForm')}>
                        <Text style={styles.addButton}>+ Add</Text>
                    </TouchableOpacity>
                </View>

                {/* Search */}
                <View style={styles.searchContainer}>
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search by name or email..."
                        placeholderTextColor={colors.textMuted}
                        value={searchQuery}
                        onChangeText={handleSearch}
                    />
                </View>

                {/* Status Filters */}
                <View style={styles.filtersContainer}>
                    {['active', 'pending', 'suspended', 'inactive'].map(status => (
                        <TouchableOpacity
                            key={status}
                            style={[
                                styles.filterChip,
                                statusFilter === status && styles.filterChipActive,
                                { borderColor: STATUS_COLORS[status] }
                            ]}
                            onPress={() => handleStatusFilter(status)}
                        >
                            <View style={[styles.filterDot, { backgroundColor: STATUS_COLORS[status] }]} />
                            <Text style={[
                                styles.filterText,
                                statusFilter === status && { color: colors.text }
                            ]}>
                                {status.charAt(0).toUpperCase() + status.slice(1)}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* List */}
                <FlatList
                    data={filteredMasters}
                    keyExtractor={(item) => item.id}
                    renderItem={renderMasterCard}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} />
                    }
                    ListEmptyComponent={
                        <Card variant="glass" style={styles.emptyCard}>
                            <Text style={styles.emptyIcon}>👥</Text>
                            <Text style={styles.emptyText}>
                                {searchQuery || statusFilter ? 'No masters match your filters' : 'No masters yet'}
                            </Text>
                            <TouchableOpacity
                                style={styles.emptyButton}
                                onPress={() => navigation.navigate('MasterForm')}
                            >
                                <Text style={styles.emptyButtonText}>Add First Master</Text>
                            </TouchableOpacity>
                        </Card>
                    }
                />
            </SafeAreaView>
        </ScreenBackground>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: spacing.lg,
        paddingBottom: spacing.md,
    },
    backButton: { fontSize: 16, color: colors.text },
    title: { fontSize: 20, fontWeight: '600', color: colors.text },
    addButton: { fontSize: 16, color: '#8B5CF6', fontWeight: '600' },
    searchContainer: { paddingHorizontal: spacing.lg, marginBottom: spacing.md },
    searchInput: {
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: spacing.md,
        color: colors.text,
        fontSize: 16,
        borderWidth: 1,
        borderColor: colors.border,
    },
    filtersContainer: {
        flexDirection: 'row',
        paddingHorizontal: spacing.lg,
        gap: spacing.sm,
        marginBottom: spacing.md,
    },
    filterChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 20,
        borderWidth: 1,
        backgroundColor: colors.surface,
    },
    filterChipActive: {
        backgroundColor: colors.surfaceLight,
    },
    filterDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
    filterText: { fontSize: 12, color: colors.textSecondary },
    listContent: { padding: spacing.lg, paddingTop: 0 },
    masterCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.md,
        marginBottom: spacing.sm,
    },
    avatarContainer: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: colors.surfaceLight,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: spacing.md,
    },
    avatarText: { fontSize: 20, fontWeight: '600', color: colors.text },
    masterInfo: { flex: 1 },
    masterName: { fontSize: 16, fontWeight: '600', color: colors.text },
    masterEmail: { fontSize: 12, color: colors.textSecondary, marginBottom: 4 },
    statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 2,
        paddingHorizontal: 8,
        borderRadius: 12,
    },
    statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 4 },
    statusText: { fontSize: 11, fontWeight: '500' },
    commission: { fontSize: 11, color: colors.textMuted },
    arrow: { fontSize: 18, color: colors.textSecondary },
    emptyCard: { alignItems: 'center', padding: spacing.xl, marginTop: spacing.xl },
    emptyIcon: { fontSize: 48, marginBottom: spacing.md, opacity: 0.5 },
    emptyText: { fontSize: 14, color: colors.textSecondary, marginBottom: spacing.lg, textAlign: 'center' },
    emptyButton: {
        backgroundColor: '#8B5CF6',
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.lg,
        borderRadius: 8,
    },
    emptyButtonText: { color: '#fff', fontWeight: '600' },
});

export default MasterListScreen;
