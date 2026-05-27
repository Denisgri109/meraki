import * as Notifications from 'expo-notifications';
import {
    addNotificationResponseListener,
    addNotificationReceivedListener,
    registerForPushNotificationsAsync,
} from '../notifications';

// Mock expo-notifications is already configured in jest.setup.js
// but we need to spy on it to test our wrapper functions

describe('notifications', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('registerForPushNotificationsAsync', () => {
        it('should return the push token on success', async () => {
            const token = await registerForPushNotificationsAsync();
            expect(token).toBe('ExponentPushToken[test]');
            expect(Notifications.getExpoPushTokenAsync).toHaveBeenCalledTimes(1);
        });

        it('should return null and log an error if getting push token fails', async () => {
            const mockError = new Error('Push token error');
            (Notifications.getExpoPushTokenAsync as jest.Mock).mockRejectedValueOnce(mockError);
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

            const token = await registerForPushNotificationsAsync();

            expect(token).toBeNull();
            expect(Notifications.getExpoPushTokenAsync).toHaveBeenCalledTimes(1);
            expect(consoleErrorSpy).toHaveBeenCalledWith('Error getting push token:', mockError);
        });
    });

    describe('addNotificationResponseListener', () => {
        it('should call Notifications.addNotificationResponseReceivedListener with the provided callback', () => {
            const mockCallback = jest.fn();
            const mockSubscription = { remove: jest.fn() } as unknown as Notifications.Subscription;

            (Notifications.addNotificationResponseReceivedListener as jest.Mock).mockReturnValueOnce(mockSubscription);

            const result = addNotificationResponseListener(mockCallback);

            expect(Notifications.addNotificationResponseReceivedListener).toHaveBeenCalledTimes(1);
            expect(Notifications.addNotificationResponseReceivedListener).toHaveBeenCalledWith(mockCallback);
            expect(result).toBe(mockSubscription);
        });
    });

    describe('addNotificationReceivedListener', () => {
        it('should call Notifications.addNotificationReceivedListener with the provided callback', () => {
            const mockCallback = jest.fn();
            const mockSubscription = { remove: jest.fn() } as unknown as Notifications.Subscription;

            (Notifications.addNotificationReceivedListener as jest.Mock).mockReturnValueOnce(mockSubscription);

            const result = addNotificationReceivedListener(mockCallback);

            expect(Notifications.addNotificationReceivedListener).toHaveBeenCalledTimes(1);
            expect(Notifications.addNotificationReceivedListener).toHaveBeenCalledWith(mockCallback);
            expect(result).toBe(mockSubscription);
        });
    });
});
