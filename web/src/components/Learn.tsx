import { useEffect, useRef, useState } from 'react'
import { Check, GraduationCap } from 'lucide-react'
import { L1, L2, L3, L4, L5, L6, L7, L8, L9, L10, LESSONS } from './learn/Lessons'

const reduced = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

function useCourse() {
  const [active, setActive] = useState(LESSONS[0].id)
  const [seen, setSeen] = useState<ReadonlySet<string>>(new Set([LESSONS[0].id]))
  const [progress, setProgress] = useState(0)
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>('[data-lesson]'))
    const spy = new IntersectionObserver(entries => {
      for (const e of entries) {
        if (e.isIntersecting) {
          setActive(e.target.id)
          setSeen(prev => (prev.has(e.target.id) ? prev : new Set(prev).add(e.target.id)))
        }
      }
    }, { rootMargin: '-25% 0px -65% 0px' })
    const reveal = new IntersectionObserver(entries => {
      for (const e of entries) if (e.isIntersecting) { e.target.classList.add('in'); reveal.unobserve(e.target) }
    }, { threshold: 0.06 })
    els.forEach(el => { spy.observe(el); reveal.observe(el) })

    const onScroll = () => {
      const el = root.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const total = r.height - window.innerHeight * 0.6
      setProgress(Math.min(1, Math.max(0, (window.innerHeight * 0.3 - r.top) / Math.max(total, 1))))
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => { spy.disconnect(); reveal.disconnect(); window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll) }
  }, [])

  const go = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' })
  }
  return { active, seen, progress, root, go }
}

export default function Learn() {
  const { active, seen, progress, root, go } = useCourse()
  return (
    <div className="stack gap-lg">
      <section className="course-hero">
        <div className="course-hero-ico"><GraduationCap size={30} /></div>
        <div>
          <span className="eyebrow">Mini-curso · 10 lecciones</span>
          <h3>Aprende cómo piensa un detector de fraude</h3>
        </div>
      </section>

      <div className="course" ref={root}>
        <aside className="toc" aria-label="Índice del curso">
          <div className="toc-top"><span>Tu progreso</span><b>{Math.round(progress * 100)}%</b></div>
          <div className="toc-bar" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
            <span style={{ width: `${progress * 100}%` }} />
          </div>
          <ol>
            {LESSONS.map((l, i) => (
              <li key={l.id}>
                <button className={`${active === l.id ? 'on' : ''} ${seen.has(l.id) && active !== l.id ? 'seen' : ''}`} onClick={() => go(l.id)}
                  aria-current={active === l.id ? 'true' : undefined}>
                  <span className="toc-n">{seen.has(l.id) && active !== l.id ? <Check size={12} /> : i + 1}</span>
                  <span className="toc-t">{l.short}</span>
                </button>
              </li>
            ))}
          </ol>
        </aside>
        <div className="lessons">
          <L1 /><L2 /><L3 /><L4 /><L5 /><L6 /><L7 /><L8 /><L9 /><L10 />
        </div>
      </div>
    </div>
  )
}
