import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    Alert,
    Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { format } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Card, Button, ScreenBackground } from '../../components/ui';
import { colors, spacing } from '../../theme';

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

        Alert.alert(
            'Redeem Reward',
            `Are you sure you want to redeem your ${getRewardText(card)} from ${card.master_name}?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Redeem',
                    onPress: async () => {
                        try {
                            const { data, error } = await (supabase as any).rpc('redeem_stamp_card', {
                                p_client_stamp_id: card.stamp_id,
                                p_client_id: user?.id
                            });

                            if (error) throw error;

                            if (data.success) {
                                Alert.alert('Success!', data.message);
                                fetchCards();
                            } else {
                                Alert.alert('Error', data.message);
                            }
                        } catch (error: any) {
                            Alert.alert('Error', error.message || 'Failed to redeem reward');
                        }
                    }
                }
            ]
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

    const renderStampDots = (card: StampCard) => {
        const dots = [];
        for (let i = 0; i < card.stamps_required; i++) {
            const isCollected = i < card.stamps_collected;
            dots.push(
                <View
                    key={i}
                    style={[
                        styles.stampDot,
                        isCollected && styles.stampDotCollected
                    ]}
                >
                    {isCollected && <Text style={styles.stampCheck}>✓</Text>}
                </View>
            );
        }
        return dots;
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
            <SafeAreaView style={styles.container} edges={['top']}>
                <ScrollView
                    contentContainerStyle={styles.content}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} />
                    }
                >
                    {/* Header */}
                    <View style={styles.header}>
                        <TouchableOpacity onPress={() => navigation.goBack()}>
                            <Text style={styles.backButton}>← Back</Text>
                        </TouchableOpacity>
                        <Text style={styles.title}>My Stamp Cards</Text>
                        <Text style={styles.subtitle}>Collect stamps from your favorite Masters</Text>
                    </View>

                    {/* Cards List */}
                    {cards.length === 0 ? (
                        <Card style={styles.emptyCard}>
                            <Text style={styles.emptyIcon}>🎫</Text>
                            <Text style={styles.emptyTitle}>No Stamp Cards Yet</Text>
                            <Text style={styles.emptyText}>
                                Visit a Master and scan their QR code to start collecting stamps!
                            </Text>
                            <Button
                                title="Scan QR Code"
                                onPress={() => navigation.navigate('QRScanner')}
                                style={{ marginTop: spacing.lg }}
                            />
                        </Card>
                    ) : (
                        cards.map((card) => (
                            <Card key={card.stamp_id} style={styles.cardItem}>
                                {/* Master Info */}
                                <View style={styles.masterInfo}>
                                    {card.master_avatar ? (
                                        <Image source={{ uri: card.master_avatar }} style={styles.avatar} />
                                    ) : (
                                        <View style={styles.avatarPlaceholder}>
                                            <Text style={styles.avatarText}>
                                                {card.master_name?.charAt(0)?.toUpperCase() || '?'}
                                            </Text>
                                        </View>
                                    )}
                                    <View style={styles.masterDetails}>
                                        <Text style={styles.masterName}>{card.master_name}</Text>
                                        <Text style={styles.cardName}>{card.card_name}</Text>
                                    </View>
                                    {card.reward_available && (
                                        <View style={styles.rewardBadge}>
                                            <Text style={styles.rewardBadgeText}>🎁</Text>
                                        </View>
                                    )}
                                </View>

                                {/* Stamp Progress */}
                                <View style={styles.stampProgress}>
                                    <View style={styles.stampDotsContainer}>
                                        {renderStampDots(card)}
                                    </View>
                                    <Text style={styles.progressText}>
                                        {card.stamps_collected}/{card.stamps_required} stamps
                                    </Text>
                                </View>

                                {/* Reward Info */}
                                <View style={styles.rewardInfo}>
                                    <Text style={styles.rewardLabel}>🎁 Reward:</Text>
                                    <Text style={styles.rewardValue}>{getRewardText(card)}</Text>
                                </View>

                                {/* Redeem Button */}
                                {card.reward_available && (
                                    <Button
                                        title="Redeem Reward"
                                        onPress={() => handleRedeem(card)}
                                        style={styles.redeemButton}
                                    />
                                )}

                                {/* Last Activity */}
                                {card.last_stamp_at && (
                                    <Text style={styles.lastActivity}>
                                        Last stamp: {format(new Date(card.last_stamp_at), 'MMM d, yyyy')}
                                    </Text>
                                )}

                                {/* Redemption Count */}
                                {card.stamps_redeemed > 0 && (
                                    <Text style={styles.redemptionCount}>
                                        ✨ Redeemed {card.stamps_redeemed} time{card.stamps_redeemed > 1 ? 's' : ''}
                                    </Text>
                                )}
                            </Card>
                        ))
                    )}
                </ScrollView>
            </SafeAreaView>
        </ScreenBackground>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    content: { padding: spacing.lg, paddingBottom: 100 },
    header: { marginBottom: spacing.xl },
    backButton: { color: colors.textSecondary, fontSize: 16, marginBottom: spacing.md },
    title: { fontSize: 28, fontWeight: '600', color: colors.text },
    subtitle: { fontSize: 14, color: colors.textSecondary, marginTop: spacing.xs },

    emptyCard: { alignItems: 'center', padding: spacing.xl },
    emptyIcon: { fontSize: 48, marginBottom: spacing.md },
    emptyTitle: { fontSize: 18, fontWeight: '600', color: colors.text, marginBottom: spacing.xs },
    emptyText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center' },

    cardItem: { marginBottom: spacing.lg, padding: spacing.lg },

    masterInfo: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
    avatar: { width: 48, height: 48, borderRadius: 24, marginRight: spacing.md },
    avatarPlaceholder: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: spacing.md,
    },
    avatarText: { fontSize: 20, fontWeight: '600', color: '#fff' },
    masterDetails: { flex: 1 },
    masterName: { fontSize: 16, fontWeight: '600', color: colors.text },
    cardName: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
    rewardBadge: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255, 215, 0, 0.2)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    rewardBadgeText: { fontSize: 18 },

    stampProgress: { marginBottom: spacing.md },
    stampDotsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: spacing.sm,
    },
    stampDot: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: colors.surface,
        borderWidth: 2,
        borderColor: colors.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    stampDotCollected: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    stampCheck: { fontSize: 14, color: '#fff', fontWeight: '700' },
    progressText: { fontSize: 13, color: colors.textSecondary },

    rewardInfo: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
    rewardLabel: { fontSize: 14, color: colors.textSecondary },
    rewardValue: { fontSize: 14, fontWeight: '600', color: colors.text, marginLeft: spacing.xs },

    redeemButton: { marginBottom: spacing.sm },

    lastActivity: { fontSize: 12, color: colors.textMuted, textAlign: 'center' },
    redemptionCount: { fontSize: 12, color: colors.primary, textAlign: 'center', marginTop: spacing.xs },
});

export default StampCardsScreen;
