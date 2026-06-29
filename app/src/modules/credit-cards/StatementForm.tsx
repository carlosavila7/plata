import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { v4 as uuidv4 } from 'uuid'
import { upsert, softDelete, getById } from '../../db/stores'
import { enqueue } from '../../sync/queue'
import { MoneyInput } from '../../components/MoneyInput'
import { DatePicker } from '../../components/DatePicker'
import { SelectPicker } from '../../components/SelectPicker'
import { FieldRow } from '../../components/FieldRow'
import { btnPrimary, btnSecondary, inactive, textPrimary, textSecondary } from '../../theme'

const STATUSES = ['open', 'closed', 'paid']
const toOptions = (arr: string[]) => arr.map((v) => ({ value: v, label: v }))

interface Props {
  cardId: string
  statement?: Record<string, unknown>
  onClose: () => void
}

export function StatementForm({ cardId, statement, onClose }: Props) {
  const navigate = useNavigate()
  const isEdit = !!statement
  const [cardName, setCardName] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [form, setForm] = useState({
    openDate:   (statement?.openDate  as string) ?? '',
    closeDate:  (statement?.closeDate as string) ?? '',
    dueDate:    (statement?.dueDate   as string) ?? '',
    status:     (statement?.status    as string) ?? 'open',
    totalCents: (statement?.totalCents as number) ?? 0,
  })

  useEffect(() => {
    getById('creditCards', cardId).then((c) => setCardName((c?.nickname as string) ?? ''))
  }, [cardId])

  function set(k: string, v: unknown) { setForm((f) => ({ ...f, [k]: v })) }

  const valid = form.openDate !== '' && form.closeDate !== '' && form.dueDate !== ''

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!valid) return
    const now = new Date().toISOString()
    const id = (statement?.id as string) ?? uuidv4()
    const record = {
      id,
      creditCardId: cardId,
      openDate:   form.openDate,
      closeDate:  form.closeDate,
      dueDate:    form.dueDate,
      status:     form.status,
      totalCents: form.status === 'open' ? null : form.totalCents,
      createdAt: (statement?.createdAt as string) ?? now,
      updatedAt: now,
      deletedAt: null,
    }
    await upsert('creditCardStatements', record)
    await enqueue('creditCardStatements', id, isEdit ? 'update' : 'create', record)
    onClose()
  }

  async function handleDelete() {
    const id = statement!.id as string
    await softDelete('creditCardStatements', id)
    await enqueue('creditCardStatements', id, 'delete', { id })
    navigate(`/cards/${cardId}`)
  }

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

      <FieldRow label="Card">
        <span style={{ color: textPrimary, fontSize: 15 }}>{cardName}</span>
      </FieldRow>

      <DatePicker label="Open date"  value={form.openDate}  onChange={(v) => set('openDate', v)} />
      <DatePicker label="Close date" value={form.closeDate} onChange={(v) => set('closeDate', v)} />
      <DatePicker label="Due date"   value={form.dueDate}   onChange={(v) => set('dueDate', v)} />

      <SelectPicker label="Status" value={form.status} options={toOptions(STATUSES)} onChange={(v) => set('status', v)} />

      {form.status !== 'open' && (
        <MoneyInput label="Total" valueCents={form.totalCents} onChange={(c) => set('totalCents', c)} />
      )}

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

      {isEdit && (
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          {confirmDelete ? (
            <>
              <button type="button" onClick={handleDelete} style={{ ...btnSecondary, flex: 1, minHeight: 52 }}>Confirm delete</button>
              <button type="button" onClick={() => setConfirmDelete(false)} style={{ ...btnPrimary, flex: 1, minHeight: 52 }}>Cancel</button>
            </>
          ) : (
            <button type="button" onClick={() => setConfirmDelete(true)} style={{ ...btnSecondary, flex: 1, minHeight: 52 }}>Delete statement</button>
          )}
        </div>
      )}
    </form>
  )
}
