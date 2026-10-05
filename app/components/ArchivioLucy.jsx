"use client";
// ════════════════════════════════════════════════════════════════════
// 📚 ARCHIVIO OPERAZIONI LUCY (02/10/2026)
// Tutto quello che hai FATTO (o deciso di non fare), in una sola tabella:
//   • Sport Lucy confermate ........ lucy_bet_confermate
//   • Bet saltate / rimandate ...... lucy_decisioni
//   • Masaniello pilota ............ recupero_bets (+ esiti da selection_outcomes)
//   • Casino live (libere, mirate, proposte da Lucy) ... live_sessioni
//   • Profilazioni mirate fatte .... profilazioni_mirate_fatte
//   • Avvisi conti fatti ........... avvisi_conti (stato 'fatto')          ← 04/10/2026
//     (appuntamenti fissati, documenti inviati, riaperture, assistenze, verifiche…)
//   • Recuperi conti chiusi ........ recupero_esiti                        ← 04/10/2026
//   • Note dei conti gestite ....... note_storico (testo originale salvato) ← 04/10/2026
//   • Promo fatte .................. promo_bonus (stato 'fatta')            ← 05/10/2026
// Solo lettura: non cambia niente di come funzionano i motori.
// ════════════════════════════════════════════════════════════════════
import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../profit-tracker/supabaseClient'

const oggiIso = () => new Date().toLocaleDateString('sv-SE')
const piuGiorni = (d, n) => new Date(new Date(d + 'T00:00:00').getTime() + n * 86400000).toLocaleDateString('sv-SE')
const dataIt = (iso) => iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : ''
const oraIt = (iso) => iso && String(iso).length > 10 ? new Date(iso).toLocaleTimeString('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit' }) : ''
const num = (x) => (x === null || x === undefined || x === '') ? null : Number(x)
const euro = (n) => n == null ? '' : (Number(n) || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'

async function tutte(query) {
  const out = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await query().range(from, from + 999)
    if (error) throw error
    out.push(...(data || []))
    if (!data || data.length < 1000) break
  }
  return out
}

// ─── normalizzazione: una riga per operazione (esportate per i test) ──
export function righeSport(rows) {
  return (rows || []).map(r => r.rec || r).filter(x => x && x.tipo !== 'manuale').map(x => ({
    quando: x.creato || x.data, data: x.data, origine: 'Sport Lucy', tipo: x.recupero ? `${x.tipo} (recupero bet)` : x.tipo,
    cliente: x.intestatario, book: x.book, evento: [x.partita, x.sport].filter(Boolean).join(' · '),
    giocata: [x.mercato, x.esito].filter(v => v && v !== '—').join(': '), importo: num(x.stake), quota: num(x.quota) || null,
    stato: 'CONFERMATA', esito: '', pl: null, note: x.betNumero ? `bet ${x.betNumero}/${x.betRichieste || '?'}` : '',
  }))
}
export function righeDecisioni(rows) {
  return (rows || []).map(d => ({
    quando: d.creato, data: d.data, origine: 'Sport Lucy', tipo: d.tipo, cliente: d.intestatario, book: d.book_nome,
    evento: [d.partita, d.sport].filter(Boolean).join(' · '), giocata: [d.mercato, d.esito].filter(Boolean).join(': '),
    importo: num(d.stake), quota: num(d.quota) || null, stato: d.decisione === 'saltata' ? 'SALTATA' : 'RIMANDATA',
    esito: '', pl: null, note: d.motivo || '',
  }))
}
export function righeMasaniello(rows, esiti) {
  const adesso = Date.now()
  return (rows || []).map(b => {
    const iniziata = new Date(b.event_start).getTime() <= adesso
    let stato = b.stato === 'piazzata' ? 'PIAZZATA' : b.stato === 'saltata' ? 'SALTATA' : iniziata ? 'NON GIOCATA' : 'DA FARE'
    let esito = '', pl = null
    if (b.stato === 'piazzata') {
      const k = `${b.event_id}|${b.market}|${b.selection}`
      if (esiti.has(k)) {
        const w = esiti.get(k)
        const q = num(b.quota_reale) || 0, imp = num(b.importo) || 0
        if (w === null) { esito = 'NULLA'; pl = 0 }
        else if (w) { esito = 'VINTA'; pl = Math.round(imp * (q - 1) * 100) / 100 }
        else { esito = 'PERSA'; pl = -imp }
      } else esito = iniziata ? 'in attesa' : ''
    }
    return {
      quando: b.piazzata_at || b.creato, data: String(b.event_start).slice(0, 10), origine: 'Masaniello', tipo: b.tipo === 'sport' ? 'recupero (limitato sport)' : 'recupero',
      cliente: b.intestatario, book: b.book_nome, evento: b.partita, giocata: b.esito_label, importo: num(b.importo),
      quota: num(b.quota_reale) || null, stato, esito, pl, note: `quota min ${String(b.quota_minima ?? '').replace('.', ',')}`,
    }
  })
}
export function righeLive(rows) {
  const out = []
  for (const s of rows || []) {
    const giri = num(s.giri_fatti) || 0, stake = num(s.stake) || 0
    const orig = s.origine === 'mirata' ? 'mirata' : s.origine === 'lucy' ? 'proposta da Lucy' : 'libera'
    const baccarat = s.gioco === 'baccarat'
    for (const p of s.partecipanti || []) {
      if (baccarat) {
        const imp = num(p.importo) ?? stake
        out.push({
          quando: s.creato, data: s.giorno, origine: 'Casino live', tipo: `${orig} · baccarat ${s.operazione || ''}`.trim(), cliente: p.intestatario, book: p.nome,
          evento: `Baccarat ${s.operazione || ''} · sessione ${s.numero}${s.gruppo ? ` · ${s.gruppo}` : ''}`,
          giocata: `${p.tipo}: ${euro(imp)} a mano`, importo: Math.round(imp * giri * 100) / 100, quota: null, stato: 'GIOCATA', esito: '', pl: null,
          note: `${giri} mani × ${euro(imp)}`,
        })
        continue
      }
      const n = (p.numeri || []).length, st = num(p.stake) ?? stake
      out.push({
        quando: s.creato, data: s.giorno, origine: 'Casino live', tipo: `${orig} · roulette`, cliente: p.intestatario, book: p.nome,
        evento: `Roulette · sessione ${s.numero}${s.gruppo ? ` · ${s.gruppo}` : ''}`,
        giocata: `${p.tipo || 'Numeri'}: ${(p.numeri || []).join(', ')}`,
        importo: Math.round(n * st * giri * 100) / 100, quota: null, stato: 'GIOCATA', esito: '', pl: null,
        note: `${giri} giri × ${n} numeri × ${euro(st)}`,
      })
    }
  }
  return out
}
export function righeMirate(rows, books, sessioni = []) {
  const out = []
  for (const f of rows || []) {
    // se quel giorno il gruppo è stato giocato con 🎰 Numeri, la sessione live ha già conti, numeri e importi:
    // qui non si ripete (02/10/2026)
    if ((sessioni || []).some(s => s.origine === 'mirata' && s.gruppo === f.nome_gruppo && s.giorno === f.data)) continue
    for (const id of f.conti || []) {
      const b = (books || []).find(x => String(x.id) === String(id))
      out.push({
        quando: f.creato || f.data, data: f.data, origine: 'Profilazione mirata', tipo: 'casino live', cliente: b?.intestatario || '?',
        book: b?.nome || `conto ${id}`, evento: f.nome_gruppo, giocata: '', importo: num(f.importo_per_conto), quota: null, stato: 'FATTA', esito: '', pl: null,
        note: f.importo_per_conto == null ? 'importo non indicato' : '',
      })
    }
  }
  return out
}

// ─── 04/10/2026 · AVVISI, RECUPERI E NOTE: tutto quello che si fa finisce in archivio ───
const ESITI_AVVISO = {
  fatto: 'Fatto', ok: 'Fatto', approvato: 'Approvato', rifiutato: 'Rifiutato', attesa: 'In attesa di risposta',
  risolto: 'Risolto', tolta: 'Limitazione tolta', ancora: 'Ancora limitato',
}
const nomeEsito = (e) => !e ? 'Fatto' : ESITI_AVVISO[e] || String(e).charAt(0).toUpperCase() + String(e).slice(1)
const PASSI = { appuntamento: 'appuntamento', seduta: 'seduta live', verifica: 'verifica', prepara: 'preparazione', invio: 'invio' }
export function righeAvvisi(rows, books) {
  const bookDi = (id) => (books || []).find(b => String(b.id) === String(id))
  return (rows || []).map(a => {
    const m = a.meta || {}
    const ids = (m.book_ids && m.book_ids.length ? m.book_ids : [a.book_id]).filter(Boolean)
    const conti = ids.map(bookDi).filter(Boolean)
    const nomiBook = conti.map(b => b.nome).join(', ')
    const cliente = m.intestatario || conti[0]?.intestatario || ''
    const appuntamento = String(a.esito || '').match(/^appuntamento (\d{4}-\d{2}-\d{2})$/)
    const evento = appuntamento
      ? `Fissato appuntamento con ${cliente || '?'}${nomiBook ? ` per ${nomiBook}` : ''} il ${dataIt(appuntamento[1])}${a.tipo === 'live' ? ' (riconoscimento live)' : ''}`
      : a.titolo || ''
    const t = a.aggiornato || a.updated_at
    const stessoGiorno = t && new Date(t).toLocaleDateString('sv-SE') === a.fatto_il
    return {
      quando: stessoGiorno ? t : a.fatto_il, data: a.fatto_il, origine: 'Avvisi conti',
      tipo: `${a.tipo || 'avviso'}${m.passo ? ` · ${PASSI[m.passo] || m.passo}` : ''}`,
      cliente, book: nomiBook || (ids.length ? `conto ${ids.join(', ')}` : ''), evento,
      giocata: appuntamento ? `Appuntamento: ${dataIt(appuntamento[1])}` : nomeEsito(a.esito),
      importo: null, quota: null, stato: 'FATTO', esito: '', pl: null,
      note: [a.sottotitolo, a.data_prevista && a.data_prevista > a.fatto_il ? `fatto in anticipo (era previsto il ${dataIt(a.data_prevista)})` : ''].filter(Boolean).join(' · '),
    }
  })
}
export function righeRecuperi(rows) {
  return (rows || []).map(r => ({
    quando: r.creato || r.created_at || r.chiuso_il, data: r.chiuso_il, origine: 'Recupero conti', tipo: `recupero ${r.tipo || ''}`.trim(),
    cliente: r.intestatario, book: r.nome, evento: `Recupero chiuso${r.tentativi != null ? ` dopo ${r.tentativi} tentativi` : ''}`,
    giocata: nomeEsito(r.esito), importo: null, quota: null, stato: 'CHIUSO', esito: '', pl: null,
    note: [r.iniziato ? `iniziato il ${dataIt(r.iniziato)}` : '', r.attivo_dal ? `attivo dal ${dataIt(r.attivo_dal)}` : ''].filter(Boolean).join(' · '),
  }))
}
export function righeNote(rows) {
  return (rows || []).map(n => {
    const quando = n.creato || n.created_at || ''
    const testo = String(n.testo || '').replace(/\s+/g, ' ').trim()
    return {
      quando, data: quando ? new Date(quando).toLocaleDateString('sv-SE') : '', origine: 'Note conti', tipo: 'nota del conto',
      cliente: n.intestatario, book: n.nome, evento: n.motivo || 'nota modificata', giocata: '', importo: null, quota: null,
      stato: 'NOTA', esito: '', pl: null, note: testo ? `testo di prima: "${testo.length > 140 ? testo.slice(0, 140) + '…' : testo}"` : '',
    }
  })
}
// 05/10/2026 · 🎁 promo segnate fatte nella tab Promo
export function righePromo(rows) {
  return (rows || []).map(p => ({
    quando: p.fatta_il, data: p.fatta_il, origine: 'Promo', tipo: p.tipo || 'promo',
    cliente: p.cliente, book: p.book, evento: p.oggetto || `Promo ${p.tipo || ''}`.trim(),
    giocata: [p.versamento != null ? `versa ${euro(p.versamento)}` : '', p.bonus != null ? `bonus ${euro(p.bonus)}` : '', p.rollover || ''].filter(Boolean).join(' · '),
    importo: null, quota: null, stato: 'FATTO', esito: '', pl: null,   // il versamento è nella colonna Giocata, non nel totale giocato
    note: [p.scadenza ? `scadenza ${dataIt(p.scadenza)}` : '', p.note || ''].filter(Boolean).join(' · '),
  }))
}
// tabelle di cui non conosciamo con certezza la colonna della data: prova creato, poi created_at
async function tutteDal(tabella, da) {
  let ultimo = null
  for (const col of ['creato', 'created_at']) {
    try { return await tutte(() => supabase.from(tabella).select('*').gte(col, da).order(col, { ascending: false })) } catch (e) { ultimo = e }
  }
  throw ultimo
}

const ORIGINI = ['Sport Lucy', 'Masaniello', 'Casino live', 'Profilazione mirata', 'Avvisi conti', 'Recupero conti', 'Note conti', 'Promo']
const STATI = ['CONFERMATA', 'PIAZZATA', 'GIOCATA', 'FATTA', 'FATTO', 'CHIUSO', 'NOTA', 'SALTATA', 'RIMANDATA', 'NON GIOCATA', 'DA FARE']

export default function ArchivioLucy({ books }) {
  const [periodo, setPeriodo] = useState('7')
  const [origine, setOrigine] = useState('')
  const [stato, setStato] = useState('')
  const [cerca, setCerca] = useState('')
  const [righe, setRighe] = useState([])
  const [avvisi, setAvvisi] = useState([])
  const [carico, setCarico] = useState(false)

  const carica = useCallback(async () => {
    setCarico(true)
    const da = periodo === 'tutto' ? '2000-01-01' : piuGiorni(oggiIso(), -(Number(periodo) - 1))
    const note = [], tutto = []
    const prova = async (nome, fn) => { try { tutto.push(...await fn()) } catch (e) { note.push(`${nome}: ${e.message || e}`) } }
    await prova('Sport Lucy', async () => righeSport(await tutte(() => supabase.from('lucy_bet_confermate').select('rec,data').gte('data', da).order('data', { ascending: false }))))
    await prova('Bet saltate/rimandate', async () => righeDecisioni(await tutte(() => supabase.from('lucy_decisioni').select('*').gte('data', da).order('creato', { ascending: false }))))
    await prova('Masaniello', async () => {
      const bets = await tutte(() => supabase.from('recupero_bets').select('*').gte('event_start', da).order('event_start', { ascending: false }))
      const ids = [...new Set(bets.map(b => b.event_id))], esiti = new Map()
      for (let i = 0; i < ids.length; i += 100) {
        const { data, error } = await supabase.from('selection_outcomes').select('event_id,market,selection,won').in('event_id', ids.slice(i, i + 100))
        if (error) throw error
        for (const o of data || []) esiti.set(`${o.event_id}|${o.market}|${o.selection}`, o.won)
      }
      return righeMasaniello(bets, esiti)
    })
    let sessioniLive = []
    await prova('Casino live', async () => { sessioniLive = await tutte(() => supabase.from('live_sessioni').select('*').gte('giorno', da).order('creato', { ascending: false })); return righeLive(sessioniLive) })
    await prova('Profilazioni mirate', async () => righeMirate(await tutte(() => supabase.from('profilazioni_mirate_fatte').select('*').gte('data', da).order('data', { ascending: false })), books, sessioniLive))
    // 04/10/2026: avvisi fatti, recuperi chiusi, note gestite
    await prova('Avvisi conti', async () => righeAvvisi(await tutte(() => supabase.from('avvisi_conti').select('*').eq('stato', 'fatto').gte('fatto_il', da).order('fatto_il', { ascending: false })), books))
    await prova('Recuperi chiusi', async () => righeRecuperi(await tutte(() => supabase.from('recupero_esiti').select('*').gte('chiuso_il', da).order('chiuso_il', { ascending: false }))))
    await prova('Note conti', async () => righeNote(await tutteDal('note_storico', da)))
    await prova('Promo', async () => righePromo(await tutte(() => supabase.from('promo_bonus').select('*').eq('stato', 'fatta').gte('fatta_il', da).order('fatta_il', { ascending: false }))))
    tutto.sort((a, b) => String(b.quando || b.data).localeCompare(String(a.quando || a.data)))
    setRighe(tutto); setAvvisi(note); setCarico(false)
  }, [periodo, books])
  useEffect(() => { carica() }, [carica])

  const visibili = useMemo(() => {
    const q = cerca.trim().toLowerCase()
    return righe.filter(r => (!origine || r.origine === origine) && (!stato || r.stato === stato)
      && (!q || [r.cliente, r.book, r.evento, r.giocata, r.tipo, r.note].join(' ').toLowerCase().includes(q)))
  }, [righe, origine, stato, cerca])
  const totImporto = visibili.reduce((a, r) => a + (r.importo || 0) * (['SALTATA', 'RIMANDATA', 'DA FARE', 'NON GIOCATA'].includes(r.stato) ? 0 : 1), 0)
  const plNoti = visibili.filter(r => r.pl != null)
  const totPl = plNoti.reduce((a, r) => a + r.pl, 0)

  function esportaCsv() {
    const col = ['data', 'ora', 'origine', 'tipo', 'cliente', 'book', 'evento', 'giocata', 'importo', 'quota', 'stato', 'esito', 'pl', 'note']
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const testo = [col.join(';'), ...visibili.map(r => [dataIt(r.data), oraIt(r.quando), r.origine, r.tipo, r.cliente, r.book, r.evento, r.giocata,
      r.importo == null ? '' : String(r.importo).replace('.', ','), r.quota == null ? '' : String(r.quota).replace('.', ','), r.stato, r.esito,
      r.pl == null ? '' : String(r.pl).replace('.', ','), r.note].map(esc).join(';'))].join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob(['\ufeff' + testo], { type: 'text/csv;charset=utf-8' }))
    a.download = `archivio-lucy-${oggiIso()}.csv`; a.click()
  }

  const sel = { border: '1px solid #cbd5e1', borderRadius: 6, padding: '5px 8px', fontSize: 12, background: 'white', color: '#0f172a' }
  const th = { textAlign: 'left', padding: '6px 8px', borderBottom: '2px solid #cbd5e1', fontSize: 11, color: '#475569', whiteSpace: 'nowrap', position: 'sticky', top: 0, background: '#f8fafc' }
  const td = { padding: '5px 8px', borderBottom: '1px solid #e2e8f0', fontSize: 12, color: '#0f172a', verticalAlign: 'top' }
  const coloreStato = { CONFERMATA: '#166534', PIAZZATA: '#166534', GIOCATA: '#166534', FATTA: '#166534', FATTO: '#166534', CHIUSO: '#7c3aed', NOTA: '#475569', SALTATA: '#b91c1c', RIMANDATA: '#b45309', 'NON GIOCATA': '#64748b', 'DA FARE': '#1d4ed8' }

  return (
    <div style={{ background: 'white', borderRadius: 12, padding: 14, color: '#0f172a' }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
        <select style={sel} value={periodo} onChange={e => setPeriodo(e.target.value)}>
          <option value="1">Oggi</option><option value="7">Ultimi 7 giorni</option><option value="30">Ultimi 30 giorni</option>
          <option value="90">Ultimi 90 giorni</option><option value="tutto">Tutto</option>
        </select>
        <select style={sel} value={origine} onChange={e => setOrigine(e.target.value)}>
          <option value="">Tutte le operazioni</option>{ORIGINI.map(o => <option key={o}>{o}</option>)}
        </select>
        <select style={sel} value={stato} onChange={e => setStato(e.target.value)}>
          <option value="">Tutti gli stati</option>{STATI.map(o => <option key={o}>{o}</option>)}
        </select>
        <input style={{ ...sel, width: 220 }} placeholder="Cerca cliente, book, partita…" value={cerca} onChange={e => setCerca(e.target.value)} />
        <button style={{ ...sel, cursor: 'pointer', fontWeight: 700 }} onClick={carica}>↻ Aggiorna</button>
        <button style={{ ...sel, cursor: 'pointer', fontWeight: 700 }} onClick={esportaCsv} disabled={!visibili.length}>⬇️ Excel (CSV)</button>
      </div>
      <div style={{ fontSize: 12, color: '#475569', marginBottom: 8 }}>
        {carico ? 'Carico…' : <><b>{visibili.length}</b> operazioni · giocato <b>{euro(totImporto)}</b>{plNoti.length ? <> · P/L conosciuto ({plNoti.length} bet) <b style={{ color: totPl >= 0 ? '#166534' : '#b91c1c' }}>{totPl >= 0 ? '+' : ''}{euro(totPl)}</b></> : null}</>}
      </div>
      {avvisi.length > 0 && <div style={{ fontSize: 11, color: '#b45309', marginBottom: 8 }}>⚠️ Non letto: {avvisi.join(' · ')}</div>}
      <div style={{ overflow: 'auto', maxHeight: 520, border: '1px solid #e2e8f0', borderRadius: 8 }}>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead><tr>{['Data', 'Ora', 'Operazione', 'Tipo', 'Cliente', 'Book', 'Evento', 'Giocata', 'Importo', 'Quota', 'Stato', 'Esito', 'P/L', 'Note'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
          <tbody>
            {visibili.map((r, i) => (
              <tr key={i} style={{ background: i % 2 ? '#f8fafc' : 'white' }}>
                <td style={{ ...td, whiteSpace: 'nowrap' }}>{dataIt(r.data)}</td>
                <td style={td}>{oraIt(r.quando)}</td>
                <td style={{ ...td, fontWeight: 700, whiteSpace: 'nowrap' }}>{r.origine}</td>
                <td style={td}>{r.tipo}</td>
                <td style={td}>{r.cliente}</td>
                <td style={{ ...td, fontWeight: 700 }}>{r.book}</td>
                <td style={td}>{r.evento}</td>
                <td style={td}>{r.giocata}</td>
                <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>{euro(r.importo)}</td>
                <td style={{ ...td, textAlign: 'right' }}>{r.quota ? String(r.quota).replace('.', ',') : ''}</td>
                <td style={{ ...td, fontWeight: 800, color: coloreStato[r.stato] || '#0f172a', whiteSpace: 'nowrap' }}>{r.stato}</td>
                <td style={{ ...td, fontWeight: 700 }}>{r.esito}</td>
                <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: r.pl == null ? '#0f172a' : r.pl >= 0 ? '#166534' : '#b91c1c', whiteSpace: 'nowrap' }}>{r.pl == null ? '' : `${r.pl >= 0 ? '+' : ''}${euro(r.pl)}`}</td>
                <td style={{ ...td, color: '#64748b' }}>{r.note}</td>
              </tr>
            ))}
            {!visibili.length && !carico && <tr><td style={td} colSpan={14}>Nessuna operazione in questo periodo.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
