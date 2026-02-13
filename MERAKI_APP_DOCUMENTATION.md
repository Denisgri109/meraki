# Merakí App - Complete Documentation

## Table of Contents
1. [Executive Overview](#executive-overview)
2. [User Roles & Permissions](#user-roles--permissions)
3. [Authentication Flow](#authentication-flow)
4. [Client Experience](#client-experience)
5. [Master Experience](#master-experience)
6. [Owner Experience](#owner-experience)
7. [Shared Features](#shared-features)
8. [Terms of Service](#terms-of-service)
9. [Privacy Policy](#privacy-policy)
10. [Navigation Architecture](#navigation-architecture)
11. [Key Features Deep Dive](#key-features-deep-dive)

---

## Executive Overview

**Merakí** is a premium React Native mobile application built with Expo, designed for the beauty and wellness industry. The platform serves as a comprehensive ecosystem connecting three distinct user types: **Clients** (customers seeking services), **Masters** (beauty professionals providing services), and **Owners** (platform administrators and salon owners).

### Core Purpose
Merakí streamlines the entire beauty service experience by providing:
- **Service Discovery & Booking**: Clients can browse services, view master portfolios, and book appointments
- **E-commerce**: Integrated shop for beauty products with dual pricing (retail/wholesale)
- **Education Platform**: Academy offering professional courses and certifications
- **Loyalty & Rewards**: QR/NFC-based stamp cards and points system
- **Business Management**: Complete toolset for masters to manage their practice
- **Platform Administration**: Full control for owners to manage the entire ecosystem

### Target Audience
- **Clients**: Beauty-conscious individuals seeking professional services, products, and education
- **Masters**: Independent beauty professionals and salon staff managing appointments and client relationships
- **Owners**: Salon owners, platform administrators, and business managers overseeing operations

### Platform Value Proposition
1. **All-in-One Solution**: Booking, shopping, learning, and loyalty in one app
2. **Professional Networking**: Direct connection between clients and verified beauty professionals
3. **Business Growth Tools**: Comprehensive analytics, marketing, and management features for masters
4. **Seamless Payments**: Secure payment processing with pre-authorization and automated fee handling
5. **Educational Excellence**: Professional courses with homework submission and grading

---

## User Roles & Permissions

### Client Role
**Primary Function**: Service consumer and learner

**Capabilities**:
- Browse and book beauty services
- View master profiles, portfolios, and reviews
- Manage appointments (reschedule, cancel within policy)
- Purchase products from the shop
- Enroll in and complete Academy courses
- Earn and redeem loyalty points and stamp cards
- Communicate with masters via chat
- Manage payment methods and view transaction history
- Submit photo consultations for service approval
- Scan QR codes and use NFC for loyalty stamps
- Receive push notifications for appointments and promotions

**Access Level**: Limited to personal data and public platform content

### Master Role
**Primary Function**: Service provider and business operator

**Capabilities** (includes all Client capabilities plus):
- **Dashboard Management**: View today's appointments, statistics, and recent activity
- **Appointment Control**: Accept, decline, reschedule, and mark appointments complete
- **Availability Management**: Set weekly schedules and block time slots
- **Service Portfolio**: Create, edit, and toggle service offerings
- **Earnings Tracking**: Monitor income with time-period filtering and analytics
- **Business Settings**: Configure deposit requirements, cancellation policies, and no-show fees
- **Portfolio Management**: Upload and organize work photos
- **Client Communication**: Respond to photo consultations and chat messages
- **Loyalty Program**: Generate QR codes for clients, create custom stamp cards, manage rewards
- **Aftercare Campaigns**: Set up automated post-service messages
- **Inventory Tracking**: Monitor supplies and link them to services
- **Consultation Reviews**: Review and approve/reject photo consultation requests

**Access Level**: Personal business data plus client booking information

### Owner Role
**Primary Function**: Platform administrator and business overseer

**Capabilities** (includes all Master capabilities plus):
- **Master Management**: Invite, approve, edit, and manage all masters on the platform
- **Service Catalog**: Create and manage platform-wide service offerings
- **Shop Administration**: Add products, manage inventory with dual pricing (retail/wholesale)
- **Supplies Management**: Track platform-level supplies inventory
- **Academy Management**: 
  - Create and edit courses
  - Add and manage lessons (video content)
  - Review and grade homework submissions
  - Track student enrollment and progress
- **Student Analytics**: View detailed analytics on course enrollment, completion rates, and student performance
- **Platform Notifications**: Send marketing and announcement push notifications to all users
- **Comprehensive Dashboard**: View platform-wide statistics, revenue, and user activity

**Access Level**: Full administrative access to all platform data and management functions

---

## Authentication Flow

The authentication system provides secure access to the platform with multiple verification methods and role-based routing.

### 1. Login Screen
**Purpose**: Primary entry point for existing users

**Features**:
- Email address input field
- Password input field with visibility toggle
- "Remember me" option for persistent login
- "Forgot Password?" link for account recovery
- "Create Account" button for new user registration
- Real-time validation for email format and password requirements
- Secure credential transmission

**User Flow**:
1. User enters registered email address
2. User enters password
3. System validates credentials against Supabase Auth
4. On success, user is routed to appropriate dashboard based on role (Client/Master/Owner)
5. Session token is stored securely for automatic login

**Error Handling**:
- Invalid email format: Real-time validation message
- Incorrect password: Generic error message for security
- Unverified email: Prompt to verify email first
- Account disabled: Contact support message

### 2. Register Screen
**Purpose**: Account creation for new users

**Features**:
- **Role Selection**: Three radio button options:
  - Client: "I want to book services and shop"
  - Master: "I provide beauty services"
  - Owner: "I manage a salon or platform"
- Full name input
- Email address input with validation
- Phone number input (optional, for booking confirmations)
- Password input with strength indicator
- Password confirmation field
- Terms of Service checkbox (required)
- Privacy Policy acknowledgment link
- "Already have an account? Login" link

**User Flow**:
1. User selects desired role
2. User fills in personal information
3. User creates secure password (min 8 characters, complexity requirements)
4. User accepts Terms of Service
5. System validates all fields
6. Account is created in Supabase Auth
7. Verification email is sent
8. User is redirected to OTP verification screen

**Validation Rules**:
- Email must be unique and valid format
- Password minimum 8 characters with uppercase, lowercase, number
- Phone number validated if provided
- Terms must be accepted

### 3. Verify OTP Screen
**Purpose**: Email verification and account activation

**Features**:
- 6-digit OTP input field
- Resend OTP button (with 60-second cooldown)
- "Didn't receive email?" troubleshooting tips
- Visual countdown timer for resend availability
- Auto-fill support for OTP from email

**User Flow**:
1. System sends 6-digit verification code to registered email
2. User retrieves code from email
3. User enters code in app
4. System verifies code against Supabase
5. On success, account is activated
6. User is routed to appropriate dashboard based on selected role

**Master/Owner Special Flow**:
- Masters and Owners may be redirected to onboarding screens after verification
- Owner accounts may require additional admin approval

### 4. Forgot Password Screen
**Purpose**: Account recovery for users who forgot their password

**Features**:
- Email address input field
- "Send Reset Link" button
- Back to login link
- Success confirmation message
- Error messaging for non-existent emails

**User Flow**:
1. User enters registered email address
2. System validates email exists
3. Password reset email is sent via Supabase Auth
4. User receives email with reset link
5. User clicks link in email (opens browser or app deep link)
6. User creates new password
7. User is redirected to login with success message

**Security Features**:
- Reset links expire after 24 hours
- Rate limiting to prevent abuse
- Previous sessions invalidated after password change

### 5. Terms Screen (Auth Flow)
**Purpose**: Display Terms of Service during registration

**Features**:
- Full Terms of Service content in scrollable view
- Section headers for easy navigation
- "I Agree" button at bottom
- "Cancel" option to decline and return to registration
- Last updated date display

**Content Sections**:
1. Acceptance of Terms
2. Use of Service (including age requirement of 18+)
3. User Accounts (credential confidentiality)
4. Cancellations & No-Shows (fee policies)
5. Privacy Policy reference
6. Modifications (terms update policy)
7. Last Updated date

**User Flow**:
1. User clicks "Terms of Service" during registration
2. Full terms are displayed
3. User scrolls through all sections
4. User taps "I Agree" to accept
5. Checkbox on registration screen is automatically checked
6. User can proceed with registration

---

## Client Experience

The Client experience is designed around service discovery, booking convenience, and loyalty rewards. All screens follow a consistent premium design language with the Merakí brand aesthetic.

### Home Tab (Main Dashboard)

#### Home Screen
**Purpose**: Personalized dashboard and main entry point for clients

**Features**:
- **Welcome Section**: Personalized greeting with user's first name
- **Upcoming Appointments Card**: 
  - Shows next scheduled appointment (service name, master name, date/time)
  - "View All" button to see all appointments
  - Quick actions: Reschedule, Cancel, Directions
- **Loyalty Points Display**: Current points balance with visual indicator
- **Featured Masters Carousel**: 
  - Horizontal scroll of recommended masters
  - Profile photo, name, specialty, rating
  - Tap to view full master profile
- **Quick Actions Grid**:
  - "Book Now" - Jump to booking flow
  - "My Appointments" - View all bookings
  - "Shop" - Browse products
  - "Academy" - View courses
- **Recent Activity Feed**: Latest bookings, loyalty stamps earned
- **Promotional Banner**: Platform announcements and special offers
- **Notification Badge**: Unread notifications indicator

**User Interactions**:
- Pull-to-refresh updates all dashboard data
- Tap on appointment card for full details
- Swipe on master carousel for more recommendations
- Tap quick action buttons for immediate navigation

**Empty States**:
- First-time users see "Welcome to Merakí!" onboarding tips
- No upcoming appointments shows "Ready to book?" CTA

### Booking Flow

#### Booking Screen (Service Selection)
**Purpose**: Browse and select beauty services

**Features**:
- **Category Filter Tabs**: Horizontal scroll of service categories:
  - All Services
  - Hair
  - Nails
  - Skincare
  - Makeup
  - Massage
  - Spa
  - Other
- **Service List**: Vertical scroll of available services
  - Service thumbnail image
  - Service name
  - Description (truncated with "Read more")
  - Starting price range
  - Duration estimate
  - Rating and review count
  - "Book Now" button
- **Search Bar**: Search services by name or keyword
- **Sort Options**: Price (low to high), Rating, Popularity
- **Filter Drawer**: Advanced filters for price range, duration, availability

**User Flow**:
1. Client browses categories or searches for specific service
2. Client taps on service card for details
3. Client taps "Book Now" to proceed

**Empty States**:
- Category with no services shows "No services available in this category"
- Search with no results shows suggestions and "Browse all services" link

#### Service Detail Screen
**Purpose**: Detailed view of a specific service with master selection

**Features**:
- **Service Header**:
  - Full-width hero image carousel (multiple service photos)
  - Service name and category badge
  - Average rating with star display
  - Review count with "See reviews" link
- **Service Information**:
  - Full description
  - Duration (e.g., "90 minutes")
  - Price range (e.g., "€50 - €80")
  - What's included list
  - Preparation instructions
- **Available Masters Section**:
  - List of masters offering this service
  - Master profile photo
  - Name and specialty
  - Individual pricing for this master
  - Rating and review count
  - "Select" button
  - "View Profile" link for full master details
- **Reviews Section**:
  - Recent client reviews
  - Star rating breakdown
  - Photo reviews if available
- **Related Services**: Similar services client might like

**User Flow**:
1. Client views detailed service information
2. Client scrolls through available masters
3. Client taps "Select" on chosen master
4. Client proceeds to date/time selection

**Special Features**:
- "Save to Favorites" option (heart icon)
- Share service via social/media
- "Ask a question" button for service inquiries

#### Select Date & Time Screen
**Purpose**: Choose appointment date and time slot

**Features**:
- **Calendar View**:
  - Monthly calendar with selectable dates
  - Dates with availability highlighted
  - Selected date highlighted
  - 30-day lookahead limit
  - Swipe to change months
- **Time Slot Selection**:
  - Available time slots for selected date
  - Morning, Afternoon, Evening sections
  - Each slot shows start time and end time
  - Unavailable slots grayed out
  - Selected slot highlighted
- **Selected Service Summary**:
  - Service name
  - Master name and photo
  - Selected date display
  - Price
- **Duration Display**: Shows appointment length
- **Time Zone Indicator**: Shows local time zone

**User Flow**:
1. Client selects date from calendar
2. System fetches available time slots from master's schedule
3. Client selects preferred time slot
4. Client taps "Continue" to proceed to confirmation

**Constraints**:
- Cannot book dates in the past
- Maximum 30 days in advance
- Respects master's blocked slots and existing appointments
- Time slots based on service duration

**Empty States**:
- No available slots on selected date shows "No availability" with suggestion to try nearby dates
- Master fully booked shows alternative masters suggestion

#### Booking Confirm Screen
**Purpose**: Final review and payment for appointment

**Features**:
- **Booking Summary Card**:
  - Service name and image
  - Master name, photo, and rating
  - Date and time (e.g., "Monday, January 15, 2026 at 2:00 PM")
  - Duration
  - Location/address if applicable
  - Special instructions field
- **Price Breakdown**:
  - Service price
  - Tax calculation (if applicable)
  - Deposit amount (if required by master)
  - Total amount due
- **Payment Method Selection**:
  - Saved payment methods (cards)
  - "Add New Payment Method" option
  - Apple Pay / Google Pay options
- **Deposit Information**:
  - Explanation of deposit hold (if applicable)
  - Deposit amount display
  - When deposit will be charged/captured
- **Cancellation Policy**:
  - Master's cancellation policy display
  - 24-hour notice requirement
  - Late cancellation fee warning
- **Pre-Booking Questions**:
  - Modal for service-specific questions (allergies, preferences, etc.)
  - Required fields marked
- **Terms Acceptance**:
  - Checkbox agreeing to cancellation policy
  - Link to full Terms of Service
- **Confirm Booking Button**: Large primary CTA

**User Flow**:
1. Client reviews all booking details
2. Client selects or adds payment method
3. Client answers any pre-booking questions
4. Client accepts terms and policies
5. Client taps "Confirm Booking"
6. System processes payment authorization (holds deposit if required)
7. Booking confirmation screen appears
8. Push notification sent to master

**Payment Processing**:
- Pre-authorization of deposit amount (if required)
- Balance charged after service completion or no-show grace period
- Secure Stripe integration
- Payment confirmation receipt via email

**Error Handling**:
- Payment failure shows error message with retry option
- Time slot no longer available shows alternative times
- Network error allows retry

#### Appointment Confirmation Screen
**Purpose**: Post-booking confirmation and next steps

**Features**:
- **Success Animation**: Checkmark or celebration animation
- **Confirmation Message**: "Booking Confirmed!" with booking reference number
- **Appointment Summary**:
  - Service name
  - Master name and contact
  - Date and time
  - Location with map preview
  - "Add to Calendar" button
- **Next Steps**:
  - "Message Master" button to open chat
  - "View Appointment" button for full details
  - "Book Another" button
- **Share Option**: Share booking details via text/email
- **Confirmation Email**: Sent automatically with all details

**User Flow**:
1. Client views confirmation
2. Client can add to device calendar
3. Client can immediately message master
4. Client navigates to appointments list or home

### Appointments Management

#### Orders Screen (Appointments Overview)
**Purpose**: View all appointments and orders in one place

**Features**:
- **Tab Navigation**:
  - Upcoming (future appointments)
  - Past (completed/cancelled appointments)
  - Orders (product purchases)
- **Upcoming Appointments List**:
  - Chronological list of future bookings
  - Each card shows:
    - Service thumbnail
    - Service name
    - Master name and photo
    - Date and time
    - Status badge (Confirmed, Pending, etc.)
  - Swipe actions: Reschedule, Cancel
  - Tap for full details
- **Past Appointments List**:
  - Completed appointments
  - Cancelled appointments (with cancellation reason)
  - No-show appointments
  - Rating prompt for completed appointments without review
- **Orders List**:
  - Product purchases
  - Order status (Processing, Shipped, Delivered)
  - Tracking information when available
  - Reorder button

**User Interactions**:
- Pull-to-refresh updates lists
- Swipe left on appointment for quick actions
- Tap appointment card for full details
- Filter by date range

#### Appointment List Screen (Detailed View)
**Purpose**: Comprehensive appointment management

**Features**:
- **Appointment Header**:
  - Large status indicator (color-coded)
  - Service name and image
  - Booking reference number
- **Appointment Details**:
  - Master information (name, photo, contact, rating)
  - Date and time with countdown
  - Duration
  - Location with map
  - Get directions button (opens maps app)
  - Service notes/instructions
- **Status Timeline**:
  - Visual timeline showing booking progress:
    - Booked → Confirmed → In Progress → Completed
  - Current status highlighted
- **Action Buttons** (context-aware):
  - **Pending**: Cancel, Message Master
  - **Confirmed**: Reschedule, Cancel, Message Master
  - **In Progress**: View details only
  - **Completed**: Leave Review, Book Again, Message Master
  - **Cancelled**: Rebook, View Reason
- **Payment Information**:
  - Amount paid/hold
  - Payment method used
  - Receipt download
- **Consultation Section** (if applicable):
  - Photo consultation status
  - View submitted photos
  - Master's response

**Status Types**:
- **Pending**: Awaiting master confirmation
- **Confirmed**: Master has accepted booking
- **Awaiting Confirmation**: Client needs to confirm attendance
- **In Progress**: Service currently happening
- **Completed**: Service finished successfully
- **Cancelled**: Cancelled by client or master
- **No-Show**: Client didn't attend
- **Declined**: Master declined booking

#### Appointment Confirmation Screen (Attendance)
**Purpose**: Client confirmation of attendance before appointment

**Features**:
- **Reminder Message**: "Please confirm you'll attend your appointment"
- **Appointment Details**: Service, master, date/time
- **Confirmation Options**:
  - "Yes, I'll be there" button
  - "I need to reschedule" button
  - "I need to cancel" button
- **Grace Period Information**: Explanation of confirmation window
- **No-Show Warning**: Consequences of not confirming or attending

**User Flow**:
1. Client receives push notification 24 hours before appointment
2. Client opens confirmation screen
3. Client confirms attendance
4. Master is notified of confirmation
5. If not confirmed within grace period, appointment may be auto-cancelled or marked no-show

### Discovery & Search

#### Discover Masters Screen
**Purpose**: Browse all available beauty professionals

**Features**:
- **Filter Bar**:
  - Specialty filter (Hair, Nails, Skincare, etc.)
  - Availability filter (Available today, This week)
  - Rating filter (4+ stars, 5 stars)
  - Price range filter
  - Location/distance filter
- **Masters Grid/List**:
  - Toggle between grid and list view
  - Each master card shows:
    - Profile photo
    - Name
    - Specialty badges
    - Rating (stars + number)
    - Starting price
    - "Book Now" button
    - "View Profile" link
- **Sort Options**: Recommended, Rating, Price (low to high), Distance
- **Map View Toggle**: Switch to map view to see master locations
- **Featured Section**: Highlighted/premium masters

**User Interactions**:
- Infinite scroll loading
- Tap master card for full profile
- Apply multiple filters simultaneously
- Save filter preferences

#### Search Masters Screen
**Purpose**: Specific master or service search

**Features**:
- **Search Bar**: 
  - Text input with clear button
  - Voice search option
  - Recent searches list
  - Search suggestions as you type
- **Search Results**:
  - Masters matching search query
  - Services matching search query
  - Related results
- **Advanced Search**: Filters within search (by specialty, availability, etc.)
- **No Results State**: Suggestions for alternative searches

### Consultation Features

#### Photo Consultation Request Screen
**Purpose**: Submit photos for pre-service approval

**Features**:
- **Service Selection**: Choose which service consultation is for
- **Master Selection**: Choose master to review (or "Any available")
- **Photo Upload**:
  - Camera access for taking photos
  - Photo library access
  - Multiple photo upload (up to 5)
  - Photo preview with delete option
  - Required angles/guidelines per service type
- **Description Field**:
  - Text area for additional details
  - Pre-filled prompts based on service
  - Character limit indicator
- **Previous Work Photos**: Option to upload reference photos
- **Submit Button**: Send consultation request

**Consultation Types**:
- **Hair Color**: Current hair state, desired color reference
- **Nail Art**: Nail condition, design inspiration
- **Skincare**: Skin concerns, current routine
- **Makeup**: Face shape, style preferences
- **General**: Any service requiring visual assessment

**User Flow**:
1. Client selects service
2. Client selects master (optional)
3. Client takes/uploads required photos
4. Client adds description
5. Client submits request
6. System notifies master
7. Client waits on Consultation Waiting Screen

#### Consultation Waiting Screen
**Purpose**: Track status of submitted consultation

**Features**:
- **Status Indicator**: 
  - "Pending Review" with animated indicator
  - Submitted timestamp
  - Estimated response time
- **Submitted Photos**: Review uploaded photos
- **Master Assignment**: Shows assigned master or "Awaiting assignment"
- **Response Preview**: When master responds:
  - Master's assessment
  - Approval/rejection status
  - Notes and recommendations
  - Suggested services or modifications
- **Action Buttons**:
  - If approved: "Proceed to Booking" button
  - If rejected: "Submit New Photos" or "Choose Different Service"
  - "Message Master" for questions
- **Cancel Request**: Withdraw consultation request

**Notifications**:
- Push notification when master responds
- Email notification with response summary

### Master Interaction

#### Master Detail Screen
**Purpose**: Comprehensive master profile and service offerings

**Features**:
- **Profile Header**:
  - Full-width cover photo
  - Profile photo (large, circular)
  - Name and verification badge (if verified)
  - Specialty tags
  - Overall rating with review count
  - "Book Now" primary button
  - "Message" secondary button
- **About Section**:
  - Bio/description
  - Years of experience
  - Certifications and credentials
  - Languages spoken
- **Portfolio Gallery**:
  - Grid of work photos
  - Tap to view full-size
  - Before/After comparisons
  - Swipeable carousel
- **Services Offered**:
  - List of all services with prices
  - Duration for each
  - "Book" button per service
  - Expand for full description
- **Reviews Section**:
  - Overall rating breakdown
  - Recent reviews with photos
  - Filter by service type
  - "See all reviews" link
- **Availability Preview**:
  - Next available slots
  - "View Full Schedule" link
- **Business Information**:
  - Location/address
  - Hours of operation
  - Contact information
  - Social media links

**User Interactions**:
- Scroll through portfolio
- Tap service to book directly
- Tap review to see full details
- Save master to favorites
- Share master profile

### Menu & Settings

#### Menu Screen
**Purpose**: Central navigation hub for client settings and features

**Features**:
- **User Profile Header**:
  - Profile photo
  - Name and email
  - Loyalty points balance
  - "Edit Profile" button
- **Main Menu Sections**:
  - **My Account**:
    - Profile Settings
    - Payment Methods
    - Payment History
    - Notifications Settings
  - **Loyalty & Rewards**:
    - Loyalty Points
    - Stamp Cards
    - Rewards Catalog
  - **Support**:
    - Help & Support (FAQ)
    - Contact Us
    - Report a Problem
  - **Legal**:
    - Terms of Service
    - Privacy Policy
- **App Settings**:
  - Language selection
  - Notification preferences
  - Dark mode toggle (if available)
  - App version info
- **Logout Button**: Secure logout with confirmation

**Design**: Clean, organized list with icons and chevrons

#### Help & Support Screen
**Purpose**: Self-service support and contact options

**Features**:
- **Search FAQ**: Search frequently asked questions
- **FAQ Categories**:
  - Booking & Appointments
  - Payments & Refunds
  - Account & Profile
  - Services & Masters
  - Technical Issues
- **Popular Questions**: Most viewed FAQs
- **Contact Options**:
  - Live Chat (if available)
  - Email support
  - Phone support (if available)
- **Report a Problem**: Form for submitting issues
- **System Status**: Platform operational status

**FAQ Format**:
- Expandable accordion items
- Rich text with links
- Helpful/Not helpful feedback

#### Terms of Service Screen (Client Menu)
**Purpose**: Display full Terms of Service

**Features**:
- Scrollable full text
- Section headers
- Last updated date
- Back navigation
- Share option

**Content Sections**:
1. Acceptance of Terms
2. Services (platform description)
3. User Accounts (credential responsibility)
4. Booking & Cancellations (24-hour policy, no-show fees)
5. Payments (secure processing, Euro pricing)
6. Intellectual Property (content ownership)
7. Limitation of Liability
8. Changes to Terms
9. Contact (legal@meraki.com)

#### Privacy Policy Screen
**Purpose**: Display privacy and data handling policies

**Features**:
- Scrollable full text
- Section headers
- Last updated date
- Back navigation
- Contact DPO link

**Content Sections**:
1. Information We Collect (name, email, phone, payment, usage data)
2. How We Use Your Information (services, notifications, improvements)
3. Data Security (industry standards, PCI compliance)
4. Data Sharing (third-party service providers only)
5. Your Rights (GDPR access, correction, deletion rights)
6. Cookies & Tracking (analytics, opt-out options)
7. Data Retention (as long as necessary for services)
8. Children's Privacy (16+ age requirement)
9. Contact Us (privacy@meraki.com)

### Loyalty Program

#### Loyalty Points Screen
**Purpose**: View and manage loyalty points balance

**Features**:
- **Points Balance Display**: 
  - Large, prominent number
  - Visual progress toward next reward
  - Points value in currency equivalent
- **Earning History**:
  - Chronological list of points earned
  - Source (appointment, purchase, referral)
  - Date earned
  - Points amount
- **Redemption Options**:
  - Available rewards catalog
  - Points cost for each reward
  - Service discounts
  - Product vouchers
  - "Redeem" buttons
- **How to Earn**: Information on earning opportunities
- **Points Expiration**: Warning for expiring points

**User Interactions**:
- Tap reward to redeem
- Filter history by time period
- Share referral code to earn points

#### Stamp Cards Screen
**Purpose**: View and manage digital stamp cards

**Features**:
- **Active Stamp Cards**:
  - Card design/visual
  - Master name (if master-specific)
  - Current stamps (e.g., "4/10")
  - Visual stamp display (filled/empty slots)
  - Reward description ("Free service after 10 stamps")
  - Expiration date if applicable
- **Completed Cards**: History of filled cards and rewards claimed
- **Available Cards**: New stamp cards to activate
- **QR Code Display**: For master to scan and add stamp

**Stamp Card Types**:
- Master-specific cards (single master)
- Platform-wide cards (any master)
- Service-specific cards (specific service only)

#### QR Scanner Screen
**Purpose**: Scan QR codes for loyalty stamps and check-ins

**Features**:
- **Camera View**: Full-screen camera with QR frame overlay
- **Scan Guide**: Instructions on positioning QR code
- **Flashlight Toggle**: For low-light scanning
- **Manual Entry**: Type code if scanning fails
- **Recent Scans**: History of scanned codes
- **Success Feedback**: Haptic feedback and visual confirmation

**Use Cases**:
- Scan master QR code to receive stamp
- Scan event QR codes for special promotions
- Check-in at partner locations

#### NFC Scanner Screen
**Purpose**: Use NFC for loyalty stamps (alternative to QR)

**Features**:
- **NFC Reader**: Activates device NFC
- **Tap Instructions**: "Tap your phone to the NFC tag"
- **Success Animation**: Visual/haptic feedback on successful tap
- **Error Handling**: Messages for failed reads
- **NFC Status**: Indicator if NFC is disabled

**Requirements**:
- Device must have NFC capability
- NFC must be enabled in device settings

### Payment Management

#### Payment Methods Screen
**Purpose**: Manage saved payment cards

**Features**:
- **Saved Cards List**:
  - Card brand icon (Visa, Mastercard, etc.)
  - Last 4 digits
  - Expiration date
  - Default card badge
  - Set as default option
  - Delete card option
- **Add New Card**:
  - Card number input
  - Expiry date input
  - CVC input
  - Cardholder name
  - Billing address (if required)
  - Secure Stripe integration
- **Alternative Payment Methods**:
  - Apple Pay toggle
  - Google Pay toggle
  - PayPal (if available)

**Security**:
- PCI-compliant card storage via Stripe
- No card details stored locally
- 3D Secure authentication support

#### Payment History Screen
**Purpose**: View all transaction history

**Features**:
- **Transaction List**:
  - Date and time
  - Description (service name, product, etc.)
  - Amount (positive for charges, negative for refunds)
  - Status (Completed, Pending, Refunded)
  - Payment method used
- **Filter Options**:
  - Date range
  - Transaction type (Appointment, Product, Course)
  - Status filter
- **Receipt Download**: PDF generation for each transaction
- **Total Spent**: Summary statistics

**Transaction Types**:
- Service payments
- Product purchases
- Course enrollments
- Refunds
- Deposits (holds and captures)
- No-show fees

### Notifications

#### Notifications Screen
**Purpose**: Central inbox for all app notifications

**Features**:
- **Notification Categories**:
  - All
  - Appointments (booking confirmations, reminders)
  - Messages (chat notifications)
  - Promotions (marketing, offers)
  - System (updates, maintenance)
- **Notification List**:
  - Icon indicating type
  - Title and preview text
  - Timestamp
  - Unread indicator (bold text, dot)
  - Swipe to delete
- **Actions**:
  - Tap to view related content
  - Mark all as read
  - Clear all
  - Notification settings link
- **Empty State**: "No notifications" with illustration

**Notification Types**:
- Appointment confirmations
- 24-hour reminders
- 1-hour reminders
- Master messages
- Appointment changes/cancellations
- Payment confirmations
- Loyalty points earned
- Promotional offers
- System announcements

---

## Master Experience

The Master experience is designed as a complete business management tool, enabling beauty professionals to manage their practice, clients, and growth.

### Dashboard Tab

#### Master Dashboard Screen
**Purpose**: Central command center for daily operations

**Features**:
- **Today's Schedule Header**:
  - Date display
  - Number of appointments today
  - Next appointment countdown
- **Quick Stats Row**:
  - Today's earnings
  - This week's earnings
  - New bookings this week
  - Unread messages count
- **Next Appointment Card**:
  - Service name
  - Client name and photo
  - Time
  - Countdown timer
  - Quick actions: Message, Directions, Complete
- **Today's Appointments List**:
  - Chronological list of today's bookings
  - Status indicators (Pending, Confirmed, In Progress, Completed)
  - Tap to view details
- **This Week Preview**: Mini calendar showing week's bookings
- **Recent Messages**: Preview of latest client messages
- **Action Buttons**:
  - "Set Availability" quick link
  - "View All Appointments" link
  - "Add Service" link
- **Performance Insights**: 
  - Weekly booking trend
  - Client retention rate
  - Average rating

**User Interactions**:
- Pull-to-refresh for real-time updates
- Tap appointment to open details
- Swipe notification banners
- Deep links to related screens

### Appointments Tab

#### Master Appointments Screen
**Purpose**: Comprehensive appointment management

**Features**:
- **Tab Navigation**:
  - Today
  - Upcoming (next 7 days)
  - Pending (awaiting confirmation)
  - All
- **Appointment Cards**:
  - Client photo and name
  - Service name
  - Date and time
  - Status badge (color-coded)
  - Deposit indicator (if required)
  - Photo consultation indicator (if applicable)
- **Swipe Actions**:
  - Confirm (for pending)
  - Complete (mark as done)
  - Cancel
  - Message
- **Filter Options**: By status, service type, date range
- **Calendar View Toggle**: Switch to calendar visualization
- **Bulk Actions**: Select multiple appointments for batch operations

**Status Management**:
- **Pending → Confirmed**: Master accepts booking
- **Confirmed → In Progress**: Master starts service
- **In Progress → Completed**: Service finished
- **Any → Cancelled**: With reason selection
- **No-Show**: Client didn't attend

**Special Features**:
- Photo consultation review badge
- Client notes preview
- Payment status indicator
- Loyalty stamp quick-add button

### Availability Management

#### Master Availability Screen
**Purpose**: Set weekly working hours and schedule

**Features**:
- **Weekly Calendar View**:
  - 7-day grid (Mon-Sun)
  - Each day shows time slots
  - Toggle availability per day
- **Time Slot Selection**:
  - Start time picker
  - End time picker
  - Break time settings
  - Multiple time blocks per day (e.g., 9-12, 14-18)
- **Recurring Settings**:
  - Copy schedule to next week
  - Apply to all future weeks
  - Reset to default
- **Special Dates**: Mark vacation days, holidays
- **Buffer Time**: Set preparation time between appointments
- **Service Duration Settings**: Default time slots based on service types

**User Flow**:
1. Master selects day of week
2. Master sets available hours
3. Master repeats for all working days
4. Master saves schedule
5. System updates booking availability for clients

**Constraints**:
- Cannot set availability in the past
- Minimum 30-minute slots
- Must have at least one working day

#### Blocked Slots Screen
**Purpose**: Block specific time slots (vacation, breaks, personal time)

**Features**:
- **Calendar View**: Monthly view with blocked dates highlighted
- **Add Blocked Time**:
  - Date selection
  - Time range (or full day)
  - Reason/category (Vacation, Sick Day, Personal, Other)
  - Notes field
- **Blocked Slots List**:
  - Chronological list of blocked times
  - Edit or delete options
  - Recurring block option (e.g., every Monday morning)
- **Conflict Detection**: Warning if existing appointments conflict
- **Bulk Operations**: Block multiple days at once

**Impact**:
- Blocked slots are hidden from client booking
- Existing appointments in blocked time trigger conflict alerts
- Clients with bookings in soon-to-be-blocked time receive notifications

### Services Management

#### My Services Screen
**Purpose**: View and manage offered services

**Features**:
- **Services List**:
  - Service thumbnail
  - Service name
  - Price
  - Duration
  - Active/Inactive toggle
  - Edit option
- **Service Categories**: Grouped by type (Hair, Nails, etc.)
- **Active Services Count**: Total available for booking
- **Quick Actions**:
  - Toggle visibility (active/inactive)
  - Edit service details
  - Duplicate service
  - Delete service
- **Add Service Button**: Create new service offering

**Service Details Preview**:
- Description
- Requirements
- Supplies needed
- Photos

#### Create Service Screen
**Purpose**: Add new services to portfolio

**Features**:
- **Service Information**:
  - Service name
  - Category selection (dropdown)
  - Description (rich text editor)
  - Duration picker
  - Price input
- **Service Details**:
  - What's included list
  - Prerequisites/requirements
  - Aftercare instructions
- **Photos**: Upload service example photos (before/after)
- **Supplies Link**: Connect inventory supplies to service
- **Pricing Options**:
  - Fixed price
  - Price range (min-max)
  - Starting at price
- **Availability**: Set which days/times this service can be booked
- **Deposit Settings**: Require upfront deposit (yes/no, amount)
- **Pre-Booking Questions**: Add custom questions for clients

**Validation**:
- Required fields marked
- Price must be positive number
- Duration minimum 15 minutes
- Photo size and format limits

### Business Settings

#### Business Settings Screen
**Purpose**: Configure business policies and preferences

**Features**:
- **Deposit Policy**:
  - Enable/disable deposits
  - Default deposit percentage or fixed amount
  - Minimum deposit amount
- **Cancellation Policy**:
  - Cancellation window (e.g., 24 hours)
  - Late cancellation fee percentage
  - No-show fee percentage
- **Confirmation Settings**:
  - Require client confirmation (yes/no)
  - Confirmation window (hours before appointment)
  - Auto-cancel if not confirmed
- **Notification Preferences**:
  - New booking alerts
  - Cancellation alerts
  - 24-hour reminders
  - Push notification settings
- **Payment Settings**:
  - Accepted payment methods
  - Tax rate configuration
  - Tipping options
- **Booking Rules**:
  - Minimum advance booking time
  - Maximum advance booking window
  - Buffer time between appointments

**Policy Templates**: Pre-configured policy options (Strict, Moderate, Flexible)

#### Master Settings Screen
**Purpose**: General account settings

**Features**:
- **Profile Information**:
  - Display name
  - Profile photo
  - Cover photo
  - Bio/description
  - Years of experience
- **Contact Information**:
  - Business phone
  - Business email
  - Business address
  - Social media links
- **Professional Details**:
  - Certifications (add/edit/delete)
  - Specialties/tags
  - Languages spoken
- **Account Settings**:
  - Email address
  - Password change
  - Two-factor authentication
  - Notification preferences
- **Language**: App display language
- **Currency**: Preferred currency for pricing

### Earnings & Analytics

#### Master Earnings Screen
**Purpose**: Track income and financial performance

**Features**:
- **Earnings Summary Cards**:
  - Today's earnings
  - This week
  - This month
  - This year
  - Lifetime total
- **Earnings Chart**: 
  - Line chart or bar chart
  - Time period selector (Day, Week, Month, Year)
  - Revenue trend visualization
- **Transactions List**:
  - Date
  - Client name
  - Service
  - Amount
  - Status (Paid, Pending, Refunded)
  - Tap for receipt
- **Payout Information**:
  - Available balance
  - Payout history
  - Payout method (bank account, etc.)
  - Request payout button
- **Tax Summary**: Estimated taxes, deductible expenses
- **Performance Metrics**:
  - Average transaction value
  - Total appointments completed
  - Client retention rate
  - No-show rate

**Filtering**: By date range, service type, payment status

#### Schedule Screen (Calendar View)
**Purpose**: Visual calendar of all appointments

**Features**:
- **Calendar Views**:
  - Day view (detailed hourly slots)
  - Week view (7-day overview)
  - Month view (full month)
- **Appointment Display**:
  - Color-coded by status
  - Client name
  - Service name
  - Time range
- **Navigation**: 
  - Swipe to change dates
  - Jump to today button
  - Date picker for specific date
- **Blocked Time Display**: Shows blocked slots visually
- **Availability Overlay**: Shows open booking slots
- **Tap Actions**: Tap appointment for details, tap empty slot to block

### Client Management

#### Portfolio Screen
**Purpose**: Upload and showcase work portfolio

**Features**:
- **Gallery Grid**: 
  - Organized photos of work
  - Categories (By service type)
  - Before/After toggle
- **Photo Upload**:
  - Camera access
  - Photo library access
  - Multiple selection
  - Photo editing (crop, filter)
- **Photo Details**:
  - Service type tag
  - Description/caption
  - Date taken
  - Delete option
- **Organization**:
  - Drag to reorder
  - Create albums/categories
  - Feature photo (appears first)
- **Privacy Settings**: Public (all clients) or Private (booked clients only)

**Best Practices Guide**: Tips for taking high-quality portfolio photos

### Loyalty Program (Master Side)

#### Loyalty QR Screen
**Purpose**: Display QR code for clients to scan

**Features**:
- **Large QR Code Display**: Full-screen scannable code
- **Master Name**: Displayed above QR code
- **Instructions**: "Ask client to scan for loyalty stamp"
- **Stamp Count**: Shows client's current progress (if known)
- **Manual Entry**: Button to manually add stamp if scanning fails
- **Generate New Code**: Refresh QR code (for security)
- **Share Option**: Share code via message/email

**Use Cases**:
- Client scans after appointment to earn stamp
- Client scans during checkout for product purchase stamps
- Event check-ins

#### Loyalty Card Builder Screen
**Purpose**: Create custom loyalty stamp cards

**Features**:
- **Card Design**:
  - Card name
  - Number of stamps required (e.g., 8, 10, 12)
  - Card theme/color
  - Upload custom background image
- **Reward Configuration**:
  - Reward name (e.g., "Free haircut")
  - Reward description
  - Service selection (if reward is a service)
  - Discount amount (if reward is discount)
- **Rules**:
  - Validity period
  - Eligible services (which bookings earn stamps)
  - Minimum purchase requirement
  - One-time use vs. repeatable
- **Card Preview**: Visual preview of how card looks to clients
- **Active Toggle**: Enable/disable card
- **Distribution**: Auto-assign to clients or manual assignment

**Card Types**:
- Service-specific (e.g., "10 haircuts = 1 free")
- General (any service counts)
- Product purchase cards
- Referral cards (stamps for referrals)

#### Manage Rewards Screen
**Purpose**: Track and manage loyalty rewards program

**Features**:
- **Active Cards List**: All currently active stamp cards
  - Card name
  - Number of clients enrolled
  - Total stamps issued
  - Rewards claimed count
- **Performance Analytics**:
  - Card effectiveness (completion rate)
  - Most popular rewards
  - Client retention impact
- **Client Enrollment**:
  - List of clients with cards
  - Their progress
  - Manually add/remove stamps
  - Award bonus stamps
- **Reward Redemption**:
  - Pending redemptions
  - Approved redemptions
  - Mark as redeemed
  - Cancel redemption
- **Expired Cards**: Archive of ended promotions

### Supplies & Inventory

#### Supplies Screen
**Purpose**: Track professional supplies inventory

**Features**:
- **Inventory List**:
  - Supply name
  - Category (Hair, Nails, Skincare, etc.)
  - Current quantity
  - Unit (bottles, tubes, sheets, etc.)
  - Low stock warning indicator
  - Expiration date (if applicable)
- **Categories**: Filter by supply type
- **Quick Actions**:
  - Adjust quantity (+/- buttons)
  - Mark as low stock
  - Reorder reminder
- **Usage Tracking**: Track consumption per service
- **Add Supply Button**: Create new inventory item

#### Add Supply Screen
**Purpose**: Add new supplies to inventory

**Features**:
- **Supply Details**:
  - Name
  - Brand
  - Category
  - Description
- **Inventory Settings**:
  - Initial quantity
  - Unit of measurement
  - Reorder level (alert when below this)
  - Cost per unit (for reporting)
- **Purchase Information**:
  - Purchase date
  - Supplier/vendor
  - Purchase price
  - Expiration date (if applicable)
- **Photo**: Upload product photo for identification
- **Service Link**: Connect to services that use this supply

#### Service Supplies Screen
**Purpose**: Link supplies to services for usage tracking

**Features**:
- **Service Selection**: Choose service to configure
- **Supplies Used List**:
  - Supply name
  - Quantity used per service
  - Cost per service calculation
- **Add Supply to Service**:
  - Select from inventory
  - Set quantity used
  - Set usage type (per client, per session, etc.)
- **Cost Analysis**:
  - Total supply cost per service
  - Profit margin calculation
  - Helps with pricing decisions

### Communication & Marketing

#### Aftercare Campaign Screen
**Purpose**: Set up automated post-service messages

**Features**:
- **Campaign List**: Existing aftercare campaigns
  - Service type
  - Trigger timing
  - Message content preview
  - Active/inactive toggle
- **Create Campaign**:
  - Select service type
  - Trigger timing (e.g., "24 hours after appointment")
  - Message composition
  - Rich text editor
  - Media attachments (photos/videos of care instructions)
- **Message Templates**: Pre-written aftercare templates by service type
- **Schedule Multiple Messages**: 
  - Day 1: Initial care
  - Day 3: Check-in
  - Week 2: Follow-up
  - etc.
- **Personalization Tokens**: Insert client name, service name dynamically
- **Analytics**: Open rates, client engagement

**Examples**:
- Hair color: "Wait 48 hours before washing..."
- Nails: "Apply cuticle oil daily..."
- Facials: "Avoid direct sunlight for 24 hours..."

### Consultation Reviews

#### Booking Consultation Review Screen
**Purpose**: Review pre-booking consultation requests

**Features**:
- **Pending Requests List**:
  - Client name and photo
  - Service requested
  - Date submitted
  - Urgency indicator
- **Request Details**:
  - Client's questions/concerns
  - Service details
  - Preferred dates/times
- **Response Options**:
  - Approve (proceed with booking)
  - Request More Info
  - Suggest Alternative Service
  - Decline with reason
- **Message Client**: Direct chat option for clarifications
- **Mark Complete**: Archive reviewed requests

#### Photo Consultation Review Screen
**Purpose**: Review photo-based consultation requests

**Features**:
- **Photo Gallery**: Client-submitted photos
  - Zoom/pan functionality
  - Compare photos side-by-side
  - Photo annotation tools (draw, highlight)
- **Client Information**:
  - Name and contact
  - Service interested in
  - Description provided
- **Assessment Tools**:
  - Approve/Reject/Needs More Photos
  - Notes field for detailed feedback
  - Recommendations for service
  - Pricing estimate
- **Response Composition**:
  - Pre-written response templates
  - Custom message
  - Attach reference photos
- **Status Tracking**: Pending → In Review → Responded → Completed

### Onboarding

#### Master Onboarding Screen
**Purpose**: Guide new masters through initial setup

**Features**:
- **Step-by-Step Wizard**:
  1. **Profile Setup**: Name, photo, bio
  2. **Services**: Add first services
  3. **Availability**: Set working hours
  4. **Portfolio**: Upload work photos
  5. **Business Settings**: Policies and payments
  6. **Verification**: Submit credentials (if required)
- **Progress Indicator**: Shows completion percentage
- **Skip Option**: Can skip steps and complete later
- **Help Tooltips**: Contextual help on each step
- **Completion Reward**: Bonus or badge for completing onboarding

---

## Owner Experience

The Owner experience encompasses all Master capabilities plus comprehensive platform administration tools for managing the entire business ecosystem.

### Dashboard Tab

#### Owner Dashboard Screen
**Purpose**: High-level platform overview and administration

**Features**:
- **Platform Statistics Cards**:
  - Total registered users
  - Active masters count
  - Today's appointments platform-wide
  - Monthly revenue
  - New signups this week
- **Revenue Chart**: 
  - Platform earnings over time
  - Breakdown by service type
  - Top earning masters
- **Recent Activity Feed**:
  - New master registrations (pending approval)
  - New bookings
  - Product orders
  - Course enrollments
- **Alerts & Notifications**:
  - Low inventory alerts
  - Master verification requests
  - Support tickets
  - System issues
- **Quick Actions**:
  - Add New Master
  - Add Product
  - Create Course
  - Send Notification
- **Performance Metrics**:
  - Average booking value
  - Client retention rate
  - Master utilization rate
  - Shop conversion rate

**Comparison to Master Dashboard**:
- Shows data for all masters, not just personal
- Administrative controls
- Platform-wide settings

### Academy Management (Owner)

#### Manage Academy Screen
**Purpose**: Central hub for academy administration

**Features**:
- **Three-Tab Interface**:
  1. **Courses**: Manage all courses
  2. **Inbox**: Homework submissions awaiting review
  3. **Students**: View student analytics
- **Overview Statistics**:
  - Total courses
  - Active students
  - Pending homework submissions
  - Total course revenue
- **Quick Actions**:
  - Create New Course
  - View All Lessons
  - Grade Homework
  - Student Reports
- **Recent Activity**:
  - New enrollments
  - Completed courses
  - Recent homework submissions

#### Courses List Screen
**Purpose**: View and manage all academy courses

**Features**:
- **Course Grid/List**: 
  - Course thumbnail
  - Course name
  - Category
  - Price
  - Enrollment count
  - Status (Draft, Published, Archived)
  - Rating
- **Filter Options**:
  - Status
  - Category
  - Price range
  - Enrollment count
- **Sort Options**: Newest, Most Popular, Highest Rated
- **Quick Actions**:
  - Edit course
  - Duplicate course
  - Publish/unpublish
  - Delete
  - View analytics
- **Add Course Button**: Create new course
- **Search**: Find courses by name

#### Course Editor Screen
**Purpose**: Create and edit courses

**Features**:
- **Course Information**:
  - Course title
  - Subtitle/tagline
  - Description (rich text)
  - Category selection
  - Difficulty level (Beginner, Intermediate, Advanced)
  - Duration estimate
- **Media**:
  - Cover image upload
  - Promo video upload
  - Trailer/embed video link
- **Pricing**:
  - Price setting
  - Currency selection
  - Discount/sale price
  - Free course option
- **Curriculum Builder**:
  - Add sections/modules
  - Add lessons within sections
  - Drag-and-drop reordering
  - Lesson type selection (Video, Text, Quiz, Assignment)
- **Settings**:
  - Prerequisites (other courses required first)
  - Certificate enabled (yes/no)
  - Discussion forum enabled
  - Public/private visibility
- **SEO Settings**: Course tags, keywords
- **Preview Mode**: See how course appears to students

#### Lesson Editor Screen
**Purpose**: Create and edit individual lessons

**Features**:
- **Lesson Information**:
  - Lesson title
  - Description
  - Duration
- **Content Types**:
  - **Video**: Upload video file or embed link (YouTube, Vimeo)
  - **Text**: Rich text editor with formatting
  - **Quiz**: Multiple choice, true/false questions
  - **Assignment**: Homework submission requirements
  - **Downloadable**: PDF, worksheets, resources
- **Video Player Settings**:
  - Thumbnail selection
  - Subtitle/caption upload
  - Playback speed options
- **Resources**: Attach downloadable files
- **Order**: Position within course curriculum
- **Prerequisites**: Previous lessons that must be completed
- **Preview**: Test lesson as student would see it

#### Homework Inbox Screen
**Purpose**: Review and grade student homework submissions

**Features**:
- **Submission List**:
  - Student name and photo
  - Course name
  - Lesson/assignment name
  - Submission date
  - Status (Pending Review, Graded, Needs Revision)
  - Grade (if graded)
- **Filter Options**:
  - By course
  - By status
  - By date range
  - By grade status (Pass/Fail/Pending)
- **Sort Options**: Newest first, Oldest first, By course
- **Batch Actions**:
  - Mark multiple as reviewed
  - Bulk grade
  - Export submissions
- **Submission Preview**:
  - View submitted files/photos
  - View student notes
  - View submission time
- **Quick Grade**: Pass/Fail buttons for simple assignments

#### Homework Review Screen
**Purpose**: Detailed review and grading of individual submissions

**Features**:
- **Student Information**:
  - Name, photo, enrollment date
  - Course progress
  - Previous submissions
- **Assignment Details**:
  - Lesson name
  - Assignment requirements
  - Due date
- **Submission Content**:
  - Photo gallery (zoomable)
  - Video playback
  - Document viewer (PDF, etc.)
  - Text responses
- **Grading Tools**:
  - Pass/Fail/Needs Revision status
  - Numeric grade (if applicable)
  - Rubric scoring (if configured)
  - Feedback text editor
  - Voice note feedback (optional)
- **Annotation Tools**:
  - Draw on submitted photos
  - Add comments on specific areas
  - Highlight sections
- **Communication**:
  - Message student directly
  - Request resubmission
  - Send encouragement
- **History**: Previous attempts and feedback

#### Academy Students Screen
**Purpose**: View all academy students and analytics

**Features**:
- **Student Statistics**:
  - Total enrolled students
  - Active students (currently learning)
  - Completed courses count
  - Average completion rate
- **Student List**:
  - Name and photo
  - Enrolled courses count
  - Last activity
  - Overall progress
  - Search by name
- **Filter Options**:
  - By course enrollment
  - By activity level
  - By completion status
- **Export**: Download student list (CSV)

#### Student Detail Screen
**Purpose**: Individual student progress tracking

**Features**:
- **Student Profile**:
  - Full profile information
  - Contact details
  - Enrollment date
- **Course Progress**:
  - List of enrolled courses
  - Progress percentage for each
  - Lessons completed
  - Time spent learning
- **Homework History**:
  - All submissions
  - Grades received
  - Feedback history
- **Activity Timeline**:
  - Last login
  - Recent lessons viewed
  - Assignments submitted
- **Actions**:
  - Send message
  - Unenroll from course
  - Award certificate manually
  - View payment history

### Master Management

#### Master List Screen
**Purpose**: View and manage all platform masters

**Features**:
- **Master Directory**:
  - Profile photo
  - Name
  - Status (Active, Pending, Suspended)
  - Specialties
  - Contact information
  - Date joined
  - Performance rating
- **Filter Options**:
  - Status
  - Specialty
  - Join date
  - Performance level
- **Search**: Find masters by name or email
- **Quick Actions**:
  - Edit master profile
  - View master dashboard (impersonate)
  - Approve pending masters
  - Suspend/activate account
  - Delete master
- **Performance Metrics**:
  - Booking count
  - Revenue generated
  - Client rating
  - Response time
- **Bulk Actions**: Export list, send mass message

#### Master Form Screen
**Purpose**: Add new masters or edit existing profiles

**Features**:
- **Personal Information**:
  - Full name
  - Email address
  - Phone number
  - Profile photo upload
- **Professional Information**:
  - Specialties/tags
  - Years of experience
  - Certifications (upload documents)
  - Bio/description
- **Account Settings**:
  - Role assignment (Master/Owner)
  - Account status
  - Verification status
  - Permissions
- **Services Assignment**: Assign platform services to master
- **Commission Rate**: Set master's earnings percentage
- **Send Invitation**: Email invitation to join platform
- **Save Draft**: Save without activating

### Service Catalog Management

#### Service List Screen
**Purpose**: Manage platform-wide service offerings

**Features**:
- **Service Directory**:
  - Service thumbnail
  - Service name
  - Category
  - Default price range
  - Duration
  - Status (Active/Inactive)
  - Number of masters offering
- **Category Management**:
  - Create/edit/delete categories
  - Reorder categories
  - Category descriptions
- **Filter Options**:
  - Category
  - Price range
  - Status
- **Search**: Find services by name
- **Quick Actions**:
  - Edit service
  - Duplicate
  - Activate/deactivate
  - Delete
  - View analytics
- **Add Service Button**: Create new platform service

#### Service Form Screen
**Purpose**: Create and edit platform services

**Features**:
- **Service Information**:
  - Service name
  - Category
  - Description
  - Default duration
  - Suggested price range
- **Media**:
  - Upload service photos
  - Video demonstration
- **Details**:
  - What's included
  - Prerequisites
  - Aftercare instructions
  - Preparation requirements
- **Settings**:
  - Active/Inactive
  - Featured service (appears on homepage)
  - Booking available (yes/no)
- **Tags**: Searchable keywords
- **Related Services**: Cross-sell suggestions

### Shop & Inventory Management

#### Inventory Screen (Owner)
**Purpose**: Manage product inventory for the shop

**Features**:
- **Product List**:
  - Product photo
  - Product name
  - SKU
  - Stock quantity
  - Retail price
  - Wholesale price
  - Status (In Stock, Low Stock, Out of Stock)
- **Stock Alerts**:
  - Visual indicators for low stock
  - Automated reorder suggestions
- **Filter Options**:
  - Category
  - Stock status
  - Price range
- **Bulk Actions**:
  - Update prices
  - Adjust stock quantities
  - Export inventory
- **Add Product Button**: Create new product
- **Search**: Find products by name or SKU

**Product Details Preview**:
- Description
- Specifications
- Photos
- Inventory history

### Supplies Management

#### Owner Supplies Screen
**Purpose**: Track platform-level supplies inventory

**Features**:
- Similar to Master Supplies Screen but with platform-wide view
- Track supplies across all masters
- Bulk ordering for platform
- Supplier management
- Cost analysis across platform

#### Add Owner Supply Screen
**Purpose**: Add supplies to platform inventory

**Features**:
- Same as Master Add Supply Screen
- Additional fields:
  - Supplier/vendor management
  - Bulk purchase options
  - Distribution to masters
  - Cost tracking for platform

### Platform Communication

Owners can send platform-wide notifications:
- Marketing announcements
- New feature introductions
- Promotional campaigns
- System maintenance notices
- Emergency alerts

**Notification Types**:
- Push notifications to all users
- Push to specific segments (clients only, masters only)
- Email broadcasts
- In-app announcements

---

## Shared Features

These features are accessible by multiple user roles with appropriate permissions.

### Shop (E-commerce)

#### Shop Screen
**Purpose**: Browse and purchase beauty products

**Features**:
- **Category Navigation**: Horizontal tabs
  - All Products
  - Hair Care
  - Skincare
  - Nail Care
  - Makeup
  - Tools & Equipment
  - Featured
  - Sale
- **Product Grid**:
  - Product photo
  - Product name
  - **Dual Pricing Display**:
    - Retail price (for clients)
    - Wholesale price (for masters, labeled "Pro Price")
  - Rating
  - "Add to Cart" button
- **Filter & Sort**:
  - Price range
  - Brand
  - Rating
  - Availability
  - Sort by: Featured, Price (low/high), Newest, Rating
- **Search Bar**: Find products by name
- **Shopping Cart Icon**: Shows item count
- **Promotional Banners**: Sales, new arrivals, featured products

**Master/Owner Special Features**:
- Wholesale pricing automatically displayed
- Bulk purchase options
- Professional discounts
- Tax-exempt purchasing (if configured)

#### Product Detail Screen
**Purpose**: Detailed product information and purchase

**Features**:
- **Product Images**: Gallery with zoom
- **Product Title & Brand**
- **Dual Pricing**:
  - Client price
  - Master wholesale price (if applicable)
- **Rating & Reviews**: Star rating with count
- **Description**: Full product description
- **Specifications**: Ingredients, size, usage instructions
- **Stock Status**: In stock, low stock, or out of stock
- **Quantity Selector**: Adjust purchase quantity
- **Add to Cart Button**
- **Buy Now Button**: Skip cart and checkout directly
- **Related Products**: "You may also like" suggestions
- **Reviews Section**: Customer reviews with photos
- **Share Button**: Share product via social/media

**Master/Owner Features**:
- Cost price display (for owners)
- Profit margin calculator
- Inventory level view
- Bulk order form

#### Cart Screen
**Purpose**: Review and manage shopping cart

**Features**:
- **Cart Items List**:
  - Product thumbnail
  - Product name
  - Unit price (retail or wholesale based on role)
  - Quantity selector (+/- buttons)
  - Line total
  - Remove button (swipe or X)
- **Cart Summary**:
  - Subtotal
  - Tax calculation (if applicable)
  - Shipping estimate (if applicable)
  - Discount code input
  - Total amount
- **Empty Cart State**: "Your cart is empty" with shop CTA
- **Save for Later**: Move items to wishlist
- **Proceed to Checkout Button**

**Features**:
- Swipe to remove items
- Quantity limit warnings
- Stock availability check
- Cart persistence across sessions

#### Checkout Screen
**Purpose**: Complete product purchase

**Features**:
- **Order Summary**:
  - List of items
  - Quantities
  - Prices
  - Subtotal
  - Tax
  - Shipping (if applicable)
  - Total
- **Shipping Information** (if physical products):
  - Saved addresses
  - Add new address
  - Shipping method selection
- **Payment Method**:
  - Saved cards
  - Add new card
  - Apple Pay / Google Pay
- **Billing Address**: Same as shipping or different
- **Order Notes**: Special instructions
- **Terms Acceptance**: Checkbox for purchase terms
- **Place Order Button**
- **Security Badges**: Secure payment indicators

**Post-Purchase**:
- Order confirmation screen
- Order number
- Email confirmation sent
- Order tracking link (if shipped)

### Chat & Messaging

#### Chat List Screen
**Purpose**: View all conversations

**Features**:
- **Conversation List**:
  - Contact photo
  - Contact name
  - Last message preview
  - Timestamp
  - Unread message indicator (badge count)
  - Online status indicator (green dot)
- **Filter Tabs**:
  - All
  - Clients (for masters/owners)
  - Masters (for clients/owners)
  - Unread
- **Search**: Find conversations by contact name
- **New Message Button**: Start new conversation
- **Swipe Actions**: Archive, Delete
- **Empty State**: "No messages yet" with CTA

**Conversation Types**:
- Client ↔ Master (booking discussions)
- Client ↔ Owner (support, platform questions)
- Master ↔ Owner (administrative)
- Group chats (if enabled)

#### Chat Screen
**Purpose**: Real-time messaging with media support

**Features**:
- **Header**:
  - Contact photo and name
  - Online/last seen status
  - Call button (if enabled)
  - Info/menu button
- **Message Bubble Interface**:
  - Sent messages (right side, different color)
  - Received messages (left side)
  - Timestamps on messages
  - Read receipts (checkmarks)
- **Message Types Supported**:
  - Text messages
  - Photos (camera or gallery)
  - Videos
  - Voice messages
  - Documents/PDFs
  - Appointment cards (tap to view booking)
  - Product cards (tap to view product)
  - Location sharing
- **Input Area**:
  - Text input field
  - Send button
  - Attachment button (+) with options:
    - Camera
    - Photo library
    - Document
    - Location
  - Emoji picker
  - Voice message button (hold to record)
- **Context Menu**: Long-press message for options:
  - Reply
  - Copy
  - Forward
  - Delete
  - Report
- **Typing Indicator**: Shows when contact is typing
- **Scroll to Bottom Button**: Appears when scrolled up
- **Message Search**: Search within conversation

**Special Features**:
- **Swipe to Reply**: Reply to specific message
- **Message Reactions**: Add emoji reactions to messages
- **Message Status**: Sending, Sent, Delivered, Read
- **Media Gallery**: View all shared photos/videos
- **Chat Background**: Customizable themes

**Notification Integration**:
- Push notifications for new messages
- Notification settings per conversation
- Do not disturb mode

### Academy (Client Learning)

#### Academy Home Screen
**Purpose**: Browse and discover courses (Client view)

**Features**:
- **Featured Course Banner**: Highlighted course with CTA
- **Category Tabs**:
  - All Courses
  - Hair
  - Nails
  - Skincare
  - Makeup
  - Business
  - Beginner
  - Advanced
- **Course Grid**:
  - Course thumbnail
  - Course name
  - Instructor name
  - Price
  - Rating
  - Duration
  - "Enroll" or "Continue" button (based on enrollment status)
- **My Learning Section**: Courses currently enrolled in
- **Recently Viewed**: Course browsing history
- **Search Bar**: Find courses by name or topic
- **Filter Options**: Price, Rating, Duration, Level
- **Sort Options**: Popular, Newest, Highest Rated

**Enrollment Status Indicators**:
- Not Enrolled: Shows price and "Enroll" button
- Enrolled: Shows "Continue Learning" button and progress %
- Completed: Shows "Review Course" and certificate access

#### Course Detail Screen
**Purpose**: Course information and enrollment

**Features**:
- **Course Header**:
  - Cover image/video
  - Course title
  - Instructor name and photo
  - Rating with review count
  - Enrollment count
- **Course Stats**:
  - Duration
  - Number of lessons
  - Difficulty level
  - Last updated date
- **Pricing Section**:
  - Current price
  - Original price (if on sale)
  - Discount percentage
  - "Enroll Now" or "Buy Course" button
- **What You'll Learn**: Bullet list of learning outcomes
- **Course Curriculum Preview**:
  - Expandable lesson list
  - Shows lesson titles and types (video, text, quiz)
  - Free preview indicators (some lessons free to watch)
- **Instructor Bio**: About the course creator
- **Reviews Section**: Student reviews and ratings
- **Requirements**: Prerequisites and required materials
- **FAQ Section**: Common questions about the course

**Enrollment Flow**:
1. Client views course details
2. Client taps "Enroll" or "Buy"
3. If paid, proceeds to payment
4. If free, immediate enrollment
5. Course added to "My Learning"
6. Welcome notification sent

#### Lesson Screen
**Purpose**: Course content consumption

**Features**:
- **Video Player** (for video lessons):
  - Full-screen mode
  - Play/pause
  - Progress bar with scrubbing
  - Volume control
  - Playback speed (0.5x, 1x, 1.5x, 2x)
  - Subtitle/closed captions
  - Quality selector (if applicable)
- **Lesson Navigation**:
  - Previous lesson button
  - Next lesson button
  - Lesson list sidebar/dropdown
  - Current lesson indicator
- **Lesson Content**:
  - Lesson title
  - Lesson description
  - Rich text content (for text lessons)
  - Embedded media
  - Downloadable resources section
- **Progress Tracking**:
  - Mark as complete button
  - Auto-complete when video finishes
  - Progress percentage updated
- **Discussion/Comments**: Lesson-specific Q&A
- **Notes**: Personal note-taking feature
- **Bookmarks**: Save specific timestamps (for videos)

**Learning Flow**:
1. Student opens lesson
2. Watches video or reads content
3. Downloads resources if needed
4. Marks lesson complete
5. Progress saved automatically
6. Next lesson unlocks (if sequential)

#### Homework Screen (Student)
**Purpose**: Submit assignments and homework

**Features**:
- **Assignment Details**:
  - Lesson/course name
  - Assignment description
  - Requirements checklist
  - Due date
  - Grading criteria
- **Submission Area**:
  - Photo upload (multiple)
  - Video upload
  - Document upload (PDF, Word, etc.)
  - Text response field
- **Progress Indicator**: Shows what's uploaded
- **Submit Button**: Final submission
- **Save Draft**: Save without submitting
- **Previous Submissions**: View past attempts
- **Feedback View**: See instructor feedback (after grading)

**Assignment Types**:
- Photo submissions (practical work)
- Written assignments
- Video demonstrations
- Quizzes (auto-graded)
- Project uploads

#### Course Purchase Screen
**Purpose**: Payment and enrollment for paid courses

**Features**:
- **Course Summary**:
  - Course thumbnail
  - Course name
  - Instructor
  - Price
- **Price Breakdown**:
  - Course price
  - Tax (if applicable)
  - Discount code field
  - Total
- **Payment Method**:
  - Saved cards
  - Add new card
  - Apple Pay / Google Pay
- **Purchase Benefits**:
  - Lifetime access
  - Certificate of completion
  - Instructor support
  - Mobile and TV access
- **Refund Policy**: Brief explanation
- **Complete Purchase Button**
- **Secure Payment Indicators**

**Post-Purchase**:
- Receipt emailed
- Course added to "My Learning"
- Welcome notification
- Suggested next courses

---

## Terms of Service

### Version 1: Auth Flow Terms Screen

**Last Updated: February 2026**

**1. Acceptance of Terms**

By accessing and using Merakí, you verify that you have read, understood, and agree to be bound by these Terms of Service. If you do not agree to these terms, simply do not use the application.

**2. Use of Service**

Merakí provides a platform for booking beauty and wellness services. Users must be at least 18 years old to create an account. You represent and warrant that all information you submit is truthful and accurate.

**3. User Accounts**

You are responsible for maintaining the confidentiality of your account credentials. You agree to notify us immediately of any unauthorized use of your account.

**4. Cancellations & No-Shows**

In the event of a no-show or late cancellation, applicable fees may be charged according to the Master's cancellation policy.

**5. Privacy Policy**

Your privacy is important to us. Please review our Privacy Policy to understand how we collect, use, and share your personal information.

**6. Modifications**

We reserve the right to modify these terms at any time. Continued use of the service following any changes indicates your acceptance of the new terms.

---

### Version 2: Client Menu Terms of Service Screen

**Last Updated: January 2026**

**1. Acceptance of Terms**

By accessing and using the Merakí application, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our services.

**2. Services**

Merakí provides a platform for booking beauty and wellness services. We connect clients with professional beauty masters for appointments, product purchases, and educational content.

**3. User Accounts**

You are responsible for maintaining the confidentiality of your account credentials. You agree to notify us immediately of any unauthorized use of your account.

**4. Booking & Cancellations**

Appointments may be cancelled up to 24 hours in advance without charge. Late cancellations or no-shows may result in a fee charged to your payment method on file.

**5. Payments**

All payments are processed securely through our payment partners. Prices are displayed in Euros and include applicable taxes unless otherwise stated.

**6. Intellectual Property**

All content within the Merakí app, including logos, designs, and text, is the property of Merakí and protected by intellectual property laws.

**7. Limitation of Liability**

Merakí shall not be liable for any indirect, incidental, or consequential damages arising from your use of our services.

**8. Changes to Terms**

We reserve the right to modify these terms at any time. Continued use of the app after changes constitutes acceptance of the new terms.

**9. Contact**

For questions about these Terms, please contact us at legal@meraki.com

---

## Privacy Policy

**Last Updated: January 2026**

**1. Information We Collect**

We collect information you provide directly, including your name, email address, phone number, and payment information. We also collect usage data to improve our services.

**2. How We Use Your Information**

Your information is used to provide our services, process appointments and payments, send notifications, and improve the user experience. We never sell your personal data.

**3. Data Security**

We implement industry-standard security measures to protect your data. Payment information is processed through PCI-compliant payment processors and is never stored on our servers.

**4. Data Sharing**

We share your information only with service providers necessary to deliver our services, including payment processors and notification services. We require all third parties to respect the security of your data.

**5. Your Rights**

Under GDPR, you have the right to access, correct, or delete your personal data. You may also request data portability or withdraw consent at any time by contacting us.

**6. Cookies & Tracking**

Our mobile app uses analytics to understand usage patterns. You can disable analytics in your device settings or within the app preferences.

**7. Data Retention**

We retain your data for as long as necessary to provide our services. Account data is deleted upon request, subject to legal retention requirements.

**8. Children's Privacy**

Our services are not intended for children under 16. We do not knowingly collect personal information from children.

**9. Contact Us**

For privacy-related inquiries, contact our Data Protection Officer at privacy@meraki.com

---

## Navigation Architecture

### Tab Structure by Role

#### Client Navigation (5 Tabs)
1. **Home** - Dashboard and discovery
2. **Book** - Booking flow and chat
3. **Academy** - Learning platform
4. **Shop** - E-commerce
5. **Menu** - Profile and settings

#### Master Navigation (6 Tabs)
1. **Dashboard** - Business overview
2. **Appointments** - Booking management
3. **Supplies** - Inventory tracking
4. **Messages** - Client communication
5. **Shop** - Product purchasing (wholesale)
6. **Profile** - Settings and portfolio

#### Owner Navigation (5 Tabs)
1. **Dashboard** - Platform administration
2. **Academy** - Course management
3. **Appointments** - Platform-wide booking view
4. **Messages** - Communication hub
5. **Profile** - Admin settings

### Key User Flows

#### Client Booking Journey
1. Login/Register → Home Screen
2. Tap "Book Now" or browse services
3. Select service category
4. View service details
5. Select master
6. Choose date and time
7. Review and confirm booking
8. Payment authorization
9. Booking confirmation
10. Appointment added to list

#### Master Daily Workflow
1. Login → Dashboard
2. Review today's appointments
3. Confirm pending bookings
4. Manage schedule (add blocked time if needed)
5. Respond to client messages
6. Complete appointments and mark status
7. Review earnings

#### Owner Management Workflow
1. Login → Owner Dashboard
2. Review platform statistics
3. Approve new master registrations
4. Manage shop inventory
5. Create/update academy courses
6. Review homework submissions
7. Send platform notifications

---

## Key Features Deep Dive

### 1. Loyalty Program System

**Overview**: Comprehensive loyalty system with dual mechanisms - points-based rewards and digital stamp cards.

**QR Code Stamps**:
- Masters generate unique QR codes
- Clients scan QR after appointments to earn stamps
- Progress tracked on digital stamp cards
- Automated reward redemption when card filled

**NFC Stamps**:
- Alternative to QR for tap-to-stamp experience
- Requires device NFC capability
- Faster than QR scanning
- Same backend tracking

**Loyalty Points**:
- Earned from appointments, purchases, referrals
- Redeemable for discounts, free services, products
- Points expiration tracking
- Tier levels (Bronze, Silver, Gold) with benefits

**Master Control**:
- Custom stamp card creation
- Points value assignment
- Reward catalog management
- Client enrollment tracking

### 2. Consultation System

**Purpose**: Pre-service approval to ensure client expectations match service capabilities.

**Photo Consultations**:
- Client uploads photos of current state
- Describes desired outcome
- Master reviews and provides assessment
- Approve, request changes, or suggest alternatives
- Prevents booking mismatches

**Booking Consultations**:
- General questions before booking
- Service suitability assessment
- Allergy/sensitivity checks
- Timeline and availability discussion

**Benefits**:
- Reduces no-shows and cancellations
- Ensures service feasibility
- Builds client confidence
- Allows accurate pricing

### 3. Payment Processing

**Pre-Authorization System**:
- Deposit amount held on card at booking
- Reduces no-show risk for masters
- Captured after service completion or grace period
- Automatically released if cancelled within policy

**No-Show Fee Handling**:
- Configurable by master (percentage or fixed)
- Automatic capture if client doesn't attend
- Grace period before fee applied
- Dispute resolution process

**Dual Pricing**:
- Retail prices for clients
- Wholesale/professional prices for masters
- Automatic price display based on user role
- Encourages product sales to professionals

**Secure Processing**:
- PCI-compliant Stripe integration
- Multiple payment methods supported
- Receipt and invoice generation
- Transaction history and reporting

### 4. Aftercare Campaigns

**Automated Follow-up**:
- Masters configure post-service messages
- Triggered by appointment completion
- Multiple messages over time (Day 1, Day 3, Week 2)
- Personalized with client and service details

**Content Types**:
- Care instructions (text, photos, videos)
- Product recommendations
- Satisfaction check-ins
- Rebooking reminders
- Referral requests

**Benefits**:
- Improves client satisfaction
- Reduces post-service issues
- Drives product sales
- Increases retention and rebooking

### 5. Academy Platform

**Learning Management**:
- Video-based lessons with progress tracking
- Homework submission and grading
- Certificate generation upon completion
- Student analytics and engagement tracking

**Course Types**:
- Free courses (lead generation)
- Paid courses (revenue)
- Subscription-based (ongoing access)
- Certification programs

**Interactive Features**:
- Lesson discussions and Q&A
- Peer interaction
- Instructor feedback
- Resource downloads

**Business Value**:
- Revenue stream for platform
- Positions platform as educational authority
- Increases master engagement
- Client education builds trust

---

## Document Information

**Document Title**: Merakí App - Complete Documentation  
**Version**: 1.0  
**Total Pages Documented**: 83+ screens  
**User Roles Covered**: Client, Master, Owner  
**Last Updated**: February 2026  
**Platform**: React Native with Expo  
**Primary Function**: Beauty & Wellness Booking Platform  

---

**End of Documentation**
