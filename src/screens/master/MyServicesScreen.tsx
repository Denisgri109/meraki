import React, { useState, useEffect } from 'react';
import {
    View,
    StyleSheet,
    FlatList,
    Switch,
    TextInput,
    ActivityIndicator,
    RefreshControl,
    KeyboardAvoidingView,
    Platform,
    TouchableOpacity,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { ScreenBackground, Card, MerakiText } from '../../components/ui';
import { useModal } from '../../contexts/ModalContext';
import { colors, spacing } from '../../theme';
import { Service, MasterService, type TablesUpdate } from '../../types/database';

type ServiceWithConfig = Service & {
    config?: MasterService;
};

export function MyServicesScreen() {
    const navigation = useNavigation();
    const { user } = useAuth();
    const { showAlert, showConfirm } = useModal();
    const [services, setServices] = useState<ServiceWithConfig[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [updating, setUpdating] = useState<string | null>(null);

    useEffect(() => {
        if (user) {
            fetchData();
        }
    }, [user]);

    const fetchData = async () => {
        try {
            // 1. Fetch only MY services (created by this master)
            const { data: myServices, error: servicesError } = await supabase
                .from('services')
                .select('*')
                .eq('is_active', true)
                .eq('created_by', user!.id)
                .order('category')
                .order('name');

            if (servicesError) throw servicesError;

            // 2. Fetch my configurations
            const { data: myConfigs, error: configsError } = await supabase
                .from('master_services')
                .select('*')
                .eq('master_id', user!.id);

            if (configsError) throw configsError;

            // 3. Merge
            const merged = (myServices || []).map(service => {
                const config = myConfigs?.find(c => c.service_id === service.id);
                return { ...service, config };
            });

            setServices(merged);
        } catch (error: any) {
            console.error('Error fetching services:', error);
            showAlert('Error', error.message, 'error');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchData();
    };

    const handleToggle = async (service: ServiceWithConfig) => {
        const newStatus = !service.config?.is_available;
        setUpdating(service.id);

        try {
            if (service.config) {
                // Update existing
                const { error } = await supabase
                    .from('master_services')
                    .update({ is_available: newStatus })
                    .eq('id', service.config.id);
                if (error) throw error;
            } else {
                // Insert new
                const { error } = await supabase
                    .from('master_services')
                    .insert({
                        master_id: user!.id,
                        service_id: service.id,
                        is_available: newStatus,
                        custom_price: null, // use base
                        custom_duration: null // use base
                    });
                if (error) throw error;
            }
            // Optimistic update
            await fetchData(); // Re-fetch to get simplified logic or just update local state
        } catch (error: any) {
            showAlert('Error', 'Failed to update status', 'error');
        } finally {
            setUpdating(null);
        }
    };

    const handleUpdateConfig = async (service: ServiceWithConfig, field: 'custom_price' | 'custom_duration', value: string) => {
        // Debouncing would be good here, but for simplicity we save on blur or return key if possible.
        // For now, let's just assume this function is called on EndEditing.

        const numValue = value ? Number(value) : null;
        if (value && isNaN(Number(value))) return; // Invalid

        // Spelling the branch out keeps the column literal, so Supabase can still type-check
        // the patch. A computed `{ [field]: numValue }` key widens to Record<string, number>
        // and the generated Update type rejects it.
        const patch: TablesUpdate<'master_services'> =
            field === 'custom_price' ? { custom_price: numValue } : { custom_duration: numValue };

        try {
            if (service.config) {
                const { error } = await supabase
                    .from('master_services')
                    .update(patch)
                    .eq('id', service.config.id);
                if (error) throw error;
            } else {
                // Only create if we are setting a value, implying we want to enable it or just config it
                // Usually custom price implies it's available? Maybe not.
                const { error } = await supabase
                    .from('master_services')
                    .insert({
                        master_id: user!.id,
                        service_id: service.id,
                        is_available: false, // Default to false if just setting price? Or true?
                        ...patch,
                    });
                if (error) throw error;
            }
        } catch (error: any) {
            console.error('Update error', error);
        }
    };

    const handleDelete = (service: ServiceWithConfig) => {
        showConfirm(
            'Delete Service',
            `Are you sure you want to delete "${service.name}"? This action cannot be undone.`,
            async () => {
                try {
                    setUpdating(service.id);
                    const { error } = await supabase
                        .from('services')
                        .delete()
                        .eq('id', service.id);

                    if (error) throw error;

                    fetchData();
                    showAlert('Success', 'Service deleted successfully', 'success');
                } catch (error: any) {
                    console.error('Delete error:', error);
                    showAlert('Error', error.message || 'Failed to delete service', 'error');
                } finally {
                    setUpdating(null);
                }
            },
            {
                type: 'error',
                confirmText: 'Delete',
                cancelText: 'Cancel',
            }
        );
    };

    const renderItem = ({ item }: { item: ServiceWithConfig }) => {
        const isEnabled = item.config?.is_available ?? false;
        const currentPrice = item.config?.custom_price?.toString() ?? '';
        const currentDuration = item.config?.custom_duration?.toString() ?? '';

        return (
            <Card style={styles.card}>
                <View style={styles.headerRow}>
                    <View style={styles.info}>
                        <MerakiText variant="label" color={colors.accent} style={{ textTransform: 'uppercase', marginBottom: 4 }}>{item.category}</MerakiText>
                        <MerakiText variant="body" color={colors.text} style={{ fontWeight: '600', fontSize: 18, marginBottom: 4 }}>{item.name}</MerakiText>
                        <MerakiText variant="caption" color={colors.textSecondary}>
                            Base: €{item.base_price} • {item.duration_minutes} min
                        </MerakiText>
                    </View>
                    <View style={styles.actionRow}>
                        <Switch
                            value={isEnabled}
                            onValueChange={() => handleToggle(item)}
                            trackColor={{ false: colors.textMuted, true: colors.primary }}
                            thumbColor={'#fff'}
                        />
                        {item.category !== 'Pilates' && (
                            <TouchableOpacity
                                accessibilityRole="button"
                                accessibilityLabel="Edit"
                                onPress={() => (navigation as any).navigate('CreateService', { service: item })}
                                style={styles.editButton}
                            >
                                <MaterialCommunityIcons name="pencil-outline" size={20} color={colors.primary} />
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity
                            accessibilityRole="button"
                            accessibilityLabel="Delete"
                            onPress={() => handleDelete(item)}
                            style={styles.deleteButton}
                        >
                            <MaterialCommunityIcons name="trash-can-outline" size={20} color={colors.error || '#FF453A'} />
                        </TouchableOpacity>
                    </View>
                </View>

                {isEnabled && (
                    <View style={styles.configContainer}>
                        <View style={styles.inputGroup}>
                            <MerakiText variant="caption" color={colors.textSecondary} style={{ marginBottom: spacing.xs }}>My Price (€)</MerakiText>
                            <TextInput
                                style={styles.input}
                                placeholder={item.base_price.toString()}
                                placeholderTextColor={colors.textMuted}
                                defaultValue={currentPrice}
                                keyboardType="decimal-pad"
                                onEndEditing={(e) => handleUpdateConfig(item, 'custom_price', e.nativeEvent.text)}
                            />
                        </View>
                        <View style={styles.inputGroup}>
                            <MerakiText variant="caption" color={colors.textSecondary} style={{ marginBottom: spacing.xs }}>Duration (min)</MerakiText>
                            <TextInput
                                style={styles.input}
                                placeholder={item.duration_minutes.toString()}
                                placeholderTextColor={colors.textMuted}
                                defaultValue={currentDuration}
                                keyboardType="number-pad"
                                onEndEditing={(e) => handleUpdateConfig(item, 'custom_duration', e.nativeEvent.text)}
                            />
                        </View>
                    </View>
                )}

                {/* Link Supplies Button */}
                <TouchableOpacity
                    style={styles.linkSuppliesButton}
                    onPress={() => (navigation as any).navigate('ServiceSupplies', { serviceId: item.id })}
                >
                    <MaterialCommunityIcons name="package-variant" size={18} color={colors.accent} style={{ marginRight: spacing.sm }} />
                    <MerakiText variant="body" color={colors.text} style={{ flex: 1, fontWeight: '500' }}>Manage Supplies</MerakiText>
                    <MaterialCommunityIcons name="chevron-right" size={20} color={colors.accent} />
                </TouchableOpacity>
            </Card>
        );
    };

    return (
        <ScreenBackground>
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={styles.header}>
                    <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel="Go back" onPress={() => navigation.goBack()} style={styles.backButton}>
                        <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <MerakiText variant="h2">My Services</MerakiText>
                    <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel="Add"
                        onPress={() => (navigation as any).navigate('CreateService')}
                        style={styles.addButton}
                    >
                        <MaterialCommunityIcons name="plus" size={24} color={colors.text} />
                    </TouchableOpacity>
                </View>

                {loading ? (
                    <ActivityIndicator style={{ marginTop: 20 }} color={colors.primary} />
                ) : (
                    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                        <FlatList
                            data={services}
                            renderItem={renderItem}
                            keyExtractor={item => item.id}
                            contentContainerStyle={styles.list}
                            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                        />
                    </KeyboardAvoidingView>
                )}
            </SafeAreaView>
        </ScreenBackground>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: 'rgba(0, 0, 0, 0.04)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.08)',
    },
    title: { fontSize: 20, fontWeight: 'bold', color: colors.text },
    list: { padding: spacing.md },
    card: { 
        padding: spacing.md, 
        marginBottom: spacing.md,
        borderRadius: 16,
        backgroundColor: '#FFFFFF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
        elevation: 6,
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.08)',
    },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    info: { flex: 1, marginRight: spacing.md },
    category: { fontSize: 12, color: colors.primary, fontWeight: '600', textTransform: 'uppercase', marginBottom: 4 },
    name: { fontSize: 18, color: colors.text, fontWeight: '600', marginBottom: 4 },
    baseInfo: { fontSize: 13, color: colors.textSecondary },
    configContainer: { marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: 'rgba(0, 0, 0, 0.08)', flexDirection: 'row', gap: spacing.md },
    inputGroup: { flex: 1 },
    label: { fontSize: 12, color: colors.textSecondary, marginBottom: spacing.xs },
    input: { backgroundColor: 'rgba(0, 0, 0, 0.04)', borderRadius: 8, padding: spacing.sm, color: colors.text, borderWidth: 1, borderColor: colors.border },
    addButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
    },
    addButtonText: { color: colors.text, fontSize: 14, fontWeight: '600' },
    actionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm
    },
    deleteButton: {
        padding: 4,
        marginLeft: spacing.xs
    },
    editButton: {
        padding: 4,
        marginLeft: spacing.xs
    },
    linkSuppliesButton: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: spacing.md,
        paddingTop: spacing.md,
        padding: spacing.sm,
        borderTopWidth: 1,
        borderTopColor: 'rgba(0, 0, 0, 0.08)'
    },
    linkSuppliesIcon: { fontSize: 16, marginRight: spacing.sm },
    linkSuppliesText: { flex: 1, fontSize: 14, color: colors.text, fontWeight: '500' },
    linkSuppliesArrow: { fontSize: 18, color: colors.primary },
});

export default MyServicesScreen;
