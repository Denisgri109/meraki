import React from 'react';
import { View, ActivityIndicator, StyleSheet, Linking } from 'react-native';
import { NavigationContainer, LinkingOptions, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../contexts/AuthContext';
import { NotificationProvider, useNotifications } from '../contexts/NotificationContext';
import { DeepLinkHandler } from '../components/DeepLinkHandler';
import { NotificationPermissionPrompt } from '../components/NotificationPermissionPrompt';
import { TestPanel } from '../components/TestPanel';
import { AuthStack } from './AuthStack';
import { ClientTabs } from './ClientTabs';
import { MasterTabs } from './MasterTabs';
import { OwnerTabs } from './OwnerTabs';
import { MasterOnboardingScreen } from '../screens/master';
import { useAutoLocation } from '../hooks/useAutoLocation';
import { CitySelectionModal } from '../components/CitySelectionModal';
import { colors } from '../theme';

import { ChatScreen } from '../screens/chat';

// Deep link configuration for NFC stamp handling
const linking: LinkingOptions<RootStackParamList> = {
    prefixes: ['meraki://', 'https://meraki.app'],
    config: {
        screens: {
            ClientApp: {
                path: 'loyalty',
                screens: {
                    HomeStack: {
                        path: 'stamp',
                    },
                },
            },
            Chat: {
                path: 'chat/:conversationId',
                parse: {
                    conversationId: (conversationId) => `${conversationId}`,
                },
            },
        },
    },
    // Handle deep links manually for stamp processing
    async getInitialURL() {
        const url = await Linking.getInitialURL();
        return url;
    },
    subscribe(listener) {
        const subscription = Linking.addEventListener('url', ({ url }) => {
            listener(url);
        });
        return () => subscription.remove();
    },
};

export type RootStackParamList = {
    Auth: undefined;
    ClientApp: undefined;
    MasterApp: undefined;
    MasterOnboarding: undefined;
    OwnerApp: undefined;
    Chat: { conversationId: string; otherUser: any; isSupportChat?: boolean };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * Bridge component that connects NotificationContext to the NotificationPermissionPrompt.
 * Must live inside NotificationProvider to use the useNotifications hook.
 */
function NotificationPromptBridge() {
    const { showPermissionPrompt, handleEnableNotifications, handleSkipNotifications } = useNotifications();
    return (
        <NotificationPermissionPrompt
            visible={showPermissionPrompt}
            onEnable={handleEnableNotifications}
            onSkip={handleSkipNotifications}
        />
    );
}


export function AppNavigator() {
    const { session, profile, loading } = useAuth();
    const {
        isCityMissing,
        detectedCountry,
        detectedCountryCode,
        detectedTimezone,
        dismissCityModal,
        onCitySaved,
    } = useAutoLocation();

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.text} />
            </View>
        );
    }

    const getInitialRoute = (): keyof RootStackParamList => {
        if (!session) return 'Auth';
        if (profile?.role === 'owner') return 'OwnerApp';
        if (profile?.role === 'master') {
            // Show onboarding if not completed (handles null, undefined, and false)
            if (profile?.onboarding_completed !== true) {
                return 'MasterOnboarding';
            }
            return 'MasterApp';
        }
        return 'ClientApp';
    };

    const renderAppScreens = () => {
        if (profile?.role === 'owner') {
            return <Stack.Screen name="OwnerApp" component={OwnerTabs} />;
        }
        if (profile?.role === 'master') {
            return (
                <>
                    {profile?.onboarding_completed !== true && (
                        <Stack.Screen name="MasterOnboarding" component={MasterOnboardingScreen} />
                    )}
                    <Stack.Screen name="MasterApp" component={MasterTabs} />
                </>
            );
        }
        return <Stack.Screen name="ClientApp" component={ClientTabs} />;
    };

    return (
        <>
            <NavigationContainer
                linking={linking}
                theme={{
                    dark: false,
                    colors: {
                        primary: colors.primary,
                        background: colors.background,
                        card: colors.surface,
                        text: colors.text,
                        border: colors.border,
                        notification: colors.primary,
                    },
                    fonts: DefaultTheme.fonts,
                }}
            >
                <NotificationProvider>
                    <DeepLinkHandler>
                        <Stack.Navigator
                            initialRouteName={getInitialRoute()}
                            screenOptions={{
                                headerShown: false,
                                contentStyle: { backgroundColor: colors.background },
                                animationTypeForReplace: 'push',
                            }}
                        >
                            {!session ? (
                                <Stack.Screen name="Auth" component={AuthStack} />
                            ) : (
                                <>
                                    {renderAppScreens()}
                                    <Stack.Screen
                                        name="Chat"
                                        component={ChatScreen}
                                        options={{
                                            presentation: 'card',
                                            animation: 'slide_from_right',
                                        }}
                                    />
                                </>
                            )}
                        </Stack.Navigator>
                    </DeepLinkHandler>
                    <NotificationPromptBridge />
                </NotificationProvider>
            </NavigationContainer>

            {/* City Selection Modal - shown for all authenticated users when city is missing */}
            {session && (
                <CitySelectionModal
                    visible={isCityMissing}
                    detectedCountry={detectedCountry}
                    detectedCountryCode={detectedCountryCode}
                    onCitySaved={onCitySaved}
                    onDismiss={dismissCityModal}
                />
            )}

            {/* QA Test Panel - only renders for whitelisted test accounts */}
            {session && <TestPanel />}
        </>
    );
}

const styles = StyleSheet.create({
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.background,
    },
});

export default AppNavigator;
