// ════════════════════════════════════════════════════════════════════
// OGGI DA FARE (14/10/2026) · logica pura della lista, senza React né database.
// La pagina /profit-tracker/da-fare mette insieme:
//   • la fotografia che il Profit Tracker prepara nel browser (bet, incroci, conti da movimentare, avvisi)
//   • le bet del Masaniello di recupero (recupero_bets) e le mail/SMS con azione, lette dalla pagina stessa
//   • lo stato salvato in oggi_da_fare_stato (fatto / rimandato al giorno X)
// e ne ricava: voci da fare per sezione, voci fatte, voci rimandate.
// ════════════════════════════════════════════════════════════════════

export const SEZIONI = [
  { id: 'bet_mant', titolo: 'Bet di mantenimento', icona: '🛡️', colore: '#fbbf24' },
  { id: 'bet_prof', titolo: 'Bet di profilazione e recupero', icona: '⚽', colore: '#38bdf8' },
  { id: 'masaniello', titolo: 'Masaniello di recupero (PronoX)', icona: '🎲', colore: '#34d399' },
  { id: 'conti', titolo: 'Conti da movimentare oggi', icona: '🗂️', colore: '#a78bfa' },
  { id: 'avvisi', titolo: 'Avvisi e chat', icona: '🔔', colore: '#f87171' },
  { id: 'mail', titolo: 'Mail e SMS da gestire', icona: '✉️', colore: '#fb923c' },
  { id: 'ritorno', titolo: 'Rimandate che tornano oggi', icona: '↩️', colore: '#94a3b8' },
]

const SEZIONI_ID = new Set(SEZIONI.map(s => s.id))

// Le voci che nascono da una fonte con id proprio e fisso (mail, bet del Masaniello) restano "fatte"
// anche nei giorni dopo: la fonte non le conosce come chiuse. Le altre (bet del giorno, conti, avvisi) vengono
// ricalcolate ogni giorno, quindi "fatto" vale solo per il giorno in cui l'hai segnato.
export const eDurevole = (key) => /^(mail|masaniello)\|/.test(String(key || ''))

export function dataIso(d = new Date()) { return d.toLocaleDateString('sv-SE') }
export function domaniIso(oggi = dataIso()) { return aggiungiGiorni(oggi, 1) }
export function aggiungiGiorni(iso, n) {
  const [y, m, g] = String(iso).split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1, g + n))
  return d.toISOString().slice(0, 10)
}
export function dataIt(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''))
  return m ? `${m[3]}/${m[2]}/${m[1]}` : ''
}
export function dataLunga(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''))
  if (!m) return ''
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  return d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
}

// Una data valida per rimandare: formato AAAA-MM-GG e da domani in poi
export function rinvioValido(data, oggi = dataIso()) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(data || '')) && String(data) > oggi
}

// Costruisce la lista.
//  voci  = [{ key, sezione, titolo, dettaglio?, tag?, fatta?, nota? }]
//  righe = righe di oggi_da_fare_stato [{ chiave, stato, giorno, rimanda_a, sezione, titolo, dettaglio, tag }]
export function costruisciLista({ voci = [], righe = [], oggi = dataIso() }) {
  const perChiave = new Map(righe.map(r => [r.chiave, r]))
  const viste = new Set()
  const perSezione = new Map(SEZIONI.map(s => [s.id, []]))
  const fatte = []
  const rimandate = []

  for (const v0 of voci) {
    if (!v0 || !v0.key || viste.has(v0.key)) continue
    viste.add(v0.key)
    const sezione = SEZIONI_ID.has(v0.sezione) ? v0.sezione : 'ritorno'
    const v = { ...v0, sezione }
    const r = perChiave.get(v.key)
    if (r?.stato === 'fatto' && (r.giorno === oggi || eDurevole(v.key))) { fatte.push({ ...v, nota: v.nota || 'segnata qui', segnataQui: true }); continue }
    if (r?.stato === 'rimandato' && r.rimanda_a > oggi) { rimandate.push({ ...v, rimanda_a: r.rimanda_a, segnataQui: true }); continue }
    if (v.fatta) { fatte.push(v); continue }
    perSezione.get(sezione).push(r?.stato === 'rimandato' ? { ...v, rimandataDal: r.giorno } : v)
  }

  // voci rimandate che il calcolo di oggi non propone più: tornano dal testo salvato
  for (const r of righe) {
    if (r.stato !== 'rimandato' || viste.has(r.chiave)) continue
    const v = { key: r.chiave, sezione: SEZIONI_ID.has(r.sezione) ? r.sezione : 'ritorno', titolo: r.titolo || r.chiave, dettaglio: r.dettaglio || '', tag: r.tag || '', segnataQui: true }
    if (r.rimanda_a > oggi) rimandate.push({ ...v, rimanda_a: r.rimanda_a })
    else perSezione.get(v.sezione).push({ ...v, rimandataDal: r.giorno })
  }

  rimandate.sort((a, b) => String(a.rimanda_a).localeCompare(String(b.rimanda_a)) || String(a.titolo).localeCompare(String(b.titolo)))
  const sezioni = SEZIONI.map(s => ({ ...s, voci: perSezione.get(s.id) })).filter(s => s.voci.length > 0)
  const daFare = sezioni.reduce((n, s) => n + s.voci.length, 0)
  return { sezioni, fatte, rimandate, totali: { daFare, fatte: fatte.length, rimandate: rimandate.length } }
}

// Voci delle bet del Masaniello di recupero (righe di recupero_bets)
export function vociMasaniello(bets = [], adesso = Date.now(), inizioOggiMs = 0) {
  const euro = (n) => (Number(n) || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
  const ora = (iso) => new Date(iso).toLocaleString('it-IT', { timeZone: 'Europe/Rome', weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  const out = []
  for (const b of bets) {
    const inizio = b.event_start ? new Date(b.event_start).getTime() : null
    const base = {
      key: `masaniello|${b.id}`,
      sezione: 'masaniello',
      titolo: `${b.book_nome || '—'} · ${b.intestatario || '—'}`,
      dettaglio: `${b.partita || ''}${b.esito_label ? ` · ${b.esito_label}` : ''} · ${euro(b.importo)}${b.quota_minima ? ` · quota minima ${String(b.quota_minima).replace('.', ',')}` : ''}${b.event_start ? ` · ${ora(b.event_start)}` : ''}`,
      tag: 'masaniello',
    }
    if (b.stato === 'da_fare' && inizio && inizio > adesso) out.push(base)
    else if (b.stato === 'piazzata' && b.piazzata_at && new Date(b.piazzata_at).getTime() >= inizioOggiMs) out.push({ ...base, fatta: true, nota: 'piazzata nel Profit Tracker' })
  }
  return out
}

// Voci delle mail/SMS con azione (righe di /api/lucy-mail/archive?vista=problemi)
export function vociMail(righe = []) {
  const out = []
  for (const r of righe) {
    if (!r || r.archiviata || r.letta === true) continue
    const quando = r.data_mail ? new Date(r.data_mail).toLocaleString('it-IT', { timeZone: 'Europe/Rome', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''
    out.push({
      key: `mail|${r.id}`,
      sezione: 'mail',
      titolo: `${r.canale === 'SMS' ? 'SMS' : 'Mail'} · ${r.cliente_nome || 'cliente non riconosciuto'}${r.bookmaker ? ` · ${r.bookmaker}` : ''}`,
      dettaglio: `${r.oggetto || r.categoria || ''}${r.motivazione_ai ? ` — ${r.motivazione_ai}` : ''}${quando ? ` (${quando})` : ''}`,
      tag: String(r.categoria || 'problema').toLowerCase(),
    })
  }
  return out
}
