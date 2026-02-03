# Setting Up Resend SMTP with Supabase Auth

## What You Need
You'll configure Supabase Auth to use Resend's SMTP server to send all emails (OTP codes, confirmations, etc.)

---

## Step 1: Get Resend SMTP Credentials

### 1.1 Go to Resend Dashboard
1. Visit: https://resend.com
2. Log in to your account
3. Go to **Settings** → **SMTP**

### 1.2 Get Your SMTP Credentials
Resend will provide you with these settings:

```
Host: smtp.resend.com
Port: 587 (STARTTLS) or 465 (SSL/TLS)
Username: resend
Password: YOUR_API_KEY (the same key: re_7GYiq3xi_nrL4xDB6PHSVFJA53BBuYe2H)
From Email: noreply@yourdomain.com (or your verified domain)
```

**Important:**
- Use port **587** with STARTTLS (recommended)
- The username is always `resend`
- The password is your API key
- Your "from" email must be verified in Resend

---

## Step 2: Configure Supabase Auth SMTP Settings

### 2.1 Go to Supabase Dashboard
1. Visit: https://supabase.com/dashboard/project/bkxdsxnxrtcqnkdcdist
2. Click **Authentication** in the left sidebar
3. Click **Email Templates** (just to see current templates)
4. Go to **Providers** tab
5. Click **Email** provider

### 2.2 Enable SMTP
You should see a toggle for **"Enable Custom SMTP"**
1. Toggle it **ON**
2. Fill in these fields:

```
SMTP Host: smtp.resend.com
SMTP Port: 587
SMTP User: resend
SMTP Password: re_7GYiq3xi_nrL4xDB6PHSVFJA53BBuYe2H
Sender Name: Merakí App
Sender Email: noreply@meraki.com (or your verified domain)
```

### 2.3 Advanced Settings (Optional)
If you see advanced options:
```
Security: STARTTLS (or TLS)
Max emails per hour: 100 (or your Resend limit)
```

### 2.4 Save Settings
Click **Save** or **Update Provider**

---

## Step 3: Verify Domain in Resend (Important!)

### 3.1 Add Your Domain
1. In Resend dashboard, go to **Domains**
2. Click **Add Domain**
3. Enter your domain: `meraki.com` (or whatever you use)
4. Follow DNS verification steps

### 3.2 DNS Records to Add
Resend will give you DNS records like:

**DKIM Record:**
```
Type: TXT
Host: resend._domainkey.yourdomain.com
Value: [Long string from Resend]
```

**SPF Record:**
```
Type: TXT
Host: yourdomain.com
Value: v=spf1 include:spf.resend.com ~all
```

### 3.3 Verify DNS
1. Add the DNS records in your domain provider (GoDaddy, Cloudflare, etc.)
2. Wait 5-10 minutes for propagation
3. Click **Verify** in Resend dashboard
4. Domain status should change to **"Verified"**

---

## Step 4: Test the Setup

### 4.1 Send Test Email
In Supabase Dashboard:
1. Go to **Authentication** → **Email Templates**
2. Click any template (e.g., "Confirm Signup")
3. Click **Send Test Email**
4. Enter your email address
5. Check your inbox

### 4.2 Test in Your App
1. Run your app
2. Go to "Apply as Master"
3. Fill Step 1 (Basic Info)
4. Click Continue
5. Check if you receive the verification email from Resend

The email should:
- Come from: `noreply@yourdomain.com`
- Show "Merakí App" as sender name
- Be sent via Resend's infrastructure

---

## Step 5: Update Email Templates (Optional)

Supabase has default email templates. You can customize them:

### 5.1 Go to Templates
1. Supabase Dashboard → Authentication → Email Templates
2. You'll see templates like:
   - Confirm Signup
   - Magic Link
   - Change Email Address
   - Reset Password

### 5.2 Customize Templates
You can edit the HTML/text to match your brand:

```html
<!-- Example custom template -->
<h2>Welcome to Merakí!</h2>
<p>Hi {{ .Email }},</p>
<p>Your verification code is: <strong>{{ .Token }}</strong></p>
<p>This code expires in 1 hour.</p>
<br>
<p>Best regards,<br>Merakí Team</p>
```

**Available variables:**
- `{{ .Email }}` - User's email
- `{{ .Token }}` - OTP code
- `{{ .SiteURL }}` - Your app URL
- `{{ .ConfirmationURL }}` - Magic link URL

---

## Troubleshooting

### Issue 1: "SMTP connection failed"
**Fix:** 
- Double-check API key is correct (should start with `re_`)
- Make sure you're using port 587 with STARTTLS
- Verify your IP isn't blocked by firewall

### Issue 2: "Domain not verified"
**Fix:**
- Complete domain verification in Resend
- Wait for DNS propagation (can take up to 24 hours)
- Check DNS records are correct

### Issue 3: Emails going to spam
**Fix:**
- Complete domain verification (DKIM + SPF)
- Use a real "from" domain (not @gmail.com)
- Warm up your domain (start with small volume)

### Issue 4: Rate limits
**Resend limits:**
- Free tier: 3,000 emails/day
- If you hit limits, upgrade your Resend plan

---

## Quick Reference

### Resend SMTP Settings:
```
Host: smtp.resend.com
Port: 587
User: resend
Pass: re_7GYiq3xi_nrL4xDB6PHSVFJA53BBuYe2H
From: noreply@meraki.com
```

### Supabase Project URL:
```
https://supabase.com/dashboard/project/bkxdsxnxrtcqnkdcdist
```

### Resend Dashboard:
```
https://resend.com
```

---

## Verification Checklist

- [ ] Got SMTP credentials from Resend
- [ ] Configured SMTP in Supabase Auth settings
- [ ] Verified domain in Resend (added DNS records)
- [ ] Sent test email from Supabase
- [ ] Tested in your app
- [ ] Received email successfully

---

## Important Notes

1. **Your API key is sensitive** - Never share it publicly!
2. **Domain verification is crucial** - Without it, emails will likely go to spam
3. **Free tier limits** - 3,000 emails/day on Resend free plan
4. **Supabase still handles the logic** - Resend just delivers the emails
5. **Templates are in Supabase** - You customize templates in Supabase dashboard

---

Once configured, all emails from Supabase Auth will be sent through Resend instead of Supabase's default email service!
