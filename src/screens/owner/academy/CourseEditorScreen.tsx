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
    Image,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../../lib/supabase';
import { ScreenBackground, Button, ConfirmModal } from '../../../components/ui';
import { colors, spacing } from '../../../theme';
import { useAuth } from '../../../contexts/AuthContext';

interface Chapter {
    id: string;
    title: string;
    order_index: number;
    lessons: Lesson[];
}

interface Lesson {
    id: string;
    title: string;
    order_index: number;
    duration_minutes: number;
    has_homework: boolean;
}

export function CourseEditorScreen() {
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const { user } = useAuth();
    const courseId = route.params?.courseId;
    const isNew = !courseId;

    const [loading, setLoading] = useState(!isNew);
    const [saving, setSaving] = useState(false);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [price, setPrice] = useState('');
    const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
    const [isPublished, setIsPublished] = useState(false);
    const [chapters, setChapters] = useState<Chapter[]>([]);
    const [newChapterTitle, setNewChapterTitle] = useState('');
    const [showAddChapter, setShowAddChapter] = useState(false);
    const [deleteModalVisible, setDeleteModalVisible] = useState(false);

    useEffect(() => {
        if (courseId) fetchCourse();
    }, [courseId]);

    const fetchCourse = async () => {
        try {
            const { data: course, error } = await (supabase as any)
                .from('courses')
                .select('*')
                .eq('id', courseId)
                .single();

            if (error) throw error;

            setTitle(course.title);
            setDescription(course.description || '');
            setPrice(course.price?.toString() || '');
            setThumbnailUrl(course.thumbnail_url);
            setIsPublished(course.is_published);

            // Fetch chapters with lessons
            const { data: chaptersData } = await (supabase as any)
                .from('chapters')
                .select(`*, lessons:lessons(id, title, order_index, duration_minutes, has_homework)`)
                .eq('course_id', courseId)
                .order('order_index');

            setChapters(chaptersData || []);
        } catch (error) {
            console.error('Error fetching course:', error);
        } finally {
            setLoading(false);
        }
    };

    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [16, 9],
            quality: 0.8,
            base64: true, // Get base64 data
        });

        if (!result.canceled && result.assets[0]) {
            try {
                const asset = result.assets[0];
                const fileName = `course-${courseId || Date.now()}-${Date.now()}.jpg`;

                if (!asset.base64) {
                    // Fallback if base64 not available
                    setThumbnailUrl(asset.uri);
                    Alert.alert('Warning', 'Could not encode image. Saved locally.');
                    return;
                }

                // Decode base64 to Uint8Array
                const binaryString = atob(asset.base64);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }

                // Upload to Supabase Storage
                const { data, error } = await supabase.storage
                    .from('course-images')
                    .upload(fileName, bytes.buffer, {
                        contentType: 'image/jpeg',
                        upsert: true,
                    });

                if (error) {
                    console.error('Upload error:', error);
                    setThumbnailUrl(asset.uri);
                    Alert.alert('Upload Failed', error.message || 'Could not upload image to storage.');
                    return;
                }

                // Get public URL
                const { data: urlData } = supabase.storage
                    .from('course-images')
                    .getPublicUrl(fileName);

                setThumbnailUrl(urlData.publicUrl);
                Alert.alert('Success', 'Image uploaded successfully!');
            } catch (err: any) {
                console.error('Error uploading image:', err);
                Alert.alert('Error', 'Failed to upload image: ' + (err.message || 'Unknown error'));
            }
        }
    };

    const handleSave = async () => {
        if (!title.trim()) {
            Alert.alert('Error', 'Please enter a course title');
            return;
        }

        setSaving(true);
        try {
            const courseData = {
                title: title.trim(),
                description: description.trim(),
                price: parseFloat(price) || 0,
                thumbnail_url: thumbnailUrl,
                is_published: isPublished,
                instructor_id: user?.id,
            };

            if (isNew) {
                const { data, error } = await (supabase as any)
                    .from('courses')
                    .insert(courseData)
                    .select()
                    .single();

                if (error) throw error;
                navigation.setParams({ courseId: data.id });
                Alert.alert('Success', 'Course created!');
            } else {
                const { error } = await (supabase as any)
                    .from('courses')
                    .update(courseData)
                    .eq('id', courseId);

                if (error) throw error;
                Alert.alert('Success', 'Course updated!');
            }
        } catch (error: any) {
            Alert.alert('Error', error.message);
        } finally {
            setSaving(false);
        }
    };

    const addChapter = async () => {
        if (!newChapterTitle.trim() || !courseId) return;

        try {
            const { data, error } = await (supabase as any)
                .from('chapters')
                .insert({
                    course_id: courseId,
                    title: newChapterTitle.trim(),
                    order_index: chapters.length,
                })
                .select()
                .single();

            if (error) throw error;

            setChapters([...chapters, { ...data, lessons: [] }]);
            setNewChapterTitle('');
            setShowAddChapter(false);
        } catch (error: any) {
            Alert.alert('Error', error.message);
        }
    };

    const deleteChapter = async (chapterId: string) => {
        Alert.alert('Delete Chapter', 'This will also delete all lessons in this chapter.', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    await (supabase as any).from('chapters').delete().eq('id', chapterId);
                    setChapters(chapters.filter(c => c.id !== chapterId));
                },
            },
        ]);
    };

    const deleteCourse = async () => {
        try {
            await (supabase as any).from('courses').delete().eq('id', courseId);
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
                    <Text style={styles.headerTitle}>{isNew ? 'New Course' : 'Edit Course'}</Text>
                    {!isNew && (
                        <TouchableOpacity onPress={() => setDeleteModalVisible(true)}>
                            <Text style={styles.deleteButton}>🗑️</Text>
                        </TouchableOpacity>
                    )}
                    {isNew && <View style={{ width: 40 }} />}
                </View>

                <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                    {/* Cover Image */}
                    <TouchableOpacity style={styles.coverPicker} onPress={pickImage}>
                        {thumbnailUrl ? (
                            <Image source={{ uri: thumbnailUrl }} style={styles.coverImage} />
                        ) : (
                            <View style={styles.coverPlaceholder}>
                                <Text style={styles.coverIcon}>📷</Text>
                                <Text style={styles.coverText}>Add Cover Image</Text>
                            </View>
                        )}
                    </TouchableOpacity>

                    {/* Title */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Course Title</Text>
                        <TextInput
                            style={styles.input}
                            value={title}
                            onChangeText={setTitle}
                            placeholder="e.g., Volume Lashes Masterclass"
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
                            placeholder="What will students learn?"
                            placeholderTextColor={colors.textMuted}
                            multiline
                            numberOfLines={4}
                        />
                    </View>

                    {/* Price */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Price (€)</Text>
                        <TextInput
                            style={styles.input}
                            value={price}
                            onChangeText={setPrice}
                            placeholder="199.00"
                            placeholderTextColor={colors.textMuted}
                            keyboardType="decimal-pad"
                        />
                    </View>

                    {/* Published Toggle */}
                    <View style={styles.toggleRow}>
                        <View>
                            <Text style={styles.toggleLabel}>Published</Text>
                            <Text style={styles.toggleHint}>
                                {isPublished ? 'Visible to students' : 'Hidden (Draft)'}
                            </Text>
                        </View>
                        <Switch
                            value={isPublished}
                            onValueChange={setIsPublished}
                            trackColor={{ false: colors.border, true: colors.primary }}
                            thumbColor={colors.text}
                        />
                    </View>

                    {/* Curriculum Section */}
                    {!isNew && (
                        <View style={styles.curriculumSection}>
                            <Text style={styles.sectionTitle}>Curriculum</Text>

                            {chapters.map((chapter, idx) => (
                                <View key={chapter.id} style={styles.chapterCard}>
                                    <View style={styles.chapterHeader}>
                                        <Text style={styles.chapterTitle}>
                                            Chapter {idx + 1}: {chapter.title}
                                        </Text>
                                        <TouchableOpacity onPress={() => deleteChapter(chapter.id)}>
                                            <Text style={styles.deleteIcon}>✕</Text>
                                        </TouchableOpacity>
                                    </View>

                                    {chapter.lessons?.map((lesson) => (
                                        <TouchableOpacity
                                            key={lesson.id}
                                            style={styles.lessonRow}
                                            onPress={() => navigation.navigate('LessonEditor', {
                                                lessonId: lesson.id,
                                                chapterId: chapter.id,
                                                courseId,
                                            })}
                                        >
                                            <Text style={styles.lessonIcon}>🎬</Text>
                                            <Text style={styles.lessonTitle}>{lesson.title}</Text>
                                            <Text style={styles.lessonDuration}>{lesson.duration_minutes}m</Text>
                                        </TouchableOpacity>
                                    ))}

                                    <TouchableOpacity
                                        style={styles.addLessonBtn}
                                        onPress={() => navigation.navigate('LessonEditor', {
                                            lessonId: null,
                                            chapterId: chapter.id,
                                            courseId,
                                        })}
                                    >
                                        <Text style={styles.addLessonText}>+ Add Lesson</Text>
                                    </TouchableOpacity>
                                </View>
                            ))}

                            {showAddChapter ? (
                                <View style={styles.addChapterForm}>
                                    <TextInput
                                        style={styles.input}
                                        value={newChapterTitle}
                                        onChangeText={setNewChapterTitle}
                                        placeholder="Chapter title"
                                        placeholderTextColor={colors.textMuted}
                                        autoFocus
                                    />
                                    <View style={styles.addChapterButtons}>
                                        <TouchableOpacity onPress={() => setShowAddChapter(false)}>
                                            <Text style={styles.cancelText}>Cancel</Text>
                                        </TouchableOpacity>
                                        <Button title="Add" size="sm" onPress={addChapter} />
                                    </View>
                                </View>
                            ) : (
                                <TouchableOpacity
                                    style={styles.addChapterBtn}
                                    onPress={() => setShowAddChapter(true)}
                                >
                                    <Text style={styles.addChapterText}>+ Add Chapter</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    )}

                    <Button
                        title={saving ? 'Saving...' : 'Save Course'}
                        onPress={handleSave}
                        disabled={saving}
                        style={styles.saveBtn}
                    />
                </ScrollView>

                <ConfirmModal
                    visible={deleteModalVisible}
                    onClose={() => setDeleteModalVisible(false)}
                    onConfirm={deleteCourse}
                    title="Delete Course?"
                    message="This will permanently delete the course and all its content."
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
    coverPicker: {
        height: 180,
        borderRadius: 16,
        overflow: 'hidden',
        marginBottom: spacing.lg,
        borderWidth: 2,
        borderColor: colors.border,
        borderStyle: 'dashed',
    },
    coverImage: { width: '100%', height: '100%' },
    coverPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
    coverIcon: { fontSize: 32, marginBottom: spacing.sm },
    coverText: { fontSize: 14, color: colors.textMuted },
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
    textArea: { height: 100, textAlignVertical: 'top' },
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
    curriculumSection: { marginTop: spacing.md },
    sectionTitle: { fontSize: 14, fontWeight: '600', color: colors.textMuted, marginBottom: spacing.md, textTransform: 'uppercase' },
    chapterCard: {
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: spacing.md,
        marginBottom: spacing.md,
        borderWidth: 1,
        borderColor: colors.border,
    },
    chapterHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
    chapterTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
    deleteIcon: { fontSize: 16, color: colors.textMuted },
    lessonRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.sm,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    lessonIcon: { fontSize: 16, marginRight: spacing.sm },
    lessonTitle: { flex: 1, fontSize: 14, color: colors.text },
    lessonDuration: { fontSize: 12, color: colors.textMuted },
    addLessonBtn: { paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
    addLessonText: { fontSize: 14, color: colors.primary, fontWeight: '500' },
    addChapterForm: { marginBottom: spacing.md },
    addChapterButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.md, marginTop: spacing.sm },
    cancelText: { fontSize: 14, color: colors.textMuted, paddingVertical: spacing.sm },
    addChapterBtn: {
        paddingVertical: spacing.md,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: colors.border,
        borderStyle: 'dashed',
        alignItems: 'center',
    },
    addChapterText: { fontSize: 14, color: colors.primary, fontWeight: '600' },
    saveBtn: { marginTop: spacing.lg },
});

export default CourseEditorScreen;
