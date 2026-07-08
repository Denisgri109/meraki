import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useCitySelection } from '../useCitySelection';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { getAllCountries, getStatesOfCountry } from '../../utils/locationApi';

jest.mock('../../contexts/AuthContext');
jest.mock('../../utils/locationApi');
jest.mock('../../lib/supabase', () => ({
    supabase: {
        from: jest.fn(),
    },
}));

describe('useCitySelection', () => {
    const mockRefreshProfile = jest.fn();
    const mockOnCitySaved = jest.fn();
    let mockProfile: any;

    const createSupabaseMock = (error: any = null) => {
        const eqMock = jest.fn().mockResolvedValue({ error });
        const updateMock = jest.fn().mockReturnValue({ eq: eqMock });
        const fromMock = jest.fn().mockReturnValue({ update: updateMock });
        (supabase.from as jest.Mock).mockImplementation(fromMock);
        return { fromMock, updateMock, eqMock };
    };

    beforeEach(() => {
        jest.clearAllMocks();

        mockProfile = {
            id: 'user-123',
        };

        (useAuth as jest.Mock).mockReturnValue({
            profile: mockProfile,
            refreshProfile: mockRefreshProfile,
        });

        (getAllCountries as jest.Mock).mockResolvedValue([
            { id: 1, name: 'United States', iso2: 'US' },
            { id: 2, name: 'Canada', iso2: 'CA' },
        ]);

        (getStatesOfCountry as jest.Mock).mockResolvedValue([
            { id: 1, name: 'New York', iso2: 'NY', latitude: '40.71', longitude: '-74.00' },
            { id: 2, name: 'California', iso2: 'CA', latitude: '36.77', longitude: '-119.41' },
        ]);

        createSupabaseMock();
    });

    const defaultProps = {
        visible: false,
        detectedCountry: 'Detected Country',
        detectedCountryCode: 'DC',
        onCitySaved: mockOnCitySaved,
    };

    it('should not initialize or load countries if visible is false', async () => {
        const { result } = renderHook(() => useCitySelection(defaultProps));

        expect(result.current.state.countries).toEqual([]);
        expect(getAllCountries).not.toHaveBeenCalled();
    });

    it('should initialize and load countries if visible is true', async () => {
        const props = { ...defaultProps, visible: true };
        const { result } = renderHook(() => useCitySelection(props));

        expect(result.current.state.loadingCountries).toBe(true);

        await waitFor(() => {
            expect(result.current.state.countries).toHaveLength(2);
        });

        expect(getAllCountries).toHaveBeenCalled();
        expect(result.current.state.currentCountry).toBe('Detected Country');
        expect(result.current.state.currentCountryCode).toBe('DC');
    });

    it('should handle error when loading countries fails', async () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const mockError = new Error('Network error');
        (getAllCountries as jest.Mock).mockRejectedValueOnce(mockError);

        const props = { ...defaultProps, visible: true };
        const { result } = renderHook(() => useCitySelection(props));

        expect(result.current.state.loadingCountries).toBe(true);

        await waitFor(() => {
            expect(result.current.state.loadingCountries).toBe(false);
        });

        expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to load countries:', mockError);
        expect(result.current.state.countries).toEqual([]);

        consoleErrorSpy.mockRestore();
    });

    it('should fetch states when currentCountryCode changes', async () => {
        const props = { ...defaultProps, visible: true, detectedCountryCode: 'US' };
        const { result } = renderHook(() => useCitySelection(props));

        await waitFor(() => {
            expect(result.current.state.states).toHaveLength(2);
        });

        expect(getStatesOfCountry).toHaveBeenCalledWith('US');
    });

    it('should handle error when fetching states fails', async () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const mockError = new Error('Network error');
        (getStatesOfCountry as jest.Mock).mockRejectedValueOnce(mockError);

        const props = { ...defaultProps, visible: true, detectedCountryCode: 'US' };
        const { result } = renderHook(() => useCitySelection(props));

        expect(result.current.state.loadingStates).toBe(true);

        await waitFor(() => {
            expect(result.current.state.loadingStates).toBe(false);
        });

        expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to load states:', mockError);
        expect(result.current.state.states).toEqual([]);

        consoleErrorSpy.mockRestore();
    });

    it('should handle country selection and clear state', async () => {
        const props = { ...defaultProps, visible: true, detectedCountryCode: 'US' };
        const { result } = renderHook(() => useCitySelection(props));

        await waitFor(() => {
            expect(result.current.state.countries).toHaveLength(2);
        });

        act(() => {
            result.current.actions.handleCountrySelect({ id: 2, name: 'Canada' });
        });

        expect(result.current.state.currentCountry).toBe('Canada');
        expect(result.current.state.currentCountryCode).toBe('CA');
        expect(result.current.state.currentState).toBe('');
        expect(getStatesOfCountry).toHaveBeenCalledWith('CA');
    });

    it('should handle state selection', async () => {
        const props = { ...defaultProps, visible: true, detectedCountryCode: 'US' };
        const { result } = renderHook(() => useCitySelection(props));

        await waitFor(() => {
            expect(result.current.state.states).toHaveLength(2);
        });

        act(() => {
            result.current.actions.handleStateSelect({ id: 1, name: 'New York' });
        });

        expect(result.current.state.currentState).toBe('New York');
    });

    it('should properly compute canSave', async () => {
        const props = { ...defaultProps, visible: true, detectedCountryCode: 'US' };
        const { result } = renderHook(() => useCitySelection(props));

        await waitFor(() => {
            expect(result.current.state.states).toHaveLength(2);
        });

        // hasStates is true, currentState is empty -> canSave should be false
        expect(result.current.state.canSave).toBe(false);

        act(() => {
            result.current.actions.handleStateSelect({ id: 1, name: 'New York' });
        });

        // currentState is set -> canSave should be true
        expect(result.current.state.canSave).toBe(true);
    });

    it('should properly compute canSave when there are no states', async () => {
        (getStatesOfCountry as jest.Mock).mockResolvedValue([]);
        const props = { ...defaultProps, visible: true, detectedCountryCode: 'XX' };
        const { result } = renderHook(() => useCitySelection(props));

        await waitFor(() => {
            expect(getStatesOfCountry).toHaveBeenCalledWith('XX');
        });

        // hasStates is false -> canSave should be true
        expect(result.current.state.canSave).toBe(true);
    });

    it('should save properly and call onCitySaved', async () => {
        const { updateMock, eqMock } = createSupabaseMock();
        const props = { ...defaultProps, visible: true, detectedCountryCode: 'US' };
        const { result } = renderHook(() => useCitySelection(props));

        await waitFor(() => {
            expect(result.current.state.states).toHaveLength(2);
        });

        act(() => {
            result.current.actions.handleStateSelect({ id: 1, name: 'New York' });
            result.current.actions.setSelectedCity('NYC');
        });

        await act(async () => {
            await result.current.actions.handleSave();
        });

        expect(supabase.from).toHaveBeenCalledWith('profiles');
        expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({
            city: 'NYC',
            country: 'Detected Country',
            country_code: 'US',
            state: 'New York',
            state_code: 'NY',
            latitude: 40.71,
            longitude: -74.00,
            location_setup_completed: true,
        }));
        expect(eqMock).toHaveBeenCalledWith('id', 'user-123');
        expect(mockRefreshProfile).toHaveBeenCalled();
        expect(mockOnCitySaved).toHaveBeenCalled();
    });

    it('should handle save error gracefully', async () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        createSupabaseMock(new Error('Save Error'));
        const props = { ...defaultProps, visible: true, detectedCountryCode: 'US' };
        const { result } = renderHook(() => useCitySelection(props));

        await waitFor(() => {
            expect(result.current.state.states).toHaveLength(2);
        });

        act(() => {
            result.current.actions.handleStateSelect({ id: 1, name: 'New York' });
        });

        await act(async () => {
            await result.current.actions.handleSave();
        });

        expect(consoleErrorSpy).toHaveBeenCalledWith('Save city error:', expect.any(Error));
        expect(mockRefreshProfile).not.toHaveBeenCalled();
        expect(mockOnCitySaved).not.toHaveBeenCalled();
        expect(result.current.state.saving).toBe(false);

        consoleErrorSpy.mockRestore();
    });
});