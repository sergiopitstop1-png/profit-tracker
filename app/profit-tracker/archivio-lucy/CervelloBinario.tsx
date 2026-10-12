'use client'

// 12/10/2026 · il cervello di 0 e 1 verdi nel banner di Lucy (animato piano, si ferma se il browser chiede meno movimento).
import { useEffect, useRef } from 'react'
import { costruisciCervello, disegnaCervello } from './cervelloBinario'

const COL = 74, RIG = 30, CW = 6, CH = 8

export default function CervelloBinario({ className = '', altezza = 190 }: { className?: string; altezza?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = COL * CW * dpr; canvas.height = RIG * CH * dpr
    ctx.scale(dpr, dpr)
    const celle = costruisciCervello(COL, RIG, COL / RIG)
    const ferma = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    let t = 0, ultimo = 0, id = 0
    const giro = (ora: number) => {
      id = requestAnimationFrame(giro)
      if (ora - ultimo < 90) return   // circa 11 immagini al secondo: leggero
      ultimo = ora; t = ora / 1000
      disegnaCervello(ctx, celle, CW, CH, t, true)
    }
    disegnaCervello(ctx, celle, CW, CH, 0, false)
    if (!ferma) id = requestAnimationFrame(giro)
    return () => cancelAnimationFrame(id)
  }, [])
  return <canvas ref={ref} aria-hidden="true" className={className} style={{ height: altezza, width: 'auto', aspectRatio: `${COL * CW} / ${RIG * CH}` }} />
}
