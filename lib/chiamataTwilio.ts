// 13/11/2026 · Telefonata Twilio verso il TUO numero, usabile dai cron (senza sessione utente).
// Stesse variabili e stesse protezioni della chiamata Hunterbet: max 10 chiamate al giorno, almeno 4 minuti tra una e l'altra (controllati su Twilio).
import { puoChiamare } from './avvisoChiamata'

export type EsitoChiamata = { ok: true; sid?: string } | { ok: false; motivo: string; saltata?: boolean }

export async function chiamaMioNumero(twimlXml: string): Promise<EsitoChiamata> {
  const sid = process.env.TWILIO_ACCOUNT_SID, token = process.env.TWILIO_AUTH_TOKEN, da = process.env.TWILIO_NUMERO, a = process.env.MIO_NUMERO
  if (!sid || !token || !da || !a) return { ok: false, motivo: 'telefonata non configurata (mancano le chiavi Twilio)' }
  const auth = 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64')
  const base = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Calls.json`
  const ieri = new Date(Date.now() - 36 * 3600000).toISOString().slice(0, 10)
  const q = new URLSearchParams({ To: a, From: da, PageSize: '50' }); q.set('StartTime>', ieri)
  const lista = await fetch(`${base}?${q}`, { headers: { Authorization: auth } })
  if (!lista.ok) return { ok: false, motivo: 'Twilio non risponde (' + lista.status + ')' }
  const dati = (await lista.json()) as { calls?: { date_created: string }[] }
  const via = puoChiamare((dati?.calls || []).map((x) => x.date_created))
  if (!via.ok) return { ok: false, motivo: via.motivo, saltata: true }
  const r = await fetch(base, {
    method: 'POST',
    headers: { Authorization: auth, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ To: a, From: da, Twiml: twimlXml }),
  })
  const j = (await r.json().catch(() => ({}))) as { sid?: string; message?: string }
  if (!r.ok) return { ok: false, motivo: 'Twilio: ' + (j?.message || r.status) }
  return { ok: true, sid: j?.sid }
}
