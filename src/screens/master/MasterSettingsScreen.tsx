import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    TextInput,
    Modal,
    Linking,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Card, Button, ScreenBackground, MerakiText } from '../../components/ui';
import { useModal } from '../../contexts/ModalContext';
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
    const { showAlert, showConfirm } = useModal();

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
            // Save profile settings
            const { error: profileError } = await supabase
                .from('profiles')
                .update({
                    timezone,
                    currency,
                    city: city.trim() || null,
                    country: country || null,
                })
                .eq('id', user.id);

            if (profileError) throw profileError;

            await refreshProfile();
            showAlert('Success', 'Your settings have been saved', 'success');
        } catch (error: any) {
            showAlert('Error', error.message, 'error');
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
                            <MerakiText variant="body" color={colors.text} style={{ fontWeight: '600' }}>{title}</MerakiText>
                            <TouchableOpacity onPress={() => setPickerVisible(null)}>
                                <MaterialCommunityIcons name="close" size={22} color={colors.textMuted} />
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
                                            <MaterialCommunityIcons name="check" size={18} color={colors.primary} />
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
                        <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <View>
                        <MerakiText variant="h1">Settings</MerakiText>
                        <MerakiText variant="caption" color={colors.textSecondary}>Configure your global marketplace settings</MerakiText>
                    </View>
                </View>

                <ScrollView contentContainerStyle={styles.content}>
                    {/* Timezone Section */}
                    <Card style={styles.section}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.xs }}>
                            <MaterialCommunityIcons name="earth" size={20} color={colors.accent} />
                            <MerakiText variant="body" color={colors.text} style={{ fontWeight: '600', fontSize: 18 }}>Time Zone</MerakiText>
                        </View>
                        <MerakiText variant="caption" color={colors.textSecondary} style={{ marginBottom: spacing.md }}>
                            Set your local timezone. Clients will see availability in their local time.
                        </MerakiText>
                        <TouchableOpacity
                            style={styles.selector}
                            onPress={() => setPickerVisible('timezone')}
                        >
                            <Text style={styles.selectorText}>{getSelectedTimezoneLabel()}</Text>
                            <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />
                        </TouchableOpacity>
                    </Card>

                    {/* Currency Section */}
                    <Card style={styles.section}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.xs }}>
                            <MaterialCommunityIcons name="currency-usd" size={20} color={colors.accent} />
                            <MerakiText variant="body" color={colors.text} style={{ fontWeight: '600', fontSize: 18 }}>Currency</MerakiText>
                        </View>
                        <MerakiText variant="caption" color={colors.textSecondary} style={{ marginBottom: spacing.md }}>
                            Your preferred currency for service pricing and payouts.
                        </MerakiText>
                        <TouchableOpacity
                            style={styles.selector}
                            onPress={() => setPickerVisible('currency')}
                        >
                            <Text style={styles.selectorText}>{getSelectedCurrencyLabel()}</Text>
                            <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />
                        </TouchableOpacity>
                    </Card>

                    {/* Location Section */}
                    <Card style={styles.section}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.xs }}>
                            <MaterialCommunityIcons name="map-marker" size={20} color={colors.accent} />
                            <MerakiText variant="body" color={colors.text} style={{ fontWeight: '600', fontSize: 18 }}>Location</MerakiText>
                        </View>
                        <MerakiText variant="caption" color={colors.textSecondary} style={{ marginBottom: spacing.md }}>
                            Your city and country will be shown to clients so they know where you're based.
                        </MerakiText>

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
                                <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />
                            </TouchableOpacity>
                        </View>
                    </Card>

                    {/* Stripe Connect Payment Setup (Hidden for Owners) */}
                    {profile?.role !== 'owner' && (
                        <Card style={styles.section}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.xs }}>
                                <MaterialCommunityIcons name="credit-card-outline" size={20} color={colors.accent} />
                                <MerakiText variant="body" color={colors.text} style={{ fontWeight: '600', fontSize: 18 }}>Payment Setup</MerakiText>
                            </View>
                            <MerakiText variant="caption" color={colors.textSecondary} style={{ marginBottom: spacing.md }}>
                                Manage your Stripe Connect account for receiving payouts.
                            </MerakiText>

                            {profile?.stripe_connect_status === 'active' ? (
                                <>
                                    <View style={styles.statusRow}>
                                        <View style={[styles.statusBadge, { backgroundColor: 'rgba(16, 185, 129, 0.2)' }]}>
                                            <Text style={[styles.statusBadgeText, { color: '#34D399' }]}>Connected</Text>
                                        </View>
                                        <Text style={styles.statusText}>
                                            Your payouts are set up. You receive 100% of your earnings.
                                        </Text>
                                    </View>
                                    <TouchableOpacity
                                        style={[styles.selector, { marginTop: spacing.md }]}
                                        onPress={async () => {
                                            try {
                                                const { data: { session } } = await supabase.auth.getSession();
                                                if (!session) return;
                                                const { data } = await supabase.functions.invoke('stripe-connect-dashboard', {
                                                    headers: { Authorization: `Bearer ${session.access_token}` },
                                                });
                                                if (data?.url) {
                                                    Linking.openURL(data.url);
                                                }
                                            } catch (e) {
                                                showAlert('Error', 'Could not open Stripe dashboard', 'error');
                                            }
                                        }}
                                    >
                                        <Text style={styles.selectorText}>View Stripe Dashboard</Text>
                                        <MaterialCommunityIcons name="open-in-new" size={18} color={colors.textMuted} />
                                    </TouchableOpacity>
                                </>
                            ) : profile?.stripe_connect_status === 'pending' ? (
                                <View style={styles.statusRow}>
                                    <View style={[styles.statusBadge, styles.statusPending]}>
                                        <Text style={styles.statusBadgeText}>Pending</Text>
                                    </View>
                                    <Text style={styles.statusText}>
                                        Your setup is incomplete. Complete it via the blocking screen.
                                    </Text>
                                </View>
                            ) : (
                                <View style={styles.statusRow}>
                                    <View style={[styles.statusBadge, { backgroundColor: 'rgba(239, 68, 68, 0.2)' }]}>
                                        <Text style={[styles.statusBadgeText, { color: '#F87171' }]}>Not Connected</Text>
                                    </View>
                                    <Text style={styles.statusText}>
                                        Set up your payout account via the setup screen.
                                    </Text>
                                </View>
                            )}
                        </Card>
                    )}
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
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: 'rgba(0, 0, 0, 0.04)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.08)',
        marginBottom: spacing.sm,
    },
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
        backgroundColor: 'rgba(0, 0, 0, 0.04)',
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
        backgroundColor: 'rgba(0, 0, 0, 0.04)',
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
        backgroundColor: 'rgba(200, 160, 77, 0.2)',
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
