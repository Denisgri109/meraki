import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    StyleSheet,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    Image,
    ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useConfirmPayment, CardField } from '../../utils/stripe';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { ScreenBackground, Button, MerakiText, Card } from '../../components/ui';
import { colors, spacing, layout, gradients } from '../../theme';
import {
    createPaymentIntent,
    listPaymentMethods,
    eurosToCents,
    formatCardBrand,
    PaymentMethod,
} from '../../services/stripeService';

interface Course {
    id: string;
    title: string;
    description: string | null;
    thumbnail_url: string | null;
    price: number;
    instructor?: { full_name: string } | null;
    duration?: string;
    lesson_count?: number;
}

type AcademyStackParamList = {
    CoursePurchase: { course: Course };
    CourseDetail: { course: Course };
};

export function CoursePurchaseScreen() {
    const navigation = useNavigation<any>();
    const route = useRoute<RouteProp<AcademyStackParamList, 'CoursePurchase'>>();
    const { course } = route.params;
    const { user, profile } = useAuth();
    const { confirmPayment } = useConfirmPayment();

    const [loading, setLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [savedCards, setSavedCards] = useState<PaymentMethod[]>([]);
    const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
    const [showNewCard, setShowNewCard] = useState(false);
    const [newCardComplete, setNewCardComplete] = useState(false);
    const [loadingCards, setLoadingCards] = useState(true);

    useEffect(() => {
        fetchPaymentMethods();
    }, []);

    const fetchPaymentMethods = useCallback(async () => {
        if (!profile?.stripe_customer_id) {
            setShowNewCard(true);
            setLoadingCards(false);
            return;
        }

        try {
            const cards = await listPaymentMethods(profile.stripe_customer_id);
            setSavedCards(cards);

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
    }, [profile?.stripe_customer_id, user?.id]);

    const handlePurchase = async () => {
        if (!user) {
            Alert.alert('Error', 'Please log in to purchase course');
            return;
        }

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
            const totalInCents = eurosToCents(course.price);
            const { clientSecret, paymentIntentId } = await createPaymentIntent({
                amount: totalInCents,
                customerId: profile?.stripe_customer_id || undefined,
                description: `Course: ${course.title}`,
                captureMethod: 'automatic',
            });

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

            const { error: enrollError } = await (supabase as any)
                .from('course_enrollments')
                .insert({
                    student_id: user.id,
                    course_id: course.id,
                    enrolled_at: new Date().toISOString(),
                    progress: 0
                });

            if (enrollError) throw enrollError;

            await (supabase as any)
                .from('payments')
                .insert({
                    user_id: user.id,
                    stripe_payment_intent_id: paymentIntentId,
                    amount: totalInCents,
                    currency: 'eur',
                    status: 'succeeded',
                    payment_type: 'academy',
                    description: `Course Purchase: ${course.title}`,
                });

            setIsSuccess(true);

            Alert.alert(
                '🎉 Success!',
                'You have successfully enrolled in the course.',
                [{ text: 'OK' }]
            );

            // Navigate immediately
            navigation.navigate('Home');

        } catch (error: any) {
            Alert.alert('Purchase Failed', error.message || 'Something went wrong');
        } finally {
            setLoading(false);
        }
    };

    return (
        <ScreenBackground>
            <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <MerakiText style={styles.backIcon}>←</MerakiText>
                    </TouchableOpacity>
                    <MerakiText variant="h3">Course Checkout</MerakiText>
                    <View style={{ width: 44 }} />
                </View>

                <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Course Summary Card */}
                    <Card variant="glass" style={styles.courseCard} noPadding>
                        <View style={styles.thumbnailContainer}>
                            {course.thumbnail_url ? (
                                <Image source={{ uri: course.thumbnail_url }} style={styles.thumbnail} resizeMode="cover" />
                            ) : (
                                <LinearGradient colors={gradients.primary as any} style={styles.thumbnailPlaceholder}>
                                    <MerakiText style={styles.thumbnailEmoji}>🎓</MerakiText>
                                </LinearGradient>
                            )}
                        </View>
                        <View style={styles.cardInfo}>
                            <MerakiText variant="h3" style={styles.courseTitle}>{course.title}</MerakiText>
                            <MerakiText variant="caption" color={colors.textSecondary}>
                                instructor: {course.instructor?.full_name || 'Merakí Academy'}
                            </MerakiText>

                            <View style={styles.divider} />

                            <View style={styles.summaryRow}>
                                <MerakiText variant="caption" color={colors.textMuted}>Lessons</MerakiText>
                                <MerakiText variant="caption" color={colors.text}>{course.lesson_count || '8'}</MerakiText>
                            </View>
                            <View style={styles.summaryRow}>
                                <MerakiText variant="caption" color={colors.textMuted}>Access</MerakiText>
                                <MerakiText variant="caption" color={colors.text}>Lifetime</MerakiText>
                            </View>
                        </View>
                    </Card>

                    {/* Pricing */}
                    <View style={styles.priceSection}>
                        <MerakiText variant="label" color={colors.textMuted} align="center">INVESTMENT</MerakiText>
                        <MerakiText variant="h1" color={colors.accent} align="center" style={styles.priceText}>
                            €{course.price.toFixed(2)}
                        </MerakiText>
                    </View>

                    {/* Payment Selection */}
                    <View style={styles.paymentSection}>
                        <MerakiText variant="h3" style={styles.sectionTitle}>Payment Details</MerakiText>
                        {loadingCards ? (
                            <ActivityIndicator color={colors.primary} />
                        ) : (
                            <>
                                {savedCards.map((card) => (
                                    <TouchableOpacity
                                        key={card.id}
                                        activeOpacity={0.8}
                                        onPress={() => { setSelectedCardId(card.id); setShowNewCard(false); }}
                                    >
                                        <Card
                                            variant="glass"
                                            style={[styles.paymentCard, selectedCardId === card.id && !showNewCard && styles.selectedCard]}
                                        >
                                            <View style={styles.cardRow}>
                                                <MerakiText style={styles.cardIcon}>💳</MerakiText>
                                                <View style={{ flex: 1 }}>
                                                    <MerakiText variant="bodyBold">
                                                        {formatCardBrand(card.brand)} •••• {card.last4}
                                                    </MerakiText>
                                                    <MerakiText variant="caption" color={colors.textMuted}>
                                                        Expires {card.expMonth}/{card.expYear}
                                                    </MerakiText>
                                                </View>
                                                <View style={[styles.radio, selectedCardId === card.id && !showNewCard && styles.radioActive]}>
                                                    {selectedCardId === card.id && !showNewCard && <View style={styles.radioInner} />}
                                                </View>
                                            </View>
                                        </Card>
                                    </TouchableOpacity>
                                ))}

                                <TouchableOpacity activeOpacity={0.8} onPress={() => setShowNewCard(true)}>
                                    <Card variant="glass" style={[styles.paymentCard, showNewCard && styles.selectedCard]}>
                                        <View style={styles.cardRow}>
                                            <MerakiText style={styles.cardIcon}>➕</MerakiText>
                                            <MerakiText variant="bodyBold" style={{ flex: 1 }}>Pay with new card</MerakiText>
                                            <View style={[styles.radio, showNewCard && styles.radioActive]}>
                                                {showNewCard && <View style={styles.radioInner} />}
                                            </View>
                                        </View>
                                    </Card>
                                </TouchableOpacity>

                                {showNewCard && (
                                    <View style={styles.cardFieldWrapper}>
                                        <CardField
                                            postalCodeEnabled={false}
                                            cardStyle={{
                                                backgroundColor: 'rgba(255,255,255,0.05)',
                                                textColor: colors.text,
                                                placeholderColor: colors.textMuted,
                                            }}
                                            style={styles.cardField}
                                            onCardChange={(details: any) => setNewCardComplete(details.complete)}
                                        />
                                    </View>
                                )}
                            </>
                        )}
                    </View>

                    <View style={styles.securityNote}>
                        <MerakiText style={styles.shieldIcon}>🛡️</MerakiText>
                        <MerakiText variant="caption" color={colors.success} style={{ flex: 1 }}>
                            Secure encrypted checkout provided by Stripe inc.
                        </MerakiText>
                    </View>
                </ScrollView>

                <View style={styles.footer}>
                    <Button
                        title={loading || isSuccess ? 'Enrolling...' : `Pay & Unlock Course`}
                        onPress={handlePurchase}
                        variant="primary"
                        fullWidth
                        loading={loading || isSuccess}
                        disabled={loading || isSuccess}
                    />
                </View>
            </SafeAreaView>
        </ScreenBackground>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg },
    backButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: colors.surfaceGlass,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    backIcon: { fontSize: 24 },
    scrollContent: { paddingHorizontal: spacing.lg, paddingBottom: 20 },
    courseCard: { borderRadius: layout.borderRadius.lg, marginBottom: spacing.xl },
    thumbnailContainer: { height: 160, width: '100%', backgroundColor: colors.surfaceLight },
    thumbnail: { width: '100%', height: '100%' },
    thumbnailPlaceholder: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
    thumbnailEmoji: { fontSize: 50 },
    cardInfo: { padding: spacing.lg },
    courseTitle: { marginBottom: 4 },
    divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.05)', marginVertical: spacing.md },
    summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
    priceSection: { marginBottom: spacing.xl },
    priceText: { marginTop: 4 },
    paymentSection: { gap: spacing.md, marginBottom: spacing.xl },
    sectionTitle: { marginBottom: spacing.sm },
    paymentCard: { marginBottom: spacing.sm },
    selectedCard: { borderColor: colors.accent, borderWidth: 1 },
    cardRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    cardIcon: { fontSize: 24 },
    radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
    radioActive: { borderColor: colors.accent },
    radioInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.accent },
    cardFieldWrapper: { marginTop: spacing.sm, paddingHorizontal: 4 },
    cardField: { width: '100%', height: 50 },
    securityNote: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(16, 185, 129, 0.05)', padding: spacing.md, borderRadius: layout.borderRadius.md, gap: spacing.md },
    shieldIcon: { fontSize: 24 },
    footer: { padding: spacing.lg, backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' },
});

export default CoursePurchaseScreen;
