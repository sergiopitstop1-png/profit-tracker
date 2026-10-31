/* eslint-disable @typescript-eslint/no-explicit-any */
// ═════════════════════════════════════════════════════════════════
// lib/lucyLettura.ts — strumenti di LETTURA (sola lettura) del Profit Tracker per Lucy (15/10/2026)
// Usati da /api/lucy-chat (Lucy su Vercel, con Claude) e da /api/lucy-locale (Lucy sul PC, con Ollama).
// Le regole di sicurezza (tabelle escluse, colonne segrete nascoste, niente OTP, link e codici oscurati) valgono per entrambe.
// ═════════════════════════════════════════════════════════════════

// 15/10/2026 — MAIL E SMS: strumento di ricerca in SOLA LETTURA sull'archivio (lucy_mail_archive + sms_clienti).
// Niente OTP, niente link (possono contenere accessi), codici nascosti. Le comunicazioni uguali arrivate a più clienti sono raggruppate.
export const STRUMENTI = [{
  name: 'cerca_comunicazioni',
  description: 'Cerca nelle email e negli SMS archiviati dal Profit Tracker (sola lettura). Usalo ogni volta che Sergio chiede di mail, SMS, promo ricevute o di un bookmaker o cliente specifico. Restituisce le comunicazioni più recenti che corrispondono, con testo e analisi.',
  input_schema: {
    type: 'object',
    properties: {
      parola: { type: 'string', description: 'UNA parola da cercare in mittente, oggetto, bookmaker e testo (es. "domusbet").' },
      cliente: { type: 'string', description: 'Parte del nome del cliente (es. "Federica").' },
      giudizio: { type: 'string', enum: ['UTILE', 'DA_VALUTARE', 'IGNORA'], description: 'UTILE = opportunità economica; DA_VALUTARE = da guardare; IGNORA = scartate.' },
      giorni: { type: 'integer', description: 'Quanti giorni indietro cercare (default 30, massimo 90).' },
    },
  },
}, {
  name: 'elenco_tabelle',
  description: 'Elenca le tabelle del Profit Tracker che puoi leggere (sola lettura), con una breve descrizione. Usalo quando non sai in quale tabella sono i dati che servono.',
  input_schema: { type: 'object', properties: {} },
}, {
  name: 'leggi_tabella',
  description: 'Legge righe da una tabella del Profit Tracker (sola lettura). Se non conosci le colonne chiama con limite 1: ti restituisce i nomi delle colonne. Per contare righe usa solo_conteggio. Non inventare nomi di colonne.',
  input_schema: {
    type: 'object',
    properties: {
      tabella: { type: 'string', description: 'Nome della tabella (vedi elenco_tabelle).' },
      colonne: { type: 'array', items: { type: 'string' }, description: 'Colonne da leggere (facoltativo; se manca le legge tutte).' },
      filtri: {
        type: 'array',
        description: 'Filtri (massimo 8), tutti in AND.',
        items: {
          type: 'object',
          properties: {
            colonna: { type: 'string' },
            op: { type: 'string', enum: ['eq', 'neq', 'contiene', 'gte', 'lte', 'gt', 'lt', 'vuoto', 'non_vuoto'] },
            valore: { type: 'string', description: 'Il valore (sempre come testo, per i vuoti si omette).' },
          },
          required: ['colonna', 'op'],
        },
      },
      ordina_per: { type: 'string', description: 'Colonna per ordinare (facoltativo).' },
      decrescente: { type: 'boolean', description: 'true = dal più grande/recente.' },
      limite: { type: 'integer', description: 'Quante righe (default 20, massimo 50).' },
      solo_conteggio: { type: 'boolean', description: 'true = restituisce solo quante righe corrispondono ai filtri.' },
    },
    required: ['tabella'],
  },
}]

// 15/10/2026 — LETTURA DI TUTTO IL PROFIT (sola lettura). Restano FUORI le tabelle con password, chiavi, token o utenti:
// credenziali (password dei book e risposte segrete), lucy_gmail_connection (token Gmail), user_profiles,
// pronox_plans (iscritti) e le tabelle di cache/immagini. In più qualunque colonna con nome da segreto è nascosta.
export const TABELLE: Record<string, string> = {
  books: 'conti bookmaker dei clienti (nome book, intestatario, saldo, stato)',
  clienti: 'elenco clienti',
  clienti_email: 'indirizzi email collegati ai clienti',
  transactions: 'movimenti / transazioni',
  promo_bonus: 'promo e bonus',
  matrice_bookmakers: 'matrice dei bookmaker',
  avvisi_conti: 'avvisi sui conti (ancora aperti o chiusi)',
  oggi_da_fare_stato: 'stato delle voci di Oggi da fare (fatte, rimandate)',
  lucy_bet_attese: 'bet attese di Lucy',
  lucy_bet_confermate: 'bet confermate di Lucy (colonna rec = dati della bet)',
  lucy_decisioni: 'bet saltate o rimandate',
  lucy_proposte_giorno: 'proposte di Lucy del giorno',
  lucy_storico_giornate: 'storico delle giornate di Lucy',
  regole_mantenimento: 'regole di mantenimento dei conti',
  profilazione_operazioni: 'operazioni di profilazione',
  profilazione_pause: 'pause della profilazione',
  profilazioni_mirate: 'gruppi di profilazione mirata',
  profilazioni_mirate_fatte: 'profilazioni mirate già fatte',
  recupero_conti: 'conti in recupero',
  recupero_bets: 'bet di recupero',
  recupero_piano: 'piano di recupero',
  recupero_esiti: 'esiti del recupero',
  masaniello_plans: 'piani Masaniello',
  masaniello_events: 'partite/eventi del Masaniello',
  book_attivita: 'attività dei telefoni sui book (host, data, ultimo_visto)',
  saldo_jobs: 'lavori di lettura saldi',
  comandi_telefoni: 'comandi inviati ai telefoni della farm',
  promozioni_clienti: 'promozioni per cliente',
  risultati_promo: 'risultati delle promo',
  slot_consigliate: 'slot consigliate',
  punti_monete: 'punti e monete',
  accademia_messaggi: 'messaggi dei gruppi Telegram dell\'Accademia',
  accademia_consigli: 'consigli raccolti dall\'Accademia',
  accademia_consigli_stato: 'stato dei consigli Accademia',
  accademia_dirette: 'dirette dell\'Accademia',
  accademia_riassunti: 'riassunti dell\'Accademia',
  mail_riassunti: 'riassunti di mail e SMS',
  sms_clienti: 'SMS dei clienti (gli OTP si leggono meglio con cerca_comunicazioni)',
  lucy_mail_archive: 'archivio email (meglio usare cerca_comunicazioni)',
  gmail_sync_log: 'registro della sincronizzazione Gmail',
  scoretrend_segnali: 'segnali ScoreTrend',
  hunterbet_segnali: 'segnali Hunterbet',
  pronox_tennis_segnali: 'segnali PronoX tennis',
  pronox_daily_picks: 'pronostici giornalieri PronoX',
  pronox_archive: 'archivio PronoX',
  pronox_bets: 'bet PronoX',
  pronox_segnali: 'segnali PronoX',
  pronox_risultati: 'risultati PronoX',
  pronox_lucy_signals: 'segnali PronoX per Lucy',
  pronox_news_signals: 'segnali da notizie PronoX',
  selection_outcomes: 'esiti delle selezioni',
  risparmi_movimenti: 'movimenti del conto risparmi',
  risparmi_tassi: 'tassi del conto risparmi',
  wallets: 'wallet (PayPal, Skrill ecc.)',
  stime_cassa: 'stime di cassa',
  contabilita: 'contabilità',
  movimentazioni: 'movimentazioni',
  collaboratori: 'collaboratori',
  royalty_accordi: 'accordi royalty',
  royalty_pagamenti: 'pagamenti royalty',
  calendario_aperture_eccezioni: 'calendario aperture: eccezioni',
  calendario_aperture_regole: 'calendario aperture: regole',
  calendario_aperture_piano: 'calendario aperture: piano',
  note_ai: 'note AI',
  note_storico: 'storico delle note',
  post_it_notes: 'post-it',
  memo_future_notes: 'memo e note future',
  weekly_snapshots: 'istantanee settimanali',
  monthly_snapshots: 'istantanee mensili',
  dashboard_settings: 'impostazioni della Dashboard',
  live_sessioni: 'sessioni live',
}
const COLONNA_VIETATA = /(passw|pwd|token|secret|segret|api_?key|refresh|iban|cvv|seed|private|cookie|otp|codice_fiscale|(^|_)pin($|_))/i
const colonnaOk = (c: any) => /^[a-z][a-z0-9_]{0,60}$/.test(String(c ?? '')) && !COLONNA_VIETATA.test(String(c))

const termine = (v: any) => String(v ?? '').replace(/[,()%*\\"':;]/g, '').trim().slice(0, 40)
const pulisci = (v: any, n: number) => String(v ?? '')
  .replace(/https?:\/\/\S+/gi, '[link]')
  .replace(/(codice|code|otp|pin|password|verifica)([^\d]{0,25})(\d{4,8})/gi, '$1$2[nascosto]')
  .replace(/\s+/g, ' ').trim().slice(0, n)

export async function cercaComunicazioni(sb: any, inp: any): Promise<string> {
  const parola = termine(inp?.parola)
  const cliente = termine(inp?.cliente)
  const giud = ['UTILE', 'DA_VALUTARE', 'IGNORA'].includes(inp?.giudizio) ? inp.giudizio : ''
  if (!parola && !cliente && !giud) return 'Indica almeno una parola, un cliente o un giudizio da cercare.'
  const giorni = Math.min(90, Math.max(1, Math.round(Number(inp?.giorni)) || 30))
  const da = new Date(Date.now() - giorni * 86400000).toISOString()
  const righe: any[] = []
  const note: string[] = []

  // EMAIL
  {
    let q = sb.from('lucy_mail_archive').select('*').gte('data_mail', da).order('data_mail', { ascending: false }).limit(60)
    if (parola) q = q.or(`oggetto.ilike.%${parola}%,mittente.ilike.%${parola}%,bookmaker.ilike.%${parola}%,testo_completo.ilike.%${parola}%`)
    if (cliente) q = q.ilike('cliente_nome', `%${cliente}%`)
    if (giud) q = q.eq('giudizio', giud)
    const { data, error } = await q
    if (error) note.push('email non leggibili')
    else for (const r of data || []) righe.push({ canale: 'EMAIL', data: r.data_mail, cliente: r.cliente_nome, book: r.bookmaker, da: r.mittente, oggetto: r.oggetto, testo: r.testo_completo, giudizio: r.giudizio, categoria: r.categoria, bonus: r.bonus_importo, scadenza: r.scadenza, nota: r.motivazione_ai })
  }
  // SMS (gli OTP si escludono sempre)
  {
    const costruisci = (conBook: boolean) => {
      let q = sb.from('sms_clienti').select('*').gte('data_ricezione', da).order('data_ricezione', { ascending: false }).limit(60)
      if (parola) q = q.or(`testo.ilike.%${parola}%,mittente.ilike.%${parola}%${conBook ? `,bookmaker.ilike.%${parola}%` : ''}`)
      if (cliente) q = q.ilike('cliente', `%${cliente}%`)
      if (giud) q = q.eq('giudizio', giud)
      return q
    }
    let { data, error } = await costruisci(true)
    if (error) ({ data, error } = await costruisci(false))
    if (error) note.push('SMS non leggibili')
    else for (const r of data || []) {
      if (String(r.tipo || '').toUpperCase() === 'OTP') continue
      righe.push({ canale: 'SMS', data: r.data_ricezione, cliente: r.cliente, book: r.bookmaker, da: r.mittente, oggetto: '', testo: r.testo, giudizio: r.giudizio, categoria: r.categoria, bonus: r.bonus_importo, scadenza: r.scadenza, nota: r.motivazione_ai })
    }
  }

  righe.sort((a, b) => String(b.data).localeCompare(String(a.data)))
  const gruppi = new Map<string, any>()
  for (const r of righe) {
    const chiave = `${r.canale}|${String(r.da || '').toLowerCase()}|${String(r.oggetto || r.testo || '').toLowerCase().replace(/\d+/g, '#').replace(/\s+/g, ' ').slice(0, 80)}`
    const g = gruppi.get(chiave)
    if (g) { g.n++; if (r.cliente && !g.clienti.includes(r.cliente)) g.clienti.push(r.cliente) }
    else gruppi.set(chiave, { ...r, n: 1, clienti: r.cliente ? [r.cliente] : [] })
  }
  const tutti = [...gruppi.values()]
  const cercato = [parola && `parola "${parola}"`, cliente && `cliente "${cliente}"`, giud && `giudizio ${giud}`].filter(Boolean).join(', ')
  const nota = note.length ? ` (${note.join(', ')})` : ''
  if (!tutti.length) return `Nessuna comunicazione trovata negli ultimi ${giorni} giorni (${cercato})${nota}.`
  const righeOut = tutti.slice(0, 10).map((g: any) =>
    `- [${g.canale}] ${String(g.data || '').slice(0, 10)} · ${pulisci(g.book, 30) || '?'} · da ${pulisci(g.da, 40) || '?'}${g.oggetto ? ` · "${pulisci(g.oggetto, 80)}"` : ''} · ${g.giudizio || '?'}/${g.categoria || '?'}${g.bonus ? ` · bonus ${g.bonus}€` : ''}${g.scadenza ? ` · scade ${String(g.scadenza).slice(0, 10)}` : ''} · ${g.n > 1 ? `arrivata ${g.n} volte a: ${g.clienti.slice(0, 6).join(', ')}${g.clienti.length > 6 ? '…' : ''}` : `cliente ${g.cliente || '?'}`}\n  testo: ${pulisci(g.testo, 500)}${g.nota ? `\n  analisi: ${pulisci(g.nota, 200)}` : ''}`)
  return `Trovate ${righe.length} comunicazioni (${tutti.length} diverse) negli ultimi ${giorni} giorni (${cercato})${nota}. Le ${Math.min(10, tutti.length)} più recenti:\n${righeOut.join('\n')}`
}

export function elencoTabelle(): string {
  return Object.entries(TABELLE).map(([n, d]) => `- ${n}: ${d}`).join('\n') + '\n(Password, chiavi, token e utenti non sono leggibili.)'
}

export async function leggiTabella(sb: any, inp: any, maxChars = 14000): Promise<string> {
  const t = String(inp?.tabella ?? '').trim()
  if (!TABELLE[t]) return `La tabella "${t}" non è leggibile o non esiste. Usa elenco_tabelle (password, chiavi e utenti sono riservati).`
  const solo = inp?.solo_conteggio === true
  const limite = Math.min(50, Math.max(1, Math.round(Number(inp?.limite)) || 20))
  const colonne: string[] = Array.isArray(inp?.colonne) ? inp.colonne.filter(colonnaOk).slice(0, 25) : []
  let q: any = solo ? sb.from(t).select('*', { count: 'exact', head: true }) : sb.from(t).select(colonne.length ? colonne.join(',') : '*')
  if (t === 'sms_clienti') q = q.or('tipo.is.null,tipo.neq.OTP')   // gli SMS con codici OTP non si leggono mai
  const filtri: any[] = Array.isArray(inp?.filtri) ? inp.filtri.slice(0, 8) : []
  for (const f of filtri) {
    const c = String(f?.colonna ?? '')
    if (!colonnaOk(c)) return `Colonna non valida o riservata: "${c}".`
    const v = String(f?.valore ?? '')
    switch (f?.op) {
      case 'eq': q = q.eq(c, v); break
      case 'neq': q = q.neq(c, v); break
      case 'contiene': q = q.ilike(c, `%${termine(v)}%`); break
      case 'gte': q = q.gte(c, v); break
      case 'lte': q = q.lte(c, v); break
      case 'gt': q = q.gt(c, v); break
      case 'lt': q = q.lt(c, v); break
      case 'vuoto': q = q.is(c, null); break
      case 'non_vuoto': q = q.not(c, 'is', null); break
      default: return `Operatore non valido: "${f?.op}".`
    }
  }
  if (solo) {
    const { count, error } = await q
    return error ? `Errore: ${String(error.message).slice(0, 200)}` : `Righe che corrispondono: ${count ?? 0}`
  }
  const ord = String(inp?.ordina_per ?? '')
  if (ord) {
    if (!colonnaOk(ord)) return `Colonna di ordinamento non valida o riservata: "${ord}".`
    q = q.order(ord, { ascending: inp?.decrescente !== true })
  }
  const { data, error } = await q.limit(limite)
  if (error) return `Errore: ${String(error.message).slice(0, 200)}`
  const righe: any[] = (data || []).filter((r: any) => !(t === 'sms_clienti' && String(r?.tipo || '').toUpperCase() === 'OTP'))
  if (!righe.length) return 'Nessuna riga.'
  const pulita = (r: any) => {
    const o: Record<string, any> = {}
    for (const [k, v] of Object.entries(r || {})) {
      if (COLONNA_VIETATA.test(k) || v === null || v === undefined || v === '') continue
      o[k] = typeof v === 'string' ? pulisci(v, 200) : typeof v === 'object' ? pulisci(JSON.stringify(v), 300) : v
    }
    return o
  }
  const colonneTrovate = Object.keys(righe[0] || {}).filter(k => !COLONNA_VIETATA.test(k))
  let out = `Colonne: ${colonneTrovate.join(', ')}\nRighe (${righe.length}${righe.length === limite ? ', potrebbero essercene altre' : ''}):\n`
  for (const r of righe) {
    const riga = JSON.stringify(pulita(r)) + '\n'
    if (out.length + riga.length > maxChars) { out += '(risultato troncato: restringi i filtri o chiedi meno colonne)'; break }
    out += riga
  }
  return out
}

// esegue uno strumento di lettura per nome (usato dalle due route)
export async function eseguiStrumento(sb: any, nome: string, input: any, maxChars = 14000): Promise<string> {
  try {
    if (nome === 'cerca_comunicazioni') return (await cercaComunicazioni(sb, input)).slice(0, maxChars)
    if (nome === 'elenco_tabelle') return elencoTabelle()
    if (nome === 'leggi_tabella') return await leggiTabella(sb, input, maxChars)
    return 'Strumento sconosciuto.'
  } catch {
    return 'Lettura non riuscita.'
  }
}
