# Merakí - Premium Beauty & Wellness Booking Platform

> **Merakí** (μεράκι) - A Greek word meaning "to do something with soul, creativity, or love; to put something of yourself into your work."

---

## 📱 Overview

**Merakí** is a comprehensive mobile booking platform designed for beauty and wellness professionals (referred to as "Masters") and their clients. Built with React Native and Expo, the app delivers a premium, modern experience with a sophisticated "Midnight Glass" design aesthetic featuring dark themes, glassmorphic effects, and smooth animations.

The platform serves as a bridge between service providers (hair stylists, nail artists, massage therapists, estheticians, etc.) and clients seeking their services. It handles the complete lifecycle of appointments—from discovery and booking through to completion and payment.

---

## 🎯 Core Concept

### The Problem

Independent beauty and wellness professionals often struggle with:
- Managing appointments across multiple channels (phone, text, social media)
- No-shows and last-minute cancellations
- Tracking earnings and business analytics
- Building a professional online presence
- Accepting payments securely
- Communicating efficiently with clients

### The Solution

Merakí provides a unified platform where:
- **Clients** can discover professionals, view their portfolios, book appointments, and manage their bookings
- **Masters** can manage their schedules, track earnings, communicate with clients, and grow their business
- **Administrators** have oversight of the entire platform ecosystem

---

## 👥 User Roles

### 1. Client (Default Role)
Regular users who book services. They can:
- Browse and discover Masters
- View service offerings with pricing
- Book appointments with real-time availability
- Manage upcoming and past bookings
- Reschedule or cancel appointments
- Message Masters directly
- Purchase products from the shop
- Earn and redeem loyalty points
- Manage payment methods

### 2. Master (Service Provider)
Beauty and wellness professionals who offer services. They can:
- Access a dedicated dashboard with business analytics
- **Instant Book**: Appointments are confirmed automatically (no manual approval needed)
- Receive push notifications for new bookings
- Set weekly availability schedules
- View and track earnings
- Communicate with clients via in-app chat
- Mark appointments as completed or no-show
- Reschedule appointments (requires client approval for late changes)
- Handle client reschedule requests

### 3. Owner (Platform Administrator)
Platform administrators with full access. They can:
- Access all Master features
- Manage platform-wide settings
- Manage Academy (Courses, Masters, Students)
- Manage Pending Master Invitations
- View comprehensive analytics
- Manage products in the shop
- Reschedule appointments (requires client approval)
- Receive push notifications for all appointment activities

---

## 🏗️ Technical Architecture

### Frontend Stack
| Technology | Purpose |
|------------|---------|
| **React Native 0.81.5** | Cross-platform mobile framework |
| **Expo SDK 54** | Development and build toolchain |
| **TypeScript** | Type-safe development |
| **React Navigation 7** | Navigation and routing |
| **expo-linear-gradient** | Gradient backgrounds |
| **date-fns** | Date manipulation and formatting |
| **expo-image-picker** | Media selection |
| **expo-secure-store** | Secure credential storage |
| **expo-notifications** | Push notifications |

### Backend Stack
| Technology | Purpose |
|------------|---------|
| **Supabase** | Backend-as-a-Service (BaaS) |
| **PostgreSQL** | Primary database |
| **Supabase Auth** | Authentication system |
| **Supabase Realtime** | Real-time subscriptions |
| **Supabase Storage** | File/image storage |
| **Row Level Security (RLS)** | Data access control |

### Design System
- **Color Palette**: "Meraki Luxe" - Deep mauve-blacks with warm, luxurious tones
- **Primary**: `#D48A82` (Muted dusty rose)
- **Secondary**: `#C0A0E0` (Muted lavender)
- **Accent**: `#E6C090` (Muted champagne gold)
- **Background**: `#0F0F13` (Deep mauve-black)
- **Surface**: `#1E1E24` (Warm charcoal)
- **Text**: `#FDF6F6` (Rose white)
- **Text Secondary**: `#AFA8BA` (Muted lavender-gray)
- **Glass Effects**: Semi-transparent surfaces with subtle borders

---

## 📂 Database Schema

### Core Tables

#### `profiles`
Stores user information for all roles.
```
- id: UUID (linked to Supabase Auth)
- email: string
- full_name: string
- phone: string
- avatar_url: string
- bio: string
- role: enum ('client', 'master', 'admin')
- is_master: boolean
- push_token: string
- stripe_customer_id: string
```

#### `services`
Available services that can be booked.
```
- id: UUID
- name: string
- description: string
- category: string
- base_price: number
- duration_minutes: number
- image_url: string
- is_active: boolean
```

#### `appointments`
All booking records.
```
- id: UUID
- client_id: UUID (FK -> profiles)
- master_id: UUID (FK -> profiles)
- service_id: UUID (FK -> services)
- start_time: timestamp
- end_time: timestamp
- status: enum ('pending', 'confirmed', 'completed', 'cancelled', 'cancelled_free', 'cancelled_charge', 'reschedule_pending', 'no_show')
- price: number
- notes: string
- stripe_payment_intent_id: string
- proposed_start_time: timestamp (for reschedule requests)
- proposed_end_time: timestamp (for reschedule requests)
- reschedule_initiated_by: UUID (FK -> profiles)
- cancellation_fee_amount: integer (cents, for late cancellations)
- cancellation_reason: string
```

#### `master_availability`
Weekly recurring availability slots.
```
- id: UUID
- master_id: UUID (FK -> profiles)
- day_of_week: integer (0-6)
- start_time: time
- end_time: time
- is_available: boolean
```

#### `master_services`
Junction table linking Masters to services they offer.
```
- id: UUID
- master_id: UUID (FK -> profiles)
- service_id: UUID (FK -> services)
- custom_price: number (optional override)
- custom_duration: number (optional override)
- is_available: boolean
```

#### `appointment_confirmations`
Tracks confirmation status and reminders.
```
- id: UUID
- appointment_id: UUID (FK -> appointments)
- confirmed: boolean
- confirmed_at: timestamp
- reminder_sent_at: timestamp
```

#### `pending_masters`
Temporary table for master invitations.
```
- id: UUID
- email: string
- full_name: string
- master_status: string
- commission_rate: number
- created_by: UUID (FK -> auth.users)
```

#### `payment_methods`
saved Stripe payment methods.
```
- id: UUID
- user_id: UUID (FK -> profiles)
- stripe_payment_method_id: string
- brand: string
- last4: string
- exp_month: integer
- exp_year: integer
- is_default: boolean
```

#### `payments`
Transaction history.
```
- id: UUID
- user_id: UUID (FK -> profiles)
- appointment_id: UUID (FK -> appointments)
- order_id: UUID (FK -> orders)
- stripe_payment_intent_id: string
- amount: integer (cents)
- currency: string
- status: enum
- payment_type: enum ('booking', 'shop', 'no_show')
```

#### `payouts`
Master earnings records.
```
- id: UUID
- master_id: UUID (FK -> profiles)
- amount: integer
- status: enum
- stripe_payout_id: string
```

#### `refunds`
Refund records.
```
- id: UUID
- payment_id: UUID (FK -> payments)
- stripe_refund_id: string
- amount: integer
```

### Database Functions

- **`get_available_slots(master_id, date, duration)`**: Returns available time slots for a specific Master on a given date
- **`book_appointment(master_id, service_id, start_time, notes)`**: Atomically creates a new appointment

---

## ✅ Implemented Features

### Authentication System
- [x] Email/password registration
- [x] Email/password login
- [x] Secure session persistence (expo-secure-store)
- [x] Auto-refresh tokens
- [x] Role-based navigation (Client vs Master/Admin)
- [x] User profile creation on signup

### Client Features

#### Home Screen
- [x] Personalized greeting with time-of-day awareness
- [x] Featured Masters carousel
- [x] Quick action buttons (Shop, Orders, Support, Promo)
- [x] Popular services grid
- [x] Pull-to-refresh for data updates
- [x] Premium "Midnight Glass" design aesthetic

#### Booking Flow
- [x] Service browsing by category
- [x] Service detail view with pricing and duration
- [x] Master selection for chosen service
- [x] Master detail profiles with bio and services
- [x] Date selection with 30-day lookahead
- [x] Time slot selection based on real-time availability
- [x] Booking confirmation screen
- [x] Notes field for special requests
- [x] Appointment creation in database

#### Orders Management
- [x] Tabbed view (Upcoming / Past appointments)
- [x] Appointment cards with status badges
- [x] Appointment details (date, time, duration, price)
- [x] **Time-window based cancellation policy** (24-hour rule)
  - [x] Early cancellation (>24h): Free, automatic, no Master approval
  - [x] Late cancellation (<24h): Warning modal with 50% penalty fee
- [x] **Time-window based reschedule policy**
  - [x] Early reschedule (>24h): Instant update, no approval needed
  - [x] Late reschedule (<24h): Requires Master approval
- [x] Direct chat access from appointment cards
- [x] Pull-to-refresh

#### In-App Messaging
- [x] Conversation list with recent messages
- [x] Real-time chat with Masters and Owners
- [x] Text message support
- [x] Image upload support (Photo Consultation)
- [x] Video upload support
- [x] Optimistic UI updates
- [x] Message grouping by sender
- [x] Timestamp display
- [x] Keyboard-aware input

#### Shop
- [x] Product grid display
- [x] Category filtering
- [x] Search functionality
- [x] Product detail view
- [x] Product images
- [x] Pricing display

#### Profile & Settings
- [x] Profile viewing
- [x] Avatar display with actual profile pictures
- [x] Profile picture visibility across all screens
- [x] Navigation to Orders, Notifications, etc.
- [x] Help & Support screen with FAQ
- [x] Terms of Service screen
- [x] Privacy Policy screen
- [x] Loyalty Points screen (UI implemented)
- [x] Payment Methods screen (UI implemented)
- [x] Notifications screen (UI implemented)
- [x] Sign out functionality
- [x] Profile icon navigates to Menu tab (proper navigation)

#### Navigation
- [x] Bottom tab navigation (Home, Book, Messages, Shop, Menu)
- [x] Hamburger/drawer menu with full navigation
- [x] Stack navigation for nested screens
- [x] Smooth transitions

### Master Features

#### Dashboard
- [x] Today's appointments overview
- [x] Real-time statistics (today's bookings, earnings, completion rate)
- [x] Quick stats cards
- [x] Recent messages preview
- [x] Pull-to-refresh

#### Appointments Management
- [x] Tabbed view (Pending, Upcoming, Completed)
- [x] Appointment cards with client details
- [x] Confirm pending appointments
- [x] Decline pending appointments
- [x] Mark as completed
- [x] Mark as no-show (Charges cancellation fee automatically)
- [x] Direct chat with clients

#### Availability Management
- [x] Weekly schedule view
- [x] Toggle availability for each day
- [x] Set start and end times per day
- [x] Save availability to database

#### Earnings Tracking
- [x] Earnings summary (today, week, month)
- [x] Transaction history list
- [x] Earnings breakdown by time period

#### Rescheduling (Master/Owner)
- [x] Reschedule appointments via date/time picker
- [x] Client approval required for master-initiated reschedules
- [x] Reschedule request notifications to clients
- [x] Appointment status tracking (`reschedule_pending`)

### Push Notifications
- [x] Notification service with Expo push notifications
- [x] Push token registration on login/signup
- [x] Booking confirmation notifications
- [x] Reschedule request notifications
- [x] Reschedule approval/decline notifications
- [x] Appointment cancellation notifications
- [x] Notifications for all parties (client, master, owner)

### UI/UX Features
- [x] "Midnight Glass" premium dark theme
- [x] Glassmorphic card effects
- [x] Gradient backgrounds with `ScreenBackground` component
- [x] Consistent background across all screens (including booking flow)
- [x] Custom button components with variants (primary, secondary, outline, ghost)
- [x] Custom card components (default, glass, dark variants)
- [x] Consistent typography system
- [x] Loading states with activity indicators
- [x] Pull-to-refresh across all list views
- [x] Safe area handling for notches and home indicators
- [x] Profile picture display across chat, master details, and service selection

### Profile Pictures
- [x] Profile picture display in chat conversations
- [x] Profile picture display in chat headers
- [x] Profile picture display in master list (Messages screen)
- [x] Profile picture display in Master Detail screen
- [x] Profile picture display in Service Detail (specialist selection)
- [x] Fallback to initials when no avatar is set

---

## 🚧 Features Not Yet Implemented

### Payment System
### Payment & Protection
- [x] Stripe integration for payments (⚠️ **Simulation Mode** - All payment infrastructure ready but using mock data for development)
- [x] Automatic charge for No-Show
- [x] Payment processing during booking (Pre-authorization)
- [x] Saved payment methods functionality
- [x] Payment history screen
- [x] Secure SetupIntents for card saving
- [x] Shop checkout immediate payment
- [ ] Master payouts (Stripe Connect integration pending)
- [x] Refund processing (Edge Function ready)

**Note:** To enable real payments, connect a Stripe account and switch from simulation mode in `stripeService.ts` and `CheckoutScreen.tsx`.

### Push Notifications (Additional)
- [x] Appointment reminder notifications (24h, 1h before)
- [x] New message notifications
- [x] Marketing/promotional notifications

### Loyalty Program
- [x] **QR Code Scanning:** Client scans Master's unique dynamic QR code to earn points (+50 points per scan).
- [x] **Dynamic QR Codes:** Codes rotate automatically after each scan for security.
- [x] **Rewards Catalog:** Redeem points for discounts or free services.
- [x] **Transaction History:** Full history of earned and redeemed points.
- [x] **Backend Integration:** Secure RPC functions for validation and processing.
- [ ] **Purchase-Based Points:** Automatic points calculation for service bookings and shop purchases (currently QR scans only)





### Shop (E-commerce)
- [x] Add to cart functionality
- [x] Shopping cart management
- [x] Checkout flow (Order placement)
- [x] Stock tracking
- [x] Payment processing (Stripe online payment - simulation mode)
- [x] Order history
- [ ] Cash on Delivery option (displayed in orders but not offered at checkout)

### Master Features
- [x] Blocked time slots
- [x] Custom pricing per service
- [x] Vacation mode (via Blocked Slots)
- [x] Basic earnings tracking (today/week/month totals)
- [ ] Business analytics dashboard (charts, trends, insights - basic stats only currently)



### Additional Features
- [x] Avatar upload (Client)
- [x] Share functionality

---

## 🎓 Merakí Academy

A dedicated education platform within the app for both students and owners.

### Client-Side (Student)
- [x] Course catalog view (`AcademyHomeScreen`)
- [x] Course detail with lesson list (`CourseDetailScreen`)
- [x] Video player integration (`LessonScreen` via expo-av)
- [x] Lesson progress tracking (saved to `lesson_progress` table)
- [x] Homework submission with photo upload (`HomeworkScreen`)

### Owner-Side (Management)
- [x] **3-Tab Academy Management** (`ManageAcademyScreen`)
  - 🎓 **Courses Tab**: Course list with FAB, create/edit courses
  - 📥 **Inbox Tab**: Homework review queue with pending badge
  - 👥 **Students Tab**: Analytics and enrolled student progress
- [x] **Course Editor** (`CourseEditorScreen`): Cover image, title, price, publish toggle
- [x] **Curriculum Builder**: Add chapters, add lessons within chapters
- [x] **Lesson Editor** (`LessonEditorScreen`): Video URL (Vimeo/Mux/YouTube), Direct Video Upload (Supabase Storage), resources, homework toggle
- [x] **Homework Review** (`HomeworkReviewScreen`): View photo, feedback, approve/reject
- [x] **Student Analytics** (`AcademyStudentsScreen`): Revenue, enrollment count, completion rate

### Database Tables
- [x] `courses` - Course info with instructor, price, publish status
- [x] `chapters` - Organize lessons within courses
- [x] `lessons` - Video content with chapter grouping
- [x] `lesson_progress` - Track student progress
- [x] `homework_submissions` - Student photo submissions
- [x] `course_enrollments` - Track enrolled students

## 📦 Advanced Inventory & Logic
- [x] **Dual-Pricing System:** Automatically show wholesale prices to logged-in Masters (Special Pricing).
- [x] **Stock Tracking:** `decrement_stock()` function integrated with checkout.
- [x] **Low Stock Alerts:** Edge Function deployed to notify Admin when stock is low.
- [x] **Admin Inventory Screen:** Dashboard for owners to monitor and edit stock levels.

## 🛡️ No-Show & Automation
- [x] **Stripe Pre-Auth Infrastructure:** Edge Functions deployed for payment holds (requires Stripe account setup).
- [x] **Aftercare Automations:** Edge Function deployed for post-appointment care reminders.

---

## 📁 Project Structure

```
meraki_app/
├── App.tsx                     # Root component
├── package.json                # Dependencies
├── tsconfig.json               # TypeScript config
├── src/
│   ├── App.tsx                 # App entry with providers
│   ├── components/
│   │   ├── DrawerMenu.tsx      # Hamburger menu component
│   │   └── ui/
│   │       ├── Button.tsx      # Reusable button component
│   │       ├── Card.tsx        # Reusable card component
│   │       └── index.ts        # UI exports
│   ├── contexts/
│   │   └── AuthContext.tsx     # Authentication context
│   ├── lib/
│   │   └── supabase.ts         # Supabase client config
│   ├── navigation/
│   │   ├── AppNavigator.tsx    # Root navigator
│   │   ├── AuthStack.tsx       # Auth flow screens
│   │   ├── ClientTabs.tsx      # Client tab navigator
│   │   ├── MasterTabs.tsx      # Master tab navigator
│   │   └── index.ts            # Navigation exports
│   ├── screens/
│   │   ├── academy/            # Client Academy screens
│   │   ├── auth/               # Login, Register screens
│   │   ├── chat/               # Chat screens
│   │   ├── client/             # Client-specific screens
│   │   ├── master/             # Master-specific screens
│   │   ├── owner/              # Owner screens
│   │   │   └── academy/        # Owner Academy management screens
│   │   └── shop/               # Shop screens
│   ├── services/
│   │   ├── notificationService.ts  # Push notification service
│   │   └── stripeService.ts    # Stripe payment service
│   ├── theme/
│   │   ├── colors.ts           # Color palette
│   │   ├── spacing.ts          # Spacing system
│   │   └── index.ts            # Theme exports
│   └── types/
│       └── database.ts         # Supabase database types
├── supabase/
│   └── functions/              # 13 Edge Functions
│       ├── aftercare-reminder/       # Post-appointment care reminders
│       ├── appointment-reminders/    # 24h and 1h before appointment alerts
│       ├── cancel-payment/           # Cancel payment holds
│       ├── capture-payment/          # Capture pre-authorized payments
│       ├── create-payment-intent/    # Create Stripe PaymentIntents
│       ├── delete-payment-method/    # Remove saved cards from Stripe
│       ├── handle-no-show/           # Process no-show fee capture
│       ├── list-payment-methods/     # Retrieve saved payment methods
│       ├── low-stock-alert/          # Notify admin of low inventory
│       ├── process-refund/           # Issue full or partial refunds
│       ├── send-marketing-notification/  # Promotional push notifications
│       ├── send-message-notification/    # New chat message alerts
│       └── setup-intent/             # Create SetupIntents for saving cards
└── supabase_migrations.sql     # Database schema
```

---

## ⚡ Edge Functions Reference

All 13 Edge Functions deployed to Supabase:

### Payment Functions
| Function | Purpose | Status |
|----------|---------|--------|
| `create-payment-intent` | Creates Stripe PaymentIntent for bookings (pre-auth) or shop (immediate) | ✅ Deployed |
| `capture-payment` | Captures held funds after appointment completion | ✅ Deployed |
| `cancel-payment` | Cancels payment hold and releases funds | ✅ Deployed |
| `handle-no-show` | Captures no-show fee from pre-authorized payment | ✅ Deployed |
| `process-refund` | Issues full or partial refunds | ✅ Deployed |
| `setup-intent` | Creates SetupIntent for securely saving cards | ✅ Deployed |
| `list-payment-methods` | Retrieves saved payment methods for a customer | ✅ Deployed |
| `delete-payment-method` | Detaches payment method from Stripe customer | ✅ Deployed |

### Notification Functions
| Function | Purpose | Status |
|----------|---------|--------|
| `appointment-reminders` | Sends 24h and 1h before appointment reminders | ✅ Deployed |
| `send-message-notification` | Notifies users of new chat messages | ✅ Deployed |
| `send-marketing-notification` | Sends promotional push notifications | ✅ Deployed |
| `aftercare-reminder` | Sends post-appointment care instructions | ✅ Deployed |

### Inventory Functions
| Function | Purpose | Status |
|----------|---------|--------|
| `low-stock-alert` | Notifies admin when product stock is low | ✅ Deployed |

**Note:** All payment Edge Functions currently operate in simulation mode for development. They will process real payments once connected to a live Stripe account.

---

## 🔐 Security Considerations

### Implemented
- Secure token storage with expo-secure-store
- Row Level Security (RLS) policies on Supabase tables
- Automatic token refresh
- Role-based access control

### Recommendations for Production
- Enable Two-Factor Authentication
- Implement rate limiting on API endpoints
- Add input validation/sanitization
- Set up proper CORS policies
- Enable Supabase email verification
- Configure proper SSL/TLS
- Add security headers
- Implement proper error handling (no sensitive data exposure)

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- Expo CLI
- iOS Simulator (macOS) or Android Emulator

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd meraki_app

# Install dependencies
npm install

# Start the development server
npx expo start
```

### Running on Device
- **Android**: Press `a` or scan QR code with Expo Go
- **iOS**: Press `i` (requires macOS) or scan QR code with Camera app
- **Web**: Press `w` (limited support)

---

## 🎨 Design Philosophy

Merakí follows a "Meraki Luxe" aesthetic that combines:

1. **Depth through Darkness**: Deep mauve-black backgrounds (`#0F0F13`) create a sense of premium luxury

2. **Warm Accents**: Muted dusty rose (`#D48A82`), lavender (`#C0A0E0`), and champagne gold (`#E6C090`) add elegance and warmth

3. **Glassmorphism**: Semi-transparent surfaces with subtle borders create layered depth

4. **Micro-interactions**: Subtle animations and transitions enhance the user experience

5. **Typography Hierarchy**: Clear font sizing and weight differentiation guides the eye

6. **Generous Spacing**: Balanced whitespace prevents visual clutter

---

## 📊 Current Status

| Area | Status |
|------|--------|
| Authentication | ✅ Complete |
| Client Booking Flow | ✅ Complete |
| Client Orders Management | ✅ Complete |
| Client Messaging | ✅ Complete |
| Master Dashboard | ✅ Complete |
| Master Schedule | ✅ Complete |
| Reschedule Flow | ✅ Complete |
| Push Notifications | ✅ Complete (Core) |
| Profile Pictures | ✅ Complete |
| UI/UX Design System | ✅ Complete |
| Payment Integration | ✅ Infrastructure Complete (Simulation Mode) |
| Shop Checkout | ✅ Complete (Stripe Payment) |
| Master Payouts | ❌ Pending |
| Business Analytics Dashboard | ❌ Pending |


---

## 📝 Version History

| Version | Date | Changes |
|---------|------|---------|
| 0.1.0 | Jan 2026 | Initial development version with core booking functionality |
| 0.2.0 | Jan 21, 2026 | Added push notifications, reschedule flow with client approval, profile picture visibility across all screens, improved navigation (profile icon → Menu tab), consistent ScreenBackground on booking screens |
| 0.3.0 | Jan 23, 2026 | Added Academy Management System, Master Invitations (Pending Masters), Chat with Owners, and Video Uploads |
| 0.4.0 | Jan 26, 2026 | Complete Stripe Payment Infrastructure: Saved cards, Booking pre-auth, Shop checkout, No-Show protection fee, Payment History (Simulation Mode) |
| 0.5.0 | Feb 2, 2026 | Documentation update: Fixed color palette to "Meraki Luxe", corrected feature status markers, removed duplicate entries, added complete Edge Functions list |

---

## 📄 License

This project is proprietary software. All rights reserved.

---

## 🤝 Contributing

This is a private project. Please contact the project owner for contribution guidelines.

---

*Built with ❤️ using React Native, Expo, and Supabase*
