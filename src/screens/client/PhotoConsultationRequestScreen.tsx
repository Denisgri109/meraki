import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TextInput,
    TouchableOpacity,
    Alert,
    Image,
    Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../lib/supabase';
import { Button, ScreenBackground } from '../../components/ui';
import { useModal } from '../../contexts/ModalContext';
import { colors, spacing } from '../../theme';
import { PhotoConsultation } from '../../types/database';
import { useHideTabBar } from '../../hooks/useHideTabBar';

const SERVICE_TYPES = [
    'Eyelash Extensions',
    'Eyebrow Shaping',
    'Microblading',
    'Lash Lift',
    'Brow Lamination',
    'Other',
];

export function PhotoConsultationRequestScreen() {
    useHideTabBar();
    const navigation = useNavigation<any>();
    const route = useRoute<RouteProp<{ params: { masterId?: string } }, 'params'>>();
    const { showAlert, showModal, hideModal } = useModal();
    const preselectedMasterId = route.params?.masterId;

    const [loading, setLoading] = useState(false);
    const [masters, setMasters] = useState<any[]>([]);
    const [selectedMasterId, setSelectedMasterId] = useState<string | null>(preselectedMasterId || null);

    const [formData, setFormData] = useState({
        title: '',
        description: '',
        serviceType: '',
        photos: [] as string[],
    });

    useEffect(() => {
        fetchMasters();
    }, []);

    const fetchMasters = async () => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('id, full_name, bio, avatar_url')
                .eq('role', 'master')
                .eq('is_master', true);

            if (error) throw error;
            setMasters(data || []);
        } catch (error) {
            console.error('Error fetching masters:', error);
        }
    };

    const pickPhotos = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsMultipleSelection: true,
                selectionLimit: 5,
                quality: 0.8,
            });

            if (!result.canceled && result.assets) {
                setLoading(true);
                const uploadedUrls: string[] = [];

                for (const asset of result.assets) {
                    const fileName = `consultations/${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;

                    const response = await fetch(asset.uri);
                    const blob = await response.blob();

                    const { data, error } = await supabase.storage
                        .from('consultation-photos')
                        .upload(fileName, blob, {
                            contentType: 'image/jpeg',
                        });

                    if (error) throw error;

                    const { data: { publicUrl } } = supabase.storage
                        .from('consultation-photos')
                        .getPublicUrl(data.path);

                    uploadedUrls.push(publicUrl);
                }

                setFormData(prev => ({
                    ...prev,
                    photos: [...prev.photos, ...uploadedUrls].slice(0, 5)
                }));

                showAlert('Success', `Uploaded ${uploadedUrls.length} photo(s)`, 'success');
            }
        } catch (error: any) {
            console.error('Error uploading photos:', error);
            showAlert('Error', 'Failed to upload photos. Please try again.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const removePhoto = (url: string) => {
        setFormData(prev => ({
            ...prev,
            photos: prev.photos.filter(p => p !== url)
        }));
    };

    const handleSubmit = async () => {
        if (!formData.title.trim()) {
            showAlert('Error', 'Please provide a title for your consultation', 'error');
            return;
        }
        if (!formData.description.trim() || formData.description.length < 20) {
            showAlert('Error', 'Please provide a detailed description (at least 20 characters)', 'error');
            return;
        }
        if (!formData.serviceType) {
            showAlert('Error', 'Please select the service type you\'re interested in', 'error');
            return;
        }
        if (formData.photos.length === 0) {
            showAlert('Error', 'Please upload at least one photo', 'error');
            return;
        }

        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            const { error } = await supabase
                .from('photo_consultations')
                .insert({
                    client_id: user.id,
                    master_id: selectedMasterId,
                    title: formData.title.trim(),
                    description: formData.description.trim(),
                    service_type: formData.serviceType,
                    photo_urls: formData.photos,
                    status: 'pending',
                });

            if (error) throw error;

            showModal({
                title: 'Consultation Submitted!',
                message: 'Your consultation request has been submitted. You will receive a professional response within 24-48 hours.',
                confirmText: 'OK',
                hideCancel: true,
                onConfirm: () => {
                    hideModal();
                    navigation.goBack();
                }
            });
        } catch (error: any) {
            console.error('Error submitting consultation:', error);
            showAlert('Error', error.message || 'Failed to submit consultation', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <ScreenBackground>
            <SafeAreaView style={styles.container} edges={['top']}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <MaterialIcons name="arrow-back" size={22} color="rgba(255,255,255,0.7)" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Photo Consultation</Text>
                    <View style={{ width: 50 }} />
                </View>

                <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
                    <Text style={styles.introText}>
                        Send photos and get professional advice on whether what you're asking for is possible and what the professional recommends.
                    </Text>

                    {/* Select Master (Optional) */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Select Professional (Optional)</Text>
                        <Text style={styles.hintText}>Leave empty for any available professional to respond</Text>

                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.masterScroll}>
                            <TouchableOpacity
                                style={[
                                    styles.masterCard,
                                    selectedMasterId === null && styles.masterCardSelected
                                ]}
                                onPress={() => setSelectedMasterId(null)}
                            >
                                <View style={styles.anyMasterAvatar}>
                                    <Text style={styles.anyMasterText}>?</Text>
                                </View>
                                <Text style={styles.masterName}>Any Professional</Text>
                            </TouchableOpacity>

                            {masters.map((master) => (
                                <TouchableOpacity
                                    key={master.id}
                                    style={[
                                        styles.masterCard,
                                        selectedMasterId === master.id && styles.masterCardSelected
                                    ]}
                                    onPress={() => setSelectedMasterId(master.id)}
                                >
                                    {master.avatar_url ? (
                                        <Image source={{ uri: master.avatar_url }} style={styles.masterAvatar} />
                                    ) : (
                                        <View style={styles.masterAvatarPlaceholder}>
                                            <Text style={styles.masterAvatarText}>
                                                {master.full_name?.charAt(0).toUpperCase()}
                                            </Text>
                                        </View>
                                    )}
                                    <Text style={styles.masterName} numberOfLines={1}>
                                        {master.full_name}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>

                    {/* Consultation Details */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Consultation Details</Text>

                        <Text style={styles.label}>Title *</Text>
                        <TextInput
                            style={styles.input}
                            value={formData.title}
                            onChangeText={(text) => setFormData({ ...formData, title: text })}
                            placeholder="e.g., Can I get volume lashes with my natural lashes?"
                            placeholderTextColor={colors.textMuted}
                        />

                        <Text style={styles.label}>Description *</Text>
                        <TextInput
                            style={[styles.input, styles.textArea]}
                            value={formData.description}
                            onChangeText={(text) => setFormData({ ...formData, description: text })}
                            placeholder="Describe what you're looking for, any concerns, previous treatments, allergies, etc..."
                            placeholderTextColor={colors.textMuted}
                            multiline
                            numberOfLines={6}
                        />
                        <Text style={styles.charCount}>{formData.description.length} characters</Text>

                        <Text style={styles.label}>Service Type *</Text>
                        <View style={styles.serviceTypeContainer}>
                            {SERVICE_TYPES.map((type) => (
                                <TouchableOpacity
                                    key={type}
                                    style={[
                                        styles.serviceTypeOption,
                                        formData.serviceType === type && styles.serviceTypeOptionSelected
                                    ]}
                                    onPress={() => setFormData({ ...formData, serviceType: type })}
                                >
                                    <Text style={[
                                        styles.serviceTypeText,
                                        formData.serviceType === type && styles.serviceTypeTextSelected
                                    ]}>
                                        {type}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    {/* Photos */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Photos *</Text>
                        <Text style={styles.hintText}>Upload clear photos of the area you want treated (up to 5)</Text>

                        <TouchableOpacity style={styles.uploadButton} onPress={pickPhotos}>
                            <Text style={styles.uploadButtonText}>+ Add Photos</Text>
                        </TouchableOpacity>

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

                        <Text style={styles.photoCount}>
                            {formData.photos.length}/5 photos
                        </Text>
                    </View>

                    {/* Submit */}
                    <View style={styles.submitSection}>
                        <Text style={styles.responseTimeText}>
                            Expected response time: 24-48 hours
                        </Text>
                        <Button
                            title="Submit Consultation Request"
                            onPress={handleSubmit}
                            loading={loading}
                            fullWidth
                        />
                    </View>
                </ScrollView>
            </SafeAreaView>
        </ScreenBackground>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: colors.text,
    },
    scrollView: {
        flex: 1,
    },
    content: {
        padding: spacing.lg,
    },
    introText: {
        fontSize: 14,
        color: colors.textSecondary,
        marginBottom: spacing.xl,
        lineHeight: 20,
    },
    section: {
        marginBottom: spacing.xl,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: colors.text,
        marginBottom: spacing.md,
    },
    hintText: {
        fontSize: 12,
        color: colors.textMuted,
        marginBottom: spacing.md,
    },
    masterScroll: {
        marginHorizontal: -spacing.lg,
        paddingHorizontal: spacing.lg,
    },
    masterCard: {
        alignItems: 'center',
        padding: spacing.md,
        marginRight: spacing.md,
        backgroundColor: colors.surface,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: 'transparent',
        minWidth: 100,
    },
    masterCardSelected: {
        borderColor: colors.primary,
    },
    masterAvatar: {
        width: 60,
        height: 60,
        borderRadius: 30,
        marginBottom: spacing.sm,
    },
    masterAvatarPlaceholder: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
    masterAvatarText: {
        fontSize: 24,
        fontWeight: '700',
        color: '#fff',
    },
    anyMasterAvatar: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: colors.surface,
        borderWidth: 2,
        borderColor: colors.border,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
    anyMasterText: {
        fontSize: 24,
        fontWeight: '700',
        color: colors.textSecondary,
    },
    masterName: {
        fontSize: 13,
        color: colors.text,
        textAlign: 'center',
        maxWidth: 100,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.text,
        marginBottom: spacing.xs,
    },
    input: {
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: spacing.md,
        color: colors.text,
        fontSize: 16,
        borderWidth: 1,
        borderColor: colors.border,
        marginBottom: spacing.md,
    },
    textArea: {
        height: 120,
        textAlignVertical: 'top',
    },
    charCount: {
        fontSize: 12,
        color: colors.textMuted,
        textAlign: 'right',
        marginTop: -spacing.sm,
        marginBottom: spacing.md,
    },
    serviceTypeContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
    },
    serviceTypeOption: {
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        borderRadius: 20,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
    },
    serviceTypeOptionSelected: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    serviceTypeText: {
        fontSize: 14,
        color: colors.text,
    },
    serviceTypeTextSelected: {
        color: '#fff',
        fontWeight: '600',
    },
    uploadButton: {
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: spacing.lg,
        alignItems: 'center',
        borderWidth: 2,
        borderColor: colors.primary,
        borderStyle: 'dashed',
        marginBottom: spacing.md,
    },
    uploadButtonText: {
        fontSize: 16,
        color: colors.primary,
        fontWeight: '600',
    },
    photoGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
    },
    photoContainer: {
        position: 'relative',
        width: 100,
        height: 100,
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
        backgroundColor: 'rgba(0,0,0,0.6)',
        borderRadius: 12,
        width: 24,
        height: 24,
        justifyContent: 'center',
        alignItems: 'center',
    },
    removePhotoText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    photoCount: {
        fontSize: 12,
        color: colors.textMuted,
        textAlign: 'center',
        marginTop: spacing.sm,
    },
    submitSection: {
        marginTop: spacing.xl,
        marginBottom: spacing.xl,
    },
    responseTimeText: {
        fontSize: 14,
        color: colors.textSecondary,
        textAlign: 'center',
        marginBottom: spacing.md,
    },
});

export default PhotoConsultationRequestScreen;
