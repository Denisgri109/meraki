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
    MasterSettingsScreen,
    BusinessSettingsScreen,
    LoyaltyCardBuilderScreen,
    AftercareCampaignScreen,
    SuppliesScreen,
    AddSupplyScreen,
    ServiceSuppliesScreen,
    BookingConsultationReviewScreen,
    ManageRewardsScreen,
    MasterMenuScreen,
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
    Settings: undefined;
    BusinessSettings: undefined;
    LoyaltyCardBuilder: undefined;
    AftercareCampaigns: undefined;
    PhotoConsultations: undefined;
    BookingConsultations: undefined;
    ServiceSupplies: { serviceId?: string } | undefined;
    ManageRewards: undefined;
    Notifications: undefined;
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
            <DashboardStack.Screen name="Settings" component={MasterSettingsScreen} />
            <DashboardStack.Screen name="BusinessSettings" component={BusinessSettingsScreen} />
            <DashboardStack.Screen name="LoyaltyCardBuilder" component={LoyaltyCardBuilderScreen} />
            <DashboardStack.Screen name="AftercareCampaigns" component={AftercareCampaignScreen} />
            <DashboardStack.Screen name="PhotoConsultations" component={PhotoConsultationReviewScreen} />
            <DashboardStack.Screen name="BookingConsultations" component={BookingConsultationReviewScreen} />
            <DashboardStack.Screen name="ServiceSupplies" component={ServiceSuppliesScreen} />
            <DashboardStack.Screen name="ManageRewards" component={ManageRewardsScreen} />
            <DashboardStack.Screen name="Notifications" component={NotificationsScreen} />
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
    Settings: undefined;
    LoyaltyCardBuilder: undefined;
    AftercareCampaigns: undefined;
    ManageRewards: undefined;
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
};

const MenuStack = createNativeStackNavigator<MenuStackParamList>();

function MenuStackNavigator() {
    return (
        <MenuStack.Navigator screenOptions={{ headerShown: false }}>
            <MenuStack.Screen name="MenuMain" component={MasterMenuScreen} />
            <MenuStack.Screen name="Profile" component={ProfileScreen} />
            <MenuStack.Screen name="Portfolio" component={PortfolioScreen} />
            <MenuStack.Screen name="MyServices" component={MyServicesScreen} />
            <MenuStack.Screen name="Availability" component={MasterAvailabilityScreen} />
            <MenuStack.Screen name="Earnings" component={MasterEarningsScreen} />
            <MenuStack.Screen name="Notifications" component={NotificationsScreen} />
            <MenuStack.Screen name="BusinessSettings" component={BusinessSettingsScreen} />
            <MenuStack.Screen name="Settings" component={MasterSettingsScreen} />
            <MenuStack.Screen name="LoyaltyCardBuilder" component={LoyaltyCardBuilderScreen} />
            <MenuStack.Screen name="AftercareCampaigns" component={AftercareCampaignScreen} />
            <MenuStack.Screen name="ManageRewards" component={ManageRewardsScreen} />
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
                        tabBarStyle: ((route) => {
                            const routeName = getFocusedRouteNameFromRoute(route) ?? 'DashboardMain';
                            if (routeName !== 'DashboardMain') {
                                return { display: 'none' };
                            }
                            return styles.tabBar;
                        })(route),
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
                        tabBarStyle: ((route) => {
                            const routeName = getFocusedRouteNameFromRoute(route) ?? 'ChatList';
                            if (routeName !== 'ChatList') {
                                return { display: 'none' };
                            }
                            return styles.tabBar;
                        })(route),
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
                        tabBarStyle: ((route) => {
                            const routeName = getFocusedRouteNameFromRoute(route) ?? 'ShopMain';
                            if (routeName !== 'ShopMain') {
                                return { display: 'none' };
                            }
                            return styles.tabBar;
                        })(route),
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
                        tabBarStyle: ((route) => {
                            const routeName = getFocusedRouteNameFromRoute(route) ?? 'MenuMain';
                            if (routeName !== 'MenuMain') {
                                return { display: 'none' };
                            }
                            return styles.tabBar;
                        })(route),
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
