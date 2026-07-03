import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { NotificationPermissionPrompt } from '../NotificationPermissionPrompt';

jest.mock('react-native', () => {
    const rn = jest.requireActual('react-native');
    const React = require('react');
    return Object.setPrototypeOf({
        Text: (props: any) => React.createElement('Text', props, props.children),
        View: (props: any) => React.createElement('View', props, props.children),
        Modal: (props: any) => props.visible ? React.createElement('Modal', props, props.children) : null,
        TouchableOpacity: (props: any) => React.createElement('TouchableOpacity', props, props.children),
    }, rn);
});

describe('NotificationPermissionPrompt', () => {
    const originalOS = Platform.OS;

    afterEach(() => {
        Platform.OS = originalOS;
    });

    it('returns null on non-iOS (android)', () => {
        Platform.OS = 'android';
        const { queryByText } = render(
            <NotificationPermissionPrompt visible={true} onEnable={() => {}} onSkip={() => {}} />
        );
        expect(queryByText('Stay in the Loop')).toBeNull();
    });

    it('renders correctly on iOS', () => {
        Platform.OS = 'ios';
        const { getByText } = render(
            <NotificationPermissionPrompt visible={true} onEnable={() => {}} onSkip={() => {}} />
        );
        expect(getByText('Stay in the Loop')).toBeTruthy();
        expect(getByText('Enable Notifications')).toBeTruthy();
        expect(getByText('Not Now')).toBeTruthy();
    });

    it('calls onEnable when "Enable Notifications" is pressed', () => {
        Platform.OS = 'ios';
        const mockOnEnable = jest.fn();
        const { getByText } = render(
            <NotificationPermissionPrompt visible={true} onEnable={mockOnEnable} onSkip={() => {}} />
        );

        fireEvent.press(getByText('Enable Notifications'));
        expect(mockOnEnable).toHaveBeenCalledTimes(1);
    });

    it('calls onSkip when "Not Now" is pressed', () => {
        Platform.OS = 'ios';
        const mockOnSkip = jest.fn();
        const { getByText } = render(
            <NotificationPermissionPrompt visible={true} onEnable={() => {}} onSkip={mockOnSkip} />
        );

        fireEvent.press(getByText('Not Now'));
        expect(mockOnSkip).toHaveBeenCalledTimes(1);
    });
});
