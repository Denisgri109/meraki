# Environment Variables Setup Guide

## Required Environment Variables for Edge Functions

### Email Functions (send-master-approval-email, send-master-rejection-email, send-confirmation-request)

| Variable | Description | Where to Get |
|----------|-------------|--------------|
| `RESEND_API_KEY` | API key for Resend email service | https://resend.com/dashboard/api-keys |
| `PROJECT_URL` | Your Supabase project URL | https://supabase.com/dashboard → Project Settings → API |

### Payment & Admin Functions (handle-no-show-enhanced)

| Variable | Description | Where to Get |
|----------|-------------|--------------|
| `STRIPE_SECRET_KEY` | Stripe secret key for payment processing | https://dashboard.stripe.com/apikeys |
| `PROJECT_URL` | Your Supabase project URL | https://supabase.com/dashboard → Project Settings → API |
| `SERVICE_ROLE_KEY` | Supabase service role key (admin access) | https://supabase.com/dashboard → Project Settings → API → service_role key |

## How to Set Environment Variables in Supabase

### Method 1: Supabase Dashboard (Recommended)

1. Go to https://supabase.com/dashboard
2. Select your project (Project ID: bkxdsxnxrtcqnkdcdist)
3. Navigate to **Edge Functions** in the left sidebar
4. Click on **Environment Variables**
5. Click **New Variable**
6. Add each variable:
   - Name: `RESEND_API_KEY`
   - Value: `re_xxxxxxxxxxxxxxxxxxxxxxxxx` (your actual key)
   - Click **Save**
7. Repeat for all required variables

### Method 2: Supabase CLI

```bash
# Set individual variables
supabase secrets set RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxx
supabase secrets set PROJECT_URL=https://bkxdsxnxrtcqnkdcdist.supabase.co
supabase secrets set STRIPE_SECRET_KEY=sk_live_xxxxxxxxxxxxx
supabase secrets set SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Current Project Configuration

**Project ID:** bkxdsxnxrtcqnkdcdist
**Project URL:** https://bkxdsxnxrtcqnkdcdist.supabase.co
**Region:** eu-central-1

## Email Configuration (SMTP)

Already configured in Supabase Auth:
- **SMTP Host:** smtp.resend.com
- **SMTP Port:** 587
- **SMTP User:** resend
- **SMTP Password:** Your Resend API key
- **Sender Email:** admin@meraki-app.com

## Testing Checklist

After setting environment variables:

- [ ] Test master application approval email
- [ ] Test master application rejection email  
- [ ] Test confirmation request email
- [ ] Test no-show payment processing

## Edge Functions Status

| Function | Status | Environment Variables Required |
|----------|--------|-------------------------------|
| send-master-approval-email | ✅ Deployed | RESEND_API_KEY, PROJECT_URL |
| send-master-rejection-email | ✅ Deployed | RESEND_API_KEY, PROJECT_URL |
| send-confirmation-request | ✅ Deployed | RESEND_API_KEY, PROJECT_URL |
| handle-no-show-enhanced | ✅ Deployed | STRIPE_SECRET_KEY, PROJECT_URL, SERVICE_ROLE_KEY |

## Troubleshooting

### Email Not Sending
1. Check if RESEND_API_KEY is set correctly
2. Verify email domain is verified in Resend dashboard
3. Check Edge Function logs in Supabase dashboard

### No-Show Function Not Working
1. Verify STRIPE_SECRET_KEY is correct
2. Check if SERVICE_ROLE_KEY has proper permissions
3. Ensure appointment has payment_intent_id stored

### Storage Upload Issues
1. Check if `master-portfolios` bucket exists
2. Verify RLS policies allow uploads
3. Check file size limits (10MB per file, 10 images max)

## Security Notes

⚠️ **IMPORTANT:**
- Never commit environment variables to git
- Use service_role_key only in secure server-side functions
- Keep API keys secret and rotate regularly
- Monitor Edge Function logs for security issues
