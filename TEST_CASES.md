# Merakí App - Comprehensive Test Cases

> A detailed testing guide to verify every feature of the Merakí application.

**Status Key:**
- ✅ **Pass** – Feature works as expected
- ❌ **Fail** – Feature is broken
- ⚠️ **Warn** – Works but has minor issues

---

## 🔐 1. Authentication System

---

### AUTH-01: Client Registration
**Objective:** Verify a new client can register successfully.

**Steps:**
1. Open the app.
2. Tap **"Sign Up"**.
3. Select **"Client"** role.
4. Enter a valid Name, Email, and Password.
5. Tap **"Create Account"**.

**Expected Result:**
- Account is created.
- User is redirected to the **Client Home Screen**.
- A profile record is created in the `profiles` table with `role = 'client'`.

**Status:** [✅]

---

### AUTH-02: Master Registration (via Invitation)
**Objective:** Verify a user with a pending invitation can register as a Master.

**Pre-condition:** An Owner has added the user's email to the `pending_masters` table.

**Steps:**
1. Open the app.
2. Tap **"Sign Up"**.
3. Select **"Professional"** role.
4. Enter the **invited email** and a password.
5. Complete registration.

**Expected Result:**
- Account is created with `role = 'master'` or `is_master = true`.
- User is redirected to the **Master Dashboard**.
- The `pending_masters` record is consumed (deleted or marked as used).

**Status:** [✅]

---

### AUTH-03: Duplicate Email Registration
**Objective:** Verify the system rejects duplicate email registration.

**Steps:**
1. Try to sign up with an email that is already registered.

**Expected Result:**
- Error message: "User already registered" or similar.
- Registration does not proceed.

**Status:** [⚠️]

---

### AUTH-04: Weak Password Validation
**Objective:** Verify password strength requirements.

**Steps:**
1. Attempt to sign up with a password shorter than 6 characters.

**Expected Result:**
- Error message: "Password should be at least 6 characters".

**Status:** [ ✅]

---

### AUTH-05: Client Login
**Objective:** Verify a client can log in successfully.

**Steps:**
1. Open the app.
2. Enter valid **Client** credentials.
3. Tap **"Sign In"**.

**Expected Result:**
- Successful login.
- Redirect to **Client Home Screen**.

**Status:** [✅]

---

### AUTH-06: Master Login
**Objective:** Verify a master can log in successfully.

**Steps:**
1. Open the app.
2. Enter valid **Master** credentials.
3. Tap **"Sign In"**.

**Expected Result:**
- Successful login.
- Redirect to **Master Dashboard**.

**Status:** [✅]

---

### AUTH-07: Owner Login
**Objective:** Verify an owner/admin can log in successfully.

**Steps:**
1. Open the app.
2. Enter valid **Owner** credentials.
3. Tap **"Sign In"**.

**Expected Result:**
- Successful login.
- Redirect to **Master Dashboard** with additional Admin tabs visible (Academy, Inventory, Team).

**Status:** [✅]

---

### AUTH-08: Session Persistence
**Objective:** Verify the user remains logged in after closing the app.

**Steps:**
1. Log in as any user.
2. **Close the app completely** (kill the process).
3. Re-open the app.

**Expected Result:**
- User remains logged in without re-entering credentials.
- Secure token is retrieved from `expo-secure-store`.

**Status:** [✅]

---

### AUTH-09: Logout
**Objective:** Verify logout functionality.

**Steps:**
1. Go to **Menu / Profile**.
2. Tap **"Sign Out"**.

**Expected Result:**
- User is signed out.
- Returned to the **Auth / Welcome** screen.
- Secure tokens are cleared.

**Status:** [✅]

---

## 📱 2. Client Features

---

### CLI-01: Home Screen Greeting
**Objective:** Verify personalized greeting with time-of-day awareness.

**Steps:**
1. Log in as a Client.
2. Check the top header on the Home Screen.

**Expected Result:**
- Displays "Good [Morning/Afternoon/Evening], [User's Name]".
- Profile picture (or initials fallback) is visible.

**Status:** [✅]

---

### CLI-02: Featured Masters Carousel
**Objective:** Verify the Featured Masters section is interactive.

**Steps:**
1. Scroll through the **"Featured Masters"** carousel.
2. Tap on a Master card.

**Expected Result:**
- Cards scroll smoothly horizontally.
- Tapping opens the **Master Detail Screen** with bio and services.

**Status:** [✅]

---

### CLI-03: Quick Action Buttons
**Objective:** Verify Home Screen quick action buttons navigate correctly.

**Steps:**
1. Tap **"Book Now"**.
2. Return to Home, tap **"Shop"**.
3. Return to Home, tap **"My Orders"**.

**Expected Result:**
- "Book Now" → Navigates to **Booking Tab**.
- "Shop" → Navigates to **Shop Tab**.
- "My Orders" → Navigates to **Orders Tab**.

**Status:** [ ⚠️ the book now feature is broken due to it going to the last saved previous screen]

---

### CLI-04: Pull to Refresh
**Objective:** Verify pull-to-refresh functionality on Home Screen.

**Steps:**
1. Pull down on the Home Screen.

**Expected Result:**
- Refresh spinner appears.
- Data reloads (Featured Masters, Services, etc.).

**Status:** [✅ ]

---

## 📅 3. Booking Flow

---

### BOOK-01: Browse Services
**Objective:** Verify services can be browsed by category.

**Steps:**
1. Tap the **"Book"** tab.
2. Browse through the available categories.

**Expected Result:**
- Categories are listed clearly.
- Expanding a category shows related services with names, durations, and prices.

**Status:** [✅ ]

---

### BOOK-02: View Service Details
**Objective:** Verify service detail screen displays correct information.

**Steps:**
1. Tap on a specific service (e.g., "Haircut").

**Expected Result:**
- Opens **Service Detail Screen**.
- Shows description, price, and duration.
- "Book Service" button is visible.

**Status:** [✅ ]

---

### BOOK-03: Select a Master
**Objective:** Verify Master selection screen filters correctly.

**Steps:**
1. From Service Detail, tap **"Book Service"**.
2. Select a Master from the list.

**Expected Result:**
- Only Masters who offer this service are shown.
- Master cards show name, photo, and rating.
- Tapping proceeds to **Date Selection**.

**Status:** [✅]

---

### BOOK-04: Date & Time Selection
**Objective:** Verify date/time selection works with real-time availability.

**Steps:**
1. Select a date from the calendar (within the next 30 days).
2. Select an available time slot.

**Expected Result:**
- Only dates with available slots are enabled.
- Time slots reflect the Master's real-time availability.
- Unavailable/past times are greyed out.

**Status:** [✅ feature implemented]

---

### BOOK-05: Confirm Booking
**Objective:** Verify appointment can be created successfully.

**Steps:**
1. Review booking details (Service, Master, Date, Time, Price).
2. (Optional) Add a note in the "Notes" field.
3. Tap **"Confirm Booking"**.

**Expected Result:**
- Loading spinner appears.
- Success screen is shown.
- Appointment is saved to the `appointments` table with status `pending`.
- Push notification is sent to the Master/Owner.

**Status:** [ ✅]

---

### BOOK-06: Payment Pre-Authorization
**Objective:** Verify Stripe pre-authorization during booking.

**Pre-condition:** User has a saved payment method.

**Steps:**
1. During the booking flow, ensure a payment method is selected.
2. Confirm the booking.

**Expected Result:**
- Stripe places a hold on the amount (PaymentIntent with `capture_method: manual`).
- No immediate charge is made.
- `stripe_payment_intent_id` is saved on the appointment.

**Status:** [ ⚠️ unable to test it since i need to build the app fully but i think it will most likely not work as i need her to make the account but i should test it on my own stripe as test stripe account just to be sure that it works ]

---



## 📋 4. Orders & Appointments

---

### ORD-01: View Upcoming Appointments
**Objective:** Verify the "Upcoming" tab shows correct appointments.

**Steps:**
1. Go to the **"Orders"** tab.
2. View the **"Upcoming"** list.

**Expected Result:**
- Newly created appointment appears.
- Card shows Master name, Service, Date, Time, and Status (Pending/Confirmed).

**Status:** [ ✅]

---

### ORD-02: Early Cancellation (>24 hours)
**Objective:** Verify early cancellation is free and automatic.

**Steps:**
1. Create or find an appointment scheduled for **more than 24 hours** in the future.
2. Go to **Orders** → **Upcoming**.
3. Tap on the appointment card.
4. Tap **"Cancel Appointment"**.
5. Review the confirmation modal (should NOT show penalty warning).
6. Confirm cancellation.

**Expected Result:**
- Simple confirmation dialog appears (no penalty warning).
- Status changes to `cancelled_free`.
- Stripe payment hold is released (no charge).
- Appointment removed from "Upcoming" list.
- Master receives notification: "The slot is open again."

**Status:** [✅ Implemented]

---

### ORD-03: Late Cancellation (<24 hours)
**Objective:** Verify late cancellation charges a 50% penalty fee.

**Steps:**
1. Create or find an appointment scheduled for **less than 24 hours** in the future.
2. Go to **Orders** → **Upcoming**.
3. Tap on the appointment card.
4. Tap **"Cancel Appointment"**.
5. Review the warning modal showing the penalty amount.
6. Confirm cancellation.

**Expected Result:**
- Warning modal appears showing: "You will be charged 50% (€XX.XX)".
- Orange warning box displays "⚠️ Late cancellation fee applies".
- Status changes to `cancelled_charge`.
- Stripe captures 50% of the original price as penalty.
- Master receives notification: "Client canceled late. A €XX fee has been charged."

**Status:** [✅ Implemented]

---

### ORD-04: Early Reschedule (>24 hours)
**Objective:** Verify early reschedule is instant with no approval needed.

**Steps:**
1. Create or find an appointment scheduled for **more than 24 hours** in the future.
2. Tap **"Reschedule"**.
3. Select a new date and time.
4. Confirm.

**Expected Result:**
- Appointment time updates immediately in the database.
- Status remains `confirmed`.
- No pending status or Master approval required.
- Master receives notification: "Client moved their appointment to [new time]."

**Status:** [✅ Implemented]

---

### ORD-05: Late Reschedule (<24 hours)
**Objective:** Verify late reschedule requires Master approval.

**Steps:**
1. Create or find an appointment scheduled for **less than 24 hours** in the future.
2. Tap **"Reschedule"**.
3. Select a new date and time.
4. Confirm.

**Expected Result:**
- Status changes to `reschedule_pending`.
- Alert shows: "This is a late reschedule. Your request has been sent to the master for approval."
- Master sees the request in their **Pending** tab.
- Master can **Approve** (time updates, status → `confirmed`) or **Decline** (original time kept).

**Status:** [✅ Implemented]

---

## 🛒 5. Shop & E-commerce

---

### SHOP-01: Add Product to Cart
**Objective:** Verify add-to-cart functionality.

**Steps:**
1. Go to **Shop** tab.
2. Select a product.
3. Tap **"Add to Cart"**.

**Expected Result:**
- Cart icon badge shows updated count.
- Product is added to the local cart state.

**Status:** [✅ ]

---

### SHOP-02: View Shopping Cart
**Objective:** Verify cart displays correct items and total.

**Steps:**
1. Tap the **Cart icon**.

**Expected Result:**
- Shows all selected items with quantities.
- Displays correct subtotal and total price.
- Quantity can be adjusted.

**Status:** [✅ ]

---

### SHOP-03: Complete Checkout
**Objective:** Verify checkout process and payment.

**Steps:**
1. Tap **"Checkout"** in the cart.
2. Select a Payment Method.
3. Confirm purchase.

**Expected Result:**
- Stripe payment is processed.
- Order record is created in `orders` table.
- Stock is decremented via `decrement_stock()` function.
- Success screen is shown.

**Status:** [⚠️ unable to test it and i need them to fill out all of the details, like their address and payment method and everything that needs to be shipped, ect. I would like to test it but i dont have a stripe account and i dont want to use my own stripe account to test it.]

---

## 👤 6. Profile & Settings

---

### PROF-01: Upload Avatar
**Objective:** Verify profile picture upload.

**Steps:**
1. Go to **Menu / Profile**.
2. Tap the Profile Picture area.
3. Select and upload a new image.

**Expected Result:**
- Image uploads to Supabase Storage.
- `avatar_url` is updated in the `profiles` table.
- Profile picture updates across the entire app.

**Status:** [✅ ]

---

### PROF-02: Manage Payment Methods
**Objective:** Verify adding and deleting saved cards.

**Steps:**
1. Go to **"Payment Methods"** screen.
2. Add a new card (use Stripe test card: `4242 4242 4242 4242`).
3. Delete an existing card.

**Expected Result:**
- New card is validated by Stripe and saved.
- Card appears in the list with brand and last 4 digits.
- Deleted card is removed from the list and Stripe.

**Status:** [⚠️ unable to test it, didnt connect stripe account, and i would like to use stripe for this process obviously ]

---

## ✂️ 7. Master Features

---


### MST-02: Manage Availability
**Objective:** Verify availability settings affect booking slots.

**Steps:**
1. Go to **"Schedule / Availability"** screen.
2. Toggle **Sunday** to "Off".
3. Change **Monday** working hours to 10:00 - 14:00.
4. Save changes.

**Expected Result:**
- Changes are saved to `master_availability` table.
- Client app shows **no slots** for Sunday.
- Client app shows slots **only between 10:00-14:00** on Monday.

**Status:** [✅ feature implemented with custom time pickers]

---

### MST-03: Confirm Pending Appointment
**Objective:** Verify Master can confirm appointments.

**Steps:**
1. View **"Pending"** appointments tab.
2. Tap **"Confirm"** on an appointment.

**Expected Result:**
- Status changes to `confirmed`.
- Appointment moves to "Upcoming" tab.
- Client receives push notification.

**Status:** [✅ ]

---

### MST-04: Decline Pending Appointment
**Objective:** Verify Master can decline appointments.

**Steps:**
1. View **"Pending"** appointments tab.
2. Tap **"Decline"** on an appointment.

**Expected Result:**
- Status changes to `cancelled`.
- Appointment is removed from the list.
- Client receives push notification.
- Stripe pre-auth is released.

**Status:** [✅ ]

---

### MST-05: Mark Appointment Complete
**Objective:** Verify completion of appointments.

**Steps:**
1. View **"Upcoming"** appointments (on or after the appointment date).
2. Tap **"Complete"**.

**Expected Result:**
- Status changes to `completed`.
- Stripe payment is captured.
- Revenue is added to Master's earnings.

**Status:** [ ⚠️ cant test it yet because i need to be patient and also wait for the stripe to be connected ]

---

### MST-06: Mark No-Show
**Objective:** Verify no-show charge is triggered.

**Steps:**
1. Tap **"No Show"** on an appointment.

**Expected Result:**
- Status changes to `no_show`.
- Stripe **charges the cancellation fee** automatically via `handle-no-show` Edge Function.
- Payment record is created with `payment_type = 'no_show'`.

**Status:** [ ❌ cant test it yet because i need to be patient and also wait for the stripe to be connected ]

---


---

## 💬 8. Messaging

---

### MSG-01: Send Text Message
**Objective:** Verify text messaging between users.

**Steps:**
1. Go to **Messages** tab.
2. Select a conversation.
3. Type and send a text message.

**Expected Result:**
- Message appears immediately (optimistic UI).
- Message is saved to the `messages` table.
- Recipient receives the message in real-time.

**Status:** [✅ ]

---

### MSG-02: Send Photo/Video
**Objective:** Verify media messaging.

**Steps:**
1. In a chat, tap the **attachment icon**.
2. Select and send a photo or video.

**Expected Result:**
- Media uploads to Supabase Storage.
- Media displays as a chat bubble.
- Recipient can view the media.

**Status:** [✅ ]

---

### MSG-03: Real-time Updates
**Objective:** Verify real-time chat functionality.

**Steps:**
1. Open the same chat on **two devices** (Client and Master).
2. Send a message from one device.

**Expected Result:**
- The other device updates **instantly** without refresh.
- Powered by Supabase Realtime subscriptions.

**Status:** [✅ ]

---

## 👑 9. Owner / Admin Features

---

### ACAD-01: Create a Course
**Objective:** Verify course creation in Academy.

**Steps:**
1. Go to **"Manage Academy"** → **"Courses"** tab.
2. Tap **"+ Add Course"**.
3. Fill in Title, Description, Price, and Cover Image.
4. Save.

**Expected Result:**
- Course is created in `courses` table with `published = false`.
- Course appears in the list.

**Status:** [✅ ]

---

### ACAD-02: Add Chapter & Lesson
**Objective:** Verify curriculum builder functionality.

**Steps:**
1. Edit an existing course.
2. Add a new **Chapter**.
3. Add a new **Lesson** to the chapter (upload video or provide URL).
4. Save.

**Expected Result:**
- Chapter is saved to `chapters` table.
- Lesson is saved to `lessons` table with correct `chapter_id`.
- Video URL or uploaded file is stored correctly.

**Status:** [ ✅]

---

### ACAD-03: Review Homework Submission
**Objective:** Verify homework review workflow.

**Steps:**
1. Go to **"Inbox"** tab in Manage Academy.
2. Select a pending homework submission.
3. View the submitted photo.
4. Provide feedback and tap **"Approve"** or **"Reject"**.

**Expected Result:**
- Submission is updated with feedback and status.
- Student is notified.
- Badge count on Inbox updates.

**Status:** [⚠️ need to fix bugs ]

---

### ADM-01: Invite a New Master
**Objective:** Verify Master invitation flow.

**Steps:**
1. Go to **"Team / Masters"** screen.
2. Tap **"Invite Master"**.
3. Enter email and commission rate.
4. Confirm.

**Expected Result:**
- Record is created in `pending_masters` table.
- When this email signs up as "Professional", they automatically become a Master.

**Status:** [ ✅]

---

### ADM-02: Low Stock Alert
**Objective:** Verify low stock notification to Owner.

**Pre-condition:** A product's stock is reduced below the threshold.

**Steps:**
1. Simulate low stock by updating a product's `stock_quantity` to < 5.

**Expected Result:**
- Owner receives a push notification warning about low stock.
- Triggered by `low-stock-alert` Edge Function.

**Status:** [❌ didnt add a feauture to manage the stock]

---

### ADM-03: Owner Dashboard Widgets
**Objective:** Verify Owner Dashboard has correct layout and tools.

**Steps:**
1. Log in as Owner.
2. Verify "My Tools" section contains **Portfolio**, **My Services**, and **Availability**.
3. Verify "Business Management" section contains **Add Master**, **Add Service**, **Team**, and **Services**.
4. Verify Stats row and Today's Schedule are visible.

**Expected Result:**
- Dashboard matches the visual style of Master Dashboard.
- All navigation buttons work correctly.

**Status:** [✅]

---

## 🔔 10. Push Notifications

---

### NOTIF-01: Booking Confirmation Notification
**Objective:** Verify push notification on new booking.

**Steps:**
1. Client creates a new booking.

**Expected Result:**
- Master and Owner receive push notification.
- Notification shows service name and time.

**Status:** [ ⚠️]

---

### NOTIF-02: Reschedule Request Notification
**Objective:** Verify push notification for reschedule requests.

**Steps:**
1. Master reschedules an appointment.

**Expected Result:**
- Client receives push notification with proposed new time.

**Status:** [ ⚠️]

---

### NOTIF-03: Background Notification
**Objective:** Verify notifications appear when app is backgrounded.

**Steps:**
1. Background the app.
2. Trigger an event (e.g., new message, booking).

**Expected Result:**
- System notification banner appears on the device.
- Tapping opens the app to the relevant screen.

**Status:** [ ✅]

---

## 🎮 11. UI/UX & Design

---

### UI-01: Dark Mode Consistency
**Objective:** Verify "Midnight Glass" theme is consistent.

**Steps:**
1. Navigate through all main tabs and screens.

**Expected Result:**
- No white flashes or jarring color changes.
- Background is consistent deep matte black (`#050505`).
- Text is readable with proper contrast.

**Status:** [✅ ]

---

### UI-02: Loading States
**Objective:** Verify loading indicators appear appropriately.

**Steps:**
1. Perform a network action on a slow connection (or throttle network).

**Expected Result:**
- Loading spinners appear while data is fetching.
- App does not freeze or crash.
- Error states are shown gracefully if network fails.

**Status:** [✅ ]

---

### UI-03: Safe Area Handling
**Objective:** Verify content respects device notches and home indicators.

**Steps:**
1. Test on a device with a notch (e.g., iPhone X+).
2. Navigate through all screens.

**Expected Result:**
- Content is not obscured by notch or home indicator.
- Header content is visible and properly padded.

**Status:** [❌ ]

---

## 🏆 12. Loyalty Program

---

### LOYAL-01: View Loyalty Points
**Objective:** Verify loyalty points display.

**Steps:**
1. Go to **Menu** → **"Loyalty Points"**.

**Expected Result:**
- Shows current points balance.
- Shows transaction history (earned/redeemed).
- Shows available rewards.

**Status:** [✅ ]

---

### LOYAL-02: Scan QR Code to Earn Points
**Objective:** Verify QR scanning awards points.

**Steps:**
1. Tap the **QR scanner icon** on Client Home.
2. Scan a valid Master QR code.

**Expected Result:**
- Points are awarded to the client.
- QR code rotates to a new one (for security).
- Success message is shown.

**Status:** [ ✅]

---

### LOYAL-03: Master QR Code Display
**Objective:** Verify Masters can display their QR code.

**Steps:**
1. Log in as Master.
2. Go to **"My QR Code"** section.

**Expected Result:**
- Unique, dynamic QR code is displayed.
- Code changes after each successful scan.

**Status:** [✅ ]

---

## ✅ Test Summary Checklist

Use this checklist to track your overall progress:

| Section | Tests | Passed | Failed |
|---------|:-----:|:------:|:------:|
| 1. Authentication | 9 | | |
| 2. Client Features | 4 | | |
| 3. Booking Flow | 6 | | |
| 4. Orders & Appointments | 3 | | |
| 5. Shop & E-commerce | 3 | | |
| 6. Profile & Settings | 2 | | |
| 7. Master Features | 7 | | |
| 8. Messaging | 3 | | |
| 9. Owner / Admin | 5 | | |
| 10. Push Notifications | 3 | | |
| 11. UI/UX & Design | 3 | | |
| 12. Loyalty Program | 3 | | |
| **TOTAL** | **51** | | |

---

*Generated for Merakí App Testing – January 2026*
