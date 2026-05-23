// ─── Shared constants, types, and utilities for the QA Test Panel ─────────

// ─── Test accounts whitelist ──────────────────────────────────────────────
export const TEST_ACCOUNTS: ReadonlyArray<{
  email: string;
  label: string;
  id: string;
  role: 'owner' | 'client' | 'master';
}> = [
  { email: 'test@gmail.com',       label: 'Test (Owner)', id: '744b77f1-e94f-4918-9c04-3b9f47288377', role: 'owner' },
  { email: 'testclient@gmail.com', label: 'Test Client',  id: '3f19e0f2-7e0b-4dc2-8a8e-3ac1939d9f1f', role: 'client' },
  { email: 'daxyburn@gmail.com',   label: 'Daxyburn',     id: 'aab4ab46-76d5-4a98-8487-2a6f1b8a2a1b', role: 'master' },
];
export const TEST_EMAILS = TEST_ACCOUNTS.map((a) => a.email);
export const emailToId = (email: string): string | undefined =>
  TEST_ACCOUNTS.find((a) => a.email.toLowerCase() === email.toLowerCase())?.id;

// ─── Per-account password cache ─────────────────────────────────────────
const PASSWORD_PREFIX = 'meraki:test-panel:password:';
const LEGACY_PW_KEY = 'meraki:test-panel:password';

export const readSavedPassword = (email: string): string | null => {
  try { return localStorage.getItem(`${PASSWORD_PREFIX}${email.toLowerCase()}`); } catch { return null; }
};
export const saveSavedPassword = (email: string, pw: string) => {
  try { localStorage.setItem(`${PASSWORD_PREFIX}${email.toLowerCase()}`, pw); } catch { /* */ }
};
export const clearSavedPassword = (email: string) => {
  try { localStorage.removeItem(`${PASSWORD_PREFIX}${email.toLowerCase()}`); } catch { /* */ }
};
export const clearAllSavedPasswords = () => {
  try {
    TEST_ACCOUNTS.forEach((a) => localStorage.removeItem(`${PASSWORD_PREFIX}${a.email.toLowerCase()}`));
    localStorage.removeItem(LEGACY_PW_KEY);
  } catch { /* */ }
};
export const readLegacyPassword = (): string | null => {
  try { return localStorage.getItem(LEGACY_PW_KEY); } catch { return null; }
};
export const clearLegacyPassword = () => {
  try { localStorage.removeItem(LEGACY_PW_KEY); } catch { /* */ }
};

// ─── Seed settings ──────────────────────────────────────────────────────
export interface SeedSettings {
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

export const DEFAULT_SETTINGS: SeedSettings = {
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

const SETTINGS_KEY = 'meraki:test-panel:seed-settings';

export const readSettings = (): SeedSettings => {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch { return { ...DEFAULT_SETTINGS }; }
};
export const writeSettings = (s: SeedSettings) => {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch { /* */ }
};

// ─── Build seed params ──────────────────────────────────────────────────
export const buildParams = (
  action: string,
  actionParams: Record<string, unknown> | undefined,
  settings: SeedSettings,
): Record<string, unknown> => {
  const base = { ...(actionParams || {}) } as Record<string, unknown>;
  const clientId = emailToId(settings.clientEmail);
  const masterId = emailToId(settings.masterEmail);
  if (clientId) base.client_id = clientId;
  if (masterId) base.master_id = masterId;
  if (settings.notes.trim()) base.notes = settings.notes.trim();
  if (settings.message.trim()) base.message = settings.message.trim();

  if (action === 'create_appointment') {
    if (settings.minutesOffset.trim()) base.minutes_offset = Number(settings.minutesOffset);
    if (settings.durationMinutes.trim()) base.duration_minutes = Number(settings.durationMinutes);
    if (settings.price.trim()) base.price = Number(settings.price);
  }
  if (action === 'add_loyalty_points' && settings.loyaltyAmount.trim()) {
    base.amount = Number(settings.loyaltyAmount);
  }
  if (action === 'create_order') {
    if (settings.orderQuantity.trim()) base.quantity = Number(settings.orderQuantity);
    if (settings.price.trim()) base.price = Number(settings.price);
  }
  return base;
};

// ─── Seed result ────────────────────────────────────────────────────────
export interface SeedResult {
  ok: boolean;
  action: string;
  label: string;
  message: string;
  data?: unknown;
  at: number;
}

// ─── Navigate & Highlight ───────────────────────────────────────────────
const NAVIGATE_KEY = 'meraki:test-panel:navigate-on-seed';
const HIGHLIGHT_KEY = 'meraki:test-highlight';

export const readNavigateEnabled = (): boolean => {
  try { return localStorage.getItem(NAVIGATE_KEY) === 'true'; } catch { return false; }
};
export const writeNavigateEnabled = (v: boolean) => {
  try { localStorage.setItem(NAVIGATE_KEY, v ? 'true' : 'false'); } catch { /* */ }
};

export interface HighlightInfo {
  rowId?: string;
  action: string;
  label: string;
  navigateTo: string;
  timestamp: number;
}
export const setHighlightTarget = (info: HighlightInfo) => {
  try { sessionStorage.setItem(HIGHLIGHT_KEY, JSON.stringify(info)); } catch { /* */ }
};
export const getHighlightTarget = (): HighlightInfo | null => {
  try {
    const raw = sessionStorage.getItem(HIGHLIGHT_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
};
export const clearHighlightTarget = () => {
  try { sessionStorage.removeItem(HIGHLIGHT_KEY); } catch { /* */ }
};
