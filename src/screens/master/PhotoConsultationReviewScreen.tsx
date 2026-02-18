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
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect, useRoute, RouteProp } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { Button, ScreenBackground, MerakiText } from '../../components/ui';
import { useModal } from '../../contexts/ModalContext';
import { colors, spacing } from '../../theme';
import { PhotoConsultation, Profile } from '../../types/database';

type ConsultationStatus = 'pending' | 'in_review' | 'responded' | 'closed' | 'all';

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
        estimatedPrice: '',
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

            // If master (not owner), only show consultations assigned to them or unassigned
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

            // Fetch client details
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

            // If there's a preselected ID, select it
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

        // Pre-fill response data if already responded
        if (consultation.status === 'responded' || consultation.status === 'closed') {
            setResponseData({
                isDoable: consultation.is_doable ?? true,
                professionalNotes: consultation.professional_notes || '',
                recommendations: consultation.recommendations || '',
                estimatedPrice: consultation.estimated_price_range || '',
                estimatedDuration: consultation.estimated_duration || '',
            });
        } else {
            setResponseData({
                isDoable: true,
                professionalNotes: '',
                recommendations: '',
                estimatedPrice: '',
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
                    estimated_price_range: responseData.estimatedPrice.trim() || null,
                    estimated_duration: responseData.estimatedDuration.trim() || null,
                    replied_at: new Date().toISOString(),
                    responded_by: user?.id,
                    master_id: user?.id,
                })
                .eq('id', selectedConsultation.id);

            if (error) throw error;

            // TODO: Send notification to client

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

    const renderStatusBadge = (status: string) => {
        const statusStyles: Record<string, { backgroundColor: string; color: string }> = {
            pending: { backgroundColor: '#FEF3C7', color: '#92400E' },
            in_review: { backgroundColor: '#DBEAFE', color: '#1E40AF' },
            responded: { backgroundColor: '#D1FAE5', color: '#065F46' },
            closed: { backgroundColor: '#E5E7EB', color: '#374151' },
        };

        const style = statusStyles[status] || statusStyles.pending;
        const label = status.replace('_', ' ').toUpperCase();

        return (
            <View style={[styles.statusBadge, { backgroundColor: style.backgroundColor }]}>
                <MerakiText variant="caption" color={style.color} style={{ fontWeight: '700', fontSize: 10 }}>{label}</MerakiText>
            </View>
        );
    };

    const renderFilterTabs = () => (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterContainer}>
            {(['pending', 'in_review', 'responded', 'closed', 'all'] as ConsultationStatus[]).map((status) => (
                <TouchableOpacity
                    key={status}
                    style={[
                        styles.filterTab,
                        filter === status && styles.filterTabActive
                    ]}
                    onPress={() => setFilter(status)}
                >
                    <MerakiText
                        variant="caption"
                        color={filter === status ? '#fff' : colors.text}
                        style={[
                            { textTransform: 'capitalize' },
                            filter === status && { fontWeight: '600' }
                        ]}
                    >
                        {status === 'all' ? 'All' : status.replace('_', ' ')}
                    </MerakiText>
                </TouchableOpacity>
            ))}
        </ScrollView>
    );

    const renderConsultationList = () => (
        <ScrollView
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            contentContainerStyle={styles.listContainer}
        >
            {consultations.length === 0 ? (
                <View style={styles.emptyState}>
                    <MerakiText variant="body" color={colors.textSecondary}>No consultations found</MerakiText>
                </View>
            ) : (
                consultations.map((consultation) => {
                    const client = clients[consultation.client_id];

                    return (
                        <TouchableOpacity
                            key={consultation.id}
                            style={styles.consultationCard}
                            onPress={() => handleStartReview(consultation)}
                        >
                            <View style={styles.cardHeader}>
                                <View style={styles.clientInfo}>
                                    {client?.avatar_url ? (
                                        <Image source={{ uri: client.avatar_url }} style={styles.clientAvatar} />
                                    ) : (
                                        <View style={styles.clientAvatarPlaceholder}>
                                            <MerakiText variant="h2" color="#fff" style={{ fontSize: 20 }}>
                                                {client?.full_name?.charAt(0).toUpperCase() || '?'}
                                            </MerakiText>
                                        </View>
                                    )}
                                    <View>
                                        <MerakiText variant="body" color={colors.text} style={{ fontWeight: '600' }}>{client?.full_name || 'Unknown'}</MerakiText>
                                        <MerakiText variant="caption" color={colors.textSecondary} numberOfLines={1} style={{ maxWidth: 200, marginTop: 2 }}>
                                            {consultation.title}
                                        </MerakiText>
                                    </View>
                                </View>
                                {renderStatusBadge(consultation.status || 'pending')}
                            </View>

                            <View style={styles.cardDetails}>
                                <MerakiText variant="body" color={colors.primary} style={{ fontWeight: '600', marginBottom: spacing.xs }}>{consultation.service_type}</MerakiText>
                                <MerakiText variant="caption" color={colors.textSecondary} numberOfLines={2} style={{ lineHeight: 20 }}>
                                    {consultation.description}
                                </MerakiText>
                            </View>

                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoPreview}>
                                {(consultation.photo_urls || []).slice(0, 3).map((url: string, idx: number) => (
                                    <Image key={idx} source={{ uri: url }} style={styles.previewPhoto} />
                                ))}
                                {(consultation.photo_urls?.length || 0) > 3 && (
                                    <View style={styles.morePhotosBadge}>
                                        <MerakiText variant="body" color={colors.textSecondary} style={{ fontWeight: '600' }}>+{(consultation.photo_urls?.length || 0) - 3}</MerakiText>
                                    </View>
                                )}
                            </ScrollView>

                            <View style={styles.cardFooter}>
                                <MerakiText variant="caption" color={colors.textMuted}>
                                    {new Date(consultation.created_at || '').toLocaleDateString()}
                                </MerakiText>
                                {consultation.status === 'pending' && (
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                        <MerakiText variant="caption" color={colors.primary} style={{ fontWeight: '600' }}>Tap to review</MerakiText>
                                        <MaterialCommunityIcons name="arrow-right" size={14} color={colors.primary} />
                                    </View>
                                )}
                            </View>
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
            <ScrollView style={styles.detailContainer}>
                <TouchableOpacity
                    style={styles.backToList}
                    onPress={() => setSelectedConsultation(null)}
                >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <MaterialCommunityIcons name="arrow-left" size={18} color={colors.primary} />
                        <MerakiText variant="body" color={colors.primary}>Back to List</MerakiText>
                    </View>
                </TouchableOpacity>

                {/* Client Info */}
                <View style={styles.detailSection}>
                    <View style={styles.clientHeader}>
                        {client?.avatar_url ? (
                            <Image source={{ uri: client.avatar_url }} style={styles.detailAvatar} />
                        ) : (
                            <View style={styles.detailAvatarPlaceholder}>
                                <MerakiText variant="h2" color="#fff" style={{ fontSize: 24 }}>
                                    {client?.full_name?.charAt(0).toUpperCase() || '?'}
                                </MerakiText>
                            </View>
                        )}
                        <View style={styles.clientHeaderText}>
                            <MerakiText variant="body" color={colors.text} style={{ fontWeight: '600', fontSize: 18 }}>{client?.full_name || 'Unknown'}</MerakiText>
                            <MerakiText variant="caption" color={colors.textSecondary}>{client?.email}</MerakiText>
                        </View>
                        {renderStatusBadge(selectedConsultation.status || 'pending')}
                    </View>
                </View>

                {/* Consultation Details */}
                <View style={styles.detailSection}>
                    <MerakiText variant="h2" style={{ marginBottom: spacing.md }}>{selectedConsultation.title}</MerakiText>
                    <MerakiText variant="body" color={colors.primary} style={{ fontWeight: '600', marginBottom: spacing.xs }}>{selectedConsultation.service_type}</MerakiText>
                    <MerakiText variant="body" color={colors.textSecondary} style={{ lineHeight: 24 }}>{selectedConsultation.description}</MerakiText>
                </View>

                {/* Photos */}
                <View style={styles.detailSection}>
                    <MerakiText variant="h2" style={{ marginBottom: spacing.md }}>Client Photos</MerakiText>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        {(selectedConsultation.photo_urls || []).map((url: string, idx: number) => (
                            <TouchableOpacity key={idx} onPress={() => { }}>
                                <Image source={{ uri: url }} style={styles.detailPhoto} />
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                {/* Response Form */}
                {(selectedConsultation.status === 'in_review' || selectedConsultation.status === 'pending') && (
                    <View style={styles.detailSection}>
                        <MerakiText variant="h2" style={{ marginBottom: spacing.md }}>Your Professional Response</MerakiText>

                        <View style={styles.switchRow}>
                            <MerakiText variant="body" color={colors.text} style={{ fontWeight: '500' }}>Is this doable?</MerakiText>
                            <Switch
                                value={responseData.isDoable}
                                onValueChange={(value) => setResponseData({ ...responseData, isDoable: value })}
                                trackColor={{ false: colors.border, true: colors.primary }}
                            />
                        </View>

                        <MerakiText variant="caption" color={colors.textSecondary} style={{ fontWeight: '500', marginBottom: spacing.xs }}>Professional Notes *</MerakiText>
                        <TextInput
                            style={[styles.input, styles.textArea]}
                            value={responseData.professionalNotes}
                            onChangeText={(text) => setResponseData({ ...responseData, professionalNotes: text })}
                            placeholder="Provide your professional assessment..."
                            placeholderTextColor={colors.textMuted}
                            multiline
                            numberOfLines={6}
                        />

                        <MerakiText variant="caption" color={colors.textSecondary} style={{ fontWeight: '500', marginBottom: spacing.xs }}>Recommendations</MerakiText>
                        <TextInput
                            style={[styles.input, styles.textArea]}
                            value={responseData.recommendations}
                            onChangeText={(text) => setResponseData({ ...responseData, recommendations: text })}
                            placeholder="What do you recommend for this client?"
                            placeholderTextColor={colors.textMuted}
                            multiline
                            numberOfLines={4}
                        />

                        <View style={styles.rowInputs}>
                            <View style={styles.rowInput}>
                                <MerakiText variant="caption" color={colors.textSecondary} style={{ fontWeight: '500', marginBottom: spacing.xs }}>Est. Price Range</MerakiText>
                                <TextInput
                                    style={styles.input}
                                    value={responseData.estimatedPrice}
                                    onChangeText={(text) => setResponseData({ ...responseData, estimatedPrice: text })}
                                    placeholder="e.g., €50-80"
                                    placeholderTextColor={colors.textMuted}
                                />
                            </View>
                            <View style={styles.rowInput}>
                                <MerakiText variant="caption" color={colors.textSecondary} style={{ fontWeight: '500', marginBottom: spacing.xs }}>Est. Duration</MerakiText>
                                <TextInput
                                    style={styles.input}
                                    value={responseData.estimatedDuration}
                                    onChangeText={(text) => setResponseData({ ...responseData, estimatedDuration: text })}
                                    placeholder="e.g., 2 hours"
                                    placeholderTextColor={colors.textMuted}
                                />
                            </View>
                        </View>

                        <Button
                            title="Submit Professional Response"
                            onPress={handleSubmitResponse}
                            loading={loading}
                            style={styles.submitBtn}
                        />
                    </View>
                )}

                {/* Previous Response */}
                {isResponded && selectedConsultation.professional_notes && (
                    <View style={styles.detailSection}>
                        <MerakiText variant="h2" style={{ marginBottom: spacing.md }}>Your Response</MerakiText>

                        <View style={styles.responseBox}>
                            <View style={styles.doableBadge}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                    <MaterialCommunityIcons name={selectedConsultation.is_doable ? 'check-circle' : 'close-circle'} size={16} color={selectedConsultation.is_doable ? colors.success : colors.error} />
                                    <MerakiText variant="body" color="#10B981" style={{ fontWeight: '600' }}>
                                        {selectedConsultation.is_doable ? 'Doable' : 'Not Doable'}
                                    </MerakiText>
                                </View>
                            </View>

                            <MerakiText variant="caption" color={colors.textMuted} style={{ marginBottom: 4 }}>Professional Notes:</MerakiText>
                            <MerakiText variant="body" color={colors.text} style={{ marginBottom: spacing.md, lineHeight: 24 }}>{selectedConsultation.professional_notes}</MerakiText>

                            {selectedConsultation.recommendations && (
                                <>
                                    <MerakiText variant="caption" color={colors.textMuted} style={{ marginBottom: 4 }}>Recommendations:</MerakiText>
                                    <MerakiText variant="body" color={colors.text} style={{ marginBottom: spacing.md, lineHeight: 24 }}>{selectedConsultation.recommendations}</MerakiText>
                                </>
                            )}

                            <View style={styles.estimateRow}>
                                {selectedConsultation.estimated_price_range && (
                                    <MerakiText variant="body" color={colors.primary} style={{ fontWeight: '500' }}>
                                        Est. Price: {selectedConsultation.estimated_price_range}
                                    </MerakiText>
                                )}
                                {selectedConsultation.estimated_duration && (
                                    <MerakiText variant="body" color={colors.primary} style={{ fontWeight: '500' }}>
                                        Est. Duration: {selectedConsultation.estimated_duration}
                                    </MerakiText>
                                )}
                            </View>

                            <MerakiText variant="caption" color={colors.textMuted} style={{ marginTop: spacing.md, textAlign: 'right' }}>
                                Responded: {new Date(selectedConsultation.replied_at || '').toLocaleDateString()}
                            </MerakiText>
                        </View>

                        {selectedConsultation.status === 'responded' && (
                            <TouchableOpacity
                                style={styles.closeBtn}
                                onPress={handleCloseConsultation}
                            >
                                <MerakiText variant="body" color="#EF4444" style={{ fontWeight: '600' }}>Close Consultation</MerakiText>
                            </TouchableOpacity>
                        )}
                    </View>
                )}
            </ScrollView>
        );
    };

    return (
        <ScreenBackground>
            <SafeAreaView style={styles.container} edges={['top']}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <MerakiText variant="h2">Photo Consultations</MerakiText>
                    <View style={{ width: 50 }} />
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
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    filterContainer: {
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    filterTab: {
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        borderRadius: 20,
        backgroundColor: colors.surface,
        marginRight: spacing.sm,
        borderWidth: 1,
        borderColor: colors.border,
    },
    filterTabActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    listContainer: {
        padding: spacing.lg,
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: spacing.xl * 2,
    },
    consultationCard: {
        backgroundColor: colors.surface,
        borderRadius: 12,
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
        width: 48,
        height: 48,
        borderRadius: 24,
        marginRight: spacing.md,
    },
    clientAvatarPlaceholder: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.md,
    },
    statusBadge: {
        paddingVertical: spacing.xs,
        paddingHorizontal: spacing.sm,
        borderRadius: 4,
    },
    cardDetails: {
        marginBottom: spacing.md,
    },
    photoPreview: {
        marginBottom: spacing.md,
    },
    previewPhoto: {
        width: 80,
        height: 80,
        borderRadius: 8,
        marginRight: spacing.sm,
    },
    morePhotosBadge: {
        width: 80,
        height: 80,
        borderRadius: 8,
        backgroundColor: colors.surface,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.border,
    },
    cardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: spacing.md,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    detailContainer: {
        flex: 1,
        padding: spacing.lg,
    },
    backToList: {
        marginBottom: spacing.md,
    },
    backBtn: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.05)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    detailSection: {
        marginBottom: spacing.lg,
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: spacing.lg,
        borderWidth: 1,
        borderColor: colors.border,
    },
    clientHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    detailAvatar: {
        width: 60,
        height: 60,
        borderRadius: 30,
        marginRight: spacing.md,
    },
    detailAvatarPlaceholder: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.md,
    },
    clientHeaderText: {
        flex: 1,
    },
    detailPhoto: {
        width: 200,
        height: 200,
        borderRadius: 12,
        marginRight: spacing.md,
    },
    switchRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.lg,
    },
    input: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 8,
        padding: spacing.md,
        color: colors.text,
        fontSize: 16,
        borderWidth: 1,
        borderColor: colors.border,
        marginBottom: spacing.lg,
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
        marginTop: spacing.sm,
    },
    responseBox: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 8,
        padding: spacing.md,
    },
    doableBadge: {
        alignSelf: 'flex-start',
        backgroundColor: 'rgba(16, 185, 129, 0.2)',
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        borderRadius: 4,
        marginBottom: spacing.md,
    },
    estimateRow: {
        flexDirection: 'row',
        gap: spacing.lg,
        marginTop: spacing.sm,
        paddingTop: spacing.sm,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.1)',
    },
    closeBtn: {
        marginTop: spacing.lg,
        alignSelf: 'center',
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.lg,
        borderWidth: 1,
        borderColor: '#EF4444',
        borderRadius: 20,
    },
});

export default PhotoConsultationReviewScreen;
