import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    TextInput,
    Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Card, Button, ScreenBackground } from '../../components/ui';
import { colors, spacing } from '../../theme';
import {
    COMMON_TIMEZONES,
    SUPPORTED_CURRENCIES,
    COMMON_COUNTRIES,
} from '../../utils/timezone';

type PickerType = 'timezone' | 'currency' | 'country' | null;

export function MasterSettingsScreen() {
    const navigation = useNavigation();
    const { user, profile, refreshProfile } = useAuth();

    const [timezone, setTimezone] = useState(profile?.timezone || 'Europe/London');
    const [currency, setCurrency] = useState(profile?.currency || 'EUR');
    const [city, setCity] = useState(profile?.city || '');
    const [country, setCountry] = useState(profile?.country || '');

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [pickerVisible, setPickerVisible] = useState<PickerType>(null);

    // Mapping of country codes to currencies
    const COUNTRY_CURRENCY_MAP: Record<string, string> = {
        GB: 'GBP', US: 'USD', DE: 'EUR', FR: 'EUR', ES: 'EUR', IT: 'EUR',
        NL: 'EUR', BE: 'EUR', AT: 'EUR', CH: 'CHF', PL: 'EUR', PT: 'EUR',
        IE: 'EUR', SE: 'EUR', DK: 'EUR', NO: 'EUR', FI: 'EUR', CA: 'CAD',
        AU: 'AUD', NZ: 'NZD', JP: 'JPY', SG: 'SGD', AE: 'AED', BR: 'BRL',
        RU: 'RUB', CN: 'CNY', KR: 'KRW', IN: 'INR', MX: 'MXN', ZA: 'ZAR',
    };

    useEffect(() => {
        if (profile) {
            setTimezone(profile.timezone || 'Europe/London');
            setCurrency(profile.currency || 'EUR');
            setCity(profile.city || '');
            setCountry(profile.country || '');
        }
    }, [profile]);



    const handleSave = async () => {
        if (!user) return;

        setSaving(true);
        try {
            const { error } = await supabase
                .from('profiles')
                .update({
                    timezone,
                    currency,
                    city: city.trim() || null,
                    country: country || null,
                })
                .eq('id', user.id);

            if (error) throw error;

            await refreshProfile();
            Alert.alert('Success', 'Your settings have been saved');
        } catch (error: any) {
            Alert.alert('Error', error.message);
        } finally {
            setSaving(false);
        }
    };

    const getSelectedTimezoneLabel = () => {
        const tz = COMMON_TIMEZONES.find(t => t.value === timezone);
        return tz?.label || timezone;
    };

    const getSelectedCurrencyLabel = () => {
        const curr = SUPPORTED_CURRENCIES.find(c => c.value === currency);
        return curr?.label || currency;
    };

    const getSelectedCountryLabel = () => {
        if (!country) return 'Select country...';
        const c = COMMON_COUNTRIES.find(co => co.value === country);
        return c?.label || country;
    };

    const renderPicker = () => {
        if (!pickerVisible) return null;

        let items: { value: string; label: string }[] = [];
        let title = '';
        let onSelect: (value: string) => void = () => { };

        switch (pickerVisible) {
            case 'timezone':
                items = COMMON_TIMEZONES;
                title = 'Select Timezone';
                onSelect = (value) => {
                    setTimezone(value);
                    setPickerVisible(null);
                };
                break;
            case 'currency':
                items = SUPPORTED_CURRENCIES;
                title = 'Select Currency';
                onSelect = (value) => {
                    setCurrency(value);
                    setPickerVisible(null);
                };
                break;
            case 'country':
                items = COMMON_COUNTRIES;
                title = 'Select Country';
                onSelect = (value) => {
                    setCountry(value);
                    setPickerVisible(null);
                };
                break;
        }

        const currentValue = pickerVisible === 'timezone' ? timezone :
            pickerVisible === 'currency' ? currency : country;

        return (
            <Modal
                visible={true}
                transparent
                animationType="slide"
                onRequestClose={() => setPickerVisible(null)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setPickerVisible(null)}
                >
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{title}</Text>
                            <TouchableOpacity onPress={() => setPickerVisible(null)}>
                                <Text style={styles.modalClose}>✕</Text>
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={styles.optionsScroll}>
                            {items.map((item) => {
                                const isSelected = item.value === currentValue;
                                return (
                                    <TouchableOpacity
                                        key={item.value}
                                        style={[
                                            styles.optionItem,
                                            isSelected && styles.optionItemSelected
                                        ]}
                                        onPress={() => onSelect(item.value)}
                                    >
                                        <Text style={[
                                            styles.optionText,
                                            isSelected && styles.optionTextSelected
                                        ]}>
                                            {item.label}
                                        </Text>
                                        {isSelected && (
                                            <Text style={styles.checkmark}>✓</Text>
                                        )}
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </View>
                </TouchableOpacity>
            </Modal>
        );
    };

    return (
        <ScreenBackground>
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <Text style={styles.backButtonText}>← Back</Text>
                    </TouchableOpacity>
                    <View>
                        <Text style={styles.title}>Settings</Text>
                        <Text style={styles.subtitle}>Configure your global marketplace settings</Text>
                    </View>
                </View>

                <ScrollView contentContainerStyle={styles.content}>
                    {/* Timezone Section */}
                    <Card style={styles.section}>
                        <Text style={styles.sectionTitle}>🌍 Time Zone</Text>
                        <Text style={styles.sectionDescription}>
                            Set your local timezone. Clients will see availability in their local time.
                        </Text>
                        <TouchableOpacity
                            style={styles.selector}
                            onPress={() => setPickerVisible('timezone')}
                        >
                            <Text style={styles.selectorText}>{getSelectedTimezoneLabel()}</Text>
                            <Text style={styles.selectorArrow}>›</Text>
                        </TouchableOpacity>
                    </Card>

                    {/* Currency Section */}
                    <Card style={styles.section}>
                        <Text style={styles.sectionTitle}>💰 Currency</Text>
                        <Text style={styles.sectionDescription}>
                            Your preferred currency for service pricing and payouts.
                        </Text>
                        <TouchableOpacity
                            style={styles.selector}
                            onPress={() => setPickerVisible('currency')}
                        >
                            <Text style={styles.selectorText}>{getSelectedCurrencyLabel()}</Text>
                            <Text style={styles.selectorArrow}>›</Text>
                        </TouchableOpacity>
                    </Card>

                    {/* Location Section */}
                    <Card style={styles.section}>
                        <Text style={styles.sectionTitle}>📍 Location</Text>
                        <Text style={styles.sectionDescription}>
                            Your city and country will be shown to clients so they know where you're based.
                        </Text>

                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>City</Text>
                            <TextInput
                                style={styles.textInput}
                                value={city}
                                onChangeText={setCity}
                                placeholder="e.g., London"
                                placeholderTextColor={colors.textMuted}
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Country</Text>
                            <TouchableOpacity
                                style={styles.selector}
                                onPress={() => setPickerVisible('country')}
                            >
                                <Text style={[
                                    styles.selectorText,
                                    !country && styles.selectorPlaceholder
                                ]}>
                                    {getSelectedCountryLabel()}
                                </Text>
                                <Text style={styles.selectorArrow}>›</Text>
                            </TouchableOpacity>
                        </View>
                    </Card>

                    {/* Stripe Connect Status (Read-only for now) */}
                    <Card style={styles.section}>
                        <Text style={styles.sectionTitle}>💳 Payment Setup</Text>
                        <View style={styles.statusRow}>
                            <View style={[styles.statusBadge, styles.statusPending]}>
                                <Text style={styles.statusBadgeText}>Coming Soon</Text>
                            </View>
                            <Text style={styles.statusText}>
                                Stripe Connect integration for direct payouts will be available soon.
                            </Text>
                        </View>
                    </Card>
                </ScrollView>

                <View style={styles.bottomBar}>
                    <Button
                        title={saving ? 'Saving...' : 'Save Changes'}
                        onPress={handleSave}
                        loading={saving}
                        fullWidth
                    />
                </View>

                {renderPicker()}
            </SafeAreaView>
        </ScreenBackground>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.lg,
        paddingBottom: spacing.md,
    },
    backButton: {
        marginBottom: spacing.sm,
        alignSelf: 'flex-start',
        paddingVertical: spacing.xs,
        paddingHorizontal: spacing.xs,
        marginLeft: -spacing.xs,
    },
    backButtonText: { fontSize: 16, color: colors.primary, fontWeight: '500' },
    title: { fontSize: 28, fontWeight: '600', color: colors.text },
    subtitle: { fontSize: 14, color: colors.textSecondary, marginTop: spacing.xs },
    content: { padding: spacing.lg, paddingBottom: 100 },

    section: { marginBottom: spacing.lg, padding: spacing.lg },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: colors.text,
        marginBottom: spacing.xs,
    },
    sectionDescription: {
        fontSize: 14,
        color: colors.textSecondary,
        marginBottom: spacing.md,
    },

    selector: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 12,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: colors.border,
    },
    selectorText: {
        fontSize: 16,
        color: colors.text,
        flex: 1,
    },
    selectorPlaceholder: {
        color: colors.textMuted,
    },
    selectorArrow: {
        fontSize: 20,
        color: colors.textMuted,
        marginLeft: spacing.sm,
    },

    inputGroup: { marginBottom: spacing.md },
    inputLabel: {
        fontSize: 12,
        color: colors.textSecondary,
        marginBottom: spacing.xs,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    textInput: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 12,
        padding: spacing.md,
        fontSize: 16,
        color: colors.text,
        borderWidth: 1,
        borderColor: colors.border,
    },

    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    statusBadge: {
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: 8,
    },
    statusPending: {
        backgroundColor: 'rgba(251, 191, 36, 0.2)',
    },
    statusBadgeText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#FCD34D',
    },
    statusText: {
        fontSize: 14,
        color: colors.textSecondary,
        flex: 1,
    },

    bottomBar: {
        padding: spacing.lg,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },

    // Modal styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: colors.surface,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: '70%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: colors.text,
    },
    modalClose: {
        fontSize: 20,
        color: colors.textMuted,
        padding: spacing.sm,
    },
    optionsScroll: {
        padding: spacing.md,
    },
    optionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.md,
        borderRadius: 8,
        marginBottom: spacing.xs,
    },
    optionItemSelected: {
        backgroundColor: 'rgba(139, 92, 246, 0.2)',
    },
    optionText: {
        fontSize: 16,
        color: colors.text,
        flex: 1,
    },
    optionTextSelected: {
        color: colors.primary,
        fontWeight: '500',
    },
    checkmark: {
        fontSize: 18,
        color: colors.primary,
        fontWeight: '600',
    },
});

export default MasterSettingsScreen;
