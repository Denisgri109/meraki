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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { format } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Card, ScreenBackground } from '../../components/ui';
import { colors, spacing } from '../../theme';

type Transaction = {
    id: string;
    points: number;
    type: 'earned' | 'redeemed';
    description: string;
    created_at: string;
};



export function LoyaltyPointsScreen() {
    const navigation = useNavigation();
    const { profile, user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [balance, setBalance] = useState(0);
    const [transactions, setTransactions] = useState<any[]>([]);
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

            // Fetch Transactions
            const { data: txData } = await (supabase as any)
                .from('loyalty_transactions')
                .select('*')
                .eq('user_id', user?.id)
                .order('created_at', { ascending: false });

            setTransactions(txData || []);

            // Fetch Rewards
            const { data: rewardsData } = await (supabase as any)
                .from('loyalty_rewards')
                .select('*')
                .eq('is_active', true)
                .order('points_cost', { ascending: true });

            setRewards(rewardsData || []);

        } catch (error) {
            console.error('Error fetching loyalty data:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleRedeem = async (reward: any) => {
        if (!user) return;

        try {
            setLoading(true);
            const { data, error } = await (supabase as any).rpc('redeem_reward', {
                p_reward_id: reward.id,
                p_user_id: user.id
            });

            if (error) throw error;

            if (data.success) {
                Alert.alert('Success', data.message);
                fetchData(); // Refresh points and history
            } else {
                Alert.alert('Error', data.message);
            }
        } catch (error: any) {
            console.error('Redemption error:', error);
            Alert.alert('Error', error.message || 'Failed to redeem reward');
        } finally {
            setLoading(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchData();
    };

    if (loading) {
        return (
            <ScreenBackground>
                <SafeAreaView style={styles.container}>
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={colors.text} />
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
                        <Text style={styles.title}>Loyalty Points</Text>
                    </View>

                    {/* Balance Card */}
                    <Card style={styles.balanceCard}>
                        <Text style={styles.balanceLabel}>Your Points Balance</Text>
                        <Text style={styles.balanceValue}>⭐ {balance}</Text>
                        <Text style={styles.balanceSubtext}>
                            Scan codes at the salon to earn points!
                        </Text>
                    </Card>

                    {/* Stamp Cards Button */}
                    <TouchableOpacity
                        style={styles.stampCardsButton}
                        onPress={() => (navigation as any).navigate('StampCards')}
                    >
                        <Text style={styles.stampCardsEmoji}>🎫</Text>
                        <View style={styles.stampCardsText}>
                            <Text style={styles.stampCardsTitle}>My Stamp Cards</Text>
                            <Text style={styles.stampCardsSubtitle}>View your stamp collection progress</Text>
                        </View>
                        <Text style={styles.stampCardsArrow}>→</Text>
                    </TouchableOpacity>

                    {/* Rewards */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Available Rewards</Text>
                        {rewards.length > 0 ? (
                            rewards.map((item, index) => {
                                const canRedeem = balance >= item.points_cost;
                                return (
                                    <TouchableOpacity key={item.id} disabled={!canRedeem} onPress={() => handleRedeem(item)}>
                                        <Card style={!canRedeem ? [styles.rewardCard, styles.rewardDisabled] as any : styles.rewardCard}>
                                            <View style={styles.rewardInfo}>
                                                <Text style={styles.rewardPoints}>{item.points_cost} pts</Text>
                                                <Text style={styles.rewardText}>{item.name}</Text>
                                                {item.description && <Text style={styles.rewardSubtext}>{item.description}</Text>}
                                            </View>
                                            {canRedeem && (
                                                <View style={styles.redeemButton}>
                                                    <Text style={styles.redeemText}>Redeem</Text>
                                                </View>
                                            )}
                                        </Card>
                                    </TouchableOpacity>
                                );
                            })
                        ) : (
                            <Text style={styles.emptyText}>No rewards available internally.</Text>
                        )}
                    </View>

                    {/* History */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Recent Activity</Text>
                        {transactions.length > 0 ? (
                            transactions.map((tx) => (
                                <Card key={tx.id} style={styles.transactionCard}>
                                    <View style={styles.transactionInfo}>
                                        <Text style={styles.transactionDesc}>{tx.description || (tx.type === 'earned' ? 'Points Earned' : 'Redemption')}</Text>
                                        <Text style={styles.transactionDate}>
                                            {format(new Date(tx.created_at), 'MMM d, yyyy')}
                                        </Text>
                                    </View>
                                    <Text style={[
                                        styles.transactionPoints,
                                        tx.type === 'earned' ? styles.pointsEarned : styles.pointsRedeemed
                                    ]}>
                                        {tx.type === 'earned' ? '+' : ''}{tx.points}
                                    </Text>
                                </Card>
                            ))
                        ) : (
                            <Text style={styles.emptyText}>No transactions yet.</Text>
                        )}
                    </View>
                </ScrollView>
            </SafeAreaView>
        </ScreenBackground>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    content: { padding: spacing.lg },
    header: { marginBottom: spacing.xl },
    backButton: { color: colors.textSecondary, fontSize: 16, marginBottom: spacing.md },
    title: { fontSize: 28, fontWeight: '600', color: colors.text },
    balanceCard: { padding: spacing.xl, alignItems: 'center', marginBottom: spacing.xl },
    balanceLabel: { fontSize: 14, color: colors.textSecondary, marginBottom: spacing.sm },
    balanceValue: { fontSize: 48, fontWeight: '700', color: colors.text },
    balanceSubtext: { fontSize: 12, color: colors.textMuted, marginTop: spacing.sm },
    section: { marginBottom: spacing.xl },
    sectionTitle: { fontSize: 14, fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: spacing.md },
    rewardCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
    rewardDisabled: { opacity: 0.5 },
    rewardInfo: { flex: 1 },
    rewardPoints: { fontSize: 16, fontWeight: '600', color: colors.text },
    rewardText: { fontSize: 14, color: colors.textSecondary },
    redeemButton: { backgroundColor: colors.text, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 8 },
    redeemText: { color: colors.background, fontSize: 12, fontWeight: '600' },
    rewardSubtext: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
    transactionCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
    transactionInfo: { flex: 1 },
    transactionDesc: { fontSize: 14, color: colors.text },
    transactionDate: { fontSize: 12, color: colors.textMuted },
    transactionPoints: { fontSize: 16, fontWeight: '600' },
    pointsEarned: { color: '#22C55E' },
    pointsRedeemed: { color: colors.textSecondary },
    stampCardsButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 12,
        padding: spacing.md,
        marginBottom: spacing.xl,
        borderWidth: 1,
        borderColor: colors.border,
    },
    stampCardsEmoji: { fontSize: 28, marginRight: spacing.md },
    stampCardsText: { flex: 1 },
    stampCardsTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
    stampCardsSubtitle: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
    stampCardsArrow: { fontSize: 20, color: colors.textMuted },
    emptyText: { color: colors.textMuted, fontStyle: 'italic', textAlign: 'center', padding: spacing.md },
});

export default LoyaltyPointsScreen;
