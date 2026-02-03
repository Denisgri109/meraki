import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenBackground } from '../../components/ui';
import { colors, spacing } from '../../theme';

// Import Screens
import { AppointmentListScreen } from './AppointmentListScreen';
import { BookingScreen } from './BookingScreen';
import { ChatListScreen, ChatScreen } from '../chat';
import { ServiceDetailScreen } from './ServiceDetailScreen';
import { SelectDateTimeScreen } from './SelectDateTimeScreen';
import { BookingConfirmScreen } from './BookingConfirmScreen';

// --- STACKS ---

// Booking Stack
export type BookingStackParamList = {
    BookingMain: undefined;
    ServiceDetail: { serviceId: string };
    SelectDateTime: { serviceId: string; masterId: string };
    BookingConfirm: { serviceId: string; masterId: string; dateTime: string };
};

const BookingStack = createNativeStackNavigator<BookingStackParamList>();

function BookingStackNavigator() {
    return (
        <BookingStack.Navigator screenOptions={{ headerShown: false }}>
            <BookingStack.Screen name="BookingMain" component={BookingScreen} />
            <BookingStack.Screen name="ServiceDetail" component={ServiceDetailScreen} />
            <BookingStack.Screen name="SelectDateTime" component={SelectDateTimeScreen} />
            <BookingStack.Screen name="BookingConfirm" component={BookingConfirmScreen} />
        </BookingStack.Navigator>
    );
}

// Messages Stack
export type MessagesStackParamList = {
    ChatList: undefined;
    Chat: { conversationId: string; otherUser: any };
};

const MessagesStack = createNativeStackNavigator<MessagesStackParamList>();

function MessagesStackNavigator() {
    return (
        <MessagesStack.Navigator screenOptions={{ headerShown: false }}>
            <MessagesStack.Screen name="ChatList" component={ChatListScreen} />
            <MessagesStack.Screen name="Chat" component={ChatScreen} />
        </MessagesStack.Navigator>
    );
}

// Appointment Stack (for Chat navigation)
const AppointmentStack = createNativeStackNavigator();

function AppointmentStackNavigator() {
    return (
        <AppointmentStack.Navigator screenOptions={{ headerShown: false }}>
            <AppointmentStack.Screen name="AppointmentList" component={AppointmentListScreen} />
            <AppointmentStack.Screen name="Chat" component={ChatScreen} />
        </AppointmentStack.Navigator>
    );
}

// --- TAB NAVIGATOR ---

const TopTab = createMaterialTopTabNavigator();

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
                            <Text style={[styles.tabText, isFocused && styles.tabTextActive]}>
                                {label}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
}

export function BookAndChatScreen() {
    return (
        <ScreenBackground>
            <SafeAreaView style={styles.container} edges={['top']}>
                {/* Header */}


                <TopTab.Navigator
                    tabBar={props => <CustomTabBar {...props} />}
                    style={{ backgroundColor: colors.background }}
                    screenOptions={{
                        swipeEnabled: true,
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
            </SafeAreaView>
        </ScreenBackground>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background || '#121212', // Fallback to dark
    },

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
        paddingVertical: 10, // Slightly taller
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 12,
    },
    tabItemActive: {
        backgroundColor: colors.primary, // Pop with primary color
    },
    tabText: {
        fontSize: 13,
        fontWeight: '600',
        color: colors.textSecondary, // Readable inactive text
    },
    tabTextActive: {
        color: '#FFFFFF', // White text on primary
        fontWeight: '700',
    },
    lazyPlaceholder: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.background,
    },
});
