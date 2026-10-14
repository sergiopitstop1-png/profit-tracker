// 14/10/2026 · "Oggi da fare" in una finestra a parte, da trascinare sull'altro monitor.
// Un sito non può scegliere il browser (Chrome/Edge): si apre sempre in quello in cui sei. Può però aprire una finestra
// separata (non una scheda), riusarla ai clic successivi e rimetterla dove l'avevi lasciata. Se il browser consente di
// conoscere i monitor (Chrome chiede un permesso la prima volta), la apre direttamente sul secondo schermo.
const URL = '/profit-tracker/da-fare'
const NOME = 'oggiDaFare'
const CHIAVE_POS = 'profittracker_oggi_finestra'

const leggiPos = () => { try { return JSON.parse(localStorage.getItem(CHIAVE_POS) || 'null') } catch { return null } }
const funzioni = p => `popup=yes,left=${Math.round(p.x)},top=${Math.round(p.y)},width=${Math.round(p.w)},height=${Math.round(p.h)}`

let finestra = null

export async function apriOggiDaFare() {
  // se l'ho aperta io e c'è ancora la riporto davanti (altrimenti, con lo stesso nome, il browser riusa comunque quella finestra)
  try { if (finestra && !finestra.closed) { finestra.focus(); return } } catch { /* nessun problema */ }

  let pos = leggiPos()   // l'ultima posizione scelta
  if (!pos && typeof window.getScreenDetails === 'function') {
    try {
      const det = await window.getScreenDetails()
      const altro = det.screens.find(s => s.availLeft !== window.screen.availLeft || s.availTop !== window.screen.availTop)
      if (altro) pos = { x: altro.availLeft + 40, y: altro.availTop + 40, w: Math.min(1100, altro.availWidth - 80), h: altro.availHeight - 80 }
    } catch { /* permesso negato: resta la finestra normale */ }
  }
  finestra = window.open(URL, NOME, pos ? funzioni(pos) : 'popup=yes,width=1000,height=900')
  if (!finestra) window.open(URL, '_blank')   // popup bloccato: scheda normale
}

// da chiamare nella pagina "Oggi da fare": ricorda dove hai messo la finestra, per riaprirla lì
export function ricordaPosizioneFinestra() {
  if (typeof window === 'undefined' || window.name !== NOME) return () => {}
  let ultimo = ''
  const salva = () => {
    const p = { x: window.screenX, y: window.screenY, w: window.outerWidth, h: window.outerHeight }
    const s = JSON.stringify(p)
    if (s !== ultimo && p.w > 300 && p.h > 300) { ultimo = s; try { localStorage.setItem(CHIAVE_POS, s) } catch {} }
  }
  const t = setInterval(salva, 2000)
  window.addEventListener('beforeunload', salva)
  return () => { clearInterval(t); window.removeEventListener('beforeunload', salva) }
}
