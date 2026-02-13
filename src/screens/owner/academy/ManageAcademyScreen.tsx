import React, { useState, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../../../lib/supabase';
import { ScreenBackground, MerakiText } from '../../../components/ui';
import { colors, spacing } from '../../../theme';
import { CoursesListScreen } from './CoursesListScreen';
import { HomeworkInboxScreen } from './HomeworkInboxScreen';
import { AcademyStudentsScreen } from './AcademyStudentsScreen';

const Tab = createMaterialTopTabNavigator();

// Lazy placeholder to prevent white flash during tab loading
function LazyPlaceholder() {
    return (
        <View style={styles.lazyPlaceholder}>
            <ActivityIndicator size="small" color={colors.primary} />
        </View>
    );
}

function CustomTabBar({ state, descriptors, navigation }: any) {
    return (
        <View style={styles.tabContainer}>
            <View style={styles.tabBar}>
                {state.routes.map((route: any, index: number) => {
                    const { options } = descriptors[route.key];
                    const label =
                        options.tabBarLabel !== undefined
                            ? options.tabBarLabel
                            : options.title !== undefined
                                ? options.title
                                : route.name;

                    const isFocused = state.index === index;

                    const onPress = () => {
                        const event = navigation.emit({
                            type: 'tabPress',
                            target: route.key,
                            canPreventDefault: true,
                        });

                        if (!isFocused && !event.defaultPrevented) {
                            navigation.navigate(route.name, route.params);
                        }
                    };

                    // Render badge if it exists in options
                    const Badge = options.tabBarBadge;

                    return (
                        <TouchableOpacity
                            key={route.key}
                            accessibilityRole="button"
                            accessibilityState={isFocused ? { selected: true } : {}}
                            accessibilityLabel={options.tabBarAccessibilityLabel}
                            testID={options.tabBarTestID}
                            onPress={onPress}
                            style={[styles.tabItem, isFocused && styles.tabItemActive]}
                        >
                            <View style={styles.tabContentContainer}>
                                <MerakiText
                                    variant="caption"
                                    style={[
                                        styles.tabText,
                                        isFocused && styles.tabTextActive
                                    ]}
                                >
                                    {label}
                                </MerakiText>
                                {Badge && <Badge />}
                            </View>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
}

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
        <View style={styles.container}>
            <SafeAreaView style={styles.safeArea} edges={['top']}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <MerakiText variant="h3" style={styles.headerTitle}>Manage Academy</MerakiText>
                    <View style={{ width: 24 }} />
                </View>

                <Tab.Navigator
                    tabBar={props => <CustomTabBar {...props} />}
                    screenOptions={{
                        swipeEnabled: true,
                        lazy: true,
                        lazyPlaceholder: LazyPlaceholder,
                        sceneStyle: { backgroundColor: 'transparent' }, // Use transparent to let ScreenBackground show through
                    }}
                >
                    <Tab.Screen name="Courses" component={CoursesListScreen} />
                    <Tab.Screen
                        name="Inbox"
                        component={HomeworkInboxScreen}
                        options={{
                            tabBarBadge: () => pendingCount > 0 ? (
                                <View style={styles.badge}>
                                    <MerakiText variant="caption" style={styles.badgeText}>{pendingCount}</MerakiText>
                                </View>
                            ) : <></>,
                        }}
                    />
                    <Tab.Screen name="Students" component={AcademyStudentsScreen} />
                </Tab.Navigator>
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    safeArea: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        marginBottom: spacing.sm,
    },
    headerTitle: { fontWeight: '600', color: colors.text },

    // Tab Styles
    tabContainer: {
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.md,
        backgroundColor: 'transparent',
    },
    tabBar: {
        flexDirection: 'row',
        backgroundColor: colors.surface, // Dark background
        borderRadius: 16,
        padding: 4,
        borderWidth: 1,
        borderColor: colors.border,
    },
    tabItem: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 12,
    },
    tabItemActive: {
        backgroundColor: colors.primary,
    },
    tabContentContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
    },
    tabText: {
        fontWeight: '600',
        color: colors.textSecondary,
    },
    tabTextActive: {
        color: '#FFFFFF',
        fontWeight: '700',
    },

    // Badge Styles
    badge: {
        backgroundColor: colors.error,
        borderRadius: 8, // Smaller radius for the pill look
        minWidth: 16,
        height: 16,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 4,
    },
    badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },

    // Lazy Placeholder
    lazyPlaceholder: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'transparent',
    },
});

export default ManageAcademyScreen;
