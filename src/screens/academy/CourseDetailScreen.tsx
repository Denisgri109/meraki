import React, { useState, useEffect } from 'react';
import {
    View,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { ScreenBackground, MerakiText, Card, Button } from '../../components/ui';
import { colors, spacing, layout, gradients } from '../../theme';

interface Course {
    id: string;
    title: string;
    description: string | null;
    price: number;
    thumbnail_url?: string | null;
    instructor_id?: string | null;
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
    Lesson: {
        lesson: Lesson;
        courseId: string;
        instructorId?: string | null;
        instructorName?: string;
    };
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
            const { data: lessonsData, error } = await (supabase as any)
                .from('lessons')
                .select('*')
                .eq('course_id', course.id)
                .order('order_index', { ascending: true });

            if (error) throw error;

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
            <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
                {/* Header Overlay */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <MerakiText style={styles.backIcon}>←</MerakiText>
                    </TouchableOpacity>
                </View>

                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                    {/* Hero Section */}
                    <View style={styles.heroSection}>
                        <Card variant="glass" style={styles.heroCard} noPadding>
                            <View style={styles.imageContainer}>
                                {course.thumbnail_url ? (
                                    <Image source={{ uri: course.thumbnail_url }} style={styles.heroImage} resizeMode="cover" />
                                ) : (
                                    <LinearGradient
                                        colors={gradients.primary as any}
                                        style={styles.heroImagePlaceholder}
                                    >
                                        <MerakiText style={styles.heroEmoji}>🎓</MerakiText>
                                    </LinearGradient>
                                )}
                                <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} style={styles.imageOverlay} />
                                <View style={styles.heroContent}>
                                    <MerakiText variant="h1" color="#FFF" style={styles.heroTitle}>{course.title}</MerakiText>
                                    <View style={styles.instructorBadge}>
                                        <MerakiText variant="caption" color="rgba(255,255,255,0.9)">
                                            by {course.instructor?.full_name || 'Merakí Expert'}
                                        </MerakiText>
                                    </View>
                                </View>
                            </View>
                        </Card>
                    </View>

                    {/* Stats & Progress Overview */}
                    <View style={styles.overviewSection}>
                        <View style={styles.statsContainer}>
                            <Card variant="glass" style={styles.statCard}>
                                <MerakiText variant="h2" align="center">{lessons.length}</MerakiText>
                                <MerakiText variant="caption" align="center" color={colors.textMuted}>Lessons</MerakiText>
                            </Card>
                            <Card variant="glass" style={styles.statCard}>
                                <MerakiText variant="h2" align="center">{getTotalDuration()}</MerakiText>
                                <MerakiText variant="caption" align="center" color={colors.textMuted}>Min</MerakiText>
                            </Card>
                            <Card variant="glass" style={styles.statCard}>
                                <MerakiText variant="h2" align="center">{getOverallProgress()}%</MerakiText>
                                <MerakiText variant="caption" align="center" color={colors.textMuted}>Done</MerakiText>
                            </Card>
                        </View>

                        {/* Progress Tracker */}
                        <Card variant="glass" style={styles.progressCard}>
                            <View style={styles.progressHeader}>
                                <MerakiText variant="bodyBold">Overall Progress</MerakiText>
                                <MerakiText variant="body" color={colors.accent}>{getOverallProgress()}%</MerakiText>
                            </View>
                            <View style={styles.progressBar}>
                                <LinearGradient
                                    colors={gradients.accent as any}
                                    style={[styles.progressFill, { width: `${getOverallProgress()}%` }]}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                />
                            </View>
                        </Card>

                        {course.description && (
                            <View style={styles.descriptionSection}>
                                <MerakiText variant="h3" style={styles.sectionTitle}>About Course</MerakiText>
                                <MerakiText variant="body" color={colors.textSecondary} style={styles.description}>
                                    {course.description}
                                </MerakiText>
                            </View>
                        )}
                    </View>

                    {/* Lessons List */}
                    <View style={styles.lessonsSection}>
                        <MerakiText variant="h3" style={[styles.sectionTitle, { paddingHorizontal: spacing.lg }]}>
                            Course Curriculum
                        </MerakiText>

                        {loading ? (
                            <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xl }} />
                        ) : (
                            <View style={styles.lessonsList}>
                                {lessons.map((lesson, index) => {
                                    const lessonProgress = progress[lesson.id] || 0;
                                    const isCompleted = lessonProgress === 100;

                                    return (
                                        <TouchableOpacity
                                            key={lesson.id}
                                            activeOpacity={0.8}
                                            onPress={() => navigation.navigate('Lesson', {
                                                lesson,
                                                courseId: course.id,
                                                instructorId: course.instructor_id,
                                                instructorName: course.instructor?.full_name
                                            })}
                                        >
                                            <Card variant="glass" style={styles.lessonCard} noPadding>
                                                <View style={styles.lessonRow}>
                                                    <View style={[
                                                        styles.lessonNumber,
                                                        isCompleted ? styles.completedCircle : styles.pendingCircle
                                                    ]}>
                                                        {isCompleted ? (
                                                            <MerakiText style={styles.checkmark}>✓</MerakiText>
                                                        ) : (
                                                            <MerakiText variant="bodyBold" color={colors.primary}>
                                                                {index + 1}
                                                            </MerakiText>
                                                        )}
                                                    </View>
                                                    <View style={styles.lessonInfo}>
                                                        <MerakiText variant="bodyBold" numberOfLines={1}>
                                                            {lesson.title}
                                                        </MerakiText>
                                                        <View style={styles.lessonMeta}>
                                                            {!!lesson.duration_minutes && (
                                                                <MerakiText variant="caption" color={colors.textMuted}>
                                                                    ⏱️ {lesson.duration_minutes} min
                                                                </MerakiText>
                                                            )}
                                                            {lesson.has_homework && (
                                                                <MerakiText variant="caption" color={colors.accent}>
                                                                    📝 Homework
                                                                </MerakiText>
                                                            )}
                                                        </View>
                                                    </View>
                                                    <MerakiText style={styles.arrowIcon}>›</MerakiText>
                                                </View>
                                            </Card>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        )}
                    </View>
                </ScrollView>
            </SafeAreaView>
        </ScreenBackground>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 120,
    },
    header: {
        position: 'absolute',
        top: 60,
        left: spacing.lg,
        zIndex: 10,
    },
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
    backIcon: {
        fontSize: 24,
        color: colors.text,
    },

    // Hero
    heroSection: {
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.md,
        marginBottom: spacing.lg,
    },
    heroCard: {
        borderRadius: layout.borderRadius.xl,
        overflow: 'hidden',
    },
    imageContainer: {
        height: 300,
        width: '100%',
    },
    heroImage: {
        width: '100%',
        height: '100%',
    },
    heroImagePlaceholder: {
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
    },
    heroEmoji: {
        fontSize: 80,
    },
    imageOverlay: {
        ...StyleSheet.absoluteFillObject,
    },
    heroContent: {
        position: 'absolute',
        bottom: spacing.lg,
        left: spacing.lg,
        right: spacing.lg,
    },
    heroTitle: {
        marginBottom: 8,
    },
    instructorBadge: {
        backgroundColor: 'rgba(255,255,255,0.15)',
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        borderRadius: layout.borderRadius.sm,
        alignSelf: 'flex-start',
    },

    // Overview
    overviewSection: {
        paddingHorizontal: spacing.lg,
    },
    statsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: spacing.lg,
    },
    statCard: {
        flex: 0.3,
        padding: spacing.md,
    },
    progressCard: { padding: spacing.md, marginBottom: spacing.xl },
    progressHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: spacing.sm,
    },
    progressBar: {
        height: 8,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 4,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: 4,
    },
    descriptionSection: {
        marginBottom: spacing.xxl,
    },
    sectionTitle: {
        marginBottom: spacing.md,
        color: colors.text,
    },
    description: {
        lineHeight: 22,
    },

    // Lessons
    lessonsSection: {
        marginTop: spacing.md,
    },
    lessonsList: {
        paddingHorizontal: spacing.lg,
    },
    lessonCard: {
        marginBottom: spacing.md,
        borderRadius: layout.borderRadius.md,
    },
    lessonRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.md,
    },
    lessonNumber: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
    },
    pendingCircle: {
        backgroundColor: 'rgba(139,92,246,0.1)',
        borderColor: 'rgba(139,92,246,0.2)',
    },
    completedCircle: {
        backgroundColor: colors.success,
        borderColor: colors.success,
    },
    checkmark: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: 'bold',
    },
    lessonInfo: {
        flex: 1,
        marginLeft: spacing.md,
    },
    lessonMeta: {
        flexDirection: 'row',
        marginTop: 4,
        gap: spacing.md,
    },
    arrowIcon: {
        fontSize: 24,
        color: colors.textMuted,
        marginLeft: spacing.sm,
    },
});

export default CourseDetailScreen;
