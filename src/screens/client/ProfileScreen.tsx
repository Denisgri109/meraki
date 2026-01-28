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
    Share,
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
import { validateIrishPhone, formatIrishPhone, normalizeIrishPhone } from '../../utils/validation';

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
    const [editName, setEditName] = useState(profile?.full_name || '');
    const [editPhone, setEditPhone] = useState(profile?.phone || '');
    const [phoneError, setPhoneError] = useState<string | undefined>(undefined);
    const [saving, setSaving] = useState(false);
    const [uploadingPhoto, setUploadingPhoto] = useState(false);

    const handleSaveProfile = async () => {
        // Validate phone if provided
        if (editPhone.trim()) {
            const phoneValidation = validateIrishPhone(editPhone);
            if (!phoneValidation.valid) {
                setPhoneError(phoneValidation.error);
                return;
            }
        }
        setPhoneError(undefined);

        setSaving(true);
        try {
            const normalizedPhone = editPhone.trim() ? normalizeIrishPhone(editPhone) : null;

            const { error } = await supabase
                .from('profiles')
                .update({
                    full_name: editName,
                    phone: normalizedPhone,
                })
                .eq('id', profile?.id || '');

            if (error) throw error;

            await refreshProfile?.();
            setEditModalVisible(false);
            Alert.alert('Success', 'Profile updated successfully');
        } catch (error: any) {
            Alert.alert('Error', error.message);
        } finally {
            setSaving(false);
        }
    };

    const handlePhoneChange = (text: string) => {
        setEditPhone(text);
        if (phoneError) setPhoneError(undefined);
    };

    const handlePhoneBlur = () => {
        if (editPhone.trim()) {
            const validation = validateIrishPhone(editPhone);
            if (validation.valid) {
                setEditPhone(formatIrishPhone(editPhone));
            }
        }
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

    const handleShare = async () => {
        try {
            await Share.share({
                message: 'Check out Merakí! The best app for beauty and wellness booking.',
            });
        } catch (error: any) {
            Alert.alert('Error', error.message);
        }
    };

    const menuItems = [
        {
            icon: '👤', label: 'Edit Profile', action: () => {
                setEditName(profile?.full_name || '');
                setEditPhone(profile?.phone || '');
                setEditModalVisible(true);
            }
        },
        { icon: '🔔', label: 'Notifications', action: () => navigation.navigate('Notifications') },
        { icon: '💳', label: 'Payment Methods', action: () => navigation.navigate('PaymentMethods') },
        { icon: '🎁', label: 'Invite Friends', action: handleShare },
        // Only show Loyalty Points and Help for clients
        ...(profile?.role === 'client' ? [
            { icon: '⭐', label: 'Loyalty Points', action: () => navigation.navigate('LoyaltyPoints') },
            { icon: '❓', label: 'Help & Support', action: () => navigation.navigate('HelpSupport') },
        ] : []),
        { icon: '📜', label: 'Terms of Service', action: () => navigation.navigate('TermsOfService') },
        { icon: '🔒', label: 'Privacy Policy', action: () => navigation.navigate('PrivacyPolicy') },
    ];

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

                            <View style={styles.modalContent}>
                                <View style={styles.inputGroup}>
                                    <Text style={styles.inputLabel}>Full Name</Text>
                                    <TextInput
                                        style={styles.input}
                                        value={editName}
                                        onChangeText={setEditName}
                                        placeholder="Enter your name"
                                        placeholderTextColor={colors.textMuted}
                                    />
                                </View>

                                <View style={styles.inputGroup}>
                                    <Text style={styles.inputLabel}>Phone Number (Ireland)</Text>
                                    <TextInput
                                        style={[styles.input, phoneError && styles.inputError]}
                                        value={editPhone}
                                        onChangeText={handlePhoneChange}
                                        onBlur={handlePhoneBlur}
                                        placeholder="+353 87 123 4567"
                                        placeholderTextColor={colors.textMuted}
                                        keyboardType="phone-pad"
                                    />
                                    {phoneError && <Text style={styles.errorText}>{phoneError}</Text>}
                                    <Text style={styles.phoneHint}>Enter your Irish mobile number</Text>
                                </View>

                                <Button
                                    title={saving ? 'Saving...' : 'Save Changes'}
                                    onPress={handleSaveProfile}
                                    loading={saving}
                                    fullWidth
                                />
                            </View>
                        </ScreenBackground>
                    </SafeAreaView>
                </Modal>
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
    modalContent: { padding: spacing.lg },
    inputGroup: { marginBottom: spacing.lg },
    inputLabel: { fontSize: 14, fontWeight: '500', color: colors.text, marginBottom: spacing.sm },
    input: { backgroundColor: colors.surface, borderRadius: 12, padding: spacing.md, color: colors.text, fontSize: 16, borderWidth: 1, borderColor: colors.border },
    inputError: { borderColor: colors.error },
    errorText: { color: colors.error, fontSize: 12, marginTop: spacing.xs },
    phoneHint: { fontSize: 11, color: colors.textMuted, marginTop: spacing.xs },
    // Avatar image styles
    avatarImage: { width: 100, height: 100, borderRadius: 50, marginBottom: spacing.md, borderWidth: 2, borderColor: colors.primary },
    cameraIcon: { position: 'absolute', bottom: spacing.sm, right: 0, backgroundColor: colors.primary, borderRadius: 14, width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
    cameraIconText: { fontSize: 14 },
});

export default ProfileScreen;
