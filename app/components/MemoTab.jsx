import React from 'react'
import {
  tabContent, sectionTopBar, sectionTitle, sectionDescription, panel, panelHeader,
  panelTitle, panelSubtitle, input, primaryButtonGreen, tableWrap, tableLarge, th,
  tr, td, tdStrong, filterInput, table, thActions, tdActions, tinyGreenButton,
  tinyRedButton,
} from './styles'

export default function MemoTab({
  // Royalty
  newAccountName,
  setNewAccountName,
  addRoyaltyAccount,
  memoRoyaltyEntries,
  mediaMensileRoyalty,
  memoRoyaltyAccounts,
  upsertRoyaltyEntry,
  updateRoyaltyEntry,
  formatCurrency,
  // Note prossimo anno
  memoForm,
  setMemoForm,
  addMemoFutureNote,
  memoFutureNotes,
  updateMemoFutureNote,
  deleteMemoFutureNote,
  // Risparmi Massimiliano/Samuele
  memoSavingsRows,
  savingsFormMassi,
  setSavingsFormMassi,
  savingsFormSamu,
  setSavingsFormSamu,
  addSavingsRow,
}) {
  return (
    <div style={tabContent}>
      <div style={sectionTopBar}>
        <div>
          <h2 style={sectionTitle}>Memo</h2>
          <p style={sectionDescription}>Royalty, risparmi ragazzi e promemoria futuri</p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={panel}>
          <div style={panelHeader}>
            <div>
              <h2 style={panelTitle}>Royalty</h2>
              <p style={panelSubtitle}>Dettaglio per account, anno e stato</p>
              <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'flex-start' }}>
                <input
                  value={newAccountName}
                  onChange={(e) => setNewAccountName(e.target.value)}
                  placeholder='Nuovo account'
                  style={{ ...input, marginBottom: 0 }}
                />
                <button
                  type='button'
                  onClick={addRoyaltyAccount}
                  style={primaryButtonGreen}
                >
                  + Aggiungi
                </button>
              </div>
            </div>
          </div>
          <div style={{ marginTop: 10, display: 'flex', gap: 12 }}>
            <div style={{
              padding: '6px 10px',
              border: '1px solid #334155',
              borderRadius: 6,
              color: '#38bdf8',
              fontWeight: 700
            }}>
              Totale: {
                formatCurrency(
                  memoRoyaltyEntries
                    .reduce((sum, r) => sum + Number(r.importo || 0), 0)
                )
              }
            </div>

            <div style={{
              padding: '6px 10px',
              border: '1px solid #334155',
              borderRadius: 6,
              color: '#22c55e',
              fontWeight: 700
            }}>
              Media mese: {formatCurrency(mediaMensileRoyalty)}
            </div>
          </div>

          <div style={tableWrap}>
            <table style={tableLarge}>
              <thead>
                <tr>
                  <th style={th}>Account</th>
                  <th style={th}>2022</th>
                  <th style={th}>2023</th>
                  <th style={th}>2024</th>
                  <th style={th}>2025</th>
                  <th style={th}>2026</th>
                  <th style={th}>2027</th>
                  <th style={th}>2028</th>
                  <th style={th}>2029</th>
                  <th style={th}>2030</th>
                  <th style={th}>Totale</th>
                </tr>
              </thead>
              <tbody>
                {memoRoyaltyAccounts.map((account) => {
                  const rows = memoRoyaltyEntries.filter(
                    (r) => Number(r.account_id) === Number(account.id)
                  )

                  const byYear = (year) =>
                    rows.filter((r) => Number(r.anno) === year && Number(r.importo || 0) !== 0)

                  const total = rows.reduce((sum, r) => sum + Number(r.importo || 0), 0)
                  const royaltyYears = [2022, 2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030]

                  const renderYearCell = (year) => {
                    const items = byYear(year)

                    if (items.length === 0) {
                      if (year >= 2026) {
                        return (
                          <input
                            defaultValue=''
                            placeholder='0'
                            onBlur={(e) => {
                              const v = Number(e.target.value)
                              if (!v) return
                              upsertRoyaltyEntry(account.id, year, v)
                            }}
                            style={{
                              width: '100%',
                              background: 'transparent',
                              border: '1px solid #334155',
                              borderRadius: 6,
                              padding: '4px 6px',
                              color: '#f8fafc',
                              fontWeight: 800
                            }}
                          />
                        )
                      }

                      return <span style={{ color: '#64748b' }}>-</span>
                    }

                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {items.map((item) => (
                          <div key={item.id} style={{ lineHeight: 1.25 }}>
                            {year >= 2026 ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                <input
                                  defaultValue={item.importo ?? 0}
                                  onBlur={(e) => {
                                    const v = Number(e.target.value)
                                    if (!isNaN(v)) updateRoyaltyEntry(item.id, 'importo', v)
                                  }}
                                  style={{
                                    width: '100%',
                                    background: 'transparent',
                                    border: '1px solid #334155',
                                    borderRadius: 6,
                                    padding: '4px 6px',
                                    color: '#f8fafc',
                                    fontWeight: 800
                                  }}
                                />
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <span style={{ fontSize: 11, color: '#94a3b8' }}>Pagato:</span>
                                  <input
                                    defaultValue={item.pagato ?? 0}
                                    onBlur={(e) => {
                                      const v = Number(e.target.value)
                                      if (!isNaN(v)) updateRoyaltyEntry(item.id, 'pagato', v)
                                    }}
                                    style={{
                                      width: '100%',
                                      background: 'transparent',
                                      border: '1px solid #22c55e',
                                      borderRadius: 6,
                                      padding: '4px 6px',
                                      color: '#4ade80',
                                      fontWeight: 800,
                                      fontSize: 12
                                    }}
                                  />
                                </div>
                              </div>
                            ) : (
                              <div style={{ fontWeight: 800, color: '#f8fafc' }}>
                                {formatCurrency(item.importo)}
                              </div>
                            )}
                            <div style={{ fontSize: 12, color: '#94a3b8' }}>
                              {item.mese || '-'}
                            </div>
                            <div
                              style={{
                                fontSize: 12,
                                color:
                                  String(item.nota || '').toLowerCase().includes('da pagare')
                                    ? '#f87171'
                                    : String(item.nota || '').toLowerCase().includes('pagato')
                                    ? '#4ade80'
                                    : '#cbd5e1',
                                fontWeight: 700
                              }}
                            >
                              {item.nota || '-'}
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  }

                  return (
                    <tr key={account.id} style={tr}>
                      <td style={tdStrong}>{account.nome}</td>
                      {royaltyYears.map((year) => (
                        <td key={year} style={td}>{renderYearCell(year)}</td>
                      ))}
                      <td style={tdStrong}>{total === 0 ? '-' : formatCurrency(total)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

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

        {['massimiliano', 'samuele'].map(persona => {
          const rows = memoSavingsRows
            .filter(r => r.persona === persona)
            .sort((a, b) => a.ordine - b.ordine)
          const ultimoMontante = rows.length > 0 ? Number(rows[rows.length - 1].montante || 0) : 0
          const nome = persona === 'massimiliano' ? 'Massimiliano' : 'Samuele'
          return (
            <div key={persona} style={panel}>
              <div style={panelHeader}>
                <div>
                  <h2 style={panelTitle}>Risparmi {nome}</h2>
                  <p style={panelSubtitle}>Montante attuale: <strong style={{ color: '#4ade80' }}>{formatCurrency(ultimoMontante)}</strong></p>
                </div>
              </div>

              <div style={tableWrap}>
                <table style={table}>
                  <thead>
                    <tr>
                      <th style={th}>Periodo</th>
                      <th style={th}>Causale</th>
                      <th style={th}>Versamento</th>
                      <th style={th}>Interessi 1%</th>
                      <th style={th}>Montante</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr key={row.id} style={{
                        ...tr,
                        background: i === rows.length - 1 ? 'rgba(34,197,94,0.08)' : undefined
                      }}>
                        <td style={td}>{row.periodo}</td>
                        <td style={{ ...td, color: '#94a3b8', fontSize: 12 }}>{row.causale || '-'}</td>
                        <td style={{ ...td, color: Number(row.versamento) >= 0 ? '#4ade80' : '#f87171', fontWeight: 800 }}>
                          {Number(row.versamento) >= 0 ? '+' : ''}{formatCurrency(row.versamento)}
                        </td>
                        <td style={{ ...td, color: '#94a3b8' }}>{formatCurrency(row.interesse)}</td>
                        <td style={tdStrong}>{formatCurrency(row.montante)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ marginTop: 16, display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>Periodo</div>
                  <input
                    placeholder='es. apr-26'
                    value={persona === 'massimiliano' ? savingsFormMassi.periodo : savingsFormSamu.periodo}
                    onChange={e => persona === 'massimiliano'
                      ? setSavingsFormMassi(prev => ({ ...prev, periodo: e.target.value }))
                      : setSavingsFormSamu(prev => ({ ...prev, periodo: e.target.value }))
                    }
                    style={{ ...filterInput, width: 100 }}
                  />
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>Versamento (- per prelievo)</div>
                  <input
                    placeholder='es. 200 o -150'
                    value={persona === 'massimiliano' ? savingsFormMassi.versamento : savingsFormSamu.versamento}
                    onChange={e => persona === 'massimiliano'
                      ? setSavingsFormMassi(prev => ({ ...prev, versamento: e.target.value }))
                      : setSavingsFormSamu(prev => ({ ...prev, versamento: e.target.value }))
                    }
                    style={{ ...filterInput, width: 150 }}
                  />
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>Causale (opzionale)</div>
                  <input
                    placeholder='es. regalo, prelievo...'
                    value={persona === 'massimiliano' ? savingsFormMassi.causale : savingsFormSamu.causale}
                    onChange={e => persona === 'massimiliano'
                      ? setSavingsFormMassi(prev => ({ ...prev, causale: e.target.value }))
                      : setSavingsFormSamu(prev => ({ ...prev, causale: e.target.value }))
                    }
                    style={{ ...filterInput, width: 160 }}
                  />
                </div>
                <button
                  style={tinyGreenButton}
                  onClick={async () => {
                    const form = persona === 'massimiliano' ? savingsFormMassi : savingsFormSamu
                    if (!form.periodo || !form.versamento) return
                    await addSavingsRow(persona, form.periodo, form.versamento, form.causale)
                    persona === 'massimiliano'
                      ? setSavingsFormMassi({ periodo: '', versamento: '', causale: '' })
                      : setSavingsFormSamu({ periodo: '', versamento: '', causale: '' })
                  }}
                >
                  + Aggiungi
                </button>
              </div>
            </div>
          )
        })}

        <div style={panel}>
          <div style={panelHeader}>
            <div>
              <h2 style={panelTitle}>Memo libere</h2>
              <p style={panelSubtitle}>Appunti veloci e promemoria sparsi</p>
            </div>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 16
          }}>
            <div style={{
              border: '1px solid rgba(56,189,248,0.35)',
              background: 'rgba(56,189,248,0.08)',
              borderRadius: 16,
              padding: 16,
              minHeight: 120,
              color: '#e2e8f0',
              fontWeight: 700
            }}>
              Box memo 1
            </div>

            <div style={{
              border: '1px solid rgba(56,189,248,0.35)',
              background: 'rgba(56,189,248,0.08)',
              borderRadius: 16,
              padding: 16,
              minHeight: 120,
              color: '#e2e8f0',
              fontWeight: 700
            }}>
              Box memo 2
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
