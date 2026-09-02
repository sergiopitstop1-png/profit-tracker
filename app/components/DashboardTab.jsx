import React, { useState } from 'react'
import TradingViewChart from './TradingViewChart'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import {
  tabContent, primaryButtonBlue, heroGrid, heroCard, heroLabel, heroValue, heroSub,
  heroMiniRow, heroMiniBox, heroMiniLabel, heroMiniValue, panel, panelHeader,
  panelTitle, panelSubtitle, input, heroSideGrid, dashboardGrid, stackList,
  rankRow, rankBadge, rankMain, miniRowTitle, miniRowSub, rankValue, tableWrap,
  table, th, tr, td, statCard, statLabel, statValue, statSub,
} from './styles'

const DASH_CHART_ASSETS = [
  { symbol: 'XAUUSD', label: 'Oro (XAU/USD)' },
  { symbol: 'BTCUSD', label: 'Bitcoin' },
  { symbol: 'ETHUSD', label: 'Ethereum' },
  { symbol: 'EURUSD', label: 'EUR/USD' },
  { symbol: 'GBPUSD', label: 'GBP/USD' },
  { symbol: 'USDJPY', label: 'USD/JPY' },
  { symbol: 'XAGUSD', label: 'Argento (XAG/USD)' },
]

// Componenti locali (autonomi, nessuna dipendenza dallo stato del padre)
const badge = (tipo) => ({
  display: 'inline-flex',
  alignItems: 'center',
  padding: '6px 10px',
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 800,
  background: tipo === 'versa' ? 'rgba(34,197,94,0.16)' : tipo === 'preleva' ? 'rgba(59,130,246,0.16)' : tipo === 'trasferisci' ? 'rgba(168,85,247,0.16)' : 'rgba(249,115,22,0.16)',
  color: tipo === 'versa' ? '#86efac' : tipo === 'preleva' ? '#93c5fd' : tipo === 'trasferisci' ? '#d8b4fe' : '#fdba74',
  border: tipo === 'versa' ? '1px solid rgba(34,197,94,0.35)' : tipo === 'preleva' ? '1px solid rgba(59,130,246,0.35)' : tipo === 'trasferisci' ? '1px solid rgba(168,85,247,0.35)' : '1px solid rgba(249,115,22,0.35)'
})

const StatCard = ({ label, value, sub, accent = '#38bdf8' }) => (
  <div style={{ ...statCard, borderColor: `${accent}55` }}>
    <div style={statLabel}>{label}</div>
    <div style={statValue}>{value}</div>
    <div style={statSub}>{sub}</div>
  </div>
)

export default function DashboardTab({
  memoFutureNotes,
  stimeCassa,
  clienti,
  guadagnoCorrente,
  basePeriodo,
  totaleUsciteEsterne,
  guadagnoAnnuo,
  cashFlowAnnuo,
  accantonamentiTotale,
  accantonamentiAvvisiCount,
  goToAccantonamenti,
  updateDashboardSetting,
  parseEuroInput,
  meseCorrenteNum,
  risparmiSamuMassi,
  setDashboardSettings,
  totaleCassa,
  totaleBooks,
  totaleWallets,
  prelievoDelMese,
  currentMonthLabel,
  totaleSpeseProgrammateAnno,
  mediaMensileResidua,
  cassaDisponibile,
  weeklyChartData,
  weeklyProfitColor,
  topBooks,
  topWallets,
  ultimeTransazioni,
  formatDate,
  formatCurrency,
  saveWeeklySnapshot,
}) {
  const [dashChartSymbol, setDashChartSymbol] = useState('XAUUSD')
  return (
    <div style={tabContent}>
      {(() => {
        const oggi = new Date()
        const annoCorrente = oggi.getFullYear()
        const meseCorrente = oggi.getMonth() + 1

        // Scadenze da Memo
        const scadenzeMemo = memoFutureNotes
          .filter(row => {
            if (!row.data_reale) return false
            const diff = Math.ceil((new Date(row.data_reale + 'T00:00:00') - oggi) / (1000 * 60 * 60 * 24))
            return diff <= 7
          })
          .map(row => {
            const diff = Math.ceil((new Date(row.data_reale + 'T00:00:00') - oggi) / (1000 * 60 * 60 * 24))
            return { descrizione: row.descrizione, diff, tipo: 'memo' }
          })

        // Scadenze da Contabilità mese corrente (previsto + giorno compilato)
        const scadenzeContabilita = stimeCassa
          .filter(row => {
            if (row.stato !== 'previsto') return false
            if (Number(row.anno) !== annoCorrente || Number(row.mese) !== meseCorrente) return false
            const m = String(row.note || '').match(/\[g:(\d+)\]/)
            return m !== null
          })
          .map(row => {
            const m = String(row.note || '').match(/\[g:(\d+)\]/)
            const giorno = parseInt(m[1], 10)
            const dataReale = `${annoCorrente}-${String(meseCorrente).padStart(2, '0')}-${String(giorno).padStart(2, '0')}`
            const diff = Math.ceil((new Date(dataReale + 'T00:00:00') - oggi) / (1000 * 60 * 60 * 24))
            return { descrizione: row.voce || 'Spesa contabilità', diff, tipo: 'contabilita' }
          })
          .filter(r => r.diff <= 7)

        // Scadenze SIM (2 giorni prima) — fix: se il giorno è già passato nel mese corrente, considera il mese prossimo
        const scadenzeSim = clienti
          .filter(c => c.sim_giorno_scadenza)
          .map(c => {
            const oggiNorm = new Date(oggi)
            oggiNorm.setHours(0, 0, 0, 0)
            let dataScad = new Date(oggiNorm.getFullYear(), oggiNorm.getMonth(), c.sim_giorno_scadenza)
            // Se la scadenza nel mese corrente è già passata, sposta al mese prossimo
            if (dataScad < oggiNorm) {
              dataScad = new Date(oggiNorm.getFullYear(), oggiNorm.getMonth() + 1, c.sim_giorno_scadenza)
            }
            const diff = Math.round((dataScad - oggiNorm) / (1000 * 60 * 60 * 24))
            // La chiave mese per il rinnovo è quella del mese in cui cade la scadenza calcolata
            const meseScadKey = `${dataScad.getFullYear()}-${String(dataScad.getMonth() + 1).padStart(2, '0')}`
            const rinnovato = c.sim_rinnovato && c.sim_rinnovato_mese === meseScadKey
            return { descrizione: `SIM ${c.nome} (${c.sim_operatore || ''})`, diff, tipo: 'sim', rinnovato }
          })
          .filter(r => r.diff <= 2 && !r.rinnovato)

        const tutte = [...scadenzeMemo, ...scadenzeContabilita, ...scadenzeSim]
          .sort((a, b) => a.diff - b.diff)

        if (tutte.length === 0) return null

        const righe = tutte.map(item => {
          const tag = item.tipo === 'contabilita' ? '[CTB] ' : item.tipo === 'sim' ? '[SIM] ' : ''
          if (item.diff < 0) return { testo: `⛔ ${tag}${item.descrizione.toUpperCase()} — SCADUTO, PROVVEDERE`, scaduta: true }
          if (item.diff === 0) return { testo: `🔴 ${tag}${item.descrizione.toUpperCase()} — SCADE OGGI`, scaduta: false }
          return { testo: `⚠️ ${tag}${item.descrizione.toUpperCase()} — mancano ${item.diff} giorni`, scaduta: false }
        })

        return (
          <div style={{
            background: '#1e0a0a',
            border: '2px solid #ef4444',
            borderRadius: 12,
            padding: '14px 20px',
            marginBottom: 16,
            animation: 'blinkBorder 1s step-start infinite',
            fontWeight: 700,
            fontSize: 14,
            lineHeight: 2
          }}>
            <div style={{ color: '#fca5a5', marginBottom: 4 }}>🔔 AVVISI SCADENZE</div>
            {righe.map((r, i) => (
              <div key={i} style={{ color: r.scaduta ? '#ff4444' : '#fca5a5' }}>{r.testo}</div>
            ))}
          </div>
        )
      })()}
      <div style={{ marginBottom: '15px' }}>
        <button style={primaryButtonBlue} onClick={saveWeeklySnapshot}>
          Salva Periodo
        </button>
      </div>

      <div style={heroGrid}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={heroCard}>
            <div style={heroLabel}>Panoramica mese</div>
            <div style={heroValue}>{formatCurrency(guadagnoCorrente)}</div>
            <div style={{
              ...heroSub,
              fontSize: 26,
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}>
              <span style={{ fontSize: 30 }}>💰</span>
              <span>PROFITTO</span>
            </div>
            <div style={heroMiniRow}>
              <div style={heroMiniBox}>
                <div style={heroMiniLabel}>Cassa di partenza</div>
                <div style={heroMiniValue}>{formatCurrency(basePeriodo)}</div>
              </div>
              <div style={heroMiniBox}>
                <div style={heroMiniLabel}>Spese</div>
                <div style={heroMiniValue}>{formatCurrency(totaleUsciteEsterne)}</div>
              </div>
            </div>
          </div>

          {/* Card Riepilogo Anno */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(56,189,248,0.07), rgba(34,197,94,0.06), rgba(15,23,42,0.96))',
            border: '1px solid rgba(56,189,248,0.18)',
            borderRadius: 22,
            padding: '20px 24px',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 16
          }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, color: '#7dd3fc', marginBottom: 8 }}>Guadagno Anno {new Date().getFullYear()}</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: '#f8fafc', lineHeight: 1 }}>{formatCurrency(guadagnoAnnuo)}</div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 6 }}>Somma profitti periodi chiusi</div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, color: cashFlowAnnuo >= 0 ? '#4ade80' : '#f87171', marginBottom: 8 }}>Cash Flow Anno {new Date().getFullYear()}</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: cashFlowAnnuo >= 0 ? '#4ade80' : '#f87171', lineHeight: 1 }}>{formatCurrency(cashFlowAnnuo)}</div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 6 }}>Variazione netta cassa</div>
            </div>
          </div>

          <div style={{ marginTop: 20 }}>
            <div style={{
              fontSize: 14,
              color: '#94a3b8',
              marginBottom: 10,
              letterSpacing: '1px'
            }}>
              ACCESSO RAPIDO
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 12
            }}>

              {[
                { name: 'A.d.P.', url: 'https://accademiadelprofitto.com/matcher/#/matcher' },

                { name: 'Bet365', url: 'https://bet365.it/#/HO/' },
                { name: 'Sisal', url: 'https://www.sisal.it' },
                { name: 'Eurobet', url: 'https://www.eurobet.it/it/' },
                { name: 'Snai', url: 'https://www.snai.it/home' },
                { name: 'Lottomatica', url: 'https://www.lottomatica.it' },
                { name: 'Planetwin365', url: 'https://www.planetwin365.it/scommesse/sport/' },
                { name: 'PokerStars', url: 'https://www.pokerstars.it' },
                { name: 'DaznBet', url: 'https://www.daznbet.it' },
                { name: 'Eplay24', url: 'https://www.eplay24.it' },
                { name: 'NetBet', url: 'https://www.netbet.it' },
                { name: 'QuiGioco', url: 'https://www.quigioco.it' },
                { name: 'Tradingview', url: 'https://it.tradingview.com/chart/QfJdmqCy/?symbol=OANDA%3AXAUUSD' },
                { name: 'Broker Ultima', url: 'https://myaccount.ultimamarkets.com/login' },
                { name: 'Dutching', url: 'https://www.giochinazionali.com/scommesse-online/scommesse-sicure-calcolatore/' }

              ].map((item, i) => (
                <div
                  key={i}
                  onClick={() => window.open(item.url, '_blank')}
                  style={{
                    background: '#020617',
                    border: '1px solid #1e293b',
                    borderRadius: 12,
                    padding: '12px 10px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    transition: '0.2s',
                    fontWeight: 600,
                    color: '#e2e8f0'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.border = '1px solid #38bdf8'
                    e.currentTarget.style.transform = 'translateY(-2px)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.border = '1px solid #1e293b'
                    e.currentTarget.style.transform = 'translateY(0px)'
                  }}
                >
                  {item.name}
                </div>
              ))}

            </div>
          </div>

          <div style={{ marginTop: 20 }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: 10, flexWrap: 'wrap', gap: 8
            }}>
              <div style={{ fontSize: 14, color: '#94a3b8', letterSpacing: '1px' }}>GRAFICO MERCATI</div>
              <select
                value={dashChartSymbol}
                onChange={(e) => setDashChartSymbol(e.target.value)}
                style={{
                  background: '#020617', border: '1px solid #1e293b', borderRadius: 8,
                  color: '#e2e8f0', fontSize: 12, padding: '6px 8px'
                }}
              >
                {DASH_CHART_ASSETS.map(a => (
                  <option key={a.symbol} value={a.symbol}>{a.label}</option>
                ))}
              </select>
            </div>
            <div style={{
              border: '1px solid #1e293b', borderRadius: 12, overflow: 'hidden', background: '#020617'
            }}>
              <TradingViewChart symbol={dashChartSymbol} height={420} showEma={false} />
            </div>
          </div>
        </div>

        <div style={heroSideGrid}>
          <div style={{
            ...panel,
            ...(accantonamentiAvvisiCount > 0 ? { border: '1px solid rgba(239,68,68,0.4)' } : {}),
            cursor: 'pointer'
          }} onClick={goToAccantonamenti}>
            <div style={panelHeader}>
              <div>
                <h2 style={panelTitle}>Accantonamenti</h2>
                <p style={panelSubtitle}>Royalty, club, stipendi, Michela — clicca per il dettaglio</p>
              </div>
              {accantonamentiAvvisiCount > 0 && (
                <div style={{
                  fontSize: 11, fontWeight: 800, color: '#fca5a5', background: 'rgba(239,68,68,0.15)',
                  border: '1px solid rgba(239,68,68,0.4)', borderRadius: 999, padding: '3px 9px'
                }}>
                  {accantonamentiAvvisiCount} da pagare
                </div>
              )}
            </div>

            <div style={{ fontSize: 26, fontWeight: 800, color: '#f8fafc' }}>
              {formatCurrency(accantonamentiTotale)}
            </div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 6 }}>
              totale accantonato/da accantonare questo mese
            </div>
          </div>


          <div style={panel}>
            <div style={panelHeader}>
              <div>
                <h2 style={panelTitle}>Risparmi Samu e Massi</h2>
              </div>
            </div>

            <div style={{ position: 'relative' }}>
              <input
                value={Number(risparmiSamuMassi || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'}
                onChange={(e) => {
                  setDashboardSettings(prev => ({ ...prev, risparmi_samu_massi: parseEuroInput(e.target.value) }))
                }}
                onFocus={(e) => {
                  e.target.value = Number(risparmiSamuMassi ?? 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
                }}
                onBlur={(e) => {
                  updateDashboardSetting('risparmi_samu_massi', e.target.value)
                  const num = parseEuroInput(e.target.value)
                  if (!Number.isNaN(num)) {
                    e.target.value = num.toLocaleString('it-IT', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    }) + ' €'
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    updateDashboardSetting('risparmi_samu_massi', e.target.value)
                    const num = parseEuroInput(e.target.value)
                    if (!Number.isNaN(num)) {
                      e.target.value = num.toLocaleString('it-IT', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      }) + ' €'
                    }
                    e.target.blur()
                  }

                  if (e.key === 'Escape') {
                    e.target.value = Number(risparmiSamuMassi || 0).toLocaleString('it-IT', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    }) + ' €'
                    e.target.blur()
                  }
                }}
                style={{
                  ...input,
                  fontSize: 26,
                  fontWeight: 800,
                  paddingRight: 45
                }}
              />
            </div>
          </div>

          <StatCard
            label='Cassa attuale'
            value={formatCurrency(totaleCassa)}
            sub={`Books ${formatCurrency(totaleBooks)} · Wallets ${formatCurrency(totaleWallets)}`}
            accent='#f59e0b'
          />

          <StatCard
            label='Prelievo del mese'
            value={formatCurrency(prelievoDelMese)}
            sub={`Letto da Stime di Cassa · ${currentMonthLabel()}`}
            accent='#ef4444'
          />

          <StatCard
            label='Spese programmate anno'
            value={formatCurrency(totaleSpeseProgrammateAnno)}
            sub={`Tutte le voci "previsto" del ${new Date().getFullYear()}`}
            accent='#f97316'
          />

          <StatCard
            label='Media mensile residua'
            value={formatCurrency(mediaMensileResidua)}
            sub={`Su ${12 - meseCorrenteNum + 1} mesi rimanenti (mese corrente incluso) · obiettivo minimo`}
            accent='#a855f7'
          />

          <StatCard
            label='Cassa disponibile'
            value={formatCurrency(cassaDisponibile)}
            sub='Cassa attuale - prelievo - royalty - risparmi'
            accent='#22c55e'
          />
        </div>
      </div>

      <div style={dashboardGrid}>
        <div style={panel}>
          <div style={panelHeader}>
            <div>
              <h2 style={panelTitle}>Andamento Profitti - Cassa </h2>
              <p style={panelSubtitle}>Profitto nel tempo</p>
            </div>
          </div>

          <div style={{ width: '100%', height: 260, marginTop: '10px' }}>
            <ResponsiveContainer>
              <LineChart data={weeklyChartData}>
                <XAxis dataKey="name" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#020617',
                    border: '1px solid #1e293b',
                    borderRadius: '10px',
                    color: '#e2e8f0'
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="profit"
                  stroke={weeklyProfitColor}
                  strokeWidth={3}
                  dot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="totalCash"
                  stroke="#38bdf8"
                  strokeWidth={3}
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div style={panel}>
          <div style={panelHeader}><div><h2 style={panelTitle}>Top books</h2><p style={panelSubtitle}>I book più carichi adesso</p></div></div>
          <div style={stackList}>{topBooks.map((book, index) => <div key={book.id} style={rankRow}><div style={rankBadge}>{index + 1}</div><div style={rankMain}><div style={miniRowTitle}>{book.nome}</div><div style={miniRowSub}>{book.intestatario || '-'}</div></div><div style={rankValue}>{formatCurrency(book.saldo)}</div></div>)}</div>
        </div>

        <div style={panel}>
          <div style={panelHeader}><div><h2 style={panelTitle}>Top wallets</h2><p style={panelSubtitle}>I wallet più carichi adesso</p></div></div>
          <div style={stackList}>{topWallets.map((wallet, index) => <div key={wallet.id} style={rankRow}><div style={rankBadge}>{index + 1}</div><div style={rankMain}><div style={miniRowTitle}>{wallet.nome}</div><div style={miniRowSub}>{wallet.intestatario || '-'}</div></div><div style={rankValue}>{formatCurrency(wallet.saldo)}</div></div>)}</div>
        </div>
      </div>

      <div style={panel}>
        <div style={panelHeader}><div><h2 style={panelTitle}>Ultime transazioni</h2><p style={panelSubtitle}>La dashboard adesso ha un po' più di anima</p></div></div>
        <div style={tableWrap}>
          <table style={table}><thead><tr><th style={th}>Data</th><th style={th}>Tipo</th><th style={th}>Importo</th><th style={th}>Riferimento</th></tr></thead><tbody>
            {ultimeTransazioni.map((tx) => <tr key={tx.id} style={tr}><td style={td}>{formatDate(tx.data)}</td><td style={td}><span style={badge(tx.tipo)}>{tx.tipo || '-'}</span></td><td style={td}>{formatCurrency(tx.importo)}</td><td style={td}>{tx.riferimento || '-'}</td></tr>)}
          </tbody></table>
        </div>
      </div>
    </div>
  )
}
