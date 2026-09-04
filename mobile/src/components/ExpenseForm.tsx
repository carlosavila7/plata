import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { DateTimeField } from './DateTimeField'
import { FieldRow } from './FieldRow'
import { MoneyInput } from './MoneyInput'
import { SelectPicker, type SelectOption } from './SelectPicker'
import { Toggle } from './Toggle'
import { useAccounts, useCreditCards, useCreditCardStatements, useExpenseCategories, useExpenseSubcategories, usePaymentTypes } from '../api/lookups'
import { useCreateExpense, useDeleteExpense, useUpdateExpense, type Expense, type ExpenseInput } from '../api/expenses'
import { formatSnapshotDate } from '../lib/money'
import { humanizeSlug } from '../lib/text'
import { styles as theme, textPrimary, textSecondary } from '../theme'

const VOUCHER_ACCOUNT_TYPES = new Set(['food_voucher', 'meal_voucher'])

interface Props {
  expense?: Expense
  onSaved: () => void
  onDeleted?: () => void
}

function withDatePart(base: Date, picked: Date): Date {
  const d = new Date(base)
  d.setFullYear(picked.getFullYear(), picked.getMonth(), picked.getDate())
  return d
}

function withTimePart(base: Date, picked: Date): Date {
  const d = new Date(base)
  d.setHours(picked.getHours(), picked.getMinutes(), 0, 0)
  return d
}

interface ApiFailure {
  status?: number
  message?: string
  body?: { detail?: string; errors?: { fieldErrors?: Record<string, string[]> } }
}

export function ExpenseForm({ expense, onSaved, onDeleted }: Props) {
  const { data: accounts } = useAccounts()
  const { data: categories } = useExpenseCategories()
  const { data: paymentTypes } = usePaymentTypes()
  const { data: creditCards } = useCreditCards()
  const { data: statements } = useCreditCardStatements()
  const createExpense = useCreateExpense()
  const updateExpense = useUpdateExpense(expense?.id ?? '')
  const deleteExpense = useDeleteExpense()
  const saveMutation = expense ? updateExpense : createExpense

  const [occurredAt, setOccurredAt] = useState(() => (expense ? new Date(expense.occurredAt) : new Date()))
  const [category, setCategory] = useState(expense?.category ?? '')
  const [subCategory, setSubCategory] = useState(expense?.subCategory ?? '')
  const [costCents, setCostCents] = useState(expense?.costCents ?? 0)
  const [accountId, setAccountId] = useState(expense?.accountId ?? '')
  const [paymentType, setPaymentType] = useState(expense?.paymentType ?? '')
  const [creditCardStatementId, setCreditCardStatementId] = useState(expense?.creditCardStatementId ?? '')
  const [boughtAt, setBoughtAt] = useState(expense?.boughtAt ?? '')
  const [city, setCity] = useState(expense?.city ?? '')
  const [description, setDescription] = useState(expense?.description ?? '')
  const [groupingTag, setGroupingTag] = useState(expense?.groupingTag ?? '')
  const [isRecurrent, setIsRecurrent] = useState(expense?.isRecurrent ?? false)
  const [person, setPerson] = useState(expense?.person ?? '')
  const [isDelivery, setIsDelivery] = useState(expense?.isDelivery ?? false)
  const [fuelFullTank, setFuelFullTank] = useState(expense?.fuelDetails?.fullTank ?? false)
  const [fuelPriceCents, setFuelPriceCents] = useState(expense?.fuelDetails?.pricePerLiterCents ?? 0)
  const [odometerCents, setOdometerCents] = useState(
    expense?.fuelDetails?.odometerKm != null ? Math.round(expense.fuelDetails.odometerKm * 100) : 0
  )
  const [confirmDelete, setConfirmDelete] = useState(false)

  const selectedCategory = categories?.find(c => c.name === category)
  const { data: subcategories } = useExpenseSubcategories(selectedCategory?.id)

  // Seeds the form's initial selections once, the first time every lookup it
  // needs has arrived — after that, field-level handlers own the choices.
  // Editing starts every field from the existing record instead, so this
  // never runs there.
  const initializedRef = useRef(!!expense)
  useEffect(() => {
    if (initializedRef.current || !accounts || !categories || !paymentTypes) return
    initializedRef.current = true
    if (accounts.length > 0) handleAccountChange(accounts[0].id)
    if (categories.length > 0) setCategory(categories[0].name)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts, categories, paymentTypes])

  // Subcategories are fetched scoped to the chosen category, so this both
  // seeds the initial subcategory and resets it whenever category changes.
  useEffect(() => {
    if (!category || !subcategories || subcategories.length === 0) return
    if (!subcategories.some(s => s.name === subCategory)) {
      setSubCategory(subcategories[0].name)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, subcategories])

  function handleCategoryChange(cat: string) {
    setCategory(cat)
    if (cat !== 'food') setIsDelivery(false)
  }

  function handleAccountChange(id: string) {
    setAccountId(id)
    const acct = accounts?.find(a => a.id === id)
    const forced = acct && VOUCHER_ACCOUNT_TYPES.has(acct.type) ? acct.type : null
    if (forced) {
      setPaymentType(forced)
      setCreditCardStatementId('')
      return
    }
    const nonVoucher = (paymentTypes ?? []).filter(p => !p.isVoucher)
    setPaymentType(prev => (nonVoucher.some(p => p.name === prev) ? prev : (nonVoucher[0]?.name ?? '')))
    setCreditCardStatementId('')
  }

  if (!accounts || !categories || !paymentTypes) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={textPrimary} />
      </View>
    )
  }

  const selectedAccount = accounts.find(a => a.id === accountId)
  const forcedPaymentType = selectedAccount && VOUCHER_ACCOUNT_TYPES.has(selectedAccount.type) ? selectedAccount.type : null
  const availablePaymentTypes = paymentTypes.filter(p => !p.isVoucher)
  const isFuel = category === 'vehicle' && subCategory === 'fuel'

  const cardById = new Map((creditCards ?? []).map(c => [c.id, c]))
  const openStatements = (statements ?? [])
    .filter(s => s.status === 'open' && selectedAccount && cardById.get(s.creditCardId ?? '')?.bank === selectedAccount.name)
    .sort((a, b) => b.closeDate.localeCompare(a.closeDate))
  // An edited expense can be linked to a statement that has since closed —
  // that statement won't be in openStatements, but the picker still needs to
  // display and keep it unless the user actively picks a different one.
  const assignedStatement = creditCardStatementId ? (statements ?? []).find(s => s.id === creditCardStatementId) : undefined
  const statementChoices =
    assignedStatement && !openStatements.some(s => s.id === assignedStatement.id) ? [assignedStatement, ...openStatements] : openStatements

  function handlePaymentTypeChange(pt: string) {
    setPaymentType(pt)
    setCreditCardStatementId(pt === 'credit' ? (openStatements[0]?.id ?? '') : '')
  }

  const canSave =
    costCents > 0 &&
    !!category && !!subCategory && !!accountId && !!paymentType &&
    !(paymentType === 'credit' && !creditCardStatementId)

  const failure = saveMutation.error as ApiFailure | null
  const generalError = failure ? (failure.body?.detail ?? failure.message ?? 'Something went wrong.') : null
  const fieldError = (key: string) => failure?.body?.errors?.fieldErrors?.[key]?.[0]

  const deleteFailure = deleteExpense.error as ApiFailure | null
  const deleteError = deleteFailure ? (deleteFailure.body?.detail ?? deleteFailure.message ?? 'Something went wrong.') : null

  async function handleSave() {
    if (!canSave || saveMutation.isPending) return
    const body: ExpenseInput = {
      occurredAt: occurredAt.toISOString(),
      category,
      subCategory,
      costCents,
      accountId,
      paymentType,
      creditCardStatementId: paymentType === 'credit' ? creditCardStatementId : null,
      boughtAt: boughtAt.trim() || null,
      city: city.trim() || null,
      description: description.trim() || null,
      groupingTag: groupingTag.trim() || null,
      isRecurrent,
      person: person.trim() || null,
      isDelivery: category === 'food' ? isDelivery : null,
      fuelDetails: isFuel
        ? { fullTank: fuelFullTank, odometerKm: odometerCents > 0 ? odometerCents / 100 : null, pricePerLiterCents: fuelPriceCents }
        : null,
    }
    try {
      await saveMutation.mutateAsync(body)
      onSaved()
    } catch {
      // Surfaced below via saveMutation.error — form state is left untouched
      // so the user can retry without retyping anything (see ADR-0001).
    }
  }

  async function handleDelete() {
    if (!expense || deleteExpense.isPending) return
    try {
      await deleteExpense.mutateAsync(expense.id)
      onDeleted?.()
    } catch {
      // Surfaced below via deleteExpense.error — confirmDelete stays true so
      // the Confirm/Cancel pair is still there to retry (see ADR-0001).
    }
  }

  const categoryOptions: SelectOption[] = categories.map(c => ({ value: c.name, label: humanizeSlug(c.name) }))
  const subCategoryOptions: SelectOption[] = (subcategories ?? []).map(s => ({ value: s.name, label: humanizeSlug(s.name) }))
  const accountOptions: SelectOption[] = accounts.map(a => ({ value: a.id, label: a.name }))
  const paymentTypeOptions: SelectOption[] = availablePaymentTypes.map(p => ({ value: p.name, label: humanizeSlug(p.name) }))
  const statementOptions: SelectOption[] = statementChoices.map(s => {
    const card = cardById.get(s.creditCardId ?? '')
    return { value: s.id, label: `${formatSnapshotDate(s.closeDate)} · ${card?.network ?? ''} ${card?.nickname ?? 'Card'}` }
  })

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <DateTimeField label="Date" mode="date" value={occurredAt} onChange={d => setOccurredAt(prev => withDatePart(prev, d))} />
        <DateTimeField label="Time" mode="time" value={occurredAt} onChange={d => setOccurredAt(prev => withTimePart(prev, d))} />

        <SelectPicker label="Category" value={category} options={categoryOptions} onChange={handleCategoryChange} />
        {fieldError('category') && <Text style={styles.error}>{fieldError('category')}</Text>}

        <SelectPicker label="Subcategory" value={subCategory} options={subCategoryOptions} onChange={setSubCategory} />
        {fieldError('subCategory') && <Text style={styles.error}>{fieldError('subCategory')}</Text>}

        <MoneyInput label="Amount" valueCents={costCents} onChange={setCostCents} />
        {fieldError('costCents') && <Text style={styles.error}>{fieldError('costCents')}</Text>}

        {category === 'food' && (
          <FieldRow label="Delivery">
            <Toggle value={isDelivery} onChange={setIsDelivery} />
          </FieldRow>
        )}

        {isFuel && (
          <>
            <FieldRow label="Full tank">
              <Toggle value={fuelFullTank} onChange={setFuelFullTank} />
            </FieldRow>
            <MoneyInput label="Price / liter" valueCents={fuelPriceCents} onChange={setFuelPriceCents} />
            {/* Odometer is km, not money — MoneyInput is reused here purely for its
                two-decimal-digit entry (odometerCents / 100 → fractional km on submit),
                same trick the PWA form uses for this same field. */}
            <MoneyInput label="Odometer (km)" valueCents={odometerCents} onChange={setOdometerCents} />
          </>
        )}
        {fieldError('fuelDetails') && <Text style={styles.error}>{fieldError('fuelDetails')}</Text>}

        <SelectPicker label="Account" value={accountId} options={accountOptions} onChange={handleAccountChange} />
        {fieldError('accountId') && <Text style={styles.error}>{fieldError('accountId')}</Text>}

        {forcedPaymentType ? (
          <FieldRow label="Payment">
            <Text style={styles.staticValue}>{humanizeSlug(forcedPaymentType)}</Text>
          </FieldRow>
        ) : (
          <SelectPicker label="Payment" value={paymentType} options={paymentTypeOptions} onChange={handlePaymentTypeChange} />
        )}
        {fieldError('paymentType') && <Text style={styles.error}>{fieldError('paymentType')}</Text>}

        {paymentType === 'credit' && (
          <>
            {statementOptions.length === 0 ? (
              <FieldRow label="Statement">
                <Text style={styles.placeholderValue}>No open statements</Text>
              </FieldRow>
            ) : (
              <SelectPicker label="Statement" value={creditCardStatementId} options={statementOptions} onChange={setCreditCardStatementId} />
            )}
            {fieldError('creditCardStatementId') && <Text style={styles.error}>{fieldError('creditCardStatementId')}</Text>}
          </>
        )}

        <FieldRow label="Bought at">
          <TextInput value={boughtAt} onChangeText={setBoughtAt} style={theme.rowInput} placeholder="optional" placeholderTextColor={textSecondary} />
        </FieldRow>

        <FieldRow label="City">
          <TextInput value={city} onChangeText={setCity} style={theme.rowInput} placeholder="optional" placeholderTextColor={textSecondary} />
        </FieldRow>

        <FieldRow label="Description">
          <TextInput value={description} onChangeText={setDescription} style={theme.rowInput} placeholder="optional" placeholderTextColor={textSecondary} />
        </FieldRow>

        <FieldRow label="Grouping tag">
          <TextInput value={groupingTag} onChangeText={setGroupingTag} style={theme.rowInput} placeholder="optional" placeholderTextColor={textSecondary} />
        </FieldRow>

        <FieldRow label="Person">
          <TextInput value={person} onChangeText={setPerson} style={theme.rowInput} placeholder="optional" placeholderTextColor={textSecondary} />
        </FieldRow>

        <FieldRow label="Recurrent">
          <Toggle value={isRecurrent} onChange={setIsRecurrent} />
        </FieldRow>

        {generalError && <Text style={[styles.error, styles.generalError]}>{generalError}</Text>}

        <Pressable
          style={[theme.btnPrimary, styles.saveBtn, !canSave && styles.saveBtnDisabled]}
          disabled={!canSave || saveMutation.isPending}
          onPress={() => void handleSave()}
        >
          <Text style={theme.btnPrimaryText}>{saveMutation.isPending ? 'Saving…' : saveMutation.isError ? 'Retry' : 'Save'}</Text>
        </Pressable>

        {expense && (
          <View style={styles.deleteSection}>
            {confirmDelete ? (
              <View style={styles.deleteRow}>
                <Pressable style={[theme.btnSecondary, styles.deleteBtn]} disabled={deleteExpense.isPending} onPress={() => void handleDelete()}>
                  <Text style={theme.btnSecondaryText}>{deleteExpense.isPending ? 'Deleting…' : 'Confirm delete'}</Text>
                </Pressable>
                <Pressable style={[theme.btnPrimary, styles.deleteBtn]} disabled={deleteExpense.isPending} onPress={() => setConfirmDelete(false)}>
                  <Text style={theme.btnPrimaryText}>Cancel</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable style={theme.btnSecondary} onPress={() => setConfirmDelete(true)}>
                <Text style={theme.btnSecondaryText}>Delete</Text>
              </Pressable>
            )}
            {deleteError && <Text style={[styles.error, styles.generalError]}>{deleteError}</Text>}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    padding: 16,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  staticValue: {
    color: textPrimary,
    fontSize: 15,
  },
  placeholderValue: {
    color: textSecondary,
    fontSize: 15,
  },
  error: {
    color: '#ff6b6b',
    fontSize: 12,
    marginTop: -8,
    marginBottom: 8,
  },
  generalError: {
    fontSize: 13,
    marginTop: 8,
    marginBottom: 0,
    textAlign: 'center',
  },
  saveBtn: {
    marginTop: 24,
  },
  saveBtnDisabled: {
    opacity: 0.5,
  },
  deleteSection: {
    marginTop: 12,
  },
  deleteRow: {
    flexDirection: 'row',
    gap: 8,
  },
  deleteBtn: {
    flex: 1,
  },
})
