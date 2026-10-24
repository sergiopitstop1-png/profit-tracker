'use client'
// 24/10/2026 — Sulle pagine del Profit Tracker diverse dalla principale (Segnali, Archivio Lucy, Da fare…) il pulsante
// "Registra al volo" porta al Profit Tracker con la finestra del Registro manuale già aperta (?registra=1).
// Nella pagina principale non compare: lì c'è già quello vero, dentro ProfitTrackerClient.
import { usePathname } from 'next/navigation'
import { useEffect } from 'react'
import PulsanteRegistra from './PulsanteRegistra'

export default function PulsanteRegistraEsterno() {
  const pathname = usePathname()
  const vai = () => { window.location.href = '/profit-tracker?registra=1' }
  const principale = pathname === '/profit-tracker' || pathname === '/profit-tracker/'
  useEffect(() => {
    if (principale) return
    const tasto = e => { if (e.altKey && !e.ctrlKey && !e.metaKey && String(e.key).toLowerCase() === 'r') { e.preventDefault(); vai() } }
    window.addEventListener('keydown', tasto)
    return () => window.removeEventListener('keydown', tasto)
  }, [principale])
  if (principale) return null
  return <PulsanteRegistra onClick={vai} titolo="Registra al volo (Alt+R): apre il Registro manuale · trascinami dove vuoi" />
}
