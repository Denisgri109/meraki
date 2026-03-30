import React, { useState, useCallback } from 'react';
import {
    View,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Image,
    RefreshControl,
    Dimensions,
    Modal,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../lib/supabase';
import { Card, ScreenBackground, MerakiText } from '../../components/ui';
import { useModal } from '../../contexts/ModalContext';
import { colors, spacing, layout } from '../../theme';
import { BookingConsultation, Profile, Service } from '../../types/database';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface ConsultationWithDetails extends BookingConsultation {
    client?: Profile;
    service?: Service;
}

const STATUS_FILTERS = [
    { value: 'all', label: 'All', icon: 'format-list-bulleted' },
    { value: 'pending', label: 'Pending', icon: 'clock-outline' },
    { value: 'approved', label: 'Approved', icon: 'check-circle-outline' },
    { value: 'chat_requested', label: 'Chat', icon: 'chat-outline' },
];

const STATUS_CONFIG: Record<string, { gradient: [string, string]; icon: string; label: string }> = {
    pending: { gradient: ['#D29922', '#B8860B'], icon: 'clock-outline', label: 'Pending' },
    approved: { gradient: ['#3FB950', '#2EA043'], icon: 'check-circle', label: 'Approved' },
    chat_requested: { gradient: ['#58A6FF', '#388BFD'], icon: 'chat-processing', label: 'Chat Requested' },
    declined: { gradient: ['#F85149', '#DA3633'], icon: 'close-circle', label: 'Declined' },
};

export function BookingConsultationReviewScreen() {
    const navigation = useNavigation<any>();
    const { showAlert, showConfirm } = useModal();
    const [consultations, setConsultations] = useState<ConsultationWithDetails[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [statusFilter, setStatusFilter] = useState('pending');
    const [selectedConsultation, setSelectedConsultation] = useState<ConsultationWithDetails | null>(null);
    const [actionLoading, setActionLoading] = useState(false);
    const [fullScreenPhoto, setFullScreenPhoto] = useState<string | null>(null);

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

            // Mark as viewed so dashboard badge resets
            await AsyncStorage.setItem('last_consultations_view', new Date().toISOString());
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

    // Send push notification to client
    const notifyClient = async (clientId: string, title: string, body: string, data?: Record<string, any>) => {
        try {
            const { data: clientProfile } = await supabase
                .from('profiles')
                .select('push_token')
                .eq('id', clientId)
                .single();

            const pushToken = clientProfile?.push_token;
            if (!pushToken) return;

            await fetch('https://exp.host/--/api/v2/push/send', {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    to: pushToken,
                    sound: 'default',
                    title,
                    body,
                    data: { type: 'consultation_response', ...data },
                }),
            });
        } catch (e) {
            console.error('Failed to send client notification:', e);
        }
    };

    const handleApprove = async (consultation: ConsultationWithDetails) => {
        setActionLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

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

            // Notify client
            await notifyClient(
                consultation.client_id,
                'Consultation Approved ✓',
                `Your consultation for ${consultation.service?.name || 'the service'} has been approved! You can now book your appointment.`,
                { consultationId: consultation.id }
            );

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
        // Just open chat directly without changing consultation status
        setSelectedConsultation(null);
        await openChatWithClient(consultation);
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

                    // Notify client
                    await notifyClient(
                        consultation.client_id,
                        'Consultation Update',
                        `Your consultation for ${consultation.service?.name || 'the service'} was not approved. Please contact us for more details.`,
                        { consultationId: consultation.id }
                    );

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

            const { data: existingConv } = await (supabase as any)
                .from('conversations')
                .select('id')
                .eq('master_id', user.id)
                .eq('client_id', consultation.client.id)
                .single();

            let conversationId = existingConv?.id;

            if (!conversationId) {
                const { data: newConv } = await (supabase as any)
                    .from('conversations')
                    .insert({
                        master_id: user.id,
                        client_id: consultation.client.id,
                    })
                    .select()
                    .single();

                conversationId = newConv?.id;
            }

            if (conversationId) {
                navigation.navigate('Chat' as any, {
                    conversationId,
                    otherUser: {
                        full_name: consultation.client.full_name,
                        avatar_url: consultation.client.avatar_url,
                        id: consultation.client.id,
                    },
                });
            }
        } catch (error) {
            console.error('Error opening chat:', error);
        }
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));

        if (days === 0) return 'Today';
        if (days === 1) return 'Yesterday';
        if (days < 7) return `${days}d ago`;
        return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    };

    const renderStatusBadge = (status: string) => {
        const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
        return (
            <LinearGradient
                colors={config.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.statusBadge}
            >
                <MaterialCommunityIcons name={config.icon as any} size={12} color="#fff" />
                <MerakiText variant="caption" style={styles.statusBadgeText}>{config.label}</MerakiText>
            </LinearGradient>
        );
    };

    const renderConsultationCard = (consultation: ConsultationWithDetails) => {
        return (
            <TouchableOpacity
                key={consultation.id}
                activeOpacity={0.7}
                onPress={() => setSelectedConsultation(consultation)}
            >
                <Card variant="glass" style={styles.consultationCard}>
                    {/* Card Header */}
                    <View style={styles.cardHeader}>
                        <View style={styles.clientInfo}>
                            {consultation.client?.avatar_url ? (
                                <Image
                                    source={{ uri: consultation.client.avatar_url }}
                                    style={styles.clientAvatar}
                                />
                            ) : (
                                <LinearGradient
                                    colors={['#E8A0B4', '#C47A90']}
                                    style={styles.clientAvatarPlaceholder}
                                >
                                    <MerakiText style={styles.clientAvatarText}>
                                        {consultation.client?.full_name?.[0]?.toUpperCase() || 'C'}
                                    </MerakiText>
                                </LinearGradient>
                            )}
                            <View style={styles.clientDetails}>
                                <MerakiText variant="bodyBold" numberOfLines={1} style={styles.clientName}>
                                    {consultation.client?.full_name || 'Client'}
                                </MerakiText>
                                <MerakiText variant="caption" color={colors.textSecondary} numberOfLines={1}>
                                    {consultation.service?.name || 'Service'}
                                </MerakiText>
                            </View>
                        </View>
                        {renderStatusBadge(consultation.status)}
                    </View>

                    {/* Questionnaire Summary */}
                    <View style={styles.questionnairePreview}>
                        <View style={styles.questionRow}>
                            <View style={styles.questionItem}>
                                <MaterialCommunityIcons name="history" size={14} color={colors.textMuted} />
                                <MerakiText variant="caption" color={colors.textSecondary}>Had before</MerakiText>
                            </View>
                            <MerakiText variant="caption" style={styles.questionValue}>
                                {consultation.had_before ? 'Yes' : 'No'}
                            </MerakiText>
                        </View>
                        {consultation.had_before && (
                            <>
                                <View style={styles.questionRow}>
                                    <View style={styles.questionItem}>
                                        <MaterialCommunityIcons name="calendar-clock" size={14} color={colors.textMuted} />
                                        <MerakiText variant="caption" color={colors.textSecondary}>How long ago</MerakiText>
                                    </View>
                                    <MerakiText variant="caption" style={styles.questionValue}>{consultation.how_long_ago}</MerakiText>
                                </View>
                                <View style={styles.questionRow}>
                                    <View style={styles.questionItem}>
                                        <MaterialCommunityIcons name="account-check" size={14} color={colors.textMuted} />
                                        <MerakiText variant="caption" color={colors.textSecondary}>Your work</MerakiText>
                                    </View>
                                    <MerakiText variant="caption" style={styles.questionValue}>
                                        {consultation.was_my_work ? 'Yes' : 'No'}
                                    </MerakiText>
                                </View>
                            </>
                        )}
                    </View>

                    {/* Photos Preview */}
                    {(consultation.photo_urls?.length ?? 0) > 0 && (
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            style={styles.photoScroll}
                            contentContainerStyle={{ gap: 8 }}
                        >
                            {consultation.photo_urls!.map((url, idx) => (
                                <TouchableOpacity key={idx} activeOpacity={0.8} onPress={() => setFullScreenPhoto(url)}>
                                    <Image source={{ uri: url }} style={styles.photoThumb} />
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    )}

                    {/* Card Footer */}
                    <View style={styles.cardFooter}>
                        <View style={styles.footerLeft}>
                            <MaterialCommunityIcons name="clock-outline" size={13} color={colors.textMuted} />
                            <MerakiText variant="caption" color={colors.textMuted}>
                                {formatDate(consultation.created_at || '')}
                            </MerakiText>
                        </View>
                        {consultation.status === 'pending' && (
                            <View style={styles.tapHint}>
                                <MerakiText variant="caption" color={colors.primary} style={{ fontWeight: '600' }}>Tap to review</MerakiText>
                                <MaterialCommunityIcons name="chevron-right" size={16} color={colors.primary} />
                            </View>
                        )}
                    </View>
                </Card>
            </TouchableOpacity>
        );
    };

    const renderDetailModal = () => {
        if (!selectedConsultation) return null;

        const config = STATUS_CONFIG[selectedConsultation.status] || STATUS_CONFIG.pending;

        return (
            <View style={styles.modalOverlay}>
                <TouchableOpacity
                    style={StyleSheet.absoluteFill}
                    activeOpacity={1}
                    onPress={() => setSelectedConsultation(null)}
                />
                <View style={styles.modalContent}>
                    {/* Modal drag handle */}
                    <View style={styles.dragHandle} />

                    <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
                        {/* Modal Header */}
                        <View style={styles.modalHeader}>
                            <View>
                                <MerakiText variant="h2">Consultation Request</MerakiText>
                                <MerakiText variant="caption" color={colors.textMuted} style={{ marginTop: 4 }}>
                                    Submitted {formatDate(selectedConsultation.created_at || '')}
                                </MerakiText>
                            </View>
                            <TouchableOpacity
                                onPress={() => setSelectedConsultation(null)}
                                style={styles.closeButton}
                            >
                                <MaterialCommunityIcons name="close" size={18} color={colors.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        {/* Client Section */}
                        <Card variant="glass" style={styles.modalSection}>
                            <MerakiText variant="caption" style={styles.sectionLabel}>CLIENT</MerakiText>
                            <View style={styles.clientRow}>
                                {selectedConsultation.client?.avatar_url ? (
                                    <Image
                                        source={{ uri: selectedConsultation.client.avatar_url }}
                                        style={styles.modalAvatar}
                                    />
                                ) : (
                                    <LinearGradient
                                        colors={['#E8A0B4', '#C47A90']}
                                        style={styles.modalAvatarPlaceholder}
                                    >
                                        <MerakiText style={styles.modalAvatarText}>
                                            {selectedConsultation.client?.full_name?.[0]?.toUpperCase() || 'C'}
                                        </MerakiText>
                                    </LinearGradient>
                                )}
                                <View style={{ flex: 1 }}>
                                    <MerakiText variant="bodyBold" style={styles.modalClientName}>
                                        {selectedConsultation.client?.full_name}
                                    </MerakiText>
                                    <MerakiText variant="caption" color={colors.textSecondary} style={{ marginTop: 2 }}>
                                        {selectedConsultation.client?.email}
                                    </MerakiText>
                                </View>
                                {renderStatusBadge(selectedConsultation.status)}
                            </View>
                        </Card>

                        {/* Service Section */}
                        <Card variant="glass" style={styles.modalSection}>
                            <MerakiText variant="caption" style={styles.sectionLabel}>SERVICE</MerakiText>
                            <MerakiText variant="bodyBold" style={styles.modalServiceName}>
                                {selectedConsultation.service?.name}
                            </MerakiText>
                            <View style={styles.serviceMetaRow}>
                                <View style={styles.serviceMeta}>
                                    <MaterialCommunityIcons name="cash" size={16} color={colors.primary} />
                                    <MerakiText variant="body" color={colors.textSecondary}>
                                        €{selectedConsultation.service?.base_price}
                                    </MerakiText>
                                </View>
                                <View style={styles.serviceMetaDivider} />
                                <View style={styles.serviceMeta}>
                                    <MaterialCommunityIcons name="clock-outline" size={16} color={colors.primary} />
                                    <MerakiText variant="body" color={colors.textSecondary}>
                                        {selectedConsultation.service?.duration_minutes} min
                                    </MerakiText>
                                </View>
                            </View>
                        </Card>

                        {/* Questionnaire Section */}
                        <Card variant="glass" style={styles.modalSection}>
                            <MerakiText variant="caption" style={styles.sectionLabel}>QUESTIONNAIRE</MerakiText>

                            <View style={styles.answerRow}>
                                <MerakiText variant="body" color={colors.textSecondary}>Had this service before?</MerakiText>
                                <View style={[
                                    styles.answerBadge,
                                    { backgroundColor: selectedConsultation.had_before ? 'rgba(63,185,80,0.15)' : 'rgba(248,81,73,0.15)' }
                                ]}>
                                    <MerakiText variant="caption" style={[
                                        styles.answerBadgeText,
                                        { color: selectedConsultation.had_before ? '#3FB950' : '#F85149' }
                                    ]}>
                                        {selectedConsultation.had_before ? 'Yes' : 'No'}
                                    </MerakiText>
                                </View>
                            </View>

                            {selectedConsultation.had_before && (
                                <>
                                    <View style={styles.answerRow}>
                                        <MerakiText variant="body" color={colors.textSecondary}>How long ago?</MerakiText>
                                        <MerakiText variant="body" style={styles.answerValue}>
                                            {selectedConsultation.how_long_ago}
                                        </MerakiText>
                                    </View>
                                    <View style={styles.answerRow}>
                                        <MerakiText variant="body" color={colors.textSecondary}>Was it your work?</MerakiText>
                                        <View style={[
                                            styles.answerBadge,
                                            { backgroundColor: selectedConsultation.was_my_work ? 'rgba(63,185,80,0.15)' : 'rgba(248,81,73,0.15)' }
                                        ]}>
                                            <MerakiText variant="caption" style={[
                                                styles.answerBadgeText,
                                                { color: selectedConsultation.was_my_work ? '#3FB950' : '#F85149' }
                                            ]}>
                                                {selectedConsultation.was_my_work ? 'Yes' : 'No'}
                                            </MerakiText>
                                        </View>
                                    </View>
                                </>
                            )}

                            {selectedConsultation.additional_notes && (
                                <View style={styles.notesBox}>
                                    <View style={styles.notesHeader}>
                                        <MaterialCommunityIcons name="note-text-outline" size={14} color={colors.textMuted} />
                                        <MerakiText variant="caption" style={styles.notesLabel}>Additional Notes</MerakiText>
                                    </View>
                                    <MerakiText variant="body" style={styles.notesText}>
                                        {selectedConsultation.additional_notes}
                                    </MerakiText>
                                </View>
                            )}
                        </Card>

                        {/* Photos Section */}
                        {(selectedConsultation.photo_urls?.length ?? 0) > 0 && (
                            <Card variant="glass" style={styles.modalSection}>
                                <MerakiText variant="caption" style={styles.sectionLabel}>PHOTOS</MerakiText>
                                <ScrollView
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    contentContainerStyle={{ gap: 10 }}
                                >
                                    {selectedConsultation.photo_urls!.map((url, idx) => (
                                        <TouchableOpacity key={idx} activeOpacity={0.8} onPress={() => setFullScreenPhoto(url)}>
                                            <Image
                                                source={{ uri: url }}
                                                style={styles.modalPhoto}
                                            />
                                            <View style={styles.photoZoomHint}>
                                                <MaterialCommunityIcons name="magnify-plus-outline" size={16} color="#fff" />
                                            </View>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </Card>
                        )}

                        {/* Spacer for bottom actions */}
                        <View style={{ height: 80 }} />
                    </ScrollView>

                    {/* Bottom Actions */}
                    {selectedConsultation.status === 'pending' && (
                        <View style={styles.actionBar}>
                            <TouchableOpacity
                                style={styles.declineButton}
                                onPress={() => handleDecline(selectedConsultation)}
                                disabled={actionLoading}
                                activeOpacity={0.7}
                            >
                                <MaterialCommunityIcons name="close" size={18} color="#F85149" />
                                <MerakiText variant="body" style={styles.declineButtonText}>Decline</MerakiText>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.chatButton}
                                onPress={() => handleRequestChat(selectedConsultation)}
                                disabled={actionLoading}
                                activeOpacity={0.7}
                            >
                                {actionLoading ? (
                                    <ActivityIndicator color="#fff" size="small" />
                                ) : (
                                    <>
                                        <MaterialCommunityIcons name="chat-outline" size={18} color="#fff" />
                                        <MerakiText variant="body" style={styles.chatButtonText}>Chat</MerakiText>
                                    </>
                                )}
                            </TouchableOpacity>

                            <TouchableOpacity
                                activeOpacity={0.7}
                                onPress={() => handleApprove(selectedConsultation)}
                                disabled={actionLoading}
                                style={{ flex: 1.5 }}
                            >
                                <LinearGradient
                                    colors={['#3FB950', '#2EA043']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={styles.approveButton}
                                >
                                    {actionLoading ? (
                                        <ActivityIndicator color="#fff" size="small" />
                                    ) : (
                                        <>
                                            <MaterialCommunityIcons name="check-circle" size={18} color="#fff" />
                                            <MerakiText variant="body" style={styles.approveButtonText}>Approve</MerakiText>
                                        </>
                                    )}
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    )}

                    {selectedConsultation.status === 'approved' && (
                        <View style={styles.statusBar}>
                            <LinearGradient
                                colors={['rgba(63,185,80,0.15)', 'rgba(63,185,80,0.05)']}
                                style={styles.statusBarContent}
                            >
                                <MaterialCommunityIcons name="check-circle" size={20} color="#3FB950" />
                                <View>
                                    <MerakiText variant="bodyBold" style={styles.statusBarTitle}>Approved</MerakiText>
                                    <MerakiText variant="caption" color={colors.textSecondary} style={{ marginTop: 1 }}>
                                        on {new Date(selectedConsultation.responded_at || '').toLocaleDateString()}
                                    </MerakiText>
                                </View>
                            </LinearGradient>
                        </View>
                    )}

                    {selectedConsultation.status === 'chat_requested' && (
                        <View style={styles.statusBar}>
                            <TouchableOpacity
                                activeOpacity={0.7}
                                onPress={() => openChatWithClient(selectedConsultation)}
                            >
                                <LinearGradient
                                    colors={['#58A6FF', '#388BFD']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={styles.openChatBar}
                                >
                                    <MaterialCommunityIcons name="chat-processing" size={20} color="#fff" />
                                    <MerakiText variant="bodyBold" style={styles.openChatText}>Open Chat</MerakiText>
                                    <MaterialCommunityIcons name="arrow-right" size={20} color="#fff" />
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
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
                        <MaterialCommunityIcons name="arrow-left" size={22} color={colors.text} />
                    </TouchableOpacity>
                    <View style={styles.headerCenter}>
                        <MerakiText variant="h2" style={{ fontSize: 18 }}>Booking Consultations</MerakiText>
                        <MerakiText variant="caption" color={colors.textMuted} style={{ marginTop: 2 }}>
                            {consultations.length} request{consultations.length !== 1 ? 's' : ''}
                        </MerakiText>
                    </View>
                    <View style={{ width: 40 }} />
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
                            activeOpacity={0.7}
                            onPress={() => setStatusFilter(filter.value)}
                        >
                            {statusFilter === filter.value ? (
                                <LinearGradient
                                    colors={['#E8A0B4', '#C47A90']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={styles.filterTab}
                                >
                                    <MaterialCommunityIcons name={filter.icon as any} size={14} color="#fff" />
                                    <MerakiText variant="caption" style={[styles.filterTabText, styles.filterTabTextActive]}>
                                        {filter.label}
                                    </MerakiText>
                                </LinearGradient>
                            ) : (
                                <View style={styles.filterTab}>
                                    <MaterialCommunityIcons name={filter.icon as any} size={14} color={colors.textSecondary} />
                                    <MerakiText variant="caption" style={styles.filterTabText}>{filter.label}</MerakiText>
                                </View>
                            )}
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                {/* Consultations List */}
                <ScrollView
                    style={styles.scrollView}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            tintColor={colors.primary}
                        />
                    }
                    contentContainerStyle={styles.listContent}
                >
                    {consultations.length === 0 ? (
                        <View style={styles.emptyState}>
                            <View style={styles.emptyIcon}>
                                <MaterialCommunityIcons name="clipboard-text-outline" size={48} color={colors.textMuted} />
                            </View>
                            <MerakiText variant="h2" style={{ marginBottom: spacing.xs }}>No consultations</MerakiText>
                            <MerakiText variant="body" color={colors.textSecondary} style={styles.emptySubtitle}>
                                {statusFilter === 'pending'
                                    ? 'No pending consultation requests at the moment.'
                                    : 'No consultations found with the selected filter.'}
                            </MerakiText>
                        </View>
                    ) : (
                        consultations.map(renderConsultationCard)
                    )}
                </ScrollView>

                {/* Detail Modal */}
                {selectedConsultation && renderDetailModal()}

                {/* Full Screen Photo Modal */}
                <Modal
                    visible={!!fullScreenPhoto}
                    transparent
                    animationType="fade"
                    onRequestClose={() => setFullScreenPhoto(null)}
                >
                    <TouchableOpacity
                        style={styles.fullScreenOverlay}
                        activeOpacity={1}
                        onPress={() => setFullScreenPhoto(null)}
                    >
                        <View style={styles.fullScreenHeader}>
                            <TouchableOpacity
                                onPress={() => setFullScreenPhoto(null)}
                                style={styles.fullScreenCloseBtn}
                            >
                                <MaterialCommunityIcons name="close" size={24} color="#fff" />
                            </TouchableOpacity>
                        </View>
                        {fullScreenPhoto && (
                            <Image
                                source={{ uri: fullScreenPhoto }}
                                style={styles.fullScreenImage}
                                resizeMode="contain"
                            />
                        )}
                    </TouchableOpacity>
                </Modal>
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
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
    },
    backBtn: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: 'rgba(0, 0, 0, 0.04)',
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.06)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerCenter: {
        flex: 1,
        alignItems: 'center',
    },
    filterContainer: {
        maxHeight: 56,
    },
    filterContent: {
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        gap: 8,
        flexDirection: 'row',
        alignItems: 'center',
    },
    filterTab: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
        backgroundColor: 'rgba(0, 0, 0, 0.04)',
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.06)',
    },
    filterTabText: {
        fontSize: 13,
        fontWeight: '500',
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
        padding: spacing.lg,
        paddingBottom: 100,
    },
    // ─── Consultation Card ─────────────────────────────────────────
    consultationCard: {
        marginBottom: spacing.md,
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
        marginRight: spacing.sm,
    },
    clientAvatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        marginRight: spacing.md,
        borderWidth: 1.5,
        borderColor: 'rgba(212, 168, 83, 0.3)',
    },
    clientAvatarPlaceholder: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.md,
    },
    clientAvatarText: {
        fontSize: 18,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    clientDetails: {
        flex: 1,
    },
    clientName: {
        fontSize: 15,
        fontWeight: '600',
        color: colors.text,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingVertical: 4,
        paddingHorizontal: 10,
        borderRadius: 12,
    },
    statusBadgeText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#1A1A1A',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    // ─── Questionnaire Preview ─────────────────────────────────────
    questionnairePreview: {
        backgroundColor: 'rgba(0, 0, 0, 0.02)',
        borderRadius: 10,
        padding: spacing.md,
        marginBottom: spacing.md,
    },
    questionRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 4,
    },
    questionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    questionValue: {
        fontSize: 13,
        fontWeight: '600',
        color: colors.text,
    },
    // ─── Photos ────────────────────────────────────────────────────
    photoScroll: {
        marginBottom: spacing.md,
    },
    photoThumb: {
        width: 64,
        height: 64,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.06)',
    },
    // ─── Card Footer ──────────────────────────────────────────────
    cardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: spacing.sm,
        borderTopWidth: 1,
        borderTopColor: 'rgba(0, 0, 0, 0.05)',
    },
    footerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    tapHint: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
    },
    // ─── Empty State ──────────────────────────────────────────────
    emptyState: {
        alignItems: 'center',
        paddingVertical: spacing.xl * 2,
    },
    emptyIcon: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(0, 0, 0, 0.02)',
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.05)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.lg,
    },
    emptySubtitle: {
        fontSize: 14,
        color: colors.textSecondary,
        textAlign: 'center',
        maxWidth: 260,
        lineHeight: 20,
    },
    // ─── Modal ────────────────────────────────────────────────────
    modalOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: colors.surface,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '92%',
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.lg,
    },
    dragHandle: {
        width: 36,
        height: 4,
        borderRadius: 2,
        backgroundColor: 'rgba(0, 0, 0, 0.12)',
        alignSelf: 'center',
        marginTop: spacing.md,
        marginBottom: spacing.md,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: spacing.lg,
    },
    closeButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(0, 0, 0, 0.04)',
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.06)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    // ─── Modal Sections ───────────────────────────────────────────
    modalSection: {
        marginBottom: spacing.md,
    },
    sectionLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: colors.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 1.2,
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
        borderWidth: 1.5,
        borderColor: 'rgba(212, 168, 83, 0.3)',
    },
    modalAvatarPlaceholder: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.md,
    },
    modalAvatarText: {
        fontSize: 20,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    modalClientName: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.text,
    },
    modalServiceName: {
        fontSize: 17,
        fontWeight: '600',
        color: colors.text,
        marginBottom: spacing.sm,
    },
    serviceMetaRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    serviceMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    serviceMetaDivider: {
        width: 1,
        height: 14,
        backgroundColor: 'rgba(0, 0, 0, 0.10)',
        marginHorizontal: spacing.md,
    },
    answerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0, 0, 0, 0.03)',
    },
    answerValue: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.text,
    },
    answerBadge: {
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderRadius: 10,
    },
    answerBadgeText: {
        fontSize: 12,
        fontWeight: '700',
    },
    notesBox: {
        backgroundColor: 'rgba(0, 0, 0, 0.02)',
        borderRadius: 10,
        padding: spacing.md,
        marginTop: spacing.md,
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.05)',
    },
    notesHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: spacing.xs,
    },
    notesLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: colors.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    notesText: {
        fontSize: 14,
        color: colors.text,
        lineHeight: 22,
    },
    modalPhoto: {
        width: 130,
        height: 130,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.06)',
    },
    photoZoomHint: {
        position: 'absolute',
        bottom: 6,
        right: 6,
        backgroundColor: 'rgba(0,0,0,0.55)',
        borderRadius: 10,
        padding: 4,
    },
    fullScreenOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.95)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    fullScreenHeader: {
        position: 'absolute',
        top: 50,
        right: 20,
        zIndex: 10,
    },
    fullScreenCloseBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(0, 0, 0, 0.10)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    fullScreenImage: {
        width: SCREEN_WIDTH,
        height: SCREEN_WIDTH,
    },
    // ─── Action Bar ───────────────────────────────────────────────
    actionBar: {
        flexDirection: 'row',
        gap: 10,
        paddingTop: spacing.md,
        borderTopWidth: 1,
        borderTopColor: 'rgba(0, 0, 0, 0.05)',
    },
    declineButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 14,
        borderRadius: 14,
        backgroundColor: 'rgba(248, 81, 73, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(248, 81, 73, 0.25)',
    },
    declineButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#F85149',
    },
    chatButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 14,
        borderRadius: 14,
        backgroundColor: '#58A6FF',
    },
    chatButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1A1A1A',
    },
    approveButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 14,
        borderRadius: 14,
    },
    approveButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1A1A1A',
    },
    // ─── Status Bars ──────────────────────────────────────────────
    statusBar: {
        paddingTop: spacing.md,
        borderTopWidth: 1,
        borderTopColor: 'rgba(0, 0, 0, 0.05)',
    },
    statusBarContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 14,
        paddingHorizontal: spacing.lg,
        borderRadius: 14,
    },
    statusBarTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: '#3FB950',
    },
    openChatBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        paddingVertical: 16,
        borderRadius: 14,
    },
    openChatText: {
        flex: 1,
        fontSize: 15,
        fontWeight: '600',
        color: '#1A1A1A',
    },
});

export default BookingConsultationReviewScreen;
