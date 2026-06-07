import { renderHook } from '@testing-library/react-native';
import { useHideTabBar } from '../useHideTabBar';
import { useTabBar } from '../../contexts/TabBarContext';
import { useFocusEffect } from '@react-navigation/native';

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

        (useTabBar as jest.Mock).mockReturnValue({
            hideTabBar: mockHideTabBar,
            showTabBar: mockShowTabBar,
        });

        // Simplified focus effect mock setup
        (useFocusEffect as jest.Mock).mockImplementation((callback) => {
            // Does not automatically run callback here
        });
    });

    it('should call hideTabBar when the screen comes into focus and showTabBar when the screen loses focus', () => {
        let effectCallback: (() => (() => void) | void) | undefined;

        (useFocusEffect as jest.Mock).mockImplementation((cb) => {
            effectCallback = cb;
        });

        renderHook(() => useHideTabBar());

        expect(effectCallback).toBeDefined();

        // Trigger focus
        const cleanup = effectCallback!();

        expect(mockHideTabBar).toHaveBeenCalledTimes(1);
        expect(mockShowTabBar).not.toHaveBeenCalled();

        mockHideTabBar.mockClear();

        // Trigger blur (cleanup)
        if (typeof cleanup === 'function') {
            cleanup();
        }

        expect(mockShowTabBar).toHaveBeenCalledTimes(1);
        expect(mockHideTabBar).not.toHaveBeenCalled();
    });
});
