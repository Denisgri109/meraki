import { supabase } from './supabase';

/**
 * Configuration for safe API calls
 */
interface SafeFetchOptions {
    timeout?: number;
    errorMessage?: string;
    throwError?: boolean;
}

/**
 * Standardized error response
 */
interface SafeResponse<T> {
    data: T | null;
    error: Error | null;
    timeout: boolean;
}

/**
 * Safely executes a promise with a timeout to prevent infinite loading
 * @param promise The Supabase query promise
 * @param options Configuration options
 * @returns Object with data, error, and timeout status
 */
export async function safeSupabaseFetch<T>(
    promise: Promise<{ data: T | null; error: any }>,
    options: SafeFetchOptions = {}
): Promise<SafeResponse<T>> {
    const {
        timeout = 10000, // Default 10 seconds timeout
        errorMessage = 'Operation timed out',
        throwError = false
    } = options;

    let timeoutId: NodeJS.Timeout;

    // Create a timeout promise that rejects after the specified duration
    const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
            reject(new Error(errorMessage));
        }, timeout);
    });

    try {
        // Race the actual request against the timeout
        const result = await Promise.race([
            promise,
            timeoutPromise
        ]);

        // Clear timeout if request completes successfully
        clearTimeout(timeoutId!);

        if (result.error) {
            if (throwError) throw result.error;
            return { data: null, error: result.error, timeout: false };
        }

        return { data: result.data, error: null, timeout: false };

    } catch (error: unknown) {
        clearTimeout(timeoutId!);

        const err = error instanceof Error ? error : new Error(String(error));

        const isTimeout = err.message === errorMessage;

        console.error(`Supabase Fetch Error (${isTimeout ? 'Timeout' : 'Network/Auth'}):`, err);

        if (throwError) throw err;

        return {
            data: null,
            error: err,
            timeout: isTimeout
        };
    }
}

/**
 * Helper to check if a session is valid and refresh if needed
 * @returns boolean indicating if session is active
 */
export async function checkSessionHealth(): Promise<boolean> {
    try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error || !session) {
            console.log('Session check failed:', error?.message);
            return false;
        }

        return true;
    } catch (err) {
        console.error('Session health check error:', err);
        return false;
    }
}
