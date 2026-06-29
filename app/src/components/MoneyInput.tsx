import { FieldRow, rowInput } from './FieldRow'

interface Props {
  valueCents: number
  onChange: (cents: number) => void
  label?: string
}

function format(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
}

export function MoneyInput({ valueCents, onChange, label }: Props) {
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, '')
    onChange(digits === '' ? 0 : parseInt(digits, 10))
  }

  function placeCursorAtEnd(e: React.FocusEvent<HTMLInputElement> | React.MouseEvent<HTMLInputElement>) {
    const input = e.currentTarget
    const len = input.value.length
    requestAnimationFrame(() => input.setSelectionRange(len, len))
  }

  return (
    <FieldRow label={label ?? ''} alt>
      <input
        type="text"
        inputMode="numeric"
        value={format(valueCents)}
        onChange={handleChange}
        onFocus={placeCursorAtEnd}
        onClick={placeCursorAtEnd}
        style={rowInput}
      />
    </FieldRow>
  )
}
