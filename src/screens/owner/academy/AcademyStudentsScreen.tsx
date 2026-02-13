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

            const enrichedEnrollments = await Promise.all(
                (enrollmentData || []).map(async (enrollment: any) => {
                    const { data: courseLessons } = await (supabase as any)
                        .from('lessons')
                        .select('id')
                        .eq('course_id', enrollment.course_id);

                    const lessonIds = (courseLessons || []).map((l: any) => l.id);

                    const { count: completedLessons } = await (supabase as any)
                        .from('lesson_progress')
                        .select('*', { count: 'exact', head: true })
                        .eq('user_id', enrollment.student_id)
                        .in('lesson_id', lessonIds.length > 0 ? lessonIds : ['no-match'])
                        .not('completed_at', 'is', null);

                    const { data: lastProgress } = await (supabase as any)
                        .from('lesson_progress')
                        .select('updated_at')
                        .eq('user_id', enrollment.student_id)
                        .order('updated_at', { ascending: false })
                        .limit(1);

                    // Re-fetch total lessons count to be safe (or use courseLessons.length)
                    const totalLessonsCount = courseLessons?.length || 0;

                    const progress = totalLessonsCount > 0
                        ? Math.min(Math.round((completedLessons / totalLessonsCount) * 100), 100)
                        : 0;

                    return {
                        ...enrollment,
                        progress,
                        lastActive: lastProgress?.[0]?.updated_at || enrollment.enrolled_at,
                    };
                })
            );

            setEnrollments(enrichedEnrollments);

            const { count: totalStudents } = await (supabase as any)
                .from('course_enrollments')
                .select('*', { count: 'exact', head: true });

            const { data: courses } = await (supabase as any)
                .from('courses')
                .select('id, price');

            const totalRevenue = enrichedEnrollments.reduce((sum, e) => {
                const course = courses?.find((c: any) => c.id === e.course?.id);
                return sum + (course?.price || 0);
            }, 0);

            const completed = enrichedEnrollments.filter(e => e.completed_at).length;
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
