// 12/10/2026 · "Profiliamo alla guida": Lucy legge i messaggi recenti di Profiliamo e scrive, per ogni book dei clienti in profilazione,
// cosa fare oggi secondo Profiliamo; se si discosta in modo palese dal protocollo di Sergio lo segnala (campo "scostamento").
// Solo admin. POST { libri: [{ nome, azioni: string[] }] }  ->  { voci: [{ book, azione, scostamento, link, data }], messaggi, costo }
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

type Libro = { nome: string; azioni: string[] }
type Riga = { id: number; chat_titolo: string | null; topic_titolo: string | null; data_msg: string; mittente: string | null; testo: string | null; testo_immagine: string | null; link: string | null }

export async function POST(req: NextRequest) {
  if (!(await èAdmin(req))) return NextResponse.json({ error: 'Accesso riservato agli admin' }, { status: 403 })
  let corpo: { libri?: Libro[]; ore?: number } = {}
  try { corpo = await req.json() } catch { /* corpo vuoto */ }
  const libri = (Array.isArray(corpo.libri) ? corpo.libri : [])
    .map(l => ({ nome: String(l?.nome || '').trim(), azioni: (Array.isArray(l?.azioni) ? l.azioni : []).map(a => String(a).slice(0, 300)).slice(0, 8) }))
    .filter(l => l.nome).slice(0, 120)
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
    const testoLibri = libri.map(l => `- ${l.nome} · protocollo di Sergio oggi: ${l.azioni.length ? l.azioni.join(' / ') : 'nessuna azione in agenda'}`).join('\n')

    const prompt = `Sei Lucy, assistente di Sergio (profilazione di conti di bookmaker e casinò italiani). Sotto trovi (1) i messaggi recenti del gruppo Profiliamo, che dà le indicazioni operative per profilare i conti, e (2) l'elenco dei book dei clienti di Sergio in profilazione, ciascuno con l'azione che il PROTOCOLLO di Sergio prevede oggi.

Per ogni book dell'elenco di cui Profiliamo dà indicazioni, scrivi cosa fare oggi secondo Profiliamo.

Regole:
- Usa SOLO ciò che è scritto nei messaggi: niente invenzioni. Importi, numero di bet, quota minima, giochi, scadenze vanno copiati esatti.
- Il book della scheda è quello dopo "Bookmaker:" o nel titolo del topic; un book dopo "COPERTURA" NON è il book della scheda (citalo solo come copertura dentro l'azione).
- Se Profiliamo non dà indicazioni per un book dell'elenco, NON includerlo. Se ci sono più messaggi sullo stesso book, vale il più recente; le istruzioni più vecchie ancora valide si possono riassumere.
- "book": il nome ESATTO come nell'elenco. "azione": 1-3 frasi chiare e operative (cosa fare oggi). "msg": i numeri dei messaggi da cui viene.
- "scostamento": stringa vuota "" se Profiliamo e protocollo sono compatibili o se il protocollo non dice nulla di confrontabile. Scrivi un testo SOLO se si discostano in modo palese (numero di bet o importo di ricarica diversi, tipo di gioco diverso, il protocollo prevede una cosa e Profiliamo dice di non farla): una frase con la differenza e i numeri, es. "Profiliamo: 5 bet e ricarica 50 €; il protocollo: 4 bet".
- Rispondi SOLO con un array JSON, senza altro testo: [{"book":"","azione":"","scostamento":"","msg":[1]}]

LIBRI DEI CLIENTI:
${testoLibri}

MESSAGGI DI PROFILIAMO:
${testoMsg}`

    const r = await chiediAClaude(prompt, { senzaPensiero: true, maxTokens: 8000 })
    const a = r.testo.indexOf('['), b = r.testo.lastIndexOf(']')
    let grezzo: unknown[] = []
    try { grezzo = JSON.parse(r.testo.slice(a, b + 1)) } catch { return NextResponse.json({ error: 'Lucy ha risposto in un formato che non riesco a leggere, riprova' }, { status: 502 }) }
    const perNome = new Map(libri.map(l => [norm(l.nome), l.nome]))
    const voci: { book: string; azione: string; scostamento: string; link: string | null; data: string | null }[] = []
    for (const x of Array.isArray(grezzo) ? grezzo : []) {
      const o = (x || {}) as Record<string, unknown>
      const nome = perNome.get(norm(o.book))
      const azione = String(o.azione || '').trim()
      if (!nome || !azione) continue
      const numeri = (Array.isArray(o.msg) ? o.msg : []).map(n => Number(n)).filter(n => n >= 1 && n <= tenuti.length)
      const m0 = numeri.length ? tenuti[Math.max(...numeri) - 1] : null
      voci.push({ book: nome, azione, scostamento: String(o.scostamento || '').trim(), link: m0?.link || null, data: m0?.data_msg || null })
    }
    return NextResponse.json({ voci, messaggi: tenuti.length, costo: r.costo })
  } catch (e) {
    return NextResponse.json({ error: msg(e) }, { status: 500 })
  }
}
