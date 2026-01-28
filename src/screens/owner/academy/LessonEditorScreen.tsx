import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    Switch,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { supabase } from '../../../lib/supabase';
import { ScreenBackground, Button, ConfirmModal } from '../../../components/ui';
import { colors, spacing } from '../../../theme';

export function LessonEditorScreen() {
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const { lessonId, chapterId, courseId } = route.params || {};
    const isNew = !lessonId;

    const [loading, setLoading] = useState(!isNew);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [videoUrl, setVideoUrl] = useState('');
    const [videoProvider, setVideoProvider] = useState('upload');
    const [duration, setDuration] = useState('');
    const [resourceUrl, setResourceUrl] = useState('');
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
            setVideoProvider(data.video_provider || 'vimeo');
            setDuration(data.duration_minutes?.toString() || '');
            setResourceUrl(data.resource_url || '');
            setHasHomework(data.has_homework);
        } catch (error) {
            console.error('Error fetching lesson:', error);
        } finally {
            setLoading(false);
        }
    };

    const pickVideo = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Videos,
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
                    Alert.alert(
                        'Large File',
                        'This video is over 50MB. Upload may take a while or fail. Consider using a shorter video.',
                        [{ text: 'Continue Anyway', onPress: () => { } }, { text: 'Cancel', style: 'cancel' }]
                    );
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
                    Alert.alert('Upload Failed', error.message || 'Could not upload video.');
                    return;
                }

                // Get public URL
                const { data: urlData } = supabase.storage
                    .from('course-videos')
                    .getPublicUrl(fileName);

                setVideoUrl(urlData.publicUrl);
                setVideoProvider('upload');
                Alert.alert('Success', 'Video uploaded successfully!');
            } catch (err: any) {
                console.error('Error uploading video:', err);
                Alert.alert('Error', 'Failed to upload video: ' + (err.message || 'Unknown error'));
            } finally {
                setUploading(false);
            }
        }
    };

    const handleSave = async () => {
        if (!title.trim()) {
            Alert.alert('Error', 'Please enter a lesson title');
            return;
        }

        setSaving(true);
        try {
            const lessonData = {
                title: title.trim(),
                description: description.trim(),
                video_url: videoUrl.trim(),
                video_provider: videoProvider,
                duration_minutes: parseInt(duration) || 0,
                resource_url: resourceUrl.trim() || null,
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
                Alert.alert('Success', 'Lesson created!');
            } else {
                const { error } = await (supabase as any)
                    .from('lessons')
                    .update(lessonData)
                    .eq('id', lessonId);

                if (error) throw error;
                Alert.alert('Success', 'Lesson updated!');
            }

            navigation.goBack();
        } catch (error: any) {
            Alert.alert('Error', error.message);
        } finally {
            setSaving(false);
        }
    };

    const deleteLesson = async () => {
        try {
            await (supabase as any).from('lessons').delete().eq('id', lessonId);
            navigation.goBack();
        } catch (error: any) {
            Alert.alert('Error', error.message);
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
                    <TouchableOpacity onPress={() => navigation.goBack()}>
                        <Text style={styles.backButton}>←</Text>
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>{isNew ? 'New Lesson' : 'Edit Lesson'}</Text>
                    {!isNew ? (
                        <TouchableOpacity onPress={() => setDeleteModalVisible(true)}>
                            <Text style={styles.deleteButton}>🗑️</Text>
                        </TouchableOpacity>
                    ) : (
                        <View style={{ width: 40 }} />
                    )}
                </View>

                <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                    {/* Title */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Lesson Title</Text>
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
                        <Text style={styles.label}>Description</Text>
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
                        <Text style={styles.label}>Video</Text>

                        {/* Upload Button */}
                        <TouchableOpacity
                            style={[styles.uploadBtn, uploading && styles.uploadBtnDisabled]}
                            onPress={pickVideo}
                            disabled={uploading}
                        >
                            {uploading ? (
                                <ActivityIndicator size="small" color={colors.primary} />
                            ) : (
                                <Text style={styles.uploadBtnText}>
                                    {videoUrl && videoProvider === 'upload' ? '📹 Re-upload Video' : '📹 Upload Video'}
                                </Text>
                            )}
                        </TouchableOpacity>

                        {videoUrl && videoProvider === 'upload' && (
                            <Text style={styles.uploadedHint}>✅ Video uploaded</Text>
                        )}

                        <Text style={styles.orDivider}>— OR paste a link —</Text>

                        {/* URL Input */}
                        <TextInput
                            style={styles.input}
                            value={videoProvider === 'upload' ? '' : videoUrl}
                            onChangeText={(text) => {
                                setVideoUrl(text);
                                if (text) setVideoProvider('vimeo'); // Auto-switch to link mode
                            }}
                            placeholder="Vimeo, YouTube, or direct video URL"
                            placeholderTextColor={colors.textMuted}
                        />
                        <Text style={styles.hint}>
                            Optional: Paste a Vimeo/YouTube link or direct MP4 URL
                        </Text>
                    </View>

                    {/* Video Provider (only show if using link) */}
                    {videoUrl && videoProvider !== 'upload' && (
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Video Provider</Text>
                            <View style={styles.providerRow}>
                                {['vimeo', 'mux', 'youtube'].map((provider) => (
                                    <TouchableOpacity
                                        key={provider}
                                        style={[
                                            styles.providerBtn,
                                            videoProvider === provider && styles.providerActive,
                                        ]}
                                        onPress={() => setVideoProvider(provider)}
                                    >
                                        <Text style={[
                                            styles.providerText,
                                            videoProvider === provider && styles.providerTextActive,
                                        ]}>
                                            {provider.charAt(0).toUpperCase() + provider.slice(1)}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    )}

                    {/* Duration */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Duration (minutes)</Text>
                        <TextInput
                            style={styles.input}
                            value={duration}
                            onChangeText={setDuration}
                            placeholder="15"
                            placeholderTextColor={colors.textMuted}
                            keyboardType="number-pad"
                        />
                    </View>

                    {/* Resource URL */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Resource PDF (Optional)</Text>
                        <TextInput
                            style={styles.input}
                            value={resourceUrl}
                            onChangeText={setResourceUrl}
                            placeholder="URL to downloadable PDF"
                            placeholderTextColor={colors.textMuted}
                        />
                    </View>

                    {/* Has Homework Toggle */}
                    <View style={styles.toggleRow}>
                        <View>
                            <Text style={styles.toggleLabel}>Requires Homework</Text>
                            <Text style={styles.toggleHint}>
                                Students must submit photo for review
                            </Text>
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
                    icon="🗑️"
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
    backButton: { fontSize: 28, color: colors.text },
    headerTitle: { fontSize: 18, fontWeight: '600', color: colors.text },
    deleteButton: { fontSize: 20 },
    content: { padding: spacing.lg, paddingBottom: 100 },
    inputGroup: { marginBottom: spacing.md },
    label: { fontSize: 12, fontWeight: '600', color: colors.textMuted, marginBottom: 6, textTransform: 'uppercase' },
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
    hint: { fontSize: 11, color: colors.textMuted, marginTop: 4 },
    providerRow: { flexDirection: 'row', gap: spacing.sm },
    providerBtn: {
        flex: 1,
        paddingVertical: spacing.sm,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: 'center',
    },
    providerActive: { borderColor: colors.primary, backgroundColor: 'rgba(139,92,246,0.1)' },
    providerText: { fontSize: 14, color: colors.textMuted },
    providerTextActive: { color: colors.primary, fontWeight: '600' },
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
    toggleLabel: { fontSize: 16, fontWeight: '600', color: colors.text },
    toggleHint: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
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
    uploadBtnText: { fontSize: 16, color: colors.primary, fontWeight: '600' },
    uploadedHint: { fontSize: 12, color: '#22c55e', marginBottom: spacing.sm },
    orDivider: {
        textAlign: 'center',
        color: colors.textMuted,
        fontSize: 12,
        marginVertical: spacing.md,
    },
});

export default LessonEditorScreen;
