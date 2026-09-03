import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Image,
    Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { Button, Card, ScreenBackground } from '../../components/ui';
import { useAuth } from '../../contexts/AuthContext';
import { useModal } from '../../contexts/ModalContext';
import { PreBookingQuestionnaireModal } from '../../components/booking';
import { colors, spacing } from '../../theme';
import { Service, Profile, BookingConsultation, Tables } from '../../types/database';
import { useHideTabBar } from '../../hooks/useHideTabBar';

type BookingStackParamList = {
    BookingMain: undefined;
    ServiceDetail: { serviceId: string };
    MasterDetail: { masterId: string };
    SelectDateTime: { serviceId: string; masterId: string };
    BookingConfirm: { serviceId: string; masterId: string; dateTime: string; pilatesSessionId?: string };
    ConsultationWaiting: { consultationId: string; serviceId: string; masterId: string };
};

type ServiceDetailScreenProps = {
    navigation: NativeStackNavigationProp<BookingStackParamList, 'ServiceDetail'>;
    route: RouteProp<BookingStackParamList, 'ServiceDetail'>;
};

type PilatesSettings = Tables<'pilates_settings'>;

export function ServiceDetailScreen({ navigation, route }: ServiceDetailScreenProps) {
    useHideTabBar();
    const { serviceId } = route.params;
    const { user, profile } = useAuth();
    const userCountry = profile?.country || null;
    const { showAlert } = useModal();
    const [service, setService] = useState<Service | null>(null);
    const [master, setMaster] = useState<Profile | null>(null);
    const [pilatesSettings, setPilatesSettings] = useState<PilatesSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [checkingConsultation, setCheckingConsultation] = useState(false);
    const [showQuestionnaireModal, setShowQuestionnaireModal] = useState(false);
    const [existingConsultation, setExistingConsultation] = useState<BookingConsultation | null>(null);

    useEffect(() => {
        fetchData();
    }, [serviceId, user?.id, userCountry]);

    const fetchData = async () => {
        try {
            // Fetch service details
            const { data: serviceData } = await supabase
                .from('services')
                .select('*')
                .eq('id', serviceId)
                .single();

            // Fetch masters who offer this specific service (as a reliable source of truth)
            const { data: masterServiceData } = await supabase
                .from('master_services')
                .select(`
                    master_id,
                    custom_price,
                    custom_duration,
                    profiles:master_id (
                        id,
                        full_name,
                        avatar_url,
                        bio,
                        is_master,
                        role,
                        city,
                        country,
                        timezone
                    )
                `)
                .eq('service_id', serviceId)
                .eq('is_available', true);

            // Extract profiles
            let availableMasters = (masterServiceData || [])
                .map((item: any) => item.profiles)
                .filter((profile: any) => profile !== null && profile.id !== user?.id);

            // Country filter: only show masters from the client's country
            if (userCountry) {
                const uCountry = userCountry.toLowerCase().trim();
                availableMasters = availableMasters.filter((m: any) => {
                    return m.country && m.country.toLowerCase().trim() === uCountry;
                });
            }

            let selectedProfile = null;

            if (availableMasters.length > 0) {
                // Logic: 
                // 1. Try to find the creator of the service
                // 2. Fallback to the first available master
                if (serviceData && serviceData.created_by) {
                    selectedProfile = availableMasters.find((m: any) => m.id === serviceData.created_by);
                }

                if (!selectedProfile) {
                    selectedProfile = availableMasters[0];
                }

                setMaster(selectedProfile);
            }

            if (serviceData?.category === 'Pilates') {
                const { data: pilatesData } = await supabase
                    .from('pilates_settings')
                    .select('*')
                    .eq('service_id', serviceData.id)
                    .maybeSingle();

                setPilatesSettings(pilatesData || null);
            }

            setService(serviceData);

            // Check for existing consultation if service requires it
            if (serviceData?.requires_consultation) {
                await checkExistingConsultation(serviceData.id, selectedProfile?.id);
            }
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    const checkExistingConsultation = async (svcId: string, mstId?: string) => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Check for existing pending or approved consultation
            const { data: consultations } = await supabase
                .from('booking_consultations')
                .select('*')
                .eq('client_id', user.id)
                .eq('service_id', svcId)
                .in('status', ['pending', 'approved', 'chat_requested'])
                .order('created_at', { ascending: false })
                .limit(1);

            if (consultations && consultations.length > 0) {
                const consultation = consultations[0];

                // Check if approval has expired
                if (consultation.status === 'approved' && consultation.approval_expires_at) {
                    const expiresAt = new Date(consultation.approval_expires_at);
                    if (expiresAt < new Date()) {
                        // Expired - don't use this consultation
                        setExistingConsultation(null);
                        return;
                    }
                }

                setExistingConsultation(consultation);
            }
        } catch (error) {
            console.error('Error checking existing consultation:', error);
        }
    };

    const handleContinue = async () => {
        if (!master) return;
        if (master.id === user?.id) {
            showAlert('Unavailable', 'You cannot book an appointment with yourself.', 'warning');
            return;
        }

        // Check if service requires consultation
        if (service?.requires_consultation) {
            setCheckingConsultation(true);

            try {
                // Re-check for latest consultation status
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) throw new Error('Not authenticated');

                const { data: consultations } = await supabase
                    .from('booking_consultations')
                    .select('*')
                    .eq('client_id', user.id)
                    .eq('service_id', serviceId)
                    .in('status', ['pending', 'approved', 'chat_requested'])
                    .order('created_at', { ascending: false })
                    .limit(1);

                if (consultations && consultations.length > 0) {
                    const consultation = consultations[0];

                    if (consultation.status === 'approved') {
                        // Check expiry
                        if (consultation.approval_expires_at) {
                            const expiresAt = new Date(consultation.approval_expires_at);
                            if (expiresAt < new Date()) {
                                // Expired - need new consultation
                                setShowQuestionnaireModal(true);
                                return;
                            }
                        }
                        // Approved and not expired - continue to booking
                        navigation.navigate('SelectDateTime', {
                            serviceId,
                            masterId: master.id,
                        });
                    } else {
                        // Pending or chat_requested - go to waiting screen
                        navigation.navigate('ConsultationWaiting', {
                            consultationId: consultation.id,
                            serviceId,
                            masterId: master.id,
                        });
                    }
                } else {
                    // No existing consultation - show questionnaire
                    setShowQuestionnaireModal(true);
                }
            } catch (error) {
                console.error('Error checking consultation:', error);
                showAlert('Error', 'Failed to check consultation status', 'error');
            } finally {
                setCheckingConsultation(false);
            }
        } else {
            // No consultation required - proceed directly
            navigation.navigate('SelectDateTime', {
                serviceId,
                masterId: master.id,
            });
        }
    };

    const handleConsultationSubmitted = (consultationId: string) => {
        setShowQuestionnaireModal(false);

        // Navigate to waiting screen
        navigation.navigate('ConsultationWaiting', {
            consultationId,
            serviceId,
            masterId: master?.id || '',
        });
    };

    const getButtonText = () => {
        if (checkingConsultation) return 'Checking...';

        if (service?.requires_consultation && existingConsultation) {
            if (existingConsultation.status === 'approved') {
                return 'Continue Booking';
            } else if (existingConsultation.status === 'pending') {
                return 'View Consultation Status';
            } else if (existingConsultation.status === 'chat_requested') {
                return 'View Chat Request';
            }
        }

        return 'Continue';
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
            <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
                <ScrollView style={styles.scrollView}>
                    {/* Header */}
                    <View style={styles.header}>
                        <TouchableOpacity
                            accessibilityRole="button"
                            accessibilityLabel="Go back" onPress={() => navigation.goBack()} style={styles.backButton}>
                            <MaterialIcons name="arrow-back" size={22} color="rgba(0, 0, 0, 0.55)" />
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

                        {/* Consultation Required Badge */}
                        {service.requires_consultation && (
                            <View style={styles.consultationBadge}>
                                <MaterialIcons name="description" size={16} color={colors.primary} />
                                <Text style={styles.consultationBadgeText}>
                                    Consultation required before booking
                                </Text>
                            </View>
                        )}

                        {service.category === 'Pilates' && pilatesSettings && (
                            <View style={styles.pilatesCard}>
                                <View style={styles.pilatesRow}>
                                    <MaterialIcons name="fitness-center" size={16} color={colors.primary} />
                                    <Text style={styles.pilatesText}>{pilatesSettings.default_level || 'All levels'}</Text>
                                </View>
                                <View style={styles.pilatesRow}>
                                    <MaterialIcons name="groups" size={16} color={colors.primary} />
                                    <Text style={styles.pilatesText}>Up to {pilatesSettings.default_capacity || 6} clients</Text>
                                </View>
                                <View style={styles.pilatesRow}>
                                    <MaterialIcons name="inventory-2" size={16} color={colors.primary} />
                                    <Text style={styles.pilatesText}>
                                        {pilatesSettings.equipment_provided ? 'Equipment provided' : 'Bring your own equipment'}
                                    </Text>
                                </View>
                                {pilatesSettings.equipment_notes && (
                                    <Text style={styles.pilatesNote}>{pilatesSettings.equipment_notes}</Text>
                                )}
                                {pilatesSettings.location_notes && (
                                    <Text style={styles.pilatesNote}>{pilatesSettings.location_notes}</Text>
                                )}
                            </View>
                        )}
                    </View>

                    {/* Specialist Info (Auto-assigned) */}
                    {master && (
                        <View style={styles.masterSection}>
                            <Text style={styles.sectionTitle}>Your Specialist</Text>
                            <TouchableOpacity
                                onPress={() => navigation.navigate('MasterDetail', { masterId: master.id })}
                                activeOpacity={0.85}
                            >
                                <Card variant="glass" style={styles.masterCard}>
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
                                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingRight: 4 }}>
                                            <Text style={styles.masterName}>
                                                {master.full_name || 'Beauty Master'}
                                            </Text>
                                            <MaterialIcons name="chevron-right" size={20} color="rgba(0, 0, 0, 0.35)" />
                                        </View>
                                        {((master as any).city || (master as any).country) && (
                                            <Text style={styles.masterLocation}>
                                                <MaterialIcons name="location-on" size={12} color={colors.primary} /> {[(master as any).city, (master as any).country].filter(Boolean).join(', ')}
                                            </Text>
                                        )}
                                        {master.bio && (
                                            <Text style={styles.masterBio} numberOfLines={2}>
                                                {master.bio}
                                            </Text>
                                        )}
                                    </View>
                                </Card>
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Fallback if no master found */}
                    {!master && (
                        <View style={styles.masterSection}>
                            <Text style={styles.noMasters}>No specialist currently available for this service.</Text>
                        </View>
                    )}
                </ScrollView>

                {/* Bottom Button */}
                <View style={styles.bottomBar}>
                    <Button
                        title={getButtonText()}
                        onPress={handleContinue}
                        disabled={!master || master.id === user?.id || checkingConsultation}
                        loading={checkingConsultation}
                        fullWidth
                    />
                </View>
            </SafeAreaView>

            {/* Pre-Booking Questionnaire Modal */}
            <PreBookingQuestionnaireModal
                visible={showQuestionnaireModal}
                onClose={() => setShowQuestionnaireModal(false)}
                onSubmit={handleConsultationSubmitted}
                serviceId={serviceId}
                serviceName={service.name}
                masterId={master?.id || null}
            />
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
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: 'rgba(0, 0, 0, 0.03)',
        borderWidth: 1, borderColor: 'rgba(0, 0, 0, 0.06)',
        alignItems: 'center', justifyContent: 'center',
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
    consultationBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        borderRadius: 12,
        padding: spacing.md,
        marginTop: spacing.lg,
        gap: spacing.sm,
    },
    consultationBadgeIcon: {
        fontSize: 18,
    },
    consultationBadgeText: {
        fontSize: 13,
        color: colors.primary,
        fontWeight: '500',
    },
    pilatesCard: {
        backgroundColor: 'rgba(45, 122, 90, 0.08)',
        borderRadius: 16,
        padding: spacing.md,
        marginTop: spacing.lg,
        borderWidth: 1,
        borderColor: 'rgba(45, 122, 90, 0.16)',
        gap: spacing.sm,
    },
    pilatesRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    pilatesText: {
        fontSize: 14,
        color: colors.text,
        fontWeight: '500',
    },
    pilatesNote: {
        fontSize: 13,
        color: colors.textSecondary,
        lineHeight: 20,
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
    masterLocation: {
        fontSize: 13,
        color: colors.textMuted,
        marginBottom: 4,
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
