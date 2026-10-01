"use client";
// ════════════════════════════════════════════════════════════════════
// 📖 REGOLE DI MANTENIMENTO DINAMICHE (02/10/2026)
// Le regole le decide Sergio: una regola generale per tutti i book e, se serve,
// una regola diversa per singolo bookmaker (i campi vuoti = come la generale).
// Il sistema (agenda, scadenze, coperture di Lucy) si adatta subito.
// Tabella: regole_mantenimento (vedi regole_mantenimento.sql).
// ════════════════════════════════════════════════════════════════════
import React, { useState, useMemo } from 'react'
import { supabase } from '../profit-tracker/supabaseClient'

export const REGOLE_MANT_DEFAULT = { ogni_giorni: 60, anticipo_giorni: 15, stake_min: 5, stake_max: 30, riposo_giorni: 28, numero_bet: 1, gioco: 'auto' }
export const chiaveBookMant = (nome) => String(nome || '').toLowerCase().replace(/[^a-z0-9]/g, '')
const pulito = (r) => Object.fromEntries(Object.entries(r || {}).filter(([k, v]) => k in REGOLE_MANT_DEFAULT && v !== null && v !== undefined && v !== ''))

// regola effettiva di un conto: generale + eventuale regola del suo bookmaker (esportata per i test)
export function regolaMantPer(regole, book) {
  const g = { ...REGOLE_MANT_DEFAULT, ...pulito(regole?.['*']) }
  const b = book ? regole?.[chiaveBookMant(book.nome)] : null
  const r = b ? { ...g, ...pulito(b) } : g
  const out = {
    ogni_giorni: Math.max(1, Math.round(Number(r.ogni_giorni))),
    anticipo_giorni: Math.max(0, Math.round(Number(r.anticipo_giorni))),
    stake_min: Math.max(1, Number(r.stake_min)),
    stake_max: Math.max(1, Number(r.stake_max)),
    riposo_giorni: Math.max(0, Math.round(Number(r.riposo_giorni))),
    numero_bet: Math.max(1, Math.round(Number(r.numero_bet))),
    gioco: ['auto', 'sport', 'casino'].includes(r.gioco) ? r.gioco : 'auto',
    personalizzata: !!b,
  }
  if (out.anticipo_giorni >= out.ogni_giorni) out.anticipo_giorni = Math.max(0, out.ogni_giorni - 1)
  if (out.stake_max < out.stake_min) out.stake_max = out.stake_min
  return out
}

// importi possibili di una puntata: dal minimo al massimo a passi di 5 € (minimo e massimo sempre compresi)
export function passiStakeMant(r) {
  const out = [r.stake_min]
  for (let x = Math.ceil((r.stake_min + 0.01) / 5) * 5; x < r.stake_max; x += 5) out.push(x)
  if (r.stake_max > r.stake_min) out.push(r.stake_max)
  return out
}

const CAMPI = [
  ['ogni_giorni', 'Ogni (giorni)', 'Limite massimo tra due movimentazioni dello stesso conto'],
  ['anticipo_giorni', 'Anticipo (giorni)', 'Quanti giorni prima della scadenza il conto torna in agenda'],
  ['stake_min', 'Puntata min €', ''],
  ['stake_max', 'Puntata max €', ''],
  ['numero_bet', 'N. bet', 'Quante bet per ogni movimentazione'],
  ['riposo_giorni', 'Riposo coperture (gg)', 'Giorni minimi tra due usi dello stesso conto come copertura negli incroci di Lucy'],
]

export default function RegoleMantenimento({ regole, setRegole, books, onMessage, onError }) {
  const [bozza, setBozza] = useState(null) // { chiave, nome, ...campi }
  // tutti i bookmaker che hai (anche se oggi nessun conto è in mantenimento: la regola vale per quando ci entreranno)
  const nomiBook = useMemo(() => {
    const per = new Map()
    for (const b of books || []) { const k = chiaveBookMant(b.nome); if (k && !per.has(k)) per.set(k, b.nome) }
    return [...per.values()].sort((a, b) => String(a).localeCompare(String(b)))
  }, [books])
  const contiPer = (nome) => (books || []).filter(b => chiaveBookMant(b.nome) === chiaveBookMant(nome) && String(b.profilo_livello || '').startsWith('mantenimento')).length
  const contiTot = (nome) => (books || []).filter(b => chiaveBookMant(b.nome) === chiaveBookMant(nome)).length
  const generale = regolaMantPer(regole, null)
  const personalizzati = Object.entries(regole || {}).filter(([k]) => k !== '*')

  async function salva() {
    const r = { ...bozza }
    for (const [k] of CAMPI) r[k] = r[k] === '' || r[k] == null ? null : Number(String(r[k]).replace(',', '.'))
    if (r.chiave === '*') for (const [k] of CAMPI) if (r[k] == null) { onError(`Nella regola generale "${CAMPI.find(c => c[0] === k)[1]}" non può essere vuoto`); return }
    const eff = regolaMantPer({ ...regole, [r.chiave]: r }, r.chiave === '*' ? null : { nome: r.nome })
    if (eff.anticipo_giorni >= eff.ogni_giorni) { onError('L\'anticipo deve essere minore dei giorni'); return }
    if (eff.stake_max < eff.stake_min) { onError('La puntata massima deve essere almeno quella minima'); return }
    const riga = { chiave: r.chiave, nome: r.nome, ...Object.fromEntries(CAMPI.map(([k]) => [k, r[k]])), gioco: r.gioco || (r.chiave === '*' ? 'auto' : null), aggiornato: new Date().toISOString() }
    const { error } = await supabase.from('regole_mantenimento').upsert([riga], { onConflict: 'chiave' })
    if (error) { onError('Regola non salvata: ' + error.message + ' (hai lanciato regole_mantenimento.sql?)'); return }
    setRegole({ ...regole, [r.chiave]: riga })
    setBozza(null)
    onMessage(`📖 Regola salvata: ${r.nome}. Agenda e coperture si adattano subito.`)
  }
  async function elimina(chiave, nome) {
    if (!window.confirm(`Tolgo la regola personalizzata di ${nome}? Tornerà a valere la regola generale.`)) return
    const { error } = await supabase.from('regole_mantenimento').delete().eq('chiave', chiave)
    if (error) { onError(error.message); return }
    const n = { ...regole }; delete n[chiave]; setRegole(n)
  }
  const apri = (chiave, nome) => {
    const r = regole?.[chiave] || {}
    setBozza({ chiave, nome, ...Object.fromEntries(CAMPI.map(([k]) => [k, r[k] ?? (chiave === '*' ? generale[k] : '')])), gioco: r.gioco ?? (chiave === '*' ? generale.gioco : '') })
  }

  const inp = { background: '#0b1220', color: '#f8fafc', border: '1px solid #334155', borderRadius: 8, padding: '4px 6px', fontSize: 12, width: 70 }
  const btn = (bg) => ({ background: bg, color: 'white', border: 0, borderRadius: 8, padding: '5px 10px', fontWeight: 800, fontSize: 12, cursor: 'pointer' })
  const testo = (r) => `ogni ${r.ogni_giorni} gg (in agenda dal ${r.ogni_giorni - r.anticipo_giorni}°) · ${r.numero_bet} ${r.numero_bet > 1 ? 'bet' : 'bet'} da ${r.stake_min}-${r.stake_max} € · ${r.gioco === 'auto' ? 'sport, casinò per i solo-casinò' : r.gioco === 'casino' ? 'casinò/slot' : 'sport'} · riposo coperture ${r.riposo_giorni} gg`

  return (
    <div style={{ background: 'rgba(11,18,32,0.7)', border: '1px solid rgba(51,65,85,0.85)', borderRadius: 16, padding: '14px 16px' }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: '#f8fafc', marginBottom: 8 }}>📖 Regole di mantenimento <span style={{ fontWeight: 400, color: '#94a3b8', fontSize: 11 }}>· le cambi tu, il sistema si adatta subito</span></div>
      <div style={{ fontSize: 12, color: '#e2e8f0', marginBottom: 6 }}>
        🟡 <b>Tutti i book:</b> {testo(generale)} <button onClick={() => apri('*', 'Tutti i book')} style={{ ...btn('#334155'), marginLeft: 6 }}>✏️ Modifica</button>
      </div>
      {personalizzati.map(([k, r]) => (
        <div key={k} style={{ fontSize: 12, color: '#e2e8f0', marginBottom: 4 }}>
          🔧 <b>{r.nome}</b> ({contiPer(r.nome)} conti): {testo(regolaMantPer(regole, { nome: r.nome }))}
          <button onClick={() => apri(k, r.nome)} style={{ ...btn('#334155'), marginLeft: 6 }}>✏️</button>
          <button onClick={() => elimina(k, r.nome)} style={{ ...btn('#7f1d1d'), marginLeft: 4 }}>🗑</button>
        </div>))}
      <div style={{ marginTop: 6, fontSize: 12, color: '#94a3b8' }}>
        Regola diversa per un bookmaker:{' '}
        <select style={{ ...inp, width: 180 }} value="" onChange={e => e.target.value && apri(chiaveBookMant(e.target.value), e.target.value)}>
          <option value="">scegli il book…</option>
          {nomiBook.filter(n => !regole?.[chiaveBookMant(n)]).map(n => <option key={n} value={n}>{n} ({contiPer(n)} in mantenimento · {contiTot(n)} conti)</option>)}
        </select>
      </div>

      {bozza && (
        <div style={{ marginTop: 10, padding: 10, borderRadius: 10, border: '1px solid #475569', background: 'rgba(15,23,42,.8)' }}>
          <div style={{ fontWeight: 800, color: '#fde68a', marginBottom: 6 }}>{bozza.nome}{bozza.chiave !== '*' ? ' · i campi vuoti seguono la regola generale' : ''}</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            {CAMPI.map(([k, label, aiuto]) => (
              <label key={k} title={aiuto} style={{ display: 'flex', flexDirection: 'column', fontSize: 10, color: '#94a3b8', fontWeight: 800 }}>
                {label}
                <input style={inp} value={bozza[k] ?? ''} placeholder={bozza.chiave !== '*' ? String(generale[k]) : ''} onChange={e => setBozza({ ...bozza, [k]: e.target.value.replace(/[^0-9.,]/g, '') })} />
              </label>))}
            <label style={{ display: 'flex', flexDirection: 'column', fontSize: 10, color: '#94a3b8', fontWeight: 800 }}>
              Cosa giocare
              <select style={{ ...inp, width: 150 }} value={bozza.gioco ?? ''} onChange={e => setBozza({ ...bozza, gioco: e.target.value })}>
                {bozza.chiave !== '*' && <option value="">come la generale</option>}
                <option value="auto">sport (casinò per i solo-casinò)</option>
                <option value="sport">sempre sport</option>
                <option value="casino">sempre casinò/slot</option>
              </select>
            </label>
            <button onClick={salva} style={btn('#059669')}>💾 Salva</button>
            <button onClick={() => setBozza(null)} style={btn('#475569')}>Annulla</button>
          </div>
        </div>
      )}
      <div style={{ marginTop: 8, color: '#94a3b8', fontSize: 11 }}>I Dormienti non entrano nell'agenda. La scelta dello stato del conto resta sempre manuale.</div>
    </div>
  )
}
