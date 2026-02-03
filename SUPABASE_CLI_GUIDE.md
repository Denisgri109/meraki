# Supabase CLI Quick Reference Guide

## ✅ Installation Status
**Status:** ✅ Installed successfully via Scoop
**Version:** 2.72.7
**Location:** `~/scoop/shims/supabase`

---

## 🚀 Quick Start Commands

### 1. Link to Your Project (Already Done!)
Your project is already linked:
- **Project ID:** `bkxdsxnxrtcqnkdcdist`
- **Project Name:** Merakí
- **Region:** eu-west-1

### 2. Login to Supabase (One-time setup)
```bash
# Run this once to authenticate
~/scoop/shims/supabase login
```

### 3. Link Project (One-time setup)
```bash
# Navigate to your project folder
cd C:\Users\denis\Desktop\meraki_app

# Link to your Supabase project
~/scoop/shims/supabase link --project-ref bkxdsxnxrtcqnkdcdist
```

---

## 📦 Common Commands You'll Use

### Database Operations
```bash
# Push local migrations to production
~/scoop/shims/supabase db push

# Pull changes from production
~/scoop/shims/supabase db pull

# Reset local database
~/scoop/shims/supabase db reset

# Check database status
~/scoop/shims/supabase db status
```

### Edge Functions
```bash
# Deploy all edge functions
~/scoop/shims/supabase functions deploy

# Deploy specific function
~/scoop/shims/supabase functions deploy send-confirmation-request

# Deploy with no verification (for CI/CD)
~/scoop/shims/supabase functions deploy --no-verify-jwt

# List all functions
~/scoop/shims/supabase functions list

# Delete a function
~/scoop/shims/supabase functions delete function-name
```

### Secrets Management
```bash
# List all secrets
~/scoop/shims/supabase secrets list

# Set a new secret
~/scoop/shims/supabase secrets set RESEND_API_KEY=re_your_key_here

# Set multiple secrets
~/scoop/shims/supabase secrets set --from-file .env

# Unset (delete) a secret
~/scoop/shims/supabase secrets unset RESEND_API_KEY
```

### Storage
```bash
# List all buckets
~/scoop/shims/supabase storage list

# Create a bucket
~/scoop/shims/supabase storage create bucket-name --public

# Delete a bucket
~/scoop/shims/supabase storage delete bucket-name

# List bucket contents
~/scoop/shims/supabase storage ls bucket-name

# Upload a file
~/scoop/shims/supabase storage cp local-file.jpg bucket-name/remote-file.jpg
```

### Local Development (Optional)
```bash
# Start local Supabase stack
~/scoop/shims/supabase start

# Stop local stack
~/scoop/shims/supabase stop

# View local dashboard (Studio)
# Open: http://localhost:54323

# View logs
~/scoop/shims/supabase logs
```

---

## 🔧 Your Project-Specific Commands

### Deploy New Features
```bash
cd C:\Users\denis\Desktop\meraki_app

# Deploy database migrations
~/scoop/shims/supabase db push

# Deploy edge functions
~/scoop/shims/supabase functions deploy send-confirmation-request
~/scoop/shims/supabase functions deploy handle-no-show-enhanced
```

### Manage Secrets
```bash
# View current secrets
~/scoop/shims/supabase secrets list

# Add/update Resend API key
~/scoop/shims/supabase secrets set RESEND_API_KEY=re_7GYiq3xi_nrL4xDB6PHSVFJA53BBuYe2H

# Add/update Service Role key
~/scoop/shims/supabase secrets set SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJreGRzeG54cnRjcW5rZGNkaXN0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODg0MzkyOSwiZXhwIjoyMDg0NDE5OTI5fQ.DeMl2267U9hNjRVI9q66QqPlm4k3lYABz6p6yqVB-v0

# Add Project URL
~/scoop/shims/supabase secrets set PROJECT_URL=https://bkxdsxnxrtcqnkdcdist.supabase.co
```

---

## 📝 Project Configuration

Your project is configured in: `supabase/config.toml`

Key settings:
- **Project ID:** meraki_app
- **API Port:** 54321 (local development)
- **DB Port:** 54322 (local development)
- **Studio Port:** 54323 (local dashboard)
- **Major DB Version:** 15

---

## 🎯 Next Steps

1. **Open a NEW terminal window** (to reload PATH with Scoop)
2. **Run:** `supabase --version` (should show 2.72.7)
3. **Run:** `supabase login` (authenticate once)
4. **Run:** `supabase link --project-ref bkxdsxnxrtcqnkdcdist` (link project)

After that, you can use `supabase` without the full path!

---

## 💡 Tips

### Add to PATH (Optional)
To use `supabase` without typing the full path, add to your system PATH:
```
C:\Users\denis\scoop\shims
```

**How to add:**
1. Open System Properties → Environment Variables
2. Edit "Path" under User variables
3. Add `C:\Users\denis\scoop\shims`
4. Open new terminal window

### Update Supabase CLI
```bash
# Update to latest version
scoop update supabase
```

### Get Help
```bash
# General help
supabase --help

# Specific command help
supabase functions deploy --help
supabase secrets --help
```

---

## 🆘 Troubleshooting

### "supabase: command not found"
**Fix:** Use full path: `~/scoop/shims/supabase` or `C:\Users\denis\scoop\shims\supabase`

### "Project not linked"
**Fix:** Run: `supabase link --project-ref bkxdsxnxrtcqnkdcdist`

### "Authentication required"
**Fix:** Run: `supabase login`

### Function deployment fails
**Fix:** 
1. Check function syntax
2. Verify secrets are set: `supabase secrets list`
3. Try: `supabase functions deploy --no-verify-jwt`

---

## 📚 Documentation

- **Supabase CLI Docs:** https://supabase.com/docs/guides/cli
- **Functions:** https://supabase.com/docs/guides/functions
- **Secrets:** https://supabase.com/docs/guides/functions/secrets

---

**You're all set! 🚀**

Your Supabase CLI is installed and ready to use with your Merakí project.
