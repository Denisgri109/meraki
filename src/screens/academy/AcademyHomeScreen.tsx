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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { ScreenBackground } from '../../components/ui';
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
}

export function AcademyHomeScreen() {
    const navigation = useNavigation<any>();
    const { profile } = useAuth();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [courses, setCourses] = useState<Course[]>([]);

    const isOwner = profile?.role === 'owner';

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

            // Get lesson counts
            const coursesWithCounts = await Promise.all(
                (data || []).map(async (course: Course) => {
                    const { count } = await (supabase as any)
                        .from('lessons')
                        .select('*', { count: 'exact', head: true })
                        .eq('course_id', course.id);
                    return { ...course, lesson_count: count || 0 };
                })
            );

            setCourses(coursesWithCounts);
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
                        <ActivityIndicator size="large" color={colors.text} />
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
                    {/* Header */}
                    <LinearGradient
                        colors={['#1E0A40', '#000000']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 0, y: 1 }}
                        style={styles.headerGradient}
                    >
                        <Text style={styles.headerTitle}>Academy</Text>
                        <Text style={styles.headerSubtitle}>
                            Master your craft with professional courses
                        </Text>
                    </LinearGradient>

                    {/* Featured Banner */}
                    <View style={styles.featuredBanner}>
                        <LinearGradient
                            colors={['rgba(139,92,246,0.3)', 'rgba(59,130,246,0.3)']}
                            style={styles.bannerGradient}
                        >
                            <Text style={styles.bannerEmoji}>🎓</Text>
                            <View style={styles.bannerContent}>
                                <Text style={styles.bannerTitle}>Become a Certified Master</Text>
                                <Text style={styles.bannerText}>
                                    Complete courses to unlock exclusive benefits
                                </Text>
                            </View>
                        </LinearGradient>
                    </View>

                    {/* Courses Grid */}
                    <Text style={styles.sectionTitle}>Available Courses</Text>

                    {courses.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyIcon}>📚</Text>
                            <Text style={styles.emptyTitle}>No courses available yet</Text>
                            <Text style={styles.emptySubtitle}>
                                Check back soon for new learning opportunities!
                            </Text>
                        </View>
                    ) : (
                        <View style={styles.coursesGrid}>
                            {courses.map((course) => (
                                <TouchableOpacity
                                    key={course.id}
                                    style={styles.courseCard}
                                    onPress={() => navigation.navigate('CourseDetail', { course })}
                                    activeOpacity={0.8}
                                >
                                    {course.thumbnail_url && course.thumbnail_url.startsWith('http') ? (
                                        <Image
                                            source={{ uri: course.thumbnail_url }}
                                            style={styles.courseThumbnailImage}
                                            resizeMode="cover"
                                        />
                                    ) : (
                                        <LinearGradient
                                            colors={['rgba(139,92,246,0.2)', 'rgba(59,130,246,0.2)']}
                                            style={styles.courseThumbnail}
                                        >
                                            <Text style={styles.courseEmoji}>📖</Text>
                                        </LinearGradient>
                                    )}
                                    <View style={styles.courseInfo}>
                                        <Text style={styles.courseTitle} numberOfLines={2}>
                                            {course.title}
                                        </Text>
                                        <Text style={styles.courseInstructor}>
                                            by {course.instructor?.full_name || 'Merakí Academy'}
                                        </Text>
                                        <View style={styles.courseMeta}>
                                            <Text style={styles.courseLessons}>
                                                📚 {course.lesson_count} lessons
                                            </Text>
                                            {course.price > 0 ? (
                                                <Text style={styles.coursePrice}>€{course.price.toFixed(2)}</Text>
                                            ) : (
                                                <Text style={styles.courseFree}>Free</Text>
                                            )}
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
    headerGradient: {
        paddingTop: spacing.lg,
        paddingBottom: spacing.xl,
        paddingHorizontal: spacing.lg,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
    },
    headerTitle: {
        fontSize: 48,
        fontWeight: '900',
        color: colors.text,
        marginBottom: 8,
        letterSpacing: -1,
    },
    headerSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.8)', fontWeight: '500' },
    featuredBanner: { margin: spacing.lg },
    bannerGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 16,
        padding: spacing.lg,
        borderWidth: 1,
        borderColor: 'rgba(139,92,246,0.3)',
    },
    bannerEmoji: { fontSize: 40, marginRight: spacing.md },
    bannerContent: { flex: 1 },
    bannerTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 4 },
    bannerText: { fontSize: 13, color: colors.textSecondary },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.textSecondary,
        marginHorizontal: spacing.lg,
        marginBottom: spacing.md,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    coursesGrid: { paddingHorizontal: spacing.lg, gap: spacing.md },
    courseCard: {
        backgroundColor: colors.surface,
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: colors.border,
    },
    courseThumbnail: {
        height: 120,
        alignItems: 'center',
        justifyContent: 'center',
    },
    courseThumbnailImage: {
        height: 120,
        width: '100%',
    },
    courseEmoji: { fontSize: 48 },
    courseInfo: { padding: spacing.md },
    courseTitle: { fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: 4 },
    courseInstructor: { fontSize: 12, color: colors.textMuted, marginBottom: spacing.sm },
    courseMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    courseLessons: { fontSize: 12, color: colors.textSecondary },
    coursePrice: { fontSize: 16, fontWeight: '700', color: colors.primary },
    courseFree: { fontSize: 14, fontWeight: '600', color: colors.success },
    emptyState: { alignItems: 'center', paddingVertical: spacing.xxxl, paddingHorizontal: spacing.lg },
    emptyIcon: { fontSize: 64, marginBottom: spacing.lg, opacity: 0.5 },
    emptyTitle: { fontSize: 18, fontWeight: '600', color: colors.text, marginBottom: spacing.sm },
    emptySubtitle: { fontSize: 14, color: colors.textSecondary, textAlign: 'center' },
});

export default AcademyHomeScreen;
