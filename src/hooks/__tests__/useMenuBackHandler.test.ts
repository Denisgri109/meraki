import { renderHook } from '@testing-library/react-native';
import { useMenuBackHandler } from '../useMenuBackHandler';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { BackHandler } from 'react-native';
import { safeGoBack } from '../../navigation/navigationUtils';

jest.mock('@react-navigation/native', () => ({
    useNavigation: jest.fn(),
    useRoute: jest.fn(),
    useFocusEffect: jest.fn(),
}));

jest.mock('../../navigation/navigationUtils', () => ({
    safeGoBack: jest.fn(),
}));

describe('useMenuBackHandler', () => {
    const mockNavigate = jest.fn();
    const mockNavigation = { navigate: mockNavigate };
    const mockRemove = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();

        (useNavigation as jest.Mock).mockReturnValue(mockNavigation);

        (useRoute as jest.Mock).mockReturnValue({
            params: {},
        });

        jest.spyOn(BackHandler, 'addEventListener').mockReturnValue({ remove: mockRemove } as any);

        (useFocusEffect as jest.Mock).mockImplementation((callback) => {
            callback();
        });
    });

    it('navigates to MenuMain when route.params.from is Menu', () => {
        (useRoute as jest.Mock).mockReturnValue({
            params: { from: 'Menu' },
        });

        const { result } = renderHook(() => useMenuBackHandler());
        const handleBack = result.current;

        const returnVal = handleBack();

        expect(mockNavigate).toHaveBeenCalledWith('Menu', { screen: 'MenuMain' });
        expect(safeGoBack).not.toHaveBeenCalled();
        expect(returnVal).toBe(true);
    });

    it('calls safeGoBack to HomeMain when route.params.from is not Menu', () => {
        (useRoute as jest.Mock).mockReturnValue({
            params: { from: 'Other' },
        });

        const { result } = renderHook(() => useMenuBackHandler());
        const handleBack = result.current;

        const returnVal = handleBack();

        expect(safeGoBack).toHaveBeenCalledWith(mockNavigation, 'HomeMain');
        expect(mockNavigate).not.toHaveBeenCalled();
        expect(returnVal).toBe(true);
    });

    it('calls safeGoBack to HomeMain when route.params is undefined', () => {
        (useRoute as jest.Mock).mockReturnValue({});

        const { result } = renderHook(() => useMenuBackHandler());
        const handleBack = result.current;

        const returnVal = handleBack();

        expect(safeGoBack).toHaveBeenCalledWith(mockNavigation, 'HomeMain');
        expect(returnVal).toBe(true);
    });

    it('registers hardwareBackPress listener on focus and cleans up on blur', () => {
        let focusCallback: Function;
        (useFocusEffect as jest.Mock).mockImplementation((cb) => {
            focusCallback = cb;
        });

        const { result } = renderHook(() => useMenuBackHandler());

        // Simulate screen focus
        const cleanup = focusCallback!();

        expect(BackHandler.addEventListener).toHaveBeenCalledWith('hardwareBackPress', result.current);

        // Simulate screen blur
        cleanup();

        expect(mockRemove).toHaveBeenCalled();
    });
});
