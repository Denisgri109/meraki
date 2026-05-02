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

// Haversine distance in km between two lat/lng points
function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

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
    const userLat = (profile as any)?.latitude || null;
    const userLng = (profile as any)?.longitude || null;
    const searchRadiusKm: number = (profile as any)?.search_radius_km ?? 50;

    const [services, setServices] = useState<Service[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState('All');

    useEffect(() => {
        fetchServices();
    }, [userCountry, userLat, userLng]);

    const fetchServices = async () => {
        try {
            // Fetch services with master country info for filtering
            const { data } = await supabase
                .from('services')
                .select('*, master_services!inner(is_available, profiles:master_id(country, latitude, longitude))')
                .eq('is_active', true)
                .eq('master_services.is_available', true)
                .order('name');

            let filtered = (data as any[]) || [];

            // Country and radius filter: only show services that have at least one master nearby
            if (userCountry) {
                const uCountry = userCountry.toLowerCase().trim();
                filtered = filtered.filter((service: any) => {
                    const masterServices = service.master_services || [];
                    return masterServices.some((ms: any) => {
                        const masterProfile = ms.profiles;
                        if (!masterProfile || !masterProfile.country) return false;
                        if (masterProfile.country.toLowerCase().trim() !== uCountry) return false;

                        if (searchRadiusKm > 0 && userLat && userLng && masterProfile.latitude && masterProfile.longitude) {
                            const dist = haversineDistanceKm(userLat, userLng, masterProfile.latitude, masterProfile.longitude);
                            if (dist > searchRadiusKm) return false;
                        }
                        return true;
                    });
                });
            } else {
                // Must have a known user country to view local booking options
                filtered = [];
            }

            // Strip the master_services join data before setting state
            setServices(filtered.map(({ master_services, ...rest }: any) => rest) as Service[]);
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
                                                    <View style={styles.serviceMeta}>
                                                        <MerakiText style={styles.servicePrice}>
                                                            €{service.base_price}
                                                        </MerakiText>
                                                        <MerakiText style={styles.serviceDuration}>
                                                            {service.duration_minutes} min
                                                        </MerakiText>
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
        marginBottom: 8,
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
