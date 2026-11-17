import { useState, type ReactNode } from 'react'
import {
  ArrowRight, Bell, Calculator, Database, Filter, GitMerge, Radar, Scissors, Clock, Network,
  ShieldCheck, Search, Siren, Sigma, TrendingUp, Scale,
} from 'lucide-react'
import Glossary from './Glossary'
import { Bars, Callout, Confusion, FanInViz, MahalanobisViz, PrCurve, RareDots } from './Visuals'

export interface LessonMeta { id: string; short: string; title: string; lead: string }

export const LESSONS: LessonMeta[] = [
  { id: 'l1', short: 'El problema', title: 'El problema y el dataset', lead: 'Buscamos una aguja en un pajar de 6 millones de transferencias.' },
  { id: 'l2', short: 'Clase rara', title: 'La trampa de la clase rara', lead: 'Por qué "acertar el 99,9%" puede no servir de nada.' },
  { id: 'l3', short: 'Pista 1', title: 'Pista 1: ¿transferencia rara?', lead: 'Un medidor de rareza que entiende la forma de lo normal.' },
  { id: 'l4', short: 'Pista 2', title: 'Pista 2: ¿destino nuevo?', lead: 'Mirar a quién le llega el dinero, no solo cuánto.' },
  { id: 'l5', short: 'Umbrales', title: 'Umbrales con fundamento', lead: 'Dónde poner la raya de la alarma, sin hacerlo "a ojo".' },
  { id: 'l6', short: 'Datos', title: 'El camino de los datos', lead: 'De un archivo gigante a una alerta, paso a paso.' },
  { id: 'l7', short: 'Regla de oro', title: 'La regla de oro: no hacer trampa', lead: 'El detector solo puede mirar el pasado.' },
  { id: 'l8', short: 'Medición', title: 'Cómo se mide', lead: 'Deciles, lift y la curva precisión-recall.' },
  { id: 'l9', short: 'ISO 37003', title: 'El marco normativo', lead: 'Dónde encaja este proyecto en la norma ISO.' },
  { id: 'l10', short: 'Glosario', title: 'Glosario', lead: 'Todas las palabras difíciles, en palabras fáciles.' },
]

export function Lesson({ meta, n, children }: { meta: LessonMeta; n: number; children: ReactNode }) {
  return (
    <section id={meta.id} className="lesson reveal" data-lesson>
      <header className="lesson-head">
        <span className="lesson-n">{n}</span>
        <div><span className="lesson-k">Lección {n} de {LESSONS.length}</span><h3>{meta.title}</h3></div>
      </header>
      <p className="lesson-lead">{meta.lead}</p>
      <div className="lesson-body">{children}</div>
    </section>
  )
}

const M = (id: string) => LESSONS.find(l => l.id === id)!

/* ---------------- L1 ---------------- */
export function L1() {
  const cols = [
    ['step', 'La hora (1 a 743, es decir 31 días).'], ['type', 'Tipo de operación.'], ['amount', 'Cuánto dinero se mueve.'],
    ['nameOrig', 'Quién envía.'], ['nameDest', 'Quién recibe.'], ['oldbalance… / newbalance…', 'Saldos antes y después (origen y destino).'],
    ['isFraud', 'La verdad: ¿fue fraude? (la "respuesta del examen").'],
  ]
  return (
    <Lesson meta={M('l1')} n={1}>
      <p><strong>Detectar fraude</strong> es avisar cuando una transferencia de dinero huele a robo. Es como ser el guardia de un museo: miras
        a miles de visitantes y tienes que fijarte en el que actúa raro, <em>antes</em> de que se lleve el cuadro.</p>
      <p>Para practicar usamos <strong>PaySim</strong>: transferencias de dinero móvil <strong>inventadas por simulación</strong> (no hay personas reales).
        Tiene <strong>6.362.620</strong> transacciones repartidas en <strong>31 días</strong>.</p>
      <div className="grid2">
        <div>
          <h4>Qué trae cada fila</h4>
          <dl className="dl dl-tight">
            {cols.map(([k, v]) => <div key={k}><dt><code>{k}</code></dt><dd>{v}</dd></div>)}
          </dl>
        </div>
        <div>
          <h4>El fraude es rarísimo</h4>
          <RareDots />
        </div>
      </div>
      <div className="grid2">
        <Callout kind="fact" title="Dónde vive el fraude">
          Solo hay fraude en <strong>TRANSFER</strong> y <strong>CASH_OUT</strong>. En PAYMENT, CASH_IN y DEBIT hay <strong>0 fraudes</strong>. Por eso
          filtramos y nos quedamos con esos dos tipos: <strong>2.770.409</strong> transacciones, de las cuales <strong>8.213</strong> son fraude.
        </Callout>
        <Callout kind="tip">
          Como el fraude es solo ~0,13% (cerca de <strong>1 de cada 775</strong>), casi todo el diseño del detector sale de esa rareza. La siguiente lección
          explica por qué.
        </Callout>
      </div>
    </Lesson>
  )
}

/* ---------------- L2 ---------------- */
export function L2() {
  return (
    <Lesson meta={M('l2')} n={2}>
      <p>Imagina un detector que <strong>siempre dice "legítimo"</strong>. Con fraude al 0,129% acertaría en el <strong>99,87%</strong> de los casos…
        y no atraparía <strong>ningún</strong> robo. Por eso <strong>nunca usamos "accuracy"</strong> (porcentaje de aciertos) en este problema.</p>
      <Bars rows={[
        { label: 'Siempre dice "legítimo": aciertos', value: 99.87, show: '99,87%' },
        { label: 'Siempre dice "legítimo": robos atrapados', value: 0, show: '0%' },
      ]} max={100} />
      <h4>Los dos errores posibles (toca los botones)</h4>
      <Confusion />
      <div className="grid2">
        <Callout kind="tip" title="Precisión, en una frase">Cuando el detector grita "¡robo!", ¿cuántas veces tiene razón? Si es baja, molestas a muchos clientes buenos.</Callout>
        <Callout kind="tip" title="Recall, en una frase">De todos los ladrones que hay, ¿a cuántos atrapas? Si es bajo, se te escapan robos.</Callout>
      </div>
      <Callout kind="warn" title="AUPRC: la nota correcta">
        Precisión y recall se mueven en sentido contrario: pedir más de una suele costar la otra. <strong>AUPRC</strong> junta las dos en una sola nota para
        eventos raros. Siempre se lee <strong>contra la tasa base</strong>: un AUPRC de 0,18 parece bajo, pero frente a 0,0056 es ~32 veces mejor que adivinar.
        Además, por la rareza (tasa base), aunque el detector sea bueno, muchas alarmas pueden ser falsas: es la "falacia de la tasa base" (Bayes).
      </Callout>
    </Lesson>
  )
}

/* ---------------- L3 ---------------- */
export function L3() {
  return (
    <Lesson meta={M('l3')} n={3}>
      <p>La <strong>Pista 1</strong> responde: <em>¿esta transferencia se parece a las normales o es rara?</em> Para eso mide qué tan lejos está del
        "centro" de lo normal. Su nombre técnico es <strong>distancia de Mahalanobis</strong>.</p>
      <Callout kind="tip" title="La idea en una frase">
        Mahalanobis es una distancia "en desviaciones estándar corregidas por correlación": tiene en cuenta la <strong>forma</strong> de la nube de datos
        normales, no solo la distancia en línea recta.
      </Callout>
      <MahalanobisViz />
      <div className="grid2">
        <div className="mini"><strong>¿Por qué importa?</strong> El monto y los saldos se mueven juntos (si el saldo es grande, los montos también). Una regla
          ignora eso y se confunde; Mahalanobis lo corrige.</div>
        <div className="mini"><strong>¿Con qué se calcula?</strong> Con 7 variables (montos, saldos y errores de saldo) y un "modelo de normalidad" ajustado
          <em> solo con transferencias legítimas del estudio</em>.</div>
      </div>
      <Callout kind="fact">
        En el examen, la mediana de rareza del robo es <strong>8,45</strong> frente a <strong>1,74</strong> de lo normal. Sola, la Pista 1 saca AUPRC
        <strong> 0,18</strong> (~32× el azar). Una versión "robusta" (MinCovDet) salió peor, por eso no se usa.
      </Callout>
    </Lesson>
  )
}

/* ---------------- L4 ---------------- */
export function L4() {
  return (
    <Lesson meta={M('l4')} n={4}>
      <p>La <strong>Pista 2</strong> no mira cuánto dinero se mueve, sino <strong>a quién le llega</strong>. Dibuja un mapa (grafo) de cuentas y se pregunta:
        <em> ¿este destino es una cuenta nueva sin historial?</em></p>
      <p>El número clave es <strong><code>fan_in</code></strong>: cuántos remitentes <em>distintos</em> le habían enviado dinero a esa cuenta antes.</p>
      <FanInViz />
      <Callout kind="fact" title="Hallazgo: la corazonada estaba al revés">
        Esperábamos "cuentas mula" (muchos remitentes). En PaySim es lo contrario: el <strong>67%</strong> de los fraudes va a una cuenta <strong>sin
        historial previo</strong>. De 8.169 cuentas que reciben fraude, solo <strong>44</strong> reciben más de uno (máximo 2). No hay mulas.
      </Callout>
      <h4>Tasa de robo según fan_in (en el examen)</h4>
      <Bars unit="%" rows={[
        { label: 'fan_in 0–1 (cuenta nueva)', value: 1.29, show: '1,29%', sub: ' · 2,3×' },
        { label: 'fan_in 2', value: 0.27, show: '0,27%', sub: ' · 0,5×' },
        { label: 'fan_in 3', value: 0.25, show: '0,25%', sub: ' · 0,4×' },
        { label: 'fan_in 4–5', value: 0.22, show: '0,22%', sub: ' · 0,4×' },
        { label: 'fan_in 6–14', value: 0.19, show: '0,15–0,19%', sub: ' · 0,3×' },
        { label: 'fan_in 15+', value: 0.18, show: '0,18%', sub: ' · 0,3×' },
      ]} hot="fan_in 0–1 (cuenta nueva)" />
      <Callout kind="tip">
        Sola esta pista es floja (AUPRC <strong>0,04</strong>), pero mira algo <em>distinto</em> a la Pista 1. Por eso tiene sentido juntarlas: una atrapa
        "lo raro", la otra "lo nuevo".
      </Callout>
    </Lesson>
  )
}

/* ---------------- L5 ---------------- */
function Theory({ icon, name, tech, what, use, tone }: { icon: ReactNode; name: string; tech: string; what: string; use: string; tone: string }) {
  return (
    <article className={`theory ${tone}`}>
      <div className="theory-ico">{icon}</div>
      <h4>{name}</h4><span className="tech">{tech}</span>
      <p>{what}</p>
      <p className="theory-use"><strong>¿Para qué sirve?</strong> {use}</p>
    </article>
  )
}
export function L5() {
  return (
    <Lesson meta={M('l5')} n={5}>
      <p>Un detector necesita una <strong>raya</strong>: "por encima de aquí, suena la alarma". Poner esa raya "a ojo" es mala idea. Por eso nos apoyamos
        en tres ideas de las matemáticas, cada una responde una pregunta distinta.</p>
      <div className="theories">
        <Theory tone="t1" icon={<Sigma size={22} />} name="Chi-cuadrado (χ²)" tech="Mahalanobis² ~ χ², Hotelling T²"
          what="Si la nube de datos normales fuera una campana perfecta, la distancia al cuadrado sigue una regla conocida (χ²) que dice cuánto es 'demasiado lejos'."
          use="Fijar el umbral de la Pista 1 con una cuenta exacta (para 7 variables: d > 4,30) en vez de un percentil a ojo." />
        <Theory tone="t2" icon={<TrendingUp size={22} />} name="Valores extremos (EVT)" tech="Distribución de Pareto Generalizada"
          what="En vez de estudiar lo normal, estudia directamente la cola: cómo se comportan los casos más raros por encima de un valor alto."
          use="Poner umbrales del tipo 'esto es extremo con probabilidad p' incluso para eventos rarísimos." />
        <Theory tone="t3" icon={<Scale size={22} />} name="Neyman–Pearson" tech="Lema de Neyman–Pearson"
          what="Para un nivel fijo de falsas alarmas, existe una regla que atrapa el máximo posible de fraude."
          use="Elegir el mejor equilibrio entre atrapar robos y no molestar a clientes buenos." />
      </div>
      <Callout kind="fact" title="Qué se aplicó de verdad">
        En el código actual comparamos el umbral χ² (d &gt; 4,30) con el percentil 99 de lo legítimo (d &gt; 6,62). Salen distintos porque la nube <em>no es
        una campana perfecta</em> (por eso transformamos montos con logaritmo). Los cortes de las alertas se calibran buscando una precisión objetivo con datos
        de estudio. EVT y la versión completa de Neyman–Pearson son el respaldo teórico del plan y quedan como mejora futura.
      </Callout>
    </Lesson>
  )
}

/* ---------------- L6 ---------------- */
const STEPS: { icon: ReactNode; title: string; short: string; detail: string }[] = [
  { icon: <Database size={20} />, title: 'CSV de PaySim', short: '6,3 M de transferencias', detail: 'Todo empieza con un archivo enorme de transferencias de dinero simuladas (PaySim): 6,3 millones de filas.' },
  { icon: <Filter size={20} />, title: 'Filtrar', short: 'Solo TRANSFER y CASH_OUT', detail: 'El fraude solo vive en dos tipos de movimiento: TRANSFER y CASH_OUT. Nos quedamos solo con esos.' },
  { icon: <Clock size={20} />, title: 'Ordenar por tiempo', short: 'La columna step = hora', detail: 'Ordenamos de la hora más vieja a la más nueva. Así jugamos limpio: el pasado solo explica el presente.' },
  { icon: <Scissors size={20} />, title: 'Estudio y examen', short: 'Train 70% / Test 30%', detail: 'Estudiamos con lo más viejo (train) y nos examinamos con lo más nuevo, escondido (test). El corte está en el step 323.' },
  { icon: <Calculator size={20} />, title: 'Crear variables', short: 'Errores de saldo, logs, ratios', detail: 'Calculamos datos útiles de cada transferencia: si los saldos cuadran, qué parte de la cuenta se movió, etc.' },
  { icon: <Radar size={20} />, title: 'Dos pistas', short: 'Rareza + destino nuevo', detail: 'Pista 1: ¿la transferencia es rara? Pista 2: ¿el destino es una cuenta nueva? Cada una mira algo distinto.' },
  { icon: <GitMerge size={20} />, title: 'Fusión', short: 'Combinar las pistas', detail: 'Un modelo (regresión logística) combina las pistas y los datos de saldo en una sola probabilidad de fraude.' },
  { icon: <Bell size={20} />, title: 'Alerta', short: 'ALTA / MEDIA / ninguna', detail: 'Si la probabilidad supera ciertos umbrales suena la alerta: ALTA para actuar, MEDIA para revisar.' },
]
export function L6() {
  const [open, setOpen] = useState(0)
  return (
    <Lesson meta={M('l6')} n={6}>
      <p>Así viaja un dato desde el archivo crudo hasta convertirse en una alerta. <strong>Toca un paso</strong> para ver qué pasa en él.</p>
      <ol className="pipe">
        {STEPS.map((s, i) => (
          <li key={s.title} className={i === open ? 'on' : ''}>
            <button onClick={() => setOpen(i)} aria-pressed={i === open}>
              <span className="pipe-n">{i + 1}</span><span className="pipe-ico">{s.icon}</span>
              <span className="pipe-t">{s.title}</span><span className="pipe-s">{s.short}</span>
            </button>
            {i < STEPS.length - 1 && <ArrowRight className="pipe-arrow" size={16} aria-hidden />}
          </li>
        ))}
      </ol>
      <p className="pipe-detail"><strong>{STEPS[open].title}.</strong> {STEPS[open].detail}</p>
      <h4>Estudio y examen (split temporal)</h4>
      <p>Para saber si el detector sirve, estudia con unas transferencias y se examina con otras escondidas, separadas por <strong>tiempo</strong> (como
        en la vida real: el pasado predice el futuro).</p>
      <div className="split" role="img" aria-label="70% train, 30% test">
        <div className="split-train">Train 70%<small>1.951.895 filas</small></div>
        <div className="split-test">Test 30%<small>818.514</small></div>
      </div>
      <p className="muted small">Corte en el step 323 (de 743). Hay 4.570 fraudes en el examen. Antes se cortaba en el step 552 y el examen quedaba diminuto
        (81.727 filas): lo agrandamos para tener notas de fiar.</p>
      <h4>El detector, de un vistazo</h4>
      <div className="fuse">
        <div className="fuse-in"><span className="chip chip-maha">Pista 1</span> + <span className="chip chip-red">Pista 2</span></div>
        <ArrowRight size={18} aria-hidden />
        <div className="fuse-out">
          <span className="badge badge-alta">ALTA</span> actuar / retener · <span className="badge badge-media">MEDIA</span> revisar · <span className="badge badge-none">sin alerta</span> dejar pasar
        </div>
      </div>
      <p className="muted small">Idea: sospechosa si una pista se dispara, casi segura si coinciden. En esta app el nivel sale de un modelo que combina las pistas
        con los datos de saldo en una probabilidad.</p>
    </Lesson>
  )
}

/* ---------------- L7 ---------------- */
export function L7() {
  return (
    <Lesson meta={M('l7')} n={7}>
      <p>El detector <strong>solo puede mirar el pasado</strong>. Nunca puede espiar transferencias que, en la vida real, todavía no habrían ocurrido. Hacerlo se llama
        <strong> leakage</strong> (fuga de información) y vuelve inútiles los resultados: sería como examinarte con las respuestas a la vista.</p>
      <div className="timeflow" role="img" aria-label="pasado permitido, presente, futuro prohibido">
        <div className="tf past"><span /><span /><span />pasado<small>permitido</small></div>
        <div className="tf now">ahora<small>evalúo esta</small></div>
        <div className="tf future"><span /><span />futuro<small>prohibido</small></div>
      </div>
      <div className="grid2">
        <Callout kind="fact" title="Cómo lo comprobamos">
          Las 509.565 primeras transferencias hacia una cuenta nueva tienen historial = 0. El detector nunca se incluye a sí mismo en sus propias cuentas, y las
          estadísticas del "modelo de normalidad" se calculan solo con datos del estudio.
        </Callout>
        <Callout kind="tip">
          Por eso partimos por <strong>tiempo</strong> y no al azar. Aquí el corte no simula que el fraude "evolucione" (en PaySim es casi igual todo el mes): su papel
          es evitar esta trampa.
        </Callout>
      </div>
    </Lesson>
  )
}

/* ---------------- L8 ---------------- */
export function L8() {
  const rows = [
    { label: 'Grupo 1', value: 0, show: '0%', sub: ' · 0×' }, { label: 'Grupo 2', value: 0, show: '0%', sub: ' · 0×' },
    { label: 'Grupo 3', value: 0, show: '0%', sub: ' · 0×' }, { label: 'Grupo 4', value: 0, show: '0%', sub: ' · 0×' },
    { label: 'Grupo 5', value: 0, show: '0%', sub: ' · 0×' },
    { label: 'Grupo 6', value: 0.12, show: '0,12%', sub: ' · 0,2×' }, { label: 'Grupo 7', value: 0.69, show: '0,69%', sub: ' · 1,2×' },
    { label: 'Grupo 8', value: 0.4, show: '0,40%', sub: ' · 0,7×' }, { label: 'Grupo 9', value: 0.74, show: '0,74%', sub: ' · 1,3×' },
    { label: 'Grupo 10', value: 3.63, show: '3,63%', sub: ' · 6,5×' },
  ]
  return (
    <Lesson meta={M('l8')} n={8}>
      <h4>Deciles y lift</h4>
      <p>Ordenamos todas las transferencias del examen de la <strong>menos rara</strong> (grupo 1) a la <strong>más rara</strong> (grupo 10), en 10 grupos iguales,
        y miramos qué porcentaje de cada grupo era robo. El <strong>lift</strong> es cuántas veces mejor que la tasa base (0,56%).</p>
      <Bars rows={rows} hot="Grupo 10" />
      <div className="grid2">
        <Callout kind="fact">El <strong>grupo 10</strong> concentra <strong>2.968</strong> de los 4.570 robos (3,63% de tasa, lift 6,5×) y los grupos 1 a 5 están limpios: 0 robos.</Callout>
        <Callout kind="tip">Traducción: el detector es excelente separando "muy sospechoso" de "claramente limpio", pero flojo en la zona media.</Callout>
      </div>
      <h4>La curva precisión-recall</h4>
      <PrCurve />
    </Lesson>
  )
}

/* ---------------- L9 ---------------- */
export function L9() {
  const pillars = [
    { icon: <ShieldCheck size={22} />, name: 'Prevención', desc: 'Evitar que el fraude ocurra.', on: false },
    { icon: <Search size={22} />, name: 'Detección temprana', desc: 'Notar la anomalía cuanto antes.', on: true },
    { icon: <Siren size={22} />, name: 'Respuesta eficaz', desc: 'Actuar bien cuando ya pasó.', on: false },
  ]
  return (
    <Lesson meta={M('l9')} n={9}>
      <p><strong>ISO 37003:2025</strong> es una norma internacional (guía, no certificable) sobre cómo gestionar el riesgo de fraude. Organiza el control del fraude en
        tres capacidades:</p>
      <div className="pillars">
        {pillars.map(p => (
          <div key={p.name} className={`pillar ${p.on ? 'on' : ''}`}>
            <div className="pillar-ico">{p.icon}</div><h4>{p.name}</h4><p>{p.desc}</p>
            {p.on && <span className="badge badge-here">Aquí vive este proyecto</span>}
          </div>
        ))}
      </div>
      <Callout kind="fact">
        Nuestro objetivo —detectar la anomalía <em>antes</em> de que drene más dinero o se bloquee de más— coincide con el pilar de
        <strong> detección temprana</strong>. El proyecto es un control de detección temprana basado en datos, evaluado con métricas adecuadas para eventos raros
        (AUPRC, validación temporal).
      </Callout>
      <Callout kind="warn" title="Ojo">En PaySim casi no hay episodios de varias transacciones (8.125 fraudes de 1 sola transacción; solo 44 de 2), así que aquí no se puede medir
        "anticipación" real.</Callout>
    </Lesson>
  )
}

/* ---------------- L10 ---------------- */
export function L10() {
  return (
    <Lesson meta={M('l10')} n={10}>
      <p>Toca un término para ver su explicación simple. Puedes filtrar por categoría o buscar.</p>
      <Glossary />
      <p className="muted small"><Network size={14} className="inline-ico" /> ¿Quieres ver cómo termina la historia? Ve a la pestaña <strong>Qué pasó</strong>.</p>
    </Lesson>
  )
}
