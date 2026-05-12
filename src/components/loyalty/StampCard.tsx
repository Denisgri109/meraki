import React from 'react';
import { View, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { Card, Button, MerakiText } from '../ui';
import { colors, spacing } from '../../theme';
import { StampCard as StampCardType } from '../../types/loyalty';

interface StampCardProps {
    card: StampCardType;
    onRedeem: (card: StampCardType) => void;
    style?: any;
    hideRedeemButton?: boolean;
}

export const StampCard: React.FC<StampCardProps> = ({ card, onRedeem, style, hideRedeemButton }) => {

    const getRewardText = (card: StampCardType) => {
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

    const renderStampSlots = () => {
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
                        <MaterialIcons name="star-border" size={16} color="rgba(0, 0, 0, 0.08)" />
                    )}
                </View>
            );
        }
        return slots;
    };

    return (
        <Card variant="glass" style={[styles.stampCard, style]}>
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
                    {renderStampSlots()}
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

                {!hideRedeemButton && (
                    card.reward_available ? (
                        <Button
                            title="Redeem Now"
                            variant="primary"
                            size="sm"
                            onPress={() => onRedeem(card)}
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
                    )
                )}
            </View>
        </Card>
    );
};

const styles = StyleSheet.create({
    stampCard: {
        padding: spacing.md,
        marginBottom: spacing.lg,
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.04)',
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
        backgroundColor: 'rgba(0, 0, 0, 0.04)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    rewardBadgeActive: {
        backgroundColor: colors.primary,
    },
    slotsContainer: {
        backgroundColor: 'rgba(0, 0, 0, 0.02)',
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
        borderColor: 'rgba(0, 0, 0, 0.04)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    stampSlotCollected: {
        backgroundColor: colors.primary,
        borderColor: 'rgba(0, 0, 0, 0.12)',
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
        borderTopColor: 'rgba(0, 0, 0, 0.04)',
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
        backgroundColor: 'rgba(0, 0, 0, 0.02)',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 8,
    },
    lastStampText: {
        fontSize: 11,
        color: colors.textMuted,
    },
});
