# API Keys Storage Guide

## Where to Put Your API Keys

### 1. For Local Development: `.env` File

**Location:** `C:\Users\denis\Desktop\meraki_app\.env`

**What goes here:**
- Supabase URL and Anon Key (public keys)
- Stripe Publishable Key (public key)
- Any other PUBLIC keys that the app needs

**How to use:**
1. Copy `.env.example` to `.env`
2. Fill in your real values
3. Restart the app (`npx expo start -c`)
4. Access in code: `process.env.EXPO_PUBLIC_SUPABASE_URL`

**⚠️ IMPORTANT:** 
- Never commit `.env` to git
- Add `.env` to your `.gitignore` file
- These are PUBLIC keys only (safe for client-side)

---

### 2. For Edge Functions: Supabase Secrets

**Location:** Supabase Dashboard → Edge Functions → Secrets

**What goes here:**
- Resend API Key (private)
- Supabase Service Role Key (private)
- Stripe Secret Key (private)
- Any PRIVATE keys that should never be exposed to users

**How to set:**
1. Go to: https://supabase.com/dashboard/project/bkxdsxnxrtcqnkdcdist/edge-functions/secrets
2. Click "Add Secret"
3. Add each key one by one:

```
RESEND_API_KEY=re_xxxxxx
SERVICE_ROLE_KEY=eyJxxxxxx
PROJECT_URL=https://bkxdsxnxrtcqnkdcdist.supabase.co
STRIPE_SECRET_KEY=sk_test_xxxxx
```

**⚠️ IMPORTANT:**
- These are PRIVATE and server-side only
- Never put these in your .env or code
- These are for edge functions only

---

### 3. For Production: Environment Variables

**When you deploy to production:**

**Option A: EAS Build (Expo)**
1. Run: `eas secret:create`
2. Or use EAS Dashboard: https://expo.dev
3. Set secrets for production builds

**Option B: Supabase (Edge Functions)**
- Same as #2 above - already set!

---

## Current Setup Status

### ✅ Already Configured:
- Supabase Secrets for edge functions
- Storage buckets created
- Database migrations applied

### ⏳ You Need To Set:
1. **Local `.env` file** - for local development
2. **Verify Supabase Secrets** - make sure they match

---

## Quick Checklist

### For Local Development (`.env`):
- [ ] `EXPO_PUBLIC_SUPABASE_URL=https://bkxdsxnxrtcqnkdcdist.supabase.co`
- [ ] `EXPO_PUBLIC_SUPABASE_ANON_KEY=` (get from Supabase Dashboard → API)
- [ ] `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=` (get from Stripe Dashboard)

### For Edge Functions (Supabase Secrets):
- [ ] `RESEND_API_KEY=` (from Resend dashboard)
- [ ] `SERVICE_ROLE_KEY=` (from Supabase Dashboard → API → service_role)
- [ ] `PROJECT_URL=https://bkxdsxnxrtcqnkdcdist.supabase.co`

---

## How to Get Each Key

### Supabase Anon Key:
1. https://supabase.com/dashboard/project/bkxdsxnxrtcqnkdcdist/settings/api
2. Copy "anon public" key

### Supabase Service Role Key:
1. https://supabase.com/dashboard/project/bkxdsxnxrtcqnkdcdist/settings/api
2. Copy "service_role secret" key (keep this secret!)

### Resend API Key:
1. https://resend.com
2. API Keys section
3. Copy your key (starts with `re_`)

### Stripe Keys:
1. https://dashboard.stripe.com
2. Developers → API Keys
3. Publishable key (pk_test_...) for .env
4. Secret key (sk_test_...) for Supabase Secrets

---

## Example .env File

```env
# Supabase
EXPO_PUBLIC_SUPABASE_URL=https://bkxdsxnxrtcqnkdcdist.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Stripe
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_51ABC...
```

## Example Supabase Secrets

Go to: https://supabase.com/dashboard/project/bkxdsxnxrtcqnkdcdist/edge-functions/secrets

Add these 4 secrets:
```
RESEND_API_KEY=re_xxxxxxxx
SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
PROJECT_URL=https://bkxdsxnxrtcqnkdcdist.supabase.co
STRIPE_SECRET_KEY=sk_test_xxxxxxxx
```

---

## Security Best Practices

1. **Never commit keys to git**
   - Add `.env` to `.gitignore`
   - Add `.env.local` to `.gitignore`
   - Add `.env.production` to `.gitignore`

2. **Separate public vs private keys**
   - Public keys → `.env` file (client-side)
   - Private keys → Supabase Secrets (server-side only)

3. **Rotate keys regularly**
   - Change keys every 3-6 months
   - Immediately if you think they're compromised

4. **Use different keys for dev vs production**
   - Don't use production keys for local development

---

## What You Should Do Right Now

1. Create `.env` file in your project root
2. Add your Supabase Anon Key
3. Add your Stripe Publishable Key
4. Verify Supabase Secrets are set correctly
5. Test the app!

**Ready to fill in your keys?** 🚀
