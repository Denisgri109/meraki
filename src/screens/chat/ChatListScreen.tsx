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
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { formatDistanceToNow } from 'date-fns';
import { LinearGradient } from 'expo-linear-gradient';
import { safeSupabaseFetch } from '../../lib/supabaseApi';

import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Card, ScreenBackground } from '../../components/ui';
import { colors, spacing } from '../../theme';

interface Master {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    bio?: string | null;
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

    const isMaster = profile?.is_master || profile?.role === 'master' || profile?.role === 'owner';

    useFocusEffect(
        React.useCallback(() => {
            fetchData();
        }, [user?.id])
    );

    useEffect(() => {
        if (!isMaster) return;

        const timer = setTimeout(async () => {
            if (searchQuery.trim().length > 0) {
                setIsSearching(true);
                try {
                    const { data, error } = await supabase
                        .from('profiles')
                        .select('id, full_name, avatar_url, role')
                        .ilike('full_name', `%${searchQuery}%`)
                        .neq('id', user?.id || '')
                        .limit(20);

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
    }, [searchQuery, isMaster, user?.id]);

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
                    .select('id, full_name, avatar_url, bio')
                    .or('is_master.eq.true,role.eq.owner')
                    .order('full_name');

                const { data: mastersData } = await safeSupabaseFetch(mastersPromise as any, { timeout: 5000 });
                setMasters((mastersData as Master[]) || []);
            }

            // Fetch conversations
            const field = isMaster ? 'master_id' : 'client_id';
            const convPromise = (supabase as any)
                .from('conversations')
                .select('*')
                .eq(field, user.id)
                .order('last_message_at', { ascending: false });

            const { data: convData, error: convError } = await safeSupabaseFetch(convPromise as any, {
                timeout: 8000,
                errorMessage: 'Failed to load conversations'
            });

            if (convError) {
                console.log('Conversations fetch error:', convError.message);
                setConversations([]);
                return;
            }

            let allConversations = convData || [];

            // Fetch other user details and last message for all conversations
            // This part involves multiple requests, so we'll wrap the Promise.all logic carefully
            const convWithUsers = await Promise.all(
                (allConversations as any[]).map(async (conv: any) => {
                    const otherUserId = isMaster ? conv.client_id : conv.master_id;

                    // These individual lookups are usually fast, but we should generic safe fetch them 
                    // or just rely on the main timeout if we were fetching all at once.
                    // For now, let's just do standard await to avoid overhead on every single small request,
                    // relying on the implemented timeouts in the main requests to handle the bulk of issues.
                    // However, if one of these hangs, the whole screen hangs.
                    // Let's use a simple timeout for the whole batch if possible, or just keep individual.

                    const { data: userData } = await supabase
                        .from('profiles')
                        .select('full_name, avatar_url')
                        .eq('id', otherUserId)
                        .single();

                    // Fetch the last message for this conversation
                    const { data: lastMsgData } = await (supabase as any)
                        .from('messages')
                        .select('content, media_type, is_deleted')
                        .eq('conversation_id', conv.id)
                        .order('created_at', { ascending: false })
                        .limit(1)
                        .single();

                    return {
                        ...conv,
                        other_user: userData,
                        last_message: lastMsgData,
                    };
                })
            );

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

            navigation.navigate('Chat', {
                conversationId,
                otherUser: {
                    full_name: targetUserName,
                    avatar_url: targetUserAvatarUrl,
                    id: targetUserId
                },
            });
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
            {master.avatar_url ? (
                <Image source={{ uri: master.avatar_url }} style={styles.masterAvatarImage} />
            ) : (
                <View style={styles.masterAvatar}>
                    <Text style={styles.masterAvatarText}>
                        {master.full_name?.[0] || 'M'}
                    </Text>
                </View>
            )}
            <Text style={styles.masterName} numberOfLines={1}>
                {master.full_name?.split(' ')[0] || 'Master'}
            </Text>
        </TouchableOpacity>
    );

    const renderConversation = ({ item }: { item: Conversation }) => (
        <TouchableOpacity
            onPress={() => navigation.navigate('Chat', {
                conversationId: item.id,
                otherUser: item.other_user,
            })}
        >
            <Card style={styles.conversationCard} variant="glass">
                {item.other_user?.avatar_url ? (
                    <Image source={{ uri: item.other_user.avatar_url }} style={styles.conversationAvatarImage} />
                ) : (
                    <View style={styles.conversationAvatar}>
                        <Text style={styles.conversationAvatarText}>
                            {item.other_user?.full_name?.[0] || '?'}
                        </Text>
                    </View>
                )}
                <View style={styles.conversationInfo}>
                    <Text style={styles.conversationName}>
                        {item.other_user?.full_name || 'Unknown'}
                    </Text>
                    <Text style={styles.lastMessage} numberOfLines={1}>
                        {item.last_message?.is_deleted
                            ? 'Message deleted'
                            : item.last_message?.media_type
                                ? `📷 ${item.last_message.media_type === 'image' ? 'Photo' : 'Video'}`
                                : item.last_message?.content || 'Start a conversation...'}
                    </Text>
                </View>
                <Text style={styles.timestamp}>
                    {formatDistanceToNow(new Date(item.last_message_at), { addSuffix: false })}
                </Text>
            </Card>
        </TouchableOpacity>
    );

    const renderSearchResult = ({ item }: { item: any }) => (
        <TouchableOpacity
            onPress={() => startOrOpenConversation(item.id, item.full_name, item.avatar_url)}
        >
            <Card style={styles.conversationCard} variant="glass">
                {item.avatar_url ? (
                    <Image source={{ uri: item.avatar_url }} style={styles.conversationAvatarImage} />
                ) : (
                    <View style={styles.conversationAvatar}>
                        <Text style={styles.conversationAvatarText}>
                            {item.full_name?.[0] || '?'}
                        </Text>
                    </View>
                )}
                <View style={styles.conversationInfo}>
                    <Text style={styles.conversationName}>
                        {item.full_name || 'Unknown'}
                    </Text>
                    <Text style={styles.lastMessage} numberOfLines={1}>
                        {item.role === 'client' ? 'Client' : 'User'}
                    </Text>
                </View>
            </Card>
        </TouchableOpacity>
    );

    if (loading) {
        return (
            <ScreenBackground>
                <SafeAreaView style={styles.container}>
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={colors.text} />
                    </View>
                </SafeAreaView>
            </ScreenBackground>
        );
    }

    return (
        <ScreenBackground>
            <SafeAreaView style={styles.container} edges={['top']}>
                {/* Header */}

                {/* Search Header for Masters */}
                {isMaster && (
                    <View style={styles.searchContainer}>
                        <View style={styles.searchBar}>
                            <Text style={styles.searchIcon}>🔍</Text>
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Search clients..."
                                placeholderTextColor={colors.textSecondary}
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                autoCapitalize="none"
                            />
                            {searchQuery.length > 0 && (
                                <TouchableOpacity onPress={() => setSearchQuery('')}>
                                    <Text style={styles.clearIcon}>✕</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                )}

                {/* Search Results Overlay */}
                {isMaster && searchQuery.length > 0 ? (
                    <View style={styles.searchResultsContainer}>
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
                                <Text style={styles.emptyText}>No clients found</Text>
                            </View>
                        )}
                    </View>
                ) : (
                    <>

                        {/* Masters Section (only for clients) */}
                        {!isMaster && masters.length > 0 && (
                            <View style={styles.mastersSection}>
                                <Text style={styles.mastersTitle}>Contact a Master</Text>
                                <ScrollView
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    contentContainerStyle={styles.mastersScroll}
                                >
                                    {masters.map(renderMaster)}
                                </ScrollView>
                            </View>
                        )}

                        {/* Conversations Section */}
                        <View style={styles.conversationsSection}>
                            <Text style={styles.sectionTitle}>Conversations</Text>
                        </View>

                        {conversations.length > 0 ? (
                            <FlatList
                                data={conversations}
                                keyExtractor={(item) => item.id}
                                renderItem={renderConversation}
                                contentContainerStyle={styles.listContent}
                                refreshControl={
                                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} />
                                }
                            />
                        ) : (
                            <View style={styles.emptyContainer}>
                                <Text style={styles.emptyIcon}>💬</Text>
                                <Text style={styles.emptyText}>No conversations yet</Text>
                                <Text style={styles.emptySubtext}>
                                    {isMaster
                                        ? 'Search above to start chatting with a client'
                                        : 'Tap a master above to start chatting'}
                                </Text>
                            </View>
                        )}
                    </>
                )}
            </SafeAreaView>
        </ScreenBackground>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    mastersSection: {
        paddingBottom: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    mastersTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.textSecondary,
        paddingHorizontal: spacing.lg,
        marginBottom: spacing.md,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    mastersScroll: {
        paddingHorizontal: spacing.lg,
        gap: spacing.lg,
    },
    masterItem: {
        alignItems: 'center',
        width: 70,
    },
    masterAvatar: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.xs,
        borderWidth: 2,
        borderColor: colors.primaryLight || 'rgba(139, 92, 246, 0.3)',
    },
    masterAvatarImage: {
        width: 56,
        height: 56,
        borderRadius: 28,
        marginBottom: spacing.xs,
        borderWidth: 2,
        borderColor: colors.primaryLight || 'rgba(139, 92, 246, 0.3)',
    },
    masterAvatarText: {
        fontSize: 22,
        fontWeight: '700',
        color: colors.text,
    },
    masterName: {
        fontSize: 12,
        color: colors.text,
        textAlign: 'center',
        fontWeight: '500',
    },
    conversationsSection: {
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.lg,
        paddingBottom: spacing.sm,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    listContent: {
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.sm
    },
    conversationCard: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.sm,
        padding: spacing.md
    },
    conversationAvatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: spacing.md,
        borderWidth: 1,
        borderColor: colors.border
    },
    conversationAvatarImage: {
        width: 50,
        height: 50,
        borderRadius: 25,
        marginRight: spacing.md,
        borderWidth: 1,
        borderColor: colors.border
    },
    conversationAvatarText: { fontSize: 20, fontWeight: '600', color: colors.text },
    conversationInfo: { flex: 1 },
    conversationName: { fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: 2 },
    lastMessage: { fontSize: 14, color: colors.textSecondary },
    timestamp: { fontSize: 12, color: colors.textMuted },
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
    emptyIcon: { fontSize: 64, marginBottom: spacing.lg, opacity: 0.5 },
    emptyText: { fontSize: 18, fontWeight: '500', color: colors.text, marginBottom: spacing.sm },
    emptySubtext: { fontSize: 14, color: colors.textSecondary, textAlign: 'center' },
    searchContainer: {
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.md,
        paddingTop: spacing.sm,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surfaceLight,
        borderRadius: 12,
        paddingHorizontal: spacing.md,
        height: 48,
        borderWidth: 1,
        borderColor: colors.border,
    },
    searchIcon: {
        fontSize: 18,
        marginRight: spacing.sm,
    },
    searchInput: {
        flex: 1,
        color: colors.text,
        fontSize: 16,
        height: '100%',
    },
    clearIcon: {
        fontSize: 18,
        color: colors.textSecondary,
        marginLeft: spacing.sm,
    },
    searchResultsContainer: {
        flex: 1,
    },
});

export default ChatListScreen;
