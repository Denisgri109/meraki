import React, { useState, useEffect } from 'react';
import {
    View,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useModal } from '../../contexts/ModalContext';
import {
    Card,
    ScreenBackground,
    MerakiText,
    Button
} from '../../components/ui';
import { colors, spacing } from '../../theme';

const { width } = Dimensions.get('window');

export function RewardsCatalogScreen() {
    const navigation = useNavigation<any>();
    const { user } = useAuth();
    const { showAlert, showConfirm } = useModal();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [balance, setBalance] = useState(0);
    const [rewards, setRewards] = useState<any[]>([]);

    useEffect(() => {
        if (user) fetchData();
    }, [user]);

    const fetchData = async () => {
        try {
            // Fetch Profile Points
            const { data: profileData } = await (supabase as any)
                .from('profiles')
                .select('loyalty_points')
                .eq('id', user?.id)
                .single();

            setBalance(profileData?.loyalty_points || 0);

            // Fetch Rewards
            const { data: rewardsData } = await (supabase as any)
                .from('loyalty_rewards')
                .select('*, profiles(full_name, avatar_url)')
                .eq('is_active', true)
                .order('points_cost', { ascending: true });

            setRewards(rewardsData || []);

        } catch (error) {
            console.error('Error fetching catalog data:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleRedeem = async (reward: any) => {
        if (!user) return;

        showConfirm(
            'Redeem Reward',
            `Are you sure you want to redeem "${reward.name}" for ${reward.points_cost} points?`,
            async () => {
                try {
                    setLoading(true);
                    const { data, error } = await (supabase as any).rpc('redeem_reward', {
                        p_reward_id: reward.id,
                        p_user_id: user.id
                    });

                    if (error) throw error;

                    if (data.success) {
                        showAlert('Success', data.message, 'success');
                        fetchData();
                    } else {
                        showAlert('Error', data.message, 'error');
                    }
                } catch (error: any) {
                    console.error('Redemption error:', error);
                    showAlert('Error', error.message || 'Failed to redeem reward', 'error');
                } finally {
                    setLoading(false);
                }
            }
        );
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchData();
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
            <View style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity
                        onPress={() => navigation.goBack()}
                        style={styles.backButton}
                    >
                        <MaterialIcons name="arrow-back" size={22} color="rgba(0, 0, 0, 0.55)" />
                    </TouchableOpacity>
                    <MerakiText style={styles.headerTitle}>Rewards Catalog</MerakiText>
                    <View style={styles.balanceBadge}>
                        <MaterialIcons name="star" size={14} color="#FFD700" />
                        <MerakiText style={styles.balanceText}>{balance}</MerakiText>
                    </View>
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
                        Redeem your loyalty points for exclusive services and perks from your favorite masters.
                    </MerakiText>

                    {rewards.length > 0 ? (
                        <View style={styles.rewardsGrid}>
                            {rewards.map((reward) => {
                                const canRedeem = balance >= reward.points_cost;
                                const masterName = reward.profiles?.full_name;

                                return (
                                    <Card key={reward.id} variant="glass" style={styles.rewardCard}>
                                        <View style={styles.rewardIconContainer}>
                                            <MaterialIcons
                                                name="card-giftcard"
                                                size={32}
                                                color={canRedeem ? colors.primary : colors.textMuted}
                                            />
                                        </View>

                                        <View style={styles.rewardContent}>
                                            <View style={styles.costBadge}>
                                                <MerakiText style={styles.costText}>{reward.points_cost} PTS</MerakiText>
                                            </View>

                                            <MerakiText variant="h4" style={styles.rewardName} numberOfLines={2}>
                                                {reward.name}
                                            </MerakiText>

                                            {masterName && (
                                                <MerakiText style={styles.masterName} numberOfLines={1}>
                                                    By {masterName}
                                                </MerakiText>
                                            )}

                                            {reward.description && (
                                                <MerakiText style={styles.description} numberOfLines={2}>
                                                    {reward.description}
                                                </MerakiText>
                                            )}

                                            <Button
                                                title={canRedeem ? "Redeem" : "Insufficient Points"}
                                                variant={canRedeem ? "primary" : "outline"}
                                                size="sm"
                                                disabled={!canRedeem}
                                                onPress={() => handleRedeem(reward)}
                                                style={styles.redeemButton}
                                                textStyle={styles.redeemButtonText}
                                            />
                                        </View>
                                    </Card>
                                );
                            })}
                        </View>
                    ) : (
                        <Card variant="glass" style={styles.emptyCard}>
                            <MaterialIcons name="card-giftcard" size={48} color={colors.textMuted} />
                            <MerakiText style={styles.emptyText}>No rewards available in the catalog yet.</MerakiText>
                        </Card>
                    )}
                </ScrollView>
            </View>
        </ScreenBackground>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingTop: spacing.xl,
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
        backgroundColor: 'rgba(0, 0, 0, 0.03)',
        borderWidth: 1, borderColor: 'rgba(0, 0, 0, 0.06)',
        alignItems: 'center', justifyContent: 'center',
    },
    headerTitle: { fontSize: 17, fontWeight: '600', color: '#1A1A1A' },
    balanceBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 215, 0, 0.1)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255, 215, 0, 0.2)',
    },
    balanceText: {
        color: '#FFD700',
        fontSize: 14,
        fontWeight: '700',
        marginLeft: 4,
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
    rewardsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    rewardCard: {
        width: (width - spacing.lg * 2 - spacing.md) / 2,
        padding: spacing.md,
        marginBottom: spacing.md,
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.04)',
    },
    rewardIconContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: 'rgba(212, 138, 130, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        alignSelf: 'center',
        marginBottom: spacing.md,
    },
    rewardContent: {
        alignItems: 'center',
    },
    costBadge: {
        backgroundColor: 'rgba(184, 151, 47, 0.1)',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
        marginBottom: spacing.xs,
    },
    costText: {
        color: colors.gold,
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    rewardName: {
        fontSize: 15,
        fontWeight: '700',
        textAlign: 'center',
        marginBottom: 2,
        height: 40,
    },
    masterName: {
        fontSize: 11,
        color: colors.primary,
        fontWeight: '600',
        marginBottom: spacing.xs,
    },
    description: {
        fontSize: 11,
        color: colors.textMuted,
        textAlign: 'center',
        lineHeight: 16,
        marginBottom: spacing.md,
        height: 32,
    },
    redeemButton: {
        width: '100%',
        height: 32,
    },
    redeemButtonText: {
        fontSize: 12,
    },
    emptyCard: {
        padding: spacing.xxl,
        alignItems: 'center',
        justifyContent: 'center',
        borderStyle: 'dashed',
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.08)',
        marginTop: spacing.xl,
    },
    emptyText: {
        color: colors.textMuted,
        textAlign: 'center',
        marginTop: spacing.md,
        fontStyle: 'italic',
    },
});

export default RewardsCatalogScreen;
