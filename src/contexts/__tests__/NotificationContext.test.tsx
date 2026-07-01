import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { useNavigation } from '@react-navigation/native';
import NotificationContext, { NotificationProvider, useNotifications } from '../NotificationContext';
import { useAuth } from '../AuthContext';
import { registerForPushNotificationsAsync, savePushToken } from '../../lib/notifications';

// Mock dependencies

jest.mock('@react-native-async-storage/async-storage', () => ({
    getItem: jest.fn(),
    setItem: jest.fn(),
}));

jest.mock('@react-navigation/native', () => ({
    useNavigation: jest.fn(),
}));

jest.mock('../AuthContext', () => ({
    useAuth: jest.fn(),
}));

jest.mock('../../lib/notifications', () => ({
    registerForPushNotificationsAsync: jest.fn(),
    savePushToken: jest.fn(),
}));

describe('NotificationContext', () => {
    const mockNavigate = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();

        // Default mocks setup
        (useNavigation as jest.Mock).mockReturnValue({ navigate: mockNavigate });
        (Platform as any).OS = 'ios';

        // Mock async storage default values
        (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

        // Mock Notifications default values
        (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'undetermined' });

        // Mock custom lib functions
        (registerForPushNotificationsAsync as jest.Mock).mockResolvedValue('test_token');
        (savePushToken as jest.Mock).mockResolvedValue(true);
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
        <NotificationProvider>{children}</NotificationProvider>
    );

    describe('useNotifications', () => {
        it('throws an error if used outside NotificationProvider', () => {
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

            expect(() => renderHook(() => useNotifications())).toThrow(
                'useNotifications must be used within a NotificationProvider'
            );

            consoleErrorSpy.mockRestore();
        });
    });

    describe('Provider Initialization & Listeners', () => {
        it('sets up notification listeners on mount and cleans them up on unmount', () => {
            (useAuth as jest.Mock).mockReturnValue({ user: null });

            const { unmount } = renderHook(() => useNotifications(), { wrapper });

            expect(Notifications.addNotificationReceivedListener).toHaveBeenCalledTimes(1);
            expect(Notifications.addNotificationResponseReceivedListener).toHaveBeenCalledTimes(1);

            const removeReceivedListener = (Notifications.addNotificationReceivedListener as jest.Mock).mock.results[0].value.remove;
            const removeResponseListener = (Notifications.addNotificationResponseReceivedListener as jest.Mock).mock.results[0].value.remove;

            unmount();

            expect(removeReceivedListener).toHaveBeenCalledTimes(1);
            expect(removeResponseListener).toHaveBeenCalledTimes(1);
        });
    });

    describe('User Login Effect', () => {
        it('clears token on logout', async () => {
            // First render with user to get token
            (useAuth as jest.Mock).mockReturnValue({ user: { id: 'user_1' } });
            (Platform as any).OS = 'android';
            const { result, rerender } = renderHook(() => useNotifications(), { wrapper });

            await waitFor(() => {
                expect(result.current.expoPushToken).toBe('test_token');
            });

            // Simulate logout
            (useAuth as jest.Mock).mockReturnValue({ user: null });
            rerender({});

            await waitFor(() => {
                expect(result.current.expoPushToken).toBeNull();
            });
        });

        describe('Android', () => {
            beforeEach(() => {
                (Platform as any).OS = 'android';
                (useAuth as jest.Mock).mockReturnValue({ user: { id: 'user_1' } });
            });

            it('auto-registers immediately without pre-prompt', async () => {
                const { result } = renderHook(() => useNotifications(), { wrapper });

                await waitFor(() => {
                    expect(result.current.hasPermission).toBe(true);
                    expect(registerForPushNotificationsAsync).toHaveBeenCalledTimes(1);
                });

                expect(savePushToken).toHaveBeenCalledWith('user_1', 'test_token');

                expect(result.current.expoPushToken).toBe('test_token');
                expect(result.current.showPermissionPrompt).toBe(false);
            });
        });

        describe('iOS', () => {
            beforeEach(() => {
                (Platform as any).OS = 'ios';
                (useAuth as jest.Mock).mockReturnValue({ user: { id: 'user_1' } });
            });

            it('registers immediately if permission already granted', async () => {
                (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });

                const { result } = renderHook(() => useNotifications(), { wrapper });

                await waitFor(() => {
                    expect(result.current.hasPermission).toBe(true);
                    expect(registerForPushNotificationsAsync).toHaveBeenCalledTimes(1);
                });

                expect(savePushToken).toHaveBeenCalledWith('user_1', 'test_token');
                expect(result.current.showPermissionPrompt).toBe(false);
            });

            it('shows pre-prompt if permission not granted and prompt not shown before', async () => {
                (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'undetermined' });
                (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

                const { result } = renderHook(() => useNotifications(), { wrapper });

                await waitFor(() => {
                    expect(result.current.showPermissionPrompt).toBe(true);
                });

                expect(registerForPushNotificationsAsync).not.toHaveBeenCalled();
            });

            it('does not register and does not show prompt if permission not granted but prompt shown before', async () => {
                (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'denied' });
                (AsyncStorage.getItem as jest.Mock).mockResolvedValue('true');

                const { result } = renderHook(() => useNotifications(), { wrapper });

                await waitFor(() => {
                    expect(AsyncStorage.getItem).toHaveBeenCalledWith('@meraki_notification_prompt_shown');
                });

                expect(result.current.showPermissionPrompt).toBe(false);
                expect(registerForPushNotificationsAsync).not.toHaveBeenCalled();
            });
        });
    });

    describe('Actions on iOS Pre-Prompt', () => {
        beforeEach(() => {
            (Platform as any).OS = 'ios';
            (useAuth as jest.Mock).mockReturnValue({ user: { id: 'user_1' } });
            (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'undetermined' });
            (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
        });

        it('dismisses prompt, saves status, and registers token on "Enable Notifications"', async () => {
            const { result } = renderHook(() => useNotifications(), { wrapper });

            await waitFor(() => {
                expect(result.current.showPermissionPrompt).toBe(true);
            });

            await act(async () => {
                await result.current.handleEnableNotifications();
            });

            expect(result.current.showPermissionPrompt).toBe(false);
            expect(AsyncStorage.setItem).toHaveBeenCalledWith('@meraki_notification_prompt_shown', 'true');
            expect(result.current.hasPermission).toBe(true);
                    expect(registerForPushNotificationsAsync).toHaveBeenCalledTimes(1);
        });

        it('dismisses prompt and saves status on "Not Now"', async () => {
            const { result } = renderHook(() => useNotifications(), { wrapper });

            await waitFor(() => {
                expect(result.current.showPermissionPrompt).toBe(true);
            });

            await act(async () => {
                result.current.handleSkipNotifications();
            });

            expect(result.current.showPermissionPrompt).toBe(false);
            expect(AsyncStorage.setItem).toHaveBeenCalledWith('@meraki_notification_prompt_shown', 'true');
            expect(registerForPushNotificationsAsync).not.toHaveBeenCalled();
        });
    });

    describe('requestPermission', () => {
        it('requests permission manually and saves token', async () => {
            (useAuth as jest.Mock).mockReturnValue({ user: { id: 'user_1' } });
            const { result } = renderHook(() => useNotifications(), { wrapper });

            let success = false;
            await act(async () => {
                success = await result.current.requestPermission();
            });

            expect(success).toBe(true);
            expect(result.current.hasPermission).toBe(true);
                    expect(registerForPushNotificationsAsync).toHaveBeenCalledTimes(1);
            expect(savePushToken).toHaveBeenCalledWith('user_1', 'test_token');

            expect(result.current.expoPushToken).toBe('test_token');
        });

        it('returns false when token cannot be acquired', async () => {
            (useAuth as jest.Mock).mockReturnValue({ user: { id: 'user_1' } });
            (registerForPushNotificationsAsync as jest.Mock).mockResolvedValue(null);
            const { result } = renderHook(() => useNotifications(), { wrapper });

            let success = true;
            await act(async () => {
                success = await result.current.requestPermission();
            });

            expect(success).toBe(false);
            expect(savePushToken).not.toHaveBeenCalled();
        });
    });

    describe('Handling Notification Responses', () => {
        beforeEach(() => {
            (useAuth as jest.Mock).mockReturnValue({ user: null });
        });

        const simulateNotificationResponse = (data: any) => {
            // First get the callback registered
            const { unmount } = renderHook(() => useNotifications(), { wrapper });
            const listenerCall = (Notifications.addNotificationResponseReceivedListener as jest.Mock).mock.calls[0];
            const callback = listenerCall[0];

            // Invoke the callback with simulated data
            const response = {
                notification: {
                    request: {
                        content: {
                            data
                        }
                    }
                }
            };

            act(() => {
                callback(response);
            });

            unmount();
        };

        it('navigates for appointment_reminder', () => {
            simulateNotificationResponse({ type: 'appointment_reminder', appointmentId: 'apt_1' });
            expect(mockNavigate).toHaveBeenCalledWith('Book', {
                screen: 'AppointmentDetails',
                params: { appointmentId: 'apt_1' },
            });
        });

        it('navigates for confirmation_request with snake_case id', () => {
            simulateNotificationResponse({ type: 'confirmation_request', appointment_id: 'apt_2' });
            expect(mockNavigate).toHaveBeenCalledWith('Book', {
                screen: 'AppointmentDetails',
                params: { appointmentId: 'apt_2' },
            });
        });

        it('navigates for message with conversationId', () => {
            simulateNotificationResponse({ type: 'message', conversationId: 'conv_1' });
            expect(mockNavigate).toHaveBeenCalledWith('Messages', {
                screen: 'Chat',
                params: { conversationId: 'conv_1' },
            });
        });

        it('navigates for message without conversationId', () => {
            simulateNotificationResponse({ type: 'message' });
            expect(mockNavigate).toHaveBeenCalledWith('Messages');
        });

        it('navigates for promotion', () => {
            simulateNotificationResponse({ type: 'promotion' });
            expect(mockNavigate).toHaveBeenCalledWith('Shop');
        });

        it('navigates for aftercare', () => {
            simulateNotificationResponse({ type: 'aftercare', masterId: 'master_1' });
            expect(mockNavigate).toHaveBeenCalledWith('MasterDetail', { masterId: 'master_1' });
        });

        it('navigates for consultation_response', () => {
            simulateNotificationResponse({ type: 'consultation_response' });
            expect(mockNavigate).toHaveBeenCalledWith('Book');
        });

        it('does nothing for unknown type', () => {
            simulateNotificationResponse({ type: 'unknown_type' });
            expect(mockNavigate).not.toHaveBeenCalled();
        });

        it('does nothing if no type is provided', () => {
            simulateNotificationResponse({});
            expect(mockNavigate).not.toHaveBeenCalled();
        });
    });

    describe('Foreground Notification Handling', () => {
        it('sets notification state when received in foreground', () => {
            (useAuth as jest.Mock).mockReturnValue({ user: null });
            const { result } = renderHook(() => useNotifications(), { wrapper });

            const listenerCall = (Notifications.addNotificationReceivedListener as jest.Mock).mock.calls[0];
            const callback = listenerCall[0];

            const mockNotification = { request: { identifier: 'test' } };

            act(() => {
                callback(mockNotification);
            });

            expect(result.current.notification).toBe(mockNotification);
        });
    });
});
