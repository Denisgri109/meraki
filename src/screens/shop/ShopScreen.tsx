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
import { Card, Button, ScreenBackground, MerakiText } from '../../components/ui';
import { colors, spacing, layout, gradients } from '../../theme';
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
            const { data, error } = await safeSupabaseFetch(
                supabase
                    .from('products')
                    .select('*')
                    .eq('is_active', true)
                    .order('name') as any,
                {
                    timeout: 10000,
                    errorMessage: 'Failed to load products'
                }
            );

            if (error) throw error;
            setProducts((data as Product[]) || []);
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
            const { error } = await supabase.from('products').insert({
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

    const getCategoryGradient = (category: string | null): string[] => {
        switch (category) {
            case 'Nails': return [colors.primary, colors.primaryDark];
            case 'Lashes': return [colors.secondary, '#8B5CF6'];
            case 'Brows': return [colors.accent, colors.gold];
            case 'Equipment': return [colors.textMuted, colors.borderLight];
            default: return gradients.primary as unknown as string[];
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
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
                    }
                    showsVerticalScrollIndicator={false}
                >
                    {/* Premium Header */}
                    <View style={styles.headerContainer}>
                        <View style={styles.headerRow}>
                            <View style={styles.headerLeft}>
                                <MerakiText variant="h1" style={styles.headerTitle}>Shop</MerakiText>
                                <MerakiText variant="caption" style={styles.headerSubtitle}>
                                    {(isMaster || isAdmin) ? 'Wholesale Prices' : 'Premium Beauty Products'}
                                </MerakiText>
                            </View>
                            <View style={styles.headerRight}>
                                {isAdmin && (
                                    <TouchableOpacity
                                        style={styles.addButton}
                                        onPress={() => setShowAddModal(true)}
                                    >
                                        <MerakiText style={styles.addButtonText}>+</MerakiText>
                                    </TouchableOpacity>
                                )}
                                <TouchableOpacity
                                    style={styles.cartButton}
                                    onPress={() => navigation.navigate('Cart')}
                                >
                                    <MerakiText style={styles.cartIcon}>🛍️</MerakiText>
                                    {cartItemCount > 0 && (
                                        <View style={styles.cartBadge}>
                                            <MerakiText style={styles.cartBadgeText}>
                                                {cartItemCount > 99 ? '99+' : cartItemCount}
                                            </MerakiText>
                                        </View>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Sleek Search Bar */}
                        <Card variant="glass" style={styles.searchContainer} noPadding>
                            <View style={styles.searchInner}>
                                <MerakiText style={styles.searchIconSymbol}>🔍</MerakiText>
                                <TextInput
                                    style={styles.searchInput}
                                    placeholder="Search products..."
                                    placeholderTextColor={colors.textMuted}
                                    value={searchQuery}
                                    onChangeText={setSearchQuery}
                                />
                                {searchQuery.length > 0 && (
                                    <TouchableOpacity onPress={() => setSearchQuery('')}>
                                        <MerakiText style={styles.clearSearch}>✕</MerakiText>
                                    </TouchableOpacity>
                                )}
                            </View>
                        </Card>
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
                                        colors={[colors.primary, colors.champagne]}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 0 }}
                                        style={styles.categoryChipActive}
                                    >
                                        <MerakiText style={styles.categoryIcon}>{cat.icon}</MerakiText>
                                        <MerakiText variant="bodyBold" style={styles.categoryTextActive}>{cat.label}</MerakiText>
                                    </LinearGradient>
                                ) : (
                                    <Card variant="glass" style={styles.categoryChip} noPadding>
                                        <View style={styles.categoryChipInner}>
                                            <MerakiText style={styles.categoryIcon}>{cat.icon}</MerakiText>
                                            <MerakiText variant="body" style={styles.categoryText}>{cat.label}</MerakiText>
                                        </View>
                                    </Card>
                                )}
                            </TouchableOpacity>
                        ))}
                    </ScrollView>

                    {/* Products Grid */}
                    <View style={styles.productsSection}>
                        <MerakiText variant="caption" style={styles.resultsText}>
                            {filteredProducts.length} {filteredProducts.length === 1 ? 'product' : 'products'}
                        </MerakiText>

                        {filteredProducts.length > 0 ? (
                            <View style={styles.productsGrid}>
                                {filteredProducts.map((product) => (
                                    <TouchableOpacity
                                        key={product.id}
                                        style={styles.productCardWrapper}
                                        onPress={() => navigation.navigate('ProductDetail', { productId: product.id, product })}
                                        activeOpacity={0.9}
                                    >
                                        <Card variant="glass" style={styles.productCard} noPadding>
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
                                                        colors={getCategoryGradient(product.category) as any}
                                                        style={styles.productImagePlaceholder}
                                                        start={{ x: 0, y: 0 }}
                                                        end={{ x: 1, y: 1 }}
                                                    >
                                                        <MerakiText style={styles.productCategoryLabel}>
                                                            {product.category || 'Product'}
                                                        </MerakiText>
                                                    </LinearGradient>
                                                )}

                                                {/* Stock Badge */}
                                                {product.stock_count < 10 && (
                                                    <View style={[
                                                        styles.stockBadge,
                                                        product.stock_count === 0 && styles.outOfStockBadge
                                                    ]}>
                                                        <MerakiText variant="caption" style={styles.stockBadgeText}>
                                                            {product.stock_count === 0 ? 'Sold Out' : `${product.stock_count} left`}
                                                        </MerakiText>
                                                    </View>
                                                )}
                                            </View>

                                            {/* Product Info */}
                                            <View style={styles.productInfo}>
                                                <MerakiText variant="bodyBold" style={styles.productName} numberOfLines={2}>
                                                    {product.name}
                                                </MerakiText>

                                                <View style={styles.priceRow}>
                                                    <View style={styles.priceContainer}>
                                                        <MerakiText variant="bodyBold" style={styles.productPrice}>
                                                            €{getPrice(product).toFixed(2)}
                                                        </MerakiText>
                                                        {(isMaster || isAdmin) && (
                                                            <MerakiText variant="caption" style={styles.retailPrice}>
                                                                €{product.retail_price.toFixed(2)}
                                                            </MerakiText>
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
                                                        <LinearGradient
                                                            colors={(product.stock_count === 0 ? [colors.surfaceLight, colors.surfaceLight] : [colors.primary, colors.champagne]) as any}
                                                            style={styles.addToCartGradient}
                                                        >
                                                            <MerakiText style={styles.addToCartIcon}>+</MerakiText>
                                                        </LinearGradient>
                                                    </TouchableOpacity>
                                                </View>
                                            </View>
                                        </Card>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        ) : (
                            <View style={styles.emptyState}>
                                <Card variant="glass" style={styles.emptyIconCard}>
                                    <MerakiText style={styles.emptyIcon}>🛍️</MerakiText>
                                </Card>
                                <MerakiText variant="h2" style={styles.emptyText}>No products found</MerakiText>
                                <MerakiText variant="body" style={styles.emptySubtext}>
                                    {searchQuery ? 'Try a different search term' : 'Check back soon for new arrivals!'}
                                </MerakiText>
                                <Button
                                    title="Clear Filter"
                                    variant="outline"
                                    style={{ marginTop: spacing.lg }}
                                    onPress={() => {
                                        setSelectedCategory('All');
                                        setSearchQuery('');
                                    }}
                                />
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
                    <ScreenBackground>
                        <SafeAreaView style={styles.modalContainer}>
                            <View style={styles.modalHeader}>
                                <TouchableOpacity onPress={() => setShowAddModal(false)}>
                                    <MerakiText style={styles.modalCancel}>Cancel</MerakiText>
                                </TouchableOpacity>
                                <MerakiText variant="h3" style={styles.modalTitle}>Add Product</MerakiText>
                                <View style={{ width: 60 }} />
                            </View>

                            <ScrollView style={styles.modalContent}>
                                <Card variant="glass" style={styles.formCard}>
                                    <View style={styles.inputGroup}>
                                        <MerakiText variant="caption" style={styles.inputLabel}>Name *</MerakiText>
                                        <TextInput
                                            style={styles.input}
                                            value={newProduct.name}
                                            onChangeText={(text) => setNewProduct({ ...newProduct, name: text })}
                                            placeholder="Product name"
                                            placeholderTextColor={colors.textMuted}
                                        />
                                    </View>

                                    <View style={styles.inputGroup}>
                                        <MerakiText variant="caption" style={styles.inputLabel}>Description</MerakiText>
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
                                            <MerakiText variant="caption" style={styles.inputLabel}>Retail Price *</MerakiText>
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
                                            <MerakiText variant="caption" style={styles.inputLabel}>Wholesale *</MerakiText>
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
                                            <MerakiText variant="caption" style={styles.inputLabel}>Stock Count</MerakiText>
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
                                            <MerakiText variant="caption" style={styles.inputLabel}>Category</MerakiText>
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
                                                        <MerakiText style={[
                                                            styles.categoryOptionText,
                                                            newProduct.category === cat && styles.categoryOptionTextActive,
                                                        ]}>
                                                            {cat}
                                                        </MerakiText>
                                                    </TouchableOpacity>
                                                ))}
                                            </View>
                                        </View>
                                    </View>

                                    <Button
                                        title={saving ? 'Adding...' : 'Add Product'}
                                        onPress={handleAddProduct}
                                        variant="primary"
                                        fullWidth
                                        disabled={saving}
                                        style={{ marginTop: spacing.md }}
                                    />
                                </Card>
                            </ScrollView>
                        </SafeAreaView>
                    </ScreenBackground>
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
        paddingBottom: 120
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
        alignItems: 'center',
        marginBottom: spacing.lg,
    },
    headerLeft: {
        flex: 1,
    },
    headerTitle: {
        color: colors.text,
    },
    headerSubtitle: {
        color: colors.textMuted,
        marginTop: 2,
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    addButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: colors.surfaceGlass,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    addButtonText: {
        color: colors.text,
        fontSize: 24,
    },
    cartButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: colors.surfaceGlass,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
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
        borderWidth: 2,
        borderColor: colors.background,
    },
    cartBadgeText: {
        fontSize: 10,
        fontWeight: '800',
        color: colors.text,
    },

    // Search Styles
    searchContainer: {
        marginBottom: spacing.sm,
    },
    searchInner: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        height: 48,
    },
    searchIconSymbol: {
        fontSize: 16,
        marginRight: spacing.sm,
        opacity: 0.5
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        color: colors.text,
        fontFamily: 'Manrope-Regular',
    },
    clearSearch: {
        fontSize: 14,
        color: colors.textMuted,
        padding: spacing.xs,
    },

    // Categories Styles
    categoriesScroll: {
        marginTop: spacing.sm,
    },
    categories: {
        paddingHorizontal: spacing.lg,
        gap: spacing.md,
    },
    categoryChip: {
        borderRadius: 20,
    },
    categoryChipInner: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        gap: 8,
    },
    categoryChipActive: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: 20,
        gap: 8,
    },
    categoryIcon: {
        fontSize: 14
    },
    categoryText: {
        color: colors.textSecondary,
    },
    categoryTextActive: {
        color: colors.text,
    },

    // Products Section
    productsSection: {
        padding: spacing.lg
    },
    resultsText: {
        color: colors.textMuted,
        marginBottom: spacing.md,
    },
    productsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.md,
    },

    // Product Card Styles
    productCardWrapper: {
        width: CARD_WIDTH,
    },
    productCard: {
        borderRadius: layout.borderRadius.lg,
    },
    productImageWrapper: {
        position: 'relative',
        height: 160,
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
    productCategoryLabel: {
        fontSize: 12,
        fontWeight: '800',
        color: 'rgba(255,255,255,0.8)',
        textTransform: 'uppercase',
        letterSpacing: 2,
    },
    stockBadge: {
        position: 'absolute',
        top: spacing.sm,
        left: spacing.sm,
        backgroundColor: 'rgba(0,0,0,0.6)',
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    outOfStockBadge: {
        backgroundColor: colors.error,
    },
    stockBadgeText: {
        color: colors.text,
        fontWeight: '600',
    },
    productInfo: {
        padding: spacing.md,
    },
    productName: {
        color: colors.text,
        marginBottom: spacing.sm,
        lineHeight: 20,
        minHeight: 40,
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
        color: colors.accent,
    },
    retailPrice: {
        color: colors.textMuted,
        textDecorationLine: 'line-through',
    },
    addToCartButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        overflow: 'hidden',
    },
    addToCartGradient: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    addToCartDisabled: {
        opacity: 0.5,
    },
    addToCartIcon: {
        fontSize: 20,
        color: colors.text,
        fontWeight: '300',
    },

    // Empty State
    emptyState: {
        alignItems: 'center',
        paddingVertical: spacing.xxxl
    },
    emptyIconCard: {
        width: 100,
        height: 100,
        borderRadius: 50,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.xl,
    },
    emptyIcon: {
        fontSize: 40,
    },
    emptyText: {
        color: colors.text,
        marginBottom: spacing.sm
    },
    emptySubtext: {
        color: colors.textSecondary,
        textAlign: 'center',
        paddingHorizontal: spacing.xl,
    },

    // Modal styles
    modalContainer: {
        flex: 1,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: spacing.lg,
    },
    modalCancel: {
        color: colors.textMuted,
        fontSize: 16
    },
    modalTitle: {
        color: colors.text,
    },
    modalContent: {
        padding: spacing.lg
    },
    formCard: {
        padding: spacing.lg,
    },
    inputGroup: {
        marginBottom: spacing.lg
    },
    inputLabel: {
        color: colors.textMuted,
        marginBottom: spacing.sm,
        letterSpacing: 1,
    },
    input: {
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 12,
        paddingHorizontal: spacing.md,
        height: 50,
        color: colors.text,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
        fontFamily: 'Manrope-Regular',
    },
    textArea: {
        height: 100,
        paddingTop: spacing.md,
        textAlignVertical: 'top',
    },
    inputRow: {
        flexDirection: 'row',
    },
    categoryPicker: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.xs,
    },
    categoryOption: {
        paddingHorizontal: spacing.sm,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: 'rgba(255,255,255,0.05)',
    },
    categoryOptionActive: {
        backgroundColor: colors.primary,
    },
    categoryOptionText: {
        fontSize: 12,
        color: colors.textSecondary,
    },
    categoryOptionTextActive: {
        color: colors.text,
        fontWeight: '700',
    },
});

export default ShopScreen;
