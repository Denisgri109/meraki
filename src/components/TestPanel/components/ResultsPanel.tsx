import React from "react";
import { View, Text } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { styles } from "./TestPanelStyles";
import { SeedResult } from "../types";

interface Props {
  results: SeedResult[];
}

export function ResultsPanel({ results }: Props) {
  if (results.length === 0) return null;

  return (
    <>
      <Text style={[styles.sectionTitle, { marginTop: 16 }]}>
        RECENT RESULTS
      </Text>
      {results.map((r, i) => (
        <View
          key={`${r.at}-${i}`}
          style={[
            styles.resultBox,
            r.ok ? styles.resultBoxOk : styles.resultBoxErr,
          ]}
        >
          <MaterialIcons
            name={r.ok ? "check-circle" : "error-outline"}
            size={12}
            color={r.ok ? "#15803D" : "#DC2626"}
          />
          <View style={{ flex: 1 }}>
            <Text
              style={[
                styles.resultLabel,
                r.ok ? { color: "#15803D" } : { color: "#B91C1C" },
              ]}
            >
              {r.label}
            </Text>
            <Text
              style={[
                styles.resultMsg,
                r.ok ? { color: "#166534" } : { color: "#991B1B" },
              ]}
            >
              {r.message}
            </Text>
          </View>
        </View>
      ))}
    </>
  );
}
