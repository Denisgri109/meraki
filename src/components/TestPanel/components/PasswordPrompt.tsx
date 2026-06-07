import React from "react";
import { View, Text, TouchableOpacity, TextInput, Modal } from "react-native";
import { styles } from "./TestPanelStyles";
import { colors } from "../../../theme";

interface Props {
  showPasswordPrompt: boolean;
  setShowPasswordPrompt: React.Dispatch<React.SetStateAction<boolean>>;
  pendingAccount: string | null;
  setPendingAccount: React.Dispatch<React.SetStateAction<string | null>>;
  password: string;
  setPassword: React.Dispatch<React.SetStateAction<string>>;
  handlePasswordSubmit: () => void;
}

export function PasswordPrompt({
  showPasswordPrompt,
  setShowPasswordPrompt,
  pendingAccount,
  setPendingAccount,
  password,
  setPassword,
  handlePasswordSubmit,
}: Props) {
  return (
    <Modal visible={showPasswordPrompt} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => {
            setShowPasswordPrompt(false);
            setPendingAccount(null);
          }}
        />
        <View style={styles.passwordCard}>
          <Text style={styles.passwordTitle}>Enter Test Password</Text>
          <Text style={styles.passwordSubtitle}>
            Password for {pendingAccount || "this account"}. Saved locally for
            this account only — others keep their own.
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
              onPress={() => {
                setShowPasswordPrompt(false);
                setPendingAccount(null);
              }}
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
  );
}
