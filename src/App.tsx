import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './contexts/AuthContext';
import { CartProvider } from './contexts/CartContext';
import { StripeProvider } from './components/StripeProvider';
import { AppNavigator } from './navigation';
import { colors } from './theme';

export default function App() {
  return (
    <SafeAreaProvider>
      <StripeProvider>
        <AuthProvider>
          <CartProvider>
            <View style={styles.container}>
              <StatusBar style="light" />
              <AppNavigator />
            </View>
          </CartProvider>
        </AuthProvider>
      </StripeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
