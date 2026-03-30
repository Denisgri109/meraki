import React, { useState } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useNavigation, NavigationProp, CommonActions, getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { Text, StyleSheet, View, TouchableOpacity, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { colors, spacing, layout } from '../theme';
import { TabBarProvider, useTabBar } from '../contexts/TabBarContext';
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
    NFCScannerScreen,
    RewardsCatalogScreen,
    PointsHistoryScreen,
} from '../screens/client';

import PhotoConsultationRequestScreen from '../screens/client/PhotoConsultationRequestScreen';
import { ShopScreen, ProductDetailScreen, CartScreen, CheckoutScreen } from '../screens/shop';
import { ChatListScreen } from '../screens/chat';
import {
    AcademyHomeScreen,
    CourseDetailScreen,
    LessonScreen,
    HomeworkScreen,
    CoursePurchaseScreen,
} from '../screens/academy';


// Home Stack (with drawer trigger)
export type HomeStackParamList = {
    HomeMain: undefined;
    ChatList: undefined;

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
    NFCScanner: undefined;
    RewardsCatalog: undefined;
    PointsHistory: undefined;
    MasterDetail: { masterId: string };
    ServiceDetail: { serviceId: string };

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
            <HomeStack.Screen name="NFCScanner" component={NFCScannerScreen} />
            <HomeStack.Screen name="RewardsCatalog" component={RewardsCatalogScreen} />
            <HomeStack.Screen name="PointsHistory" component={PointsHistoryScreen} />
            <HomeStack.Screen name="MasterDetail" component={MasterDetailScreen} />
            <HomeStack.Screen name="ServiceDetail" component={ServiceDetailScreen} />

            <HomeStack.Screen name="DiscoverMasters" component={DiscoverMastersScreen} />
            <HomeStack.Screen name="PhotoConsultationRequest" component={PhotoConsultationRequestScreen} />
            <HomeStack.Screen name="SelectDateTime" component={SelectDateTimeScreen} />
            <HomeStack.Screen name="BookingConfirm" component={BookingConfirmScreen} />
        </HomeStack.Navigator>
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
// Menu Stack
export type MenuStackParamList = {
    MenuMain: undefined;
    Profile: undefined;
    Orders: undefined;
    HelpSupport: undefined;
    TermsOfService: undefined;
    PrivacyPolicy: undefined;
    LoyaltyPoints: undefined;
    PaymentMethods: undefined;
    PaymentHistory: undefined;
    Notifications: undefined;
    StampCards: undefined;
    RewardsCatalog: undefined;
    PointsHistory: undefined;
    QRScanner: undefined;
    NFCScanner: undefined;
};

const MenuStack = createNativeStackNavigator<MenuStackParamList>();

function MenuStackNavigator() {
    return (
        <MenuStack.Navigator screenOptions={{ headerShown: false }}>
            <MenuStack.Screen name="MenuMain" component={MenuScreen} />
            <MenuStack.Screen name="Profile" component={ProfileScreen} />
            <MenuStack.Screen name="Orders" component={OrdersScreen} />
            <MenuStack.Screen name="HelpSupport" component={HelpSupportScreen} />
            <MenuStack.Screen name="TermsOfService" component={TermsOfServiceScreen} />
            <MenuStack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
            <MenuStack.Screen name="LoyaltyPoints" component={LoyaltyPointsScreen} />
            <MenuStack.Screen name="PaymentMethods" component={PaymentMethodsScreen} />
            <MenuStack.Screen name="PaymentHistory" component={PaymentHistoryScreen} />
            <MenuStack.Screen name="Notifications" component={NotificationsScreen} />
            <MenuStack.Screen name="StampCards" component={StampCardsScreen} />
            <MenuStack.Screen name="RewardsCatalog" component={RewardsCatalogScreen} />
            <MenuStack.Screen name="PointsHistory" component={PointsHistoryScreen} />
            <MenuStack.Screen name="QRScanner" component={QRScannerScreen} />
            <MenuStack.Screen name="NFCScanner" component={NFCScannerScreen} />
        </MenuStack.Navigator>
    );
}

// Helper to get recursive child route name
const getLeafRouteName = (route: any): string => {
    if (route.state && route.state.routes) {
        return getLeafRouteName(route.state.routes[route.state.index ?? 0]);
    }
    return route.name;
};

// Book & Chat Tab

function BookAndChatNavigator() {
    return (
        <BookAndChatScreen />
    );
}


function ClientTabsInner() {
    const { isTabBarVisible } = useTabBar();

    return (
        <>
            <Tab.Navigator
                screenOptions={({ navigation }) => ({
                    headerShown: false,
                    tabBarStyle: styles.tabBar,
                    tabBarActiveTintColor: '#000000',
                    tabBarInactiveTintColor: 'rgba(156, 163, 175, 0.70)',
                    tabBarLabelStyle: styles.tabLabel,
                    tabBarShowLabel: true,
                })}
            >
                <Tab.Screen
                    name="Home"
                    component={HomeStackNavigator}
                    options={({ route }) => ({
                        tabBarIcon: ({ color, size }: { color: string; size: number }) => (
                            <MaterialIcons name="home" size={22} color={color} />
                        ),
                        tabBarStyle: ((route) => {
                            const routeName = getFocusedRouteNameFromRoute(route) ?? 'HomeMain';
                            // Only show tab bar on HomeMain and ChatList (maybe? user said "important screen... confirming... settings... should be hidden")
                            // User said: "It should only pair when the page isn't really as important, or the pages displaying a lot of stuff"
                            // "Every screen, right, that has to do with confirming something or doing something, or whatever, or when going into settings... should be hidden"
                            // ChatList is a top level feature. But User said "Book & Chat" has one screen.
                            // Let's stick to showing it ONLY on HomeMain for now as requested "non-root screens". 
                            // Actually, ChatList is in HomeStack but is it a "root" level thing? 
                            // The user said "Select Date and Time" was the issue. 
                            // Let's strictly follow: Visible ONLY on root.
                            if (routeName !== 'HomeMain') {
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
                    name="Book"
                    component={BookAndChatNavigator}
                    options={({ route }) => ({
                        tabBarIcon: ({ color, size }: { color: string; size: number }) => (
                            <MaterialIcons name="explore" size={22} color={color} />
                        ),
                        tabBarLabel: 'Book & Chat',
                        tabBarStyle: (() => {
                            // Always respect context — booking flow screens set isTabBarVisible=false
                            if (!isTabBarVisible) {
                                return { display: 'none' as const };
                            }
                            // Also check leaf route name as fallback
                            const leafRouteName = getLeafRouteName(route);
                            const hiddenScreens = [
                                'ServiceDetail',
                                'SelectDateTime',
                                'BookingConfirm',
                                'PhotoConsultationRequest',
                                'MasterDetail',
                                'ConsultationWaiting',
                            ];
                            if (hiddenScreens.includes(leafRouteName)) {
                                return { display: 'none' as const };
                            }
                            return styles.tabBar;
                        })(),
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
                        tabBarIcon: ({ color, size }: { color: string; size: number }) => (
                            <MaterialIcons name="school" size={22} color={color} />
                        ),
                        tabBarStyle: ((route) => {
                            const routeName = getFocusedRouteNameFromRoute(route) ?? 'AcademyHome';
                            if (routeName !== 'AcademyHome') {
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
                        tabBarIcon: ({ color, size }: { color: string; size: number }) => (
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
                        tabBarIcon: ({ color, size }: { color: string; size: number }) => (
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

export function ClientTabs() {
    return (
        <TabBarProvider>
            <ClientTabsInner />
        </TabBarProvider>
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

export default ClientTabs;
