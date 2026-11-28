// 28/11/2026 · CONTI PER ANNO: profitto, prelievi e cash flow di ogni periodo, e cassa di apertura di ogni anno.
// Ogni anno riparte da zero: l'apertura è la cassa della chiusura del 31/12 precedente.
// I numeri del 2026 restano calcolati esattamente come prima (confermati da Sergio il 28/11/2026).
// Logica pura, senza React né database.

export const BASE_CASSA_2026 = 57229.62

// Dati storici fissi per gen/feb 2026 (non presenti nel DB): il nuovo calcolo del profitto è partito a marzo.
// I valori _prelievi e _cashflow sono fissi; profit è cumulativo nella sequenza
export const STORICO_FISSO = [
  { id: 'fisso-gen', snapshot_date: '2026-01-31', total_cash: 51532.70, base_cash_month: 57229.62, profit: 10052.56, _prelievi: 5859.65, _cashflow: 4192.91, _fisso: true },
  { id: 'fisso-feb', snapshot_date: '2026-02-28', total_cash: 57229.62, base_cash_month: 57229.62, profit: 16622.02, _prelievi: 5572.01, _cashflow: 997.45, _fisso: true },
]
// Per marzo: total_cash e profitto corretti fissi; prelievi e cashflow fissi
export const MARZO_FIX = { total_cash: 60069.41, _profitto_periodo: 10930.56, _prelievi: 8090.77, _cashflow: 2839.79 }

const num = (v) => Number(v || 0)
const annoDi = (s) => Number(String(s?.snapshot_date || '').slice(0, 4))

// Data e anno secondo l'ora italiana
export const oggiRoma = (quando = new Date()) => quando.toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' })
// Istante (ISO) della mezzanotte italiana del 1° gennaio (a gennaio l'Italia è sempre a UTC+1)
export const inizioAnnoIso = (anno) => new Date(Date.UTC(anno - 1, 11, 31, 23, 0, 0)).toISOString()

// Sequenza normalizzata: inietta gen/feb 2026 se mancanti, corregge marzo 2026
export function normalizzaPeriodi(snapshots = []) {
  const snaps = snapshots.map(s => (s.snapshot_date && s.snapshot_date.startsWith('2026-03') ? { ...s, ...MARZO_FIX } : s))
  for (const fisso of STORICO_FISSO) {
    const mese = fisso.snapshot_date.slice(0, 7)
    if (!snaps.some(s => s.snapshot_date && s.snapshot_date.startsWith(mese))) snaps.push(fisso)
  }
  return snaps.sort((a, b) => (a.snapshot_date || '').localeCompare(b.snapshot_date || ''))
}

// Cassa di apertura dell'anno. provvisoria = manca la chiusura del 31/12 dell'anno prima.
export function aperturaAnno(snapshots = [], anno) {
  if (anno <= 2026) return { valore: BASE_CASSA_2026, provvisoria: false }
  const ordinati = [...snapshots].sort((a, b) => (a.snapshot_date || '').localeCompare(b.snapshot_date || ''))
  const chiusura = ordinati.find(s => s.snapshot_date === `${anno - 1}-12-31`)
  if (chiusura) return { valore: num(chiusura.total_cash), provvisoria: false }
  const ultimo = ordinati.filter(s => annoDi(s) < anno).pop()
  return { valore: ultimo ? num(ultimo.total_cash) : BASE_CASSA_2026, provvisoria: true }
}

// Aggiunge a ogni periodo: anno, profittoPeriodo, prelieviPeriodo, cashFlowPeriodo
export function calcolaPeriodi(snapshots = []) {
  const lista = normalizzaPeriodi(snapshots)
  // profitto progressivo: nel 2026 è quello salvato; dal 2027 si ricalcola sull'apertura dell'anno
  const progressivo = (s) => annoDi(s) <= 2026 ? num(s.profit) : num(s.total_cash) + num(s.external_withdrawals) - aperturaAnno(snapshots, annoDi(s)).valore
  return lista.map((s, i) => {
    // il primo periodo di un anno parte da zero: non si confronta con l'anno prima
    const prima = i > 0 && annoDi(lista[i - 1]) === annoDi(s) ? lista[i - 1] : null
    const profittoPeriodo = s._profitto_periodo !== undefined ? s._profitto_periodo : progressivo(s) - (prima ? progressivo(prima) : 0)
    const prelieviPeriodo = s._prelievi !== undefined ? s._prelievi : num(s.external_withdrawals) - (prima ? num(prima.external_withdrawals) : 0)
    const cashFlowPeriodo = s._cashflow !== undefined ? s._cashflow : profittoPeriodo - prelieviPeriodo
    return { ...s, anno: annoDi(s), profittoPeriodo, prelieviPeriodo, cashFlowPeriodo }
  })
}

export function totaliAnno(periodi, anno) {
  const r2 = (v) => Math.round(v * 100) / 100
  const miei = periodi.filter(p => p.anno === anno)
  return {
    profitto: r2(miei.reduce((s, p) => s + p.profittoPeriodo, 0)),
    prelievi: r2(miei.reduce((s, p) => s + p.prelieviPeriodo, 0)),
    cashFlow: r2(miei.reduce((s, p) => s + p.cashFlowPeriodo, 0)),
  }
}

// Guadagno "di adesso": dall'ultimo periodo salvato NELL'ANNO in corso, altrimenti dall'apertura dell'anno
export function riferimentoCorrente(snapshots = [], anno) {
  const ultimo = [...snapshots].filter(s => annoDi(s) === anno).sort((a, b) => (a.snapshot_date || '').localeCompare(b.snapshot_date || '')).pop()
  return ultimo
    ? { base: num(ultimo.total_cash), prelieviGiaContati: num(ultimo.external_withdrawals) }
    : { base: aperturaAnno(snapshots, anno).valore, prelieviGiaContati: 0 }
}
