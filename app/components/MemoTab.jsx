import React from 'react'
import {
  tabContent, sectionTopBar, sectionTitle, sectionDescription, panel, panelHeader,
  panelTitle, panelSubtitle, input, primaryButtonGreen, tableWrap, tableLarge, th,
  tr, td, tdStrong, filterInput, table, thActions, tdActions, tinyGreenButton,
  tinyRedButton,
} from './styles'

export default function MemoTab({
  formatCurrency,
  // Note prossimo anno
  memoForm,
  setMemoForm,
  addMemoFutureNote,
  memoFutureNotes,
  updateMemoFutureNote,
  deleteMemoFutureNote,
}) {
  return (
    <div style={tabContent}>
      <div style={sectionTopBar}>
        <div>
          <h2 style={sectionTitle}>Memo</h2>
          <p style={sectionDescription}>Promemoria e scadenze · royalty nella tab Clienti, risparmi Samu e Massi in Accantonamenti</p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={panel}>
          <div style={panelHeader}>
            <div>
              <h2 style={panelTitle}>Note prossimo anno</h2>
              <p style={panelSubtitle}>Scadenze e cose da ricordare</p>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 2fr auto auto', gap: 8, marginBottom: 16, alignItems: 'end' }}>
            <div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>Data reale</div>
              <input type='date' value={memoForm.data_reale} onChange={e => setMemoForm({ ...memoForm, data_reale: e.target.value })} style={{ ...filterInput, width: '100%' }} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>Testo data (es. "gen. 2027")</div>
              <input value={memoForm.data_testo} onChange={e => setMemoForm({ ...memoForm, data_testo: e.target.value })} placeholder='Opzionale' style={{ ...filterInput, width: '100%' }} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>Importo €</div>
              <input value={memoForm.importo} onChange={e => setMemoForm({ ...memoForm, importo: e.target.value })} placeholder='0' style={{ ...filterInput, width: '100%' }} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>Descrizione</div>
              <input value={memoForm.descrizione} onChange={e => setMemoForm({ ...memoForm, descrizione: e.target.value })} placeholder='Es. Assicurazione auto...' style={{ ...filterInput, width: '100%' }} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>Colore</div>
              <select value={memoForm.colore} onChange={e => setMemoForm({ ...memoForm, colore: e.target.value })} style={{ ...filterInput, width: '100%' }}>
                <option value='normal'>Normale</option>
                <option value='red'>Rosso</option>
              </select>
            </div>
            <button type='button' style={{ ...tinyGreenButton, alignSelf: 'flex-end' }} onClick={addMemoFutureNote}>+ Aggiungi</button>
          </div>
          <div style={tableWrap}>
            <table style={table}>
              <thead>
                <tr>
                  <th style={{ ...th, minWidth: 160 }}>Data</th>
                  <th style={{ ...th, minWidth: 110 }}>Importo</th>
                  <th style={{ ...th, minWidth: 260 }}>Descrizione</th>
                  <th style={{ ...th, minWidth: 100 }}>Gg mancanti</th>
                  <th style={{ ...thActions, minWidth: 130 }}>Azioni</th>
                </tr>
              </thead>
              <tbody>
                {memoFutureNotes.length === 0 ? (
                  <tr style={tr}><td style={td} colSpan={5}>Nessuna memo</td></tr>
                ) : (
                  memoFutureNotes.map((row) => {
                    const oggi = new Date()
                    const dataReale = row.data_reale ? new Date(row.data_reale + 'T00:00:00') : null
                    const giorni = dataReale ? Math.ceil((dataReale - oggi) / (1000 * 60 * 60 * 24)) : null
                    const vicina = giorni !== null && giorni >= 0 && giorni <= 30
                    return (
                      <tr key={row.id} style={tr}>
                        <td style={td}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <input type='date' defaultValue={row.data_reale || ''} onBlur={e => updateMemoFutureNote(row.id, 'data_reale', e.target.value || null)}
                              style={{ background: '#0b1220', color: '#f8fafc', border: '1px solid rgba(51,65,85,0.9)', borderRadius: 8, padding: '4px 6px', fontSize: 12, width: '100%', minWidth: 140 }} />
                            <input defaultValue={row.data_testo || ''} onBlur={e => updateMemoFutureNote(row.id, 'data_testo', e.target.value)}
                              placeholder='Testo data' style={{ background: '#0b1220', color: '#94a3b8', border: '1px solid rgba(51,65,85,0.9)', borderRadius: 8, padding: '4px 6px', fontSize: 11, width: '100%' }} />
                          </div>
                        </td>
                        <td style={td}>
                          <input defaultValue={row.importo || ''} onBlur={e => updateMemoFutureNote(row.id, 'importo', Number(e.target.value) || 0)}
                            placeholder='0' style={{ background: '#0b1220', color: '#f8fafc', border: '1px solid rgba(51,65,85,0.9)', borderRadius: 8, padding: '4px 6px', fontSize: 13, width: 100 }} />
                        </td>
                        <td style={td}>
                          <input defaultValue={row.descrizione || ''} onBlur={e => updateMemoFutureNote(row.id, 'descrizione', e.target.value)}
                            style={{ background: '#0b1220', color: row.colore === 'red' ? '#f87171' : '#e2e8f0', border: '1px solid rgba(51,65,85,0.9)', borderRadius: 8, padding: '4px 6px', fontSize: 13, width: '100%', fontWeight: row.colore === 'red' ? 800 : 400, minWidth: 240 }} />
                        </td>
                        <td style={{ ...td, color: vicina ? '#f97316' : '#94a3b8', fontWeight: vicina ? 800 : 400 }}>
                          {giorni === null ? '-' : giorni < 0 ? 'Scaduta' : giorni === 0 ? '⚠️ Oggi!' : `${giorni} gg`}
                        </td>
                        <td style={tdActions}>
                          <div style={{ display: 'flex', gap: 6, flexDirection: 'column' }}>
                            <select defaultValue={row.colore || 'normal'} onChange={e => updateMemoFutureNote(row.id, 'colore', e.target.value)}
                              style={{ background: '#0b1220', color: '#f8fafc', border: '1px solid rgba(51,65,85,0.9)', borderRadius: 8, padding: '4px 6px', fontSize: 11 }}>
                              <option value='normal'>Normale</option>
                              <option value='red'>Rosso</option>
                            </select>
                            <button style={{ ...tinyRedButton, background: '#16a34a', marginBottom: 4 }} onClick={() => deleteMemoFutureNote(row.id)}>✅ Fatto</button>
                            <button style={tinyRedButton} onClick={() => deleteMemoFutureNote(row.id)}>Elimina</button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  )
}
