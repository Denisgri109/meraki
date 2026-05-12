/**
 * MasterInviteScreen — Owner invites a new beauty master to the platform.
 * 
 * Creates a pending_masters record with the invitee's details.
 */
import React, { useState } from 'react';
import {
    View,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ScreenBackground, Card, MerakiText, Input, Button } from '../../../components/ui';
import { colors, spacing, layout } from '../../../theme';
import { inviteMaster } from '../../../services/masterManagementService';
import { useAuth } from '../../../contexts/AuthContext';
import { useModal } from '../../../contexts/ModalContext';

export function MasterInviteScreen() {
    const navigation = useNavigation<any>();
    const { user } = useAuth();
    const { showAlert } = useModal();

    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [bio, setBio] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const handleInvite = async () => {
        if (!fullName.trim() || !email.trim()) {
            showAlert('Required Fields', 'Please enter at least a name and email address.', 'info');
            return;
        }
        if (!user) return;

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.trim())) {
            showAlert('Invalid Email', 'Please enter a valid email address.', 'error');
            return;
        }

        setSubmitting(true);
        const { data, error } = await inviteMaster(
            {
                full_name: fullName.trim(),
                email: email.trim().toLowerCase(),
                phone: phone.trim() || undefined,
                bio: bio.trim() || undefined,
            },
            user.id
        );
        setSubmitting(false);

        if (error) {
            showAlert('Error', error.message || 'Failed to send invitation', 'error');
        } else {
            showAlert(
                'Invitation Sent!',
                `${fullName.trim()} has been invited to join Merakí as a beauty master.`,
                'success'
            );
            navigation.goBack();
        }
    };

    return (
        <ScreenBackground>
            <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <MaterialIcons name="arrow-back" size={22} color={colors.text} />
                    </TouchableOpacity>
                    <MerakiText variant="h3" style={styles.headerTitle}>Invite Master</MerakiText>
                    <View style={{ width: 40 }} />
                </View>

                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    style={{ flex: 1 }}
                >
                    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                        {/* Hero */}
                        <View style={styles.hero}>
                            <LinearGradient
                                colors={['rgba(212,168,83,0.15)', 'rgba(212,168,83,0.03)']}
                                style={styles.heroIcon}
                            >
                                <MaterialIcons name="person-add" size={36} color={colors.accent} />
                            </LinearGradient>
                            <MerakiText variant="body" color={colors.textSecondary} style={styles.heroText}>
                                Invite a beauty professional to join your platform. They'll receive an invitation to create their account.
                            </MerakiText>
                        </View>

                        {/* Form */}
                        <Card variant="glass" style={styles.formCard}>
                            <MerakiText variant="label" color={colors.textMuted} style={styles.sectionTitle}>
                                PERSONAL DETAILS
                            </MerakiText>
                            <Input
                                placeholder="Full Name *"
                                value={fullName}
                                onChangeText={setFullName}
                                autoCapitalize="words"
                            />
                            <Input
                                placeholder="Email Address *"
                                value={email}
                                onChangeText={setEmail}
                                keyboardType="email-address"
                                autoCapitalize="none"
                            />
                            <Input
                                placeholder="Phone Number (optional)"
                                value={phone}
                                onChangeText={setPhone}
                                keyboardType="phone-pad"
                            />
                        </Card>

                        <Card variant="glass" style={styles.formCard}>
                            <MerakiText variant="label" color={colors.textMuted} style={styles.sectionTitle}>
                                PROFESSIONAL DETAILS
                            </MerakiText>
                            <Input
                                placeholder="Bio / About (optional)"
                                value={bio}
                                onChangeText={setBio}
                                multiline
                                numberOfLines={3}
                            />
                        </Card>

                        {/* Submit */}
                        <TouchableOpacity
                            style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
                            onPress={handleInvite}
                            disabled={submitting}
                        >
                            <LinearGradient
                                colors={['#E8A0B4', '#C47A90']}
                                style={styles.submitBtnGradient}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                            >
                                {submitting ? (
                                    <MerakiText variant="bodyBold" color="#FFF">Sending Invitation...</MerakiText>
                                ) : (
                                    <>
                                        <MaterialIcons name="send" size={18} color="#FFF" />
                                        <MerakiText variant="bodyBold" color="#FFF" style={{ marginLeft: 8 }}>
                                            Send Invitation
                                        </MerakiText>
                                    </>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>
                    </ScrollView>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </ScreenBackground>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
    },
    backBtn: {
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: 'rgba(0, 0, 0, 0.03)',
        borderWidth: 1, borderColor: 'rgba(0, 0, 0, 0.06)',
        alignItems: 'center', justifyContent: 'center',
    },
    headerTitle: { flex: 1, marginLeft: spacing.md },
    scrollContent: { paddingHorizontal: spacing.lg, paddingBottom: 100 },

    hero: { alignItems: 'center', marginBottom: spacing.xl },
    heroIcon: {
        width: 72, height: 72, borderRadius: 36,
        alignItems: 'center', justifyContent: 'center',
        marginBottom: spacing.md,
    },
    heroText: { textAlign: 'center', lineHeight: 22 },

    formCard: { padding: spacing.lg, marginBottom: spacing.md },
    sectionTitle: { marginBottom: spacing.md, fontSize: 11, letterSpacing: 1 },

    submitBtn: { borderRadius: layout.borderRadius.lg, overflow: 'hidden', marginTop: spacing.md },
    submitBtnDisabled: { opacity: 0.6 },
    submitBtnGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        paddingHorizontal: spacing.lg,
    },
});

export default MasterInviteScreen;
