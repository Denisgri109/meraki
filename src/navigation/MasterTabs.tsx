import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text, StyleSheet, View } from 'react-native';
import {
    MasterDashboardScreen,
    MasterAppointmentsScreen,
    MasterAvailabilityScreen,
    MasterEarningsScreen,
    LoyaltyQRScreen,
    PortfolioScreen,
    MyServicesScreen,
    BlockedSlotsScreen,
} from '../screens/master';
import {
    ProfileScreen,
    HelpSupportScreen,
    TermsOfServiceScreen,
    PrivacyPolicyScreen,
    LoyaltyPointsScreen,
    PaymentMethodsScreen,
    NotificationsScreen,
} from '../screens/client';
import { ShopScreen, ProductDetailScreen } from '../screens/shop';
import { ChatListScreen, ChatScreen } from '../screens/chat';
import { colors } from '../theme';

// Dashboard Stack (with Chat access)
export type DashboardStackParamList = {
    DashboardMain: undefined;
    ChatList: undefined;
    Chat: { conversationId: string; otherUser: any };
    LoyaltyQR: undefined;
    Portfolio: undefined;
    MyServices: undefined;
    BlockedSlots: undefined;
};

const DashboardStack = createNativeStackNavigator<DashboardStackParamList>();

function DashboardStackNavigator() {
    return (
        <DashboardStack.Navigator screenOptions={{ headerShown: false }}>
            <DashboardStack.Screen name="DashboardMain" component={MasterDashboardScreen} />
            <DashboardStack.Screen name="ChatList" component={ChatListScreen} />
            <DashboardStack.Screen name="Chat" component={ChatScreen} />
            <DashboardStack.Screen name="LoyaltyQR" component={LoyaltyQRScreen} />
            <DashboardStack.Screen name="Portfolio" component={PortfolioScreen} />
            <DashboardStack.Screen name="MyServices" component={MyServicesScreen} />
            <DashboardStack.Screen name="BlockedSlots" component={BlockedSlotsScreen} />
        </DashboardStack.Navigator>
    );
}

// Shop Stack (Masters get wholesale pricing)
export type ShopStackParamList = {
    ShopMain: undefined;
    ProductDetail: { productId: string; product: any };
};

const ShopStack = createNativeStackNavigator<ShopStackParamList>();

function ShopStackNavigator() {
    return (
        <ShopStack.Navigator screenOptions={{ headerShown: false }}>
            <ShopStack.Screen name="ShopMain" component={ShopScreen} />
            <ShopStack.Screen name="ProductDetail" component={ProductDetailScreen} />
        </ShopStack.Navigator>
    );
}

// Profile Stack
export type ProfileStackParamList = {
    ProfileMain: undefined;
    HelpSupport: undefined;
    TermsOfService: undefined;
    PrivacyPolicy: undefined;
    LoyaltyPoints: undefined;
    PaymentMethods: undefined;
    Notifications: undefined;
};

const ProfileStack = createNativeStackNavigator<ProfileStackParamList>();

function ProfileStackNavigator() {
    return (
        <ProfileStack.Navigator screenOptions={{ headerShown: false }}>
            <ProfileStack.Screen name="ProfileMain" component={ProfileScreen} />
            <ProfileStack.Screen name="TermsOfService" component={TermsOfServiceScreen} />
            <ProfileStack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
            <ProfileStack.Screen name="PaymentMethods" component={PaymentMethodsScreen} />
            <ProfileStack.Screen name="Notifications" component={NotificationsScreen} />
        </ProfileStack.Navigator>
    );
}

export type MasterTabsParamList = {
    Dashboard: undefined;
    Appointments: undefined;
    Messages: undefined;
    Shop: undefined;
    Profile: undefined;
};

const Tab = createBottomTabNavigator<MasterTabsParamList>();

// Messages Stack for dedicated tab
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

export function MasterTabs() {
    return (
        <Tab.Navigator
            screenOptions={{
                headerShown: false,
                tabBarStyle: styles.tabBar,
                tabBarActiveTintColor: colors.text,
                tabBarInactiveTintColor: colors.textMuted,
                tabBarLabelStyle: styles.tabLabel,
            }}
            screenListeners={({ navigation, route }) => ({
                blur: () => {
                    const state = navigation.getState();
                    const currentRoute = state.routes.find((r: any) => r.key === route.key);
                    if (currentRoute?.state && typeof currentRoute.state.index === 'number' && currentRoute.state.index > 0) {
                        navigation.dispatch({
                            ...navigation.getState(),
                            type: 'RESET',
                            payload: {
                                index: state.index,
                                routes: state.routes.map((r: any) => {
                                    if (r.key === route.key) {
                                        return { ...r, state: undefined };
                                    }
                                    return r;
                                }),
                            },
                        });
                    }
                },
            })}
        >
            <Tab.Screen
                name="Dashboard"
                component={DashboardStackNavigator}
                options={{
                    tabBarIcon: ({ color }) => <Text style={[styles.icon, { color }]}>📊</Text>,
                }}
            />
            <Tab.Screen
                name="Appointments"
                component={MasterAppointmentsScreen}
                options={{
                    tabBarIcon: ({ color }) => <Text style={[styles.icon, { color }]}>📅</Text>,
                }}
            />
            <Tab.Screen
                name="Messages"
                component={MessagesStackNavigator}
                options={{
                    tabBarIcon: ({ color }) => <Text style={[styles.icon, { color }]}>💬</Text>,
                }}
            />
            <Tab.Screen
                name="Shop"
                component={ShopStackNavigator}
                options={{
                    tabBarIcon: ({ color }) => <Text style={[styles.icon, { color }]}>🛒</Text>,
                }}
            />
            <Tab.Screen
                name="Profile"
                component={ProfileStackNavigator}
                options={{
                    tabBarIcon: ({ color }) => <Text style={[styles.icon, { color }]}>👤</Text>,
                }}
            />
        </Tab.Navigator>
    );
}

const styles = StyleSheet.create({
    tabBar: {
        backgroundColor: colors.surface,
        borderTopColor: colors.border,
        borderTopWidth: 1,
        paddingTop: 8,
        paddingBottom: 24,
        height: 80,
    },
    tabLabel: {
        fontSize: 10,
        fontWeight: '500',
        marginTop: 4,
    },
    icon: {
        fontSize: 24,
    },
});

export default MasterTabs;
