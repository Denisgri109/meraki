import React, { useState } from 'react';
import {
    View,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../contexts/AuthContext';
import { useModal } from '../../contexts/ModalContext';
import { Button, Input, MerakiText } from '../../components/ui';
import { EditableText } from '../../components/editable/EditableText';
import { colors, spacing } from '../../theme';
import { StatusBar } from 'expo-status-bar';

type AuthStackParamList = {
    Login: undefined;
    Register: undefined;
    ForgotPassword: undefined;
};

type LoginScreenProps = {
    navigation: NativeStackNavigationProp<AuthStackParamList, 'Login'>;
};



import { validateEmail } from '../../utils/validation';

export function LoginScreen({ navigation }: LoginScreenProps) {
    const { signIn } = useAuth();
    const { showAlert } = useModal();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const handleLogin = async () => {
        if (!email || !password) {
            showAlert('Error', 'Please fill in all fields', 'error');
            return;
        }

        const emailVal = validateEmail(email);
        if (!emailVal.valid) {
            showAlert('Invalid Email', emailVal.error || 'Please enter a valid email address.', 'error');
            return;
        }

        setLoading(true);
        const { error } = await signIn(email, password);
        setLoading(false);

        if (error) {
            showAlert('Error', error.message, 'error');
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
                    <View style={styles.content}>
                        {/* Brand Identity */}
                        <View style={styles.header}>
                            <View style={styles.logoContainer}>
                                <EditableText
                                    contentKey="brand.logo_text"
                                    fallback="Merakí"
                                    label="Brand Name"
                                    style={styles.logo}
                                />
                                <View style={styles.logoGlow} />
                            </View>
                            <EditableText
                                contentKey="mobile.auth.login_tagline"
                                label="Sign In Tagline"
                                style={styles.tagline}
                            />
                        </View>

                        {/* Login Form */}
                        <View style={styles.form}>
                            <View style={styles.inputGroup}>
                                <MerakiText style={styles.label}>EMAIL ADDRESS</MerakiText>
                                <Input
                                    testID="login-email"
                                    value={email}
                                    onChangeText={setEmail}
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                    autoComplete="email"
                                    placeholder="name@example.com"
                                    variant="glass"
                                    containerStyle={styles.inputContainer}
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <MerakiText style={styles.label}>PASSWORD</MerakiText>
                                <Input
                                    testID="login-password"
                                    value={password}
                                    onChangeText={setPassword}
                                    secureTextEntry={!showPassword}
                                    autoCapitalize="none"
                                    placeholder="••••••••"
                                    variant="glass"
                                    containerStyle={styles.inputContainer}
                                    rightIcon={
                                        <TouchableOpacity
                                            accessibilityRole="button"
                                            accessibilityLabel="Show or hide password" onPress={() => setShowPassword(!showPassword)}>
                                            <MaterialIcons
                                                name={showPassword ? 'visibility' : 'visibility-off'}
                                                size={20}
                                                color="rgba(0, 0, 0, 0.25)"
                                            />
                                        </TouchableOpacity>
                                    }
                                />
                            </View>

                            <TouchableOpacity
                                onPress={() => navigation.navigate('ForgotPassword')}
                                style={styles.forgotButton}
                            >
                                <MerakiText style={styles.forgotText}>Forgot Password?</MerakiText>
                            </TouchableOpacity>

                            <Button
                                title="SIGN IN"
                                onPress={handleLogin}
                                loading={loading}
                                fullWidth
                                variant="gradient"
                                style={styles.signInButton}
                                textStyle={styles.signInButtonText}
                            />

                            {/* Sign Up Link — directly below button */}
                            <View style={styles.footer}>
                                <MerakiText style={styles.footerText}>Don't have an account? </MerakiText>
                                <TouchableOpacity onPress={() => navigation.navigate('Register')}>
                                    <MerakiText style={styles.linkText}>Sign Up</MerakiText>
                                </TouchableOpacity>
                            </View>
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
        backgroundColor: '#FFFFFF',
    },
    safeArea: {
        flex: 1,
    },
    keyboardView: {
        flex: 1,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: 32,
    },

    header: {
        alignItems: 'center',
        marginBottom: 56,
    },
    logoContainer: {
        position: 'relative',
        alignItems: 'center',
        justifyContent: 'center',
    },
    logo: {
        fontSize: 48,
        fontFamily: 'PlayfairDisplay-Italic', // Assuming font is available or fallback
        color: colors.primary,
        fontStyle: 'italic',
        textShadowColor: 'rgba(212, 138, 130, 0.4)',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 15,
        zIndex: 2,
    },
    logoGlow: {
        position: 'absolute',
        width: '120%',
        height: '120%',
        backgroundColor: 'rgba(212, 138, 130, 0.1)',
        borderRadius: 100,
        zIndex: 1,
    },
    tagline: {
        marginTop: 12,
        fontSize: 10,
        letterSpacing: 3,
        color: 'rgba(230, 192, 144, 0.7)', // Champagne/70
        fontWeight: '500',
        textTransform: 'uppercase',
    },
    form: {
        marginBottom: 24,
    },
    inputGroup: {
        marginBottom: 20,
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
    inputContainer: {
        marginBottom: 0,
    },
    forgotButton: {
        alignSelf: 'flex-end',
        marginTop: -8,
        marginBottom: 24,
    },
    forgotText: {
        fontSize: 12,
        color: 'rgba(230, 192, 144, 0.8)', // Champagne/80
        fontWeight: '500',
    },
    signInButton: {
        height: 56,
        borderRadius: 28,
        shadowColor: 'rgba(212, 138, 130, 0.2)',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 1,
        shadowRadius: 10,
        elevation: 5,
    },
    signInButtonText: {
        fontSize: 14,
        fontWeight: '700',
        letterSpacing: 0.5,
    },

    footer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 24,
    },
    footerText: {
        fontSize: 13,
        color: 'rgba(0, 0, 0, 0.35)',
    },
    linkText: {
        fontSize: 13,
        color: colors.primary,
        fontWeight: '700',
        textDecorationLine: 'underline',
        marginLeft: 4,
    },
});
