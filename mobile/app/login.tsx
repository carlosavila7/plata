import { useEffect, useState } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useAuth } from '../src/auth/AuthContext'
import { bg, styles as theme, textPrimary, textSecondary } from '../src/theme'

export default function LoginScreen() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // Seconds remaining on a server-imposed login lockout (HTTP 429).
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    if (cooldown <= 0) return
    const id = setInterval(() => setCooldown(s => Math.max(0, s - 1)), 1000)
    return () => clearInterval(id)
  }, [cooldown])

  const disabled = busy || cooldown > 0 || !email || password.length < 8

  async function submit() {
    setError(null)
    setBusy(true)
    try {
      await login(email, password)
    } catch (err) {
      const failure = err as { status?: number; body?: { detail?: string; retryAfter?: number }; message?: string }
      setError(failure.body?.detail ?? failure.message ?? 'Something went wrong.')
      if (failure.status === 429 && failure.body?.retryAfter) {
        setCooldown(failure.body.retryAfter)
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.title}>(Plata)</Text>

      <View style={styles.form}>
        <Text style={theme.label}>Email</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          keyboardType="email-address"
          placeholder="you@example.com"
          placeholderTextColor={textSecondary}
          style={[theme.input, styles.field]}
        />

        <Text style={theme.label}>Password</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="current-password"
          placeholderTextColor={textSecondary}
          style={[theme.input, styles.field]}
          onSubmitEditing={() => void submit()}
        />

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          style={[theme.btnPrimary, styles.submit, disabled && styles.submitDisabled]}
          disabled={disabled}
          onPress={() => void submit()}
        >
          <Text style={theme.btnPrimaryText}>
            {busy ? '…' : cooldown > 0 ? `Try again in ${cooldown}s` : 'Sign in'}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: bg,
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    color: textPrimary,
    fontWeight: '700',
    fontSize: 20,
    letterSpacing: 2,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginBottom: 32,
  },
  form: {
    gap: 8,
  },
  field: {
    marginBottom: 16,
  },
  error: {
    color: '#ff6b6b',
    fontSize: 13,
    marginBottom: 8,
  },
  submit: {
    marginTop: 8,
  },
  submitDisabled: {
    opacity: 0.6,
  },
})
