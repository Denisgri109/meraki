import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { useCart } from '../../contexts/CartContext';
import { useModal } from '../../contexts/ModalContext';
import { Button, ScreenBackground, MerakiText } from '../../components/ui';
import { colors, spacing } from '../../theme';

export function CartScreen() {
    const navigation = useNavigation<any>();
    const { items, removeFromCart, updateQuantity, getTotal, clearCart } = useCart();
    const { showAlert, showConfirm } = useModal();

    const handleCheckout = () => {
        if (items.length === 0) {
            showAlert('Empty Cart', 'Add some products to your cart first!', 'info');
            return;
        }
        navigation.navigate('Checkout');
    };

    const handleRemoveItem = (productId: string, productName: string) => {
        showConfirm(
            'Remove Item',
            `Remove ${productName} from cart?`,
            () => removeFromCart(productId)
        );
    };

    if (items.length === 0) {
        return (
            <ScreenBackground>
                <SafeAreaView style={styles.container}>
                    {/* Header */}
                    <View style={styles.header}>
                        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                            <MaterialIcons name="arrow-back" size={22} color="#1A1A1A" />
                        </TouchableOpacity>
                        <MerakiText style={styles.headerTitle}>BAG</MerakiText>
                        <View style={{ width: 40 }} />
                    </View>

                    <View style={styles.emptyState}>
                        <MaterialIcons name="shopping-bag" size={56} color="rgba(0,0,0,0.08)" />
                        <MerakiText style={styles.emptyTitle}>Your bag is empty</MerakiText>
                        <MerakiText style={styles.emptySubtitle}>
                            Looks like you haven't added anything yet
                        </MerakiText>
                        <TouchableOpacity
                            style={styles.shopNowBtn}
                            onPress={() => navigation.navigate('ShopMain')}
                        >
                            <MerakiText style={styles.shopNowText}>Shop Now</MerakiText>
                        </TouchableOpacity>
                    </View>
                </SafeAreaView>
            </ScreenBackground>
        );
    }

    return (
        <ScreenBackground>
            <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <MaterialIcons name="arrow-back" size={22} color="#1A1A1A" />
                    </TouchableOpacity>
                    <MerakiText style={styles.headerTitle}>BAG</MerakiText>
                    <TouchableOpacity onPress={() => clearCart()}>
                        <MerakiText style={styles.clearBtn}>Clear</MerakiText>
                    </TouchableOpacity>
                </View>

                <ScrollView
                    style={styles.content}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    {items.map((item, index) => (
                        <View
                            key={item.id}
                            style={[
                                styles.cartItem,
                                index < items.length - 1 && styles.cartItemBorder,
                            ]}
                        >
                            {/* Product Image */}
                            <View style={styles.itemImageContainer}>
                                {item.image_url ? (
                                    <Image
                                        source={{ uri: item.image_url }}
                                        style={styles.itemImage}
                                        resizeMode="contain"
                                    />
                                ) : (
                                    <View style={[styles.itemImage, styles.itemImagePlaceholder]}>
                                        <MaterialIcons name="shopping-bag" size={24} color="rgba(0,0,0,0.12)" />
                                    </View>
                                )}
                            </View>

                            {/* Product Details */}
                            <View style={styles.itemDetails}>
                                <MerakiText style={styles.brandLabel}>MERAKÍ</MerakiText>
                                <MerakiText style={styles.itemName} numberOfLines={2}>
                                    {item.name}
                                </MerakiText>

                                {/* Quantity Controls */}
                                <View style={styles.quantityRow}>
                                    <TouchableOpacity
                                        style={styles.qtyBtn}
                                        onPress={() => handleRemoveItem(item.id, item.name)}
                                    >
                                        <MaterialIcons name="delete-outline" size={16} color="rgba(0,0,0,0.4)" />
                                    </TouchableOpacity>
                                    <View style={styles.qtyControl}>
                                        <TouchableOpacity
                                            onPress={() => updateQuantity(item.id, item.quantity - 1)}
                                            style={styles.qtyAdjust}
                                        >
                                            <MerakiText style={styles.qtyAdjustText}>−</MerakiText>
                                        </TouchableOpacity>
                                        <MerakiText style={styles.qtyText}>Qty {item.quantity}</MerakiText>
                                        <TouchableOpacity
                                            onPress={() => updateQuantity(item.id, item.quantity + 1)}
                                            style={styles.qtyAdjust}
                                            disabled={item.quantity >= item.stock_count}
                                        >
                                            <MerakiText style={[
                                                styles.qtyAdjustText,
                                                item.quantity >= item.stock_count && { color: 'rgba(0,0,0,0.15)' },
                                            ]}>+</MerakiText>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </View>

                            {/* Price */}
                            <View style={styles.priceCol}>
                                {item.quantity > 1 && (
                                    <MerakiText style={styles.unitPrice}>
                                        €{item.price.toFixed(2)} each
                                    </MerakiText>
                                )}
                                <MerakiText style={styles.itemTotal}>
                                    €{(item.price * item.quantity).toFixed(2)}
                                </MerakiText>
                            </View>
                        </View>
                    ))}
                </ScrollView>

                {/* Footer */}
                <View style={styles.footer}>
                    <View style={styles.summaryRow}>
                        <MerakiText style={styles.summaryLabel}>
                            Subtotal ({items.reduce((acc, i) => acc + i.quantity, 0)} items)
                        </MerakiText>
                        <MerakiText style={styles.summaryValue}>€{getTotal().toFixed(2)}</MerakiText>
                    </View>
                    <View style={styles.summaryRow}>
                        <MerakiText style={styles.summaryLabel}>Delivery</MerakiText>
                        <MerakiText style={[styles.summaryLabel, { color: 'rgba(0,0,0,0.6)', fontStyle: 'italic' }]}>Calculated at checkout</MerakiText>
                    </View>
                    <View style={[styles.summaryRow, styles.totalRow]}>
                        <MerakiText style={styles.totalLabel}>Total</MerakiText>
                        <MerakiText style={styles.totalAmount}>€{getTotal().toFixed(2)}</MerakiText>
                    </View>
                    <TouchableOpacity style={styles.checkoutBtn} onPress={handleCheckout}>
                        <MerakiText style={styles.checkoutText}>Checkout</MerakiText>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        </ScreenBackground>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },

    // Header
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    backBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: '800',
        color: '#1A1A1A',
        fontStyle: 'italic',
        letterSpacing: -0.5,
    },
    clearBtn: {
        fontSize: 13,
        color: 'rgba(0,0,0,0.4)',
        fontWeight: '500',
    },

    // Content
    content: { flex: 1 },
    scrollContent: { paddingHorizontal: spacing.lg, paddingBottom: 20 },

    // Cart Item — Beauty Bay BAG Style
    cartItem: {
        flexDirection: 'row',
        paddingVertical: 20,
    },
    cartItemBorder: {
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    itemImageContainer: {
        width: 90,
        height: 100,
        marginRight: 16,
    },
    itemImage: {
        width: '100%',
        height: '100%',
        borderRadius: 4,
        backgroundColor: '#F8F8F8',
    },
    itemImagePlaceholder: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    itemDetails: {
        flex: 1,
        justifyContent: 'flex-start',
    },
    brandLabel: {
        fontSize: 10,
        fontWeight: '700',
        color: 'rgba(0,0,0,0.4)',
        letterSpacing: 1.5,
        marginBottom: 2,
    },
    itemName: {
        fontSize: 14,
        fontWeight: '500',
        color: '#1A1A1A',
        lineHeight: 20,
        marginBottom: 12,
    },
    quantityRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    qtyBtn: {
        width: 32,
        height: 32,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        alignItems: 'center',
        justifyContent: 'center',
    },
    qtyControl: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 4,
        overflow: 'hidden',
    },
    qtyAdjust: {
        width: 32,
        height: 32,
        alignItems: 'center',
        justifyContent: 'center',
    },
    qtyAdjustText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1A1A1A',
    },
    qtyText: {
        fontSize: 12,
        fontWeight: '500',
        color: '#1A1A1A',
        paddingHorizontal: 8,
    },

    // Price Column
    priceCol: {
        alignItems: 'flex-end',
        justifyContent: 'flex-start',
        marginLeft: 8,
    },
    unitPrice: {
        fontSize: 10,
        color: 'rgba(0,0,0,0.3)',
        marginBottom: 2,
    },
    itemTotal: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1A1A1A',
    },

    // Footer
    footer: {
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.md,
        paddingBottom: spacing.xl,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
        backgroundColor: '#FFFFFF',
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 6,
    },
    summaryLabel: {
        fontSize: 13,
        color: 'rgba(0,0,0,0.45)',
        fontWeight: '400',
    },
    summaryValue: {
        fontSize: 13,
        color: '#1A1A1A',
        fontWeight: '500',
    },
    totalRow: {
        borderTopWidth: 1,
        borderTopColor: '#F0F0F0',
        paddingTop: 12,
        marginTop: 8,
        marginBottom: 16,
    },
    totalLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1A1A1A',
    },
    totalAmount: {
        fontSize: 18,
        fontWeight: '800',
        color: '#1A1A1A',
    },
    checkoutBtn: {
        backgroundColor: '#1A1A1A',
        height: 52,
        borderRadius: 6,
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkoutText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#FFFFFF',
        letterSpacing: 0.5,
    },

    // Empty State
    emptyState: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.xl,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#1A1A1A',
        marginTop: 16,
        marginBottom: 6,
    },
    emptySubtitle: {
        fontSize: 14,
        color: 'rgba(0,0,0,0.4)',
        textAlign: 'center',
        marginBottom: 24,
    },
    shopNowBtn: {
        backgroundColor: '#1A1A1A',
        paddingHorizontal: 32,
        paddingVertical: 14,
        borderRadius: 6,
    },
    shopNowText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#FFFFFF',
        letterSpacing: 0.5,
    },
});

export default CartScreen;
