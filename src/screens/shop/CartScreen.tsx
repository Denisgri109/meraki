import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useCart } from '../../contexts/CartContext';
import { Button, ScreenBackground } from '../../components/ui';
import { colors, spacing } from '../../theme';

export function CartScreen() {
    const navigation = useNavigation<any>();
    const { items, removeFromCart, updateQuantity, getTotal, clearCart } = useCart();

    const handleCheckout = () => {
        if (items.length === 0) {
            Alert.alert('Empty Cart', 'Add some products to your cart first!');
            return;
        }
        navigation.navigate('Checkout');
    };

    const handleRemoveItem = (productId: string, productName: string) => {
        Alert.alert(
            'Remove Item',
            `Remove ${productName} from cart?`,
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Remove', style: 'destructive', onPress: () => removeFromCart(productId) },
            ]
        );
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

    if (items.length === 0) {
        return (
            <ScreenBackground>
                <SafeAreaView style={styles.container}>
                    <View style={styles.header}>
                        <TouchableOpacity onPress={() => navigation.goBack()}>
                            <Text style={styles.backButton}>←</Text>
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>Cart</Text>
                        <View style={{ width: 40 }} />
                    </View>
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyIcon}>🛒</Text>
                        <Text style={styles.emptyTitle}>Your cart is empty</Text>
                        <Text style={styles.emptySubtitle}>Add some products to get started!</Text>
                        <Button
                            title="Browse Products"
                            onPress={() => navigation.navigate('ShopMain')}
                            style={{ marginTop: spacing.lg }}
                        />
                    </View>
                </SafeAreaView>
            </ScreenBackground>
        );
    }

    return (
        <ScreenBackground>
            <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()}>
                        <Text style={styles.backButton}>←</Text>
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Cart ({items.length})</Text>
                    <TouchableOpacity onPress={() => clearCart()}>
                        <Text style={styles.clearButton}>Clear</Text>
                    </TouchableOpacity>
                </View>

                <ScrollView
                    style={styles.content}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    {items.map((item) => (
                        <View key={item.id} style={styles.cartItem}>
                            <LinearGradient
                                colors={['rgba(139,92,246,0.1)', 'rgba(59,130,246,0.1)']}
                                style={styles.itemImage}
                            >
                                <Text style={styles.itemEmoji}>{getCategoryIcon(null)}</Text>
                            </LinearGradient>

                            <View style={styles.itemDetails}>
                                <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
                                <Text style={styles.itemPrice}>€{item.price.toFixed(2)}</Text>

                                <View style={styles.quantityRow}>
                                    <TouchableOpacity
                                        style={styles.quantityButton}
                                        onPress={() => updateQuantity(item.id, item.quantity - 1)}
                                    >
                                        <Text style={styles.quantityButtonText}>−</Text>
                                    </TouchableOpacity>
                                    <Text style={styles.quantityText}>{item.quantity}</Text>
                                    <TouchableOpacity
                                        style={styles.quantityButton}
                                        onPress={() => updateQuantity(item.id, item.quantity + 1)}
                                        disabled={item.quantity >= item.stock_count}
                                    >
                                        <Text style={[
                                            styles.quantityButtonText,
                                            item.quantity >= item.stock_count && styles.quantityButtonDisabled
                                        ]}>+</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            <View style={styles.itemActions}>
                                <Text style={styles.itemTotal}>
                                    €{(item.price * item.quantity).toFixed(2)}
                                </Text>
                                <TouchableOpacity
                                    onPress={() => handleRemoveItem(item.id, item.name)}
                                    style={styles.removeButton}
                                >
                                    <Text style={styles.removeButtonText}>✕</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    ))}
                </ScrollView>

                <View style={styles.footer}>
                    <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>Total</Text>
                        <Text style={styles.totalAmount}>€{getTotal().toFixed(2)}</Text>
                    </View>
                    <Button
                        title="Proceed to Checkout"
                        onPress={handleCheckout}
                        fullWidth
                    />
                </View>
            </SafeAreaView>
        </ScreenBackground>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
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
    clearButton: { fontSize: 14, color: colors.textMuted },
    content: { flex: 1 },
    scrollContent: { padding: spacing.lg, paddingBottom: 100 },
    cartItem: {
        flexDirection: 'row',
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: spacing.md,
        marginBottom: spacing.md,
        borderWidth: 1,
        borderColor: colors.border,
    },
    itemImage: {
        width: 80,
        height: 80,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    itemEmoji: { fontSize: 32 },
    itemDetails: {
        flex: 1,
        marginLeft: spacing.md,
        justifyContent: 'center',
    },
    itemName: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.text,
        marginBottom: 4,
    },
    itemPrice: {
        fontSize: 14,
        color: colors.primary,
        fontWeight: '500',
        marginBottom: spacing.sm,
    },
    quantityRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    quantityButton: {
        width: 28,
        height: 28,
        borderRadius: 6,
        backgroundColor: colors.background,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: colors.border,
    },
    quantityButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.text,
    },
    quantityButtonDisabled: {
        color: colors.textMuted,
    },
    quantityText: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.text,
        minWidth: 30,
        textAlign: 'center',
    },
    itemActions: {
        alignItems: 'flex-end',
        justifyContent: 'space-between',
    },
    itemTotal: {
        fontSize: 16,
        fontWeight: '700',
        color: colors.text,
    },
    removeButton: {
        padding: spacing.xs,
    },
    removeButtonText: {
        fontSize: 16,
        color: colors.textMuted,
    },
    footer: {
        padding: spacing.lg,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        backgroundColor: colors.surface,
    },
    totalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    totalLabel: {
        fontSize: 16,
        color: colors.textSecondary,
    },
    totalAmount: {
        fontSize: 24,
        fontWeight: '700',
        color: colors.text,
    },
    emptyState: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.xl,
    },
    emptyIcon: { fontSize: 64, marginBottom: spacing.lg, opacity: 0.5 },
    emptyTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: colors.text,
        marginBottom: spacing.sm,
    },
    emptySubtitle: {
        fontSize: 14,
        color: colors.textSecondary,
        textAlign: 'center',
    },
});

export default CartScreen;
