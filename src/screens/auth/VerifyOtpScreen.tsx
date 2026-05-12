import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    StyleSheet,
    TextInput,
    KeyboardAvoidingView,
    Platform,
    TouchableOpacity,
    Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { useModal } from '../../contexts/ModalContext';
import { Button, MerakiText } from '../../components/ui';
import { colors, spacing } from '../../theme';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';

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
const { width } = Dimensions.get('window');

export function VerifyOtpScreen({ navigation, route }: VerifyOtpScreenProps) {
    const { email } = route.params;
    const { showAlert } = useModal();
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
            showAlert('Error', 'Please enter the complete verification code', 'error');
            return;
        }

        setLoading(true);
        try {
            const { error } = await supabase.auth.verifyOtp({
                email,
                token: code,
                type: 'signup', // or 'email', depending on context. usually signup for verify screen
            });

            if (error) throw error;

            // OTP verified successfully - user will be auto-logged in
            showAlert(
                'Success!',
                'Your email has been verified. Welcome to Merakí!',
                'success'
            );
            // Navigation handled by AuthContext or listener usually, but explicit nav helps if not auto
        } catch (error: any) {
            console.error('OTP verification error:', error);
            showAlert('Verification Failed', error.message || 'Invalid or expired code. Please try again.', 'error');
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

            showAlert('Code Sent', 'A new verification code has been sent to your email.', 'success');
            setCountdown(60); // 60 second cooldown
        } catch (error: any) {
            console.error('Resend error:', error);
            showAlert('Error', error.message || 'Failed to resend code. Please try again.', 'error');
        } finally {
            setResending(false);
        }
    };

    return (
        <View style={styles.container}>
            <StatusBar style="dark" />

            {/* Background Gradient */}
            <LinearGradient
                colors={['#1E1E24', '#FFFFFF']}
                style={StyleSheet.absoluteFill}
                start={{ x: 1, y: 0 }}
                end={{ x: 0, y: 1 }}
            />

            {/* Decorative Glow Elements */}
            <View style={[styles.glowBlob, styles.glowTopLeft]} />
            <View style={[styles.glowBlob, styles.glowBottomRight]} />

            <SafeAreaView style={styles.safeArea}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.keyboardView}
                >
                    <View style={styles.header}>
                        <TouchableOpacity
                            style={styles.backButton}
                            onPress={() => navigation.goBack()}
                        >
                            <MaterialIcons name="arrow-back-ios-new" size={20} color={colors.roseWhite} />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.content}>
                        <View style={styles.centerContent}>
                            <View style={styles.iconGlowWrapper}>
                                <View style={styles.iconGlow} />
                                <View style={styles.iconCircle}>
                                    <MaterialIcons name="security" size={48} color={colors.primary} />
                                </View>
                            </View>

                            <MerakiText variant="h2" style={styles.title}>
                                Verify Email
                            </MerakiText>
                            <MerakiText style={styles.subtitle}>
                                We've sent a {OTP_LENGTH}-digit code to{'\n'}
                                <MerakiText style={styles.email}>{email}</MerakiText>
                            </MerakiText>
                        </View>

                        {/* OTP Input Boxes */}
                        <View style={styles.otpContainer}>
                            {otp.map((digit, index) => (
                                <View key={index} style={[styles.otpInputWrapper, digit ? styles.otpInputWrapperFilled : null]}>
                                    <TextInput
                                        ref={(ref) => { inputRefs.current[index] = ref; }}
                                        style={styles.otpInput}
                                        value={digit}
                                        onChangeText={(value) => handleOtpChange(value, index)}
                                        onKeyPress={(e) => handleKeyPress(e, index)}
                                        keyboardType="number-pad"
                                        maxLength={1}
                                        selectTextOnFocus
                                        caretHidden
                                        selectionColor={colors.primary}
                                    />
                                    {/* Glass reflection effect */}
                                    <LinearGradient
                                        colors={['rgba(0, 0, 0, 0.08)', 'transparent']}
                                        style={StyleSheet.absoluteFill}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 1 }}
                                        pointerEvents="none"
                                    />
                                </View>
                            ))}
                        </View>

                        {/* Verify Button */}
                        <Button
                            title="VERIFY EMAIL"
                            variant="gradient"
                            onPress={() => handleVerify()}
                            loading={loading}
                            fullWidth
                            style={styles.button}
                            textStyle={styles.buttonText}
                        />

                        {/* Resend Code */}
                        <View style={styles.resendContainer}>
                            <MerakiText style={styles.resendText}>Didn't receive code? </MerakiText>
                            {countdown > 0 ? (
                                <MerakiText style={styles.countdownText}>
                                    Resend in {countdown}s
                                </MerakiText>
                            ) : (
                                <TouchableOpacity onPress={handleResend} disabled={resending}>
                                    <MerakiText style={styles.resendLink}>
                                        {resending ? 'Sending...' : 'Resend Code'}
                                    </MerakiText>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
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
    glowBlob: {
        position: 'absolute',
        width: 300,
        height: 300,
        borderRadius: 150,
        opacity: 0.5,
    },
    glowTopLeft: {
        top: -100,
        left: -100,
        backgroundColor: 'rgba(212, 138, 130, 0.08)',
    },
    glowBottomRight: {
        bottom: -50,
        right: -50,
        backgroundColor: 'rgba(230, 192, 144, 0.05)',
    },
    header: {
        marginTop: 20,
        marginBottom: 20,
        paddingHorizontal: 24,
    },
    backButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(0, 0, 0, 0.02)',
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.06)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    content: {
        flex: 1,
        paddingHorizontal: 32,
    },
    centerContent: {
        alignItems: 'center',
        marginBottom: 48,
    },
    iconGlowWrapper: {
        position: 'relative',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 40,
    },
    iconGlow: {
        position: 'absolute',
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: 'rgba(212, 168, 83, 0.15)',
    },
    iconCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(0, 0, 0, 0.02)',
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.08)',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 10,
    },
    title: {
        textAlign: 'center',
        fontFamily: 'PlayfairDisplay-Regular',
        fontSize: 32,
        color: colors.roseWhite,
        marginBottom: 12,
    },
    subtitle: {
        fontSize: 14,
        color: 'rgba(0, 0, 0, 0.50)',
        textAlign: 'center',
        lineHeight: 22,
    },
    email: {
        color: colors.roseWhite,
        fontWeight: '700',
    },
    otpContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 12, // spacing.sm might be too small or specific, using 12 for explicit control
        marginBottom: 48,
    },
    otpInputWrapper: {
        width: 48,
        height: 56,
        borderRadius: 12,
        backgroundColor: 'rgba(0, 0, 0, 0.02)', // Glass
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.08)',
        overflow: 'hidden',
        justifyContent: 'center',
        alignItems: 'center',
    },
    otpInputWrapperFilled: {
        borderColor: colors.primary,
        backgroundColor: 'rgba(212, 168, 83, 0.1)',
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 8,
    },
    otpInput: {
        fontSize: 24,
        fontWeight: '600',
        color: colors.roseWhite,
        textAlign: 'center',
        width: '100%',
        height: '100%',
    },
    button: {
        height: 56,
        borderRadius: 28,
        shadowColor: 'rgba(212, 138, 130, 0.2)',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 1,
        shadowRadius: 10,
        elevation: 5,
        marginBottom: 32,
    },
    buttonText: {
        fontSize: 14,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    resendContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
    },
    resendText: {
        fontSize: 14,
        color: 'rgba(0, 0, 0, 0.35)',
    },
    resendLink: {
        fontSize: 14,
        color: colors.primary,
        fontWeight: '600',
    },
    countdownText: {
        fontSize: 14,
        color: 'rgba(0, 0, 0, 0.35)',
        fontStyle: 'italic',
    },
});

export default VerifyOtpScreen;
