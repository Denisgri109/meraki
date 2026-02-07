# 💳 Stripe Setup Guide for Merakí App

This guide walks you through setting up Stripe for **TEST MODE** payments in the Merakí app. All configurations are production-ready—when you're ready to go live, simply swap to live API keys.

---

## 📋 Quick Overview

| Component | Where to Configure | Key Type |
|-----------|-------------------|----------|
| **Frontend** (React Native) | `.env` file | Publishable Key (`pk_test_...`) |
| **Backend** (Edge Functions) | Supabase Dashboard → Secrets | Secret Key (`sk_test_...`) |

---

## 🚀 Step 1: Create a Stripe Account (Sandbox Mode)

1. **Go to Stripe Dashboard**: https://dashboard.stripe.com
2. **Create account** or log in
3. **Toggle to Test Mode** (toggle switch in bottom-left of dashboard)
   
   ![Test Mode Toggle](https://i.imgur.com/example.png)
   
   > [!TIP]
   > The toggle shows **"Test mode"** with an orange badge when active. All test transactions use fake money!

---

## 🔑 Step 2: Get Your API Keys

### Navigate to API Keys
1. In Stripe Dashboard → **Developers** (left sidebar)
2. Click **API keys**
3. You'll see two key types:

### Publishable Key (Frontend)
```
pk_test_51ABC123... (starts with pk_test_)
```
- ✅ Safe to expose in frontend code
- Used by React Native to initialize Stripe

### Secret Key (Backend)
```
sk_test_51ABC123... (starts with sk_test_)
```
- ⚠️ **NEVER expose this in frontend code**
- Used only in Supabase Edge Functions

> [!CAUTION]
> Never commit your secret key to git or share it publicly!

---

## ⚙️ Step 3: Configure the Frontend

### 3.1 Update `.env` File

Open your project's `.env` file and add your Publishable Key:

```env
# Stripe Configuration (for payments)
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_ACTUAL_TEST_KEY_HERE
```

### 3.2 Verify Configuration

Your `StripeProvider.tsx` already reads this:
```typescript
const STRIPE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';
```

---

## 🔒 Step 4: Configure Supabase Edge Functions

### 4.1 Add Secret Key to Supabase

1. Go to **Supabase Dashboard**: https://supabase.com/dashboard
2. Select your **Merakí** project
3. Navigate to: **Project Settings** → **Edge Functions** → **Secrets**
4. Click **+ Add new secret**
5. Add the following:

| Name | Value |
|------|-------|
| `STRIPE_SECRET_KEY` | `sk_test_YOUR_SECRET_KEY_HERE` |

### 4.2 Deploy Edge Functions

Your Edge Functions are already created. To deploy them, run:

```bash
# Deploy all payment-related functions
npx supabase functions deploy setup-intent --project-ref bkxdsxnxrtcqnkdcdist
npx supabase functions deploy create-payment-intent --project-ref bkxdsxnxrtcqnkdcdist
npx supabase functions deploy capture-payment --project-ref bkxdsxnxrtcqnkdcdist
npx supabase functions deploy cancel-payment --project-ref bkxdsxnxrtcqnkdcdist
npx supabase functions deploy list-payment-methods --project-ref bkxdsxnxrtcqnkdcdist
npx supabase functions deploy delete-payment-method --project-ref bkxdsxnxrtcqnkdcdist
npx supabase functions deploy process-refund --project-ref bkxdsxnxrtcqnkdcdist
npx supabase functions deploy handle-no-show --project-ref bkxdsxnxrtcqnkdcdist
npx supabase functions deploy process-no-show-charge --project-ref bkxdsxnxrtcqnkdcdist
```

---

## 🧪 Step 5: Testing Payments

### Test Card Numbers

| Card Type | Number | CVV | Expiry |
|-----------|--------|-----|--------|
| ✅ **Success** | `4242 4242 4242 4242` | Any 3 digits | Any future date |
| ❌ **Declined** | `4000 0000 0000 0002` | Any 3 digits | Any future date |
| 🔐 **3D Secure** | `4000 0027 6000 3184` | Any 3 digits | Any future date |
| 💳 **Insufficient Funds** | `4000 0000 0000 9995` | Any 3 digits | Any future date |

> [!IMPORTANT]
> These test cards only work in **Test Mode**. No real money is charged!

### Testing in Expo Go (Simulation Mode)

When running in Expo Go, Stripe native modules aren't available. The app automatically uses **Simulation Mode**:

- Mock payment methods are shown
- Clicking "Use Test Card" simulates a successful payment
- All payment flows work without actual Stripe integration

### Testing in Development Build

For full Stripe integration:
1. Build a development client: `npx expo run:android` or `npx expo run:ios`
2. Real Stripe UI elements will appear
3. Use test card numbers above

---

## ✅ Step 6: Verify Everything Works

### 6.1 Check Stripe Dashboard

After making test payments:
1. Go to https://dashboard.stripe.com/test/payments
2. You should see your test transactions listed
3. Click any transaction to see details

### 6.2 Check Supabase Edge Function Logs

1. Go to Supabase Dashboard → **Edge Functions**
2. Select a function (e.g., `create-payment-intent`)
3. View **Logs** tab to debug issues

---

## 🔄 Switching to Production

When ready for real payments:

### 1. Toggle OFF Test Mode
In Stripe Dashboard, switch from "Test mode" to live mode

### 2. Get Live Keys
Copy your **live** API keys (they start with `pk_live_` and `sk_live_`)

### 3. Update Configuration

**Frontend (.env):**
```env
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_YOUR_LIVE_PUBLISHABLE_KEY
```

**Supabase Secrets:**
| Name | Value |
|------|-------|
| `STRIPE_SECRET_KEY` | `sk_live_YOUR_LIVE_SECRET_KEY` |

### 4. Complete Stripe Account Setup
Before accepting real payments, you must:
- ✅ Complete identity verification
- ✅ Add bank account for payouts
- ✅ Set up business information

---

## 📂 Your Existing Stripe Integration

Your app already has these components set up:

### Frontend Components
| File | Purpose |
|------|---------|
| `src/components/StripeProvider.tsx` | Wraps app with Stripe context |
| `src/utils/stripe.tsx` | Stripe hooks with Expo Go fallback |
| `src/services/stripeService.ts` | Payment API service layer |
| `src/screens/client/PaymentMethodsScreen.tsx` | Manage saved cards |
| `src/screens/client/PaymentHistoryScreen.tsx` | View payment history |

### Edge Functions (Backend)
| Function | Purpose |
|----------|---------|
| `setup-intent` | Save payment methods |
| `create-payment-intent` | Create charges/holds |
| `capture-payment` | Capture pre-authorized holds |
| `cancel-payment` | Cancel payment intents |
| `list-payment-methods` | List saved cards |
| `delete-payment-method` | Remove saved cards |
| `process-refund` | Issue refunds |
| `handle-no-show` | Charge for no-shows |

---

## ⚠️ Common Issues & Troubleshooting

### Issue: "Stripe publishable key is not set"
**Solution:** Ensure your `.env` file has the correct key and restart Metro bundler:
```bash
npx expo start -c
```

### Issue: Edge function returns 500 error
**Solution:** Check if `STRIPE_SECRET_KEY` is set in Supabase secrets

### Issue: Payment succeeds in test but fails in production
**Solution:** 
- Ensure your live secret key is set
- Verify Stripe account is fully activated
- Check customer's card has sufficient funds

### Issue: "Missing required fields" error
**Solution:** Ensure amount is in **cents** (€10.00 = 1000 cents)

---

## 🔗 Useful Links

- [Stripe Dashboard](https://dashboard.stripe.com)
- [Stripe Test Cards](https://docs.stripe.com/testing)
- [Stripe React Native Docs](https://docs.stripe.com/stripe-react-native)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)

---

## 📝 Quick Checklist

- [ ] Created Stripe account
- [ ] Toggled to **Test Mode**
- [ ] Copied Publishable Key to `.env` file
- [ ] Added Secret Key to Supabase Edge Function Secrets
- [ ] Deployed Edge Functions
- [ ] Made a test payment with `4242 4242 4242 4242`
- [ ] Verified payment appears in Stripe Dashboard

---

**Happy Testing! 🎉**

When you're ready to go live, just swap the test keys for live keys and complete your Stripe account setup.
