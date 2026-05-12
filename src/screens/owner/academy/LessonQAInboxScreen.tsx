/**
 * LessonQAInboxScreen — Owner's view of all student Q&A messages across lessons.
 * 
 * Shows questions grouped by lesson/course with real-time updates.
 * Owner can tap a question to jump to that lesson's Q&A chat.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    RefreshControl,
    ActivityIndicator,
    Image,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { Card, MerakiText, ScreenBackground } from '../../../components/ui';
import { colors, spacing, layout } from '../../../theme';

type QAThread = {
    lesson_id: string;
    course_id: string;
    lesson_title: string;
    course_title: string;
    unanswered_count: number;
    total_count: number;
    latest_question: string | null;
    latest_question_time: string;
    latest_sender_name: string | null;
    latest_sender_avatar: string | null;
    has_media: boolean;
};

export function LessonQAInboxScreen() {
    const { user } = useAuth();
    const navigation = useNavigation<any>();
    const [threads, setThreads] = useState<QAThread[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const loadThreads = useCallback(async () => {
        if (!user) return;
        try {
            // Fetch all Q&A messages grouped by lesson
            const { data: messages, error } = await supabase
                .from('lesson_qa_messages')
                .select(`
                    id,
                    lesson_id,
                    course_id,
                    content,
                    media_url,
                    is_question,
                    created_at,
                    sender:profiles!lesson_qa_messages_sender_id_fkey(full_name, avatar_url, role)
                `)
                .order('created_at', { ascending: false });

            if (error) throw error;
            if (!messages || messages.length === 0) {
                setThreads([]);
                return;
            }

            // Get unique lesson IDs
            const lessonIds = [...new Set(messages.map((m: any) => m.lesson_id))];
            const courseIds = [...new Set(messages.map((m: any) => m.course_id))];

            // Fetch lesson and course names
            const [lessonsRes, coursesRes] = await Promise.all([
                supabase.from('lessons').select('id, title').in('id', lessonIds),
                supabase.from('courses').select('id, title').in('id', courseIds),
            ]);

            const lessonMap = new Map((lessonsRes.data || []).map((l: any) => [l.id, l.title]));
            const courseMap = new Map((coursesRes.data || []).map((c: any) => [c.id, c.title]));

            // Group by lesson
            const threadMap = new Map<string, QAThread>();
            for (const msg of messages as any[]) {
                const lid = msg.lesson_id;
                if (!threadMap.has(lid)) {
                    threadMap.set(lid, {
                        lesson_id: lid,
                        course_id: msg.course_id,
                        lesson_title: lessonMap.get(lid) || 'Unknown Lesson',
                        course_title: courseMap.get(msg.course_id) || 'Unknown Course',
                        unanswered_count: 0,
                        total_count: 0,
                        latest_question: null,
                        latest_question_time: msg.created_at,
                        latest_sender_name: null,
                        latest_sender_avatar: null,
                        has_media: false,
                    });
                }
                const thread = threadMap.get(lid)!;
                thread.total_count++;

                if (msg.is_question && msg.sender?.role !== 'owner') {
                    thread.unanswered_count++;
                }

                // Latest question from a student
                if (msg.is_question && !thread.latest_question && msg.sender?.role !== 'owner') {
                    thread.latest_question = msg.content;
                    thread.latest_sender_name = msg.sender?.full_name;
                    thread.latest_sender_avatar = msg.sender?.avatar_url;
                    thread.has_media = !!msg.media_url;
                }
            }

            // Sort by latest question time (most recent first)
            const sorted = Array.from(threadMap.values()).sort(
                (a, b) => new Date(b.latest_question_time).getTime() - new Date(a.latest_question_time).getTime()
            );

            setThreads(sorted);
        } catch (err) {
            console.error('Error loading Q&A threads:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [user]);

    useFocusEffect(useCallback(() => { loadThreads(); }, [loadThreads]));

    // Real-time subscription on new Q&A messages
    useEffect(() => {
        const channel = supabase
            .channel('owner_qa_inbox')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'lesson_qa_messages' },
                () => { loadThreads(); }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [loadThreads]);

    const handleRefresh = () => { setRefreshing(true); loadThreads(); };

    const renderThread = ({ item }: { item: QAThread }) => (
        <TouchableOpacity
            onPress={() => {
                // Navigate to the lesson with Q&A open
                // We need to fetch lesson data first
                navigateToLessonQA(item);
            }}
            activeOpacity={0.7}
        >
            <Card variant="glass" style={styles.threadCard} noPadding>
                <View style={styles.threadContent}>
                    <View style={styles.threadAvatar}>
                        {item.latest_sender_avatar ? (
                            <Image source={{ uri: item.latest_sender_avatar }} style={styles.avatar} />
                        ) : (
                            <LinearGradient
                                colors={['rgba(244,114,182,0.20)', 'rgba(244,114,182,0.05)']}
                                style={styles.avatar}
                            >
                                <MaterialCommunityIcons name="chat-question" size={20} color="#F472B6" />
                            </LinearGradient>
                        )}
                        {item.unanswered_count > 0 && (
                            <View style={styles.unreadBadge}>
                                <MerakiText style={styles.unreadText}>{item.unanswered_count}</MerakiText>
                            </View>
                        )}
                    </View>

                    <View style={styles.threadInfo}>
                        <MerakiText variant="bodyBold" numberOfLines={1}>{item.lesson_title}</MerakiText>
                        <MerakiText variant="caption" color={colors.textMuted} numberOfLines={1}>
                            {item.course_title}
                        </MerakiText>
                        <MerakiText variant="caption" color={colors.textSecondary} numberOfLines={1} style={{ marginTop: 2 }}>
                            {item.latest_sender_name && (
                                <MerakiText variant="caption" color={colors.accent}>{item.latest_sender_name}: </MerakiText>
                            )}
                            {item.has_media ? '📷 Photo' : ''}
                            {item.latest_question || 'No messages yet'}
                        </MerakiText>
                    </View>

                    <View style={styles.threadMeta}>
                        <MerakiText variant="caption" color={colors.textMuted}>
                            {formatTimeAgo(item.latest_question_time)}
                        </MerakiText>
                        <MerakiText variant="caption" color={colors.textMuted}>
                            {item.total_count} msg{item.total_count !== 1 ? 's' : ''}
                        </MerakiText>
                    </View>
                </View>
            </Card>
        </TouchableOpacity>
    );

    const navigateToLessonQA = async (thread: QAThread) => {
        try {
            const { data: lesson } = await supabase
                .from('lessons')
                .select('id, title, description, video_url, video_provider, duration_minutes, has_homework')
                .eq('id', thread.lesson_id)
                .single();

            const { data: course } = await supabase
                .from('courses')
                .select('instructor_id, instructor:profiles!courses_instructor_id_fkey(full_name)')
                .eq('id', thread.course_id)
                .single();

            if (lesson) {
                // Navigate to the Lesson screen within client tabs (or just pass lesson data)
                // Since we're in the owner academy tab, we navigate to a lesson Q&A detail
                navigation.navigate('LessonQADetail', {
                    lesson,
                    courseId: thread.course_id,
                    instructorId: (course as any)?.instructor_id,
                    instructorName: (course as any)?.instructor?.full_name,
                });
            }
        } catch (err) {
            console.error('Error navigating to lesson QA:', err);
        }
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.accent} />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <FlatList
                data={threads}
                keyExtractor={(item) => item.lesson_id}
                renderItem={renderThread}
                contentContainerStyle={styles.listContent}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.accent} />
                }
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <MaterialCommunityIcons name="chat-question-outline" size={56} color={colors.textMuted} style={{ opacity: 0.3 }} />
                        <MerakiText variant="body" color={colors.textMuted} style={{ marginTop: spacing.md, textAlign: 'center' }}>
                            No student questions yet.{'\n'}Questions will appear here when students ask during lessons.
                        </MerakiText>
                    </View>
                }
            />
        </View>
    );
}

function formatTimeAgo(dateString: string): string {
    const diff = Date.now() - new Date(dateString).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Now';
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    listContent: { padding: spacing.lg, paddingBottom: 100 },

    threadCard: { marginBottom: spacing.sm },
    threadContent: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.md,
        gap: spacing.md,
    },
    threadAvatar: { position: 'relative' },
    avatar: {
        width: 44, height: 44, borderRadius: 22,
        alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
    },
    unreadBadge: {
        position: 'absolute',
        top: -4,
        right: -4,
        backgroundColor: '#FF453A',
        borderRadius: 10,
        minWidth: 18,
        height: 18,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 4,
        borderWidth: 2,
        borderColor: colors.surface,
    },
    unreadText: { color: '#1A1A1A', fontSize: 10, fontWeight: '700' as any },

    threadInfo: { flex: 1 },
    threadMeta: { alignItems: 'flex-end', gap: 4 },

    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.xxxl,
        paddingHorizontal: spacing.lg,
    },
});

export default LessonQAInboxScreen;
