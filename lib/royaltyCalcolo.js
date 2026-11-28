// 28/11/2026 · calcolo delle royalty (spostato da RoyaltyPanel.jsx per usarlo anche nell'archivio dell'anno). Logica pura.

export const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre']
export const PERIODO_BENVENUTO = 'benvenuto'
export const BENVENUTO_MESI = 4        // il benvenuto si paga nel 4° mese (ingresso = 1° mese); la quota mensile parte dal 5°
export const QUOTA_MENSILE_SUGGERITA = 50 // solo precompilata nel form, modificabile
const GIORNI_TOLLERANZA_RITARDO = 5
// Avvisi nel banner della dashboard
const PREAVVISO_MENSILI = 2      // giorni prima del giorno di pagamento dei mensili
const PREAVVISO_ANNUALI = 10     // giorni prima del pagamento di annuali e benvenuti
export const GIORNO_PAGAMENTO_ANNUALI = { 6: 30, 12: 20 } // giugno -> 30/6, dicembre -> 20/12 (altri mesi: il 20)
const ANNUALI_PERSISTENTI_DAL = '2026-12-01' // 28/11/2026: le annuali da qui in poi restano in avviso finché non sono pagate
const GIORNO_PAGAMENTO_BENVENUTO = 20              // il benvenuto si paga il 20 del mese di pagamento // oltre questi giorni dal giorno di pagamento l'avviso diventa "in ritardo"

export const eur = (v) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(Number(v || 0))
export const r2 = (v) => Math.round(Number(v || 0) * 100) / 100
export const oggiISO = () => new Date().toLocaleDateString('sv-SE')
export const meseIdx = (iso) => { const [y, m] = String(iso).split('-').map(Number); return y * 12 + (m - 1) }
export const idxToPeriodo = (i) => `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`
export const periodoLabel = (p) => { const [y, m] = String(p).split('-').map(Number); return m ? `${MESI[m - 1]} ${y}` : p }
export const giorniNelMese = (y, m) => new Date(y, m, 0).getDate() // m = 1..12
export const diffGiorni = (da, a) => Math.round((new Date(a + 'T00:00:00') - new Date(da + 'T00:00:00')) / 86400000) // a - da
export const aggiungiGiorni = (iso, n) => new Date(new Date(iso + 'T00:00:00').getTime() + n * 86400000).toLocaleDateString('sv-SE')
export const dataPagamentoAnnuale = (anno, mese) => `${anno}-${String(mese).padStart(2, '0')}-${String(Math.min(GIORNO_PAGAMENTO_ANNUALI[mese] || 20, giorniNelMese(anno, mese))).padStart(2, '0')}`
export const giornoPrima = (iso) => new Date(new Date(iso + 'T00:00:00').getTime() - 86400000).toLocaleDateString('sv-SE')
export const primoMeseProssimo = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth() + 1, 1).toLocaleDateString('sv-SE') }
// data + n mesi (se il giorno non esiste, es. 31, va all'ultimo giorno del mese)
export const aggiungiMesi = (iso, n) => {
  const [y, m, d] = iso.split('-').map(Number)
  const ultimo = new Date(y, m - 1 + n + 1, 0).getDate()
  return new Date(y, m - 1 + n, Math.min(d, ultimo)).toLocaleDateString('sv-SE')
}
export const primoDelMeseDopo = (iso, n) => { const [y, m] = iso.split('-').map(Number); return new Date(y, m - 1 + n, 1).toLocaleDateString('sv-SE') }
export const dataIt = (iso) => iso ? iso.split('-').reverse().join('/') : ''

// Accordo ricorrente in vigore a quella data (le una tantum non contano come accordo "attivo")
export function accordoAttivoAl(accordi, iso) {
  return accordi.find(a => a.frequenza !== 'una_tantum' && a.valido_dal <= iso && (!a.valido_al || a.valido_al >= iso)) || null
}

export function descriviAccordo(a) {
  if (!a) return 'nessun accordo'
  if (a.frequenza === 'nessuna') return 'nessuna royalty'
  if (a.frequenza === 'una_tantum') return `una tantum ${eur(a.importo_mensile)}`
  if (a.frequenza === 'mensile') return `mensile · ${eur(a.importo_mensile)}/mese`
  return `annuale ${MESI[(a.mese_pagamento || 12) - 1]} · ${eur(a.importo_mensile)}/mese (${eur(a.importo_mensile * 12)}/anno)`
}

// ─── CALCOLO ────────────────────────────────────────────────────────
export function calcolaRoyalty(accordi = [], pagamenti = [], giornoGenerale = 26, oggi = oggiISO()) {
  const idxOggi = meseIdx(oggi)
  const [yOggi, mOggi, dOggi] = oggi.split('-').map(Number)
  const perCliente = {}
  const cli = (id) => (perCliente[id] = perCliente[id] || { maturato: 0, pagato: 0, premi: 0, saldo: 0, accordi: [], attivo: null, prossimaAnnuale: null })

  for (const a of accordi) cli(a.cliente_id).accordi.push(a)
  for (const c of Object.values(perCliente)) c.accordi.sort((x, y) => String(x.valido_dal).localeCompare(String(y.valido_dal)))

  // Maturato: quota mensile × mesi dall'inizio accordo al mese corrente incluso
  for (const a of accordi) {
    if (a.frequenza === 'nessuna' || a.valido_dal > oggi) continue
    if (a.frequenza === 'una_tantum') {
      // matura in quote uguali dal mese di ingresso al mese di pagamento incluso
      const scad = a.valido_al || a.valido_dal
      const n = Math.max(1, meseIdx(scad) - meseIdx(a.valido_dal) + 1)
      const trascorsi = oggi >= scad ? n : Math.min(n, Math.max(0, idxOggi - meseIdx(a.valido_dal) + 1))
      cli(a.cliente_id).maturato += Number(a.importo_mensile || 0) * trascorsi / n
      continue
    }
    const fine = a.valido_al && a.valido_al < oggi ? a.valido_al : oggi
    const mesi = Math.max(0, meseIdx(fine) - meseIdx(a.valido_dal) + 1)
    cli(a.cliente_id).maturato += Number(a.importo_mensile || 0) * mesi
  }
  for (const p of pagamenti) {
    if (p.storico) continue
    if (p.tipo === 'premio') cli(p.cliente_id).premi += Number(p.importo || 0)
    else cli(p.cliente_id).pagato += Number(p.importo || 0)
  }

  const mensiliDaPagare = []
  const prossimiAnnuali = []
  const benvenutiDaPagare = []
  const avvisi = [] // per il banner: mensili (2 gg prima), annuali e benvenuti (10 gg prima), finché non pagati
  let quotaMensileAttuale = 0

  for (const [id, c] of Object.entries(perCliente)) {
    c.maturato = r2(c.maturato); c.pagato = r2(c.pagato); c.premi = r2(c.premi)
    c.saldo = r2(c.maturato - c.pagato)
    c.attivo = accordoAttivoAl(c.accordi, oggi)
    if (c.attivo && c.attivo.frequenza !== 'nessuna') quotaMensileAttuale += Number(c.attivo.importo_mensile || 0)
    for (const a of c.accordi) {
      if (a.frequenza !== 'una_tantum') continue
      const scad = a.valido_al || a.valido_dal
      if (idxOggi >= meseIdx(a.valido_dal) && idxOggi <= meseIdx(scad)) quotaMensileAttuale += Number(a.importo_mensile || 0) / Math.max(1, meseIdx(scad) - meseIdx(a.valido_dal) + 1)
    }

    // Mensili: ogni mese dell'accordo, dal giorno di pagamento in poi, senza una royalty con quel periodo
    for (const a of c.accordi) {
      if (a.frequenza !== 'mensile') continue
      const periodiPagati = new Set(pagamenti.filter(p => String(p.cliente_id) === String(id) && !p.storico && p.tipo === 'royalty').map(p => p.periodo))
      const fineIdx = Math.min(idxOggi + 1, a.valido_al ? meseIdx(a.valido_al) : idxOggi + 1) // +1: il preavviso può cadere nel mese prima
      for (let i = meseIdx(a.valido_dal); i <= fineIdx; i++) {
        const periodo = idxToPeriodo(i)
        if (periodiPagati.has(periodo)) continue
        const y = Math.floor(i / 12), m = (i % 12) + 1
        const giorno = Math.min(Number(a.giorno_pagamento || giornoGenerale || 26), giorniNelMese(y, m))
        const scadenza = `${periodo}-${String(giorno).padStart(2, '0')}`
        if (aggiungiGiorni(scadenza, -PREAVVISO_MENSILI) > oggi) continue
        const ritardo = diffGiorni(scadenza, oggi) // negativo = mancano ancora dei giorni
        const voce = { cliente_id: a.cliente_id, periodo, importo: r2(a.importo_mensile), scadenza, giorniRitardo: ritardo, inRitardo: ritardo > GIORNI_TOLLERANZA_RITARDO }
        mensiliDaPagare.push(voce)
        avvisi.push({ ...voce, tipo: 'mensile', etichetta: periodoLabel(periodo) })
      }
    }

    // Una tantum (benvenuto) non ancora pagata con una royalty "benvenuto": in maturazione o scaduta
    const unaTantum = c.accordi.filter(a => a.frequenza === 'una_tantum' && a.valido_dal <= oggi)
    let benvResiduo = 0 // benvenuto maturato e non ancora pagato: si paga a parte, non nell'annuale
    if (unaTantum.length) {
      const dovuto = unaTantum.reduce((s, a) => s + Number(a.importo_mensile || 0), 0)
      const pagatoBenv = pagamenti.filter(p => String(p.cliente_id) === String(id) && !p.storico && p.tipo === 'royalty' && p.periodo === PERIODO_BENVENUTO)
        .reduce((s, p) => s + Number(p.importo || 0), 0)
      const meseScad = unaTantum.map(a => a.valido_al || a.valido_dal).sort().slice(-1)[0]
      const [ys, ms] = meseScad.split('-').map(Number)
      const scadenza = `${meseScad.slice(0, 7)}-${String(Math.min(GIORNO_PAGAMENTO_BENVENUTO, giorniNelMese(ys, ms))).padStart(2, '0')}`
      if (dovuto - pagatoBenv > 0.005) {
        benvResiduo = Math.min(dovuto - pagatoBenv, c.accordi.filter(a => a.frequenza === 'una_tantum' && a.valido_dal <= oggi).reduce((t, a) => {
          const scad = a.valido_al || a.valido_dal, n = Math.max(1, meseIdx(scad) - meseIdx(a.valido_dal) + 1)
          const tr = oggi >= scad ? n : Math.min(n, Math.max(0, idxOggi - meseIdx(a.valido_dal) + 1))
          return t + Number(a.importo_mensile || 0) * tr / n
        }, 0) - pagatoBenv)
        const voce = { cliente_id: Number(id), periodo: PERIODO_BENVENUTO, importo: r2(dovuto - pagatoBenv), scadenza, scaduto: oggi >= scadenza }
        benvenutiDaPagare.push(voce)
        if (aggiungiGiorni(scadenza, -PREAVVISO_ANNUALI) <= oggi) {
          const ritardo = diffGiorni(scadenza, oggi)
          avvisi.push({ ...voce, tipo: 'benvenuto', etichetta: 'benvenuto', giorniRitardo: ritardo, inRitardo: ritardo > GIORNI_TOLLERANZA_RITARDO })
        }
      }
    }

    // 28/11/2026 · ANNUALI SCADUTE E NON PAGATE: restano in avviso finché non risultano pagate (prima sparivano dopo 45 giorni).
    // Pagata = c'è una royalty con quel periodo, oppure royalty+anticipi coprono il maturato fino al mese di scadenza.
    let arretratoAnnuale = 0
    const miei = pagamenti.filter(p => String(p.cliente_id) === String(id) && !p.storico)
    const pagatoRicorrente = miei.filter(p => p.tipo !== 'premio' && p.periodo !== PERIODO_BENVENUTO).reduce((s, p) => s + Number(p.importo || 0), 0)
    const maturatoFinoA = (finoA) => c.accordi.filter(a => a.frequenza !== 'nessuna' && a.frequenza !== 'una_tantum' && a.valido_dal <= finoA).reduce((s, a) => {
      const fine = a.valido_al && a.valido_al < finoA ? a.valido_al : finoA
      return s + Number(a.importo_mensile || 0) * Math.max(0, meseIdx(fine) - meseIdx(a.valido_dal) + 1)
    }, 0)
    const scadute = new Map()
    for (const a of c.accordi) {
      if (a.frequenza !== 'annuale') continue
      const mp = Number(a.mese_pagamento || 12)
      for (let y = Number(String(a.valido_dal).slice(0, 4)); y <= yOggi; y++) {
        const scadenza = dataPagamentoAnnuale(y, mp)
        if (scadenza < ANNUALI_PERSISTENTI_DAL || scadenza > oggi || scadenza < a.valido_dal) continue
        scadute.set(scadenza, { y, mp })
        // accordo chiuso: l'ultima scadenza utile è la prima dopo la sua fine
        if (a.valido_al && scadenza >= a.valido_al) break
      }
    }
    for (const [scadenza, { y, mp }] of [...scadute].sort((x, z) => x[0].localeCompare(z[0]))) {
      const periodo = mp === 12 ? String(y) : `${y - 1}/${String(y).slice(2)}`
      if (miei.some(p => p.tipo === 'royalty' && p.periodo === periodo)) continue
      const fineMese = `${scadenza.slice(0, 7)}-${String(giorniNelMese(y, mp)).padStart(2, '0')}`
      const dovuto = r2(Math.min(maturatoFinoA(fineMese) - pagatoRicorrente - arretratoAnnuale, c.saldo + Number(c.attivo?.importo_mensile || 0)))
      if (dovuto <= 0.5) continue
      arretratoAnnuale = r2(arretratoAnnuale + dovuto)
      const ritardo = diffGiorni(scadenza, oggi)
      avvisi.push({ cliente_id: Number(id), tipo: 'annuale', periodo, etichetta: `annuale ${periodo}`, importo: dovuto, scadenza, giorniRitardo: ritardo, inRitardo: ritardo > GIORNI_TOLLERANZA_RITARDO })
    }

    // Annuali: prossimo mese di pagamento e saldo previsto a quella data (al netto delle annuali già in avviso sopra)
    if (c.attivo && c.attivo.frequenza === 'annuale') {
      const mp = Number(c.attivo.mese_pagamento || 12)
      const rata = Number(c.attivo.importo_mensile || 0)
      const saldoAl = (anno) => r2(c.saldo - Math.max(0, benvResiduo) - arretratoAnnuale + rata * ((anno * 12 + mp - 1) - idxOggi)) // saldo previsto al mese di pagamento (senza benvenuto)
      const anno = oggi < dataPagamentoAnnuale(yOggi, mp) ? yOggi : yOggi + 1
      const scadenza = dataPagamentoAnnuale(anno, mp)
      const previsto = saldoAl(anno)
      const periodo = mp === 12 ? String(anno) : `${anno - 1}/${String(anno).slice(2)}` // dicembre: "2026", giugno: "2025/26"
      c.prossimaAnnuale = { periodo: scadenza.slice(0, 7), scadenza, previsto, periodoPagamento: periodo }
      prossimiAnnuali.push({ cliente_id: Number(id), ...c.prossimaAnnuale })
      const giaPagata = miei.some(p => p.tipo === 'royalty' && p.periodo === periodo)
      if (!giaPagata && previsto > 0.5 && aggiungiGiorni(scadenza, -PREAVVISO_ANNUALI) <= oggi) {
        const ritardo = diffGiorni(scadenza, oggi)
        avvisi.push({ cliente_id: Number(id), tipo: 'annuale', periodo, etichetta: `annuale ${periodo}`, importo: previsto, scadenza, giorniRitardo: ritardo, inRitardo: ritardo > GIORNI_TOLLERANZA_RITARDO })
      }
    }
  }

  mensiliDaPagare.sort((a, b) => a.scadenza.localeCompare(b.scadenza))
  benvenutiDaPagare.sort((a, b) => a.scadenza.localeCompare(b.scadenza))
  prossimiAnnuali.sort((a, b) => a.scadenza.localeCompare(b.scadenza))
  avvisi.sort((a, b) => a.scadenza.localeCompare(b.scadenza))
  const totaleSaldo = r2(Object.values(perCliente).reduce((s, c) => s + c.saldo, 0))
  const totaleMaturato = r2(Object.values(perCliente).reduce((s, c) => s + c.maturato, 0))
  const totalePagato = r2(Object.values(perCliente).reduce((s, c) => s + c.pagato, 0))
  return { perCliente, totaleSaldo, totaleMaturato, totalePagato, quotaMensileAttuale: r2(quotaMensileAttuale), mensiliDaPagare, prossimiAnnuali, benvenutiDaPagare, avvisi, dOggi }
}
