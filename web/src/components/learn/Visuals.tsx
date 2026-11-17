import { useMemo, useState, type ReactNode } from 'react'

/* ============ L1: 1 de cada ~775 ============ */
export function RareDots() {
  const cols = 31, rows = 25, red = 11 * cols + 17 // 775 puntos, uno rojo
  const dots = []
  for (let i = 0; i < cols * rows; i++) {
    const x = (i % cols) * 11 + 6, y = Math.floor(i / cols) * 11 + 6
    dots.push(i === red
      ? <g key={i}><circle cx={x} cy={y} r={9} className="rd-ring" /><circle cx={x} cy={y} r={4.2} className="rd-fraud" /></g>
      : <circle key={i} cx={x} cy={y} r={3.2} className="rd-ok" />)
  }
  return (
    <figure className="viz">
      <svg viewBox={`0 0 ${cols * 11 + 2} ${rows * 11 + 2}`} role="img" aria-label="775 puntos, solo uno es fraude">
        {dots}
      </svg>
      <figcaption>Cada punto es una transferencia. Aquí hay <strong>775</strong>… y solo <strong className="t-red">una</strong> es fraude (≈ 0,13%).</figcaption>
    </figure>
  )
}

/* ============ L2: matriz de confusión interactiva ============ */
type Focus = 'none' | 'precision' | 'recall'
export function Confusion() {
  const [f, setF] = useState<Focus>('none')
  const on = (cells: string[]) => (c: string) => (f !== 'none' && cells.includes(c) ? 'hot' : f !== 'none' ? 'dim' : '')
  const cls = f === 'precision' ? on(['vp', 'fp']) : f === 'recall' ? on(['vp', 'fn']) : () => ''
  return (
    <div className="viz">
      <div className="seg" role="group" aria-label="Qué medida resaltar">
        <button className={f === 'none' ? 'on' : ''} onClick={() => setF('none')}>Matriz</button>
        <button className={f === 'precision' ? 'on' : ''} onClick={() => setF('precision')}>Precisión</button>
        <button className={f === 'recall' ? 'on' : ''} onClick={() => setF('recall')}>Recall</button>
      </div>
      <div className="cm">
        <div className="cm-corner" />
        <div className="cm-h">Dijo: <b>FRAUDE</b></div>
        <div className="cm-h">Dijo: <b>LEGÍTIMA</b></div>
        <div className="cm-side">Era <b>FRAUDE</b></div>
        <div className={`cm-c good ${cls('vp')}`}><b>Atrapado</b><span>Verdadero positivo</span></div>
        <div className={`cm-c bad ${cls('fn')}`}><b>Se escapó</b><span>Falso negativo: pierdes dinero</span></div>
        <div className="cm-side">Era <b>LEGÍTIMA</b></div>
        <div className={`cm-c warn ${cls('fp')}`}><b>Falsa alarma</b><span>Falso positivo: molestas a un cliente bueno</span></div>
        <div className={`cm-c neutral ${cls('vn')}`}><b>Todo bien</b><span>Verdadero negativo</span></div>
      </div>
      <p className="viz-note">
        {f === 'none' && 'Toca "Precisión" o "Recall" para ver qué celdas mira cada medida.'}
        {f === 'precision' && 'Precisión = Atrapados ÷ (Atrapados + Falsas alarmas). Mira la columna "dijo fraude": de lo que marcó, ¿cuánto era robo de verdad?'}
        {f === 'recall' && 'Recall = Atrapados ÷ (Atrapados + Escapados). Mira la fila "era fraude": de todos los robos, ¿cuántos atrapó?'}
      </p>
    </div>
  )
}

/* ============ L3: euclidiana vs Mahalanobis ============ */
function seeded(seed: number) {
  let s = seed
  return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296 }
}
export function MahalanobisViz() {
  const [mode, setMode] = useState<'euclid' | 'maha'>('maha')
  const S = 42, cx = 200, cy = 150, th = (30 * Math.PI) / 180
  const P = (u: number, v: number) => ({
    x: cx + S * (u * Math.cos(th) - v * Math.sin(th)),
    y: cy - S * (u * Math.sin(th) + v * Math.cos(th)),
  })
  const pts = useMemo(() => {
    const r = seeded(7)
    const g = () => Math.sqrt(-2 * Math.log(r() + 1e-9)) * Math.cos(2 * Math.PI * r())
    return Array.from({ length: 230 }, () => P(g() * 1.6, g() * 0.45))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const A = P(2.2, 0), B = P(0, 1.4)
  return (
    <div className="viz">
      <div className="seg" role="group" aria-label="Tipo de distancia">
        <button className={mode === 'euclid' ? 'on' : ''} onClick={() => setMode('euclid')}>Línea recta</button>
        <button className={mode === 'maha' ? 'on' : ''} onClick={() => setMode('maha')}>Mahalanobis</button>
      </div>
      <svg viewBox="0 0 400 300" role="img" aria-label="Nube elíptica de puntos normales con dos puntos A y B" className="mv">
        {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={2} className="mv-pt" />)}
        {mode === 'euclid'
          ? <circle cx={cx} cy={cy} r={S * 1.4} className="mv-ring" />
          : <ellipse cx={cx} cy={cy} rx={S * 3.2} ry={S * 0.9} transform={`rotate(-30 ${cx} ${cy})`} className="mv-ring" />}
        <circle cx={cx} cy={cy} r={4} className="mv-c" />
        <line x1={cx} y1={cy} x2={A.x} y2={A.y} className="mv-ln" />
        <line x1={cx} y1={cy} x2={B.x} y2={B.y} className="mv-ln" />
        <circle cx={A.x} cy={A.y} r={7} className="mv-a" /><text x={A.x + 10} y={A.y - 8} className="mv-t">A</text>
        <circle cx={B.x} cy={B.y} r={7} className="mv-b" /><text x={B.x + 10} y={B.y - 8} className="mv-t">B</text>
      </svg>
      <p className="viz-note">
        {mode === 'euclid'
          ? <>Con una regla, <b>B</b> parece más cerca del centro que <b>A</b> (el círculo deja a B dentro y a A fuera). Pero A está dentro de lo que la nube hace normalmente…</>
          : <>Mahalanobis respeta la <b>forma</b> de la nube: <b>A</b> queda dentro de la elipse (es un punto típico) y <b>B</b> queda fuera, aunque esté “cerca” en línea recta. <b>B es el raro.</b></>}
        <span className="muted"> Dibujo ilustrativo, no son datos reales del proyecto.</span>
      </p>
    </div>
  )
}

/* ============ L4: fan_in ============ */
function Node({ x, y, r = 9, cls }: { x: number; y: number; r?: number; cls: string }) {
  return <circle cx={x} cy={y} r={r} className={cls} />
}
export function FanInViz() {
  const ys = [28, 60, 92, 124, 156]
  return (
    <div className="grid2 viz">
      <figure>
        <svg viewBox="0 0 280 190" role="img" aria-label="Muchos orígenes hacia un solo destino (mula)">
          <defs><marker id="ar1" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L8 4L0 8z" className="fi-arrow" /></marker></defs>
          {ys.map(y => <g key={y}><line x1={42} y1={y} x2={212} y2={95} className="fi-line" markerEnd="url(#ar1)" /><Node x={30} y={y} cls="fi-src" /></g>)}
          <Node x={228} y={95} r={16} cls="fi-mule" />
          <text x={228} y={125} textAnchor="middle" className="fi-t">fan_in = 5</text>
        </svg>
        <figcaption><strong>Lo que esperábamos:</strong> una cuenta “mula” que recibe de muchos remitentes.</figcaption>
      </figure>
      <figure>
        <svg viewBox="0 0 280 190" role="img" aria-label="Cada origen hacia su propio destino nuevo">
          <defs><marker id="ar2" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L8 4L0 8z" className="fi-arrow-r" /></marker></defs>
          {ys.map(y => <g key={y}><line x1={42} y1={y} x2={206} y2={y} className="fi-line-r" markerEnd="url(#ar2)" /><Node x={30} y={y} cls="fi-src" /><Node x={222} y={y} r={9} cls="fi-new" /></g>)}
          <text x={274} y={184} textAnchor="end" className="fi-t">fan_in = 0 (cuenta nueva)</text>
        </svg>
        <figcaption><strong>Lo que pasa en PaySim:</strong> cada robo va a una cuenta nueva de “usar y tirar”.</figcaption>
      </figure>
    </div>
  )
}

export function Bars({ rows, unit = '%', max, hot }: {
  rows: { label: string; value: number; show?: string; sub?: string }[]; unit?: string; max?: number; hot?: string }) {
  const m = max ?? Math.max(...rows.map(r => r.value))
  return (
    <div className="bars">
      {rows.map(r => (
        <div key={r.label} className={`bars-row ${hot === r.label ? 'hot' : ''}`}>
          <span className="bars-l">{r.label}</span>
          <span className="bars-track"><span className="bars-fill" style={{ width: `${Math.max((r.value / m) * 100, r.value > 0 ? 1.5 : 0)}%` }} /></span>
          <span className="bars-v">{r.show ?? `${r.value.toLocaleString('es-CO')}${unit}`}{r.sub && <small>{r.sub}</small>}</span>
        </div>
      ))}
    </div>
  )
}

/* ============ L8: curva precision-recall (ilustrativa) ============ */
export function PrCurve() {
  return (
    <figure className="viz">
      <svg viewBox="0 0 320 220" role="img" aria-label="Curva precisión-recall ilustrativa">
        <line x1="40" y1="180" x2="300" y2="180" className="pr-ax" /><line x1="40" y1="20" x2="40" y2="180" className="pr-ax" />
        <path d="M40 40 C 90 42, 120 50, 160 88 S 250 160, 296 174 L296 180 L40 180 Z" className="pr-area" />
        <path d="M40 40 C 90 42, 120 50, 160 88 S 250 160, 296 174" className="pr-line" />
        <line x1="40" y1="172" x2="300" y2="172" className="pr-base" />
        <text x="46" y="166" className="pr-t">tasa base (al azar)</text>
        <text x="170" y="204" textAnchor="middle" className="pr-t">Recall → (¿cuántos robos atrapo?)</text>
        <text x="16" y="100" transform="rotate(-90 16 100)" textAnchor="middle" className="pr-t">Precisión →</text>
        <text x="70" y="140" className="pr-t pr-area-t">Área = AUPRC</text>
      </svg>
      <figcaption>Si pides atrapar más robos (más recall), casi siempre aceptas más falsas alarmas (menos precisión). La curva dibuja ese intercambio para todos los umbrales; el <strong>área</strong> bajo ella es el AUPRC. <span className="muted">Dibujo ilustrativo, no son datos reales.</span></figcaption>
    </figure>
  )
}

export function Callout({ kind = 'tip', title, children }: { kind?: 'tip' | 'warn' | 'fact'; title?: string; children: ReactNode }) {
  const label = title ?? (kind === 'tip' ? 'Explicado fácil' : kind === 'warn' ? 'Ojo' : 'Del proyecto')
  return <aside className={`callout callout-${kind}`}><strong>{label}</strong><div>{children}</div></aside>
}
