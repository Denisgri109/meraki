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
import { Card, ScreenBackground, MerakiText } from '../../components/ui';
import { colors, spacing, gradients } from '../../theme';

type Master = {
    id: string;
    full_name: string;
    avatar_url: string | null;
    city: string | null;
    country: string | null;
    bio: string | null;
    services_count: number;
    rating: number | null;
    is_visible_globally: boolean;
    accepts_new_clients: boolean;
};

export function DiscoverMastersScreen() {
    const navigation = useNavigation<any>();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [masters, setMasters] = useState<Master[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [userCity, setUserCity] = useState<string | null>(null);
    const [userCountry, setUserCountry] = useState<string | null>(null);

    useEffect(() => {
        const init = async () => {
            // 1. Try to get location from device first
            await detectUserLocation();
            // 2. Then load masters (which will use the location state if set, or we might need to rely on the effect dependency if we want it to react)
            // Actually, better to chain them or use separate effects. 
            // Let's keep it simple: detect location, then load masters. 
            // But detectUserLocation is async and sets state.
            // So we should depend on userCountry/userCity or just load initially.

            // To ensure we filter correctly on first load with location, we should wait for location or timeout, then load.
            // But for now, let's just trigger loadMasters. The filter is client-side so we can just re-filter when location updates.
        };
        init();
    }, []);

    // Re-filter when user location changes
    useEffect(() => {
        if (userCountry) {
            // Optionally reload or just rely on the existing 'masters' state if we were fetching all. 
            // But we are doing client side filtering on 'masters' state? 
            // No, 'masters' state is the raw list. 'filteredMasters' is derived. 
            // Wait, 'loadMasters' sets 'masters'. 
            // Let's check 'loadMasters'. It fetches *all* masters. 
            // So we can just use derived state for filtering.
        }
    }, [userCountry]);


    const detectUserLocation = async () => {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status === 'granted') {
                const location = await Location.getCurrentPositionAsync({
                    accuracy: Location.Accuracy.Balanced,
                });
                const [address] = await Location.reverseGeocodeAsync({
                    latitude: location.coords.latitude,
                    longitude: location.coords.longitude,
                });
                if (address?.city) {
                    setUserCity(address.city);
                }
                if (address?.country) {
                    setUserCountry(address.country);
                }
            }
        } catch (error) {
            console.log('Location detection failed:', error);
        } finally {
            // Load masters after attempting location to avoid flash of unfiltered content if possible, 
            // but 'masters' is fetched independently. 
            loadMasters();
        }
    };

    const loadMasters = async () => {
        try {
            // Get all visible masters 
            // Note: In a real app with many users, we should filter by country on the SERVER side (Supabase).
            // But for now, client-side filtering as per current architecture.
            const { data: mastersData, error } = await supabase
                .from('profiles')
                .select(`
                    id,
                    full_name,
                    avatar_url,
                    city,
                    country,
                    bio
                `)
                .in('role', ['master', 'owner'])
                .not('full_name', 'is', null);

            if (error) throw error;

            const { data: settingsData } = await (supabase as any)
                .from('master_settings')
                .select('master_id, is_visible_globally, accepts_new_clients');

            const { data: servicesData } = await supabase
                .from('master_services')
                .select('master_id');

            const settingsMap = new Map();
            (settingsData || []).forEach((s: any) => {
                settingsMap.set(s.master_id, s);
            });

            const serviceCounts = new Map<string, number>();
            (servicesData || []).forEach((s: any) => {
                serviceCounts.set(s.master_id, (serviceCounts.get(s.master_id) || 0) + 1);
            });

            const visibleMasters: Master[] = (mastersData || [])
                .filter((m: any) => {
                    const settings = settingsMap.get(m.id);
                    return !settings || settings.is_visible_globally !== false;
                })
                .map((m: any) => {
                    const settings = settingsMap.get(m.id);
                    return {
                        ...m,
                        services_count: serviceCounts.get(m.id) || 0,
                        rating: null,
                        is_visible_globally: settings?.is_visible_globally ?? true,
                        accepts_new_clients: settings?.accepts_new_clients ?? true,
                    };
                });

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
        // Re-detect location on refresh too, in case user moved
        detectUserLocation();
    }, []);

    const filteredMasters = masters.filter((master) => {
        // 1. Country Filter (Strict)
        if (userCountry) {
            if (!master.country) return false;
            const uCountry = userCountry.toLowerCase().trim();
            const mCountry = master.country.toLowerCase().trim();
            if (uCountry !== mCountry) return false;
        }

        // 2. Search Query Filter
        if (!searchQuery.trim()) return true;
        const query = searchQuery.toLowerCase();
        return (
            master.full_name?.toLowerCase().includes(query) ||
            master.city?.toLowerCase().includes(query) ||
            master.country?.toLowerCase().includes(query)
        );
    });

    // Sort: masters in user's city first
    const sortedMasters = [...filteredMasters].sort((a, b) => {
        if (userCity) {
            const aInCity = a.city?.toLowerCase() === userCity.toLowerCase();
            const bInCity = b.city?.toLowerCase() === userCity.toLowerCase();
            if (aInCity && !bInCity) return -1;
            if (!aInCity && bInCity) return 1;
        }
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
                            <MaterialIcons name="arrow-back" size={22} color="rgba(255,255,255,0.7)" />
                        </TouchableOpacity>
                        <MerakiText style={styles.headerTitle}>Discover Masters</MerakiText>
                        <View style={{ width: 40 }} />
                    </View>
                    {userCity && (
                        <View style={styles.locationBadge}>
                            <MaterialIcons name="location-on" size={14} color={colors.primary} />
                            <MerakiText style={styles.subtitle}>Showing results for {userCity}</MerakiText>
                        </View>
                    )}
                </View>

                {/* Search Bar */}
                <View style={styles.searchContainer}>
                    <Card variant="glass" style={styles.searchBar}>
                        <MaterialIcons name="search" size={20} color={colors.textMuted} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search by name or city..."
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
                                                    {userCity?.toLowerCase() === master.city?.toLowerCase() && (
                                                        <View style={styles.nearbyBadge}>
                                                            <MerakiText style={styles.nearbyBadgeText}>Nearby</MerakiText>
                                                        </View>
                                                    )}
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
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
        alignItems: 'center', justifyContent: 'center',
    },
    headerTitle: { fontSize: 17, fontWeight: '600', color: '#fff' },
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
        borderColor: 'rgba(255,255,255,0.1)',
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
        borderColor: 'rgba(255,255,255,0.05)',
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
    statsRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    serviceBadge: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
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
        backgroundColor: 'rgba(255,255,255,0.03)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.lg,
    },
    emptyTitle: { color: colors.text, marginBottom: spacing.sm },
    emptyText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },
});

export default DiscoverMastersScreen;
