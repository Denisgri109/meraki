import React, {
    createContext,
    useState,
    useEffect,
    useContext,
    useCallback,
    useMemo,
    useRef,
    ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

interface EditContextType {
    /** True while Visual Edit Mode is on (owner only). */
    isEditMode: boolean;
    /** True when the signed-in user is an owner. Only owners may edit content. */
    canEdit: boolean;
    /** Alias of canEdit, kept for readability at call sites that gate on role. */
    isOwner: boolean;
    /** Owner is browsing the client tab set instead of the owner tab set. */
    isClientView: boolean;
    toggleEditMode: () => void;
    setEditMode: (enabled: boolean) => void;
    /** Owners only: swap the app between the owner and client navigators. */
    setClientView: (enabled: boolean) => void;
    /** True until the first content fetch (or cache read) resolves. */
    loading: boolean;
    content: Record<string, string>;
    getContent: (key: string, fallback: string) => string;
    updateContent: (key: string, value: string) => Promise<{ error: string | null }>;
    /** Delete a single override so the built-in default applies again. */
    clearContent: (key: string) => Promise<{ error: string | null }>;
    refreshContent: () => Promise<void>;
    resetContent: (prefix?: string) => Promise<{ error: string | null }>;
}

const EditContext = createContext<EditContextType | undefined>(undefined);

/**
 * Caches the public site-content map so screens render owner copy instantly
 * and while offline. Content is world-readable under RLS — nothing sensitive
 * is persisted here. Failures are swallowed: the cache is an optimisation.
 */
async function persistContentCache(map: Record<string, string>) {
    try {
        await AsyncStorage.setItem('@meraki_site_content', JSON.stringify(map));
    } catch {
        // Best-effort only.
    }
}

async function readContentCache(): Promise<Record<string, string> | null> {
    try {
        const cached = await AsyncStorage.getItem('@meraki_site_content');
        if (!cached) return null;
        const parsed = JSON.parse(cached);
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
        return null;
    }
}

export function EditProvider({ children }: { children: ReactNode }) {
    const { profile, user } = useAuth();
    const isOwner = profile?.role === 'owner';

    const [isEditMode, setIsEditMode] = useState(false);
    const [isClientView, setIsClientView] = useState(false);
    const [loading, setLoading] = useState(true);
    const [content, setContent] = useState<Record<string, string>>({});

    // Editing rights follow the role, not which navigator is on screen: an
    // owner in Client View still needs the edit chrome to fix client copy.
    const canEdit = isOwner;

    // Keeps the latest map available to callbacks without re-creating them.
    const contentRef = useRef<Record<string, string>>({});
    useEffect(() => {
        contentRef.current = content;
    }, [content]);

    const applyContent = useCallback((map: Record<string, string>) => {
        setContent(map);
        persistContentCache(map);
    }, []);

    const fetchContent = useCallback(async () => {
        const { data, error } = await supabase.from('global_settings').select('key, value');

        if (error) {
            console.error('[EditContext] Error fetching content:', error);
            return;
        }

        const map: Record<string, string> = {};
        for (const row of data ?? []) {
            // Empty strings mean "no override" — skip them so fallbacks win.
            if (row.value !== null && row.value !== '') map[row.key] = row.value;
        }
        applyContent(map);
    }, [applyContent]);

    // Hydrate from cache first so custom copy shows instantly / offline,
    // then refresh from the network.
    useEffect(() => {
        let cancelled = false;

        (async () => {
            const cached = await readContentCache();
            if (!cancelled && cached) setContent(cached);

            await fetchContent();
            if (!cancelled) setLoading(false);
        })();

        return () => {
            cancelled = true;
        };
    }, [fetchContent]);

    // Live-sync edits made from the web dashboard (or another device).
    useEffect(() => {
        const channel = supabase
            .channel('global_settings_changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'global_settings' },
                () => {
                    fetchContent();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [fetchContent]);

    // Losing owner rights (logout, role change) must drop edit mode and
    // return the app to the navigator that matches the real role.
    useEffect(() => {
        if (!isOwner) {
            if (isEditMode) setIsEditMode(false);
            if (isClientView) setIsClientView(false);
        }
    }, [isOwner, isEditMode, isClientView]);

    const getContent = useCallback(
        (key: string, fallback: string) => {
            const value = content[key];
            return value === undefined || value === '' ? fallback : value;
        },
        [content]
    );

    const updateContent = useCallback(
        async (key: string, value: string) => {
            if (!user) return { error: 'Not authenticated' };
            if (!isOwner) return { error: 'Only owners can edit content' };

            const previous = contentRef.current[key];

            // Optimistic update.
            setContent((prev) => ({ ...prev, [key]: value }));

            const { error } = await supabase.from('global_settings').upsert(
                {
                    key,
                    value,
                    updated_by: user.id,
                    updated_at: new Date().toISOString(),
                },
                { onConflict: 'key' }
            );

            if (error) {
                console.error('[EditContext] Error saving:', error);
                // Roll back to the pre-save value so the UI never lies.
                setContent((prev) => {
                    const next = { ...prev };
                    if (previous === undefined) delete next[key];
                    else next[key] = previous;
                    return next;
                });
                return { error: error.message };
            }

            applyContent({ ...contentRef.current, [key]: value });
            return { error: null };
        },
        [user, isOwner, applyContent]
    );

    const clearContent = useCallback(
        async (key: string) => {
            if (!user) return { error: 'Not authenticated' };
            if (!isOwner) return { error: 'Only owners can reset content' };

            const previous = contentRef.current[key];
            if (previous === undefined) return { error: null };

            setContent((prev) => {
                const next = { ...prev };
                delete next[key];
                return next;
            });

            const { error } = await supabase.from('global_settings').delete().eq('key', key);

            if (error) {
                console.error('[EditContext] Error clearing content:', error);
                setContent((prev) => ({ ...prev, [key]: previous }));
                return { error: error.message };
            }

            const next = { ...contentRef.current };
            delete next[key];
            applyContent(next);
            return { error: null };
        },
        [user, isOwner, applyContent]
    );

    const toggleEditMode = useCallback(() => {
        if (canEdit) {
            setIsEditMode((prev) => !prev);
        }
    }, [canEdit]);

    const setEditMode = useCallback(
        (enabled: boolean) => {
            if (canEdit) setIsEditMode(enabled);
            else if (!enabled) setIsEditMode(false);
        },
        [canEdit]
    );

    const setClientView = useCallback(
        (enabled: boolean) => {
            if (!isOwner) return;
            setIsClientView(enabled);
        },
        [isOwner]
    );

    const refreshContent = useCallback(async () => {
        await fetchContent();
    }, [fetchContent]);

    const resetContent = useCallback(
        async (prefix = 'mobile.') => {
            if (!user) return { error: 'Not authenticated' };
            if (!isOwner) return { error: 'Only owners can reset content' };

            const keysToDelete = Object.keys(contentRef.current).filter((k) =>
                k.startsWith(prefix)
            );

            if (keysToDelete.length === 0) {
                return { error: null };
            }

            const snapshot = { ...contentRef.current };

            setContent((prev) => {
                const next = { ...prev };
                for (const k of keysToDelete) delete next[k];
                return next;
            });

            const { error } = await supabase
                .from('global_settings')
                .delete()
                .in('key', keysToDelete);

            if (error) {
                console.error('[EditContext] Error resetting content:', error);
                setContent(snapshot);
                return { error: error.message };
            }

            const next = { ...contentRef.current };
            for (const k of keysToDelete) delete next[k];
            applyContent(next);
            return { error: null };
        },
        [user, isOwner, applyContent]
    );

    const value = useMemo<EditContextType>(
        () => ({
            isEditMode,
            canEdit,
            isOwner,
            isClientView,
            toggleEditMode,
            setEditMode,
            setClientView,
            loading,
            content,
            getContent,
            updateContent,
            clearContent,
            refreshContent,
            resetContent,
        }),
        [
            isEditMode,
            canEdit,
            isOwner,
            isClientView,
            toggleEditMode,
            setEditMode,
            setClientView,
            loading,
            content,
            getContent,
            updateContent,
            clearContent,
            refreshContent,
            resetContent,
        ]
    );

    return <EditContext.Provider value={value}>{children}</EditContext.Provider>;
}

export function useEditMode() {
    const context = useContext(EditContext);
    if (context === undefined) {
        throw new Error('useEditMode must be used within an EditProvider');
    }
    return context;
}
