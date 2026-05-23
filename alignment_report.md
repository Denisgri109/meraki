### 1. Feature Mapping Table

| Feature Name | "meraki web" Path/Files | Mobile Path/Files | Alignment Status |
| :--- | :--- | :--- | :--- |
| Authentication & Onboarding (Register) | `meraki_web/src/app/(auth)/register/page.tsx` | `src/screens/auth/RegisterScreen.tsx` | Aligned |
| OTP Verification | `meraki_web/src/app/(auth)/verify/page.tsx` | `src/screens/auth/VerifyOtpScreen.tsx` | Aligned |
| Home Screen (Quick Actions) | `meraki_web/src/app/dashboard/page.tsx` | `src/screens/client/HomeScreen.tsx` | Discrepancy Found |
| Appointments Management (Badges) | `meraki_web/src/app/dashboard/appointments/page.tsx` | `src/screens/client/AppointmentListScreen.tsx` | Discrepancy Found |
| Discover & Search (Trending Tags) | `meraki_web/src/app/dashboard/discover/page.tsx` | `src/screens/client/DiscoverMastersScreen.tsx` | Partially Aligned |

### 2. Flow & Logic Gap Analysis

#### Home Screen (Quick Actions)
- **Web Flow (from "meraki web"):** The web dashboard's quick actions block displays "Book Now", "Discover", "Shop", "Academy", and "Rewards". It is implemented with an array of objects `quickActions` mapping these routes to Lucide icons.
- **Mobile Flow:** The mobile app's `HomeScreen.tsx` has Quick Actions labeled 'Book', 'Discover', 'Loyalty', and 'Shop', navigating to the corresponding screens.
- **Gap Description:** The mobile app is missing the Quick Action for 'Academy'. Both web and mobile use "Rewards/Loyalty", "Shop", "Discover", and "Book" but Mobile lacks the "Academy" link.

#### Appointments Management (Status Badges)
- **Web Flow (from "meraki web"):** The `AppointmentsPage` component has a `getStatusColor` function that handles various statuses, including `reschedule_pending` and `no_show`.
- **Mobile Flow:** The `AppointmentListScreen` has a `statusColors` object and `formatStatus` function to render badges. Currently it implements `pending`, `confirmed`, `completed`, `cancelled`, and `cancelled_free`.
- **Gap Description:** Mobile is missing status badge definitions for `reschedule_pending` and `no_show` statuses in both `statusColors` and `formatStatus` mapping.

#### Discover & Search (Trending Tags)
- **Web Flow (from "meraki web"):** The `DiscoverPage` component displays "Trending Tags" as colorful gradient pills that the user can click to filter the professionals grid by specialty or name.
- **Mobile Flow:** The `DiscoverMastersScreen` displays a search bar to filter by name or city but lacks the "Trending Tags" feature.
- **Gap Description:** The mobile Discover screen lacks the Trending Tags section and its associated filtering logic.

### 3. Actionable Alignment Plan

1. **Update Mobile Quick Actions:** Modify `src/screens/client/HomeScreen.tsx` to add "Academy" to the quick actions row, mirroring the 5 options present on the web version.
2. **Update Mobile Appointment Status Badges:** In `src/screens/client/AppointmentListScreen.tsx`:
   - Add `reschedule_pending` and `no_show` entries to the `statusColors` map. (e.g., violet for `reschedule_pending` and rose for `no_show`).
   - Add `reschedule_pending` and `no_show` entries to the `formatStatus` function, returning 'Reschedule Pending' and 'No-Show' respectively.
3. **Implement Trending Tags on Mobile:** Update `src/screens/client/DiscoverMastersScreen.tsx`:
   - Add a list of `trendingTags` matching the web (`['Balayage', 'Gel Nails', 'Lash Extensions', 'Facial', 'Braids', 'Microblading', 'Keratin', 'Waxing']`).
   - Add a horizontal `ScrollView` below the search bar to display these tags as touchable pills.
   - Update the `filteredMasters` logic to filter by `specialties` when a tag is selected, mirroring the web logic.
