import { useState } from 'react'
import { FieldRow } from './FieldRow'
import { surface, border, textPrimary, textSecondary, bg } from '../theme'

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
        <button type="button" onClick={() => setOpen(true)} style={triggerBtn}>
          <span style={{ color: value ? textPrimary : textSecondary }}>{display}</span>
          <span style={{ color: textSecondary, fontSize: 18, marginLeft: 4 }}>›</span>
        </button>
      </FieldRow>

      {open && (
        <div style={overlay}>
          <div style={backdrop} onClick={() => setOpen(false)} />
          <div style={sheet}>
            {options.map((opt, i) => {
              const selected = opt.value === value
              return (
                <div key={opt.value}>
                  {i > 0 && <div style={divider} />}
                  <button type="button" onClick={() => select(opt.value)} style={optionBtn(selected)}>
                    {opt.label}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </>
  )
}

const triggerBtn: React.CSSProperties = {
  background: 'transparent', border: 'none', cursor: 'pointer',
  display: 'flex', alignItems: 'center', padding: 0,
}

const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 200,
}

const backdrop: React.CSSProperties = {
  position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)',
}

const sheet: React.CSSProperties = {
  position: 'absolute', bottom: 0, left: 0, right: 0,
  background: surface, borderRadius: 0, borderTop: `1px solid ${border}`,
  padding: '0 0 32px',
  maxHeight: '40vh', overflowY: 'auto',
  display: 'flex', flexDirection: 'column',
}

const divider: React.CSSProperties = {
  height: 1, background: border,
}

function optionBtn(selected: boolean): React.CSSProperties {
  return {
    background: selected ? textPrimary : 'transparent',
    color: selected ? bg : textPrimary,
    border: 'none', borderRadius: 0, fontSize: 15,
    fontWeight: selected ? 600 : 400,
    cursor: 'pointer', padding: '16px 24px',
    textAlign: 'left', width: '100%', minHeight: 44,
  }
}
