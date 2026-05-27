import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { AuthProvider, useAuth } from '../AuthContext';
import { supabase } from '../../lib/supabase';
import { safeSupabaseFetch } from '../../lib/supabaseApi';
import { registerForPushNotificationsAsync } from '../../services/notificationService';

jest.mock('../../lib/supabase', () => ({
    supabase: {
        auth: {
            getSession: jest.fn(),
            onAuthStateChange: jest.fn(),
            signInWithPassword: jest.fn(),
            signUp: jest.fn(),
            signOut: jest.fn(),
        },
        from: jest.fn(),
    },
}));

jest.mock('../../lib/supabaseApi', () => ({
    safeSupabaseFetch: jest.fn(),
}));

jest.mock('../../services/notificationService', () => ({
    registerForPushNotificationsAsync: jest.fn(),
}));

const mockSession = {
    access_token: 'mock-token',
    refresh_token: 'mock-refresh',
    expires_in: 3600,
    token_type: 'bearer',
    user: {
        id: 'user-123',
        app_metadata: {},
        user_metadata: {},
        aud: 'authenticated',
        created_at: '2023-01-01',
    },
};

const mockProfile = {
    id: 'user-123',
    full_name: 'Test User',
    role: 'client',
    push_token: 'mock-push-token',
};

const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AuthProvider>{children}</AuthProvider>
);

describe('AuthContext', () => {
    let mockOnAuthStateChangeCallback: (event: string, session: any) => void;

    beforeEach(() => {
        jest.clearAllMocks();

        // Setup default mocks
        (supabase.auth.getSession as jest.Mock).mockResolvedValue({
            data: { session: null },
            error: null,
        });

        (supabase.auth.onAuthStateChange as jest.Mock).mockImplementation((callback) => {
            mockOnAuthStateChangeCallback = callback;
            return {
                data: {
                    subscription: {
                        unsubscribe: jest.fn(),
                    },
                },
            };
        });

        // Mock profile fetch chain
        const mockEq = jest.fn().mockReturnThis();
        const mockSingle = jest.fn().mockResolvedValue({ data: mockProfile, error: null });
        const mockSelect = jest.fn().mockReturnValue({ eq: mockEq, single: mockSingle });

        // Mock profile update chain
        const mockUpdateEq = jest.fn().mockResolvedValue({ error: null });
        const mockUpdate = jest.fn().mockReturnValue({ eq: mockUpdateEq });

        (supabase.from as jest.Mock).mockImplementation((table) => {
             return {
                 select: mockSelect,
                 update: mockUpdate,
                 // return itself for chained methods just in case
                 eq: mockEq,
                 single: mockSingle
             };
        });

        (safeSupabaseFetch as jest.Mock).mockResolvedValue({
            data: mockProfile,
            error: null,
            timeout: false,
        });
    });

    describe('Initial Load', () => {
        it('initializes with no session', async () => {
            const { result } = renderHook(() => useAuth(), { wrapper });

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            expect(result.current.session).toBeNull();
            expect(result.current.user).toBeNull();
            expect(result.current.profile).toBeNull();
        });

        it('initializes with an existing session', async () => {
            (supabase.auth.getSession as jest.Mock).mockResolvedValue({
                data: { session: mockSession },
                error: null,
            });

            const { result } = renderHook(() => useAuth(), { wrapper });

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            expect(result.current.session).toEqual(mockSession);
            expect(result.current.user).toEqual(mockSession.user);
            expect(result.current.profile).toEqual(mockProfile);
            expect(result.current.role).toBe('client');
            expect(safeSupabaseFetch).toHaveBeenCalled();
            expect(registerForPushNotificationsAsync).toHaveBeenCalledWith('user-123');
        });

        it('handles error getting initial session', async () => {
            const mockError = new Error('Session error');
            (supabase.auth.getSession as jest.Mock).mockResolvedValue({
                data: { session: null },
                error: mockError,
            });
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

            const { result } = renderHook(() => useAuth(), { wrapper });

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            expect(result.current.sessionError).toEqual(mockError);
            expect(consoleSpy).toHaveBeenCalledWith('Error getting initial session:', mockError);
            consoleSpy.mockRestore();
        });
    });

    describe('Auth State Changes', () => {
        it('handles SIGNED_IN event', async () => {
            const { result } = renderHook(() => useAuth(), { wrapper });

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            act(() => {
                mockOnAuthStateChangeCallback('SIGNED_IN', mockSession);
            });

            await waitFor(() => {
                expect(result.current.session).toEqual(mockSession);
                expect(result.current.profile).toEqual(mockProfile);
                expect(result.current.loading).toBe(false);
            });
        });

        it('handles SIGNED_OUT event', async () => {
            (supabase.auth.getSession as jest.Mock).mockResolvedValue({
                data: { session: mockSession },
                error: null,
            });

            const { result } = renderHook(() => useAuth(), { wrapper });

            await waitFor(() => {
                expect(result.current.session).not.toBeNull();
            });

            act(() => {
                mockOnAuthStateChangeCallback('SIGNED_OUT', null);
            });

            await waitFor(() => {
                expect(result.current.session).toBeNull();
                expect(result.current.user).toBeNull();
                expect(result.current.profile).toBeNull();
            });
        });

        it('handles USER_UPDATED event', async () => {
            const { result } = renderHook(() => useAuth(), { wrapper });

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            act(() => {
                mockOnAuthStateChangeCallback('USER_UPDATED', mockSession);
            });

            await waitFor(() => {
                expect(result.current.session).toEqual(mockSession);
                expect(result.current.profile).toEqual(mockProfile);
                expect(result.current.loading).toBe(false);
            });
        });
    });

    describe('Actions', () => {
        it('signIn calls supabase.auth.signInWithPassword', async () => {
            (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({ error: null });

            const { result } = renderHook(() => useAuth(), { wrapper });

            let response;
            await act(async () => {
                response = await result.current.signIn('test@example.com', 'password123');
            });

            expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
                email: 'test@example.com',
                password: 'password123',
            });
            expect(response).toEqual({ error: null });
        });

        it('signUp calls supabase.auth.signUp and updates profile', async () => {
            (supabase.auth.signUp as jest.Mock).mockResolvedValue({
                data: { user: { id: 'new-user' } },
                error: null,
            });

            const mockUpdateEq = jest.fn().mockResolvedValue({ error: null });
            const mockUpdate = jest.fn().mockReturnValue({ eq: mockUpdateEq });
            (supabase.from as jest.Mock).mockReturnValue({ update: mockUpdate });

            const { result } = renderHook(() => useAuth(), { wrapper });

            let response;
            await act(async () => {
                response = await result.current.signUp(
                    'test@example.com',
                    'password123',
                    'New User',
                    'client',
                    true,
                    '1.0'
                );
            });

            expect(supabase.auth.signUp).toHaveBeenCalledWith({
                email: 'test@example.com',
                password: 'password123',
                options: {
                    data: {
                        full_name: 'New User',
                        role: 'client',
                    },
                },
            });

            expect(supabase.from).toHaveBeenCalledWith('profiles');
            expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
                role: 'client',
                is_master: false,
                full_name: 'New User',
                tos_accepted: true,
                tos_version: '1.0'
            }));
            expect(mockUpdateEq).toHaveBeenCalledWith('id', 'new-user');
            expect(response).toEqual({ error: null });
        });

        it('signOut updates push_token to null and signs out', async () => {
            (supabase.auth.getSession as jest.Mock).mockResolvedValue({
                data: { session: mockSession },
                error: null,
            });

            const mockUpdateEq = jest.fn().mockResolvedValue({ error: null });
            const mockUpdate = jest.fn().mockReturnValue({ eq: mockUpdateEq });
            (supabase.from as jest.Mock).mockReturnValue({ update: mockUpdate });

            const { result } = renderHook(() => useAuth(), { wrapper });

            await waitFor(() => {
                expect(result.current.user).not.toBeNull();
            });

            await act(async () => {
                await result.current.signOut();
            });

            expect(supabase.from).toHaveBeenCalledWith('profiles');
            expect(mockUpdate).toHaveBeenCalledWith({ push_token: null });
            expect(mockUpdateEq).toHaveBeenCalledWith('id', 'user-123');
            expect(supabase.auth.signOut).toHaveBeenCalled();
        });

        it('updateProfile updates profile and refreshes', async () => {
            (supabase.auth.getSession as jest.Mock).mockResolvedValue({
                data: { session: mockSession },
                error: null,
            });

            const mockUpdateEq = jest.fn().mockResolvedValue({ error: null });
            const mockUpdate = jest.fn().mockReturnValue({ eq: mockUpdateEq });
            // For fetchProfile called internally
            const mockSelectEq = jest.fn().mockReturnThis();
            const mockSingle = jest.fn().mockResolvedValue({ data: mockProfile, error: null });
            const mockSelect = jest.fn().mockReturnValue({ eq: mockSelectEq, single: mockSingle });

            (supabase.from as jest.Mock).mockImplementation(() => ({
                update: mockUpdate,
                select: mockSelect
            }));

            const { result } = renderHook(() => useAuth(), { wrapper });

            await waitFor(() => {
                expect(result.current.user).not.toBeNull();
            });

            let response;
            await act(async () => {
                response = await result.current.updateProfile({ full_name: 'Updated Name' });
            });

            expect(supabase.from).toHaveBeenCalledWith('profiles');
            expect(mockUpdate).toHaveBeenCalledWith({ full_name: 'Updated Name' });
            expect(mockUpdateEq).toHaveBeenCalledWith('id', 'user-123');
            expect(response).toEqual({ error: null });
        });

        it('checkSession refreshes session if access token changed', async () => {
            (supabase.auth.getSession as jest.Mock)
                .mockResolvedValueOnce({
                    data: { session: mockSession },
                    error: null,
                })
                .mockResolvedValueOnce({
                    data: { session: { ...mockSession, access_token: 'new-token' } },
                    error: null,
                });

            const { result } = renderHook(() => useAuth(), { wrapper });

            await waitFor(() => {
                expect(result.current.session?.access_token).toBe('mock-token');
            });

            let isSessionValid;
            await act(async () => {
                isSessionValid = await result.current.checkSession();
            });

            expect(isSessionValid).toBe(true);
            expect(result.current.session?.access_token).toBe('new-token');
        });

        it('checkSession clears session if unexpected sign out occurs', async () => {
            (supabase.auth.getSession as jest.Mock)
                .mockResolvedValueOnce({
                    data: { session: mockSession },
                    error: null,
                })
                .mockResolvedValueOnce({
                    data: { session: null },
                    error: null,
                });

            const { result } = renderHook(() => useAuth(), { wrapper });

            await waitFor(() => {
                expect(result.current.session).not.toBeNull();
            });

            let isSessionValid;
            await act(async () => {
                isSessionValid = await result.current.checkSession();
            });

            expect(isSessionValid).toBe(false);
            expect(result.current.session).toBeNull();
            expect(result.current.user).toBeNull();
            expect(result.current.profile).toBeNull();
        });
    });

    describe('Context Validation', () => {
        it('useAuth outside AuthProvider throws error', () => {
            // Suppress React error boundary warnings for this specific test
            const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

            expect(() => renderHook(() => useAuth())).toThrow('useAuth must be used within an AuthProvider');

            consoleError.mockRestore();
        });
    });
});
