import React, { useState, useEffect } from 'react';
import {
    View,
    StyleSheet,
    Image,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../../../lib/supabase';
import { ScreenBackground, MerakiText } from '../../../components/ui';
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
                    <TouchableOpacity onPress={() => navigation.goBack()} style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
                        <MerakiText variant="body" color={colors.text} style={{ marginLeft: 4 }}>Back</MerakiText>
                    </TouchableOpacity>
                    <MerakiText variant="h3" style={styles.headerTitle}>Student Details</MerakiText>
                    <View style={{ width: 60 }} />
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
                                    <MerakiText variant="h3" color={colors.primary}>
                                        {enrollment.student?.full_name?.[0] || '?'}
                                    </MerakiText>
                                )}
                            </View>
                            <View style={styles.profileInfo}>
                                <MerakiText variant="h3" style={styles.studentName}>{enrollment.student?.full_name}</MerakiText>
                                <MerakiText variant="caption" style={styles.studentId}>ID: {enrollment.student?.id.slice(0, 8)}</MerakiText>
                            </View>
                        </View>

                        <View style={styles.divider} />

                        <View style={styles.statsRow}>
                            <View style={styles.statItem}>
                                <MerakiText variant="caption" style={styles.statLabel}>Enrolled</MerakiText>
                                <MerakiText variant="body" style={styles.statValue}>
                                    {format(new Date(enrollment.enrolled_at), 'MMM d, yyyy')}
                                </MerakiText>
                            </View>
                            <View style={styles.statItem}>
                                <MerakiText variant="caption" style={styles.statLabel}>Last Active</MerakiText>
                                <MerakiText variant="body" style={styles.statValue}>
                                    {formatDistanceToNow(new Date(enrollment.lastActive || enrollment.enrolled_at), { addSuffix: true })}
                                </MerakiText>
                            </View>
                        </View>
                    </View>

                    {/* Course Progress Card */}
                    <MerakiText variant="body" style={styles.sectionTitle}>Course Progress</MerakiText>
                    <View style={styles.card}>
                        <MerakiText variant="body" style={styles.courseTitle}>{enrollment.course?.title}</MerakiText>
                        <View style={styles.progressContainer}>
                            <View style={styles.progressBar}>
                                <View
                                    style={[
                                        styles.progressFill,
                                        { width: `${enrollment.progress}%` }
                                    ]}
                                />
                            </View>
                            <MerakiText variant="caption" style={styles.progressText}>{enrollment.progress}% Complete</MerakiText>
                        </View>
                    </View>

                    {/* Lesson History */}
                    <MerakiText variant="body" style={styles.sectionTitle}>Completed Lessons ({progressDetails.length})</MerakiText>
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
                                        <MerakiText variant="body" style={styles.lessonTitle}>{item.lesson?.title}</MerakiText>
                                        <MerakiText variant="caption" style={styles.chapterTitle}>{item.lesson?.chapter?.title}</MerakiText>
                                        <MerakiText variant="caption" style={styles.completedDate}>
                                            Completed {format(new Date(item.completed_at), 'MMM d, h:mm a')}
                                        </MerakiText>
                                    </View>
                                </View>
                            ))}
                        </View>
                    ) : (
                        <View style={styles.emptyState}>
                            <MerakiText variant="body" style={styles.emptyText}>No lessons completed yet.</MerakiText>
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
    headerTitle: { fontWeight: '600', color: colors.text },
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
    profileInfo: { flex: 1 },
    studentName: { fontWeight: '700', color: colors.text },
    studentId: { color: colors.textMuted, marginTop: 2 },
    divider: { height: 1, backgroundColor: colors.border, marginBottom: spacing.md },
    statsRow: { flexDirection: 'row', justifyContent: 'space-between' },
    statItem: { flex: 1 },
    statLabel: { color: colors.textMuted, marginBottom: 4 },
    statValue: { fontWeight: '600', color: colors.text },
    sectionTitle: {
        fontWeight: '600',
        color: colors.text,
        marginBottom: spacing.sm,
        marginTop: spacing.sm
    },
    courseTitle: { fontWeight: '600', color: colors.text, marginBottom: spacing.md },
    progressContainer: { gap: 8 },
    progressBar: {
        height: 8,
        backgroundColor: colors.border,
        borderRadius: 4,
        overflow: 'hidden',
    },
    progressFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 4 },
    progressText: { color: colors.textMuted, textAlign: 'right' },
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
    lessonTitle: { fontWeight: '600', color: colors.text },
    chapterTitle: { color: colors.textSecondary, marginTop: 2 },
    completedDate: { color: colors.textMuted, marginTop: 4 },
    emptyState: { padding: spacing.xl, alignItems: 'center' },
    emptyText: { color: colors.textMuted },
});

export default StudentDetailScreen;
