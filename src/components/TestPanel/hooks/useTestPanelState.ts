import { useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "../../../contexts/AuthContext";
import { SeedSettings, SeedResult, SeedAction } from "../types";
import {
  TEST_ACCOUNTS,
  TEST_EMAILS,
  DEFAULT_SETTINGS,
  SETTINGS_STORAGE_KEY,
  LEGACY_PASSWORD_KEY,
  passwordKey,
  emailToId,
} from "../constants";

export function useTestPanelState() {
  const { user, profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [pendingAccount, setPendingAccount] = useState<string | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(
    "Appointments",
  );
  const [notificationsExpanded, setNotificationsExpanded] = useState(false);
  const [runningAction, setRunningAction] = useState<string | null>(null);
  const [results, setResults] = useState<SeedResult[]>([]);

  // Map of email -> cached password (loaded from AsyncStorage on mount).
  const [savedPasswords, setSavedPasswords] = useState<Record<string, string>>(
    {},
  );
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

  const updateSetting = useCallback(
    <K extends keyof SeedSettings>(key: K, value: SeedSettings[K]) => {
      setSettings((prev) => {
        const next = { ...prev, [key]: value };
        AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next)).catch(
          () => {
            /* ignore */
          },
        );
        return next;
      });
    },
    [],
  );

  const resetSettings = useCallback(() => {
    setSettings({ ...DEFAULT_SETTINGS });
    AsyncStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify(DEFAULT_SETTINGS),
    ).catch(() => {
      /* ignore */
    });
  }, []);

  const pushResult = useCallback((r: Omit<SeedResult, "at">) => {
    setResults((prev) => [{ ...r, at: Date.now() }, ...prev].slice(0, 6));
  }, []);

  const buildParams = useCallback(
    (act: SeedAction): Record<string, unknown> => {
      const base = { ...(act.params || {}) } as Record<string, unknown>;
      const clientId = emailToId(settings.clientEmail);
      const masterId = emailToId(settings.masterEmail);
      if (clientId) base.client_id = clientId;
      if (masterId) base.master_id = masterId;
      if (settings.notes.trim()) base.notes = settings.notes.trim();
      if (settings.message.trim()) base.message = settings.message.trim();
      if (act.action === "create_appointment") {
        if (settings.minutesOffset.trim())
          base.minutes_offset = Number(settings.minutesOffset);
        if (settings.durationMinutes.trim())
          base.duration_minutes = Number(settings.durationMinutes);
        if (settings.price.trim()) base.price = Number(settings.price);
      }
      if (
        act.action === "add_loyalty_points" &&
        settings.loyaltyAmount.trim()
      ) {
        base.amount = Number(settings.loyaltyAmount);
      }
      if (act.action === "create_order") {
        if (settings.orderQuantity.trim())
          base.quantity = Number(settings.orderQuantity);
        if (settings.price.trim()) base.price = Number(settings.price);
      }
      return base;
    },
    [settings],
  );

  return {
    user,
    profile,
    userEmail,
    isTestAccount,

    open,
    setOpen,
    switching,
    setSwitching,
    switchError,
    setSwitchError,
    password,
    setPassword,
    showPasswordPrompt,
    setShowPasswordPrompt,
    pendingAccount,
    setPendingAccount,

    expandedCategory,
    setExpandedCategory,
    notificationsExpanded,
    setNotificationsExpanded,
    runningAction,
    setRunningAction,

    results,
    pushResult,

    savedPasswords,
    setSavedPasswords,
    hasAnySaved,
    setHasAnySaved,

    settings,
    setSettings,
    updateSetting,
    resetSettings,
    settingsOpen,
    setSettingsOpen,

    buildParams,
  };
}
