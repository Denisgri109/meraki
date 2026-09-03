import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    Alert,
} from 'react-native';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useModal } from '../../contexts/ModalContext';
import { Card, ScreenBackground } from '../../components/ui';
import { colors, spacing } from '../../theme';
import { Service } from '../../types/database';

export function PilatesHubScreen() {
    const navigation = useNavigation<any>();
    const { user, role } = useAuth();
    const { showAlert } = useModal();
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [studios, setStudios] = useState<Service[]>([]);

    const isOwner = role === 'owner';

    const loadStudios = useCallback(async () => {
        if (!user?.id) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('services')
                .select('*')
                .eq('category', 'Pilates')
                .order('created_at', { ascending: false });
            if (error) throw error;
            // Filter to ones owned by this user when created_by is set
            const filtered = (data || []).filter(
                (s: any) => !s.created_by || s.created_by === user.id
            );
            setStudios(filtered as Service[]);
        } catch (error: any) {
            showAlert('Error', error.message || 'Failed to load Pilates studios', 'error');
        } finally {
            setLoading(false);
        }
    }, [user?.id, showAlert]);

    useFocusEffect(
        useCallback(() => {
            loadStudios();
        }, [loadStudios])
    );

    const createStudio = async () => {
        if (!user?.id) return;
        setCreating(true);
        try {
            const payload: any = {
                name: 'Pilates Studio',
                description: 'Reformer & mat Pilates classes.',
                category: 'Pilates',
                base_price: 25,
                duration_minutes: 50,
                is_active: true,
                created_by: user.id,
            };
            const { data: serviceData, error } = await supabase
                .from('services')
                .insert(payload)
                .select()
                .single();
            if (error) throw error;
            // Link to master_services so the owner can be selected as a host
            await supabase.from('master_services').insert({
                master_id: user.id,
                service_id: serviceData.id,
                is_available: true,
                custom_price: null,
                custom_duration: null,
            });
            showAlert('Created', 'Pilates studio created. Set up your timetable next.', 'success');
            navigation.navigate('PilatesTimetable', { service: serviceData });
        } catch (error: any) {
            showAlert('Error', error.message || 'Failed to create Pilates studio', 'error');
        } finally {
            setCreating(false);
        }
    };

    const deleteStudio = (id: string, name: string) => {
        Alert.alert(
            "Delete Studio",
            `Are you sure you want to delete "${name}"? This action cannot be undone.`,
            [
                { text: "Cancel", style: "cancel" },
                { 
                    text: "Delete", 
                    style: "destructive",
                    onPress: async () => {
                        setLoading(true);
                        try {
                            const { error } = await supabase.from('services').delete().eq('id', id);
                            if (error) throw error;
                            setStudios(prev => prev.filter(s => s.id !== id));
                            showAlert('Success', 'Studio deleted successfully', 'success');
                        } catch (error: any) {
                            showAlert('Error', error.message || 'Failed to delete studio', 'error');
                        } finally {
                            setLoading(false);
                        }
                    }
                }
            ]
        );
    };

    if (!isOwner) {
        return (
            <ScreenBackground>
                <SafeAreaView style={styles.container} edges={['top']}>
                    <View style={styles.header}>
                        <TouchableOpacity
                            accessibilityRole="button"
                            accessibilityLabel="Go back" onPress={() => navigation.goBack()} style={styles.backButton}>
                            <MaterialIcons name="arrow-back" size={22} color={colors.text} />
                        </TouchableOpacity>
                        <Text style={styles.title}>Pilates Studio</Text>
                        <View style={{ width: 40 }} />
                    </View>
                    <View style={styles.centerMessage}>
                        <MaterialCommunityIcons name="lock-outline" size={48} color={colors.textSecondary} />
                        <Text style={styles.emptyTitle}>Owners only</Text>
                        <Text style={styles.emptyText}>
                            Pilates studios can only be set up by salon owners.
                        </Text>
                    </View>
                </SafeAreaView>
            </ScreenBackground>
        );
    }

    return (
        <ScreenBackground>
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={styles.header}>
                    <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel="Go back" onPress={() => navigation.goBack()} style={styles.backButton}>
                        <MaterialIcons name="arrow-back" size={22} color={colors.text} />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.title}>Pilates Studio</Text>
                        <Text style={styles.subtitle}>Manage studios, classes & timetable</Text>
                    </View>
                </View>

                <ScrollView contentContainerStyle={styles.content}>
                    <Card style={styles.infoCard}>
                        <View style={styles.infoHeader}>
                            <View style={styles.infoIcon}>
                                <MaterialCommunityIcons name="yoga" size={20} color="#FFFFFF" />
                            </View>
                            <Text style={styles.infoLabel}>How it works</Text>
                        </View>
                        <Text style={styles.infoText}>
                            Pilates services use a weekly timetable with capacity limits, hosts and
                            recurring sessions. Create a studio, then open its timetable to set hours,
                            hosts and class details.
                        </Text>
                    </Card>

                    <TouchableOpacity
                        style={styles.waiversLink}
                        onPress={() => navigation.navigate('PilatesWaivers')}
                    >
                        <View style={styles.waiversLinkIcon}>
                            <MaterialCommunityIcons name="shield-check" size={20} color="#047857" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.waiversLinkTitle}>Signed Waivers</Text>
                            <Text style={styles.waiversLinkMeta}>View client health screenings & liability waivers</Text>
                        </View>
                        <MaterialIcons name="chevron-right" size={22} color={colors.textSecondary} />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.waiversLink}
                        onPress={() => navigation.navigate('Instructors')}
                    >
                        <View style={styles.waiversLinkIcon}>
                            <MaterialIcons name="verified-user" size={20} color="#047857" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.waiversLinkTitle}>Instructors</Text>
                            <Text style={styles.waiversLinkMeta}>Authorize waiver access & QR Pay for staff</Text>
                        </View>
                        <MaterialIcons name="chevron-right" size={22} color={colors.textSecondary} />
                    </TouchableOpacity>

                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Your Studios ({studios.length})</Text>
                    </View>

                    {loading ? (
                        <View style={styles.loadingBox}>
                            <ActivityIndicator size="large" color={colors.text} />
                        </View>
                    ) : studios.length === 0 ? (
                        <Card style={styles.emptyCard}>
                            <MaterialCommunityIcons name="calendar-blank-outline" size={36} color="#10B981" />
                            <Text style={styles.emptyTitle}>No Pilates studio yet</Text>
                            <Text style={styles.emptyText}>
                                Spin up a studio with sensible defaults and start adding classes.
                            </Text>
                            <TouchableOpacity
                                style={styles.primaryButton}
                                onPress={createStudio}
                                disabled={creating}
                            >
                                {creating ? (
                                    <ActivityIndicator size="small" color="#FFFFFF" />
                                ) : (
                                    <>
                                        <MaterialIcons name="add" size={18} color="#FFFFFF" />
                                        <Text style={styles.primaryButtonText}>Create Pilates Studio</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </Card>
                    ) : (
                        <>
                            {studios.map((studio) => (
                                <TouchableOpacity
                                    key={studio.id}
                                    style={styles.studioRow}
                                    onPress={() => navigation.navigate('PilatesTimetable', { service: studio })}
                                >
                                    <View style={styles.studioIcon}>
                                        <MaterialCommunityIcons name="calendar-month" size={20} color="#047857" />
                                    </View>
                                    <View style={styles.studioBody}>
                                        <View style={styles.studioTitleRow}>
                                            <Text style={styles.studioName} numberOfLines={1}>
                                                {studio.name}
                                            </Text>
                                            {!studio.is_active && (
                                                <View style={styles.inactivePill}>
                                                    <Text style={styles.inactivePillText}>INACTIVE</Text>
                                                </View>
                                            )}
                                        </View>
                                        <Text style={styles.studioMeta} numberOfLines={1}>
                                            {studio.duration_minutes} min · €{Number(studio.base_price).toFixed(2)} · Manage timetable
                                        </Text>
                                    </View>
                                    <TouchableOpacity
                                        accessibilityRole="button"
                                        accessibilityLabel="Delete"
                                        onPress={() => deleteStudio(studio.id, studio.name)}
                                        style={styles.deleteButton}
                                    >
                                        <MaterialIcons name="delete-outline" size={22} color="#EF4444" />
                                    </TouchableOpacity>
                                </TouchableOpacity>
                            ))}

                            <TouchableOpacity
                                style={styles.dashedButton}
                                onPress={createStudio}
                                disabled={creating}
                            >
                                {creating ? (
                                    <ActivityIndicator size="small" color="#047857" />
                                ) : (
                                    <>
                                        <MaterialIcons name="add" size={18} color="#047857" />
                                        <Text style={styles.dashedButtonText}>Add another Pilates studio</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </>
                    )}
                </ScrollView>
            </SafeAreaView>
        </ScreenBackground>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        padding: spacing.lg,
        paddingBottom: spacing.md,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: 'rgba(0,0,0,0.04)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.08)',
    },
    title: { fontSize: 22, fontWeight: '700', color: colors.text },
    subtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
    content: { padding: spacing.lg, paddingTop: 0, paddingBottom: 40 },
    infoCard: {
        padding: spacing.lg,
        marginBottom: spacing.lg,
        backgroundColor: '#ECFDF5',
        borderWidth: 1,
        borderColor: '#A7F3D0',
    },
    infoHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
    infoIcon: {
        width: 32,
        height: 32,
        borderRadius: 10,
        backgroundColor: '#10B981',
        alignItems: 'center',
        justifyContent: 'center',
    },
    infoLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: '#047857',
        textTransform: 'uppercase',
        letterSpacing: 1.5,
    },
    infoText: { fontSize: 14, color: '#065F46', lineHeight: 20 },
    sectionHeader: { marginBottom: spacing.md },
    waiversLink: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        padding: spacing.md,
        borderRadius: 16,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.08)',
        marginBottom: spacing.lg,
    },
    waiversLinkIcon: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: '#ECFDF5',
        alignItems: 'center',
        justifyContent: 'center',
    },
    waiversLinkTitle: { fontWeight: '700', color: colors.text, fontSize: 15 },
    waiversLinkMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
    sectionTitle: {
        fontSize: 12,
        fontWeight: '700',
        color: colors.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: 1.5,
    },
    loadingBox: { padding: spacing.xl, alignItems: 'center' },
    emptyCard: {
        padding: spacing.xl,
        alignItems: 'center',
        backgroundColor: 'rgba(236, 253, 245, 0.4)',
        borderWidth: 2,
        borderColor: '#A7F3D0',
        borderStyle: 'dashed',
    },
    emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginTop: spacing.sm },
    emptyText: {
        fontSize: 14,
        color: colors.textSecondary,
        textAlign: 'center',
        marginTop: spacing.xs,
        marginBottom: spacing.lg,
        lineHeight: 20,
    },
    primaryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        backgroundColor: '#10B981',
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.xl,
        borderRadius: 14,
        minWidth: 220,
    },
    primaryButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
    studioRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        padding: spacing.md,
        borderRadius: 16,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.08)',
        marginBottom: spacing.sm,
    },
    studioIcon: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: '#ECFDF5',
        alignItems: 'center',
        justifyContent: 'center',
    },
    studioBody: { flex: 1 },
    studioTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    studioName: { flex: 1, fontWeight: '700', color: colors.text, fontSize: 15 },
    studioMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
    inactivePill: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
        backgroundColor: 'rgba(0,0,0,0.06)',
    },
    inactivePillText: {
        fontSize: 9,
        fontWeight: '700',
        color: colors.textSecondary,
        letterSpacing: 1,
    },
    dashedButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        marginTop: spacing.sm,
        paddingVertical: spacing.md,
        borderRadius: 14,
        borderWidth: 2,
        borderColor: '#A7F3D0',
        borderStyle: 'dashed',
        backgroundColor: 'rgba(236, 253, 245, 0.3)',
    },
    dashedButtonText: { color: '#047857', fontWeight: '700', fontSize: 14 },
    centerMessage: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
    deleteButton: {
        padding: 8,
        marginLeft: spacing.sm,
    },
});

export default PilatesHubScreen;
