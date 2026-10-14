// 14/10/2026 · Baccarat "campionato" a eliminazione (come lo gioca Sergio).
// Turno 1: tutti i conti puntano (metà Banco, metà Giocatore). Chi vince RADDOPPIA e passa al turno dopo: i vincitori si
// dividono di nuovo metà Banco e metà Giocatore con la puntata doppia, e così via fino a UN vincitore.
// Esempio con 8 conti da 100: 8×100 → 4×200 → 2×400 → 1 vincitore e 7 eliminati.
// Qui c'è solo il calcolo (senza schermo), così si prova da solo.
const arrotonda = (x) => Math.round(x * 100) / 100
export const COMMISSIONE_BANCO = 0.95   // il Banco paga 0,95 per 1

// partecipanti: [{ id, nome, intestatario, tipo: 'Banco'|'Giocatore', puntata }]   (turno 1)
// esiti: { 'turno:id': 'V' | 'P' }     lati: { 'turno:id': 'Banco' | 'Giocatore' } (cambi a mano dal turno 2 in poi)
// Restituisce i turni giocati/da giocare: [[{ id, nome, intestatario, lato, importo, esito }]]
export function turniCampionato(partecipanti, esiti = {}, lati = {}, maxTurni = 8) {
  const turni = []
  let corrente = (partecipanti || []).map(x => ({ id: x.id, nome: x.nome, intestatario: x.intestatario, lato: x.tipo, importo: Number(x.puntata) || 0 }))
  for (let k = 0; k < maxTurni && corrente.length >= 2; k++) {
    const turno = corrente.map(c => ({ ...c, esito: esiti[`${k}:${c.id}`] || null }))
    turni.push(turno)
    if (turno.some(c => !c.esito)) break
    const vincitori = turno.filter(c => c.esito === 'V')
    if (vincitori.length <= 1) break
    corrente = vincitori.map((c, i) => ({
      id: c.id, nome: c.nome, intestatario: c.intestatario,
      lato: lati[`${k + 1}:${c.id}`] || (i % 2 === 0 ? 'Banco' : 'Giocatore'),
      importo: arrotonda(c.importo * 2),
    }))
  }
  return turni
}

// Totali per conto: quanto ha puntato in tutto, risultato netto, turno in cui è uscito, se ha vinto il campionato
export function risultatiCampionato(turni) {
  const per = new Map()
  for (const turno of turni) for (const c of turno) {
    if (!c.esito) continue
    const r = per.get(c.id) || { puntato: 0, risultato: 0, uscita: null, campione: false }
    r.puntato += c.importo
    r.risultato += c.esito === 'V' ? c.importo * (c.lato === 'Banco' ? COMMISSIONE_BANCO : 1) : -c.importo
    if (c.esito === 'P') r.uscita = turni.indexOf(turno) + 1
    per.set(c.id, r)
  }
  const ultimo = turni[turni.length - 1] || []
  const completo = ultimo.length > 0 && ultimo.every(c => c.esito)
  const vincitori = ultimo.filter(c => c.esito === 'V')
  const finito = completo && vincitori.length <= 1
  if (finito && vincitori.length === 1 && per.has(vincitori[0].id)) per.get(vincitori[0].id).campione = true
  for (const r of per.values()) { r.puntato = arrotonda(r.puntato); r.risultato = arrotonda(r.risultato) }
  return { per, finito, campioneId: finito && vincitori.length === 1 ? vincitori[0].id : null }
}

// Totali Banco/Giocatore di un turno (devono essere uguali per essere coperti)
export function totaliTurno(turno) {
  const B = turno.filter(c => c.lato === 'Banco').reduce((a, c) => a + c.importo, 0)
  const P = turno.filter(c => c.lato === 'Giocatore').reduce((a, c) => a + c.importo, 0)
  return { B, P }
}
