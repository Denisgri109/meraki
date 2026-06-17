/**
 * useAutoLocation hook
 * Automatically detects country + timezone on app launch and saves to profile.
 * Returns isCityMissing to trigger city selection modal.
 */
import { useEffect, useState, useRef } from 'react';
import * as Location from 'expo-location';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { getDeviceTimezone } from '../utils/timezone';
import { getAllCountries, type Country } from '../utils/locationApi';

async function detectLocationData() {
    try {
        const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Low,
        });
        const [reverseGeocode] = await Location.reverseGeocodeAsync({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
        });

        let detectedCountry = reverseGeocode?.country || undefined;
        let detectedIso2: string | undefined = undefined;

        if (detectedCountry) {
            try {
                const allCountries = await getAllCountries();
                const found = allCountries.find(
                    c => c.name.toLowerCase() === detectedCountry?.toLowerCase()
                );
                if (found) {
                    detectedIso2 = found.iso2;
                }
            } catch (e) {
                console.error('Could not resolve country code:', e);
            }
        }

        return {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            country: detectedCountry,
            iso2: detectedIso2,
        };
    } catch (locErr) {
        console.error('Location detection error:', locErr);
        return null;
    }
}

export function useAutoLocation() {
    const { profile, refreshProfile } = useAuth();
    const [isCityMissing, setIsCityMissing] = useState(false);
    const [detectedCountry, setDetectedCountry] = useState<string>('');
    const [detectedCountryCode, setDetectedCountryCode] = useState<string>('');
    const [detectedTimezone, setDetectedTimezone] = useState<string>('');
    const hasRun = useRef(false);

    useEffect(() => {
        if (!profile?.id || hasRun.current) return;
        hasRun.current = true;

        const detectAndSave = async () => {
            try {
                const updates: Record<string, any> = {};

                // 1. Auto-detect timezone (no permission needed)
                const deviceTimezone = getDeviceTimezone();
                if (deviceTimezone && deviceTimezone !== 'UTC') {
                    setDetectedTimezone(deviceTimezone);
                    if (!profile.timezone) {
                        updates.timezone = deviceTimezone;
                    }
                }

                // 2. Auto-detect country via expo-location
                if (!profile.country) {
                    const { status } = await Location.requestForegroundPermissionsAsync();
                    if (status === 'granted') {
                        const locationData = await detectLocationData();
                        if (locationData) {
                            updates.latitude = locationData.latitude;
                            updates.longitude = locationData.longitude;

                            if (locationData.country) {
                                setDetectedCountry(locationData.country);
                                updates.country = locationData.country;

                                if (locationData.iso2) {
                                    setDetectedCountryCode(locationData.iso2);
                                    updates.country_code = locationData.iso2;
                                }
                            }
                        }
                    }
                } else {
                    // Country already set, store it locally
                    setDetectedCountry(profile.country);
                    if (profile.country_code) {
                        setDetectedCountryCode(profile.country_code);
                    }
                }

                // 3. Save updates to profile if anything changed
                if (Object.keys(updates).length > 0 && profile.id) {
                    const { error } = await supabase
                        .from('profiles')
                        .update({
                            ...updates,
                            updated_at: new Date().toISOString(),
                        })
                        .eq('id', profile.id);

                    if (!error) {
                        await refreshProfile?.();
                    } else {
                        console.error('Auto-location update error:', error);
                    }
                }

                // 4. Gate the modal until the user has finished location setup
                checkLocationSetupStatus();
            } catch (err) {
                console.error('Auto-location detection error:', err);
                // Still gate even if detection fails
                checkLocationSetupStatus();
            }
        };

        const checkLocationSetupStatus = () => {
            // Gate the modal until the user has finished location setup
            // (country must be set AND they've been through the modal once,
            // so state/region is captured for radius filtering).
            const setupDone = (profile as any).location_setup_completed === true;
            if (!profile.country || !setupDone) {
                setIsCityMissing(true);
            }
        };

        detectAndSave();
    }, [profile?.id]);

    const dismissCityModal = () => {
        setIsCityMissing(false);
    };

    const onCitySaved = () => {
        setIsCityMissing(false);
    };

    return {
        isCityMissing,
        detectedCountry,
        detectedCountryCode,
        detectedTimezone,
        dismissCityModal,
        onCitySaved,
    };
}
