/**
 * Stripe Wrapper - Provides Stripe components or mocks when running in Expo Go
 * 
 * This module handles the case where Stripe native module isn't available
 * (e.g., when running in Expo Go instead of a development build)
 */
import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TouchableOpacity } from 'react-native';
import { colors } from '../theme';

// Check if we're in Expo Go by trying to access the native module
let stripeAvailable = false;
let StripeComponents: any = {};

try {
    // This will throw if native module isn't registered
    StripeComponents = require('@stripe/stripe-react-native');
    stripeAvailable = true;
} catch (error) {
    console.warn('[Stripe] Native module not available. Running in Expo Go mode.');
}

interface MockCardFieldProps {
    style?: ViewStyle;
    onCardChange?: (details: { complete: boolean }) => void;
    postalCodeEnabled?: boolean;
    placeholders?: any;
    cardStyle?: any;
}

// Mock CardField component for Expo Go
const MockCardField: React.FC<MockCardFieldProps> = ({ style, onCardChange, cardStyle }) => {
    const [isSimulated, setIsSimulated] = React.useState(false);

    const handleSimulate = () => {
        setIsSimulated(true);
        // Simulate a complete valid card state
        onCardChange?.({ complete: true } as any);
    };

    return (
        <View style={style}>
            <View style={[styles.mockCard, isSimulated && styles.mockCardSuccess]}>
                <Text style={styles.mockText}>
                    {isSimulated ? '✅ Payment Method Validated' : '💳 Simulation Mode'}
                </Text>
                {!isSimulated && (
                    <TouchableOpacity
                        style={styles.simulateButton}
                        onPress={handleSimulate}
                    >
                        <Text style={styles.simulateButtonText}>Use Test Card</Text>
                    </TouchableOpacity>
                )}
                <Text style={styles.mockSubtext}>
                    {isSimulated
                        ? 'Ready to complete purchase'
                        : 'Running in Expo Go. Real payments disabled.'}
                </Text>
            </View>
        </View>
    );
};

// Mock hooks that return simulated success
const createMockHook = (hookName: string) => () => {
    // console.log(`[Stripe Mock] Using ${hookName}`);
    return {
        confirmPayment: async () => {
            // Wait a bit to simulate network request
            await new Promise(resolve => setTimeout(resolve, 1500));
            return {
                paymentIntent: {
                    status: 'Succeeded',
                    id: 'pi_mock_' + Math.random().toString(36).substr(2, 9)
                },
                error: null
            };
        },
        confirmSetupIntent: async () => {
            await new Promise(resolve => setTimeout(resolve, 1000));
            return {
                setupIntent: {
                    status: 'Succeeded',
                    id: 'seti_mock_' + Math.random().toString(36).substr(2, 9)
                },
                error: null
            };
        },
        initPaymentSheet: async () => ({ error: null }),
        presentPaymentSheet: async () => {
            await new Promise(resolve => setTimeout(resolve, 1000));
            return { error: null };
        },
        loading: false,
    };
};

// Export either real Stripe components or mocks
export const CardField = stripeAvailable
    ? StripeComponents.CardField
    : MockCardField;

export const useConfirmPayment = stripeAvailable
    ? StripeComponents.useConfirmPayment
    : createMockHook('useConfirmPayment');

export const useConfirmSetupIntent = stripeAvailable
    ? StripeComponents.useConfirmSetupIntent
    : createMockHook('useConfirmSetupIntent');

export const useStripe = stripeAvailable
    ? StripeComponents.useStripe
    : createMockHook('useStripe');

export const isStripeAvailable = () => stripeAvailable;

const styles = StyleSheet.create({
    mockCard: {
        backgroundColor: colors.surface,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: colors.border,
        padding: 16,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 50,
    },
    mockCardSuccess: {
        borderColor: '#10B981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
    },
    mockText: {
        color: colors.textSecondary,
        fontSize: 14,
        textAlign: 'center',
        fontWeight: '600',
    },
    mockSubtext: {
        color: colors.textMuted,
        fontSize: 12,
        textAlign: 'center',
        marginTop: 4,
    },
    simulateButton: {
        backgroundColor: colors.primary,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 6,
        marginTop: 8,
        marginBottom: 4,
    },
    simulateButtonText: {
        color: '#FFF',
        fontSize: 12,
        fontWeight: '600',
    }
});
