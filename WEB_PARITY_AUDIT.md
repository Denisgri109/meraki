# meraki-WEB → meraki-MOBILE parity audit

Direction: **which web features exist in the mobile app**. (The existing
`MOBILE_FEATURES_CHECKLIST.md` in `meraki-WEB` tracks the opposite direction.)

Method: every distinct route under `meraki-WEB/src/app/{dashboard,beauty,pilates}`
was mapped to a registered screen in `meraki-MOBILE/src/navigation`. "Registered"
means reachable through a navigator, not merely present as a file — several gaps
below were screens that existed but were never wired up.

Last run: 2026-08-09.

---

## Route map

| Web route | Mobile screen | Status |
|---|---|---|
| `academy` | `AcademyHome` | ✅ |
| `academy/[courseId]` | `CourseDetail` | ✅ |
| `academy/homework` | `Homework`, `HomeworkReview`, Homework Inbox tab | ✅ |
| `academy/learn/[courseId]` | `Lesson` | ✅ |
| `academy/qa` | Lesson Q&A inbox tab, `LessonQADetail` | ✅ |
| `academy/students` | Students tab, `StudentDetail` | ✅ |
| `analytics` | `PlatformAnalytics` | ✅ |
| `appointments` | `AppointmentList` (client), `Appointments` (master/owner) | ✅ |
| `availability` | `Availability`, `BlockedSlots` | ✅ |
| `booking` | `BookAndChat`, `Booking`, `SelectDateTime`, `BookingConfirm` | ✅ |
| `cart` | `Cart` | ✅ |
| `chat` | `ChatList`, `Chat` | ✅ |
| `checkout` | `Checkout` | ✅ |
| `class-packages` | `ClassPackages` | ✅ |
| `clients` | `ClientDirectory` | ✅ |
| `clients/[id]` | `ClientDetail` | ✅ |
| `consultations` | `PhotoConsultations`, `BookingConsultations` | ✅ |
| `debug` | — | n/a (web dev tool) |
| `discover` | `DiscoverMasters` | ✅ |
| `earnings` | `Earnings` | ✅ |
| `finance` | `Finance` | ✅ |
| `instructors` | `Instructors` | ✅ |
| `inventory` | `Inventory` | ✅ |
| `loyalty` | `StampCards` | ✅ |
| `loyalty/cards` | `LoyaltyCardBuilder` | ✅ |
| `loyalty/qr` | `LoyaltyQR` | ✅ |
| `loyalty/scan` | `QRScanner`, `NFCScanner` | ✅ |
| `masters` | `MasterManagement` | ✅ (Applications tab added — see below) |
| `masters/[id]` | `MasterDetail` | ✅ |
| `notifications` | `Notifications` | ✅ |
| `onboarding` | `MasterOnboarding` | ✅ |
| `orders` | `Orders`, `CustomerOrders`, `OrderDetail` | ✅ |
| `passes` | `ClassPasses` | ✅ |
| `qr-payments` | `QrPayments`, `ScanToPay` | ✅ |
| `services` | `Services`, `MyServices`, `ServiceForm`, `CreateService` | ✅ |
| `services/pilates/[id]` | `ServiceDetail` | ✅ |
| `settings` | `BusinessSettings`, `Profile` | ✅ |
| `shop` | `ShopMain` | ✅ |
| `shop/[id]` | `ProductDetail` | ✅ |
| `supplies` | `Supplies`, `OwnerSupplies`, `ServiceSupplies`, `AddSupply` | ✅ |
| `support` | `HelpSupport`, `SupportSettings` | ✅ |
| `vouchers` | `Vouchers`, `VoucherSignup` | ✅ |
| `waivers` | `PilatesWaivers`, `PilatesWaiverSheet` | ✅ |
| `/`, `/about`, `/contact`, `/get-app`, section landing pages | — | n/a (public marketing site) |

---

## Gaps found and closed

1. **Master application review was unreachable.**
   `MasterApplicationReviewScreen` and the `approveApplication` /
   `rejectApplication` service calls existed but nothing referenced them, so the
   web dashboard's "Pending Approvals" had no mobile equivalent.
   Added `fetchMasterApplications`, a pending-applications count, an
   **Applications** tab in `MasterManagementScreen`, and route registration.

2. **Appointment confirmation was unreachable, and its push notification led nowhere.**
   `AppointmentConfirmationScreen` was never registered, and
   `NotificationContext` routed `confirmation_request` / `appointment_reminder`
   pushes to `Book → AppointmentDetails`, a route that does not exist.
   Registered the screen in the client Home stack and repointed both push types
   at it.

3. **FAQ content was hardcoded.**
   Web stores owner-edited FAQ entries in `global_settings.faq_items`; mobile
   shipped a fixed array. Mobile now reads the same key (bundled list is the
   fallback) and the owner can add/edit/delete entries from Customize App.

4. **Support contact details were not shared.**
   Web reads `global_settings.support_settings`; mobile only read the owner's
   `master_settings` row. Mobile now prefers the shared record and falls back to
   `master_settings`.

5. **Legal document overrides were ignored on mobile.**
   `legal.privacy_policy_body` already had an owner-authored value in the
   database and the website rendered it, while the app kept showing its built-in
   text. Both legal screens now use `EditableLegalBody` against the shared
   `legal.*` keys.

6. **No text customization at all** — see `CUSTOMIZATION.md`.

---

## Known remaining divergences

These are deliberate or out of scope for this pass, not oversights:

- **Theme colours.** The website has a 15-token theme with preset palettes
  (`ThemeContext`) applied through CSS variables. Mobile styles are built with
  `StyleSheet.create` at module load, so making colours owner-editable requires
  converting every screen to dynamic styles. Not attempted; the `theme.*` rows
  in `global_settings` currently affect the website only.
- **Beauty / Pilates section switcher.** The website mirrors its whole route
  tree under `/beauty` and `/pilates` with a `SectionContext`. The app treats
  Pilates as a service category inside one unified navigation tree instead.
- **Public marketing pages** (landing, about, contact, get-app) have no app
  equivalent by design.
- `SearchMastersScreen` is exported from `screens/client/index.ts` but not
  registered anywhere; `DiscoverMastersScreen` covers the same need. Left in
  place rather than deleted.
