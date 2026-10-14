// ════════════════════════════════════════════════════════════════════
// CONGELAMENTO QUOTE BETFAIR (06/10/2026)
// Ogni pochi minuti (cron): per i segnali NUOVI salva il prezzo Betfair di quel momento ("al segnale") e, per le
// partite che stanno per iniziare, aggiorna il prezzo di CHIUSURA (ultimo prezzo prima del calcio d'inizio).
// Il prezzo congelato non viene mai sovrascritto: resta quello visto la prima volta.
// Serve a capire, a distanza di giorni, se il prezzo del segnale batteva il mercato (CLV = closing line value).
// ⚠ I prezzi hanno il ritardo della chiave "delayed" di Betfair, più fino a 5 minuti di attesa del cron.
// ════════════════════════════════════════════════════════════════════
import { analizzaSegnale, caricaBetfair, quotaPezzi, quotaTennis } from './betfair'
import type { Canale, EventoBF, Pezzo } from './betfair'

const ORA = 3600000, MIN = 60000
const numero = (x: any) => (x === null || x === undefined || x === '' || !Number.isFinite(Number(x)) ? null : Number(x))

type Segnale = { canale: Canale; s: any }

async function leggi(q: any, nome: string): Promise<any[]> {
  const { data, error } = await q
  if (error) throw new Error(`${nome}: ${error.message}`)
  return data || []
}

export async function eseguiCongelamento(sb: any, ora = Date.now()) {
  const eventi: EventoBF[] = await caricaBetfair(sb)
  if (!eventi.length) return { ok: true, nota: 'nessun dato Betfair: niente da congelare', nuovi: 0, chiusure: 0 }
  const iso = (ms: number) => new Date(ms).toISOString()

  // 1) segnali recenti dei tre canali
  const [st, ht, px] = await Promise.all([
    leggi(sb.from('scoretrend_segnali').select('*').gte('data_msg', iso(ora - 6 * ORA)).order('data_msg', { ascending: false }).limit(500), 'scoretrend_segnali'),
    leggi(sb.from('hunterbet_segnali').select('*').gte('data_msg', iso(ora - 6 * ORA)).order('data_msg', { ascending: false }).limit(500), 'hunterbet_segnali'),
    leggi(sb.from('pronox_segnali').select('*').not('casa', 'is', null).gte('data_partita', iso(ora - 3 * ORA)).lte('data_partita', iso(ora + 72 * ORA)).limit(1000), 'pronox_segnali'),
  ])
  const segnali: Segnale[] = [
    ...st.map(s => ({ canale: 'scoretrend' as Canale, s })), ...ht.map(s => ({ canale: 'hunter' as Canale, s })), ...px.map(s => ({ canale: 'pronox' as Canale, s })),
  ]

  // 1b) 14/10/2026 · tennis PronoX (tabella pronox_tennis_segnali): partite di ieri, oggi e dei prossimi 3 giorni
  const giornoRoma = (ms: number) => new Date(ms).toLocaleDateString('en-CA', { timeZone: 'Europe/Rome' })
  const tennis = await leggi(sb.from('pronox_tennis_segnali').select('*').gte('data_partita', giornoRoma(ora - 24 * ORA)).lte('data_partita', giornoRoma(ora + 72 * ORA)).limit(1000), 'pronox_tennis_segnali')

  // 2) quelli già congelati si saltano
  const gia = new Set<string>()
  for (const canale of ['scoretrend', 'hunter', 'pronox'] as Canale[]) {
    const ids = segnali.filter(x => x.canale === canale).map(x => x.s.msg_id)
    for (let i = 0; i < ids.length; i += 200) {
      const righe = await leggi(sb.from('betfair_segnali_quote').select('canale,msg_id').eq('canale', canale).in('msg_id', ids.slice(i, i + 200)), 'betfair_segnali_quote')
      for (const r of righe) gia.add(`${r.canale}|${r.msg_id}`)
    }
  }

  {
    const ids = tennis.map(t => t.id)
    for (let i = 0; i < ids.length; i += 200) {
      const righe = await leggi(sb.from('betfair_segnali_quote').select('canale,msg_id').eq('canale', 'tennis').in('msg_id', ids.slice(i, i + 200)), 'betfair_segnali_quote')
      for (const r of righe) gia.add(`${r.canale}|${r.msg_id}`)
    }
  }

  // 3) nuovi: si congela solo se la quota Betfair si è potuta calcolare
  const nuove: any[] = []
  const motivi: Record<string, number> = {}
  for (const { canale, s } of segnali) {
    if (gia.has(`${canale}|${s.msg_id}`)) continue
    const a = analizzaSegnale(canale, s, eventi, ora)
    if (a.cella.stato !== 'ok' || !a.ev) { const m = a.cella.stato === 'nd' ? a.cella.motivo : '?'; motivi[m] = (motivi[m] || 0) + 1; continue }
    const c = a.cella
    nuove.push({
      canale, msg_id: s.msg_id, event_id: a.ev.eventId, evento: a.ev.evento, inizio: iso(a.ev.inizio), pezzi: a.pezzi, quota_book: numero(s.quota),
      tipo: c.tipo, testo: c.testo, bf_back: c.num.back, bf_lay: c.num.lay, bf_back_size: c.num.backSize, bf_lay_size: c.num.laySize, bf_fair: c.num.fair,
      eta_min: c.vecchiaMin, iniziata: c.iniziata, vecchia: c.vecchia, segnale_il: s.data_msg ?? null, congelato_il: iso(ora),
    })
  }
  // tennis: si congela solo prima dell'inizio, con prezzi freschi e partita abbinata con certezza
  for (const t of tennis) {
    if (gia.has(`tennis|${t.id}`)) continue
    const c = quotaTennis(t, eventi, ora)
    if (c.stato !== 'ok' || !c.eventId || c.iniziata || c.vecchia || !c.back) { const m = c.stato === 'nd' ? c.motivo : 'tennis: già iniziata o prezzi vecchi'; motivi[m] = (motivi[m] || 0) + 1; continue }
    nuove.push({
      canale: 'tennis', msg_id: t.id, event_id: c.eventId, evento: c.evento, inizio: iso(c.inizio ?? ora), pezzi: [{ k: 'tennis', sel: c.selNome }], quota_book: numero(t.quota),
      tipo: 'mercato', testo: `${c.selNome}: ${c.back} / ${c.lay ?? '–'}`, bf_back: c.back, bf_lay: c.lay, bf_back_size: c.backSize, bf_lay_size: c.laySize, bf_fair: c.fair ?? null,
      eta_min: null, iniziata: false, vecchia: false, segnale_il: null, congelato_il: iso(ora),
    })
  }
  for (let i = 0; i < nuove.length; i += 200) {
    const { error } = await sb.from('betfair_segnali_quote').upsert(nuove.slice(i, i + 200), { onConflict: 'canale,msg_id', ignoreDuplicates: true })
    if (error) throw new Error(`scrittura quote congelate: ${error.message}`)
  }

  // 4) chiusura: per le partite che iniziano entro 25 minuti si aggiorna l'ultimo prezzo prima del calcio d'inizio
  const perId = new Map(eventi.map(e => [e.eventId, e]))
  const inChiusura = await leggi(sb.from('betfair_segnali_quote').select('*').gte('inizio', iso(ora)).lte('inizio', iso(ora + 25 * MIN)), 'betfair_segnali_quote')
  let chiusure = 0
  for (const r of inChiusura) {
    const ev = r.event_id ? perId.get(r.event_id) : undefined
    if (!ev || !r.pezzi) continue
    if (r.canale === 'tennis') {   // tennis: ultimo prezzo prima dell'inizio, mai dopo (in gioco) e mai con prezzi fermi
      const mk = ev.mercati['MATCH_ODDS']
      const sel = mk?.sel.find(x => x.nome === (r.pezzi as { sel?: string }[])?.[0]?.sel)
      const altro = mk?.sel.find(x => x !== sel)
      if (!mk || mk.sel.length !== 2 || !sel || !altro || !sel.back || !altro.back || sel.inGioco || altro.inGioco || ev.inizio <= ora) continue
      if (ev.battito != null && ora - ev.battito > 10 * MIN) continue
      const { error } = await sb.from('betfair_segnali_quote').update({ ch_tipo: 'mercato', ch_back: sel.back, ch_lay: sel.lay, ch_fair: sel.back * (1 / sel.back + 1 / altro.back), ch_il: iso(ora) }).eq('canale', r.canale).eq('msg_id', r.msg_id)
      if (error) throw new Error(`chiusura tennis: ${error.message}`)
      chiusure++
      continue
    }
    const c = quotaPezzi(r.pezzi as Pezzo[], ev, ora, numero(r.quota_book))
    if (c.stato !== 'ok' || c.vecchia) continue   // quote ferme (servizio spento, PC in sospensione): meglio nessuna chiusura che una chiusura falsa
    const { error } = await sb.from('betfair_segnali_quote').update({ ch_tipo: c.tipo, ch_back: c.num.back, ch_lay: c.num.lay, ch_fair: c.num.fair, ch_il: iso(ora) }).eq('canale', r.canale).eq('msg_id', r.msg_id)
    if (error) throw new Error(`chiusura: ${error.message}`)
    chiusure++
  }
  return { ok: true, eventi: eventi.length, valutati: segnali.length, gia_congelati: gia.size, nuovi: nuove.length, chiusure, non_congelati: motivi }
}
