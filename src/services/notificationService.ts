import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from '../lib/supabase';

// Configure notification handler
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

// Check if running in Expo Go
const isExpoGo = Constants.appOwnership === 'expo';

// Notification response listener subscription
let notificationResponseSubscription: Notifications.Subscription | null = null;

export type NotificationData = {
    type?: 'appointment_reminder' | 'message' | 'marketing';
    appointment_id?: string;
    conversation_id?: string;
    message_id?: string;
};

// Callback type for handling notification taps
export type NotificationTapHandler = (data: NotificationData) => void;

/**
 * Set up listener for when user taps on a notification
 */
export function setupNotificationResponseListener(onTap: NotificationTapHandler): () => void {
    // Clean up existing subscription if any
    if (notificationResponseSubscription) {
        notificationResponseSubscription.remove();
    }

    notificationResponseSubscription = Notifications.addNotificationResponseReceivedListener(response => {
        const data = response.notification.request.content.data as NotificationData;
        console.log('Notification tapped:', data);
        onTap(data);
    });

    // Return cleanup function
    return () => {
        notificationResponseSubscription?.remove();
        notificationResponseSubscription = null;
    };
}

/**
 * Set up listener for foreground notifications
 */
export function setupForegroundNotificationListener(
    onReceived: (notification: Notifications.Notification) => void
): () => void {
    const subscription = Notifications.addNotificationReceivedListener(onReceived);
    return () => subscription.remove();
}

export async function registerForPushNotificationsAsync(userId: string) {
    // Push notifications don't work in Expo Go - silently skip
    if (isExpoGo) {
        console.log('Push notifications are not available in Expo Go. Use a development build for full functionality.');
        return null;
    }

    let token;

    if (Platform.OS === 'android') {
        // Create notification channels for Android
        await Notifications.setNotificationChannelAsync('default', {
            name: 'Default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FF231F7C',
        });

        await Notifications.setNotificationChannelAsync('appointments', {
            name: 'Appointment Reminders',
            importance: Notifications.AndroidImportance.HIGH,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#8B5CF6',
        });

        await Notifications.setNotificationChannelAsync('messages', {
            name: 'Messages',
            importance: Notifications.AndroidImportance.HIGH,
            vibrationPattern: [0, 100, 100, 100],
            lightColor: '#3B82F6',
        });
    }

    if (Device.isDevice) {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }
        if (finalStatus !== 'granted') {
            console.log('Push notification permission not granted');
            // Allow app to continue even if push is rejected
            return null;
        }

        // Get the token with projectId from app config
        try {
            const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;

            if (!projectId) {
                console.log('No projectId found');
                return null;
            }

            token = (await Notifications.getExpoPushTokenAsync({
                projectId,
            })).data;

            // Save token to user profile
            if (userId && token) {
                const { error } = await supabase
                    .from('profiles')
                    .update({ push_token: token })
                    .eq('id', userId);

                if (error) {
                    console.error('Error saving push token:', error);
                }
            }

        } catch (e: any) {
            console.error('Push notifications error:', e);
            return null;
        }
    } else {
        console.log('Push notifications require a physical device');
    }

    return token;
}
