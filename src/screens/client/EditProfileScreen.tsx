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
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Card, Button, ScreenBackground, SearchablePicker, MerakiText } from '../../components/ui';
import { ImageUrlUpload } from '../../components/ImageUrlUpload';
import { TimezoneModal } from '../../components/TimezoneModal';
import { useModal } from '../../contexts/ModalContext';
import { colors, spacing, gradients } from '../../theme';
import {
    getAllCountries,
    getCountryByCode,
    type Country,
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

import {
    validatePhone,
    formatPhone,
    normalizePhone,
    parsePhoneNumber,
    SUPPORTED_COUNTRIES,
    validateFullName,
} from '../../utils/validation';

type ProfileStackParamList = {
    ProfileMain: undefined;
    HelpSupport: undefined;
    TermsOfService: undefined;
    PrivacyPolicy: undefined;
    StampCards: undefined;
    PaymentMethods: undefined;
    Notifications: undefined;
    Menu: undefined;
    MenuMain: undefined;
};

export function EditProfileScreen() {
    const navigation = useNavigation<NativeStackNavigationProp<ProfileStackParamList>>();
    const { profile, signOut, refreshProfile } = useAuth();
    const { showAlert } = useModal();
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [saving, setSaving] = useState(false);
    const [uploadingPhoto, setUploadingPhoto] = useState(false);
    const [activeSection, setActiveSection] = useState<'personal' | 'location' | 'professional' | 'preferences'>('personal');

    // Personal Info
    const [editName, setEditName] = useState(profile?.full_name || '');
    const initialParsedPhone = profile?.phone ? parsePhoneNumber(profile.phone) : { localNumber: '', countryCode: 'IE' };
    const [editPhone, setEditPhone] = useState(initialParsedPhone.localNumber);
    const [phoneCountryCode, setPhoneCountryCode] = useState(initialParsedPhone.countryCode);
    const [showPhoneCountryPicker, setShowPhoneCountryPicker] = useState(false);
    const [editBio, setEditBio] = useState(profile?.bio || '');
    const [phoneError, setPhoneError] = useState<string | undefined>(undefined);

    // Location
    const [editCity, setEditCity] = useState(profile?.city || '');
    const [editCountry, setEditCountry] = useState(profile?.country || '');
    const [editCountryCode, setEditCountryCode] = useState('');
    const [editSearchRadius, setEditSearchRadius] = useState<number>((profile as any)?.search_radius_km ?? 50);
    const [editTimezone, setEditTimezone] = useState(profile?.timezone || 'Europe/Dublin');

    // Professional (Masters/Owners only)
    const [editCurrency, setEditCurrency] = useState(profile?.currency || 'EUR');
    const [editYearsExp, setEditYearsExp] = useState('');
    const [editSpecialties, setEditSpecialties] = useState('');
    const [editCertifications, setEditCertifications] = useState('');

    // Preferences
    const [emailNotifications, setEmailNotifications] = useState(true);
    const [pushNotifications, setPushNotifications] = useState(true);

    // Change Password
    const [changePasswordVisible, setChangePasswordVisible] = useState(false);
    const [passwordMode, setPasswordMode] = useState<'change' | 'forgot' | 'verify'>('change');
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmNewPassword, setConfirmNewPassword] = useState('');
    const [changingPassword, setChangingPassword] = useState(false);
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [otpCode, setOtpCode] = useState('');
    const [sendingOtp, setSendingOtp] = useState(false);
    const [otpSent, setOtpSent] = useState(false);

    // Change Email (deep link callback handles confirmation)
    const [emailModalVisible, setEmailModalVisible] = useState(false);
    const [newEmailValue, setNewEmailValue] = useState('');
    const [updatingEmail, setUpdatingEmail] = useState(false);

    // Delete Account (phrase + email OTP)
    const DELETE_PHRASE = 'DELETE MY ACCOUNT';
    const [deleteModalVisible, setDeleteModalVisible] = useState(false);
    const [deletePhraseInput, setDeletePhraseInput] = useState('');
    const [deleteOtpCode, setDeleteOtpCode] = useState('');
    const [deleteOtpSent, setDeleteOtpSent] = useState(false);
    const [sendingDeleteOtp, setSendingDeleteOtp] = useState(false);
    const [deletingAccount, setDeletingAccount] = useState(false);

    // Location API data
    const [countries, setCountries] = useState<Country[]>([]);
    const [loadingCountries, setLoadingCountries] = useState(false);


    // Picker modals
    const [countryModalVisible, setCountryModalVisible] = useState(false);
    const [currencyModalVisible, setCurrencyModalVisible] = useState(false);
    const [timezoneModalVisible, setTimezoneModalVisible] = useState(false);

    const openEditModal = async () => {
        // Load all current values from profile
        setEditName(profile?.full_name || '');
        if (profile?.phone) {
            const parsed = parsePhoneNumber(profile.phone);
            setEditPhone(parsed.localNumber);
            setPhoneCountryCode(parsed.countryCode);
        } else {
            setEditPhone('');
            setPhoneCountryCode('IE');
        }
        setEditBio(profile?.bio || '');
        setEditCity(profile?.city || '');
        setEditCountry(profile?.country || '');
        setEditTimezone(profile?.timezone || 'Europe/Dublin');
        setEditSearchRadius((profile as any)?.search_radius_km ?? 50);
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

    const handleChangePassword = async () => {
        if (!currentPassword) {
            showAlert('Error', 'Please enter your current password.', 'error');
            return;
        }
        if (!newPassword) {
            showAlert('Error', 'Please enter a new password.', 'error');
            return;
        }
        if (newPassword.length < 6) {
            showAlert('Error', 'New password must be at least 6 characters.', 'error');
            return;
        }
        if (newPassword !== confirmNewPassword) {
            showAlert('Error', 'New passwords do not match.', 'error');
            return;
        }
        if (currentPassword === newPassword) {
            showAlert('Error', 'New password must be different from your current password.', 'error');
            return;
        }

        setChangingPassword(true);
        try {
            // Verify current password by re-authenticating
            const { error: signInError } = await supabase.auth.signInWithPassword({
                email: profile?.email || '',
                password: currentPassword,
            });

            if (signInError) {
                showAlert('Error', 'Current password is incorrect.', 'error');
                setChangingPassword(false);
                return;
            }

            // Update to the new password
            const { error: updateError } = await supabase.auth.updateUser({
                password: newPassword,
            });

            if (updateError) {
                showAlert('Error', updateError.message, 'error');
            } else {
                setChangePasswordVisible(false);
                showAlert('Success', 'Your password has been updated successfully.', 'success');
            }
        } catch (err: any) {
            showAlert('Error', err.message || 'Failed to change password.', 'error');
        } finally {
            setChangingPassword(false);
        }
    };

    const handleSendOtp = async () => {
        const email = profile?.email;
        if (!email) {
            showAlert('Error', 'No email found on your profile.', 'error');
            return;
        }
        setSendingOtp(true);
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email);
            if (error) {
                showAlert('Error', error.message, 'error');
            } else {
                setOtpSent(true);
                setPasswordMode('verify');
                showAlert('Email Sent', `A 6-digit verification code has been sent to ${email}.`, 'success');
            }
        } catch (err: any) {
            showAlert('Error', err.message || 'Failed to send verification code.', 'error');
        } finally {
            setSendingOtp(false);
        }
    };

    const handleVerifyOtpAndReset = async () => {
        if (!otpCode || otpCode.length < 6) {
            showAlert('Error', 'Please enter the 6-digit verification code.', 'error');
            return;
        }
        if (!newPassword) {
            showAlert('Error', 'Please enter a new password.', 'error');
            return;
        }
        if (newPassword.length < 6) {
            showAlert('Error', 'New password must be at least 6 characters.', 'error');
            return;
        }
        if (newPassword !== confirmNewPassword) {
            showAlert('Error', 'New passwords do not match.', 'error');
            return;
        }

        setChangingPassword(true);
        try {
            const { error } = await supabase.auth.verifyOtp({
                email: profile?.email || '',
                token: otpCode,
                type: 'recovery',
            });
            if (error) {
                showAlert('Error', 'Invalid or expired verification code.', 'error');
                setChangingPassword(false);
                return;
            }

            const { error: updateError } = await supabase.auth.updateUser({
                password: newPassword,
            });
            if (updateError) {
                showAlert('Error', updateError.message, 'error');
            } else {
                setChangePasswordVisible(false);
                showAlert('Success', 'Your password has been reset successfully.', 'success');
            }
        } catch (err: any) {
            showAlert('Error', err.message || 'Failed to reset password.', 'error');
        } finally {
            setChangingPassword(false);
        }
    };

    const handleOpenEmailModal = () => {
        setNewEmailValue('');
        setEmailModalVisible(true);
    };

    const handleChangeEmail = async () => {
        const trimmed = newEmailValue.trim().toLowerCase();
        if (!trimmed || !trimmed.includes('@')) {
            showAlert('Invalid email', 'Please enter a valid email address.', 'error');
            return;
        }
        if (profile?.email && trimmed === profile.email.toLowerCase()) {
            showAlert('Already your email', 'That is already your current email.', 'error');
            return;
        }
        setUpdatingEmail(true);
        try {
            // Deep link callback handled by DeepLinkHandler — both confirmation
            // links open the app via meraki://auth-callback?...
            const { error } = await supabase.auth.updateUser(
                { email: trimmed },
                { emailRedirectTo: 'meraki://auth-callback' }
            );
            if (error) throw error;
            setEmailModalVisible(false);
            showAlert(
                'Confirmation sent',
                'Open BOTH email links (old + new) on this device to finish the change. Tapping each link opens Merakí and confirms automatically.',
                'success'
            );
        } catch (err: any) {
            showAlert('Error', err?.message || 'Failed to update email.', 'error');
        } finally {
            setUpdatingEmail(false);
        }
    };

    const handleOpenDeleteModal = () => {
        setDeletePhraseInput('');
        setDeleteOtpCode('');
        setDeleteOtpSent(false);
        setDeleteModalVisible(true);
    };

    const handleSendDeleteOtp = async () => {
        const email = profile?.email;
        if (!email) {
            showAlert('Error', 'No email on profile — contact support.', 'error');
            return;
        }
        if (deletePhraseInput !== DELETE_PHRASE) {
            showAlert('Phrase mismatch', `Type the phrase exactly: ${DELETE_PHRASE}`, 'error');
            return;
        }
        setSendingDeleteOtp(true);
        try {
            const { error } = await supabase.auth.signInWithOtp({
                email,
                options: { shouldCreateUser: false },
            });
            if (error) throw error;
            setDeleteOtpSent(true);
            showAlert('Code sent', 'A 6-digit code was emailed to you.', 'success');
        } catch (err: any) {
            showAlert('Error', err?.message || 'Failed to send code.', 'error');
        } finally {
            setSendingDeleteOtp(false);
        }
    };

    const handleConfirmDeleteAccount = async () => {
        if (deletePhraseInput !== DELETE_PHRASE) {
            showAlert('Phrase mismatch', `Type the phrase exactly: ${DELETE_PHRASE}`, 'error');
            return;
        }
        if (!/^\d{6}$/.test(deleteOtpCode.trim())) {
            showAlert('Invalid code', 'Enter the 6-digit code from your email.', 'error');
            return;
        }
        setDeletingAccount(true);
        try {
            const { data, error } = await supabase.functions.invoke('delete-account', {
                body: { otp: deleteOtpCode.trim(), phrase: deletePhraseInput },
            });
            const errorMessage =
                (error && (error as any).message) ||
                (data && (data as any).error) ||
                (typeof data === 'string' ? data : null);
            if (errorMessage) throw new Error(errorMessage);
            if (!data?.success) throw new Error('Unexpected response from server');

            setDeleteModalVisible(false);
            showAlert('Account deleted', 'Your account has been permanently deleted.', 'success');
            await signOut();
        } catch (err: any) {
            showAlert('Error', err?.message || 'Failed to delete account.', 'error');
            setDeletingAccount(false);
        }
    };

    const handleSaveProfile = async () => {
        // Validate name
        const nameVal = validateFullName(editName);
        if (!nameVal.valid) {
            showAlert('Invalid Name', nameVal.error || 'Please enter a valid full name.', 'error');
            return;
        }

        // Validate phone
        if (editPhone.trim()) {
            const phoneValidation = validatePhone(editPhone, phoneCountryCode);
            if (!phoneValidation.valid) {
                setPhoneError(phoneValidation.error);
                return;
            }
        }
        setPhoneError(undefined);

        setSaving(true);
        try {
            const normalizedPhone = editPhone.trim() ? normalizePhone(editPhone, phoneCountryCode) : null;
            const updateData: any = {
                full_name: editName,
                phone: normalizedPhone,
                bio: editBio.trim() || null,
                city: editCity.trim() || null,
                country: editCountry || null,
                timezone: editTimezone || null,
                currency: editCurrency || null,
                search_radius_km: editSearchRadius,
                updated_at: new Date().toISOString(),
            };

            const { error } = await supabase
                .from('profiles')
                .update(updateData)
                .eq('id', profile?.id || '');

            if (error) throw error;

            await refreshProfile?.();
            
            showAlert('Success', 'Profile updated successfully', 'success');
        } catch (error: any) {
            showAlert('Error', error.message || 'Failed to save profile', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handlePhoneChange = (text: string) => {
        setEditPhone(text);
        // Auto-detect country code from prefix if pasted/typed
        if (text.startsWith('+') || text.startsWith('00')) {
            const parsed = parsePhoneNumber(text);
            if (parsed.countryCode) {
                setPhoneCountryCode(parsed.countryCode);
                setEditPhone(parsed.localNumber);
            }
        }
        if (phoneError) setPhoneError(undefined);
    };

    const handlePhoneBlur = () => {
        if (editPhone.trim()) {
            const validation = validatePhone(editPhone, phoneCountryCode);
            if (validation.valid) setEditPhone(formatPhone(editPhone, phoneCountryCode));
        }
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
            console.error('Failed to update photo', { error: error?.message });
            showAlert('Error', 'Failed to update photo. Please try again.', 'error');
        } finally {
            setUploadingPhoto(false);
        }
    };

    const handleUrlAvatarUpload = async (publicUrl: string) => {
        try {
            setUploadingPhoto(true);
            await supabase
                .from('profiles')
                .update({ avatar_url: publicUrl })
                .eq('id', profile?.id || '');
            await refreshProfile?.();
            showAlert('Success', 'Profile photo updated from URL', 'success');
        } catch (error: any) {
            console.error('Failed to update photo from URL', { error: error?.message });
            showAlert('Error', 'Failed to update photo. Please try again.', 'error');
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
            { icon: 'star-outline', label: 'Loyalty Cards', action: () => navigation.navigate('StampCards' as any) },
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
            {/* Avatar section with file picker + URL upload */}
            <View style={styles.avatarSection}>
                {uploadingPhoto ? (
                    <ActivityIndicator size="large" color={colors.accent} style={{ marginBottom: spacing.md }} />
                ) : (
                    <TouchableOpacity onPress={handleChangePhoto} activeOpacity={0.8}>
                        {profile?.avatar_url ? (
                            <Image source={{ uri: profile.avatar_url }} style={styles.personalAvatar} />
                        ) : (
                            <View style={[styles.personalAvatar, styles.avatarPlaceholder]}>
                                <MaterialIcons name="person" size={40} color={colors.textMuted} />
                            </View>
                        )}
                        <View style={styles.cameraBadge}>
                            <MaterialIcons name="photo-camera" size={16} color="#fff" />
                        </View>
                    </TouchableOpacity>
                )}
                <MerakiText style={styles.avatarHint}>Tap photo to pick from gallery</MerakiText>
                <ImageUrlUpload
                    onUpload={handleUrlAvatarUpload}
                    bucket="avatars"
                    pathPrefix="url-uploads"
                    userId={profile?.id}
                    label="Or paste an image URL"
                    compact
                />
            </View>

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
                <TouchableOpacity onPress={handleOpenEmailModal} style={emailStyles.changeEmailLink}>
                    <MaterialIcons name="alternate-email" size={14} color={colors.primary} />
                    <MerakiText style={emailStyles.changeEmailText}>Change Email</MerakiText>
                </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
                <MerakiText style={styles.inputLabel}>Phone Number</MerakiText>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TouchableOpacity
                        style={[
                            styles.phoneCodeButton,
                            phoneError ? styles.phoneCodeButtonError : null
                        ]}
                        onPress={() => setShowPhoneCountryPicker(true)}
                    >
                        <MerakiText style={styles.phoneCodeText}>
                            {SUPPORTED_COUNTRIES.find(c => c.code === phoneCountryCode)?.flag || '🇮🇪'} {SUPPORTED_COUNTRIES.find(c => c.code === phoneCountryCode)?.callingCode || '+353'}
                        </MerakiText>
                        <MaterialIcons name="arrow-drop-down" size={20} color={colors.text} />
                    </TouchableOpacity>
                    <Card variant="glass" style={[styles.inputContainer, { flex: 1 }, phoneError && styles.inputError]}>
                        <TextInput
                            style={styles.input}
                            value={editPhone}
                            onChangeText={handlePhoneChange}
                            onBlur={handlePhoneBlur}
                            placeholder="87 123 4567"
                            placeholderTextColor={colors.textMuted}
                            keyboardType="phone-pad"
                        />
                    </Card>
                </View>
                {phoneError && <MerakiText style={styles.errorText}>{phoneError}</MerakiText>}
                <MerakiText style={styles.hintText}>Enter your phone number without the country code</MerakiText>
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
                <Card variant="glass" style={[styles.inputContainer, !editCountry && styles.selectorDisabled]}>
                    <TextInput
                        style={styles.input}
                        value={editCity}
                        onChangeText={setEditCity}
                        placeholder={editCountry ? "e.g., London, New York..." : "Select country first"}
                        placeholderTextColor={colors.textMuted}
                        editable={!!editCountry}
                    />
                </Card>
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

            {profile?.role === 'client' && (
                <View style={styles.inputGroup}>
                    <MerakiText style={styles.inputLabel}>Search Radius</MerakiText>
                    <MerakiText style={styles.hintText}>Only show specialists within this distance</MerakiText>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                        {[
                            { label: '10 km', value: 10 },
                            { label: '25 km', value: 25 },
                            { label: '50 km', value: 50 },
                            { label: 'Whole Country', value: 0 },
                        ].map((opt) => (
                            <TouchableOpacity
                                key={opt.value}
                                onPress={() => setEditSearchRadius(opt.value)}
                                style={{
                                    paddingHorizontal: 14,
                                    paddingVertical: 8,
                                    borderRadius: 20,
                                    backgroundColor: editSearchRadius === opt.value ? colors.primary : colors.surface,
                                    borderWidth: 1,
                                    borderColor: editSearchRadius === opt.value ? colors.primary : colors.border,
                                }}
                            >
                                <Text style={{
                                    color: editSearchRadius === opt.value ? '#fff' : colors.textSecondary,
                                    fontSize: 13,
                                    fontWeight: editSearchRadius === opt.value ? '600' : '400',
                                }}>
                                    {opt.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            )}
        </View>
    );




    // Handle country selection
    const handleCountrySelect = (item: { id: string | number; name: string }) => {
        const selectedCountry = countries.find(c => c.id === item.id);
        if (selectedCountry) {
            setEditCountry(selectedCountry.name);
            setEditCountryCode(selectedCountry.iso2);
            setEditCity(''); // Reset city when country changes
            // Auto-set timezone from country
            if (selectedCountry.timezones && selectedCountry.timezones.length > 0) {
                setEditTimezone(selectedCountry.timezones[0].zoneName);
            }
        }
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
                <TouchableOpacity onPress={() => {
                    setCurrentPassword('');
                    setNewPassword('');
                    setConfirmNewPassword('');
                    setShowCurrentPassword(false);
                    setShowNewPassword(false);
                    setShowConfirmPassword(false);
                    setPasswordMode('change');
                    setOtpCode('');
                    setOtpSent(false);
                    setChangePasswordVisible(true);
                }}>
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

        return (
        <ScreenBackground>
            <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
                <View style={styles.modalHeader}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.modalCloseBtn}>
                        <MaterialIcons name="arrow-back" size={24} color={colors.text} />
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

                    {/* Danger Zone — Delete Account */}
                    <View style={{ marginTop: spacing.xl }}>
                        <TouchableOpacity
                            style={emailStyles.dangerButton}
                            onPress={handleOpenDeleteModal}
                            activeOpacity={0.8}
                        >
                            <MaterialIcons name="warning" size={16} color={colors.error} />
                            <MerakiText style={emailStyles.dangerButtonText}>Delete Account</MerakiText>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.saveButtonContainer}>
                        <Button
                            title={saving ? 'Saving...' : 'Save Changes'}
                            onPress={handleSaveProfile}
                            loading={saving}
                            fullWidth
                        />
                    </View>
                </ScrollView>
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

                {renderCurrencyModal()}
                <TimezoneModal
                    visible={timezoneModalVisible}
                    timezones={TIMEZONES}
                    selectedTimezone={editTimezone}
                    onSelect={setEditTimezone}
                    onClose={() => setTimezoneModalVisible(false)}
                />

                {/* Phone Country Code Picker */}
                <SearchablePicker
                    visible={showPhoneCountryPicker}
                    title="Select Country Calling Code"
                    items={SUPPORTED_COUNTRIES.map(c => ({
                        id: c.code,
                        name: `${c.flag} ${c.name}`,
                        subtitle: c.callingCode,
                    }))}
                    onSelect={(item) => {
                        setPhoneCountryCode(String(item.id));
                        if (phoneError) setPhoneError(undefined);
                        setShowPhoneCountryPicker(false);
                    }}
                    onClose={() => setShowPhoneCountryPicker(false)}
                    searchPlaceholder="Search countries..."
                />

                {/* Change Password Modal */}
                <Modal
                    visible={changePasswordVisible}
                    transparent
                    animationType="fade"
                    onRequestClose={() => setChangePasswordVisible(false)}
                    statusBarTranslucent
                >
                    <View style={cpStyles.overlay}>
                        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setChangePasswordVisible(false)} />
                        <View style={cpStyles.container}>
                            <LinearGradient
                                colors={['rgba(212, 138, 130, 0.5)', 'rgba(230, 192, 144, 0.3)']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={cpStyles.gradientBorder}
                            >
                                <View style={cpStyles.innerCard}>
                                    {/* Header */}
                                    <View style={cpStyles.header}>
                                        <View style={cpStyles.iconGlow}>
                                            <MaterialIcons name="lock" size={28} color={colors.primary} />
                                        </View>
                                        <MerakiText variant="h2" style={cpStyles.title}>
                                            {passwordMode === 'change' ? 'Change Password' : passwordMode === 'forgot' ? 'Reset via Email' : 'Enter Verification Code'}
                                        </MerakiText>
                                        <MerakiText style={cpStyles.subtitle}>
                                            {passwordMode === 'change'
                                                ? 'Enter your current password and choose a new one'
                                                : passwordMode === 'forgot'
                                                    ? `We\'ll send a verification code to ${profile?.email}`
                                                    : 'Enter the code sent to your email and set a new password'}
                                        </MerakiText>
                                    </View>

                                    <ScrollView style={cpStyles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                                        {/* Mode: Change with current password */}
                                        {passwordMode === 'change' && (
                                            <>
                                                <View style={cpStyles.fieldGroup}>
                                                    <MerakiText style={cpStyles.fieldLabel}>Current Password</MerakiText>
                                                    <View style={cpStyles.inputRow}>
                                                        <TextInput
                                                            style={cpStyles.fieldInput}
                                                            value={currentPassword}
                                                            onChangeText={setCurrentPassword}
                                                            secureTextEntry={!showCurrentPassword}
                                                            placeholder="Enter current password"
                                                            placeholderTextColor={colors.textMuted}
                                                            autoCapitalize="none"
                                                        />
                                                        <TouchableOpacity onPress={() => setShowCurrentPassword(!showCurrentPassword)} style={cpStyles.eyeBtn}>
                                                            <MaterialIcons name={showCurrentPassword ? 'visibility-off' : 'visibility'} size={20} color={colors.textSecondary} />
                                                        </TouchableOpacity>
                                                    </View>
                                                </View>

                                                <View style={cpStyles.fieldGroup}>
                                                    <MerakiText style={cpStyles.fieldLabel}>New Password</MerakiText>
                                                    <View style={cpStyles.inputRow}>
                                                        <TextInput
                                                            style={cpStyles.fieldInput}
                                                            value={newPassword}
                                                            onChangeText={setNewPassword}
                                                            secureTextEntry={!showNewPassword}
                                                            placeholder="Enter new password"
                                                            placeholderTextColor={colors.textMuted}
                                                            autoCapitalize="none"
                                                        />
                                                        <TouchableOpacity onPress={() => setShowNewPassword(!showNewPassword)} style={cpStyles.eyeBtn}>
                                                            <MaterialIcons name={showNewPassword ? 'visibility-off' : 'visibility'} size={20} color={colors.textSecondary} />
                                                        </TouchableOpacity>
                                                    </View>
                                                    <MerakiText style={cpStyles.hint}>Minimum 6 characters</MerakiText>
                                                </View>

                                                <View style={cpStyles.fieldGroup}>
                                                    <MerakiText style={cpStyles.fieldLabel}>Confirm New Password</MerakiText>
                                                    <View style={cpStyles.inputRow}>
                                                        <TextInput
                                                            style={cpStyles.fieldInput}
                                                            value={confirmNewPassword}
                                                            onChangeText={setConfirmNewPassword}
                                                            secureTextEntry={!showConfirmPassword}
                                                            placeholder="Confirm new password"
                                                            placeholderTextColor={colors.textMuted}
                                                            autoCapitalize="none"
                                                        />
                                                        <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} style={cpStyles.eyeBtn}>
                                                            <MaterialIcons name={showConfirmPassword ? 'visibility-off' : 'visibility'} size={20} color={colors.textSecondary} />
                                                        </TouchableOpacity>
                                                    </View>
                                                </View>

                                                <Button
                                                    title={changingPassword ? 'Updating...' : 'Update Password'}
                                                    onPress={handleChangePassword}
                                                    loading={changingPassword}
                                                    fullWidth
                                                    style={{ marginTop: spacing.sm }}
                                                />

                                                {/* Divider */}
                                                <View style={cpStyles.dividerRow}>
                                                    <View style={cpStyles.dividerLine} />
                                                    <MerakiText style={cpStyles.dividerText}>or</MerakiText>
                                                    <View style={cpStyles.dividerLine} />
                                                </View>

                                                {/* Forgot password button */}
                                                <TouchableOpacity
                                                    style={cpStyles.forgotBtn}
                                                    onPress={() => {
                                                        setPasswordMode('forgot');
                                                        setNewPassword('');
                                                        setConfirmNewPassword('');
                                                        setOtpCode('');
                                                        setOtpSent(false);
                                                    }}
                                                >
                                                    <MaterialIcons name="email" size={18} color={colors.primary} />
                                                    <MerakiText style={cpStyles.forgotBtnText}>Forgot Password? Reset via Email</MerakiText>
                                                </TouchableOpacity>
                                            </>
                                        )}

                                        {/* Mode: Forgot password - send OTP */}
                                        {passwordMode === 'forgot' && (
                                            <>
                                                <View style={cpStyles.emailPreview}>
                                                    <MaterialIcons name="mail-outline" size={22} color={colors.primary} />
                                                    <MerakiText style={cpStyles.emailText}>{profile?.email}</MerakiText>
                                                </View>

                                                <MerakiText style={cpStyles.infoText}>
                                                    Tap the button below to receive a 6-digit verification code at your registered email address.
                                                </MerakiText>

                                                <Button
                                                    title={sendingOtp ? 'Sending...' : 'Send Verification Code'}
                                                    onPress={handleSendOtp}
                                                    loading={sendingOtp}
                                                    fullWidth
                                                    style={{ marginTop: spacing.md }}
                                                />

                                                <TouchableOpacity
                                                    style={cpStyles.backLink}
                                                    onPress={() => setPasswordMode('change')}
                                                >
                                                    <MaterialIcons name="arrow-back" size={16} color={colors.textSecondary} />
                                                    <MerakiText style={cpStyles.backLinkText}>Back to Change Password</MerakiText>
                                                </TouchableOpacity>
                                            </>
                                        )}

                                        {/* Mode: Verify OTP + set new password */}
                                        {passwordMode === 'verify' && (
                                            <>
                                                <View style={cpStyles.fieldGroup}>
                                                    <MerakiText style={cpStyles.fieldLabel}>Verification Code</MerakiText>
                                                    <View style={cpStyles.inputRow}>
                                                        <TextInput
                                                            style={[cpStyles.fieldInput, { letterSpacing: 8, fontSize: 20, textAlign: 'center' }]}
                                                            value={otpCode}
                                                            onChangeText={(text) => setOtpCode(text.replace(/[^0-9]/g, '').slice(0, 6))}
                                                            placeholder="000000"
                                                            placeholderTextColor={colors.textMuted}
                                                            keyboardType="number-pad"
                                                            maxLength={6}
                                                            autoCapitalize="none"
                                                        />
                                                    </View>
                                                    <MerakiText style={cpStyles.hint}>Enter the 6-digit code from your email</MerakiText>
                                                </View>

                                                <View style={cpStyles.fieldGroup}>
                                                    <MerakiText style={cpStyles.fieldLabel}>New Password</MerakiText>
                                                    <View style={cpStyles.inputRow}>
                                                        <TextInput
                                                            style={cpStyles.fieldInput}
                                                            value={newPassword}
                                                            onChangeText={setNewPassword}
                                                            secureTextEntry={!showNewPassword}
                                                            placeholder="Enter new password"
                                                            placeholderTextColor={colors.textMuted}
                                                            autoCapitalize="none"
                                                        />
                                                        <TouchableOpacity onPress={() => setShowNewPassword(!showNewPassword)} style={cpStyles.eyeBtn}>
                                                            <MaterialIcons name={showNewPassword ? 'visibility-off' : 'visibility'} size={20} color={colors.textSecondary} />
                                                        </TouchableOpacity>
                                                    </View>
                                                    <MerakiText style={cpStyles.hint}>Minimum 6 characters</MerakiText>
                                                </View>

                                                <View style={cpStyles.fieldGroup}>
                                                    <MerakiText style={cpStyles.fieldLabel}>Confirm New Password</MerakiText>
                                                    <View style={cpStyles.inputRow}>
                                                        <TextInput
                                                            style={cpStyles.fieldInput}
                                                            value={confirmNewPassword}
                                                            onChangeText={setConfirmNewPassword}
                                                            secureTextEntry={!showConfirmPassword}
                                                            placeholder="Confirm new password"
                                                            placeholderTextColor={colors.textMuted}
                                                            autoCapitalize="none"
                                                        />
                                                        <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} style={cpStyles.eyeBtn}>
                                                            <MaterialIcons name={showConfirmPassword ? 'visibility-off' : 'visibility'} size={20} color={colors.textSecondary} />
                                                        </TouchableOpacity>
                                                    </View>
                                                </View>

                                                <Button
                                                    title={changingPassword ? 'Resetting...' : 'Reset Password'}
                                                    onPress={handleVerifyOtpAndReset}
                                                    loading={changingPassword}
                                                    fullWidth
                                                    style={{ marginTop: spacing.sm }}
                                                />

                                                {/* Resend code */}
                                                <TouchableOpacity
                                                    style={cpStyles.backLink}
                                                    onPress={handleSendOtp}
                                                    disabled={sendingOtp}
                                                >
                                                    <MaterialIcons name="refresh" size={16} color={colors.textSecondary} />
                                                    <MerakiText style={cpStyles.backLinkText}>
                                                        {sendingOtp ? 'Sending...' : "Didn't receive it? Resend code"}
                                                    </MerakiText>
                                                </TouchableOpacity>

                                                <TouchableOpacity
                                                    style={[cpStyles.backLink, { marginTop: 0 }]}
                                                    onPress={() => setPasswordMode('change')}
                                                >
                                                    <MaterialIcons name="arrow-back" size={16} color={colors.textSecondary} />
                                                    <MerakiText style={cpStyles.backLinkText}>Back to Change Password</MerakiText>
                                                </TouchableOpacity>
                                            </>
                                        )}
                                    </ScrollView>

                                    {/* Close button */}
                                    <TouchableOpacity style={cpStyles.closeBtn} onPress={() => setChangePasswordVisible(false)}>
                                        <MerakiText style={cpStyles.closeBtnText}>Cancel</MerakiText>
                                    </TouchableOpacity>
                                </View>
                            </LinearGradient>
                        </View>
                    </View>
                </Modal>

                {/* ── Change Email Modal ─────────────────────────────────── */}
                <Modal
                    visible={emailModalVisible}
                    transparent
                    animationType="fade"
                    onRequestClose={() => !updatingEmail && setEmailModalVisible(false)}
                    statusBarTranslucent
                >
                    <View style={emailStyles.overlay}>
                        <TouchableOpacity
                            style={StyleSheet.absoluteFill}
                            activeOpacity={1}
                            onPress={() => !updatingEmail && setEmailModalVisible(false)}
                        />
                        <View style={emailStyles.modalCard}>
                            <View style={emailStyles.modalHeader}>
                                <View style={emailStyles.iconCircle}>
                                    <MaterialIcons name="alternate-email" size={24} color={colors.primary} />
                                </View>
                                <MerakiText variant="h2" style={emailStyles.modalTitle}>Change Email</MerakiText>
                                <MerakiText style={emailStyles.modalSubtitle}>
                                    Enter your new email. You will receive confirmation links at BOTH your old and new addresses — open both to finish the change.
                                </MerakiText>
                            </View>

                            <View style={emailStyles.fieldGroup}>
                                <MerakiText style={emailStyles.fieldLabel}>Current Email</MerakiText>
                                <View style={emailStyles.readonlyRow}>
                                    <MerakiText style={emailStyles.readonlyText}>{profile?.email}</MerakiText>
                                </View>
                            </View>

                            <View style={emailStyles.fieldGroup}>
                                <MerakiText style={emailStyles.fieldLabel}>New Email</MerakiText>
                                <View style={emailStyles.inputRow}>
                                    <TextInput
                                        style={emailStyles.input}
                                        value={newEmailValue}
                                        onChangeText={setNewEmailValue}
                                        placeholder="name@example.com"
                                        placeholderTextColor={colors.textMuted}
                                        keyboardType="email-address"
                                        autoCapitalize="none"
                                        autoComplete="email"
                                        editable={!updatingEmail}
                                    />
                                </View>
                            </View>

                            <Button
                                title={updatingEmail ? 'Sending…' : 'Send Confirmation Links'}
                                onPress={handleChangeEmail}
                                loading={updatingEmail}
                                fullWidth
                                style={{ marginTop: spacing.sm }}
                            />

                            <TouchableOpacity
                                style={emailStyles.modalCancel}
                                onPress={() => !updatingEmail && setEmailModalVisible(false)}
                                disabled={updatingEmail}
                            >
                                <MerakiText style={emailStyles.modalCancelText}>Cancel</MerakiText>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Modal>

                {/* ── Delete Account Modal ───────────────────────────────── */}
                <Modal
                    visible={deleteModalVisible}
                    transparent
                    animationType="fade"
                    onRequestClose={() => !deletingAccount && setDeleteModalVisible(false)}
                    statusBarTranslucent
                >
                    <View style={emailStyles.overlay}>
                        <TouchableOpacity
                            style={StyleSheet.absoluteFill}
                            activeOpacity={1}
                            onPress={() => !deletingAccount && setDeleteModalVisible(false)}
                        />
                        <View style={emailStyles.modalCard}>
                            <View style={emailStyles.modalHeader}>
                                <View style={[emailStyles.iconCircle, { backgroundColor: 'rgba(239,68,68,0.12)' }]}>
                                    <MaterialIcons name="warning" size={24} color={colors.error} />
                                </View>
                                <MerakiText variant="h2" style={[emailStyles.modalTitle, { color: colors.error }]}>
                                    Delete Account
                                </MerakiText>
                                <MerakiText style={emailStyles.modalSubtitle}>
                                    This is permanent. All bookings, services, messages, and personal data tied to {profile?.email} will be erased.
                                </MerakiText>
                            </View>

                            <View style={emailStyles.fieldGroup}>
                                <MerakiText style={emailStyles.fieldLabel}>
                                    Type{' '}
                                    <MerakiText style={{ color: colors.error, fontWeight: '700' }}>
                                        {DELETE_PHRASE}
                                    </MerakiText>{' '}
                                    to confirm
                                </MerakiText>
                                <View style={emailStyles.inputRow}>
                                    <TextInput
                                        style={emailStyles.input}
                                        value={deletePhraseInput}
                                        onChangeText={setDeletePhraseInput}
                                        placeholder={DELETE_PHRASE}
                                        placeholderTextColor={colors.textMuted}
                                        autoCapitalize="characters"
                                        autoCorrect={false}
                                        editable={!deletingAccount}
                                    />
                                </View>
                            </View>

                            {deleteOtpSent && (
                                <View style={emailStyles.fieldGroup}>
                                    <MerakiText style={emailStyles.fieldLabel}>6-digit code from email</MerakiText>
                                    <View style={emailStyles.inputRow}>
                                        <TextInput
                                            style={[emailStyles.input, { letterSpacing: 6, textAlign: 'center', fontSize: 18 }]}
                                            value={deleteOtpCode}
                                            onChangeText={(t) => setDeleteOtpCode(t.replace(/\D/g, '').slice(0, 6))}
                                            placeholder="000000"
                                            placeholderTextColor={colors.textMuted}
                                            keyboardType="numeric"
                                            maxLength={6}
                                            editable={!deletingAccount}
                                        />
                                    </View>
                                </View>
                            )}

                            {!deleteOtpSent ? (
                                <Button
                                    title={sendingDeleteOtp ? 'Sending code…' : 'Send 6-digit code to my email'}
                                    onPress={handleSendDeleteOtp}
                                    loading={sendingDeleteOtp}
                                    disabled={deletePhraseInput !== DELETE_PHRASE}
                                    fullWidth
                                    style={{ marginTop: spacing.sm, backgroundColor: colors.error }}
                                />
                            ) : (
                                <Button
                                    title={deletingAccount ? 'Deleting…' : 'Permanently delete my account'}
                                    onPress={handleConfirmDeleteAccount}
                                    loading={deletingAccount}
                                    disabled={deletePhraseInput !== DELETE_PHRASE || deleteOtpCode.length !== 6}
                                    fullWidth
                                    style={{ marginTop: spacing.sm, backgroundColor: colors.error }}
                                />
                            )}

                            <TouchableOpacity
                                style={emailStyles.modalCancel}
                                onPress={() => !deletingAccount && setDeleteModalVisible(false)}
                                disabled={deletingAccount}
                            >
                                <MerakiText style={emailStyles.modalCancelText}>Cancel</MerakiText>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Modal>
            
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
        backgroundColor: 'rgba(0, 0, 0, 0.03)',
        borderWidth: 1, borderColor: 'rgba(0, 0, 0, 0.06)',
        alignItems: 'center', justifyContent: 'center',
    },
    title: { color: colors.text },
    avatarSection: { alignItems: 'center', marginBottom: spacing.xl },
    personalAvatar: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: colors.surfaceLight,
    },
    cameraBadge: {
        position: 'absolute',
        bottom: 2,
        right: 2,
        backgroundColor: colors.accent,
        borderRadius: 16,
        width: 32,
        height: 32,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 3,
        borderColor: colors.background,
    },
    avatarHint: {
        fontSize: 12,
        color: colors.textMuted,
        marginTop: spacing.sm,
        marginBottom: spacing.md,
    },
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
        backgroundColor: 'rgba(0, 0, 0, 0.04)',
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
        borderColor: 'rgba(0, 0, 0, 0.04)',
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
        backgroundColor: 'rgba(0, 0, 0, 0.04)',
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
        backgroundColor: 'rgba(0, 0, 0, 0.04)',
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.04)',
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
        borderColor: 'rgba(0, 0, 0, 0.08)',
        overflow: 'hidden',
    },
    input: { padding: spacing.md, color: colors.text, fontSize: 16 },
    inputError: { borderColor: colors.error },
    textArea: { height: '100%', textAlignVertical: 'top' },
    errorText: { color: colors.error, fontSize: 12, marginTop: spacing.xs, marginLeft: 4 },
    hintText: { fontSize: 11, color: colors.textMuted, marginTop: spacing.xs, marginLeft: 4 },
    charCount: { fontSize: 11, color: colors.textMuted, textAlign: 'right', marginTop: 4 },
    readOnlyContainer: {
        backgroundColor: 'rgba(0, 0, 0, 0.02)',
        borderRadius: 16,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.04)',
    },
    readOnlyField: { color: colors.textSecondary, fontSize: 16 },

    // Selectors
    selectorCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: spacing.md,
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.08)',
    },
    selectorText: { fontSize: 16, color: colors.text, flex: 1 },
    selectorPlaceholder: { fontSize: 16, color: colors.textMuted, flex: 1 },
    selectorDisabled: { opacity: 0.5 },

    // Switches
    prefCard: {
        padding: spacing.md,
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.04)',
        marginTop: spacing.sm,
    },
    switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm },
    switchLabel: { flex: 1, marginRight: spacing.md },
    switchTitle: { color: colors.text, marginBottom: 2 },
    switchDescription: { fontSize: 12, color: colors.textMuted },
    divider: { height: 1, backgroundColor: 'rgba(0, 0, 0, 0.04)', marginVertical: spacing.sm },

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

    // Dropdown modals (kept similar for consistency)
    dropdownOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
    dropdownContent: { backgroundColor: colors.background, borderTopLeftRadius: 30, borderTopRightRadius: 30, maxHeight: '80%', borderWidth: 1, borderColor: 'rgba(0, 0, 0, 0.08)' },
    dropdownHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: 'rgba(0, 0, 0, 0.04)' },
    dropdownTitle: { fontSize: 20, fontWeight: '700', color: colors.text },
    dropdownClose: { fontSize: 20, color: colors.textMuted, padding: spacing.sm },
    dropdownList: { padding: spacing.md },
    dropdownItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.md, paddingHorizontal: spacing.md, borderRadius: 16, marginBottom: spacing.xs },
    dropdownItemSelected: { backgroundColor: 'rgba(200, 160, 77, 0.1)' },
    dropdownItemText: { fontSize: 16, color: colors.text, flex: 1 },
    dropdownItemTextSelected: { color: colors.primary, fontWeight: '700' },
    checkmark: { fontSize: 18, color: colors.primary, fontWeight: '800' },
    phoneCodeButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.02)',
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.06)',
        borderRadius: 12,
        paddingHorizontal: 16,
        height: 48,
        gap: 4,
    },
    phoneCodeButtonError: {
        borderColor: '#FCA5A5',
    },
    phoneCodeText: {
        fontSize: 14,
        color: colors.text,
        fontWeight: '500',
    },
});

// ─── Change Password Modal Styles ──────────────────────────────────
const cpStyles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.lg,
    },
    container: {
        width: '100%',
        maxWidth: 380,
        borderRadius: 20,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.5,
        shadowRadius: 24,
        elevation: 12,
    },
    gradientBorder: {
        padding: 1,
        borderRadius: 20,
    },
    innerCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 19,
        overflow: 'hidden',
    },
    header: {
        alignItems: 'center',
        paddingTop: spacing.xl,
        paddingHorizontal: spacing.xl,
        paddingBottom: spacing.md,
    },
    iconGlow: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: 'rgba(212, 168, 83, 0.12)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.md,
        borderWidth: 1,
        borderColor: 'rgba(212, 168, 83, 0.2)',
    },
    title: {
        color: colors.text,
        fontSize: 20,
        fontWeight: '700',
        textAlign: 'center',
        marginBottom: spacing.xs,
        letterSpacing: 0.3,
    },
    subtitle: {
        fontSize: 13,
        color: colors.textSecondary,
        textAlign: 'center',
        lineHeight: 18,
    },
    body: {
        paddingHorizontal: spacing.xl,
        maxHeight: 450,
    },
    fieldGroup: {
        marginBottom: spacing.md,
    },
    fieldLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: colors.textSecondary,
        marginBottom: spacing.xs,
        letterSpacing: 0.3,
        textTransform: 'uppercase',
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F5F5F5',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        overflow: 'hidden',
    },
    fieldInput: {
        flex: 1,
        paddingVertical: 13,
        paddingHorizontal: spacing.md,
        fontSize: 15,
        color: colors.text,
    },
    eyeBtn: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
    },
    hint: {
        fontSize: 11,
        color: colors.textMuted,
        marginTop: spacing.xs,
        marginLeft: 2,
    },
    dividerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: spacing.lg,
        gap: spacing.md,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.06)',
    },
    dividerText: {
        fontSize: 12,
        color: colors.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    forgotBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        paddingVertical: spacing.md,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: 'rgba(212, 168, 83, 0.25)',
        backgroundColor: 'rgba(212, 168, 83, 0.06)',
    },
    forgotBtnText: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.primary,
    },
    emailPreview: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.md,
        borderRadius: 10,
        backgroundColor: 'rgba(212, 168, 83, 0.06)',
        borderWidth: 1,
        borderColor: 'rgba(212, 168, 83, 0.15)',
        marginBottom: spacing.md,
    },
    emailText: {
        fontSize: 14,
        color: colors.text,
        fontWeight: '600',
    },
    infoText: {
        fontSize: 13,
        color: colors.textSecondary,
        lineHeight: 20,
        textAlign: 'center',
    },
    backLink: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.xs,
        marginTop: spacing.lg,
        paddingVertical: spacing.sm,
    },
    backLinkText: {
        fontSize: 13,
        color: colors.textSecondary,
    },
    closeBtn: {
        paddingVertical: spacing.md,
        alignItems: 'center',
        borderTopWidth: 1,
        borderTopColor: 'rgba(0, 0, 0, 0.05)',
        marginTop: spacing.md,
    },
    closeBtnText: {
        fontSize: 15,
        fontWeight: '600',
        color: colors.textSecondary,
    },
});

// ─── Email Change + Delete Account Modal Styles ────────────────────
const emailStyles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.lg,
    },
    modalCard: {
        width: '100%',
        maxWidth: 380,
        backgroundColor: colors.surface,
        borderRadius: 20,
        padding: spacing.lg,
        borderWidth: 1,
        borderColor: colors.border,
    },
    modalHeader: {
        alignItems: 'center',
        marginBottom: spacing.lg,
    },
    iconCircle: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: 'rgba(212, 168, 83, 0.15)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.md,
    },
    modalTitle: {
        color: colors.text,
        marginBottom: spacing.xs,
        textAlign: 'center',
    },
    modalSubtitle: {
        fontSize: 13,
        color: colors.textSecondary,
        textAlign: 'center',
        lineHeight: 18,
    },
    fieldGroup: {
        marginBottom: spacing.md,
    },
    fieldLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: colors.textSecondary,
        marginBottom: spacing.xs,
        letterSpacing: 0.3,
    },
    inputRow: {
        backgroundColor: 'rgba(0, 0, 0, 0.04)',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        paddingHorizontal: spacing.md,
    },
    input: {
        height: 48,
        fontSize: 15,
        color: colors.text,
    },
    readonlyRow: {
        backgroundColor: 'rgba(0, 0, 0, 0.06)',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
    },
    readonlyText: {
        fontSize: 15,
        color: colors.textSecondary,
    },
    modalCancel: {
        marginTop: spacing.md,
        paddingVertical: spacing.sm,
        alignItems: 'center',
    },
    modalCancelText: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.textSecondary,
    },
    changeEmailLink: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 8,
        alignSelf: 'flex-start',
    },
    changeEmailText: {
        fontSize: 13,
        fontWeight: '600',
        color: colors.primary,
    },
    dangerButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: spacing.md,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(239, 68, 68, 0.35)',
        backgroundColor: 'rgba(239, 68, 68, 0.04)',
        marginBottom: spacing.lg,
    },
    dangerButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.error,
        letterSpacing: 0.3,
    },
});

export default EditProfileScreen;
