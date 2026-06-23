import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { ScreenBackground, MerakiText } from '../../components/ui';
import { colors, spacing } from '../../theme';
import { Service } from '../../types/database';
import { isMasterWithinRange } from '../../utils/distance';

type BookingStackParamList = {
    BookingMain: undefined;
    ServiceDetail: { serviceId: string };
    SelectDateTime: { serviceId: string; masterId: string };
    BookingConfirm: { serviceId: string; masterId: string; dateTime: string; pilatesSessionId?: string };
};

type BookingScreenProps = {
    navigation: NativeStackNavigationProp<BookingStackParamList, 'BookingMain'>;
};

const CATEGORIES = [
    { label: 'All', icon: 'auto-awesome' },
    { label: 'Nails', icon: 'content-cut' },
    { label: 'Lashes', icon: 'visibility' },
    { label: 'Brows', icon: 'face' },
    { label: 'Pilates', icon: 'fitness-center' },
];

// Category-based gradient palettes (Academy-inspired pastel banners)
const CATEGORY_GRADIENTS: Record<string, [string, string]> = {
    Nails: ['#FADADD', '#F8C8D4'],
    Lashes: ['#E8D5FF', '#D4B8F0'],
    Brows: ['#FFF3D6', '#F5E0A0'],
    Hair: ['#D4F0E7', '#B8E6D4'],
    Skincare: ['#D6EAFF', '#B8D4F0'],
    Pilates: ['#E6F7F1', '#C8E9DD'],
    default: ['#F0F0F0', '#E5E5E5'],
};

const CATEGORY_ICON_COLORS: Record<string, string> = {
    Nails: '#9B4D6A',
    Lashes: '#6B3FA0',
    Brows: '#9B7A1C',
    Hair: '#2D7A5A',
    Skincare: '#3A6FA0',
    Pilates: '#2D7A5A',
    default: '#555555',
};

const getCategoryGradient = (category: string | null): [string, string] => {
    return CATEGORY_GRADIENTS[category || ''] || CATEGORY_GRADIENTS.default;
};

const getCategoryIconColor = (category: string | null): string => {
    return CATEGORY_ICON_COLORS[category || ''] || CATEGORY_ICON_COLORS.default;
};

const getCategoryMaterialIcon = (category: string | null): string => {
    switch (category) {
        case 'Nails': return 'content-cut';
        case 'Lashes': return 'visibility';
        case 'Brows': return 'face';
        case 'Hair': return 'content-cut';
        case 'Pilates': return 'fitness-center';
        default: return 'spa';
    }
};

export function BookingScreen({ navigation }: BookingScreenProps) {
    const { profile } = useAuth();
    const userCountry = profile?.country || null;
    const userState: string | null = (profile as any)?.state || null;
    const userStateCode: string | null = (profile as any)?.state_code || null;
    const userLat: number | null = (profile as any)?.latitude || null;
    const userLng: number | null = (profile as any)?.longitude || null;
    const searchRadiusKm: number = (profile as any)?.search_radius_km ?? 100;

    const [services, setServices] = useState<Service[]>([]);
    const [serviceProviders, setServiceProviders] = useState<Record<string, Array<{ id: string; full_name: string; role: string; email: string }>>>({});
    const [serviceDistances, setServiceDistances] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState('All');

    useEffect(() => {
        fetchServices();
    }, [userCountry, userState, userStateCode]);

    const fetchServices = async () => {
        try {
            // Fetch services with master country + state info for filtering
            const { data } = await supabase
                .from('services')
                .select('*, master_services!inner(is_available, profiles:master_id(id, full_name, role, email, country, state, state_code, latitude, longitude))')
                .eq('is_active', true)
                .eq('master_services.is_available', true)
                .order('name');

            let filtered = (data as any[]) || [];

            // Country + state/region + haversine fallback filter.
            const userLoc = {
                country: userCountry,
                state: userState,
                state_code: userStateCode,
                latitude: userLat,
                longitude: userLng,
            };
            if (userCountry) {
                filtered = filtered.filter((service: any) => {
                    const masterServices = service.master_services || [];
                    return masterServices.some((ms: any) => {
                        const masterProfile = ms.profiles;
                        if (!masterProfile) return false;
                        return isMasterWithinRange(userLoc, masterProfile, searchRadiusKm);
                    });
                });
            } else {
                // Must have a known user country to view local booking options
                filtered = [];
            }

            // Build provider map
            const providerMap: Record<string, Array<{ id: string; full_name: string; role: string; email: string }>> = {};
            filtered.forEach((service: any) => {
                const masterServices = service.master_services || [];
                const providers = masterServices
                    .map((ms: any) => ms.profiles)
                    .filter((p: any) => p && p.full_name)
                    .map((p: any) => ({
                        id: p.id,
                        full_name: p.full_name,
                        role: p.role,
                        email: p.email,
                    }));
                providerMap[service.id] = providers;
            });
            setServiceProviders(providerMap);

            // Strip the master_services join data before setting state
            setServices(filtered.map(({ master_services, ...rest }: any) => rest) as Service[]);
            setServiceDistances({});
        } catch (error) {
            console.error('Error fetching services:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchServices();
    };

    const filteredServices = selectedCategory === 'All'
        ? services
        : services.filter(s => s.category === selectedCategory);

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
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} />
                    }
                    showsVerticalScrollIndicator={false}
                >
                    {/* Category Tabs — underline style */}
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={styles.categoriesScroll}
                        contentContainerStyle={styles.categories}
                    >
                        {CATEGORIES.map((cat) => {
                            const isActive = selectedCategory === cat.label;
                            return (
                                <TouchableOpacity
                                    key={cat.label}
                                    onPress={() => setSelectedCategory(cat.label)}
                                    style={styles.categoryTab}
                                >
                                    <MerakiText style={[
                                        styles.categoryText,
                                        isActive && styles.categoryTextActive,
                                    ]}>
                                        {cat.label}
                                    </MerakiText>
                                    {isActive && <View style={styles.categoryUnderline} />}
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>

                    {/* Services List */}
                    <View style={styles.servicesSection}>
                        <MerakiText style={styles.sectionLabel}>
                            {filteredServices.length} {filteredServices.length === 1 ? 'service' : 'services'} available
                        </MerakiText>

                        {filteredServices.length > 0 ? (
                            <View style={styles.servicesGrid}>
                                {filteredServices.map((service) => {
                                    const gradient = getCategoryGradient(service.category);
                                    const iconColor = getCategoryIconColor(service.category);
                                    const iconName = getCategoryMaterialIcon(service.category);

                                    return (
                                        <TouchableOpacity
                                            key={service.id}
                                            onPress={() => navigation.navigate('ServiceDetail', { serviceId: service.id })}
                                            activeOpacity={0.85}
                                            style={styles.serviceCardWrapper}
                                        >
                                            <View style={styles.serviceCard}>
                                                {/* Blurred background image (when available) */}
                                                {(service as any).image_url && (
                                                    <Image
                                                        source={{ uri: (service as any).image_url }}
                                                        style={StyleSheet.absoluteFillObject}
                                                        resizeMode="cover"
                                                        blurRadius={20}
                                                    />
                                                )}

                                                {/* Gradient overlay for text readability */}
                                                <LinearGradient
                                                    colors={
                                                        (service as any).image_url
                                                            ? ['rgba(255,255,255,0.88)', 'rgba(255,255,255,0.65)', 'rgba(255,255,255,0.3)']
                                                            : gradient
                                                    }
                                                    start={{ x: 0, y: 0 }}
                                                    end={{ x: 1, y: 0 }}
                                                    style={StyleSheet.absoluteFillObject}
                                                />

                                                {/* Text content */}
                                                <View style={styles.serviceTextContent}>
                                                    <MerakiText style={styles.serviceName} numberOfLines={2}>
                                                        {service.name.toUpperCase()}
                                                    </MerakiText>
                                                    {service.description && (
                                                        <MerakiText style={styles.serviceDescription} numberOfLines={1}>
                                                            {service.description}
                                                        </MerakiText>
                                                    )}

                                                    {(() => {
                                                        const providers = serviceProviders[service.id] || [];
                                                        if (providers.length === 0) return null;
                                                        
                                                        const getDisplayName = (m: any) => {
                                                            const name = m.full_name?.trim();
                                                            if (name && name.toLowerCase() !== 'owner' && name.toLowerCase() !== 'master') {
                                                                return name;
                                                            }
                                                            if (m.email) {
                                                                return m.email.split('@')[0];
                                                            }
                                                            return name || 'Professional';
                                                        };
                                                        
                                                        const primaryName = getDisplayName(providers[0]);
                                                        const label = providers.length === 1
                                                            ? `By ${primaryName}`
                                                            : `By ${primaryName} & ${providers.length - 1} other${providers.length > 2 ? 's' : ''}`;
                                                        return (
                                                            <View style={styles.providerContainer}>
                                                                <MaterialIcons name="person" size={12} color="rgba(26, 26, 26, 0.45)" style={{ marginRight: 4 }} />
                                                                <MerakiText style={styles.providerText} numberOfLines={1}>
                                                                    {label}
                                                                </MerakiText>
                                                            </View>
                                                        );
                                                    })()}
                                                    <View style={styles.serviceMeta}>
                                                        <MerakiText style={styles.servicePrice}>
                                                            €{service.base_price}
                                                        </MerakiText>
                                                        <MerakiText style={styles.serviceDuration}>
                                                            {service.duration_minutes} min
                                                        </MerakiText>
                                                        {serviceDistances[service.id] != null && (
                                                            <View style={styles.distanceBadge}>
                                                                <MerakiText style={styles.distanceBadgeText}>
                                                                    {serviceDistances[service.id]} km
                                                                </MerakiText>
                                                            </View>
                                                        )}
                                                    </View>
                                                </View>

                                                {/* Sharp thumbnail on right side */}
                                                {(service as any).image_url ? (
                                                    <Image
                                                        source={{ uri: (service as any).image_url }}
                                                        style={styles.serviceImage}
                                                        resizeMode="cover"
                                                    />
                                                ) : (
                                                    <View style={[styles.serviceIconBlock, { backgroundColor: `${iconColor}15` }]}>
                                                        <MaterialIcons name={iconName as any} size={28} color={iconColor} />
                                                    </View>
                                                )}
                                            </View>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        ) : (
                            <View style={styles.emptyState}>
                                <MaterialIcons name="spa" size={56} color="rgba(0,0,0,0.08)" />
                                <MerakiText style={styles.emptyText}>No services available</MerakiText>
                                <MerakiText style={styles.emptySubtext}>Check back soon!</MerakiText>
                            </View>
                        )}
                    </View>
                </ScrollView>
            </SafeAreaView>
        </ScreenBackground>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    scrollContent: {
        paddingBottom: 100,
    },

    // Category Tabs — underline style
    categoriesScroll: {
        marginTop: spacing.sm,
        marginBottom: spacing.md,
    },
    categories: {
        paddingHorizontal: spacing.lg,
        gap: 24,
    },
    categoryTab: {
        paddingBottom: 8,
        alignItems: 'center',
    },
    categoryText: {
        fontSize: 14,
        fontWeight: '500',
        color: 'rgba(0,0,0,0.35)',
    },
    categoryTextActive: {
        color: '#1A1A1A',
        fontWeight: '700',
    },
    categoryUnderline: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 2,
        backgroundColor: '#1A1A1A',
        borderRadius: 1,
    },

    // Services Section
    servicesSection: {
        paddingHorizontal: spacing.lg,
    },
    sectionLabel: {
        fontSize: 13,
        color: 'rgba(0,0,0,0.35)',
        marginBottom: spacing.md,
        fontWeight: '500',
    },
    servicesGrid: {
        gap: 12,
    },

    // Service Card — Academy-style pastel gradient banner
    serviceCardWrapper: {
        borderRadius: 16,
        backgroundColor: '#FFFFFF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
        elevation: 6,
        marginBottom: 8,
    },
    serviceCard: {
        flexDirection: 'row',
        alignItems: 'stretch',
        minHeight: 100,
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.08)',
    },
    serviceTextContent: {
        flex: 1,
        paddingVertical: 16,
        paddingLeft: 20,
        paddingRight: 12,
        justifyContent: 'center',
    },
    serviceName: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1A1A1A',
        letterSpacing: 0.3,
        marginBottom: 4,
    },
    serviceDescription: {
        fontSize: 11,
        color: 'rgba(26, 26, 26, 0.45)',
        fontWeight: '400',
        marginBottom: 4,
    },
    providerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    providerText: {
        fontSize: 11,
        color: 'rgba(26, 26, 26, 0.45)',
        fontWeight: '500',
    },
    serviceMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    servicePrice: {
        fontSize: 14,
        fontWeight: '700',
        color: '#1A1A1A',
    },
    serviceDuration: {
        fontSize: 11,
        color: 'rgba(26, 26, 26, 0.45)',
        fontWeight: '500',
    },
    distanceBadge: {
        backgroundColor: 'rgba(139, 92, 246, 0.1)',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: 'rgba(139, 92, 246, 0.2)',
    },
    distanceBadgeText: {
        fontSize: 10,
        color: '#7C3AED',
        fontWeight: '700',
    },
    serviceImage: {
        width: 120,
        minHeight: 100,
    },
    serviceIconBlock: {
        width: 80,
        minHeight: 100,
        alignItems: 'center',
        justifyContent: 'center',
    },

    // Empty State
    emptyState: {
        alignItems: 'center',
        paddingVertical: 60,
    },
    emptyText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#1A1A1A',
        marginTop: 16,
        marginBottom: 4,
    },
    emptySubtext: {
        fontSize: 14,
        color: 'rgba(0,0,0,0.4)',
    },
});

export default BookingScreen;
