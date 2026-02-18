import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ScreenBackground } from '../../components/ui'; // Assuming ScreenBackground is exported from ui
import { colors, spacing } from '../../theme';
import { Ionicons } from '@expo/vector-icons';

type AuthStackParamList = {
    // ... potentially other routes
    Terms: undefined;
};

type TermsScreenProps = {
    navigation: NativeStackNavigationProp<AuthStackParamList, 'Terms'>;
};

export const TermsScreen = ({ navigation }: TermsScreenProps) => {
    return (
        <ScreenBackground>
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity
                        onPress={() => navigation.goBack()}
                        style={styles.backButton}
                    >
                        <Ionicons name="arrow-back" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={styles.title}>Terms of Service</Text>
                    <View style={{ width: 24 }} />
                </View>

                <ScrollView
                    style={styles.content}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.scrollContent}
                >
                    <Text style={styles.sectionTitle}>1. Acceptance of Terms</Text>
                    <Text style={styles.text}>
                        By accessing and using Merakí, you verify that you have read, understood, and agree to be bound by these Terms of Service. If you do not agree to these terms, simply do not use the application.
                    </Text>

                    <Text style={styles.sectionTitle}>2. Use of Service</Text>
                    <Text style={styles.text}>
                        Merakí provides a platform for booking beauty and wellness services. Users must be at least 18 years old to create an account. You represent and warrant that all information you submit is truthful and accurate.
                    </Text>

                    <Text style={styles.sectionTitle}>3. User Accounts</Text>
                    <Text style={styles.text}>
                        You are responsible for maintaining the confidentiality of your account credentials. You agree to notify us immediately of any unauthorized use of your account.
                    </Text>

                    <Text style={styles.sectionTitle}>4. No-Show Policy</Text>
                    <Text style={styles.text}>
                        In the event of a no-show, a 100% fee will be charged according to the no-show policy.
                    </Text>

                    <Text style={styles.sectionTitle}>5. Privacy Policy</Text>
                    <Text style={styles.text}>
                        Your privacy is important to us. Please review our Privacy Policy to understand how we collect, use, and share your personal information.
                    </Text>

                    <Text style={styles.sectionTitle}>6. Modifications</Text>
                    <Text style={styles.text}>
                        We reserve the right to modify these terms at any time. Continued use of the service following any changes indicates your acceptance of the new terms.
                    </Text>

                    <Text style={styles.lastUpdated}>
                        Last Updated: February 2026
                    </Text>
                </ScrollView>
            </SafeAreaView>
        </ScreenBackground>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    backButton: {
        padding: spacing.xs,
    },
    title: {
        fontSize: 18,
        fontWeight: '600',
        color: colors.text,
    },
    content: {
        flex: 1,
    },
    scrollContent: {
        padding: spacing.lg,
        paddingBottom: spacing.xxl,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.text,
        marginTop: spacing.lg,
        marginBottom: spacing.sm,
    },
    text: {
        fontSize: 14,
        color: colors.textSecondary,
        lineHeight: 22,
    },
    lastUpdated: {
        fontSize: 12,
        color: colors.textMuted,
        marginTop: spacing.xl,
        fontStyle: 'italic',
        textAlign: 'center',
    },
});

export default TermsScreen;
