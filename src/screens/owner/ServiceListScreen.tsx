import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    RefreshControl,
    ActivityIndicator,
    TouchableOpacity,
    Switch,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { Card, ScreenBackground } from '../../components/ui';
import { colors, spacing } from '../../theme';
import { useModal } from '../../contexts/ModalContext';
import { useAuth } from '../../contexts/AuthContext';
import { Service } from '../../types/database';

export function ServiceListScreen() {
    const navigation = useNavigation<any>();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [services, setServices] = useState<Service[]>([]);
    const [groupedServices, setGroupedServices] = useState<Record<string, Service[]>>({});
    const { showAlert } = useModal();
    const { role } = useAuth();
    const isOwner = role === 'owner';

    useFocusEffect(
        useCallback(() => {
            fetchServices();
        }, [])
    );

    const fetchServices = async () => {
        try {
            const { data, error } = await supabase
                .from('services')
                .select('*')
                .order('category')
                .order('name');

            if (error) throw error;
            setServices(data || []);

            // Group by category
            const grouped: Record<string, Service[]> = {};
            (data || []).forEach(service => {
                const category = service.category || 'Uncategorized';
                if (!grouped[category]) grouped[category] = [];
                grouped[category].push(service);
            });
            setGroupedServices(grouped);
        } catch (error) {
            console.error('Error fetching services:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const toggleActive = async (service: Service) => {
        try {
            const { error } = await supabase
                .from('services')
                .update({ is_active: !service.is_active })
                .eq('id', service.id);

            if (error) throw error;

            // Update local state
            setServices(prev => prev.map(s =>
                s.id === service.id ? { ...s, is_active: !s.is_active } : s
            ));
            setGroupedServices(prev => {
                const newGrouped = { ...prev };
                const category = service.category || 'Uncategorized';
                if (newGrouped[category]) {
                    newGrouped[category] = newGrouped[category].map(s =>
                        s.id === service.id ? { ...s, is_active: !s.is_active } : s
                    );
                }
                return newGrouped;
            });
        } catch (error) {
            console.error('Error toggling service:', error);
            showAlert('Error', 'Failed to update service status', 'error');
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchServices();
    };

    const renderServiceCard = (service: Service) => {
        const isPilates = service.category === 'Pilates';
        const RowContainer: React.ComponentType<any> = isPilates ? View : TouchableOpacity;
        const rowProps = isPilates
            ? { style: styles.serviceCardContent }
            : { onPress: () => navigation.navigate('ServiceForm', { service }), style: styles.serviceCardContent };
        return (
        <Card style={styles.serviceCard} key={service.id}>
            <RowContainer {...rowProps}>
                <View style={styles.serviceInfo}>
                    <Text style={styles.serviceName}>{service.name}</Text>
                    <Text style={styles.serviceDetails}>
                        €{Number(service.base_price).toFixed(2)} • {service.duration_minutes} min
                    </Text>
                </View>
                <Switch
                    value={service.is_active ?? true}
                    onValueChange={() => toggleActive(service)}
                    trackColor={{ false: colors.border, true: '#8B5CF6' }}
                    thumbColor={service.is_active ? '#fff' : '#f4f3f4'}
                />
            </RowContainer>

            {/* Manage Supplies Button */}
            {service.category === 'Pilates' && (
                <TouchableOpacity
                    style={styles.pilatesButton}
                    onPress={() => navigation.navigate('PilatesTimetable', { service })}
                >
                    <Text style={styles.linkSuppliesIcon}>🧘</Text>
                    <Text style={styles.pilatesButtonText}>Manage Pilates Timetable</Text>
                    <Text style={styles.linkSuppliesArrow}>→</Text>
                </TouchableOpacity>
            )}
            <TouchableOpacity
                style={styles.linkSuppliesButton}
                onPress={() => navigation.navigate('ServiceSupplies', { serviceId: service.id })}
            >
                <Text style={styles.linkSuppliesIcon}>📦</Text>
                <Text style={styles.linkSuppliesText}>Manage Supplies</Text>
                <Text style={styles.linkSuppliesArrow}>→</Text>
            </TouchableOpacity>
        </Card>
        );
    };

    if (loading) {
        return (
            <ScreenBackground>
                <SafeAreaView style={styles.container}>
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={colors.text} />
                    </View>
                </SafeAreaView>
            </ScreenBackground>
        );
    }

    const categories = Object.keys(groupedServices).sort();

    return (
        <ScreenBackground>
            <SafeAreaView style={styles.container} edges={['top']}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={styles.title}>Services</Text>
                    <View style={styles.headerActions}>
                        {isOwner && (
                            <TouchableOpacity
                                style={styles.pilatesHeaderButton}
                                onPress={() => navigation.navigate('PilatesHub')}
                            >
                                <MaterialCommunityIcons name="yoga" size={14} color="#FFFFFF" />
                                <Text style={styles.pilatesHeaderButtonText}>Pilates</Text>
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity onPress={() => navigation.navigate('ServiceForm')}>
                            <Text style={styles.addButton}>+ Add</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                <FlatList
                    data={categories}
                    keyExtractor={(item) => item}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} />
                    }
                    renderItem={({ item: category }) => (
                        <View style={styles.categorySection}>
                            <Text style={styles.categoryTitle}>{category}</Text>
                            {groupedServices[category].map(renderServiceCard)}
                        </View>
                    )}
                    ListEmptyComponent={
                        <Card variant="glass" style={styles.emptyCard}>
                            <Text style={styles.emptyIcon}>✨</Text>
                            <Text style={styles.emptyText}>No services yet</Text>
                            <TouchableOpacity
                                style={styles.emptyButton}
                                onPress={() => navigation.navigate('ServiceForm')}
                            >
                                <Text style={styles.emptyButtonText}>Add First Service</Text>
                            </TouchableOpacity>
                        </Card>
                    }
                />
            </SafeAreaView>
        </ScreenBackground>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: spacing.lg,
        paddingBottom: spacing.md,
    },
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
    title: { fontSize: 20, fontWeight: '600', color: colors.text },
    addButton: { fontSize: 16, color: '#8B5CF6', fontWeight: '600' },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    pilatesHeaderButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: spacing.md,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: '#10B981',
    },
    pilatesHeaderButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 12 },
    listContent: { padding: spacing.lg, paddingTop: 0 },
    categorySection: { marginBottom: spacing.lg },
    categoryTitle: {
        fontSize: 12,
        fontWeight: '600',
        color: colors.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: 1.5,
        marginBottom: spacing.sm,
    },
    serviceCard: {
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
    serviceCardContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    serviceInfo: { flex: 1 },
    serviceName: { fontSize: 16, fontWeight: '600', color: colors.text },
    serviceDetails: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
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
    pilatesButton: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: spacing.md,
        paddingTop: spacing.md,
        padding: spacing.sm,
        borderTopWidth: 1,
        borderTopColor: 'rgba(16, 185, 129, 0.18)',
    },
    pilatesButtonText: { flex: 1, fontSize: 14, color: '#047857', fontWeight: '700' },
    emptyCard: { alignItems: 'center', padding: spacing.xl, marginTop: spacing.xl },
    emptyIcon: { fontSize: 48, marginBottom: spacing.md, opacity: 0.5 },
    emptyText: { fontSize: 14, color: colors.textSecondary, marginBottom: spacing.lg },
    emptyButton: {
        backgroundColor: '#8B5CF6',
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.lg,
        borderRadius: 8,
    },
    emptyButtonText: { color: '#1A1A1A', fontWeight: '600' },
});

export default ServiceListScreen;
