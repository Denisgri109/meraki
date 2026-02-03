import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Alert,
    Image,
    RefreshControl,
    TextInput,
    Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect, useRoute, RouteProp } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { Button, ScreenBackground } from '../../components/ui';
import { colors, spacing } from '../../theme';
import { PhotoConsultation, Profile } from '../../types/database';

type ConsultationStatus = 'pending' | 'in_review' | 'responded' | 'closed' | 'all';

export function PhotoConsultationReviewScreen() {
    const navigation = useNavigation<any>();
    const route = useRoute<RouteProp<{ params: { consultationId?: string } }, 'params'>>();
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
                    const clientsMap: Record<string, Profile> = {};
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
            Alert.alert('Error', 'Failed to load consultations');
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
            Alert.alert('Error', 'Please provide detailed professional notes (at least 20 characters)');
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
                    responded_at: new Date().toISOString(),
                    responded_by: user?.id,
                    master_id: user?.id,
                })
                .eq('id', selectedConsultation.id);

            if (error) throw error;

            // TODO: Send notification to client

            Alert.alert('Success', 'Your professional response has been submitted!');
            setSelectedConsultation(null);
            fetchConsultations();
        } catch (error: any) {
            console.error('Error submitting response:', error);
            Alert.alert('Error', error.message || 'Failed to submit response');
        } finally {
            setLoading(false);
        }
    };

    const handleCloseConsultation = async () => {
        if (!selectedConsultation) return;

        Alert.alert(
            'Close Consultation',
            'Are you sure you want to close this consultation? This cannot be undone.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Close',
                    style: 'destructive',
                    onPress: async () => {
                        setLoading(true);
                        try {
                            const { error } = await supabase
                                .from('photo_consultations')
                                .update({ status: 'closed' })
                                .eq('id', selectedConsultation.id);

                            if (error) throw error;

                            Alert.alert('Success', 'Consultation closed');
                            setSelectedConsultation(null);
                            fetchConsultations();
                        } catch (error: any) {
                            console.error('Error closing consultation:', error);
                            Alert.alert('Error', 'Failed to close consultation');
                        } finally {
                            setLoading(false);
                        }
                    }
                }
            ]
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
                <Text style={[styles.statusText, { color: style.color }]}>{label}</Text>
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
                    <Text style={[
                        styles.filterTabText,
                        filter === status && styles.filterTabTextActive
                    ]}>
                        {status === 'all' ? 'All' : status.replace('_', ' ')}
                    </Text>
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
                    <Text style={styles.emptyStateText}>No consultations found</Text>
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
                                            <Text style={styles.clientAvatarText}>
                                                {client?.full_name?.charAt(0).toUpperCase() || '?'}
                                            </Text>
                                        </View>
                                    )}
                                    <View>
                                        <Text style={styles.clientName}>{client?.full_name || 'Unknown'}</Text>
                                        <Text style={styles.consultationTitle} numberOfLines={1}>
                                            {consultation.title}
                                        </Text>
                                    </View>
                                </View>
                                {renderStatusBadge(consultation.status)}
                            </View>

                            <View style={styles.cardDetails}>
                                <Text style={styles.serviceType}>{consultation.service_type}</Text>
                                <Text style={styles.description} numberOfLines={2}>
                                    {consultation.description}
                                </Text>
                            </View>

                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoPreview}>
                                {consultation.photo_urls.slice(0, 3).map((url, idx) => (
                                    <Image key={idx} source={{ uri: url }} style={styles.previewPhoto} />
                                ))}
                                {consultation.photo_urls.length > 3 && (
                                    <View style={styles.morePhotosBadge}>
                                        <Text style={styles.morePhotosText}>+{consultation.photo_urls.length - 3}</Text>
                                    </View>
                                )}
                            </ScrollView>

                            <View style={styles.cardFooter}>
                                <Text style={styles.dateText}>
                                    {new Date(consultation.created_at || '').toLocaleDateString()}
                                </Text>
                                {consultation.status === 'pending' && (
                                    <Text style={styles.actionHint}>Tap to review →</Text>
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
                    <Text style={styles.backToListText}>← Back to List</Text>
                </TouchableOpacity>

                {/* Client Info */}
                <View style={styles.detailSection}>
                    <View style={styles.clientHeader}>
                        {client?.avatar_url ? (
                            <Image source={{ uri: client.avatar_url }} style={styles.detailAvatar} />
                        ) : (
                            <View style={styles.detailAvatarPlaceholder}>
                                <Text style={styles.detailAvatarText}>
                                    {client?.full_name?.charAt(0).toUpperCase() || '?'}
                                </Text>
                            </View>
                        )}
                        <View style={styles.clientHeaderText}>
                            <Text style={styles.detailClientName}>{client?.full_name || 'Unknown'}</Text>
                            <Text style={styles.detailClientEmail}>{client?.email}</Text>
                        </View>
                        {renderStatusBadge(selectedConsultation.status)}
                    </View>
                </View>

                {/* Consultation Details */}
                <View style={styles.detailSection}>
                    <Text style={styles.sectionTitle}>{selectedConsultation.title}</Text>
                    <Text style={styles.serviceTypeLabel}>{selectedConsultation.service_type}</Text>
                    <Text style={styles.detailDescription}>{selectedConsultation.description}</Text>
                </View>

                {/* Photos */}
                <View style={styles.detailSection}>
                    <Text style={styles.sectionTitle}>Client Photos</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        {selectedConsultation.photo_urls.map((url, idx) => (
                            <TouchableOpacity key={idx} onPress={() => {}}>
                                <Image source={{ uri: url }} style={styles.detailPhoto} />
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                {/* Response Form */}
                {(selectedConsultation.status === 'in_review' || selectedConsultation.status === 'pending') && (
                    <View style={styles.detailSection}>
                        <Text style={styles.sectionTitle}>Your Professional Response</Text>

                        <View style={styles.switchRow}>
                            <Text style={styles.switchLabel}>Is this doable?</Text>
                            <Switch
                                value={responseData.isDoable}
                                onValueChange={(value) => setResponseData({ ...responseData, isDoable: value })}
                                trackColor={{ false: colors.border, true: colors.primary }}
                            />
                        </View>

                        <Text style={styles.label}>Professional Notes *</Text>
                        <TextInput
                            style={[styles.input, styles.textArea]}
                            value={responseData.professionalNotes}
                            onChangeText={(text) => setResponseData({ ...responseData, professionalNotes: text })}
                            placeholder="Provide your professional assessment..."
                            placeholderTextColor={colors.textMuted}
                            multiline
                            numberOfLines={6}
                        />

                        <Text style={styles.label}>Recommendations</Text>
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
                                <Text style={styles.label}>Est. Price Range</Text>
                                <TextInput
                                    style={styles.input}
                                    value={responseData.estimatedPrice}
                                    onChangeText={(text) => setResponseData({ ...responseData, estimatedPrice: text })}
                                    placeholder="e.g., €50-80"
                                    placeholderTextColor={colors.textMuted}
                                />
                            </View>
                            <View style={styles.rowInput}>
                                <Text style={styles.label}>Est. Duration</Text>
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
                        <Text style={styles.sectionTitle}>Your Response</Text>
                        
                        <View style={styles.responseBox}>
                            <View style={styles.doableBadge}>
                                <Text style={styles.doableBadgeText}>
                                    {selectedConsultation.is_doable ? '✓ Doable' : '✗ Not Doable'}
                                </Text>
                            </View>
                            
                            <Text style={styles.responseLabel}>Professional Notes:</Text>
                            <Text style={styles.responseText}>{selectedConsultation.professional_notes}</Text>
                            
                            {selectedConsultation.recommendations && (
                                <>
                                    <Text style={styles.responseLabel}>Recommendations:</Text>
                                    <Text style={styles.responseText}>{selectedConsultation.recommendations}</Text>
                                </>
                            )}
                            
                            <View style={styles.estimateRow}>
                                {selectedConsultation.estimated_price_range && (
                                    <Text style={styles.estimateText}>
                                        Est. Price: {selectedConsultation.estimated_price_range}
                                    </Text>
                                )}
                                {selectedConsultation.estimated_duration && (
                                    <Text style={styles.estimateText}>
                                        Est. Duration: {selectedConsultation.estimated_duration}
                                    </Text>
                                )}
                            </View>
                            
                            <Text style={styles.responseDate}>
                                Responded: {new Date(selectedConsultation.responded_at || '').toLocaleDateString()}
                            </Text>
                        </View>

                        {selectedConsultation.status === 'responded' && (
                            <TouchableOpacity
                                style={styles.closeBtn}
                                onPress={handleCloseConsultation}
                            >
                                <Text style={styles.closeBtnText}>Close Consultation</Text>
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
                    <TouchableOpacity onPress={() => navigation.goBack()}>
                        <Text style={styles.backButton}>← Back</Text>
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Photo Consultations</Text>
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
    backButton: {
        fontSize: 16,
        color: colors.primary,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: colors.text,
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
    filterTabText: {
        fontSize: 14,
        color: colors.text,
        textTransform: 'capitalize',
    },
    filterTabTextActive: {
        color: '#fff',
        fontWeight: '600',
    },
    listContainer: {
        padding: spacing.lg,
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: spacing.xl * 2,
    },
    emptyStateText: {
        fontSize: 16,
        color: colors.textSecondary,
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
    clientAvatarText: {
        fontSize: 20,
        fontWeight: '700',
        color: '#fff',
    },
    clientName: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.text,
    },
    consultationTitle: {
        fontSize: 13,
        color: colors.textSecondary,
        marginTop: 2,
        maxWidth: 200,
    },
    statusBadge: {
        paddingVertical: spacing.xs,
        paddingHorizontal: spacing.sm,
        borderRadius: 4,
    },
    statusText: {
        fontSize: 10,
        fontWeight: '700',
    },
    cardDetails: {
        marginBottom: spacing.md,
    },
    serviceType: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.primary,
        marginBottom: spacing.xs,
    },
    description: {
        fontSize: 14,
        color: colors.textSecondary,
        lineHeight: 20,
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
    morePhotosText: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.textSecondary,
    },
    cardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: spacing.md,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    dateText: {
        fontSize: 12,
        color: colors.textMuted,
    },
    actionHint: {
        fontSize: 12,
        color: colors.primary,
        fontWeight: '600',
    },
    detailContainer: {
        flex: 1,
        padding: spacing.lg,
    },
    backToList: {
        marginBottom: spacing.md,
    },
    backToListText: {
        fontSize: 16,
        color: colors.primary,
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
    detailAvatarText: {
        fontSize: 24,
        fontWeight: '700',
        color: '#fff',
    },
    clientHeaderText: {
        flex: 1,
    },
    detailClientName: {
        fontSize: 18,
        fontWeight: '600',
        color: colors.text,
    },
    detailClientEmail: {
        fontSize: 14,
        color: colors.textSecondary,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: colors.text,
        marginBottom: spacing.md,
    },
    serviceTypeLabel: {
        fontSize: 14,
        color: colors.primary,
        fontWeight: '600',
        marginBottom: spacing.sm,
    },
    detailDescription: {
        fontSize: 14,
        color: colors.text,
        lineHeight: 20,
    },
    detailPhoto: {
        width: 150,
        height: 150,
        borderRadius: 8,
        marginRight: spacing.md,
    },
    switchRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    switchLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.text,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.text,
        marginBottom: spacing.xs,
    },
    input: {
        backgroundColor: colors.background,
        borderRadius: 12,
        padding: spacing.md,
        color: colors.text,
        fontSize: 16,
        borderWidth: 1,
        borderColor: colors.border,
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
        marginTop: spacing.md,
    },
    responseBox: {
        backgroundColor: colors.background,
        borderRadius: 12,
        padding: spacing.lg,
        borderWidth: 1,
        borderColor: colors.border,
    },
    doableBadge: {
        alignSelf: 'flex-start',
        paddingVertical: spacing.xs,
        paddingHorizontal: spacing.md,
        borderRadius: 4,
        backgroundColor: '#D1FAE5',
        marginBottom: spacing.md,
    },
    doableBadgeText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#065F46',
    },
    responseLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.textSecondary,
        marginBottom: spacing.xs,
        marginTop: spacing.md,
    },
    responseText: {
        fontSize: 14,
        color: colors.text,
        lineHeight: 20,
    },
    estimateRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: spacing.md,
        paddingTop: spacing.md,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    estimateText: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.primary,
    },
    responseDate: {
        fontSize: 12,
        color: colors.textMuted,
        marginTop: spacing.md,
    },
    closeBtn: {
        marginTop: spacing.lg,
        padding: spacing.md,
        alignItems: 'center',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#EF4444',
    },
    closeBtnText: {
        color: '#EF4444',
        fontSize: 16,
        fontWeight: '600',
    },
});

export default PhotoConsultationReviewScreen;
