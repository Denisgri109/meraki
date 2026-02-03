import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    Alert,
    Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Card, Button, ScreenBackground } from '../../components/ui';
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

const REWARD_TYPES = [
    { value: 'free_service', label: 'Free Service', icon: '🎁' },
    { value: 'discount_percent', label: 'Discount %', icon: '💵' },
    { value: 'discount_amount', label: 'Fixed Amount Off', icon: '💰' },
];

const STAMP_OPTIONS = [3, 5, 6, 8, 10, 12];

export function LoyaltyCardBuilderScreen() {
    const navigation = useNavigation<any>();
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [cards, setCards] = useState<LoyaltyCard[]>([]);
    const [showEditor, setShowEditor] = useState(false);
    const [editingCard, setEditingCard] = useState<LoyaltyCard | null>(null);

    // Form state
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [stampsRequired, setStampsRequired] = useState(6);
    const [rewardType, setRewardType] = useState<'free_service' | 'discount_percent' | 'discount_amount'>('free_service');
    const [rewardValue, setRewardValue] = useState('');

    useEffect(() => {
        loadCards();
    }, []);

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

    const resetForm = () => {
        setName('');
        setDescription('');
        setStampsRequired(6);
        setRewardType('free_service');
        setRewardValue('');
        setEditingCard(null);
    };

    const openEditor = (card?: LoyaltyCard) => {
        if (card) {
            setEditingCard(card);
            setName(card.name);
            setDescription(card.description || '');
            setStampsRequired(card.stamps_required);
            setRewardType(card.reward_type);
            setRewardValue(card.reward_value?.toString() || '');
        } else {
            resetForm();
        }
        setShowEditor(true);
    };

    const handleSave = async () => {
        if (!user) return;
        if (!name.trim()) {
            Alert.alert('Error', 'Please enter a card name');
            return;
        }

        setSaving(true);
        try {
            const cardData = {
                master_id: user.id,
                name: name.trim(),
                description: description.trim() || null,
                stamps_required: stampsRequired,
                reward_type: rewardType,
                reward_value: rewardType !== 'free_service' ? parseFloat(rewardValue) || null : null,
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
            Alert.alert('Success', editingCard ? 'Card updated!' : 'Loyalty card created!');
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to save card');
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
            Alert.alert('Error', error.message);
        }
    };

    const deleteCard = (card: LoyaltyCard) => {
        Alert.alert(
            'Delete Card',
            `Are you sure you want to delete "${card.name}"? Client stamps will be preserved but no new stamps can be added.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const { error } = await (supabase as any)
                                .from('loyalty_cards')
                                .delete()
                                .eq('id', card.id);
                            if (error) throw error;
                            await loadCards();
                        } catch (error: any) {
                            Alert.alert('Error', error.message);
                        }
                    },
                },
            ]
        );
    };

    const getRewardText = (card: LoyaltyCard) => {
        switch (card.reward_type) {
            case 'free_service':
                return 'Free service';
            case 'discount_percent':
                return `${card.reward_value}% off`;
            case 'discount_amount':
                return `€${card.reward_value} off`;
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
                                🎁 Collect {stampsRequired} stamps → {getRewardText({
                                    reward_type: rewardType,
                                    reward_value: parseFloat(rewardValue) || null,
                                } as LoyaltyCard)}
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

                        {/* Reward Type */}
                        <View style={styles.field}>
                            <Text style={styles.label}>Reward Type</Text>
                            {REWARD_TYPES.map((type) => (
                                <TouchableOpacity
                                    key={type.value}
                                    style={[styles.rewardOption, rewardType === type.value && styles.rewardOptionSelected]}
                                    onPress={() => setRewardType(type.value as any)}
                                >
                                    <Text style={styles.rewardIcon}>{type.icon}</Text>
                                    <Text style={[styles.rewardLabel, rewardType === type.value && styles.rewardLabelSelected]}>
                                        {type.label}
                                    </Text>
                                    {rewardType === type.value && (
                                        <MaterialCommunityIcons name="check" size={20} color={colors.primary} />
                                    )}
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* Reward Value (if not free service) */}
                        {rewardType !== 'free_service' && (
                            <View style={styles.field}>
                                <Text style={styles.label}>
                                    {rewardType === 'discount_percent' ? 'Discount %' : 'Amount (€)'}
                                </Text>
                                <TextInput
                                    style={styles.input}
                                    value={rewardValue}
                                    onChangeText={setRewardValue}
                                    placeholder={rewardType === 'discount_percent' ? '20' : '10.00'}
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
                        <Text style={styles.backButtonText}>← Back</Text>
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

                <ScrollView contentContainerStyle={styles.content}>
                    {cards.length === 0 ? (
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
                                        <Text style={styles.detailValue}>{getRewardText(card)}</Text>
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
    },
    backButton: {
        marginBottom: spacing.sm,
        alignSelf: 'flex-start',
    },
    backButtonText: { fontSize: 16, color: colors.primary, fontWeight: '500' },
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
    previewCard: { marginBottom: spacing.xl, padding: spacing.lg, backgroundColor: 'rgba(139, 92, 246, 0.1)' },
    previewHeader: { marginBottom: spacing.sm },
    previewTitle: { fontSize: 18, fontWeight: '600', color: colors.text },
    stampPreview: { flexDirection: 'row', gap: 8, marginTop: spacing.sm },
    stampDot: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.border },
    stampCollected: { backgroundColor: colors.primary },
    previewReward: { fontSize: 14, color: colors.textSecondary },
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
    rewardOptionSelected: { borderColor: colors.primary, backgroundColor: 'rgba(139, 92, 246, 0.1)' },
    rewardIcon: { fontSize: 20, marginRight: spacing.sm },
    rewardLabel: { flex: 1, fontSize: 16, color: colors.text },
    rewardLabelSelected: { fontWeight: '600' },
});

export default LoyaltyCardBuilderScreen;
