const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:5055/api/v1'

// Clave DEV por defecto (igual que en la API y el servicio Python). Una SPA no puede ocultar su key: nivel demo.
const API_KEY = (import.meta.env.VITE_API_KEY as string | undefined) ?? 'dev-key-change-me'

export interface LevelCount { level: string; count: number; fraudes: number }
export interface TypeCount { type: string; count: number; fraudes: number }
export interface Stats {
  totalAlertas: number
  porNivel: LevelCount[]
  porTipo: TypeCount[]
  fraudesCapturados: number
  montoTotalEnAlerta: number
  precisionAltaTest: number | null
  recallAltaTest: number | null
  tasaBaseTest: number | null
  auprcTest: number | null
}
export interface Alert {
  id: number; timestamp: string; step: number; type: string; amount: number
  nameOrig: string; nameDest: string; prob: number; alertLevel: 'ALTA' | 'MEDIA'
  mahaFlag: boolean; redFlag: boolean; scoreMaha: number; scoreRed: number; fanIn: number
  split: string; isFraud: boolean
  oldbalanceOrg: number; newbalanceOrig: number; oldbalanceDest: number; newbalanceDest: number
}
export interface Paged<T> { items: T[]; total: number; page: number; pageSize: number }
export interface TimelineRow {
  label: string; nTx: number; nAlta: number; nMedia: number
  nFraudes: number; montoEnAlerta: number; fraudesEnAlerta: number
}
export interface ScoreRequest {
  type: 'TRANSFER' | 'CASH_OUT'; amount: number; oldbalanceOrg: number; newbalanceOrig: number
  oldbalanceDest: number; newbalanceDest: number; nameDest: string; step?: number
}
export interface ScoreResponse {
  prob: number; alert_level: 'ALTA' | 'MEDIA' | 'NINGUNA'; maha_flag: boolean; red_flag: boolean
  score_maha: number; score_red: number; destino_conocido: boolean
  features: Record<string, number>
}
export interface AlertFilters {
  level?: string; type?: string; split?: string; onlyFraud?: boolean; sort?: string
  page: number; pageSize: number
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) { super(message); this.status = status }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { ...(init?.headers as Record<string, string> | undefined), 'X-API-Key': API_KEY },
    })
  } catch {
    throw new ApiError(0, `No se pudo conectar con la API (${BASE}). Arrancala con: dotnet run (en api/FraudApi).`)
  }
  const text = await res.text()
  let body: unknown = null
  try { body = text ? JSON.parse(text) : null } catch { /* cuerpo no JSON */ }
  if (!res.ok) {
    const b = body as { message?: string; title?: string; detail?: string } | null
    throw new ApiError(res.status, b?.message ?? b?.detail ?? b?.title ?? `Error HTTP ${res.status}`)
  }
  return body as T
}

export const api = {
  stats: () => request<Stats>('/stats'),
  timeline: (hourly: boolean) => request<TimelineRow[]>(`/timeline${hourly ? '?granularity=hourly' : ''}`),
  alerts: (f: AlertFilters) => {
    const q = new URLSearchParams({ page: String(f.page), pageSize: String(f.pageSize) })
    if (f.level) q.set('level', f.level)
    if (f.type) q.set('type', f.type)
    if (f.split) q.set('split', f.split)
    if (f.onlyFraud) q.set('onlyFraud', 'true')
    if (f.sort) q.set('sort', f.sort)
    return request<Paged<Alert>>(`/alerts?${q}`)
  },
  alert: (id: number) => request<Alert>(`/alerts/${id}`),
  score: (tx: ScoreRequest) => request<ScoreResponse>('/score', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(tx),
  }),
}
