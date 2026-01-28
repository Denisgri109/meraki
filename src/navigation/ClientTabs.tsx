import React, { useState } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { Text, StyleSheet, View, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    ClientHomeScreen as HomeScreen,
    ProfileScreen,
    OrdersScreen,
    HelpSupportScreen,
    TermsOfServiceScreen,
    PrivacyPolicyScreen,
    LoyaltyPointsScreen,
    PaymentMethodsScreen,
    PaymentHistoryScreen,
    NotificationsScreen,
    BookingScreen,
    ServiceDetailScreen,
    SelectDateTimeScreen,
    BookingConfirmScreen,
    MenuScreen,
    QRScannerScreen,
    MasterDetailScreen,
} from '../screens/client';
import { ShopScreen, ProductDetailScreen, CartScreen, CheckoutScreen } from '../screens/shop';
import { ChatListScreen, ChatScreen } from '../screens/chat';
import {
    AcademyHomeScreen,
    CourseDetailScreen,
    LessonScreen,
    HomeworkScreen,
} from '../screens/academy';
import { colors } from '../theme';

// Home Stack (with drawer trigger)
export type HomeStackParamList = {
    HomeMain: undefined;
    ChatList: undefined;
    Chat: { conversationId: string; otherUser: any };
    Profile: undefined;
    Orders: undefined;
    HelpSupport: undefined;
    TermsOfService: undefined;
    PrivacyPolicy: undefined;
    LoyaltyPoints: undefined;
    PaymentMethods: undefined;
    PaymentHistory: undefined;
    Notifications: undefined;
    QRScanner: undefined;
    MasterDetail: { masterId: string };
};

const HomeStack = createNativeStackNavigator<HomeStackParamList>();

function HomeStackNavigator() {
    return (
        <HomeStack.Navigator screenOptions={{ headerShown: false }}>
            <HomeStack.Screen name="HomeMain" component={HomeScreen} />
            <HomeStack.Screen name="ChatList" component={ChatListScreen} />
            <HomeStack.Screen name="Chat" component={ChatScreen} />
            <HomeStack.Screen name="Profile" component={ProfileScreen} />
            <HomeStack.Screen name="Orders" component={OrdersScreen} />
            <HomeStack.Screen name="HelpSupport" component={HelpSupportScreen} />
            <HomeStack.Screen name="TermsOfService" component={TermsOfServiceScreen} />
            <HomeStack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
            <HomeStack.Screen name="LoyaltyPoints" component={LoyaltyPointsScreen} />
            <HomeStack.Screen name="PaymentMethods" component={PaymentMethodsScreen} />
            <HomeStack.Screen name="PaymentHistory" component={PaymentHistoryScreen} />
            <HomeStack.Screen name="Notifications" component={NotificationsScreen} />
            <HomeStack.Screen name="QRScanner" component={QRScannerScreen} />
            <HomeStack.Screen name="MasterDetail" component={MasterDetailScreen} />
        </HomeStack.Navigator>
    );
}

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

// Shop Stack
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

// Orders Stack (for drawer access)
export type OrdersStackParamList = {
    OrdersMain: undefined;
    ChatList: undefined;
    Chat: { conversationId: string; otherUser: any };
};

const OrdersStack = createNativeStackNavigator<OrdersStackParamList>();

function OrdersStackNavigator() {
    return (
        <OrdersStack.Navigator screenOptions={{ headerShown: false }}>
            <OrdersStack.Screen name="OrdersMain" component={OrdersScreen} />
            <OrdersStack.Screen name="ChatList" component={ChatListScreen} />
            <OrdersStack.Screen name="Chat" component={ChatScreen} />
        </OrdersStack.Navigator>
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
            <ProfileStack.Screen name="HelpSupport" component={HelpSupportScreen} />
            <ProfileStack.Screen name="TermsOfService" component={TermsOfServiceScreen} />
            <ProfileStack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
            <ProfileStack.Screen name="LoyaltyPoints" component={LoyaltyPointsScreen} />
            <ProfileStack.Screen name="PaymentMethods" component={PaymentMethodsScreen} />
            <ProfileStack.Screen name="Notifications" component={NotificationsScreen} />
        </ProfileStack.Navigator>
    );
}

// Academy Stack
export type AcademyStackParamList = {
    AcademyHome: undefined;
    CourseDetail: { course: any };
    Lesson: { lesson: any; courseId: string };
    Homework: { lessonId: string };
};

const AcademyStack = createNativeStackNavigator<AcademyStackParamList>();

function AcademyStackNavigator() {
    return (
        <AcademyStack.Navigator screenOptions={{ headerShown: false }}>
            <AcademyStack.Screen name="AcademyHome" component={AcademyHomeScreen} />
            <AcademyStack.Screen name="CourseDetail" component={CourseDetailScreen} />
            <AcademyStack.Screen name="Lesson" component={LessonScreen} />
            <AcademyStack.Screen name="Homework" component={HomeworkScreen} />
        </AcademyStack.Navigator>
    );
}

export type ClientTabsParamList = {
    Home: undefined;
    Book: undefined;
    Academy: undefined;
    Shop: undefined;
    Menu: undefined;
};

const Tab = createBottomTabNavigator<ClientTabsParamList>();

// Menu placeholder component that opens drawer
function MenuStackNavigator() {
    const MenuStack = createNativeStackNavigator();
    return (
        <MenuStack.Navigator screenOptions={{ headerShown: false }}>
            <MenuStack.Screen name="MenuMain" component={MenuScreen} />
        </MenuStack.Navigator>
    );
}

// Book & Chat Top Tab Navigator
const TopTab = createMaterialTopTabNavigator();

function BookAndChatNavigator() {
    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
            <TopTab.Navigator
                screenOptions={{
                    tabBarStyle: { backgroundColor: colors.surface },
                    tabBarActiveTintColor: colors.text,
                    tabBarInactiveTintColor: colors.textMuted,
                    tabBarIndicatorStyle: { backgroundColor: colors.primary },
                    tabBarLabelStyle: { fontWeight: '600', fontSize: 14, textTransform: 'none' },
                }}
            >
                <TopTab.Screen
                    name="Appointments"
                    component={BookingStackNavigator}
                    options={{ title: 'Book Appointment' }}
                />
                <TopTab.Screen
                    name="Messages"
                    component={MessagesStackNavigator}
                    options={{ title: 'Messages' }}
                />
            </TopTab.Navigator>
        </SafeAreaView>
    );
}

export function ClientTabs() {
    return (
        <>
            <Tab.Navigator
                screenOptions={({ navigation }) => ({
                    headerShown: false,
                    tabBarStyle: styles.tabBar,
                    tabBarActiveTintColor: colors.text,
                    tabBarInactiveTintColor: colors.textMuted,
                    tabBarLabelStyle: styles.tabLabel,
                })}
                screenListeners={({ navigation, route }) => ({
                    blur: () => {
                        // Reset the stack to initial screen when LEAVING this tab
                        const state = navigation.getState();
                        const currentRoute = state.routes.find((r: any) => r.key === route.key);
                        // If this tab has nested navigation state, reset it
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
                    name="Home"
                    component={HomeStackNavigator}
                    options={{
                        tabBarIcon: ({ color }) => <Text style={[styles.icon, { color }]}>🏠</Text>,
                    }}
                />
                <Tab.Screen
                    name="Book"
                    component={BookAndChatNavigator}
                    options={{
                        tabBarIcon: ({ color }) => <Text style={[styles.icon, { color }]}>📅</Text>,
                        tabBarLabel: 'Book & Chat',
                    }}
                />

                <Tab.Screen
                    name="Academy"
                    component={AcademyStackNavigator}
                    options={{
                        tabBarIcon: ({ color }) => <Text style={[styles.icon, { color }]}>🎓</Text>,
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
                    name="Menu"
                    component={MenuStackNavigator}
                    options={{
                        tabBarIcon: ({ color }) => <Text style={[styles.icon, { color }]}>☰</Text>,
                    }}
                />
            </Tab.Navigator>
        </>
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

export default ClientTabs;
