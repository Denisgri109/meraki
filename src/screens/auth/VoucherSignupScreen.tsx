import React, { useState } from 'react';
import {
    View,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    TouchableOpacity,
    ScrollView,
    Dimensions,
    ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../contexts/AuthContext';
import { useModal } from '../../contexts/ModalContext';
import { supabase } from '../../lib/supabase';
import { Button, Input, MerakiText } from '../../components/ui';
import { colors, spacing } from '../../theme';
import { StatusBar } from 'expo-status-bar';
import { validateEmail, validatePassword } from '../../utils/validation';

type AuthStackParamList = {
    Login: undefined;
    Register: undefined;
    VerifyOtp: { email: string };
    ForgotPassword: undefined;
    Terms: undefined;
    VoucherSignup: undefined;
};

type VoucherSignupScreenProps = {
    navigation: NativeStackNavigationProp<AuthStackParamList, 'VoucherSignup'>;
};

const { width } = Dimensions.get('window');

export function VoucherSignupScreen({ navigation }: VoucherSignupScreenProps) {
    const { signUp } = useAuth();
    const { showAlert, showModal, hideModal } = useModal();
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [voucherCode, setVoucherCode] = useState('');
    const [tosAccepted, setTosAccepted] = useState(false);
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [errors, setErrors] = useState<{
        fullName?: string;
        email?: string;
        password?: string;
        voucherCode?: string;
    }>({});

    const validate = () => {
        const newErrors: typeof errors = {};
        if (!fullName.trim()) newErrors.fullName = 'Full name is required';
        
        const emailValidation = validateEmail(email);
        if (!emailValidation.valid) newErrors.email = emailValidation.error;
        
        const passwordValidation = validatePassword(password);
        if (!passwordValidation.valid) newErrors.password = passwordValidation.error;
        
        if (!voucherCode.trim()) newErrors.voucherCode = 'Voucher code is required';
        
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleRegisterAndClaim = async () => {
        if (!validate()) return;
        if (!tosAccepted) {
            showAlert('Terms Required', 'Please accept the Terms of Service to continue.', 'warning');
            return;
        }

        setLoading(true);
        try {
            // 1. Sign up the user using standard AuthContext signUp
            const { error: signUpError } = await signUp(
                email.trim().toLowerCase(),
                password,
                fullName.trim(),
                'client',
                tosAccepted,
                '1.0'
            );

            if (signUpError) throw signUpError;

            // 2. Get the newly registered user's ID
            const { data: { user: newUser }, error: userError } = await supabase.auth.getUser();
            
            let claimSuccess = false;
            let expiryDate = '';
            
            if (newUser) {
                console.log('User signed up successfully. Attempting to claim voucher...', newUser.id);
                try {
                    const { data: claimData, error: claimError } = await supabase.functions.invoke('claim-voucher', {
                        body: {
                            code: voucherCode.trim().toUpperCase(),
                            userId: newUser.id
                        }
                    });

                    if (claimError) throw claimError;
                    if (claimData?.error) throw new Error(claimData.error);
                    
                    claimSuccess = true;
                    expiryDate = claimData?.expires_at || '';
                } catch (voucherErr: any) {
                    console.error('Voucher claiming failed:', voucherErr);
                    showAlert(
                        'Voucher Claim Failed',
                        `Your account was created, but we couldn't claim the voucher: ${voucherErr.message || 'Invalid or expired code.'}`,
                        'warning'
                    );
                }
            } else {
                console.log('No user returned directly. Check if email confirmation is enabled.');
            }

            // Resend OTP so they verify their email
            await supabase.auth.resend({
                type: 'signup',
                email: email.trim().toLowerCase(),
            });

            if (claimSuccess) {
                const formattedDate = expiryDate ? new Date(expiryDate).toLocaleDateString() : '7 days';
                showModal({
                    title: '🎁 Account Created & Voucher Claimed!',
                    message: `Welcome to Merakí, ${fullName}!\n\nYour promo code "${voucherCode.toUpperCase()}" has been successfully linked to your account.\n\nIt expires on ${formattedDate}.\n\nPlease verify your email to log in and use it!`,
                    confirmText: 'Verify Email',
                    hideCancel: true,
                    onConfirm: () => {
                        hideModal();
                        navigation.navigate('VerifyOtp', { email: email.trim().toLowerCase() });
                    }
                });
            } else {
                navigation.navigate('VerifyOtp', { email: email.trim().toLowerCase() });
            }
        } catch (error: any) {
            console.error('Signup error:', error);
            showAlert('Registration Failed', error.message || 'An error occurred during registration.', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <StatusBar style="dark" />
            <SafeAreaView style={styles.safeArea}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.keyboardView}
                >
                    <ScrollView
                        contentContainerStyle={styles.scrollContent}
                        showsVerticalScrollIndicator={false}
                    >
                        {/* Header */}
                        <View style={styles.header}>
                            <TouchableOpacity
                                style={styles.backButton}
                                onPress={() => navigation.goBack()}
                            >
                                <MaterialIcons name="arrow-back-ios-new" size={20} color={colors.primary} />
                            </TouchableOpacity>
                            <View style={styles.headerTexts}>
                                <MerakiText variant="h2" style={styles.title}>Wheel Spin Signup</MerakiText>
                                <MerakiText style={styles.subtitle}>Claim your won voucher and sign up</MerakiText>
                            </View>
                        </View>

                        {/* Form */}
                        <View style={styles.form}>
                            <Input
                                label="Full Name"
                                placeholder="Enter your full name"
                                value={fullName}
                                onChangeText={setFullName}
                                error={errors.fullName}
                                autoCapitalize="words"
                            />

                            <Input
                                label="Email Address"
                                placeholder="name@example.com"
                                value={email}
                                onChangeText={setEmail}
                                error={errors.email}
                                keyboardType="email-address"
                                autoCapitalize="none"
                                autoCorrect={false}
                            />

                            <Input
                                label="Password"
                                placeholder="Create a password"
                                value={password}
                                onChangeText={setPassword}
                                error={errors.password}
                                secureTextEntry={!showPassword}
                                autoCapitalize="none"
                                autoCorrect={false}
                                rightIcon={
                                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                                        <MaterialIcons
                                            name={showPassword ? 'visibility-off' : 'visibility'}
                                            size={20}
                                            color={colors.textSecondary}
                                        />
                                    </TouchableOpacity>
                                }
                            />

                            <View style={styles.voucherContainer}>
                                <Input
                                    label="Voucher Code"
                                    placeholder="Enter won promo code (e.g. SPIN-10)"
                                    value={voucherCode}
                                    onChangeText={(text) => setVoucherCode(text.toUpperCase())}
                                    error={errors.voucherCode}
                                    autoCapitalize="characters"
                                    autoCorrect={false}
                                    leftIcon={
                                        <MaterialIcons name="card-giftcard" size={20} color={colors.brandPink} />
                                    }
                                />
                                <View style={styles.voucherTip}>
                                    <MerakiText style={styles.voucherTipText}>
                                        🎁 Enter the voucher code you won from the wheel. It will automatically apply 7-day validity upon registration.
                                    </MerakiText>
                                </View>
                            </View>

                            {/* Terms of Service Acceptance */}
                            <TouchableOpacity
                                style={styles.tosContainer}
                                onPress={() => setTosAccepted(!tosAccepted)}
                                activeOpacity={0.8}
                            >
                                <View style={[styles.checkbox, tosAccepted && styles.checkboxActive]}>
                                    {tosAccepted && (
                                        <MaterialIcons name="check" size={14} color={colors.textInvert} />
                                    )}
                                </View>
                                <View style={styles.tosTextContainer}>
                                    <MerakiText style={styles.tosText}>
                                        I agree to the{' '}
                                        <MerakiText style={styles.tosLink} onPress={() => navigation.navigate('Terms' as any)}>
                                            Terms of Service
                                        </MerakiText>{' '}
                                        and{' '}
                                        <MerakiText style={styles.tosLink} onPress={() => navigation.navigate('PrivacyPolicy' as any)}>
                                            Privacy Policy
                                        </MerakiText>
                                    </MerakiText>
                                </View>
                            </TouchableOpacity>

                            <Button
                                title="Sign Up & Claim"
                                variant="primary"
                                loading={loading}
                                onPress={handleRegisterAndClaim}
                                fullWidth
                                style={styles.submitBtn}
                            />

                            {/* Switch to normal register / login */}
                            <View style={styles.footerLinks}>
                                <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                                    <MerakiText style={styles.footerLinkText}>
                                        Already have an account? <MerakiText style={styles.footerLinkHighlight}>Sign In</MerakiText>
                                    </MerakiText>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </ScrollView>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    safeArea: {
        flex: 1,
    },
    keyboardView: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.xl,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: spacing.md,
        marginBottom: spacing.xl,
    },
    backButton: {
        padding: spacing.sm,
        marginRight: spacing.sm,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 12,
    },
    headerTexts: {
        flex: 1,
    },
    title: {
        fontWeight: '700',
        color: colors.textPrimary,
    },
    subtitle: {
        fontSize: 14,
        color: colors.textSecondary,
        marginTop: 2,
    },
    form: {
        gap: spacing.md,
    },
    voucherContainer: {
        marginTop: spacing.xs,
    },
    voucherTip: {
        backgroundColor: colors.brandPinkLight || '#FFF5F5',
        padding: spacing.md,
        borderRadius: 12,
        marginTop: spacing.xs,
        borderWidth: 1,
        borderColor: colors.borderGold || 'rgba(232, 160, 180, 0.2)',
    },
    voucherTipText: {
        fontSize: 12,
        color: colors.textGold || '#C47A90',
        lineHeight: 18,
    },
    tosContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: spacing.sm,
    },
    checkbox: {
        width: 20,
        height: 20,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: colors.brandPink,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.sm,
    },
    checkboxActive: {
        backgroundColor: colors.brandPink,
    },
    tosTextContainer: {
        flex: 1,
    },
    tosText: {
        fontSize: 13,
        color: colors.textSecondary,
    },
    tosLink: {
        color: colors.brandPink,
        textDecorationLine: 'underline',
    },
    submitBtn: {
        marginTop: spacing.sm,
    },
    footerLinks: {
        alignItems: 'center',
        marginTop: spacing.md,
    },
    footerLinkText: {
        fontSize: 14,
        color: colors.textSecondary,
    },
    footerLinkHighlight: {
        color: colors.brandPink,
        fontWeight: '600',
    },
});
