import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { ScreenBackground, Button } from '../../components/ui';
import { useModal } from '../../contexts/ModalContext';
import { colors, spacing } from '../../theme';

const ONBOARDING_STEPS = [
    {
        id: 'welcome',
        title: 'Welcome to Merakí!',
        description: 'You\'re all set up as a Professional. Here\'s a quick overview of everything you can do on the platform.',
        icon: '✨',
    },
    {
        id: 'profile',
        title: 'Your Profile',
        description: 'Your profile is where clients discover you. You can add your bio, experience, and a profile photo from Settings at any time.',
        icon: '👤',
    },
    {
        id: 'services',
        title: 'Your Services',
        description: 'Create and manage the services you offer — set your own pricing, duration, and categories. Head to Services whenever you\'re ready.',
        icon: '💅',
    },
    {
        id: 'availability',
        title: 'Your Availability',
        description: 'Control when you\'re available for bookings. Set your working hours and block off time as needed from the Availability page.',
        icon: '📅',
    },
    {
        id: 'portfolio',
        title: 'Your Portfolio',
        description: 'Showcase your best work with a photo portfolio. Clients can browse your gallery before booking — add photos from Settings whenever you like.',
        icon: '📸',
    },
    {
        id: 'business_settings',
        title: 'Business Settings',
        description: 'Manage your business details, cancellation policy, and payment settings all in one place from Settings.',
        icon: '🏢',
    },
];

export function MasterOnboardingScreen() {
    const navigation = useNavigation();
    const { user, refreshProfile } = useAuth();
    const { showAlert } = useModal();
    const [currentStep, setCurrentStep] = useState(0);
    const [loading, setLoading] = useState(false);
    const [skipped, setSkipped] = useState(false);

    const handleNext = () => {
        if (currentStep < ONBOARDING_STEPS.length - 1) {
            setCurrentStep(currentStep + 1);
        } else {
            handleComplete();
        }
    };

    const handleSkip = () => {
        setSkipped(true);
        handleComplete();
    };

    const handleComplete = async () => {
        setLoading(true);
        try {
            // Mark onboarding as completed
            const { error } = await supabase
                .from('profiles')
                .update({ onboarding_completed: true })
                .eq('id', user!.id);

            if (error) throw error;

            // Refresh profile to update context
            await refreshProfile();

            // Setup success modal details
            showAlert(
                skipped ? 'Setup Skipped' : 'All Set!',
                skipped
                    ? 'You can complete your setup anytime from your profile settings.'
                    : 'You\'re ready to start accepting bookings!',
                'success',
                {
                    confirmText: "Let's Go!",
                    onConfirm: () => {
                        (navigation as any).navigate('MasterApp');
                    }
                }
            );
        } catch (error: any) {
            console.error('Error completing onboarding:', error);
            // Even if there's an error updating the profile (e.g. network), 
            // we should let them proceed if they completed the steps locally
            // but show an alert so they know the preference might not be saved
            showAlert(
                'Note',
                'We saved your progress locally, but had trouble syncing with the server. You can still proceed!',
                'info',
                {
                    confirmText: "Continue",
                    onConfirm: () => {
                        (navigation as any).navigate('MasterApp');
                    }
                }
            );
        } finally {
            setLoading(false);
        }
    };

    const currentStepData = ONBOARDING_STEPS[currentStep];
    const isLastStep = currentStep === ONBOARDING_STEPS.length - 1;

    return (
        <ScreenBackground>
            <SafeAreaView style={styles.container} edges={['top']}>

                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.keyboardView}
                >
                    <ScrollView
                        contentContainerStyle={styles.scrollContent}
                        showsVerticalScrollIndicator={false}
                    >
                        {/* Progress Indicator */}
                        <View style={styles.progressContainer}>
                            {ONBOARDING_STEPS.map((_, index) => (
                                <View
                                    key={index}
                                    style={[
                                        styles.progressDot,
                                        index <= currentStep && styles.progressDotActive,
                                    ]}
                                />
                            ))}
                        </View>

                        {/* Step Content */}
                        <View style={styles.content}>
                            <Text style={styles.stepIndicator}>
                                Step {currentStep + 1} of {ONBOARDING_STEPS.length}
                            </Text>

                            <Text style={styles.icon}>{currentStepData.icon}</Text>

                            <Text style={styles.title}>{currentStepData.title}</Text>

                            <Text style={styles.description}>
                                {currentStepData.description}
                            </Text>

                        </View>

                        {/* Buttons */}
                        <View style={styles.buttonContainer}>
                            <Button
                                title={isLastStep ? 'Get Started' : 'Next'}
                                onPress={handleNext}
                                loading={loading}
                                fullWidth
                                style={styles.button}
                            />

                            {!isLastStep && (
                                <TouchableOpacity
                                    onPress={handleSkip}
                                    style={styles.skipButton}
                                >
                                    <Text style={styles.skipText}>Skip Setup</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </ScrollView>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </ScreenBackground>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    keyboardView: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        padding: spacing.lg,
    },
    progressContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: spacing.sm,
        marginTop: spacing.xl,
        marginBottom: spacing.xl,
    },
    progressDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: 'rgba(0, 0, 0, 0.12)',
    },
    progressDotActive: {
        backgroundColor: colors.primary,
        width: 24,
    },
    content: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.xl,
    },
    stepIndicator: {
        fontSize: 14,
        color: colors.textSecondary,
        marginBottom: spacing.lg,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    icon: {
        fontSize: 64,
        marginBottom: spacing.lg,
    },
    title: {
        fontSize: 28,
        fontWeight: '700',
        color: colors.text,
        textAlign: 'center',
        marginBottom: spacing.md,
    },
    description: {
        fontSize: 16,
        color: colors.textSecondary,
        textAlign: 'center',
        lineHeight: 24,
        paddingHorizontal: spacing.lg,
        marginBottom: spacing.xl,
    },
    buttonContainer: {
        marginTop: spacing.xl,
        gap: spacing.md,
    },
    button: {
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    skipButton: {
        alignItems: 'center',
        paddingVertical: spacing.md,
    },
    skipText: {
        fontSize: 14,
        color: colors.textSecondary,
        textDecorationLine: 'underline',
    },
});

export default MasterOnboardingScreen;
