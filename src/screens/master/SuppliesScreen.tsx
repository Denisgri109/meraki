import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { ScreenBackground, Card, MerakiText } from '../../components/ui';
import { useModal } from '../../contexts/ModalContext';
import { colors, spacing } from '../../theme';
import { MasterSupply } from '../../types/database';

export function SuppliesScreen() {
    const navigation = useNavigation();
    const { user } = useAuth();
    const { showAlert, showConfirm } = useModal();
    const [supplies, setSupplies] = useState<MasterSupply[]>([]);
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
                .from('master_supplies')
                .select('*')
                .eq('master_id', user!.id)
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

    const handleDeleteSupply = (supply: MasterSupply) => {
        showConfirm(
            'Delete Supply',
            `Are you sure you want to delete "${supply.name}"? This action cannot be undone.`,
            async () => {
                try {
                    const { error } = await supabase
                        .from('master_supplies')
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
                confirmText: 'Delete',
                cancelText: 'Cancel',
                type: 'error'
            }
        );
    };

    const getStockStatus = (supply: MasterSupply) => {
        const threshold = supply.low_stock_threshold || globalThreshold;
        if (supply.quantity === 0) return { label: 'Out of Stock', color: '#ef4444' };
        if (supply.quantity <= threshold) return { label: 'Low Stock', color: '#f59e0b' };
        return { label: 'In Stock', color: '#10b981' };
    };

    const renderSupplyItem = ({ item }: { item: MasterSupply }) => {
        const stockStatus = getStockStatus(item);

        return (
            <Card style={styles.supplyCard}>
                <TouchableOpacity
                    onPress={() => (navigation as any).navigate('AddSupply', { supply: item })}
                    onLongPress={() => handleDeleteSupply(item)}
                    delayLongPress={500}
                >
                    <View style={styles.supplyHeader}>
                        <View style={styles.supplyInfo}>
                            <MerakiText variant="body" color={colors.text} style={{ fontWeight: '600', fontSize: 18, marginBottom: 4 }}>{item.name}</MerakiText>
                            {item.description && (
                                <MerakiText variant="caption" color={colors.textSecondary} numberOfLines={2} style={{ lineHeight: 20 }}>
                                    {item.description}
                                </MerakiText>
                            )}
                        </View>
                        <View style={[styles.statusBadge, { backgroundColor: stockStatus.color + '20' }]}>
                            <View style={[styles.statusDot, { backgroundColor: stockStatus.color }]} />
                            <MerakiText variant="caption" color={stockStatus.color} style={{ fontWeight: '600' }}>
                                {stockStatus.label}
                            </MerakiText>
                        </View>
                    </View>

                    <View style={styles.quantityRow}>
                        <View style={styles.quantityContainer}>
                            <MerakiText variant="h2" color={colors.text} style={{ fontSize: 24 }}>{item.quantity}</MerakiText>
                            <MerakiText variant="caption" color={colors.textSecondary}>{item.unit}</MerakiText>
                        </View>

                        <View style={styles.thresholdContainer}>
                            <MerakiText variant="caption" color={colors.textMuted}>Low stock at:</MerakiText>
                            <MerakiText variant="caption" color={colors.textSecondary} style={{ fontWeight: '500' }}>
                                {item.low_stock_threshold || globalThreshold} {item.unit}
                            </MerakiText>
                        </View>
                    </View>
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
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <MerakiText variant="h1">My Supplies</MerakiText>
                    <TouchableOpacity
                        style={styles.addButton}
                        onPress={() => (navigation as any).navigate('AddSupply')}
                    >
                        <MaterialCommunityIcons name="plus" size={18} color={colors.text} />
                        <MerakiText variant="label" color={colors.text} style={{ marginLeft: 4 }}>Add</MerakiText>
                    </TouchableOpacity>
                </View>

                {lowStockCount > 0 && (
                    <View style={styles.alertBanner}>
                        <MaterialCommunityIcons name="alert-outline" size={20} color="#f59e0b" style={{ marginRight: spacing.sm }} />
                        <MerakiText variant="body" color="#f59e0b" style={{ fontWeight: '600' }}>
                            {lowStockCount} item{lowStockCount !== 1 ? 's' : ''} running low
                        </MerakiText>
                    </View>
                )}

                {loading ? (
                    <ActivityIndicator style={styles.loader} color={colors.primary} />
                ) : supplies.length === 0 ? (
                    <View style={styles.emptyState}>
                        <View style={{ width: 80, height: 80, borderRadius: 20, backgroundColor: 'rgba(212,168,83,0.08)', alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg }}>
                            <MaterialCommunityIcons name="package-variant" size={40} color={colors.textMuted} />
                        </View>
                        <MerakiText variant="h2" color={colors.text} style={{ marginBottom: spacing.sm }}>No Supplies Yet</MerakiText>
                        <MerakiText variant="caption" color={colors.textSecondary} style={{ textAlign: 'center', lineHeight: 22, marginBottom: spacing.xl }}>
                            Add your first supply to start tracking inventory.{'\n'}
                            Supplies will be automatically deducted when you complete appointments.
                        </MerakiText>
                        <TouchableOpacity
                            style={styles.emptyButton}
                            onPress={() => (navigation as any).navigate('AddSupply')}
                        >
                            <MerakiText variant="body" color={colors.text} style={{ fontWeight: '600' }}>Add Your First Supply</MerakiText>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <FlatList
                        data={supplies}
                        renderItem={renderSupplyItem}
                        keyExtractor={item => item.id}
                        contentContainerStyle={styles.list}
                        refreshControl={
                            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
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
        backgroundColor: 'rgba(255,255,255,0.05)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        marginRight: spacing.md,
    },
    title: {
        fontSize: 28,
        fontWeight: '700',
        color: colors.text,
    },
    addButton: {
        backgroundColor: colors.primary,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: 20,
    },
    addButtonText: {
        color: colors.text,
        fontSize: 14,
        fontWeight: '600',
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
    alertIcon: {
        fontSize: 20,
        marginRight: spacing.sm,
    },
    alertText: {
        fontSize: 14,
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
        fontSize: 18,
        fontWeight: '600',
        color: colors.text,
        marginBottom: 4,
    },
    supplyDescription: {
        fontSize: 14,
        color: colors.textSecondary,
        lineHeight: 20,
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
        fontSize: 12,
        fontWeight: '600',
    },
    quantityRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: spacing.md,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.1)',
    },
    quantityContainer: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: spacing.xs,
    },
    quantityValue: {
        fontSize: 24,
        fontWeight: '700',
        color: colors.text,
    },
    quantityUnit: {
        fontSize: 14,
        color: colors.textSecondary,
    },
    thresholdContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
    },
    thresholdLabel: {
        fontSize: 12,
        color: colors.textMuted,
    },
    thresholdValue: {
        fontSize: 12,
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
        color: colors.text,
        fontSize: 16,
        fontWeight: '600',
    },
});

export default SuppliesScreen;
