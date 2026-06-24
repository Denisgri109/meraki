import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from '../../lib/supabase';
import {
    setupNotificationResponseListener,
    setupForegroundNotificationListener,
    registerForPushNotificationsAsync,
} from '../notificationService';

jest.mock('../../lib/supabase', () => ({
    supabase: {
        from: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ error: null }),
    },
}));

describe('notificationService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('setupNotificationResponseListener', () => {
        it('sets up a notification response listener and returns a cleanup function', () => {
            const onTap = jest.fn();
            const mockRemove = jest.fn();
            (Notifications.addNotificationResponseReceivedListener as jest.Mock).mockReturnValue({ remove: mockRemove });

            const cleanup = setupNotificationResponseListener(onTap);

            expect(Notifications.addNotificationResponseReceivedListener).toHaveBeenCalled();
            expect(typeof cleanup).toBe('function');

            cleanup();
            expect(mockRemove).toHaveBeenCalled();
        });

        it('extracts data and calls onTap when a notification is tapped', () => {
            const onTap = jest.fn();
            let listenerCallback: any;
            (Notifications.addNotificationResponseReceivedListener as jest.Mock).mockImplementation((cb) => {
                listenerCallback = cb;
                return { remove: jest.fn() };
            });

            setupNotificationResponseListener(onTap);

            const mockData = { type: 'appointment_reminder', appointment_id: '123' };
            const mockResponse = {
                notification: {
                    request: {
                        content: {
                            data: mockData,
                        },
                    },
                },
            };

            listenerCallback(mockResponse);

            expect(onTap).toHaveBeenCalledWith(mockData);
        });

        it('cleans up existing subscription before creating a new one', () => {
            const onTap = jest.fn();
            const mockRemove1 = jest.fn();
            const mockRemove2 = jest.fn();

            (Notifications.addNotificationResponseReceivedListener as jest.Mock)
                .mockReturnValueOnce({ remove: mockRemove1 })
                .mockReturnValueOnce({ remove: mockRemove2 });

            setupNotificationResponseListener(onTap);
            setupNotificationResponseListener(onTap);

            expect(mockRemove1).toHaveBeenCalled();
            expect(Notifications.addNotificationResponseReceivedListener).toHaveBeenCalledTimes(2);
        });
    });

    describe('setupForegroundNotificationListener', () => {
        it('sets up a foreground notification listener and returns a cleanup function', () => {
            const onReceived = jest.fn();
            const mockRemove = jest.fn();
            (Notifications.addNotificationReceivedListener as jest.Mock).mockReturnValue({ remove: mockRemove });

            const cleanup = setupForegroundNotificationListener(onReceived);

            expect(Notifications.addNotificationReceivedListener).toHaveBeenCalledWith(onReceived);
            expect(typeof cleanup).toBe('function');

            cleanup();
            expect(mockRemove).toHaveBeenCalled();
        });
    });

    describe('registerForPushNotificationsAsync', () => {
        beforeEach(() => {
            // Reset constants to typical physical device values
            (Constants as any).appOwnership = 'standalone';
            (Device as any).isDevice = true;
            Platform.OS = 'ios';
            (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
            (Notifications.getExpoPushTokenAsync as jest.Mock).mockResolvedValue({ data: 'ExponentPushToken[mock_token]' });
        });

        it('creates notification channels on Android', async () => {
            Platform.OS = 'android';

            await registerForPushNotificationsAsync('user_123');

            expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith('default', expect.any(Object));
            expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith('appointments', expect.any(Object));
            expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith('messages', expect.any(Object));
        });

        it('requests permissions if not already granted', async () => {
            (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'undetermined' });
            (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });

            await registerForPushNotificationsAsync('user_123');

            expect(Notifications.requestPermissionsAsync).toHaveBeenCalled();
        });

        it('returns null if permission is ultimately not granted', async () => {
            (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'undetermined' });
            (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'denied' });
            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

            const token = await registerForPushNotificationsAsync('user_123');

            expect(token).toBeNull();
            expect(consoleSpy).toHaveBeenCalledWith('Push notification permission not granted');
            consoleSpy.mockRestore();
        });

        it('returns null if projectId is missing', async () => {
            (Constants as any).expoConfig = { extra: { eas: {} } };
            (Constants as any).easConfig = {};
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

            const token = await registerForPushNotificationsAsync('user_123');

            expect(token).toBeNull();
            expect(consoleSpy).toHaveBeenCalledWith('Push notifications error:', 'No projectId found');
            consoleSpy.mockRestore();
        });

        it('gets push token and saves it to supabase profile', async () => {
            // Restore mocked constant correctly for projectId check
            (Constants as any).expoConfig = { extra: { eas: { projectId: 'test-project-id' } } };

            const mockEq = jest.fn().mockResolvedValue({ error: null });
            const mockUpdate = jest.fn().mockReturnValue({ eq: mockEq });
            (supabase.from as jest.Mock).mockReturnValue({ update: mockUpdate });

            const token = await registerForPushNotificationsAsync('user_123');

            expect(Notifications.getExpoPushTokenAsync).toHaveBeenCalledWith({ projectId: 'test-project-id' });
            expect(token).toBe('ExponentPushToken[mock_token]');

            expect(supabase.from).toHaveBeenCalledWith('profiles');
            expect(mockUpdate).toHaveBeenCalledWith({ push_token: 'ExponentPushToken[mock_token]' });
            expect(mockEq).toHaveBeenCalledWith('id', 'user_123');
        });

        it('logs error if saving to supabase fails', async () => {
            (Constants as any).expoConfig = { extra: { eas: { projectId: 'test-project-id' } } };

            const mockError = new Error('Supabase error');
            const mockEq = jest.fn().mockResolvedValue({ error: mockError });
            const mockUpdate = jest.fn().mockReturnValue({ eq: mockEq });
            (supabase.from as jest.Mock).mockReturnValue({ update: mockUpdate });

            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

            await registerForPushNotificationsAsync('user_123');

            expect(consoleSpy).toHaveBeenCalledWith('Error saving push token:', mockError.message);
            consoleSpy.mockRestore();
        });

        it('returns null and logs error if getting push token fails', async () => {
            (Constants as any).expoConfig = { extra: { eas: { projectId: 'test-project-id' } } };

            const mockError = new Error('Token error');
            (Notifications.getExpoPushTokenAsync as jest.Mock).mockRejectedValue(mockError);

            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

            const token = await registerForPushNotificationsAsync('user_123');

            expect(token).toBeNull();
            expect(consoleSpy).toHaveBeenCalledWith('Push notifications error:', mockError.message);
            consoleSpy.mockRestore();
        });
    });
});
