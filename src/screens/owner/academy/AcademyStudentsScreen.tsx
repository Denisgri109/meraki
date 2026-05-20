import React, { useState, useCallback } from 'react';
import {
    View,
    StyleSheet,
    FlatList,
    Image,
    RefreshControl,
    TouchableOpacity,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { formatDistanceToNow } from 'date-fns';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../../../lib/supabase';
import { ScreenBackground, MerakiText } from '../../../components/ui';
import { colors, spacing } from '../../../theme';

interface StudentEnrollment {
    id: string;
    enrolled_at: string;
    completed_at: string | null;
    student: { id: string; full_name: string; avatar_url: string | null };
    course: { id: string; title: string };
    progress: number;
    lastActive: string | null;
}

interface Analytics {
    totalRevenue: number;
    monthlyRevenue: number;
    totalStudents: number;
    completionRate: number;
}

export function AcademyStudentsScreen() {
    const navigation = useNavigation<any>();
    const [enrollments, setEnrollments] = useState<StudentEnrollment[]>([]);
    const [analytics, setAnalytics] = useState<Analytics>({
        totalRevenue: 0,
        monthlyRevenue: 0,
        totalStudents: 0,
        completionRate: 0,
    });
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchData = async () => {
        try {
            const { data: enrollmentData, error } = await (supabase as any)
                .from('course_enrollments')
                .select(`
                    *,
                    student:student_id(id, full_name, avatar_url),
                    course:course_id(id, title)
                `)
                .order('enrolled_at', { ascending: false });

            if (error) throw error;

            // Extract unique courses and students
            const courseIds = [...new Set((enrollmentData || []).map((e: any) => e.course_id))];
            const studentIds = [...new Set((enrollmentData || []).map((e: any) => e.student_id))];

            // Fetch all lessons for these courses in one query
            const { data: allLessons } = await (supabase as any)
                .from('lessons')
                .select('id, course_id')
                .in('course_id', courseIds.length > 0 ? courseIds : ['no-match']);

            // Group lessons by course_id
            const lessonsByCourse = (allLessons || []).reduce((acc: any, lesson: any) => {
                if (!acc[lesson.course_id]) acc[lesson.course_id] = [];
                acc[lesson.course_id].push(lesson.id);
                return acc;
            }, {});

            const allLessonIds = (allLessons || []).map((l: any) => l.id);

            // Fetch all progress for these students and lessons in one query
            const { data: allProgress } = await (supabase as any)
                .from('lesson_progress')
                .select('user_id, lesson_id, completed_at, updated_at')
                .in('user_id', studentIds.length > 0 ? studentIds : ['no-match'])
                .in('lesson_id', allLessonIds.length > 0 ? allLessonIds : ['no-match']);

            // Group progress by user_id
            const progressByUser = (allProgress || []).reduce((acc: any, prog: any) => {
                if (!acc[prog.user_id]) acc[prog.user_id] = { completed: new Set(), latestUpdate: null };

                if (prog.completed_at) {
                    acc[prog.user_id].completed.add(prog.lesson_id);
                }

                if (prog.updated_at) {
                    const updateDate = new Date(prog.updated_at).getTime();
                    const currentLatest = acc[prog.user_id].latestUpdate ? new Date(acc[prog.user_id].latestUpdate).getTime() : 0;
                    if (updateDate > currentLatest) {
                        acc[prog.user_id].latestUpdate = prog.updated_at;
                    }
                }

                return acc;
            }, {});

            const enrichedEnrollments = (enrollmentData || []).map((enrollment: any) => {
                const courseLessonIds = lessonsByCourse[enrollment.course_id] || [];
                const totalLessonsCount = courseLessonIds.length;

                const userProg = progressByUser[enrollment.student_id] || { completed: new Set(), latestUpdate: null };

                // Count how many of THIS course's lessons the user has completed
                let completedLessonsCount = 0;
                for (const lid of courseLessonIds) {
                    if (userProg.completed.has(lid)) {
                        completedLessonsCount++;
                    }
                }

                const progress = totalLessonsCount > 0
                    ? Math.min(Math.round((completedLessonsCount / totalLessonsCount) * 100), 100)
                    : 0;

                return {
                    ...enrollment,
                    progress,
                    lastActive: userProg.latestUpdate || enrollment.enrolled_at,
                };
            });

            setEnrollments(enrichedEnrollments);

            const { count: totalStudents } = await (supabase as any)
                .from('course_enrollments')
                .select('*', { count: 'exact', head: true });

            const { data: courses } = await (supabase as any)
                .from('courses')
                .select('id, price');

            const totalRevenue = enrichedEnrollments.reduce((sum: number, e: any) => {
                const course = courses?.find((c: any) => c.id === e.course?.id);
                return sum + (course?.price || 0);
            }, 0);

            const completed = enrichedEnrollments.filter((e: any) => e.completed_at).length;
            const completionRate = enrichedEnrollments.length > 0
                ? Math.round((completed / enrichedEnrollments.length) * 100)
                : 0;

            setAnalytics({
                totalRevenue,
                monthlyRevenue: totalRevenue * 0.3,
                totalStudents: totalStudents || 0,
                completionRate,
            });

        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchData();
        }, [])
    );

    const onRefresh = () => {
        setRefreshing(true);
        fetchData();
    };

    const renderStudent = ({ item }: { item: StudentEnrollment }) => (
        <TouchableOpacity
            style={styles.studentCard}
            onPress={() => navigation.navigate('StudentDetail', { enrollment: item })}
        >
            <View style={styles.avatar}>
                {item.student?.avatar_url ? (
                    <Image source={{ uri: item.student.avatar_url }} style={styles.avatarImage} />
                ) : (
                    <MerakiText variant="h3" color={colors.primary}>
                        {item.student?.full_name?.[0] || '?'}
                    </MerakiText>
                )}
            </View>
            <View style={styles.studentInfo}>
                <MerakiText variant="body" style={styles.studentName}>{item.student?.full_name}</MerakiText>
                <MerakiText variant="caption" style={styles.courseName}>{item.course?.title}</MerakiText>
                <View style={styles.progressRow}>
                    <View style={styles.progressBar}>
                        <View style={[styles.progressFill, { width: `${item.progress}%` }]} />
                    </View>
                    <MerakiText variant="caption" style={styles.progressText}>{item.progress}%</MerakiText>
                </View>
            </View>
            <View style={styles.studentMeta}>
                <MerakiText variant="caption" style={styles.lastActive}>
                    {formatDistanceToNow(new Date(item.lastActive || item.enrolled_at), { addSuffix: true })}
                </MerakiText>
                {item.completed_at && (
                    <View style={styles.completedBadge}>
                        <MaterialCommunityIcons name="check" size={12} color="#fff" />
                    </View>
                )}
            </View>
        </TouchableOpacity>
    );

    return (
        <ScreenBackground>
            <View style={styles.container}>
                <FlatList
                    data={enrollments}
                    keyExtractor={(item) => item.id}
                    renderItem={renderStudent}
                    contentContainerStyle={styles.list}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} />
                    }
                    ListHeaderComponent={
                        <View style={styles.analyticsSection}>
                            <View style={styles.analyticsRow}>
                                <View style={styles.analyticsCard}>
                                    <MerakiText variant="h2" color={colors.text}>€{analytics.totalRevenue.toFixed(0)}</MerakiText>
                                    <MerakiText variant="caption" color={colors.textMuted} style={{ marginTop: 4 }}>Total Revenue</MerakiText>
                                </View>
                                <View style={styles.analyticsCard}>
                                    <MerakiText variant="h2" color={colors.text}>{analytics.totalStudents}</MerakiText>
                                    <MerakiText variant="caption" color={colors.textMuted} style={{ marginTop: 4 }}>Students</MerakiText>
                                </View>
                                <View style={styles.analyticsCard}>
                                    <MerakiText variant="h2" color={colors.text}>{analytics.completionRate}%</MerakiText>
                                    <MerakiText variant="caption" color={colors.textMuted} style={{ marginTop: 4 }}>Completion</MerakiText>
                                </View>
                            </View>
                            <MerakiText variant="caption" style={styles.sectionTitle}>Enrolled Students</MerakiText>
                        </View>
                    }
                    ListEmptyComponent={
                        <View style={styles.empty}>
                            <MaterialCommunityIcons name="account-group" size={48} color={colors.textMuted} style={{ marginBottom: spacing.md }} />
                            <MerakiText variant="h3" color={colors.text}>No Students Yet</MerakiText>
                            <MerakiText variant="body" color={colors.textMuted} style={{ marginTop: 4 }}>Students will appear here when they enroll</MerakiText>
                        </View>
                    }
                />
            </View>
        </ScreenBackground>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: 'transparent' },
    list: { padding: spacing.lg, paddingBottom: 100 },
    analyticsSection: { marginBottom: spacing.md },
    analyticsRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg },
    analyticsCard: {
        flex: 1,
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: spacing.md,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.border,
    },
    sectionTitle: {
        fontWeight: '600',
        color: colors.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    studentCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: spacing.md,
        marginBottom: spacing.md,
        borderWidth: 1,
        borderColor: colors.border,
    },
    avatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(139,92,246,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: spacing.md,
    },
    avatarImage: { width: 44, height: 44, borderRadius: 22 },
    studentInfo: { flex: 1 },
    studentName: { fontWeight: '600', color: colors.text },
    courseName: { color: colors.textMuted, marginTop: 2 },
    progressRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: spacing.sm },
    progressBar: {
        flex: 1,
        height: 6,
        backgroundColor: colors.border,
        borderRadius: 3,
        overflow: 'hidden',
    },
    progressFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 3 },
    progressText: { fontWeight: '600', color: colors.textMuted, width: 35 },
    studentMeta: { alignItems: 'flex-end' },
    lastActive: { color: colors.textMuted },
    completedBadge: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: colors.success,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 4,
    },
    empty: { alignItems: 'center', paddingTop: 40 },
});

export default AcademyStudentsScreen;
