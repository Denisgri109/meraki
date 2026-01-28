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
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { Button, Card, ScreenBackground } from '../../components/ui';
import { colors, spacing } from '../../theme';
import { Service, Profile } from '../../types/database';

type BookingStackParamList = {
    BookingMain: undefined;
    ServiceDetail: { serviceId: string };
    SelectDateTime: { serviceId: string; masterId: string };
    BookingConfirm: { serviceId: string; masterId: string; dateTime: string };
};

type ServiceDetailScreenProps = {
    navigation: NativeStackNavigationProp<BookingStackParamList, 'ServiceDetail'>;
    route: RouteProp<BookingStackParamList, 'ServiceDetail'>;
};

export function ServiceDetailScreen({ navigation, route }: ServiceDetailScreenProps) {
    const { serviceId } = route.params;
    const [service, setService] = useState<Service | null>(null);
    const [masters, setMasters] = useState<Profile[]>([]);
    const [selectedMaster, setSelectedMaster] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            // Fetch service details
            const { data: serviceData } = await supabase
                .from('services')
                .select('*')
                .eq('id', serviceId)
                .single();

            // Fetch masters and owners who offer services
            const { data: mastersData } = await supabase
                .from('profiles')
                .select('*')
                .or('is_master.eq.true,role.eq.owner')
                .order('full_name');

            setService(serviceData);
            setMasters(mastersData || []);
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleContinue = () => {
        if (selectedMaster) {
            navigation.navigate('SelectDateTime', {
                serviceId,
                masterId: selectedMaster,
            });
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

    if (!service) {
        return (
            <ScreenBackground>
                <SafeAreaView style={styles.container}>
                    <View style={styles.loadingContainer}>
                        <Text style={styles.errorText}>Service not found</Text>
                    </View>
                </SafeAreaView>
            </ScreenBackground>
        );
    }

    return (
        <ScreenBackground>
            <SafeAreaView style={styles.container} edges={['top']}>
                <ScrollView style={styles.scrollView}>
                    {/* Header */}
                    <View style={styles.header}>
                        <TouchableOpacity onPress={() => navigation.goBack()}>
                            <Text style={styles.backButton}>← Back</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Service Info */}
                    <View style={styles.serviceSection}>
                        <Text style={styles.serviceName}>{service.name}</Text>
                        {service.description && (
                            <Text style={styles.serviceDescription}>{service.description}</Text>
                        )}
                        <View style={styles.serviceMeta}>
                            <View style={styles.metaItem}>
                                <Text style={styles.metaLabel}>Price</Text>
                                <Text style={styles.metaValue}>€{service.base_price}</Text>
                            </View>
                            <View style={styles.metaItem}>
                                <Text style={styles.metaLabel}>Duration</Text>
                                <Text style={styles.metaValue}>{service.duration_minutes} min</Text>
                            </View>
                        </View>
                    </View>

                    {/* Select Master */}
                    <View style={styles.masterSection}>
                        <Text style={styles.sectionTitle}>Choose Your Specialist</Text>
                        {masters.length > 0 ? (
                            masters.map((master) => (
                                <TouchableOpacity
                                    key={master.id}
                                    onPress={() => setSelectedMaster(master.id)}
                                >
                                    <Card
                                        variant="glass"
                                        style={[
                                            styles.masterCard,
                                            selectedMaster === master.id ? styles.masterCardSelected : undefined,
                                        ].filter(Boolean) as any}
                                    >
                                        {master.avatar_url ? (
                                            <Image source={{ uri: master.avatar_url }} style={styles.masterAvatarImage} />
                                        ) : (
                                            <View style={styles.masterAvatar}>
                                                <Text style={styles.masterAvatarText}>
                                                    {master.full_name?.[0] || 'M'}
                                                </Text>
                                            </View>
                                        )}
                                        <View style={styles.masterInfo}>
                                            <Text style={styles.masterName}>
                                                {master.full_name || 'Beauty Master'}
                                            </Text>
                                            {master.bio && (
                                                <Text style={styles.masterBio} numberOfLines={2}>
                                                    {master.bio}
                                                </Text>
                                            )}
                                        </View>
                                        <View style={[
                                            styles.radioOuter,
                                            selectedMaster === master.id && styles.radioOuterSelected,
                                        ]}>
                                            {selectedMaster === master.id && (
                                                <View style={styles.radioInner} />
                                            )}
                                        </View>
                                    </Card>
                                </TouchableOpacity>
                            ))
                        ) : (
                            <Text style={styles.noMasters}>No specialists available</Text>
                        )}
                    </View>
                </ScrollView>

                {/* Bottom Button */}
                <View style={styles.bottomBar}>
                    <Button
                        title="Continue"
                        onPress={handleContinue}
                        disabled={!selectedMaster}
                        fullWidth
                    />
                </View>
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
        padding: spacing.lg,
    },
    backButton: {
        color: colors.textSecondary,
        fontSize: 16,
    },
    serviceSection: {
        padding: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    serviceName: {
        fontSize: 28,
        fontWeight: '600',
        color: colors.text,
        marginBottom: spacing.sm,
    },
    serviceDescription: {
        fontSize: 16,
        color: colors.textSecondary,
        lineHeight: 24,
        marginBottom: spacing.lg,
    },
    serviceMeta: {
        flexDirection: 'row',
        gap: spacing.xl,
    },
    metaItem: {},
    metaLabel: {
        fontSize: 12,
        color: colors.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: spacing.xs,
    },
    metaValue: {
        fontSize: 20,
        fontWeight: '600',
        color: colors.text,
    },
    masterSection: {
        padding: spacing.lg,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: colors.text,
        marginBottom: spacing.lg,
    },
    masterCard: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.md,
        borderWidth: 1,
        borderColor: colors.border,
    },
    masterCardSelected: {
        borderColor: colors.primary,
        backgroundColor: colors.primaryLight,
    },
    masterAvatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: colors.surfaceLight,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: spacing.md,
        borderWidth: 1,
        borderColor: colors.border,
    },
    masterAvatarImage: {
        width: 50,
        height: 50,
        borderRadius: 25,
        marginRight: spacing.md,
        borderWidth: 1,
        borderColor: colors.border,
    },
    masterAvatarText: {
        fontSize: 20,
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
        marginBottom: 2,
    },
    masterBio: {
        fontSize: 13,
        color: colors.textSecondary,
    },
    radioOuter: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: colors.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    radioOuterSelected: {
        borderColor: colors.primary,
    },
    radioInner: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: colors.primary,
    },
    noMasters: {
        color: colors.textSecondary,
        fontSize: 14,
        textAlign: 'center',
        padding: spacing.xl,
    },
    bottomBar: {
        padding: spacing.lg,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        backgroundColor: 'transparent',
    },
});

export default ServiceDetailScreen;
