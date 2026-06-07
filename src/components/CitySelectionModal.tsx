/**
 * CitySelectionModal
 * Shown on app open if the user's city is not set.
 * Allows searching and selecting a city from the detected country.
 */
import React from 'react';
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
import { SearchablePicker } from './ui';
import { colors, spacing } from '../theme';
import { useCitySelection } from '../hooks/useCitySelection';

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
    const { state, actions } = useCitySelection({
        visible,
        detectedCountry,
        detectedCountryCode,
        onCitySaved,
    });

    const {
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
    } = state;

    const {
        setSelectedCity,
        setCountryPickerVisible,
        setStatePickerVisible,
        handleCountrySelect,
        handleStateSelect,
        handleSave,
    } = actions;

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
