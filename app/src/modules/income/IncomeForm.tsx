import { useEffect, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { getAll, upsert } from '../../db/stores'
import { enqueue } from '../../sync/queue'
import { MoneyInput } from '../../components/MoneyInput'
import { DatePicker } from '../../components/DatePicker'
import { TimePicker } from '../../components/TimePicker'
import { SelectPicker } from '../../components/SelectPicker'
import { FieldRow, rowInput } from '../../components/FieldRow'
import { btnPrimary, btnSecondary } from '../../theme'

const REASONS = ['salary', 'interest', 'refund', 'deposit', 'self', 'rental', 'other', 'investment_withdrawal', 'plr']
const REASON_OPTIONS = REASONS.map((r) => ({ value: r, label: r }))

interface Props { onClose: () => void; initialData?: Record<string, unknown> }

export function IncomeForm({ onClose, initialData }: Props) {
  const [accounts, setAccounts] = useState<Record<string, unknown>[]>([])
  const initBrt = initialData
    ? new Date(new Date(initialData.occurredAt as string).getTime() - 3 * 60 * 60 * 1000).toISOString()
    : new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()
  const [form, setForm] = useState({
    date: initBrt.slice(0, 10),
    time: initBrt.slice(11, 16),
    reason: (initialData?.reason as string) ?? 'salary',
    amountCents: (initialData?.amountCents as number) ?? 0,
    toAccountId: (initialData?.toAccountId as string) ?? '',
    fromAccountId: (initialData?.fromAccountId as string) ?? '',
    description: (initialData?.description as string) ?? '',
  })

  useEffect(() => { getAll('accounts').then(setAccounts) }, [])

  function set(k: string, v: unknown) { setForm((f) => ({ ...f, [k]: v })) }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const now = new Date().toISOString()
    const recordId = initialData ? (initialData.id as string) : uuidv4()
    const { date, time, ...formRest } = form
    const record = {
      ...formRest,
      id: recordId,
      occurredAt: new Date(`${date}T${time}`).toISOString(),
      fromAccountId: form.fromAccountId || null,
      createdAt: initialData ? (initialData.createdAt as string) : now,
      updatedAt: now,
      deletedAt: null,
    }
    await upsert('income', record)
    await enqueue('income', recordId, initialData ? 'update' : 'create', record)
    onClose()
  }

  const accountOptions = accounts.map((a) => ({ value: a.id as string, label: a.name as string }))

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

      <DatePicker label="Date" value={form.date} onChange={(v) => set('date', v)} />

      <TimePicker label="Time" value={form.time} onChange={(v) => set('time', v)} />

      <SelectPicker label="Reason" value={form.reason} options={REASON_OPTIONS} onChange={(v) => set('reason', v)} />

      <MoneyInput label="Amount" valueCents={form.amountCents} onChange={(c) => set('amountCents', c)} />

      <SelectPicker
        label="To Account"
        value={form.toAccountId}
        options={accountOptions}
        onChange={(v) => set('toAccountId', v)}
        placeholder="Select…"
      />

      {form.reason === 'self' && (
        <SelectPicker
          label="From Account"
          value={form.fromAccountId}
          options={accountOptions}
          onChange={(v) => set('fromAccountId', v)}
          placeholder="Select…"
        />
      )}

      <FieldRow label="Description">
        <input value={form.description} onChange={(e) => set('description', e.target.value)} style={rowInput} placeholder="optional" />
      </FieldRow>

      <div style={{ display: 'flex', gap: 8, marginTop: 32 }}>
        <button type="button" onClick={onClose} style={{ ...btnSecondary, flex: 1, minHeight: 52 }}>Cancel</button>
        <button type="submit" style={{ ...btnPrimary, flex: 1, minHeight: 52 }}>Save</button>
      </div>
    </form>
  )
}
