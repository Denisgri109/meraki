import React, { useState, useCallback, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Dimensions,
    Image,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useEditMode } from '../../contexts/EditContext';
import { ImageUrlUpload } from '../../components/ImageUrlUpload';
import { ScreenBackground, MerakiText } from '../../components/ui';
import { colors, spacing, layout } from '../../theme';
import { safeGoBack } from '../../navigation/navigationUtils';

const { width } = Dimensions.get('window');

const CUSTOMIZABLE_IMAGES = [
    {
        contentKey: 'mobile.home.hero_banner',
        label: 'Home Hero Banner',
        description: 'Main banner on the client home screen',
        fallbackSource: require('../../assets/hero_beauty_banner.png'),
        previewRatio: { width: 340, height: 150 },
    },
    {
        contentKey: 'mobile.home.editorial_shop',
        label: 'Shop Editorial Card',
        description: 'Image for the "New Arrivals" shop card',
        fallbackSource: require('../../assets/editorial_new_arrivals.png'),
        previewRatio: { width: 160, height: 200 },
    },
    {
        contentKey: 'mobile.home.editorial_academy',
        label: 'Academy Editorial Card',
        description: 'Image for the "Academy" learn card',
        fallbackSource: require('../../assets/editorial_academy.png'),
        previewRatio: { width: 160, height: 200 },
    },
];

export function CustomizeAppScreen() {
    const navigation = useNavigation<any>();
    const { isEditMode, canEdit, toggleEditMode, content, getContent, updateContent, refreshContent, resetContent } = useEditMode();
    const [resetting, setResetting] = useState(false);
    const [activeUploadKey, setActiveUploadKey] = useState<string | null>(null);

    useEffect(() => {
        refreshContent();
    }, [refreshContent]);

    const handleResetAll = useCallback(() => {
        Alert.alert(
            'Reset All Images',
            'This will reset ALL customized app images back to the original defaults. This cannot be undone.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Reset',
                    style: 'destructive',
                    onPress: async () => {
                        setResetting(true);
                        await resetContent('mobile.');
                        await refreshContent();
                        setResetting(false);
                        Alert.alert('Success', 'All images reset to defaults.');
                    },
                },
            ]
        );
    }, [resetContent, refreshContent]);

    const handleUploadFor = useCallback(
        (contentKey: string) => async (publicUrl: string) => {
            await updateContent(contentKey, publicUrl);
            setActiveUploadKey(null);
        },
        [updateContent]
    );

    const handleResetOne = useCallback(
        (contentKey: string) => {
            Alert.alert(
                'Reset Image',
                'Reset this image back to the default?',
                [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Reset',
                        style: 'destructive',
                        onPress: async () => {
                            await updateContent(contentKey, '');
                        },
                    },
                ]
            );
        },
        [updateContent]
    );

    const customCount = Object.keys(content).filter((k) => k.startsWith('mobile.')).length;

    return (
        <ScreenBackground>
            <SafeAreaView style={styles.safeArea} edges={['top']}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => safeGoBack(navigation)} style={styles.backBtn}>
                        <MaterialIcons name="arrow-back" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <MerakiText style={styles.headerTitle}>Customize App</MerakiText>
                    <View style={styles.headerSpacer} />
                </View>

                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Edit Mode Toggle */}
                    <View style={styles.toggleCard}>
                        <View style={styles.toggleRow}>
                            <View style={styles.toggleInfo}>
                                <View style={[styles.toggleIcon, isEditMode ? styles.toggleIconActive : styles.toggleIconInactive]}>
                                    <MaterialIcons
                                        name={isEditMode ? 'check' : 'edit'}
                                        size={22}
                                        color={isEditMode ? '#22C55E' : '#EC4899'}
                                    />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <MerakiText style={styles.toggleTitle}>
                                        Edit Mode: {isEditMode ? 'ON' : 'OFF'}
                                    </MerakiText>
                                    <MerakiText style={styles.toggleSubtitle}>
                                        {isEditMode
                                            ? 'Browse the app and tap any image with a pink border to replace it.'
                                            : 'Turn on to edit images on any screen of the app.'}
                                    </MerakiText>
                                </View>
                            </View>
                            <TouchableOpacity
                                style={[
                                    styles.toggleButton,
                                    isEditMode ? styles.toggleButtonActive : styles.toggleButtonInactive,
                                ]}
                                onPress={toggleEditMode}
                                activeOpacity={0.7}
                            >
                                <MerakiText style={styles.toggleButtonText}>
                                    {isEditMode ? 'Turn Off' : 'Turn On'}
                                </MerakiText>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Info Banner */}
                    <View style={styles.infoBanner}>
                        <MaterialIcons name="info" size={18} color={colors.textSecondary} />
                        <MerakiText style={styles.infoText}>
                            Only images can be customized in the mobile app. Text changes are managed from the web dashboard.
                        </MerakiText>
                    </View>

                    {/* Customizable Images Section */}
                    <MerakiText style={styles.sectionLabel}>CUSTOMIZABLE IMAGES</MerakiText>
                    <View style={styles.imageListContainer}>
                        {CUSTOMIZABLE_IMAGES.map((item, index) => {
                            const customUrl = getContent(item.contentKey, '');
                            const hasCustom = Boolean(customUrl);
                            const imageSource = customUrl ? { uri: customUrl } : item.fallbackSource;

                            return (
                                <View
                                    key={item.contentKey}
                                    style={[styles.imageCard, index === CUSTOMIZABLE_IMAGES.length - 1 && { borderBottomWidth: 0 }]}
                                >
                                    {/* Preview */}
                                    <View style={styles.imagePreviewWrap}>
                                        <Image
                                            source={imageSource as any}
                                            style={styles.imagePreview}
                                            resizeMode="cover"
                                        />
                                        {hasCustom && (
                                            <View style={styles.customBadge}>
                                                <MaterialIcons name="edit" size={10} color="#fff" />
                                                <Text style={styles.customBadgeText}>Custom</Text>
                                            </View>
                                        )}
                                    </View>

                                    {/* Label & Actions */}
                                    <View style={styles.imageInfo}>
                                        <MerakiText style={styles.imageLabel}>{item.label}</MerakiText>
                                        <MerakiText style={styles.imageDesc}>{item.description}</MerakiText>

                                        {activeUploadKey === item.contentKey ? (
                                            <View style={styles.uploadWrap}>
                                                <ImageUrlUpload
                                                    onUpload={handleUploadFor(item.contentKey)}
                                                    bucket="site-images"
                                                    pathPrefix={`mobile-content/${item.contentKey.split('.').pop()}`}
                                                    label="Paste new image URL"
                                                    compact={false}
                                                />
                                                <TouchableOpacity
                                                    onPress={() => setActiveUploadKey(null)}
                                                    style={styles.cancelUploadBtn}
                                                >
                                                    <MerakiText style={styles.cancelUploadText}>Cancel</MerakiText>
                                                </TouchableOpacity>
                                            </View>
                                        ) : (
                                            <View style={styles.imageActions}>
                                                <TouchableOpacity
                                                    style={styles.replaceBtn}
                                                    onPress={() => setActiveUploadKey(item.contentKey)}
                                                    activeOpacity={0.7}
                                                >
                                                    <MaterialIcons name="cloud-upload" size={15} color="#fff" />
                                                    <MerakiText style={styles.replaceBtnText}>Replace</MerakiText>
                                                </TouchableOpacity>
                                                {hasCustom && (
                                                    <TouchableOpacity
                                                        style={styles.resetOneBtn}
                                                        onPress={() => handleResetOne(item.contentKey)}
                                                        activeOpacity={0.7}
                                                    >
                                                        <MaterialIcons name="restore" size={15} color="#EF4444" />
                                                        <MerakiText style={styles.resetOneText}>Reset</MerakiText>
                                                    </TouchableOpacity>
                                                )}
                                            </View>
                                        )}
                                    </View>
                                </View>
                            );
                        })}
                    </View>

                    {/* Danger Zone - Reset All */}
                    <MerakiText style={styles.sectionLabel}>DANGER ZONE</MerakiText>
                    <View style={styles.dangerCard}>
                        <View style={styles.dangerInfo}>
                            <View style={styles.dangerIconWrap}>
                                <MaterialIcons name="restore" size={20} color="#EF4444" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <MerakiText style={styles.dangerTitle}>Reset All Images</MerakiText>
                                <MerakiText style={styles.dangerDesc}>
                                    Reset all customized app images back to original defaults.{'\n'}
                                    Customized images: {customCount}
                                </MerakiText>
                            </View>
                        </View>
                        <TouchableOpacity
                            style={[styles.dangerButton, resetting && styles.dangerButtonDisabled]}
                            onPress={handleResetAll}
                            disabled={resetting}
                            activeOpacity={0.7}
                        >
                            {resetting ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <>
                                    <MaterialIcons name="restore" size={16} color="#fff" />
                                    <MerakiText style={styles.dangerButtonText}>Reset All</MerakiText>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>

                    <View style={{ height: 40 }} />
                </ScrollView>
            </SafeAreaView>
        </ScreenBackground>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.06)',
    },
    backBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: '700',
        color: colors.text,
    },
    headerSpacer: { width: 40 },

    scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },

    /* Edit mode toggle card */
    toggleCard: {
        backgroundColor: 'rgba(0,0,0,0.03)',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.06)',
        padding: 16,
        marginBottom: 16,
        marginTop: 12,
    },
    toggleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
    },
    toggleInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flex: 1,
    },
    toggleIcon: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
    },
    toggleIconActive: {
        backgroundColor: 'rgba(34, 197, 94, 0.12)',
    },
    toggleIconInactive: {
        backgroundColor: 'rgba(236, 72, 153, 0.12)',
    },
    toggleTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: colors.text,
        marginBottom: 2,
    },
    toggleSubtitle: {
        fontSize: 12,
        color: colors.textMuted,
        lineHeight: 16,
    },
    toggleButton: {
        paddingHorizontal: 18,
        paddingVertical: 10,
        borderRadius: 22,
    },
    toggleButtonActive: {
        backgroundColor: '#22C55E',
    },
    toggleButtonInactive: {
        backgroundColor: '#EC4899',
    },
    toggleButtonText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#fff',
    },

    /* Info banner */
    infoBanner: {
        flexDirection: 'row',
        gap: 10,
        backgroundColor: 'rgba(99, 102, 241, 0.08)',
        borderWidth: 1,
        borderColor: 'rgba(99, 102, 241, 0.15)',
        borderRadius: 12,
        padding: 14,
        marginBottom: 24,
    },
    infoText: {
        fontSize: 12,
        color: colors.textSecondary,
        lineHeight: 17,
        flex: 1,
    },

    /* Section label */
    sectionLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: 'rgba(0,0,0,0.25)',
        letterSpacing: 1.5,
        marginBottom: 14,
    },

    /* Image list */
    imageListContainer: {
        backgroundColor: 'rgba(0,0,0,0.03)',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.06)',
        marginBottom: 28,
        overflow: 'hidden',
    },
    imageCard: {
        flexDirection: 'row',
        padding: 14,
        gap: 14,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.05)',
    },
    imagePreviewWrap: {
        width: 80,
        height: 80,
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: 'rgba(0,0,0,0.06)',
        position: 'relative',
    },
    imagePreview: {
        width: '100%',
        height: '100%',
    },
    customBadge: {
        position: 'absolute',
        top: 4,
        right: 4,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        backgroundColor: '#EC4899',
        paddingHorizontal: 6,
        paddingVertical: 3,
        borderRadius: 10,
    },
    customBadgeText: {
        fontSize: 9,
        fontWeight: '700',
        color: '#fff',
    },
    imageInfo: {
        flex: 1,
    },
    imageLabel: {
        fontSize: 14,
        fontWeight: '700',
        color: colors.text,
        marginBottom: 3,
    },
    imageDesc: {
        fontSize: 12,
        color: colors.textMuted,
        marginBottom: 10,
    },
    imageActions: {
        flexDirection: 'row',
        gap: 8,
    },
    replaceBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: '#EC4899',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 10,
    },
    replaceBtnText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#fff',
    },
    resetOneBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: 'rgba(239, 68, 68, 0.08)',
        borderWidth: 1,
        borderColor: 'rgba(239, 68, 68, 0.2)',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 10,
    },
    resetOneText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#EF4444',
    },
    uploadWrap: {
        marginTop: 4,
    },
    cancelUploadBtn: {
        marginTop: 8,
        alignSelf: 'flex-start',
    },
    cancelUploadText: {
        fontSize: 13,
        color: colors.textMuted,
        textDecorationLine: 'underline',
    },

    /* Danger zone */
    dangerCard: {
        backgroundColor: 'rgba(239, 68, 68, 0.04)',
        borderWidth: 1,
        borderColor: 'rgba(239, 68, 68, 0.15)',
        borderRadius: 16,
        padding: 16,
        marginBottom: 28,
    },
    dangerInfo: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 14,
    },
    dangerIconWrap: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    dangerTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: colors.text,
        marginBottom: 3,
    },
    dangerDesc: {
        fontSize: 12,
        color: colors.textMuted,
        lineHeight: 17,
    },
    dangerButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#EF4444',
        paddingVertical: 14,
        borderRadius: 12,
    },
    dangerButtonDisabled: {
        opacity: 0.5,
    },
    dangerButtonText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#fff',
    },
});

export default CustomizeAppScreen;
