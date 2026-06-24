import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TouchableOpacity } from 'react-native';
import { colors } from '../theme';
import { v4 as uuidv4 } from 'uuid';

export interface MockCardFieldProps {
    style?: ViewStyle;
    onCardChange?: (details: { complete: boolean }) => void;
    postalCodeEnabled?: boolean;
    placeholders?: any;
    cardStyle?: any;
}

// Mock CardField component for Expo Go
export const MockCardField: React.FC<MockCardFieldProps> = ({ style, onCardChange, cardStyle }) => {
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
export const createMockHook = (hookName: string) => () => {
    return {
        confirmPayment: async () => {
            // Wait a bit to simulate network request
            await new Promise(resolve => setTimeout(resolve, 1500));
            return {
                paymentIntent: {
                    status: 'Succeeded',
                    id: 'pi_mock_' + uuidv4()
                },
                error: null
            };
        },
        confirmSetupIntent: async () => {
            await new Promise(resolve => setTimeout(resolve, 1000));
            return {
                setupIntent: {
                    status: 'Succeeded',
                    id: 'seti_mock_' + uuidv4()
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
