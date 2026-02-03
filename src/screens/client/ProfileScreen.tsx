import React, { useState } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Card, Button, ScreenBackground } from '../../components/ui';
import { colors, spacing } from '../../theme';

// Countries list for dropdown
const COUNTRIES = [
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
    const [editTimezone, setEditTimezone] = useState(profile?.timezone || 'Europe/Dublin');
    
    // Professional (Masters/Owners only)
    const [editCurrency, setEditCurrency] = useState(profile?.currency || 'EUR');
    const [editYearsExp, setEditYearsExp] = useState('');
    const [editSpecialties, setEditSpecialties] = useState('');
    const [editCertifications, setEditCertifications] = useState('');
    
    // Preferences
    const [emailNotifications, setEmailNotifications] = useState(true);
    const [pushNotifications, setPushNotifications] = useState(true);
    
    // Country dropdown modal
    const [countryModalVisible, setCountryModalVisible] = useState(false);
    const [currencyModalVisible, setCurrencyModalVisible] = useState(false);
    const [timezoneModalVisible, setTimezoneModalVisible] = useState(false);

    const openEditModal = () => {
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
            Alert.alert('Success', 'Profile updated successfully');
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to save profile');
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
            Alert.alert('Permission needed', 'Please grant camera roll access to change your photo');
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
                Alert.alert('Success', 'Profile photo updated');
            }
        } catch (error: any) {
            Alert.alert('Error', 'Failed to update photo: ' + error.message);
        } finally {
            setUploadingPhoto(false);
        }
    };

    const isMasterOrOwner = profile?.role === 'master' || profile?.role === 'owner';

    const menuItems = [
        {
            icon: '👤', label: 'Edit Profile', action: openEditModal
        },
        { icon: '🔔', label: 'Notifications', action: () => navigation.navigate('Notifications') },
        { icon: '💳', label: 'Payment Methods', action: () => navigation.navigate('PaymentMethods') },
        // Only show Loyalty Points and Help for clients
        ...(profile?.role === 'client' ? [
            { icon: '⭐', label: 'Loyalty Points', action: () => navigation.navigate('LoyaltyPoints') },
            { icon: '❓', label: 'Help & Support', action: () => navigation.navigate('HelpSupport') },
        ] : []),
        { icon: '📜', label: 'Terms of Service', action: () => navigation.navigate('TermsOfService') },
        { icon: '🔒', label: 'Privacy Policy', action: () => navigation.navigate('PrivacyPolicy') },
    ];

    // Render section tabs
    const renderSectionTabs = () => (
        <View style={styles.sectionTabs}>
            <TouchableOpacity 
                style={[styles.tab, activeSection === 'personal' && styles.tabActive]}
                onPress={() => setActiveSection('personal')}
            >
                <Text style={[styles.tabText, activeSection === 'personal' && styles.tabTextActive]}>Personal</Text>
            </TouchableOpacity>
            <TouchableOpacity 
                style={[styles.tab, activeSection === 'location' && styles.tabActive]}
                onPress={() => setActiveSection('location')}
            >
                <Text style={[styles.tabText, activeSection === 'location' && styles.tabTextActive]}>Location</Text>
            </TouchableOpacity>
            {isMasterOrOwner && (
                <TouchableOpacity 
                    style={[styles.tab, activeSection === 'professional' && styles.tabActive]}
                    onPress={() => setActiveSection('professional')}
                >
                    <Text style={[styles.tabText, activeSection === 'professional' && styles.tabTextActive]}>Pro</Text>
                </TouchableOpacity>
            )}
            <TouchableOpacity 
                style={[styles.tab, activeSection === 'preferences' && styles.tabActive]}
                onPress={() => setActiveSection('preferences')}
            >
                <Text style={[styles.tabText, activeSection === 'preferences' && styles.tabTextActive]}>Prefs</Text>
            </TouchableOpacity>
        </View>
    );

    // Render Personal section
    const renderPersonalSection = () => (
        <View style={styles.sectionContent}>
            <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Full Name *</Text>
                <TextInput
                    style={styles.input}
                    value={editName}
                    onChangeText={setEditName}
                    placeholder="Enter your full name"
                    placeholderTextColor={colors.textMuted}
                />
            </View>

            <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Email</Text>
                <Text style={styles.readOnlyField}>{profile?.email}</Text>
                <Text style={styles.hintText}>Email cannot be changed</Text>
            </View>

            <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Phone Number</Text>
                <TextInput
                    style={[styles.input, phoneError && styles.inputError]}
                    value={editPhone}
                    onChangeText={handlePhoneChange}
                    placeholder="+1 234 567 8900"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="phone-pad"
                />
                {phoneError && <Text style={styles.errorText}>{phoneError}</Text>}
                <Text style={styles.hintText}>Include country code (e.g., +1, +353, +44)</Text>
            </View>

            <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Bio / About Me</Text>
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
                <Text style={styles.charCount}>{editBio.length}/500</Text>
            </View>
        </View>
    );

    // Render Location section
    const renderLocationSection = () => (
        <View style={styles.sectionContent}>
            <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>City</Text>
                <TextInput
                    style={styles.input}
                    value={editCity}
                    onChangeText={setEditCity}
                    placeholder="Enter your city"
                    placeholderTextColor={colors.textMuted}
                />
            </View>

            <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Country</Text>
                <TouchableOpacity 
                    style={styles.selector}
                    onPress={() => setCountryModalVisible(true)}
                >
                    <Text style={editCountry ? styles.selectorText : styles.selectorPlaceholder}>
                        {editCountry || 'Select your country'}
                    </Text>
                    <Text style={styles.selectorArrow}>▼</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Timezone</Text>
                <TouchableOpacity 
                    style={styles.selector}
                    onPress={() => setTimezoneModalVisible(true)}
                >
                    <Text style={styles.selectorText}>
                        {TIMEZONES.find(tz => tz.value === editTimezone)?.label || editTimezone}
                    </Text>
                    <Text style={styles.selectorArrow}>▼</Text>
                </TouchableOpacity>
                <Text style={styles.hintText}>This affects your availability and booking times</Text>
            </View>
        </View>
    );

    // Render Professional section
    const renderProfessionalSection = () => (
        <View style={styles.sectionContent}>
            <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Currency</Text>
                <TouchableOpacity 
                    style={styles.selector}
                    onPress={() => setCurrencyModalVisible(true)}
                >
                    <Text style={styles.selectorText}>
                        {editCurrency}
                    </Text>
                    <Text style={styles.selectorArrow}>▼</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Years of Experience</Text>
                <TextInput
                    style={styles.input}
                    value={editYearsExp}
                    onChangeText={setEditYearsExp}
                    placeholder="e.g., 5"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="number-pad"
                />
            </View>

            <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Specialties</Text>
                <TextInput
                    style={[styles.input, styles.textArea]}
                    value={editSpecialties}
                    onChangeText={setEditSpecialties}
                    placeholder="e.g., Acrylic nails, Volume lashes, Microblading, Balayage..."
                    placeholderTextColor={colors.textMuted}
                    multiline
                    numberOfLines={3}
                />
                <Text style={styles.hintText}>Comma-separated list of your specialties</Text>
            </View>

            <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Certifications</Text>
                <TextInput
                    style={[styles.input, styles.textArea]}
                    value={editCertifications}
                    onChangeText={setEditCertifications}
                    placeholder="e.g., NVQ Level 3 Beauty Therapy, Lash Perfect Certified..."
                    placeholderTextColor={colors.textMuted}
                    multiline
                    numberOfLines={3}
                />
                <Text style={styles.hintText}>List your professional certifications</Text>
            </View>
        </View>
    );

    // Render Preferences section
    const renderPreferencesSection = () => (
        <View style={styles.sectionContent}>
            <Text style={styles.sectionSubtitle}>Notification Preferences</Text>
            
            <View style={styles.switchRow}>
                <View style={styles.switchLabel}>
                    <Text style={styles.switchTitle}>Email Notifications</Text>
                    <Text style={styles.switchDescription}>Booking confirmations and updates</Text>
                </View>
                <Switch
                    value={emailNotifications}
                    onValueChange={setEmailNotifications}
                    trackColor={{ false: colors.border, true: colors.primary }}
                    thumbColor={colors.text}
                />
            </View>

            <View style={styles.switchRow}>
                <View style={styles.switchLabel}>
                    <Text style={styles.switchTitle}>Push Notifications</Text>
                    <Text style={styles.switchDescription}>Real-time alerts on your device</Text>
                </View>
                <Switch
                    value={pushNotifications}
                    onValueChange={setPushNotifications}
                    trackColor={{ false: colors.border, true: colors.primary }}
                    thumbColor={colors.text}
                />
            </View>

            <View style={styles.passwordSection}>
                <Text style={styles.sectionSubtitle}>Security</Text>
                <TouchableOpacity style={styles.passwordButton}>
                    <Text style={styles.passwordButtonText}>Change Password</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    // Country dropdown modal
    const renderCountryModal = () => (
        <Modal
            visible={countryModalVisible}
            transparent
            animationType="slide"
            onRequestClose={() => setCountryModalVisible(false)}
        >
            <View style={styles.dropdownOverlay}>
                <View style={styles.dropdownContent}>
                    <View style={styles.dropdownHeader}>
                        <Text style={styles.dropdownTitle}>Select Country</Text>
                        <TouchableOpacity onPress={() => setCountryModalVisible(false)}>
                            <Text style={styles.dropdownClose}>✕</Text>
                        </TouchableOpacity>
                    </View>
                    <ScrollView style={styles.dropdownList}>
                        {COUNTRIES.map((country) => (
                            <TouchableOpacity
                                key={country}
                                style={[styles.dropdownItem, editCountry === country && styles.dropdownItemSelected]}
                                onPress={() => {
                                    setEditCountry(country);
                                    setCountryModalVisible(false);
                                }}
                            >
                                <Text style={[styles.dropdownItemText, editCountry === country && styles.dropdownItemTextSelected]}>
                                    {country}
                                </Text>
                                {editCountry === country && <Text style={styles.checkmark}>✓</Text>}
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );

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
            <SafeAreaView style={styles.container} edges={['top']}>
                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={styles.title}>Profile</Text>
                    </View>

                    {/* Avatar */}
                    <View style={styles.avatarSection}>
                        <TouchableOpacity onPress={handleChangePhoto} disabled={uploadingPhoto}>
                            {profile?.avatar_url ? (
                                <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} />
                            ) : (
                                <View style={styles.avatar}>
                                    <Text style={styles.avatarText}>
                                        {profile?.full_name?.[0] || 'U'}
                                    </Text>
                                </View>
                            )}
                            <View style={styles.cameraIcon}>
                                <Text style={styles.cameraIconText}>{uploadingPhoto ? '⏳' : '📷'}</Text>
                            </View>
                        </TouchableOpacity>
                        <Text style={styles.name}>{profile?.full_name || 'User'}</Text>
                        <Text style={styles.email}>{profile?.email}</Text>
                        {profile?.phone && <Text style={styles.phone}>{profile.phone}</Text>}
                        {(profile?.city || profile?.country) && (
                            <Text style={styles.location}>
                                📍 {[profile?.city, profile?.country].filter(Boolean).join(', ')}
                            </Text>
                        )}
                    </View>

                    {/* Menu Items */}
                    <View style={styles.menu}>
                        {menuItems.map((item, index) => (
                            <TouchableOpacity key={index} onPress={item.action}>
                                <Card style={styles.menuItem} variant="glass">
                                    <Text style={styles.menuIcon}>{item.icon}</Text>
                                    <Text style={styles.menuText}>{item.label}</Text>
                                    <Text style={styles.menuChevron}>›</Text>
                                </Card>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Sign Out */}
                    <TouchableOpacity style={styles.signOutButton} onPress={signOut}>
                        <Text style={styles.signOutText}>Sign Out</Text>
                    </TouchableOpacity>

                    {/* App Version */}
                    <Text style={styles.version}>Merakí v0.1.0</Text>
                </ScrollView>

                {/* Edit Profile Modal */}
                <Modal
                    visible={editModalVisible}
                    animationType="slide"
                    presentationStyle="pageSheet"
                    onRequestClose={() => setEditModalVisible(false)}
                >
                    <SafeAreaView style={styles.modalContainer}>
                        <ScreenBackground>
                            <View style={styles.modalHeader}>
                                <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                                    <Text style={styles.modalCancel}>Cancel</Text>
                                </TouchableOpacity>
                                <Text style={styles.modalTitle}>Edit Profile</Text>
                                <View style={{ width: 60 }} />
                            </View>

                            {renderSectionTabs()}

                            <ScrollView style={styles.modalScrollContent}>
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
                    </SafeAreaView>
                </Modal>

                {/* Dropdown Modals */}
                {renderCountryModal()}
                {renderCurrencyModal()}
                {renderTimezoneModal()}
            </SafeAreaView>
        </ScreenBackground>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    scrollView: { flex: 1 },
    scrollContent: { padding: spacing.lg, paddingBottom: spacing.xxxl },
    header: { marginBottom: spacing.xl, paddingTop: spacing.md },
    title: { fontSize: 28, fontWeight: '600', color: colors.text },
    avatarSection: { alignItems: 'center', marginBottom: spacing.xl },
    avatar: { width: 100, height: 100, borderRadius: 50, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
    avatarText: { fontSize: 40, fontWeight: '600', color: colors.text },
    name: { fontSize: 26, fontWeight: '600', color: colors.text, marginBottom: spacing.xs },
    email: { fontSize: 16, color: colors.textSecondary },
    phone: { fontSize: 16, color: colors.textSecondary, marginTop: spacing.xs },
    location: { fontSize: 14, color: colors.textSecondary, marginTop: spacing.xs },
    menu: { gap: spacing.sm, marginBottom: spacing.xl },
    menuItem: { flexDirection: 'row', alignItems: 'center', padding: spacing.md },
    menuIcon: { fontSize: 22, marginRight: spacing.md },
    menuText: { flex: 1, fontSize: 16, color: colors.text, fontWeight: '500' },
    menuChevron: { fontSize: 20, color: colors.textSecondary },
    signOutButton: { paddingVertical: spacing.md, alignItems: 'center', borderRadius: 16, borderWidth: 1, borderColor: colors.error, marginBottom: spacing.lg, backgroundColor: 'rgba(239, 68, 68, 0.1)' },
    signOutText: { fontSize: 16, fontWeight: '600', color: colors.error },
    version: { textAlign: 'center', fontSize: 12, color: colors.textMuted },
    
    // Modal styles
    modalContainer: { flex: 1 },
    modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
    modalCancel: { color: colors.textSecondary, fontSize: 16 },
    modalTitle: { fontSize: 18, fontWeight: '600', color: colors.text },
    modalScrollContent: { flex: 1, padding: spacing.lg },
    saveButtonContainer: { padding: spacing.lg, marginTop: spacing.md },
    
    // Section tabs
    sectionTabs: { 
        flexDirection: 'row', 
        paddingHorizontal: spacing.lg, 
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        gap: spacing.sm
    },
    tab: { 
        paddingHorizontal: spacing.md, 
        paddingVertical: spacing.xs,
        borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.05)'
    },
    tabActive: { backgroundColor: colors.primary },
    tabText: { fontSize: 13, color: colors.textSecondary, fontWeight: '500' },
    tabTextActive: { color: colors.text },
    
    // Section content
    sectionContent: { paddingTop: spacing.md },
    sectionSubtitle: { fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: spacing.md, marginTop: spacing.md },
    inputGroup: { marginBottom: spacing.lg },
    inputLabel: { fontSize: 14, fontWeight: '500', color: colors.text, marginBottom: spacing.sm },
    input: { backgroundColor: colors.surface, borderRadius: 12, padding: spacing.md, color: colors.text, fontSize: 16, borderWidth: 1, borderColor: colors.border },
    inputError: { borderColor: colors.error },
    textArea: { height: 100, textAlignVertical: 'top' },
    errorText: { color: colors.error, fontSize: 12, marginTop: spacing.xs },
    hintText: { fontSize: 11, color: colors.textMuted, marginTop: spacing.xs },
    charCount: { fontSize: 11, color: colors.textMuted, textAlign: 'right', marginTop: spacing.xs },
    readOnlyField: { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: spacing.md, color: colors.textSecondary, fontSize: 16, borderWidth: 1, borderColor: colors.border },
    
    // Selectors
    selector: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: colors.border,
    },
    selectorText: { fontSize: 16, color: colors.text, flex: 1 },
    selectorPlaceholder: { fontSize: 16, color: colors.textMuted, flex: 1 },
    selectorArrow: { fontSize: 12, color: colors.textMuted },
    
    // Switches
    switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
    switchLabel: { flex: 1, marginRight: spacing.md },
    switchTitle: { fontSize: 16, color: colors.text, fontWeight: '500' },
    switchDescription: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
    
    // Password section
    passwordSection: { marginTop: spacing.xl },
    passwordButton: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: spacing.md, alignItems: 'center' },
    passwordButtonText: { color: colors.primary, fontSize: 16, fontWeight: '600' },
    
    // Dropdown modals
    dropdownOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
    dropdownContent: { backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '70%' },
    dropdownHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
    dropdownTitle: { fontSize: 18, fontWeight: '600', color: colors.text },
    dropdownClose: { fontSize: 20, color: colors.textMuted, padding: spacing.sm },
    dropdownList: { padding: spacing.md },
    dropdownItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.md, paddingHorizontal: spacing.md, borderRadius: 8, marginBottom: spacing.xs },
    dropdownItemSelected: { backgroundColor: 'rgba(139, 92, 246, 0.2)' },
    dropdownItemText: { fontSize: 16, color: colors.text, flex: 1 },
    dropdownItemTextSelected: { color: colors.primary, fontWeight: '500' },
    checkmark: { fontSize: 18, color: colors.primary, fontWeight: '600' },
    
    // Avatar image styles
    avatarImage: { width: 100, height: 100, borderRadius: 50, marginBottom: spacing.md, borderWidth: 2, borderColor: colors.primary },
    cameraIcon: { position: 'absolute', bottom: spacing.sm, right: 0, backgroundColor: colors.primary, borderRadius: 14, width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
    cameraIconText: { fontSize: 14 },
});

export default ProfileScreen;
