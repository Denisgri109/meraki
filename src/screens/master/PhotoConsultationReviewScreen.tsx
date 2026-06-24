import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Image,
    RefreshControl,
    TextInput,
    Switch,
    Dimensions,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect, useRoute, RouteProp } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../lib/supabase';
import { Button, Card, ScreenBackground, MerakiText } from '../../components/ui';
import { useModal } from '../../contexts/ModalContext';
import { colors, spacing } from '../../theme';
import { PhotoConsultation, Profile } from '../../types/database';

type ConsultationStatus = 'pending' | 'in_review' | 'responded' | 'closed' | 'all';

const STATUS_CONFIG: Record<string, { gradient: [string, string]; icon: string; label: string }> = {
    pending: { gradient: ['#D29922', '#B8860B'], icon: 'clock-outline', label: 'Pending' },
    in_review: { gradient: ['#58A6FF', '#388BFD'], icon: 'eye-outline', label: 'In Review' },
    responded: { gradient: ['#3FB950', '#2EA043'], icon: 'check-circle', label: 'Responded' },
    closed: { gradient: ['#8B949E', '#6E7681'], icon: 'lock-outline', label: 'Closed' },
};

const FILTER_TABS: { value: ConsultationStatus; label: string; icon: string }[] = [
    { value: 'pending', label: 'Pending', icon: 'clock-outline' },
    { value: 'in_review', label: 'In Review', icon: 'eye-outline' },
    { value: 'responded', label: 'Responded', icon: 'check-circle-outline' },
    { value: 'closed', label: 'Closed', icon: 'lock-outline' },
    { value: 'all', label: 'All', icon: 'format-list-bulleted' },
];

export function PhotoConsultationReviewScreen() {
    const navigation = useNavigation<any>();
    const route = useRoute<RouteProp<{ params: { consultationId?: string } }, 'params'>>();
    const { showAlert, showConfirm } = useModal();
    const preselectedId = route.params?.consultationId;

    const [consultations, setConsultations] = useState<PhotoConsultation[]>([]);
    const [clients, setClients] = useState<Record<string, any>>({});
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [filter, setFilter] = useState<ConsultationStatus>('pending');
    const [selectedConsultation, setSelectedConsultation] = useState<PhotoConsultation | null>(null);
    const [userRole, setUserRole] = useState<string>('');

    // Response form
    const [responseData, setResponseData] = useState({
        isDoable: true,
        professionalNotes: '',
        recommendations: '',
        estimatedDuration: '',
    });

    useEffect(() => {
        getUserRole();
    }, []);

    const getUserRole = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', user.id)
                .single();

            if (data) {
                setUserRole(data.role);
            }
        } catch (error) {
            console.error('Error getting user role:', error);
        }
    };

    const fetchConsultations = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            let query = supabase
                .from('photo_consultations')
                .select('*')
                .order('created_at', { ascending: false });

            if (userRole === 'master') {
                query = query.or(`master_id.eq.${user.id},master_id.is.null`);
            }

            if (filter !== 'all') {
                query = query.eq('status', filter);
            }

            const { data, error } = await query;

            if (error) throw error;

            const consultationsData = data || [];
            setConsultations(consultationsData);

            const clientIds = [...new Set(consultationsData.map(c => c.client_id))];
            if (clientIds.length > 0) {
                const { data: clientsData } = await supabase
                    .from('profiles')
                    .select('id, full_name, email, avatar_url')
                    .in('id', clientIds);

                if (clientsData) {
                    const clientsMap: Record<string, any> = {};
                    clientsData.forEach(client => {
                        clientsMap[client.id] = client;
                    });
                    setClients(clientsMap);
                }
            }

            if (preselectedId) {
                const selected = consultationsData.find(c => c.id === preselectedId);
                if (selected) {
                    setSelectedConsultation(selected);
                }
            }
        } catch (error: any) {
            console.error('Error fetching consultations:', error);
            showAlert('Error', 'Failed to load consultations', 'error');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchConsultations();
        }, [filter, userRole])
    );

    const onRefresh = () => {
        setRefreshing(true);
        fetchConsultations();
    };

    const handleStartReview = async (consultation: PhotoConsultation) => {
        if (consultation.status === 'pending') {
            try {
                const { data: { user } } = await supabase.auth.getUser();

                await supabase
                    .from('photo_consultations')
                    .update({
                        status: 'in_review',
                        master_id: user?.id || consultation.master_id,
                    })
                    .eq('id', consultation.id);

                fetchConsultations();
            } catch (error) {
                console.error('Error updating status:', error);
            }
        }

        if (consultation.status === 'responded' || consultation.status === 'closed') {
            setResponseData({
                isDoable: consultation.is_doable ?? true,
                professionalNotes: consultation.professional_notes || '',
                recommendations: consultation.recommendations || '',
                estimatedDuration: consultation.estimated_duration || '',
            });
        } else {
            setResponseData({
                isDoable: true,
                professionalNotes: '',
                recommendations: '',
                estimatedDuration: '',
            });
        }

        setSelectedConsultation(consultation);
    };

    const handleSubmitResponse = async () => {
        if (!selectedConsultation) return;

        if (!responseData.professionalNotes.trim() || responseData.professionalNotes.length < 20) {
            showAlert('Error', 'Please provide detailed professional notes (at least 20 characters)', 'error');
            return;
        }

        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();

            const { error } = await supabase
                .from('photo_consultations')
                .update({
                    status: 'responded',
                    is_doable: responseData.isDoable,
                    professional_notes: responseData.professionalNotes.trim(),
                    recommendations: responseData.recommendations.trim() || null,
                    estimated_price_range: null,
                    estimated_duration: responseData.estimatedDuration.trim() || null,
                    replied_at: new Date().toISOString(),
                    responded_by: user?.id,
                    master_id: user?.id,
                })
                .eq('id', selectedConsultation.id);

            if (error) throw error;

            showAlert('Success', 'Your professional response has been submitted!', 'success');
            setSelectedConsultation(null);
            fetchConsultations();
        } catch (error: any) {
            console.error('Error submitting response:', error);
            showAlert('Error', error.message || 'Failed to submit response', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleCloseConsultation = async () => {
        if (!selectedConsultation) return;

        showConfirm(
            'Close Consultation',
            'Are you sure you want to close this consultation? This cannot be undone.',
            async () => {
                setLoading(true);
                try {
                    const { error } = await supabase
                        .from('photo_consultations')
                        .update({ status: 'closed' })
                        .eq('id', selectedConsultation.id);

                    if (error) throw error;

                    showAlert('Success', 'Consultation closed', 'success');
                    setSelectedConsultation(null);
                    fetchConsultations();
                } catch (error: any) {
                    console.error('Error closing consultation:', error);
                    showAlert('Error', 'Failed to close consultation', 'error');
                } finally {
                    setLoading(false);
                }
            },
            {
                confirmText: 'Close',
                cancelText: 'Cancel',
                type: 'error'
            }
        );
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
                <MerakiText variant="caption" color="#fff" style={{ fontWeight: '700', fontSize: 10, letterSpacing: 0.5 }}>
                    {config.label.toUpperCase()}
                </MerakiText>
            </LinearGradient>
        );
    };

    const renderFilterTabs = () => (
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filterContainer}
            contentContainerStyle={styles.filterContent}
        >
            {FILTER_TABS.map((tab) => (
                <TouchableOpacity
                    key={tab.value}
                    activeOpacity={0.7}
                    onPress={() => setFilter(tab.value)}
                >
                    {filter === tab.value ? (
                        <LinearGradient
                            colors={['#E8A0B4', '#C47A90']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.filterTab}
                        >
                            <MaterialCommunityIcons name={tab.icon as any} size={14} color="#fff" />
                            <MerakiText variant="caption" color="#fff" style={{ fontWeight: '600' }}>
                                {tab.label}
                            </MerakiText>
                        </LinearGradient>
                    ) : (
                        <View style={styles.filterTab}>
                            <MaterialCommunityIcons name={tab.icon as any} size={14} color={colors.textSecondary} />
                            <MerakiText variant="caption" color={colors.textSecondary} style={{ fontWeight: '500' }}>
                                {tab.label}
                            </MerakiText>
                        </View>
                    )}
                </TouchableOpacity>
            ))}
        </ScrollView>
    );

    const renderConsultationList = () => (
        <ScrollView
            refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
            }
            contentContainerStyle={styles.listContainer}
        >
            {consultations.length === 0 ? (
                <View style={styles.emptyState}>
                    <View style={styles.emptyIcon}>
                        <MaterialCommunityIcons name="camera-off" size={48} color={colors.textMuted} />
                    </View>
                    <MerakiText variant="h2" style={{ marginBottom: spacing.xs }}>No consultations</MerakiText>
                    <MerakiText variant="body" color={colors.textSecondary} style={{ textAlign: 'center', maxWidth: 260, lineHeight: 20 }}>
                        No photo consultations found for this filter.
                    </MerakiText>
                </View>
            ) : (
                consultations.map((consultation) => {
                    const client = clients[consultation.client_id];

                    return (
                        <TouchableOpacity
                            key={consultation.id}
                            activeOpacity={0.7}
                            onPress={() => handleStartReview(consultation)}
                        >
                            <Card variant="glass" style={styles.consultationCard}>
                                {/* Card Header */}
                                <View style={styles.cardHeader}>
                                    <View style={styles.clientInfo}>
                                        {client?.avatar_url ? (
                                            <Image source={{ uri: client.avatar_url }} style={styles.clientAvatar} />
                                        ) : (
                                            <LinearGradient
                                                colors={['#E8A0B4', '#C47A90']}
                                                style={styles.clientAvatarPlaceholder}
                                            >
                                                <MerakiText variant="h2" color="#fff" style={{ fontSize: 18 }}>
                                                    {client?.full_name?.charAt(0).toUpperCase() || '?'}
                                                </MerakiText>
                                            </LinearGradient>
                                        )}
                                        <View style={{ flex: 1 }}>
                                            <MerakiText variant="body" color={colors.text} style={{ fontWeight: '600', fontSize: 15 }}>
                                                {client?.full_name || 'Unknown'}
                                            </MerakiText>
                                            <MerakiText variant="caption" color={colors.textSecondary} numberOfLines={1} style={{ marginTop: 2 }}>
                                                {consultation.title}
                                            </MerakiText>
                                        </View>
                                    </View>
                                    {renderStatusBadge(consultation.status || 'pending')}
                                </View>

                                {/* Service & Description */}
                                <View style={styles.cardDetails}>
                                    <View style={styles.serviceTag}>
                                        <MaterialCommunityIcons name="tag-outline" size={13} color={colors.primary} />
                                        <MerakiText variant="caption" color={colors.primary} style={{ fontWeight: '600' }}>
                                            {consultation.service_type}
                                        </MerakiText>
                                    </View>
                                    <MerakiText variant="caption" color={colors.textSecondary} numberOfLines={2} style={{ lineHeight: 20, marginTop: spacing.xs }}>
                                        {consultation.description}
                                    </MerakiText>
                                </View>

                                {/* Photos Preview */}
                                {(consultation.photo_urls || []).length > 0 && (
                                    <ScrollView
                                        horizontal
                                        showsHorizontalScrollIndicator={false}
                                        style={styles.photoPreview}
                                        contentContainerStyle={{ gap: 8 }}
                                    >
                                        {(consultation.photo_urls || []).slice(0, 3).map((url: string, idx: number) => (
                                            <Image key={idx} source={{ uri: url }} style={styles.previewPhoto} />
                                        ))}
                                        {(consultation.photo_urls?.length || 0) > 3 && (
                                            <View style={styles.morePhotosBadge}>
                                                <MerakiText variant="body" color={colors.textSecondary} style={{ fontWeight: '700', fontSize: 16 }}>
                                                    +{(consultation.photo_urls?.length || 0) - 3}
                                                </MerakiText>
                                            </View>
                                        )}
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
                                            <MerakiText variant="caption" color={colors.primary} style={{ fontWeight: '600' }}>
                                                Tap to review
                                            </MerakiText>
                                            <MaterialCommunityIcons name="chevron-right" size={16} color={colors.primary} />
                                        </View>
                                    )}
                                </View>
                            </Card>
                        </TouchableOpacity>
                    );
                })
            )}
        </ScrollView>
    );

    const renderConsultationDetail = () => {
        if (!selectedConsultation) return null;

        const client = clients[selectedConsultation.client_id];
        const isResponded = selectedConsultation.status === 'responded' || selectedConsultation.status === 'closed';

        return (
            <ScrollView style={styles.detailContainer} showsVerticalScrollIndicator={false}>
                {/* Back to List */}
                <TouchableOpacity
                    style={styles.backToList}
                    onPress={() => setSelectedConsultation(null)}
                    activeOpacity={0.7}
                >
                    <View style={styles.backToListInner}>
                        <MaterialCommunityIcons name="arrow-left" size={18} color={colors.primary} />
                        <MerakiText variant="body" color={colors.primary} style={{ fontWeight: '500' }}>Back to List</MerakiText>
                    </View>
                </TouchableOpacity>

                {/* Client Info */}
                <Card variant="glass" style={styles.detailSection}>
                    <View style={styles.clientHeader}>
                        {client?.avatar_url ? (
                            <Image source={{ uri: client.avatar_url }} style={styles.detailAvatar} />
                        ) : (
                            <LinearGradient
                                colors={['#E8A0B4', '#C47A90']}
                                style={styles.detailAvatarPlaceholder}
                            >
                                <MerakiText variant="h2" color="#fff" style={{ fontSize: 22 }}>
                                    {client?.full_name?.charAt(0).toUpperCase() || '?'}
                                </MerakiText>
                            </LinearGradient>
                        )}
                        <View style={styles.clientHeaderText}>
                            <MerakiText variant="body" color={colors.text} style={{ fontWeight: '600', fontSize: 17 }}>
                                {client?.full_name || 'Unknown'}
                            </MerakiText>
                            <MerakiText variant="caption" color={colors.textSecondary}>{client?.email}</MerakiText>
                        </View>
                        {renderStatusBadge(selectedConsultation.status || 'pending')}
                    </View>
                </Card>

                {/* Consultation Details */}
                <Card variant="glass" style={styles.detailSection}>
                    <MerakiText variant="h2" style={{ marginBottom: spacing.sm, fontSize: 18 }}>
                        {selectedConsultation.title}
                    </MerakiText>
                    <View style={styles.serviceTag}>
                        <MaterialCommunityIcons name="tag-outline" size={13} color={colors.primary} />
                        <MerakiText variant="caption" color={colors.primary} style={{ fontWeight: '600' }}>
                            {selectedConsultation.service_type}
                        </MerakiText>
                    </View>
                    <MerakiText variant="body" color={colors.textSecondary} style={{ lineHeight: 24, marginTop: spacing.sm }}>
                        {selectedConsultation.description}
                    </MerakiText>
                </Card>

                {/* Photos */}
                {(selectedConsultation.photo_urls || []).length > 0 && (
                    <Card variant="glass" style={styles.detailSection}>
                        <View style={styles.sectionLabelRow}>
                            <MaterialCommunityIcons name="image-multiple" size={16} color={colors.textMuted} />
                            <MerakiText variant="caption" color={colors.textMuted} style={styles.sectionLabelText}>
                                CLIENT PHOTOS
                            </MerakiText>
                        </View>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                            {(selectedConsultation.photo_urls || []).map((url: string, idx: number) => (
                                <TouchableOpacity key={idx} activeOpacity={0.8}>
                                    <Image source={{ uri: url }} style={styles.detailPhoto} />
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </Card>
                )}

                {/* Response Form */}
                {(selectedConsultation.status === 'in_review' || selectedConsultation.status === 'pending') && (
                    <Card variant="glass" style={styles.detailSection}>
                        <View style={styles.sectionLabelRow}>
                            <MaterialCommunityIcons name="pencil-outline" size={16} color={colors.textMuted} />
                            <MerakiText variant="caption" color={colors.textMuted} style={styles.sectionLabelText}>
                                YOUR PROFESSIONAL RESPONSE
                            </MerakiText>
                        </View>

                        <View style={styles.switchRow}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <MaterialCommunityIcons
                                    name={responseData.isDoable ? 'check-circle' : 'close-circle'}
                                    size={20}
                                    color={responseData.isDoable ? '#3FB950' : '#F85149'}
                                />
                                <MerakiText variant="body" color={colors.text} style={{ fontWeight: '500' }}>
                                    Is this doable?
                                </MerakiText>
                            </View>
                            <Switch
                                value={responseData.isDoable}
                                onValueChange={(value) => setResponseData({ ...responseData, isDoable: value })}
                                trackColor={{ false: colors.border, true: 'rgba(63, 185, 80, 0.4)' }}
                                thumbColor={responseData.isDoable ? '#3FB950' : colors.textMuted}
                            />
                        </View>

                        <MerakiText variant="caption" color={colors.textSecondary} style={styles.inputLabel}>
                            Professional Notes *
                        </MerakiText>
                        <TextInput
                            style={[styles.input, styles.textArea]}
                            value={responseData.professionalNotes}
                            onChangeText={(text) => setResponseData({ ...responseData, professionalNotes: text })}
                            placeholder="Provide your professional assessment..."
                            placeholderTextColor={colors.textMuted}
                            multiline
                            numberOfLines={6}
                        />

                        <MerakiText variant="caption" color={colors.textSecondary} style={styles.inputLabel}>
                            Recommendations
                        </MerakiText>
                        <TextInput
                            style={[styles.input, styles.textArea, { height: 100 }]}
                            value={responseData.recommendations}
                            onChangeText={(text) => setResponseData({ ...responseData, recommendations: text })}
                            placeholder="What do you recommend for this client?"
                            placeholderTextColor={colors.textMuted}
                            multiline
                            numberOfLines={4}
                        />

                        <MerakiText variant="caption" color={colors.textSecondary} style={styles.inputLabel}>
                            Est. Duration
                        </MerakiText>
                        <TextInput
                            style={styles.input}
                            value={responseData.estimatedDuration}
                            onChangeText={(text) => setResponseData({ ...responseData, estimatedDuration: text })}
                            placeholder="e.g., 2 hours"
                            placeholderTextColor={colors.textMuted}
                        />

                        <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={handleSubmitResponse}
                            disabled={loading}
                        >
                            <LinearGradient
                                colors={['#E8A0B4', '#C47A90']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.submitBtn}
                            >
                                {loading ? (
                                    <View style={{ paddingVertical: 2 }}>
                                        <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#fff', borderTopColor: 'transparent' }} />
                                    </View>
                                ) : (
                                    <>
                                        <MaterialCommunityIcons name="send" size={18} color="#fff" />
                                        <MerakiText variant="body" color="#fff" style={{ fontWeight: '600' }}>
                                            Submit Professional Response
                                        </MerakiText>
                                    </>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>
                    </Card>
                )}

                {/* Previous Response */}
                {isResponded && selectedConsultation.professional_notes && (
                    <Card variant="glass" style={styles.detailSection}>
                        <View style={styles.sectionLabelRow}>
                            <MaterialCommunityIcons name="clipboard-check-outline" size={16} color={colors.textMuted} />
                            <MerakiText variant="caption" color={colors.textMuted} style={styles.sectionLabelText}>
                                YOUR RESPONSE
                            </MerakiText>
                        </View>

                        <View style={styles.responseBox}>
                            {/* Doable Badge */}
                            <View style={[
                                styles.doableBadge,
                                {
                                    backgroundColor: selectedConsultation.is_doable
                                        ? 'rgba(63, 185, 80, 0.12)'
                                        : 'rgba(248, 81, 73, 0.12)',
                                    borderColor: selectedConsultation.is_doable
                                        ? 'rgba(63, 185, 80, 0.25)'
                                        : 'rgba(248, 81, 73, 0.25)',
                                }
                            ]}>
                                <MaterialCommunityIcons
                                    name={selectedConsultation.is_doable ? 'check-circle' : 'close-circle'}
                                    size={16}
                                    color={selectedConsultation.is_doable ? '#3FB950' : '#F85149'}
                                />
                                <MerakiText
                                    variant="body"
                                    color={selectedConsultation.is_doable ? '#3FB950' : '#F85149'}
                                    style={{ fontWeight: '600' }}
                                >
                                    {selectedConsultation.is_doable ? 'Doable' : 'Not Doable'}
                                </MerakiText>
                            </View>

                            <MerakiText variant="caption" color={colors.textMuted} style={{ marginBottom: 4 }}>Professional Notes:</MerakiText>
                            <MerakiText variant="body" color={colors.text} style={{ marginBottom: spacing.md, lineHeight: 24 }}>
                                {selectedConsultation.professional_notes}
                            </MerakiText>

                            {selectedConsultation.recommendations && (
                                <>
                                    <MerakiText variant="caption" color={colors.textMuted} style={{ marginBottom: 4 }}>Recommendations:</MerakiText>
                                    <MerakiText variant="body" color={colors.text} style={{ marginBottom: spacing.md, lineHeight: 24 }}>
                                        {selectedConsultation.recommendations}
                                    </MerakiText>
                                </>
                            )}

                            {selectedConsultation.estimated_duration && (
                                <View style={styles.estimateRow}>
                                    <View style={styles.estimateItem}>
                                        <MaterialCommunityIcons name="clock-outline" size={16} color={colors.primary} />
                                        <MerakiText variant="body" color={colors.text} style={{ fontWeight: '500' }}>
                                            {selectedConsultation.estimated_duration}
                                        </MerakiText>
                                    </View>
                                </View>
                            )}

                            <MerakiText variant="caption" color={colors.textMuted} style={{ marginTop: spacing.md, textAlign: 'right' }}>
                                Responded: {formatDate(selectedConsultation.replied_at || '')}
                            </MerakiText>
                        </View>

                        {selectedConsultation.status === 'responded' && (
                            <TouchableOpacity
                                style={styles.closeConsultationBtn}
                                onPress={handleCloseConsultation}
                                activeOpacity={0.7}
                            >
                                <MaterialCommunityIcons name="lock-outline" size={16} color="#F85149" />
                                <MerakiText variant="body" color="#F85149" style={{ fontWeight: '600' }}>Close Consultation</MerakiText>
                            </TouchableOpacity>
                        )}
                    </Card>
                )}

                {/* Spacer */}
                <View style={{ height: 40 }} />
            </ScrollView>
        );
    };

    return (
        <ScreenBackground>
            <SafeAreaView style={styles.container} edges={['top']}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <MaterialCommunityIcons name="arrow-left" size={22} color={colors.text} />
                    </TouchableOpacity>
                    <View style={styles.headerCenter}>
                        <MerakiText variant="h2" style={{ fontSize: 18 }}>Photo Consultations</MerakiText>
                        <MerakiText variant="caption" color={colors.textMuted} style={{ marginTop: 2 }}>
                            {consultations.length} request{consultations.length !== 1 ? 's' : ''}
                        </MerakiText>
                    </View>
                    <View style={{ width: 40 }} />
                </View>

                {/* Filter Tabs */}
                {!selectedConsultation && renderFilterTabs()}

                {/* Content */}
                {selectedConsultation ? renderConsultationDetail() : renderConsultationList()}
            </SafeAreaView>
        </ScreenBackground>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
    },
    headerCenter: {
        flex: 1,
        alignItems: 'center',
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
        paddingHorizontal: 14,
        borderRadius: 20,
        backgroundColor: 'rgba(0, 0, 0, 0.04)',
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.06)',
    },
    listContainer: {
        padding: spacing.lg,
        paddingBottom: 100,
    },
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
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingVertical: 4,
        paddingHorizontal: 10,
        borderRadius: 12,
    },
    cardDetails: {
        marginBottom: spacing.md,
    },
    serviceTag: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        alignSelf: 'flex-start',
        backgroundColor: 'rgba(212, 168, 83, 0.1)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: 'rgba(212, 168, 83, 0.15)',
    },
    photoPreview: {
        marginBottom: spacing.md,
    },
    previewPhoto: {
        width: 80,
        height: 80,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.06)',
    },
    morePhotosBadge: {
        width: 80,
        height: 80,
        borderRadius: 10,
        backgroundColor: 'rgba(0, 0, 0, 0.02)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.06)',
    },
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
    // ─── Detail View ──────────────────────────────────────────────
    detailContainer: {
        flex: 1,
        padding: spacing.lg,
    },
    backToList: {
        marginBottom: spacing.md,
    },
    backToListInner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        alignSelf: 'flex-start',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 20,
        backgroundColor: 'rgba(212, 168, 83, 0.08)',
        borderWidth: 1,
        borderColor: 'rgba(212, 168, 83, 0.15)',
    },
    detailSection: {
        marginBottom: spacing.md,
    },
    clientHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    detailAvatar: {
        width: 56,
        height: 56,
        borderRadius: 28,
        marginRight: spacing.md,
        borderWidth: 1.5,
        borderColor: 'rgba(212, 168, 83, 0.3)',
    },
    detailAvatarPlaceholder: {
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.md,
    },
    clientHeaderText: {
        flex: 1,
    },
    detailPhoto: {
        width: 180,
        height: 180,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.06)',
    },
    sectionLabelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: spacing.md,
    },
    sectionLabelText: {
        fontWeight: '700',
        letterSpacing: 1.2,
        fontSize: 11,
    },
    // ─── Form Styles ──────────────────────────────────────────────
    switchRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.lg,
        backgroundColor: 'rgba(0, 0, 0, 0.02)',
        padding: spacing.md,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.05)',
    },
    inputLabel: {
        fontWeight: '600',
        marginBottom: spacing.xs,
        letterSpacing: 0.3,
    },
    input: {
        backgroundColor: 'rgba(0, 0, 0, 0.03)',
        borderRadius: 12,
        padding: spacing.md,
        color: colors.text,
        fontSize: 15,
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.06)',
        marginBottom: spacing.md,
    },
    textArea: {
        height: 120,
        textAlignVertical: 'top',
    },
    rowInputs: {
        flexDirection: 'row',
        gap: spacing.md,
    },
    rowInput: {
        flex: 1,
    },
    submitBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 16,
        borderRadius: 14,
        marginTop: spacing.xs,
    },
    // ─── Response Box ─────────────────────────────────────────────
    responseBox: {
        backgroundColor: 'rgba(0, 0, 0, 0.02)',
        borderRadius: 12,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.05)',
    },
    doableBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 10,
        borderWidth: 1,
        marginBottom: spacing.md,
    },
    estimateRow: {
        flexDirection: 'row',
        gap: spacing.lg,
        marginTop: spacing.sm,
        paddingTop: spacing.sm,
        borderTopWidth: 1,
        borderTopColor: 'rgba(0, 0, 0, 0.05)',
    },
    estimateItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    closeConsultationBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginTop: spacing.md,
        paddingVertical: 12,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: 'rgba(248, 81, 73, 0.25)',
        backgroundColor: 'rgba(248, 81, 73, 0.08)',
    },
});

export default PhotoConsultationReviewScreen;
