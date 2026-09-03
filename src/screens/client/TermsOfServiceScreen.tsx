import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ScreenBackground } from '../../components/ui';
import { EditableLegalBody } from '../../components/editable/EditableLegalBody';
import { colors, spacing } from '../../theme';

/**
 * Built-in document, kept as data so the owner-facing plain-text editor can be
 * seeded from exactly what is rendered here — no duplicated copy to drift.
 */
const SECTIONS: { title: string; body: string }[] = [
    {
        title: '1. Acceptance of Terms',
        body: 'By accessing or using the Merakí platform, including our website and mobile application (collectively, the "Platform"), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our services.',
    },
    {
        title: '2. Description of Service',
        body: 'Merakí provides a platform connecting clients with professional beauty and wellness specialists (each a "Master" or "Specialist"). The Platform allows users to book appointments, purchase products, and access educational content. Merakí acts as an intermediary platform and is not a provider of beauty or wellness services.',
    },
    {
        title: '3. User Accounts',
        body: 'To access most features of the Platform, you must register for an account. You agree to provide accurate, current, and complete information and to keep your credentials secure. You are responsible for all activities that occur under your account and must notify us immediately of any unauthorized access.',
    },
    {
        title: '4. Booking and Cancellations',
        body: "Appointments booked on the Platform are subject to the respective professional's cancellation policy. Cancellations made more than 24 hours before a scheduled appointment receive a full refund. Cancellations made within 24 hours of the appointment are subject to a 50% cancellation fee. No-shows will be charged 100% of the scheduled service amount to the payment method on file.",
    },
    {
        title: '5. Payments',
        body: 'All payments, including service deposits and full bookings, are processed securely through our third-party payment partner (Stripe). Prices are displayed in Euros and include applicable taxes unless stated otherwise. By providing a payment method, you authorize charges in accordance with these terms.',
    },
    {
        title: '6. Refunds',
        body: 'Refunds are processed automatically where applicable under the cancellation policy. Please allow 1 to 10 business days for the funds to appear in your account, depending on your bank and financial institution.',
    },
    {
        title: '7. Intellectual Property',
        body: 'All content, features, and functionality on the Platform, including but not limited to text, logos, designs, graphics, code, and interfaces, are the exclusive property of Merakí and are protected by international copyright, trademark, and other intellectual property laws.',
    },
    {
        title: '8. Limitation of Liability',
        body: 'To the maximum extent permitted by law, Merakí shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits or revenues, arising out of your use of the Platform or the services rendered by independent professionals.',
    },
    {
        title: '9. Changes to Terms',
        body: 'We reserve the right to modify or replace these Terms of Service at any time. We will indicate the date of the latest update at the top. Your continued use of the Platform following the posting of any changes constitutes acceptance of the new terms.',
    },
    {
        title: '10. Contact Information',
        body: 'If you have any questions regarding these Terms, please contact our Legal team at legal@merakiapp.com.',
    },
];

const DEFAULT_TEXT = SECTIONS.map((s) => `${s.title}\n\n${s.body}`).join('\n\n');

export function TermsOfServiceScreen() {
    const navigation = useNavigation();

    return (
        <ScreenBackground>
            <SafeAreaView style={styles.container} edges={['top']}>
                <ScrollView contentContainerStyle={styles.content}>
                    {/* Header */}
                    <View style={styles.header}>
                        <TouchableOpacity
                            accessibilityRole="button"
                            accessibilityLabel="Go back" onPress={() => navigation.goBack()} style={styles.backButton}>
                            <MaterialIcons name="arrow-back" size={22} color="rgba(0, 0, 0, 0.55)" />
                        </TouchableOpacity>
                        <Text style={styles.title}>Terms of Service</Text>
                        <Text style={styles.lastUpdated}>Last updated: June 2026</Text>
                    </View>

                    <EditableLegalBody
                        contentKey="legal.tos_body"
                        label="Terms of Service"
                        defaultText={DEFAULT_TEXT}
                    >
                        <View>
                            {SECTIONS.map((section) => (
                                <View key={section.title} style={styles.section}>
                                    <Text style={styles.sectionTitle}>{section.title}</Text>
                                    <Text style={styles.paragraph}>{section.body}</Text>
                                </View>
                            ))}
                        </View>
                    </EditableLegalBody>
                </ScrollView>
            </SafeAreaView>
        </ScreenBackground>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    content: { padding: spacing.lg, paddingBottom: spacing.xxxl },
    header: { marginBottom: spacing.xl },
    backButton: {
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: 'rgba(0, 0, 0, 0.03)',
        borderWidth: 1, borderColor: 'rgba(0, 0, 0, 0.06)',
        alignItems: 'center', justifyContent: 'center',
    },
    title: { fontSize: 28, fontWeight: '600', color: colors.text },
    lastUpdated: { fontSize: 12, color: colors.textMuted, marginTop: spacing.xs },
    section: { marginBottom: spacing.lg },
    sectionTitle: { fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: spacing.sm },
    paragraph: { fontSize: 14, color: colors.textSecondary, lineHeight: 22 },
});

export default TermsOfServiceScreen;
