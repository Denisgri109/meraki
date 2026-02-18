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
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { Button, Card, ScreenBackground, MerakiText } from '../../components/ui';
import { useModal } from '../../contexts/ModalContext';
import { colors, spacing } from '../../theme';
import { BookingConsultation, Profile, Service } from '../../types/database';

interface ConsultationWithDetails extends BookingConsultation {
    client?: Profile;
    service?: Service;
}

const STATUS_FILTERS = [
    { value: 'all', label: 'All' },
    { value: 'pending', label: 'Pending' },
    { value: 'approved', label: 'Approved' },
    { value: 'chat_requested', label: 'Chat' },
];

export function BookingConsultationReviewScreen() {
    const navigation = useNavigation<any>();
    const { showAlert, showConfirm } = useModal();
    const [consultations, setConsultations] = useState<ConsultationWithDetails[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [statusFilter, setStatusFilter] = useState('pending');
    const [selectedConsultation, setSelectedConsultation] = useState<ConsultationWithDetails | null>(null);
    const [actionLoading, setActionLoading] = useState(false);

    const fetchConsultations = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            let query = (supabase as any)
                .from('booking_consultations')
                .select(`
                    *,
                    client:profiles!booking_consultations_client_id_fkey (
                        id,
                        full_name,
                        avatar_url,
                        email,
                        phone
                    ),
                    service:services (
                        id,
                        name,
                        category,
                        base_price,
                        duration_minutes
                    )
                `)
                .order('created_at', { ascending: false });

            if (statusFilter !== 'all') {
                query = query.eq('status', statusFilter);
            }

            const { data, error } = await query;

            if (error) throw error;
            setConsultations(data || []);
        } catch (error) {
            console.error('Error fetching consultations:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchConsultations();
        }, [statusFilter])
    );

    const onRefresh = () => {
        setRefreshing(true);
        fetchConsultations();
    };

    const handleApprove = async (consultation: ConsultationWithDetails) => {
        setActionLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            // Set approval to expire in 7 days
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 7);

            const { error } = await supabase
                .from('booking_consultations')
                .update({
                    status: 'approved',
                    master_id: user.id,
                    approval_expires_at: expiresAt.toISOString(),
                    responded_at: new Date().toISOString(),
                })
                .eq('id', consultation.id);

            if (error) throw error;

            showAlert(
                'Approved!',
                `Client can now proceed with booking. The approval is valid for 7 days.`,
                'success'
            );

            setSelectedConsultation(null);
            fetchConsultations();
        } catch (error: any) {
            console.error('Error approving consultation:', error);
            showAlert('Error', error.message || 'Failed to approve consultation', 'error');
        } finally {
            setActionLoading(false);
        }
    };

    const handleRequestChat = async (consultation: ConsultationWithDetails) => {
        setActionLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            const { error } = await supabase
                .from('booking_consultations')
                .update({
                    status: 'chat_requested',
                    master_id: user.id,
                    responded_at: new Date().toISOString(),
                })
                .eq('id', consultation.id);

            if (error) throw error;

            showConfirm(
                'Chat Requested',
                'The client has been notified. You can now start a conversation.',
                () => openChatWithClient(consultation),
                {
                    confirmText: 'Open Chat',
                    cancelText: 'Later',
                    type: 'success'
                }
            );

            setSelectedConsultation(null);
            fetchConsultations();
        } catch (error: any) {
            console.error('Error requesting chat:', error);
            showAlert('Error', error.message || 'Failed to request chat', 'error');
        } finally {
            setActionLoading(false);
        }
    };

    const handleDecline = async (consultation: ConsultationWithDetails) => {
        showConfirm(
            'Decline Consultation',
            'Are you sure you want to decline this consultation request?',
            async () => {
                setActionLoading(true);
                try {
                    const { data: { user } } = await supabase.auth.getUser();

                    const { error } = await supabase
                        .from('booking_consultations')
                        .update({
                            status: 'declined',
                            master_id: user?.id,
                            responded_at: new Date().toISOString(),
                        })
                        .eq('id', consultation.id);

                    if (error) throw error;

                    setSelectedConsultation(null);
                    fetchConsultations();
                } catch (error: any) {
                    showAlert('Error', error.message || 'Failed to decline consultation', 'error');
                } finally {
                    setActionLoading(false);
                }
            },
            {
                confirmText: 'Decline',
                cancelText: 'Cancel',
                type: 'error'
            }
        );
    };

    const openChatWithClient = async (consultation: ConsultationWithDetails) => {
        if (!consultation.client) return;

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Find or create conversation
            const { data: existingConv } = await (supabase as any)
                .from('conversations')
                .select('id')
                .or(`and(participant_1.eq.${user.id},participant_2.eq.${consultation.client.id}),and(participant_1.eq.${consultation.client.id},participant_2.eq.${user.id})`)
                .single();

            let conversationId = existingConv?.id;

            if (!conversationId) {
                const { data: newConv } = await (supabase as any)
                    .from('conversations')
                    .insert({
                        participant_1: user.id,
                        participant_2: consultation.client.id,
                    })
                    .select()
                    .single();

                conversationId = newConv?.id;
            }

            if (conversationId) {
                navigation.navigate('MasterChat', {
                    conversationId,
                    otherUser: consultation.client,
                });
            }
        } catch (error) {
            console.error('Error opening chat:', error);
        }
    };

    const getStatusBadge = (status: string) => {
        const badges: Record<string, { bg: string; text: string; label: string }> = {
            pending: { bg: '#FEF3C7', text: '#92400E', label: 'Pending' },
            approved: { bg: '#D1FAE5', text: '#065F46', label: 'Approved' },
            chat_requested: { bg: '#DBEAFE', text: '#1E40AF', label: 'Chat' },
            declined: { bg: '#FEE2E2', text: '#991B1B', label: 'Declined' },
        };
        return badges[status] || badges.pending;
    };

    const renderConsultationCard = (consultation: ConsultationWithDetails) => {
        const statusBadge = getStatusBadge(consultation.status);

        return (
            <TouchableOpacity
                key={consultation.id}
                style={styles.consultationCard}
                onPress={() => setSelectedConsultation(consultation)}
            >
                <View style={styles.cardHeader}>
                    <View style={styles.clientInfo}>
                        {consultation.client?.avatar_url ? (
                            <Image
                                source={{ uri: consultation.client.avatar_url }}
                                style={styles.clientAvatar}
                            />
                        ) : (
                            <View style={styles.clientAvatarPlaceholder}>
                                <Text style={styles.clientAvatarText}>
                                    {consultation.client?.full_name?.[0]?.toUpperCase() || 'C'}
                                </Text>
                            </View>
                        )}
                        <View style={styles.clientDetails}>
                            <Text style={styles.clientName}>
                                {consultation.client?.full_name || 'Client'}
                            </Text>
                            <Text style={styles.serviceName}>
                                {consultation.service?.name || 'Service'}
                            </Text>
                        </View>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: statusBadge.bg }]}>
                        <Text style={[styles.statusBadgeText, { color: statusBadge.text }]}>
                            {statusBadge.label}
                        </Text>
                    </View>
                </View>

                <View style={styles.cardContent}>
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Had before:</Text>
                        <Text style={styles.infoValue}>
                            {consultation.had_before ? 'Yes' : 'No'}
                        </Text>
                    </View>
                    {consultation.had_before && (
                        <>
                            <View style={styles.infoRow}>
                                <Text style={styles.infoLabel}>How long ago:</Text>
                                <Text style={styles.infoValue}>{consultation.how_long_ago}</Text>
                            </View>
                            <View style={styles.infoRow}>
                                <Text style={styles.infoLabel}>Was your work:</Text>
                                <Text style={styles.infoValue}>
                                    {consultation.was_my_work ? 'Yes' : 'No'}
                                </Text>
                            </View>
                        </>
                    )}
                </View>

                {(consultation.photo_urls?.length ?? 0) > 0 && (
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={styles.photoScroll}
                    >
                        {consultation.photo_urls!.map((url, idx) => (
                            <Image key={idx} source={{ uri: url }} style={styles.photoThumb} />
                        ))}
                    </ScrollView>
                )}

                <Text style={styles.timestamp}>
                    {new Date(consultation.created_at || '').toLocaleDateString()}
                </Text>
            </TouchableOpacity>
        );
    };

    const renderDetailModal = () => {
        if (!selectedConsultation) return null;

        return (
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <ScrollView showsVerticalScrollIndicator={false}>
                        <View style={styles.modalHeader}>
                            <MerakiText variant="h2">Consultation Request</MerakiText>
                            <TouchableOpacity
                                onPress={() => setSelectedConsultation(null)}
                                style={styles.closeButton}
                            >
                                <MaterialCommunityIcons name="close" size={20} color={colors.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        {/* Client Info */}
                        <View style={styles.modalSection}>
                            <Text style={styles.sectionTitle}>Client</Text>
                            <View style={styles.clientRow}>
                                {selectedConsultation.client?.avatar_url ? (
                                    <Image
                                        source={{ uri: selectedConsultation.client.avatar_url }}
                                        style={styles.modalAvatar}
                                    />
                                ) : (
                                    <View style={styles.modalAvatarPlaceholder}>
                                        <Text style={styles.modalAvatarText}>
                                            {selectedConsultation.client?.full_name?.[0]?.toUpperCase() || 'C'}
                                        </Text>
                                    </View>
                                )}
                                <View>
                                    <Text style={styles.modalClientName}>
                                        {selectedConsultation.client?.full_name}
                                    </Text>
                                    <Text style={styles.modalClientEmail}>
                                        {selectedConsultation.client?.email}
                                    </Text>
                                </View>
                            </View>
                        </View>

                        {/* Service Info */}
                        <View style={styles.modalSection}>
                            <Text style={styles.sectionTitle}>Service</Text>
                            <Text style={styles.modalServiceName}>
                                {selectedConsultation.service?.name}
                            </Text>
                            <Text style={styles.modalServiceDetails}>
                                €{selectedConsultation.service?.base_price} • {selectedConsultation.service?.duration_minutes} min
                            </Text>
                        </View>

                        {/* Questionnaire */}
                        <View style={styles.modalSection}>
                            <Text style={styles.sectionTitle}>Questionnaire Responses</Text>

                            <View style={styles.answerRow}>
                                <Text style={styles.answerLabel}>Had this service before?</Text>
                                <Text style={styles.answerValue}>
                                    {selectedConsultation.had_before ? 'Yes' : 'No'}
                                </Text>
                            </View>

                            {selectedConsultation.had_before && (
                                <>
                                    <View style={styles.answerRow}>
                                        <Text style={styles.answerLabel}>How long ago?</Text>
                                        <Text style={styles.answerValue}>
                                            {selectedConsultation.how_long_ago}
                                        </Text>
                                    </View>
                                    <View style={styles.answerRow}>
                                        <Text style={styles.answerLabel}>Was it your work?</Text>
                                        <Text style={styles.answerValue}>
                                            {selectedConsultation.was_my_work ? 'Yes' : 'No'}
                                        </Text>
                                    </View>
                                </>
                            )}

                            {selectedConsultation.additional_notes && (
                                <View style={styles.notesBox}>
                                    <Text style={styles.notesLabel}>Additional Notes</Text>
                                    <Text style={styles.notesText}>
                                        {selectedConsultation.additional_notes}
                                    </Text>
                                </View>
                            )}
                        </View>

                        {/* Photos */}
                        {(selectedConsultation.photo_urls?.length ?? 0) > 0 && (
                            <View style={styles.modalSection}>
                                <Text style={styles.sectionTitle}>Photos</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                    {selectedConsultation.photo_urls!.map((url, idx) => (
                                        <Image
                                            key={idx}
                                            source={{ uri: url }}
                                            style={styles.modalPhoto}
                                        />
                                    ))}
                                </ScrollView>
                            </View>
                        )}
                    </ScrollView>

                    {/* Actions */}
                    {selectedConsultation.status === 'pending' && (
                        <View style={styles.actionButtons}>
                            <TouchableOpacity
                                style={styles.declineButton}
                                onPress={() => handleDecline(selectedConsultation)}
                                disabled={actionLoading}
                            >
                                <Text style={styles.declineButtonText}>Decline</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.chatButton}
                                onPress={() => handleRequestChat(selectedConsultation)}
                                disabled={actionLoading}
                            >
                                {actionLoading ? (
                                    <ActivityIndicator color="#fff" size="small" />
                                ) : (
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><MaterialCommunityIcons name="chat-outline" size={16} color="#fff" /><Text style={styles.chatButtonText}>Chat</Text></View>
                                )}
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.approveButton}
                                onPress={() => handleApprove(selectedConsultation)}
                                disabled={actionLoading}
                            >
                                {actionLoading ? (
                                    <ActivityIndicator color="#fff" size="small" />
                                ) : (
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><MaterialCommunityIcons name="check" size={16} color="#fff" /><Text style={styles.approveButtonText}>Approve</Text></View>
                                )}
                            </TouchableOpacity>
                        </View>
                    )}

                    {selectedConsultation.status === 'approved' && (
                        <View style={styles.statusMessage}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <MaterialCommunityIcons name="check-circle" size={16} color={colors.success} />
                                <Text style={styles.statusMessageText}>
                                    Approved on {new Date(selectedConsultation.responded_at || '').toLocaleDateString()}
                                </Text>
                            </View>
                        </View>
                    )}

                    {selectedConsultation.status === 'chat_requested' && (
                        <Button
                            title="Open Chat"
                            onPress={() => openChatWithClient(selectedConsultation)}
                            fullWidth
                        />
                    )}
                </View>
            </View>
        );
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

    return (
        <ScreenBackground>
            <SafeAreaView style={styles.container} edges={['top']}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <MerakiText variant="h2">Booking Consultations</MerakiText>
                    <View style={{ width: 50 }} />
                </View>

                {/* Filter Tabs */}
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.filterContainer}
                    contentContainerStyle={styles.filterContent}
                >
                    {STATUS_FILTERS.map((filter) => (
                        <TouchableOpacity
                            key={filter.value}
                            style={[
                                styles.filterTab,
                                statusFilter === filter.value && styles.filterTabActive
                            ]}
                            onPress={() => setStatusFilter(filter.value)}
                        >
                            <Text style={[
                                styles.filterTabText,
                                statusFilter === filter.value && styles.filterTabTextActive
                            ]}>
                                {filter.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                {/* Consultations List */}
                <ScrollView
                    style={styles.scrollView}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                    }
                    contentContainerStyle={styles.listContent}
                >
                    {consultations.length === 0 ? (
                        <View style={styles.emptyState}>
                            <MaterialCommunityIcons name="clipboard-text-outline" size={48} color={colors.textMuted} style={{ marginBottom: spacing.md }} />
                            <MerakiText variant="h2" style={{ marginBottom: spacing.sm }}>No consultations</MerakiText>
                            <Text style={styles.emptySubtitle}>
                                {statusFilter === 'pending'
                                    ? 'No pending consultation requests at the moment.'
                                    : 'No consultations found with the selected filter.'}
                            </Text>
                        </View>
                    ) : (
                        consultations.map(renderConsultationCard)
                    )}
                </ScrollView>

                {/* Detail Modal */}
                {selectedConsultation && renderDetailModal()}
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
    backBtn: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.05)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: colors.text,
    },
    filterContainer: {
        maxHeight: 50,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    filterContent: {
        paddingHorizontal: spacing.md,
        gap: spacing.sm,
        flexDirection: 'row',
        alignItems: 'center',
    },
    filterTab: {
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.lg,
        borderRadius: 20,
        backgroundColor: colors.surfaceLight,
    },
    filterTabActive: {
        backgroundColor: colors.primary,
    },
    filterTabText: {
        fontSize: 14,
        color: colors.textSecondary,
    },
    filterTabTextActive: {
        color: '#fff',
        fontWeight: '600',
    },
    scrollView: {
        flex: 1,
    },
    listContent: {
        padding: spacing.md,
    },
    consultationCard: {
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: spacing.lg,
        marginBottom: spacing.md,
        borderWidth: 1,
        borderColor: colors.border,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: spacing.md,
    },
    clientInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    clientAvatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        marginRight: spacing.md,
    },
    clientAvatarPlaceholder: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.md,
    },
    clientAvatarText: {
        fontSize: 18,
        fontWeight: '700',
        color: '#fff',
    },
    clientDetails: {},
    clientName: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.text,
    },
    serviceName: {
        fontSize: 13,
        color: colors.textSecondary,
        marginTop: 2,
    },
    statusBadge: {
        paddingVertical: 4,
        paddingHorizontal: 10,
        borderRadius: 12,
    },
    statusBadgeText: {
        fontSize: 12,
        fontWeight: '600',
    },
    cardContent: {
        borderTopWidth: 1,
        borderTopColor: colors.border,
        paddingTop: spacing.md,
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: spacing.xs,
    },
    infoLabel: {
        fontSize: 13,
        color: colors.textSecondary,
    },
    infoValue: {
        fontSize: 13,
        fontWeight: '500',
        color: colors.text,
    },
    photoScroll: {
        marginTop: spacing.md,
    },
    photoThumb: {
        width: 60,
        height: 60,
        borderRadius: 8,
        marginRight: spacing.sm,
    },
    timestamp: {
        fontSize: 11,
        color: colors.textMuted,
        marginTop: spacing.md,
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: spacing.xxl,
    },
    emptyIcon: {
        fontSize: 48,
        marginBottom: spacing.md,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: colors.text,
        marginBottom: spacing.sm,
    },
    emptySubtitle: {
        fontSize: 14,
        color: colors.textSecondary,
        textAlign: 'center',
    },
    modalOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: colors.surface,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '90%',
        padding: spacing.lg,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.lg,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: colors.text,
    },
    closeButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: colors.surfaceLight,
        justifyContent: 'center',
        alignItems: 'center',
    },
    closeButtonText: {
        fontSize: 18,
        color: colors.textSecondary,
    },
    modalSection: {
        marginBottom: spacing.xl,
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: '600',
        color: colors.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: spacing.md,
    },
    clientRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    modalAvatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        marginRight: spacing.md,
    },
    modalAvatarPlaceholder: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.md,
    },
    modalAvatarText: {
        fontSize: 20,
        fontWeight: '700',
        color: '#fff',
    },
    modalClientName: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.text,
    },
    modalClientEmail: {
        fontSize: 13,
        color: colors.textSecondary,
    },
    modalServiceName: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.text,
    },
    modalServiceDetails: {
        fontSize: 14,
        color: colors.textSecondary,
        marginTop: 4,
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
    notesBox: {
        backgroundColor: colors.surfaceLight,
        borderRadius: 12,
        padding: spacing.md,
        marginTop: spacing.md,
    },
    notesLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: colors.textMuted,
        marginBottom: spacing.xs,
    },
    notesText: {
        fontSize: 14,
        color: colors.text,
        lineHeight: 20,
    },
    modalPhoto: {
        width: 120,
        height: 120,
        borderRadius: 12,
        marginRight: spacing.md,
    },
    actionButtons: {
        flexDirection: 'row',
        gap: spacing.sm,
        paddingTop: spacing.lg,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    declineButton: {
        flex: 1,
        paddingVertical: spacing.md,
        borderRadius: 12,
        backgroundColor: colors.surfaceLight,
        alignItems: 'center',
    },
    declineButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.textSecondary,
    },
    chatButton: {
        flex: 1,
        paddingVertical: spacing.md,
        borderRadius: 12,
        backgroundColor: '#3B82F6',
        alignItems: 'center',
    },
    chatButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#fff',
    },
    approveButton: {
        flex: 1,
        paddingVertical: spacing.md,
        borderRadius: 12,
        backgroundColor: '#10B981',
        alignItems: 'center',
    },
    approveButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#fff',
    },
    statusMessage: {
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
        backgroundColor: '#D1FAE5',
        borderRadius: 12,
        marginTop: spacing.md,
    },
    statusMessageText: {
        fontSize: 14,
        color: '#065F46',
        textAlign: 'center',
    },
});

export default BookingConsultationReviewScreen;
