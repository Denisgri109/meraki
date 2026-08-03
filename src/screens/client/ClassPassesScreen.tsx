import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import { useModal } from '../../contexts/ModalContext';
import { Card, ScreenBackground } from '../../components/ui';
import { colors, spacing } from '../../theme';
import { useConfirmPayment, CardField, isStripeAvailable } from '../../utils/stripe';
import { createPaymentIntent } from '../../services/stripeService';
import {
    finalizePassPurchase,
    getActivePassSummary,
    getMyLedger,
    getMyPasses,
    listActivePackages,
    ClassPackage,
    PassWithPackage,
    CreditLedger,
} from '../../services/classPassService';

function formatExpiry(expiresAt: string | null): string {
    if (!expiresAt) return 'No expiry';
    const d = new Date(expiresAt);
    const days = Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (days <= 0) return 'Expired';
    if (days === 1) return 'Expires tomorrow';
    if (days < 30) return `Expires in ${days} days`;
    return `Expires ${d.toLocaleDateString('en-IE', { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

function ledgerLabel(row: CreditLedger): string {
    switch (row.reason) {
        case 'purchase': return row.note || 'Purchased package';
        case 'booking': return row.note || 'Booked a class';
        case 'cancel_refund': return row.note || 'Refund — cancellation';
        case 'manual_grant': return row.note || 'Grant by owner';
        case 'expiry_adjustment': return row.note || 'Expiry adjustment';
        default: return row.note || row.reason;
    }
}

export function ClassPassesScreen() {
    const navigation = useNavigation<any>();
    const { user, profile } = useAuth();
    const { showAlert } = useModal();
    const { confirmPayment } = useConfirmPayment();

    const [passes, setPasses] = useState<PassWithPackage[]>([]);
    const [ledger, setLedger] = useState<CreditLedger[]>([]);
    const [catalog, setCatalog] = useState<ClassPackage[]>([]);
    const [loading, setLoading] = useState(true);
    const [buyingPackage, setBuyingPackage] = useState<ClassPackage | null>(null);
    const [paying, setPaying] = useState(false);
    const [cardComplete, setCardComplete] = useState(false);

    const loadAll = useCallback(async () => {
        if (!user?.id) return;
        setLoading(true);
        try {
            const [passesData, ledgerData, catalogData] = await Promise.all([
                getMyPasses(user.id),
                getMyLedger(user.id),
                listActivePackages(),
            ]);
            setPasses(passesData);
            setLedger(ledgerData);
            setCatalog(catalogData);
        } catch (error: any) {
            showAlert('Error', error.message || 'Failed to load passes', 'error');
        } finally {
            setLoading(false);
        }
    }, [user?.id, showAlert]);

    useFocusEffect(
        useCallback(() => {
            loadAll();
        }, [loadAll])
    );

    const isPassUsable = (p: PassWithPackage) =>
        p.status === 'active' && p.remaining_credits > 0 && (!p.expires_at || new Date(p.expires_at) > new Date());

    const totalCredits = passes.filter(isPassUsable).reduce((sum, p) => sum + p.remaining_credits, 0);
    const activePasses = passes.filter(isPassUsable);
    const pastPasses = passes.filter((p) => !isPassUsable(p));

    const handleBuy = async () => {
        if (!buyingPackage || !user?.id) return;
        if (!isStripeAvailable()) {
            showAlert('Payments unavailable', 'Stripe is not configured on this build.', 'error');
            return;
        }
        if (!cardComplete) {
            showAlert('Card required', 'Please enter your card details to continue.', 'error');
            return;
        }

        setPaying(true);
        try {
            const { clientSecret, paymentIntentId } = await createPaymentIntent({
                amount: buyingPackage.price_cents,
                customerId: profile?.stripe_customer_id || undefined,
                description: `Class package: ${buyingPackage.name}`,
                captureMethod: 'automatic',
            });

            const paymentResult = await confirmPayment(clientSecret, {
                paymentMethodType: 'Card',
            });
            if (paymentResult.error) throw new Error(paymentResult.error.message);

            const finalizeData = await finalizePassPurchase(buyingPackage.id, paymentIntentId);
            showAlert(
                'Pass activated',
                finalizeData?.already_granted
                    ? 'Your pass was already activated.'
                    : `${buyingPackage.total_credits} classes added to your balance!`,
                'success'
            );
            setBuyingPackage(null);
            loadAll();
        } catch (error: any) {
            showAlert('Payment failed', error.message || 'Something went wrong.', 'error');
        } finally {
            setPaying(false);
        }
    };

    return (
        <ScreenBackground>
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <MaterialIcons name="arrow-back" size={22} color={colors.text} />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.title}>My Class Passes</Text>
                        <Text style={styles.subtitle}>Buy a bundle, redeem credits on Pilates classes</Text>
                    </View>
                </View>

                {loading ? (
                    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                        <ActivityIndicator size="large" color={colors.text} />
                    </View>
                ) : (
                    <ScrollView contentContainerStyle={styles.content}>
                        {/* Balance card */}
                        <Card style={styles.balanceCard}>
                            <View style={styles.balanceIcon}>
                                <MaterialCommunityIcons name="ticket-confirmation-outline" size={28} color="#FFF" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.balanceLabel}>AVAILABLE CREDITS</Text>
                                <Text style={styles.balanceValue}>{totalCredits}</Text>
                            </View>
                        </Card>

                        {/* Active passes */}
                        <Text style={styles.sectionTitle}>ACTIVE PASSES</Text>
                        {activePasses.length === 0 ? (
                            <Card style={styles.emptyCard}>
                                <MaterialCommunityIcons name="ticket-outline" size={32} color={colors.textMuted} />
                                <Text style={styles.emptyTitle}>No active passes yet</Text>
                                <Text style={styles.emptyText}>Buy your first pass below to start booking classes with credits.</Text>
                            </Card>
                        ) : (
                            activePasses.map((pass) => {
                                const pct = pass.initial_credits > 0
                                    ? Math.round((pass.remaining_credits / pass.initial_credits) * 100)
                                    : 0;
                                return (
                                    <Card key={pass.id} style={styles.passCard}>
                                        <View style={styles.passTopRow}>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.passName}>{pass.class_packages?.name ?? 'Class Pass'}</Text>
                                                <View style={styles.passExpiryRow}>
                                                    <MaterialIcons name="schedule" size={12} color={colors.textMuted} />
                                                    <Text style={styles.passExpiry}>{formatExpiry(pass.expires_at)}</Text>
                                                </View>
                                            </View>
                                            <View style={styles.activePill}>
                                                <Text style={styles.activePillText}>ACTIVE</Text>
                                            </View>
                                        </View>
                                        <View style={styles.passCountRow}>
                                            <Text style={styles.passRemaining}>{pass.remaining_credits}</Text>
                                            <Text style={styles.passTotal}>/ {pass.initial_credits} left</Text>
                                        </View>
                                        <View style={styles.progressTrack}>
                                            <View style={[styles.progressFill, { width: `${pct}%` }]} />
                                        </View>
                                    </Card>
                                );
                            })
                        )}

                        {/* Transaction history */}
                        <Text style={styles.sectionTitle}>TRANSACTION HISTORY</Text>
                        {ledger.length === 0 ? (
                            <Card style={styles.emptyCard}>
                                <Text style={styles.emptyText}>No transactions yet.</Text>
                            </Card>
                        ) : (
                            <Card style={{ paddingVertical: spacing.xs }}>
                                {ledger.map((row, idx) => {
                                    const positive = row.delta > 0;
                                    return (
                                        <View
                                            key={row.id}
                                            style={[styles.ledgerRow, idx > 0 && styles.ledgerDivider]}
                                        >
                                            <View style={[styles.ledgerIcon, positive ? styles.ledgerIconPos : styles.ledgerIconNeg]}>
                                                <MaterialIcons
                                                    name={positive ? 'add' : 'remove'}
                                                    size={14}
                                                    color={positive ? '#059669' : '#E11D48'}
                                                />
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.ledgerLabel} numberOfLines={1}>{ledgerLabel(row)}</Text>
                                                <Text style={styles.ledgerDate}>
                                                    {new Date(row.created_at).toLocaleString('en-IE', {
                                                        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                                                    })}
                                                </Text>
                                            </View>
                                            <View style={{ alignItems: 'flex-end' }}>
                                                <Text style={[styles.ledgerDelta, positive ? styles.ledgerDeltaPos : styles.ledgerDeltaNeg]}>
                                                    {positive ? '+' : ''}{row.delta}
                                                </Text>
                                                <Text style={styles.ledgerBalance}>bal {row.balance_after}</Text>
                                            </View>
                                        </View>
                                    );
                                })}
                            </Card>
                        )}

                        {/* Buy a package */}
                        <Text style={styles.sectionTitle}>BUY A PACKAGE</Text>
                        {catalog.length === 0 ? (
                            <Card style={styles.emptyCard}>
                                <MaterialIcons name="error-outline" size={28} color="#F59E0B" />
                                <Text style={styles.emptyText}>
                                    No class packages are available for purchase right now. Please check back later.
                                </Text>
                            </Card>
                        ) : (
                            catalog.map((pkg) => (
                                <Card key={pkg.id} style={styles.packageCard}>
                                    <View style={styles.packageTopRow}>
                                        <View style={styles.packageIcon}>
                                            <MaterialCommunityIcons name="layers-outline" size={16} color="#FFF" />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.packageName}>{pkg.name}</Text>
                                            {!!pkg.description && (
                                                <Text style={styles.packageDesc} numberOfLines={2}>{pkg.description}</Text>
                                            )}
                                        </View>
                                    </View>
                                    <View style={styles.packageMetaRow}>
                                        <View style={styles.metaItem}>
                                            <MaterialIcons name="layers" size={12} color={colors.textMuted} />
                                            <Text style={styles.metaText}>{pkg.total_credits} classes</Text>
                                        </View>
                                        <View style={styles.metaItem}>
                                            <MaterialIcons name="schedule" size={12} color={colors.textMuted} />
                                            <Text style={styles.metaText}>{pkg.validity_days ? `${pkg.validity_days}d` : 'No expiry'}</Text>
                                        </View>
                                        {pkg.total_credits > 0 && (
                                            <Text style={styles.metaText}>
                                                €{((pkg.price_cents / pkg.total_credits) / 100).toFixed(2)} / class
                                            </Text>
                                        )}
                                    </View>
                                    <View style={styles.packageBottomRow}>
                                        <Text style={styles.packagePrice}>€{(pkg.price_cents / 100).toFixed(2)}</Text>
                                        <TouchableOpacity
                                            style={styles.buyButton}
                                            onPress={() => setBuyingPackage(pkg)}
                                        >
                                            <MaterialIcons name="add" size={16} color="#FFF" />
                                            <Text style={styles.buyButtonText}>Buy</Text>
                                        </TouchableOpacity>
                                    </View>
                                </Card>
                            ))
                        )}
                    </ScrollView>
                )}

                {/* Buy modal */}
                <Modal
                    visible={!!buyingPackage}
                    transparent
                    animationType="slide"
                    onRequestClose={() => !paying && setBuyingPackage(null)}
                >
                    <View style={styles.modalBackdrop}>
                        <View style={styles.modalSheet}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>Buy pass</Text>
                                <TouchableOpacity
                                    onPress={() => setBuyingPackage(null)}
                                    disabled={paying}
                                    style={styles.closeButton}
                                >
                                    <MaterialIcons name="close" size={18} color={colors.textSecondary} />
                                </TouchableOpacity>
                            </View>

                            {buyingPackage && (
                                <View style={styles.modalBody}>
                                    <View style={styles.buySummary}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.buyName}>{buyingPackage.name}</Text>
                                            <Text style={styles.buySub}>{buyingPackage.total_credits} classes</Text>
                                        </View>
                                        <Text style={styles.buyPrice}>€{(buyingPackage.price_cents / 100).toFixed(2)}</Text>
                                    </View>

                                    <View style={styles.cardContainer}>
                                        <CardField
                                            postalCodeEnabled={false}
                                            placeholders={{ number: '4242 4242 4242 4242' }}
                                            cardStyle={{
                                                backgroundColor: colors.surface,
                                                textColor: colors.text,
                                                placeholderColor: colors.textMuted,
                                                borderWidth: 1,
                                                borderColor: colors.border,
                                                borderRadius: 12,
                                            }}
                                            style={styles.cardField}
                                            onCardChange={(cardDetails: any) => setCardComplete(cardDetails.complete)}
                                        />
                                    </View>

                                    <TouchableOpacity
                                        style={[styles.payButton, paying && { opacity: 0.6 }]}
                                        onPress={handleBuy}
                                        disabled={paying}
                                    >
                                        {paying ? (
                                            <ActivityIndicator size="small" color="#FFF" />
                                        ) : (
                                            <MaterialIcons name="lock" size={16} color="#FFF" />
                                        )}
                                        <Text style={styles.payButtonText}>
                                            {paying ? 'Processing…' : `Pay €${(buyingPackage.price_cents / 100).toFixed(2)} & Activate`}
                                        </Text>
                                    </TouchableOpacity>

                                    <View style={styles.secureNote}>
                                        <MaterialIcons name="check-circle" size={12} color="#059669" />
                                        <Text style={styles.secureNoteText}>
                                            Payment is processed securely by Stripe. Your pass activates instantly.
                                        </Text>
                                    </View>
                                </View>
                            )}
                        </View>
                    </View>
                </Modal>
            </SafeAreaView>
        </ScreenBackground>
    );
}

const PINK = '#E8A0B4';
const VIOLET = '#8B5CF6';

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        padding: spacing.lg,
        paddingBottom: spacing.md,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: 'rgba(0,0,0,0.04)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.08)',
    },
    title: { fontSize: 22, fontWeight: '700', color: colors.text },
    subtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
    content: { padding: spacing.lg, paddingTop: 0, paddingBottom: 40 },
    balanceCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        padding: spacing.lg,
        marginBottom: spacing.lg,
    },
    balanceIcon: {
        width: 56,
        height: 56,
        borderRadius: 16,
        backgroundColor: VIOLET,
        alignItems: 'center',
        justifyContent: 'center',
    },
    balanceLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, color: colors.textMuted },
    balanceValue: { fontSize: 34, fontWeight: '800', color: colors.text, marginTop: 2 },
    sectionTitle: {
        fontSize: 12,
        fontWeight: '700',
        color: colors.textSecondary,
        letterSpacing: 1.2,
        marginBottom: spacing.sm,
        marginTop: spacing.sm,
    },
    emptyCard: { padding: spacing.xl, alignItems: 'center' },
    emptyTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginTop: spacing.sm },
    emptyText: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xs, lineHeight: 19 },
    passCard: { padding: spacing.lg, marginBottom: spacing.sm },
    passTopRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.sm },
    passName: { fontSize: 16, fontWeight: '700', color: colors.text },
    passExpiryRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
    passExpiry: { fontSize: 12, color: colors.textMuted },
    activePill: { backgroundColor: '#D1FAE5', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
    activePillText: { fontSize: 9, fontWeight: '700', color: '#047857', letterSpacing: 0.5 },
    passCountRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginBottom: spacing.sm },
    passRemaining: { fontSize: 24, fontWeight: '800', color: colors.text },
    passTotal: { fontSize: 13, color: colors.textMuted },
    progressTrack: { height: 8, borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.06)', overflow: 'hidden' },
    progressFill: { height: 8, borderRadius: 999, backgroundColor: VIOLET },
    ledgerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
    ledgerDivider: { borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.06)' },
    ledgerIcon: { width: 30, height: 30, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
    ledgerIconPos: { backgroundColor: '#D1FAE5' },
    ledgerIconNeg: { backgroundColor: '#FFE4E6' },
    ledgerLabel: { fontSize: 13, fontWeight: '600', color: colors.text },
    ledgerDate: { fontSize: 11, color: colors.textMuted, marginTop: 1 },
    ledgerDelta: { fontSize: 15, fontWeight: '800' },
    ledgerDeltaPos: { color: '#059669' },
    ledgerDeltaNeg: { color: '#E11D48' },
    ledgerBalance: { fontSize: 10, color: colors.textMuted },
    packageCard: { padding: spacing.lg, marginBottom: spacing.sm },
    packageTopRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start', marginBottom: spacing.sm },
    packageIcon: {
        width: 34,
        height: 34,
        borderRadius: 12,
        backgroundColor: VIOLET,
        alignItems: 'center',
        justifyContent: 'center',
    },
    packageName: { fontSize: 15, fontWeight: '700', color: colors.text },
    packageDesc: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
    packageMetaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
    metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    metaText: { fontSize: 12, color: colors.textMuted },
    packageBottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    packagePrice: { fontSize: 22, fontWeight: '800', color: colors.text },
    buyButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#000',
        borderRadius: 12,
        paddingHorizontal: spacing.lg,
        paddingVertical: 10,
    },
    buyButtonText: { color: '#FFF', fontWeight: '700', fontSize: 13 },
    modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalSheet: {
        backgroundColor: '#FFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.06)',
    },
    modalTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
    closeButton: { padding: 6 },
    modalBody: { padding: spacing.lg },
    buySummary: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: PINK,
        borderRadius: 14,
        padding: spacing.md,
        marginBottom: spacing.md,
    },
    buyName: { fontSize: 15, fontWeight: '700', color: '#FFF' },
    buySub: { fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 1 },
    buyPrice: { fontSize: 20, fontWeight: '800', color: '#FFF' },
    cardContainer: { padding: 4, marginBottom: spacing.md },
    cardField: { width: '100%', height: 50 },
    payButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        backgroundColor: '#000',
        borderRadius: 14,
        paddingVertical: 14,
    },
    payButtonText: { color: '#FFF', fontWeight: '700', fontSize: 15 },
    secureNote: { flexDirection: 'row', gap: 6, alignItems: 'flex-start', marginTop: spacing.md, marginBottom: spacing.sm },
    secureNoteText: { flex: 1, fontSize: 11, color: colors.textMuted, lineHeight: 15 },
});

export default ClassPassesScreen;
