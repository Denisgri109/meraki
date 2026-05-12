import React, { useState, useEffect } from 'react';
import {
    View,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    ActivityIndicator,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Card, Button, ScreenBackground, MerakiText } from '../../components/ui';
import { useModal } from '../../contexts/ModalContext';
import { colors, spacing } from '../../theme';

interface SupportSettings {
    support_phone: string;
    support_email: string;
    auto_reply_message: string;
}

const DEFAULT_SETTINGS: SupportSettings = {
    support_phone: '',
    support_email: '',
    auto_reply_message:
        'Thank you for reaching out to Merakí Support! 💛\n\nWe\'ve received your message and will get back to you within 24–48 business hours.\n\nIf your matter is urgent, please call us directly or send an email using the contact details on the Help & Support page.',
};

export function SupportSettingsScreen() {
    const navigation = useNavigation();
    const { user, profile } = useAuth();
    const { showAlert } = useModal();

    const [settings, setSettings] = useState<SupportSettings>(DEFAULT_SETTINGS);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        if (!user) return;
        setLoading(true);
        try {
            const { data, error } = await (supabase as any)
                .from('master_settings')
                .select('support_phone, support_email, auto_reply_message')
                .eq('master_id', user.id)
                .single();

            if (error && error.code !== 'PGRST116') {
                console.error('Error loading support settings:', error);
            }

            if (data) {
                setSettings({
                    support_phone: data.support_phone || '',
                    support_email: data.support_email || '',
                    auto_reply_message: data.auto_reply_message || DEFAULT_SETTINGS.auto_reply_message,
                });
            }
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!user) return;

        // Basic validation
        if (!settings.support_phone.trim()) {
            showAlert('Missing Phone', 'Please enter a support phone number.', 'error');
            return;
        }
        if (!settings.support_email.trim()) {
            showAlert('Missing Email', 'Please enter a support email address.', 'error');
            return;
        }
        if (!settings.support_email.includes('@')) {
            showAlert('Invalid Email', 'Please enter a valid email address.', 'error');
            return;
        }

        setSaving(true);
        try {
            const { error } = await (supabase as any)
                .from('master_settings')
                .upsert(
                    {
                        master_id: user.id,
                        support_phone: settings.support_phone.trim(),
                        support_email: settings.support_email.trim(),
                        auto_reply_message: settings.auto_reply_message.trim() || DEFAULT_SETTINGS.auto_reply_message,
                        updated_at: new Date().toISOString(),
                    },
                    { onConflict: 'master_id' }
                );

            if (error) throw error;

            showAlert('Saved', 'Your support contact details have been updated!', 'success');
        } catch (error: any) {
            showAlert('Error', error.message || 'Failed to save support settings.', 'error');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <ScreenBackground>
                <SafeAreaView style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <MerakiText style={styles.loadingText}>Loading support settings…</MerakiText>
                </SafeAreaView>
            </ScreenBackground>
        );
    }

    return (
        <ScreenBackground>
            <SafeAreaView style={styles.container} edges={['top']}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <View>
                        <MerakiText variant="h1">Support Settings</MerakiText>
                        <MerakiText variant="caption" color={colors.textSecondary}>
                            Configure contact details shown to clients
                        </MerakiText>
                    </View>
                </View>

                <ScrollView
                    style={styles.content}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 120 }}
                >
                    {/* Info Banner */}
                    <Card style={styles.infoBanner} variant="glass">
                        <View style={styles.infoBannerRow}>
                            <MaterialCommunityIcons name="information-outline" size={20} color={colors.primary} />
                            <MerakiText style={styles.infoBannerText}>
                                These details are displayed on the Help & Support page that clients see. When clients press "Chat with Support", they'll be directed to a conversation with you.
                            </MerakiText>
                        </View>
                    </Card>

                    {/* Phone Number */}
                    <Card style={styles.settingCard} variant="elevated">
                        <View style={styles.settingHeader}>
                            <View style={styles.settingIconWrap}>
                                <MaterialCommunityIcons name="phone" size={22} color={colors.primary} />
                            </View>
                            <View style={styles.settingHeaderText}>
                                <MerakiText variant="bodyBold">Support Phone Number</MerakiText>
                                <MerakiText variant="caption" color={colors.textSecondary}>
                                    Clients can call this number directly
                                </MerakiText>
                            </View>
                        </View>
                        <TextInput
                            style={styles.input}
                            value={settings.support_phone}
                            onChangeText={(text) => setSettings({ ...settings, support_phone: text })}
                            placeholder="e.g. +353 87 123 4567"
                            placeholderTextColor={colors.textMuted}
                            keyboardType="phone-pad"
                            autoCapitalize="none"
                        />
                    </Card>

                    {/* Email */}
                    <Card style={styles.settingCard} variant="elevated">
                        <View style={styles.settingHeader}>
                            <View style={styles.settingIconWrap}>
                                <MaterialCommunityIcons name="email-outline" size={22} color={colors.primary} />
                            </View>
                            <View style={styles.settingHeaderText}>
                                <MerakiText variant="bodyBold">Support Email</MerakiText>
                                <MerakiText variant="caption" color={colors.textSecondary}>
                                    Clients can email this address for help
                                </MerakiText>
                            </View>
                        </View>
                        <TextInput
                            style={styles.input}
                            value={settings.support_email}
                            onChangeText={(text) => setSettings({ ...settings, support_email: text })}
                            placeholder="e.g. support@meraki.com"
                            placeholderTextColor={colors.textMuted}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            autoCorrect={false}
                        />
                    </Card>

                    {/* Auto-Reply Message */}
                    <Card style={styles.settingCard} variant="elevated">
                        <View style={styles.settingHeader}>
                            <View style={styles.settingIconWrap}>
                                <MaterialCommunityIcons name="robot-outline" size={22} color={colors.primary} />
                            </View>
                            <View style={styles.settingHeaderText}>
                                <MerakiText variant="bodyBold">Auto-Reply Message</MerakiText>
                                <MerakiText variant="caption" color={colors.textSecondary}>
                                    Sent automatically when a client messages you via support
                                </MerakiText>
                            </View>
                        </View>
                        <TextInput
                            style={[styles.input, styles.multilineInput]}
                            value={settings.auto_reply_message}
                            onChangeText={(text) => setSettings({ ...settings, auto_reply_message: text })}
                            placeholder="Enter your auto-reply message..."
                            placeholderTextColor={colors.textMuted}
                            multiline
                            numberOfLines={6}
                            textAlignVertical="top"
                        />
                    </Card>
                </ScrollView>

                {/* Save Button */}
                <View style={styles.bottomBar}>
                    <Button
                        title={saving ? 'Saving…' : 'Save Support Settings'}
                        onPress={handleSave}
                        fullWidth
                        disabled={saving}
                    />
                </View>
            </SafeAreaView>
        </ScreenBackground>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingText: {
        marginTop: spacing.md,
        color: colors.textSecondary,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        gap: spacing.md,
    },
    backButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(0, 0, 0, 0.05)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.08)',
    },
    content: {
        flex: 1,
        paddingHorizontal: spacing.lg,
    },
    infoBanner: {
        padding: spacing.md,
        marginBottom: spacing.lg,
        borderLeftWidth: 3,
        borderLeftColor: colors.primary,
    },
    infoBannerRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: spacing.sm,
    },
    infoBannerText: {
        flex: 1,
        fontSize: 13,
        color: colors.textSecondary,
        lineHeight: 19,
    },
    settingCard: {
        marginBottom: spacing.md,
        padding: spacing.lg,
    },
    settingHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.md,
        gap: spacing.md,
    },
    settingIconWrap: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: 'rgba(212, 168, 83, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    settingHeaderText: {
        flex: 1,
    },
    input: {
        backgroundColor: 'rgba(0, 0, 0, 0.05)',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.08)',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm + 2,
        color: colors.text,
        fontSize: 15,
    },
    multilineInput: {
        minHeight: 120,
        paddingTop: spacing.sm + 2,
    },
    bottomBar: {
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        borderTopWidth: 1,
        borderTopColor: 'rgba(0, 0, 0, 0.05)',
    },
});

export default SupportSettingsScreen;
