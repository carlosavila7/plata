import { StyleSheet } from 'react-native'

export const bg = '#000000'
export const surface = '#1A1A1A'
export const border = '#333333'
export const textPrimary = '#ffffff'
export const textSecondary = '#888888'
export const inactive = '#4A4A4A'

export const styles = StyleSheet.create({
  btnPrimary: {
    backgroundColor: textPrimary,
    borderRadius: 0,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  btnPrimaryText: {
    color: bg,
    fontWeight: '600',
    fontSize: 15,
  },
  btnSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: border,
    borderRadius: 0,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  btnSecondaryText: {
    color: textPrimary,
    fontWeight: '400',
    fontSize: 15,
  },
  input: {
    padding: 8,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: border,
    backgroundColor: surface,
    color: textPrimary,
    fontSize: 15,
  },
  label: {
    fontSize: 14,
    fontWeight: '400',
    color: textSecondary,
  },
  card: {
    borderBottomWidth: 1,
    borderBottomColor: border,
    padding: 16,
  },
  rowInput: {
    color: textPrimary,
    fontSize: 15,
    textAlign: 'right',
    flexGrow: 1,
    minWidth: 0,
    padding: 0,
  },
})
