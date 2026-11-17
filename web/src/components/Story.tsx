import type { ReactNode } from 'react'
import { ArrowRight, Check, Flag, TriangleAlert } from 'lucide-react'
import { Card } from './ui'

function Milestone({ n, title, children, twist }: { n: number; title: string; children: ReactNode; twist?: boolean }) {
  return (
    <li className={`ms ${twist ? 'twist' : ''}`}>
      <span className="ms-dot">{twist ? '!' : n}</span>
      <div className="ms-body">
        <h4>{title}</h4>
        {children}
      </div>
    </li>
  )
}

function BeforeAfter({ before, after, bLabel, aLabel }: { before: ReactNode; after: ReactNode; bLabel: string; aLabel: string }) {
  return (
    <div className="ba">
      <div className="ba-b"><span className="ba-l">{bLabel}</span>{before}</div>
      <ArrowRight className="ba-arrow" size={22} aria-hidden />
      <div className="ba-a"><span className="ba-l">{aLabel}</span>{after}</div>
    </div>
  )
}

const ABL: { name: string; auprc: number; tone: 'red' | 'blue' | 'green' | 'gray' | 'warn'; note: string }[] = [
  { name: 'Regla trivial de saldos (2 condiciones)', auprc: 0.97, tone: 'warn', note: 'El "techo facil" artificial de PaySim' },
  { name: 'Rareza limpia (maha_clean, sin el truco)', auprc: 0.19, tone: 'blue', note: 'Lo que la geometria aporta de verdad' },
  { name: 'Destino nuevo (red) sola', auprc: 0.04, tone: 'green', note: 'Floja sola' },
  { name: 'Fusion limpia (rareza + red)', auprc: 0.27, tone: 'gray', note: 'Las dos pistas honestas juntas' },
  { name: 'Fusion completa (con el truco)', auprc: 0.995, tone: 'red', note: 'Inflada por el artefacto' },
]

function AblationTable() {
  return (
    <div className="abl">
      {ABL.map(r => (
        <div key={r.name} className="abl-row">
          <div className="abl-name">{r.name}<small>{r.note}</small></div>
          <div className="abl-bar"><div className={`abl-fill ${r.tone}`} style={{ width: `${r.auprc * 100}%` }} /></div>
          <div className="abl-val">{r.auprc.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 3 })}</div>
        </div>
      ))}
      <p className="muted small">AUPRC en el examen; la tasa base es 0,0056.</p>
    </div>
  )
}

export default function Story() {
  return (
    <div className="stack gap-lg">
      <Card className="hero">
        <div className="hero-ico"><Flag size={26} /></div>
        <div>
          <h3>La historia, con sus giros</h3>
          <p>Construimos un detector con dos pistas estadisticas y lo probamos de forma honesta. En el camino hubo
            <strong> tres giros de la trama</strong> que cambiaron lo que creiamos saber.</p>
        </div>
      </Card>

      <ol className="timeline-v">
        <Milestone n={1} title="Preparar los datos y partir estudio / examen">
          <p>Cargamos PaySim, nos quedamos con TRANSFER y CASH_OUT (donde vive el fraude), ordenamos por tiempo y partimos en
            estudio y examen sin dejar que el detector espie el futuro.</p>
        </Milestone>
        <Milestone n={2} title="Pista 1: medidor de rareza (Mahalanobis)">
          <p>Un medidor de rareza separa muy bien lo "muy sospechoso" de lo "claramente limpio": AUPRC <strong>0,18</strong> (~32x el azar).
            Una version robusta (MinCovDet) salio peor, asi que no se uso.</p>
        </Milestone>

        <Milestone n={0} twist title="Giro 1: el examen era demasiado pequeno">
          <p>En PaySim el volumen legitimo se desploma al final del mes pero el fraude sigue igual. Con el corte viejo, el examen
            quedaba diminuto y daba notas enganosas. Movimos el corte.</p>
          <BeforeAfter bLabel="Antes (step 552)" aLabel="Despues (step 323)"
            before={<><strong>81.727</strong><small>transferencias en el examen (3% de los datos)</small></>}
            after={<><strong>818.514</strong><small>transferencias en el examen (~30%)</small></>} />
        </Milestone>

        <Milestone n={3} title="Pista 2: destino nuevo (red)">
          <p>Medimos a cuanta gente distinta le habia llegado dinero a cada cuenta destino antes (<em>fan_in</em>). Sola es floja
            (AUPRC <strong>0,04</strong>) pero mira algo distinto a la Pista 1.</p>
        </Milestone>

        <Milestone n={0} twist title="Giro 2: la corazonada de las mulas estaba al reves">
          <p>Esperabamos "buzones mula": cuentas con muchos remitentes. En PaySim es lo contrario: el fraude va a cuentas
            <strong> nuevas</strong> de "usar y tirar".</p>
          <BeforeAfter bLabel="Lo que esperabamos" aLabel="Lo que paso"
            before={<><strong>Mulas</strong><small>muchos ladrones &rarr; un buzon compartido</small></>}
            after={<><strong>67% sin historial</strong><small>de 8.169 destinos de fraude, solo 44 reciben mas de uno (maximo 2)</small></>} />
        </Milestone>

        <Milestone n={4} title="Fusion de las dos pistas">
          <p>Combinamos las pistas con un modelo que aprende. El resultado parece espectacular: AUPRC <strong>0,995</strong>.</p>
        </Milestone>

        <Milestone n={0} twist title="Giro 3: el 99% era un truco de PaySim">
          <p>Casi toda esa nota no venia de nuestras pistas sino de las variables de saldo. En PaySim el ladron <strong>siempre vacia
            la cuenta al centavo</strong> y eso deja una huella:</p>
          <ul className="bul">
            <li><strong>99,5%</strong> de los fraudes tienen los saldos cuadrados exactos vs <strong>9,9%</strong> de lo legitimo.</li>
            <li><strong>97,8%</strong> mandan exactamente todo su saldo vs <strong>0,0%</strong> de lo legitimo.</li>
            <li>Una regla de dos lineas ("cuenta en 0" + "saldos cuadran") logra <strong>precision 100% / recall 97,5%</strong>.</li>
          </ul>
          <BeforeAfter bLabel="Con el truco" aLabel="Sin el truco (ciencia honesta)"
            before={<><strong>0,995</strong><small>AUPRC de la fusion completa</small></>}
            after={<><strong>0,19 a 0,27</strong><small>AUPRC de las pistas reales</small></>} />
        </Milestone>

        <Milestone n={5} title="La app: Python + API .NET + este tablero">
          <p>Con el modelo de fusion completo se construyo un demo: un servicio de scoring en vivo (Python), una API (.NET) y este tablero (React).
            Para una demostracion funciona muy bien; solo hay que leerlo con la honestidad de arriba.</p>
        </Milestone>
      </ol>

      <Card title="La tabla honesta: ¿que queda sin el truco?">
        <p className="small">Quitamos el truco de saldos y medimos que aportan de verdad las dos pistas estadisticas.</p>
        <AblationTable />
      </Card>

      <section className="grid2">
        <Card title="Conclusiones honestas" className="concl">
          <ul className="bul">
            <li><strong>~73-95% del 0,995 era artefacto del simulador</strong>, no ciencia. Una regla de 2 lineas ya saca 0,97.</li>
            <li>Las "magnitudes" (montos/saldos) tampoco estan limpias: <code>newbalanceOrig=0</code> y <code>ratioMonto≈1</code> vuelven a codificar el mismo vaciado. Las unicas cifras realmente limpias son 0,19-0,27.</li>
            <li>La pista de red si aporta un poco sobre la rareza sola (0,19 &rarr; 0,27), pero es modesto y <strong>no robusto</strong>: un metodo estandar (Isolation Forest, 0,24) iguala a la fusion limpia.</li>
            <li><strong>Deteccion temprana:</strong> casi no hay episodios de varias transacciones (8.125 fraudes de 1 sola tx; solo 44 de 2), asi que no se puede medir anticipacion real.</li>
          </ul>
        </Card>
        <Card title="¿Que sigue?" className="next">
          <p className="small"><TriangleAlert size={16} className="inline-ico" /> PaySim no sirve para demostrar que nuestras pistas estadisticas funcionan: es
            <em> demasiado facil</em> por el truco y <em>demasiado debil</em> por el lado real.</p>
          <p className="small"><Check size={16} className="inline-ico" /> Para probarlas en serio hace falta un dataset real, por ejemplo <strong>IEEE-CIS</strong>.
            Ahi se validaria si rareza + destino nuevo sostienen su aporte sin ningun atajo de simulador.</p>
        </Card>
      </section>
    </div>
  )
}
