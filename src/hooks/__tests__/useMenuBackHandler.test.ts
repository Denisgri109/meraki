import { renderHook } from '@testing-library/react-native';
import { BackHandler } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { useMenuBackHandler } from '../useMenuBackHandler';
import { safeGoBack } from '../../navigation/navigationUtils';

// Mock navigation utils
jest.mock('../../navigation/navigationUtils', () => ({
    safeGoBack: jest.fn(),
}));

// Mock react-navigation hooks
jest.mock('@react-navigation/native', () => ({
    useNavigation: jest.fn(),
    useRoute: jest.fn(),
    useFocusEffect: jest.fn(),
}));

describe('useMenuBackHandler', () => {
    const mockNavigation = {
        navigate: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
        (useNavigation as jest.Mock).mockReturnValue(mockNavigation);

        // Mock useFocusEffect to execute the callback immediately
        (useFocusEffect as jest.Mock).mockImplementation((callback) => {
            callback();
        });

        // Spy on BackHandler
        jest.spyOn(BackHandler, 'addEventListener').mockReturnValue({
            remove: jest.fn(),
        } as any);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('navigates to MenuMain when route.params.from is "Menu"', () => {
        (useRoute as jest.Mock).mockReturnValue({
            params: { from: 'Menu' },
        });

        const { result } = renderHook(() => useMenuBackHandler());

        // Call the returned handler directly
        const handled = result.current();

        expect(handled).toBe(true);
        expect(mockNavigation.navigate).toHaveBeenCalledWith('Menu', { screen: 'MenuMain' });
        expect(safeGoBack).not.toHaveBeenCalled();
    });

    it('calls safeGoBack with "HomeMain" when route.params.from is not "Menu"', () => {
        (useRoute as jest.Mock).mockReturnValue({
            params: { from: 'Other' },
        });

        const { result } = renderHook(() => useMenuBackHandler());

        // Call the returned handler directly
        const handled = result.current();

        expect(handled).toBe(true);
        expect(mockNavigation.navigate).not.toHaveBeenCalled();
        expect(safeGoBack).toHaveBeenCalledWith(mockNavigation, 'HomeMain');
    });

    it('calls safeGoBack with "HomeMain" when route.params is undefined', () => {
        (useRoute as jest.Mock).mockReturnValue({
            params: undefined,
        });

        const { result } = renderHook(() => useMenuBackHandler());

        // Call the returned handler directly
        const handled = result.current();

        expect(handled).toBe(true);
        expect(mockNavigation.navigate).not.toHaveBeenCalled();
        expect(safeGoBack).toHaveBeenCalledWith(mockNavigation, 'HomeMain');
    });

    it('adds and removes BackHandler event listener correctly', () => {
        (useRoute as jest.Mock).mockReturnValue({
            params: {},
        });

        const mockRemove = jest.fn();
        jest.spyOn(BackHandler, 'addEventListener').mockReturnValue({
            remove: mockRemove,
        } as any);

        // Capture the cleanup function returned by the useFocusEffect callback
        let cleanupFunc: (() => void) | undefined;
        (useFocusEffect as jest.Mock).mockImplementation((callback) => {
            cleanupFunc = callback();
        });

        renderHook(() => useMenuBackHandler());

        expect(BackHandler.addEventListener).toHaveBeenCalledWith(
            'hardwareBackPress',
            expect.any(Function)
        );

        // Verify cleanup function
        expect(cleanupFunc).toBeDefined();
        if (cleanupFunc) {
            cleanupFunc();
        }

        expect(mockRemove).toHaveBeenCalled();
    });
});
