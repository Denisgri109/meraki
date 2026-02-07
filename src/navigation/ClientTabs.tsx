import React, { useState } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useNavigation, NavigationProp, CommonActions } from '@react-navigation/native';
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
    StampCardsScreen,
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
    BookAndChatScreen,
    DiscoverMastersScreen,
} from '../screens/client';
import PhotoConsultationRequestScreen from '../screens/client/PhotoConsultationRequestScreen';
import { ShopScreen, ProductDetailScreen, CartScreen, CheckoutScreen } from '../screens/shop';
import { ChatListScreen, ChatScreen } from '../screens/chat';
import {
    AcademyHomeScreen,
    CourseDetailScreen,
    LessonScreen,
    HomeworkScreen,
    CoursePurchaseScreen,
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
    StampCards: undefined;
    PaymentMethods: undefined;
    PaymentHistory: undefined;
    Notifications: undefined;
    QRScanner: undefined;
    MasterDetail: { masterId: string };
    DiscoverMasters: undefined;
    PhotoConsultationRequest: { masterId?: string } | undefined;
    SelectDateTime: { serviceId: string; masterId: string };
    BookingConfirm: { serviceId: string; masterId: string; dateTime: string };
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
            <HomeStack.Screen name="StampCards" component={StampCardsScreen} />
            <HomeStack.Screen name="PaymentMethods" component={PaymentMethodsScreen} />
            <HomeStack.Screen name="PaymentHistory" component={PaymentHistoryScreen} />
            <HomeStack.Screen name="Notifications" component={NotificationsScreen} />
            <HomeStack.Screen name="QRScanner" component={QRScannerScreen} />
            <HomeStack.Screen name="MasterDetail" component={MasterDetailScreen} />
            <HomeStack.Screen name="DiscoverMasters" component={DiscoverMastersScreen} />
            <HomeStack.Screen name="PhotoConsultationRequest" component={PhotoConsultationRequestScreen} />
            <HomeStack.Screen name="SelectDateTime" component={SelectDateTimeScreen} />
            <HomeStack.Screen name="BookingConfirm" component={BookingConfirmScreen} />
        </HomeStack.Navigator>
    );
}

// Booking Stack


// Messages Stack


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
    CoursePurchase: { course: any };
};

const AcademyStack = createNativeStackNavigator<AcademyStackParamList>();

function AcademyStackNavigator() {
    return (
        <AcademyStack.Navigator screenOptions={{ headerShown: false }}>
            <AcademyStack.Screen name="AcademyHome" component={AcademyHomeScreen} />
            <AcademyStack.Screen name="CourseDetail" component={CourseDetailScreen} />
            <AcademyStack.Screen name="Lesson" component={LessonScreen} />
            <AcademyStack.Screen name="Homework" component={HomeworkScreen} />
            <AcademyStack.Screen name="CoursePurchase" component={CoursePurchaseScreen} />
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

// Book & Chat Tab

function BookAndChatNavigator() {
    return (
        <BookAndChatScreen />
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
            >
                <Tab.Screen
                    name="Home"
                    component={HomeStackNavigator}
                    options={{
                        tabBarIcon: ({ color }: { color: string }) => <Text style={[styles.icon, { color }]}>🏠</Text>,
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
                    name="Book"
                    component={BookAndChatNavigator}
                    options={{
                        tabBarIcon: ({ color }: { color: string }) => <Text style={[styles.icon, { color }]}>📅</Text>,
                        tabBarLabel: 'Book & Chat',
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
                    name="Menu"
                    component={MenuStackNavigator}
                    options={{
                        tabBarIcon: ({ color }: { color: string }) => <Text style={[styles.icon, { color }]}>☰</Text>,
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
