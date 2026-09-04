import { useState } from 'react'
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker'
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { FieldRow } from './FieldRow'
import { border, surface, textPrimary } from '../theme'

interface Props {
  label: string
  value: Date
  mode: 'date' | 'time'
  onChange: (value: Date) => void
}

// Platform pickers replace the PWA's custom DatePicker/TimePicker — an
// upgrade, not a regression (see issue #8). Android shows its native dialog
// as soon as the picker mounts; iOS gets a bottom sheet with a spinner since
// it has no equivalent standalone dialog.
export function DateTimeField({ label, value, mode, onChange }: Props) {
  const [open, setOpen] = useState(false)

  function handleChange(event: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS === 'android') setOpen(false)
    if (event.type === 'set' && selected) onChange(selected)
  }

  const display = mode === 'date'
    ? value.toLocaleDateString('pt-BR')
    : value.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

  return (
    <>
      <FieldRow label={label}>
        <Pressable onPress={() => setOpen(true)}>
          <Text style={styles.valueText}>{display}</Text>
        </Pressable>
      </FieldRow>

      {open && Platform.OS === 'android' && (
        <DateTimePicker value={value} mode={mode} display="default" onChange={handleChange} />
      )}

      {Platform.OS === 'ios' && (
        <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
          <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
          <View style={styles.sheet}>
            <DateTimePicker value={value} mode={mode} display="spinner" onChange={handleChange} />
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
