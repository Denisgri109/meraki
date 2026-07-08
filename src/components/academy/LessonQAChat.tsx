/**
 * LessonQAChat — Lesson-specific Q&A component.
 *
 * Embedded within the LessonScreen so students can ask questions and
 * share photos, and the instructor (owner) can respond when available.
 *
 * Features:
 *   - Messaging via Supabase channel subscription
 *   - Photo upload support (camera + gallery)
 *   - Threaded replies (reply to a specific message)
 *   - Pin important answers (owner only)
 *   - Push notification trigger when a student asks a question
 *   - Visual distinction between student questions and instructor answers
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    KeyboardAvoidingView,
    Platform,
    Image,
    ActivityIndicator,
    Dimensions,
} from 'react-native';
import { useModal } from '../../contexts/ModalContext';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { MerakiText, Card } from '../../components/ui';
import { colors, spacing, layout } from '../../theme';

const { width } = Dimensions.get('window');

type QAMessage = {
    id: string;
    lesson_id: string;
    course_id: string;
    sender_id: string;
    content: string | null;
    media_url: string | null;
    media_type: string | null;
    is_question: boolean;
    is_pinned: boolean;
    parent_message_id: string | null;
    created_at: string;
    sender?: {
        full_name: string | null;
        avatar_url: string | null;
        role: string;
    };
};

type Props = {
    lessonId: string;
    courseId: string;
    instructorId: string | null;
    isInstructor: boolean;
    onScrollStateChange?: (enabled: boolean) => void;
};


export function useLessonQA({ lessonId, courseId, instructorId, isInstructor }: Props) {
    const { user, profile } = useAuth();
    const { showAlert, showModal, hideModal } = useModal();
    const [messages, setMessages] = useState<QAMessage[]>([]);
    const [messageText, setMessageText] = useState('');
    const [sending, setSending] = useState(false);
    const [loading, setLoading] = useState(true);
    const [replyTo, setReplyTo] = useState<QAMessage | null>(null);
    const [imageUploading, setImageUploading] = useState(false);
    const flatListRef = useRef<ScrollView>(null);

    const loadMessages = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('lesson_qa_messages')
                .select('*, sender:profiles!lesson_qa_messages_sender_id_fkey(full_name, avatar_url, role)')
                .eq('lesson_id', lessonId)
                .order('created_at', { ascending: true });

            if (error) throw error;
            setMessages((data as unknown as QAMessage[]) || []);
        } catch (e) {
            console.error('Error loading QA messages:', e);
        } finally {
            setLoading(false);
        }
    }, [lessonId]);

    useEffect(() => {
        loadMessages();

        const channel = supabase
            .channel(`lesson_qa_${lessonId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'lesson_qa_messages',
                    filter: `lesson_id=eq.${lessonId}`,
                },
                async (payload) => {
                    const { data } = await supabase
                        .from('lesson_qa_messages')
                        .select('*, sender:profiles!lesson_qa_messages_sender_id_fkey(full_name, avatar_url, role)')
                        .eq('id', payload.new.id)
                        .single();

                    if (!data) return;

                    setMessages(prev => {
                        if (prev.find(m => m.id === (data as any).id)) return prev;
                        return [...prev, data as unknown as QAMessage];
                    });
                    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'lesson_qa_messages',
                    filter: `lesson_id=eq.${lessonId}`,
                },
                async (payload) => {
                    const { data } = await supabase
                        .from('lesson_qa_messages')
                        .select('*, sender:profiles!lesson_qa_messages_sender_id_fkey(full_name, avatar_url, role)')
                        .eq('id', payload.new.id)
                        .single();

                    if (!data) return;

                    setMessages(prev => prev.map(m =>
                        m.id === (data as any).id ? (data as unknown as QAMessage) : m
                    ));
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [lessonId, loadMessages]);

    const sendMessage = async (content: string | null, mediaUrl: string | null = null, mediaType: string | null = null) => {
        if (!user || (!content?.trim() && !mediaUrl)) return;

        setSending(true);
        try {
            const { error } = await supabase
                .from('lesson_qa_messages')
                .insert({
                    lesson_id: lessonId,
                    course_id: courseId,
                    sender_id: user.id,
                    content: content?.trim() || null,
                    media_url: mediaUrl,
                    media_type: mediaType,
                    is_question: !isInstructor,
                    parent_message_id: replyTo?.id || null,
                });

            if (error) throw error;

            setMessageText('');
            setReplyTo(null);

            if (!isInstructor && instructorId) {
                try {
                    const { data: instructorProfile } = await supabase
                        .from('profiles')
                        .select('push_token')
                        .eq('id', instructorId)
                        .single();

                    if (instructorProfile?.push_token) {
                        await sendPushNotification(
                            instructorProfile.push_token,
                            `${profile?.full_name || 'A student'} asked a question`,
                            content?.trim() || 'Sent a photo',
                            { type: 'lesson_qa', lesson_id: lessonId, course_id: courseId }
                        );
                    }
                } catch (pushErr) {
                    console.warn('Push notification skipped:', pushErr);
                }
            }

            if (isInstructor && replyTo?.sender_id) {
                try {
                    const { data: studentProfile } = await supabase
                        .from('profiles')
                        .select('push_token')
                        .eq('id', replyTo.sender_id)
                        .single();

                    if (studentProfile?.push_token) {
                        await sendPushNotification(
                            studentProfile.push_token,
                            'Instructor replied to your question!',
                            content?.trim() || 'Sent feedback',
                            { type: 'lesson_qa', lesson_id: lessonId, course_id: courseId }
                        );
                    }
                } catch (pushErr) {
                    console.warn('Push notification skipped:', pushErr);
                }
            }
        } catch (err: any) {
            showAlert('Error', err.message || 'Failed to send message', 'error');
        } finally {
            setSending(false);
        }
    };

    const pickImage = async () => {
        try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                showAlert('Permission Required', 'Please enable photo library access.', 'error');
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                allowsEditing: true,
                quality: 0.7,
                base64: true,
            });

            if (!result.canceled && result.assets[0]) {
                const asset = result.assets[0];
                await uploadAndSendImage(asset);
            }
        } catch (err) {
            console.error('Image picker error:', err);
        }
    };

    const takePhoto = async () => {
        try {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') {
                showAlert('Permission Required', 'Please enable camera access.', 'error');
                return;
            }

            const result = await ImagePicker.launchCameraAsync({
                allowsEditing: true,
                quality: 0.7,
                base64: true,
            });

            if (!result.canceled && result.assets[0]) {
                const asset = result.assets[0];
                await uploadAndSendImage(asset);
            }
        } catch (err) {
            console.error('Camera error:', err);
        }
    };

    const uploadAndSendImage = async (asset: ImagePicker.ImagePickerAsset) => {
        if (!user || !asset.base64) return;
        setImageUploading(true);
        try {
            const fileName = `${user.id}/${lessonId}/${Date.now()}.jpg`;
            const { error: uploadError } = await supabase.storage
                .from('lesson-qa-photos')
                .upload(fileName, decode(asset.base64), {
                    contentType: 'image/jpeg',
                    upsert: false,
                });

            let publicUrl: string;
            if (uploadError) {
                const fallbackFileName = `qa_${user.id}_${lessonId}_${Date.now()}.jpg`;
                const { error: fallbackError } = await supabase.storage
                    .from('homework-submissions')
                    .upload(fallbackFileName, decode(asset.base64), {
                        contentType: 'image/jpeg',
                        upsert: false,
                    });
                if (fallbackError) throw fallbackError;
                const { data: urlData } = supabase.storage
                    .from('homework-submissions')
                    .getPublicUrl(fallbackFileName);
                publicUrl = urlData.publicUrl;
            } else {
                const { data: urlData } = supabase.storage
                    .from('lesson-qa-photos')
                    .getPublicUrl(fileName);
                publicUrl = urlData.publicUrl;
            }

            await sendMessage(messageText.trim() || null, publicUrl, 'image');
        } catch (err: any) {
            showAlert('Upload Failed', err.message || 'Could not upload image', 'error');
        } finally {
            setImageUploading(false);
        }
    };

    const togglePin = async (messageId: string, currentlyPinned: boolean) => {
        if (!isInstructor) return;
        try {
            const { error } = await supabase
                .from('lesson_qa_messages')
                .update({ is_pinned: !currentlyPinned })
                .eq('id', messageId);

            if (error) throw error;
        } catch (err: any) {
            console.error('Toggle pin error:', err);
            showAlert('Error', err.message || 'Could not update pin status', 'error');
        }
    };

    return {
        messages,
        messageText,
        setMessageText,
        sending,
        loading,
        replyTo,
        setReplyTo,
        imageUploading,
        flatListRef,
        sendMessage,
        pickImage,
        takePhoto,
        togglePin,
        user,
        showModal,
        hideModal
    };
}


type QAMessageItemProps = {
    item: QAMessage;
    isOwn: boolean;
    isInstructorMsg: boolean;
    isInstructor: boolean;
    parentMsg: QAMessage | null;
    messages: QAMessage[];
    setReplyTo: (msg: QAMessage | null) => void;
    togglePin: (messageId: string, currentlyPinned: boolean) => void;
    showModal: any;
    hideModal: any;
};


function MessageSenderRow({ isInstructorMsg, senderName }: { isInstructorMsg: boolean, senderName: string }) {
    return (
        <View style={styles.senderRow}>
            <MerakiText variant="caption" color={isInstructorMsg ? colors.accent : '#F472B6'} style={{ fontWeight: '700' }}>
                {senderName}
            </MerakiText>
            {isInstructorMsg && (
                <View style={styles.instructorBadge}>
                    <MerakiText style={styles.instructorBadgeText}>Instructor</MerakiText>
                </View>
            )}
        </View>
    );
}

function MessageReplyContext({ parentMsg }: { parentMsg: QAMessage }) {
    return (
        <View style={styles.replyContext}>
            <View style={styles.replyBar} />
            <MerakiText variant="caption" color={colors.textMuted} numberOfLines={2}>
                {parentMsg.sender?.full_name}: {parentMsg.content || '📷 Photo'}
            </MerakiText>
        </View>
    );
}

function MessageContent({ item, isOwn }: { item: QAMessage, isOwn: boolean }) {
    return (
        <>
            {item.media_url && (
                <Image source={{ uri: item.media_url }} style={styles.messageImage} resizeMode="cover" />
            )}
            {item.content && (
                <MerakiText variant="body" color={isOwn ? '#FFF' : colors.text}>
                    {item.content}
                </MerakiText>
            )}
        </>
    );
}

function QAMessageItem({
    item,
    isOwn,
    isInstructorMsg,
    isInstructor,
    parentMsg,
    setReplyTo,
    togglePin,
    showModal,
    hideModal,
}: QAMessageItemProps) {
    return (
        <View style={[styles.messageContainer, isOwn && styles.messageContainerOwn]}>
            {item.is_pinned && (
                <View style={styles.pinnedBadge}>
                    <MaterialIcons name="push-pin" size={12} color={colors.accent} />
                    <MerakiText variant="caption" color={colors.accent}>Pinned</MerakiText>
                </View>
            )}
            <TouchableOpacity
                style={[
                    styles.messageBubble,
                    isOwn ? styles.bubbleOwn : styles.bubbleOther,
                    isInstructorMsg && !isOwn && styles.bubbleInstructor,
                    item.is_pinned && styles.bubblePinned,
                ]}
                onLongPress={() => {
                    if (isInstructor) {
                        showModal({
                            title: 'Message Actions',
                            hideCancel: true,
                            children: (
                                <View style={{ gap: 10, width: '100%', marginTop: 10 }}>
                                    <TouchableOpacity
                                        style={[styles.actionBtn, { backgroundColor: colors.accent }]}
                                        onPress={() => { hideModal(); togglePin(item.id, item.is_pinned); }}>
                                        <MerakiText style={styles.actionBtnText}>{item.is_pinned ? 'Unpin' : 'Pin'}</MerakiText>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.actionBtn, { backgroundColor: colors.surfaceLight }]}
                                        onPress={() => { hideModal(); setReplyTo(item); }}>
                                        <MerakiText style={[styles.actionBtnText, { color: colors.text }]}>Reply</MerakiText>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.actionBtn, { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border }]}
                                        onPress={hideModal}>
                                        <MerakiText style={[styles.actionBtnText, { color: colors.textSecondary }]}>Cancel</MerakiText>
                                    </TouchableOpacity>
                                </View>
                            )
                        });
                    } else {
                        setReplyTo(item);
                    }
                }}
                activeOpacity={0.8}
            >
                {!isOwn && (
                    <MessageSenderRow
                        isInstructorMsg={isInstructorMsg}
                        senderName={item.sender?.full_name || 'Anonymous'}
                    />
                )}

                {parentMsg && <MessageReplyContext parentMsg={parentMsg} />}

                <MessageContent item={item} isOwn={isOwn} />

                <MerakiText variant="caption" color={isOwn ? 'rgba(0, 0, 0, 0.40)' : colors.textMuted} style={styles.timestamp}>
                    {formatTime(item.created_at)}
                </MerakiText>
            </TouchableOpacity>
        </View>
    );
}


function QAPinnedMessages({ messages }: { messages: QAMessage[] }) {
    const pinned = messages.filter(m => m.is_pinned);
    if (pinned.length === 0) return null;

    return (
        <View style={styles.pinnedSection}>
            {pinned.map(msg => (
                <View key={msg.id} style={styles.pinnedItem}>
                    <MaterialIcons name="push-pin" size={14} color={colors.accent} />
                    <MerakiText variant="caption" color={colors.textSecondary} numberOfLines={2} style={{ flex: 1, marginLeft: 6 }}>
                        <MerakiText variant="caption" color={colors.accent}>{msg.sender?.full_name}: </MerakiText>
                        {msg.content || '📷 Photo'}
                    </MerakiText>
                </View>
            ))}
        </View>
    );
}

function QAEmptyState({ isInstructor }: { isInstructor: boolean }) {
    return (
        <View style={styles.emptyChat}>
            <MaterialCommunityIcons name="frequently-asked-questions" size={40} color={colors.textMuted} style={{ opacity: 0.3 }} />
            <MerakiText variant="bodyBold" color={colors.textSecondary} style={{ marginTop: spacing.md, textAlign: 'center' }}>
                {isInstructor
                    ? 'Student questions will appear here.'
                    : 'Have a question?'}
            </MerakiText>
            <MerakiText variant="body" color={colors.textMuted} style={{ marginTop: spacing.xs, textAlign: 'center', lineHeight: 20 }}>
                {isInstructor
                    ? "You'll be notified when a student submits a question."
                    : "Ask anything about this lesson — attach images if needed. We'll get back to you as soon as possible!"}
            </MerakiText>
        </View>
    );
}

function QAReplyBar({ replyTo, setReplyTo }: { replyTo: QAMessage, setReplyTo: (msg: QAMessage | null) => void }) {
    return (
        <View style={styles.replyBar2}>
            <View style={styles.replyContent}>
                <View style={styles.replyAccent} />
                <View style={{ flex: 1 }}>
                    <MerakiText variant="caption" color={colors.accent}>
                        Replying to {replyTo.sender?.full_name || 'message'}
                    </MerakiText>
                    <MerakiText variant="caption" color={colors.textMuted} numberOfLines={1}>
                        {replyTo.content || '📷 Photo'}
                    </MerakiText>
                </View>
            </View>
            <TouchableOpacity
                onPress={() => setReplyTo(null)}
                accessibilityRole="button"
                accessibilityLabel="Cancel reply"
                accessibilityHint="Cancels replying to the selected message"
            >
                <MaterialIcons name="close" size={18} color={colors.textMuted} />
            </TouchableOpacity>
        </View>
    );
}

function QAInputBar({
    isInstructor,
    messageText,
    setMessageText,
    sending,
    sendMessage,
    imageUploading,
    takePhoto,
    pickImage,
    showModal,
    hideModal
}: {
    isInstructor: boolean;
    messageText: string;
    setMessageText: (text: string) => void;
    sending: boolean;
    sendMessage: (content: string) => void;
    imageUploading: boolean;
    takePhoto: () => void;
    pickImage: () => void;
    showModal: any;
    hideModal: any;
}) {
    return (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.inputBar}>
                {/* Camera button */}
                <TouchableOpacity
                    style={styles.mediaBtn}
                    accessibilityRole="button"
                    accessibilityLabel="Upload photo"
                    accessibilityHint="Opens image picker to send a photo"
                    onPress={() => {
                        showModal({
                            title: 'Add Photo',
                            message: 'Choose a source',
                            hideCancel: true,
                            children: (
                                <View style={{ gap: 10, width: '100%', marginTop: 10 }}>
                                    <TouchableOpacity
                                        style={[styles.actionBtn, { backgroundColor: colors.accent }]}
                                        onPress={() => { hideModal(); takePhoto(); }}>
                                        <MerakiText style={styles.actionBtnText}>Camera</MerakiText>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.actionBtn, { backgroundColor: colors.surfaceLight }]}
                                        onPress={() => { hideModal(); pickImage(); }}>
                                        <MerakiText style={[styles.actionBtnText, { color: colors.text }]}>Gallery</MerakiText>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.actionBtn, { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border }]}
                                        onPress={hideModal}>
                                        <MerakiText style={[styles.actionBtnText, { color: colors.textSecondary }]}>Cancel</MerakiText>
                                    </TouchableOpacity>
                                </View>
                            )
                        });
                    }}
                    disabled={imageUploading}
                >
                    {imageUploading ? (
                        <ActivityIndicator size="small" color={colors.accent} />
                    ) : (
                        <MaterialIcons name="add-a-photo" size={20} color={colors.textSecondary} />
                    )}
                </TouchableOpacity>

                <TextInput
                    style={styles.textInput}
                    placeholder={isInstructor ? "Write your answer..." : "Type your question here..."}
                    placeholderTextColor={colors.textMuted}
                    value={messageText}
                    onChangeText={setMessageText}
                    multiline
                    maxLength={1000}
                />

                <TouchableOpacity
                    style={[styles.sendBtn, (!messageText.trim() || sending) && styles.sendBtnDisabled]}
                    onPress={() => sendMessage(messageText)}
                    disabled={!messageText.trim() || sending}
                    accessibilityRole="button"
                    accessibilityLabel="Send message"
                    accessibilityHint="Sends your typed message"
                >
                    {sending ? (
                        <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                        <MaterialIcons name="send" size={18} color="#FFF" />
                    )}
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}

export function LessonQAChat({ lessonId, courseId, instructorId, isInstructor, onScrollStateChange }: Props) {
    const {
        messages,
        messageText,
        setMessageText,
        sending,
        loading,
        replyTo,
        setReplyTo,
        imageUploading,
        flatListRef,
        sendMessage,
        pickImage,
        takePhoto,
        togglePin,
        user,
        showModal,
        hideModal
    } = useLessonQA({ lessonId, courseId, instructorId, isInstructor });

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator color={colors.accent} />
                <MerakiText variant="caption" color={colors.textMuted} style={{ marginTop: spacing.sm }}>
                    Loading Q&A...
                </MerakiText>
            </View>
        );
    }

    return (
        <Card variant="glass" style={styles.container} noPadding>
            {/* Header */}
            <View style={styles.qaHeader}>
                <MaterialCommunityIcons name="frequently-asked-questions" size={18} color={colors.accent} />
                <MerakiText variant="bodyBold" style={{ marginLeft: 8 }}>Q&A</MerakiText>
                <MerakiText variant="caption" color={colors.textMuted} style={{ marginLeft: 'auto' }}>
                    {messages.length} {messages.length === 1 ? 'message' : 'messages'}
                </MerakiText>
            </View>

            {/* Pinned Messages */}
            <QAPinnedMessages messages={messages} />

            {/* Messages List */}
            <ScrollView
                ref={flatListRef}
                contentContainerStyle={styles.messagesList}
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled={true}
                onTouchStart={() => onScrollStateChange?.(false)}
                onTouchEnd={() => onScrollStateChange?.(true)}
                onTouchCancel={() => onScrollStateChange?.(true)}
                onScrollBeginDrag={() => onScrollStateChange?.(false)}
                onScrollEndDrag={() => onScrollStateChange?.(true)}
                onMomentumScrollBegin={() => onScrollStateChange?.(false)}
                onMomentumScrollEnd={() => onScrollStateChange?.(true)}
                onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
            >
                {messages.length === 0 ? (
                    <QAEmptyState isInstructor={isInstructor} />
                ) : (
                    messages.map((item) => {
                        const isOwn = item.sender_id === user?.id;
                        const isInstructorMsg = item.sender?.role === 'owner' || item.sender_id === instructorId;
                        const parentMsg = item.parent_message_id
                            ? messages.find(m => m.id === item.parent_message_id) || null
                            : null;

                        return (
                            <QAMessageItem
                                key={item.id}
                                item={item}
                                isOwn={isOwn}
                                isInstructorMsg={isInstructorMsg}
                                isInstructor={isInstructor}
                                parentMsg={parentMsg}
                                messages={messages}
                                setReplyTo={setReplyTo}
                                togglePin={togglePin}
                                showModal={showModal}
                                hideModal={hideModal}
                            />
                        );
                    })
                )}
            </ScrollView>

            {/* Reply Bar */}
            {replyTo && (
                <QAReplyBar replyTo={replyTo} setReplyTo={setReplyTo} />
            )}

            {/* Input Bar */}
            <QAInputBar
                isInstructor={isInstructor}
                messageText={messageText}
                setMessageText={setMessageText}
                sending={sending}
                sendMessage={sendMessage}
                imageUploading={imageUploading}
                takePhoto={takePhoto}
                pickImage={pickImage}
                showModal={showModal}
                hideModal={hideModal}
            />
        </Card>
    );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;

    const hours = date.getHours().toString().padStart(2, '0');
    const mins = date.getMinutes().toString().padStart(2, '0');

    if (date.toDateString() === now.toDateString()) return `${hours}:${mins}`;
    return `${date.getDate()}/${date.getMonth() + 1} ${hours}:${mins}`;
}

async function sendPushNotification(
    pushToken: string,
    title: string,
    body: string,
    data: Record<string, string>
) {
    try {
        await supabase.functions.invoke('send-push-notification', { body: {
                to: pushToken,
                sound: 'default',
                title,
                body,
                data,
                channelId: 'messages',
            } });
    } catch (err) {
        console.error('Push notification send error:', err);
    }
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    container: {
        flex: 1,
        borderRadius: layout.borderRadius.xl,
        overflow: 'hidden',
        maxHeight: 500,
    },
    loadingContainer: {
        padding: spacing.xl,
        alignItems: 'center',
    },

    // Header
    qaHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm + 2,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0, 0, 0, 0.05)',
    },


    // Pinned
    pinnedSection: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0, 0, 0, 0.05)',
        backgroundColor: 'rgba(212,168,83,0.04)',
    },
    pinnedItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 4,
    },

    // Messages
    messagesList: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
    },
    messageContainer: {
        marginBottom: spacing.sm,
        maxWidth: '85%',
        alignSelf: 'flex-start',
    },
    messageContainerOwn: {
        alignSelf: 'flex-end',
    },
    messageBubble: {
        padding: spacing.sm + 2,
        borderRadius: layout.borderRadius.lg,
        maxWidth: '100%',
    },
    bubbleOwn: {
        backgroundColor: 'rgba(212,168,83,0.20)',
        borderBottomRightRadius: 4,
    },
    bubbleOther: {
        backgroundColor: 'rgba(0, 0, 0, 0.05)',
        borderBottomLeftRadius: 4,
    },
    bubbleInstructor: {
        backgroundColor: 'rgba(212,168,83,0.08)',
        borderWidth: 1,
        borderColor: 'rgba(212,168,83,0.15)',
    },
    bubblePinned: {
        borderWidth: 1,
        borderColor: 'rgba(212,168,83,0.25)',
    },

    senderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
        gap: 6,
    },
    instructorBadge: {
        backgroundColor: 'rgba(212,168,83,0.15)',
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 6,
    },
    instructorBadgeText: {
        fontSize: 9,
        fontWeight: '700' as any,
        color: colors.accent,
        textTransform: 'uppercase' as any,
        letterSpacing: 0.5,
    },

    replyContext: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 6,
        paddingLeft: 8,
    },
    replyBar: {
        width: 2,
        backgroundColor: colors.accent,
        marginRight: 8,
        borderRadius: 1,
        minHeight: 16,
    },

    messageImage: {
        width: width * 0.55,
        height: width * 0.55 * 0.75,
        borderRadius: layout.borderRadius.md,
        marginBottom: 6,
    },

    timestamp: { marginTop: 4, fontSize: 10 },

    pinnedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginBottom: 2,
    },

    // Reply bar
    replyBar2: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderTopWidth: 1,
        borderTopColor: 'rgba(0, 0, 0, 0.05)',
        backgroundColor: 'rgba(212,168,83,0.04)',
    },
    replyContent: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    replyAccent: {
        width: 3,
        height: '100%',
        backgroundColor: colors.accent,
        borderRadius: 2,
        marginRight: 8,
        minHeight: 30,
    },

    // Input
    inputBar: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.sm,
        borderTopWidth: 1,
        borderTopColor: 'rgba(0, 0, 0, 0.05)',
        gap: spacing.sm,
    },
    mediaBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(0, 0, 0, 0.05)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    actionBtn: {
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        borderRadius: layout.borderRadius.md,
        alignItems: 'center',
        justifyContent: 'center',
    },
    actionBtnText: {
        color: '#FFF',
        fontWeight: '700' as any,
    },
    textInput: {
        flex: 1,
        color: colors.text,
        fontSize: 14,
        maxHeight: 80,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        backgroundColor: 'rgba(0, 0, 0, 0.03)',
        borderRadius: layout.borderRadius.lg,
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.06)',
    },
    sendBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: colors.accent,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sendBtnDisabled: {
        opacity: 0.4,
    },

    // Empty
    emptyChat: {
        alignItems: 'center',
        paddingVertical: spacing.xl,
        paddingHorizontal: spacing.lg,
    },
});

export default LessonQAChat;
