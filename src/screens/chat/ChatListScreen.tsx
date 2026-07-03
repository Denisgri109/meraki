import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    Image,
    RefreshControl,
    ScrollView,
    TextInput,
    Keyboard,
    TouchableWithoutFeedback,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect, CommonActions } from '@react-navigation/native';
import { formatDistanceToNow } from 'date-fns';
import { LinearGradient } from 'expo-linear-gradient';
import { safeSupabaseFetch } from '../../lib/supabaseApi';
import * as Location from 'expo-location';

import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Card, ScreenBackground, MerakiText } from '../../components/ui';
import { colors, spacing } from '../../theme';

interface Master {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    bio?: string | null;
    city?: string | null;
    country?: string | null;
}

interface Conversation {
    id: string;
    last_message_at: string;
    client_id: string;
    master_id: string;
    other_user: {
        full_name: string | null;
        avatar_url: string | null;
        id?: string;
    } | null;
    last_message: {
        content: string | null;
        media_type: string | null;
        is_deleted?: boolean;
    } | null;
}

export function ChatListScreen() {
    const navigation = useNavigation<any>();
    const { user, profile, checkSession } = useAuth();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [masters, setMasters] = useState<Master[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [userLocation, setUserLocation] = useState<{ city: string | null; country: string | null }>({ city: null, country: null });

    const isMaster = profile?.is_master || profile?.role === 'master' || profile?.role === 'owner';

    useFocusEffect(
        React.useCallback(() => {
            detectLocation();
            fetchData();
        }, [user?.id])
    );

    const detectLocation = async () => {
        try {
            const servicesEnabled = await Location.hasServicesEnabledAsync();
            if (!servicesEnabled) {
                return;
            }

            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status === 'granted') {
                const location = await Location.getCurrentPositionAsync({
                    accuracy: Location.Accuracy.Balanced,
                });

                // Guard against reverseGeocodeAsync crashing on some Android devices
                // when lat/lng produce a null country code
                try {
                    const results = await Location.reverseGeocodeAsync({
                        latitude: location.coords.latitude,
                        longitude: location.coords.longitude,
                    });
                    const address = results?.[0];
                    if (address) {
                        setUserLocation({
                            city: address.city || null,
                            country: address.country || null,
                        });
                    }
                } catch (geocodeError) {
                    // reverseGeocodeAsync can throw NullPointerException on some devices
                    // when getCountryCode() returns null — safe to ignore
                    console.log('Reverse geocode failed (non-critical):', geocodeError);
                }
            }
        } catch (error) {
            // Failed silently
        }
    };

    useEffect(() => {
        // Debounced search effect
        const timer = setTimeout(async () => {
            if (searchQuery.trim().length > 0) {
                setIsSearching(true);
                try {
                    let query = supabase
                        .from('profiles')
                        .select('id, full_name, avatar_url, role')
                        .ilike('full_name', `%${searchQuery}%`)
                        .neq('id', user?.id || '')
                        .limit(20);

                    // If user is client, filter for masters/owners
                    if (!isMaster) {
                        query = query.in('role', ['master', 'owner']);
                        if (userLocation.country) {
                            query = query.eq('country', userLocation.country);
                        }
                    }
                    // If user is master, filter for clients (optional, depending on requirements)
                    // Existing logic was broad, but let's keep it broad for masters for now or filter for clients if preferred

                    const { data, error } = await query;

                    if (error) throw error;
                    setSearchResults(data || []);
                } catch (err) {
                    console.error('Search error:', err);
                } finally {
                    setIsSearching(false);
                }
            } else {
                setSearchResults([]);
                setIsSearching(false);
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [searchQuery, isMaster, user?.id, userLocation.country]);

    const fetchData = async () => {
        if (!user?.id) {
            setLoading(false);
            return;
        }

        // Validate session before attempting fetch
        const isSessionValid = await checkSession();
        if (!isSessionValid) {
            setLoading(false);
            setRefreshing(false);
            return;
        }

        try {
            // Fetch all masters for the top section (only for clients)
            if (!isMaster) {
                const mastersPromise = supabase
                    .from('profiles')
                    .select('id, full_name, avatar_url, bio, city, country')
                    .or('is_master.eq.true,role.eq.owner')
                    .order('full_name');

                const { data: mastersData } = await safeSupabaseFetch(mastersPromise as any, { timeout: 5000 });
                setMasters((mastersData as Master[]) || []);
            }

            // Fetch conversations
            const field = isMaster ? 'master_id' : 'client_id';
            const convPromise = (supabase as any)
                .from('conversations')
                .select('*, messages(content, media_type, is_deleted, created_at)')
                .eq(field, user.id)
                .order('last_message_at', { ascending: false })
                .order('created_at', { referencedTable: 'messages', ascending: false })
                .limit(1, { referencedTable: 'messages' });

            const { data: convData, error: convError } = await safeSupabaseFetch(convPromise as any, {
                timeout: 8000,
                errorMessage: 'Failed to load conversations'
            });

            if (convError) {
                console.error('Conversations fetch error:', convError.message);
                setConversations([]);
                return;
            }

            let allConversations = convData || [];

            // Fetch other user details and last message for all conversations
            // N+1 Optimization: Collect unique user IDs and fetch them in one query
            const userIds = Array.from(new Set((allConversations as any[]).map(conv => isMaster ? conv.client_id : conv.master_id)));

            let userMap: Record<string, any> = {};
            if (userIds.length > 0) {
                const { data: usersData, error: usersError } = await supabase
                    .from('profiles')
                    .select('id, full_name, avatar_url')
                    .in('id', userIds);

                if (!usersError && usersData) {
                    userMap = usersData.reduce((acc, user) => {
                        acc[user.id] = { full_name: user.full_name, avatar_url: user.avatar_url };
                        return acc;
                    }, {} as Record<string, any>);
                } else if (usersError) {
                    console.error('Error fetching users batch:', usersError);
                }
            }

            const convWithUsers = (allConversations as any[]).map((conv: any) => {
                const otherUserId = isMaster ? conv.client_id : conv.master_id;
                const userData = userMap[otherUserId] || null;

                // Extract last message from the joined messages array
                const lastMsgData = conv.messages && conv.messages.length > 0
                    ? conv.messages[0]
                    : null;

                const { messages, ...restConv } = conv;

                return {
                    ...restConv,
                    other_user: userData,
                    last_message: lastMsgData,
                };
            });

            setConversations(convWithUsers);
        } catch (error) {
            console.error('Error fetching data:', error);
            setConversations([]);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchData();
    };

    const startOrOpenConversation = async (targetUserId: string, targetUserName: string | null, targetUserAvatarUrl: string | null) => {
        if (!user?.id) return;

        try {
            const field1 = isMaster ? 'master_id' : 'client_id';
            const field2 = isMaster ? 'client_id' : 'master_id';

            // Check if conversation exists
            const { data: existing } = await (supabase as any)
                .from('conversations')
                .select('id')
                .eq(field1, user.id)
                .eq(field2, targetUserId)
                .single();

            let conversationId = existing?.id;

            // Create if not exists
            if (!conversationId) {
                const insertData = isMaster
                    ? { master_id: user.id, client_id: targetUserId }
                    : { client_id: user.id, master_id: targetUserId };

                const { data: newConv, error } = await (supabase as any)
                    .from('conversations')
                    .insert(insertData)
                    .select()
                    .single();

                if (error) throw error;
                conversationId = newConv.id;
            }

            // Clear search context if any
            setSearchQuery('');
            setSearchResults([]);

            navigation.dispatch(
                CommonActions.navigate({
                    name: 'Chat',
                    params: {
                        conversationId,
                        otherUser: {
                            full_name: targetUserName,
                            avatar_url: targetUserAvatarUrl,
                            id: targetUserId
                        },
                    },
                })
            );
        } catch (error: any) {
            console.error('Error starting conversation:', error);
        }
    };

    const renderMaster = (master: Master) => (
        <TouchableOpacity
            key={master.id}
            style={styles.masterItem}
            onPress={() => startOrOpenConversation(master.id, master.full_name, master.avatar_url)}
        >
            <View style={styles.masterAvatarContainer}>
                {master.avatar_url ? (
                    <Image source={{ uri: master.avatar_url }} style={styles.masterAvatarImage} />
                ) : (
                    <View style={styles.masterAvatarPlaceholder}>
                        <MerakiText style={styles.masterAvatarText}>
                            {master.full_name?.[0] || 'M'}
                        </MerakiText>
                    </View>
                )}
                {/* Online Indicator Dot (Optional/Mock) */}
                <View style={styles.onlineIndicator} />
            </View>
            <MerakiText style={styles.masterName} numberOfLines={1} variant="caption">
                {master.full_name?.split(' ')[0] || 'Master'}
            </MerakiText>
        </TouchableOpacity>
    );

    const renderConversation = ({ item }: { item: Conversation }) => (
        <TouchableOpacity
            onPress={() => navigation.dispatch(
                CommonActions.navigate({
                    name: 'Chat',
                    params: {
                        conversationId: item.id,
                        otherUser: item.other_user,
                    },
                })
            )}
            activeOpacity={0.7}
        >
            <Card style={styles.conversationCard} variant="glass" noPadding>
                <View style={styles.conversationContent}>
                    {item.other_user?.avatar_url ? (
                        <Image source={{ uri: item.other_user.avatar_url }} style={styles.conversationAvatarImage} />
                    ) : (
                        <View style={styles.conversationAvatarPlaceholder}>
                            <MerakiText style={styles.conversationAvatarText}>
                                {item.other_user?.full_name?.[0] || '?'}
                            </MerakiText>
                        </View>
                    )}

                    <View style={styles.conversationInfo}>
                        <View style={styles.conversationHeader}>
                            <MerakiText style={styles.conversationName} variant="bodyBold">
                                {item.other_user?.full_name || 'Unknown'}
                            </MerakiText>
                            <MerakiText style={styles.timestamp} variant="caption">
                                {formatDistanceToNow(new Date(item.last_message_at), { addSuffix: false })}
                            </MerakiText>
                        </View>

                        <MerakiText style={styles.lastMessage} numberOfLines={1} variant="body">
                            {item.last_message?.is_deleted
                                ? 'Message deleted'
                                : item.last_message?.media_type
                                    ? `📷 ${item.last_message.media_type === 'image' ? 'Photo' : 'Video'}`
                                    : item.last_message?.content || 'Start a conversation...'}
                        </MerakiText>
                    </View>
                </View>
            </Card>
        </TouchableOpacity>
    );

    const renderSearchResult = ({ item }: { item: any }) => (
        <TouchableOpacity
            onPress={() => startOrOpenConversation(item.id, item.full_name, item.avatar_url)}
        >
            <Card style={styles.conversationCard} variant="glass" noPadding>
                <View style={styles.conversationContent}>
                    {item.avatar_url ? (
                        <Image source={{ uri: item.avatar_url }} style={styles.conversationAvatarImage} />
                    ) : (
                        <View style={styles.conversationAvatarPlaceholder}>
                            <MerakiText style={styles.conversationAvatarText}>
                                {item.full_name?.[0] || '?'}
                            </MerakiText>
                        </View>
                    )}
                    <View style={styles.conversationInfo}>
                        <MerakiText style={styles.conversationName} variant="bodyBold">
                            {item.full_name || 'Unknown'}
                        </MerakiText>
                        <MerakiText style={styles.lastMessage} numberOfLines={1}>
                            {item.role === 'client' ? 'Client' : 'Master'}
                        </MerakiText>
                    </View>
                </View>
            </Card>
        </TouchableOpacity>
    );

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

    return (
        <ScreenBackground>
            <SafeAreaView style={styles.container} edges={['top']}>
                {/* Search Header */}
                <View style={styles.headerContainer}>
                    <MerakiText variant="h2" style={styles.pageTitle}>Messages</MerakiText>

                    <View style={styles.searchContainer}>
                        <View style={styles.searchBar}>
                            <MerakiText style={styles.searchIcon}>🔍</MerakiText>
                            <TextInput
                                style={styles.searchInput}
                                placeholder={isMaster ? "Search clients..." : userLocation.country ? `Search masters in ${userLocation.country}...` : "Search masters near you..."}
                                placeholderTextColor="rgba(0, 0, 0, 0.30)"
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                autoCapitalize="none"
                            />
                            {searchQuery.length > 0 && (
                                <TouchableOpacity onPress={() => setSearchQuery('')}>
                                    <MerakiText style={styles.clearIcon}>✕</MerakiText>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                </View>

                {/* Search Results Overlay */}
                {searchQuery.length > 0 ? (
                    <View style={styles.searchResultsContainer}>
                        <MerakiText style={styles.sectionTitle} variant="label">
                            {isMaster ? 'Search Results' : userLocation.country ? `Results in ${userLocation.country}` : 'Search Results'}
                        </MerakiText>
                        {isSearching ? (
                            <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 20 }} />
                        ) : searchResults.length > 0 ? (
                            <FlatList
                                data={searchResults}
                                keyExtractor={(item) => item.id}
                                renderItem={renderSearchResult}
                                contentContainerStyle={styles.listContent}
                                keyboardShouldPersistTaps="handled"
                            />
                        ) : (
                            <View style={styles.emptyContainer}>
                                <MerakiText style={styles.emptyText}>
                                    {isMaster ? 'No clients found' : 'No masters found'}
                                </MerakiText>
                            </View>
                        )}
                    </View>
                ) : (
                    <>
                        <ScrollView
                            style={{ flex: 1 }}
                            contentContainerStyle={{ paddingBottom: 100 }}
                            refreshControl={
                                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
                            }
                            showsVerticalScrollIndicator={false}
                        >
                            {/* Masters Section (only for clients) */}
                            {!isMaster && masters.length > 0 && (
                                <View style={styles.mastersSection}>
                                    <View style={styles.mastersHeader}>
                                        <MerakiText style={styles.mastersTitle} variant="label">
                                            {userLocation.country ? `Masters in ${userLocation.country}` : 'Recommended Masters'}
                                        </MerakiText>
                                    </View>
                                    <ScrollView
                                        horizontal
                                        showsHorizontalScrollIndicator={false}
                                        contentContainerStyle={styles.mastersScroll}
                                    >
                                        {masters
                                            .filter(m => !userLocation.country || m.country === userLocation.country)
                                            .map(renderMaster)}
                                    </ScrollView>
                                </View>
                            )}

                            {/* Conversations Section */}
                            <View style={styles.conversationsSection}>
                                <MerakiText style={styles.sectionTitle} variant="label">Conversations</MerakiText>

                                {conversations.length > 0 ? (
                                    <View style={styles.conversationsList}>
                                        {conversations.map(item => (
                                            <View key={item.id}>
                                                {renderConversation({ item })}
                                            </View>
                                        ))}
                                    </View>
                                ) : (
                                    <View style={styles.emptyContainer}>
                                        <View style={styles.emptyIconContainer}>
                                            <MerakiText style={styles.emptyIcon}>💬</MerakiText>
                                        </View>
                                        <MerakiText variant="h3" style={styles.emptyText}>No conversations yet</MerakiText>
                                        <MerakiText style={styles.emptySubtext}>
                                            {isMaster
                                                ? 'Search above to start chatting with a client'
                                                : 'Tap a master above to start chatting'}
                                        </MerakiText>
                                    </View>
                                )}
                            </View>
                        </ScrollView>
                    </>
                )}
            </SafeAreaView>
        </ScreenBackground>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    headerContainer: {
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.sm,
        paddingBottom: spacing.md,
    },
    pageTitle: {
        marginBottom: spacing.md,
        color: colors.text,
    },

    // Search
    searchContainer: {
        marginBottom: spacing.xs,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        paddingHorizontal: spacing.md,
        height: 50,
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.08)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 2,
    },
    searchIcon: {
        fontSize: 18,
        marginRight: spacing.sm,
        opacity: 0.7,
    },
    searchInput: {
        flex: 1,
        color: colors.text,
        fontSize: 16,
        height: '100%',
        fontFamily: 'Manrope-Regular',
    },
    clearIcon: {
        fontSize: 18,
        color: colors.textSecondary,
        marginLeft: spacing.sm,
    },

    // Masters Row
    mastersSection: {
        marginBottom: spacing.xl,
    },
    mastersHeader: {
        paddingHorizontal: spacing.lg,
        marginBottom: spacing.md,
    },
    mastersTitle: {
        color: colors.textSecondary,
        letterSpacing: 1,
        textTransform: 'uppercase',
        fontSize: 12,
    },
    mastersScroll: {
        paddingHorizontal: spacing.lg,
        gap: spacing.lg,
    },
    masterItem: {
        alignItems: 'center',
        width: 72,
    },
    masterAvatarContainer: {
        position: 'relative',
        marginBottom: spacing.xs,
    },
    masterAvatarPlaceholder: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: colors.surfaceLight,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: colors.borderGold, // Gold border
    },
    masterAvatarImage: {
        width: 64,
        height: 64,
        borderRadius: 32,
        borderWidth: 2,
        borderColor: colors.borderGold, // Gold border
    },
    masterAvatarText: {
        fontSize: 24,
        fontWeight: '700',
        color: colors.primary,
    },
    onlineIndicator: {
        position: 'absolute',
        bottom: 2,
        right: 2,
        width: 14,
        height: 14,
        borderRadius: 7,
        backgroundColor: colors.success,
        borderWidth: 2,
        borderColor: colors.background,
    },
    masterName: {
        color: colors.text,
        textAlign: 'center',
        width: '100%',
    },

    // Conversations
    conversationsSection: {
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.xl,
    },
    sectionTitle: {
        color: colors.textSecondary,
        letterSpacing: 1,
        textTransform: 'uppercase',
        fontSize: 12,
        marginBottom: spacing.md,
    },
    listContent: {
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.sm
    },
    conversationsList: {
        gap: spacing.sm,
    },
    conversationCard: {
        marginBottom: spacing.xs,
        borderRadius: 16,
        overflow: 'hidden',
    },
    conversationContent: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.md,
    },
    conversationAvatarPlaceholder: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: colors.surfaceLight,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: spacing.md,
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.08)',
    },
    conversationAvatarImage: {
        width: 52,
        height: 52,
        borderRadius: 26,
        marginRight: spacing.md,
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.08)',
    },
    conversationAvatarText: {
        fontSize: 20,
        fontWeight: '600',
        color: colors.textMuted
    },
    conversationInfo: {
        flex: 1,
        justifyContent: 'center',
    },
    conversationHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    conversationName: {
        color: colors.text,
        flex: 1,
        marginRight: spacing.sm,
    },
    timestamp: {
        color: colors.textMuted,
        fontSize: 12,
    },
    lastMessage: {
        color: colors.textSecondary,
    },

    // Empty State
    emptyContainer: {
        alignItems: 'center',
        paddingVertical: spacing.xxxl,
    },
    emptyIconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(200, 160, 77, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.lg,
    },
    emptyIcon: {
        fontSize: 32,
        opacity: 0.8
    },
    emptyText: {
        color: colors.text,
        marginBottom: spacing.sm
    },
    emptySubtext: {
        fontSize: 14,
        color: colors.textSecondary,
        textAlign: 'center',
        maxWidth: 250,
    },
    searchResultsContainer: {
        flex: 1,
    },
});

export default ChatListScreen;
