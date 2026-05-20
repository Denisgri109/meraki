import { renderHook } from '@testing-library/react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeBack } from '../useSafeBack';
import { safeGoBack, canGoBack } from '../../navigation/navigationUtils';

// Mock the navigation utilities
jest.mock('../../navigation/navigationUtils', () => ({
    safeGoBack: jest.fn(),
    canGoBack: jest.fn(),
}));

// Mock useNavigation
jest.mock('@react-navigation/native', () => ({
    useNavigation: jest.fn(),
}));

describe('useSafeBack', () => {
    const mockNavigation = {
        goBack: jest.fn(),
        navigate: jest.fn(),
        getState: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
        (useNavigation as jest.Mock).mockReturnValue(mockNavigation);
    });

    it('returns goBack function and canGoBack boolean', () => {
        (canGoBack as jest.Mock).mockReturnValue(true);
        const { result } = renderHook(() => useSafeBack());

        expect(typeof result.current.goBack).toBe('function');
        expect(result.current.canGoBack).toBe(true);
    });

    it('calls safeGoBack with default fallbackRoute when goBack is called', () => {
        const { result } = renderHook(() => useSafeBack());

        result.current.goBack();

        expect(safeGoBack).toHaveBeenCalledWith(mockNavigation, 'Home', undefined);
    });

    it('calls safeGoBack with custom fallbackRoute and params when goBack is called', () => {
        const options = { fallbackRoute: 'Profile', fallbackParams: { userId: 123 } };
        const { result } = renderHook(() => useSafeBack(options));

        result.current.goBack();

        expect(safeGoBack).toHaveBeenCalledWith(mockNavigation, 'Profile', { userId: 123 });
    });

    it('returns correct canGoBack value from navigationUtils', () => {
        (canGoBack as jest.Mock).mockReturnValue(false);
        const { result } = renderHook(() => useSafeBack());

        expect(result.current.canGoBack).toBe(false);
    });
});
