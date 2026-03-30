import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { format, addDays, startOfDay, setHours, setMinutes, isBefore } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { safeSupabaseFetch } from '../../lib/supabaseApi';
import { Button, Card, ScreenBackground } from '../../components/ui';
import { colors, spacing } from '../../theme';
import { Service, Profile } from '../../types/database';
import { getDeviceTimezone, getTimezoneAbbreviation, COMMON_TIMEZONES } from '../../utils/timezone';
import { useHideTabBar } from '../../hooks/useHideTabBar';

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
    useHideTabBar();
    const { serviceId, masterId } = route.params;
    const [service, setService] = useState<Service | null>(null);
    const [master, setMaster] = useState<Profile | null>(null);
    const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()));
    const [selectedTime, setSelectedTime] = useState<Date | null>(null);
    const [bookedSlots, setBookedSlots] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [isFetchingSlots, setIsFetchingSlots] = useState(false);
    const [masterAvailability, setMasterAvailability] = useState<any[]>([]);
    const [blockedSlots, setBlockedSlots] = useState<any[]>([]);

    const dates = generateDates();

    // Get availability for selected day
    const getDayAvailability = () => {
        const dayOfWeek = selectedDate.getDay(); // 0 = Sunday, 6 = Saturday
        const dayAvailability = masterAvailability.find(
            (a) => a.day_of_week === dayOfWeek && a.is_available
        );
        return dayAvailability;
    };

    // Generate time slots based on master's availability for selected day
    const generateTimeSlotsForDay = () => {
        const dayAvailability = getDayAvailability();

        if (!dayAvailability) {
            return []; // Master not available on this day
        }

        const slots = [];
        // Parse start and end times (format: "HH:mm:ss" or "HH:mm")
        const [startHour, startMin] = dayAvailability.start_time.split(':').map(Number);
        const [endHour, endMin] = dayAvailability.end_time.split(':').map(Number);

        let currentHour = startHour;
        let currentMin = startMin || 0;

        while (currentHour < endHour || (currentHour === endHour && currentMin < endMin)) {
            slots.push(setMinutes(setHours(new Date(), currentHour), currentMin));
            // Increment by 30 minutes
            currentMin += 30;
            if (currentMin >= 60) {
                currentMin = 0;
                currentHour++;
            }
        }

        return slots;
    };

    const timeSlots = generateTimeSlotsForDay();

    useEffect(() => {
        fetchData();
    }, []);

    useEffect(() => {
        if (master) {
            fetchBookedSlots();
        }
    }, [selectedDate, master]);

    const fetchData = async () => {
        try {
            const servicePromise = supabase.from('services').select('*').eq('id', serviceId).single();
            const masterPromise = supabase.from('profiles').select('*').eq('id', masterId).single();
            const availabilityPromise = supabase
                .from('master_availability')
                .select('*')
                .eq('master_id', masterId)
                .order('day_of_week');
            const blockedPromise = supabase
                .from('blocked_slots')
                .select('*')
                .eq('master_id', masterId);

            const [serviceRes, masterRes, availabilityRes, blockedRes] = await Promise.all([
                safeSupabaseFetch(servicePromise as any, { timeout: 5000 }),
                safeSupabaseFetch(masterPromise as any, { timeout: 5000 }),
                safeSupabaseFetch(availabilityPromise as any, { timeout: 5000 }),
                safeSupabaseFetch(blockedPromise as any, { timeout: 5000 }),
            ]);

            setService(serviceRes.data as Service);
            setMaster(masterRes.data as Profile);
            setMasterAvailability((availabilityRes.data as any[]) || []);
            setBlockedSlots((blockedRes.data as any[]) || []);
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchBookedSlots = async () => {
        try {
            setIsFetchingSlots(true);
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

            // Double check selected time is still available (if any)
            if (selectedTime) {
                const timeStr = `${selectedTime.getHours()}:${selectedTime.getMinutes().toString().padStart(2, '0')}`;
                if (booked.includes(timeStr)) {
                    setSelectedTime(null);
                }
            }
        } catch (error) {
            console.error('Error fetching booked slots:', error);
        } finally {
            setIsFetchingSlots(false);
        }
    };

    const isSlotAvailable = (slot: Date) => {
        const timeKey = `${slot.getHours()}:${slot.getMinutes().toString().padStart(2, '0')}`;

        // Check if already booked
        if (bookedSlots.includes(timeKey)) return false;

        // Check if slot is in the past
        const now = new Date();
        const slotDateTime = new Date(selectedDate);
        slotDateTime.setHours(slot.getHours(), slot.getMinutes());
        if (isBefore(slotDateTime, now)) return false;

        // Check blocked slots
        for (const blocked of blockedSlots) {
            const blockStart = new Date(blocked.start_time);
            const blockEnd = new Date(blocked.end_time);
            if (slotDateTime >= blockStart && slotDateTime < blockEnd) {
                return false;
            }
        }

        return true;
    };

    // Check if a day is available for the master
    const isDayAvailable = (date: Date) => {
        const dayOfWeek = date.getDay();
        const dayAvailability = masterAvailability.find(
            (a) => a.day_of_week === dayOfWeek && a.is_available
        );
        return !!dayAvailability;
    };

    const handleContinue = () => {
        if (selectedTime) {
            if (!isSlotAvailable(selectedTime)) {
                // Safety check: Don't allow continuing if slot is not available
                setSelectedTime(null);
                return;
            }

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
            <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
                <ScrollView style={styles.scrollView}>
                    {/* Header */}
                    <View style={styles.header}>
                        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                            <MaterialIcons name="arrow-back" size={22} color="rgba(0, 0, 0, 0.55)" />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>Select Date & Time</Text>
                        <View style={{ width: 40 }} />
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
                                const isAvailable = masterAvailability.length === 0 || isDayAvailable(date);

                                return (
                                    <TouchableOpacity
                                        key={date.toISOString()}
                                        style={[
                                            styles.dateCard,
                                            isSelected && styles.dateCardSelected,
                                            !isAvailable && styles.dateCardUnavailable,
                                        ]}
                                        onPress={() => {
                                            if (isAvailable) {
                                                setSelectedDate(date);
                                                setSelectedTime(null);
                                            }
                                        }}
                                        disabled={!isAvailable}
                                    >
                                        <Text style={[
                                            styles.dateDay,
                                            isSelected && styles.dateTextSelected,
                                            !isAvailable && styles.dateTextUnavailable,
                                        ]}>
                                            {format(date, 'EEE')}
                                        </Text>
                                        <Text style={[
                                            styles.dateNum,
                                            isSelected && styles.dateTextSelected,
                                            !isAvailable && styles.dateTextUnavailable,
                                        ]}>
                                            {format(date, 'd')}
                                        </Text>
                                        {isToday && <Text style={styles.todayLabel}>Today</Text>}
                                        {!isAvailable && <Text style={styles.offLabel}>Off</Text>}
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </View>

                    {/* Time Selection */}
                    <View style={styles.section}>
                        <View style={styles.sectionTitleRow}>
                            <Text style={styles.sectionTitle}>Choose a Time</Text>
                            {master?.timezone && (
                                <View style={styles.timezoneHint}>
                                    <MaterialIcons name="language" size={12} color={colors.textMuted} style={{ marginRight: 4 }} />
                                    <Text style={styles.timezoneHintText}>
                                        {getTimezoneAbbreviation(master.timezone)} ({master.city || 'Master\'s time'})
                                    </Text>
                                </View>
                            )}
                        </View>
                        {timeSlots.length > 0 ? (
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
                                                (!available || isFetchingSlots) && styles.timeSlotUnavailable,
                                                isSelected && styles.timeSlotSelected,
                                            ]}
                                            onPress={() => available && !isFetchingSlots && setSelectedTime(slot)}
                                            disabled={!available || isFetchingSlots}
                                        >
                                            <Text style={[
                                                styles.timeSlotText,
                                                (!available || isFetchingSlots) && styles.timeSlotTextUnavailable,
                                                isSelected && styles.timeSlotTextSelected,
                                            ]}>
                                                {timeStr}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        ) : (
                            <View style={styles.noSlotsContainer}>
                                <Text style={styles.noSlotsText}>
                                    {masterAvailability.length === 0
                                        ? 'This specialist hasn\'t set their availability yet. Please try another day or contact them directly.'
                                        : 'No time slots available for this day. Please select a different date.'}
                                </Text>
                            </View>
                        )}
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
                        disabled={!selectedTime || isFetchingSlots}
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
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
    },
    backButton: {
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: 'rgba(0, 0, 0, 0.03)',
        borderWidth: 1, borderColor: 'rgba(0, 0, 0, 0.06)',
        alignItems: 'center', justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 17, fontWeight: '600', color: '#1A1A1A',
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
    sectionTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: spacing.md,
    },
    timezoneHint: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(200, 160, 77, 0.15)',
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: 8,
    },
    timezoneHintText: {
        fontSize: 12,
        color: colors.textMuted,
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
        backgroundColor: '#E8A0B4',
        borderColor: '#E8A0B4',
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
        color: '#FFFFFF',
    },
    todayLabel: {
        fontSize: 10,
        color: colors.textMuted,
        marginTop: spacing.xs,
    },
    dateCardUnavailable: {
        opacity: 0.4,
        backgroundColor: colors.surfaceLight,
    },
    dateTextUnavailable: {
        color: colors.textMuted,
    },
    offLabel: {
        fontSize: 9,
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
        backgroundColor: '#E8A0B4',
        borderColor: '#E8A0B4',
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
        color: '#FFFFFF',
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
        borderBottomColor: 'rgba(0, 0, 0, 0.08)',
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
    noSlotsContainer: {
        padding: spacing.xl,
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.02)',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
    },
    noSlotsText: {
        fontSize: 14,
        color: colors.textSecondary,
        textAlign: 'center',
        lineHeight: 20,
    },
});

export default SelectDateTimeScreen;
