import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    Switch,
    TextInput,
    Alert,
    ActivityIndicator,
    RefreshControl,
    KeyboardAvoidingView,
    Platform,
    TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { ScreenBackground, Card } from '../../components/ui';
import { colors, spacing } from '../../theme';
import { Service, MasterService } from '../../types/database';

type ServiceWithConfig = Service & {
    config?: MasterService;
};

export function MyServicesScreen() {
    const navigation = useNavigation();
    const { user } = useAuth();
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
            // 1. Fetch all active global services
            const { data: globalServices, error: servicesError } = await supabase
                .from('services')
                .select('*')
                .eq('is_active', true)
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
            const merged = (globalServices || []).map(service => {
                const config = myConfigs?.find(c => c.service_id === service.id);
                return { ...service, config };
            });

            setServices(merged);
        } catch (error: any) {
            console.error('Error fetching services:', error);
            Alert.alert('Error', error.message);
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
            Alert.alert('Error', 'Failed to update status');
        } finally {
            setUpdating(null);
        }
    };

    const handleUpdateConfig = async (service: ServiceWithConfig, field: 'custom_price' | 'custom_duration', value: string) => {
        // Debouncing would be good here, but for simplicity we save on blur or return key if possible.
        // For now, let's just assume this function is called on EndEditing.

        const numValue = value ? Number(value) : null;
        if (value && isNaN(Number(value))) return; // Invalid

        try {
            if (service.config) {
                const { error } = await supabase
                    .from('master_services')
                    .update({ [field]: numValue })
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
                        [field]: numValue
                    });
                if (error) throw error;
            }
        } catch (error: any) {
            console.error('Update error', error);
        }
    };

    const renderItem = ({ item }: { item: ServiceWithConfig }) => {
        const isEnabled = item.config?.is_available ?? false;
        const currentPrice = item.config?.custom_price?.toString() ?? '';
        const currentDuration = item.config?.custom_duration?.toString() ?? '';

        return (
            <Card style={styles.card}>
                <View style={styles.headerRow}>
                    <View style={styles.info}>
                        <Text style={styles.category}>{item.category}</Text>
                        <Text style={styles.name}>{item.name}</Text>
                        <Text style={styles.baseInfo}>
                            Base: €{item.base_price} • {item.duration_minutes} min
                        </Text>
                    </View>
                    <Switch
                        value={isEnabled}
                        onValueChange={() => handleToggle(item)}
                        trackColor={{ false: colors.textMuted, true: colors.primary }}
                        thumbColor={'#fff'}
                    />
                </View>

                {isEnabled && (
                    <View style={styles.configContainer}>
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>My Price (€)</Text>
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
                            <Text style={styles.label}>Duration (min)</Text>
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
            </Card>
        );
    };

    return (
        <ScreenBackground>
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <Text style={styles.backButtonText}>← Back</Text>
                    </TouchableOpacity>
                    <Text style={styles.title}>My Services</Text>
                    <TouchableOpacity
                        onPress={() => (navigation as any).navigate('CreateService')}
                        style={styles.addButton}
                    >
                        <Text style={styles.addButtonText}>+ New</Text>
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
    backButton: { padding: spacing.xs },
    backButtonText: { color: colors.text, fontSize: 16 },
    title: { fontSize: 20, fontWeight: 'bold', color: colors.text },
    list: { padding: spacing.md },
    card: { padding: spacing.md, marginBottom: spacing.md },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    info: { flex: 1, marginRight: spacing.md },
    category: { fontSize: 12, color: colors.primary, fontWeight: '600', textTransform: 'uppercase', marginBottom: 4 },
    name: { fontSize: 18, color: colors.text, fontWeight: '600', marginBottom: 4 },
    baseInfo: { fontSize: 13, color: colors.textSecondary },
    configContainer: { marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', flexDirection: 'row', gap: spacing.md },
    inputGroup: { flex: 1 },
    label: { fontSize: 12, color: colors.textSecondary, marginBottom: spacing.xs },
    input: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: spacing.sm, color: colors.text, borderWidth: 1, borderColor: colors.border },
    addButton: { backgroundColor: colors.primary, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 20 },
    addButtonText: { color: colors.text, fontSize: 14, fontWeight: '600' },
});

export default MyServicesScreen;
