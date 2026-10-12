// 12/10/2026 · Cervello di Lucy fatto di 0 e 1 verdi (stile matrix). Solo disegno: nessun dato.
// Forma = profilo laterale (cervello + cervelletto + tronco); le "pieghe" sono creste di un campo ondulato, il contorno è più luminoso.
export type CellaCervello = { x: number; y: number; luce: number; nodo: boolean; bordo: boolean; ch: string }

const dentroEllisse = (x: number, y: number, cx: number, cy: number, rx: number, ry: number, bump = 0, fase = 0) => {
  const dx = (x - cx) / rx, dy = (y - cy) / ry
  const r = Math.hypot(dx, dy)
  const a = Math.atan2(dy, dx)
  return r <= 1 + bump * Math.sin(9 * a + fase) + bump * 0.6 * Math.sin(15 * a + 2 * fase)
}

/** x in [-1.6, 1.6], y in [-1, 1] (y positivo = in basso) */
export function dentroCervello(x: number, y: number) {
  if (dentroEllisse(x, y, 0.02, -0.14, 1.2, 0.7, 0.035, 0.3)) return true                 // emisferi (lobo frontale a destra, occipitale a sinistra)
  if (dentroEllisse(x, y, 0.3, 0.3, 0.78, 0.3, 0.03, 1.1)) return true                    // lobo temporale
  if (dentroEllisse(x, y, -0.62, 0.46, 0.5, 0.24, 0.03, 2.0)) return true                 // cervelletto
  const sx = x + 0.1 - (y - 0.3) * 0.45                                                   // tronco encefalico corto e inclinato
  if (y > 0.3 && y < 0.78 && Math.abs(sx) < 0.1 - (y - 0.3) * 0.04) return true
  return false
}

export function costruisciCervello(colonne: number, righe: number, aspetto: number): CellaCervello[] {
  const mask: boolean[][] = []
  const pos = (c: number, r: number) => ({ x: ((c + 0.5) / colonne * 2 - 1) * 1.62, y: ((r + 0.5) / righe * 2 - 1) * 1.0 })
  for (let r = 0; r < righe; r++) {
    mask.push([])
    for (let c = 0; c < colonne; c++) { const p = pos(c, r); mask[r].push(dentroCervello(p.x, p.y)) }
  }
  const out: CellaCervello[] = []
  let seme = 7
  const rnd = () => { seme = (seme * 16807) % 2147483647; return seme / 2147483647 }
  for (let r = 0; r < righe; r++) for (let c = 0; c < colonne; c++) {
    if (!mask[r][c]) continue
    const { x, y } = pos(c, r)
    const bordo = !(mask[r - 1]?.[c] && mask[r + 1]?.[c] && mask[r][c - 1] && mask[r][c + 1])
    const f = Math.sin(7.5 * x + 1.9 * Math.sin(5 * y + 1)) * Math.cos(6.5 * y + 1.6 * Math.sin(4.2 * x))
    const cervelletto = x < -0.15 && y > 0.3 && !dentroEllisse(x, y, 0.02, -0.14, 1.2, 0.7)
    const cresta = cervelletto ? Math.sin(y * 30 + x * 3) > 0.35 : Math.abs(f) < 0.24            // il cervelletto ha pieghe parallele
    const silvio = x > -0.05 && x < 1.0 && Math.abs(y - (0.1 + 0.16 * (x - 0.1))) < 0.035        // la scissura che separa il lobo temporale
    const luce = bordo ? 0.95 : silvio ? 0.04 : cresta ? 0.78 : 0.13
    out.push({ x: c, y: r, luce, nodo: !bordo && rnd() < 0.045, bordo, ch: rnd() < 0.5 ? '0' : '1' })
  }
  void aspetto
  return out
}

export function disegnaCervello(ctx: CanvasRenderingContext2D, celle: CellaCervello[], cw: number, ch: number, t: number, ribalta: boolean) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  ctx.font = `bold ${Math.round(ch * 0.95)}px ui-monospace, Menlo, Consolas, monospace`
  ctx.textBaseline = 'top'
  for (const c of celle) {
    if (ribalta && Math.random() < 0.05) c.ch = c.ch === '0' ? '1' : '0'
    const onda = 0.22 * Math.sin(t * 1.4 + c.x * 0.35 - c.y * 0.25)
    const l = Math.max(0.08, Math.min(1, c.luce + onda))
    if (c.nodo) { ctx.fillStyle = `rgba(220,252,231,${0.65 + 0.35 * Math.sin(t * 2.2 + c.x)})`; ctx.shadowColor = '#4ade80'; ctx.shadowBlur = 8 }
    else { ctx.fillStyle = `rgba(${c.bordo ? '134,239,172' : '34,197,94'},${l})`; ctx.shadowBlur = c.bordo ? 4 : 0; ctx.shadowColor = '#22c55e' }
    ctx.fillText(c.ch, c.x * cw, c.y * ch)
  }
  ctx.shadowBlur = 0
}
