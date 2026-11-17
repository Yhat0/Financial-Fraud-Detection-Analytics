import { useMemo, useState } from 'react'
import {
  Bar, CartesianGrid, Cell, ComposedChart, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { api, type TimelineRow } from '../api'
import { dateOnly, int, moneyShort } from '../format'
import { Card, ErrorBox, Loading, useAsync } from './ui'

export default function Timeline() {
  const [hourly, setHourly] = useState(false)
  const { data, error, loading, reload } = useAsync(() => api.timeline(hourly), [hourly])

  const view = useMemo(() => {
    const rows: (TimelineRow & { total: number })[] = (data ?? []).map(r => ({ ...r, total: r.nAlta + r.nMedia }))
    const sorted = [...rows].sort((a, b) => b.total - a.total)
    const topN = Math.max(3, Math.round(rows.length * 0.1))
    const cut = sorted[topN - 1]?.total ?? Infinity
    return { rows, top: sorted.slice(0, hourly ? 8 : 5), cut }
  }, [data, hourly])

  const tick = (v: string) => (hourly ? v.slice(5, 13) + 'h' : v.slice(5))

  return (
    <div className="stack">
      <Card>
        <div className="row between">
          <div>
            <h3 style={{ margin: 0 }}>Cuando hubo que actuar</h3>
            <p className="muted small">Alertas ALTA y MEDIA por {hourly ? 'hora' : 'dia'} frente a fraudes reales.
              Las barras con borde oscuro son el 10% de periodos con mas alertas.</p>
          </div>
          <div className="seg" role="group" aria-label="Granularidad">
            <button className={!hourly ? 'on' : ''} onClick={() => setHourly(false)}>Diaria</button>
            <button className={hourly ? 'on' : ''} onClick={() => setHourly(true)}>Horaria</button>
          </div>
        </div>
        {loading && <Loading />}
        {error && <ErrorBox error={error} onRetry={reload} />}
        {data && !loading && (
          <div className="chart" style={{ height: 380 }}>
            <ResponsiveContainer>
              <ComposedChart data={view.rows} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--grid)" />
                <XAxis dataKey="label" tickFormatter={tick} stroke="var(--muted)" minTickGap={hourly ? 36 : 12} />
                <YAxis stroke="var(--muted)" tickFormatter={v => int(Number(v))} />
                <Tooltip labelFormatter={l => String(l)} formatter={v => int(Number(v))} />
                <Legend />
                <Bar dataKey="nAlta" name="Alertas ALTA" stackId="a" fill="var(--red)">
                  {view.rows.map((r, i) => (
                    <Cell key={i} stroke={r.total >= view.cut ? 'var(--ink)' : 'none'} strokeWidth={r.total >= view.cut ? 1.5 : 0} />
                  ))}
                </Bar>
                <Bar dataKey="nMedia" name="Alertas MEDIA" stackId="a" fill="var(--amber)" />
                <Line dataKey="nFraudes" name="Fraudes reales" stroke="var(--ink)" strokeWidth={2} dot={false} type="monotone" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      {data && !loading && (
        <div className="grid2">
          <Card title={`Mayores concentraciones de alertas (${hourly ? 'horas' : 'dias'})`}>
            <ol className="toplist">
              {view.top.map(r => (
                <li key={r.label}>
                  <span className="strong">{hourly ? r.label : dateOnly(r.label)}</span>
                  <span>{int(r.total)} alertas ({int(r.nAlta)} ALTA) - {int(r.nFraudes)} fraudes - {moneyShort(r.montoEnAlerta)}</span>
                </li>
              ))}
            </ol>
          </Card>
          <Card title="Volumen de transacciones (escala log)">
            <p className="muted small">En PaySim el volumen legitimo cae mucho al final del mes mientras el fraude sigue constante;
              por eso el volumen se muestra aparte y en escala logaritmica.</p>
            <div className="chart" style={{ height: 200 }}>
              <ResponsiveContainer>
                <LineChart data={view.rows.map(r => ({ ...r, nTx: Math.max(r.nTx, 1) }))} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--grid)" />
                  <XAxis dataKey="label" tickFormatter={tick} stroke="var(--muted)" minTickGap={hourly ? 36 : 12} />
                  <YAxis scale="log" domain={[1, 'auto']} allowDataOverflow stroke="var(--muted)" tickFormatter={v => int(Number(v))} />
                  <Tooltip formatter={v => int(Number(v))} />
                  <Line dataKey="nTx" name="Transacciones" stroke="var(--accent)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
