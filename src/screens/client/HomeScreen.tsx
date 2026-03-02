import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    RefreshControl,
    Dimensions,
    Image,
    TextInput,
    Keyboard,
    TouchableWithoutFeedback,
} from 'react-native';
import * as Location from 'expo-location';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { format, isToday, isTomorrow, parseISO, differenceInDays } from 'date-fns';
import { useAuth } from '../../contexts/AuthContext';
import { useCart } from '../../contexts/CartContext';
import { supabase } from '../../lib/supabase';
import { ScreenBackground, MerakiText } from '../../components/ui';
import { colors, spacing, gradients } from '../../theme';
import { safeSupabaseFetch } from '../../lib/supabaseApi';
import { Service } from '../../types/database';

const { width } = Dimensions.get('window');

interface Appointment {
    id: string;
    start_time: string;
    end_time: string;
    status: string;
    service?: { name: string; duration_minutes: number; price: number };
    master?: { full_name: string };
}

interface RecentOrder {
    id: string;
    total: number;
    status: string;
    created_at: string;
}

interface FeaturedMaster {
    id: string;
    full_name: string;
    avatar_url: string | null;
    bio: string | null;
    country: string | null;
    latitude: number | null;
    longitude: number | null;
}

// Haversine distance in km between two lat/lng points
function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

interface Master {
    id: string;
    full_name: string;
    avatar_url: string | null;
    city: string | null;
    country: string | null;
    bio: string | null;
    services_count: number;
    is_visible_globally: boolean;
    accepts_new_clients: boolean;
}

interface SearchServiceResult {
    id: string; // master_service_id
    service_name: string;
    price: number;
    currency: string;
    master_id: string;
    master_name: string;
    master_country: string | null;
}

interface SearchCourseResult {
    id: string;
    title: string;
    instructor_name: string;
    price: number;
    thumbnail_url: string | null;
    description: string | null;
}

export function ClientHomeScreen() {
    const navigation = useNavigation<any>();
    const { profile, user, checkSession } = useAuth();
    const { getItemCount } = useCart();
    const [refreshing, setRefreshing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [loyaltyPoints, setLoyaltyPoints] = useState(0);
    const [nextAppointment, setNextAppointment] = useState<Appointment | null>(null);
    const [upcomingAppointments, setUpcomingAppointments] = useState<Appointment[]>([]);
    const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
    const [featuredMasters, setFeaturedMasters] = useState<FeaturedMaster[]>([]);
    const [availableServices, setAvailableServices] = useState<Service[]>([]);
    const [totalVisits, setTotalVisits] = useState(0);
    const [totalOrders, setTotalOrders] = useState(0);

    // Search State
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [allMasters, setAllMasters] = useState<Master[]>([]);
    const [allServices, setAllServices] = useState<SearchServiceResult[]>([]);
    const [allCourses, setAllCourses] = useState<SearchCourseResult[]>([]);

    const [searchResults, setSearchResults] = useState<Master[]>([]);
    const [serviceResults, setServiceResults] = useState<SearchServiceResult[]>([]);
    const [courseResults, setCourseResults] = useState<SearchCourseResult[]>([]);

    const [userCountry, setUserCountry] = useState<string | null>(profile?.country || null);
    const [userLat, setUserLat] = useState<number | null>((profile as any)?.latitude || null);
    const [userLng, setUserLng] = useState<number | null>((profile as any)?.longitude || null);
    const searchRadiusKm: number = (profile as any)?.search_radius_km ?? 50;
    const [searchLoading, setSearchLoading] = useState(false);
    const [locationReady, setLocationReady] = useState(false);

    const fetchHomeData = async (loc?: { country: string | null; lat: number | null; lng: number | null }) => {
        if (!user) return;
        const isSessionValid = await checkSession();
        if (!isSessionValid) { setLoading(false); setRefreshing(false); return; }

        // Use passed-in location (fresh from detectUserLocation) over stale state
        const effectiveCountry = loc?.country || profile?.country || userCountry;
        const effectiveLat = loc?.lat ?? userLat;
        const effectiveLng = loc?.lng ?? userLng;

        try {
            const profilePromise = (supabase as any).from('profiles').select('loyalty_points').eq('id', user.id).single();
            const { data: profileData } = await safeSupabaseFetch(profilePromise, { timeout: 5000, errorMessage: 'Failed to load loyalty data' });
            if (profileData) setLoyaltyPoints((profileData as any).loyalty_points || 0);

            const now = new Date().toISOString();
            const appointmentsPromise = (supabase as any)
                .from('appointments')
                .select(`id, start_time, end_time, status, service:services (name, duration_minutes, base_price), master:profiles!appointments_master_id_fkey (full_name)`)
                .eq('client_id', user.id).in('status', ['confirmed', 'pending']).gte('start_time', now).order('start_time', { ascending: true }).limit(5);
            const { data: appointments } = await safeSupabaseFetch(appointmentsPromise, { timeout: 8000 });
            setUpcomingAppointments((appointments as any) || []);
            setNextAppointment((appointments as any)?.[0] || null);

            const visitsPromise = (supabase as any).from('appointments').select('*', { count: 'exact', head: true }).eq('client_id', user.id).eq('status', 'completed');
            const { count: visitCount } = await visitsPromise;
            setTotalVisits(visitCount || 0);

            const ordersPromise = (supabase as any).from('orders').select('id, total, status, created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(3);
            const { data: orders } = await safeSupabaseFetch(ordersPromise, { timeout: 5000 });
            setRecentOrders((orders as any) || []);

            // Fetch featured masters with their lat/lng for distance filtering
            // Exclude the logged-in user so owners/masters never see themselves in the client view
            const mastersPromise = (supabase as any).from('profiles').select('id, full_name, avatar_url, bio, country, latitude, longitude').or('is_master.eq.true,role.eq.master,role.eq.owner').neq('id', user.id).limit(50);
            const { data: masters } = await safeSupabaseFetch(mastersPromise, { timeout: 5000 });

            // Filter masters by country + radius
            let filteredMasters = (masters as FeaturedMaster[]) || [];
            if (effectiveCountry) {
                const uCountry = effectiveCountry.toLowerCase().trim();
                filteredMasters = filteredMasters.filter(m => {
                    if (!m.country || m.country.toLowerCase().trim() !== uCountry) return false;
                    if (searchRadiusKm > 0 && effectiveLat && effectiveLng && m.latitude && m.longitude) {
                        const dist = haversineDistanceKm(effectiveLat, effectiveLng, m.latitude, m.longitude);
                        if (dist > searchRadiusKm) return false;
                    }
                    return true;
                });
            } else {
                // No country detected at all — show nothing rather than unfiltered data
                filteredMasters = [];
            }
            setFeaturedMasters(filteredMasters);

            // Fetch services with master country info for filtering
            const servicesPromise = (supabase as any)
                .from('services')
                .select('*, master_services!inner(is_available, master_id, master:profiles!master_services_master_id_fkey(country, latitude, longitude))')
                .eq('is_active', true)
                .eq('master_services.is_available', true)
                .order('name')
                .limit(20);
            const { data: servicesData } = await safeSupabaseFetch(servicesPromise, { timeout: 5000 });

            // Filter services: exclude the logged-in user's own services + keep only those with at least one master in the user's country + radius
            let filteredServices = (servicesData as any[]) || [];
            // Remove services that only belong to the current user
            filteredServices = filteredServices.filter(service => {
                const masterServices = service.master_services || [];
                const hasOtherMaster = masterServices.some((ms: any) => ms.master_id !== user.id);
                return hasOtherMaster;
            });
            if (effectiveCountry) {
                const uCountry = effectiveCountry.toLowerCase().trim();
                filteredServices = filteredServices.filter(service => {
                    const masterServices = service.master_services || [];
                    return masterServices.some((ms: any) => {
                        if (ms.master_id === user.id) return false; // Skip self
                        const masterProfile = ms.master;
                        if (!masterProfile?.country) return false;
                        if (masterProfile.country.toLowerCase().trim() !== uCountry) return false;
                        if (searchRadiusKm > 0 && effectiveLat && effectiveLng && masterProfile.latitude && masterProfile.longitude) {
                            const dist = haversineDistanceKm(effectiveLat, effectiveLng, masterProfile.latitude, masterProfile.longitude);
                            if (dist > searchRadiusKm) return false;
                        }
                        return true;
                    });
                });
            } else {
                // No country detected — show nothing rather than unfiltered data
                filteredServices = [];
            }
            setAvailableServices(filteredServices.slice(0, 6));
        } catch (error) {
            console.error('Error fetching home data:', error);
        } finally { setLoading(false); setRefreshing(false); }
    };

    // Fast location: returns profile data immediately, no GPS wait
    const getProfileLocation = (): { country: string | null; lat: number | null; lng: number | null } => {
        return {
            country: profile?.country || null,
            lat: (profile as any)?.latitude || null,
            lng: (profile as any)?.longitude || null,
        };
    };

    // Background GPS detection — updates state for future renders, returns resolved location
    const detectUserLocationInBackground = async () => {
        // Sync profile values into state
        if (profile?.country && !userCountry) setUserCountry(profile.country);
        if ((profile as any)?.latitude) setUserLat((profile as any).latitude);
        if ((profile as any)?.longitude) setUserLng((profile as any).longitude);
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status === 'granted') {
                const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
                const [address] = await Location.reverseGeocodeAsync({
                    latitude: location.coords.latitude,
                    longitude: location.coords.longitude,
                });
                if (address?.country) {
                    setUserCountry(address.country);
                }
                setUserLat(location.coords.latitude);
                setUserLng(location.coords.longitude);
                // Return the GPS-resolved location for optional re-fetch
                return {
                    country: address?.country || profile?.country || null,
                    lat: location.coords.latitude,
                    lng: location.coords.longitude,
                };
            }
        } catch (error) {
            console.log('Location detection failed:', error);
        }
        setLocationReady(true);
        return null;
    };

    const fetchAllSearchData = async () => {
        try {
            // 1. Fetch Masters
            const { data: mastersData } = await supabase
                .from('profiles')
                .select('id, full_name, avatar_url, city, country, bio')
                .in('role', ['master', 'owner'])
                .not('full_name', 'is', null);

            const { data: settingsData } = await (supabase as any)
                .from('master_settings')
                .select('master_id, is_visible_globally, accepts_new_clients');

            const { data: servicesCountData } = await supabase
                .from('master_services')
                .select('master_id');

            const settingsMap = new Map();
            (settingsData || []).forEach((s: any) => settingsMap.set(s.master_id, s));

            const serviceCounts = new Map<string, number>();
            (servicesCountData || []).forEach((s: any) => serviceCounts.set(s.master_id, (serviceCounts.get(s.master_id) || 0) + 1));

            const processedMasters: Master[] = (mastersData || [])
                .filter((m: any) => {
                    const settings = settingsMap.get(m.id);
                    return !settings || settings.is_visible_globally !== false;
                })
                .map((m: any) => {
                    const settings = settingsMap.get(m.id);
                    return {
                        ...m,
                        services_count: serviceCounts.get(m.id) || 0,
                        is_visible_globally: settings?.is_visible_globally ?? true,
                        accepts_new_clients: settings?.accepts_new_clients ?? true,
                    };
                });
            setAllMasters(processedMasters);

            // 2. Fetch Services (linked to masters)
            const { data: servicesData } = await supabase
                .from('master_services')
                .select(`
                    id,
                    custom_price,
                    service:services!inner(name, base_price),
                    master:profiles!inner(id, full_name, country, currency)
                `)
                .eq('is_available', true);

            const processedServices: SearchServiceResult[] = (servicesData || []).map((item: any) => ({
                id: item.id,
                service_name: item.service?.name,
                price: item.custom_price || item.service?.base_price || 0,
                currency: item.master?.currency || 'EUR',
                master_id: item.master?.id,
                master_name: item.master?.full_name,
                master_country: item.master?.country,
            }));
            setAllServices(processedServices);

            // 3. Fetch Academy Courses (Global)
            const { data: coursesData } = await supabase
                .from('courses')
                .select(`
                    id, title, price, thumbnail_url, description,
                    instructor:profiles(full_name)
                `)
                .eq('is_published', true);

            const processedCourses: SearchCourseResult[] = (coursesData || []).map((item: any) => ({
                id: item.id,
                title: item.title,
                instructor_name: item.instructor?.full_name || 'Merakí Academy',
                price: item.price || 0,
                thumbnail_url: item.thumbnail_url,
                description: item.description,
            }));
            setAllCourses(processedCourses);

        } catch (error) {
            console.error('Error fetching search data:', error);
        }
    };

    const handleSearch = (text: string) => {
        setSearchQuery(text);
        if (text.length > 0) {
            setIsSearching(true);
            performSearch(text);
        } else {
            setIsSearching(false);
            setSearchResults([]);
            setServiceResults([]);
            setCourseResults([]);
        }
    };

    const performSearch = (query: string) => {
        const lowerQuery = query.toLowerCase();

        // 1. Masters (Strict Country)
        const filteredMasters = allMasters.filter(master => {
            if (userCountry) {
                if (!master.country) return false;
                const uCountry = userCountry.toLowerCase().trim();
                const mCountry = master.country.toLowerCase().trim();
                if (uCountry !== mCountry) return false;
            }
            return (
                master.full_name?.toLowerCase().includes(lowerQuery) ||
                master.city?.toLowerCase().includes(lowerQuery) ||
                master.country?.toLowerCase().includes(lowerQuery)
            );
        });
        setSearchResults(filteredMasters);

        // 2. Services (Strict Country of Master)
        const filteredServices = allServices.filter(service => {
            if (userCountry) {
                if (!service.master_country) return false;
                const uCountry = userCountry.toLowerCase().trim();
                const mCountry = service.master_country.toLowerCase().trim();
                if (uCountry !== mCountry) return false;
            }
            return service.service_name?.toLowerCase().includes(lowerQuery);
        });
        setServiceResults(filteredServices);

        // 3. Academy (Global)
        const filteredCourses = allCourses.filter(course =>
            course.title?.toLowerCase().includes(lowerQuery) ||
            course.instructor_name?.toLowerCase().includes(lowerQuery)
        );
        setCourseResults(filteredCourses);
    };

    const clearSearch = () => {
        setSearchQuery('');
        setIsSearching(false);
        Keyboard.dismiss();
    };

    useFocusEffect(useCallback(() => {
        // Use profile location instantly (no GPS wait), then refine with GPS in background
        const profileLoc = getProfileLocation();
        setLocationReady(true);
        fetchHomeData(profileLoc);
        fetchAllSearchData();

        // Background: refine with GPS (only re-fetches if country changes)
        detectUserLocationInBackground().then(gpsLoc => {
            if (gpsLoc && gpsLoc.country && gpsLoc.country !== profileLoc.country) {
                // GPS country differs from profile — re-fetch with updated location
                fetchHomeData(gpsLoc);
            }
        });
    }, [user]));
    const onRefresh = async () => {
        setRefreshing(true);
        const profileLoc = getProfileLocation();
        await fetchHomeData(profileLoc);
    };

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good Morning';
        if (hour < 18) return 'Good Afternoon';
        return 'Good Evening';
    };

    const formatNextVisit = () => {
        if (!nextAppointment) return 'No upcoming';
        const date = parseISO(nextAppointment.start_time);
        const time = format(date, 'HH:mm');
        if (isToday(date)) return `Today, ${time}`;
        if (isTomorrow(date)) return `Tomorrow, ${time}`;
        const daysAway = differenceInDays(date, new Date());
        if (daysAway < 7) return format(date, 'EEEE, HH:mm');
        return format(date, 'MMM d, HH:mm');
    };

    const getServiceIcon = (category: string | null) => {
        switch (category) {
            case 'Nails': return 'content-cut'; // Fallback to content-cut if needed, or specific icon
            case 'Lashes': return 'visibility';
            case 'Brows': return 'face';
            case 'Hair': return 'content-cut';
            default: return 'spa';
        }
    };

    const getServiceColor = (category: string | null) => {
        switch (category) {
            case 'Nails': return '#f59e0b';
            case 'Lashes': return '#8b5cf6';
            case 'Brows': return '#ec4899';
            case 'Hair': return '#C8A04D';
            default: return '#10b981';
        }
    };


    const cartCount = getItemCount();

    return (
        <ScreenBackground>
            <SafeAreaView style={styles.safeArea}>
                <ScrollView
                    showsVerticalScrollIndicator={false}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
                    contentContainerStyle={styles.scrollContent}
                >
                    {/* Header */}
                    <View style={styles.header}>
                        <View>
                            <MerakiText style={styles.greeting}>{getGreeting()},</MerakiText>
                            <MerakiText style={styles.userName}>{profile?.full_name?.split(' ')[0] || 'Guest'}</MerakiText>
                        </View>
                        <View style={styles.headerIcons}>
                            <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('QRScanner')}>
                                <MaterialIcons name="qr-code-scanner" size={20} color="rgba(255,255,255,0.7)" />
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('NFCScanner')}>
                                <MaterialIcons name="nfc" size={20} color="rgba(255,255,255,0.7)" />
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('Notifications')}>
                                <MaterialIcons name="notifications-none" size={22} color="rgba(255,255,255,0.7)" />
                            </TouchableOpacity>
                            {cartCount > 0 && (
                                <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('Shop', { screen: 'Cart' })}>
                                    <MaterialIcons name="shopping-bag" size={20} color="rgba(255,255,255,0.7)" />
                                    <View style={styles.badge}><Text style={styles.badgeText}>{cartCount}</Text></View>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>

                    {/* Search Bar - Inline */}
                    <View style={styles.searchBar}>
                        <MaterialIcons name="search" size={20} color="rgba(255,255,255,0.3)" />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search masters, services..."
                            placeholderTextColor="rgba(255,255,255,0.3)"
                            value={searchQuery}
                            onChangeText={handleSearch}
                            onFocus={() => setIsSearching(true)}
                        />
                        {isSearching ? (
                            <TouchableOpacity onPress={clearSearch}>
                                <MerakiText style={{ color: colors.primary, fontWeight: '600', fontSize: 14 }}>Cancel</MerakiText>
                            </TouchableOpacity>
                        ) : (
                            <View style={styles.searchFilter}>
                                <MaterialIcons name="tune" size={18} color="rgba(255,255,255,0.5)" />
                            </View>
                        )}
                    </View>

                    {/* Search Results Overlay */}
                    {isSearching ? (
                        <View style={{ paddingBottom: 100 }}>
                            {searchResults.length === 0 && serviceResults.length === 0 && courseResults.length === 0 ? (
                                <View style={{ alignItems: 'center', marginTop: 40 }}>
                                    <MaterialIcons name="search-off" size={48} color="rgba(255,255,255,0.2)" />
                                    <MerakiText style={{ color: 'rgba(255,255,255,0.5)', marginTop: 16 }}>No results found for "{searchQuery}"</MerakiText>
                                </View>
                            ) : (
                                <>
                                    {/* Masters Section */}
                                    {searchResults.length > 0 && (
                                        <View style={styles.section}>
                                            <MerakiText style={[styles.sectionTitle, { fontSize: 16, marginBottom: 12 }]}>Masters</MerakiText>
                                            {searchResults.map((master) => (
                                                <TouchableOpacity
                                                    key={master.id}
                                                    style={styles.masterCardFull}
                                                    onPress={() => navigation.navigate('MasterDetail', { masterId: master.id })}
                                                >
                                                    <View style={styles.masterRow}>
                                                        {master.avatar_url ? (
                                                            <Image source={{ uri: master.avatar_url }} style={styles.masterAvatarSmall} />
                                                        ) : (
                                                            <View style={[styles.masterAvatarSmall, { backgroundColor: colors.surfaceLight }]}>
                                                                <Text style={styles.masterInitialSmall}>{master.full_name?.[0] || '?'}</Text>
                                                            </View>
                                                        )}
                                                        <View style={{ flex: 1, marginLeft: 12 }}>
                                                            <MerakiText style={styles.masterName} numberOfLines={1}>{master.full_name}</MerakiText>
                                                            <MerakiText style={styles.masterBio} numberOfLines={1}>
                                                                {master.city}{master.country ? `, ${master.country}` : ''}
                                                            </MerakiText>
                                                            <MerakiText style={[styles.masterBio, { marginTop: 2 }]}>
                                                                {master.services_count} services
                                                            </MerakiText>
                                                        </View>
                                                        <MaterialIcons name="chevron-right" size={20} color="rgba(255,255,255,0.3)" />
                                                    </View>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    )}

                                    {/* Services Section */}
                                    {serviceResults.length > 0 && (
                                        <View style={styles.section}>
                                            <MerakiText style={[styles.sectionTitle, { fontSize: 16, marginBottom: 12 }]}>Services</MerakiText>
                                            {serviceResults.map((service) => (
                                                <TouchableOpacity
                                                    key={`${service.id}-${service.master_id}`} // Unique key
                                                    style={styles.masterCardFull}
                                                    onPress={() => navigation.navigate('MasterDetail', { masterId: service.master_id })}
                                                >
                                                    <View style={styles.masterRow}>
                                                        <View style={[styles.masterAvatarSmall, { backgroundColor: 'rgba(200, 160, 77, 0.1)' }]}>
                                                            <MaterialIcons name="spa" size={24} color={colors.primary} />
                                                        </View>
                                                        <View style={{ flex: 1, marginLeft: 12 }}>
                                                            <MerakiText style={styles.masterName} numberOfLines={1}>{service.service_name}</MerakiText>
                                                            <MerakiText style={styles.masterBio} numberOfLines={1}>
                                                                by {service.master_name}
                                                            </MerakiText>
                                                            <MerakiText style={[styles.masterName, { fontSize: 13, marginTop: 4, color: colors.primary }]}>
                                                                {service.currency === 'USD' ? '$' : '€'}{service.price}
                                                            </MerakiText>
                                                        </View>
                                                        <MaterialIcons name="chevron-right" size={20} color="rgba(255,255,255,0.3)" />
                                                    </View>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    )}

                                    {/* Academy Section */}
                                    {courseResults.length > 0 && (
                                        <View style={styles.section}>
                                            <MerakiText style={[styles.sectionTitle, { fontSize: 16, marginBottom: 12 }]}>Academy</MerakiText>
                                            {courseResults.map((course) => (
                                                <TouchableOpacity
                                                    key={course.id}
                                                    style={styles.masterCardFull}
                                                    onPress={() => navigation.navigate('Academy', {
                                                        screen: 'CourseDetail',
                                                        params: {
                                                            course: {
                                                                id: course.id,
                                                                title: course.title,
                                                                price: course.price,
                                                                thumbnail_url: course.thumbnail_url,
                                                                description: course.description,
                                                                instructor: { full_name: course.instructor_name }
                                                            }
                                                        }
                                                    })}
                                                >
                                                    <View style={styles.masterRow}>
                                                        {course.thumbnail_url ? (
                                                            <Image source={{ uri: course.thumbnail_url }} style={styles.masterAvatarSmall} />
                                                        ) : (
                                                            <View style={[styles.masterAvatarSmall, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
                                                                <MaterialIcons name="school" size={24} color="#3b82f6" />
                                                            </View>
                                                        )}
                                                        <View style={{ flex: 1, marginLeft: 12 }}>
                                                            <MerakiText style={styles.masterName} numberOfLines={1}>{course.title}</MerakiText>
                                                            <MerakiText style={styles.masterBio} numberOfLines={1}>
                                                                Instructor: {course.instructor_name}
                                                            </MerakiText>
                                                            <MerakiText style={[styles.masterName, { fontSize: 13, marginTop: 4, color: '#3b82f6' }]}>
                                                                {typeof course.price === 'number' && course.price > 0 ? `€${course.price}` : 'Free'}
                                                            </MerakiText>
                                                        </View>
                                                        <MaterialIcons name="chevron-right" size={20} color="rgba(255,255,255,0.3)" />
                                                    </View>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    )}
                                </>
                            )}
                        </View>
                    ) : (
                        <>

                            {/* Location Missing Alert */}
                            {profile && !profile.city && (
                                <TouchableOpacity style={styles.alertBanner} onPress={() => navigation.navigate('Profile')}>
                                    <MaterialIcons name="location-on" size={20} color="#fb923c" />
                                    <View style={{ flex: 1, marginLeft: 12 }}>
                                        <MerakiText style={styles.alertTitle}>Complete Your Profile</MerakiText>
                                        <MerakiText style={styles.alertSubtitle}>Add your city to see masters near you</MerakiText>
                                    </View>
                                    <MaterialIcons name="chevron-right" size={20} color="rgba(255,255,255,0.3)" />
                                </TouchableOpacity>
                            )}

                            {/* Quick Actions */}
                            <View style={styles.quickActions}>
                                {[
                                    { icon: 'calendar-today', label: 'Book', route: 'Book' },
                                    { icon: 'explore', label: 'Discover', route: 'DiscoverMasters' },
                                    { icon: 'star-outline', label: 'Loyalty', route: 'LoyaltyPoints' },
                                    { icon: 'local-mall', label: 'Shop', route: 'Shop' },
                                ].map((action) => (
                                    <TouchableOpacity
                                        key={action.label}
                                        style={styles.quickAction}
                                        onPress={() => navigation.navigate(action.route)}
                                    >
                                        <View style={styles.quickActionIcon}>
                                            <MaterialIcons name={action.icon as any} size={22} color={colors.primary} />
                                        </View>
                                        <MerakiText style={styles.quickActionLabel}>{action.label}</MerakiText>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            {/* Next Appointment */}
                            {nextAppointment && (
                                <TouchableOpacity style={styles.appointmentCard} onPress={() => navigation.navigate('Book')}>
                                    <View style={styles.appointmentIconWrap}>
                                        <MaterialIcons name="event" size={24} color={colors.primary} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <MerakiText style={styles.appointmentTitle}>
                                            {nextAppointment.service?.name || 'Appointment'}
                                        </MerakiText>
                                        <MerakiText style={styles.appointmentMeta}>
                                            {formatNextVisit()} • {nextAppointment.master?.full_name}
                                        </MerakiText>
                                    </View>
                                    <MaterialIcons name="chevron-right" size={20} color="rgba(255,255,255,0.3)" />
                                </TouchableOpacity>
                            )}

                            {/* Featured Masters */}
                            {featuredMasters.length > 0 && !loading && locationReady && (
                                <View style={styles.section}>
                                    <View style={styles.sectionHeader}>
                                        <MerakiText style={styles.sectionTitle}>Featured Masters</MerakiText>
                                        <TouchableOpacity onPress={() => navigation.navigate('DiscoverMasters')}>
                                            <MerakiText style={styles.seeAll}>See All</MerakiText>
                                        </TouchableOpacity>
                                    </View>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 24 }}>
                                        {featuredMasters
                                            .slice(0, 10)
                                            .map((master) => (
                                                <TouchableOpacity
                                                    key={master.id}
                                                    style={styles.masterCard}
                                                    onPress={() => navigation.navigate('MasterDetail', { masterId: master.id })}
                                                >
                                                    {master.avatar_url ? (
                                                        <Image source={{ uri: master.avatar_url }} style={styles.masterAvatar} />
                                                    ) : (
                                                        <LinearGradient colors={[...gradients.primary]} style={styles.masterAvatar}>
                                                            <Text style={styles.masterInitial}>{master.full_name?.[0] || '?'}</Text>
                                                        </LinearGradient>
                                                    )}
                                                    <MerakiText style={styles.masterName} numberOfLines={1}>{master.full_name || 'Master'}</MerakiText>
                                                    {master.bio && (
                                                        <MerakiText style={styles.masterBio} numberOfLines={1}>{master.bio}</MerakiText>
                                                    )}
                                                </TouchableOpacity>
                                            ))}
                                    </ScrollView>
                                </View>
                            )}

                            {/* Services — only show after location + data are resolved */}
                            <View style={styles.section}>
                                <View style={styles.sectionHeader}>
                                    <MerakiText style={styles.sectionTitle}>Services</MerakiText>
                                    <TouchableOpacity onPress={() => navigation.navigate('DiscoverMasters')}>
                                        <MerakiText style={styles.seeAll}>See All</MerakiText>
                                    </TouchableOpacity>
                                </View>
                                <View style={styles.servicesGrid}>
                                    {loading || !locationReady ? null : availableServices.length > 0 ? (
                                        availableServices.map((service) => (
                                            <TouchableOpacity
                                                key={service.id}
                                                style={styles.serviceCard}
                                                onPress={() => navigation.navigate('ServiceDetail', { serviceId: service.id })}
                                            >
                                                <View style={[styles.serviceIcon, { backgroundColor: `${getServiceColor(service.category)}15` }]}>
                                                    <MaterialIcons name={getServiceIcon(service.category) as any} size={24} color={getServiceColor(service.category)} />
                                                </View>
                                                <MerakiText style={styles.serviceLabel} numberOfLines={2}>{service.name}</MerakiText>
                                            </TouchableOpacity>
                                        ))
                                    ) : (
                                        <MerakiText style={{ color: 'rgba(255,255,255,0.5)', marginLeft: 4 }}>No services available at the moment.</MerakiText>
                                    )}
                                </View>
                            </View>

                            {/* Stats */}
                            <View style={styles.statsRow}>
                                <TouchableOpacity style={styles.statCard} onPress={() => navigation.navigate('LoyaltyPoints')}>
                                    <MerakiText style={styles.statValue}>{loading ? '...' : loyaltyPoints.toLocaleString()}</MerakiText>
                                    <MerakiText style={styles.statLabel}>Loyalty Points</MerakiText>
                                </TouchableOpacity>
                                <View style={styles.statCard}>
                                    <MerakiText style={styles.statValue}>{totalVisits}</MerakiText>
                                    <MerakiText style={styles.statLabel}>Total Visits</MerakiText>
                                </View>
                                <TouchableOpacity style={styles.statCard} onPress={() => navigation.navigate('Orders')}>
                                    <MerakiText style={styles.statValue}>{recentOrders.length}</MerakiText>
                                    <MerakiText style={styles.statLabel}>Orders</MerakiText>
                                </TouchableOpacity>
                            </View>

                            {/* Recent Orders */}
                            {recentOrders.length > 0 && (
                                <View style={styles.section}>
                                    <View style={styles.sectionHeader}>
                                        <MerakiText style={styles.sectionTitle}>Recent Orders</MerakiText>
                                        <TouchableOpacity onPress={() => navigation.navigate('Orders')}>
                                            <MerakiText style={styles.seeAll}>See All</MerakiText>
                                        </TouchableOpacity>
                                    </View>
                                    {recentOrders.slice(0, 2).map((order) => (
                                        <TouchableOpacity key={order.id} style={styles.orderRow} onPress={() => navigation.navigate('Orders')}>
                                            <View style={styles.orderIconWrap}>
                                                <MaterialIcons name="shopping-bag" size={20} color={colors.primary} />
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <MerakiText style={styles.orderTitle}>Order #{order.id.slice(0, 8).toUpperCase()}</MerakiText>
                                                <MerakiText style={styles.orderDate}>{format(parseISO(order.created_at), 'MMM d, yyyy')}</MerakiText>
                                            </View>
                                            <View style={{ alignItems: 'flex-end' }}>
                                                <MerakiText style={styles.orderTotal}>€{order.total.toFixed(2)}</MerakiText>
                                                <View style={[styles.statusBadge, order.status === 'delivered' && styles.statusDelivered]}>
                                                    <MerakiText style={styles.statusText}>{order.status}</MerakiText>
                                                </View>
                                            </View>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            )}

                        </>
                    )}
                </ScrollView>
            </SafeAreaView>
        </ScreenBackground >
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1 },
    scrollContent: { paddingHorizontal: 20, paddingBottom: 100 },

    // Header
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, marginBottom: 24 },
    greeting: { fontSize: 13, color: 'rgba(255,255,255,0.4)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 2 },
    userName: { fontSize: 28, fontWeight: '700', color: '#fff', letterSpacing: -0.5 },
    headerIcons: { flexDirection: 'row', gap: 8 },
    iconBtn: {
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
        alignItems: 'center', justifyContent: 'center',
    },
    badge: {
        position: 'absolute', top: -2, right: -2,
        backgroundColor: colors.primary, borderRadius: 8, minWidth: 16, height: 16,
        alignItems: 'center', justifyContent: 'center',
    },
    badgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },

    // Search
    searchBar: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 9999,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
        paddingHorizontal: 20, paddingVertical: 14, marginBottom: 24, gap: 12,
    },

    searchInput: { flex: 1, fontSize: 14, color: '#fff', paddingVertical: 4 },
    searchFilter: {
        width: 32, height: 32, borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.06)',
        alignItems: 'center', justifyContent: 'center',
    },

    // Alert Banner
    alertBanner: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: 'rgba(251,146,60,0.08)', borderRadius: 16,
        borderWidth: 1, borderColor: 'rgba(251,146,60,0.2)',
        padding: 16, marginBottom: 24,
    },
    alertTitle: { fontSize: 14, fontWeight: '600', color: '#fb923c' },
    alertSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 2 },

    // Quick Actions
    quickActions: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 28 },
    quickAction: { alignItems: 'center', gap: 8 },
    quickActionIcon: {
        width: 56, height: 56, borderRadius: 16,
        backgroundColor: 'rgba(200, 160, 77, 0.08)',
        borderWidth: 1, borderColor: 'rgba(200, 160, 77, 0.15)',
        alignItems: 'center', justifyContent: 'center',
    },
    quickActionLabel: { fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: '500' },

    // Appointment Card
    appointmentCard: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
        padding: 16, marginBottom: 28, gap: 14,
    },
    appointmentIconWrap: {
        width: 48, height: 48, borderRadius: 14,
        backgroundColor: 'rgba(200, 160, 77, 0.1)',
        alignItems: 'center', justifyContent: 'center',
    },
    appointmentTitle: { fontSize: 15, fontWeight: '600', color: '#fff' },
    appointmentMeta: { fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 },

    // Section
    section: { marginBottom: 28 },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    sectionTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
    seeAll: { fontSize: 13, color: colors.primary, fontWeight: '600' },

    // Featured Masters
    masterCard: {
        width: 120, marginRight: 12,
        backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
        padding: 16, alignItems: 'center',
    },
    masterAvatar: {
        width: 64, height: 64, borderRadius: 32,
        marginBottom: 10, alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
    },
    masterInitial: { color: '#fff', fontSize: 22, fontWeight: '700' },
    masterName: { fontSize: 13, fontWeight: '600', color: '#fff', textAlign: 'center' },
    masterBio: { fontSize: 11, color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginTop: 2 },

    // Services Grid
    servicesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    serviceCard: {
        width: (width - 52) / 2, // 2 columns with gap
        backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
        padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12,
    },
    serviceIcon: {
        width: 44, height: 44, borderRadius: 12,
        alignItems: 'center', justifyContent: 'center',
    },
    serviceLabel: { fontSize: 13, fontWeight: '600', color: '#fff', flex: 1 },

    // Stats
    statsRow: { flexDirection: 'row', gap: 10, marginBottom: 28 },
    statCard: {
        flex: 1,
        backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
        padding: 16, alignItems: 'center',
    },
    statValue: { fontSize: 22, fontWeight: '700', color: '#fff' },
    statLabel: { fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 4 },

    // Orders
    orderRow: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 14,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
        padding: 14, marginBottom: 8, gap: 12,
    },
    orderIconWrap: {
        width: 40, height: 40, borderRadius: 12,
        backgroundColor: 'rgba(200, 160, 77, 0.1)',
        alignItems: 'center', justifyContent: 'center',
    },
    orderTitle: { fontSize: 14, fontWeight: '600', color: '#fff' },
    orderDate: { fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 2 },
    orderTotal: { fontSize: 14, fontWeight: '700', color: '#fff' },
    statusBadge: {
        paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6,
        backgroundColor: 'rgba(255,255,255,0.08)', marginTop: 4,
    },
    statusDelivered: { backgroundColor: 'rgba(34,197,94,0.15)' },
    statusText: { fontSize: 10, color: 'rgba(255,255,255,0.5)', textTransform: 'capitalize', fontWeight: '600' },


    // Search Results
    masterCardFull: {
        backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
        padding: 16, marginBottom: 12,
    },
    masterRow: { flexDirection: 'row', alignItems: 'center' },
    masterAvatarSmall: {
        width: 48, height: 48, borderRadius: 24,
        alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
    },
    masterInitialSmall: { color: '#fff', fontSize: 18, fontWeight: '700' },
});

export default ClientHomeScreen;
