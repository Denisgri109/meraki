import { useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useTabBar } from '../contexts/TabBarContext';

/**
 * Hook to hide the bottom tab bar when the screen is focused.
 * Automatically restores visibility when the screen loses focus.
 */
export function useHideTabBar() {
    const { hideTabBar, showTabBar } = useTabBar();

    useFocusEffect(
        useCallback(() => {
            hideTabBar();
            return () => showTabBar();
        }, [hideTabBar, showTabBar])
    );
}
