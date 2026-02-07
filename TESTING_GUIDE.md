# Flexible Booking & No-Show Flow - Testing Guide

This guide will walk you through testing every aspect of the Flexible Booking & No-Show Flow implementation.

**Last Updated:** 2026-02-04  
**Status:** Database migration complete, ready for testing

---

## 📋 Pre-Testing Checklist

Before you begin testing, ensure:

- [ ] Database migration applied (I just ran this for you)
- [ ] Edge Functions deployed (you have existing ones, need new ones)
- [ ] Mobile app updated with new UI components
- [ ] Stripe test mode enabled
- [ ] Test master account created
- [ ] Test service created
- [ ] Test client account ready

---

## 🎯 Quick Reference: What Was Implemented

### Database Changes (✅ Applied)
- 6 new columns in `appointments` table
- 5 new columns in `appointment_confirmations` table
- 1 new table `notification_logs`
- 9 new database functions
- Performance indexes added

### New Database Functions
1. `book_appointment_with_confirmation()` - Creates appointment with card hold
2. `client_confirm_appointment()` - Handles YES/NO responses
3. `process_no_show_charge()` - Charges no-show fee
4. `client_arrived_late()` - Marks late arrival (no charge)
5. `calculate_confirmation_deadline()` - Calculates 24h deadline
6. `calculate_grace_period()` - Calculates 50% of duration
7. `get_appointments_needing_confirmation_reminder()` - For cron jobs
8. `get_appointments_for_auto_cancel()` - For cron jobs
9. `auto_cancel_appointment()` - Auto-cancels unconfirmed

### UI Components (Need to deploy)
- `AppointmentConfirmationScreen` - Client confirmation UI
- `NoShowActionButton` - Master no-show modal
- Updated `MasterAppointmentsScreen` - Status badges
- Updated `BookingConfirmScreen` - New booking flow

---

## Phase 1: Database Verification (5 minutes)

### Step 1.1: Verify Database Migration

Run these queries in Supabase SQL Editor:

```sql
-- Check new columns in appointments table
SELECT column_name, data_type
FROM information_schema.columns 
WHERE table_name = 'appointments' 
AND column_name IN (
  'status_updated_at', 
  'stripe_setup_intent_id', 
  'requires_confirmation', 
  'service_duration_minutes', 
  'no_show_charge_amount', 
  'no_show_processed_at'
)
ORDER BY ordinal_position;
```

**Expected Result:** 6 rows returned

```sql
-- Check new columns in appointment_confirmations
SELECT column_name, data_type
FROM information_schema.columns 
WHERE table_name = 'appointment_confirmations' 
AND column_name IN (
  'response_type', 
  'no_show_charge_captured', 
  'grace_period_ends_at', 
  'client_arrived_at', 
  'client_arrived_late'
)
ORDER BY ordinal_position;
```

**Expected Result:** 5 rows returned

```sql
-- Check notification_logs table exists
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'notification_logs';
```

**Expected Result:** 1 row returned

```sql
-- Check all new functions exist
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public'
AND routine_name IN (
  'book_appointment_with_confirmation',
  'client_confirm_appointment',
  'process_no_show_charge',
  'client_arrived_late',
  'calculate_confirmation_deadline',
  'calculate_grace_period',
  'auto_cancel_appointment'
)
ORDER BY routine_name;
```

**Expected Result:** 7 rows returned

### Step 1.2: Test Helper Functions

```sql
-- Test grace period calculation
SELECT calculate_grace_period(60, 0.5) as grace_60min;
SELECT calculate_grace_period(45, 0.5) as grace_45min;
SELECT calculate_grace_period(90, 0.5) as grace_90min;
```

**Expected Results:**
- 60 min → 30 minutes
- 45 min → 23 minutes (rounded)
- 90 min → 45 minutes

```sql
-- Test confirmation deadline calculation
SELECT calculate_confirmation_deadline(
  NOW() + INTERVAL '48 hours',  -- Appointment time
  24,                            -- Send reminder 24h before
  24                             -- 24h to respond
) as deadline;
```

**Expected Result:** Timestamp approximately 24 hours from now

---

## Phase 2: Setup Test Data (10 minutes)

### Step 2.1: Create Test Master Account

```sql
-- Create test master
INSERT INTO profiles (id, email, full_name, role)
VALUES (
  'test-master-001', 
  'testmaster@example.com', 
  'Test Master', 
  'master'
) ON CONFLICT (id) DO NOTHING;

-- Add master settings
INSERT INTO master_settings (
  master_id, 
  confirmation_timing_hours,
  confirmation_response_timeout_hours,
  no_show_charge_percent,
  late_arrival_minutes,
  grace_period_multiplier,
  terms_and_conditions
) VALUES (
  'test-master-001',
  24,    -- Send reminder 24h before appointment
  24,    -- Client has 24h to respond
  100,   -- 100% no-show charge
  15,    -- 15 min late threshold
  0.5,   -- 50% grace period (e.g., 30 min for 60 min appointment)
  'By confirming this appointment, you agree that if you do not show up or arrive more than 15 minutes late, you will be charged 100% of the service price as a no-show fee.'
) ON CONFLICT (master_id) DO UPDATE SET
  confirmation_timing_hours = 24,
  confirmation_response_timeout_hours = 24,
  no_show_charge_percent = 100,
  late_arrival_minutes = 15,
  grace_period_multiplier = 0.5;
```

### Step 2.2: Create Test Service

```sql
INSERT INTO services (id, master_id, name, base_price, duration_minutes)
VALUES (
  'test-service-001',
  'test-master-001',
  'Test Manicure',
  50.00,
  60
) ON CONFLICT (id) DO NOTHING;
```

### Step 2.3: Verify Setup

```sql
-- Verify master settings
SELECT * FROM master_settings WHERE master_id = 'test-master-001';

-- Verify service
SELECT * FROM services WHERE id = 'test-service-001';
```

---

## Phase 3: Test Booking Flow (15 minutes)

### Step 3.1: Book Appointment as Client

**In your mobile app:**

1. **Login as a client user**
2. **Navigate to:** Services → Test Master → Test Manicure
3. **Select date/time:** Choose a time 48 hours from now
4. **Enter payment details:** Use Stripe test card:
   - Card: `4242 4242 4242 4242`
   - Expiry: Any future date (e.g., 12/25)
   - CVC: Any 3 digits (e.g., 123)
5. **Tap "Book Appointment"**

**Expected Behavior:**
- App shows success message
- Mentions "confirmation request coming soon"
- No immediate charge (only card hold)

### Step 3.2: Verify Appointment Created

```sql
-- Get the most recent appointment
SELECT 
  id,
  status,
  confirmation_deadline,
  stripe_setup_intent_id IS NOT NULL as has_setup_intent,
  stripe_payment_intent_id IS NOT NULL as has_payment_intent,
  requires_confirmation,
  service_duration_minutes,
  payment_hold_amount
FROM appointments 
ORDER BY created_at DESC 
LIMIT 1;
```

**Expected Results:**
- `status`: 'confirmed'
- `confirmation_deadline`: Set to 24h before appointment
- `has_setup_intent`: true
- `has_payment_intent`: true
- `requires_confirmation`: true
- `service_duration_minutes`: 60
- `payment_hold_amount`: 50.00

### Step 3.3: Verify Confirmation Record

```sql
-- Check confirmation record
SELECT 
  appointment_id,
  confirmed,
  response_type,
  created_at
FROM appointment_confirmations
ORDER BY created_at DESC
LIMIT 1;
```

**Expected Results:**
- `confirmed`: null (awaiting response)
- `response_type`: null

### Step 3.4: Check Stripe Dashboard

1. **Login to Stripe Dashboard** (test mode)
2. **Go to:** Payments
3. **Verify:**
   - SetupIntent created (status: succeeded)
   - PaymentIntent created (status: requires_capture)
   - Amount: €50.00

---

## Phase 4: Test Confirmation Reminder (10 minutes)

### Step 4.1: Manually Trigger Reminder

Since we can't wait 24 hours, manually trigger the reminder:

**Option A: Using Supabase Dashboard**
1. Go to **Edge Functions**
2. Find **"send-confirmation-request"**
3. Click **"Invoke"**
4. Pass this JSON body:
```json
{
  "appointment_id": "YOUR_APPOINTMENT_ID"
}
```

**Option B: Using curl**
```bash
curl -X POST https://bkxdsxnxrtcqnkdcdist.supabase.co/functions/v1/send-confirmation-request \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "appointment_id": "YOUR_APPOINTMENT_ID"
  }'
```

### Step 4.2: Verify Reminder Sent

```sql
-- Check reminder was recorded
SELECT 
  confirmation_reminder_sent_at,
  confirmation_deadline
FROM appointments 
WHERE id = 'YOUR_APPOINTMENT_ID';
```

**Expected:** `confirmation_reminder_sent_at` should be populated with current timestamp

```sql
-- Check notification log
SELECT 
  notification_type,
  channel,
  status,
  created_at
FROM notification_logs 
WHERE appointment_id = 'YOUR_APPOINTMENT_ID'
ORDER BY created_at DESC;
```

**Expected:** 2 rows (1 push, 1 email) with status = 'sent'

### Step 4.3: Client Receives Notification

**In your mobile app (as client):**

1. **Check for push notification**
   - Title: "Confirm Your Appointment"
   - Body: "Your appointment with Test Master is on [Date] at [Time]. Please confirm."

2. **Tap the notification**
   - Should open `AppointmentConfirmationScreen`

3. **Verify screen shows:**
   - Service: Test Manicure
   - Master: Test Master
   - Date & Time
   - Confirmation deadline
   - No-show policy (100% charge)
   - Terms & Conditions
   - YES and NO buttons

---

## Phase 5: Test Client Confirmation (10 minutes)

### Step 5.1: Client Confirms (YES)

**In your mobile app (as client):**

1. **On AppointmentConfirmationScreen**
2. **Tap "✅ YES, I'll Be There"**
3. **Confirm in dialog**

**Expected Behavior:**
- Success message: "Appointment confirmed!"
- Redirects to home or appointments list

### Step 5.2: Verify Confirmation Recorded

```sql
-- Check confirmation
SELECT 
  a.status,
  ac.confirmed,
  ac.response_type,
  ac.responded_at,
  ac.confirmed_at
FROM appointments a
LEFT JOIN appointment_confirmations ac ON a.id = ac.appointment_id
WHERE a.id = 'YOUR_APPOINTMENT_ID';
```

**Expected Results:**
- `status`: 'confirmed'
- `confirmed`: true
- `response_type`: 'yes'
- `responded_at`: Timestamp
- `confirmed_at`: Timestamp

### Step 5.3: Verify Master Notification

**Check master received notification:**

```sql
-- Check notification logs for master
SELECT 
  notification_type,
  channel,
  status
FROM notification_logs 
WHERE appointment_id = 'YOUR_APPOINTMENT_ID'
  AND notification_type = 'confirmation_yes'
ORDER BY created_at DESC;
```

**In your mobile app (as master):**

1. **Open Master AppointmentsScreen**
2. **Find the appointment**
3. **Should see:**
   - 🟢 Green badge: "✅ Confirmed & Protected"
   - Text: "No-show protection active"

---

## Phase 6: Test No-Show Flow (15 minutes)

### Step 6.1: Create Test Appointment for No-Show

Create another appointment (repeat Phase 3 & 5) and confirm it.

Note down the appointment ID: `NO_SHOW_TEST_ID`

### Step 6.2: Simulate Appointment Time Passed

```sql
-- Make appointment time "past" (30 minutes ago)
UPDATE appointments 
SET start_time = NOW() - INTERVAL '30 minutes',
    end_time = NOW() - INTERVAL '15 minutes'
WHERE id = 'NO_SHOW_TEST_ID';
```

### Step 6.3: Master Opens No-Show Modal

**In your mobile app (as master):**

1. **Go to Master AppointmentsScreen**
2. **Find the test appointment** (should show time in red/past)
3. **Tap "⚠️ No-Show / Late" button**
4. **Modal opens**

**Verify Modal Shows:**
- Client name
- Service name (Test Manicure)
- No-show policy: 100% charge (€50.00)
- Three options:
  1. 💰 Charge No-Show Fee Now
  2. ⏰ Wait 30 Minutes (grace period)
  3. ✅ Client Arrived (Late)

### Step 6.4: Test "Charge Now" Option

1. **Select "💰 Charge No-Show Fee Now"**
2. **Tap "Confirm Action"**

**Expected Behavior:**
- Processing indicator
- Success alert: "€50.00 has been charged"

### Step 6.5: Verify No-Show Charge

```sql
-- Check no-show recorded
SELECT 
  status,
  no_show_charge_amount,
  no_show_processed_at
FROM appointments 
WHERE id = 'NO_SHOW_TEST_ID';
```

**Expected Results:**
- `status`: 'no_show'
- `no_show_charge_amount`: 50.00
- `no_show_processed_at`: Current timestamp

```sql
-- Check confirmation record
SELECT 
  no_show_charge_captured,
  grace_period_ends_at
FROM appointment_confirmations
WHERE appointment_id = 'NO_SHOW_TEST_ID';
```

**Expected Results:**
- `no_show_charge_captured`: true
- `grace_period_ends_at`: null (immediate charge)

### Step 6.6: Check Stripe Dashboard

1. **Go to Stripe Dashboard** (test mode)
2. **Go to:** Payments
3. **Find the charge:**
   - Should show successful charge for €50.00
   - Description: "No-show fee for Test Manicure"
   - Status: Succeeded

---

## Phase 7: Test Grace Period (15 minutes)

### Step 7.1: Create Another Test Appointment

Create another appointment and confirm it (repeat Phase 3 & 5).

Note down the appointment ID: `GRACE_TEST_ID`

### Step 7.2: Simulate Past Appointment

```sql
UPDATE appointments 
SET start_time = NOW() - INTERVAL '15 minutes',
    end_time = NOW() + INTERVAL '15 minutes'
WHERE id = 'GRACE_TEST_ID';
```

### Step 7.3: Master Selects "Wait Grace Period"

**In your mobile app (as master):**

1. **Tap "⚠️ No-Show / Late"**
2. **Select "⏰ Wait 30 Minutes"**
3. **Tap "Confirm Action"**

### Step 7.4: Verify Grace Period Set

```sql
-- Check grace period
SELECT 
  ac.grace_period_ends_at,
  ac.no_show_charge_captured,
  a.status
FROM appointments a
LEFT JOIN appointment_confirmations ac ON a.id = ac.appointment_id
WHERE a.id = 'GRACE_TEST_ID';
```

**Expected Results:**
- `grace_period_ends_at`: 30 minutes from now
- `no_show_charge_captured`: false
- `status`: 'confirmed' (not changed yet)

### Step 7.5: Simulate Grace Period Expired

```sql
-- Set grace period to 1 minute ago
UPDATE appointment_confirmations 
SET grace_period_ends_at = NOW() - INTERVAL '1 minute'
WHERE appointment_id = 'GRACE_TEST_ID';
```

### Step 7.6: Trigger Auto-Charge

Since the auto-charge function doesn't exist yet, we'll simulate it:

```sql
-- Simulate auto-charge by calling the function manually
SELECT * FROM process_no_show_charge('GRACE_TEST_ID', true);
```

### Step 7.7: Verify Auto-Charge

```sql
-- Check charge processed
SELECT 
  status,
  no_show_charge_amount,
  no_show_processed_at
FROM appointments 
WHERE id = 'GRACE_TEST_ID';
```

**Expected Results:**
- `status`: 'no_show'
- `no_show_charge_amount`: 50.00
- `no_show_processed_at`: Current timestamp

---

## Phase 8: Test Client Arrived Late (10 minutes)

### Step 8.1: Create Another Test Appointment

Create another appointment and confirm it.

Note down the appointment ID: `LATE_ARRIVAL_ID`

### Step 8.2: Simulate Past Appointment

```sql
UPDATE appointments 
SET start_time = NOW() - INTERVAL '20 minutes',
    end_time = NOW() - INTERVAL '5 minutes'
WHERE id = 'LATE_ARRIVAL_ID';
```

### Step 8.3: Master Marks as Arrived Late

**In your mobile app (as master):**

1. **Tap "⚠️ No-Show / Late"**
2. **Select "✅ Client Arrived (Late)"**
3. **Tap "Confirm Action"**

### Step 8.4: Verify No Charge

```sql
-- Check no charge applied
SELECT 
  a.status,
  ac.client_arrived_at,
  ac.client_arrived_late,
  ac.no_show_charge_captured
FROM appointments a
LEFT JOIN appointment_confirmations ac ON a.id = ac.appointment_id
WHERE a.id = 'LATE_ARRIVAL_ID';
```

**Expected Results:**
- `status`: 'confirmed' (remains confirmed)
- `client_arrived_at`: Timestamp
- `client_arrived_late`: true
- `no_show_charge_captured`: false

### Step 8.5: Complete Appointment Normally

**In your mobile app (as master):**

1. **Tap "Complete" on the appointment**
2. **Verify:** Appointment marked as completed
3. **Verify:** Payment captured (full €50.00)

---

## Phase 9: Test Auto-Cancel (10 minutes)

### Step 9.1: Create Appointment with Past Deadline

```sql
-- Create appointment where deadline has passed
INSERT INTO appointments (
  client_id,
  master_id,
  service_id,
  start_time,
  end_time,
  price,
  status,
  confirmation_deadline,
  client_confirmed,
  requires_confirmation
)
SELECT 
  'YOUR_CLIENT_ID',  -- Replace with actual client ID
  'test-master-001',
  'test-service-001',
  NOW() + INTERVAL '2 hours',
  NOW() + INTERVAL '3 hours',
  50.00,
  'confirmed',
  NOW() - INTERVAL '1 hour',  -- Deadline 1 hour ago
  false,
  true
RETURNING id;
```

Note down the returned ID: `AUTO_CANCEL_ID`

### Step 9.2: Create Confirmation Record

```sql
INSERT INTO appointment_confirmations (appointment_id, confirmed, created_at)
VALUES ('AUTO_CANCEL_ID', NULL, NOW());
```

### Step 9.3: Trigger Auto-Cancel

**Currently you don't have the auto-cancel Edge Function deployed.**

You can simulate it by running:

```sql
-- Call the database function directly
SELECT * FROM auto_cancel_appointment('AUTO_CANCEL_ID');
```

### Step 9.4: Verify Auto-Cancelled

```sql
-- Check cancelled
SELECT 
  status,
  updated_at
FROM appointments 
WHERE id = 'AUTO_CANCEL_ID';
```

**Expected Results:**
- `status`: 'cancelled'
- `updated_at`: Recent timestamp

```sql
-- Check response recorded
SELECT 
  confirmed,
  response_type,
  responded_at
FROM appointment_confirmations
WHERE appointment_id = 'AUTO_CANCEL_ID';
```

**Expected Results:**
- `confirmed`: false
- `response_type`: 'timeout'
- `responded_at`: Recent timestamp

### Step 9.5: Verify Payment Released

**Check Stripe Dashboard:**
- PaymentIntent should be cancelled
- No charge should appear

---

## Phase 10: Edge Cases & Error Handling (10 minutes)

### Test 10.1: Client Cancels (NO response)

1. Create new appointment
2. Trigger confirmation reminder
3. Client taps "❌ NO, Cancel Appointment"
4. Verify:
   - Status = 'cancelled'
   - response_type = 'no'
   - PaymentIntent cancelled

### Test 10.2: Double Confirmation

1. Client confirms appointment (YES)
2. Try to confirm again
3. Should show: "Already confirmed" state

### Test 10.3: Late Confirmation Attempt

1. Create appointment
2. Set deadline to past
3. Client tries to confirm
4. Should show: "Deadline passed" message

### Test 10.4: Master Settings Validation

```sql
-- Try invalid settings
INSERT INTO master_settings (
  master_id,
  no_show_charge_percent
) VALUES (
  'test-master-002',
  150  -- Invalid: over 100%
);
```

**Expected:** Error or constraint violation

---

## 📊 Testing Summary Checklist

### Database Tests
- [ ] All 6 new columns in appointments table
- [ ] All 5 new columns in appointment_confirmations table
- [ ] notification_logs table created
- [ ] All 9 functions created
- [ ] Helper functions return correct values

### Booking Flow Tests
- [ ] Appointment created with SetupIntent + PaymentIntent
- [ ] confirmation_deadline calculated correctly
- [ ] Confirmation record created with confirmed = null

### Confirmation Tests
- [ ] Reminder sent via push + email
- [ ] Client can view confirmation screen
- [ ] Client can confirm (YES)
- [ ] Client can cancel (NO)
- [ ] Master receives notifications
- [ ] Status badges display correctly

### No-Show Tests
- [ ] No-show modal opens with 3 options
- [ ] "Charge Now" processes immediate charge
- [ ] "Wait Grace Period" sets grace_period_ends_at
- [ ] "Client Arrived" records late arrival (no charge)
- [ ] Stripe charges appear correctly
- [ ] Email receipts sent

### Auto-Cancel Tests
- [ ] Unconfirmed appointments past deadline auto-cancel
- [ ] PaymentIntent cancelled
- [ ] Slot opened up
- [ ] Emails sent to both parties

### Edge Cases
- [ ] Double confirmation prevented
- [ ] Late confirmation blocked
- [ ] Invalid settings rejected

---

## 🐛 Troubleshooting Common Issues

### Issue 1: "Function not found" error
**Fix:** Deploy the database migration again
```bash
supabase db push
```

### Issue 2: "Column does not exist" error
**Fix:** Check if migration was applied
```sql
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'appointments';
```

### Issue 3: Edge Function invocation fails
**Fix:** Check function exists in Supabase dashboard
- Go to Edge Functions
- Verify function is deployed and active

### Issue 4: Stripe charge fails
**Fix:** 
- Verify PaymentIntent status is 'requires_capture'
- Check Stripe dashboard for errors
- Ensure test mode is enabled

### Issue 5: Emails not sending
**Fix:**
- Check RESEND_API_KEY is set
- Verify FROM_EMAIL in Resend dashboard
- Check notification_logs for errors

### Issue 6: Push notifications not arriving
**Fix:**
- Check client has push_token in profiles table
- Verify push notification permissions granted
- Test with Expo push tool

---

## 🎉 Success Criteria

You've successfully tested the Flexible Booking & No-Show Flow when:

✅ **All database tests pass** (11 checks)  
✅ **Created 3+ test appointments**  
✅ **Tested YES and NO confirmations**  
✅ **Processed 1+ no-show charge**  
✅ **Tested grace period flow**  
✅ **Tested auto-cancel**  
✅ **Verified Stripe charges**  
✅ **Verified email notifications**  
✅ **No critical errors** in console  

---

## 🚀 Next Steps After Testing

Once all tests pass:

1. **Deploy updated mobile app** to production
2. **Deploy new Edge Functions** (if not already done)
3. **Set up cron jobs** for automation:
   - Send confirmation reminders (every 15 min)
   - Auto-cancel unconfirmed (every 15 min)
   - Auto-charge grace period (every 5 min)
4. **Monitor** notification_logs table
5. **Train masters** on the new no-show flow

---

## 📞 Need Help?

If you encounter issues:

1. **Check logs:** Supabase Dashboard → Edge Functions → Logs
2. **Check database:** Run verification queries
3. **Check Stripe:** Review failed payments in dashboard
4. **Check emails:** Review notification_logs table

**Happy Testing! 🧪**
