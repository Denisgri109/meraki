import React, { useState, useCallback, useMemo } from 'react';
import {
    View,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    Dimensions,
    Image,
    TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { ScreenBackground, MerakiText } from '../../components/ui';
import { colors, spacing } from '../../theme';

const { width } = Dimensions.get('window');

// Check if a URL points to a streaming platform (not a direct file)
const isStreamingUrl = (url: string): boolean => {
    return (
        url.includes('youtube.com') ||
        url.includes('youtu.be') ||
        url.includes('vimeo.com') ||
        url.includes('mux.com')
    );
};

// Probe a video URL to get its real duration in seconds
const probeVideoDuration = async (videoUrl: string): Promise<number | null> => {
    try {
        const { sound, status } = await Audio.Sound.createAsync(
            { uri: videoUrl },
            { shouldPlay: false }
        );
        let duration: number | null = null;
        if (status.isLoaded && status.durationMillis) {
            duration = Math.round(status.durationMillis / 1000);
        }
        await sound.unloadAsync();
        return duration;
    } catch {
        return null;
    }
};

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

const getRandomRating = () => (4.5 + Math.random() * 0.5).toFixed(1);

// Format total seconds into a readable duration string
const formatTotalDuration = (totalSeconds: number): string => {
    if (totalSeconds <= 0) return '0s';
    if (totalSeconds < 60) return `${Math.round(totalSeconds)}s`;
    if (totalSeconds < 3600) {
        const mins = Math.round(totalSeconds / 60);
        return `${mins}m`;
    }
    const hours = Math.floor(totalSeconds / 3600);
    const mins = Math.round((totalSeconds % 3600) / 60);
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
};

// Pastel gradients for course cards — cycles through them
const PASTEL_GRADIENTS: [string, string][] = [
    ['#D4C4FF', '#F0E6FF'],   // Brighter Lavender
    ['#FFD1DC', '#FFF0F5'],   // Brighter Pink
    ['#FFE8B3', '#FFF6D9'],   // Brighter Peach
    ['#C2E0FF', '#E6F2FF'],   // Brighter Blue
    ['#FFC2D1', '#FFE6EB'],   // Pink Blush
    ['#B2F2E3', '#E6FAF5'],   // Mint
];

const getGradientForIndex = (index: number): [string, string] => {
    return PASTEL_GRADIENTS[index % PASTEL_GRADIENTS.length];
};

export function AcademyHomeScreen() {
    const navigation = useNavigation<any>();
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [courses, setCourses] = useState<Course[]>([]);
    const [enrolledCourseIds, setEnrolledCourseIds] = useState<Set<string>>(new Set());
    const [searchQuery, setSearchQuery] = useState('');

    const filteredCourses = useMemo(() => {
        if (!searchQuery.trim()) return courses;
        const q = searchQuery.toLowerCase().trim();
        return courses.filter((course) => {
            const title = course.title?.toLowerCase() || '';
            const description = course.description?.toLowerCase() || '';
            const instructor = course.instructor?.full_name?.toLowerCase() || '';
            return title.includes(q) || description.includes(q) || instructor.includes(q);
        });
    }, [courses, searchQuery]);

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

            const coursesData = data || [];

            // Extract all course IDs for a single query
            const courseIds = coursesData.map((c: Course) => c.id);

            let allLessons: any[] = [];
            if (courseIds.length > 0) {
                // Fetch all lessons for all displayed courses in one query
                const { data: lessonsData, error: lessonsError } = await (supabase as any)
                    .from('lessons')
                    .select('id, course_id, duration_minutes, video_url')
                    .in('course_id', courseIds);

                if (!lessonsError && lessonsData) {
                    allLessons = lessonsData;
                }
            }

            // Group lessons by course_id for fast lookup
            const lessonsByCourse = allLessons.reduce((acc, lesson) => {
                if (!acc[lesson.course_id]) {
                    acc[lesson.course_id] = [];
                }
                acc[lesson.course_id].push(lesson);
                return acc;
            }, {} as Record<string, any[]>);

            const lessonsToUpdate: { id: string; duration_minutes: number }[] = [];

            const enrichedCourses = await Promise.all(
                coursesData.map(async (course: Course) => {
                    const courseLessons = lessonsByCourse[course.id] || [];
                    const count = courseLessons.length;

                    // Probe real video durations for direct uploads
                    let totalSeconds = 0;
                    await Promise.all(
                        courseLessons.map(async (lesson: any) => {
                            // Trust the cached value to avoid N+1 probing and updates
                            if (typeof lesson.duration_minutes === 'number' && lesson.duration_minutes > 0) {
                                totalSeconds += lesson.duration_minutes;
                                return;
                            }

                            if (lesson.video_url && !isStreamingUrl(lesson.video_url)) {
                                const realDuration = await probeVideoDuration(lesson.video_url);
                                if (realDuration !== null) {
                                    totalSeconds += realDuration;
                                    // Auto-correct stale DB values
                                    if (lesson.duration_minutes !== realDuration) {
                                        lessonsToUpdate.push({ id: lesson.id, duration_minutes: realDuration });
                                    }
                                    return;
                                }
                            }
                            // Fallback to DB value for streaming or failed probes
                            totalSeconds += (lesson.duration_minutes || 0);
                        })
                    );

                    return {
                        ...course,
                        lesson_count: count,
                        rating: parseFloat(getRandomRating()),
                        duration: formatTotalDuration(totalSeconds),
                        instructor: {
                            full_name: course.instructor?.full_name || 'Merakí Expert'
                        }
                    };
                })
            );

            setCourses(enrichedCourses);

            if (lessonsToUpdate.length > 0) {
                (supabase as any).rpc('update_lesson_durations', { payload: lessonsToUpdate }).then(() => {}).catch((err: any) => console.error('Batch update failed:', err));
            }
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
                    {/* Header */}
                    <View style={styles.headerContainer}>
                        <View style={styles.headerRow}>
                            <MerakiText variant="h1" style={styles.headerTitle}>Academy</MerakiText>
                        </View>
                    </View>

                    {/* Search Bar */}
                    <View style={styles.searchContainer}>
                        <View style={styles.searchInner}>
                            <MaterialIcons name="search" size={22} color={colors.textMuted} />
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Search courses, topics..."
                                placeholderTextColor={colors.textMuted}
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                            />
                            {searchQuery.length > 0 && (
                                <TouchableOpacity
                                    accessibilityRole="button"
                                    accessibilityLabel="Close" onPress={() => setSearchQuery('')}>
                                    <MaterialIcons name="close" size={18} color={colors.textMuted} />
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>

                    {/* Course Cards — Beauty Bay Pastel Banner Style */}
                    {filteredCourses.length === 0 ? (
                        <View style={styles.emptyCard}>
                            <MerakiText style={styles.emptyEmoji}>{searchQuery.trim() ? '🔍' : '📚'}</MerakiText>
                            <MerakiText variant="h3" align="center" style={{ color: colors.text }}>
                                {searchQuery.trim() ? 'No results found' : 'No courses yet'}
                            </MerakiText>
                            <MerakiText variant="body" align="center" color={colors.textMuted} style={{ marginTop: 4 }}>
                                {searchQuery.trim()
                                    ? 'Try a different search term'
                                    : 'Check back soon for new content!'}
                            </MerakiText>
                        </View>
                    ) : (
                        <View style={styles.coursesContainer}>
                            {filteredCourses.map((course, index) => {
                                const isEnrolled = enrolledCourseIds.has(course.id);
                                const gradient = getGradientForIndex(index);
                                return (
                                    <TouchableOpacity
                                        key={course.id}
                                        onPress={() => handleCoursePress(course)}
                                        activeOpacity={0.85}
                                        style={styles.courseCardWrapper}
                                    >
                                        <View style={styles.courseCard}>
                                            {/* Blurred background image (when available) */}
                                            {course.thumbnail_url?.startsWith('http') && (
                                                <Image
                                                    source={{ uri: course.thumbnail_url }}
                                                    style={StyleSheet.absoluteFillObject}
                                                    resizeMode="cover"
                                                    blurRadius={20}
                                                />
                                            )}

                                            {/* Gradient overlay for text readability */}
                                            <LinearGradient
                                                colors={
                                                    course.thumbnail_url?.startsWith('http')
                                                        ? ['rgba(255,255,255,0.95)', 'rgba(255,255,255,0.6)', 'rgba(255,255,255,0.05)']
                                                        : gradient
                                                }
                                                start={{ x: 0, y: 0 }}
                                                end={{ x: 1, y: 0 }}
                                                style={StyleSheet.absoluteFillObject}
                                            />

                                            {/* Text content */}
                                            <View style={styles.courseTextContent}>
                                                <MerakiText style={styles.courseTitle} numberOfLines={2}>
                                                    {course.title}
                                                </MerakiText>
                                                <View style={styles.courseMetaRow}>
                                                    <MerakiText style={styles.courseMeta}>
                                                        {course.lesson_count} lessons · {course.duration}
                                                    </MerakiText>
                                                    {isEnrolled ? (
                                                        <View style={styles.enrolledPill}>
                                                            <MerakiText style={styles.enrolledPillText}>ENROLLED</MerakiText>
                                                        </View>
                                                    ) : (
                                                        <MerakiText style={styles.coursePrice}>
                                                            {course.price > 0 ? `€${course.price}` : 'FREE'}
                                                        </MerakiText>
                                                    )}
                                                </View>
                                            </View>

                                            {/* Sharp thumbnail on right side */}
                                            {course.thumbnail_url?.startsWith('http') && (
                                                <Image
                                                    source={{ uri: course.thumbnail_url }}
                                                    style={styles.courseThumbnail}
                                                    resizeMode="cover"
                                                />
                                            )}
                                        </View>
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
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.md,
        paddingBottom: spacing.md,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    headerTitle: {
        color: colors.text,
        fontSize: 28,
        fontWeight: '700',
    },
    myLearningButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(0, 0, 0, 0.04)',
        alignItems: 'center',
        justifyContent: 'center',
    },

    // Search
    searchContainer: {
        paddingHorizontal: spacing.lg,
        marginBottom: spacing.lg,
    },
    searchInner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F5F5F5',
        borderRadius: 24,
        paddingHorizontal: 16,
        height: 46,
        gap: 10,
    },
    searchInput: {
        flex: 1,
        fontSize: 15,
        color: colors.text,
    },

    // Course Cards — Pastel banners
    coursesContainer: {
        paddingHorizontal: spacing.lg,
        gap: 12,
    },
    courseCardWrapper: {
        borderRadius: 16,
        backgroundColor: '#FFFFFF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
        elevation: 6,
        marginBottom: 8,
    },
    courseCard: {
        flexDirection: 'row',
        alignItems: 'stretch',
        justifyContent: 'space-between',
        minHeight: 110,
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.08)',
    },
    courseTextContent: {
        flex: 1,
        paddingVertical: 18,
        paddingLeft: 20,
        paddingRight: 12,
        justifyContent: 'center',
    },
    courseTitle: {
        fontSize: 18,
        fontWeight: '800',
        fontStyle: 'italic',
        color: '#1A1A1A',
        letterSpacing: 0.5,
        marginBottom: 8,
    },
    courseMetaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    courseMeta: {
        fontSize: 11,
        color: 'rgba(26, 26, 26, 0.50)',
        fontWeight: '500',
    },
    coursePrice: {
        fontSize: 13,
        fontWeight: '700',
        color: '#1A1A1A',
    },
    enrolledPill: {
        backgroundColor: 'rgba(34, 197, 94, 0.15)',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
    },
    enrolledPillText: {
        fontSize: 9,
        fontWeight: '700',
        color: '#16A34A',
        letterSpacing: 0.5,
    },
    courseThumbnail: {
        width: 120,
        minHeight: 100,
    },

    // Empty State
    emptyCard: {
        margin: spacing.lg,
        alignItems: 'center',
        padding: spacing.xxl,
        backgroundColor: '#F9F9F9',
        borderRadius: 12,
    },
    emptyEmoji: {
        fontSize: 64,
        marginBottom: spacing.md,
        opacity: 0.5,
    },
});

export default AcademyHomeScreen;
