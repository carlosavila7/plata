import { useEffect } from 'react'
import { Stack, useRouter, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '../src/query/queryClient'
import { AuthProvider, useAuth } from '../src/auth/AuthContext'
import { bg, border, textPrimary } from '../src/theme'

// Redirects between the login screen and the rest of the app as the session
// resolves. Runs once auth has settled — before that, a spinner covers the
// gap so no screen flashes while the silent refresh from the keystore is in flight.
function AuthGate() {
  const { status } = useAuth()
  const segments = useSegments()
  const router = useRouter()

  useEffect(() => {
    if (status === 'loading') return
    const onLoginScreen = segments[0] === 'login'
    if (status === 'unauthenticated' && !onLoginScreen) {
      router.replace('/login')
    } else if (status === 'authenticated' && onLoginScreen) {
      router.replace('/')
    }
  }, [status, segments, router])

  if (status === 'loading') {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={textPrimary} />
      </View>
    )
  }

  return (
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
      <Stack.Screen name="expense-new" options={{ title: 'New Expense' }} />
      <Stack.Screen name="expense-edit" options={{ title: 'Edit Expense' }} />
      <Stack.Screen name="income" options={{ title: 'Income' }} />
      <Stack.Screen name="snapshots" options={{ title: 'Snapshots' }} />
      <Stack.Screen name="cards" options={{ title: 'Credit Cards' }} />
      <Stack.Screen name="investments" options={{ title: 'Investments' }} />
      <Stack.Screen name="debug" options={{ title: 'Debug' }} />
      <Stack.Screen name="login" options={{ headerShown: false, gestureEnabled: false }} />
    </Stack>
  )
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <StatusBar style="light" />
        <AuthGate />
      </AuthProvider>
    </QueryClientProvider>
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
  loading: {
    flex: 1,
    backgroundColor: bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
