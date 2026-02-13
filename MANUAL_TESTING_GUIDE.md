# Merakí App - Manual Testing Guide

This guide provides a step-by-step checklist to verify the functionality of the Merakí app across Client, Master, and Owner roles.

> [!TIP]
> Use the **SQL Testing Tools** provided below specific steps to bypass wait times (e.g., forcing an appointment to "completed" status) or key system data.

---

## 🏗️ prerequisites

Before starting, ensure you have:
1.  **3 Different Accounts**:
    *   **Client Account**: A standard user.
    *   **Master Account A**: A verified service provider (Lashes/Brows).
    *   **Master Account B**: A second service provider (to test multi-master isolation).
    *   **Owner Account**: The admin/platform owner.
2.  **Supabase SQL Editor**: Logic access to run the provided queries.

### 🔍 Helper: Get User UUIDs
Run this to find the IDs needed for the testing queries below:
```sql
SELECT id, email, full_name, role
FROM profiles
ORDER BY role, email;
```

### 👥 Client & Master Interaction
For steps involving scanning or booking, use two different devices or a Simulator + Browser window to log in as both Client and Master simultaneously.

---

## 👤 1. Client Checklist (The Customer)

### Onboarding & Profile
- [x] **Global Signup**: Create a new account from the login screen. Verify you can sign up regardless of selected "location".
- [x] **Profile Management**: Go to `Profile` -> `Edit Profile`. Upload a photo.
    *   *Verify*: Log in as a Master, search for this client, and ensure the photo is visible.
- [ ] **Loyalty Scanning**:
    *   Go to `Loyalty` tab.
    *   Tap "Scan QR".
    *   Scan **Master's** QR Code.
    *   *Verify*:
        *   If Master has 1 card: Stamp added automatically.
        *   If Master has 2 cards (Lashes/Brows): App asks which card to stamp OR adds to the relevant one.
        *   Success message appears: "Stamp added!".

### Discovery & Booking
- [ ] **Search**: Go to the "Search" or "Explore" tab. Filter Master list by `City`.
- [ ] **Service Menu**: Click on a Master. View their services. Verify photos and prices match.
- [ ] **Consultation Logic**:
    *   Select a service tagged as "Consultation Required" (e.g., Brow Tattoo).
    *   *Verify*: A popup/modal asks: "Have you had this done before?"

- [ ] **Mandatory Deposit**:
    *   Select a slot -> Proceed to Booking.
    *   *Verify*: You **cannot** confirm without adding a card.
    *   *Verify*: Payment sheet appears (Stripe).
- [ ] **Financial Clarity**:
    *   On the checkout screen, check the text breakdown:
    *   "Total: €100"
    *   "Deposit to Pay Now: €20"
    *   "Balance Due at Salon: €80"

### Appointments Tab (Redesigned)
- [ ] **Unified History**: Go to `Appointments` tab.
    *   *Verify*: You see a list containing 'Upcoming', 'Past', and 'Cancelled' appointments mixed (or tabbed).
- [ ] **Status Visibility**: Check checks for `confirmed`, `completed`, `cancelled`.
- [ ] **Cancellation**:
    *   **Scenario A (Safe)**: Cancel > 48h (or Master's policy) in advance.
        *   *Verify*: Refund processed (check Stripe dashboard or logs).
    *   **Scenario B (Late)**: Cancel < 24h in advance.
        *   *Verify*: "Deposit Forfeited" warning appears.

- [ ] **Rescheduling**:
    *   Click "Reschedule" on an upcoming appointment.
    *   Select a new time.
    *   *Verify*: Status changes to `reschedule_pending` (or similar) until Master accepts.

### Shop & Academy
- [ ] **Product Purchase**: Buy a shampoo/product. Verify price is "Retail Price".
- [ ] **Shipping**: Enter shipping address.
    *   *Verify*: Form allows "Europe" countries but blocks "USA/Asia".
- [ ] **Course Purchase**: Buy a generic course.
- [ ] **Learning**: Open the course -> Watch query video -> Upload a dummy photo as "homework".

#### 🛠️ SQL Tools: Client Testing

**Force Appointment to "Past/Completed"** (To test "Past" tab visibility):
```sql
UPDATE appointments
SET 
  status = 'completed',
  end_time = NOW() - INTERVAL '1 day',
  start_time = NOW() - INTERVAL '1 day' - INTERVAL '1 hour'
WHERE client_id = 'YOUR_CLIENT_UUID_HERE'
  AND status = 'confirmed';
```



---

## ✂️ 2. Master Checklist (The Service Provider)

### Onboarding & Setup
- [ ] **Self-Registration**: Sign up -> Select "Become a Master".
    *   *Verify*: Access granted immediately (no "Pending Approval" screen).
- [ ] **Stripe Connect**: Go to `Earnings` or `Settings`. Click "Connect Stripe".
    *   *Verify*: Redirects to Stripe Express/Standard dashboard.
- [ ] **Profile Setup**: Set `Bio` and `Location`.
    *   *Verify*: Clients can see these details on your public profile.
- [ ] **Loyalty Settings**:
    *   Create **2 Loyalty Cards** (e.g., "Lash Loyalty" and "Brow Loyalty").
    *   *Verify*: Both cards are active.

### Service & Deposit Configuration (Crucial)
- [ ] **Create Service**: Add "Volume Lashes" (2 hours, €100).
- [ ] **Deposit Settings**:
    *   Go to `Settings` -> `Deposit`.
    *   Toggle `Require Deposit` = ON.
    *   **Test Editable Logic**:
        *   Set global deposit to `Percentage` (20%).
        *   Save.
        *   Change to `Fixed Amount` (€20).
        *   Save.
- [ ] **Service Override**:
    *   Edit "Volume Lashes".
    *   Enable "Override Deposit".
    *   Set specific deposit to "Fixed Amount €50".
    *   *Verify*: This specific service requires €50, while others use the global setting.

### Booking Management
- [ ] **Calendar**: Check slots.
- [ ] **Instant Confirmation**: Client books a slot.
    *   *Verify*: Appears immediately as `confirmed` (green). No "Accept/Decline" needed.
- [ ] **No-Show Handling**:
    *   Open an appointment that is "current" or slightly past.
    *   Click "Mark as No-Show".
    *   *Verify*: Status updates. **No** charge is triggered (Master keeps deposit).
- [ ] **Loyalty QR**:
    *   Go to `Loyalty` or `Profile`.
    *   Display your "Master QR Code".
    *   *Verify*: Code is visible for Client to scan.

### Inventory & Perks (Merakí Only)
- [ ] **Private Stock**: Go to `Inventory`. Add "Glue Bottles" (Count: 5).
    *   Tap "-" button. Count goes to 4.
- [ ] **Shop Discount**: Go to `Shop` tab.
    *   *Verify*: Product prices are ~30% cheaper (Wholesale) than on Client account.

### Notifications & Automation
- [ ] **Confirmation Setup**: Settings -> Notifications. Set "Request Confirmation" to `48h before`.
- [ ] **Aftercare**: Set message "Don't wet lashes" -> Send `2 hours` after.

#### 🛠️ SQL Tools: Master Testing

**Simulate "Time to Confirm" (Trigger 48h notification)**:
```sql
-- Move appointment to 48 hours from now
UPDATE appointments
SET start_time = NOW() + INTERVAL '48 hours'
WHERE master_id = 'YOUR_MASTER_UUID_HERE'
LIMIT 1;
```

**Simulate "Aftercare Ready" (Recently Completed)**:
```sql
-- Mark appointment as finished 2 hours ago to trigger aftercare job
UPDATE appointments
SET 
    status = 'completed',
    end_time = NOW() - INTERVAL '2 hours'
WHERE master_id = 'YOUR_MASTER_UUID_HERE'
LIMIT 1;
```

---

## 👑 3. Owner Checklist (Admin)

### Platform Management
- [ ] **Global Oversight**: View list of all Masters.
- [ ] **Financials**:
    *   *Verify*: Check your Stripe Dashboard.
    *   Shop Sales -> Go to Owner Stripe.
    *   Academy Sales -> Go to Owner Stripe.

### Shop Management
- [ ] **Product Mgmt**: Add "New Serum". Upload image.
- [ ] **Stock Mgmt**: Set "Lash Tray" stock to 2.
- [ ] **Low Stock Alert**: Buy 2 Lash Trays as a user.
    *   *Verify*: Notification "Item out of stock" or "Low stock".

### Academy Management
- [ ] **Course Builder**: Create "Advanced Brows". Add Chapter 1 -> Lesson 1 -> Video URL.
- [ ] **Student Interaction**:
    *   Go to `Academy` -> `Students`.
    *   See "Work Submitted" by Client.
    *   Tap photo -> Reply "Great work!".

---

## ⚙️ 4. System & Technical Checklist (Backend)

### Database Cleanliness
- [ ] **Reset Data**: Ensure no "ghost" appointments from previous testing versions.

**SQL to Wipe Test Data (Careful!)**:
```sql
-- DANGER: Deletes all appointments and related data
DELETE FROM appointments;
DELETE FROM appointment_confirmations;
-- Optional: Reset services if needed
-- DELETE FROM services WHERE name LIKE '%Test%';
```


### Multi-Master Isolation
- [ ] **Data Separation**:
    *   Log in as **Master A**. Create a service "Master A Exclusive".
    *   Log in as **Master B**.
    *   *Verify*: You generally **cannot** see Master A's private services, appointments, or earnings.
    *   *Verify*: Your calendar is empty (does not show Master A's bookings).

### Cron Jobs Verification
- [ ] **Cron Run Log**: Verify jobs are actually running.

```sql
-- Check Supabase cron logs (if pg_cron extension enabled and visible)
SELECT * FROM cron.job_run_details 
ORDER BY start_time DESC 
LIMIT 10;
```

### Design Consistency
- [ ] **Theme Check**:
    *   Open `Appointments` tab.
    *   Open `Deposit Settings`.
    *   *Verify*: Background is "Midnight Glass" (Dark/Violet), not default white.
