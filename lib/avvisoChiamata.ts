// 23/10/2026 · Funzioni pure per la telefonata di avviso Hunterbet (nessun accesso a rete o database: si testano da sole).
export const MAX_CHIAMATE_GIORNO = 5          // tetto di sicurezza: se qualcosa va storto non si brucia il credito
export const PAUSA_MINIMA_MIN = 4             // tra due chiamate al tuo numero devono passare almeno 4 minuti (protegge anche da due schede aperte)

const ENTITA: Record<string, string> = { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }
export const xmlEscape = (s: string) => s.replace(/[<>&"']/g, (c) => ENTITA[c] || c)

// Testo letto al telefono. partita = «Casa – Ospite», inizio = data ISO della partita (letta in ora italiana).
export function testoChiamata(partita: string, inizioIso: string | null): string {
  const pulita = String(partita || 'una partita').replace(/\s+[–—-]\s+/g, ' contro ').replace(/[^A-Za-zÀ-ÿ0-9\s'.,&-]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 90)
  let quando = ''
  if (inizioIso && Number.isFinite(new Date(inizioIso).getTime())) {
    const p = new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', hour: 'numeric', minute: '2-digit', hour12: false }).formatToParts(new Date(inizioIso))
    const h = p.find((x) => x.type === 'hour')?.value, m = p.find((x) => x.type === 'minute')?.value
    quando = h ? `, alle ${Number(h)}${m && m !== '00' ? ' e ' + Number(m) : ''}` : ''
  }
  return `Attenzione. Hai una bet Hunterbet da piazzare: ${pulita}${quando}. Apri il Profit Tracker.`
}

// chiamate già fatte verso il tuo numero (date_created in formato RFC 2822 di Twilio) → si può chiamare adesso?
export function puoChiamare(dateCreate: string[], adesso = Date.now()): { ok: true } | { ok: false; motivo: string } {
  const t = dateCreate.map((d) => new Date(d).getTime()).filter(Number.isFinite)
  const oggi = new Date(adesso).toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' })
  const dioggi = t.filter((x) => new Date(x).toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' }) === oggi)
  if (dioggi.length >= MAX_CHIAMATE_GIORNO) return { ok: false, motivo: `limite di ${MAX_CHIAMATE_GIORNO} chiamate al giorno raggiunto` }
  if (t.some((x) => adesso - x < PAUSA_MINIMA_MIN * 60000)) return { ok: false, motivo: 'chiamata già fatta da meno di ' + PAUSA_MINIMA_MIN + ' minuti' }
  return { ok: true }
}

export const twiml = (testo: string) => `<Response><Say language="it-IT" voice="alice">${xmlEscape(testo)}</Say><Pause length="1"/><Say language="it-IT" voice="alice">${xmlEscape(testo)}</Say></Response>`
