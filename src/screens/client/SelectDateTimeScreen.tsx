import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { format, addDays, startOfDay, setHours, setMinutes, isBefore } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { safeSupabaseFetch } from '../../lib/supabaseApi';
import { Button, Card, ScreenBackground } from '../../components/ui';
import { colors, spacing } from '../../theme';
import { Service, Profile } from '../../types/database';

type BookingStackParamList = {
    BookingMain: undefined;
    ServiceDetail: { serviceId: string };
    SelectDateTime: { serviceId: string; masterId: string };
    BookingConfirm: { serviceId: string; masterId: string; dateTime: string };
};

type SelectDateTimeScreenProps = {
    navigation: NativeStackNavigationProp<BookingStackParamList, 'SelectDateTime'>;
    route: RouteProp<BookingStackParamList, 'SelectDateTime'>;
};

// Generate next 14 days
const generateDates = () => {
    const dates = [];
    const today = startOfDay(new Date());
    for (let i = 0; i < 14; i++) {
        dates.push(addDays(today, i));
    }
    return dates;
};

// Generate time slots from 9am to 7pm
const generateTimeSlots = () => {
    const slots = [];
    for (let hour = 9; hour < 19; hour++) {
        slots.push(setMinutes(setHours(new Date(), hour), 0));
        slots.push(setMinutes(setHours(new Date(), hour), 30));
    }
    return slots;
};

export function SelectDateTimeScreen({ navigation, route }: SelectDateTimeScreenProps) {
    const { serviceId, masterId } = route.params;
    const [service, setService] = useState<Service | null>(null);
    const [master, setMaster] = useState<Profile | null>(null);
    const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()));
    const [selectedTime, setSelectedTime] = useState<Date | null>(null);
    const [bookedSlots, setBookedSlots] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);

    const dates = generateDates();
    const timeSlots = generateTimeSlots();

    useEffect(() => {
        fetchData();
    }, []);

    useEffect(() => {
        fetchBookedSlots();
    }, [selectedDate]);

    const fetchData = async () => {
        try {
            const servicePromise = supabase.from('services').select('*').eq('id', serviceId).single();
            const masterPromise = supabase.from('profiles').select('*').eq('id', masterId).single();

            const [serviceRes, masterRes] = await Promise.all([
                safeSupabaseFetch(servicePromise as any, { timeout: 5000 }),
                safeSupabaseFetch(masterPromise as any, { timeout: 5000 })
            ]);

            setService(serviceRes.data as Service);
            setMaster(masterRes.data as Profile);
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchBookedSlots = async () => {
        try {
            const dateStr = format(selectedDate, 'yyyy-MM-dd');
            const bookedPromise = supabase
                .from('appointments')
                .select('start_time')
                .eq('master_id', masterId)
                .gte('start_time', `${dateStr}T00:00:00`)
                .lt('start_time', `${dateStr}T23:59:59`)
                .in('status', ['pending', 'confirmed']);

            const { data } = await safeSupabaseFetch(bookedPromise as any, { timeout: 5000 });

            const booked = ((data as any[]) || []).map(apt => {
                const d = new Date(apt.start_time);
                return `${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`;
            });
            setBookedSlots(booked);
        } catch (error) {
            console.error('Error fetching booked slots:', error);
        }
    };

    const isSlotAvailable = (slot: Date) => {
        const timeKey = `${slot.getHours()}:${slot.getMinutes().toString().padStart(2, '0')}`;
        if (bookedSlots.includes(timeKey)) return false;

        // Check if slot is in the past
        const now = new Date();
        const slotDateTime = new Date(selectedDate);
        slotDateTime.setHours(slot.getHours(), slot.getMinutes());
        if (isBefore(slotDateTime, now)) return false;

        return true;
    };

    const handleContinue = () => {
        if (selectedTime) {
            const dateTime = new Date(selectedDate);
            dateTime.setHours(selectedTime.getHours(), selectedTime.getMinutes());
            navigation.navigate('BookingConfirm', {
                serviceId,
                masterId,
                dateTime: dateTime.toISOString(),
            });
        }
    };

    if (loading) {
        return (
            <ScreenBackground>
                <SafeAreaView style={styles.container}>
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={colors.text} />
                    </View>
                </SafeAreaView>
            </ScreenBackground>
        );
    }

    return (
        <ScreenBackground>
            <SafeAreaView style={styles.container} edges={['top']}>
                <ScrollView style={styles.scrollView}>
                    {/* Header */}
                    <View style={styles.header}>
                        <TouchableOpacity onPress={() => navigation.goBack()}>
                            <Text style={styles.backButton}>← Back</Text>
                        </TouchableOpacity>
                        <Text style={styles.title}>Select Date & Time</Text>
                    </View>

                    {/* Date Selection */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Choose a Date</Text>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.datesContainer}
                        >
                            {dates.map((date) => {
                                const isSelected = format(date, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd');
                                const isToday = format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');

                                return (
                                    <TouchableOpacity
                                        key={date.toISOString()}
                                        style={[styles.dateCard, isSelected && styles.dateCardSelected]}
                                        onPress={() => {
                                            setSelectedDate(date);
                                            setSelectedTime(null);
                                        }}
                                    >
                                        <Text style={[styles.dateDay, isSelected && styles.dateTextSelected]}>
                                            {format(date, 'EEE')}
                                        </Text>
                                        <Text style={[styles.dateNum, isSelected && styles.dateTextSelected]}>
                                            {format(date, 'd')}
                                        </Text>
                                        {isToday && <Text style={styles.todayLabel}>Today</Text>}
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </View>

                    {/* Time Selection */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Choose a Time</Text>
                        <View style={styles.timeSlotsGrid}>
                            {timeSlots.map((slot) => {
                                const timeStr = format(slot, 'HH:mm');
                                const available = isSlotAvailable(slot);
                                const isSelected = selectedTime &&
                                    format(selectedTime, 'HH:mm') === timeStr;

                                return (
                                    <TouchableOpacity
                                        key={timeStr}
                                        style={[
                                            styles.timeSlot,
                                            !available && styles.timeSlotUnavailable,
                                            isSelected && styles.timeSlotSelected,
                                        ]}
                                        onPress={() => available && setSelectedTime(slot)}
                                        disabled={!available}
                                    >
                                        <Text style={[
                                            styles.timeSlotText,
                                            !available && styles.timeSlotTextUnavailable,
                                            isSelected && styles.timeSlotTextSelected,
                                        ]}>
                                            {timeStr}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>

                    {/* Summary */}
                    {service && master && (
                        <Card variant="glass" style={styles.summaryCard}>
                            <Text style={styles.summaryTitle}>Booking Summary</Text>
                            <View style={styles.summaryRow}>
                                <Text style={styles.summaryLabel}>Service</Text>
                                <Text style={styles.summaryValue}>{service.name}</Text>
                            </View>
                            <View style={styles.summaryRow}>
                                <Text style={styles.summaryLabel}>Specialist</Text>
                                <Text style={styles.summaryValue}>{master.full_name}</Text>
                            </View>
                            <View style={styles.summaryRow}>
                                <Text style={styles.summaryLabel}>Date</Text>
                                <Text style={styles.summaryValue}>{format(selectedDate, 'EEEE, MMMM d')}</Text>
                            </View>
                            {selectedTime && (
                                <View style={styles.summaryRow}>
                                    <Text style={styles.summaryLabel}>Time</Text>
                                    <Text style={styles.summaryValue}>{format(selectedTime, 'HH:mm')}</Text>
                                </View>
                            )}
                        </Card>
                    )}
                </ScrollView>

                {/* Bottom Button */}
                <View style={styles.bottomBar}>
                    <Button
                        title="Continue"
                        onPress={handleContinue}
                        disabled={!selectedTime}
                        fullWidth
                    />
                </View>
            </SafeAreaView>
        </ScreenBackground>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    scrollView: {
        flex: 1,
    },
    header: {
        padding: spacing.lg,
    },
    backButton: {
        color: colors.textSecondary,
        fontSize: 16,
        marginBottom: spacing.md,
    },
    title: {
        fontSize: 28,
        fontWeight: '600',
        color: colors.text,
    },
    section: {
        paddingHorizontal: spacing.lg,
        marginBottom: spacing.xl,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.text,
        marginBottom: spacing.md,
    },
    datesContainer: {
        gap: spacing.sm,
    },
    dateCard: {
        width: 70,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.sm,
        borderRadius: 16,
        backgroundColor: colors.surface,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.border,
    },
    dateCardSelected: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    dateDay: {
        fontSize: 12,
        color: colors.textSecondary,
        marginBottom: spacing.xs,
    },
    dateNum: {
        fontSize: 20,
        fontWeight: '600',
        color: colors.text,
    },
    dateTextSelected: {
        color: colors.text,
    },
    todayLabel: {
        fontSize: 10,
        color: colors.textMuted,
        marginTop: spacing.xs,
    },
    timeSlotsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
    },
    timeSlot: {
        width: '22%',
        paddingVertical: spacing.md,
        borderRadius: 12,
        backgroundColor: colors.surface,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.border,
    },
    timeSlotUnavailable: {
        backgroundColor: colors.surfaceLight,
        opacity: 0.3,
    },
    timeSlotSelected: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    timeSlotText: {
        fontSize: 14,
        fontWeight: '500',
        color: colors.text,
    },
    timeSlotTextUnavailable: {
        color: colors.textMuted,
    },
    timeSlotTextSelected: {
        color: colors.text,
    },
    summaryCard: {
        margin: spacing.lg,
        padding: spacing.lg,
    },
    summaryTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.text,
        marginBottom: spacing.md,
        paddingBottom: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: spacing.sm,
    },
    summaryLabel: {
        fontSize: 14,
        color: colors.textSecondary,
    },
    summaryValue: {
        fontSize: 14,
        fontWeight: '500',
        color: colors.text,
    },
    bottomBar: {
        padding: spacing.lg,
        paddingBottom: spacing.xl,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        backgroundColor: 'transparent',
    },
});

export default SelectDateTimeScreen;
