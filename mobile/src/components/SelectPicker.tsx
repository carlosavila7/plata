import { useState } from 'react'
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { FieldRow } from './FieldRow'
import { bg, border, surface, textPrimary, textSecondary } from '../theme'

export interface SelectOption { value: string; label: string }

interface Props {
  label: string
  value: string
  options: SelectOption[]
  onChange: (value: string) => void
  placeholder?: string
}

export function SelectPicker({ label, value, options, onChange, placeholder = 'Select…' }: Props) {
  const [open, setOpen] = useState(false)

  const display = options.find(o => o.value === value)?.label ?? (value || placeholder)

  function select(val: string) {
    onChange(val)
    setOpen(false)
  }

  return (
    <>
      <FieldRow label={label}>
        <Pressable onPress={() => setOpen(true)} style={pickerStyles.trigger}>
          <Text style={value ? pickerStyles.valueText : pickerStyles.placeholderText}>{display}</Text>
          <Text style={pickerStyles.chevron}>›</Text>
        </Pressable>
      </FieldRow>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={pickerStyles.backdrop} onPress={() => setOpen(false)} />
        <View style={pickerStyles.sheet}>
          {options.map((opt, i) => {
            const selected = opt.value === value
            return (
              <View key={opt.value}>
                {i > 0 && <View style={pickerStyles.divider} />}
                <Pressable onPress={() => select(opt.value)} style={[pickerStyles.option, selected && pickerStyles.optionSelected]}>
                  <Text style={[pickerStyles.optionText, selected && pickerStyles.optionTextSelected]}>{opt.label}</Text>
                </Pressable>
              </View>
            )
          })}
        </View>
      </Modal>
    </>
  )
}

const pickerStyles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  valueText: {
    color: textPrimary,
    fontSize: 15,
  },
  placeholderText: {
    color: textSecondary,
    fontSize: 15,
  },
  chevron: {
    color: textSecondary,
    fontSize: 18,
    marginLeft: 4,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: surface,
    borderTopWidth: 1,
    borderTopColor: border,
    paddingBottom: 32,
    maxHeight: '40%',
  },
  divider: {
    height: 1,
    backgroundColor: border,
  },
  option: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    minHeight: 44,
    justifyContent: 'center',
  },
  optionSelected: {
    backgroundColor: textPrimary,
  },
  optionText: {
    fontSize: 15,
    fontWeight: '400',
    color: textPrimary,
  },
  optionTextSelected: {
    fontWeight: '600',
    color: bg,
  },
})
