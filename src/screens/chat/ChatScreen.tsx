import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    TextInput,
    Platform,
    ActivityIndicator,
    Image,
    Modal,
    Dimensions,
    ScrollView,
    KeyboardAvoidingView,
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { format } from 'date-fns';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';

import { supabase } from '../../lib/supabase';
import { safeSupabaseFetch } from '../../lib/supabaseApi';
import { useAuth } from '../../contexts/AuthContext';
import { useModal } from '../../contexts/ModalContext';
import { ScreenBackground, MerakiText } from '../../components/ui';
import { SwipeableMessage } from '../../components/chat/SwipeableMessage';
import { MessageContextMenu } from '../../components/chat/MessageContextMenu';
import { colors, spacing, gradients, layout } from '../../theme';

type Message = {
    id: string;
    conversation_id: string;
    sender_id: string;
    content: string | null;
    media_url: string | null;
    media_type: string | null;
    created_at: string;
    is_deleted?: boolean;
    reply_to_id?: string | null;
};

type ChatStackParamList = {
    ChatList: undefined;
    Chat: {
        conversationId: string;
        otherUser: { full_name: string | null; avatar_url: string | null; id?: string };
        isSupportChat?: boolean;
    };
};


interface MessageItemProps {
    item: Message;
    isMe: boolean;
    isOptimistic: boolean;
    user: any;
    otherUser: { full_name: string | null; avatar_url: string | null; id?: string } | null;
    replyMessage: Message | null | undefined;
    onLongPress: (message: Message, pageY?: number) => void;
    onPreviewMedia: (media: { url: string; type: string }) => void;
    onReply: (message: Message) => void;
}

const MessageItem = React.memo(({
    item,
    isMe,
    isOptimistic,
    user,
    otherUser,
    replyMessage,
    onLongPress,
    onPreviewMedia,
    onReply,
}: MessageItemProps) => {
    const hasMedia = !!item.media_url;
    const hasContent = !!item.content;
    const isDeleted = item.is_deleted;

    // Skip empty messages unless deleted
    if (!hasMedia && !hasContent && !isDeleted) return null;

    const openPreview = () => {
        if (item.media_url && item.media_type) {
            onPreviewMedia({ url: item.media_url, type: item.media_type });
        }
    };

    const MessageContent = (
        <TouchableOpacity
            activeOpacity={0.8}
            onLongPress={(e) => onLongPress(item, e.nativeEvent.pageY)}
        >
            {isMe ? (
                isDeleted ? (
                    <View style={[
                        styles.messageBubble,
                        styles.bubbleGradient,
                        styles.bubbleDeleted
                    ]}>
                        <MerakiText style={[styles.messageText, { fontStyle: 'italic', color: 'rgba(0, 0, 0, 0.55)' }]}>
                            This message was deleted
                        </MerakiText>
                        <MerakiText style={[styles.messageTime, styles.messageTimeRight, { color: 'rgba(0, 0, 0, 0.35)' }]}>
                            {isOptimistic ? 'Sending...' : format(new Date(item.created_at), 'HH:mm')}
                        </MerakiText>
                    </View>
                ) : (
                    <LinearGradient
                        colors={['#2C3E50', '#3D5166']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={[
                            styles.messageBubble,
                            styles.bubbleGradient,
                            isOptimistic && styles.bubbleOptimistic,
                            hasMedia && { padding: 0 }
                        ]}
                    >
                        {/* Reply Content */}
                        {replyMessage && !isDeleted && (
                            <View style={[styles.replyContainer, { borderLeftColor: 'rgba(255, 255, 255, 0.40)' }]}>
                                <MerakiText style={[styles.replySender, { color: '#EDE7F6' }]}>
                                    {replyMessage.sender_id === user?.id ? 'You' : (otherUser?.full_name || 'User')}
                                </MerakiText>
                                <MerakiText numberOfLines={1} style={[styles.replyText, { color: 'rgba(255, 255, 255, 0.70)' }]}>
                                    {replyMessage.is_deleted ? 'Message deleted' : (replyMessage.content || (replyMessage.media_url ? '📷 Media' : '...'))}
                                </MerakiText>
                            </View>
                        )}

                        {item.media_url && (
                            <TouchableOpacity onPress={openPreview} activeOpacity={0.9} style={{ marginBottom: item.content ? 8 : 0 }}>
                                {item.media_type === 'video' ? (
                                    <Video
                                        source={{ uri: item.media_url }}
                                        style={styles.mediaVideo}
                                        useNativeControls={false}
                                        resizeMode={ResizeMode.COVER}
                                    />
                                ) : (
                                    <Image source={{ uri: item.media_url }} style={styles.mediaImage} resizeMode="cover" />
                                )}
                            </TouchableOpacity>
                        )}
                        {item.content && (
                            <MerakiText style={[styles.messageText, styles.messageTextRight]}>
                                {item.content}
                            </MerakiText>
                        )}
                        <MerakiText style={[styles.messageTime, styles.messageTimeRight]}>
                            {isOptimistic ? 'Sending...' : format(new Date(item.created_at), 'HH:mm')}
                        </MerakiText>
                    </LinearGradient>
                )
            ) : (
                isDeleted ? (
                    <View style={[
                        styles.messageBubble,
                        styles.bubbleGlass,
                        styles.bubbleDeleted
                    ]}>
                        <MerakiText style={[styles.messageText, { fontStyle: 'italic', color: colors.textMuted }]}>
                            This message was deleted
                        </MerakiText>
                        <MerakiText style={styles.messageTime}>
                            {format(new Date(item.created_at), 'HH:mm')}
                        </MerakiText>
                    </View>
                ) : (
                    <LinearGradient
                        colors={['#EDE7F6', '#E8EAF6']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={[
                            styles.messageBubble,
                            styles.bubbleGlass,
                            hasMedia && { padding: 4 }
                        ]}
                    >
                        {/* Reply Content */}
                        {replyMessage && !isDeleted && (
                            <View style={[styles.replyContainer, { borderLeftColor: '#7E57C2' }]}>
                                <MerakiText style={[styles.replySender, { color: '#7E57C2' }]}>
                                    {replyMessage.sender_id === user?.id ? 'You' : (otherUser?.full_name || 'User')}
                                </MerakiText>
                                <MerakiText numberOfLines={1} style={[styles.replyText, { color: '#6B7280' }]}>
                                    {replyMessage.is_deleted ? 'Message deleted' : (replyMessage.content || (replyMessage.media_url ? '📷 Media' : '...'))}
                                </MerakiText>
                            </View>
                        )}

                        {item.media_url && (
                            <TouchableOpacity onPress={openPreview} activeOpacity={0.9} style={{ marginBottom: item.content ? 8 : 0 }}>
                                {item.media_type === 'video' ? (
                                    <Video
                                        source={{ uri: item.media_url }}
                                        style={styles.mediaVideo}
                                        useNativeControls={false}
                                        resizeMode={ResizeMode.COVER}
                                    />
                                ) : (
                                    <Image source={{ uri: item.media_url }} style={styles.mediaImage} resizeMode="cover" />
                                )}
                            </TouchableOpacity>
                        )}
                        {item.content && (
                            <MerakiText style={styles.messageText}>
                                {item.content}
                            </MerakiText>
                        )}
                        <MerakiText style={styles.messageTime}>
                            {format(new Date(item.created_at), 'HH:mm')}
                        </MerakiText>
                    </LinearGradient>
                )
            )}
        </TouchableOpacity>
    );

    return (
        <View style={styles.messageContainer}>
            {!isDeleted ? (
                <SwipeableMessage
                    onReply={() => onReply(item)}
                    isMe={isMe}
                >
                    <View style={{ width: '100%', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                        {MessageContent}
                    </View>
                </SwipeableMessage>
            ) : (
                <View style={{ width: '100%', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                    {MessageContent}
                </View>
            )}
        </View>
    );
});

export function ChatScreen() {
    const navigation = useNavigation();
    const route = useRoute<RouteProp<ChatStackParamList, 'Chat'>>();
    const { user } = useAuth();
    const { showAlert, showConfirm } = useModal();
    const { conversationId, otherUser, isSupportChat } = route.params;

    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [sending, setSending] = useState(false);
    const [previewMedia, setPreviewMedia] = useState<{ url: string; type: string } | null>(null);
    const [replyingTo, setReplyingTo] = useState<Message | null>(null);
    const flatListRef = useRef<FlatList>(null);

    // Context Menu State
    const [contextMenuVisible, setContextMenuVisible] = useState(false);
    const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
    const [contextMenuY, setContextMenuY] = useState<number | null>(null);

    // Bookings Modal State
    const [showBookingsModal, setShowBookingsModal] = useState(false);
    const [bookings, setBookings] = useState<any[]>([]);
    const [bookingsLoading, setBookingsLoading] = useState(false);

    // Support chat auto-reply tracking
    const autoReplySentRef = useRef(false);

    useEffect(() => {
        const markMessagesAsRead = async () => {
            if (!user?.id || !conversationId) return;

            try {
                // The messages table's UPDATE policy is `auth.uid() = sender_id`,
                // so a direct update of the *other* party's rows silently
                // matched nothing and unread badges never cleared. Use the same
                // SECURITY DEFINER RPC the website uses: it checks conversation
                // membership and flips is_read/read_at server-side.
                const { error } = await safeSupabaseFetch(
                    (supabase as any).rpc('mark_conversation_read', {
                        p_conversation_id: conversationId,
                    })
                );

                if (error) {
                    console.error('Failed to mark messages as read:', error);
                }
            } catch (err) {
                console.error('Exception marking messages as read:', err);
            }
        };

        fetchMessages();
        markMessagesAsRead();

        // Real-time subscription for ALL messages in this conversation
        const subscription = supabase
            .channel(`chat:${conversationId}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
                filter: `conversation_id=eq.${conversationId}`,
            }, (payload) => {
                const newMsg = payload.new as Message;
                setMessages((prev) => {
                    if (prev.some(m => m.id === newMsg.id)) return prev;
                    const filtered = prev.filter(m => !m.id.startsWith('temp-'));
                    return [newMsg, ...filtered];
                });
                if (newMsg.sender_id !== user?.id) {
                    markMessagesAsRead();
                }
            })
            .subscribe();

        return () => {
            subscription.unsubscribe();
        };
    }, [conversationId, user?.id]);

    const fetchMessages = async () => {
        setFetchError(null);
        setLoading(true);
        try {
            const messagesPromise = (supabase as any)
                .from('messages')
                .select('*')
                .eq('conversation_id', conversationId)
                .order('created_at', { ascending: false })
                .limit(100);

            const { data, error } = await safeSupabaseFetch(messagesPromise, { timeout: 8000 });

            if (error) {
                setFetchError(error.message || 'Failed to load messages');
                setMessages([]);
                return;
            }
            setMessages((data as Message[]) || []);
        } catch (error: any) {
            setFetchError(error.message || 'Failed to load messages');
        } finally {
            setLoading(false);
        }
    };

    const sendMessage = async () => {
        if (!newMessage.trim() || sending) return;

        const messageText = newMessage.trim();
        setNewMessage('');
        setSending(true);

        const optimisticId = `temp-${Date.now()}`;
        const optimisticMessage: Message = {
            id: optimisticId,
            conversation_id: conversationId,
            sender_id: user?.id || '',
            content: messageText,
            media_url: null,
            media_type: null,
            created_at: new Date().toISOString(),
        };

        setMessages((prev) => [optimisticMessage, ...prev]);

        try {
            const { error } = await (supabase as any).from('messages').insert({
                conversation_id: conversationId,
                sender_id: user?.id,
                content: messageText,
                reply_to_id: replyingTo?.id,
            });

            if (error) throw error;

            setReplyingTo(null);

            await (supabase as any)
                .from('conversations')
                .update({ last_message_at: new Date().toISOString() })
                .eq('id', conversationId);

            // Auto-reply for support chats
            if (isSupportChat && !autoReplySentRef.current) {
                autoReplySentRef.current = true;
                sendSupportAutoReply();
            }

        } catch (error: any) {
            setMessages((prev) => prev.filter(m => m.id !== optimisticId));
            setNewMessage(messageText);
            showAlert('Error', error.message, 'error');
        } finally {
            setSending(false);
        }
    };

    const sendSupportAutoReply = async () => {
        if (!otherUser?.id) return;
        try {
            // Check if there's already an auto-reply in this conversation (within last hour)
            const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
            const { data: recentAutoReplies } = await (supabase as any)
                .from('messages')
                .select('id')
                .eq('conversation_id', conversationId)
                .eq('sender_id', otherUser.id)
                .gte('created_at', oneHourAgo)
                .ilike('content', '%received your message%will get back to you%')
                .limit(1);

            if (recentAutoReplies && recentAutoReplies.length > 0) return;

            // Fetch owner's custom auto-reply (if configured)
            let autoReplyText = 'Thank you for reaching out to Merakí Support! 💛\n\nWe\'ve received your message and will get back to you within 24–48 business hours.\n\nIf your matter is urgent, please use the phone or email options on the Help & Support page.';

            const { data: ownerSettings } = await (supabase as any)
                .from('master_settings')
                .select('auto_reply_message')
                .eq('master_id', otherUser.id)
                .single();

            if (ownerSettings?.auto_reply_message) {
                autoReplyText = ownerSettings.auto_reply_message;
            }

            // Brief delay so the auto-reply appears after the user's message
            await new Promise(resolve => setTimeout(resolve, 1500));

            await (supabase as any).from('messages').insert({
                conversation_id: conversationId,
                sender_id: otherUser.id,
                content: autoReplyText,
            });

            await (supabase as any)
                .from('conversations')
                .update({ last_message_at: new Date().toISOString() })
                .eq('id', conversationId);
        } catch (err) {
            console.error('Auto-reply error:', err);
        }
    };

    const pickMedia = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            showAlert('Permission needed', 'Please grant camera roll access', 'error');
            return;
        }

        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images', 'videos'],
                quality: 1,
                allowsEditing: false,
            });

            if (!result.canceled && result.assets[0]) {
                await uploadMedia(result.assets[0]);
            }
        } catch (error: any) {
            showAlert('Error', 'Failed to pick media: ' + error.message, 'error');
        }
    };

    const uploadMedia = async (asset: ImagePicker.ImagePickerAsset) => {
        setSending(true);

        const optimisticId = `temp-media-${Date.now()}`;
        const optimisticMessage: Message = {
            id: optimisticId,
            conversation_id: conversationId,
            sender_id: user?.id || '',
            content: null,
            media_url: asset.uri,
            media_type: asset.type === 'video' ? 'video' : 'image',
            created_at: new Date().toISOString(),
        };
        setMessages((prev) => [optimisticMessage, ...prev]);

        try {
            const fileExt = asset.uri.split('.').pop()?.toLowerCase() || 'jpg';
            const fileName = `${user?.id}/${Date.now()}.${fileExt}`;
            const mediaType = asset.type === 'video' ? 'video' : 'image';

            const base64 = await FileSystem.readAsStringAsync(asset.uri, {
                encoding: 'base64',
            });

            const { error: uploadError } = await supabase.storage
                .from('chat-media')
                .upload(fileName, decode(base64), {
                    contentType: mediaType === 'video' ? 'video/mp4' : 'image/jpeg',
                    upsert: false,
                });

            if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

            const { data: urlData } = supabase.storage
                .from('chat-media')
                .getPublicUrl(fileName);

            const { error } = await (supabase as any).from('messages').insert({
                conversation_id: conversationId,
                sender_id: user?.id,
                media_url: urlData.publicUrl,
                media_type: mediaType,
            });

            if (error) throw error;

            await (supabase as any)
                .from('conversations')
                .update({ last_message_at: new Date().toISOString() })
                .eq('id', conversationId);

        } catch (error: any) {
            setMessages((prev) => prev.filter(m => m.id !== optimisticId));
            showAlert('Error', 'Failed to send media: ' + error.message, 'error');
        } finally {
            setSending(false);
        }
    };

    const fetchBookings = async () => {
        setBookingsLoading(true);
        setShowBookingsModal(true);
        try {
            // Get the conversation to find both participant IDs
            const { data: conv, error: convError } = await (supabase as any)
                .from('conversations')
                .select('client_id, master_id')
                .eq('id', conversationId)
                .single();

            if (convError || !conv) {
                showAlert('Error', 'Could not load conversation details', 'error');
                setShowBookingsModal(false);
                return;
            }

            const { data, error } = await (supabase as any)
                .from('appointments')
                .select(`
                    id,
                    start_time,
                    end_time,
                    status,
                    price,
                    notes,
                    service:services(name, duration_minutes)
                `)
                .eq('client_id', conv.client_id)
                .eq('master_id', conv.master_id)
                .order('start_time', { ascending: false })
                .limit(20);

            if (error) throw error;
            setBookings(data || []);
        } catch (error: any) {
            showAlert('Error', 'Failed to load bookings: ' + error.message, 'error');
            setShowBookingsModal(false);
        } finally {
            setBookingsLoading(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'confirmed': return '#4CAF50';
            case 'completed': return '#8B5CF6';
            case 'cancelled': return '#EF4444';
            case 'pending': return '#F59E0B';
            case 'reschedule_pending': return '#F97316';
            default: return 'rgba(0, 0, 0, 0.40)';
        }
    };

    const handleLongPress = (message: Message, pageY?: number) => {
        if (message.is_deleted) return;
        setSelectedMessage(message);
        if (pageY) setContextMenuY(pageY);
        setContextMenuVisible(true);
    };

    const handleCopyMessage = async (message: Message) => {
        if (message.content) {
            await Clipboard.setStringAsync(message.content);
        }
    };

    const handleDeleteMessage = async (message: Message) => {
        // Optimistic update
        setMessages(prev => prev.map(m =>
            m.id === message.id
                ? { ...m, is_deleted: true, content: null, media_url: null, media_type: null }
                : m
        ));

        const { error } = await (supabase as any)
            .from('messages')
            .update({ is_deleted: true, content: null, media_url: null, media_type: null })
            .eq('id', message.id);

        if (error) {
            showAlert('Error', 'Failed to delete message: ' + error.message, 'error');
            fetchMessages();
        }
    };

    const handleReplyMessage = (message: Message) => {
        setReplyingTo(message);
    };

    const renderMessage = ({ item }: { item: Message }) => {
        const isMe = item.sender_id === user?.id;
        const isOptimistic = item.id.startsWith('temp-');
        const replyMessage = item.reply_to_id ? messages.find(m => m.id === item.reply_to_id) : null;

        return (
            <MessageItem
                item={item}
                isMe={isMe}
                isOptimistic={isOptimistic}
                user={user}
                otherUser={otherUser}
                replyMessage={replyMessage}
                onLongPress={handleLongPress}
                onPreviewMedia={setPreviewMedia}
                onReply={handleReplyMessage}
            />
        );
    };

    if (loading) {
        return (
            <ScreenBackground>
                <SafeAreaView style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </SafeAreaView>
            </ScreenBackground>
        );
    }

    if (fetchError) {
        return (
            <ScreenBackground>
                <SafeAreaView style={styles.loadingContainer}>
                    <MerakiText style={{ color: colors.error, marginBottom: 16, textAlign: 'center' }}>
                        {fetchError}
                    </MerakiText>
                    <TouchableOpacity onPress={fetchMessages} style={{ paddingVertical: 12, paddingHorizontal: 24, backgroundColor: colors.primary, borderRadius: 8 }}>
                        <MerakiText style={{ color: 'white', fontWeight: 'bold' }}>
                            Retry
                        </MerakiText>
                    </TouchableOpacity>
                </SafeAreaView>
            </ScreenBackground>
        );
    }

    return (
        <ScreenBackground>
            <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    style={{ flex: 1 }}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
                >
                    {/* Luxury Header */}
                    <View style={styles.headerContainer}>
                        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                            <MerakiText style={styles.backIcon}>{"<"}</MerakiText>
                        </TouchableOpacity>

                        <View style={styles.headerAvatarContainer}>
                            {otherUser?.avatar_url ? (
                                <Image source={{ uri: otherUser.avatar_url }} style={styles.headerAvatar} />
                            ) : (
                                <View style={styles.headerAvatarPlaceholder}>
                                    <MerakiText style={styles.headerAvatarText}>
                                        {otherUser?.full_name?.charAt(0) || '?'}
                                    </MerakiText>
                                </View>
                            )}
                            <View style={styles.headerAvatarRing} />
                            <View style={styles.headerStatusDot} />
                        </View>

                        <View style={styles.headerInfo}>
                            <MerakiText style={styles.headerName}>{otherUser?.full_name || 'Chat'}</MerakiText>
                            <MerakiText style={styles.headerStatus}>Specialist • Online</MerakiText>
                        </View>
                    </View>

                    {/* Messages */}
                    <FlatList
                        ref={flatListRef}
                        data={messages}
                        keyExtractor={(item) => item.id}
                        renderItem={renderMessage}
                        contentContainerStyle={styles.messagesList}
                        inverted
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                        keyboardDismissMode="interactive"
                        style={styles.flatList}
                        ListFooterComponent={() => (
                            <View style={styles.dateDivider}>
                                <View style={styles.datePill}>
                                    <MerakiText style={styles.dateText}>Today</MerakiText>
                                </View>
                            </View>
                        )}
                    />

                    {/* Footer Input */}
                    <View style={styles.footerContainer}>
                        {/* Quick Actions (Pills) */}
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            style={styles.quickActionsContainer}
                            contentContainerStyle={styles.quickActionsContent}
                        >
                            <TouchableOpacity style={styles.quickActionPill} onPress={pickMedia}>
                                <MerakiText style={{ fontSize: 18 }}>📷</MerakiText>
                                <MerakiText style={styles.quickActionText}>Send Photos for Consultation</MerakiText>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.quickActionPill} onPress={fetchBookings}>
                                <MerakiText style={{ fontSize: 18 }}>📅</MerakiText>
                                <MerakiText style={styles.quickActionText}>View Booking</MerakiText>
                            </TouchableOpacity>
                        </ScrollView>

                        {/* Reply Preview */}
                        {replyingTo && (
                            <View style={styles.replyPreviewBar}>
                                <View style={{ flex: 1 }}>
                                    <MerakiText style={styles.replyPreviewHeader}>
                                        Replying to {replyingTo.sender_id === user?.id ? 'Yourself' : (otherUser?.full_name || 'User')}
                                    </MerakiText>
                                    <MerakiText numberOfLines={1} style={styles.replyPreviewText}>
                                        {replyingTo.is_deleted ? 'Message deleted' : (replyingTo.content || (replyingTo.media_url ? '📷 Media' : '...'))}
                                    </MerakiText>
                                </View>
                                <TouchableOpacity onPress={() => setReplyingTo(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                                    <MerakiText style={styles.closeReply}>✕</MerakiText>
                                </TouchableOpacity>
                            </View>
                        )}

                        {/* Glass Input Bar */}
                        <View style={styles.inputContainer}>
                            <TextInput
                                style={styles.input}
                                value={newMessage}
                                onChangeText={setNewMessage}
                                placeholder={replyingTo ? "Type your reply..." : "Type a message..."}
                                placeholderTextColor="rgba(0, 0, 0, 0.25)"
                                multiline
                                maxLength={1000}
                                textAlignVertical="center"
                            />

                            <TouchableOpacity
                                disabled={!newMessage.trim() || sending}
                                onPress={sendMessage}
                            >
                                <LinearGradient
                                    colors={!newMessage.trim() || sending ? ['rgba(0, 0, 0, 0.08)', 'rgba(0, 0, 0, 0.08)'] : [colors.primary, colors.primary]}
                                    style={[styles.sendButton, (!newMessage.trim() || sending) && styles.sendButtonDisabled]}
                                >
                                    <MerakiText style={[styles.sendButtonText, { color: 'white' }]}>
                                        {sending ? '...' : '→'}
                                    </MerakiText>
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </SafeAreaView>

            {/* Custom Context Menu & Modals */}
            <Modal visible={!!previewMedia} animationType="fade" transparent statusBarTranslucent>
                <View style={styles.previewOverlay}>
                    <SafeAreaView style={styles.previewContainer}>
                        <TouchableOpacity style={styles.previewBackButton} onPress={() => setPreviewMedia(null)}>
                            <MerakiText style={styles.previewBackText}>← Back</MerakiText>
                        </TouchableOpacity>

                        {previewMedia?.type === 'video' ? (
                            <Video
                                source={{ uri: previewMedia.url }}
                                style={styles.previewVideo}
                                useNativeControls={true}
                                resizeMode={ResizeMode.CONTAIN}
                                shouldPlay
                            />
                        ) : previewMedia ? (
                            <Image
                                source={{ uri: previewMedia.url }}
                                style={styles.previewImage}
                                resizeMode="contain"
                            />
                        ) : null}
                    </SafeAreaView>
                </View>
            </Modal>

            {/* Bookings Modal */}
            <Modal visible={showBookingsModal} animationType="slide" transparent statusBarTranslucent>
                <View style={styles.bookingsOverlay}>
                    <SafeAreaView style={styles.bookingsModalContainer}>
                        <View style={styles.bookingsHeader}>
                            <MerakiText style={styles.bookingsTitle}>
                                Bookings with {otherUser?.full_name || 'User'}
                            </MerakiText>
                            <TouchableOpacity onPress={() => setShowBookingsModal(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                                <MerakiText style={styles.bookingsCloseText}>✕</MerakiText>
                            </TouchableOpacity>
                        </View>

                        {bookingsLoading ? (
                            <View style={styles.bookingsLoadingContainer}>
                                <ActivityIndicator size="large" color={colors.primary} />
                                <MerakiText style={{ color: 'rgba(0, 0, 0, 0.40)', marginTop: 12 }}>Loading bookings...</MerakiText>
                            </View>
                        ) : bookings.length === 0 ? (
                            <View style={styles.bookingsEmptyContainer}>
                                <MerakiText style={{ fontSize: 48 }}>📅</MerakiText>
                                <MerakiText style={styles.bookingsEmptyText}>No bookings found</MerakiText>
                                <MerakiText style={styles.bookingsEmptySubtext}>
                                    You don't have any appointments with {otherUser?.full_name || 'this user'} yet.
                                </MerakiText>
                            </View>
                        ) : (
                            <FlatList
                                data={bookings}
                                keyExtractor={(item) => item.id}
                                showsVerticalScrollIndicator={false}
                                contentContainerStyle={{ paddingBottom: 20 }}
                                renderItem={({ item }) => (
                                    <View style={styles.bookingCard}>
                                        <View style={styles.bookingCardHeader}>
                                            <MerakiText style={styles.bookingServiceName}>
                                                {item.service?.name || 'Service'}
                                            </MerakiText>
                                            <View style={[styles.bookingStatusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
                                                <MerakiText style={[styles.bookingStatusText, { color: getStatusColor(item.status) }]}>
                                                    {item.status?.replace('_', ' ').toUpperCase()}
                                                </MerakiText>
                                            </View>
                                        </View>

                                        <View style={styles.bookingDetailRow}>
                                            <MerakiText style={styles.bookingDetailIcon}>📅</MerakiText>
                                            <MerakiText style={styles.bookingDetailText}>
                                                {format(new Date(item.start_time), 'MMM dd, yyyy')}
                                            </MerakiText>
                                        </View>
                                        <View style={styles.bookingDetailRow}>
                                            <MerakiText style={styles.bookingDetailIcon}>🕐</MerakiText>
                                            <MerakiText style={styles.bookingDetailText}>
                                                {format(new Date(item.start_time), 'HH:mm')} — {format(new Date(item.end_time), 'HH:mm')}
                                            </MerakiText>
                                        </View>
                                        <View style={styles.bookingDetailRow}>
                                            <MerakiText style={styles.bookingDetailIcon}>💰</MerakiText>
                                            <MerakiText style={styles.bookingDetailText}>
                                                €{item.price?.toFixed(2)}
                                            </MerakiText>
                                        </View>
                                        {item.notes && (
                                            <View style={styles.bookingDetailRow}>
                                                <MerakiText style={styles.bookingDetailIcon}>📝</MerakiText>
                                                <MerakiText style={styles.bookingDetailText} numberOfLines={2}>
                                                    {item.notes}
                                                </MerakiText>
                                            </View>
                                        )}
                                    </View>
                                )}
                            />
                        )}
                    </SafeAreaView>
                </View>
            </Modal>

            <MessageContextMenu
                visible={contextMenuVisible}
                onClose={() => setContextMenuVisible(false)}
                message={selectedMessage}
                yPosition={contextMenuY}
                onReply={() => selectedMessage && handleReplyMessage(selectedMessage)}
                onCopy={() => selectedMessage && handleCopyMessage(selectedMessage)}
                onDelete={() => selectedMessage && handleDeleteMessage(selectedMessage)}
                isMe={selectedMessage?.sender_id === user?.id}
            />
        </ScreenBackground>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    // Header
    headerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
        paddingTop: Platform.OS === 'android' ? spacing.xl : spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0, 0, 0, 0.06)',
        backgroundColor: '#FFFFFF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
        elevation: 4,
        zIndex: 100,
    },
    backButton: {
        padding: spacing.xs,
        marginRight: spacing.sm,
        borderRadius: 20,
        backgroundColor: 'rgba(0, 0, 0, 0.04)',
    },
    backIcon: {
        fontSize: 18,
        color: '#1A1A1A',
    },
    headerAvatarContainer: {
        position: 'relative',
        marginRight: spacing.sm,
    },
    headerAvatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        borderWidth: 2,
        borderColor: colors.background,
    },
    headerAvatarRing: {
        position: 'absolute',
        top: -2,
        left: -2,
        right: -2,
        bottom: -2,
        borderRadius: 24,
        borderWidth: 2,
        borderColor: '#f4256a', // Exact primary from CSS
        opacity: 0.8,
    },
    headerStatusDot: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 12,
        height: 12,
        backgroundColor: '#3FB950',
        borderRadius: 6,
        borderWidth: 2,
        borderColor: '#FFFFFF', // Deep background
    },
    headerAvatarPlaceholder: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: colors.surfaceLight,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: colors.background,
    },
    headerAvatarText: {
        fontSize: 18,
        fontWeight: '600',
        color: colors.text,
    },
    headerInfo: {
        flex: 1,
    },
    headerName: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.text,
        letterSpacing: -0.5,
    },
    headerStatus: {
        fontSize: 10,
        color: '#E8A0B4',
        opacity: 0.9,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 1.5,
    },
    headerActions: {
        flexDirection: 'row',
        gap: spacing.xs,
    },
    headerActionButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.04)',
    },

    // Date Divider
    dateDivider: {
        alignItems: 'center',
        marginVertical: spacing.md,
        paddingBottom: spacing.sm,
    },
    datePill: {
        backgroundColor: 'rgba(0, 0, 0, 0.04)',
        paddingHorizontal: 16,
        paddingVertical: 6,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.06)',
    },
    dateText: {
        fontSize: 10,
        color: 'rgba(0, 0, 0, 0.35)',
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 2,
    },

    // Messages
    flatList: {
        flex: 1,
    },
    messagesList: {
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.lg,
        paddingBottom: 20,
    },
    messageContainer: {
        marginBottom: spacing.md,
        width: '100%',
    },
    messageRight: {
        alignSelf: 'flex-end',
        alignItems: 'flex-end',
    },
    messageLeft: {
        alignSelf: 'flex-start',
        alignItems: 'flex-start',
    },

    // Bubbles
    messageBubble: {
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 20,
        overflow: 'hidden',
        maxWidth: Dimensions.get('window').width * 0.85,
    },
    bubbleGradient: {
        borderBottomRightRadius: 4,
        shadowColor: '#2C3E50',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 3,
    },
    bubbleGlass: {
        borderBottomLeftRadius: 4,
        borderWidth: 1,
        borderColor: 'rgba(209, 196, 233, 0.4)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
    },
    bubbleDeleted: {
        backgroundColor: 'rgba(0, 0, 0, 0.02)',
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.08)',
        borderStyle: 'dashed',
    },
    bubbleOptimistic: {
        opacity: 0.7,
    },

    // Message Content
    messageText: {
        fontSize: 16,
        lineHeight: 24,
        color: colors.text,
        fontFamily: 'Manrope-Regular',
        letterSpacing: 0.3,
    },
    messageTextRight: {
        color: '#FFFFFF',
    },
    messageTime: {
        fontSize: 10,
        color: 'rgba(0, 0, 0, 0.35)',
        marginTop: 4,
        alignSelf: 'flex-end',
        fontWeight: '500',
    },
    messageTimeRight: {
        color: 'rgba(255, 255, 255, 0.70)',
    },

    // Media
    mediaImage: {
        width: 200,
        height: 200,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.08)',
    },
    mediaVideo: {
        width: 200,
        height: 150,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.08)',
    },

    // Footer Area (Floating)
    footerContainer: {
        paddingHorizontal: spacing.md,
        paddingBottom: Platform.OS === 'ios' ? spacing.xl : spacing.lg,
        paddingTop: spacing.xs,
    },

    // Quick Actions
    quickActionsContainer: {
        marginBottom: spacing.sm,
    },
    quickActionsContent: {
        paddingRight: spacing.md,
    },
    quickActionPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.04)',
        borderRadius: layout.borderRadius.full,
        paddingVertical: 10,
        paddingHorizontal: 16,
        marginRight: spacing.xs,
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.10)',
    },
    quickActionText: {
        color: '#1A1A1A',
        fontSize: 12,
        fontWeight: '600',
        marginLeft: spacing.xs,
    },

    // Input Bar (Floating Glass)
    // Input Bar (Floating Glass)
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.04)',
        borderRadius: 35,
        padding: 5,
        paddingHorizontal: 8,
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.08)',
        marginHorizontal: spacing.xs,
    },
    inputLeftActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginRight: 4,
    },
    inputActionButton: {
        width: 36,
        height: 36,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 18,
        backgroundColor: 'rgba(0, 0, 0, 0.04)',
    },
    inputActionIcon: {
        fontSize: 18,
        color: colors.textSecondary,
    },
    inputWrapper: {
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: spacing.xs,
    },
    input: {
        flex: 1,
        color: colors.text,
        fontSize: 15,
        paddingVertical: 10,
        paddingHorizontal: 8,
        maxHeight: 100,
        fontFamily: 'Manrope-Regular',
    },
    sendButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    sendButtonDisabled: {
        opacity: 0.5,
        shadowOpacity: 0,
    },
    sendButtonText: {
        fontSize: 20,
        color: 'white',
        transform: [{ translateX: 1 }],
    },

    // Reply Preview
    replyPreviewBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: spacing.sm,
        paddingHorizontal: spacing.md,
        backgroundColor: 'rgba(0, 0, 0, 0.06)',
        borderRadius: 16,
        marginBottom: spacing.xs,
        borderLeftWidth: 3,
        borderLeftColor: colors.primary,
    },
    replyPreviewHeader: {
        color: colors.primary,
        fontSize: 12,
        fontWeight: '700',
    },
    replyPreviewText: {
        color: colors.textSecondary,
        fontSize: 12,
    },
    closeReply: {
        fontSize: 20,
        color: colors.textMuted,
        padding: 4,
    },

    // Components
    // Components
    replyContainer: {
        borderLeftWidth: 2,
        borderLeftColor: colors.primary,
        paddingLeft: spacing.sm,
        marginBottom: 4,
    },
    replySender: {
        color: colors.primary,
        fontSize: 11,
        fontWeight: '700',
        marginBottom: 2,
    },
    replyText: {
        color: colors.textSecondary,
        fontSize: 11,
    },

    // Modal
    previewOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.95)',
        justifyContent: 'center',
    },
    previewContainer: {
        flex: 1,
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
    },
    previewBackButton: {
        position: 'absolute',
        top: 50,
        left: 20,
        zIndex: 10,
        padding: 10,
        backgroundColor: 'rgba(0,0,0,0.5)',
        borderRadius: 20,
    },
    previewBackText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
    },
    previewImage: {
        width: '100%',
        height: '80%',
    },
    previewVideo: {
        width: '100%',
        height: '80%',
    },

    // Bookings Modal
    bookingsOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.85)',
        justifyContent: 'flex-end',
    },
    bookingsModalContainer: {
        maxHeight: '80%',
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 20,
        paddingBottom: 20,
    },
    bookingsHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 20,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0, 0, 0, 0.06)',
    },
    bookingsTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1A1A1A',
    },
    bookingsCloseText: {
        fontSize: 20,
        color: 'rgba(0, 0, 0, 0.40)',
        fontWeight: '600',
    },
    bookingsLoadingContainer: {
        paddingVertical: 60,
        alignItems: 'center',
        justifyContent: 'center',
    },
    bookingsEmptyContainer: {
        paddingVertical: 60,
        alignItems: 'center',
        justifyContent: 'center',
    },
    bookingsEmptyText: {
        fontSize: 18,
        fontWeight: '700',
        color: '#6B7280',
        marginTop: 12,
    },
    bookingsEmptySubtext: {
        fontSize: 14,
        color: 'rgba(0, 0, 0, 0.35)',
        marginTop: 6,
        textAlign: 'center',
    },
    bookingCard: {
        backgroundColor: 'rgba(0, 0, 0, 0.04)',
        borderRadius: 16,
        padding: 16,
        marginTop: 12,
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.06)',
    },
    bookingCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    bookingServiceName: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1A1A1A',
        flex: 1,
    },
    bookingStatusBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
        marginLeft: 8,
    },
    bookingStatusText: {
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    bookingDetailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 6,
    },
    bookingDetailIcon: {
        fontSize: 14,
        marginRight: 8,
        width: 22,
    },
    bookingDetailText: {
        fontSize: 14,
        color: 'rgba(0, 0, 0, 0.55)',
        flex: 1,
    },
});

export default ChatScreen;
