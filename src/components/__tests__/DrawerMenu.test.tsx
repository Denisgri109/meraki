import React from 'react';
import { render, fireEvent, act, waitFor } from '@testing-library/react-native';
import { DrawerMenu } from '../DrawerMenu';
import { useAuth } from '../../contexts/AuthContext';
import { Animated } from 'react-native';

// Mock the dependencies
jest.mock('../../contexts/AuthContext');

// Suppress the Animated warning for useNativeDriver
jest.spyOn(Animated, 'timing').mockImplementation(() => ({
    start: jest.fn((cb) => cb && cb({ finished: true }))
}) as any);

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

describe('DrawerMenu', () => {
    const mockOnClose = jest.fn();
    const mockOnNavigate = jest.fn();
    const mockSignOut = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();

        mockUseAuth.mockReturnValue({
            profile: {
                full_name: 'Test User',
                role: 'client'
            },
            signOut: mockSignOut,
        } as any);
    });

    it('renders correctly when visible', () => {
        const { getByText } = render(
            <DrawerMenu visible={true} onClose={mockOnClose} onNavigate={mockOnNavigate} />
        );

        // Header check
        expect(getByText('Test User')).toBeTruthy();
        expect(getByText('Client')).toBeTruthy();

        // Sections check
        expect(getByText('QUICK ACTIONS')).toBeTruthy();
        expect(getByText('SUPPORT')).toBeTruthy();
        expect(getByText('ACCOUNT')).toBeTruthy();

        // Items check
        expect(getByText('My Orders')).toBeTruthy();
        expect(getByText('Notifications')).toBeTruthy();

        // Footer check
        expect(getByText('Sign Out')).toBeTruthy();
    });

    it('handles close button press', () => {
        const { getByText } = render(
            <DrawerMenu visible={true} onClose={mockOnClose} onNavigate={mockOnNavigate} />
        );

        fireEvent.press(getByText('✕'));
        expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('handles menu item press (navigation)', () => {
        const { getByText } = render(
            <DrawerMenu visible={true} onClose={mockOnClose} onNavigate={mockOnNavigate} />
        );

        fireEvent.press(getByText('My Orders'));

        expect(mockOnClose).toHaveBeenCalledTimes(1);
        expect(mockOnNavigate).toHaveBeenCalledWith('Orders');
    });

    it('handles sign out button press', () => {
        const { getByText } = render(
            <DrawerMenu visible={true} onClose={mockOnClose} onNavigate={mockOnNavigate} />
        );

        fireEvent.press(getByText('Sign Out'));

        expect(mockOnClose).toHaveBeenCalledTimes(1);
        expect(mockSignOut).toHaveBeenCalledTimes(1);
    });
});
