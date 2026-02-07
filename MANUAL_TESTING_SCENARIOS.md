# Merakí App - Manual Testing Scenarios

A hands-on guide to test all major features by role. No SQL required — just use the app!

---

## 🧪 TEST 1: Pre-Booking Consultation (Requires Master Approval)

**What it tests:** Services like Brow Tattoo that need master review before booking.

### How to Test:

**👤 As Client:**
1. Open the app and log in as a client
2. Browse services and find one marked as "Requires Consultation" (e.g., Brow Tattoo, Microblading)
3. Select a Master and tap "Book"
4. You'll be prompted to fill out a consultation form:
   - Have you had this service before? (Yes/No)
   - If yes, how long ago?
   - Was it done by this master?
   - Upload photos of current state
   - Add notes about what you want
5. Submit the consultation request
6. You should see a confirmation that your request was sent

**👩‍🎨 As Master:**
1. Log in as the master who received the request
2. Go to "Consultation Requests" or "Booking Reviews"
3. Find the pending consultation
4. Review the client's photos and notes
5. Choose one of:
   - **Approve** → Client can now book the service
   - **Decline** → Enter a reason (e.g., "Need to wait 6 weeks")
   - **Chat** → Ask the client questions first

**✅ Expected Result:** After approval, the client can complete their booking.

---

## 🧪 TEST 2: No-Show with Grace Period

**What it tests:** Marking a client as no-show and the grace period before charging.

### How to Test:

**Setup:** Need a confirmed appointment at or past its start time.

**👩‍🎨 As Master:**
1. Log in and go to Today's Appointments
2. Find an appointment where the client hasn't arrived
3. Tap on the appointment → "Client Didn't Arrive" or "Mark No-Show"
4. System starts a grace period (time based on your settings)

**Option A - Client Arrives Late:**
1. If client shows up during grace period
2. Tap "Client Arrived Late"
3. The no-show charge is cancelled, appointment proceeds

**Option B - Grace Period Expires:**
1. If you don't tap anything, wait for grace period to end
2. System automatically charges the deposit/no-show fee

**✅ Expected Result:** Late arrival saves the charge; expired grace period = charge applied.

---

## 🧪 TEST 3: Appointment Reschedule

**What it tests:** Either party requesting a time change, other party approving.

### How to Test:

**👩‍🎨 As Master (or 👤 Client):**
1. Find a future confirmed appointment
2. Tap on it → "Request Reschedule" or "Propose New Time"
3. Select a new date and time
4. Submit the request

**👤 As the Other Party:**
1. You'll receive a notification about the reschedule request
2. View the proposed new time
3. Choose:
   - **Accept** → Appointment moves to new time
   - **Suggest Different** → Counter-propose your own time
   - **Decline** → Keep the original time

**✅ Expected Result:** After approval, the appointment shows the new time.

---

## 🧪 TEST 4: Deposit Payment

**What it tests:** Collecting a deposit when booking an appointment.

### How to Test:

**👩‍🎨 As Master (or Owner):**
1. Go to Settings → Booking Settings
2. Enable "Require Deposit"
3. Set deposit type:
   - Fixed amount (e.g., $20)
   - Percentage (e.g., 20% of service price)
4. Save settings

**👤 As Client:**
1. Book an appointment with this master
2. On the payment screen, you'll see the deposit amount
3. Enter payment details (test card: `4242 4242 4242 4242`)
4. Complete the payment

**✅ Expected Result:** Booking confirmed, deposit collected, shown in appointment details.

---

## 🧪 TEST 5: Loyalty Stamp Card

**What it tests:** Client earning stamps and redeeming rewards.

### How to Test:

**👩‍🎨 As Master:**
1. Go to Loyalty / Stamp Cards section
2. Make sure you have an active stamp card configured
3. Tap "Show QR Code" to display your stamp scanner

**👤 As Client:**
1. Go to Loyalty / My Stamp Cards
2. Tap "Scan QR Code" or "Collect Stamp"
3. Scan the Master's QR code
4. You should see your stamp count increase!

**Redeeming a Reward:**
1. After collecting enough stamps (e.g., 10 of 10)
2. Go to your filled stamp card
3. Tap "Redeem Reward"
4. Apply it to your next booking

**✅ Expected Result:** Stamps add up, reward becomes available when full.

---

## 🧪 TEST 6: Photo Consultation

**What it tests:** Client sending photos for professional assessment.

### How to Test:

**👤 As Client:**
1. Go to Photo Consultations or "Ask a Pro"
2. Select a service type (Nail Art, Brow Shape, etc.)
3. Upload 1-3 photos
4. Describe what you're looking for
5. Choose which Master to ask (or "Any")
6. Submit

**👩‍🎨 As Master:**
1. Go to Photo Consultations / Reviews
2. Find the pending request
3. View the photos
4. Respond with:
   - Is it doable? (Yes/No)
   - Your professional notes
   - Recommendations
   - Estimated price range
   - Estimated time needed
5. Submit your response

**✅ Expected Result:** Client sees your response and can book if doable.

---

## 🧪 TEST 7: Late Cancellation Fee

**What it tests:** Fee applied when canceling too close to appointment time.

### How to Test:

**Setup:** Master must have cancellation policy set (e.g., 24-hour window, 50% fee).

**👤 As Client:**
1. Find a confirmed appointment within the cancellation window (e.g., less than 24 hours away)
2. Tap on it → "Cancel Appointment"
3. You'll see a warning about the cancellation fee
4. Confirm the cancellation

**✅ Expected Result:** Appointment cancelled, fee charged to your card.

---

## 🧪 TEST 8: Appointment Confirmation

**What it tests:** Client must confirm they're coming before the deadline.

### How to Test:

**Setup:** Book an appointment — it will be set to "Awaiting Confirmation"

**👤 As Client:**
1. You'll receive a push notification asking to confirm
2. Go to My Appointments
3. Find the appointment awaiting confirmation
4. Tap "Confirm Attendance" or "I'll be there"

**Alternative Test:**
1. Tap "I can't make it"
2. This triggers the reschedule/cancel flow

**If deadline passes without response:**
- Appointment auto-cancels

**✅ Expected Result:** Confirming changes status to "Confirmed"

---

## 🧪 TEST 9: Block Time / Vacation

**What it tests:** Masters blocking off unavailable times.

### How to Test:

**👩‍🎨 As Master:**
1. Go to Schedule / Calendar
2. Tap on a date
3. Select "Block Time"
4. Set:
   - Start time
   - End time
   - Reason (e.g., "Lunch", "Vacation", "Personal")
5. Save

**👤 As Client (verify it works):**
1. Try to book an appointment during that blocked time
2. The time slot should NOT appear in available slots

**✅ Expected Result:** Blocked time is unavailable for client bookings.

---

## 🧪 TEST 10: Supply Inventory Auto-Deduction

**What it tests:** Supplies automatically decrease when appointment completes.

### How to Test:

**Setup:** Need supplies linked to a service.

**👩‍🎨 As Master:**
1. Note your current stock level for a supply (e.g., "Lash Glue: 50 units")
2. Complete an appointment for the service that uses that supply
3. Mark the appointment as "Complete"
4. Go to Supplies/Inventory
5. Check the stock level — it should have decreased

**✅ Expected Result:** Supply quantity reduced based on quantity-per-service setting.

---

## 🧪 TEST 11: Low Stock Alert

**What it tests:** Alert when supplies drop below threshold.

### How to Test:

**👩‍🎨 As Master:**
1. Go to Supplies/Inventory
2. Find a supply and note its low stock threshold (e.g., 5)
3. Either:
   - Edit the quantity to below threshold, OR
   - Complete enough appointments to use up the supply
4. Return to Supplies screen
5. You should see a "Low Stock" warning or alert

**✅ Expected Result:** Visual indicator shows which supplies need reordering.

---

## 🧪 TEST 12: Terms & Conditions Re-Acceptance

**What it tests:** Clients must re-accept T&C after master updates them.

### How to Test:

**👩‍🎨 As Master:**
1. Go to Settings → Terms & Conditions
2. Edit the terms text (add a line, change wording)
3. Save changes

**👤 As Client (who previously booked with this master):**
1. Try to book a new appointment with this master
2. You should be prompted to review and accept the new T&C
3. Accept to proceed with booking

**✅ Expected Result:** Can't book until accepting updated terms.

---

## 🧪 TEST 13: Campaign/Marketing Notifications

**What it tests:** Automated aftercare or promotional messages.

### How to Test:

**👩‍🎨 As Master:**
1. Go to Marketing / Campaigns
2. Create a new campaign:
   - **Type:** Aftercare, Promotion, or Vacation Notice
   - **Message:** Your custom message
   - **Days after appointment:** (for aftercare, e.g., 3 days)
   - **Service category:** (optional filter)
3. Activate the campaign

**Wait for trigger:**
- For aftercare: Wait X days after a completed appointment
- For promotion: Should send to eligible clients
- For vacation: Broadcasts to all clients immediately

**👤 As Client:**
- Check push notifications for the campaign message

**✅ Expected Result:** Clients receive the configured notification.

---

## 🧪 TEST 14: Shop Order Flow

**What it tests:** Owner selling products, client purchasing.

### How to Test:

**👑 As Owner:**
1. Go to Shop / Products
2. Add a new product:
   - Name and description
   - Price
   - Stock quantity
   - Upload product image
   - Set available countries
3. Publish / Activate the product

**👤 As Client:**
1. Browse the Shop section
2. Find and tap on the product
3. Add to cart
4. Proceed to checkout
5. Enter shipping address
6. Complete payment

**👑 As Owner (fulfill):**
1. Go to Orders
2. Find the new order
3. Mark as "Shipped" (optionally enter tracking number)
4. Later, mark as "Delivered"

**✅ Expected Result:** Order placed, stock decreased, owner can fulfill.

---

## 🧪 TEST 15: Weekly Availability Schedule

**What it tests:** Master sets working hours, clients can only book during those times.

### How to Test:

**👩‍🎨 As Master:**
1. Go to Settings → Schedule / Availability
2. Set your working hours for each day:
   - Monday: 9:00 AM - 6:00 PM ✓
   - Sunday: Mark as UNAVAILABLE ✗
3. Save your schedule

**👤 As Client (verify):**
1. Try to book with this master on a Sunday
2. No time slots should appear
3. Try to book on Monday
4. Only slots between 9 AM - 6 PM should show

**✅ Expected Result:** Available slots match master's schedule exactly.

---

## 📱 Quick Test Checklist

| # | Test | Client | Master | Owner |
|---|------|--------|--------|-------|
| 1 | Pre-Booking Consultation | ✓ Submit | ✓ Review | - |
| 2 | No-Show Grace Period | - | ✓ Mark | - |
| 3 | Reschedule Flow | ✓ Request/Approve | ✓ Request/Approve | - |
| 4 | Deposit Payment | ✓ Pay | ✓ Configure | - |
| 5 | Stamp Card | ✓ Scan | ✓ Show QR | - |
| 6 | Photo Consultation | ✓ Submit | ✓ Respond | - |
| 7 | Late Cancellation | ✓ Cancel | - | - |
| 8 | Confirm Attendance | ✓ Confirm | - | - |
| 9 | Block Time | - | ✓ Block | - |
| 10 | Supply Deduction | - | ✓ Complete apt | - |
| 11 | Low Stock Alert | - | ✓ Check | - |
| 12 | T&C Update | ✓ Re-accept | ✓ Update | - |
| 13 | Campaigns | ✓ Receive | ✓ Create | - |
| 14 | Shop Orders | ✓ Purchase | - | ✓ Add/Fulfill |
| 15 | Availability | ✓ See slots | ✓ Set hours | - |

---

## 🔑 Test Accounts Needed

To fully test all scenarios, you need:

- **1 Client account**
- **1 Master account** 
- **1 Owner account**

Use different devices or browsers to simulate multi-user interactions.

---

## 💡 Tips

- **Test cards:** Use `4242 4242 4242 4242` for successful payments
- **Push notifications:** Make sure you've allowed notifications on your device
- **Time-sensitive tests:** For no-show and confirmation tests, you may need to adjust system time or wait
- **Take screenshots:** Document any issues you find with screenshots

---

*Last updated: February 2026*
