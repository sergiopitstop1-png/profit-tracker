"use client";
import React, { useEffect, useMemo, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { supabase } from '../profit-tracker/supabaseClient'
const BASE_CASSA_MESE = 57229.62

export default function ProfitTrackerClient() {
  const formatMonthKey = (date = new Date()) => {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    return `${y}-${m}`
  }
  const [activeTab, setActiveTab] = useState('dashboard')
  const [books, setBooks] = useState([])
  const [wallets, setWallets] = useState([])
  const [sessionToken, setSessionToken] = useState(null)
  const [userId, setUserId] = useState(null)
  const [accessDenied, setAccessDenied] = useState('')
  const [userEmail, setUserEmail] = useState('')
  const [transactions, setTransactions] = useState([])
  const [contabilita, setContabilita] = useState([])
const [weeklySnapshots, setWeeklySnapshots] = useState([])
const [monthlySnapshots, setMonthlySnapshots] = useState([])
const [stimeCassa, setStimeCassa] = useState([])

const [stimeFilters, setStimeFilters] = useState({
  anno: new Date().getFullYear(),
  mese: new Date().getMonth() + 1
})

const [stimaForm, setStimaForm] = useState({
  anno: new Date().getFullYear(),
  mese: new Date().getMonth() + 1,
  voce: '',
  importo: '',
  stato: '',
  note: '',
  ordine: 0
})
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  const [showBookModal, setShowBookModal] = useState(false)
  const [showWalletModal, setShowWalletModal] = useState(false)
  const [showAdjustSaldoModal, setShowAdjustSaldoModal] = useState(false)
  const [showAdjustWalletSaldoModal, setShowAdjustWalletSaldoModal] = useState(false)
  const [showQuickBookTxModal, setShowQuickBookTxModal] = useState(false)

  const [selectedBook, setSelectedBook] = useState(null)
  const [selectedWallet, setSelectedWallet] = useState(null)
  const [bookForm, setBookForm] = useState({ nome: '', intestatario: '', saldo: '', note: '' })
  const [walletForm, setWalletForm] = useState({ nome: '', intestatario: '', saldo: '', note: '' })
  const [adjustSaldoForm, setAdjustSaldoForm] = useState({ nuovo_saldo: '', note: '' })
  const [adjustWalletSaldoForm, setAdjustWalletSaldoForm] = useState({ nuovo_saldo: '', note: '' })
  const [quickBookTxForm, setQuickBookTxForm] = useState({ tipo: 'versa', wallet_id: '', importo: '', note: '' })
  const [txForm, setTxForm] = useState({ tipo: '', da_tipo: '', importo: '', da_id: '', a_id: '', note: '' })

  const [bookFilters, setBookFilters] = useState({ nome: '', intestatario: '', saldoMin: '', saldoMax: '' })
  const [walletFilters, setWalletFilters] = useState({ nome: '', intestatario: '', saldoMin: '', saldoMax: '' })
  const [txFilters, setTxFilters] = useState({ tipo: '', azione: '', testo: '', importoMin: '', importoMax: '' })

  useEffect(() => {
  initSession()
  loadData()
}, [])

async function initSession() {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return

  setUserId(user.id)
  setUserEmail((user.email || '').toLowerCase())

  const token = crypto.randomUUID()
  setSessionToken(token)

  await supabase.from("user_sessions").insert([
  {
    user_id: user.id,
    user_email: user.email,
    session_token: token,
    status: "online",
    page: "profit-tracker",
    user_agent: navigator.userAgent
  }
])
}

async function updateActivity() {
  if (!sessionToken) return

  await supabase
    .from("user_sessions")
    .update({
      last_seen_at: new Date().toISOString()
    })
    .eq("session_token", sessionToken)
}

async function logAction({ action, entity, entity_id = null, old_value = null, new_value = null }) {
  if (!userId || !sessionToken) return

  const {
    data: { user },
  } = await supabase.auth.getUser()

  await supabase.from("audit_logs").insert([
    {
      user_id: userId,
      user_email: user?.email || null,
      session_token: sessionToken,
      action,
      entity,
      entity_id,
      old_value,
      new_value,
      page: "profit-tracker"
    }
  ])
}

useEffect(() => {
  if (!sessionToken) return

  const interval = setInterval(() => {
    updateActivity()
  }, 30000)

  return () => clearInterval(interval)
}, [sessionToken])

  async function loadData({ preserveMessages = false } = {}) {
    setLoading(true)
    if (!preserveMessages) {
      setMessage('')
      setErrorMessage('')
    }

   const [booksRes, walletsRes, txRes, contRes, weeklyRes, monthlyRes, stimeRes] = await Promise.all([
      supabase.from('books').select('*').order('id', { ascending: true }),
      supabase.from('wallets').select('*').order('id', { ascending: true }),
      supabase.from('transactions').select('*').order('data', { ascending: false }),
      supabase.from('contabilita').select('*').order('data_movimento', { ascending: false }),
  supabase.from('weekly_snapshots').select('*').order('snapshot_date', { ascending: true }),
  supabase.from('monthly_snapshots').select('*').order('snapshot_month', { ascending: true }),
     supabase.from('stime_cassa').select('*')
  .order('anno', { ascending: true })
  .order('mese', { ascending: true })
  .order('ordine', { ascending: true })
  .order('id', { ascending: true }),
    ])

    const errors = []
    if (booksRes.error) errors.push('books'); else setBooks(booksRes.data || [])
    if (walletsRes.error) errors.push('wallets'); else setWallets(walletsRes.data || [])
    if (txRes.error) errors.push('transactions'); else setTransactions(txRes.data || [])
    if (contRes.error) errors.push('contabilita'); else setContabilita(contRes.data || [])
if (weeklyRes.error) errors.push('weekly_snapshots'); else setWeeklySnapshots(weeklyRes.data || [])
if (monthlyRes.error) errors.push('monthly_snapshots'); else setMonthlySnapshots(monthlyRes.data || [])
   if (stimeRes.error) errors.push('stime_cassa'); else setStimeCassa(stimeRes.data || []) 

    if (errors.length) setErrorMessage(`Errore caricamento: ${errors.join(', ')}`)
    setLoading(false)
  }
  const saveWeeklySnapshot = async () => {
    try {
      const snapshotDate = new Date().toISOString().split('T')[0]

      const totalCash =
  books.reduce((sum, b) => sum + Number(b.saldo || 0), 0) +
  wallets.reduce((sum, w) => sum + Number(w.saldo || 0), 0)

      const externalWithdrawals = transactions
        .filter(t => t.azione === 'wallet_to_external')
        .reduce((sum, t) => sum + Number(t.importo || 0), 0)

      const baseCashMonth = BASE_CASSA_MESE
      const profit = totalCash + externalWithdrawals - baseCashMonth

      const { error } = await supabase
        .from('weekly_snapshots')
        .upsert(
          [{
            snapshot_date: snapshotDate,
            total_cash: totalCash,
            external_withdrawals: externalWithdrawals,
            base_cash_month: baseCashMonth,
            profit: profit
          }],
          { onConflict: 'snapshot_date' }
        )

      if (error) throw error

      alert('Snapshot settimanale salvato')
      loadData()

    } catch (err) {
      console.error('Errore snapshot:', err)
      alert('Errore nel salvataggio')
    }
  }
const weeklyChartData = useMemo(() => {
  return weeklySnapshots.map(item => ({
    name: new Date(item.snapshot_date).toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit'
    }),
    profit: Number(item.profit || 0),
    totalCash: Number(item.total_cash || 0)
  }))
}, [weeklySnapshots])

const weeklyProfitColor =
  weeklyChartData.length > 0 &&
  weeklyChartData[weeklyChartData.length - 1].profit < 0
    ? '#ef4444'
    : '#22c55e'
const canViewStimeCassa = userEmail === 'sergiopitstop1@gmail.com'
function normalizeOwner(value) {
  return String(value || '').trim().toLowerCase()
}

function isSameOwner(a, b) {
  return normalizeOwner(a) === normalizeOwner(b)
}

 function formatCurrency(value) {
  const num = parseFloat(value)

  if (isNaN(num)) return '0,00 €'

  const parts = num.toFixed(2).split('.')
  const integer = parts[0]
  const decimal = parts[1]

  const withDots = integer.replace(/\B(?=(\d{3})+(?!\d))/g, '.')

  return `${withDots},${decimal} €`
}

  function formatDate(value) {
    if (!value) return '-'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return date.toLocaleString('it-IT')
  }

  function currentMonthLabel(dateValue = new Date()) {
    const date = new Date(dateValue)
    if (Number.isNaN(date.getTime())) return ''
    return date.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })
  }

  function getEntityLabel(item) {
    return `${item.nome} — ${item.intestatario || 'Senza intestatario'} (${formatCurrency(item.saldo)})`
  }

  function getNoteColor(note) {
    if (!note) return '#94a3b8'
    const n = String(note).toLowerCase()
    if (n.includes('chiuso')) return '#ef4444'
    if (n.includes('limitato bonus')) return '#ef4444'
    if (n.includes('limitato sport')) return '#facc15'
    return '#f8fafc'
  }

  function resetAdjustSaldoForm(book) {
    setAdjustSaldoForm({ nuovo_saldo: String(book?.saldo ?? ''), note: '' })
  }

  function resetAdjustWalletSaldoForm(wallet) {
  setAdjustWalletSaldoForm({ nuovo_saldo: String(wallet?.saldo ?? ''), note: '' })
  }

  function clearBookFilters() {
    setBookFilters({ nome: '', intestatario: '', saldoMin: '', saldoMax: '' })
  }

  function clearWalletFilters() {
    setWalletFilters({ nome: '', intestatario: '', saldoMin: '', saldoMax: '' })
  }

  function clearTxFilters() {
    setTxFilters({ tipo: '', azione: '', testo: '', importoMin: '', importoMax: '' })
  }

  async function updateNote(table, id, newNote) {
    const { error } = await supabase.from(table).update({ note: newNote }).eq('id', id)
    if (error) setErrorMessage(`Errore aggiornamento note ${table}`)
    else await loadData({ preserveMessages: true })
  }

  async function updateSaldo(table, id, saldo) {
    return supabase.from(table).update({ saldo }).eq('id', id)
  }
async function updateStimaCassa(id, field, value) {
  const { error } = await supabase
    .from('stime_cassa')
    .update({ [field]: value })
    .eq('id', id)

  if (error) {
    setErrorMessage('Errore aggiornamento stima di cassa')
    return
  }

  await loadData({ preserveMessages: true })
}
  async function salvaLogTransazione({ tipo, importo, riferimento, note, azione }) {
    return supabase.from('transactions').insert([{
      tipo,
      importo,
      riferimento,
      note,
      data: new Date().toISOString(),
      azione,
    }])
  }

  async function salvaSpesaGestione({ importo, note, riferimento }) {
    const now = new Date().toISOString()
    return supabase.from('contabilita').insert([{
      mese: currentMonthLabel(now),
      data_movimento: now,
      stato: 'uscita',
      voce: 'spesa gestione',
      categoria: 'gestione',
      importo: Number(importo),
      note: `${riferimento}${note ? ` | ${note}` : ''}`,
    }])
  }

  async function handleDeleteBook(book) {
    setMessage('')
    setErrorMessage('')
    if (Number(book.saldo || 0) !== 0) {
      setErrorMessage('Puoi eliminare un book solo se il saldo è 0')
      return
    }
    const ok = window.confirm(`Eliminare il book ${book.nome}?`)
    if (!ok) return

    const { error } = await supabase.from('books').delete().eq('id', book.id)
if (error) {
  setErrorMessage(`Errore eliminazione book: ${error.message}`)
  return
}

await logAction({
  action: 'DELETE',
  entity: 'book',
  entity_id: String(book.id),
  old_value: book
})

setMessage('Book eliminato correttamente')
await loadData({ preserveMessages: true })
  }

  async function handleDeleteWallet(wallet) {
    setMessage('')
    setErrorMessage('')
    if (Number(wallet.saldo || 0) !== 0) {
      setErrorMessage('Puoi eliminare un wallet solo se il saldo è 0')
      return
    }
    const ok = window.confirm(`Eliminare il wallet ${wallet.nome}?`)
    if (!ok) return

    const { error } = await supabase.from('wallets').delete().eq('id', wallet.id)
if (error) {
  setErrorMessage(`Errore eliminazione wallet: ${error.message}`)
  return
}

await logAction({
  action: 'DELETE',
  entity: 'wallet',
  entity_id: String(wallet.id),
  old_value: wallet
})

setMessage('Wallet eliminato correttamente')
await loadData({ preserveMessages: true })
  }

async function handleDeleteTransaction(tx) {
  setMessage('')
  setErrorMessage('')

  if (
    tx.azione === 'manual_balance_adjustment' ||
    tx.azione === 'manual_balance_adjustment_wallet'
  ) {
    setErrorMessage('Le correzioni saldo non sono eliminabili in sicurezza')
    return
  }

  const ok = window.confirm(
    `Eliminare il movimento ${tx.riferimento}? L'operazione ripristinerà i saldi.`
  )
  if (!ok) return

  const importo = Number(tx.importo || 0)
  const riferimento = String(tx.riferimento || '')

  function parseRefPart(part) {
    const clean = String(part || '').trim()

    if (!clean) return null
    if (clean === 'esterno') return { type: 'external' }

    const pieces = clean.split(':')
    const type = pieces[0] || null
    const id = pieces[1] ? String(pieces[1]).trim() : null
    const nome = pieces[2] ? String(pieces[2]).trim() : null
    const intestatario = pieces.slice(3).join(':').trim() || null

    return {
      raw: clean,
      type,
      id,
      nome,
      intestatario
    }
  }

  const [leftRaw, rightRaw] = riferimento.split('->').map((s) => s?.trim())
  const fromRef = parseRefPart(leftRaw)
  const toRef = parseRefPart(rightRaw)

  function findWallet(ref) {
    if (!ref) return null

    if (ref.id) {
      const byId = wallets.find((w) => String(w.id) === String(ref.id))
      if (byId) return byId
    }

    if (ref.nome && ref.intestatario) {
      const byCombo = wallets.find(
        (w) =>
          String(w.nome || '').trim() === ref.nome &&
          String(w.intestatario || '').trim() === ref.intestatario
      )
      if (byCombo) return byCombo
    }

    if (ref.nome) {
      return wallets.find((w) => String(w.nome || '').trim() === ref.nome) || null
    }

    return null
  }

  function findBook(ref) {
    if (!ref) return null

    if (ref.id) {
      const byId = books.find((b) => String(b.id) === String(ref.id))
      if (byId) return byId
    }

    if (ref.nome && ref.intestatario) {
      const byCombo = books.find(
        (b) =>
          String(b.nome || '').trim() === ref.nome &&
          String(b.intestatario || '').trim() === ref.intestatario
      )
      if (byCombo) return byCombo
    }

    if (ref.nome) {
      return books.find((b) => String(b.nome || '').trim() === ref.nome) || null
    }

    return null
  }

  async function runWithRetry(fn, label, retries = 3) {
    let lastError

    for (let i = 0; i < retries; i++) {
      try {
        const result = await fn()

        if (result?.error) {
          throw new Error(`${label}: ${result.error.message}`)
        }

        return result
      } catch (error) {
        lastError = error
        if (i < retries - 1) {
          await new Promise((resolve) => setTimeout(resolve, 500))
        }
      }
    }

    throw lastError
  }

  try {
    if (tx.azione === 'wallet_to_book') {
      const wallet = findWallet(fromRef)
      const book = findBook(toRef)

      if (!wallet || !book) {
        throw new Error('Wallet o book non trovato per il rollback')
      }
      if (Number(book.saldo || 0) < importo) {
        throw new Error('Saldo book insufficiente per annullare il movimento')
      }

      await runWithRetry(
        () => updateSaldo('books', book.id, Number(book.saldo) - importo),
        'Rollback saldo book'
      )

      await runWithRetry(
        () => updateSaldo('wallets', wallet.id, Number(wallet.saldo) + importo),
        'Rollback saldo wallet'
      )
    }

    if (tx.azione === 'book_to_wallet') {
      const book = findBook(fromRef)
      const wallet = findWallet(toRef)

      if (!wallet || !book) {
        throw new Error('Book o wallet non trovato per il rollback')
      }
      if (Number(wallet.saldo || 0) < importo) {
        throw new Error('Saldo wallet insufficiente per annullare il movimento')
      }

      await runWithRetry(
        () => updateSaldo('wallets', wallet.id, Number(wallet.saldo) - importo),
        'Rollback saldo wallet'
      )

      await runWithRetry(
        () => updateSaldo('books', book.id, Number(book.saldo) + importo),
        'Rollback saldo book'
      )
    }

    if (tx.azione === 'wallet_to_wallet') {
      const fromWallet = findWallet(fromRef)
      const toWallet = findWallet(toRef)

      if (!fromWallet || !toWallet) {
        throw new Error('Wallet non trovato per il rollback')
      }
      if (Number(toWallet.saldo || 0) < importo) {
        throw new Error('Saldo wallet destinazione insufficiente per annullare il movimento')
      }

      await runWithRetry(
        () => updateSaldo('wallets', toWallet.id, Number(toWallet.saldo) - importo),
        'Rollback saldo wallet destinazione'
      )

      await runWithRetry(
        () => updateSaldo('wallets', fromWallet.id, Number(fromWallet.saldo) + importo),
        'Rollback saldo wallet origine'
      )
    }

    if (tx.azione === 'wallet_to_external') {
      const wallet = findWallet(fromRef)

      if (!wallet) {
        throw new Error('Wallet non trovato per il rollback')
      }

      await runWithRetry(
        () => updateSaldo('wallets', wallet.id, Number(wallet.saldo) + importo),
        'Rollback saldo wallet'
      )

      const contMatch = contabilita.find(
        (row) =>
          String(row.note || '').includes(riferimento) &&
          Number(row.importo || 0) === importo
      )

      if (contMatch) {
        await runWithRetry(
          () => supabase.from('contabilita').delete().eq('id', contMatch.id),
          'Eliminazione contabilità collegata'
        )
      }
    }

    await runWithRetry(
      () => supabase.from('transactions').delete().eq('id', tx.id),
      'Eliminazione transazione'
    )

    await logAction({
      action: 'DELETE',
      entity: 'transaction',
      entity_id: String(tx.id),
      old_value: tx
    })

    setMessage('Movimento eliminato e saldi ripristinati')
    await loadData({ preserveMessages: true })
  } catch (error) {
    setErrorMessage(`Errore eliminazione movimento: ${error.message}`)
  }
}
  function resetTxForm() {
    setTxForm({ tipo: '', da_tipo: '', importo: '', da_id: '', a_id: '', note: '' })
  }

  function openQuickBookTx(book, tipo) {
    setSelectedBook(book)
    setQuickBookTxForm({ tipo, wallet_id: '', importo: '', note: '' })
    setShowQuickBookTxModal(true)
  }

  async function addBook(e) {
    e.preventDefault()
    if (!bookForm.nome.trim() || !bookForm.intestatario.trim() || bookForm.saldo === '') {
      setErrorMessage('Compila tutti i campi obbligatori del book')
      return
    }
    const newBook = {
  nome: bookForm.nome.trim(),
  intestatario: bookForm.intestatario.trim(),
  saldo: Number(bookForm.saldo),
  note: bookForm.note.trim(),
}

const { data, error } = await supabase.from('books').insert([newBook]).select()

if (error) return setErrorMessage('Errore nel salvataggio del book')

await logAction({
  action: 'CREATE',
  entity: 'book',
  entity_id: data?.[0]?.id ? String(data[0].id) : null,
  new_value: newBook
})

setShowBookModal(false)
setBookForm({ nome: '', intestatario: '', saldo: '', note: '' })
setMessage('Book salvato correttamente')
await loadData({ preserveMessages: true })
  }

  async function addWallet(e) {
    e.preventDefault()
    if (!walletForm.nome.trim() || !walletForm.intestatario.trim() || walletForm.saldo === '') {
      setErrorMessage('Compila tutti i campi obbligatori del wallet')
      return
    }
    const newWallet = {
  nome: walletForm.nome.trim(),
  intestatario: walletForm.intestatario.trim(),
  saldo: Number(walletForm.saldo),
  note: walletForm.note.trim(),
}

const { data, error } = await supabase.from('wallets').insert([newWallet]).select()

if (error) return setErrorMessage('Errore nel salvataggio del wallet')

await logAction({
  action: 'CREATE',
  entity: 'wallet',
  entity_id: data?.[0]?.id ? String(data[0].id) : null,
  new_value: newWallet
})

setShowWalletModal(false)
setWalletForm({ nome: '', intestatario: '', saldo: '', note: '' })
setMessage('Wallet salvato correttamente')
await loadData({ preserveMessages: true })
  }

  async function handleAdjustSaldo(e) {
    e.preventDefault()
    if (!selectedBook) return setErrorMessage('Book non selezionato')
    const nuovoSaldo = Number(adjustSaldoForm.nuovo_saldo)
    if (Number.isNaN(nuovoSaldo) || nuovoSaldo < 0) return setErrorMessage('Inserisci un saldo valido')
    if (!adjustSaldoForm.note.trim()) return setErrorMessage('Inserisci una nota per la correzione saldo')

    const saldoPrecedente = Number(selectedBook.saldo || 0)
    const differenza = nuovoSaldo - saldoPrecedente

    let r = await updateSaldo('books', selectedBook.id, nuovoSaldo)
    if (r.error) return setErrorMessage(`Errore correzione saldo: ${r.error.message}`)

    r = await salvaLogTransazione({
      tipo: 'correzione',
      importo: Math.abs(differenza),
      riferimento: `${selectedBook.nome} | ${formatCurrency(saldoPrecedente)} -> ${formatCurrency(nuovoSaldo)}`,
      note: `Correzione saldo manuale. Delta: ${formatCurrency(differenza)}. Motivo: ${adjustSaldoForm.note.trim()}`,
      azione: 'manual_balance_adjustment',
    })
    if (r.error) return setErrorMessage(`Errore correzione saldo: ${r.error.message}`)

    setShowAdjustSaldoModal(false)
    setSelectedBook(null)
    setMessage('Saldo corretto e transazione registrata')
    await loadData({ preserveMessages: true })
  }
async function handleAdjustWalletSaldoPrompt(wallet) {
  setMessage('')
  setErrorMessage('')

  const nuovoSaldoInput = window.prompt(
    `Nuovo saldo per ${wallet.nome}:`,
    String(wallet.saldo ?? 0)
  )
  if (nuovoSaldoInput === null) return

  const nuovoSaldo = Number(String(nuovoSaldoInput).replace(',', '.'))
  if (Number.isNaN(nuovoSaldo) || nuovoSaldo < 0) {
    setErrorMessage('Inserisci un saldo valido')
    return
  }

  const nota = window.prompt('Motivo correzione saldo wallet:')
  if (nota === null || !nota.trim()) {
    setErrorMessage('Inserisci una nota per la correzione saldo')
    return
  }

  const saldoPrecedente = Number(wallet.saldo || 0)
  const differenza = nuovoSaldo - saldoPrecedente

  let r = await updateSaldo('wallets', wallet.id, nuovoSaldo)
  if (r.error) {
    setErrorMessage(`Errore correzione saldo wallet: ${r.error.message}`)
    return
  }

  r = await salvaLogTransazione({
    tipo: 'correzione',
    importo: Math.abs(differenza),
    riferimento: `${wallet.nome} | ${formatCurrency(saldoPrecedente)} -> ${formatCurrency(nuovoSaldo)}`,
    note: `Correzione saldo wallet manuale. Delta: ${formatCurrency(differenza)}. Motivo: ${nota.trim()}`,
    azione: 'manual_balance_adjustment_wallet',
  })
  if (r.error) {
    setErrorMessage(`Errore correzione saldo wallet: ${r.error.message}`)
    return
  }

  setMessage('Saldo wallet corretto e transazione registrata')
  await loadData({ preserveMessages: true })
}
  async function handleAdjustWalletSaldo(e) {
  e.preventDefault()
  if (!selectedWallet) return setErrorMessage('Wallet non selezionato')

  const nuovoSaldo = Number(adjustWalletSaldoForm.nuovo_saldo)
  if (Number.isNaN(nuovoSaldo) || nuovoSaldo < 0) {
    return setErrorMessage('Inserisci un saldo valido')
  }
  if (!adjustWalletSaldoForm.note.trim()) {
    return setErrorMessage('Inserisci una nota per la correzione saldo')
  }

  const saldoPrecedente = Number(selectedWallet.saldo || 0)
  const differenza = nuovoSaldo - saldoPrecedente

  let r = await updateSaldo('wallets', selectedWallet.id, nuovoSaldo)
  if (r.error) return setErrorMessage(`Errore correzione saldo wallet: ${r.error.message}`)

  r = await salvaLogTransazione({
    tipo: 'correzione',
    importo: Math.abs(differenza),
    riferimento: `${selectedWallet.nome} | ${formatCurrency(saldoPrecedente)} -> ${formatCurrency(nuovoSaldo)}`,
    note: `Correzione saldo wallet manuale. Delta: ${formatCurrency(differenza)}. Motivo: ${adjustWalletSaldoForm.note.trim()}`,
    azione: 'manual_balance_adjustment_wallet',
  })
  if (r.error) return setErrorMessage(`Errore correzione saldo wallet: ${r.error.message}`)

  setShowAdjustWalletSaldoModal(false)
  setSelectedWallet(null)
  setMessage('Saldo wallet corretto e transazione registrata')
  await loadData({ preserveMessages: true })
}

  async function handleQuickBookTransaction(e) {
    e.preventDefault()
    if (!selectedBook) return setErrorMessage('Book non selezionato')

    const importo = Number(quickBookTxForm.importo)
    if (!quickBookTxForm.wallet_id) return setErrorMessage('Seleziona un wallet compatibile')
    if (!importo || importo <= 0) return setErrorMessage('Inserisci un importo valido')

    const wallet = wallets.find((w) => String(w.id) === String(quickBookTxForm.wallet_id))
    const book = books.find((b) => String(b.id) === String(selectedBook.id))
    if (!wallet || !book) return setErrorMessage('Wallet o book non trovato')
    if (!isSameOwner(wallet.intestatario, book.intestatario)) return setErrorMessage('Wallet e book hanno intestatari diversi')

    let r
    if (quickBookTxForm.tipo === 'versa') {
      if (Number(wallet.saldo || 0) < importo) return setErrorMessage('Saldo wallet insufficiente')
      r = await updateSaldo('wallets', wallet.id, Number(wallet.saldo) - importo)
      if (r.error) return setErrorMessage(r.error.message)
      r = await updateSaldo('books', book.id, Number(book.saldo) + importo)
      if (r.error) return setErrorMessage(r.error.message)
      r = await salvaLogTransazione({
  tipo: 'versa',
  importo,
  riferimento: `wallet:${wallet.id}:${wallet.nome}:${wallet.intestatario} -> book:${book.id}:${book.nome}:${book.intestatario}`,
  note: quickBookTxForm.note || `Versa rapido da wallet ${wallet.nome} a book ${book.nome}`,
  azione: 'wallet_to_book'
})
      if (r.error) return setErrorMessage(r.error.message)
    } else {
      if (Number(book.saldo || 0) < importo) return setErrorMessage('Saldo book insufficiente')
      r = await updateSaldo('books', book.id, Number(book.saldo) - importo)
      if (r.error) return setErrorMessage(r.error.message)
      r = await updateSaldo('wallets', wallet.id, Number(wallet.saldo) + importo)
      if (r.error) return setErrorMessage(r.error.message)
      r = await salvaLogTransazione({
  tipo: 'preleva',
  importo,
  riferimento: `book:${book.id}:${book.nome}:${book.intestatario} -> wallet:${wallet.id}:${wallet.nome}:${wallet.intestatario}`,
  note: quickBookTxForm.note || `Prelievo rapido da book ${book.nome} a wallet ${wallet.nome}`,
  azione: 'book_to_wallet'
})
      if (r.error) return setErrorMessage(r.error.message)
    }

    setShowQuickBookTxModal(false)
    setSelectedBook(null)
    setMessage('Transazione rapida eseguita correttamente')
    await loadData({ preserveMessages: true })
  }

  function handleTransactionChange(e) {
    const { name, value } = e.target
    setTxForm((prev) => {
      const next = { ...prev, [name]: value }
      if (name === 'tipo') {
        next.da_tipo = ''
        next.da_id = ''
        next.a_id = ''
        next.note = ''
      }
      if (name === 'da_tipo') {
        next.da_id = ''
        next.a_id = ''
      }
      if (name === 'da_id') next.a_id = ''
      return next
    })
  }

  async function handleTransaction(e) {
    e.preventDefault()
    const importo = Number(txForm.importo)
    if (!txForm.tipo) return setErrorMessage('Seleziona il tipo di transazione')
    if (!importo || importo <= 0) return setErrorMessage('Inserisci un importo valido')

    let r
    let auditPayload = null

    if (txForm.tipo === 'versa') {
      if (!txForm.da_id || !txForm.a_id) return setErrorMessage('Seleziona wallet origine e book destinazione')
      const wallet = wallets.find((w) => String(w.id) === String(txForm.da_id))
      const book = books.find((b) => String(b.id) === String(txForm.a_id))
      if (!wallet || !book) return setErrorMessage('Wallet o book non trovato')
      if (!isSameOwner(wallet.intestatario, book.intestatario)) return setErrorMessage('Wallet e book hanno intestatari diversi')
      if (Number(wallet.saldo || 0) < importo) return setErrorMessage('Saldo wallet insufficiente')

      r = await updateSaldo('wallets', wallet.id, Number(wallet.saldo) - importo)
      if (r.error) return setErrorMessage(r.error.message)
      r = await updateSaldo('books', book.id, Number(book.saldo) + importo)
      if (r.error) return setErrorMessage(r.error.message)
      r = await salvaLogTransazione({
  tipo: 'versa',
  importo,
  riferimento: `wallet:${wallet.id}:${wallet.nome}:${wallet.intestatario} -> book:${book.id}:${book.nome}:${book.intestatario}`,
  note: txForm.note || `Versa da wallet ${wallet.nome} a book ${book.nome}`,
  azione: 'wallet_to_book'
})
      if (r.error) return setErrorMessage(r.error.message)
        auditPayload = {
  action: 'CREATE',
  entity: 'transaction',
  new_value: {
    tipo: 'versa',
    azione: 'wallet_to_book',
    importo,
    da: wallet.nome,
    a: book.nome,
    note: txForm.note || ''
  }
}
    }

    if (txForm.tipo === 'preleva') {
      if (txForm.da_tipo === 'book') {
        if (!txForm.da_id || !txForm.a_id) return setErrorMessage('Seleziona book origine e wallet destinazione')
        const book = books.find((b) => String(b.id) === String(txForm.da_id))
        const wallet = wallets.find((w) => String(w.id) === String(txForm.a_id))
        if (!book || !wallet) return setErrorMessage('Book o wallet non trovato')
        if (!isSameOwner(book.intestatario, wallet.intestatario)) return setErrorMessage('Book e wallet hanno intestatari diversi')
        if (Number(book.saldo || 0) < importo) return setErrorMessage('Saldo book insufficiente')

        r = await updateSaldo('books', book.id, Number(book.saldo) - importo)
        if (r.error) return setErrorMessage(r.error.message)
        r = await updateSaldo('wallets', wallet.id, Number(wallet.saldo) + importo)
        if (r.error) return setErrorMessage(r.error.message)
        r = await salvaLogTransazione({
  tipo: 'preleva',
  importo,
  riferimento: `book:${book.id}:${book.nome}:${book.intestatario} -> wallet:${wallet.id}:${wallet.nome}:${wallet.intestatario}`,
  note: txForm.note || `Prelievo da book ${book.nome} a wallet ${wallet.nome}`,
  azione: 'book_to_wallet'
})
        if (r.error) return setErrorMessage(r.error.message)
      }

      if (txForm.da_tipo === 'wallet') {
        if (!txForm.da_id) return setErrorMessage('Seleziona wallet origine')
        const wallet = wallets.find((w) => String(w.id) === String(txForm.da_id))
        if (!wallet) return setErrorMessage('Wallet non trovato')
        if (Number(wallet.saldo || 0) < importo) return setErrorMessage('Saldo wallet insufficiente')

        r = await updateSaldo('wallets', wallet.id, Number(wallet.saldo) - importo)
        if (r.error) return setErrorMessage(r.error.message)
        const riferimento = `wallet:${wallet.id}:${wallet.nome}:${wallet.intestatario} -> esterno`
        r = await salvaLogTransazione({ tipo: 'preleva', importo, riferimento, note: txForm.note || `Prelievo esterno da wallet ${wallet.nome}`, azione: 'wallet_to_external' })
        if (r.error) return setErrorMessage(r.error.message)
        r = await salvaSpesaGestione({ importo, riferimento, note: txForm.note || `Prelievo esterno da wallet ${wallet.nome}` })
        if (r.error) return setErrorMessage(r.error.message)
      }
    }

    if (txForm.tipo === 'trasferisci') {
      if (!txForm.da_id || !txForm.a_id) return setErrorMessage('Seleziona wallet origine e wallet destinazione')
      if (String(txForm.da_id) === String(txForm.a_id)) return setErrorMessage('Origine e destinazione non possono essere uguali')
      const from = wallets.find((w) => String(w.id) === String(txForm.da_id))
      const to = wallets.find((w) => String(w.id) === String(txForm.a_id))
      if (!from || !to) return setErrorMessage('Wallet non trovato')
      if (Number(from.saldo || 0) < importo) return setErrorMessage('Saldo wallet origine insufficiente')

      r = await updateSaldo('wallets', from.id, Number(from.saldo) - importo)
      if (r.error) return setErrorMessage(r.error.message)
      r = await updateSaldo('wallets', to.id, Number(to.saldo) + importo)
      if (r.error) return setErrorMessage(r.error.message)
      r = await salvaLogTransazione({ tipo: 'trasferisci', importo, riferimento: `wallet:${from.id}:${from.nome}:${from.intestatario} -> wallet:${to.id}:${to.nome}:${to.intestatario}`, note: txForm.note || `Trasferimento da wallet ${from.nome} a wallet ${to.nome}`, azione: 'wallet_to_wallet' })
      if (r.error) return setErrorMessage(r.error.message)
    }
if (auditPayload) {
  await logAction(auditPayload)
}

    resetTxForm()
    setMessage('Transazione eseguita correttamente')
    await loadData({ preserveMessages: true })
  }

  const walletsCompatibiliQuick = useMemo(() => {
    if (!selectedBook) return []
    return wallets.filter((wallet) => isSameOwner(wallet.intestatario, selectedBook.intestatario))
  }, [wallets, selectedBook])

  const totaleBooks = useMemo(() => books.reduce((t, b) => t + Number(b.saldo || 0), 0), [books])
  const totaleWallets = useMemo(() => wallets.reduce((t, w) => t + Number(w.saldo || 0), 0), [wallets])
  const totaleCassa = totaleBooks + totaleWallets
  const ultimoSnapshot = weeklySnapshots.length > 0
  ? weeklySnapshots[weeklySnapshots.length - 1]
  : null

const basePeriodo = ultimoSnapshot
  ? Number(ultimoSnapshot.total_cash)
  : BASE_CASSA_MESE

const totalePrelieviEsterniStorici = useMemo(() =>
  transactions
    .filter(tx => tx.azione === 'wallet_to_external')
    .reduce((t, tx) => t + Number(tx.importo || 0), 0)
, [transactions])

const totaleUsciteEsterne = ultimoSnapshot
  ? totalePrelieviEsterniStorici - Number(ultimoSnapshot.external_withdrawals || 0)
  : totalePrelieviEsterniStorici

const guadagnoCorrente =
  (totaleCassa - basePeriodo) + totaleUsciteEsterne
  
  const filteredBooks = useMemo(() => books.filter((book) => {
    const nomeMatch = (book.nome || '').toLowerCase().includes(bookFilters.nome.toLowerCase())
    const intestatarioMatch = (book.intestatario || '').toLowerCase().includes(bookFilters.intestatario.toLowerCase())
    const saldoMinMatch = bookFilters.saldoMin === '' ? true : Number(book.saldo || 0) >= Number(bookFilters.saldoMin)
    const saldoMaxMatch = bookFilters.saldoMax === '' ? true : Number(book.saldo || 0) <= Number(bookFilters.saldoMax)
    return nomeMatch && intestatarioMatch && saldoMinMatch && saldoMaxMatch
  }), [books, bookFilters])

  const filteredWallets = useMemo(() => wallets.filter((wallet) => {
    const nomeMatch = (wallet.nome || '').toLowerCase().includes(walletFilters.nome.toLowerCase())
    const intestatarioMatch = (wallet.intestatario || '').toLowerCase().includes(walletFilters.intestatario.toLowerCase())
    const saldoMinMatch = walletFilters.saldoMin === '' ? true : Number(wallet.saldo || 0) >= Number(walletFilters.saldoMin)
    const saldoMaxMatch = walletFilters.saldoMax === '' ? true : Number(wallet.saldo || 0) <= Number(walletFilters.saldoMax)
    return nomeMatch && intestatarioMatch && saldoMinMatch && saldoMaxMatch
  }), [wallets, walletFilters])

  const filteredTransactions = useMemo(() => transactions.filter((tx) => {
    const tipoMatch = txFilters.tipo ? tx.tipo === txFilters.tipo : true
    const azioneMatch = txFilters.azione ? (tx.azione || '') === txFilters.azione : true
    const text = `${tx.riferimento || ''} ${tx.note || ''} ${tx.azione || ''}`.toLowerCase()
    const testoMatch = text.includes(txFilters.testo.toLowerCase())
    const importoMinMatch = txFilters.importoMin === '' ? true : Number(tx.importo || 0) >= Number(txFilters.importoMin)
    const importoMaxMatch = txFilters.importoMax === '' ? true : Number(tx.importo || 0) <= Number(txFilters.importoMax)
    return tipoMatch && azioneMatch && testoMatch && importoMinMatch && importoMaxMatch
  }), [transactions, txFilters])
const stimeCassaByMonth = useMemo(() => {
  const grouped = stimeCassa.reduce((acc, row) => {
    const anno = Number(row.anno)
    const mese = Number(row.mese)
    const key = `${anno}-${String(mese).padStart(2, '0')}`

    if (!acc[key]) {
      acc[key] = {
        key,
        anno,
        mese,
        rows: []
      }
    }

    acc[key].rows.push(row)
    return acc
  }, {})

  return Object.values(grouped)
    .map((monthGroup) => ({
      ...monthGroup,
      rows: [...monthGroup.rows].sort((a, b) => {
        const ordineA = Number(a.ordine ?? 0)
        const ordineB = Number(b.ordine ?? 0)
        if (ordineA !== ordineB) return ordineA - ordineB
        return Number(a.id) - Number(b.id)
      }),
      totale: monthGroup.rows.reduce((sum, row) => sum + Number(row.importo || 0), 0)
    }))
    .sort((a, b) => {
      if (a.anno !== b.anno) return a.anno - b.anno
      return a.mese - b.mese
    })
}, [stimeCassa])

const meseCorrenteKey = formatMonthKey()

const totaleSpeseMeseCorrente = useMemo(() => {
  const meseCorrente = stimeCassaByMonth.find((item) => item.key === meseCorrenteKey)
  return meseCorrente ? Number(meseCorrente.totale || 0) : 0
}, [stimeCassaByMonth, meseCorrenteKey])
 const prelievoDelMese = Math.abs(Number(totaleSpeseMeseCorrente || 0))
const cassaDisponibile = totaleCassa - prelievoDelMese 
  const totaleBooksFiltrati = useMemo(() => filteredBooks.reduce((t, b) => t + Number(b.saldo || 0), 0), [filteredBooks])
  const totaleWalletsFiltrati = useMemo(() => filteredWallets.reduce((t, w) => t + Number(w.saldo || 0), 0), [filteredWallets])
  const ultimeTransazioni = useMemo(() => transactions.slice(0, 8), [transactions])
  const topBooks = useMemo(() => [...books].sort((a, b) => Number(b.saldo || 0) - Number(a.saldo || 0)).slice(0, 5), [books])
  const topWallets = useMemo(() => [...wallets].sort((a, b) => Number(b.saldo || 0) - Number(a.saldo || 0)).slice(0, 5), [wallets])

  function renderOrigineSelect() {
    if (txForm.tipo === 'versa') {
      return <select name='da_id' value={txForm.da_id} onChange={handleTransactionChange} style={input}><option value=''>Seleziona wallet origine</option>{wallets.map((wallet) => <option key={wallet.id} value={wallet.id}>{getEntityLabel(wallet)}</option>)}</select>
    }
    if (txForm.tipo === 'preleva' && txForm.da_tipo === 'book') {
      return <select name='da_id' value={txForm.da_id} onChange={handleTransactionChange} style={input}><option value=''>Seleziona book origine</option>{books.map((book) => <option key={book.id} value={book.id}>{getEntityLabel(book)}</option>)}</select>
    }
    if (txForm.tipo === 'preleva' && txForm.da_tipo === 'wallet') {
      return <select name='da_id' value={txForm.da_id} onChange={handleTransactionChange} style={input}><option value=''>Seleziona wallet origine</option>{wallets.map((wallet) => <option key={wallet.id} value={wallet.id}>{getEntityLabel(wallet)}</option>)}</select>
    }
    if (txForm.tipo === 'trasferisci') {
      return <select name='da_id' value={txForm.da_id} onChange={handleTransactionChange} style={input}><option value=''>Seleziona wallet origine</option>{wallets.map((wallet) => <option key={wallet.id} value={wallet.id}>{getEntityLabel(wallet)}</option>)}</select>
    }
    return null
  }

  function renderDestinazioneSelect() {
    if (txForm.tipo === 'versa') {
      const walletOrigine = wallets.find((w) => String(w.id) === String(txForm.da_id))
      const booksCompatibili = walletOrigine ? books.filter((book) => isSameOwner(book.intestatario, walletOrigine.intestatario)) : []
      return <select name='a_id' value={txForm.a_id} onChange={handleTransactionChange} style={input}><option value=''>{walletOrigine ? 'Seleziona book destinazione' : 'Prima seleziona wallet origine'}</option>{booksCompatibili.map((book) => <option key={book.id} value={book.id}>{getEntityLabel(book)}</option>)}</select>
    }
    if (txForm.tipo === 'preleva' && txForm.da_tipo === 'book') {
      const bookOrigine = books.find((b) => String(b.id) === String(txForm.da_id))
      const walletsCompatibili = bookOrigine ? wallets.filter((wallet) => isSameOwner(wallet.intestatario, bookOrigine.intestatario)) : []
      return <select name='a_id' value={txForm.a_id} onChange={handleTransactionChange} style={input}><option value=''>{bookOrigine ? 'Seleziona wallet destinazione' : 'Prima seleziona book origine'}</option>{walletsCompatibili.map((wallet) => <option key={wallet.id} value={wallet.id}>{getEntityLabel(wallet)}</option>)}</select>
    }
    if (txForm.tipo === 'trasferisci') {
      const walletsDisponibili = wallets.filter((wallet) => String(wallet.id) !== String(txForm.da_id))
      return <select name='a_id' value={txForm.a_id} onChange={handleTransactionChange} style={input}><option value=''>{txForm.da_id ? 'Seleziona wallet destinazione' : 'Prima seleziona wallet origine'}</option>{walletsDisponibili.map((wallet) => <option key={wallet.id} value={wallet.id}>{getEntityLabel(wallet)}</option>)}</select>
    }
    return null
  }

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

  if (loading) return <div style={loadingScreen}><div style={loadingCard}>Caricamento in corso...</div></div>

  return (
    <div style={container}>
      <div style={pageWrap}>
        <header style={header}>
          <div>
            <h1 style={title}>🔥 Profit Tracker - La scalata al SUCCESSO</h1>
            <p style={subtitle}>books · wallets · transactions</p>
          </div>
          <div style={copyrightBox}>© Sergio Apicella — Tutti i diritti riservati</div>
        </header>

        {message && <div style={successBox}>{message}</div>}
        {errorMessage && <div style={errorBox}>{errorMessage}</div>}

        <nav style={tabsBar}>
          <button style={activeTab === 'dashboard' ? activeTabButton : tabButton} onClick={() => setActiveTab('dashboard')}>Dashboard</button>
          <button style={activeTab === 'books' ? activeTabButton : tabButton} onClick={() => setActiveTab('books')}>Books</button>
          <button style={activeTab === 'wallets' ? activeTabButton : tabButton} onClick={() => setActiveTab('wallets')}>Wallets</button>
          <button style={activeTab === 'transactions' ? activeTabButton : tabButton} onClick={() => setActiveTab('transactions')}>Transactions</button>
          <button style={activeTab === 'periodi' ? activeTabButton : tabButton} onClick={() => setActiveTab('periodi')}>Periodi</button>
         <button
  style={activeTab === 'stime-cassa' ? activeTabButton : tabButton}
  onClick={() => {
   if (!canViewStimeCassa) {
  setAccessDenied('⛔ Accesso non consentito')
  setTimeout(() => setAccessDenied(''), 2500)
  return
}
    setActiveTab('stime-cassa')
  }}
>
  Contabilità
</button>
        </nav>

       {activeTab === 'dashboard' && (
  <div style={tabContent}>
     {accessDenied && <div style={errorBox}>{accessDenied}</div>}
    <div style={{ marginBottom: '15px' }}>
      <button style={primaryButtonBlue} onClick={saveWeeklySnapshot}>
  Salva Periodo
</button>
    </div>

    <div style={heroGrid}>
              <div style={heroCard}>
                <div style={heroLabel}>Panoramica mese</div>
                <div style={heroValue}>{formatCurrency(guadagnoCorrente)}</div>
                <div style={heroSub}>Profitto al netto dei prelievi esterni</div>
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

              <div style={heroSideGrid}>
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
    label='Cassa disponibile'
    value={formatCurrency(cassaDisponibile)}
    sub='Cassa attuale - prelievo del mese'
    accent='#22c55e'
  />
</div>
    </div>

            <div style={dashboardGrid}>
<div style={panel}>
  <div style={panelHeader}>
    <div>
      <h2 style={panelTitle}>Andamento settimanale</h2>
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
        )}
        {activeTab === 'periodi' && (
          <div style={tabContent}>
            <div style={sectionTopBar}>
              <div>
                <h2 style={sectionTitle}>Periodi</h2>
                <p style={sectionDescription}>Storico degli snapshot salvati con Salva Periodo</p>
              </div>
            </div>

            <div style={panel}>
              <div style={panelHeader}>
                <div>
                  <h2 style={panelTitle}>Storico periodi</h2>
                  <p style={panelSubtitle}>Dati letti da weekly_snapshots</p>
                </div>
              </div>

              <div style={tableWrap}>
                <table style={tableLarge}>
                  <thead>
                    <tr>
                      <th style={th}>ID</th>
                      <th style={th}>Data periodo</th>
                      <th style={th}>Ora salvataggio</th>
                      <th style={th}>Cassa totale</th>
                      <th style={th}>Prelievi esterni</th>
                      <th style={th}>Base</th>
                      <th style={th}>Profitto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {weeklySnapshots.map((snap) => (
                      <tr key={snap.id} style={tr}>
                        <td style={td}>{snap.id}</td>
                        <td style={td}>{snap.snapshot_date || '-'}</td>
                        <td style={td}>{formatDate(snap.created_at)}</td>
                        <td style={td}>{formatCurrency(snap.total_cash)}</td>
                        <td style={td}>{formatCurrency(snap.external_withdrawals)}</td>
                        <td style={td}>{formatCurrency(snap.base_cash_month)}</td>
                        <td style={tdStrong}>{formatCurrency(snap.profit)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
       {activeTab === 'stime-cassa' && canViewStimeCassa && (
  <div style={tabContent}>
    <div style={sectionTopBar}>
      <div>
        <h2 style={sectionTitle}>Stime di Cassa</h2>
        <p style={sectionDescription}>Vista annuale a riquadri: almeno 4 mesi visibili, ogni mese modificabile</p>
      </div>
    </div>

    <div style={statsGridCompact}>
      <StatCard
        label='Mesi presenti'
        value={String(stimeCassaByMonth.length)}
        sub='Riquadri mese disponibili'
        accent='#f59e0b'
      />
      <StatCard
        label='Spese mese corrente'
        value={formatCurrency(totaleSpeseMeseCorrente)}
        sub={`Valore da usare in dashboard per ${currentMonthLabel()}`}
        accent='#38bdf8'
      />
    </div>

    <div style={stimeMonthsGrid}>
      {stimeCassaByMonth.map((monthGroup) => {
        const meseLabel = new Date(monthGroup.anno, monthGroup.mese - 1, 1).toLocaleDateString('it-IT', {
          month: 'short',
          year: '2-digit'
        })

        const isCurrentMonth = monthGroup.key === meseCorrenteKey

        return (
          <div
            key={monthGroup.key}
            style={{
              ...stimeMonthCard,
              border: isCurrentMonth
                ? '1px solid rgba(56,189,248,0.55)'
                : '1px solid rgba(51,65,85,0.95)'
            }}
          >
            <div style={stimeMonthHeader}>
              <div style={stimeMonthTitle}>{meseLabel}</div>
              <div style={stimeMonthTotal}>
                {formatCurrency(monthGroup.totale)}
              </div>
            </div>

            <div style={stimeMonthBody}>
              {monthGroup.rows.map((row) => (
                <div key={row.id} style={stimeRow}>
                  <div style={stimeDoneCol}>
                    <input
                      value={row.stato || ''}
                      onChange={(e) => updateStimaCassa(row.id, 'stato', e.target.value)}
                      style={stimeMiniInput}
                    />
                  </div>

                  <div style={stimeImportoCol}>
                    <input
                      value={row.importo ?? 0}
                      onChange={(e) => updateStimaCassa(row.id, 'importo', Number(e.target.value))}
                      style={{
                        ...stimeMiniInput,
                        color: Number(row.importo || 0) < 0 ? '#f87171' : '#e2e8f0',
                        fontWeight: 700
                      }}
                    />
                  </div>

                  <div style={stimeVoceCol}>
                    <input
                      value={row.voce || ''}
                      onChange={(e) => updateStimaCassa(row.id, 'voce', e.target.value)}
                      style={stimeMiniInput}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  </div>
)}
        {activeTab === 'books' && (
          <div style={tabContent}>
            <div style={sectionTopBar}><div><h2 style={sectionTitle}>Books</h2><p style={sectionDescription}>Archivio bookmaker con filtri, note e azioni rapide</p></div><button style={primaryButtonGreen} onClick={() => setShowBookModal(true)}>+ Nuovo Book</button></div>
            <div style={statsGridCompact}><StatCard label='Totale books' value={formatCurrency(totaleBooks)} sub={`${books.length} records`} accent='#22c55e' /><StatCard label='Totale filtrato' value={formatCurrency(totaleBooksFiltrati)} sub={`${filteredBooks.length} risultati visibili`} accent='#38bdf8' /></div>
            <div style={panel}>
              <div style={filterRow}>
                <input value={bookFilters.nome} onChange={(e) => setBookFilters({ ...bookFilters, nome: e.target.value })} placeholder='Cerca per nome book...' style={filterInput} />
                <input value={bookFilters.intestatario} onChange={(e) => setBookFilters({ ...bookFilters, intestatario: e.target.value })} placeholder='Filtra per intestatario...' style={filterInput} />
                <input value={bookFilters.saldoMin} onChange={(e) => setBookFilters({ ...bookFilters, saldoMin: e.target.value })} placeholder='Saldo min' style={filterInput} />
                <input value={bookFilters.saldoMax} onChange={(e) => setBookFilters({ ...bookFilters, saldoMax: e.target.value })} placeholder='Saldo max' style={filterInput} />
                <button type='button' style={secondaryButton} onClick={clearBookFilters}>Pulisci</button>
              </div>
              <div style={tableWrap}>
                <table style={tableLarge}><thead><tr><th style={th}>ID</th><th style={th}>Nome</th><th style={th}>Intestatario</th><th style={th}>Saldo</th><th style={th}>Note</th><th style={th}>Azioni</th></tr></thead><tbody>
                  {filteredBooks.map((book) => <tr key={book.id} style={tr}><td style={td}>{book.id}</td><td style={tdStrong}>{book.nome}</td><td style={td}>{book.intestatario || '-'}</td><td style={td}>{formatCurrency(book.saldo)}</td><td style={tdNote}><textarea defaultValue={book.note || ''} onBlur={(e) => updateNote('books', book.id, e.target.value)} style={{ ...noteTextarea, color: getNoteColor(book.note) }} /></td><td style={tdActions}><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><button style={tinyGreenButton} onClick={() => openQuickBookTx(book, 'versa')}>Versa</button><button style={tinyBlueButton} onClick={() => openQuickBookTx(book, 'preleva')}>Preleva</button><button style={tinyOrangeButton} onClick={() => { setSelectedBook(book); resetAdjustSaldoForm(book); setShowAdjustSaldoModal(true) }}>Correggi saldo</button><button style={tinyRedButton} onClick={() => handleDeleteBook(book)}>Elimina</button></div></td></tr>)}
                </tbody></table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'wallets' && (
          <div style={tabContent}>
            <div style={sectionTopBar}><div><h2 style={sectionTitle}>Wallets</h2><p style={sectionDescription}>Carte, conti e metodi di pagamento con filtri e note</p></div><button style={primaryButtonBlue} onClick={() => setShowWalletModal(true)}>+ Nuovo Wallet</button></div>
            <div style={statsGridCompact}><StatCard label='Totale wallets' value={formatCurrency(totaleWallets)} sub={`${wallets.length} records`} accent='#38bdf8' /><StatCard label='Totale filtrato' value={formatCurrency(totaleWalletsFiltrati)} sub={`${filteredWallets.length} risultati visibili`} accent='#22c55e' /></div>
            <div style={panel}>
              <div style={filterRow}>
                <input value={walletFilters.nome} onChange={(e) => setWalletFilters({ ...walletFilters, nome: e.target.value })} placeholder='Cerca per nome wallet...' style={filterInput} />
                <input value={walletFilters.intestatario} onChange={(e) => setWalletFilters({ ...walletFilters, intestatario: e.target.value })} placeholder='Filtra per intestatario...' style={filterInput} />
                <input value={walletFilters.saldoMin} onChange={(e) => setWalletFilters({ ...walletFilters, saldoMin: e.target.value })} placeholder='Saldo min' style={filterInput} />
                <input value={walletFilters.saldoMax} onChange={(e) => setWalletFilters({ ...walletFilters, saldoMax: e.target.value })} placeholder='Saldo max' style={filterInput} />
                <button type='button' style={secondaryButton} onClick={clearWalletFilters}>Pulisci</button>
              </div>
              <div style={tableWrap}>
                <table style={table}><thead><tr><th style={th}>ID</th><th style={th}>Nome</th><th style={th}>Intestatario</th><th style={th}>Saldo</th><th style={th}>Note</th><th style={th}>Azioni</th></tr></thead><tbody>
                  {filteredWallets.map((wallet) => (
  <tr key={wallet.id} style={tr}>
    <td style={td}>{wallet.id}</td>
    <td style={tdStrong}>{wallet.nome}</td>
    <td style={td}>{wallet.intestatario || '-'}</td>
    <td style={td}>{formatCurrency(wallet.saldo)}</td>
    <td style={tdNote}>
      <textarea
        defaultValue={wallet.note || ''}
        onBlur={(e) => updateNote('wallets', wallet.id, e.target.value)}
        style={noteTextarea}
      />
    </td>
    <td style={tdActions}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          style={tinyOrangeButton}
         onClick={() => handleAdjustWalletSaldoPrompt(wallet)}          
         >
          Correggi saldo
        </button>
        <button
          style={tinyRedButton}
          onClick={() => handleDeleteWallet(wallet)}
        >
          Elimina
        </button>
      </div>
    </td>
  </tr>
))}
                </tbody></table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'transactions' && (
          <div style={tabContent}>
            <div style={transactionsLayout}>
              <div style={panelForm}>
                <div style={panelHeader}><div><h2 style={panelTitle}>Nuova transazione</h2><p style={panelSubtitle}>Versa, preleva esterno e trasferisci tra wallet</p></div></div>
                <form onSubmit={handleTransaction}>
                  <select name='tipo' value={txForm.tipo} onChange={handleTransactionChange} style={input}><option value=''>Tipo transazione</option><option value='versa'>Versa</option><option value='preleva'>Preleva</option><option value='trasferisci'>Trasferisci</option></select>
                  {txForm.tipo === 'preleva' && <select name='da_tipo' value={txForm.da_tipo} onChange={handleTransactionChange} style={input}><option value=''>Origine prelievo</option><option value='book'>Da Book verso Wallet</option><option value='wallet'>Da Wallet verso Esterno</option></select>}
                  <input name='importo' value={txForm.importo} onChange={handleTransactionChange} placeholder='Importo' style={input} />
                  {renderOrigineSelect()}
                  {renderDestinazioneSelect()}
                  <textarea name='note' value={txForm.note} onChange={handleTransactionChange} placeholder='Nota opzionale' style={textarea} />
                  <button style={primaryButtonGreen} type='submit'>Esegui transazione</button>
                </form>
                <div style={hintBox}>Guadagno = cassa attuale + prelievi esterni - BASE_CASSA_MESE</div>
              </div>

              <div style={panel}>
                <div style={panelHeader}><div><h2 style={panelTitle}>Storico movimenti</h2><p style={panelSubtitle}>Filtro per tipo, azione, testo e importo</p></div></div>
                <div style={filterRow}>
                  <select value={txFilters.tipo} onChange={(e) => setTxFilters({ ...txFilters, tipo: e.target.value })} style={filterInput}><option value=''>Tutti i tipi</option><option value='versa'>Versa</option><option value='preleva'>Preleva</option><option value='trasferisci'>Trasferisci</option><option value='correzione'>Correzione</option></select>
                  <select value={txFilters.azione} onChange={(e) => setTxFilters({ ...txFilters, azione: e.target.value })} style={filterInput}><option value=''>Tutte le azioni</option><option value='wallet_to_book'>wallet_to_book</option><option value='book_to_wallet'>book_to_wallet</option><option value='wallet_to_wallet'>wallet_to_wallet</option><option value='wallet_to_external'>wallet_to_external</option><option value='manual_balance_adjustment'>manual_balance_adjustment</option></select>
                  <input value={txFilters.importoMin} onChange={(e) => setTxFilters({ ...txFilters, importoMin: e.target.value })} placeholder='Importo min' style={filterInput} />
                  <input value={txFilters.importoMax} onChange={(e) => setTxFilters({ ...txFilters, importoMax: e.target.value })} placeholder='Importo max' style={filterInput} />
                  <input value={txFilters.testo} onChange={(e) => setTxFilters({ ...txFilters, testo: e.target.value })} placeholder='Cerca in riferimento, note, azione...' style={filterInputWide} />
                  <button type='button' style={secondaryButton} onClick={clearTxFilters}>Pulisci</button>
                </div>
                <div style={tableWrap}>
                  <table style={tableLarge}><thead><tr><th style={th}>Data</th><th style={th}>Tipo</th><th style={th}>Importo</th><th style={th}>Riferimento</th><th style={th}>Azione</th><th style={th}>Note</th><th style={thActions}>Azioni</th></tr></thead><tbody>
                    {filteredTransactions.map((tx) => <tr key={tx.id} style={tr}><td style={td}>{formatDate(tx.data)}</td><td style={td}><span style={badge(tx.tipo)}>{tx.tipo || '-'}</span></td><td style={td}>{formatCurrency(tx.importo)}</td><td style={td}>{tx.riferimento || '-'}</td><td style={td}>{tx.azione || '-'}</td><td style={tdNoteText}>{tx.note || '-'}</td><td style={tdActions}>{tx.azione !== 'manual_balance_adjustment' ? <button style={tinyRedButton} onClick={() => handleDeleteTransaction(tx)}>Elimina</button> : <span style={{ color: '#94a3b8', fontSize: 12 }}>Protetta</span>}</td></tr>)}
                  </tbody></table>
                </div>
              </div>
            </div>
          </div>
        )}

        {showBookModal && (
  <div style={modalOverlay} onClick={() => setShowBookModal(false)}>
    <div style={modalCard} onClick={(e) => e.stopPropagation()}>
      <div style={modalHeader}>
        <div>
          <h3 style={modalTitle}>Nuovo Book</h3>
          <p style={modalSubtitle}>Inserisci un nuovo bookmaker</p>
        </div>
        <button style={modalClose} onClick={() => setShowBookModal(false)}>✕</button>
      </div>
      <form onSubmit={addBook}>
        <input
          value={bookForm.nome}
          onChange={(e) => setBookForm({ ...bookForm, nome: e.target.value })}
          placeholder='Nome book'
          style={input}
        />
        <input
          value={bookForm.intestatario}
          onChange={(e) => setBookForm({ ...bookForm, intestatario: e.target.value })}
          placeholder='Intestatario'
          style={input}
        />
        <input
          value={bookForm.saldo}
          onChange={(e) => setBookForm({ ...bookForm, saldo: e.target.value })}
          placeholder='Saldo iniziale'
          style={input}
        />
        <textarea
          value={bookForm.note}
          onChange={(e) => setBookForm({ ...bookForm, note: e.target.value })}
          placeholder='Note'
          style={textarea}
        />
        <div style={modalActions}>
          <button type='button' style={secondaryButton} onClick={() => setShowBookModal(false)}>
            Annulla
          </button>
          <button type='submit' style={primaryButtonGreen}>
            Salva Book
          </button>
        </div>
      </form>
    </div>
  </div>
)}

{showWalletModal && (
  <div style={modalOverlay} onClick={() => setShowWalletModal(false)}>
    <div style={modalCard} onClick={(e) => e.stopPropagation()}>
      <div style={modalHeader}>
        <div>
          <h3 style={modalTitle}>Nuovo Wallet</h3>
          <p style={modalSubtitle}>Inserisci un nuovo wallet</p>
        </div>
        <button style={modalClose} onClick={() => setShowWalletModal(false)}>✕</button>
      </div>
      <form onSubmit={addWallet}>
        <input
          value={walletForm.nome}
          onChange={(e) => setWalletForm({ ...walletForm, nome: e.target.value })}
          placeholder='Nome wallet'
          style={input}
        />
        <input
          value={walletForm.intestatario}
          onChange={(e) => setWalletForm({ ...walletForm, intestatario: e.target.value })}
          placeholder='Intestatario'
          style={input}
        />
        <input
          value={walletForm.saldo}
          onChange={(e) => setWalletForm({ ...walletForm, saldo: e.target.value })}
          placeholder='Saldo iniziale'
          style={input}
        />
        <textarea
          value={walletForm.note}
          onChange={(e) => setWalletForm({ ...walletForm, note: e.target.value })}
          placeholder='Note'
          style={textarea}
        />
        <div style={modalActions}>
          <button type='button' style={secondaryButton} onClick={() => setShowWalletModal(false)}>
            Annulla
          </button>
          <button type='submit' style={primaryButtonBlue}>
            Salva Wallet
          </button>
        </div>
      </form>
    </div>
  </div>
)}

{showAdjustSaldoModal && selectedBook && (
  <div style={modalOverlay} onClick={() => setShowAdjustSaldoModal(false)}>
    <div style={modalCard} onClick={(e) => e.stopPropagation()}>
      <div style={modalHeader}>
        <div>
          <h3 style={modalTitle}>Correzione saldo book</h3>
          <p style={modalSubtitle}>
            Book: <strong>{selectedBook.nome}</strong> · saldo attuale <strong>{formatCurrency(selectedBook.saldo)}</strong>
          </p>
        </div>
        <button style={modalClose} onClick={() => setShowAdjustSaldoModal(false)}>✕</button>
      </div>
      <form onSubmit={handleAdjustSaldo}>
        <input
          value={adjustSaldoForm.nuovo_saldo}
          onChange={(e) => setAdjustSaldoForm({ ...adjustSaldoForm, nuovo_saldo: e.target.value })}
          placeholder='Nuovo saldo'
          style={input}
        />
        <textarea
          value={adjustSaldoForm.note}
          onChange={(e) => setAdjustSaldoForm({ ...adjustSaldoForm, note: e.target.value })}
          placeholder='Motivo correzione saldo'
          style={textarea}
        />
        <div style={modalActions}>
          <button type='button' style={secondaryButton} onClick={() => setShowAdjustSaldoModal(false)}>
            Annulla
          </button>
          <button type='submit' style={tinyOrangeButtonLarge}>
            Salva correzione
          </button>
        </div>
      </form>
    </div>
  </div>
)}
{showQuickBookTxModal && selectedBook && (
  <div style={modalOverlay} onClick={() => setShowQuickBookTxModal(false)}>
    <div style={modalCard} onClick={(e) => e.stopPropagation()}>
      <div style={modalHeader}>
        <div>
          <h3 style={modalTitle}>{quickBookTxForm.tipo === 'versa' ? 'Versa su book' : 'Preleva da book'}</h3>
          <p style={modalSubtitle}>
            Book selezionato: <strong>{selectedBook.nome}</strong> · intestatario <strong>{selectedBook.intestatario}</strong>
          </p>
        </div>
        <button style={modalClose} onClick={() => setShowQuickBookTxModal(false)}>✕</button>
      </div>
      <form onSubmit={handleQuickBookTransaction}>
        <select
          value={quickBookTxForm.wallet_id}
          onChange={(e) => setQuickBookTxForm({ ...quickBookTxForm, wallet_id: e.target.value })}
          style={input}
        >
          <option value=''>Seleziona wallet compatibile</option>
          {walletsCompatibiliQuick.map((wallet) => (
            <option key={wallet.id} value={wallet.id}>
              {getEntityLabel(wallet)}
            </option>
          ))}
        </select>
        <input
          value={quickBookTxForm.importo}
          onChange={(e) => setQuickBookTxForm({ ...quickBookTxForm, importo: e.target.value })}
          placeholder='Importo'
          style={input}
        />
        <textarea
          value={quickBookTxForm.note}
          onChange={(e) => setQuickBookTxForm({ ...quickBookTxForm, note: e.target.value })}
          placeholder='Nota opzionale'
          style={textarea}
        />
        <div style={modalActions}>
          <button type='button' style={secondaryButton} onClick={() => setShowQuickBookTxModal(false)}>
            Annulla
          </button>
          <button
            type='submit'
            style={quickBookTxForm.tipo === 'versa' ? primaryButtonGreen : primaryButtonBlue}
          >
            {quickBookTxForm.tipo === 'versa' ? 'Conferma versa' : 'Conferma preleva'}
          </button>
        </div>
      </form>
    </div>
  </div>    
)}
 </div>    
  </div>     
    )
  }
const container = { minHeight: '100vh', background: 'linear-gradient(180deg, #020617 0%, #0f172a 100%)', color: '#e5eefb', padding: '24px 16px 48px' }
const pageWrap = { maxWidth: 1500, margin: '0 auto' }
const header = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', marginBottom: 18 }
const title = { margin: 0, fontSize: 'clamp(28px, 4vw, 42px)', lineHeight: 1.05, color: '#f8fafc' }
const subtitle = { margin: '8px 0 0', color: '#94a3b8', fontSize: 15 }
const copyrightBox = { border: '1px solid rgba(148,163,184,0.18)', background: 'rgba(15,23,42,0.72)', color: '#cbd5e1', padding: '12px 16px', borderRadius: 16, fontSize: 13, fontWeight: 700 }
const tabsBar = { display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 18 }
const tabButton = { background: 'rgba(15,23,42,0.82)', color: '#cbd5e1', border: '1px solid rgba(51,65,85,0.95)', borderRadius: 14, padding: '10px 14px', cursor: 'pointer', fontWeight: 700 }
const activeTabButton = { ...tabButton, background: 'linear-gradient(135deg, rgba(59,130,246,0.22), rgba(56,189,248,0.16))', color: '#f8fafc', border: '1px solid rgba(56,189,248,0.5)', boxShadow: '0 0 0 1px rgba(56,189,248,0.08) inset' }
const successBox = { background: 'rgba(34,197,94,0.14)', border: '1px solid rgba(34,197,94,0.35)', color: '#bbf7d0', padding: '12px 14px', borderRadius: 14, marginBottom: 16, fontWeight: 700 }
const errorBox = { background: 'rgba(239,68,68,0.14)', border: '1px solid rgba(239,68,68,0.35)', color: '#fecaca', padding: '12px 14px', borderRadius: 14, marginBottom: 16, fontWeight: 700 }
const tabContent = { display: 'flex', flexDirection: 'column', gap: 16 }
const statsGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }
const statsGridCompact = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }
const stimeMonthsGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 16,
  alignItems: 'start'
}

const stimeMonthCard = {
  background: 'linear-gradient(180deg, rgba(15,23,42,0.94), rgba(2,6,23,0.99))',
  borderRadius: 20,
  padding: 14,
  boxShadow: '0 20px 48px rgba(0,0,0,0.24)',
  minHeight: 320
}

const stimeMonthHeader = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 12,
  marginBottom: 12,
  paddingBottom: 8,
  borderBottom: '1px solid rgba(51,65,85,0.75)'
}

const stimeMonthTitle = {
  fontSize: 16,
  fontWeight: 900,
  color: '#f8fafc',
  textTransform: 'lowercase'
}

const stimeMonthTotal = {
  fontSize: 16,
  fontWeight: 900,
  color: '#fde68a',
  whiteSpace: 'nowrap'
}

const stimeMonthBody = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6
}

const stimeRow = {
  display: 'grid',
  gridTemplateColumns: '70px 95px minmax(0, 1fr)',
  gap: 8,
  alignItems: 'center'
}

const stimeDoneCol = {}
const stimeImportoCol = {}
const stimeVoceCol = {}

const stimeMiniInput = {
  width: '100%',
  boxSizing: 'border-box',
  background: '#0b1220',
  color: '#f8fafc',
  border: '1px solid rgba(51,65,85,0.95)',
  borderRadius: 10,
  padding: '7px 8px',
  outline: 'none',
  fontSize: 12
}
const statCard = { background: 'linear-gradient(180deg, rgba(15,23,42,0.92), rgba(2,6,23,0.98))', border: '1px solid rgba(51,65,85,0.95)', borderRadius: 20, padding: 18, boxShadow: '0 18px 44px rgba(0,0,0,0.28)' }
const statLabel = { fontSize: 13, color: '#94a3b8', marginBottom: 8, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.6 }
const statValue = { fontSize: 28, color: '#f8fafc', fontWeight: 900, lineHeight: 1.05 }
const statSub = { marginTop: 8, color: '#aab8ce', fontSize: 13 }
const heroGrid = { display: 'grid', gridTemplateColumns: 'minmax(420px, 1.25fr) minmax(280px, 0.75fr)', gap: 16 }
const heroSideGrid = { display: 'grid', gridTemplateColumns: '1fr', gap: 14, alignContent: 'start' }
const dashboardGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 16 }
const transactionsLayout = { display: 'grid', gridTemplateColumns: 'minmax(320px, 420px) minmax(0, 1fr)', gap: 16 }
const panel = { background: 'linear-gradient(180deg, rgba(15,23,42,0.94), rgba(2,6,23,0.99))', border: '1px solid rgba(51,65,85,0.95)', borderRadius: 22, padding: 18, boxShadow: '0 20px 48px rgba(0,0,0,0.26)', overflow: 'hidden' }
const panelForm = { ...panel, minWidth: 320 }
const heroCard = { background: 'linear-gradient(135deg, rgba(34,197,94,0.12), rgba(56,189,248,0.08), rgba(15,23,42,0.96))', border: '1px solid rgba(56,189,248,0.22)', borderRadius: 26, padding: 24, boxShadow: '0 22px 52px rgba(0,0,0,0.28)' }
const heroLabel = { fontSize: 13, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.8, color: '#7dd3fc', marginBottom: 10 }
const heroValue = { fontSize: 'clamp(34px, 4vw, 50px)', lineHeight: 1, fontWeight: 900, color: '#f8fafc', marginBottom: 10 }
const heroSub = { color: '#cbd5e1', fontSize: 14, marginBottom: 18 }
const heroMiniRow = { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }
const heroMiniBox = { background: 'rgba(2,6,23,0.42)', border: '1px solid rgba(71,85,105,0.45)', borderRadius: 18, padding: '14px 16px' }
const heroMiniLabel = { fontSize: 12, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 6, fontWeight: 700 }
const heroMiniValue = { fontSize: 20, color: '#f8fafc', fontWeight: 800 }
const panelHeader = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 16, flexWrap: 'wrap' }
const panelTitle = { margin: 0, color: '#f8fafc', fontSize: 22 }
const panelSubtitle = { margin: '6px 0 0', color: '#94a3b8', fontSize: 14 }
const sectionTopBar = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }
const sectionTitle = { margin: 0, color: '#f8fafc', fontSize: 24 }
const sectionDescription = { margin: '6px 0 0', color: '#94a3b8', fontSize: 14 }
const primaryButtonGreen = { border: 'none', background: 'linear-gradient(135deg, #16a34a, #22c55e)', color: '#f8fafc', fontWeight: 800, padding: '12px 16px', borderRadius: 14, cursor: 'pointer' }
const primaryButtonBlue = { border: 'none', background: 'linear-gradient(135deg, #2563eb, #38bdf8)', color: '#f8fafc', fontWeight: 800, padding: '12px 16px', borderRadius: 14, cursor: 'pointer' }
const secondaryButton = { border: '1px solid rgba(71,85,105,0.95)', background: 'rgba(15,23,42,0.82)', color: '#e2e8f0', fontWeight: 700, padding: '10px 14px', borderRadius: 14, cursor: 'pointer' }
const tinyGreenButton = { border: 'none', background: 'linear-gradient(135deg, #16a34a, #22c55e)', color: '#f8fafc', fontWeight: 800, padding: '8px 12px', borderRadius: 12, cursor: 'pointer' }
const tinyBlueButton = { border: 'none', background: 'linear-gradient(135deg, #2563eb, #38bdf8)', color: '#f8fafc', fontWeight: 800, padding: '8px 12px', borderRadius: 12, cursor: 'pointer' }
const tinyOrangeButton = { border: 'none', background: 'linear-gradient(135deg, #ea580c, #f97316)', color: '#fff7ed', fontWeight: 800, padding: '8px 12px', borderRadius: 12, cursor: 'pointer' }
const tinyOrangeButtonLarge = { ...tinyOrangeButton, padding: '12px 16px', borderRadius: 14 }
const tinyRedButton = { border: 'none', background: 'linear-gradient(135deg, #b91c1c, #ef4444)', color: '#fff1f2', fontWeight: 800, padding: '8px 12px', borderRadius: 12, cursor: 'pointer' }
const filterRow = { display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }
const input = { width: '100%', boxSizing: 'border-box', background: '#0b1220', color: '#f8fafc', border: '1px solid rgba(51,65,85,0.95)', borderRadius: 14, padding: '12px 14px', outline: 'none', marginBottom: 12 }
const textarea = { ...input, minHeight: 90, resize: 'vertical' }
const filterInput = { flex: '1 1 160px', minWidth: 150, background: '#0b1220', color: '#f8fafc', border: '1px solid rgba(51,65,85,0.95)', borderRadius: 14, padding: '12px 14px', outline: 'none' }
const filterInputWide = { ...filterInput, flex: '2 1 260px' }
const tableWrap = { 
  overflowX: 'auto', 
  borderRadius: 18, 
  border: '1px solid rgba(51,65,85,0.85)',
  position: 'relative'
}
const table = { width: '100%', borderCollapse: 'collapse', minWidth: 760 }
const tableLarge = { width: '100%', borderCollapse: 'collapse', minWidth: 1100 }
const th = { textAlign: 'left', padding: '14px 14px', fontSize: 12, color: '#94a3b8', background: '#0b1220', borderBottom: '1px solid rgba(51,65,85,0.85)', textTransform: 'uppercase', letterSpacing: 0.7 }
const thActions = {
  ...th,
  minWidth: 140,
  position: 'sticky',
  right: 0,
  background: '#0b1220',
  zIndex: 3,
  boxShadow: '-8px 0 12px rgba(2,6,23,0.35)'
}
const tr = { borderBottom: '1px solid rgba(30,41,59,0.9)' }
const td = { padding: '14px 14px', color: '#e2e8f0', verticalAlign: 'top', fontSize: 14 }
const tdStrong = { ...td, fontWeight: 800, color: '#f8fafc' }
const tdNote = { ...td, minWidth: 250 }
const tdNoteText = { ...td, minWidth: 280 }
const tdActions = { 
  ...td, 
  minWidth: 140,
  position: 'sticky',
  right: 0,
  background: '#0b1220',
  zIndex: 2,
  boxShadow: '-8px 0 12px rgba(2,6,23,0.35)'
}
const noteTextarea = { width: '100%', maxWidth: '340px', background: '#0b1220', color: '#f8fafc', border: '1px solid rgba(51,65,85,0.9)', borderRadius: 10, padding: '8px 10px', minHeight: 52, resize: 'vertical', boxSizing: 'border-box', overflow: 'hidden' }
const stackList = { display: 'flex', flexDirection: 'column', gap: 12 }
const miniRowTitle = { color: '#f8fafc', fontWeight: 800 }
const miniRowSub = { color: '#94a3b8', fontSize: 13, marginTop: 4 }
const rankRow = { display: 'grid', gridTemplateColumns: '42px 1fr auto', gap: 12, alignItems: 'center', padding: '12px 14px', borderRadius: 16, background: 'rgba(11,18,32,0.78)', border: '1px solid rgba(51,65,85,0.75)' }
const rankBadge = { width: 32, height: 32, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(56,189,248,0.16)', border: '1px solid rgba(56,189,248,0.28)', color: '#e0f2fe', fontWeight: 900, fontSize: 13 }
const rankMain = { minWidth: 0 }
const rankValue = { color: '#f8fafc', fontWeight: 900, whiteSpace: 'nowrap', fontSize: 15 }
const modalOverlay = { position: 'fixed', inset: 0, background: 'rgba(2,6,23,0.78)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 1000 }
const modalCard = { width: '100%', maxWidth: 620, background: 'linear-gradient(180deg, rgba(15,23,42,0.98), rgba(2,6,23,1))', border: '1px solid rgba(51,65,85,0.95)', borderRadius: 22, padding: 18, boxShadow: '0 24px 64px rgba(0,0,0,0.42)' }
const modalHeader = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 14 }
const modalTitle = { margin: 0, color: '#f8fafc' }
const modalSubtitle = { margin: '6px 0 0', color: '#94a3b8', fontSize: 14 }
const modalClose = { border: '1px solid rgba(71,85,105,0.95)', background: 'rgba(15,23,42,0.82)', color: '#e2e8f0', width: 38, height: 38, borderRadius: 12, cursor: 'pointer', fontSize: 18, lineHeight: 1 }
const modalActions = { display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap', marginTop: 6 }
const loadingScreen = { minHeight: '100vh', background: 'linear-gradient(180deg, #020617 0%, #0f172a 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }
const loadingCard = { background: 'linear-gradient(180deg, rgba(15,23,42,0.95), rgba(2,6,23,1))', color: '#f8fafc', border: '1px solid rgba(51,65,85,0.95)', borderRadius: 20, padding: '24px 28px', fontWeight: 800, boxShadow: '0 24px 60px rgba(0,0,0,0.36)' }
const hintBox = { marginTop: 10, border: '1px solid rgba(56,189,248,0.25)', background: 'rgba(56,189,248,0.08)', color: '#cfefff', padding: '12px 14px', borderRadius: 14, fontSize: 13, lineHeight: 1.5 }
