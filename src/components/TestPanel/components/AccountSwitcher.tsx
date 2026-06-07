import React from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { styles } from "./TestPanelStyles";
import { TEST_ACCOUNTS } from "../constants";
import { colors } from "../../../theme";

interface Props {
  userEmail: string | undefined;
  switching: boolean;
  switchError: string | null;
  handleAccountSwitch: (targetEmail: string) => void;
}

export function AccountSwitcher({
  userEmail,
  switching,
  switchError,
  handleAccountSwitch,
}: Props) {
  return (
    <>
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
                  <Text
                    style={[
                      styles.avatarText,
                      isCurrent && styles.avatarTextActive,
                    ]}
                  >
                    {account.email.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View>
                  <Text
                    style={[
                      styles.accountLabel2,
                      isCurrent && styles.accountLabel2Active,
                    ]}
                  >
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
                <MaterialIcons
                  name="chevron-right"
                  size={18}
                  color={colors.textMuted}
                />
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
    </>
  );
}
