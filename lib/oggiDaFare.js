// ════════════════════════════════════════════════════════════════════
// OGGI DA FARE (14/10/2026) · logica pura della lista, senza React né database.
// La pagina /profit-tracker/da-fare mette insieme:
//   • la fotografia che il Profit Tracker prepara nel browser (bet, incroci, conti da movimentare, avvisi)
//   • le bet del Masaniello di recupero (recupero_bets) e le mail/SMS con azione, lette dalla pagina stessa
//   • lo stato salvato in oggi_da_fare_stato (fatto / rimandato al giorno X)
// e ne ricava: voci da fare per sezione, voci fatte, voci rimandate.
// ════════════════════════════════════════════════════════════════════

export const SEZIONI = [
  { id: 'promo', titolo: 'Promo in scadenza oggi', icona: '🎁', colore: '#f87171' },
  { id: 'pagamenti', titolo: 'Pagamenti dei servizi da fare', icona: '💳', colore: '#f472b6' },
  { id: 'avvisi', titolo: 'Avvisi e chat', icona: '🔔', colore: '#fb923c' },
  { id: 'profiliamo', titolo: 'Profiliamo: cosa fare oggi per cliente', icona: '📣', colore: '#facc15' },
  { id: 'bet_mant', titolo: 'Bet di mantenimento', icona: '🛡️', colore: '#fbbf24' },
  { id: 'bet_prof', titolo: 'Bet di profilazione e recupero', icona: '⚽', colore: '#38bdf8' },
  { id: 'masaniello', titolo: 'Masaniello di recupero (PronoX)', icona: '🎲', colore: '#34d399' },
  { id: 'live', titolo: 'Sessioni Live (casinò)', icona: '🎰', colore: '#c084fc' },
  { id: 'mirate', titolo: 'Profilazioni mirate di oggi', icona: '🎯', colore: '#a78bfa' },
  { id: 'conti', titolo: 'Conti da movimentare oggi', icona: '🗂️', colore: '#7dd3fc' },
  { id: 'ritorno', titolo: 'Rimandate che tornano oggi', icona: '↩️', colore: '#94a3b8' },
]

const SEZIONI_ID = new Set(SEZIONI.map(s => s.id))

// Le bet del Masaniello già confermate hanno un id fisso: restano "fatte" anche nei giorni dopo.
// Le altre voci (bet del giorno, conti, avvisi, promo...) vengono ricalcolate ogni giorno, quindi "fatto" vale solo per il giorno in cui l'hai segnato.
export const eDurevole = (key) => /^masaniello\|bet\|/.test(String(key || ''))

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

const euroIt = (n) => (Number(n) || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
const quandoIt = (iso) => new Date(iso).toLocaleString('it-IT', { timeZone: 'Europe/Rome', weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

// Bet del Masaniello di recupero già confermate (righe di recupero_bets): da piazzare, oppure piazzate oggi
export function vociMasaniello(bets = [], adesso = Date.now(), inizioOggiMs = 0) {
  const out = []
  for (const b of bets) {
    const inizio = b.event_start ? new Date(b.event_start).getTime() : null
    const base = {
      key: `masaniello|bet|${b.id}`,
      sezione: 'masaniello',
      titolo: `${b.book_nome || '—'} · ${b.intestatario || '—'}`,
      dettaglio: `${b.partita || ''}${b.esito_label ? ` · ${b.esito_label}` : ''} · ${euroIt(b.importo)}${b.quota_minima ? ` · quota minima ${String(b.quota_minima).replace('.', ',')}` : ''}${b.event_start ? ` · ${quandoIt(b.event_start)}` : ''}`,
      tag: 'da piazzare',
    }
    if (b.stato === 'da_fare' && inizio && inizio > adesso) out.push(base)
    else if (b.stato === 'piazzata' && b.piazzata_at && new Date(b.piazzata_at).getTime() >= inizioOggiMs) out.push({ ...base, tag: 'piazzata', fatta: true, nota: 'piazzata nel Profit Tracker' })
  }
  return out
}

// Partite che Lucy PROPONE per il Masaniello di recupero e che non sono ancora confermate (scheda di schedaDelGiorno):
// una voce per ogni conto su cui va giocata la puntata
export function vociSchedaMasaniello(scheda, adesso = Date.now()) {
  const out = []
  for (const b of scheda?.bets || []) {
    if (b.event_start && new Date(b.event_start).getTime() <= adesso) continue
    for (const z of b.pezzi || []) {
      out.push({
        key: `masaniello|prop|${b.event_id}|${z.book_id}`,
        sezione: 'masaniello',
        titolo: `${z.nome || '—'} · ${z.intestatario || '—'}`,
        dettaglio: `${b.partita || ''}${b.esito ? ` · ${b.esito}` : ''} · ${euroIt(z.importo)}${b.quotaMinima ? ` · quota minima ${String(b.quotaMinima).replace('.', ',')}` : ''}${b.event_start ? ` · ${quandoIt(b.event_start)}` : ''} · scheda proposta: va prima confermata`,
        tag: 'proposta',
      })
    }
    if (Number(b.nonCollocato) > 0) {
      out.push({
        key: `masaniello|prop|${b.event_id}|nc`,
        sezione: 'masaniello',
        titolo: `${euroIt(b.nonCollocato)} senza conto`,
        dettaglio: `${b.partita || ''}: i conti disponibili sono al tetto settimanale`,
        tag: 'attenzione',
      })
    }
  }
  return out
}

// Cosa dice Profiliamo di fare OGGI, una voce per cliente (conto in profilazione).
//  conti = [{ id, nome, intestatario, variante }]  (variante = quella del cliente, '' se il book non ne ha)
//  voci  = voci di Profiliamo [{ book, variante, azione, scostamento, altraVariante }]
// Se Profiliamo contraddice il protocollo la voce porta l'avviso ⚠️ (tag "attenzione").
export function vociProfiliamo(conti = [], voci = [], oggi = dataIso()) {
  const out = []
  for (const c of conti) {
    const v = voci.find(x => x && x.book === c.nome && (x.variante || '') === (c.variante || '') && !x.altraVariante && x.azione)
    if (!v) continue
    out.push({
      key: `profiliamo|${oggi}|${c.id}`,
      sezione: 'profiliamo',
      titolo: `${c.nome} · ${c.intestatario || '—'}`,
      dettaglio: `Oggi per ${c.intestatario || 'questo cliente'}: ${String(v.azione).replace(/\s+/g, ' ').trim()}${v.scostamento ? ` · ⚠️ SI DISCOSTA DAL TUO PROTOCOLLO: ${String(v.scostamento).replace(/\s+/g, ' ').trim()}` : ''}`,
      tag: v.scostamento ? 'attenzione' : 'profiliamo',
    })
  }
  return out
}

// Servizi software (ChatGPT, Supabase, Anthropic, Vercel): restano in lista finché non li segni "Pagato" nel mese.
//  rate = rate già maturate e non pagate [{ key, amount, nome, day }]
export function vociPagamenti(rate = [], meseKey = '') {
  return rate.map(r => ({
    key: `pagamento|${meseKey}|${r.key}`,
    sezione: 'pagamenti',
    titolo: `${r.nome || r.key} · ${(Number(r.amount) || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`,
    dettaglio: `scadenza giorno ${r.day} · quando hai pagato segna "✅ Pagato" in Dashboard › Accantonamenti: da lì sparisce da sola`,
    tag: 'servizio',
  }))
}

// Promo con scadenza oggi (righe di promo_bonus ancora "da fare")
export function vociPromo(righe = [], oggi = dataIso()) {
  const out = []
  for (const p of righe) {
    if (!p || p.scadenza !== oggi) continue
    // 14/10/2026: deposito, rollover e importo da giocare, se scritti nella promo
    const euro = (x) => (x != null && x !== '' ? `${String(x).replace('.', ',')}${/[a-z€%]/i.test(String(x)) ? '' : ' €'}` : '')
    const pezzi = [
      p.tipo || 'promo',
      euro(p.versamento) && `deposito ${euro(p.versamento)}`,
      euro(p.bonus) && `bonus ${euro(p.bonus)}`,
      p.rollover != null && String(p.rollover).trim() !== '' && `rollover ${String(p.rollover).trim()}`,
      euro(p.da_giocare) && `da giocare ${euro(p.da_giocare)}`,
      'scade OGGI',
    ].filter(Boolean)
    out.push({
      key: `promo|${p.id}`,
      sezione: 'promo',
      titolo: `${p.cliente || '—'}${p.book ? ` · ${p.book}` : ''}`,
      dettaglio: pezzi.join(' · '),
      tag: 'scade oggi',
      // 14/10/2026: la nota scritta nella promo e come ritrovarla nella tab Promo (usate solo per mostrarle, non vengono salvate)
      notaPromo: String(p.note || '').trim(),
      promoCerca: `${p.cliente || ''} ${p.book || ''}`.trim(),
    })
  }
  return out
}

// ════════════════════════════════════════════════════════════════════
// 28/10/2026 · UNA AZIONE AL GIORNO (richiesta di Sergio: 93 cose erano troppe e facevano ansia)
//  • FOCUS: le azioni di mantenimento (bet di mantenimento, sessioni Live, conti da movimentare). La pagina ne mostra UNA alla volta:
//    Fatto / Già fatto / Salta; chiusa quella, "Ne faccio un'altra" solo se ha tempo. Niente accumulo: il giorno dopo si ricalcola da capo.
//  • ROSSE: Profiliamo e profilazioni mirate non sono voci della lista, sono avvisi rossi in Dashboard (Apri / Salta).
//  • FACOLTATIVE: bet di profilazione e recupero, non contano nel numero.
//  • tutto il resto (promo, pagamenti, avvisi, rimandate che tornano, Masaniello) resta una lista e conta per intero.
// ════════════════════════════════════════════════════════════════════
export const SEZIONI_FOCUS = ['bet_mant', 'live', 'conti']
export const SEZIONI_ROSSE = ['profiliamo', 'mirate']
export const SEZIONI_FACOLTATIVE = ['bet_prof']
export const SEZIONI_NASCOSTE = [...SEZIONI_FOCUS, ...SEZIONI_ROSSE, ...SEZIONI_FACOLTATIVE]

// Quante cose sono davvero "da fare" oggi: la lista vera + al massimo UNA azione di mantenimento.
//  voci = voci della fotografia [{ sezione, fatta }]
export function contaObbligatorie(voci = []) {
  let n = 0, focus = false
  for (const v of voci) {
    if (!v || v.fatta) continue
    if (SEZIONI_FOCUS.includes(v.sezione)) focus = true
    else if (SEZIONI_ROSSE.includes(v.sezione) || SEZIONI_FACOLTATIVE.includes(v.sezione)) continue
    else n++
  }
  return n + (focus ? 1 : 0)
}
