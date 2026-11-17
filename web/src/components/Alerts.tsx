import { useState } from 'react'
import { api, type Alert } from '../api'
import { int, money, num, pct } from '../format'
import { Card, ErrorBox, LevelBadge, Loading, SignalChips, useAsync } from './ui'

const PAGE_SIZE = 25

function Detail({ a, onClose }: { a: Alert; onClose: () => void }) {
  const rows: [string, string][] = [
    ['ID', String(a.id)], ['Timestamp', a.timestamp], ['Step (hora)', String(a.step)], ['Tipo', a.type],
    ['Monto', money(a.amount)], ['Origen', a.nameOrig], ['Destino', a.nameDest],
    ['Probabilidad de fraude', pct(a.prob, 2)], ['Nivel', a.alertLevel], ['Split', a.split],
    ['Score Mahalanobis', num(a.scoreMaha)], ['Score red', num(a.scoreRed)], ['fan_in destino', int(a.fanIn)],
  ]
  const bal: [string, number][] = [
    ['Origen antes', a.oldbalanceOrg], ['Origen despues', a.newbalanceOrig],
    ['Destino antes', a.oldbalanceDest], ['Destino despues', a.newbalanceDest],
  ]
  return (
    <aside className="drawer" role="dialog" aria-label="Detalle de alerta">
      <div className="row between">
        <h3 style={{ margin: 0 }}>Alerta #{a.id}</h3>
        <button className="btn" onClick={onClose}>Cerrar</button>
      </div>
      <div className="row gap" style={{ margin: '12px 0' }}>
        <LevelBadge level={a.alertLevel} />
        <SignalChips maha={a.mahaFlag} red={a.redFlag} />
        {a.isFraud ? <span className="badge badge-fraud">fraude real</span> : <span className="badge badge-none">legitima</span>}
      </div>
      <dl className="dl">
        {rows.map(([k, v]) => (<div key={k}><dt>{k}</dt><dd>{v}</dd></div>))}
      </dl>
      <h4>Saldos</h4>
      <dl className="dl">
        {bal.map(([k, v]) => (<div key={k}><dt>{k}</dt><dd>{money(v)}</dd></div>))}
      </dl>
    </aside>
  )
}

export default function Alerts() {
  const [level, setLevel] = useState('')
  const [type, setType] = useState('')
  const [split, setSplit] = useState('')
  const [onlyFraud, setOnlyFraud] = useState(false)
  const [sort, setSort] = useState('prob_desc')
  const [page, setPage] = useState(1)
  const [sel, setSel] = useState<Alert | null>(null)

  const { data, error, loading, reload } = useAsync(
    () => api.alerts({ level, type, split, onlyFraud, sort, page, pageSize: PAGE_SIZE }),
    [level, type, split, onlyFraud, sort, page])

  const upd = (f: () => void) => { f(); setPage(1) }
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1

  return (
    <div className="stack">
      <Card>
        <div className="filters">
          <label>Nivel
            <select value={level} onChange={e => upd(() => setLevel(e.target.value))}>
              <option value="">Todos</option><option>ALTA</option><option>MEDIA</option>
            </select></label>
          <label>Tipo
            <select value={type} onChange={e => upd(() => setType(e.target.value))}>
              <option value="">Todos</option><option>TRANSFER</option><option>CASH_OUT</option>
            </select></label>
          <label>Split
            <select value={split} onChange={e => upd(() => setSplit(e.target.value))}>
              <option value="">Todos</option><option value="train">train</option><option value="test">test</option>
            </select></label>
          <label>Orden
            <select value={sort} onChange={e => upd(() => setSort(e.target.value))}>
              <option value="prob_desc">Probabilidad (mayor primero)</option>
              <option value="prob">Probabilidad (menor primero)</option>
              <option value="timestamp_desc">Mas recientes</option>
              <option value="timestamp">Mas antiguas</option>
            </select></label>
          <label className="check"><input type="checkbox" checked={onlyFraud}
            onChange={e => upd(() => setOnlyFraud(e.target.checked))} /> Solo fraude real</label>
        </div>
      </Card>

      <Card>
        {loading && <Loading />}
        {error && <ErrorBox error={error} onRetry={reload} />}
        {data && (
          <>
            <div className="tablewrap" style={{ opacity: loading ? 0.5 : 1 }}>
              <table>
                <thead><tr>
                  <th>Fecha y hora</th><th>Tipo</th><th className="r">Monto</th><th>Destino</th>
                  <th className="r">Prob.</th><th>Nivel</th><th>Senales</th><th>Verdad</th>
                </tr></thead>
                <tbody>
                  {data.items.map(a => (
                    <tr key={a.id} onClick={() => setSel(a)} className={sel?.id === a.id ? 'sel' : ''} tabIndex={0}
                      onKeyDown={e => { if (e.key === 'Enter') setSel(a) }}>
                      <td>{a.timestamp}</td><td>{a.type}</td><td className="r">{money(a.amount)}</td>
                      <td className="mono">{a.nameDest}</td><td className="r">{pct(a.prob, 2)}</td>
                      <td><LevelBadge level={a.alertLevel} /></td>
                      <td><SignalChips maha={a.mahaFlag} red={a.redFlag} /></td>
                      <td>{a.isFraud ? <span className="badge badge-fraud">fraude real</span> : <span className="muted">-</span>}</td>
                    </tr>
                  ))}
                  {data.items.length === 0 && <tr><td colSpan={8} className="muted center">Sin resultados con estos filtros.</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="row between pager">
              <span className="muted small">{int(data.total)} alertas - pagina {int(page)} de {int(pages)}</span>
              <span className="row gap">
                <button className="btn" disabled={page <= 1} onClick={() => setPage(1)}>Primera</button>
                <button className="btn" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Anterior</button>
                <button className="btn" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>Siguiente</button>
              </span>
            </div>
          </>
        )}
      </Card>
      {sel && <Detail a={sel} onClose={() => setSel(null)} />}
    </div>
  )
}
