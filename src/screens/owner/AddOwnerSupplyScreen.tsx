import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { ScreenBackground, Button, Card } from '../../components/ui';
import { colors, spacing } from '../../theme';
import { OwnerSupply } from '../../types/database';

const COMMON_UNITS = ['pieces', 'pairs', 'sets', 'trays', 'bottles', 'tubes', 'sheets', 'grams', 'ml'];

export function AddOwnerSupplyScreen() {
    const navigation = useNavigation();
    const { user } = useAuth();
    const route = useRoute();
    const editingSupply = (route.params as any)?.supply as OwnerSupply | undefined;

    const [name, setName] = useState(editingSupply?.name || '');
    const [description, setDescription] = useState(editingSupply?.description || '');
    const [quantity, setQuantity] = useState(editingSupply?.quantity.toString() || '');
    const [unit, setUnit] = useState(editingSupply?.unit || 'pieces');
    const [lowStockThreshold, setLowStockThreshold] = useState(
        editingSupply?.low_stock_threshold?.toString() || ''
    );
    const [customUnit, setCustomUnit] = useState('');
    const [showCustomUnit, setShowCustomUnit] = useState(false);
    const [loading, setLoading] = useState(false);

    const isEditing = !!editingSupply;

    const handleSave = async () => {
        if (!name.trim()) {
            Alert.alert('Error', 'Please enter a supply name');
            return;
        }

        const quantityNum = parseInt(quantity);
        if (isNaN(quantityNum) || quantityNum < 0) {
            Alert.alert('Error', 'Please enter a valid quantity');
            return;
        }

        const finalUnit = showCustomUnit ? customUnit.trim() : unit;
        if (!finalUnit) {
            Alert.alert('Error', 'Please select or enter a unit');
            return;
        }

        setLoading(true);
        try {
            const supplyData = {
                owner_id: user!.id,
                name: name.trim(),
                description: description.trim() || null,
                quantity: quantityNum,
                unit: finalUnit,
                low_stock_threshold: lowStockThreshold ? parseInt(lowStockThreshold) : null,
            };

            if (isEditing) {
                const { error } = await supabase
                    .from('owner_supplies')
                    .update(supplyData)
                    .eq('id', editingSupply.id);

                if (error) throw error;
                Alert.alert('Success', 'Supply updated successfully!');
            } else {
                const { error } = await supabase
                    .from('owner_supplies')
                    .insert(supplyData);

                if (error) throw error;
                Alert.alert('Success', 'Supply added successfully!');
            }

            navigation.goBack();
        } catch (error: any) {
            console.error('Error saving supply:', error);
            Alert.alert('Error', error.message || 'Failed to save supply');
        } finally {
            setLoading(false);
        }
    };

    const handleAdjustQuantity = async (amount: number) => {
        const currentQty = parseInt(quantity) || 0;
        const newQty = Math.max(0, currentQty + amount);

        if (isEditing) {
            // For editing, update immediately
            try {
                const { error } = await supabase
                    .from('owner_supplies')
                    .update({ quantity: newQty })
                    .eq('id', editingSupply.id);

                if (error) throw error;

                // Log the adjustment manually (if using same log table, or skip if no owner log table exists)
                // Assuming owner uses same log table or skipping for now as explicit requirement was just to add supply
                /*
                await supabase
                    .from('supply_consumption_log')
                    .insert({
                        supply_id: editingSupply.id,
                        quantity_used: newQty - currentQty,
                        quantity_before: currentQty,
                        quantity_after: newQty,
                        notes: `Manual adjustment from ${currentQty} to ${newQty}`,
                        created_by: user!.id
                    });
                */

                setQuantity(newQty.toString());
            } catch (error: any) {
                Alert.alert('Error', 'Failed to adjust quantity');
            }
        } else {
            setQuantity(newQty.toString());
        }
    };

    return (
        <ScreenBackground>
            <SafeAreaView style={styles.container} edges={['top']}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.keyboardView}
                >
                    <ScrollView
                        contentContainerStyle={styles.scrollContent}
                        showsVerticalScrollIndicator={false}
                    >
                        {/* Header */}
                        {/* Header */}
                        <View style={styles.header}>
                            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                                <Text style={styles.backButtonText}>← Back</Text>
                            </TouchableOpacity>
                            <Text style={styles.title}>
                                {isEditing ? 'Edit Supply' : 'Add Supply'}
                            </Text>
                            <View style={{ width: 60 }} />
                        </View>

                        {/* Form */}
                        <View style={styles.form}>
                            {/* Name */}
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Supply Name *</Text>
                                <TextInput
                                    style={styles.input}
                                    value={name}
                                    onChangeText={setName}
                                    placeholder="e.g., Classic Lash Trays"
                                    placeholderTextColor={colors.textMuted}
                                    autoCapitalize="words"
                                />
                            </View>

                            {/* Description */}
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Description (Optional)</Text>
                                <TextInput
                                    style={[styles.input, styles.textArea]}
                                    value={description}
                                    onChangeText={setDescription}
                                    placeholder="e.g., 0.15mm C curl, 8-14mm mixed"
                                    placeholderTextColor={colors.textMuted}
                                    multiline
                                    numberOfLines={3}
                                />
                            </View>

                            {/* Quantity */}
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Current Quantity *</Text>
                                <View style={styles.quantityInputRow}>
                                    <TouchableOpacity
                                        style={styles.adjustButton}
                                        onPress={() => handleAdjustQuantity(-1)}
                                    >
                                        <Text style={styles.adjustButtonText}>−</Text>
                                    </TouchableOpacity>
                                    <TextInput
                                        style={[styles.input, styles.quantityInput]}
                                        value={quantity}
                                        onChangeText={setQuantity}
                                        keyboardType="number-pad"
                                        textAlign="center"
                                    />
                                    <TouchableOpacity
                                        style={styles.adjustButton}
                                        onPress={() => handleAdjustQuantity(1)}
                                    >
                                        <Text style={styles.adjustButtonText}>+</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {/* Unit */}
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Unit *</Text>
                                {!showCustomUnit ? (
                                    <View style={styles.unitsContainer}>
                                        {COMMON_UNITS.map((u) => (
                                            <TouchableOpacity
                                                key={u}
                                                style={[
                                                    styles.unitChip,
                                                    unit === u && styles.unitChipActive
                                                ]}
                                                onPress={() => setUnit(u)}
                                            >
                                                <Text style={[
                                                    styles.unitChipText,
                                                    unit === u && styles.unitChipTextActive
                                                ]}>
                                                    {u}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                        <TouchableOpacity
                                            style={styles.unitChip}
                                            onPress={() => setShowCustomUnit(true)}
                                        >
                                            <Text style={styles.unitChipText}>+ Custom</Text>
                                        </TouchableOpacity>
                                    </View>
                                ) : (
                                    <View style={styles.customUnitContainer}>
                                        <TextInput
                                            style={[styles.input, { flex: 1 }]}
                                            value={customUnit}
                                            onChangeText={setCustomUnit}
                                            placeholder="Enter custom unit"
                                            placeholderTextColor={colors.textMuted}
                                            autoCapitalize="none"
                                        />
                                        <TouchableOpacity
                                            style={styles.cancelCustomButton}
                                            onPress={() => {
                                                setShowCustomUnit(false);
                                                setCustomUnit('');
                                            }}
                                        >
                                            <Text style={styles.cancelCustomText}>Cancel</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </View>

                            {/* Low Stock Threshold */}
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Low Stock Alert Threshold (Optional)</Text>
                                <Text style={styles.helperText}>
                                    You'll be notified when quantity drops below this number.
                                    Leave empty to use global default (5).
                                </Text>
                                <TextInput
                                    style={styles.input}
                                    value={lowStockThreshold}
                                    onChangeText={setLowStockThreshold}
                                    placeholder="5"
                                    placeholderTextColor={colors.textMuted}
                                    keyboardType="number-pad"
                                />
                            </View>
                        </View>

                        {/* Save Button */}
                        <Button
                            title={isEditing ? 'Save Changes' : 'Add Supply'}
                            onPress={handleSave}
                            loading={loading}
                            fullWidth
                            style={styles.saveButton}
                        />
                    </ScrollView>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </ScreenBackground>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    keyboardView: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        padding: spacing.lg,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.xl,
    },
    backButton: {
        padding: spacing.xs,
        width: 60,
    },
    backButtonText: {
        color: colors.text,
        fontSize: 16,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: colors.text,
        textAlign: 'center',
        flex: 1,
    },
    form: {
        gap: spacing.lg,
        marginBottom: spacing.xl,
    },
    inputGroup: {
        gap: spacing.sm,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.text,
    },
    helperText: {
        fontSize: 12,
        color: colors.textMuted,
        lineHeight: 18,
    },
    input: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 12,
        padding: spacing.md,
        fontSize: 16,
        color: colors.text,
        borderWidth: 1,
        borderColor: colors.border,
    },
    textArea: {
        minHeight: 80,
        textAlignVertical: 'top',
    },
    quantityInputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    adjustButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    adjustButtonText: {
        fontSize: 24,
        color: colors.text,
        fontWeight: '600',
    },
    quantityInput: {
        flex: 1,
        fontSize: 24,
        fontWeight: '700',
    },
    unitsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
    },
    unitChip: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderWidth: 1,
        borderColor: colors.border,
    },
    unitChipActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    unitChipText: {
        fontSize: 14,
        color: colors.textSecondary,
    },
    unitChipTextActive: {
        color: colors.text,
        fontWeight: '600',
    },
    customUnitContainer: {
        flexDirection: 'row',
        gap: spacing.md,
        alignItems: 'center',
    },
    cancelCustomButton: {
        paddingHorizontal: spacing.md,
    },
    cancelCustomText: {
        fontSize: 14,
        color: colors.textSecondary,
    },
    saveButton: {
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
});

export default AddOwnerSupplyScreen;
