import React, { createContext, useState, useEffect, useContext, useCallback, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

interface EditContextType {
    isEditMode: boolean;
    canEdit: boolean;
    toggleEditMode: () => void;
    content: Record<string, string>;
    getContent: (key: string, fallback: string) => string;
    updateContent: (key: string, value: string) => Promise<{ error: string | null }>;
    refreshContent: () => Promise<void>;
    resetContent: (prefix?: string) => Promise<{ error: string | null }>;
}

const EditContext = createContext<EditContextType | undefined>(undefined);

export function EditProvider({ children }: { children: ReactNode }) {
    const { profile, user } = useAuth();
    const canEdit = profile?.role === 'owner';
    const [isEditMode, setIsEditMode] = useState(false);
    const [content, setContent] = useState<Record<string, string>>({});

    const fetchContent = useCallback(async () => {
        const { data, error } = await supabase
            .from('global_settings')
            .select('key, value');

        if (error) {
            console.error('[EditContext] Error fetching content:', error);
            return;
        }

        const map: Record<string, string> = {};
        for (const row of data ?? []) {
            map[row.key] = row.value;
        }
        setContent(map);
    }, []);

    useEffect(() => {
        fetchContent();
    }, [fetchContent]);

    useEffect(() => {
        if (!canEdit && isEditMode) {
            setIsEditMode(false);
        }
    }, [canEdit, isEditMode]);

    const getContent = useCallback(
        (key: string, fallback: string) => content[key] ?? fallback,
        [content]
    );

    const updateContent = useCallback(
        async (key: string, value: string) => {
            if (!user) return { error: 'Not authenticated' };
            if (!canEdit) return { error: 'Only owners can edit content' };

            setContent((prev) => ({ ...prev, [key]: value }));

            const { error } = await supabase
                .from('global_settings')
                .upsert(
                    { key, value, updated_by: user.id, updated_at: new Date().toISOString() },
                    { onConflict: 'key' }
                );

            if (error) {
                console.error('[EditContext] Error saving:', error);
                return { error: error.message };
            }

            return { error: null };
        },
        [user, canEdit]
    );

    const toggleEditMode = useCallback(() => {
        if (canEdit) {
            setIsEditMode((prev) => !prev);
        }
    }, [canEdit]);

    const refreshContent = useCallback(async () => {
        await fetchContent();
    }, [fetchContent]);

    const resetContent = useCallback(
        async (prefix = 'mobile.') => {
            if (!user) return { error: 'Not authenticated' };
            if (!canEdit) return { error: 'Only owners can reset content' };

            const keysToDelete = Object.keys(content).filter((k) => k.startsWith(prefix));

            if (keysToDelete.length === 0) {
                return { error: null };
            }

            setContent((prev) => {
                const next = { ...prev };
                for (const k of keysToDelete) delete next[k];
                return next;
            });

            const { error } = await supabase
                .from('global_settings')
                .delete()
                .filter('key', 'like', `${prefix}%`);

            if (error) {
                console.error('[EditContext] Error resetting content:', error);
                await fetchContent();
                return { error: error.message };
            }

            return { error: null };
        },
        [user, canEdit, content, fetchContent]
    );

    return (
        <EditContext.Provider
            value={{
                isEditMode,
                canEdit,
                toggleEditMode,
                content,
                getContent,
                updateContent,
                refreshContent,
                resetContent,
            }}
        >
            {children}
        </EditContext.Provider>
    );
}

export function useEditMode() {
    const context = useContext(EditContext);
    if (context === undefined) {
        throw new Error('useEditMode must be used within an EditProvider');
    }
    return context;
}
