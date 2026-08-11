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
        title: '1. Introduction',
        body: 'Welcome to Merakí. We respect your privacy and are committed to protecting your personal data. This privacy policy will inform you as to how we collect and process your personal data when you visit our website or use our mobile application (collectively, the "Platform"), regardless of where you access it from, and tell you about your privacy rights and how the law protects you.',
    },
    {
        title: '2. Information We Collect',
        body: 'We may collect, use, store and transfer different kinds of personal data about you which we have grouped together as follows:\n\n'
            + '• Identity Data includes first name, last name, username, or similar identifier.\n'
            + '• Contact Data includes email address, billing address, telephone number, country, and city.\n'
            + '• Financial Data includes payment card details (securely handled by Stripe).\n'
            + '• Transaction Data includes details about payments to and from you, and details of services and products you have booked or purchased on the Platform.\n'
            + '• Usage and Technical Data includes internet protocol (IP) address, login data, browser type/version, time zone setting, operating system, and platform usage analytics.',
    },
    {
        title: '3. How We Use Your Information',
        body: 'We will only use your personal data when the law allows us to. Most commonly, we will use your personal data in the following circumstances:\n\n'
            + '• To provide our services, manage bookings and appointments, facilitate payments, and maintain your account profile.\n'
            + '• To send transaction notifications, push notifications, and email confirmations.\n'
            + '• Where it is necessary for our legitimate interests (e.g., improving Platform performance and user experience).\n'
            + '• To comply with a legal or regulatory obligation.',
    },
    {
        title: '4. Data Security',
        body: 'We implement industry-standard technical and organizational security measures to prevent your personal data from being accidentally lost, used, or accessed in an unauthorized way. In addition, payment details are securely processed and stored by our PCI-compliant payment provider (Stripe) and are never stored directly on our servers.',
    },
    {
        title: '5. Data Sharing',
        body: 'We share your personal data only with trusted third-party service providers necessary to deliver our services (including payment processing via Stripe, database hosting, and notification delivery services). We require all third parties to respect the security of your data and treat it in accordance with the law. We never sell your personal data.',
    },
    {
        title: '6. Your Rights',
        body: 'Under GDPR and applicable privacy laws, you have rights in relation to your personal data. These include the right to request access, correction, erasure, restriction of processing, data portability, and the right to object to processing. You may exercise these rights or manage your settings within the Platform or by contacting us.',
    },
    {
        title: '7. Cookies & Tracking',
        body: 'Our Platform uses cookies and mobile analytics identifiers to distinguish you from other users and to analyze usage patterns. You can configure your browser to refuse all or some browser cookies, or opt out of analytics tracking in your device settings.',
    },
    {
        title: '8. Data Retention',
        body: 'We retain your personal data only for as long as necessary to fulfill the purposes we collected it for, including for the purposes of satisfying any legal, accounting, or reporting requirements. Account data is deleted or anonymized upon request, subject to legal retention obligations.',
    },
    {
        title: '9. Contact Us',
        body: 'If you have any questions about this privacy policy, our privacy practices, or wish to exercise your legal rights, please contact our Data Protection team at privacy@merakiapp.com.',
    },
];

const DEFAULT_TEXT = SECTIONS.map((s) => `${s.title}\n\n${s.body}`).join('\n\n');

export function PrivacyPolicyScreen() {
    const navigation = useNavigation();

    return (
        <ScreenBackground>
            <SafeAreaView style={styles.container} edges={['top']}>
                <ScrollView contentContainerStyle={styles.content}>
                    {/* Header */}
                    <View style={styles.header}>
                        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                            <MaterialIcons name="arrow-back" size={22} color="rgba(0, 0, 0, 0.55)" />
                        </TouchableOpacity>
                        <Text style={styles.title}>Privacy Policy</Text>
                        <Text style={styles.lastUpdated}>Last updated: June 2026</Text>
                    </View>

                    <EditableLegalBody
                        contentKey="legal.privacy_policy_body"
                        label="Privacy Policy"
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

export default PrivacyPolicyScreen;
