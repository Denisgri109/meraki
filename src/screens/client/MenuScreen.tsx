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
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MenuStackParamList } from '../../navigation/ClientTabs';
import { colors, spacing, gradients } from '../../theme';
import { ScreenBackground, MerakiText } from '../../components/ui';
import { safeGoBack } from '../../navigation/navigationUtils';

const { width } = Dimensions.get('window');

type QuickAction = {
    icon: string;
    label: string;
    route: keyof MenuStackParamList;
    gradient: string[];
};

const QUICK_ACTIONS: QuickAction[] = [
    { icon: 'receipt-long', label: 'Orders', route: 'Orders', gradient: ['#8B5CF6', '#6D28D9'] },
    { icon: 'star-outline', label: 'Loyalty', route: 'StampCards', gradient: ['#F59E0B', '#D97706'] },
    { icon: 'credit-card', label: 'Payment', route: 'PaymentMethods', gradient: ['#3B82F6', '#2563EB'] },
    { icon: 'history', label: 'History', route: 'PaymentHistory', gradient: ['#10B981', '#059669'] },
];

export function MenuScreen() {
    const navigation = useNavigation<NativeStackNavigationProp<MenuStackParamList>>();
    const { profile, signOut } = useAuth();

    const handleNavigate = (screen: keyof MenuStackParamList) => {
        navigation.navigate(screen);
    };

    return (
        <ScreenBackground>
            <SafeAreaView style={styles.safeArea} edges={['top']}>
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    {/* ── Profile Header Row ── */}
                    <View style={styles.profileRow}>
                        <TouchableOpacity
                            style={styles.avatarWrap}
                            onPress={() => handleNavigate('Profile')}
                            activeOpacity={0.7}
                        >
                            <LinearGradient
                                colors={['#E8A0B4', '#C47A90']}
                                style={styles.avatarGradient}
                            >
                                <Text style={styles.avatarInitial}>
                                    {profile?.full_name?.[0] || 'U'}
                                </Text>
                            </LinearGradient>
                        </TouchableOpacity>

                        <View style={styles.profileInfo}>
                            <MerakiText style={styles.profileName}>
                                {profile?.full_name || 'Guest'}
                            </MerakiText>
                            <MerakiText style={styles.profileRole}>Client</MerakiText>
                        </View>

                        <View style={styles.headerActions}>
                            <TouchableOpacity
                                style={styles.headerIconBtn}
                                onPress={() => handleNavigate('Notifications')}
                                activeOpacity={0.7}
                            >
                                <MaterialIcons name="notifications-none" size={22} color="rgba(0, 0, 0, 0.55)" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* ── Quick Actions (horizontal scroll) ── */}
                    <MerakiText style={styles.sectionLabel}>QUICK ACTIONS</MerakiText>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.quickRow}
                        style={styles.quickRowOuter}
                    >
                        {QUICK_ACTIONS.map((item) => (
                            <TouchableOpacity
                                key={item.label}
                                style={styles.quickItem}
                                onPress={() => handleNavigate(item.route)}
                                activeOpacity={0.7}
                            >
                                <LinearGradient
                                    colors={item.gradient as [string, string]}
                                    style={styles.quickCircle}
                                >
                                    <MaterialIcons name={item.icon as any} size={22} color="#fff" />
                                </LinearGradient>
                                <MerakiText style={styles.quickLabel}>{item.label}</MerakiText>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>

                    {/* ── Account ── */}
                    <MerakiText style={styles.sectionLabel}>ACCOUNT</MerakiText>
                    <View style={styles.listGroup}>
                        {([
                            { icon: 'person', label: 'Edit Profile', route: 'Profile' },
                        ] as const).map((item, index) => (
                            <TouchableOpacity
                                key={item.label}
                                style={[styles.listItem, index === 0 && { borderBottomWidth: 0 }]}
                                onPress={() => handleNavigate(item.route as keyof MenuStackParamList)}
                            >
                                <View style={styles.listIconWrap}>
                                    <MaterialIcons name={item.icon as any} size={20} color="rgba(0, 0, 0, 0.40)" />
                                </View>
                                <MerakiText style={styles.listLabel}>{item.label}</MerakiText>
                                <MaterialIcons name="chevron-right" size={20} color="rgba(0, 0, 0, 0.12)" />
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* ── Support ── */}
                    <MerakiText style={styles.sectionLabel}>SUPPORT</MerakiText>
                    <View style={styles.listGroup}>
                        {([
                            { icon: 'help-outline', label: 'Help & Support', route: 'HelpSupport' },
                            { icon: 'description', label: 'Terms of Service', route: 'TermsOfService' },
                            { icon: 'shield', label: 'Privacy Policy', route: 'PrivacyPolicy' },
                        ] as const).map((item, index) => (
                            <TouchableOpacity
                                key={item.label}
                                style={[styles.listItem, index === 2 && { borderBottomWidth: 0 }]}
                                onPress={() => handleNavigate(item.route as keyof MenuStackParamList)}
                            >
                                <View style={styles.listIconWrap}>
                                    <MaterialIcons name={item.icon as any} size={20} color="rgba(0, 0, 0, 0.40)" />
                                </View>
                                <MerakiText style={styles.listLabel}>{item.label}</MerakiText>
                                <MaterialIcons name="chevron-right" size={20} color="rgba(0, 0, 0, 0.12)" />
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* ── Sign Out ── */}
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

    /* ── Profile Header Row ── */
    profileRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 20,
        gap: 14,
    },
    avatarWrap: { borderRadius: 28, overflow: 'hidden' },
    avatarGradient: {
        width: 56, height: 56, borderRadius: 28,
        alignItems: 'center', justifyContent: 'center',
    },
    avatarInitial: { fontSize: 22, fontWeight: '700', color: '#FFFFFF' },
    profileInfo: { flex: 1 },
    profileName: { fontSize: 18, fontWeight: '700', color: '#1A1A1A' },
    profileRole: { fontSize: 13, color: 'rgba(0, 0, 0, 0.40)', marginTop: 2 },
    headerActions: { flexDirection: 'row', gap: 8 },
    headerIconBtn: {
        width: 42, height: 42, borderRadius: 21,
        backgroundColor: 'rgba(0, 0, 0, 0.05)',
        borderWidth: 1, borderColor: 'rgba(0, 0, 0, 0.08)',
        alignItems: 'center', justifyContent: 'center',
    },

    /* ── Section Label ── */
    sectionLabel: {
        fontSize: 11, fontWeight: '700', color: 'rgba(0, 0, 0, 0.25)',
        letterSpacing: 1.5, marginBottom: 14, marginTop: 4,
    },

    /* ── Quick Actions Row ── */
    quickRowOuter: { marginBottom: 28, marginHorizontal: -20 },
    quickRow: { paddingHorizontal: 20, gap: 18 },
    quickItem: { alignItems: 'center', width: 68 },
    quickCircle: {
        width: 56, height: 56, borderRadius: 28,
        alignItems: 'center', justifyContent: 'center',
        marginBottom: 8,
    },
    quickLabel: { fontSize: 11, fontWeight: '600', color: 'rgba(0, 0, 0, 0.55)', textAlign: 'center' },

    /* ── List Group ── */
    listGroup: {
        backgroundColor: 'rgba(0, 0, 0, 0.03)',
        borderRadius: 16, borderWidth: 1, borderColor: 'rgba(0, 0, 0, 0.06)',
        marginBottom: 28, overflow: 'hidden',
    },
    listItem: {
        flexDirection: 'row', alignItems: 'center',
        padding: 16, gap: 14,
        borderBottomWidth: 1, borderBottomColor: 'rgba(0, 0, 0, 0.05)',
    },
    listIconWrap: {
        width: 36, height: 36, borderRadius: 10,
        backgroundColor: 'rgba(212,168,83,0.08)',
        alignItems: 'center', justifyContent: 'center',
    },
    listLabel: { flex: 1, fontSize: 15, fontWeight: '500', color: '#1A1A1A' },

    /* ── Sign Out ── */
    signOutBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'rgba(239, 68, 68, 0.08)',
        borderRadius: 14, borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.2)',
        padding: 16, gap: 10, marginBottom: 20,
    },
    signOutText: { fontSize: 15, fontWeight: '600', color: '#EF4444' },

    versionText: { textAlign: 'center', fontSize: 11, color: 'rgba(0, 0, 0, 0.12)' },
});

export default MenuScreen;
