import React, { useState, useEffect, useCallback } from 'react';
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
    Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { supabase } from '../../lib/supabase';
import { ScreenBackground, Button, ConfirmModal } from '../../components/ui';
import { colors, spacing } from '../../theme';

interface Product {
    id: string;
    name: string;
    description: string | null;
    image_url: string | null;
    stock_count: number;
    low_stock_threshold: number;
    retail_price: number;
    wholesale_price: number;
    category: string | null;
    is_active: boolean;
}

const CATEGORIES = [
    { label: 'All', icon: '✦' },
    { label: 'Nails', icon: '💅' },
    { label: 'Lashes', icon: '👁️' },
    { label: 'Brows', icon: '✨' },
    { label: 'Equipment', icon: '⚙️' },
];

export function InventoryScreen() {
    const navigation = useNavigation<any>();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [products, setProducts] = useState<Product[]>([]);
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');

    // Add Product Modal State
    const [showAddModal, setShowAddModal] = useState(false);
    const [newProduct, setNewProduct] = useState({
        name: '',
        description: '',
        retail_price: '',
        wholesale_price: '',
        stock_count: '',
        low_stock_threshold: '5',
        category: 'Nails',
        image_url: '',
    });
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);

    // Stock edit modal state
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [editStock, setEditStock] = useState('');
    const [editThreshold, setEditThreshold] = useState('');

    useFocusEffect(
        useCallback(() => {
            fetchProducts();
        }, [])
    );

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

    const handleEditStock = (product: Product) => {
        setEditingProduct(product);
        setEditStock(product.stock_count.toString());
        setEditThreshold(product.low_stock_threshold.toString());
    };

    const handleSaveStock = async () => {
        if (!editingProduct) return;

        setSaving(true);
        try {
            const newStockCount = parseInt(editStock) || 0;
            const newThreshold = parseInt(editThreshold) || 5;

            const { error } = await (supabase as any)
                .from('products')
                .update({
                    stock_count: newStockCount,
                    low_stock_threshold: newThreshold,
                })
                .eq('id', editingProduct.id);

            if (error) throw error;

            // Check if we need to trigger low stock alert
            if (newStockCount < newThreshold) {
                // Trigger low stock notification edge function
                try {
                    await supabase.functions.invoke('low-stock-alert');
                } catch (e) {
                    console.log('Low stock alert trigger:', e);
                }
            }

            Alert.alert('Success', 'Stock updated successfully');
            setEditingProduct(null);
            fetchProducts();
        } catch (error: any) {
            Alert.alert('Error', error.message);
        } finally {
            setSaving(false);
        }
    };

    const pickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission needed', 'Please grant gallery access to upload product photos.');
            return;
        }

        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'] as any,
                allowsEditing: true,
                aspect: [1, 1], // Square aspect for products
                quality: 0.8,
            });

            if (!result.canceled && result.assets[0]) {
                uploadImage(result.assets[0]);
            }
        } catch (error) {
            Alert.alert('Error', 'Failed to pick image');
        }
    };

    const uploadImage = async (asset: ImagePicker.ImagePickerAsset) => {
        setUploading(true);
        try {
            const fileExt = asset.uri.split('.').pop()?.toLowerCase() || 'jpg';
            const fileName = `products/${Date.now()}.${fileExt}`;
            const base64 = await FileSystem.readAsStringAsync(asset.uri, {
                encoding: 'base64',
            });

            // 1. Upload to Storage
            const { error: uploadError } = await supabase.storage
                .from('products') // Using 'products' bucket
                .upload(fileName, decode(base64), {
                    contentType: 'image/jpeg',
                    upsert: false,
                });

            if (uploadError) {
                if (uploadError.message.includes('Bucket not found')) {
                    throw new Error('Storage bucket "products" does not exist. Please contact admin.');
                }
                throw uploadError;
            }

            // 2. Get Public URL
            const { data: urlData } = supabase.storage
                .from('products')
                .getPublicUrl(fileName);

            setNewProduct(prev => ({ ...prev, image_url: urlData.publicUrl }));

        } catch (error: any) {
            console.error('Upload error:', error);
            Alert.alert('Error', error.message || 'Failed to upload image');
        } finally {
            setUploading(false);
        }
    };

    const handleAddProduct = async () => {
        if (!newProduct.name || !newProduct.retail_price || !newProduct.wholesale_price) {
            Alert.alert('Error', 'Please fill in all required fields (Name, Retail Price, Wholesale Price)');
            return;
        }

        setSaving(true);
        try {
            const { error } = await (supabase as any).from('products').insert({
                name: newProduct.name,
                description: newProduct.description || null,
                image_url: newProduct.image_url || null,
                retail_price: parseFloat(newProduct.retail_price),
                wholesale_price: parseFloat(newProduct.wholesale_price),
                stock_count: parseInt(newProduct.stock_count) || 0,
                low_stock_threshold: parseInt(newProduct.low_stock_threshold) || 5,
                category: newProduct.category,
                is_active: true,
            });

            if (error) throw error;

            Alert.alert('Success', 'Product added successfully');
            setShowAddModal(false);
            resetNewProduct();
            fetchProducts();
        } catch (error: any) {
            Alert.alert('Error', error.message);
        } finally {
            setSaving(false);
        }
    };

    const resetNewProduct = () => {
        setNewProduct({
            name: '',
            description: '',
            retail_price: '',
            wholesale_price: '',
            stock_count: '',
            low_stock_threshold: '5',
            category: 'Nails',
            image_url: '',
        });
    };

    const handleQuickStockAdjust = async (product: Product, delta: number) => {
        const newStock = Math.max(0, product.stock_count + delta);
        try {
            const { error } = await (supabase as any)
                .from('products')
                .update({ stock_count: newStock })
                .eq('id', product.id);

            if (error) throw error;

            // Update local state immediately
            setProducts(prev => prev.map(p =>
                p.id === product.id ? { ...p, stock_count: newStock } : p
            ));

            // Check for low stock notification
            if (newStock < product.low_stock_threshold) {
                try {
                    await supabase.functions.invoke('low-stock-alert');
                } catch (e) {
                    console.log('Low stock alert:', e);
                }
            }
        } catch (error: any) {
            Alert.alert('Error', error.message);
        }
    };

    const handleProductPress = (product: Product) => {
        navigation.navigate('ProductDetail', { productId: product.id, product });
    };

    const getLowStockProducts = () => products.filter(p => p.stock_count < p.low_stock_threshold && p.stock_count > 0);
    const getOutOfStockProducts = () => products.filter(p => p.stock_count === 0);

    const filteredProducts = products.filter(p => {
        const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
        const matchesSearch = !searchQuery ||
            p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.description?.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesCategory && matchesSearch;
    });

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
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()}>
                        <Text style={styles.backButton}>←</Text>
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Inventory</Text>
                    <TouchableOpacity style={styles.addButton} onPress={() => setShowAddModal(true)}>
                        <Text style={styles.addButtonText}>+</Text>
                    </TouchableOpacity>
                </View>

                {/* Search Bar */}
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

                {/* Category Filter */}
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
                    <Text style={styles.sectionTitle}>
                        {selectedCategory === 'All' ? 'All Products' : selectedCategory} ({filteredProducts.length})
                    </Text>

                    {filteredProducts.length > 0 ? (
                        filteredProducts.map((product) => {
                            const status = getStockStatus(product);
                            return (
                                <TouchableOpacity
                                    key={product.id}
                                    style={styles.productCard}
                                    onPress={() => handleProductPress(product)}
                                    onLongPress={() => handleEditStock(product)}
                                >
                                    <View style={styles.productIcon}>
                                        {product.image_url ? (
                                            <Image source={{ uri: product.image_url }} style={styles.productImage} />
                                        ) : (
                                            <Text style={styles.productEmoji}>{getCategoryIcon(product.category)}</Text>
                                        )}
                                    </View>
                                    <View style={styles.productInfo}>
                                        <Text style={styles.productName} numberOfLines={1}>{product.name}</Text>
                                        <Text style={styles.productCategory}>{product.category}</Text>
                                        <Text style={styles.productThreshold}>
                                            Alert at: {product.low_stock_threshold} units
                                        </Text>
                                    </View>
                                    <View style={styles.stockControls}>
                                        <View style={styles.stockInfo}>
                                            <Text style={styles.stockCount}>{product.stock_count}</Text>
                                            <View style={[styles.stockBadge, { backgroundColor: status.bg }]}>
                                                <Text style={[styles.stockBadgeText, { color: status.color }]}>
                                                    {status.label}
                                                </Text>
                                            </View>
                                        </View>
                                        <View style={styles.quickButtons}>
                                            <TouchableOpacity
                                                style={styles.quickButton}
                                                onPress={() => handleQuickStockAdjust(product, -1)}
                                            >
                                                <Text style={styles.quickButtonText}>−</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={styles.quickButton}
                                                onPress={() => handleQuickStockAdjust(product, 1)}
                                            >
                                                <Text style={styles.quickButtonText}>+</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                </TouchableOpacity>
                            );
                        })
                    ) : (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyIcon}>📦</Text>
                            <Text style={styles.emptyText}>No products found</Text>
                            <Text style={styles.emptySubtext}>
                                {searchQuery ? 'Try a different search' : 'Tap + to add your first product'}
                            </Text>
                        </View>
                    )}
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

                {/* Add Product Modal */}
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
                            <View style={styles.formGroup}>
                                <Text style={styles.formLabel}>Name *</Text>
                                <TextInput
                                    style={styles.formInput}
                                    value={newProduct.name}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, name: text })}
                                    placeholder="Product name"
                                    placeholderTextColor={colors.textMuted}
                                />
                            </View>

                            <View style={styles.formGroup}>
                                <Text style={styles.formLabel}>Description</Text>
                                <TextInput
                                    style={[styles.formInput, styles.textArea]}
                                    value={newProduct.description}
                                    onChangeText={(text) => setNewProduct({ ...newProduct, description: text })}
                                    placeholder="Product description"
                                    placeholderTextColor={colors.textMuted}
                                    multiline
                                    numberOfLines={3}
                                />
                            </View>

                            <View style={styles.formGroup}>
                                <Text style={styles.formLabel}>Product Image</Text>
                                <View style={styles.imageUploadRow}>
                                    <View style={styles.imagePreviewContainer}>
                                        {newProduct.image_url ? (
                                            <Image source={{ uri: newProduct.image_url }} style={styles.uploadedImage} />
                                        ) : (
                                            <View style={styles.imagePlaceholder}>
                                                <Text style={styles.imagePlaceholderIcon}>📷</Text>
                                            </View>
                                        )}
                                    </View>
                                    <TouchableOpacity
                                        style={styles.uploadButton}
                                        onPress={pickImage}
                                        disabled={uploading}
                                    >
                                        <Text style={styles.uploadButtonText}>
                                            {uploading ? 'Uploading...' : newProduct.image_url ? 'Change Photo' : 'Upload Photo'}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            <View style={styles.formRow}>
                                <View style={[styles.formGroup, { flex: 1 }]}>
                                    <Text style={styles.formLabel}>Retail Price *</Text>
                                    <TextInput
                                        style={styles.formInput}
                                        value={newProduct.retail_price}
                                        onChangeText={(text) => setNewProduct({ ...newProduct, retail_price: text })}
                                        placeholder="0.00"
                                        placeholderTextColor={colors.textMuted}
                                        keyboardType="decimal-pad"
                                    />
                                </View>
                                <View style={[styles.formGroup, { flex: 1, marginLeft: spacing.md }]}>
                                    <Text style={styles.formLabel}>Wholesale *</Text>
                                    <TextInput
                                        style={styles.formInput}
                                        value={newProduct.wholesale_price}
                                        onChangeText={(text) => setNewProduct({ ...newProduct, wholesale_price: text })}
                                        placeholder="0.00"
                                        placeholderTextColor={colors.textMuted}
                                        keyboardType="decimal-pad"
                                    />
                                </View>
                            </View>

                            <View style={styles.formRow}>
                                <View style={[styles.formGroup, { flex: 1 }]}>
                                    <Text style={styles.formLabel}>Stock Count</Text>
                                    <TextInput
                                        style={styles.formInput}
                                        value={newProduct.stock_count}
                                        onChangeText={(text) => setNewProduct({ ...newProduct, stock_count: text })}
                                        placeholder="0"
                                        placeholderTextColor={colors.textMuted}
                                        keyboardType="number-pad"
                                    />
                                </View>
                                <View style={[styles.formGroup, { flex: 1, marginLeft: spacing.md }]}>
                                    <Text style={styles.formLabel}>Low Stock Alert</Text>
                                    <TextInput
                                        style={styles.formInput}
                                        value={newProduct.low_stock_threshold}
                                        onChangeText={(text) => setNewProduct({ ...newProduct, low_stock_threshold: text })}
                                        placeholder="5"
                                        placeholderTextColor={colors.textMuted}
                                        keyboardType="number-pad"
                                    />
                                </View>
                            </View>

                            <View style={styles.formGroup}>
                                <Text style={styles.formLabel}>Category</Text>
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
    addButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    addButtonText: { color: colors.text, fontSize: 20, fontWeight: '500' },

    // Search
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: 12,
        marginHorizontal: spacing.lg,
        marginTop: spacing.md,
        paddingHorizontal: spacing.md,
        height: 44,
        borderWidth: 1,
        borderColor: colors.border,
    },
    searchIcon: { fontSize: 14, marginRight: spacing.sm, opacity: 0.5 },
    searchInput: { flex: 1, fontSize: 15, color: colors.text },
    clearSearch: { fontSize: 14, color: colors.textMuted, padding: spacing.xs },

    // Categories
    categoriesScroll: { marginTop: spacing.md, maxHeight: 50 },
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
        gap: 6,
    },
    categoryChipActive: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: 20,
        gap: 6,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    categoryIcon: { fontSize: 12 },
    categoryText: { fontSize: 13, color: colors.textSecondary, fontWeight: '500' },
    categoryTextActive: { fontSize: 13, color: colors.text, fontWeight: '600' },

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
        overflow: 'hidden',
    },
    productImage: { width: 44, height: 44, borderRadius: 10 },
    productEmoji: { fontSize: 20 },
    productInfo: { flex: 1, marginLeft: spacing.md },
    productName: { fontSize: 14, fontWeight: '600', color: colors.text },
    productCategory: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
    productThreshold: { fontSize: 10, color: colors.textMuted, marginTop: 2 },
    stockControls: { alignItems: 'flex-end' },
    stockInfo: { alignItems: 'flex-end', marginBottom: spacing.xs },
    stockCount: { fontSize: 20, fontWeight: '700', color: colors.text },
    stockBadge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: 4, marginTop: 4 },
    stockBadgeText: { fontSize: 10, fontWeight: '600' },
    quickButtons: { flexDirection: 'row', gap: spacing.xs },
    quickButton: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: colors.border,
    },
    quickButtonText: { fontSize: 16, color: colors.text, fontWeight: '500' },

    // Empty state
    emptyState: { alignItems: 'center', paddingVertical: spacing.xxxl },
    emptyIcon: { fontSize: 48, marginBottom: spacing.md, opacity: 0.5 },
    emptyText: { fontSize: 16, fontWeight: '600', color: colors.text },
    emptySubtext: { fontSize: 14, color: colors.textMuted, marginTop: spacing.xs },

    // Edit modal
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

    // Add modal
    modalContainer: { flex: 1, backgroundColor: colors.background },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    modalCancel: { color: colors.textSecondary, fontSize: 16 },
    modalTitle: { fontSize: 18, fontWeight: '600', color: colors.text },
    modalContent: { padding: spacing.lg },
    formGroup: { marginBottom: spacing.md },
    formLabel: { fontSize: 12, color: colors.textMuted, marginBottom: spacing.xs, textTransform: 'uppercase', letterSpacing: 0.5 },
    formInput: {
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: spacing.md,
        color: colors.text,
        fontSize: 16,
        borderWidth: 1,
        borderColor: colors.border,
    },
    formRow: { flexDirection: 'row' },
    textArea: { minHeight: 80, textAlignVertical: 'top' },
    categoryPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    categoryOption: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: 20,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
    },
    categoryOptionActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    categoryOptionText: { color: colors.textSecondary, fontWeight: '500' },
    categoryOptionTextActive: { color: colors.text, fontWeight: '600' },

    // Image Upload
    imageUploadRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    imagePreviewContainer: {
        width: 80,
        height: 80,
        borderRadius: 12,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
    },
    uploadedImage: { width: '100%', height: '100%' },
    imagePlaceholder: { alignItems: 'center', justifyContent: 'center' },
    imagePlaceholderIcon: { fontSize: 24, opacity: 0.5 },
    uploadButton: {
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        borderRadius: 8,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        borderColor: colors.border,
    },
    uploadButtonText: { color: colors.text, fontWeight: '600' },
});

export default InventoryScreen;
