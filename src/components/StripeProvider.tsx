import React, { ReactElement } from 'react';

const STRIPE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';

// Try to import Stripe, but gracefully handle if native module isn't available (e.g., in Expo Go)
let NativeStripeProvider: React.ComponentType<any> | null = null;
let stripeAvailable = false;

try {
    const stripeModule = require('@stripe/stripe-react-native');
    NativeStripeProvider = stripeModule.StripeProvider;
    stripeAvailable = true;
} catch (error) {
    console.warn('Stripe native module not available. Running without Stripe support (Expo Go mode).');
}

interface StripeProviderProps {
    children: ReactElement | ReactElement[];
}

export function StripeProvider({ children }: StripeProviderProps) {
    // If Stripe native module isn't available, just render children
    if (!stripeAvailable || !NativeStripeProvider) {
        console.warn('Stripe is not available in Expo Go. Payment features will not work. Build a development client to enable payments.');
        return <>{children}</>;
    }

    if (!STRIPE_PUBLISHABLE_KEY) {
        console.warn('Stripe publishable key is not set. Payment features will not work.');
        return <>{children}</>;
    }

    return (
        <NativeStripeProvider
            publishableKey={STRIPE_PUBLISHABLE_KEY}
            merchantIdentifier="merchant.com.meraki.app"
            urlScheme="meraki"
        >
            {children}
        </NativeStripeProvider>
    );
}

export default StripeProvider;
