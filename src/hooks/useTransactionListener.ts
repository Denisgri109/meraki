import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { RealtimeChannel } from '@supabase/supabase-js';

// ============================================================================
// useTransactionListener
// Subscribes to Supabase Realtime changes on the transactions table,
// filtered by the current user ID, and fires a callback when a transaction
// transitions to 'completed'. Used by ScanToPayScreen to show instant
// payment confirmation without polling.
// ============================================================================

export interface Transaction {
    id: string;
    user_id: string;
    stripe_session_id: string;
    amount: number;
    currency: string;
    status: 'pending' | 'completed' | 'failed';
    product_name: string | null;
    product_id: string | null;
    discount_applied: number;
    created_at: string;
    updated_at: string;
}

interface UseTransactionListenerOptions {
    /** Only listen when enabled (default: false). Toggle to true after scanning. */
    enabled?: boolean;
    /** Optional session ID to filter for a specific transaction */
    sessionId?: string;
}

interface UseTransactionListenerReturn {
    /** The most recently completed transaction, or null */
    completedTransaction: Transaction | null;
    /** Whether the listener is actively subscribed */
    isListening: boolean;
    /** Reset the completed state to listen for another */
    reset: () => void;
}

export function useTransactionListener(
    options: UseTransactionListenerOptions = {}
): UseTransactionListenerReturn {
    const { enabled = false, sessionId } = options;
    const { user } = useAuth();
    const [completedTransaction, setCompletedTransaction] = useState<Transaction | null>(null);
    const [isListening, setIsListening] = useState(false);
    const channelRef = useRef<RealtimeChannel | null>(null);

    const reset = useCallback(() => {
        setCompletedTransaction(null);
    }, []);

    useEffect(() => {
        if (!enabled || !user?.id) {
            setIsListening(false);
            return;
        }

        // Subscribe to UPDATE events on the transactions table
        const channelName = `transactions:user:${user.id}:${Date.now()}`;

        const channel = supabase
            .channel(channelName)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'transactions',
                    filter: `user_id=eq.${user.id}`,
                },
                (payload) => {
                    const newRecord = payload.new as Transaction;

                    // Only fire for completed transactions
                    if (newRecord.status !== 'completed') return;

                    // If filtering by session ID, check it matches
                    if (sessionId && newRecord.stripe_session_id !== sessionId) return;

                    console.log('[useTransactionListener] Payment completed:', newRecord.id);
                    setCompletedTransaction(newRecord);
                }
            )
            .subscribe((status) => {
                console.log('[useTransactionListener] Subscription status:', status);
                setIsListening(status === 'SUBSCRIBED');
            });

        channelRef.current = channel;

        // Cleanup on unmount or dependency change
        return () => {
            console.log('[useTransactionListener] Unsubscribing from channel');
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
                channelRef.current = null;
            }
            setIsListening(false);
        };
    }, [enabled, user?.id, sessionId]);

    return { completedTransaction, isListening, reset };
}
