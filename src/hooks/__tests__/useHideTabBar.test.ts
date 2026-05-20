import { renderHook } from '@testing-library/react-native';
import { useHideTabBar } from '../useHideTabBar';
import { useTabBar } from '../../contexts/TabBarContext';
import { useFocusEffect } from '@react-navigation/native';

// Mock dependencies
jest.mock('../../contexts/TabBarContext', () => ({
    useTabBar: jest.fn(),
}));

jest.mock('@react-navigation/native', () => ({
    useFocusEffect: jest.fn(),
}));

describe('useHideTabBar', () => {
    const mockHideTabBar = jest.fn();
    const mockShowTabBar = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();

        // Setup the mock implementation for useTabBar
        (useTabBar as jest.Mock).mockReturnValue({
            hideTabBar: mockHideTabBar,
            showTabBar: mockShowTabBar,
        });

        // Setup the mock implementation for useFocusEffect
        // useFocusEffect takes a callback that it runs when the screen is focused.
        // That callback can optionally return a cleanup function.
        (useFocusEffect as jest.Mock).mockImplementation((callback) => {
            // We just store the callback so we can invoke it manually in our tests
            callback();
        });
    });

    it('should call hideTabBar when the screen comes into focus', () => {
        // By using a manual mock that immediately invokes the callback,
        // we simulate the screen being focused immediately upon mount.

        let focusCallback: Function;
        (useFocusEffect as jest.Mock).mockImplementation((cb) => {
            focusCallback = cb;
        });

        renderHook(() => useHideTabBar());

        // At this point, useFocusEffect was called with our callback.
        // Let's manually trigger it to simulate focus.
        const cleanup = focusCallback!();

        expect(mockHideTabBar).toHaveBeenCalledTimes(1);
        expect(mockShowTabBar).not.toHaveBeenCalled();
    });

    it('should call showTabBar when the screen loses focus', () => {
        let focusCallback: Function;
        (useFocusEffect as jest.Mock).mockImplementation((cb) => {
            focusCallback = cb;
        });

        renderHook(() => useHideTabBar());

        // Trigger focus
        const cleanup = focusCallback!();

        // Clear the mock so we only count calls during cleanup
        mockHideTabBar.mockClear();

        // Trigger blur (cleanup)
        if (typeof cleanup === 'function') {
            cleanup();
        }

        expect(mockShowTabBar).toHaveBeenCalledTimes(1);
        expect(mockHideTabBar).not.toHaveBeenCalled();
    });
});
