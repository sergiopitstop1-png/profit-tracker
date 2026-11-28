"use client";
// 28/11/2026 · TAB PERIODI per anno: ogni anno riparte da zero; l'archivio si scarica in Excel.
import React, { useState } from 'react'
import { totaliAnno, aperturaAnno, oggiRoma } from '../../lib/contiAnno'

export default function PeriodiTab({ periodi, snapshots, formatCurrency, formatDate, stili }) {
  const { tabContent, sectionTopBar, sectionTitle, sectionDescription, statCard, statLabel, statValue, statSub, panel, panelHeader, panelTitle, panelSubtitle, tableWrap, tableLarge, th, td, tdStrong, tr } = stili
  const annoOggi = Number(oggiRoma().slice(0, 4))
  const anni = [...new Set([annoOggi, ...periodi.map(p => p.anno)])].sort((a, b) => b - a)
  const [anno, setAnno] = useState(annoOggi)
  const [scarico, setScarico] = useState('')
  const [errore, setErrore] = useState('')
  const righe = periodi.filter(p => p.anno === anno)
  const totali = totaliAnno(periodi, anno)
  const apertura = aperturaAnno(snapshots, anno)
  const chiuso = anno < annoOggi && snapshots.some(s => s.snapshot_date === `${anno}-12-31`)

  async function scaricaArchivio() {
    setErrore(''); setScarico('Preparo il file…')
    try {
      const r = await fetch(`/api/chiusure?anno=${anno}`, { cache: 'no-store' })
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `errore ${r.status}`)
      const nome = /filename="([^"]+)"/.exec(r.headers.get('content-disposition') || '')?.[1] || `archivio_${anno}.xlsx`
      const url = URL.createObjectURL(await r.blob())
      const a = document.createElement('a')
      a.href = url; a.download = nome; document.body.appendChild(a); a.click(); a.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      setErrore('Archivio non scaricato: ' + e.message)
    }
    setScarico('')
  }

  const riquadro = (titolo, valore, sotto, colorato) => (
    <div style={{ ...statCard, ...(colorato ? { borderColor: valore >= 0 ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)' } : {}) }}>
      <div style={statLabel}>{titolo}</div>
      <div style={{ ...statValue, fontSize: 28, ...(colorato ? { color: valore >= 0 ? '#4ade80' : '#f87171' } : {}) }}>{formatCurrency(valore)}</div>
      <div style={statSub}>{sotto}</div>
    </div>
  )
  const bottone = { padding: '8px 14px', borderRadius: 10, border: '1px solid rgba(56,189,248,0.5)', background: 'rgba(56,189,248,0.12)', color: '#7dd3fc', fontWeight: 800, fontSize: 13, cursor: 'pointer' }

  return (
    <div style={tabContent}>
      <div style={sectionTopBar}>
        <div>
          <h2 style={sectionTitle}>Periodi {anno}{chiuso ? ' · 🔒 chiuso' : ''}</h2>
          <p style={sectionDescription}>Chiusura automatica a mezzanotte di fine mese, più i salvataggi fatti con Salva Periodo</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {anni.map(a => (
            <button key={a} onClick={() => setAnno(a)} style={{ ...bottone, ...(a === anno ? { background: 'rgba(56,189,248,0.35)', color: '#f8fafc' } : {}) }}>{a}</button>
          ))}
          <button onClick={scaricaArchivio} disabled={!!scarico} style={{ ...bottone, borderColor: 'rgba(34,197,94,0.5)', background: 'rgba(34,197,94,0.14)', color: '#86efac' }}>
            {scarico || (chiuso ? `⬇️ Excel archivio ${anno}` : `⬇️ Excel ${anno} (anteprima)`)}
          </button>
        </div>
      </div>
      {errore && <div style={{ color: '#fca5a5', fontSize: 13, marginBottom: 10 }}>{errore}</div>}
      {apertura.provvisoria && (
        <div style={{ color: '#fbbf24', fontSize: 13, fontWeight: 700, marginBottom: 10 }}>
          ⚠️ Manca la chiusura del 31/12/{anno - 1}: la cassa di apertura qui sotto è provvisoria.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 16 }}>
        {riquadro('Cassa di apertura', apertura.valore, anno <= 2026 ? 'Base del calcolo del profitto' : `Chiusura del 31/12/${anno - 1}`)}
        {riquadro(`Profitto ${anno}`, totali.profitto, 'Somma dei periodi', true)}
        {riquadro(`Prelievi ${anno}`, totali.prelievi, 'Uscite verso l\'esterno nei periodi')}
        {riquadro(`Cash Flow ${anno}`, totali.cashFlow, 'Profitto − prelievi', true)}
      </div>

      <div style={panel}>
        <div style={panelHeader}>
          <div>
            <h2 style={panelTitle}>Storico periodi {anno}</h2>
            <p style={panelSubtitle}>{righe.length ? `${righe.length} periodi` : 'Nessun periodo ancora: i conti dell\'anno partono da zero'}</p>
          </div>
        </div>
        <div style={tableWrap}>
          <table style={tableLarge}>
            <thead>
              <tr>
                {['ID', 'Data periodo', 'Ora salvataggio', 'Cassa totale', 'Prelievi (periodo)', 'Profitto', 'Cash Flow'].map(t => <th key={t} style={th}>{t}</th>)}
              </tr>
            </thead>
            <tbody>
              {righe.map(s => (
                <tr key={s.id} style={tr}>
                  <td style={td}>{s._fisso ? '-' : s.id}</td>
                  <td style={td}>{s.snapshot_date || '-'}</td>
                  <td style={td}>{s._fisso ? '-' : formatDate(s.created_at)}</td>
                  <td style={td}>{formatCurrency(s.total_cash)}</td>
                  <td style={td}>{formatCurrency(s.prelieviPeriodo)}</td>
                  <td style={tdStrong}>{formatCurrency(s.profittoPeriodo)}</td>
                  <td style={{ ...tdStrong, color: s.cashFlowPeriodo >= 0 ? '#4ade80' : '#f87171' }}>{formatCurrency(s.cashFlowPeriodo)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
