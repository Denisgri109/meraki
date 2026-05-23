'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

// ─── Types ─────────────────────────────────────────────────────────────────
export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  created_at: string;
  appointment_id: string | null;
}

interface NotificationsContextValue {
  unreadMessages: number;
  notifications: NotificationItem[];
  unreadNotifications: number;
  refresh: () => Promise<void>;
  markNotificationsSeen: () => void;
}

const NotificationsContext = createContext<NotificationsContextValue | undefined>(undefined);

const SEEN_STORAGE_KEY = 'meraki:notifications:lastSeenAt';

function readLastSeen(userId: string | undefined): number {
  if (!userId || typeof window === 'undefined') return 0;
  try {
    const raw = window.localStorage.getItem(`${SEEN_STORAGE_KEY}:${userId}`);
    return raw ? Number(raw) || 0 : 0;
  } catch {
    return 0;
  }
}

function writeLastSeen(userId: string | undefined, ts: number) {
  if (!userId || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(`${SEEN_STORAGE_KEY}:${userId}`, String(ts));
  } catch {
    /* ignore quota errors */
  }
}

// ─── Provider ─────────────────────────────────────────────────────────────
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);
  const userId = user?.id;

  const [unreadMessages, setUnreadMessages] = useState(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  // `seenVersion` is bumped to force `lastSeen` recomputation when the user
  // marks notifications as seen. Avoids syncing storage<->state in an effect.
  const [seenVersion, setSeenVersion] = useState(0);
  // `seenVersion` is intentionally part of deps so the memo recomputes when
  // `markNotificationsSeen` writes a fresh timestamp to localStorage.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const lastSeen = useMemo(() => readLastSeen(userId), [userId, seenVersion]);

  // refs for realtime callbacks
  const conversationIdsRef = useRef<string[]>([]);
  const userIdRef = useRef<string | undefined>(userId);

  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);

  // ── Fetch unread message count ─────────────────────────────────────────
  const fetchUnread = useCallback(async () => {
    if (!userId) {
      setUnreadMessages(0);
      conversationIdsRef.current = [];
      return;
    }
    try {
      const { data: convs, error: convErr } = await supabase
        .from('conversations')
        .select('id')
        .or(`client_id.eq.${userId},master_id.eq.${userId}`);
      if (convErr) {
        console.warn('[Notifications] conversations error:', convErr.message);
        return;
      }
      const ids = ((convs as { id: string }[]) || []).map((c) => c.id);
      conversationIdsRef.current = ids;
      if (ids.length === 0) {
        setUnreadMessages(0);
        return;
      }
      const { count, error: msgErr } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .in('conversation_id', ids)
        .neq('sender_id', userId)
        .eq('is_read', false);
      if (msgErr) {
        console.warn('[Notifications] unread error:', msgErr.message);
        return;
      }
      setUnreadMessages(count || 0);
    } catch (err) {
      console.warn('[Notifications] fetchUnread failed:', err);
    }
  }, [supabase, userId]);

  // ── Fetch recent notifications ─────────────────────────────────────────
  const fetchNotifications = useCallback(async () => {
    if (!userId) {
      setNotifications([]);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('scheduled_notifications')
        .select('id, type, title, body, data, created_at, appointment_id')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) {
        console.warn('[Notifications] feed error:', error.message);
        return;
      }
      setNotifications((data as NotificationItem[]) || []);
    } catch (err) {
      console.warn('[Notifications] fetchNotifications failed:', err);
    }
  }, [supabase, userId]);

  const refresh = useCallback(async () => {
    await Promise.all([fetchUnread(), fetchNotifications()]);
  }, [fetchUnread, fetchNotifications]);

  // ── Initial + visibility refresh ───────────────────────────────────────
  // Re-fetch when user changes (login/logout/refresh). `refresh` is an
  // async data fetch so `setState` calls are inherent and expected.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [refresh]);

  // ── Realtime subscriptions ─────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;

    const messagesChannel = supabase
      .channel(`navbar-messages-${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const row = payload.new as { conversation_id?: string; sender_id?: string; is_read?: boolean } | null;
          if (!row || !row.conversation_id) return;
          if (!conversationIdsRef.current.includes(row.conversation_id)) {
            // unknown conversation — refresh list to discover it
            fetchUnread();
            return;
          }
          if (row.sender_id && row.sender_id !== userIdRef.current && !row.is_read) {
            setUnreadMessages((c) => c + 1);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages' },
        () => {
          // is_read flips happen here — easier to recompute
          fetchUnread();
        }
      )
      .subscribe();

    const notificationsChannel = supabase
      .channel(`navbar-notifications-${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'scheduled_notifications', filter: `user_id=eq.${userId}` },
        (payload) => {
          const row = payload.new as NotificationItem | null;
          if (!row) return;
          setNotifications((prev) => [row, ...prev].slice(0, 20));
        }
      )
      .subscribe();

    const conversationsChannel = supabase
      .channel(`navbar-conversations-${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'conversations' },
        () => {
          fetchUnread();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(notificationsChannel);
      supabase.removeChannel(conversationsChannel);
    };
  }, [supabase, userId, fetchUnread]);

  // ── Unread notifications derived count ────────────────────────────────
  const unreadNotifications = useMemo(() => {
    if (!notifications.length) return 0;
    return notifications.filter((n) => {
      const ts = n.created_at ? new Date(n.created_at).getTime() : 0;
      return ts > lastSeen;
    }).length;
  }, [notifications, lastSeen]);

  const markNotificationsSeen = useCallback(() => {
    const now = Date.now();
    writeLastSeen(userIdRef.current, now);
    // Bump version so `lastSeen` useMemo re-reads from storage.
    setSeenVersion((v) => v + 1);
  }, []);

  const value: NotificationsContextValue = {
    unreadMessages,
    notifications,
    unreadNotifications,
    refresh,
    markNotificationsSeen,
  };

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

// ─── Hook ──────────────────────────────────────────────────────────────────
// Returns a safe fallback when the provider is not mounted (e.g. on public
// marketing pages). This lets shared components such as `MainNavbar` use the
// hook without forcing every layout to wrap children in the provider.
const FALLBACK: NotificationsContextValue = {
  unreadMessages: 0,
  notifications: [],
  unreadNotifications: 0,
  refresh: async () => {},
  markNotificationsSeen: () => {},
};

export function useNotifications(): NotificationsContextValue {
  const ctx = useContext(NotificationsContext);
  return ctx ?? FALLBACK;
}
