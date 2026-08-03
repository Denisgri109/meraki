import { renderHook, act, waitFor } from '@testing-library/react-native';
import { usePilatesWaiver, PilatesWaiverData } from '../usePilatesWaiver';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

jest.mock('../../lib/supabase', () => ({
    supabase: {
        from: jest.fn(),
    },
}));

jest.mock('../../contexts/AuthContext', () => ({
    useAuth: jest.fn(),
}));

const validData: PilatesWaiverData = {
    injuriesJointProblems: 'Lower back strain',
    pilatesExperience: 'Some Mat Pilates',
    hasIllnesses: false,
    illnessDetails: '',
    pregnancyStatus: 'no',
    medicationDetails: 'None',
    exerciseHistory: 'Running 3x per week',
    practitionerRecommended: false,
    goalsExpectations: 'Core strength',
    hasBoneCondition: false,
    agreedTermsOfUse: true,
    agreedLiabilityWaiver: true,
    emergencyContactName: 'Jane Doe',
    emergencyContactRelationship: 'Spouse',
    emergencyContactPhone: '0871234567',
};

describe('usePilatesWaiver', () => {
    const mockMaybeSingle = jest.fn();
    const mockUpsert = jest.fn();
    const mockEq = jest.fn();
    const mockSelect = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();

        (useAuth as jest.Mock).mockReturnValue({
            user: { id: 'user-123' },
        });

        mockEq.mockReturnValue({ maybeSingle: mockMaybeSingle });
        mockSelect.mockReturnValue({ eq: mockEq });
        (supabase.from as jest.Mock).mockReturnValue({
            select: mockSelect,
            upsert: mockUpsert,
        });

        mockMaybeSingle.mockResolvedValue({ data: null, error: null });
        mockUpsert.mockResolvedValue({ error: null });
    });

    describe('checkWaiver', () => {
        it('returns false when no user is signed in', async () => {
            (useAuth as jest.Mock).mockReturnValue({ user: null });

            const { result } = renderHook(() => usePilatesWaiver());

            let has: boolean | undefined;
            await act(async () => {
                has = await result.current.checkWaiver();
            });

            expect(has).toBe(false);
            expect(supabase.from).not.toHaveBeenCalled();
        });

        it('returns true when a waiver exists', async () => {
            mockMaybeSingle.mockResolvedValue({
                data: { id: 'w1', signed_at: '2026-07-01T00:00:00Z' },
                error: null,
            });

            const { result } = renderHook(() => usePilatesWaiver());

            let has: boolean | undefined;
            await act(async () => {
                has = await result.current.checkWaiver();
            });

            expect(has).toBe(true);
            await waitFor(() => expect(result.current.hasWaiver).toBe(true));
        });

        it('returns false when no waiver exists', async () => {
            mockMaybeSingle.mockResolvedValue({ data: null, error: null });

            const { result } = renderHook(() => usePilatesWaiver());

            let has: boolean | undefined;
            await act(async () => {
                has = await result.current.checkWaiver();
            });

            expect(has).toBe(false);
            await waitFor(() => expect(result.current.hasWaiver).toBe(false));
        });

        it('sets error and returns false on query failure', async () => {
            mockMaybeSingle.mockResolvedValue({ data: null, error: new Error('boom') });

            const { result } = renderHook(() => usePilatesWaiver());

            let has: boolean | undefined;
            await act(async () => {
                has = await result.current.checkWaiver();
            });

            expect(has).toBe(false);
            expect(result.current.error).toBe('boom');
        });
    });

    describe('submitWaiver', () => {
        it('upserts a waiver with terms_version 3.0 and sets hasWaiver', async () => {
            const { result } = renderHook(() => usePilatesWaiver());

            await act(async () => {
                await result.current.submitWaiver(validData);
            });

            expect(supabase.from).toHaveBeenCalledWith('pilates_waivers');
            const [payload, options] = mockUpsert.mock.calls[0];
            expect(options).toEqual({ onConflict: 'user_id' });
            expect(payload.user_id).toBe('user-123');
            expect(payload.terms_version).toBe('3.0');
            expect(payload.signature_name).toBeNull();
            expect(payload.injuries_joint_problems).toBe('Lower back strain');
            expect(payload.pregnancy_status).toBe('no');
            expect(payload.agreed_terms_of_use).toBe(true);
            expect(payload.emergency_contact_name).toBe('Jane Doe');
            expect(payload.signed_at).toBeTruthy();
            expect(result.current.hasWaiver).toBe(true);
        });

        it('derives has_injuries from the injuries text for backward compat', async () => {
            const { result } = renderHook(() => usePilatesWaiver());

            await act(async () => {
                await result.current.submitWaiver(validData);
            });

            expect(mockUpsert.mock.calls[0][0].has_injuries).toBe(true);

            mockUpsert.mockClear();
            await act(async () => {
                await result.current.submitWaiver({ ...validData, injuriesJointProblems: '   ' });
            });

            expect(mockUpsert.mock.calls[0][0].has_injuries).toBe(false);
        });

        it('nulls illnessDetails when hasIllnesses is false', async () => {
            const { result } = renderHook(() => usePilatesWaiver());

            await act(async () => {
                await result.current.submitWaiver(validData);
            });

            expect(mockUpsert.mock.calls[0][0].illness_details).toBeNull();
        });

        it('throws when not signed in', async () => {
            (useAuth as jest.Mock).mockReturnValue({ user: null });
            mockMaybeSingle.mockResolvedValue({ data: null, error: null });

            const { result } = renderHook(() => usePilatesWaiver());

            await expect(
                act(async () => {
                    await result.current.submitWaiver(validData);
                })
            ).rejects.toThrow('You must be signed in to submit a waiver.');
        });

        it('throws and sets error on upsert failure', async () => {
            mockUpsert.mockResolvedValue({ error: new Error('RLS denied') });

            const { result } = renderHook(() => usePilatesWaiver());

            let caught: unknown;
            await act(async () => {
                try {
                    await result.current.submitWaiver(validData);
                } catch (e) {
                    caught = e;
                }
            });

            expect(caught).toEqual(expect.objectContaining({ message: 'RLS denied' }));
            expect(result.current.error).toBe('RLS denied');
        });
    });
});
