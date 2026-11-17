import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'

type Cat = 'Datos' | 'Métricas' | 'Señales' | 'Motor'
interface Term { cat: Cat; term: string; simple: string; tech?: string }

const TERMS: Term[] = [
  // ---- Datos ----
  { cat: 'Datos', term: 'PaySim', simple: 'Un conjunto de transferencias de dinero móvil inventadas por simulación (no son personas reales). 6.362.620 filas.' },
  { cat: 'Datos', term: 'step', simple: 'La hora. Cada step es 1 hora; va de 1 a 743 (31 días).' },
  { cat: 'Datos', term: 'type', simple: 'El tipo de operación. El fraude solo aparece en TRANSFER y CASH_OUT.' },
  { cat: 'Datos', term: 'amount', simple: 'Cuánto dinero se mueve en la transacción.' },
  { cat: 'Datos', term: 'nameOrig / nameDest', simple: 'La cuenta que envía (origen) y la que recibe (destino).' },
  { cat: 'Datos', term: 'oldbalance / newbalance', simple: 'El saldo de cada cuenta antes y después de la operación (origen y destino).' },
  { cat: 'Datos', term: 'isFraud', simple: 'La verdad confirmada: ¿fue fraude? Es la "respuesta del examen", nunca una pista de entrada.' },
  { cat: 'Datos', term: 'errorOrig / errorDest', simple: 'Chequeo de que las cuentas cuadran: saldo antes − monto − saldo después. Si da ≈ 0, todo cuadra.', tech: 'errorOrig = oldbalanceOrg − amount − newbalanceOrig' },
  { cat: 'Datos', term: 'vaciaCuenta', simple: 'La operación deja la cuenta de origen en 0 partiendo de un saldo positivo: se llevó todo.' },
  { cat: 'Datos', term: 'Clase rara / desbalance', simple: 'El fraude es muy poquito (0,129%). Casi todo el diseño sale de esa rareza.' },
  // ---- Métricas ----
  { cat: 'Métricas', term: 'Tasa base (baseline)', simple: 'Qué tan común es el fraude: el punto de partida "a ciegas". En el examen es 0,56%.' },
  { cat: 'Métricas', term: 'Falso positivo', simple: 'Marcar como robo algo legítimo: molestas a un cliente bueno.' },
  { cat: 'Métricas', term: 'Falso negativo', simple: 'Dejar pasar un robo real: se pierde dinero.' },
  { cat: 'Métricas', term: 'Precisión', simple: 'De lo que marca como robo, ¿cuánto era robo de verdad? Controla las falsas alarmas.' },
  { cat: 'Métricas', term: 'Recall (sensibilidad)', simple: 'De todos los robos que existían, ¿cuántos atrapó? Controla los robos que se escapan.' },
  { cat: 'Métricas', term: 'F1', simple: 'Un promedio especial que junta precisión y recall en un solo número.' },
  { cat: 'Métricas', term: 'Recall @ precisión ≥ 0,9', simple: 'Si exijo acertar al menos 9 de cada 10 veces que marco, ¿qué parte de los robos alcanzo? Es la medida más accionable.' },
  { cat: 'Métricas', term: 'AUPRC', simple: 'La nota global para eventos raros: junta precisión y recall. Siempre se lee contra la tasa base.', tech: 'Área bajo la curva precisión-recall' },
  { cat: 'Métricas', term: 'Lift (empuje)', simple: 'Cuántas veces mejor que el azar. Si la base es 0,56% y un grupo tiene 3,63%, el lift es 6,5×.' },
  { cat: 'Métricas', term: 'Decil', simple: 'Partir todo en 10 grupos iguales, del menos raro (1) al más raro (10).' },
  { cat: 'Métricas', term: 'Mediana, cuartiles, percentil', simple: 'Mediana: el valor del medio. Cuartiles: cortes en 25%, 50% y 75%. Percentil 99: el valor que solo supera el 1% más extremo.' },
  { cat: 'Métricas', term: 'Umbral (threshold)', simple: 'La raya donde suena la alarma. Por encima = alerta. Es una decisión de negocio, no del modelo.' },
  { cat: 'Métricas', term: 'Split temporal', simple: 'Estudiar con lo más viejo y examinarse con lo más nuevo, como en la vida real. Nunca mezclar al azar.' },
  { cat: 'Métricas', term: 'Leakage (fuga)', simple: 'Dejar que el detector espíe el futuro. Invalida los resultados. Prohibido.' },
  { cat: 'Métricas', term: 'PSI', simple: 'Mide si una variable cambió de forma entre el estudio y el examen (estabilidad).', tech: 'Population Stability Index' },
  // ---- Señales ----
  { cat: 'Señales', term: 'score_maha', simple: 'El medidor de rareza de la Pista 1. Más alto = más raro.' },
  { cat: 'Señales', term: 'Distancia euclidiana', simple: 'La distancia en línea recta, como con una regla. Ignora la forma de la nube de datos.' },
  { cat: 'Señales', term: 'Distancia de Mahalanobis', simple: 'Distancia "en desviaciones estándar corregidas por correlación". Un punto puede estar cerca en línea recta y lejos en Mahalanobis.', tech: 'd(x) = √((x−μ)ᵀ Σ⁻¹ (x−μ))' },
  { cat: 'Señales', term: 'Matriz de covarianza (Σ)', simple: 'Una tabla que resume cuánto varía cada variable y cómo se mueven juntas.' },
  { cat: 'Señales', term: 'SPD', simple: 'Propiedad que garantiza que las cuentas matemáticas del detector son estables (Σ se puede invertir).', tech: 'Symmetric Positive Definite' },
  { cat: 'Señales', term: 'Modelo de normalidad', simple: 'El centro (μ) y la forma (Σ) de lo "normal", calculados solo con transferencias legítimas.' },
  { cat: 'Señales', term: 'Estandarizar (z-score)', simple: 'Poner todas las variables en la misma escala antes de medir distancias.', tech: '(x − media) / σ' },
  { cat: 'Señales', term: 'Grafo', simple: 'Un mapa de cuentas (nodos) unidas por transferencias (flechas).' },
  { cat: 'Señales', term: 'fan_in', simple: 'A cuánta gente distinta le llegó dinero a esa cuenta antes. En PaySim el robo va a fan_in bajo.' },
  { cat: 'Señales', term: 'fan_out', simple: 'A cuántos destinos distintos envía una cuenta.' },
  { cat: 'Señales', term: 'n_tx_dest', simple: 'Cuántas transferencias había recibido la cuenta destino antes. En el fraude casi siempre es 0.' },
  { cat: 'Señales', term: 'Cuenta mula', simple: 'Cuenta usada para recibir y mover dinero robado, suele recibir de muchos orígenes. En PaySim no aparece.' },
  { cat: 'Señales', term: 'dest_sin_historial', simple: 'Cuenta estrenada que de repente recibe un monto grande. La pista de red más útil.' },
  { cat: 'Señales', term: 'burst (ráfaga)', simple: 'Muchos golpes seguidos al mismo destino en pocas horas. Aquí es débil.' },
  { cat: 'Señales', term: 'Cola pesada', simple: 'Cuando los valores extremos son más frecuentes de lo que se esperaría.' },
  { cat: 'Señales', term: 'score_red', simple: 'El medidor de la Pista 2 ("destino nuevo"). Sola es floja (AUPRC 0,04) pero mira algo distinto.' },
  // ---- Motor ----
  { cat: 'Motor', term: 'Regresión logística', simple: 'Un modelo simple que combina varias pistas con pesos y devuelve una probabilidad entre 0 y 1. Es nuestra "fusión".' },
  { cat: 'Motor', term: 'Chi-cuadrado (χ²)', simple: 'Si la nube fuera una campana perfecta, dice cuánto es "demasiado lejos". Da un umbral con fundamento (para 7 variables: d > 4,30).' },
  { cat: 'Motor', term: 'EVT / GPD', simple: 'Teoría de valores extremos: en vez de modelar lo normal, modela directamente la cola de lo raro.', tech: 'Distribución de Pareto Generalizada' },
  { cat: 'Motor', term: 'Neyman–Pearson', simple: 'La teoría del mejor equilibrio: atrapar el máximo de fraude para un nivel fijo de falsas alarmas.' },
  { cat: 'Motor', term: 'Chebyshev', simple: 'Una cota que no necesita suponer que los datos son una campana: plan B para fijar umbrales.' },
  { cat: 'Motor', term: 'Bayes y tasa base', simple: 'Con fraude tan raro, aunque el detector sea bueno, muchas alarmas pueden ser falsas solo por la rareza.' },
  { cat: 'Motor', term: 'MinCovDet', simple: 'Forma de calcular "lo normal" ignorando extremos. Aquí salió peor, así que no se usa.' },
  { cat: 'Motor', term: 'Determinista', simple: 'Si repetimos el proceso, da exactamente el mismo resultado (nada al azar sin control).' },
]

const CATS: ('Todos' | Cat)[] = ['Todos', 'Datos', 'Métricas', 'Señales', 'Motor']

export default function Glossary() {
  const [cat, setCat] = useState<'Todos' | Cat>('Todos')
  const [q, setQ] = useState('')
  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    return TERMS.filter(t => (cat === 'Todos' || t.cat === cat) &&
      (!s || t.term.toLowerCase().includes(s) || t.simple.toLowerCase().includes(s)))
  }, [cat, q])
  return (
    <div>
      <div className="gl-tools">
        <div className="seg" role="group" aria-label="Categoría">
          {CATS.map(c => <button key={c} className={cat === c ? 'on' : ''} onClick={() => setCat(c)}>{c}</button>)}
        </div>
        <label className="gl-search"><Search size={15} aria-hidden />
          <input type="search" placeholder="Buscar término…" value={q} onChange={e => setQ(e.target.value)} aria-label="Buscar en el glosario" /></label>
      </div>
      <div className="gloss">
        {list.map(t => (
          <details key={t.term}>
            <summary><span>{t.term}</span><span className={`gl-cat gl-${t.cat}`}>{t.cat}</span></summary>
            <p>{t.simple}</p>
            {t.tech && <p className="gloss-extra"><code>{t.tech}</code></p>}
          </details>
        ))}
        {list.length === 0 && <p className="muted">Ningún término coincide.</p>}
      </div>
      <p className="muted small">{list.length} de {TERMS.length} términos.</p>
    </div>
  )
}
