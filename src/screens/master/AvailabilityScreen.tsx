import React, { useState, useEffect } from 'react';
import {
    View,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Switch,
    TextInput,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Card, Button, MerakiModal, MerakiModalProps, MerakiText } from '../../components/ui';
import { ScreenBackground } from '../../components/ui';
import { colors, spacing } from '../../theme';

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Common time options for picker
const TIME_OPTIONS = [
    '06:00', '06:30', '07:00', '07:30', '08:00', '08:30', '09:00', '09:30',
    '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30',
    '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30',
    '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00', '21:30', '22:00',
];

type Availability = {
    id?: string;
    day_of_week: number;
    start_time: string;
    end_time: string;
    is_available: boolean;
};

const DEFAULT_AVAILABILITY: Availability[] = DAYS_OF_WEEK.map((_, index) => ({
    day_of_week: index,
    start_time: '09:00',
    end_time: '18:00',
    is_available: index !== 0 && index !== 6, // Mon-Fri available by default
}));

export function MasterAvailabilityScreen() {
    const navigation = useNavigation();
    const { user } = useAuth();
    const [availability, setAvailability] = useState<Availability[]>(DEFAULT_AVAILABILITY);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [modalConfig, setModalConfig] = useState<MerakiModalProps>({
        visible: false,
        title: '',
        onClose: () => setModalConfig(prev => ({ ...prev, visible: false })),
    });

    // Time picker state management
    const [timePickerState, setTimePickerState] = useState<{
        visible: boolean;
        dayIndex: number;
        field: 'start_time' | 'end_time';
    }>({ visible: false, dayIndex: 0, field: 'start_time' });

    useEffect(() => {
        fetchAvailability();
    }, []);

    const fetchAvailability = async () => {
        if (!user) return;

        try {
            const { data, error } = await supabase
                .from('master_availability')
                .select('*')
                .eq('master_id', user.id)
                .order('day_of_week');

            if (error) throw error;

            if (data && data.length > 0) {
                const mergedAvailability = DEFAULT_AVAILABILITY.map(defaultDay => {
                    const existingDay = data.find(d => d.day_of_week === defaultDay.day_of_week);
                    return existingDay ? {
                        ...existingDay,
                        start_time: existingDay.start_time.substring(0, 5),
                        end_time: existingDay.end_time.substring(0, 5),
                    } : defaultDay;
                });
                setAvailability(mergedAvailability as Availability[]);
            }
        } catch (error) {
            console.error('Error fetching availability:', error);
        } finally {
            setLoading(false);
        }
    };

    const toggleDay = (dayIndex: number) => {
        setAvailability(prev => prev.map(day =>
            day.day_of_week === dayIndex
                ? { ...day, is_available: !day.is_available }
                : day
        ));
    };

    const updateTime = (dayIndex: number, field: 'start_time' | 'end_time', value: string) => {
        setAvailability(prev => prev.map(day =>
            day.day_of_week === dayIndex
                ? { ...day, [field]: value }
                : day
        ));
    };

    const openTimePicker = (dayIndex: number, field: 'start_time' | 'end_time') => {
        setTimePickerState({ visible: true, dayIndex, field });
    };

    const handleTimeSelect = (time: string) => {
        updateTime(timePickerState.dayIndex, timePickerState.field, time);
        setTimePickerState(prev => ({ ...prev, visible: false }));
    };

    const handleSave = async () => {
        if (!user) return;

        // Validate times
        for (const day of availability) {
            if (day.is_available && day.start_time >= day.end_time) {
                setModalConfig({
                    visible: true,
                    title: 'Invalid Time',
                    message: `${DAYS_OF_WEEK[day.day_of_week]}: End time must be after start time`,
                    type: 'error',
                    onClose: () => setModalConfig(prev => ({ ...prev, visible: false })),
                    confirmText: 'OK',
                    hideCancel: true
                });
                return;
            }
        }

        setSaving(true);
        try {
            // Delete existing and insert new
            await supabase
                .from('master_availability')
                .delete()
                .eq('master_id', user.id);

            const { error } = await supabase
                .from('master_availability')
                .insert(
                    availability.map(day => ({
                        master_id: user.id,
                        day_of_week: day.day_of_week,
                        start_time: day.start_time,
                        end_time: day.end_time,
                        is_available: day.is_available,
                    }))
                );

            if (error) throw error;
            setModalConfig({
                visible: true,
                title: 'Success',
                message: 'Your availability has been saved',
                type: 'success',
                onClose: () => setModalConfig(prev => ({ ...prev, visible: false })),
                confirmText: 'OK',
                hideCancel: true
            });
        } catch (error: any) {
            setModalConfig({
                visible: true,
                title: 'Error',
                message: error.message,
                type: 'error',
                onClose: () => setModalConfig(prev => ({ ...prev, visible: false })),
                confirmText: 'OK',
                hideCancel: true
            });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.text} />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <ScreenBackground>
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <View>
                        <MerakiText variant="h1">Availability</MerakiText>
                        <MerakiText variant="caption" color={colors.textSecondary}>Set your weekly schedule and hours</MerakiText>
                    </View>
                </View>

                <ScrollView contentContainerStyle={styles.content}>
                    {availability.map((day) => (
                        <Card key={day.day_of_week} style={styles.dayCard}>
                            <View style={styles.dayHeader}>
                                <MerakiText variant="body" color={colors.text} style={styles.dayName}>{DAYS_OF_WEEK[day.day_of_week]}</MerakiText>
                                <Switch
                                    value={day.is_available}
                                    onValueChange={() => toggleDay(day.day_of_week)}
                                    trackColor={{ false: colors.surfaceLight, true: colors.primary }}
                                    thumbColor={colors.background}
                                />
                            </View>

                            {day.is_available && (
                                <View style={styles.timeRow}>
                                    <View style={styles.timeInputGroup}>
                                        <MerakiText variant="caption" color={colors.textSecondary}>Start</MerakiText>
                                        <TouchableOpacity
                                            style={styles.timeButton}
                                            onPress={() => openTimePicker(day.day_of_week, 'start_time')}
                                        >
                                            <MerakiText variant="body" color={colors.text} style={styles.timeButtonText}>{day.start_time}</MerakiText>
                                        </TouchableOpacity>
                                    </View>
                                    <MerakiText variant="caption" color={colors.textMuted} style={styles.timeSeparator}>to</MerakiText>
                                    <View style={styles.timeInputGroup}>
                                        <MerakiText variant="caption" color={colors.textSecondary}>End</MerakiText>
                                        <TouchableOpacity
                                            style={styles.timeButton}
                                            onPress={() => openTimePicker(day.day_of_week, 'end_time')}
                                        >
                                            <MerakiText variant="body" color={colors.text} style={styles.timeButtonText}>{day.end_time}</MerakiText>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            )}

                            {!day.is_available && (
                                <MerakiText variant="caption" color={colors.textMuted} style={styles.dayOff}>Day off</MerakiText>
                            )}
                        </Card>
                    ))}
                </ScrollView>

                <View style={styles.bottomBar}>
                    <Button
                        title={saving ? 'Saving...' : 'Save Changes'}
                        onPress={handleSave}
                        loading={saving}
                        fullWidth
                    />
                </View>

                {/* Time Picker Modal using MerakiModal */}
                <MerakiModal
                    visible={timePickerState.visible}
                    title={`Select ${timePickerState.field === 'start_time' ? 'Start' : 'End'} Time`}
                    onClose={() => setTimePickerState(prev => ({ ...prev, visible: false }))}
                    hideCancel
                    confirmText="Close"
                >
                    <View style={styles.timeOptionsContainer}>
                        <ScrollView style={styles.timeOptionsScroll} nestedScrollEnabled>
                            <View style={styles.timeOptionsGrid}>
                                {TIME_OPTIONS.map((time) => {
                                    const currentValue = availability[timePickerState.dayIndex]?.[timePickerState.field];
                                    const isSelected = time === currentValue;

                                    return (
                                        <TouchableOpacity
                                            key={time}
                                            style={[
                                                styles.timeOption,
                                                isSelected && styles.timeOptionSelected
                                            ]}
                                            onPress={() => handleTimeSelect(time)}
                                        >
                                            <MerakiText
                                                variant="body"
                                                color={colors.text}
                                                style={[
                                                    styles.timeOptionText,
                                                    isSelected && styles.timeOptionTextSelected
                                                ]}
                                            >
                                                {time}
                                            </MerakiText>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </ScrollView>
                    </View>
                </MerakiModal>

                {/* Alert Modal */}
                <MerakiModal {...modalConfig} />
            </SafeAreaView>
        </ScreenBackground>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.md },
    backButton: { marginBottom: spacing.sm, alignSelf: 'flex-start', paddingVertical: spacing.xs, paddingHorizontal: spacing.xs, marginLeft: -spacing.xs },
    backButtonText: { fontSize: 16, color: colors.primary, fontWeight: '500' },
    title: { fontSize: 28, fontWeight: '600', color: colors.text },
    subtitle: { fontSize: 14, color: colors.textSecondary, marginTop: spacing.xs },
    content: { padding: spacing.lg },
    dayCard: { marginBottom: spacing.sm, padding: spacing.md },
    dayHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    dayName: { fontSize: 16, fontWeight: '600', color: colors.text },
    dayOff: { fontSize: 14, color: colors.textMuted, marginTop: spacing.sm },
    timeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: spacing.md,
        gap: spacing.sm,
    },
    timeInputGroup: { flex: 1 },
    timeLabel: {
        fontSize: 12,
        color: colors.textSecondary,
        marginBottom: spacing.xs,
    },
    timeButton: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 8,
        padding: spacing.sm,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: 'center',
    },
    timeButtonText: {
        fontSize: 16,
        color: colors.text,
        fontWeight: '500',
    },
    timeSeparator: {
        fontSize: 14,
        color: colors.textMuted,
        marginTop: spacing.lg,
    },
    bottomBar: { padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border },

    timeOptionsContainer: {
        maxHeight: 400,
        width: '100%',
    },
    timeOptionsScroll: {
        padding: spacing.xs,
    },
    timeOptionsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
        justifyContent: 'flex-start',
    },
    timeOption: {
        width: '23%',
        paddingVertical: spacing.md,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 8,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.border,
    },
    timeOptionSelected: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    timeOptionText: {
        fontSize: 14,
        color: colors.text,
    },
    timeOptionTextSelected: {
        fontWeight: '600',
    },
});

export default MasterAvailabilityScreen;
