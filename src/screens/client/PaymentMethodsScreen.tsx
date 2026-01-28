import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { CardField, useConfirmSetupIntent } from '../../utils/stripe';
import { Modal } from 'react-native';
import { Card, Button, ScreenBackground } from '../../components/ui';
import { colors, spacing } from '../../theme';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import {
    createSetupIntent,
    listPaymentMethods,
    deletePaymentMethod,
    formatCardBrand,
    PaymentMethod,
} from '../../services/stripeService';

const CARD_ICONS: Record<string, string> = {
    visa: '💳',
    mastercard: '💳',
    amex: '💳',
    discover: '💳',
    default: '💳',
};

export function PaymentMethodsScreen() {
    const navigation = useNavigation();
    const { user, profile } = useAuth();
    const { confirmSetupIntent } = useConfirmSetupIntent();

    const [cards, setCards] = useState<PaymentMethod[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);
    const [addingCard, setAddingCard] = useState(false);
    const [cardComplete, setCardComplete] = useState(false);
    const [defaultCardId, setDefaultCardId] = useState<string | null>(null);

    const fetchPaymentMethods = useCallback(async () => {
        if (!profile?.stripe_customer_id) {
            setCards([]);
            setLoading(false);
            setRefreshing(false);
            return;
        }

        try {
            const methods = await listPaymentMethods(profile.stripe_customer_id);

            // Fetch default from database
            const { data: dbMethods } = await (supabase as any)
                .from('payment_methods')
                .select('stripe_payment_method_id, is_default')
                .eq('user_id', user?.id);

            const defaultMethod = dbMethods?.find((m: any) => m.is_default);
            setDefaultCardId(defaultMethod?.stripe_payment_method_id || null);

            // Merge with default info
            const cardsWithDefault = methods.map((card: PaymentMethod) => ({
                ...card,
                isDefault: card.id === defaultMethod?.stripe_payment_method_id,
            }));

            setCards(cardsWithDefault);
        } catch (error) {
            console.error('Error fetching payment methods:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [profile?.stripe_customer_id, user?.id]);

    useEffect(() => {
        fetchPaymentMethods();
    }, [fetchPaymentMethods]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchPaymentMethods();
    };

    const handleAddCard = async () => {
        if (!user || !cardComplete) {
            Alert.alert('Error', 'Please enter valid card details');
            return;
        }

        setAddingCard(true);

        try {
            // Create a SetupIntent
            const { clientSecret, customerId } = await createSetupIntent(
                user.id,
                profile?.email,
                profile?.stripe_customer_id
            );

            // If this is a new customer, save the customer ID
            if (!profile?.stripe_customer_id && customerId) {
                await supabase
                    .from('profiles')
                    .update({ stripe_customer_id: customerId })
                    .eq('id', user.id);
            }

            // Confirm the SetupIntent with the card details
            const { setupIntent, error } = await confirmSetupIntent(clientSecret, {
                paymentMethodType: 'Card',
            });

            if (error) {
                throw new Error(error.message);
            }

            if (setupIntent?.paymentMethodId) {
                // Get card details from Stripe
                const methods = await listPaymentMethods(customerId || profile?.stripe_customer_id);
                const newCard = methods.find((m: PaymentMethod) => m.id === setupIntent.paymentMethodId);

                if (newCard) {
                    // Save to database
                    const isFirst = cards.length === 0;
                    await (supabase as any)
                        .from('payment_methods')
                        .insert({
                            user_id: user.id,
                            stripe_payment_method_id: newCard.id,
                            brand: newCard.brand,
                            last4: newCard.last4,
                            exp_month: newCard.expMonth,
                            exp_year: newCard.expYear,
                            is_default: isFirst,
                        });
                }

                Alert.alert('Success', 'Card added successfully');
                setShowAddModal(false);
                fetchPaymentMethods();
            }
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to add card');
        } finally {
            setAddingCard(false);
        }
    };

    const handleSetDefault = async (cardId: string) => {
        try {
            // Update all cards to not default
            await (supabase as any)
                .from('payment_methods')
                .update({ is_default: false })
                .eq('user_id', user?.id);

            // Set this card as default
            await (supabase as any)
                .from('payment_methods')
                .update({ is_default: true })
                .eq('stripe_payment_method_id', cardId);

            setDefaultCardId(cardId);
            setCards(cards.map(card => ({
                ...card,
                isDefault: card.id === cardId,
            })));

            Alert.alert('Success', 'Default payment method updated');
        } catch (error) {
            Alert.alert('Error', 'Failed to update default payment method');
        }
    };

    const handleDelete = async (cardId: string) => {
        Alert.alert(
            'Remove Card',
            'Are you sure you want to remove this payment method?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await deletePaymentMethod(cardId);

                            // Remove from database
                            await (supabase as any)
                                .from('payment_methods')
                                .delete()
                                .eq('stripe_payment_method_id', cardId);

                            setCards(cards.filter(c => c.id !== cardId));
                            Alert.alert('Success', 'Card removed');
                        } catch (error) {
                            Alert.alert('Error', 'Failed to remove card');
                        }
                    },
                },
            ]
        );
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
                    contentContainerStyle={styles.content}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} />
                    }
                >
                    {/* Header */}
                    <View style={styles.header}>
                        <TouchableOpacity onPress={() => navigation.goBack()}>
                            <Text style={styles.backButton}>← Back</Text>
                        </TouchableOpacity>
                        <Text style={styles.title}>Payment Methods</Text>
                        <Text style={styles.subtitle}>Manage your saved cards</Text>
                    </View>

                    {/* Cards List */}
                    <View style={styles.section}>
                        {cards.length > 0 ? (
                            cards.map((card) => (
                                <Card key={card.id} style={styles.cardItem}>
                                    <View style={styles.cardInfo}>
                                        <Text style={styles.cardIcon}>
                                            {CARD_ICONS[card.brand] || CARD_ICONS.default}
                                        </Text>
                                        <View style={styles.cardDetails}>
                                            <Text style={styles.cardBrand}>
                                                {formatCardBrand(card.brand)}
                                            </Text>
                                            <Text style={styles.cardNumber}>
                                                •••• •••• •••• {card.last4}
                                            </Text>
                                            <Text style={styles.cardExpiry}>
                                                Expires {card.expMonth}/{card.expYear}
                                            </Text>
                                        </View>
                                        {card.isDefault && (
                                            <View style={styles.defaultBadge}>
                                                <Text style={styles.defaultText}>Default</Text>
                                            </View>
                                        )}
                                    </View>
                                    <View style={styles.cardActions}>
                                        {!card.isDefault && (
                                            <TouchableOpacity onPress={() => handleSetDefault(card.id)}>
                                                <Text style={styles.actionText}>Set Default</Text>
                                            </TouchableOpacity>
                                        )}
                                        <TouchableOpacity onPress={() => handleDelete(card.id)}>
                                            <Text style={styles.deleteText}>Remove</Text>
                                        </TouchableOpacity>
                                    </View>
                                </Card>
                            ))
                        ) : (
                            <Card style={styles.emptyCard}>
                                <Text style={styles.emptyIcon}>💳</Text>
                                <Text style={styles.emptyText}>No payment methods added</Text>
                                <Text style={styles.emptySubtext}>
                                    Add a card to book appointments and make purchases
                                </Text>
                            </Card>
                        )}
                    </View>

                    {/* Add Card Button */}
                    <Button
                        title="Add Payment Method"
                        onPress={() => setShowAddModal(true)}
                        fullWidth
                    />

                    {/* Security Note */}
                    <View style={styles.securityNote}>
                        <Text style={styles.securityIcon}>🔒</Text>
                        <Text style={styles.securityText}>
                            Your payment information is encrypted and securely processed by Stripe.
                            We never store your full card number.
                        </Text>
                    </View>
                </ScrollView>

                {/* Add Card Modal */}
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
                                    <Text style={styles.modalCancel}>Cancel</Text>
                                </TouchableOpacity>
                                <Text style={styles.modalTitle}>Add Card</Text>
                                <View style={{ width: 60 }} />
                            </View>

                            <View style={styles.modalContent}>
                                <Text style={styles.inputLabel}>Card Information</Text>
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
                                        setCardComplete(cardDetails.complete);
                                    }}
                                />

                                <View style={styles.modalInfo}>
                                    <Text style={styles.modalInfoIcon}>ℹ️</Text>
                                    <Text style={styles.modalInfoText}>
                                        Your card will be securely saved for future bookings and purchases.
                                    </Text>
                                </View>

                                <Button
                                    title={addingCard ? 'Adding...' : 'Add Card'}
                                    onPress={handleAddCard}
                                    fullWidth
                                    disabled={!cardComplete || addingCard}
                                    loading={addingCard}
                                />
                            </View>
                        </SafeAreaView>
                    </ScreenBackground>
                </Modal>
            </SafeAreaView>
        </ScreenBackground>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    content: { padding: spacing.lg },
    header: { marginBottom: spacing.xl },
    backButton: { color: colors.textSecondary, fontSize: 16, marginBottom: spacing.md },
    title: { fontSize: 28, fontWeight: '600', color: colors.text },
    subtitle: { fontSize: 14, color: colors.textSecondary, marginTop: spacing.xs },
    section: { marginBottom: spacing.xl },
    cardItem: { marginBottom: spacing.md, padding: spacing.lg },
    cardInfo: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
    cardIcon: { fontSize: 32, marginRight: spacing.md },
    cardDetails: { flex: 1 },
    cardBrand: { fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: 2 },
    cardNumber: { fontSize: 14, color: colors.text, marginBottom: 2 },
    cardExpiry: { fontSize: 12, color: colors.textSecondary },
    defaultBadge: {
        backgroundColor: colors.primary,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: 6
    },
    defaultText: { color: colors.background, fontSize: 10, fontWeight: '600' },
    cardActions: {
        flexDirection: 'row',
        gap: spacing.lg,
        paddingTop: spacing.md,
        borderTopWidth: 1,
        borderTopColor: colors.border
    },
    actionText: { color: colors.primary, fontSize: 14, fontWeight: '500' },
    deleteText: { color: '#EF4444', fontSize: 14, fontWeight: '500' },
    emptyCard: { padding: spacing.xl, alignItems: 'center' },
    emptyIcon: { fontSize: 48, marginBottom: spacing.md, opacity: 0.5 },
    emptyText: { fontSize: 16, color: colors.text, fontWeight: '500', marginBottom: spacing.xs },
    emptySubtext: { fontSize: 14, color: colors.textSecondary, textAlign: 'center' },
    securityNote: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginTop: spacing.lg,
        padding: spacing.md,
        backgroundColor: 'rgba(139, 92, 246, 0.1)',
        borderRadius: 12,
    },
    securityIcon: { fontSize: 16, marginRight: spacing.sm, marginTop: 2 },
    securityText: { flex: 1, fontSize: 12, color: colors.textSecondary, lineHeight: 18 },
    // Modal styles
    modalContainer: { flex: 1 },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: colors.border
    },
    modalCancel: { color: colors.textSecondary, fontSize: 16 },
    modalTitle: { fontSize: 18, fontWeight: '600', color: colors.text },
    modalContent: { padding: spacing.lg },
    inputLabel: {
        fontSize: 14,
        fontWeight: '500',
        color: colors.text,
        marginBottom: spacing.sm
    },
    cardField: {
        width: '100%',
        height: 50,
        marginBottom: spacing.lg,
    },
    modalInfo: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        padding: spacing.md,
        borderRadius: 12,
        marginBottom: spacing.lg,
    },
    modalInfoIcon: { fontSize: 14, marginRight: spacing.sm, marginTop: 2 },
    modalInfoText: { flex: 1, fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
});

export default PaymentMethodsScreen;
