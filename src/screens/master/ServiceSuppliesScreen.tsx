import React, { useState, useEffect } from 'react';
import {
    View,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    TextInput,
    Modal,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { ScreenBackground, Card, MerakiText } from '../../components/ui';
import { useModal } from '../../contexts/ModalContext';
import { colors, spacing } from '../../theme';
import { Service, MasterSupply, ServiceSupply, OwnerSupply } from '../../types/database';

type AnySupply = MasterSupply | OwnerSupply;

type ServiceWithSupplies = Service & {
    linkedSupplies: (ServiceSupply & { supply: AnySupply })[];
};

export function ServiceSuppliesScreen() {
    const navigation = useNavigation();
    const route = useRoute();
    const { user } = useAuth();
    const { showAlert, showConfirm } = useModal();
    const { serviceId } = route.params as { serviceId?: string } || {};
    const [services, setServices] = useState<ServiceWithSupplies[]>([]);
    const [supplies, setSupplies] = useState<AnySupply[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedService, setSelectedService] = useState<ServiceWithSupplies | null>(null);
    const [showLinkModal, setShowLinkModal] = useState(false);
    const [selectedSupply, setSelectedSupply] = useState<AnySupply | null>(null);
    const [quantityPerService, setQuantityPerService] = useState('1');
    const [notes, setNotes] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (user) {
            fetchData();
        }
    }, [user]);

    const [isOwner, setIsOwner] = useState(false);

    useEffect(() => {
        // Check if user is owner
        const checkRole = async () => {
            const { data } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', user!.id)
                .single();
            setIsOwner(data?.role === 'owner');
        };
        checkRole();
    }, [user]);

    const fetchData = async () => {
        try {
            setLoading(true);

            // Check user role
            const { data: profileData } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', user!.id)
                .single();

            const userIsOwner = profileData?.role === 'owner';

            // Fetch services (masters see their own, owners see all)
            let servicesQuery = supabase
                .from('services')
                .select('*')
                .eq('is_active', true);

            if (!userIsOwner) {
                // Masters only see their own services
                servicesQuery = servicesQuery.eq('created_by', user!.id);
            }

            if (serviceId) {
                servicesQuery = servicesQuery.eq('id', serviceId);
            }

            const { data: servicesData, error: servicesError } = await servicesQuery.order('name');

            if (servicesError) throw servicesError;

            // Fetch supplies based on role
            if (userIsOwner) {
                const { data: suppliesData, error: suppliesError } = await supabase
                    .from('owner_supplies')
                    .select('*')
                    .eq('owner_id', user!.id)
                    .order('name');

                if (suppliesError) throw suppliesError;
                setSupplies(suppliesData || []);
            } else {
                const { data: suppliesData, error: suppliesError } = await supabase
                    .from('master_supplies')
                    .select('*')
                    .eq('master_id', user!.id)
                    .order('name');

                if (suppliesError) throw suppliesError;
                setSupplies(suppliesData || []);
            }

            // Fetch service-supply links
            const serviceIds = (servicesData || []).map(s => s.id);
            let linksData: any[] = [];

            if (userIsOwner) {
                let linksQuery = supabase
                    .from('owner_service_supplies')
                    .select('*, supply:owner_supplies(*)');

                if (serviceIds.length > 0) {
                    linksQuery = linksQuery.in('service_id', serviceIds);
                }

                const { data, error: linksError } = await linksQuery;
                if (linksError) throw linksError;
                linksData = data || [];
            } else {
                let linksQuery = supabase
                    .from('service_supplies')
                    .select('*, supply:master_supplies(*)');

                if (serviceIds.length > 0) {
                    linksQuery = linksQuery.in('service_id', serviceIds);
                }

                const { data, error: linksError } = await linksQuery;
                if (linksError) throw linksError;
                linksData = data || [];
            }

            // Merge services with their supplies
            const servicesWithSupplies = (servicesData || []).map(service => ({
                ...service,
                linkedSupplies: linksData.filter(link => link.service_id === service.id)
            }));

            setServices(servicesWithSupplies);
        } catch (error: any) {
            console.error('Error fetching data:', error);
            showAlert('Error', 'Failed to load services and supplies', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleOpenLinkModal = (service: ServiceWithSupplies) => {
        setSelectedService(service);
        setSelectedSupply(null);
        setQuantityPerService('1');
        setNotes('');
        setShowLinkModal(true);
    };

    const handleLinkSupply = async () => {
        if (!selectedService || !selectedSupply) {
            showAlert('Error', 'Please select a supply', 'error');
            return;
        }

        const qty = parseFloat(quantityPerService);
        if (isNaN(qty) || qty <= 0) {
            showAlert('Error', 'Please enter a valid quantity', 'error');
            return;
        }

        if (qty > selectedSupply.quantity) {
            showAlert('Error', `Cannot exceed available stock of ${selectedSupply.quantity} ${selectedSupply.unit}`, 'error');
            return;
        }

        setSaving(true);
        try {
            const tableName = isOwner ? 'owner_service_supplies' : 'service_supplies';
            const { error } = await supabase
                .from(tableName)
                .insert({
                    service_id: selectedService.id,
                    supply_id: selectedSupply.id,
                    quantity_per_service: qty,
                    notes: notes.trim() || null
                });

            if (error) {
                if (error.message.includes('duplicate')) {
                    showAlert('Error', 'This supply is already linked to this service', 'error');
                } else {
                    throw error;
                }
            } else {
                showAlert('Success', 'Supply linked to service!', 'success');
                setShowLinkModal(false);
                fetchData();
            }
        } catch (error: any) {
            showAlert('Error', error.message || 'Failed to link supply', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleUnlinkSupply = async (linkId: string) => {
        showConfirm(
            'Remove Supply Link',
            'Are you sure you want to remove this supply from the service?',
            async () => {
                try {
                    const tableName = isOwner ? 'owner_service_supplies' : 'service_supplies';
                    const { error } = await supabase
                        .from(tableName)
                        .delete()
                        .eq('id', linkId);

                    if (error) throw error;
                    fetchData();
                } catch (error: any) {
                    showAlert('Error', 'Failed to remove supply link', 'error');
                }
            },
            {
                confirmText: 'Remove',
                cancelText: 'Cancel',
                type: 'error'
            }
        );
    };

    const renderServiceItem = ({ item }: { item: ServiceWithSupplies }) => (
        <Card style={styles.serviceCard}>
            <View style={styles.serviceHeader}>
                <View style={styles.serviceInfo}>
                    <MerakiText variant="label" color={colors.accent} style={{ textTransform: 'uppercase', marginBottom: 4 }}>{item.category}</MerakiText>
                    <MerakiText variant="body" color={colors.text} style={{ fontWeight: '600', fontSize: 18, marginBottom: 4 }}>{item.name}</MerakiText>
                    <MerakiText variant="caption" color={colors.textSecondary}>€{item.base_price} • {item.duration_minutes} min</MerakiText>
                </View>
                <TouchableOpacity
                    style={styles.linkButton}
                    onPress={() => handleOpenLinkModal(item)}
                >
                    <MerakiText variant="caption" color={colors.textInvert} style={{ fontWeight: '600' }}>+ Link Supply</MerakiText>
                </TouchableOpacity>
            </View>

            {item.linkedSupplies.length > 0 ? (
                <View style={styles.linkedSuppliesContainer}>
                    <MerakiText variant="label" color={colors.textMuted} style={{ textTransform: 'uppercase', marginBottom: spacing.sm }}>Supplies Used:</MerakiText>
                    {item.linkedSupplies.map((link) => (
                        <View key={link.id} style={styles.linkedSupplyItem}>
                            <View style={styles.linkedSupplyInfo}>
                                <MerakiText variant="body" color={colors.text} style={{ fontWeight: '500' }}>{link.supply.name}</MerakiText>
                                <MerakiText variant="caption" color={colors.textSecondary}>
                                    {link.quantity_per_service} {link.supply.unit}
                                </MerakiText>
                                {link.notes && (
                                    <MerakiText variant="caption" color={colors.textMuted} style={{ fontSize: 11, marginTop: 2 }}>{link.notes}</MerakiText>
                                )}
                            </View>
                            <TouchableOpacity
                                style={styles.unlinkButton}
                                onPress={() => handleUnlinkSupply(link.id)}
                            >
                                <MaterialCommunityIcons name="close" size={16} color="#ef4444" />
                            </TouchableOpacity>
                        </View>
                    ))}
                </View>
            ) : (
                <View style={styles.noSuppliesContainer}>
                    <MerakiText variant="caption" color={colors.textMuted} style={{ fontStyle: 'italic' }}>
                        No supplies linked yet. Tap "+ Link Supply" to associate supplies with this service.
                    </MerakiText>
                </View>
            )}
        </Card>
    );

    const availableSupplies = supplies.filter(s =>
        !selectedService?.linkedSupplies.some(ls => ls.supply_id === s.id)
    );

    return (
        <ScreenBackground>
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={styles.header}>
                    {serviceId && (
                        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                            <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
                        </TouchableOpacity>
                    )}
                    <MerakiText variant="h1">Service Supplies</MerakiText>
                    <MerakiText variant="caption" color={colors.textSecondary} style={{ marginTop: spacing.xs }}>
                        {serviceId
                            ? 'Manage supplies for this service'
                            : 'Link supplies to services for automatic inventory tracking'
                        }
                    </MerakiText>
                </View>

                {loading ? (
                    <ActivityIndicator style={styles.loader} color={colors.primary} />
                ) : services.length === 0 ? (
                    <View style={styles.emptyState}>
                        <View style={styles.emptyIconBg}>
                            <MaterialCommunityIcons name="hand-back-right-outline" size={40} color={colors.textMuted} />
                        </View>
                        <MerakiText variant="h2" color={colors.text} style={{ marginBottom: spacing.sm }}>No Services Yet</MerakiText>
                        <MerakiText variant="caption" color={colors.textSecondary} style={{ textAlign: 'center', marginBottom: spacing.xl }}>
                            Create your first service to start linking supplies.
                        </MerakiText>
                        <TouchableOpacity
                            style={styles.emptyButton}
                            onPress={() => (navigation as any).navigate('CreateService')}
                        >
                            <MerakiText variant="body" color={colors.textInvert} style={{ fontWeight: '600' }}>Create Service</MerakiText>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <FlatList
                        data={services}
                        renderItem={renderServiceItem}
                        keyExtractor={item => item.id}
                        contentContainerStyle={styles.list}
                    />
                )}

                {/* Link Supply Modal */}
                <Modal
                    visible={showLinkModal}
                    animationType="slide"
                    presentationStyle="pageSheet"
                    onRequestClose={() => setShowLinkModal(false)}
                >
                    <ScreenBackground>
                        <SafeAreaView style={styles.modalContainer} edges={['top']}>
                            <View style={styles.modalHeader}>
                                <MerakiText variant="h2" style={{ flex: 1, marginRight: spacing.md }}>Link Supply to {selectedService?.name}</MerakiText>
                                <TouchableOpacity onPress={() => setShowLinkModal(false)}>
                                    <MaterialCommunityIcons name="close" size={24} color={colors.textSecondary} />
                                </TouchableOpacity>
                            </View>

                            <View style={styles.modalContent}>
                                {availableSupplies.length === 0 ? (
                                    <View style={styles.noAvailableSupplies}>
                                        <MerakiText variant="body" color={colors.textSecondary} style={{ textAlign: 'center' }}>
                                            All supplies are already linked to this service.
                                        </MerakiText>
                                    </View>
                                ) : (
                                    <>
                                        <MerakiText variant="body" color={colors.text} style={{ fontWeight: '600', marginBottom: spacing.sm, marginTop: spacing.lg }}>Select Supply</MerakiText>
                                        <View style={styles.supplyList}>
                                            {availableSupplies.map((supply) => (
                                                <TouchableOpacity
                                                    key={supply.id}
                                                    style={[
                                                        styles.supplyOption,
                                                        selectedSupply?.id === supply.id && styles.supplyOptionSelected
                                                    ]}
                                                    onPress={() => setSelectedSupply(supply)}
                                                >
                                                    <MerakiText
                                                        variant="body"
                                                        color={selectedSupply?.id === supply.id ? colors.textInvert : colors.text}
                                                        style={selectedSupply?.id === supply.id ? { fontWeight: '600' } : undefined}
                                                    >
                                                        {supply.name} ({supply.quantity} {supply.unit} available)
                                                    </MerakiText>
                                                </TouchableOpacity>
                                            ))}
                                        </View>

                                        {selectedSupply && (
                                            <>
                                                <MerakiText variant="body" color={colors.text} style={{ fontWeight: '600', marginBottom: spacing.sm, marginTop: spacing.lg }}>
                                                    Quantity Per Service ({selectedSupply.unit})
                                                </MerakiText>
                                                <TextInput
                                                    style={styles.quantityInput}
                                                    value={quantityPerService}
                                                    onChangeText={setQuantityPerService}
                                                    keyboardType="decimal-pad"
                                                    placeholder="1"
                                                    placeholderTextColor={colors.textMuted}
                                                />

                                                <MerakiText variant="body" color={colors.text} style={{ fontWeight: '600', marginBottom: spacing.sm, marginTop: spacing.lg }}>Notes (Optional)</MerakiText>
                                                <TextInput
                                                    style={[styles.quantityInput, styles.notesInput]}
                                                    value={notes}
                                                    onChangeText={setNotes}
                                                    placeholder="e.g., 1 tray for full set, 0.5 for refill"
                                                    placeholderTextColor={colors.textMuted}
                                                    multiline
                                                />

                                                <TouchableOpacity
                                                    style={[
                                                        styles.saveButton,
                                                        (!selectedSupply || saving) && styles.saveButtonDisabled
                                                    ]}
                                                    onPress={handleLinkSupply}
                                                    disabled={!selectedSupply || saving}
                                                >
                                                    <MerakiText variant="body" color={colors.textInvert} style={{ fontWeight: '600' }}>
                                                        {saving ? 'Linking...' : 'Link Supply'}
                                                    </MerakiText>
                                                </TouchableOpacity>
                                            </>
                                        )}
                                    </>
                                )}
                            </View>
                        </SafeAreaView>
                    </ScreenBackground>
                </Modal>
            </SafeAreaView>
        </ScreenBackground>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        padding: spacing.lg,
        paddingBottom: spacing.md,
    },
    backBtn: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: 'rgba(0, 0, 0, 0.04)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.sm,
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.08)',
    },
    list: {
        padding: spacing.lg,
        paddingTop: 0,
    },
    serviceCard: {
        marginBottom: spacing.md,
        padding: spacing.md,
    },
    serviceHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: spacing.md,
    },
    serviceInfo: {
        flex: 1,
        marginRight: spacing.md,
    },
    linkButton: {
        backgroundColor: colors.primary,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: 20,
    },
    linkedSuppliesContainer: {
        borderTopWidth: 1,
        borderTopColor: 'rgba(0, 0, 0, 0.08)',
        paddingTop: spacing.md,
    },
    linkedSupplyItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.02)',
        borderRadius: 8,
        padding: spacing.sm,
        marginBottom: spacing.sm,
    },
    linkedSupplyInfo: {
        flex: 1,
    },
    unlinkButton: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: 'rgba(239, 68, 68, 0.2)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    noSuppliesContainer: {
        borderTopWidth: 1,
        borderTopColor: 'rgba(0, 0, 0, 0.08)',
        paddingTop: spacing.md,
    },
    loader: {
        marginTop: spacing.xl,
    },
    emptyState: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.xl,
    },
    emptyIconBg: {
        width: 72,
        height: 72,
        borderRadius: 20,
        backgroundColor: 'rgba(212,168,83,0.08)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.lg,
    },
    emptyButton: {
        backgroundColor: colors.primary,
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.md,
        borderRadius: 12,
    },
    modalContainer: {
        flex: 1,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0, 0, 0, 0.08)',
    },
    modalContent: {
        flex: 1,
        padding: spacing.lg,
    },
    noAvailableSupplies: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    supplyList: {
        gap: spacing.sm,
    },
    supplyOption: {
        padding: spacing.md,
        borderRadius: 12,
        backgroundColor: 'rgba(0, 0, 0, 0.04)',
        borderWidth: 1,
        borderColor: colors.border,
    },
    supplyOptionSelected: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    quantityInput: {
        backgroundColor: 'rgba(0, 0, 0, 0.04)',
        borderRadius: 12,
        padding: spacing.md,
        fontSize: 16,
        color: colors.text,
        borderWidth: 1,
        borderColor: colors.border,
    },
    notesInput: {
        minHeight: 80,
        textAlignVertical: 'top',
    },
    saveButton: {
        backgroundColor: colors.primary,
        padding: spacing.md,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: spacing.xl,
    },
    saveButtonDisabled: {
        opacity: 0.5,
    },
});

export default ServiceSuppliesScreen;
