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
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
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
};

type RegisterScreenProps = {
    navigation: NativeStackNavigationProp<AuthStackParamList, 'Register'>;
};

export function RegisterScreen({ navigation }: RegisterScreenProps) {
    const [fullName, setFullName] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
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

        setLoading(true);
        try {
            // Normalize phone for storage
            const normalizedPhone = phone.trim() ? normalizeIrishPhone(phone) : null;

            // Sign up with Supabase - this will send an OTP email
            const { data, error } = await supabase.auth.signUp({
                email: email.trim().toLowerCase(),
                password,
                options: {
                    data: {
                        full_name: fullName.trim(),
                        phone: normalizedPhone,
                    },
                },
            });

            if (error) throw error;

            // Update profile with phone if provided
            if (data.user && normalizedPhone) {
                await supabase
                    .from('profiles')
                    .update({
                        phone: normalizedPhone,
                        full_name: fullName.trim(),
                    })
                    .eq('id', data.user.id);
            }

            // Navigate to OTP verification screen
            navigation.navigate('VerifyOtp', { email: email.trim().toLowerCase() });

        } catch (error: any) {
            console.error('Registration error:', error);
            Alert.alert('Registration Failed', error.message || 'An error occurred during registration.');
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
                                Join us and discover the best beauty services
                            </Text>
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
                        <Text style={styles.terms}>
                            By creating an account, you agree to our{' '}
                            <Text style={styles.termsLink}>Terms of Service</Text>
                            {' '}and{' '}
                            <Text style={styles.termsLink}>Privacy Policy</Text>
                        </Text>

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
    terms: {
        fontSize: 12,
        color: colors.textMuted,
        textAlign: 'center',
        marginBottom: spacing.xl,
        lineHeight: 18,
    },
    termsLink: {
        color: colors.primary,
        textDecorationLine: 'underline',
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
