import React from 'react';
import {
    View,
    StyleSheet,
    ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Card, ScreenBackground, MerakiText } from '../../components/ui';
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
                    <MerakiText variant="h1">Schedule</MerakiText>
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
                                    <MerakiText variant="caption" color={isToday ? colors.primary : colors.textSecondary} style={styles.dayName}>
                                        {day}
                                    </MerakiText>
                                    <MerakiText variant="body" color={isToday ? colors.primary : colors.text} style={styles.dayNumber}>
                                        {date.getDate()}
                                    </MerakiText>
                                </View>
                            );
                        })}
                    </ScrollView>
                </View>

                {/* Schedule */}
                <ScrollView contentContainerStyle={styles.content}>
                    <Card variant="glass" style={styles.emptyCard}>
                        <View style={styles.emptyIconBg}>
                            <MaterialCommunityIcons name="clipboard-text-outline" size={40} color={colors.textMuted} />
                        </View>
                        <MerakiText variant="body" color={colors.text} style={styles.emptyText}>
                            No appointments scheduled
                        </MerakiText>
                        <MerakiText variant="caption" color={colors.textSecondary}>
                            Your appointments will appear here
                        </MerakiText>
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
        marginBottom: spacing.xs,
    },
    dayNumber: {
        fontWeight: '600',
    },
    content: {
        padding: spacing.lg,
        flex: 1,
    },
    emptyCard: {
        alignItems: 'center',
        padding: spacing.xl,
    },
    emptyIconBg: {
        width: 72,
        height: 72,
        borderRadius: 20,
        backgroundColor: 'rgba(212,168,83,0.08)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.md,
    },
    emptyText: {
        fontWeight: '600',
        marginBottom: spacing.xs,
    },
});

export default MasterScheduleScreen;
