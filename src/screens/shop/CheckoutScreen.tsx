import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useConfirmPayment, CardField } from '../../utils/stripe';
import { useCart } from '../../contexts/CartContext';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Button, ScreenBackground } from '../../components/ui';
import { colors, spacing } from '../../theme';
import {
    createPaymentIntent,
    listPaymentMethods,
    eurosToCents,
    formatCardBrand,
    PaymentMethod,
} from '../../services/stripeService';

export function CheckoutScreen() {
    const navigation = useNavigation<any>();
    const { items, getTotal, clearCart } = useCart();
    const { user, profile } = useAuth();
    const { confirmPayment } = useConfirmPayment();

    const [loading, setLoading] = useState(false);
    const [notes, setNotes] = useState('');

    // Payment state
    const [savedCards, setSavedCards] = useState<PaymentMethod[]>([]);
    const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
    const [showNewCard, setShowNewCard] = useState(false);
    const [newCardComplete, setNewCardComplete] = useState(false);
    const [loadingCards, setLoadingCards] = useState(true);

    useEffect(() => {
        fetchPaymentMethods();
    }, []);

    const fetchPaymentMethods = async () => {
        if (!profile?.stripe_customer_id) {
            setShowNewCard(true);
            setLoadingCards(false);
            return;
        }

        try {
            const cards = await listPaymentMethods(profile.stripe_customer_id);
            setSavedCards(cards);

            // Get default card from database
            const { data: dbMethods } = await (supabase as any)
                .from('payment_methods')
                .select('stripe_payment_method_id, is_default')
                .eq('user_id', user?.id)
                .eq('is_default', true);

            if (dbMethods?.[0]) {
                setSelectedCardId(dbMethods[0].stripe_payment_method_id);
            } else if (cards.length > 0) {
                setSelectedCardId(cards[0].id);
            } else {
                setShowNewCard(true);
            }
        } catch (error) {
            console.error('Error fetching cards:', error);
            setShowNewCard(true);
        } finally {
            setLoadingCards(false);
        }
    };

    const handlePlaceOrder = async () => {
        if (!user) {
            Alert.alert('Error', 'Please log in to place an order');
            return;
        }

        if (items.length === 0) {
            Alert.alert('Error', 'Your cart is empty');
            return;
        }

        // Validate payment method
        if (!showNewCard && !selectedCardId) {
            Alert.alert('Payment Required', 'Please select a payment method to continue.');
            return;
        }

        if (showNewCard && !newCardComplete) {
            Alert.alert('Card Required', 'Please enter your card details to continue.');
            return;
        }

        setLoading(true);

        try {
            // 1. Check stock availability for all items
            for (const item of items) {
                const { data: product, error } = await (supabase as any)
                    .from('products')
                    .select('stock_count')
                    .eq('id', item.id)
                    .single();

                if (error) throw new Error(`Could not verify stock for ${item.name}`);

                if (product.stock_count < item.quantity) {
                    throw new Error(`Insufficient stock for ${item.name}. Only ${product.stock_count} available.`);
                }
            }

            // 2. Process payment
            const totalInCents = eurosToCents(getTotal());
            const { clientSecret, paymentIntentId } = await createPaymentIntent({
                amount: totalInCents,
                customerId: profile?.stripe_customer_id || undefined,
                description: `Shop Order: ${items.length} item(s)`,
                captureMethod: 'automatic', // Immediate charge for shop orders
            });

            // Confirm the payment
            let paymentResult;
            if (showNewCard) {
                paymentResult = await confirmPayment(clientSecret, {
                    paymentMethodType: 'Card',
                });
            } else {
                paymentResult = await confirmPayment(clientSecret, {
                    paymentMethodType: 'Card',
                    paymentMethodData: {
                        paymentMethodId: selectedCardId!,
                    },
                });
            }

            if (paymentResult.error) {
                throw new Error(paymentResult.error.message);
            }

            // 3. Create the order
            const { data: order, error: orderError } = await (supabase as any)
                .from('orders')
                .insert({
                    user_id: user.id,
                    total: getTotal(),
                    notes: notes || null,
                    status: 'confirmed',
                    stripe_payment_intent_id: paymentIntentId,
                })
                .select()
                .single();

            if (orderError) throw orderError;

            // 4. Record the payment
            await (supabase as any)
                .from('payments')
                .insert({
                    user_id: user.id,
                    order_id: order.id,
                    stripe_payment_intent_id: paymentIntentId,
                    amount: totalInCents,
                    currency: 'eur',
                    status: 'succeeded',
                    payment_type: 'shop',
                    description: `Shop Order #${order.id.slice(0, 8).toUpperCase()}`,
                });

            // 5. Create order items and decrement stock
            for (const item of items) {
                const { error: itemError } = await (supabase as any)
                    .from('order_items')
                    .insert({
                        order_id: order.id,
                        product_id: item.id,
                        product_name: item.name,
                        quantity: item.quantity,
                        price: item.price,
                    });

                if (itemError) throw itemError;

                // Decrement stock
                const { error: stockError } = await (supabase as any)
                    .rpc('decrement_stock', {
                        p_product_id: item.id,
                        p_quantity: item.quantity,
                    });

                if (stockError) {
                    console.error('Stock decrement error:', stockError);
                }
            }

            // 6. Clear cart and show success
            clearCart();

            Alert.alert(
                '🎉 Order Placed!',
                `Your order #${order.id.slice(0, 8).toUpperCase()} has been confirmed and payment of €${getTotal().toFixed(2)} processed.`,
                [
                    {
                        text: 'View Orders',
                        onPress: () => navigation.navigate('Menu', { screen: 'Orders' }),
                    },
                    {
                        text: 'Continue Shopping',
                        onPress: () => navigation.navigate('ShopMain'),
                    },
                ]
            );

        } catch (error: any) {
            Alert.alert('Order Failed', error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <ScreenBackground>
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()}>
                        <Text style={styles.backButton}>←</Text>
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Checkout</Text>
                    <View style={{ width: 40 }} />
                </View>

                <ScrollView
                    style={styles.content}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Order Summary */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Order Summary</Text>
                        <View style={styles.summaryCard}>
                            {items.map((item) => (
                                <View key={item.id} style={styles.summaryItem}>
                                    <Text style={styles.summaryItemName} numberOfLines={1}>
                                        {item.quantity}x {item.name}
                                    </Text>
                                    <Text style={styles.summaryItemPrice}>
                                        €{(item.price * item.quantity).toFixed(2)}
                                    </Text>
                                </View>
                            ))}
                            <View style={styles.divider} />
                            <View style={styles.summaryItem}>
                                <Text style={styles.summaryTotal}>Total</Text>
                                <Text style={styles.summaryTotalPrice}>€{getTotal().toFixed(2)}</Text>
                            </View>
                        </View>
                    </View>

                    {/* Customer Info */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Customer</Text>
                        <View style={styles.infoCard}>
                            <Text style={styles.infoLabel}>Name</Text>
                            <Text style={styles.infoValue}>{profile?.full_name || 'Guest'}</Text>
                            <Text style={styles.infoLabel}>Email</Text>
                            <Text style={styles.infoValue}>{profile?.email}</Text>
                        </View>
                    </View>

                    {/* Payment Method */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Payment Method</Text>

                        {loadingCards ? (
                            <ActivityIndicator size="small" color={colors.primary} />
                        ) : (
                            <>
                                {/* Saved Cards */}
                                {savedCards.map((card) => (
                                    <TouchableOpacity
                                        key={card.id}
                                        style={[
                                            styles.paymentOption,
                                            selectedCardId === card.id && !showNewCard && styles.paymentOptionSelected
                                        ]}
                                        onPress={() => {
                                            setSelectedCardId(card.id);
                                            setShowNewCard(false);
                                        }}
                                    >
                                        <View style={styles.paymentOptionInfo}>
                                            <Text style={styles.paymentOptionIcon}>💳</Text>
                                            <View>
                                                <Text style={styles.paymentOptionTitle}>
                                                    {formatCardBrand(card.brand)} •••• {card.last4}
                                                </Text>
                                                <Text style={styles.paymentOptionSubtitle}>
                                                    Expires {card.expMonth}/{card.expYear}
                                                </Text>
                                            </View>
                                        </View>
                                        <View style={[
                                            styles.radioOuter,
                                            selectedCardId === card.id && !showNewCard && styles.radioOuterSelected
                                        ]}>
                                            {selectedCardId === card.id && !showNewCard && (
                                                <View style={styles.radioInner} />
                                            )}
                                        </View>
                                    </TouchableOpacity>
                                ))}

                                {/* Add New Card Option */}
                                <TouchableOpacity
                                    style={[
                                        styles.paymentOption,
                                        showNewCard && styles.paymentOptionSelected
                                    ]}
                                    onPress={() => setShowNewCard(true)}
                                >
                                    <View style={styles.paymentOptionInfo}>
                                        <Text style={styles.paymentOptionIcon}>➕</Text>
                                        <Text style={styles.paymentOptionTitle}>Use a new card</Text>
                                    </View>
                                    <View style={[styles.radioOuter, showNewCard && styles.radioOuterSelected]}>
                                        {showNewCard && <View style={styles.radioInner} />}
                                    </View>
                                </TouchableOpacity>

                                {/* New Card Input */}
                                {showNewCard && (
                                    <View style={styles.newCardContainer}>
                                        <CardField
                                            postalCodeEnabled={false}
                                            placeholders={{
                                                number: '4242 4242 4242 4242',
                                            }}
                                            cardStyle={{
                                                backgroundColor: colors.surface,
                                                textColor: colors.text,
                                                placeholderColor: colors.textMuted,
                                                borderWidth: 1,
                                                borderColor: colors.border,
                                                borderRadius: 12,
                                            }}
                                            style={styles.cardField}
                                            onCardChange={(cardDetails) => {
                                                setNewCardComplete(cardDetails.complete);
                                            }}
                                        />
                                    </View>
                                )}
                            </>
                        )}
                    </View>

                    {/* Notes */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Order Notes (Optional)</Text>
                        <TextInput
                            style={styles.notesInput}
                            placeholder="Any special instructions..."
                            placeholderTextColor={colors.textMuted}
                            value={notes}
                            onChangeText={setNotes}
                            multiline
                            numberOfLines={3}
                        />
                    </View>

                    {/* Security Note */}
                    <View style={styles.securityNote}>
                        <Text style={styles.securityIcon}>🔒</Text>
                        <Text style={styles.securityText}>
                            Your payment is processed securely by Stripe
                        </Text>
                    </View>
                </ScrollView>

                <View style={styles.footer}>
                    <Button
                        title={loading ? 'Processing...' : `Pay €${getTotal().toFixed(2)}`}
                        onPress={handlePlaceOrder}
                        fullWidth
                        disabled={loading || items.length === 0}
                        loading={loading}
                    />
                </View>

                {loading && (
                    <View style={styles.loadingOverlay}>
                        <ActivityIndicator size="large" color={colors.primary} />
                        <Text style={styles.loadingText}>Processing your order...</Text>
                    </View>
                )}
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
    content: { flex: 1 },
    scrollContent: { padding: spacing.lg, paddingBottom: 100 },
    section: { marginBottom: spacing.xl },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.textSecondary,
        marginBottom: spacing.md,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    summaryCard: {
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: spacing.lg,
        borderWidth: 1,
        borderColor: colors.border,
    },
    summaryItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
    summaryItemName: {
        flex: 1,
        fontSize: 14,
        color: colors.text,
        marginRight: spacing.md,
    },
    summaryItemPrice: {
        fontSize: 14,
        color: colors.text,
        fontWeight: '500',
    },
    divider: {
        height: 1,
        backgroundColor: colors.border,
        marginVertical: spacing.md,
    },
    summaryTotal: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.text,
    },
    summaryTotalPrice: {
        fontSize: 20,
        fontWeight: '700',
        color: colors.primary,
    },
    infoCard: {
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: spacing.lg,
        borderWidth: 1,
        borderColor: colors.border,
    },
    infoLabel: {
        fontSize: 12,
        color: colors.textMuted,
        marginBottom: 4,
    },
    infoValue: {
        fontSize: 16,
        color: colors.text,
        marginBottom: spacing.md,
    },
    paymentOption: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: spacing.md,
        marginBottom: spacing.sm,
        borderWidth: 1,
        borderColor: colors.border,
    },
    paymentOptionSelected: {
        borderColor: colors.primary,
        backgroundColor: 'rgba(139, 92, 246, 0.1)',
    },
    paymentOptionInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    paymentOptionIcon: {
        fontSize: 20,
        marginRight: spacing.md,
    },
    paymentOptionTitle: {
        fontSize: 14,
        fontWeight: '500',
        color: colors.text,
    },
    paymentOptionSubtitle: {
        fontSize: 12,
        color: colors.textSecondary,
        marginTop: 2,
    },
    radioOuter: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: colors.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    radioOuterSelected: {
        borderColor: colors.primary,
    },
    radioInner: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: colors.primary,
    },
    newCardContainer: {
        marginTop: spacing.sm,
    },
    cardField: {
        width: '100%',
        height: 50,
    },
    notesInput: {
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: spacing.md,
        color: colors.text,
        fontSize: 16,
        borderWidth: 1,
        borderColor: colors.border,
        minHeight: 80,
        textAlignVertical: 'top',
    },
    securityNote: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(139,92,246,0.1)',
        borderRadius: 12,
        padding: spacing.md,
        gap: spacing.sm,
    },
    securityIcon: { fontSize: 16 },
    securityText: {
        flex: 1,
        fontSize: 13,
        color: colors.textSecondary,
    },
    footer: {
        padding: spacing.lg,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        backgroundColor: colors.surface,
    },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.7)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingText: {
        color: colors.text,
        marginTop: spacing.md,
        fontSize: 16,
    },
});

export default CheckoutScreen;
