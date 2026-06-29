import { useState } from 'react'
import { FieldRow } from './FieldRow'
import { surface, border, textPrimary, textSecondary } from '../theme'

interface Props {
  value: string // YYYY-MM-DD
  onChange: (v: string) => void
  label?: string
}

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']

export function DatePicker({ value, onChange, label = 'Date' }: Props) {
  const today = new Date()
  const [open, setOpen] = useState(false)
  const [viewYear, setViewYear] = useState(() =>
    value ? parseInt(value.slice(0, 4)) : today.getFullYear()
  )
  const [viewMonth, setViewMonth] = useState(() =>
    value ? parseInt(value.slice(5, 7)) : today.getMonth() + 1
  )

  const selYear  = value ? parseInt(value.slice(0, 4)) : null
  const selMonth = value ? parseInt(value.slice(5, 7)) : null
  const selDay   = value ? parseInt(value.slice(8, 10)) : null

  const daysInMonth    = new Date(viewYear, viewMonth, 0).getDate()
  const firstDow       = new Date(viewYear, viewMonth - 1, 1).getDay()
  const leadingEmpties = (firstDow + 6) % 7
  const cells: (number | null)[] = [
    ...Array(leadingEmpties).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  function prevMonth() {
    if (viewMonth === 1) { setViewYear(y => y - 1); setViewMonth(12) }
    else setViewMonth(m => m - 1)
  }

  function nextMonth() {
    if (viewMonth === 12) { setViewYear(y => y + 1); setViewMonth(1) }
    else setViewMonth(m => m + 1)
  }

  function selectDay(day: number) {
    const val = `${viewYear}-${String(viewMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    onChange(val)
    setOpen(false)
  }

  const display = value
    ? new Date(value + 'T00:00').toLocaleDateString('pt-BR')
    : 'Select…'

  return (
    <>
      <FieldRow label={label} alt>
        <button type="button" onClick={() => setOpen(true)} style={triggerBtn}>
          {display}
        </button>
      </FieldRow>

      {open && (
        <div style={overlay}>
          <div style={backdrop} onClick={() => setOpen(false)} />
          <div style={sheet}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <button type="button" onClick={prevMonth} style={navBtn}>‹</button>
              <span style={{ fontSize: 16, fontWeight: 600, color: textPrimary }}>
                {MONTHS[viewMonth - 1]} {viewYear}
              </span>
              <button type="button" onClick={nextMonth} style={navBtn}>›</button>
            </div>

            <div style={grid7}>
              {WEEKDAYS.map(d => (
                <span key={d} style={{ textAlign: 'center', fontSize: 11, color: textSecondary, fontWeight: 500 }}>{d}</span>
              ))}
            </div>

            <div style={grid7}>
              {cells.map((day, i) => {
                if (!day) return <span key={`e${i}`} />
                const isSelected = day === selDay && viewYear === selYear && viewMonth === selMonth
                const isToday    = day === today.getDate() && viewYear === today.getFullYear() && viewMonth === today.getMonth() + 1
                return (
                  <button key={`d${i}`} type="button" onClick={() => selectDay(day)} style={dayBtn(isSelected, isToday)}>
                    {day}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

const triggerBtn: React.CSSProperties = {
  background: 'transparent', border: 'none', color: textPrimary,
  fontSize: 15, cursor: 'pointer', padding: 0, textAlign: 'right',
}

const navBtn: React.CSSProperties = {
  background: 'transparent', border: 'none', color: textPrimary,
  fontSize: 24, cursor: 'pointer', padding: '0 12px', lineHeight: 1,
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
  padding: '20px 16px 32px',
}

const grid7: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 4,
}

function dayBtn(selected: boolean, isToday: boolean): React.CSSProperties {
  return {
    background: selected ? textPrimary : 'transparent',
    color: selected ? '#000000' : isToday ? textPrimary : textPrimary,
    border: 'none', borderRadius: 0, fontSize: 15,
    fontWeight: selected ? 700 : isToday ? 700 : 400,
    textDecoration: isToday && !selected ? 'underline' : 'none',
    cursor: 'pointer', padding: '10px 0', textAlign: 'center', width: '100%', minHeight: 44,
  }
}
