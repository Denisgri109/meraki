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
import { format, isToday, isTomorrow, parseISO, differenceInDays } from 'date-fns';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useCart } from '../../contexts/CartContext';
import { useModal } from '../../contexts/ModalContext';
import { supabase } from '../../lib/supabase';
import { ScreenBackground, MerakiText } from '../../components/ui';
import { colors, spacing, gradients } from '../../theme';
import { safeSupabaseFetch } from '../../lib/supabaseApi';
import { Service } from '../../types/database';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isMasterWithinRange } from '../../utils/distance';

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

interface ActivityFeedItem {
    id: string;
    type: 'reschedule_request' | 'consultation_approved' | 'consultation_declined' | 'consultation_chat';
    title: string;
    description: string;
    timestamp: string;
    icon: string;
    iconColor: string;
    iconBg: string;
    route?: string;
}

export function ClientHomeScreen() {
    const navigation = useNavigation<any>();
    const { profile, user, checkSession } = useAuth();
    const { showAlert } = useModal();
    const { getItemCount } = useCart();
    const [refreshing, setRefreshing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [stampCardCount, setStampCardCount] = useState(0);
    const [nextAppointment, setNextAppointment] = useState<Appointment | null>(null);
    const [upcomingAppointments, setUpcomingAppointments] = useState<Appointment[]>([]);
    const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
    const [featuredMasters, setFeaturedMasters] = useState<FeaturedMaster[]>([]);
    const [availableServices, setAvailableServices] = useState<Service[]>([]);
    const [totalVisits, setTotalVisits] = useState(0);
    const [totalOrders, setTotalOrders] = useState(0);
    const [activityFeed, setActivityFeed] = useState<ActivityFeedItem[]>([]);

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
    const userState: string | null = (profile as any)?.state || null;
    const userStateCode: string | null = (profile as any)?.state_code || null;
    const userLat: number | null = (profile as any)?.latitude || null;
    const userLng: number | null = (profile as any)?.longitude || null;
    const searchRadiusKm: number = (profile as any)?.search_radius_km ?? 100;
    const [searchLoading, setSearchLoading] = useState(false);
    const [locationReady, setLocationReady] = useState(false);

    const fetchHomeData = async (loc?: { country: string | null; lat: number | null; lng: number | null }) => {
        if (!user) return;
        const isSessionValid = await checkSession();
        if (!isSessionValid) { setLoading(false); setRefreshing(false); return; }

        // Use passed-in location (fresh from detectUserLocation) over stale state.
        const effectiveCountry = loc?.country || profile?.country || userCountry;
        const userLoc = {
            country: effectiveCountry,
            state: userState,
            state_code: userStateCode,
            latitude: userLat,
            longitude: userLng,
        };

        try {
            const now = new Date().toISOString();
            const stampCardsPromise = (supabase as any).rpc("get_client_stamp_cards", { p_client_id: user.id });
            const appointmentsPromise = (supabase as any)
                .from('appointments')
                .select(`id, start_time, end_time, status, service_name, service:services (name, duration_minutes, base_price), master:profiles!appointments_master_id_fkey (full_name)`)
                .eq('client_id', user.id).in('status', ['confirmed', 'pending']).gte('start_time', now).order('start_time', { ascending: true }).limit(5);
            const visitsPromise = (supabase as any).from('appointments').select('*', { count: 'exact', head: true }).eq('client_id', user.id).eq('status', 'completed');
            const ordersPromise = (supabase as any).from('orders').select('id, total, status, created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(3);

            const [
                { data: stampCardsData },
                { data: appointments },
                { count: visitCount },
                { data: orders }
            ] = await Promise.all([
                safeSupabaseFetch(stampCardsPromise, { timeout: 5000, errorMessage: 'Failed to load loyalty data' }),
                safeSupabaseFetch(appointmentsPromise, { timeout: 8000 }),
                visitsPromise,
                safeSupabaseFetch(ordersPromise, { timeout: 5000 })
            ]);

            setStampCardCount(stampCardsData ? (stampCardsData as any).length : 0);
            setUpcomingAppointments((appointments as any) || []);
            setNextAppointment((appointments as any)?.[0] || null);
            setTotalVisits(visitCount || 0);
            setRecentOrders((orders as any) || []);

            // Fetch featured masters with their state/region info for filtering.
            // Exclude the logged-in user so owners/masters never see themselves in the client view.
            const mastersPromise = (supabase as any).from('profiles').select('id, full_name, avatar_url, bio, country, state, state_code, latitude, longitude').or('is_master.eq.true,role.eq.master,role.eq.owner').neq('id', user.id).limit(50);
            const { data: masters } = await safeSupabaseFetch(mastersPromise, { timeout: 5000 });

            // Filter masters: same state = pass, different state = haversine check.
            let filteredMasters = (masters as FeaturedMaster[]) || [];
            if (effectiveCountry) {
                filteredMasters = filteredMasters.filter(m => isMasterWithinRange(userLoc, m as any, searchRadiusKm));
            } else {
                // No country detected at all — show nothing rather than unfiltered data
                filteredMasters = [];
            }
            setFeaturedMasters(filteredMasters);

            // Fetch services with master country + state info for filtering
            const servicesPromise = (supabase as any)
                .from('services')
                .select('*, master_services!inner(is_available, master_id, master:profiles!master_services_master_id_fkey(country, state, state_code, latitude, longitude))')
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
                filteredServices = filteredServices.filter(service => {
                    const masterServices = service.master_services || [];
                    return masterServices.some((ms: any) => {
                        if (ms.master_id === user.id) return false; // Skip self
                        const masterProfile = ms.master;
                        if (!masterProfile) return false;
                        return isMasterWithinRange(userLoc, masterProfile, searchRadiusKm);
                    });
                });
            } else {
                // No country detected — show nothing rather than unfiltered data
                filteredServices = [];
            }
            setAvailableServices(filteredServices.slice(0, 6));

            // --- Activity Feed: Pending reschedules + consultation updates ---
            const feedItems: ActivityFeedItem[] = [];

            // 1. Pending reschedule proposals from masters
            const { data: rescheduleData } = await supabase
                .from('appointments')
                .select(`id, start_time, proposed_start_time, proposed_end_time, reschedule_initiated_by, service_name, service:services(name), master:profiles!appointments_master_id_fkey(full_name)`)
                .eq('client_id', user.id)
                .not('proposed_start_time', 'is', null)
                .neq('reschedule_initiated_by', user.id)
                .in('status', ['confirmed', 'pending', 'reschedule_pending', 'pending_reschedule']);

            (rescheduleData || []).forEach((apt: any) => {
                feedItems.push({
                    id: `reschedule-${apt.id}`,
                    type: 'reschedule_request',
                    title: 'Reschedule Request',
                    description: `${apt.master?.full_name || 'Master'} proposed a new time for ${apt.service?.name || apt.service_name || 'your appointment'}: ${format(new Date(apt.proposed_start_time), 'MMM d, HH:mm')}`,
                    timestamp: apt.proposed_start_time,
                    icon: 'swap-horiz',
                    iconColor: '#F59E0B',
                    iconBg: 'rgba(245, 158, 11, 0.12)',
                    route: 'Book',
                });
            });

            // 2. Consultation status changes (approved, declined, chat_requested)
            const { data: consultData } = await supabase
                .from('booking_consultations')
                .select(`id, status, created_at, responded_at, service:services(name), master:profiles!booking_consultations_master_id_fkey(full_name)`)
                .eq('client_id', user.id)
                .in('status', ['approved', 'declined', 'chat_requested']);

            (consultData || []).forEach((c: any) => {
                const ts = c.responded_at || c.created_at;
                if (c.status === 'approved') {
                    feedItems.push({
                        id: `consult-${c.id}`,
                        type: 'consultation_approved',
                        title: 'Consultation Approved',
                        description: `${c.master?.full_name || 'Master'} approved your consultation for ${c.service?.name || 'a service'}. You can now book!`,
                        timestamp: ts,
                        icon: 'check-circle',
                        iconColor: '#10B981',
                        iconBg: 'rgba(16, 185, 129, 0.12)',
                        route: 'Book',
                    });
                } else if (c.status === 'declined') {
                    feedItems.push({
                        id: `consult-${c.id}`,
                        type: 'consultation_declined',
                        title: 'Consultation Declined',
                        description: `${c.master?.full_name || 'Master'} declined your consultation for ${c.service?.name || 'a service'}.`,
                        timestamp: ts,
                        icon: 'cancel',
                        iconColor: '#EF4444',
                        iconBg: 'rgba(239, 68, 68, 0.12)',
                        route: 'Book',
                    });
                } else if (c.status === 'chat_requested') {
                    feedItems.push({
                        id: `consult-${c.id}`,
                        type: 'consultation_chat',
                        title: 'Chat Requested',
                        description: `${c.master?.full_name || 'Master'} wants to chat about your ${c.service?.name || 'service'} consultation.`,
                        timestamp: ts,
                        icon: 'chat',
                        iconColor: '#60A5FA',
                        iconBg: 'rgba(96, 165, 250, 0.12)',
                        route: 'Messages',
                    });
                }
            });

            // Sort by most recent first
            feedItems.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

            const lastClearedStr = await AsyncStorage.getItem('client_activity_cleared_at');
            const lastClearedTime = lastClearedStr ? new Date(lastClearedStr).getTime() : 0;
            const visibleFeed = feedItems.filter(item => new Date(item.timestamp).getTime() > lastClearedTime);

            setActivityFeed(visibleFeed);
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
                // Return the GPS-resolved location for optional re-fetch.
                // Lat/lng are returned for backward compat with fetchHomeData's
                // signature but no longer used for filtering.
                return {
                    country: address?.country || profile?.country || null,
                    lat: location.coords.latitude,
                    lng: location.coords.longitude,
                };
            }
        } catch (error) {
            // Location detection failed silently
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

    const handleClearActivity = async () => {
        try {
            await AsyncStorage.setItem('client_activity_cleared_at', new Date().toISOString());
            setActivityFeed([]);
        } catch (e) {
            console.log('Error clearing activity', e);
            showAlert('Error', 'Failed to clear activity. Please try again.', 'error');
        }
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

    // Category gradient palettes for service banner cards
    const getCategoryGradient = (category: string | null): [string, string] => {
        switch (category) {
            case 'Nails': return ['#FADADD', '#F8C8D4'];
            case 'Lashes': return ['#E8D5FF', '#D4B8F0'];
            case 'Brows': return ['#FFF3D6', '#F5E0A0'];
            case 'Hair': return ['#D4F0E7', '#B8E6D4'];
            default: return ['#F0F0F0', '#E5E5E5'];
        }
    };

    const getCategoryIconColor = (category: string | null): string => {
        switch (category) {
            case 'Nails': return '#9B4D6A';
            case 'Lashes': return '#6B3FA0';
            case 'Brows': return '#9B7A1C';
            case 'Hair': return '#2D7A5A';
            default: return '#555555';
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
                                <MaterialIcons name="qr-code-scanner" size={20} color="rgba(0, 0, 0, 0.55)" />
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('NFCScanner')}>
                                <MaterialIcons name="nfc" size={20} color="rgba(0, 0, 0, 0.55)" />
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('Notifications')}>
                                <MaterialIcons name="notifications-none" size={22} color="rgba(0, 0, 0, 0.55)" />
                            </TouchableOpacity>
                            {cartCount > 0 && (
                                <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('Shop', { screen: 'Cart' })}>
                                    <MaterialIcons name="shopping-bag" size={20} color="rgba(0, 0, 0, 0.55)" />
                                    <View style={styles.badge}><Text style={styles.badgeText}>{cartCount}</Text></View>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>

                    {/* Search Bar - Inline */}
                    <View style={styles.searchBar}>
                        <MaterialIcons name="search" size={20} color="rgba(0, 0, 0, 0.25)" />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search masters, services..."
                            placeholderTextColor="rgba(0, 0, 0, 0.25)"
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
                                <MaterialIcons name="tune" size={18} color="rgba(0, 0, 0, 0.40)" />
                            </View>
                        )}
                    </View>

                    {/* Search Results Overlay */}
                    {isSearching ? (
                        <View style={{ paddingBottom: 100 }}>
                            {searchResults.length === 0 && serviceResults.length === 0 && courseResults.length === 0 ? (
                                <View style={{ alignItems: 'center', marginTop: 40 }}>
                                    <MaterialIcons name="search-off" size={48} color="rgba(0, 0, 0, 0.12)" />
                                    <MerakiText style={{ color: 'rgba(0, 0, 0, 0.40)', marginTop: 16 }}>No results found for "{searchQuery}"</MerakiText>
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
                                                        <MaterialIcons name="chevron-right" size={20} color="rgba(0, 0, 0, 0.25)" />
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
                                                        <MaterialIcons name="chevron-right" size={20} color="rgba(0, 0, 0, 0.25)" />
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
                                                        <MaterialIcons name="chevron-right" size={20} color="rgba(0, 0, 0, 0.25)" />
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
                                    <MaterialIcons name="chevron-right" size={20} color="rgba(0, 0, 0, 0.25)" />
                                </TouchableOpacity>
                            )}

                            {/* Hero Banner — Beauty Bay Inspired with Image */}
                            <TouchableOpacity
                                style={styles.heroBanner}
                                activeOpacity={0.9}
                                onPress={() => navigation.navigate('Shop')}
                            >
                                <View style={styles.heroBannerGradient}>
                                    <Image
                                        source={require('../../assets/hero_beauty_banner.png')}
                                        style={StyleSheet.absoluteFillObject}
                                        resizeMode="cover"
                                    />
                                    <LinearGradient
                                        colors={['rgba(0,0,0,0.05)', 'rgba(0,0,0,0.45)', 'rgba(0,0,0,0.7)']}
                                        style={StyleSheet.absoluteFillObject}
                                    />
                                    <View style={styles.heroContent}>
                                        <MerakiText style={[styles.heroTagline, { color: '#FFFFFF' }]}>
                                            WE'RE OBSESSED{'\n'}WITH YOU
                                        </MerakiText>
                                        <MerakiText style={[styles.heroSubtext, { color: 'rgba(255,255,255,0.8)' }]}>
                                            Discover the skincare, lash, and{'\n'}beauty products curated for you
                                        </MerakiText>
                                        <View style={[styles.heroButton, { backgroundColor: '#FFFFFF' }]}>
                                            <MerakiText style={[styles.heroButtonText, { color: '#1A1A1A' }]}>Shop Now</MerakiText>
                                        </View>
                                    </View>
                                </View>
                            </TouchableOpacity>

                            {/* Editorial Cards Row */}
                            <View style={styles.editorialRow}>
                                <TouchableOpacity
                                    style={styles.editorialCard}
                                    activeOpacity={0.85}
                                    onPress={() => navigation.navigate('Shop')}
                                >
                                    <View style={styles.editorialGradient}>
                                        <Image
                                            source={require('../../assets/editorial_new_arrivals.png')}
                                            style={StyleSheet.absoluteFillObject}
                                            resizeMode="cover"
                                        />
                                        <LinearGradient
                                            colors={['rgba(255,255,255,0.95)', 'rgba(255,255,255,0.6)', 'rgba(255,255,255,0.05)']}
                                            style={StyleSheet.absoluteFillObject}
                                        />
                                        <MerakiText style={styles.editorialLabel}>NEW ARRIVALS</MerakiText>
                                        <MerakiText style={styles.editorialTitle}>Fresh Drops</MerakiText>
                                        <MerakiText style={styles.editorialCta}>SHOP NOW →</MerakiText>
                                    </View>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.editorialCard}
                                    activeOpacity={0.85}
                                    onPress={() => navigation.navigate('Academy')}
                                >
                                    <View style={styles.editorialGradient}>
                                        <Image
                                            source={require('../../assets/editorial_academy.png')}
                                            style={StyleSheet.absoluteFillObject}
                                            resizeMode="cover"
                                        />
                                        <LinearGradient
                                            colors={['rgba(255,255,255,0.95)', 'rgba(255,255,255,0.6)', 'rgba(255,255,255,0.05)']}
                                            style={StyleSheet.absoluteFillObject}
                                        />
                                        <MerakiText style={styles.editorialLabel}>ACADEMY</MerakiText>
                                        <MerakiText style={styles.editorialTitle}>Learn & Grow</MerakiText>
                                        <MerakiText style={styles.editorialCta}>EXPLORE →</MerakiText>
                                    </View>
                                </TouchableOpacity>
                            </View>

                            {/* Activity Feed */}
                            {activityFeed.length > 0 && (
                                <View style={styles.section}>
                                    <View style={styles.sectionHeader}>
                                        <MerakiText style={styles.sectionTitle}>Activity</MerakiText>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                                            <TouchableOpacity onPress={handleClearActivity}>
                                                <MerakiText style={styles.seeAll}>Clear All</MerakiText>
                                            </TouchableOpacity>
                                            <TouchableOpacity onPress={() => navigation.navigate('Book')}>
                                                <MerakiText style={styles.seeAll}>View All</MerakiText>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                    {activityFeed.slice(0, 5).map((item) => (
                                        <TouchableOpacity
                                            key={item.id}
                                            style={styles.feedCard}
                                            onPress={() => item.route && navigation.navigate(item.route)}
                                            activeOpacity={0.7}
                                        >
                                            <View style={[styles.feedIconWrap, { backgroundColor: item.iconBg }]}>
                                                <MaterialIcons name={item.icon as any} size={20} color={item.iconColor} />
                                            </View>
                                            <View style={{ flex: 1, marginLeft: 12 }}>
                                                <MerakiText style={styles.feedTitle}>{item.title}</MerakiText>
                                                <MerakiText style={styles.feedDescription} numberOfLines={2}>{item.description}</MerakiText>
                                            </View>
                                            <MaterialIcons name="chevron-right" size={18} color="rgba(0, 0, 0, 0.12)" />
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            )}

                            {/* Quick Actions — Each with unique design */}
                            <View style={styles.quickActions}>
                                <TouchableOpacity
                                    style={styles.quickAction}
                                    onPress={() => navigation.navigate('Book')}
                                    activeOpacity={0.85}
                                >
                                    <LinearGradient
                                        colors={['#FADADD', '#F8C8D4']}
                                        style={styles.quickActionIcon}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 1 }}
                                    >
                                        <MaterialIcons name="calendar-today" size={22} color="#9B4D6A" />
                                    </LinearGradient>
                                    <MerakiText style={styles.quickActionLabel}>Book</MerakiText>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.quickAction}
                                    onPress={() => navigation.navigate('DiscoverMasters')}
                                    activeOpacity={0.85}
                                >
                                    <LinearGradient
                                        colors={['#E8D5FF', '#D4B8F0']}
                                        style={styles.quickActionIcon}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 1 }}
                                    >
                                        <MaterialIcons name="explore" size={22} color="#6B3FA0" />
                                    </LinearGradient>
                                    <MerakiText style={styles.quickActionLabel}>Discover</MerakiText>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.quickAction}
                                    onPress={() => navigation.navigate('StampCards')}
                                    activeOpacity={0.85}
                                >
                                    <LinearGradient
                                        colors={['#FFF3D6', '#F5E0A0']}
                                        style={styles.quickActionIcon}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 1 }}
                                    >
                                        <MaterialIcons name="star" size={22} color="#9B7A1C" />
                                    </LinearGradient>
                                    <MerakiText style={styles.quickActionLabel}>Loyalty</MerakiText>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.quickAction}
                                    onPress={() => navigation.navigate('Shop')}
                                    activeOpacity={0.85}
                                >
                                    <LinearGradient
                                        colors={['#D4F0E7', '#B8E6D4']}
                                        style={styles.quickActionIcon}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 1 }}
                                    >
                                        <MaterialIcons name="local-mall" size={22} color="#2D7A5A" />
                                    </LinearGradient>
                                    <MerakiText style={styles.quickActionLabel}>Shop</MerakiText>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.quickAction}
                                    onPress={() => navigation.navigate('Academy')}
                                    activeOpacity={0.85}
                                >
                                    <LinearGradient
                                        colors={['#D0E8FF', '#A0CFFF']}
                                        style={styles.quickActionIcon}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 1 }}
                                    >
                                        <MaterialIcons name="school" size={22} color="#1E65A0" />
                                    </LinearGradient>
                                    <MerakiText style={styles.quickActionLabel}>Academy</MerakiText>
                                </TouchableOpacity>
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
                                    <MaterialIcons name="chevron-right" size={20} color="rgba(0, 0, 0, 0.25)" />
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

                            {/* Services — Academy-style gradient banners */}
                            <View style={styles.section}>
                                <View style={styles.sectionHeader}>
                                    <MerakiText style={styles.sectionTitle}>Services</MerakiText>
                                    <TouchableOpacity onPress={() => navigation.navigate('DiscoverMasters')}>
                                        <MerakiText style={styles.seeAll}>See All</MerakiText>
                                    </TouchableOpacity>
                                </View>
                                <View style={styles.servicesGrid}>
                                    {loading || !locationReady ? null : availableServices.length > 0 ? (
                                        availableServices.map((service) => {
                                            const gradient = getCategoryGradient(service.category);
                                            const iconColor = getCategoryIconColor(service.category);
                                            return (
                                                <TouchableOpacity
                                                    key={service.id}
                                                    style={styles.serviceCardWrapper}
                                                    onPress={() => navigation.navigate('ServiceDetail', { serviceId: service.id })}
                                                    activeOpacity={0.85}
                                                >
                                                    <View style={styles.serviceCard}>
                                                        {/* Blurred background image (when available) */}
                                                        {(service as any).image_url && (
                                                            <Image
                                                                source={{ uri: (service as any).image_url }}
                                                                style={StyleSheet.absoluteFillObject}
                                                                resizeMode="cover"
                                                                blurRadius={20}
                                                            />
                                                        )}

                                                        {/* Gradient overlay */}
                                                        <LinearGradient
                                                            colors={
                                                                (service as any).image_url
                                                                    ? ['rgba(255,255,255,0.88)', 'rgba(255,255,255,0.65)', 'rgba(255,255,255,0.3)']
                                                                    : gradient
                                                            }
                                                            start={{ x: 0, y: 0 }}
                                                            end={{ x: 1, y: 0 }}
                                                            style={StyleSheet.absoluteFillObject}
                                                        />

                                                        <View style={styles.serviceTextContent}>
                                                            <MerakiText style={styles.serviceLabel} numberOfLines={1}>
                                                                {service.name.toUpperCase()}
                                                            </MerakiText>
                                                            <MerakiText style={styles.servicePrice}>
                                                                from €{service.base_price?.toFixed(0) || '...'}
                                                            </MerakiText>
                                                        </View>

                                                        {/* Sharp thumbnail on right or fallback icon */}
                                                        {(service as any).image_url ? (
                                                            <Image
                                                                source={{ uri: (service as any).image_url }}
                                                                style={styles.serviceImageThumb}
                                                                resizeMode="cover"
                                                            />
                                                        ) : (
                                                            <View style={[styles.serviceIconBlock, { backgroundColor: `${iconColor}15` }]}>
                                                                <MaterialIcons name={getServiceIcon(service.category) as any} size={24} color={iconColor} />
                                                            </View>
                                                        )}
                                                    </View>
                                                </TouchableOpacity>
                                            );
                                        })
                                    ) : (
                                        <MerakiText style={{ color: 'rgba(0, 0, 0, 0.40)', marginLeft: 4 }}>No services available at the moment.</MerakiText>
                                    )}
                                </View>
                            </View>

                            {/* Stats */}
                            <View style={styles.statsRow}>
                                <TouchableOpacity style={styles.statCard} onPress={() => navigation.navigate('StampCards')}>
                                    <MerakiText style={styles.statValue}>{loading ? '...' : stampCardCount}</MerakiText>
                                    <MerakiText style={styles.statLabel}>Stamp Cards</MerakiText>
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
    greeting: { fontSize: 13, color: 'rgba(0, 0, 0, 0.35)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 2 },
    userName: { fontSize: 28, fontWeight: '700', color: '#1A1A1A', letterSpacing: -0.5 },
    headerIcons: { flexDirection: 'row', gap: 8 },
    iconBtn: {
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: 'rgba(0, 0, 0, 0.03)',
        borderWidth: 1, borderColor: 'rgba(0, 0, 0, 0.06)',
        alignItems: 'center', justifyContent: 'center',
    },
    badge: {
        position: 'absolute', top: -2, right: -2,
        backgroundColor: colors.primary, borderRadius: 8, minWidth: 16, height: 16,
        alignItems: 'center', justifyContent: 'center',
    },
    badgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700', textAlign: 'center', includeFontPadding: false, textAlignVertical: 'center', lineHeight: 12 },

    // Search
    searchBar: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.03)', borderRadius: 9999,
        borderWidth: 1, borderColor: 'rgba(0, 0, 0, 0.06)',
        paddingHorizontal: 20, paddingVertical: 14, marginBottom: 24, gap: 12,
    },

    searchInput: { flex: 1, fontSize: 14, color: '#1A1A1A', paddingVertical: 4 },
    searchFilter: {
        width: 32, height: 32, borderRadius: 16,
        backgroundColor: 'rgba(0, 0, 0, 0.05)',
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
    alertSubtitle: { fontSize: 12, color: 'rgba(0, 0, 0, 0.40)', marginTop: 2 },

    // Quick Actions
    quickActions: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 28 },
    quickAction: { alignItems: 'center', gap: 8 },
    quickActionIcon: {
        width: 58, height: 58, borderRadius: 16,
        alignItems: 'center', justifyContent: 'center',
    },
    quickActionLabel: { fontSize: 11, color: 'rgba(0, 0, 0, 0.50)', fontWeight: '600' },

    // Appointment Card
    appointmentCard: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.03)', borderRadius: 16,
        borderWidth: 1, borderColor: 'rgba(0, 0, 0, 0.06)',
        padding: 16, marginBottom: 28, gap: 14,
    },
    appointmentIconWrap: {
        width: 48, height: 48, borderRadius: 14,
        backgroundColor: 'rgba(200, 160, 77, 0.1)',
        alignItems: 'center', justifyContent: 'center',
    },
    appointmentTitle: { fontSize: 15, fontWeight: '600', color: '#1A1A1A' },
    appointmentMeta: { fontSize: 12, color: 'rgba(0, 0, 0, 0.35)', marginTop: 2 },

    // Section
    section: { marginBottom: 28 },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    sectionTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A1A' },
    seeAll: { fontSize: 13, color: colors.primary, fontWeight: '600' },

    // Featured Masters
    masterCard: {
        width: 120, marginRight: 12,
        backgroundColor: 'rgba(0, 0, 0, 0.03)', borderRadius: 16,
        borderWidth: 1, borderColor: 'rgba(0, 0, 0, 0.06)',
        padding: 16, alignItems: 'center',
    },
    masterAvatar: {
        width: 64, height: 64, borderRadius: 32,
        marginBottom: 10, alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
    },
    masterInitial: { color: '#fff', fontSize: 22, fontWeight: '700' },
    masterName: { fontSize: 13, fontWeight: '600', color: '#1A1A1A', textAlign: 'center' },
    masterBio: { fontSize: 11, color: 'rgba(0, 0, 0, 0.35)', textAlign: 'center', marginTop: 2 },

    // Services Grid — Academy-style gradient banners
    servicesGrid: { gap: 10 },
    serviceCardWrapper: {
        borderRadius: 10,
        overflow: 'hidden',
    },
    serviceCard: {
        flexDirection: 'row',
        alignItems: 'stretch',
        minHeight: 80,
    },
    serviceTextContent: {
        flex: 1,
        paddingVertical: 14,
        paddingLeft: 20,
        paddingRight: 12,
        justifyContent: 'center',
    },
    serviceLabel: { fontSize: 14, fontWeight: '700', color: '#1A1A1A', letterSpacing: 0.3 },
    servicePrice: { fontSize: 11, color: 'rgba(0, 0, 0, 0.40)', fontWeight: '500', marginTop: 4 },
    serviceIconBlock: {
        width: 70,
        minHeight: 80,
        alignItems: 'center',
        justifyContent: 'center',
    },
    serviceImageThumb: {
        width: 100,
        minHeight: 80,
    },

    // Stats
    statsRow: { flexDirection: 'row', gap: 10, marginBottom: 28 },
    statCard: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.03)', borderRadius: 16,
        borderWidth: 1, borderColor: 'rgba(0, 0, 0, 0.06)',
        padding: 16, alignItems: 'center',
    },
    statValue: { fontSize: 22, fontWeight: '700', color: '#1A1A1A' },
    statLabel: { fontSize: 11, color: 'rgba(0, 0, 0, 0.35)', marginTop: 4 },

    // Orders
    orderRow: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.02)', borderRadius: 14,
        borderWidth: 1, borderColor: 'rgba(0, 0, 0, 0.05)',
        padding: 14, marginBottom: 8, gap: 12,
    },
    orderIconWrap: {
        width: 40, height: 40, borderRadius: 12,
        backgroundColor: 'rgba(200, 160, 77, 0.1)',
        alignItems: 'center', justifyContent: 'center',
    },
    orderTitle: { fontSize: 14, fontWeight: '600', color: '#1A1A1A' },
    orderDate: { fontSize: 12, color: 'rgba(0, 0, 0, 0.25)', marginTop: 2 },
    orderTotal: { fontSize: 14, fontWeight: '700', color: '#1A1A1A' },
    statusBadge: {
        paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6,
        backgroundColor: 'rgba(0, 0, 0, 0.06)', marginTop: 4,
    },
    statusDelivered: { backgroundColor: 'rgba(34,197,94,0.15)' },
    statusText: { fontSize: 10, color: 'rgba(0, 0, 0, 0.40)', textTransform: 'capitalize', fontWeight: '600' },


    // Activity Feed
    feedCard: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.03)', borderRadius: 14,
        borderWidth: 1, borderColor: 'rgba(0, 0, 0, 0.06)',
        padding: 14, marginBottom: 8, gap: 0,
    },
    feedIconWrap: {
        width: 40, height: 40, borderRadius: 12,
        alignItems: 'center', justifyContent: 'center',
    },
    feedTitle: { fontSize: 14, fontWeight: '600', color: '#1A1A1A' },
    feedDescription: { fontSize: 12, color: 'rgba(0, 0, 0, 0.35)', marginTop: 2, lineHeight: 16 },

    // Search Results
    masterCardFull: {
        backgroundColor: 'rgba(0, 0, 0, 0.03)', borderRadius: 16,
        borderWidth: 1, borderColor: 'rgba(0, 0, 0, 0.06)',
        padding: 16, marginBottom: 12,
    },
    masterRow: { flexDirection: 'row', alignItems: 'center' },
    masterAvatarSmall: {
        width: 48, height: 48, borderRadius: 24,
        alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
    },
    masterInitialSmall: { color: '#fff', fontSize: 18, fontWeight: '700' },

    // Hero Banner
    heroBanner: {
        borderRadius: 12,
        overflow: 'hidden',
        marginBottom: 16,
    },
    heroBannerGradient: {
        paddingHorizontal: 24,
        paddingVertical: 32,
        minHeight: 180,
        justifyContent: 'center',
    },
    heroContent: {},
    heroTagline: {
        fontSize: 26,
        fontWeight: '800',
        color: '#1A1A1A',
        letterSpacing: -0.5,
        lineHeight: 32,
        marginBottom: 8,
    },
    heroSubtext: {
        fontSize: 13,
        color: 'rgba(26, 26, 26, 0.55)',
        lineHeight: 18,
        marginBottom: 16,
    },
    heroButton: {
        backgroundColor: '#1A1A1A',
        alignSelf: 'flex-start',
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 6,
    },
    heroButtonText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#FFFFFF',
        letterSpacing: 0.5,
    },

    // Editorial Cards Row
    editorialRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 20,
    },
    editorialCard: {
        flex: 1,
        borderRadius: 12,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.08)',
        backgroundColor: '#FFFFFF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 4,
    },
    editorialGradient: {
        paddingHorizontal: 18,
        paddingVertical: 20,
        minHeight: 140,
        justifyContent: 'flex-end',
    },
    editorialLabel: {
        fontSize: 9,
        fontWeight: '700',
        color: 'rgba(26, 26, 26, 0.4)',
        letterSpacing: 1.5,
        marginBottom: 4,
    },
    editorialTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#1A1A1A',
        marginBottom: 8,
    },
    editorialCta: {
        fontSize: 11,
        fontWeight: '700',
        color: '#1A1A1A',
        letterSpacing: 0.5,
    },
});

export default ClientHomeScreen;
