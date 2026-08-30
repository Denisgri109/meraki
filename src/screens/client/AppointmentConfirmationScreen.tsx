import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { format } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useModal } from '../../contexts/ModalContext';
import { Button, Card, ScreenBackground } from '../../components/ui';
import { colors, spacing } from '../../theme';
import { Appointment, Service, Profile } from '../../types/database';

type RootStackParamList = {
    AppointmentConfirmation: { appointmentId: string };
    Home: undefined;
};

type AppointmentConfirmationScreenProps = {
    navigation: NativeStackNavigationProp<RootStackParamList, 'AppointmentConfirmation'>;
    route: RouteProp<RootStackParamList, 'AppointmentConfirmation'>;
};

export function AppointmentConfirmationScreen({ navigation, route }: AppointmentConfirmationScreenProps) {
    const { appointmentId } = route.params;
    const { user } = useAuth();
    const { showAlert, showConfirm } = useModal();

    const [appointment, setAppointment] = useState<Appointment | null>(null);
    const [service, setService] = useState<Service | null>(null);
    const [master, setMaster] = useState<Profile | null>(null);
    const [masterSettings, setMasterSettings] = useState<any>(null);
    const [confirmationDeadline, setConfirmationDeadline] = useState<Date | null>(null);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [confirming, setConfirming] = useState(false); // Added for new handleConfirm logic
    const [alreadyResponded, setAlreadyResponded] = useState(false);

    useEffect(() => {
        loadAppointmentDetails();
    }, []);

    const loadAppointmentDetails = async () => {
        try {
            // Fetch appointment with related data
            const { data: apptData, error: apptError } = await supabase
                .from('appointments')
                .select(`
    *,
    service: services!appointments_service_id_fkey(*),
        master: profiles!appointments_master_id_fkey(*),
            confirmation: appointment_confirmations(*)
                `)
                .eq('id', appointmentId)
                .single();

            if (apptError) throw apptError;

            if (!apptData) {
                showAlert('Error', 'Appointment not found', 'error');
                navigation.goBack();
                return;
            }

            setAppointment(apptData);
            setService(apptData.service);
            setMaster(apptData.master);

            // Check if already responded
            if (apptData.confirmation?.confirmed !== null) {
                setAlreadyResponded(true);
            }

            // Get confirmation deadline
            if (apptData.confirmation_deadline) {
                setConfirmationDeadline(new Date(apptData.confirmation_deadline));
            }

            // Fetch master settings for T&C
            const { data: settings } = await supabase
                .from('master_settings')
                .select('terms_and_conditions')
                .eq('master_id', apptData.master_id)
                .single();

            setMasterSettings(settings);

        } catch (error) {
            console.error('Error loading appointment:', error);
            showAlert('Error', 'Failed to load appointment details', 'error');
        } finally {
            setLoading(false);
        }
    };

    // Tell the master what the client decided. The website does the same, so
    // both platforms notify identically.
    const notifyMaster = async (confirmed: boolean) => {
        const pushToken = (master as any)?.push_token;
        if (!pushToken) return;
        try {
            await supabase.functions.invoke('send-push-notification', {
                body: {
                    to: pushToken,
                    sound: 'default',
                    title: confirmed ? 'Appointment Confirmed ✅' : 'Appointment Cancelled',
                    body: confirmed
                        ? 'A client confirmed their attendance.'
                        : 'A client cancelled their appointment. The slot is open again.',
                    data: { appointmentId, type: confirmed ? 'appointment_confirmed' : 'appointment_cancelled' },
                },
            });
        } catch (e) {
            console.error('Failed to notify master:', e);
        }
    };

    // `client_confirm_appointment` is the same RPC the website uses. The
    // previous implementation called `confirm_appointment_no_payment`, which
    // does not exist in the database, and then navigated to an
    // `AppointmentSuccess` route that is not registered in any navigator — so
    // confirming from a push notification always failed.
    const submitResponse = async (confirmed: boolean) => {
        const { data, error } = await (supabase as any).rpc('client_confirm_appointment', {
            p_appointment_id: appointmentId,
            p_response: confirmed ? 'yes' : 'no',
        });

        if (error) throw error;

        // The RPC returns a single row: { success, new_status, message }.
        const result = Array.isArray(data) ? data[0] : data;
        if (!result?.success) {
            throw new Error(result?.message || 'Failed to submit your response');
        }
        await notifyMaster(confirmed);
        return result;
    };

    const handleConfirm = () => {
        showConfirm(
            'Confirm Appointment',
            'Are you sure you want to confirm this appointment? Since no payment is required, this will finalize your booking.',
            async () => {
                setConfirming(true);
                try {
                    await submitResponse(true);
                    showAlert('Appointment Confirmed', 'Your attendance is confirmed. See you soon!', 'success', {
                        onConfirm: () => navigation.navigate('Home'),
                    });
                } catch (error: any) {
                    console.error('Error confirming appointment:', error);
                    showAlert('Error', error.message || 'Something went wrong', 'error');
                } finally {
                    setConfirming(false);
                }
            }
        );
    };

    const handleCancel = async () => {
        if (!user || !appointment) return;

        showConfirm(
            'Cancel Appointment?',
            'Are you sure you want to cancel this appointment? The time slot will be released.',
            async () => {
                setProcessing(true);
                try {
                    await submitResponse(false);
                    showAlert('Appointment Cancelled', 'Your appointment has been cancelled.', 'success');
                    navigation.navigate('Home');
                } catch (error: any) {
                    showAlert('Error', error.message || 'Something went wrong', 'error');
                } finally {
                    setProcessing(false);
                }
            },
            { confirmDestructive: true }
        );
    };

    const formatDeadline = () => {
        if (!confirmationDeadline) return '';
        return format(confirmationDeadline, "EEEE, MMMM d 'at' h:mm a");
    };

    const isDeadlinePassed = () => {
        if (!confirmationDeadline) return false;
        return new Date() > confirmationDeadline;
    };

    if (loading) {
        return (
            <ScreenBackground>
                <SafeAreaView style={styles.container}>
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={colors.text} />
                        <Text style={styles.loadingText}>Loading appointment details...</Text>
                    </View>
                </SafeAreaView>
            </ScreenBackground>
        );
    }

    if (alreadyResponded) {
        const isConfirmed = appointment?.status === 'confirmed';
        return (
            <ScreenBackground>
                <SafeAreaView style={styles.container}>
                    <View style={styles.respondedContainer}>
                        <Text style={styles.respondedEmoji}>
                            {isConfirmed ? '✅' : '❌'}
                        </Text>
                        <Text style={styles.respondedTitle}>
                            {isConfirmed ? 'Already Confirmed' : 'Already Cancelled'}
                        </Text>
                        <Text style={styles.respondedMessage}>
                            {isConfirmed
                                ? 'You have already confirmed this appointment. We look forward to seeing you!'
                                : 'This appointment has already been cancelled.'}
                        </Text>
                        <Button
                            title="Go to Home"
                            onPress={() => navigation.navigate('Home')}
                            fullWidth
                            style={styles.goHomeButton}
                        />
                    </View>
                </SafeAreaView>
            </ScreenBackground>
        );
    }

    if (isDeadlinePassed()) {
        return (
            <ScreenBackground>
                <SafeAreaView style={styles.container}>
                    <View style={styles.respondedContainer}>
                        <Text style={styles.respondedEmoji}>⏰</Text>
                        <Text style={styles.respondedTitle}>Confirmation Deadline Passed</Text>
                        <Text style={styles.respondedMessage}>
                            The confirmation deadline for this appointment has passed. The appointment may have been automatically cancelled.
                        </Text>
                        <Button
                            title="Go to Home"
                            onPress={() => navigation.navigate('Home')}
                            fullWidth
                            style={styles.goHomeButton}
                        />
                    </View>
                </SafeAreaView>
            </ScreenBackground>
        );
    }

    const noShowPercentage = 100;
    const termsAndConditions = masterSettings?.terms_and_conditions;

    return (
        <ScreenBackground>
            <SafeAreaView style={styles.container}>
                <View style={styles.content}>
                    {/* Header */}
                    <View style={styles.header}>
                        <MaterialIcons name="event-available" size={48} color={colors.primary} />
                        <Text style={styles.title}>Confirm Your Appointment</Text>
                        <Text style={styles.subtitle}>
                            Please confirm or cancel your upcoming appointment
                        </Text>
                    </View>

                    {/* Appointment Details */}
                    <Card style={styles.detailsCard} variant="glass">
                        <View style={styles.detailRow}>
                            <Text style={styles.detailIcon}>💅</Text>
                            <View style={styles.detailInfo}>
                                <Text style={styles.detailLabel}>Service</Text>
                                <Text style={styles.detailValue}>{service?.name}</Text>
                            </View>
                        </View>

                        <View style={styles.detailRow}>
                            <Text style={styles.detailIcon}>👤</Text>
                            <View style={styles.detailInfo}>
                                <Text style={styles.detailLabel}>Master</Text>
                                <Text style={styles.detailValue}>{master?.full_name}</Text>
                            </View>
                        </View>

                        <View style={styles.detailRow}>
                            <MaterialIcons name="event" size={16} color={colors.textSecondary} />
                            <View style={styles.detailInfo}>
                                <Text style={styles.detailLabel}>Date</Text>
                                <Text style={styles.detailValue}>
                                    {appointment?.start_time && format(new Date(appointment.start_time), 'EEEE, MMMM d, yyyy')}
                                </Text>
                            </View>
                        </View>

                        <View style={[styles.detailRow, { borderBottomWidth: 0 }]}>
                            <MaterialIcons name="schedule" size={16} color={colors.textSecondary} />
                            <View style={styles.detailInfo}>
                                <Text style={styles.detailLabel}>Time</Text>
                                <Text style={styles.detailValue}>
                                    {appointment?.start_time && format(new Date(appointment.start_time), 'h:mm a')}
                                </Text>
                            </View>
                        </View>
                    </Card>

                    {/* Deadline Warning */}
                    <View style={styles.deadlineBox}>
                        <Text style={styles.deadlineIcon}>⏰</Text>
                        <Text style={styles.deadlineText}>
                            Please respond by:{'\n'}
                            <Text style={styles.deadlineTime}>{formatDeadline()}</Text>
                        </Text>
                    </View>

                    {/* No-Show Policy */}
                    <View style={styles.policyBox}>
                        <MaterialIcons name="warning" size={20} color="#FFA500" />
                        <Text style={styles.policyTitle}>Important No-Show Policy</Text>
                        <Text style={styles.policyText}>
                            By confirming, you agree to our no-show policy: If you don't show up or arrive significantly late, you may be charged {noShowPercentage}% of the service price as a no-show fee.
                        </Text>
                    </View>

                    {/* Terms & Conditions */}
                    {termsAndConditions && (
                        <View style={styles.termsBox}>
                            <Text style={styles.termsTitle}>Terms & Conditions</Text>
                            <Text style={styles.termsText} numberOfLines={4}>
                                {termsAndConditions}
                            </Text>
                        </View>
                    )}

                    {/* Action Buttons */}
                    <View style={styles.buttonContainer}>
                        <Button
                            title={processing ? 'Processing...' : '✅ YES, I\'ll Be There'}
                            onPress={handleConfirm}
                            loading={processing}
                            fullWidth
                            variant="primary"
                            style={styles.confirmButton}
                        />

                        <Button
                            title="❌ NO, Cancel Appointment"
                            onPress={handleCancel}
                            loading={processing}
                            fullWidth
                            variant="secondary"
                            style={styles.cancelButton}
                        />
                    </View>
                </View>
            </SafeAreaView>
        </ScreenBackground>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        flex: 1,
        padding: spacing.lg,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: spacing.md,
        color: colors.textSecondary,
        fontSize: 14,
    },
    respondedContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.xl,
    },
    respondedEmoji: {
        fontSize: 64,
        marginBottom: spacing.lg,
    },
    respondedTitle: {
        fontSize: 24,
        fontWeight: '600',
        color: colors.text,
        marginBottom: spacing.md,
        textAlign: 'center',
    },
    respondedMessage: {
        fontSize: 16,
        color: colors.textSecondary,
        textAlign: 'center',
        marginBottom: spacing.xl,
        lineHeight: 24,
    },
    goHomeButton: {
        minWidth: 200,
    },
    header: {
        alignItems: 'center',
        marginBottom: spacing.lg,
    },
    emoji: {
        fontSize: 48,
        marginBottom: spacing.md,
    },
    title: {
        fontSize: 28,
        fontWeight: '600',
        color: colors.text,
        marginBottom: spacing.xs,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 14,
        color: colors.textSecondary,
        textAlign: 'center',
    },
    detailsCard: {
        marginBottom: spacing.lg,
        padding: spacing.lg,
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    detailIcon: {
        fontSize: 24,
        marginRight: spacing.md,
    },
    detailInfo: {
        flex: 1,
    },
    detailLabel: {
        fontSize: 12,
        color: colors.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: spacing.xs,
    },
    detailValue: {
        fontSize: 16,
        fontWeight: '500',
        color: colors.text,
    },
    deadlineBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 193, 7, 0.1)',
        borderRadius: 12,
        padding: spacing.md,
        marginBottom: spacing.md,
        borderLeftWidth: 4,
        borderLeftColor: '#ffc107',
    },
    deadlineIcon: {
        fontSize: 24,
        marginRight: spacing.md,
    },
    deadlineText: {
        flex: 1,
        fontSize: 14,
        color: '#856404',
        lineHeight: 20,
    },
    deadlineTime: {
        fontWeight: '600',
    },
    policyBox: {
        backgroundColor: 'rgba(248, 215, 218, 0.5)',
        borderRadius: 12,
        padding: spacing.md,
        marginBottom: spacing.md,
        borderLeftWidth: 4,
        borderLeftColor: '#dc3545',
    },
    policyIcon: {
        fontSize: 24,
        marginBottom: spacing.xs,
    },
    policyTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#721c24',
        marginBottom: spacing.xs,
    },
    policyText: {
        fontSize: 14,
        color: '#721c24',
        lineHeight: 20,
    },
    termsBox: {
        backgroundColor: 'rgba(0, 0, 0, 0.04)',
        borderRadius: 12,
        padding: spacing.md,
        marginBottom: spacing.lg,
    },
    termsTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.text,
        marginBottom: spacing.xs,
    },
    termsText: {
        fontSize: 12,
        color: colors.textSecondary,
        lineHeight: 18,
    },
    buttonContainer: {
        marginTop: 'auto',
        gap: spacing.md,
    },
    confirmButton: {
        backgroundColor: '#22C55E',
    },
    cancelButton: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: colors.border,
    },
});

export default AppointmentConfirmationScreen;
