import React, { useState, useEffect } from 'react';
import {
    View,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    Switch,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { supabase } from '../../../lib/supabase';
import { ScreenBackground, Button, ConfirmModal, MerakiText } from '../../../components/ui';
import { colors, spacing } from '../../../theme';
import { useModal } from '../../../contexts/ModalContext';

// Helper function to format duration in seconds to a readable string
const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    if (mins === 0) {
        return `${secs} seconds`;
    } else if (secs === 0) {
        return `${mins} minute${mins !== 1 ? 's' : ''}`;
    } else {
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
};

export function LessonEditorScreen() {
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const { showAlert, showConfirm } = useModal();
    const { lessonId, chapterId, courseId } = route.params || {};
    const isNew = !lessonId;

    const [loading, setLoading] = useState(!isNew);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [videoUrl, setVideoUrl] = useState('');
    const [videoProvider, setVideoProvider] = useState('upload');
    const [durationSeconds, setDurationSeconds] = useState<number>(0);
    const [hasHomework, setHasHomework] = useState(false);
    const [deleteModalVisible, setDeleteModalVisible] = useState(false);

    useEffect(() => {
        if (lessonId) fetchLesson();
    }, [lessonId]);

    const fetchLesson = async () => {
        try {
            const { data, error } = await (supabase as any)
                .from('lessons')
                .select('*')
                .eq('id', lessonId)
                .single();

            if (error) throw error;

            setTitle(data.title);
            setDescription(data.description || '');
            setVideoUrl(data.video_url || '');
            setVideoProvider(data.video_provider || 'upload');
            // duration_minutes now stores raw seconds
            setDurationSeconds(data.duration_minutes || 0);
            setHasHomework(data.has_homework);
        } catch (error) {
            console.error('Error fetching lesson:', error);
        } finally {
            setLoading(false);
        }
    };

    const pickVideo = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['videos'],
            allowsEditing: false,
            quality: 0.5, // Lower quality for smaller file size
        });

        if (!result.canceled && result.assets[0]) {
            setUploading(true);
            try {
                const asset = result.assets[0];
                const fileName = `lesson-${lessonId || Date.now()}-${Date.now()}.mp4`;

                // Check file size (warn if > 50MB)
                const fileInfo = await FileSystem.getInfoAsync(asset.uri);
                if (fileInfo.exists && 'size' in fileInfo && fileInfo.size > 50 * 1024 * 1024) {
                    showAlert('Large File', 'This video is over 50MB. Upload may take a while or fail.', 'info');
                }

                // Read file as base64
                const base64 = await FileSystem.readAsStringAsync(asset.uri, {
                    encoding: 'base64',
                });

                // Convert to ArrayBuffer and upload
                const arrayBuffer = decode(base64);

                const { data, error } = await supabase.storage
                    .from('course-videos')
                    .upload(fileName, arrayBuffer, {
                        contentType: 'video/mp4',
                        upsert: true,
                    });

                if (error) {
                    console.error('Upload error:', error);
                    showAlert('Upload Failed', error.message || 'Could not upload video.', 'error');
                    return;
                }

                // Get public URL
                const { data: urlData } = supabase.storage
                    .from('course-videos')
                    .getPublicUrl(fileName);

                setVideoUrl(urlData.publicUrl);
                setVideoProvider('upload');

                // Capture video duration from asset (duration is in milliseconds, convert to seconds)
                if (asset.duration) {
                    setDurationSeconds(asset.duration / 1000);
                }

                showAlert('Success', 'Video uploaded successfully!', 'success');
            } catch (err: any) {
                showAlert('Error', 'Failed to upload video: ' + (err.message || 'Unknown error'), 'error');
            } finally {
                setUploading(false);
            }
        }
    };

    const handleSave = async () => {
        if (!title.trim()) {
            showAlert('Error', 'Please enter a lesson title', 'error');
            return;
        }

        setSaving(true);
        try {
            const lessonData = {
                title: title.trim(),
                description: description.trim(),
                video_url: videoUrl.trim(),
                video_provider: videoProvider,
                // Store duration in raw seconds for precision
                duration_minutes: Math.round(durationSeconds),
                resource_url: null,
                has_homework: hasHomework,
                course_id: courseId,
                chapter_id: chapterId,
            };

            if (isNew) {
                // Get current max order_index
                const { data: existing } = await (supabase as any)
                    .from('lessons')
                    .select('order_index')
                    .eq('chapter_id', chapterId)
                    .order('order_index', { ascending: false })
                    .limit(1);

                const nextIndex = (existing?.[0]?.order_index || 0) + 1;

                const { error } = await (supabase as any)
                    .from('lessons')
                    .insert({ ...lessonData, order_index: nextIndex });

                if (error) throw error;
                showAlert('Success', 'Lesson created!', 'success');
            } else {
                const { error } = await (supabase as any)
                    .from('lessons')
                    .update(lessonData)
                    .eq('id', lessonId);

                if (error) throw error;
                showAlert('Success', 'Lesson updated!', 'success');
            }

            navigation.goBack();
        } catch (error: any) {
            showAlert('Error', error.message, 'error');
        } finally {
            setSaving(false);
        }
    };

    const deleteLesson = async () => {
        try {
            await (supabase as any).from('lessons').delete().eq('id', lessonId);
            navigation.goBack();
        } catch (error: any) {
            console.error('Error deleting lesson:', error);
            showAlert('Error', error.message, 'error');
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

    return (
        <ScreenBackground>
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <MerakiText variant="h3" style={styles.headerTitle}>{isNew ? 'New Lesson' : 'Edit Lesson'}</MerakiText>
                    {!isNew ? (
                        <TouchableOpacity onPress={() => setDeleteModalVisible(true)}>
                            <MaterialCommunityIcons name="delete" size={24} color={colors.error} />
                        </TouchableOpacity>
                    ) : (
                        <View style={{ width: 24 }} />
                    )}
                </View>

                <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                    {/* Title */}
                    <View style={styles.inputGroup}>
                        <MerakiText variant="caption" style={styles.label}>Lesson Title</MerakiText>
                        <TextInput
                            style={styles.input}
                            value={title}
                            onChangeText={setTitle}
                            placeholder="e.g., Introduction to Volume"
                            placeholderTextColor={colors.textMuted}
                        />
                    </View>

                    {/* Description */}
                    <View style={styles.inputGroup}>
                        <MerakiText variant="caption" style={styles.label}>Description</MerakiText>
                        <TextInput
                            style={[styles.input, styles.textArea]}
                            value={description}
                            onChangeText={setDescription}
                            placeholder="What is covered in this lesson?"
                            placeholderTextColor={colors.textMuted}
                            multiline
                            numberOfLines={3}
                        />
                    </View>

                    {/* Video Section */}
                    <View style={styles.inputGroup}>
                        <MerakiText variant="caption" style={styles.label}>Video</MerakiText>

                        {/* Upload Button */}
                        <TouchableOpacity
                            style={[styles.uploadBtn, uploading && styles.uploadBtnDisabled]}
                            onPress={pickVideo}
                            disabled={uploading}
                        >
                            {uploading ? (
                                <ActivityIndicator size="small" color={colors.primary} />
                            ) : (
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <MaterialCommunityIcons name="video" size={20} color={colors.primary} />
                                    <MerakiText variant="body" style={styles.uploadBtnText}>
                                        {videoUrl && videoProvider === 'upload' ? 'Re-upload Video' : 'Upload Video'}
                                    </MerakiText>
                                </View>
                            )}
                        </TouchableOpacity>

                        {videoUrl && videoProvider === 'upload' && (
                            <View style={{ marginTop: spacing.sm }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                                    <MaterialCommunityIcons name="check-circle" size={14} color="#22c55e" />
                                    <MerakiText variant="caption" style={styles.uploadedHint}>Video uploaded</MerakiText>
                                </View>
                                {durationSeconds > 0 && (
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                        <MaterialCommunityIcons name="clock-outline" size={14} color={colors.textMuted} />
                                        <MerakiText variant="caption" style={styles.durationText}>
                                            Duration: {formatDuration(durationSeconds)}
                                        </MerakiText>
                                    </View>
                                )}
                            </View>
                        )}
                    </View>

                    {/* Has Homework Toggle */}
                    <View style={styles.toggleRow}>
                        <View>
                            <MerakiText variant="body" style={styles.toggleLabel}>Requires Homework</MerakiText>
                            <MerakiText variant="caption" style={styles.toggleHint}>
                                Students must submit photo for review
                            </MerakiText>
                        </View>
                        <Switch
                            value={hasHomework}
                            onValueChange={setHasHomework}
                            trackColor={{ false: colors.border, true: colors.primary }}
                            thumbColor={colors.text}
                        />
                    </View>

                    <Button
                        title={saving ? 'Saving...' : 'Save Lesson'}
                        onPress={handleSave}
                        disabled={saving}
                        style={styles.saveBtn}
                    />
                </ScrollView>

                <ConfirmModal
                    visible={deleteModalVisible}
                    onClose={() => setDeleteModalVisible(false)}
                    onConfirm={deleteLesson}
                    title="Delete Lesson?"
                    message="This will permanently delete this lesson."
                    confirmText="Delete"
                    confirmDestructive
                    icon="delete"
                />
            </SafeAreaView>
        </ScreenBackground>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
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
    inputGroup: { marginBottom: spacing.md },
    label: { fontWeight: '600', color: colors.textMuted, marginBottom: 6, textTransform: 'uppercase' },
    input: {
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: spacing.md,
        color: colors.text,
        fontSize: 16,
        borderWidth: 1,
        borderColor: colors.border,
    },
    textArea: { height: 80, textAlignVertical: 'top' },
    toggleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: spacing.md,
        marginBottom: spacing.lg,
        borderWidth: 1,
        borderColor: colors.border,
    },
    toggleLabel: { fontWeight: '600', color: colors.text },
    toggleHint: { color: colors.textMuted, marginTop: 2 },
    saveBtn: { marginTop: spacing.lg },
    uploadBtn: {
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: colors.primary,
        borderStyle: 'dashed',
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
    uploadBtnDisabled: { opacity: 0.5 },
    uploadBtnText: { color: colors.primary, fontWeight: '600' },
    uploadedHint: { color: '#22c55e' },
    durationText: { color: colors.textMuted },
});

export default LessonEditorScreen;
