# 🧪 Merakí App - New Features Testing Guide

> **Complete testing guide for the global multi-master platform features**

---

## 📋 Where to Get API Keys

### 🔑 Resend API Key (For Email Notifications)

1. Go to **[resend.com](https://resend.com)**
2. Sign up for a free account
3. Create a new API key:
   - Dashboard → API Keys → Create API Key
   - Name it "Meraki App"
   - Copy the key (starts with `re_`)

**Free tier includes:**
- 3,000 emails/month
- Unlimited domains

---

### 🔑 Supabase Service Role Key

1. Go to your **[Supabase Dashboard](https://supabase.com/dashboard)**
2. Select your **Merakí** project
3. Go to: **Project Settings** (bottom left) → **API**
4. Find **"service_role"** key (NOT the anon key!)
5. Click "Reveal" and copy it

**⚠️ IMPORTANT:** The service role key bypasses all RLS policies - keep it secret!

---

### 🔧 How to Set These in Supabase

Once you have the keys, add them as secrets:

**Option 1: Using Supabase CLI**
```bash
supabase secrets set RESEND_API_KEY=re_your_key_here
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=eyJhbG...your_key
supabase secrets set SUPABASE_URL=https://bkxdsxnxrtcqnkdcdist.supabase.co
supabase secrets set STRIPE_SECRET_KEY=sk_test_... (if not already set)
```

**Option 2: Using Supabase Dashboard**
1. Go to Dashboard → Edge Functions → Secrets
2. Click "Add Secret"
3. Add each key one by one

---

## 📂 Table of Contents

1. [🌍 Global Master Onboarding](#1-global-master-onboarding-system)
2. [📸 Photo Consultation](#2-photo-consultation-feature)
3. [🛡️ Enhanced No-Show Protection](#3-enhanced-no-show-protection)
4. [🌐 Timezone & Currency](#4-timezone--currency-support)
5. [💾 Database Schema](#5-database-schema)
6. [⚡ Edge Functions](#6-edge-functions)
7. [✅ Testing Checklist](#7-testing-checklist)

---

## 1. 🌍 Global Master Onboarding System

### What It Does
Beauty professionals worldwide can apply to join Merakí. You review and approve/reject applications before they get master access.

### Files Created
| Type | Path |
|------|------|
| 📱 Screen | `src/screens/auth/MasterApplicationScreen.tsx` |
| 📱 Screen | `src/screens/owner/MasterApplicationReviewScreen.tsx` |
| 🗄️ Migration | `supabase/migrations/20260202_global_features.sql` |
| 📘 Types | `src/types/database.ts` |

### Testing Steps

#### 👤 As a Prospective Master (Applicant)

**Step 1:** Navigate to Login → "Apply as Master" *(add this button)*

**Step 2:** Complete the 4-step wizard:
- ✅ **Step 1 - Basic Info:** Name, email, password, phone
- ✅ **Step 2 - Professional:** Years of experience, bio, specialties
- ✅ **Step 3 - Location:** Country, city, timezone, service radius
- ✅ **Step 4 - Currency & Portfolio:** Currency selection + upload portfolio images

**Step 3:** Submit application

**Expected Results:**
- ✓ User created with role `pending_master`
- ✓ Record created in `master_applications` table
- ✓ Success message shown
- ✓ Email notification sent *(when configured)*

---

#### 👑 As the Owner (Reviewer)

**Step 1:** Navigate to Owner Dashboard → "Master Applications" *(add menu item)*

**Step 2:** Review applications list:
- Filter tabs: pending, under_review, approved, rejected, all
- Cards show: name, email, country, experience, timezone

**Step 3:** Review details:
- Tap pending → status changes to `under_review`
- View full details including portfolio images

**Step 4:** Make decision:
- **✅ Approve:** User becomes master immediately
- **❌ Reject:** Optionally provide reason

**Expected Results:**
- ✓ Approved applicant can log in as master
- ✓ Rejected applicant stays as `pending_master`
- ✓ Email sent to applicant *(when configured)*

---

### Database: `master_applications`

| Field | Type | Description |
|-------|------|-------------|
| `status` | VARCHAR | pending → under_review → approved/rejected |
| `country_code` | VARCHAR(2) | ISO country code |
| `city` | VARCHAR | City name |
| `timezone` | VARCHAR | IANA timezone (e.g., Europe/London) |
| `currency_code` | VARCHAR(3) | EUR, USD, GBP, etc. |
| `service_radius_km` | INTEGER | NULL = global, number = local radius |
| `portfolio_urls` | TEXT[] | Array of uploaded image URLs |

---

## 2. 📸 Photo Consultation Feature

### What It Does
Clients upload photos and describe what they want. Masters/owners provide professional advice on feasibility, recommendations, and price estimates.

### Files Created
| Type | Path |
|------|------|
| 📱 Client Screen | `src/screens/client/PhotoConsultationRequestScreen.tsx` |
| 📱 Master Screen | `src/screens/master/PhotoConsultationReviewScreen.tsx` |
| 📘 Types | Updated `src/types/database.ts` |

### Testing Steps

#### 👤 As a Client (Requester)

**Step 1:** Navigate to Home → "Photo Consultation" *(add button)*

**Step 2:** Select Professional:
- Choose specific master, OR
- Select "Any Professional" for anyone to respond

**Step 3:** Fill the form:
- **Title:** Brief description (e.g., "Volume lashes possible?")
- **Description:** Detailed info, concerns, allergies
- **Service Type:** Eyelash Extensions, Microblading, etc.
- **Photos:** Upload 1-5 clear photos

**Step 4:** Submit

**Expected Results:**
- ✓ Record created in `photo_consultations`
- ✓ Status = `pending`
- ✓ Confirmation message shown
- ✓ Notification sent to masters/owners

---

#### 👨‍🎨 As a Master/Owner (Responder)

**Step 1:** Navigate to Dashboard → "Photo Consultations" *(add menu item)*

**Step 2:** View list:
- Filter: pending, in_review, responded, closed
- See client info and photo previews

**Step 3:** Review consultation:
- Tap pending → status = `in_review`
- View full photos

**Step 4:** Fill response:
- **Is it doable?** Yes/No toggle
- **Professional Notes** *(required, min 20 chars)*
- **Recommendations** *(optional)*
- **Estimated Price Range** *(optional)*
- **Estimated Duration** *(optional)*

**Step 5:** Submit response

**Expected Results:**
- ✓ Status = `responded`
- ✓ Client can view response *(need to build view screen)*
- ✓ Can close consultation when done

---

### Database: `photo_consultations`

| Field | Type | Description |
|-------|------|-------------|
| `status` | VARCHAR | pending → in_review → responded → closed |
| `photo_urls` | TEXT[] | Array of uploaded photo URLs |
| `is_doable` | BOOLEAN | Can the request be fulfilled? |
| `professional_notes` | TEXT | Professional assessment |
| `recommendations` | TEXT | What master recommends |
| `estimated_price_range` | VARCHAR | e.g., "€50-80" |
| `estimated_duration` | VARCHAR | e.g., "2 hours" |

---

## 3. 🛡️ Enhanced No-Show Protection

### What It Does
Complete flow: **Confirmation Request → Client Confirms → No-Show Fee (ONLY if they confirmed)**

### How It Works

```
24 hours before appointment
        ↓
Send confirmation email
        ↓
Client confirms? (Y/N)
        ↓
     ┌──┴──┐
   YES    NO/Ignore
    ↓        ↓
Shows up  Doesn't show
    ↓        ↓
  Normal   Check confirmation
    ↓        ↓
           Did they confirm?
         ┌──┴──┐
       YES    NO
        ↓      ↓
    Charge fee  Cancel payment
    Full amount  No fee
```

### Edge Functions

#### 📧 `send-confirmation-request`
- **When:** 24 hours before appointment
- **What it does:**
  - Sends email with confirmation link
  - Sets `confirmation_sent_at` and `confirmation_deadline`
  - Sets `client_confirmed = NULL` (waiting)

#### 💰 `handle-no-show-enhanced`
- **When:** Master marks as no-show
- **Logic:**
  - IF `client_confirmed = TRUE` → Charge full fee
  - IF `client_confirmed = FALSE/NULL` → Cancel payment, no fee

### Testing Scenarios

#### ✅ Scenario 1: Confirms + No-Show = Fee Charged
1. Book appointment
2. Receive confirmation email (24h before)
3. Client confirms via link/button
4. Client doesn't show up
5. Master marks no-show
6. **Result:** Full fee charged, status = `no_show`

#### ✅ Scenario 2: Never Confirms = No Fee
1. Book appointment
2. Receive confirmation email
3. Client ignores/doesn't confirm
4. Client doesn't show (or master cancels)
5. **Result:** Payment cancelled, no fee, status = `cancelled`

---

## 4. 🌐 Timezone & Currency Support

### Supported Timezones (22 total)

**🇪🇺 Europe:**
- London (GMT/BST)
- Paris, Berlin, Madrid, Rome, Amsterdam (CET/CEST)
- Moscow (MSK)

**🇺🇸 Americas:**
- New York, Toronto (EST/EDT)
- Chicago (CST/CDT)
- Denver (MST/MDT)
- Los Angeles (PST/PDT)
- São Paulo (BRT)

**🌏 Asia:**
- Dubai (GST)
- Singapore (SGT)
- Tokyo, Seoul (JST/KST)
- Shanghai, Hong Kong (CST/HKT)

**🇦🇺 Pacific:**
- Sydney, Melbourne (AEST/AEDT)
- Auckland (NZST/NZDT)

---

### Supported Currencies (13 total)

| Code | Symbol | Name |
|------|--------|------|
| EUR | € | Euro |
| USD | $ | US Dollar |
| GBP | £ | British Pound |
| CAD | C$ | Canadian Dollar |
| AUD | A$ | Australian Dollar |
| CHF | Fr | Swiss Franc |
| JPY | ¥ | Japanese Yen |
| CNY | ¥ | Chinese Yuan |
| KRW | ₩ | Korean Won |
| SGD | S$ | Singapore Dollar |
| AED | د.إ | UAE Dirham |
| BRL | R$ | Brazilian Real |
| RUB | ₽ | Russian Ruble |

---

### Helper Functions

```typescript
// Convert UTC to local time
utcToZonedTime(utcDate: string, timezone: string): Date

// Convert local time to UTC
zonedTimeToUtc(localDate: Date, timezone: string): Date

// Format for display
formatInTimezone(utcDate: string, timezone: string, formatString: string): string

// Format currency
formatCurrency(amount: number, currencyCode: string): string
```

---

## 5. 💾 Database Schema

### New Tables

#### `master_applications`
```sql
id (UUID, PK)
├── email, full_name, phone
├── bio, years_of_experience
├── specialties[], certifications[], portfolio_urls[]
├── country_code, city, timezone, service_radius_km
├── currency_code
├── status: pending | under_review | approved | rejected
├── reviewed_by, reviewed_at, rejection_reason, notes
├── profile_id (FK to profiles)
└── created_at, updated_at
```

#### `photo_consultations`
```sql
id (UUID, PK)
├── client_id, master_id (FK to profiles)
├── title, description, service_type
├── photo_urls[]
├── status: pending | in_review | responded | closed
├── is_doable, professional_notes, recommendations
├── estimated_price_range, estimated_duration
├── responded_at, responded_by
├── converted_to_booking, booking_id
└── created_at, updated_at
```

---

### Enhanced Tables

#### `profiles` - New Fields
```sql
country_code (VARCHAR 2)
city (VARCHAR 255)
timezone (VARCHAR 100) DEFAULT 'UTC'
currency_code (VARCHAR 3) DEFAULT 'EUR'
service_radius_km (INTEGER) NULL = global
years_of_experience (INTEGER)
specialties (TEXT[])
is_verified (BOOLEAN) DEFAULT false
verification_documents (TEXT[])
stripe_connect_id (VARCHAR 255)
```

#### `appointments` - New Fields
```sql
confirmation_sent_at (TIMESTAMPTZ)
confirmation_deadline (TIMESTAMPTZ)
client_confirmed (BOOLEAN) DEFAULT NULL
confirmation_reminder_count (INTEGER) DEFAULT 0
```

#### `products` - New Fields
```sql
available_countries (TEXT[]) DEFAULT '{}'
restricted_countries (TEXT[]) DEFAULT '{}'
shipping_weight_kg (DECIMAL)
is_digital (BOOLEAN) DEFAULT false
```

#### `orders` - New Fields
```sql
shipping_country (VARCHAR 2)
shipping_method (VARCHAR 100)
shipping_cost (DECIMAL) DEFAULT 0
customs_duties (DECIMAL) DEFAULT 0
estimated_delivery_date (DATE)
```

---

## 6. ⚡ Edge Functions

### Deployed Functions (14 Total)

#### New Functions:
1. **`send-confirmation-request`** ✅
   - Sends confirmation email 24h before appointment
   - Status: ACTIVE, Version 1

2. **`handle-no-show-enhanced`** ✅
   - Checks confirmation status before charging fee
   - Status: ACTIVE, Version 1

#### Existing Functions:
3. `appointment-reminders`
4. `send-message-notification`
5. `send-marketing-notification`
6. `aftercare-reminder`
7. `low-stock-alert`
8. `create-payment-intent`
9. `capture-payment`
10. `cancel-payment`
11. `handle-no-show` (legacy)
12. `send-push-notification`
13. `process-scheduled-notifications`
14. `send-notification`

---

## 7. ✅ Testing Checklist

### 🌍 Master Onboarding
- [ ] "Apply as Master" button visible on Login screen
- [ ] Can complete all 4 steps
- [ ] Portfolio images upload successfully
- [ ] Application appears in Owner's review list
- [ ] Owner can approve/reject
- [ ] Approved user becomes master on next login
- [ ] Rejected user sees appropriate message

### 📸 Photo Consultation
- [ ] "Photo Consultation" button on Home screen
- [ ] Can select specific master or "Any Professional"
- [ ] Photos upload (1-5 images)
- [ ] Appears in Master/Owner review list
- [ ] Master can view photos
- [ ] Master can submit response with all fields
- [ ] Can close consultation

### 🛡️ No-Show Protection
- [ ] Confirmation email sends 24h before
- [ ] Email has working confirmation link
- [ ] Client can confirm
- [ ] **Scenario 1:** Confirms + no-show → fee charged
- [ ] **Scenario 2:** Never confirms → no fee
- [ ] Payment records created
- [ ] Appointment status updates correctly

### 🌐 Timezone/Currency
- [ ] Master can set timezone in profile
- [ ] Master can set currency
- [ ] Times display in local timezone
- [ ] Currency symbols show correctly

### 💾 Database
- [ ] All tables created
- [ ] RLS policies working
- [ ] Foreign keys set up
- [ ] Triggers working

### 🔧 Setup
- [ ] Storage buckets created:
  - [ ] `master-portfolios`
  - [ ] `consultation-photos`
- [ ] Edge functions deployed
- [ ] Environment variables set:
  - [ ] `RESEND_API_KEY`
  - [ ] `SUPABASE_SERVICE_ROLE_KEY`
  - [ ] `SUPABASE_URL`

---

## 📍 Quick Reference

### Screen Locations
| Feature | Screen Path | Navigation |
|---------|-------------|------------|
| Apply as Master | `src/screens/auth/MasterApplicationScreen.tsx` | AuthStack → MasterApplication |
| Review Applications | `src/screens/owner/MasterApplicationReviewScreen.tsx` | OwnerTabs → MasterApplications |
| Photo Consultation | `src/screens/client/PhotoConsultationRequestScreen.tsx` | ClientTabs → PhotoConsultationRequest |
| Review Consultations | `src/screens/master/PhotoConsultationReviewScreen.tsx` | MasterTabs → PhotoConsultations |

### Database Locations
- **Migrations:** `supabase/migrations/20260202_global_features.sql`
- **Types:** `src/types/database.ts`

### Edge Functions
- **Confirmation:** `supabase/functions/send-confirmation-request/index.ts`
- **No-Show:** `supabase/functions/handle-no-show-enhanced/index.ts`

### Utilities
- **Timezone:** `src/utils/timezone.ts`

---

## 📝 TODO Items

### 🔴 Critical (Need to add)
1. **Login Screen:** "Apply as Master" button
2. **Owner Menu:** "Master Applications" menu item
3. **Client Home:** "Photo Consultation" button
4. **Master Menu:** "Photo Consultations" menu item

### 🟡 Setup Required
1. **Resend Account:** Sign up and get API key
2. **Environment Variables:** Add all secrets to Supabase
3. **Storage Buckets:** Create `master-portfolios` and `consultation-photos`
4. **Cron Job:** Set up automated confirmation requests

### 🟢 Future Improvements
1. **Client View:** Screen to see professional's response
2. **Currency Conversion:** Convert prices to client's currency
3. **Email Templates:** Better styled emails

---

## 🆘 Support

### If Something Goes Wrong:
1. **Check Supabase Logs:** Dashboard → Database → Logs
2. **Check Edge Function Logs:** Dashboard → Edge Functions → Logs
3. **Verify RLS Policies:** Check table policies in Database → Tables
4. **Confirm Environment Variables:** Dashboard → Edge Functions → Secrets
5. **Check Console:** Browser console or React Native logs

### Need Help?
- Review the original feature requirements
- Check the NEW_FEATURES_TESTING_GUIDE.md for detailed info
- Test one feature at a time

---

**Happy Testing! 🚀**
