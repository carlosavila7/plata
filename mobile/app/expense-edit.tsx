import { useLocalSearchParams, useRouter } from 'expo-router'
import { useQueryClient } from '@tanstack/react-query'
import { StyleSheet, Text, View } from 'react-native'
import { ExpenseForm } from '../src/components/ExpenseForm'
import { findCachedExpense } from '../src/api/expenses'
import { textSecondary } from '../src/theme'

// The API has no GET /expenses/:id — the record pre-filling this form has to
// already be sitting in the list query cache, put there by the list screen
// this route is always pushed from.
export default function EditExpenseScreen() {
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const queryClient = useQueryClient()
  const expense = findCachedExpense(queryClient, id)

  if (!expense) {
    return (
      <View style={styles.missing}>
        <Text style={styles.missingText}>Couldn't find that expense — go back and try again</Text>
      </View>
    )
  }

  return <ExpenseForm expense={expense} onSaved={() => router.back()} onDeleted={() => router.back()} />
}

const styles = StyleSheet.create({
  missing: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  missingText: {
    color: textSecondary,
    fontSize: 14,
    textAlign: 'center',
  },
})
