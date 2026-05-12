import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    TextInput,
    Modal,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useConfirmPayment, CardField } from '../../utils/stripe';
import { useCart } from '../../contexts/CartContext';
import { useAuth } from '../../contexts/AuthContext';
import { useModal } from '../../contexts/ModalContext';
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
import {
    EUROPEAN_COUNTRIES_SORTED,
    getShippingCost,
    getCountryName,
} from '../../utils/shippingUtils';

export function CheckoutScreen() {
    const navigation = useNavigation<any>();
    const { items, getTotal, clearCart } = useCart();
    const { user, profile } = useAuth();
    const { confirmPayment } = useConfirmPayment();
    const { showAlert, showConfirm } = useModal();

    const [loading, setLoading] = useState(false);
    const [notes, setNotes] = useState('');

    // Payment state
    const [savedCards, setSavedCards] = useState<PaymentMethod[]>([]);
    const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
    const [showNewCard, setShowNewCard] = useState(false);
    const [newCardComplete, setNewCardComplete] = useState(false);
    const [loadingCards, setLoadingCards] = useState(true);

    // Shipping address state
    const [shippingName, setShippingName] = useState(profile?.full_name || '');
    const [shippingPhone, setShippingPhone] = useState('');
    const [shippingAddress, setShippingAddress] = useState('');
    const [shippingCity, setShippingCity] = useState('');
    const [shippingPostalCode, setShippingPostalCode] = useState('');
    const [shippingCountry, setShippingCountry] = useState('GB');
    const [showCountryPicker, setShowCountryPicker] = useState(false);
    const [countrySearch, setCountrySearch] = useState('');

    // Calculated values
    const subtotal = getTotal();
    const shippingCost = getShippingCost(shippingCountry);
    const finalTotal = subtotal + shippingCost;

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

    const validateShippingAddress = (): boolean => {
        if (!shippingName.trim()) {
            showAlert('Missing Info', 'Please enter the recipient\'s full name.', 'error');
            return false;
        }
        if (!shippingPhone.trim()) {
            showAlert('Missing Info', 'Please enter a phone number for delivery updates.', 'error');
            return false;
        }
        if (!shippingAddress.trim()) {
            showAlert('Missing Info', 'Please enter the street address.', 'error');
            return false;
        }
        if (!shippingCity.trim()) {
            showAlert('Missing Info', 'Please enter the city.', 'error');
            return false;
        }
        if (!shippingPostalCode.trim()) {
            showAlert('Missing Info', 'Please enter the postal code.', 'error');
            return false;
        }
        return true;
    };

    const sendOwnerNotification = async (orderId: string, orderTotal: number) => {
        try {
            await supabase.functions.invoke('send-order-notification', {
                body: {
                    order_id: orderId,
                    customer_name: shippingName || profile?.full_name || 'Customer',
                    order_total: orderTotal,
                },
            });
        } catch (error) {
            // Non-critical — don't fail the order if notification fails
            console.error('Failed to send owner notification:', error);
        }
    };

    const handlePlaceOrder = async () => {
        if (!user) {
            showAlert('Error', 'Please log in to place an order', 'error');
            return;
        }

        if (items.length === 0) {
            showAlert('Error', 'Your cart is empty', 'error');
            return;
        }

        // Validate shipping address
        if (!validateShippingAddress()) return;

        // Validate payment method
        if (!showNewCard && !selectedCardId) {
            showAlert('Payment Required', 'Please select a payment method to continue.', 'error');
            return;
        }

        if (showNewCard && !newCardComplete) {
            showAlert('Card Required', 'Please enter your card details to continue.', 'error');
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

            // 2. Process payment — use FINAL TOTAL (subtotal + shipping)
            const totalInCents = eurosToCents(finalTotal);

            // SIMULATION MODE: Bypass real Stripe payment for testing
            // Set to true to simulate payments without real charges
            const USE_SIMULATION = false;
            let paymentIntentId = '';

            if (USE_SIMULATION) {
                console.log('Using simulated payment flow');
                await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate network delay
                paymentIntentId = 'pi_simulated_' + Math.random().toString(36).substr(2, 9);
            } else {
                const result = await createPaymentIntent({
                    amount: totalInCents,
                    customerId: profile?.stripe_customer_id || undefined,
                    description: `Shop Order: ${items.length} item(s) + shipping to ${getCountryName(shippingCountry)}`,
                    captureMethod: 'automatic', // Immediate charge for shop orders
                });
                paymentIntentId = result.paymentIntentId;

                // Confirm the payment
                let paymentResult;
                if (showNewCard) {
                    paymentResult = await confirmPayment(result.clientSecret, {
                        paymentMethodType: 'Card',
                    });
                } else {
                    paymentResult = await confirmPayment(result.clientSecret, {
                        paymentMethodType: 'Card',
                        paymentMethodData: {
                            paymentMethodId: selectedCardId!,
                        },
                    });
                }

                if (paymentResult.error) {
                    throw new Error(paymentResult.error.message);
                }
            }

            const { data: finalizedOrder, error: finalizeError } = await supabase.functions.invoke('finalize-shop-order', {
                body: {
                    items: items.map(item => ({
                        product_id: item.id,
                        quantity: item.quantity,
                    })),
                    payment_intent_id: paymentIntentId,
                    currency: 'eur',
                    shipping: {
                        name: shippingName.trim(),
                        phone: shippingPhone.trim(),
                        address: shippingAddress.trim(),
                        city: shippingCity.trim(),
                        postal_code: shippingPostalCode.trim(),
                        country: shippingCountry,
                        notes: notes || null,
                    },
                },
            });

            if (finalizeError) throw finalizeError;
            const orderId = finalizedOrder?.order_id as string | undefined;
            const alreadyFinalized = finalizedOrder?.already_finalized === true;
            if (!orderId) throw new Error('Order finalization failed.');

            if (!alreadyFinalized) {
                await sendOwnerNotification(orderId, finalTotal);
            }

            clearCart();

            showAlert(
                '🎉 Order Placed!',
                `Your order #${orderId.slice(0, 8).toUpperCase()} has been confirmed.\n\nSubtotal: €${subtotal.toFixed(2)}\nShipping: €${shippingCost.toFixed(2)}\nTotal: €${finalTotal.toFixed(2)}\n\nShipping to: ${shippingCity}, ${getCountryName(shippingCountry)}`,
                'success'
            );
            navigation.navigate('Home');

        } catch (error: any) {
            showAlert('Order Failed', error.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const filteredCountries = countrySearch.trim()
        ? EUROPEAN_COUNTRIES_SORTED.filter(c =>
            c.name.toLowerCase().includes(countrySearch.toLowerCase())
        )
        : EUROPEAN_COUNTRIES_SORTED;

    return (
        <ScreenBackground>
            <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()}>
                        <Text style={styles.backButton}>←</Text>
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Checkout</Text>
                    <View style={{ width: 40 }} />
                </View>

                <KeyboardAvoidingView
                    style={{ flex: 1 }}
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
                >
                    <ScrollView
                        style={styles.content}
                        contentContainerStyle={styles.scrollContent}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
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
                                    <Text style={styles.summarySubtotalLabel}>Subtotal</Text>
                                    <Text style={styles.summarySubtotalPrice}>€{subtotal.toFixed(2)}</Text>
                                </View>
                                <View style={styles.summaryItem}>
                                    <Text style={styles.summaryShippingLabel}>
                                        Shipping ({getCountryName(shippingCountry)})
                                    </Text>
                                    <Text style={styles.summaryShippingPrice}>€{shippingCost.toFixed(2)}</Text>
                                </View>
                                <View style={styles.divider} />
                                <View style={styles.summaryItem}>
                                    <Text style={styles.summaryTotal}>Total</Text>
                                    <Text style={styles.summaryTotalPrice}>€{finalTotal.toFixed(2)}</Text>
                                </View>
                            </View>
                        </View>

                        {/* Shipping Address */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>📦 Shipping Address</Text>
                            <View style={styles.formCard}>
                                {/* Full Name */}
                                <Text style={styles.fieldLabel}>Full Name *</Text>
                                <TextInput
                                    style={styles.fieldInput}
                                    placeholder="John Doe"
                                    placeholderTextColor={colors.textMuted}
                                    value={shippingName}
                                    onChangeText={setShippingName}
                                    autoCapitalize="words"
                                />

                                {/* Phone Number */}
                                <Text style={styles.fieldLabel}>Phone Number *</Text>
                                <TextInput
                                    style={styles.fieldInput}
                                    placeholder="+44 7700 900000"
                                    placeholderTextColor={colors.textMuted}
                                    value={shippingPhone}
                                    onChangeText={setShippingPhone}
                                    keyboardType="phone-pad"
                                />

                                {/* Street Address */}
                                <Text style={styles.fieldLabel}>Street Address *</Text>
                                <TextInput
                                    style={styles.fieldInput}
                                    placeholder="123 High Street, Apt 4B"
                                    placeholderTextColor={colors.textMuted}
                                    value={shippingAddress}
                                    onChangeText={setShippingAddress}
                                />

                                {/* City & Postal Code — side by side */}
                                <View style={styles.fieldRow}>
                                    <View style={styles.fieldHalf}>
                                        <Text style={styles.fieldLabel}>City *</Text>
                                        <TextInput
                                            style={styles.fieldInput}
                                            placeholder="London"
                                            placeholderTextColor={colors.textMuted}
                                            value={shippingCity}
                                            onChangeText={setShippingCity}
                                        />
                                    </View>
                                    <View style={styles.fieldHalf}>
                                        <Text style={styles.fieldLabel}>Postal Code *</Text>
                                        <TextInput
                                            style={styles.fieldInput}
                                            placeholder="SW1A 1AA"
                                            placeholderTextColor={colors.textMuted}
                                            value={shippingPostalCode}
                                            onChangeText={setShippingPostalCode}
                                            autoCapitalize="characters"
                                        />
                                    </View>
                                </View>

                                {/* Country Picker */}
                                <Text style={styles.fieldLabel}>Country *</Text>
                                <TouchableOpacity
                                    style={styles.countrySelector}
                                    onPress={() => setShowCountryPicker(true)}
                                >
                                    <View style={styles.countrySelectorLeft}>
                                        <Text style={styles.countrySelectorText}>
                                            {getCountryName(shippingCountry)}
                                        </Text>
                                        <Text style={styles.countrySelectorCost}>
                                            Shipping: €{shippingCost.toFixed(2)}
                                        </Text>
                                    </View>
                                    <Text style={styles.countrySelectorArrow}>›</Text>
                                </TouchableOpacity>
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
                                                onCardChange={(cardDetails: any) => {
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
                </KeyboardAvoidingView>

                <View style={styles.footer}>
                    <View style={styles.footerSummary}>
                        <View style={styles.footerRow}>
                            <Text style={styles.footerLabel}>Subtotal</Text>
                            <Text style={styles.footerValue}>€{subtotal.toFixed(2)}</Text>
                        </View>
                        <View style={styles.footerRow}>
                            <Text style={styles.footerLabel}>Shipping</Text>
                            <Text style={styles.footerValue}>€{shippingCost.toFixed(2)}</Text>
                        </View>
                    </View>
                    <Button
                        title={loading ? 'Processing...' : `Pay €${finalTotal.toFixed(2)}`}
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

                {/* Country Picker Modal */}
                <Modal
                    visible={showCountryPicker}
                    transparent
                    animationType="slide"
                    onRequestClose={() => setShowCountryPicker(false)}
                >
                    <TouchableOpacity
                        style={styles.modalOverlay}
                        activeOpacity={1}
                        onPress={() => setShowCountryPicker(false)}
                    >
                        <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>Select Country</Text>
                                <TouchableOpacity onPress={() => setShowCountryPicker(false)}>
                                    <Text style={styles.modalClose}>✕</Text>
                                </TouchableOpacity>
                            </View>
                            {/* Search bar */}
                            <View style={styles.searchContainer}>
                                <TextInput
                                    style={styles.searchInput}
                                    placeholder="Search countries..."
                                    placeholderTextColor={colors.textMuted}
                                    value={countrySearch}
                                    onChangeText={setCountrySearch}
                                    autoCapitalize="none"
                                />
                            </View>
                            <ScrollView style={styles.countryList} keyboardShouldPersistTaps="handled">
                                {filteredCountries.map((country) => (
                                    <TouchableOpacity
                                        key={country.code}
                                        style={[
                                            styles.countryOption,
                                            shippingCountry === country.code && styles.countryOptionSelected
                                        ]}
                                        onPress={() => {
                                            setShippingCountry(country.code);
                                            setShowCountryPicker(false);
                                            setCountrySearch('');
                                        }}
                                    >
                                        <View style={styles.countryOptionLeft}>
                                            <Text style={[
                                                styles.countryOptionText,
                                                shippingCountry === country.code && styles.countryOptionTextSelected
                                            ]}>
                                                {country.name}
                                            </Text>
                                            <Text style={styles.countryOptionCost}>
                                                €{country.shippingCost.toFixed(2)}
                                            </Text>
                                        </View>
                                        {shippingCountry === country.code && (
                                            <Text style={styles.checkmark}>✓</Text>
                                        )}
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>
                    </TouchableOpacity>
                </Modal>
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
    // Order Summary
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
    summarySubtotalLabel: {
        fontSize: 14,
        color: colors.textSecondary,
    },
    summarySubtotalPrice: {
        fontSize: 14,
        color: colors.textSecondary,
        fontWeight: '500',
    },
    summaryShippingLabel: {
        fontSize: 14,
        color: colors.textSecondary,
    },
    summaryShippingPrice: {
        fontSize: 14,
        color: colors.textSecondary,
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
    // Shipping Form
    formCard: {
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: spacing.lg,
        borderWidth: 1,
        borderColor: colors.border,
    },
    fieldLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: colors.textSecondary,
        marginBottom: 6,
        textTransform: 'uppercase',
        letterSpacing: 0.3,
    },
    fieldInput: {
        backgroundColor: 'rgba(0, 0, 0, 0.04)',
        borderRadius: 12,
        padding: spacing.md,
        color: colors.text,
        fontSize: 16,
        borderWidth: 1,
        borderColor: colors.border,
        marginBottom: spacing.md,
    },
    fieldRow: {
        flexDirection: 'row',
        gap: spacing.sm,
    },
    fieldHalf: {
        flex: 1,
    },
    countrySelector: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'rgba(0, 0, 0, 0.04)',
        borderRadius: 12,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: colors.border,
    },
    countrySelectorLeft: {
        flex: 1,
    },
    countrySelectorText: {
        fontSize: 16,
        color: colors.text,
    },
    countrySelectorCost: {
        fontSize: 12,
        color: colors.primary,
        marginTop: 2,
    },
    countrySelectorArrow: {
        fontSize: 20,
        color: colors.textMuted,
    },
    // Payment
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
        backgroundColor: 'rgba(200, 160, 77, 0.1)',
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
    // Footer
    footer: {
        padding: spacing.lg,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        backgroundColor: colors.surface,
    },
    footerSummary: {
        marginBottom: spacing.md,
    },
    footerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    footerLabel: {
        fontSize: 13,
        color: colors.textSecondary,
    },
    footerValue: {
        fontSize: 13,
        color: colors.textSecondary,
        fontWeight: '500',
    },
    // Loading
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
    // Country Picker Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: colors.surface,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: '70%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: colors.text,
    },
    modalClose: {
        fontSize: 20,
        color: colors.textMuted,
        padding: spacing.sm,
    },
    searchContainer: {
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
    },
    searchInput: {
        backgroundColor: 'rgba(0, 0, 0, 0.04)',
        borderRadius: 12,
        padding: spacing.md,
        color: colors.text,
        fontSize: 15,
        borderWidth: 1,
        borderColor: colors.border,
    },
    countryList: {
        padding: spacing.md,
    },
    countryOption: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.md,
        borderRadius: 8,
        marginBottom: spacing.xs,
    },
    countryOptionSelected: {
        backgroundColor: 'rgba(200, 160, 77, 0.2)',
    },
    countryOptionLeft: {
        flex: 1,
    },
    countryOptionText: {
        fontSize: 16,
        color: colors.text,
    },
    countryOptionTextSelected: {
        color: colors.primary,
        fontWeight: '500',
    },
    countryOptionCost: {
        fontSize: 12,
        color: colors.textMuted,
        marginTop: 2,
    },
    checkmark: {
        fontSize: 18,
        color: colors.primary,
        fontWeight: '600',
    },
});

export default CheckoutScreen;
