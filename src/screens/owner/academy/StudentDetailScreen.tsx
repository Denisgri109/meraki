import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Image,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { supabase } from '../../../lib/supabase';
import { ScreenBackground } from '../../../components/ui';
import { colors, spacing } from '../../../theme';
import { formatDistanceToNow, format } from 'date-fns';

interface LessonProgress {
    lesson_id: string;
    completed_at: string;
    lesson: {
        title: string;
        chapter: { title: string };
    };
}

export function StudentDetailScreen() {
    const navigation = useNavigation();
    const route = useRoute<any>();
    const { enrollment } = route.params;
    const [loading, setLoading] = useState(true);
    const [progressDetails, setProgressDetails] = useState<LessonProgress[]>([]);

    useEffect(() => {
        fetchProgressDetails();
    }, []);

    const fetchProgressDetails = async () => {
        try {
            const { data, error } = await (supabase as any)
                .from('lesson_progress')
                .select(`
                    *,
                    lesson:lesson_id (
                        title,
                        chapter:chapter_id (title)
                    )
                `)
                .eq('user_id', enrollment.student_id)
                .not('completed_at', 'is', null)
                .order('completed_at', { ascending: false });

            if (error) throw error;

            // Filter to only include lessons from this course
            // Since we can't easily join up to course in one query without complex RLS/views sometimes
            // We'll fetch course lessons first to filter efficiently if needed, 
            // but for now let's hope the lesson->chapter->course link is consistent.
            // Actually, best to just show "Recent Activity" which might include other courses? 
            // No, the user expects to see progress for THIS course.

            // Let's filter client-side for safety if we can't easily do it in query without deep nesting
            // But we don't have course_id in lesson_progress. 
            // We need to verify these lessons belong to the enrolled course.
            const { data: courseLessons } = await (supabase as any)
                .from('lessons')
                .select('id')
                .eq('course_id', enrollment.course.id);

            const courseLessonIds = new Set(courseLessons?.map((l: any) => l.id));
            const filteredProgress = data.filter((p: any) => courseLessonIds.has(p.lesson_id));

            setProgressDetails(filteredProgress);
        } catch (error) {
            console.error('Error fetching progress:', error);
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
                    <Text style={styles.headerTitle}>Student Details</Text>
                    <View style={{ width: 40 }} />
                </View>

                <ScrollView contentContainerStyle={styles.content}>
                    {/* Student Profile Card */}
                    <View style={styles.card}>
                        <View style={styles.profileHeader}>
                            <View style={styles.avatar}>
                                {enrollment.student?.avatar_url ? (
                                    <Image
                                        source={{ uri: enrollment.student.avatar_url }}
                                        style={styles.avatarImage}
                                    />
                                ) : (
                                    <Text style={styles.avatarText}>
                                        {enrollment.student?.full_name?.[0] || '?'}
                                    </Text>
                                )}
                            </View>
                            <View style={styles.profileInfo}>
                                <Text style={styles.studentName}>{enrollment.student?.full_name}</Text>
                                <Text style={styles.studentId}>ID: {enrollment.student?.id.slice(0, 8)}</Text>
                            </View>
                        </View>

                        <View style={styles.divider} />

                        <View style={styles.statsRow}>
                            <View style={styles.statItem}>
                                <Text style={styles.statLabel}>Enrolled</Text>
                                <Text style={styles.statValue}>
                                    {format(new Date(enrollment.enrolled_at), 'MMM d, yyyy')}
                                </Text>
                            </View>
                            <View style={styles.statItem}>
                                <Text style={styles.statLabel}>Last Active</Text>
                                <Text style={styles.statValue}>
                                    {formatDistanceToNow(new Date(enrollment.lastActive || enrollment.enrolled_at), { addSuffix: true })}
                                </Text>
                            </View>
                        </View>
                    </View>

                    {/* Course Progress Card */}
                    <Text style={styles.sectionTitle}>Course Progress</Text>
                    <View style={styles.card}>
                        <Text style={styles.courseTitle}>{enrollment.course?.title}</Text>
                        <View style={styles.progressContainer}>
                            <View style={styles.progressBar}>
                                <View
                                    style={[
                                        styles.progressFill,
                                        { width: `${enrollment.progress}%` }
                                    ]}
                                />
                            </View>
                            <Text style={styles.progressText}>{enrollment.progress}% Complete</Text>
                        </View>
                    </View>

                    {/* Lesson History */}
                    <Text style={styles.sectionTitle}>Completed Lessons ({progressDetails.length})</Text>
                    {loading ? (
                        <ActivityIndicator size="small" color={colors.primary} />
                    ) : progressDetails.length > 0 ? (
                        <View style={styles.timeline}>
                            {progressDetails.map((item, index) => (
                                <View key={item.lesson_id} style={styles.timelineItem}>
                                    <View style={styles.timelineLeft}>
                                        <View style={styles.timelineDot} />
                                        {index < progressDetails.length - 1 && <View style={styles.timelineLine} />}
                                    </View>
                                    <View style={styles.timelineContent}>
                                        <Text style={styles.lessonTitle}>{item.lesson?.title}</Text>
                                        <Text style={styles.chapterTitle}>{item.lesson?.chapter?.title}</Text>
                                        <Text style={styles.completedDate}>
                                            Completed {format(new Date(item.completed_at), 'MMM d, h:mm a')}
                                        </Text>
                                    </View>
                                </View>
                            ))}
                        </View>
                    ) : (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyText}>No lessons completed yet.</Text>
                        </View>
                    )}
                </ScrollView>
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
        borderRadius: 16,
        padding: spacing.md,
        marginBottom: spacing.lg,
        borderWidth: 1,
        borderColor: colors.border,
    },
    profileHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    avatar: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: 'rgba(139,92,246,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: spacing.md,
    },
    avatarImage: { width: 60, height: 60, borderRadius: 30 },
    avatarText: { fontSize: 24, fontWeight: '600', color: colors.primary },
    profileInfo: { flex: 1 },
    studentName: { fontSize: 18, fontWeight: '700', color: colors.text },
    studentId: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
    divider: { height: 1, backgroundColor: colors.border, marginBottom: spacing.md },
    statsRow: { flexDirection: 'row', justifyContent: 'space-between' },
    statItem: { flex: 1 },
    statLabel: { fontSize: 12, color: colors.textMuted, marginBottom: 4 },
    statValue: { fontSize: 14, fontWeight: '600', color: colors.text },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.text,
        marginBottom: spacing.sm,
        marginTop: spacing.sm
    },
    courseTitle: { fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: spacing.md },
    progressContainer: { gap: 8 },
    progressBar: {
        height: 8,
        backgroundColor: colors.border,
        borderRadius: 4,
        overflow: 'hidden',
    },
    progressFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 4 },
    progressText: { fontSize: 12, color: colors.textMuted, textAlign: 'right' },
    timeline: {
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: colors.border,
    },
    timelineItem: { flexDirection: 'row', marginBottom: spacing.md },
    timelineLeft: { alignItems: 'center', marginRight: spacing.md, width: 20 },
    timelineDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: colors.success,
        borderWidth: 2,
        borderColor: colors.surface,
        zIndex: 1,
    },
    timelineLine: {
        width: 2,
        flex: 1,
        backgroundColor: colors.border,
        position: 'absolute',
        top: 12,
        bottom: -20, // Connect to next item
    },
    timelineContent: { flex: 1, paddingBottom: 4 },
    lessonTitle: { fontSize: 14, fontWeight: '600', color: colors.text },
    chapterTitle: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
    completedDate: { fontSize: 11, color: colors.textMuted, marginTop: 4 },
    emptyState: { padding: spacing.xl, alignItems: 'center' },
    emptyText: { color: colors.textMuted },
});

export default StudentDetailScreen;
