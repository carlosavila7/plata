import { textPrimary, textSecondary, border } from '../theme'

interface Props {
  label: string
  alt?: boolean
  children: React.ReactNode
}

export function FieldRow({ label, children }: Props) {
  return (
    <div style={rowCard}>
      <span style={rowLabelStyle}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
        {children}
      </div>
    </div>
  )
}

const rowCard: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  borderBottom: `1px solid ${border}`, padding: '16px 0',
}

const rowLabelStyle: React.CSSProperties = {
  fontSize: '0.875rem', fontWeight: 400, color: textSecondary, flexShrink: 0,
}

export const rowInput: React.CSSProperties = {
  background: 'transparent', border: 'none', outline: 'none',
  color: textPrimary, fontSize: 15, textAlign: 'right', flex: 1, minWidth: 0,
}

export const rowSelect: React.CSSProperties = {
  background: 'transparent', border: 'none', outline: 'none',
  color: textPrimary, fontSize: 15, cursor: 'pointer',
  appearance: 'none', WebkitAppearance: 'none',
  textAlign: 'right', textAlignLast: 'right',
  paddingRight: 20,
}

export const chevron: React.CSSProperties = {
  position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)',
  color: textSecondary, pointerEvents: 'none', fontSize: 18, lineHeight: 1,
}

export const chipGroupLabel: React.CSSProperties = {
  fontSize: '0.875rem', fontWeight: 400, color: textSecondary,
  letterSpacing: '0.08em', textTransform: 'uppercase',
}
