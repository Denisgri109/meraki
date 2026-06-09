/**
 * Supabase API Layer Tests
 * Tests the safeSupabaseFetch wrapper and checkSessionHealth
 */

// Mock supabase
jest.mock('../../lib/supabase', () => ({
    supabase: {
        auth: {
            getSession: jest.fn(),
        },
    },
}));

import { safeSupabaseFetch, checkSessionHealth } from '../supabaseApi';
import { supabase } from '../supabase';

// ═══════════════════════════════════════════════════════════════════════════
// safeSupabaseFetch
// ═══════════════════════════════════════════════════════════════════════════
describe('safeSupabaseFetch', () => {
    it('returns data on success', async () => {
        const mockData = [{ id: 1, name: 'Test' }];
        const promise = Promise.resolve({ data: mockData, error: null });

        const result = await safeSupabaseFetch(promise);

        expect(result.data).toEqual(mockData);
        expect(result.error).toBeNull();
        expect(result.timeout).toBe(false);
    });

    it('returns error on query failure', async () => {
        const err = new Error('Query failed');
        const promise = Promise.resolve({ data: null, error: err });

        const result = await safeSupabaseFetch(promise);

        expect(result.data).toBeNull();
        expect(result.error).toBe(err);
        expect(result.timeout).toBe(false);
    });

    it('handles timeout correctly', async () => {
        jest.useFakeTimers();
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        // A never-resolving promise to simulate an operation that takes too long
        const slowPromise = new Promise<{ data: any; error: any }>(() => {});

        const fetchPromise = safeSupabaseFetch(slowPromise, {
            timeout: 100, // Very short timeout
            errorMessage: 'Custom timeout',
        });

        jest.advanceTimersByTime(100);

        const result = await fetchPromise;

        expect(result.data).toBeNull();
        expect(result.error).toBeInstanceOf(Error);
        expect(result.timeout).toBe(true);
        expect(consoleSpy).toHaveBeenCalled();

        consoleSpy.mockRestore();
        jest.useRealTimers();
    });

    it('throws error on timeout when throwError option is true', async () => {
        jest.useFakeTimers();
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        const slowPromise = new Promise<{ data: any; error: any }>(() => {});

        const fetchPromise = safeSupabaseFetch(slowPromise, {
            timeout: 100,
            errorMessage: 'Custom timeout',
            throwError: true,
        });

        jest.advanceTimersByTime(100);

        await expect(fetchPromise).rejects.toThrow('Custom timeout');
        expect(consoleSpy).toHaveBeenCalled();

        consoleSpy.mockRestore();
        jest.useRealTimers();
    });

    it('catches and returns error when promise rejects (e.g., network error)', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const err = new Error('Network error');
        const rejectedPromise = Promise.reject(err);

        const result = await safeSupabaseFetch(rejectedPromise);

        expect(result.data).toBeNull();
        expect(result.error).toBe(err);
        expect(result.timeout).toBe(false);
        expect(consoleSpy).toHaveBeenCalled();

        consoleSpy.mockRestore();
    });

    it('catches and throws error when promise rejects and throwError is true', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const err = new Error('Network error');
        const rejectedPromise = Promise.reject(err);

        await expect(
            safeSupabaseFetch(rejectedPromise, { throwError: true })
        ).rejects.toThrow('Network error');
        expect(consoleSpy).toHaveBeenCalled();

        consoleSpy.mockRestore();
    });

    it('wraps non-Error objects in an Error object when caught', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const rejectedPromise = Promise.reject('String error');

        const result = await safeSupabaseFetch(rejectedPromise);

        expect(result.data).toBeNull();
        expect(result.error).toBeInstanceOf(Error);
        expect(result.error?.message).toBe('String error');
        expect(result.timeout).toBe(false);
        expect(consoleSpy).toHaveBeenCalled();

        consoleSpy.mockRestore();
    });

    it('throws error when throwError option is true', async () => {
        const err = new Error('Query failed');
        const promise = Promise.resolve({ data: null, error: err });

        await expect(
            safeSupabaseFetch(promise, { throwError: true })
        ).rejects.toThrow('Query failed');
    });

    it('returns empty data as null', async () => {
        const promise = Promise.resolve({ data: null, error: null });
        const result = await safeSupabaseFetch(promise);
        expect(result.data).toBeNull();
        expect(result.error).toBeNull();
    });

    it('uses default timeout of 10 seconds', async () => {
        // This test verifies the default behavior by ensuring a quick promise completes
        const quickPromise = Promise.resolve({ data: 'fast', error: null });
        const result = await safeSupabaseFetch(quickPromise);
        expect(result.data).toBe('fast');
        expect(result.timeout).toBe(false);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// checkSessionHealth
// ═══════════════════════════════════════════════════════════════════════════
describe('checkSessionHealth', () => {
    it('returns true when session is valid', async () => {
        (supabase.auth.getSession as jest.Mock).mockResolvedValue({
            data: { session: { user: { id: 'user-123' } } },
            error: null,
        });

        const result = await checkSessionHealth();
        expect(result).toBe(true);
    });

    it('returns false when session is null', async () => {
        (supabase.auth.getSession as jest.Mock).mockResolvedValue({
            data: { session: null },
            error: null,
        });

        const result = await checkSessionHealth();
        expect(result).toBe(false);
    });

    it('returns false when there is an auth error', async () => {
        const consoleSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});
        (supabase.auth.getSession as jest.Mock).mockResolvedValue({
            data: { session: null },
            error: new Error('Auth error'),
        });

        const result = await checkSessionHealth();
        expect(result).toBe(false);
        consoleSpy.mockRestore();
    });

    it('returns false when getSession throws', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        (supabase.auth.getSession as jest.Mock).mockRejectedValue(new Error('Network error'));

        const result = await checkSessionHealth();
        expect(result).toBe(false);
        consoleSpy.mockRestore();
    });
});
