import { useEffect, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { DateTimeField } from '../src/components/DateTimeField'
import { FieldRow, chipGroupLabel } from '../src/components/FieldRow'
import { MoneyInput } from '../src/components/MoneyInput'
import { SelectPicker } from '../src/components/SelectPicker'
import { SkeletonRows } from '../src/components/Skeleton'
import {
  DEFAULT_API_BASE_URL,
  getApiBaseUrlOverride,
  setApiBaseUrlOverride,
} from '../src/config/apiBaseUrl'
import { border, styles as theme, textPrimary, textSecondary } from '../src/theme'

type Mode = 'default' | 'custom'

export default function DebugScreen() {
  const [mode, setMode] = useState<Mode>('default')
  const [customUrl, setCustomUrl] = useState('')
  const [saved, setSaved] = useState(false)
  const [previewMoneyCents, setPreviewMoneyCents] = useState(0)
  const [previewDate, setPreviewDate] = useState(new Date())

  useEffect(() => {
    getApiBaseUrlOverride().then(override => {
      if (override) {
        setMode('custom')
        setCustomUrl(override)
      }
    })
  }, [])

  const effectiveUrl = mode === 'custom' && customUrl.trim() ? customUrl.trim() : DEFAULT_API_BASE_URL

  async function save() {
    await setApiBaseUrlOverride(mode === 'custom' ? customUrl : null)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={chipGroupLabel}>API connection</Text>

      <SelectPicker
        label="Base URL"
        value={mode}
        options={[
          { value: 'default', label: 'Default (build config)' },
          { value: 'custom', label: 'Custom (LAN override)' },
        ]}
        onChange={v => setMode(v as Mode)}
      />

      {mode === 'custom' && (
        <FieldRow label="LAN address">
          <TextInput
            value={customUrl}
            onChangeText={setCustomUrl}
            placeholder="http://192.168.1.20:3000"
            placeholderTextColor={textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            style={theme.rowInput}
          />
        </FieldRow>
      )}

      <Text style={styles.effectiveUrl}>Effective: {effectiveUrl}</Text>

      <Pressable style={[theme.btnPrimary, styles.saveButton]} onPress={save}>
        <Text style={theme.btnPrimaryText}>{saved ? 'Saved' : 'Save'}</Text>
      </Pressable>

      <View style={styles.divider} />

      <Text style={chipGroupLabel}>Component preview</Text>
      <MoneyInput label="Amount" valueCents={previewMoneyCents} onChange={setPreviewMoneyCents} />
      <DateTimeField label="Date" mode="date" value={previewDate} onChange={setPreviewDate} />
      <View style={{ marginTop: 16 }}>
        <SkeletonRows count={2} />
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 8,
  },
  effectiveUrl: {
    color: textSecondary,
    fontSize: 13,
    marginTop: 8,
  },
  saveButton: {
    marginTop: 16,
  },
  divider: {
    height: 1,
    backgroundColor: border,
    marginVertical: 32,
  },
})
