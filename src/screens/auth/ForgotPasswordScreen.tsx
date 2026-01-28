import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    TouchableOpacity,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase';
import { Button, Input, ScreenBackground } from '../../components/ui';
import { colors, spacing } from '../../theme';

type AuthStackParamList = {
    Login: undefined;
    Register: undefined;
    ForgotPassword: undefined;
};

type ForgotPasswordScreenProps = {
    navigation: NativeStackNavigationProp<AuthStackParamList, 'ForgotPassword'>;
};

export function ForgotPasswordScreen({ navigation }: ForgotPasswordScreenProps) {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);

    const handleReset = async () => {
        if (!email) {
            Alert.alert('Error', 'Please enter your email address');
            return;
        }

        setLoading(true);
        const { error } = await supabase.auth.resetPasswordForEmail(email);
        setLoading(false);

        if (error) {
            Alert.alert('Error', error.message);
        } else {
            setSent(true);
        }
    };

    if (sent) {
        return (
            <ScreenBackground>
                <SafeAreaView style={styles.container}>
                    <View style={styles.content}>
                        <View style={styles.successContainer}>
                            <Text style={styles.successIcon}>✓</Text>
                            <Text style={styles.successTitle}>Email Sent</Text>
                            <Text style={styles.successText}>
                                Check your email for the password reset link.
                            </Text>
                            <Button
                                title="Back to Login"
                                variant="outline"
                                onPress={() => navigation.navigate('Login')}
                                style={styles.backButton}
                            />
                        </View>
                    </View>
                </SafeAreaView>
            </ScreenBackground>
        );
    }

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
                            <Text style={styles.title}>Reset Password</Text>
                            <Text style={styles.subtitle}>
                                Enter your email and we'll send you a reset link
                            </Text>
                        </View>

                        {/* Form */}
                        <View style={styles.form}>
                            <Input
                                label="Email"
                                value={email}
                                onChangeText={setEmail}
                                keyboardType="email-address"
                                autoCapitalize="none"
                                autoComplete="email"
                                placeholder="your@email.com"
                            />

                            <Button
                                title="Send Reset Link"
                                onPress={handleReset}
                                loading={loading}
                                fullWidth
                                style={styles.button}
                            />
                        </View>

                        {/* Back Link */}
                        <TouchableOpacity
                            onPress={() => navigation.navigate('Login')}
                            style={styles.backLink}
                        >
                            <Text style={styles.backLinkText}>← Back to Login</Text>
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
        marginBottom: spacing.xl,
    },
    title: {
        fontSize: 32,
        fontWeight: '600',
        color: colors.text,
        letterSpacing: 1,
    },
    subtitle: {
        fontSize: 14,
        color: colors.textSecondary,
        marginTop: spacing.sm,
        textAlign: 'center',
    },
    form: {
        marginBottom: spacing.xl,
    },
    button: {
        marginTop: spacing.md,
    },
    backLink: {
        alignItems: 'center',
    },
    backLinkText: {
        color: colors.textSecondary,
        fontSize: 14,
    },
    successContainer: {
        alignItems: 'center',
    },
    successIcon: {
        fontSize: 64,
        color: colors.success,
        marginBottom: spacing.lg,
    },
    successTitle: {
        fontSize: 28,
        fontWeight: '600',
        color: colors.text,
        marginBottom: spacing.sm,
    },
    successText: {
        fontSize: 14,
        color: colors.textSecondary,
        textAlign: 'center',
        marginBottom: spacing.xl,
    },
    backButton: {
        marginTop: spacing.lg,
    },
});

export default ForgotPasswordScreen;
