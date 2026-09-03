import React, { useState } from 'react';
import {
    View,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    TouchableOpacity,
    Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase';
import { useModal } from '../../contexts/ModalContext';
import { Button, Input, MerakiText } from '../../components/ui';
import { colors, spacing } from '../../theme';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';

type AuthStackParamList = {
    Login: undefined;
    Register: undefined;
    ForgotPassword: undefined;
};

type ForgotPasswordScreenProps = {
    navigation: NativeStackNavigationProp<AuthStackParamList, 'ForgotPassword'>;
};

const { width } = Dimensions.get('window');

export function ForgotPasswordScreen({ navigation }: ForgotPasswordScreenProps) {
    const { showAlert } = useModal();
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);

    const handleReset = async () => {
        if (!email) {
            showAlert('Error', 'Please enter your email address', 'error');
            return;
        }

        setLoading(true);
        const { error } = await supabase.auth.resetPasswordForEmail(email);
        setLoading(false);

        if (error) {
            showAlert('Error', error.message, 'error');
        } else {
            setSent(true);
        }
    };

    const renderSuccessState = () => (
        <View style={styles.centerContent}>
            <View style={styles.iconGlowWrapper}>
                <View style={styles.iconGlow} />
                <View style={styles.iconCircle}>
                    <MaterialIcons name="mark-email-read" size={48} color={colors.primary} />
                </View>
            </View>
            <MerakiText variant="h2" style={styles.successTitle}>Check Your Email</MerakiText>
            <MerakiText style={styles.successText}>
                We've sent a password reset link to{'\n'}
                <MerakiText style={{ color: colors.roseWhite, fontWeight: '700' }}>{email}</MerakiText>
            </MerakiText>
            <Button
                title="BACK TO LOGIN"
                variant="gradient" // Or outline if preferred, but gradient keeps consistency
                onPress={() => navigation.navigate('Login')}
                fullWidth
                style={styles.backLoginButton}
                textStyle={{ fontWeight: '700', letterSpacing: 0.5 }}
            />
            <TouchableOpacity
                style={styles.resendLink}
                onPress={handleReset}
                disabled={loading}
            >
                <MerakiText style={styles.resendText}>Didn't receive it? Resend</MerakiText>
            </TouchableOpacity>
        </View>
    );

    const renderFormState = () => (
        <View style={styles.content}>
            <View style={styles.header}>
                <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Go back"
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                >
                    <MaterialIcons name="arrow-back-ios-new" size={20} color={colors.roseWhite} />
                </TouchableOpacity>
            </View>

            <View style={styles.centerContent}>
                {/* Lock Icon */}
                <View style={styles.iconGlowWrapper}>
                    <View style={styles.iconGlow} />
                    <View style={styles.iconCircle}>
                        <MaterialIcons name="lock-reset" size={48} color={colors.primary} />
                    </View>
                </View>

                {/* Instructions */}
                <MerakiText variant="h2" style={styles.heading}>
                    Forgot Password?
                </MerakiText>
                <MerakiText style={styles.description}>
                    Don't worry! It happens. Please enter the email associated with your account.
                </MerakiText>

                {/* Form */}
                <View style={styles.form}>
                    <View style={styles.inputGroup}>
                        <MerakiText style={styles.label}>EMAIL ADDRESS</MerakiText>
                        <Input
                            value={email}
                            onChangeText={setEmail}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            autoComplete="email"
                            placeholder="name@example.com"
                            variant="glass"
                            leftIcon={
                                <MaterialIcons name="alternate-email" size={20} color="rgba(0, 0, 0, 0.25)" />
                            }
                        />
                    </View>

                    <Button
                        title="SEND RESET LINK"
                        variant="gradient"
                        onPress={handleReset}
                        loading={loading}
                        fullWidth
                        style={styles.resetButton}
                        textStyle={styles.resetButtonText}
                    />
                </View>
            </View>

            {/* Footer */}
            <View style={styles.footer}>
                <MerakiText style={styles.footerText}>Remember password? </MerakiText>
                <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                    <MerakiText style={styles.footerLink}>Sign In</MerakiText>
                </TouchableOpacity>
            </View>
        </View>
    );

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
                    {sent ? renderSuccessState() : renderFormState()}
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
    content: {
        flex: 1,
        paddingHorizontal: 32,
        paddingBottom: 20,
    },
    header: {
        marginTop: 20,
        marginBottom: 20,
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
    centerContent: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 60,
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
        backgroundColor: 'rgba(0, 0, 0, 0.02)', // Glass background
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.08)',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 10,
    },
    heading: {
        textAlign: 'center',
        fontFamily: 'PlayfairDisplay-Regular',
        fontSize: 32,
        color: colors.roseWhite,
        marginBottom: 12,
    },
    description: {
        textAlign: 'center',
        fontSize: 14,
        color: 'rgba(0, 0, 0, 0.50)',
        lineHeight: 22,
        maxWidth: 280,
        marginBottom: 40,
    },
    form: {
        width: '100%',
    },
    inputGroup: {
        marginBottom: 32,
    },
    label: {
        fontSize: 11,
        fontWeight: '600',
        color: 'rgba(0, 0, 0, 0.35)',
        marginLeft: 16,
        marginBottom: 8,
        letterSpacing: 1.5,
        textTransform: 'uppercase',
    },
    resetButton: {
        height: 56,
        borderRadius: 28,
        shadowColor: 'rgba(212, 138, 130, 0.2)',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 1,
        shadowRadius: 10,
        elevation: 5,
    },
    resetButtonText: {
        fontSize: 14,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    successTitle: {
        textAlign: 'center',
        fontFamily: 'PlayfairDisplay-Regular',
        fontSize: 28,
        color: colors.roseWhite,
        marginBottom: 12,
        marginTop: 24,
    },
    successText: {
        textAlign: 'center',
        fontSize: 14,
        color: 'rgba(0, 0, 0, 0.50)',
        marginBottom: 40,
        lineHeight: 22,
    },
    backLoginButton: {
        height: 56,
        borderRadius: 28,
    },
    resendLink: {
        marginTop: 24,
    },
    resendText: {
        fontSize: 14,
        color: colors.primary,
        fontWeight: '600',
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'center',
    },
    footerText: {
        fontSize: 14,
        color: 'rgba(0, 0, 0, 0.35)',
    },
    footerLink: {
        fontSize: 14,
        fontWeight: '700',
        color: colors.primary,
        textDecorationLine: 'underline',
        marginLeft: 4,
    },
});

export default ForgotPasswordScreen;
