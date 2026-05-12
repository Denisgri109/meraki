import React, { useState, useEffect, useCallback } from 'react';
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
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Card, Button, ScreenBackground } from '../../components/ui';
import { useModal } from '../../contexts/ModalContext';
import { colors, spacing } from '../../theme';

type LoyaltyCard = {
    id: string;
    name: string;
    description: string | null;
    stamps_required: number;
    reward_type: 'free_service' | 'discount_percent' | 'discount_amount';
    reward_value: number | null;
    is_active: boolean;
};

type Reward = {
    id: string;
    name: string;
    description: string | null;
    credit_type: 'service' | 'discount_percent' | 'discount_amount';
    discount_amount: number | null;
    points_cost: number;
};

const STAMP_OPTIONS = [3, 5, 6, 8, 10, 12];

export function LoyaltyCardBuilderScreen() {
    const navigation = useNavigation<any>();
    const { user } = useAuth();
    const { showAlert, showConfirm } = useModal();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [cards, setCards] = useState<LoyaltyCard[]>([]);
    const [rewards, setRewards] = useState<Reward[]>([]);
    const [showEditor, setShowEditor] = useState(false);
    const [editingCard, setEditingCard] = useState<LoyaltyCard | null>(null);

    // Form state
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [stampsRequired, setStampsRequired] = useState(6);
    const [selectedReward, setSelectedReward] = useState<Reward | null>(null);

    // Initial Load
    useEffect(() => {
        loadCards();
    }, []);

    // Reload rewards when screen comes into focus
    useFocusEffect(
        useCallback(() => {
            loadRewards();
        }, [])
    );

    const loadCards = async () => {
        if (!user) return;
        try {
            const { data, error } = await (supabase as any)
                .from('loyalty_cards')
                .select('*')
                .eq('master_id', user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setCards(data || []);
        } catch (error) {
            console.error('Error loading cards:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadRewards = async () => {
        if (!user) return;
        try {
            const { data, error } = await supabase
                .from('loyalty_rewards')
                .select('*')
                .eq('master_id', user.id)
                .eq('is_active', true)
                .order('name', { ascending: true });

            if (error) throw error;
            setRewards((data as any) || []);
        } catch (error) {
            console.error('Error loading rewards:', error);
        }
    };

    const resetForm = () => {
        setName('');
        setDescription('');
        setStampsRequired(6);
        setSelectedReward(null);
        setEditingCard(null);
    };

    const openEditor = (card?: LoyaltyCard) => {
        if (card) {
            setEditingCard(card);
            setName(card.name);
            setDescription(card.description || '');
            setStampsRequired(card.stamps_required);

            // Try to match existing card reward to a reward in the library (best effort)
            // Or just allow them to pick a new one.
            // For now, we won't pre-select because we didn't store the reward_id.
            // But we can construct a "fake" reward object for display if we want, or just leave it empty to force selection?
            // Let's try to match by type and value if possible, but names might differ.
            // We'll leave it null and let them pick.
            setSelectedReward(null);
        } else {
            resetForm();
        }
        setShowEditor(true);
    };

    const handleSave = async () => {
        if (!user) return;
        if (!name.trim()) {
            showAlert('Error', 'Please enter a card name', 'error');
            return;
        }
        if (!selectedReward) {
            showAlert('Error', 'Please select a reward', 'error');
            return;
        }

        setSaving(true);
        try {
            const cardData = {
                master_id: user.id,
                name: name.trim(),
                description: description.trim() || null,
                stamps_required: stampsRequired,
                reward_type: selectedReward.credit_type === 'service' ? 'free_service' : selectedReward.credit_type,
                reward_value: selectedReward.credit_type !== 'service' ? selectedReward.discount_amount : null,
                is_active: true,
            };

            if (editingCard) {
                const { error } = await (supabase as any)
                    .from('loyalty_cards')
                    .update(cardData)
                    .eq('id', editingCard.id);
                if (error) throw error;
            } else {
                const { error } = await (supabase as any)
                    .from('loyalty_cards')
                    .insert(cardData);
                if (error) throw error;
            }

            await loadCards();
            setShowEditor(false);
            resetForm();
            showAlert('Success', editingCard ? 'Card updated!' : 'Loyalty card created!', 'success');
        } catch (error: any) {
            showAlert('Error', error.message || 'Failed to save card', 'error');
        } finally {
            setSaving(false);
        }
    };

    const toggleCardActive = async (card: LoyaltyCard) => {
        try {
            const { error } = await (supabase as any)
                .from('loyalty_cards')
                .update({ is_active: !card.is_active })
                .eq('id', card.id);

            if (error) throw error;
            await loadCards();
        } catch (error: any) {
            showAlert('Error', error.message, 'error');
        }
    };

    const deleteCard = (card: LoyaltyCard) => {
        showConfirm(
            'Delete Card',
            `Are you sure you want to delete "${card.name}"? Client stamps will be preserved but no new stamps can be added.`,
            async () => {
                try {
                    const { error } = await (supabase as any)
                        .from('loyalty_cards')
                        .delete()
                        .eq('id', card.id);
                    if (error) throw error;
                    await loadCards();
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

    const getRewardText = (type: string, value: number | null) => {
        switch (type) {
            case 'free_service':
                return 'Free service';
            case 'discount_percent':
                return `${value}% off`;
            case 'discount_amount':
                return `€${value} off`;
            default:
                return 'Reward';
        }
    };

    // Helper for selected reward display
    const getSelectedRewardText = (reward: Reward) => {
        switch (reward.credit_type) {
            case 'service':
                return 'Free Service';
            case 'discount_percent':
                return `${reward.discount_amount}% off`;
            case 'discount_amount':
                return `€${reward.discount_amount} off`;
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
                            {editingCard ? 'Edit Card' : 'New Loyalty Card'}
                        </Text>
                        <TouchableOpacity onPress={handleSave} disabled={saving}>
                            <Text style={[styles.saveButton, saving && styles.disabledButton]}>
                                {saving ? 'Saving...' : 'Save'}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    <ScrollView contentContainerStyle={styles.editorContent}>
                        {/* Card Preview */}
                        <Card style={styles.previewCard}>
                            <View style={styles.previewHeader}>
                                <Text style={styles.previewTitle}>{name || 'Card Name'}</Text>
                                <View style={styles.stampPreview}>
                                    {Array(stampsRequired).fill(0).map((_, i) => (
                                        <View key={i} style={[styles.stampDot, i < 3 && styles.stampCollected]} />
                                    ))}
                                </View>
                            </View>
                            <Text style={styles.previewReward}>
                                🎁 Collect {stampsRequired} stamps → {selectedReward ? selectedReward.name : 'Select a Reward'}
                            </Text>
                        </Card>

                        {/* Name */}
                        <View style={styles.field}>
                            <Text style={styles.label}>Card Name *</Text>
                            <TextInput
                                style={styles.input}
                                value={name}
                                onChangeText={setName}
                                placeholder="e.g., Brow Loyalty Card"
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
                                placeholder="e.g., Get every 6th brow treatment free!"
                                placeholderTextColor={colors.textMuted}
                                multiline
                                numberOfLines={2}
                            />
                        </View>

                        {/* Stamps Required */}
                        <View style={styles.field}>
                            <Text style={styles.label}>Stamps Required</Text>
                            <View style={styles.stampOptions}>
                                {STAMP_OPTIONS.map((num) => (
                                    <TouchableOpacity
                                        key={num}
                                        style={[styles.stampOption, stampsRequired === num && styles.stampOptionSelected]}
                                        onPress={() => setStampsRequired(num)}
                                    >
                                        <Text style={[styles.stampOptionText, stampsRequired === num && styles.stampOptionTextSelected]}>
                                            {num}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        {/* Reward Selection */}
                        <View style={styles.field}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm }}>
                                <Text style={styles.label}>Select Reward *</Text>
                                <TouchableOpacity onPress={() => { setShowEditor(false); navigation.navigate('ManageRewards'); }}>
                                    <Text style={styles.linkText}>Manage Rewards</Text>
                                </TouchableOpacity>
                            </View>

                            {rewards.length === 0 ? (
                                <TouchableOpacity
                                    style={styles.noRewardsButton}
                                    onPress={() => { setShowEditor(false); navigation.navigate('ManageRewards'); }}
                                >
                                    <Text style={styles.noRewardsText}>No rewards found. Tap to create one.</Text>
                                </TouchableOpacity>
                            ) : (
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.rewardsScroll}>
                                    {rewards.map((reward) => (
                                        <TouchableOpacity
                                            key={reward.id}
                                            style={[
                                                styles.rewardItem,
                                                selectedReward?.id === reward.id && styles.rewardItemSelected
                                            ]}
                                            onPress={() => setSelectedReward(reward)}
                                        >
                                            <Text style={styles.rewardItemName}>{reward.name}</Text>
                                            <Text style={styles.rewardItemDetail}>{getSelectedRewardText(reward)}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            )}
                        </View>
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
                            <Text style={styles.title}>Loyalty Cards</Text>
                            <Text style={styles.subtitle}>Create stamp cards for your clients</Text>
                        </View>
                        <TouchableOpacity style={styles.addButton} onPress={() => openEditor()}>
                            <MaterialCommunityIcons name="plus" size={24} color={colors.text} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Manage Rewards Banner */}
                <TouchableOpacity
                    style={styles.manageRewardsBanner}
                    onPress={() => navigation.navigate('ManageRewards')}
                >
                    <MaterialCommunityIcons name="gift-outline" size={20} color={colors.primary} />
                    <Text style={styles.manageRewardsText}>Manage Rewards Library</Text>
                    <MaterialCommunityIcons name="chevron-right" size={20} color={colors.primary} />
                </TouchableOpacity>

                <ScrollView contentContainerStyle={styles.content}>
                    {loading ? (
                        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xl }} />
                    ) : cards.length === 0 ? (
                        <Card style={styles.emptyCard}>
                            <Text style={styles.emptyIcon}>🎫</Text>
                            <Text style={styles.emptyTitle}>No Loyalty Cards Yet</Text>
                            <Text style={styles.emptyText}>
                                Create a stamp card to reward your loyal clients
                            </Text>
                            <Button
                                title="Create Your First Card"
                                onPress={() => openEditor()}
                                style={{ marginTop: spacing.lg }}
                            />
                        </Card>
                    ) : (
                        cards.map((card) => (
                            <Card key={card.id} style={[styles.cardItem, !card.is_active && styles.cardInactive] as any}>
                                <View style={styles.cardHeader}>
                                    <View>
                                        <Text style={styles.cardName}>{card.name}</Text>
                                        {card.description && (
                                            <Text style={styles.cardDescription}>{card.description}</Text>
                                        )}
                                    </View>
                                    <View style={[styles.statusBadge, card.is_active ? styles.activeBadge : styles.inactiveBadge]}>
                                        <Text style={styles.statusText}>{card.is_active ? 'Active' : 'Paused'}</Text>
                                    </View>
                                </View>

                                <View style={styles.cardDetails}>
                                    <View style={styles.detailItem}>
                                        <Text style={styles.detailLabel}>Stamps needed</Text>
                                        <Text style={styles.detailValue}>{card.stamps_required}</Text>
                                    </View>
                                    <View style={styles.detailItem}>
                                        <Text style={styles.detailLabel}>Reward</Text>
                                        <Text style={styles.detailValue}>{getRewardText(card.reward_type, card.reward_value)}</Text>
                                    </View>
                                </View>

                                <View style={styles.cardActions}>
                                    <TouchableOpacity style={styles.actionBtn} onPress={() => openEditor(card)}>
                                        <MaterialCommunityIcons name="pencil" size={18} color={colors.text} />
                                        <Text style={styles.actionText}>Edit</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.actionBtn} onPress={() => toggleCardActive(card)}>
                                        <MaterialCommunityIcons
                                            name={card.is_active ? 'pause' : 'play'}
                                            size={18}
                                            color={colors.text}
                                        />
                                        <Text style={styles.actionText}>{card.is_active ? 'Pause' : 'Activate'}</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.actionBtn} onPress={() => deleteCard(card)}>
                                        <MaterialCommunityIcons name="trash-can-outline" size={18} color="#EF4444" />
                                        <Text style={[styles.actionText, { color: '#EF4444' }]}>Delete</Text>
                                    </TouchableOpacity>
                                </View>
                            </Card>
                        ))
                    )}
                </ScrollView>

                {renderEditor()}
            </SafeAreaView>
        </ScreenBackground>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.lg,
        paddingBottom: spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: 'rgba(0, 0, 0, 0.04)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: spacing.md,
    },
    // backButtonText: { fontSize: 16, color: colors.primary, fontWeight: '500' },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    title: { fontSize: 28, fontWeight: '600', color: colors.text },
    subtitle: { fontSize: 14, color: colors.textSecondary, marginTop: spacing.xs },
    addButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
    },
    manageRewardsBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(200, 160, 77, 0.1)',
        marginHorizontal: spacing.lg,
        padding: spacing.md,
        borderRadius: 12,
        marginBottom: spacing.md,
        borderWidth: 1,
        borderColor: 'rgba(200, 160, 77, 0.3)',
    },
    manageRewardsText: { flex: 1, marginLeft: spacing.md, color: colors.primary, fontWeight: '600' },
    content: { padding: spacing.lg, paddingBottom: 100 },
    emptyCard: { alignItems: 'center', padding: spacing.xl },
    emptyIcon: { fontSize: 48, marginBottom: spacing.md },
    emptyTitle: { fontSize: 18, fontWeight: '600', color: colors.text, marginBottom: spacing.xs },
    emptyText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center' },
    cardItem: { marginBottom: spacing.md, padding: spacing.lg },
    cardInactive: { opacity: 0.6 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.md },
    cardName: { fontSize: 18, fontWeight: '600', color: colors.text },
    cardDescription: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    activeBadge: { backgroundColor: 'rgba(16, 185, 129, 0.2)' },
    inactiveBadge: { backgroundColor: 'rgba(156, 163, 175, 0.2)' },
    statusText: { fontSize: 11, fontWeight: '600', color: colors.text },
    cardDetails: { flexDirection: 'row', gap: spacing.xl, marginBottom: spacing.md },
    detailItem: {},
    detailLabel: { fontSize: 11, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
    detailValue: { fontSize: 16, fontWeight: '600', color: colors.text, marginTop: 2 },
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
    previewCard: { marginBottom: spacing.xl, padding: spacing.lg, backgroundColor: 'rgba(200, 160, 77, 0.1)' },
    previewHeader: { marginBottom: spacing.sm },
    previewTitle: { fontSize: 18, fontWeight: '600', color: colors.text },
    stampPreview: { flexDirection: 'row', gap: 8, marginTop: spacing.sm },
    stampDot: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.border },
    stampCollected: { backgroundColor: colors.primary },
    previewReward: { fontSize: 14, color: colors.textSecondary },
    field: { marginBottom: spacing.lg },
    label: { fontSize: 12, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.sm },
    input: {
        backgroundColor: 'rgba(0, 0, 0, 0.04)',
        borderRadius: 12,
        padding: spacing.md,
        fontSize: 16,
        color: colors.text,
        borderWidth: 1,
        borderColor: colors.border,
    },
    textArea: { height: 80, textAlignVertical: 'top' },
    stampOptions: { flexDirection: 'row', gap: spacing.sm },
    stampOption: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: colors.border,
    },
    stampOptionSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
    stampOptionText: { fontSize: 16, fontWeight: '600', color: colors.text },
    stampOptionTextSelected: { color: '#fff' },

    rewardsScroll: { flexDirection: 'row', marginBottom: spacing.sm },
    rewardItem: {
        backgroundColor: colors.surface,
        padding: spacing.md,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        marginRight: spacing.sm,
        minWidth: 140,
    },
    rewardItemSelected: {
        borderColor: colors.primary,
        backgroundColor: 'rgba(200, 160, 77, 0.1)',
    },
    rewardItemName: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 4 },
    rewardItemDetail: { fontSize: 12, color: colors.textSecondary },

    linkText: { fontSize: 14, color: colors.primary, fontWeight: '600' },
    noRewardsButton: {
        padding: spacing.lg,
        borderWidth: 1,
        borderColor: colors.border,
        borderStyle: 'dashed',
        borderRadius: 12,
        alignItems: 'center',
    },
    noRewardsText: { color: colors.textMuted },
});

export default LoyaltyCardBuilderScreen;
