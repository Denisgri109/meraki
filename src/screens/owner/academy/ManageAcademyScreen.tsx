import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { supabase } from '../../../lib/supabase';
import { ScreenBackground } from '../../../components/ui';
import { colors, spacing } from '../../../theme';
import { CoursesListScreen } from './CoursesListScreen';
import { HomeworkInboxScreen } from './HomeworkInboxScreen';
import { AcademyStudentsScreen } from './AcademyStudentsScreen';

const Tab = createMaterialTopTabNavigator();

export function ManageAcademyScreen() {
    const navigation = useNavigation<any>();
    const [pendingCount, setPendingCount] = useState(0);

    // Use useFocusEffect to refresh pending count every time screen is focused
    useFocusEffect(
        useCallback(() => {
            fetchPendingCount();
        }, [])
    );

    const fetchPendingCount = async () => {
        const { count } = await (supabase as any)
            .from('homework_submissions')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'pending');
        setPendingCount(count || 0);
    };

    return (
        <ScreenBackground>
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()}>
                        <Text style={styles.backButton}>←</Text>
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Manage Academy</Text>
                    <View style={{ width: 40 }} />
                </View>

                <Tab.Navigator
                    screenOptions={{
                        tabBarStyle: styles.tabBar,
                        tabBarLabelStyle: styles.tabLabel,
                        tabBarIndicatorStyle: styles.tabIndicator,
                        tabBarActiveTintColor: colors.primary,
                        tabBarInactiveTintColor: colors.textMuted,
                    }}
                >
                    <Tab.Screen name="Courses" component={CoursesListScreen} />
                    <Tab.Screen
                        name="Inbox"
                        component={HomeworkInboxScreen}
                        options={{
                            tabBarBadge: () => pendingCount > 0 ? (
                                <View style={styles.badge}>
                                    <Text style={styles.badgeText}>{pendingCount}</Text>
                                </View>
                            ) : <></>,
                        }}
                    />
                    <Tab.Screen name="Students" component={AcademyStudentsScreen} />
                </Tab.Navigator>
            </SafeAreaView>
        </ScreenBackground>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    backButton: { fontSize: 28, color: colors.text },
    headerTitle: { fontSize: 18, fontWeight: '600', color: colors.text },
    tabBar: {
        backgroundColor: 'transparent',
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        elevation: 0,
        shadowOpacity: 0,
    },
    tabLabel: { fontSize: 13, fontWeight: '600', textTransform: 'none' },
    tabIndicator: { backgroundColor: colors.primary, height: 3 },
    badge: {
        backgroundColor: colors.error,
        borderRadius: 10,
        minWidth: 20,
        height: 20,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 4,
    },
    badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
});

export default ManageAcademyScreen;
