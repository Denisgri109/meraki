import { NavigationProp, CommonActions } from '@react-navigation/native';
import { safeGoBack, canGoBack } from '../navigationUtils';

// Mock CommonActions.navigate
jest.mock('@react-navigation/native', () => {
    const actual = jest.requireActual('@react-navigation/native');
    return {
        ...actual,
        CommonActions: {
            ...actual.CommonActions,
            navigate: jest.fn().mockImplementation((args) => ({
                type: 'NAVIGATE',
                payload: args,
            })),
        },
    };
});

describe('navigationUtils', () => {
    let mockNavigation: any;

    beforeEach(() => {
        jest.clearAllMocks();
        mockNavigation = {
            getState: jest.fn(),
            goBack: jest.fn(),
            dispatch: jest.fn(),
        };
    });

    describe('safeGoBack', () => {
        it('should call goBack when routes length > 1', () => {
            mockNavigation.getState.mockReturnValue({
                routes: [{ key: '1' }, { key: '2' }],
            });

            safeGoBack(mockNavigation as NavigationProp<any>);

            expect(mockNavigation.getState).toHaveBeenCalled();
            expect(mockNavigation.goBack).toHaveBeenCalled();
            expect(mockNavigation.dispatch).not.toHaveBeenCalled();
        });

        it('should call dispatch with fallbackRoute when routes length <= 1 and fallbackRoute is provided', () => {
            mockNavigation.getState.mockReturnValue({
                routes: [{ key: '1' }],
            });

            safeGoBack(mockNavigation as NavigationProp<any>, 'HomeMain', { param1: 'test' });

            expect(mockNavigation.getState).toHaveBeenCalled();
            expect(mockNavigation.goBack).not.toHaveBeenCalled();
            expect(mockNavigation.dispatch).toHaveBeenCalledWith({
                type: 'NAVIGATE',
                payload: {
                    name: 'HomeMain',
                    params: { param1: 'test' },
                },
            });
            expect(CommonActions.navigate).toHaveBeenCalledWith({
                name: 'HomeMain',
                params: { param1: 'test' },
            });
        });

        it('should do nothing when routes length <= 1 and no fallbackRoute is provided', () => {
            mockNavigation.getState.mockReturnValue({
                routes: [{ key: '1' }],
            });

            safeGoBack(mockNavigation as NavigationProp<any>);

            expect(mockNavigation.getState).toHaveBeenCalled();
            expect(mockNavigation.goBack).not.toHaveBeenCalled();
            expect(mockNavigation.dispatch).not.toHaveBeenCalled();
        });

        it('should do nothing when state or routes are missing and no fallbackRoute is provided', () => {
            mockNavigation.getState.mockReturnValue(null);

            safeGoBack(mockNavigation as NavigationProp<any>);

            expect(mockNavigation.getState).toHaveBeenCalled();
            expect(mockNavigation.goBack).not.toHaveBeenCalled();
            expect(mockNavigation.dispatch).not.toHaveBeenCalled();
        });
    });

    describe('canGoBack', () => {
        it('should return true when routes length > 1', () => {
            mockNavigation.getState.mockReturnValue({
                routes: [{ key: '1' }, { key: '2' }],
            });

            const result = canGoBack(mockNavigation as NavigationProp<any>);

            expect(mockNavigation.getState).toHaveBeenCalled();
            expect(result).toBe(true);
        });

        it('should return false when routes length <= 1', () => {
            mockNavigation.getState.mockReturnValue({
                routes: [{ key: '1' }],
            });

            const result = canGoBack(mockNavigation as NavigationProp<any>);

            expect(mockNavigation.getState).toHaveBeenCalled();
            expect(result).toBe(false);
        });

        it('should return false when state is null or undefined', () => {
            mockNavigation.getState.mockReturnValue(null);

            const result = canGoBack(mockNavigation as NavigationProp<any>);

            expect(mockNavigation.getState).toHaveBeenCalled();
            expect(result).toBe(false);
        });

        it('should return false when routes are null or undefined', () => {
            mockNavigation.getState.mockReturnValue({ routes: undefined });

            const result = canGoBack(mockNavigation as NavigationProp<any>);

            expect(mockNavigation.getState).toHaveBeenCalled();
            expect(result).toBe(false);
        });
    });
});
