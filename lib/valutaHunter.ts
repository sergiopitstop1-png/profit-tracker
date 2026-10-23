// 23/10/2026 · Esito di un segnale Hunterbet a partire dal risultato finale (90 minuti).
// Prima questa funzione stava solo nella pagina Segnali (si applicava quando premevi «Salva»): ora la usa anche il server,
// così quando il programma sul PC scrive il risultato l'esito si chiude da solo. Stessa regola in tutti e due i posti.
//
// "Gol casa/ospiti" = la squadra ha segnato DOPO il segnale (gol finali > gol al momento del segnale);
// per i PRE-LIVE si leggono i mercati (es. "12 + MG 1-3"). Mercato non riconosciuto → null (esito da scegliere a mano).
export type SegnaleHunter = {
  tipo_segnale?: string | null
  score_casa_segnale?: number | null
  score_ospite_segnale?: number | null
}

export function valutaHunter(s: SegnaleHunter, fc: number, fo: number): 'VINTA' | 'PERSA' | null {
  if (s.tipo_segnale === 'GOL_CASA') return fc > (s.score_casa_segnale ?? 0) ? 'VINTA' : 'PERSA'
  if (s.tipo_segnale === 'GOL_OSPITI') return fo > (s.score_ospite_segnale ?? 0) ? 'VINTA' : 'PERSA'
  const tot = fc + fo
  const pezzi = String(s.tipo_segnale || '').toUpperCase().split('+').map(x => x.trim()).filter(Boolean)
  if (!pezzi.length) return null
  for (const p of pezzi) {
    let ok: boolean | null = null, m: RegExpMatchArray | null
    if (p === '1') ok = fc > fo; else if (p === 'X') ok = fc === fo; else if (p === '2') ok = fc < fo
    else if (p === '12') ok = fc !== fo; else if (p === '1X') ok = fc >= fo; else if (p === 'X2') ok = fc <= fo
    else if (/^(GG|GOAL)$/.test(p)) ok = fc > 0 && fo > 0; else if (/^(NG|NO ?GOAL)$/.test(p)) ok = !(fc > 0 && fo > 0)
    else if ((m = p.match(/^(?:OVER|O)\s*(\d+(?:[.,]5)?)$/))) ok = tot > Number(m[1].replace(',', '.'))
    else if ((m = p.match(/^(?:UNDER|U)\s*(\d+(?:[.,]5)?)$/))) ok = tot < Number(m[1].replace(',', '.'))
    else if ((m = p.match(/^(?:MG|MULTIGOL)\s*(\d+)\s*-\s*(\d+)$/))) ok = tot >= Number(m[1]) && tot <= Number(m[2])
    if (ok === null) return null          // mercato non riconosciuto: esito da scegliere a mano
    if (!ok) return 'PERSA'
  }
  return 'VINTA'
}
