import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { bg, border, surface, textPrimary, textSecondary } from '../theme'
import { formatMoneyCents, formatSnapshotDate } from '../lib/money'
import type { AccountDerivedBalance } from '../api/derivedBalances'

interface Props {
  balance: AccountDerivedBalance | null
  onClose: () => void
}

// The breakdown behind the tap is the substitute for a test oracle while the
// PWA and this client both derive balances independently (see #5, #10) — it
// localises a disagreement to a single term instead of requiring a side-by-side
// read of both implementations.
export function DerivedBalanceModal({ balance, onClose }: Props) {
  return (
    <Modal visible={balance !== null} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        {balance && (
          <>
            <Text style={styles.title}>{balance.name}</Text>

            <Row
              label={balance.snapshotDate ? `Snapshot — ${formatSnapshotDate(balance.snapshotDate)}` : 'Snapshot — none'}
              cents={balance.snapshotAmountCents}
            />
            <Row label="Income" cents={balance.components.incomeCents} signed />
            <Row label="Transfers out" cents={-balance.components.transfersOutCents} signed />
            <Row label="Expenses" cents={-balance.components.expensesCents} signed />
            <Row label="Statements" cents={-balance.components.statementsCents} signed />
            <Row label="Investment net" cents={-balance.components.investmentNetCents} signed />

            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Derived balance</Text>
              <Text style={styles.totalValue}>{formatMoneyCents(balance.amountCents)}</Text>
            </View>

            <Pressable onPress={onClose} style={styles.doneBtn}>
              <Text style={styles.doneText}>Done</Text>
            </Pressable>
          </>
        )}
      </View>
    </Modal>
  )
}

// `cents` is the term's already-signed contribution to the total (e.g.
// "Transfers out" is passed negated). `signed` derives the +/− prefix from
// that value rather than hardcoding one per row — a component like
// investmentNetCents can itself be negative (net sells), and hardcoding
// would print a confusing double negative for that case.
function Row({ label, cents, signed }: { label: string; cents: number; signed?: boolean }) {
  const prefix = signed ? (cents > 0 ? '+ ' : cents < 0 ? '− ' : '') : ''
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>
        {prefix}
        {formatMoneyCents(signed ? Math.abs(cents) : cents)}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: surface,
    borderTopWidth: 1,
    borderTopColor: border,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 32,
  },
  title: {
    color: textPrimary,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: border,
  },
  rowLabel: {
    fontSize: 13,
    color: textSecondary,
  },
  rowValue: {
    fontSize: 13,
    color: textPrimary,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 14,
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: textPrimary,
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '700',
    color: textPrimary,
  },
  doneBtn: {
    marginTop: 20,
    alignItems: 'center',
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: border,
    backgroundColor: bg,
  },
  doneText: {
    color: textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
})
