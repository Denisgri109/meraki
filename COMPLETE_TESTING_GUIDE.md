# Merakí Master Application - Complete Testing Guide

## 🎉 What We've Built

### 1. Global Master Application System
- ✅ 4-step application wizard (Basic Info → Professional → Location → Portfolio)
- ✅ Email verification with 6-digit code (user NOT automatically logged in)
- ✅ Portfolio image upload (up to 10 images)
- ✅ Timezone, currency, and location support
- ✅ Duplicate application prevention

### 2. Owner Review System
- ✅ MasterApplicationReviewScreen for owners
- ✅ Filter by status (pending, under_review, approved, rejected, all)
- ✅ Approve/Reject with optional messages
- ✅ Automatic role upgrade: client → master on approval
- ✅ Email notifications sent on decision
- ✅ Menu item in Owner Dashboard

### 3. Email Notification System
- ✅ Approval email with welcome message
- ✅ Rejection email with reason
- ✅ Beautiful HTML templates with Merakí branding
- ✅ Resend SMTP integration

### 4. No-Show Protection System
- ✅ Confirmation request email 24h before appointment
- ✅ No-show fee only charged if client confirmed
- ✅ Edge functions for automation

## 📋 Testing Steps

### Test 1: Complete Master Application Flow

**Step 1: Navigate to Application**
1. Go to Login screen
2. Tap "Apply as Master" button
3. You should see Step 1: Basic Information

**Step 2: Fill Step 1 - Basic Info**
- Full Name: Test Master
- Email: testmaster2024@example.com (use a fresh email)
- Phone: +1234567890
- Password: TestPass123!
- Confirm Password: TestPass123!
- Tap "Continue"

**Step 3: Email Verification**
- You should see the verification screen with 6 input boxes
- Check your email for the 6-digit code
- Enter the code
- Tap "Verify Email"
- ✅ SUCCESS: You should NOT be logged in, but see "Success" alert
- Tap "Continue" to proceed to Step 2

**Step 4: Fill Step 2 - Professional**
- Years of Experience: 5
- Bio: Experienced nail technician specializing in gel and acrylic nails.
- Specialties: Select "Nail Extensions", "Gel Polish", "Nail Art"
- Tap "Continue"

**Step 5: Fill Step 3 - Location**
- Country: United States
- City: New York
- Timezone: America/New_York (EST/EDT)
- Service Radius: 10 km
- Currency: USD ($)
- Tap "Continue"

**Step 6: Fill Step 4 - Portfolio**
- Tap "+ Add Portfolio Images"
- Select 3-5 images from your gallery
- View images in the grid
- Tap "Submit Application"

**Step 7: Success**
- You should see: "Application Submitted! 📧"
- Message explains next steps
- Tap "Go to Login"

**Expected Result:**
- You're back at login screen (NOT logged in)
- Account was created as CLIENT role
- Application is pending review

### Test 2: Owner Reviews Application

**Step 1: Login as Owner**
1. Login with owner credentials
2. Go to Owner Dashboard
3. Tap "Applications" button (Business Management section)

**Step 2: View Application**
- You should see the test application from Step 1
- Status: "pending"
- Tap on the application to expand details
- Review all information: name, email, experience, specialties, location, portfolio images

**Step 3: Approve Application**
1. Tap "Approve" button
2. Enter optional welcome message: "Welcome to Merakí! We're excited to have you on board."
3. Tap "Approve"

**Step 4: Verify Approval**
- Alert: "Application Approved! 🎉"
- Application list refreshes
- Status now shows "approved"

**Expected Result:**
- Approval email sent to testmaster2024@example.com
- User's profile updated to role='master', is_master=true

### Test 3: Approved User Logs In as Master

**Step 1: Login as Approved Master**
1. Go to Login screen
2. Enter: testmaster2024@example.com / TestPass123!
3. Tap "Sign In"

**Step 2: Verify Master Dashboard**
- You should be redirected to MasterTabs (not ClientTabs!)
- See Master dashboard with schedule, earnings, etc.
- Profile shows "Master" badge

**Expected Result:**
- Role-based routing works correctly
- User is now a Master with full master features

### Test 4: Rejection Flow (Optional)

**Step 1: Create Another Application**
- Repeat Test 1 with a different email: testmaster2024_2@example.com

**Step 2: Owner Rejects**
1. Login as owner
2. Go to Applications
3. Find the new application
4. Tap "Reject"
5. Enter reason: "We need more experienced masters at this time."
6. Tap "Reject"

**Step 3: User Tries to Login**
1. Login with testmaster2024_2@example.com
2. You should see Client dashboard (NOT Master)

**Expected Result:**
- Rejection email sent
- User remains as client
- Can reapply in the future

## 🔧 Troubleshooting

### Email Verification Issues
**Problem:** Code not received
- Check spam/junk folder
- Wait 60 seconds and tap "Resend Code"
- Verify email address is correct

**Problem:** Verification code doesn't work
- Make sure you entered all 6 digits
- Code expires after some time - request new one
- Check for typos

### Application Submission Issues
**Problem:** "Application Already Pending" error
- You already have an application with this email
- Wait for owner decision or use different email

**Problem:** Portfolio images not uploading
- Check internet connection
- Images must be under 10MB each
- Try with fewer images (3-5 instead of 10)

### Owner Can't See Applications
**Problem:** Applications list is empty
- Check filter is set to "pending" or "all"
- Pull down to refresh
- Verify applications exist in database

**Problem:** Can't approve/reject
- Check you have owner role (role='owner')
- Verify network connection
- Check Supabase RLS policies

### User Not Becoming Master After Approval
**Problem:** Still seeing Client dashboard after approval
- Logout and login again
- Check profile.role in database (should be 'master')
- Clear app cache and restart

## 📝 Database Schema

### master_applications table
```sql
- id: uuid (primary key)
- email: text
- full_name: text
- phone: text
- bio: text
- years_of_experience: integer
- specialties: text[]
- portfolio_urls: text[]
- country_code: text
- city: text
- timezone: text
- service_radius_km: integer
- currency_code: text
- status: text (pending/under_review/approved/rejected)
- profile_id: uuid (references profiles)
- rejection_reason: text
- created_at: timestamp
- reviewed_at: timestamp
```

### profiles table (updated fields)
```sql
- role: text (client/master/owner)
- is_master: boolean
- is_verified: boolean
- country_code: text
- timezone: text
- currency_code: text
- service_radius_km: integer
- years_of_experience: integer
- specialties: text[]
```

## 🚀 Environment Variables

Make sure these are set in Supabase Edge Functions:

```
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxx
PROJECT_URL=https://bkxdsxnxrtcqnkdcdist.supabase.co
STRIPE_SECRET_KEY=sk_live_xxxxxxxxxxxxx (for no-show function)
SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## 📊 Features Summary

### What Works ✅
- 4-step master application with email verification
- Portfolio image upload (up to 10 images)
- Owner review and approval/rejection
- Email notifications (approval/rejection)
- Automatic role upgrade on approval
- No-show protection with confirmation emails
- Photo consultation feature
- Duplicate application prevention

### Storage Buckets
- `master-portfolios` - stores portfolio images
- `consultation-photos` - stores consultation photos

### Edge Functions
- `send-master-approval-email` - sends approval notification
- `send-master-rejection-email` - sends rejection notification
- `send-confirmation-request` - sends appointment reminders
- `handle-no-show-enhanced` - processes no-show fees

## 🎯 Next Steps (Future Enhancements)

Optional improvements for later:
- [ ] Push notifications for approval/rejection
- [ ] Application status tracking for users
- [ ] Master statistics dashboard for owners
- [ ] Automated follow-up emails
- [ ] Bulk approval/rejection for owners
- [ ] Application expiration (auto-reject after X days)

## 📞 Support

If you encounter issues:
1. Check this troubleshooting guide
2. Review Supabase logs (Auth, Database, Edge Functions)
3. Verify environment variables are set
4. Check browser console for errors
5. Test with fresh email addresses

---

**All core features are implemented and ready for testing! 🎉**
