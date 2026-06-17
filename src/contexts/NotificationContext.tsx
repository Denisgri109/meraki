import React, { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';
import {
    registerForPushNotificationsAsync,
    savePushToken,
    NotificationData,
} from '../lib/notifications';

const NOTIFICATION_PROMPT_SHOWN_KEY = '@meraki_notification_prompt_shown';

interface NotificationContextType {
    expoPushToken: string | null;
    notification: Notifications.Notification | null;
    hasPermission: boolean;
    requestPermission: () => Promise<boolean>;
    /** Whether the iOS pre-permission prompt should be visible */
    showPermissionPrompt: boolean;
    /** Called when user taps "Enable Notifications" on the pre-prompt */
    handleEnableNotifications: () => Promise<void>;
    /** Called when user taps "Not Now" on the pre-prompt */
    handleSkipNotifications: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function useNotifications() {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error('useNotifications must be used within a NotificationProvider');
    }
    return context;
}

interface NotificationProviderProps {
    children: ReactNode;
}

export function NotificationProvider({ children }: NotificationProviderProps) {
    const { user } = useAuth();
    const navigation = useNavigation<any>();
    const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
    const [notification, setNotification] = useState<Notifications.Notification | null>(null);
    const [hasPermission, setHasPermission] = useState(false);
    const [showPermissionPrompt, setShowPermissionPrompt] = useState(false);

    const notificationListener = useRef<Notifications.Subscription | null>(null);
    const responseListener = useRef<Notifications.Subscription | null>(null);

    // Register for push notifications when user logs in
    useEffect(() => {
        if (user) {
            if (Platform.OS === 'ios') {
                // On iOS, check if we've already shown the pre-prompt
                checkAndShowIOSPrompt();
            } else {
                // On Android, auto-register immediately (no pre-prompt needed)
                registerAndSaveToken();
            }
        } else if (expoPushToken) {
            // Clear token on logout
            setExpoPushToken(null);
        }
    }, [user]);

    // Set up notification listeners
    useEffect(() => {
        // Listener for notifications received while app is foregrounded
        notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
            setNotification(notification);
        });

        // Listener for when user taps on notification
        responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
            handleNotificationResponse(response);
        });

        return () => {
            if (notificationListener.current) {
                notificationListener.current.remove();
            }
            if (responseListener.current) {
                responseListener.current.remove();
            }
        };
    }, [navigation]);

    /**
     * On iOS, check if we already have permission or if the prompt was already shown.
     * If neither, show our branded pre-permission prompt.
     */
    const checkAndShowIOSPrompt = async () => {
        // First check if we already have permission
        const { status } = await Notifications.getPermissionsAsync();
        if (status === 'granted') {
            // Already have permission, just register
            await registerAndSaveToken();
            return;
        }

        // Check if we've already shown the pre-prompt before
        const promptShown = await AsyncStorage.getItem(NOTIFICATION_PROMPT_SHOWN_KEY);
        if (promptShown === 'true') {
            // We showed it before but user may have denied. Don't show again.
            return;
        }

        // Show our branded pre-permission prompt
        setShowPermissionPrompt(true);
    };

    /**
     * Called when the user taps "Enable Notifications" on our branded prompt.
     * This then triggers the real native iOS permission dialog.
     */
    const handleEnableNotifications = async () => {
        setShowPermissionPrompt(false);
        await AsyncStorage.setItem(NOTIFICATION_PROMPT_SHOWN_KEY, 'true');
        await registerAndSaveToken();
    };

    /**
     * Called when the user taps "Not Now" on our branded prompt.
     */
    const handleSkipNotifications = () => {
        setShowPermissionPrompt(false);
        AsyncStorage.setItem(NOTIFICATION_PROMPT_SHOWN_KEY, 'true');
    };

    const registerAndSaveToken = async () => {
        const token = await registerForPushNotificationsAsync();

        if (token) {
            setExpoPushToken(token);
            setHasPermission(true);

            if (user) {
                await savePushToken(user.id, token);
            }
        }
    };

    const requestPermission = async (): Promise<boolean> => {
        const token = await registerForPushNotificationsAsync();

        if (token) {
            setExpoPushToken(token);
            setHasPermission(true);

            if (user) {
                await savePushToken(user.id, token);
            }
            return true;
        }

        return false;
    };

    const handleNotificationResponse = (response: Notifications.NotificationResponse) => {
        const rawData = response.notification.request.content.data;
        const data = rawData as unknown as NotificationData | undefined;

        if (!data?.type) return;

        const appointmentId = data.appointmentId || data.appointment_id;
        const conversationId = data.conversationId || data.conversation_id;
        const masterId = data.masterId || data.master_id;

        switch (data.type) {
            case 'appointment_reminder':
            case 'confirmation_request':
                if (appointmentId) {
                    navigation.navigate('Book', {
                        screen: 'AppointmentDetails',
                        params: { appointmentId },
                    });
                }
                break;

            case 'message':
                if (conversationId) {
                    navigation.navigate('Messages', {
                        screen: 'Chat',
                        params: { conversationId },
                    });
                } else {
                    navigation.navigate('Messages');
                }
                break;

            case 'consultation_response':
                navigation.navigate('Book');
                break;

            default:
                console.log('Unknown notification type:', data.type);
        }
    };

    return (
        <NotificationContext.Provider
            value={{
                expoPushToken,
                notification,
                hasPermission,
                requestPermission,
                showPermissionPrompt,
                handleEnableNotifications,
                handleSkipNotifications,
            }}
        >
            {children}
        </NotificationContext.Provider>
    );
}

export default NotificationContext;
