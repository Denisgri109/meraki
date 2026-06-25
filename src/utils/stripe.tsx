/**
 * Stripe Wrapper - Provides Stripe components or mocks when running in Expo Go
 * 
 * This module handles the case where Stripe native module isn't available
 * (e.g., when running in Expo Go instead of a development build)
 */
import { MockCardField, createMockHook } from './stripeMocks';
import Constants from 'expo-constants';

// Check if we're in Expo Go by trying to access the native module
let stripeAvailable = false;
let StripeComponents: any = {};

// We cannot use @stripe/stripe-react-native native code inside Expo Go
const isExpoGo = Constants.appOwnership === 'expo';

if (!isExpoGo) {
    try {
        // This will throw if native module isn't registered
        StripeComponents = require('@stripe/stripe-react-native');
        stripeAvailable = true;
    } catch (error) {
        console.warn('[Stripe] Native module not available. Running in Expo Go mode.');
    }
} else {
    console.warn('[Stripe] Running in Expo Go. Forcing simulation/mock mode.');
}

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
