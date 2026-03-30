import React, { useState, useEffect } from 'react';
import {
    View,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    Image,
    Alert,
    ActivityIndicator,
    Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { format } from 'date-fns';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../../../lib/supabase';
import { ScreenBackground, Button, MerakiText } from '../../../components/ui';
import { colors, spacing } from '../../../theme';
import { useAuth } from '../../../contexts/AuthContext';

const { width } = Dimensions.get('window');

interface Submission {
    id: string;
    photo_url: string;
    notes: string;
    status: string;
    feedback: string | null;
    created_at: string;
    student: { id: string; full_name: string; avatar_url: string | null };
    lesson: { id: string; title: string; course: { title: string } };
}

export function HomeworkReviewScreen() {
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const { user } = useAuth();
    const { submissionId } = route.params || {};

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [submission, setSubmission] = useState<Submission | null>(null);
    const [feedback, setFeedback] = useState('');

    useEffect(() => {
        fetchSubmission();
    }, [submissionId]);

    const fetchSubmission = async () => {
        try {
            const { data, error } = await (supabase as any)
                .from('homework_submissions')
                .select(`
                    *,
                    student:student_id(id, full_name, avatar_url),
                    lesson:lesson_id(id, title, course:course_id(title))
                `)
                .eq('id', submissionId)
                .single();

            if (error) throw error;
            setSubmission(data);
            setFeedback(data.feedback || '');
        } catch (error) {
            console.error('Error fetching submission:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAction = async (action: 'approved' | 'needs_revision') => {
        if (!feedback.trim() && action === 'needs_revision') {
            Alert.alert('Feedback Required', 'Please provide feedback when requesting changes.');
            return;
        }

        setSaving(true);
        try {
            // Update submission status
            const { error: updateError } = await (supabase as any)
                .from('homework_submissions')
                .update({
                    status: action,
                    feedback: feedback.trim(),
                    reviewed_by: user?.id,
                    reviewed_at: new Date().toISOString(),
                })
                .eq('id', submissionId);

            if (updateError) throw updateError;

            // If approved, mark lesson as complete for student
            if (action === 'approved' && submission?.lesson?.id && submission?.student?.id) {
                await (supabase as any)
                    .from('lesson_progress')
                    .upsert({
                        user_id: submission.student.id,
                        lesson_id: submission.lesson.id,
                        progress_percent: 100,
                        completed_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                    }, { onConflict: 'user_id,lesson_id' });
            }

            Alert.alert(
                'Success',
                action === 'approved'
                    ? 'Homework approved! Lesson marked as complete.'
                    : 'Feedback sent to student.'
            );
            navigation.goBack();
        } catch (error: any) {
            Alert.alert('Error', error.message);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <ScreenBackground>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            </ScreenBackground>
        );
    }

    if (!submission) {
        return (
            <ScreenBackground>
                <View style={styles.loadingContainer}>
                    <MerakiText variant="body" style={styles.errorText}>Submission not found</MerakiText>
                </View>
            </ScreenBackground>
        );
    }

    return (
        <ScreenBackground>
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
                        <MerakiText variant="body" color={colors.text} style={{ marginLeft: 4 }}>Back</MerakiText>
                    </TouchableOpacity>
                    <MerakiText variant="h3" style={styles.headerTitle}>Review Homework</MerakiText>
                    <View style={{ width: 60 }} />
                </View>

                <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                    {/* Student Info */}
                    <View style={styles.studentCard}>
                        <View style={styles.avatar}>
                            {submission.student?.avatar_url ? (
                                <Image source={{ uri: submission.student.avatar_url }} style={styles.avatarImage} />
                            ) : (
                                <MerakiText variant="h3" color={colors.primary}>
                                    {submission.student?.full_name?.[0] || '?'}
                                </MerakiText>
                            )}
                        </View>
                        <View>
                            <MerakiText variant="body" style={styles.studentName}>{submission.student?.full_name}</MerakiText>
                            <MerakiText variant="caption" style={styles.lessonName}>
                                {submission.lesson?.course?.title} • {submission.lesson?.title}
                            </MerakiText>
                            <MerakiText variant="caption" style={styles.timestamp}>
                                Submitted {format(new Date(submission.created_at), 'MMM d, yyyy h:mm a')}
                            </MerakiText>
                        </View>
                    </View>

                    {/* Photo */}
                    <View style={styles.photoContainer}>
                        <Image
                            source={{ uri: submission.photo_url }}
                            style={styles.photo}
                            resizeMode="contain"
                        />
                    </View>

                    {/* Student Notes */}
                    {submission.notes && (
                        <View style={styles.notesCard}>
                            <MerakiText variant="caption" style={styles.notesLabel}>Student Notes</MerakiText>
                            <MerakiText variant="body" style={styles.notesText}>{submission.notes}</MerakiText>
                        </View>
                    )}

                    {/* Feedback Input */}
                    <View style={styles.feedbackSection}>
                        <MerakiText variant="caption" style={styles.feedbackLabel}>Your Feedback</MerakiText>
                        <TextInput
                            style={styles.feedbackInput}
                            value={feedback}
                            onChangeText={setFeedback}
                            placeholder="Provide feedback on the student's work..."
                            placeholderTextColor={colors.textMuted}
                            multiline
                            numberOfLines={4}
                        />
                    </View>

                    {/* Actions */}
                    {submission.status === 'pending' && (
                        <View style={styles.actions}>
                            <TouchableOpacity
                                style={[styles.actionBtn, styles.rejectBtn]}
                                onPress={() => handleAction('needs_revision')}
                                disabled={saving}
                            >
                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                                    <MaterialCommunityIcons name="refresh" size={18} color="#F59E0B" />
                                    <MerakiText variant="body" style={styles.rejectBtnText}>Request Changes</MerakiText>
                                </View>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.actionBtn, styles.approveBtn]}
                                onPress={() => handleAction('approved')}
                                disabled={saving}
                            >
                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                                    <MaterialCommunityIcons name="check" size={18} color="#fff" />
                                    <MerakiText variant="body" style={styles.approveBtnText}>Approve</MerakiText>
                                </View>
                            </TouchableOpacity>
                        </View>
                    )}

                    {submission.status !== 'pending' && (
                        <View style={[
                            styles.statusBanner,
                            submission.status === 'approved' ? styles.approvedBanner : styles.rejectedBanner,
                        ]}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <MaterialCommunityIcons
                                    name={submission.status === 'approved' ? "check-circle" : "refresh"}
                                    size={20}
                                    color={colors.text}
                                />
                                <MerakiText variant="body" style={styles.statusBannerText}>
                                    {submission.status === 'approved' ? 'Approved' : 'Changes Requested'}
                                </MerakiText>
                            </View>
                        </View>
                    )}
                </ScrollView>
            </SafeAreaView>
        </ScreenBackground>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    errorText: { color: colors.textMuted },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    headerTitle: { fontWeight: '600', color: colors.text },
    content: { padding: spacing.lg, paddingBottom: 100 },
    studentCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: spacing.md,
        marginBottom: spacing.lg,
        borderWidth: 1,
        borderColor: colors.border,
    },
    avatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: 'rgba(139,92,246,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: spacing.md,
    },
    avatarImage: { width: 50, height: 50, borderRadius: 25 },
    studentName: { fontWeight: '600', color: colors.text },
    lessonName: { color: colors.textSecondary, marginTop: 2 },
    timestamp: { color: colors.textMuted, marginTop: 2 },
    photoContainer: {
        borderRadius: 16,
        overflow: 'hidden',
        backgroundColor: colors.surface,
        marginBottom: spacing.lg,
    },
    photo: {
        width: '100%',
        height: width - spacing.lg * 2,
    },
    notesCard: {
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: spacing.md,
        marginBottom: spacing.lg,
        borderWidth: 1,
        borderColor: colors.border,
    },
    notesLabel: { fontWeight: '600', color: colors.textMuted, marginBottom: 6 },
    notesText: { color: colors.text, lineHeight: 20 },
    feedbackSection: { marginBottom: spacing.lg },
    feedbackLabel: { fontWeight: '600', color: colors.textMuted, marginBottom: 6, textTransform: 'uppercase' },
    feedbackInput: {
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: spacing.md,
        color: colors.text,
        fontSize: 15,
        borderWidth: 1,
        borderColor: colors.border,
        height: 120,
        textAlignVertical: 'top',
    },
    actions: {
        flexDirection: 'row',
        gap: spacing.md,
    },
    actionBtn: {
        flex: 1,
        paddingVertical: spacing.md,
        borderRadius: 12,
        alignItems: 'center',
    },
    rejectBtn: { backgroundColor: 'rgba(245,158,11,0.1)', borderWidth: 1, borderColor: 'rgba(245,158,11,0.3)' },
    rejectBtnText: { fontWeight: '600', color: '#F59E0B' },
    approveBtn: { backgroundColor: colors.success },
    approveBtnText: { fontWeight: '600', color: '#1A1A1A' },
    statusBanner: {
        paddingVertical: spacing.md,
        borderRadius: 12,
        alignItems: 'center',
    },
    approvedBanner: { backgroundColor: 'rgba(34,197,94,0.1)' },
    rejectedBanner: { backgroundColor: 'rgba(245,158,11,0.1)' },
    statusBannerText: { fontWeight: '600', color: colors.text },
});

export default HomeworkReviewScreen;
