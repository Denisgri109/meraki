import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    Image,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    RefreshControl,
    Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { ScreenBackground, Button } from '../../components/ui';
import { colors, spacing } from '../../theme';
import { Portfolio } from '../../types/database';

const COLUMN_COUNT = 2;
const SCREEN_WIDTH = Dimensions.get('window').width;
const ITEM_SIZE = (SCREEN_WIDTH - spacing.lg * 3) / COLUMN_COUNT;

export function PortfolioScreen() {
    const navigation = useNavigation();
    const { user } = useAuth();
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
            Alert.alert('Error', error.message);
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
            Alert.alert('Permission needed', 'Please grant gallery access to upload photos.');
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
            Alert.alert('Error', 'Failed to pick image');
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

            // 1. Upload to Storage
            const { error: uploadError } = await supabase.storage
                .from('portfolios')
                .upload(fileName, decode(base64), {
                    contentType: 'image/jpeg',
                    upsert: false,
                });

            if (uploadError) {
                // If bucket doesn't exist, try 'public' or warn user
                if (uploadError.message.includes('Bucket not found')) {
                    throw new Error('Storage bucket "portfolios" does not exist. Please contact admin.');
                }
                throw uploadError;
            }

            // 2. Get Public URL
            const { data: urlData } = supabase.storage
                .from('portfolios')
                .getPublicUrl(fileName);

            // 3. Insert into Database
            const { error: dbError } = await supabase
                .from('portfolios')
                .insert({
                    master_id: user.id,
                    image_url: urlData.publicUrl,
                    description: '', // Optional description logic can be added later
                });

            if (dbError) throw dbError;

            Alert.alert('Success', 'Image added to portfolio');
            fetchPortfolio();

        } catch (error: any) {
            console.error('Upload error:', error);
            Alert.alert('Error', error.message || 'Failed to upload image');
        } finally {
            setUploading(false);
        }
    };

    const deleteImage = (item: Portfolio) => {
        Alert.alert(
            'Delete Image',
            'Are you sure you want to remove this image from your portfolio?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const { error } = await supabase
                                .from('portfolios')
                                .delete()
                                .eq('id', item.id);

                            if (error) throw error;

                            // Optional: Delete from storage too if possible
                            // const path = item.image_url.split('/').pop(); 
                            // if (path) supabase.storage.from('portfolios').remove([`${user!.id}/${path}`]);

                            setImages(prev => prev.filter(img => img.id !== item.id));
                        } catch (error: any) {
                            Alert.alert('Error', 'Failed to delete image');
                        }
                    }
                }
            ]
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
                <Text style={styles.deleteIcon}>🗑️</Text>
            </View>
        </TouchableOpacity>
    );

    return (
        <ScreenBackground>
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <Text style={styles.backButtonText}>← Back</Text>
                    </TouchableOpacity>
                    <Text style={styles.title}>Portfolio</Text>
                    <View style={{ width: 60 }} />
                </View>

                {loading ? (
                    <View style={styles.center}>
                        <ActivityIndicator size="large" color={colors.primary} />
                    </View>
                ) : (
                    <FlatList
                        data={images}
                        renderItem={renderItem}
                        keyExtractor={item => item.id}
                        numColumns={COLUMN_COUNT}
                        contentContainerStyle={styles.listContent}
                        refreshControl={
                            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textMuted} />
                        }
                        ListEmptyComponent={
                            <View style={styles.emptyContainer}>
                                <Text style={styles.emptyText}>No images in your portfolio yet.</Text>
                                <Text style={styles.emptySubtext}>Add photos to showcase your work!</Text>
                            </View>
                        }
                    />
                )}

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
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
    },
    backButton: {
        padding: spacing.xs,
    },
    backButtonText: {
        fontSize: 16,
        color: colors.text,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: colors.text,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    listContent: {
        padding: spacing.md,
    },
    itemContainer: {
        width: ITEM_SIZE,
        height: ITEM_SIZE * 1.25, // 4:5 aspect ratio roughly
        marginBottom: spacing.md,
        marginRight: spacing.md,
        borderRadius: 12,
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
        backgroundColor: 'rgba(0,0,0,0.5)',
        borderRadius: 12,
        padding: 4,
    },
    deleteIcon: {
        fontSize: 12,
    },
    emptyContainer: {
        alignItems: 'center',
        marginTop: spacing.xl * 2,
    },
    emptyText: {
        fontSize: 18,
        color: colors.text,
        fontWeight: '600',
        marginBottom: spacing.sm,
    },
    emptySubtext: {
        fontSize: 14,
        color: colors.textMuted,
    },
    footer: {
        padding: spacing.lg,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        backgroundColor: 'rgba(5,5,5,0.9)',
    },
});

export default PortfolioScreen;
