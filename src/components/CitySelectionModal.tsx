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
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { SearchablePicker } from './ui';
import { Card, MerakiText } from './ui';
import { colors, spacing, gradients } from '../theme';
import {
    getAllCountries,
    getCitiesOfCountry,
    type Country,
    type City,
} from '../utils/locationApi';

const { width, height } = Dimensions.get('window');

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
    const [cities, setCities] = useState<City[]>([]);
    const [countries, setCountries] = useState<Country[]>([]);
    const [loadingCities, setLoadingCities] = useState(false);
    const [loadingCountries, setLoadingCountries] = useState(false);
    const [saving, setSaving] = useState(false);
    const [cityPickerVisible, setCityPickerVisible] = useState(false);
    const [countryPickerVisible, setCountryPickerVisible] = useState(false);

    // Local state for country selection (in case user wants to change)
    const [currentCountry, setCurrentCountry] = useState(detectedCountry);
    const [currentCountryCode, setCurrentCountryCode] = useState(detectedCountryCode);

    useEffect(() => {
        if (visible) {
            setCurrentCountry(detectedCountry);
            setCurrentCountryCode(detectedCountryCode);
            setSelectedCity('');

            // Load countries
            if (countries.length === 0) {
                loadCountries();
            }

            // Load cities for detected country
            if (detectedCountryCode) {
                loadCities(detectedCountryCode);
            }
        }
    }, [visible, detectedCountry, detectedCountryCode]);

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

    const loadCities = async (countryCode: string) => {
        setLoadingCities(true);
        setCities([]);
        try {
            const data = await getCitiesOfCountry(countryCode);
            setCities(data);
        } catch (e) {
            console.error('Failed to load cities:', e);
        } finally {
            setLoadingCities(false);
        }
    };

    const handleCountrySelect = (item: { id: string | number; name: string }) => {
        const found = countries.find(c => c.id === item.id);
        if (found) {
            setCurrentCountry(found.name);
            setCurrentCountryCode(found.iso2);
            setSelectedCity('');
            loadCities(found.iso2);
        }
    };

    const handleCitySelect = (item: { id: string | number; name: string }) => {
        setSelectedCity(item.name);
    };

    const handleSave = async () => {
        if (!selectedCity.trim() || !profile?.id) return;

        setSaving(true);
        try {
            const updateData: Record<string, string> = {
                city: selectedCity.trim(),
                updated_at: new Date().toISOString(),
            };

            // Also update country if it was changed
            if (currentCountry) {
                updateData.country = currentCountry;
            }
            if (currentCountryCode) {
                updateData.country_code = currentCountryCode;
            }

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

    const countryPickerItems = countries.map(c => ({
        id: c.id,
        name: c.name,
        subtitle: c.iso2,
    }));

    const cityPickerItems = cities.map(c => ({
        id: c.id,
        name: c.name,
        subtitle: c.state_name || undefined,
    }));

    return (
        <>
            <Modal
                visible={visible}
                transparent
                animationType="fade"
                onRequestClose={onDismiss}
            >
                <View style={styles.overlay}>
                    <View style={styles.container}>
                        <LinearGradient
                            colors={['rgba(30, 20, 50, 0.98)', 'rgba(18, 10, 35, 0.99)']}
                            style={styles.gradient}
                        >
                            {/* Header Icon */}
                            <View style={styles.iconContainer}>
                                <LinearGradient
                                    colors={[gradients.primary[0], gradients.primary[1]]}
                                    style={styles.iconGradient}
                                >
                                    <MaterialIcons name="location-on" size={28} color="#fff" />
                                </LinearGradient>
                            </View>

                            {/* Title */}
                            <MerakiText variant="h2" style={styles.title}>
                                Select Your City
                            </MerakiText>
                            <MerakiText style={styles.subtitle}>
                                Please select your city to enable location-based features like nearby masters and services.
                            </MerakiText>

                            {/* Country Display / Selector */}
                            <View style={styles.fieldGroup}>
                                <MerakiText style={styles.fieldLabel}>Country</MerakiText>
                                <TouchableOpacity
                                    onPress={() => setCountryPickerVisible(true)}
                                >
                                    <Card variant="glass" style={styles.selectorCard}>
                                        <View style={styles.selectorRow}>
                                            <MaterialIcons name="flag" size={18} color={colors.primary} />
                                            <MerakiText style={currentCountry ? styles.selectorText : styles.selectorPlaceholder}>
                                                {currentCountry || 'Select your country'}
                                            </MerakiText>
                                        </View>
                                        <MaterialIcons name="expand-more" size={20} color={colors.textMuted} />
                                    </Card>
                                </TouchableOpacity>
                            </View>

                            {/* City Selector */}
                            <View style={styles.fieldGroup}>
                                <MerakiText style={styles.fieldLabel}>City *</MerakiText>
                                <TouchableOpacity
                                    onPress={() => currentCountryCode && setCityPickerVisible(true)}
                                    disabled={!currentCountryCode}
                                >
                                    <Card variant="glass" style={[
                                        styles.selectorCard,
                                        !currentCountryCode && styles.selectorDisabled
                                    ]}>
                                        <View style={styles.selectorRow}>
                                            <MaterialIcons name="location-city" size={18} color={colors.primary} />
                                            <MerakiText style={selectedCity ? styles.selectorText : styles.selectorPlaceholder}>
                                                {selectedCity || (currentCountryCode ? 'Search and select your city' : 'Select country first')}
                                            </MerakiText>
                                        </View>
                                        {loadingCities ? (
                                            <ActivityIndicator size="small" color={colors.primary} />
                                        ) : (
                                            <MaterialIcons name="expand-more" size={20} color={colors.textMuted} />
                                        )}
                                    </Card>
                                </TouchableOpacity>
                            </View>

                            {/* Buttons */}
                            <View style={styles.buttonContainer}>
                                <TouchableOpacity
                                    style={[styles.saveButton, !selectedCity && styles.saveButtonDisabled]}
                                    onPress={handleSave}
                                    disabled={!selectedCity || saving}
                                    activeOpacity={0.8}
                                >
                                    <LinearGradient
                                        colors={selectedCity
                                            ? [gradients.primary[0], gradients.primary[1]]
                                            : ['rgba(100,100,100,0.3)', 'rgba(80,80,80,0.3)']
                                        }
                                        style={styles.saveButtonGradient}
                                    >
                                        {saving ? (
                                            <ActivityIndicator size="small" color="#fff" />
                                        ) : (
                                            <MerakiText style={styles.saveButtonText}>Save City</MerakiText>
                                        )}
                                    </LinearGradient>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.skipButton}
                                    onPress={onDismiss}
                                    activeOpacity={0.7}
                                >
                                    <MerakiText style={styles.skipButtonText}>Skip for now</MerakiText>
                                </TouchableOpacity>
                            </View>
                        </LinearGradient>
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

            {/* City Picker */}
            <SearchablePicker
                visible={cityPickerVisible}
                title="Select City"
                items={cityPickerItems}
                selectedId={cities.find(c => c.name === selectedCity)?.id}
                onSelect={handleCitySelect}
                onClose={() => setCityPickerVisible(false)}
                searchPlaceholder="Search cities..."
                loading={loadingCities}
                emptyMessage={cities.length === 0 ? 'Loading cities...' : 'No cities found'}
            />
        </>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.lg,
    },
    container: {
        width: width - spacing.lg * 2,
        maxWidth: 400,
        borderRadius: 28,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(200, 160, 77, 0.15)',
    },
    gradient: {
        padding: spacing.xl,
        alignItems: 'center',
    },
    iconContainer: {
        marginBottom: spacing.lg,
    },
    iconGradient: {
        width: 60,
        height: 60,
        borderRadius: 30,
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        color: colors.text,
        marginBottom: spacing.sm,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 14,
        color: colors.textSecondary,
        textAlign: 'center',
        marginBottom: spacing.xl,
        lineHeight: 20,
        paddingHorizontal: spacing.sm,
    },
    fieldGroup: {
        width: '100%',
        marginBottom: spacing.md,
    },
    fieldLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: colors.textSecondary,
        marginBottom: spacing.xs,
        marginLeft: 4,
    },
    selectorCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: spacing.md,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    selectorRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        flex: 1,
    },
    selectorText: {
        fontSize: 15,
        color: colors.text,
        flex: 1,
    },
    selectorPlaceholder: {
        fontSize: 15,
        color: colors.textMuted,
        flex: 1,
    },
    selectorDisabled: {
        opacity: 0.5,
    },
    buttonContainer: {
        width: '100%',
        marginTop: spacing.lg,
        gap: spacing.md,
    },
    saveButton: {
        borderRadius: 16,
        overflow: 'hidden',
    },
    saveButtonDisabled: {
        opacity: 0.6,
    },
    saveButtonGradient: {
        paddingVertical: spacing.md,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 16,
    },
    saveButtonText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#fff',
        letterSpacing: 0.5,
    },
    skipButton: {
        paddingVertical: spacing.sm,
        alignItems: 'center',
    },
    skipButtonText: {
        fontSize: 14,
        color: colors.textMuted,
        fontWeight: '500',
    },
});
