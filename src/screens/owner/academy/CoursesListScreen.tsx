import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    Image,
    RefreshControl,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../../lib/supabase';
import { ScreenBackground } from '../../../components/ui';
import { colors, spacing } from '../../../theme';

interface Course {
    id: string;
    title: string;
    description: string;
    thumbnail_url: string | null;
    price: number;
    is_published: boolean;
    created_at: string;
    lesson_count?: number;
    enrollment_count?: number;
}

export function CoursesListScreen() {
    const navigation = useNavigation<any>();
    const [courses, setCourses] = useState<Course[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchCourses = async () => {
        try {
            const { data, error } = await (supabase as any)
                .from('courses')
                .select(`
                    *,
                    lessons:lessons(count),
                    enrollments:course_enrollments(count)
                `)
                .order('created_at', { ascending: false });

            if (error) throw error;

            const coursesWithCounts = (data || []).map((c: any) => ({
                ...c,
                lesson_count: c.lessons?.[0]?.count || 0,
                enrollment_count: c.enrollments?.[0]?.count || 0,
            }));
            setCourses(coursesWithCounts);
        } catch (error) {
            console.error('Error fetching courses:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchCourses();
        }, [])
    );

    const onRefresh = () => {
        setRefreshing(true);
        fetchCourses();
    };

    const renderCourse = ({ item }: { item: Course }) => (
        <TouchableOpacity
            style={styles.courseCard}
            onPress={() => navigation.navigate('CourseEditor', { courseId: item.id })}
        >
            <View style={styles.thumbnail}>
                {item.thumbnail_url ? (
                    <Image source={{ uri: item.thumbnail_url }} style={styles.thumbnailImage} />
                ) : (
                    <Text style={styles.thumbnailPlaceholder}>🎓</Text>
                )}
            </View>
            <View style={styles.courseInfo}>
                <View style={styles.courseHeader}>
                    <Text style={styles.courseTitle} numberOfLines={1}>{item.title}</Text>
                    <View style={[styles.statusBadge, item.is_published ? styles.published : styles.draft]}>
                        <Text style={styles.statusText}>
                            {item.is_published ? 'Published' : 'Draft'}
                        </Text>
                    </View>
                </View>
                <Text style={styles.coursePrice}>€{item.price?.toFixed(2) || '0.00'}</Text>
                <View style={styles.courseMeta}>
                    <Text style={styles.metaText}>📚 {item.lesson_count} lessons</Text>
                    <Text style={styles.metaText}>👥 {item.enrollment_count} students</Text>
                </View>
            </View>
        </TouchableOpacity>
    );

    return (
        <ScreenBackground>
            <View style={styles.container}>
                <FlatList
                    data={courses}
                    keyExtractor={(item) => item.id}
                    renderItem={renderCourse}
                    contentContainerStyle={styles.list}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} />
                    }
                    ListEmptyComponent={
                        <View style={styles.empty}>
                            <Text style={styles.emptyIcon}>📚</Text>
                            <Text style={styles.emptyTitle}>No Courses Yet</Text>
                            <Text style={styles.emptyText}>Create your first course to start teaching</Text>
                        </View>
                    }
                />

                <TouchableOpacity
                    style={styles.fab}
                    onPress={() => navigation.navigate('CourseEditor', { courseId: null })}
                >
                    <Text style={styles.fabIcon}>+</Text>
                </TouchableOpacity>
            </View>
        </ScreenBackground>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: 'transparent' },
    list: { padding: spacing.lg, paddingBottom: 100 },
    courseCard: {
        flexDirection: 'row',
        backgroundColor: colors.surface,
        borderRadius: 16,
        overflow: 'hidden',
        marginBottom: spacing.md,
        borderWidth: 1,
        borderColor: colors.border,
    },
    thumbnail: {
        width: 100,
        height: 100,
        backgroundColor: 'rgba(139,92,246,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    thumbnailImage: { width: '100%', height: '100%' },
    thumbnailPlaceholder: { fontSize: 32 },
    courseInfo: { flex: 1, padding: spacing.md },
    courseHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    courseTitle: { fontSize: 16, fontWeight: '600', color: colors.text, flex: 1, marginRight: spacing.sm },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
    published: { backgroundColor: 'rgba(34,197,94,0.1)' },
    draft: { backgroundColor: 'rgba(245,158,11,0.1)' },
    statusText: { fontSize: 10, fontWeight: '600', color: colors.textSecondary },
    coursePrice: { fontSize: 18, fontWeight: '700', color: colors.primary, marginTop: 4 },
    courseMeta: { flexDirection: 'row', gap: spacing.md, marginTop: 8 },
    metaText: { fontSize: 12, color: colors.textMuted },
    empty: { alignItems: 'center', paddingTop: 60 },
    emptyIcon: { fontSize: 48, marginBottom: spacing.md },
    emptyTitle: { fontSize: 18, fontWeight: '600', color: colors.text },
    emptyText: { fontSize: 14, color: colors.textMuted, marginTop: 4 },
    fab: {
        position: 'absolute',
        bottom: 24,
        right: 24,
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 4,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    fabIcon: { fontSize: 28, color: '#fff', marginTop: -2 },
});

export default CoursesListScreen;
