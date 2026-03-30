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
                        try {
                            const location = await Location.getCurrentPositionAsync({
                                accuracy: Location.Accuracy.Low,
                            });
                            const [reverseGeocode] = await Location.reverseGeocodeAsync({
                                latitude: location.coords.latitude,
                                longitude: location.coords.longitude,
                            });

                            // Store GPS coordinates in profile for distance-based filtering
                            updates.latitude = location.coords.latitude;
                            updates.longitude = location.coords.longitude;

                            if (reverseGeocode?.country) {
                                setDetectedCountry(reverseGeocode.country);
                                updates.country = reverseGeocode.country;

                                // Try to find ISO2 code from countries API
                                try {
                                    const allCountries = await getAllCountries();
                                    const found = allCountries.find(
                                        c => c.name.toLowerCase() === reverseGeocode.country?.toLowerCase()
                                    );
                                    if (found) {
                                        setDetectedCountryCode(found.iso2);
                                        updates.country_code = found.iso2;
                                    }
                                } catch (e) {
                                    console.log('Could not resolve country code:', e);
                                }
                            }
                        } catch (locErr) {
                            console.log('Location detection error:', locErr);
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

                // 4. Check if city is missing
                if (!profile.city) {
                    setIsCityMissing(true);
                }
            } catch (err) {
                console.error('Auto-location detection error:', err);
                // Still check city even if detection fails
                if (!profile.city) {
                    setIsCityMissing(true);
                }
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
