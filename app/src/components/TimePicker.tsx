import { useEffect, useRef, useState } from 'react'
import { FieldRow } from './FieldRow'
import { surface, border, textPrimary, textSecondary } from '../theme'

interface Props {
  value: string // HH:MM
  onChange: (v: string) => void
  label?: string
}

interface SliderRowProps {
  label: string
  value: number
  max: number
  onChange: (v: number) => void
  onCommit?: () => void
}

function SliderRow({ label, value, max, onChange, onCommit }: SliderRowProps) {
  const rowRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const percent = (value / max) * 100

  function computeValue(clientX: number) {
    const rect = rowRef.current!.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    return Math.round(ratio * max)
  }

  function applyValue(clientX: number) {
    const next = computeValue(clientX)
    if (next !== value) {
      navigator.vibrate?.(8)
      onChange(next)
    }
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    dragging.current = true
    e.currentTarget.setPointerCapture(e.pointerId)
    applyValue(e.clientX)
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragging.current) return
    applyValue(e.clientX)
  }

  function onPointerUp() {
    dragging.current = false
    onCommit?.()
  }

  return (
    <div
      ref={rowRef}
      style={sliderRow}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {/* fill — slightly darker wash of the row background */}
      <div style={{ ...fill, width: `${percent}%` }} />
      {/* thumb — thin vertical pipe */}
      <div style={{ ...thumb, left: `${percent}%` }} />
      <span style={sliderLabel}>{label}</span>
      <span style={sliderValue}>{String(value).padStart(2, '0')}</span>
    </div>
  )
}

function nowBRT() {
  const d = new Date(Date.now() - 3 * 60 * 60 * 1000)
  return { h: d.getUTCHours(), m: d.getUTCMinutes() }
}

export function TimePicker({ value, onChange, label = 'Time' }: Props) {
  const [open, setOpen] = useState(false)
  const [hour, setHour] = useState(() =>
    value ? parseInt(value.slice(0, 2), 10) : nowBRT().h
  )
  const [minute, setMinute] = useState(() =>
    value ? parseInt(value.slice(3, 5), 10) : nowBRT().m
  )

  function handleHour(h: number) {
    setHour(h)
    onChange(`${String(h).padStart(2, '0')}:${String(minute).padStart(2, '0')}`)
  }

  function handleMinute(m: number) {
    setMinute(m)
    onChange(`${String(hour).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
  }

  const display = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`

  useEffect(() => {
    if (!value) onChange(display)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
      <FieldRow label={label} alt>
        <button type="button" onClick={() => setOpen(true)} style={triggerBtn}>
          {value || display}
        </button>
      </FieldRow>

      {open && (
        <div style={overlay}>
          <div style={backdrop} onClick={() => setOpen(false)} />
          <div style={sheet}>
            <div style={clockDisplay}>{display}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <SliderRow label="Hour" value={hour} max={23} onChange={handleHour} />
              <SliderRow label="Minute" value={minute} max={59} onChange={handleMinute} onCommit={() => setOpen(false)} />
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

const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 200,
}

const backdrop: React.CSSProperties = {
  position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)',
}

const sheet: React.CSSProperties = {
  position: 'absolute', bottom: 0, left: 0, right: 0,
  background: surface, borderRadius: 0, borderTop: `1px solid ${border}`,
  padding: '24px 16px 40px',
}

const clockDisplay: React.CSSProperties = {
  fontSize: 48, fontWeight: 300, color: textPrimary,
  textAlign: 'center', letterSpacing: 4,
  marginBottom: 28, fontVariantNumeric: 'tabular-nums',
}

const sliderRow: React.CSSProperties = {
  position: 'relative', overflow: 'hidden',
  borderRadius: 0, padding: '16px 0',
  background: 'transparent', borderBottom: `1px solid ${border}`,
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  cursor: 'pointer', userSelect: 'none', touchAction: 'none',
}

const fill: React.CSSProperties = {
  position: 'absolute', left: 0, top: 0, bottom: 0,
  background: 'rgba(0,0,0,0.28)', pointerEvents: 'none',
}

const thumb: React.CSSProperties = {
  position: 'absolute', top: '50%',
  transform: 'translate(-50%, -50%)',
  width: 2, height: 28,
  background: 'rgba(255,255,255,0.5)',
  borderRadius: 0, pointerEvents: 'none',
}

const sliderLabel: React.CSSProperties = {
  position: 'relative', zIndex: 1,
  fontSize: 15, fontWeight: 500, color: textPrimary,
}

const sliderValue: React.CSSProperties = {
  position: 'relative', zIndex: 1,
  fontSize: 15, color: textSecondary,
  fontVariantNumeric: 'tabular-nums',
}
