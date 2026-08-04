import React from 'react'
import { supabase } from '../profit-tracker/supabaseClient'
import {
  tabContent, panel, panelHeader, panelTitle, panelSubtitle, secondaryButton,
  tinyBlueButton, filterRow, filterInput, tableWrap, table, th, tr, td, tdStrong,
} from './styles'

export default function SmsTab({
  isActive,
  smsCaricato,
  smsClienti,
  setSmsClienti,
  smsFiltroCliente,
  setSmsFiltroCliente,
  smsFiltroDa,
  setSmsFiltroDa,
  smsFiltroDal,
  setSmsFiltroDal,
  smsFiltroAl,
  setSmsFiltroAl,
  setSmsNuovi,
  setShowSmsPopup,
  smsSelezionato,
  setSmsSelezionato,
}) {
  return (
    <>
      {/* TAB SMS */}
      {isActive && (
      <div style={tabContent}>
        <div style={panel}>
          <div style={panelHeader}>
            <div>
              <h2 style={panelTitle}>📱 Archivio SMS</h2>
              <p style={panelSubtitle}>{!smsCaricato ? '⏳ Caricamento...' : `${smsClienti.length} messaggi totali`}</p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={secondaryButton} onClick={async () => {
                const { data } = await supabase.from('sms_clienti').select('*').order('data_ricezione', { ascending: false }).limit(500)
                if (data) setSmsClienti(data)
              }}>🔄 Aggiorna</button>
              <button style={tinyBlueButton} onClick={() => {
                const ultimaVista = localStorage.getItem('smsUltimaVista')
                const ieri = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
                const ultimaData = ultimaVista ? new Date(Number(ultimaVista)).toISOString() : ieri
                const nuovi = smsClienti.filter(s => s.data_ricezione && s.data_ricezione > ultimaData)
                if (nuovi.length > 0) {
                  setSmsNuovi(nuovi)
                  setShowSmsPopup(true)
                } else {
                  alert('Nessun nuovo SMS nelle ultime 24 ore')
                }
              }}>🔔 Controlla ora</button>
            </div>
          </div>
          <div style={filterRow}>
            <input style={filterInput} placeholder='Filtra per cliente...' value={smsFiltroCliente} onChange={e => setSmsFiltroCliente(e.target.value)} />
            <input style={filterInput} placeholder='Filtra per mittente...' value={smsFiltroDa} onChange={e => setSmsFiltroDa(e.target.value)} />
            <input type='date' style={filterInput} value={smsFiltroDal} onChange={e => setSmsFiltroDal(e.target.value)} />
            <input type='date' style={filterInput} value={smsFiltroAl} onChange={e => setSmsFiltroAl(e.target.value)} />
            <button style={secondaryButton} onClick={() => { setSmsFiltroCliente(''); setSmsFiltroDa(''); setSmsFiltroDal(''); setSmsFiltroAl('') }}>Reset</button>
          </div>
          <div style={tableWrap}>
            <table style={table}>
              <thead>
                <tr>
                  <th style={th}>Data</th>
                  <th style={th}>Cliente</th>
                  <th style={th}>Tipo</th>
                  <th style={th}>Mittente</th>
                  <th style={th}>Testo</th>
                </tr>
              </thead>
              <tbody>
                {smsClienti
                  .filter(sms => {
                    const clienteMatch = !smsFiltroCliente || (sms.cliente || '').toLowerCase().includes(smsFiltroCliente.toLowerCase())
                    const daMatch = !smsFiltroDa || (sms.mittente || '').toLowerCase().includes(smsFiltroDa.toLowerCase())
                    const dalMatch = !smsFiltroDal || (sms.data_ricezione && sms.data_ricezione >= smsFiltroDal)
                    const alMatch = !smsFiltroAl || (sms.data_ricezione && sms.data_ricezione <= smsFiltroAl + 'T23:59:59')
                    return clienteMatch && daMatch && dalMatch && alMatch
                  })
                  .map(sms => (
                    <tr key={sms.id} style={{ ...tr, cursor: 'pointer' }} onClick={() => setSmsSelezionato(sms)}>
                      <td style={{ ...td, whiteSpace: 'nowrap', fontSize: 12, color: '#94a3b8' }}>{sms.data_ricezione ? new Date(sms.data_ricezione).toLocaleString('it-IT') : '-'}</td>
                      <td style={tdStrong}>{sms.cliente || sms.telefono || '-'}</td>
                      <td style={td}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 6, background: sms.tipo === 'OTP' ? 'rgba(239,68,68,0.15)' : 'rgba(56,189,248,0.12)', color: sms.tipo === 'OTP' ? '#f87171' : '#38bdf8' }}>{sms.tipo || 'GENERICO'}</span>
                      </td>
                      <td style={{ ...td, color: '#94a3b8' }}>{sms.mittente || '-'}</td>
                      <td style={{ ...td, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#94a3b8', fontSize: 12 }}>{sms.testo || '-'}</td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>
      )}

      {/* POPUP DETTAGLIO SMS */}
      {smsSelezionato && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(2,6,23,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000, padding: 16 }}
          onClick={() => setSmsSelezionato(null)}>
          <div style={{ width: '100%', maxWidth: 540, background: 'linear-gradient(180deg,rgba(15,23,42,0.99),rgba(2,6,23,1))', border: '2px solid rgba(56,189,248,0.4)', borderRadius: 22, padding: 24 }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 6, background: smsSelezionato.tipo === 'OTP' ? 'rgba(239,68,68,0.15)' : 'rgba(56,189,248,0.12)', color: smsSelezionato.tipo === 'OTP' ? '#f87171' : '#38bdf8' }}>{smsSelezionato.tipo || 'GENERICO'}</span>
                  <span style={{ fontWeight: 800, color: '#f8fafc', fontSize: 15 }}>{smsSelezionato.cliente || smsSelezionato.telefono}</span>
                </div>
                <div style={{ color: '#94a3b8', fontSize: 13 }}>Da: {smsSelezionato.mittente}</div>
                <div style={{ color: '#64748b', fontSize: 12, marginTop: 2 }}>{smsSelezionato.data_ricezione ? new Date(smsSelezionato.data_ricezione).toLocaleString('it-IT') : ''}</div>
              </div>
              <button style={{ border: '1px solid rgba(71,85,105,0.95)', background: 'rgba(15,23,42,0.82)', color: '#e2e8f0', width: 38, height: 38, borderRadius: 12, cursor: 'pointer', fontSize: 18, flexShrink: 0 }}
                onClick={() => setSmsSelezionato(null)}>×</button>
            </div>
            <div style={{ background: 'rgba(11,18,32,0.8)', border: '1px solid rgba(51,65,85,0.6)', borderRadius: 12, padding: 16, color: '#e2e8f0', fontSize: 15, lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word', minHeight: 80 }}>
              {smsSelezionato.testo || 'Nessun testo'}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <button style={{ padding: '10px 22px', borderRadius: 12, border: 'none', background: '#38bdf8', color: '#0f172a', cursor: 'pointer', fontSize: 13, fontWeight: 800 }}
                onClick={() => setSmsSelezionato(null)}>Chiudi</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
