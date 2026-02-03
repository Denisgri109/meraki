# Supabase Auth Email Template Setup

## Where to Add This Template

**Location:** Supabase Dashboard → Authentication → Email Templates

**URL:** https://supabase.com/dashboard/project/bkxdsxnxrtcqnkdcdist/auth/templates

---

## Step-by-Step Instructions

### Step 1: Go to Email Templates
1. Open: https://supabase.com/dashboard/project/bkxdsxnxrtcqnkdcdist/auth/templates
2. You'll see a list of templates like:
   - Confirm Signup
   - Magic Link
   - Change Email Address
   - Reset Password

### Step 2: Edit "Confirm Signup" Template
1. Find **"Confirm Signup"** in the list
2. Click on it to expand
3. You'll see two tabs: **Subject** and **Content**

### Step 3: Add the Subject Line
**Subject tab:**
```
Verify Your Email - Merakí | Code: {{ .Token }}
```

Or simpler:
```
Your Merakí Verification Code: {{ .Token }}
```

### Step 4: Add the HTML Template
**Content tab - HTML Version:**

Copy and paste this exact HTML (I optimized it for Supabase):

```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Verify Your Email - Merakí</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #1a1a2e;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #1a1a2e; padding: 40px 20px;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; background: linear-gradient(135deg, #2d2d44 0%, #1a1a2e 100%); border-radius: 24px; overflow: hidden; box-shadow: 0 20px 60px rgba(139, 92, 246, 0.3);">
                    <!-- Header -->
                    <tr>
                        <td style="padding: 50px 40px 30px; text-align: center; background: linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, transparent 100%);">
                            <h1 style="margin: 0; font-size: 48px; font-weight: 300; color: #FDF6F6; letter-spacing: 8px; text-shadow: 0 0 30px rgba(139, 92, 246, 0.5);">Merakí</h1>
                            <p style="margin: 15px 0 0; font-size: 14px; color: #8B5CF6; text-transform: uppercase; letter-spacing: 3px;">Beauty & Wellness</p>
                        </td>
                    </tr>
                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px;">
                            <h2 style="margin: 0 0 20px; font-size: 24px; font-weight: 600; color: #FDF6F6; text-align: center;">Verify Your Email</h2>
                            <p style="margin: 0 0 30px; font-size: 16px; color: #a0a0b0; text-align: center; line-height: 1.6;">
                                Welcome to Merakí! Use the verification code below to complete your registration.
                            </p>
                            <!-- OTP Code Box -->
                            <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #3d3d5c 0%, #2d2d44 100%); border-radius: 16px; margin-bottom: 30px; border: 1px solid rgba(139, 92, 246, 0.3);">
                                <tr>
                                    <td style="padding: 30px; text-align: center;">
                                        <p style="margin: 0 0 15px; font-size: 14px; color: #8B5CF6; text-transform: uppercase; letter-spacing: 2px;">Your Verification Code</p>
                                        <div style="font-size: 42px; font-weight: 700; color: #FDF6F6; letter-spacing: 12px; font-family: 'Courier New', monospace;">{{ .Token }}</div>
                                        <p style="margin: 20px 0 0; font-size: 13px; color: #6b6b80;">This code expires in 60 minutes</p>
                                    </td>
                                </tr>
                            </table>
                            <p style="margin: 0; font-size: 14px; color: #6b6b80; text-align: center; line-height: 1.6;">
                                Enter this code in the Merakí app to verify your email and start booking amazing beauty services.
                            </p>
                        </td>
                    </tr>
                    <!-- Footer -->
                    <tr>
                        <td style="padding: 30px 40px; background: rgba(0,0,0,0.2); text-align: center;">
                            <p style="margin: 0 0 10px; font-size: 12px; color: #6b6b80;">
                                If you didn't create an account with Merakí, you can safely ignore this email.
                            </p>
                            <p style="margin: 0; font-size: 11px; color: #4a4a5a;">
                                © 2026 Merakí. All rights reserved.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
```

**Important changes I made to your template:**
- Changed `<table width="100%" max-width="600">` to `<table width="600">` (max-width attribute doesn't work in email)
- Changed `<div>` inside table to proper `<table><tr><td>` structure (better email client compatibility)
- Kept all your beautiful styling!

### Step 5: Add Plain Text Version (Optional but Recommended)
**Content tab - Text Version:**
```
Merakí - Beauty & Wellness

Verify Your Email

Welcome to Merakí! Use the verification code below to complete your registration.

Your Verification Code: {{ .Token }}

This code expires in 60 minutes.

Enter this code in the Merakí app to verify your email and start booking amazing beauty services.

If you didn't create an account with Merakí, you can safely ignore this email.

© 2026 Merakí. All rights reserved.
```

### Step 6: Save the Template
1. Click **"Save"** or **"Update Template"**
2. Wait 30 seconds for changes to propagate

---

## Available Template Variables

Supabase provides these variables you can use:

- `{{ .Token }}` - The 6-digit OTP code (most important!)
- `{{ .Email }}` - User's email address
- `{{ .SiteURL }}` - Your app URL
- `{{ .ConfirmationURL }}` - Full confirmation URL
- `{{ .Data }}` - Additional data from signup

**For OTP (what you're using):**
- Use `{{ .Token }}` to show the 6-digit code
- The code is automatically generated by Supabase
- User enters this code in your app

---

## Testing the Template

### Method 1: Send Test Email from Supabase
1. In the template editor, click **"Send test email"**
2. Enter your email address
3. Click **"Send"**
4. Check your inbox for the beautifully formatted email!

### Method 2: Test in Your App
1. Open your app
2. Go to "Apply as Master"
3. Fill Step 1 with your email
4. Click Continue
5. Check your email!

---

## Troubleshooting

### Email Not Sending?
**Check these in order:**

1. **Is SMTP enabled?**
   - Go to Auth → Providers → Email
   - Make sure "Enable Custom SMTP" is ON (green toggle)

2. **Is template saved?**
   - Go back to Templates → Confirm Signup
   - Make sure your HTML is there
   - Click Save again

3. **Wait 2-3 minutes**
   - Changes can take a few minutes to propagate

4. **Check spam folder**
   - If using a test domain, emails might go to spam

### Template Looks Broken?
- Email clients are picky about HTML
- Use tables for layout (not divs with max-width)
- Inline CSS only (no external stylesheets)
- Test in multiple email clients (Gmail, Outlook, Apple Mail)

### Code Not Showing?
- Make sure you used `{{ .Token }}` (case sensitive)
- Don't add spaces: `{{.Token}}` won't work
- Must be exactly: `{{ .Token }}`

---

## Other Templates to Set Up (Optional)

You can customize these other templates too:

### Magic Link Template
Use this for passwordless login (if you add that feature later)

### Reset Password Template
For when users forget their password

### Change Email Template
When users want to change their email address

**Same process:** Go to each template → Add HTML → Save

---

## Quick Checklist

- [ ] Added Subject line with `{{ .Token }}`
- [ ] Added HTML template to "Confirm Signup"
- [ ] Added Text template (optional)
- [ ] Clicked Save
- [ ] Waited 2-3 minutes
- [ ] Sent test email from Supabase
- [ ] Received the email
- [ ] Tested in your app

---

## Still Not Working?

If you've added the template but emails still aren't sending:

1. **Check Supabase Logs:**
   - Go to: https://supabase.com/dashboard/project/bkxdsxnxrtcqnkdcdist/logs
   - Filter by: `auth` or `email`
   - Look for error messages

2. **Verify SMTP Settings:**
   - Auth → Providers → Email
   - Make sure all SMTP fields are filled
   - Toggle is ON
   - Clicked Save

3. **Check Resend Dashboard:**
   - https://resend.com
   - Check if emails are being sent
   - Check if domain is verified

4. **Try Default Supabase Email:**
   - Temporarily toggle OFF "Enable Custom SMTP"
   - Test if emails work then
   - If yes, your SMTP settings are the issue
   - If no, your template might be the issue

---

## Need Help?

Send me:
1. Screenshot of your template in Supabase
2. Screenshot of your SMTP settings
3. Any error messages from Supabase logs

I'll help you fix it! 🚀
