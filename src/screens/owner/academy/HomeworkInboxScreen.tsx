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
import { formatDistanceToNow } from 'date-fns';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../../../lib/supabase';
import { ScreenBackground, MerakiText } from '../../../components/ui';
import { colors, spacing } from '../../../theme';

interface Submission {
    id: string;
    photo_url: string;
    notes: string;
    status: 'pending' | 'approved' | 'rejected';
    created_at: string;
    student: { id: string; full_name: string; avatar_url: string | null };
    lesson: { id: string; title: string; course: { title: string } };
}

export function HomeworkInboxScreen() {
    const navigation = useNavigation<any>();
    const [submissions, setSubmissions] = useState<Submission[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [filter, setFilter] = useState<'pending' | 'reviewed' | 'all'>('pending');

    const fetchSubmissions = async () => {
        try {
            let query = (supabase as any)
                .from('homework_submissions')
                .select(`
                    *,
                    student:student_id(id, full_name, avatar_url),
                    lesson:lesson_id(id, title, course:course_id(title))
                `)
                .order('created_at', { ascending: false });

            if (filter === 'pending') {
                query = query.eq('status', 'pending');
            } else if (filter === 'reviewed') {
                query = query.in('status', ['approved', 'rejected']);
            }

            const { data, error } = await query;
            if (error) throw error;
            setSubmissions(data || []);
        } catch (error) {
            console.error('Error fetching submissions:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchSubmissions();
        }, [filter])
    );

    const onRefresh = () => {
        setRefreshing(true);
        fetchSubmissions();
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'approved': return colors.success;
            case 'rejected': return colors.error;
            default: return '#F59E0B';
        }
    };

    const renderSubmission = ({ item }: { item: Submission }) => (
        <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate('HomeworkReview', { submissionId: item.id })}
        >
            <View style={styles.cardLeft}>
                <View style={styles.avatar}>
                    {item.student?.avatar_url ? (
                        <Image source={{ uri: item.student.avatar_url }} style={styles.avatarImage} />
                    ) : (
                        <MerakiText variant="h3" color={colors.primary}>
                            {item.student?.full_name?.[0] || '?'}
                        </MerakiText>
                    )}
                </View>
                <View style={styles.cardInfo}>
                    <MerakiText variant="body" style={styles.studentName}>{item.student?.full_name || 'Unknown'}</MerakiText>
                    <MerakiText variant="caption" style={styles.lessonName} numberOfLines={1}>
                        {item.lesson?.course?.title} - {item.lesson?.title}
                    </MerakiText>
                    <MerakiText variant="caption" style={styles.timestamp}>
                        {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                    </MerakiText>
                </View>
            </View>
            <View style={styles.cardRight}>
                <View style={[styles.statusDot, { backgroundColor: getStatusColor(item.status) }]} />
                <Image source={{ uri: item.photo_url }} style={styles.thumbnail} />
            </View>
        </TouchableOpacity>
    );

    return (
        <ScreenBackground>
            <View style={styles.container}>
                <View style={styles.filterRow}>
                    {(['pending', 'reviewed', 'all'] as const).map((f) => (
                        <TouchableOpacity
                            key={f}
                            style={[styles.filterBtn, filter === f && styles.filterActive]}
                            onPress={() => setFilter(f)}
                        >
                            <MerakiText variant="caption" style={[styles.filterText, filter === f && styles.filterTextActive]}>
                                {f.charAt(0).toUpperCase() + f.slice(1)}
                            </MerakiText>
                        </TouchableOpacity>
                    ))}
                </View>

                <FlatList
                    data={submissions}
                    keyExtractor={(item) => item.id}
                    renderItem={renderSubmission}
                    contentContainerStyle={styles.list}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} />
                    }
                    ListEmptyComponent={
                        <View style={styles.empty}>
                            <MaterialCommunityIcons name="inbox" size={48} color={colors.textMuted} style={{ marginBottom: spacing.md }} />
                            <MerakiText variant="h3" style={styles.emptyTitle}>
                                {filter === 'pending' ? 'No Pending Reviews' : 'No Submissions'}
                            </MerakiText>
                            <MerakiText variant="body" style={styles.emptyText}>
                                {filter === 'pending'
                                    ? 'All caught up! Check back later.'
                                    : 'Student submissions will appear here'}
                            </MerakiText>
                        </View>
                    }
                />
            </View>
        </ScreenBackground>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: 'transparent' },
    filterRow: {
        flexDirection: 'row',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        gap: spacing.sm,
    },
    filterBtn: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderRadius: 20,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
    },
    filterActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    filterText: { color: colors.textMuted },
    filterTextActive: { color: '#fff', fontWeight: '600' },
    list: { padding: spacing.lg, paddingBottom: 100 },
    card: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: spacing.md,
        marginBottom: spacing.md,
        borderWidth: 1,
        borderColor: colors.border,
    },
    cardLeft: { flexDirection: 'row', flex: 1 },
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
    cardInfo: { flex: 1 },
    studentName: { fontWeight: '600', color: colors.text },
    lessonName: { color: colors.textSecondary, marginTop: 2 },
    timestamp: { color: colors.textMuted, marginTop: 4 },
    cardRight: { alignItems: 'flex-end' },
    statusDot: { width: 8, height: 8, borderRadius: 4, marginBottom: spacing.xs },
    thumbnail: { width: 50, height: 50, borderRadius: 8, backgroundColor: colors.border },
    empty: { alignItems: 'center', paddingTop: 60 },
    emptyTitle: { fontWeight: '600', color: colors.text },
    emptyText: { color: colors.textMuted, marginTop: 4, textAlign: 'center' },
});

export default HomeworkInboxScreen;
