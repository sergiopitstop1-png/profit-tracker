import React from 'react'
import {
  tabContent, panel, panelHeader, panelTitle, panelSubtitle, input,
} from './styles'

const grid2 = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
  gap: 16,
}

function BigValue({ children }) {
  return <div style={{ fontSize: 26, fontWeight: 800, color: '#f8fafc' }}>{children}</div>
}

function SubNote({ children }) {
  return <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 6 }}>{children}</div>
}

// Riga di avviso "da pagare" con pulsante per segnare fatto, usata da Figlio/Paolo/Michela.
function AvvisiRate({ label, rate, onPagato }) {
  if (!rate || rate.length === 0) return null
  return (
    <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
      {rate.map((rata) => (
        <div key={rata.key} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.35)',
          borderRadius: 8, padding: '6px 10px',
        }}>
          <span style={{ fontSize: 12, color: '#fca5a5', fontWeight: 700 }}>
            ⚠️ PAGARE {label.toUpperCase()} · {formatCurrencyFallback(rata.amount)} ({rata.label})
          </span>
          <button
            onClick={() => onPagato(rata.key)}
            style={{
              fontSize: 11, fontWeight: 700, color: '#4ade80', background: 'rgba(34,197,94,0.12)',
              border: '1px solid rgba(74,222,128,0.4)', borderRadius: 6, padding: '3px 8px', cursor: 'pointer',
            }}
          >
            ✓ Pagato
          </button>
        </div>
      ))}
    </div>
  )
}

// Fallback minimale usato solo dentro AvvisiRate se per qualche motivo formatCurrency non arriva come prop.
function formatCurrencyFallback(n) {
  return Number(n || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

// Riga compatta di importi modificabili (es. "g.1: [325] €  g.9: [325] €  ...").
function RateEditor({ rate, updateDashboardSetting }) {
  return (
    <div style={{ fontSize: 11, color: '#4b5568', marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 10 }}>
      {rate.map((r) => (
        <div key={r.key} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span>{r.label}:</span>
          <input
            defaultValue={Number(r.value || 0)}
            onBlur={(e) => {
              const num = Number(String(e.target.value).replace(',', '.'))
              if (!Number.isNaN(num) && num >= 0) {
                updateDashboardSetting(r.settingKey, String(num))
              } else {
                e.target.value = Number(r.value || 0)
              }
            }}
            onKeyDown={(ev) => { if (ev.key === 'Enter') ev.target.blur() }}
            style={{
              width: 50, background: 'transparent', border: 'none', borderBottom: '1px dashed #334155',
              color: '#6b7490', fontSize: 11, padding: '0 2px', outline: 'none',
            }}
          />
          <span>€</span>
        </div>
      ))}
    </div>
  )
}

export default function AccantonamentiTab({
  formatCurrency,
  updateDashboardSetting,
  toggleAccantonamentoPagato,
  togglePaoloAttivo,
  meseCorrenteNum,

  accantonamentoRoyalty,
  mediaMensileRoyalty,
  royaltyTotale2026,
  royaltyPagato2026,

  accantonamentoClub,
  mediaMensileClub,
  meseCicloClub,
  rinnovoClubAnnuo,

  accantonamentoFiglio,
  totaleMensileFiglio,
  giornoFiglio,
  figlioG1, figlioG7, figlioG13, figlioG20, figlioG27,
  rateFiglioDaPagare,

  paoloAttivo,
  accantonamentoPaolo,
  totaleMensilePaolo,
  paoloR15, paoloR30,
  ratePaoloDaPagare,

  accantonamentoMichela,
  totaleMensileMichela,
  michelaR1, michelaR9, michelaR17, michelaR24,
  rateMichelaDaPagare,

  accantonamentoAntonello,
  meseCicloAntonello,
  antonelloImporto,
  antonelloDaPagare,

  accantonamentiTotale,
}) {
  const fmt = formatCurrency || formatCurrencyFallback

  return (
    <div style={tabContent}>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ color: '#f8fafc', fontSize: 22, fontWeight: 900, marginBottom: 4 }}>Accantonamenti</h1>
        <p style={{ color: '#94a3b8', fontSize: 13 }}>
          Royalty, rinnovo club, stipendio figlio, Paolo e Michela — {fmt(accantonamentiTotale)} accantonati/da accantonare questo mese in totale.
        </p>
      </div>

      <div style={grid2}>

        {/* ROYALTY */}
        <div style={panel}>
          <div style={panelHeader}>
            <div>
              <h2 style={panelTitle}>Royalty</h2>
              <p style={panelSubtitle}>Gli importi per persona si modificano nel tab Memo → Royalty</p>
            </div>
          </div>
          <BigValue>{fmt(accantonamentoRoyalty)}</BigValue>
          <SubNote>
            {fmt(mediaMensileRoyalty)} × {meseCorrenteNum} mesi · totale anno {fmt(royaltyTotale2026)} · pagato {fmt(royaltyPagato2026)}
          </SubNote>
        </div>

        {/* CLUB */}
        <div style={panel}>
          <div style={panelHeader}>
            <div>
              <h2 style={panelTitle}>Rinnovo club</h2>
              <p style={panelSubtitle}>Scade 30/9 · ciclo ottobre → settembre</p>
            </div>
          </div>
          <BigValue>{fmt(accantonamentoClub)}</BigValue>
          <SubNote>
            {fmt(mediaMensileClub)} × {meseCicloClub} mesi
          </SubNote>
          <div style={{ fontSize: 11, color: '#4b5568', marginTop: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
            <span>Costo rinnovo annuo:</span>
            <input
              defaultValue={Number(rinnovoClubAnnuo || 3500)}
              onBlur={(e) => {
                const num = Number(String(e.target.value).replace(',', '.'))
                if (!Number.isNaN(num) && num > 0) {
                  updateDashboardSetting('rinnovo_club_annuo', String(num))
                } else {
                  e.target.value = Number(rinnovoClubAnnuo || 3500)
                }
              }}
              onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur() }}
              style={{
                width: 60, background: 'transparent', border: 'none', borderBottom: '1px dashed #334155',
                color: '#6b7490', fontSize: 11, padding: '0 2px', outline: 'none',
              }}
            />
            <span>€/anno</span>
          </div>
        </div>

        {/* FIGLIO */}
        <div style={panel}>
          <div style={panelHeader}>
            <div>
              <h2 style={panelTitle}>Stipendio figlio</h2>
              <p style={panelSubtitle}>Giorni 2 · 7 · 13 · 20 · 27</p>
            </div>
          </div>
          <BigValue>{fmt(totaleMensileFiglio - accantonamentoFiglio)}</BigValue>
          <SubNote>ancora da pagare questo mese (su {fmt(totaleMensileFiglio)}) · aggiornato al giorno {giornoFiglio}</SubNote>
          <AvvisiRate label="figlio" rate={rateFiglioDaPagare} onPagato={toggleAccantonamentoPagato} />
          <RateEditor
            updateDashboardSetting={updateDashboardSetting}
            rate={[
              { key: 'f1', settingKey: 'figlio_g1', label: 'g.2', value: figlioG1 },
              { key: 'f7', settingKey: 'figlio_g7', label: 'g.7', value: figlioG7 },
              { key: 'f13', settingKey: 'figlio_g13', label: 'g.13', value: figlioG13 },
              { key: 'f20', settingKey: 'figlio_g20', label: 'g.20', value: figlioG20 },
              { key: 'f27', settingKey: 'figlio_g27', label: 'g.27', value: figlioG27 },
            ]}
          />
        </div>

        {/* PAOLO */}
        <div style={{ ...panel, opacity: paoloAttivo ? 1 : 0.6 }}>
          <div style={panelHeader}>
            <div>
              <h2 style={panelTitle}>Paolo (collaboratore)</h2>
              <p style={panelSubtitle}>Bisettimanale · giorni 15 e 30</p>
            </div>
            <button
              onClick={togglePaoloAttivo}
              style={{
                fontSize: 11, fontWeight: 800, borderRadius: 999, padding: '4px 10px', cursor: 'pointer',
                color: paoloAttivo ? '#4ade80' : '#94a3b8',
                background: paoloAttivo ? 'rgba(34,197,94,0.12)' : 'rgba(148,163,184,0.12)',
                border: `1px solid ${paoloAttivo ? 'rgba(74,222,128,0.4)' : 'rgba(148,163,184,0.35)'}`,
              }}
            >
              {paoloAttivo ? '● ATTIVO' : '○ NON ATTIVO'}
            </button>
          </div>
          {paoloAttivo ? (
            <>
              <BigValue>{fmt(totaleMensilePaolo - accantonamentoPaolo)}</BigValue>
              <SubNote>ancora da pagare questo mese (su {fmt(totaleMensilePaolo)})</SubNote>
              <AvvisiRate label="Paolo" rate={ratePaoloDaPagare} onPagato={toggleAccantonamentoPagato} />
            </>
          ) : (
            <SubNote>Non ancora operativo — attivalo quando inizia a lavorare, l'accantonamento partirà da quel momento.</SubNote>
          )}
          <RateEditor
            updateDashboardSetting={updateDashboardSetting}
            rate={[
              { key: 'p15', settingKey: 'paolo_r15', label: 'g.15', value: paoloR15 },
              { key: 'p30', settingKey: 'paolo_r30', label: 'g.30', value: paoloR30 },
            ]}
          />
        </div>

        {/* MICHELA */}
        <div style={panel}>
          <div style={panelHeader}>
            <div>
              <h2 style={panelTitle}>Michela (spese di casa)</h2>
              <p style={panelSubtitle}>Giorni 1 · 9 · 17 · 24</p>
            </div>
          </div>
          <BigValue>{fmt(totaleMensileMichela - accantonamentoMichela)}</BigValue>
          <SubNote>ancora da pagare questo mese (su {fmt(totaleMensileMichela)})</SubNote>
          <AvvisiRate label="Michela" rate={rateMichelaDaPagare} onPagato={toggleAccantonamentoPagato} />
          <RateEditor
            updateDashboardSetting={updateDashboardSetting}
            rate={[
              { key: 'm1', settingKey: 'michela_r1', label: 'g.1', value: michelaR1 },
              { key: 'm9', settingKey: 'michela_r9', label: 'g.9', value: michelaR9 },
              { key: 'm17', settingKey: 'michela_r17', label: 'g.17', value: michelaR17 },
              { key: 'm24', settingKey: 'michela_r24', label: 'g.24', value: michelaR24 },
            ]}
          />
        </div>

        {/* ANTONELLO */}
        <div style={{ ...panel, opacity: meseCicloAntonello > 0 ? 1 : 0.6 }}>
          <div style={panelHeader}>
            <div>
              <h2 style={panelTitle}>Antonello</h2>
              <p style={panelSubtitle}>1.050€ ogni 3 mesi (ott→dic, gen→mar, apr→giu) · finisce dopo giu 2027</p>
            </div>
          </div>
          {meseCicloAntonello > 0 ? (
            <>
              <BigValue>{fmt(accantonamentoAntonello)}</BigValue>
              <SubNote>
                {fmt(antonelloImporto / 3)} × {meseCicloAntonello} mesi del ciclo trimestrale in corso
              </SubNote>
              <AvvisiRate label="Antonello" rate={antonelloDaPagare} onPagato={toggleAccantonamentoPagato} />
            </>
          ) : (
            <SubNote>Ciclo non attivo (fuori dal periodo ott 2026 → giu 2027, oppure contratto concluso).</SubNote>
          )}
          <div style={{ fontSize: 11, color: '#4b5568', marginTop: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
            <span>Importo trimestrale:</span>
            <input
              defaultValue={Number(antonelloImporto || 1050)}
              onBlur={(e) => {
                const num = Number(String(e.target.value).replace(',', '.'))
                if (!Number.isNaN(num) && num > 0) {
                  updateDashboardSetting('antonello_importo_trimestrale', String(num))
                } else {
                  e.target.value = Number(antonelloImporto || 1050)
                }
              }}
              onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur() }}
              style={{
                width: 60, background: 'transparent', border: 'none', borderBottom: '1px dashed #334155',
                color: '#6b7490', fontSize: 11, padding: '0 2px', outline: 'none'
              }}
            />
            <span>€/trimestre</span>
          </div>
        </div>

      </div>
    </div>
  )
}
