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
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
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

    useEffect(() => {
        if (user) {
            fetchPortfolio();
        }
    }, [user]);

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
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [4, 5],
                quality: 0.8,
            });

            if (!result.canceled && result.assets[0]) {
                uploadImage(result.assets[0]);
            }
        } catch (error) {
            showAlert('Error', 'Failed to pick image', 'error');
        }
    };

    const uploadImage = async (asset: ImagePicker.ImagePickerAsset) => {
        if (!user) return;
        setUploading(true);

        try {
            const fileExt = asset.uri.split('.').pop()?.toLowerCase() || 'jpg';
            const fileName = `${user.id}/${Date.now()}.${fileExt}`;
            const base64 = await FileSystem.readAsStringAsync(asset.uri, {
                encoding: 'base64',
            });

            const { error: uploadError } = await supabase.storage
                .from('portfolios')
                .upload(fileName, decode(base64), {
                    contentType: 'image/jpeg',
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

            showAlert('Success', 'Image added to portfolio', 'success');
            fetchPortfolio();

        } catch (error: any) {
            console.error('Upload error:', error);
            showAlert('Error', error.message || 'Failed to upload image', 'error');
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

    const renderItem = ({ item }: { item: Portfolio }) => (
        <TouchableOpacity
            style={styles.itemContainer}
            onPress={() => deleteImage(item)}
            activeOpacity={0.8}
        >
            <Image
                source={{ uri: item.image_url }}
                style={styles.image}
                resizeMode="cover"
            />
            <View style={styles.deleteOverlay}>
                <MaterialCommunityIcons name="trash-can-outline" size={14} color="#FFF" />
            </View>
        </TouchableOpacity>
    );

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
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
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
    deleteOverlay: {
        position: 'absolute',
        top: 8,
        right: 8,
        backgroundColor: 'rgba(0,0,0,0.6)',
        borderRadius: 10,
        width: 28,
        height: 28,
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
});

export default PortfolioScreen;
