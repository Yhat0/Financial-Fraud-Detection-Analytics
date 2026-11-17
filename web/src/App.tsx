import { useState, type ReactNode } from 'react'
import { Activity, BookOpen, FlaskConical, History, LayoutDashboard, ShieldAlert, ShieldCheck } from 'lucide-react'
import Alerts from './components/Alerts'
import Learn from './components/Learn'
import Overview from './components/Overview'
import Story from './components/Story'
import Timeline from './components/Timeline'
import TryScore from './components/TryScore'
import { PageHeader } from './components/ui'
import './extra.css'
import './theme.css'
import './learn.css'

const TABS: { id: string; label: string; icon: ReactNode; intro: string; el: ReactNode }[] = [
  { id: 'learn', label: 'Aprende', icon: <BookOpen size={17} />,
    intro: 'Qué hace este detector y qué significan los números, explicado desde cero y sin tecnicismos.', el: <Learn /> },
  { id: 'overview', label: 'Resumen', icon: <LayoutDashboard size={17} />,
    intro: 'Los números clave de las alertas: cuántas hay, cuántas aciertan y cuánto dinero estaba en juego.', el: <Overview /> },
  { id: 'timeline', label: 'Línea de tiempo', icon: <Activity size={17} />,
    intro: '¿Cuándo hubo que actuar? Alertas por día u hora frente a los fraudes reales.', el: <Timeline /> },
  { id: 'alerts', label: 'Alertas', icon: <ShieldAlert size={17} />,
    intro: 'Explora cada alerta: filtra por nivel, tipo o fraude real y abre el detalle con los saldos.', el: <Alerts /> },
  { id: 'score', label: 'Probar transacción', icon: <FlaskConical size={17} />,
    intro: 'Escribe una transferencia y mira, en vivo, qué probabilidad de fraude le asigna el modelo.', el: <TryScore /> },
  { id: 'story', label: 'Qué pasó', icon: <History size={17} />,
    intro: 'La historia del proyecto: hitos, tres giros de la trama y lo que de verdad aportan las pistas.', el: <Story /> },
]

export default function App() {
  const [tab, setTab] = useState('learn')
  const cur = TABS.find(t => t.id === tab) ?? TABS[0]
  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo" aria-hidden><ShieldCheck size={16} /></span>
          <span>Fraud Monitor <small>demo PaySim</small></span>
        </div>
        <nav aria-label="Secciones">
          {TABS.map(t => (
            <button key={t.id} className={t.id === tab ? 'on' : ''} onClick={() => setTab(t.id)}
              aria-current={t.id === tab ? 'page' : undefined}>
              {t.icon}<span>{t.label}</span>
            </button>
          ))}
        </nav>
      </header>
      <main key={cur.id} className="page">
        <PageHeader icon={cur.icon} title={cur.label} intro={cur.intro} />
        {cur.el}
      </main>
      <footer>
        Demo sobre el dataset sintético PaySim; las métricas reflejan un artefacto del simulador, no desempeño en datos reales.
      </footer>
    </div>
  )
}
