import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { CardField, useConfirmSetupIntent } from '../../utils/stripe';
import { Card, Button, ScreenBackground, MerakiModal, MerakiModalProps } from '../../components/ui';
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

    // Modal State
    const [modalConfig, setModalConfig] = useState<MerakiModalProps>({
        visible: false,
        title: '',
        onClose: () => setModalConfig(prev => ({ ...prev, visible: false })),
    });

    // Add Card State
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
            setModalConfig({
                visible: true,
                title: 'Error',
                message: 'Please enter valid card details',
                type: 'error',
                onClose: () => setModalConfig(prev => ({ ...prev, visible: false })),
            });
            return;
        }

        setAddingCard(true);

        try {
            // Create a SetupIntent
            const { clientSecret, customerId } = await createSetupIntent(
                user.id,
                profile?.email || undefined,
                profile?.stripe_customer_id || undefined
            );

            // If this is a new customer, save the customer ID
            if (!profile?.stripe_customer_id && customerId) {
                await supabase
                    .from('profiles')
                    .update({ stripe_customer_id: customerId })
                    .eq('id', user.id);
            }

            if (!clientSecret) {
                throw new Error('Failed to initialize card setup');
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

                setShowAddModal(false);
                setModalConfig({
                    visible: true,
                    title: 'Success',
                    message: 'Card added successfully',
                    type: 'success',
                    onClose: () => {
                        setModalConfig(prev => ({ ...prev, visible: false }));
                        fetchPaymentMethods();
                    },
                });
            }
        } catch (error: any) {
            setModalConfig({
                visible: true,
                title: 'Error',
                message: error.message || 'Failed to add card',
                type: 'error',
                onClose: () => setModalConfig(prev => ({ ...prev, visible: false })),
            });
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

            setModalConfig({
                visible: true,
                title: 'Success',
                message: 'Default payment method updated',
                type: 'success',
                onClose: () => setModalConfig(prev => ({ ...prev, visible: false })),
            });
        } catch (error) {
            setModalConfig({
                visible: true,
                title: 'Error',
                message: 'Failed to update default payment method',
                type: 'error',
                onClose: () => setModalConfig(prev => ({ ...prev, visible: false })),
            });
        }
    };

    const handleDelete = async (cardId: string) => {
        setModalConfig({
            visible: true,
            title: 'Remove Card',
            message: 'Are you sure you want to remove this payment method?',
            type: 'default',
            confirmText: 'Remove',
            confirmDestructive: true,
            onClose: () => setModalConfig(prev => ({ ...prev, visible: false })),
            onConfirm: async () => {
                setModalConfig(prev => ({ ...prev, visible: false }));
                try {
                    await deletePaymentMethod(cardId);

                    // Remove from database
                    await (supabase as any)
                        .from('payment_methods')
                        .delete()
                        .eq('stripe_payment_method_id', cardId);

                    setCards(cards.filter(c => c.id !== cardId));
                    // Re-show success modal
                    setTimeout(() => {
                        setModalConfig({
                            visible: true,
                            title: 'Success',
                            message: 'Card removed',
                            type: 'success',
                            onClose: () => setModalConfig(prev => ({ ...prev, visible: false })),
                        });
                    }, 300);
                } catch (error) {
                    setTimeout(() => {
                        setModalConfig({
                            visible: true,
                            title: 'Error',
                            message: 'Failed to remove card',
                            type: 'error',
                            onClose: () => setModalConfig(prev => ({ ...prev, visible: false })),
                        });
                    }, 300);
                }
            }
        });
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

                {/* Add Card Modal (Full Screen Page) */}
                <Modal
                    visible={showAddModal}
                    animationType="slide"
                    presentationStyle="pageSheet"
                    onRequestClose={() => setShowAddModal(false)}
                >
                    <View style={styles.fullScreenModal}>
                        <ScreenBackground>
                            <SafeAreaView style={styles.container}>
                                <View style={styles.modalHeader}>
                                    <TouchableOpacity onPress={() => setShowAddModal(false)}>
                                        <Text style={styles.cancelText}>Cancel</Text>
                                    </TouchableOpacity>
                                    <Text style={styles.modalTitle}>Add Payment Method</Text>
                                    <View style={{ width: 50 }} />
                                </View>

                                <ScrollView style={styles.modalScroll}>
                                    <Text style={styles.inputLabel}>Card Information</Text>

                                    <View style={styles.cardFieldContainer}>
                                        <CardField
                                            postalCodeEnabled={false}
                                            placeholders={{
                                                number: '4242 4242 4242 4242',
                                            }}
                                            cardStyle={{
                                                backgroundColor: '#2A2A2A', // Dark background for input
                                                textColor: '#FFFFFF',
                                                placeholderColor: '#9CA3AF',
                                                borderWidth: 0,
                                                borderRadius: 8,
                                            }}
                                            style={styles.cardField}
                                            onCardChange={(cardDetails: any) => {
                                                setCardComplete(cardDetails.complete);
                                            }}
                                        />
                                    </View>

                                    <View style={styles.modalInfo}>
                                        <Text style={styles.modalInfoIcon}>ℹ️</Text>
                                        <Text style={styles.modalInfoText}>
                                            Your card will be securely saved for future bookings and purchases.
                                        </Text>
                                    </View>

                                    <Button
                                        title="Save Card"
                                        onPress={handleAddCard}
                                        loading={addingCard}
                                        fullWidth
                                        style={styles.saveButton}
                                    />
                                </ScrollView>
                            </SafeAreaView>
                        </ScreenBackground>
                    </View>
                </Modal>

                {/* Alert Modal */}
                <MerakiModal
                    visible={modalConfig.visible}
                    title={modalConfig.title}
                    message={modalConfig.message}
                    type={modalConfig.type}
                    onClose={modalConfig.onClose}
                    onConfirm={modalConfig.onConfirm}
                    confirmText={modalConfig.confirmText}
                    cancelText={modalConfig.cancelText}
                    confirmDestructive={modalConfig.confirmDestructive}
                    hideCancel={modalConfig.hideCancel}
                />
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
    modalContent: {
        width: '100%',
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: '500',
        color: colors.text,
        marginBottom: spacing.sm
    },
    cardFieldContainer: {
        marginBottom: spacing.lg,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 12,
        padding: 4,
        borderWidth: 1,
        borderColor: colors.border,
    },
    cardField: {
        width: '100%',
        height: 50,
    },
    modalInfo: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        padding: spacing.md,
        borderRadius: 12,
        marginBottom: spacing.xs,
    },
    modalInfoIcon: { fontSize: 14, marginRight: spacing.sm, marginTop: 2 },
    modalInfoText: { flex: 1, fontSize: 13, color: colors.textSecondary, lineHeight: 18 },

    // New Full Screen Modal Styles
    fullScreenModal: {
        flex: 1,
        backgroundColor: colors.background,
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
    cancelText: {
        fontSize: 16,
        color: colors.primary,
    },
    modalScroll: {
        flex: 1,
        padding: spacing.lg,
    },
    saveButton: {
        marginTop: spacing.xl,
    },
});
