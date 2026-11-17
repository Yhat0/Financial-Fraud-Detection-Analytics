import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api } from '../api'
import { int, moneyShort, pct } from '../format'
import { Card, ErrorBox, Loading, useAsync } from './ui'

function Kpi({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: string }) {
  return (
    <div className={`kpi ${tone ?? ''}`}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {hint && <div className="kpi-hint">{hint}</div>}
    </div>
  )
}

export default function Overview() {
  const { data, error, loading, reload } = useAsync(() => api.stats(), [])
  if (loading) return <Loading />
  if (error) return <ErrorBox error={error} onRetry={reload} />
  if (!data) return null
  const alta = data.porNivel.find(l => l.level === 'ALTA')
  const media = data.porNivel.find(l => l.level === 'MEDIA')
  const tipos = data.porTipo.map(t => ({ tipo: t.type, Alertas: t.count, 'Fraudes reales': t.fraudes }))
  return (
    <div className="stack">
      <div className="kpis">
        <Kpi label="Alertas totales" value={int(data.totalAlertas)} hint="ALTA + MEDIA" />
        <Kpi label="Alertas ALTA" value={int(alta?.count ?? 0)} tone="red" hint={`${int(alta?.fraudes ?? 0)} son fraude real`} />
        <Kpi label="Alertas MEDIA" value={int(media?.count ?? 0)} tone="amber" hint={`${int(media?.fraudes ?? 0)} son fraude real`} />
        <Kpi label="Fraudes capturados" value={int(data.fraudesCapturados)} hint="en alertas ALTA o MEDIA" />
        <Kpi label="Precision ALTA (test)" value={pct(data.precisionAltaTest)} hint={`tasa base ${pct(data.tasaBaseTest, 2)}`} />
        <Kpi label="Recall ALTA (test)" value={pct(data.recallAltaTest)} hint="fraudes que caen en ALTA" />
        <Kpi label="Monto en alerta" value={moneyShort(data.montoTotalEnAlerta)} hint="suma de todas las alertas" />
        <Kpi label="AUPRC (test)" value={data.auprcTest == null ? 'n/d' : data.auprcTest.toFixed(3)} hint="area bajo curva precision-recall" />
      </div>
      <Card title="Alertas por tipo de transaccion">
        <div className="chart" style={{ height: 260 }}>
          <ResponsiveContainer>
            <BarChart data={tipos} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--grid)" />
              <XAxis dataKey="tipo" stroke="var(--muted)" />
              <YAxis stroke="var(--muted)" tickFormatter={v => int(Number(v))} />
              <Tooltip formatter={v => int(Number(v))} />
              <Legend />
              <Bar dataKey="Alertas" fill="var(--accent)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Fraudes reales" fill="var(--red)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  )
}
