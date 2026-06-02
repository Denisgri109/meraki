import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { format } from "date-fns";
import { MaterialIcons } from "@expo/vector-icons";
import { StampCard } from "../../components/loyalty/StampCard";
import { StampCard as StampCardType } from "../../types/loyalty";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";
import { useModal } from "../../contexts/ModalContext";
import {
  Card,
  Button,
  ScreenBackground,
  MerakiText,
} from "../../components/ui";
import { colors, spacing } from "../../theme";

const { width } = Dimensions.get("window");

export function StampCardsScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const { showAlert, showConfirm } = useModal();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cards, setCards] = useState<StampCardType[]>([]);

  useEffect(() => {
    if (user) fetchCards();
  }, [user]);

  const fetchCards = async () => {
    try {
      const { data, error } = await (supabase as any).rpc(
        "get_client_stamp_cards",
        {
          p_client_id: user?.id,
        },
      );

      if (error) throw error;
      setCards(data || []);
    } catch (error) {
      console.error("Error fetching stamp cards:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRedeem = async (card: StampCardType) => {
    if (!card.reward_available) return;

    showConfirm(
      "Redeem Reward",
      `Are you sure you want to redeem your reward for ${card.master_name}?`,
      async () => {
        try {
          const { data, error } = await (supabase as any).rpc(
            "redeem_stamp_card",
            {
              p_client_stamp_id: card.stamp_id,
              p_client_id: user?.id,
            },
          );

          if (error) throw error;

          if (data.success) {
            showAlert("Success!", data.message, "success");
            fetchCards();
          } else {
            showAlert("Error", data.message, "error");
          }
        } catch (error: any) {
          console.error("Error redeeming reward:", error);
          showAlert(
            "Error",
            error.message || "Failed to redeem reward",
            "error",
          );
        }
      },
    );
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchCards();
  };

  if (loading && !refreshing) {
    return (
      <ScreenBackground>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </ScreenBackground>
    );
  }

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <MaterialIcons
              name="arrow-back"
              size={22}
              color="rgba(0, 0, 0, 0.55)"
            />
          </TouchableOpacity>
          <MerakiText style={styles.headerTitle}>Stamp Cards</MerakiText>
          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={() => navigation.navigate("NFCScanner")}
              style={[styles.actionButton, { marginRight: 8 }]}
            >
              <MaterialIcons name="nfc" size={20} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => navigation.navigate("QRScanner")}
              style={styles.actionButton}
            >
              <MaterialIcons
                name="qr-code-scanner"
                size={20}
                color={colors.primary}
              />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
        >
          <MerakiText style={styles.subtitle}>
            Collect stamps every time you visit a master to unlock exclusive
            rewards.
          </MerakiText>

          {cards.length === 0 ? (
            <Card variant="glass" style={styles.emptyCard}>
              <View style={styles.emptyIconContainer}>
                <MaterialIcons
                  name="confirmation-number"
                  size={48}
                  color={colors.textMuted}
                />
              </View>
              <MerakiText variant="h3" style={styles.emptyTitle}>
                No active cards
              </MerakiText>
              <MerakiText style={styles.emptySubtitle}>
                Scan a Master's QR code at the salon to start your first stamp
                card.
              </MerakiText>
              <Button
                title="Scan QR Code"
                variant="primary"
                onPress={() => navigation.navigate("QRScanner")}
                style={styles.scanButton}
              />
            </Card>
          ) : (
            cards.map((card) => (
              <StampCard
                key={card.stamp_id}
                card={card}
                onRedeem={handleRedeem}
              />
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0, 0, 0, 0.03)",
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 17, fontWeight: "600", color: "#1A1A1A" },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(200, 160, 77, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(200, 160, 77, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: spacing.xl,
  },
  emptyCard: {
    padding: spacing.xxl,
    alignItems: "center",
    justifyContent: "center",
    borderStyle: "dashed",
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.08)",
    marginTop: spacing.xl,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(0, 0, 0, 0.02)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: spacing.xl,
  },
  scanButton: {
    width: "100%",
  },
});

export default StampCardsScreen;
