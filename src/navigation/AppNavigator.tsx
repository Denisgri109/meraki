import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../contexts/AuthContext';
import { AuthStack } from './AuthStack';
import { ClientTabs } from './ClientTabs';
import { MasterTabs } from './MasterTabs';
import { OwnerTabs } from './OwnerTabs';
import { colors } from '../theme';

export type RootStackParamList = {
    Auth: undefined;
    ClientApp: undefined;
    MasterApp: undefined;
    OwnerApp: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function AppNavigator() {
    const { session, profile, loading } = useAuth();

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
        if (profile?.role === 'master') return 'MasterApp';
        return 'ClientApp';
    };

    const renderAppScreens = () => {
        if (profile?.role === 'owner') {
            return <Stack.Screen name="OwnerApp" component={OwnerTabs} />;
        }
        if (profile?.role === 'master') {
            return <Stack.Screen name="MasterApp" component={MasterTabs} />;
        }
        return <Stack.Screen name="ClientApp" component={ClientTabs} />;
    };

    return (
        <NavigationContainer>
            <Stack.Navigator
                initialRouteName={getInitialRoute()}
                screenOptions={{
                    headerShown: false,
                    contentStyle: { backgroundColor: colors.background },
                }}
            >
                {!session ? (
                    <Stack.Screen name="Auth" component={AuthStack} />
                ) : (
                    renderAppScreens()
                )}
            </Stack.Navigator>
        </NavigationContainer>
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

