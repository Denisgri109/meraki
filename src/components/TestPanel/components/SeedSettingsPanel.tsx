import React from "react";
import { View, Text, TouchableOpacity, TextInput } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { styles } from "./TestPanelStyles";
import { SeedSettings } from "../types";
import { TEST_ACCOUNTS, DEFAULT_SETTINGS } from "../constants";
import { colors } from "../../../theme";

interface Props {
  settings: SeedSettings;
  settingsOpen: boolean;
  setSettingsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  updateSetting: <K extends keyof SeedSettings>(
    key: K,
    value: SeedSettings[K],
  ) => void;
  resetSettings: () => void;
}

export function SeedSettingsPanel({
  settings,
  settingsOpen,
  setSettingsOpen,
  updateSetting,
  resetSettings,
}: Props) {
  const hasCustomSettings =
    settings.clientEmail !== DEFAULT_SETTINGS.clientEmail ||
    settings.masterEmail !== DEFAULT_SETTINGS.masterEmail ||
    settings.minutesOffset.trim() !== "" ||
    settings.durationMinutes.trim() !== "" ||
    settings.price.trim() !== "" ||
    settings.notes.trim() !== "" ||
    settings.message.trim() !== "" ||
    settings.loyaltyAmount.trim() !== "" ||
    settings.orderQuantity.trim() !== "";

  return (
    <>
      <TouchableOpacity
        onPress={() => setSettingsOpen((v) => !v)}
        style={[styles.settingsHeader, { marginTop: 20 }]}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <MaterialIcons
            name="settings"
            size={14}
            color={colors.textSecondary}
          />
          <Text style={styles.settingsHeaderTitle}>Seed Settings</Text>
          {hasCustomSettings ? (
            <View style={styles.customTag}>
              <Text style={styles.customTagText}>CUSTOM</Text>
            </View>
          ) : null}
        </View>
        <MaterialIcons
          name={settingsOpen ? "expand-less" : "expand-more"}
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
                  onPress={() => updateSetting("clientEmail", a.email)}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text
                    style={[styles.chipText, active && styles.chipTextActive]}
                  >
                    {a.short}
                  </Text>
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
                  onPress={() => updateSetting("masterEmail", a.email)}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text
                    style={[styles.chipText, active && styles.chipTextActive]}
                  >
                    {a.short}
                  </Text>
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
                onChangeText={(t) => updateSetting("minutesOffset", t)}
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
                onChangeText={(t) => updateSetting("durationMinutes", t)}
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
                onChangeText={(t) => updateSetting("price", t)}
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
                onChangeText={(t) => updateSetting("loyaltyAmount", t)}
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
                onChangeText={(t) => updateSetting("orderQuantity", t)}
                keyboardType="numeric"
                placeholder="default"
                placeholderTextColor={colors.textMuted}
                style={styles.fieldInput}
              />
            </View>
          </View>

          {/* Notes / Message */}
          <Text style={styles.fieldLabel}>
            Notes (appointments / orders / consults)
          </Text>
          <TextInput
            value={settings.notes}
            onChangeText={(t) => updateSetting("notes", t)}
            placeholder="[QA] Seeded by test panel"
            placeholderTextColor={colors.textMuted}
            multiline
            style={[styles.fieldInput, styles.fieldMultiline]}
          />
          <Text style={styles.fieldLabel}>
            Message (photo consult / first chat)
          </Text>
          <TextInput
            value={settings.message}
            onChangeText={(t) => updateSetting("message", t)}
            placeholder="[QA] Could you do this style for me?"
            placeholderTextColor={colors.textMuted}
            multiline
            style={[styles.fieldInput, styles.fieldMultiline]}
          />

          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: 4,
            }}
          >
            <Text style={[styles.helperText, { marginBottom: 0 }]}>
              Saved automatically.
            </Text>
            <TouchableOpacity
              onPress={resetSettings}
              style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
            >
              <MaterialIcons name="restart-alt" size={12} color="#6366F1" />
              <Text style={styles.resetText}>Reset to defaults</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
    </>
  );
}
