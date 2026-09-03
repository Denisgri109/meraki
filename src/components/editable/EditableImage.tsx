import React, { useState, useCallback } from 'react';
import {
    View,
    Image,
    Text,
    StyleSheet,
    TouchableOpacity,
    Modal,
    ScrollView,
    ImageStyle,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useEditMode } from '../../contexts/EditContext';
import { ImageUrlUpload } from '../ImageUrlUpload';
import { colors, spacing, layout } from '../../theme';

interface EditableImageProps {
    contentKey: string;
    fallbackSource: number | { uri: string };
    style?: ImageStyle | ImageStyle[];
    resizeMode?: 'cover' | 'contain' | 'stretch' | 'repeat' | 'center';
    bucket?: string;
    pathPrefix?: string;
    alt?: string;
}

export function EditableImage({
    contentKey,
    fallbackSource,
    style,
    resizeMode = 'cover',
    bucket = 'site-images',
    pathPrefix = 'mobile-content',
    alt = 'Image',
}: EditableImageProps) {
    const { isEditMode, canEdit, getContent, updateContent } = useEditMode();
    const [showUpload, setShowUpload] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);

    const customUrl = getContent(contentKey, '');
    const source = customUrl ? { uri: customUrl } : fallbackSource;
    const hasCustom = Boolean(customUrl);

    const handleUpload = useCallback(
        async (publicUrl: string) => {
            await updateContent(contentKey, publicUrl);
            setShowUpload(false);
            setModalVisible(false);
        },
        [contentKey, updateContent]
    );

    const handleReset = useCallback(async () => {
        await updateContent(contentKey, '');
        setModalVisible(false);
    }, [contentKey, updateContent]);

    if (!isEditMode || !canEdit) {
        return <Image source={source as any} style={style as any} resizeMode={resizeMode} />;
    }

    return (
        <>
            <View style={[style as any, styles.editContainer]}>
                <Image
                    source={source as any}
                    style={StyleSheet.absoluteFillObject}
                    resizeMode={resizeMode}
                />
                {/* Pink border overlay */}
                <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
                    <View style={styles.borderOverlay} />
                </View>
                {/* Edit button */}
                <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Edit"
                    style={styles.replaceButton}
                    onPress={() => setModalVisible(true)}
                    activeOpacity={0.8}
                >
                    <MaterialIcons name="edit" size={16} color="#fff" />
                </TouchableOpacity>
                {hasCustom && (
                    <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel="Restore default"
                        style={styles.resetButton}
                        onPress={handleReset}
                        activeOpacity={0.8}
                    >
                        <MaterialIcons name="restore" size={16} color="#fff" />
                    </TouchableOpacity>
                )}
            </View>

            {/* Upload Modal */}
            <Modal
                visible={modalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <MaterialIcons name="photo-library" size={24} color={colors.textSecondary} />
                            <Text style={styles.modalTitle}>Replace Image</Text>
                            <TouchableOpacity
                                accessibilityRole="button"
                                accessibilityLabel="Close"
                                onPress={() => setModalVisible(false)}
                                style={styles.closeButton}
                            >
                                <MaterialIcons name="close" size={22} color={colors.textMuted} />
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.modalSubtitle}>{alt}</Text>

                        {/* Preview of current image */}
                        <View style={styles.previewContainer}>
                            <Image
                                source={source as any}
                                style={styles.previewImage}
                                resizeMode="cover"
                            />
                        </View>

                        <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
                            <ImageUrlUpload
                                onUpload={handleUpload}
                                bucket={bucket}
                                pathPrefix={pathPrefix}
                                label="Paste new image URL"
                                compact={false}
                            />
                        </ScrollView>

                        {hasCustom && (
                            <TouchableOpacity
                                style={styles.resetFullButton}
                                onPress={handleReset}
                                activeOpacity={0.7}
                            >
                                <MaterialIcons name="restore" size={16} color="#EF4444" />
                                <Text style={styles.resetFullText}>Reset to Default Image</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </Modal>
        </>
    );
}

const styles = StyleSheet.create({
    editContainer: {
        overflow: 'hidden',
        position: 'relative',
    },
    borderOverlay: {
        ...StyleSheet.absoluteFillObject,
        borderWidth: 3,
        borderColor: '#EC4899',
        borderRadius: 2,
    },
    replaceButton: {
        position: 'absolute',
        top: 8,
        right: 8,
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(236, 72, 153, 0.9)',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 4,
    },
    resetButton: {
        position: 'absolute',
        top: 8,
        left: 8,
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(107, 114, 128, 0.9)',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 4,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        backgroundColor: '#fff',
        borderRadius: layout.borderRadius.lg,
        padding: spacing.lg,
        width: '100%',
        maxWidth: 400,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 4,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: colors.text,
        flex: 1,
    },
    closeButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalSubtitle: {
        fontSize: 13,
        color: colors.textMuted,
        marginBottom: spacing.md,
    },
    previewContainer: {
        width: '100%',
        height: 160,
        borderRadius: layout.borderRadius.md,
        overflow: 'hidden',
        marginBottom: spacing.md,
        backgroundColor: colors.surfaceLight,
    },
    previewImage: {
        width: '100%',
        height: '100%',
    },
    resetFullButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: spacing.md,
        marginTop: spacing.md,
        borderRadius: layout.borderRadius.md,
        backgroundColor: 'rgba(239, 68, 68, 0.08)',
        borderWidth: 1,
        borderColor: 'rgba(239, 68, 68, 0.2)',
    },
    resetFullText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#EF4444',
    },
});
