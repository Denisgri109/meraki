import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { ScreenBackground, MerakiText } from '../../components/ui';
import { colors, spacing } from '../../theme';
import { useTabBar } from '../../contexts/TabBarContext';

// Import Screens
import { AppointmentListScreen } from './AppointmentListScreen';
import { BookingScreen } from './BookingScreen';
import { ChatListScreen } from '../chat';
import { ServiceDetailScreen } from './ServiceDetailScreen';
import { SelectDateTimeScreen } from './SelectDateTimeScreen';
import { BookingConfirmScreen } from './BookingConfirmScreen';
import { ConsultationWaitingScreen } from './ConsultationWaitingScreen';
import { MasterDetailScreen } from './MasterDetailScreen';

// --- STACKS ---

export type BookingStackParamList = {
    BookingMain: undefined;
    ServiceDetail: { serviceId: string };
    MasterDetail: { masterId: string };
    SelectDateTime: { serviceId: string; masterId: string };
    BookingConfirm: { serviceId: string; masterId: string; dateTime: string; pilatesSessionId?: string };
    ConsultationWaiting: { consultationId: string; serviceId: string; masterId: string };
};

const BookingStack = createNativeStackNavigator<BookingStackParamList>();

function BookingStackNavigator() {
    return (
        <BookingStack.Navigator screenOptions={{ headerShown: false }}>
            <BookingStack.Screen name="BookingMain" component={BookingScreen} />
            <BookingStack.Screen name="ServiceDetail" component={ServiceDetailScreen} />
            <BookingStack.Screen name="MasterDetail" component={MasterDetailScreen} />
            <BookingStack.Screen name="SelectDateTime" component={SelectDateTimeScreen} />
            <BookingStack.Screen name="BookingConfirm" component={BookingConfirmScreen} />
            <BookingStack.Screen name="ConsultationWaiting" component={ConsultationWaitingScreen} />
        </BookingStack.Navigator>
    );
}

export type MessagesStackParamList = {
    MessagesMain: undefined;
};

const MessagesStack = createNativeStackNavigator<MessagesStackParamList>();

function MessagesStackNavigator() {
    return (
        <MessagesStack.Navigator screenOptions={{ headerShown: false }}>
            <MessagesStack.Screen name="MessagesMain" component={ChatListScreen} />
        </MessagesStack.Navigator>
    );
}

const AppointmentStack = createNativeStackNavigator();

function AppointmentStackNavigator() {
    return (
        <AppointmentStack.Navigator screenOptions={{ headerShown: false }}>
            <AppointmentStack.Screen name="AppointmentList" component={AppointmentListScreen} />
        </AppointmentStack.Navigator>
    );
}

// --- TAB NAVIGATOR ---

const TopTab = createMaterialTopTabNavigator();

function LazyPlaceholder() {
    return (
        <View style={styles.lazyPlaceholder}>
            <ActivityIndicator size="small" color={colors.primary} />
        </View>
    );
}

const TAB_CONFIG = [
    { name: 'Appointments', icon: 'calendar-today', label: 'Appointments' },
    { name: 'BookNew', icon: 'add-circle-outline', label: 'Book New' },
    { name: 'Messages', icon: 'chat-bubble-outline', label: 'Messages' },
];

const getLeafRouteName = (route: any): string => {
    if (route.state && route.state.routes) {
        return getLeafRouteName(route.state.routes[route.state.index ?? 0]);
    }
    return route.name;
};

const HIDDEN_SCREENS = [
    'ServiceDetail',
    'SelectDateTime',
    'BookingConfirm',
    'MasterDetail',
    'ConsultationWaiting',
];

function CustomTabBar({ state, descriptors, navigation }: any) {
    const { isTabBarVisible } = useTabBar();

    // Check if the current nested route should hide the tab bar
    const activeRoute = state.routes[state.index];
    const leafRouteName = getLeafRouteName(activeRoute);

    // Hide when in booking flow screens OR when context says hidden
    if (HIDDEN_SCREENS.includes(leafRouteName) || !isTabBarVisible) {
        return null;
    }

    return (
        <SafeAreaView edges={['top']} style={{ backgroundColor: 'transparent' }}>
            <View style={styles.tabContainer}>
                <View style={styles.tabBar}>
                    {state.routes.map((route: any, index: number) => {
                        const isFocused = state.index === index;
                        const config = TAB_CONFIG[index];

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

                        return (
                            <TouchableOpacity
                                key={route.key}
                                accessibilityRole="button"
                                accessibilityState={isFocused ? { selected: true } : {}}
                                onPress={onPress}
                                style={[styles.tabItem]}
                            >
                                {isFocused ? (
                                    <LinearGradient
                                        colors={['#E8A0B4', '#D4789C']}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 1 }}
                                        style={[StyleSheet.absoluteFillObject, { borderRadius: 11 }]}
                                    />
                                ) : null}

                                <MaterialIcons
                                    name={config.icon as any}
                                    size={18}
                                    color={isFocused ? '#fff' : 'rgba(0, 0, 0, 0.35)'}
                                    style={{ marginBottom: 2 }}
                                />
                                <Text style={[styles.tabText, isFocused && styles.tabTextActive]}>
                                    {config.label}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </View>
        </SafeAreaView>
    );
}

export function BookAndChatScreen() {
    const { isTabBarVisible } = useTabBar();

    return (
        <TopTab.Navigator
            tabBar={props => <CustomTabBar {...props} />}
            style={{ backgroundColor: colors.background }}
            screenOptions={{
                swipeEnabled: isTabBarVisible,
                lazy: true,
                lazyPlaceholder: LazyPlaceholder,
                sceneStyle: { backgroundColor: colors.background },
            }}
        >
            <TopTab.Screen
                name="Appointments"
                component={AppointmentStackNavigator}
                options={{ title: 'Appointments' }}
            />
            <TopTab.Screen
                name="BookNew"
                component={BookingStackNavigator}
                options={{ title: 'Book New' }}
            />
            <TopTab.Screen
                name="Messages"
                component={MessagesStackNavigator}
                options={{ title: 'Messages' }}
            />
        </TopTab.Navigator>
    );
}

const styles = StyleSheet.create({
    tabContainer: {
        paddingHorizontal: 20,
        paddingBottom: 8, // Reduced from 12
        paddingTop: 4, // Reduced from 8
        backgroundColor: 'transparent',
    },
    tabBar: {
        flexDirection: 'row',
        backgroundColor: 'rgba(0, 0, 0, 0.03)',
        borderRadius: 12, // Slightly reduced
        padding: 2, // Reduced from 3
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.06)',
    },
    tabItem: {
        flex: 1,
        paddingVertical: 8, // Reduced from 10
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 10, // Reduced from 11
        gap: 1,
    },
    tabItemActive: {
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    tabText: {
        fontSize: 11,
        fontWeight: '600',
        color: 'rgba(0, 0, 0, 0.35)',
    },
    tabTextActive: {
        color: '#FFFFFF',
        fontWeight: '700',
    },
    lazyPlaceholder: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.background,
    },
});
