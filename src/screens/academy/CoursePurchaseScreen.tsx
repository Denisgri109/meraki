import React, { useState, useEffect } from 'react';
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
import { useConfirmPayment } from '../../utils/stripe';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { ScreenBackground, Button } from '../../components/ui';
import { colors, spacing } from '../../theme';
import {
    createPaymentIntent,
    eurosToCents,
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

    const handlePurchase = async () => {
        if (!user) {
            Alert.alert('Error', 'Please log in to purchase course');
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
            const { error, paymentIntent } = await confirmPayment(clientSecret, {
                paymentMethodType: 'Card',
            });

            if (error) {
                throw new Error(error.message);
            }

            // 3. Create Enrollment
            // We do this client side for now as per app pattern, though ideally should be backend
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
                            // Replace specific stack to prevent going back to purchase screen
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
    content: { padding: spacing.lg },
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
        marginBottom: spacing.xl,
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
