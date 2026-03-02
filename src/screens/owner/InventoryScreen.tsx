import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    TextInput,
    Modal,
    Image,
} from 'react-native';
import { useModal } from '../../contexts/ModalContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { supabase } from '../../lib/supabase';
import { ScreenBackground, Button, ConfirmModal, MerakiText } from '../../components/ui';
import { colors, spacing, gradients } from '../../theme';

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
    { label: 'All', icon: 'sparkles' },
    { label: 'Nails', icon: 'hand-heart' },
    { label: 'Lashes', icon: 'eye' },
    { label: 'Brows', icon: 'face-woman' },
    { label: 'Equipment', icon: 'tools' },
];

export function InventoryScreen() {
    const navigation = useNavigation<any>();
    const { showAlert, showConfirm } = useModal();
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
                try {
                    await supabase.functions.invoke('low-stock-alert');
                } catch (e) {
                    console.log('Low stock alert trigger:', e);
                }
            }

            showAlert('Success', 'Stock updated successfully', 'success');
            setEditingProduct(null);
            fetchProducts();
        } catch (error: any) {
            showAlert('Error', error.message, 'error');
        } finally {
            setSaving(false);
        }
    };

    const pickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            showAlert('Permission needed', 'Please grant gallery access to upload product photos.', 'warning');
            return;
        }

        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1], // Square aspect for products
                quality: 0.8,
            });

            if (!result.canceled && result.assets[0]) {
                uploadImage(result.assets[0]);
            }
        } catch (error) {
            showAlert('Error', 'Failed to pick image', 'error');
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
            showAlert('Error', error.message || 'Failed to upload image', 'error');
        } finally {
            setUploading(false);
        }
    };

    const handleAddProduct = async () => {
        if (!newProduct.name || !newProduct.retail_price || !newProduct.wholesale_price) {
            showAlert('Error', 'Please fill in all required fields (Name, Retail Price, Wholesale Price)', 'error');
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

            showAlert('Success', 'Product added successfully', 'success');
            setShowAddModal(false);
            resetNewProduct();
            fetchProducts();
        } catch (error: any) {
            showAlert('Error', error.message, 'error');
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
            showAlert('Error', error.message, 'error');
        }
    };

    const handleProductPress = (product: Product) => {
        navigation.navigate('ProductDetail', { productId: product.id, product });
    };

    const handleDeleteProduct = (product: Product) => {
        showConfirm(
            'Delete Product',
            `Are you sure you want to delete "${product.name}"? This action cannot be undone.`,
            async () => {
                try {
                    const { error } = await (supabase as any)
                        .from('products')
                        .delete()
                        .eq('id', product.id);

                    if (error) throw error;

                    setProducts(prev => prev.filter(p => p.id !== product.id));
                    showAlert('Success', 'Product deleted successfully', 'success');
                } catch (error: any) {
                    showAlert('Error', error.message || 'Failed to delete product', 'error');
                }
            },
            {
                type: 'error',
                confirmText: 'Delete',
                cancelText: 'Cancel',
            }
        );
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
            case 'Nails': return 'hand-heart';
            case 'Lashes': return 'eye';
            case 'Brows': return 'face-woman';
            case 'Equipment': return 'tools';
            default: return 'shopping';
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
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <MerakiText variant="h3" style={styles.headerTitle}>Inventory</MerakiText>
                    <TouchableOpacity style={styles.addButton} onPress={() => setShowAddModal(true)}>
                        <MaterialCommunityIcons name="plus" size={24} color={colors.text} />
                    </TouchableOpacity>
                </View>

                {/* Search Bar */}
                <View style={styles.searchContainer}>
                    <MaterialCommunityIcons name="magnify" size={20} color={colors.textMuted} style={styles.searchIcon} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search products..."
                        placeholderTextColor={colors.textMuted}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <MaterialCommunityIcons name="close" size={20} color={colors.textMuted} />
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
                    {CATEGORIES.map((cat) => {
                        const isSelected = selectedCategory === cat.label;
                        return (
                            <TouchableOpacity
                                key={cat.label}
                                onPress={() => setSelectedCategory(cat.label)}
                                activeOpacity={0.7}
                            >
                                {isSelected ? (
                                    <LinearGradient
                                        colors={['#D48A82', '#C0A0E0']}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 0 }}
                                        style={styles.categoryChipActive}
                                    >
                                        <MaterialCommunityIcons name={cat.icon as any} size={16} color={colors.text} style={{ marginRight: 6 }} />
                                        <MerakiText variant="caption" style={styles.categoryTextActive}>{cat.label}</MerakiText>
                                    </LinearGradient>
                                ) : (
                                    <View style={styles.categoryChip}>
                                        <MaterialCommunityIcons name={cat.icon as any} size={16} color={colors.textSecondary} style={{ marginRight: 6 }} />
                                        <MerakiText variant="caption" style={styles.categoryText}>{cat.label}</MerakiText>
                                    </View>
                                )}
                            </TouchableOpacity>
                        );
                    })}
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
                            <MerakiText variant="h2" style={styles.summaryNumber}>{getOutOfStockProducts().length}</MerakiText>
                            <MerakiText variant="caption" style={styles.summaryLabel}>Out of Stock</MerakiText>
                        </View>
                        <View style={[styles.summaryCard, { backgroundColor: 'rgba(245,158,11,0.1)' }]}>
                            <MerakiText variant="h2" style={styles.summaryNumber}>{getLowStockProducts().length}</MerakiText>
                            <MerakiText variant="caption" style={styles.summaryLabel}>Low Stock</MerakiText>
                        </View>
                        <View style={[styles.summaryCard, { backgroundColor: 'rgba(34,197,94,0.1)' }]}>
                            <MerakiText variant="h2" style={styles.summaryNumber}>{products.length}</MerakiText>
                            <MerakiText variant="caption" style={styles.summaryLabel}>Total Products</MerakiText>
                        </View>
                    </View>

                    {/* Low Stock Alert */}
                    {getLowStockProducts().length > 0 && (
                        <View style={styles.alertCard}>
                            <MaterialCommunityIcons name="alert" size={20} color="#F59E0B" style={styles.alertIcon} />
                            <MerakiText variant="body" style={styles.alertText}>
                                {getLowStockProducts().length} products need restocking
                            </MerakiText>
                        </View>
                    )}

                    {/* Products List */}
                    <MerakiText variant="caption" style={styles.sectionTitle}>
                        {selectedCategory === 'All' ? 'All Products' : selectedCategory} ({filteredProducts.length})
                    </MerakiText>

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
                                            <MaterialCommunityIcons name={getCategoryIcon(product.category) as any} size={24} color={colors.primary} />
                                        )}
                                    </View>
                                    <View style={styles.productInfo}>
                                        <MerakiText variant="body" style={styles.productName} numberOfLines={1}>{product.name}</MerakiText>
                                        <MerakiText variant="caption" style={styles.productCategory}>{product.category}</MerakiText>
                                        <MerakiText variant="caption" style={styles.productThreshold}>
                                            Alert at: {product.low_stock_threshold} units
                                        </MerakiText>
                                    </View>
                                    <View style={styles.stockControls}>
                                        <View style={styles.stockInfo}>
                                            <MerakiText variant="h3" style={styles.stockCount}>{product.stock_count}</MerakiText>
                                            <View style={[styles.stockBadge, { backgroundColor: status.bg }]}>
                                                <MerakiText variant="caption" style={[styles.stockBadgeText, { color: status.color }]}>
                                                    {status.label}
                                                </MerakiText>
                                            </View>
                                        </View>
                                        <TouchableOpacity
                                            style={styles.deleteButton}
                                            onPress={() => handleDeleteProduct(product)}
                                        >
                                            <MaterialCommunityIcons name="trash-can-outline" size={18} color={'#FF453A'} />
                                        </TouchableOpacity>
                                    </View>
                                </TouchableOpacity>
                            );
                        })
                    ) : (
                        <View style={styles.emptyState}>
                            <MaterialCommunityIcons name="package-variant" size={64} color={colors.textMuted} style={styles.emptyIcon} />
                            <MerakiText variant="h3" style={styles.emptyText}>No products found</MerakiText>
                            <MerakiText variant="body" style={styles.emptySubtext}>
                                {searchQuery ? 'Try a different search' : 'Tap + to add your first product'}
                            </MerakiText>
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
                    icon="package-variant"
                >
                    <View style={styles.inputGroup}>
                        <MerakiText variant="caption" style={styles.inputLabel}>Current Stock</MerakiText>
                        <TextInput
                            style={styles.input}
                            value={editStock}
                            onChangeText={setEditStock}
                            keyboardType="number-pad"
                            placeholderTextColor={colors.textMuted}
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <MerakiText variant="caption" style={styles.inputLabel}>Low Stock Threshold</MerakiText>
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
                    <ScreenBackground>
                        <SafeAreaView style={styles.modalContainer}>
                            <View style={styles.modalHeader}>
                                <TouchableOpacity onPress={() => setShowAddModal(false)}>
                                    <MerakiText variant="body" style={styles.modalCancel}>Cancel</MerakiText>
                                </TouchableOpacity>
                                <MerakiText variant="h3" style={styles.modalTitle}>Add Product</MerakiText>
                                <View style={{ width: 60 }} />
                            </View>

                            <ScrollView style={styles.modalContent}>
                                <View style={styles.formGroup}>
                                    <MerakiText variant="caption" style={styles.formLabel}>Name *</MerakiText>
                                    <TextInput
                                        style={styles.formInput}
                                        value={newProduct.name}
                                        onChangeText={(text) => setNewProduct({ ...newProduct, name: text })}
                                        placeholder="Product name"
                                        placeholderTextColor={colors.textMuted}
                                    />
                                </View>

                                <View style={styles.formGroup}>
                                    <MerakiText variant="caption" style={styles.formLabel}>Description</MerakiText>
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
                                    <MerakiText variant="caption" style={styles.formLabel}>Product Image</MerakiText>
                                    <View style={styles.imageUploadRow}>
                                        <View style={styles.imagePreviewContainer}>
                                            {newProduct.image_url ? (
                                                <Image source={{ uri: newProduct.image_url }} style={styles.uploadedImage} />
                                            ) : (
                                                <View style={styles.imagePlaceholder}>
                                                    <MaterialCommunityIcons name="camera" size={24} color={colors.textMuted} />
                                                </View>
                                            )}
                                        </View>
                                        <TouchableOpacity
                                            style={styles.uploadButton}
                                            onPress={pickImage}
                                            disabled={uploading}
                                        >
                                            <MerakiText variant="caption" style={styles.uploadButtonText}>
                                                {uploading ? 'Uploading...' : newProduct.image_url ? 'Change Photo' : 'Upload Photo'}
                                            </MerakiText>
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                <View style={styles.formRow}>
                                    <View style={[styles.formGroup, { flex: 1 }]}>
                                        <MerakiText variant="caption" style={styles.formLabel}>Retail Price *</MerakiText>
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
                                        <MerakiText variant="caption" style={styles.formLabel}>Wholesale *</MerakiText>
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
                                        <MerakiText variant="caption" style={styles.formLabel}>Stock Count</MerakiText>
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
                                        <MerakiText variant="caption" style={styles.formLabel}>Low Stock Alert</MerakiText>
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
                                    <MerakiText variant="caption" style={styles.formLabel}>Category</MerakiText>
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
                                                <MerakiText variant="caption" style={[
                                                    styles.categoryOptionText,
                                                    newProduct.category === cat && styles.categoryOptionTextActive,
                                                ]}>
                                                    {cat}
                                                </MerakiText>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>

                                <Button
                                    title={saving ? 'Adding...' : 'Add Product'}
                                    onPress={handleAddProduct}
                                    fullWidth
                                    disabled={saving}
                                    style={{ marginTop: spacing.md, marginBottom: spacing.xl }}
                                />
                            </ScrollView>
                        </SafeAreaView>
                    </ScreenBackground>
                </Modal>
            </SafeAreaView>
        </ScreenBackground >
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    modalContainer: { flex: 1 },
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
    backBtn: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.05)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: { color: colors.text },
    addButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
    },

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
    searchIcon: { marginRight: spacing.sm, opacity: 0.5 },
    searchInput: { flex: 1, fontSize: 15, color: colors.text },

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
    },
    categoryChipActive: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    categoryText: { color: colors.textSecondary },
    categoryTextActive: { color: colors.text, fontWeight: '600' },

    content: { padding: spacing.lg, paddingBottom: 100 },
    summaryRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg },
    summaryCard: {
        flex: 1,
        borderRadius: 16,
        padding: spacing.md,
        alignItems: 'center',
    },
    summaryNumber: { fontWeight: '700', color: colors.text },
    summaryLabel: { color: colors.textSecondary, marginTop: 4 },
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
    alertIcon: { marginRight: spacing.sm },
    alertText: { flex: 1, color: colors.text },
    sectionTitle: {
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
    productInfo: { flex: 1, marginLeft: spacing.md },
    productName: { fontWeight: '600', color: colors.text },
    productCategory: { color: colors.textMuted, marginTop: 2 },
    productThreshold: { color: colors.textMuted, marginTop: 2 },
    stockControls: { alignItems: 'flex-end', gap: 4 },
    stockInfo: { alignItems: 'flex-end', marginBottom: spacing.xs },
    stockCount: { color: colors.text },
    stockBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        marginTop: 4,
    },
    stockBadgeText: { fontWeight: '600' },
    quickButtons: { flexDirection: 'row', gap: 8 },
    quickButton: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: colors.background,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: colors.border,
    },
    quickButtonText: { color: colors.text, fontSize: 16 },
    deleteButton: {
        padding: 6,
        marginTop: 8,
        alignSelf: 'flex-end',
    },
    emptyState: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.xl,
    },
    emptyIcon: { marginBottom: spacing.lg },
    emptyText: { fontWeight: '600', color: colors.text, marginBottom: spacing.sm },
    emptySubtext: { color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },

    // Modal
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    modalCancel: { color: colors.text },
    modalTitle: { fontWeight: '600', color: colors.text },
    modalContent: { padding: spacing.lg },
    formGroup: { marginBottom: spacing.md },
    formLabel: { color: colors.textMuted, marginBottom: 6, textTransform: 'uppercase' },
    formInput: {
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: spacing.md,
        color: colors.text,
        fontSize: 16,
        borderWidth: 1,
        borderColor: colors.border,
    },
    textArea: { minHeight: 80, textAlignVertical: 'top' },
    formRow: { flexDirection: 'row' },
    imageUploadRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    imagePreviewContainer: {
        width: 60,
        height: 60,
        borderRadius: 10,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    uploadedImage: { width: '100%', height: '100%' },
    imagePlaceholder: { alignItems: 'center', justifyContent: 'center' },
    uploadButton: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: 8,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
    },
    uploadButtonText: { color: colors.primary },
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
    categoryOptionText: { color: colors.textSecondary },
    categoryOptionTextActive: { color: colors.text, fontWeight: '600' },
    inputGroup: { gap: spacing.sm },
    inputLabel: { fontWeight: '600', color: colors.text },
    input: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 12,
        padding: spacing.md,
        fontSize: 16,
        color: colors.text,
        borderWidth: 1,
        borderColor: colors.border,
    },
});

export default InventoryScreen;
