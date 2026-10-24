// =====================================================================
// RECUPERO CONTI · Masaniello «Hunterbet Pre-live» (23/10/2026)
// Solo funzioni pure (niente database, niente interfaccia): si possono testare da sole.
// Stesso motore del Masaniello pilota PronoX (lib/recupero/masanielloRecupero.js: statoPiano, puntateNuove, dividiTraConti),
// ma con un piano suo, tabelle sue e come partite i segnali Pre-live di Hunterbet «12 + MG 1-3».
//
// Regole concordate con Sergio (23/10/2026):
// - capitale 500 €, 30 vincite su 50 eventi, quota di riferimento 1,60 (il fondo dell'intervallo che il mercato paga: 1,60-2,00)
// - tutte le partite pre-live «12 + MG 1-3» che arrivano (dal 24/10/2026; prima una al giorno); si gioca solo se la quota trovata è almeno 1,60
// - perdita massima 200 €: poi nuove bet ferme
// - la puntata di ogni partita si divide tra i conti limitati con le stesse regole del pilota (3-8 € bonus, 2 € sport, max 25 €/settimana per conto)
// - il piano nasce SPENTO: lo accende Sergio
// =====================================================================
import { statoPiano, puntateNuove, dividiTraConti } from './masanielloRecupero'

export const PIANO_HB = {
  nome: 'Hunterbet Pre-live',
  capitale: 500,
  N: 50,
  K: 30,
  quotaRif: 1.6,
  maxEventi: 80,        // il piano si può allungare fino a qui
  sogliaAllungo: 0.02,
  perditaMax: 200,
  quotaMinima: 1.6,     // sotto questa quota non si gioca
  maxPartiteGiorno: 20, // 24/10/2026 (Sergio): si giocano TUTTE le pre-live che arrivano (prima 1 al giorno): 20 è solo un tetto di sicurezza
  oreMaxSegnale: 14,    // un segnale Pre-live più vecchio di così non si propone più (la partita è probabilmente già iniziata)
}

const MERCATO = '12+MG1-3'
export const normMercato = (t) => String(t || '').toUpperCase().replace(/\s+/g, '').replace(/–/g, '-')
export const eMercatoHB = (s) => normMercato(s?.tipo_segnale) === MERCATO
export const ePrelive = (s) => (s?.fase ? String(s.fase).toUpperCase().replace(/[^A-Z]/g, '') === 'PRELIVE' : !String(s?.tipo_segnale || '').toUpperCase().startsWith('GOL_'))

const giornoRoma = (ms) => new Date(ms).toLocaleDateString('en-CA', { timeZone: 'Europe/Rome' })
const ORA = 3600000

// ─── 1. Segnali candidati ────────────────────────────────────────────
// segnali = righe di hunterbet_segnali. giaInPiano = Set di msg_id che hanno già bet (anche saltate) o che Sergio ha scartato.
// partiteOggi = quante partite hanno già bet attive create oggi (per il tetto di una al giorno).
export function candidatiHB(segnali, { giaInPiano = new Set(), partiteOggi = 0, ora = Date.now(), piano = PIANO_HB } = {}) {
  const posti = Math.max(0, piano.maxPartiteGiorno - partiteOggi)
  if (!posti) return []
  const out = []
  for (const s of segnali || []) {
    if (!s || !eMercatoHB(s) || !ePrelive(s)) continue
    if (giaInPiano.has(String(s.msg_id))) continue
    if (s.esito) continue                                              // già deciso
    if (s.ft_casa !== null && s.ft_casa !== undefined) continue          // ha già il risultato finale
    if (String(s.stato_match || '').toUpperCase() === 'FINITA') continue
    const af = String(s.af_stato || '').toUpperCase()                    // se il programma dei risultati ha già visto la partita: solo «non ancora iniziata»
    if (af && af !== 'NS' && af !== 'TBD') continue
    const t = new Date(s.data_msg).getTime()
    if (!Number.isFinite(t) || ora - t > piano.oreMaxSegnale * ORA || t - ora > 6 * 3600000) continue
    out.push({
      event_id: String(s.msg_id), msg_id: s.msg_id, event_start: s.data_msg, competition: s.competizione || null,
      partita: s.casa && s.ospite ? `${s.casa} – ${s.ospite}` : String(s.msg_id), esito: '12 + Multigol 1-3',
      quotaMinima: piano.quotaMinima,
    })
  }
  out.sort((a, b) => String(a.event_start).localeCompare(String(b.event_start)))   // il primo arrivato
  return out.slice(0, posti)
}

// ─── 2. Eventi del piano dalle bet ───────────────────────────────────
// bets = righe di recupero_hb_bets; esiti = Map(msg_id -> 'VINTA' | 'PERSA' | 'NULLA'); una bet «da fare» non piazzata entro 18 ore non conta più.
export function eventiHB(bets, esiti, ora = Date.now()) {
  const per = new Map()
  for (const b of bets || []) { const k = String(b.msg_id); if (!per.has(k)) per.set(k, []); per.get(k).push(b) }
  const out = []
  for (const [id, righe] of per) {
    const r0 = righe[0]
    const piazzate = righe.filter((b) => b.stato === 'piazzata')
    const daFare = righe.filter((b) => b.stato === 'da_fare' && ora - new Date(b.creato || ora).getTime() < 18 * ORA)
    const inizio = r0.event_start
    if (!piazzate.length) {
      const impegno = daFare.reduce((a, b) => a + Number(b.importo), 0)
      if (impegno > 0) out.push({ event_id: id, event_start: inizio, puntata: impegno, incasso: 0, esito: 'attesa' })
      continue
    }
    const puntata = piazzate.reduce((a, b) => a + Number(b.importo), 0)
    const e = esiti.get(id)
    if (!e) { out.push({ event_id: id, event_start: inizio, puntata: puntata + daFare.reduce((a, b) => a + Number(b.importo), 0), incasso: 0, esito: 'attesa' }); continue }
    if (e === 'NULLA') out.push({ event_id: id, event_start: inizio, puntata, incasso: puntata, esito: 'nulla' })
    else if (e === 'VINTA') out.push({ event_id: id, event_start: inizio, puntata, incasso: piazzate.reduce((a, b) => a + Number(b.importo) * Number(b.quota_reale || 0), 0), esito: 'vinta' })
    else out.push({ event_id: id, event_start: inizio, puntata, incasso: 0, esito: 'persa' })
  }
  return out.sort((a, b) => String(a.event_start).localeCompare(String(b.event_start)))
}

// partite con bet ancora attive (non tutte saltate) create oggi
export function partiteOggiHB(bets, ora = Date.now()) {
  const oggi = giornoRoma(ora)
  const ids = new Set()
  for (const b of bets || []) if (b.stato !== 'saltata' && b.creato && giornoRoma(new Date(b.creato).getTime()) === oggi) ids.add(String(b.msg_id))
  return ids.size
}

// ─── 3. La scheda del giorno ─────────────────────────────────────────
// pianoDb = { capitale, N, K, quotaRif, eventi_extra, attivo, saltati: [msg_id] }
export function schedaHB({ pianoDb, eventi, segnali, conti, usoSettimana, ultimaBet, bets = [], ora = Date.now(), piano = PIANO_HB }) {
  const stato = statoPiano(pianoDb, eventi, { ...piano, quotaRif: Number(pianoDb?.quotaRif ?? piano.quotaRif) })
  const { V: _V, ...statoPulito } = stato
  if (!pianoDb?.attivo) return { stato: statoPulito, bets: [], spento: true }
  const saltati = new Set((pianoDb?.saltati || []).map(String))
  const giaInPiano = new Set([...(bets || []).map((b) => String(b.msg_id)), ...saltati])
  const candidati = candidatiHB(segnali, { giaInPiano, partiteOggi: partiteOggiHB(bets, ora), ora, piano })
  const puntate = puntateNuove(stato, candidati)
  // Perdita massima GARANTITA: il Masaniello, quando è indietro, può chiedere quasi tutto il capitale in una volta.
  // Qui la puntata non supera mai quanto si può ancora perdere restando dentro la perdita massima (capitale libero − (capitale iniziale − perdita massima)).
  const rischioLibero = Math.max(0, Math.floor(stato.capitale - stato.impegnato - (stato.capitaleIniziale - piano.perditaMax)))
  const uso = new Map(usoSettimana || [])
  const out = []
  let chiusoDiFatto = false
  let rischio = rischioLibero     // 24/10/2026: con più partite insieme il rischio si consuma partita dopo partita (la somma non supera mai la perdita massima)
  for (const p0 of puntate) {
    const limitata = p0.puntata > rischio
    const p = limitata ? { ...p0, puntata: rischio } : p0
    if (p.puntata < 2) { if (!limitata) chiusoDiFatto = true; continue }       // sotto 2 € nessun conto normale può giocarla: il capitale è già vicino all'obiettivo (o al limite di perdita)
    rischio -= p.puntata
    const { pezzi, nonCollocato } = dividiTraConti(p.puntata, p, conti, uso, ultimaBet)
    for (const z of pezzi) uso.set(String(z.book_id), (uso.get(String(z.book_id)) || 0) + z.importo)
    out.push({ ...p, pezzi, nonCollocato, limitataDalTetto: limitata, puntataMasaniello: p0.puntata })
  }
  return { stato: statoPulito, bets: out, spento: false, chiusoDiFatto }
}
