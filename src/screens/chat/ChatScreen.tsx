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
    Alert,
    Image,
    Modal,
    Dimensions,
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { format } from 'date-fns';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import * as Clipboard from 'expo-clipboard';
import { supabase } from '../../lib/supabase';
import { safeSupabaseFetch } from '../../lib/supabaseApi';
import { useAuth } from '../../contexts/AuthContext';
import { colors, spacing } from '../../theme';
import { ScreenBackground } from '../../components/ui';
import { SwipeableMessage } from '../../components/chat/SwipeableMessage';
import { MessageContextMenu } from '../../components/chat/MessageContextMenu';

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
        otherUser: { full_name: string | null; avatar_url: string | null };
    };
};

export function ChatScreen() {
    const navigation = useNavigation();
    const route = useRoute<RouteProp<ChatStackParamList, 'Chat'>>();
    const { user } = useAuth();
    const { conversationId, otherUser } = route.params;

    const [loading, setLoading] = useState(true);
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [sending, setSending] = useState(false);
    const [previewMedia, setPreviewMedia] = useState<{ url: string; type: string } | null>(null);
    const [replyingTo, setReplyingTo] = useState<Message | null>(null);
    const flatListRef = useRef<FlatList>(null);

    // Context Menu State
    const [contextMenuVisible, setContextMenuVisible] = useState(false);
    const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);

    useEffect(() => {
        fetchMessages();

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
            })
            .subscribe();

        return () => {
            subscription.unsubscribe();
        };
    }, [conversationId]);

    const fetchMessages = async () => {
        try {
            const messagesPromise = (supabase as any)
                .from('messages')
                .select('*')
                .eq('conversation_id', conversationId)
                .order('created_at', { ascending: false })
                .limit(100);

            const { data, error } = await safeSupabaseFetch(messagesPromise, { timeout: 8000 });

            if (error) {
                console.log('Messages fetch error:', error.message);
                setMessages([]);
                return;
            }
            setMessages((data as Message[]) || []);
        } catch (error) {
            console.error('Error fetching messages:', error);
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

        } catch (error: any) {
            setMessages((prev) => prev.filter(m => m.id !== optimisticId));
            setNewMessage(messageText);
            Alert.alert('Error', error.message);
        } finally {
            setSending(false);
        }
    };

    const pickMedia = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission needed', 'Please grant camera roll access');
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
            Alert.alert('Error', 'Failed to pick media: ' + error.message);
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
            Alert.alert('Error', 'Failed to send media: ' + error.message);
        } finally {
            setSending(false);
        }
    };

    const handleLongPress = (message: Message) => {
        if (message.is_deleted) return;
        setSelectedMessage(message);
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
            Alert.alert('Error', 'Failed to delete message: ' + error.message);
            fetchMessages();
        }
    };

    const handleReplyMessage = (message: Message) => {
        setReplyingTo(message);
    };

    const renderMessage = ({ item }: { item: Message }) => {
        const isMe = item.sender_id === user?.id;
        const isOptimistic = item.id.startsWith('temp-');
        const hasMedia = !!item.media_url;
        const hasContent = !!item.content;
        const isDeleted = item.is_deleted;

        // Skip empty messages unless deleted
        if (!hasMedia && !hasContent && !isDeleted) return null;

        const openPreview = () => {
            if (item.media_url && item.media_type) {
                setPreviewMedia({ url: item.media_url, type: item.media_type });
            }
        };

        const replyMessage = item.reply_to_id ? messages.find(m => m.id === item.reply_to_id) : null;

        const MessageContent = (
            <TouchableOpacity
                activeOpacity={0.8}
                onLongPress={() => handleLongPress(item)}
                style={[
                    styles.messageBubble,
                    hasMedia && styles.mediaBubble,
                    isMe ? styles.bubbleRight : styles.bubbleLeft,
                    isOptimistic && styles.bubbleOptimistic,
                    isDeleted && styles.bubbleDeleted
                ]}
            >
                {isDeleted ? (
                    <Text style={[styles.messageText, { fontStyle: 'italic', color: colors.textMuted }]}>
                        This message was deleted
                    </Text>
                ) : (
                    <>
                        {replyMessage && (
                            <View style={styles.replyContainer}>
                                <View style={styles.replyBar} />
                                <View style={styles.replyContent}>
                                    <Text style={styles.replySender}>
                                        {replyMessage.sender_id === user?.id ? 'You' : (otherUser?.full_name || 'User')}
                                    </Text>
                                    <Text numberOfLines={1} style={styles.replyText}>
                                        {replyMessage.is_deleted ? 'Message deleted' : (replyMessage.content || (replyMessage.media_url ? '📷 Media' : '...'))}
                                    </Text>
                                </View>
                            </View>
                        )}

                        {item.media_url && item.media_type === 'video' ? (
                            <TouchableOpacity onPress={openPreview} activeOpacity={0.9}>
                                <Video
                                    source={{ uri: item.media_url }}
                                    style={styles.mediaVideo}
                                    useNativeControls
                                    resizeMode={ResizeMode.CONTAIN}
                                    isLooping={false}
                                />
                            </TouchableOpacity>
                        ) : item.media_url ? (
                            <TouchableOpacity onPress={openPreview} activeOpacity={0.9}>
                                <Image source={{ uri: item.media_url }} style={styles.mediaImage} resizeMode="cover" />
                            </TouchableOpacity>
                        ) : null}

                        {item.content && (
                            <Text style={[styles.messageText, isMe && styles.messageTextRight]}>
                                {item.content}
                            </Text>
                        )}
                    </>
                )}

                <Text style={[styles.messageTime, isMe && styles.messageTimeRight]}>
                    {isOptimistic ? 'Sending...' : format(new Date(item.created_at), 'HH:mm')}
                </Text>
            </TouchableOpacity>
        );

        return (
            <View style={[styles.messageContainer, isMe ? styles.messageRight : styles.messageLeft]}>
                {!isDeleted ? (
                    <SwipeableMessage
                        onReply={() => handleReplyMessage(item)}
                        isMe={isMe}
                    >
                        {MessageContent}
                    </SwipeableMessage>
                ) : (
                    MessageContent
                )}
            </View>
        );
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.text} />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <ScreenBackground>
            <SafeAreaView style={styles.container} edges={['top']}>
                {/* Header - Fixed */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <Text style={styles.backButton}>←</Text>
                    </TouchableOpacity>
                    {otherUser?.avatar_url ? (
                        <Image source={{ uri: otherUser.avatar_url }} style={styles.headerAvatarImage} />
                    ) : (
                        <View style={styles.headerAvatar}>
                            <Text style={styles.headerAvatarText}>
                                {otherUser?.full_name?.[0] || '?'}
                            </Text>
                        </View>
                    )}
                    <Text style={styles.headerTitle} numberOfLines={1}>{otherUser?.full_name || 'Chat'}</Text>
                </View>

                {/* Messages - Flexible */}
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
                />

                {/* Input - Fixed at bottom */}
                <View style={styles.footer}>
                    {replyingTo && (
                        <View style={styles.replyPreviewBar}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.replyPreviewHeader}>
                                    Replying to {replyingTo.sender_id === user?.id ? 'Yourself' : (otherUser?.full_name || 'User')}
                                </Text>
                                <Text numberOfLines={1} style={styles.replyPreviewText}>
                                    {replyingTo.is_deleted ? 'Message deleted' : (replyingTo.content || (replyingTo.media_url ? '📷 Media' : '...'))}
                                </Text>
                            </View>
                            <TouchableOpacity onPress={() => setReplyingTo(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                                <Text style={styles.closeReply}>✕</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                    <View style={styles.inputContainer}>
                        <TouchableOpacity style={styles.mediaButton} onPress={pickMedia} disabled={sending}>
                            <Text style={styles.mediaButtonText}>📷</Text>
                        </TouchableOpacity>
                        <TextInput
                            style={styles.input}
                            value={newMessage}
                            onChangeText={setNewMessage}
                            placeholder={replyingTo ? "Type your reply..." : "Type a message..."}
                            placeholderTextColor={colors.textMuted}
                            multiline
                            maxLength={1000}
                        />
                        <TouchableOpacity
                            style={[styles.sendButton, (!newMessage.trim() || sending) && styles.sendButtonDisabled]}
                            onPress={sendMessage}
                            disabled={!newMessage.trim() || sending}
                        >
                            <Text style={styles.sendButtonText}>{sending ? '...' : '→'}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </SafeAreaView>

            {/* Fullscreen Media Preview Modal */}
            <Modal visible={!!previewMedia} animationType="fade" transparent statusBarTranslucent>
                <View style={styles.previewOverlay}>
                    <SafeAreaView style={styles.previewContainer}>
                        <TouchableOpacity style={styles.previewBackButton} onPress={() => setPreviewMedia(null)}>
                            <Text style={styles.previewBackText}>← Back</Text>
                        </TouchableOpacity>

                        {previewMedia?.type === 'video' ? (
                            <Video
                                source={{ uri: previewMedia.url }}
                                style={styles.previewVideo}
                                useNativeControls
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

            {/* Custom Context Menu */}
            <MessageContextMenu
                visible={contextMenuVisible}
                onClose={() => setContextMenuVisible(false)}
                message={selectedMessage}
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
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.1)',
        backgroundColor: 'rgba(0,0,0,0.2)',
    },
    backBtn: { padding: spacing.xs },
    backButton: { fontSize: 24, color: colors.text },
    headerAvatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: spacing.sm,
        marginRight: spacing.sm,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    headerAvatarText: { fontSize: 14, fontWeight: '600', color: colors.text },
    headerAvatarImage: {
        width: 36,
        height: 36,
        borderRadius: 18,
        marginLeft: spacing.sm,
        marginRight: spacing.sm,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    headerTitle: { fontSize: 16, fontWeight: '600', color: colors.text, flex: 1 },
    flatList: {
        flex: 1,
    },
    messagesList: {
        padding: spacing.md,
    },
    messageContainer: { marginBottom: spacing.sm },
    messageRight: { alignItems: 'flex-end' },
    messageLeft: { alignItems: 'flex-start' },
    messageBubble: { maxWidth: '100%', padding: spacing.md, borderRadius: 20 },
    mediaBubble: { padding: spacing.xs, paddingBottom: 0 },
    bubbleRight: { backgroundColor: colors.primary, borderBottomRightRadius: 4 },
    bubbleLeft: { backgroundColor: 'rgba(255,255,255,0.1)', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    bubbleOptimistic: { opacity: 0.7 },
    messageText: { fontSize: 15, color: colors.text, lineHeight: 22 },
    messageTextRight: { color: colors.text },
    messageTime: { fontSize: 11, color: colors.textMuted, marginTop: spacing.xs, alignSelf: 'flex-end', paddingHorizontal: spacing.xs, paddingBottom: spacing.xs },
    messageTimeRight: { color: 'rgba(255,255,255,0.7)' },
    mediaImage: { width: 240, height: 280, borderRadius: 16 },
    mediaVideo: { width: 240, height: 180, borderRadius: 16 },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        padding: spacing.md,
    },
    mediaButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: spacing.sm,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    mediaButtonText: { fontSize: 20 },
    input: {
        flex: 1,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 24,
        paddingHorizontal: spacing.lg,
        paddingVertical: Platform.OS === 'ios' ? 12 : 8,
        color: colors.text,
        fontSize: 16,
        maxHeight: 100,
        minHeight: 44,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    sendButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: spacing.sm,
    },
    sendButtonDisabled: { opacity: 0.5, backgroundColor: 'rgba(255,255,255,0.1)' },
    sendButtonText: { fontSize: 20, color: colors.text, fontWeight: '600' },
    // Preview modal styles
    previewOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)' },
    previewContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    previewBackButton: { position: 'absolute', top: spacing.md, left: spacing.md, zIndex: 10, padding: spacing.md, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 8 },
    previewBackText: { color: colors.text, fontSize: 16, fontWeight: '600' },
    previewImage: { width: Dimensions.get('window').width, height: Dimensions.get('window').height * 0.8 },
    previewVideo: { width: Dimensions.get('window').width, height: Dimensions.get('window').height * 0.6 },
    bubbleDeleted: { backgroundColor: 'transparent', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    replyContainer: { marginBottom: spacing.xs, backgroundColor: 'rgba(0,0,0,0.2)', padding: spacing.xs, borderRadius: 8, flexDirection: 'row' },
    replyBar: { width: 4, backgroundColor: colors.primary, marginRight: spacing.xs, borderRadius: 2 },
    replyContent: { flex: 1 },
    replySender: { color: colors.primary, fontSize: 12, fontWeight: '600', marginBottom: 2 },
    replyText: { color: 'rgba(255,255,255,0.7)', fontSize: 12 },
    footer: { backgroundColor: 'rgba(0,0,0,0.3)', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' },
    replyPreviewBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.sm, backgroundColor: 'rgba(255,255,255,0.05)', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
    replyPreviewHeader: { color: colors.primary, fontSize: 12, fontWeight: '600', marginBottom: 2 },
    replyPreviewText: { color: 'rgba(255,255,255,0.7)', fontSize: 12 },
    closeReply: { color: colors.textMuted, fontSize: 20, padding: spacing.xs },
});

export default ChatScreen;
