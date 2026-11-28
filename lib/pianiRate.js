// 28/11/2026 · PIANI DELLE RATE degli accantonamenti (li usano avvisi, "Pagato", "Oggi da fare" e l'archivio dell'anno). Logica pura.

export const MICHELA_SETTIMANALE = 260
// Le prime 4 chiavi sono quelle storiche di Michela. La quinta usa una chiave legacy di
// Massimiliano ora libera, così non serve alcuna migrazione di dashboard_settings.
export const MICHELA_PAGATO_KEYS = [
  'michela_r1_pagato_mese',
  'michela_r9_pagato_mese',
  'michela_r17_pagato_mese',
  'michela_r24_pagato_mese',
  'figlio_g27_pagato_mese',
]
export function lunediDelMese(periodo) {
  const [anno, mese] = periodo.split('-').map(Number)
  const giorni = []
  for (let d = 1; d <= new Date(anno, mese, 0).getDate(); d += 1) {
    if (new Date(anno, mese - 1, d).getDay() === 1) giorni.push(d)
  }
  return giorni
}
// 'dal' = primo mese in cui il servizio compare: per un servizio nuovo va SEMPRE scritto, altrimenti risultano arretrati
export const SERVIZI_TUTTI = [
  { day: 9, amount: 22, key: 'anthropic_claude_pagato_mese', label: 'giorno 9', nome: 'Anthropic / Claude' },
  { day: 9, amount: 9.99, key: 'sbostats_pagato_mese', label: 'giorno 9', nome: 'Sbostats', nota: 'abbonamento con Google Play su sergio1971able', dal: '2026-12' },
  { day: 11, amount: 22, key: 'chatgpt_openai_pagato_mese', label: 'giorno 11', nome: 'ChatGPT / OpenAI' },
  { day: 17, amount: 22, key: 'supabase_database_pagato_mese', label: 'giorno 17', nome: 'Supabase Database' },
  { day: 23, amount: 19, key: 'api_football_pagato_mese', label: 'giorno 23', nome: 'API-Football', dal: '2026-11' },
  { day: 30, amount: 22, key: 'vercel_deployment_pagato_mese', label: 'giorno 30', nome: 'Vercel Deployment' },
]

export const FIGLIO_G13 = 250
export const FIGLIO_SCHEDULE = [
  { day: 13, amount: FIGLIO_G13, key: 'figlio_g13_pagato_mese', label: 'giorno 13' },
]

export const rateMichelaDelMese = (periodo) => lunediDelMese(periodo).map((day, i) => ({
  day,
  amount: MICHELA_SETTIMANALE,
  key: MICHELA_PAGATO_KEYS[i],
  label: `lunedì ${day}`,
}))

export const pianoPaolo = (settings) => [
  { day: 15, amount: Number(settings?.paolo_r15 ?? 1000), key: 'paolo_r15_pagato_mese', label: 'giorno 15' },
  { day: 30, amount: Number(settings?.paolo_r30 ?? 1000), key: 'paolo_r30_pagato_mese', label: 'giorno 30' },
]

// Antonello: rate trimestrali del contratto, il giorno 15
export const ANTONELLO_PERIODI = ['2026-12', '2027-03', '2027-06']
export const pianoAntonello = (settings) => (periodo) => ANTONELLO_PERIODI.includes(periodo)
  ? [{ day: 15, amount: Number(settings?.antonello_importo_trimestrale ?? 1050), key: 'antonello_pagato_trimestre', label: 'rata trimestrale' }]
  : []

export const inizioRata = (key) => key === 'antonello_pagato_trimestre' ? ANTONELLO_PERIODI[0] : undefined

export function pianoRata(key, settings, { paoloSchedule } = {}) {
  if (MICHELA_PAGATO_KEYS.includes(key)) return rateMichelaDelMese
  if (key === 'antonello_pagato_trimestre') return pianoAntonello(settings)
  if (key.startsWith('figlio_')) return FIGLIO_SCHEDULE
  if (key.startsWith('paolo_')) return paoloSchedule || pianoPaolo(settings)
  return SERVIZI_TUTTI
}
