import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider } from './contexts/AuthContext';
import { CartProvider } from './contexts/CartContext';
import { ModalProvider } from './contexts/ModalContext';
import { StripeProvider } from './components/StripeProvider';
import { AppNavigator } from './navigation';
import { GlobalBackground } from './components/GlobalBackground';
import { colors } from './theme';

export default function App() {
  return (
    <GestureHandlerRootView style={styles.gestureRoot}>
      <SafeAreaProvider>
        <StripeProvider>
          <ModalProvider>
            <AuthProvider>
              <CartProvider>
                <View style={[styles.container, { backgroundColor: '#000' }]}>
                  <StatusBar style="light" />
                  <GlobalBackground>
                    <AppNavigator />
                  </GlobalBackground>
                </View>
              </CartProvider>
            </AuthProvider>
          </ModalProvider>
        </StripeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  gestureRoot: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
