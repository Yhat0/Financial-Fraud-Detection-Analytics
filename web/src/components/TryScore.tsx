import { useState, type FormEvent } from 'react'
import { api, ApiError, type ScoreRequest, type ScoreResponse } from '../api'
import { num, pct } from '../format'
import { Card, ErrorBox, LevelBadge, Loading, SignalChips } from './ui'

const PRESETS: Record<string, ScoreRequest> = {
  'Vaciado de cuenta (parece fraude)': {
    type: 'TRANSFER', amount: 181, oldbalanceOrg: 181, newbalanceOrig: 0,
    oldbalanceDest: 0, newbalanceDest: 0, nameDest: 'C553264065',
  },
  'Operacion normal': {
    type: 'CASH_OUT', amount: 5000, oldbalanceOrg: 120000, newbalanceOrig: 115000,
    oldbalanceDest: 30000, newbalanceDest: 35000, nameDest: 'C_NUEVO_DEMO',
  },
}

type NumKey = 'amount' | 'oldbalanceOrg' | 'newbalanceOrig' | 'oldbalanceDest' | 'newbalanceDest'
const NUM_FIELDS: [NumKey, string][] = [
  ['amount', 'Monto'], ['oldbalanceOrg', 'Saldo origen antes'], ['newbalanceOrig', 'Saldo origen despues'],
  ['oldbalanceDest', 'Saldo destino antes'], ['newbalanceDest', 'Saldo destino despues'],
]

export default function TryScore() {
  const [tx, setTx] = useState<ScoreRequest>(PRESETS['Vaciado de cuenta (parece fraude)'])
  const [res, setRes] = useState<ScoreResponse | null>(null)
  const [err, setErr] = useState<ApiError | null>(null)
  const [loading, setLoading] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setLoading(true); setErr(null); setRes(null)
    try { setRes(await api.score(tx)) }
    catch (x) { setErr(x instanceof ApiError ? x : new ApiError(0, String(x))) }
    finally { setLoading(false) }
  }

  return (
    <div className="grid2">
      <Card title="Transaccion a evaluar">
        <div className="row gap wrap" style={{ marginBottom: 12 }}>
          {Object.entries(PRESETS).map(([k, v]) => (
            <button key={k} type="button" className="btn" onClick={() => { setTx(v); setRes(null); setErr(null) }}>{k}</button>
          ))}
        </div>
        <form onSubmit={submit} className="form">
          <label>Tipo
            <select value={tx.type} onChange={e => setTx({ ...tx, type: e.target.value as ScoreRequest['type'] })}>
              <option>TRANSFER</option><option>CASH_OUT</option>
            </select></label>
          {NUM_FIELDS.map(([k, label]) => (
            <label key={k}>{label}
              <input type="number" step="any" min={k === 'amount' ? 0 : undefined} required
                value={Number.isNaN(tx[k]) ? '' : tx[k]}
                onChange={e => setTx({ ...tx, [k]: e.target.value === '' ? NaN : Number(e.target.value) })} /></label>
          ))}
          <label>Cuenta destino (nameDest)
            <input type="text" required value={tx.nameDest} onChange={e => setTx({ ...tx, nameDest: e.target.value })} /></label>
          <button className="btn primary" type="submit" disabled={loading}>{loading ? 'Evaluando...' : 'Evaluar'}</button>
        </form>
      </Card>

      <Card title="Resultado">
        {loading && <Loading label="Consultando servicio de scoring..." />}
        {err && (err.status === 503
          ? <div className="error" role="alert"><strong>Servicio de scoring no disponible</strong>
              <p>Arranca el servicio de scoring Python: <code>uvicorn service:app --port 8000</code>, desde <code>Model/</code>.</p>
              <p className="muted small">{err.message}</p></div>
          : <ErrorBox error={err} />)}
        {!res && !err && !loading && <p className="muted">Elige un ejemplo o escribe una transaccion y pulsa Evaluar.</p>}
        {res && (
          <div className="stack">
            <div className="bigprob">
              <div className="kpi-label">Probabilidad de fraude</div>
              <div className="kpi-value large">{pct(res.prob, 2)}</div>
              <div className="row gap"><LevelBadge level={res.alert_level} />
                <SignalChips maha={res.maha_flag} red={res.red_flag} /></div>
            </div>
            <dl className="dl">
              <div><dt>Score Mahalanobis</dt><dd>{num(res.score_maha)} {res.maha_flag ? '(dispara pista)' : ''}</dd></div>
              <div><dt>Score red</dt><dd>{num(res.score_red)} {res.red_flag ? '(dispara pista)' : ''}</dd></div>
              <div><dt>Destino conocido</dt><dd>{res.destino_conocido ? 'Si (tiene historial)' : 'No (destino nuevo)'}</dd></div>
            </dl>
            <h4>Features calculadas</h4>
            <dl className="dl">
              {Object.entries(res.features).map(([k, v]) => (<div key={k}><dt>{k}</dt><dd>{num(v)}</dd></div>))}
            </dl>
          </div>
        )}
      </Card>
    </div>
  )
}
