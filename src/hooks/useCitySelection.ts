import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { TablesUpdate } from '../types/database';
import {
    getAllCountries,
    getStatesOfCountry,
    type Country,
    type State,
} from '../utils/locationApi';

interface UseCitySelectionProps {
    visible: boolean;
    detectedCountry: string;
    detectedCountryCode: string;
    onCitySaved: () => void;
}

export function useCitySelection({
    visible,
    detectedCountry,
    detectedCountryCode,
    onCitySaved,
}: UseCitySelectionProps) {
    const { profile, refreshProfile } = useAuth();
    const [selectedCity, setSelectedCity] = useState('');
    const [countries, setCountries] = useState<Country[]>([]);
    const [states, setStates] = useState<State[]>([]);
    const [loadingCountries, setLoadingCountries] = useState(false);
    const [loadingStates, setLoadingStates] = useState(false);
    const [saving, setSaving] = useState(false);
    const [countryPickerVisible, setCountryPickerVisible] = useState(false);
    const [statePickerVisible, setStatePickerVisible] = useState(false);

    // Local state for country selection (in case user wants to change)
    const [currentCountry, setCurrentCountry] = useState(detectedCountry);
    const [currentCountryCode, setCurrentCountryCode] = useState(detectedCountryCode);
    const [currentState, setCurrentState] = useState('');
    const [currentStateCode, setCurrentStateCode] = useState('');
    const [currentStateLat, setCurrentStateLat] = useState<string | null>(null);
    const [currentStateLng, setCurrentStateLng] = useState<string | null>(null);

    useEffect(() => {
        if (visible) {
            setCurrentCountry(detectedCountry);
            setCurrentCountryCode(detectedCountryCode);
            setCurrentState('');
            setCurrentStateCode('');
            setCurrentStateLat(null);
            setCurrentStateLng(null);
            setSelectedCity('');

            // Load countries
            if (countries.length === 0) {
                loadCountries();
            }
        }
    }, [visible, detectedCountry, detectedCountryCode]);

    // Load states whenever country code changes
    useEffect(() => {
        if (!currentCountryCode) {
            setStates([]);
            return;
        }
        let cancelled = false;
        setLoadingStates(true);
        getStatesOfCountry(currentCountryCode)
            .then(data => {
                if (!cancelled) setStates(data);
            })
            .catch(e => console.error('Failed to load states:', e))
            .finally(() => {
                if (!cancelled) setLoadingStates(false);
            });
        return () => { cancelled = true; };
    }, [currentCountryCode]);

    const loadCountries = async () => {
        setLoadingCountries(true);
        try {
            const data = await getAllCountries();
            setCountries(data);
        } catch (e) {
            console.error('Failed to load countries:', e);
        } finally {
            setLoadingCountries(false);
        }
    };

    const handleCountrySelect = (item: { id: string | number; name: string }) => {
        const found = countries.find(c => c.id === item.id);
        if (found) {
            setCurrentCountry(found.name);
            setCurrentCountryCode(found.iso2);
            setCurrentState('');
            setCurrentStateCode('');
            setCurrentStateLat(null);
            setCurrentStateLng(null);
            setSelectedCity('');
        }
    };

    const handleStateSelect = (item: { id: string | number; name: string }) => {
        const found = states.find(s => s.id === item.id);
        if (found) {
            setCurrentState(found.name);
            setCurrentStateCode(found.iso2);
            setCurrentStateLat(found.latitude);
            setCurrentStateLng(found.longitude);
        }
    };

    const hasStates = states.length > 0;

    const handleSave = async () => {
        if (!profile?.id) return;
        if (!currentCountryCode) return;
        // If states exist for this country, require state selection
        if (hasStates && !currentState) return;

        setSaving(true);
        try {
            const updateData: TablesUpdate<'profiles'> = {
                city: selectedCity.trim() || null,
                latitude: currentStateLat ? parseFloat(currentStateLat) : null,
                longitude: currentStateLng ? parseFloat(currentStateLng) : null,
                location_setup_completed: true,
                updated_at: new Date().toISOString(),
            };

            if (currentCountry) updateData.country = currentCountry;
            if (currentCountryCode) updateData.country_code = currentCountryCode;
            updateData.state = currentState || null;
            updateData.state_code = currentStateCode || null;

            const { error } = await supabase
                .from('profiles')
                .update(updateData)
                .eq('id', profile.id);

            if (error) throw error;

            await refreshProfile?.();
            onCitySaved();
        } catch (error: any) {
            console.error('Save city error:', error);
        } finally {
            setSaving(false);
        }
    };

    const canSave =
        !!currentCountryCode &&
        (!hasStates || !!currentState);

    const countryPickerItems = countries.map(c => ({
        id: c.id,
        name: c.name,
        subtitle: c.iso2,
    }));

    const statePickerItems = states.map(s => ({
        id: s.id,
        name: s.name,
        subtitle: s.iso2,
    }));

    return {
        state: {
            selectedCity,
            countries,
            states,
            loadingCountries,
            loadingStates,
            saving,
            countryPickerVisible,
            statePickerVisible,
            currentCountry,
            currentCountryCode,
            currentState,
            hasStates,
            canSave,
            countryPickerItems,
            statePickerItems,
        },
        actions: {
            setSelectedCity,
            setCountryPickerVisible,
            setStatePickerVisible,
            handleCountrySelect,
            handleStateSelect,
            handleSave,
        }
    };
}
