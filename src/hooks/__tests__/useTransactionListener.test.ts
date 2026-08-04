/**
 * useTransactionListener — Tier 2 hook tests.
 * Realtime postgres_changes subscription for QR-pay confirmation.
 * Verifies: enable gating, channel filter, completed-only handling,
 * sessionId filtering, isListening lifecycle, cleanup on unmount.
 */
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useTransactionListener } from '../useTransactionListener';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { makeMockChannel, mockTransaction, mockUser } from '../../__mocks__/merakiData';

jest.mock('../../lib/supabase', () => ({
    supabase: {
        channel: jest.fn(),
        removeChannel: jest.fn(async () => 'ok'),
    },
}));

jest.mock('../../contexts/AuthContext', () => ({
    useAuth: jest.fn(),
}));

const channelMock = supabase.channel as jest.Mock;
const removeChannelMock = supabase.removeChannel as jest.Mock;
const useAuthMock = useAuth as jest.Mock;

const asLoggedIn = () => useAuthMock.mockReturnValue({ user: mockUser({ id: 'u-42' }) });

describe('useTransactionListener — gating', () => {
    beforeEach(() => {
        jest.resetAllMocks();
    });

    it('does not subscribe when disabled', () => {
        asLoggedIn();
        const { result } = renderHook(() => useTransactionListener({ enabled: false }));
        expect(channelMock).not.toHaveBeenCalled();
        expect(result.current.isListening).toBe(false);
        expect(result.current.completedTransaction).toBeNull();
    });

    it('does not subscribe when no user is signed in', () => {
        useAuthMock.mockReturnValue({ user: null });
        renderHook(() => useTransactionListener({ enabled: true }));
        expect(channelMock).not.toHaveBeenCalled();
    });

    it('subscribes to UPDATE on transactions filtered by user_id when enabled', () => {
        asLoggedIn();
        const ch = makeMockChannel();
        channelMock.mockReturnValue(ch);

        renderHook(() => useTransactionListener({ enabled: true }));

        expect(channelMock).toHaveBeenCalledTimes(1);
        expect(ch.on).toHaveBeenCalledWith(
            'postgres_changes',
            expect.objectContaining({
                event: 'UPDATE',
                table: 'transactions',
                filter: 'user_id=eq.u-42',
            }),
            expect.any(Function)
        );
    });
});

describe('useTransactionListener — event handling', () => {
    beforeEach(() => {
        jest.resetAllMocks();
        asLoggedIn();
    });

    it('sets completedTransaction only for status=completed rows', async () => {
        const ch = makeMockChannel();
        channelMock.mockReturnValue(ch);
        const { result } = renderHook(() => useTransactionListener({ enabled: true }));

        // pending event — must be ignored
        await act(async () => {
            ch.__lastChangeHandler({ new: mockTransaction({ status: 'pending' }), old: null });
        });
        expect(result.current.completedTransaction).toBeNull();

        // completed event — surfaces
        const completed = mockTransaction({ status: 'completed', amount: 9950 });
        await act(async () => {
            ch.__lastChangeHandler({ new: completed, old: null });
        });
        expect(result.current.completedTransaction).toEqual(completed);
    });

    it('ignores completed rows whose session id does not match the requested one', async () => {
        const ch = makeMockChannel();
        channelMock.mockReturnValue(ch);
        const { result } = renderHook(() =>
            useTransactionListener({ enabled: true, sessionId: 'cs_test_wanted' })
        );

        await act(async () => {
            ch.__lastChangeHandler({
                new: mockTransaction({ status: 'completed', stripe_session_id: 'cs_test_OTHER' }),
                old: null,
            });
        });
        expect(result.current.completedTransaction).toBeNull();

        const wanted = mockTransaction({
            status: 'completed',
            stripe_session_id: 'cs_test_wanted',
        });
        await act(async () => {
            ch.__lastChangeHandler({ new: wanted, old: null });
        });
        expect(result.current.completedTransaction).toEqual(wanted);
    });

    it('reset() clears the captured transaction for the next payment', async () => {
        const ch = makeMockChannel();
        channelMock.mockReturnValue(ch);
        const { result } = renderHook(() => useTransactionListener({ enabled: true }));

        await act(async () => {
            ch.__lastChangeHandler({ new: mockTransaction({ status: 'completed' }), old: null });
        });
        expect(result.current.completedTransaction).not.toBeNull();

        act(() => result.current.reset());
        expect(result.current.completedTransaction).toBeNull();
    });
});

describe('useTransactionListener — lifecycle', () => {
    beforeEach(() => {
        jest.resetAllMocks();
        asLoggedIn();
    });

    it('isListening reflects SUBSCRIBED status from the client', async () => {
        const ch = makeMockChannel(); // auto-fires 'SUBSCRIBED'
        channelMock.mockReturnValue(ch);
        const { result } = renderHook(() => useTransactionListener({ enabled: true }));

        await waitFor(() => expect(result.current.isListening).toBe(true));
    });

    it('isListening flips false when the channel reports CLOSED', async () => {
        const ch = makeMockChannel('SUBSCRIBED');
        channelMock.mockReturnValue(ch);
        const { result } = renderHook(() => useTransactionListener({ enabled: true }));
        await waitFor(() => expect(result.current.isListening).toBe(true));

        act(() => ch.__triggerSubscribe('CLOSED'));
        expect(result.current.isListening).toBe(false);
    });

    it('unsubscribes (removeChannel) on unmount', async () => {
        const ch = makeMockChannel();
        channelMock.mockReturnValue(ch);
        const { result, unmount } = renderHook(() => useTransactionListener({ enabled: true }));
        await waitFor(() => expect(result.current.isListening).toBe(true));

        unmount();

        expect(removeChannelMock).toHaveBeenCalledWith(ch);
    });

    it('re-subscribes when user changes (channel rebuilt per user id)', async () => {
        const ch1 = makeMockChannel();
        const ch2 = makeMockChannel();
        channelMock.mockReturnValueOnce(ch1).mockReturnValue(ch2);

        const view = renderHook(() => useTransactionListener({ enabled: true }));
        await waitFor(() => expect(channelMock).toHaveBeenCalledTimes(1));

        // swap user
        useAuthMock.mockReturnValue({ user: mockUser({ id: 'u-99' }) });
        view.rerender({});

        await waitFor(() => expect(channelMock).toHaveBeenCalledTimes(2));
        expect(removeChannelMock).toHaveBeenCalledWith(ch1);
    });
});
