import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    ActivityIndicator,
    RefreshControl,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { Button, Card, ScreenBackground, MerakiText } from '../../components/ui';
import { colors, spacing } from '../../theme';
import { TouchableOpacity } from 'react-native';
import { useHideTabBar } from '../../hooks/useHideTabBar';

type ConsultationStatus = 'pending' | 'approved' | 'declined' | 'chat_requested';

interface ConsultationData {
    id: string;
    client_id: string;
    service_id: string;
    master_id: string | null;
    had_before: boolean;
    how_long_ago: string | null;
    was_my_work: boolean | null;
    additional_notes: string | null;
    photo_urls: string[] | null;
    status: ConsultationStatus;
    master_notes: string | null;
    responded_at: string | null;
    approval_expires_at: string | null;
    created_at: string | null;
}

const STATUS_CONFIG: Record<ConsultationStatus, {
    icon: string;
    title: string;
    description: string;
    color: string;
    bgColor: string;
}> = {
    pending: {
        icon: 'hourglass-top',
        title: 'Awaiting Review',
        description: 'Your consultation request has been submitted. The specialist will review your answers and respond shortly.',
        color: '#F59E0B',
        bgColor: 'rgba(245, 158, 11, 0.1)',
    },
    approved: {
        icon: 'check-circle',
        title: 'Approved!',
        description: 'Great news! Your consultation has been approved. You can now proceed to book your appointment.',
        color: '#10B981',
        bgColor: 'rgba(16, 185, 129, 0.1)',
    },
    declined: {
        icon: 'cancel',
        title: 'Not Approved',
        description: 'Unfortunately, the specialist has decided not to proceed at this time. Please see their notes below.',
        color: '#EF4444',
        bgColor: 'rgba(239, 68, 68, 0.1)',
    },
    chat_requested: {
        icon: 'chat',
        title: 'Chat Requested',
        description: 'The specialist would like to discuss your needs further before proceeding. Please check your messages.',
        color: '#8B5CF6',
        bgColor: 'rgba(139, 92, 246, 0.1)',
    },
};

export function ConsultationWaitingScreen() {
    useHideTabBar();
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const { consultationId, serviceId, masterId } = route.params || {};

    const [consultation, setConsultation] = useState<ConsultationData | null>(null);
    const [serviceName, setServiceName] = useState('');
    const [masterName, setMasterName] = useState('');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchConsultation = useCallback(async () => {
        try {
            // Fetch consultation
            const { data: consultData, error: consultError } = await supabase
                .from('booking_consultations')
                .select('*')
                .eq('id', consultationId)
                .single();

            if (consultError) throw consultError;
            setConsultation(consultData);

            // Fetch service name
            if (serviceId) {
                const { data: svcData } = await supabase
                    .from('services')
                    .select('name')
                    .eq('id', serviceId)
                    .single();
                if (svcData) setServiceName(svcData.name);
            }

            // Fetch master name
            const mId = masterId || consultData?.master_id;
            if (mId) {
                const { data: masterData } = await supabase
                    .from('profiles')
                    .select('full_name')
                    .eq('id', mId)
                    .single();
                if (masterData) setMasterName(masterData.full_name || 'Specialist');
            }
        } catch (error) {
            console.error('Error fetching consultation:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [consultationId, serviceId, masterId]);

    useEffect(() => {
        fetchConsultation();
    }, [fetchConsultation]);

    // Auto-refresh when screen is focused
    useFocusEffect(
        useCallback(() => {
            fetchConsultation();

            // Poll every 15 seconds for status updates
            const interval = setInterval(fetchConsultation, 15000);
            return () => clearInterval(interval);
        }, [fetchConsultation])
    );

    const onRefresh = () => {
        setRefreshing(true);
        fetchConsultation();
    };

    const handleContinueBooking = () => {
        if (masterId) {
            navigation.navigate('SelectDateTime', {
                serviceId,
                masterId,
            });
        }
    };

    const handleGoToMessages = () => {
        // Navigate to messages tab
        navigation.navigate('Messages');
    };

    const handleGoBack = () => {
        navigation.goBack();
    };

    if (loading) {
        return (
            <ScreenBackground>
                <SafeAreaView style={styles.container}>
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={colors.primary} />
                        <MerakiText variant="caption" color={colors.textSecondary} style={{ marginTop: spacing.md }}>
                            Loading consultation...
                        </MerakiText>
                    </View>
                </SafeAreaView>
            </ScreenBackground>
        );
    }

    if (!consultation) {
        return (
            <ScreenBackground>
                <SafeAreaView style={styles.container}>
                    <View style={styles.header}>
                        <TouchableOpacity onPress={handleGoBack} style={styles.backButton}>
                            <MaterialIcons name="arrow-back" size={22} color="rgba(0, 0, 0, 0.55)" />
                        </TouchableOpacity>
                    </View>
                    <View style={styles.loadingContainer}>
                        <MerakiText variant="body" color={colors.textSecondary}>
                            Consultation not found
                        </MerakiText>
                    </View>
                </SafeAreaView>
            </ScreenBackground>
        );
    }

    const statusConfig = STATUS_CONFIG[consultation.status];

    return (
        <ScreenBackground>
            <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            tintColor={colors.primary}
                        />
                    }
                >
                    {/* Header */}
                    <View style={styles.header}>
                        <TouchableOpacity onPress={handleGoBack} style={styles.backButton}>
                            <MaterialIcons name="arrow-back" size={22} color="rgba(0, 0, 0, 0.55)" />
                        </TouchableOpacity>
                    </View>

                    {/* Status Hero */}
                    <View style={styles.statusHero}>
                        <View style={[styles.statusIconWrap, { backgroundColor: statusConfig.bgColor }]}>
                            <MaterialIcons
                                name={statusConfig.icon as any}
                                size={48}
                                color={statusConfig.color}
                            />
                        </View>
                        <MerakiText variant="h1" style={styles.statusTitle}>
                            {statusConfig.title}
                        </MerakiText>
                        <MerakiText variant="body" color={colors.textSecondary} style={styles.statusDescription}>
                            {statusConfig.description}
                        </MerakiText>

                        {consultation.status === 'pending' && (
                            <View style={styles.pulseIndicator}>
                                <ActivityIndicator size="small" color="#F59E0B" />
                                <MerakiText variant="caption" color="#F59E0B" style={{ marginLeft: spacing.sm }}>
                                    Auto-refreshing...
                                </MerakiText>
                            </View>
                        )}
                    </View>

                    {/* Service Info */}
                    <Card style={styles.infoCard}>
                        <View style={styles.infoRow}>
                            <MaterialIcons name="spa" size={18} color={colors.primary} />
                            <View style={{ flex: 1 }}>
                                <MerakiText variant="caption" color={colors.textMuted}>Service</MerakiText>
                                <MerakiText variant="body" color={colors.text}>{serviceName || 'Loading...'}</MerakiText>
                            </View>
                        </View>
                        {masterName && (
                            <View style={[styles.infoRow, { marginTop: spacing.md }]}>
                                <MaterialIcons name="person" size={18} color={colors.primary} />
                                <View style={{ flex: 1 }}>
                                    <MerakiText variant="caption" color={colors.textMuted}>Specialist</MerakiText>
                                    <MerakiText variant="body" color={colors.text}>{masterName}</MerakiText>
                                </View>
                            </View>
                        )}
                        <View style={[styles.infoRow, { marginTop: spacing.md }]}>
                            <MaterialIcons name="schedule" size={18} color={colors.primary} />
                            <View style={{ flex: 1 }}>
                                <MerakiText variant="caption" color={colors.textMuted}>Submitted</MerakiText>
                                <MerakiText variant="body" color={colors.text}>
                                    {consultation.created_at
                                        ? new Date(consultation.created_at).toLocaleDateString('en-US', {
                                            month: 'short',
                                            day: 'numeric',
                                            year: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit',
                                        })
                                        : 'Unknown'}
                                </MerakiText>
                            </View>
                        </View>
                    </Card>

                    {/* Your Answers */}
                    <Card style={styles.answersCard}>
                        <MerakiText variant="body" color={colors.text} style={{ fontWeight: '600', marginBottom: spacing.md }}>
                            Your Answers
                        </MerakiText>

                        <View style={styles.answerRow}>
                            <MerakiText variant="caption" color={colors.textMuted}>Had this service before?</MerakiText>
                            <MerakiText variant="body" color={colors.text}>
                                {consultation.had_before ? 'Yes' : 'No'}
                            </MerakiText>
                        </View>

                        {consultation.had_before && consultation.how_long_ago && (
                            <View style={styles.answerRow}>
                                <MerakiText variant="caption" color={colors.textMuted}>How long ago?</MerakiText>
                                <MerakiText variant="body" color={colors.text}>
                                    {consultation.how_long_ago}
                                </MerakiText>
                            </View>
                        )}

                        {consultation.had_before && consultation.was_my_work !== null && (
                            <View style={styles.answerRow}>
                                <MerakiText variant="caption" color={colors.textMuted}>Was it this specialist's work?</MerakiText>
                                <MerakiText variant="body" color={colors.text}>
                                    {consultation.was_my_work ? 'Yes' : 'No'}
                                </MerakiText>
                            </View>
                        )}

                        {consultation.additional_notes && (
                            <View style={styles.answerRow}>
                                <MerakiText variant="caption" color={colors.textMuted}>Additional notes</MerakiText>
                                <MerakiText variant="body" color={colors.text}>
                                    {consultation.additional_notes}
                                </MerakiText>
                            </View>
                        )}
                    </Card>

                    {/* Master Notes (if responded) */}
                    {consultation.master_notes && (
                        <Card style={styles.masterNotesCard}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
                                <MaterialIcons name="comment" size={18} color={statusConfig.color} />
                                <MerakiText variant="body" color={colors.text} style={{ fontWeight: '600' }}>
                                    Specialist's Response
                                </MerakiText>
                            </View>
                            <MerakiText variant="body" color={colors.textSecondary}>
                                {consultation.master_notes}
                            </MerakiText>
                            {consultation.responded_at && (
                                <MerakiText variant="caption" color={colors.textMuted} style={{ marginTop: spacing.sm }}>
                                    Responded {new Date(consultation.responded_at).toLocaleDateString('en-US', {
                                        month: 'short',
                                        day: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                    })}
                                </MerakiText>
                            )}
                        </Card>
                    )}

                    {/* Approval Expiry Notice */}
                    {consultation.status === 'approved' && consultation.approval_expires_at && (
                        <View style={styles.expiryNotice}>
                            <MaterialIcons name="info-outline" size={16} color="#F59E0B" />
                            <MerakiText variant="caption" color="#F59E0B" style={{ flex: 1, marginLeft: spacing.sm }}>
                                This approval expires on {new Date(consultation.approval_expires_at).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric',
                                })}. Book before then!
                            </MerakiText>
                        </View>
                    )}
                </ScrollView>

                {/* Bottom Actions */}
                <View style={styles.bottomBar}>
                    {consultation.status === 'approved' && (
                        <Button
                            title="Continue to Booking"
                            onPress={handleContinueBooking}
                            fullWidth
                        />
                    )}
                    {consultation.status === 'chat_requested' && (
                        <Button
                            title="Open Messages"
                            onPress={handleGoToMessages}
                            fullWidth
                        />
                    )}
                    {consultation.status === 'pending' && (
                        <Button
                            title="Back to Services"
                            onPress={handleGoBack}
                            fullWidth
                            variant="outline"
                        />
                    )}
                    {consultation.status === 'declined' && (
                        <Button
                            title="Browse Other Services"
                            onPress={handleGoBack}
                            fullWidth
                            variant="outline"
                        />
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
    scrollContent: {
        paddingBottom: 100,
    },
    header: {
        padding: spacing.lg,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(0, 0, 0, 0.03)',
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.06)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    statusHero: {
        alignItems: 'center',
        paddingHorizontal: spacing.xl,
        paddingBottom: spacing.xl,
    },
    statusIconWrap: {
        width: 96,
        height: 96,
        borderRadius: 48,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.lg,
    },
    statusTitle: {
        textAlign: 'center',
        marginBottom: spacing.sm,
    },
    statusDescription: {
        textAlign: 'center',
        lineHeight: 22,
    },
    pulseIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: spacing.lg,
        backgroundColor: 'rgba(245, 158, 11, 0.08)',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: 20,
    },
    infoCard: {
        marginHorizontal: spacing.lg,
        marginBottom: spacing.md,
        padding: spacing.lg,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: spacing.md,
    },
    answersCard: {
        marginHorizontal: spacing.lg,
        marginBottom: spacing.md,
        padding: spacing.lg,
    },
    answerRow: {
        marginBottom: spacing.md,
    },
    masterNotesCard: {
        marginHorizontal: spacing.lg,
        marginBottom: spacing.md,
        padding: spacing.lg,
        borderWidth: 1,
        borderColor: 'rgba(139, 92, 246, 0.2)',
    },
    expiryNotice: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: spacing.lg,
        marginBottom: spacing.md,
        padding: spacing.md,
        backgroundColor: 'rgba(245, 158, 11, 0.08)',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(245, 158, 11, 0.2)',
    },
    bottomBar: {
        padding: spacing.lg,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        backgroundColor: 'transparent',
    },
});

export default ConsultationWaitingScreen;
