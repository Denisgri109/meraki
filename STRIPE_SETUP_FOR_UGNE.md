# Stripe — What I Need From You

## What is Stripe and why do I need it?

Stripe is the company that handles all the money stuff in your app. Whenever a client pays for a booking, buys a product from your shop, or gets charged a cancellation/no-show fee — Stripe is what makes that happen behind the scenes. Think of it like a digital cash register that connects to your bank account. Without it, the app can't accept any real payments. You need your own Stripe account so that all the money your clients pay goes **straight into your bank account** — I don't have access to any of it, it's 100% yours.

---

## What I need you to do

I need **two things** from you. That's it — just these two things and I'll handle everything else.

### 1. Create a Stripe account

Go to this link and sign up: **[https://dashboard.stripe.com/register](https://dashboard.stripe.com/register)**

It's free to create. Stripe only takes a small fee per transaction (around 1.4% + €0.25 per card payment in Europe) — there's no monthly fee.

When you sign up, Stripe will ask you for some basic info:
- Your **name** and **email**
- Your **address**
- Your **date of birth** (for identity verification — this is normal, every payment provider requires it)
- Your **bank details** (IBAN) — this is where your money will be sent
- A short **description of your business** — just write something like *"Beauty salon — lash extensions and brow treatments"*
- **Business type** — select "Individual" or "Sole trader" (unless you have a registered company, then pick that)

The whole thing takes about 5–10 minutes. Stripe might take a day or two to verify your identity after that, but you can already give me the keys before verification is done.

### 2. Send me two keys

Once you've created your account and you're logged in:

1. Look at the **bottom-left corner** of the Stripe page — make sure it does **NOT** say "Test mode" in orange. If it does, click the toggle to switch it off. You want to be in **Live mode** (no orange badge).
2. On the left side, click **"Developers"**
3. Then click **"API keys"**
4. You'll see two long codes — I need **both** of them:

**Key 1 — Publishable Key**
> Starts with `pk_live_` followed by a bunch of random letters and numbers

**Key 2 — Secret Key**
> Starts with `sk_live_` followed by a bunch of random letters and numbers
> (You might need to click "Reveal live key" to see it)

**Send me both of these keys in a private message.** Don't post them anywhere public. Once I have them, I'll plug them into the app and everything will work — clients can pay, money goes to your bank.

---

## That's it!

Once I set up the keys, you won't need to touch anything technical again. If you ever want to:
- **See your payments** — log into [dashboard.stripe.com/payments](https://dashboard.stripe.com/payments)
- **Check when money is coming to your bank** — go to [dashboard.stripe.com/balance/overview](https://dashboard.stripe.com/balance/overview)
- **Refund someone** — find their payment on the dashboard and click "Refund"
- **Change your bank account** — go to Settings → Business settings → Bank accounts

And if other masters join your app and need to receive their own payouts, they'll be able to set that up themselves inside the app — you don't need to do anything extra for that.

---

## Quick checklist

- [ ] Sign up at [stripe.com](https://dashboard.stripe.com/register)
- [ ] Fill in your info (name, address, bank details)
- [ ] Make sure you're in **Live mode** (not test mode)
- [ ] Send me the **Publishable Key** (`pk_live_...`)
- [ ] Send me the **Secret Key** (`sk_live_...`)

Once I have those two keys, I'll set everything up and let you know when it's ready to go.
