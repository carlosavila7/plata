import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { v4 as uuidv4 } from 'uuid'
import { getAll, upsert, softDelete } from '../../db/stores'
import { enqueue } from '../../sync/queue'
import { MoneyInput } from '../../components/MoneyInput'
import { SelectPicker } from '../../components/SelectPicker'
import { FieldRow, rowInput } from '../../components/FieldRow'
import { btnPrimary, btnSecondary, inactive, textSecondary } from '../../theme'

const DAY_OPTIONS = Array.from({ length: 31 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))

interface Props { onClose: () => void; initialData?: Record<string, unknown> }

export function CardForm({ onClose, initialData }: Props) {
  const navigate = useNavigate()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [accounts, setAccounts] = useState<Record<string, unknown>[]>([])
  const [form, setForm] = useState({
    nickname:   (initialData?.nickname as string) ?? '',
    bank:       (initialData?.bank as string) ?? '',
    network:    (initialData?.network as string) ?? '',
    closingDay: String((initialData?.closingDay as number) ?? 1),
    dueDay:     String((initialData?.dueDay as number) ?? 10),
    limitCents: (initialData?.limitCents as number | null) ?? 0,
  })

  useEffect(() => { getAll('accounts').then(setAccounts) }, [])

  function set(k: string, v: unknown) { setForm((f) => ({ ...f, [k]: v })) }

  const valid = form.nickname.trim() !== '' && form.bank.trim() !== '' && form.network.trim() !== ''

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!valid) return
    const now = new Date().toISOString()
    const id = initialData ? (initialData.id as string) : uuidv4()
    const record = {
      id,
      nickname: form.nickname.trim(),
      bank: form.bank.trim(),
      network: form.network.trim(),
      closingDay: Number(form.closingDay),
      dueDay: Number(form.dueDay),
      limitCents: form.limitCents > 0 ? form.limitCents : null,
      createdAt: initialData ? (initialData.createdAt as string) : now,
      updatedAt: now,
      deletedAt: null,
    }
    await upsert('creditCards', record)
    await enqueue('creditCards', id, initialData ? 'update' : 'create', record)
    onClose()
  }

  async function handleDelete() {
    const id = initialData!.id as string
    await softDelete('creditCards', id)
    await enqueue('creditCards', id, 'delete', { id })
    navigate('/cards')
  }

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

      <FieldRow label="Card name">
        <input value={form.nickname} onChange={(e) => set('nickname', e.target.value)} style={rowInput} placeholder="Nanquim" />
      </FieldRow>

      <SelectPicker
        label="Bank"
        value={form.bank}
        options={accounts.map((a) => ({ value: a.name as string, label: a.name as string }))}
        onChange={(v) => set('bank', v)}
        placeholder="Select…"
      />

      <FieldRow label="Network">
        <input value={form.network} onChange={(e) => set('network', e.target.value)} style={rowInput} placeholder="ELO" />
      </FieldRow>

      <SelectPicker label="Closing day" value={form.closingDay} options={DAY_OPTIONS} onChange={(v) => set('closingDay', v)} />
      <SelectPicker label="Due day"     value={form.dueDay}     options={DAY_OPTIONS} onChange={(v) => set('dueDay', v)} />

      <MoneyInput label="Limit" valueCents={form.limitCents} onChange={(c) => set('limitCents', c)} />

      <div style={{ display: 'flex', gap: 8, marginTop: 32 }}>
        <button type="button" onClick={onClose} style={{ ...btnSecondary, flex: 1, minHeight: 52 }}>Cancel</button>
        <button
          type="submit"
          disabled={!valid}
          style={{ ...btnPrimary, flex: 1, minHeight: 52, ...(valid ? {} : { background: inactive, color: textSecondary, cursor: 'not-allowed' }) }}
        >
          Save
        </button>
      </div>

      {initialData && (
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          {confirmDelete ? (
            <>
              <button type="button" onClick={handleDelete} style={{ ...btnSecondary, flex: 1, minHeight: 52 }}>Confirm delete</button>
              <button type="button" onClick={() => setConfirmDelete(false)} style={{ ...btnPrimary, flex: 1, minHeight: 52 }}>Cancel</button>
            </>
          ) : (
            <button type="button" onClick={() => setConfirmDelete(true)} style={{ ...btnSecondary, flex: 1, minHeight: 52 }}>Delete card</button>
          )}
        </div>
      )}
    </form>
  )
}
