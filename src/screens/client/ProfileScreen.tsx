import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Modal,
    TextInput,
    Alert,
    Image,
    Switch,
    ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Location from 'expo-location';
import { decode } from 'base64-arraybuffer';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Card, Button, ScreenBackground, SearchablePicker, MerakiText } from '../../components/ui';
import { useModal } from '../../contexts/ModalContext';
import { colors, spacing, gradients } from '../../theme';
import {
    getAllCountries,
    getCitiesOfCountry,
    getCountryByCode,
    type Country,
    type City,
} from '../../utils/locationApi';

// Fallback countries list (used while API loads)
const FALLBACK_COUNTRIES = [
    'Ireland', 'United Kingdom', 'United States', 'Canada', 'Australia', 'Germany',
    'France', 'Spain', 'Italy', 'Netherlands', 'Belgium', 'Austria', 'Switzerland',
    'Poland', 'Portugal', 'Sweden', 'Denmark', 'Norway', 'Finland', 'Japan', 'Other'
];

// Currency options
const CURRENCIES = ['EUR', 'USD', 'GBP', 'CAD', 'AUD', 'CHF', 'JPY', 'Other'];

// Timezone options (simplified - major zones)
const TIMEZONES = [
    { value: 'Europe/Dublin', label: 'Dublin (GMT+0/+1)' },
    { value: 'Europe/London', label: 'London (GMT+0/+1)' },
    { value: 'Europe/Paris', label: 'Paris (GMT+1/+2)' },
    { value: 'Europe/Berlin', label: 'Berlin (GMT+1/+2)' },
    { value: 'America/New_York', label: 'New York (EST/EDT)' },
    { value: 'America/Los_Angeles', label: 'Los Angeles (PST/PDT)' },
    { value: 'America/Toronto', label: 'Toronto (EST/EDT)' },
    { value: 'Australia/Sydney', label: 'Sydney (AEST/AEDT)' },
    { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
    { value: 'UTC', label: 'UTC' },
];

// Simple phone validation (basic international format)
const validatePhone = (phone: string): { valid: boolean; error?: string } => {
    if (!phone.trim()) return { valid: true };
    const cleaned = phone.replace(/[\s\-\(\)\+]/g, '');
    if (cleaned.length < 8) return { valid: false, error: 'Phone number too short' };
    if (!/^\d+$/.test(cleaned)) return { valid: false, error: 'Invalid characters' };
    return { valid: true };
};

type ProfileStackParamList = {
    ProfileMain: undefined;
    HelpSupport: undefined;
    TermsOfService: undefined;
    PrivacyPolicy: undefined;
    LoyaltyPoints: undefined;
    PaymentMethods: undefined;
    Notifications: undefined;
};

export function ProfileScreen() {
    const navigation = useNavigation<NativeStackNavigationProp<ProfileStackParamList>>();
    const { profile, signOut, refreshProfile } = useAuth();
    const { showAlert } = useModal();
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [saving, setSaving] = useState(false);
    const [uploadingPhoto, setUploadingPhoto] = useState(false);
    const [activeSection, setActiveSection] = useState<'personal' | 'location' | 'professional' | 'preferences'>('personal');

    // Personal Info
    const [editName, setEditName] = useState(profile?.full_name || '');
    const [editPhone, setEditPhone] = useState(profile?.phone || '');
    const [editBio, setEditBio] = useState(profile?.bio || '');
    const [phoneError, setPhoneError] = useState<string | undefined>(undefined);

    // Location
    const [editCity, setEditCity] = useState(profile?.city || '');
    const [editCountry, setEditCountry] = useState(profile?.country || '');
    const [editCountryCode, setEditCountryCode] = useState('');
    const [editTimezone, setEditTimezone] = useState(profile?.timezone || 'Europe/Dublin');

    // Professional (Masters/Owners only)
    const [editCurrency, setEditCurrency] = useState(profile?.currency || 'EUR');
    const [editYearsExp, setEditYearsExp] = useState('');
    const [editSpecialties, setEditSpecialties] = useState('');
    const [editCertifications, setEditCertifications] = useState('');

    // Preferences
    const [emailNotifications, setEmailNotifications] = useState(true);
    const [pushNotifications, setPushNotifications] = useState(true);

    // Location API data
    const [countries, setCountries] = useState<Country[]>([]);
    const [cities, setCities] = useState<City[]>([]);
    const [loadingCountries, setLoadingCountries] = useState(false);
    const [loadingCities, setLoadingCities] = useState(false);
    const [detectingLocation, setDetectingLocation] = useState(false);

    // Picker modals
    const [countryModalVisible, setCountryModalVisible] = useState(false);
    const [cityModalVisible, setCityModalVisible] = useState(false);
    const [currencyModalVisible, setCurrencyModalVisible] = useState(false);
    const [timezoneModalVisible, setTimezoneModalVisible] = useState(false);

    const openEditModal = async () => {
        // Load all current values from profile
        setEditName(profile?.full_name || '');
        setEditPhone(profile?.phone || '');
        setEditBio(profile?.bio || '');
        setEditCity(profile?.city || '');
        setEditCountry(profile?.country || '');
        setEditTimezone(profile?.timezone || 'Europe/Dublin');
        setEditCurrency(profile?.currency || 'EUR');
        setEditYearsExp('');
        setEditSpecialties('');
        setEditCertifications('');
        setActiveSection('personal');
        setEditModalVisible(true);

        // Fetch countries if not loaded
        if (countries.length === 0) {
            setLoadingCountries(true);
            try {
                const data = await getAllCountries();
                setCountries(data);
            } catch (e) {
                console.error('Failed to load countries:', e);
            } finally {
                setLoadingCountries(false);
            }
        }
    };

    const handleSaveProfile = async () => {
        // Validate phone
        if (editPhone.trim()) {
            const phoneValidation = validatePhone(editPhone);
            if (!phoneValidation.valid) {
                setPhoneError(phoneValidation.error);
                return;
            }
        }
        setPhoneError(undefined);

        setSaving(true);
        try {
            const updateData: any = {
                full_name: editName,
                phone: editPhone.trim() || null,
                bio: editBio.trim() || null,
                city: editCity.trim() || null,
                country: editCountry || null,
                timezone: editTimezone || null,
                currency: editCurrency || null,
                updated_at: new Date().toISOString(),
            };

            const { error } = await supabase
                .from('profiles')
                .update(updateData)
                .eq('id', profile?.id || '');

            if (error) throw error;

            await refreshProfile?.();
            setEditModalVisible(false);
            showAlert('Success', 'Profile updated successfully', 'success');
        } catch (error: any) {
            showAlert('Error', error.message || 'Failed to save profile', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handlePhoneChange = (text: string) => {
        setEditPhone(text);
        if (phoneError) setPhoneError(undefined);
    };

    const handleChangePhoto = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            showAlert('Permission needed', 'Please grant camera roll access to change your photo', 'info');
            return;
        }

        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                quality: 0.7,
                allowsEditing: true,
                aspect: [1, 1],
            });

            if (!result.canceled && result.assets[0]) {
                setUploadingPhoto(true);
                const asset = result.assets[0];
                const fileExt = asset.uri.split('.').pop()?.toLowerCase() || 'jpg';
                const fileName = `${profile?.id}/${Date.now()}.${fileExt}`;

                const base64 = await FileSystem.readAsStringAsync(asset.uri, {
                    encoding: 'base64',
                });

                const { error: uploadError } = await supabase.storage
                    .from('avatars')
                    .upload(fileName, decode(base64), {
                        contentType: 'image/jpeg',
                        upsert: true,
                    });

                if (uploadError) throw uploadError;

                const { data: urlData } = supabase.storage
                    .from('avatars')
                    .getPublicUrl(fileName);

                await supabase
                    .from('profiles')
                    .update({ avatar_url: urlData.publicUrl })
                    .eq('id', profile?.id || '');

                await refreshProfile?.();
                showAlert('Success', 'Profile photo updated', 'success');
            }
        } catch (error: any) {
            showAlert('Error', 'Failed to update photo: ' + error.message, 'error');
        } finally {
            setUploadingPhoto(false);
        }
    };

    const isMasterOrOwner = profile?.role === 'master' || profile?.role === 'owner';

    const menuItems = [
        {
            icon: 'account-edit-outline', label: 'Edit Profile', action: openEditModal
        },
        { icon: 'bell-outline', label: 'Notifications', action: () => navigation.navigate('Notifications') },
        { icon: 'credit-card-outline', label: 'Payment Methods', action: () => navigation.navigate('PaymentMethods') },
        // Only show Loyalty Points and Help for clients
        ...(profile?.role === 'client' ? [
            { icon: 'star-outline', label: 'Loyalty Points', action: () => navigation.navigate('LoyaltyPoints') },
            { icon: 'help-circle-outline', label: 'Help & Support', action: () => navigation.navigate('HelpSupport') },
        ] : []),
        { icon: 'file-document-outline', label: 'Terms of Service', action: () => navigation.navigate('TermsOfService') },
        { icon: 'shield-check-outline', label: 'Privacy Policy', action: () => navigation.navigate('PrivacyPolicy') },
    ];

    // Render section tabs
    const renderSectionTabs = () => (
        <View style={styles.sectionTabs}>
            <TouchableOpacity
                style={[styles.tab, activeSection === 'personal' && styles.tabActive]}
                onPress={() => setActiveSection('personal')}
            >
                <MerakiText style={[styles.tabText, activeSection === 'personal' && styles.tabTextActive]}>Personal</MerakiText>
            </TouchableOpacity>
            <TouchableOpacity
                style={[styles.tab, activeSection === 'location' && styles.tabActive]}
                onPress={() => setActiveSection('location')}
            >
                <MerakiText style={[styles.tabText, activeSection === 'location' && styles.tabTextActive]}>Location</MerakiText>
            </TouchableOpacity>
            {isMasterOrOwner && (
                <TouchableOpacity
                    style={[styles.tab, activeSection === 'professional' && styles.tabActive]}
                    onPress={() => setActiveSection('professional')}
                >
                    <MerakiText style={[styles.tabText, activeSection === 'professional' && styles.tabTextActive]}>Pro</MerakiText>
                </TouchableOpacity>
            )}
            <TouchableOpacity
                style={[styles.tab, activeSection === 'preferences' && styles.tabActive]}
                onPress={() => setActiveSection('preferences')}
            >
                <MerakiText style={[styles.tabText, activeSection === 'preferences' && styles.tabTextActive]}>Prefs</MerakiText>
            </TouchableOpacity>
        </View>
    );

    // Render Personal section
    const renderPersonalSection = () => (
        <View style={styles.sectionContent}>
            <View style={styles.inputGroup}>
                <MerakiText style={styles.inputLabel}>Full Name *</MerakiText>
                <Card variant="glass" style={styles.inputContainer}>
                    <TextInput
                        style={styles.input}
                        value={editName}
                        onChangeText={setEditName}
                        placeholder="Enter your full name"
                        placeholderTextColor={colors.textMuted}
                    />
                </Card>
            </View>

            <View style={styles.inputGroup}>
                <MerakiText style={styles.inputLabel}>Email</MerakiText>
                <View style={styles.readOnlyContainer}>
                    <MerakiText style={styles.readOnlyField}>{profile?.email}</MerakiText>
                </View>
                <MerakiText style={styles.hintText}>Email cannot be changed</MerakiText>
            </View>

            <View style={styles.inputGroup}>
                <MerakiText style={styles.inputLabel}>Phone Number</MerakiText>
                <Card variant="glass" style={[styles.inputContainer, phoneError && styles.inputError]}>
                    <TextInput
                        style={styles.input}
                        value={editPhone}
                        onChangeText={handlePhoneChange}
                        placeholder="+1 234 567 8900"
                        placeholderTextColor={colors.textMuted}
                        keyboardType="phone-pad"
                    />
                </Card>
                {phoneError && <MerakiText style={styles.errorText}>{phoneError}</MerakiText>}
                <MerakiText style={styles.hintText}>Include country code (e.g., +1, +353, +44)</MerakiText>
            </View>

            <View style={styles.inputGroup}>
                <MerakiText style={styles.inputLabel}>Bio / About Me</MerakiText>
                <Card variant="glass" style={[styles.inputContainer, { height: 120 }]}>
                    <TextInput
                        style={[styles.input, styles.textArea]}
                        value={editBio}
                        onChangeText={setEditBio}
                        placeholder="Tell clients about yourself, your experience, and your style..."
                        placeholderTextColor={colors.textMuted}
                        multiline
                        numberOfLines={4}
                        maxLength={500}
                    />
                </Card>
                <MerakiText style={styles.charCount}>{editBio.length}/500</MerakiText>
            </View>
        </View>
    );

    // Render Location section
    const renderLocationSection = () => (
        <View style={styles.sectionContent}>
            {/* Detect Location Button */}
            <TouchableOpacity
                style={styles.detectLocationBtn}
                onPress={handleDetectLocation}
                disabled={detectingLocation}
            >
                <Card variant="glass" style={styles.detectLocationCard}>
                    {detectingLocation ? (
                        <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                        <View style={styles.detectLocationRow}>
                            <MaterialIcons name="my-location" size={20} color={colors.primary} />
                            <MerakiText style={styles.detectLocationText}>Detect My Location</MerakiText>
                        </View>
                    )}
                </Card>
            </TouchableOpacity>

            <View style={styles.inputGroup}>
                <MerakiText style={styles.inputLabel}>Country *</MerakiText>
                <TouchableOpacity
                    onPress={() => setCountryModalVisible(true)}
                >
                    <Card variant="glass" style={styles.selectorCard}>
                        <MerakiText style={editCountry ? styles.selectorText : styles.selectorPlaceholder}>
                            {editCountry || 'Select your country'}
                        </MerakiText>
                        {loadingCountries ? (
                            <ActivityIndicator size="small" color={colors.primary} />
                        ) : (
                            <MaterialIcons name="expand-more" size={20} color={colors.textMuted} />
                        )}
                    </Card>
                </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
                <MerakiText style={styles.inputLabel}>City *</MerakiText>
                <TouchableOpacity
                    onPress={() => editCountry && setCityModalVisible(true)}
                    disabled={!editCountry}
                >
                    <Card variant="glass" style={[styles.selectorCard, !editCountry && styles.selectorDisabled]}>
                        <MerakiText style={editCity ? styles.selectorText : styles.selectorPlaceholder}>
                            {editCity || (editCountry ? 'Select your city' : 'Select country first')}
                        </MerakiText>
                        {loadingCities ? (
                            <ActivityIndicator size="small" color={colors.primary} />
                        ) : (
                            <MaterialIcons name="expand-more" size={20} color={colors.textMuted} />
                        )}
                    </Card>
                </TouchableOpacity>
                <MerakiText style={styles.hintText}>Your city is required for location-based features</MerakiText>
            </View>

            <View style={styles.inputGroup}>
                <MerakiText style={styles.inputLabel}>Timezone</MerakiText>
                <TouchableOpacity
                    onPress={() => setTimezoneModalVisible(true)}
                >
                    <Card variant="glass" style={styles.selectorCard}>
                        <MerakiText style={styles.selectorText}>
                            {TIMEZONES.find(tz => tz.value === editTimezone)?.label || editTimezone}
                        </MerakiText>
                        <MaterialIcons name="expand-more" size={20} color={colors.textMuted} />
                    </Card>
                </TouchableOpacity>
                <MerakiText style={styles.hintText}>This affects your availability and booking times</MerakiText>
            </View>
        </View>
    );

    // Handle location detection
    const handleDetectLocation = async () => {
        setDetectingLocation(true);
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                showAlert('Permission Denied', 'Location permission is required to detect your location', 'error');
                return;
            }

            const location = await Location.getCurrentPositionAsync({});
            const [reverseGeocode] = await Location.reverseGeocodeAsync({
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
            });

            if (reverseGeocode) {
                // Set country
                if (reverseGeocode.country) {
                    setEditCountry(reverseGeocode.country);
                    // Find and set country code
                    const foundCountry = countries.find(
                        c => c.name.toLowerCase() === reverseGeocode.country?.toLowerCase()
                    );
                    if (foundCountry) {
                        setEditCountryCode(foundCountry.iso2);
                        // Fetch cities for this country
                        loadCitiesForCountry(foundCountry.iso2);
                        // Set timezone from country
                        if (foundCountry.timezones && foundCountry.timezones.length > 0) {
                            setEditTimezone(foundCountry.timezones[0].zoneName);
                        }
                    }
                }
                // Set city if available
                if (reverseGeocode.city) {
                    setEditCity(reverseGeocode.city);
                } else if (reverseGeocode.subregion) {
                    setEditCity(reverseGeocode.subregion);
                }
                showAlert('Location Detected', `Found: ${reverseGeocode.city || reverseGeocode.subregion}, ${reverseGeocode.country}`, 'success');
            }
        } catch (error: any) {
            console.error('Location detection error:', error);
            showAlert('Error', 'Failed to detect location. Please select manually.', 'error');
        } finally {
            setDetectingLocation(false);
        }
    };

    // Load cities for a country
    const loadCitiesForCountry = async (countryCode: string) => {
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

    // Handle country selection
    const handleCountrySelect = (item: { id: string | number; name: string }) => {
        const selectedCountry = countries.find(c => c.id === item.id);
        if (selectedCountry) {
            setEditCountry(selectedCountry.name);
            setEditCountryCode(selectedCountry.iso2);
            setEditCity(''); // Reset city when country changes
            loadCitiesForCountry(selectedCountry.iso2);
            // Auto-set timezone from country
            if (selectedCountry.timezones && selectedCountry.timezones.length > 0) {
                setEditTimezone(selectedCountry.timezones[0].zoneName);
            }
        }
    };

    // Handle city selection
    const handleCitySelect = (item: { id: string | number; name: string }) => {
        setEditCity(item.name);
    };

    // Render Professional section
    const renderProfessionalSection = () => (
        <View style={styles.sectionContent}>
            <View style={styles.inputGroup}>
                <MerakiText style={styles.inputLabel}>Currency</MerakiText>
                <TouchableOpacity
                    onPress={() => setCurrencyModalVisible(true)}
                >
                    <Card variant="glass" style={styles.selectorCard}>
                        <MerakiText style={styles.selectorText}>
                            {editCurrency}
                        </MerakiText>
                        <MaterialIcons name="expand-more" size={20} color={colors.textMuted} />
                    </Card>
                </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
                <MerakiText style={styles.inputLabel}>Years of Experience</MerakiText>
                <Card variant="glass" style={styles.inputContainer}>
                    <TextInput
                        style={styles.input}
                        value={editYearsExp}
                        onChangeText={setEditYearsExp}
                        placeholder="e.g., 5"
                        placeholderTextColor={colors.textMuted}
                        keyboardType="number-pad"
                    />
                </Card>
            </View>

            <View style={styles.inputGroup}>
                <MerakiText style={styles.inputLabel}>Specialties</MerakiText>
                <Card variant="glass" style={[styles.inputContainer, { height: 100 }]}>
                    <TextInput
                        style={[styles.input, styles.textArea]}
                        value={editSpecialties}
                        onChangeText={setEditSpecialties}
                        placeholder="e.g., Acrylic nails, Volume lashes, Microblading, Balayage..."
                        placeholderTextColor={colors.textMuted}
                        multiline
                        numberOfLines={3}
                    />
                </Card>
                <MerakiText style={styles.hintText}>Comma-separated list of your specialties</MerakiText>
            </View>

            <View style={styles.inputGroup}>
                <MerakiText style={styles.inputLabel}>Certifications</MerakiText>
                <Card variant="glass" style={[styles.inputContainer, { height: 100 }]}>
                    <TextInput
                        style={[styles.input, styles.textArea]}
                        value={editCertifications}
                        onChangeText={setEditCertifications}
                        placeholder="e.g., NVQ Level 3 Beauty Therapy, Lash Perfect Certified..."
                        placeholderTextColor={colors.textMuted}
                        multiline
                        numberOfLines={3}
                    />
                </Card>
                <MerakiText style={styles.hintText}>List your professional certifications</MerakiText>
            </View>
        </View>
    );

    // Render Preferences section
    const renderPreferencesSection = () => (
        <View style={styles.sectionContent}>
            <MerakiText variant="h3" style={styles.sectionSubtitle}>Notification Preferences</MerakiText>

            <Card variant="glass" style={styles.prefCard}>
                <View style={styles.switchRow}>
                    <View style={styles.switchLabel}>
                        <MerakiText variant="h4" style={styles.switchTitle}>Email Notifications</MerakiText>
                        <MerakiText style={styles.switchDescription}>Booking confirmations and updates</MerakiText>
                    </View>
                    <Switch
                        value={emailNotifications}
                        onValueChange={setEmailNotifications}
                        trackColor={{ false: colors.border, true: colors.primary }}
                        thumbColor={colors.text}
                    />
                </View>

                <View style={styles.divider} />

                <View style={styles.switchRow}>
                    <View style={styles.switchLabel}>
                        <MerakiText variant="h4" style={styles.switchTitle}>Push Notifications</MerakiText>
                        <MerakiText style={styles.switchDescription}>Real-time alerts on your device</MerakiText>
                    </View>
                    <Switch
                        value={pushNotifications}
                        onValueChange={setPushNotifications}
                        trackColor={{ false: colors.border, true: colors.primary }}
                        thumbColor={colors.text}
                    />
                </View>
            </Card>

            <View style={styles.passwordSection}>
                <MerakiText variant="h3" style={styles.sectionSubtitle}>Security</MerakiText>
                <TouchableOpacity onPress={() => {/* Change Password logic */ }}>
                    <Card variant="glass" style={styles.passwordCard}>
                        <MaterialIcons name="lock-reset" size={20} color={colors.primary} />
                        <MerakiText style={styles.passwordButtonText}>Change Password</MerakiText>
                    </Card>
                </TouchableOpacity>
            </View>
        </View>
    );

    // Country picker using SearchablePicker
    const countryPickerItems = countries.map(c => ({
        id: c.id,
        name: c.name,
        subtitle: c.iso2,
    }));

    // City picker using SearchablePicker
    const cityPickerItems = cities.map(c => ({
        id: c.id,
        name: c.name,
        subtitle: c.state_name || undefined,
    }));

    // Currency dropdown modal
    const renderCurrencyModal = () => (
        <Modal
            visible={currencyModalVisible}
            transparent
            animationType="slide"
            onRequestClose={() => setCurrencyModalVisible(false)}
        >
            <View style={styles.dropdownOverlay}>
                <View style={styles.dropdownContent}>
                    <View style={styles.dropdownHeader}>
                        <Text style={styles.dropdownTitle}>Select Currency</Text>
                        <TouchableOpacity onPress={() => setCurrencyModalVisible(false)}>
                            <Text style={styles.dropdownClose}>✕</Text>
                        </TouchableOpacity>
                    </View>
                    <ScrollView style={styles.dropdownList}>
                        {CURRENCIES.map((currency) => (
                            <TouchableOpacity
                                key={currency}
                                style={[styles.dropdownItem, editCurrency === currency && styles.dropdownItemSelected]}
                                onPress={() => {
                                    setEditCurrency(currency);
                                    setCurrencyModalVisible(false);
                                }}
                            >
                                <Text style={[styles.dropdownItemText, editCurrency === currency && styles.dropdownItemTextSelected]}>
                                    {currency}
                                </Text>
                                {editCurrency === currency && <Text style={styles.checkmark}>✓</Text>}
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );

    // Timezone dropdown modal
    const renderTimezoneModal = () => (
        <Modal
            visible={timezoneModalVisible}
            transparent
            animationType="slide"
            onRequestClose={() => setTimezoneModalVisible(false)}
        >
            <View style={styles.dropdownOverlay}>
                <View style={styles.dropdownContent}>
                    <View style={styles.dropdownHeader}>
                        <Text style={styles.dropdownTitle}>Select Timezone</Text>
                        <TouchableOpacity onPress={() => setTimezoneModalVisible(false)}>
                            <Text style={styles.dropdownClose}>✕</Text>
                        </TouchableOpacity>
                    </View>
                    <ScrollView style={styles.dropdownList}>
                        {TIMEZONES.map((tz) => (
                            <TouchableOpacity
                                key={tz.value}
                                style={[styles.dropdownItem, editTimezone === tz.value && styles.dropdownItemSelected]}
                                onPress={() => {
                                    setEditTimezone(tz.value);
                                    setTimezoneModalVisible(false);
                                }}
                            >
                                <Text style={[styles.dropdownItemText, editTimezone === tz.value && styles.dropdownItemTextSelected]}>
                                    {tz.label}
                                </Text>
                                {editTimezone === tz.value && <Text style={styles.checkmark}>✓</Text>}
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );

    return (
        <ScreenBackground>
            <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Header */}
                    <View style={styles.header}>
                        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                            <MaterialIcons name="arrow-back" size={22} color="rgba(255,255,255,0.7)" />
                        </TouchableOpacity>
                        <MerakiText variant="h1" style={styles.title}>Profile</MerakiText>
                        <View style={{ width: 40 }} />
                    </View>

                    {/* Avatar */}
                    <View style={styles.avatarSection}>
                        <TouchableOpacity onPress={handleChangePhoto} disabled={uploadingPhoto} activeOpacity={0.8}>
                            <View style={styles.avatarGlow}>
                                <View style={styles.avatarOuterBorder}>
                                    {profile?.avatar_url ? (
                                        <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} />
                                    ) : (
                                        <View style={styles.avatarPlaceholder}>
                                            <MerakiText variant="h1" style={styles.avatarText}>
                                                {profile?.full_name?.[0]?.toUpperCase() || 'U'}
                                            </MerakiText>
                                        </View>
                                    )}
                                </View>
                                <View style={styles.cameraIcon}>
                                    <MaterialIcons
                                        name={uploadingPhoto ? "hourglass-empty" : "camera-alt"}
                                        size={16}
                                        color={colors.text}
                                    />
                                </View>
                            </View>
                        </TouchableOpacity>
                        <MerakiText variant="h2" style={styles.name}>{profile?.full_name || 'User'}</MerakiText>
                        <MerakiText style={styles.email}>{profile?.email}</MerakiText>
                        {profile?.phone && (
                            <View style={styles.infoRow}>
                                <MaterialIcons name="phone" size={14} color={colors.textSecondary} />
                                <MerakiText style={styles.phone}>{profile.phone}</MerakiText>
                            </View>
                        )}
                        {(profile?.city || profile?.country) && (
                            <View style={styles.infoRow}>
                                <MaterialIcons name="location-on" size={14} color={colors.primary} />
                                <MerakiText style={styles.location}>
                                    {[profile?.city, profile?.country].filter(Boolean).join(', ')}
                                </MerakiText>
                            </View>
                        )}
                    </View>

                    {/* Menu Items */}
                    <View style={styles.menu}>
                        {menuItems.map((item, index) => (
                            <TouchableOpacity key={index} onPress={item.action} activeOpacity={0.7}>
                                <Card style={styles.menuItem} variant="glass">
                                    <View style={styles.menuIconContainer}>
                                        <MaterialIcons name={item.icon as any} size={22} color={colors.primary} />
                                    </View>
                                    <MerakiText variant="h4" style={styles.menuText}>{item.label}</MerakiText>
                                    <MaterialIcons name="chevron-right" size={24} color={colors.textMuted} />
                                </Card>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Sign Out */}
                    <TouchableOpacity style={styles.signOutButton} onPress={signOut} activeOpacity={0.7}>
                        <MerakiText style={styles.signOutText}>Sign Out</MerakiText>
                    </TouchableOpacity>

                    {/* App Version */}
                    <MerakiText style={styles.version}>Merakí v0.1.0-Luxe</MerakiText>
                </ScrollView>

                {/* Edit Profile Modal */}
                <Modal
                    visible={editModalVisible}
                    animationType="slide"
                    onRequestClose={() => setEditModalVisible(false)}
                >
                    <View style={styles.modalContainer}>
                        <ScreenBackground>
                            <View style={styles.modalHeader}>
                                <TouchableOpacity onPress={() => setEditModalVisible(false)} style={styles.modalCloseBtn}>
                                    <MaterialIcons name="close" size={24} color={colors.text} />
                                </TouchableOpacity>
                                <MerakiText variant="h2" style={styles.modalTitle}>Edit Profile</MerakiText>
                                <View style={{ width: 44 }} />
                            </View>

                            {renderSectionTabs()}

                            <ScrollView style={styles.modalScrollContent} showsVerticalScrollIndicator={false}>
                                {activeSection === 'personal' && renderPersonalSection()}
                                {activeSection === 'location' && renderLocationSection()}
                                {activeSection === 'professional' && renderProfessionalSection()}
                                {activeSection === 'preferences' && renderPreferencesSection()}

                                <View style={styles.saveButtonContainer}>
                                    <Button
                                        title={saving ? 'Saving...' : 'Save Changes'}
                                        onPress={handleSaveProfile}
                                        loading={saving}
                                        fullWidth
                                    />
                                </View>
                            </ScrollView>
                        </ScreenBackground>
                    </View>
                </Modal>

                {/* Dropdown Modals */}
                <SearchablePicker
                    visible={countryModalVisible}
                    title="Select Country"
                    items={countryPickerItems}
                    selectedId={countries.find(c => c.name === editCountry)?.id}
                    onSelect={handleCountrySelect}
                    onClose={() => setCountryModalVisible(false)}
                    searchPlaceholder="Search countries..."
                    loading={loadingCountries}
                    emptyMessage="No countries found"
                />
                <SearchablePicker
                    visible={cityModalVisible}
                    title="Select City"
                    items={cityPickerItems}
                    selectedId={cities.find(c => c.name === editCity)?.id}
                    onSelect={handleCitySelect}
                    onClose={() => setCityModalVisible(false)}
                    searchPlaceholder="Search cities..."
                    loading={loadingCities}
                    emptyMessage={cities.length === 0 ? 'Select a country first' : 'No cities found'}
                />
                {renderCurrencyModal()}
                {renderTimezoneModal()}
            </SafeAreaView>
        </ScreenBackground>
    );
}

const styles = StyleSheet.create({
    // Updated & New styles
    container: { flex: 1 },
    scrollView: { flex: 1 },
    scrollContent: { padding: spacing.lg, paddingBottom: spacing.xxxl },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: spacing.xl,
        paddingTop: spacing.md
    },
    backButton: {
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
        alignItems: 'center', justifyContent: 'center',
    },
    title: { color: colors.text },
    avatarSection: { alignItems: 'center', marginBottom: spacing.xl },
    avatarGlow: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: 'rgba(200, 160, 77, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.md,
    },
    avatarOuterBorder: {
        width: 104,
        height: 104,
        borderRadius: 52,
        borderWidth: 2,
        borderColor: colors.primary,
        padding: 4,
        backgroundColor: 'rgba(255,255,255,0.05)',
        overflow: 'hidden',
    },
    avatarPlaceholder: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.surfaceLight,
        borderRadius: 48,
    },
    avatarImage: { width: '100%', height: '100%', borderRadius: 48 },
    avatarText: { color: colors.text, opacity: 0.9 },
    cameraIcon: {
        position: 'absolute',
        bottom: 8,
        right: 8,
        backgroundColor: colors.primary,
        borderRadius: 14,
        width: 28,
        height: 28,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: colors.background,
    },
    name: { color: colors.text, marginBottom: 4 },
    email: { fontSize: 14, color: colors.textSecondary, marginBottom: 4 },
    infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
    phone: { fontSize: 13, color: colors.textSecondary },
    location: { fontSize: 13, color: colors.textSecondary },

    menu: { gap: spacing.md, marginBottom: spacing.xl },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.md,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    menuIconContainer: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: 'rgba(200, 160, 77, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: spacing.md,
    },
    menuText: { flex: 1, color: colors.text },

    signOutButton: {
        paddingVertical: spacing.md,
        alignItems: 'center',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(239, 68, 68, 0.3)',
        marginBottom: spacing.lg,
        backgroundColor: 'rgba(239, 68, 68, 0.08)'
    },
    signOutText: { fontSize: 15, fontWeight: '700', color: colors.error, letterSpacing: 0.5 },
    version: { textAlign: 'center', fontSize: 11, color: colors.textMuted, opacity: 0.6 },

    // Modal styles
    modalContainer: { flex: 1 },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.xl,
        paddingBottom: spacing.md,
    },
    modalCloseBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)',
    },
    modalTitle: { color: colors.text },
    modalScrollContent: { flex: 1, paddingHorizontal: spacing.lg },
    saveButtonContainer: { paddingVertical: spacing.xl },

    // Section tabs
    sectionTabs: {
        flexDirection: 'row',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        gap: spacing.sm,
    },
    tab: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    tabActive: {
        backgroundColor: 'rgba(200, 160, 77, 0.15)',
        borderColor: 'rgba(200, 160, 77, 0.25)',
    },
    tabText: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
    tabTextActive: { color: colors.primary },

    // Section content
    sectionContent: { paddingTop: spacing.md },
    sectionSubtitle: { color: colors.text, marginBottom: spacing.md, marginTop: spacing.lg },
    inputGroup: { marginBottom: spacing.lg },
    inputLabel: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: spacing.xs, marginLeft: 4 },
    inputContainer: {
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        overflow: 'hidden',
    },
    input: { padding: spacing.md, color: colors.text, fontSize: 16 },
    inputError: { borderColor: colors.error },
    textArea: { height: '100%', textAlignVertical: 'top' },
    errorText: { color: colors.error, fontSize: 12, marginTop: spacing.xs, marginLeft: 4 },
    hintText: { fontSize: 11, color: colors.textMuted, marginTop: spacing.xs, marginLeft: 4 },
    charCount: { fontSize: 11, color: colors.textMuted, textAlign: 'right', marginTop: 4 },
    readOnlyContainer: {
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 16,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    readOnlyField: { color: colors.textSecondary, fontSize: 16 },

    // Selectors
    selectorCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: spacing.md,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    selectorText: { fontSize: 16, color: colors.text, flex: 1 },
    selectorPlaceholder: { fontSize: 16, color: colors.textMuted, flex: 1 },
    selectorDisabled: { opacity: 0.5 },

    // Switches
    prefCard: {
        padding: spacing.md,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
        marginTop: spacing.sm,
    },
    switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm },
    switchLabel: { flex: 1, marginRight: spacing.md },
    switchTitle: { color: colors.text, marginBottom: 2 },
    switchDescription: { fontSize: 12, color: colors.textMuted },
    divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.05)', marginVertical: spacing.sm },

    // Password section
    passwordSection: { marginTop: spacing.xl },
    passwordCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: 'rgba(200, 160, 77, 0.25)',
    },
    passwordButtonText: { color: colors.primary, fontSize: 15, fontWeight: '700' },

    // Location detection
    detectLocationBtn: { marginBottom: spacing.lg },
    detectLocationCard: {
        padding: spacing.md,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(200, 160, 77, 0.25)',
        backgroundColor: 'rgba(200, 160, 77, 0.05)',
    },
    detectLocationRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    detectLocationText: { fontSize: 15, color: colors.primary, fontWeight: '700' },

    // Dropdown modals (kept similar for consistency)
    dropdownOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
    dropdownContent: { backgroundColor: colors.background, borderTopLeftRadius: 30, borderTopRightRadius: 30, maxHeight: '80%', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    dropdownHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
    dropdownTitle: { fontSize: 20, fontWeight: '700', color: colors.text },
    dropdownClose: { fontSize: 20, color: colors.textMuted, padding: spacing.sm },
    dropdownList: { padding: spacing.md },
    dropdownItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.md, paddingHorizontal: spacing.md, borderRadius: 16, marginBottom: spacing.xs },
    dropdownItemSelected: { backgroundColor: 'rgba(200, 160, 77, 0.1)' },
    dropdownItemText: { fontSize: 16, color: colors.text, flex: 1 },
    dropdownItemTextSelected: { color: colors.primary, fontWeight: '700' },
    checkmark: { fontSize: 18, color: colors.primary, fontWeight: '800' },
});

export default ProfileScreen;
