import { useEffect, useState } from 'react'
import { getSyncStatus, onSyncStatusChange } from '../sync/status'

const ICONS = { synced: '✓', pending: '↑', error: '!' }
const LABELS = { synced: 'Synced', pending: 'Syncing…', error: 'Sync error' }
const COLORS = { synced: '#4caf50', pending: '#ff9800', error: '#f44336' }

export function SyncStatus() {
  const [status, setStatus] = useState(getSyncStatus())

  useEffect(() => onSyncStatusChange(setStatus), [])

  return (
    <span style={{ color: COLORS[status], fontSize: 12, fontWeight: 600 }}>
      {ICONS[status]} {LABELS[status]}
    </span>
  )
}
