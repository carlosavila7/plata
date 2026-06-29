import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { v4 as uuidv4 } from 'uuid'
import { upsert, softDelete, getAll } from '../../db/stores'
import { enqueue } from '../../sync/queue'
import { recomputePosition, createPosition, isUnitBased } from './positions'
import { MoneyInput } from '../../components/MoneyInput'
import { DatePicker } from '../../components/DatePicker'
import { TimePicker } from '../../components/TimePicker'
import { SelectPicker } from '../../components/SelectPicker'
import { FieldRow, rowInput } from '../../components/FieldRow'
import { btnPrimary, btnSecondary, inactive, textSecondary, textPrimary } from '../../theme'

const TYPE_OPTIONS = [
  { value: 'buy', label: 'buy' },
  { value: 'sell', label: 'sell' },
]

// Same stored values (buy/sell), friendlier labels for amount-based assets.
const AMOUNT_TYPE_OPTIONS = [
  { value: 'buy', label: 'invest' },
  { value: 'sell', label: 'withdraw' },
]

const ASSET_TYPES = ['stock', 'fund', 'fixed_income', 'crypto', 'other']
const ASSET_OPTIONS = ASSET_TYPES.map((t) => ({ value: t, label: t }))

const NEW_ASSET = '__new__'

interface Props { positionId?: string; onClose: () => void; initialData?: Record<string, unknown> }

export function EventForm({ positionId, onClose, initialData }: Props) {
  const navigate = useNavigate()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [positions, setPositions] = useState<Record<string, unknown>[]>([])
  const [accounts, setAccounts] = useState<Record<string, unknown>[]>([])

  // Asset is fixed when adding from a position page or editing an existing event.
  const fixedPositionId = (initialData?.positionId as string | undefined) ?? positionId
  const assetFixed = !!fixedPositionId

  const initBrt = initialData
    ? new Date(new Date(initialData.occurredAt as string).getTime() - 3 * 60 * 60 * 1000).toISOString()
    : new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()

  const [form, setForm] = useState({
    assetChoice: fixedPositionId ?? '',   // existing position id, or NEW_ASSET, or ''
    newName: '',
    newAssetType: 'stock',
    newAccountId: '',
    type: (initialData?.type as string) ?? 'buy',
    date: initBrt.slice(0, 10),
    time: initBrt.slice(11, 16),
    quantity: initialData?.quantity != null ? String(initialData.quantity) : '',
    priceCents: (initialData?.priceCents as number) ?? 0,
    amountCents: (initialData?.priceCents as number) ?? 0,
    notes: (initialData?.notes as string) ?? '',
  })

  useEffect(() => {
    getAll('investmentPositions').then(setPositions)
    getAll('accounts').then(setAccounts)
  }, [])

  function set(k: string, v: unknown) { setForm((f) => ({ ...f, [k]: v })) }

  const quantityNum = Number(form.quantity)
  const creatingAsset = !assetFixed && form.assetChoice === NEW_ASSET
  const assetResolved = assetFixed || (form.assetChoice !== '' && (form.assetChoice !== NEW_ASSET || form.newName.trim() !== ''))

  // Resolve the asset type for the event being entered to pick the input mode.
  const selectedPositionId = fixedPositionId ?? (form.assetChoice !== NEW_ASSET ? form.assetChoice : '')
  const selectedPosition = positions.find((p) => p.id === selectedPositionId)
  const currentAssetType = creatingAsset ? form.newAssetType : (selectedPosition?.assetType as string | undefined)
  const unitBased = isUnitBased(currentAssetType)

  const inputValid = unitBased
    ? (Number.isFinite(quantityNum) && quantityNum > 0 && form.priceCents > 0)
    : form.amountCents > 0
  // A brand-new asset must have a source account chosen (required only at creation).
  const accountValid = !creatingAsset || form.newAccountId !== ''
  const valid = assetResolved && accountValid && inputValid

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!valid) return
    const now = new Date().toISOString()
    const recordId = initialData ? (initialData.id as string) : uuidv4()

    let targetPositionId = fixedPositionId ?? ''
    if (!targetPositionId) {
      targetPositionId = creatingAsset
        ? await createPosition({ name: form.newName.trim(), assetType: form.newAssetType, accountId: form.newAccountId })
        : form.assetChoice
    }

    const record = {
      id: recordId,
      positionId: targetPositionId,
      type: form.type,
      occurredAt: new Date(`${form.date}T${form.time}`).toISOString(),
      // amount-based assets store the whole amount in priceCents with quantity 1
      quantity: unitBased ? quantityNum : 1,
      priceCents: unitBased ? form.priceCents : form.amountCents,
      notes: form.notes || null,
      createdAt: initialData ? (initialData.createdAt as string) : now,
      updatedAt: now,
      deletedAt: null,
    }
    await upsert('investmentEvents', record)
    await enqueue('investmentEvents', recordId, initialData ? 'update' : 'create', record)
    await recomputePosition(targetPositionId)
    navigate(`/investments/${targetPositionId}`)
  }

  async function handleDelete() {
    const id = initialData!.id as string
    const posId = initialData!.positionId as string
    await softDelete('investmentEvents', id)
    await enqueue('investmentEvents', id, 'delete', { id })
    await recomputePosition(posId)
    navigate(`/investments/${posId}`)
  }

  const fixedPositionName = positions.find((p) => p.id === fixedPositionId)?.name as string | undefined

  const assetOptions = [
    ...positions.map((p) => ({ value: p.id as string, label: p.name as string })),
    { value: NEW_ASSET, label: '+ New asset' },
  ]

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

      {assetFixed ? (
        fixedPositionName !== undefined && (
          <FieldRow label="Asset">
            <span style={{ color: textPrimary, fontSize: 15 }}>{fixedPositionName}</span>
          </FieldRow>
        )
      ) : (
        <>
          <SelectPicker
            label="Asset"
            value={form.assetChoice}
            options={assetOptions}
            onChange={(v) => set('assetChoice', v)}
            placeholder="Select…"
          />
          {creatingAsset && (
            <>
              <FieldRow label="Name">
                <input value={form.newName} onChange={(e) => set('newName', e.target.value)} style={rowInput} placeholder="PETR4" />
              </FieldRow>
              <SelectPicker label="Asset type" value={form.newAssetType} options={ASSET_OPTIONS} onChange={(v) => set('newAssetType', v)} />
              <SelectPicker
                label="Account"
                value={form.newAccountId}
                options={accounts.map((a) => ({ value: a.id as string, label: a.name as string }))}
                onChange={(v) => set('newAccountId', v)}
                placeholder="Select…"
              />
            </>
          )}
        </>
      )}

      <SelectPicker
        label="Type"
        value={form.type}
        options={unitBased ? TYPE_OPTIONS : AMOUNT_TYPE_OPTIONS}
        onChange={(v) => set('type', v)}
      />

      <DatePicker label="Date" value={form.date} onChange={(v) => set('date', v)} />

      <TimePicker label="Time" value={form.time} onChange={(v) => set('time', v)} />

      {unitBased ? (
        <>
          <FieldRow label="Quantity">
            <input
              value={form.quantity}
              onChange={(e) => set('quantity', e.target.value)}
              inputMode="decimal"
              style={rowInput}
              placeholder="0"
            />
          </FieldRow>

          <MoneyInput label="Price / unit" valueCents={form.priceCents} onChange={(c) => set('priceCents', c)} />
        </>
      ) : (
        <MoneyInput label="Amount" valueCents={form.amountCents} onChange={(c) => set('amountCents', c)} />
      )}

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
            <button type="button" onClick={() => setConfirmDelete(true)} style={{ ...btnSecondary, flex: 1, minHeight: 52 }}>Delete event</button>
          )}
        </div>
      )}
    </form>
  )
}
