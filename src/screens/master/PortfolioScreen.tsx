import React, { useState, useEffect } from 'react';
import {
    View,
    StyleSheet,
    FlatList,
    Image,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    Dimensions,
    TextInput,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Card, ScreenBackground, Button, MerakiText } from '../../components/ui';
import { useModal } from '../../contexts/ModalContext';
import { colors, spacing } from '../../theme';
import { Portfolio } from '../../types/database';

const COLUMN_COUNT = 2;
const SCREEN_WIDTH = Dimensions.get('window').width;
const ITEM_SIZE = (SCREEN_WIDTH - spacing.lg * 3) / COLUMN_COUNT;

export function PortfolioScreen() {
    const navigation = useNavigation();
    const { user } = useAuth();
    const { showAlert, showConfirm } = useModal();
    const [images, setImages] = useState<Portfolio[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedItem, setSelectedItem] = useState<Portfolio | null>(null);
    const [editDescription, setEditDescription] = useState('');
    const [saving, setSaving] = useState(false);
    const [bio, setBio] = useState('');
    const [originalBio, setOriginalBio] = useState('');
    const [savingBio, setSavingBio] = useState(false);

    useEffect(() => {
        if (user) {
            fetchPortfolio();
            fetchBio();
        }
    }, [user]);

    const fetchBio = async () => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('bio')
                .eq('id', user!.id)
                .single();

            if (error) throw error;
            setBio(data?.bio || '');
            setOriginalBio(data?.bio || '');
        } catch (error: any) {
            console.error('Error fetching bio:', error);
        }
    };

    const saveBio = async () => {
        if (!user) return;
        setSavingBio(true);
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ bio: bio.trim() || null })
                .eq('id', user.id);

            if (error) throw error;
            setOriginalBio(bio.trim());
            showAlert('Saved', 'Your bio has been updated', 'success');
        } catch (error: any) {
            showAlert('Error', error.message || 'Failed to save bio', 'error');
        } finally {
            setSavingBio(false);
        }
    };

    const fetchPortfolio = async () => {
        try {
            const { data, error } = await supabase
                .from('portfolios')
                .select('*')
                .eq('master_id', user!.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setImages(data || []);
        } catch (error: any) {
            console.error('Error fetching portfolio:', error);
            showAlert('Error', error.message, 'error');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchPortfolio();
    };

    const pickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            showAlert('Permission needed', 'Please grant gallery access to upload photos.', 'error');
            return;
        }

        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                allowsMultipleSelection: true,
                selectionLimit: 10, // Reasonable limit
                quality: 0.8,
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                uploadImages(result.assets);
            }
        } catch (error) {
            showAlert('Error', 'Failed to pick image', 'error');
        }
    };

    const uploadImages = async (assets: ImagePicker.ImagePickerAsset[]) => {
        if (!user) return;
        setUploading(true);

        let successCount = 0;
        let errors: string[] = [];

        try {
            for (let i = 0; i < assets.length; i++) {
                const asset = assets[i];
                try {
                    const fileExt = asset.uri.split('.').pop()?.toLowerCase() || 'jpg';
                    const fileName = `${user.id}/${Date.now()}_${i}.${fileExt}`;
                    const base64 = await FileSystem.readAsStringAsync(asset.uri, {
                        encoding: 'base64',
                    });

                    const { error: uploadError } = await supabase.storage
                        .from('portfolios')
                        .upload(fileName, decode(base64), {
                            contentType: `image/${fileExt === 'png' ? 'png' : 'jpeg'}`,
                            upsert: false,
                        });

                    if (uploadError) {
                        if (uploadError.message.includes('Bucket not found')) {
                            throw new Error('Storage bucket "portfolios" does not exist. Please contact admin.');
                        }
                        throw uploadError;
                    }

                    const { data: urlData } = supabase.storage
                        .from('portfolios')
                        .getPublicUrl(fileName);

                    const { error: dbError } = await supabase
                        .from('portfolios')
                        .insert({
                            master_id: user.id,
                            image_url: urlData.publicUrl,
                            description: '',
                        });

                    if (dbError) throw dbError;
                    successCount++;
                } catch (err: any) {
                    console.error('Upload error for image ' + i, err);
                    errors.push(err.message || 'Unknown error');
                }
            }

            if (successCount > 0) {
                showAlert('Success', `${successCount} image${successCount > 1 ? 's' : ''} added to portfolio`, 'success');
                fetchPortfolio();
            }

            if (errors.length > 0) {
                // If some failed but some succeeded, we already showed success for those.
                // Just show a warning for the failures.
                showAlert('Upload Issues', `${errors.length} image${errors.length > 1 ? 's' : ''} failed to upload.`, 'warning');
            }

        } catch (error: any) {
            console.error('Upload process error:', error);
            showAlert('Error', error.message || 'Failed to upload images', 'error');
        } finally {
            setUploading(false);
        }
    };

    const deleteImage = (item: Portfolio) => {
        showConfirm(
            'Delete Image',
            'Are you sure you want to remove this image from your portfolio?',
            async () => {
                try {
                    const { error } = await supabase
                        .from('portfolios')
                        .delete()
                        .eq('id', item.id);

                    if (error) throw error;
                    setImages(prev => prev.filter(img => img.id !== item.id));
                    setSelectedItem(null);
                } catch (error: any) {
                    showAlert('Error', 'Failed to delete image', 'error');
                }
            },
            {
                confirmText: 'Delete',
                cancelText: 'Cancel',
                type: 'error'
            }
        );
    };

    const openDetail = (item: Portfolio) => {
        setSelectedItem(item);
        setEditDescription(item.description || '');
    };

    const saveDescription = async () => {
        if (!selectedItem) return;
        setSaving(true);
        try {
            const { error } = await supabase
                .from('portfolios')
                .update({ description: editDescription.trim() || null })
                .eq('id', selectedItem.id);

            if (error) throw error;

            setImages(prev =>
                prev.map(img =>
                    img.id === selectedItem.id
                        ? { ...img, description: editDescription.trim() || null }
                        : img
                )
            );
            setSelectedItem(prev => prev ? { ...prev, description: editDescription.trim() || null } : null);
            showAlert('Saved', 'Description updated successfully', 'success');
        } catch (error: any) {
            showAlert('Error', error.message || 'Failed to save description', 'error');
        } finally {
            setSaving(false);
        }
    };

    const renderItem = ({ item }: { item: Portfolio }) => (
        <TouchableOpacity
            style={styles.itemContainer}
            onPress={() => openDetail(item)}
            activeOpacity={0.8}
        >
            <Image
                source={{ uri: item.image_url }}
                style={styles.image}
                resizeMode="cover"
            />
            {item.description ? (
                <View style={styles.descriptionBadge}>
                    <MaterialCommunityIcons name="text" size={12} color="#fff" />
                </View>
            ) : null}
        </TouchableOpacity>
    );

    const renderDetailModal = () => {
        if (!selectedItem) return null;

        const descriptionChanged = (editDescription.trim() || '') !== (selectedItem.description || '');

        return (
            <View style={styles.modalOverlay}>
                <TouchableOpacity
                    style={StyleSheet.absoluteFill}
                    activeOpacity={1}
                    onPress={() => setSelectedItem(null)}
                />
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    style={styles.modalKeyboard}
                >
                    <View style={styles.modalContent}>
                        <View style={styles.dragHandle} />

                        <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
                            {/* Image */}
                            <Image
                                source={{ uri: selectedItem.image_url }}
                                style={styles.modalImage}
                                resizeMode="cover"
                            />

                            {/* Description Input */}
                            <View style={styles.descriptionSection}>
                                <MerakiText variant="label" color={colors.textMuted} style={styles.descriptionLabel}>
                                    DESCRIPTION
                                </MerakiText>
                                <TextInput
                                    style={styles.descriptionInput}
                                    value={editDescription}
                                    onChangeText={setEditDescription}
                                    placeholder="Add a description for this work..."
                                    placeholderTextColor={colors.textMuted}
                                    multiline
                                    maxLength={500}
                                    textAlignVertical="top"
                                />
                                <MerakiText variant="caption" color={colors.textMuted} style={{ alignSelf: 'flex-end', marginTop: 4 }}>
                                    {editDescription.length}/500
                                </MerakiText>
                            </View>

                            <View style={{ height: 80 }} />
                        </ScrollView>

                        {/* Actions */}
                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={styles.deleteButton}
                                onPress={() => deleteImage(selectedItem)}
                                activeOpacity={0.7}
                            >
                                <MaterialCommunityIcons name="trash-can-outline" size={20} color="#F85149" />
                            </TouchableOpacity>

                            <TouchableOpacity
                                activeOpacity={0.7}
                                onPress={saveDescription}
                                disabled={saving || !descriptionChanged}
                                style={{ flex: 1 }}
                            >
                                <LinearGradient
                                    colors={descriptionChanged ? ['#E8A0B4', '#C47A90'] : ['rgba(0, 0, 0, 0.06)', 'rgba(0, 0, 0, 0.03)']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={[styles.saveButton, !descriptionChanged && { opacity: 0.5 }]}
                                >
                                    {saving ? (
                                        <ActivityIndicator color="#fff" size="small" />
                                    ) : (
                                        <>
                                            <MaterialCommunityIcons name="content-save-outline" size={18} color="#fff" />
                                            <MerakiText variant="body" style={{ color: '#fff', fontWeight: '600' }}>
                                                Save Description
                                            </MerakiText>
                                        </>
                                    )}
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </View>
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
                    <MerakiText variant="h2">Portfolio</MerakiText>
                    <View style={{ width: 40 }} />
                </View>

                {/* Stats Bar */}
                <View style={styles.statsBar}>
                    <Card variant="glass" style={styles.statPill} noPadding>
                        <MaterialCommunityIcons name="image-multiple" size={16} color={colors.accent} />
                        <MerakiText variant="label" color={colors.accent} style={{ marginLeft: 6 }}>
                            {images.length} {images.length === 1 ? 'Photo' : 'Photos'}
                        </MerakiText>
                    </Card>
                </View>

                {loading ? (
                    <View style={styles.center}>
                        <ActivityIndicator size="large" color={colors.accent} />
                    </View>
                ) : (
                    <FlatList
                        data={images}
                        renderItem={renderItem}
                        keyExtractor={item => item.id}
                        numColumns={COLUMN_COUNT}
                        contentContainerStyle={styles.listContent}
                        refreshControl={
                            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
                        }
                        ListHeaderComponent={
                            <View style={styles.bioSection}>
                                <View style={styles.bioHeader}>
                                    <MaterialCommunityIcons name="account-edit-outline" size={18} color={colors.accent} />
                                    <MerakiText variant="label" color={colors.text} style={{ fontWeight: '600', marginLeft: 6 }}>
                                        About Me
                                    </MerakiText>
                                </View>
                                <TextInput
                                    style={styles.bioInput}
                                    value={bio}
                                    onChangeText={setBio}
                                    placeholder="Tell clients about yourself, your experience, and specialties..."
                                    placeholderTextColor={colors.textMuted}
                                    multiline
                                    maxLength={300}
                                    textAlignVertical="top"
                                />
                                <View style={styles.bioFooter}>
                                    <MerakiText variant="caption" color={colors.textMuted}>
                                        {bio.length}/300
                                    </MerakiText>
                                    {bio.trim() !== originalBio && (
                                        <TouchableOpacity
                                            onPress={saveBio}
                                            disabled={savingBio}
                                            activeOpacity={0.7}
                                        >
                                            <LinearGradient
                                                colors={['#E8A0B4', '#C47A90']}
                                                start={{ x: 0, y: 0 }}
                                                end={{ x: 1, y: 0 }}
                                                style={styles.saveBioButton}
                                            >
                                                {savingBio ? (
                                                    <ActivityIndicator color="#fff" size="small" />
                                                ) : (
                                                    <MerakiText variant="caption" style={{ color: '#fff', fontWeight: '700' }}>
                                                        Save Bio
                                                    </MerakiText>
                                                )}
                                            </LinearGradient>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </View>
                        }
                        ListEmptyComponent={
                            <View style={styles.emptyContainer}>
                                <View style={styles.emptyIconBg}>
                                    <MaterialCommunityIcons name="image-plus" size={40} color={colors.textMuted} />
                                </View>
                                <MerakiText variant="body" color={colors.text} style={styles.emptyTitle}>
                                    No images yet
                                </MerakiText>
                                <MerakiText variant="caption" color={colors.textMuted}>
                                    Add photos to showcase your work!
                                </MerakiText>
                            </View>
                        }
                    />
                )}

                {/* Footer CTA */}
                <View style={styles.footer}>
                    <Button
                        title={uploading ? "Uploading..." : "Add Photo"}
                        onPress={pickImage}
                        disabled={uploading}
                    />
                </View>
                {/* Detail Modal */}
                {selectedItem && renderDetailModal()}
            </SafeAreaView>
        </ScreenBackground>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    // Bio Section
    bioSection: {
        marginBottom: spacing.lg,
        backgroundColor: 'rgba(0, 0, 0, 0.02)',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.05)',
        padding: spacing.md,
    },
    bioHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
    bioInput: {
        backgroundColor: 'rgba(0, 0, 0, 0.03)',
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.06)',
        borderRadius: 12,
        padding: spacing.md,
        color: colors.text,
        fontSize: 14,
        minHeight: 80,
        lineHeight: 20,
    },
    bioFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 8,
    },
    saveBioButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
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
    statsBar: {
        paddingHorizontal: spacing.lg,
        marginBottom: spacing.sm,
    },
    statPill: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    listContent: {
        padding: spacing.lg,
    },
    itemContainer: {
        width: ITEM_SIZE,
        height: ITEM_SIZE * 1.25,
        marginBottom: spacing.md,
        marginRight: spacing.md,
        borderRadius: 14,
        overflow: 'hidden',
        position: 'relative',
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
    },
    image: {
        width: '100%',
        height: '100%',
    },
    descriptionBadge: {
        position: 'absolute',
        bottom: 8,
        left: 8,
        backgroundColor: 'rgba(0,0,0,0.6)',
        borderRadius: 10,
        width: 24,
        height: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyContainer: {
        alignItems: 'center',
        marginTop: spacing.xl * 3,
    },
    emptyIconBg: {
        width: 72,
        height: 72,
        borderRadius: 20,
        backgroundColor: 'rgba(212,168,83,0.08)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.md,
    },
    emptyTitle: {
        fontWeight: '600',
        marginBottom: spacing.xs,
    },
    footer: {
        padding: spacing.lg,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        backgroundColor: colors.surface,
    },
    // ─── Detail Modal ──────────────────────────────────────────────
    modalOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        justifyContent: 'flex-end',
    },
    modalKeyboard: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: colors.surface,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '85%',
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.lg,
    },
    dragHandle: {
        width: 36,
        height: 4,
        borderRadius: 2,
        backgroundColor: 'rgba(0, 0, 0, 0.12)',
        alignSelf: 'center',
        marginTop: spacing.md,
        marginBottom: spacing.md,
    },
    modalImage: {
        width: '100%',
        height: 280,
        borderRadius: 16,
        marginBottom: spacing.lg,
    },
    descriptionSection: {
        marginBottom: spacing.md,
    },
    descriptionLabel: {
        fontSize: 11,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 1.2,
        marginBottom: spacing.sm,
    },
    descriptionInput: {
        backgroundColor: 'rgba(0, 0, 0, 0.04)',
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.08)',
        borderRadius: 14,
        padding: spacing.md,
        color: colors.text,
        fontSize: 14,
        minHeight: 100,
        lineHeight: 22,
    },
    modalActions: {
        flexDirection: 'row',
        gap: 12,
        paddingTop: spacing.md,
        borderTopWidth: 1,
        borderTopColor: 'rgba(0, 0, 0, 0.05)',
    },
    deleteButton: {
        width: 50,
        height: 50,
        borderRadius: 14,
        backgroundColor: 'rgba(248, 81, 73, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(248, 81, 73, 0.25)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    saveButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        height: 50,
        borderRadius: 14,
    },
});

export default PortfolioScreen;
