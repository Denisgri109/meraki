import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { styles } from "./TestPanelStyles";
import { NOTIFICATION_SCENARIOS } from "../constants";
import { colors } from "../../../theme";

interface Props {
  notificationsExpanded: boolean;
  setNotificationsExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  simulateNotification: (
    type:
      | "appointment_reminder"
      | "confirmation_request"
      | "message"
      | "consultation_response",
  ) => void;
}

export function NotificationsPanel({
  notificationsExpanded,
  setNotificationsExpanded,
  simulateNotification,
}: Props) {
  return (
    <>
      <Text style={[styles.sectionTitle, { marginTop: 20 }]}>
        NOTIFICATION SIMULATORS
      </Text>
      <Text style={styles.helperText}>
        Schedules local notifications mimicking production push payloads to test
        context deep-linking.
      </Text>

      <View style={styles.categoryBox}>
        <TouchableOpacity
          onPress={() => setNotificationsExpanded(!notificationsExpanded)}
          style={styles.categoryHeader}
        >
          <Text style={styles.categoryTitle}>Notification Scenarios</Text>
          <View style={styles.categoryRight}>
            <Text style={styles.categoryCount}>
              {NOTIFICATION_SCENARIOS.length}
            </Text>
            <MaterialIcons
              name={notificationsExpanded ? "expand-less" : "expand-more"}
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
                    <MaterialIcons name={act.icon} size={16} color="#6366F1" />
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
    </>
  );
}
