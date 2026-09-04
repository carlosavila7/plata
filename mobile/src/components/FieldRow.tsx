import { StyleSheet, Text, View, type TextStyle } from 'react-native'
import { border, textSecondary } from '../theme'

interface Props {
  label: string
  children: React.ReactNode
}

export function FieldRow({ label, children }: Props) {
  return (
    <View style={rowStyles.row}>
      <Text style={rowStyles.label}>{label}</Text>
      <View style={rowStyles.value}>{children}</View>
    </View>
  )
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: border,
    paddingVertical: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '400',
    color: textSecondary,
    flexShrink: 0,
  },
  value: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minWidth: 0,
    flexShrink: 1,
  },
})

export const chipGroupLabel: TextStyle = {
  fontSize: 14,
  color: textSecondary,
  letterSpacing: 1.1,
  textTransform: 'uppercase',
}
