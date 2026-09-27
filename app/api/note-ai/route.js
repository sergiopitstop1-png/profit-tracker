// app/api/note-ai/route.js
// ════════════════════════════════════════════════════════════════════
// Interpretazione di UNA nota di un book con Claude Haiku 4.5 (27/09/2026).
// Chiamata dal Profit Tracker solo quando una nota è nuova o è cambiata (vedi AvvisiConti.jsx, tabella note_ai).
// Protetta: risponde solo a un utente loggato (token Supabase nell'header Authorization).
// Costo indicativo: circa 0,15 centesimi di dollaro a nota.
// ════════════════════════════════════════════════════════════════════
const MODELLO = 'claude-haiku-4-5-20251001'

const PAROLE = ['limitato bonus', 'limitato sport', 'sentire assistenza', 'chiudere e riaprire', 'inviare documento', 'riconoscimento live']

const SYSTEM = `Sei l'assistente del Profit Tracker di Sergio, che gestisce centinaia di conti su bookmaker italiani intestati a clienti.
Ogni conto ha una NOTA scritta a mano da Sergio o dai collaboratori. Il tuo compito: leggere UNA nota e dire cosa significa e se serve un promemoria.

Parole chiave già gestite dal sistema (NON creare promemoria per queste, sono già automatiche): ${PAROLE.join(', ')}.
Analizza solo il testo IN PIÙ rispetto alle parole chiave.

Regole per i promemoria ("avvisi"):
- Solo se la nota implica qualcosa da FARE o da VERIFICARE. Massimo 3 avvisi.
- Titolo breve, all'imperativo, in italiano (es. "Verifica se il conto è stato sbloccato").
- Data in formato AAAA-MM-GG. Le date senza anno sono dell'anno in corso, o dell'anno precedente se risulterebbero nel futuro.
- Se la nota dice che una richiesta è stata fatta ("chiesto sblocco 12/9", "inviata mail il 3/10"): verifica 7 giorni dopo quella data; se quella data è già passata, usa la data di oggi.
- Se la nota dice di fare qualcosa senza data ("verificare se limitato", "chiudere e chiedere bonifico"): data di oggi.
- Se la nota indica una scadenza futura ("aggiornare a fine campionato 27/1/27"): avviso in quella data.

Proponi "parola_chiave" (una delle parole chiave, identica) solo se la nota descrive chiaramente quella situazione con altre parole
(es. "prelievi bloccati", "impossibile versare" → "sentire assistenza"; "da verificare con videochiamata" → "riconoscimento live"). Altrimenti null.

"informazione": se la nota contiene un'informazione stabile sul conto da NON perdere (es. "conto chiuso dal book", "bonifico domiciliato",
"doppione di un altro conto", "lo usa il cliente, non usare per bonus", "conto personale"), riscrivila in breve; altrimenti null.

Rispondi SOLO con JSON valido, senza testo prima o dopo, con questa forma esatta:
{"sintesi":"una frase su cosa dice la nota","avvisi":[{"titolo":"...","data":"AAAA-MM-GG"}],"parola_chiave":null,"informazione":null}`

async function utenteLoggato(req) {
  const auth = req.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
  if (!token || !url || !anon) return null
  const r = await fetch(`${url}/auth/v1/user`, { headers: { apikey: anon, Authorization: `Bearer ${token}` } })
  if (!r.ok) return null
  const u = await r.json()
  return u?.id ? u : null
}

export async function POST(req) {
  const utente = await utenteLoggato(req)
  if (!utente) return Response.json({ error: 'non autorizzato' }, { status: 401 })

  let body
  try { body = await req.json() } catch { return Response.json({ error: 'richiesta non valida' }, { status: 400 }) }
  const nota = String(body?.nota || '').slice(0, 1500)
  const oggi = /^\d{4}-\d{2}-\d{2}$/.test(body?.oggi || '') ? body.oggi : new Date().toISOString().slice(0, 10)
  if (!nota.trim()) return Response.json({ error: 'nota vuota' }, { status: 400 })

  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: MODELLO,
      max_tokens: 500,
      system: SYSTEM,
      messages: [{ role: 'user', content: `Oggi è ${oggi}.\nBook: ${String(body?.nome || '').slice(0, 80)}\nIntestatario: ${String(body?.intestatario || '').slice(0, 80)}\nNota: """${nota}"""` }]
    })
  })
  const data = await r.json()
  if (!r.ok) return Response.json({ error: data?.error?.message || 'errore Claude API' }, { status: 502 })

  const testo = (data.content || []).filter(c => c.type === 'text').map(c => c.text).join('').replace(/```json|```/g, '').trim()
  let out
  try { out = JSON.parse(testo.slice(testo.indexOf('{'), testo.lastIndexOf('}') + 1)) } catch { return Response.json({ error: 'risposta non leggibile', grezzo: testo.slice(0, 300) }, { status: 502 }) }

  // ripulitura: niente campi strani, date valide, parola chiave solo tra quelle ammesse
  const avvisi = (Array.isArray(out.avvisi) ? out.avvisi : []).slice(0, 3)
    .map(a => ({ titolo: String(a?.titolo || '').slice(0, 160), data: /^\d{4}-\d{2}-\d{2}$/.test(a?.data || '') ? (a.data < oggi ? oggi : a.data) : oggi }))
    .filter(a => a.titolo)
  const pk = PAROLE.includes(String(out.parola_chiave || '').toLowerCase()) ? String(out.parola_chiave).toLowerCase() : null
  return Response.json({
    sintesi: String(out.sintesi || '').slice(0, 300),
    avvisi,
    parola_chiave: pk,
    informazione: out.informazione ? String(out.informazione).slice(0, 200) : null,
    uso: data.usage || null
  })
}
