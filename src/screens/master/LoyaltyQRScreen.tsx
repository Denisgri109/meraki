import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator, Dimensions, Platform, ScrollView, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import QRCode from 'react-native-qrcode-svg';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { ScreenBackground, Card, Button, MerakiText } from '../../components/ui';
import { NfcPairingModal } from '../../components/loyalty';
import { colors, spacing } from '../../theme';

const { width } = Dimensions.get('window');

export function LoyaltyQRScreen() {
    const navigation = useNavigation();
    const { user, profile } = useAuth();
    const [qrCode, setQrCode] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [scansCount, setScansCount] = useState(0);
    const [showNfcModal, setShowNfcModal] = useState(false);

    // Owners and Masters can pair NFC tags (both give stamps to clients)
    const canPairNfc = profile?.role === 'owner' || profile?.role === 'master';

    useEffect(() => {
        if (user) {
            setupQR();
        }

        // Subscribe to changes to my QR code (for auto-rotation)
        const subscription = supabase
            .channel('my_qr_code')
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'loyalty_qr_codes',
                filter: `user_id=eq.${user?.id}`
            }, (payload) => {
                if (payload.new && payload.new.code) {
                    setQrCode(payload.new.code);
                    setScansCount(payload.new.scans_count);
                }
            })
            .subscribe();

        return () => {
            subscription.unsubscribe();
        };
    }, [user]);

    const setupQR = async () => {
        try {
            // For stamp cards, the QR code simply encodes the master ID
            // Format: stamp:{master_id}
            const stampQrValue = `stamp:${user?.id}`;
            setQrCode(stampQrValue);

            // Get stats - count how many stamps given today
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const { data: stats, error } = await (supabase as any)
                .from('stamp_history')
                .select('id, client_stamp_id!inner(master_id)')
                .eq('client_stamp_id.master_id', user?.id)
                .eq('action', 'earned')
                .gte('created_at', today.toISOString());

            if (!error && stats) {
                setScansCount(stats.length);
            }
        } catch (error: any) {
            console.error('QR Setup Error:', error);
            // Still show QR even if stats fail
            setQrCode(`stamp:${user?.id}`);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <ScreenBackground>
                <SafeAreaView style={styles.container}>
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={colors.primary} />
                    </View>
                </SafeAreaView>
            </ScreenBackground>
        );
    }

    return (
        <ScreenBackground>
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <MerakiText variant="h2">Stamp Card QR</MerakiText>
                    <View style={{ width: 60 }} />
                </View>

                <ScrollView
                    style={styles.scroll}
                    contentContainerStyle={styles.content}
                    showsVerticalScrollIndicator={false}
                >
                    <MerakiText variant="body" color={colors.textSecondary} style={styles.instruction}>
                        Ask your client to scan this code to collect a stamp on your loyalty card.
                    </MerakiText>

                    <Card style={styles.qrCard}>
                        <View style={styles.qrContainer}>
                            {qrCode ? (
                                <QRCode
                                    value={qrCode}
                                    size={width * 0.6}
                                    color="black"
                                    backgroundColor="white"
                                />
                            ) : (
                                <MerakiText variant="caption" color={colors.textMuted}>Generating...</MerakiText>
                            )}
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <MaterialCommunityIcons name="ticket-confirmation" size={14} color="#666" />
                            <MerakiText variant="caption" style={styles.securityNote}>Client scans this to collect stamps</MerakiText>
                        </View>
                    </Card>

                    <Card variant="glass" style={styles.statsCard}>
                        <MerakiText variant="caption" color={colors.textMuted}>Stamps Given Today</MerakiText>
                        <MerakiText variant="h1" color={colors.accent}>{scansCount}</MerakiText>
                        <MerakiText variant="caption" color={colors.textSecondary}>+1 stamp per appointment</MerakiText>
                    </Card>

                    {/* NFC Pairing - Owner & Master */}
                    {canPairNfc && Platform.OS !== 'web' && (
                        <Card variant="glass" style={styles.nfcCard}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.sm }}>
                                <MaterialCommunityIcons name="antenna" size={20} color={colors.accent} />
                                <MerakiText variant="body" color={colors.text} style={{ fontWeight: '600' }}>NFC Tag Pairing</MerakiText>
                            </View>
                            <MerakiText variant="caption" color={colors.textSecondary} style={{ textAlign: 'center', marginBottom: spacing.md }}>
                                Write your stamp link to an NFC sticker for instant client check-ins
                            </MerakiText>
                            <Button
                                title="Pair NFC Tag"
                                variant="primary"
                                onPress={() => setShowNfcModal(true)}
                                style={styles.nfcButton}
                            />
                        </Card>
                    )}
                </ScrollView>

                {/* NFC Pairing Modal */}
                <NfcPairingModal
                    visible={showNfcModal}
                    onClose={() => setShowNfcModal(false)}
                    masterId={user?.id || ''}
                />
            </SafeAreaView>
        </ScreenBackground >
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingTop: spacing.md,
    },
    backBtn: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.05)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        fontSize: 18,
        fontWeight: '600',
        color: colors.text,
    },
    scroll: {
        flex: 1,
    },
    content: {
        flexGrow: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.xl,
        paddingBottom: spacing.xxl * 2, // Extra padding for scrolling
    },
    instruction: {
        fontSize: 16,
        color: colors.textSecondary,
        textAlign: 'center',
        marginBottom: spacing.xl,
    },
    qrCard: {
        padding: spacing.xl,
        backgroundColor: 'white', // QR needs high contrast
        alignItems: 'center',
        marginBottom: spacing.xl,
    },
    qrContainer: {
        marginBottom: spacing.md,
    },
    securityNote: {
        fontSize: 12,
        color: '#666',
        textAlign: 'center',
    },
    statsCard: {
        width: '100%',
        alignItems: 'center',
        padding: spacing.lg,
    },
    statsLabel: {
        fontSize: 14,
        color: colors.textMuted,
        marginBottom: spacing.xs,
    },
    statsValue: {
        fontSize: 32,
        fontWeight: '700',
        color: colors.primary,
    },
    statsSub: {
        fontSize: 12,
        color: colors.textSecondary,
        marginTop: spacing.xs,
    },
    nfcCard: {
        width: '100%',
        padding: spacing.lg,
        marginTop: spacing.md,
        alignItems: 'center',
    },
    nfcTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.text,
        marginBottom: spacing.sm,
    },
    nfcDescription: {
        fontSize: 14,
        color: colors.textSecondary,
        textAlign: 'center',
        marginBottom: spacing.md,
    },
    nfcButton: {
        width: '100%',
    },
});

export default LoyaltyQRScreen;
