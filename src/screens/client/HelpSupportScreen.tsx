import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Linking,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, CommonActions } from '@react-navigation/native';
import { useMenuBackHandler } from '../../hooks/useMenuBackHandler';
import { safeGoBack } from '../../navigation/navigationUtils';
import { Card, Button } from '../../components/ui';
import { ScreenBackground } from '../../components/ui';
import { colors, spacing } from '../../theme';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

export function HelpSupportScreen() {
    const navigation = useNavigation<any>();
    const handleBack = useMenuBackHandler();
    const { user, profile } = useAuth();

    const [supportPhone, setSupportPhone] = useState<string>('');
    const [supportEmail, setSupportEmail] = useState<string>('');
    const [ownerProfile, setOwnerProfile] = useState<any>(null);
    const [loadingChat, setLoadingChat] = useState(false);
    const [loadingSettings, setLoadingSettings] = useState(true);

    useEffect(() => {
        loadSupportSettings();
    }, []);

    const loadSupportSettings = async () => {
        try {
            // 1. Find the owner's profile
            const { data: ownerData } = await supabase
                .from('profiles')
                .select('id, full_name, avatar_url, role')
                .eq('role', 'owner')
                .limit(1)
                .single();

            if (ownerData) {
                setOwnerProfile(ownerData);

                // 2. Load support settings from owner's master_settings
                const { data: settingsData } = await (supabase as any)
                    .from('master_settings')
                    .select('support_phone, support_email')
                    .eq('master_id', ownerData.id)
                    .single();

                if (settingsData) {
                    if (settingsData.support_phone) setSupportPhone(settingsData.support_phone);
                    if (settingsData.support_email) setSupportEmail(settingsData.support_email);
                }
            }
        } catch (error) {
            console.error('Error loading support settings:', error);
        } finally {
            setLoadingSettings(false);
        }
    };

    const handleChatWithSupport = async () => {
        if (!user?.id || !ownerProfile?.id) return;

        // Don't open a chat with yourself if you're the owner
        if (user.id === ownerProfile.id) return;

        setLoadingChat(true);
        try {
            const isUserMaster = profile?.is_master || profile?.role === 'master';
            const field1 = isUserMaster ? 'master_id' : 'client_id';
            const field2 = isUserMaster ? 'client_id' : 'master_id';

            // Check if a conversation with the owner already exists
            const { data: existing } = await (supabase as any)
                .from('conversations')
                .select('id')
                .eq(field1, user.id)
                .eq(field2, ownerProfile.id)
                .single();

            let conversationId = existing?.id;

            // Create if doesn't exist
            if (!conversationId) {
                const insertData = isUserMaster
                    ? { master_id: user.id, client_id: ownerProfile.id }
                    : { client_id: user.id, master_id: ownerProfile.id };

                const { data: newConv, error } = await (supabase as any)
                    .from('conversations')
                    .insert(insertData)
                    .select()
                    .single();

                if (error) throw error;
                conversationId = newConv.id;
            }

            // Navigate to Chat screen with isSupportChat flag
            navigation.dispatch(
                CommonActions.navigate({
                    name: 'Chat',
                    params: {
                        conversationId,
                        otherUser: {
                            full_name: ownerProfile.full_name,
                            avatar_url: ownerProfile.avatar_url,
                            id: ownerProfile.id,
                        },
                        isSupportChat: true,
                    },
                })
            );
        } catch (error) {
            console.error('Error opening support chat:', error);
        } finally {
            setLoadingChat(false);
        }
    };

    const faqs = [
        {
            question: 'How do I book an appointment?',
            answer: 'Navigate to the Book tab, select "Book New", choose your desired service, select a Master, pick your date and time, and confirm your booking.'
        },
        {
            question: 'Can I cancel or reschedule my appointment?',
            answer: 'Yes. Navigate to the Book tab, select the "Appointments" sub-tab, tap the appointment you wish to change, and select Cancel or Reschedule. Please note that cancellations or reschedules within 24 hours of your appointment may incur a 50% penalty fee.'
        },
        {
            question: 'How do deposits work?',
            answer: 'Some services require a deposit at the time of booking. The deposit is applied toward your total service cost. The remaining balance is due at the salon on the day of your appointment.'
        },
        {
            question: 'What payment methods are accepted?',
            answer: 'We accept all major credit and debit cards through our secure Stripe payment system. You can save and manage your cards under Menu > Payment.'
        },
        {
            question: 'How do I earn loyalty points?',
            answer: 'Earn points by scanning the Master\'s QR code at the salon using the in-app scanner after your service. You can view your stamp cards and track your rewards under Menu > Loyalty.'
        },
        {
            question: 'How do I update my profile or security settings?',
            answer: 'Go to Menu > Edit Profile to update your name, photo, and bio. Security settings (like password changes) can be managed under Settings.'
        },
        {
            question: 'How do refunds work?',
            answer: 'Refunds are processed by the salon owner. If eligible, refunds are returned to your original payment method and typically appear within 5-10 business days.'
        },
        {
            question: 'How do I access courses in the Academy?',
            answer: 'Navigate to the Academy tab. You can browse and purchase courses, watch video lessons, track your progress, and submit your homework assignments directly from the app.'
        },
        {
            question: 'How does the Shop and shipping work?',
            answer: 'Tap the Shop tab to browse products. Fill in your European shipping address and check out securely. You can view and track your purchases under Menu > Orders.'
        },
        {
            question: 'What are photo consultations?',
            answer: 'If a Master requires a pre-service assessment, you can submit a photo consultation request. Navigate to the Book tab, upload your photos, and once approved, you will be able to book.'
        }
    ];

    const isOwner = profile?.role === 'owner';

    // Show real values, or "Not set up yet" after loading, or "Loading…" while still loading
    const displayPhone = loadingSettings
        ? 'Loading…'
        : supportPhone || (isOwner ? 'Not configured — tap Support Settings' : 'Not available yet');
    const displayEmail = loadingSettings
        ? 'Loading…'
        : supportEmail || (isOwner ? 'Not configured — tap Support Settings' : 'Not available yet');

    const handleChatAction = () => {
        if (isOwner) {
            // Owner taps this → go to Support Settings to configure
            navigation.navigate('SupportSettings');
        } else {
            handleChatWithSupport();
        }
    };

    const contactOptions = [
        {
            icon: '💬',
            title: isOwner ? 'Support Settings' : 'Chat with Support',
            subtitle: isOwner
                ? 'Configure your support contact details'
                : loadingChat
                    ? 'Opening chat…'
                    : 'Get help from our team',
            action: handleChatAction,
            loading: loadingChat && !isOwner,
        },
        {
            icon: '📞',
            title: 'Call Us',
            subtitle: displayPhone,
            action: () => {
                if (supportPhone) Linking.openURL(`tel:${supportPhone.replace(/\s/g, '')}`);
            },
            loading: false,
        },
        {
            icon: '✉️',
            title: 'Email Support',
            subtitle: displayEmail,
            action: () => {
                if (supportEmail) Linking.openURL(`mailto:${supportEmail}`);
            },
            loading: false,
        },
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
                    {/* Fallback Warning Banner */}
                    <View style={styles.fallbackContainer}>
                        <Text style={styles.fallbackIcon}>💡</Text>
                        <Text style={styles.fallbackText}>
                            If a feature is not working as expected, please try the website.
                        </Text>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Contact Us</Text>
                        {contactOptions.map((option, index) => (
                            <TouchableOpacity
                                key={index}
                                onPress={option.action}
                                disabled={option.loading || loadingSettings}
                            >
                                <Card style={styles.contactCard} variant="glass">
                                    <View style={styles.contactIcon}>
                                        {option.loading ? (
                                            <ActivityIndicator size="small" color={colors.primary} />
                                        ) : (
                                            <Text style={styles.iconText}>{option.icon}</Text>
                                        )}
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
    fallbackContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.md,
        borderRadius: 12,
        marginBottom: spacing.lg,
        borderWidth: 1,
        borderColor: colors.borderLight,
        backgroundColor: colors.surfaceLight,
        borderLeftWidth: 4,
        borderLeftColor: colors.warning,
        gap: spacing.sm,
    },
    fallbackText: {
        flex: 1,
        fontSize: 14,
        color: colors.textSecondary,
        lineHeight: 20,
    },
    fallbackIcon: {
        fontSize: 18,
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
