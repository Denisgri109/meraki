import React from "react";
import { View, Text, TouchableOpacity, Modal, ScrollView } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useTestPanelState } from "./hooks/useTestPanelState";
import { useTestPanelActions } from "./hooks/useTestPanelActions";
import { AccountSwitcher } from "./components/AccountSwitcher";
import { SeedSettingsPanel } from "./components/SeedSettingsPanel";
import { SeedersPanel } from "./components/SeedersPanel";
import { NotificationsPanel } from "./components/NotificationsPanel";
import { ResultsPanel } from "./components/ResultsPanel";
import { PasswordPrompt } from "./components/PasswordPrompt";
import { styles } from "./components/TestPanelStyles";
import { colors } from "../../theme";

export function TestPanel() {
  const state = useTestPanelState();
  const actions = useTestPanelActions(state);

  if (!state.isTestAccount) return null;

  return (
    <>
      {/* ─── FAB ─────────────────────────────────────────── */}
      <TouchableOpacity
        onPress={() => state.setOpen(true)}
        style={styles.fab}
        activeOpacity={0.85}
        accessibilityLabel="Open test panel"
      >
        <MaterialIcons name="science" size={24} color="#FFFFFF" />
        <View style={styles.fabPulse} />
      </TouchableOpacity>

      {/* ─── Panel modal ─────────────────────────────────── */}
      <Modal
        visible={state.open}
        animationType="slide"
        transparent
        onRequestClose={() => state.setOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => state.setOpen(false)}
          />

          <View style={styles.panel}>
            {/* Header */}
            <View style={styles.panelHeader}>
              <View style={styles.headerLeft}>
                <MaterialIcons name="science" size={20} color="#6366F1" />
                <Text style={styles.headerTitle}>QA Test Panel</Text>
              </View>
              <TouchableOpacity
                onPress={() => state.setOpen(false)}
                style={styles.closeBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <MaterialIcons
                  name="close"
                  size={20}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            </View>

            {/* Current account badge */}
            <View style={styles.accountBadge}>
              <View style={styles.dot} />
              <Text style={styles.accountLabel}>Signed in:</Text>
              <Text style={styles.accountEmail} numberOfLines={1}>
                {state.userEmail}
              </Text>
              <View style={styles.roleTag}>
                <Text style={styles.roleTagText}>
                  {state.profile?.role || "client"}
                </Text>
              </View>
            </View>

            <ScrollView
              style={styles.scrollContent}
              contentContainerStyle={{ paddingBottom: 24 }}
            >
              <AccountSwitcher
                userEmail={state.userEmail}
                switching={state.switching}
                switchError={state.switchError}
                handleAccountSwitch={actions.handleAccountSwitch}
              />

              <SeedSettingsPanel
                settings={state.settings}
                settingsOpen={state.settingsOpen}
                setSettingsOpen={state.setSettingsOpen}
                updateSetting={state.updateSetting}
                resetSettings={state.resetSettings}
              />

              <SeedersPanel
                settings={state.settings}
                expandedCategory={state.expandedCategory}
                setExpandedCategory={state.setExpandedCategory}
                runningAction={state.runningAction}
                runSeedAction={actions.runSeedAction}
              />

              <NotificationsPanel
                notificationsExpanded={state.notificationsExpanded}
                setNotificationsExpanded={state.setNotificationsExpanded}
                simulateNotification={actions.simulateNotification}
              />

              <ResultsPanel results={state.results} />
            </ScrollView>

            {/* Footer */}
            <View style={styles.footer}>
              <Text style={styles.footerText}>Test accounts only</Text>
              {state.hasAnySaved ? (
                <TouchableOpacity onPress={actions.handleClearPassword}>
                  <Text style={styles.clearText}>Clear saved passwords</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── Password prompt ─────────────────────────────── */}
      <PasswordPrompt
        showPasswordPrompt={state.showPasswordPrompt}
        setShowPasswordPrompt={state.setShowPasswordPrompt}
        pendingAccount={state.pendingAccount}
        setPendingAccount={state.setPendingAccount}
        password={state.password}
        setPassword={state.setPassword}
        handlePasswordSubmit={actions.handlePasswordSubmit}
      />
    </>
  );
}
