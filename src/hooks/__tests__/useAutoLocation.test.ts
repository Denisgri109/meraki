import { renderHook, act, waitFor } from '@testing-library/react-native';
import * as Location from 'expo-location';
import { useAutoLocation } from '../useAutoLocation';
import { useAuth } from '../../contexts/AuthContext';
import { getDeviceTimezone } from '../../utils/timezone';
import { getAllCountries } from '../../utils/locationApi';
import { supabase } from '../../lib/supabase';

// Mock dependencies
jest.mock('../../contexts/AuthContext');
jest.mock('../../utils/timezone');
jest.mock('../../utils/locationApi');

jest.mock('../../lib/supabase', () => ({
    supabase: {
        from: jest.fn(),
    },
}));

describe('useAutoLocation', () => {
    const mockRefreshProfile = jest.fn();
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
            timezone: null,
            country: null,
            country_code: null,
            city: null,
        };

        (useAuth as jest.Mock).mockReturnValue({
            profile: mockProfile,
            refreshProfile: mockRefreshProfile,
        });

        (getDeviceTimezone as jest.Mock).mockReturnValue('America/New_York');

        (getAllCountries as jest.Mock).mockResolvedValue([
            { name: 'United States', iso2: 'US' },
            { name: 'Ireland', iso2: 'IE' },
        ]);

        // Default location mocks
        (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
            status: 'granted',
        });
        (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValue({
            coords: { latitude: 40.7128, longitude: -74.006 },
        });
        (Location.reverseGeocodeAsync as jest.Mock).mockResolvedValue([
            { country: 'United States' },
        ]);

        createSupabaseMock();
    });

    it('should not do anything if profile is not loaded', async () => {
        (useAuth as jest.Mock).mockReturnValue({
            profile: null,
            refreshProfile: mockRefreshProfile,
        });

        const { result } = renderHook(() => useAutoLocation());

        await waitFor(() => {
            expect(getDeviceTimezone).not.toHaveBeenCalled();
            expect(supabase.from).not.toHaveBeenCalled();
            expect(result.current.isCityMissing).toBe(false);
        });
    });

    it('should detect timezone and country, and update profile', async () => {
        const { updateMock, eqMock } = createSupabaseMock();

        const { result } = renderHook(() => useAutoLocation());

        await waitFor(() => {
            expect(result.current.detectedTimezone).toBe('America/New_York');
            expect(result.current.detectedCountry).toBe('United States');
            expect(result.current.detectedCountryCode).toBe('US');
        });

        expect(Location.requestForegroundPermissionsAsync).toHaveBeenCalled();
        expect(supabase.from).toHaveBeenCalledWith('profiles');
        expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({
            timezone: 'America/New_York',
            country: 'United States',
            country_code: 'US',
            latitude: 40.7128,
            longitude: -74.006,
        }));
        expect(eqMock).toHaveBeenCalledWith('id', 'user-123');
        expect(mockRefreshProfile).toHaveBeenCalled();
        expect(result.current.isCityMissing).toBe(true); // Since city is null
    });

    it('should handle location permission denied', async () => {
        (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
            status: 'denied',
        });
        const { updateMock } = createSupabaseMock();

        const { result } = renderHook(() => useAutoLocation());

        await waitFor(() => {
            expect(result.current.detectedTimezone).toBe('America/New_York');
            // Shouldn't detect country
            expect(result.current.detectedCountry).toBe('');
        });

        // Should still update timezone
        expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({
            timezone: 'America/New_York',
        }));
        // Should not contain country data
        expect(updateMock).not.toHaveBeenCalledWith(expect.objectContaining({
            country: expect.any(String),
        }));
    });

    it('should not update if timezone and country are already set', async () => {
        mockProfile = {
            id: 'user-123',
            timezone: 'America/New_York',
            country: 'United States',
            country_code: 'US',
            city: 'New York', location_setup_completed: true,
        };
        (useAuth as jest.Mock).mockReturnValue({
            profile: mockProfile,
            refreshProfile: mockRefreshProfile,
        });

        const { result } = renderHook(() => useAutoLocation());

        await waitFor(() => {
            expect(result.current.detectedCountry).toBe('United States');
            expect(result.current.detectedCountryCode).toBe('US');
        });

        expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
        expect(supabase.from).not.toHaveBeenCalled();
        expect(result.current.isCityMissing).toBe(false);
    });

    it('should handle Supabase update error gracefully', async () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        createSupabaseMock(new Error('Supabase error'));

        const { result } = renderHook(() => useAutoLocation());

        await waitFor(() => {
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                'Auto-location update error:',
                expect.any(Error)
            );
        });

        expect(mockRefreshProfile).not.toHaveBeenCalled();
        expect(result.current.isCityMissing).toBe(true);

        consoleErrorSpy.mockRestore();
    });

    it('should allow dismissing city modal', async () => {
        const { result } = renderHook(() => useAutoLocation());

        await waitFor(() => {
            expect(result.current.isCityMissing).toBe(true);
        });

        act(() => {
            result.current.dismissCityModal();
        });

        expect(result.current.isCityMissing).toBe(false);

        act(() => {
            result.current.onCitySaved();
        });

        expect(result.current.isCityMissing).toBe(false);
    });

    it('should handle location API throwing an error', async () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        (Location.getCurrentPositionAsync as jest.Mock).mockRejectedValue(new Error('Location error'));

        const { result } = renderHook(() => useAutoLocation());

        await waitFor(() => {
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                'Location detection error:',
                expect.any(Error)
            );
            expect(result.current.isCityMissing).toBe(true);
        });

        consoleErrorSpy.mockRestore();
    });

    it('should handle detection error and still check location setup status', async () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const mockError = new Error('Timezone detection error');

        // Mock getDeviceTimezone to throw an error to simulate a detection failure
        (getDeviceTimezone as jest.Mock).mockImplementationOnce(() => {
            throw mockError;
        });

        const { result } = renderHook(() => useAutoLocation());

        await waitFor(() => {
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                'Auto-location detection error:',
                mockError
            );
            // Verify that checkLocationSetupStatus was still called
            expect(result.current.isCityMissing).toBe(true);
        });

        consoleErrorSpy.mockRestore();
    });
});
