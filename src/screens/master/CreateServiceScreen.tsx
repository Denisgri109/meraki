import React, { useState } from 'react';
import {
    View,
    StyleSheet,
    ScrollView,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { ScreenBackground, Card, Button, MerakiText } from '../../components/ui';
import { useModal } from '../../contexts/ModalContext';
import { colors, spacing } from '../../theme';

const CATEGORIES = ['Nails', 'Lashes', 'Brows', 'Hair', 'Makeup', 'Skincare', 'Other'];

export function CreateServiceScreen() {
    const navigation = useNavigation();
    const { user } = useAuth();
    const { showAlert, showConfirm } = useModal();
    const [loading, setLoading] = useState(false);

    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState('Nails');
    const [basePrice, setBasePrice] = useState('');
    const [durationMinutes, setDurationMinutes] = useState('60');

    const handleCreate = async () => {
        if (!name.trim()) {
            showAlert('Error', 'Please enter a service name', 'error');
            return;
        }
        if (!basePrice || isNaN(Number(basePrice)) || Number(basePrice) <= 0) {
            showAlert('Error', 'Please enter a valid price', 'error');
            return;
        }
        if (!durationMinutes || isNaN(Number(durationMinutes)) || Number(durationMinutes) <= 0) {
            showAlert('Error', 'Please enter a valid duration', 'error');
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

            // Use showConfirm to handle navigation on acknowledgement
            showConfirm('Success', 'Service created successfully!', () => navigation.goBack(), {
                type: 'success',
                confirmText: 'OK',
                hideCancel: true
            });
        } catch (error: any) {
            console.error('Error creating service:', error);
            showAlert('Error', error.message || 'Failed to create service', 'error');
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
                                <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
                            </TouchableOpacity>
                            <MerakiText variant="h1" style={{ marginBottom: spacing.xs }}>Create New Service</MerakiText>
                            <MerakiText variant="caption" color={colors.textSecondary}>Add a service that clients can book</MerakiText>
                        </View>

                        {/* Form */}
                        <View style={styles.form}>
                            {/* Service Name */}
                            <View style={styles.inputGroup}>
                                <MerakiText variant="body" color={colors.text} style={{ fontWeight: '600', marginBottom: spacing.sm }}>Service Name *</MerakiText>
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
                                <MerakiText variant="body" color={colors.text} style={{ fontWeight: '600', marginBottom: spacing.sm }}>Description</MerakiText>
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
                                <MerakiText variant="body" color={colors.text} style={{ fontWeight: '600', marginBottom: spacing.sm }}>Category</MerakiText>
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
                                            <MerakiText
                                                variant="body"
                                                color={category === cat ? colors.text : colors.textSecondary}
                                                style={[
                                                    styles.categoryChipText,
                                                    category === cat && styles.categoryChipTextActive
                                                ]}
                                            >
                                                {cat}
                                            </MerakiText>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </View>

                            {/* Price & Duration Row */}
                            <View style={styles.row}>
                                <View style={[styles.inputGroup, styles.halfWidth]}>
                                    <MerakiText variant="body" color={colors.text} style={{ fontWeight: '600', marginBottom: spacing.sm }}>Price (€) *</MerakiText>
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
                                    <MerakiText variant="body" color={colors.text} style={{ fontWeight: '600', marginBottom: spacing.sm }}>Duration (min) *</MerakiText>
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
                                <MerakiText variant="caption" color={colors.textSecondary} style={{ fontWeight: '600', marginBottom: spacing.sm }}>Preview</MerakiText>
                                <Card style={styles.previewCard} variant="glass">
                                    <MerakiText variant="label" color={colors.accent} style={{ textTransform: 'uppercase', marginBottom: spacing.xs }}>{category}</MerakiText>
                                    <MerakiText variant="body" color={colors.text} style={{ fontWeight: '600', fontSize: 18, marginBottom: spacing.xs }}>{name || 'Service Name'}</MerakiText>
                                    {description ? (
                                        <MerakiText variant="caption" color={colors.textSecondary} numberOfLines={2}>
                                            {description}
                                        </MerakiText>
                                    ) : null}
                                    <View style={styles.previewMeta}>
                                        <MerakiText variant="h2" color={colors.accent}>
                                            €{basePrice || '0'}
                                        </MerakiText>
                                        <MerakiText variant="caption" color={colors.textMuted}>
                                            {durationMinutes || '0'} min
                                        </MerakiText>
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
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.05)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        marginBottom: spacing.md,
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
