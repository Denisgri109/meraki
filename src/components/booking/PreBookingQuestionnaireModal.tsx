import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    ScrollView,
    TextInput,
    Image,
    ActivityIndicator,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Button } from '../ui';
import { colors, spacing } from '../../theme';
import { usePreBookingQuestionnaire } from './hooks/usePreBookingQuestionnaire';

interface PreBookingQuestionnaireModalProps {
    visible: boolean;
    onClose: () => void;
    onSubmit: (consultationId: string) => void;
    serviceId: string;
    serviceName: string;
    masterId: string | null;
}

const TIME_OPTIONS = [
    { value: '1-3 months', label: '1-3 months ago' },
    { value: '3-6 months', label: '3-6 months ago' },
    { value: '6-12 months', label: '6-12 months ago' },
    { value: '1+ years', label: 'More than a year ago' },
];

export function PreBookingQuestionnaireModal({
    visible,
    onClose,
    onSubmit,
    serviceId,
    serviceName,
    masterId,
}: PreBookingQuestionnaireModalProps) {
    const {
        formData,
        setFormData,
        loading,
        uploadingPhotos,
        handleClose,
        pickPhotos,
        removePhoto,
        handleSubmit,
    } = usePreBookingQuestionnaire({
        serviceId,
        masterId,
        onClose,
        onSubmit,
    });

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent
            onRequestClose={handleClose}
        >
            <BlurView intensity={30} style={styles.overlay}>
                <View style={styles.modalContainer}>
                    <View style={styles.modalContent}>
                        {/* Header */}
                        <View style={styles.header}>
                            <Text style={styles.title}>Before You Book</Text>
                            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                                <Text style={styles.closeButtonText}>✕</Text>
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                            <Text style={styles.subtitle}>
                                {serviceName} requires a quick consultation before booking.
                                This helps ensure the best results for you.
                            </Text>

                            {/* Question 1: Had Before */}
                            <View style={styles.questionSection}>
                                <Text style={styles.questionLabel}>
                                    Have you had this service before?
                                </Text>
                                <View style={styles.toggleContainer}>
                                    <TouchableOpacity
                                        style={[
                                            styles.toggleButton,
                                            !formData.hadBefore && styles.toggleButtonActive
                                        ]}
                                        onPress={() => setFormData(prev => ({ ...prev, hadBefore: false }))}
                                    >
                                        <Text style={[
                                            styles.toggleText,
                                            !formData.hadBefore && styles.toggleTextActive
                                        ]}>No</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[
                                            styles.toggleButton,
                                            formData.hadBefore && styles.toggleButtonActive
                                        ]}
                                        onPress={() => setFormData(prev => ({ ...prev, hadBefore: true }))}
                                    >
                                        <Text style={[
                                            styles.toggleText,
                                            formData.hadBefore && styles.toggleTextActive
                                        ]}>Yes</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {/* Conditional Questions */}
                            {formData.hadBefore && (
                                <>
                                    {/* Question 2: How Long Ago */}
                                    <View style={styles.questionSection}>
                                        <Text style={styles.questionLabel}>How long ago?</Text>
                                        <View style={styles.optionsGrid}>
                                            {TIME_OPTIONS.map((option) => (
                                                <TouchableOpacity
                                                    key={option.value}
                                                    style={[
                                                        styles.optionButton,
                                                        formData.howLongAgo === option.value && styles.optionButtonActive
                                                    ]}
                                                    onPress={() => setFormData(prev => ({ ...prev, howLongAgo: option.value }))}
                                                >
                                                    <Text style={[
                                                        styles.optionText,
                                                        formData.howLongAgo === option.value && styles.optionTextActive
                                                    ]}>
                                                        {option.label}
                                                    </Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    </View>

                                    {/* Question 3: Was My Work */}
                                    <View style={styles.questionSection}>
                                        <Text style={styles.questionLabel}>
                                            Was it my work?
                                        </Text>
                                        <View style={styles.toggleContainer}>
                                            <TouchableOpacity
                                                style={[
                                                    styles.toggleButton,
                                                    !formData.wasMyWork && styles.toggleButtonActive
                                                ]}
                                                onPress={() => setFormData(prev => ({ ...prev, wasMyWork: false }))}
                                            >
                                                <Text style={[
                                                    styles.toggleText,
                                                    !formData.wasMyWork && styles.toggleTextActive
                                                ]}>No</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={[
                                                    styles.toggleButton,
                                                    formData.wasMyWork && styles.toggleButtonActive
                                                ]}
                                                onPress={() => setFormData(prev => ({ ...prev, wasMyWork: true }))}
                                            >
                                                <Text style={[
                                                    styles.toggleText,
                                                    formData.wasMyWork && styles.toggleTextActive
                                                ]}>Yes</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                </>
                            )}

                            {/* Photos */}
                            <View style={styles.questionSection}>
                                <Text style={styles.questionLabel}>
                                    Upload photos of current state *
                                </Text>
                                <Text style={styles.hintText}>
                                    Clear, well-lit photos help with accurate assessment (up to 3)
                                </Text>

                                <TouchableOpacity
                                    style={styles.uploadButton}
                                    onPress={pickPhotos}
                                    disabled={uploadingPhotos || formData.photos.length >= 3}
                                >
                                    {uploadingPhotos ? (
                                        <ActivityIndicator color={colors.primary} />
                                    ) : (
                                        <Text style={styles.uploadButtonText}>
                                            📷 Add Photos ({formData.photos.length}/3)
                                        </Text>
                                    )}
                                </TouchableOpacity>

                                {formData.photos.length > 0 && (
                                    <View style={styles.photoGrid}>
                                        {formData.photos.map((url, index) => (
                                            <View key={index} style={styles.photoContainer}>
                                                <Image source={{ uri: url }} style={styles.photo} />
                                                <TouchableOpacity
                                                    style={styles.removePhotoButton}
                                                    onPress={() => removePhoto(url)}
                                                >
                                                    <Text style={styles.removePhotoText}>×</Text>
                                                </TouchableOpacity>
                                            </View>
                                        ))}
                                    </View>
                                )}
                            </View>

                            {/* Additional Notes */}
                            <View style={styles.questionSection}>
                                <Text style={styles.questionLabel}>Additional notes (optional)</Text>
                                <TextInput
                                    style={styles.textArea}
                                    value={formData.additionalNotes}
                                    onChangeText={(text) => setFormData(prev => ({ ...prev, additionalNotes: text }))}
                                    placeholder="Any concerns or specific requests..."
                                    placeholderTextColor={colors.textMuted}
                                    multiline
                                    numberOfLines={3}
                                />
                            </View>

                            {/* Info Box */}
                            <View style={styles.infoBox}>
                                <Text style={styles.infoIcon}>⏰</Text>
                                <Text style={styles.infoText}>
                                    You'll receive a response within 24-48 hours.
                                    If approved, you can complete your booking right away.
                                </Text>
                            </View>
                        </ScrollView>

                        {/* Submit Button */}
                        <View style={styles.footer}>
                            <Button
                                title="Submit for Review"
                                onPress={handleSubmit}
                                loading={loading}
                                fullWidth
                            />
                        </View>
                    </View>
                </View>
            </BlurView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    modalContainer: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: colors.surface,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '90%',
        borderWidth: 1,
        borderColor: colors.border,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: colors.text,
    },
    closeButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: colors.surfaceLight,
        justifyContent: 'center',
        alignItems: 'center',
    },
    closeButtonText: {
        fontSize: 18,
        color: colors.textSecondary,
    },
    scrollView: {
        padding: spacing.lg,
    },
    subtitle: {
        fontSize: 14,
        color: colors.textSecondary,
        lineHeight: 20,
        marginBottom: spacing.xl,
    },
    questionSection: {
        marginBottom: spacing.xl,
    },
    questionLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.text,
        marginBottom: spacing.md,
    },
    hintText: {
        fontSize: 12,
        color: colors.textMuted,
        marginBottom: spacing.md,
    },
    toggleContainer: {
        flexDirection: 'row',
        gap: spacing.sm,
    },
    toggleButton: {
        flex: 1,
        paddingVertical: spacing.md,
        borderRadius: 12,
        backgroundColor: colors.surfaceLight,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.border,
    },
    toggleButtonActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    toggleText: {
        fontSize: 15,
        fontWeight: '600',
        color: colors.textSecondary,
    },
    toggleTextActive: {
        color: '#fff',
    },
    optionsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
    },
    optionButton: {
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        borderRadius: 20,
        backgroundColor: colors.surfaceLight,
        borderWidth: 1,
        borderColor: colors.border,
    },
    optionButtonActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    optionText: {
        fontSize: 13,
        color: colors.text,
    },
    optionTextActive: {
        color: '#fff',
        fontWeight: '600',
    },
    uploadButton: {
        backgroundColor: colors.surfaceLight,
        borderRadius: 12,
        padding: spacing.lg,
        alignItems: 'center',
        borderWidth: 2,
        borderColor: colors.primary,
        borderStyle: 'dashed',
    },
    uploadButtonText: {
        fontSize: 15,
        color: colors.primary,
        fontWeight: '600',
    },
    photoGrid: {
        flexDirection: 'row',
        gap: spacing.sm,
        marginTop: spacing.md,
    },
    photoContainer: {
        position: 'relative',
        width: 80,
        height: 80,
        borderRadius: 12,
        overflow: 'hidden',
    },
    photo: {
        width: '100%',
        height: '100%',
    },
    removePhotoButton: {
        position: 'absolute',
        top: 4,
        right: 4,
        backgroundColor: 'rgba(0,0,0,0.7)',
        borderRadius: 10,
        width: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    removePhotoText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    textArea: {
        backgroundColor: colors.surfaceLight,
        borderRadius: 12,
        padding: spacing.md,
        color: colors.text,
        fontSize: 15,
        borderWidth: 1,
        borderColor: colors.border,
        height: 80,
        textAlignVertical: 'top',
    },
    infoBox: {
        flexDirection: 'row',
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        borderRadius: 12,
        padding: spacing.md,
        gap: spacing.sm,
        marginBottom: spacing.lg,
    },
    infoIcon: {
        fontSize: 18,
    },
    infoText: {
        flex: 1,
        fontSize: 13,
        color: colors.textSecondary,
        lineHeight: 18,
    },
    footer: {
        padding: spacing.lg,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
});

export default PreBookingQuestionnaireModal;
