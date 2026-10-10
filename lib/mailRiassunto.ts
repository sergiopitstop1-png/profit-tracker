// 10/10/2026 · Riassunti di mail e SMS dei clienti (12:00 e 19:00 ora italiana).
// Le comunicazioni sono già classificate da Lucy (giudizio, categoria, bonus, scadenza...). Qui:
//   1) si leggono quelle arrivate nella fascia  2) si tengono problemi e opportunità  3) si RAGGRUPPANO per bookmaker/promo
//   (la stessa promo su 14 clienti diventa una riga sola)  4) Claude Haiku scrive il riassunto breve  5) si salva e (cron) si manda su Telegram.
// Se Claude non risponde, il riassunto viene scritto lo stesso con un formato fisso.
// Variabili: LUCY_ANTHROPIC_API_KEY, LUCY_TELEGRAM_BOT_TOKEN / LUCY_TELEGRAM_CHAT_ID (come per i riassunti dell'Accademia).
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { chiediAClaude, finestra, norm, telegramTesto, type Fascia } from '@/lib/accademiaRiassunto'

type Riga = {
  canale: 'EMAIL' | 'SMS'
  cliente: string | null; bookmaker: string | null; mittente: string | null; oggetto: string | null
  categoria: string | null; giudizio: string | null; priorita: string | null
  bonus: number | null; deposito: number | null; scadenza: string | null; condizioni: string | null; azione: boolean
}
type Gruppo = {
  tipo: 'problema' | 'opportunita' | 'accreditato'
  bookmaker: string; categoria: string; n: number; clienti: string[]; n_clienti: number
  bonus: number | null; deposito: number | null; scadenza: string | null; entro_24h: boolean
  priorita: string; condizioni: string; oggetto: string
}

const PROBLEMI = ['KYC', 'LIMITAZIONE', 'SOSPENSIONE', 'PRELIEVO', 'DEPOSITO', 'SICUREZZA', 'SCADENZA']
const PESO_PRIORITA: Record<string, number> = { alta: 3, media: 2, bassa: 1 }
const fmtScadenza = (iso: string) => new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
const etichetta = (ms: number) => new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', weekday: 'long', day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date(ms))
const dominio = (m: string | null) => (String(m || '').match(/@([a-z0-9.-]+\.[a-z]{2,})/i)?.[1] || String(m || '')).toLowerCase().slice(0, 40)
const taglia = (t: string | null, n: number) => String(t || '').replace(/\s+/g, ' ').trim().slice(0, n)

/* ---------- lettura ---------- */
async function leggi(sb: SupabaseClient, tabella: string, colonnaData: string, colonne: string, daIso: string, aIso: string) {
  const out: Record<string, unknown>[] = []
  for (let p = 0; p < 10; p++) {
    const { data, error } = await sb.from(tabella).select(colonne)
      .gte(colonnaData, daIso).lt(colonnaData, aIso)
      .order(colonnaData, { ascending: true }).order('id', { ascending: true })
      .range(p * 1000, p * 1000 + 999)
    if (error) throw new Error(`${tabella}: ${error.message}`)
    out.push(...((data || []) as unknown as Record<string, unknown>[]))
    if ((data || []).length < 1000) break
  }
  return out
}

/* ---------- raggruppamento ---------- */
function raggruppa(righe: Riga[], fineFascia: number) {
  const mappa = new Map<string, Gruppo & { _clienti: Set<string> }>()
  for (const r of righe) {
    const problema = r.giudizio === 'DA_VALUTARE' && r.azione && PROBLEMI.includes(r.categoria || '')
    const tipo: Gruppo['tipo'] | null = problema ? 'problema' : r.giudizio === 'UTILE' ? (r.azione ? 'opportunita' : 'accreditato') : null
    if (!tipo) continue
    const book = taglia(r.bookmaker, 40) || dominio(r.mittente) || 'bookmaker sconosciuto'
    const giornoScad = r.scadenza ? r.scadenza.slice(0, 10) : ''
    const chiave = [tipo, norm(book), r.categoria || '', r.bonus ?? '', giornoScad, tipo === 'problema' ? norm(taglia(r.oggetto, 40)) : ''].join('|')
    let g = mappa.get(chiave)
    if (!g) {
      g = {
        tipo, bookmaker: book, categoria: r.categoria || '', n: 0, clienti: [], n_clienti: 0, _clienti: new Set(),
        bonus: r.bonus, deposito: r.deposito, scadenza: r.scadenza, entro_24h: false,
        priorita: r.priorita || 'media', condizioni: taglia(r.condizioni, 160), oggetto: taglia(r.oggetto, 100),
      }
      mappa.set(chiave, g)
    }
    g.n++
    if (r.cliente) g._clienti.add(r.cliente)
    if (!g.condizioni && r.condizioni) g.condizioni = taglia(r.condizioni, 160)
    if ((PESO_PRIORITA[r.priorita || ''] || 0) > (PESO_PRIORITA[g.priorita] || 0)) g.priorita = r.priorita || g.priorita
    if (r.scadenza && (!g.scadenza || r.scadenza < g.scadenza)) g.scadenza = r.scadenza
  }
  const gruppi: Gruppo[] = [...mappa.values()].map(({ _clienti, ...g }) => {
    const nomi = [..._clienti]
    const ms = g.scadenza ? new Date(g.scadenza).getTime() : NaN
    return { ...g, clienti: nomi.slice(0, 40), n_clienti: nomi.length || g.n, entro_24h: Number.isFinite(ms) && ms >= fineFascia - 3600000 && ms <= fineFascia + 24 * 3600000 }
  })
  const ordTipo = { problema: 0, opportunita: 1, accreditato: 2 }
  gruppi.sort((a, b) =>
    ordTipo[a.tipo] - ordTipo[b.tipo] ||
    Number(b.entro_24h) - Number(a.entro_24h) ||
    (PESO_PRIORITA[b.priorita] || 0) - (PESO_PRIORITA[a.priorita] || 0) ||
    (b.bonus || 0) - (a.bonus || 0))
  return gruppi
}

const euro = (v: number | null) => (v == null ? '' : `${Number.isInteger(v) ? v : v.toFixed(2)}€`)
const quanti = (g: Gruppo) => {
  if (!g.clienti.length) return g.n_clienti > 1 ? `${g.n_clienti} clienti` : '1 cliente'
  const resto = g.n_clienti - 12
  return `Clienti: ${g.clienti.slice(0, 12).join(', ')}${resto > 0 ? ` e altri ${resto}` : ''}`
}

/** formato fisso, usato se Claude non risponde */
function testoDiBase(gruppi: Gruppo[]) {
  const sez = (titolo: string, tipo: Gruppo['tipo'], fn: (g: Gruppo) => string, max: number) => {
    const l = gruppi.filter(g => g.tipo === tipo).slice(0, max).map(fn)
    return l.length ? `## ${titolo}\n${l.join('\n')}` : ''
  }
  return [
    sez('🚨 Problemi sui conti', 'problema', g => `- ${g.bookmaker}: ${g.categoria.toLowerCase()}${g.oggetto ? ` (${g.oggetto})` : ''} · ${quanti(g)}`, 30),
    sez('🎯 Opportunità', 'opportunita', g => `- ${g.bookmaker}: ${g.condizioni || g.oggetto || g.categoria}${g.bonus ? ` · fino a ${euro(g.bonus)}` : ''}${g.scadenza ? ` · scade ${fmtScadenza(g.scadenza)}` : ''} · ${quanti(g)}`, 25),
    sez('✅ Già accreditati', 'accreditato', g => `- ${g.bookmaker}${g.bonus ? ` ${euro(g.bonus)}` : ''} · ${quanti(g)}`, 8),
  ].filter(Boolean).join('\n\n')
}

const promptMail = (da: number, a: number, gruppi: Gruppo[]) => `Sei Lucy, assistente di Sergio (matched betting e bonus dei bookmaker italiani; gestisce i conti di molti clienti). Sotto trovi le comunicazioni (mail e SMS) arrivate sui conti dei clienti tra ${etichetta(da)} e ${etichetta(a)} (ora italiana). Sono GIÀ classificate e raggruppate: la stessa promo ricevuta da più clienti è un solo gruppo. Prepara il riassunto per Sergio.

Regole:
- Usa solo i dati sotto, non inventare. Importi, percentuali e date vanno copiati esattamente (le scadenze sono già in ora italiana).
- "entro_24h: sì" significa scadenza urgente. "n_clienti" è su quanti clienti è arrivata.
- Per OGNI punto scrivi SEMPRE i nomi dei clienti (campo "clienti"), copiati esattamente e separati da virgola, in fondo alla riga dopo "Clienti:". Se sono più di 12 scrivi i primi 12 e poi "e altri N" (N = n_clienti - 12). Non scrivere solo il numero.
- Il testo deve essere BREVE: Sergio riceve centinaia di mail e vuole solo sapere cosa fare.

Formato (testo semplice; ogni punto su una riga che inizia con "- "; ometti le sezioni vuote):
## ⭐ Da non perdere
(massimo 5 righe: problemi gravi sui conti, opportunità con entro_24h sì o di valore alto. Quello che scrivi qui NON va ripetuto sotto.)
## 🚨 Problemi sui conti
(un punto per gruppo: bookmaker, cosa è successo · Clienti: nomi)
## 🎯 Opportunità
(un punto per bookmaker/promo, dalle più utili: "- Bookmaker: promo in breve, bonus fino a X€, deposito Y€ se richiesto, scade ... · Clienti: Nome1, Nome2". Massimo 15 punti. Unisci solo promo identiche dello stesso bookmaker, sommando i clienti.)
## ✅ Già accreditati
(poche righe, solo se ci sono: "- Bookmaker 10€ · Clienti: Nome1, Nome2")
Ogni punto è UNA frase breve (circa 25 parole). Non aggiungere altre sezioni, introduzioni o conclusioni.

GRUPPI (uno per riga, JSON):
${gruppi.map(g => JSON.stringify({ ...g, scadenza: g.scadenza ? fmtScadenza(g.scadenza) : null, entro_24h: g.entro_24h ? 'sì' : 'no', ...(g.clienti.length ? {} : { clienti: undefined }) })).join('\n')}`

/* ---------- tutto insieme ---------- */
export async function generaRiassuntoMail(opz: { giorno: string; fascia: Fascia; salva: boolean; telegram: boolean }) {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
  const { da, a } = finestra(opz.giorno, opz.fascia)
  const daIso = new Date(da).toISOString()
  const aIso = new Date(a).toISOString()

  const mail = await leggi(sb, 'lucy_mail_archive', 'data_mail', 'id,cliente_nome,bookmaker,mittente,oggetto,categoria,giudizio,priorita,bonus_importo,deposito_richiesto,scadenza,condizioni,richiede_azione', daIso, aIso)
  const sms = await leggi(sb, 'sms_clienti', 'data_ricezione', 'id,cliente,bookmaker,mittente,categoria,giudizio,priorita,bonus_importo,deposito_richiesto,scadenza,condizioni,richiede_azione,motivazione_ai', daIso, aIso)

  const righe: Riga[] = [
    ...mail.map((m): Riga => ({
      canale: 'EMAIL', cliente: (m.cliente_nome as string) || null, bookmaker: (m.bookmaker as string) || null, mittente: (m.mittente as string) || null, oggetto: (m.oggetto as string) || null,
      categoria: (m.categoria as string) || null, giudizio: (m.giudizio as string) || null, priorita: (m.priorita as string) || null,
      bonus: m.bonus_importo == null ? null : Number(m.bonus_importo), deposito: m.deposito_richiesto == null ? null : Number(m.deposito_richiesto),
      scadenza: (m.scadenza as string) || null, condizioni: (m.condizioni as string) || null, azione: m.richiede_azione === true,
    })),
    ...sms.map((m): Riga => ({
      canale: 'SMS', cliente: (m.cliente as string) || null, bookmaker: (m.bookmaker as string) || null, mittente: (m.mittente as string) || null, oggetto: taglia(m.motivazione_ai as string, 80) || 'SMS',
      categoria: (m.categoria as string) || null, giudizio: (m.giudizio as string) || null, priorita: (m.priorita as string) || null,
      bonus: m.bonus_importo == null ? null : Number(m.bonus_importo), deposito: m.deposito_richiesto == null ? null : Number(m.deposito_richiesto),
      scadenza: (m.scadenza as string) || null, condizioni: (m.condizioni as string) || null, azione: m.richiede_azione === true,
    })),
  ]

  const gruppi = raggruppa(righe, a)
  const importanti = gruppi.filter(g => g.tipo !== 'accreditato')
  const n_selezionati = righe.filter(r => (r.giudizio === 'UTILE' && r.azione) || (r.giudizio === 'DA_VALUTARE' && r.azione && PROBLEMI.includes(r.categoria || ''))).length
  const ignorate = righe.filter(r => r.giudizio === 'IGNORA').length
  const daAnalizzare = righe.filter(r => !r.giudizio || r.giudizio === 'DA_ANALIZZARE').length
  const altre = righe.length - ignorate - daAnalizzare - gruppi.reduce((s, g) => s + g.n, 0)

  let corpo = 'Niente di rilevante in questa fascia.'
  let costo = 0
  let nota = ''
  if (gruppi.length) {
    try {
      const r = await chiediAClaude(promptMail(da, a, gruppi.slice(0, 150)))
      corpo = r.testo
      costo = r.costo
    } catch (e) {
      corpo = testoDiBase(gruppi)
      nota = ` (formato semplice: ${(e instanceof Error ? e.message : String(e)).slice(0, 120)})`
    }
  }
  const numeri = `## 📊 In numeri\n- ${righe.length} comunicazioni ricevute: ${importanti.length ? `${n_selezionati} importanti in ${importanti.length} gruppi` : 'nessuna importante'}, ${ignorate} ignorate${altre > 0 ? `, ${altre} informative senza azione` : ''}${daAnalizzare ? `, ${daAnalizzare} ancora da analizzare` : ''}${nota}`
  const testo = `${corpo}\n\n${numeri}`

  const riga = { giorno: opz.giorno, fascia: opz.fascia, da: daIso, a: aIso, testo, n_messaggi: righe.length, n_selezionati, costo_usd: costo }
  let inviato = false
  let telegram: { ok: boolean; motivo: string } | null = null
  if (opz.telegram && importanti.length) {
    const intesta = `✉️ Riassunto mail e SMS · ${new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', day: '2-digit', month: 'short' }).format(new Date(`${opz.giorno}T12:00:00Z`))} · ore ${opz.fascia}:00`
    telegram = await telegramTesto(`${intesta}\n\n${testo.replace(/^## /gm, '▸ ')}`)
    inviato = telegram.ok
  }
  if (opz.salva) {
    const { error } = await sb.from('mail_riassunti').upsert({ ...riga, inviato_telegram: inviato }, { onConflict: 'giorno,fascia' })
    if (error) throw new Error(`salvataggio: ${error.message}`)
  }
  return { ...riga, gruppi: gruppi.length, inviato_telegram: inviato, telegram }
}
