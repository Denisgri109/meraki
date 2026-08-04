/**
 * EditContext — Tier 2 context tests.
 *
 * Owner inline-CMS: read global_settings, optimistic local update + upsert,
 * role-gated edit mode, prefix-reset with rollback on delete error.
 */
import React from 'react';
import { render, act, waitFor } from '@testing-library/react-native';
import { EditProvider, useEditMode } from '../EditContext';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../AuthContext';
import { makeBuilder, mockUser, mockProfile } from '../../__mocks__/merakiData';

jest.mock('../../lib/supabase', () => ({
    supabase: { from: jest.fn() },
}));

jest.mock('../AuthContext', () => ({
    useAuth: jest.fn(),
}));

const fromMock = supabase.from as jest.Mock;
const useAuthMock = useAuth as jest.Mock;

let snapshot: ReturnType<typeof useEditMode>;
function Probe() {
    snapshot = useEditMode();
    return null;
}

function renderProvider() {
    return render(
        <EditProvider>
            <Probe />
        </EditProvider>
    );
}

const asOwner = () => {
    useAuthMock.mockReturnValue({
        user: mockUser({ id: 'owner-1' }),
        profile: mockProfile({ role: 'owner' }),
    });
};
const asClient = () => {
    useAuthMock.mockReturnValue({
        user: mockUser({ id: 'client-1' }),
        profile: mockProfile({ role: 'client' }),
    });
};

beforeEach(() => {
    jest.resetAllMocks();
});

describe('EditContext — content loading', () => {
    it('hydrates content map from global_settings key/value rows', async () => {
        asOwner();
        fromMock.mockReturnValue(
            makeBuilder({
                data: [
                    { key: 'mobile.hero_title', value: 'Welcome' },
                    { key: 'mobile.about', value: 'Studio text' },
                ],
                error: null,
            })
        );

        renderProvider();

        await waitFor(() => {
            expect(snapshot.getContent('mobile.hero_title', 'fallback')).toBe('Welcome');
        });
        expect(snapshot.getContent('mobile.about', 'fallback')).toBe('Studio text');
    });

    it('returns the fallback for unknown keys', async () => {
        asOwner();
        fromMock.mockReturnValue(makeBuilder({ data: [], error: null }));
        renderProvider();
        await waitFor(() => expect(fromMock).toHaveBeenCalledWith('global_settings'));
        expect(snapshot.getContent('mobile.missing', 'FB')).toBe('FB');
    });

    it('leaves content empty when the fetch errors (no crash, no stale rows)', async () => {
        asOwner();
        fromMock.mockReturnValue(
            makeBuilder({ data: null, error: { message: 'permission denied' } })
        );
        renderProvider();
        await waitFor(() => expect(fromMock).toHaveBeenCalled());
        expect(snapshot.content).toEqual({});
    });
});

describe('EditContext — role gating', () => {
    it('canEdit is true only for owner', async () => {
        asOwner();
        fromMock.mockReturnValue(makeBuilder({ data: [], error: null }));
        renderProvider();
        expect(snapshot.canEdit).toBe(true);
    });

    it('canEdit is false for clients and masters', async () => {
        asClient();
        fromMock.mockReturnValue(makeBuilder({ data: [], error: null }));
        renderProvider();
        expect(snapshot.canEdit).toBe(false);
    });

    it('toggleEditMode is a no-op for non-owners', async () => {
        asClient();
        fromMock.mockReturnValue(makeBuilder({ data: [], error: null }));
        renderProvider();
        await act(async () => snapshot.toggleEditMode());
        expect(snapshot.isEditMode).toBe(false);
    });

    it('toggleEditMode flips for owner', async () => {
        asOwner();
        fromMock.mockReturnValue(makeBuilder({ data: [], error: null }));
        renderProvider();
        await act(async () => snapshot.toggleEditMode());
        expect(snapshot.isEditMode).toBe(true);
        await act(async () => snapshot.toggleEditMode());
        expect(snapshot.isEditMode).toBe(false);
    });

    it('updateContent refuses editorship for non-owners WITHOUT writing', async () => {
        asClient();
        fromMock.mockReturnValue(makeBuilder({ data: [], error: null }));
        renderProvider();

        let result: any;
        await act(async () => {
            result = await snapshot.updateContent('mobile.x', 'nope');
        });
        expect(result.error).toMatch(/owners/);
        // only the initial SELECT ran — no second from() for upsert
        expect(fromMock).toHaveBeenCalledTimes(1);
    });
});

describe('EditContext — updateContent', () => {
    it('applies optimistic local update and upserts with owner id + timestamp', async () => {
        asOwner();
        const selectBuilder = makeBuilder({ data: [], error: null });
        const upsertBuilder = makeBuilder({ data: null, error: null });
        fromMock
            .mockReturnValueOnce(selectBuilder)
            .mockReturnValue(upsertBuilder);

        renderProvider();
        await waitFor(() => expect(fromMock).toHaveBeenCalledWith('global_settings'));

        let result: any;
        await act(async () => {
            result = await snapshot.updateContent('mobile.hero', 'New title');
        });

        expect(result).toEqual({ error: null });
        expect(snapshot.getContent('mobile.hero', '')).toBe('New title');
        expect(upsertBuilder.upsert).toHaveBeenCalledWith(
            expect.objectContaining({ key: 'mobile.hero', value: 'New title', updated_by: 'owner-1' }),
            { onConflict: 'key' }
        );
    });

    it('surfaces upsert errors and keeps the optimistic value', async () => {
        asOwner();
        fromMock
            .mockReturnValueOnce(makeBuilder({ data: [], error: null }))
            .mockReturnValue(makeBuilder({ data: null, error: { message: 'RLS violated' } }));
        renderProvider();
        await waitFor(() => expect(fromMock).toHaveBeenCalled());

        let result: any;
        await act(async () => {
            result = await snapshot.updateContent('mobile.x', 'v');
        });
        expect(result.error).toBe('RLS violated');
    });
});

describe('EditContext — resetContent', () => {
    it('deletes only keys matching the prefix and updates local state', async () => {
        asOwner();
        fromMock
            .mockReturnValueOnce(makeBuilder({
                data: [
                    { key: 'mobile.a', value: '1' },
                    { key: 'mobile.b', value: '2' },
                    { key: 'web.keep', value: '3' },
                ],
                error: null,
            }))
            .mockReturnValue(makeBuilder({ data: null, error: null }));

        renderProvider();
        await waitFor(() => expect(snapshot.getContent('mobile.a', '')).toBe('1'));

        let result: any;
        await act(async () => {
            result = await snapshot.resetContent('mobile.');
        });

        expect(result.error).toBeNull();
        expect(snapshot.content['mobile.a']).toBeUndefined();
        expect(snapshot.content['mobile.b']).toBeUndefined();
        expect(snapshot.content['web.keep']).toBe('3');
    });

    it('rolls back local deletions by refetching when delete fails', async () => {
        asOwner();
        const rows = [{ key: 'mobile.a', value: 'original' }];
        fromMock
            .mockReturnValueOnce(makeBuilder({ data: rows, error: null }))
            .mockReturnValueOnce(makeBuilder({ data: null, error: { message: 'delete blocked' } }))
            .mockReturnValue(makeBuilder({ data: rows, error: null })); // rollback refetch

        renderProvider();
        await waitFor(() => expect(snapshot.getContent('mobile.a', '')).toBe('original'));

        let result: any;
        await act(async () => {
            result = await snapshot.resetContent('mobile.');
        });

        expect(result.error).toBe('delete blocked');
        await waitFor(() => {
            expect(snapshot.getContent('mobile.a', '')).toBe('original');
        });
    });

    it('is a no-op error-less when no keys match the prefix', async () => {
        asOwner();
        fromMock.mockReturnValue(makeBuilder({ data: [{ key: 'web.x', value: '1' }], error: null }));
        renderProvider();
        await waitFor(() => expect(snapshot.content['web.x']).toBe('1'));

        let result: any;
        await act(async () => { result = await snapshot.resetContent('mobile.'); });
        expect(result.error).toBeNull();
        expect(fromMock).toHaveBeenCalledTimes(1);
    });
});

describe('useEditMode guard', () => {
    it('throws outside provider', () => {
        expect(() => render(<Probe />)).toThrow(/EditProvider/);
    });
});
