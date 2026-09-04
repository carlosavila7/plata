import { Switch } from 'react-native'
import { bg, border, textPrimary, textSecondary } from '../theme'

interface Props {
  value: boolean
  onChange: (value: boolean) => void
}

export function Toggle({ value, onChange }: Props) {
  return (
    <Switch
      value={value}
      onValueChange={onChange}
      trackColor={{ false: border, true: textPrimary }}
      thumbColor={value ? bg : textSecondary}
      ios_backgroundColor={border}
    />
  )
}
