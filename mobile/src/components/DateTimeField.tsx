import { useState } from 'react'
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker'
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { FieldRow } from './FieldRow'
import { border, surface, textPrimary, textSecondary } from '../theme'

interface Props {
  label: string
  value: Date | null
  mode: 'date' | 'time'
  onChange: (value: Date) => void
  placeholder?: string
  onClear?: () => void
}

// Platform pickers replace the PWA's custom DatePicker/TimePicker — an
// upgrade, not a regression (see issue #8). Android shows its native dialog
// as soon as the picker mounts; iOS gets a bottom sheet with a spinner since
// it has no equivalent standalone dialog.
//
// `value` may be null for an unset optional field (e.g. a filter's date
// range bound) — the picker itself still needs a concrete starting date, so
// it opens on today rather than showing nothing.
export function DateTimeField({ label, value, mode, onChange, placeholder = 'Not set', onClear }: Props) {
  const [open, setOpen] = useState(false)
  const pickerValue = value ?? new Date()

  function handleChange(event: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS === 'android') setOpen(false)
    if (event.type === 'set' && selected) onChange(selected)
  }

  const display = value === null
    ? placeholder
    : mode === 'date'
      ? value.toLocaleDateString('pt-BR')
      : value.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

  return (
    <>
      <FieldRow label={label}>
        <Pressable onPress={() => setOpen(true)}>
          <Text style={value === null ? styles.placeholderText : styles.valueText}>{display}</Text>
        </Pressable>
        {onClear && value !== null && (
          <Pressable onPress={onClear} hitSlop={8}>
            <Text style={styles.clearGlyph}>×</Text>
          </Pressable>
        )}
      </FieldRow>

      {open && Platform.OS === 'android' && (
        <DateTimePicker value={pickerValue} mode={mode} display="default" onChange={handleChange} />
      )}

      {Platform.OS === 'ios' && (
        <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
          <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
          <View style={styles.sheet}>
            <DateTimePicker value={pickerValue} mode={mode} display="spinner" onChange={handleChange} />
            <Pressable onPress={() => setOpen(false)} style={styles.doneBtn}>
              <Text style={styles.doneText}>Done</Text>
            </Pressable>
          </View>
        </Modal>
      )}
    </>
  )
}

const styles = StyleSheet.create({
  valueText: {
    color: textPrimary,
    fontSize: 15,
  },
  placeholderText: {
    color: textSecondary,
    fontSize: 15,
  },
  clearGlyph: {
    color: textSecondary,
    fontSize: 18,
    marginLeft: 8,
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
    paddingBottom: 24,
  },
  doneBtn: {
    alignItems: 'center',
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: border,
  },
  doneText: {
    color: textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
})
