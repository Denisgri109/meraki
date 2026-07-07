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
    PilatesTimetableScreen,
    PilatesHubScreen,
    InventoryScreen,
    OwnerSuppliesScreen,
    AddOwnerSupplyScreen,
    PlatformAnalyticsScreen,
    OwnerOrdersScreen,
    OwnerOrderDetailScreen,
    OwnerMenuScreen,
    CustomizeAppScreen,
    MasterManagementScreen,
    MasterInviteScreen,
    MasterDetailScreen,
    SupportSettingsScreen,
} from '../screens/owner';
import {
    ManageAcademyScreen,
    CourseEditorScreen,
    LessonEditorScreen,
    HomeworkReviewScreen,
    StudentDetailScreen,
    LessonQAInboxScreen,
    LessonQADetailScreen,
} from '../screens/owner/academy';
import {
    MasterAppointmentsScreen,
    LoyaltyQRScreen,
    MasterAvailabilityScreen,
    PortfolioScreen,
    MyServicesScreen,
    BlockedSlotsScreen,
    CreateServiceScreen,

    ServiceSuppliesScreen,
    BusinessSettingsScreen,
    LoyaltyCardBuilderScreen,
    SuppliesScreen,
    AddSupplyScreen,
    BookingConsultationReviewScreen,
    MasterEarningsScreen,
} from '../screens/master';
import PhotoConsultationReviewScreen from '../screens/master/PhotoConsultationReviewScreen';
import {
    EditProfileScreen,
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
    PilatesTimetable: { service: any };
    PilatesHub: undefined;
    Inventory: undefined;
    ProductDetail: { productId: string; product: any };
    LoyaltyQR: undefined;
    Availability: undefined;
    Portfolio: undefined;
    MyServices: undefined;
    BlockedSlots: undefined;
    CreateService: { service?: any } | undefined;

    ServiceSupplies: { serviceId?: string } | undefined;
    OwnerSupplies: undefined;
    AddOwnerSupply: { supply?: any } | undefined;

    BusinessSettings: undefined;
    CustomizeApp: undefined;
    LoyaltyCardBuilder: undefined;
    PhotoConsultations: undefined;
    BookingConsultations: undefined;
    PlatformAnalytics: undefined;
    CustomerOrders: undefined;
    OrderDetail: { order: any };
    Notifications: undefined;
    Earnings: undefined;
    MasterManagement: undefined;
    MasterInvite: undefined;
    MasterDetail: { master: any };
    SupportSettings: undefined;
};

const DashboardStack = createNativeStackNavigator<OwnerDashboardStackParamList>();

function DashboardStackNavigator() {
    return (
        <DashboardStack.Navigator screenOptions={{ headerShown: false }}>
            <DashboardStack.Screen name="DashboardMain" component={OwnerDashboardScreen} />
            <DashboardStack.Screen name="Services" component={ServiceListScreen} />
            <DashboardStack.Screen name="ServiceForm" component={ServiceFormScreen} />
            <DashboardStack.Screen name="PilatesTimetable" component={PilatesTimetableScreen} />
            <DashboardStack.Screen name="PilatesHub" component={PilatesHubScreen} />
            <DashboardStack.Screen name="Inventory" component={InventoryScreen} />
            <DashboardStack.Screen name="ProductDetail" component={ProductDetailScreen} />
            <DashboardStack.Screen name="LoyaltyQR" component={LoyaltyQRScreen} />
            <DashboardStack.Screen name="Availability" component={MasterAvailabilityScreen} />
            <DashboardStack.Screen name="Portfolio" component={PortfolioScreen} />
            <DashboardStack.Screen name="MyServices" component={MyServicesScreen} />
            <DashboardStack.Screen name="BlockedSlots" component={BlockedSlotsScreen} />
            <DashboardStack.Screen name="CreateService" component={CreateServiceScreen} />

            <DashboardStack.Screen name="ServiceSupplies" component={ServiceSuppliesScreen} />
            <DashboardStack.Screen name="OwnerSupplies" component={OwnerSuppliesScreen} />
            <DashboardStack.Screen name="AddOwnerSupply" component={AddOwnerSupplyScreen} />
            <DashboardStack.Screen name="BusinessSettings" component={BusinessSettingsScreen} />
            <DashboardStack.Screen name="CustomizeApp" component={CustomizeAppScreen} />
            <DashboardStack.Screen name="LoyaltyCardBuilder" component={LoyaltyCardBuilderScreen} />
            <DashboardStack.Screen name="PhotoConsultations" component={PhotoConsultationReviewScreen} />
            <DashboardStack.Screen name="BookingConsultations" component={BookingConsultationReviewScreen} />
            <DashboardStack.Screen name="PlatformAnalytics" component={PlatformAnalyticsScreen} />
            <DashboardStack.Screen name="CustomerOrders" component={OwnerOrdersScreen} />
            <DashboardStack.Screen name="OrderDetail" component={OwnerOrderDetailScreen} />
            <DashboardStack.Screen name="Notifications" component={NotificationsScreen} />
            <DashboardStack.Screen name="Earnings" component={MasterEarningsScreen} />
            <DashboardStack.Screen name="MasterManagement" component={MasterManagementScreen} />
            <DashboardStack.Screen name="MasterInvite" component={MasterInviteScreen} />
            <DashboardStack.Screen name="MasterDetail" component={MasterDetailScreen} />
            <DashboardStack.Screen name="SupportSettings" component={SupportSettingsScreen} />
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
    CustomizeApp: undefined;
    Inventory: undefined;
    OwnerSupplies: undefined;
    CustomerOrders: undefined;
    OrderDetail: { order: any };
    Services: undefined;
    ServiceForm: { service?: any } | undefined;
    PilatesTimetable: { service: any };
    PilatesHub: undefined;
    BlockedSlots: undefined;
    LoyaltyCardBuilder: undefined;
    BookingConsultations: undefined;
    PhotoConsultations: undefined;
    LoyaltyQR: undefined;
    PaymentMethods: undefined;
    HelpSupport: undefined;
    TermsOfService: undefined;
    PrivacyPolicy: undefined;
    AddOwnerSupply: { supply?: any } | undefined;
    CreateService: { service?: any } | undefined;
    ServiceSupplies: { serviceId?: string } | undefined;
    ManageAcademy: undefined;
    CourseEditor: { courseId: string | null };
    LessonEditor: { lessonId: string | null; chapterId: string; courseId: string };
    HomeworkReview: { submissionId: string };
    StudentDetail: { enrollment: any };
    LessonQADetail: { lesson: any; courseId: string; instructorId: string; instructorName?: string };
    Earnings: undefined;
    MasterManagement: undefined;
    MasterInvite: undefined;
    MasterDetail: { master: any };
    SupportSettings: undefined;
    ProductDetail: { productId: string; product: any };
};

const MenuStack = createNativeStackNavigator<MenuStackParamList>();

function MenuStackNavigator() {
    return (
        <MenuStack.Navigator screenOptions={{ headerShown: false }}>
            <MenuStack.Screen name="MenuMain" component={OwnerMenuScreen} />
            <MenuStack.Screen name="Profile" component={EditProfileScreen} />
            <MenuStack.Screen name="Availability" component={MasterAvailabilityScreen} />
            <MenuStack.Screen name="Portfolio" component={PortfolioScreen} />
            <MenuStack.Screen name="MyServices" component={MyServicesScreen} />
            <MenuStack.Screen name="PlatformAnalytics" component={PlatformAnalyticsScreen} />
            <MenuStack.Screen name="Notifications" component={NotificationsScreen} />
            <MenuStack.Screen name="BusinessSettings" component={BusinessSettingsScreen} />
            <MenuStack.Screen name="CustomizeApp" component={CustomizeAppScreen} />

            <MenuStack.Screen name="Inventory" component={InventoryScreen} />
            <MenuStack.Screen name="OwnerSupplies" component={OwnerSuppliesScreen} />
            <MenuStack.Screen name="CustomerOrders" component={OwnerOrdersScreen} />
            <MenuStack.Screen name="OrderDetail" component={OwnerOrderDetailScreen} />
            <MenuStack.Screen name="Services" component={ServiceListScreen} />
            <MenuStack.Screen name="ServiceForm" component={ServiceFormScreen} />
            <MenuStack.Screen name="PilatesTimetable" component={PilatesTimetableScreen} />
            <MenuStack.Screen name="PilatesHub" component={PilatesHubScreen} />
            <MenuStack.Screen name="BlockedSlots" component={BlockedSlotsScreen} />
            <MenuStack.Screen name="LoyaltyCardBuilder" component={LoyaltyCardBuilderScreen} />
            <MenuStack.Screen name="BookingConsultations" component={BookingConsultationReviewScreen} />
            <MenuStack.Screen name="PhotoConsultations" component={PhotoConsultationReviewScreen} />
            <MenuStack.Screen name="LoyaltyQR" component={LoyaltyQRScreen} />
            <MenuStack.Screen name="PaymentMethods" component={PaymentMethodsScreen} />
            <MenuStack.Screen name="HelpSupport" component={HelpSupportScreen} />
            <MenuStack.Screen name="TermsOfService" component={TermsOfServiceScreen} />
            <MenuStack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
            <MenuStack.Screen name="AddOwnerSupply" component={AddOwnerSupplyScreen} />
            <MenuStack.Screen name="CreateService" component={CreateServiceScreen} />
            <MenuStack.Screen name="ServiceSupplies" component={ServiceSuppliesScreen} />
            <MenuStack.Screen name="ManageAcademy" component={ManageAcademyScreen} />
            <MenuStack.Screen name="CourseEditor" component={CourseEditorScreen} />
            <MenuStack.Screen name="LessonEditor" component={LessonEditorScreen} />
            <MenuStack.Screen name="HomeworkReview" component={HomeworkReviewScreen} />
            <MenuStack.Screen name="StudentDetail" component={StudentDetailScreen} />
            <MenuStack.Screen name="LessonQADetail" component={LessonQADetailScreen} />
            <MenuStack.Screen name="Earnings" component={MasterEarningsScreen} />
            <MenuStack.Screen name="MasterManagement" component={MasterManagementScreen} />
            <MenuStack.Screen name="MasterInvite" component={MasterInviteScreen} />
            <MenuStack.Screen name="MasterDetail" component={MasterDetailScreen} />
            <MenuStack.Screen name="SupportSettings" component={SupportSettingsScreen} />
            <MenuStack.Screen name="ProductDetail" component={ProductDetailScreen} />
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
    LessonQADetail: { lesson: any; courseId: string; instructorId: string; instructorName?: string };
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
            <AcademyStack.Screen name="LessonQADetail" component={LessonQADetailScreen} />
        </AcademyStack.Navigator>
    );
}

export type OwnerTabsParamList = {
    Dashboard: undefined;
    Academy: undefined;
    Appointments: undefined;
    Messages: undefined;
    Menu: undefined;
};

const Tab = createBottomTabNavigator<OwnerTabsParamList>();

export function OwnerTabs() {
    const getTabStyle = (route: any, expectedRouteName: string) => {
        const routeName = getFocusedRouteNameFromRoute(route) ?? expectedRouteName;
        if (routeName !== expectedRouteName) {
            return { display: 'none' };
        }
        return styles.tabBar;
    };

    return (
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
                        <MaterialIcons name="dashboard" size={22} color={color} />
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
                name="Academy"
                component={AcademyStackNavigator}
                options={({ route }) => ({
                    tabBarIcon: ({ color }: { color: string }) => (
                        <MaterialIcons name="school" size={22} color={color} />
                    ),
                    tabBarStyle: getTabStyle(route, 'ManageAcademy'),
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

export default OwnerTabs;
