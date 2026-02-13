import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../lib/supabase';
import { Card, ScreenBackground } from '../../components/ui';
import { colors, spacing } from '../../theme';
import { Service } from '../../types/database';

type BookingStackParamList = {
    BookingMain: undefined;
    ServiceDetail: { serviceId: string };
    SelectDateTime: { serviceId: string; masterId: string };
    BookingConfirm: { serviceId: string; masterId: string; dateTime: string };
};

type BookingScreenProps = {
    navigation: NativeStackNavigationProp<BookingStackParamList, 'BookingMain'>;
};

const CATEGORIES = [
    { label: 'All', icon: '✨' },
    { label: 'Nails', icon: '💅' },
    { label: 'Lashes', icon: '👁️' },
    { label: 'Brows', icon: '✨' },
];

export function BookingScreen({ navigation }: BookingScreenProps) {
    const [services, setServices] = useState<Service[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState('All');

    useEffect(() => {
        fetchServices();
    }, []);

    const fetchServices = async () => {
        try {
            // Only fetch services that are active AND have at least one available master
            const { data } = await supabase
                .from('services')
                .select('*, master_services!inner(is_available)')
                .eq('is_active', true)
                .eq('master_services.is_available', true)
                .order('name');

            // Cast data to ensure it fits Service[] state, ignoring the extra master_services property
            setServices((data as any) || []);
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

    const getCategoryIcon = (category: string | null) => {
        switch (category) {
            case 'Nails': return '💅';
            case 'Lashes': return '👁️';
            case 'Brows': return '✨';
            default: return '💅';
        }
    };

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
                >
                    {/* Header */}


                    {/* Category Filter */}
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={styles.categoriesScroll}
                        contentContainerStyle={styles.categories}
                    >
                        {CATEGORIES.map((cat) => (
                            <TouchableOpacity
                                key={cat.label}
                                onPress={() => setSelectedCategory(cat.label)}
                                style={[
                                    styles.categoryChip,
                                    selectedCategory === cat.label && styles.categoryChipActive,
                                ]}
                            >
                                <Text style={styles.categoryIcon}>{cat.icon}</Text>
                                <Text style={[
                                    styles.categoryText,
                                    selectedCategory === cat.label && styles.categoryTextActive,
                                ]}>
                                    {cat.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>

                    {/* Services List */}
                    <View style={styles.servicesSection}>
                        <Text style={styles.sectionLabel}>
                            {filteredServices.length} {filteredServices.length === 1 ? 'service' : 'services'} available
                        </Text>

                        {filteredServices.length > 0 ? (
                            filteredServices.map((service) => (
                                <TouchableOpacity
                                    key={service.id}
                                    onPress={() => navigation.navigate('ServiceDetail', { serviceId: service.id })}
                                    activeOpacity={0.8}
                                >
                                    <Card style={styles.serviceCard} variant="glass">
                                        <View style={styles.serviceIcon}>
                                            <Text style={styles.serviceEmoji}>{getCategoryIcon(service.category)}</Text>
                                        </View>
                                        <View style={styles.serviceInfo}>
                                            <Text style={styles.serviceName}>{service.name}</Text>
                                            {service.description && (
                                                <Text style={styles.serviceDescription} numberOfLines={2}>
                                                    {service.description}
                                                </Text>
                                            )}
                                            <View style={styles.serviceMeta}>
                                                <Text style={styles.servicePrice}>€{service.base_price}</Text>
                                                <Text style={styles.serviceDuration}>
                                                    {service.duration_minutes} min
                                                </Text>
                                            </View>
                                        </View>
                                        <Text style={styles.chevron}>›</Text>
                                    </Card>
                                </TouchableOpacity>
                            ))
                        ) : (
                            <View style={styles.emptyState}>
                                <Text style={styles.emptyIcon}>💅</Text>
                                <Text style={styles.emptyText}>No services available</Text>
                                <Text style={styles.emptySubtext}>Check back soon!</Text>
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

    categoriesScroll: {
        marginTop: spacing.md,
        marginBottom: spacing.md,
    },
    categories: {
        paddingHorizontal: spacing.lg,
        gap: spacing.sm,
    },
    categoryChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: 20,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        gap: spacing.xs,
    },
    categoryChipActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    categoryIcon: { fontSize: 14 },
    categoryText: {
        fontSize: 14,
        color: colors.textSecondary,
        fontWeight: '500',
    },
    categoryTextActive: {
        color: colors.text,
        fontWeight: '600',
    },
    servicesSection: {
        paddingHorizontal: spacing.lg,
    },
    sectionLabel: {
        fontSize: 13,
        color: colors.textMuted,
        marginBottom: spacing.md,
    },
    serviceCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.md,
        marginBottom: spacing.sm,
    },
    serviceIcon: {
        width: 50,
        height: 50,
        borderRadius: 12,
        backgroundColor: 'rgba(200, 160, 77, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: spacing.md,
    },
    serviceEmoji: {
        fontSize: 24,
    },
    serviceInfo: {
        flex: 1,
    },
    serviceName: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.text,
        marginBottom: 4,
    },
    serviceDescription: {
        fontSize: 13,
        color: colors.textSecondary,
        marginBottom: spacing.sm,
        lineHeight: 18,
    },
    serviceMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    servicePrice: {
        fontSize: 16,
        fontWeight: '700',
        color: colors.primary,
    },
    serviceDuration: {
        fontSize: 13,
        color: colors.textMuted,
    },
    chevron: {
        fontSize: 24,
        color: colors.textMuted,
        marginLeft: spacing.sm,
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: spacing.xxxl,
    },
    emptyIcon: {
        fontSize: 64,
        marginBottom: spacing.lg,
        opacity: 0.5,
    },
    emptyText: {
        fontSize: 18,
        fontWeight: '600',
        color: colors.text,
        marginBottom: spacing.sm,
    },
    emptySubtext: {
        fontSize: 14,
        color: colors.textSecondary,
    },
});

export default BookingScreen;
