import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    Image,
} from 'react-native';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { format } from 'date-fns';
import { safeGoBack } from '../../navigation/navigationUtils';
import { useMenuBackHandler } from '../../hooks/useMenuBackHandler';
import { ScreenBackground, Card } from '../../components/ui';
import { colors, spacing, typography } from '../../theme';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { useModal } from '../../contexts/ModalContext';
import { StampCard as StampCardType } from '../../types/loyalty';

interface Reward {
    id: string;
    points_cost: number;
    name: string;
    description: string | null;
    is_active: boolean;
    profiles?: {
        full_name: string | null;
    };
}

interface Transaction {
    id: string;
    points: number;
    type: 'earned' | 'redeemed';
    description: string | null;
    created_at: string;
}

interface UserCredit {
    id: string;
    credit_type: 'discount' | 'discount_amount' | 'free_service' | 'store_credit';
    amount: number;
    description: string;
    is_used: boolean;
    expires_at: string;
    created_at: string;
}

export function LoyaltyPointsScreen() {
    const navigation = useNavigation();
    const handleBack = useMenuBackHandler();
    const { user } = useAuth();
    const [balance, setBalance] = useState<number>(0);
    const [rewards, setRewards] = useState<Reward[]>([]); // These are available rewards to buy
    const [userCredits, setUserCredits] = useState<UserCredit[]>([]); // These are owned rewards/credits
    const [stampCards, setStampCards] = useState<StampCardType[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState<'active' | 'expired'>('active');


    // Active credits: Not used AND (no expiration OR expiration in future)
    const activeCredits = userCredits.filter(c => !c.is_used && (new Date(c.expires_at) > new Date()));
    // Expired credits: Used OR expiration in past
    const expiredCredits = userCredits.filter(c => c.is_used || (new Date(c.expires_at) <= new Date()));

    const fetchData = useCallback(async () => {
        if (!user) return;

        try {
            setLoading(true);

            // Fetch balance
            const { data: profile, error: profileError } = await (supabase as any)
                .from('profiles')
                .select('loyalty_points')
                .eq('id', user.id)
                .single();

            if (profileError) throw profileError;
            setBalance(profile?.loyalty_points || 0);

            // Fetch rewards
            const { data: rewardsData, error: rewardsError } = await (supabase as any)
                .from('loyalty_rewards')
                .select(`
                    id,
                    points_cost,
                    name,
                    description,
                    is_active,
                    profiles:master_id (
                        full_name
                    )
                `)
                .order('points_cost', { ascending: true });

            if (rewardsError) throw rewardsError;
            setRewards(rewardsData || []);

            // Fetch Stamp Cards
            const { data: cardsData, error: cardsError } = await (supabase as any).rpc('get_client_stamp_cards', {
                p_client_id: user.id
            });

            if (cardsError) console.error('Error fetching stamp cards:', cardsError);
            setStampCards(cardsData || []);

            // Fetch User Credits (Earned Rewards)
            const { data: creditsData, error: creditsError } = await (supabase as any)
                .from('user_credits')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (creditsError) throw creditsError;
            setUserCredits(creditsData || []);

            // Fetch transactions
            const { data: transactionsData, error: transactionsError } = await (supabase as any)
                .from('loyalty_transactions')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(20);

            if (transactionsError) throw transactionsError;
            setTransactions(transactionsData || []);

        } catch (error) {
            console.error('Error fetching loyalty data:', error);
            // Alert.alert('Error', 'Failed to load loyalty points data');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [user]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchData();
    };

    const { showConfirm, showAlert } = useModal();

    const handleRedeem = async (reward: Reward) => {
        if (!user) return;

        if (balance < reward.points_cost) {
            showAlert('Insufficient Points', `You need ${reward.points_cost} points to redeem this reward.`, 'error');
            return;
        }

        showConfirm(
            'Confirm Redemption',
            `Are you sure you want to redeem "${reward.name}" for ${reward.points_cost} points?`,
            async () => {
                try {
                    setLoading(true);
                    const { data, error } = await (supabase as any).rpc('redeem_reward', {
                        p_reward_id: reward.id,
                        p_user_id: user.id
                    });

                    if (error) throw error;

                    // Check if the function returned specific success/error data
                    // The previous error message suggested a void return or simple success, 
                    // but let's handle potential data return like in RewardsCatalogScreen
                    if (data && data.success === false) {
                        showAlert('Error', data.message || 'Failed to redeem reward', 'error');
                    } else {
                        showAlert('Success', 'Reward redeemed successfully!', 'success');
                        fetchData(); // Refresh data
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

    const handleRedeemStampCard = async (card: StampCardType) => {
        if (!card.reward_available) return;

        showConfirm(
            'Redeem Reward',
            `Are you sure you want to redeem your reward for ${card.master_name}?`,
            async () => {
                try {
                    setLoading(true);
                    const { data, error } = await (supabase as any).rpc('redeem_stamp_card', {
                        p_client_stamp_id: card.stamp_id,
                        p_client_id: user?.id
                    });

                    if (error) throw error;

                    if (data.success) {
                        showAlert('Success!', data.message, 'success');
                        fetchData();
                    } else {
                        showAlert('Error', data.message, 'error');
                    }
                } catch (error: any) {
                    console.error('Error redeeming reward:', error);
                    showAlert('Error', error.message || 'Failed to redeem reward', 'error');
                } finally {
                    setLoading(false);
                }
            }
        );
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
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={styles.header}>
                    <TouchableOpacity
                        onPress={handleBack}
                        style={styles.backButton}
                    >
                        <MaterialIcons name="arrow-back" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Loyalty Points</Text>
                    <View style={{ width: 40 }} />
                </View>

                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} />
                    }
                >
                    {/* Points Balance Card */}
                    <Card style={styles.balanceCard}>
                        <View style={styles.balanceContent}>
                            <Text style={styles.balanceLabel}>Your Balance</Text>
                            <Text style={styles.balanceValue}>{balance}</Text>
                            <Text style={styles.balanceUnit}>Points</Text>
                        </View>
                        <Ionicons name="gift-outline" size={80} color={colors.primary} style={styles.balanceIcon} />
                    </Card>

                    {/* Stamp Cards Button */}
                    <TouchableOpacity
                        style={styles.stampCardsButton}
                        onPress={() => navigation.navigate('StampCards' as never)}
                    >
                        <View style={styles.stampCardsContent}>
                            <View style={styles.stampIconContainer}>
                                <MaterialIcons name="grid-view" size={24} color={colors.primary} />
                            </View>
                            <View style={styles.stampTextContainer}>
                                <Text style={styles.stampCardsTitle}>My Stamp Cards</Text>
                                <Text style={styles.stampCardsSubtitle}>
                                    {stampCards.length} active cards
                                </Text>
                            </View>
                            <MaterialIcons name="chevron-right" size={24} color={colors.textSecondary} />
                        </View>
                    </TouchableOpacity>

                    {/* Rewards/Credits Section */}
                    <Text style={styles.sectionTitle}>My Rewards</Text>

                    {/* Tabs */}
                    <View style={styles.tabsContainer}>
                        <TouchableOpacity
                            style={[styles.tab, activeTab === 'active' && styles.activeTab]}
                            onPress={() => setActiveTab('active')}
                        >
                            <Text style={[styles.tabText, activeTab === 'active' && styles.activeTabText]}>Active</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.tab, activeTab === 'expired' && styles.activeTab]}
                            onPress={() => setActiveTab('expired')}
                        >
                            <Text style={[styles.tabText, activeTab === 'expired' && styles.activeTabText]}>History</Text>
                        </TouchableOpacity>
                    </View>

                    {activeTab === 'active' ? (
                        activeCredits.length > 0 ? (
                            <View style={styles.creditsList}>
                                {activeCredits.map((credit) => (
                                    <View key={credit.id} style={styles.creditCard}>
                                        <View style={styles.creditHeader}>
                                            <MaterialIcons name="local-offer" size={24} color={colors.primary} />
                                            <View style={styles.creditBadge}>
                                                <Text style={styles.creditBadgeText}>Active</Text>
                                            </View>
                                        </View>
                                        <Text style={styles.creditAmount}>
                                            {credit.credit_type === 'discount' || credit.credit_type === 'discount_amount'
                                                ? `€${credit.amount} Off`
                                                : credit.description}
                                        </Text>
                                        <Text style={styles.creditDescription}>{credit.description}</Text>
                                        <Text style={styles.creditExpiry}>
                                            Expires: {format(new Date(credit.expires_at), 'MMM d, yyyy')}
                                        </Text>
                                    </View>
                                ))}
                            </View>
                        ) : (
                            <Text style={styles.emptyStateText}>No active rewards. Redeem points to get rewards!</Text>
                        )
                    ) : (
                        expiredCredits.length > 0 ? (
                            <View style={styles.creditsList}>
                                {expiredCredits.map((credit) => (
                                    <View key={credit.id} style={[styles.creditCard, styles.expiredCreditCard]}>
                                        <View style={styles.creditHeader}>
                                            <MaterialIcons name="history" size={24} color={colors.textSecondary} />
                                            <View style={[styles.creditBadge, styles.expiredCreditBadge]}>
                                                <Text style={[styles.creditBadgeText, styles.expiredCreditBadgeText]}>
                                                    {credit.is_used ? 'Used' : 'Expired'}
                                                </Text>
                                            </View>
                                        </View>
                                        <Text style={[styles.creditAmount, styles.expiredText]}>
                                            {credit.credit_type === 'discount' || credit.credit_type === 'discount_amount'
                                                ? `€${credit.amount} Off`
                                                : credit.description}
                                        </Text>
                                        <Text style={[styles.creditDescription, styles.expiredText]}>{credit.description}</Text>
                                        <Text style={styles.creditExpiry}>
                                            {credit.is_used ? 'Used on' : 'Expired on'}: {format(new Date(credit.expires_at), 'MMM d, yyyy')}
                                        </Text>
                                    </View>
                                ))}
                            </View>
                        ) : (
                            <Text style={styles.emptyStateText}>No history.</Text>
                        )
                    )}

                    {/* Transaction History */}
                    <Text style={styles.sectionTitle}>History</Text>
                    {transactions.length > 0 ? (
                        <View style={styles.transactionsList}>
                            {transactions.map((tx) => (
                                <View key={tx.id} style={styles.transactionItem}>
                                    <View style={[
                                        styles.transactionIcon,
                                        { backgroundColor: tx.type === 'earned' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)' }
                                    ]}>
                                        <MaterialIcons
                                            name={tx.type === 'earned' ? 'add' : 'remove'}
                                            size={20}
                                            color={tx.type === 'earned' ? '#22C55E' : '#EF4444'}
                                        />
                                    </View>
                                    <View style={styles.transactionDetails}>
                                        <Text style={styles.transactionDescription}>
                                            {tx.description || (tx.type === 'earned' ? 'Points Earned' : 'Reward Redeemed')}
                                        </Text>
                                        <Text style={styles.transactionDate}>
                                            {format(new Date(tx.created_at), 'MMM d, yyyy • h:mm a')}
                                        </Text>
                                    </View>
                                    <Text style={[
                                        styles.transactionAmount,
                                        { color: tx.type === 'earned' ? '#22C55E' : '#EF4444' }
                                    ]}>
                                        {tx.type === 'earned' ? '+' : '-'}{tx.points}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    ) : (
                        <Text style={styles.emptyStateText}>No transaction history.</Text>
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
        paddingVertical: spacing.md,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        ...typography.h3,
        color: colors.text,
    },
    scrollContent: {
        paddingBottom: spacing.xxl,
    },
    balanceCard: {
        margin: spacing.lg,
        padding: spacing.xl,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        overflow: 'hidden',
    },
    balanceContent: {
        flex: 1,
    },
    balanceLabel: {
        ...typography.bodySmall,
        color: colors.textSecondary,
        marginBottom: spacing.xs,
    },
    balanceValue: {
        fontSize: 48,
        fontWeight: 'bold',
        color: colors.primary,
        lineHeight: 56,
    },
    balanceUnit: {
        ...typography.label,
        color: colors.text,
        marginTop: -4,
    },
    balanceIcon: {
        opacity: 0.8,
    },
    sectionTitle: {
        ...typography.h3,
        color: colors.text,
        marginLeft: spacing.lg,
        marginBottom: spacing.md,
        marginTop: spacing.md,
    },
    rewardsList: {
        paddingLeft: spacing.lg,
        paddingBottom: spacing.md,
    },
    rewardCard: {
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: spacing.md,
        marginRight: spacing.md,
        width: 160,
        height: 200,
        justifyContent: 'space-between',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    rewardPointsBadge: {
        backgroundColor: colors.primary,
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        borderRadius: 8,
        alignSelf: 'flex-start',
    },
    disabledBadge: {
        backgroundColor: colors.textSecondary,
    },
    rewardPointsText: {
        ...typography.caption,
        color: '#FFFFFF',
        fontWeight: 'bold',
    },
    rewardInfo: {
        flex: 1,
        justifyContent: 'center',
        marginVertical: spacing.sm,
    },
    rewardName: {
        ...typography.label,
        color: colors.text,
        marginBottom: 4,
    },
    rewardBusiness: {
        ...typography.caption,
        color: colors.textSecondary,
    },
    redeemButton: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        paddingVertical: spacing.sm,
        borderRadius: 8,
        alignItems: 'center',
    },
    disabledButton: {
        backgroundColor: 'rgba(255,255,255,0.05)',
    },
    redeemButtonText: {
        ...typography.caption,
        color: colors.text,
        fontWeight: '600',
    },
    transactionsList: {
        marginHorizontal: spacing.lg,
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 16,
        padding: spacing.sm,
    },
    transactionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
    },
    transactionIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: spacing.md,
    },
    transactionDetails: {
        flex: 1,
    },
    transactionDescription: {
        ...typography.bodySmall,
        color: colors.text,
        fontWeight: '500',
    },
    transactionDate: {
        ...typography.caption,
        color: colors.textSecondary,
        marginTop: 2,
    },
    transactionAmount: {
        ...typography.label,
        fontWeight: 'bold',
    },
    emptyStateText: {
        ...typography.bodySmall,
        color: colors.textSecondary,
        marginLeft: spacing.lg,
        fontStyle: 'italic',
    },
    tabsContainer: {
        flexDirection: 'row',
        marginHorizontal: spacing.lg,
        marginBottom: spacing.md,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 12,
        padding: 4,
    },
    tab: {
        flex: 1,
        paddingVertical: 8,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 8,
    },
    activeTab: {
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    tabText: {
        ...typography.bodySmall,
        color: colors.textSecondary,
        fontWeight: '500',
    },
    activeTabText: {
        color: colors.text,
        fontWeight: '600',
    },
    expiredCard: {
        opacity: 0.7,
        borderColor: 'rgba(255,255,255,0.02)',
    },
    expiredBadge: {
        backgroundColor: colors.textSecondary,
    },
    expiredText: {
        color: colors.textSecondary,
    },
    expiredLabelContainer: {
        backgroundColor: 'rgba(0,0,0,0.2)',
        paddingVertical: spacing.sm,
        borderRadius: 8,
        alignItems: 'center',
    },
    expiredLabel: {
        ...typography.caption,
        color: colors.textSecondary,
        fontStyle: 'italic',
    },
    subsection: {
        marginBottom: spacing.lg,
    },
    subsectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingRight: spacing.lg,
        marginBottom: spacing.sm,
    },
    subsectionTitle: {
        ...typography.label,
        fontSize: 18,
        color: colors.text,
        marginLeft: spacing.lg,
        marginBottom: spacing.sm,
    },
    stampCardsButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        marginHorizontal: spacing.lg,
        marginVertical: spacing.md,
        padding: spacing.md,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    stampCardsContent: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    stampIconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(212, 138, 130, 0.1)', // Primary light
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: spacing.md,
    },
    stampTextContainer: {
        flex: 1,
    },
    stampCardsTitle: {
        ...typography.label,
        fontSize: 16,
        color: colors.text,
        marginBottom: 2,
    },
    stampCardsSubtitle: {
        ...typography.caption,
        color: colors.textSecondary,
    },
    creditsList: {
        paddingHorizontal: spacing.lg,
    },
    creditCard: {
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: spacing.md,
        marginBottom: spacing.md,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)',
    },
    creditHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
    creditBadge: {
        backgroundColor: 'rgba(34, 197, 94, 0.1)', // Green light
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
    },
    creditBadgeText: {
        ...typography.caption,
        color: '#22C55E',
        fontWeight: 'bold',
        fontSize: 10,
    },
    creditAmount: {
        ...typography.h3,
        color: colors.primary,
        marginBottom: 4,
    },
    creditDescription: {
        ...typography.bodySmall,
        color: colors.text,
        marginBottom: spacing.sm,
    },
    creditExpiry: {
        ...typography.caption,
        color: colors.textSecondary,
    },
    expiredCreditCard: {
        opacity: 0.6,
        backgroundColor: 'rgba(255, 255, 255, 0.02)',
    },
    expiredCreditBadge: {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
    },
    expiredCreditBadgeText: {
        color: colors.textSecondary,
    },
});
