import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { v4 as uuidv4 } from 'uuid'
import { upsert, softDelete } from '../../db/stores'
import { enqueue } from '../../sync/queue'
import { MoneyInput } from '../../components/MoneyInput'
import { SelectPicker } from '../../components/SelectPicker'
import { FieldRow, rowInput } from '../../components/FieldRow'
import { btnPrimary, btnSecondary, inactive, textSecondary } from '../../theme'

const ASSET_TYPES = ['stock', 'fund', 'fixed_income', 'crypto', 'other']
const ASSET_OPTIONS = ASSET_TYPES.map((t) => ({ value: t, label: t }))

interface Props { onClose: () => void; initialData?: Record<string, unknown> }

export function InvestmentForm({ onClose, initialData }: Props) {
  const navigate = useNavigate()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [form, setForm] = useState({
    name: (initialData?.name as string) ?? '',
    assetType: (initialData?.assetType as string) ?? 'stock',
    currentPriceCents: (initialData?.currentPriceCents as number | null) ?? 0,
    notes: (initialData?.notes as string) ?? '',
  })

  function set(k: string, v: unknown) { setForm((f) => ({ ...f, [k]: v })) }

  const valid = form.name.trim() !== ''

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!valid) return
    const now = new Date().toISOString()
    const recordId = initialData ? (initialData.id as string) : uuidv4()

    const prevCurrent = (initialData?.currentPriceCents as number | null) ?? null
    const currentPriceCents = form.currentPriceCents > 0 ? form.currentPriceCents : null
    const priceChanged = currentPriceCents !== prevCurrent
    const lastPriceUpdatedAt =
      currentPriceCents == null
        ? null
        : priceChanged
          ? now
          : ((initialData?.lastPriceUpdatedAt as string | null) ?? now)

    const record = {
      id: recordId,
      name: form.name.trim(),
      assetType: form.assetType,
      // accountId is set once at creation (first event) — preserve, never edit here
      accountId: (initialData?.accountId as string | null) ?? null,
      // quantity & avgPriceCents are derived from events — preserve existing, never edit here
      quantity: (initialData?.quantity as number) ?? 0,
      avgPriceCents: (initialData?.avgPriceCents as number) ?? 0,
      currentPriceCents,
      lastPriceUpdatedAt,
      notes: form.notes || null,
      createdAt: initialData ? (initialData.createdAt as string) : now,
      updatedAt: now,
      deletedAt: null,
    }
    await upsert('investmentPositions', record)
    await enqueue('investmentPositions', recordId, initialData ? 'update' : 'create', record)
    onClose()
  }

  async function handleDelete() {
    const id = initialData!.id as string
    await softDelete('investmentPositions', id)
    await enqueue('investmentPositions', id, 'delete', { id })
    navigate('/investments')
  }

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

      <FieldRow label="Name">
        <input value={form.name} onChange={(e) => set('name', e.target.value)} style={rowInput} placeholder="PETR4" />
      </FieldRow>

      <SelectPicker label="Asset type" value={form.assetType} options={ASSET_OPTIONS} onChange={(v) => set('assetType', v)} />

      <MoneyInput label="Current price" valueCents={form.currentPriceCents} onChange={(c) => set('currentPriceCents', c)} />

      <FieldRow label="Notes">
        <input value={form.notes} onChange={(e) => set('notes', e.target.value)} style={rowInput} placeholder="optional" />
      </FieldRow>

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
            <button type="button" onClick={() => setConfirmDelete(true)} style={{ ...btnSecondary, flex: 1, minHeight: 52 }}>Delete position</button>
          )}
        </div>
      )}
    </form>
  )
}
