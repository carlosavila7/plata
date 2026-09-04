import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { StyleSheet, Text } from 'react-native'
import { bg, border, textPrimary } from '../src/theme'

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: bg },
          headerTintColor: textPrimary,
          headerShadowVisible: false,
          headerTitleAlign: 'center',
          headerTitle: ({ children }) => <Text style={styles.headerTitle}>{children}</Text>,
          contentStyle: { backgroundColor: bg, borderTopWidth: 1, borderTopColor: border },
        }}
      >
        <Stack.Screen name="index" options={{ title: '(Plata)' }} />
        <Stack.Screen name="expenses" options={{ title: 'Expenses' }} />
        <Stack.Screen name="income" options={{ title: 'Income' }} />
        <Stack.Screen name="balances" options={{ title: 'Balances' }} />
        <Stack.Screen name="cards" options={{ title: 'Credit Cards' }} />
        <Stack.Screen name="investments" options={{ title: 'Investments' }} />
        <Stack.Screen name="debug" options={{ title: 'Debug' }} />
      </Stack>
    </>
  )
}

const styles = StyleSheet.create({
  headerTitle: {
    color: textPrimary,
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
})
