import { useEffect, useState, type ReactNode } from 'react'
import { ApiError } from '../api'

/** Ejecuta fn() al montar y cada vez que cambia deps; maneja carga/error y evita carreras. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<ApiError | null>(null)
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)
  useEffect(() => {
    let alive = true
    setLoading(true)
    setError(null)
    fn().then(d => { if (alive) { setData(d); setLoading(false) } })
      .catch((e: unknown) => {
        if (alive) {
          setError(e instanceof ApiError ? e : new ApiError(0, String(e)))
          setLoading(false)
        }
      })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])
  return { data, error, loading, reload: () => setTick(t => t + 1) }
}

export function ErrorBox({ error, onRetry }: { error: ApiError; onRetry?: () => void }) {
  return (
    <div className="error" role="alert">
      <strong>{error.status === 0 ? 'API no disponible' : `Error ${error.status}`}</strong>
      <p>{error.message}</p>
      {onRetry && <button className="btn" onClick={onRetry}>Reintentar</button>}
    </div>
  )
}

export function PageHeader({ icon, title, intro }: { icon: ReactNode; title: string; intro: string }) {
  return (
    <div className="pagehead">
      <span className="pagehead-ico">{icon}</span>
      <div>
        <h2>{title}</h2>
        <p>{intro}</p>
      </div>
    </div>
  )
}

export function Loading({ label = 'Cargando...' }: { label?: string }) {
  return <div className="loading"><span className="spinner" />{label}</div>
}

export function Card({ title, children, className = '' }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`card ${className}`}>
      {title && <h3>{title}</h3>}
      {children}
    </section>
  )
}

export function LevelBadge({ level }: { level: string }) {
  return <span className={`badge ${level === 'ALTA' ? 'badge-alta' : level === 'MEDIA' ? 'badge-media' : 'badge-none'}`}>{level}</span>
}

export function SignalChips({ maha, red }: { maha: boolean; red: boolean }) {
  if (!maha && !red) return <span className="muted">-</span>
  return (
    <span className="chips">
      {maha && <span className="chip chip-maha" title="Mahalanobis: transaccion rara (P99)">maha</span>}
      {red && <span className="chip chip-red" title="Red: destino nuevo / sin historial (P99)">red</span>}
    </span>
  )
}
