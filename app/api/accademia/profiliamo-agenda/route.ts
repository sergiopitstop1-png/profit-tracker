// 12/10/2026 · "Profiliamo alla guida": Lucy legge i messaggi recenti di Profiliamo e scrive, per ogni book dei clienti in profilazione,
// cosa fare oggi secondo Profiliamo; se si discosta in modo palese dal protocollo di Sergio lo segnala (campo "scostamento").
// Solo admin. POST { libri: [{ id, nome, variante, varianti: [{label, desc}], azioni }] }  ->  { voci: [{ id, book, variante, azione, scostamento, altraVariante, link, data }], messaggi, costo }
// Un libro = un book + la variante di protocollo del cliente (es. Goldbet · Casinò). Se Profiliamo parla di un'ALTRA variante (es. VIP Live) non è uno scostamento: lo dice in altraVariante.
// Costa pochi centesimi per chiamata (Haiku). Il client la fa al massimo una volta al giorno da solo; poi solo a richiesta.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { chiediAClaude } from '@/lib/accademiaRiassunto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
})

async function èAdmin(req: NextRequest) {
  const response = NextResponse.next()
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      get(name) { return req.cookies.get(name)?.value },
      set(name, value, options) { response.cookies.set({ name, value, ...options }) },
      remove(name, options) { response.cookies.set({ name, value: '', ...options }) },
    },
  })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return false
  const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', session.user.id).single()
  return profile?.role === 'admin'
}

const PAROLE = (process.env.ACCADEMIA_PROFILIAMO_PAROLE || 'profiliamo').split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
const TOPIC_MEMBRI = /domand|chiacchier|general|off.?topic/i                      // come nella sezione "Profiliamo oggi": nelle discussioni contano solo i messaggi dello staff
const STAFF = ['frioni', 'lentini', 'fotia', 'amurri', 'willy', 'accademia del profitto']
const MAX_PER_MESSAGGIO = 2500
const MAX_CARATTERI = 60000
const norm = (s: unknown) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 300)

type Variante = { label: string; desc: string }
type Libro = { id: string; nome: string; variante: string; varianti: Variante[]; azioni: string[] }
type Riga = { id: number; chat_titolo: string | null; topic_titolo: string | null; data_msg: string; mittente: string | null; testo: string | null; testo_immagine: string | null; link: string | null }

export async function POST(req: NextRequest) {
  if (!(await èAdmin(req))) return NextResponse.json({ error: 'Accesso riservato agli admin' }, { status: 403 })
  let corpo: { libri?: Libro[]; ore?: number } = {}
  try { corpo = await req.json() } catch { /* corpo vuoto */ }
  const libri = (Array.isArray(corpo.libri) ? corpo.libri : [])
    .map((l, i) => ({
      id: String(l?.id || `e${i + 1}`), nome: String(l?.nome || '').trim(), variante: String(l?.variante || '').trim().slice(0, 80),
      varianti: (Array.isArray(l?.varianti) ? l.varianti : []).map(v => ({ label: String(v?.label || '').slice(0, 60), desc: String(v?.desc || '').slice(0, 300) })).filter(v => v.label).slice(0, 6),
      azioni: (Array.isArray(l?.azioni) ? l.azioni : []).map(a => String(a).slice(0, 300)).slice(0, 8),
    }))
    .filter(l => l.nome).slice(0, 160)
  if (!libri.length) return NextResponse.json({ voci: [], messaggi: 0, costo: 0, nota: 'nessun conto in profilazione' })

  try {
    const ore = Math.min(72, Math.max(6, Number(corpo.ore) || 36))
    const da = new Date(Date.now() - ore * 3600 * 1000).toISOString()
    const { data, error } = await admin.from('accademia_messaggi')
      .select('id,chat_titolo,topic_titolo,data_msg,mittente,testo,testo_immagine,link')
      .gte('data_msg', da).order('data_msg', { ascending: true }).limit(800)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const righe = ((data || []) as Riga[]).filter(m => {
      const t = `${m.chat_titolo || ''} ${m.topic_titolo || ''}`.toLowerCase()
      if (!PAROLE.some(p => t.includes(p)) || !(m.testo || m.testo_immagine)) return false
      const staff = STAFF.some(n => String(m.mittente || '').toLowerCase().includes(n))
      return !TOPIC_MEMBRI.test(m.topic_titolo || '') || staff
    })
    if (!righe.length) return NextResponse.json({ voci: [], messaggi: 0, costo: 0, nota: 'nessun messaggio di Profiliamo nelle ultime ore' })

    // si tengono i più recenti fino al limite di testo, poi si rimettono in ordine di tempo
    let tot = 0
    const tenuti: Riga[] = []
    for (const m of [...righe].reverse()) {
      const l = Math.min(MAX_PER_MESSAGGIO, (m.testo || '').length) + Math.min(MAX_PER_MESSAGGIO, (m.testo_immagine || '').length) + 60
      if (tot + l > MAX_CARATTERI) continue
      tot += l; tenuti.push(m)
    }
    tenuti.reverse()
    const ora = (iso: string) => new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', weekday: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
    const testoMsg = tenuti.map((m, i) => {
      const corpoMsg = (m.testo || '').slice(0, MAX_PER_MESSAGGIO).replace(/\n{3,}/g, '\n\n')
      const img = m.testo_immagine ? `\n  IMMAGINE: ${m.testo_immagine.slice(0, MAX_PER_MESSAGGIO).replace(/\n{2,}/g, '\n')}` : ''
      return `#${i + 1} [${ora(m.data_msg)}] ${m.topic_titolo ? `(${m.topic_titolo}) ` : ''}${m.mittente || '?'}: ${corpoMsg}${img}`
    }).join('\n\n')
    const testoLibri = libri.map(l => `- [${l.id}] ${l.nome}${l.variante ? ` · il cliente segue la variante «${l.variante}»` : ''} · protocollo di Sergio oggi: ${l.azioni.length ? l.azioni.join(' / ') : 'nessuna azione in agenda'}${l.varianti.length > 1 ? `\n    varianti possibili di questo book: ${l.varianti.map(v => `«${v.label}» = ${v.desc}`).join(' | ')}` : ''}`).join('\n')

    const prompt = `Sei Lucy, assistente di Sergio (profilazione di conti di bookmaker e casinò italiani). Sotto trovi (1) i messaggi recenti del gruppo Profiliamo, che dà le indicazioni operative per profilare i conti, e (2) l'elenco dei book dei clienti di Sergio in profilazione, ciascuno con l'azione che il PROTOCOLLO di Sergio prevede oggi.

Per ogni book dell'elenco di cui Profiliamo dà indicazioni, scrivi cosa fare oggi secondo Profiliamo.

Regole:
- Usa SOLO ciò che è scritto nei messaggi: niente invenzioni. Importi, numero di bet, quota minima, giochi, scadenze vanno copiati esatti.
- Il book della scheda è quello dopo "Bookmaker:" o nel titolo del topic; un book dopo "COPERTURA" NON è il book della scheda (citalo solo come copertura dentro l'azione).
- Se Profiliamo non dà indicazioni per un book dell'elenco, NON includerlo. Se ci sono più messaggi sullo stesso book, vale il più recente; le istruzioni più vecchie ancora valide si possono riassumere.
- "id": l'identificativo tra parentesi quadre dell'elenco (es. "e3"). Se Profiliamo parla di un book con più righe nell'elenco (varianti diverse dei clienti), scrivi una voce per ogni riga. "azione": 1-3 frasi chiare e operative (cosa fare oggi). "msg": i numeri dei messaggi da cui viene.
- Alcuni book hanno più VARIANTI di protocollo (es. Goldbet: Casinò normale, VIP Live, VIP senza promo). Capisci di quale variante parla il messaggio di Profiliamo. Se parla di una variante DIVERSA da quella che il cliente segue, NON è uno scostamento: metti il nome esatto di quella variante in "altraVariante" e lascia "scostamento" vuoto. Se parla della stessa variante del cliente (o il book non ha varianti), "altraVariante" è "".
- "scostamento": stringa vuota "" se Profiliamo e protocollo sono compatibili, se parlano di varianti diverse, o se il protocollo non dice nulla di confrontabile. Scrivi un testo SOLO quando riguarda la STESSA variante e si discostano in modo palese (numero di bet o importo di ricarica diversi, tipo di gioco diverso, il protocollo prevede una cosa e Profiliamo dice di non farla): una frase con la differenza e i numeri, es. "Profiliamo: 5 bet e ricarica 50 €; il protocollo: 4 bet".
- "sport": SOLO se Profiliamo indica in modo ESPLICITO per oggi le bet sportive di questo book, scrivi {"n_bet":numero di bet,"importo_totale":importo totale in € da puntare oggi,"quota_min":quota minima}; ogni campo che non è scritto chiaramente va null (non calcolare e non dedurre). Se non indica bet sportive per oggi (es. solo casinò o solo ricarica), "sport" è null. Vale per la stessa variante del cliente; se parla di un'altra variante, "sport" è null.
- Rispondi SOLO con un array JSON, senza altro testo: [{"id":"","azione":"","scostamento":"","altraVariante":"","sport":null,"msg":[1]}]

LIBRI DEI CLIENTI:
${testoLibri}

MESSAGGI DI PROFILIAMO:
${testoMsg}`

    const r = await chiediAClaude(prompt, { senzaPensiero: true, maxTokens: 8000 })
    const a = r.testo.indexOf('['), b = r.testo.lastIndexOf(']')
    let grezzo: unknown[] = []
    try { grezzo = JSON.parse(r.testo.slice(a, b + 1)) } catch { return NextResponse.json({ error: 'Lucy ha risposto in un formato che non riesco a leggere, riprova' }, { status: 502 }) }
    const perId = new Map(libri.map(l => [l.id, l]))
    const voci: { id: string; book: string; variante: string; azione: string; scostamento: string; altraVariante: string; sport: { n_bet: number | null; importo_totale: number | null; quota_min: number | null } | null; link: string | null; data: string | null }[] = []
    for (const x of Array.isArray(grezzo) ? grezzo : []) {
      const o = (x || {}) as Record<string, unknown>
      const libro = perId.get(String(o.id || ''))
      const azione = String(o.azione || '').trim()
      if (!libro || !azione) continue
      // la variante nominata deve essere davvero una di quelle del book e diversa da quella del cliente
      const alt = libro.varianti.find(v => norm(v.label) === norm(o.altraVariante) && norm(v.label) !== norm(libro.variante))
      const scost = alt ? '' : String(o.scostamento || '').trim()
      const numeri = (Array.isArray(o.msg) ? o.msg : []).map(n => Number(n)).filter(n => n >= 1 && n <= tenuti.length)
      const m0 = numeri.length ? tenuti[Math.max(...numeri) - 1] : null
      // parametri sport: solo se espliciti e dentro limiti sensati (altrimenti si ignorano e vale il protocollo)
      const sp = (o.sport && typeof o.sport === 'object' ? o.sport : null) as Record<string, unknown> | null
      const num = (v: unknown, min: number, max: number) => { const n = Number(v); return v != null && v !== '' && Number.isFinite(n) && n >= min && n <= max ? n : null }
      const sport = !alt && sp ? { n_bet: (() => { const n = num(sp.n_bet, 1, 10); return n == null ? null : Math.round(n) })(), importo_totale: num(sp.importo_totale, 5, 1000), quota_min: num(sp.quota_min, 1.01, 3) } : null
      const sportValido = sport && (sport.n_bet != null || sport.importo_totale != null || sport.quota_min != null) ? sport : null
      voci.push({ id: libro.id, book: libro.nome, variante: libro.variante, azione, scostamento: scost, altraVariante: alt ? alt.label : '', sport: sportValido, link: m0?.link || null, data: m0?.data_msg || null })
    }
    return NextResponse.json({ voci, messaggi: tenuti.length, costo: r.costo })
  } catch (e) {
    return NextResponse.json({ error: msg(e) }, { status: 500 })
  }
}
