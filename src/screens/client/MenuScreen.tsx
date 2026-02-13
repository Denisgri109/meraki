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
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { colors, spacing, gradients } from '../../theme';
import { ScreenBackground, MerakiText } from '../../components/ui';
import { safeGoBack } from '../../navigation/navigationUtils';

const { width } = Dimensions.get('window');

export function MenuScreen() {
    const navigation = useNavigation<any>();
    const { profile, signOut } = useAuth();

    const handleNavigate = (screen: string) => {
        navigation.navigate('Home', { screen, params: { from: 'Menu' } });
    };

    return (
        <ScreenBackground>
            <SafeAreaView style={styles.safeArea} edges={['top']}>
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Header */}
                    <View style={styles.header}>
                        <TouchableOpacity style={styles.backBtn} onPress={() => safeGoBack(navigation, 'Home')}>
                            <MaterialIcons name="close" size={20} color="rgba(255,255,255,0.7)" />
                        </TouchableOpacity>
                        <MerakiText style={styles.headerTitle}>Menu</MerakiText>
                        <View style={{ width: 40 }} />
                    </View>

                    {/* Profile Card */}
                    <TouchableOpacity
                        style={styles.profileCard}
                        onPress={() => handleNavigate('Profile')}
                        activeOpacity={0.8}
                    >
                        <LinearGradient
                            colors={[...gradients.primary]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.profileGradient}
                        >
                            <View style={styles.profileAvatar}>
                                <Text style={styles.profileInitial}>
                                    {profile?.full_name?.[0] || 'U'}
                                </Text>
                            </View>
                            <View style={{ flex: 1 }}>
                                <MerakiText style={styles.profileName}>{profile?.full_name || 'Guest'}</MerakiText>
                                <MerakiText style={styles.profileRole}>
                                    {profile?.role === 'owner' ? 'Owner' : profile?.role === 'master' ? 'Beauty Master' : 'Client'}
                                </MerakiText>
                            </View>
                            <View style={styles.editBadge}>
                                <MaterialIcons name="edit" size={14} color="#fff" />
                            </View>
                        </LinearGradient>
                    </TouchableOpacity>

                    {/* Quick Actions */}
                    <MerakiText style={styles.sectionLabel}>QUICK ACTIONS</MerakiText>
                    <View style={styles.quickGrid}>
                        {[
                            { icon: 'receipt-long', label: 'My Orders', desc: 'View appointments', route: 'Orders' },
                            { icon: 'notifications-none', label: 'Notifications', desc: 'Stay updated', route: 'Notifications' },
                            { icon: 'star-outline', label: 'Loyalty', desc: 'Earn rewards', route: 'LoyaltyPoints' },
                            { icon: 'credit-card', label: 'Payment', desc: 'Manage cards', route: 'PaymentMethods' },
                            { icon: 'history', label: 'History', desc: 'Payment history', route: 'PaymentHistory' },
                        ].map((item) => (
                            <TouchableOpacity
                                key={item.label}
                                style={styles.quickCard}
                                onPress={() => handleNavigate(item.route)}
                                activeOpacity={0.7}
                            >
                                <View style={styles.quickIconWrap}>
                                    <MaterialIcons name={item.icon as any} size={22} color={colors.primary} />
                                </View>
                                <MerakiText style={styles.quickLabel}>{item.label}</MerakiText>
                                <MerakiText style={styles.quickDesc}>{item.desc}</MerakiText>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Support Section */}
                    <MerakiText style={styles.sectionLabel}>SUPPORT</MerakiText>
                    <View style={styles.listGroup}>
                        {[
                            { icon: 'help-outline', label: 'Help & Support', route: 'HelpSupport' },
                            { icon: 'description', label: 'Terms of Service', route: 'TermsOfService' },
                            { icon: 'shield', label: 'Privacy Policy', route: 'PrivacyPolicy' },
                        ].map((item, index) => (
                            <TouchableOpacity
                                key={item.label}
                                style={[styles.listItem, index === 2 && { borderBottomWidth: 0 }]}
                                onPress={() => handleNavigate(item.route)}
                            >
                                <View style={styles.listIconWrap}>
                                    <MaterialIcons name={item.icon as any} size={20} color="rgba(255,255,255,0.5)" />
                                </View>
                                <MerakiText style={styles.listLabel}>{item.label}</MerakiText>
                                <MaterialIcons name="chevron-right" size={20} color="rgba(255,255,255,0.2)" />
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Sign Out */}
                    <TouchableOpacity style={styles.signOutBtn} onPress={signOut} activeOpacity={0.7}>
                        <MaterialIcons name="logout" size={20} color="#EF4444" />
                        <MerakiText style={styles.signOutText}>Sign Out</MerakiText>
                    </TouchableOpacity>

                    <MerakiText style={styles.versionText}>Merakí App v1.2.0 • Build 42</MerakiText>
                </ScrollView>
            </SafeAreaView>
        </ScreenBackground>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1 },
    scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },

    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingVertical: 16,
    },
    backBtn: {
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
        alignItems: 'center', justifyContent: 'center',
    },
    headerTitle: { fontSize: 17, fontWeight: '600', color: '#fff' },

    // Profile Card
    profileCard: { marginBottom: 28, borderRadius: 20, overflow: 'hidden' },
    profileGradient: {
        flexDirection: 'row', alignItems: 'center', padding: 20, gap: 14,
    },
    profileAvatar: {
        width: 52, height: 52, borderRadius: 26,
        backgroundColor: 'rgba(255,255,255,0.2)',
        alignItems: 'center', justifyContent: 'center',
    },
    profileInitial: { fontSize: 22, fontWeight: '700', color: '#fff' },
    profileName: { fontSize: 18, fontWeight: '700', color: '#fff' },
    profileRole: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
    editBadge: {
        width: 32, height: 32, borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.2)',
        alignItems: 'center', justifyContent: 'center',
    },

    // Section Label
    sectionLabel: {
        fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.3)',
        letterSpacing: 1.5, marginBottom: 12,
    },

    // Quick Actions Grid
    quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 28 },
    quickCard: {
        width: (width - 50) / 2,
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
        padding: 16,
    },
    quickIconWrap: {
        width: 40, height: 40, borderRadius: 12,
        backgroundColor: 'rgba(200, 160, 77, 0.1)',
        alignItems: 'center', justifyContent: 'center', marginBottom: 10,
    },
    quickLabel: { fontSize: 14, fontWeight: '600', color: '#fff', marginBottom: 2 },
    quickDesc: { fontSize: 11, color: 'rgba(255,255,255,0.4)' },

    // List Group
    listGroup: {
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
        marginBottom: 28, overflow: 'hidden',
    },
    listItem: {
        flexDirection: 'row', alignItems: 'center',
        padding: 16, gap: 14,
        borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
    },
    listIconWrap: {
        width: 36, height: 36, borderRadius: 10,
        backgroundColor: 'rgba(255,255,255,0.05)',
        alignItems: 'center', justifyContent: 'center',
    },
    listLabel: { flex: 1, fontSize: 15, fontWeight: '500', color: '#fff' },

    // Sign Out
    signOutBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'rgba(239, 68, 68, 0.08)',
        borderRadius: 14, borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.2)',
        padding: 16, gap: 10, marginBottom: 20,
    },
    signOutText: { fontSize: 15, fontWeight: '600', color: '#EF4444' },

    versionText: { textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.2)' },
});

export default MenuScreen;
