import { SeedSettings, NotificationScenario, SeedAction } from "./types";

export const TEST_ACCOUNTS: ReadonlyArray<{
  email: string;
  label: string;
  short: string;
  id: string;
}> = [
  {
    email: "test@gmail.com",
    label: "Test (Owner)",
    short: "Owner",
    id: "744b77f1-e94f-4918-9c04-3b9f47288377",
  },
  {
    email: "testclient@gmail.com",
    label: "Test Client",
    short: "Client",
    id: "3f19e0f2-7e0b-4dc2-8a8e-3ac1939d9f1f",
  },
  {
    email: "daxyburn@gmail.com",
    label: "Daxyburn",
    short: "Daxy",
    id: "aab4ab46-76d5-4a98-8487-2a6f1b8a2a1b",
  },
];
export const TEST_EMAILS = TEST_ACCOUNTS.map((a) => a.email);

export const PASSWORD_STORAGE_PREFIX = "meraki:test-panel:password:";
export const LEGACY_PASSWORD_KEY = "meraki:test-panel:password";
export const passwordKey = (email: string) =>
  `${PASSWORD_STORAGE_PREFIX}${email.toLowerCase()}`;
export const SETTINGS_STORAGE_KEY = "meraki:test-panel:settings";

export const DEFAULT_SETTINGS: SeedSettings = {
  clientEmail: "testclient@gmail.com",
  masterEmail: "daxyburn@gmail.com",
  minutesOffset: "",
  durationMinutes: "",
  price: "",
  notes: "",
  message: "",
  loyaltyAmount: "",
  orderQuantity: "",
};

export const NOTIFICATION_SCENARIOS: NotificationScenario[] = [
  {
    id: "appointment_reminder",
    label: "Appointment Reminder",
    description:
      "Simulates a reminder notification. Deep links to booking details.",
    icon: "notifications-active",
  },
  {
    id: "confirmation_request",
    label: "Confirmation Request",
    description:
      "Simulates a confirmation request. Deep links to booking details.",
    icon: "verified-user",
  },
  {
    id: "message",
    label: "New Chat Message",
    description:
      "Simulates a chat message notification. Deep links to chat thread.",
    icon: "chat",
  },
  {
    id: "aftercare",
    label: "Aftercare Campaign",
    description:
      "Simulates an aftercare alert. Deep links to Master details page.",
    icon: "favorite",
  },
  {
    id: "consultation_response",
    label: "Consultation Response",
    description:
      "Simulates a style consultation update. Deep links to Bookings tab.",
    icon: "rate-review",
  },
  {
    id: "promotion",
    label: "Promotional Offer",
    description:
      "Simulates a marketing/promotion notification. Deep links to Shop.",
    icon: "local-offer",
  },
];

export const SEED_ACTIONS: SeedAction[] = [
  // ═══════════════════════════════════════════════════════════════════
  // PHASE 2 — Appointment Lifecycle (Client + Master)
  // ═══════════════════════════════════════════════════════════════════

  // ── Client-side appointment states ──
  {
    id: "appt-pending",
    label: "Booking — Pending",
    description: "Create pending appointment in 1 hour",
    icon: "event",
    category: "Appointments",
    action: "create_appointment",
    params: { status: "pending", when: "future", minutes_offset: 60 },
  },
  {
    id: "appt-confirmed",
    label: "Booking — Confirmed",
    description: "Create confirmed appointment tomorrow",
    icon: "event-available",
    category: "Appointments",
    action: "create_appointment",
    params: { status: "confirmed", when: "future", minutes_offset: 1440 },
  },
  {
    id: "appt-completed",
    label: "Booking — Completed",
    description: "Past appointment, marked completed",
    icon: "check-circle",
    category: "Appointments",
    action: "create_appointment",
    params: { status: "completed", when: "past", minutes_offset: -1440 },
  },
  {
    id: "appt-cancelled",
    label: "Booking — Cancelled",
    description: "Cancelled appointment",
    icon: "event-busy",
    category: "Appointments",
    action: "create_appointment",
    params: { status: "cancelled", when: "future", minutes_offset: 240 },
  },
  {
    id: "appt-late-cancel",
    label: "Late Cancellation (<24h)",
    description: "Cancel within late window — triggers 50% penalty fee warning",
    icon: "block",
    category: "Appointments",
    action: "create_appointment",
    params: {
      status: "cancelled",
      when: "future",
      minutes_offset: 120,
      late_cancel: true,
      penalty_percent: 50,
    },
  },
  {
    id: "appt-price-breakdown",
    label: "Booking with Price Breakdown",
    description: "Appointment with deposit, total, balance-at-salon breakdown",
    icon: "receipt-long",
    category: "Appointments",
    action: "create_appointment",
    params: {
      status: "confirmed",
      when: "future",
      minutes_offset: 1440,
      deposit_amount: 25,
      total_price: 100,
    },
  },
  {
    id: "appt-needs-confirmation",
    label: "Awaiting Client Confirmation",
    description: "Requires client YES/NO confirmation within deadline",
    icon: "pending-actions",
    category: "Appointments",
    action: "create_appointment",
    params: {
      status: "pending",
      when: "future",
      minutes_offset: 2880,
      client_confirmed: false,
      confirmation_deadline: true,
    },
  },
  {
    id: "appt-confirmed-protected",
    label: "Confirmed & Protected",
    description: "client_confirmed = true — shows emerald safety badge",
    icon: "verified-user",
    category: "Appointments",
    action: "create_appointment",
    params: {
      status: "confirmed",
      when: "future",
      minutes_offset: 1440,
      client_confirmed: true,
    },
  },

  // ── Master-side appointment actions ──
  {
    id: "appt-reschedule-proposed",
    label: "Reschedule Proposed",
    description: "Master proposes new date — client sees Accept/Decline",
    icon: "date-range",
    category: "Appointments",
    action: "create_appointment",
    params: {
      status: "reschedule_proposed",
      when: "future",
      minutes_offset: 1440,
      reschedule_to_offset: 2880,
    },
  },
  {
    id: "appt-no-show",
    label: "No-Show Scenario",
    description: "Past no-show — Charge Now / Wait Grace / Client Late modal",
    icon: "person-off",
    category: "Appointments",
    action: "create_appointment",
    params: { status: "no_show", when: "past", minutes_offset: -60 },
  },
  {
    id: "appt-grace-period",
    label: "Grace Period Active",
    description:
      "No-show with grace period countdown (auto-charge after expiry)",
    icon: "timer",
    category: "Appointments",
    action: "create_appointment",
    params: {
      status: "no_show",
      when: "past",
      minutes_offset: -15,
      grace_period: true,
    },
  },
  {
    id: "appt-late-arrival",
    label: "Late Arrival Tracked",
    description: "Completed with late minutes logged against threshold",
    icon: "schedule",
    category: "Appointments",
    action: "create_appointment",
    params: {
      status: "completed",
      when: "past",
      minutes_offset: -120,
      late_minutes: 12,
    },
  },

  // ═══════════════════════════════════════════════════════════════════
  // PHASE 3 — Master Schedule & Calendar
  // ═══════════════════════════════════════════════════════════════════
  {
    id: "schedule-weekly",
    label: "Seed Weekly Schedule",
    description: "Set Mon–Fri 09:00–17:00 availability",
    icon: "date-range",
    category: "Schedule & Calendar",
    action: "seed_schedule",
    params: {
      type: "weekly",
      days: [1, 2, 3, 4, 5],
      start: "09:00",
      end: "17:00",
    },
  },
  {
    id: "schedule-block-slot",
    label: "Block Time Slot",
    description: "Block a 2-hour slot tomorrow with reason",
    icon: "block",
    category: "Schedule & Calendar",
    action: "seed_schedule_block",
    params: {
      type: "slot",
      minutes_offset: 1440,
      duration_minutes: 120,
      reason: "[QA] Blocked for testing",
    },
  },
  {
    id: "schedule-vacation",
    label: "Vacation Mode Block",
    description: "Block 3 consecutive days starting tomorrow",
    icon: "event-busy",
    category: "Schedule & Calendar",
    action: "seed_schedule_block",
    params: {
      type: "vacation",
      days_from_now: 1,
      duration_days: 3,
      reason: "[QA] Vacation test",
    },
  },
  {
    id: "schedule-visual-calendar",
    label: "Seed Calendar with Mixed Slots",
    description: "Populate calendar with available, booked, and blocked slots",
    icon: "calendar-month",
    category: "Schedule & Calendar",
    action: "seed_calendar_view",
    params: { type: "mixed_week" },
  },

  // ═══════════════════════════════════════════════════════════════════
  // PHASE 4 — Consultations
  // ═══════════════════════════════════════════════════════════════════
  {
    id: "photo-consult-pending",
    label: "Photo Consult — Pending",
    description: "Client requests photo consultation",
    icon: "photo-camera",
    category: "Consultations",
    action: "create_photo_consultation",
    params: { status: "pending" },
  },
  {
    id: "photo-consult-responded",
    label: "Photo Consult — Responded",
    description: "With master reply, notes, recommendations, price range",
    icon: "mark-chat-read",
    category: "Consultations",
    action: "create_photo_consultation",
    params: {
      status: "responded",
      master_reply: "Yes, totally doable! Estimated 2 hours.",
      professional_notes: "Hair in good condition.",
      recommendations: "Deep conditioning recommended.",
      estimated_price_min: 80,
      estimated_price_max: 120,
      estimated_duration: 120,
    },
  },
  {
    id: "photo-consult-declined",
    label: "Photo Consult — Declined",
    description: "Master declined — not suitable for service",
    icon: "cancel",
    category: "Consultations",
    action: "create_photo_consultation",
    params: {
      status: "declined",
      master_reply: "Not possible due to current hair condition.",
    },
  },
  {
    id: "booking-consult-pending",
    label: "Booking Consult — Pending",
    description: "Pre-booking with had-before/time-since flow",
    icon: "fact-check",
    category: "Consultations",
    action: "create_booking_consultation",
    params: { status: "pending" },
  },
  {
    id: "booking-consult-approved",
    label: "Booking Consult — Approved",
    description: "Approved by master with notes",
    icon: "verified",
    category: "Consultations",
    action: "create_booking_consultation",
    params: { status: "approved" },
  },
  {
    id: "booking-consult-declined",
    label: "Booking Consult — Declined",
    description: "Master declined the booking consultation",
    icon: "cancel",
    category: "Consultations",
    action: "create_booking_consultation",
    params: { status: "declined", master_notes: "Service not recommended." },
  },
  {
    id: "pre-service-questionnaire",
    label: "Pre-Service Questionnaire",
    description: "Client pre-service form with dynamic questions",
    icon: "quiz",
    category: "Consultations",
    action: "create_consultation_response",
    params: { type: "pre_service" },
  },

  // ── Chat ──
  {
    id: "chat-create",
    label: "Start Chat (client→master)",
    description: "Conversation + first message",
    icon: "forum",
    category: "Chat",
    action: "create_conversation_with_message",
  },
  {
    id: "chat-reply",
    label: "Add Master Reply",
    description: "Append a message from master",
    icon: "send",
    category: "Chat",
    action: "add_chat_message",
  },
  {
    id: "chat-grouped-burst",
    label: "Message Burst (grouped)",
    description: "5 quick messages from same sender — tests grouping",
    icon: "chat-bubble",
    category: "Chat",
    action: "create_message_burst",
    params: { count: 5, sender: "client" },
  },
  {
    id: "chat-read-status",
    label: "Messages with Read Status",
    description: "Mix of read/unread — tests sent/delivered checks",
    icon: "visibility",
    category: "Chat",
    action: "create_conversation_with_read_status",
    params: { read_count: 3, unread_count: 2 },
  },
  {
    id: "chat-client-owner",
    label: "Chat — Client ↔ Owner",
    description: "Client-owner conversation type label test",
    icon: "people",
    category: "Chat",
    action: "create_conversation_with_message",
    params: { conversation_type: "client_owner" },
  },

  // ═══════════════════════════════════════════════════════════════════
  // PHASE 7 — Loyalty Program
  // ═══════════════════════════════════════════════════════════════════
  {
    id: "loyalty-add-100",
    label: "Add 100 Loyalty Points",
    description: "Increment testclient points by 100",
    icon: "card-giftcard",
    category: "Loyalty",
    action: "add_loyalty_points",
    params: { amount: 100 },
  },
  {
    id: "loyalty-add-500",
    label: "Add 500 Loyalty Points",
    description: "Increment testclient points by 500",
    icon: "redeem",
    category: "Loyalty",
    action: "add_loyalty_points",
    params: { amount: 500 },
  },
  {
    id: "loyalty-card-create",
    label: "Create Loyalty Card",
    description: "8 stamps, reward: free service",
    icon: "star",
    category: "Loyalty",
    action: "seed_loyalty_card",
    params: {
      stamps_required: 8,
      reward_type: "free_service",
      name: "[QA] VIP Loyalty Card",
    },
  },
  {
    id: "loyalty-card-multi",
    label: "Multiple Cards (different services)",
    description: "3 loyalty cards for different service types",
    icon: "star",
    category: "Loyalty",
    action: "seed_loyalty_card",
    params: {
      count: 3,
      stamps_required: 6,
      reward_type: "discount_percent",
      reward_value: 20,
    },
  },
  {
    id: "loyalty-stamp-progress",
    label: "Stamp Progress (partial)",
    description: "5 of 8 stamps — tests visual progress tracking",
    icon: "military-tech",
    category: "Loyalty",
    action: "seed_loyalty_stamps",
    params: { stamps: 5, stamps_required: 8 },
  },
  {
    id: "loyalty-qr-code",
    label: "Seed QR Code for Master",
    description: "Dynamic QR code for loyalty scanning",
    icon: "qr-code",
    category: "Loyalty",
    action: "seed_loyalty_qr",
    params: { points_per_scan: 50 },
  },
  {
    id: "loyalty-transaction-history",
    label: "Transaction / Points History",
    description: "10 loyalty transactions (scans, redeems)",
    icon: "receipt-long",
    category: "Loyalty",
    action: "seed_loyalty_history",
    params: { count: 10 },
  },
  {
    id: "loyalty-redeem-reward",
    label: "Redeem Reward",
    description: "Complete card stamps and create redeemable reward",
    icon: "military-tech",
    category: "Loyalty",
    action: "seed_loyalty_redemption",
    params: { stamps_required: 8, reward_type: "free_service" },
  },

  // ═══════════════════════════════════════════════════════════════════
  // PHASE 8 — Inventory & Supplies
  // ═══════════════════════════════════════════════════════════════════
  {
    id: "supply-master-create",
    label: "Create Master Supply",
    description: "Supply: qty 20, unit ml, threshold 5, cost €12.50",
    icon: "inventory",
    category: "Inventory & Supplies",
    action: "seed_supply",
    params: {
      role: "master",
      name: "[QA] Hair Dye",
      quantity: 20,
      unit: "ml",
      threshold: 5,
      cost: 12.5,
    },
  },
  {
    id: "supply-owner-create",
    label: "Create Owner Supply",
    description: "Platform-wide owner supply item",
    icon: "inventory",
    category: "Inventory & Supplies",
    action: "seed_supply",
    params: {
      role: "owner",
      name: "[QA] Salon Towels",
      quantity: 50,
      unit: "pcs",
      threshold: 10,
      cost: 3.0,
    },
  },
  {
    id: "supply-low-stock",
    label: "Low Stock Alert Scenario",
    description: "Qty below threshold — triggers low stock alert",
    icon: "warning",
    category: "Inventory & Supplies",
    action: "seed_supply",
    params: {
      role: "master",
      name: "[QA] Shampoo",
      quantity: 2,
      unit: "bottles",
      threshold: 10,
      cost: 8.0,
    },
  },
  {
    id: "supply-usage-history",
    label: "Supply Usage History",
    description: "8 usage entries over time — tests tracking",
    icon: "inventory",
    category: "Inventory & Supplies",
    action: "seed_supply_usage",
    params: { entries: 8, auto_deduct: true },
  },
  {
    id: "supply-cost-calc",
    label: "Per-Service Cost Calculation",
    description: "Link supplies to service with cost-per-use data",
    icon: "inventory",
    category: "Inventory & Supplies",
    action: "seed_supply_cost",
    params: { supplies_count: 3, service_name: "[QA] Test Haircut" },
  },

  // ═══════════════════════════════════════════════════════════════════
  // Shop (existing)
  // ═══════════════════════════════════════════════════════════════════
  {
    id: "order-pending",
    label: "Order — Pending",
    description: "1× first product, pending",
    icon: "shopping-cart",
    category: "Shop",
    action: "create_order",
    params: { status: "pending", quantity: 1 },
  },
  {
    id: "order-paid",
    label: "Order — Paid",
    description: "2× first product, paid",
    icon: "paid",
    category: "Shop",
    action: "create_order",
    params: { status: "paid", quantity: 2 },
  },

  // ═══════════════════════════════════════════════════════════════════
  // Location
  // ═══════════════════════════════════════════════════════════════════
  {
    id: "reset-location-self",
    label: "Reset My Location",
    description:
      "Clear country, state, city & location_setup_completed for current account. Re-triggers location gate.",
    icon: "location-off",
    category: "Location",
    action: "reset_location",
    params: {},
  },
  {
    id: "reset-location-client",
    label: "Reset Client Location",
    description: "Clear location for testclient@gmail.com.",
    icon: "location-off",
    category: "Location",
    action: "reset_location",
    params: { target_id: "3f19e0f2-7e0b-4dc2-8a8e-3ac1939d9f1f" },
  },
  {
    id: "reset-location-owner",
    label: "Reset Owner Location",
    description: "Clear location for test@gmail.com.",
    icon: "location-off",
    category: "Location",
    action: "reset_location",
    params: { target_id: "744b77f1-e94f-4918-9c04-3b9f47288377" },
  },
  {
    id: "reset-location-master",
    label: "Reset Master Location",
    description: "Clear location for daxyburn@gmail.com.",
    icon: "location-off",
    category: "Location",
    action: "reset_location",
    params: { target_id: "aab4ab46-76d5-4a98-8487-2a6f1b8a2a1b" },
  },

  // ═══════════════════════════════════════════════════════════════════
  // Cleanup
  // ═══════════════════════════════════════════════════════════════════
  {
    id: "clear-all",
    label: "Clear ALL Test Data",
    description:
      "Delete appointments, consults, chats, orders, schedule, loyalty, supplies for 3 test accounts.",
    icon: "delete-forever",
    category: "Cleanup",
    action: "clear_test_data",
    destructive: true,
  },
];

export const CATEGORIES = Array.from(
  new Set(SEED_ACTIONS.map((s) => s.category)),
);

export const emailToId = (email: string): string | undefined =>
  TEST_ACCOUNTS.find((a) => a.email.toLowerCase() === email.toLowerCase())?.id;
