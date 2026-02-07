import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    TextInput,
    Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { ScreenBackground, Card } from '../../components/ui';
import { colors, spacing } from '../../theme';
import { Service, MasterSupply, ServiceSupply } from '../../types/database';

type ServiceWithSupplies = Service & {
    linkedSupplies: (ServiceSupply & { supply: MasterSupply })[];
};

export function ServiceSuppliesScreen() {
    const navigation = useNavigation();
    const route = useRoute();
    const { user } = useAuth();
    const { serviceId } = route.params as { serviceId?: string } || {};
    const [services, setServices] = useState<ServiceWithSupplies[]>([]);
    const [supplies, setSupplies] = useState<MasterSupply[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedService, setSelectedService] = useState<ServiceWithSupplies | null>(null);
    const [showLinkModal, setShowLinkModal] = useState(false);
    const [selectedSupply, setSelectedSupply] = useState<MasterSupply | null>(null);
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

            // Only fetch supplies for masters (owners don't have personal supplies)
            if (!userIsOwner) {
                const { data: suppliesData, error: suppliesError } = await supabase
                    .from('master_supplies')
                    .select('*')
                    .eq('master_id', user!.id)
                    .order('name');

                if (suppliesError) throw suppliesError;
                setSupplies(suppliesData || []);
            } else {
                setSupplies([]);
            }

            // Fetch service-supply links
            const serviceIds = (servicesData || []).map(s => s.id);
            let linksQuery = supabase
                .from('service_supplies')
                .select('*, supply:master_supplies(*)');
            
            if (serviceIds.length > 0) {
                linksQuery = linksQuery.in('service_id', serviceIds);
            }
            
            const { data: linksData, error: linksError } = await linksQuery;

            if (linksError) throw linksError;

            // Merge services with their supplies
            const servicesWithSupplies = (servicesData || []).map(service => ({
                ...service,
                linkedSupplies: (linksData || []).filter(link => link.service_id === service.id)
            }));

            setServices(servicesWithSupplies);
        } catch (error: any) {
            console.error('Error fetching data:', error);
            Alert.alert('Error', 'Failed to load services and supplies');
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
            Alert.alert('Error', 'Please select a supply');
            return;
        }

        const qty = parseFloat(quantityPerService);
        if (isNaN(qty) || qty <= 0) {
            Alert.alert('Error', 'Please enter a valid quantity');
            return;
        }

        setSaving(true);
        try {
            const { error } = await supabase
                .from('service_supplies')
                .insert({
                    service_id: selectedService.id,
                    supply_id: selectedSupply.id,
                    quantity_per_service: qty,
                    notes: notes.trim() || null
                });

            if (error) {
                if (error.message.includes('duplicate')) {
                    Alert.alert('Error', 'This supply is already linked to this service');
                } else {
                    throw error;
                }
            } else {
                Alert.alert('Success', 'Supply linked to service!');
                setShowLinkModal(false);
                fetchData();
            }
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to link supply');
        } finally {
            setSaving(false);
        }
    };

    const handleUnlinkSupply = async (linkId: string) => {
        Alert.alert(
            'Remove Supply Link',
            'Are you sure you want to remove this supply from the service?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const { error } = await supabase
                                .from('service_supplies')
                                .delete()
                                .eq('id', linkId);

                            if (error) throw error;
                            fetchData();
                        } catch (error: any) {
                            Alert.alert('Error', 'Failed to remove supply link');
                        }
                    }
                }
            ]
        );
    };

    const renderServiceItem = ({ item }: { item: ServiceWithSupplies }) => (
        <Card style={styles.serviceCard}>
            <View style={styles.serviceHeader}>
                <View style={styles.serviceInfo}>
                    <Text style={styles.serviceCategory}>{item.category}</Text>
                    <Text style={styles.serviceName}>{item.name}</Text>
                    <Text style={styles.servicePrice}>€{item.base_price} • {item.duration_minutes} min</Text>
                </View>
                {!isOwner && (
                    <TouchableOpacity
                        style={styles.linkButton}
                        onPress={() => handleOpenLinkModal(item)}
                    >
                        <Text style={styles.linkButtonText}>+ Link Supply</Text>
                    </TouchableOpacity>
                )}
            </View>

            {item.linkedSupplies.length > 0 ? (
                <View style={styles.linkedSuppliesContainer}>
                    <Text style={styles.linkedSuppliesTitle}>Supplies Used:</Text>
                    {item.linkedSupplies.map((link) => (
                        <View key={link.id} style={styles.linkedSupplyItem}>
                            <View style={styles.linkedSupplyInfo}>
                                <Text style={styles.linkedSupplyName}>{link.supply.name}</Text>
                                <Text style={styles.linkedSupplyQty}>
                                    {link.quantity_per_service} {link.supply.unit}
                                </Text>
                                {link.notes && (
                                    <Text style={styles.linkedSupplyNotes}>{link.notes}</Text>
                                )}
                            </View>
                            {!isOwner && (
                                <TouchableOpacity
                                    style={styles.unlinkButton}
                                    onPress={() => handleUnlinkSupply(link.id)}
                                >
                                    <Text style={styles.unlinkButtonText}>×</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    ))}
                </View>
            ) : (
                <View style={styles.noSuppliesContainer}>
                    <Text style={styles.noSuppliesText}>
                        {isOwner 
                            ? 'No supplies linked to this service yet.'
                            : 'No supplies linked. Supplies will not be automatically deducted for this service.'
                        }
                    </Text>
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
                        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                            <Text style={styles.backText}>← Back</Text>
                        </TouchableOpacity>
                    )}
                    <Text style={styles.title}>Service Supplies</Text>
                    <Text style={styles.subtitle}>
                        {isOwner
                            ? 'View supply requirements for services (read-only)'
                            : serviceId 
                                ? `Manage supplies for this service`
                                : 'Link supplies to services for automatic inventory tracking'
                        }
                    </Text>
                </View>

                {loading ? (
                    <ActivityIndicator style={styles.loader} color={colors.primary} />
                ) : services.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyIcon}>💅</Text>
                        <Text style={styles.emptyTitle}>No Services Yet</Text>
                        <Text style={styles.emptyDescription}>
                            Create your first service to start linking supplies.
                        </Text>
                        <TouchableOpacity
                            style={styles.emptyButton}
                            onPress={() => (navigation as any).navigate('CreateService')}
                        >
                            <Text style={styles.emptyButtonText}>Create Service</Text>
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
                                <Text style={styles.modalTitle}>Link Supply to {selectedService?.name}</Text>
                                <TouchableOpacity onPress={() => setShowLinkModal(false)}>
                                    <Text style={styles.closeButton}>✕</Text>
                                </TouchableOpacity>
                            </View>

                            <View style={styles.modalContent}>
                                {availableSupplies.length === 0 ? (
                                    <View style={styles.noAvailableSupplies}>
                                        <Text style={styles.noAvailableText}>
                                            All supplies are already linked to this service.
                                        </Text>
                                    </View>
                                ) : (
                                    <>
                                        <Text style={styles.sectionLabel}>Select Supply</Text>
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
                                                    <Text style={[
                                                        styles.supplyOptionText,
                                                        selectedSupply?.id === supply.id && styles.supplyOptionTextSelected
                                                    ]}>
                                                        {supply.name} ({supply.quantity} {supply.unit} available)
                                                    </Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>

                                        {selectedSupply && (
                                            <>
                                                <Text style={styles.sectionLabel}>
                                                    Quantity Per Service ({selectedSupply.unit})
                                                </Text>
                                                <TextInput
                                                    style={styles.quantityInput}
                                                    value={quantityPerService}
                                                    onChangeText={setQuantityPerService}
                                                    keyboardType="decimal-pad"
                                                    placeholder="1"
                                                />

                                                <Text style={styles.sectionLabel}>Notes (Optional)</Text>
                                                <TextInput
                                                    style={[styles.quantityInput, styles.notesInput]}
                                                    value={notes}
                                                    onChangeText={setNotes}
                                                    placeholder="e.g., 1 tray for full set, 0.5 for refill"
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
                                                    <Text style={styles.saveButtonText}>
                                                        {saving ? 'Linking...' : 'Link Supply'}
                                                    </Text>
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
    backButton: {
        marginBottom: spacing.sm,
    },
    backText: {
        fontSize: 16,
        color: colors.textSecondary,
    },
    title: {
        fontSize: 28,
        fontWeight: '700',
        color: colors.text,
        marginBottom: spacing.xs,
    },
    subtitle: {
        fontSize: 14,
        color: colors.textSecondary,
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
    serviceCategory: {
        fontSize: 12,
        color: colors.primary,
        fontWeight: '600',
        textTransform: 'uppercase',
        marginBottom: 4,
    },
    serviceName: {
        fontSize: 18,
        fontWeight: '600',
        color: colors.text,
        marginBottom: 4,
    },
    servicePrice: {
        fontSize: 14,
        color: colors.textSecondary,
    },
    linkButton: {
        backgroundColor: colors.primary,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: 20,
    },
    linkButtonText: {
        color: colors.text,
        fontSize: 12,
        fontWeight: '600',
    },
    linkedSuppliesContainer: {
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.1)',
        paddingTop: spacing.md,
    },
    linkedSuppliesTitle: {
        fontSize: 12,
        color: colors.textMuted,
        marginBottom: spacing.sm,
        textTransform: 'uppercase',
    },
    linkedSupplyItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 8,
        padding: spacing.sm,
        marginBottom: spacing.sm,
    },
    linkedSupplyInfo: {
        flex: 1,
    },
    linkedSupplyName: {
        fontSize: 14,
        color: colors.text,
        fontWeight: '500',
    },
    linkedSupplyQty: {
        fontSize: 12,
        color: colors.textSecondary,
    },
    linkedSupplyNotes: {
        fontSize: 11,
        color: colors.textMuted,
        marginTop: 2,
    },
    unlinkButton: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: 'rgba(239, 68, 68, 0.2)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    unlinkButtonText: {
        fontSize: 18,
        color: '#ef4444',
        fontWeight: '600',
    },
    noSuppliesContainer: {
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.1)',
        paddingTop: spacing.md,
    },
    noSuppliesText: {
        fontSize: 13,
        color: colors.textMuted,
        fontStyle: 'italic',
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
    emptyIcon: {
        fontSize: 64,
        marginBottom: spacing.lg,
    },
    emptyTitle: {
        fontSize: 24,
        fontWeight: '600',
        color: colors.text,
        marginBottom: spacing.sm,
    },
    emptyDescription: {
        fontSize: 14,
        color: colors.textSecondary,
        textAlign: 'center',
        marginBottom: spacing.xl,
    },
    emptyButton: {
        backgroundColor: colors.primary,
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.md,
        borderRadius: 12,
    },
    emptyButtonText: {
        color: colors.text,
        fontSize: 16,
        fontWeight: '600',
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
        borderBottomColor: 'rgba(255,255,255,0.1)',
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: colors.text,
        flex: 1,
        marginRight: spacing.md,
    },
    closeButton: {
        fontSize: 24,
        color: colors.textSecondary,
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
    noAvailableText: {
        fontSize: 16,
        color: colors.textSecondary,
        textAlign: 'center',
    },
    sectionLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.text,
        marginBottom: spacing.sm,
        marginTop: spacing.lg,
    },
    supplyList: {
        gap: spacing.sm,
    },
    supplyOption: {
        padding: spacing.md,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderWidth: 1,
        borderColor: colors.border,
    },
    supplyOptionSelected: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    supplyOptionText: {
        fontSize: 16,
        color: colors.text,
    },
    supplyOptionTextSelected: {
        fontWeight: '600',
    },
    quantityInput: {
        backgroundColor: 'rgba(255,255,255,0.05)',
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
    saveButtonText: {
        color: colors.text,
        fontSize: 16,
        fontWeight: '600',
    },
});

export default ServiceSuppliesScreen;
