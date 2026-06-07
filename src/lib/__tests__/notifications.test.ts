import * as Notifications from 'expo-notifications';
import {
    registerForPushNotificationsAsync,
    addNotificationResponseListener,
    addNotificationReceivedListener,
} from '../notifications';

// Mock expo-notifications is already configured in jest.setup.js
// but we need to spy on it to test our wrapper functions

describe('notifications', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });


    describe('registerForPushNotificationsAsync', () => {
        it('should return null and log error if getting push token fails', async () => {
            // Mock getPermissionsAsync to return granted so it proceeds to getExpoPushTokenAsync
            (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'granted' });

            // Mock getExpoPushTokenAsync to throw an error
            const mockError = new Error('Test error getting token');
            (Notifications.getExpoPushTokenAsync as jest.Mock).mockRejectedValueOnce(mockError);

            // Spy on console.error
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

            const result = await registerForPushNotificationsAsync();

            expect(result).toBeNull();
            expect(consoleSpy).toHaveBeenCalledWith('Error getting push token:', mockError);

            consoleSpy.mockRestore();
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
