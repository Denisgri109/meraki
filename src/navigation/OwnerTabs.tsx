import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { CommonActions, getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { Text, Platform, StyleSheet, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { colors, spacing } from '../theme';
import {
    OwnerDashboardScreen,
    ServiceListScreen,
    ServiceFormScreen,
    InventoryScreen,
    OwnerSuppliesScreen,
    AddOwnerSupplyScreen,
    PlatformAnalyticsScreen,
    OwnerOrdersScreen,
    OwnerOrderDetailScreen,
    OwnerMenuScreen,
} from '../screens/owner';
import {
    ManageAcademyScreen,
    CourseEditorScreen,
    LessonEditorScreen,
    HomeworkReviewScreen,
    StudentDetailScreen,
} from '../screens/owner/academy';
import {
    MasterAppointmentsScreen,
    LoyaltyQRScreen,
    MasterAvailabilityScreen,
    PortfolioScreen,
    MyServicesScreen,
    BlockedSlotsScreen,
    CreateServiceScreen,
    MasterSettingsScreen,
    ServiceSuppliesScreen,
    BusinessSettingsScreen,
    LoyaltyCardBuilderScreen,
    AftercareCampaignScreen,
    SuppliesScreen,
    AddSupplyScreen,
    BookingConsultationReviewScreen,
    ManageRewardsScreen,
    MasterEarningsScreen,
} from '../screens/master';
import PhotoConsultationReviewScreen from '../screens/master/PhotoConsultationReviewScreen';
import {
    ProfileScreen,
    HelpSupportScreen,
    TermsOfServiceScreen,
    PrivacyPolicyScreen,
    PaymentMethodsScreen,
    NotificationsScreen,
} from '../screens/client';
import { ShopScreen, ProductDetailScreen } from '../screens/shop';
import { ChatListScreen } from '../screens/chat';


// Dashboard Stack (with management access)
export type OwnerDashboardStackParamList = {
    DashboardMain: undefined;
    Services: undefined;
    ServiceForm: { service?: any } | undefined;
    Inventory: undefined;
    ProductDetail: { productId: string; product: any };
    LoyaltyQR: undefined;
    Availability: undefined;
    Portfolio: undefined;
    MyServices: undefined;
    BlockedSlots: undefined;
    CreateService: undefined;
    Settings: undefined;
    ServiceSupplies: { serviceId?: string } | undefined;
    OwnerSupplies: undefined;
    AddOwnerSupply: { supply?: any } | undefined;

    BusinessSettings: undefined;
    LoyaltyCardBuilder: undefined;
    AftercareCampaigns: undefined;
    PhotoConsultations: undefined;
    BookingConsultations: undefined;
    ManageRewards: undefined;
    PlatformAnalytics: undefined;
    CustomerOrders: undefined;
    OrderDetail: { order: any };
};

const DashboardStack = createNativeStackNavigator<OwnerDashboardStackParamList>();

function DashboardStackNavigator() {
    return (
        <DashboardStack.Navigator screenOptions={{ headerShown: false }}>
            <DashboardStack.Screen name="DashboardMain" component={OwnerDashboardScreen} />
            <DashboardStack.Screen name="Services" component={ServiceListScreen} />
            <DashboardStack.Screen name="ServiceForm" component={ServiceFormScreen} />
            <DashboardStack.Screen name="Inventory" component={InventoryScreen} />
            <DashboardStack.Screen name="ProductDetail" component={ProductDetailScreen} />
            <DashboardStack.Screen name="LoyaltyQR" component={LoyaltyQRScreen} />
            <DashboardStack.Screen name="Availability" component={MasterAvailabilityScreen} />
            <DashboardStack.Screen name="Portfolio" component={PortfolioScreen} />
            <DashboardStack.Screen name="MyServices" component={MyServicesScreen} />
            <DashboardStack.Screen name="BlockedSlots" component={BlockedSlotsScreen} />
            <DashboardStack.Screen name="CreateService" component={CreateServiceScreen} />
            <DashboardStack.Screen name="Settings" component={MasterSettingsScreen} />
            <DashboardStack.Screen name="ServiceSupplies" component={ServiceSuppliesScreen} />
            <DashboardStack.Screen name="OwnerSupplies" component={OwnerSuppliesScreen} />
            <DashboardStack.Screen name="AddOwnerSupply" component={AddOwnerSupplyScreen} />
            <DashboardStack.Screen name="BusinessSettings" component={BusinessSettingsScreen} />
            <DashboardStack.Screen name="LoyaltyCardBuilder" component={LoyaltyCardBuilderScreen} />
            <DashboardStack.Screen name="AftercareCampaigns" component={AftercareCampaignScreen} />
            <DashboardStack.Screen name="PhotoConsultations" component={PhotoConsultationReviewScreen} />
            <DashboardStack.Screen name="BookingConsultations" component={BookingConsultationReviewScreen} />
            <DashboardStack.Screen name="ManageRewards" component={ManageRewardsScreen} />
            <DashboardStack.Screen name="PlatformAnalytics" component={PlatformAnalyticsScreen} />
            <DashboardStack.Screen name="CustomerOrders" component={OwnerOrdersScreen} />
            <DashboardStack.Screen name="OrderDetail" component={OwnerOrderDetailScreen} />
        </DashboardStack.Navigator>
    );
}

// Messages Stack
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

// Shop Stack
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

// Menu Stack (replacing Profile)
export type MenuStackParamList = {
    MenuMain: undefined;
    Profile: undefined;
    Availability: undefined;
    Portfolio: undefined;
    MyServices: undefined;
    PlatformAnalytics: undefined;
    Notifications: undefined;
    BusinessSettings: undefined;
    Settings: undefined;
    Inventory: undefined;
    OwnerSupplies: undefined;
    CustomerOrders: undefined;
    OrderDetail: { order: any };
    Services: undefined;
    ServiceForm: { service?: any } | undefined;
    BlockedSlots: undefined;
    LoyaltyCardBuilder: undefined;
    AftercareCampaigns: undefined;
    BookingConsultations: undefined;
    PhotoConsultations: undefined;
    ManageRewards: undefined;
    LoyaltyQR: undefined;
    PaymentMethods: undefined;
    HelpSupport: undefined;
    TermsOfService: undefined;
    PrivacyPolicy: undefined;
    AddOwnerSupply: { supply?: any } | undefined;
    CreateService: undefined;
    ServiceSupplies: { serviceId?: string } | undefined;
};

const MenuStack = createNativeStackNavigator<MenuStackParamList>();

function MenuStackNavigator() {
    return (
        <MenuStack.Navigator screenOptions={{ headerShown: false }}>
            <MenuStack.Screen name="MenuMain" component={OwnerMenuScreen} />
            <MenuStack.Screen name="Profile" component={ProfileScreen} />
            <MenuStack.Screen name="Availability" component={MasterAvailabilityScreen} />
            <MenuStack.Screen name="Portfolio" component={PortfolioScreen} />
            <MenuStack.Screen name="MyServices" component={MyServicesScreen} />
            <MenuStack.Screen name="PlatformAnalytics" component={PlatformAnalyticsScreen} />
            <MenuStack.Screen name="Notifications" component={NotificationsScreen} />
            <MenuStack.Screen name="BusinessSettings" component={BusinessSettingsScreen} />
            <MenuStack.Screen name="Settings" component={MasterSettingsScreen} />
            <MenuStack.Screen name="Inventory" component={InventoryScreen} />
            <MenuStack.Screen name="OwnerSupplies" component={OwnerSuppliesScreen} />
            <MenuStack.Screen name="CustomerOrders" component={OwnerOrdersScreen} />
            <MenuStack.Screen name="OrderDetail" component={OwnerOrderDetailScreen} />
            <MenuStack.Screen name="Services" component={ServiceListScreen} />
            <MenuStack.Screen name="ServiceForm" component={ServiceFormScreen} />
            <MenuStack.Screen name="BlockedSlots" component={BlockedSlotsScreen} />
            <MenuStack.Screen name="LoyaltyCardBuilder" component={LoyaltyCardBuilderScreen} />
            <MenuStack.Screen name="AftercareCampaigns" component={AftercareCampaignScreen} />
            <MenuStack.Screen name="BookingConsultations" component={BookingConsultationReviewScreen} />
            <MenuStack.Screen name="PhotoConsultations" component={PhotoConsultationReviewScreen} />
            <MenuStack.Screen name="ManageRewards" component={ManageRewardsScreen} />
            <MenuStack.Screen name="LoyaltyQR" component={LoyaltyQRScreen} />
            <MenuStack.Screen name="PaymentMethods" component={PaymentMethodsScreen} />
            <MenuStack.Screen name="HelpSupport" component={HelpSupportScreen} />
            <MenuStack.Screen name="TermsOfService" component={TermsOfServiceScreen} />
            <MenuStack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
            <MenuStack.Screen name="AddOwnerSupply" component={AddOwnerSupplyScreen} />
            <MenuStack.Screen name="CreateService" component={CreateServiceScreen} />
            <MenuStack.Screen name="ServiceSupplies" component={ServiceSuppliesScreen} />
        </MenuStack.Navigator>
    );
}

// Academy Stack
export type AcademyStackParamList = {
    ManageAcademy: undefined;
    CourseEditor: { courseId: string | null };
    LessonEditor: { lessonId: string | null; chapterId: string; courseId: string };
    HomeworkReview: { submissionId: string };
    StudentDetail: { enrollment: any };
};

const AcademyStack = createNativeStackNavigator<AcademyStackParamList>();

function AcademyStackNavigator() {
    return (
        <AcademyStack.Navigator screenOptions={{ headerShown: false }}>
            <AcademyStack.Screen name="ManageAcademy" component={ManageAcademyScreen} />
            <AcademyStack.Screen name="CourseEditor" component={CourseEditorScreen} />
            <AcademyStack.Screen name="LessonEditor" component={LessonEditorScreen} />
            <AcademyStack.Screen name="HomeworkReview" component={HomeworkReviewScreen} />
            <AcademyStack.Screen name="StudentDetail" component={StudentDetailScreen} />
        </AcademyStack.Navigator>
    );
}

export type OwnerTabsParamList = {
    Dashboard: undefined;
    Academy: undefined;
    Appointments: undefined;
    Supplies: undefined;
    Shop: undefined;
    Messages: undefined;
    Menu: undefined;
};

const Tab = createBottomTabNavigator<OwnerTabsParamList>();

export function OwnerTabs() {
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
                options={({ route }) => ({
                    tabBarIcon: ({ color }: { color: string }) => (
                        <MaterialIcons name="dashboard" size={22} color={color} />
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
                name="Academy"
                component={AcademyStackNavigator}
                options={({ route }) => ({
                    tabBarIcon: ({ color }: { color: string }) => (
                        <MaterialIcons name="school" size={22} color={color} />
                    ),
                    tabBarStyle: ((route) => {
                        const routeName = getFocusedRouteNameFromRoute(route) ?? 'ManageAcademy';
                        if (routeName !== 'ManageAcademy') {
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
                name="Supplies"
                component={SuppliesStackNavigator}
                options={({ route }) => ({
                    tabBarIcon: ({ color }: { color: string }) => (
                        <MaterialIcons name="inventory-2" size={22} color={color} />
                    ),
                    tabBarStyle: ((route) => {
                        const routeName = getFocusedRouteNameFromRoute(route) ?? 'SuppliesMain';
                        if (routeName !== 'SuppliesMain') {
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

export default OwnerTabs;
