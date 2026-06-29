export const bg            = '#000000'
export const surface       = '#1A1A1A'
export const border        = '#333333'
export const textPrimary   = '#ffffff'
export const textSecondary = '#888888'
export const inactive      = '#4A4A4A'

export const btnPrimary: React.CSSProperties = {
  background: textPrimary, color: bg,
  border: 'none', borderRadius: 0,
  padding: '14px 16px', fontWeight: 600, cursor: 'pointer', fontSize: 15,
}

export const btnSecondary: React.CSSProperties = {
  background: 'transparent', color: textPrimary,
  border: `1px solid ${border}`, borderRadius: 0,
  padding: '14px 16px', fontWeight: 400, cursor: 'pointer', fontSize: 15,
}

export const inputStyle: React.CSSProperties = {
  padding: 8, borderRadius: 0,
  border: `1px solid ${border}`,
  background: surface, color: textPrimary, fontSize: 15,
}

export const labelStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 4,
  fontSize: '0.875rem', fontWeight: 400, color: textSecondary,
}

export const cardStyle: React.CSSProperties = {
  borderBottom: `1px solid ${border}`,
  padding: 16,
}
