import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAll, upsert } from '../../db/stores'
import { enqueue } from '../../sync/queue'
import { SelectPicker } from '../../components/SelectPicker'
import { FieldRow } from '../../components/FieldRow'
import { btnPrimary, btnSecondary, inactive, textPrimary, textSecondary } from '../../theme'

interface Props {
  statement: Record<string, unknown>
  onClose: () => void
}

export function LinkStatementForm({ statement, onClose }: Props) {
  const navigate = useNavigate()
  const [cards, setCards] = useState<Record<string, unknown>[]>([])
  const [loadingCards, setLoadingCards] = useState(true)
  const [creditCardId, setCreditCardId] = useState('')

  useEffect(() => {
    getAll('creditCards').then((rows) => {
      rows.sort((a, b) => (a.nickname as string).localeCompare(b.nickname as string))
      setCards(rows)
      setLoadingCards(false)
    })
  }, [])

  const fmt = (cents: unknown) =>
    cents == null ? '—' : `R$ ${(Number(cents) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`

  const valid = creditCardId !== ''

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!valid) return
    const now = new Date().toISOString()
    const record = { ...statement, creditCardId, updatedAt: now }
    await upsert('creditCardStatements', record)
    await enqueue('creditCardStatements', statement.id as string, 'update', record)
    onClose()
  }

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

      <FieldRow label="Open date">
        <span style={{ color: textPrimary, fontSize: 15 }}>{statement.openDate as string}</span>
      </FieldRow>
      <FieldRow label="Close date">
        <span style={{ color: textPrimary, fontSize: 15 }}>{statement.closeDate as string}</span>
      </FieldRow>
      <FieldRow label="Due date">
        <span style={{ color: textPrimary, fontSize: 15 }}>{statement.dueDate as string}</span>
      </FieldRow>
      <FieldRow label="Status">
        <span style={{ color: textPrimary, fontSize: 15 }}>{statement.status as string}</span>
      </FieldRow>
      <FieldRow label="Total">
        <span style={{ color: textPrimary, fontSize: 15 }}>{fmt(statement.totalCents)}</span>
      </FieldRow>

      {!loadingCards && cards.length === 0 && (
        <p style={{ color: textSecondary, fontSize: '0.875rem', padding: '16px 0' }}>
          No credit cards yet. Add one first.
        </p>
      )}

      {cards.length > 0 && (
        <SelectPicker
          label="Credit card"
          value={creditCardId}
          options={cards.map((c) => ({ value: c.id as string, label: c.nickname as string }))}
          onChange={setCreditCardId}
        />
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 32 }}>
        <button type="button" onClick={onClose} style={{ ...btnSecondary, flex: 1, minHeight: 52 }}>Cancel</button>
        {cards.length === 0 ? (
          <button
            type="button"
            onClick={() => navigate('/cards/new')}
            style={{ ...btnPrimary, flex: 1, minHeight: 52 }}
          >
            + New card
          </button>
        ) : (
          <button
            type="submit"
            disabled={!valid}
            style={{ ...btnPrimary, flex: 1, minHeight: 52, ...(valid ? {} : { background: inactive, color: textSecondary, cursor: 'not-allowed' }) }}
          >
            Save
          </button>
        )}
      </div>
    </form>
  )
}
