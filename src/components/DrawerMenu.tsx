import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Modal,
    Animated,
    Dimensions,
    Alert,
    ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { colors, spacing } from '../theme';

type DrawerMenuProps = {
    visible: boolean;
    onClose: () => void;
    onNavigate: (screen: string) => void;
};

type MenuItemProps = {
    icon: string;
    label: string;
    onPress: () => void;
    badge?: number;
};

const MenuItem = ({ icon, label, onPress, badge }: MenuItemProps) => (
    <TouchableOpacity style={styles.menuItem} onPress={onPress}>
        <View style={styles.menuIconContainer}>
            <Text style={styles.menuIcon}>{icon}</Text>
        </View>
        <Text style={styles.menuLabel}>{label}</Text>
        {badge !== undefined && badge > 0 && (
            <View style={styles.badge}>
                <Text style={styles.badgeText}>{badge}</Text>
            </View>
        )}
        <Text style={styles.menuArrow}>›</Text>
    </TouchableOpacity>
);

export function DrawerMenu({ visible, onClose, onNavigate }: DrawerMenuProps) {
    const { profile, signOut } = useAuth();
    const slideAnim = React.useRef(new Animated.Value(-300)).current;

    React.useEffect(() => {
        if (visible) {
            Animated.timing(slideAnim, {
                toValue: 0,
                duration: 300,
                useNativeDriver: true,
            }).start();
        } else {
            Animated.timing(slideAnim, {
                toValue: -300,
                duration: 300,
                useNativeDriver: true,
            }).start();
        }
    }, [visible]);

    const handleNavigate = (screen: string) => {
        onClose();
        // Use the onNavigate callback from parent
        onNavigate(screen);
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="none"
            onRequestClose={onClose}
        >
            <View style={styles.overlayContainer}>
                <TouchableOpacity
                    style={styles.backdrop}
                    activeOpacity={1}
                    onPress={onClose}
                />

                <Animated.View
                    style={[
                        styles.drawer,
                        { transform: [{ translateX: slideAnim }] }
                    ]}
                >
                    <SafeAreaView style={styles.drawerContent} edges={['top', 'bottom']}>
                        {/* Header */}
                        <View style={styles.header}>
                            <View style={styles.userInfo}>
                                <View style={styles.avatar}>
                                    <Text style={styles.avatarText}>
                                        {profile?.full_name?.[0] || 'U'}
                                    </Text>
                                </View>
                                <View style={styles.userDetails}>
                                    <Text style={styles.userName}>{profile?.full_name || 'Guest'}</Text>
                                    <Text style={styles.userRole}>
                                        {profile?.role === 'admin' ? 'Owner' : 'Client'}
                                    </Text>
                                </View>
                            </View>
                            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                                <Text style={styles.closeIcon}>✕</Text>
                            </TouchableOpacity>
                        </View>

                        <ScrollView
                            style={styles.scrollView}
                            contentContainerStyle={styles.scrollContent}
                            showsVerticalScrollIndicator={false}
                        >
                            {/* Quick Actions */}
                            <View style={styles.sectionHeader}>
                                <Text style={styles.sectionTitle}>QUICK ACTIONS</Text>
                            </View>

                            <MenuItem
                                icon="📅"
                                label="My Orders"
                                onPress={() => handleNavigate('Orders')}
                            />
                            <MenuItem
                                icon="🔔"
                                label="Notifications"
                                onPress={() => handleNavigate('Notifications')}
                                badge={2}
                            />
                            <MenuItem
                                icon="⭐"
                                label="Loyalty Points"
                                onPress={() => handleNavigate('LoyaltyPoints')}
                            />

                            {/* Support */}
                            <View style={styles.sectionHeader}>
                                <Text style={styles.sectionTitle}>SUPPORT</Text>
                            </View>

                            <MenuItem
                                icon="❓"
                                label="Help & Support"
                                onPress={() => handleNavigate('HelpSupport')}
                            />
                            <MenuItem
                                icon="📜"
                                label="Terms of Service"
                                onPress={() => handleNavigate('TermsOfService')}
                            />
                            <MenuItem
                                icon="🔒"
                                label="Privacy Policy"
                                onPress={() => handleNavigate('PrivacyPolicy')}
                            />

                            {/* Account */}
                            <View style={styles.sectionHeader}>
                                <Text style={styles.sectionTitle}>ACCOUNT</Text>
                            </View>

                            <MenuItem
                                icon="👤"
                                label="Profile Settings"
                                onPress={() => handleNavigate('Profile')}
                            />
                            <MenuItem
                                icon="💳"
                                label="Payment Methods"
                                onPress={() => handleNavigate('PaymentMethods')}
                            />
                        </ScrollView>

                        {/* Footer */}
                        <View style={styles.footer}>
                            <TouchableOpacity style={styles.logoutButton} onPress={() => { onClose(); signOut(); }}>
                                <Text style={styles.logoutIcon}>🚪</Text>
                                <Text style={styles.logoutText}>Sign Out</Text>
                            </TouchableOpacity>
                            <Text style={styles.versionText}>Merakí App v1.2.0 • Build 42</Text>
                        </View>
                    </SafeAreaView>
                </Animated.View>
            </View>
        </Modal>
    );
}

const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
    overlayContainer: {
        flex: 1,
        flexDirection: 'row',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    drawer: {
        width: width * 0.85,
        maxWidth: 340,
        height: '100%',
        backgroundColor: colors.background,
        borderRightWidth: 1,
        borderRightColor: 'rgba(255,255,255,0.1)',
        shadowColor: "#000",
        shadowOffset: {
            width: 5,
            height: 0,
        },
        shadowOpacity: 0.5,
        shadowRadius: 10,
        elevation: 20,
    },
    drawerContent: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: spacing.lg,
        paddingTop: spacing.xl,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.1)',
        backgroundColor: 'rgba(255,255,255,0.02)',
    },
    userInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    avatar: {
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
    avatarText: {
        fontSize: 20,
        fontWeight: '600',
        color: colors.text,
    },
    userDetails: {
        flex: 1,
    },
    userName: {
        fontSize: 18,
        fontWeight: '700',
        color: colors.text,
        marginBottom: 2,
    },
    userRole: {
        fontSize: 12,
        color: colors.primary,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    closeButton: {
        width: 32,
        height: 32,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    closeIcon: {
        fontSize: 14,
        color: colors.text,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingVertical: spacing.md,
    },
    sectionHeader: {
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.lg,
        paddingBottom: spacing.sm,
    },
    sectionTitle: {
        fontSize: 11,
        fontWeight: '700',
        color: colors.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 2,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
    },
    menuIconContainer: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: 'rgba(255,255,255,0.03)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: spacing.md,
    },
    menuIcon: {
        fontSize: 18,
    },
    menuLabel: {
        flex: 1,
        fontSize: 16,
        color: colors.text,
        fontWeight: '500',
    },
    menuArrow: {
        fontSize: 18,
        color: 'rgba(255,255,255,0.2)',
    },
    badge: {
        backgroundColor: colors.primary,
        borderRadius: 10,
        paddingHorizontal: 8,
        paddingVertical: 2,
        marginRight: spacing.sm,
    },
    badgeText: {
        color: '#fff',
        fontSize: 11,
        fontWeight: '700',
    },
    footer: {
        padding: spacing.lg,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.1)',
        backgroundColor: 'rgba(255,255,255,0.02)',
    },
    logoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        paddingVertical: spacing.md,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(239, 68, 68, 0.3)',
        marginBottom: spacing.md,
    },
    logoutIcon: {
        fontSize: 18,
        marginRight: spacing.sm,
    },
    logoutText: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.error,
    },
    versionText: {
        textAlign: 'center',
        fontSize: 11,
        color: 'rgba(255,255,255,0.3)',
    },
});

export default DrawerMenu;
