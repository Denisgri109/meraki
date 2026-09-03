import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
} from 'react-native';
import { useModal } from '../../contexts/ModalContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { ScreenBackground, Card, MerakiText } from '../../components/ui';
import { colors, spacing } from '../../theme';
import { OwnerSupply } from '../../types/database';

export function OwnerSuppliesScreen() {
    const navigation = useNavigation();
    const { user } = useAuth();
    const { showAlert, showConfirm } = useModal();
    const [supplies, setSupplies] = useState<OwnerSupply[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [globalThreshold, setGlobalThreshold] = useState(5);

    useEffect(() => {
        fetchGlobalThreshold();
    }, []);

    useFocusEffect(
        useCallback(() => {
            if (user) {
                fetchSupplies();
            }
        }, [user])
    );

    const fetchGlobalThreshold = async () => {
        try {
            const { data, error } = await supabase
                .from('global_settings')
                .select('value')
                .eq('key', 'low_stock_threshold')
                .single();

            if (!error && data) {
                setGlobalThreshold(parseInt(data.value) || 5);
            }
        } catch (err) {
            console.error('Error fetching global threshold:', err);
        }
    };

    const fetchSupplies = async () => {
        try {
            const { data, error } = await supabase
                .from('owner_supplies')
                .select('*')
                .eq('owner_id', user!.id)
                .order('name');

            if (error) throw error;
            setSupplies(data || []);
        } catch (error: any) {
            console.error('Error fetching supplies:', error);
            showAlert('Error', 'Failed to load supplies', 'error');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchSupplies();
    };

    const handleDeleteSupply = (supply: OwnerSupply) => {
        showConfirm(
            'Delete Supply',
            `Are you sure you want to delete "${supply.name}"? This action cannot be undone.`,
            async () => {
                try {
                    const { error } = await supabase
                        .from('owner_supplies')
                        .delete()
                        .eq('id', supply.id);

                    if (error) throw error;

                    // Remove from local state
                    setSupplies(supplies.filter(s => s.id !== supply.id));
                } catch (error: any) {
                    showAlert('Error', 'Failed to delete supply', 'error');
                }
            },
            {
                type: 'warning',
                confirmText: 'Delete',
                cancelText: 'Cancel'
            }
        );
    };

    const getStockStatus = (supply: OwnerSupply) => {
        const threshold = supply.low_stock_threshold || globalThreshold;
        if (supply.quantity === 0) return { label: 'Out of Stock', color: '#ef4444' };
        if (supply.quantity <= threshold) return { label: 'Low Stock', color: '#f59e0b' };
        return { label: 'In Stock', color: '#10b981' };
    };

    const renderSupplyItem = ({ item }: { item: OwnerSupply }) => {
        const stockStatus = getStockStatus(item);

        return (
            <Card style={styles.supplyCard}>
                <TouchableOpacity
                    onPress={() => (navigation as any).navigate('AddOwnerSupply', { supply: item })}
                    onLongPress={() => handleDeleteSupply(item)}
                    delayLongPress={500}
                >
                    <View style={styles.supplyHeader}>
                        <View style={styles.supplyInfo}>
                            <MerakiText variant="h3" style={styles.supplyName}>{item.name}</MerakiText>
                            {item.description && (
                                <MerakiText variant="caption" style={styles.supplyDescription} numberOfLines={2}>
                                    {item.description}
                                </MerakiText>
                            )}
                        </View>
                        <View style={[styles.statusBadge, { backgroundColor: stockStatus.color + '20' }]}>
                            <View style={[styles.statusDot, { backgroundColor: stockStatus.color }]} />
                            <MerakiText variant="caption" style={[styles.statusText, { color: stockStatus.color }]}>
                                {stockStatus.label}
                            </MerakiText>
                        </View>
                    </View>

                    <View style={styles.quantityRow}>
                        <View style={styles.quantityContainer}>
                            <MerakiText variant="h2" style={styles.quantityValue}>{item.quantity}</MerakiText>
                            <MerakiText variant="body" style={styles.quantityUnit}>{item.unit}</MerakiText>
                        </View>

                        <View style={styles.thresholdContainer}>
                            <MerakiText variant="caption" style={styles.thresholdLabel}>Low stock at:</MerakiText>
                            <MerakiText variant="caption" style={styles.thresholdValue}>
                                {item.low_stock_threshold || globalThreshold} {item.unit}
                            </MerakiText>
                        </View>
                    </View>
                </TouchableOpacity>
                <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Delete"
                    style={styles.deleteButton}
                    onPress={() => handleDeleteSupply(item)}
                >
                    <MaterialCommunityIcons name="trash-can-outline" size={18} color={'#FF453A'} />
                </TouchableOpacity>
            </Card>
        );
    };

    const lowStockCount = supplies.filter(s => {
        const threshold = s.low_stock_threshold || globalThreshold;
        return s.quantity <= threshold;
    }).length;

    return (
        <ScreenBackground>
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={styles.header}>
                    <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel="Go back" onPress={() => navigation.goBack()} style={styles.backButton}>
                        <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <MerakiText variant="h3" style={styles.title}>My Supplies</MerakiText>
                    <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel="Add"
                        style={styles.addButton}
                        onPress={() => (navigation as any).navigate('AddOwnerSupply')}
                    >
                        <MaterialCommunityIcons name="plus" size={24} color={colors.text} />
                    </TouchableOpacity>
                </View>

                {lowStockCount > 0 && (
                    <View style={styles.alertBanner}>
                        <MaterialCommunityIcons name="alert" size={20} color="#f59e0b" style={{ marginRight: spacing.sm }} />
                        <MerakiText variant="body" style={styles.alertText}>
                            {lowStockCount} item{lowStockCount !== 1 ? 's' : ''} running low
                        </MerakiText>
                    </View>
                )}

                {loading ? (
                    <ActivityIndicator style={styles.loader} color={colors.primary} />
                ) : supplies.length === 0 ? (
                    <View style={styles.emptyState}>
                        <MaterialCommunityIcons name="package-variant" size={64} color={colors.textMuted} style={styles.emptyIcon} />
                        <MerakiText variant="h3" style={styles.emptyTitle}>No Supplies Yet</MerakiText>
                        <MerakiText variant="body" style={styles.emptyDescription}>
                            Add your first supply to start tracking inventory.{'\n'}
                            Keep track of your personal stock and get notified when running low.
                        </MerakiText>
                        <TouchableOpacity
                            style={styles.emptyButton}
                            onPress={() => (navigation as any).navigate('AddOwnerSupply')}
                        >
                            <MerakiText variant="body" style={styles.emptyButtonText}>Add Your First Supply</MerakiText>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <FlatList
                        data={supplies}
                        renderItem={renderSupplyItem}
                        keyExtractor={item => item.id}
                        contentContainerStyle={styles.list}
                        refreshControl={
                            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} />
                        }
                    />
                )}
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
        paddingBottom: spacing.md,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: 'rgba(0, 0, 0, 0.04)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        color: colors.text,
    },
    addButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
    },
    alertBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        marginHorizontal: spacing.lg,
        marginBottom: spacing.md,
        padding: spacing.md,
        borderRadius: 12,
        borderLeftWidth: 4,
        borderLeftColor: '#f59e0b',
    },
    alertText: {
        color: '#f59e0b',
        fontWeight: '600',
    },
    list: {
        padding: spacing.lg,
        paddingTop: 0,
    },
    supplyCard: {
        marginBottom: spacing.md,
        padding: spacing.md,
    },
    supplyHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: spacing.md,
    },
    supplyInfo: {
        flex: 1,
        marginRight: spacing.md,
    },
    supplyName: {
        color: colors.text,
        marginBottom: 4,
    },
    supplyDescription: {
        color: colors.textSecondary,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        borderRadius: 12,
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        marginRight: 6,
    },
    statusText: {
        fontWeight: '600',
    },
    quantityRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: spacing.md,
        borderTopWidth: 1,
        borderTopColor: 'rgba(0, 0, 0, 0.08)',
    },
    quantityContainer: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: spacing.xs,
    },
    quantityValue: {
        color: colors.text,
    },
    quantityUnit: {
        color: colors.textSecondary,
    },
    thresholdContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
    },
    thresholdLabel: {
        color: colors.textMuted,
    },
    thresholdValue: {
        color: colors.textSecondary,
        fontWeight: '500',
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
        marginBottom: spacing.lg,
    },
    emptyTitle: {
        color: colors.text,
        marginBottom: spacing.sm,
    },
    emptyDescription: {
        color: colors.textSecondary,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: spacing.xl,
    },
    emptyButton: {
        backgroundColor: colors.primary,
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.md,
        borderRadius: 12,
    },
    emptyButtonText: {
        color: colors.textInvert,
        fontWeight: '600',
    },
    deleteButton: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        paddingTop: spacing.sm,
        paddingRight: spacing.xs,
    },
});

export default OwnerSuppliesScreen;
