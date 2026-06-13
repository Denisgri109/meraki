import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TextInput,
    TouchableOpacity,
    Switch,
    Image,
    ActivityIndicator,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { supabase } from '../../lib/supabase';
import { Button, ScreenBackground } from '../../components/ui';
import { colors, spacing } from '../../theme';
import { useModal } from '../../contexts/ModalContext';
import { validateServiceName, validatePrice } from '../../utils/validation';
import { Service } from '../../types/database';

type RouteParams = {
    ServiceForm: { service?: Service };
};

const CATEGORIES = ['Hair', 'Nails', 'Skincare', 'Massage', 'Makeup', 'Pilates', 'Other'];

export function ServiceFormScreen() {
    const navigation = useNavigation<any>();
    const route = useRoute<RouteProp<RouteParams, 'ServiceForm'>>();
    const existingService = route.params?.service;
    const isEditing = !!existingService;
    const { showAlert, showConfirm } = useModal();

    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: existingService?.name || '',
        description: existingService?.description || '',
        category: existingService?.category || 'Hair',
        base_price: existingService?.base_price?.toString() || '',
        duration_minutes: existingService?.duration_minutes?.toString() || '60',
        is_active: existingService?.is_active ?? true,
    });
    const [imageUrl, setImageUrl] = useState((existingService as any)?.image_url || '');
    const [uploading, setUploading] = useState(false);

    const pickServiceImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            showAlert('Permission needed', 'Please grant gallery access to upload service photos.', 'error');
            return;
        }
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                allowsEditing: true,
                aspect: [16, 9],
                quality: 0.8,
            });
            if (!result.canceled && result.assets[0]) {
                uploadServiceImage(result.assets[0]);
            }
        } catch (error) {
            showAlert('Error', 'Failed to pick image', 'error');
        }
    };

    const uploadServiceImage = async (asset: ImagePicker.ImagePickerAsset) => {
        setUploading(true);
        try {
            const fileExt = asset.uri.split('.').pop()?.toLowerCase() || 'jpg';
            const fileName = `service-images/${Date.now()}.${fileExt}`;
            const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: 'base64' });

            const { error: uploadError } = await supabase.storage
                .from('services')
                .upload(fileName, decode(base64), { contentType: `image/${fileExt}`, upsert: false });

            if (uploadError) throw uploadError;

            const { data: urlData } = supabase.storage.from('services').getPublicUrl(fileName);
            setImageUrl(urlData.publicUrl);
        } catch (error: any) {
            console.error('Upload error:', error);
            showAlert('Error', error.message || 'Failed to upload image', 'error');
        } finally {
            setUploading(false);
        }
    };

    const handleSave = async () => {
        const nameVal = validateServiceName(formData.name);
        if (!nameVal.valid) {
            showAlert('Invalid Name', nameVal.error || 'Please enter a valid service name.', 'error');
            return;
        }

        const priceVal = validatePrice(formData.base_price);
        if (!priceVal.valid) {
            showAlert('Invalid Price', priceVal.error || 'Please enter a valid price.', 'error');
            return;
        }

        if (!formData.duration_minutes || isNaN(Number(formData.duration_minutes))) {
            showAlert('Error', 'Please enter a valid duration', 'error');
            return;
        }

        setLoading(true);
        try {
            const serviceData = {
                name: formData.name.trim(),
                description: formData.description.trim() || null,
                category: formData.category,
                base_price: Number(formData.base_price),
                duration_minutes: Number(formData.duration_minutes),
                is_active: formData.is_active,
                image_url: imageUrl || null,
            };

            if (isEditing) {
                const { error } = await supabase
                    .from('services')
                    .update(serviceData)
                    .eq('id', existingService.id);

                if (error) throw error;
                showAlert('Success', 'Service updated successfully', 'success');
            } else {
                const { error } = await supabase
                    .from('services')
                    .insert(serviceData);

                if (error) throw error;
                showAlert('Success', 'Service created successfully', 'success');
            }
            navigation.goBack();
        } catch (error: any) {
            console.error('Error saving service:', error);
            showAlert('Error', error.message || 'Failed to save service', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = () => {
        if (!isEditing) return;

        showConfirm(
            'Delete Service',
            'Are you sure you want to delete this service? This action cannot be undone.',
            async () => {
                setLoading(true);
                try {
                    const { error } = await supabase
                        .from('services')
                        .delete()
                        .eq('id', existingService.id);

                    if (error) throw error;
                    showAlert('Success', 'Service deleted', 'success');
                    navigation.goBack();
                } catch (error: any) {
                    console.error('Error deleting service:', error);
                    showAlert('Error', error.message || 'Failed to delete service', 'error');
                } finally {
                    setLoading(false);
                }
            }
        );
    };

    return (
        <ScreenBackground>
            <SafeAreaView style={styles.container} edges={['top']}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={styles.title}>{isEditing ? 'Edit Service' : 'Add Service'}</Text>
                    <View style={{ width: 60 }} />
                </View>

                <ScrollView contentContainerStyle={styles.content}>
                    {/* Basic Info */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Service Details</Text>

                        <Text style={styles.label}>Name *</Text>
                        <TextInput
                            style={styles.input}
                            value={formData.name}
                            onChangeText={(v) => setFormData({ ...formData, name: v })}
                            placeholder="Enter service name"
                            placeholderTextColor={colors.textMuted}
                        />

                        <Text style={styles.label}>Description</Text>
                        <TextInput
                            style={[styles.input, styles.textArea]}
                            value={formData.description}
                            onChangeText={(v) => setFormData({ ...formData, description: v })}
                            placeholder="Enter service description"
                            placeholderTextColor={colors.textMuted}
                            multiline
                            numberOfLines={4}
                        />

                        <Text style={styles.label}>Category</Text>
                        <View style={styles.categoryOptions}>
                            {CATEGORIES.map((cat) => (
                                <TouchableOpacity
                                    key={cat}
                                    style={[
                                        styles.categoryOption,
                                        formData.category === cat && styles.categoryOptionActive,
                                    ]}
                                    onPress={() => setFormData({ ...formData, category: cat })}
                                >
                                    <Text style={[
                                        styles.categoryOptionText,
                                        formData.category === cat && styles.categoryOptionTextActive,
                                    ]}>
                                        {cat}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    {/* Pricing & Duration */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Pricing & Duration</Text>

                        <View style={styles.row}>
                            <View style={styles.halfField}>
                                <Text style={styles.label}>Price (€) *</Text>
                                <TextInput
                                    style={styles.input}
                                    value={formData.base_price}
                                    onChangeText={(v) => setFormData({ ...formData, base_price: v })}
                                    placeholder="0.00"
                                    placeholderTextColor={colors.textMuted}
                                    keyboardType="decimal-pad"
                                />
                            </View>
                            <View style={styles.halfField}>
                                <Text style={styles.label}>Duration (min) *</Text>
                                <TextInput
                                    style={styles.input}
                                    value={formData.duration_minutes}
                                    onChangeText={(v) => setFormData({ ...formData, duration_minutes: v })}
                                    placeholder="60"
                                    placeholderTextColor={colors.textMuted}
                                    keyboardType="number-pad"
                                />
                            </View>
                        </View>
                    </View>

                    {/* Service Image (Optional) */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Service Image</Text>
                        <View style={styles.imageUploadRow}>
                            <View style={styles.imagePreviewContainer}>
                                {imageUrl ? (
                                    <Image source={{ uri: imageUrl }} style={styles.uploadedImage} />
                                ) : (
                                    <View style={styles.imagePlaceholder}>
                                        <MaterialCommunityIcons name="camera" size={24} color={colors.textMuted} />
                                    </View>
                                )}
                            </View>
                            <TouchableOpacity
                                style={styles.uploadButton}
                                onPress={pickServiceImage}
                                disabled={uploading}
                            >
                                {uploading ? (
                                    <ActivityIndicator size="small" color={colors.text} />
                                ) : (
                                    <Text style={styles.uploadButtonText}>
                                        {imageUrl ? 'Change Photo' : 'Upload Photo'}
                                    </Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Status */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Status</Text>
                        <View style={styles.activeRow}>
                            <View>
                                <Text style={styles.activeLabel}>Active</Text>
                                <Text style={styles.activeSubtext}>
                                    {formData.is_active ? 'Service is visible to clients' : 'Service is hidden'}
                                </Text>
                            </View>
                            <Switch
                                value={formData.is_active}
                                onValueChange={(v) => setFormData({ ...formData, is_active: v })}
                                trackColor={{ false: colors.border, true: '#8B5CF6' }}
                                thumbColor={formData.is_active ? '#fff' : '#f4f3f4'}
                            />
                        </View>
                    </View>

                    {/* Actions */}
                    <View style={styles.actions}>
                        <Button
                            title={loading ? 'Saving...' : (isEditing ? 'Save Changes' : 'Create Service')}
                            onPress={handleSave}
                            disabled={loading}
                        />

                        {isEditing && (
                            <TouchableOpacity
                                style={styles.deleteButton}
                                onPress={handleDelete}
                                disabled={loading}
                            >
                                <Text style={styles.deleteButtonText}>Delete Service</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </ScrollView>
            </SafeAreaView>
        </ScreenBackground>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: spacing.lg,
        paddingBottom: spacing.md,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: 'rgba(0, 0, 0, 0.04)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.08)',
    },
    title: { fontSize: 20, fontWeight: '600', color: colors.text },
    content: { padding: spacing.lg },
    section: { marginBottom: spacing.xl },
    sectionTitle: {
        fontSize: 12,
        fontWeight: '600',
        color: colors.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: 1.5,
        marginBottom: spacing.md,
    },
    label: {
        fontSize: 14,
        color: colors.text,
        marginBottom: spacing.xs,
        fontWeight: '500',
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
        height: 100,
        textAlignVertical: 'top',
    },
    categoryOptions: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
    },
    categoryOption: {
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        borderRadius: 8,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
    },
    categoryOptionActive: {
        backgroundColor: '#8B5CF6',
        borderColor: '#8B5CF6',
    },
    categoryOptionText: { fontSize: 14, color: colors.textSecondary },
    categoryOptionTextActive: { color: '#fff', fontWeight: '600' },
    row: { flexDirection: 'row', gap: spacing.md },
    halfField: { flex: 1 },
    activeRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: colors.surface,
        padding: spacing.md,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
    },
    activeLabel: { fontSize: 16, fontWeight: '600', color: colors.text },
    activeSubtext: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
    actions: { marginTop: spacing.lg },
    deleteButton: {
        marginTop: spacing.md,
        padding: spacing.md,
        alignItems: 'center',
    },
    deleteButtonText: { color: '#EF4444', fontSize: 16, fontWeight: '600' },
    // Image upload
    imageUploadRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    imagePreviewContainer: {
        width: 80,
        height: 80,
        borderRadius: 12,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: colors.border,
    },
    uploadedImage: {
        width: '100%',
        height: '100%',
    },
    imagePlaceholder: {
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0, 0, 0, 0.04)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    uploadButton: {
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        borderRadius: 12,
        backgroundColor: 'rgba(0, 0, 0, 0.04)',
        borderWidth: 1,
        borderColor: colors.border,
    },
    uploadButtonText: {
        fontSize: 14,
        fontWeight: '500',
        color: colors.text,
    },
});

export default ServiceFormScreen;
