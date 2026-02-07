import { useCallback } from 'react';
import { useNavigation, NavigationProp, ParamListBase } from '@react-navigation/native';
import { safeGoBack, canGoBack } from '../navigation/navigationUtils';

interface UseSafeBackOptions {
    fallbackRoute?: string;
    fallbackParams?: any;
}

interface UseSafeBackReturn {
    goBack: () => void;
    canGoBack: boolean;
}

/**
 * Hook to safely handle back navigation with automatic fallback
 * 
 * @param options - Configuration options for fallback navigation
 * @returns Object with goBack function and canGoBack boolean
 * 
 * @example
 * const { goBack, canGoBack } = useSafeBack({ fallbackRoute: 'Home' });
 * 
 * // In your JSX:
 * <TouchableOpacity onPress={goBack}>
 *   <Text>Back</Text>
 * </TouchableOpacity>
 */
export function useSafeBack(options: UseSafeBackOptions = {}): UseSafeBackReturn {
    const { fallbackRoute = 'Home', fallbackParams } = options;
    const navigation = useNavigation<NavigationProp<ParamListBase>>();

    const handleGoBack = useCallback(() => {
        safeGoBack(navigation, fallbackRoute, fallbackParams);
    }, [navigation, fallbackRoute, fallbackParams]);

    const canGoBackValue = canGoBack(navigation);

    return {
        goBack: handleGoBack,
        canGoBack: canGoBackValue,
    };
}

export default useSafeBack;
