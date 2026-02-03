import React, { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { useNavigation } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import { useAuth } from './AuthContext';
import {
    registerForPushNotificationsAsync,
    savePushToken,
    NotificationData,
} from '../lib/notifications';

interface NotificationContextType {
    expoPushToken: string | null;
    notification: Notifications.Notification | null;
    hasPermission: boolean;
    requestPermission: () => Promise<boolean>;
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

    const notificationListener = useRef<Notifications.Subscription | null>(null);
    const responseListener = useRef<Notifications.Subscription | null>(null);

    // Register for push notifications when user logs in
    useEffect(() => {
        if (user) {
            registerAndSaveToken();
        } else if (expoPushToken) {
            // Clear token on logout
            setExpoPushToken(null);
        }
    }, [user]);

    // Set up notification listeners
    useEffect(() => {
        // Listener for notifications received while app is foregrounded
        notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
            console.log('Notification received in foreground:', notification);
            setNotification(notification);
        });

        // Listener for when user taps on notification
        responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
            console.log('Notification tapped:', response);
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

        switch (data.type) {
            case 'appointment_reminder':
            case 'confirmation_request':
                if (data.appointmentId) {
                    // Navigate to appointment details
                    navigation.navigate('Book', {
                        screen: 'AppointmentDetails',
                        params: { appointmentId: data.appointmentId },
                    });
                }
                break;

            case 'message':
                if (data.conversationId) {
                    navigation.navigate('Messages', {
                        screen: 'Chat',
                        params: { conversationId: data.conversationId },
                    });
                } else {
                    navigation.navigate('Messages');
                }
                break;

            case 'promotion':
                navigation.navigate('Shop');
                break;

            case 'aftercare':
                if (data.masterId) {
                    navigation.navigate('MasterDetail', { masterId: data.masterId });
                }
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
            }}
        >
            {children}
        </NotificationContext.Provider>
    );
}

export default NotificationContext;
