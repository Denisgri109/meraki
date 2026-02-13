import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Image,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { Button, Card, ScreenBackground } from '../../components/ui';
import { colors, spacing } from '../../theme';
import { Service, Profile } from '../../types/database';
import { useSafeBack } from '../../hooks';

type BookingStackParamList = {
    BookingMain: undefined;
    ServiceDetail: { serviceId: string };
    MasterDetail: { masterId: string };
    SelectDateTime: { serviceId: string; masterId: string };
    BookingConfirm: { serviceId: string; masterId: string; dateTime: string };
};

type MasterDetailScreenProps = {
    navigation: NativeStackNavigationProp<BookingStackParamList, 'MasterDetail'>;
    route: RouteProp<BookingStackParamList, 'MasterDetail'>;
};

export function MasterDetailScreen({ navigation, route }: MasterDetailScreenProps) {
    const { masterId } = route.params;
    const [master, setMaster] = useState<Profile | null>(null);
    const [services, setServices] = useState<Service[]>([]);
    const [loading, setLoading] = useState(true);
    const { goBack } = useSafeBack({ fallbackRoute: 'HomeMain' });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            // Fetch master details with city and country
            const { data: masterData } = await supabase
                .from('profiles')
                .select('id, full_name, bio, avatar_url, city, country, timezone')
                .eq('id', masterId)
                .single();

            // Fetch all available services (for now, show all services)
            // Later we can filter by master_services table
            // Fetch services specifically linked to this master
            // This includes both:
            // 1. Global services assigned to them
            // 2. Custom services they created (which are automatically linked)
            const { data: masterServicesData, error: servicesError } = await supabase
                .from('master_services')
                .select(`
                    service:services (
                        id,
                        name,
                        description,
                        category,
                        base_price,
                        duration_minutes,
                        is_active
                    ),
                    custom_price,
                    custom_duration
                `)
                .eq('master_id', masterId)
                .eq('is_available', true);

            if (servicesError) throw servicesError;

            // Transform data to match Service type, prioritizing custom values
            const formattedServices = (masterServicesData || [])
                .map((item: any) => ({
                    ...item.service,
                    base_price: item.custom_price || item.service.base_price,
                    duration_minutes: item.custom_duration || item.service.duration_minutes,
                }))
                .filter(s => s && s.is_active) // Ensure service exists and is active
                .sort((a, b) => a.name.localeCompare(b.name));

            setMaster(masterData as Profile);
            setServices(formattedServices);
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSelectService = (serviceId: string) => {
        navigation.navigate('SelectDateTime', {
            serviceId,
            masterId,
        });
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.text} />
                </View>
            </SafeAreaView>
        );
    }

    if (!master) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <Text style={styles.errorText}>Master not found</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <ScreenBackground>
            <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
                <ScrollView style={styles.scrollView}>
                    {/* Header */}
                    <View style={styles.header}>
                        <TouchableOpacity onPress={goBack} style={styles.backButton}>
                            <MaterialIcons name="arrow-back" size={22} color="rgba(255,255,255,0.7)" />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>Master Profile</Text>
                        <View style={{ width: 40 }} />
                    </View>

                    {/* Master Info */}
                    <View style={styles.masterSection}>
                        {master.avatar_url ? (
                            <Image source={{ uri: master.avatar_url }} style={styles.masterAvatarImage} />
                        ) : (
                            <View style={styles.masterAvatar}>
                                <Text style={styles.masterAvatarText}>
                                    {master.full_name?.[0] || 'M'}
                                </Text>
                            </View>
                        )}
                        <Text style={styles.masterName}>{master.full_name || 'Beauty Master'}</Text>
                        {(master.city || master.country) && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                <MaterialIcons name="location-on" size={14} color={colors.primary} />
                                <Text style={styles.masterLocation}>
                                    {[master.city, master.country].filter(Boolean).join(', ')}
                                </Text>
                            </View>
                        )}
                        {master.bio && (
                            <Text style={styles.masterBio}>{master.bio}</Text>
                        )}
                    </View>
                    {/* Services */}
                    <View style={styles.servicesSection}>
                        <Text style={styles.sectionTitle}>Available Services</Text>
                        {services.length > 0 ? (
                            services.map((service) => (
                                <TouchableOpacity
                                    key={service.id}
                                    onPress={() => handleSelectService(service.id)}
                                >
                                    <Card variant="glass" style={styles.serviceCard}>
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
                                        <MaterialIcons name="chevron-right" size={24} color={colors.textSecondary} />
                                    </Card>
                                </TouchableOpacity>
                            ))
                        ) : (
                            <Text style={styles.noServices}>No services available</Text>
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
    errorText: {
        color: colors.textSecondary,
        fontSize: 16,
    },
    scrollView: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
    },
    backButton: {
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
        alignItems: 'center', justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 17, fontWeight: '600', color: '#fff',
    },
    masterSection: {
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.xl,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    masterAvatar: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: colors.surfaceLight,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.md,
    },
    masterAvatarImage: {
        width: 100,
        height: 100,
        borderRadius: 50,
        marginBottom: spacing.md,
        borderWidth: 2,
        borderColor: colors.primary,
    },
    masterAvatarText: {
        fontSize: 40,
        fontWeight: '600',
        color: colors.text,
    },
    masterName: {
        fontSize: 28,
        fontWeight: '600',
        color: colors.text,
        marginBottom: spacing.sm,
    },
    masterBio: {
        fontSize: 14,
        color: colors.textSecondary,
        textAlign: 'center',
        lineHeight: 20,
    },
    masterLocation: {
        fontSize: 14,
        color: colors.textSecondary,
        marginBottom: spacing.sm,
    },
    servicesSection: {
        padding: spacing.lg,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: colors.text,
        marginBottom: spacing.lg,
    },
    serviceCard: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    serviceInfo: {
        flex: 1,
    },
    serviceName: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.text,
        marginBottom: spacing.xs,
    },
    serviceDescription: {
        fontSize: 13,
        color: colors.textSecondary,
        marginBottom: spacing.sm,
    },
    serviceMeta: {
        flexDirection: 'row',
        gap: spacing.md,
    },
    servicePrice: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.text,
    },
    serviceDuration: {
        fontSize: 13,
        color: colors.textSecondary,
    },
    chevron: {
        fontSize: 24,
        color: colors.textSecondary,
    },
    noServices: {
        color: colors.textSecondary,
        fontSize: 14,
        textAlign: 'center',
        padding: spacing.xl,
    },
});

export default MasterDetailScreen;
