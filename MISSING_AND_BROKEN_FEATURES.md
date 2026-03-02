# Merakí App — Missing & Broken Features Audit

> **Audit Date:** February 23, 2026  
> **Auditor:** Denis  
> **Scope:** Comparison of Ugne's original feature requirements & conversation vs. actual codebase implementation  
> **Note:** This audit is based ONLY on the feature descriptions Ugne provided and our direct conversation — not on internal documentation files.

---

## Ugne's Original Feature List (For Reference)

1. Online Booking & No-Show Protection  
2. Inventory & Stock Management  
3. Product & Supply Orders  
4. Photo Consultation Feature  
5. Loyalty Program (QR scan for points, redeem for rewards)  
6. Merakí Academy (pre-recorded courses, chapters, students send photos & ask questions in real time, instant responses)  
7. Automated Notifications & Reminders (daily aftercare reminders like "wash your lashes") — ✅ FIXED  
8. Multi-Master Booking System  
9. Special Pricing for Masters (discounted product prices)  

**From conversation:** The platform should be **open globally** for masters from other salons/cities/countries to join — meaning timezone support for calendars and international shipping logic for the product store are required.

---

## Table of Contents

1. [Features That Don't Work (Broken/Non-Functional)](#1-features-that-dont-work)
2. [Missing Features](#2-missing-features)
3. [Partially Working Features](#3-partially-working-features)
4. [Global Platform Gaps](#4-global-platform-gaps)
5. [Summary Table](#5-summary-table)

---

## 1. Features That Don't Work

These features have code/UI in the app but are **broken or non-functional**.

### 1.1 Automated Notifications & Reminders — ✅ FIXED (2026-02-23)

**Ugne's requirement:** "The app sends helpful daily notifications to clients, such as aftercare reminders (e.g., washing their lashes)"

**What was broken:**
- The Edge Functions were all fully coded and deployed but the `pg_cron` jobs to trigger them were never deployed (the setup SQL was entirely commented out)

**How it was fixed:**
- Created a secure `invoke_edge_function()` SQL helper that reads the service role key from Supabase Vault (no hardcoded secrets)
- Deployed 7 `pg_cron` scheduled jobs to the production database:
  - `appointment-reminders` — every 15 min (24h + 1h push reminders)
  - `aftercare-reminders` — every hour (aftercare tips after completed appointments)
  - `process-campaigns` — daily at 10 AM UTC (promotion/vacation/announcement broadcasts)
  - `send-confirmation-reminders` — every 15 min (asks clients to confirm upcoming appointments)
  - `auto-cancel-no-response` — every 15 min (cancels + releases Stripe holds for unconfirmed)
  - `auto-charge-grace-period` — every 5 min (charges no-show fees after grace period)
  - `low-stock-alert` — daily at 9 AM UTC (stock threshold notifications)
- Service role key stored securely in Supabase Vault
- Migration file updated: `supabase/migrations/20260204_cron_jobs_setup.sql`

**Status:** All 7 cron jobs are active and verified. Clients now receive automated appointment reminders, aftercare tips, and confirmation requests. Masters' aftercare campaigns are now delivered to clients.

> **📋 How to test this feature:**
>
> **Before testing:** Ensure the migration `supabase/migrations/20260204_cron_jobs_setup.sql` has been applied and the Supabase Vault contains the service role key.
>
> 1. Verify cron jobs are running: In Supabase Dashboard → SQL Editor, run `SELECT * FROM cron.job;` — you should see 7 active jobs
> 2. Create a test appointment for ~24 hours from now → wait 15 min → client should receive a reminder notification
> 3. Mark an appointment as completed → within 1 hour the client should receive an aftercare tip
> 4. Create an aftercare campaign as a master → the next day at 10 AM UTC it will be broadcast

---

### 1.4 Master Onboarding — Skips All Setup (FIXED)

**Related to:** Multi-Master Booking System (new masters joining)

**What was broken:**
- `MasterOnboardingScreen.tsx` showed 5 setup steps (Profile → Services → Availability → Portfolio → Business Settings) but **every action button just called `handleComplete()` directly** instead of navigating to the actual setup screens
- New masters were immediately marked as "onboarded" without completing any setup
- They ended up with empty profiles, no services listed, no availability set

**Fix applied:**
- Updated the onboarding steps to match the intended flow (Profile → Services → Availability → Portfolio → Business Settings).
- Changed the action buttons to navigate to the respective screens in the `MasterApp` stack (`Profile`, `MyServices`, `Availability`, `Portfolio`, `BusinessSettings`) instead of calling `handleComplete()`.
- Masters can now complete their setup before marking themselves as onboarded.

> **📋 How to test this feature:**
>
> 1. Create or invite a new master account
> 2. Log in as the new master — the onboarding screen should appear
> 3. Tap each step (Profile, Services, Availability, Portfolio, Business Settings) — each should navigate to the actual setup screen
> 4. Complete all steps, then tap "Complete Onboarding" — the master should be taken to the main dashboard

---

### ~~1.5 Change Password — Button Does Nothing~~ ✅ FIXED

- ~~The "Change Password" button in `ProfileScreen.tsx` has an empty handler: `onPress={() => {/* Change Password logic */}}`~~
- ~~Tapping it does nothing. Users must go through the "Forgot Password" email flow instead.~~
- **Fixed:** The button now opens a premium-styled Change Password modal (matching the app's Midnight Velvet design with gradient border, gold accents) with two flows:
  1. **Change with current password** — fields for current password, new password, and confirmation. Verifies current password via re-authentication, then updates via `supabase.auth.updateUser()`.
  2. **Forgot Password via Email** — sends a 6-digit OTP verification code to the user's email via `supabase.auth.resetPasswordForEmail()`, then verifies with `supabase.auth.verifyOtp()` and sets the new password. Includes resend functionality.
  - All fields have visibility toggles, validation, and loading states.

> **📋 How to test this feature:**
>
> 1. Log in to any account (client, master, or owner)
> 2. Go to **Menu** → **Profile** → tap **Change Password**
> 3. **Flow A — Change with current password:** Enter current password, new password, and confirm → tap Change → should succeed
> 4. **Flow B — Forgot password:** Tap "Forgot Password?" → enter your email → receive a 6-digit OTP code → enter it → set new password
> 5. Log out and log back in with the new password to confirm it worked

---

### ~~1.6 Chat with Support — Button Does Nothing~~ ✅ FIXED

- ~~The "Chat with Support" option in the Help & Support screen has its handler commented out — tapping does nothing~~
- ~~Contact phone (`+15551234567`) and email (`support@meraki.com`) are placeholder values~~
- **Fixed:** Complete support chat system implemented:
  1. **Owner-configurable support settings** — New `SupportSettingsScreen` (owner-only) lets Ugne set her real support phone number, email address, and a custom auto-reply message. Accessible from Owner Menu → Business Management → Support Settings.
  2. **Dynamic contact details** — The Help & Support page now fetches the owner's configured phone/email from the database instead of using hardcoded placeholder values. If the owner hasn't configured them yet, it shows "Loading…".
  3. **Chat with Support → real conversation** — When a client presses "Chat with Support", the app finds the owner's profile, creates (or reopens) a real conversation, and navigates to the chat screen. The client is chatting directly with the owner.
  4. **Auto-reply message** — When the client sends their first message in a support chat, an automated reply is sent (as if from the owner) within ~1.5 seconds: _"Thank you for reaching out to Merakí Support! 💛 We've received your message and will get back to you within 24–48 business hours."_ The auto-reply is only sent once per hour to avoid spamming. The owner can customize the auto-reply text in Support Settings.
  5. **Owner sees no "Chat with Support" button** — Since the owner IS support, the chat option is hidden on the owner's own Help & Support page (phone/email still shown).
  6. **Database migration** — Added `support_phone`, `support_email`, and `auto_reply_message` columns to `master_settings` table.

> **📋 How to test this feature:**
>
> **Before testing:** Run the migration `supabase/migrations/20260224_support_settings.sql` to add the new columns to `master_settings`.
>
> **Owner flow:**
> 1. Log in as the **owner** account
> 2. Go to **Menu** → **Support Settings** (under Business Management)
> 3. Enter your real phone number and email address
> 4. (Optional) Customize the auto-reply message
> 5. Tap **Save Support Settings**
>
> **Client flow:**
> 1. Log in as a **client** account
> 2. Go to **Menu** → **Help & Support**
> 3. Verify the **phone number** and **email** match what the owner configured
> 4. Tap **Chat with Support** — you should be taken to a chat conversation with the owner
> 5. Send a message — within ~1.5 seconds, an automated reply should appear from the owner
> 6. Send another message — no duplicate auto-reply (it only triggers once per hour)

---

### ~~1.7 Photo Consultation — Double Photo Bug~~ ✅ FIXED

**Ugne's requirement:** "Clients can send photos through the app for consultations"

- ~~`PhotoConsultationRequestScreen.tsx` has a duplicate `setFormData` call (~line 97) that appends selected photos to state **twice**~~
- ~~Every photo the client picks appears doubled in the preview and gets uploaded twice~~
- **Fixed:** Removed the duplicate `setFormData` call in `PhotoConsultationRequestScreen.tsx`. Photos are now appended to the state only once, preventing duplicate uploads and previews.
- The consultation feature otherwise works (photo upload, master review, approval/decline)

> **📋 How to test this feature:**
>
> 1. Log in as a **client**
> 2. Go to a master's profile → tap **Photo Consultation**
> 3. Select 2–3 photos from gallery → verify each photo appears **once** (no duplicates)
> 4. Submit the consultation → master should receive it for review

---

## 2. Missing Features

These features were requested by Ugne but have **zero implementation** in the codebase.

### ~~2.1 Master Management for Ugne (Owner) — NO UI EXISTS~~ ✅ FIXED

**Related to:** Multi-Master Booking System — "also for other beauty masters who join the app and manage their own schedules"

**What was missing:**
- Ugne had **no screens to manage masters** — she couldn't invite new masters, approve applications, view a master list, edit master profiles, or deactivate accounts
- The database tables existed (`pending_masters`, `master_applications`) but there were zero UI screens in the owner section

**How it was fixed:**
- Created **`masterManagementService.ts`** — full CRUD service layer for master operations (fetch, approve, reject, invite, update, deactivate, reactivate)
- Created **`MasterManagementScreen`** — hub screen with 3 tabs (Active Masters / Applications / Invited), summary stat cards, pull-to-refresh
- Created **`MasterApplicationReviewScreen`** — detailed review of individual applications with Profile/Portfolio/Documents tabs, approve with one tap or reject with a reason (matches the design mockups in `stitch_merak_premium_login/master_application_review/`)
- Created **`MasterInviteScreen`** — form to invite new masters by name, email, phone, bio, and commission rate
- Created **`MasterDetailScreen`** — view/edit active master profiles, adjust commission rates, toggle verification badges, deactivate/reactivate accounts
- **Owner Dashboard** updated with a "Masters" button (with pending applications badge count) in the Business Control section
- All 4 screens wired into both the Dashboard and Menu navigation stacks

**Status:** Ugne can now fully manage masters — invite, review applications, approve/reject, edit profiles, and deactivate — all from within the owner dashboard. ✅

> **📋 How to test this feature:**
>
> 1. Log in as the **owner**
> 2. Go to **Dashboard** → tap the **Masters** button (look for a badge if there are pending applications)
> 3. **Active tab:** View current masters, tap one to see/edit their profile, adjust commission rates
> 4. **Applications tab:** Review any pending applications (approve or reject with reason)
> 5. **Invited tab:** Tap **Invite Master** → fill in name, email, phone → send invite
> 6. Verify: invited masters should appear in the Invited tab, and approved ones move to Active

---

### ~~2.2 Real-Time Q&A in Academy — NOT IMPLEMENTED AS DESCRIBED~~ ✅ FIXED

**Ugne's requirement:** "While learning, students can send photos of their work and ask questions in real time, and I can respond instantly."

**What existed before:**
- Students could submit homework photos ✅ (upload photo + notes via `HomeworkScreen`)
- Ugne could review and provide feedback on homework submissions ✅ (via `HomeworkReviewScreen`)
- Students could chat with the instructor from the lesson screen (opens a general chat conversation) ✅

**What was missing:**
- No **in-lesson live Q&A** or real-time back-and-forth while watching a lesson
- The chat was a general chat thread, not lesson-specific or embedded within the learning experience
- No push notification to Ugne when a student asks a question during a lesson

**How it was fixed:**
- Created **`lesson_qa_messages`** database table with full schema: lesson/course/sender references, content, media_url/media_type for photo sharing, is_question/is_pinned flags, parent_message_id for threaded replies, timestamps. RLS policies enforce that only enrolled students and course owners/instructors can read and write. Table added to Supabase realtime publication.
- Created **`LessonQAChat`** component — a real-time, lesson-specific Q&A chat embedded directly in the lesson viewing experience:
  - Real-time Supabase channel subscription (postgres_changes on `lesson_qa_messages`)
  - Photo upload support (camera + gallery) with Supabase Storage
  - Threaded replies (tap any message to reply in-thread)
  - Pin important messages (owner/instructor only)
  - Live indicator showing real-time connection status
  - Push notifications to instructor when student asks a question, and to student when instructor responds
  - Message bubbles distinguish between own messages and others
- **`LessonScreen`** updated to embed the Q&A chat with a show/hide toggle and live indicator, so students ask questions directly within the lesson they're watching
- Created **`LessonQAInboxScreen`** — owner's inbox view showing all Q&A threads across all lessons, grouped by lesson with unanswered question counts and badges
- Created **`LessonQADetailScreen`** — full-screen Q&A view for a specific lesson, allowing the owner to respond to questions
- Added **"Q&A" tab** to the `ManageAcademyScreen` top tab navigator (alongside Courses, Inbox, Students) so Ugne can monitor and respond to student questions from the academy management section
- Wired `LessonQADetail` into the Academy stack navigator

**Status:** Students can now send photos and ask questions in real time directly within lessons, and Ugne receives push notifications and can respond instantly from the Q&A inbox tab in the academy management screen. ✅

> **📋 How to test this feature:**
>
> **Before testing:** Run the migration that creates the `lesson_qa_messages` table and enable it in Supabase Realtime.
>
> **Student flow:**
> 1. Log in as a **client** enrolled in a course
> 2. Open a lesson → tap the **Q&A** toggle at the bottom
> 3. Type a question or attach a photo → send
> 4. You should see the message appear in real time
>
> **Owner/Instructor flow:**
> 1. Log in as the **owner**
> 2. Go to **Academy** tab → tap the **Q&A** tab at the top
> 3. You should see lessons with unanswered questions and badge counts
> 4. Tap a lesson → view student questions → reply to them
> 5. The student should receive a push notification and see the reply in real time

---

## 3. Partially Working Features

These features are mostly implemented but have **notable gaps**.

### 3.1 Online Booking & No-Show Protection

| Sub-feature | Status |
|---|---|
| Clients book appointments themselves | ✅ Works |
| Ugne can manage/control bookings | ✅ Works |
| Confirmation notification sent before appointment | ✅ Now working (cron deployed 2026-02-23) |
| Client confirms attendance | ✅ Works (if they navigate to it manually) |
| Auto-charge on no-show | ⚠️ Manual only — master must trigger it |
| Cancellation with 24h policy | ✅ Works (>24h free, <24h 50% fee) |
| Rescheduling with approval flow | ✅ Works |

---

### 3.2 Inventory & Stock Management

| Sub-feature | Status |
|---|---|
| Track products and supplies | ✅ Works |
| See how much stock is available | ✅ Works |
| Receive reminders when time to reorder | ✅ Works (low-stock-alert Edge Function) |
| Owner inventory dashboard | ✅ Works |
| Master supplies tracking | ✅ Works |
| Service-supply linking (auto-deduction) | ✅ Works |

**Verdict:** Fully working ✅

---

### 3.3 Product & Supply Orders

| Sub-feature | Status |
|---|---|
| Clients can place orders through the app | ✅ Works |
| Professionals can place orders | ✅ Works |
| Product browsing with categories | ✅ Works |
| Shopping cart | ✅ Works |
| Checkout with Stripe payment | ✅ Works |
| Order history | ✅ Works |
| Shipping address (European countries) | ✅ Works |
| Shipping to non-European countries | ❌ Blocked (see Global Gaps section) |

---

### 3.4 Photo Consultation Feature

| Sub-feature | Status |
|---|---|
| Clients send photos for consultation | ✅ Works |
| Ugne replies with professional advice | ✅ Works |
| Approve/decline/recommend | ✅ Works |
| Pre-booking questionnaire | ✅ Works |
| Consultation waiting screen with status | ✅ Works |

**Verdict:** Working (double-photo bug fixed)

---

### 3.5 Loyalty Program

**Ugne's requirement:** "Loyal clients can scan a code (QR or similar) when they visit me to collect loyalty points, which can later be redeemed for rewards."

| Sub-feature | Status |
|---|---|
| QR code scanning for points | ✅ Works (+50 points per scan) |
| Dynamic QR codes (rotate after scan) | ✅ Works |
| NFC tap alternative | ✅ Works |
| Stamp cards | ✅ Works |
| Rewards catalog | ✅ Works |
| Redeem points for rewards | ✅ Works |

**Note:** Points are ONLY earned through QR/NFC scans. There's no automatic points from bookings or shop purchases — but Ugne only asked for scan-based points, so this matches her requirement.

**Verdict:** Working as described ✅

---

### 3.6 Merakí Academy

| Sub-feature | Status |
|---|---|
| Students can purchase and join courses | ✅ Works (Stripe payment) |
| Lessons are pre-recorded | ✅ Works (video player supports YouTube/Vimeo/Mux/direct) |
| Organized into chapters | ✅ Works |
| Students send photos of work | ✅ Works (homework submission) |
| Students ask questions | ✅ **FIXED** — Real-time in-lesson Q&A with LessonQAChat component |
| Ugne responds instantly | ✅ **FIXED** — Push notifications + Q&A inbox tab in ManageAcademy |
| Progress tracking | ✅ Works |
| Homework review & feedback | ✅ Works |

**Issues:**
- Academy home screen shows **random fake ratings** (`getRandomRating()`) and **random fake durations** (`getRandomDuration()`) — these change every time the screen loads
- Instructor name "Test Owner" is hardcoded to display as "Sarah Mitchell"
- Monthly revenue in student analytics is a fabricated number (`totalRevenue * 0.3`)

---

### 3.7 Multi-Master Booking System

**Ugne's requirement:** "The booking system is not only for me, but also for other beauty masters who join the app and manage their own schedules."

| Sub-feature | Status |
|---|---|
| Multiple masters can exist on platform | ✅ Works |
| Each master manages own schedule | ✅ Works (availability screen) |
| Clients discover and book different masters | ✅ Works |
| Master dashboard with stats | ✅ Works |
| Master earnings tracking | ✅ Works |
| Stripe Connect for master payouts | ✅ Works (blocking gate forces setup) |
| Owner can manage/approve masters | ✅ **FIXED** (see section 2.1) |
| Master onboarding flow | ❌ Broken (see section 1.4) |

---

### 3.8 Special Pricing for Masters

**Ugne's requirement:** "Masters who join the app receive special discounted prices on the products and supplies I sell."

| Sub-feature | Status |
|---|---|
| Dual pricing system (retail/wholesale) | ✅ Works |
| Masters automatically see wholesale prices | ✅ Works |
| Clients see retail prices | ✅ Works |
| Savings display for masters | ✅ Works |

**Verdict:** Fully working ✅

---

## 4. Global Platform Gaps

**From conversation with Ugne:** "I would like it to be open globally for other masters to join the platform, as if someone from other salons joins the app they will get discounts on the products in the app"

Denis flagged two things this requires: **timezone support for calendars** and **international shipping logic for the product store**.

### 4.1 Timezone Support for Calendars

| Sub-feature | Status |
|---|---|
| UTC conversion utilities | ✅ Implemented (`timezone.ts`) |
| Dual timezone display (master's time + client's local time) | ✅ Implemented |
| Auto-detect user timezone | ✅ Implemented (`useAutoLocation` hook) |
| 22 global timezones supported | ✅ Implemented |
| Masters can set their timezone | ✅ Implemented (MasterSettingsScreen) |

**Verdict:** Timezone infrastructure is solid. ✅

**Risk:** Not 100% verified that every single booking/appointment screen uses timezone-aware formatting — but the utility layer is complete and the key screens use it.

---

### 4.2 International Shipping for Product Store

| Sub-feature | Status |
|---|---|
| Shipping to European countries (48 countries) | ✅ Works |
| Zone-based shipping costs (€4.99–€14.99) | ✅ Works |
| Shipping address form | ✅ Works |
| Shipping to non-European countries | ❌ **BLOCKED** |

**What's missing:**
- `shippingUtils.ts` hardcodes 48 European countries only
- The checkout country picker only shows European countries
- A master in the USA, Canada, Australia, Japan, etc. **cannot order products at all**
- There is no shipping rate for non-European destinations
- Ugne said masters globally should get discounted prices on products — but masters outside Europe can't even order

**What this means:** The product store works perfectly within Europe, but the "global masters get discounts on products" part of Ugne's vision doesn't work for non-European masters. They can see the discounted prices but have no way to checkout.

---

### 4.3 Phone Validation — Ireland Only

- `src/utils/validation.ts` only validates Irish phone numbers (+353 format)
- Any international master or client entering a non-Irish phone number gets a validation error
- This blocks global users from properly setting up their profiles

---

### 4.4 No Currency Conversion

- Masters can set their own currency in profile settings ✅
- `formatCurrency()` supports 13 currencies ✅
- **BUT there's no exchange rate service** — if a client books a master who prices in GBP, they pay in GBP
- The shop cart (`CartContext`) has no currency awareness — `getTotal()` just sums prices regardless of currency
- Not necessarily a blocker (many platforms just use the provider's currency), but worth noting for the global vision

---

## 5. Summary Table

### 🔴 NOT WORKING (Broken)

| # | Ugne's Feature | Issue |
|---|---|---|
| 1 | **Automated Notifications & Reminders** | ✅ **FIXED** (2026-02-23) — All 7 cron jobs deployed. Aftercare reminders, appointment reminders, and confirmation requests now fire on schedule. |
| 2 | **No-Show Auto-Charge** | ✅ **FIXED** (2026-02-23) — `auto-charge-grace-period` cron runs every 5 min; `auto-cancel-no-response` runs every 15 min. |
| 3 | **Confirmation Notifications** | ✅ **FIXED** (2026-02-23) — `send-confirmation-reminders` cron runs every 15 min, sending push/email to clients. |
| 4 | ~~**Master Management (Owner)**~~ | ✅ **FIXED** — Full master management UI: MasterManagementScreen (3 tabs), ApplicationReview, Invite, Detail screens. Wired into Owner Dashboard with badge. |
| 5 | **Master Onboarding** | New masters skip all setup — marked as onboarded with empty profiles. |
| 6 | **Master Schedule Screen** | Complete stub — renders header but shows zero data. |

### 🟡 PARTIALLY WORKING

| # | Ugne's Feature | What's Missing |
|---|---|---|
| 7 | ~~**Academy Real-Time Q&A**~~ | ✅ **FIXED** — In-lesson live Q&A with real-time Supabase subscriptions, photo sharing, threaded replies, push notifications, and owner Q&A inbox tab. |
| 8 | **Academy Display** | Fake random ratings, fake durations, hardcoded instructor name ("Sarah Mitchell"). |
| 9 | **International Shipping** | Europe-only — global masters outside Europe can't order products. |
| 10 | **Phone Validation** | Ireland-only (+353) — blocks international user phone numbers. |
| 11 | ~~**Photo Consultation**~~ | ✅ **FIXED** — Double-photo bug resolved. |

### ✅ FULLY WORKING

| # | Ugne's Feature | Status |
|---|---|---|
| 12 | **Online Booking** | Clients can book, Ugne can manage, cancel/reschedule policies work. |
| 13 | **Inventory & Stock Management** | Full tracking, low-stock alerts, service-supply linking. |
| 14 | **Product & Supply Orders** | Shop, cart, checkout, order history all work (within Europe). |
| 15 | **Photo Consultation** | Working end-to-end (minus the double-photo bug). |
| 16 | **Loyalty Program (QR Scan)** | QR scanning, NFC, stamp cards, rewards all work. |
| 17 | **Multi-Master Booking** | Multiple masters with own schedules, Stripe Connect payouts. |
| 18 | **Special Pricing for Masters** | Dual pricing (retail/wholesale) works automatically. |
| 19 | **Timezone Support** | Infrastructure complete for global calendars. |

### Other Broken Items (Not From Ugne's Feature List But Found During Audit)

| # | Feature | Issue |
|---|---|---|
| 20 | ~~**Change Password**~~ | ✅ **FIXED** — Premium modal with change-password + forgot-password OTP flows, re-auth, `verifyOtp`, and `updateUser`. |
| 21 | ~~**Chat with Support**~~ | ✅ **FIXED** — Real support chat with owner, dynamic contact details from DB, auto-reply after first message, owner-configurable settings. |

---

## ~~Quick Win: Deploy Cron Jobs~~ ✅ DONE (2026-02-23)

~~The single highest-impact fix is deploying the `pg_cron` scheduled jobs.~~

**Completed:** All 7 `pg_cron` jobs are now deployed and active. This fixed items **#1, #2, and #3** — covering "Automated Notifications & Reminders", "No-Show Auto-Charge", and "Confirmation Notifications". The `invoke_edge_function()` helper reads the service role key from Supabase Vault for secure authentication.

---

*End of audit — 21 issues identified, based on Ugne's original feature requirements and conversation. 10 issues now fixed.*
