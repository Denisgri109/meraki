import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    Image,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { Card, ScreenBackground } from '../../components/ui';
import { colors, spacing } from '../../theme';
import * as Location from 'expo-location';

type Master = {
    id: string;
    full_name: string;
    avatar_url: string | null;
    city: string | null;
    country: string | null;
    bio: string | null;
    services_count: number;
    is_visible_globally: boolean;
    accepts_new_clients: boolean;
};

export function SearchMastersScreen() {
    const navigation = useNavigation<any>();
    const [loading, setLoading] = useState(true);
    const [masters, setMasters] = useState<Master[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [userCity, setUserCity] = useState<string | null>(null);
    const [userCountry, setUserCountry] = useState<string | null>(null);

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
                if (address?.country) {
                    setUserCountry(address.country);
                }
            }
        } catch (error) {
            console.log('Location detection failed:', error);
        }
    };

    const loadMasters = async () => {
        try {
            setLoading(true);
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
                    return !settings || settings.is_visible_globally !== false;
                })
                .map((m: any) => {
                    const settings = settingsMap.get(m.id);
                    return {
                        ...m,
                        services_count: serviceCounts.get(m.id) || 0,
                        is_visible_globally: settings?.is_visible_globally ?? true,
                        accepts_new_clients: settings?.accepts_new_clients ?? true,
                    };
                });

            setMasters(visibleMasters);
        } catch (error) {
            console.error('Error loading masters:', error);
        } finally {
            setLoading(false);
        }
    };

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
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.text} />
                <Text style={styles.loadingText}>Finding masters...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Search Header */}
            <View style={styles.searchHeader}>
                <View style={styles.searchBar}>
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
                </View>
                {userCity && (
                    <View style={{ flexDirection: "row", alignItems: "center" }}><MaterialIcons name="location-on" size={14} color={colors.primary} /><Text style={styles.locationText}>{userCity}</Text></View>
                )}
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                {sortedMasters.length === 0 ? (
                    <Card style={styles.emptyCard}>
                        <Text style={styles.emptyIcon}>🔍</Text>
                        <Text style={styles.emptyTitle}>
                            {searchQuery ? 'No Results Found' : 'Start Searching'}
                        </Text>
                        <Text style={styles.emptyText}>
                            {searchQuery
                                ? 'Try adjusting your search terms'
                                : 'Search for masters by name or city'}
                        </Text>
                    </Card>
                ) : (
                    <>
                        <Text style={styles.resultsText}>
                            {sortedMasters.length} master{sortedMasters.length !== 1 ? 's' : ''} found
                        </Text>
                        {sortedMasters.map((master) => (
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
                                                    <MaterialIcons
                                                        name="location-on"
                                                        size={14}
                                                        color={userCity?.toLowerCase() === master.city?.toLowerCase()
                                                            ? colors.primary
                                                            : colors.textSecondary
                                                        }
                                                    />
                                                    <Text style={[
                                                        styles.locationLabel,
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
                                                        <Text style={styles.notAcceptingText}>Not accepting</Text>
                                                    </View>
                                                )}
                                            </View>
                                        </View>
                                        <MaterialIcons name="chevron-right" size={24} color={colors.textMuted} />
                                    </View>
                                </Card>
                            </TouchableOpacity>
                        ))}
                    </>
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        color: colors.textSecondary,
        marginTop: spacing.md,
        fontSize: 14,
    },
    searchHeader: {
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.lg,
        paddingBottom: spacing.md,
        backgroundColor: 'transparent',
    },
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
    locationText: {
        fontSize: 13,
        color: colors.textSecondary,
        marginTop: spacing.sm,
    },
    content: {
        padding: spacing.lg,
        paddingTop: 0,
    },
    resultsText: {
        fontSize: 14,
        color: colors.textSecondary,
        marginBottom: spacing.md,
    },
    masterCard: {
        marginBottom: spacing.md,
        padding: spacing.md,
    },
    masterRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatar: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: colors.surfaceLight,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: spacing.md,
    },
    avatarImage: {
        width: 56,
        height: 56,
        borderRadius: 28,
    },
    avatarText: {
        fontSize: 22,
        fontWeight: '600',
        color: colors.text,
    },
    masterInfo: {
        flex: 1,
    },
    masterName: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.text,
        marginBottom: 4,
    },
    locationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    locationLabel: {
        fontSize: 13,
        color: colors.textSecondary,
        marginLeft: 4,
    },
    nearbyText: {
        color: colors.primary,
        fontWeight: '500',
    },
    nearbyBadge: {
        backgroundColor: 'rgba(200, 160, 77, 0.2)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        marginLeft: spacing.sm,
    },
    nearbyBadgeText: {
        fontSize: 10,
        color: colors.primary,
        fontWeight: '600',
    },
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    statText: {
        fontSize: 12,
        color: colors.textMuted,
    },
    notAcceptingBadge: {
        backgroundColor: 'rgba(239, 68, 68, 0.2)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    notAcceptingText: {
        fontSize: 10,
        color: '#EF4444',
        fontWeight: '500',
    },
    emptyCard: {
        alignItems: 'center',
        padding: spacing.xl,
    },
    emptyIcon: {
        fontSize: 48,
        marginBottom: spacing.md,
        opacity: 0.5,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: colors.text,
        marginBottom: spacing.xs,
    },
    emptyText: {
        fontSize: 14,
        color: colors.textSecondary,
        textAlign: 'center',
    },
});

export default SearchMastersScreen;
