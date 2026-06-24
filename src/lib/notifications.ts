import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from './supabase';

// Configure notification behavior
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

export interface NotificationData {
    type: 'appointment_reminder' | 'confirmation_request' | 'message' | 'consultation_response';
    appointmentId?: string;
    appointment_id?: string;
    conversationId?: string;
    conversation_id?: string;
    masterId?: string;
    master_id?: string;
    consultationId?: string;
    consultation_id?: string;
}

/**
 * Register for push notifications and get the Expo Push Token
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
    let token: string | null = null;

    // Check if physical device (push notifications don't work on simulators)
    if (!Device.isDevice) {
        if (__DEV__) {
            console.debug('Push notifications require a physical device');
        }
        return null;
    }

    // Check existing permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // Request permission if not already granted
    if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync({
            ios: {
                allowAlert: true,
                allowBadge: true,
                allowSound: true,
                allowProvisional: true,
            },
        });
        finalStatus = status;
    }

    if (finalStatus !== 'granted') {
        if (__DEV__) {
            console.warn('Failed to get push token - permission not granted');
        }
        return null;
    }

    try {
        // Get the Expo push token
        const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;

        if (!projectId) {
            if (__DEV__) {
                console.warn('No project ID found for push notifications');
            }
            return null;
        }

        const pushToken = await Notifications.getExpoPushTokenAsync({
            projectId,
        });

        token = pushToken.data;
        if (__DEV__) {
            console.debug('Push token obtained successfully');
        }
    } catch (error) {
        if (__DEV__) {
            console.error('Error getting push token:', error);
        }
        return null;
    }

    // Android-specific channel setup
    if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
            name: 'Default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#8B5CF6',
        });

        await Notifications.setNotificationChannelAsync('appointments', {
            name: 'Appointments',
            description: 'Appointment reminders and confirmations',
            importance: Notifications.AndroidImportance.HIGH,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#8B5CF6',
        });

        await Notifications.setNotificationChannelAsync('messages', {
            name: 'Messages',
            description: 'New message notifications',
            importance: Notifications.AndroidImportance.HIGH,
            sound: 'default',
        });

    }

    return token;
}

/**
 * Save the push token to the user's profile in Supabase
 */
export async function savePushToken(userId: string, token: string): Promise<boolean> {
    try {
        const { error } = await supabase
            .from('profiles')
            .update({
                push_token: token,
                push_token_updated_at: new Date().toISOString(),
            } as any)
            .eq('id', userId);

        if (error) {
            if (__DEV__) {
                console.error('Error saving push token:', error);
            }
            return false;
        }

        if (__DEV__) {
            console.debug('Push token saved successfully');
        }
        return true;
    } catch (error) {
        if (__DEV__) {
            console.error('Error saving push token:', error);
        }
        return false;
    }
}

/**
 * Remove push token from user's profile (on logout)
 */
export async function removePushToken(userId: string): Promise<void> {
    try {
        await supabase
            .from('profiles')
            .update({
                push_token: null,
                push_token_updated_at: null,
            } as any)
            .eq('id', userId);
    } catch (error) {
        if (__DEV__) {
            console.error('Error removing push token:', error);
        }
    }
}

/**
 * Schedule a local notification (for testing or offline use)
 */
export async function scheduleLocalNotification(
    title: string,
    body: string,
    data?: NotificationData,
    triggerSeconds?: number
): Promise<string> {
    const trigger: Notifications.NotificationTriggerInput = triggerSeconds
        ? { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: triggerSeconds, repeats: false }
        : null;

    const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
            title,
            body,
            data: data as unknown as Record<string, unknown> | undefined,
            sound: 'default',
        },
        trigger,
    });

    return notificationId;
}

/**
 * Cancel a scheduled notification
 */
export async function cancelNotification(notificationId: string): Promise<void> {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
}

/**
 * Cancel all scheduled notifications
 */
export async function cancelAllNotifications(): Promise<void> {
    await Notifications.cancelAllScheduledNotificationsAsync();
}

/**
 * Get all scheduled notifications
 */
export async function getScheduledNotifications() {
    return await Notifications.getAllScheduledNotificationsAsync();
}

/**
 * Set badge count (iOS)
 */
export async function setBadgeCount(count: number): Promise<void> {
    await Notifications.setBadgeCountAsync(count);
}

/**
 * Add notification response listener
 */
export function addNotificationResponseListener(
    callback: (response: Notifications.NotificationResponse) => void
): Notifications.Subscription {
    return Notifications.addNotificationResponseReceivedListener(callback);
}

/**
 * Add notification received listener (when app is in foreground)
 */
export function addNotificationReceivedListener(
    callback: (notification: Notifications.Notification) => void
): Notifications.Subscription {
    return Notifications.addNotificationReceivedListener(callback);
}

export default {
    registerForPushNotificationsAsync,
    savePushToken,
    removePushToken,
    scheduleLocalNotification,
    cancelNotification,
    cancelAllNotifications,
    getScheduledNotifications,
    setBadgeCount,
    addNotificationResponseListener,
    addNotificationReceivedListener,
};
