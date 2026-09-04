import { useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { DateTimeField } from '../src/components/DateTimeField'
import { SkeletonRows } from '../src/components/Skeleton'
import { useExpenseCategorySummary, useExpenseSubCategorySummary } from '../src/api/summary'
import { formatMoneyCents, toDateOnlyString } from '../src/lib/money'
import { humanizeSlug } from '../src/lib/text'
import { border, inactive, textPrimary, textSecondary } from '../src/theme'

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

export default function SummaryScreen() {
  const today = useMemo(() => new Date(), [])
  const [dateFrom, setDateFrom] = useState(() => toDateOnlyString(startOfMonth(today)))
  const [dateTo, setDateTo] = useState(() => toDateOnlyString(today))
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  const categorySummary = useExpenseCategorySummary(dateFrom, dateTo)
  const subCategorySummary = useExpenseSubCategorySummary(dateFrom, dateTo, selectedCategory)

  // A subcategory breakdown for a range that no longer applies would be
  // stale, so changing the range backs out of any drill-down.
  function setRange(next: { dateFrom?: string; dateTo?: string }) {
    setSelectedCategory(null)
    if (next.dateFrom !== undefined) setDateFrom(next.dateFrom)
    if (next.dateTo !== undefined) setDateTo(next.dateTo)
  }

  const active = selectedCategory === null ? categorySummary : subCategorySummary
  const rows = active.data?.rows ?? []
  // The grand total always reflects the whole range, regardless of
  // drill-down, matching the PWA's presentation.
  const grandTotalCents = categorySummary.data?.totalCents ?? 0
  const maxTotalCents = rows.length ? rows[0].totalCents : 0

  const showSkeleton = active.isPending
  const showError = active.isError && !active.isPending
  const showRows = !showSkeleton && !showError

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <DateTimeField
        label="From"
        mode="date"
        value={new Date(`${dateFrom}T00:00:00`)}
        onChange={d => setRange({ dateFrom: toDateOnlyString(d) })}
      />
      <DateTimeField
        label="To"
        mode="date"
        value={new Date(`${dateTo}T00:00:00`)}
        onChange={d => setRange({ dateTo: toDateOnlyString(d) })}
      />

      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Total</Text>
        <Text style={styles.totalAmount}>{formatMoneyCents(grandTotalCents)}</Text>
      </View>

      {selectedCategory !== null && (
        <Pressable style={styles.drillHeader} onPress={() => setSelectedCategory(null)}>
          <Text style={styles.drillBack}>‹</Text>
          <Text style={styles.drillLabel}>{humanizeSlug(selectedCategory)}</Text>
        </Pressable>
      )}

      {showSkeleton && (
        <View style={styles.skeletonWrap}>
          <SkeletonRows count={6} />
        </View>
      )}

      {showError && (
        <Pressable style={styles.errorBox} onPress={() => void active.refetch()}>
          <Text style={styles.errorText}>Couldn't load summary — tap to retry</Text>
        </Pressable>
      )}

      {showRows && rows.length === 0 && (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>No expenses in this range.</Text>
        </View>
      )}

      {showRows && rows.map(row => {
        const pct = maxTotalCents > 0 ? Math.round((row.totalCents / maxTotalCents) * 100) : 0
        const clickable = selectedCategory === null
        return (
          <Pressable
            key={row.category}
            style={styles.row}
            disabled={!clickable}
            onPress={clickable ? () => setSelectedCategory(row.category) : undefined}
          >
            <View style={styles.rowHeader}>
              <Text style={styles.rowLabel}>{humanizeSlug(row.category)}</Text>
              <Text style={styles.rowAmount}>{formatMoneyCents(row.totalCents)}</Text>
            </View>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: clickable ? textSecondary : inactive }]} />
            </View>
          </Pressable>
        )
      })}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 32,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: border,
  },
  totalLabel: {
    fontSize: 12,
    fontWeight: '400',
    color: textSecondary,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  totalAmount: {
    fontSize: 17,
    fontWeight: '600',
    color: textPrimary,
  },
  drillHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: border,
  },
  drillBack: {
    fontSize: 18,
    lineHeight: 18,
    color: textSecondary,
    marginRight: 10,
  },
  drillLabel: {
    fontSize: 14,
    color: textPrimary,
  },
  skeletonWrap: {
    paddingTop: 4,
  },
  errorBox: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  errorText: {
    fontSize: 13,
    color: textSecondary,
  },
  emptyBox: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: textSecondary,
  },
  row: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: border,
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: 12,
  },
  rowLabel: {
    fontSize: 14,
    color: textPrimary,
  },
  rowAmount: {
    fontSize: 15,
    fontWeight: '600',
    color: textPrimary,
    flexShrink: 0,
  },
  barTrack: {
    height: 3,
    backgroundColor: border,
    marginTop: 8,
  },
  barFill: {
    height: '100%',
  },
})
