# Graph Report - meraki-MOBILE  (2026-08-30)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 1712 nodes · 4627 edges · 172 communities (86 shown, 86 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 25 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `2e196f9c`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- BookingConfirmScreen.tsx
- EditProfileScreen.tsx
- BookAndChatScreen.tsx
- merakiData.ts
- safeSupabaseFetch
- expo
- OwnerDashboardScreen.tsx
- MerakiText
- supabase.ts
- EditContext.tsx
- CustomizeAppScreen.tsx
- ScreenBackground
- Button
- ClientTabs.tsx
- safeGoBack
- theme/index.ts
- useAuth
- database.ts
- colors
- client/index.ts
- AddToBookingScreen.tsx
- ui/index.ts
- useModal
- notifications.ts
- command
- VoucherSignupScreen.tsx
- BookingScreen.tsx
- OwnerOrderDetailScreen.tsx
- VouchersScreen.tsx
- LessonQAChat.tsx
- PilatesTimetableScreen.tsx
- LoyaltyQRScreen.tsx
- AftercareCampaignsScreen.tsx
- AddOwnerSupplyScreen.tsx
- ModalContext.tsx
- MasterTabs.tsx
- OwnerTabs.tsx
- DrawerMenu.tsx
- LessonScreen.tsx
- dependencies
- ChatScreen.tsx
- CartContext.tsx
- AppNavigator.tsx
- ClientDirectoryScreen.tsx
- BusinessSettingsScreen.tsx
- src/App.tsx
- ProductDetailScreen.tsx
- ServiceDetailScreen.tsx
- devDependencies
- AcademyHomeScreen.tsx
- HomeScreen.tsx
- PhotoConsultationReviewScreen.tsx
- CreateServiceScreen.tsx
- OwnerFinanceScreen.tsx
- PlatformAnalyticsScreen.tsx
- MainActivity
- exclude
- owner/index.ts
- MainApplication
- plugins
- useResponsive.ts
- LoyaltyCardBuilderScreen.tsx
- clientManagementService.test.ts
- test-panel-seed/index.ts
- finalize-shop-order/index.ts
- scripts
- security-a11y.audit.test.ts
- package.json
- VerifyOtpScreen.tsx
- ShopScreen.tsx
- auto-cancel-no-response/index.ts
- auto-charge-grace-period/index.ts
- cancel-and-refund/index.ts
- client-confirm-appointment/index.ts
- handle-no-show-enhanced/index.ts
- invite-client/index.ts
- invite-master/index.ts
- send-confirmation-request/index.ts
- send-email/index.ts
- stripe-connect-onboarding/index.ts
- gradlew
- send-confirmation-reminder/index.ts
- metro.config.js
- asyncStorage.ts
- appointment-reminders/index.ts
- create-stripe-session/index.ts
- delete-account/index.ts
- low-stock-alert/index.ts
- process-no-show-charge/index.ts
- process-refund/index.ts
- send-marketing-notification/index.ts
- send-message-notification/index.ts
- @babel/plugin-transform-class-properties
- @babel/plugin-transform-flow-strip-types
- @babel/plugin-transform-private-methods
- @babel/plugin-transform-private-property-in-object
- babel-preset-expo
- base64-arraybuffer
- date-fns
- date-fns-tz
- expo
- expo-av
- expo-camera
- expo-clipboard
- expo-constants
- expo-crypto
- expo-dev-client
- @expo-google-fonts/manrope
- expo-haptics
- expo-image-picker
- expo-linear-gradient
- expo-location
- expo-navigation-bar
- expo-notifications
- expo-secure-store
- expo-status-bar
- @expo/vector-icons
- expo-web-browser
- jest
- react
- react-dom
- react-native
- @react-native-async-storage/async-storage
- react-native-gesture-handler
- react-native-get-random-values
- react-native-pager-view
- react-native-reanimated
- react-native-screens
- react-native-tab-view
- react-native-url-polyfill
- react-native-web
- react-native-webview
- react-native-worklets
- react-native-worklets-core
- @react-navigation/bottom-tabs
- @react-navigation/material-top-tabs
- @react-navigation/native
- @react-navigation/native-stack
- @stripe/stripe-react-native
- @supabase/supabase-js
- uuid
- react-refresh
- @testing-library/react-native
- ts-node
- @types/jest
- @types/node
- @types/react
- @types/react-native
- @types/uuid
- cancel-payment/index.ts
- capture-payment/index.ts
- claim-voucher/index.ts
- create-payment-intent/index.ts
- create-portal-session/index.ts
- delete-payment-method/index.ts
- handle-no-show/index.ts
- list-payment-methods/index.ts
- send-push-notification/index.ts
- set-default-payment-method/index.ts
- setup-intent/index.ts
- stripe-connect-dashboard/index.ts
- stripe-connect-status/index.ts

## God Nodes (most connected - your core abstractions)
1. `useAuth()` - 189 edges
2. `colors` - 142 edges
3. `useModal()` - 141 edges
4. `spacing` - 126 edges
5. `supabase` - 120 edges
6. `ScreenBackground()` - 99 edges
7. `MerakiText()` - 77 edges
8. `Card()` - 68 edges
9. `Button()` - 62 edges
10. `safeSupabaseFetch()` - 30 edges

## Surprising Connections (you probably didn't know these)
- `plugins` --extends--> `expo-asset`  [EXTRACTED]
  app.json → package.json
- `Probe()` --calls--> `useEditMode()`  [EXTRACTED]
  src/contexts/__tests__/EditContext.test.tsx → src/contexts/EditContext.tsx
- `Probe()` --calls--> `useCart()`  [EXTRACTED]
  src/contexts/__tests__/CartContext.chaos.test.tsx → src/contexts/CartContext.tsx
- `plugins` --extends--> `expo-font`  [EXTRACTED]
  app.json → package.json
- `plugins` --extends--> `@react-native-community/datetimepicker`  [EXTRACTED]
  app.json → package.json

## Import Cycles
- 3-file cycle: `src/navigation/ClientTabs.tsx -> src/screens/client/index.ts -> src/screens/client/MenuScreen.tsx -> src/navigation/ClientTabs.tsx`

## Communities (172 total, 86 thin omitted)

### Community 0 - "BookingConfirmScreen.tsx"
Cohesion: 0.05
Nodes (80): AcademyStackParamList, Course, CoursePurchaseScreen(), styles, Appointment, AppointmentListScreen(), cancelStyles, Consultation (+72 more)

### Community 1 - "EditProfileScreen.tsx"
Cohesion: 0.07
Nodes (55): CitySelectionModal(), CitySelectionModalProps, styles, { width }, mockUseCitySelection, styles, Timezone, TimezoneModal() (+47 more)

### Community 2 - "BookAndChatScreen.tsx"
Cohesion: 0.05
Nodes (44): PilatesWaiverSheet(), PilatesWaiverSheetProps, styles, FILL, hookState, submitWaiverMock, TabBarContext, TabBarContextType (+36 more)

### Community 3 - "merakiData.ts"
Cohesion: 0.06
Nodes (46): asClient(), asOwner(), fromMock, Probe(), useAuthMock, asLoggedIn(), channelMock, removeChannelMock (+38 more)

### Community 4 - "safeSupabaseFetch"
Cohesion: 0.07
Nodes (39): checkSessionHealth(), SafeFetchOptions, SafeResponse, safeSupabaseFetch(), Ndef, NFCScannerScreen(), NfcTech, styles (+31 more)

### Community 5 - "expo"
Cohesion: 0.05
Nodes (43): backgroundColor, foregroundImage, adaptiveIcon, googleServicesFile, intentFilters, package, permissions, softwareKeyboardLayoutMode (+35 more)

### Community 6 - "OwnerDashboardScreen.tsx"
Cohesion: 0.08
Nodes (35): detectLocationData(), useAutoLocation(), MasterEarningsScreen(), Period, styles, ActivityFeedItem, Appointment, getGreeting() (+27 more)

### Community 7 - "MerakiText"
Cohesion: 0.08
Nodes (30): MerakiText(), MerakiTextProps, styles, AcademyStudentsScreen(), Analytics, StudentEnrollment, styles, Course (+22 more)

### Community 8 - "supabase.ts"
Cohesion: 0.10
Nodes (24): DeepLinkHandler(), DeepLinkHandlerProps, AuthContext, AuthContextType, AuthProvider(), AuthProviderProps, supabase, AppointmentConfirmationScreen() (+16 more)

### Community 9 - "EditContext.tsx"
Cohesion: 0.10
Nodes (26): EditableImage(), EditableImageProps, styles, EditableLegalBody(), EditableLegalBodyProps, styles, EditableText(), EditableTextProps (+18 more)

### Community 10 - "CustomizeAppScreen.tsx"
Cohesion: 0.09
Nodes (32): ALLOWED_TYPES, ImageUrlUpload(), ImageUrlUploadProps, styles, ALL_TEXT_FIELDS, CONTENT_RESET_PREFIXES, DEFAULT_FAQS, DEFAULT_SUPPORT_SETTINGS (+24 more)

### Community 11 - "ScreenBackground"
Cohesion: 0.09
Nodes (24): ScreenBackground(), ScreenBackgroundProps, styles, AddSupplyScreen(), COMMON_UNITS, styles, BlockedSlotsScreen(), styles (+16 more)

### Community 12 - "Button"
Cohesion: 0.10
Nodes (24): Button(), ButtonProps, getIconStyle(), getSizeStyle(), getTextStyle(), getVariantStyle(), styles, AcademyStackParamList (+16 more)

### Community 13 - "ClientTabs.tsx"
Cohesion: 0.08
Nodes (20): AcademyStack, AcademyStackParamList, ClientTabsInner(), ClientTabsParamList, getLeafRouteName(), HomeStack, HomeStackParamList, MenuStack (+12 more)

### Community 14 - "safeGoBack"
Cohesion: 0.15
Nodes (18): MenuRouteProp, useMenuBackHandler(), useSafeBack(), UseSafeBackOptions, UseSafeBackReturn, canGoBack(), safeGoBack(), Notification (+10 more)

### Community 15 - "theme/index.ts"
Cohesion: 0.11
Nodes (18): NotificationPermissionPrompt(), NotificationPermissionPromptProps, styles, StripeConnectGate(), styles, { width }, SearchablePickerItem, SearchablePickerProps (+10 more)

### Community 16 - "useAuth"
Cohesion: 0.13
Nodes (17): useAuth(), Transaction, useTransactionListener(), UseTransactionListenerOptions, UseTransactionListenerReturn, QRProductData, ScanToPayScreen(), styles (+9 more)

### Community 17 - "database.ts"
Cohesion: 0.08
Nodes (23): ManageRewardsScreen(), Reward, REWARD_TYPES, styles, PortfolioScreen(), styles, PilatesWaiversScreen(), styles (+15 more)

### Community 18 - "colors"
Cohesion: 0.14
Nodes (16): StampCard(), StampCardProps, styles, StampSlots(), StampSlotsProps, styles, Card(), CardProps (+8 more)

### Community 19 - "client/index.ts"
Cohesion: 0.10
Nodes (18): BookingStackParamList, MasterDetailScreen(), MasterDetailScreenProps, styles, { width: SCREEN_WIDTH }, Appointment, OrdersScreen(), ProductOrder (+10 more)

### Community 20 - "AddToBookingScreen.tsx"
Cohesion: 0.15
Nodes (20): AddToBookingScreen(), MasterOption, Params, ServiceOption, SessionOption, SlotOption, styles, Tab (+12 more)

### Community 21 - "ui/index.ts"
Cohesion: 0.12
Nodes (17): AlertModal(), AlertModalProps, ConfirmModal, InputModal(), InputModalProps, styles, { width }, SafeBackButton() (+9 more)

### Community 22 - "useModal"
Cohesion: 0.15
Nodes (16): usePreBookingQuestionnaire(), UsePreBookingQuestionnaireProps, useModal(), AuthStackParamList, Stack, ForgotPasswordScreen(), LoginScreen(), TermsScreen() (+8 more)

### Community 23 - "notifications.ts"
Cohesion: 0.16
Nodes (11): NotificationContext, NotificationContextType, NotificationProvider(), NotificationProviderProps, useNotifications(), addNotificationReceivedListener(), addNotificationResponseListener(), NotificationData (+3 more)

### Community 24 - "command"
Cohesion: 0.11
Nodes (18): API_KEY, mcp, supabase-mcp-server, TestSprite, $schema, command, enabled, type (+10 more)

### Community 25 - "VoucherSignupScreen.tsx"
Cohesion: 0.11
Nodes (14): Input(), InputProps, styles, AuthStackParamList, ForgotPasswordScreenProps, styles, { width }, AuthStackParamList (+6 more)

### Community 26 - "BookingScreen.tsx"
Cohesion: 0.18
Nodes (15): BookingScreen(), BookingScreenProps, BookingStackParamList, CATEGORIES, CATEGORY_GRADIENTS, CATEGORY_ICON_COLORS, getCategoryGradient(), getCategoryIconColor() (+7 more)

### Community 27 - "OwnerOrderDetailScreen.tsx"
Cohesion: 0.19
Nodes (15): OwnerOrderDetailScreen(), STATUS_FLOW, styles, Order, OwnerOrdersScreen(), styles, EUROPEAN_COUNTRIES, EUROPEAN_COUNTRIES_SORTED (+7 more)

### Community 28 - "VouchersScreen.tsx"
Cohesion: 0.20
Nodes (16): daysLeft(), DISCOUNT_TYPES, discountLabel(), EMPTY_FORM, styles, VouchersScreen(), createVoucher(), CreateVoucherParams (+8 more)

### Community 29 - "LessonQAChat.tsx"
Cohesion: 0.13
Nodes (10): formatTime(), LessonQAChat(), Props, QAMessage, QAMessageItem(), QAMessageItemProps, sendPushNotification(), styles (+2 more)

### Community 30 - "PilatesTimetableScreen.tsx"
Cohesion: 0.13
Nodes (17): DAYS, endDate(), HostProfile, LEVELS, PilatesBooking, PilatesHost, PilatesSession, PilatesSessionRow (+9 more)

### Community 31 - "LoyaltyQRScreen.tsx"
Cohesion: 0.14
Nodes (13): Ndef, NfcPairingModal(), NfcPairingModalProps, NfcTech, PairingState, styles, StampSuccessModal(), StampSuccessModalProps (+5 more)

### Community 32 - "AftercareCampaignsScreen.tsx"
Cohesion: 0.23
Nodes (13): AftercareCampaignsScreen(), CAMPAIGN_TYPES, EMPTY_FORM, styles, AftercareCampaign, CampaignInput, CampaignType, CampaignUpdate (+5 more)

### Community 33 - "AddOwnerSupplyScreen.tsx"
Cohesion: 0.25
Nodes (6): AddOwnerSupplyScreen(), COMMON_UNITS, styles, OwnerSuppliesScreen(), styles, OwnerSupply

### Community 34 - "ModalContext.tsx"
Cohesion: 0.16
Nodes (12): MerakiModal(), MerakiModalProps, ModalContext, ModalContextType, ModalOptions, ModalProvider(), Availability, DAYS_OF_WEEK (+4 more)

### Community 35 - "MasterTabs.tsx"
Cohesion: 0.12
Nodes (11): DashboardStack, DashboardStackParamList, MasterTabsParamList, MenuStack, MenuStackParamList, MessagesStack, MessagesStackParamList, ShopStack (+3 more)

### Community 36 - "OwnerTabs.tsx"
Cohesion: 0.12
Nodes (11): AcademyStack, AcademyStackParamList, DashboardStack, MenuStack, MenuStackParamList, MessagesStack, MessagesStackParamList, OwnerDashboardStackParamList (+3 more)

### Community 37 - "DrawerMenu.tsx"
Cohesion: 0.14
Nodes (10): DrawerFooterProps, DrawerHeaderProps, DrawerMenu(), DrawerMenuProps, MENU_SECTIONS, MenuItemProps, MenuSection, styles (+2 more)

### Community 38 - "LessonScreen.tsx"
Cohesion: 0.19
Nodes (12): AcademyStackParamList, HomeworkScreen(), styles, AcademyStackParamList, getEmbedUrl(), getVimeoVideoId(), getYouTubeVideoId(), isStreamingUrl() (+4 more)

### Community 39 - "dependencies"
Cohesion: 0.15
Nodes (14): expo-blur, expo-device, expo-file-system, @expo/metro-runtime, dependencies, expo-blur, expo-device, expo-file-system (+6 more)

### Community 40 - "ChatScreen.tsx"
Cohesion: 0.16
Nodes (11): MessageContextMenu(), MessageContextMenuProps, styles, styles, SwipeableMessage(), SwipeableMessageProps, ChatStackParamList, Message (+3 more)

### Community 41 - "CartContext.tsx"
Cohesion: 0.18
Nodes (8): CartContext, CartContextType, CartItem, CartProvider(), Probe(), storage, mockProduct1, mockProduct2

### Community 42 - "AppNavigator.tsx"
Cohesion: 0.21
Nodes (11): AppNavigator(), linking, RootStackParamList, Stack, styles, AuthStack(), ClientTabs(), MasterTabs() (+3 more)

### Community 43 - "ClientDirectoryScreen.tsx"
Cohesion: 0.16
Nodes (11): CHIPS, ClientDirectoryScreen(), FilterChip, styles, clientRow, masterRow, mockNavigate, searchMock (+3 more)

### Community 44 - "BusinessSettingsScreen.tsx"
Cohesion: 0.15
Nodes (12): BusinessSettingsScreen(), CONFIRMATION_OPTIONS, DEFAULT_PILATES_SETTINGS, DEFAULT_SETTINGS, DEPOSIT_PERCENT_OPTIONS, LATE_ARRIVAL_OPTIONS, MasterBusinessSettings, PickerType (+4 more)

### Community 45 - "src/App.tsx"
Cohesion: 0.21
Nodes (8): App(), styles, GlobalBackground(), GlobalBackgroundProps, styles, { width, height }, StripeProvider(), StripeProviderProps

### Community 46 - "ProductDetailScreen.tsx"
Cohesion: 0.26
Nodes (9): useCart(), CartScreen(), styles, Product, ProductDetailScreen(), ShopStackParamList, styles, { width } (+1 more)

### Community 47 - "ServiceDetailScreen.tsx"
Cohesion: 0.11
Nodes (18): PreBookingQuestionnaireModal(), PreBookingQuestionnaireModalProps, styles, TIME_OPTIONS, BookingStackParamList, PilatesSettings, ServiceDetailScreenProps, styles (+10 more)

### Community 48 - "devDependencies"
Cohesion: 0.18
Nodes (11): @babel/core, eas-cli, jest-expo, devDependencies, @babel/core, eas-cli, jest-expo, react-test-renderer (+3 more)

### Community 49 - "AcademyHomeScreen.tsx"
Cohesion: 0.27
Nodes (10): AcademyHomeScreen(), Course, formatTotalDuration(), getGradientForIndex(), getRandomRating(), isStreamingUrl(), PASTEL_GRADIENTS, probeVideoDuration() (+2 more)

### Community 50 - "HomeScreen.tsx"
Cohesion: 0.18
Nodes (10): ActivityFeedItem, Appointment, ClientHomeScreen(), FeaturedMaster, Master, RecentOrder, SearchCourseResult, SearchServiceResult (+2 more)

### Community 51 - "PhotoConsultationReviewScreen.tsx"
Cohesion: 0.18
Nodes (9): PhotoConsultationRequestScreen(), SERVICE_TYPES, styles, ConsultationStatus, FILTER_TABS, PhotoConsultationReviewScreen(), STATUS_CONFIG, styles (+1 more)

### Community 52 - "CreateServiceScreen.tsx"
Cohesion: 0.27
Nodes (9): CATEGORIES, CreateServiceScreen(), styles, CATEGORIES, RouteParams, ServiceFormScreen(), styles, validatePrice() (+1 more)

### Community 53 - "OwnerFinanceScreen.tsx"
Cohesion: 0.24
Nodes (10): eur(), getPeriodStart(), MasterCommission, openStripeUrl(), OwnerFinanceScreen(), PaymentRow, PayoutRecord, PeriodFilter (+2 more)

### Community 54 - "PlatformAnalyticsScreen.tsx"
Cohesion: 0.24
Nodes (9): ANALYTICS_TABS, AnalyticsStats, buildRevenueTrend(), getPreviousRangeStart(), getTimeRangeStart(), PlatformAnalyticsScreen(), styles, TimeRange (+1 more)

### Community 55 - "MainActivity"
Cohesion: 0.29
Nodes (5): MainActivity, DefaultReactActivityDelegate, Bundle, ReactActivity, ReactActivityDelegate

### Community 56 - "exclude"
Cohesion: 0.20
Nodes (9): babel.config.js, expo/tsconfig.base, jest.config.js, metro.config.js, node_modules, supabase, compilerOptions, exclude (+1 more)

### Community 57 - "owner/index.ts"
Cohesion: 0.27
Nodes (7): ClientInviteScreen(), styles, OwnerMenuScreen(), QUICK_ACTIONS, styles, { width }, inviteWalkInClient()

### Community 58 - "MainApplication"
Cohesion: 0.36
Nodes (6): MainApplication, Application, Configuration, ReactApplication, ReactHost, ReactNativeHost

### Community 59 - "plugins"
Cohesion: 0.22
Nodes (9): plugins, expo-asset, expo-font, expo-asset, expo-font, @react-native-community/datetimepicker, react-native-nfc-manager, @react-native-community/datetimepicker (+1 more)

### Community 60 - "useResponsive.ts"
Cohesion: 0.31
Nodes (6): dims, Breakpoint, BREAKPOINTS, ResponsiveInfo, useCardWidth(), useResponsive()

### Community 61 - "LoyaltyCardBuilderScreen.tsx"
Cohesion: 0.31
Nodes (6): LoyaltyCard, LoyaltyCardBuilderScreen(), Reward, STAMP_OPTIONS, styles, getRewardText()

### Community 62 - "clientManagementService.test.ts"
Cohesion: 0.22
Nodes (7): makeChain(), chain, mockFromCalls, mockRpcCalls, mockRpcs, mockTables, Terminal

### Community 63 - "test-panel-seed/index.ts"
Cohesion: 0.22
Nodes (4): ActionParams, CORS_HEADERS, TEST_EMAILS, TEST_IDS

### Community 64 - "finalize-shop-order/index.ts"
Cohesion: 0.29
Nodes (6): baseCorsHeaders, getCorsHeaders(), jsonResponse(), RequestBody, RequestItem, shippingCosts

### Community 65 - "scripts"
Cohesion: 0.33
Nodes (6): scripts, android, ios, start, test, web

### Community 66 - "security-a11y.audit.test.ts"
Cohesion: 0.33
Nodes (3): APP_ROOT, SOURCE_FILES, SRC

### Community 67 - "package.json"
Cohesion: 0.40
Nodes (4): main, name, private, version

### Community 68 - "VerifyOtpScreen.tsx"
Cohesion: 0.40
Nodes (4): AuthStackParamList, styles, VerifyOtpScreenProps, { width }

### Community 69 - "ShopScreen.tsx"
Cohesion: 0.40
Nodes (4): CATEGORIES, Product, styles, { width }

### Community 72 - "cancel-and-refund/index.ts"
Cohesion: 0.40
Nodes (3): corsHeaders, RequestBody, StripeResult

### Community 74 - "handle-no-show-enhanced/index.ts"
Cohesion: 0.40
Nodes (4): PROJECT_URL, RequestBody, SERVICE_ROLE_KEY, STRIPE_SECRET_KEY

### Community 77 - "send-confirmation-request/index.ts"
Cohesion: 0.40
Nodes (4): PROJECT_URL, RequestBody, RESEND_API_KEY, SERVICE_ROLE_KEY

### Community 78 - "send-email/index.ts"
Cohesion: 0.50
Nodes (4): allowedOrigins, getCorsHeaders(), getTrustedOrigins(), RESEND_API_KEY

### Community 79 - "stripe-connect-onboarding/index.ts"
Cohesion: 0.40
Nodes (3): corsHeaders, countryNameToCode, STRIPE_SECRET_KEY

### Community 80 - "gradlew"
Cohesion: 0.83
Nodes (3): gradlew script, die(), warn()

## Knowledge Gaps
- **764 isolated node(s):** `AcademyStackParamList`, `Course`, `Appointment`, `Consultation`, `BookingConfirmScreenProps` (+759 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **86 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `dependencies` to `react-native-tab-view`, `react-native-url-polyfill`, `react-native-web`, `react-native-webview`, `react-native-worklets`, `react-native-worklets-core`, `@react-navigation/bottom-tabs`, `@react-navigation/material-top-tabs`, `@react-navigation/native`, `@react-navigation/native-stack`, `@stripe/stripe-react-native`, `@supabase/supabase-js`, `uuid`, `plugins`, `package.json`, `base64-arraybuffer`, `date-fns`, `date-fns-tz`, `expo`, `expo-av`, `expo-camera`, `expo-clipboard`, `expo-constants`, `expo-crypto`, `expo-dev-client`, `@expo-google-fonts/manrope`, `expo-haptics`, `expo-image-picker`, `expo-linear-gradient`, `expo-location`, `expo-navigation-bar`, `expo-notifications`, `expo-secure-store`, `expo-status-bar`, `@expo/vector-icons`, `expo-web-browser`, `react`, `react-dom`, `react-native`, `@react-native-async-storage/async-storage`, `react-native-gesture-handler`, `react-native-get-random-values`, `react-native-pager-view`, `react-native-reanimated`, `react-native-screens`?**
  _High betweenness centrality (0.149) - this node is a cross-community bridge._
- **Why does `@react-native-community/datetimepicker` connect `plugins` to `BookingConfirmScreen.tsx`, `AddToBookingScreen.tsx`?**
  _High betweenness centrality (0.104) - this node is a cross-community bridge._
- **Why does `useAuth()` connect `useAuth` to `BookingConfirmScreen.tsx`, `EditProfileScreen.tsx`, `BookAndChatScreen.tsx`, `merakiData.ts`, `safeSupabaseFetch`, `OwnerDashboardScreen.tsx`, `MerakiText`, `supabase.ts`, `EditContext.tsx`, `CustomizeAppScreen.tsx`, `ScreenBackground`, `Button`, `ClientTabs.tsx`, `safeGoBack`, `theme/index.ts`, `database.ts`, `colors`, `client/index.ts`, `AddToBookingScreen.tsx`, `ui/index.ts`, `useModal`, `notifications.ts`, `VoucherSignupScreen.tsx`, `BookingScreen.tsx`, `OwnerOrderDetailScreen.tsx`, `VouchersScreen.tsx`, `LessonQAChat.tsx`, `PilatesTimetableScreen.tsx`, `LoyaltyQRScreen.tsx`, `AftercareCampaignsScreen.tsx`, `AddOwnerSupplyScreen.tsx`, `ModalContext.tsx`, `DrawerMenu.tsx`, `LessonScreen.tsx`, `ChatScreen.tsx`, `AppNavigator.tsx`, `ClientDirectoryScreen.tsx`, `BusinessSettingsScreen.tsx`, `ProductDetailScreen.tsx`, `ServiceDetailScreen.tsx`, `AcademyHomeScreen.tsx`, `HomeScreen.tsx`, `CreateServiceScreen.tsx`, `OwnerFinanceScreen.tsx`, `PlatformAnalyticsScreen.tsx`, `owner/index.ts`, `LoyaltyCardBuilderScreen.tsx`, `ShopScreen.tsx`?**
  _High betweenness centrality (0.096) - this node is a cross-community bridge._
- **What connects `AcademyStackParamList`, `Course`, `Appointment` to the rest of the system?**
  _764 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `BookingConfirmScreen.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.05175438596491228 - nodes in this community are weakly interconnected._
- **Should `EditProfileScreen.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.07010402532790593 - nodes in this community are weakly interconnected._
- **Should `BookAndChatScreen.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.05129561078794289 - nodes in this community are weakly interconnected._