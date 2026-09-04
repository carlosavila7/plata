import { useCallback, useMemo, useState } from 'react'
import { Stack, useRouter } from 'expo-router'
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { useAccounts } from '../src/api/lookups'
import { useExpenseList, useResetExpenseList, type Expense, type ExpenseFilters } from '../src/api/expenses'
import { ExpenseFilterSheet } from '../src/components/ExpenseFilterSheet'
import { SkeletonRows } from '../src/components/Skeleton'
import { formatMoneyCents, formatOccurredAt } from '../src/lib/money'
import { humanizeSlug } from '../src/lib/text'
import { border, textPrimary, textSecondary } from '../src/theme'

export default function ExpensesScreen() {
  const router = useRouter()
  const [filters, setFilters] = useState<ExpenseFilters>({})
  const [filterSheetOpen, setFilterSheetOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const { data: accounts } = useAccounts()
  const accountNameById = useMemo(() => new Map((accounts ?? []).map(a => [a.id, a.name])), [accounts])

  const { data, isPending, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useExpenseList(filters)
  const resetList = useResetExpenseList(filters)

  const expenses = useMemo(() => data?.pages.flatMap(page => page.items) ?? [], [data])
  const activeFilterCount = Object.values(filters).filter(Boolean).length

  // Distinguishes the initial load failing (nothing to show at all) from a
  // later page failing to load (rows already on screen stay put, and only
  // the footer offers a retry) — see #11's acceptance criteria.
  const showInitialError = isError && !isPending && expenses.length === 0
  const showList = !isPending && !showInitialError

  async function onPullToRefresh() {
    setRefreshing(true)
    try {
      await resetList()
    } finally {
      setRefreshing(false)
    }
  }

  // Guarding on isError keeps a run of failures from being replayed on every
  // scroll event near the bottom — the footer's own retry button is the only
  // way to try again once a page has failed.
  const onEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage && !isError) void fetchNextPage()
  }, [hasNextPage, isFetchingNextPage, isError, fetchNextPage])

  function renderItem({ item }: { item: Expense }) {
    return (
      <Pressable style={styles.row} onPress={() => router.push({ pathname: '/expense-edit', params: { id: item.id } })}>
        <View style={styles.rowInfo}>
          <Text style={styles.rowCategory} numberOfLines={1}>
            {humanizeSlug(item.category)} · {humanizeSlug(item.subCategory)}
          </Text>
          <Text style={styles.rowMeta} numberOfLines={1}>
            {formatOccurredAt(item.occurredAt)} · {accountNameById.get(item.accountId) ?? '—'}
          </Text>
        </View>
        <Text style={styles.rowAmount}>{formatMoneyCents(item.costCents)}</Text>
      </Pressable>
    )
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable onPress={() => router.push('/expense-new')} hitSlop={12}>
              <Text style={styles.addButton}>+</Text>
            </Pressable>
          ),
        }}
      />

      <Pressable style={styles.filterBar} onPress={() => setFilterSheetOpen(true)}>
        <Text style={styles.filterBarText}>Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}</Text>
        <Text style={styles.filterBarArrow}>›</Text>
      </Pressable>

      {isPending && (
        <View style={styles.skeletonWrap}>
          <SkeletonRows count={8} />
        </View>
      )}

      {showInitialError && (
        <Pressable style={styles.errorBox} onPress={() => void refetch()}>
          <Text style={styles.errorText}>Couldn't load expenses — tap to retry</Text>
        </Pressable>
      )}

      {showList && (
        <FlatList
          data={expenses}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.5}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onPullToRefresh()} tintColor={textSecondary} />}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>No expenses match these filters</Text>
            </View>
          }
          ListFooterComponent={
            isFetchingNextPage ? (
              <ActivityIndicator style={styles.footerSpinner} color={textSecondary} />
            ) : isError && expenses.length > 0 ? (
              <Pressable style={styles.footerRetry} onPress={() => void fetchNextPage()}>
                <Text style={styles.footerRetryText}>Couldn't load more — tap to retry</Text>
              </Pressable>
            ) : !hasNextPage && expenses.length > 0 ? (
              <Text style={styles.footerEndText}>End of list</Text>
            ) : null
          }
        />
      )}

      <ExpenseFilterSheet visible={filterSheetOpen} filters={filters} onApply={setFilters} onClose={() => setFilterSheetOpen(false)} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  filterBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: border,
  },
  filterBarText: {
    fontSize: 13,
    fontWeight: '600',
    color: textPrimary,
  },
  filterBarArrow: {
    fontSize: 14,
    color: textSecondary,
  },
  addButton: {
    fontSize: 24,
    fontWeight: '400',
    color: textPrimary,
    paddingHorizontal: 8,
  },
  skeletonWrap: {
    paddingHorizontal: 16,
  },
  listContent: {
    paddingHorizontal: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: border,
  },
  rowInfo: {
    flexShrink: 1,
    gap: 2,
    minWidth: 0,
    paddingRight: 12,
  },
  rowCategory: {
    fontSize: 14,
    color: textPrimary,
  },
  rowMeta: {
    fontSize: 11,
    color: textSecondary,
  },
  rowAmount: {
    fontSize: 15,
    fontWeight: '600',
    color: textPrimary,
  },
  errorBox: {
    paddingVertical: 16,
    paddingHorizontal: 16,
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
  footerSpinner: {
    paddingVertical: 20,
  },
  footerRetry: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  footerRetryText: {
    fontSize: 13,
    color: textSecondary,
  },
  footerEndText: {
    paddingVertical: 20,
    textAlign: 'center',
    fontSize: 11,
    color: textSecondary,
  },
})
