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
    Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useCart } from '../../contexts/CartContext';
import { Card, Button, ScreenBackground } from '../../components/ui';
import { colors, spacing } from '../../theme';
import { safeSupabaseFetch } from '../../lib/supabaseApi';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - spacing.lg * 2 - spacing.md) / 2;

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
    { label: 'All', icon: '✦' },
    { label: 'Nails', icon: '💅' },
    { label: 'Lashes', icon: '👁️' },
    { label: 'Brows', icon: '✨' },
    { label: 'Equipment', icon: '⚙️' },
];

export function ShopScreen() {
    const navigation = useNavigation<any>();
    const { profile, checkSession } = useAuth();
    const { addToCart, getItemCount } = useCart();
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
    const cartItemCount = getItemCount();

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

    const handleQuickAddToCart = (product: Product) => {
        if (product.stock_count === 0) {
            Alert.alert('Out of Stock', 'This product is currently unavailable.');
            return;
        }

        const price = getPrice(product);
        addToCart({
            id: product.id,
            name: product.name,
            price: price,
            quantity: 1,
            image_url: product.image_url,
            stock_count: product.stock_count,
        });
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

    const getCategoryGradient = (category: string | null): [string, string] => {
        switch (category) {
            case 'Nails': return ['#D48A82', '#B8756D'];
            case 'Lashes': return ['#C0A0E0', '#8B5CF6'];
            case 'Brows': return ['#E6C090', '#D4A574'];
            case 'Equipment': return ['#6B7280', '#4B5563'];
            default: return ['#8B5CF6', '#6366F1'];
        }
    };

    if (loading) {
        return (
            <ScreenBackground>
                <SafeAreaView style={styles.container}>
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={colors.primary} />
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
                    <View style={styles.headerContainer}>
                        <View style={styles.headerRow}>
                            <View style={styles.headerLeft}>
                                <Text style={styles.headerTitle}>Shop</Text>
                                <Text style={styles.headerSubtitle}>
                                    {(isMaster || isAdmin) ? 'Wholesale Prices' : 'Premium Beauty Products'}
                                </Text>
                            </View>
                            <View style={styles.headerRight}>
                                {isAdmin && (
                                    <TouchableOpacity
                                        style={styles.addButton}
                                        onPress={() => setShowAddModal(true)}
                                    >
                                        <Text style={styles.addButtonText}>+</Text>
                                    </TouchableOpacity>
                                )}
                                <TouchableOpacity
                                    style={styles.cartButton}
                                    onPress={() => navigation.navigate('Cart')}
                                >
                                    <Text style={styles.cartIcon}>🛍️</Text>
                                    {cartItemCount > 0 && (
                                        <View style={styles.cartBadge}>
                                            <Text style={styles.cartBadgeText}>
                                                {cartItemCount > 99 ? '99+' : cartItemCount}
                                            </Text>
                                        </View>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Sleek Search Bar */}
                        <View style={styles.searchContainer}>
                            <Text style={styles.searchIcon}>🔍</Text>
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Search products..."
                                placeholderTextColor={colors.textMuted}
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                            />
                            {searchQuery.length > 0 && (
                                <TouchableOpacity onPress={() => setSearchQuery('')}>
                                    <Text style={styles.clearSearch}>✕</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>

                    {/* Modern Category Pills */}
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
                                activeOpacity={0.7}
                            >
                                {selectedCategory === cat.label ? (
                                    <LinearGradient
                                        colors={['#D48A82', '#C0A0E0']}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 0 }}
                                        style={styles.categoryChipActive}
                                    >
                                        <Text style={styles.categoryIcon}>{cat.icon}</Text>
                                        <Text style={styles.categoryTextActive}>{cat.label}</Text>
                                    </LinearGradient>
                                ) : (
                                    <View style={styles.categoryChip}>
                                        <Text style={styles.categoryIcon}>{cat.icon}</Text>
                                        <Text style={styles.categoryText}>{cat.label}</Text>
                                    </View>
                                )}
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
                                        activeOpacity={0.9}
                                    >
                                        {/* Product Image Container */}
                                        <View style={styles.productImageWrapper}>
                                            {product.image_url ? (
                                                <Image
                                                    source={{ uri: product.image_url }}
                                                    style={styles.productImage}
                                                    resizeMode="cover"
                                                />
                                            ) : (
                                                <LinearGradient
                                                    colors={getCategoryGradient(product.category)}
                                                    style={styles.productImagePlaceholder}
                                                    start={{ x: 0, y: 0 }}
                                                    end={{ x: 1, y: 1 }}
                                                >
                                                    <View style={styles.productIconContainer}>
                                                        <Text style={styles.productCategoryLabel}>
                                                            {product.category || 'Product'}
                                                        </Text>
                                                    </View>
                                                </LinearGradient>
                                            )}

                                            {/* Stock Badge */}
                                            {product.stock_count < 10 && (
                                                <View style={[
                                                    styles.stockBadge,
                                                    product.stock_count === 0 && styles.outOfStockBadge
                                                ]}>
                                                    <Text style={styles.stockBadgeText}>
                                                        {product.stock_count === 0 ? 'Sold Out' : `${product.stock_count} left`}
                                                    </Text>
                                                </View>
                                            )}
                                        </View>

                                        {/* Product Info */}
                                        <View style={styles.productInfo}>
                                            <Text style={styles.productName} numberOfLines={2}>
                                                {product.name}
                                            </Text>

                                            <View style={styles.priceRow}>
                                                <View style={styles.priceContainer}>
                                                    <Text style={styles.productPrice}>
                                                        €{getPrice(product).toFixed(2)}
                                                    </Text>
                                                    {(isMaster || isAdmin) && (
                                                        <Text style={styles.retailPrice}>
                                                            €{product.retail_price.toFixed(2)}
                                                        </Text>
                                                    )}
                                                </View>

                                                {/* Add to Cart Button */}
                                                <TouchableOpacity
                                                    style={[
                                                        styles.addToCartButton,
                                                        product.stock_count === 0 && styles.addToCartDisabled
                                                    ]}
                                                    onPress={(e) => {
                                                        e.stopPropagation();
                                                        handleQuickAddToCart(product);
                                                    }}
                                                    disabled={product.stock_count === 0}
                                                >
                                                    <Text style={styles.addToCartIcon}>+</Text>
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        ) : (
                            <View style={styles.emptyState}>
                                <View style={styles.emptyIconContainer}>
                                    <Text style={styles.emptyIcon}>🛍️</Text>
                                </View>
                                <Text style={styles.emptyText}>No products found</Text>
                                <Text style={styles.emptySubtext}>
                                    {searchQuery ? 'Try a different search term' : 'Check back soon for new arrivals!'}
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
    container: {
        flex: 1
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center'
    },
    scrollContent: {
        paddingBottom: 100
    },

    // Header Styles
    headerContainer: {
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.md,
        paddingBottom: spacing.lg,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: spacing.lg,
    },
    headerLeft: {
        flex: 1,
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: '700',
        color: colors.text,
        letterSpacing: -0.5,
    },
    headerSubtitle: {
        fontSize: 12,
        color: colors.textMuted,
        marginTop: 2,
        fontWeight: '400',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    addButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    addButtonText: {
        color: colors.text,
        fontSize: 18,
        fontWeight: '500'
    },
    cartButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
    },
    cartIcon: {
        fontSize: 20,
    },
    cartBadge: {
        position: 'absolute',
        top: -4,
        right: -4,
        minWidth: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 4,
    },
    cartBadgeText: {
        fontSize: 11,
        fontWeight: '700',
        color: colors.text,
    },

    // Search Styles
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: 12,
        paddingHorizontal: spacing.md,
        height: 44,
        borderWidth: 1,
        borderColor: colors.border,
    },
    searchIcon: {
        fontSize: 14,
        marginRight: spacing.sm,
        opacity: 0.5
    },
    searchInput: {
        flex: 1,
        fontSize: 15,
        color: colors.text,
        fontWeight: '400',
    },
    clearSearch: {
        fontSize: 14,
        color: colors.textMuted,
        padding: spacing.xs,
    },

    // Categories Styles
    categoriesScroll: {
        marginTop: spacing.sm
    },
    categories: {
        paddingHorizontal: spacing.lg,
        gap: spacing.sm
    },
    categoryChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: 20,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        gap: 6,
    },
    categoryChipActive: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: 20,
        gap: 6,
    },
    categoryIcon: {
        fontSize: 12
    },
    categoryText: {
        fontSize: 13,
        color: colors.textSecondary,
        fontWeight: '500'
    },
    categoryTextActive: {
        fontSize: 13,
        color: colors.text,
        fontWeight: '600'
    },

    // Products Section
    productsSection: {
        padding: spacing.lg
    },
    resultsText: {
        fontSize: 12,
        color: colors.textMuted,
        marginBottom: spacing.md,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    productsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.md,
    },

    // Product Card Styles
    productCard: {
        width: CARD_WIDTH,
        backgroundColor: colors.surface,
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: colors.border,
    },
    productImageWrapper: {
        position: 'relative',
        height: 140,
    },
    productImage: {
        width: '100%',
        height: '100%',
    },
    productImagePlaceholder: {
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
    },
    productIconContainer: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    productCategoryLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: 'rgba(255,255,255,0.9)',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    stockBadge: {
        position: 'absolute',
        top: spacing.sm,
        left: spacing.sm,
        backgroundColor: 'rgba(245, 158, 11, 0.9)',
        paddingHorizontal: spacing.sm,
        paddingVertical: 3,
        borderRadius: 6,
    },
    outOfStockBadge: {
        backgroundColor: 'rgba(239, 68, 68, 0.9)'
    },
    stockBadgeText: {
        fontSize: 10,
        fontWeight: '600',
        color: '#FFF'
    },
    productInfo: {
        padding: spacing.md
    },
    productName: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.text,
        marginBottom: spacing.sm,
        lineHeight: 18,
        minHeight: 36,
    },
    priceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between'
    },
    priceContainer: {
        flexDirection: 'column',
    },
    productPrice: {
        fontSize: 16,
        fontWeight: '700',
        color: colors.primary
    },
    retailPrice: {
        fontSize: 11,
        color: colors.textMuted,
        textDecorationLine: 'line-through',
        marginTop: 2,
    },
    addToCartButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    addToCartDisabled: {
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
    },
    addToCartIcon: {
        fontSize: 18,
        fontWeight: '600',
        color: colors.text,
    },

    // Empty State
    emptyState: {
        alignItems: 'center',
        paddingVertical: spacing.xxxl
    },
    emptyIconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.lg,
    },
    emptyIcon: {
        fontSize: 36,
        opacity: 0.6
    },
    emptyText: {
        fontSize: 17,
        fontWeight: '600',
        color: colors.text,
        marginBottom: spacing.xs
    },
    emptySubtext: {
        fontSize: 14,
        color: colors.textSecondary,
        textAlign: 'center',
    },

    // Modal styles
    modalContainer: {
        flex: 1,
        backgroundColor: colors.background
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: colors.border
    },
    modalCancel: {
        color: colors.textSecondary,
        fontSize: 16
    },
    modalTitle: {
        fontSize: 17,
        fontWeight: '600',
        color: colors.text
    },
    modalContent: {
        padding: spacing.lg
    },
    inputGroup: {
        marginBottom: spacing.lg
    },
    inputLabel: {
        fontSize: 13,
        fontWeight: '500',
        color: colors.textSecondary,
        marginBottom: spacing.sm,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    input: {
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: spacing.md,
        color: colors.text,
        fontSize: 15,
        borderWidth: 1,
        borderColor: colors.border
    },
    textArea: {
        minHeight: 80,
        textAlignVertical: 'top'
    },
    inputRow: {
        flexDirection: 'row'
    },
    categoryPicker: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.xs
    },
    categoryOption: {
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: 6,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border
    },
    categoryOptionActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primary
    },
    categoryOptionText: {
        fontSize: 12,
        color: colors.textSecondary
    },
    categoryOptionTextActive: {
        color: colors.text,
        fontWeight: '500',
    },
});

export default ShopScreen;
