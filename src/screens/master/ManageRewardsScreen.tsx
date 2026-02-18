import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    Modal,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Card, Button, ScreenBackground } from '../../components/ui';
import { useModal } from '../../contexts/ModalContext';
import { colors, spacing } from '../../theme';

import { LoyaltyReward } from '../../types/database';

type Reward = LoyaltyReward;

const REWARD_TYPES = [
    { value: 'service', label: 'Free Service', icon: '🎁' },
    { value: 'discount_percent', label: 'Discount %', icon: '💵' },
    { value: 'discount_amount', label: 'Fixed Amount Off', icon: '💰' },
];

export function ManageRewardsScreen() {
    const navigation = useNavigation();
    const { user } = useAuth();
    const { showAlert, showConfirm } = useModal();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [rewards, setRewards] = useState<Reward[]>([]);
    const [showEditor, setShowEditor] = useState(false);
    const [editingReward, setEditingReward] = useState<Reward | null>(null);

    // Form state
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [pointsCost, setPointsCost] = useState('100');
    const [creditType, setCreditType] = useState<'service' | 'discount_percent' | 'discount_amount'>('service');
    const [discountAmount, setDiscountAmount] = useState('');

    useEffect(() => {
        loadRewards();
    }, [user]);

    const loadRewards = async () => {
        if (!user) return;
        try {
            const { data, error } = await supabase
                .from('loyalty_rewards')
                .select('*')
                .eq('master_id', user.id)
                .order('points_cost', { ascending: true });

            if (error) throw error;
            setRewards(data || []);
        } catch (error) {
            console.error('Error loading rewards:', error);
            showAlert('Error', 'Failed to load rewards', 'error');
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setName('');
        setDescription('');
        setPointsCost('100');
        setCreditType('service');
        setDiscountAmount('');
        setEditingReward(null);
    };

    const openEditor = (reward?: Reward) => {
        if (reward) {
            setEditingReward(reward);
            setName(reward.name);
            setDescription(reward.description || '');
            setPointsCost(reward.points_cost.toString());
            setCreditType((reward.credit_type as any) || 'service');
            setDiscountAmount(reward.discount_amount?.toString() || '');
        } else {
            resetForm();
        }
        setShowEditor(true);
    };

    const handleSave = async () => {
        if (!user) return;
        if (!name.trim()) {
            showAlert('Error', 'Please enter a reward name', 'error');
            return;
        }
        if (!pointsCost || isNaN(parseInt(pointsCost))) {
            showAlert('Error', 'Please enter a valid points cost', 'error');
            return;
        }

        setSaving(true);
        try {
            const rewardData = {
                master_id: user.id,
                name: name.trim(),
                description: description.trim() || null,
                points_cost: parseInt(pointsCost),
                credit_type: creditType,
                discount_amount: creditType !== 'service' ? parseFloat(discountAmount) || null : null,
                is_active: true,
            };

            if (editingReward) {
                const { error } = await supabase
                    .from('loyalty_rewards')
                    .update(rewardData)
                    .eq('id', editingReward.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('loyalty_rewards')
                    .insert(rewardData);
                if (error) throw error;
            }

            await loadRewards();
            setShowEditor(false);
            resetForm();
            showAlert('Success', editingReward ? 'Reward updated!' : 'Reward created!', 'success');
        } catch (error: any) {
            showAlert('Error', error.message || 'Failed to save reward', 'error');
        } finally {
            setSaving(false);
        }
    };

    const toggleRewardActive = async (reward: Reward) => {
        try {
            const { error } = await supabase
                .from('loyalty_rewards')
                .update({ is_active: !reward.is_active })
                .eq('id', reward.id);

            if (error) throw error;
            await loadRewards();
        } catch (error: any) {
            showAlert('Error', error.message, 'error');
        }
    };

    const deleteReward = (reward: Reward) => {
        showConfirm(
            'Delete Reward',
            `Are you sure you want to delete "${reward.name}"?`,
            async () => {
                try {
                    const { error } = await supabase
                        .from('loyalty_rewards')
                        .delete()
                        .eq('id', reward.id);
                    if (error) throw error;
                    await loadRewards();
                } catch (error: any) {
                    showAlert('Error', error.message, 'error');
                }
            },
            {
                confirmText: 'Delete',
                cancelText: 'Cancel',
                type: 'error'
            }
        );
    };

    const getRewardDescription = (reward: Reward) => {
        switch (reward.credit_type) {
            case 'service':
                return 'Free Service';
            case 'discount_percent':
                return `${reward.discount_amount}% Off`;
            case 'discount_amount':
                return `€${reward.discount_amount} Off`;
            default:
                return 'Reward';
        }
    };

    const renderEditor = () => (
        <Modal visible={showEditor} animationType="slide" onRequestClose={() => setShowEditor(false)}>
            <ScreenBackground>
                <SafeAreaView style={styles.editorContainer}>
                    <View style={styles.editorHeader}>
                        <TouchableOpacity onPress={() => setShowEditor(false)}>
                            <Text style={styles.cancelButton}>Cancel</Text>
                        </TouchableOpacity>
                        <Text style={styles.editorTitle}>
                            {editingReward ? 'Edit Reward' : 'New Reward'}
                        </Text>
                        <TouchableOpacity onPress={handleSave} disabled={saving}>
                            <Text style={[styles.saveButton, saving && styles.disabledButton]}>
                                {saving ? 'Saving...' : 'Save'}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    <ScrollView contentContainerStyle={styles.editorContent}>
                        {/* Name */}
                        <View style={styles.field}>
                            <Text style={styles.label}>Reward Name *</Text>
                            <TextInput
                                style={styles.input}
                                value={name}
                                onChangeText={setName}
                                placeholder="e.g., Free Haircut"
                                placeholderTextColor={colors.textMuted}
                            />
                        </View>

                        {/* Description */}
                        <View style={styles.field}>
                            <Text style={styles.label}>Description (optional)</Text>
                            <TextInput
                                style={[styles.input, styles.textArea]}
                                value={description}
                                onChangeText={setDescription}
                                placeholder="e.g., Valid for any haircut service"
                                placeholderTextColor={colors.textMuted}
                                multiline
                                numberOfLines={2}
                            />
                        </View>

                        {/* Points Cost */}
                        <View style={styles.field}>
                            <Text style={styles.label}>Points Cost *</Text>
                            <TextInput
                                style={styles.input}
                                value={pointsCost}
                                onChangeText={setPointsCost}
                                placeholder="e.g., 100"
                                placeholderTextColor={colors.textMuted}
                                keyboardType="number-pad"
                            />
                            <Text style={styles.helperText}>
                                How many loyalty points does a client need to redeem this?
                            </Text>
                        </View>

                        {/* Reward Type */}
                        <View style={styles.field}>
                            <Text style={styles.label}>Reward Type</Text>
                            {REWARD_TYPES.map((type) => (
                                <TouchableOpacity
                                    key={type.value}
                                    style={[styles.rewardOption, creditType === type.value && styles.rewardOptionSelected]}
                                    onPress={() => setCreditType(type.value as any)}
                                >
                                    <Text style={styles.rewardIcon}>{type.icon}</Text>
                                    <Text style={[styles.rewardLabel, creditType === type.value && styles.rewardLabelSelected]}>
                                        {type.label}
                                    </Text>
                                    {creditType === type.value && (
                                        <MaterialCommunityIcons name="check" size={20} color={colors.primary} />
                                    )}
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* Value (if not free service) */}
                        {creditType !== 'service' && (
                            <View style={styles.field}>
                                <Text style={styles.label}>
                                    {creditType === 'discount_percent' ? 'Discount %' : 'Amount (€)'}
                                </Text>
                                <TextInput
                                    style={styles.input}
                                    value={discountAmount}
                                    onChangeText={setDiscountAmount}
                                    placeholder={creditType === 'discount_percent' ? '20' : '10.00'}
                                    placeholderTextColor={colors.textMuted}
                                    keyboardType="decimal-pad"
                                />
                            </View>
                        )}
                    </ScrollView>
                </SafeAreaView>
            </ScreenBackground>
        </Modal>
    );

    return (
        <ScreenBackground>
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <View style={styles.headerRow}>
                        <View>
                            <Text style={styles.title}>Rewards Library</Text>
                            <Text style={styles.subtitle}>Manage rewards for points & stamps</Text>
                        </View>
                        <TouchableOpacity style={styles.addButton} onPress={() => openEditor()}>
                            <MaterialCommunityIcons name="plus" size={24} color={colors.text} />
                        </TouchableOpacity>
                    </View>
                </View>

                {loading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={colors.primary} />
                    </View>
                ) : (
                    <ScrollView contentContainerStyle={styles.content}>
                        {rewards.length === 0 ? (
                            <Card style={styles.emptyCard}>
                                <Text style={styles.emptyIcon}>🎁</Text>
                                <Text style={styles.emptyTitle}>No Rewards Yet</Text>
                                <Text style={styles.emptyText}>
                                    Create rewards that clients can redeem with points or win by completing stamp cards.
                                </Text>
                                <Button
                                    title="Create First Reward"
                                    onPress={() => openEditor()}
                                    style={{ marginTop: spacing.lg }}
                                />
                            </Card>
                        ) : (
                            rewards.map((reward) => (
                                <Card key={reward.id} style={[styles.cardItem, !reward.is_active && styles.cardInactive] as any}>
                                    <View style={styles.cardHeader}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.cardName}>{reward.name}</Text>
                                            <Text style={styles.cardType}>{getRewardDescription(reward)}</Text>
                                        </View>
                                        <View style={styles.pointsBadge}>
                                            <Text style={styles.pointsText}>{reward.points_cost} pts</Text>
                                        </View>
                                    </View>

                                    {reward.description && (
                                        <Text style={styles.cardDescription}>{reward.description}</Text>
                                    )}

                                    <View style={styles.cardActions}>
                                        <TouchableOpacity style={styles.actionBtn} onPress={() => openEditor(reward)}>
                                            <MaterialCommunityIcons name="pencil" size={18} color={colors.text} />
                                            <Text style={styles.actionText}>Edit</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity style={styles.actionBtn} onPress={() => toggleRewardActive(reward)}>
                                            <MaterialCommunityIcons
                                                name={reward.is_active ? 'pause' : 'play'}
                                                size={18}
                                                color={colors.text}
                                            />
                                            <Text style={styles.actionText}>{reward.is_active ? 'Pause' : 'Activate'}</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity style={styles.actionBtn} onPress={() => deleteReward(reward)}>
                                            <MaterialCommunityIcons name="trash-can-outline" size={18} color="#EF4444" />
                                            <Text style={[styles.actionText, { color: '#EF4444' }]}>Delete</Text>
                                        </TouchableOpacity>
                                    </View>
                                </Card>
                            ))
                        )}
                    </ScrollView>
                )}

                {renderEditor()}
            </SafeAreaView>
        </ScreenBackground>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: {
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.lg,
        paddingBottom: spacing.md,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.05)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        marginBottom: spacing.sm,
    },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    title: { fontSize: 28, fontWeight: '600', color: colors.text },
    subtitle: { fontSize: 14, color: colors.textSecondary, marginTop: spacing.xs },
    addButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    content: { padding: spacing.lg, paddingBottom: 100 },
    emptyCard: { alignItems: 'center', padding: spacing.xl },
    emptyIcon: { fontSize: 48, marginBottom: spacing.md },
    emptyTitle: { fontSize: 18, fontWeight: '600', color: colors.text, marginBottom: spacing.xs },
    emptyText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center' },
    cardItem: { marginBottom: spacing.md, padding: spacing.lg },
    cardInactive: { opacity: 0.6 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.sm },
    cardName: { fontSize: 18, fontWeight: '600', color: colors.text },
    cardType: { fontSize: 13, color: colors.primary, marginTop: 2 },
    pointsBadge: { backgroundColor: 'rgba(255, 215, 0, 0.1)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    pointsText: { fontSize: 12, fontWeight: '700', color: '#FFD700' },
    cardDescription: { fontSize: 13, color: colors.textSecondary, marginTop: 4, marginBottom: spacing.md },
    cardActions: { flexDirection: 'row', gap: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md },
    actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    actionText: { fontSize: 13, color: colors.text },

    // Editor styles
    editorContainer: { flex: 1 },
    editorHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    cancelButton: { fontSize: 16, color: colors.textSecondary },
    saveButton: { fontSize: 16, color: colors.primary, fontWeight: '600' },
    disabledButton: { opacity: 0.5 },
    editorTitle: { fontSize: 18, fontWeight: '600', color: colors.text },
    editorContent: { padding: spacing.lg },
    field: { marginBottom: spacing.lg },
    label: { fontSize: 12, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.sm },
    input: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 12,
        padding: spacing.md,
        fontSize: 16,
        color: colors.text,
        borderWidth: 1,
        borderColor: colors.border,
    },
    textArea: { height: 80, textAlignVertical: 'top' },
    helperText: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
    rewardOption: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.md,
        borderRadius: 12,
        backgroundColor: colors.surface,
        marginBottom: spacing.sm,
        borderWidth: 1,
        borderColor: colors.border,
    },
    rewardOptionSelected: { borderColor: colors.primary, backgroundColor: 'rgba(200, 160, 77, 0.1)' },
    rewardIcon: { fontSize: 20, marginRight: spacing.sm },
    rewardLabel: { flex: 1, fontSize: 16, color: colors.text },
    rewardLabelSelected: { fontWeight: '600' },
});

export default ManageRewardsScreen;
