import React, { useState } from 'react';
import {
    View,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Alert,
    Modal,
    TextInput,
    Image,
    Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useCart } from '../../contexts/CartContext';
import { Card, Button, ScreenBackground, MerakiText } from '../../components/ui';
import { colors, spacing, layout, gradients } from '../../theme';

const { width } = Dimensions.get('window');

type Product = {
    id: string;
    name: string;
    description: string;
    image_url: string | null;
    retail_price: number;
    wholesale_price: number;
    stock_count: number;
    low_stock_threshold?: number;
    category: string;
};

type ShopStackParamList = {
    ShopMain: undefined;
    ProductDetail: { productId: string; product: Product };
    Cart: undefined;
};

export function ProductDetailScreen() {
    const navigation = useNavigation<any>();
    const route = useRoute<RouteProp<ShopStackParamList, 'ProductDetail'>>();
    const { profile } = useAuth();
    const { addToCart } = useCart();
    const { product } = route.params;
    const [quantity, setQuantity] = useState(1);

    // Edit product state (owners only)
    const [showEditModal, setShowEditModal] = useState(false);
    const [editProduct, setEditProduct] = useState({
        name: product.name,
        description: product.description || '',
        retail_price: product.retail_price.toString(),
        wholesale_price: product.wholesale_price.toString(),
        stock_count: product.stock_count.toString(),
        low_stock_threshold: (product.low_stock_threshold || 5).toString(),
        category: product.category,
        image_url: product.image_url || '',
    });
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);

    const isMaster = profile?.is_master || profile?.role === 'master';
    const isAdmin = (profile?.role as string) === 'admin' || profile?.role === 'owner';
    const isOwner = profile?.role === 'owner';

    const currentPrice = (isMaster || isAdmin) ? product.wholesale_price : product.retail_price;
    const savings = product.retail_price - product.wholesale_price;

    const handleAddToCart = () => {
        if (product.stock_count === 0) {
            Alert.alert('Out of Stock', 'This product is currently unavailable.');
            return;
        }

        for (let i = 0; i < quantity; i++) {
            addToCart({
                id: product.id,
                name: product.name,
                price: currentPrice,
                quantity: 1,
                image_url: product.image_url,
                stock_count: product.stock_count,
            });
        }

        Alert.alert(
            '✅ Added to Cart',
            `${quantity}x ${product.name} added to your cart`,
            [
                { text: 'Continue Shopping', onPress: () => navigation.goBack() },
                { text: 'View Cart', onPress: () => navigation.navigate('Cart') },
            ]
        );
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
                aspect: [1, 1],
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
            const fileName = `products/${product.id}/${Date.now()}.${fileExt}`;
            const base64 = await FileSystem.readAsStringAsync(asset.uri, {
                encoding: 'base64',
            });

            const { error: uploadError } = await supabase.storage
                .from('products')
                .upload(fileName, decode(base64), {
                    contentType: 'image/jpeg',
                    upsert: false,
                });

            if (uploadError) throw uploadError;

            const { data: urlData } = supabase.storage
                .from('products')
                .getPublicUrl(fileName);

            setEditProduct(prev => ({ ...prev, image_url: urlData.publicUrl }));

        } catch (error: any) {
            console.error('Upload error:', error);
            Alert.alert('Error', error.message || 'Failed to upload image');
        } finally {
            setUploading(false);
        }
    };

    const handleSaveProduct = async () => {
        if (!editProduct.name || !editProduct.retail_price || !editProduct.wholesale_price) {
            Alert.alert('Error', 'Please fill in all required fields');
            return;
        }

        setSaving(true);
        try {
            const newStockCount = parseInt(editProduct.stock_count) || 0;
            const newThreshold = parseInt(editProduct.low_stock_threshold) || 5;

            const { error } = await (supabase as any)
                .from('products')
                .update({
                    name: editProduct.name,
                    description: editProduct.description || null,
                    image_url: editProduct.image_url || null,
                    retail_price: parseFloat(editProduct.retail_price),
                    wholesale_price: parseFloat(editProduct.wholesale_price),
                    stock_count: newStockCount,
                    low_stock_threshold: newThreshold,
                    category: editProduct.category,
                })
                .eq('id', product.id);

            if (error) throw error;

            if (newStockCount < newThreshold) {
                try {
                    await (supabase as any).functions.invoke('low-stock-alert');
                } catch (e) {
                    console.log('Low stock alert error:', e);
                }
            }

            Alert.alert('Success', 'Product updated successfully');
            setShowEditModal(false);
            navigation.goBack();
        } catch (error: any) {
            Alert.alert('Error', error.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteProduct = () => {
        Alert.alert(
            'Delete Product',
            'Are you sure you want to delete this product?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const { error } = await (supabase as any)
                                .from('products')
                                .update({ is_active: false })
                                .eq('id', product.id);

                            if (error) throw error;
                            Alert.alert('Success', 'Product deleted');
                            navigation.goBack();
                        } catch (error: any) {
                            Alert.alert('Error', error.message);
                        }
                    },
                },
            ]
        );
    };

    const getCategoryGradient = (category: string): readonly [string, string, ...string[]] => {
        switch (category) {
            case 'Nails': return [colors.primary, colors.primaryDark] as const;
            case 'Lashes': return [colors.secondary, '#8B5CF6'] as const;
            case 'Brows': return [colors.accent, colors.gold] as const;
            case 'Equipment': return [colors.textMuted, colors.borderLight] as const;
            default: return gradients.primary;
        }
    };

    return (
        <ScreenBackground>
            <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Glass Header */}
                    <View style={styles.header}>
                        <TouchableOpacity
                            onPress={() => navigation.goBack()}
                            style={styles.backButton}
                        >
                            <MerakiText style={styles.backIcon}>←</MerakiText>
                        </TouchableOpacity>

                        {isOwner && (
                            <TouchableOpacity
                                onPress={() => setShowEditModal(true)}
                                style={styles.editButton}
                            >
                                <MerakiText variant="bodyBold" style={styles.editButtonText}>Edit</MerakiText>
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* Product Hero Section */}
                    <View style={styles.heroSection}>
                        <Card variant="glass" style={styles.heroCard} noPadding>
                            <View style={styles.imageContainer}>
                                {product.image_url ? (
                                    <Image
                                        source={{ uri: product.image_url }}
                                        style={styles.mainImage}
                                        resizeMode="cover"
                                    />
                                ) : (
                                    <LinearGradient
                                        colors={getCategoryGradient(product.category)}
                                        style={styles.imagePlaceholder}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 1 }}
                                    >
                                        <MerakiText style={styles.emojiIcon}>
                                            {product.category === 'Nails' ? '💅' :
                                                product.category === 'Lashes' ? '👁️' :
                                                    product.category === 'Brows' ? '✨' : '🔧'}
                                        </MerakiText>
                                    </LinearGradient>
                                )}

                                {/* Category Badge Overlays */}
                                <LinearGradient
                                    colors={['transparent', 'rgba(0,0,0,0.6)']}
                                    style={styles.imageOverlay}
                                />
                                <View style={styles.categoryBadge}>
                                    <MerakiText variant="label" color={colors.text}>{product.category}</MerakiText>
                                </View>
                            </View>
                        </Card>
                    </View>

                    {/* Detailed Info Section */}
                    <View style={styles.infoSection}>
                        <View style={styles.titleRow}>
                            <MerakiText variant="h1" style={styles.productName}>{product.name}</MerakiText>
                        </View>

                        <View style={styles.priceSection}>
                            <View style={styles.priceContainer}>
                                <MerakiText variant="h1" style={styles.mainPrice}>
                                    €{currentPrice.toFixed(2)}
                                </MerakiText>
                                {(isMaster || isAdmin) && (
                                    <View style={styles.wholesaleContainer}>
                                        <MerakiText variant="caption" style={styles.wholesaleLabel}>Wholesale Price</MerakiText>
                                        <MerakiText variant="body" style={styles.retailCompare}>
                                            Retail: €{product.retail_price.toFixed(2)}
                                        </MerakiText>
                                    </View>
                                )}
                            </View>

                            {(isMaster || isAdmin) && savings > 0 && (
                                <LinearGradient
                                    colors={['#4ade80', '#22c55e']}
                                    style={styles.savingsBadge}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                >
                                    <MerakiText variant="label" color={colors.text}>Save €{savings.toFixed(2)}</MerakiText>
                                </LinearGradient>
                            )}
                        </View>

                        <MerakiText variant="body" style={styles.description}>
                            {product.description || 'No description available for this premium Merakí product.'}
                        </MerakiText>

                        {/* Stock & Quality Indicators */}
                        <View style={styles.metaInfoRow}>
                            <Card variant="glass" style={styles.metaCard}>
                                <View style={[
                                    styles.stockDot,
                                    product.stock_count > 10 ? styles.inStock : styles.lowStock
                                ]} />
                                <MerakiText variant="bodyBold" style={styles.metaText}>
                                    {product.stock_count > 10 ? 'In Stock' :
                                        product.stock_count === 0 ? 'Out of Stock' :
                                            `Only ${product.stock_count} left`}
                                </MerakiText>
                            </Card>

                            <Card variant="glass" style={styles.metaCard}>
                                <MerakiText style={styles.metaIcon}>✨</MerakiText>
                                <MerakiText variant="bodyBold" style={styles.metaText}>Premium Quality</MerakiText>
                            </Card>
                        </View>
                    </View>

                    {/* Interactable Controls */}
                    <View style={styles.controlsSection}>
                        <View style={styles.quantityRow}>
                            <MerakiText variant="bodyBold" style={styles.controlLabel}>Select Quantity</MerakiText>
                            <View style={styles.quantityControls}>
                                <TouchableOpacity
                                    style={styles.quantityBtn}
                                    onPress={() => setQuantity(Math.max(1, quantity - 1))}
                                    disabled={product.stock_count === 0}
                                >
                                    <MerakiText style={styles.quantityBtnText}>−</MerakiText>
                                </TouchableOpacity>

                                <View style={styles.quantityValueBox}>
                                    <MerakiText variant="h3" style={styles.quantityValue}>{quantity}</MerakiText>
                                </View>

                                <TouchableOpacity
                                    style={styles.quantityBtn}
                                    onPress={() => setQuantity(Math.min(product.stock_count, quantity + 1))}
                                    disabled={product.stock_count === 0 || quantity >= product.stock_count}
                                >
                                    <MerakiText style={styles.quantityBtnText}>+</MerakiText>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Total Summary */}
                        <Card variant="glass" style={styles.totalRow}>
                            <View>
                                <MerakiText variant="caption" color={colors.textMuted}>Total Amount</MerakiText>
                                <MerakiText variant="h2" color={colors.accent}>€{(currentPrice * quantity).toFixed(2)}</MerakiText>
                            </View>
                            <Button
                                title="Add to Cart"
                                variant="primary"
                                onPress={handleAddToCart}
                                disabled={product.stock_count === 0}
                                style={styles.cartBtn}
                            />
                        </Card>
                    </View>
                </ScrollView>

                {/* Refined Edit Modal */}
                <Modal visible={showEditModal} animationType="slide" presentationStyle="pageSheet">
                    <ScreenBackground>
                        <SafeAreaView style={styles.modalContainer}>
                            <View style={styles.modalHeader}>
                                <TouchableOpacity onPress={() => setShowEditModal(false)}>
                                    <MerakiText style={styles.modalCancel}>Cancel</MerakiText>
                                </TouchableOpacity>
                                <MerakiText variant="h3" style={styles.modalTitle}>Edit Product</MerakiText>
                                <TouchableOpacity onPress={handleSaveProduct} disabled={saving}>
                                    <MerakiText variant="bodyBold" style={styles.modalSave}>
                                        {saving ? '...' : 'Save'}
                                    </MerakiText>
                                </TouchableOpacity>
                            </View>

                            <ScrollView style={styles.modalContent}>
                                <View style={styles.imageUploadWrapper}>
                                    <TouchableOpacity
                                        style={styles.imageEditBtn}
                                        onPress={pickImage}
                                        disabled={uploading}
                                    >
                                        {editProduct.image_url ? (
                                            <Image source={{ uri: editProduct.image_url }} style={styles.editImage} />
                                        ) : (
                                            <View style={styles.editImagePlaceholder}>
                                                <MerakiText style={styles.placeholderIcon}>📷</MerakiText>
                                            </View>
                                        )}
                                        <View style={styles.editIconBadge}>
                                            <MerakiText style={styles.editIconSmall}>✏️</MerakiText>
                                        </View>
                                    </TouchableOpacity>
                                    {uploading && <MerakiText variant="caption" style={styles.uploadingMsg}>Uploading...</MerakiText>}
                                </View>

                                <Card variant="glass" style={styles.formCard}>
                                    <View style={styles.inputGroup}>
                                        <MerakiText variant="caption" style={styles.inputLabel}>Product Name</MerakiText>
                                        <TextInput
                                            style={styles.input}
                                            value={editProduct.name}
                                            onChangeText={(text) => setEditProduct({ ...editProduct, name: text })}
                                            placeholderTextColor={colors.textMuted}
                                        />
                                    </View>

                                    <View style={styles.inputGroup}>
                                        <MerakiText variant="caption" style={styles.inputLabel}>Description</MerakiText>
                                        <TextInput
                                            style={[styles.input, styles.textArea]}
                                            value={editProduct.description}
                                            onChangeText={(text) => setEditProduct({ ...editProduct, description: text })}
                                            multiline
                                            numberOfLines={4}
                                            placeholderTextColor={colors.textMuted}
                                        />
                                    </View>

                                    <View style={styles.inputRow}>
                                        <View style={styles.inputHalf}>
                                            <MerakiText variant="caption" style={styles.inputLabel}>Retail €</MerakiText>
                                            <TextInput
                                                style={styles.input}
                                                value={editProduct.retail_price}
                                                onChangeText={(text) => setEditProduct({ ...editProduct, retail_price: text })}
                                                keyboardType="decimal-pad"
                                            />
                                        </View>
                                        <View style={styles.inputHalf}>
                                            <MerakiText variant="caption" style={styles.inputLabel}>Wholesale €</MerakiText>
                                            <TextInput
                                                style={styles.input}
                                                value={editProduct.wholesale_price}
                                                onChangeText={(text) => setEditProduct({ ...editProduct, wholesale_price: text })}
                                                keyboardType="decimal-pad"
                                            />
                                        </View>
                                    </View>

                                    <View style={styles.inputRow}>
                                        <View style={styles.inputHalf}>
                                            <MerakiText variant="caption" style={styles.inputLabel}>In Stock</MerakiText>
                                            <TextInput
                                                style={styles.input}
                                                value={editProduct.stock_count}
                                                onChangeText={(text) => setEditProduct({ ...editProduct, stock_count: text })}
                                                keyboardType="number-pad"
                                            />
                                        </View>
                                        <View style={styles.inputHalf}>
                                            <MerakiText variant="caption" style={styles.inputLabel}>Alert Threshold</MerakiText>
                                            <TextInput
                                                style={styles.input}
                                                value={editProduct.low_stock_threshold}
                                                onChangeText={(text) => setEditProduct({ ...editProduct, low_stock_threshold: text })}
                                                keyboardType="number-pad"
                                            />
                                        </View>
                                    </View>
                                </Card>

                                <TouchableOpacity
                                    style={styles.dangerButton}
                                    onPress={handleDeleteProduct}
                                >
                                    <MerakiText style={styles.dangerText}>Delete Product</MerakiText>
                                </TouchableOpacity>
                                <View style={{ height: 40 }} />
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
        flex: 1,
    },
    scrollContent: {
        paddingBottom: spacing.xxxl,
    },

    // Header
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        zIndex: 10,
    },
    backButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: colors.surfaceGlass,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.08)',
    },
    backIcon: {
        fontSize: 22,
        color: colors.text,
        marginLeft: -2,
    },
    editButton: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: 20,
        backgroundColor: colors.surfaceGlass,
        borderWidth: 1,
        borderColor: colors.primary,
    },
    editButtonText: {
        color: colors.primary,
    },

    // Hero Section
    heroSection: {
        paddingHorizontal: spacing.lg,
        marginTop: spacing.sm,
    },
    heroCard: {
        borderRadius: layout.borderRadius.lg,
        overflow: 'hidden',
    },
    imageContainer: {
        width: '100%',
        aspectRatio: 1,
        position: 'relative',
    },
    mainImage: {
        width: '100%',
        height: '100%',
    },
    imagePlaceholder: {
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
    },
    emojiIcon: {
        fontSize: 100,
    },
    imageOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 100,
    },
    categoryBadge: {
        position: 'absolute',
        top: spacing.md,
        right: spacing.md,
        backgroundColor: 'rgba(0,0,0,0.5)',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.12)',
    },

    // Info Section
    infoSection: {
        paddingHorizontal: spacing.lg,
        marginTop: spacing.xl,
    },
    titleRow: {
        marginBottom: spacing.md,
    },
    productName: {
        color: colors.text,
        lineHeight: 38,
    },
    priceSection: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: spacing.lg,
    },
    priceContainer: {
        flex: 1,
    },
    mainPrice: {
        color: colors.accent,
        marginBottom: 4,
    },
    wholesaleContainer: {
        marginTop: 4,
    },
    wholesaleLabel: {
        color: colors.primary,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 1,
        fontSize: 10,
    },
    retailCompare: {
        color: colors.textMuted,
        textDecorationLine: 'line-through',
    },
    savingsBadge: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderRadius: layout.borderRadius.sm,
    },
    description: {
        color: colors.textSecondary,
        lineHeight: 24,
        marginBottom: spacing.xl,
    },
    metaInfoRow: {
        flexDirection: 'row',
        gap: spacing.md,
    },
    metaCard: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        borderRadius: 16,
    },
    stockDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: spacing.sm,
    },
    inStock: {
        backgroundColor: '#4ade80',
        shadowColor: '#4ade80',
        shadowRadius: 4,
        elevation: 4,
    },
    lowStock: {
        backgroundColor: colors.warning,
        shadowColor: colors.warning,
        shadowRadius: 4,
        elevation: 4,
    },
    metaIcon: {
        fontSize: 16,
        marginRight: spacing.sm,
    },
    metaText: {
        fontSize: 12,
        color: colors.text,
    },

    // Controls Section
    controlsSection: {
        paddingHorizontal: spacing.lg,
        marginTop: spacing.xxl,
    },
    quantityRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.xl,
    },
    controlLabel: {
        color: colors.text,
    },
    quantityControls: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surfaceGlass,
        borderRadius: 25,
        padding: 4,
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.04)',
    },
    quantityBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(0, 0, 0, 0.08)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    quantityBtnText: {
        fontSize: 22,
        color: colors.text,
        fontWeight: '300',
    },
    quantityValueBox: {
        width: 50,
        alignItems: 'center',
    },
    quantityValue: {
        color: colors.text,
    },
    totalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderRadius: 24,
        padding: spacing.md,
    },
    cartBtn: {
        width: '60%',
    },

    // Modal Styles
    modalContainer: {
        flex: 1,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0, 0, 0, 0.04)',
    },
    modalTitle: {
        color: colors.text,
    },
    modalCancel: {
        color: colors.textMuted,
        fontSize: 16,
    },
    modalSave: {
        color: colors.primary,
        fontSize: 16,
    },
    modalContent: {
        padding: spacing.lg,
    },
    imageUploadWrapper: {
        alignItems: 'center',
        marginBottom: spacing.xl,
    },
    imageEditBtn: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: colors.surfaceLight,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
    },
    editImage: {
        width: '100%',
        height: '100%',
    },
    editImagePlaceholder: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    placeholderIcon: {
        fontSize: 32,
        opacity: 0.5,
    },
    editIconBadge: {
        position: 'absolute',
        bottom: 8,
        right: 8,
        backgroundColor: colors.primary,
        width: 30,
        height: 30,
        borderRadius: 15,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: colors.background,
    },
    editIconSmall: {
        fontSize: 14,
    },
    uploadingMsg: {
        marginTop: 8,
        color: colors.primary,
    },
    formCard: {
        borderRadius: 20,
        padding: spacing.md,
    },
    inputGroup: {
        marginBottom: spacing.md,
    },
    inputLabel: {
        color: colors.textMuted,
        marginBottom: 6,
        marginLeft: 4,
    },
    input: {
        backgroundColor: 'rgba(0, 0, 0, 0.04)',
        borderRadius: 12,
        paddingHorizontal: spacing.md,
        paddingVertical: 12,
        color: colors.text,
        fontSize: 16,
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.08)',
    },
    textArea: {
        height: 100,
        textAlignVertical: 'top',
    },
    inputRow: {
        flexDirection: 'row',
        gap: spacing.md,
        marginBottom: spacing.md,
    },
    inputHalf: {
        flex: 1,
    },
    dangerButton: {
        marginTop: spacing.xl,
        padding: spacing.md,
        borderRadius: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(254, 164, 175, 0.3)',
    },
    dangerText: {
        color: colors.error,
        fontWeight: '600',
    },
});

export default ProductDetailScreen;
