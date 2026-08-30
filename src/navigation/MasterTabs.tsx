import React from 'react';
import { StripeConnectGate } from '../components/StripeConnectGate';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { CommonActions, getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { Text, StyleSheet, View, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
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
    BusinessSettingsScreen,
    LoyaltyCardBuilderScreen,
    SuppliesScreen,
    AddSupplyScreen,
    ServiceSuppliesScreen,
    BookingConsultationReviewScreen,
    MasterMenuScreen,
} from '../screens/master';
import PhotoConsultationReviewScreen from '../screens/master/PhotoConsultationReviewScreen';
import { QrPaymentsScreen } from '../screens/owner';
import {
    EditProfileScreen,
    HelpSupportScreen,
    TermsOfServiceScreen,
    PrivacyPolicyScreen,
    PaymentMethodsScreen,
    NotificationsScreen,
} from '../screens/client';
import { ShopScreen, ProductDetailScreen, CartScreen, CheckoutScreen } from '../screens/shop';
import { ChatListScreen } from '../screens/chat';
import { colors } from '../theme';

// Dashboard Stack (with Chat access)
export type DashboardStackParamList = {
    DashboardMain: undefined;
    ChatList: undefined;

    LoyaltyQR: undefined;
    Portfolio: undefined;
    MyServices: undefined;
    BlockedSlots: undefined;
    CreateService: { service?: any } | undefined;
    Availability: undefined;

    BusinessSettings: undefined;
    LoyaltyCardBuilder: undefined;
    PhotoConsultations: undefined;
    BookingConsultations: undefined;
    ServiceSupplies: { serviceId?: string } | undefined;
    Notifications: undefined;
    Earnings: undefined;
    QrPayments: undefined;
};

const DashboardStack = createNativeStackNavigator<DashboardStackParamList>();

function DashboardStackNavigator() {
    return (
        <DashboardStack.Navigator screenOptions={{ headerShown: false }}>
            <DashboardStack.Screen name="DashboardMain" component={MasterDashboardScreen} />
            <DashboardStack.Screen name="ChatList" component={ChatListScreen} />

            <DashboardStack.Screen name="LoyaltyQR" component={LoyaltyQRScreen} />
            <DashboardStack.Screen name="Portfolio" component={PortfolioScreen} />
            <DashboardStack.Screen name="MyServices" component={MyServicesScreen} />
            <DashboardStack.Screen name="BlockedSlots" component={BlockedSlotsScreen} />
            <DashboardStack.Screen name="CreateService" component={CreateServiceScreen} />
            <DashboardStack.Screen name="Availability" component={MasterAvailabilityScreen} />

            <DashboardStack.Screen name="BusinessSettings" component={BusinessSettingsScreen} />
            <DashboardStack.Screen name="LoyaltyCardBuilder" component={LoyaltyCardBuilderScreen} />
            <DashboardStack.Screen name="PhotoConsultations" component={PhotoConsultationReviewScreen} />
            <DashboardStack.Screen name="BookingConsultations" component={BookingConsultationReviewScreen} />
            <DashboardStack.Screen name="ServiceSupplies" component={ServiceSuppliesScreen} />
            <DashboardStack.Screen name="Notifications" component={NotificationsScreen} />
            <DashboardStack.Screen name="Earnings" component={MasterEarningsScreen} />
            <DashboardStack.Screen name="QrPayments" component={QrPaymentsScreen} />
        </DashboardStack.Navigator>
    );
}

// Shop Stack (Masters get wholesale pricing)
export type ShopStackParamList = {
    ShopMain: undefined;
    ProductDetail: { productId: string; product: any };
    Cart: undefined;
    Checkout: undefined;
};

const ShopStack = createNativeStackNavigator<ShopStackParamList>();

function ShopStackNavigator() {
    return (
        <ShopStack.Navigator screenOptions={{ headerShown: false }}>
            <ShopStack.Screen name="ShopMain" component={ShopScreen} />
            <ShopStack.Screen name="ProductDetail" component={ProductDetailScreen} />
            <ShopStack.Screen name="Cart" component={CartScreen} />
            <ShopStack.Screen name="Checkout" component={CheckoutScreen} />
        </ShopStack.Navigator>
    );
}

// Menu Stack (replacing Profile)
export type MenuStackParamList = {
    MenuMain: undefined;
    Profile: undefined;
    Portfolio: undefined;
    MyServices: undefined;
    Availability: undefined;
    Earnings: undefined;
    Notifications: undefined;
    BusinessSettings: undefined;

    LoyaltyCardBuilder: undefined;
    BlockedSlots: undefined;
    PhotoConsultations: undefined;
    BookingConsultations: undefined;
    PaymentMethods: undefined;
    LoyaltyQR: undefined;
    HelpSupport: undefined;
    TermsOfService: undefined;
    PrivacyPolicy: undefined;
    CreateService: { service?: any } | undefined;
    ServiceSupplies: { serviceId?: string } | undefined;
    QrPayments: undefined;
};

const MenuStack = createNativeStackNavigator<MenuStackParamList>();

function MenuStackNavigator() {
    return (
        <MenuStack.Navigator screenOptions={{ headerShown: false }}>
            <MenuStack.Screen name="MenuMain" component={MasterMenuScreen} />
            <MenuStack.Screen name="Profile" component={EditProfileScreen} />
            <MenuStack.Screen name="Portfolio" component={PortfolioScreen} />
            <MenuStack.Screen name="MyServices" component={MyServicesScreen} />
            <MenuStack.Screen name="Availability" component={MasterAvailabilityScreen} />
            <MenuStack.Screen name="Earnings" component={MasterEarningsScreen} />
            <MenuStack.Screen name="Notifications" component={NotificationsScreen} />
            <MenuStack.Screen name="BusinessSettings" component={BusinessSettingsScreen} />

            <MenuStack.Screen name="LoyaltyCardBuilder" component={LoyaltyCardBuilderScreen} />
            <MenuStack.Screen name="BlockedSlots" component={BlockedSlotsScreen} />
            <MenuStack.Screen name="PhotoConsultations" component={PhotoConsultationReviewScreen} />
            <MenuStack.Screen name="BookingConsultations" component={BookingConsultationReviewScreen} />
            <MenuStack.Screen name="PaymentMethods" component={PaymentMethodsScreen} />
            <MenuStack.Screen name="LoyaltyQR" component={LoyaltyQRScreen} />
            <MenuStack.Screen name="HelpSupport" component={HelpSupportScreen} />
            <MenuStack.Screen name="TermsOfService" component={TermsOfServiceScreen} />
            <MenuStack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
            <MenuStack.Screen name="CreateService" component={CreateServiceScreen} />
            <MenuStack.Screen name="ServiceSupplies" component={ServiceSuppliesScreen} />
            <MenuStack.Screen name="QrPayments" component={QrPaymentsScreen} />
        </MenuStack.Navigator>
    );
}

export type MasterTabsParamList = {
    Dashboard: undefined;
    Appointments: undefined;
    Messages: undefined;
    Shop: undefined;
    Menu: undefined;
};

const Tab = createBottomTabNavigator<MasterTabsParamList>();

// Messages Stack for dedicated tab
export type MessagesStackParamList = {
    ChatList: undefined;
};

const MessagesStack = createNativeStackNavigator<MessagesStackParamList>();

function MessagesStackNavigator() {
    return (
        <MessagesStack.Navigator screenOptions={{ headerShown: false }}>
            <MessagesStack.Screen name="ChatList" component={ChatListScreen} />

        </MessagesStack.Navigator>
    );
}

export function MasterTabs() {
    const getTabStyle = (route: any, expectedRouteName: string) => {
        const routeName = getFocusedRouteNameFromRoute(route) ?? expectedRouteName;
        if (routeName !== expectedRouteName) {
            return { display: 'none' };
        }
        return styles.tabBar;
    };

    return (
        <>
            <StripeConnectGate />
            <Tab.Navigator
                screenOptions={{
                    headerShown: false,
                    tabBarStyle: styles.tabBar,
                    tabBarActiveTintColor: '#000000',
                    tabBarInactiveTintColor: 'rgba(156, 163, 175, 0.70)',
                    tabBarLabelStyle: styles.tabLabel,
                    tabBarShowLabel: true,
                }}
            >
                <Tab.Screen
                    name="Dashboard"
                    component={DashboardStackNavigator}
                    options={({ route }) => ({
                        tabBarIcon: ({ color }: { color: string }) => (
                            <MaterialIcons name="grid-view" size={22} color={color} />
                        ),
                        tabBarStyle: getTabStyle(route, 'DashboardMain'),
                    } as any)}
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
                        tabBarIcon: ({ color }: { color: string }) => (
                            <MaterialIcons name="event-note" size={22} color={color} />
                        ),
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
                    options={({ route }) => ({
                        tabBarIcon: ({ color }: { color: string }) => (
                            <MaterialIcons name="forum" size={22} color={color} />
                        ),
                        tabBarStyle: getTabStyle(route, 'ChatList'),
                    } as any)}
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
                    options={({ route }) => ({
                        tabBarIcon: ({ color }: { color: string }) => (
                            <MaterialIcons name="storefront" size={22} color={color} />
                        ),
                        tabBarStyle: getTabStyle(route, 'ShopMain'),
                    } as any)}
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
                    name="Menu"
                    component={MenuStackNavigator}
                    options={({ route }) => ({
                        tabBarIcon: ({ color }: { color: string }) => (
                            <MaterialIcons name="settings" size={22} color={color} />
                        ),
                        tabBarStyle: getTabStyle(route, 'MenuMain'),
                    } as any)}
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
        </>
    );
}

const styles = StyleSheet.create({
    tabBar: {
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
        height: Platform.OS === 'ios' ? 85 : 65,
        paddingBottom: Platform.OS === 'ios' ? 28 : 10,
        paddingTop: 8,
        elevation: 0,
        shadowOpacity: 0,
    },
    tabLabel: {
        fontSize: 10,
        fontWeight: '500',
        marginBottom: Platform.OS === 'ios' ? 0 : 4,
    },
});

export default MasterTabs;
