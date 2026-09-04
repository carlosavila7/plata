import { TextInput } from 'react-native'
import { FieldRow } from './FieldRow'
import { styles } from '../theme'

interface Props {
  valueCents: number
  onChange: (cents: number) => void
  label?: string
}

function format(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
}

export function MoneyInput({ valueCents, onChange, label }: Props) {
  function handleChange(text: string) {
    const digits = text.replace(/\D/g, '')
    onChange(digits === '' ? 0 : parseInt(digits, 10))
  }

  return (
    <FieldRow label={label ?? ''}>
      <TextInput
        value={format(valueCents)}
        onChangeText={handleChange}
        keyboardType="number-pad"
        style={styles.rowInput}
      />
    </FieldRow>
  )
}
