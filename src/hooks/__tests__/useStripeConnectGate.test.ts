import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useStripeConnectGate } from '../useStripeConnectGate';
import { AppState, Linking } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useModal } from '../../contexts/ModalContext';

// Mock dependencies
jest.mock('react-native', () => {
    return Object.setPrototypeOf({
        AppState: {
            addEventListener: jest.fn(),
        },
        Linking: {
            openURL: jest.fn(),
        },
    }, jest.requireActual('react-native'));
});

jest.mock('../../lib/supabase', () => ({
    supabase: {
        auth: {
            getSession: jest.fn(),
        },
        functions: {
            invoke: jest.fn(),
        },
    },
}));

jest.mock('../../contexts/AuthContext', () => ({
    useAuth: jest.fn(),
}));

jest.mock('../../contexts/ModalContext', () => ({
    useModal: jest.fn(),
}));

describe('useStripeConnectGate', () => {
    const mockRefreshProfile = jest.fn();
    const mockShowAlert = jest.fn();

    const baseProfile = {
        id: '123',
        email: 'test@example.com',
        role: 'user',
        created_at: '2023-01-01',
    };

    beforeEach(() => {
        jest.clearAllMocks();

        (useAuth as jest.Mock).mockReturnValue({
            profile: null,
            refreshProfile: mockRefreshProfile,
        });

        (useModal as jest.Mock).mockReturnValue({
            showAlert: mockShowAlert,
        });

        (AppState.addEventListener as jest.Mock).mockReturnValue({
            remove: jest.fn(),
        });

        (supabase.auth.getSession as jest.Mock).mockResolvedValue({
            data: { session: { access_token: 'mock-token' } },
        });
    });

    describe('derived state (shouldShow, hasPendingAccount)', () => {
        it('should show for masters without active connect status', () => {
            (useAuth as jest.Mock).mockReturnValue({
                profile: { ...baseProfile, role: 'master', stripe_connect_status: 'pending' },
            });

            const { result } = renderHook(() => useStripeConnectGate());
            expect(result.current.shouldShow).toBe(true);
            expect(result.current.hasPendingAccount).toBeFalsy(); // missing id
        });

        it('should not show for users', () => {
            (useAuth as jest.Mock).mockReturnValue({
                profile: { ...baseProfile, role: 'user' },
            });

            const { result } = renderHook(() => useStripeConnectGate());
            expect(result.current.shouldShow).toBe(false);
            expect(result.current.hasPendingAccount).toBeFalsy();
        });

        it('should not show for masters with active connect status', () => {
            (useAuth as jest.Mock).mockReturnValue({
                profile: { ...baseProfile, role: 'master', stripe_connect_status: 'active' },
            });

            const { result } = renderHook(() => useStripeConnectGate());
            expect(result.current.shouldShow).toBe(false);
            expect(result.current.hasPendingAccount).toBeFalsy();
        });

        it('should have hasPendingAccount if connect_id is present and status is pending', () => {
            (useAuth as jest.Mock).mockReturnValue({
                profile: {
                    ...baseProfile,
                    role: 'master',
                    stripe_connect_status: 'pending',
                    stripe_connect_id: 'acct_123'
                },
            });

            const { result } = renderHook(() => useStripeConnectGate());
            expect(result.current.shouldShow).toBe(true);
            expect(result.current.hasPendingAccount).toBe(true);
        });
    });

    describe('handleStartOnboarding', () => {
        it('should open URL on successful invocation', async () => {
            const mockUrl = 'https://connect.stripe.com/setup/s/123';
            (supabase.functions.invoke as jest.Mock).mockResolvedValue({
                data: { url: mockUrl },
                error: null,
            });

            const { result } = renderHook(() => useStripeConnectGate());

            await act(async () => {
                await result.current.handleStartOnboarding();
            });

            expect(result.current.loading).toBe(false);
            expect(Linking.openURL).toHaveBeenCalledWith(mockUrl);
            expect(result.current.error).toBeNull();
        });

        it('should show alert if not authenticated', async () => {
            (supabase.auth.getSession as jest.Mock).mockResolvedValue({
                data: { session: null },
            });

            const { result } = renderHook(() => useStripeConnectGate());

            await act(async () => {
                await result.current.handleStartOnboarding();
            });

            expect(mockShowAlert).toHaveBeenCalledWith('Onboarding Error', 'Not authenticated', 'error');
            expect(result.current.error).toBe('Not authenticated');
            expect(result.current.loading).toBe(false);
        });

        it('should show alert on standard function error', async () => {
            (supabase.functions.invoke as jest.Mock).mockResolvedValue({
                data: null,
                error: new Error('Invocation failed'),
            });

            const { result } = renderHook(() => useStripeConnectGate());

            await act(async () => {
                await result.current.handleStartOnboarding();
            });

            expect(mockShowAlert).toHaveBeenCalledWith('Onboarding Error', 'Invocation failed', 'error');
        });

        it('should handle FunctionsHttpError and parse context JSON', async () => {
            const mockFnError = new Error('FunctionsHttpError');
            mockFnError.name = 'FunctionsHttpError';
            (mockFnError as any).context = {
                json: jest.fn().mockResolvedValue({ error: 'Detailed error from function', param: 'some_param' })
            };

            (supabase.functions.invoke as jest.Mock).mockResolvedValue({
                data: null,
                error: mockFnError,
            });

            const { result } = renderHook(() => useStripeConnectGate());

            await act(async () => {
                await result.current.handleStartOnboarding();
            });

            expect(mockShowAlert).toHaveBeenCalledWith(
                'Onboarding Error',
                'Detailed error from function (Param: some_param)',
                'error'
            );
        });

        it('should handle FunctionsHttpError JSON parsing failure', async () => {
             const mockFnError = new Error('Http Failure');
            mockFnError.name = 'FunctionsHttpError';
            (mockFnError as any).context = {
                json: jest.fn().mockRejectedValue(new Error('JSON Parse failed'))
            };

            (supabase.functions.invoke as jest.Mock).mockResolvedValue({
                data: null,
                error: mockFnError,
            });

            const { result } = renderHook(() => useStripeConnectGate());

            await act(async () => {
                await result.current.handleStartOnboarding();
            });

            expect(mockShowAlert).toHaveBeenCalledWith(
                'Onboarding Error',
                'Http Failure',
                'error'
            );
        });

        it('should handle error in response data', async () => {
             (supabase.functions.invoke as jest.Mock).mockResolvedValue({
                data: { error: 'Data error response' },
                error: null,
            });

            const { result } = renderHook(() => useStripeConnectGate());

            await act(async () => {
                await result.current.handleStartOnboarding();
            });

            expect(mockShowAlert).toHaveBeenCalledWith(
                'Onboarding Error',
                'Data error response',
                'error'
            );
        });
    });

    describe('handleCheckStatus', () => {
        it('should call refreshProfile on successful check', async () => {
            (supabase.functions.invoke as jest.Mock).mockResolvedValue({
                data: { success: true },
                error: null,
            });

            const { result } = renderHook(() => useStripeConnectGate());

            await act(async () => {
                await result.current.handleCheckStatus();
            });

            expect(result.current.checkingStatus).toBe(false);
            expect(mockRefreshProfile).toHaveBeenCalled();
            expect(result.current.error).toBeNull();
        });

        it('should handle error and show alert', async () => {
            (supabase.functions.invoke as jest.Mock).mockResolvedValue({
                data: null,
                error: new Error('Status check failed'),
            });

            const { result } = renderHook(() => useStripeConnectGate());

            await act(async () => {
                await result.current.handleCheckStatus();
            });

            expect(mockShowAlert).toHaveBeenCalledWith('Status Check Error', 'Status check failed', 'error');
            expect(result.current.error).toBe('Status check failed');
            expect(mockRefreshProfile).not.toHaveBeenCalled();
        });
    });

    describe('AppState Listener', () => {
        it('should call handleCheckStatus when app becomes active and shouldShow is true', async () => {
             (useAuth as jest.Mock).mockReturnValue({
                profile: { ...baseProfile, role: 'master', stripe_connect_status: 'pending' },
            });

            let appStateCallback: (state: string) => void = () => {};
            (AppState.addEventListener as jest.Mock).mockImplementation((event, callback) => {
                if (event === 'change') {
                    appStateCallback = callback;
                }
                return { remove: jest.fn() };
            });

            (supabase.functions.invoke as jest.Mock).mockResolvedValue({ data: {}, error: null });

            renderHook(() => useStripeConnectGate());

            await act(async () => {
                appStateCallback('active');
            });

            expect(supabase.functions.invoke).toHaveBeenCalledWith('stripe-connect-status', expect.any(Object));
        });

        it('should not call handleCheckStatus when app becomes active and shouldShow is false', () => {
             (useAuth as jest.Mock).mockReturnValue({
                profile: { ...baseProfile, role: 'user' },
            });

             let appStateCallback: (state: string) => void = () => {};
            (AppState.addEventListener as jest.Mock).mockImplementation((event, callback) => {
                if (event === 'change') {
                    appStateCallback = callback;
                }
                return { remove: jest.fn() };
            });

            renderHook(() => useStripeConnectGate());

             act(() => {
                appStateCallback('active');
            });

            // If shouldShow is false, the useEffect returns early and doesn't add the listener
            // Or if we somehow called it, it shouldn't trigger
            expect(supabase.functions.invoke).not.toHaveBeenCalled();
        });
    });
});
