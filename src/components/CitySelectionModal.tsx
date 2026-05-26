/**
 * CitySelectionModal
 * Shown on app open if the user's city is not set.
 * Allows searching and selecting a city from the detected country.
 */
import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    ActivityIndicator,
    Dimensions,
    TextInput,
    Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { SearchablePicker } from './ui';
import { colors, spacing } from '../theme';
import {
    getAllCountries,
    getStatesOfCountry,
    type Country,
    type State,
} from '../utils/locationApi';

const { width } = Dimensions.get('window');

interface CitySelectionModalProps {
    visible: boolean;
    detectedCountry: string;
    detectedCountryCode: string;
    onCitySaved: () => void;
    onDismiss: () => void;
}

export function CitySelectionModal({
    visible,
    detectedCountry,
    detectedCountryCode,
    onCitySaved,
    onDismiss,
}: CitySelectionModalProps) {
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

    useEffect(() => {
        if (visible) {
            setCurrentCountry(detectedCountry);
            setCurrentCountryCode(detectedCountryCode);
            setCurrentState('');
            setCurrentStateCode('');
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
            setSelectedCity('');
        }
    };

    const handleStateSelect = (item: { id: string | number; name: string }) => {
        const found = states.find(s => s.id === item.id);
        if (found) {
            setCurrentState(found.name);
            setCurrentStateCode(found.iso2);
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
            const updateData: Record<string, string | boolean | null> = {
                city: selectedCity.trim() || null,
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

    return (
        <>
            <Modal
                visible={visible}
                transparent
                animationType="fade"
                onRequestClose={() => { /* non-dismissable */ }}
            >
                <View style={styles.overlay}>
                    <View style={styles.card}>
                        {/* Decorative top accent bar */}
                        <View style={styles.accentBar} />

                        {/* Icon */}
                        <View style={styles.iconCircle}>
                            <MaterialIcons name="location-on" size={26} color={colors.white} />
                        </View>

                        {/* Title & subtitle */}
                        <Text style={styles.title}>Set your location</Text>
                        <Text style={styles.subtitle}>
                            Help us connect you with nearby professionals and services.
                        </Text>

                        {/* Country field */}
                        <View style={styles.fieldGroup}>
                            <Text style={styles.fieldLabel}>Country</Text>
                            <TouchableOpacity
                                style={styles.inputRow}
                                onPress={() => setCountryPickerVisible(true)}
                                activeOpacity={0.7}
                            >
                                <MaterialIcons name="flag" size={18} color={colors.textMuted} style={styles.inputIcon} />
                                <Text style={currentCountry ? styles.inputValue : styles.inputPlaceholder} numberOfLines={1}>
                                    {currentCountry || 'Select your country'}
                                </Text>
                                <MaterialIcons name="chevron-right" size={20} color={colors.textMuted} />
                            </TouchableOpacity>
                        </View>

                        {/* State field — only when the country has states */}
                        {(loadingStates || hasStates) && (
                            <View style={styles.fieldGroup}>
                                <Text style={styles.fieldLabel}>State / Region</Text>
                                <TouchableOpacity
                                    style={[
                                        styles.inputRow,
                                        (loadingStates || !hasStates) && styles.inputDisabled,
                                    ]}
                                    onPress={() => hasStates && setStatePickerVisible(true)}
                                    activeOpacity={0.7}
                                    disabled={loadingStates || !hasStates}
                                >
                                    <MaterialIcons name="map" size={18} color={colors.textMuted} style={styles.inputIcon} />
                                    <Text style={currentState ? styles.inputValue : styles.inputPlaceholder} numberOfLines={1}>
                                        {loadingStates
                                            ? 'Loading states…'
                                            : currentState || 'Select your state / region'}
                                    </Text>
                                    {loadingStates ? (
                                        <ActivityIndicator size="small" color={colors.textMuted} />
                                    ) : (
                                        <MaterialIcons name="chevron-right" size={20} color={colors.textMuted} />
                                    )}
                                </TouchableOpacity>
                            </View>
                        )}

                        {/* City field */}
                        <View style={styles.fieldGroup}>
                            <Text style={styles.fieldLabel}>City <Text style={styles.fieldLabelMuted}>(optional)</Text></Text>
                            <View style={[
                                styles.inputRow,
                                !currentCountryCode && styles.inputDisabled,
                            ]}>
                                <MaterialIcons name="location-city" size={18} color={colors.textMuted} style={styles.inputIcon} />
                                <TextInput
                                    style={styles.textInput}
                                    value={selectedCity}
                                    onChangeText={setSelectedCity}
                                    placeholder={currentCountryCode ? 'Type your city name' : 'Select a country first'}
                                    placeholderTextColor={colors.textMuted}
                                    editable={!!currentCountryCode}
                                    autoCapitalize="words"
                                    returnKeyType="done"
                                />
                            </View>
                        </View>

                        {/* Save button */}
                        <TouchableOpacity
                            style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
                            onPress={handleSave}
                            disabled={!canSave || saving}
                            activeOpacity={0.85}
                        >
                            {saving ? (
                                <ActivityIndicator size="small" color={colors.white} />
                            ) : (
                                <Text style={styles.saveBtnText}>Continue</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Country Picker */}
            <SearchablePicker
                visible={countryPickerVisible}
                title="Select Country"
                items={countryPickerItems}
                selectedId={countries.find(c => c.name === currentCountry)?.id}
                onSelect={handleCountrySelect}
                onClose={() => setCountryPickerVisible(false)}
                searchPlaceholder="Search countries..."
                loading={loadingCountries}
                emptyMessage="No countries found"
            />

            {/* State Picker */}
            <SearchablePicker
                visible={statePickerVisible}
                title="Select State / Region"
                items={statePickerItems}
                selectedId={states.find(s => s.name === currentState)?.id}
                onSelect={handleStateSelect}
                onClose={() => setStatePickerVisible(false)}
                searchPlaceholder="Search states..."
                loading={loadingStates}
                emptyMessage="No states available for this country"
            />
        </>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.45)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.lg,
    },
    card: {
        width: width - spacing.lg * 2,
        maxWidth: 380,
        backgroundColor: colors.white,
        borderRadius: 24,
        paddingTop: 0,
        paddingHorizontal: spacing.xl,
        paddingBottom: spacing.xl,
        alignItems: 'center',
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.12,
                shadowRadius: 24,
            },
            android: {
                elevation: 12,
            },
        }),
    },
    accentBar: {
        width: 48,
        height: 4,
        borderRadius: 2,
        backgroundColor: colors.accent,
        marginTop: spacing.md,
        marginBottom: spacing.lg,
    },
    iconCircle: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: colors.black,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.md,
    },
    title: {
        fontSize: 22,
        fontWeight: '700',
        color: colors.text,
        textAlign: 'center',
        marginBottom: 6,
        letterSpacing: -0.3,
    },
    subtitle: {
        fontSize: 14,
        color: colors.textSecondary,
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: spacing.xl,
        paddingHorizontal: spacing.sm,
    },
    fieldGroup: {
        width: '100%',
        marginBottom: spacing.md,
    },
    fieldLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: colors.text,
        marginBottom: 6,
        marginLeft: 2,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    fieldLabelMuted: {
        fontSize: 11,
        fontWeight: '400',
        color: colors.textMuted,
        textTransform: 'none',
        letterSpacing: 0,
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.inputBackground,
        borderRadius: 14,
        paddingHorizontal: spacing.md,
        paddingVertical: Platform.OS === 'ios' ? 14 : 10,
        borderWidth: 1,
        borderColor: colors.border,
    },
    inputDisabled: {
        opacity: 0.45,
    },
    inputIcon: {
        marginRight: spacing.sm,
    },
    inputValue: {
        flex: 1,
        fontSize: 15,
        color: colors.text,
        fontWeight: '500',
    },
    inputPlaceholder: {
        flex: 1,
        fontSize: 15,
        color: colors.textMuted,
    },
    textInput: {
        flex: 1,
        fontSize: 15,
        color: colors.text,
        padding: 0,
        fontWeight: '500',
    },
    saveBtn: {
        width: '100%',
        backgroundColor: colors.black,
        borderRadius: 14,
        paddingVertical: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: spacing.lg,
    },
    saveBtnDisabled: {
        backgroundColor: '#D1D5DB',
    },
    saveBtnText: {
        fontSize: 16,
        fontWeight: '700',
        color: colors.white,
        letterSpacing: 0.3,
    },
});
