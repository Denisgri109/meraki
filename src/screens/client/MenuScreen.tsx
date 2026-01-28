import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../contexts/AuthContext';
import { colors, spacing } from '../../theme';
import { ScreenBackground } from '../../components/ui';

const { width } = Dimensions.get('window');
const CARD_SIZE = (width - spacing.lg * 3) / 2;

type MenuItemProps = {
    icon: string;
    label: string;
    description?: string;
    onPress: () => void;
    variant?: 'default' | 'primary' | 'danger';
};

const MenuItem = ({ icon, label, description, onPress, variant = 'default' }: MenuItemProps) => (
    <TouchableOpacity
        style={[styles.menuCard, variant === 'danger' && styles.menuCardDanger]}
        onPress={onPress}
        activeOpacity={0.8}
    >
        <View style={[styles.iconContainer, variant === 'primary' && styles.iconContainerPrimary]}>
            <Text style={styles.icon}>{icon}</Text>
        </View>
        <Text style={[styles.menuLabel, variant === 'danger' && styles.menuLabelDanger]}>{label}</Text>
        {description && <Text style={styles.menuDescription}>{description}</Text>}
    </TouchableOpacity>
);

type SectionProps = {
    title: string;
    children: React.ReactNode;
};

const Section = ({ title, children }: SectionProps) => (
    <View style={styles.section}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <View style={styles.sectionContent}>{children}</View>
    </View>
);

export function MenuScreen() {
    const navigation = useNavigation<any>();
    const { profile, signOut } = useAuth();

    const handleNavigate = (screen: string) => {
        navigation.navigate('Home', { screen });
    };

    const handleSignOut = () => {
        signOut();
    };

    return (
        <ScreenBackground>
            <SafeAreaView style={styles.contentSafeArea} edges={['top']}>
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Header */}
                    <View style={styles.header}>
                        <TouchableOpacity style={styles.closeButton} onPress={() => navigation.goBack()}>
                            <Text style={styles.closeIcon}>✕</Text>
                        </TouchableOpacity>
                        <Text style={styles.title}>Menu</Text>
                        <View style={{ width: 40 }} />
                    </View>

                    {/* Profile Card */}
                    <LinearGradient
                        colors={[colors.primary, colors.secondary]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.profileCard}
                    >
                        <View style={styles.profileAvatar}>
                            <Text style={styles.profileAvatarText}>
                                {profile?.full_name?.[0] || 'U'}
                            </Text>
                        </View>
                        <View style={styles.profileInfo}>
                            <Text style={styles.profileName}>{profile?.full_name || 'Guest'}</Text>
                            <Text style={styles.profileRole}>
                                {profile?.role === 'admin' ? 'Owner' : profile?.role === 'master' ? 'Beauty Master' : 'Client'}
                            </Text>
                        </View>
                        <TouchableOpacity
                            style={styles.editButton}
                            onPress={() => handleNavigate('Profile')}
                        >
                            <Text style={styles.editButtonText}>Edit</Text>
                        </TouchableOpacity>
                    </LinearGradient>

                    {/* Quick Actions */}
                    <Section title="Quick Actions">
                        <View style={styles.grid}>
                            <MenuItem
                                icon="📅"
                                label="My Orders"
                                description="View appointments"
                                onPress={() => handleNavigate('Orders')}
                                variant="primary"
                            />
                            <MenuItem
                                icon="🔔"
                                label="Notifications"
                                description="Stay updated"
                                onPress={() => handleNavigate('Notifications')}
                            />
                            <MenuItem
                                icon="⭐"
                                label="Loyalty Points"
                                description="Earn rewards"
                                onPress={() => handleNavigate('LoyaltyPoints')}
                            />
                            <MenuItem
                                icon="💳"
                                label="Payment"
                                description="Manage cards"
                                onPress={() => handleNavigate('PaymentMethods')}
                            />
                            <MenuItem
                                icon="📊"
                                label="History"
                                description="Payment history"
                                onPress={() => handleNavigate('PaymentHistory')}
                            />
                        </View>
                    </Section>

                    {/* Support */}
                    <Section title="Support">
                        <View style={styles.listSection}>
                            <TouchableOpacity style={styles.listItem} onPress={() => handleNavigate('HelpSupport')}>
                                <Text style={styles.listIcon}>❓</Text>
                                <Text style={styles.listLabel}>Help & Support</Text>
                                <Text style={styles.listChevron}>›</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.listItem} onPress={() => handleNavigate('TermsOfService')}>
                                <Text style={styles.listIcon}>📜</Text>
                                <Text style={styles.listLabel}>Terms of Service</Text>
                                <Text style={styles.listChevron}>›</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.listItem} onPress={() => handleNavigate('PrivacyPolicy')}>
                                <Text style={styles.listIcon}>🔒</Text>
                                <Text style={styles.listLabel}>Privacy Policy</Text>
                                <Text style={styles.listChevron}>›</Text>
                            </TouchableOpacity>
                        </View>
                    </Section>

                    {/* Sign Out */}
                    <View style={styles.signOutSection}>
                        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
                            <Text style={styles.signOutIcon}>🚪</Text>
                            <Text style={styles.signOutText}>Sign Out</Text>
                        </TouchableOpacity>
                    </View>

                    {/* App Version */}
                    <Text style={styles.versionText}>Merakí App v1.2.0 • Build 42</Text>
                </ScrollView>
            </SafeAreaView>
        </ScreenBackground>
    );
}

const styles = StyleSheet.create({
    contentSafeArea: {
        flex: 1,
    },
    scrollContent: {
        padding: spacing.lg,
        paddingBottom: 40,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: spacing.lg,
    },
    closeButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
    },
    closeIcon: {
        fontSize: 16,
        color: colors.text,
    },
    title: {
        fontSize: 18,
        fontWeight: '600',
        color: colors.text,
    },
    profileCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.lg,
        borderRadius: 20,
        marginBottom: spacing.xl,
    },
    profileAvatar: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: 'rgba(255,255,255,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: spacing.md,
    },
    profileAvatarText: {
        fontSize: 24,
        fontWeight: '700',
        color: colors.text,
    },
    profileInfo: {
        flex: 1,
    },
    profileName: {
        fontSize: 18,
        fontWeight: '700',
        color: colors.text,
        marginBottom: 2,
    },
    profileRole: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.8)',
        fontWeight: '500',
    },
    editButton: {
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
    },
    editButtonText: {
        fontSize: 13,
        fontWeight: '600',
        color: colors.text,
    },
    section: {
        marginBottom: spacing.xl,
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: '700',
        color: colors.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 1.5,
        marginBottom: spacing.md,
    },
    sectionContent: {},
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.md,
    },
    menuCard: {
        width: CARD_SIZE,
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: spacing.lg,
        borderWidth: 1,
        borderColor: colors.border,
    },
    menuCardDanger: {
        borderColor: 'rgba(239, 68, 68, 0.3)',
    },
    iconContainer: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: 'rgba(139, 92, 246, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.sm,
    },
    iconContainerPrimary: {
        backgroundColor: colors.primary,
    },
    icon: {
        fontSize: 22,
    },
    menuLabel: {
        fontSize: 15,
        fontWeight: '600',
        color: colors.text,
        marginBottom: 2,
    },
    menuLabelDanger: {
        color: '#EF4444',
    },
    menuDescription: {
        fontSize: 12,
        color: colors.textMuted,
    },
    listSection: {
        backgroundColor: colors.surface,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: 'hidden',
    },
    listItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    listIcon: {
        fontSize: 18,
        marginRight: spacing.md,
    },
    listLabel: {
        flex: 1,
        fontSize: 15,
        color: colors.text,
        fontWeight: '500',
    },
    listChevron: {
        fontSize: 20,
        color: colors.textMuted,
    },
    signOutSection: {
        marginTop: spacing.md,
        marginBottom: spacing.lg,
    },
    signOutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        padding: spacing.md,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(239, 68, 68, 0.3)',
    },
    signOutIcon: {
        fontSize: 18,
        marginRight: spacing.sm,
    },
    signOutText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#EF4444',
    },
    versionText: {
        textAlign: 'center',
        fontSize: 12,
        color: colors.textMuted,
    },
});

export default MenuScreen;
