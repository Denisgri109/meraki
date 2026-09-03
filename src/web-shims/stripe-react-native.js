/**
 * Web shim for @stripe/stripe-react-native.
 *
 * The package is native-only — it imports react-native's codegen helpers, which Metro
 * refuses to bundle for web. `npm run web` therefore failed to build at all. This shim keeps
 * the web target compiling for UI work and screenshots; taking a real payment still requires
 * a device build, and every call here reports that rather than pretending to succeed.
 */
const React = require('react');

const unavailable = async () => ({
  error: { code: 'Failed', message: 'Card payments are only available in the iOS and Android app.' },
});

const Passthrough = ({ children }) => React.createElement(React.Fragment, null, children);
const NullField = () => null;

module.exports = {
  StripeProvider: Passthrough,
  CardField: NullField,
  CardForm: NullField,
  PlatformPayButton: NullField,
  useStripe: () => ({
    confirmPayment: unavailable,
    confirmSetupIntent: unavailable,
    initPaymentSheet: unavailable,
    presentPaymentSheet: unavailable,
    createPaymentMethod: unavailable,
    handleNextAction: unavailable,
  }),
  useConfirmPayment: () => ({ confirmPayment: unavailable, loading: false }),
  useConfirmSetupIntent: () => ({ confirmSetupIntent: unavailable, loading: false }),
  usePaymentSheet: () => ({ initPaymentSheet: unavailable, presentPaymentSheet: unavailable, loading: false }),
  initStripe: unavailable,
  isPlatformPaySupported: async () => false,
  confirmPlatformPayPayment: unavailable,
};
