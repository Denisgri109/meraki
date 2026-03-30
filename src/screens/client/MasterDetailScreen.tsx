import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Image,
    Dimensions,
    Modal,
    FlatList,
    Animated,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../lib/supabase';
import { Button, Card, ScreenBackground } from '../../components/ui';
import { colors, spacing } from '../../theme';
import { Service, Profile, Portfolio } from '../../types/database';
import { useSafeBack } from '../../hooks';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PHOTO_GAP = 8;
const PHOTO_SIZE = (SCREEN_WIDTH - spacing.lg * 2 - PHOTO_GAP) / 2;

type BookingStackParamList = {
    BookingMain: undefined;
    ServiceDetail: { serviceId: string };
    MasterDetail: { masterId: string };
    SelectDateTime: { serviceId: string; masterId: string };
    BookingConfirm: { serviceId: string; masterId: string; dateTime: string };
};

type MasterDetailScreenProps = {
    navigation: NativeStackNavigationProp<BookingStackParamList, 'MasterDetail'>;
    route: RouteProp<BookingStackParamList, 'MasterDetail'>;
};

export function MasterDetailScreen({ navigation, route }: MasterDetailScreenProps) {
    const { masterId } = route.params;
    const [master, setMaster] = useState<Profile | null>(null);
    const [services, setServices] = useState<Service[]>([]);
    const [portfolioImages, setPortfolioImages] = useState<Portfolio[]>([]);
    const [loading, setLoading] = useState(true);
    const [imageViewerVisible, setImageViewerVisible] = useState(false);
    const [selectedImageIndex, setSelectedImageIndex] = useState(0);
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const { goBack } = useSafeBack({ fallbackRoute: 'HomeMain' });

    useEffect(() => {
        fetchData();
    }, []);

    useEffect(() => {
        if (!loading) {
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 400,
                useNativeDriver: true,
            }).start();
        }
    }, [loading]);

    const fetchData = async () => {
        try {
            // Fetch master details
            const { data: masterData } = await supabase
                .from('profiles')
                .select('id, full_name, bio, avatar_url, city, country, timezone, years_of_experience, specialties')
                .eq('id', masterId)
                .single();

            // Fetch services linked to this master
            const { data: masterServicesData, error: servicesError } = await supabase
                .from('master_services')
                .select(`
                    service:services (
                        id,
                        name,
                        description,
                        category,
                        base_price,
                        duration_minutes,
                        is_active
                    ),
                    custom_price,
                    custom_duration
                `)
                .eq('master_id', masterId)
                .eq('is_available', true);

            if (servicesError) throw servicesError;

            // Fetch portfolio images
            const { data: portfolioData } = await supabase
                .from('portfolios')
                .select('*')
                .eq('master_id', masterId)
                .order('created_at', { ascending: false });

            // Transform services data
            const formattedServices = (masterServicesData || [])
                .map((item: any) => ({
                    ...item.service,
                    base_price: item.custom_price || item.service.base_price,
                    duration_minutes: item.custom_duration || item.service.duration_minutes,
                }))
                .filter(s => s && s.is_active)
                .sort((a, b) => a.name.localeCompare(b.name));

            setMaster(masterData as Profile);
            setServices(formattedServices);
            setPortfolioImages(portfolioData || []);
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSelectService = (serviceId: string) => {
        navigation.navigate('SelectDateTime', {
            serviceId,
            masterId,
        });
    };

    const openImageViewer = (index: number) => {
        setSelectedImageIndex(index);
        setImageViewerVisible(true);
    };

    if (loading) {
        return (
            <ScreenBackground>
                <SafeAreaView style={styles.container}>
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={colors.primary} />
                    </View>
                </SafeAreaView>
            </ScreenBackground>
        );
    }

    if (!master) {
        return (
            <ScreenBackground>
                <SafeAreaView style={styles.container}>
                    <View style={styles.loadingContainer}>
                        <Text style={styles.errorText}>Master not found</Text>
                    </View>
                </SafeAreaView>
            </ScreenBackground>
        );
    }

    return (
        <ScreenBackground>
            <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
                <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                    {/* Header */}
                    <View style={styles.header}>
                        <TouchableOpacity onPress={goBack} style={styles.backButton}>
                            <MaterialIcons name="arrow-back" size={22} color="rgba(0, 0, 0, 0.55)" />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>Portfolio</Text>
                        <View style={{ width: 40 }} />
                    </View>

                    <Animated.View style={{ opacity: fadeAnim }}>
                        {/* Hero Section */}
                        <View style={styles.heroSection}>
                            <LinearGradient
                                colors={['rgba(139, 92, 246, 0.15)', 'rgba(59, 130, 246, 0.08)', 'transparent']}
                                style={styles.heroGradient}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                            />
                            {master.avatar_url ? (
                                <Image source={{ uri: master.avatar_url }} style={styles.masterAvatarImage} />
                            ) : (
                                <View style={styles.masterAvatar}>
                                    <Text style={styles.masterAvatarText}>
                                        {master.full_name?.[0] || 'M'}
                                    </Text>
                                </View>
                            )}
                            <Text style={styles.masterName}>{master.full_name || 'Beauty Master'}</Text>

                            {(master.city || master.country) && (
                                <View style={styles.locationRow}>
                                    <MaterialIcons name="location-on" size={14} color={colors.primary} />
                                    <Text style={styles.masterLocation}>
                                        {[master.city, master.country].filter(Boolean).join(', ')}
                                    </Text>
                                </View>
                            )}

                            {/* Stats Row */}
                            <View style={styles.statsRow}>
                                <View style={styles.statItem}>
                                    <Text style={styles.statValue}>{services.length}</Text>
                                    <Text style={styles.statLabel}>Services</Text>
                                </View>
                                <View style={styles.statDivider} />
                                <View style={styles.statItem}>
                                    <Text style={styles.statValue}>{portfolioImages.length}</Text>
                                    <Text style={styles.statLabel}>Photos</Text>
                                </View>
                                {(master as any).years_of_experience && (
                                    <>
                                        <View style={styles.statDivider} />
                                        <View style={styles.statItem}>
                                            <Text style={styles.statValue}>{(master as any).years_of_experience}</Text>
                                            <Text style={styles.statLabel}>Years Exp.</Text>
                                        </View>
                                    </>
                                )}
                            </View>

                            {/* Bio */}
                            {master.bio && (
                                <View style={styles.bioContainer}>
                                    <Text style={styles.masterBio}>{master.bio}</Text>
                                </View>
                            )}
                        </View>

                        {/* Available Services */}
                        <View style={styles.servicesSection}>
                            <View style={styles.sectionHeader}>
                                <MaterialIcons name="spa" size={20} color={colors.primary} />
                                <Text style={styles.sectionTitle}>Available Services</Text>
                            </View>
                            {services.length > 0 ? (
                                services.map((service) => (
                                    <TouchableOpacity
                                        key={service.id}
                                        onPress={() => handleSelectService(service.id)}
                                        activeOpacity={0.7}
                                    >
                                        <Card variant="glass" style={styles.serviceCard}>
                                            <View style={styles.serviceInfo}>
                                                <Text style={styles.serviceName}>{service.name}</Text>
                                                {service.description && (
                                                    <Text style={styles.serviceDescription} numberOfLines={2}>
                                                        {service.description}
                                                    </Text>
                                                )}
                                                <View style={styles.serviceMeta}>
                                                    <View style={styles.priceTag}>
                                                        <Text style={styles.servicePrice}>€{service.base_price}</Text>
                                                    </View>
                                                    <View style={styles.durationTag}>
                                                        <MaterialIcons name="schedule" size={12} color={colors.textSecondary} />
                                                        <Text style={styles.serviceDuration}>
                                                            {service.duration_minutes} min
                                                        </Text>
                                                    </View>
                                                </View>
                                            </View>
                                            <View style={styles.bookButton}>
                                                <MaterialIcons name="arrow-forward" size={18} color="#fff" />
                                            </View>
                                        </Card>
                                    </TouchableOpacity>
                                ))
                            ) : (
                                <Card variant="glass" style={styles.emptyCard}>
                                    <MaterialIcons name="event-busy" size={32} color={colors.textSecondary} />
                                    <Text style={styles.noServices}>No services available at the moment</Text>
                                </Card>
                            )}
                        </View>

                        {/* Portfolio Gallery */}
                        <View style={styles.gallerySection}>
                            <View style={styles.sectionHeader}>
                                <MaterialIcons name="photo-library" size={20} color={colors.primary} />
                                <Text style={styles.sectionTitle}>Portfolio</Text>
                                {portfolioImages.length > 0 && (
                                    <Text style={styles.photoCount}>{portfolioImages.length} photos</Text>
                                )}
                            </View>

                            {portfolioImages.length > 0 ? (
                                <View style={styles.photoGrid}>
                                    {portfolioImages.map((photo, index) => (
                                        <TouchableOpacity
                                            key={photo.id}
                                            onPress={() => openImageViewer(index)}
                                            activeOpacity={0.85}
                                            style={styles.photoContainer}
                                        >
                                            <Image
                                                source={{ uri: photo.image_url }}
                                                style={styles.photoImage}
                                                resizeMode="cover"
                                            />
                                            {photo.description && (
                                                <View style={styles.photoCaptionOverlay}>
                                                    <Text style={styles.photoCaptionText} numberOfLines={1}>
                                                        {photo.description}
                                                    </Text>
                                                </View>
                                            )}
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            ) : (
                                <Card variant="glass" style={styles.emptyCard}>
                                    <MaterialIcons name="photo-camera" size={32} color={colors.textSecondary} />
                                    <Text style={styles.noServices}>No portfolio photos yet</Text>
                                </Card>
                            )}
                        </View>

                        {/* Bottom spacer for scroll */}
                        <View style={{ height: 40 }} />
                    </Animated.View>
                </ScrollView>

                {/* Full-screen Image Viewer Modal */}
                <Modal
                    visible={imageViewerVisible}
                    transparent={true}
                    animationType="fade"
                    onRequestClose={() => setImageViewerVisible(false)}
                >
                    <View style={styles.modalContainer}>
                        {/* Close Button */}
                        <SafeAreaView edges={['top']} style={styles.modalHeader}>
                            <TouchableOpacity
                                onPress={() => setImageViewerVisible(false)}
                                style={styles.modalCloseButton}
                            >
                                <MaterialIcons name="close" size={24} color="#fff" />
                            </TouchableOpacity>
                            <Text style={styles.modalCounter}>
                                {selectedImageIndex + 1} / {portfolioImages.length}
                            </Text>
                            <View style={{ width: 40 }} />
                        </SafeAreaView>

                        {/* Image Carousel */}
                        <FlatList
                            data={portfolioImages}
                            horizontal
                            pagingEnabled
                            showsHorizontalScrollIndicator={false}
                            initialScrollIndex={selectedImageIndex}
                            getItemLayout={(_, index) => ({
                                length: SCREEN_WIDTH,
                                offset: SCREEN_WIDTH * index,
                                index,
                            })}
                            onMomentumScrollEnd={(event) => {
                                const newIndex = Math.round(
                                    event.nativeEvent.contentOffset.x / SCREEN_WIDTH
                                );
                                setSelectedImageIndex(newIndex);
                            }}
                            renderItem={({ item }) => (
                                <View style={styles.modalImageSlide}>
                                    <Image
                                        source={{ uri: item.image_url }}
                                        style={styles.modalImage}
                                        resizeMode="contain"
                                    />
                                </View>
                            )}
                            keyExtractor={(item) => item.id}
                        />

                        {/* Image Caption */}
                        {portfolioImages[selectedImageIndex]?.description && (
                            <SafeAreaView edges={['bottom']} style={styles.modalCaption}>
                                <Text style={styles.modalCaptionText}>
                                    {portfolioImages[selectedImageIndex].description}
                                </Text>
                            </SafeAreaView>
                        )}
                    </View>
                </Modal>
            </SafeAreaView>
        </ScreenBackground>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    errorText: {
        color: colors.textSecondary,
        fontSize: 16,
    },
    scrollView: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
    },
    backButton: {
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: 'rgba(0, 0, 0, 0.03)',
        borderWidth: 1, borderColor: 'rgba(0, 0, 0, 0.06)',
        alignItems: 'center', justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 17, fontWeight: '600', color: '#1A1A1A',
    },

    // Hero Section
    heroSection: {
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.xl,
        position: 'relative',
        overflow: 'hidden',
    },
    heroGradient: {
        position: 'absolute',
        top: -40,
        left: -40,
        right: -40,
        bottom: 0,
        borderRadius: 200,
    },
    masterAvatar: {
        width: 110,
        height: 110,
        borderRadius: 55,
        backgroundColor: 'rgba(139, 92, 246, 0.2)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.md,
        borderWidth: 2,
        borderColor: 'rgba(139, 92, 246, 0.4)',
    },
    masterAvatarImage: {
        width: 110,
        height: 110,
        borderRadius: 55,
        marginBottom: spacing.md,
        borderWidth: 3,
        borderColor: 'rgba(139, 92, 246, 0.5)',
    },
    masterAvatarText: {
        fontSize: 44,
        fontWeight: '600',
        color: colors.text,
    },
    masterName: {
        fontSize: 26,
        fontWeight: '700',
        color: colors.text,
        marginBottom: 6,
        letterSpacing: 0.3,
    },
    locationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginBottom: spacing.md,
    },
    masterLocation: {
        fontSize: 14,
        color: colors.textSecondary,
    },

    // Stats Row
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.03)',
        borderRadius: 16,
        paddingVertical: 14,
        paddingHorizontal: 24,
        marginBottom: spacing.md,
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.05)',
    },
    statItem: {
        alignItems: 'center',
        paddingHorizontal: 16,
    },
    statValue: {
        fontSize: 20,
        fontWeight: '700',
        color: colors.text,
    },
    statLabel: {
        fontSize: 11,
        color: colors.textSecondary,
        marginTop: 2,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    statDivider: {
        width: 1,
        height: 28,
        backgroundColor: 'rgba(0, 0, 0, 0.08)',
    },

    // Bio
    bioContainer: {
        backgroundColor: 'rgba(0, 0, 0, 0.02)',
        borderRadius: 14,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.04)',
        width: '100%',
    },
    masterBio: {
        fontSize: 14,
        color: 'rgba(0, 0, 0, 0.55)',
        textAlign: 'center',
        lineHeight: 21,
    },

    // Sections
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: spacing.lg,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: colors.text,
        flex: 1,
    },
    photoCount: {
        fontSize: 13,
        color: colors.textSecondary,
    },

    // Services
    servicesSection: {
        padding: spacing.lg,
        paddingTop: spacing.md,
    },
    serviceCard: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
    serviceInfo: {
        flex: 1,
    },
    serviceName: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.text,
        marginBottom: 4,
    },
    serviceDescription: {
        fontSize: 13,
        color: colors.textSecondary,
        marginBottom: spacing.sm,
        lineHeight: 18,
    },
    serviceMeta: {
        flexDirection: 'row',
        gap: spacing.sm,
        alignItems: 'center',
    },
    priceTag: {
        backgroundColor: 'rgba(139, 92, 246, 0.15)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
    },
    servicePrice: {
        fontSize: 14,
        fontWeight: '700',
        color: '#A78BFA',
    },
    durationTag: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    serviceDuration: {
        fontSize: 13,
        color: colors.textSecondary,
    },
    bookButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(139, 92, 246, 0.25)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(139, 92, 246, 0.3)',
    },
    emptyCard: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.xl,
        gap: spacing.sm,
    },
    noServices: {
        color: colors.textSecondary,
        fontSize: 14,
        textAlign: 'center',
    },

    // Photo Gallery
    gallerySection: {
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.lg,
    },
    photoGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: PHOTO_GAP,
    },
    photoContainer: {
        width: PHOTO_SIZE,
        height: PHOTO_SIZE,
        borderRadius: 14,
        overflow: 'hidden',
        backgroundColor: 'rgba(0, 0, 0, 0.03)',
    },
    photoImage: {
        width: '100%',
        height: '100%',
    },
    photoCaptionOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(0,0,0,0.6)',
        paddingVertical: 6,
        paddingHorizontal: 8,
    },
    photoCaptionText: {
        fontSize: 11,
        color: '#1A1A1A',
        fontWeight: '500',
    },

    // Image Viewer Modal
    modalContainer: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.95)',
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
    },
    modalCloseButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(0, 0, 0, 0.08)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalCounter: {
        fontSize: 15,
        color: 'rgba(0, 0, 0, 0.55)',
        fontWeight: '500',
    },
    modalImageSlide: {
        width: SCREEN_WIDTH,
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalImage: {
        width: SCREEN_WIDTH - 20,
        height: '80%',
    },
    modalCaption: {
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    modalCaptionText: {
        fontSize: 14,
        color: 'rgba(0, 0, 0, 0.60)',
        textAlign: 'center',
        lineHeight: 20,
    },
});

export default MasterDetailScreen;
