import { useState } from 'react'
import { Link } from 'expo-router'
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useAuth } from '../src/auth/AuthContext'
import { useDerivedBalances, type AccountDerivedBalance } from '../src/api/derivedBalances'
import { DerivedBalanceModal } from '../src/components/DerivedBalanceModal'
import { SkeletonRows } from '../src/components/Skeleton'
import { formatMoneyCents, formatSnapshotDate } from '../src/lib/money'
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
  const { data: derivedBalances, isPending, isError, refetch } = useDerivedBalances()
  const [selected, setSelected] = useState<AccountDerivedBalance | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  // Tracked separately from the query's own isFetching, which also flips true
  // for the automatic foreground refetch (#9) — that trigger isn't a pull and
  // shouldn't spin this indicator.
  async function onPullToRefresh() {
    setRefreshing(true)
    try {
      await refetch()
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onPullToRefresh()} tintColor={textSecondary} />}
    >
      <Text style={styles.sectionLabel}>Derived balance</Text>

      {isPending && <SkeletonRows count={4} />}

      {isError && !isPending && (
        <Pressable style={styles.errorBox} onPress={() => void refetch()}>
          <Text style={styles.errorText}>Couldn't load derived balances — tap to retry</Text>
        </Pressable>
      )}

      {!isPending && !isError && derivedBalances?.map(derivedBalance => (
        <Pressable key={derivedBalance.accountId} style={styles.derivedBalanceRow} onPress={() => setSelected(derivedBalance)}>
          <View style={styles.derivedBalanceInfo}>
            <Text style={styles.derivedBalanceName}>{derivedBalance.name}</Text>
            <Text style={styles.derivedBalanceAsOf}>
              {derivedBalance.snapshotDate ? `as of ${formatSnapshotDate(derivedBalance.snapshotDate)}` : 'no snapshot yet'}
            </Text>
          </View>
          <Text style={styles.derivedBalanceAmount}>{formatMoneyCents(derivedBalance.amountCents)}</Text>
        </Pressable>
      ))}

      <DerivedBalanceModal balance={selected} onClose={() => setSelected(null)} />

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
  sectionLabel: {
    fontSize: 12,
    fontWeight: '400',
    color: textSecondary,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  derivedBalanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: border,
  },
  derivedBalanceInfo: {
    flexShrink: 1,
    gap: 2,
  },
  derivedBalanceName: {
    fontSize: 14,
    color: textPrimary,
  },
  derivedBalanceAsOf: {
    fontSize: 11,
    color: textSecondary,
  },
  derivedBalanceAmount: {
    fontSize: 15,
    fontWeight: '600',
    color: textPrimary,
  },
  errorBox: {
    paddingVertical: 16,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: border,
  },
  errorText: {
    fontSize: 13,
    color: textSecondary,
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
