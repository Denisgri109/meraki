import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    Alert,
    TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../lib/supabase';
import { ScreenBackground, Button, ConfirmModal } from '../../components/ui';
import { colors, spacing } from '../../theme';

interface Product {
    id: string;
    name: string;
    stock_count: number;
    low_stock_threshold: number;
    retail_price: number;
    wholesale_price: number;
    category: string | null;
    is_active: boolean;
}

export function InventoryScreen() {
    const navigation = useNavigation<any>();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [products, setProducts] = useState<Product[]>([]);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [editStock, setEditStock] = useState('');
    const [editThreshold, setEditThreshold] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchProducts();
    }, []);

    const fetchProducts = async () => {
        try {
            const { data, error } = await (supabase as any)
                .from('products')
                .select('*')
                .eq('is_active', true)
                .order('stock_count', { ascending: true });

            if (error) throw error;
            setProducts(data || []);
        } catch (error) {
            console.error('Error fetching products:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchProducts();
    };

    const handleEditProduct = (product: Product) => {
        setEditingProduct(product);
        setEditStock(product.stock_count.toString());
        setEditThreshold(product.low_stock_threshold.toString());
    };

    const handleSaveStock = async () => {
        if (!editingProduct) return;

        setSaving(true);
        try {
            const { error } = await (supabase as any)
                .from('products')
                .update({
                    stock_count: parseInt(editStock) || 0,
                    low_stock_threshold: parseInt(editThreshold) || 5,
                })
                .eq('id', editingProduct.id);

            if (error) throw error;

            Alert.alert('Success', 'Stock updated successfully');
            setEditingProduct(null);
            fetchProducts();
        } catch (error: any) {
            Alert.alert('Error', error.message);
        } finally {
            setSaving(false);
        }
    };

    const getLowStockProducts = () => products.filter(p => p.stock_count < p.low_stock_threshold);
    const getOutOfStockProducts = () => products.filter(p => p.stock_count === 0);

    const getCategoryIcon = (category: string | null) => {
        switch (category) {
            case 'Nails': return '💅';
            case 'Lashes': return '👁️';
            case 'Brows': return '✨';
            case 'Equipment': return '🔧';
            default: return '🛍️';
        }
    };

    const getStockStatus = (product: Product) => {
        if (product.stock_count === 0) return { label: 'Out of Stock', color: colors.error, bg: 'rgba(239,68,68,0.1)' };
        if (product.stock_count < product.low_stock_threshold) return { label: 'Low Stock', color: '#F59E0B', bg: 'rgba(245,158,11,0.1)' };
        return { label: 'In Stock', color: colors.success, bg: 'rgba(34,197,94,0.1)' };
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

    return (
        <ScreenBackground>
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()}>
                        <Text style={styles.backButton}>←</Text>
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Inventory</Text>
                    <View style={{ width: 40 }} />
                </View>

                <ScrollView
                    contentContainerStyle={styles.content}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} />
                    }
                    showsVerticalScrollIndicator={false}
                >
                    {/* Summary Cards */}
                    <View style={styles.summaryRow}>
                        <View style={[styles.summaryCard, { backgroundColor: 'rgba(239,68,68,0.1)' }]}>
                            <Text style={styles.summaryNumber}>{getOutOfStockProducts().length}</Text>
                            <Text style={styles.summaryLabel}>Out of Stock</Text>
                        </View>
                        <View style={[styles.summaryCard, { backgroundColor: 'rgba(245,158,11,0.1)' }]}>
                            <Text style={styles.summaryNumber}>{getLowStockProducts().length}</Text>
                            <Text style={styles.summaryLabel}>Low Stock</Text>
                        </View>
                        <View style={[styles.summaryCard, { backgroundColor: 'rgba(34,197,94,0.1)' }]}>
                            <Text style={styles.summaryNumber}>{products.length}</Text>
                            <Text style={styles.summaryLabel}>Total Products</Text>
                        </View>
                    </View>

                    {/* Low Stock Alert */}
                    {getLowStockProducts().length > 0 && (
                        <View style={styles.alertCard}>
                            <Text style={styles.alertIcon}>⚠️</Text>
                            <Text style={styles.alertText}>
                                {getLowStockProducts().length} products need restocking
                            </Text>
                        </View>
                    )}

                    {/* Products List */}
                    <Text style={styles.sectionTitle}>All Products</Text>
                    {products.map((product) => {
                        const status = getStockStatus(product);
                        return (
                            <TouchableOpacity
                                key={product.id}
                                style={styles.productCard}
                                onPress={() => handleEditProduct(product)}
                            >
                                <View style={styles.productIcon}>
                                    <Text style={styles.productEmoji}>{getCategoryIcon(product.category)}</Text>
                                </View>
                                <View style={styles.productInfo}>
                                    <Text style={styles.productName} numberOfLines={1}>{product.name}</Text>
                                    <Text style={styles.productCategory}>{product.category}</Text>
                                </View>
                                <View style={styles.stockInfo}>
                                    <Text style={styles.stockCount}>{product.stock_count}</Text>
                                    <View style={[styles.stockBadge, { backgroundColor: status.bg }]}>
                                        <Text style={[styles.stockBadgeText, { color: status.color }]}>
                                            {status.label}
                                        </Text>
                                    </View>
                                </View>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>

                {/* Edit Stock Modal */}
                <ConfirmModal
                    visible={!!editingProduct}
                    onClose={() => setEditingProduct(null)}
                    onConfirm={handleSaveStock}
                    title="Update Stock"
                    message={editingProduct?.name}
                    confirmText={saving ? 'Saving...' : 'Save'}
                    loading={saving}
                    icon="📦"
                >
                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Current Stock</Text>
                        <TextInput
                            style={styles.input}
                            value={editStock}
                            onChangeText={setEditStock}
                            keyboardType="number-pad"
                            placeholderTextColor={colors.textMuted}
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Low Stock Threshold</Text>
                        <TextInput
                            style={styles.input}
                            value={editThreshold}
                            onChangeText={setEditThreshold}
                            keyboardType="number-pad"
                            placeholderTextColor={colors.textMuted}
                        />
                    </View>
                </ConfirmModal>
            </SafeAreaView>
        </ScreenBackground>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    backButton: { fontSize: 28, color: colors.text },
    headerTitle: { fontSize: 18, fontWeight: '600', color: colors.text },
    content: { padding: spacing.lg, paddingBottom: 100 },
    summaryRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg },
    summaryCard: {
        flex: 1,
        borderRadius: 16,
        padding: spacing.md,
        alignItems: 'center',
    },
    summaryNumber: { fontSize: 28, fontWeight: '700', color: colors.text },
    summaryLabel: { fontSize: 11, color: colors.textSecondary, marginTop: 4 },
    alertCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(245,158,11,0.1)',
        borderRadius: 12,
        padding: spacing.md,
        marginBottom: spacing.lg,
        borderWidth: 1,
        borderColor: 'rgba(245,158,11,0.3)',
    },
    alertIcon: { fontSize: 20, marginRight: spacing.sm },
    alertText: { flex: 1, fontSize: 14, color: colors.text },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.textSecondary,
        marginBottom: spacing.md,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    productCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: spacing.md,
        marginBottom: spacing.sm,
        borderWidth: 1,
        borderColor: colors.border,
    },
    productIcon: {
        width: 44,
        height: 44,
        borderRadius: 10,
        backgroundColor: 'rgba(139,92,246,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    productEmoji: { fontSize: 20 },
    productInfo: { flex: 1, marginLeft: spacing.md },
    productName: { fontSize: 14, fontWeight: '600', color: colors.text },
    productCategory: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
    stockInfo: { alignItems: 'flex-end' },
    stockCount: { fontSize: 20, fontWeight: '700', color: colors.text },
    stockBadge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: 4, marginTop: 4 },
    stockBadgeText: { fontSize: 10, fontWeight: '600' },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.lg,
    },
    modalContent: {
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: spacing.lg,
        width: '100%',
        maxWidth: 400,
        borderWidth: 1,
        borderColor: colors.border,
    },
    modalTitle: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
    modalProductName: { fontSize: 14, color: colors.textSecondary, marginBottom: spacing.lg },
    inputGroup: { marginBottom: spacing.md },
    inputLabel: { fontSize: 12, color: colors.textMuted, marginBottom: spacing.xs },
    input: {
        backgroundColor: colors.background,
        borderRadius: 12,
        padding: spacing.md,
        color: colors.text,
        fontSize: 18,
        fontWeight: '600',
        borderWidth: 1,
        borderColor: colors.border,
        textAlign: 'center',
    },
    modalButtons: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
    cancelButton: {
        flex: 1,
        paddingVertical: spacing.md,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center',
    },
    cancelButtonText: { color: colors.textSecondary, fontWeight: '600' },
});

export default InventoryScreen;
