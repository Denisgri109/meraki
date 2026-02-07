import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
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
import { ScreenBackground, Button } from '../../components/ui';
import { colors, spacing } from '../../theme';
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

    // Payment state
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
    }, [profile?.stripe_customer_id, user?.id]);

    const handlePurchase = async () => {
        if (!user) {
            Alert.alert('Error', 'Please log in to purchase course');
            return;
        }

        // Validate payment method selection
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
            // 1. Create Payment Intent
            const totalInCents = eurosToCents(course.price);
            const { clientSecret, paymentIntentId } = await createPaymentIntent({
                amount: totalInCents,
                customerId: profile?.stripe_customer_id || undefined,
                description: `Course: ${course.title}`,
                captureMethod: 'automatic',
            });

            // 2. Confirm Payment
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

            // 3. Create Enrollment
            const { error: enrollError } = await (supabase as any)
                .from('course_enrollments')
                .insert({
                    student_id: user.id,
                    course_id: course.id,
                    enrolled_at: new Date().toISOString(),
                    progress: 0
                });

            if (enrollError) throw enrollError;

            // 4. Record Payment
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

            Alert.alert(
                '🎉 Success!',
                'You have successfully enrolled in the course.',
                [
                    {
                        text: 'Start Learning',
                        onPress: () => {
                            navigation.replace('CourseDetail', { course });
                        },
                    },
                ]
            );

        } catch (error: any) {
            console.error('Purchase error:', error);
            Alert.alert('Purchase Failed', error.message || 'Something went wrong');
        } finally {
            setLoading(false);
        }
    };

    return (
        <ScreenBackground>
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()}>
                        <Text style={styles.backButton}>←</Text>
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Unlock Course</Text>
                    <View style={{ width: 40 }} />
                </View>

                <ScrollView contentContainerStyle={styles.content}>
                    {/* Course Preview Card */}
                    <View style={styles.card}>
                        <View style={styles.thumbnailContainer}>
                            {course.thumbnail_url && course.thumbnail_url.startsWith('http') ? (
                                <Image
                                    source={{ uri: course.thumbnail_url }}
                                    style={styles.thumbnailImage}
                                    resizeMode="cover"
                                />
                            ) : (
                                <LinearGradient
                                    colors={['#4F46E5', '#9333EA']}
                                    style={styles.thumbnailGradient}
                                >
                                    <Text style={styles.thumbnailIcon}>🎓</Text>
                                </LinearGradient>
                            )}
                        </View>

                        <View style={styles.cardContent}>
                            <Text style={styles.courseTitle}>{course.title}</Text>
                            <Text style={styles.instructor}>
                                By {course.instructor?.full_name || 'Merakí Expert'}
                            </Text>

                            <View style={styles.divider} />

                            <View style={styles.row}>
                                <Text style={styles.label}>Lessons</Text>
                                <Text style={styles.value}>{course.lesson_count || 'Multiple'}</Text>
                            </View>
                            <View style={styles.row}>
                                <Text style={styles.label}>Duration</Text>
                                <Text style={styles.value}>{course.duration || 'Self-paced'}</Text>
                            </View>
                            <View style={styles.row}>
                                <Text style={styles.label}>Access</Text>
                                <Text style={styles.value}>Lifetime</Text>
                            </View>
                        </View>
                    </View>

                    {/* Price Section */}
                    <View style={styles.priceContainer}>
                        <Text style={styles.totalLabel}>Total Price</Text>
                        <Text style={styles.price}>€{course.price.toFixed(2)}</Text>
                    </View>

                    {/* Payment Method Section */}
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
                                            onCardChange={(cardDetails: { complete: boolean }) => {
                                                setNewCardComplete(cardDetails.complete);
                                            }}
                                        />
                                    </View>
                                )}
                            </>
                        )}
                    </View>

                    <View style={styles.guaranteeBox}>
                        <Text style={styles.guaranteeIcon}>🛡️</Text>
                        <Text style={styles.guaranteeText}>
                            Secure payment via Stripe. Instant access upon purchase.
                        </Text>
                    </View>

                </ScrollView>

                <View style={styles.footer}>
                    <Button
                        title={loading ? 'Processing...' : `Pay €${course.price.toFixed(2)} & Enroll`}
                        onPress={handlePurchase}
                        fullWidth
                        loading={loading}
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
    },
    backButton: { fontSize: 24, color: colors.text },
    headerTitle: { fontSize: 18, fontWeight: '600', color: colors.text },
    content: { padding: spacing.lg, paddingBottom: 100 },
    card: {
        backgroundColor: colors.surface,
        borderRadius: 20,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: colors.border,
        marginBottom: spacing.xl,
    },
    thumbnailContainer: {
        height: 180,
    },
    thumbnailImage: {
        width: '100%',
        height: '100%',
    },
    thumbnailGradient: {
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
    },
    thumbnailIcon: { fontSize: 60 },
    cardContent: {
        padding: spacing.lg,
    },
    courseTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: colors.text,
        marginBottom: 8,
    },
    instructor: {
        fontSize: 14,
        color: colors.textSecondary,
        marginBottom: spacing.lg,
    },
    divider: {
        height: 1,
        backgroundColor: colors.border,
        marginBottom: spacing.md,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: spacing.sm,
    },
    label: {
        color: colors.textMuted,
        fontSize: 14,
    },
    value: {
        color: colors.text,
        fontWeight: '600',
        fontSize: 14,
    },
    priceContainer: {
        alignItems: 'center',
        marginBottom: spacing.lg,
    },
    totalLabel: {
        fontSize: 14,
        color: colors.textMuted,
        marginBottom: 4,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    price: {
        fontSize: 36,
        fontWeight: '800',
        color: colors.primary,
    },
    section: {
        marginBottom: spacing.xl,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.textSecondary,
        marginBottom: spacing.md,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
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
    guaranteeBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(52, 211, 153, 0.1)',
        padding: spacing.md,
        borderRadius: 12,
        gap: spacing.md,
    },
    guaranteeIcon: { fontSize: 20 },
    guaranteeText: {
        flex: 1,
        color: colors.success,
        fontSize: 12,
        fontWeight: '500',
    },
    footer: {
        padding: spacing.lg,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        backgroundColor: colors.surface,
    },
});
