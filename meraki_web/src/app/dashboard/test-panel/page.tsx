'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import {
  FlaskConical, Calendar, MessageSquare, ShoppingBag, Gift, RefreshCw,
  ChevronRight, ChevronDown, Trash2, Loader2, CheckCircle2, AlertCircle,
  ClipboardList, Send, Settings as SettingsIcon, RotateCcw, UserCog,
  ShieldCheck, CalendarClock, CalendarOff, UserX, Clock, TimerReset,
  Scissors, Package, Star, QrCode, Award, Megaphone, Heart,
  CalendarRange, Ban, FileText, Users, Eye, MessageCircle,
  Navigation, ExternalLink, Search,
} from 'lucide-react';
import {
  TEST_ACCOUNTS, TEST_EMAILS, emailToId,
  readSavedPassword, saveSavedPassword, clearSavedPassword, clearAllSavedPasswords,
  readLegacyPassword, clearLegacyPassword,
  type SeedSettings, DEFAULT_SETTINGS, readSettings, writeSettings,
  buildParams, type SeedResult,
  readNavigateEnabled, writeNavigateEnabled, setHighlightTarget,
} from '@/lib/test-panel';

// ─── Seed action type ────────────────────────────────────────────────────
interface SeedAction {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  category: string;
  action: string;
  params?: Record<string, unknown>;
  destructive?: boolean;
  navigateTo?: string;
}

// ─── Category theme colours ──────────────────────────────────────────────
const CAT_THEME: Record<string, { ring: string; iconBg: string; iconText: string; headerBg: string; headerText: string; badge: string }> = {
  'Appointments':         { ring: 'ring-blue-200',   iconBg: 'bg-blue-100',   iconText: 'text-blue-600',   headerBg: 'bg-blue-50',   headerText: 'text-blue-800',   badge: 'bg-blue-100 text-blue-700' },
  'Schedule & Calendar':  { ring: 'ring-cyan-200',   iconBg: 'bg-cyan-100',   iconText: 'text-cyan-600',   headerBg: 'bg-cyan-50',   headerText: 'text-cyan-800',   badge: 'bg-cyan-100 text-cyan-700' },
  'Service Management':   { ring: 'ring-pink-200',   iconBg: 'bg-pink-100',   iconText: 'text-pink-600',   headerBg: 'bg-pink-50',   headerText: 'text-pink-800',   badge: 'bg-pink-100 text-pink-700' },
  'Business Settings':    { ring: 'ring-amber-200',  iconBg: 'bg-amber-100',  iconText: 'text-amber-600',  headerBg: 'bg-amber-50',  headerText: 'text-amber-800',  badge: 'bg-amber-100 text-amber-700' },
  'Consultations':        { ring: 'ring-violet-200', iconBg: 'bg-violet-100', iconText: 'text-violet-600', headerBg: 'bg-violet-50', headerText: 'text-violet-800', badge: 'bg-violet-100 text-violet-700' },
  'Chat':                 { ring: 'ring-green-200',  iconBg: 'bg-green-100',  iconText: 'text-green-600',  headerBg: 'bg-green-50',  headerText: 'text-green-800',  badge: 'bg-green-100 text-green-700' },
  'Loyalty':              { ring: 'ring-yellow-200', iconBg: 'bg-yellow-100', iconText: 'text-yellow-600', headerBg: 'bg-yellow-50', headerText: 'text-yellow-800', badge: 'bg-yellow-100 text-yellow-700' },
  'Inventory & Supplies': { ring: 'ring-orange-200', iconBg: 'bg-orange-100', iconText: 'text-orange-600', headerBg: 'bg-orange-50', headerText: 'text-orange-800', badge: 'bg-orange-100 text-orange-700' },
  'Shop':                 { ring: 'ring-emerald-200',iconBg: 'bg-emerald-100',iconText: 'text-emerald-600',headerBg: 'bg-emerald-50',headerText: 'text-emerald-800',badge: 'bg-emerald-100 text-emerald-700' },
  'Cleanup':              { ring: 'ring-red-200',    iconBg: 'bg-red-100',    iconText: 'text-red-600',    headerBg: 'bg-red-50',    headerText: 'text-red-800',    badge: 'bg-red-100 text-red-700' },
};
const defaultTheme = { ring: 'ring-gray-200', iconBg: 'bg-gray-100', iconText: 'text-gray-600', headerBg: 'bg-gray-50', headerText: 'text-gray-800', badge: 'bg-gray-100 text-gray-700' };

// ═══════════════════════════════════════════════════════════════════════════
// SEED ACTIONS — every checkmarked feature from PHASED_IMPLEMENTATION_PLAN
// ═══════════════════════════════════════════════════════════════════════════
const SEED_ACTIONS: SeedAction[] = [
  // ── PHASE 2 — Appointments ──────────────────────────────────────────
  { id: 'appt-pending',            label: 'Booking — Pending',              description: 'Create a pending appointment (testclient → daxyburn) in 1 hour',                        icon: Calendar,      category: 'Appointments', action: 'create_appointment', params: { status: 'pending', when: 'future', minutes_offset: 60 },                                                         navigateTo: '/dashboard/appointments' },
  { id: 'appt-confirmed',          label: 'Booking — Confirmed',            description: 'Create a confirmed appointment tomorrow',                                                  icon: Calendar,      category: 'Appointments', action: 'create_appointment', params: { status: 'confirmed', when: 'future', minutes_offset: 1440 },                                                      navigateTo: '/dashboard/appointments' },
  { id: 'appt-completed',          label: 'Booking — Completed (past)',     description: 'Create a past appointment marked completed',                                                icon: Calendar,      category: 'Appointments', action: 'create_appointment', params: { status: 'completed', when: 'past', minutes_offset: -1440 },                                                       navigateTo: '/dashboard/appointments' },
  { id: 'appt-cancelled',          label: 'Booking — Cancelled',            description: 'Create a cancelled appointment',                                                             icon: Calendar,      category: 'Appointments', action: 'create_appointment', params: { status: 'cancelled', when: 'future', minutes_offset: 240 },                                                       navigateTo: '/dashboard/appointments' },
  { id: 'appt-late-cancel',        label: 'Late Cancellation (<24h)',       description: 'Cancel within late window — triggers 50% penalty fee warning',                               icon: Ban,           category: 'Appointments', action: 'create_appointment', params: { status: 'cancelled', when: 'future', minutes_offset: 120, late_cancel: true, penalty_percent: 50 },           navigateTo: '/dashboard/appointments' },
  { id: 'appt-price-breakdown',    label: 'Booking with Price Breakdown',   description: 'Appointment with deposit, total, and balance-at-salon breakdown',                            icon: Calendar,      category: 'Appointments', action: 'create_appointment', params: { status: 'confirmed', when: 'future', minutes_offset: 1440, deposit_amount: 25, total_price: 100 },             navigateTo: '/dashboard/appointments' },
  { id: 'appt-needs-confirmation', label: 'Awaiting Client Confirmation',   description: 'Appointment requiring client YES/NO confirmation within deadline',                           icon: CalendarClock, category: 'Appointments', action: 'create_appointment', params: { status: 'pending', when: 'future', minutes_offset: 2880, client_confirmed: false, confirmation_deadline: true }, navigateTo: '/dashboard/appointments' },
  { id: 'appt-confirmed-protected',label: 'Confirmed & Protected',          description: 'client_confirmed = true — shows emerald safety badge',                                      icon: ShieldCheck,   category: 'Appointments', action: 'create_appointment', params: { status: 'confirmed', when: 'future', minutes_offset: 1440, client_confirmed: true },                            navigateTo: '/dashboard/appointments' },
  { id: 'appt-reschedule-proposed',label: 'Reschedule Proposed',             description: 'Master proposes new date/time — client sees Accept/Decline prompt',                          icon: CalendarRange, category: 'Appointments', action: 'create_appointment', params: { status: 'reschedule_proposed', when: 'future', minutes_offset: 1440, reschedule_to_offset: 2880 },       navigateTo: '/dashboard/appointments' },
  { id: 'appt-no-show',            label: 'No-Show Scenario',               description: 'Past appointment marked no-show — triggers Charge Now / Wait Grace / Client Late',           icon: UserX,         category: 'Appointments', action: 'create_appointment', params: { status: 'no_show', when: 'past', minutes_offset: -60 },                                                        navigateTo: '/dashboard/appointments' },
  { id: 'appt-grace-period',       label: 'Grace Period Active',            description: 'No-show with active grace period countdown (auto-charge after expiry)',                       icon: TimerReset,    category: 'Appointments', action: 'create_appointment', params: { status: 'no_show', when: 'past', minutes_offset: -15, grace_period: true },                                    navigateTo: '/dashboard/appointments' },
  { id: 'appt-late-arrival',       label: 'Late Arrival Tracked',           description: 'Completed appointment with late minutes logged against threshold',                            icon: Clock,         category: 'Appointments', action: 'create_appointment', params: { status: 'completed', when: 'past', minutes_offset: -120, late_minutes: 12 },                                    navigateTo: '/dashboard/appointments' },

  // ── PHASE 3 — Schedule & Calendar ───────────────────────────────────
  { id: 'schedule-weekly',         label: 'Seed Weekly Schedule',           description: 'Set Mon–Fri 09:00–17:00 availability for master',                                            icon: CalendarClock, category: 'Schedule & Calendar', action: 'seed_schedule',       params: { type: 'weekly', days: [1,2,3,4,5], start: '09:00', end: '17:00' },                               navigateTo: '/dashboard/availability' },
  { id: 'schedule-block-slot',     label: 'Block Time Slot',                description: 'Block a 2-hour slot tomorrow with a reason',                                                  icon: Ban,           category: 'Schedule & Calendar', action: 'seed_schedule_block', params: { type: 'slot', minutes_offset: 1440, duration_minutes: 120, reason: '[QA] Blocked for testing' },       navigateTo: '/dashboard/availability' },
  { id: 'schedule-vacation',       label: 'Vacation Mode Block',            description: 'Block 3 consecutive days starting tomorrow',                                                   icon: CalendarOff,   category: 'Schedule & Calendar', action: 'seed_schedule_block', params: { type: 'vacation', days_from_now: 1, duration_days: 3, reason: '[QA] Vacation test' },                   navigateTo: '/dashboard/availability' },
  { id: 'schedule-visual-calendar',label: 'Seed Calendar with Mixed Slots', description: 'Populate calendar with available, booked, and blocked slots for the week',                    icon: Calendar,      category: 'Schedule & Calendar', action: 'seed_calendar_view', params: { type: 'mixed_week' },                                                                                     navigateTo: '/dashboard/availability' },

  // ── PHASE 4 — Service Management ───────────────────────────────────
  { id: 'service-create',          label: 'Create Master Service',          description: 'Add service: 60 min, €50, with name & description',                                          icon: Scissors,      category: 'Service Management', action: 'seed_master_service', params: { duration: 60, price: 50, name: '[QA] Test Haircut', description: 'Seeded by test panel' },              navigateTo: '/dashboard/services' },
  { id: 'service-custom-pricing',  label: 'Service — Custom Pricing',       description: 'Per-service price override (€75)',                                                             icon: Scissors,      category: 'Service Management', action: 'seed_master_service', params: { duration: 90, price: 75, name: '[QA] Premium Styling', custom_pricing: true },                          navigateTo: '/dashboard/services' },
  { id: 'service-custom-duration', label: 'Service — Custom Duration',      description: 'Custom duration override (120 min)',                                                            icon: Scissors,      category: 'Service Management', action: 'seed_master_service', params: { duration: 120, price: 60, name: '[QA] Extended Treatment', custom_duration: true },                       navigateTo: '/dashboard/services' },
  { id: 'service-deposit-override',label: 'Service — Deposit Override',     description: 'Per-service deposit override (30%)',                                                            icon: Scissors,      category: 'Service Management', action: 'seed_master_service', params: { duration: 60, price: 80, name: '[QA] Deposit Test Service', deposit_override: 30 },                       navigateTo: '/dashboard/services' },
  { id: 'service-disabled',        label: 'Service — Disabled',             description: 'Create a disabled/toggled-off service',                                                        icon: Scissors,      category: 'Service Management', action: 'seed_master_service', params: { duration: 45, price: 35, name: '[QA] Inactive Service', is_active: false },                              navigateTo: '/dashboard/services' },

  // ── PHASE 5 — Business Settings ────────────────────────────────────
  { id: 'settings-deposit',        label: 'Deposit Settings (30%)',         description: 'Enable deposit with 30% global percentage mode',                                               icon: SettingsIcon,  category: 'Business Settings', action: 'seed_business_settings',  params: { section: 'deposit', require_deposit: true, deposit_type: 'percentage', deposit_value: 30 },            navigateTo: '/dashboard/settings' },
  { id: 'settings-deposit-fixed',  label: 'Deposit — Fixed €20',           description: 'Enable deposit with €20 fixed amount mode',                                                     icon: SettingsIcon,  category: 'Business Settings', action: 'seed_business_settings',  params: { section: 'deposit', require_deposit: true, deposit_type: 'fixed', deposit_value: 20 },                  navigateTo: '/dashboard/settings' },
  { id: 'settings-confirmation',   label: 'Confirmation Settings',          description: '48h timing, 24h response timeout, auto-cancel enabled',                                        icon: CalendarClock, category: 'Business Settings', action: 'seed_business_settings',  params: { section: 'confirmation', timing_hours: 48, timeout_hours: 24, auto_cancel: true },                     navigateTo: '/dashboard/settings' },
  { id: 'settings-noshow',         label: 'No-Show Policy',                 description: '50% charge, 15 min threshold, 50% grace multiplier',                                           icon: UserX,         category: 'Business Settings', action: 'seed_business_settings',  params: { section: 'noshow', charge_percent: 50, late_threshold: 15, grace_multiplier: 50 },                     navigateTo: '/dashboard/settings' },
  { id: 'settings-terms',          label: 'Custom Terms & Conditions',      description: 'Seed custom terms text with require-acceptance enabled',                                        icon: FileText,      category: 'Business Settings', action: 'seed_business_settings',  params: { section: 'terms', custom_terms: '[QA] Test T&C — acceptance required', require_acceptance: true },      navigateTo: '/dashboard/settings' },
  { id: 'settings-notifications',  label: 'Notification Preferences',       description: 'Enable push + booking reminders + messages toggles',                                           icon: Megaphone,     category: 'Business Settings', action: 'seed_business_settings',  params: { section: 'notifications', push_enabled: true, bookings: true, messages: true, promotions: false },     navigateTo: '/dashboard/settings' },
  { id: 'settings-aftercare',      label: 'Aftercare Campaign',             description: 'Active aftercare campaign: 14 days, auto-send, {name} placeholder',                            icon: Heart,         category: 'Business Settings', action: 'seed_aftercare_campaign', params: { days_after: 14, auto_send: true, message: 'Hi {name}, hope you loved your visit! Book again.' },       navigateTo: '/dashboard/settings' },

  // ── PHASE 6 — Consultations ────────────────────────────────────────
  { id: 'photo-consult-pending',   label: 'Photo Consultation — Pending',   description: 'Client requests a photo consultation with multi-photo upload',                                icon: ClipboardList, category: 'Consultations', action: 'create_photo_consultation',   params: { status: 'pending' },                                                                                     navigateTo: '/dashboard/consultations' },
  { id: 'photo-consult-responded', label: 'Photo Consultation — Responded', description: 'With master reply, notes, recommendations, price range',                                      icon: ClipboardList, category: 'Consultations', action: 'create_photo_consultation',   params: { status: 'responded', master_reply: 'Yes, totally doable! Estimated 2 hours.', professional_notes: 'Hair in good condition.', recommendations: 'Deep conditioning recommended.', estimated_price_min: 80, estimated_price_max: 120, estimated_duration: 120 }, navigateTo: '/dashboard/consultations' },
  { id: 'photo-consult-declined',  label: 'Photo Consultation — Declined',  description: 'Master declined — not suitable for requested service',                                         icon: ClipboardList, category: 'Consultations', action: 'create_photo_consultation',   params: { status: 'declined', master_reply: 'Not possible due to current hair condition.' },                       navigateTo: '/dashboard/consultations' },
  { id: 'booking-consult-pending', label: 'Booking Consultation — Pending', description: 'Pre-booking consultation with had-before/time-since/notes flow',                               icon: ClipboardList, category: 'Consultations', action: 'create_booking_consultation', params: { status: 'pending' },                                                                                     navigateTo: '/dashboard/consultations' },
  { id: 'booking-consult-approved',label: 'Booking Consultation — Approved',description: 'Approved by master with notes',                                                                icon: ClipboardList, category: 'Consultations', action: 'create_booking_consultation', params: { status: 'approved' },                                                                                    navigateTo: '/dashboard/consultations' },
  { id: 'booking-consult-declined',label: 'Booking Consultation — Declined',description: 'Master declined the booking consultation',                                                     icon: ClipboardList, category: 'Consultations', action: 'create_booking_consultation', params: { status: 'declined', master_notes: 'Service not recommended.' },                                          navigateTo: '/dashboard/consultations' },
  { id: 'pre-service-questionnaire',label:'Pre-Service Questionnaire',      description: 'Client submits pre-service form with dynamic questions and answers',                            icon: FileText,      category: 'Consultations', action: 'create_consultation_response', params: { type: 'pre_service' },                                                                                  navigateTo: '/dashboard/consultations' },

  // ── PHASE 6 — Chat ─────────────────────────────────────────────────
  { id: 'chat-create',             label: 'Start Chat (client → master)',   description: 'Create conversation + first message from client',                                              icon: MessageSquare, category: 'Chat', action: 'create_conversation_with_message',                                                                                                                              navigateTo: '/dashboard/chat' },
  { id: 'chat-reply',              label: 'Add Master Reply',               description: 'Append a message from master to existing chat',                                                 icon: Send,          category: 'Chat', action: 'add_chat_message',                                                                                                                                                navigateTo: '/dashboard/chat' },
  { id: 'chat-grouped-burst',      label: 'Message Burst (grouped)',        description: '5 quick messages from same sender — tests message grouping within 2-min window',                icon: MessageCircle, category: 'Chat', action: 'create_message_burst',               params: { count: 5, sender: 'client' },                                                                            navigateTo: '/dashboard/chat' },
  { id: 'chat-read-status',        label: 'Messages with Read Status',      description: 'Conversation with mix of read and unread messages — tests sent/delivered checks',               icon: Eye,           category: 'Chat', action: 'create_conversation_with_read_status',params: { read_count: 3, unread_count: 2 },                                                                        navigateTo: '/dashboard/chat' },
  { id: 'chat-client-owner',       label: 'Chat — Client ↔ Owner',         description: 'Conversation between client and owner — tests conversation type label',                          icon: Users,         category: 'Chat', action: 'create_conversation_with_message',   params: { conversation_type: 'client_owner' },                                                                     navigateTo: '/dashboard/chat' },

  // ── PHASE 7 — Loyalty ──────────────────────────────────────────────
  { id: 'loyalty-add-100',         label: 'Add 100 Loyalty Points',         description: 'Increment testclient loyalty_points by 100',                                                    icon: Gift,          category: 'Loyalty', action: 'add_loyalty_points',       params: { amount: 100 },                                                                                           navigateTo: '/dashboard/loyalty' },
  { id: 'loyalty-add-500',         label: 'Add 500 Loyalty Points',         description: 'Increment testclient loyalty_points by 500',                                                    icon: Gift,          category: 'Loyalty', action: 'add_loyalty_points',       params: { amount: 500 },                                                                                           navigateTo: '/dashboard/loyalty' },
  { id: 'loyalty-card-create',     label: 'Create Loyalty Card',            description: 'Master creates a loyalty card (8 stamps, reward: free service)',                                 icon: Star,          category: 'Loyalty', action: 'seed_loyalty_card',        params: { stamps_required: 8, reward_type: 'free_service', name: '[QA] VIP Loyalty Card' },                         navigateTo: '/dashboard/loyalty/cards' },
  { id: 'loyalty-card-multi',      label: 'Multiple Cards (3 services)',    description: 'Create 3 loyalty cards for different service types',                                             icon: Star,          category: 'Loyalty', action: 'seed_loyalty_card',        params: { count: 3, stamps_required: 6, reward_type: 'discount_percent', reward_value: 20 },                        navigateTo: '/dashboard/loyalty/cards' },
  { id: 'loyalty-stamp-progress',  label: 'Stamp Progress (5/8)',           description: 'Add 5 of 8 stamps to a card — shows visual progress tracking',                                  icon: Award,         category: 'Loyalty', action: 'seed_loyalty_stamps',      params: { stamps: 5, stamps_required: 8 },                                                                         navigateTo: '/dashboard/loyalty/cards' },
  { id: 'loyalty-qr-code',         label: 'Seed QR Code for Master',        description: 'Generate dynamic QR code for master loyalty scanning',                                           icon: QrCode,        category: 'Loyalty', action: 'seed_loyalty_qr',          params: { points_per_scan: 50 },                                                                                   navigateTo: '/dashboard/loyalty/qr' },
  { id: 'loyalty-transaction-history',label:'Transaction / Points History', description: 'Seed 10 loyalty transactions (scans, redeems) for history view',                                icon: ClipboardList, category: 'Loyalty', action: 'seed_loyalty_history',     params: { count: 10 },                                                                                             navigateTo: '/dashboard/loyalty' },
  { id: 'loyalty-redeem-reward',   label: 'Redeem Reward',                  description: 'Stamp a card to completion and create a redeemable reward',                                      icon: Award,         category: 'Loyalty', action: 'seed_loyalty_redemption',  params: { stamps_required: 8, reward_type: 'free_service' },                                                       navigateTo: '/dashboard/loyalty' },

  // ── PHASE 8 — Inventory & Supplies ─────────────────────────────────
  { id: 'supply-master-create',    label: 'Create Master Supply',           description: 'Supply item: qty 20, unit ml, threshold 5, cost €12.50',                                        icon: Package,       category: 'Inventory & Supplies', action: 'seed_supply',      params: { role: 'master', name: '[QA] Hair Dye', quantity: 20, unit: 'ml', threshold: 5, cost: 12.50 },            navigateTo: '/dashboard/supplies' },
  { id: 'supply-owner-create',     label: 'Create Owner Supply',            description: 'Platform-wide owner supply item',                                                                icon: Package,       category: 'Inventory & Supplies', action: 'seed_supply',      params: { role: 'owner', name: '[QA] Salon Towels', quantity: 50, unit: 'pcs', threshold: 10, cost: 3.00 },        navigateTo: '/dashboard/supplies' },
  { id: 'supply-low-stock',        label: 'Low Stock Alert Scenario',       description: 'Qty below threshold — triggers low stock alert',                                                 icon: AlertCircle,   category: 'Inventory & Supplies', action: 'seed_supply',      params: { role: 'master', name: '[QA] Shampoo', quantity: 2, unit: 'bottles', threshold: 10, cost: 8.00 },         navigateTo: '/dashboard/supplies' },
  { id: 'supply-usage-history',    label: 'Supply Usage History',            description: '8 usage entries over time — tests supply history and tracking',                                   icon: Package,       category: 'Inventory & Supplies', action: 'seed_supply_usage', params: { entries: 8, auto_deduct: true },                                                                          navigateTo: '/dashboard/supplies' },
  { id: 'supply-cost-calc',        label: 'Per-Service Cost Calculation',    description: 'Link supplies to a service with cost-per-use data',                                              icon: Package,       category: 'Inventory & Supplies', action: 'seed_supply_cost',  params: { supplies_count: 3, service_name: '[QA] Test Haircut' },                                                  navigateTo: '/dashboard/supplies' },

  // ── Shop ───────────────────────────────────────────────────────────
  { id: 'order-pending',           label: 'Create Shop Order — Pending',    description: '1× first active product as a pending order',                                                     icon: ShoppingBag,   category: 'Shop', action: 'create_order', params: { status: 'pending', quantity: 1 },  navigateTo: '/dashboard/shop' },
  { id: 'order-paid',              label: 'Create Shop Order — Paid',       description: '2× first active product as a paid order',                                                        icon: ShoppingBag,   category: 'Shop', action: 'create_order', params: { status: 'paid', quantity: 2 },     navigateTo: '/dashboard/shop' },

  // ── Cleanup ────────────────────────────────────────────────────────
  { id: 'clear-all', label: 'Clear ALL Test Data', description: 'Delete appointments, consultations, chats, orders, schedule blocks, loyalty, supplies for 3 test accounts.', icon: Trash2, category: 'Cleanup', action: 'clear_test_data', destructive: true },
  { id: 'nuclear-wipe', label: 'NUCLEAR WIPE — Clean Slate', description: 'Wipe EVERY row from ALL content tables (appointments, services, products, orders, chats, loyalty, supplies, schedule, etc). User accounts are preserved. This is irreversible.', icon: Trash2, category: 'Cleanup', action: 'nuclear_wipe', destructive: true },
];

const CATEGORIES = [...new Set(SEED_ACTIONS.map((s) => s.category))];

// ═══════════════════════════════════════════════════════════════════════════
// PAGE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
export default function TestPanelPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [switching, setSwitching] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [pendingAccount, setPendingAccount] = useState<string | null>(null);
  const [runningAction, setRunningAction] = useState<string | null>(null);
  const [results, setResults] = useState<SeedResult[]>([]);
  const [settings, setSettings] = useState<SeedSettings>(() => {
    if (typeof window === 'undefined') return { ...DEFAULT_SETTINGS };
    return readSettings();
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [navigateEnabled, setNavigateEnabled] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Load navigate toggle from localStorage on mount
  useEffect(() => {
    setNavigateEnabled(readNavigateEnabled());
  }, []);

  const userEmail = user?.email?.toLowerCase();
  const isTestAccount = userEmail && TEST_EMAILS.includes(userEmail);

  const updateSetting = <K extends keyof SeedSettings>(key: K, value: SeedSettings[K]) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      writeSettings(next);
      return next;
    });
  };

  const resetSettings = () => {
    setSettings({ ...DEFAULT_SETTINGS });
    writeSettings({ ...DEFAULT_SETTINGS });
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

  const pushResult = useCallback((r: Omit<SeedResult, 'at'>) => {
    setResults((prev) => [{ ...r, at: Date.now() }, ...prev].slice(0, 20));
  }, []);

  // ─── Account switch ───────────────────────────────────────────────
  const performSignIn = async (targetEmail: string, pw: string): Promise<string | null> => {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email: targetEmail, password: pw });
    return error?.message ?? null;
  };

  const handleAccountSwitch = async (targetEmail: string, overridePw?: string) => {
    if (targetEmail === userEmail) return;
    const perAccount = readSavedPassword(targetEmail);
    const legacy = readLegacyPassword();
    const pw = overridePw ?? perAccount ?? legacy ?? '';

    if (!pw) {
      setPassword('');
      setPendingAccount(targetEmail);
      setShowPasswordPrompt(true);
      return;
    }

    setSwitching(true);
    setSwitchError(null);
    try {
      const errorMessage = await performSignIn(targetEmail, pw);
      if (errorMessage) {
        const isInvalidCreds = /invalid.*credentials|invalid_grant|invalid login/i.test(errorMessage);
        if (isInvalidCreds) {
          clearSavedPassword(targetEmail);
          clearLegacyPassword();
          setPassword('');
          setPendingAccount(targetEmail);
          setSwitchError(`Saved password wrong for ${targetEmail}. Enter the correct one.`);
          setShowPasswordPrompt(true);
          setSwitching(false);
          return;
        }
        setSwitchError(errorMessage);
        setSwitching(false);
        return;
      }
      if (perAccount !== pw) saveSavedPassword(targetEmail, pw);
      setSwitching(false);
      window.location.assign('/dashboard/test-panel');
    } catch (err) {
      setSwitchError(err instanceof Error ? err.message : 'Switch failed');
      setSwitching(false);
    }
  };

  const handlePasswordSubmit = () => {
    const pw = password.trim();
    if (!pw || !pendingAccount) {
      setShowPasswordPrompt(false);
      setPendingAccount(null);
      return;
    }
    saveSavedPassword(pendingAccount, pw);
    setShowPasswordPrompt(false);
    const target = pendingAccount;
    setPendingAccount(null);
    handleAccountSwitch(target, pw);
  };

  // ─── Seed action runner ───────────────────────────────────────────
  const runSeedAction = async (act: SeedAction) => {
    if (act.action === 'nuclear_wipe') {
      const ok1 = window.confirm(
        '☢️ NUCLEAR WIPE\n\nThis will permanently delete ALL rows from EVERY content table in the database:\n• All appointments, services, products\n• All orders, payments, refunds\n• All chats, consultations\n• All loyalty cards, stamps, rewards\n• All supplies, inventory\n• All schedules, availability, Pilates data\n\nUser accounts will NOT be deleted.\n\nAre you absolutely sure?'
      );
      if (!ok1) return;
      const typed = window.prompt('Type NUKE to confirm the nuclear wipe:');
      if (typed?.trim().toUpperCase() !== 'NUKE') {
        pushResult({ ok: false, action: act.action, label: act.label, message: 'Nuclear wipe cancelled — confirmation phrase did not match.' });
        return;
      }
    } else if (act.destructive) {
      const ok = window.confirm('This will delete test data for all 3 test accounts. Continue?');
      if (!ok) return;
    }

    setRunningAction(act.id);
    try {
      const supabase = createClient();
      const params = buildParams(act.action, act.params, settings);
      const { data, error } = await supabase.functions.invoke('test-panel-seed', {
        body: { action: act.action, params },
      });

      if (error) {
        pushResult({ ok: false, action: act.action, label: act.label, message: error.message });
        return;
      }
      if (data && (data as { error?: string }).error) {
        const errObj = data as { error: string; details?: string };
        pushResult({ ok: false, action: act.action, label: act.label, message: `${errObj.error}${errObj.details ? ` — ${errObj.details}` : ''}` });
        return;
      }

      const summary = (data as { summary?: Record<string, number>; total_deleted?: number; row?: Record<string, unknown> }) || {};
      let msg = 'Success';
      const rowId = summary.row?.id as string | undefined;
      if (summary.summary) {
        const nonZero = Object.entries(summary.summary).filter(([, v]) => v > 0);
        const failed = Object.entries(summary.summary).filter(([, v]) => v === -1);
        const total = summary.total_deleted ?? nonZero.reduce((a, [, v]) => a + v, 0);
        if (act.action === 'nuclear_wipe') {
          msg = `☢️ Wiped ${total} rows across ${nonZero.length} tables.`;
          if (failed.length > 0) msg += ` ⚠ ${failed.length} tables had errors: ${failed.map(([k]) => k).join(', ')}`;
        } else {
          msg = `Cleared ${total} rows: ${nonZero.map(([k, v]) => `${k}=${v}`).join(', ')}`;
        }
      } else if (summary.row && typeof summary.row === 'object') {
        msg = `Created row ${rowId ?? '(no id)'}${summary.row.status ? ` (${summary.row.status})` : ''}`;
      }

      pushResult({ ok: true, action: act.action, label: act.label, message: msg, data });

      // Navigate & Locate
      if (navigateEnabled && act.navigateTo) {
        setHighlightTarget({
          rowId,
          action: act.action,
          label: act.label,
          navigateTo: act.navigateTo,
          timestamp: Date.now(),
        });
        router.push(act.navigateTo);
      }
    } catch (err) {
      pushResult({ ok: false, action: act.action, label: act.label, message: err instanceof Error ? err.message : 'Unknown error' });
    } finally {
      setRunningAction(null);
    }
  };

  // ─── Search filter ────────────────────────────────────────────────
  const q = searchQuery.toLowerCase().trim();
  const filteredActions = q
    ? SEED_ACTIONS.filter((a) => a.label.toLowerCase().includes(q) || a.description.toLowerCase().includes(q) || a.category.toLowerCase().includes(q))
    : SEED_ACTIONS;
  const filteredCategories = [...new Set(filteredActions.map((a) => a.category))];

  // ─── Guard ────────────────────────────────────────────────────────
  if (!isTestAccount) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <FlaskConical size={48} className="text-gray-300 mb-4" />
        <h1 className="text-2xl font-bold text-gray-700 mb-2">QA Test Panel</h1>
        <p className="text-gray-500">Sign in with a test account to access the test panel.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* ─── Page Header ──────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
            <FlaskConical size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">QA Test Panel</h1>
            <p className="text-sm text-gray-500">Database seeders for testing — service-role inserts via <code className="px-1 py-0.5 bg-gray-100 rounded text-xs">test-panel-seed</code></p>
          </div>
        </div>

        {/* Navigate & Locate toggle */}
        <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3 shadow-sm">
          <Navigation size={16} className={navigateEnabled ? 'text-indigo-600' : 'text-gray-400'} />
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-gray-700">Navigate & Locate</span>
            <span className="text-[10px] text-gray-400">Auto-navigate to created item after seed</span>
          </div>
          <button
            onClick={() => {
              const next = !navigateEnabled;
              setNavigateEnabled(next);
              writeNavigateEnabled(next);
            }}
            className={`relative ml-2 w-11 h-6 rounded-full transition-colors cursor-pointer ${navigateEnabled ? 'bg-indigo-600' : 'bg-gray-300'}`}
          >
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${navigateEnabled ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
          </button>
        </div>
      </div>

      {/* ─── Controls Row ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Account Switcher */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3 flex items-center gap-1.5">
            <UserCog size={14} /> Switch Account
          </h3>
          <div className="space-y-1.5">
            {TEST_ACCOUNTS.map((account) => {
              const isCurrent = account.email === userEmail;
              return (
                <button
                  key={account.email}
                  onClick={() => handleAccountSwitch(account.email)}
                  disabled={isCurrent || switching}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm transition-all cursor-pointer ${
                    isCurrent
                      ? 'bg-indigo-50 border border-indigo-200 text-indigo-700 font-semibold'
                      : 'bg-white border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/50 text-gray-700'
                  } ${switching ? 'opacity-60' : ''}`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${isCurrent ? 'bg-indigo-200 text-indigo-700' : 'bg-gray-200 text-gray-600'}`}>
                      {account.email.charAt(0).toUpperCase()}
                    </div>
                    <div className="text-left">
                      <p className="font-medium">{account.label}</p>
                      <p className="text-[10px] text-gray-400">{account.email}</p>
                    </div>
                  </div>
                  {isCurrent ? (
                    <span className="text-[10px] font-bold text-indigo-500 uppercase">Active</span>
                  ) : switching ? (
                    <RefreshCw size={14} className="animate-spin text-gray-400" />
                  ) : (
                    <ChevronRight size={14} className="text-gray-300" />
                  )}
                </button>
              );
            })}
          </div>
          {switchError && (
            <p className="text-xs text-red-500 mt-2 bg-red-50 px-3 py-1.5 rounded-lg flex items-start gap-1.5">
              <AlertCircle size={12} className="mt-0.5 shrink-0" />
              <span>{switchError}</span>
            </p>
          )}
        </div>

        {/* Seed Actors */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Seed Actors</h3>
          <p className="text-[11px] text-gray-500 mb-3">
            Data ownership is determined by these — not by who is signed in.
          </p>
          <div className="space-y-2">
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Client (signs as)</span>
              <select value={settings.clientEmail} onChange={(e) => updateSetting('clientEmail', e.target.value)} className="px-2 py-1.5 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                {TEST_ACCOUNTS.map((a) => <option key={a.email} value={a.email}>{a.label}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Master (other side)</span>
              <select value={settings.masterEmail} onChange={(e) => updateSetting('masterEmail', e.target.value)} className="px-2 py-1.5 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                {TEST_ACCOUNTS.map((a) => <option key={a.email} value={a.email}>{a.label}</option>)}
              </select>
            </label>
          </div>
        </div>

        {/* Seed Settings (overrides) */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
          <button
            onClick={() => setSettingsOpen((v) => !v)}
            className="w-full flex items-center justify-between cursor-pointer"
          >
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
              <SettingsIcon size={14} /> Override Defaults
              {hasCustomSettings && <span className="text-[9px] font-bold uppercase text-indigo-600 bg-indigo-100 px-1.5 py-0.5 rounded-full">Custom</span>}
            </h3>
            {settingsOpen ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
          </button>

          {settingsOpen && (
            <div className="mt-3 space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Offset (min)</span>
                  <input type="number" value={settings.minutesOffset} onChange={(e) => updateSetting('minutesOffset', e.target.value)} placeholder="default" className="px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Duration</span>
                  <input type="number" min="5" value={settings.durationMinutes} onChange={(e) => updateSetting('durationMinutes', e.target.value)} placeholder="service" className="px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Price (€)</span>
                  <input type="number" min="0" step="0.01" value={settings.price} onChange={(e) => updateSetting('price', e.target.value)} placeholder="default" className="px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Loyalty amt</span>
                  <input type="number" value={settings.loyaltyAmount} onChange={(e) => updateSetting('loyaltyAmount', e.target.value)} placeholder="default" className="px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Order qty</span>
                  <input type="number" min="1" value={settings.orderQuantity} onChange={(e) => updateSetting('orderQuantity', e.target.value)} placeholder="default" className="px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </label>
              </div>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Notes</span>
                <textarea value={settings.notes} onChange={(e) => updateSetting('notes', e.target.value)} placeholder="[QA] Seeded by test panel" rows={2} className="px-2 py-1.5 text-xs border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Message</span>
                <textarea value={settings.message} onChange={(e) => updateSetting('message', e.target.value)} placeholder="[QA] Could you do this style?" rows={2} className="px-2 py-1.5 text-xs border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </label>
              <div className="flex items-center justify-between pt-1">
                <p className="text-[10px] text-gray-400">Saved automatically.</p>
                <button onClick={resetSettings} className="text-[10px] text-indigo-600 hover:text-indigo-700 font-semibold flex items-center gap-1 cursor-pointer">
                  <RotateCcw size={11} /> Reset
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── Search ───────────────────────────────────────────────── */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search seed actions…"
          className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
        />
      </div>

      {/* ─── Seed Actions by Category ─────────────────────────────── */}
      {filteredCategories.map((category) => {
        const items = filteredActions.filter((a) => a.category === category);
        const theme = CAT_THEME[category] || defaultTheme;
        return (
          <section key={category}>
            <div className={`flex items-center justify-between px-4 py-2.5 rounded-t-xl ${theme.headerBg}`}>
              <h2 className={`text-sm font-bold ${theme.headerText}`}>{category}</h2>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${theme.badge}`}>{items.length} actions</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 p-3 bg-white border border-t-0 border-gray-200 rounded-b-xl">
              {items.map((act) => {
                const Icon = act.icon;
                const isRunning = runningAction === act.id;
                return (
                  <button
                    key={act.id}
                    onClick={() => runSeedAction(act)}
                    disabled={!!runningAction}
                    className={`group relative flex flex-col items-start gap-2 p-3 rounded-xl border transition-all text-left cursor-pointer ${
                      act.destructive
                        ? 'border-red-200 hover:border-red-300 hover:bg-red-50/60 hover:shadow-md'
                        : `border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/40 hover:shadow-md`
                    } ${isRunning ? 'opacity-60 cursor-wait' : ''} ${runningAction && !isRunning ? 'opacity-40' : ''}`}
                  >
                    {/* Navigate indicator */}
                    {navigateEnabled && act.navigateTo && (
                      <div className="absolute top-2 right-2">
                        <ExternalLink size={10} className="text-gray-300 group-hover:text-indigo-400 transition-colors" />
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${act.destructive ? 'bg-red-100' : theme.iconBg}`}>
                        {isRunning ? (
                          <Loader2 size={14} className={`animate-spin ${act.destructive ? 'text-red-600' : theme.iconText}`} />
                        ) : (
                          <Icon size={14} className={act.destructive ? 'text-red-600' : theme.iconText} />
                        )}
                      </div>
                      <p className={`text-sm font-semibold leading-tight ${act.destructive ? 'text-red-700' : 'text-gray-800'}`}>{act.label}</p>
                    </div>
                    <p className="text-[11px] text-gray-400 leading-snug">{act.description}</p>
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}

      {/* ─── Results Log ──────────────────────────────────────────── */}
      {results.length > 0 && (
        <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">Recent Results</h3>
            <button onClick={() => setResults([])} className="text-[10px] text-gray-400 hover:text-red-500 cursor-pointer">Clear</button>
          </div>
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {results.map((r, i) => (
              <div
                key={`${r.at}-${i}`}
                className={`text-[11px] px-3 py-2 rounded-lg flex items-start gap-2 ${r.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}`}
              >
                {r.ok ? <CheckCircle2 size={12} className="mt-0.5 shrink-0" /> : <AlertCircle size={12} className="mt-0.5 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold">{r.label}</p>
                  <p className="opacity-80 break-words">{r.message}</p>
                </div>
                <span className="text-[9px] text-gray-400 shrink-0">{new Date(r.at).toLocaleTimeString()}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ─── Footer ───────────────────────────────────────────────── */}
      <div className="flex items-center justify-between text-[10px] text-gray-400 px-1">
        <span>Test accounts only · Client: <strong>{settings.clientEmail}</strong> · Master: <strong>{settings.masterEmail}</strong></span>
        <button onClick={() => { clearAllSavedPasswords(); }} className="text-red-400 hover:text-red-600 cursor-pointer">
          Clear saved passwords
        </button>
      </div>

      {/* ─── Password Prompt Modal ────────────────────────────────── */}
      {showPasswordPrompt && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => { setShowPasswordPrompt(false); setPendingAccount(null); }} />
          <div className="relative bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Enter Test Password</h3>
            <p className="text-sm text-gray-500 mb-4">
              Password for {pendingAccount ? <code className="px-1 py-0.5 bg-gray-100 rounded">{pendingAccount}</code> : 'this account'}.
              Saved locally for this account only.
            </p>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handlePasswordSubmit()}
              placeholder="Password"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              autoFocus
            />
            <div className="flex gap-2 mt-4">
              <button onClick={() => { setShowPasswordPrompt(false); setPendingAccount(null); }} className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 cursor-pointer">
                Cancel
              </button>
              <button onClick={handlePasswordSubmit} className="flex-1 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 cursor-pointer">
                Save & Switch
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
