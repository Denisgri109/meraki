import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Switch,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Card, Button } from '../../components/ui';
import { ScreenBackground } from '../../components/ui';
import { colors, spacing } from '../../theme';

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

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
    const { user } = useAuth();
    const [availability, setAvailability] = useState<Availability[]>(DEFAULT_AVAILABILITY);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

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

    const handleSave = async () => {
        if (!user) return;

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
            Alert.alert('Success', 'Your availability has been saved');
        } catch (error: any) {
            Alert.alert('Error', error.message);
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
                    <Text style={styles.title}>Availability</Text>
                    <Text style={styles.subtitle}>Set your weekly schedule</Text>
                </View>

                <ScrollView contentContainerStyle={styles.content}>
                    {availability.map((day) => (
                        <Card key={day.day_of_week} style={styles.dayCard}>
                            <View style={styles.dayRow}>
                                <View style={styles.dayInfo}>
                                    <Text style={styles.dayName}>{DAYS_OF_WEEK[day.day_of_week]}</Text>
                                    {day.is_available ? (
                                        <Text style={styles.dayTime}>
                                            {day.start_time} - {day.end_time}
                                        </Text>
                                    ) : (
                                        <Text style={styles.dayOff}>Day off</Text>
                                    )}
                                </View>
                                <Switch
                                    value={day.is_available}
                                    onValueChange={() => toggleDay(day.day_of_week)}
                                    trackColor={{ false: colors.surfaceLight, true: colors.text }}
                                    thumbColor={colors.background}
                                />
                            </View>
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
            </SafeAreaView>
        </ScreenBackground>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.md },
    title: { fontSize: 28, fontWeight: '600', color: colors.text },
    subtitle: { fontSize: 14, color: colors.textSecondary, marginTop: spacing.xs },
    content: { padding: spacing.lg },
    dayCard: { marginBottom: spacing.sm, padding: spacing.md },
    dayRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    dayInfo: {},
    dayName: { fontSize: 16, fontWeight: '600', color: colors.text },
    dayTime: { fontSize: 14, color: colors.textSecondary, marginTop: spacing.xs },
    dayOff: { fontSize: 14, color: colors.textMuted, marginTop: spacing.xs },
    bottomBar: { padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border },
});

export default MasterAvailabilityScreen;
