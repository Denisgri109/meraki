import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    TouchableOpacity,
    Alert,
    ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Button, Input, ScreenBackground } from '../../components/ui';
import { colors, spacing } from '../../theme';
import {
    validateIrishPhone,
    formatIrishPhone,
    normalizeIrishPhone,
    validateEmail,
    validatePassword,
    validateFullName,
} from '../../utils/validation';

type AuthStackParamList = {
    Login: undefined;
    Register: undefined;
    VerifyOtp: { email: string };
    ForgotPassword: undefined;
    Terms: undefined;
};

type RegisterScreenProps = {
    navigation: NativeStackNavigationProp<AuthStackParamList, 'Register'>;
};

export function RegisterScreen({ navigation }: RegisterScreenProps) {
    const { signUp } = useAuth();
    const [fullName, setFullName] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [selectedRole, setSelectedRole] = useState<'client' | 'master'>('client');
    const [tosAccepted, setTosAccepted] = useState(false);
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState<{
        fullName?: string;
        phone?: string;
        email?: string;
        password?: string;
        confirmPassword?: string;
    }>({});

    const validate = () => {
        const newErrors: typeof errors = {};

        // Full name validation
        const nameValidation = validateFullName(fullName);
        if (!nameValidation.valid) newErrors.fullName = nameValidation.error;

        // Phone validation (optional but must be valid if provided)
        if (phone.trim()) {
            const phoneValidation = validateIrishPhone(phone);
            if (!phoneValidation.valid) newErrors.phone = phoneValidation.error;
        }

        // Email validation
        const emailValidation = validateEmail(email);
        if (!emailValidation.valid) newErrors.email = emailValidation.error;

        // Password validation
        const passwordValidation = validatePassword(password);
        if (!passwordValidation.valid) newErrors.password = passwordValidation.error;

        // Confirm password
        if (password !== confirmPassword) newErrors.confirmPassword = 'Passwords do not match';

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handlePhoneChange = (text: string) => {
        // Allow user to type freely, we'll format on blur
        setPhone(text);
        // Clear error when typing
        if (errors.phone) {
            setErrors({ ...errors, phone: undefined });
        }
    };

    const handlePhoneBlur = () => {
        // Format phone on blur if valid
        if (phone.trim()) {
            const validation = validateIrishPhone(phone);
            if (validation.valid) {
                setPhone(formatIrishPhone(phone));
            }
        }
    };

    const handleRegister = async () => {
        if (!validate()) return;

        if (!tosAccepted) {
            Alert.alert('Terms Required', 'Please accept the Terms of Service to continue.');
            return;
        }

        setLoading(true);
        try {
            console.log('=== REGISTRATION START ===');
            console.log('Selected role:', selectedRole);
            console.log('Email:', email.trim().toLowerCase());
            console.log('Full name:', fullName.trim());

            // Normalize phone for storage
            const normalizedPhone = phone.trim() ? normalizeIrishPhone(phone) : null;
            console.log('Phone:', normalizedPhone);

            // Use AuthContext signUp which handles role properly
            console.log('Calling AuthContext signUp with role:', selectedRole);
            const { error: signUpError } = await signUp(
                email.trim().toLowerCase(),
                password,
                fullName.trim(),
                selectedRole,
                tosAccepted,
                '1.0' // Current TOS version
            );

            if (signUpError) {
                console.error('SignUp error:', signUpError);
                throw signUpError;
            }

            console.log('SignUp successful!');

            // Now send OTP for email verification
            console.log('Sending OTP for email verification...');
            const { error: otpError } = await supabase.auth.resend({
                type: 'signup',
                email: email.trim().toLowerCase(),
            });

            if (otpError) {
                console.error('OTP send error:', otpError);
                // Don't throw - user can request resend later
                console.log('OTP send failed but continuing...');
            } else {
                console.log('OTP sent successfully!');
            }

            console.log('=== REGISTRATION COMPLETE ===');
            console.log('Role selected:', selectedRole);
            console.log('Navigating to VerifyOtp screen...');

            // Navigate to OTP verification screen
            navigation.navigate('VerifyOtp', { email: email.trim().toLowerCase() });

        } catch (error: any) {
            console.error('=== REGISTRATION ERROR ===', error);
            console.error('Error name:', error.name);
            console.error('Error code:', error.code);
            console.error('Error status:', error.status);

            let errorMessage = error.message || 'An error occurred during registration.';

            // Provide more helpful error messages
            if (error.message?.includes('Database error')) {
                errorMessage = 'Database error creating account. Please try again or contact support.';
            } else if (error.message?.includes('already registered') || error.message?.includes('already exists')) {
                errorMessage = 'This email is already registered. Please sign in instead.';
            } else if (error.message?.includes('password')) {
                errorMessage = 'Password is too weak. Please use at least 6 characters.';
            } else if (error.message?.includes('valid')) {
                errorMessage = 'Please check your email format and try again.';
            }

            Alert.alert('Registration Failed', errorMessage);
        } finally {
            setLoading(false);
        }
    };

    return (
        <ScreenBackground>
            <SafeAreaView style={styles.container}>
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
                            <Text style={styles.logo}>Merakí</Text>
                            <Text style={styles.title}>Create Account</Text>
                            <Text style={styles.subtitle}>
                                Choose your account type and get started
                            </Text>
                        </View>

                        {/* Account Type Selection */}
                        <View style={styles.roleSection}>
                            <Text style={styles.roleLabel}>I want to join as a:</Text>
                            <View style={styles.roleButtons}>
                                <TouchableOpacity
                                    style={[
                                        styles.roleButton,
                                        selectedRole === 'client' && styles.roleButtonActive
                                    ]}
                                    onPress={() => {
                                        console.log('Role changed to: client');
                                        setSelectedRole('client');
                                    }}
                                >
                                    <Text style={styles.roleIcon}>👤</Text>
                                    <Text style={[
                                        styles.roleButtonText,
                                        selectedRole === 'client' && styles.roleButtonTextActive
                                    ]}>
                                        Client
                                    </Text>
                                    <Text style={styles.roleDescription}>
                                        Book services, shop, learn
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[
                                        styles.roleButton,
                                        selectedRole === 'master' && styles.roleButtonActive
                                    ]}
                                    onPress={() => {
                                        console.log('Role changed to: master');
                                        setSelectedRole('master');
                                    }}
                                >
                                    <Text style={styles.roleIcon}>💇</Text>
                                    <Text style={[
                                        styles.roleButtonText,
                                        selectedRole === 'master' && styles.roleButtonTextActive
                                    ]}>
                                        Master
                                    </Text>
                                    <Text style={styles.roleDescription}>
                                        Provide services, manage bookings
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Form */}
                        <View style={styles.form}>
                            <Input
                                label="Full Name"
                                value={fullName}
                                onChangeText={setFullName}
                                autoCapitalize="words"
                                placeholder="Your full name"
                                error={errors.fullName}
                            />

                            <View>
                                <Input
                                    label="Phone Number (Ireland)"
                                    value={phone}
                                    onChangeText={handlePhoneChange}
                                    onBlur={handlePhoneBlur}
                                    keyboardType="phone-pad"
                                    placeholder="+353 87 123 4567"
                                    error={errors.phone}
                                />
                                <Text style={styles.phoneHint}>
                                    Enter your Irish mobile number (e.g., 087 123 4567)
                                </Text>
                            </View>

                            <Input
                                label="Email"
                                value={email}
                                onChangeText={setEmail}
                                keyboardType="email-address"
                                autoCapitalize="none"
                                autoComplete="email"
                                placeholder="your@email.com"
                                error={errors.email}
                            />

                            <Input
                                label="Password"
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry
                                autoCapitalize="none"
                                placeholder="••••••••"
                                error={errors.password}
                            />

                            <Input
                                label="Confirm Password"
                                value={confirmPassword}
                                onChangeText={setConfirmPassword}
                                secureTextEntry
                                autoCapitalize="none"
                                placeholder="••••••••"
                                error={errors.confirmPassword}
                            />

                            <Button
                                title="Create Account"
                                onPress={handleRegister}
                                loading={loading}
                                fullWidth
                                style={styles.button}
                            />
                        </View>

                        {/* Terms */}
                        {/* Terms */}
                        <View style={styles.termsContainer}>
                            <TouchableOpacity
                                style={[styles.checkbox, tosAccepted && styles.checkboxChecked]}
                                onPress={() => setTosAccepted(!tosAccepted)}
                            >
                                {tosAccepted && <Ionicons name="checkmark" size={16} color="white" />}
                            </TouchableOpacity>
                            <Text style={styles.termsText} onPress={() => setTosAccepted(!tosAccepted)}>
                                I agree to the{' '}
                                <Text style={styles.termsLink} onPress={() => navigation.navigate('Terms')}>
                                    Terms of Service
                                </Text>
                                {' '}and{' '}
                                <Text style={styles.termsLink} onPress={() => navigation.navigate('Terms')}>
                                    Privacy Policy
                                </Text>
                            </Text>
                        </View>

                        {/* Login Link */}
                        <View style={styles.footer}>
                            <Text style={styles.footerText}>Already have an account? </Text>
                            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                                <Text style={styles.linkText}>Sign In</Text>
                            </TouchableOpacity>
                        </View>
                    </ScrollView>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </ScreenBackground>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    keyboardView: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.xl,
    },
    header: {
        alignItems: 'center',
        marginBottom: spacing.xl,
    },
    logo: {
        fontSize: 42,
        fontWeight: '300',
        color: colors.text,
        letterSpacing: 6,
        marginBottom: spacing.lg,
        fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'sans-serif-light',
        textShadowColor: colors.primary,
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 10,
    },
    title: {
        fontSize: 28,
        fontWeight: '600',
        color: colors.text,
        letterSpacing: 0.5,
    },
    subtitle: {
        fontSize: 14,
        color: colors.textSecondary,
        marginTop: spacing.sm,
        textAlign: 'center',
    },
    roleSection: {
        marginBottom: spacing.lg,
    },
    roleLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.text,
        marginBottom: spacing.md,
    },
    roleButtons: {
        flexDirection: 'row',
        gap: spacing.md,
    },
    roleButton: {
        flex: 1,
        backgroundColor: colors.surface,
        borderWidth: 2,
        borderColor: colors.border,
        borderRadius: 16,
        padding: spacing.md,
        alignItems: 'center',
    },
    roleButtonActive: {
        borderColor: colors.primary,
        backgroundColor: 'rgba(139,92,246,0.1)',
    },
    roleIcon: {
        fontSize: 32,
        marginBottom: spacing.sm,
    },
    roleButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.text,
        marginBottom: spacing.xs,
    },
    roleButtonTextActive: {
        color: colors.primary,
    },
    roleDescription: {
        fontSize: 12,
        color: colors.textSecondary,
        textAlign: 'center',
    },
    form: {
        marginBottom: spacing.lg,
    },
    button: {
        marginTop: spacing.md,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    termsLink: {
        color: colors.primary,
        textDecorationLine: 'underline',
    },
    termsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.xl,
        paddingHorizontal: spacing.sm,
    },
    checkbox: {
        width: 24,
        height: 24,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: colors.border,
        marginRight: spacing.md,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.surface,
    },
    checkboxChecked: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    termsText: {
        fontSize: 14,
        color: colors.textSecondary,
        flex: 1,
        lineHeight: 20,
    },
    phoneHint: {
        fontSize: 12,
        color: colors.textMuted,
        marginTop: -spacing.sm,
        marginBottom: spacing.md,
        marginLeft: spacing.xs,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
    },
    footerText: {
        color: colors.textSecondary,
        fontSize: 14,
    },
    linkText: {
        color: colors.primary,
        fontSize: 14,
        fontWeight: '600',
    },
});

export default RegisterScreen;
