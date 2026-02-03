import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { CommonActions } from '@react-navigation/native';
import { Text, StyleSheet } from 'react-native';
import {
    OwnerDashboardScreen,
    MasterListScreen,
    MasterFormScreen,
    ServiceListScreen,
    ServiceFormScreen,
    InventoryScreen,
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
    CreateServiceScreen,
} from '../screens/master';
import {
    ProfileScreen,
    TermsOfServiceScreen,
    PrivacyPolicyScreen,
    PaymentMethodsScreen,
    NotificationsScreen,
} from '../screens/client';
import { ShopScreen, ProductDetailScreen } from '../screens/shop';
import { ChatListScreen, ChatScreen } from '../screens/chat';
import { colors } from '../theme';

// Dashboard Stack (with management access)
export type OwnerDashboardStackParamList = {
    DashboardMain: undefined;
    Masters: undefined;
    MasterForm: { master?: any } | undefined;
    Services: undefined;
    ServiceForm: { service?: any } | undefined;
    Inventory: undefined;
    ProductDetail: { productId: string; product: any };
    LoyaltyQR: undefined;
    Availability: undefined;
    Portfolio: undefined;
    MyServices: undefined;
    CreateService: undefined;
};

const DashboardStack = createNativeStackNavigator<OwnerDashboardStackParamList>();

function DashboardStackNavigator() {
    return (
        <DashboardStack.Navigator screenOptions={{ headerShown: false }}>
            <DashboardStack.Screen name="DashboardMain" component={OwnerDashboardScreen} />
            <DashboardStack.Screen name="Masters" component={MasterListScreen} />
            <DashboardStack.Screen name="MasterForm" component={MasterFormScreen} />
            <DashboardStack.Screen name="Services" component={ServiceListScreen} />
            <DashboardStack.Screen name="ServiceForm" component={ServiceFormScreen} />
            <DashboardStack.Screen name="Inventory" component={InventoryScreen} />
            <DashboardStack.Screen name="ProductDetail" component={ProductDetailScreen} />
            <DashboardStack.Screen name="LoyaltyQR" component={LoyaltyQRScreen} />
            <DashboardStack.Screen name="Availability" component={MasterAvailabilityScreen} />
            <DashboardStack.Screen name="Portfolio" component={PortfolioScreen} />
            <DashboardStack.Screen name="MyServices" component={MyServicesScreen} />
            <DashboardStack.Screen name="CreateService" component={CreateServiceScreen} />
        </DashboardStack.Navigator>
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

// Profile Stack
export type ProfileStackParamList = {
    ProfileMain: undefined;
    TermsOfService: undefined;
    PrivacyPolicy: undefined;
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
    Messages: undefined;
    Profile: undefined;
};

const Tab = createBottomTabNavigator<OwnerTabsParamList>();

export function OwnerTabs() {
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
                name="Academy"
                component={AcademyStackNavigator}
                options={{
                    tabBarIcon: ({ color }: { color: string }) => <Text style={[styles.icon, { color }]}>🎓</Text>,
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

export default OwnerTabs;
