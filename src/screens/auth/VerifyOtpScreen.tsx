import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    Alert,
    KeyboardAvoidingView,
    Platform,
    TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { Button, ScreenBackground } from '../../components/ui';
import { colors, spacing } from '../../theme';

type AuthStackParamList = {
    Login: undefined;
    Register: undefined;
    VerifyOtp: { email: string };
    ForgotPassword: undefined;
};

type VerifyOtpScreenProps = {
    navigation: NativeStackNavigationProp<AuthStackParamList, 'VerifyOtp'>;
    route: RouteProp<AuthStackParamList, 'VerifyOtp'>;
};

const OTP_LENGTH = 6;

export function VerifyOtpScreen({ navigation, route }: VerifyOtpScreenProps) {
    const { email } = route.params;
    const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
    const [loading, setLoading] = useState(false);
    const [resending, setResending] = useState(false);
    const [countdown, setCountdown] = useState(0);
    const inputRefs = useRef<(TextInput | null)[]>([]);

    useEffect(() => {
        // Focus first input on mount
        inputRefs.current[0]?.focus();
    }, []);

    useEffect(() => {
        // Countdown timer for resend
        if (countdown > 0) {
            const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [countdown]);

    const handleOtpChange = (value: string, index: number) => {
        // Only allow digits
        const digit = value.replace(/\D/g, '').slice(-1);

        const newOtp = [...otp];
        newOtp[index] = digit;
        setOtp(newOtp);

        // Auto-focus next input
        if (digit && index < OTP_LENGTH - 1) {
            inputRefs.current[index + 1]?.focus();
        }

        // Auto-submit when all digits entered
        if (digit && index === OTP_LENGTH - 1) {
            const fullOtp = newOtp.join('');
            if (fullOtp.length === OTP_LENGTH) {
                handleVerify(fullOtp);
            }
        }
    };

    const handleKeyPress = (e: any, index: number) => {
        if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
            // Move to previous input on backspace if current is empty
            inputRefs.current[index - 1]?.focus();
        }
    };

    const handleVerify = async (otpCode?: string) => {
        const code = otpCode || otp.join('');

        if (code.length !== OTP_LENGTH) {
            Alert.alert('Error', 'Please enter the complete verification code');
            return;
        }

        setLoading(true);
        try {
            const { error } = await supabase.auth.verifyOtp({
                email,
                token: code,
                type: 'email',
            });

            if (error) throw error;

            // OTP verified successfully - user will be auto-logged in
            // The AuthContext will handle the session change
            Alert.alert(
                'Success!',
                'Your email has been verified. Welcome to Merakí!',
                [{ text: 'OK' }]
            );
        } catch (error: any) {
            console.error('OTP verification error:', error);
            Alert.alert('Verification Failed', error.message || 'Invalid or expired code. Please try again.');
            // Clear OTP inputs
            setOtp(Array(OTP_LENGTH).fill(''));
            inputRefs.current[0]?.focus();
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async () => {
        if (countdown > 0) return;

        setResending(true);
        try {
            const { error } = await supabase.auth.resend({
                type: 'signup',
                email,
            });

            if (error) throw error;

            Alert.alert('Code Sent', 'A new verification code has been sent to your email.');
            setCountdown(60); // 60 second cooldown
        } catch (error: any) {
            console.error('Resend error:', error);
            Alert.alert('Error', error.message || 'Failed to resend code. Please try again.');
        } finally {
            setResending(false);
        }
    };

    return (
        <ScreenBackground>
            <SafeAreaView style={styles.container}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.keyboardView}
                >
                    <View style={styles.content}>
                        {/* Header */}
                        <View style={styles.header}>
                            <Text style={styles.logo}>Merakí</Text>
                            <Text style={styles.title}>Verify Your Email</Text>
                            <Text style={styles.subtitle}>
                                We've sent a {OTP_LENGTH}-digit code to
                            </Text>
                            <Text style={styles.email}>{email}</Text>
                        </View>

                        {/* OTP Input Boxes */}
                        <View style={styles.otpContainer}>
                            {otp.map((digit, index) => (
                                <TextInput
                                    key={index}
                                    ref={(ref) => { inputRefs.current[index] = ref; }}
                                    style={[
                                        styles.otpInput,
                                        digit ? styles.otpInputFilled : null,
                                    ]}
                                    value={digit}
                                    onChangeText={(value) => handleOtpChange(value, index)}
                                    onKeyPress={(e) => handleKeyPress(e, index)}
                                    keyboardType="number-pad"
                                    maxLength={1}
                                    selectTextOnFocus
                                    caretHidden
                                />
                            ))}
                        </View>

                        {/* Verify Button */}
                        <Button
                            title="Verify Email"
                            onPress={() => handleVerify()}
                            loading={loading}
                            fullWidth
                            style={styles.button}
                        />

                        {/* Resend Code */}
                        <View style={styles.resendContainer}>
                            <Text style={styles.resendText}>Didn't receive the code? </Text>
                            {countdown > 0 ? (
                                <Text style={styles.countdownText}>
                                    Resend in {countdown}s
                                </Text>
                            ) : (
                                <TouchableOpacity onPress={handleResend} disabled={resending}>
                                    <Text style={styles.resendLink}>
                                        {resending ? 'Sending...' : 'Resend Code'}
                                    </Text>
                                </TouchableOpacity>
                            )}
                        </View>

                        {/* Back to Login */}
                        <TouchableOpacity
                            style={styles.backButton}
                            onPress={() => navigation.navigate('Login')}
                        >
                            <Text style={styles.backText}>← Back to Login</Text>
                        </TouchableOpacity>
                    </View>
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
    content: {
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: spacing.lg,
    },
    header: {
        alignItems: 'center',
        marginBottom: spacing.xxl,
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
        marginBottom: spacing.sm,
    },
    subtitle: {
        fontSize: 14,
        color: colors.textSecondary,
        textAlign: 'center',
    },
    email: {
        fontSize: 14,
        color: colors.primary,
        fontWeight: '600',
        marginTop: spacing.xs,
    },
    otpContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: spacing.sm,
        marginBottom: spacing.xl,
    },
    otpInput: {
        width: 48,
        height: 56,
        borderRadius: 12,
        backgroundColor: colors.surface,
        borderWidth: 2,
        borderColor: colors.border,
        fontSize: 24,
        fontWeight: '600',
        color: colors.text,
        textAlign: 'center',
    },
    otpInputFilled: {
        borderColor: colors.primary,
        backgroundColor: 'rgba(139, 92, 246, 0.1)',
    },
    button: {
        marginBottom: spacing.lg,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    resendContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.xl,
    },
    resendText: {
        fontSize: 14,
        color: colors.textSecondary,
    },
    resendLink: {
        fontSize: 14,
        color: colors.primary,
        fontWeight: '600',
    },
    countdownText: {
        fontSize: 14,
        color: colors.textMuted,
    },
    backButton: {
        alignItems: 'center',
    },
    backText: {
        fontSize: 14,
        color: colors.textSecondary,
    },
});

export default VerifyOtpScreen;
