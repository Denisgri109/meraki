import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useMenuBackHandler } from '../../hooks/useMenuBackHandler';
import { safeGoBack } from '../../navigation/navigationUtils';
import { Card, Button } from '../../components/ui';
import { ScreenBackground } from '../../components/ui';
import { colors, spacing } from '../../theme';

export function HelpSupportScreen() {
    const navigation = useNavigation<any>();
    const handleBack = useMenuBackHandler();

    const faqs = [
        {
            question: 'How do I modify my booking?',
            answer: 'Go to "My Orders", select the appointment you wish to change, and tap "Reschedule". You can choose a new date and time from the available slots.'
        },
        {
            question: 'What is the cancellation policy?',
            answer: 'You can cancel free of charge up to 24 hours before your appointment. Cancellations made within 24 hours may be subject to a fee.'
        },
        {
            question: 'How do I earn loyalty points?',
            answer: 'You earn points for every service booked and product purchased. Points can be redeemed for discounts on future visits.'
        },
    ];

    const contactOptions = [
        {
            icon: '💬',
            title: 'Chat with Support',
            subtitle: 'Instant help from our team',
            action: () => {
                // In a real app, this would start a chat with admin
                // For now, let's navigate to home or show an alert
                // navigation.navigate('Chat', { ... });
            }
        },
        {
            icon: '📞',
            title: 'Call Us',
            subtitle: '+1 (555) 123-4567',
            action: () => Linking.openURL('tel:+15551234567')
        },
        {
            icon: '✉️',
            title: 'Email Support',
            subtitle: 'support@meraki.com',
            action: () => Linking.openURL('mailto:support@meraki.com')
        }
    ];

    return (
        <ScreenBackground>
            <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                        <Text style={styles.backButtonText}>←</Text>
                    </TouchableOpacity>
                    <Text style={styles.title}>Help & Support</Text>
                    <View style={{ width: 40 }} />
                </View>

                <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Contact Us</Text>
                        {contactOptions.map((option, index) => (
                            <TouchableOpacity key={index} onPress={option.action}>
                                <Card style={styles.contactCard} variant="glass">
                                    <View style={styles.contactIcon}>
                                        <Text style={styles.iconText}>{option.icon}</Text>
                                    </View>
                                    <View style={styles.contactInfo}>
                                        <Text style={styles.contactTitle}>{option.title}</Text>
                                        <Text style={styles.contactSubtitle}>{option.subtitle}</Text>
                                    </View>
                                    <Text style={styles.chevron}>›</Text>
                                </Card>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
                        {faqs.map((faq, index) => (
                            <Card key={index} style={styles.faqCard} variant="elevated">
                                <Text style={styles.faqQuestion}>{faq.question}</Text>
                                <Text style={styles.faqAnswer}>{faq.answer}</Text>
                            </Card>
                        ))}
                    </View>
                </ScrollView>
            </SafeAreaView>
        </ScreenBackground>
    );
}

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
    },
    backButton: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 20,
        backgroundColor: colors.surface,
    },
    backButtonText: {
        fontSize: 24,
        color: colors.text,
    },
    title: {
        fontSize: 20,
        fontWeight: '600',
        color: colors.text,
    },
    content: {
        flex: 1,
        padding: spacing.lg,
    },
    section: {
        marginBottom: spacing.xl,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: colors.text,
        marginBottom: spacing.md,
    },
    contactCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.md,
        marginBottom: spacing.sm,
    },
    contactIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: spacing.md,
        borderWidth: 1,
        borderColor: colors.border,
    },
    iconText: {
        fontSize: 24,
    },
    contactInfo: {
        flex: 1,
    },
    contactTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.text,
        marginBottom: 2,
    },
    contactSubtitle: {
        fontSize: 14,
        color: colors.primary,
    },
    chevron: {
        fontSize: 24,
        color: colors.textSecondary,
    },
    faqCard: {
        marginBottom: spacing.md,
        padding: spacing.lg,
    },
    faqQuestion: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.text,
        marginBottom: spacing.sm,
    },
    faqAnswer: {
        fontSize: 14,
        color: colors.textSecondary,
        lineHeight: 20,
    },
});

export default HelpSupportScreen;
