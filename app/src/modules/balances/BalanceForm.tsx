import { useEffect, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { getAll, upsert } from '../../db/stores'
import { enqueue } from '../../sync/queue'
import { MoneyInput } from '../../components/MoneyInput'
import { DatePicker } from '../../components/DatePicker'
import { SelectPicker } from '../../components/SelectPicker'
import { btnPrimary, btnSecondary } from '../../theme'

interface Props { onClose: () => void; initialData?: Record<string, unknown> }

export function BalanceForm({ onClose, initialData }: Props) {
  const [accounts, setAccounts] = useState<Record<string, unknown>[]>([])
  const todayBrt = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const [form, setForm] = useState({
    accountId: (initialData?.accountId as string) ?? '',
    date: (initialData?.date as string) ?? todayBrt,
    amountCents: (initialData?.amountCents as number) ?? 0,
  })

  useEffect(() => { getAll('accounts').then(setAccounts) }, [])

  function set(k: string, v: unknown) { setForm((f) => ({ ...f, [k]: v })) }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const now = new Date().toISOString()
    const recordId = initialData ? (initialData.id as string) : uuidv4()
    const record = {
      ...form,
      id: recordId,
      createdAt: initialData ? (initialData.createdAt as string) : now,
      updatedAt: now,
      deletedAt: null,
    }
    await upsert('balances', record)
    await enqueue('balances', recordId, initialData ? 'update' : 'create', record)
    onClose()
  }

  const accountOptions = accounts.map((a) => ({ value: a.id as string, label: a.name as string }))

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

      <SelectPicker
        label="Account"
        value={form.accountId}
        options={accountOptions}
        onChange={(v) => set('accountId', v)}
        placeholder="Select…"
      />

      <DatePicker label="Date" value={form.date} onChange={(v) => set('date', v)} />

      <MoneyInput label="Amount" valueCents={form.amountCents} onChange={(c) => set('amountCents', c)} />

      <div style={{ display: 'flex', gap: 8, marginTop: 32 }}>
        <button type="button" onClick={onClose} style={{ ...btnSecondary, flex: 1, minHeight: 52 }}>Cancel</button>
        <button type="submit" style={{ ...btnPrimary, flex: 1, minHeight: 52 }}>Save</button>
      </div>
    </form>
  )
}
