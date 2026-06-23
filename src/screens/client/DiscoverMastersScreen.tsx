import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    RefreshControl,
    Image,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Card, ScreenBackground, MerakiText } from '../../components/ui';
import { colors, spacing, gradients } from '../../theme';
import { isMasterWithinRange, haversineDistanceKm } from '../../utils/distance';

type Master = {
    id: string;
    full_name: string;
    avatar_url: string | null;
    city: string | null;
    country: string | null;
    latitude: number | null;
    longitude: number | null;
    bio: string | null;
    services_count: number;
    rating: number | null;
    is_visible_globally: boolean;
    accepts_new_clients: boolean;
    distance?: number;
};

export function DiscoverMastersScreen() {
    const navigation = useNavigation<any>();
    const { profile } = useAuth();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [masters, setMasters] = useState<Master[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedTag, setSelectedTag] = useState('');

    const trendingTags = ['Balayage', 'Gel Nails', 'Lash Extensions', 'Facial', 'Braids', 'Microblading', 'Keratin', 'Waxing'];
    const tagGradients = [
        ['#F472B6', '#FDA4AF'],
        ['#A78BFA', '#D8B4FE'],
        ['#60A5FA', '#67E8F9'],
        ['#34D399', '#5EEAD4'],
        ['#FBBF24', '#FCD34D'],
        ['#818CF8', '#93C5FD'],
        ['#FB7185', '#F9A8D4'],
        ['#2DD4BF', '#6EE7B7'],
    ];

    // User location from profile — used for country + state match AND haversine fallback.
    const [userCity, setUserCity] = useState<string | null>(profile?.city || null);
    const [userCountry, setUserCountry] = useState<string | null>(profile?.country || null);
    const userState: string | null = (profile as any)?.state || null;
    const userStateCode: string | null = (profile as any)?.state_code || null;
    const userLat: number | null = (profile as any)?.latitude || null;
    const userLng: number | null = (profile as any)?.longitude || null;
    const searchRadiusKm: number = (profile as any)?.search_radius_km ?? 100;

    useEffect(() => {
        loadMasters();
    }, []);

    const loadMasters = async () => {
        try {
            const { data: mastersData, error } = await (supabase as any).rpc('get_masters_with_services');

            if (error) throw error;

            const visibleMasters: Master[] = (mastersData || [])
                .filter((m: any) => m.is_visible_globally !== false)
                .map((m: any) => ({
                    ...m,
                    services_count: Number(m.services_count) || 0,
                    rating: null,
                    is_visible_globally: m.is_visible_globally ?? true,
                    accepts_new_clients: m.accepts_new_clients ?? true,
                }));

            setMasters(visibleMasters);
        } catch (error) {
            console.error('Error loading masters:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        loadMasters();
    }, []);

    const userLoc = {
        country: userCountry,
        state: userState,
        state_code: userStateCode,
        latitude: userLat,
        longitude: userLng,
    };

    const mastersWithDistance = masters.map((master) => {
        let distance = Infinity;
        if (userLat != null && userLng != null && master.latitude != null && master.longitude != null) {
            distance = haversineDistanceKm(userLat, userLng, master.latitude, master.longitude);
        }
        return { ...master, distance };
    });

    const filteredMasters = mastersWithDistance.filter((master) => {
        // 1. Country + Distance Filter (ignore state shortcut)
        if (!userCountry) return false;
        if (master.country?.toLowerCase() !== userCountry.toLowerCase()) return false;
        
        if (searchRadiusKm > 0 && master.distance !== Infinity) {
            if (master.distance > searchRadiusKm) return false;
        } else if (searchRadiusKm > 0 && master.distance === Infinity) {
            // Fallback to old range check if coordinates are missing
            if (!isMasterWithinRange(userLoc, master as any, searchRadiusKm)) return false;
        }

        // 2. Search Query Filter
        let passesSearch = true;
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            passesSearch = !!(
                master.full_name?.toLowerCase().includes(query) ||
                master.city?.toLowerCase().includes(query) ||
                master.country?.toLowerCase().includes(query)
            );
        }

        // 3. Trending Tag Filter
        let passesTag = true;
        if (selectedTag) {
            const t = selectedTag.toLowerCase();
            // Match tag in bio, name, or specialties (assuming specialties isn't loaded here but bio/name might contain it)
            passesTag = !!(
                master.bio?.toLowerCase().includes(t) ||
                master.full_name?.toLowerCase().includes(t) ||
                (master as any).specialties?.toLowerCase().includes(t)
            );
        }

        return passesSearch && passesTag;
    });

    // Sort: nearest masters first
    const sortedMasters = [...filteredMasters].sort((a, b) => {
        if (a.distance !== Infinity && b.distance !== Infinity) {
            return a.distance - b.distance;
        }
        if (a.distance !== Infinity) return -1;
        if (b.distance !== Infinity) return 1;
        return (a.full_name || '').localeCompare(b.full_name || '');
    });

    const handleMasterPress = (master: Master) => {
        navigation.navigate('MasterDetail', { masterId: master.id });
    };

    if (loading) {
        return (
            <ScreenBackground>
                <SafeAreaView style={styles.container}>
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={colors.primary} />
                        <MerakiText style={styles.loadingText}>Finding masters near you...</MerakiText>
                    </View>
                </SafeAreaView>
            </ScreenBackground>
        );
    }

    return (
        <ScreenBackground>
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={styles.header}>
                    <View style={styles.headerRow}>
                        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                            <MaterialIcons name="arrow-back" size={22} color="rgba(0, 0, 0, 0.55)" />
                        </TouchableOpacity>
                        <MerakiText style={styles.headerTitle}>Discover Masters</MerakiText>
                        <View style={{ width: 40 }} />
                    </View>
                    {userCountry && (
                        <View style={styles.locationBadge}>
                            <MaterialIcons name="my-location" size={14} color={colors.primary} />
                            <MerakiText style={styles.subtitle}>
                                Showing masters within {searchRadiusKm === 0 ? 'your country' : `${searchRadiusKm}km`}
                            </MerakiText>
                        </View>
                    )}
                </View>

                {/* Search Bar */}
                <View style={styles.searchContainer}>
                    <Card variant="glass" style={styles.searchBar}>
                        <MaterialIcons name="search" size={20} color={colors.textMuted} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search by name, specialty, or city..."
                            placeholderTextColor={colors.textMuted}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                        {searchQuery.length > 0 && (
                            <TouchableOpacity onPress={() => setSearchQuery('')}>
                                <MaterialIcons name="cancel" size={20} color={colors.textMuted} />
                            </TouchableOpacity>
                        )}
                    </Card>

                    {/* Trending Tags */}
                    <View style={styles.tagsContainer}>
                        <View style={styles.tagsHeader}>
                            <View style={styles.tagsIconWrap}>
                                <MaterialIcons name="trending-up" size={12} color="#fff" />
                            </View>
                            <MerakiText style={styles.tagsTitle}>Popular</MerakiText>
                        </View>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tagsScroll}>
                            {trendingTags.map((tag, idx) => {
                                const isSelected = selectedTag === tag;
                                return (
                                    <TouchableOpacity
                                        key={tag}
                                        onPress={() => setSelectedTag(isSelected ? '' : tag)}
                                        activeOpacity={0.7}
                                    >
                                        <View style={[styles.tagPill, isSelected ? styles.tagPillSelected : styles.tagPillUnselected]}>
                                            <MerakiText style={[styles.tagText, isSelected ? styles.tagTextSelected : styles.tagTextUnselected]}>
                                                {tag}
                                            </MerakiText>
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </View>
                </View>

                <ScrollView
                    contentContainerStyle={styles.content}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
                    }
                >
                    {sortedMasters.length === 0 ? (
                        <Card variant="glass" style={styles.emptyCard}>
                            <View style={styles.emptyIconContainer}>
                                <MaterialIcons name="person-search" size={64} color={colors.textMuted} />
                            </View>
                            <MerakiText variant="h3" style={styles.emptyTitle}>No Masters Found</MerakiText>
                            <MerakiText style={styles.emptyText}>
                                {searchQuery
                                    ? 'Try adjusting your search query to find masters in other areas.'
                                    : 'No masters are currently available in your area. Try searching for a different city.'}
                            </MerakiText>
                        </Card>
                    ) : (
                        sortedMasters.map((master) => (
                            <TouchableOpacity key={master.id} onPress={() => handleMasterPress(master)} activeOpacity={0.7}>
                                <Card variant="glass" style={styles.masterCard}>
                                    <View style={styles.masterRow}>
                                        <View style={styles.avatarContainer}>
                                            {master.avatar_url ? (
                                                <Image source={{ uri: master.avatar_url }} style={styles.avatarImage} />
                                            ) : (
                                                <View style={styles.avatarPlaceholder}>
                                                    <MerakiText variant="h2" style={styles.avatarText}>
                                                        {master.full_name?.[0]?.toUpperCase() || '?'}
                                                    </MerakiText>
                                                </View>
                                            )}
                                        </View>
                                        <View style={styles.masterInfo}>
                                            <MerakiText variant="h4" style={styles.masterName}>{master.full_name}</MerakiText>
                                            {master.city && (
                                                <View style={styles.locationRow}>
                                                    <MaterialIcons
                                                        name="location-on"
                                                        size={14}
                                                        color={userCity?.toLowerCase() === master.city?.toLowerCase()
                                                            ? colors.primary
                                                            : colors.textSecondary
                                                        }
                                                    />
                                                    <MerakiText style={[
                                                        styles.locationText,
                                                        userCity?.toLowerCase() === master.city?.toLowerCase() && styles.nearbyText
                                                    ]}>
                                                        {master.city}{master.country ? `, ${master.country}` : ''}
                                                    </MerakiText>
                                                    {master.distance !== undefined && master.distance !== Infinity ? (
                                                        <View style={styles.distanceBadge}>
                                                            <MerakiText style={styles.distanceBadgeText}>
                                                                {master.distance < 1 ? '< 1 km' : `${master.distance.toFixed(1)} km`}
                                                            </MerakiText>
                                                        </View>
                                                    ) : (master as any).state ? (
                                                        <View style={styles.distanceBadge}>
                                                            <MerakiText style={styles.distanceBadgeText}>
                                                                {(master as any).state}
                                                            </MerakiText>
                                                        </View>
                                                    ) : null}
                                                </View>
                                            )}
                                            <View style={styles.statsRow}>
                                                <View style={styles.serviceBadge}>
                                                    <MerakiText style={styles.statText}>
                                                        {master.services_count} {master.services_count === 1 ? 'service' : 'services'}
                                                    </MerakiText>
                                                </View>
                                                {!master.accepts_new_clients && (
                                                    <View style={styles.notAcceptingBadge}>
                                                        <MerakiText style={styles.notAcceptingText}>Full Capacity</MerakiText>
                                                    </View>
                                                )}
                                            </View>
                                        </View>
                                        <MaterialIcons name="chevron-right" size={24} color={colors.textMuted} />
                                    </View>
                                </Card>
                            </TouchableOpacity>
                        ))
                    )}
                </ScrollView>
            </SafeAreaView>
        </ScreenBackground>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: { color: colors.textSecondary, marginTop: spacing.md, fontSize: 14 },
    header: {
        paddingHorizontal: 20,
        paddingTop: 8,
        paddingBottom: spacing.md,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    backButton: {
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: 'rgba(0, 0, 0, 0.03)',
        borderWidth: 1, borderColor: 'rgba(0, 0, 0, 0.06)',
        alignItems: 'center', justifyContent: 'center',
    },
    headerTitle: { fontSize: 17, fontWeight: '600', color: '#1A1A1A' },
    locationBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(200, 160, 77, 0.1)',
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        borderRadius: 20,
        alignSelf: 'flex-start',
        borderWidth: 1,
        borderColor: 'rgba(200, 160, 77, 0.2)',
    },
    subtitle: { fontSize: 12, color: colors.textSecondary, marginLeft: 4 },
    searchContainer: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.08)',
        marginBottom: spacing.md,
    },
    searchInput: {
        flex: 1,
        marginLeft: spacing.sm,
        fontSize: 16,
        color: colors.text,
        paddingVertical: spacing.sm,
    },
    content: { padding: spacing.lg, paddingTop: 0 },
    masterCard: {
        marginBottom: spacing.md,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.04)',
    },
    masterRow: { flexDirection: 'row', alignItems: 'center' },
    avatarContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        marginRight: spacing.md,
        overflow: 'hidden',
        borderWidth: 2,
        borderColor: 'rgba(200, 160, 77, 0.3)',
    },
    avatarPlaceholder: {
        flex: 1,
        backgroundColor: colors.surfaceLight,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarImage: { width: '100%', height: '100%' },
    avatarText: { color: colors.text, opacity: 0.8 },
    masterInfo: { flex: 1 },
    masterName: { color: colors.text, marginBottom: 2 },
    locationRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
    locationText: { fontSize: 12, color: colors.textSecondary, marginLeft: 4 },
    nearbyText: { color: colors.primary },
    nearbyBadge: {
        backgroundColor: 'rgba(200, 160, 77, 0.15)',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
        marginLeft: spacing.sm,
        borderWidth: 1,
        borderColor: 'rgba(200, 160, 77, 0.3)',
    },
    nearbyBadgeText: { fontSize: 10, color: colors.primary, fontWeight: '700', textTransform: 'uppercase' },
    distanceBadge: {
        backgroundColor: 'rgba(139, 92, 246, 0.1)',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10,
        marginLeft: spacing.sm,
        borderWidth: 1,
        borderColor: 'rgba(139, 92, 246, 0.2)',
    },
    distanceBadgeText: { fontSize: 10, color: '#7C3AED', fontWeight: '700' },
    statsRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    serviceBadge: {
        backgroundColor: 'rgba(0, 0, 0, 0.04)',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
    },
    statText: { fontSize: 11, color: colors.textMuted },
    notAcceptingBadge: {
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: 'rgba(239, 68, 68, 0.2)',
    },
    notAcceptingText: { fontSize: 10, color: '#EF4444', fontWeight: '600', textTransform: 'uppercase' },
    emptyCard: { alignItems: 'center', padding: spacing.xl, borderStyle: 'dashed', borderWidth: 1, borderColor: colors.border },
    emptyIconContainer: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: 'rgba(0, 0, 0, 0.02)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.lg,
    },
    emptyTitle: { color: colors.text, marginBottom: spacing.sm },
    emptyText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },
    tagsContainer: { marginBottom: spacing.sm },
    tagsHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 6 },
    tagsIconWrap: { width: 24, height: 24, borderRadius: 6, backgroundColor: '#A78BFA', alignItems: 'center', justifyContent: 'center' },
    tagsTitle: { fontSize: 12, fontWeight: '700', color: colors.text, textTransform: 'uppercase', letterSpacing: 0.5 },
    tagsScroll: { gap: 8, paddingRight: spacing.lg },
    tagPill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, flexDirection: 'row', alignItems: 'center' },
    tagPillUnselected: { backgroundColor: colors.surface, borderColor: 'rgba(0, 0, 0, 0.08)' },
    tagPillSelected: { backgroundColor: '#A78BFA', borderColor: '#A78BFA' },
    tagText: { fontSize: 13, fontWeight: '600' },
    tagTextUnselected: { color: colors.textSecondary },
    tagTextSelected: { color: '#FFFFFF' },
});

export default DiscoverMastersScreen;
