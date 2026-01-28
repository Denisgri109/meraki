import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Dimensions, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import QRCode from 'react-native-qrcode-svg';
import { supabase } from '../../lib/supabase';
import { safeSupabaseFetch } from '../../lib/supabaseApi';
import { useAuth } from '../../contexts/AuthContext';
import { ScreenBackground, Card, Button } from '../../components/ui';
import { colors, spacing } from '../../theme';

const { width } = Dimensions.get('window');

export function LoyaltyQRScreen() {
    const navigation = useNavigation();
    const { user } = useAuth();
    const [qrCode, setQrCode] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [scansCount, setScansCount] = useState(0);

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
            // Get or create code
            const rpcPromise = (supabase as any).rpc('get_my_qr_code');
            const { data: code, error } = await safeSupabaseFetch(rpcPromise as Promise<any>, { timeout: 10000 });

            if (error) throw error;
            setQrCode(code as string);

            // Get stats
            const statsPromise = (supabase as any)
                .from('loyalty_qr_codes')
                .select('scans_count')
                .eq('user_id', user?.id)
                .single();

            const { data: stats } = await safeSupabaseFetch(statsPromise as Promise<any>, { timeout: 5000 });

            if (stats) setScansCount((stats as any).scans_count);

        } catch (error: any) {
            console.error('QR Setup Error:', error);
            Alert.alert('Error', 'Failed to generate QR code');
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
                    <Button
                        title="Close"
                        variant="ghost"
                        onPress={() => navigation.goBack()}
                        style={styles.closeBtn}
                    />
                    <Text style={styles.title}>Client Scanner</Text>
                    <View style={{ width: 60 }} />
                </View>

                <View style={styles.content}>
                    <Text style={styles.instruction}>
                        Ask your client to scan this code to earn points.
                    </Text>

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
                                <Text>Generating...</Text>
                            )}
                        </View>
                        <Text style={styles.securityNote}>
                            🔒 Code automatically rotates after each scan
                        </Text>
                    </Card>

                    <Card variant="glass" style={styles.statsCard}>
                        <Text style={styles.statsLabel}>Total Scans Today</Text>
                        <Text style={styles.statsValue}>{scansCount}</Text>
                        <Text style={styles.statsSub}>+50 points per scan</Text>
                    </Card>
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
    closeBtn: {
        minWidth: 60,
    },
    title: {
        fontSize: 18,
        fontWeight: '600',
        color: colors.text,
    },
    content: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.xl,
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
});

export default LoyaltyQRScreen;
