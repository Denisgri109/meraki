import React from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { styles } from "./TestPanelStyles";
import { SeedAction, SeedSettings } from "../types";
import { CATEGORIES, SEED_ACTIONS } from "../constants";
import { colors } from "../../../theme";

interface Props {
  settings: SeedSettings;
  expandedCategory: string | null;
  setExpandedCategory: React.Dispatch<React.SetStateAction<string | null>>;
  runningAction: string | null;
  runSeedAction: (act: SeedAction) => void;
}

export function SeedersPanel({
  settings,
  expandedCategory,
  setExpandedCategory,
  runningAction,
  runSeedAction,
}: Props) {
  const toggleCategory = (cat: string) => {
    setExpandedCategory(expandedCategory === cat ? null : cat);
  };

  return (
    <>
      <Text style={[styles.sectionTitle, { marginTop: 20 }]}>
        DATABASE SEEDERS
      </Text>
      <Text style={styles.helperText}>
        Inserts via service-role edge function. Configure who the data belongs
        to in Seed Settings above.
      </Text>
      <Text style={styles.helperHighlight}>
        Client: {settings.clientEmail} · Master: {settings.masterEmail}
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
                  name={isExpanded ? "expand-less" : "expand-more"}
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
                      style={[
                        styles.scenarioRow,
                        isRunning && { opacity: 0.6 },
                      ]}
                    >
                      <View
                        style={[
                          styles.scenarioIconBox,
                          act.destructive && { backgroundColor: "#FEE2E2" },
                        ]}
                      >
                        {isRunning ? (
                          <ActivityIndicator
                            size="small"
                            color={act.destructive ? "#DC2626" : "#6366F1"}
                          />
                        ) : (
                          <MaterialIcons
                            name={act.icon}
                            size={16}
                            color={act.destructive ? "#DC2626" : "#6366F1"}
                          />
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.scenarioLabel,
                            act.destructive && { color: "#B91C1C" },
                          ]}
                        >
                          {act.label}
                        </Text>
                        <Text style={styles.scenarioDesc}>
                          {act.description}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        );
      })}
    </>
  );
}
