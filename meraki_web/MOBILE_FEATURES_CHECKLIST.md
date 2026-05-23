# Merakí Mobile → Web Feature Tracker



> Track which mobile features have been implemented in the web version.

> Mark `[x]` when a feature is live in `meraki_web`.



---



## CLIENT FEATURES



### Authentication & Onboarding



- [x] Email/Password Registration

- [x] Email/Password Login

- [x] Role Selection (Client / Master) during signup

- [x] Profile Creation (name, photo, contact info) on signup

  > **Flow Discrepancy:** The registration page asks for name, email, phone, and password, but it does not ask for a photo on signup.

- [x] Password Recovery (forgot password with email reset link)

- [x] OTP Verification (email/phone code verification)

  > **Flow Discrepancy:** OTP Verification is implemented for email, but phone verification is not currently supported.

- [x] Secure Session (automatic token refresh, persistent login)

- [x] Terms of Service acceptance during registration



### Profile Management



- [x] View Profile (personal info, avatar, contact details)

- [x] Edit Profile (name, phone, bio, profile photo)

- [x] Avatar Upload (upload/change profile picture)

- [x] Profile Visibility (Masters can view client profiles)



---



### Home & Discovery



#### Home Screen



- [x] Personalized Greeting (time-of-day aware welcome)

- [ ] Featured Masters Carousel

- [x] Quick Action Buttons (Shop, Orders, Support, Promotions)

  > **Flow Discrepancy:** Quick Action Buttons are present on the dashboard, but they link to Book Now, Discover, Shop, Academy, and Rewards rather than Orders, Support, and Promotions.






#### Discover & Search



- [ ] Browse Masters (all available service providers)

- [ ] City Filter (filter Masters by location)

- [x] Master Profiles (bio, services, portfolio, availability)

- [x] Service Discovery (browse services by category)

- [ ] Service Detail View (description, duration, pricing, available specialists)

- [x] Search Masters (search by name/service)



---



### Service Booking Flow



- [x] Select Service (choose from available services)

- [x] Choose Master (pick from specialists offering service)

- [x] View Master Detail (full profile with bio, services, portfolio)

- [x] Select Date (30-day lookahead calendar)

- [x] Select Time (real-time availability based on Master's schedule)

- [x] Add Notes (special requests or requirements)

- [x] Confirm Booking (review and confirm appointment details)

- [x] Self-booking prevention (owners/masters can't book own services)



---



### Appointments Management



#### Appointment List



- [x] Unified History (all appointments in one place)

- [x] Tabbed View (Upcoming, Past, Cancelled)

- [x] Status Badges (Confirmed, Completed, Cancelled, Reschedule Pending, No-Show)

  > **Flow Discrepancy:** The code implements Status Badges for Confirmed, Pending, Completed, and Cancelled, but is missing badges for Reschedule Pending and No-Show.

- [x] Appointment Cards (date, time, service, Master, price)





#### Appointment Actions



- [x] View Details (full appointment information)

- [x] Direct Chat (message Master from appointment)

- [x] Reschedule — Early (>24h before) instant

- [x] Reschedule — Late (<24h before) requires Master approval

- [x] Cancel Appointment — Late (<24h) warning with 50% penalty fee

- [x] Cancellation Reasons (provide reason for cancellation)



#### Appointment Confirmation System



- [x] Confirmation Requests (push notification to confirm attendance) *(Mobile-only push notification. Web equivalent: active in-app Action Required banner inside drawer/cards)*

- [x] YES Response (confirm attendance)

- [x] NO Response (cancel appointment)

- [x] Confirmation Deadline (respond within specified time)

- [x] "Confirmed & Protected" badge display



#### Financial Clarity



- [x] Price Breakdown (total cost, deposit due, balance at salon)

- [x] Cancellation Policy display (fee warning for late cancellations)



---



### Communication



#### In-App Messaging



- [x] Conversation List (all active conversations)

- [x] Real-Time Chat (instant messaging)

- [x] Text Messages (send/receive)

- [x] Image Sharing (upload/send photos)

- [x] Video Sharing (upload/send videos)

- [x] Photo Consultation (send photos for pre-service assessment)

- [x] Message Grouping (grouped by sender)

- [x] Timestamps

- [x] Unread Count Badge

- [x] Mark Conversation as Read (RPC-based)



#### Consultation System



- [x] Request Photo Consultation

- [x] Consultation Waiting Screen

- [x] Pre-Service Questionnaire



---



### Loyalty Program



#### QR Code Scanning



- [ ] Scan QR Codes (scan Master's QR to earn points)

- [x] Camera Integration (in-app QR scanner)

- [ ] +50 Points Per Scan

- [ ] Dynamic QR Codes (rotate after each scan)



#### NFC Scanning



- [ ] NFC Tag Scanning (tap phone on NFC tag to earn points)



#### Stamp Cards



- [x] View Stamp Cards (loyalty cards from different Masters)

- [ ] Multiple Cards Per Master (different services)

- [ ] Card Selection (choose which card to stamp)

- [ ] Progress Tracking (visual stamp progress)



#### Rewards



- [x] Rewards Catalog (browse available rewards)

- [x] Redeem Points (exchange for discounts/free services)

- [ ] Transaction/Points History



---



### Shop (E-Commerce)



#### Product Browsing



- [x] Product Grid (browse all products)

- [ ] Category Filtering

- [x] Search Products by name

- [ ] Product Detail View (images, description, pricing, stock)

- [ ] Role-Based Pricing (retail for clients, wholesale for Masters)



#### Shopping Cart



- [x] Add to Cart

- [x] Cart Management (view, adjust quantities, remove items, total)



#### Checkout



- [x] Shipping Address entry

- [x] Europe-Only Shipping restriction

- [x] Stripe Payment Processing

- [x] Secure Order Finalization (Edge Function)

- [x] Order Placement



#### Order History



- [x] View Orders (list of all purchases)

- [x] Order Details (products, quantities, prices, status)

- [ ] Order Status tracking



---



### Academy (Learning Platform)



#### Course Discovery



- [x] Course Catalog (browse all courses)

- [x] Course Detail View (description, lesson list, price, instructor)

- [ ] Course Purchase (buy through checkout)



#### Learning Experience



- [x] Video Player (watch course videos)

- [ ] Lesson Progress (track completion)

- [ ] Lesson Navigation (move between lessons)

- [x] Homework Submission (upload photos, submit assignments)

- [ ] Homework Feedback (view instructor feedback)



---



### Payments & Financial



#### Payment Methods



- [ ] Add Payment Method (save cards)

- [ ] View Saved Cards

- [ ] Set Default Card

- [ ] Delete Cards

- [ ] Secure Storage (PCI-compliant via Stripe)



#### Payment History



- [x] Transaction List (all payments)

- [ ] Transaction Details (date, amount, service/product, status, refund)



#### Booking Payments



- [ ] Pre-Authorization (hold funds, charge after service)

- [x] Deposit Payment (pay deposit to secure booking)

- [ ] Balance Due (remaining at salon)

- [ ] Mandate Deposit (some services require deposit)



---



### Support & Legal



- [ ] FAQ Section

- [ ] Support Contact

- [x] Terms of Service page

- [x] Privacy Policy page



### Notifications



- [x] Notification Center (view all notifications)

- [ ] Push Notifications (booking, reminders, reschedule, messages, marketing)



---



## MASTER FEATURES



### Dashboard & Overview



- [x] Today's Appointments overview

- [x] Real-Time Statistics (bookings count, earnings, completion rate)

- [x] Quick Stats Cards

- [x] Recent Messages Preview





---



### Appointment Management



#### Appointment List



- [x] Tabbed View (Pending, Upcoming, Completed)

- [x] Appointment Cards (client details, service, time, status)

- [x] Status Badges



#### Appointment Actions



- [ ] View Details

- [x] Confirm Appointment (approve pending bookings)

- [x] Decline Appointment (reject booking requests)

- [ ] Mark as Completed

- [x] Mark as No-Show

- [ ] Direct Chat (message client from appointment)

- [ ] Reschedule (propose new date/time, client approval required)



#### No-Show Management



- [ ] No-Show Action Modal (3 options):

  - [ ] Charge No-Show Fee Now

  - [ ] Wait Grace Period (auto-charge after timeout)

  - [ ] Client Arrived Late (no charge)

- [ ] Grace Period Logic (auto-charge after expiry)

- [ ] Configurable No-Show Fee %

- [ ] Late Arrival Tracking



---



### Schedule & Availability



#### Weekly Availability



- [x] Weekly Schedule View (set per day)

- [x] Toggle Days (enable/disable per day)

- [x] Time Selection (start/end per day)

- [x] Save Schedule



#### Blocked Slots



- [x] Block Time Slots (manually block specific periods)

- [x] Vacation Mode (block multiple days)

- [x] Reason Field (notes: "Vacation", "Lunch", etc.)

- [x] View Blocked Slots



#### Calendar View



- [x] Visual Calendar (appointments in calendar format)

- [x] Time Slots (available vs booked)

- [x] Navigation (weeks/months)



---



### Service Management



#### My Services



- [x] View All Services

- [ ] Service Details (name, duration, price, description)

- [ ] Toggle Availability (enable/disable services)

- [ ] Custom Pricing (override default price per service)

- [ ] Custom Duration (override default duration)



#### Create & Edit Services



- [x] Add New Service (name, description, price, duration, category, image)

- [ ] Edit Service

- [ ] Deposit Override (per-service deposit requirements)

- [ ] Delete Service



---



### Business Settings



#### Deposit Configuration



- [x] Require Deposit Toggle (ON/OFF)

- [x] Global Deposit Settings — Percentage mode (e.g., 20%)

- [x] Global Deposit Settings — Fixed amount mode (e.g., €20)

- [ ] Per-Service Deposit Override

  > **Dependency:** Requires Phase 4 — Service Management to add per-service deposit columns. A cross-link is provided in the Business Settings UI.



#### Confirmation Settings



- [x] Request Confirmation Timing (e.g., 48h before)

- [x] Response Timeout (e.g., 24h to respond)

- [x] Auto-Cancel unconfirmed appointments after deadline



#### No-Show Policy



- [x] No-Show Charge Percentage

- [x] Late Arrival Threshold (e.g., 15 minutes)

- [x] Grace Period Multiplier (e.g., 50% of service duration)

- [x] Custom Terms & Conditions



#### Notification Settings



- [x] Push Notification Preferences

- [x] Confirmation Reminders (automated)

- [x] Aftercare Campaign toggle



---



### Aftercare Campaigns



- [x] Create Aftercare Messages (post-service care instructions)

- [x] Schedule Timing (e.g., 2h after appointment)

- [x] Message Content (custom text)

- [x] View Active Campaigns

- [x] Automated Delivery after appointment completion



---



### Earnings & Financial



#### Earnings Tracking



- [x] Earnings Summary (today, this week, this month)

- [ ] Transaction History

- [ ] Earnings Breakdown (filter by period)

- [ ] Payout Status



#### Stripe Connect



- [ ] Connect Bank Account (link Stripe)

- [ ] Stripe Dashboard Access

- [ ] Payout Settings (configure schedule)



---



### Loyalty Program (Master Side)



#### QR Code Generation



- [ ] Display QR Code (unique per Master)

- [ ] Dynamic Codes (rotate after each scan)

- [ ] QR Code Full-Screen display



#### Loyalty Card Builder



- [ ] Create Loyalty Cards (custom stamp cards)

- [ ] Multiple Cards (different services)

- [ ] Card Naming

- [ ] Stamp Requirements (how many for reward)

- [ ] Reward Definition (discount, free service, etc.)



#### Reward Management



- [ ] Manage Rewards (view/edit)

- [ ] Reward Catalog

- [ ] Points System configuration (+50 default)



---



### Inventory & Supplies



#### Supply Management



- [x] Add Supplies (name, quantity, unit, low stock threshold, cost)

- [x] Update Stock (add/remove)

- [x] Low Stock Alerts

- [x] Supply History (usage over time)



#### Service-Supply Linking



- [x] Link Supplies to Services

- [x] Usage Tracking (auto-deduct on completion)

- [x] Cost Calculation (per-service cost from supplies)



---



### Portfolio



- [x] Upload Photos (work samples)

- [ ] Photo Gallery

- [ ] Delete Photos

- [ ] Public Portfolio Display (visible to clients)



---



### Consultation Reviews



#### Photo Consultation Review



- [x] View Submitted Photos

- [x] Review Requests (assess suitability)

- [x] Approve/Decline

- [x] Send Feedback to client



#### Booking Consultation Review



- [x] View Booking Consultations

- [x] Pre-Service Assessment

- [x] Approve/Decline Bookings based on consultation



---



### Master Profile & Settings



- [ ] View Public Profile (see what clients see)

- [ ] Edit Bio

- [ ] Set Location (business address, city)

- [ ] Profile Photo

- [ ] Notification Preferences

- [ ] Business Hours

- [ ] Account Settings (password, email)

- [ ] Master Onboarding flow



---



## OWNER (ADMIN) FEATURES



> Owners have access to **all Master features** plus the following:



### Platform Management



#### Master Management



- [x] View All Masters

- [ ] Master Invitations (send invites)

- [ ] Pending Approvals (review/approve new applications)

- [ ] Master Profiles (view/edit)

- [ ] Deactivate Masters

- [ ] Application Review Screen



#### Global Oversight / Platform Analytics



- [ ] Platform Statistics (high-level metrics)

- [ ] Revenue Tracking (total platform earnings)

- [ ] Booking Analytics (platform-wide)

- [ ] User Statistics (total clients, Masters, Owners)



---



### Shop Management



#### Product Management



- [x] Add Products (name, description, price, category, images, stock)

- [ ] Edit Products

- [ ] Delete Products

- [ ] Stock Management (update levels)



#### Inventory Dashboard



- [ ] View All Inventory (platform-wide stock)

- [ ] Low Stock Alerts

- [ ] Stock History

- [ ] Supplier Management



#### Pricing



- [x] Retail Pricing (for clients)

- [ ] Wholesale Pricing (for Masters, ~30% discount)

- [ ] Dual Pricing Display (auto per user role)



---



### Academy Management



#### Course Management



- [ ] Create Courses (title, description, cover image, price, publish/unpublish)

- [ ] Edit Courses

- [ ] Delete Courses

- [ ] Curriculum Builder (chapters + lessons, organize structure)



#### Lesson Management



- [ ] Create Lessons (video URL, direct upload, resources, homework toggle)

- [ ] Edit Lessons

- [ ] Lesson Ordering



#### Student Management



- [ ] View Students (enrolled list)

- [ ] Student Analytics (revenue, enrollments, completion rates)

- [ ] Student Progress (individual tracking)

- [ ] Student Detail Screen



#### Homework Review



- [ ] Homework Inbox (pending submissions)

- [ ] Review Submissions (view photos, feedback, approve/reject)

- [ ] Pending Badge (unreviewed indicator)

- [ ] Send Feedback to students



#### Lesson Q&A



- [ ] Lesson Q&A Inbox

- [ ] Q&A Detail / Response



---



### Service Catalog Management



- [ ] Create Global Services (available to all Masters)

- [ ] Edit Services

- [ ] Delete Services

- [ ] Service Categories (organize by category)

- [ ] Service Form Screen (full CRUD)



---



### Owner Supplies



- [x] Owner Supplies Screen (platform-wide)

- [x] Add Owner Supply

- [x] Supply Tracking (monitor levels)

- [x] Usage Reports



---



### Pilates Management



- [ ] Pilates Hub Screen (overview)

- [x] Pilates Timetable Management (full weekly timetable)

- [ ] Operating Days configuration (on/off per weekday)

- [ ] Session creation / auto-generation from templates

- [ ] Session overrides (manual edits)

- [ ] Booked session protection (prevent deletion of booked classes)



---



### Platform Notifications (Marketing)



- [ ] Send Promotional Push Notifications to all users

- [ ] Targeted Campaigns (specific segments)

- [ ] Notification History



---



### Owner Orders Management



- [ ] View All Orders (platform-wide)

- [ ] Order Detail Screen

- [ ] Order Status Updates



---



### Support Settings



- [ ] Manage FAQ/Support content

- [ ] Support Settings Screen



---



### Financial Management



#### Platform Revenue



- [ ] Shop Sales revenue (→ Owner Stripe)

- [ ] Academy Sales revenue (→ Owner Stripe)

- [ ] Commission Tracking (from Master services)

- [ ] Payout Management (manage Master payouts)



#### Stripe Integration



- [ ] Owner Stripe Dashboard access

- [ ] Financial Reports

- [ ] Refund Processing

- [ ] Customer Portal (Stripe billing portal)



---



## CROSS-CUTTING FEATURES



### Chat System (All Roles)



- [x] Conversation List with unread indicators

- [x] Recent message preview

- [x] Real-Time Messaging (instant delivery)

- [x] Text Messages

- [x] Image Sharing

- [x] Video Sharing

- [x] Message Status (sent/delivered)

- [x] Timestamps

- [x] Profile Photos in chat

- [x] Conversation Types: Client↔Master, Client↔Owner, Master↔Owner



---



### Push Notifications (All Roles)



#### Booking Notifications



- [ ] New Booking (Master receives)

- [ ] Booking Confirmed (Client receives)

- [ ] Reschedule Request (both parties)

- [ ] Reschedule Approved/Declined

- [ ] Cancellation notification

- [ ] Confirmation Reminder (24h, 1h before)



#### Appointment Reminders



- [ ] 24-Hour Reminder

- [ ] 1-Hour Reminder

- [ ] Confirmation Request prompt



#### No-Show & Late



- [ ] No-Show Marked notification

- [ ] Grace Period Expiring warning

- [ ] Late Arrival notification



#### Messaging



- [ ] New Message notification



#### Shop & Academy



- [ ] Order Confirmed

- [ ] Order Shipped

- [ ] Low Stock Alert

- [ ] Course Purchase confirmation

- [ ] Homework Feedback notification



#### Marketing



- [ ] Promotional Offers

- [ ] New Features announcements

- [ ] Event Announcements



---



### Payment Processing (All Roles)



#### Stripe Integration



- [x] Secure Payments (PCI-compliant)

- [ ] Multiple Payment Methods (various card types)

- [ ] 3D Secure authentication



#### Saved Payment Methods



- [x] Add Cards

- [x] View Saved Cards (brand, last 4, expiry)

- [ ] Set Default

- [ ] Delete Cards



#### Booking Payments



- [ ] Pre-Authorization (hold, charge after service)

- [ ] Deposit Collection

- [ ] Balance Collection (at salon or charged later)

- [ ] No-Show Fee Capture (auto-charge)

- [ ] Service Completion Charge (capture held funds)



#### Shop Payments



- [x] Immediate Charge at checkout

- [ ] Order Processing (payment before shipping)

- [ ] Secure Finalization via Edge Function



#### Refunds



- [x] Full Refunds (cancelled services)

- [ ] Partial Refunds (disputes/adjustments)

- [ ] No-Show Fee Refunds



#### Payouts (Master/Owner)



- [ ] Stripe Connect (link bank)

- [ ] Automatic Payouts (scheduled transfers)

- [ ] Payout Tracking (pending/completed)

- [ ] Earnings Reports



---



### Account Management



- [x] Delete Account (Edge Function: full data removal)

- [x] Logout

- [ ] Session Persistence across app restarts



---



*Last updated: 2026-05-19*

