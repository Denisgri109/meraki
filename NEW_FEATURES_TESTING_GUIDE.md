# Merakí App - New Features Testing Guide

This guide covers all the new features implemented for the global multi-master platform. Each section explains what the feature does, where to find it, and how to test it.

---

## Table of Contents

1. [Global Master Onboarding System](#1-global-master-onboarding-system)
2. [Photo Consultation Feature](#2-photo-consultation-feature)
3. [Enhanced No-Show Protection](#3-enhanced-no-show-protection)
4. [Timezone & Currency Support](#4-timezone--currency-support)
5. [Database Schema](#5-database-schema)
6. [Edge Functions](#6-edge-functions)
7. [Testing Checklist](#7-testing-checklist)

---

## 1. Global Master Onboarding System

### What it does
Allows beauty professionals from anywhere in the world to apply to join the Merakí platform. Applications go through an approval workflow before masters are granted access.

### Files Created
- **Screen**: `src/screens/auth/MasterApplicationScreen.tsx`
- **Screen**: `src/screens/owner/MasterApplicationReviewScreen.tsx`
- **Migration**: `supabase/migrations/20260202_global_features.sql`
- **Types**: Updated `src/types/database.ts`

### How to Test

#### As a Prospective Master (Applicant):
1. **Navigate to**: Login screen → "Apply as Master" button (you'll need to add this button to the login screen)
2. **Complete the 4-step application**:
   - **Step 1**: Basic Info (name, email, password, phone)
   - **Step 2**: Professional Info (years of experience, bio, specialties)
   - **Step 3**: Location (country, city, timezone, service radius)
   - **Step 4**: Currency & Portfolio (select currency, upload up to 10 portfolio images)
3. **Submit application**
4. **Expected Result**: 
   - User account created with role 'pending_master'
   - Application record created in `master_applications` table
   - Success message: "Application Submitted! You will receive an email notification once it has been reviewed."

#### As the Owner (Reviewer):
1. **Navigate to**: Owner Dashboard → "Master Applications" (add menu item/button)
2. **View applications list**:
   - Filter tabs: pending, under_review, approved, rejected, all
   - Each card shows: applicant name, email, country, experience, timezone
3. **Review an application**:
   - Tap on pending application → moves to "under_review" status
   - View full details including portfolio images
   - **Approve**: Updates user profile to role='master', is_master=true
   - **Reject**: Optionally provide rejection reason
4. **Expected Results**:
   - Approved applicant can now log in as a master
   - Rejected applicant remains with 'pending_master' role
   - Email notifications should be sent (need to configure)

### Database Table: `master_applications`
Key fields:
- `status`: pending | under_review | approved | rejected
- `country_code`, `city`, `timezone`: Location info
- `currency_code`: Master's pricing currency
- `service_radius_km`: NULL = global, number = local radius
- `specialties`, `portfolio_urls`: Professional details

---

## 2. Photo Consultation Feature

### What it does
Clients can upload photos of what they want done and get professional advice from masters/owners on feasibility, recommendations, and estimates.

### Files Created
- **Screen**: `src/screens/client/PhotoConsultationRequestScreen.tsx`
- **Screen**: `src/screens/master/PhotoConsultationReviewScreen.tsx`
- **Types**: `photo_consultations` table in `src/types/database.ts`

### How to Test

#### As a Client (Requester):
1. **Navigate to**: Home → "Photo Consultation" button (add to home screen or menu)
2. **Select Professional** (optional):
   - Choose specific master or "Any Professional"
   - Shows available masters with avatars
3. **Fill Consultation Form**:
   - Title: Brief description of request
   - Description: Detailed info about what they want, concerns, allergies, etc.
   - Service Type: Eyelash Extensions, Microblading, etc.
   - Photos: Upload 1-5 clear photos
4. **Submit**
5. **Expected Result**: 
   - Record created in `photo_consultations` table
   - Status: 'pending'
   - Client sees confirmation message

#### As a Master/Owner (Responder):
1. **Navigate to**: Dashboard → "Photo Consultations" (add menu item)
2. **View consultations**:
   - Filter: pending, in_review, responded, closed
   - Shows client info, photos, description
3. **Review a consultation**:
   - Tap pending → status changes to 'in_review'
   - View all photos (tap to enlarge if you add that feature)
   - Fill response form:
     - Is it doable? (Yes/No switch)
     - Professional Notes (required, min 20 chars)
     - Recommendations (optional)
     - Estimated Price Range (optional)
     - Estimated Duration (optional)
4. **Submit Response**
5. **Expected Results**:
   - Status changes to 'responded'
   - Client can view response (need to add client-side view)
   - Can close consultation when done

### Database Table: `photo_consultations`
Key fields:
- `status`: pending | in_review | responded | closed
- `client_id`, `master_id`: Who requested and who responded
- `photo_urls`: Array of uploaded photo URLs
- `is_doable`, `professional_notes`: Professional assessment
- `estimated_price_range`, `estimated_duration`: Optional estimates

---

## 3. Enhanced No-Show Protection

### What it does
Implements the complete no-show protection flow: confirmation request → client confirms → no-show fee only charged if they confirmed but didn't show up.

### Files Created/Modified
- **New Edge Function**: `supabase/functions/send-confirmation-request/index.ts`
- **New Edge Function**: `supabase/functions/handle-no-show-enhanced/index.ts`
- **Modified**: `supabase/functions/handle-no-show/index.ts` (legacy version)

### How to Test

#### Setup:
1. Deploy both edge functions to Supabase:
   ```bash
   supabase functions deploy send-confirmation-request
   supabase functions deploy handle-no-show-enhanced
   ```

2. Set up environment variables in Supabase:
   - `RESEND_API_KEY`: For sending confirmation emails
   - `STRIPE_SECRET_KEY`: For payment processing
   - `SUPABASE_URL`: Your project URL
   - `SUPABASE_SERVICE_ROLE_KEY`: Service role key

3. Set up a cron job or scheduled function to trigger confirmation requests 24 hours before appointments

#### Test Scenario 1: Client Confirms → No-Show → Fee Charged
1. Book an appointment as a client
2. Wait for or manually trigger confirmation request (24h before)
3. Client confirms via email link or in-app button (need to build confirmation UI)
4. Client doesn't show up
5. Master marks as no-show
6. **Expected Result**: 
   - Full fee charged (as client confirmed)
   - Payment captured via Stripe
   - Status: 'no_show'

#### Test Scenario 2: Client Never Confirms → No Fee
1. Book an appointment
2. Wait for confirmation request
3. Client ignores/doesn't confirm
4. Client doesn't show up (or master cancels)
5. **Expected Result**:
   - Payment intent cancelled
   - No fee charged
   - Status: 'cancelled'
   - Reason logged: "client_never_confirmed"

### Edge Function Details

#### `send-confirmation-request`
- **Trigger**: 24 hours before appointment
- **Actions**:
  - Sets `confirmation_sent_at` and `confirmation_deadline` (6 hours before appointment)
  - Sends email with confirmation link
  - Sets `client_confirmed` to NULL (waiting)
- **Email**: Contains confirmation button + warning about no-show fee

#### `handle-no-show-enhanced`
- **Trigger**: When master marks appointment as no-show
- **Logic**:
  - Check `client_confirmed` field
  - If TRUE: Capture payment (full no-show fee)
  - If FALSE/NULL: Cancel payment, no fee
- **Returns**: Success with action taken and reason

### Database Fields on `appointments` Table
- `confirmation_sent_at`: When confirmation email was sent
- `confirmation_deadline`: When client must confirm by
- `client_confirmed`: NULL (not sent), TRUE (confirmed), FALSE (declined)
- `confirmation_reminder_count`: How many reminders sent

---

## 4. Timezone & Currency Support

### What it does
Supports global marketplace with masters in different timezones and currencies. All appointments stored in UTC, displayed in local time.

### Files Modified
- **Utils**: `src/utils/timezone.ts` (already existed, enhanced)
- **Types**: `src/types/database.ts` (added timezone/currency fields to profiles)

### How to Test

#### Timezone Conversion:
1. Create master profiles with different timezones (e.g., London, New York, Tokyo)
2. Book appointments from client in different timezone
3. **Verify**: Both master and client see times converted to their local timezone
4. **Check**: Appointment stored in UTC in database

#### Currency Display:
1. Set different `currency_code` on master profiles (EUR, USD, GBP)
2. View services/prices as client
3. **Verify**: Prices displayed in master's currency with correct symbol
4. **Check**: Future: Currency conversion for international clients

### Supported Values

**Timezones** (22 total):
- Europe: London, Paris, Berlin, Madrid, Rome, Amsterdam, Moscow
- Americas: New York, Chicago, Denver, Los Angeles, Toronto, São Paulo
- Asia: Dubai, Singapore, Tokyo, Shanghai, Hong Kong, Seoul
- Pacific: Sydney, Melbourne, Auckland

**Currencies** (13 total):
- EUR (€), USD ($), GBP (£), CAD (C$), AUD (A$), CHF (Fr)
- JPY (¥), CNY (¥), KRW (₩), SGD (S$), AED (د.إ), BRL (R$), RUB (₽)

### Helper Functions
```typescript
// Convert UTC to local time
utcToZonedTime(utcDate: string, timezone: string): Date

// Convert local time to UTC
zonedTimeToUtc(localDate: Date, timezone: string): Date

// Format for display
formatInTimezone(utcDate: string, timezone: string, formatString: string): string

// Format appointment showing both times
formatAppointmentTime(utcStartTime: string, masterTimezone: string, clientTimezone?: string)

// Format currency with symbol
formatCurrency(amount: number, currencyCode: string): string
```

---

## 5. Database Schema

### New Tables Created

#### `master_applications`
```sql
- id (UUID, PK)
- email, full_name, phone (contact info)
- bio, years_of_experience, specialties[], certifications[], portfolio_urls[] (professional)
- country_code, city, timezone, service_radius_km (location)
- currency_code (pricing)
- status: pending | under_review | approved | rejected
- reviewed_by, reviewed_at, rejection_reason, notes (review tracking)
- profile_id (links to profiles when approved)
- created_at, updated_at
```

#### `photo_consultations`
```sql
- id (UUID, PK)
- client_id, master_id (who)
- title, description, service_type (what)
- photo_urls[] (uploaded photos)
- status: pending | in_review | responded | closed
- is_doable, professional_notes, recommendations (assessment)
- estimated_price_range, estimated_duration (estimates)
- responded_at, responded_by, converted_to_booking, booking_id
- created_at, updated_at
```

### Enhanced Tables

#### `profiles` - New Fields
```sql
- country_code (VARCHAR 2)
- city (VARCHAR 255)
- timezone (VARCHAR 100, default 'UTC')
- currency_code (VARCHAR 3, default 'EUR')
- service_radius_km (INTEGER, NULL = global)
- years_of_experience (INTEGER)
- specialties (TEXT[])
- is_verified (BOOLEAN, default false)
- verification_documents (TEXT[])
- stripe_connect_id (VARCHAR 255) - for payouts
```

#### `appointments` - New Fields
```sql
- confirmation_sent_at (TIMESTAMPTZ)
- confirmation_deadline (TIMESTAMPTZ)
- client_confirmed (BOOLEAN, default NULL)
- confirmation_reminder_count (INTEGER, default 0)
```

#### `products` - New Fields
```sql
- available_countries (TEXT[], empty = all)
- restricted_countries (TEXT[])
- shipping_weight_kg (DECIMAL)
- is_digital (BOOLEAN, default false)
```

#### `orders` - New Fields
```sql
- shipping_country (VARCHAR 2)
- shipping_method (VARCHAR 100)
- shipping_cost (DECIMAL 10,2, default 0)
- customs_duties (DECIMAL 10,2, default 0)
- estimated_delivery_date (DATE)
```

### Migration File
**Location**: `supabase/migrations/20260202_global_features.sql`

Apply with:
```bash
supabase db push
```

Or run SQL directly in Supabase SQL Editor.

---

## 6. Edge Functions

### New Functions to Deploy

1. **`send-confirmation-request`**
   - Sends confirmation email 24h before appointment
   - Sets confirmation tracking fields
   - Requires: RESEND_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

2. **`handle-no-show-enhanced`**
   - Checks if client confirmed before charging no-show fee
   - Only charges if client_confirmed = TRUE
   - Requires: STRIPE_SECRET_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

### Deployment Commands
```bash
# Deploy all functions
supabase functions deploy send-confirmation-request
supabase functions deploy handle-no-show-enhanced

# Set secrets
supabase secrets set RESEND_API_KEY=your_key
supabase secrets set STRIPE_SECRET_KEY=sk_test_...
supabase secrets set SUPABASE_URL=https://your-project.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_key
```

---

## 7. Testing Checklist

### Critical Path Tests

#### Master Onboarding
- [ ] Can access master application from login screen
- [ ] Can complete all 4 steps of application
- [ ] Portfolio images upload successfully
- [ ] Application appears in owner review list
- [ ] Owner can approve/reject applications
- [ ] Approved applicant becomes master on next login
- [ ] Rejected applicant sees appropriate message

#### Photo Consultation
- [ ] Client can request consultation from home/menu
- [ ] Can select specific master or "any professional"
- [ ] Photos upload successfully (1-5 images)
- [ ] Consultation appears in master/owner review list
- [ ] Master can view photos and details
- [ ] Master can submit professional response
- [ ] All fields save correctly (is_doable, notes, estimates)
- [ ] Can close consultation after responding

#### No-Show Protection
- [ ] Confirmation email sends 24 hours before appointment
- [ ] Email contains working confirmation link
- [ ] Client can confirm via link or in-app
- [ ] If client confirms + no-shows → fee charged
- [ ] If client never confirms → no fee, cancelled
- [ ] Payment records created correctly
- [ ] Appointment status updates correctly

#### Timezone/Currency
- [ ] Masters can set timezone in profile
- [ ] Masters can set currency in profile
- [ ] Appointments display in viewer's local timezone
- [ ] Currency symbols display correctly (€, $, £, etc.)
- [ ] Database stores all times in UTC

### UI/UX Tests
- [ ] All new screens have consistent design
- [ ] Loading states work correctly
- [ ] Error messages are helpful
- [ ] Form validation works
- [ ] Image upload shows progress/indicators
- [ ] Filter/sort works on lists
- [ ] Back navigation works correctly

### Database Tests
- [ ] All new tables created successfully
- [ ] RLS policies applied correctly
- [ ] Foreign key relationships work
- [ ] Indexes created for performance
- [ ] Triggers working (updated_at)

### Integration Tests
- [ ] Supabase Storage buckets exist for:
  - master-portfolios
  - consultation-photos
- [ ] Edge functions deploy without errors
- [ ] Environment variables set correctly
- [ ] Email sending configured (Resend)
- [ ] Stripe integration working

---

## Quick Reference: Where to Find Everything

### Screens
| Feature | Screen Path | Navigation Route |
|---------|-------------|------------------|
| Apply as Master | `src/screens/auth/MasterApplicationScreen.tsx` | AuthStack → MasterApplication |
| Review Applications | `src/screens/owner/MasterApplicationReviewScreen.tsx` | OwnerTabs → DashboardStack → MasterApplications |
| Photo Consultation (Client) | `src/screens/client/PhotoConsultationRequestScreen.tsx` | ClientTabs → HomeStack → PhotoConsultationRequest |
| Photo Consultation (Master) | `src/screens/master/PhotoConsultationReviewScreen.tsx` | MasterTabs → DashboardStack → PhotoConsultations |

### Database
- **Migrations**: `supabase/migrations/20260202_global_features.sql`
- **Types**: `src/types/database.ts` (MasterApplication, PhotoConsultation)

### Edge Functions
- **Confirmation Sender**: `supabase/functions/send-confirmation-request/index.ts`
- **No-Show Handler**: `supabase/functions/handle-no-show-enhanced/index.ts`

### Utilities
- **Timezone/Currency**: `src/utils/timezone.ts`

---

## Known Issues / TODOs

1. **Need to add buttons/menu items** to access new screens:
   - "Apply as Master" button on Login screen
   - "Master Applications" menu item for owner
   - "Photo Consultation" button for clients
   - "Photo Consultations" menu item for masters

2. **Email notifications** need to be configured:
   - Set up Resend account
   - Add RESEND_API_KEY to Supabase secrets
   - Verify email templates

3. **Cron job** needed to automate confirmation requests:
   - Should run every hour
   - Find appointments 24 hours from now
   - Trigger `send-confirmation-request` for each

4. **Client-side photo consultation view** needs to be built:
   - Screen to view professional's response
   - Option to book appointment from consultation

5. **Currency conversion** not yet implemented:
   - Currently shows prices in master's currency
   - Should convert to client's currency with exchange rate

---

## Support

If you encounter issues:
1. Check Supabase Logs (Database → Logs)
2. Check Edge Function Logs (Edge Functions → Logs)
3. Verify RLS policies are correct
4. Confirm all environment variables are set
5. Check browser console / React Native logs for errors

For questions about feature behavior, refer to the client's requirements or the original feature description document.
