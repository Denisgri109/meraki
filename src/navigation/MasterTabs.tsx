import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { CommonActions } from '@react-navigation/native';
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
    CreateServiceScreen,
    MasterSettingsScreen,
    BusinessSettingsScreen,
    LoyaltyCardBuilderScreen,
    AftercareCampaignScreen,
} from '../screens/master';
import PhotoConsultationReviewScreen from '../screens/master/PhotoConsultationReviewScreen';
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
    CreateService: undefined;
    Availability: undefined;
    Settings: undefined;
    BusinessSettings: undefined;
    LoyaltyCardBuilder: undefined;
    AftercareCampaigns: undefined;
    PhotoConsultations: undefined;
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
            <DashboardStack.Screen name="CreateService" component={CreateServiceScreen} />
            <DashboardStack.Screen name="Availability" component={MasterAvailabilityScreen} />
            <DashboardStack.Screen name="Settings" component={MasterSettingsScreen} />
            <DashboardStack.Screen name="BusinessSettings" component={BusinessSettingsScreen} />
            <DashboardStack.Screen name="LoyaltyCardBuilder" component={LoyaltyCardBuilderScreen} />
            <DashboardStack.Screen name="AftercareCampaigns" component={AftercareCampaignScreen} />
            <DashboardStack.Screen name="PhotoConsultations" component={PhotoConsultationReviewScreen} />
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
        >
            <Tab.Screen
                name="Dashboard"
                component={DashboardStackNavigator}
                options={{
                    tabBarIcon: ({ color }: { color: string }) => <Text style={[styles.icon, { color }]}>📊</Text>,
                } as any}
                listeners={({ navigation, route }) => ({
                    tabPress: (e) => {
                        e.preventDefault();
                        navigation.dispatch(
                            CommonActions.reset({
                                index: 0,
                                routes: [{ name: route.name }],
                            })
                        );
                    },
                })}
            />
            <Tab.Screen
                name="Appointments"
                component={MasterAppointmentsScreen}
                options={{
                    tabBarIcon: ({ color }: { color: string }) => <Text style={[styles.icon, { color }]}>📅</Text>,
                } as any}
                listeners={({ navigation, route }) => ({
                    tabPress: (e) => {
                        e.preventDefault();
                        navigation.dispatch(
                            CommonActions.reset({
                                index: 0,
                                routes: [{ name: route.name }],
                            })
                        );
                    },
                })}
            />
            <Tab.Screen
                name="Messages"
                component={MessagesStackNavigator}
                options={{
                    tabBarIcon: ({ color }: { color: string }) => <Text style={[styles.icon, { color }]}>💬</Text>,
                } as any}
                listeners={({ navigation, route }) => ({
                    tabPress: (e) => {
                        e.preventDefault();
                        navigation.dispatch(
                            CommonActions.reset({
                                index: 0,
                                routes: [{ name: route.name }],
                            })
                        );
                    },
                })}
            />
            <Tab.Screen
                name="Shop"
                component={ShopStackNavigator}
                options={{
                    tabBarIcon: ({ color }: { color: string }) => <Text style={[styles.icon, { color }]}>🛒</Text>,
                } as any}
                listeners={({ navigation, route }) => ({
                    tabPress: (e) => {
                        e.preventDefault();
                        navigation.dispatch(
                            CommonActions.reset({
                                index: 0,
                                routes: [{ name: route.name }],
                            })
                        );
                    },
                })}
            />
            <Tab.Screen
                name="Profile"
                component={ProfileStackNavigator}
                options={{
                    tabBarIcon: ({ color }: { color: string }) => <Text style={[styles.icon, { color }]}>👤</Text>,
                } as any}
                listeners={({ navigation, route }) => ({
                    tabPress: (e) => {
                        e.preventDefault();
                        navigation.dispatch(
                            CommonActions.reset({
                                index: 0,
                                routes: [{ name: route.name }],
                            })
                        );
                    },
                })}
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
