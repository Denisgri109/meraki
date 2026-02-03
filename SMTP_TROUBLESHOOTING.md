# SMTP Email Troubleshooting Guide

## Problem: "Error sending confirmation email"

If you're seeing this error when clicking Continue on Step 1, here are the most common causes and fixes:

---

## 🔍 Quick Diagnosis Steps

### Step 1: Check Console Logs
After adding the updated code, try again and check your Metro bundler logs. You should see detailed error messages like:
- `"Auth error details: [object]"`
- `"Sign up failed: [error message]"`

**Look for these specific error messages:**

---

## ⚠️ Common Issues & Fixes

### Issue 1: SMTP Settings Not Saved Properly

**Symptoms:**
- Error mentions "SMTP" or "email provider"
- "Failed to send email"

**Fix:**
1. Go to: https://supabase.com/dashboard/project/bkxdsxnxrtcqnkdcdist/auth/providers
2. Click **Email** provider
3. Make sure you see a **green toggle** next to "Enable Custom SMTP"
4. Click **"Save changes"** button
5. Wait 2-3 minutes for settings to propagate

**Important:** Even if it shows "Success", wait 2-3 minutes before testing!

---

### Issue 2: Wrong Resend API Key Format

**Symptoms:**
- Error mentions "authentication" or "credentials"
- "Invalid API key"

**Fix:**
1. Go to Resend Dashboard: https://resend.com/api-keys
2. Make sure you're using the **full API key** (starts with `re_`)
3. The key should look like: `re_7GYiq3xi_nrL4xDB6PHSVFJA53BBuYe2H`
4. In Supabase, the **Password** field should be your full Resend API key
5. The **Username** should be exactly: `resend` (lowercase)

**Common mistake:** Using partial key or wrong key type

---

### Issue 3: Domain Not Verified in Resend

**Symptoms:**
- Emails not being received
- No error in app, but email never arrives
- Error in Supabase logs about "domain"

**Fix:**
1. Go to Resend Dashboard: https://resend.com/domains
2. Check if your domain status is **"Verified"** (green checkmark)
3. If not verified:
   - Click on your domain
   - Add the DNS records shown (DKIM, SPF) to your domain provider
   - Wait for verification (can take up to 24 hours)

**For testing:** You can use Resend's test domain `yourname@xxxxx.resend.app` without verification

---

### Issue 4: Email Templates Not Configured

**Symptoms:**
- "Template not found" error
- Empty or broken email content

**Fix:**
1. Go to: https://supabase.com/dashboard/project/bkxdsxnxrtcqnkdcdist/auth/templates
2. Check **"Confirm Signup"** template exists
3. If empty, reset to default or add basic template:

```html
<h2>Confirm Your Email</h2>
<p>Hi {{ .Email }},</p>
<p>Your verification code is: <strong>{{ .Token }}</strong></p>
<p>This code will expire in 1 hour.</p>
<br>
<p>Best regards,<br>Merakí Team</p>
```

---

### Issue 5: Rate Limiting

**Symptoms:**
- "Rate limit exceeded"
- "Too many requests"
- Works once, then fails on second try

**Fix:**
- Wait 10-15 minutes between attempts
- Supabase has built-in rate limiting (60 seconds between emails to same user)
- Resend free tier: 3,000 emails/day

**Tip:** Use a different email address for testing

---

### Issue 6: Wrong Port or Security Settings

**Symptoms:**
- "Connection refused"
- "SSL/TLS error"
- Timeout errors

**Fix:**
Try these combinations:

**Option A (Recommended):**
- Port: `587`
- Security: `STARTTLS` or `Auto`

**Option B:**
- Port: `465`
- Security: `SSL/TLS`

**In Supabase:**
1. Go to Auth → Providers → Email
2. Try Port 587 first
3. If that fails, try Port 465
4. Save and wait 2-3 minutes

---

### Issue 7: Email Provider Rate Limits

**Symptoms:**
- "Daily quota exceeded"
- "Monthly limit reached"

**Fix:**
1. Check Resend Dashboard: https://resend.com/settings/usage
2. Free tier: 3,000 emails/day
3. If exceeded, upgrade plan or wait for reset

---

## 🧪 Testing Steps

### Test 1: Send Test Email from Supabase
1. Go to: https://supabase.com/dashboard/project/bkxdsxnxrtcqnkdcdist/auth/templates
2. Click any template (e.g., "Confirm Signup")
3. Click **"Send test email"**
4. Enter your email
5. Check if you receive it within 1-2 minutes

**If this works:** Your SMTP is configured correctly! The issue is with the app.

**If this fails:** Your SMTP settings are wrong. Check Issue 1-6 above.

---

### Test 2: Check Supabase Logs
1. Go to: https://supabase.com/dashboard/project/bkxdsxnxrtcqnkdcdist/logs
2. Filter by: **"auth"** or **"smtp"**
3. Look for error messages
4. Share the error with me

---

### Test 3: Use Default Supabase Email (Temporary)
To test if it's SMTP-specific:
1. Go to Auth → Providers → Email
2. Toggle OFF "Enable Custom SMTP"
3. Save
4. Test the app
5. If it works, your SMTP settings are the issue

---

## ✅ Correct SMTP Settings for Resend

```
Host: smtp.resend.com
Port: 587 (or 465)
Username: resend
Password: re_YOUR_FULL_API_KEY_HERE
Sender Name: Merakí
Sender Email: meraki@yourdomain.resend.app (or your verified domain)
```

**Where to find your API key:**
- Resend Dashboard → API Keys
- Should look like: `re_7GYiq3xi_nrL4xDB6PHSVFJA53BBuYe2H`

---

## 🆘 Still Not Working?

### Send me these details:

1. **Exact error message from console logs** (copy/paste)
2. **Screenshot of your SMTP settings** (hide the password!)
3. **Did test email from Supabase work?** (Yes/No)
4. **What port are you using?** (587 or 465)
5. **Is your domain verified in Resend?** (Yes/No)

### Quick Workaround for Testing

If SMTP keeps failing, you can temporarily disable email confirmation:

1. Go to: https://supabase.com/dashboard/project/bkxdsxnxrtcqnkdcdist/auth/providers
2. Click **Email**
3. Toggle OFF **"Confirm email"**
4. Save

**Warning:** This allows anyone to sign up without verifying email. Only for testing!

---

## 📞 Need More Help?

### Resend Support:
- https://resend.com/support
- Discord: https://resend.com/discord

### Supabase Support:
- https://supabase.com/support
- GitHub Issues: https://github.com/supabase/supabase

---

## 🎯 Most Likely Fix

If I had to guess, the issue is probably:

**#1:** You need to wait 2-3 minutes after saving SMTP settings
**#2:** Wrong port (try 587 instead of 465, or vice versa)
**#3:** Email templates not set up in Supabase

**Try this right now:**
1. Check if "Enable Custom SMTP" toggle is ON and green
2. Try port 587 instead of 465
3. Click Save
4. Wait 3 minutes
5. Try again

Let me know what error you see in the logs! 🚀
