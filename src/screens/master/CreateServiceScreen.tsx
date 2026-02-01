import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TextInput,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { ScreenBackground, Card, Button } from '../../components/ui';
import { colors, spacing } from '../../theme';

const CATEGORIES = ['Nails', 'Lashes', 'Brows', 'Hair', 'Makeup', 'Skincare', 'Other'];

export function CreateServiceScreen() {
    const navigation = useNavigation();
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);

    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState('Nails');
    const [basePrice, setBasePrice] = useState('');
    const [durationMinutes, setDurationMinutes] = useState('60');

    const handleCreate = async () => {
        if (!name.trim()) {
            Alert.alert('Error', 'Please enter a service name');
            return;
        }
        if (!basePrice || isNaN(Number(basePrice)) || Number(basePrice) <= 0) {
            Alert.alert('Error', 'Please enter a valid price');
            return;
        }
        if (!durationMinutes || isNaN(Number(durationMinutes)) || Number(durationMinutes) <= 0) {
            Alert.alert('Error', 'Please enter a valid duration');
            return;
        }

        setLoading(true);
        try {
            // 1. Create the service
            const { data: serviceData, error: serviceError } = await supabase
                .from('services')
                .insert({
                    name: name.trim(),
                    description: description.trim() || null,
                    category,
                    base_price: Number(basePrice),
                    duration_minutes: Number(durationMinutes),
                    is_active: true,
                    created_by: user!.id,
                })
                .select()
                .single();

            if (serviceError) throw serviceError;

            // 2. Link the service to this master in master_services
            const { error: linkError } = await supabase
                .from('master_services')
                .insert({
                    master_id: user!.id,
                    service_id: serviceData.id,
                    is_available: true,
                    custom_price: null, // Use base price
                    custom_duration: null, // Use base duration
                });

            if (linkError) throw linkError;

            Alert.alert('Success', 'Service created successfully!', [
                { text: 'OK', onPress: () => navigation.goBack() }
            ]);
        } catch (error: any) {
            console.error('Error creating service:', error);
            Alert.alert('Error', error.message || 'Failed to create service');
        } finally {
            setLoading(false);
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
                        style={styles.scrollView}
                        contentContainerStyle={styles.scrollContent}
                        keyboardShouldPersistTaps="handled"
                    >
                        {/* Header */}
                        <View style={styles.header}>
                            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                                <Text style={styles.backButtonText}>← Back</Text>
                            </TouchableOpacity>
                            <Text style={styles.title}>Create New Service</Text>
                            <Text style={styles.subtitle}>Add a service that clients can book</Text>
                        </View>

                        {/* Form */}
                        <View style={styles.form}>
                            {/* Service Name */}
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Service Name *</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="e.g., Gel Manicure"
                                    placeholderTextColor={colors.textMuted}
                                    value={name}
                                    onChangeText={setName}
                                    autoCapitalize="words"
                                />
                            </View>

                            {/* Description */}
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Description</Text>
                                <TextInput
                                    style={[styles.input, styles.textArea]}
                                    placeholder="Describe what this service includes..."
                                    placeholderTextColor={colors.textMuted}
                                    value={description}
                                    onChangeText={setDescription}
                                    multiline
                                    numberOfLines={4}
                                    textAlignVertical="top"
                                />
                            </View>

                            {/* Category */}
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Category</Text>
                                <ScrollView
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    contentContainerStyle={styles.categoriesContainer}
                                >
                                    {CATEGORIES.map((cat) => (
                                        <TouchableOpacity
                                            key={cat}
                                            style={[
                                                styles.categoryChip,
                                                category === cat && styles.categoryChipActive
                                            ]}
                                            onPress={() => setCategory(cat)}
                                        >
                                            <Text style={[
                                                styles.categoryChipText,
                                                category === cat && styles.categoryChipTextActive
                                            ]}>
                                                {cat}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </View>

                            {/* Price & Duration Row */}
                            <View style={styles.row}>
                                <View style={[styles.inputGroup, styles.halfWidth]}>
                                    <Text style={styles.label}>Price (€) *</Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="50"
                                        placeholderTextColor={colors.textMuted}
                                        value={basePrice}
                                        onChangeText={setBasePrice}
                                        keyboardType="decimal-pad"
                                    />
                                </View>
                                <View style={[styles.inputGroup, styles.halfWidth]}>
                                    <Text style={styles.label}>Duration (min) *</Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="60"
                                        placeholderTextColor={colors.textMuted}
                                        value={durationMinutes}
                                        onChangeText={setDurationMinutes}
                                        keyboardType="number-pad"
                                    />
                                </View>
                            </View>

                            {/* Preview Card */}
                            <View style={styles.previewSection}>
                                <Text style={styles.previewLabel}>Preview</Text>
                                <Card style={styles.previewCard} variant="glass">
                                    <Text style={styles.previewCategory}>{category}</Text>
                                    <Text style={styles.previewName}>{name || 'Service Name'}</Text>
                                    {description ? (
                                        <Text style={styles.previewDescription} numberOfLines={2}>
                                            {description}
                                        </Text>
                                    ) : null}
                                    <View style={styles.previewMeta}>
                                        <Text style={styles.previewPrice}>
                                            €{basePrice || '0'}
                                        </Text>
                                        <Text style={styles.previewDuration}>
                                            {durationMinutes || '0'} min
                                        </Text>
                                    </View>
                                </Card>
                            </View>
                        </View>
                    </ScrollView>

                    {/* Bottom Button */}
                    <View style={styles.bottomBar}>
                        <Button
                            title={loading ? 'Creating...' : 'Create Service'}
                            onPress={handleCreate}
                            loading={loading}
                            disabled={loading || !name.trim() || !basePrice}
                            fullWidth
                        />
                    </View>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </ScreenBackground>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    keyboardView: { flex: 1 },
    scrollView: { flex: 1 },
    scrollContent: { paddingBottom: spacing.xl },
    header: {
        padding: spacing.lg,
    },
    backButton: {
        marginBottom: spacing.md,
    },
    backButtonText: {
        color: colors.textSecondary,
        fontSize: 16,
    },
    title: {
        fontSize: 28,
        fontWeight: '700',
        color: colors.text,
        marginBottom: spacing.xs,
    },
    subtitle: {
        fontSize: 14,
        color: colors.textSecondary,
    },
    form: {
        padding: spacing.lg,
        paddingTop: 0,
    },
    inputGroup: {
        marginBottom: spacing.lg,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.text,
        marginBottom: spacing.sm,
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
        minHeight: 100,
        paddingTop: spacing.md,
    },
    categoriesContainer: {
        gap: spacing.sm,
    },
    categoryChip: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: 20,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
    },
    categoryChipActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    categoryChipText: {
        fontSize: 14,
        color: colors.textSecondary,
        fontWeight: '500',
    },
    categoryChipTextActive: {
        color: colors.text,
        fontWeight: '600',
    },
    row: {
        flexDirection: 'row',
        gap: spacing.md,
    },
    halfWidth: {
        flex: 1,
    },
    previewSection: {
        marginTop: spacing.lg,
    },
    previewLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.textSecondary,
        marginBottom: spacing.sm,
    },
    previewCard: {
        padding: spacing.md,
    },
    previewCategory: {
        fontSize: 12,
        color: colors.primary,
        fontWeight: '600',
        textTransform: 'uppercase',
        marginBottom: spacing.xs,
    },
    previewName: {
        fontSize: 18,
        fontWeight: '600',
        color: colors.text,
        marginBottom: spacing.xs,
    },
    previewDescription: {
        fontSize: 14,
        color: colors.textSecondary,
        marginBottom: spacing.sm,
    },
    previewMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        marginTop: spacing.sm,
    },
    previewPrice: {
        fontSize: 18,
        fontWeight: '700',
        color: colors.primary,
    },
    previewDuration: {
        fontSize: 14,
        color: colors.textMuted,
    },
    bottomBar: {
        padding: spacing.lg,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
});

export default CreateServiceScreen;
