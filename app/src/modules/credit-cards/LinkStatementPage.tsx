import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getById } from '../../db/stores'
import { LinkStatementForm } from './LinkStatementForm'

export function LinkStatementPage() {
  const navigate = useNavigate()
  const { sid } = useParams<{ sid: string }>()
  const formRef = useRef<HTMLDivElement>(null)
  const [statement, setStatement] = useState<Record<string, unknown> | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!sid) return
    getById('creditCardStatements', sid).then((s) => {
      setStatement(s ?? null)
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

  if (!ready || !statement) return null

  return (
    <div>
      <div style={{ height: '100dvh' }} />
      <div ref={formRef}>
        <LinkStatementForm statement={statement} onClose={() => navigate(-1)} />
      </div>
    </div>
  )
}
