// T09 — Owner client directory: search + role filter + walk-in invite entry.
// Guard: owner-only (early return, QrPaymentsScreen pattern).

import React, { useCallback, useState } from 'react';
import { View, FlatList, TextInput, TouchableOpacity, StyleSheet, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useEffect } from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { ScreenBackground, MerakiText } from '../../components/ui';
import { safeGoBack } from '../../navigation/navigationUtils';
import { colors, spacing } from '../../theme';
import { searchClients, DirectoryProfile, DirectoryRoleFilter } from '../../services/clientManagementService';

type FilterChip = { key: DirectoryRoleFilter; label: string };
const CHIPS: FilterChip[] = [
    { key: 'clients', label: 'Clients' },
    { key: 'masters', label: 'Masters' },
    { key: 'all', label: 'All' },
];

export function ClientDirectoryScreen() {
    const navigation = useNavigation<any>();
    const { user, profile } = useAuth();
    const isOwner = profile?.role === 'owner';

    const [people, setPeople] = useState<DirectoryProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [query, setQuery] = useState('');
    const [filter, setFilter] = useState<DirectoryRoleFilter>('clients');

    const load = useCallback(async (silent = false) => {
        if (!isOwner) return;
        if (!silent) setLoading(true);
        const { data, error } = await searchClients(query, filter);
        if (!error && data) setPeople(data);
        else if (error) console.warn('client directory load failed:', error);
        setLoading(false);
        setRefreshing(false);
    }, [isOwner, query, filter]);

    useEffect(() => {
        const t = setTimeout(() => { void load(); }, 200);
        return () => clearTimeout(t);
    }, [load]);

    useFocusEffect(useCallback(() => {
        void load(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []));

    if (!isOwner) {
        return (
            <ScreenBackground>
                <SafeAreaView style={styles.container} edges={['top']}>
                    <View style={styles.header}>
                        <TouchableOpacity
                            accessibilityRole="button"
                            accessibilityLabel="Go back" onPress={() => safeGoBack(navigation)} style={styles.backButton}>
                            <MaterialIcons name="arrow-back" size={22} color={colors.text} />
                        </TouchableOpacity>
                        <MerakiText style={styles.title}>Clients</MerakiText>
                        <View style={{ width: 40 }} />
                    </View>
                    <View style={styles.centerMessage}>
                        <MaterialIcons name="lock-outline" size={48} color={colors.textMuted} />
                        <MerakiText style={styles.emptyTitle}>Restricted</MerakiText>
                        <MerakiText style={styles.emptyText}>Client management is available to the owner only.</MerakiText>
                    </View>
                </SafeAreaView>
            </ScreenBackground>
        );
    }

    const renderRow = ({ item }: { item: DirectoryProfile }) => (
        <TouchableOpacity
            style={styles.row}
            activeOpacity={0.7}
            onPress={() => {
                if (item.role === 'master') {
                    navigation.navigate('MasterDetail', { master: item });
                } else {
                    navigation.navigate('ClientDetail', { clientId: item.id });
                }
            }}
        >
            <View style={styles.avatar}>
                <MerakiText style={styles.avatarText}>
                    {(item.full_name || item.email || '?').charAt(0).toUpperCase()}
                </MerakiText>
            </View>
            <View style={styles.rowBody}>
                <MerakiText style={styles.rowName} numberOfLines={1}>{item.full_name || 'Unnamed'}</MerakiText>
                <MerakiText style={styles.rowSub} numberOfLines={1}>
                    {item.email}{item.phone ? ` · ${item.phone}` : ''}
                </MerakiText>
            </View>
            <View style={[styles.roleBadge, item.role === 'master' ? styles.roleBadgeMaster : styles.roleBadgeClient]}>
                <MerakiText style={[styles.roleBadgeText, item.role === 'master' ? styles.roleBadgeTextMaster : styles.roleBadgeTextClient]}>
                    {item.role}
                </MerakiText>
            </View>
            <MaterialIcons name="chevron-right" size={18} color={colors.textMuted} />
        </TouchableOpacity>
    );

    return (
        <ScreenBackground>
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={styles.header}>
                    <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel="Go back" onPress={() => safeGoBack(navigation)} style={styles.backButton}>
                        <MaterialIcons name="arrow-back" size={22} color={colors.text} />
                    </TouchableOpacity>
                    <MerakiText style={styles.title}>Clients</MerakiText>
                    <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel="Add person" onPress={() => navigation.navigate('ClientInvite')} style={styles.addButton}>
                        <MaterialIcons name="person-add" size={20} color="#fff" />
                    </TouchableOpacity>
                </View>

                <View style={styles.searchWrap}>
                    <MaterialIcons name="search" size={18} color={colors.textMuted} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search name, email or phone…"
                        placeholderTextColor={colors.textMuted}
                        value={query}
                        onChangeText={setQuery}
                        autoCapitalize="none"
                    />
                </View>

                <View style={styles.chipsRow}>
                    {CHIPS.map(c => (
                        <TouchableOpacity
                            key={c.key}
                            style={[styles.chip, filter === c.key && styles.chipActive]}
                            onPress={() => setFilter(c.key)}
                        >
                            <MerakiText style={[styles.chipText, filter === c.key && styles.chipTextActive]}>{c.label}</MerakiText>
                        </TouchableOpacity>
                    ))}
                </View>

                {loading ? (
                    <View style={styles.centerMessage}><ActivityIndicator color="#C47A90" /></View>
                ) : (
                    <FlatList
                        data={people}
                        keyExtractor={(item) => item.id}
                        renderItem={renderRow}
                        contentContainerStyle={styles.listContent}
                        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(true); }} tintColor="#C47A90" />}
                        ListEmptyComponent={
                            <View style={styles.centerMessage}>
                                <MaterialIcons name="person-outline" size={40} color={colors.textMuted} />
                                <MerakiText style={styles.emptyText}>No {filter === 'all' ? 'people' : filter} match your search.</MerakiText>
                            </View>
                        }
                    />
                )}
            </SafeAreaView>
        </ScreenBackground>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
    backButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    addButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
    title: { fontSize: 20, fontWeight: '700', color: colors.text },
    searchWrap: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        backgroundColor: colors.inputBackground, borderRadius: 14,
        marginHorizontal: spacing.md, paddingHorizontal: 12, height: 44, marginTop: spacing.xs,
    },
    searchInput: { flex: 1, fontSize: 14, color: colors.text },
    chipsRow: { flexDirection: 'row', gap: 8, paddingHorizontal: spacing.md, marginTop: spacing.sm },
    chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, backgroundColor: colors.inputBackground },
    chipActive: { backgroundColor: '#000' },
    chipText: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
    chipTextActive: { color: '#fff' },
    listContent: { padding: spacing.md, paddingBottom: spacing.xl * 2 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(0,0,0,0.08)' },
    avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#C47A90', alignItems: 'center', justifyContent: 'center' },
    avatarText: { color: '#fff', fontSize: 16, fontWeight: '700' },
    rowBody: { flex: 1, minWidth: 0 },
    rowName: { fontSize: 14, fontWeight: '600', color: colors.text },
    rowSub: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
    roleBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
    roleBadgeMaster: { backgroundColor: 'rgba(139,92,246,0.12)' },
    roleBadgeClient: { backgroundColor: 'rgba(16,185,129,0.12)' },
    roleBadgeText: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
    roleBadgeTextMaster: { color: '#8B5CF6' },
    roleBadgeTextClient: { color: '#047857' },
    centerMessage: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
    emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginTop: spacing.sm },
    emptyText: { fontSize: 13, color: colors.textMuted, textAlign: 'center', marginTop: 4 },
});
