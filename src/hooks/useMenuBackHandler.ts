import { useCallback } from 'react';
import { BackHandler } from 'react-native';
import { useFocusEffect, useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { safeGoBack } from '../navigation/navigationUtils';

type MenuRouteProp = RouteProp<{ params: { from?: string } }, 'params'>;

export function useMenuBackHandler() {
    const navigation = useNavigation();
    const route = useRoute<MenuRouteProp>();

    const handleBack = useCallback(() => {
        const fromMenu = route.params?.from === 'Menu';
        if (fromMenu) {
            // @ts-ignore
            navigation.navigate('Menu', { screen: 'MenuMain' });
        } else {
            // @ts-ignore
            safeGoBack(navigation, 'HomeMain');
        }
        return true;
    }, [navigation, route.params?.from]);

    useFocusEffect(
        useCallback(() => {
            const subscription = BackHandler.addEventListener('hardwareBackPress', handleBack);
            return () => subscription.remove();
        }, [handleBack])
    );

    return handleBack;
}
