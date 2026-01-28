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

export function PrivacyPolicyScreen() {
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
                        <Text style={styles.title}>Privacy Policy</Text>
                        <Text style={styles.lastUpdated}>Last updated: January 2026</Text>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>1. Information We Collect</Text>
                        <Text style={styles.paragraph}>
                            We collect information you provide directly, including your name, email address, phone number, and payment information. We also collect usage data to improve our services.
                        </Text>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>2. How We Use Your Information</Text>
                        <Text style={styles.paragraph}>
                            Your information is used to provide our services, process appointments and payments, send notifications, and improve the user experience. We never sell your personal data.
                        </Text>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>3. Data Security</Text>
                        <Text style={styles.paragraph}>
                            We implement industry-standard security measures to protect your data. Payment information is processed through PCI-compliant payment processors and is never stored on our servers.
                        </Text>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>4. Data Sharing</Text>
                        <Text style={styles.paragraph}>
                            We share your information only with service providers necessary to deliver our services, including payment processors and notification services. We require all third parties to respect the security of your data.
                        </Text>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>5. Your Rights</Text>
                        <Text style={styles.paragraph}>
                            Under GDPR, you have the right to access, correct, or delete your personal data. You may also request data portability or withdraw consent at any time by contacting us.
                        </Text>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>6. Cookies & Tracking</Text>
                        <Text style={styles.paragraph}>
                            Our mobile app uses analytics to understand usage patterns. You can disable analytics in your device settings or within the app preferences.
                        </Text>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>7. Data Retention</Text>
                        <Text style={styles.paragraph}>
                            We retain your data for as long as necessary to provide our services. Account data is deleted upon request, subject to legal retention requirements.
                        </Text>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>8. Children's Privacy</Text>
                        <Text style={styles.paragraph}>
                            Our services are not intended for children under 16. We do not knowingly collect personal information from children.
                        </Text>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>9. Contact Us</Text>
                        <Text style={styles.paragraph}>
                            For privacy-related inquiries, contact our Data Protection Officer at privacy@meraki.com
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

export default PrivacyPolicyScreen;
