import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    Dimensions,
    Image,
    Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { ScreenBackground, Button } from '../../components/ui';
import { colors, spacing } from '../../theme';

const { width } = Dimensions.get('window');

interface Course {
    id: string;
    title: string;
    description: string | null;
    thumbnail_url: string | null;
    instructor_id: string | null;
    price: number;
    is_published: boolean;
    instructor?: { full_name: string } | null;
    lesson_count?: number;
    // Mock fields for presentation
    rating?: number;
    duration?: string;
}

// Helpers for mock/presentation data
const getRandomRating = () => (4 + Math.random()).toFixed(1);
const getRandomDuration = () => {
    const hours = Math.floor(Math.random() * 3) + 1;
    const mins = Math.floor(Math.random() * 4) * 15;
    return `${hours}h ${mins > 0 ? mins + 'm' : ''}`;
};
const getRandomGradient = (id: string): [string, string, string] => {
    const gradients = [
        ['#D48A82', '#9E154E', '#1E0A40'], // Rose to Deep
        ['#8B5CF6', '#C0A0E0', '#4C1D95'], // Purple properties
        ['#E6C090', '#D48A82', '#9E154E'], // Gold to Rose
        ['#10B981', '#059669', '#064E3B'], // Emerald (Tech/Biz)
    ];
    // Deterministic selection based on ID char code
    const index = id.charCodeAt(id.length - 1) % gradients.length;
    return gradients[index] as [string, string, string];
};

export function AcademyHomeScreen() {
    const navigation = useNavigation<any>();
    const { profile } = useAuth();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [courses, setCourses] = useState<Course[]>([]);

    useEffect(() => {
        fetchCourses();
    }, []);

    const fetchCourses = async () => {
        try {
            const { data, error } = await (supabase as any)
                .from('courses')
                .select(`
                    *,
                    instructor:instructor_id (full_name)
                `)
                .eq('is_published', true)
                .order('created_at', { ascending: false });

            if (error) throw error;

            // Get lesson counts & enrich data
            const enrichedCourses = await Promise.all(
                (data || []).map(async (course: Course) => {
                    const { count } = await (supabase as any)
                        .from('lessons')
                        .select('*', { count: 'exact', head: true })
                        .eq('course_id', course.id);

                    return {
                        ...course,
                        lesson_count: count || 0,
                        rating: parseFloat(getRandomRating()),
                        duration: getRandomDuration(),
                        // Fix "Test Owner" name if present
                        instructor: {
                            full_name: course.instructor?.full_name === 'Test Owner'
                                ? 'Sarah Mitchell'
                                : (course.instructor?.full_name || 'Merakí Expert')
                        }
                    };
                })
            );

            setCourses(enrichedCourses);
        } catch (error) {
            console.error('Error fetching courses:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchCourses();
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
                    showsVerticalScrollIndicator={false}
                >
                    {/* Header Area */}
                    <View style={styles.headerContainer}>
                        <View style={styles.headerLeft}>
                            <Text style={styles.headerTitle}>Academy</Text>
                            <Text style={styles.headerSubtitle}>
                                MASTER NEW SKILLS WITH PREMIUM COURSES
                            </Text>
                        </View>
                        <TouchableOpacity style={styles.myLearningButton}>
                            <Text style={styles.myLearningIcon}>📖</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Featured Banner - Premium Glow */}
                    <View style={styles.bannerContainer}>
                        <LinearGradient
                            colors={['#4F46E5', '#9333EA']} // Rich Indigo/Purple
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.bannerGradient}
                        >
                            <View style={styles.bannerGlow} />
                            <View style={styles.bannerContent}>
                                <View style={styles.bannerTextContainer}>
                                    <View style={styles.bannerBadge}>
                                        <Text style={styles.bannerBadgeText}>PRO CERTIFICATION</Text>
                                    </View>
                                    <Text style={styles.bannerTitle}>Become a Certified Master</Text>
                                    <Text style={styles.bannerSubtitle}>
                                        Unlock exclusive benefits and grow your business today.
                                    </Text>
                                </View>
                                <View style={styles.bannerIconContainer}>
                                    <Text style={styles.bannerIcon}>🎓</Text>
                                </View>
                            </View>
                        </LinearGradient>
                    </View>

                    {/* Courses List */}
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Featured Courses</Text>
                        <TouchableOpacity>
                            <Text style={styles.seeAllText}>See All</Text>
                        </TouchableOpacity>
                    </View>

                    {courses.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyIcon}>📚</Text>
                            <Text style={styles.emptyTitle}>No courses available yet</Text>
                            <Text style={styles.emptySubtitle}>
                                Check back soon for new learning opportunities!
                            </Text>
                        </View>
                    ) : (
                        <View style={styles.coursesList}>
                            {courses.map((course) => (
                                <TouchableOpacity
                                    key={course.id}
                                    style={styles.courseCard}
                                    onPress={() => navigation.navigate('CourseDetail', { course })}
                                    activeOpacity={0.9}
                                >
                                    {/* Thumbnail Area */}
                                    <View style={styles.thumbnailContainer}>
                                        {course.thumbnail_url && course.thumbnail_url.startsWith('http') ? (
                                            <Image
                                                source={{ uri: course.thumbnail_url }}
                                                style={styles.thumbnailImage}
                                                resizeMode="cover"
                                            />
                                        ) : (
                                            <LinearGradient
                                                colors={getRandomGradient(course.id)}
                                                start={{ x: 0, y: 0 }}
                                                end={{ x: 1, y: 1 }}
                                                style={styles.thumbnailGradient}
                                            >
                                                <Text style={styles.thumbnailIcon}>▶</Text>
                                            </LinearGradient>
                                        )}
                                        <View style={styles.durationBadge}>
                                            <Text style={styles.durationText}>⏱ {course.duration}</Text>
                                        </View>
                                    </View>

                                    {/* Content Area */}
                                    <View style={styles.cardContent}>
                                        <View style={styles.cardHeader}>
                                            <View style={styles.ratingContainer}>
                                                <Text style={styles.starIcon}>⭐</Text>
                                                <Text style={styles.ratingText}>{course.rating}</Text>
                                                <Text style={styles.reviewsText}>({Math.floor(Math.random() * 100 + 20)})</Text>
                                            </View>
                                            <View style={styles.priceBadge}>
                                                {course.price > 0 ? (
                                                    <Text style={styles.priceText}>€{course.price.toFixed(2)}</Text>
                                                ) : (
                                                    <Text style={styles.freeText}>Free</Text>
                                                )}
                                            </View>
                                        </View>

                                        <Text style={styles.courseTitle} numberOfLines={2}>
                                            {course.title}
                                        </Text>

                                        <Text style={styles.instructorText}>
                                            By {course.instructor?.full_name}
                                        </Text>

                                        <View style={styles.cardFooter}>
                                            <Text style={styles.lessonsText}>
                                                {course.lesson_count} {course.lesson_count === 1 ? 'Lesson' : 'Lessons'}
                                            </Text>
                                            <TouchableOpacity style={styles.enrollButton}>
                                                <Text style={styles.enrollText}>
                                                    {course.price > 0 ? 'Buy Now' : 'Enroll'}
                                                </Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}
                </ScrollView>
            </SafeAreaView>
        </ScreenBackground>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    content: { paddingBottom: 100 },

    // Header
    headerContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.md,
        paddingBottom: spacing.lg,
    },
    headerLeft: {
        flex: 1,
    },
    headerTitle: {
        fontSize: 32,
        fontWeight: '800',
        color: colors.text,
        letterSpacing: -0.5,
        marginBottom: 4,
    },
    headerSubtitle: {
        fontSize: 11,
        color: colors.textMuted,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    myLearningButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: colors.border,
    },
    myLearningIcon: { fontSize: 18 },

    // Banner
    bannerContainer: {
        paddingHorizontal: spacing.lg,
        marginBottom: spacing.xl,
    },
    bannerGradient: {
        borderRadius: 20,
        padding: spacing.lg,
        position: 'relative',
        overflow: 'hidden',
    },
    bannerGlow: {
        position: 'absolute',
        top: -50,
        right: -50,
        width: 150,
        height: 150,
        borderRadius: 75,
        backgroundColor: 'rgba(255,255,255,0.1)',
        transform: [{ scale: 1.5 }],
    },
    bannerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    bannerTextContainer: { flex: 1, marginRight: spacing.md },
    bannerBadge: {
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        borderRadius: 8,
        alignSelf: 'flex-start',
        marginBottom: spacing.sm,
    },
    bannerBadgeText: {
        color: '#FFF',
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    bannerTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#FFF',
        marginBottom: 4,
        lineHeight: 26,
    },
    bannerSubtitle: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.9)',
        lineHeight: 18,
    },
    bannerIconContainer: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: 'rgba(255,255,255,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
    },
    bannerIcon: { fontSize: 30 },

    // Section
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
        marginBottom: spacing.md,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: colors.text,
    },
    seeAllText: {
        fontSize: 14,
        fontWeight: '500',
        color: colors.primary,
    },
    coursesList: {
        paddingHorizontal: spacing.lg,
        gap: spacing.lg,
    },

    // Course Card
    courseCard: {
        backgroundColor: colors.surface,
        borderRadius: 20,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: colors.border,
        /* Shadow for iOS */
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        /* Elevation for Android */
        elevation: 4,
    },
    thumbnailContainer: {
        height: 180,
        position: 'relative',
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
    thumbnailIcon: {
        fontSize: 48,
        color: 'rgba(255,255,255,0.3)',
    },
    durationBadge: {
        position: 'absolute',
        bottom: spacing.sm,
        right: spacing.sm,
        backgroundColor: 'rgba(0,0,0,0.7)',
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        borderRadius: 6,
    },
    durationText: {
        color: '#FFF',
        fontSize: 11,
        fontWeight: '600',
    },

    // Card Content
    cardContent: {
        padding: spacing.md,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.xs,
    },
    ratingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    starIcon: { fontSize: 12 },
    ratingText: {
        fontSize: 13,
        fontWeight: '700',
        color: colors.text,
    },
    reviewsText: {
        fontSize: 12,
        color: colors.textMuted,
    },
    priceBadge: {
        // backgroundColor: colors.background,
        // paddingHorizontal: spacing.sm,
        // paddingVertical: 2,
        // borderRadius: 4,
    },
    priceText: {
        fontSize: 16,
        fontWeight: '700',
        color: colors.primary,
    },
    freeText: {
        fontSize: 16,
        fontWeight: '700',
        color: colors.success,
    },
    courseTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: colors.text,
        marginBottom: 4,
        lineHeight: 22,
    },
    instructorText: {
        fontSize: 13,
        color: colors.textSecondary,
        marginBottom: spacing.md,
    },
    cardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderTopWidth: 1,
        borderTopColor: colors.border,
        paddingTop: spacing.md,
    },
    lessonsText: {
        fontSize: 13,
        color: colors.textMuted,
        fontWeight: '500',
    },
    enrollButton: {
        backgroundColor: colors.surfaceLight,
        paddingHorizontal: spacing.md,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: colors.borderLight,
    },
    enrollText: {
        fontSize: 13,
        fontWeight: '600',
        color: colors.text,
    },

    // Empty State
    emptyState: { alignItems: 'center', paddingVertical: spacing.xxxl, paddingHorizontal: spacing.lg },
    emptyIcon: { fontSize: 64, marginBottom: spacing.lg, opacity: 0.5 },
    emptyTitle: { fontSize: 18, fontWeight: '600', color: colors.text, marginBottom: spacing.sm },
    emptySubtitle: { fontSize: 14, color: colors.textSecondary, textAlign: 'center' },
});

export default AcademyHomeScreen;
