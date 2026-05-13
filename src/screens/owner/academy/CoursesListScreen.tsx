import React, { useState, useCallback } from 'react';
import {
    View,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    Image,
    RefreshControl,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../../../lib/supabase';
import { ScreenBackground, MerakiText } from '../../../components/ui';
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
            style={styles.courseCardWrapper}
            onPress={() => navigation.navigate('CourseEditor', { courseId: item.id })}
            activeOpacity={0.85}
        >
            <View style={styles.courseCard}>
                <View style={styles.thumbnail}>
                {item.thumbnail_url ? (
                    <Image source={{ uri: item.thumbnail_url }} style={styles.thumbnailImage} />
                ) : (
                    <MaterialCommunityIcons name="school" size={48} color={colors.primary} />
                )}
            </View>
            <View style={styles.courseInfo}>
                <View style={styles.courseHeader}>
                    <MerakiText variant="body" style={styles.courseTitle} numberOfLines={1}>{item.title}</MerakiText>
                    <View style={[styles.statusBadge, item.is_published ? styles.published : styles.draft]}>
                        <MerakiText variant="caption" style={styles.statusText}>
                            {item.is_published ? 'Published' : 'Draft'}
                        </MerakiText>
                    </View>
                </View>
                <MerakiText variant="h3" style={styles.coursePrice}>€{item.price?.toFixed(2) || '0.00'}</MerakiText>
                <View style={styles.courseMeta}>
                    <View style={styles.metaItem}>
                        <MaterialCommunityIcons name="book-open-page-variant" size={14} color={colors.textMuted} />
                        <MerakiText variant="caption" style={styles.metaText}>{item.lesson_count} lessons</MerakiText>
                    </View>
                    <View style={styles.metaItem}>
                        <MaterialCommunityIcons name="account-group" size={14} color={colors.textMuted} />
                        <MerakiText variant="caption" style={styles.metaText}>{item.enrollment_count} students</MerakiText>
                    </View>
                </View>
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
                            <MaterialCommunityIcons name="book-open-variant" size={48} color={colors.textMuted} style={{ marginBottom: spacing.md }} />
                            <MerakiText variant="h3" style={styles.emptyTitle}>No Courses Yet</MerakiText>
                            <MerakiText variant="body" style={styles.emptyText}>Create your first course to start teaching</MerakiText>
                        </View>
                    }
                />

                <TouchableOpacity
                    style={styles.fab}
                    onPress={() => navigation.navigate('CourseEditor', { courseId: null })}
                >
                    <MaterialCommunityIcons name="plus" size={32} color="#fff" />
                </TouchableOpacity>
            </View>
        </ScreenBackground>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: 'transparent' },
    list: { padding: spacing.lg, paddingBottom: 100 },
    courseCardWrapper: {
        borderRadius: 16,
        backgroundColor: '#FFFFFF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
        elevation: 6,
        marginBottom: spacing.md,
    },
    courseCard: {
        flexDirection: 'row',
        backgroundColor: colors.surface,
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.08)',
    },
    thumbnail: {
        width: 100,
        height: 100,
        backgroundColor: 'rgba(139,92,246,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    thumbnailImage: { width: '100%', height: '100%' },
    courseInfo: { flex: 1, padding: spacing.md },
    courseHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    courseTitle: { fontWeight: '600', color: colors.text, flex: 1, marginRight: spacing.sm },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
    published: { backgroundColor: 'rgba(34,197,94,0.1)' },
    draft: { backgroundColor: 'rgba(245,158,11,0.1)' },
    statusText: { fontWeight: '600', color: colors.textSecondary },
    coursePrice: { color: colors.primary, marginTop: 4 },
    courseMeta: { flexDirection: 'row', gap: spacing.md, marginTop: 8 },
    metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    metaText: { color: colors.textMuted },
    empty: { alignItems: 'center', paddingTop: 60 },
    emptyTitle: { fontWeight: '600', color: colors.text },
    emptyText: { color: colors.textMuted, marginTop: 4 },
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
});

export default CoursesListScreen;
