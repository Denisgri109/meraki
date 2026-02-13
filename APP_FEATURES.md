# Merakí App - Complete Feature Documentation

> **Merakí** (μεράκι) - A Greek word meaning "to do something with soul, creativity, or love; to put something of yourself into your work."

---

## Overview

Merakí is a premium beauty and wellness booking platform that connects service providers ("Masters") with clients. The platform handles the complete lifecycle of appointments—from discovery and booking through to completion, payment, and post-service care.

---

## User Roles

### 1. **Client** (Customer)
Regular users who book beauty and wellness services.

### 2. **Master** (Service Provider)
Beauty and wellness professionals who offer services (hair stylists, nail artists, massage therapists, estheticians, etc.).

### 3. **Owner** (Platform Administrator)
Platform administrators with full access to manage the entire ecosystem.

---

# CLIENT FEATURES

## 1. Authentication & Onboarding

### Account Management
- **Email/Password Registration** - Create account with email and password
- **Email/Password Login** - Secure login with session persistence
- **Role Selection** - Choose between Client or Master during signup
- **Profile Creation** - Set up profile with name, photo, and contact info on signup
- **Password Recovery** - Forgot password with email reset link
- **Secure Session** - Automatic token refresh and secure storage

### Profile Management
- **View Profile** - Display personal information, avatar, and contact details
- **Edit Profile** - Update name, phone, bio, and profile photo
- **Avatar Upload** - Upload and change profile picture
- **Profile Visibility** - Masters can view client profiles and photos

---

## 2. Home & Discovery

### Home Screen
- **Personalized Greeting** - Time-of-day aware welcome message
- **Featured Masters Carousel** - Highlighted service providers
- **Quick Action Buttons** - Direct access to Shop, Orders, Support, and Promotions
- **Popular Services Grid** - Trending and recommended services
- **Pull-to-Refresh** - Refresh data with pull gesture

### Discover & Search
- **Browse Masters** - View all available service providers
- **City Filter** - Filter Masters by location/city
- **Master Profiles** - View detailed Master profiles with bio, services, portfolio, and availability
- **Service Discovery** - Browse services by category
- **Service Detail View** - See service information including description, duration, pricing, and available specialists

### Service Booking Flow
1. **Select Service** - Choose from available services
2. **Choose Master** - Pick from specialists offering the service
3. **View Master Detail** - Full profile with bio, services, and portfolio
4. **Select Date** - 30-day lookahead calendar
5. **Select Time** - Real-time availability based on Master's schedule
6. **Add Notes** - Special requests or requirements
7. **Confirm Booking** - Review and confirm appointment details

---

## 3. Appointments Management

### Appointment List
- **Unified History** - View all appointments in one place
- **Tabbed View** - Separate tabs for Upcoming, Past, and Cancelled appointments
- **Status Badges** - Visual indicators for Confirmed, Completed, Cancelled, Reschedule Pending, and No-Show
- **Appointment Cards** - Display date, time, service, Master, and price
- **Pull-to-Refresh** - Update appointment list

### Appointment Actions
- **View Details** - Full appointment information
- **Direct Chat** - Message Master directly from appointment
- **Reschedule** - Early reschedule (>24h before) is instant; Late reschedule (<24h before) requires Master approval
- **Cancel Appointment** - Early cancellation (>24h) is free and automatic; Late cancellation (<24h) shows warning with 50% penalty fee
- **Cancellation Reasons** - Provide reason for cancellation

### Appointment Confirmation System
- **Confirmation Requests** - Receive push notifications to confirm attendance
- **YES Response** - Confirm you'll attend the appointment
- **NO Response** - Cancel the appointment
- **Confirmation Deadline** - Must respond within specified time (e.g., 24h)
- **Status Display** - "Confirmed & Protected" badge when confirmed

### Financial Clarity
- **Price Breakdown** - Clear display of total service cost, deposit due now, and balance due at salon
- **Cancellation Policy** - Visible warning about fees for late cancellations

---

## 4. Communication

### In-App Messaging
- **Conversation List** - View all active conversations
- **Real-Time Chat** - Instant messaging with Masters and Owners
- **Text Messages** - Send and receive text
- **Image Sharing** - Upload and send photos
- **Video Sharing** - Upload and send videos
- **Photo Consultation** - Send photos for pre-service assessment
- **Message Grouping** - Messages grouped by sender
- **Timestamps** - Message time display
- **Keyboard-Aware Input** - Input field adjusts for keyboard

### Consultation System
- **Request Photo Consultation** - Send photos before booking for approval
- **Consultation Waiting Screen** - Wait for Master response
- **Pre-Service Questionnaire** - Answer questions like "Have you had this done before?"

---

## 5. Loyalty Program

### QR Code Scanning
- **Scan QR Codes** - Scan Master's QR code to earn points
- **Camera Integration** - In-app QR scanner
- **+50 Points Per Scan** - Automatic points awarded
- **Dynamic QR Codes** - Codes rotate after each scan for security

### Stamp Cards
- **View Stamp Cards** - See all loyalty cards from different Masters
- **Multiple Cards Per Master** - Support for different services (e.g., Lashes vs Brows)
- **Card Selection** - Choose which card to add stamp to
- **Progress Tracking** - Visual stamps showing progress

### Rewards
- **Rewards Catalog** - Browse available rewards
- **Redeem Points** - Exchange points for discounts or free services
- **Transaction History** - View all earned and redeemed points

---

## 6. Shop (E-Commerce)

### Product Browsing
- **Product Grid** - Browse all available products
- **Category Filtering** - Filter by product category
- **Search Functionality** - Search products by name
- **Product Detail View** - Product images, description, pricing (retail price for clients), and stock availability

### Shopping Cart
- **Add to Cart** - Add products to shopping cart
- **Cart Management** - View cart contents, adjust quantities, remove items, view cart total

### Checkout
- **Shipping Address** - Enter delivery address
- **Europe-Only Shipping** - Form restricts to European countries (blocks USA/Asia)
- **Payment Processing** - Secure Stripe payment
- **Order Placement** - Complete purchase

### Order History
- **View Orders** - List of all shop purchases
- **Order Details** - Products, quantities, prices, and status
- **Order Status** - Track order progress

---

## 7. Academy (Learning Platform)

### Course Discovery
- **Course Catalog** - Browse all available courses
- **Course Detail View** - Course description, lesson list, price, and instructor info
- **Course Purchase** - Buy courses through checkout

### Learning Experience
- **Video Player** - Watch course videos
- **Lesson Progress** - Track completion status
- **Lesson Navigation** - Move between lessons
- **Homework Submission** - Upload photos as homework, submit assignments for review, view feedback from instructors

---

## 8. Payments & Financial

### Payment Methods
- **Add Payment Method** - Save credit/debit cards
- **View Saved Cards** - List of saved payment methods
- **Set Default Card** - Choose default payment method
- **Delete Cards** - Remove saved payment methods
- **Secure Storage** - PCI-compliant card storage via Stripe

### Payment History
- **Transaction List** - All payments made
- **Transaction Details** - Date and amount, service or product, payment status, refund status

### Booking Payments
- **Pre-Authorization** - Hold funds at booking (not charged until service)
- **Deposit Payment** - Pay deposit to secure booking
- **Balance Due** - Remaining amount paid at salon
- **Mandate Deposit** - Some services require deposit to book

---

## 9. Support & Legal

### Help & Support
- **FAQ Section** - Frequently asked questions
- **Support Contact** - Contact platform support

### Legal Documents
- **Terms of Service** - Platform terms and conditions
- **Privacy Policy** - Data privacy information

### Notifications
- **Notification Center** - View all notifications
- **Push Notifications** - Booking confirmations, appointment reminders, reschedule requests, new messages, marketing/promotional offers

---

# MASTER FEATURES

## 1. Dashboard & Overview

### Master Dashboard
- **Today's Appointments** - Overview of scheduled appointments for today
- **Real-Time Statistics** - Today's bookings count, today's earnings, completion rate
- **Quick Stats Cards** - Visual summary of key metrics
- **Recent Messages Preview** - Latest client messages
- **Pull-to-Refresh** - Update dashboard data

---

## 2. Appointment Management

### Appointment List
- **Tabbed View** - Pending appointments, Upcoming appointments, Completed appointments
- **Appointment Cards** - Client details, service, time, and status
- **Status Badges** - Visual indicators for appointment states

### Appointment Actions
- **View Details** - Full appointment information
- **Confirm Appointment** - Approve pending bookings (instant confirmation available)
- **Decline Appointment** - Reject booking requests
- **Mark as Completed** - Indicate service was provided
- **Mark as No-Show** - Client didn't arrive
- **Direct Chat** - Message client from appointment
- **Reschedule** - Propose new date/time, client approval required for changes

### No-Show Management System
- **No-Show Action Modal** with three options:
  1. **Charge No-Show Fee Now** - Immediately charge client's card
  2. **Wait Grace Period** - Wait specified time (e.g., 30 min) before auto-charge
  3. **Client Arrived (Late)** - Mark as late arrival (no charge)
- **Grace Period Logic** - Automatic charge after grace period expires
- **No-Show Fee** - Configurable percentage of service price (e.g., 100%)
- **Late Arrival Tracking** - Record when clients arrive late

---

## 3. Schedule & Availability

### Weekly Availability
- **Weekly Schedule View** - Set availability for each day
- **Toggle Days** - Enable/disable availability per day
- **Time Selection** - Set start and end times for each day
- **Save Schedule** - Persist availability to system

### Blocked Slots
- **Block Time Slots** - Manually block specific time periods
- **Vacation Mode** - Block multiple days for time off
- **Reason Field** - Add notes (e.g., "Vacation", "Personal day", "Lunch break")
- **View Blocked Slots** - See all blocked periods

### Calendar View
- **Visual Calendar** - See appointments in calendar format
- **Time Slots** - View available and booked slots
- **Navigation** - Move between weeks/months

---

## 4. Service Management

### My Services
- **View All Services** - List of services offered
- **Service Details** - Name, duration, price, and description
- **Toggle Availability** - Enable/disable services
- **Custom Pricing** - Override default prices per service
- **Custom Duration** - Override default duration per service

### Create & Edit Services
- **Add New Service** - Service name, description, base price, duration, category, image
- **Edit Service** - Modify existing services
- **Deposit Override** - Set specific deposit requirements per service
- **Delete Service** - Remove services no longer offered

---

## 5. Business Settings

### Deposit Configuration
- **Require Deposit Toggle** - Turn deposit requirement ON/OFF
- **Global Deposit Settings** - Percentage mode (e.g., 20% of service price) or Fixed amount mode (e.g., €20 flat fee)
- **Per-Service Override** - Different deposit for specific services
- **Service-Level Deposit** - Set unique deposit amount for each service

### Confirmation Settings
- **Request Confirmation Timing** - When to ask clients to confirm (e.g., 48h before)
- **Response Timeout** - How long clients have to respond (e.g., 24h)
- **Auto-Cancel** - Automatically cancel unconfirmed appointments after deadline

### No-Show Policy
- **No-Show Charge Percentage** - How much to charge (e.g., 100% of service price)
- **Late Arrival Threshold** - When client is considered late (e.g., 15 minutes)
- **Grace Period Multiplier** - Wait time before charging (e.g., 50% of service duration)
- **Terms & Conditions** - Custom booking terms clients must agree to

### Notification Settings
- **Push Notification Preferences** - Choose which notifications to receive
- **Confirmation Reminders** - Automated reminders to clients
- **Aftercare Campaigns** - Automated post-appointment messages

---

## 6. Aftercare Campaigns

### Campaign Management
- **Create Aftercare Messages** - Write post-service care instructions
- **Schedule Timing** - Set when to send (e.g., 2 hours after appointment)
- **Message Content** - Custom text (e.g., "Don't wet your lashes for 24 hours")
- **Active Campaigns** - View and manage running campaigns
- **Automated Delivery** - Messages sent automatically after appointment completion

---

## 7. Earnings & Financial

### Earnings Tracking
- **Earnings Summary** - Today's earnings, This week's earnings, This month's earnings
- **Transaction History** - List of all payments received
- **Earnings Breakdown** - Filter by time period
- **Payout Status** - Track payout processing

### Stripe Connect
- **Connect Bank Account** - Link Stripe account for payouts
- **Stripe Dashboard Access** - View detailed financials in Stripe
- **Payout Settings** - Configure payout schedule

---

## 8. Loyalty Program (Master Side)

### QR Code Generation
- **Display QR Code** - Show unique QR code for clients to scan
- **Dynamic Codes** - QR code rotates after each scan for security
- **QR Code Sharing** - Display full-screen for easy scanning

### Loyalty Card Builder
- **Create Loyalty Cards** - Design custom stamp cards
- **Multiple Cards** - Create different cards for different services (e.g., "Lash Loyalty" and "Brow Loyalty")
- **Card Naming** - Custom names for each card
- **Stamp Requirements** - Set how many stamps for reward
- **Reward Definition** - Define what clients get (discount, free service, etc.)

### Reward Management
- **Manage Rewards** - View and edit available rewards
- **Reward Catalog** - List of redeemable items
- **Points System** - Configure points per scan (+50 default)

---

## 9. Inventory & Supplies

### Supply Management
- **Add Supplies** - Track products used for services (name, quantity, unit, low stock threshold, cost per unit)
- **Update Stock** - Add or remove inventory
- **Low Stock Alerts** - Notifications when supplies run low
- **Supply History** - Track usage over time

### Service-Supply Linking
- **Link Supplies to Services** - Define which supplies used for each service
- **Usage Tracking** - Automatically deduct supplies when marking appointments complete
- **Cost Calculation** - Track cost per service based on supplies used

---

## 10. Portfolio

### Portfolio Management
- **Upload Photos** - Add work samples to portfolio
- **Photo Gallery** - View all portfolio images
- **Delete Photos** - Remove outdated work samples
- **Portfolio Display** - Public gallery visible to clients

---

## 11. Consultation Reviews

### Photo Consultation Review
- **View Submitted Photos** - See client consultation requests
- **Review Requests** - Assess if service is appropriate
- **Approve/Decline** - Respond to consultation requests
- **Send Feedback** - Provide comments to client

### Booking Consultation Review
- **View Booking Consultations** - See consultation requests attached to bookings
- **Pre-Service Assessment** - Evaluate client's suitability
- **Approve Bookings** - Confirm or decline based on consultation

---

## 12. Profile & Settings

### Master Profile
- **View Public Profile** - See what clients see
- **Edit Bio** - Update professional description
- **Set Location** - Business address and city
- **Profile Photo** - Upload professional photo

### General Settings
- **Notification Preferences** - Configure push notifications
- **Business Hours** - Set operating hours
- **Account Settings** - Password, email, etc.

---

# OWNER (ADMIN) FEATURES

Owners have access to **all Master features** plus the following administrative capabilities:

## 1. Platform Management

### Master Management
- **View All Masters** - List of all service providers on platform
- **Master Invitations** - Send invitations to new Masters
- **Pending Approvals** - Review and approve new Master applications
- **Master Profiles** - View and edit Master information
- **Deactivate Masters** - Disable Master accounts if needed

### Global Oversight
- **Platform Statistics** - High-level metrics across all Masters
- **Revenue Tracking** - Total platform earnings
- **Booking Analytics** - Platform-wide booking data
- **User Statistics** - Total clients, Masters, and Owners

---

## 2. Shop Management

### Product Management
- **Add Products** - Create new shop products (name, description, price, category, images, stock quantity)
- **Edit Products** - Modify existing products
- **Delete Products** - Remove products from shop
- **Stock Management** - Update inventory levels

### Inventory Dashboard
- **View All Inventory** - Platform-wide stock levels
- **Low Stock Alerts** - Notifications when products run low
- **Stock History** - Track inventory changes
- **Supplier Management** - Track product suppliers

### Pricing
- **Retail Pricing** - Set prices for clients
- **Wholesale Pricing** - Set prices for Masters (typically ~30% discount)
- **Dual Pricing Display** - System automatically shows correct price based on user role

---

## 3. Academy Management

### Course Management
- **Create Courses** - Build new courses (title, description, cover image, price, publish/unpublish)
- **Edit Courses** - Modify course content
- **Delete Courses** - Remove courses
- **Curriculum Builder** - Add chapters, add lessons within chapters, organize content structure

### Lesson Management
- **Create Lessons** - Add video content (Video URL from Vimeo/Mux/YouTube, Direct video upload, lesson resources, homework toggle)
- **Edit Lessons** - Update lesson content
- **Lesson Ordering** - Arrange lesson sequence

### Student Management
- **View Students** - List of enrolled students
- **Student Analytics** - Revenue per course, enrollment counts, completion rates
- **Student Progress** - Track individual student advancement

### Homework Review
- **Homework Inbox** - View all pending homework submissions
- **Review Submissions** - View submitted photos, provide feedback/comments, approve or reject homework, send feedback to students
- **Pending Badge** - Visual indicator of unreviewed homework

---

## 4. Service Catalog Management

### Service Administration
- **Create Global Services** - Define services available to all Masters
- **Edit Services** - Modify service definitions
- **Delete Services** - Remove services from platform
- **Service Categories** - Organize services by category

---

## 5. Owner Supplies

### Platform Inventory
- **Owner Supplies Screen** - Track platform-wide supplies
- **Add Owner Supply** - Add products to platform stock
- **Supply Tracking** - Monitor stock levels
- **Usage Reports** - Track supply consumption

---

## 6. Platform Notifications

### Marketing Notifications
- **Send Promotional Notifications** - Push notifications to all users
- **Targeted Campaigns** - Send to specific user segments
- **Notification History** - Track sent notifications

---

## 7. Financial Management

### Platform Revenue
- **Shop Sales** - Revenue from product sales (goes to Owner Stripe)
- **Academy Sales** - Revenue from course purchases (goes to Owner Stripe)
- **Commission Tracking** - Track earnings from Master services
- **Payout Management** - Manage Master payouts

### Stripe Integration
- **Owner Stripe Dashboard** - View all platform transactions
- **Financial Reports** - Generate revenue reports
- **Refund Processing** - Issue refunds when necessary

---

# COMMUNICATION FEATURES

## Universal Chat System

All user roles (Client, Master, Owner) can communicate:

### Chat List
- **Conversation List** - All active conversations
- **Recent Messages** - Preview of last message
- **Unread Indicators** - Badge showing unread count
- **User Info** - Name and profile photo of other party

### Chat Interface
- **Real-Time Messaging** - Instant message delivery
- **Text Messages** - Send and receive text
- **Image Sharing** - Upload and view photos
- **Video Sharing** - Upload and view videos
- **Message Status** - Sent/delivered indicators
- **Timestamps** - Message time display
- **Profile Photos** - See other user's avatar in chat

### Conversation Types
- **Client ↔ Master** - Direct communication about bookings
- **Client ↔ Owner** - Support and platform inquiries
- **Master ↔ Owner** - Administrative communication

---

# NOTIFICATION FEATURES

## Push Notifications

### Booking Notifications
- **New Booking** - Master receives notification when client books
- **Booking Confirmed** - Client receives confirmation
- **Reschedule Request** - Both parties notified of reschedule requests
- **Reschedule Approved/Declined** - Notification of reschedule decision
- **Cancellation** - Notification when appointment cancelled
- **Confirmation Reminder** - Reminder to confirm appointment (24h, 1h before)

### Appointment Reminders
- **24-Hour Reminder** - Day-before appointment reminder
- **1-Hour Reminder** - One hour before appointment
- **Confirmation Request** - Ask client to confirm attendance

### No-Show & Late
- **No-Show Marked** - Client notified when marked no-show
- **Grace Period Expiring** - Warning before auto-charge
- **Late Arrival Noted** - Notification when marked as late

### Messaging
- **New Message** - Notification when receiving chat message

### Shop & Academy
- **Order Confirmed** - Purchase confirmation
- **Order Shipped** - Shipping notification
- **Low Stock Alert** - Admin/Master notified of low inventory
- **Course Purchase** - Enrollment confirmation
- **Homework Feedback** - Notification when homework reviewed

### Marketing
- **Promotional Offers** - Special deals and discounts
- **New Features** - Platform updates
- **Event Announcements** - Special events or promotions

---

# PAYMENT FEATURES

## Payment Processing

### Stripe Integration
- **Secure Payments** - PCI-compliant payment processing
- **Multiple Payment Methods** - Support for various card types
- **3D Secure** - Additional authentication for security

### Saved Payment Methods
- **Add Cards** - Save credit/debit cards securely
- **View Saved Cards** - List with brand, last 4 digits, expiry
- **Set Default** - Choose primary payment method
- **Delete Cards** - Remove saved methods

### Booking Payments
- **Pre-Authorization** - Hold funds on card at booking (not charged until service)
- **Deposit Collection** - Charge deposit amount to secure booking
- **Balance Collection** - Remaining amount handled at salon (or charged later)
- **No-Show Fee Capture** - Automatically charge no-show fees
- **Service Completion Charge** - Capture held funds after service

### Shop Payments
- **Immediate Charge** - Products charged at checkout
- **Order Processing** - Payment confirmation before shipping

### Refunds
- **Full Refunds** - Complete refund for cancelled services
- **Partial Refunds** - Partial refund for disputes or adjustments
- **No-Show Fee Refunds** - Refund no-show fees if disputed successfully

### Payouts (Master/Owner)
- **Stripe Connect** - Connect bank account
- **Automatic Payouts** - Scheduled transfers to bank
- **Payout Tracking** - View pending and completed payouts
- **Earnings Reports** - Detailed financial summaries
