import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Alert,
    Modal,
    TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useCart } from '../../contexts/CartContext';
import { Card, Button, ScreenBackground } from '../../components/ui';
import { colors, spacing } from '../../theme';

type Product = {
    id: string;
    name: string;
    description: string;
    image_url: string | null;
    retail_price: number;
    wholesale_price: number;
    stock_count: number;
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
    const { addToCart, getItemCount } = useCart();
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
        category: product.category,
    });
    const [saving, setSaving] = useState(false);

    const isMaster = profile?.is_master || profile?.role === 'master';
    const isOwner = profile?.role === 'owner';
    const price = (isMaster || isOwner) ? product.wholesale_price : product.retail_price;
    const savings = product.retail_price - product.wholesale_price;

    const handleAddToCart = () => {
        for (let i = 0; i < quantity; i++) {
            addToCart({
                id: product.id,
                name: product.name,
                price: price,
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

    const handleSaveProduct = async () => {
        if (!editProduct.name || !editProduct.retail_price || !editProduct.wholesale_price) {
            Alert.alert('Error', 'Please fill in all required fields');
            return;
        }

        setSaving(true);
        try {
            const { error } = await (supabase as any)
                .from('products')
                .update({
                    name: editProduct.name,
                    description: editProduct.description || null,
                    retail_price: parseFloat(editProduct.retail_price),
                    wholesale_price: parseFloat(editProduct.wholesale_price),
                    stock_count: parseInt(editProduct.stock_count) || 0,
                    category: editProduct.category,
                })
                .eq('id', product.id);

            if (error) throw error;

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

    return (
        <ScreenBackground>
            <SafeAreaView style={styles.container} edges={['top']}>
                <ScrollView contentContainerStyle={styles.content}>
                    {/* Header */}
                    <View style={styles.header}>
                        <TouchableOpacity onPress={() => navigation.goBack()}>
                            <Text style={styles.backButton}>← Back</Text>
                        </TouchableOpacity>
                        {isOwner && (
                            <TouchableOpacity onPress={() => setShowEditModal(true)} style={styles.editButton}>
                                <Text style={styles.editButtonText}>✏️ Edit</Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* Product Image */}
                    <View style={styles.imageSection}>
                        <View style={styles.productImage}>
                            <Text style={styles.productEmoji}>
                                {product.category === 'Nails' ? '💅' :
                                    product.category === 'Lashes' ? '👁️' :
                                        product.category === 'Brows' ? '✨' : '🔧'}
                            </Text>
                        </View>
                    </View>

                    {/* Product Info */}
                    <View style={styles.infoSection}>
                        <Text style={styles.productName}>{product.name}</Text>
                        <Text style={styles.category}>{product.category}</Text>

                        <View style={styles.priceSection}>
                            <Text style={styles.price}>€{price.toFixed(2)}</Text>
                            {isMaster && (
                                <View style={styles.savingsRow}>
                                    <Text style={styles.retailPrice}>
                                        Retail: €{product.retail_price.toFixed(2)}
                                    </Text>
                                    <View style={styles.savingsBadge}>
                                        <Text style={styles.savingsText}>
                                            You save €{savings.toFixed(2)}
                                        </Text>
                                    </View>
                                </View>
                            )}
                        </View>

                        <Text style={styles.description}>{product.description}</Text>

                        {/* Stock Status */}
                        <Card style={styles.stockCard} variant="glass">
                            <View style={[
                                styles.stockDot,
                                product.stock_count > 10 ? styles.inStock : styles.lowStock
                            ]} />
                            <Text style={styles.stockText}>
                                {product.stock_count > 10
                                    ? 'In Stock'
                                    : `Only ${product.stock_count} left`}
                            </Text>
                        </Card>
                    </View>

                    {/* Quantity Selector */}
                    <View style={styles.quantitySection}>
                        <Text style={styles.quantityLabel}>Quantity</Text>
                        <View style={styles.quantityControls}>
                            <TouchableOpacity
                                style={styles.quantityButton}
                                onPress={() => setQuantity(Math.max(1, quantity - 1))}
                            >
                                <Text style={styles.quantityButtonText}>−</Text>
                            </TouchableOpacity>
                            <Text style={styles.quantityValue}>{quantity}</Text>
                            <TouchableOpacity
                                style={styles.quantityButton}
                                onPress={() => setQuantity(Math.min(product.stock_count, quantity + 1))}
                            >
                                <Text style={styles.quantityButtonText}>+</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Total */}
                    <Card style={styles.totalCard} variant="elevated">
                        <Text style={styles.totalLabel}>Total</Text>
                        <Text style={styles.totalValue}>€{(price * quantity).toFixed(2)}</Text>
                    </Card>

                    {/* Add to Cart */}
                    <Button
                        title="Add to Cart"
                        onPress={handleAddToCart}
                        fullWidth
                        disabled={product.stock_count === 0}
                    />
                </ScrollView>

                {/* Edit Product Modal (Owners only) */}
                <Modal visible={showEditModal} animationType="slide" transparent>
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContent}>
                            <Text style={styles.modalTitle}>Edit Product</Text>

                            <TextInput
                                style={styles.modalInput}
                                value={editProduct.name}
                                onChangeText={(text) => setEditProduct({ ...editProduct, name: text })}
                                placeholder="Product Name"
                                placeholderTextColor={colors.textMuted}
                            />

                            <TextInput
                                style={[styles.modalInput, styles.textArea]}
                                value={editProduct.description}
                                onChangeText={(text) => setEditProduct({ ...editProduct, description: text })}
                                placeholder="Description"
                                placeholderTextColor={colors.textMuted}
                                multiline
                            />

                            <View style={styles.priceRow}>
                                <View style={styles.priceInputContainer}>
                                    <Text style={styles.inputLabel}>Retail €</Text>
                                    <TextInput
                                        style={styles.modalInput}
                                        value={editProduct.retail_price}
                                        onChangeText={(text) => setEditProduct({ ...editProduct, retail_price: text })}
                                        keyboardType="decimal-pad"
                                        placeholderTextColor={colors.textMuted}
                                    />
                                </View>
                                <View style={styles.priceInputContainer}>
                                    <Text style={styles.inputLabel}>Wholesale €</Text>
                                    <TextInput
                                        style={styles.modalInput}
                                        value={editProduct.wholesale_price}
                                        onChangeText={(text) => setEditProduct({ ...editProduct, wholesale_price: text })}
                                        keyboardType="decimal-pad"
                                        placeholderTextColor={colors.textMuted}
                                    />
                                </View>
                            </View>

                            <TextInput
                                style={styles.modalInput}
                                value={editProduct.stock_count}
                                onChangeText={(text) => setEditProduct({ ...editProduct, stock_count: text })}
                                placeholder="Stock Count"
                                keyboardType="number-pad"
                                placeholderTextColor={colors.textMuted}
                            />

                            <View style={styles.modalButtons}>
                                <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteProduct}>
                                    <Text style={styles.deleteBtnText}>Delete</Text>
                                </TouchableOpacity>
                                <View style={styles.modalButtonsSpacer} />
                                <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowEditModal(false)}>
                                    <Text style={styles.cancelBtnText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.saveBtn} onPress={handleSaveProduct} disabled={saving}>
                                    <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save'}</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>
            </SafeAreaView>
        </ScreenBackground>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    content: { padding: spacing.lg },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
    backButton: { color: colors.textSecondary, fontSize: 16 },
    editButton: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
    editButtonText: { color: colors.primary, fontSize: 16, fontWeight: '500' },
    imageSection: { marginBottom: spacing.xl },
    productImage: { aspectRatio: 1, backgroundColor: colors.surface, borderRadius: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
    productEmoji: { fontSize: 120 },
    infoSection: { marginBottom: spacing.xl },
    productName: { fontSize: 32, fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
    category: { fontSize: 16, color: colors.primary, marginBottom: spacing.lg, fontWeight: '500' },
    priceSection: { marginBottom: spacing.lg },
    price: { fontSize: 36, fontWeight: '700', color: colors.text },
    savingsRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm, gap: spacing.md },
    retailPrice: { fontSize: 16, color: colors.textMuted, textDecorationLine: 'line-through' },
    savingsBadge: { backgroundColor: colors.success, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: 4 },
    savingsText: { color: colors.text, fontSize: 12, fontWeight: '600' },
    description: { fontSize: 16, color: colors.textSecondary, lineHeight: 24 },
    stockCard: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.lg, padding: spacing.md },
    stockDot: { width: 8, height: 8, borderRadius: 4, marginRight: spacing.sm },
    inStock: { backgroundColor: colors.success },
    lowStock: { backgroundColor: colors.warning },
    stockText: { fontSize: 14, color: colors.text, fontWeight: '500' },
    quantitySection: { marginBottom: spacing.lg },
    quantityLabel: { fontSize: 14, fontWeight: '500', color: colors.text, marginBottom: spacing.sm },
    quantityControls: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
    quantityButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
    quantityButtonText: { fontSize: 24, color: colors.text, lineHeight: 24 },
    quantityValue: { fontSize: 24, fontWeight: '600', color: colors.text, minWidth: 40, textAlign: 'center' },
    totalCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg, borderRadius: 16 },
    totalLabel: { fontSize: 18, color: colors.textSecondary },
    totalValue: { fontSize: 28, fontWeight: '700', color: colors.primary },
    // Modal styles
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
    modalContent: { backgroundColor: colors.surface, borderRadius: 16, padding: spacing.lg, width: '100%', maxWidth: 400, borderWidth: 1, borderColor: colors.border },
    modalTitle: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: spacing.lg, textAlign: 'center' },
    modalInput: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: spacing.md, color: colors.text, fontSize: 16, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
    textArea: { minHeight: 80, textAlignVertical: 'top' },
    priceRow: { flexDirection: 'row', gap: spacing.md },
    priceInputContainer: { flex: 1 },
    inputLabel: { fontSize: 12, color: colors.textMuted, marginBottom: spacing.xs },
    modalButtons: { flexDirection: 'row', marginTop: spacing.md, gap: spacing.sm },
    modalButtonsSpacer: { flex: 1 },
    deleteBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 8, borderWidth: 1, borderColor: colors.error },
    deleteBtnText: { color: colors.error, fontWeight: '600' },
    cancelBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.1)' },
    cancelBtnText: { color: colors.textSecondary, fontWeight: '600' },
    saveBtn: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: 8, backgroundColor: colors.primary },
    saveBtnText: { color: colors.text, fontWeight: '600' },
});

export default ProductDetailScreen;
