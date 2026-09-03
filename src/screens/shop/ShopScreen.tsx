import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    TextInput,
    Modal,
    Dimensions,
    Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useCart } from '../../contexts/CartContext';
import { useModal } from '../../contexts/ModalContext';
import { Card, Button, ScreenBackground, MerakiText } from '../../components/ui';
import { EditableText } from '../../components/editable/EditableText';
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
    { label: 'All' },
    { label: 'Nails' },
    { label: 'Lashes' },
    { label: 'Skincare' },
    { label: 'Brows' },
    { label: 'Equipment' },
];

export function ShopScreen() {
    const navigation = useNavigation<any>();
    const { profile, checkSession } = useAuth();
    const { addToCart, getItemCount } = useCart();
    const { showAlert } = useModal();
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
        if (!newProduct.name || !newProduct.retail_price) {
            showAlert('Error', 'Please fill in all required fields', 'error');
            return;
        }

        setSaving(true);
        try {
            const retailPriceParsed = parseFloat(newProduct.retail_price);
            const { error } = await supabase.from('products').insert({
                name: newProduct.name,
                description: newProduct.description || null,
                retail_price: retailPriceParsed,
                wholesale_price: retailPriceParsed,
                stock_count: parseInt(newProduct.stock_count) || 0,
                category: newProduct.category,
            });

            if (error) throw error;

            showAlert('Success', 'Product added successfully', 'success');
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
            showAlert('Error', error.message, 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleQuickAddToCart = (product: Product) => {
        if (product.stock_count === 0) {
            showAlert('Out of Stock', 'This product is currently unavailable.', 'info');
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
                    {/* Editorial Header — Stitch Style */}
                    <View style={styles.headerContainer}>
                        <View style={styles.headerRow}>
                            <View style={styles.headerLeft}>
                                <EditableText
                                    contentKey="mobile.shop.header_label"
                                    label="Shop Eyebrow"
                                    style={styles.headerLabel}
                                />
                                <MerakiText variant="h1" style={styles.headerTitle}>Shop</MerakiText>
                                {(isMaster || isAdmin) && (
                                    <MerakiText variant="caption" style={styles.headerSubtitle}>Wholesale Prices</MerakiText>
                                )}
                            </View>
                            <View style={styles.headerRight}>
                                {isAdmin && (
                                    <TouchableOpacity
                                        accessibilityRole="button"
                                        accessibilityLabel="Add"
                                        style={styles.addButton}
                                        onPress={() => setShowAddModal(true)}
                                    >
                                        <MaterialIcons name="add" size={22} color={colors.text} />
                                    </TouchableOpacity>
                                )}
                                <TouchableOpacity
                                    style={styles.cartButton}
                                    onPress={() => navigation.navigate('Cart')}
                                >
                                    <MaterialIcons name="shopping-bag" size={22} color={colors.text} />
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

                        {/* Search Bar */}
                        <View style={styles.searchContainer}>
                            <View style={styles.searchInner}>
                                <MaterialIcons name="search" size={20} color={colors.textMuted} />
                                <TextInput
                                    style={styles.searchInput}
                                    placeholder="Search curated beauty..."
                                    placeholderTextColor={colors.textMuted}
                                    value={searchQuery}
                                    onChangeText={setSearchQuery}
                                />
                                {searchQuery.length > 0 && (
                                    <TouchableOpacity
                                        accessibilityRole="button"
                                        accessibilityLabel="Close" onPress={() => setSearchQuery('')}>
                                        <MaterialIcons name="close" size={18} color={colors.textMuted} />
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>
                    </View>

                    {/* Category Tabs — Text + Underline (Stitch Style) */}
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={styles.categoriesScroll}
                        contentContainerStyle={styles.categories}
                    >
                        {CATEGORIES.map((cat) => {
                            const isActive = selectedCategory === cat.label;
                            return (
                                <TouchableOpacity
                                    key={cat.label}
                                    onPress={() => setSelectedCategory(cat.label)}
                                    activeOpacity={0.7}
                                    style={styles.categoryTab}
                                >
                                    <MerakiText style={[
                                        styles.categoryTabText,
                                        isActive && styles.categoryTabTextActive,
                                    ]}>
                                        {cat.label}
                                    </MerakiText>
                                    {isActive && <View style={styles.categoryTabUnderline} />}
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>

                    {/* Products Grid */}
                    <View style={styles.productsSection}>
                        <MerakiText variant="caption" style={styles.resultsText}>
                            {filteredProducts.length} {filteredProducts.length === 1 ? 'product' : 'products'}
                        </MerakiText>

                        {filteredProducts.length > 0 ? (
                            <View style={styles.productsGrid}>
                                {filteredProducts.map((product, productIndex) => (
                                    <TouchableOpacity
                                        key={product.id}
                                        testID={productIndex === 0 ? 'product-card-first' : undefined}
                                        style={styles.productCardWrapper}
                                        onPress={() => navigation.navigate('ProductDetail', { productId: product.id, product })}
                                        activeOpacity={0.9}
                                    >
                                        <View style={styles.productCard}>
                                            {/* Product Image Container */}
                                            <View style={styles.productImageWrapper}>
                                                {product.image_url ? (
                                                    <Image
                                                        source={{ uri: product.image_url }}
                                                        style={styles.productImage}
                                                        resizeMode="cover"
                                                    />
                                                ) : (
                                                    <View style={styles.productImagePlaceholder}>
                                                        <MerakiText style={styles.productCategoryLabel}>
                                                            {product.category || 'Product'}
                                                        </MerakiText>
                                                    </View>
                                                )}

                                                {/* Heart / Favorite Icon */}
                                                <TouchableOpacity
                                                    accessibilityRole="button"
                                                    accessibilityLabel="Add to favourites" style={styles.heartButton} activeOpacity={0.7}>
                                                    <MaterialIcons name="favorite-border" size={18} color="#1A1A1A" />
                                                </TouchableOpacity>

                                                {/* Bestseller Badge */}
                                                {product.stock_count >= 10 && (
                                                    <View style={styles.bestsellerBadge}>
                                                        <MerakiText style={styles.bestsellerText}>BESTSELLER</MerakiText>
                                                    </View>
                                                )}

                                                {/* Stock Badge */}
                                                {product.stock_count < 10 && product.stock_count > 0 && (
                                                    <View style={styles.stockBadge}>
                                                        <MerakiText variant="caption" style={styles.stockBadgeText}>
                                                            {`${product.stock_count} left`}
                                                        </MerakiText>
                                                    </View>
                                                )}
                                                {product.stock_count === 0 && (
                                                    <View style={[styles.stockBadge, styles.outOfStockBadge]}>
                                                        <MerakiText variant="caption" style={styles.stockBadgeText}>Sold Out</MerakiText>
                                                    </View>
                                                )}
                                            </View>

                                            {/* Product Info — Stitch Style */}
                                            <View style={styles.productInfo}>
                                                <EditableText
                                                    contentKey="mobile.shop.brand_label"
                                                    label="Product Brand Label"
                                                    style={styles.productBrandLabel}
                                                />
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
                                                        accessibilityRole="button"
                                                        accessibilityLabel="Add"
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
                                                        <View style={styles.addToCartGradient}>
                                                            <MaterialIcons name="add" size={18} color="#FFFFFF" />
                                                        </View>
                                                    </TouchableOpacity>
                                                </View>
                                            </View>
                                        </View>
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

                                    <View style={styles.inputGroup}>
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

    // Header — Editorial Style
    headerContainer: {
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.md,
        paddingBottom: spacing.sm,
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
    headerLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: colors.textMuted,
        letterSpacing: 2,
        textTransform: 'uppercase',
        marginBottom: 4,
    },
    headerTitle: {
        color: colors.text,
        fontSize: 32,
        fontWeight: '700',
    },
    headerSubtitle: {
        color: colors.textMuted,
        marginTop: 2,
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        marginTop: 8,
    },
    addButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(0, 0, 0, 0.04)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    cartButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(0, 0, 0, 0.04)',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
    },
    cartBadge: {
        position: 'absolute',
        top: -4,
        right: -4,
        minWidth: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: '#E8A0B4',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 4,
        borderWidth: 2,
        borderColor: colors.background,
    },
    cartBadgeText: {
        fontSize: 10,
        fontWeight: '800',
        color: '#FFFFFF',
        textAlign: 'center',
        includeFontPadding: false,
        textAlignVertical: 'center',
        lineHeight: 12,
    },

    // Search — Minimal rounded bar
    searchContainer: {
        backgroundColor: '#F5F5F5',
        borderRadius: 24,
        marginBottom: spacing.sm,
    },
    searchInner: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        height: 46,
        gap: 10,
    },
    searchInput: {
        flex: 1,
        fontSize: 15,
        color: colors.text,
    },

    // Category Tabs — Text + Underline
    categoriesScroll: {
        marginTop: spacing.sm,
        marginBottom: spacing.sm,
    },
    categories: {
        paddingHorizontal: spacing.lg,
        gap: 24,
    },
    categoryTab: {
        paddingBottom: 8,
        alignItems: 'center',
    },
    categoryTabText: {
        fontSize: 14,
        fontWeight: '500',
        color: colors.textMuted,
    },
    categoryTabTextActive: {
        color: '#1A1A1A',
        fontWeight: '700',
    },
    categoryTabUnderline: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 2,
        backgroundColor: '#1A1A1A',
        borderRadius: 1,
    },

    // Products Section
    productsSection: {
        padding: spacing.lg
    },
    resultsText: {
        color: colors.textMuted,
        marginBottom: spacing.md,
        fontSize: 13,
    },
    productsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.md,
    },

    // Product Card — Stitch Style
    productCardWrapper: {
        width: CARD_WIDTH,
    },
    productCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
    },
    productImageWrapper: {
        position: 'relative',
        height: 180,
        backgroundColor: '#F5F5F5',
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
        backgroundColor: '#F0F0F0',
    },
    productCategoryLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: 'rgba(0, 0, 0, 0.35)',
        textTransform: 'uppercase',
        letterSpacing: 2,
    },
    heartButton: {
        position: 'absolute',
        top: 10,
        right: 10,
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: 'rgba(255, 255, 255, 0.85)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    bestsellerBadge: {
        position: 'absolute',
        bottom: 10,
        left: 10,
        backgroundColor: '#FADADD',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 4,
    },
    bestsellerText: {
        fontSize: 9,
        fontWeight: '700',
        color: '#8B4A5E',
        letterSpacing: 0.5,
        textTransform: 'uppercase',
    },
    stockBadge: {
        position: 'absolute',
        bottom: 10,
        left: 10,
        backgroundColor: 'rgba(0,0,0,0.6)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 4,
    },
    outOfStockBadge: {
        backgroundColor: colors.error,
    },
    stockBadgeText: {
        color: '#FFFFFF',
        fontWeight: '600',
        fontSize: 10,
    },
    productInfo: {
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    productBrandLabel: {
        fontSize: 9,
        fontWeight: '600',
        color: colors.textMuted,
        letterSpacing: 1.5,
        textTransform: 'uppercase',
        marginBottom: 2,
    },
    productName: {
        color: colors.text,
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 6,
        lineHeight: 18,
        minHeight: 18,
    },
    priceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between'
    },
    priceContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    productPrice: {
        color: colors.accent,
        fontSize: 14,
    },
    retailPrice: {
        color: colors.textMuted,
        textDecorationLine: 'line-through',
        fontSize: 12,
    },
    addToCartButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        overflow: 'hidden',
    },
    addToCartGradient: {
        flex: 1,
        backgroundColor: '#1A1A1A',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 16,
    },
    addToCartDisabled: {
        opacity: 0.3,
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
        backgroundColor: 'rgba(0, 0, 0, 0.02)',
        borderRadius: 12,
        paddingHorizontal: spacing.md,
        height: 50,
        color: colors.text,
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.04)',
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
        backgroundColor: 'rgba(0, 0, 0, 0.04)',
    },
    categoryOptionActive: {
        backgroundColor: colors.primary,
    },
    categoryOptionText: {
        fontSize: 12,
        color: colors.textSecondary,
    },
    categoryOptionTextActive: {
        color: colors.textInvert,
        fontWeight: '700',
    },
});

export default ShopScreen;
