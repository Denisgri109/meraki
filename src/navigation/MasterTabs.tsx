import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { CommonActions } from '@react-navigation/native';
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
    CreateService: undefined;
    Availability: undefined;
    Settings: undefined;
    BusinessSettings: undefined;
    LoyaltyCardBuilder: undefined;
    AftercareCampaigns: undefined;
    PhotoConsultations: undefined;
    BookingConsultations: undefined;
    ServiceSupplies: { serviceId?: string } | undefined;
    ManageRewards: undefined;
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

// Supplies Stack
export type SuppliesStackParamList = {
    SuppliesMain: undefined;
    AddSupply: { supply?: any } | undefined;
    ServiceSupplies: undefined;
};

const SuppliesStack = createNativeStackNavigator<SuppliesStackParamList>();

function SuppliesStackNavigator() {
    return (
        <SuppliesStack.Navigator screenOptions={{ headerShown: false }}>
            <SuppliesStack.Screen name="SuppliesMain" component={SuppliesScreen} />
            <SuppliesStack.Screen name="AddSupply" component={AddSupplyScreen} />
            <SuppliesStack.Screen name="ServiceSupplies" component={ServiceSuppliesScreen} />
        </SuppliesStack.Navigator>
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
    Supplies: undefined;
    Messages: undefined;
    Shop: undefined;
    Profile: undefined;
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
        <Tab.Navigator
            screenOptions={{
                headerShown: false,
                tabBarStyle: styles.tabBar,
                tabBarActiveTintColor: colors.primary,
                tabBarInactiveTintColor: 'rgba(139, 148, 158, 0.55)',
                tabBarLabelStyle: styles.tabLabel,
                tabBarShowLabel: true,
                tabBarBackground: () => (
                    <BlurView
                        tint="dark"
                        intensity={80}
                        style={StyleSheet.absoluteFill}
                    />
                ),
            }}
        >
            <Tab.Screen
                name="Dashboard"
                component={DashboardStackNavigator}
                options={{
                    tabBarIcon: ({ color }: { color: string }) => (
                        <MaterialIcons name="grid-view" size={22} color={color} />
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
                name="Supplies"
                component={SuppliesStackNavigator}
                options={{
                    tabBarIcon: ({ color }: { color: string }) => (
                        <MaterialIcons name="inventory-2" size={22} color={color} />
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
                options={{
                    tabBarIcon: ({ color }: { color: string }) => (
                        <MaterialIcons name="forum" size={22} color={color} />
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
                name="Shop"
                component={ShopStackNavigator}
                options={{
                    tabBarIcon: ({ color }: { color: string }) => (
                        <MaterialIcons name="storefront" size={22} color={color} />
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
                name="Profile"
                component={ProfileStackNavigator}
                options={{
                    tabBarIcon: ({ color }: { color: string }) => (
                        <MaterialIcons name="person-outline" size={22} color={color} />
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
        </Tab.Navigator>
    );
}

const styles = StyleSheet.create({
    tabBar: {
        position: 'absolute',
        bottom: Platform.OS === 'ios' ? 24 : 12,
        left: 20,
        right: 20,
        backgroundColor: 'rgba(22, 27, 34, 0.96)',
        borderTopWidth: 0,
        borderRadius: 32,
        height: 70,
        paddingBottom: Platform.OS === 'ios' ? 0 : 8,
        paddingTop: 8,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(48, 54, 61, 0.50)',
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
    },
    tabLabel: {
        fontSize: 10,
        fontWeight: '600',
        marginBottom: 8,
    },
});

export default MasterTabs;
