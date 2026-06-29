import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getAll } from '../../db/stores'
import { StatementForm } from './StatementForm'

export function StatementFormPage() {
  const navigate = useNavigate()
  const { id, sid } = useParams<{ id: string; sid: string }>()
  const formRef = useRef<HTMLDivElement>(null)
  const [statement, setStatement] = useState<Record<string, unknown> | undefined>(undefined)
  const [ready, setReady] = useState(!sid)

  useEffect(() => {
    if (!sid) return
    getAll('creditCardStatements').then((rows) => {
      const found = rows.find((r) => r.id === sid)
      setStatement(found)
      setReady(true)
    })
  }, [sid])

  useEffect(() => {
    if (!ready) return
    const main = document.querySelector('main') as HTMLElement | null
    const el = formRef.current
    if (!main || !el) return

    function position() {
      const vh = window.innerHeight
      const formHeight = el!.clientHeight
      main!.scrollTop = formHeight > vh ? vh / 2 : formHeight
    }

    const observer = new ResizeObserver(position)
    observer.observe(el)
    position()

    const timer = window.setTimeout(() => observer.disconnect(), 2000)
    return () => { observer.disconnect(); clearTimeout(timer) }
  }, [ready])

  if (!ready) return null

  return (
    <div>
      <div style={{ height: '100dvh' }} />
      <div ref={formRef}>
        <StatementForm cardId={id!} statement={statement} onClose={() => navigate(-1)} />
      </div>
    </div>
  )
}
