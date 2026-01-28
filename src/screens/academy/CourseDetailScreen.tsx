import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { ScreenBackground, Button } from '../../components/ui';
import { colors, spacing } from '../../theme';

interface Course {
    id: string;
    title: string;
    description: string | null;
    price: number;
    instructor?: { full_name: string } | null;
}

interface Lesson {
    id: string;
    title: string;
    description: string | null;
    duration_minutes: number | null;
    order_index: number;
    has_homework: boolean;
    progress?: number;
}

type AcademyStackParamList = {
    AcademyHome: undefined;
    CourseDetail: { course: Course };
    Lesson: { lesson: Lesson; courseId: string };
};

export function CourseDetailScreen() {
    const navigation = useNavigation<any>();
    const route = useRoute<RouteProp<AcademyStackParamList, 'CourseDetail'>>();
    const { user } = useAuth();
    const { course } = route.params;

    const [loading, setLoading] = useState(true);
    const [lessons, setLessons] = useState<Lesson[]>([]);
    const [progress, setProgress] = useState<{ [lessonId: string]: number }>({});

    useEffect(() => {
        fetchLessons();
    }, []);

    const fetchLessons = async () => {
        try {
            // Get lessons
            const { data: lessonsData, error } = await (supabase as any)
                .from('lessons')
                .select('*')
                .eq('course_id', course.id)
                .order('order_index', { ascending: true });

            if (error) throw error;

            // Get progress for each lesson
            if (user) {
                const { data: progressData } = await (supabase as any)
                    .from('lesson_progress')
                    .select('lesson_id, progress_percent')
                    .eq('user_id', user.id)
                    .in('lesson_id', (lessonsData || []).map((l: Lesson) => l.id));

                const progressMap: { [key: string]: number } = {};
                (progressData || []).forEach((p: any) => {
                    progressMap[p.lesson_id] = p.progress_percent;
                });
                setProgress(progressMap);
            }

            setLessons(lessonsData || []);
        } catch (error) {
            console.error('Error fetching lessons:', error);
        } finally {
            setLoading(false);
        }
    };

    const getOverallProgress = () => {
        if (lessons.length === 0) return 0;
        const totalProgress = lessons.reduce((acc, lesson) => acc + (progress[lesson.id] || 0), 0);
        return Math.round(totalProgress / lessons.length);
    };

    const getTotalDuration = () => {
        return lessons.reduce((acc, lesson) => acc + (lesson.duration_minutes || 0), 0);
    };

    return (
        <ScreenBackground>
            <SafeAreaView style={styles.container} edges={['top']}>
                <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                    {/* Header */}
                    <View style={styles.header}>
                        <TouchableOpacity onPress={() => navigation.goBack()}>
                            <Text style={styles.backButton}>←</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Course Hero */}
                    <LinearGradient
                        colors={['rgba(139,92,246,0.2)', 'rgba(59,130,246,0.2)']}
                        style={styles.hero}
                    >
                        <Text style={styles.heroEmoji}>📖</Text>
                    </LinearGradient>

                    {/* Course Info */}
                    <View style={styles.courseInfo}>
                        <Text style={styles.courseTitle}>{course.title}</Text>
                        <Text style={styles.courseInstructor}>
                            by {course.instructor?.full_name || 'Merakí Academy'}
                        </Text>

                        {course.description && (
                            <Text style={styles.courseDescription}>{course.description}</Text>
                        )}

                        {/* Stats */}
                        <View style={styles.statsRow}>
                            <View style={styles.stat}>
                                <Text style={styles.statValue}>{lessons.length}</Text>
                                <Text style={styles.statLabel}>Lessons</Text>
                            </View>
                            <View style={styles.stat}>
                                <Text style={styles.statValue}>{getTotalDuration()}</Text>
                                <Text style={styles.statLabel}>Minutes</Text>
                            </View>
                            <View style={styles.stat}>
                                <Text style={styles.statValue}>{getOverallProgress()}%</Text>
                                <Text style={styles.statLabel}>Complete</Text>
                            </View>
                        </View>

                        {/* Progress Bar */}
                        <View style={styles.progressContainer}>
                            <View style={styles.progressBar}>
                                <View style={[styles.progressFill, { width: `${getOverallProgress()}%` }]} />
                            </View>
                        </View>
                    </View>

                    {/* Lessons List */}
                    <Text style={styles.sectionTitle}>Course Content</Text>

                    {loading ? (
                        <ActivityIndicator size="large" color={colors.text} style={{ marginTop: spacing.xl }} />
                    ) : (
                        <View style={styles.lessonsList}>
                            {lessons.map((lesson, index) => {
                                const lessonProgress = progress[lesson.id] || 0;
                                const isCompleted = lessonProgress === 100;

                                return (
                                    <TouchableOpacity
                                        key={lesson.id}
                                        style={styles.lessonCard}
                                        onPress={() => navigation.navigate('Lesson', { lesson, courseId: course.id })}
                                    >
                                        <View style={[
                                            styles.lessonNumber,
                                            isCompleted && styles.lessonNumberCompleted
                                        ]}>
                                            {isCompleted ? (
                                                <Text style={styles.lessonCheckmark}>✓</Text>
                                            ) : (
                                                <Text style={styles.lessonNumberText}>{index + 1}</Text>
                                            )}
                                        </View>
                                        <View style={styles.lessonInfo}>
                                            <Text style={styles.lessonTitle}>{lesson.title}</Text>
                                            <View style={styles.lessonMeta}>
                                                {lesson.duration_minutes && (
                                                    <Text style={styles.lessonDuration}>
                                                        ⏱️ {lesson.duration_minutes} min
                                                    </Text>
                                                )}
                                                {lesson.has_homework && (
                                                    <Text style={styles.lessonHomework}>📝 Homework</Text>
                                                )}
                                            </View>
                                        </View>
                                        <Text style={styles.lessonArrow}>›</Text>
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
    container: { flex: 1 },
    content: { paddingBottom: 100 },
    header: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
    backButton: { fontSize: 28, color: colors.text },
    hero: {
        height: 200,
        marginHorizontal: spacing.lg,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.lg,
    },
    heroEmoji: { fontSize: 80 },
    courseInfo: { paddingHorizontal: spacing.lg, marginBottom: spacing.xl },
    courseTitle: { fontSize: 28, fontWeight: '700', color: colors.text, marginBottom: 4 },
    courseInstructor: { fontSize: 14, color: colors.primary, marginBottom: spacing.md },
    courseDescription: { fontSize: 14, color: colors.textSecondary, lineHeight: 22 },
    statsRow: { flexDirection: 'row', marginTop: spacing.lg, gap: spacing.lg },
    stat: { flex: 1, alignItems: 'center' },
    statValue: { fontSize: 24, fontWeight: '700', color: colors.text },
    statLabel: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
    progressContainer: { marginTop: spacing.lg },
    progressBar: {
        height: 8,
        backgroundColor: colors.surface,
        borderRadius: 4,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        backgroundColor: colors.primary,
        borderRadius: 4,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.textSecondary,
        marginHorizontal: spacing.lg,
        marginBottom: spacing.md,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    lessonsList: { paddingHorizontal: spacing.lg },
    lessonCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: spacing.md,
        marginBottom: spacing.sm,
        borderWidth: 1,
        borderColor: colors.border,
    },
    lessonNumber: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(139,92,246,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    lessonNumberCompleted: { backgroundColor: colors.success },
    lessonNumberText: { color: colors.primary, fontWeight: '600' },
    lessonCheckmark: { color: colors.text, fontWeight: '700' },
    lessonInfo: { flex: 1, marginLeft: spacing.md },
    lessonTitle: { fontSize: 14, fontWeight: '600', color: colors.text },
    lessonMeta: { flexDirection: 'row', marginTop: 4, gap: spacing.md },
    lessonDuration: { fontSize: 12, color: colors.textMuted },
    lessonHomework: { fontSize: 12, color: colors.primary },
    lessonArrow: { fontSize: 20, color: colors.textMuted },
});

export default CourseDetailScreen;
