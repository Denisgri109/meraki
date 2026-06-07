import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    Modal,
    ScrollView,
    StyleSheet,
    TextInput,
    ActivityIndicator,
    Alert,
    Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { colors } from '../theme';
import { scheduleLocalNotification, NotificationData } from '../lib/notifications';

// ─── Test accounts whitelist ──────────────────────────────────────────────
const TEST_ACCOUNTS: ReadonlyArray<{ email: string; label: string; short: string; id: string }> = [
    { email: 'test@gmail.com',       label: 'Test (Owner)', short: 'Owner',  id: '744b77f1-e94f-4918-9c04-3b9f47288377' },
    { email: 'testclient@gmail.com', label: 'Test Client',  short: 'Client', id: '3f19e0f2-7e0b-4dc2-8a8e-3ac1939d9f1f' },
    { email: 'daxyburn@gmail.com',   label: 'Daxyburn',     short: 'Daxy',   id: 'aab4ab46-76d5-4a98-8487-2a6f1b8a2a1b' },
];
const TEST_EMAILS = TEST_ACCOUNTS.map((a) => a.email);
const emailToId = (email: string): string | undefined =>
    TEST_ACCOUNTS.find((a) => a.email.toLowerCase() === email.toLowerCase())?.id;

// ─── Per-account password cache ─────────────────────────────────────────
// Each test account stores its OWN password (they can differ). Switching
// between accounts never invalidates another account's cache.
const PASSWORD_STORAGE_PREFIX = 'meraki:test-panel:password:';
const LEGACY_PASSWORD_KEY = 'meraki:test-panel:password';
const passwordKey = (email: string) => `${PASSWORD_STORAGE_PREFIX}${email.toLowerCase()}`;

// ─── Seed settings (persistent overrides applied to every seed action) ───
interface SeedSettings {
    clientEmail: string;
    masterEmail: string;
    minutesOffset: string;
    durationMinutes: string;
    price: string;
    notes: string;
    message: string;
    loyaltyAmount: string;
    orderQuantity: string;
}

const DEFAULT_SETTINGS: SeedSettings = {
    clientEmail: 'testclient@gmail.com',
    masterEmail: 'daxyburn@gmail.com',
    minutesOffset: '',
    durationMinutes: '',
    price: '',
    notes: '',
    message: '',
    loyaltyAmount: '',
    orderQuantity: '',
};

const SETTINGS_STORAGE_KEY = 'meraki:test-panel:settings';

// ─── DB seed actions ────────────────────────────────────────────────────
interface SeedAction {
    id: string;
    label: string;
    description: string;
    icon: keyof typeof MaterialIcons.glyphMap;
    category: string;
    action: string;
    params?: Record<string, unknown>;
    destructive?: boolean;
}

interface NotificationScenario {
    id: 'appointment_reminder' | 'confirmation_request' | 'message' | 'promotion' | 'aftercare' | 'consultation_response';
    label: string;
    description: string;
    icon: keyof typeof MaterialIcons.glyphMap;
}

const NOTIFICATION_SCENARIOS: NotificationScenario[] = [
    {
        id: 'appointment_reminder',
        label: 'Appointment Reminder',
        description: 'Simulates a reminder notification. Deep links to booking details.',
        icon: 'notifications-active',
    },
    {
        id: 'confirmation_request',
        label: 'Confirmation Request',
        description: 'Simulates a confirmation request. Deep links to booking details.',
        icon: 'verified-user',
    },
    {
        id: 'message',
        label: 'New Chat Message',
        description: 'Simulates a chat message notification. Deep links to chat thread.',
        icon: 'chat',
    },
    {
        id: 'aftercare',
        label: 'Aftercare Campaign',
        description: 'Simulates an aftercare alert. Deep links to Master details page.',
        icon: 'favorite',
    },
    {
        id: 'consultation_response',
        label: 'Consultation Response',
        description: 'Simulates a style consultation update. Deep links to Bookings tab.',
        icon: 'rate-review',
    },
    {
        id: 'promotion',
        label: 'Promotional Offer',
        description: 'Simulates a marketing/promotion notification. Deep links to Shop.',
        icon: 'local-offer',
    },
];

const SEED_ACTIONS: SeedAction[] = [
    // ═══════════════════════════════════════════════════════════════════
    // PHASE 2 — Appointment Lifecycle (Client + Master)
    // ═══════════════════════════════════════════════════════════════════

    // ── Client-side appointment states ──
    { id: 'appt-pending', label: 'Booking — Pending', description: 'Create pending appointment in 1 hour', icon: 'event', category: 'Appointments', action: 'create_appointment', params: { status: 'pending', when: 'future', minutes_offset: 60 } },
    { id: 'appt-confirmed', label: 'Booking — Confirmed', description: 'Create confirmed appointment tomorrow', icon: 'event-available', category: 'Appointments', action: 'create_appointment', params: { status: 'confirmed', when: 'future', minutes_offset: 1440 } },
    { id: 'appt-completed', label: 'Booking — Completed', description: 'Past appointment, marked completed', icon: 'check-circle', category: 'Appointments', action: 'create_appointment', params: { status: 'completed', when: 'past', minutes_offset: -1440 } },
    { id: 'appt-cancelled', label: 'Booking — Cancelled', description: 'Cancelled appointment', icon: 'event-busy', category: 'Appointments', action: 'create_appointment', params: { status: 'cancelled', when: 'future', minutes_offset: 240 } },
    { id: 'appt-late-cancel', label: 'Late Cancellation (<24h)', description: 'Cancel within late window — triggers 50% penalty fee warning', icon: 'block', category: 'Appointments', action: 'create_appointment', params: { status: 'cancelled', when: 'future', minutes_offset: 120, late_cancel: true, penalty_percent: 50 } },
    { id: 'appt-price-breakdown', label: 'Booking with Price Breakdown', description: 'Appointment with deposit, total, balance-at-salon breakdown', icon: 'receipt-long', category: 'Appointments', action: 'create_appointment', params: { status: 'confirmed', when: 'future', minutes_offset: 1440, deposit_amount: 25, total_price: 100 } },
    { id: 'appt-needs-confirmation', label: 'Awaiting Client Confirmation', description: 'Requires client YES/NO confirmation within deadline', icon: 'pending-actions', category: 'Appointments', action: 'create_appointment', params: { status: 'pending', when: 'future', minutes_offset: 2880, client_confirmed: false, confirmation_deadline: true } },
    { id: 'appt-confirmed-protected', label: 'Confirmed & Protected', description: 'client_confirmed = true — shows emerald safety badge', icon: 'verified-user', category: 'Appointments', action: 'create_appointment', params: { status: 'confirmed', when: 'future', minutes_offset: 1440, client_confirmed: true } },

    // ── Master-side appointment actions ──
    { id: 'appt-reschedule-proposed', label: 'Reschedule Proposed', description: 'Master proposes new date — client sees Accept/Decline', icon: 'date-range', category: 'Appointments', action: 'create_appointment', params: { status: 'reschedule_proposed', when: 'future', minutes_offset: 1440, reschedule_to_offset: 2880 } },
    { id: 'appt-no-show', label: 'No-Show Scenario', description: 'Past no-show — Charge Now / Wait Grace / Client Late modal', icon: 'person-off', category: 'Appointments', action: 'create_appointment', params: { status: 'no_show', when: 'past', minutes_offset: -60 } },
    { id: 'appt-grace-period', label: 'Grace Period Active', description: 'No-show with grace period countdown (auto-charge after expiry)', icon: 'timer', category: 'Appointments', action: 'create_appointment', params: { status: 'no_show', when: 'past', minutes_offset: -15, grace_period: true } },
    { id: 'appt-late-arrival', label: 'Late Arrival Tracked', description: 'Completed with late minutes logged against threshold', icon: 'schedule', category: 'Appointments', action: 'create_appointment', params: { status: 'completed', when: 'past', minutes_offset: -120, late_minutes: 12 } },

    // ═══════════════════════════════════════════════════════════════════
    // PHASE 3 — Master Schedule & Calendar
    // ═══════════════════════════════════════════════════════════════════
    { id: 'schedule-weekly', label: 'Seed Weekly Schedule', description: 'Set Mon–Fri 09:00–17:00 availability', icon: 'date-range', category: 'Schedule & Calendar', action: 'seed_schedule', params: { type: 'weekly', days: [1, 2, 3, 4, 5], start: '09:00', end: '17:00' } },
    { id: 'schedule-block-slot', label: 'Block Time Slot', description: 'Block a 2-hour slot tomorrow with reason', icon: 'block', category: 'Schedule & Calendar', action: 'seed_schedule_block', params: { type: 'slot', minutes_offset: 1440, duration_minutes: 120, reason: '[QA] Blocked for testing' } },
    { id: 'schedule-vacation', label: 'Vacation Mode Block', description: 'Block 3 consecutive days starting tomorrow', icon: 'event-busy', category: 'Schedule & Calendar', action: 'seed_schedule_block', params: { type: 'vacation', days_from_now: 1, duration_days: 3, reason: '[QA] Vacation test' } },
    { id: 'schedule-visual-calendar', label: 'Seed Calendar with Mixed Slots', description: 'Populate calendar with available, booked, and blocked slots', icon: 'calendar-month', category: 'Schedule & Calendar', action: 'seed_calendar_view', params: { type: 'mixed_week' } },

    // ═══════════════════════════════════════════════════════════════════
    // PHASE 4 — Master Service Management
    // ═══════════════════════════════════════════════════════════════════
    { id: 'service-create', label: 'Create Master Service', description: 'Service: 60 min, €50, with description', icon: 'content-cut', category: 'Service Management', action: 'seed_master_service', params: { duration: 60, price: 50, name: '[QA] Test Haircut', description: 'Seeded by test panel' } },
    { id: 'service-custom-pricing', label: 'Service — Custom Pricing', description: 'Per-service price override (€75)', icon: 'content-cut', category: 'Service Management', action: 'seed_master_service', params: { duration: 90, price: 75, name: '[QA] Premium Styling', custom_pricing: true } },
    { id: 'service-custom-duration', label: 'Service — Custom Duration', description: 'Custom duration override (120 min)', icon: 'content-cut', category: 'Service Management', action: 'seed_master_service', params: { duration: 120, price: 60, name: '[QA] Extended Treatment', custom_duration: true } },
    { id: 'service-deposit-override', label: 'Service — Deposit Override', description: 'Per-service deposit override (30%)', icon: 'content-cut', category: 'Service Management', action: 'seed_master_service', params: { duration: 60, price: 80, name: '[QA] Deposit Test Service', deposit_override: 30 } },
    { id: 'service-disabled', label: 'Service — Disabled', description: 'Disabled/toggled-off service', icon: 'content-cut', category: 'Service Management', action: 'seed_master_service', params: { duration: 45, price: 35, name: '[QA] Inactive Service', is_active: false } },

    // ═══════════════════════════════════════════════════════════════════
    // PHASE 5 — Master Business Settings
    // ═══════════════════════════════════════════════════════════════════
    { id: 'settings-deposit', label: 'Deposit Settings', description: 'Enable deposit with 30% global percentage mode', icon: 'settings', category: 'Business Settings', action: 'seed_business_settings', params: { section: 'deposit', require_deposit: true, deposit_type: 'percentage', deposit_value: 30 } },
    { id: 'settings-deposit-fixed', label: 'Deposit — Fixed Amount', description: 'Enable deposit with €20 fixed amount mode', icon: 'settings', category: 'Business Settings', action: 'seed_business_settings', params: { section: 'deposit', require_deposit: true, deposit_type: 'fixed', deposit_value: 20 } },
    { id: 'settings-confirmation', label: 'Confirmation Settings', description: '48h timing, 24h timeout, auto-cancel enabled', icon: 'pending-actions', category: 'Business Settings', action: 'seed_business_settings', params: { section: 'confirmation', timing_hours: 48, timeout_hours: 24, auto_cancel: true } },
    { id: 'settings-noshow', label: 'No-Show Policy', description: '50% charge, 15 min threshold, 50% grace multiplier', icon: 'person-off', category: 'Business Settings', action: 'seed_business_settings', params: { section: 'noshow', charge_percent: 50, late_threshold: 15, grace_multiplier: 50 } },
    { id: 'settings-terms', label: 'Custom Terms & Conditions', description: 'Custom terms with require-acceptance enabled', icon: 'description', category: 'Business Settings', action: 'seed_business_settings', params: { section: 'terms', custom_terms: '[QA] Test Terms & Conditions — acceptance required', require_acceptance: true } },
    { id: 'settings-notifications', label: 'Notification Preferences', description: 'Push + booking reminders + messages toggles', icon: 'campaign', category: 'Business Settings', action: 'seed_business_settings', params: { section: 'notifications', push_enabled: true, bookings: true, messages: true, promotions: false } },
    { id: 'settings-aftercare', label: 'Aftercare Campaign', description: 'Active campaign: 14 days, auto-send, {name} placeholder', icon: 'favorite', category: 'Business Settings', action: 'seed_aftercare_campaign', params: { days_after: 14, auto_send: true, message: 'Hi {name}, hope you loved your visit! Book again soon.' } },

    // ═══════════════════════════════════════════════════════════════════
    // PHASE 6 — Consultations & Chat Polish
    // ═══════════════════════════════════════════════════════════════════

    // ── Consultations ──
    { id: 'photo-consult-pending', label: 'Photo Consult — Pending', description: 'Client requests photo consultation', icon: 'photo-camera', category: 'Consultations', action: 'create_photo_consultation', params: { status: 'pending' } },
    { id: 'photo-consult-responded', label: 'Photo Consult — Responded', description: 'With master reply, notes, recommendations, price range', icon: 'mark-chat-read', category: 'Consultations', action: 'create_photo_consultation', params: { status: 'responded', master_reply: 'Yes, totally doable! Estimated 2 hours.', professional_notes: 'Hair in good condition.', recommendations: 'Deep conditioning recommended.', estimated_price_min: 80, estimated_price_max: 120, estimated_duration: 120 } },
    { id: 'photo-consult-declined', label: 'Photo Consult — Declined', description: 'Master declined — not suitable for service', icon: 'cancel', category: 'Consultations', action: 'create_photo_consultation', params: { status: 'declined', master_reply: 'Not possible due to current hair condition.' } },
    { id: 'booking-consult-pending', label: 'Booking Consult — Pending', description: 'Pre-booking with had-before/time-since flow', icon: 'fact-check', category: 'Consultations', action: 'create_booking_consultation', params: { status: 'pending' } },
    { id: 'booking-consult-approved', label: 'Booking Consult — Approved', description: 'Approved by master with notes', icon: 'verified', category: 'Consultations', action: 'create_booking_consultation', params: { status: 'approved' } },
    { id: 'booking-consult-declined', label: 'Booking Consult — Declined', description: 'Master declined the booking consultation', icon: 'cancel', category: 'Consultations', action: 'create_booking_consultation', params: { status: 'declined', master_notes: 'Service not recommended.' } },
    { id: 'pre-service-questionnaire', label: 'Pre-Service Questionnaire', description: 'Client pre-service form with dynamic questions', icon: 'quiz', category: 'Consultations', action: 'create_consultation_response', params: { type: 'pre_service' } },

    // ── Chat ──
    { id: 'chat-create', label: 'Start Chat (client→master)', description: 'Conversation + first message', icon: 'forum', category: 'Chat', action: 'create_conversation_with_message' },
    { id: 'chat-reply', label: 'Add Master Reply', description: 'Append a message from master', icon: 'send', category: 'Chat', action: 'add_chat_message' },
    { id: 'chat-grouped-burst', label: 'Message Burst (grouped)', description: '5 quick messages from same sender — tests grouping', icon: 'chat-bubble', category: 'Chat', action: 'create_message_burst', params: { count: 5, sender: 'client' } },
    { id: 'chat-read-status', label: 'Messages with Read Status', description: 'Mix of read/unread — tests sent/delivered checks', icon: 'visibility', category: 'Chat', action: 'create_conversation_with_read_status', params: { read_count: 3, unread_count: 2 } },
    { id: 'chat-client-owner', label: 'Chat — Client ↔ Owner', description: 'Client-owner conversation type label test', icon: 'people', category: 'Chat', action: 'create_conversation_with_message', params: { conversation_type: 'client_owner' } },

    // ═══════════════════════════════════════════════════════════════════
    // PHASE 7 — Loyalty Program
    // ═══════════════════════════════════════════════════════════════════
    { id: 'loyalty-add-100', label: 'Add 100 Loyalty Points', description: 'Increment testclient points by 100', icon: 'card-giftcard', category: 'Loyalty', action: 'add_loyalty_points', params: { amount: 100 } },
    { id: 'loyalty-add-500', label: 'Add 500 Loyalty Points', description: 'Increment testclient points by 500', icon: 'redeem', category: 'Loyalty', action: 'add_loyalty_points', params: { amount: 500 } },
    { id: 'loyalty-card-create', label: 'Create Loyalty Card', description: '8 stamps, reward: free service', icon: 'star', category: 'Loyalty', action: 'seed_loyalty_card', params: { stamps_required: 8, reward_type: 'free_service', name: '[QA] VIP Loyalty Card' } },
    { id: 'loyalty-card-multi', label: 'Multiple Cards (different services)', description: '3 loyalty cards for different service types', icon: 'star', category: 'Loyalty', action: 'seed_loyalty_card', params: { count: 3, stamps_required: 6, reward_type: 'discount_percent', reward_value: 20 } },
    { id: 'loyalty-stamp-progress', label: 'Stamp Progress (partial)', description: '5 of 8 stamps — tests visual progress tracking', icon: 'military-tech', category: 'Loyalty', action: 'seed_loyalty_stamps', params: { stamps: 5, stamps_required: 8 } },
    { id: 'loyalty-qr-code', label: 'Seed QR Code for Master', description: 'Dynamic QR code for loyalty scanning', icon: 'qr-code', category: 'Loyalty', action: 'seed_loyalty_qr', params: { points_per_scan: 50 } },
    { id: 'loyalty-transaction-history', label: 'Transaction / Points History', description: '10 loyalty transactions (scans, redeems)', icon: 'receipt-long', category: 'Loyalty', action: 'seed_loyalty_history', params: { count: 10 } },
    { id: 'loyalty-redeem-reward', label: 'Redeem Reward', description: 'Complete card stamps and create redeemable reward', icon: 'military-tech', category: 'Loyalty', action: 'seed_loyalty_redemption', params: { stamps_required: 8, reward_type: 'free_service' } },

    // ═══════════════════════════════════════════════════════════════════
    // PHASE 8 — Inventory & Supplies
    // ═══════════════════════════════════════════════════════════════════
    { id: 'supply-master-create', label: 'Create Master Supply', description: 'Supply: qty 20, unit ml, threshold 5, cost €12.50', icon: 'inventory', category: 'Inventory & Supplies', action: 'seed_supply', params: { role: 'master', name: '[QA] Hair Dye', quantity: 20, unit: 'ml', threshold: 5, cost: 12.50 } },
    { id: 'supply-owner-create', label: 'Create Owner Supply', description: 'Platform-wide owner supply item', icon: 'inventory', category: 'Inventory & Supplies', action: 'seed_supply', params: { role: 'owner', name: '[QA] Salon Towels', quantity: 50, unit: 'pcs', threshold: 10, cost: 3.00 } },
    { id: 'supply-low-stock', label: 'Low Stock Alert Scenario', description: 'Qty below threshold — triggers low stock alert', icon: 'warning', category: 'Inventory & Supplies', action: 'seed_supply', params: { role: 'master', name: '[QA] Shampoo', quantity: 2, unit: 'bottles', threshold: 10, cost: 8.00 } },
    { id: 'supply-usage-history', label: 'Supply Usage History', description: '8 usage entries over time — tests tracking', icon: 'inventory', category: 'Inventory & Supplies', action: 'seed_supply_usage', params: { entries: 8, auto_deduct: true } },
    { id: 'supply-cost-calc', label: 'Per-Service Cost Calculation', description: 'Link supplies to service with cost-per-use data', icon: 'inventory', category: 'Inventory & Supplies', action: 'seed_supply_cost', params: { supplies_count: 3, service_name: '[QA] Test Haircut' } },

    // ═══════════════════════════════════════════════════════════════════
    // Shop (existing)
    // ═══════════════════════════════════════════════════════════════════
    { id: 'order-pending', label: 'Order — Pending', description: '1× first product, pending', icon: 'shopping-cart', category: 'Shop', action: 'create_order', params: { status: 'pending', quantity: 1 } },
    { id: 'order-paid', label: 'Order — Paid', description: '2× first product, paid', icon: 'paid', category: 'Shop', action: 'create_order', params: { status: 'paid', quantity: 2 } },

    // ═══════════════════════════════════════════════════════════════════
    // Location
    // ═══════════════════════════════════════════════════════════════════
    { id: 'reset-location-self',   label: 'Reset My Location',       description: 'Clear country, state, city & location_setup_completed for current account. Re-triggers location gate.', icon: 'location-off', category: 'Location', action: 'reset_location', params: {} },
    { id: 'reset-location-client', label: 'Reset Client Location',   description: 'Clear location for testclient@gmail.com.',                                                              icon: 'location-off', category: 'Location', action: 'reset_location', params: { target_id: '3f19e0f2-7e0b-4dc2-8a8e-3ac1939d9f1f' } },
    { id: 'reset-location-owner',  label: 'Reset Owner Location',    description: 'Clear location for test@gmail.com.',                                                                     icon: 'location-off', category: 'Location', action: 'reset_location', params: { target_id: '744b77f1-e94f-4918-9c04-3b9f47288377' } },
    { id: 'reset-location-master', label: 'Reset Master Location',   description: 'Clear location for daxyburn@gmail.com.',                                                                 icon: 'location-off', category: 'Location', action: 'reset_location', params: { target_id: 'aab4ab46-76d5-4a98-8487-2a6f1b8a2a1b' } },

    // ═══════════════════════════════════════════════════════════════════
    // Cleanup
    // ═══════════════════════════════════════════════════════════════════
    { id: 'clear-all', label: 'Clear ALL Test Data', description: 'Delete appointments, consults, chats, orders, schedule, loyalty, supplies for 3 test accounts.', icon: 'delete-forever', category: 'Cleanup', action: 'clear_test_data', destructive: true },
];

const CATEGORIES = Array.from(new Set(SEED_ACTIONS.map((s) => s.category)));

interface SeedResult {
    ok: boolean;
    label: string;
    message: string;
    at: number;
}

export function TestPanel() {
    const { user, profile } = useAuth();
    const [open, setOpen] = useState(false);
    const [switching, setSwitching] = useState(false);
    const [switchError, setSwitchError] = useState<string | null>(null);
    const [password, setPassword] = useState('');
    const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
    const [pendingAccount, setPendingAccount] = useState<string | null>(null);
    const [expandedCategory, setExpandedCategory] = useState<string | null>('Appointments');
    const [notificationsExpanded, setNotificationsExpanded] = useState(false);
    const [runningAction, setRunningAction] = useState<string | null>(null);
    const [results, setResults] = useState<SeedResult[]>([]);
    // Map of email -> cached password (loaded from AsyncStorage on mount).
    const [savedPasswords, setSavedPasswords] = useState<Record<string, string>>({});
    const [hasAnySaved, setHasAnySaved] = useState(false);
    // Seed settings (loaded from AsyncStorage on mount, persisted on change).
    const [settings, setSettings] = useState<SeedSettings>(DEFAULT_SETTINGS);
    const [settingsOpen, setSettingsOpen] = useState(false);

    const userEmail = user?.email?.toLowerCase();
    const isTestAccount = userEmail && TEST_EMAILS.includes(userEmail);

    useEffect(() => {
        (async () => {
            const next: Record<string, string> = {};
            for (const a of TEST_ACCOUNTS) {
                const pw = await AsyncStorage.getItem(passwordKey(a.email));
                if (pw) next[a.email.toLowerCase()] = pw;
            }
            // Legacy single-key fallback (used by older builds).
            const legacy = await AsyncStorage.getItem(LEGACY_PASSWORD_KEY);
            if (legacy && Object.keys(next).length === 0) {
                // Best-effort: treat as a global fallback until each account
                // gets its own confirmed password.
                for (const a of TEST_ACCOUNTS) next[a.email.toLowerCase()] = legacy;
            }
            setSavedPasswords(next);
            setHasAnySaved(Object.keys(next).length > 0);
        })();
    }, []);

    // Load persisted settings on mount
    useEffect(() => {
        AsyncStorage.getItem(SETTINGS_STORAGE_KEY).then((raw) => {
            if (!raw) return;
            try {
                const parsed = JSON.parse(raw) as Partial<SeedSettings>;
                setSettings({ ...DEFAULT_SETTINGS, ...parsed });
            } catch {
                /* ignore */
            }
        });
    }, []);

    if (!isTestAccount) return null;

    const updateSetting = <K extends keyof SeedSettings>(key: K, value: SeedSettings[K]) => {
        setSettings((prev) => {
            const next = { ...prev, [key]: value };
            AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next)).catch(() => { /* ignore */ });
            return next;
        });
    };

    const resetSettings = () => {
        setSettings({ ...DEFAULT_SETTINGS });
        AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(DEFAULT_SETTINGS)).catch(() => { /* ignore */ });
    };

    const hasCustomSettings =
        settings.clientEmail !== DEFAULT_SETTINGS.clientEmail ||
        settings.masterEmail !== DEFAULT_SETTINGS.masterEmail ||
        settings.minutesOffset.trim() !== '' ||
        settings.durationMinutes.trim() !== '' ||
        settings.price.trim() !== '' ||
        settings.notes.trim() !== '' ||
        settings.message.trim() !== '' ||
        settings.loyaltyAmount.trim() !== '' ||
        settings.orderQuantity.trim() !== '';

    const buildParams = (act: SeedAction): Record<string, unknown> => {
        const base = { ...(act.params || {}) } as Record<string, unknown>;
        const clientId = emailToId(settings.clientEmail);
        const masterId = emailToId(settings.masterEmail);
        if (clientId) base.client_id = clientId;
        if (masterId) base.master_id = masterId;
        if (settings.notes.trim()) base.notes = settings.notes.trim();
        if (settings.message.trim()) base.message = settings.message.trim();
        if (act.action === 'create_appointment') {
            if (settings.minutesOffset.trim()) base.minutes_offset = Number(settings.minutesOffset);
            if (settings.durationMinutes.trim()) base.duration_minutes = Number(settings.durationMinutes);
            if (settings.price.trim()) base.price = Number(settings.price);
        }
        if (act.action === 'add_loyalty_points' && settings.loyaltyAmount.trim()) {
            base.amount = Number(settings.loyaltyAmount);
        }
        if (act.action === 'create_order') {
            if (settings.orderQuantity.trim()) base.quantity = Number(settings.orderQuantity);
            if (settings.price.trim()) base.price = Number(settings.price);
        }
        return base;
    };

    const pushResult = (r: Omit<SeedResult, 'at'>) => {
        setResults((prev) => [{ ...r, at: Date.now() }, ...prev].slice(0, 6));
    };

    const fetchNotificationTargetId = async (type: string): Promise<{ id: string; isFallback: boolean }> => {
        try {
            if (type === 'appointment_reminder' || type === 'confirmation_request') {
                // 1. Check user's appointments
                let { data } = await supabase
                    .from('appointments')
                    .select('id')
                    .or(`client_id.eq.${user?.id},master_id.eq.${user?.id}`)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();
                if (data?.id) return { id: data.id, isFallback: false };

                // 2. Check any appointments
                const { data: anyApt } = await supabase
                    .from('appointments')
                    .select('id')
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();
                if (anyApt?.id) return { id: anyApt.id, isFallback: false };

                return { id: '00000000-0000-0000-0000-000000000000', isFallback: true };
            }
            if (type === 'message') {
                // 1. Check user's conversations
                let { data } = await supabase
                    .from('conversations')
                    .select('id')
                    .or(`client_id.eq.${user?.id},master_id.eq.${user?.id}`)
                    .order('last_message_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();
                if (data?.id) return { id: data.id, isFallback: false };

                // 2. Check any conversations
                const { data: anyConvo } = await supabase
                    .from('conversations')
                    .select('id')
                    .order('last_message_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();
                if (anyConvo?.id) return { id: anyConvo.id, isFallback: false };

                return { id: '00000000-0000-0000-0000-000000000000', isFallback: true };
            }
            if (type === 'aftercare') {
                // Check any master profile
                const { data } = await supabase
                    .from('profiles')
                    .select('id')
                    .eq('is_master', true)
                    .limit(1)
                    .maybeSingle();
                if (data?.id) return { id: data.id, isFallback: false };
                return { id: 'aab4ab46-76d5-4a98-8487-2a6f1b8a2a1b', isFallback: true }; // daxyburn
            }
            if (type === 'consultation_response') {
                // Check user's booking consultations
                let { data } = await supabase
                    .from('booking_consultations')
                    .select('id')
                    .eq('client_id', user?.id || '')
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();
                if (data?.id) return { id: data.id, isFallback: false };

                // Check any booking consultations
                const { data: anyConsult } = await supabase
                    .from('booking_consultations')
                    .select('id')
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();
                if (anyConsult?.id) return { id: anyConsult.id, isFallback: false };

                return { id: '00000000-0000-0000-0000-000000000000', isFallback: true };
            }
        } catch (err) {
            console.error('Error fetching target ID:', err);
        }
        return { id: '00000000-0000-0000-0000-000000000000', isFallback: true };
    };

    const simulateNotification = async (type: 'appointment_reminder' | 'confirmation_request' | 'message' | 'promotion' | 'aftercare' | 'consultation_response') => {
        let title = '';
        let body = '';
        let dataPayload: NotificationData = { type };

        if (type === 'promotion') {
            title = '🎉 Special Promotion!';
            body = 'Enjoy 20% off all hair styling products today. Tap to shop!';
        } else {
            const targetInfo = await fetchNotificationTargetId(type);
            const id = targetInfo.id;
            const isFallback = targetInfo.isFallback;

            if (type === 'appointment_reminder') {
                title = '📅 Appointment Reminder';
                body = `Upcoming booking with Master Daxy tomorrow at 2:00 PM. ${isFallback ? '[Fallback ID]' : ''}`;
                dataPayload.appointmentId = id;
            } else if (type === 'confirmation_request') {
                title = '⚠️ Confirmation Required';
                body = `Please confirm your upcoming appointment to secure your slot. ${isFallback ? '[Fallback ID]' : ''}`;
                dataPayload.appointmentId = id;
            } else if (type === 'message') {
                title = '💬 New Message from Daxy';
                body = `Hey! Just wanted to confirm if we're still on for tomorrow. ${isFallback ? '[Fallback ID]' : ''}`;
                dataPayload.conversationId = id;
            } else if (type === 'aftercare') {
                title = '💝 Style Aftercare Tips';
                body = `Check out customized aftercare tips for your recent treatment. ${isFallback ? '[Fallback ID]' : ''}`;
                dataPayload.masterId = id;
            } else if (type === 'consultation_response') {
                title = '✨ Consultation Approved';
                body = `Your style consultation has been reviewed and approved. Tap to view notes. ${isFallback ? '[Fallback ID]' : ''}`;
                dataPayload.consultationId = id;
            }

            if (isFallback) {
                pushResult({
                    ok: true,
                    label: `Simulated ${type.replace('_', ' ')}`,
                    message: 'Scheduled (1.5s delay). Note: Fallback ID used. Please run seeders first for working deep links.',
                });
            } else {
                pushResult({
                    ok: true,
                    label: `Simulated ${type.replace('_', ' ')}`,
                    message: `Scheduled successfully (1.5s delay) with ID: ${id.substring(0, 8)}...`,
                });
            }
        }

        if (type === 'promotion') {
            pushResult({
                ok: true,
                label: 'Simulated promotion',
                message: 'Scheduled successfully (1.5s delay). Will redirect to Shop tab.',
            });
        }

        try {
            await scheduleLocalNotification(title, body, dataPayload, 1.5);
        } catch (err: any) {
            pushResult({
                ok: false,
                label: `Failed to schedule ${type}`,
                message: err.message || String(err),
            });
        }
    };

    // ─── Account switching ─────────────────────────────────────────────
    const handleAccountSwitch = async (targetEmail: string, overridePw?: string) => {
        if (targetEmail === userEmail) return;

        const cached = savedPasswords[targetEmail.toLowerCase()];
        const pw = overridePw ?? cached ?? '';
        if (!pw) {
            setPassword('');
            setPendingAccount(targetEmail);
            setShowPasswordPrompt(true);
            return;
        }

        setSwitching(true);
        setSwitchError(null);

        try {
            const { error } = await supabase.auth.signInWithPassword({
                email: targetEmail,
                password: pw,
            });

            if (error) {
                const msg = error.message || '';
                const isInvalidCreds =
                    /invalid.*credentials/i.test(msg) ||
                    /invalid_grant/i.test(msg) ||
                    /invalid login/i.test(msg);

                if (isInvalidCreds) {
                    // Clear only THIS account's cache. Other accounts' saved
                    // passwords are unaffected.
                    await AsyncStorage.removeItem(passwordKey(targetEmail));
                    setSavedPasswords((prev) => {
                        const next = { ...prev };
                        delete next[targetEmail.toLowerCase()];
                        return next;
                    });
                    setPassword('');
                    setPendingAccount(targetEmail);
                    setSwitchError(`Saved password is wrong for ${targetEmail}. Enter the correct one.`);
                    setShowPasswordPrompt(true);
                    setSwitching(false);
                    return;
                }

                setSwitchError(msg);
                Alert.alert('Switch failed', msg);
                setSwitching(false);
                return;
            }

            // Sign-in succeeded — persist this password for the target account
            // (covers cases where it came from a prompt or a legacy fallback).
            if (cached !== pw) {
                await AsyncStorage.setItem(passwordKey(targetEmail), pw);
                setSavedPasswords((prev) => ({ ...prev, [targetEmail.toLowerCase()]: pw }));
                setHasAnySaved(true);
            }

            // AuthContext listener will pick up the new session and re-render
            setOpen(false);
            setSwitching(false);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Switch failed';
            setSwitchError(message);
            setSwitching(false);
        }
    };

    const handlePasswordSubmit = async () => {
        const pw = password.trim();
        if (!pw || !pendingAccount) {
            setShowPasswordPrompt(false);
            setPendingAccount(null);
            return;
        }
        await AsyncStorage.setItem(passwordKey(pendingAccount), pw);
        setSavedPasswords((prev) => ({ ...prev, [pendingAccount.toLowerCase()]: pw }));
        setHasAnySaved(true);
        setShowPasswordPrompt(false);
        const target = pendingAccount;
        setPendingAccount(null);
        handleAccountSwitch(target, pw);
    };

    const handleClearPassword = async () => {
        const keysToRemove = [
            ...TEST_ACCOUNTS.map((a) => passwordKey(a.email)),
            LEGACY_PASSWORD_KEY,
        ];
        await AsyncStorage.multiRemove(keysToRemove);
        setSavedPasswords({});
        setHasAnySaved(false);
        setPassword('');
    };

    // ─── DB seed actions ───────────────────────────────────────────────
    const runSeedAction = (act: SeedAction) => {
        const exec = async () => {
            setRunningAction(act.id);
            try {
                const { data, error } = await supabase.functions.invoke('test-panel-seed', {
                    body: { action: act.action, params: buildParams(act) },
                });

                if (error) {
                    pushResult({ ok: false, label: act.label, message: error.message });
                    return;
                }
                if (data && (data as { error?: string }).error) {
                    const errObj = data as { error: string; details?: string };
                    pushResult({
                        ok: false,
                        label: act.label,
                        message: `${errObj.error}${errObj.details ? ` — ${errObj.details}` : ''}`,
                    });
                    return;
                }

                const d = (data as { summary?: Record<string, number>; row?: Record<string, unknown> }) || {};
                let msg = 'Success';
                if (d.summary) {
                    const total = Object.values(d.summary).reduce((a, b) => a + b, 0);
                    msg = `Cleared ${total} rows: ${Object.entries(d.summary).map(([k, v]) => `${k}=${v}`).join(', ')}`;
                } else if (d.row) {
                    msg = `Created ${(d.row.id as string) || ''}${d.row.status ? ` (${d.row.status})` : ''}`;
                }
                pushResult({ ok: true, label: act.label, message: msg });
            } catch (err) {
                const message = err instanceof Error ? err.message : 'Unknown error';
                pushResult({ ok: false, label: act.label, message });
            } finally {
                setRunningAction(null);
            }
        };

        if (act.destructive) {
            Alert.alert(
                'Clear test data?',
                'This deletes all test data for the 3 test accounts (bookings, consults, chats, orders) and resets loyalty points.',
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Delete', style: 'destructive', onPress: exec },
                ]
            );
            return;
        }
        exec();
    };

    const toggleCategory = (cat: string) => {
        setExpandedCategory(expandedCategory === cat ? null : cat);
    };

    return (
        <>
            {/* ─── FAB ─────────────────────────────────────────── */}
            <TouchableOpacity
                onPress={() => setOpen(true)}
                style={styles.fab}
                activeOpacity={0.85}
                accessibilityLabel="Open test panel"
            >
                <MaterialIcons name="science" size={24} color="#FFFFFF" />
                <View style={styles.fabPulse} />
            </TouchableOpacity>

            {/* ─── Panel modal ─────────────────────────────────── */}
            <Modal
                visible={open}
                animationType="slide"
                transparent
                onRequestClose={() => setOpen(false)}
            >
                <View style={styles.modalOverlay}>
                    <TouchableOpacity
                        style={styles.modalBackdrop}
                        activeOpacity={1}
                        onPress={() => setOpen(false)}
                    />

                    <View style={styles.panel}>
                        {/* Header */}
                        <View style={styles.panelHeader}>
                            <View style={styles.headerLeft}>
                                <MaterialIcons name="science" size={20} color="#6366F1" />
                                <Text style={styles.headerTitle}>QA Test Panel</Text>
                            </View>
                            <TouchableOpacity
                                onPress={() => setOpen(false)}
                                style={styles.closeBtn}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                <MaterialIcons name="close" size={20} color={colors.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        {/* Current account badge */}
                        <View style={styles.accountBadge}>
                            <View style={styles.dot} />
                            <Text style={styles.accountLabel}>Signed in:</Text>
                            <Text style={styles.accountEmail} numberOfLines={1}>{userEmail}</Text>
                            <View style={styles.roleTag}>
                                <Text style={styles.roleTagText}>{profile?.role || 'client'}</Text>
                            </View>
                        </View>

                        <ScrollView style={styles.scrollContent} contentContainerStyle={{ paddingBottom: 24 }}>
                            {/* ── Account switcher ───────────────────── */}
                            <Text style={styles.sectionTitle}>SWITCH ACCOUNT</Text>
                            <View style={styles.accountList}>
                                {TEST_ACCOUNTS.map((account) => {
                                    const isCurrent = account.email === userEmail;
                                    return (
                                        <TouchableOpacity
                                            key={account.email}
                                            onPress={() => handleAccountSwitch(account.email)}
                                            disabled={isCurrent || switching}
                                            style={[
                                                styles.accountRow,
                                                isCurrent && styles.accountRowActive,
                                                switching && { opacity: 0.6 },
                                            ]}
                                        >
                                            <View style={styles.accountRowLeft}>
                                                <View style={[styles.avatar, isCurrent && styles.avatarActive]}>
                                                    <Text style={[styles.avatarText, isCurrent && styles.avatarTextActive]}>
                                                        {account.email.charAt(0).toUpperCase()}
                                                    </Text>
                                                </View>
                                                <View>
                                                    <Text style={[styles.accountLabel2, isCurrent && styles.accountLabel2Active]}>
                                                        {account.label}
                                                    </Text>
                                                    <Text style={styles.accountEmail2}>{account.email}</Text>
                                                </View>
                                            </View>
                                            {isCurrent ? (
                                                <Text style={styles.activeBadge}>ACTIVE</Text>
                                            ) : switching ? (
                                                <ActivityIndicator size="small" color={colors.textMuted} />
                                            ) : (
                                                <MaterialIcons name="chevron-right" size={18} color={colors.textMuted} />
                                            )}
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            {switchError ? (
                                <View style={styles.errorBox}>
                                    <MaterialIcons name="error-outline" size={12} color="#DC2626" />
                                    <Text style={styles.errorText}>{switchError}</Text>
                                </View>
                            ) : null}

                            {/* ── Seed settings ─────────────────────────── */}
                            <TouchableOpacity
                                onPress={() => setSettingsOpen((v) => !v)}
                                style={[styles.settingsHeader, { marginTop: 20 }]}
                            >
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <MaterialIcons name="settings" size={14} color={colors.textSecondary} />
                                    <Text style={styles.settingsHeaderTitle}>Seed Settings</Text>
                                    {hasCustomSettings ? (
                                        <View style={styles.customTag}><Text style={styles.customTagText}>CUSTOM</Text></View>
                                    ) : null}
                                </View>
                                <MaterialIcons
                                    name={settingsOpen ? 'expand-less' : 'expand-more'}
                                    size={20}
                                    color={colors.textMuted}
                                />
                            </TouchableOpacity>

                            {settingsOpen ? (
                                <View style={styles.settingsCard}>
                                    {/* Client picker */}
                                    <Text style={styles.fieldLabel}>Client (signs as)</Text>
                                    <View style={styles.chipRow}>
                                        {TEST_ACCOUNTS.map((a) => {
                                            const active = settings.clientEmail === a.email;
                                            return (
                                                <TouchableOpacity
                                                    key={`c-${a.email}`}
                                                    onPress={() => updateSetting('clientEmail', a.email)}
                                                    style={[styles.chip, active && styles.chipActive]}
                                                >
                                                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{a.short}</Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>

                                    {/* Master picker */}
                                    <Text style={styles.fieldLabel}>Master (other side)</Text>
                                    <View style={styles.chipRow}>
                                        {TEST_ACCOUNTS.map((a) => {
                                            const active = settings.masterEmail === a.email;
                                            return (
                                                <TouchableOpacity
                                                    key={`m-${a.email}`}
                                                    onPress={() => updateSetting('masterEmail', a.email)}
                                                    style={[styles.chip, active && styles.chipActive]}
                                                >
                                                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{a.short}</Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>

                                    {/* Booking timing */}
                                    <View style={styles.fieldRow}>
                                        <View style={styles.fieldCell}>
                                            <Text style={styles.fieldLabel}>Start offset (min)</Text>
                                            <TextInput
                                                value={settings.minutesOffset}
                                                onChangeText={(t) => updateSetting('minutesOffset', t)}
                                                keyboardType="numbers-and-punctuation"
                                                placeholder="default"
                                                placeholderTextColor={colors.textMuted}
                                                style={styles.fieldInput}
                                            />
                                        </View>
                                        <View style={styles.fieldCell}>
                                            <Text style={styles.fieldLabel}>Duration (min)</Text>
                                            <TextInput
                                                value={settings.durationMinutes}
                                                onChangeText={(t) => updateSetting('durationMinutes', t)}
                                                keyboardType="numeric"
                                                placeholder="service"
                                                placeholderTextColor={colors.textMuted}
                                                style={styles.fieldInput}
                                            />
                                        </View>
                                        <View style={styles.fieldCell}>
                                            <Text style={styles.fieldLabel}>Price (€)</Text>
                                            <TextInput
                                                value={settings.price}
                                                onChangeText={(t) => updateSetting('price', t)}
                                                keyboardType="decimal-pad"
                                                placeholder="default"
                                                placeholderTextColor={colors.textMuted}
                                                style={styles.fieldInput}
                                            />
                                        </View>
                                    </View>

                                    {/* Loyalty / Order */}
                                    <View style={styles.fieldRow}>
                                        <View style={styles.fieldCell}>
                                            <Text style={styles.fieldLabel}>Loyalty amount</Text>
                                            <TextInput
                                                value={settings.loyaltyAmount}
                                                onChangeText={(t) => updateSetting('loyaltyAmount', t)}
                                                keyboardType="numbers-and-punctuation"
                                                placeholder="default"
                                                placeholderTextColor={colors.textMuted}
                                                style={styles.fieldInput}
                                            />
                                        </View>
                                        <View style={styles.fieldCell}>
                                            <Text style={styles.fieldLabel}>Order quantity</Text>
                                            <TextInput
                                                value={settings.orderQuantity}
                                                onChangeText={(t) => updateSetting('orderQuantity', t)}
                                                keyboardType="numeric"
                                                placeholder="default"
                                                placeholderTextColor={colors.textMuted}
                                                style={styles.fieldInput}
                                            />
                                        </View>
                                    </View>

                                    {/* Notes / Message */}
                                    <Text style={styles.fieldLabel}>Notes (appointments / orders / consults)</Text>
                                    <TextInput
                                        value={settings.notes}
                                        onChangeText={(t) => updateSetting('notes', t)}
                                        placeholder="[QA] Seeded by test panel"
                                        placeholderTextColor={colors.textMuted}
                                        multiline
                                        style={[styles.fieldInput, styles.fieldMultiline]}
                                    />
                                    <Text style={styles.fieldLabel}>Message (photo consult / first chat)</Text>
                                    <TextInput
                                        value={settings.message}
                                        onChangeText={(t) => updateSetting('message', t)}
                                        placeholder="[QA] Could you do this style for me?"
                                        placeholderTextColor={colors.textMuted}
                                        multiline
                                        style={[styles.fieldInput, styles.fieldMultiline]}
                                    />

                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                                        <Text style={[styles.helperText, { marginBottom: 0 }]}>Saved automatically.</Text>
                                        <TouchableOpacity onPress={resetSettings} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                            <MaterialIcons name="restart-alt" size={12} color="#6366F1" />
                                            <Text style={styles.resetText}>Reset to defaults</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ) : null}

                            {/* ── DB seed actions ────────────────────── */}
                            <Text style={[styles.sectionTitle, { marginTop: 20 }]}>DATABASE SEEDERS</Text>
                            <Text style={styles.helperText}>
                                Inserts via service-role edge function. Configure who the data belongs to in Seed Settings above.
                            </Text>
                            <Text style={styles.helperHighlight}>
                                Client: {settings.clientEmail}  ·  Master: {settings.masterEmail}
                            </Text>
                            {CATEGORIES.map((category) => {
                                const items = SEED_ACTIONS.filter((s) => s.category === category);
                                const isExpanded = expandedCategory === category;
                                return (
                                    <View key={category} style={styles.categoryBox}>
                                        <TouchableOpacity
                                            onPress={() => toggleCategory(category)}
                                            style={styles.categoryHeader}
                                        >
                                            <Text style={styles.categoryTitle}>{category}</Text>
                                            <View style={styles.categoryRight}>
                                                <Text style={styles.categoryCount}>{items.length}</Text>
                                                <MaterialIcons
                                                    name={isExpanded ? 'expand-less' : 'expand-more'}
                                                    size={20}
                                                    color={colors.textMuted}
                                                />
                                            </View>
                                        </TouchableOpacity>
                                        {isExpanded && (
                                            <View>
                                                {items.map((act) => {
                                                    const isRunning = runningAction === act.id;
                                                    return (
                                                        <TouchableOpacity
                                                            key={act.id}
                                                            onPress={() => runSeedAction(act)}
                                                            disabled={isRunning}
                                                            style={[styles.scenarioRow, isRunning && { opacity: 0.6 }]}
                                                        >
                                                            <View style={[
                                                                styles.scenarioIconBox,
                                                                act.destructive && { backgroundColor: '#FEE2E2' },
                                                            ]}>
                                                                {isRunning ? (
                                                                    <ActivityIndicator size="small" color={act.destructive ? '#DC2626' : '#6366F1'} />
                                                                ) : (
                                                                    <MaterialIcons
                                                                        name={act.icon}
                                                                        size={16}
                                                                        color={act.destructive ? '#DC2626' : '#6366F1'}
                                                                    />
                                                                )}
                                                            </View>
                                                            <View style={{ flex: 1 }}>
                                                                <Text style={[
                                                                    styles.scenarioLabel,
                                                                    act.destructive && { color: '#B91C1C' },
                                                                ]}>{act.label}</Text>
                                                                <Text style={styles.scenarioDesc}>{act.description}</Text>
                                                            </View>
                                                        </TouchableOpacity>
                                                    );
                                                })}
                                            </View>
                                        )}
                                    </View>
                                );
                            })}

                            {/* ── Notification Simulators ─────────────── */}
                            <Text style={[styles.sectionTitle, { marginTop: 20 }]}>NOTIFICATION SIMULATORS</Text>
                            <Text style={styles.helperText}>
                                Schedules local notifications mimicking production push payloads to test context deep-linking.
                            </Text>

                            <View style={styles.categoryBox}>
                                <TouchableOpacity
                                    onPress={() => setNotificationsExpanded(!notificationsExpanded)}
                                    style={styles.categoryHeader}
                                >
                                    <Text style={styles.categoryTitle}>Notification Scenarios</Text>
                                    <View style={styles.categoryRight}>
                                        <Text style={styles.categoryCount}>{NOTIFICATION_SCENARIOS.length}</Text>
                                        <MaterialIcons
                                            name={notificationsExpanded ? 'expand-less' : 'expand-more'}
                                            size={20}
                                            color={colors.textMuted}
                                        />
                                    </View>
                                </TouchableOpacity>
                                {notificationsExpanded && (
                                    <View>
                                        {NOTIFICATION_SCENARIOS.map((act) => {
                                            return (
                                                <TouchableOpacity
                                                    key={act.id}
                                                    onPress={() => simulateNotification(act.id)}
                                                    style={styles.scenarioRow}
                                                >
                                                    <View style={styles.scenarioIconBox}>
                                                        <MaterialIcons
                                                            name={act.icon}
                                                            size={16}
                                                            color="#6366F1"
                                                        />
                                                    </View>
                                                    <View style={{ flex: 1 }}>
                                                        <Text style={styles.scenarioLabel}>{act.label}</Text>
                                                        <Text style={styles.scenarioDesc}>{act.description}</Text>
                                                    </View>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                )}
                            </View>

                            {/* ── Recent results ─────────────────────── */}
                            {results.length > 0 && (
                                <>
                                    <Text style={[styles.sectionTitle, { marginTop: 16 }]}>RECENT RESULTS</Text>
                                    {results.map((r, i) => (
                                        <View
                                            key={`${r.at}-${i}`}
                                            style={[
                                                styles.resultBox,
                                                r.ok ? styles.resultBoxOk : styles.resultBoxErr,
                                            ]}
                                        >
                                            <MaterialIcons
                                                name={r.ok ? 'check-circle' : 'error-outline'}
                                                size={12}
                                                color={r.ok ? '#15803D' : '#DC2626'}
                                            />
                                            <View style={{ flex: 1 }}>
                                                <Text style={[styles.resultLabel, r.ok ? { color: '#15803D' } : { color: '#B91C1C' }]}>
                                                    {r.label}
                                                </Text>
                                                <Text style={[styles.resultMsg, r.ok ? { color: '#166534' } : { color: '#991B1B' }]}>
                                                    {r.message}
                                                </Text>
                                            </View>
                                        </View>
                                    ))}
                                </>
                            )}
                        </ScrollView>

                        {/* Footer */}
                        <View style={styles.footer}>
                            <Text style={styles.footerText}>Test accounts only</Text>
                            {hasAnySaved ? (
                                <TouchableOpacity onPress={handleClearPassword}>
                                    <Text style={styles.clearText}>Clear saved passwords</Text>
                                </TouchableOpacity>
                            ) : null}
                        </View>
                    </View>
                </View>
            </Modal>

            {/* ─── Password prompt ─────────────────────────────── */}
            <Modal visible={showPasswordPrompt} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <TouchableOpacity
                        style={styles.modalBackdrop}
                        activeOpacity={1}
                        onPress={() => { setShowPasswordPrompt(false); setPendingAccount(null); }}
                    />
                    <View style={styles.passwordCard}>
                        <Text style={styles.passwordTitle}>Enter Test Password</Text>
                        <Text style={styles.passwordSubtitle}>
                            Password for {pendingAccount || 'this account'}. Saved locally for this account only — others keep their own.
                        </Text>
                        <TextInput
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry
                            placeholder="Password"
                            placeholderTextColor={colors.textMuted}
                            style={styles.passwordInput}
                            onSubmitEditing={handlePasswordSubmit}
                            autoFocus
                        />
                        <View style={styles.passwordActions}>
                            <TouchableOpacity
                                onPress={() => { setShowPasswordPrompt(false); setPendingAccount(null); }}
                                style={[styles.passwordBtn, styles.passwordBtnCancel]}
                            >
                                <Text style={styles.passwordBtnTextCancel}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={handlePasswordSubmit}
                                style={[styles.passwordBtn, styles.passwordBtnSave]}
                            >
                                <Text style={styles.passwordBtnTextSave}>Save & Switch</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </>
    );
}

const styles = StyleSheet.create({
    fab: {
        position: 'absolute',
        bottom: Platform.OS === 'ios' ? 100 : 90,
        right: 16,
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: '#6366F1',
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 8,
        shadowColor: '#000',
        shadowOpacity: 0.25,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        zIndex: 9999,
    },
    fabPulse: {
        position: 'absolute',
        top: 2,
        right: 2,
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#22C55E',
        borderWidth: 2,
        borderColor: '#FFFFFF',
    },
    modalOverlay: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    modalBackdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    panel: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '88%',
        overflow: 'hidden',
    },
    panelHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
        backgroundColor: '#EEF2FF',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    headerTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
    },
    closeBtn: {
        padding: 4,
    },
    accountBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 10,
        backgroundColor: '#F9FAFB',
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
        gap: 6,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#22C55E',
    },
    accountLabel: {
        fontSize: 11,
        color: colors.textSecondary,
        fontWeight: '500',
    },
    accountEmail: {
        fontSize: 11,
        color: colors.text,
        fontWeight: '700',
        flex: 1,
    },
    roleTag: {
        backgroundColor: '#E0E7FF',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10,
    },
    roleTagText: {
        fontSize: 9,
        color: '#4338CA',
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingTop: 16,
    },
    sectionTitle: {
        fontSize: 10,
        fontWeight: '800',
        color: colors.textMuted,
        letterSpacing: 1,
        marginBottom: 8,
    },
    helperText: {
        fontSize: 10,
        color: colors.textMuted,
        marginBottom: 4,
        lineHeight: 14,
    },
    helperHighlight: {
        fontSize: 10,
        color: '#4338CA',
        fontWeight: '600',
        marginBottom: 10,
        lineHeight: 14,
    },
    accountList: {
        gap: 6,
    },
    accountRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 10,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        backgroundColor: '#FFFFFF',
    },
    accountRowActive: {
        borderColor: '#A5B4FC',
        backgroundColor: '#EEF2FF',
    },
    accountRowLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    avatar: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#E5E7EB',
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarActive: {
        backgroundColor: '#C7D2FE',
    },
    avatarText: {
        fontSize: 11,
        fontWeight: '700',
        color: colors.textSecondary,
    },
    avatarTextActive: {
        color: '#4338CA',
    },
    accountLabel2: {
        fontSize: 13,
        fontWeight: '600',
        color: colors.text,
    },
    accountLabel2Active: {
        color: '#4338CA',
    },
    accountEmail2: {
        fontSize: 10,
        color: colors.textMuted,
    },
    activeBadge: {
        fontSize: 9,
        fontWeight: '800',
        color: '#6366F1',
        letterSpacing: 0.5,
    },
    errorBox: {
        marginTop: 8,
        backgroundColor: '#FEF2F2',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        flexDirection: 'row',
        gap: 6,
        alignItems: 'flex-start',
    },
    errorText: {
        flex: 1,
        fontSize: 11,
        color: '#DC2626',
    },
    categoryBox: {
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 12,
        overflow: 'hidden',
        marginBottom: 8,
    },
    categoryHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
        paddingVertical: 10,
        backgroundColor: '#F9FAFB',
    },
    categoryTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: colors.text,
    },
    categoryRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    categoryCount: {
        fontSize: 10,
        color: colors.textMuted,
        marginRight: 4,
    },
    scenarioRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingHorizontal: 12,
        paddingVertical: 10,
        gap: 10,
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
    },
    scenarioIconBox: {
        width: 28,
        height: 28,
        borderRadius: 8,
        backgroundColor: '#EEF2FF',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 2,
    },
    scenarioLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: colors.text,
    },
    scenarioDesc: {
        fontSize: 11,
        color: colors.textMuted,
        lineHeight: 14,
        marginTop: 1,
    },
    resultBox: {
        flexDirection: 'row',
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderRadius: 8,
        marginBottom: 6,
        alignItems: 'flex-start',
    },
    resultBoxOk: {
        backgroundColor: '#F0FDF4',
    },
    resultBoxErr: {
        backgroundColor: '#FEF2F2',
    },
    resultLabel: {
        fontSize: 11,
        fontWeight: '700',
    },
    resultMsg: {
        fontSize: 10,
        marginTop: 1,
    },
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
        backgroundColor: '#F9FAFB',
    },
    footerText: {
        fontSize: 10,
        color: colors.textMuted,
    },
    clearText: {
        fontSize: 10,
        color: '#EF4444',
    },
    passwordCard: {
        position: 'absolute',
        top: '30%',
        left: 24,
        right: 24,
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 20,
        elevation: 12,
        shadowColor: '#000',
        shadowOpacity: 0.25,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
    },
    passwordTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: colors.text,
        marginBottom: 6,
    },
    passwordSubtitle: {
        fontSize: 12,
        color: colors.textSecondary,
        marginBottom: 14,
    },
    passwordInput: {
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 14,
        color: colors.text,
        marginBottom: 12,
    },
    passwordActions: {
        flexDirection: 'row',
        gap: 8,
    },
    passwordBtn: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 12,
        alignItems: 'center',
    },
    passwordBtnCancel: {
        borderWidth: 1,
        borderColor: '#E5E7EB',
        backgroundColor: '#FFFFFF',
    },
    passwordBtnSave: {
        backgroundColor: '#6366F1',
    },
    passwordBtnTextCancel: {
        fontSize: 13,
        fontWeight: '600',
        color: colors.textSecondary,
    },
    passwordBtnTextSave: {
        fontSize: 13,
        fontWeight: '700',
        color: '#FFFFFF',
    },

    // ─── Seed settings styles ─────────────────────────────────────────
    settingsHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
        paddingVertical: 10,
        backgroundColor: colors.surface,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
    },
    settingsHeaderTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: colors.text,
    },
    customTag: {
        backgroundColor: '#EEF2FF',
        borderRadius: 8,
        paddingHorizontal: 6,
        paddingVertical: 2,
    },
    customTagText: {
        fontSize: 9,
        fontWeight: '800',
        color: '#6366F1',
        letterSpacing: 0.5,
    },
    settingsCard: {
        marginTop: 8,
        padding: 12,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 12,
        backgroundColor: colors.surface,
        gap: 8,
    },
    fieldLabel: {
        fontSize: 10,
        fontWeight: '700',
        color: colors.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 2,
    },
    chipRow: {
        flexDirection: 'row',
        gap: 6,
        marginBottom: 6,
    },
    chip: {
        flex: 1,
        paddingVertical: 7,
        paddingHorizontal: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.background,
        alignItems: 'center',
    },
    chipActive: {
        borderColor: '#6366F1',
        backgroundColor: '#EEF2FF',
    },
    chipText: {
        fontSize: 12,
        fontWeight: '600',
        color: colors.textSecondary,
    },
    chipTextActive: {
        color: '#6366F1',
        fontWeight: '700',
    },
    fieldRow: {
        flexDirection: 'row',
        gap: 8,
    },
    fieldCell: {
        flex: 1,
    },
    fieldInput: {
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 8,
        paddingHorizontal: 8,
        paddingVertical: 6,
        fontSize: 12,
        color: colors.text,
        backgroundColor: colors.background,
        marginBottom: 4,
    },
    fieldMultiline: {
        minHeight: 48,
        textAlignVertical: 'top',
    },
    resetText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#6366F1',
    },
});
