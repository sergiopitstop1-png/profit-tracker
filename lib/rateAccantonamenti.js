// 28/11/2026 · RATE DEGLI ACCANTONAMENTI CHE NON SI PERDONO (richiesta di Sergio:
// "se non segno pagate devono restare in evidenza finché non l'ho fatto, non devono sparire alla fine del mese").
// In dashboard_settings ogni campo *_pagato_mese contiene l'ULTIMO MESE PAGATO ('YYYY-MM').
// Tutte le rate dei mesi successivi, già scadute, restano aperte. "Pagato" chiude sempre la più vecchia.
// Logica pura, senza React né database.

// Le rate si inseguono da novembre 2026: i mesi precedenti sono chiusi.
export const INIZIO_PERSISTENZA = '2026-11'

const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre']
const indice = (periodo) => { const [y, m] = periodo.split('-').map(Number); return y * 12 + (m - 1) }
const daIndice = (i) => `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`
export const meseLungo = (periodo) => { const [y, m] = periodo.split('-').map(Number); return `${MESI[m - 1]} ${y}` }

// "Oggi" secondo l'orologio del dispositivo, 'YYYY-MM-DD'
export const oggiLocale = () => new Date().toLocaleDateString('sv-SE')

// Data di scadenza: il giorno 30 a febbraio diventa l'ultimo giorno del mese
export function dataScadenza(periodo, giorno) {
  const [y, m] = periodo.split('-').map(Number)
  const ultimo = new Date(y, m, 0).getDate()
  return `${periodo}-${String(Math.min(giorno, ultimo)).padStart(2, '0')}`
}

export const pagataPer = (settings, key, periodo) => !!settings?.[key] && String(settings[key]) >= periodo

// piano: elenco di rate [{ key, day, amount, label, nome?, dal? }] oppure funzione (periodo) => elenco
const rateDelMese = (piano, periodo) =>
  (typeof piano === 'function' ? piano(periodo) : piano).filter(r => !r.dal || r.dal <= periodo)

function costruisci(r, periodo, meseCorrente) {
  return {
    ...r,
    periodo,
    id: `${r.key}|${periodo}`,
    scadenza: dataScadenza(periodo, r.day),
    label: periodo === meseCorrente ? r.label : `${r.label} · ${meseLungo(periodo)}`,
  }
}

// Rate già scadute (o in scadenza oggi) e non ancora pagate, dalla più vecchia.
export function rateAperte(piano, settings, oggi = oggiLocale(), inizio = INIZIO_PERSISTENZA) {
  const meseCorrente = oggi.slice(0, 7)
  const out = []
  for (let i = indice(inizio); i <= indice(meseCorrente); i++) {
    const periodo = daIndice(i)
    for (const r of rateDelMese(piano, periodo)) {
      if (pagataPer(settings, r.key, periodo)) continue
      const voce = costruisci(r, periodo, meseCorrente)
      if (voce.scadenza <= oggi) out.push(voce)
    }
  }
  // per ogni campo solo la più vecchia ha il tasto "Pagato"
  const visti = new Set()
  return out.map(v => { const pagabile = !visti.has(v.key); visti.add(v.key); return { ...v, pagabile } })
}

// Rate del mese in corso non ancora scadute e non pagate (per il preavviso)
export function rateInArrivo(piano, settings, oggi = oggiLocale(), inizio = INIZIO_PERSISTENZA) {
  const meseCorrente = oggi.slice(0, 7)
  if (meseCorrente < inizio) return []
  const conArretrati = new Set(rateAperte(piano, settings, oggi, inizio).map(r => r.key))
  return rateDelMese(piano, meseCorrente)
    .filter(r => !pagataPer(settings, r.key, meseCorrente))
    .map(r => costruisci(r, meseCorrente, meseCorrente))
    .filter(r => r.scadenza > oggi)
    .map(r => ({ ...r, pagabile: !conArretrati.has(r.key) }))
}

// Somma ancora da pagare dei mesi PRECEDENTI a quello in corso
export function arretrati(piano, settings, oggi = oggiLocale(), inizio = INIZIO_PERSISTENZA) {
  return rateAperte(piano, settings, oggi, inizio)
    .filter(r => r.periodo < oggi.slice(0, 7))
    .reduce((s, r) => s + r.amount, 0)
}

// Accantonato = tutto il mese in corso non pagato + arretrati
export function daPagareTotale(piano, settings, oggi = oggiLocale(), inizio = INIZIO_PERSISTENZA) {
  const meseCorrente = oggi.slice(0, 7)
  const mese = rateDelMese(piano, meseCorrente)
    .filter(r => !pagataPer(settings, r.key, meseCorrente))
    .reduce((s, r) => s + r.amount, 0)
  return Math.round((mese + arretrati(piano, settings, oggi, inizio)) * 100) / 100
}

// La rata che il tasto "Pagato" deve chiudere: la più vecchia aperta, altrimenti quella in arrivo
export function prossimaDaPagare(piano, key, settings, oggi = oggiLocale(), inizio = INIZIO_PERSISTENZA) {
  return rateAperte(piano, settings, oggi, inizio).find(r => r.key === key)
    || rateInArrivo(piano, settings, oggi, inizio).find(r => r.key === key)
    || null
}
