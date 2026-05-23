'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/contexts/NotificationsContext';
import { createClient } from '@/lib/supabase/client';
import { MessageSquare, Send, Search, Smile, MoreVertical, Reply, Edit2, Trash2, X, Check, Paperclip, Loader2 } from 'lucide-react';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';
import imageCompression from 'browser-image-compression';
import { useToast } from '@/components/Toast';

interface Conversation {
  id: string;
  other_user_id: string;
  other_name: string;
  other_avatar_url: string | null;
  other_role: string;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
}

interface Message {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  edited_at: string | null;
  is_deleted: boolean | null;
  reply_to_id: string | null;
  is_read: boolean;
  media_type?: string | null;
  media_url?: string | null;
  reply_to?: {
    content: string | null;
    sender_id: string;
    media_type?: string | null;
  } | null;
}

interface ConversationData {
  id: string;
  client_id: string;
  master_id: string;
  last_message_at: string | null;
}

interface ProfileData {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string | null;
}

interface MessageData {
  conversation_id: string;
  content: string | null;
  created_at: string;
  media_type: string | null;
  sender_id: string;
  is_read: boolean;
}

export default function ChatPage() {
  const { user } = useAuth();
  const { refresh: refreshNotifications } = useNotifications();
  const supabase = createClient();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const activeConversationRef = useRef(activeConversation);
  const { showToast } = useToast();

  useEffect(() => {
    activeConversationRef.current = activeConversation;
  }, [activeConversation]);

  // Realtime messages subscription
  useEffect(() => {
    if (!user) return;
    
    const channel = supabase.channel('realtime_messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async (payload) => {
        const newMsg = payload.new as Message & { conversation_id: string, is_read: boolean };
        const isMine = newMsg.sender_id === user.id;

        // 1. Update sidebar first for immediate feedback
        setConversations(prev => {
          const updated = prev.map(c => {
            if (c.id === newMsg.conversation_id) {
              let displayMsg = newMsg.content;
              if (!displayMsg && newMsg.media_type) {
                displayMsg = newMsg.media_type === 'video' ? '🎥 Video' : '📷 Image';
              }
              const isActive = c.id === activeConversationRef.current;
              const bumpUnread = !isMine && !isActive;
              return {
                ...c,
                last_message: displayMsg || null,
                last_message_at: newMsg.created_at,
                unread_count: bumpUnread ? (c.unread_count || 0) + 1 : c.unread_count,
              };
            }
            return c;
          });
          return updated.sort((a, b) => new Date(b.last_message_at || 0).getTime() - new Date(a.last_message_at || 0).getTime());
        });

        // 2. Append to chat if the active conversation matches
        if (newMsg.conversation_id === activeConversationRef.current) {
          // If it's a reply, we need to enrich it with the reply_to data
          // Realtime payloads don't include joins.
          const enrichedMsg = { ...newMsg };
          if (newMsg.reply_to_id && !newMsg.reply_to) {
            const { data: replyData } = await supabase
              .from('messages')
              .select('content, sender_id, media_type')
              .eq('id', newMsg.reply_to_id)
              .single();
            if (replyData && replyData.sender_id) {
              enrichedMsg.reply_to = {
                content: replyData.content,
                sender_id: replyData.sender_id,
                media_type: replyData.media_type
              };
            }
          }

          setMessages((prev) => {
            if (prev.find(m => m.id === enrichedMsg.id)) {
              // If already there (e.g. from optimistic update), ensure it has the reply data
              return prev.map(m => m.id === enrichedMsg.id ? { ...m, ...enrichedMsg } : m);
            }
            return [...prev, enrichedMsg].sort((a, b) =>
              new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            );
          });

          setTimeout(() => {
            if (chatContainerRef.current) {
              chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
            }
          }, 100);

          if (!isMine && !newMsg.is_read) {
            supabase
              .rpc('mark_conversation_read', { p_conversation_id: newMsg.conversation_id })
              .then(() => refreshNotifications());
          }
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, (payload) => {
        const updated = payload.new as { id: string, conversation_id: string, content: string | null, edited_at: string | null, is_deleted: boolean | null };

        // Update message in current chat (edits + deletes)
        if (updated.conversation_id === activeConversationRef.current) {
          setMessages((prev) =>
            prev.map(m => m.id === updated.id ? { ...m, content: updated.content || '', edited_at: updated.edited_at, is_deleted: updated.is_deleted } : m)
          );
        }

        // Update sidebar last_message if deleted
        if (updated.is_deleted) {
          setConversations(prev =>
            prev.map(c => {
              if (c.id === updated.conversation_id && c.last_message === updated.content) {
                return { ...c, last_message: 'Message deleted' };
              }
              return c;
            })
          );
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, supabase]);

  const fetchConversations = useCallback(async () => {
    if (!user) return;
    try {
      const { data: conversationsData, error } = await supabase
        .from('conversations')
        .select('*')
        .or(`client_id.eq.${user.id},master_id.eq.${user.id}`)
        .order('last_message_at', { ascending: false })
        .limit(30);
        
      if (error || !conversationsData) {
        setLoading(false);
        return;
      }

      const otherUserIds = Array.from(new Set((conversationsData as ConversationData[]).map((c: ConversationData) =>
        c.client_id === user.id ? c.master_id : c.client_id
      ).filter(Boolean)));

      let profilesData: ProfileData[] = [];
      if (otherUserIds.length > 0) {
        const { data } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url, role')
          .in('id', otherUserIds);
        if (data) profilesData = data;
      }

      let messagesData: MessageData[] = [];
      if (conversationsData.length > 0) {
        const { data } = await supabase
          .from('messages')
          .select('conversation_id, content, created_at, media_type, sender_id, is_read')
          .in('conversation_id', conversationsData.map(c => c.id))
          .order('created_at', { ascending: false });
        if (data) messagesData = data as MessageData[];
      }

      // Per-conversation unread count: messages from others that are not yet read
      const unreadByConv: Record<string, number> = {};
      for (const m of messagesData) {
        if (m.sender_id !== user.id && !m.is_read) {
          unreadByConv[m.conversation_id] = (unreadByConv[m.conversation_id] || 0) + 1;
        }
      }

      const profilesMap = new Map<string, any>(profilesData.map(p => [p.id, p]));
      const messagesMap = new Map<string, any>();
      for (const m of messagesData) {
        if (!messagesMap.has(m.conversation_id)) {
          messagesMap.set(m.conversation_id, m);
        }
      }

      const convos: Conversation[] = (conversationsData as ConversationData[]).map((c: ConversationData) => {
        const otherId = c.client_id === user.id ? c.master_id : c.client_id;
        const profile = profilesMap.get(otherId);
        const lastMsg = messagesMap.get(c.id);
        
        let displayMsg = lastMsg?.content;
        if (!displayMsg && lastMsg?.media_type) {
          displayMsg = lastMsg.media_type === 'video' ? '🎥 Video' : '📷 Image';
        }

        return {
          id: c.id as string,
          other_user_id: otherId as string,
          other_name: (profile?.full_name as string) || 'User',
          other_avatar_url: profile?.avatar_url || null,
          other_role: profile?.role || 'client',
          last_message: displayMsg || null,
          last_message_at: (c.last_message_at as string) || null,
          unread_count: unreadByConv[c.id] || 0,
        };
      });
      setConversations(convos);
    } catch (err) {
      console.error('Failed to fetch conversations:', err);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Initial fetch
  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Support direct chat redirect from appointments page
  useEffect(() => {
    const convoId = localStorage.getItem('meraki_active_chat_convo_id');
    if (convoId && conversations.some(c => c.id === convoId)) {
      setActiveConversation(convoId);
      localStorage.removeItem('meraki_active_chat_convo_id');
    }
  }, [conversations]);

  // Re-fetch conversations when tab becomes visible after being backgrounded
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchConversations();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [fetchConversations]);

  useEffect(() => {
    if (!activeConversation || !user) return;
    const fetchMessages = async () => {
      const { data } = await supabase
        .from('messages')
        .select(`
          id, sender_id, content, created_at, edited_at, is_deleted, reply_to_id, is_read,
          media_type, media_url,
          reply_to:reply_to_id(content, sender_id, media_type)
        `)
        .eq('conversation_id', activeConversation)
        .order('created_at', { ascending: true })
        .limit(100);
      setMessages((data as unknown as Message[]) || []);
      setTimeout(() => {
        if (chatContainerRef.current) {
          chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
      }, 100);
    };

    // Mark all unread messages from the other side as read when opening the conversation.
    // RLS only lets the sender update a message, so we go through a SECURITY DEFINER
    // RPC that validates participant membership and flips is_read/read_at server-side.
    const markAsRead = async () => {
      const { error } = await supabase.rpc('mark_conversation_read', {
        p_conversation_id: activeConversation,
      });
      if (error) {
        console.warn('[Chat] markAsRead error:', error.message);
        return;
      }
      // Optimistically clear the unread badge for this conversation
      setConversations((prev) =>
        prev.map((c) => (c.id === activeConversation ? { ...c, unread_count: 0 } : c)),
      );
      // Refresh the navbar badge
      refreshNotifications();
    };

    fetchMessages();
    markAsRead();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConversation, user]);

  // Close menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.message-menu')) {
        setOpenMenuId(null);
      }
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node) && !target.closest('.emoji-toggle-btn')) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const handleDelete = async (msgId: string) => {
    const { error } = await supabase
      .from('messages')
      .update({ is_deleted: true })
      .eq('id', msgId);
    if (!error) {
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, is_deleted: true } : m));
      showToast('Message deleted', 'success');
    }
    setOpenMenuId(null);
  };

  const startEdit = (msg: Message) => {
    setEditingMessageId(msg.id);
    setEditContent(msg.content);
    setOpenMenuId(null);
  };

  const cancelEdit = () => {
    setEditingMessageId(null);
    setEditContent('');
  };

  const saveEdit = async () => {
    if (!editContent.trim() || !editingMessageId) return;
    const { error } = await supabase
      .from('messages')
      .update({ content: editContent.trim(), edited_at: new Date().toISOString() })
      .eq('id', editingMessageId);
    if (!error) {
      setMessages(prev => prev.map(m => m.id === editingMessageId ? { ...m, content: editContent.trim(), edited_at: new Date().toISOString() } : m));
      showToast('Message edited', 'success');
    }
    setEditingMessageId(null);
    setEditContent('');
  };

  const startReply = (msg: Message) => {
    setReplyingTo(msg);
    setOpenMenuId(null);
  };

  const cancelReply = () => {
    setReplyingTo(null);
  };

  const onEmojiClick = (emojiData: EmojiClickData) => {
    setNewMessage((prev) => prev + emojiData.emoji);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !activeConversation || !user) return;
    
    if (fileInputRef.current) fileInputRef.current.value = '';
    
    setUploadingMedia(true);
    try {
      let finalFile: File | Blob = file;
      
      const isVideo = file.type.startsWith('video/');
      if (isVideo) {
        if (file.size > 50 * 1024 * 1024) {
          showToast('Video exceeds 50MB limit', 'error');
          setUploadingMedia(false);
          return;
        }
      } else if (file.type.startsWith('image/')) {
        const options = {
          maxSizeMB: 1,
          maxWidthOrHeight: 1920,
          useWebWorker: true,
        };
        finalFile = await imageCompression(file, options);
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${crypto.randomUUID()}-${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('chat_media')
        .upload(filePath, finalFile);

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from('chat_media')
        .getPublicUrl(filePath);

      const { data: insertedMsg, error: insertError } = await supabase
        .from('messages')
        .insert({
          conversation_id: activeConversation,
          sender_id: user.id,
          content: null,
          media_url: publicUrlData.publicUrl,
          media_type: isVideo ? 'video' : 'image',
          reply_to_id: replyingTo?.id || null,
        })
        .select('*, reply_to:reply_to_id(content, sender_id, media_type)')
        .single();

      if (insertError) throw insertError;

      // Optimistically update messages if not already added by realtime
      if (insertedMsg && insertedMsg.id) {
        const msgToState = insertedMsg as unknown as Message;
        setMessages(prev => {
          if (prev.find(m => m.id === msgToState.id)) return prev;
          const newMessages = [...prev, msgToState].sort((a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );
          return newMessages;
        });

        setTimeout(() => {
          if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
          }
        }, 100);
      }

      await supabase.from('conversations').update({
        last_message_at: new Date().toISOString()
      }).eq('id', activeConversation);
      
      setReplyingTo(null);
    } catch (error) {
      console.error('Upload error:', error);
      showToast('Failed to upload media', 'error');
    } finally {
      setUploadingMedia(false);
    }
  };

  const handleSend = async () => {
    if (!newMessage.trim() || !activeConversation || !user) return;
    const content = newMessage.trim();
    const replyToId = replyingTo?.id || null;
    setNewMessage('');
    setReplyingTo(null);

    const { data: insertedMsg, error: insertError } = await supabase
      .from('messages')
      .insert({
        conversation_id: activeConversation,
        sender_id: user.id,
        content,
        reply_to_id: replyToId,
      })
      .select('*, reply_to:reply_to_id(content, sender_id, media_type)')
      .single();

    if (!insertError && insertedMsg && insertedMsg.id) {
      const msgToState = insertedMsg as unknown as Message;
      setMessages(prev => {
        if (prev.find(m => m.id === msgToState.id)) return prev;
        const newMessages = [...prev, msgToState].sort((a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        return newMessages;
      });

      setTimeout(() => {
        if (chatContainerRef.current) {
          chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
      }, 100);
    }

    await supabase.from('conversations').update({
      last_message_at: new Date().toISOString()
    }).eq('id', activeConversation);
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  };

  // Smart label for the inbox: today => HH:MM, yesterday => "Yesterday",
  // this week => weekday, otherwise => DD/MM/YY.
  const formatInboxTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    if (sameDay) return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    const weekMs = 6 * 24 * 60 * 60 * 1000;
    if (now.getTime() - d.getTime() < weekMs) return d.toLocaleDateString('en-GB', { weekday: 'short' });
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' });
  };

  // Day-separator label: Today / Yesterday / DD MMM YYYY
  const formatDayLabel = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return 'Today';
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const activeConvo = conversations.find((c) => c.id === activeConversation);
  const totalUnread = conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0);

  return (
    <div className="max-w-6xl mx-auto animate-fade-in h-[calc(100vh-7rem)]">
      <div className="flex gap-4 h-full">

        {/* ── Sidebar ─────────────────────────────────────────────── */}
        <div className="w-80 shrink-0 flex flex-col rounded-2xl overflow-hidden shadow-[var(--shadow-elevated)] border border-[var(--color-border-light)] bg-white/90 backdrop-blur-xl">
          {/* Sidebar header */}
          <div className="px-5 pt-5 pb-4 border-b border-[var(--color-border-light)]">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-bold text-[var(--color-text-primary)] tracking-tight">Messages</h2>
              {totalUnread > 0 ? (
                <span className="text-[10px] font-bold text-white bg-gradient-to-r from-[var(--color-brand-pink)] to-[var(--color-secondary)] px-2 py-0.5 rounded-full shadow-sm">
                  {totalUnread > 99 ? '99+' : totalUnread} new
                </span>
              ) : (
                <span className="text-[10px] font-medium text-[var(--color-text-muted)] bg-[var(--color-surface-light)] px-2 py-0.5 rounded-full">
                  {conversations.length}
                </span>
              )}
            </div>
            <p className="text-xs text-[var(--color-text-muted)] mb-3">
              {totalUnread > 0 ? `${totalUnread} unread message${totalUnread === 1 ? '' : 's'}` : 'All caught up'}
            </p>
            <div className="relative">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
              <input
                type="text"
                placeholder="Search conversations..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-[var(--color-surface-light)] rounded-xl pl-9 pr-4 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--color-brand-pink)]/30 transition-all placeholder:text-[var(--color-text-muted)]"
              />
            </div>
          </div>

          {/* Conversation list */}
          <div className="flex-1 overflow-y-auto py-2">
            {loading ? (
              <div className="p-4 space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex gap-3 px-3 animate-pulse">
                    <div className="w-10 h-10 rounded-full bg-[var(--color-surface-light)] shrink-0" />
                    <div className="flex-1 pt-1">
                      <div className="h-2.5 bg-[var(--color-surface-light)] rounded-full w-2/3 mb-2" />
                      <div className="h-2 bg-[var(--color-surface-light)] rounded-full w-full" />
                    </div>
                  </div>
                ))}
              </div>
            ) : conversations.length === 0 ? (
              <div className="p-8 text-center">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[var(--color-brand-pink-light)] to-[var(--color-lavender)] flex items-center justify-center mx-auto mb-3">
                  <MessageSquare size={24} className="text-[var(--color-brand-pink-dark)]" />
                </div>
                <p className="text-sm font-medium text-[var(--color-text-secondary)]">No conversations yet</p>
                <p className="text-xs text-[var(--color-text-muted)] mt-1">Book a service to start chatting</p>
              </div>
            ) : (
              conversations
                .filter((c) => !search || c.other_name.toLowerCase().includes(search.toLowerCase()))
                .map((convo) => {
                  const isActive = activeConversation === convo.id;
                  const hasUnread = (convo.unread_count || 0) > 0 && !isActive;
                  return (
                    <button
                      key={convo.id}
                      data-row-id={convo.id}
                      onClick={() => setActiveConversation(convo.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 transition-all cursor-pointer text-left relative ${
                        isActive
                          ? 'bg-gradient-to-r from-[var(--color-brand-pink-light)] to-[var(--color-lavender)]/60'
                          : 'hover:bg-[var(--color-surface-light)]'
                      }`}
                    >
                      {isActive && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-8 bg-gradient-to-b from-[var(--color-brand-pink)] to-[var(--color-secondary)] rounded-r-full" />
                      )}
                      <div className="relative shrink-0">
                        <div className={`w-11 h-11 rounded-full flex items-center justify-center font-semibold text-sm shadow-sm ring-1 ring-white overflow-hidden ${
                          isActive
                            ? 'bg-gradient-to-br from-[var(--color-brand-pink)] to-[var(--color-secondary)] text-white'
                            : 'bg-gradient-to-br from-[var(--color-brand-pink-light)] to-[var(--color-lavender)] text-[var(--color-brand-pink-dark)]'
                        }`}>
                          {convo.other_avatar_url ? (
                            <img src={convo.other_avatar_url} alt={convo.other_name} className="w-full h-full object-cover" />
                          ) : (
                            convo.other_name.charAt(0).toUpperCase()
                          )}
                        </div>
                        {hasUnread && (
                          <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-[var(--color-brand-pink)] border-2 border-white" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <p className={`text-sm truncate text-[var(--color-text-primary)] ${hasUnread ? 'font-bold' : 'font-medium'}`}>
                              {convo.other_name}
                            </p>
                            <span className={`shrink-0 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${
                              convo.other_role === 'master' ? 'bg-purple-100 text-purple-600' :
                              convo.other_role === 'owner' ? 'bg-amber-100 text-amber-700' :
                              'bg-blue-50 text-blue-500'
                            }`}>
                              {convo.other_role === 'master' ? 'Pro' : convo.other_role === 'owner' ? 'Owner' : 'Client'}
                            </span>
                          </div>
                          {convo.last_message_at && (
                            <span className={`text-[10px] shrink-0 ${hasUnread ? 'text-[var(--color-brand-pink-dark)] font-semibold' : 'text-[var(--color-text-muted)]'}`}>
                              {formatInboxTime(convo.last_message_at)}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between gap-2 mt-0.5">
                          <p className={`text-xs truncate ${hasUnread ? 'text-[var(--color-text-primary)] font-medium' : 'text-[var(--color-text-muted)]'}`}>
                            {convo.last_message || 'No messages yet'}
                          </p>
                          {hasUnread && (
                            <span className="text-[10px] font-bold text-white bg-[var(--color-brand-pink)] min-w-[18px] h-[18px] px-1.5 rounded-full flex items-center justify-center shrink-0">
                              {convo.unread_count > 99 ? '99+' : convo.unread_count}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })
            )}
          </div>
        </div>

        {/* ── Chat Area ────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col rounded-2xl overflow-hidden shadow-[var(--shadow-elevated)] border border-[var(--color-border-light)] bg-white/90 backdrop-blur-xl">
          {!activeConversation ? (
            <div className="flex-1 flex items-center justify-center text-center p-8">
              <div>
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[var(--color-brand-pink-light)] to-[var(--color-lavender)] flex items-center justify-center mx-auto mb-4 shadow-[var(--shadow-pink)]">
                  <MessageSquare size={32} className="text-[var(--color-brand-pink-dark)]" />
                </div>
                <h3 className="text-base font-semibold text-[var(--color-text-primary)]">Your Messages</h3>
                <p className="text-sm text-[var(--color-text-muted)] mt-1.5 max-w-[200px] mx-auto">Select a conversation from the left to get started</p>
              </div>
            </div>
          ) : (
            <>
              {/* Chat Header */}
              <div className="h-16 px-5 flex items-center justify-between border-b border-[var(--color-border-light)] bg-white/70 backdrop-blur-sm shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--color-brand-pink)] to-[var(--color-secondary)] flex items-center justify-center text-white font-semibold text-sm shadow-[0_4px_12px_rgba(236,153,182,0.3)] ring-2 ring-white overflow-hidden">
                    {activeConvo?.other_avatar_url ? (
                      <img src={activeConvo.other_avatar_url} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      activeConvo?.other_name.charAt(0).toUpperCase() || '?'
                    )}
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-[var(--color-text-primary)] leading-tight">
                      {activeConvo?.other_name || 'User'}
                    </p>
                    <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5 flex items-center gap-1.5">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                      {activeConvo?.other_role === 'master' ? 'Client ↔ Master' : activeConvo?.other_role === 'owner' ? 'Client ↔ Owner' : activeConvo?.other_role === 'client' ? 'Master ↔ Client' : 'Direct message'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Messages area */}
              <div
                ref={chatContainerRef}
                className="flex-1 overflow-y-auto px-5 py-4 space-y-2.5"
                style={{ background: 'linear-gradient(180deg, #fafafa 0%, #f6f4f8 100%)' }}
              >
                {messages.map((msg, idx) => {
                  const isMine = msg.sender_id === user?.id;
                  const isEditing = editingMessageId === msg.id;
                  const prev = idx > 0 ? messages[idx - 1] : null;
                  const next = idx < messages.length - 1 ? messages[idx + 1] : null;
                  const showDaySeparator =
                    !prev || new Date(prev.created_at).toDateString() !== new Date(msg.created_at).toDateString();
                  
                  const isGrouped = !showDaySeparator && prev && prev.sender_id === msg.sender_id && (new Date(msg.created_at).getTime() - new Date(prev.created_at).getTime() < 2 * 60 * 1000);
                  const isLastInGroup = !next || next.sender_id !== msg.sender_id || (new Date(next.created_at).getTime() - new Date(msg.created_at).getTime() >= 2 * 60 * 1000) || (new Date(next.created_at).toDateString() !== new Date(msg.created_at).toDateString());

                  return (
                    <div key={msg.id}>
                      {showDaySeparator && (
                        <div className="flex items-center justify-center my-3">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)] bg-white/70 backdrop-blur-sm border border-[var(--color-border-light)] px-3 py-1 rounded-full shadow-sm">
                            {formatDayLabel(msg.created_at)}
                          </span>
                        </div>
                      )}
                      <div className={`flex ${isMine ? 'justify-end' : 'justify-start'} group ${isGrouped ? 'msg-grouped' : 'mt-2.5'}`}>
                      <div className={`flex items-end gap-1.5 max-w-[68%] ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>

                        {/* Avatar (friend only) */}
                        {!isMine && (
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white font-semibold text-[11px] shrink-0 mb-0.5 shadow-sm overflow-hidden ${isLastInGroup ? 'bg-gradient-to-br from-[var(--color-brand-pink)] to-[var(--color-secondary)]' : 'bg-transparent shadow-none'}`}>
                            {isLastInGroup && (
                              activeConvo?.other_avatar_url ? (
                                <img src={activeConvo.other_avatar_url} alt="Profile" className="w-full h-full object-cover" />
                              ) : (
                                activeConvo?.other_name.charAt(0).toUpperCase() || '?'
                              )
                            )}
                          </div>
                        )}

                        {/* 3-dot menu */}
                        {!msg.is_deleted && !isEditing && (
                          <div className={`message-menu relative opacity-0 group-hover:opacity-100 transition-opacity self-center mb-1 ${isMine ? 'order-first' : 'order-last'}`}>
                            <button
                              onClick={() => setOpenMenuId(openMenuId === msg.id ? null : msg.id)}
                              className="p-1 rounded-full hover:bg-black/5 transition-colors"
                            >
                              <MoreVertical size={14} className={`text-[var(--color-text-muted)] ${!isMine ? 'opacity-50' : ''}`} />
                            </button>
                            {openMenuId === msg.id && (
                              <div className={`absolute ${isMine ? 'right-full mr-1' : 'left-full ml-1'} top-1/2 -translate-y-1/2 w-36 bg-white border border-[var(--color-border-light)] rounded-xl shadow-[var(--shadow-elevated)] z-10 py-1 overflow-hidden`}>
                                <button
                                  onClick={() => startReply(msg)}
                                  className="w-full px-3 py-2 text-left text-sm hover:bg-[var(--color-surface-light)] flex items-center gap-2 text-[var(--color-text-secondary)]"
                                >
                                  <Reply size={13} /> Reply
                                </button>
                                {isMine && (
                                  <>
                                    <button
                                      onClick={() => startEdit(msg)}
                                      disabled={msg.is_deleted || false}
                                      className="w-full px-3 py-2 text-left text-sm hover:bg-[var(--color-surface-light)] flex items-center gap-2 disabled:opacity-40 text-[var(--color-text-secondary)]"
                                    >
                                      <Edit2 size={13} /> Edit
                                    </button>
                                    <div className="my-1 border-t border-[var(--color-border-light)]" />
                                    <button
                                      onClick={() => handleDelete(msg.id)}
                                      className="w-full px-3 py-2 text-left text-sm hover:bg-red-50 text-red-500 flex items-center gap-2"
                                    >
                                      <Trash2 size={13} /> Delete
                                    </button>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Bubble */}
                        <div
                          className={`px-4 py-2.5 text-sm shadow-sm ${
                            isMine
                              ? `bg-gradient-to-br from-[#2C3E50] to-[#3D5166] text-white rounded-2xl shadow-[0_4px_14px_rgba(44,62,80,0.25)] ${!isLastInGroup ? 'msg-grouped-radius-mine' : 'rounded-br-sm'}`
                              : `bg-gradient-to-br from-[#EDE7F6] to-[#E8EAF6] text-[var(--color-text-primary)] rounded-2xl border border-[#D1C4E9]/40 ${!isLastInGroup ? 'msg-grouped-radius-other' : 'rounded-bl-sm'}`
                          } ${isEditing ? 'min-w-[200px]' : ''}`}
                        >
                          {/* Reply preview inside bubble */}
                          {msg.reply_to && (
                            <div className={`text-xs mb-2 pb-2 border-b ${isMine ? 'border-white/20' : 'border-[#B39DDB]/30'}`}>
                              <p className={`flex items-center gap-1 ${isMine ? 'text-white/70' : 'text-[#7E57C2]'}`}>
                                <Reply size={10} className="shrink-0" />
                                {msg.reply_to.sender_id === user?.id ? 'You' : activeConvo?.other_name.split(' ')[0]}: {msg.reply_to.content ? (
                                  <>
                                    {msg.reply_to.content.slice(0, 50)}
                                    {msg.reply_to.content.length > 50 ? '…' : ''}
                                  </>
                                ) : msg.reply_to.media_type === 'video' ? '🎥 Video' : '📷 Image'}
                              </p>
                            </div>
                          )}

                          {isEditing ? (
                            <div className="space-y-2">
                              <input
                                type="text"
                                value={editContent}
                                onChange={(e) => setEditContent(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') saveEdit();
                                  if (e.key === 'Escape') cancelEdit();
                                }}
                                autoFocus
                                className="w-full bg-white/20 rounded-lg px-2 py-1 text-sm outline-none"
                              />
                              <div className="flex gap-2">
                                <button onClick={saveEdit} className="p-1 hover:bg-white/20 rounded-md">
                                  <Check size={13} />
                                </button>
                                <button onClick={cancelEdit} className="p-1 hover:bg-white/20 rounded-md">
                                  <X size={13} />
                                </button>
                              </div>
                            </div>
                          ) : msg.is_deleted ? (
                            <p className="italic opacity-50 text-xs text-center py-0.5">
                              Message deleted
                            </p>
                          ) : (
                            <>
                              {msg.media_url && (
                                <div className={`mb-1.5 overflow-hidden rounded-xl ${msg.content ? '' : 'mb-0'}`}>
                                  {msg.media_type === 'video' ? (
                                    <video src={msg.media_url} controls className="max-w-full sm:max-w-xs object-cover" />
                                  ) : (
                                    <img src={msg.media_url} alt="Shared median" className="max-w-full sm:max-w-xs object-cover" />
                                  )}
                                </div>
                              )}
                              {msg.content && (
                                <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                              )}
                              <div className={`text-[10px] mt-1.5 flex items-center justify-end gap-1 ${isMine ? 'text-white/50' : 'text-[#9E9E9E]'}`}>
                                <span>{formatTime(msg.created_at)}</span>
                                {msg.edited_at && <span className="opacity-75">· edited</span>}
                                {isMine && (
                                  <span className="msg-status-check">
                                    {msg.is_read ? (
                                      <div className="flex -space-x-1">
                                        <Check size={11} className="msg-status-read" />
                                        <Check size={11} className="msg-status-read" />
                                      </div>
                                    ) : (
                                      <Check size={11} className="msg-status-sent" />
                                    )}
                                  </span>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Input bar */}
              <div className="px-4 py-3 border-t border-[var(--color-border-light)] bg-white/80 backdrop-blur-sm shrink-0">
                {/* Reply banner */}
                {replyingTo && (
                  <div className="flex items-center gap-2 mb-2.5 px-3 py-2 bg-[var(--color-lavender)]/40 border border-[#D1C4E9]/50 rounded-xl">
                    <Reply size={13} className="text-[#7E57C2] shrink-0" />
                    <span className="text-xs text-[#5C6BC0] truncate flex-1 font-medium">
                      {replyingTo.content ? (
                        <>
                          {replyingTo.content.slice(0, 60)}{replyingTo.content.length > 60 ? '…' : ''}
                        </>
                      ) : replyingTo.media_type === 'video' ? '🎥 Video' : '📷 Image'}
                    </span>
                    <button onClick={cancelReply} className="p-0.5 hover:bg-[#D1C4E9]/40 rounded-md transition-colors">
                      <X size={13} className="text-[var(--color-text-muted)]" />
                    </button>
                  </div>
                )}
                <div className="flex items-center gap-2 relative">
                  {showEmojiPicker && (
                    <div ref={emojiPickerRef} className="absolute bottom-full left-0 mb-3 z-50 shadow-2xl rounded-xl custom-emoji-picker-container">
                      <EmojiPicker 
                        onEmojiClick={onEmojiClick} 
                        lazyLoadEmojis
                      />
                    </div>
                  )}
                  <button
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    className="emoji-toggle-btn w-9 h-9 flex items-center justify-center rounded-full hover:bg-[var(--color-surface-light)] transition-colors text-[var(--color-text-muted)] hover:text-[var(--color-brand-pink-dark)] cursor-pointer shrink-0"
                  >
                    <Smile size={18} />
                  </button>
                  
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*,video/*"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingMedia}
                    className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-[var(--color-surface-light)] transition-colors text-[var(--color-text-muted)] hover:text-[var(--color-brand-pink-dark)] cursor-pointer shrink-0"
                  >
                    {uploadingMedia ? <Loader2 size={18} className="animate-spin text-[var(--color-brand-pink)]" /> : <Paperclip size={18} />}
                  </button>
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder={replyingTo ? "Type your reply…" : "Type a message…"}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    className="flex-1 bg-[var(--color-surface-light)] rounded-full px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--color-brand-pink)]/25 transition-all placeholder:text-[var(--color-text-muted)]"
                  />
                  <button
                    onClick={handleSend}
                    disabled={!newMessage.trim()}
                    className="w-9 h-9 flex items-center justify-center rounded-full bg-gradient-to-br from-[var(--color-brand-pink)] to-[var(--color-secondary)] text-white hover:opacity-90 transition-all disabled:opacity-30 cursor-pointer shrink-0 shadow-sm"
                  >
                    <Send size={15} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
