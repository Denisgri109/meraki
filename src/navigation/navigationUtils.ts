import { NavigationProp, CommonActions } from '@react-navigation/native';

/**
 * Safely navigate back if possible.
 * If there's no screen to go back to, it will navigate to the specified fallback route.
 * 
 * @param navigation - The navigation prop
 * @param fallbackRoute - The route to navigate to if we can't go back (default: 'HomeMain' for Client)
 * @param fallbackParams - Optional params for the fallback route
 */
export function safeGoBack<T extends Record<string, unknown>>(
    navigation: NavigationProp<T>,
    fallbackRoute?: string,
    fallbackParams?: Record<string, unknown>
): void {
    const state = navigation.getState();
    const canGoBack = state && state.routes && state.routes.length > 1;
    
    if (canGoBack) {
        navigation.goBack();
    } else if (fallbackRoute) {
        navigation.dispatch(
            CommonActions.navigate({
                name: fallbackRoute,
                params: fallbackParams,
            })
        );
    }
}

/**
 * Check if we can go back in the current navigation state
 * 
 * @param navigation - The navigation prop
 * @returns boolean indicating if we can go back
 */
export function canGoBack<T extends Record<string, unknown>>(
    navigation: NavigationProp<T>
): boolean {
    const state = navigation.getState();
    return !!(state && state.routes && state.routes.length > 1);
}

/**
 * Cancel a tab press so the screen can reset its stack instead of just re-focusing.
 *
 * react-navigation 7 loses the bottom-tab event map through the `listeners` prop, so the
 * event arrives typed as `EventArg<'tabPress', false>` — without `preventDefault`, even
 * though `BottomTabNavigationEventMap` declares `canPreventDefault: true` and the method is
 * always there at runtime. This narrows in one place rather than casting at every tab.
 */
export function preventTabPressDefault(event: unknown): void {
    (event as { preventDefault?: () => void }).preventDefault?.();
}
