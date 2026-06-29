import { useEffect, useRef, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { getAll, upsert, getRecentBoughtAt } from '../../db/stores'
import { enqueue } from '../../sync/queue'
import { MoneyInput } from '../../components/MoneyInput'
import { DatePicker } from '../../components/DatePicker'
import { TimePicker } from '../../components/TimePicker'
import { SelectPicker } from '../../components/SelectPicker'
import { FieldRow, rowInput, chipGroupLabel } from '../../components/FieldRow'
import { bg, border, textPrimary, textSecondary, btnPrimary, btnSecondary, inactive } from '../../theme'

const VOUCHER_ACCOUNT_TYPES = new Set(['voucher', 'food_voucher', 'meal_voucher'])

interface Props { onClose: () => void; initialData?: Record<string, unknown> }

export function ExpenseForm({ onClose, initialData }: Props) {
  const [accounts, setAccounts] = useState<Record<string, unknown>[]>([])
  const [statements, setStatements] = useState<Record<string, unknown>[]>([])
  const [cardById, setCardById] = useState<Record<string, Record<string, unknown>>>({})
  const [categories, setCategories] = useState<Record<string, unknown>[]>([])
  const [allSubcategories, setAllSubcategories] = useState<Record<string, unknown>[]>([])
  const [paymentTypesList, setPaymentTypesList] = useState<Record<string, unknown>[]>([])
  const [cities, setCities] = useState<Record<string, unknown>[]>([])
  const [boughtAtSuggestions, setBoughtAtSuggestions] = useState<string[]>([])
  const [boughtAtOther, setBoughtAtOther] = useState(false)
  const isFirstBoughtAtEffect = useRef(true)
  const initBrt = initialData
    ? new Date(new Date(initialData.occurredAt as string).getTime() - 3 * 60 * 60 * 1000).toISOString()
    : new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()
  const initFd = (initialData?.fuelDetails ?? null) as { fullTank?: boolean; pricePerLiterCents?: number; odometerKm?: number } | null
  const [form, setForm] = useState({
    date: initBrt.slice(0, 10),
    time: initBrt.slice(11, 16),
    category: (initialData?.category as string) ?? '',
    subCategory: (initialData?.subCategory as string) ?? '',
    costCents: (initialData?.costCents as number) ?? 0,
    accountId: (initialData?.accountId as string) ?? '',
    paymentType: (initialData?.paymentType as string) ?? '',
    creditCardStatementId: (initialData?.creditCardStatementId as string) ?? '',
    city: (initialData?.city as string) ?? '',
    person: (initialData?.person as string) ?? 'Carlos',
    boughtAt: (initialData?.boughtAt as string) ?? '',
    description: (initialData?.description as string) ?? '',
    isRecurrent: (initialData?.isRecurrent as boolean) ?? false,
    isDelivery: (initialData?.isDelivery as boolean) ?? false,
    fuelFullTank: initFd?.fullTank ?? false,
    fuelPriceCents: initFd?.pricePerLiterCents ?? 0,
    odometerCents: initFd?.odometerKm != null ? Math.round(initFd.odometerKm * 100) : 0,
  })

  useEffect(() => {
    Promise.all([
      getAll('accounts'),
      getAll('creditCardStatements'),
      getAll('expenseCategories'),
      getAll('expenseSubcategories'),
      getAll('paymentTypes'),
      getAll('cities'),
      getAll('creditCards'),
    ]).then(([accts, stmts, cats, subs, pts, cityList, cards]) => {
      setAccounts(accts)
      setStatements(stmts)
      setCardById(Object.fromEntries(cards.map(c => [c.id as string, c])))
      setCategories(cats)
      setAllSubcategories(subs)
      setPaymentTypesList(pts)
      setCities(cityList)

      const foodCat = cats.find(c => c.name === 'food') ?? cats[0]
      const catSubs = subs.filter(s => s.categoryId === foodCat?.id)
      const defaultSub = foodCat?.name === 'food'
        ? ((catSubs.find(s => s.name === 'bakery')?.name ?? catSubs[0]?.name) as string ?? '')
        : (catSubs[0]?.name as string ?? '')

      const voucherAcct = accts.find(a => a.name === 'Food Voucher')
      const bbAcct = accts.find(a => a.name === 'Banco do Brasil')
      const foodVoucherPt = pts.find(p => p.name === 'food_voucher')
      const firstNonVoucher = pts.find(p => !p.isVoucher)

      const brasilia = cityList.find(c => c.name === 'Brasília')

      if (!initialData) {
        setForm(f => ({
          ...f,
          category: (foodCat?.name as string) ?? '',
          subCategory: defaultSub,
          accountId: foodCat?.name === 'food'
            ? ((voucherAcct?.id as string) ?? '')
            : ((bbAcct?.id as string) ?? ''),
          paymentType: foodCat?.name === 'food'
            ? ((foodVoucherPt?.name as string) ?? (firstNonVoucher?.name as string) ?? '')
            : ((firstNonVoucher?.name as string) ?? ''),
          city: (brasilia?.name as string) ?? '',
        }))
      }
    }).catch((err) => console.error('[ExpenseForm] failed to load form data:', err))
  }, [])

  useEffect(() => {
    if (!form.category || !form.subCategory) return
    if (isFirstBoughtAtEffect.current && initialData) {
      isFirstBoughtAtEffect.current = false
      getRecentBoughtAt(form.category, form.subCategory).then(setBoughtAtSuggestions)
      return
    }
    isFirstBoughtAtEffect.current = false
    set('boughtAt', '')
    setBoughtAtOther(false)
    getRecentBoughtAt(form.category, form.subCategory).then(setBoughtAtSuggestions)
  }, [form.category, form.subCategory])

  function set(k: string, v: unknown) { setForm((f) => ({ ...f, [k]: v })) }

  function setCategory(cat: string) {
    const catEntity = categories.find(c => c.name === cat)
    const subs = allSubcategories.filter(s => s.categoryId === catEntity?.id)

    let defaultSub: string
    if (cat === 'food') {
      defaultSub = (subs.find(s => s.name === 'bakery')?.name ?? subs[0]?.name ?? '') as string
    } else if (cat === 'vehicle') {
      defaultSub = (subs.find(s => s.name === 'toll')?.name ?? subs[0]?.name ?? '') as string
    } else {
      defaultSub = (subs[0]?.name ?? '') as string
    }

    const extraFields: Record<string, unknown> = {}
    if (cat === 'food') {
      const voucherAcct = accounts.find(a => a.name === 'Food Voucher')
      const foodVoucherPt = paymentTypesList.find(p => p.name === 'food_voucher')
      if (voucherAcct) extraFields.accountId = voucherAcct.id
      if (foodVoucherPt) extraFields.paymentType = foodVoucherPt.name
    } else {
      const bbAcct = accounts.find(a => a.name === 'Banco do Brasil')
      const firstNonVoucher = paymentTypesList.find(p => !p.isVoucher)
      if (bbAcct) extraFields.accountId = bbAcct.id
      if (firstNonVoucher) extraFields.paymentType = firstNonVoucher.name
    }

    setForm(f => ({ ...f, category: cat, subCategory: defaultSub, ...extraFields }))
  }

  const selectedAccount = accounts.find((a) => a.id === form.accountId)
  const isVoucherAccount = VOUCHER_ACCOUNT_TYPES.has(selectedAccount?.type as string)
  const voucherPaymentNames = paymentTypesList.filter(p => p.isVoucher as boolean).map(p => p.name as string)
  const availablePayments = isVoucherAccount
    ? paymentTypesList.filter(p => p.isVoucher as boolean)
    : paymentTypesList.filter(p => !p.isVoucher as boolean)

  function setAccountId(id: string) {
    const acct = accounts.find((a) => a.id === id)
    const isVoucher = VOUCHER_ACCOUNT_TYPES.has(acct?.type as string)
    let payment = form.paymentType
    if (isVoucher && !voucherPaymentNames.includes(payment))
      payment = (paymentTypesList.find(p => p.isVoucher as boolean)?.name as string) ?? payment
    else if (!isVoucher && voucherPaymentNames.includes(payment))
      payment = (paymentTypesList.find(p => !p.isVoucher as boolean)?.name as string) ?? payment
    setForm((f) => ({ ...f, accountId: id, paymentType: payment, creditCardStatementId: '' }))
  }

  const isFuel = form.category === 'vehicle' && form.subCategory === 'fuel'
  const currentCategory = categories.find(c => c.name === form.category)
  const filteredSubcategories = allSubcategories.filter(s => s.categoryId === currentCategory?.id)

  // Statements selectable on a credit expense: open ones belonging to a card whose
  // bank is the selected account. (Card.bank stores the account name.)
  const selectedAccountName = accounts.find(a => a.id === form.accountId)?.name as string | undefined
  const openStatements = statements
    .filter(s =>
      s.status === 'open' &&
      (cardById[s.creditCardId as string]?.bank as string) === selectedAccountName)
    .sort((a, b) => new Date(b.closeDate as string).getTime() - new Date(a.closeDate as string).getTime())

  function setPaymentType(pt: string) {
    // Default to the most recent open statement for the selected account, if any.
    const statementId = pt === 'credit' ? ((openStatements[0]?.id as string) ?? '') : ''
    setForm(f => ({ ...f, paymentType: pt, creditCardStatementId: statementId }))
  }

  const canSave =
    form.costCents > 0 &&
    !(form.paymentType === 'credit' && !form.creditCardStatementId) &&
    !(form.category === 'other' && form.subCategory === 'other' && !form.description.trim())

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSave) return
    const now = new Date().toISOString()
    const recordId = initialData ? (initialData.id as string) : uuidv4()
    const { fuelFullTank, fuelPriceCents, odometerCents, isDelivery, date, time, ...formRest } = form
    const record = {
      ...formRest,
      id: recordId,
      occurredAt: new Date(`${date}T${time}`).toISOString(),
      createdAt: initialData ? (initialData.createdAt as string) : now,
      updatedAt: now,
      city: form.city || null,
      person: form.person || null,
      creditCardStatementId: form.paymentType === 'credit' ? form.creditCardStatementId : null,
      isDelivery: form.category === 'food' ? isDelivery : null,
      fuelDetails: isFuel
        ? { fullTank: fuelFullTank, pricePerLiterCents: fuelPriceCents, odometerKm: odometerCents > 0 ? odometerCents / 100 : null }
        : null,
    }
    await upsert('expenses', record)
    await enqueue('expenses', recordId, initialData ? 'update' : 'create', record)
    onClose()
  }

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

      <DatePicker label="Date" value={form.date} onChange={(v) => set('date', v)} />

      <TimePicker label="Time" value={form.time} onChange={(v) => set('time', v)} />

      <SelectPicker
        label="Category"
        value={form.category}
        options={categories.map((c) => ({ value: c.name as string, label: c.name as string }))}
        onChange={setCategory}
      />

      <SelectPicker
        label="Subcategory"
        value={form.subCategory}
        options={filteredSubcategories.map((s) => ({ value: s.name as string, label: s.name as string }))}
        onChange={(v) => set('subCategory', v)}
      />

      <MoneyInput label="Amount" valueCents={form.costCents} onChange={(c) => set('costCents', c)} />

      {form.category === 'food' && (
        <FieldRow label="Delivery">
          <Toggle value={form.isDelivery} onChange={(v) => set('isDelivery', v)} />
        </FieldRow>
      )}

      {isFuel && (
        <>
          <FieldRow label="Full fuel">
            <Toggle value={form.fuelFullTank} onChange={(v) => set('fuelFullTank', v)} />
          </FieldRow>
          <MoneyInput label="Price / liter" valueCents={form.fuelPriceCents} onChange={(c) => set('fuelPriceCents', c)} />
          <MoneyInput label="Odometer (km)" valueCents={form.odometerCents} onChange={(c) => set('odometerCents', c)} />
        </>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 24 }}>
        <span style={chipGroupLabel}>Account</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {accounts.map((a) => {
            const selected = form.accountId === (a.id as string)
            return (
              <button key={a.id as string} type="button" onClick={() => setAccountId(a.id as string)} style={chipStyle(selected)}>
                {a.name as string}
              </button>
            )
          })}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 24 }}>
        <span style={chipGroupLabel}>Payment</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {availablePayments.map((p) => {
            const selected = form.paymentType === (p.name as string)
            return (
              <button key={p.id as string} type="button" onClick={() => setPaymentType(p.name as string)} style={chipStyle(selected)}>
                {p.name as string}
              </button>
            )
          })}
        </div>
      </div>

      {form.paymentType === 'credit' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 24 }}>
          <span style={chipGroupLabel}>Statement</span>
          {openStatements.length === 0 ? (
            <span style={{ fontSize: 14, color: textSecondary }}>No open statements for this account.</span>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {openStatements.map((s) => {
                const card = cardById[s.creditCardId as string]
                const month = new Date(s.closeDate as string)
                  .toLocaleDateString('pt-BR', { month: 'short' })
                  .replace('.', '')
                  .toUpperCase()
                const network = (card?.network as string) ?? ''
                const nickname = (card?.nickname as string) ?? 'Card'
                const selected = form.creditCardStatementId === (s.id as string)
                return (
                  <button key={s.id as string} type="button" onClick={() => set('creditCardStatementId', s.id as string)} style={chipStyle(selected)}>
                    {`${month} | ${network} ${nickname}`}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {boughtAtSuggestions.length > 0 && !boughtAtOther ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 24 }}>
          <span style={chipGroupLabel}>Bought at</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {boughtAtSuggestions.map(s => (
              <button key={s} type="button" onClick={() => set('boughtAt', s)} style={chipStyle(form.boughtAt === s)}>
                {s}
              </button>
            ))}
            <button type="button" onClick={() => { setBoughtAtOther(true); set('boughtAt', '') }} style={chipStyle(false)}>
              Other
            </button>
          </div>
        </div>
      ) : (
        <FieldRow label="Bought at" alt>
          <input value={form.boughtAt} onChange={(e) => set('boughtAt', e.target.value)} style={rowInput} placeholder="optional" autoFocus={boughtAtOther} />
        </FieldRow>
      )}

      <FieldRow label="Description" alt>
        <input value={form.description} onChange={(e) => set('description', e.target.value)} style={rowInput} placeholder="optional" />
      </FieldRow>

      {cities.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 24 }}>
          <span style={chipGroupLabel}>City</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {cities.map((c) => {
              const selected = form.city === (c.name as string)
              return (
                <button key={c.id as string} type="button"
                  onClick={() => set('city', selected ? '' : (c.name as string))}
                  style={chipStyle(selected)}>
                  {c.name as string}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 24 }}>
        <span style={chipGroupLabel}>Person</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {['Carlos', 'Rayane', 'Carlos + Rayane', 'Other'].map(name => (
            <button key={name} type="button"
              onClick={() => set('person', name)}
              style={chipStyle(form.person === name)}>
              {name}
            </button>
          ))}
        </div>
      </div>

      <FieldRow label="Recurrent">
        <Toggle value={form.isRecurrent} onChange={(v) => set('isRecurrent', v)} />
      </FieldRow>

      <div style={{ display: 'flex', gap: 8, marginTop: 32 }}>
        <button type="button" onClick={onClose} style={{ ...btnSecondary, flex: 1, minHeight: 52 }}>Cancel</button>
        <button
          type="submit"
          disabled={!canSave}
          style={{ ...btnPrimary, flex: 1, minHeight: 52, ...(canSave ? {} : { background: inactive, color: textSecondary, cursor: 'not-allowed' }) }}
        >
          Save
        </button>
      </div>
    </form>
  )
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <span
      role="switch"
      aria-checked={value}
      tabIndex={0}
      onClick={() => onChange(!value)}
      onKeyDown={(e) => (e.key === ' ' || e.key === 'Enter') && onChange(!value)}
      style={{ position: 'relative', width: 40, height: 22, borderRadius: 0, flexShrink: 0, cursor: 'pointer', background: value ? '#ffffff' : '#333333', border: '1px solid #555555' }}
    >
      <span style={{ position: 'absolute', top: 2, width: 16, height: 16, borderRadius: 0, background: value ? '#000000' : '#888888', transform: value ? 'translateX(20px)' : 'translateX(2px)' }} />
    </span>
  )
}

function chipStyle(selected: boolean): React.CSSProperties {
  return {
    padding: '10px 16px', borderRadius: 0, fontSize: 15, fontWeight: selected ? 600 : 400,
    minHeight: 44, cursor: 'pointer',
    border: `1px solid ${selected ? textPrimary : border}`,
    background: selected ? textPrimary : 'transparent',
    color: selected ? bg : textSecondary,
  }
}

