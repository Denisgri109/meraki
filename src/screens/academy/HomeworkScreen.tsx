import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Alert,
    TextInput,
    Image,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { ScreenBackground, Button } from '../../components/ui';
import { colors, spacing } from '../../theme';

type AcademyStackParamList = {
    Homework: { lessonId: string };
};

export function HomeworkScreen() {
    const navigation = useNavigation<any>();
    const route = useRoute<RouteProp<AcademyStackParamList, 'Homework'>>();
    const { user } = useAuth();
    const { lessonId } = route.params;

    const [image, setImage] = useState<string | null>(null);
    const [notes, setNotes] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.8,
        });

        if (!result.canceled) {
            setImage(result.assets[0].uri);
        }
    };

    const takePhoto = async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission needed', 'Please allow camera access to take photos.');
            return;
        }

        const result = await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.8,
        });

        if (!result.canceled) {
            setImage(result.assets[0].uri);
        }
    };

    const handleSubmit = async () => {
        if (!image) {
            Alert.alert('No Photo', 'Please add a photo of your work.');
            return;
        }

        if (!user) {
            Alert.alert('Error', 'Please log in to submit homework.');
            return;
        }

        setSubmitting(true);

        try {
            // Read image as base64 using FileSystem
            const base64 = await FileSystem.readAsStringAsync(image, {
                encoding: 'base64',
            });

            // Upload image to storage using base64-arraybuffer decode
            const fileName = `homework/${user.id}/${lessonId}_${Date.now()}.jpg`;

            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('homework-submissions')
                .upload(fileName, decode(base64), {
                    contentType: 'image/jpeg',
                    upsert: false
                });

            if (uploadError) throw uploadError;

            // Get public URL
            const { data: urlData } = supabase.storage
                .from('homework-submissions')
                .getPublicUrl(fileName);

            // Create submission record
            const { error: submitError } = await (supabase as any)
                .from('homework_submissions')
                .insert({
                    lesson_id: lessonId,
                    student_id: user.id,
                    photo_url: urlData.publicUrl,
                    notes: notes || null,
                    status: 'pending',
                });

            if (submitError) throw submitError;

            Alert.alert(
                '✅ Submitted!',
                'Your homework has been submitted for review. Your instructor will provide feedback soon.',
                [{ text: 'OK', onPress: () => navigation.goBack() }]
            );
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to submit homework');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <ScreenBackground>
            <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
                <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                    {/* Header */}
                    <View style={styles.header}>
                        <TouchableOpacity onPress={() => navigation.goBack()}>
                            <Text style={styles.backButton}>← Back</Text>
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>Submit Homework</Text>
                        <View style={{ width: 60 }} />
                    </View>

                    {/* Instructions */}
                    <View style={styles.instructions}>
                        <Text style={styles.instructionsIcon}>📝</Text>
                        <Text style={styles.instructionsText}>
                            Upload a photo of your completed work for instructor review and feedback.
                        </Text>
                    </View>

                    {/* Photo Section */}
                    <Text style={styles.sectionTitle}>Your Work</Text>
                    {image ? (
                        <View style={styles.imagePreview}>
                            <Image source={{ uri: image }} style={styles.previewImage} />
                            <TouchableOpacity
                                style={styles.removeImageButton}
                                onPress={() => setImage(null)}
                            >
                                <Text style={styles.removeImageText}>✕</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <View style={styles.imageButtons}>
                            <TouchableOpacity style={styles.imageButton} onPress={takePhoto}>
                                <Text style={styles.imageButtonIcon}>📷</Text>
                                <Text style={styles.imageButtonText}>Take Photo</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.imageButton} onPress={pickImage}>
                                <Text style={styles.imageButtonIcon}>🖼️</Text>
                                <Text style={styles.imageButtonText}>Choose from Gallery</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Notes */}
                    <Text style={styles.sectionTitle}>Notes (Optional)</Text>
                    <TextInput
                        style={styles.notesInput}
                        value={notes}
                        onChangeText={setNotes}
                        placeholder="Add any notes or questions for your instructor..."
                        placeholderTextColor={colors.textMuted}
                        multiline
                        numberOfLines={4}
                    />

                    {/* Submit */}
                    <View style={styles.submitSection}>
                        <Button
                            title={submitting ? 'Submitting...' : 'Submit for Review'}
                            onPress={handleSubmit}
                            fullWidth
                            disabled={submitting || !image}
                        />
                    </View>
                </ScrollView>

                {submitting && (
                    <View style={styles.loadingOverlay}>
                        <ActivityIndicator size="large" color={colors.primary} />
                        <Text style={styles.loadingText}>Uploading your work...</Text>
                    </View>
                )}
            </SafeAreaView>
        </ScreenBackground>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    content: { padding: spacing.lg, paddingBottom: 100 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: spacing.lg,
    },
    backButton: { fontSize: 16, color: colors.textSecondary },
    headerTitle: { fontSize: 18, fontWeight: '600', color: colors.text },
    instructions: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(139,92,246,0.1)',
        borderRadius: 12,
        padding: spacing.md,
        marginBottom: spacing.xl,
        borderWidth: 1,
        borderColor: 'rgba(139,92,246,0.2)',
    },
    instructionsIcon: { fontSize: 24, marginRight: spacing.md },
    instructionsText: { flex: 1, fontSize: 14, color: colors.text, lineHeight: 20 },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.textSecondary,
        marginBottom: spacing.md,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    imageButtons: { gap: spacing.md, marginBottom: spacing.xl },
    imageButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: spacing.lg,
        borderWidth: 1,
        borderColor: colors.border,
    },
    imageButtonIcon: { fontSize: 24, marginRight: spacing.md },
    imageButtonText: { fontSize: 16, color: colors.text, fontWeight: '500' },
    imagePreview: { marginBottom: spacing.xl, position: 'relative' },
    previewImage: {
        width: '100%',
        height: 250,
        borderRadius: 12,
        backgroundColor: colors.surface,
    },
    removeImageButton: {
        position: 'absolute',
        top: spacing.sm,
        right: spacing.sm,
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(0,0,0,0.6)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    removeImageText: { color: colors.text, fontSize: 16 },
    notesInput: {
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: spacing.md,
        color: colors.text,
        fontSize: 16,
        borderWidth: 1,
        borderColor: colors.border,
        minHeight: 100,
        textAlignVertical: 'top',
        marginBottom: spacing.xl,
    },
    submitSection: { marginTop: spacing.md },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.7)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingText: { color: colors.text, marginTop: spacing.md, fontSize: 16 },
});

export default HomeworkScreen;
