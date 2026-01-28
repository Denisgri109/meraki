import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ScreenBackground } from '../../components/ui';
import { colors, spacing } from '../../theme';

export function TermsOfServiceScreen() {
    const navigation = useNavigation();

    return (
        <ScreenBackground>
            <SafeAreaView style={styles.container} edges={['top']}>
                <ScrollView contentContainerStyle={styles.content}>
                    {/* Header */}
                    <View style={styles.header}>
                        <TouchableOpacity onPress={() => navigation.goBack()}>
                            <Text style={styles.backButton}>← Back</Text>
                        </TouchableOpacity>
                        <Text style={styles.title}>Terms of Service</Text>
                        <Text style={styles.lastUpdated}>Last updated: January 2026</Text>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>1. Acceptance of Terms</Text>
                        <Text style={styles.paragraph}>
                            By accessing and using the Merakí application, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our services.
                        </Text>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>2. Services</Text>
                        <Text style={styles.paragraph}>
                            Merakí provides a platform for booking beauty and wellness services. We connect clients with professional beauty masters for appointments, product purchases, and educational content.
                        </Text>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>3. User Accounts</Text>
                        <Text style={styles.paragraph}>
                            You are responsible for maintaining the confidentiality of your account credentials. You agree to notify us immediately of any unauthorized use of your account.
                        </Text>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>4. Booking & Cancellations</Text>
                        <Text style={styles.paragraph}>
                            Appointments may be cancelled up to 24 hours in advance without charge. Late cancellations or no-shows may result in a fee charged to your payment method on file.
                        </Text>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>5. Payments</Text>
                        <Text style={styles.paragraph}>
                            All payments are processed securely through our payment partners. Prices are displayed in Euros and include applicable taxes unless otherwise stated.
                        </Text>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>6. Intellectual Property</Text>
                        <Text style={styles.paragraph}>
                            All content within the Merakí app, including logos, designs, and text, is the property of Merakí and protected by intellectual property laws.
                        </Text>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>7. Limitation of Liability</Text>
                        <Text style={styles.paragraph}>
                            Merakí shall not be liable for any indirect, incidental, or consequential damages arising from your use of our services.
                        </Text>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>8. Changes to Terms</Text>
                        <Text style={styles.paragraph}>
                            We reserve the right to modify these terms at any time. Continued use of the app after changes constitutes acceptance of the new terms.
                        </Text>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>9. Contact</Text>
                        <Text style={styles.paragraph}>
                            For questions about these Terms, please contact us at legal@meraki.com
                        </Text>
                    </View>
                </ScrollView>
            </SafeAreaView>
        </ScreenBackground>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    content: { padding: spacing.lg, paddingBottom: spacing.xxxl },
    header: { marginBottom: spacing.xl },
    backButton: { color: colors.textSecondary, fontSize: 16, marginBottom: spacing.md },
    title: { fontSize: 28, fontWeight: '600', color: colors.text },
    lastUpdated: { fontSize: 12, color: colors.textMuted, marginTop: spacing.xs },
    section: { marginBottom: spacing.lg },
    sectionTitle: { fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: spacing.sm },
    paragraph: { fontSize: 14, color: colors.textSecondary, lineHeight: 22 },
});

export default TermsOfServiceScreen;
