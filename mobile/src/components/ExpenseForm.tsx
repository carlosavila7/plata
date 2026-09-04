import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { DateTimeField } from './DateTimeField'
import { FieldRow } from './FieldRow'
import { MoneyInput } from './MoneyInput'
import { SelectPicker, type SelectOption } from './SelectPicker'
import { Toggle } from './Toggle'
import { useAccounts, useCreditCards, useCreditCardStatements, useExpenseCategories, useExpenseSubcategories, usePaymentTypes } from '../api/lookups'
import { useCreateExpense, type ExpenseInput } from '../api/expenses'
import { formatSnapshotDate } from '../lib/money'
import { humanizeSlug } from '../lib/text'
import { styles as theme, textPrimary, textSecondary } from '../theme'

const VOUCHER_ACCOUNT_TYPES = new Set(['food_voucher', 'meal_voucher'])

interface Props {
  onSaved: () => void
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

export function ExpenseForm({ onSaved }: Props) {
  const { data: accounts } = useAccounts()
  const { data: categories } = useExpenseCategories()
  const { data: paymentTypes } = usePaymentTypes()
  const { data: creditCards } = useCreditCards()
  const { data: statements } = useCreditCardStatements()
  const createExpense = useCreateExpense()

  const [occurredAt, setOccurredAt] = useState(new Date())
  const [category, setCategory] = useState('')
  const [subCategory, setSubCategory] = useState('')
  const [costCents, setCostCents] = useState(0)
  const [accountId, setAccountId] = useState('')
  const [paymentType, setPaymentType] = useState('')
  const [creditCardStatementId, setCreditCardStatementId] = useState('')
  const [boughtAt, setBoughtAt] = useState('')
  const [city, setCity] = useState('')
  const [description, setDescription] = useState('')
  const [groupingTag, setGroupingTag] = useState('')
  const [isRecurrent, setIsRecurrent] = useState(false)
  const [person, setPerson] = useState('')
  const [isDelivery, setIsDelivery] = useState(false)
  const [fuelFullTank, setFuelFullTank] = useState(false)
  const [fuelPriceCents, setFuelPriceCents] = useState(0)
  const [odometerCents, setOdometerCents] = useState(0)

  const selectedCategory = categories?.find(c => c.name === category)
  const { data: subcategories } = useExpenseSubcategories(selectedCategory?.id)

  // Seeds the form's initial selections once, the first time every lookup it
  // needs has arrived — after that, field-level handlers own the choices.
  const initializedRef = useRef(false)
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

  function handlePaymentTypeChange(pt: string) {
    setPaymentType(pt)
    setCreditCardStatementId(pt === 'credit' ? (openStatements[0]?.id ?? '') : '')
  }

  const canSave =
    costCents > 0 &&
    !!category && !!subCategory && !!accountId && !!paymentType &&
    !(paymentType === 'credit' && !creditCardStatementId)

  const failure = createExpense.error as ApiFailure | null
  const generalError = failure ? (failure.body?.detail ?? failure.message ?? 'Something went wrong.') : null
  const fieldError = (key: string) => failure?.body?.errors?.fieldErrors?.[key]?.[0]

  async function handleSave() {
    if (!canSave || createExpense.isPending) return
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
      await createExpense.mutateAsync(body)
      onSaved()
    } catch {
      // Surfaced below via createExpense.error — form state is left untouched
      // so the user can retry without retyping anything (see ADR-0001).
    }
  }

  const categoryOptions: SelectOption[] = categories.map(c => ({ value: c.name, label: humanizeSlug(c.name) }))
  const subCategoryOptions: SelectOption[] = (subcategories ?? []).map(s => ({ value: s.name, label: humanizeSlug(s.name) }))
  const accountOptions: SelectOption[] = accounts.map(a => ({ value: a.id, label: a.name }))
  const paymentTypeOptions: SelectOption[] = availablePaymentTypes.map(p => ({ value: p.name, label: humanizeSlug(p.name) }))
  const statementOptions: SelectOption[] = openStatements.map(s => {
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
          disabled={!canSave || createExpense.isPending}
          onPress={() => void handleSave()}
        >
          <Text style={theme.btnPrimaryText}>{createExpense.isPending ? 'Saving…' : createExpense.isError ? 'Retry' : 'Save'}</Text>
        </Pressable>
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
})
