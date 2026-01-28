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
    Modal,
    Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Card, Button, ScreenBackground } from '../../components/ui';
import { colors, spacing } from '../../theme';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - spacing.lg * 3) / 2;

type Product = {
    id: string;
    name: string;
    description: string | null;
    image_url: string | null;
    retail_price: number;
    wholesale_price: number;
    stock_count: number;
    category: string | null;
    is_active: boolean;
};

const CATEGORIES = [
    { label: 'All', icon: '✨' },
    { label: 'Nails', icon: '💅' },
    { label: 'Lashes', icon: '👁️' },
    { label: 'Brows', icon: '✨' },
    { label: 'Equipment', icon: '🔧' },
];

import { safeSupabaseFetch } from '../../lib/supabaseApi';

export function ShopScreen() {
    const navigation = useNavigation<any>();
    const { profile, checkSession } = useAuth();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [products, setProducts] = useState<Product[]>([]);
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);
    const [newProduct, setNewProduct] = useState({
        name: '',
        description: '',
        retail_price: '',
        wholesale_price: '',
        stock_count: '',
        category: 'Nails',
    });
    const [saving, setSaving] = useState(false);

    const isMaster = profile?.is_master || profile?.role === 'master';
    const isAdmin = (profile?.role as string) === 'admin' || profile?.role === 'owner';

    useEffect(() => {
        fetchProducts();
    }, []);

    const fetchProducts = async () => {
        try {
            const productPromise = (supabase as any)
                .from('products')
                .select('*')
                .eq('is_active', true)
                .order('name');

            const { data, error } = await safeSupabaseFetch(productPromise, {
                timeout: 10000,
                errorMessage: 'Failed to load products'
            });

            if (error) throw error;
            setProducts((data as any) || []);
        } catch (error) {
            console.error('Error fetching products:', error);
            setProducts([]);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };



    const onRefresh = () => {
        setRefreshing(true);
        fetchProducts();
    };

    const handleAddProduct = async () => {
        if (!newProduct.name || !newProduct.retail_price || !newProduct.wholesale_price) {
            Alert.alert('Error', 'Please fill in all required fields');
            return;
        }

        setSaving(true);
        try {
            const { error } = await (supabase as any).from('products').insert({
                name: newProduct.name,
                description: newProduct.description || null,
                retail_price: parseFloat(newProduct.retail_price),
                wholesale_price: parseFloat(newProduct.wholesale_price),
                stock_count: parseInt(newProduct.stock_count) || 0,
                category: newProduct.category,
            });

            if (error) throw error;

            Alert.alert('Success', 'Product added successfully');
            setShowAddModal(false);
            setNewProduct({
                name: '',
                description: '',
                retail_price: '',
                wholesale_price: '',
                stock_count: '',
                category: 'Nails',
            });
            fetchProducts();
        } catch (error: any) {
            Alert.alert('Error', error.message);
        } finally {
            setSaving(false);
        }
    };

    const filteredProducts = products.filter(p => {
        const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
        const matchesSearch = !searchQuery ||
            p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.description?.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesCategory && matchesSearch;
    });

    const getPrice = (product: Product) => {
        return (isMaster || isAdmin) ? product.wholesale_price : product.retail_price;
    };

    const getCategoryIcon = (category: string | null) => {
        switch (category) {
            case 'Nails': return '💅';
            case 'Lashes': return '👁️';
            case 'Brows': return '✨';
            case 'Equipment': return '🔧';
            default: return '🛍️';
        }
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
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} />
                    }
                    showsVerticalScrollIndicator={false}
                >
                    {/* Premium Header */}
                    <LinearGradient
                        colors={['#1E0A40', '#000000']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 0, y: 1 }}
                        style={styles.headerGradient}
                    >
                        <View style={styles.headerContent}>
                            <View style={styles.headerTop}>
                                <View>
                                    <Text style={styles.headerTitle}>Shop</Text>
                                    <Text style={styles.headerSubtitle}>
                                        {(isMaster || isAdmin) ? 'Wholesale Prices' : 'Premium Beauty Products'}
                                    </Text>
                                </View>
                                {isAdmin && (
                                    <TouchableOpacity style={styles.addButton} onPress={() => setShowAddModal(true)}>
                                        <Text style={styles.addButtonText}>+ Add</Text>
                                    </TouchableOpacity>
                                )}
                            </View>

                            {/* Search Bar */}
                            <View style={styles.searchContainer}>
                                <Text style={styles.searchIcon}>🔍</Text>
                                <TextInput
                                    style={styles.searchInput}
                                    placeholder="Search products..."
                                    placeholderTextColor="rgba(15,15,19,0.5)"
                                    value={searchQuery}
                                    onChangeText={setSearchQuery}
                                />
                            </View>
                        </View>
                    </LinearGradient>

                    {/* Categories */}
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={styles.categoriesScroll}
                        contentContainerStyle={styles.categories}
                    >
                        {CATEGORIES.map((cat) => (
                            <TouchableOpacity
                                key={cat.label}
                                onPress={() => setSelectedCategory(cat.label)}
                                style={[
                                    styles.categoryChip,
                                    selectedCategory === cat.label && styles.categoryChipActive,
                                ]}
                            >
                                <Text style={styles.categoryIcon}>{cat.icon}</Text>
                                <Text style={[
                                    styles.categoryText,
                                    selectedCategory === cat.label && styles.categoryTextActive,
                                ]}>
                                    {cat.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>

                    {/* Products Grid */}
                    <View style={styles.productsSection}>
                        <Text style={styles.resultsText}>
                            {filteredProducts.length} {filteredProducts.length === 1 ? 'product' : 'products'}
                        </Text>

                        {filteredProducts.length > 0 ? (
                            <View style={styles.productsGrid}>
                                {filteredProducts.map((product) => (
                                    <TouchableOpacity
                                        key={product.id}
                                        style={styles.productCard}
                                        onPress={() => navigation.navigate('ProductDetail', { productId: product.id, product })}
                                        activeOpacity={0.8}
                                    >
                                        <View style={styles.productImageContainer}>
                                            <LinearGradient
                                                colors={['rgba(139,92,246,0.1)', 'rgba(59,130,246,0.1)']}
                                                style={styles.productImage}
                                            >
                                                <Text style={styles.productEmoji}>{getCategoryIcon(product.category)}</Text>
                                            </LinearGradient>
                                            {product.stock_count < 10 && (
                                                <View style={[
                                                    styles.stockBadge,
                                                    product.stock_count === 0 && styles.outOfStockBadge
                                                ]}>
                                                    <Text style={styles.stockBadgeText}>
                                                        {product.stock_count === 0 ? 'Out' : 'Low'}
                                                    </Text>
                                                </View>
                                            )}
                                        </View>
                                        <View style={styles.productInfo}>
                                            <Text style={styles.productName} numberOfLines={2}>{product.name}</Text>
                                            <View style={styles.priceRow}>
                                                <Text style={styles.productPrice}>€{getPrice(product).toFixed(2)}</Text>
                                                {(isMaster || isAdmin) && (
                                                    <Text style={styles.retailPrice}>€{product.retail_price.toFixed(2)}</Text>
                                                )}
                                            </View>
                                        </View>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        ) : (
                            <View style={styles.emptyState}>
                                <Text style={styles.emptyIcon}>🛍️</Text>
                                <Text style={styles.emptyText}>No products found</Text>
                                <Text style={styles.emptySubtext}>
                                    {searchQuery ? 'Try a different search' : 'Check back soon!'}
                                </Text>
                            </View>
                        )}
                    </View>
                </ScrollView>

                {/* Add Product Modal (Admin Only) */}
                <Modal
                    visible={showAddModal}
                    animationType="slide"
                    presentationStyle="pageSheet"
                    onRequestClose={() => setShowAddModal(false)}
                >
                    <SafeAreaView style={styles.modalContainer}>
                        <View style={styles.modalHeader}>
                            <TouchableOpacity onPress={() => setShowAddModal(false)}>
                                <Text style={styles.modalCancel}>Cancel</Text>
                            </TouchableOpacity>
                            <Text style={styles.modalTitle}>Add Product</Text>
                            <View style={{ width: 60 }} />
                        </View>

                        <ScrollView style={styles.modalContent}>
                            <View style={styles.inputGroup}>
                                <Text style={styles.inputLabel}>Name *</Text>
                                <TextInput
                                    style={styles.input}
                                    value={newProduct.name}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, name: text })}
                                    placeholder="Product name"
                                    placeholderTextColor={colors.textMuted}
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.inputLabel}>Description</Text>
                                <TextInput
                                    style={[styles.input, styles.textArea]}
                                    value={newProduct.description}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, description: text })}
                                    placeholder="Product description"
                                    placeholderTextColor={colors.textMuted}
                                    multiline
                                    numberOfLines={3}
                                />
                            </View>

                            <View style={styles.inputRow}>
                                <View style={[styles.inputGroup, { flex: 1 }]}>
                                    <Text style={styles.inputLabel}>Retail Price *</Text>
                                    <TextInput
                                        style={styles.input}
                                        value={newProduct.retail_price}
                                        onChangeText={(text) => setNewProduct({ ...newProduct, retail_price: text })}
                                        placeholder="0.00"
                                        placeholderTextColor={colors.textMuted}
                                        keyboardType="decimal-pad"
                                    />
                                </View>
                                <View style={[styles.inputGroup, { flex: 1, marginLeft: spacing.md }]}>
                                    <Text style={styles.inputLabel}>Wholesale *</Text>
                                    <TextInput
                                        style={styles.input}
                                        value={newProduct.wholesale_price}
                                        onChangeText={(text) => setNewProduct({ ...newProduct, wholesale_price: text })}
                                        placeholder="0.00"
                                        placeholderTextColor={colors.textMuted}
                                        keyboardType="decimal-pad"
                                    />
                                </View>
                            </View>

                            <View style={styles.inputRow}>
                                <View style={[styles.inputGroup, { flex: 1 }]}>
                                    <Text style={styles.inputLabel}>Stock Count</Text>
                                    <TextInput
                                        style={styles.input}
                                        value={newProduct.stock_count}
                                        onChangeText={(text) => setNewProduct({ ...newProduct, stock_count: text })}
                                        placeholder="0"
                                        placeholderTextColor={colors.textMuted}
                                        keyboardType="number-pad"
                                    />
                                </View>
                                <View style={[styles.inputGroup, { flex: 1, marginLeft: spacing.md }]}>
                                    <Text style={styles.inputLabel}>Category</Text>
                                    <View style={styles.categoryPicker}>
                                        {['Nails', 'Lashes', 'Brows', 'Equipment'].map((cat) => (
                                            <TouchableOpacity
                                                key={cat}
                                                style={[
                                                    styles.categoryOption,
                                                    newProduct.category === cat && styles.categoryOptionActive,
                                                ]}
                                                onPress={() => setNewProduct({ ...newProduct, category: cat })}
                                            >
                                                <Text style={[
                                                    styles.categoryOptionText,
                                                    newProduct.category === cat && styles.categoryOptionTextActive,
                                                ]}>
                                                    {cat}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>
                            </View>

                            <Button
                                title={saving ? 'Adding...' : 'Add Product'}
                                onPress={handleAddProduct}
                                fullWidth
                                disabled={saving}
                            />
                        </ScrollView>
                    </SafeAreaView>
                </Modal>
            </SafeAreaView>
        </ScreenBackground>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    scrollContent: { paddingBottom: 100 },
    headerGradient: {
        paddingTop: spacing.lg,
        paddingBottom: spacing.xl,
        paddingHorizontal: spacing.lg,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
    },
    headerContent: {},
    headerTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: spacing.lg,
    },
    headerTitle: {
        fontSize: 48,
        fontWeight: '900',
        color: colors.text,
        marginBottom: 8,
        letterSpacing: -1,
    },
    headerSubtitle: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.8)',
        fontWeight: '500',
    },
    addButton: {
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
    },
    addButtonText: { color: colors.text, fontSize: 14, fontWeight: '600' },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.text,
        borderRadius: 16,
        paddingHorizontal: spacing.md,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    searchInput: {
        flex: 1,
        paddingVertical: spacing.lg,
        fontSize: 16,
        color: colors.background,
        fontWeight: '500',
    },
    searchIcon: { fontSize: 16, marginRight: spacing.sm, opacity: 0.7 },
    categoriesScroll: { marginTop: spacing.lg },
    categories: { paddingHorizontal: spacing.lg, gap: spacing.sm },
    categoryChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: 20,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        gap: spacing.xs,
    },
    categoryChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    categoryIcon: { fontSize: 14 },
    categoryText: { fontSize: 14, color: colors.textSecondary, fontWeight: '500' },
    categoryTextActive: { color: colors.text, fontWeight: '600' },
    productsSection: { padding: spacing.lg },
    resultsText: { fontSize: 13, color: colors.textMuted, marginBottom: spacing.md },
    productsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.md,
    },
    productCard: {
        width: CARD_WIDTH,
        backgroundColor: colors.surface,
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: colors.border,
    },
    productImageContainer: {
        position: 'relative',
    },
    productImage: {
        height: 120,
        alignItems: 'center',
        justifyContent: 'center',
    },
    productEmoji: { fontSize: 48 },
    stockBadge: {
        position: 'absolute',
        top: spacing.sm,
        right: spacing.sm,
        backgroundColor: '#F59E0B',
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
        borderRadius: 4,
    },
    outOfStockBadge: { backgroundColor: '#EF4444' },
    stockBadgeText: { fontSize: 10, fontWeight: '700', color: colors.text },
    productInfo: { padding: spacing.md },
    productName: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.text,
        marginBottom: spacing.sm,
        minHeight: 36,
    },
    priceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    productPrice: { fontSize: 18, fontWeight: '700', color: colors.primary },
    retailPrice: { fontSize: 12, color: colors.textMuted, textDecorationLine: 'line-through' },
    emptyState: { alignItems: 'center', paddingVertical: spacing.xxxl },
    emptyIcon: { fontSize: 64, marginBottom: spacing.lg, opacity: 0.5 },
    emptyText: { fontSize: 18, fontWeight: '600', color: colors.text, marginBottom: spacing.sm },
    emptySubtext: { fontSize: 14, color: colors.textSecondary },
    // Modal styles
    modalContainer: { flex: 1, backgroundColor: colors.background },
    modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
    modalCancel: { color: colors.textSecondary, fontSize: 16 },
    modalTitle: { fontSize: 18, fontWeight: '600', color: colors.text },
    modalContent: { padding: spacing.lg },
    inputGroup: { marginBottom: spacing.lg },
    inputLabel: { fontSize: 14, fontWeight: '500', color: colors.text, marginBottom: spacing.sm },
    input: { backgroundColor: colors.surface, borderRadius: 12, padding: spacing.md, color: colors.text, fontSize: 16, borderWidth: 1, borderColor: colors.border },
    textArea: { minHeight: 80, textAlignVertical: 'top' },
    inputRow: { flexDirection: 'row' },
    categoryPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
    categoryOption: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: 4, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
    categoryOptionActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    categoryOptionText: { fontSize: 12, color: colors.textSecondary },
    categoryOptionTextActive: { color: colors.text },
});

export default ShopScreen;
