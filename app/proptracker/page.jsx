'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const COLORS = {
  dark: '#0D1117', panel: '#161B22', accent: '#F0B429',
  green: '#2EA043', red: '#DA3633', blue: '#388BFD',
  text: '#E6EDF3', muted: '#8B949E', input: '#1C2128',
  border: '#30363D', orange: '#E8622A'
}

const s = {
  page: { minHeight: '100vh', background: COLORS.dark, color: COLORS.text, fontFamily: 'Arial, sans-serif', padding: '24px' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' },
  title: { fontSize: '24px', fontWeight: 'bold', color: COLORS.accent, display: 'flex', alignItems: 'center', gap: '10px' },
  btn: (bg, fc='#000') => ({ background: bg, color: fc, border: 'none', borderRadius: '8px', padding: '10px 20px', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px' }),
  card: { background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: '12px', padding: '20px', marginBottom: '16px' },
  input: { background: COLORS.input, border: `1px solid ${COLORS.border}`, borderRadius: '6px', padding: '8px 12px', color: COLORS.text, fontSize: '14px', width: '100%', boxSizing: 'border-box' },
  label: { fontSize: '12px', color: COLORS.muted, marginBottom: '4px', display: 'block' },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' },
  grid3: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' },
  badge: (color) => ({ background: color + '22', color: color, border: `1px solid ${color}`, borderRadius: '20px', padding: '3px 10px', fontSize: '12px', fontWeight: 'bold' }),
  row: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
}

const STATO_COLORS = {
  attiva: COLORS.green, completata: COLORS.blue,
  bruciata: COLORS.red, archiviata: COLORS.muted
}

const DEFAULT_FORM = {
  nome: '', prop_firm: '', saldo_iniziale: 1000, fee_challenge: 39,
  profitto_target: 50, puntata_prop_default: 10, quota_prop_default: 2.00,
  quota_book_default: 2.00, perdita_max_pct: 0.15, drawdown_giornaliero_pct: 0.10,
  target_fase1_pct: 0.25, target_fase2_pct: 0.19, puntate_fase1: 17, puntate_fase2: 13, aggressivita_pct: 50
}

export default function PropTrackerPage() {
  const router = useRouter()
  const [challenges, setChallenges] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(DEFAULT_FORM)
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState('attiva')

  useEffect(() => {
    // AuthGuard
    if (typeof window !== 'undefined' && !localStorage.getItem('site_unlocked')) {
      router.push('/login')
      return
    }
    loadChallenges()
  }, [filter])

  async function loadChallenges() {
    setLoading(true)
    let q = supabase.from('prop_challenges_summary').select('*').order('created_at', { ascending: false })
    if (filter !== 'tutte') q = q.eq('stato', filter)
    const { data, error } = await q
    if (!error) setChallenges(data || [])
    setLoading(false)
  }

  async function saveChallenge() {
    if (!form.nome) return alert('Inserisci un nome per la challenge')
    setSaving(true)
    // Converti percentuali: se utente scrive 15 → 0.15, se scrive 0.15 → 0.15
    const pct = (v) => { const n = parseFloat(v); return n > 1 ? n / 100 : n }
    const payload = {
      ...form,
      perdita_max_pct: pct(form.perdita_max_pct),
      drawdown_giornaliero_pct: pct(form.drawdown_giornaliero_pct),
      target_fase1_pct: pct(form.target_fase1_pct),
      target_fase2_pct: pct(form.target_fase2_pct),
    }
    const { error } = await supabase.from('prop_challenges').insert([payload])
    setSaving(false)
    if (error) { alert('Errore: ' + error.message); return }
    setShowForm(false)
    setForm(DEFAULT_FORM)
    loadChallenges()
  }

  async function archiviaChallenge(id, e) {
    e.stopPropagation()
    await supabase.from('prop_challenges').update({ stato: 'archiviata' }).eq('id', id)
    loadChallenges()
  }

  const targetBook = (f) => parseFloat(f.fee_challenge || 0) + parseFloat(f.profitto_target || 0)

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <div style={s.title}>
          🎯 Prop Tracker
          <span style={{ fontSize: '14px', color: COLORS.muted, fontWeight: 'normal' }}>
            — gestione challenge prop firm
          </span>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button style={s.btn(COLORS.panel, COLORS.text)} onClick={() => router.push('/')}>← Home</button>
          <button style={s.btn(COLORS.accent)} onClick={() => setShowForm(true)}>+ Nuova Challenge</button>
        </div>
      </div>

      {/* Filtri */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        {['attiva','completata','bruciata','archiviata','tutte'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            style={{ ...s.btn(filter === f ? COLORS.accent : COLORS.panel, filter === f ? '#000' : COLORS.muted), textTransform: 'capitalize', fontSize: '13px' }}>
            {f}
          </button>
        ))}
      </div>

      {/* Form nuova challenge */}
      {showForm && (
        <div style={{ ...s.card, border: `1px solid ${COLORS.accent}`, marginBottom: '24px' }}>
          <div style={{ ...s.row, marginBottom: '20px' }}>
            <span style={{ fontSize: '16px', fontWeight: 'bold', color: COLORS.accent }}>⚙ Nuova Challenge</span>
            <button style={s.btn(COLORS.panel, COLORS.muted)} onClick={() => setShowForm(false)}>✕</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            {[['nome','Nome challenge *','text'],['prop_firm','Prop Firm','text']].map(([k,l,t]) => (
              <div key={k}>
                <label style={s.label}>{l}</label>
                <input style={s.input} type={t} value={form[k]} onChange={e => setForm({...form, [k]: e.target.value})} />
              </div>
            ))}
          </div>

          <div style={{ fontSize: '12px', color: COLORS.accent, fontWeight: 'bold', marginBottom: '10px' }}>PARAMETRI PROP</div>
          <div style={{ ...s.grid3, marginBottom: '16px' }}>
            {[
              ['saldo_iniziale','Saldo iniziale (€)'],['fee_challenge','Fee challenge (€)'],
              ['profitto_target','Profitto (€)'],['puntata_prop_default','Puntata prop default (€)'],
              ['quota_prop_default','Quota prop default'],['quota_book_default','Quota book default'],
            ].map(([k,l]) => (
              <div key={k}>
                <label style={s.label}>{l}</label>
                <input style={s.input} type="text" value={form[k]} onChange={e => setForm({...form, [k]: e.target.value})} />
              </div>
            ))}
          </div>

          <div style={{ fontSize: '12px', color: COLORS.accent, fontWeight: 'bold', marginBottom: '10px' }}>LIMITI & FASI</div>
          <div style={{ ...s.grid3, marginBottom: '16px' }}>
            {[
              ['puntate_fase1','Puntate Fase 1'],['puntate_fase2','Puntate Fase 2'],
              ['perdita_max_pct','Perdita max %'],['drawdown_giornaliero_pct','DD giornaliero %'],
              ['target_fase1_pct','Target Fase 1 %'],['target_fase2_pct','Target Fase 2 %'],['aggressivita_pct','Aggressività % (10-100)'],
            ].map(([k,l]) => (
              <div key={k}>
                <label style={s.label}>{l}</label>
                <input style={s.input} type="text" value={form[k]} onChange={e => setForm({...form, [k]: e.target.value})} />
              </div>
            ))}
          </div>

          {/* Preview target */}
          <div style={{ background: '#1A2A0A', border: `1px solid ${COLORS.green}`, borderRadius: '8px', padding: '12px', marginBottom: '16px', display: 'flex', gap: '24px' }}>
            <span style={{ color: COLORS.muted, fontSize: '13px' }}>📌 Target book totale:</span>
            <span style={{ color: COLORS.accent, fontWeight: 'bold', fontSize: '16px' }}>€{targetBook(form).toFixed(2)}</span>
            <span style={{ color: COLORS.muted, fontSize: '13px' }}>(fee €{form.fee_challenge} + profitto €{form.profitto_target})</span>
          </div>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button style={s.btn(COLORS.panel, COLORS.muted)} onClick={() => setShowForm(false)}>Annulla</button>
            <button style={s.btn(COLORS.accent)} onClick={saveChallenge} disabled={saving}>
              {saving ? 'Salvataggio...' : '✓ Crea Challenge'}
            </button>
          </div>
        </div>
      )}

      {/* Lista challenges */}
      {loading ? (
        <div style={{ textAlign: 'center', color: COLORS.muted, padding: '40px' }}>Caricamento...</div>
      ) : challenges.length === 0 ? (
        <div style={{ textAlign: 'center', color: COLORS.muted, padding: '60px' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>🎯</div>
          <div>Nessuna challenge {filter !== 'tutte' ? filter : ''}. Creane una nuova!</div>
        </div>
      ) : (
        challenges.map(c => (
          <div key={c.id} style={{ ...s.card, cursor: 'pointer', transition: 'border-color 0.2s' }}
            onClick={() => router.push(`/proptracker/${c.id}`)}
            onMouseEnter={e => e.currentTarget.style.borderColor = COLORS.accent}
            onMouseLeave={e => e.currentTarget.style.borderColor = COLORS.border}>

            <div style={{ ...s.row, marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '17px', fontWeight: 'bold', color: COLORS.text }}>{c.nome}</span>
                {c.prop_firm && <span style={{ color: COLORS.muted, fontSize: '13px' }}>{c.prop_firm}</span>}
                <span style={s.badge(STATO_COLORS[c.stato] || COLORS.muted)}>{c.stato}</span>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {c.stato === 'attiva' && (
                  <button style={s.btn(COLORS.panel, COLORS.muted)} onClick={e => archiviaChallenge(c.id, e)}>
                    Archivia
                  </button>
                )}
                <button style={s.btn(COLORS.accent)} onClick={e => { e.stopPropagation(); router.push(`/proptracker/${c.id}`) }}>
                  Apri →
                </button>
              </div>
            </div>

            {/* KPI row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px' }}>
              {[
                ['Saldo iniziale', `€${parseFloat(c.saldo_iniziale).toLocaleString('it-IT', {minimumFractionDigits:2})}`, COLORS.text],
                ['Target book', `€${(parseFloat(c.fee_challenge)+parseFloat(c.profitto_target)).toFixed(2)}`, COLORS.accent],
                ['P&L book attuale', c.pnl_book_attuale != null ? `€${parseFloat(c.pnl_book_attuale).toFixed(2)}` : '—',
                  c.pnl_book_attuale >= 0 ? COLORS.green : COLORS.red],
                ['Operazioni', `${c.nr_operazioni || 0} / ${parseInt(c.puntate_fase1)+parseInt(c.puntate_fase2)}`, COLORS.muted],
                ['V/L prop', `${c.vittorie_prop || 0}W / ${c.perdite_prop || 0}L`, COLORS.text],
              ].map(([label, val, color]) => (
                <div key={label} style={{ background: COLORS.input, borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', color: COLORS.muted, marginBottom: '4px' }}>{label}</div>
                  <div style={{ fontSize: '15px', fontWeight: 'bold', color }}>{val}</div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
