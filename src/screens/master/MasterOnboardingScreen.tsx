import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { ScreenBackground, Button, Card } from '../../components/ui';
import { colors, spacing } from '../../theme';

const ONBOARDING_STEPS = [
    {
        id: 'welcome',
        title: 'Welcome to Merakí!',
        description: 'You\'re all set up as a Master. Let\'s get you ready to start accepting bookings.',
        icon: '✨',
    },
    {
        id: 'profile',
        title: 'Complete Your Profile',
        description: 'Add your bio, experience, and a profile photo to help clients find you.',
        icon: '👤',
    },
    {
        id: 'services',
        title: 'Add Your Services',
        description: 'Create the services you offer with your own pricing and duration.',
        icon: '💅',
    },
    {
        id: 'supplies',
        title: 'Track Your Supplies',
        description: 'Set up your inventory to automatically track supply usage with each appointment.',
        icon: '📦',
    },
    {
        id: 'availability',
        title: 'Set Your Availability',
        description: 'Choose when you\'re available for bookings and block off time as needed.',
        icon: '📅',
    },
];

export function MasterOnboardingScreen() {
    const navigation = useNavigation();
    const { user, refreshProfile } = useAuth();
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

            // Show success message then navigate
            Alert.alert(
                skipped ? 'Setup Skipped' : 'All Set!',
                skipped 
                    ? 'You can complete your setup anytime from your profile settings.'
                    : 'You\'re ready to start accepting bookings!',
                [
                    { 
                        text: "Let's Go!", 
                        onPress: () => {
                            // Navigate to MasterApp - the AppNavigator will handle the routing
                            (navigation as any).navigate('MasterApp');
                        }
                    }
                ]
            );
        } catch (error: any) {
            console.error('Error completing onboarding:', error);
            Alert.alert('Error', 'Failed to save your preferences. Please try again.');
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

                            {/* Action Cards */}
                            <View style={styles.actionCards}>
                                {currentStepData.id === 'profile' && (
                                    <TouchableOpacity
                                        style={styles.actionCard}
                                        onPress={() => {
                                            handleComplete();
                                        }}
                                    >
                                        <Text style={styles.actionCardIcon}>✏️</Text>
                                        <Text style={styles.actionCardText}>Edit Profile Now</Text>
                                        <Text style={styles.actionCardArrow}>→</Text>
                                    </TouchableOpacity>
                                )}

                                {currentStepData.id === 'services' && (
                                    <TouchableOpacity
                                        style={styles.actionCard}
                                        onPress={() => {
                                            handleComplete();
                                        }}
                                    >
                                        <Text style={styles.actionCardIcon}>➕</Text>
                                        <Text style={styles.actionCardText}>Add Services Now</Text>
                                        <Text style={styles.actionCardArrow}>→</Text>
                                    </TouchableOpacity>
                                )}

                                {currentStepData.id === 'supplies' && (
                                    <TouchableOpacity
                                        style={styles.actionCard}
                                        onPress={() => {
                                            handleComplete();
                                        }}
                                    >
                                        <Text style={styles.actionCardIcon}>📦</Text>
                                        <Text style={styles.actionCardText}>Set Up Supplies Now</Text>
                                        <Text style={styles.actionCardArrow}>→</Text>
                                    </TouchableOpacity>
                                )}

                                {currentStepData.id === 'availability' && (
                                    <TouchableOpacity
                                        style={styles.actionCard}
                                        onPress={() => {
                                            handleComplete();
                                        }}
                                    >
                                        <Text style={styles.actionCardIcon}>🕐</Text>
                                        <Text style={styles.actionCardText}>Set Availability Now</Text>
                                        <Text style={styles.actionCardArrow}>→</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
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
        backgroundColor: 'rgba(255,255,255,0.2)',
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
    actionCards: {
        width: '100%',
        gap: spacing.md,
    },
    actionCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 12,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: colors.border,
    },
    actionCardIcon: {
        fontSize: 20,
        marginRight: spacing.md,
    },
    actionCardText: {
        flex: 1,
        fontSize: 16,
        color: colors.text,
        fontWeight: '500',
    },
    actionCardArrow: {
        fontSize: 20,
        color: colors.primary,
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
