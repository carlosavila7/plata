import { Link } from 'expo-router'
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native'
import { useAuth } from '../src/auth/AuthContext'
import { border, textPrimary, textSecondary } from '../src/theme'

const ENTITIES = [
  { label: 'Expenses', href: '/expenses' },
  { label: 'Income', href: '/income' },
  { label: 'Snapshots', href: '/snapshots' },
  { label: 'Credit Cards', href: '/cards' },
  { label: 'Investments', href: '/investments' },
] as const

export default function HomeScreen() {
  const { logout } = useAuth()

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {ENTITIES.map(({ label, href }) => (
        <Link key={href} href={href} asChild>
          <Pressable style={styles.row}>
            <Text style={styles.rowLabel}>{label}</Text>
            <Text style={styles.rowArrow}>→</Text>
          </Pressable>
        </Link>
      ))}

      <Link href="/debug" asChild>
        <Pressable style={styles.footerRow}>
          <Text style={styles.footerLabel}>Debug</Text>
        </Pressable>
      </Link>

      <Pressable style={styles.footerRow} onPress={() => void logout()}>
        <Text style={styles.footerLabel}>Log out</Text>
      </Pressable>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: border,
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '400',
    color: textPrimary,
  },
  rowArrow: {
    fontSize: 14,
    color: textSecondary,
  },
  footerRow: {
    paddingVertical: 16,
    marginTop: 24,
  },
  footerLabel: {
    fontSize: 12,
    fontWeight: '400',
    color: textSecondary,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
})
