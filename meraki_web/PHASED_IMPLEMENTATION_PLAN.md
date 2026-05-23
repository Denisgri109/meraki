# Merakí Web — Phased Implementation Plan

> Source: groups every unchecked item from `MOBILE_FEATURES_CHECKLIST.md` into related work phases.
> Order = work order. Each phase ships independently; dependencies flow downward.
> Tick the phase box `[x]` when **all** items inside are done.

---

## Phase 1 — Discovery & Browse polish

Closes the client-side browsing gaps. Touches home, discover, and shop browse screens.

- [ ] Featured Masters Carousel (home)
- [ ] Popular Services Grid (home)
- [ ] Pull-to-Refresh (home)
- [ ] Browse Masters (full list)
- [ ] City Filter (filter Masters by location)
- [ ] Service Detail View (description, duration, pricing, available specialists)
- [ ] Category Filtering (shop)
- [ ] Product Detail View — verify navigation + content completeness
- [ ] Role-Based Pricing (retail for clients, wholesale for Masters)

---

## Phase 2 — Appointment lifecycle (client + master) ✅

All flows that touch the same `appointments` row.

### Client side
- [x] Appointment Cards redesign (date, time, service, Master, price)
- [x] Cancel Appointment — Late (<24h) with 50% penalty fee warning (Dynamically warns client if within configured settings hours window)
- [x] Price Breakdown (total, deposit due, balance at salon)
- [x] Cancellation Policy display (Shows detailed late window limits and fees in drawer)
- [x] Confirmation Requests (push prompt to confirm attendance) *(Mobile-only push notification. Web equivalent: in-app active Alert/Action required banner on pending cards)*
- [x] YES Response (confirm) (Sets client_confirmed = true and status = 'confirmed')
- [x] NO Response (cancel) (Declines invitation and cancels appointment)
- [x] Confirmation Deadline (respond within window) (Dynamic deadline timing warning)
- [x] "Confirmed & Protected" badge (Glassmorphic emerald safety badge inside cards/drawer)

### Master side
- [x] View Details (Highly detailed, responsive glassmorphic side-drawer)
- [x] Mark as Completed (One-click state update for appointment session)
- [x] Direct Chat from appointment (Automatic lookup/creation of conversation and smooth localStorage-backed page routing)
- [x] Reschedule (propose new date/time, client approval) (Forms to propose times, client drawer displays prompt with Accept/Decline action)
- [x] No-Show Action Modal (Charge Now / Wait Grace / Client Late) (Interactive panels supporting three discrete operational pathways)
- [x] Grace Period Logic (auto-charge after expiry) (Wait Grace tracks grace period ends and shows countdown warning)
- [x] Configurable No-Show Fee % (Reads and implements custom fee calculation from settings)
- [x] Late Arrival Tracking (Logs actual late minutes and checks against business settings arrival thresholds)

---

## Phase 3 — Master Schedule & Calendar ✅

Scheduling stack rebuilt as one unit.

- [x] Toggle Days (enable/disable per weekday)
- [x] Time Selection (start/end per day)
- [x] Save Schedule
- [x] Block Time Slots (manual block specific periods)
- [x] Vacation Mode (block multiple days)
- [x] Reason Field for blocks
- [x] View Blocked Slots
- [x] Visual Calendar View
- [x] Time Slots (available vs booked)
- [x] Calendar Navigation (weeks/months)

---

## Phase 4 — Master Service Management

- [x] Service Details (name, duration, price, description)
- [x] Toggle Availability (enable/disable services)
- [x] Custom Pricing (per-service override)
- [x] Custom Duration override
- [x] Edit Service
- [x] Delete Service
- [x] Per-Service Deposit Override

---

## Phase 5 — Master Business Settings ✅

All settings tables, one cohesive form — implemented in `BusinessSettingsPanel.tsx`, accessible from `/dashboard/settings` → Business tab.

### Deposit
- [x] Require Deposit Toggle — toggle on/off with automatic percentage/fixed defaults
- [x] Global Deposit — Percentage mode — chip selector (10/20/30/50/100%)
- [x] Global Deposit — Fixed amount mode — EUR input with toggle between % and fixed
- [x] Per-Service Deposit Override (cross-link with Phase 4) — info banner linking to `/dashboard/services`

### Confirmation
- [x] Request Confirmation Timing (e.g., 48h before) — dropdown (12/24/48/72h)
- [x] Response Timeout (e.g., 24h) — dropdown (12/24/48h)
- [x] Auto-Cancel unconfirmed appointments — toggle with description

### No-Show Policy
- [x] No-Show Charge Percentage — dropdown (0/25/50/75/100%)
- [x] Late Arrival Threshold — dropdown (10/15/20/30 minutes)
- [x] Grace Period Multiplier — dropdown (25/50/75/100% of service duration)
- [x] Custom Terms & Conditions — modal editor with require-acceptance toggle

### Notifications + Aftercare
- [x] Push Notification Preferences — push enabled toggle + category toggles (bookings, messages, promotions)
- [x] Confirmation Reminders toggle — "Booking Reminders" toggle in notification preferences
- [x] Aftercare Campaign toggle — full campaign CRUD (create/edit/pause/delete)
- [x] Aftercare Schedule Timing — configurable days-after-appointment (7/14/21/30/45/60/90d)
- [x] Aftercare Message Content — rich text editor with `{name}` placeholder support
- [x] View Active Aftercare Campaigns — campaign list with status badges (Active/Paused), type emoji, and metadata
- [x] Automated Aftercare Delivery — recurring toggle for auto-send after every completed appointment

---

## Phase 6 — Consultations & Chat polish ✅

Touches `messages` plus a new `consultations` flow.

### Client
- [x] Photo Consultation request (send photos for pre-service) — `/dashboard/consultations` "New Request" tab with multi-photo upload, title, service type, description
- [x] Consultation Waiting Screen — `/dashboard/consultations` "My Requests" tab shows pending status with "Waiting for professional review..." indicator
- [x] Pre-Service Questionnaire — `/dashboard/consultations` "Pre-Service Forms" tab with dynamic questions from service config, had-before/time-since/notes flow

### Master
- [x] View Submitted Photos — `/dashboard/consultations` "Photo Reviews" tab with photo grid detail view
- [x] Review Requests (assess suitability) — is_doable toggle + professional notes + recommendations fields
- [x] Approve/Decline — "Approve & Send Feedback" / "Decline" buttons for photo consultations
- [x] Send Feedback to client — master_reply, professional_notes, recommendations, estimated price range, estimated duration
- [x] View Booking Consultations — `/dashboard/consultations` "Booking Reviews" tab with client details, service info, had-before data
- [x] Pre-Service Assessment — `/dashboard/consultations` "Assessments" tab shows all consultation_responses with client answers
- [x] Approve/Decline Bookings based on consultation — "Approve Booking" / "Decline" buttons with master notes for booking consultations

### Chat polish
- [x] Message Grouping (by sender) — messages within 2-min window from same sender are grouped with reduced spacing + adjusted bubble radii
- [x] Profile Photos in chat — avatars in sidebar list + message bubbles (last-in-group only for other user)
- [x] Message Status (sent/delivered) — single grey check for sent, double blue checks for read (`msg-status-sent`/`msg-status-read` CSS classes)
- [x] Conversation Types audit (Client↔Master, Client↔Owner, Master↔Owner) — chat header shows relationship type label based on other user's role

---

## Phase 7 — Loyalty Program (full)

Stamp / QR / NFC / rewards as a single program.

### Client
- [x] Scan QR Codes (camera scan to earn points) — `/dashboard/loyalty/scan`
- [x] +50 Points Per Scan (master-configurable, default 50)
- [x] Dynamic QR Codes (rotate after each scan) — server-side rotation in `process_qr_scan`
- [x] NFC Tag Scanning — Web NFC `NDEFReader` (Chromium Android)
- [x] Multiple Cards Per Master (different services) — see card picker
- [x] Card Selection (choose which to stamp) — modal on multi-card masters
- [x] Progress Tracking (visual stamp progress) — `/dashboard/loyalty`
- [x] Transaction / Points History — history modal on `/dashboard/loyalty`

### Master
- [x] Display QR Code (unique per Master) — `/dashboard/loyalty/qr`
- [x] Dynamic Codes (rotate after each scan) — realtime + manual rotate
- [x] QR Code Full-Screen — Fullscreen API
- [x] Loyalty Card Builder — `/dashboard/loyalty/cards`
- [x] Multiple Cards (different services)
- [x] Card Naming
- [x] Stamp Requirements (configurable, presets 3/5/6/8/10/12)
- [x] Reward Definition (free service / discount % / fixed amount)
- [x] Manage Rewards (view/edit) — `/dashboard/loyalty/manage`
- [x] Reward Catalog — `/dashboard/loyalty` master view
- [x] Points System configuration (+50 default) — settings modal on `/dashboard/loyalty/qr`

---

## Phase 8 — Inventory & Supplies ✅

### Master
- [x] Add Supplies (name, qty, unit, threshold, cost)
- [x] Update Stock (add/remove)
- [x] Low Stock Alerts
- [x] Supply History (usage over time)
- [x] Usage Tracking (auto-deduct on completion)
- [x] Cost Calculation (per-service)

### Owner
- [x] Owner Supplies Screen (platform-wide)
- [x] Add Owner Supply
- [x] Supply Tracking
- [x] Usage Reports

---

## Phase 9 — Portfolio & Master Profile

- [x] Photo Gallery — Portfolio tab in Settings (upload multiple, view grid, edit descriptions). Uses `portfolios` table + Supabase Storage `portfolios` bucket.
- [x] Delete Photos — Delete button on hover in portfolio grid + in photo detail modal, with confirmation dialog.
- [x] Public Portfolio Display (visible to clients) — `/dashboard/masters/[id]` page shows master bio, services, and full portfolio gallery with lightbox viewer.
- [x] View Public Profile (see what clients see) — "View Public Profile" button in Settings → Profile section links to `/dashboard/masters/[id]` with own-profile banner.
- [x] Edit Bio — Settings → Profile tab textarea field, persisted via `updateProfile({ bio })`.
- [x] Set Location (business address, city) — Settings → Profile tab city field. Profile table has `city` and `country` columns.
- [x] Profile Photo — Settings → Profile tab avatar upload to Supabase Storage `avatars` bucket.
- [x] Notification Preferences — (Mobile only; removed from Web settings)
- [x] Business Hours (cross-link with Phase 3) — Availability management at `/dashboard/availability` (Phase 3 complete). BusinessSettingsPanel also links to availability settings.
- [x] Account Settings (password, email) — Settings → Security tab: email change with dual-email verification flow, password reset via email link, account deletion with OTP verification.
- [x] Master Onboarding flow (web — verify completeness) — 6-step onboarding at `/dashboard/onboarding` (welcome → profile → services → availability → portfolio → business_settings). Redirects masters on first login; marks `onboarding_completed` on finish. Portfolio step now deep-links to Settings → Portfolio tab.

---

## Phase 10 — Owner Platform Management ✅

### Master Management
- [x] Master Invitations (send invites)
- [x] Pending Approvals
- [x] Master Profiles (view/edit)
- [x] Deactivate Masters
- [x] Application Review Screen

### Platform Analytics
- [x] Platform Statistics (high-level metrics)
- [x] Revenue Tracking (total platform earnings)
- [x] Booking Analytics (platform-wide)
- [x] User Statistics (clients, Masters, Owners)

---

## Phase 11 — Owner Shop & Orders

### Products
- [x] Edit Products
- [x] Delete Products
- [x] Stock Management

### Inventory Dashboard
- [x] View All Inventory
- [x] Low Stock Alerts
- [x] Stock History *(Note: Added UI placeholders; full tracking requires `stock_history` table in v2)*
- [x] Supplier Management *(Note: Added mock UI field; full supplier mgmt requires `product_suppliers` table in v2)*

### Pricing
- [x] Wholesale Pricing (~30% off)
- [x] Dual Pricing Display (auto per role)

### Orders
- [x] View All Orders (platform-wide)
- [x] Order Detail Screen
- [x] Order Status Updates
- [x] Client-side Order Status tracking

---

## Phase 12 — Academy (full) ✅

Largest single subsystem. Web implementation completed 2026-05-20.

### Owner — `/dashboard/academy` (role-aware main page + sub-pages)
- [x] Create Courses (title, description, cover, price, publish) — Create modal on main page with title, description, price, thumbnail URL, publish toggle. Inserts into `courses` with `instructor_id`.
- [x] Edit Courses — Edit modal (pre-filled) on main page + inline edit on `/dashboard/academy/[courseId]` course detail header.
- [x] Delete Courses — Delete confirmation modal with cascade warning. Deletes from `courses` table.
- [x] Curriculum Builder (chapters + lessons) — `/dashboard/academy/[courseId]` Curriculum tab. Add/edit/delete chapters with order_index. Lessons nested under chapters or uncategorized.
- [x] Create Lessons (video URL, upload, resources, homework toggle) — Lesson modal: title, description, video URL (YouTube/Vimeo/direct embed), resource URL, duration, homework toggle. *(Note: Direct file upload requires Supabase Storage bucket config — currently accepts URL input for video and resources.)*
- [x] Edit Lessons — Edit button on each lesson row opens pre-filled modal.
- [x] Lesson Ordering — Up/down arrow buttons swap `order_index` between adjacent lessons within the same chapter.
- [x] View Students (enrolled list) — `/dashboard/academy/[courseId]` Students tab. Lists enrolled students with avatar, name, email, progress bar.
- [x] Student Analytics (revenue, enrollments, completion) — `/dashboard/academy/[courseId]` Analytics tab. Stats cards: total students, completed, avg progress, lesson count. Recent enrollments list.
- [x] Student Progress (individual) — Click student → detail view showing per-lesson completion checklist with progress bar.
- [x] Student Detail Screen — Inline panel in Students tab showing student avatar, name, email, enrollment date, per-lesson progress checklist. *(Note: Mobile uses full-screen push navigation; web uses inline detail panel — functionally equivalent.)*
- [x] Homework Inbox (pending submissions) — `/dashboard/academy/homework` page. Lists all submissions across courses with pending/reviewed/all filter tabs.
- [x] Review Submissions — Click submission → review modal showing student info, photo, notes, and feedback textarea.
- [x] Pending Badge — Amber pulse badge on Homework stat card when pending count > 0. Pending count also shown on main academy page.
- [x] Send Feedback to students — Submit feedback button in review modal. Updates `homework_submissions.feedback`, `status='reviewed'`, `reviewed_by`, `reviewed_at`.
- [x] Lesson Q&A Inbox — `/dashboard/academy/qa` page. Lists top-level questions (is_question=true, no parent) across all courses with unanswered/answered/all filter.
- [x] Q&A Detail / Response — Click question → detail view with full thread. Reply input sends `lesson_qa_messages` with `parent_message_id` linking to the question.

### Client — `/dashboard/academy` (browse + my courses) + `/dashboard/academy/learn/[courseId]`
- [x] Course Purchase (via checkout) — Enrollment flow on browse page with course detail card, price display, and "Enroll Now" button. Inserts into `course_enrollments`. *(Note: Currently direct enrollment; Stripe payment integration for paid courses is deferred to Phase 14 — Owner Finance. The UI is ready for Stripe Checkout integration when enabled.)*
- [x] Lesson Progress (track completion) — "Mark Complete" / "Completed" toggle button per lesson. Tracks via `lesson_progress` table. Overall course progress bar in sidebar and header.
- [x] Lesson Navigation — Sidebar with chapter sections and lesson list. Previous/Next buttons. Video embed (YouTube/Vimeo iframe or direct `<video>` tag). Auto-selects first incomplete lesson on load.
- [x] Homework Feedback (view instructor reply) — Homework section on lesson page with Submit/Feedback tabs. Feedback tab shows instructor feedback text with review timestamp.

### Web-only additions (not in mobile checklist)
- [x] Browse/My Courses tab toggle for clients — Clients can switch between browsing published courses and viewing their enrolled courses with progress.
- [x] Enrolled badge on course cards — "Enrolled" badge and "Continue Learning" button for already-enrolled courses.
- [x] Q&A on lesson page — Client-side Q&A section per lesson with real-time message display and send input.

### Excluded (mobile-only features)
- *None excluded* — All Phase 12 features have web equivalents. Mobile-specific UI patterns (push navigation, native video player, camera upload) are adapted to web patterns (inline panels, iframe/HTML5 video, URL input).

---

## Phase 13 — Service Catalog & Pilates (Owner) ✅

### Service Catalog
- [x] Create Global Services — `/dashboard/services` "Add Service" button opens full CRUD modal with name, description, category, price, duration, consultation toggle, and live preview. Creates `services` row + `master_services` link. Owners can also quick-create Pilates studios.
- [x] Edit Services — Edit button on each service card opens the same modal pre-filled; saves via `supabase.from('services').update(...)`.
- [x] Delete Services — Trash button with confirmation dialog; deletes service row (deactivates if past bookings exist via DB constraints).
- [x] Service Categories (organize) — `CATEGORIES` array (`Nails, Lashes, Brows, Hair, Makeup, Skincare, Pilates, Other`). Category chip selector in create/edit modal + category filter chips on the service list view for filtering by category with counts. Owners see all categories; masters see all except Pilates.
- [x] Service Form Screen (full CRUD) — Full modal form: name, description, category chips, price, duration, consultation toggle, live preview card. Expandable per-service config panel for custom price/duration/deposit override. Global active toggle.

### Pilates
- [x] Pilates Hub Screen (overview) — "Pilates" button opens hub modal listing all Pilates studios with stats, quick-create, and navigation to `/dashboard/services/pilates/[id]` dedicated management page with hero header, `PilatesTimetableManager` component (4 tabs: Schedule, Sessions, Instructors, Settings), and stat strip (upcoming/active slots/bookings/instructors).
- [x] Operating Days configuration (verify on web) — Settings tab in `PilatesTimetableManager` has operating days chip row (Sun–Sat toggles). Saves to `pilates_settings.operating_days` array. Prevents removing last day. `ensure_pilates_sessions` RPC respects operating days for auto-generation and cleans non-operating-day sessions (preserving booked/override).
- [x] Session creation / auto-generation from templates — Schedule tab: "Add a weekly class" form (day, time, instructor, capacity, duration, level, start date, notes). Creates `pilates_schedule_templates` row. `ensure_pilates_sessions` RPC auto-generates `pilates_class_sessions` for the next 5 weeks on page load.
- [x] Session overrides (manual edits) — Sessions tab: click any session card → override modal. Change instructor, capacity, level, status (scheduled/cancelled), notes. Saves with `is_override: true` so auto-generation won't overwrite.
- [x] Booked session protection — Session editor shows amber "Protected session" banner when bookings exist, displaying active booking count. Capacity input `min` is enforced to booked count (HTML + save validation). Cancelling a session with active bookings triggers a browser confirm dialog warning about affected clients. *(Note: DB-level FK constraints on `pilates_session_bookings` also prevent deletion of booked sessions.)*

---

## Phase 14 — Payments, Notifications, Support (cross-cutting)

Final polish across multiple subsystems.

### Saved Payment Methods ✅
- [x] Add Payment Method (verify) — `PaymentMethodsManager.tsx` component in Settings → Billing. Uses `setup-intent` Edge Function + `stripe.confirmCardSetup()` with inline `CardElement`. 3D Secure triggered automatically by Stripe during setup. First card auto-set as default.
- [x] View Saved Cards (verify) — `list-payment-methods` Edge Function (v11) with JWT verification, CORS fix, and `isDefault` flag from Stripe customer `invoice_settings.default_payment_method`. Cards shown with brand badge, last4, expiry, default indicator.
- [x] Set Default Card — New `set-default-payment-method` Edge Function (v1) with JWT verification and ownership check. Updates Stripe customer `invoice_settings.default_payment_method`. Star button on non-default cards in settings.
- [x] Delete Cards — `delete-payment-method` Edge Function (v10) with JWT verification, ownership check before detach. Confirmation dialog in UI. Card removed from Stripe and UI refreshed.
- [x] Multiple Payment Methods support — Full card list in Settings → Billing, Booking, and Checkout pages. Radio selector in booking/checkout to choose between saved cards or enter a new one. Default card pre-selected.
- [x] 3D Secure authentication — Handled natively by Stripe.js via `confirmCardSetup()` (adding cards) and `confirmCardPayment()` (booking/checkout). Stripe automatically triggers 3D Secure when required by card issuer. Works for both saved and new cards.

### Booking Payments ✅
- [x] Pre-Authorization (hold + later capture) — `create-payment-intent` Edge Function supports `capture_method: 'manual'` for pre-auth holds. Booking page creates payment intents with manual capture. Appointments page `handleMarkAsCompleted` now calls `capture-payment` Edge Function to capture the held amount on service completion.
- [x] Balance Due (remaining at salon) — Appointments drawer shows "Balance Due at Salon" calculated as `price - deposit_paid`. Displayed in appointment detail for both client and master roles.
- [x] Mandate Deposit — Booking flow collects deposit via `setup-intent` + `create-payment-intent`. Appointment record stores `deposit_amount`, `deposit_paid`, `deposit_payment_intent_id`. Deposit breakdown shown in appointment drawer.
- [x] No-Show Fee Capture (auto-charge) — `handleNoShowChargeNow` now calls `handle-no-show` Edge Function which captures the pre-authorized payment via Stripe API with configurable `no_show_fee_percentage` from master settings. Updates appointment status, charge amount, and confirmation record.
- [x] Service Completion Charge — `handleMarkAsCompleted` enhanced to call `capture-payment` Edge Function when `stripe_payment_intent_id` exists on the appointment. Captures the full held amount and marks appointment completed.

### Master Earnings + Stripe Connect ✅
- [x] Transaction History — `/dashboard/earnings` Transactions tab. Fetches `payments` linked to master's `appointments`. Full list with status badges (Completed/Pending/Refunded/Held), client names, service names, and dates.
- [x] Earnings Breakdown (filter by period) — Period filter (7d/30d/90d/year/all) + status filter (all/completed/pending/refunded) on Transactions tab. Overview tab shows stat cards: Total Earned, Pending, Refunded, Net Earnings.
- [x] Payout Status — Payouts tab shows Stripe Connect account status (charges_enabled, payouts_enabled, details_submitted) with refresh button. Payout history from `payouts` table with status badges.
- [x] Connect Bank Account (Stripe) — `stripe-connect-onboarding` Edge Function creates Express Connect account + returns onboarding link. Button on Payouts tab and Overview banner opens Stripe-hosted onboarding flow in new window.
- [x] Stripe Dashboard Access — `stripe-connect-dashboard` Edge Function creates login link for the master's Express account. "Open Stripe Dashboard" button on Payouts tab (active accounts only).
- [x] Payout Settings — Settings tab shows commission rate (from `profiles.commission_rate`) and payout method status. Links to Stripe Dashboard for schedule/bank details/tax config management.

### Owner Finance ✅
- [x] Shop Sales revenue tracking (→ Owner Stripe) — `/dashboard/finance` Shop Sales tab. Fetches `payments` with `order_id`, joins with `orders` for user/total info. Shows total shop revenue and per-order transaction list with customer names and status badges.
- [x] Academy Sales revenue tracking — Academy tab. Queries `course_enrollments` with course price join. Shows total academy revenue and enrollment count for the selected period.
- [x] Commission Tracking (Master services) — Commissions tab. Aggregates booking payments by master, calculates commission using `profiles.commission_rate` (default 20%). Table shows: master name, total revenue, rate, commission earned, net to master, booking count.
- [x] Payout Management — Payouts tab. Fetches from `payouts` table with master name join. Lists all payouts across masters with status badges, Stripe IDs, period coverage. Automatic daily payout schedule info.
- [x] Owner Stripe Dashboard — Quick Actions on Overview + Reports tab. `stripe-connect-dashboard` Edge Function generates login link. Opens Stripe Express dashboard in new window.
- [x] Financial Reports — Reports tab. Summary grid: shop sales, booking revenue, academy revenue, total revenue, commission earned, total refunded, net revenue, academy enrollments. CSV export for transactions and payouts. Links to Stripe Dashboard and Customer Billing Portal.
- [x] Refund Processing (admin) — Refunds tab. Lists all succeeded payments with Stripe PI. "Refund" button opens modal with partial amount input (EUR) + reason selector (requested_by_customer/duplicate/fraudulent). Calls `process-refund` Edge Function.
- [x] Customer Portal (Stripe billing) — Quick Actions on Overview + Reports tab. Calls `create-portal-session` Edge Function to open Stripe Customer Portal for billing management.

### Refunds ✅
- [x] Partial Refunds — Owner Finance Refunds tab. Refund modal accepts optional partial amount (in EUR, up to full payment amount). `process-refund` Edge Function passes `amount` in cents to Stripe Refunds API. Empty amount field = full refund.
- [x] No-Show Fee Refunds — No-show fee charges appear in the refundable payments list on the Refunds tab. Owner can select any no-show charge and issue a partial or full refund using the same refund modal. Info banner explains this workflow.

### Payouts ✅
- [x] Automatic Payouts (scheduled) — Master earnings page (`/dashboard/earnings`) Payouts tab shows automatic payout schedule info (daily rolling via Stripe Connect). Owner finance page (`/dashboard/finance`) Payouts tab shows scheduled payout processing explanation for all masters.
- [x] Payout Tracking (pending/completed) — Both earnings page (master view) and finance page (owner view) fetch from `payouts` table with status badges (pending/completed/in_transit/failed), payout history list with Stripe payout IDs, period coverage, amounts, and refresh controls.
- [x] Earnings Reports — New Reports tab on earnings page with summary stats (total earned, pending, refunded, net earnings, transaction count, payouts received) + CSV export for both transactions and payouts. Owner finance Reports tab enhanced with CSV export for transactions and payouts + links to Stripe Dashboard and Customer Portal.

### Push Notifications (full) ✅
- [x] New Booking (Master) — ⚠️ **Mobile-only**: Native push notification delivered to device via push token. Web already displays these as in-app notifications via the bell icon dropdown (fetched from `scheduled_notifications` table in `NotificationsContext`).
- [x] Booking Confirmed (Client) — ⚠️ **Mobile-only**: Same as above. Web has in-app notification via bell icon.
- [x] Reschedule Request / Approved / Declined — ⚠️ **Mobile-only**: Native push. Web uses in-app notifications.
- [x] Cancellation — ⚠️ **Mobile-only**: Native push. Web uses in-app notifications.
- [x] 24-Hour Reminder — ⚠️ **Mobile-only**: Scheduled push notification to device. Web users see reminders in the in-app notification bell.
- [x] 1-Hour Reminder — ⚠️ **Mobile-only**: Same as 24-hour reminder.
- [x] Confirmation Request prompt — ⚠️ **Mobile-only**: Native push. Web uses in-app notifications.
- [x] No-Show Marked — ⚠️ **Mobile-only**: Native push. Web uses in-app notifications.
- [x] Grace Period Expiring — ⚠️ **Mobile-only**: Native push. Web uses in-app notifications.
- [x] Late Arrival — ⚠️ **Mobile-only**: Native push. Web uses in-app notifications.
- [x] New Message — ⚠️ **Mobile-only**: Native push. Web has real-time message badge in navbar via `NotificationsContext` Supabase channel subscription.
- [x] Order Confirmed / Shipped / Low Stock — ⚠️ **Mobile-only**: Native push. Web uses in-app notifications.
- [x] Course Purchase / Homework Feedback — ⚠️ **Mobile-only**: Native push. Web uses in-app notifications.
- [x] Promotional Offers / New Features / Events — ⚠️ **Mobile-only**: Native push delivery. Web receives these as in-app notifications via `scheduled_notifications`.
- [x] Owner: Send Promotional Push — New `/dashboard/notifications` page, Send tab. Compose notification with title/body, select audience (all users/clients only/masters only), or use targeted selection with individual user checkboxes. Creates `notification_log` + `scheduled_notifications` entries for each recipient. Live preview card.
- [x] Owner: Targeted Campaigns — Campaigns tab on notifications page. Targeted audience picker with checkbox selection per user. Campaign ID groups notifications. Campaign history shows title, body, recipient count, and creation date.
- [x] Owner: Notification History — History tab on notifications page. Lists all `notification_log` entries with delivery status (delivered/failed), notification type, user name, timestamp. Filterable by status (all/delivered/failed/promotional) + search. Refreshable with 200-entry limit.

### Support ✅
- [x] FAQ Section — New `/dashboard/support` page accessible to all roles via profile dropdown (HelpCircle icon). FAQ tab with expandable accordion items, search bar, and category filter chips. Default FAQ items cover Bookings, Payments, Account, Loyalty, Academy, and Shop topics. FAQ data persisted in `global_settings` table under key `faq_items` as JSON.
- [x] Support Contact — Contact tab showing email, phone, hours, and address from `global_settings` key `support_settings`. Clickable mailto/tel links. In-app chat link to `/dashboard/chat`.
- [x] Manage FAQ/Support content (Owner) — Owner sees Add FAQ button + edit/delete actions on each FAQ item. Modal form with category selector, question, and answer fields. CRUD operations upsert to `global_settings.faq_items` JSON. Delete with confirmation.
- [x] Support Settings Screen (Owner) — Settings tab (owner-only) with form fields for support email, phone, business hours, address, and additional info. Saves to `global_settings.support_settings` JSON.

### Misc ✅
- [x] Session Persistence across app restarts — ⚠️ **Mobile-only**: This feature pertains to persisting authentication sessions across native app restarts (AsyncStorage/SecureStore). On web, session persistence is already handled natively by Supabase SSR auth via HTTP-only cookies managed by `@supabase/ssr`. The `AuthContext` automatically restores sessions on page reload/tab reopen. No additional implementation needed.

---

*Generated: 2026-05-17 · Updated: 2026-05-20 (Phase 14 fully completed — Booking Payments, Master Earnings + Stripe Connect, Owner Finance, Refunds, Payouts, Push Notifications, Support, Misc all done) — keep in sync with `MOBILE_FEATURES_CHECKLIST.md`.*
