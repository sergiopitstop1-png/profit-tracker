'use client'
// 24/10/2026 — "Registra al volo": piccola finestra con 3 dati (conto, importo, tipo) e un solo tasto Salva.
// Scrive nel Registro manuale come il modulo completo (stessa funzione), ma senza altre conferme.
// Invio = Salva · Esc = chiudi. "Modulo completo" apre il Registro manuale con tutte le opzioni.
import { useEffect, useMemo, useRef, useState } from 'react'

const TIPI = ['Sport', 'Casinò / slot', 'Ricarica', 'Promo / VXT', 'Altro']
const COSA = [['mantenimento', 'Mantenimento'], ['profilazione', 'Profilazione'], ['recupero', 'Recupero']]

export default function RegistraRapido({ books, cosaAuto, onSalva, onClose, onCompleto, solo = false }) {
  const [cerca, setCerca] = useState('')
  const [scelti, setScelti] = useState([])          // id dei conti scelti
  const [importo, setImporto] = useState('')
  const [tipoOp, setTipoOp] = useState('Sport')
  const [cosaManuale, setCosaManuale] = useState('')
  const [nota, setNota] = useState('')
  const [occupato, setOccupato] = useState(false)
  const rifCerca = useRef(null)

  useEffect(() => { rifCerca.current?.focus() }, [])

  const conti = useMemo(() => scelti.map(id => books.find(b => String(b.id) === String(id))).filter(Boolean), [scelti, books])
  const parole = cerca.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const trovati = useMemo(() => {
    if (parole.join('').length < 2) return []
    return books.filter(b => !scelti.some(id => String(id) === String(b.id)) && parole.every(w => `${b.nome} ${b.intestatario || ''}`.toLowerCase().includes(w)))
      .sort((a, b) => String(a.intestatario || '').localeCompare(String(b.intestatario || ''), 'it', { sensitivity: 'base' }) || String(a.nome || '').localeCompare(String(b.nome || ''), 'it', { sensitivity: 'base' }))
      .slice(0, 8)
  }, [cerca, books, scelti])   // eslint-disable-line react-hooks/exhaustive-deps

  const cosa = cosaManuale || (conti[0] ? cosaAuto(conti[0]) : 'profilazione')
  const aggiungi = b => { setScelti([...scelti, b.id]); setCerca(''); rifCerca.current?.focus() }
  const togli = id => setScelti(scelti.filter(x => String(x) !== String(id)))
  const puoSalvare = conti.length > 0 && !occupato

  const salva = async () => {
    if (!puoSalvare) return
    setOccupato(true)
    try {
      const ok = await onSalva({ libri: conti, tipoOp, importo, descrizione: nota.trim(), cosa })
      if (ok) onClose()
    } finally { setOccupato(false) }
  }
  const tasti = e => {
    if (e.key === 'Escape') { e.preventDefault(); onClose() }
    else if (e.key === 'Enter' && !(e.target && e.target.dataset && e.target.dataset.cerca === '1' && trovati.length)) { e.preventDefault(); salva() }
    else if (e.key === 'Enter' && trovati.length) { e.preventDefault(); aggiungi(trovati[0]) }   // Invio nella ricerca = primo risultato
  }

  const inp = { background: '#020617', color: '#f8fafc', border: '1px solid #475569', borderRadius: 8, padding: '8px 10px', fontSize: 14, width: '100%', boxSizing: 'border-box' }
  const seg = (attivo) => ({ padding: '6px 10px', fontSize: 12, fontWeight: 800, border: '1px solid #475569', borderRadius: 8, cursor: 'pointer', background: attivo ? '#9333ea' : '#0b1220', color: attivo ? 'white' : '#cbd5e1' })

  return (
    <div onClick={onClose} onKeyDown={tasti} style={{ position: 'fixed', inset: 0, background: solo ? '#020617' : 'rgba(2,6,23,0.7)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '12vh 16px 16px' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#0f172a', border: '1px solid rgba(147,51,234,0.6)', borderRadius: 16, padding: 16, width: 'min(460px, 100%)', color: '#e2e8f0', boxShadow: '0 20px 50px rgba(0,0,0,0.6)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <b style={{ color: '#c084fc', fontSize: 15 }}>✍️ Registra al volo</b>
          <button onClick={onClose} style={{ background: 'transparent', color: '#94a3b8', border: 0, cursor: 'pointer', fontSize: 16 }} aria-label="Chiudi">✕</button>
        </div>

        {conti.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            {conti.map(b => (
              <span key={b.id} style={{ background: '#1e293b', border: '1px solid #475569', borderRadius: 999, padding: '3px 6px 3px 10px', fontSize: 12, display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                <b>{b.nome}</b><span style={{ color: '#94a3b8' }}>{b.intestatario || '—'}</span>
                <button onClick={() => togli(b.id)} title="Togli" style={{ background: 'transparent', color: '#94a3b8', border: 0, cursor: 'pointer' }}>✕</button>
              </span>
            ))}
          </div>
        )}

        <input ref={rifCerca} data-cerca="1" value={cerca} onChange={e => setCerca(e.target.value)} placeholder={conti.length ? 'Aggiungi un altro conto…' : '1) Conto: book e/o intestatario (es. giocodigitale emiliano)'} style={inp} autoComplete="off" />
        {trovati.length > 0 && (
          <div style={{ marginTop: 4, border: '1px solid #334155', borderRadius: 8, overflow: 'hidden' }}>
            {trovati.map((b, i) => (
              <div key={b.id} onClick={() => aggiungi(b)} style={{ padding: '7px 10px', cursor: 'pointer', display: 'flex', gap: 8, fontSize: 13, borderTop: i ? '1px solid #1e293b' : 0, background: i === 0 ? 'rgba(147,51,234,0.18)' : 'transparent' }}>
                <b>{b.nome}</b><span style={{ color: '#94a3b8' }}>{b.intestatario || '—'}</span>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 8, marginTop: 10, alignItems: 'center' }}>
          <input value={importo} onChange={e => setImporto(e.target.value.replace(',', '.'))} placeholder="2) Importo €" title="Un importo (10) oppure un intervallo (5/15)" style={inp} inputMode="decimal" />
          <input value={nota} onChange={e => setNota(e.target.value)} placeholder="Nota (facoltativa)" style={inp} />
        </div>

        <div style={{ marginTop: 10, fontSize: 12, color: '#94a3b8' }}>3) Tipo</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
          {TIPI.map(t => <button key={t} onClick={() => setTipoOp(t)} style={seg(tipoOp === t)}>{t}</button>)}
        </div>

        <div style={{ marginTop: 10, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', fontSize: 12, color: '#94a3b8' }}>
          Conta come:
          {COSA.map(([k, l]) => <button key={k} onClick={() => setCosaManuale(k)} style={seg(cosa === k)}>{l}</button>)}
          {!cosaManuale && conti[0] && <span>(scelto da Lucy)</span>}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 }}>
          <button onClick={onCompleto} style={{ background: 'transparent', color: '#94a3b8', border: 0, cursor: 'pointer', fontSize: 12, textDecoration: 'underline' }}>modulo completo</button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={{ ...seg(false), padding: '9px 14px', fontSize: 13 }}>Annulla</button>
            <button disabled={!puoSalvare} onClick={salva} style={{ background: puoSalvare ? '#9333ea' : '#334155', color: 'white', border: 0, borderRadius: 10, padding: '9px 18px', fontWeight: 900, fontSize: 13, cursor: puoSalvare ? 'pointer' : 'default' }}>
              ✍️ Salva{conti.length > 1 ? ` ${conti.length} conti` : ''}
            </button>
          </div>
        </div>
        <div style={{ marginTop: 8, fontSize: 11, color: '#64748b' }}>Invio = salva · Esc = chiudi · oggi, come data</div>
      </div>
    </div>
  )
}
