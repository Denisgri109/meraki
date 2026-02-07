import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Image,
    RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { Button, ScreenBackground } from '../../components/ui';
import { colors, spacing } from '../../theme';
import { BookingConsultation, Profile, Service } from '../../types/database';

type ConsultationWaitingScreenParams = {
    consultationId: string;
    serviceId: string;
    masterId: string;
};

export function ConsultationWaitingScreen() {
    const navigation = useNavigation<any>();
    const route = useRoute<RouteProp<{ params: ConsultationWaitingScreenParams }, 'params'>>();
    const { consultationId, serviceId, masterId } = route.params;

    const [consultation, setConsultation] = useState<BookingConsultation | null>(null);
    const [service, setService] = useState<Service | null>(null);
    const [master, setMaster] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchData = async () => {
        try {
            // Fetch consultation
            const { data: consultationData, error: consultationError } = await supabase
                .from('booking_consultations')
                .select('*')
                .eq('id', consultationId)
                .single();

            if (consultationError) throw consultationError;
            setConsultation(consultationData);

            // Fetch service
            const { data: serviceData } = await supabase
                .from('services')
                .select('*')
                .eq('id', serviceId)
                .single();

            if (serviceData) setService(serviceData);

            // Fetch master if assigned
            if (masterId) {
                const { data: masterData } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', masterId)
                    .single();

                if (masterData) setMaster(masterData);
            }
        } catch (error) {
            console.error('Error fetching consultation:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchData();
        }, [consultationId])
    );

    const onRefresh = () => {
        setRefreshing(true);
        fetchData();
    };

    const handleContinueBooking = () => {
        navigation.navigate('SelectDateTime', {
            serviceId,
            masterId,
        });
    };

    const handleOpenChat = async () => {
        if (!masterId) return;

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Find or create conversation
            const { data: existingConv } = await (supabase as any)
                .from('conversations')
                .select('id')
                .or(`and(participant_1.eq.${user.id},participant_2.eq.${masterId}),and(participant_1.eq.${masterId},participant_2.eq.${user.id})`)
                .single();

            let conversationId = existingConv?.id;

            if (!conversationId) {
                const { data: newConv } = await (supabase as any)
                    .from('conversations')
                    .insert({
                        participant_1: user.id,
                        participant_2: masterId,
                    })
                    .select()
                    .single();

                conversationId = newConv?.id;
            }

            if (conversationId) {
                navigation.navigate('Messages', {
                    screen: 'Chat',
                    params: {
                        conversationId,
                        otherUser: master,
                    },
                });
            }
        } catch (error) {
            console.error('Error opening chat:', error);
        }
    };

    const handleCancel = async () => {
        try {
            await supabase
                .from('booking_consultations')
                .delete()
                .eq('id', consultationId);

            navigation.goBack();
        } catch (error) {
            console.error('Error canceling consultation:', error);
        }
    };

    const getStatusInfo = () => {
        switch (consultation?.status) {
            case 'pending':
                return {
                    icon: '⏳',
                    title: 'Awaiting Review',
                    subtitle: 'Your consultation request is being reviewed. You\'ll be notified when there\'s an update.',
                    color: '#FEF3C7',
                    textColor: '#92400E',
                };
            case 'approved':
                return {
                    icon: '✅',
                    title: 'Approved!',
                    subtitle: 'Great news! You can now complete your booking.',
                    color: '#D1FAE5',
                    textColor: '#065F46',
                };
            case 'chat_requested':
                return {
                    icon: '💬',
                    title: 'Chat Requested',
                    subtitle: 'The professional would like to discuss your consultation before booking.',
                    color: '#DBEAFE',
                    textColor: '#1E40AF',
                };
            case 'declined':
                return {
                    icon: '❌',
                    title: 'Not Available',
                    subtitle: 'Unfortunately, this service cannot be provided at this time.',
                    color: '#FEE2E2',
                    textColor: '#991B1B',
                };
            default:
                return {
                    icon: '⏳',
                    title: 'Processing',
                    subtitle: 'Please wait...',
                    color: '#E5E7EB',
                    textColor: '#374151',
                };
        }
    };

    if (loading) {
        return (
            <ScreenBackground>
                <SafeAreaView style={styles.container}>
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={colors.primary} />
                    </View>
                </SafeAreaView>
            </ScreenBackground>
        );
    }

    const statusInfo = getStatusInfo();

    return (
        <ScreenBackground>
            <SafeAreaView style={styles.container} edges={['top']}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()}>
                        <Text style={styles.backButton}>← Back</Text>
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Consultation Status</Text>
                    <View style={{ width: 50 }} />
                </View>

                <ScrollView
                    style={styles.scrollView}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                    }
                    contentContainerStyle={styles.content}
                >
                    {/* Status Card */}
                    <View style={[styles.statusCard, { backgroundColor: statusInfo.color }]}>
                        <Text style={styles.statusIcon}>{statusInfo.icon}</Text>
                        <Text style={[styles.statusTitle, { color: statusInfo.textColor }]}>
                            {statusInfo.title}
                        </Text>
                        <Text style={[styles.statusSubtitle, { color: statusInfo.textColor }]}>
                            {statusInfo.subtitle}
                        </Text>
                    </View>

                    {/* Service Info */}
                    {service && (
                        <View style={styles.infoCard}>
                            <Text style={styles.sectionTitle}>Service</Text>
                            <Text style={styles.serviceName}>{service.name}</Text>
                            <View style={styles.serviceDetails}>
                                <Text style={styles.serviceDetail}>€{service.base_price}</Text>
                                <Text style={styles.serviceDot}>•</Text>
                                <Text style={styles.serviceDetail}>{service.duration_minutes} min</Text>
                            </View>
                        </View>
                    )}

                    {/* Master Info */}
                    {master && (
                        <View style={styles.infoCard}>
                            <Text style={styles.sectionTitle}>Professional</Text>
                            <View style={styles.masterRow}>
                                {master.avatar_url ? (
                                    <Image source={{ uri: master.avatar_url }} style={styles.masterAvatar} />
                                ) : (
                                    <View style={styles.masterAvatarPlaceholder}>
                                        <Text style={styles.masterAvatarText}>
                                            {master.full_name?.[0]?.toUpperCase() || 'M'}
                                        </Text>
                                    </View>
                                )}
                                <View style={styles.masterInfo}>
                                    <Text style={styles.masterName}>{master.full_name}</Text>
                                    {master.bio && (
                                        <Text style={styles.masterBio} numberOfLines={2}>{master.bio}</Text>
                                    )}
                                </View>
                            </View>
                        </View>
                    )}

                    {/* Your Submission */}
                    {consultation && (
                        <View style={styles.infoCard}>
                            <Text style={styles.sectionTitle}>Your Submission</Text>

                            <View style={styles.answerRow}>
                                <Text style={styles.answerLabel}>Had before:</Text>
                                <Text style={styles.answerValue}>
                                    {consultation.had_before ? 'Yes' : 'No'}
                                </Text>
                            </View>

                            {consultation.had_before && (
                                <>
                                    <View style={styles.answerRow}>
                                        <Text style={styles.answerLabel}>How long ago:</Text>
                                        <Text style={styles.answerValue}>{consultation.how_long_ago}</Text>
                                    </View>
                                    <View style={styles.answerRow}>
                                        <Text style={styles.answerLabel}>Was their work:</Text>
                                        <Text style={styles.answerValue}>
                                            {consultation.was_my_work ? 'Yes' : 'No'}
                                        </Text>
                                    </View>
                                </>
                            )}

                            {consultation.photo_urls.length > 0 && (
                                <View style={styles.photosSection}>
                                    <Text style={styles.answerLabel}>Photos submitted:</Text>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                        {consultation.photo_urls.map((url, idx) => (
                                            <Image key={idx} source={{ uri: url }} style={styles.submittedPhoto} />
                                        ))}
                                    </ScrollView>
                                </View>
                            )}

                            <Text style={styles.submittedDate}>
                                Submitted: {new Date(consultation.created_at || '').toLocaleDateString()}
                            </Text>
                        </View>
                    )}

                    {/* Master Response */}
                    {consultation?.master_notes && (
                        <View style={styles.infoCard}>
                            <Text style={styles.sectionTitle}>Professional Response</Text>
                            <Text style={styles.masterNotes}>{consultation.master_notes}</Text>
                        </View>
                    )}
                </ScrollView>

                {/* Action Buttons */}
                <View style={styles.footer}>
                    {consultation?.status === 'approved' && (
                        <Button
                            title="Complete Your Booking"
                            onPress={handleContinueBooking}
                            fullWidth
                        />
                    )}

                    {consultation?.status === 'chat_requested' && (
                        <Button
                            title="Open Chat"
                            onPress={handleOpenChat}
                            fullWidth
                        />
                    )}

                    {consultation?.status === 'pending' && (
                        <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
                            <Text style={styles.cancelButtonText}>Cancel Request</Text>
                        </TouchableOpacity>
                    )}
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
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    backButton: {
        fontSize: 16,
        color: colors.primary,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: colors.text,
    },
    scrollView: {
        flex: 1,
    },
    content: {
        padding: spacing.lg,
    },
    statusCard: {
        borderRadius: 16,
        padding: spacing.xl,
        alignItems: 'center',
        marginBottom: spacing.lg,
    },
    statusIcon: {
        fontSize: 48,
        marginBottom: spacing.md,
    },
    statusTitle: {
        fontSize: 22,
        fontWeight: '700',
        marginBottom: spacing.sm,
    },
    statusSubtitle: {
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 20,
    },
    infoCard: {
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: spacing.lg,
        marginBottom: spacing.md,
        borderWidth: 1,
        borderColor: colors.border,
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: '600',
        color: colors.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: spacing.md,
    },
    serviceName: {
        fontSize: 18,
        fontWeight: '600',
        color: colors.text,
        marginBottom: spacing.xs,
    },
    serviceDetails: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    serviceDetail: {
        fontSize: 14,
        color: colors.textSecondary,
    },
    serviceDot: {
        color: colors.textMuted,
        marginHorizontal: spacing.sm,
    },
    masterRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    masterAvatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        marginRight: spacing.md,
    },
    masterAvatarPlaceholder: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.md,
    },
    masterAvatarText: {
        fontSize: 20,
        fontWeight: '700',
        color: '#fff',
    },
    masterInfo: {
        flex: 1,
    },
    masterName: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.text,
    },
    masterBio: {
        fontSize: 13,
        color: colors.textSecondary,
        marginTop: 2,
    },
    answerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: spacing.sm,
    },
    answerLabel: {
        fontSize: 14,
        color: colors.textSecondary,
    },
    answerValue: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.text,
    },
    photosSection: {
        marginTop: spacing.md,
    },
    submittedPhoto: {
        width: 60,
        height: 60,
        borderRadius: 8,
        marginRight: spacing.sm,
        marginTop: spacing.sm,
    },
    submittedDate: {
        fontSize: 12,
        color: colors.textMuted,
        marginTop: spacing.md,
    },
    masterNotes: {
        fontSize: 14,
        color: colors.text,
        lineHeight: 20,
    },
    footer: {
        padding: spacing.lg,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    cancelButton: {
        alignItems: 'center',
        paddingVertical: spacing.md,
    },
    cancelButtonText: {
        fontSize: 14,
        color: colors.textSecondary,
    },
});

export default ConsultationWaitingScreen;
