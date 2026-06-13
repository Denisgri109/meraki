import { Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../../../lib/supabase";
import {
  scheduleLocalNotification,
  NotificationData,
} from "../../../lib/notifications";
import { SeedAction, SeedResult } from "../types";
import { TEST_ACCOUNTS, LEGACY_PASSWORD_KEY, passwordKey } from "../constants";
import { useTestPanelState } from "./useTestPanelState";

export function useTestPanelActions(
  state: ReturnType<typeof useTestPanelState>,
) {
  const {
    userEmail,
    savedPasswords,
    setSavedPasswords,
    setPassword,
    setPendingAccount,
    setShowPasswordPrompt,
    setSwitching,
    setSwitchError,
    setOpen,
    setHasAnySaved,
    buildParams,
    setRunningAction,
    pushResult,
    user,
  } = state;

  const handleAccountSwitch = async (
    targetEmail: string,
    overridePw?: string,
  ) => {
    if (targetEmail === userEmail) return;

    const cached = savedPasswords[targetEmail.toLowerCase()];
    const pw = overridePw ?? cached ?? "";
    if (!pw) {
      setPassword("");
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
        const msg = error.message || "";
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
          setPassword("");
          setPendingAccount(targetEmail);
          setSwitchError(
            `Saved password is wrong for ${targetEmail}. Enter the correct one.`,
          );
          setShowPasswordPrompt(true);
          setSwitching(false);
          return;
        }

        setSwitchError(msg);
        Alert.alert("Switch failed", msg);
        setSwitching(false);
        return;
      }

      // Sign-in succeeded — persist this password for the target account
      // (covers cases where it came from a prompt or a legacy fallback).
      if (cached !== pw) {
        await AsyncStorage.setItem(passwordKey(targetEmail), pw);
        setSavedPasswords((prev) => ({
          ...prev,
          [targetEmail.toLowerCase()]: pw,
        }));
        setHasAnySaved(true);
      }

      // AuthContext listener will pick up the new session and re-render
      setOpen(false);
      setSwitching(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Switch failed";
      setSwitchError(message);
      setSwitching(false);
    }
  };

  const handlePasswordSubmit = async () => {
    const pw = state.password.trim();
    if (!pw || !state.pendingAccount) {
      setShowPasswordPrompt(false);
      setPendingAccount(null);
      return;
    }
    await AsyncStorage.setItem(passwordKey(state.pendingAccount), pw);
    setSavedPasswords((prev) => ({
      ...prev,
      [state.pendingAccount!.toLowerCase()]: pw,
    }));
    setHasAnySaved(true);
    setShowPasswordPrompt(false);
    const target = state.pendingAccount;
    setPendingAccount(null);
    handleAccountSwitch(target, pw);
  };

  const handleClearPassword = async () => {
    for (const a of TEST_ACCOUNTS) {
      await AsyncStorage.removeItem(passwordKey(a.email));
    }
    await AsyncStorage.removeItem(LEGACY_PASSWORD_KEY);
    setSavedPasswords({});
    setHasAnySaved(false);
    setPassword("");
  };

  const runSeedAction = (act: SeedAction) => {
    const exec = async () => {
      setRunningAction(act.id);
      try {
        const { data, error } = await supabase.functions.invoke(
          "test-panel-seed",
          {
            body: { action: act.action, params: buildParams(act) },
          },
        );

        if (error) {
          pushResult({ ok: false, label: act.label, message: error.message });
          return;
        }
        if (data && (data as { error?: string }).error) {
          const errObj = data as { error: string; details?: string };
          pushResult({
            ok: false,
            label: act.label,
            message: `${errObj.error}${errObj.details ? ` — ${errObj.details}` : ""}`,
          });
          return;
        }

        const d =
          (data as {
            summary?: Record<string, number>;
            row?: Record<string, unknown>;
          }) || {};
        let msg = "Success";
        if (d.summary) {
          const total = Object.values(d.summary).reduce((a, b) => a + b, 0);
          msg = `Cleared ${total} rows: ${Object.entries(d.summary)
            .map(([k, v]) => `${k}=${v}`)
            .join(", ")}`;
        } else if (d.row) {
          msg = `Created ${(d.row.id as string) || ""}${d.row.status ? ` (${d.row.status})` : ""}`;
        }
        pushResult({ ok: true, label: act.label, message: msg });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        pushResult({ ok: false, label: act.label, message });
      } finally {
        setRunningAction(null);
      }
    };

    if (act.destructive) {
      Alert.alert(
        "Clear test data?",
        "This deletes all test data for the 3 test accounts (bookings, consults, chats, orders) and resets loyalty points.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Delete", style: "destructive", onPress: exec },
        ],
      );
      return;
    }
    exec();
  };

  const fetchNotificationTargetId = async (
    type: string,
  ): Promise<{ id: string; isFallback: boolean }> => {
    try {
      if (type === "appointment_reminder" || type === "confirmation_request") {
        let { data } = await supabase
          .from("appointments")
          .select("id")
          .or(`client_id.eq.${user?.id},master_id.eq.${user?.id}`)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (data?.id) return { id: data.id, isFallback: false };

        const { data: anyApt } = await supabase
          .from("appointments")
          .select("id")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (anyApt?.id) return { id: anyApt.id, isFallback: false };

        return { id: "00000000-0000-0000-0000-000000000000", isFallback: true };
      }
      if (type === "message") {
        let { data } = await supabase
          .from("conversations")
          .select("id")
          .or(`client_id.eq.${user?.id},master_id.eq.${user?.id}`)
          .order("last_message_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (data?.id) return { id: data.id, isFallback: false };

        const { data: anyConvo } = await supabase
          .from("conversations")
          .select("id")
          .order("last_message_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (anyConvo?.id) return { id: anyConvo.id, isFallback: false };

        return { id: "00000000-0000-0000-0000-000000000000", isFallback: true };
      }
      if (type === "consultation_response") {
        let { data } = await supabase
          .from("booking_consultations")
          .select("id")
          .eq("client_id", user?.id || "")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (data?.id) return { id: data.id, isFallback: false };

        const { data: anyConsult } = await supabase
          .from("booking_consultations")
          .select("id")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (anyConsult?.id) return { id: anyConsult.id, isFallback: false };

        return { id: "00000000-0000-0000-0000-000000000000", isFallback: true };
      }
    } catch (err) {
      console.error("Error fetching target ID:", err);
    }
    return { id: "00000000-0000-0000-0000-000000000000", isFallback: true };
  };

  const simulateNotification = async (
    type:
      | "appointment_reminder"
      | "confirmation_request"
      | "message"
      | "consultation_response",
  ) => {
    let title = "";
    let body = "";
    let dataPayload: NotificationData = { type };

    const targetInfo = await fetchNotificationTargetId(type);
    const id = targetInfo.id;
    const isFallback = targetInfo.isFallback;

    if (type === "appointment_reminder") {
      title = "📅 Appointment Reminder";
      body = `Upcoming booking with Master Daxy tomorrow at 2:00 PM. ${isFallback ? "[Fallback ID]" : ""}`;
      dataPayload.appointmentId = id;
    } else if (type === "confirmation_request") {
      title = "⚠️ Confirmation Required";
      body = `Please confirm your upcoming appointment to secure your slot. ${isFallback ? "[Fallback ID]" : ""}`;
      dataPayload.appointmentId = id;
    } else if (type === "message") {
      title = "💬 New Message from Daxy";
      body = `Hey! Just wanted to confirm if we're still on for tomorrow. ${isFallback ? "[Fallback ID]" : ""}`;
      dataPayload.conversationId = id;
    } else if (type === "consultation_response") {
      title = "✨ Consultation Approved";
      body = `Your style consultation has been reviewed and approved. Tap to view notes. ${isFallback ? "[Fallback ID]" : ""}`;
      dataPayload.consultationId = id;
    }

    if (isFallback) {
      pushResult({
        ok: true,
        label: `Simulated ${type.replace("_", " ")}`,
        message:
          "Scheduled (1.5s delay). Note: Fallback ID used. Please run seeders first for working deep links.",
      });
    } else {
      pushResult({
        ok: true,
        label: `Simulated ${type.replace("_", " ")}`,
        message: `Scheduled successfully (1.5s delay) with ID: ${id.substring(0, 8)}...`,
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

  return {
    handleAccountSwitch,
    handlePasswordSubmit,
    handleClearPassword,
    runSeedAction,
    simulateNotification,
  };
}
