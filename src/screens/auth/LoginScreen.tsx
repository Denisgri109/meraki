import React, { useState } from 'react';
import {
    View,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    TouchableOpacity,
    Image,
    Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../contexts/AuthContext';
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

type LoginScreenProps = {
    navigation: NativeStackNavigationProp<AuthStackParamList, 'Login'>;
};

const { width, height } = Dimensions.get('window');

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

        setLoading(true);
        const { error } = await signIn(email, password);
        setLoading(false);

        if (error) {
            showAlert('Error', error.message, 'error');
        }
    };

    return (
        <View style={styles.container}>
            <StatusBar style="light" />

            {/* Background Gradient */}
            <LinearGradient
                colors={['#1E1E24', '#0F0F13']}
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
                    <View style={styles.content}>
                        {/* Brand Identity */}
                        <View style={styles.header}>
                            <View style={styles.logoContainer}>
                                <MerakiText variant="h1" style={styles.logo}>Merakí</MerakiText>
                                <View style={styles.logoGlow} />
                            </View>
                            <MerakiText style={styles.tagline}>BEAUTY WITH SOUL</MerakiText>
                        </View>

                        {/* Login Form */}
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
                                    containerStyle={styles.inputContainer}
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <MerakiText style={styles.label}>PASSWORD</MerakiText>
                                <Input
                                    value={password}
                                    onChangeText={setPassword}
                                    secureTextEntry={!showPassword}
                                    autoCapitalize="none"
                                    placeholder="••••••••"
                                    variant="glass"
                                    containerStyle={styles.inputContainer}
                                    rightIcon={
                                        <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                                            <MaterialIcons
                                                name={showPassword ? 'visibility' : 'visibility-off'}
                                                size={20}
                                                color="rgba(255,255,255,0.3)"
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
                        </View>

                        {/* Divider */}
                        <View style={styles.divider}>
                            <View style={styles.dividerLine} />
                            <MerakiText style={styles.dividerText}>or continue with</MerakiText>
                            <View style={styles.dividerLine} />
                        </View>

                        {/* Social Logins */}
                        <View style={styles.socialRow}>
                            <TouchableOpacity style={styles.socialButton}>
                                <Image
                                    source={{ uri: 'https://lh3.googleusercontent.com/aida-public/AB6AXuA4vTglS1IywHDq6FqesT46Plz5S0BvGLKv5xizH3QU8u2VzKG74ze1gpKoBPY317Df6wACpYiwMOV_Vq1OqgrPnDFlDkSUrG4_Tcg01QSCdQ1yofXS0YrI2yfO5JThtAdpK_-PUOflczZUeQVjSdXdK-yoopMnYaiBs-Wj_619jP06YAwT2n2z0uzdAqQUZZUwoRiSfNMWHDqg8CtoQexzgxUcruv-MDmE02e6mZleJ2YJ-iYwaP5TlO8MbFljP2IZoAm_7y0_HIE8' }}
                                    style={styles.googleIcon}
                                />
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.socialButton}>
                                <MaterialIcons name="apple" size={24} color="white" style={{ opacity: 0.9 }} />
                            </TouchableOpacity>
                        </View>

                        {/* Footer */}
                        <View style={styles.footer}>
                            <MerakiText style={styles.footerText}>Don't have an account? </MerakiText>
                            <TouchableOpacity onPress={() => navigation.navigate('Register')}>
                                <MerakiText style={styles.linkText}>Sign Up</MerakiText>
                            </TouchableOpacity>
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
    content: {
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: 32,
    },
    glowBlob: {
        position: 'absolute',
        width: 256,
        height: 256,
        borderRadius: 128,
        opacity: 0.6,
    },
    glowTopLeft: {
        top: -80,
        left: -80,
        backgroundColor: 'rgba(212, 138, 130, 0.1)', // Primary/10
    },
    glowBottomRight: {
        bottom: -80,
        right: -80,
        backgroundColor: 'rgba(230, 192, 144, 0.05)', // Champagne/5
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
        color: 'rgba(255, 255, 255, 0.4)',
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
    divider: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 40,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
    },
    dividerText: {
        marginHorizontal: 16,
        fontSize: 10,
        color: 'rgba(255, 255, 255, 0.3)',
        textTransform: 'uppercase',
        letterSpacing: 2,
        fontWeight: '500',
    },
    socialRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 24,
        marginBottom: 32,
    },
    socialButton: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    googleIcon: {
        width: 24,
        height: 24,
        opacity: 0.7,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 'auto',
        paddingBottom: 20,
    },
    footerText: {
        fontSize: 13,
        color: 'rgba(255, 255, 255, 0.4)',
    },
    linkText: {
        fontSize: 13,
        color: colors.primary,
        fontWeight: '700',
        textDecorationLine: 'underline',
        marginLeft: 4,
    },
});
