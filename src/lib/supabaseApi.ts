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
 * Whether a thrown error is the device having no usable connection, rather than the server
 * rejecting the request. React Native's fetch reports every transport failure this way.
 */
function isOfflineError(error: Error): boolean {
    const message = error.message.toLowerCase();
    return (
        message.includes('network request failed') ||
        message.includes('failed to fetch') ||
        message.includes('network error')
    );
}

/**
 * Safely executes a promise with a timeout to prevent infinite loading
 * @param promise The Supabase query promise
 * @param options Configuration options
 * @returns Object with data, error, and timeout status
 */
export async function safeSupabaseFetch<T>(
    promise: PromiseLike<{ data: T | null; error: any }>,
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

        let err = error instanceof Error ? error : new Error(String(error));

        const isTimeout = err.message === errorMessage;

        // A dropped connection surfaces as "Network request failed" from fetch, and a timeout
        // is usually the same thing arriving more slowly. Neither tells the user anything, so
        // both are rewritten into something they can act on — unless the caller supplied its
        // own errorMessage, which is more specific than anything generic we could say.
        const callerSuppliedMessage = options.errorMessage !== undefined;
        if ((isTimeout && !callerSuppliedMessage) || isOfflineError(err)) {
            err = new Error(
                "Can't reach Merakí. Check your internet connection and try again.",
                { cause: error }
            );
        }

        if (__DEV__) {
            console.error(`Supabase fetch failed (${isTimeout ? 'timeout' : 'network/auth'}):`, error);
        }

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
            return false;
        }

        return true;
    } catch (err) {
        // Failed silently
        return false;
    }
}
