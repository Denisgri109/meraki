import React, { useState, useEffect } from 'react';
import {
    View,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { format } from 'date-fns';
import { MaterialIcons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
    Card,
    ScreenBackground,
    MerakiText
} from '../../components/ui';
import { colors, spacing } from '../../theme';

type Transaction = {
    id: string;
    points: number;
    type: 'earned' | 'redeemed';
    description: string;
    created_at: string;
};

export function PointsHistoryScreen() {
    const navigation = useNavigation();
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [transactions, setTransactions] = useState<Transaction[]>([]);

    useEffect(() => {
        if (user) fetchHistory();
    }, [user]);

    const fetchHistory = async () => {
        try {
            const { data, error } = await (supabase as any)
                .from('loyalty_transactions')
                .select('*')
                .eq('user_id', user?.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setTransactions(data || []);
        } catch (error) {
            console.error('Error fetching history:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchHistory();
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
                        <MaterialIcons name="arrow-back" size={22} color="rgba(255,255,255,0.7)" />
                    </TouchableOpacity>
                    <MerakiText style={styles.headerTitle}>Points History</MerakiText>
                    <View style={{ width: 40 }} />
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
                    {transactions.length > 0 ? (
                        <View style={styles.historyList}>
                            {transactions.map((tx, index) => {
                                const isEarned = tx.type === 'earned';
                                return (
                                    <View key={tx.id} style={styles.transactionWrapper}>
                                        <View style={styles.timeline}>
                                            <View style={[styles.timelineDot, { backgroundColor: isEarned ? '#22C55E' : colors.primary }]} />
                                            {index < transactions.length - 1 && <View style={styles.timelineLine} />}
                                        </View>

                                        <Card variant="glass" style={styles.transactionCard}>
                                            <View style={styles.cardHeader}>
                                                <MerakiText style={styles.dateText}>
                                                    {format(new Date(tx.created_at), 'MMMM d, yyyy • HH:mm')}
                                                </MerakiText>
                                                <View style={[
                                                    styles.typeBadge,
                                                    { backgroundColor: isEarned ? 'rgba(34, 197, 94, 0.1)' : 'rgba(212, 138, 130, 0.1)' }
                                                ]}>
                                                    <MerakiText style={[
                                                        styles.typeText,
                                                        { color: isEarned ? '#22C55E' : colors.primary }
                                                    ]}>
                                                        {tx.type.toUpperCase()}
                                                    </MerakiText>
                                                </View>
                                            </View>

                                            <MerakiText variant="h4" style={styles.descriptionText}>
                                                {tx.description || (isEarned ? 'Points Earned' : 'Points Redeemed')}
                                            </MerakiText>

                                            <View style={styles.pointsContainer}>
                                                <MaterialIcons
                                                    name="star"
                                                    size={16}
                                                    color={isEarned ? '#FFD700' : colors.textMuted}
                                                />
                                                <MerakiText style={[
                                                    styles.pointsText,
                                                    { color: isEarned ? '#FFD700' : colors.text }
                                                ]}>
                                                    {isEarned ? '+' : '-'}{tx.points} points
                                                </MerakiText>
                                            </View>
                                        </Card>
                                    </View>
                                );
                            })}
                        </View>
                    ) : (
                        <Card variant="glass" style={styles.emptyCard}>
                            <MaterialIcons name="history" size={48} color={colors.textMuted} />
                            <MerakiText style={styles.emptyText}>No transactions found in your history.</MerakiText>
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
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
        alignItems: 'center', justifyContent: 'center',
    },
    headerTitle: { fontSize: 17, fontWeight: '600', color: '#fff' },
    scrollContent: {
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.xxl,
    },
    historyList: {
        marginTop: spacing.md,
    },
    transactionWrapper: {
        flexDirection: 'row',
        marginBottom: spacing.md,
    },
    timeline: {
        width: 20,
        alignItems: 'center',
        marginRight: spacing.sm,
        paddingTop: 24,
    },
    timelineDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        zIndex: 2,
    },
    timelineLine: {
        position: 'absolute',
        top: 32,
        bottom: -spacing.md,
        width: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        zIndex: 1,
    },
    transactionCard: {
        flex: 1,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)',
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
    dateText: {
        fontSize: 11,
        color: colors.textMuted,
        fontWeight: '600',
    },
    typeBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
    },
    typeText: {
        fontSize: 9,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    descriptionText: {
        fontSize: 15,
        fontWeight: '700',
        marginBottom: spacing.sm,
    },
    pointsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    pointsText: {
        fontSize: 14,
        fontWeight: '700',
        marginLeft: 6,
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
    emptyText: {
        color: colors.textMuted,
        textAlign: 'center',
        marginTop: spacing.md,
        fontStyle: 'italic',
    },
});

export default PointsHistoryScreen;
