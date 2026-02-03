# 🧪 COMPREHENSIVE TEST PLAN - Merakí App New Features

> **Status:** All systems ready for testing ✅

---

## 📊 System Verification Results

### ✅ Database Schema - VERIFIED
- ✅ `master_applications` table created with all fields
- ✅ `photo_consultations` table enhanced with all new columns
- ✅ `appointments` table has confirmation tracking fields
- ✅ `profiles` table has global marketplace fields
- ✅ `products` table has shipping fields
- ✅ `orders` table has international shipping fields

### ✅ Edge Functions - VERIFIED
- ✅ `send-confirmation-request` v3 - ACTIVE
- ✅ `handle-no-show-enhanced` v3 - ACTIVE
- ✅ All 14 functions deployed and running

### ✅ Environment Variables - READY
- ✅ RESEND_API_KEY configured
- ✅ SERVICE_ROLE_KEY configured
- ✅ PROJECT_URL configured

---

## 🧪 TEST SCENARIOS

### TEST 1: 🌍 Master Application System

#### Test 1A: Submit Master Application
**Steps:**
1. Log out if currently logged in
2. Go to Login screen
3. Tap "Apply as Master" button *(you need to add this button)*
4. Fill the 4-step form:
   - Step 1: Name, Email, Password, Phone
   - Step 2: Experience, Bio, Specialties
   - Step 3: Country, City, Timezone, Service Radius
   - Step 4: Currency, Upload 2-3 portfolio photos
5. Submit application

**Expected Results:**
- ✅ Success message: "Application Submitted!"
- ✅ User created in auth with role 'pending_master'
- ✅ Record created in `master_applications` table
- ✅ Status = 'pending'

**Verify in Database:**
```sql
SELECT id, email, full_name, status, country_code, currency_code 
FROM master_applications 
ORDER BY created_at DESC 
LIMIT 1;
```

---

#### Test 1B: Owner Reviews Application
**Steps:**
1. Log in as owner
2. Navigate to "Master Applications" *(add menu item)*
3. View the pending application
4. Tap to review - status should change to 'under_review'
5. Review portfolio photos and details
6. Click "Approve"

**Expected Results:**
- ✅ Application status = 'approved'
- ✅ User profile updated: role = 'master', is_master = true
- ✅ Applicant can now log in as master

**Verify in Database:**
```sql
-- Check application status
SELECT status, reviewed_at, reviewed_by 
FROM master_applications 
WHERE email = 'applicant_email';

-- Check user role
SELECT role, is_master 
FROM profiles 
WHERE email = 'applicant_email';
```

---

### TEST 2: 📸 Photo Consultation Feature

#### Test 2A: Client Requests Consultation
**Steps:**
1. Log in as client
2. Go to Home → "Photo Consultation" *(add button)*
3. Select a master or "Any Professional"
4. Fill form:
   - Title: "Can I get volume lashes?"
   - Description: "I have short natural lashes, want volume set"
   - Service Type: "Eyelash Extensions"
   - Upload 2-3 photos
5. Submit

**Expected Results:**
- ✅ Success message
- ✅ Record created in `photo_consultations`
- ✅ Status = 'pending'

**Verify in Database:**
```sql
SELECT id, client_id, master_id, title, status, photo_urls 
FROM photo_consultations 
ORDER BY created_at DESC 
LIMIT 1;
```

---

#### Test 2B: Master Responds to Consultation
**Steps:**
1. Log in as master (or owner)
2. Go to Dashboard → "Photo Consultations" *(add menu item)*
3. See the pending consultation
4. Tap to review - status changes to 'in_review'
5. View client photos
6. Fill response:
   - Is it doable? ✅ Yes
   - Professional Notes: "Yes, volume lashes are possible..."
   - Recommendations: "I recommend 3D volume for natural look"
   - Est. Price: "€60-80"
   - Est. Duration: "2 hours"
7. Submit response

**Expected Results:**
- ✅ Status = 'responded'
- ✅ Response fields saved
- ✅ Client can view response *(need to build view screen)*

**Verify in Database:**
```sql
SELECT status, is_doable, professional_notes, recommendations, 
       estimated_price_range, estimated_duration, responded_at
FROM photo_consultations 
WHERE id = 'consultation_id';
```

---

### TEST 3: 🛡️ No-Show Protection System

#### Test 3A: Confirmation Email Sent
**Prerequisites:**
- Need an appointment booked 24+ hours in the future
- Appointment status = 'confirmed'
- Client has email address

**Steps:**
1. Book an appointment as client (at least 24 hours ahead)
2. Wait for 24 hours before appointment, OR manually trigger the edge function
3. Check client's email inbox

**Manual Trigger (for testing):**
```bash
curl -X POST https://bkxdsxnxrtcqnkdcdist.supabase.co/functions/v1/send-confirmation-request \
  -H "Content-Type: application/json" \
  -d '{"appointment_id": "your-appointment-uuid"}'
```

**Expected Results:**
- ✅ Email received with subject "Action Required: Confirm Your Appointment"
- ✅ Email contains:
  - Appointment details (service, date, time, master)
  - "Confirm Attendance" button
  - Warning about no-show fee
- ✅ Database updated:
  - `confirmation_sent_at` = current timestamp
  - `confirmation_deadline` = 6 hours before appointment
  - `client_confirmed` = NULL

**Verify in Database:**
```sql
SELECT confirmation_sent_at, confirmation_deadline, client_confirmed, confirmation_reminder_count
FROM appointments 
WHERE id = 'appointment_id';
```

---

#### Test 3B: Client Confirms via Email
**Steps:**
1. Client clicks "Confirm Attendance" button in email
2. Opens confirmation page
3. Clicks "I confirm I will attend"

**Expected Results:**
- ✅ Success page shown
- ✅ Database updated: `client_confirmed` = TRUE

**Verify:**
```sql
SELECT client_confirmed 
FROM appointments 
WHERE id = 'appointment_id';
```

---

#### Test 3C: Client Confirms + No-Show = Fee Charged
**Prerequisites:**
- Client confirmed attendance (client_confirmed = TRUE)
- Appointment time has passed
- Client didn't show up

**Steps:**
1. Master marks appointment as "No Show"
2. System calls `handle-no-show-enhanced` edge function

**Expected Results:**
- ✅ Payment captured via Stripe
- ✅ Appointment status = 'no_show'
- ✅ Payment record created with type = 'no_show_fee'
- ✅ Full amount charged (as client confirmed)

**Verify:**
```sql
-- Check appointment status
SELECT status, client_confirmed 
FROM appointments 
WHERE id = 'appointment_id';

-- Check payment record
SELECT amount, type, status 
FROM payments 
WHERE appointment_id = 'appointment_id';
```

---

#### Test 3D: Client Never Confirms = No Fee
**Prerequisites:**
- Client never confirmed (client_confirmed = NULL or FALSE)
- Appointment time has passed

**Steps:**
1. Master marks appointment as "No Show" or cancels
2. System calls `handle-no-show-enhanced` edge function

**Expected Results:**
- ✅ Payment intent cancelled (not captured)
- ✅ Appointment status = 'cancelled'
- ✅ No fee charged
- ✅ Reason logged: "client_never_confirmed"

**Verify:**
```sql
SELECT status, client_confirmed 
FROM appointments 
WHERE id = 'appointment_id';
```

---

### TEST 4: 🌐 Timezone & Currency

#### Test 4A: Master Sets Timezone & Currency
**Steps:**
1. Log in as master
2. Go to Profile settings
3. Set:
   - Timezone: "America/New_York"
   - Currency: "USD"
   - Country: "US"
   - City: "New York"
4. Save

**Verify:**
```sql
SELECT timezone, currency_code, country_code, city 
FROM profiles 
WHERE id = 'master_id';
```

---

#### Test 4B: Timezone Display
**Steps:**
1. Create appointments with different masters in different timezones
2. View appointments as client in different timezone

**Expected:**
- ✅ Times displayed in viewer's local timezone
- ✅ Database stores all times in UTC

---

#### Test 4C: Currency Display
**Steps:**
1. Set master currency to "GBP"
2. View master's services as client

**Expected:**
- ✅ Prices shown with £ symbol
- ✅ Master's base price displayed

---

## 🔍 QUICK VERIFICATION COMMANDS

### Check All New Tables Exist:
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('master_applications', 'photo_consultations');
```

### Check Edge Functions:
Check in Supabase Dashboard:
- Edge Functions → All functions should show "Active"
- Versions should be v3 for new functions

### Test Edge Function Endpoint:
```bash
# Test confirmation function (should return error without auth, but not crash)
curl -X POST https://bkxdsxnxrtcqnkdcdist.supabase.co/functions/v1/send-confirmation-request \
  -H "Content-Type: application/json" \
  -d '{"appointment_id": "test"}'

# Should return: {"error":"Missing appointment_id"} or auth error (not 500)
```

---

## 🚨 TROUBLESHOOTING

### If Tests Fail:

**1. Edge Function Not Working:**
- Check Supabase Dashboard → Edge Functions → Logs
- Verify secrets are set correctly (RESEND_API_KEY, SERVICE_ROLE_KEY, PROJECT_URL)
- Check function is deployed (version should be 3)

**2. Database Issues:**
- Check RLS policies are enabled
- Verify user has correct role
- Check foreign key constraints

**3. Email Not Sending:**
- Verify RESEND_API_KEY is valid
- Check Resend dashboard for email logs
- Ensure from address is verified in Resend

**4. Photos Not Uploading:**
- Check storage buckets exist: `master-portfolios`, `consultation-photos`
- Verify RLS policies on storage buckets
- Check file size limits

---

## ✅ SUCCESS CRITERIA

All tests pass when:
- ✅ Master can apply and be approved
- ✅ Client can request photo consultation
- ✅ Master can respond to consultation
- ✅ Confirmation emails send automatically
- ✅ No-show fee charges correctly when confirmed
- ✅ No fee when client never confirms
- ✅ Timezones convert correctly
- ✅ Currencies display correctly

---

## 📝 NEXT STEPS AFTER TESTING

Once all tests pass:
1. Add UI buttons to access new features
2. Set up cron job for automatic confirmation emails
3. Build client-side consultation response viewer
4. Add currency conversion for international clients
5. Deploy to production!

---

**Happy Testing! 🚀**

*Last Updated: 2026-02-02*
