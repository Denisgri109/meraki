import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from '../../components/ui';
import { ScreenBackground } from '../../components/ui';
import { colors, spacing } from '../../theme';

export function MasterScheduleScreen() {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay() + 1);

    return (
        <ScreenBackground>
            <SafeAreaView style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.title}>Schedule</Text>
                </View>

                {/* Week Navigation */}
                <View style={styles.weekNav}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        {days.map((day, index) => {
                            const date = new Date(startOfWeek);
                            date.setDate(startOfWeek.getDate() + index);
                            const isToday = date.toDateString() === today.toDateString();

                            return (
                                <View
                                    key={day}
                                    style={[styles.dayCard, isToday && styles.dayCardActive]}
                                >
                                    <Text style={[styles.dayName, isToday && styles.dayTextActive]}>
                                        {day}
                                    </Text>
                                    <Text style={[styles.dayNumber, isToday && styles.dayTextActive]}>
                                        {date.getDate()}
                                    </Text>
                                </View>
                            );
                        })}
                    </ScrollView>
                </View>

                {/* Schedule */}
                <ScrollView contentContainerStyle={styles.content}>
                    <Card variant="glass" style={styles.emptyCard}>
                        <Text style={styles.emptyIcon}>📋</Text>
                        <Text style={styles.emptyText}>No appointments scheduled</Text>
                        <Text style={styles.emptySubtext}>
                            Your appointments will appear here
                        </Text>
                    </Card>
                </ScrollView>
            </SafeAreaView>
        </ScreenBackground>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.lg,
        paddingBottom: spacing.md,
    },
    title: {
        fontSize: 28,
        fontWeight: '600',
        color: colors.text,
    },
    weekNav: {
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    dayCard: {
        alignItems: 'center',
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.lg,
        marginHorizontal: spacing.xs,
        borderRadius: 12,
    },
    dayCardActive: {
        backgroundColor: colors.secondary,
    },
    dayName: {
        fontSize: 12,
        color: colors.textSecondary,
        marginBottom: spacing.xs,
    },
    dayNumber: {
        fontSize: 18,
        fontWeight: '600',
        color: colors.text,
    },
    dayTextActive: {
        color: colors.primary,
    },
    content: {
        padding: spacing.lg,
        flex: 1,
    },
    emptyCard: {
        alignItems: 'center',
        padding: spacing.xl,
    },
    emptyIcon: {
        fontSize: 64,
        marginBottom: spacing.lg,
        opacity: 0.5,
    },
    emptyText: {
        fontSize: 18,
        fontWeight: '600',
        color: colors.text,
        marginBottom: spacing.xs,
    },
    emptySubtext: {
        fontSize: 14,
        color: colors.textSecondary,
    },
});

export default MasterScheduleScreen;
