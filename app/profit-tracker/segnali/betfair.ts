// ════════════════════════════════════════════════════════════════════
// BETFAIR ↔ SEGNALI (06/10/2026) · sola lettura
// Abbina un segnale (ScoreTrend, Hunterbet, PronoX) alla partita su Betfair e ne calcola la quota:
//   • "mercato"  = prezzo vero dell'Exchange (back / lay e soldi disponibili);
//   • "derivata" = calcolata con l'aritmetica dai mercati veri (doppie chance, multigol);
//   • "stimata"  = ricavata da un modello (Poisson + correzione sui punteggi bassi) adattato ai prezzi del mercato:
//                  serve per le combo ("12 + MG 1-3", "1 + Over 1,5"). È una stima, non un prezzo giocabile.
// Se l'abbinamento della partita non è sicuro NON si mostra nulla (meglio "—" di una quota sbagliata).
// ════════════════════════════════════════════════════════════════════

export type SelBF = { nome: string; back: number | null; lay: number | null; backSize: number | null; laySize: number | null; ltp: number | null; inGioco: boolean; letto: string | null }
export type MercatoBF = { marketId: string; tipo: string; sel: SelBF[] }
export type EventoBF = { eventId: string; evento: string; casa: string; ospite: string; inizio: number; mercati: Record<string, MercatoBF>; _casa?: Nome; _ospite?: Nome }

export type Pezzo =
  | { k: 'esito'; v: '1' | 'X' | '2' | '1X' | 'X2' | '12'; tempo: 'ft' | 'ht' }
  | { k: 'ou'; lato: 'over' | 'under'; linea: number; tempo: 'ft' | 'ht' }
  | { k: 'btts'; si: boolean }
  | { k: 'mg'; da: number; a: number }

export type CellaBF =
  | { stato: 'ok'; tipo: 'mercato' | 'derivata' | 'stimata'; testo: string; dettaglio: string; vecchiaMin: number | null; deltaBook: number | null }
  | { stato: 'nd'; motivo: string }

// ─── lettura da Supabase ─────────────────────────────────────────────
export async function caricaBetfair(supabase: any): Promise<EventoBF[]> {
  const leggi = async (tabella: string, colonne: string, ordine: string[]) => {
    const out: any[] = []
    for (let da = 0; ; da += 1000) {
      let q = supabase.from(tabella).select(colonne)
      for (const o of ordine) q = q.order(o, { ascending: true })
      const { data, error } = await q.range(da, da + 999)
      if (error) throw new Error(error.message)
      out.push(...(data || []))
      if (!data || data.length < 1000) break
    }
    return out
  }
  const [mercati, quote] = await Promise.all([
    leggi('betfair_mercati', 'market_id,event_id,evento,casa,ospite,tipo,inizio', ['market_id']),
    leggi('betfair_quote_ultime', 'market_id,selection_id,nome,back,back_size,lay,lay_size,ltp,in_gioco,letto', ['market_id', 'selection_id']),
  ])
  const num = (x: any) => (x === null || x === undefined || x === '' || !Number.isFinite(Number(x)) ? null : Number(x))
  const perMercato = new Map<string, SelBF[]>()
  for (const q of quote) {
    const l = perMercato.get(q.market_id) || []
    l.push({ nome: String(q.nome ?? ''), back: num(q.back), lay: num(q.lay), backSize: num(q.back_size), laySize: num(q.lay_size), ltp: num(q.ltp), inGioco: !!q.in_gioco, letto: q.letto ?? null })
    perMercato.set(q.market_id, l)
  }
  const eventi = new Map<string, EventoBF>()
  for (const m of mercati) {
    const inizio = m.inizio ? Date.parse(m.inizio) : NaN
    if (!Number.isFinite(inizio) || !m.event_id) continue
    let ev = eventi.get(m.event_id)
    if (!ev) {
      const pezzi = String(m.evento || '').split(/ v | vs | - /i)
      ev = { eventId: m.event_id, evento: String(m.evento || ''), casa: String(m.casa || pezzi[0] || '').trim(), ospite: String(m.ospite || pezzi[1] || '').trim(), inizio, mercati: {} }
      eventi.set(m.event_id, ev)
    }
    ev.mercati[m.tipo] = { marketId: m.market_id, tipo: m.tipo, sel: perMercato.get(m.market_id) || [] }
  }
  return [...eventi.values()]
}

// ─── nomi delle squadre ──────────────────────────────────────────────
export type Nome = { tok: string[]; marc: string }
const TOGLI = new Set(['fc', 'cf', 'ac', 'afc', 'fk', 'sk', 'ud', 'cd', 'sd', 'club', 'calcio', 'de', 'la', 'le', 'el', 'los', 'las', 'the', 'sv', 'vfb', 'vfl', 'ssc', 'as', 'us', 'rc', 'rcd'])
const MARC = new Set(['w', 'women', 'femminile', 'feminino', 'femenino', 'u17', 'u18', 'u19', 'u20', 'u21', 'u23', 'ii', 'b', 'reserves', 'res', 'youth'])
const ALIAS: Record<string, string> = {
  'man utd': 'manchester united', 'manchester utd': 'manchester united', 'man united': 'manchester united', 'man city': 'manchester city',
  'spurs': 'tottenham', 'tottenham hotspur': 'tottenham', 'inter milan': 'inter', 'internazionale': 'inter', 'juve': 'juventus',
  'psg': 'paris saint germain', 'paris sg': 'paris saint germain', 'paris saint germain': 'paris saint germain',
  'bayern munchen': 'bayern munich', 'atl madrid': 'atletico madrid', 'ath bilbao': 'athletic bilbao', 'athletic club': 'athletic bilbao',
  'wolves': 'wolverhampton', 'wolverhampton wanderers': 'wolverhampton', 'newcastle utd': 'newcastle united', 'sheffield utd': 'sheffield united',
  'borussia monchengladbach': 'monchengladbach', 'borussia mgladbach': 'monchengladbach', 'b monchengladbach': 'monchengladbach',
  'rb leipzig': 'leipzig', 'sporting cp': 'sporting lisbon', 'sporting lisboa': 'sporting lisbon', 'south korea': 'korea republic', 'korea republic': 'korea republic',
}
export function normSquadra(s: string | null | undefined): Nome {
  let t = String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  t = t.replace(/\([^)]*\)/g, ' ').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim()
  t = ALIAS[t] ?? t
  const parole = t.split(' ').filter(Boolean)
  const marc = parole.filter(p => MARC.has(p)).sort().join('')
  const tok = parole.filter(p => !TOGLI.has(p) && !MARC.has(p))
  return { tok, marc }
}
function lev(a: string, b: string) {
  const m = a.length, n = b.length
  if (!m) return n
  if (!n) return m
  let prec = Array.from({ length: n + 1 }, (_, j) => j)
  for (let i = 1; i <= m; i++) {
    const cur = [i]
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prec[j] + 1, cur[j - 1] + 1, prec[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    prec = cur
  }
  return prec[n]
}
// 0 = diverse · 1 = uguali. Regola prudente: stesse marcature (donne/under) e nomi uguali, contenuti o quasi uguali.
export function simSquadra(x: Nome, y: Nome): number {
  if (!x.tok.length || !y.tok.length || x.marc !== y.marc) return 0
  const A = x.tok.join(' '), B = y.tok.join(' ')
  if (A === B || [...x.tok].sort().join(' ') === [...y.tok].sort().join(' ')) return 1
  const [corto, lungo] = x.tok.length <= y.tok.length ? [x.tok, y.tok] : [y.tok, x.tok]
  if (corto.every(p => lungo.includes(p)) && (corto.length >= 2 || corto[0].length >= 5)) return 0.92
  const sim = 1 - lev(A.replace(/ /g, ''), B.replace(/ /g, '')) / Math.max(A.replace(/ /g, '').length, B.replace(/ /g, '').length)
  return sim >= 0.86 ? sim : 0
}
const cacheNomi = new Map<string, Nome>()
const nome = (s: string | null | undefined) => { const k = String(s || ''); let n = cacheNomi.get(k); if (!n) { n = normSquadra(k); cacheNomi.set(k, n) } return n }

// ─── orari ───────────────────────────────────────────────────────────
function offsetRoma(ms: number) {
  const p = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Rome', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date(ms))
  const g = (t: string) => Number(p.find(x => x.type === t)?.value)
  return Math.round((Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute'), g('second')) - ms) / 60000)
}
export function romaAUtc(data: string | null | undefined, ora: string | null | undefined): number | null {
  const d = String(data || '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!d) return null
  const o = String(ora || '').match(/^(\d{1,2})[:.](\d{2})/)
  const guess = Date.UTC(Number(d[1]), Number(d[2]) - 1, Number(d[3]), o ? Number(o[1]) : 12, o ? Number(o[2]) : 0)
  const u1 = guess - offsetRoma(guess) * 60000
  return guess - offsetRoma(u1) * 60000
}
const MIN = 60000, ORA = 3600000

type Canale = 'scoretrend' | 'pronox' | 'hunter'
type Finestra = { da: number; a: number }
function finestraSegnale(canale: Canale, s: any): Finestra | null {
  const msg = s.data_msg ? Date.parse(s.data_msg) : NaN
  const live = canale === 'scoretrend' ? s.live === 'live' : canale === 'hunter' ? (s.fase || (String(s.tipo_segnale || '').startsWith('GOL_') ? 'LIVE' : 'PRE-LIVE')) === 'LIVE' : false
  if (canale !== 'hunter') {
    let t: number | null = null
    const dp = String(s.data_partita || '')
    if (/^\d{4}-\d{2}-\d{2}T/.test(dp) && !s.ora) { const x = Date.parse(dp); t = Number.isFinite(x) ? x : null }
    else t = romaAUtc(dp, s.ora)
    if (t !== null) return /^\d{4}-\d{2}-\d{2}$/.test(dp.trim()) && !s.ora ? { da: t - 14 * ORA, a: t + 14 * ORA } : { da: t - 3 * ORA, a: t + 3 * ORA }
  }
  if (!Number.isFinite(msg)) return null
  return live ? { da: msg - 150 * MIN, a: msg + 10 * MIN } : { da: msg - 10 * MIN, a: msg + 72 * ORA }
}
export function trovaEvento(eventi: EventoBF[], casa: string | null, ospite: string | null, fin: Finestra): { ev: EventoBF | null; motivo: string } {
  if (!casa || !ospite) return { ev: null, motivo: 'segnale senza i nomi delle squadre' }
  const c = nome(casa), o = nome(ospite)
  const buoni: { ev: EventoBF; s: number }[] = []
  for (const ev of eventi) {
    if (ev.inizio < fin.da || ev.inizio > fin.a) continue
    const sc = simSquadra(c, nome(ev.casa)), so = simSquadra(o, nome(ev.ospite))
    const s = Math.min(sc, so)
    if (s > 0) buoni.push({ ev, s })
  }
  if (!buoni.length) return { ev: null, motivo: 'partita non trovata su Betfair (o fuori dalle ultime 48 ore)' }
  buoni.sort((a, b) => b.s - a.s)
  if (buoni.length > 1 && buoni[0].s - buoni[1].s < 0.03) return { ev: null, motivo: 'abbinamento ambiguo: più partite simili' }
  return { ev: buoni[0].ev, motivo: '' }
}

// ─── cosa chiede il segnale ──────────────────────────────────────────
const testoNorm = (x: any) => String(x ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
const lineaDa = (t: string): number | null => {
  let m = t.match(/(\d{1,2})\s*[.,]\s*(\d)/)
  if (m) return Number(`${m[1]}.${m[2]}`)
  m = t.match(/(?:ou|over|under|o|u)[\s_]*(\d)(\d)\b/)
  return m ? Number(`${m[1]}.${m[2]}`) : null
}
function esitoDa(sel: string, casa: string | null, ospite: string | null): '1' | 'X' | '2' | null {
  const t = testoNorm(sel).trim()
  if (t === '1' || t === 'home' || t === 'casa') return '1'
  if (t === '2' || t === 'away' || t === 'ospite' || t === 'trasferta') return '2'
  if (t === 'x' || /pareg|draw|^pari/.test(t)) return 'X'
  const n = nome(sel)
  if (simSquadra(n, nome(casa)) > 0) return '1'
  if (simSquadra(n, nome(ospite)) > 0) return '2'
  return null
}
export function pezziScoreTrend(s: any): Pezzo[] | null {
  const tempoTxt = testoNorm(s.tempo).trim()
  const ht = !!tempoTxt && tempoTxt !== 'finale' && /(^|\b)(1|ht|primo|1t|1°t|first)/.test(tempoTxt)
  if (tempoTxt && tempoTxt !== 'finale' && !ht) return null
  const tempo: 'ft' | 'ht' = ht ? 'ht' : 'ft'
  const merc = testoNorm(s.mercato), sel = testoNorm(s.selezione)
  if (/^1\s*x\s*2$/.test(merc.trim()) || merc.trim() === '1x2') {
    const e = esitoDa(String(s.selezione ?? ''), s.casa, s.ospite)
    return e ? [{ k: 'esito', v: e, tempo }] : null
  }
  if (/(btts|goal|gol)/.test(merc + ' ' + sel) && !/(over|under)/.test(merc + ' ' + sel)) return [{ k: 'btts', si: !/(\bno\b|nogol|no goal|nogoal)/.test(sel) }]
  const linea = typeof s.linea === 'number' ? s.linea : s.linea != null && Number.isFinite(Number(s.linea)) ? Number(s.linea) : lineaDa(merc + ' ' + sel)
  if (linea == null) return null
  return [{ k: 'ou', lato: /under/.test(sel) ? 'under' : 'over', linea, tempo }]
}
export function pezziPronox(s: any): Pezzo[] | null {
  const merc = testoNorm(s.mercato), sel = testoNorm(s.selezione), et = testoNorm(s.etichetta)
  const tutto = `${merc} ${sel} ${et}`
  if (/(btts|both|goal|gol)/.test(merc + ' ' + et) && !/(over|under|\bou\b)/.test(merc)) return [{ k: 'btts', si: !/(\bno\b|nogol|no goal|nogoal|under)/.test(sel || et) }]
  if (/(over|under|\bou\b|o\/u|ou_?\d)/.test(merc) || /(over|under)/.test(sel)) {
    const linea = lineaDa(merc) ?? lineaDa(tutto)
    if (linea == null) return null
    return [{ k: 'ou', lato: /under/.test(sel) ? 'under' : /over/.test(sel) ? 'over' : /under/.test(et) && !/over/.test(et) ? 'under' : 'over', linea, tempo: 'ft' }]
  }
  const e = esitoDa(String(s.selezione ?? ''), s.casa, s.ospite) ?? esitoDa(String(s.etichetta ?? ''), s.casa, s.ospite)
  return e ? [{ k: 'esito', v: e, tempo: 'ft' }] : null
}
export function pezziHunter(s: any): Pezzo[] | null {
  const tipo = String(s.tipo_segnale || '').toUpperCase().trim()
  if (!tipo || tipo === 'GOL_CASA' || tipo === 'GOL_OSPITI') return null
  const out: Pezzo[] = []
  for (const p of tipo.split('+').map(x => x.trim()).filter(Boolean)) {
    let m: RegExpMatchArray | null
    if (['1', 'X', '2', '12', '1X', 'X2'].includes(p)) out.push({ k: 'esito', v: p as any, tempo: 'ft' })
    else if (/^(GG|GOAL)$/.test(p)) out.push({ k: 'btts', si: true })
    else if (/^(NG|NO ?GOAL)$/.test(p)) out.push({ k: 'btts', si: false })
    else if ((m = p.match(/^(?:OVER|O)\s*(\d+(?:[.,]5)?)$/))) out.push({ k: 'ou', lato: 'over', linea: Number(m[1].replace(',', '.')), tempo: 'ft' })
    else if ((m = p.match(/^(?:UNDER|U)\s*(\d+(?:[.,]5)?)$/))) out.push({ k: 'ou', lato: 'under', linea: Number(m[1].replace(',', '.')), tempo: 'ft' })
    else if ((m = p.match(/^(?:MG|MULTIGOL)\s*(\d+)\s*-\s*(\d+)$/))) out.push({ k: 'mg', da: Number(m[1]), a: Number(m[2]) })
    else return null
  }
  return out.length ? out : null
}

// ─── prezzi dai mercati ──────────────────────────────────────────────
const mid = (s: SelBF | undefined | null) => (!s ? null : s.back != null && s.lay != null ? (s.back + s.lay) / 2 : s.back ?? s.lay ?? null)
const codice = (linea: number) => String(Math.round(linea * 10)).padStart(2, '0')
const tipoOU = (linea: number, ht: boolean) => (ht ? 'FIRST_HALF_GOALS_' : 'OVER_UNDER_') + codice(linea)
const selOU = (m: MercatoBF | undefined, lato: 'over' | 'under') => m?.sel.find(x => (lato === 'over' ? /^over/i : /^under/i).test(x.nome))
const selYN = (m: MercatoBF | undefined, si: boolean) => m?.sel.find(x => (si ? /^yes$/i : /^no$/i).test(x.nome))
function selEsito(m: MercatoBF | undefined, ev: EventoBF, v: '1' | 'X' | '2') {
  if (!m) return undefined
  const draw = m.sel.find(x => /draw/i.test(x.nome))
  if (v === 'X') return draw
  const alt = m.sel.filter(x => x !== draw)
  const casa = alt.find(x => simSquadra(nome(x.nome), nome(ev.casa)) > 0)
  const osp = alt.find(x => simSquadra(nome(x.nome), nome(ev.ospite)) > 0)
  return v === '1' ? casa : osp
}
const selDC = (m: MercatoBF | undefined, v: '1X' | 'X2' | '12') => m?.sel.find(x => (v === '1X' ? /home or draw/i : v === 'X2' ? /draw or away/i : /home or away/i).test(x.nome))

function prob1x2(ev: EventoBF, ht: boolean): [number, number, number] | null {
  const m = ev.mercati[ht ? 'HALF_TIME' : 'MATCH_ODDS']
  const a = mid(selEsito(m, ev, '1')), b = mid(selEsito(m, ev, 'X')), c = mid(selEsito(m, ev, '2'))
  if (!a || !b || !c) return null
  const s = 1 / a + 1 / b + 1 / c
  return [1 / a / s, 1 / b / s, 1 / c / s]
}
function probOver(ev: EventoBF, linea: number, ht: boolean): number | null {
  const m = ev.mercati[tipoOU(linea, ht)]
  const o = mid(selOU(m, 'over')), u = mid(selOU(m, 'under'))
  if (!o || !u) return null
  return 1 / o / (1 / o + 1 / u)
}
function probBtts(ev: EventoBF): number | null {
  const m = ev.mercati['BOTH_TEAMS_TO_SCORE']
  const y = mid(selYN(m, true)), n = mid(selYN(m, false))
  if (!y || !n) return null
  return 1 / y / (1 / y + 1 / n)
}
const probAlmeno = (ev: EventoBF, k: number): number | null => (k <= 0 ? 1 : probOver(ev, k - 0.5, false))

// ─── modello (Poisson + correzione punteggi bassi) adattato ai prezzi ─
const N = 11
function griglia(lh: number, la: number, rho: number): number[][] {
  const pois = (l: number) => { const o = [Math.exp(-l)]; for (let k = 1; k < N; k++) o.push(o[k - 1] * l / k); return o }
  const ph = pois(lh), pa = pois(la)
  const g: number[][] = []
  let tot = 0
  for (let h = 0; h < N; h++) {
    g.push([])
    for (let a = 0; a < N; a++) {
      let tau = 1
      if (h === 0 && a === 0) tau = 1 - lh * la * rho
      else if (h === 0 && a === 1) tau = 1 + lh * rho
      else if (h === 1 && a === 0) tau = 1 + la * rho
      else if (h === 1 && a === 1) tau = 1 - rho
      const p = Math.max(0, ph[h] * pa[a] * tau)
      g[h].push(p); tot += p
    }
  }
  return g.map(r => r.map(p => p / tot))
}
type Bersaglio = { v: number; f: (h: number, a: number) => boolean }
function bersagli(ev: EventoBF): Bersaglio[] {
  const out: Bersaglio[] = []
  const e = prob1x2(ev, false)
  if (e) out.push({ v: e[0], f: (h, a) => h > a }, { v: e[1], f: (h, a) => h === a }, { v: e[2], f: (h, a) => h < a })
  for (const k of [1, 2, 3, 4, 5]) { const p = probAlmeno(ev, k); if (p != null && k >= 1) out.push({ v: p, f: (h, a) => h + a >= k }) }
  const b = probBtts(ev)
  if (b != null) out.push({ v: b, f: (h, a) => h > 0 && a > 0 })
  return out
}
export type Modello = { g: number[][]; err: number }
const cacheModello = new WeakMap<EventoBF, Modello | null>()
export function adattaModello(ev: EventoBF): Modello | null {
  if (cacheModello.has(ev)) return cacheModello.get(ev) ?? null
  const m = adattaModelloRaw(ev)
  cacheModello.set(ev, m)
  return m
}
function adattaModelloRaw(ev: EventoBF): Modello | null {
  const T = bersagli(ev)
  if (T.length < 4 || !prob1x2(ev, false)) return null
  const loss = (x: number[]) => {
    const g = griglia(x[0], x[1], x[2])
    let s = 0
    for (const t of T) { let p = 0; for (let h = 0; h < N; h++) for (let a = 0; a < N; a++) if (t.f(h, a)) p += g[h][a]; s += (p - t.v) ** 2 }
    return s
  }
  const lim = [[0.05, 6], [0.05, 6], [-0.3, 0.2]]
  const e = prob1x2(ev, false)!
  let tot = 0, nT = 0
  for (const k of [1, 2, 3, 4, 5]) { const p = probAlmeno(ev, k); if (p != null) { tot += p; nT++ } }
  const gol = nT >= 2 ? Math.min(5, Math.max(0.6, tot * (5 / nT) * 0.7)) : 2.6
  let x = [Math.max(0.2, gol * (e[0] + e[1] / 2)), Math.max(0.2, gol * (e[2] + e[1] / 2)), 0]
  let f = loss(x)
  const passi = [0.3, 0.3, 0.06]
  for (let it = 0; it < 500; it++) {
    let mig = false
    for (let i = 0; i < 3; i++) for (const sg of [1, -1]) {
      const y = x.slice(); y[i] = Math.min(lim[i][1], Math.max(lim[i][0], y[i] + sg * passi[i]))
      const fy = loss(y)
      if (fy < f - 1e-13) { x = y; f = fy; mig = true }
    }
    if (!mig) { for (let i = 0; i < 3; i++) passi[i] /= 2; if (passi[0] < 2e-4) break }
  }
  const g = griglia(x[0], x[1], x[2])
  let errMax = 0
  for (const t of T) { let p = 0; for (let h = 0; h < N; h++) for (let a = 0; a < N; a++) if (t.f(h, a)) p += g[h][a]; errMax = Math.max(errMax, Math.abs(p - t.v)) }
  return { g, err: errMax }
}
function provaPezzo(p: Pezzo, h: number, a: number): boolean | null {
  if (p.k === 'esito') {
    if (p.tempo === 'ht') return null
    return p.v === '1' ? h > a : p.v === 'X' ? h === a : p.v === '2' ? h < a : p.v === '1X' ? h >= a : p.v === 'X2' ? h <= a : h !== a
  }
  if (p.k === 'ou') return p.tempo === 'ht' ? null : p.lato === 'over' ? h + a > p.linea : h + a < p.linea
  if (p.k === 'btts') return p.si ? h > 0 && a > 0 : !(h > 0 && a > 0)
  return h + a >= p.da && h + a <= p.a
}
export function probModello(m: Modello, pezzi: Pezzo[]): number | null {
  let p = 0
  for (let h = 0; h < N; h++) for (let a = 0; a < N; a++) {
    let ok = true
    for (const z of pezzi) { const r = provaPezzo(z, h, a); if (r === null) return null; if (!r) { ok = false; break } }
    if (ok) p += m.g[h][a]
  }
  return p
}

// ─── quota di un segnale ─────────────────────────────────────────────
const fmt = (x: number | null | undefined, d = 2) => (x == null ? '–' : x.toFixed(d).replace('.', ','))
const eta = (ev: EventoBF, tipi: string[], ora: number): number | null => {
  let max: number | null = null
  for (const t of tipi) for (const s of ev.mercati[t]?.sel || []) {
    const x = s.letto ? Date.parse(s.letto) : NaN
    if (Number.isFinite(x)) { const m = Math.max(0, Math.round((ora - x) / MIN)); max = max === null ? m : Math.max(max, m) }
  }
  return max
}
const MAX_ERR_MODELLO = 0.035

export function quotaPezzi(pezzi: Pezzo[], ev: EventoBF, ora = Date.now(), quotaBook: number | null = null): CellaBF {
  const ok = (tipo: 'mercato' | 'derivata' | 'stimata', testo: string, dettaglio: string, tipi: string[], rif: number | null): CellaBF => ({
    stato: 'ok', tipo, testo, dettaglio, vecchiaMin: eta(ev, tipi, ora), deltaBook: quotaBook && rif ? (quotaBook / rif - 1) * 100 : null })
  const nd = (motivo: string): CellaBF => ({ stato: 'nd', motivo })
  const diretta = (s: SelBF | undefined, tipo: string): CellaBF | null => {
    if (!s || (s.back == null && s.lay == null)) return null
    return ok('mercato', `${fmt(s.back)} / ${fmt(s.lay)}`, `Betfair ${tipo}: back ${fmt(s.back)} (disp. ${fmt(s.backSize, 0)} €) · lay ${fmt(s.lay)} (disp. ${fmt(s.laySize, 0)} €)`, [tipo], s.back)
  }
  const derivata = (p: number | null, tipo: string, tipi: string[], come: string): CellaBF | null =>
    p && p > 0.001 && p < 0.999 ? ok('derivata', `~${fmt(1 / p)}`, `Quota calcolata (${come}): giusta ${fmt(1 / p)} · non è un prezzo giocabile`, tipi, 1 / p) : null

  if (pezzi.length === 1) {
    const z = pezzi[0]
    if (z.k === 'esito') {
      const ht = z.tempo === 'ht', base = ht ? 'HALF_TIME' : 'MATCH_ODDS'
      if (z.v === '1' || z.v === 'X' || z.v === '2') return diretta(selEsito(ev.mercati[base], ev, z.v), base) ?? nd(`mercato ${base} non disponibile`)
      if (!ht) { const d = diretta(selDC(ev.mercati['DOUBLE_CHANCE'], z.v), 'DOUBLE_CHANCE'); if (d) return d }
      const p3 = prob1x2(ev, ht)
      if (!p3) return nd('1X2 non disponibile per calcolare la doppia chance')
      const p = z.v === '1X' ? p3[0] + p3[1] : z.v === 'X2' ? p3[1] + p3[2] : p3[0] + p3[2]
      return derivata(p, base, [base], 'somma delle probabilità dell\'1X2') ?? nd('doppia chance non calcolabile')
    }
    if (z.k === 'ou') {
      const ht = z.tempo === 'ht', tipo = tipoOU(z.linea, ht)
      if (!ev.mercati[tipo]) return nd(`linea ${fmt(z.linea, 1)}${ht ? ' 1°T' : ''} non registrata (${tipo})`)
      return diretta(selOU(ev.mercati[tipo], z.lato), tipo) ?? nd('quote non disponibili')
    }
    if (z.k === 'btts') return diretta(selYN(ev.mercati['BOTH_TEAMS_TO_SCORE'], z.si), 'BOTH_TEAMS_TO_SCORE') ?? nd('Gol/NoGol non disponibile')
    if (z.k === 'mg') {
      const a = probAlmeno(ev, z.da), b = probAlmeno(ev, z.a + 1)
      if (a != null && b != null) {
        const d = derivata(a - b, '', Array.from({ length: 6 }, (_, i) => tipoOU(i + 0.5, false)), `differenza tra Over ${fmt(z.da - 0.5, 1)} e Over ${fmt(z.a + 0.5, 1)}`)
        if (d) return d
      }
    }
  }
  if (pezzi.some(z => (z.k === 'esito' || z.k === 'ou') && z.tempo === 'ht')) return nd('combinazione con il 1° tempo: non stimabile')
  const mod = adattaModello(ev)
  if (!mod) return nd('mercati insufficienti per stimare')
  if (mod.err > MAX_ERR_MODELLO) return nd(`stima inaffidabile (errore ${(mod.err * 100).toFixed(1)}%)`)
  const p = probModello(mod, pezzi)
  if (p == null || p < 0.003) return nd('stima non calcolabile')
  return ok('stimata', `~${fmt(1 / p)}`, `Quota STIMATA dal modello (errore sul mercato ${(mod.err * 100).toFixed(1)}%): ${fmt(1 / p)} · è una stima, non un prezzo giocabile`,
    ['MATCH_ODDS', 'OVER_UNDER_15', 'OVER_UNDER_25', 'OVER_UNDER_35', 'BOTH_TEAMS_TO_SCORE'], 1 / p)
}

export function quotaPerSegnale(canale: Canale, s: any, eventi: EventoBF[], ora = Date.now()): CellaBF {
  if (!eventi.length) return { stato: 'nd', motivo: 'nessun dato Betfair (servizio fermo o non leggibile da questo accesso)' }
  const pezzi = canale === 'scoretrend' ? pezziScoreTrend(s) : canale === 'pronox' ? pezziPronox(s) : pezziHunter(s)
  if (!pezzi) return { stato: 'nd', motivo: canale === 'hunter' && /^GOL_/.test(String(s.tipo_segnale || '')) ? 'segnale "gol dopo il segnale": nessun mercato Betfair corrispondente' : 'segnale non traducibile in un mercato Betfair' }
  const fin = finestraSegnale(canale, s)
  if (!fin) return { stato: 'nd', motivo: 'orario della partita non disponibile' }
  const { ev, motivo } = trovaEvento(eventi, s.casa, s.ospite, fin)
  if (!ev) return { stato: 'nd', motivo }
  const q = s.quota != null && Number.isFinite(Number(s.quota)) ? Number(s.quota) : null
  return quotaPezzi(pezzi, ev, ora, q)
}
