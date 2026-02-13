import React, { useState, useEffect } from 'react';
import {
    View,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    Image,
    Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { format } from 'date-fns';
import { MaterialIcons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useModal } from '../../contexts/ModalContext';
import {
    Card,
    Button,
    ScreenBackground,
    MerakiText
} from '../../components/ui';
import { colors, spacing } from '../../theme';

const { width } = Dimensions.get('window');

type StampCard = {
    stamp_id: string;
    card_id: string;
    card_name: string;
    card_description: string | null;
    master_id: string;
    master_name: string;
    master_avatar: string | null;
    stamps_collected: number;
    stamps_required: number;
    stamps_redeemed: number;
    reward_type: string;
    reward_value: number | null;
    reward_available: boolean;
    last_stamp_at: string | null;
};

export function StampCardsScreen() {
    const navigation = useNavigation<any>();
    const { user } = useAuth();
    const { showAlert, showConfirm } = useModal();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [cards, setCards] = useState<StampCard[]>([]);

    useEffect(() => {
        if (user) fetchCards();
    }, [user]);

    const fetchCards = async () => {
        try {
            const { data, error } = await (supabase as any).rpc('get_client_stamp_cards', {
                p_client_id: user?.id
            });

            if (error) throw error;
            setCards(data || []);
        } catch (error) {
            console.error('Error fetching stamp cards:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleRedeem = async (card: StampCard) => {
        if (!card.reward_available) return;

        showConfirm(
            'Redeem Reward',
            `Are you sure you want to redeem your reward for ${card.master_name}?`,
            async () => {
                try {
                    const { data, error } = await (supabase as any).rpc('redeem_stamp_card', {
                        p_client_stamp_id: card.stamp_id,
                        p_client_id: user?.id
                    });

                    if (error) throw error;

                    if (data.success) {
                        showAlert('Success!', data.message, 'success');
                        fetchCards();
                    } else {
                        showAlert('Error', data.message, 'error');
                    }
                } catch (error: any) {
                    console.error('Error redeeming reward:', error);
                    showAlert('Error', error.message || 'Failed to redeem reward', 'error');
                }
            }
        );
    };

    const getRewardText = (card: StampCard) => {
        switch (card.reward_type) {
            case 'free_service':
                return 'Free Service';
            case 'discount_percent':
                return `${card.reward_value}% Off`;
            case 'discount_amount':
                return `€${card.reward_value} Off`;
            default:
                return 'Reward';
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchCards();
    };

    const renderStampSlots = (card: StampCard) => {
        const slots = [];
        for (let i = 0; i < card.stamps_required; i++) {
            const isCollected = i < card.stamps_collected;
            slots.push(
                <View
                    key={i}
                    style={[
                        styles.stampSlot,
                        isCollected && styles.stampSlotCollected
                    ]}
                >
                    {isCollected ? (
                        <MaterialIcons name="star" size={16} color="#fff" />
                    ) : (
                        <MaterialIcons name="star-border" size={16} color="rgba(255, 255, 255, 0.1)" />
                    )}
                </View>
            );
        }
        return slots;
    };

    if (loading && !refreshing) {
        return (
            <ScreenBackground>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            </ScreenBackground>
        );
    }

    return (
        <ScreenBackground>
            <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity
                        onPress={() => navigation.goBack()}
                        style={styles.backButton}
                    >
                        <MaterialIcons name="arrow-back" size={22} color="rgba(255,255,255,0.7)" />
                    </TouchableOpacity>
                    <MerakiText style={styles.headerTitle}>Stamp Cards</MerakiText>
                    <TouchableOpacity
                        onPress={() => navigation.navigate('QRScanner')}
                        style={styles.qrButton}
                    >
                        <MaterialIcons name="qr-code-scanner" size={20} color={colors.primary} />
                    </TouchableOpacity>
                </View>

                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            tintColor={colors.primary}
                        />
                    }
                >
                    <MerakiText style={styles.subtitle}>
                        Collect stamps every time you visit a master to unlock exclusive rewards.
                    </MerakiText>

                    {cards.length === 0 ? (
                        <Card variant="glass" style={styles.emptyCard}>
                            <View style={styles.emptyIconContainer}>
                                <MaterialIcons name="confirmation-number" size={48} color={colors.textMuted} />
                            </View>
                            <MerakiText variant="h3" style={styles.emptyTitle}>No active cards</MerakiText>
                            <MerakiText style={styles.emptySubtitle}>
                                Scan a Master's QR code at the salon to start your first stamp card.
                            </MerakiText>
                            <Button
                                title="Scan QR Code"
                                variant="primary"
                                onPress={() => navigation.navigate('QRScanner')}
                                style={styles.scanButton}
                            />
                        </Card>
                    ) : (
                        cards.map((card) => (
                            <Card key={card.stamp_id} variant="glass" style={styles.stampCard}>
                                {/* Master Area */}
                                <View style={styles.masterRow}>
                                    {card.master_avatar ? (
                                        <Image source={{ uri: card.master_avatar }} style={styles.avatar} />
                                    ) : (
                                        <View style={styles.avatarPlaceholder}>
                                            <MerakiText style={styles.avatarInitial}>
                                                {card.master_name?.charAt(0) || '?'}
                                            </MerakiText>
                                        </View>
                                    )}
                                    <View style={styles.masterInfo}>
                                        <MerakiText variant="h4" style={styles.masterName}>{card.master_name}</MerakiText>
                                        <MerakiText style={styles.cardName}>{card.card_name}</MerakiText>
                                    </View>
                                    <View style={styles.rewardIndicator}>
                                        <View style={[
                                            styles.rewardBadge,
                                            card.reward_available && styles.rewardBadgeActive
                                        ]}>
                                            <MaterialIcons
                                                name={card.reward_available ? "card-giftcard" : "card-giftcard"}
                                                size={18}
                                                color={card.reward_available ? "#fff" : colors.textMuted}
                                            />
                                        </View>
                                    </View>
                                </View>

                                {/* Slots Area */}
                                <View style={styles.slotsContainer}>
                                    <View style={styles.slotsGrid}>
                                        {renderStampSlots(card)}
                                    </View>
                                    <View style={styles.progressLabelRow}>
                                        <MerakiText style={styles.progressText}>
                                            {card.stamps_collected} of {card.stamps_required} stamps collected
                                        </MerakiText>
                                        {card.stamps_redeemed > 0 && (
                                            <MerakiText style={styles.redeemCountText}>
                                                {card.stamps_redeemed} redeemed
                                            </MerakiText>
                                        )}
                                    </View>
                                </View>

                                {/* Bottom Info */}
                                <View style={styles.cardFooter}>
                                    <View style={styles.footerInfo}>
                                        <MerakiText style={styles.footerLabel}>Reward</MerakiText>
                                        <MerakiText variant="h4" style={styles.footerValue}>{getRewardText(card)}</MerakiText>
                                    </View>

                                    {card.reward_available ? (
                                        <Button
                                            title="Redeem Now"
                                            variant="primary"
                                            size="sm"
                                            onPress={() => handleRedeem(card)}
                                            style={styles.footerAction}
                                        />
                                    ) : (
                                        <View style={styles.lastStampBox}>
                                            <MerakiText style={styles.lastStampText}>
                                                {card.last_stamp_at
                                                    ? `Last: ${format(new Date(card.last_stamp_at), 'MMM d')}`
                                                    : 'No stamps yet'}
                                            </MerakiText>
                                        </View>
                                    )}
                                </View>
                            </Card>
                        ))
                    )}
                </ScrollView>
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
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.md,
    },
    backButton: {
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
        alignItems: 'center', justifyContent: 'center',
    },
    headerTitle: { fontSize: 17, fontWeight: '600', color: '#fff' },
    qrButton: {
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: 'rgba(200, 160, 77, 0.1)',
        borderWidth: 1, borderColor: 'rgba(200, 160, 77, 0.2)',
        alignItems: 'center', justifyContent: 'center',
    },
    scrollContent: {
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.xxl,
    },
    subtitle: {
        fontSize: 14,
        color: colors.textSecondary,
        lineHeight: 20,
        marginBottom: spacing.xl,
    },
    emptyCard: {
        padding: spacing.xxl,
        alignItems: 'center',
        justifyContent: 'center',
        borderStyle: 'dashed',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        marginTop: spacing.xl,
    },
    emptyIconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.lg,
    },
    emptyTitle: {
        marginBottom: spacing.xs,
    },
    emptySubtitle: {
        fontSize: 13,
        color: colors.textMuted,
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: spacing.xl,
    },
    scanButton: {
        width: '100%',
    },
    stampCard: {
        padding: spacing.md,
        marginBottom: spacing.lg,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)',
    },
    masterRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.lg,
    },
    avatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
    },
    avatarPlaceholder: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: colors.primaryLight,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarInitial: {
        fontSize: 18,
        fontWeight: '700',
        color: colors.primary,
    },
    masterInfo: {
        flex: 1,
        marginLeft: spacing.md,
    },
    masterName: {
        fontSize: 16,
        fontWeight: '700',
    },
    cardName: {
        fontSize: 12,
        color: colors.textSecondary,
        marginTop: 2,
    },
    rewardIndicator: {
        marginLeft: spacing.sm,
    },
    rewardBadge: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    rewardBadgeActive: {
        backgroundColor: colors.primary,
    },
    slotsContainer: {
        backgroundColor: 'rgba(255, 255, 255, 0.02)',
        borderRadius: 16,
        padding: spacing.md,
        marginBottom: spacing.lg,
    },
    slotsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginBottom: spacing.sm,
    },
    stampSlot: {
        width: 36,
        height: 36,
        borderRadius: 12,
        backgroundColor: 'rgba(0, 0, 0, 0.2)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    stampSlotCollected: {
        backgroundColor: colors.primary,
        borderColor: 'rgba(255, 255, 255, 0.2)',
        elevation: 4,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.5,
        shadowRadius: 4,
    },
    progressLabelRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: spacing.xs,
    },
    progressText: {
        fontSize: 11,
        color: colors.textSecondary,
        fontWeight: '600',
    },
    redeemCountText: {
        fontSize: 10,
        color: colors.primary,
        fontWeight: '700',
        backgroundColor: 'rgba(212, 138, 130, 0.1)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 10,
    },
    cardFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderTopWidth: 1,
        borderTopColor: 'rgba(255, 255, 255, 0.05)',
        paddingTop: spacing.md,
    },
    footerInfo: {
        flex: 1,
    },
    footerLabel: {
        fontSize: 10,
        color: colors.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 2,
    },
    footerValue: {
        fontSize: 15,
        color: colors.gold,
    },
    footerAction: {
        width: 120,
    },
    lastStampBox: {
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 8,
    },
    lastStampText: {
        fontSize: 11,
        color: colors.textMuted,
    },
});

export default StampCardsScreen;
