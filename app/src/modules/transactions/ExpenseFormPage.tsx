import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ExpenseForm } from './ExpenseForm'
import { getById } from '../../db/stores'

export function ExpenseFormPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const formRef = useRef<HTMLDivElement>(null)
  const [initialData, setInitialData] = useState<Record<string, unknown> | undefined>(undefined)
  const [loading, setLoading] = useState(!!id)

  useEffect(() => {
    if (!id) return
    getById('expenses', id).then(data => {
      if (data) setInitialData(data)
      setLoading(false)
    })
  }, [id])

  useEffect(() => {
    if (loading) return
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
  }, [loading])

  if (loading) return null

  return (
    <div>
      <div style={{ height: '100dvh' }} />
      <div ref={formRef}>
        <ExpenseForm onClose={() => navigate(-1)} initialData={initialData} />
      </div>
    </div>
  )
}
