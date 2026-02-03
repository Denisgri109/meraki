# Merakí - Premium Beauty & Wellness Booking Platform

> **Merakí** (μεράκι) - A Greek word meaning "to do something with soul, creativity, or love; to put something of yourself into your work."

A comprehensive mobile booking platform built with React Native and Expo, connecting beauty and wellness professionals ("Masters") with their clients.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn
- Expo CLI (`npm install -g @expo/cli`)
- iOS Simulator (macOS) or Android Emulator

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd meraki_app

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your Supabase and Stripe credentials

# Start the development server
npx expo start
```

### Running the App

- **Android**: Press `a` in terminal or scan QR code with Expo Go
- **iOS**: Press `i` (requires macOS) or scan QR code with Camera app
- **Web**: Press `w` (limited support)

## 📱 Features

### For Clients
- ✨ Browse and book beauty/wellness services
- 📅 Real-time appointment scheduling with 30-day lookahead
- 💬 In-app messaging with professionals
- 🛍️ Shop beauty products with dual pricing (retail/wholesale)
- 🎓 Access Academy courses and video lessons
- 🏆 Earn loyalty points via QR code scanning
- 💳 Manage saved payment methods
- 📊 View booking and order history

### For Masters (Professionals)
- 📊 Dashboard with real-time statistics
- 📅 Instant booking (auto-confirmed appointments)
- 💰 Track earnings with time-period filtering
- 📅 Set weekly availability schedules
- 💬 Communicate with clients via chat
- ⚡ Mark appointments complete or no-show
- 🏷️ Generate QR codes for client loyalty points
- 🎨 Build professional portfolio

### For Owners (Administrators)
- 🎯 All Master features included
- 👥 Manage master invitations and onboarding
- 📚 Create and manage Academy courses
- 📦 Inventory management with low-stock alerts
- 📈 Student analytics and progress tracking
- 🔔 Platform-wide push notifications

## 🏗️ Tech Stack

### Frontend
- **React Native** 0.81.5 - Cross-platform mobile framework
- **Expo SDK** 54 - Development toolchain
- **TypeScript** - Type-safe development
- **React Navigation** 7 - Navigation and routing
- **date-fns** - Date manipulation
- **expo-camera** - QR code scanning
- **expo-notifications** - Push notifications
- **expo-secure-store** - Secure credential storage
- **expo-av** - Video playback for Academy

### Backend
- **Supabase** - Backend-as-a-Service (BaaS)
  - PostgreSQL database
  - Authentication system
  - Real-time subscriptions (chat)
  - File storage (images, videos)
  - Edge Functions (serverless)
- **Row Level Security (RLS)** - Data access control

### Payments (Simulation Mode)
- **Stripe React Native** - Payment SDK
- **Pre-authorization** for bookings (hold funds)
- **Immediate capture** for shop orders
- **Saved payment methods** with secure SetupIntents
- **No-show fee capture** automation
- ⚠️ **Currently in simulation mode** - requires Stripe account for production

## 🎨 Design System - "Meraki Luxe"

Premium "Midnight Glass" aesthetic with warm, luxurious tones:

| Color | Hex | Usage |
|-------|-----|-------|
| Background | `#0F0F13` | Deep mauve-black |
| Surface | `#1E1E24` | Warm charcoal cards |
| Primary | `#D48A82` | Muted dusty rose (brand) |
| Secondary | `#C0A0E0` | Muted lavender |
| Accent | `#E6C090` | Muted champagne gold |
| Text | `#FDF6F6` | Rose white |
| Text Secondary | `#AFA8BA` | Muted lavender-gray |

## 📂 Project Structure

```
meraki_app/
├── App.tsx                     # Root component
├── package.json                # Dependencies
├── app.json                    # Expo configuration
├── .env                        # Environment variables
├── APP_DOCUMENTATION.md        # Detailed documentation
├── TEST_CASES.md              # Testing guide
├── supabase_migrations.sql    # Database schema
├── src/
│   ├── App.tsx                # Main app entry with providers
│   ├── components/            # Reusable UI components
│   │   ├── ui/               # Button, Card, Input, etc.
│   │   ├── chat/             # Chat-specific components
│   │   └── StripeProvider.tsx # Payment provider wrapper
│   ├── contexts/             # Auth and Cart contexts
│   ├── lib/                  # Supabase client and API
│   ├── navigation/           # Navigators for all roles
│   ├── screens/              # Screen components
│   │   ├── academy/          # Client Academy (Student)
│   │   ├── auth/             # Login, Register, etc.
│   │   ├── chat/             # Chat screens
│   │   ├── client/           # Client features
│   │   ├── master/           # Master features
│   │   ├── owner/            # Owner + Academy management
│   │   └── shop/             # Shop and checkout
│   ├── services/             # Notification & Stripe services
│   ├── theme/                # Colors and styling
│   ├── types/                # TypeScript definitions
│   └── utils/                # Helper utilities
└── supabase/
    └── functions/            # 13 Edge Functions
        ├── create-payment-intent/
        ├── capture-payment/
        ├── cancel-payment/
        ├── handle-no-show/
        ├── process-refund/
        ├── setup-intent/
        ├── list-payment-methods/
        ├── delete-payment-method/
        ├── appointment-reminders/
        ├── send-message-notification/
        ├── send-marketing-notification/
        ├── low-stock-alert/
        └── aftercare-reminder/
```

## 🔐 Environment Variables

Create a `.env` file with:

```env
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_key
```

## 📊 Current Status

| Feature | Status |
|---------|--------|
| Authentication | ✅ Complete |
| Client Booking Flow | ✅ Complete |
| Master Dashboard | ✅ Complete |
| In-App Messaging | ✅ Complete |
| Push Notifications | ✅ Complete |
| Academy System | ✅ Complete |
| Shop & E-commerce | ✅ Complete |
| Loyalty Program (QR) | ✅ Complete |
| Payment Infrastructure | ✅ Ready (Simulation Mode) |
| Master Payouts | ❌ Pending |
| Business Analytics | ❌ Pending |

## 🧪 Testing

See [TEST_CASES.md](./TEST_CASES.md) for comprehensive testing guide.

```bash
# Run tests (when implemented)
npm test
```

## 📄 Documentation

- **[APP_DOCUMENTATION.md](./APP_DOCUMENTATION.md)** - Comprehensive feature documentation, database schema, API reference
- **[TEST_CASES.md](./TEST_CASES.md)** - Testing procedures and validation steps
- **[supabase_migrations.sql](./supabase_migrations.sql)** - Database schema definition

## 🚀 Deployment

### Building for Production

```bash
# Build for iOS
npx expo build:ios

# Build for Android
npx expo build:android

# Or use EAS (Expo Application Services)
npx eas build --platform ios
npx eas build --platform android
```

### Supabase Edge Functions

Deploy Edge Functions to production:

```bash
cd supabase/functions/create-payment-intent
supabase functions deploy create-payment-intent

# Deploy all functions
supabase functions deploy
```

## 🛡️ Security

- ✅ Row Level Security (RLS) on all database tables
- ✅ Secure token storage with expo-secure-store
- ✅ Automatic token refresh
- ✅ Role-based access control
- ⚠️ Enable 2FA for production
- ⚠️ Configure rate limiting for API endpoints
- ⚠️ Set up proper CORS policies

## 📝 License

This project is proprietary software. All rights reserved.

## 🤝 Support

For support or questions, please contact the development team.

---

*Built with ❤️ using React Native, Expo, and Supabase*
*Design: Meraki Luxe - Premium Midnight Glass Aesthetic*
