import React, { useState, useCallback } from 'react';
import {
    View,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    Dimensions,
    Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { ScreenBackground, Button, Card, MerakiText } from '../../components/ui';
import { colors, spacing, layout, gradients } from '../../theme';

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
    rating?: number;
    duration?: string;
}

// Helpers for mock/presentation data
const getRandomRating = () => (4.5 + Math.random() * 0.5).toFixed(1);
const getRandomDuration = () => {
    const hours = Math.floor(Math.random() * 3) + 1;
    const mins = Math.floor(Math.random() * 4) * 15;
    return `${hours}h ${mins > 0 ? mins + 'm' : ''}`;
};

const getCourseGradient = (id: string): string[] => {
    const options = [
        gradients.primary as any,
        gradients.secondary as any,
        gradients.premium as any,
        ['#C0A0E0', '#8B5CF6'],
    ];
    const index = id.charCodeAt(id.length - 1) % options.length;
    return options[index];
};

export function AcademyHomeScreen() {
    const navigation = useNavigation<any>();
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [courses, setCourses] = useState<Course[]>([]);
    const [enrolledCourseIds, setEnrolledCourseIds] = useState<Set<string>>(new Set());

    useFocusEffect(
        useCallback(() => {
            fetchCourses();
            if (user) {
                fetchEnrollments();
            }
        }, [user])
    );

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

    const fetchEnrollments = async () => {
        if (!user) return;
        try {
            const { data, error } = await (supabase as any)
                .from('course_enrollments')
                .select('course_id')
                .eq('student_id', user.id);

            if (error) throw error;

            const ids = new Set<string>((data || []).map((e: any) => e.course_id));
            setEnrolledCourseIds(ids);
        } catch (error) {
            console.error('Error fetching enrollments:', error);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchCourses();
        if (user) fetchEnrollments();
    };

    const handleCoursePress = (course: Course) => {
        const isEnrolled = enrolledCourseIds.has(course.id);
        const isFree = course.price === 0;

        if (isEnrolled || isFree) {
            navigation.navigate('CourseDetail', { course });
        } else {
            navigation.navigate('CoursePurchase', { course });
        }
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
                    contentContainerStyle={styles.scrollContent}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} />
                    }
                    showsVerticalScrollIndicator={false}
                >
                    {/* Premium Header */}
                    <View style={styles.headerContainer}>
                        <View style={styles.headerLeft}>
                            <MerakiText variant="h1" style={styles.headerTitle}>Academy</MerakiText>
                            <MerakiText variant="label" color={colors.textMuted} style={styles.headerSubtitle}>
                                Elevate Your Artistry
                            </MerakiText>
                        </View>
                        <TouchableOpacity
                            style={styles.myLearningButton}
                            onPress={() => navigation.navigate('MyLearning')}
                        >
                            <MerakiText style={styles.myLearningIcon}>📖</MerakiText>
                        </TouchableOpacity>
                    </View>

                    {/* Featured Certification Banner */}
                    <View style={styles.bannerContainer}>
                        <TouchableOpacity activeOpacity={0.9}>
                            <LinearGradient
                                colors={gradients.primary as any}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.bannerGradient}
                            >
                                <View style={styles.bannerContent}>
                                    <View style={styles.bannerText}>
                                        <View style={styles.bannerBadge}>
                                            <MerakiText variant="label" color="#FFF">NEW PROGRAM</MerakiText>
                                        </View>
                                        <MerakiText variant="h2" color="#FFF" style={styles.bannerTitle}>
                                            Master Lash Certification
                                        </MerakiText>
                                        <MerakiText variant="caption" color="rgba(255,255,255,0.8)" style={styles.bannerSubtitle}>
                                            Learn from industry leaders and get certified worldwide.
                                        </MerakiText>
                                    </View>
                                    <View style={styles.bannerIconContainer}>
                                        <MerakiText style={styles.bannerEmoji}>🎓</MerakiText>
                                    </View>
                                </View>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>

                    {/* Course Lists Section */}
                    <View style={styles.sectionHeader}>
                        <MerakiText variant="h3" style={styles.sectionTitle}>Premium Courses</MerakiText>
                        <TouchableOpacity>
                            <MerakiText variant="caption" color={colors.primary}>View All</MerakiText>
                        </TouchableOpacity>
                    </View>

                    {courses.length === 0 ? (
                        <Card variant="glass" style={styles.emptyCard}>
                            <MerakiText style={styles.emptyEmoji}>📚</MerakiText>
                            <MerakiText variant="h3" align="center">No courses yet</MerakiText>
                            <MerakiText variant="body" align="center" color={colors.textMuted}>
                                We're preparing new educational content for you. Check back soon!
                            </MerakiText>
                        </Card>
                    ) : (
                        <View style={styles.coursesGrid}>
                            {courses.map((course) => {
                                const isEnrolled = enrolledCourseIds.has(course.id);
                                return (
                                    <TouchableOpacity
                                        key={course.id}
                                        style={styles.courseWrapper}
                                        onPress={() => handleCoursePress(course)}
                                        activeOpacity={0.9}
                                    >
                                        <Card variant="glass" style={styles.courseCard} noPadding>
                                            {/* Course Thumbnail */}
                                            <View style={styles.thumbnailWrapper}>
                                                {course.thumbnail_url?.startsWith('http') ? (
                                                    <Image
                                                        source={{ uri: course.thumbnail_url }}
                                                        style={styles.thumbnail}
                                                        resizeMode="cover"
                                                    />
                                                ) : (
                                                    <LinearGradient
                                                        colors={getCourseGradient(course.id)}
                                                        style={styles.thumbnailPlaceholder}
                                                    >
                                                        <MerakiText style={styles.thumbnailIcon}>▶</MerakiText>
                                                    </LinearGradient>
                                                )}

                                                <View style={styles.durationBadge}>
                                                    <MerakiText variant="label" color="#FFF" style={styles.durationText}>
                                                        {course.duration}
                                                    </MerakiText>
                                                </View>

                                                {isEnrolled && (
                                                    <View style={styles.enrolledBadge}>
                                                        <MerakiText variant="label" color="#FFF">ENROLLED</MerakiText>
                                                    </View>
                                                )}
                                            </View>

                                            <View style={styles.courseInfo}>
                                                <View style={styles.ratingRow}>
                                                    <MerakiText style={styles.starIcon}>⭐</MerakiText>
                                                    <MerakiText variant="caption" style={styles.ratingText}>
                                                        {course.rating}
                                                    </MerakiText>
                                                </View>

                                                <MerakiText variant="bodyBold" style={styles.courseTitle} numberOfLines={2}>
                                                    {course.title}
                                                </MerakiText>

                                                <MerakiText variant="caption" color={colors.textMuted} style={styles.instructor}>
                                                    {course.instructor?.full_name}
                                                </MerakiText>

                                                <View style={styles.cardFooter}>
                                                    <MerakiText variant="caption" color={colors.textMuted}>
                                                        {course.lesson_count} lessons
                                                    </MerakiText>

                                                    {isEnrolled ? (
                                                        <MerakiText variant="bodyBold" color={colors.success}>Continue</MerakiText>
                                                    ) : (
                                                        <MerakiText variant="bodyBold" color={colors.accent}>
                                                            {course.price > 0 ? `€${course.price}` : 'FREE'}
                                                        </MerakiText>
                                                    )}
                                                </View>
                                            </View>
                                        </Card>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    )}
                </ScrollView>
            </SafeAreaView>
        </ScreenBackground>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    scrollContent: {
        paddingBottom: 100,
    },

    // Header
    headerContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.md,
        paddingBottom: spacing.lg,
    },
    headerLeft: {
        flex: 1,
    },
    headerTitle: {
        color: colors.text,
    },
    headerSubtitle: {
        marginTop: 2,
    },
    myLearningButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: colors.surfaceGlass,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    myLearningIcon: {
        fontSize: 20,
    },

    // Banner
    bannerContainer: {
        paddingHorizontal: spacing.lg,
        marginBottom: spacing.xxl,
    },
    bannerGradient: {
        borderRadius: layout.borderRadius.lg,
        padding: spacing.lg,
        overflow: 'hidden',
    },
    bannerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    bannerText: {
        flex: 1,
        paddingRight: spacing.md,
    },
    bannerBadge: {
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        borderRadius: 8,
        alignSelf: 'flex-start',
        marginBottom: spacing.sm,
    },
    bannerTitle: {
        marginBottom: 4,
    },
    bannerSubtitle: {
        lineHeight: 18,
    },
    bannerIconContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: 'rgba(255,255,255,0.15)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.25)',
    },
    bannerEmoji: {
        fontSize: 32,
    },

    // Sections
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
        marginBottom: spacing.md,
    },
    sectionTitle: {
        color: colors.text,
    },

    // Courses Grid
    coursesGrid: {
        paddingHorizontal: spacing.lg,
    },
    courseWrapper: {
        marginBottom: spacing.lg,
    },
    courseCard: {
        borderRadius: layout.borderRadius.lg,
    },
    thumbnailWrapper: {
        height: 200,
        width: '100%',
        position: 'relative',
        backgroundColor: colors.surfaceLight,
    },
    thumbnail: {
        width: '100%',
        height: '100%',
    },
    thumbnailPlaceholder: {
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
    },
    thumbnailIcon: {
        fontSize: 40,
        color: 'rgba(255,255,255,0.4)',
    },
    durationBadge: {
        position: 'absolute',
        bottom: spacing.md,
        right: spacing.md,
        backgroundColor: 'rgba(0,0,0,0.6)',
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        borderRadius: 8,
    },
    durationText: {
        fontSize: 10,
    },
    enrolledBadge: {
        position: 'absolute',
        top: spacing.md,
        left: spacing.md,
        backgroundColor: colors.success,
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        borderRadius: 8,
    },

    // Info
    courseInfo: {
        padding: spacing.md,
    },
    ratingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
    },
    starIcon: {
        fontSize: 12,
        marginRight: 4,
    },
    ratingText: {
        color: colors.textSecondary,
        fontWeight: 'bold',
    },
    courseTitle: {
        color: colors.text,
        marginBottom: 4,
        fontSize: 18,
    },
    instructor: {
        marginBottom: spacing.md,
    },
    cardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.05)',
        paddingTop: spacing.sm,
    },

    // Empty State
    emptyCard: {
        margin: spacing.lg,
        alignItems: 'center',
        padding: spacing.xxl,
    },
    emptyEmoji: {
        fontSize: 64,
        marginBottom: spacing.md,
        opacity: 0.5,
    },
});

export default AcademyHomeScreen;
