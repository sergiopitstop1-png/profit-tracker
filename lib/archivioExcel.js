// 28/11/2026 · ARCHIVIO DELL'ANNO IN EXCEL, costruito dalla fotografia della chiusura (o dall'anteprima).
// Royalty, rate e periodi si calcolano con le stesse funzioni dell'app, sui soli dati fotografati.
import ExcelJS from 'exceljs'
import { calcolaPeriodi, totaliAnno } from './contiAnno'
import { calcolaRoyalty } from './royaltyCalcolo'
import { rateAperte } from './rateAccantonamenti'
import { FIGLIO_SCHEDULE, rateMichelaDelMese, SERVIZI_TUTTI, pianoPaolo, pianoAntonello, inizioRata } from './pianiRate'

const num = (v) => Number(v || 0)
const r2 = (v) => Math.round(num(v) * 100) / 100
const EURO = '#,##0.00 €;[Red]-#,##0.00 €'
const meseRoma = (data) => {
  const s = String(data || '').replace(' ', 'T')
  return new Date(/(Z|[+-]\d\d:?\d\d)$/.test(s) ? s : s + 'Z').toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' }).slice(0, 7)
}

function foglio(wb, nome, colonne, righe) {
  const ws = wb.addWorksheet(nome, { views: [{ state: 'frozen', ySplit: 1 }] })
  ws.columns = colonne.map(([header, key, width, euro]) => ({ header, key, width, style: euro ? { numFmt: EURO } : {} }))
  ws.getRow(1).font = { bold: true }
  // solo valori: un testo che inizia con "=" resta testo, non diventa una formula
  righe.forEach(r => ws.addRow(r))
  return ws
}

// chiusura = riga di chiusure_periodo, oppure il risultato dell'anteprima
export function riepilogoArchivio(chiusura, anno, { anteprima = false } = {}) {
  const f = chiusura.fotografia || {}
  const fine = anteprima ? new Date(chiusura.eseguita).toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' }) : `${anno}-12-31`
  let snapshots = (f.periodi || []).map(s => ({ ...s, snapshot_date: String(s.snapshot_date).slice(0, 10) }))
  // in anteprima aggiunge il periodo "adesso", che nel database non esiste
  if (anteprima) {
    snapshots = [...snapshots.filter(s => s.snapshot_date !== fine), {
      id: 'adesso', snapshot_date: fine, total_cash: num(chiusura.cassa), external_withdrawals: num(chiusura.prelievi_anno),
      base_cash_month: num(chiusura.apertura_anno), profit: num(chiusura.profitto_anno),
    }]
  }
  const periodi = calcolaPeriodi(snapshots).filter(p => p.anno === anno)
  const totali = totaliAnno(periodi, anno)

  const uscite = (f.movimenti || []).filter(t => t.azione === 'wallet_to_external')
  const categorie = new Map()
  for (const t of uscite) {
    const cat = (t.categoria_spesa === 'Casa' ? 'Famiglia' : t.categoria_spesa) || 'Senza categoria'
    const k = `${meseRoma(t.data)}|${cat}`
    categorie.set(k, r2((categorie.get(k) || 0) + num(t.importo)))
  }
  const speseCategoria = [...categorie].sort().map(([k, importo]) => { const [mese, categoria] = k.split('|'); return { mese, categoria, importo } })

  const contab = f.contabilita_programmata || []
  const perStato = (stato) => r2(contab.filter(r => r.stato === stato).reduce((s, r) => s + num(r.importo), 0))

  const accordi = (f.royalty_accordi || []).map(a => ({ ...a, importo_mensile: num(a.importo_mensile) }))
  const pagamenti = (f.royalty_pagamenti || []).map(p => ({ ...p, importo: num(p.importo) })).filter(p => !p.data || String(p.data).slice(0, 10) <= fine)
  const royalty = calcolaRoyalty(accordi, pagamenti, num(f.dashboard_settings?.royalty_giorno_mensile) || 26, fine)
  const nomi = new Map((f.clienti || []).map(c => [String(c.id), c.nome]))
  const nelAnno = (p) => !p.storico && p.tipo !== 'premio' && String(p.data || '').startsWith(String(anno))
  const primaDellAnno = calcolaRoyalty(accordi, pagamenti.filter(p => String(p.data || '').slice(0, 10) <= `${anno - 1}-12-31`), 26, `${anno - 1}-12-31`)
  const righeRoyalty = Object.entries(royalty.perCliente).map(([id, c]) => {
    const iniziale = num(primaDellAnno.perCliente[id]?.saldo)
    const pagato = r2(pagamenti.filter(p => String(p.cliente_id) === id && nelAnno(p)).reduce((s, p) => s + p.importo, 0))
    return { cliente: nomi.get(id) || `#${id}`, iniziale, maturato: r2(c.saldo - iniziale + pagato), pagato, finale: c.saldo }
  }).sort((a, b) => a.cliente.localeCompare(b.cliente))

  const s = f.dashboard_settings || {}
  const aperte = [
    ['Massimiliano', FIGLIO_SCHEDULE], ['Michela', rateMichelaDelMese], ['Servizio', SERVIZI_TUTTI],
    ...(s.paolo_attivo ? [['Paolo', pianoPaolo(s)]] : []),
    ['Antonello', pianoAntonello(s), inizioRata('antonello_pagato_trimestre')],
  ].flatMap(([chi, piano, inizio]) => rateAperte(piano, s, fine, inizio).map(r => ({ chi: r.nome || chi, scadenza: r.scadenza, importo: r.amount })))

  const risparmi = new Map()
  for (const m of f.risparmi_movimenti || []) if (String(m.data).slice(0, 10) <= fine) risparmi.set(m.persona, r2((risparmi.get(m.persona) || 0) + num(m.importo)))

  return {
    fine, periodi, totali, uscite, speseCategoria, contab,
    totaleUscite: r2(uscite.reduce((t, x) => t + num(x.importo), 0)),
    contabFatto: perStato('fatto'), contabPrevisto: perStato('previsto'),
    royalty: righeRoyalty, royaltySaldo: royalty.totaleSaldo, rateAperte: aperte,
    risparmi: [...risparmi].map(([persona, saldo]) => ({ persona, saldo })),
  }
}

export async function creaExcelArchivio(chiusura, anno, opz = {}) {
  const R = riepilogoArchivio(chiusura, anno, opz)
  const f = chiusura.fotografia || {}
  const wb = new ExcelJS.Workbook()

  foglio(wb, 'Riepilogo', [['Voce', 'v', 52], ['Valore', 'n', 22, true]], [
    { v: opz.anteprima ? `ANTEPRIMA ${anno} al ${R.fine} (NON è la chiusura)` : `ARCHIVIO ${anno} · chiusura del 31/12${chiusura.in_ritardo ? ' · ESEGUITA IN RITARDO' : ''}` },
    { v: 'Cassa di apertura', n: num(chiusura.apertura_anno) },
    { v: opz.anteprima ? 'Cassa adesso' : 'Cassa di chiusura', n: num(chiusura.cassa) },
    { v: '  di cui saldi book', n: num(chiusura.books) },
    { v: '  di cui saldi wallet', n: num(chiusura.wallets) },
    { v: 'Profitto dell\'anno (come in app)', n: R.totali.profitto },
    { v: 'Prelievi dell\'anno (come in app)', n: R.totali.prelievi },
    { v: 'Cash flow dell\'anno (come in app)', n: R.totali.cashFlow },
    { v: 'Uscite esterne registrate nei movimenti (da marzo 2026)', n: R.totaleUscite },
    { v: 'Contabilità programmata: Fatto', n: R.contabFatto },
    { v: 'Contabilità programmata: ancora Previsto', n: R.contabPrevisto },
    { v: 'Royalty ancora da pagare', n: R.royaltySaldo },
    { v: 'Rate accantonamenti scadute e non pagate', n: r2(R.rateAperte.reduce((t, r) => t + r.importo, 0)) },
    { v: 'Risparmi Samu e Massi', n: r2(R.risparmi.reduce((t, r) => t + r.saldo, 0)) },
    { v: 'Prelievi e contabilità non vanno sommati tra loro: le spese segnate Fatto sono già nei prelievi.' },
  ])
  foglio(wb, 'Periodi', [['Data', 'd', 14], ['Cassa', 'cassa', 18, true], ['Profitto', 'p', 18, true], ['Prelievi', 'u', 18, true], ['Cash flow', 'c', 18, true]],
    R.periodi.map(p => ({ d: p.snapshot_date, cassa: num(p.total_cash), p: r2(p.profittoPeriodo), u: r2(p.prelieviPeriodo), c: r2(p.cashFlowPeriodo) })))
  foglio(wb, 'Spese per categoria', [['Mese', 'mese', 12], ['Categoria', 'categoria', 36], ['Importo', 'importo', 18, true]], R.speseCategoria)
  foglio(wb, 'Uscite', [['Data (UTC)', 'data', 22], ['Importo', 'importo', 16, true], ['Categoria', 'categoria_spesa', 24], ['Nota', 'note', 60], ['Da', 'riferimento', 60]],
    R.uscite.map(t => ({ ...t, importo: num(t.importo) })))
  foglio(wb, 'Contabilità', [['Mese', 'mese', 8], ['Voce', 'voce', 44], ['Importo', 'importo', 16, true], ['Stato', 'stato', 14], ['Note', 'note', 30]],
    R.contab.map(r => ({ ...r, importo: num(r.importo) })))
  foglio(wb, 'Royalty', [['Cliente', 'cliente', 30], [`Saldo al 1/1/${anno}`, 'iniziale', 18, true], ['Maturato', 'maturato', 16, true], ['Pagato', 'pagato', 16, true], ['Saldo finale', 'finale', 16, true]], R.royalty)
  foglio(wb, 'Rate aperte', [['Chi', 'chi', 30], ['Scadenza', 'scadenza', 14], ['Importo', 'importo', 16, true]], R.rateAperte)
  foglio(wb, 'Risparmi', [['Persona', 'persona', 24], ['Saldo', 'saldo', 16, true]], R.risparmi)
  const saldi = [['Cliente', 'intestatario', 30], ['Nome', 'nome', 30], ['Saldo', 'saldo', 16, true], ['Note', 'note', 60]]
  foglio(wb, 'Saldi book', saldi, (f.books || []).map(b => ({ ...b, saldo: num(b.saldo) })))
  foglio(wb, 'Saldi wallet', saldi, (f.wallets || []).map(w => ({ ...w, saldo: num(w.saldo) })))
  foglio(wb, 'Tutti i movimenti', [['Data (UTC)', 'data', 22], ['Tipo', 'tipo', 14], ['Azione', 'azione', 28], ['Importo', 'importo', 16, true], ['Categoria', 'categoria_spesa', 22], ['Riferimento', 'riferimento', 70], ['Nota', 'note', 50]],
    (f.movimenti || []).map(t => ({ ...t, importo: num(t.importo) })))

  return { buffer: await wb.xlsx.writeBuffer(), riepilogo: R }
}
