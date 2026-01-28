import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    Modal,
    TextInput,
    ScrollView,
    Alert,
    ActivityIndicator,
    RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { format, addDays, startOfDay, setHours, setMinutes, isBefore } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { ScreenBackground, Button, Card } from '../../components/ui';
import { colors, spacing } from '../../theme';
import { BlockedSlot } from '../../types/database';

export function BlockedSlotsScreen() {
    const navigation = useNavigation();
    const { user } = useAuth();
    const [blocks, setBlocks] = useState<BlockedSlot[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Form State
    const [reason, setReason] = useState('');
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [startTime, setStartTime] = useState('09:00');
    const [endTime, setEndTime] = useState('17:00');

    useEffect(() => {
        if (user) {
            fetchBlocks();
        }
    }, [user]);

    const fetchBlocks = async () => {
        try {
            const { data, error } = await supabase
                .from('blocked_slots')
                .select('*')
                .eq('master_id', user!.id)
                .gte('end_time', new Date().toISOString()) // Only future/current blocks
                .order('start_time', { ascending: true });

            if (error) throw error;
            setBlocks(data || []);
        } catch (error: any) {
            console.error('Error fetching blocks:', error);
            Alert.alert('Error', error.message);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchBlocks();
    };

    const handleAddBlock = async () => {
        if (!reason.trim()) {
            Alert.alert('Error', 'Please enter a reason');
            return;
        }

        const startParts = startTime.split(':').map(Number);
        const endParts = endTime.split(':').map(Number);

        const start = new Date(selectedDate);
        start.setHours(startParts[0], startParts[1], 0, 0);

        const end = new Date(selectedDate);
        end.setHours(endParts[0], endParts[1], 0, 0);

        if (end <= start) {
            Alert.alert('Error', 'End time must be after start time');
            return;
        }

        setSubmitting(true);
        try {
            const { error } = await supabase
                .from('blocked_slots')
                .insert({
                    master_id: user!.id,
                    start_time: start.toISOString(),
                    end_time: end.toISOString(),
                    reason: reason.trim(),
                });

            if (error) throw error;

            Alert.alert('Success', 'Time slot blocked');
            setModalVisible(false);
            setReason('');
            fetchBlocks();
        } catch (error: any) {
            Alert.alert('Error', error.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = (id: string) => {
        Alert.alert('Delete Block', 'Are you sure?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    const { error } = await supabase.from('blocked_slots').delete().eq('id', id);
                    if (!error) fetchBlocks();
                }
            }
        ]);
    };

    // Helpers for UI
    const dates = Array.from({ length: 30 }, (_, i) => addDays(new Date(), i));
    const timeOptions = [];
    for (let i = 8; i <= 22; i++) {
        timeOptions.push(`${i.toString().padStart(2, '0')}:00`);
        timeOptions.push(`${i.toString().padStart(2, '0')}:30`);
    }

    const renderBlock = ({ item }: { item: BlockedSlot }) => (
        <Card style={styles.card}>
            <View style={styles.cardHeader}>
                <Text style={styles.cardDate}>
                    {format(new Date(item.start_time), 'EEE, MMM d')}
                </Text>
                <TouchableOpacity onPress={() => handleDelete(item.id)}>
                    <Text style={styles.deleteText}>🗑️</Text>
                </TouchableOpacity>
            </View>
            <Text style={styles.cardTime}>
                {format(new Date(item.start_time), 'HH:mm')} - {format(new Date(item.end_time), 'HH:mm')}
            </Text>
            <Text style={styles.cardReason}>{item.reason}</Text>
        </Card>
    );

    return (
        <ScreenBackground>
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <Text style={styles.backButtonText}>← Back</Text>
                    </TouchableOpacity>
                    <Text style={styles.title}>Blocked Slots</Text>
                    <TouchableOpacity onPress={() => setModalVisible(true)} style={styles.addButton}>
                        <Text style={styles.addButtonText}>+</Text>
                    </TouchableOpacity>
                </View>

                {loading ? (
                    <ActivityIndicator style={{ marginTop: 20 }} color={colors.primary} />
                ) : (
                    <FlatList
                        data={blocks}
                        renderItem={renderBlock}
                        keyExtractor={item => item.id}
                        contentContainerStyle={styles.list}
                        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                        ListEmptyComponent={
                            <Text style={styles.emptyText}>No blocked slots scheduled.</Text>
                        }
                    />
                )}

                {/* ADD MODAL */}
                <Modal visible={modalVisible} animationType="slide" transparent>
                    <View style={styles.modalContainer}>
                        <View style={styles.modalContent}>
                            <Text style={styles.modalTitle}>Block Time</Text>

                            <Text style={styles.label}>Reason</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="e.g. Vacation, Personal"
                                placeholderTextColor={colors.textMuted}
                                value={reason}
                                onChangeText={setReason}
                            />

                            <Text style={styles.label}>Date</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dateScroll}>
                                {dates.map(date => {
                                    const selected = format(date, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd');
                                    return (
                                        <TouchableOpacity
                                            key={date.toISOString()}
                                            style={[styles.dateChip, selected && styles.dateChipSelected]}
                                            onPress={() => setSelectedDate(date)}
                                        >
                                            <Text style={[styles.dateChipText, selected && styles.dateChipTextSelected]}>
                                                {format(date, 'MMM d')}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </ScrollView>

                            <View style={styles.row}>
                                <View style={styles.half}>
                                    <Text style={styles.label}>Start Time</Text>
                                    <ScrollView style={styles.timeScroll} nestedScrollEnabled>
                                        {timeOptions.map(t => (
                                            <TouchableOpacity
                                                key={`start-${t}`}
                                                onPress={() => setStartTime(t)}
                                                style={[styles.timeOption, startTime === t && styles.timeOptionSelected]}
                                            >
                                                <Text style={styles.timeText}>{t}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                </View>
                                <View style={styles.half}>
                                    <Text style={styles.label}>End Time</Text>
                                    <ScrollView style={styles.timeScroll} nestedScrollEnabled>
                                        {timeOptions.map(t => (
                                            <TouchableOpacity
                                                key={`end-${t}`}
                                                onPress={() => setEndTime(t)}
                                                style={[styles.timeOption, endTime === t && styles.timeOptionSelected]}
                                            >
                                                <Text style={styles.timeText}>{t}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                </View>
                            </View>

                            <View style={styles.modalButtons}>
                                <Button title="Cancel" variant="outline" onPress={() => setModalVisible(false)} />
                                <Button title={submitting ? "Saving..." : "Block"} onPress={handleAddBlock} disabled={submitting} />
                            </View>
                        </View>
                    </View>
                </Modal>
            </SafeAreaView>
        </ScreenBackground>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md },
    backButton: { padding: spacing.xs },
    backButtonText: { color: colors.text, fontSize: 16 },
    title: { fontSize: 20, fontWeight: 'bold', color: colors.text },
    addButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
    addButtonText: { fontSize: 24, color: '#fff' },
    list: { padding: spacing.md },
    card: { padding: spacing.md, marginBottom: spacing.md },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs },
    cardDate: { fontSize: 16, fontWeight: '600', color: colors.text },
    deleteText: { fontSize: 16 },
    cardTime: { fontSize: 14, color: colors.primary, marginBottom: 4 },
    cardReason: { fontSize: 14, color: colors.textSecondary },
    emptyText: { textAlign: 'center', color: colors.textMuted, marginTop: spacing.xl },

    // Modal
    modalContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: spacing.md },
    modalContent: { backgroundColor: colors.surface, borderRadius: 16, padding: spacing.lg, maxHeight: '80%' },
    modalTitle: { fontSize: 20, fontWeight: 'bold', color: colors.text, marginBottom: spacing.lg, textAlign: 'center' },
    label: { color: colors.textSecondary, marginBottom: spacing.xs, fontSize: 14 },
    input: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: spacing.md, color: colors.text, marginBottom: spacing.lg, borderWidth: 1, borderColor: colors.border },
    dateScroll: { flexDirection: 'row', marginBottom: spacing.lg, maxHeight: 50 },
    dateChip: { padding: spacing.md, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.05)', marginRight: spacing.sm, borderWidth: 1, borderColor: colors.border },
    dateChipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
    dateChipText: { color: colors.textSecondary },
    dateChipTextSelected: { color: '#fff', fontWeight: '600' },
    row: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg, height: 150 },
    half: { flex: 1 },
    timeScroll: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 8 },
    timeOption: { padding: spacing.sm, alignItems: 'center' },
    timeOptionSelected: { backgroundColor: colors.primary },
    timeText: { color: colors.text },
    modalButtons: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
});

export default BlockedSlotsScreen;
