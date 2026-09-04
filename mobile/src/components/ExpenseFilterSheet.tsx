import { useEffect, useState } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SelectPicker, type SelectOption } from './SelectPicker'
import { DateTimeField } from './DateTimeField'
import { useAccounts, useExpenseCategories, useExpenseSubcategories, usePaymentTypes } from '../api/lookups'
import type { ExpenseFilters } from '../api/expenses'
import { toDateOnlyString } from '../lib/money'
import { humanizeSlug } from '../lib/text'
import { styles as shared, bg, border, textPrimary } from '../theme'

const ALL: SelectOption = { value: '', label: 'All' }

interface Props {
  visible: boolean
  filters: ExpenseFilters
  onApply: (filters: ExpenseFilters) => void
  onClose: () => void
}

// Filters apply across the whole Expense set (server-side, per #6) — this
// sheet only edits a draft locally; nothing takes effect until Apply hands it
// back up, which is what actually re-queries from page one.
export function ExpenseFilterSheet({ visible, filters, onApply, onClose }: Props) {
  const [draft, setDraft] = useState<ExpenseFilters>(filters)

  // Re-seed from the currently-applied filters each time the sheet opens, so
  // reopening after Apply reflects what's active rather than a stale edit
  // left over from before the sheet was last closed without applying.
  useEffect(() => {
    if (visible) setDraft(filters)
  }, [visible, filters])

  const { data: accounts } = useAccounts()
  const { data: categories } = useExpenseCategories()
  const { data: paymentTypes } = usePaymentTypes()
  const selectedCategory = categories?.find(c => c.name === draft.category)
  const { data: subcategories } = useExpenseSubcategories(selectedCategory?.id)

  const categoryOptions: SelectOption[] = [ALL, ...(categories ?? []).map(c => ({ value: c.name, label: humanizeSlug(c.name) }))]
  const subCategoryOptions: SelectOption[] = [ALL, ...(subcategories ?? []).map(s => ({ value: s.name, label: humanizeSlug(s.name) }))]
  const paymentTypeOptions: SelectOption[] = [ALL, ...(paymentTypes ?? []).map(p => ({ value: p.name, label: humanizeSlug(p.name) }))]
  const accountOptions: SelectOption[] = [ALL, ...(accounts ?? []).map(a => ({ value: a.id, label: a.name }))]

  function setField<K extends keyof ExpenseFilters>(key: K) {
    return (value: string) => setDraft(d => ({ ...d, [key]: value || undefined }))
  }

  function setCategory(value: string) {
    // A subcategory picked under the old category doesn't carry over — the
    // two don't compose across categories.
    setDraft(d => ({ ...d, category: value || undefined, subCategory: undefined }))
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <Text style={styles.title}>Filter expenses</Text>

        <ScrollView>
          <SelectPicker label="Category" value={draft.category ?? ''} options={categoryOptions} onChange={setCategory} placeholder="All" />
          <SelectPicker
            label="Subcategory"
            value={draft.subCategory ?? ''}
            options={subCategoryOptions}
            onChange={setField('subCategory')}
            placeholder="All"
          />
          <SelectPicker
            label="Payment type"
            value={draft.paymentType ?? ''}
            options={paymentTypeOptions}
            onChange={setField('paymentType')}
            placeholder="All"
          />
          <SelectPicker
            label="Account"
            value={draft.accountId ?? ''}
            options={accountOptions}
            onChange={setField('accountId')}
            placeholder="All"
          />
          <DateTimeField
            label="From"
            mode="date"
            value={draft.dateFrom ? new Date(`${draft.dateFrom}T00:00:00`) : null}
            onChange={d => setDraft(prev => ({ ...prev, dateFrom: toDateOnlyString(d) }))}
            onClear={() => setDraft(prev => ({ ...prev, dateFrom: undefined }))}
            placeholder="Any"
          />
          <DateTimeField
            label="To"
            mode="date"
            value={draft.dateTo ? new Date(`${draft.dateTo}T00:00:00`) : null}
            onChange={d => setDraft(prev => ({ ...prev, dateTo: toDateOnlyString(d) }))}
            onClear={() => setDraft(prev => ({ ...prev, dateTo: undefined }))}
            placeholder="Any"
          />
        </ScrollView>

        <View style={styles.actions}>
          <Pressable style={[shared.btnSecondary, styles.actionBtn]} onPress={() => setDraft({})}>
            <Text style={shared.btnSecondaryText}>Clear</Text>
          </Pressable>
          <Pressable
            style={[shared.btnPrimary, styles.actionBtn]}
            onPress={() => {
              onApply(draft)
              onClose()
            }}
          >
            <Text style={shared.btnPrimaryText}>Apply</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
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
    maxHeight: '85%',
    backgroundColor: bg,
    borderTopWidth: 1,
    borderTopColor: border,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    color: textPrimary,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 16,
    backgroundColor: bg,
  },
  actionBtn: {
    flex: 1,
  },
})
