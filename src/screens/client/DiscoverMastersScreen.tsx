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
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { supabase } from '../../lib/supabase';
import { Card, ScreenBackground } from '../../components/ui';
import { colors, spacing } from '../../theme';

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

    useEffect(() => {
        loadMasters();
        detectUserLocation();
    }, []);

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
            }
        } catch (error) {
            console.log('Location detection failed:', error);
        }
    };

    const loadMasters = async () => {
        try {
            // Get all visible masters with their service counts
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

            // Get master settings to check visibility
            const { data: settingsData } = await (supabase as any)
                .from('master_settings')
                .select('master_id, is_visible_globally, accepts_new_clients');

            // Get service counts per master
            const { data: servicesData } = await supabase
                .from('master_services')
                .select('master_id');

            // Create settings lookup
            const settingsMap = new Map();
            (settingsData || []).forEach((s: any) => {
                settingsMap.set(s.master_id, s);
            });

            // Count services per master
            const serviceCounts = new Map<string, number>();
            (servicesData || []).forEach((s: any) => {
                serviceCounts.set(s.master_id, (serviceCounts.get(s.master_id) || 0) + 1);
            });

            // Filter and map masters
            const visibleMasters: Master[] = (mastersData || [])
                .filter((m: any) => {
                    const settings = settingsMap.get(m.id);
                    // If no settings, default to visible
                    return !settings || settings.is_visible_globally !== false;
                })
                .map((m: any) => {
                    const settings = settingsMap.get(m.id);
                    return {
                        ...m,
                        services_count: serviceCounts.get(m.id) || 0,
                        rating: null, // TODO: Add rating system
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
        loadMasters();
    }, []);

    const filteredMasters = masters.filter((master) => {
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
                        <ActivityIndicator size="large" color={colors.text} />
                        <Text style={styles.loadingText}>Finding masters near you...</Text>
                    </View>
                </SafeAreaView>
            </ScreenBackground>
        );
    }

    return (
        <ScreenBackground>
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <Text style={styles.backButtonText}>← Back</Text>
                    </TouchableOpacity>
                    <Text style={styles.title}>Discover Masters</Text>
                    {userCity && (
                        <Text style={styles.subtitle}>📍 Showing results for {userCity}</Text>
                    )}
                </View>

                {/* Search Bar */}
                <View style={styles.searchContainer}>
                    <View style={styles.searchBar}>
                        <MaterialCommunityIcons name="magnify" size={20} color={colors.textMuted} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search by name or city..."
                            placeholderTextColor={colors.textMuted}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                        {searchQuery.length > 0 && (
                            <TouchableOpacity onPress={() => setSearchQuery('')}>
                                <MaterialCommunityIcons name="close-circle" size={20} color={colors.textMuted} />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                <ScrollView
                    contentContainerStyle={styles.content}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} />
                    }
                >
                    {sortedMasters.length === 0 ? (
                        <Card style={styles.emptyCard}>
                            <Text style={styles.emptyIcon}>🔍</Text>
                            <Text style={styles.emptyTitle}>No Masters Found</Text>
                            <Text style={styles.emptyText}>
                                {searchQuery
                                    ? 'Try adjusting your search'
                                    : 'No masters are currently available in your area'}
                            </Text>
                        </Card>
                    ) : (
                        sortedMasters.map((master) => (
                            <TouchableOpacity key={master.id} onPress={() => handleMasterPress(master)}>
                                <Card style={styles.masterCard}>
                                    <View style={styles.masterRow}>
                                        <View style={styles.avatar}>
                                            {master.avatar_url ? (
                                                <Image source={{ uri: master.avatar_url }} style={styles.avatarImage} />
                                            ) : (
                                                <Text style={styles.avatarText}>
                                                    {master.full_name?.[0]?.toUpperCase() || '?'}
                                                </Text>
                                            )}
                                        </View>
                                        <View style={styles.masterInfo}>
                                            <Text style={styles.masterName}>{master.full_name}</Text>
                                            {master.city && (
                                                <View style={styles.locationRow}>
                                                    <MaterialCommunityIcons
                                                        name="map-marker"
                                                        size={14}
                                                        color={userCity?.toLowerCase() === master.city?.toLowerCase()
                                                            ? colors.primary
                                                            : colors.textSecondary
                                                        }
                                                    />
                                                    <Text style={[
                                                        styles.locationText,
                                                        userCity?.toLowerCase() === master.city?.toLowerCase() && styles.nearbyText
                                                    ]}>
                                                        {master.city}{master.country ? `, ${master.country}` : ''}
                                                    </Text>
                                                    {userCity?.toLowerCase() === master.city?.toLowerCase() && (
                                                        <View style={styles.nearbyBadge}>
                                                            <Text style={styles.nearbyBadgeText}>Nearby</Text>
                                                        </View>
                                                    )}
                                                </View>
                                            )}
                                            <View style={styles.statsRow}>
                                                <Text style={styles.statText}>
                                                    {master.services_count} services
                                                </Text>
                                                {!master.accepts_new_clients && (
                                                    <View style={styles.notAcceptingBadge}>
                                                        <Text style={styles.notAcceptingText}>Not accepting new clients</Text>
                                                    </View>
                                                )}
                                            </View>
                                        </View>
                                        <MaterialCommunityIcons name="chevron-right" size={24} color={colors.textMuted} />
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
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.lg,
        paddingBottom: spacing.md,
    },
    backButton: {
        marginBottom: spacing.sm,
        alignSelf: 'flex-start',
        paddingVertical: spacing.xs,
    },
    backButtonText: { fontSize: 16, color: colors.primary, fontWeight: '500' },
    title: { fontSize: 28, fontWeight: '600', color: colors.text },
    subtitle: { fontSize: 14, color: colors.textSecondary, marginTop: spacing.xs },
    searchContainer: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 12,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderWidth: 1,
        borderColor: colors.border,
    },
    searchInput: {
        flex: 1,
        marginLeft: spacing.sm,
        fontSize: 16,
        color: colors.text,
    },
    content: { padding: spacing.lg, paddingTop: 0 },
    masterCard: { marginBottom: spacing.md, padding: spacing.md },
    masterRow: { flexDirection: 'row', alignItems: 'center' },
    avatar: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: colors.surfaceLight,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: spacing.md,
    },
    avatarImage: { width: 56, height: 56, borderRadius: 28 },
    avatarText: { fontSize: 22, fontWeight: '600', color: colors.text },
    masterInfo: { flex: 1 },
    masterName: { fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: 4 },
    locationRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
    locationText: { fontSize: 13, color: colors.textSecondary, marginLeft: 4 },
    nearbyText: { color: colors.primary, fontWeight: '500' },
    nearbyBadge: {
        backgroundColor: 'rgba(139, 92, 246, 0.2)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        marginLeft: spacing.sm,
    },
    nearbyBadgeText: { fontSize: 10, color: colors.primary, fontWeight: '600' },
    statsRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    statText: { fontSize: 12, color: colors.textMuted },
    notAcceptingBadge: {
        backgroundColor: 'rgba(239, 68, 68, 0.2)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    notAcceptingText: { fontSize: 10, color: '#EF4444', fontWeight: '500' },
    emptyCard: { alignItems: 'center', padding: spacing.xl },
    emptyIcon: { fontSize: 48, marginBottom: spacing.md, opacity: 0.5 },
    emptyTitle: { fontSize: 18, fontWeight: '600', color: colors.text, marginBottom: spacing.xs },
    emptyText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center' },
});

export default DiscoverMastersScreen;
