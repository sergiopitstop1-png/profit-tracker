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
  const [transactions, setTransactions] = useState([])
  const [totaleEsterni, setTotaleEsterni] = useState(0)
  const [contabilita, setContabilita] = useState([])
const [weeklySnapshots, setWeeklySnapshots] = useState([])
const [monthlySnapshots, setMonthlySnapshots] = useState([])
const [stimeCassa, setStimeCassa] = useState([])
const [pendingRefresh, setPendingRefresh] = useState(false)
 const [memoRoyaltyAccounts, setMemoRoyaltyAccounts] = useState([])
  const [newAccountName, setNewAccountName] = useState('')
const [memoRoyaltyEntries, setMemoRoyaltyEntries] = useState([])
const [memoSavingsRows, setMemoSavingsRows] = useState([])
const [savingsFormMassi, setSavingsFormMassi] = useState({ periodo: '', versamento: '', causale: '' })
const [savingsFormSamu, setSavingsFormSamu] = useState({ periodo: '', versamento: '', causale: '' })
const [memoFutureNotes, setMemoFutureNotes] = useState([])
const [memoFreeBoxes, setMemoFreeBoxes] = useState([]) 
  const [dashboardSettings, setDashboardSettings] = useState({ accantonamento_royalty: 0, risparmi_samu_massi: 0, target_cassa: 0 })

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
  const [clienti, setClienti] = useState([])
  const [clientiEmail, setClientiEmail] = useState([])
  const [promozioni, setPromozioni] = useState([])
  const [showPromozioniPopup, setShowPromozioniPopup] = useState(false)
  const [promozioniManuali, setPromozioniManuali] = useState([])
  const [syncInCorso, setSyncInCorso] = useState(false)
  const [syncLog, setSyncLog] = useState([])
  const [showSyncLog, setShowSyncLog] = useState(false)
  const [promozioneDettaglio, setPromozioneDettaglio] = useState(null)
  const [testoLive, setTestoLive] = useState('')
  const [testoLoading, setTestoLoading] = useState(false)
  const [showPromozioniManualiPopup, setShowPromozioniManualiPopup] = useState(false)
  const [promozioniManualiEmail, setPromozioniManualiEmail] = useState('')
  const [showClienteModal, setShowClienteModal] = useState(false)
  const [editingCliente, setEditingCliente] = useState(null)
  const [clienteForm, setClienteForm] = useState({ nome: '', email: '', telefono: '', sim_operatore: '', sim_importo: '', sim_giorno_scadenza: '', note: '' })
  const [showAdjustSaldoModal, setShowAdjustSaldoModal] = useState(false)
  const [showAdjustWalletSaldoModal, setShowAdjustWalletSaldoModal] = useState(false)
  const [showQuickBookTxModal, setShowQuickBookTxModal] = useState(false)

  const [selectedBook, setSelectedBook] = useState(null)
  const [selectedWallet, setSelectedWallet] = useState(null)
  const [bookForm, setBookForm] = useState({ nome: '', intestatario: '', saldo: '', note: '' })
  const [walletForm, setWalletForm] = useState({ nome: '', intestatario: '', saldo: '', note: '' })
  const [adjustSaldoForm, setAdjustSaldoForm] = useState({ nuovo_saldo: '', note: '' })
  const [pendingBookSaldi, setPendingBookSaldi] = useState({}) // { [bookId]: nuovoValore }
  const bookSaldoRefs = React.useRef({}) // { [bookId]: inputElement }

  const [adjustWalletSaldoForm, setAdjustWalletSaldoForm] = useState({ nuovo_saldo: '', note: '' })
  const [quickBookTxForm, setQuickBookTxForm] = useState({ tipo: 'versa', wallet_id: '', importo: '', note: '' })
  const [txForm, setTxForm] = useState({ tipo: '', da_tipo: '', importo: '', da_id: '', a_id: '', note: '', categoria_spesa: '' })

  const [bookFilters, setBookFilters] = useState({ nome: '', intestatario: '', saldoMin: '', saldoMax: '' })
  const [walletFilters, setWalletFilters] = useState({ nome: '', intestatario: '', saldoMin: '', saldoMax: '' })
  const [txFilters, setTxFilters] = useState({ tipo: '', azione: '', testo: '', importoMin: '', importoMax: '', dataFrom: '', dataTo: '' })
const [memoForm, setMemoForm] = useState({ data_reale: '', data_testo: '', importo: '', descrizione: '', colore: 'normal' })
const [isListening, setIsListening] = useState(false)
const [voiceTranscript, setVoiceTranscript] = useState('')
const [voiceStatus, setVoiceStatus] = useState('')
  const [isListeningContinuous, setIsListeningContinuous] = useState(false)
const [listBuffer, setListBuffer] = useState('')
const [profilazioneFilter, setProfilazioneFilter] = useState({ intestatario: '', book: '', livello: '' })
const [profilazioneSearch, setProfilazioneSearch] = useState('')
const [savingProfilo, setSavingProfilo] = useState({})
const [showAgendaPopup, setShowAgendaPopup] = useState(false)
const [agendaVista, setAgendaVista] = useState(false)
const [agendaAperto, setAgendaAperto] = useState(null)
const [popupAperto, setPopupAperto] = useState(null)
  const [clientePromoAperto, setClientePromoAperto] = useState(null)
  const [promoFiltri, setPromoFiltri] = useState({ priorita: '', stato: '', mittente: '' })
  const [matrice, setMatrice] = useState([])
const [matriceFiltroVista, setMatriceFiltroVista] = useState('cliente') // 'cliente' | 'bookmaker'
const [matriceFiltroCliente, setMatriceFiltroCliente] = useState('')
const [matriceFiltroBook, setMatriceFiltroBook] = useState('')
const [matriceFiltroStato, setMatriceFiltroStato] = useState('DA APRIRE')
const [matriceAperto, setMatriceAperto] = useState(null)
const [docCliente, setDocCliente] = useState(null) // cliente aperto nel file manager
const [docPassword, setDocPassword] = useState('') // password inserita
const [docPasswordOk, setDocPasswordOk] = useState(false) // password verificata
const [docFiles, setDocFiles] = useState([]) // file del cliente
const [docLoading, setDocLoading] = useState(false)
const [docUploading, setDocUploading] = useState(false)
const [docPasswordError, setDocPasswordError] = useState('')
const [archivioMailCella, setArchivioMailCella] = useState(null) // { cliente, bookmaker, promo[] }
const [archivioMailDati, setArchivioMailDati] = useState([]) // tutte le promo
const [puntiMoneteBooks, setPuntiMoneteBooks] = useState([])
const [puntiMoneteSaldi, setPuntiMoneteSaldi] = useState({})
const [puntiMoneteLoading, setPuntiMoneteLoading] = useState(false)
const [archivioSearch, setArchivioSearch] = useState('')
const [archivioFiltroCliente, setArchivioFiltroCliente] = useState('')
const [archivioFiltroData, setArchivioFiltroData] = useState('')
const [pmBooks, setPmBooks] = useState([])
const [pmSaldi, setPmSaldi] = useState({})
const [pmLoading, setPmLoading] = useState(true)
const [speseCategoriaMese, setSpeseCategoriaMese] = useState([])
const [txLoadAll, setTxLoadAll] = useState(false)
const [speseMeseSelezionato, setSpeseMeseSelezionato] = useState(() => new Date().toISOString().slice(0, 7))
const [speseStorico, setSpeseStorico] = useState({}) // { 'YYYY-MM': [...tx] }
const [soglieBudget, setSoglieBudget] = useState({})
const [showSoglieEditor, setShowSoglieEditor] = useState(false)
const [pmNuovoBook, setPmNuovoBook] = useState({ nome: '', valorePunto: 0.001818, bookId: '' })
const [pmShowAggiungi, setPmShowAggiungi] = useState(false)
  useEffect(() => {
  if (typeof window !== 'undefined' && localStorage.getItem('site_unlocked') !== '1') {
    window.location.href = '/login?from=/profit-tracker'
    return
  }
  loadData()
}, [])





const CLASSI_BOOK = {
  A: ['bet365','snai','sisal','lottomatica','goldbet','planetwin365','eurobet','pokerstars'],
  B: ['netbet','bwin','betsson','william hill','stanleybet','e-play24','betfair'],
  B_CASINO: ['gioco digitale','starcasino','betflag','tombola','zonagioco'],
  C: ['admiral','codere','betpoint','staryes','sportium','vincitu','marathonbet','domusbet','betpassion'],
}
const MANUTENZIONE = {
  A: { label: 'Serie A', frequenza: 'Bet 1/mese · Slot 1/mese', azioni: ['1 bet sportiva al mese (giorno random)', 'Sessione slot 5-10€ al mese (giorno diverso dalla bet)'] },
  B: { label: 'Serie B', frequenza: 'Bet 1 ogni 2 mesi · Slot 1 ogni 2 mesi', azioni: ['1 bet sportiva ogni 2 mesi (giorno random)', 'Sessione slot 5-10€ ogni 2 mesi (giorno diverso dalla bet)'] },
  C: { label: 'Serie C', frequenza: 'Bet 1 ogni 2 mesi · Slot 1 ogni 2 mesi', azioni: ['1 bet da 5-10€ ogni 2 mesi (giorno random)', 'Sessione slot 5-10€ ogni 2 mesi (giorno diverso dalla bet)'] }
}
function getClasseBook(nomeBook) {
  const nome = (nomeBook || '').toLowerCase().replace(/\.it$/, '').trim()
  for (const [classe, lista] of Object.entries(CLASSI_BOOK)) {
    if (lista.some(k => nome.includes(k))) return classe
  }
  return 'C'
}
function isSoloCasino(nomeBook) {
  const nome = (nomeBook || '').toLowerCase().replace(/\.it$/, '').trim()
  return (CLASSI_BOOK['B_CASINO'] || []).some(k => nome.includes(k))
}
const AZIONI_ATTIVO = {
  'snai': {
    ricarica: ['Ricarica 200€ (settimane alterne)'],
    slot: ['Volume slot 30-40€ a spin bassi, alto RTP'],
    numeri: ['Live numeri 1k sui numeri'],
    sport: ['Bet sportiva VXT'],
    preleva: ['Preleva e lascia meno di 50€ (se saldo alto)']
  },
  'sisal': {
    ricarica: ['Ricarica 200€ (settimane alterne)'],
    slot: ['Volume slot 400-500€ — mine o alto RTP'],
    numeri: ['Live numeri 300-500€'],
    sport: ['Tutte le VXT disponibili'],
    preleva: ['Preleva strategico se saldo alto']
  },
  'pokerstars': {
    ricarica: ['Ricarica 200€ (settimane alterne)'],
    slot: ['Volume slot 400-500€ — mine o alto RTP'],
    numeri: ['Live numeri 300-500€'],
    sport: ['Tutte le VXT disponibili'],
    preleva: ['Preleva e lascia meno di 50€']
  },
  'bet365': {
    ricarica: ['Ricarica per programma fedeltà'],
    slot: ['Sport Expert: condizionata semplice'],
    numeri: ['Prepara multipla su Diretta.it — quota max 1.70'],
    sport: ['Multipla in doppia da 800€ — quote in discesa'],
    preleva: ['Verifica saldo programma fedeltà']
  },
  'lottomatica': {
    ricarica: ['Ricarica conto'],
    slot: ['Sessione slot tradizionale'],
    numeri: ['Live numeri tradizionale'],
    sport: ['Bet sportiva — prova codici ricarica'],
    preleva: ['Preleva se opportuno']
  },
  'goldbet': {
    ricarica: ['Ricarica conto'],
    slot: ['Sessione slot'],
    numeri: ['Live numeri'],
    sport: ['Bet sportiva'],
    preleva: ['Preleva se opportuno']
  },
  'eurobet': {
    ricarica: ['Ricarica conto'],
    slot: ['Sessione slot — Main Sport'],
    numeri: ['Live numeri'],
    sport: ['Bet sportiva'],
    preleva: ['Preleva se opportuno']
  },
  'planetwin': {
    ricarica: ['Ricarica conto'],
    slot: ['Sessione slot — Main Sport'],
    numeri: ['Live numeri'],
    sport: ['Bet sportiva'],
    preleva: ['Preleva se opportuno']
  },
  'default': {
    ricarica: ['Ricarica conto (se prevista dal protocollo)'],
    slot: ['Sessione slot — spin bassi, alto RTP'],
    numeri: ['Live numeri'],
    sport: ['Bet sportiva / VXT'],
    preleva: ['Preleva strategico se saldo alto']
  }
}

function getAzioniAttivo(nomeBook) {
  const nome = (nomeBook || '').toLowerCase().replace(/\.it$/, '').trim()
  for (const [key, azioni] of Object.entries(AZIONI_ATTIVO)) {
    if (key !== 'default' && nome.includes(key)) return azioni
  }
  return AZIONI_ATTIVO['default']
}

function getAgendaAttivo(book, giorno, settimana) {
  const azioni = getAzioniAttivo(book.nome)
  // Ricarica: solo lun/mar/mer (giorni 1,2,3) — randomizzata tra questi
  const giornoRicarica = [1, 2, 3][hashBook(book.id, settimana * 10) % 3]
  // Slot: qualsiasi giorno tranne quello della ricarica
  const giorniSlot = [0,1,2,3,4,5,6].filter(g => g !== giornoRicarica)
  const giornoSlot = giorniSlot[hashBook(book.id, settimana * 10 + 1) % giorniSlot.length]
  // Numeri: qualsiasi giorno tranne ricarica e slot
  const giorniNumeri = [0,1,2,3,4,5,6].filter(g => g !== giornoRicarica && g !== giornoSlot)
  const giornoNumeri = giorniNumeri[hashBook(book.id, settimana * 10 + 2) % giorniNumeri.length]
  // Sport/VXT: qualsiasi altro giorno
  const giorniSport = [0,1,2,3,4,5,6].filter(g => g !== giornoRicarica && g !== giornoSlot && g !== giornoNumeri)
  const giornoSport = giorniSport[hashBook(book.id, settimana * 10 + 3) % giorniSport.length]
  // Preleva: qualsiasi altro giorno
  const giorniPreleva = [0,1,2,3,4,5,6].filter(g => g !== giornoRicarica && g !== giornoSlot && g !== giornoNumeri && g !== giornoSport)
  const giornoPreleva = giorniPreleva[hashBook(book.id, settimana * 10 + 4) % giorniPreleva.length]

  if (giorno === giornoRicarica) return azioni.ricarica
  if (giorno === giornoSlot) return azioni.slot
  if (giorno === giornoNumeri) return azioni.numeri
  if (giorno === giornoSport) return azioni.sport
  if (giorno === giornoPreleva) return azioni.preleva
  return null
}
const AGENDA_MANUTENZIONE_A = {
  1: { label: 'Lunedì', azioni: ['Sessione slot 5-10€ (spin bassi)'] },
  3: { label: 'Mercoledì', azioni: ['1 bet sportiva anche piccola'] },
  0: { label: 'Domenica', azioni: [] }
}
const AGENDA_MANUTENZIONE_B = {
  1: { label: 'Lunedì', azioni: ['1 bet sportiva (solo settimane 1 e 3 del mese)', 'Sessione slot 5-10€ (solo settimana 2 del mese)'] },
  0: { label: 'Domenica', azioni: [] }
}
const AGENDA_MANUTENZIONE_C = {
  1: { label: 'Lunedì', azioni: ['1 bet da 5-10€ (solo prima settimana del mese)'] },
  0: { label: 'Domenica', azioni: [] }
}
const PROTOCOLLI = {
  'sisal': { durata: '2 mesi', capitale_min: 200, azioni: ['Ricarica 200€ a settimane alterne ad inizio settimana', 'Volume slot 800–1000/sett (mine o alto RTP)', 'Posizione perdente 500€ una volta al mese', 'Live numeri 300–500€ a settimane alterne', 'Tutte le VXT', 'Dosa il conto: quando ricevi promo usala e porta a casa', 'Quando il conto è fermo arrivano maggiori promo'] },
  'pokerstars': { durata: '2 mesi', capitale_min: 200, azioni: ['Ricarica 200€ a settimane alterne ad inizio settimana', 'Volume slot 800–1000/sett (mine o alto RTP)', 'Posizione perdente 500€ una volta al mese', 'Live numeri 300–500€ a settimane alterne', 'Tutte le VXT', 'Dosa il conto in base alla ricezione promo'] },
  'netbet': { durata: '1 mese', capitale_min: 200, azioni: ['Ricarica 200€ ad inizio settimana', 'Volume slot 250–300/sett', '2-3 bet extra mese da almeno 20€', 'Tutte le VXT', 'Numeri 100–200€ a settimane alterne con almeno 4 amici', 'Preleva e lascia meno di 50€ almeno 1 volta/mese'] },
  'betflag': { durata: '1 ciclo', capitale_min: 2000, azioni: ['La promo arriva nei conti NON limitati alla 100% rimborso', 'Volume 3–4k alla Take o giochi simili concentrati in un giorno', 'Ricarica almeno 2000€', 'Giorno dopo preleva e lascia conto FERMO con poco saldo per almeno 2 mesi'] },
  'sportbet': { durata: '1 mese', capitale_min: 200, azioni: ['Ricarica 200€ ad inizio settimana', 'Volume slot 500/sett alto RTP spin basso', '2-3 bet extra mese da almeno 20€', 'Tutte le VXT', 'Giochi live NON copribili 200€', 'Preleva e lascia meno di 50€ almeno 1 volta/mese'] },
  'totosi': { durata: '1 mese', capitale_min: 200, azioni: ['Ricarica almeno 200€', 'Volume slot 150–250/MESE', '2-3 bet extra mese da almeno 20€', 'Tutte le VXT', 'Preleva e lascia meno di 50€ una volta terminato'] },
  'betsson': { durata: 'continuativo', capitale_min: 200, azioni: ['Tutte le cashback segnalate (bj: 2-3/sett)', 'Usa Sport Expert se possibile', '200–300€ ogni 14gg sui numeri', 'Dosa volumi in base a ricezione riservate', 'Ricarica almeno 200€', 'Volume slot 150–250/MESE', '2-3 bet extra mese da almeno 20€', 'Tutte le VXT', 'Preleva e lascia meno di 50€', 'Appena ricevi riservate dosa i volumi'] },
  'william hill': { durata: 'continuativo', capitale_min: 0, azioni: ['2 promo per tutti dal lunedì al venerdì', 'Solo con sblocco saldo arrivano le promo Ricarica/Fun e ruote', 'Se inizi a ricevere promo: max 2-3/settimana'] },
  'admiral': { durata: 'continuativo', capitale_min: 500, azioni: ['Ricarica almeno 500€', '2 consecutive bet numeri da almeno 300€', 'Dove vinci fai volume slot da almeno 300€', 'Preleva e lascia conto con poco saldo'] },
  'gioco digitale': { durata: 'continuativo', capitale_min: 200, azioni: ['Ricarica 200€ ad inizio settimana', 'Slot 100–200€', 'Casinò live a settimane alterne 100–200€ sui numeri', 'Bug attivo: max 3-4 promo ricarica al giorno o promo Free Spin', 'Preleva e lascia con poco saldo ogni 14gg'] },
  'bwin': { durata: 'continuativo', capitale_min: 500, azioni: ['Ricarica 500€ ad inizio mese', 'Slot 100–200€', 'Casinò live a settimane alterne 100–200€ sui numeri', '2-3 bet sport fino a 50€/mese', 'Preleva e lascia con poco saldo ogni 14gg'] },
  'stanleybet': { durata: 'continuativo', capitale_min: 200, azioni: ['Ricarica 200€ ad inizio settimana', 'Volume slot 200–500€ ad inizio settimana', 'Sport 100–200€/sett se vuoi', 'Virtuali 150–200€ ogni 14gg per promo virtuali', 'Ricarica 200€ ad inizio settimana (ripeti)'] },
  'lottomatica': { durata: 'continuativo', capitale_min: 200, azioni: ['Metodo tradizionale', 'Se VIP e serve scossa: perdi 2–2.5k in una giornata', 'Prova sempre codici ricarica anche senza promo', 'Chiedi promozioni direttamente al book', 'Attenzione: gruppo Lottomatica potrebbe incrociare dati tra siti della stessa famiglia'] },
  'goldbet': { durata: 'continuativo', capitale_min: 200, azioni: ['Metodo tradizionale', 'Prova sempre codici ricarica', 'Chiedi promozioni direttamente al book', 'Attenzione: stesso gruppo Lottomatica'] },
  'planetwin365': { durata: 'continuativo', capitale_min: 200, azioni: ['Metodo tradizionale', 'Prova sempre codici ricarica', 'Main Sport fondamentale per promo'] },
  'eurobet': { durata: 'continuativo', capitale_min: 200, azioni: ['Metodo tradizionale', 'Prova sempre codici ricarica', 'Main Sport fondamentale per promo'] },
  'snai': { durata: 'continuativo', capitale_min: 300, azioni: ['Mini sessioni slot 30-40€ a spin bassi', 'Volume slot settimanale — spin bassi, alto RTP', 'Gioca sui numeri', 'Tutte le VXT disponibili', 'Dosa il conto: quando ricevi promo usala e porta a casa', 'Preleva e lascia meno di 50€ quando opportuno'] },
  'bet365': { durata: 'continuativo', capitale_min: 800, azioni: ['Multipla in doppia da 800€ programma fedeltà', 'Quote max 1.70', 'Utilizza quote in discesa', 'Controlla testa a testa tra squadre', 'Controlla classifiche e ultime 5 partite', 'Usa Diretta.it per costruire le multiple', 'Sport Expert: condizionate semplici per ottimi guadagni', 'Preparati per fase PRE Mondiali'] },
  'codere': { durata: 'continuativo', capitale_min: 200, azioni: ['Metodo tradizionale', 'Attenzione: può richiedere documentazione aggiuntiva', 'Utilizza amici con documentazione facile se richiesto', 'Usa volume di gioco per la metà di quello fatto su Sisal'] },
  'starcasino': { durata: 'continuativo', capitale_min: 200, azioni: ['Metodo tradizionale', 'Prova sempre codici ricarica'] },
  'sportium': { durata: 'continuativo', capitale_min: 200, azioni: ['Stesso gruppo E-play24', 'Metodo tradizionale', 'Coordina le movimentazioni con E-play24'] },
  'eplay24': { durata: 'continuativo', capitale_min: 200, azioni: ['Stesso gruppo Sportium', 'Metodo tradizionale', 'Coordina le movimentazioni con Sportium'] },
  'default': { durata: 'continuativo', capitale_min: 200, azioni: ['Metodo tradizionale', 'Ricarica periodica per mantenere conto attivo', 'Qualche bet sportiva mensile', 'Prova codici ricarica se disponibili', 'Chiedi promozioni direttamente al book'] }
}

function getProtocollo(nomeBook) {
  const nome = (nomeBook || '').toLowerCase().replace(/\.it$/, '').trim()
  for (const [key, proto] of Object.entries(PROTOCOLLI)) {
    if (nome.includes(key)) return { ...proto, key }
  }
  return { ...PROTOCOLLI['default'], key: 'default' }
}

function getSettimanaAnno() {
  const now = new Date()
  const start = new Date(now.getFullYear(), 0, 1)
  return Math.ceil(((now - start) / 86400000 + start.getDay() + 1) / 7)
}

function hashBook(bookId, settimana) {
  let h = (bookId * 2654435761 + settimana * 40503) >>> 0
  h = ((h ^ (h >> 16)) * 0x45d9f3b) >>> 0
  h = ((h ^ (h >> 16)) * 0x45d9f3b) >>> 0
  return h ^ (h >> 16)
}

function getGiornoAssegnato(book, frequenzaSettimane) {
  const settimana = getSettimanaAnno()
  const ciclo = Math.floor(settimana / frequenzaSettimane)
  const seed = hashBook(book.id, ciclo * 7 + 13)
  return seed % 7
}

function getAzioniOggi(book) {
  const oggi = new Date()
  const giorno = oggi.getDay()
  const settimana = getSettimanaAnno()
  const livello = book.profilo_livello
  const proto = getProtocollo(book.nome)
  const classe = getClasseBook(book.nome)

  if (livello === 'attivo') {
    const azioniGiorno = getAgendaAttivo(book, giorno, settimana)
    if (!azioniGiorno || azioniGiorno.length === 0) return null
    return {
      tipo: 'attivo',
      label: ['Dom','Lun','Mar','Mer','Gio','Ven','Sab'][giorno],
      azioni: azioniGiorno,
      badge: '🟢 Attivo'
    }
  }

  if (livello === 'mantenimento' || livello === 'mantenimento-a' || livello === 'mantenimento-b' || livello === 'mantenimento-c') {
    const classeEffettiva = livello === 'mantenimento-a' ? 'A' : livello === 'mantenimento-b' ? (isSoloCasino(book.nome) ? 'B_CASINO' : 'B') : livello === 'mantenimento-c' ? 'C' : classe

    if (classeEffettiva === 'A') {
      const oggi2 = new Date()
      const GIORNO_ZERO = new Date('2026-05-18')
      const giorniDaZero = Math.floor((oggi2 - GIORNO_ZERO) / (1000 * 60 * 60 * 24))
      const offsetBet = hashBook(book.id, 101) % 30
      const offsetSlot = hashBook(book.id, 202) % 30
      const isBetDay = (giorniDaZero - offsetBet) % 30 === 0
      const isSlotDay = (giorniDaZero - offsetSlot) % 30 === 0
      if (isSlotDay && !isBetDay) return { tipo: 'manutenzione-a', azioni: ['Sessione slot 5-10€ (spin bassi)'], badge: '🟡 Mant. A' }
      if (isBetDay) return { tipo: 'manutenzione-a', azioni: ['1 bet sportiva (qualsiasi importo)'], badge: '🟡 Mant. A' }
      return null
    }

    if (classeEffettiva === 'B' || classeEffettiva === 'B_CASINO') {
      const oggi2 = new Date()
      const GIORNO_ZERO = new Date('2026-05-18')
      const giorniDaZero = Math.floor((oggi2 - GIORNO_ZERO) / (1000 * 60 * 60 * 24))
      const soloCasino = isSoloCasino(book.nome)
      const offsetBet = hashBook(book.id, 303) % 60
      const offsetSlot = hashBook(book.id, 404) % 60
      const isBetDay = (giorniDaZero - offsetBet) % 60 === 0
      const isSlotDay = (giorniDaZero - offsetSlot) % 60 === 0
      if (isSlotDay && !isBetDay) return { tipo: 'manutenzione-b', azioni: ['Sessione slot 5-10€'], badge: '🟡 Mant. B' }
      if (isBetDay && !soloCasino) return { tipo: 'manutenzione-b', azioni: ['1 bet sportiva piccola'], badge: '🟡 Mant. B' }
      if (isBetDay && soloCasino) return { tipo: 'manutenzione-b', azioni: ['Sessione slot 5-10€'], badge: '🟡 Mant. B' }
      return null
    }

    if (classeEffettiva === 'C') {
      const oggi2 = new Date()
      const GIORNO_ZERO = new Date('2026-05-18')
      const giorniDaZero = Math.floor((oggi2 - GIORNO_ZERO) / (1000 * 60 * 60 * 24))
      const soloCasino = isSoloCasino(book.nome)
      const offsetBet = hashBook(book.id, 505) % 60
      const offsetSlot = hashBook(book.id, 606) % 60
      const isBetDay = (giorniDaZero - offsetBet) % 60 === 0
      const isSlotDay = (giorniDaZero - offsetSlot) % 60 === 0
      if (isSlotDay && !isBetDay) return { tipo: 'manutenzione-c', azioni: ['Sessione slot 5-10€'], badge: '🟡 Mant. C' }
      if (isBetDay && !soloCasino) return { tipo: 'manutenzione-c', azioni: ['1 bet da 5-10€ (solo presenza)'], badge: '🟡 Mant. C' }
      if (isBetDay && soloCasino) return { tipo: 'manutenzione-c', azioni: ['Sessione slot 5-10€'], badge: '🟡 Mant. C' }
      return null
    }
  }
  return null
}

async function autoAssegnaProfiloDefault(booksData) {
  const daAggiornare = booksData.filter(b => !b.profilo_livello)
  if (daAggiornare.length === 0) return
  const updates = daAggiornare.map(b => {
    const classe = getClasseBook(b.nome)
    const classeNorm = classe === 'B_CASINO' ? 'b' : classe.toLowerCase()
    return { id: b.id, profilo_livello: `mantenimento-${classeNorm}` }
  })
  // Batch da 50 per non sovraccaricare Supabase
  const batchSize = 50
  for (let i = 0; i < updates.length; i += batchSize) {
    const batch = updates.slice(i, i + batchSize)
    await Promise.all(batch.map(upd =>
      supabase.from('books').update({ profilo_livello: upd.profilo_livello }).eq('id', upd.id)
    ))
  }
  setBooks(prev => prev.map(b => {
    const upd = updates.find(u => u.id === b.id)
    return upd ? { ...b, profilo_livello: upd.profilo_livello } : b
  }))
}

async function updateProfiloLivello(bookId, livello) {
  setSavingProfilo(p => ({ ...p, [bookId]: true }))
  const cicloInizio = livello === 'attivo' ? new Date().toISOString().split('T')[0] : null
  const { error } = await supabase.from('books').update({
    profilo_livello: livello,
    profilo_ciclo_inizio: cicloInizio
  }).eq('id', bookId)
  if (!error) {
    setBooks(prev => prev.map(b => b.id === bookId ? { ...b, profilo_livello: livello, profilo_ciclo_inizio: cicloInizio } : b))
  }
  setSavingProfilo(p => ({ ...p, [bookId]: false }))
}

  async function loadData({ preserveMessages = false } = {}) {
    setLoading(true)
    if (!preserveMessages) {
      setMessage('')
      setErrorMessage('')
    }

   const [
  booksRes,
  walletsRes,
  txRes,
  contRes,
  weeklyRes,
  monthlyRes,
  stimeRes,
  memoRoyaltyAccountsRes,
  memoRoyaltyEntriesRes,
  memoSavingsRowsRes,
  memoFutureNotesRes,
  memoFreeBoxesRes,
     dashboardSettingsRes,
  clientiRes,
  clientiEmailRes,
  promozioniRes,
] = await Promise.all([
  supabase.from('books').select('*').order('id', { ascending: true }),
  supabase.from('wallets').select('*').order('id', { ascending: true }),
  supabase.from('transactions').select('*').order('data', { ascending: false }).gte('data', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()).limit(2000),
  supabase.from('contabilita').select('*').order('data_movimento', { ascending: false }),
  supabase.from('weekly_snapshots').select('*').order('snapshot_date', { ascending: true }),
  supabase.from('monthly_snapshots').select('*').order('snapshot_month', { ascending: true }),
  supabase.from('stime_cassa').select('*')
    .order('anno', { ascending: true })
    .order('mese', { ascending: true })
    .order('ordine', { ascending: true })
    .order('id', { ascending: true }),
  supabase.from('memo_royalty_accounts').select('*').order('id', { ascending: true }),
  supabase.from('memo_royalty_entries').select('*').order('id', { ascending: true }),
  supabase.from('memo_savings_rows').select('*').order('id', { ascending: true }),
  supabase.from('memo_future_notes').select('*').order('ordine', { ascending: true }).order('id', { ascending: true }),
  supabase.from('memo_free_boxes').select('*').order('id', { ascending: true }),
    supabase.from('dashboard_settings').select('*').eq('id', 1).maybeSingle(),
  supabase.from('clienti').select('*').order('nome', { ascending: true }),
  supabase.from('clienti_email').select('*').order('cliente_id', { ascending: true }),
  supabase.from('promozioni_clienti').select('*, clienti(nome)').order('data_mail', { ascending: false }).limit(5000),
])
const { data: esterniData } = await supabase
  .from('transactions')
  .select('importo')
  .eq('azione', 'wallet_to_external')

const sommaEsterni = (esterniData || [])
  .reduce((t, tx) => t + Number(tx.importo || 0), 0)
setTotaleEsterni(sommaEsterni)
    const errors = []
if (booksRes.error) errors.push('books'); else {
  const booksData = booksRes.data || []
  setBooks(booksData)
  setTimeout(() => autoAssegnaProfiloDefault(booksData), 500)
}
if (walletsRes.error) errors.push('wallets'); else setWallets(walletsRes.data || [])
if (txRes.error) errors.push('transactions'); else setTransactions(txRes.data || [])
if (contRes.error) errors.push('contabilita'); else setContabilita(contRes.data || [])
if (weeklyRes.error) errors.push('weekly_snapshots'); else setWeeklySnapshots(weeklyRes.data || [])
if (monthlyRes.error) errors.push('monthly_snapshots'); else setMonthlySnapshots(monthlyRes.data || [])
if (stimeRes.error) errors.push('stime_cassa'); else setStimeCassa(stimeRes.data || [])
if (memoRoyaltyAccountsRes.error) errors.push('memo_royalty_accounts'); else setMemoRoyaltyAccounts(memoRoyaltyAccountsRes.data || [])
if (memoRoyaltyEntriesRes.error) errors.push('memo_royalty_entries'); else setMemoRoyaltyEntries(memoRoyaltyEntriesRes.data || [])
if (memoSavingsRowsRes.error) errors.push('memo_savings_rows'); else setMemoSavingsRows(memoSavingsRowsRes.data || [])
if (memoFutureNotesRes.error) errors.push('memo_future_notes'); else setMemoFutureNotes(memoFutureNotesRes.data || [])
if (memoFreeBoxesRes.error) errors.push('memo_free_boxes'); else setMemoFreeBoxes(memoFreeBoxesRes.data || [])
    if (dashboardSettingsRes.error) {
  errors.push('dashboard_settings')
} else {
  const ds = dashboardSettingsRes.data || { accantonamento_royalty: 0, risparmi_samu_massi: 0 }
  setDashboardSettings(ds)
  if (ds.soglie_budget) setSoglieBudget(ds.soglie_budget)
}
if (clientiRes && !clientiRes.error) setClienti(clientiRes.data || [])
if (clientiEmailRes && !clientiEmailRes.error) setClientiEmail(clientiEmailRes.data || [])
const { data: pmData, error: pmError } = await supabase.from('punti_monete').select('*').order('book_nome').order('cliente_nome')
if (!pmError && pmData && pmData.length > 0) {
  const bookMap = {}
  const saldiMap = {}
  pmData.forEach(r => {
    if (!bookMap[r.book_nome]) bookMap[r.book_nome] = { id: r.book_nome.toLowerCase(), nome: r.book_nome, valorePunto: Number(r.valore_punto), bookId: r.book_id ? String(r.book_id) : '' }
    saldiMap[`${r.book_nome.toLowerCase()}__${r.cliente_nome}`] = r.punti
  })
  const booksArr = Object.values(bookMap)
  setPuntiMoneteBooks(booksArr)
  setPmBooks(booksArr)
  setPmSaldi(saldiMap)
}
setPmLoading(false)
// Carica tutte wallet_to_external del mese corrente per grafico spese
const meseCorrenteISO = new Date().toISOString().slice(0, 7)
const { data: speseData } = await supabase
  .from('transactions')
  .select('id, note, importo, categoria_spesa, data, azione')
  .eq('azione', 'wallet_to_external')
  .gte('data', meseCorrenteISO + '-01')
  .lt('data', new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString())
if (speseData) setSpeseCategoriaMese(speseData)
if (promozioniRes && !promozioniRes.error) {
  setPromozioni(promozioniRes.data || [])
  const altaPriorita = (promozioniRes.data || []).filter(p => !p.letta)
  if (altaPriorita.length > 0) setShowPromozioniPopup(true)
}
    // Carica matrice in due batch per superare limite 1000 righe Supabase
    const [m1, m2, m3] = await Promise.all([
      supabase.from('matrice_bookmakers').select('*').order('bookmaker', { ascending: true }).range(0, 999),
      supabase.from('matrice_bookmakers').select('*').order('bookmaker', { ascending: true }).range(1000, 1999),
      supabase.from('matrice_bookmakers').select('*').order('bookmaker', { ascending: true }).range(2000, 2999),
    ])
    setMatrice([...(m1.data || []), ...(m2.data || []), ...(m3.data || [])])
    if (errors.length) setErrorMessage(`Errore caricamento: ${errors.join(', ')}`)
    setLoading(false)
  }
  const saveWeeklySnapshot = async () => {
    try {
      const snapshotDate = new Date().toISOString().split('T')[0]

      const totalCash =
  books.reduce((sum, b) => sum + Number(b.saldo || 0), 0) +
  wallets.reduce((sum, w) => sum + Number(w.saldo || 0), 0)

      // DOPO
const externalWithdrawals = totaleEsterni

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
const canViewStimeCassa = true
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
  const normalized = value.endsWith('Z') || value.includes('+') ? value : value + 'Z'
  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('it-IT')
}
function speak(text) {
  if (!window.speechSynthesis) return
  window.speechSynthesis.cancel()
  const utt = new SpeechSynthesisUtterance(text)
  utt.lang = 'it-IT'
  utt.rate = 0.95
  window.speechSynthesis.speak(utt)
}

useEffect(() => {
  const oggi = new Date()
  const oggiStr = oggi.toISOString().split('T')[0]

  // Scadenze da memo_future_notes
  const scadenzeMemo = memoFutureNotes.filter(row => {
    if (!row.data_reale) return false
    const diff = (new Date(row.data_reale + 'T00:00:00') - oggi) / (1000 * 60 * 60 * 24)
    return diff <= 30
  })

  // Scadenze da contabilità mese corrente (previsto + giorno compilato)
  const annoCorrente = oggi.getFullYear()
  const meseCorrente = oggi.getMonth() + 1
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
      const dataReale = `${annoCorrente}-${String(meseCorrente).padStart(2,'0')}-${String(giorno).padStart(2,'0')}`
      const diff = (new Date(dataReale + 'T00:00:00') - oggi) / (1000 * 60 * 60 * 24)
      return { data_reale: dataReale, descrizione: row.voce || 'Spesa contabilità', diff }
    })
    .filter(r => r.diff <= 30)

  const tutteScadenze = [
    ...scadenzeMemo.map(r => ({ data_reale: r.data_reale, descrizione: r.descrizione })),
    ...scadenzeContabilita.map(r => ({ data_reale: r.data_reale, descrizione: r.descrizione }))
  ]

  if (tutteScadenze.length === 0) return

  const hashAttuale = oggiStr + '|' + tutteScadenze.map(r => r.data_reale + ':' + r.descrizione).join(',')
  const ultimoAvviso = localStorage.getItem('ultimoAvvisoScadenze')
  if (ultimoAvviso === hashAttuale) return

  const messaggi = tutteScadenze.map(row => {
    const giorni = Math.ceil((new Date(row.data_reale + 'T00:00:00') - oggi) / (1000 * 60 * 60 * 24))
    if (giorni < 0) return `SCADUTA: ${row.descrizione}, provvedere`
    return giorni === 0 ? `Oggi scade: ${row.descrizione}` : `Tra ${giorni} giorni: ${row.descrizione}`
  })
  const testo = `Attenzione. Hai ${tutteScadenze.length} scadenze in arrivo. ${messaggi.join('. ')}`
  setTimeout(() => {
    speak(testo)
    localStorage.setItem('ultimoAvvisoScadenze', hashAttuale)
  }, 1500)
}, [memoFutureNotes, stimeCassa])

useEffect(() => {
  if (books.length === 0) return
  const oggi = new Date().toISOString().split('T')[0]
  const ultimaVista = localStorage.getItem('agendaVistaData')
  if (ultimaVista === oggi) return
  const bookiAttivi = books.filter(b => b.profilo_livello === 'attivo' || (b.profilo_livello && b.profilo_livello.startsWith('mantenimento')))
  const azioniOggi = bookiAttivi.map(b => getAzioniOggi(b)).filter(Boolean)
  if (azioniOggi.length > 0 && !agendaVista) {
    setShowAgendaPopup(true)
  }
}, [books])

// Sync Gmail automatico: solo ogni 4 ore (non al refresh)
useEffect(() => {
  if (clientiEmail.length === 0) return

  const eseguiSync = () => {
    setSyncInCorso(true)
    setMessage('📧 Sincronizzazione mail in corso...')
    fetch('/api/gmail/sync?secret=' + (process.env.NEXT_PUBLIC_CRON_SECRET || 'pt_cron_2026_sergio'))
      .then(r => r.json())
      .then(data => {
        const totSalvate = (data.risultati || []).reduce((acc, r) => acc + (r.salvate || 0), 0)
        if (totSalvate > 0) {
          setMessage(`📧 ${totSalvate} nuove promozioni trovate!`)
        } else {
          setMessage('📧 Mail sincronizzate — nessuna novità')
        }
        setTimeout(() => setMessage(''), 4000)
        loadData({ preserveMessages: true })
      })
      .catch(() => {
        setSyncInCorso(false)
        setMessage('')
      })
      .finally(() => setSyncInCorso(false))
  }

  // Solo automatico ogni 4 ore, NON al refresh
  const interval = setInterval(eseguiSync, 4 * 60 * 60 * 1000)
  return () => clearInterval(interval)
}, [clientiEmail])

// Auto-snapshot a fine mese: scatta al primo accesso del mese nuovo
useEffect(() => {
  if (books.length === 0 || wallets.length === 0) return

  const oggi = new Date()
  const meseCorrenteKey = `${oggi.getFullYear()}-${String(oggi.getMonth() + 1).padStart(2, '0')}`
  const chiaveLS = 'autoSnapshotMese'
  const ultimoAutoSnap = localStorage.getItem(chiaveLS)

  // Se già fatto questo mese, non fare nulla
  if (ultimoAutoSnap === meseCorrenteKey) return

  // Calcola la data dell'ultimo giorno del mese precedente
  const mesePrecedente = new Date(oggi.getFullYear(), oggi.getMonth(), 0)
  const snapshotDate = mesePrecedente.toISOString().split('T')[0]
  const snapshotMeseKey = `${mesePrecedente.getFullYear()}-${String(mesePrecedente.getMonth() + 1).padStart(2, '0')}`

  // Verifica se esiste già uno snapshot per il mese precedente
  const giaEsiste = weeklySnapshots.some(s => s.snapshot_date && s.snapshot_date.startsWith(snapshotMeseKey))
  if (giaEsiste) {
    localStorage.setItem(chiaveLS, meseCorrenteKey)
    return
  }

  const totalCash = books.reduce((sum, b) => sum + Number(b.saldo || 0), 0) +
    wallets.reduce((sum, w) => sum + Number(w.saldo || 0), 0)
  const externalWithdrawals = totaleEsterni
  const baseCashMonth = BASE_CASSA_MESE
  const profit = totalCash + externalWithdrawals - baseCashMonth

  supabase.from('weekly_snapshots').upsert(
    [{ snapshot_date: snapshotDate, total_cash: totalCash, external_withdrawals: externalWithdrawals, base_cash_month: baseCashMonth, profit }],
    { onConflict: 'snapshot_date' }
  ).then(({ error }) => {
    if (!error) {
      localStorage.setItem(chiaveLS, meseCorrenteKey)
      loadData({ preserveMessages: true })
    }
  })
}, [books, wallets, weeklySnapshots])

function correggiTrascrizione(testo) {
  const correzioni = {
    'aggiornasaldi': 'aggiornaS saldi',
    'premisto': 'premi stop',
    'bazzocchi': 'Bozoki',
    'bazzochi': 'Bozoki',
    'bazoki': 'Bozoki',
    'bazzoco': 'Bozoki',
    'evaristo': 'Evariste',
    'letizia': 'Leatizia',
    'genevieve': 'Genevieve',
    'bouah': 'Bouah',
    'boa ': 'Bouah ',
    'bua ': 'Bouah ',
  }
  let risultato = testo
  Object.entries(correzioni).forEach(([sbagliato, corretto]) => {
    const regex = new RegExp(sbagliato, 'gi')
    risultato = risultato.replace(regex, corretto)
  })
  return risultato
}
async function handleVoiceCommand(transcript) {
  setVoiceStatus('Elaborazione...')
  try {
    const response = await fetch('/api/voice', {
      method: 'POST',
      headers: { 
  'Content-Type': 'application/json',
 'x-api-key': process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY,
  'anthropic-version': '2023-06-01'
},
      body: JSON.stringify({
  model: 'claude-haiku-4-5-20251001',
  max_tokens: 1000,
  system: `Sei un assistente per un profit tracker. Interpreta il comando vocale e restituisci SOLO un JSON valido (nessun testo extra).

STRUTTURA 1 - Comando singolo:
{ "tipo": "singolo", "azione": "versa|preleva_book|preleva_esterno|trasferisci|correggi_book|correggi_wallet|sconosciuto", "intestatario": "nome cognome o null", "book_nome": "nome book o null", "wallet_nome": "nome wallet origine o null", "wallet_dest": "nome wallet destinazione o null", "importo": numero o null, "nuovo_saldo": numero o null, "note": "testo o null" }

REGOLE AZIONI:
- "versa X euro da [wallet] a [book]" → azione: "versa", wallet_nome: wallet, book_nome: book
- "preleva X euro da [book] a [wallet]" → azione: "preleva_book", book_nome: book, wallet_nome: wallet destinazione
- "preleva esterno X euro da [wallet]" → azione: "preleva_esterno", wallet_nome: wallet
- "trasferisci X euro da [wallet1] a [wallet2]" → azione: "trasferisci", wallet_nome: wallet1, wallet_dest: wallet2
- "correggi saldo [book] [intestatario] nuovo saldo X" → azione: "correggi_book"
- "correggi saldo wallet [wallet] [intestatario] nuovo saldo X" → azione: "correggi_wallet"

DISTINZIONE CHIAVE:
- Se preleva DA un BOOK (Bet365, Sisal, Betpoint ecc.) → preleva_book
- Se preleva DA un WALLET (Revolut, PayPal, Contanti ecc.) verso esterno → preleva_esterno
- I BOOK sono bookmaker, i WALLET sono metodi di pagamento

STRUTTURA 2 - Lista correzioni saldi:
{ "tipo": "lista", "book_nome": "nome book", "correzioni": [ { "intestatario": "nome cognome", "nuovo_saldo": numero }, ... ] }

STRUTTURA 3 - Lista versamenti misti:
{ "tipo": "lista_versamenti", "book_nome": "nome book", "versamenti": [ { "intestatario": "nome cognome", "importo": numero, "wallet_nome": "nome wallet" }, ... ] }

REGOLE nomi: usa il nome PIÙ SIMILE dalla lista, NON inventare nomi.
Books disponibili: ${books.map(b => b.nome + ' (' + b.intestatario + ')').join(', ')}
Wallets disponibili: ${wallets.map(w => w.nome + ' (' + w.intestatario + ')').join(', ')}`,
  messages: [{ role: 'user', content: transcript }]
})
    })
    const data = await response.json()
    const raw = data.content?.[0]?.text || '{}'
    const clean = raw.replace(/```json|```/g, '').trim()
    const cmd = JSON.parse(clean)
    await executeVoiceCommand(cmd, transcript)
  } catch (err) {
  setVoiceStatus('Errore: ' + err.message)
  speak('Errore')
  console.error('Voice error:', err)
}
}
const cleanN = (s) => (s || '').replace(/\s*\(.*?\)/g, '').trim().toLowerCase()
const extInt = (s) => { const m = (s || '').match(/\(([^)]+)\)/); return m ? m[1].toLowerCase() : '' }
async function executeVoiceCommand(cmd) {
  // MODALITÀ LISTA
  if (cmd.tipo === 'lista' && cmd.correzioni && cmd.correzioni.length > 0) {
    const risultati = []
    const errori = []
    for (const correzione of cmd.correzioni) {
      const book = books.find(b =>
        (b.nome || '').toLowerCase().includes((cmd.book_nome || '').toLowerCase()) &&
        (b.intestatario || '').toLowerCase().includes((correzione.intestatario || '').toLowerCase())
      )
      if (!book) {
        errori.push(correzione.intestatario)
        continue
      }
      await updateSaldo('books', book.id, correzione.nuovo_saldo)
      await salvaLogTransazione({
        tipo: 'correzione',
        importo: correzione.nuovo_saldo,
        riferimento: `book:${book.id}:${book.nome}:${book.intestatario}`,
        note: `Correzione saldo vocale → ${correzione.nuovo_saldo}`,
        azione: 'manual_balance_adjustment'
      })
      risultati.push(`${book.intestatario} → ${correzione.nuovo_saldo}€`)
    }
    await loadData({ preserveMessages: true })
    const msg = risultati.length > 0
      ? `✅ Aggiornati ${risultati.length}: ${risultati.join(', ')}`
      : '❌ Nessun book trovato'
    const errMsg = errori.length > 0 ? ` | Non trovati: ${errori.join(', ')}` : ''
    setVoiceStatus(msg + errMsg)
    speak(`Fatto. Aggiornati ${risultati.length} saldi su ${cmd.book_nome}.${errori.length > 0 ? ' Non trovati: ' + errori.join(', ') : ''}`)
    return
  }
// LISTA VERSAMENTI MISTI
  if (cmd.tipo === 'lista_versamenti' && cmd.versamenti && cmd.versamenti.length > 0) {
    const risultati = []
    const errori = []
    for (const v of cmd.versamenti) {
      const wallet = wallets.find(w =>
        (w.nome || '').toLowerCase().includes((v.wallet_nome || '').toLowerCase()) &&
        (w.intestatario || '').toLowerCase().includes((v.intestatario || '').toLowerCase())
      )
      const book = books.find(b =>
        (b.nome || '').toLowerCase().includes((cmd.book_nome || '').toLowerCase()) &&
        (b.intestatario || '').toLowerCase().includes((v.intestatario || '').toLowerCase())
      )
      if (!wallet || !book) { errori.push(v.intestatario); continue }
      if (Number(wallet.saldo) < v.importo) { errori.push(`${v.intestatario} (saldo insufficiente)`); continue }
      await updateSaldo('wallets', wallet.id, Number(wallet.saldo) - v.importo)
      await updateSaldo('books', book.id, Number(book.saldo) + v.importo)
      await salvaLogTransazione({
        tipo: 'versa', importo: v.importo,
        riferimento: `wallet:${wallet.id}:${wallet.nome}:${wallet.intestatario} -> book:${book.id}:${book.nome}:${book.intestatario}`,
        note: `Versamento vocale da ${wallet.nome} a ${book.nome}`,
        azione: 'wallet_to_book'
      })
      risultati.push(`${v.intestatario} ${v.importo}€`)
    }
    await loadData({ preserveMessages: true })
    const msg = risultati.length > 0 ? `✅ Versati ${risultati.length}: ${risultati.join(', ')}` : '❌ Nessun versamento eseguito'
    const errMsg = errori.length > 0 ? ` | Errori: ${errori.join(', ')}` : ''
    setVoiceStatus(msg + errMsg)
    speak(`Fatto. Eseguiti ${risultati.length} versamenti su ${cmd.book_nome}.${errori.length > 0 ? ' Errori: ' + errori.join(', ') : ''}`)
    return
  }

  // COMANDO SINGOLO
  if (cmd.azione === 'sconosciuto') {
    setVoiceStatus('Comando non riconosciuto')
    speak('Comando non riconosciuto')
    return
  }
  if (cmd.azione === 'versa') {
  const intW = extInt(cmd.wallet_nome) || (cmd.intestatario || '').toLowerCase()
  const intB = extInt(cmd.book_nome) || (cmd.intestatario || '').toLowerCase()
  const wallet = wallets.find(w =>
    (w.nome || '').toLowerCase().includes(cleanN(cmd.wallet_nome)) &&
    (!intW || (w.intestatario || '').toLowerCase().includes(intW))
  ) || wallets.find(w => (w.nome || '').toLowerCase().includes(cleanN(cmd.wallet_nome)))
  const book = books.find(b =>
    (b.nome || '').toLowerCase().includes(cleanN(cmd.book_nome)) &&
    (!intB || (b.intestatario || '').toLowerCase().includes(intB))
  ) || books.find(b => (b.nome || '').toLowerCase().includes(cleanN(cmd.book_nome)))
    if (!wallet || !book || !cmd.importo) { setVoiceStatus('Wallet o book non trovato'); speak('Non ho trovato il wallet o il book'); return }
    if (Number(wallet.saldo) < cmd.importo) { speak('Saldo wallet insufficiente'); return }
    await updateSaldo('wallets', wallet.id, Number(wallet.saldo) - cmd.importo)
    await updateSaldo('books', book.id, Number(book.saldo) + cmd.importo)
    await salvaLogTransazione({
      tipo: 'versa', importo: cmd.importo,
      riferimento: `wallet:${wallet.id}:${wallet.nome}:${wallet.intestatario} -> book:${book.id}:${book.nome}:${book.intestatario}`,
      note: cmd.note || `Versamento vocale da ${wallet.nome} a ${book.nome}`,
      azione: 'wallet_to_book'
    })
    await loadData({ preserveMessages: true })
    setVoiceStatus(`✅ Versati ${cmd.importo}€ da ${wallet.nome} a ${book.nome}`)
    speak(`Fatto. Versati ${cmd.importo} euro da ${wallet.nome} a ${book.nome}`)
    return
  }
  if (cmd.azione === 'trasferisci') {
  const cleanNome = (s) => (s || '').replace(/\s*\(.*?\)/g, '').trim().toLowerCase()
const extractInt = (s) => {
  const match = (s || '').match(/\(([^)]+)\)/)
  return match ? match[1].toLowerCase() : ''
}

const intFrom = extractInt(cmd.wallet_nome)
const intTo = extractInt(cmd.wallet_dest)

const walletFrom = wallets.find(w =>
  (w.nome || '').toLowerCase().includes(cleanNome(cmd.wallet_nome)) &&
  (!intFrom || (w.intestatario || '').toLowerCase().includes(intFrom))
) || wallets.find(w =>
  (w.nome || '').toLowerCase().includes(cleanNome(cmd.wallet_nome))
)
const walletTo = wallets.find(w =>
  (w.nome || '').toLowerCase().includes(cleanNome(cmd.wallet_dest)) &&
  (!intTo || (w.intestatario || '').toLowerCase().includes(intTo))
) || wallets.find(w =>
  (w.nome || '').toLowerCase().includes(cleanNome(cmd.wallet_dest))
)

  const debugMsg = `from: "${cmd.wallet_nome}" int_from: "${cmd.intestatario_from}" | to: "${cmd.wallet_dest}" int_to: "${cmd.intestatario_to}" | importo: ${cmd.importo} | walletFrom: ${walletFrom?.nome} | walletTo: ${walletTo?.nome}`
setVoiceStatus(debugMsg)
if (!walletFrom || !walletTo || !cmd.importo) {
  speak('Wallet non trovato')
  return
}
  if (String(walletFrom.id) === String(walletTo.id)) { speak('Origine e destinazione uguali'); return }
  if (Number(walletFrom.saldo) < cmd.importo) { speak('Saldo insufficiente'); return }
  await updateSaldo('wallets', walletFrom.id, Number(walletFrom.saldo) - cmd.importo)
  await updateSaldo('wallets', walletTo.id, Number(walletTo.saldo) + cmd.importo)
  await salvaLogTransazione({
    tipo: 'trasferisci', importo: cmd.importo,
    riferimento: `wallet:${walletFrom.id}:${walletFrom.nome}:${walletFrom.intestatario} -> wallet:${walletTo.id}:${walletTo.nome}:${walletTo.intestatario}`,
    note: cmd.note || `Trasferimento vocale da ${walletFrom.nome} a ${walletTo.nome}`,
    azione: 'wallet_to_wallet'
  })
  await loadData({ preserveMessages: true })
  setVoiceStatus(`✅ Trasferiti ${cmd.importo}€ da ${walletFrom.nome} (${walletFrom.intestatario}) a ${walletTo.nome} (${walletTo.intestatario})`)
  speak(`Fatto. Trasferiti ${cmd.importo} euro da ${walletFrom.nome} a ${walletTo.nome}`)
  return
}
  
  if (cmd.azione === 'preleva_book') {
    const book = books.find(b =>
      (b.nome || '').toLowerCase().includes((cmd.book_nome || '').toLowerCase()) &&
      (!cmd.intestatario || (b.intestatario || '').toLowerCase().includes(cmd.intestatario.toLowerCase()))
    )
    const wallet = wallets.find(w =>
      (w.nome || '').toLowerCase().includes((cmd.wallet_nome || '').toLowerCase()) &&
      (!cmd.intestatario || (w.intestatario || '').toLowerCase().includes(cmd.intestatario.toLowerCase()))
    )
    if (!book || !wallet || !cmd.importo) { speak('Book o wallet non trovato'); return }
    if (Number(book.saldo) < cmd.importo) { speak('Saldo book insufficiente'); return }
    await updateSaldo('books', book.id, Number(book.saldo) - cmd.importo)
    await updateSaldo('wallets', wallet.id, Number(wallet.saldo) + cmd.importo)
    await salvaLogTransazione({
      tipo: 'preleva', importo: cmd.importo,
      riferimento: `book:${book.id}:${book.nome}:${book.intestatario} -> wallet:${wallet.id}:${wallet.nome}:${wallet.intestatario}`,
      note: cmd.note || `Prelievo vocale da ${book.nome} a ${wallet.nome}`,
      azione: 'book_to_wallet'
    })
    await loadData({ preserveMessages: true })
    setVoiceStatus(`✅ Prelevati ${cmd.importo}€ da ${book.nome} a ${wallet.nome}`)
    speak(`Fatto. Prelevati ${cmd.importo} euro da ${book.nome} a ${wallet.nome}`)
    return
  }
  if (cmd.azione === 'preleva_esterno') {
    const wallet = wallets.find(w =>
      (w.nome || '').toLowerCase().includes((cmd.wallet_nome || '').toLowerCase()) &&
      (!cmd.intestatario || (w.intestatario || '').toLowerCase().includes(cmd.intestatario.toLowerCase()))
    )
    if (!wallet || !cmd.importo) { speak('Wallet non trovato o importo mancante'); return }
    if (Number(wallet.saldo) < cmd.importo) { speak('Saldo wallet insufficiente'); return }
    await updateSaldo('wallets', wallet.id, Number(wallet.saldo) - cmd.importo)
    const riferimento = `wallet:${wallet.id}:${wallet.nome}:${wallet.intestatario} -> esterno`
    await salvaLogTransazione({
      tipo: 'preleva', importo: cmd.importo, riferimento,
      note: cmd.note || `Prelievo esterno vocale da ${wallet.nome}`,
      azione: 'wallet_to_external'
    })
    await salvaSpesaGestione({ importo: cmd.importo, riferimento, note: cmd.note || `Prelievo esterno vocale da ${wallet.nome}` })
    await loadData({ preserveMessages: true })
    setVoiceStatus(`✅ Prelevati ${cmd.importo}€ da ${wallet.nome} verso esterno`)
    speak(`Fatto. Prelevati ${cmd.importo} euro da ${wallet.nome}`)
    return
  }
  if (cmd.azione === 'correggi_book') {
    const book = books.find(b =>
      (b.nome || '').toLowerCase().includes((cmd.book_nome || '').toLowerCase()) &&
      (!cmd.intestatario || (b.intestatario || '').toLowerCase().includes(cmd.intestatario.toLowerCase()))
    )
    if (!book || cmd.nuovo_saldo == null) { speak('Book non trovato o saldo mancante'); return }
    await updateSaldo('books', book.id, cmd.nuovo_saldo)
    await salvaLogTransazione({
      tipo: 'correzione', importo: cmd.nuovo_saldo,
      riferimento: `book:${book.id}:${book.nome}:${book.intestatario}`,
      note: `Correzione saldo vocale → ${cmd.nuovo_saldo}`,
      azione: 'manual_balance_adjustment'
    })
    await loadData({ preserveMessages: true })
    setVoiceStatus(`✅ Saldo ${book.nome} aggiornato a ${cmd.nuovo_saldo}€`)
    speak(`Fatto. Saldo di ${book.nome} aggiornato a ${cmd.nuovo_saldo} euro`)
    return
  }
  if (cmd.azione === 'correggi_wallet') {
    const wallet = wallets.find(w =>
      (w.nome || '').toLowerCase().includes((cmd.wallet_nome || '').toLowerCase()) &&
      (!cmd.intestatario || (w.intestatario || '').toLowerCase().includes(cmd.intestatario.toLowerCase()))
    )
    if (!wallet || cmd.nuovo_saldo == null) { speak('Wallet non trovato o saldo mancante'); return }
    await updateSaldo('wallets', wallet.id, cmd.nuovo_saldo)
    await loadData({ preserveMessages: true })
    setVoiceStatus(`✅ Saldo ${wallet.nome} aggiornato a ${cmd.nuovo_saldo}€`)
    speak(`Fatto. Saldo di ${wallet.nome} aggiornato a ${cmd.nuovo_saldo} euro`)
    return
  }
  setVoiceStatus('Azione non ancora supportata: ' + cmd.azione)
  speak('Azione non ancora supportata')
}
function startListening() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition
  if (!SR) { speak('Microfono non supportato da questo browser'); return }
  const rec = new SR()
  rec.lang = 'it-IT'
  rec.interimResults = false
  rec.maxAlternatives = 1
  rec.onstart = () => { setIsListening(true); setVoiceStatus('In ascolto...'); setVoiceTranscript('') }
  rec.onresult = (e) => {
    const t = e.results[0][0].transcript
    setVoiceTranscript(t)
    setIsListening(false)
    handleVoiceCommand(correggiTrascrizione(t))
  }
  rec.onerror = () => { setIsListening(false); setVoiceStatus('Errore microfono') }
  rec.onend = () => setIsListening(false)
  rec.start()
}

// riferimento al recognizer continuo per poterlo fermare
const continuousRecRef = React.useRef(null)
 const listBufferRef = React.useRef('') 
const mediaRecorderRef = React.useRef(null)
const audioChunksRef = React.useRef([])

function startContinuousListening() {
  if (!navigator.mediaDevices) {
    speak('Microfono non supportato')
    return
  }

  setIsListeningContinuous(true)
  setListBuffer('')
  setVoiceStatus('🔴 Registrazione attiva — parla, poi premi stop')
  speak('Registrazione attiva. Parla e premi stop quando hai finito.')

  navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
    const mediaRecorder = new MediaRecorder(stream)
    mediaRecorderRef.current = mediaRecorder
    audioChunksRef.current = []

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunksRef.current.push(e.data)
    }

    mediaRecorder.onstop = async () => {
      stream.getTracks().forEach(t => t.stop())
      setVoiceStatus('Trascrizione in corso...')
      speak('Elaboro la lista.')

      const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
      const formData = new FormData()
      formData.append('file', blob, 'audio.webm')
      formData.append('model', 'whisper-1')
      formData.append('language', 'it')

      try {
        const res = await fetch('/api/whisper', {
          method: 'POST',
          body: formData
        })
        const data = await res.json()
        const testo = data.text || ''
        setVoiceTranscript(testo)
        setListBuffer(testo)
        setVoiceStatus('Trascritto: ' + testo)
        await handleVoiceCommand(correggiTrascrizione(testo))
      } catch (err) {
        setVoiceStatus('Errore trascrizione: ' + err.message)
        speak('Errore nella trascrizione')
      }
    }

    setTimeout(() => mediaRecorder.start(), 2000)
  }).catch(() => {
    setIsListeningContinuous(false)
    setVoiceStatus('Errore accesso microfono')
  })
}

function stopContinuousListening() {
  if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
    mediaRecorderRef.current.stop()
  }
  mediaRecorderRef.current = null
  setIsListeningContinuous(false)
  setListBuffer('')
}
  async function addMemoFutureNote() {
  if (!memoForm.descrizione.trim()) { setErrorMessage('Inserisci almeno la descrizione'); return }
  const { error } = await supabase.from('memo_future_notes').insert([{
    data_reale: memoForm.data_reale || null,
    data_testo: memoForm.data_testo || memoForm.data_reale || '',
    importo: memoForm.importo ? Number(memoForm.importo) : 0,
    descrizione: memoForm.descrizione.trim(),
    colore: memoForm.colore,
    ordine: memoFutureNotes.length + 1
  }])
  if (error) { setErrorMessage('Errore salvataggio memo'); return }
  setMemoForm({ data_reale: '', data_testo: '', importo: '', descrizione: '', colore: 'normal' })
  await loadData({ preserveMessages: true })
}

async function deleteMemoFutureNote(id) {
  if (!confirm('Eliminare questa memo?')) return
  const { error } = await supabase.from('memo_future_notes').delete().eq('id', id)
  if (error) { setErrorMessage('Errore eliminazione memo'); return }
  await loadData({ preserveMessages: true })
}
  async function updateMemoFutureNote(id, campo, valore) {
  const { error } = await supabase.from('memo_future_notes').update({ [campo]: valore }).eq('id', id)
  if (error) { setErrorMessage('Errore aggiornamento memo'); return }
  await loadData({ preserveMessages: true })
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
  setTxFilters({ tipo: '', azione: '', testo: '', importoMin: '', importoMax: '', dataFrom: '', dataTo: '' })
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

  setStimeCassa(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r))
  setPendingRefresh(true)
}
  async function updateRoyaltyEntry(id, field, value) {
  const { error } = await supabase
    .from('memo_royalty_entries')
    .update({ [field]: value })
    .eq('id', id)

  if (error) {
    setErrorMessage('Errore aggiornamento royalty')
    return
  }

  setMemoRoyaltyEntries(prev =>
    prev.map(r => r.id === id ? { ...r, [field]: value } : r)
  )
}
function parseEuroInput(value) {
  let raw = String(value || '')
    .replace(/€/g, '')
    .replace(/\s/g, '')

  const hasDot = raw.includes('.')
  const hasComma = raw.includes(',')

  if (hasDot && hasComma) {
    raw = raw.replace(/\./g, '').replace(',', '.')
  } else if (hasComma) {
    raw = raw.replace(',', '.')
  }

  return Number(raw)
}

async function updateDashboardSetting(field, value) {
  const numericValue = parseEuroInput(value)

  if (Number.isNaN(numericValue)) {
    setErrorMessage('Inserisci un valore valido')
    return
  }

  const { error } = await supabase
    .from('dashboard_settings')
    .update({ [field]: numericValue })
    .eq('id', 1)

  if (error) {
    setErrorMessage('Errore aggiornamento dashboard settings')
    return
  }

  setDashboardSettings((prev) => ({
    ...prev,
    [field]: numericValue
  }))
}
async function addSavingsRow(persona, periodo, versamento, causale = '') {
  const rows = memoSavingsRows
    .filter(r => r.persona === persona)
    .sort((a, b) => a.ordine - b.ordine)

  const last = rows[rows.length - 1]
  const risparmio = last ? Number(last.montante || 0) : 0
  const stessoPeriodo = rows.some(r => r.periodo === periodo)
  const interesse = stessoPeriodo ? 0 : Math.round(risparmio * 0.005 * 100) / 100
  const montante = Math.round((risparmio + Number(versamento) + interesse) * 100) / 100
  const ordine = last ? last.ordine + 1 : 1

  const { data, error } = await supabase
    .from('memo_savings_rows')
    .insert([{ persona, periodo, versamento: Number(versamento), risparmio, interesse, montante, ordine, causale }])
    .select()
    .single()

  if (error) {
    setErrorMessage('Errore salvataggio risparmio')
    return
  }

  setMemoSavingsRows(prev => [...prev, data])
}

async function upsertRoyaltyEntry(accountId, year, value) {
  const existing = memoRoyaltyEntries.find(
    (r) => Number(r.account_id) === Number(accountId) && Number(r.anno) === Number(year)
  )

  if (existing) {
    return updateRoyaltyEntry(existing.id, 'importo', value)
  }

  const { error } = await supabase
    .from('memo_royalty_entries')
    .insert([{
      account_id: Number(accountId),
      anno: Number(year),
      importo: Number(value),
      mese: '',
      nota: ''
    }])

  if (error) {
    setErrorMessage('Errore creazione voce royalty')
    return
  }

  await loadData({ preserveMessages: true })
} 
// ── CLIENTI CRUD ──────────────────────────────────────────
async function saveCliente(e) {
  e.preventDefault()
  const payload = {
    nome: clienteForm.nome.trim(),
    email: clienteForm.email.trim(),
    telefono: clienteForm.telefono.trim(),
    sim_operatore: clienteForm.sim_operatore.trim(),
    sim_importo: clienteForm.sim_importo ? Number(clienteForm.sim_importo) : 0,
    sim_giorno_scadenza: clienteForm.sim_giorno_scadenza ? Number(clienteForm.sim_giorno_scadenza) : null,
    note: clienteForm.note.trim()
  }
  if (editingCliente) {
    const { error } = await supabase.from('clienti').update(payload).eq('id', editingCliente.id)
    if (error) { setErrorMessage('Errore aggiornamento cliente'); return }
  } else {
    const { data: nuovoCliente, error } = await supabase.from('clienti').insert([payload]).select().single()
    if (error) { setErrorMessage('Errore inserimento cliente'); return }
    // Aggiungi automaticamente tutti i bookmaker in matrice con stato DA APRIRE
    const { data: bookmakerData } = await supabase.from('matrice_bookmakers').select('bookmaker').eq('cliente', 'Sergio Apicella').limit(100)
    const bookmakerUnici = [...new Set((bookmakerData || []).map(m => m.bookmaker))]
    if (bookmakerUnici.length > 0 && nuovoCliente) {
      const righeMatrice = bookmakerUnici.map(book => ({
        bookmaker: book,
        cliente: nuovoCliente.nome,
        stato: 'DA APRIRE'
      }))
      await supabase.from('matrice_bookmakers').insert(righeMatrice)
    }
  }
  setShowClienteModal(false)
  setEditingCliente(null)
  setClienteForm({ nome: '', email: '', telefono: '', sim_operatore: '', sim_importo: '', sim_giorno_scadenza: '', note: '' })
  loadData({ preserveMessages: true })
}

async function deleteCliente(id) {
  if (!window.confirm('Eliminare questo cliente?')) return
  const clienteDaEliminare = clienti.find(c => c.id === id)
  await supabase.from('clienti').delete().eq('id', id)
  if (clienteDaEliminare) await supabase.from('matrice_bookmakers').delete().eq('cliente', clienteDaEliminare.nome)
  loadData({ preserveMessages: true })
}

async function toggleSimRinnovato(cliente) {
  const oggi = new Date()
  const meseKey = `${oggi.getFullYear()}-${String(oggi.getMonth() + 1).padStart(2, '0')}`
  const nuovoRinnovato = !(cliente.sim_rinnovato && cliente.sim_rinnovato_mese === meseKey)
  await supabase.from('clienti').update({
    sim_rinnovato: nuovoRinnovato,
    sim_rinnovato_mese: nuovoRinnovato ? meseKey : null
  }).eq('id', cliente.id)
  setClienti(prev => prev.map(c => c.id === cliente.id ? { ...c, sim_rinnovato: nuovoRinnovato, sim_rinnovato_mese: nuovoRinnovato ? meseKey : null } : c))
}
// ──────────────────────────────────────────────────────────

async function updateStatoStima(row, nuovoStato) {
  const payload = { stato: nuovoStato }

  if (nuovoStato === 'annullato') {
    payload.importo = 0
  }

  const { error } = await supabase
    .from('stime_cassa')
    .update(payload)
    .eq('id', row.id)

  if (error) {
    setErrorMessage('Errore aggiornamento stato contabilità')
    return
  }

  setStimeCassa(prev => prev.map(r => r.id === row.id ? { ...r, ...payload } : r))
  setPendingRefresh(true)
} 
  async function salvaLogTransazione({ tipo, importo, riferimento, note, azione, categoria_spesa }) {
    return supabase.from('transactions').insert([{
      tipo,
      importo,
      riferimento,
      note,
      data: new Date().toISOString(),
      azione,
      ...(categoria_spesa ? { categoria_spesa } : {})
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

    setMessage('Movimento eliminato e saldi ripristinati')
    await loadData({ preserveMessages: true })
  } catch (error) {
    setErrorMessage(`Errore eliminazione movimento: ${error.message}`)
  }
}
  function resetTxForm() {
    setTxForm({ tipo: '', da_tipo: '', importo: '', da_id: '', a_id: '', note: '', categoria_spesa: '' })
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


setShowBookModal(false)
setBookForm({ nome: '', intestatario: '', saldo: '', note: '' })
setMessage('Book salvato correttamente')
await loadData({ preserveMessages: true })
  }
async function addRoyaltyAccount() {
  if (!newAccountName.trim()) {
    setErrorMessage('Inserisci un nome account')
    return
  }

  const { error } = await supabase
    .from('memo_royalty_accounts')
    .insert([{ nome: newAccountName.trim() }])

  if (error) {
    setErrorMessage('Errore creazione account')
    return
  }

  setNewAccountName('')
  setMessage('Account aggiunto')
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
    

    const saldoPrecedente = Number(selectedBook.saldo || 0)
    const differenza = nuovoSaldo - saldoPrecedente

    let r = await updateSaldo('books', selectedBook.id, nuovoSaldo)
    if (r.error) return setErrorMessage(`Errore correzione saldo: ${r.error.message}`)

    r = await salvaLogTransazione({
      tipo: 'correzione',
      importo: Math.abs(differenza),
      riferimento: `${selectedBook.nome}${selectedBook.intestatario ? ` (${selectedBook.intestatario})` : ''} | ${formatCurrency(saldoPrecedente)} -> ${formatCurrency(nuovoSaldo)}`,
      note: `Correzione saldo manuale. Delta: ${formatCurrency(differenza)}${adjustSaldoForm.note.trim() ? `. Motivo: ${adjustSaldoForm.note.trim()}` : ''}`,
      azione: 'manual_balance_adjustment',
    })
    if (r.error) return setErrorMessage(`Errore correzione saldo: ${r.error.message}`)

    setShowAdjustSaldoModal(false)
    setSelectedBook(null)
    setMessage('Saldo corretto e transazione registrata')
    await loadData({ preserveMessages: true })
  }
  async function handleSalvaBookSaldi() {
    const entries = Object.entries(pendingBookSaldi)
    if (entries.length === 0) return
    let errori = []
    for (const [idStr, valoreRaw] of entries) {
      const id = Number(idStr)
      const nuovoSaldo = Number(String(valoreRaw).replace(',', '.'))
      const book = books.find(b => b.id === id)
      if (!book || Number.isNaN(nuovoSaldo) || nuovoSaldo < 0) continue
      const saldoPrecedente = Number(book.saldo || 0)
      if (nuovoSaldo === saldoPrecedente) continue
      const differenza = nuovoSaldo - saldoPrecedente
      let r = await updateSaldo('books', id, nuovoSaldo)
      if (r.error) { errori.push(book.nome); continue }
      const intestatario = book.intestatario ? ` (${book.intestatario})` : ''
      r = await salvaLogTransazione({
        tipo: 'correzione',
        importo: Math.abs(differenza),
        riferimento: `${book.nome}${intestatario} | ${formatCurrency(saldoPrecedente)} -> ${formatCurrency(nuovoSaldo)}`,
        note: `Correzione saldo inline. Delta: ${formatCurrency(differenza)}`,
        azione: 'manual_balance_adjustment',
      })
      if (r.error) errori.push(`tx:${book.nome}`)
    }
    setPendingBookSaldi({})
    if (errori.length > 0) setErrorMessage(`Errori: ${errori.join(', ')}`)
    else setMessage(`✅ ${entries.length} saldo/i aggiornati e transazioni registrate`)
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
if (nota === null) return

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
    note: `Correzione saldo wallet manuale. Delta: ${formatCurrency(differenza)}${nota.trim() ? `. Motivo: ${nota.trim()}` : ''}`,
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
  

  const saldoPrecedente = Number(selectedWallet.saldo || 0)
  const differenza = nuovoSaldo - saldoPrecedente

  let r = await updateSaldo('wallets', selectedWallet.id, nuovoSaldo)
  if (r.error) return setErrorMessage(`Errore correzione saldo wallet: ${r.error.message}`)

  r = await salvaLogTransazione({
    tipo: 'correzione',
    importo: Math.abs(differenza),
    riferimento: `${selectedWallet.nome} | ${formatCurrency(saldoPrecedente)} -> ${formatCurrency(nuovoSaldo)}`,
    note: `Correzione saldo wallet manuale. Delta: ${formatCurrency(differenza)}${adjustWalletSaldoForm.note.trim() ? `. Motivo: ${adjustWalletSaldoForm.note.trim()}` : ''}`,
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
      // book_to_wallet: il book può andare in negativo, nessun controllo saldo
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
        r = await salvaLogTransazione({ tipo: 'preleva', importo, riferimento, note: txForm.note || `Prelievo esterno da wallet ${wallet.nome}`, azione: 'wallet_to_external', categoria_spesa: txForm.categoria_spesa || null })
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

const totalePrelieviEsterniStorici = totaleEsterni

const totaleUsciteEsterne = ultimoSnapshot
  ? totalePrelieviEsterniStorici - Number(ultimoSnapshot.external_withdrawals || 0)
  : totalePrelieviEsterniStorici

const guadagnoCorrente =
  (totaleCassa - basePeriodo) + totaleUsciteEsterne
  
  const filteredBooks = useMemo(() =>
  books
    .filter((book) => {
      const nomeMatch = (book.nome || '').toLowerCase().includes(bookFilters.nome.toLowerCase())
      const intestatarioMatch = (book.intestatario || '').toLowerCase().includes(bookFilters.intestatario.toLowerCase())
      const saldoMinMatch = bookFilters.saldoMin === '' ? true : Number(book.saldo || 0) >= Number(bookFilters.saldoMin)
      const saldoMaxMatch = bookFilters.saldoMax === '' ? true : Number(book.saldo || 0) <= Number(bookFilters.saldoMax)
      return nomeMatch && intestatarioMatch && saldoMinMatch && saldoMaxMatch
    })
    .sort((a, b) => Number(b.saldo || 0) - Number(a.saldo || 0))
, [books, bookFilters])

  const filteredWallets = useMemo(() =>
  wallets
    .filter((wallet) => {
      const nomeMatch = (wallet.nome || '').toLowerCase().includes(walletFilters.nome.toLowerCase())
      const intestatarioMatch = (wallet.intestatario || '').toLowerCase().includes(walletFilters.intestatario.toLowerCase())
      const saldoMinMatch = walletFilters.saldoMin === '' ? true : Number(wallet.saldo || 0) >= Number(walletFilters.saldoMin)
      const saldoMaxMatch = walletFilters.saldoMax === '' ? true : Number(wallet.saldo || 0) <= Number(walletFilters.saldoMax)
      return nomeMatch && intestatarioMatch && saldoMinMatch && saldoMaxMatch
    })
    .sort((a, b) => Number(b.saldo || 0) - Number(a.saldo || 0))
, [wallets, walletFilters])

  const filteredTransactions = useMemo(() => transactions.filter((tx) => {
  const tipoMatch = txFilters.tipo ? tx.tipo === txFilters.tipo : true
  const azioneMatch = txFilters.azione ? (tx.azione || '') === txFilters.azione : true
  const text = `${tx.riferimento || ''} ${tx.note || ''} ${tx.azione || ''}`.toLowerCase()
  const testoMatch = text.includes(txFilters.testo.toLowerCase())
  const importoMinMatch = txFilters.importoMin === '' ? true : Number(tx.importo || 0) >= Number(txFilters.importoMin)
  const importoMaxMatch = txFilters.importoMax === '' ? true : Number(tx.importo || 0) <= Number(txFilters.importoMax)
  const txDate = tx.data ? new Date(tx.data) : null
  const dataFromMatch = txFilters.dataFrom === '' ? true : txDate && txDate >= new Date(txFilters.dataFrom + 'T00:00:00')
  const dataToMatch = txFilters.dataTo === '' ? true : txDate && txDate <= new Date(txFilters.dataTo + 'T23:59:59')
  return tipoMatch && azioneMatch && testoMatch && importoMinMatch && importoMaxMatch && dataFromMatch && dataToMatch
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
      const currentKey = formatMonthKey()
      if (a.key === currentKey) return -1
      if (b.key === currentKey) return 1
      const aIsFuture = a.key > currentKey
      const bIsFuture = b.key > currentKey
      if (aIsFuture && bIsFuture) {
        if (a.anno !== b.anno) return a.anno - b.anno
        return a.mese - b.mese
      }
      if (!aIsFuture && !bIsFuture) {
        if (a.anno !== b.anno) return b.anno - a.anno
        return b.mese - a.mese
      }
      return aIsFuture ? -1 : 1
    })
}, [stimeCassa])

const meseCorrenteKey = formatMonthKey()

function handleTabChange(tab) {
  if (pendingRefresh && activeTab === 'contabilita' && tab !== 'contabilita') {
    const conferma = window.confirm('⚠️ Hai modifiche non aggiornate in Contabilità.\nVuoi aggiornare prima di cambiare tab?')
    if (conferma) {
      loadData({ preserveMessages: true }).then(() => {
        setPendingRefresh(false)
        setActiveTab(tab)
      })
      return
    }
    setPendingRefresh(false)
  }
  setActiveTab(tab)
}

const currentMonthRef = React.useRef(null)
useEffect(() => {
  if (activeTab === 'contabilita' && currentMonthRef.current) {
    setTimeout(() => {
      currentMonthRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 150)
  }
}, [activeTab])

const totaleSpeseMeseCorrente = useMemo(() => {
  const meseCorrente = stimeCassaByMonth.find((item) => item.key === meseCorrenteKey)

  if (!meseCorrente) return 0

  return meseCorrente.rows.reduce((sum, row) => {
    return row.stato === 'previsto'
      ? sum + Number(row.importo || 0)
      : sum
  }, 0)
}, [stimeCassaByMonth, meseCorrenteKey])
 const prelievoDelMese = Math.abs(Number(totaleSpeseMeseCorrente || 0))
const meseCorrenteNum = new Date().getMonth() + 1

// Spese programmate totale anno (tutte le voci previsto di tutti i mesi)
const totaleSpeseProgrammateAnno = useMemo(() => {
  const annoCorrente = new Date().getFullYear()
  return stimeCassa
    .filter(r => r.stato === 'previsto' && Number(r.anno) === annoCorrente)
    .reduce((sum, r) => sum + Math.abs(Number(r.importo || 0)), 0)
}, [stimeCassa])

// Media mensile residua: spese anno / mesi rimanenti (escluso mese corrente)
const mediaMensileResidua = useMemo(() => {
  const mesiRimanenti = 12 - meseCorrenteNum
  if (mesiRimanenti <= 0) return 0
  return totaleSpeseProgrammateAnno / mesiRimanenti
}, [totaleSpeseProgrammateAnno, meseCorrenteNum])
const royaltyTotale2026 = memoRoyaltyEntries
  .filter(r => Number(r.anno) === 2026)
  .reduce((sum, r) => sum + Number(r.importo || 0), 0)
const royaltyPagato2026 = memoRoyaltyEntries
  .filter(r => Number(r.anno) === 2026)
  .reduce((sum, r) => sum + Number(r.pagato || 0), 0)
const mediaMensileRoyalty = royaltyTotale2026 / 12
const accantonamentoRoyalty = (mediaMensileRoyalty * meseCorrenteNum) - royaltyPagato2026
const massiRows = memoSavingsRows.filter(r => r.persona === 'massimiliano').sort((a, b) => a.ordine - b.ordine)
const samuRows = memoSavingsRows.filter(r => r.persona === 'samuele').sort((a, b) => a.ordine - b.ordine)
const massiMontante = massiRows.length > 0 ? Number(massiRows[massiRows.length - 1].montante || 0) : 0
const samuMontante = samuRows.length > 0 ? Number(samuRows[samuRows.length - 1].montante || 0) : 0
const risparmiSamuMassi = massiMontante + samuMontante

const cassaDisponibile =
  totaleCassa -
  prelievoDelMese -
  accantonamentoRoyalty -
  risparmiSamuMassi

const targetCassa = Number(dashboardSettings.target_cassa || 0)
const mancaAlTarget = targetCassa > 0 ? targetCassa - cassaDisponibile : 0
const targetRaggiunto = targetCassa > 0 && cassaDisponibile >= targetCassa
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
      return <>
        <select name='da_id' value={txForm.da_id} onChange={handleTransactionChange} style={input}><option value=''>Seleziona wallet origine</option>{wallets.map((wallet) => <option key={wallet.id} value={wallet.id}>{getEntityLabel(wallet)}</option>)}</select>
        <select name='categoria_spesa' value={txForm.categoria_spesa} onChange={handleTransactionChange} style={{ ...input, borderColor: txForm.categoria_spesa ? 'rgba(56,189,248,0.6)' : 'rgba(51,65,85,0.6)', color: txForm.categoria_spesa ? '#38bdf8' : '#94a3b8' }}>
          <option value=''>📂 Categoria spesa (opzionale)</option>
          <option value='Casa'>🏠 Casa</option>
          <option value='Auto'>🚗 Auto</option>
          <option value='Alimentari'>🛒 Alimentari</option>
          <option value='Ristoranti/Svago/Viaggi'>✈️ Ristoranti/Svago/Viaggi</option>
          <option value='Abbigliamento'>👕 Abbigliamento</option>
          <option value='Salute/Farmacia'>💊 Salute/Farmacia</option>
          <option value='Tecnologia/Abbonamenti'>📱 Tecnologia/Abbonamenti</option>
          <option value='Famiglia'>👨‍👩‍👦 Famiglia</option>
          <option value='Attività Lavorativa'>💼 Attività Lavorativa</option>
          <option value='Altro'>📦 Altro</option>
          <option value='Spese Personali Sergio'>🚬 Spese Personali Sergio</option>
        </select>
      </>
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
     {message && (
  <div style={{
    position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)',
    background: 'rgba(15,23,42,0.97)', border: '1px solid rgba(56,189,248,0.4)',
    color: '#f8fafc', padding: '10px 24px', borderRadius: 12, zIndex: 9999,
    fontSize: 13, fontWeight: 600, boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
    whiteSpace: 'nowrap'
  }}>{message}</div>
)} 
      <style>{`
        @keyframes blinkBorder {
          0%, 100% { border-color: #ef4444; }
          50% { border-color: transparent; }
          }
@keyframes blinkPrevisto {
  0%, 100% { box-shadow: 0 0 0px rgba(59,130,246,0); }
  50%       { box-shadow: 0 0 10px rgba(59,130,246,0.55); }
}
        }
      `}</style>
      <div style={pageWrap}>
        <header style={header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <img src="/WhatsApp Image 2026-05-23 at 22.05.05.jpeg" alt="SGM Logo" style={{ width: 80, height: 80, borderRadius: 14, objectFit: 'cover' }} />
            <div>
              <h1 style={title}>Profit Tracker - La scalata al SUCCESSO</h1>
              <p style={subtitle}>books · wallets · transactions</p>
            </div>
          </div>
          <div style={copyrightBox}>© Sergio Apicella — Tutti i diritti riservati</div>
        </header>

        <div style={{ display: 'flex', alignItems: 'stretch', gap: 10, marginBottom: 12 }}>
          {guadagnoCorrente >= mediaMensileResidua && mediaMensileResidua > 0 && (
            <div style={{ flex: 1, background: 'linear-gradient(135deg, rgba(34,197,94,0.15), rgba(16,185,129,0.10))', border: '2px solid rgba(34,197,94,0.5)', borderRadius: 14, padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12, animation: 'blinkPrevisto 2s ease-in-out infinite' }}>
              <span style={{ fontSize: 28 }}>🏆</span>
              <div>
                <div style={{ color: '#22c55e', fontWeight: 900, fontSize: 15 }}>BRAVO! SPESE COPERTE PER QUESTO MESE!</div>
                <div style={{ color: '#86efac', fontSize: 12, marginTop: 2 }}>Profitto {formatCurrency(guadagnoCorrente)} · Obiettivo {formatCurrency(mediaMensileResidua)} · Sei a +{formatCurrency(guadagnoCorrente - mediaMensileResidua)} 💪</div>
              </div>
            </div>
          )}
          <div style={{ flex: '0 0 260px', border: `1px solid ${targetRaggiunto ? 'rgba(34,197,94,0.5)' : 'rgba(168,85,247,0.5)'}`, background: targetRaggiunto ? 'rgba(34,197,94,0.08)' : 'rgba(168,85,247,0.06)', color: '#f8fafc', padding: '10px 16px', borderRadius: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: targetRaggiunto ? '#22c55e' : '#a855f7', marginBottom: 6, letterSpacing: 1 }}>🎯 TARGET CASSA</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type='text'
                defaultValue={targetCassa ? targetCassa.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''}
                placeholder='Es. 100.000,00'
                onFocus={(e) => { e.target.value = targetCassa || '' }}
                onBlur={(e) => {
                  updateDashboardSetting('target_cassa', e.target.value)
                  const num = parseEuroInput(e.target.value)
                  if (!isNaN(num)) e.target.value = num.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                }}
                onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur() }}
                style={{ background: 'transparent', border: 'none', borderBottom: `1px solid ${targetRaggiunto ? 'rgba(34,197,94,0.5)' : 'rgba(168,85,247,0.5)'}`, color: '#f8fafc', fontWeight: 800, fontSize: 16, width: 130, outline: 'none', padding: '2px 0' }}
              />
              <span style={{ color: '#94a3b8', fontSize: 14 }}>€</span>
            </div>
            {targetCassa > 0 && (
              <div style={{ marginTop: 6 }}>
                {targetRaggiunto
                  ? <span style={{ color: '#22c55e', fontWeight: 900, fontSize: 13 }}>🎉 TARGET RAGGIUNTO! +{formatCurrency(cassaDisponibile - targetCassa)}</span>
                  : <span style={{ color: '#f87171', fontWeight: 900, fontSize: 14, animation: 'blinkPrevisto 1.5s ease-in-out infinite' }}>Mancano {formatCurrency(mancaAlTarget)} 🔥</span>
                }
              </div>
            )}
          </div>
        </div>

        {message && <div style={successBox}>{message}</div>}

        {promozioneDettaglio && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(2,6,23,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000, padding: 16 }}>
            <div style={{ width: '100%', maxWidth: 600, background: 'linear-gradient(180deg,rgba(15,23,42,0.99),rgba(2,6,23,1))', border: '2px solid rgba(56,189,248,0.4)', borderRadius: 22, padding: 24, maxHeight: '85vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div style={{ flex: 1, marginRight: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 6, background: (promozioneDettaglio.priorita||'').toLowerCase() === 'alta' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.12)', color: (promozioneDettaglio.priorita||'').toLowerCase() === 'alta' ? '#f87171' : '#fbbf24' }}>{promozioneDettaglio.priorita}</span>
                    <span style={{ fontWeight: 700, color: '#f8fafc', fontSize: 14 }}>{promozioneDettaglio.clienti?.nome}</span>
                  </div>
                  <div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{promozioneDettaglio.oggetto}</div>
                  <div style={{ color: '#94a3b8', fontSize: 12 }}>Da: {promozioneDettaglio.mittente}</div>
                  {promozioneDettaglio.data_mail && <div style={{ color: '#64748b', fontSize: 11, marginTop: 2 }}>{new Date(promozioneDettaglio.data_mail).toLocaleDateString('it-IT')}</div>}
                </div>
                <button style={{ border: '1px solid rgba(71,85,105,0.95)', background: 'rgba(15,23,42,0.82)', color: '#e2e8f0', width: 38, height: 38, borderRadius: 12, cursor: 'pointer', fontSize: 18, flexShrink: 0 }}
                  onClick={() => { setPromozioneDettaglio(null); setTestoLive('') }}>×</button>
              </div>
              <div style={{ background: 'rgba(11,18,32,0.8)', border: '1px solid rgba(51,65,85,0.6)', borderRadius: 12, padding: 16, color: '#cbd5e1', fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word', minHeight: 80 }}>
                {testoLoading
                  ? <span style={{ color: '#64748b' }}>⏳ Caricamento testo...</span>
                  : testoLive || promozioneDettaglio.testo_completo || <span style={{ color: '#64748b' }}>Nessun testo disponibile</span>
                }
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
                <button
                  onClick={async () => {
                    if (!window.confirm('Eliminare questa promozione?')) return
                    await supabase.from('promozioni_clienti').delete().eq('id', promozioneDettaglio.id)
                    setPromozioni(prev => prev.filter(pr => pr.id !== promozioneDettaglio.id))
                    setPromozioneDettaglio(null)
                  }}
                  style={{ padding: '10px 18px', borderRadius: 12, border: 'none', background: 'rgba(239,68,68,0.15)', color: '#f87171', cursor: 'pointer', fontSize: 13, fontWeight: 800 }}>🗑️ Elimina</button>
                <button style={{ padding: '10px 22px', borderRadius: 12, border: 'none', background: '#38bdf8', color: '#0f172a', cursor: 'pointer', fontSize: 13, fontWeight: 800 }}
                  onClick={() => { setPromozioneDettaglio(null); setTestoLive('') }}>Chiudi</button>
              </div>
            </div>
          </div>
        )}

        {showPromozioniManualiPopup && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(2,6,23,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2300, padding: 16 }}>
            <div style={{ width: '100%', maxWidth: 560, background: 'linear-gradient(180deg,rgba(15,23,42,0.99),rgba(2,6,23,1))', border: '2px solid rgba(56,189,248,0.5)', borderRadius: 22, padding: 24, maxHeight: '80vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <h2 style={{ margin: 0, color: '#f8fafc', fontSize: 18 }}>📬 Lettura manuale</h2>
                  <p style={{ margin: '4px 0 0', color: '#94a3b8', fontSize: 13 }}>{promozioniManualiEmail} · {promozioniManuali.length} promozioni trovate</p>
                </div>
                <button style={{ border: '1px solid rgba(71,85,105,0.95)', background: 'rgba(15,23,42,0.82)', color: '#e2e8f0', width: 38, height: 38, borderRadius: 12, cursor: 'pointer', fontSize: 18 }}
                  onClick={() => setShowPromozioniManualiPopup(false)}>×</button>
              </div>
              {promozioniManuali.length === 0
                ? <p style={{ color: '#94a3b8', textAlign: 'center', padding: '20px 0' }}>Nessuna promozione trovata</p>
                : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {promozioniManuali.map((p, idx) => (
                      <div key={idx} style={{ background: 'rgba(11,18,32,0.85)', border: `1px solid ${(p.priorita||'').toLowerCase() === 'alta' ? 'rgba(239,68,68,0.35)' : (p.priorita||'').toLowerCase() === 'media' ? 'rgba(245,158,11,0.3)' : 'rgba(34,197,94,0.25)'}`, borderRadius: 12, padding: '10px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 6,
                            background: (p.priorita||'').toLowerCase() === 'alta' ? 'rgba(239,68,68,0.15)' : (p.priorita||'').toLowerCase() === 'media' ? 'rgba(245,158,11,0.12)' : 'rgba(34,197,94,0.12)',
                            color: (p.priorita||'').toLowerCase() === 'alta' ? '#f87171' : (p.priorita||'').toLowerCase() === 'media' ? '#fbbf24' : '#22c55e'
                          }}>{(p.priorita||'').toLowerCase() === 'alta' ? '🔥' : (p.priorita||'').toLowerCase() === 'media' ? '⚡' : '✅'} {p.priorita}</span>
                          <span style={{ fontSize: 11, color: '#64748b' }}>{p.tipo}</span>
                        </div>
                        <div style={{ color: '#f8fafc', fontWeight: 700, fontSize: 13, marginBottom: 3 }}>{p.subject}</div>
                        <div style={{ color: '#94a3b8', fontSize: 12 }}>Da: {p.from}</div>
                        {p.date && <div style={{ color: '#64748b', fontSize: 11, marginTop: 2 }}>{new Date(p.date).toLocaleDateString('it-IT')}</div>}
                      </div>
                    ))}
                  </div>
                )
              }
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
                <button style={{ padding: '10px 22px', borderRadius: 12, border: 'none', background: '#38bdf8', color: '#0f172a', cursor: 'pointer', fontSize: 13, fontWeight: 800 }}
                  onClick={() => setShowPromozioniManualiPopup(false)}>Chiudi</button>
              </div>
            </div>
          </div>
        )}

        {showPromozioniPopup && (() => {
          const altePriorita = promozioni.filter(p => (p.priorita||'').toLowerCase() === 'alta' && !p.letta)
          const tutteNonLette = promozioni.filter(p => !p.letta).sort((a,b) => { const ord={alta:0,media:1,bassa:2}; return (ord[(a.priorita||'').toLowerCase()]||1)-(ord[(b.priorita||'').toLowerCase()]||1) })
          if (tutteNonLette.length === 0) return null
          return (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(2,6,23,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2200, padding: 16 }}>
              <div style={{ width: '100%', maxWidth: 540, background: 'linear-gradient(180deg,rgba(15,23,42,0.99),rgba(2,6,23,1))', border: '2px solid rgba(239,68,68,0.6)', borderRadius: 22, padding: 24, maxHeight: '80vh', overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div>
                    <h2 style={{ margin: 0, color: '#f8fafc', fontSize: 18 }}>🔥 PROMOZIONI</h2>
                    <p style={{ margin: '4px 0 0', color: '#94a3b8', fontSize: 13 }}>{tutteNonLette.length} totali · {altePriorita.length} alta priorità</p>
                  </div>
                  <button style={{ border: '1px solid rgba(71,85,105,0.95)', background: 'rgba(15,23,42,0.82)', color: '#e2e8f0', width: 38, height: 38, borderRadius: 12, cursor: 'pointer', fontSize: 18 }}
                    onClick={() => setShowPromozioniPopup(false)}>×</button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {tutteNonLette.map((p, idx) => (
                    <div key={idx} style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 12, padding: '10px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 6, background: 'rgba(239,68,68,0.15)', color: '#f87171' }}>🔥 ALTA</span>
                        <span style={{ fontWeight: 700, color: '#f8fafc', fontSize: 13 }}>{p.clienti?.nome || ''}</span>
                      </div>
                      <div style={{ color: '#fca5a5', fontWeight: 700, fontSize: 13 }}>{p.oggetto}</div>
                      <div style={{ color: '#94a3b8', fontSize: 11, marginTop: 2 }}>Da: {p.mittente}</div>
                      <div style={{ color: '#64748b', fontSize: 11 }}>{p.tipo} · {p.data_mail ? new Date(p.data_mail).toLocaleDateString('it-IT') : new Date(p.created_at).toLocaleDateString('it-IT')}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
                  <button style={{ padding: '10px 22px', borderRadius: 12, border: 'none', background: '#ef4444', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 800 }}
                    onClick={() => {
                      setPromozioni(prev => prev.map(p => tutteNonLette.find(a => a.id === p.id) ? { ...p, letta: true } : p))
                      setShowPromozioniPopup(false)
                      Promise.all(tutteNonLette.map(p => supabase.from('promozioni_clienti').update({ letta: true }).eq('id', p.id)))
                    }}>Visto, chiudi</button>
                </div>
              </div>
            </div>
          )
        })()}

        {showAgendaPopup && (() => {
          const giorno = new Date().getDay()
          const giornoLabel = ['Domenica','Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato'][giorno]
          const bookiConAzioni = books
            .filter(b => b.profilo_livello === 'attivo' || (b.profilo_livello && b.profilo_livello.startsWith('mantenimento')))
            .map(b => ({ book: b, agenda: getAzioniOggi(b) }))
            .filter(x => x.agenda !== null)
          return (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(2,6,23,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: 16 }}>
              <div style={{ width: '100%', maxWidth: 560, background: 'linear-gradient(180deg,rgba(15,23,42,0.99),rgba(2,6,23,1))', border: '1px solid rgba(51,65,85,0.95)', borderRadius: 22, padding: 24, maxHeight: '80vh', overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div>
                    <h2 style={{ margin: 0, color: '#f8fafc', fontSize: 18 }}>📋 Agenda di oggi — {giornoLabel}</h2>
                    <p style={{ margin: '4px 0 0', color: '#94a3b8', fontSize: 13 }}>{bookiConAzioni.filter(x=>x.agenda.tipo==='attivo').length} attivi · {bookiConAzioni.filter(x=>x.agenda.tipo!=='attivo').length} mantenimento · {bookiConAzioni.length} totali</p>
                  </div>
                  <button style={{ border: '1px solid rgba(71,85,105,0.95)', background: 'rgba(15,23,42,0.82)', color: '#e2e8f0', width: 38, height: 38, borderRadius: 12, cursor: 'pointer', fontSize: 18 }}
                    onClick={() => { setShowAgendaPopup(false); setAgendaVista(true); localStorage.setItem('agendaVistaData', new Date().toISOString().split('T')[0]) }}>×</button>
                </div>
                {bookiConAzioni.length === 0 ? (
                  <div style={{ color: '#94a3b8', textAlign: 'center', padding: '24px 0' }}>Nessuna azione prevista per oggi 🎉</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {(() => {
                      const gruppi = {}
                      bookiConAzioni.forEach(({ book, agenda }) => {
                        agenda.azioni.forEach(az => {
                          if (!gruppi[az]) gruppi[az] = []
                          gruppi[az].push(book)
                        })
                      })
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {Object.entries(gruppi).map(([azione, bookList]) => {
                            const perBook = {}
                            bookList.forEach(b => {
                              if (!perBook[b.nome]) perBook[b.nome] = []
                              perBook[b.nome].push(b.intestatario)
                            })
                            const isOpen = popupAperto === azione
                            return (
                              <div key={azione} style={{ background: 'rgba(11,18,32,0.8)', border: `1px solid ${isOpen ? 'rgba(56,189,248,0.4)' : 'rgba(51,65,85,0.75)'}`, borderRadius: 12, overflow: 'hidden' }}>
                                <div onClick={() => setPopupAperto(popupAperto === azione ? null : azione)}
                                  style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
                                  <span style={{ color: '#38bdf8', fontSize: 12, display: 'inline-block', transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
                                  <span style={{ fontWeight: 700, color: '#f8fafc', fontSize: 13 }}>{azione}</span>
                                  <span style={{ marginLeft: 'auto', fontSize: 11, background: 'rgba(56,189,248,0.12)', color: '#38bdf8', padding: '2px 8px', borderRadius: 6, fontWeight: 700 }}>{bookList.length}</span>
                                </div>
                                {isOpen && (
                                  <div style={{ padding: '4px 14px 10px', borderTop: '1px solid rgba(51,65,85,0.4)', display: 'flex', flexDirection: 'column', gap: 3 }}>
                                    {Object.entries(perBook).map(([bookNome, intestatari]) => (
                                      <div key={bookNome} style={{ fontSize: 12, color: '#cbd5e1', padding: '2px 0' }}>
                                        <span style={{ color: '#38bdf8', fontWeight: 700 }}>{bookNome}</span>
                                        <span style={{ color: '#64748b' }}> — </span>
                                        <span style={{ color: '#94a3b8' }}>{intestatari.join(', ')}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )
                    })()}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 10, marginTop: 16, justifyContent: 'flex-end' }}>
                  <button style={{ padding: '10px 18px', borderRadius: 12, border: '1px solid rgba(51,65,85,0.95)', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: 13 }}
                    onClick={() => { setShowAgendaPopup(false); setAgendaVista(true); localStorage.setItem('agendaVistaData', new Date().toISOString().split('T')[0]) }}>Chiudi</button>
                  <button style={{ padding: '10px 18px', borderRadius: 12, border: 'none', background: '#1D4ED8', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}
                    onClick={() => { setShowAgendaPopup(false); setAgendaVista(true); setActiveTab('profilazione'); localStorage.setItem('agendaVistaData', new Date().toISOString().split('T')[0]) }}>Vai a Profilazione →</button>
                </div>
              </div>
            </div>
          )
        })()}
        {errorMessage && <div style={errorBox}>{errorMessage}</div>}

        <nav style={tabsBar}>
          <button style={activeTab === 'dashboard' ? activeTabButton : tabButton} onClick={() => handleTabChange('dashboard')}>Dashboard</button>
          <button style={activeTab === 'books' ? activeTabButton : tabButton} onClick={() => handleTabChange('books')}>Books</button>
          <button style={activeTab === 'wallets' ? activeTabButton : tabButton} onClick={() => handleTabChange('wallets')}>Wallets</button>
          <button style={activeTab === 'transactions' ? activeTabButton : tabButton} onClick={() => handleTabChange('transactions')}>Transactions</button>
          <button style={activeTab === 'periodi' ? activeTabButton : tabButton} onClick={() => handleTabChange('periodi')}>Periodi</button>
          <button style={activeTab === 'memo' ? activeTabButton : tabButton} onClick={() => handleTabChange('memo')}>Memo</button>
          <button style={activeTab === 'profilazione' ? activeTabButton : tabButton} onClick={() => handleTabChange('profilazione')}>Profilazione</button>
         <button
  style={activeTab === 'clienti' ? activeTabButton : tabButton}
  onClick={() => handleTabChange('clienti')}
>Clienti</button>

  <button style={activeTab === 'matrice' ? activeTabButton : tabButton} onClick={() => handleTabChange('matrice')}>Matrice</button>
          <button style={activeTab === 'archivio-mail' ? activeTabButton : tabButton} onClick={() => handleTabChange('archivio-mail')}>📧 Archivio Mail</button>
          <button style={activeTab === 'punti-monete' ? activeTabButton : tabButton} onClick={() => handleTabChange('punti-monete')}>🏆 Punti &amp; Monete</button>
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
      const dataReale = `${annoCorrente}-${String(meseCorrente).padStart(2,'0')}-${String(giorno).padStart(2,'0')}`
      const diff = Math.ceil((new Date(dataReale + 'T00:00:00') - oggi) / (1000 * 60 * 60 * 24))
      return { descrizione: row.voce || 'Spesa contabilità', diff, tipo: 'contabilita' }
    })
    .filter(r => r.diff <= 7)

  // Scadenze SIM (2 giorni prima)
  const meseKey2 = `${annoCorrente}-${String(meseCorrente).padStart(2,'0')}`
  const scadenzeSim = clienti
    .filter(c => c.sim_giorno_scadenza)
    .map(c => {
      const dataReale = `${annoCorrente}-${String(meseCorrente).padStart(2,'0')}-${String(c.sim_giorno_scadenza).padStart(2,'0')}`
      const diff = Math.ceil((new Date(dataReale + 'T00:00:00') - oggi) / (1000 * 60 * 60 * 24))
      const rinnovato = c.sim_rinnovato && c.sim_rinnovato_mese === meseKey2
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
</div>

              <div style={heroSideGrid}>
  <div style={panel}>
    <div style={panelHeader}>
      <div>
        <h2 style={panelTitle}>Accantonamento royalty</h2>
      </div>
    </div>

   
     <div style={{ position: 'relative' }}>
  <input
    value={Number(accantonamentoRoyalty || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'}
    readOnly
    onChange={() => {}}
    onFocus={(e) => {
      e.target.value = Number(accantonamentoRoyalty ?? 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    }}
    onBlur={(e) => {
      updateDashboardSetting('accantonamento_royalty', e.target.value)
      const raw = String(e.target.value || '')
        .replace(/€/g, '')
        .replace(/\s/g, '')
        .replace(/\./g, '')
        .replace(',', '.')
      const num = Number(raw)
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
        updateDashboardSetting('accantonamento_royalty', e.target.value)
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
        e.target.value = Number(accantonamentoRoyalty || 0).toLocaleString('it-IT', {
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
  <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 6 }}>
    {formatCurrency(mediaMensileRoyalty)} × {meseCorrenteNum} mesi
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
    sub={`Su ${12 - meseCorrenteNum} mesi rimanenti · obiettivo minimo`}
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
       {activeTab === 'profilazione' && (() => {
  const intestatari = [...new Set(books.map(b => b.intestatario).filter(Boolean))].sort()
  const giorno = new Date().getDay()
  const giornoLabel = ['Domenica','Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato'][giorno]
  const agendaOggi = books
    .filter(b => b.profilo_livello === 'attivo' || (b.profilo_livello && b.profilo_livello.startsWith('mantenimento')))
    .map(b => ({ book: b, agenda: getAzioniOggi(b) }))
    .filter(x => x.agenda !== null)

  const filteredProf = books.filter(b => {
    const matchInt = !profilazioneFilter.intestatario || (b.intestatario || '').toLowerCase().includes(profilazioneFilter.intestatario.toLowerCase())
    const matchBook = !profilazioneFilter.book || (b.nome || '').toLowerCase().includes(profilazioneFilter.book.toLowerCase())
    const matchLiv = !profilazioneFilter.livello || b.profilo_livello === profilazioneFilter.livello || (profilazioneFilter.livello === 'mantenimento' && b.profilo_livello && b.profilo_livello.startsWith('mantenimento'))
    const matchSearch = !profilazioneSearch || (b.nome || '').toLowerCase().includes(profilazioneSearch.toLowerCase()) || (b.intestatario || '').toLowerCase().includes(profilazioneSearch.toLowerCase())
    return matchInt && matchBook && matchLiv && matchSearch
  })

  const totAttivi = books.filter(b => b.profilo_livello === 'attivo').length
  const totMantenimento = books.filter(b => b.profilo_livello && b.profilo_livello.startsWith('mantenimento')).length
  const totDormienti = books.filter(b => b.profilo_livello === 'dormiente').length
  const totNessuno = books.filter(b => !b.profilo_livello).length
  const capitaleStimato = books.filter(b => b.profilo_livello === 'attivo').reduce((sum, b) => {
    const proto = getProtocollo(b.nome)
    return sum + (proto.capitale_min || 200)
  }, 0)

  const getLivelloBadge = (livello) => {
    if (livello === 'attivo') return { bg: 'rgba(34,197,94,0.18)', color: '#22c55e', label: '🟢 Attivo' }
    if (livello && livello.startsWith('mantenimento')) { const cls = livello.split('-')[1]?.toUpperCase() || ''; return { bg: 'rgba(251,191,36,0.18)', color: '#fbbf24', label: `🟡 Mant.${cls}` } }
    if (livello === 'dormiente') return { bg: 'rgba(100,116,139,0.18)', color: '#94a3b8', label: '⚫ Dormiente' }
    return { bg: 'rgba(51,65,85,0.3)', color: '#64748b', label: '— Non impostato' }
  }

  return (
    <div style={tabContent}>
      <div style={sectionTopBar}>
        <div>
          <h2 style={sectionTitle}>Profilazione</h2>
          <p style={sectionDescription}>Gestisci il livello di profilazione per ogni account bookmaker</p>
        </div>
        <button style={{ ...tinyBlueButton, fontSize: 13, padding: '8px 16px' }} onClick={() => setShowAgendaPopup(true)}>📋 Agenda di oggi</button>
      </div>

      {agendaOggi.length > 0 && (
        <div style={{ background: 'rgba(29,78,216,0.12)', border: '1px solid rgba(29,78,216,0.35)', borderRadius: 16, padding: '16px 20px', marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#93c5fd', marginBottom: 12 }}>📋 {giornoLabel} — {agendaOggi.length} account da movimentare oggi <span style={{ fontSize: 12, fontWeight: 400, color: '#64748b' }}>({agendaOggi.filter(x => x.agenda.tipo === 'attivo').length} attivi · {agendaOggi.filter(x => x.agenda.tipo !== 'attivo').length} mantenimento)</span></div>
          {(() => {
            const gruppi = {}
            agendaOggi.forEach(({ book, agenda }) => {
              agenda.azioni.forEach(az => {
                if (!gruppi[az]) gruppi[az] = []
                gruppi[az].push({ book, badge: agenda.badge })
              })
            })
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {Object.entries(gruppi).map(([azione, items]) => {
                  const perBook = {}
                  items.forEach(({ book }) => {
                    if (!perBook[book.nome]) perBook[book.nome] = []
                    perBook[book.nome].push(book.intestatario)
                  })
                  const isOpen = agendaAperto === azione
                  return (
                    <div key={azione} style={{ background: 'rgba(11,18,32,0.7)', borderRadius: 12, border: `1px solid ${isOpen ? 'rgba(56,189,248,0.4)' : 'rgba(51,65,85,0.6)'}`, overflow: 'hidden' }}>
                      <div onClick={() => setAgendaAperto(agendaAperto === azione ? null : azione)}
                        style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
                        <span style={{ color: '#38bdf8', fontSize: 13, transition: 'transform 0.2s', display: 'inline-block', transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
                        <span style={{ fontWeight: 700, color: '#f8fafc', fontSize: 13 }}>{azione}</span>
                        <span style={{ marginLeft: 'auto', fontSize: 12, background: 'rgba(56,189,248,0.12)', color: '#38bdf8', padding: '2px 8px', borderRadius: 6, fontWeight: 700 }}>{items.length}</span>
                      </div>
                      {isOpen && (
                        <div style={{ padding: '4px 14px 12px', borderTop: '1px solid rgba(51,65,85,0.4)', display: 'flex', flexDirection: 'column', gap: 3 }}>
                          {Object.entries(perBook).map(([bookNome, intestatari]) => (
                            <div key={bookNome} style={{ fontSize: 12, color: '#cbd5e1', padding: '3px 0' }}>
                              <span style={{ color: '#38bdf8', fontWeight: 700 }}>{bookNome}</span>
                              <span style={{ color: '#64748b' }}> — </span>
                              <span style={{ color: '#94a3b8' }}>{intestatari.join(', ')}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })()}
        </div>
      )}

      <div style={statsGridCompact}>
        <div style={{ background: 'rgba(34,197,94,0.10)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 16, padding: '14px 18px' }}>
          <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>Attivi</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#22c55e' }}>{totAttivi}</div>
        </div>
        <div style={{ background: 'rgba(251,191,36,0.10)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: 16, padding: '14px 18px' }}>
          <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>Mantenimento</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#fbbf24' }}>{totMantenimento}</div>
        </div>
        <div style={{ background: 'rgba(100,116,139,0.10)', border: '1px solid rgba(100,116,139,0.25)', borderRadius: 16, padding: '14px 18px' }}>
          <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>Dormienti</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#94a3b8' }}>{totDormienti}</div>
        </div>
        <div style={{ background: 'rgba(11,18,32,0.8)', border: '1px solid rgba(51,65,85,0.85)', borderRadius: 16, padding: '14px 18px' }}>
          <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>Non impostati</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#f8fafc' }}>{totNessuno}</div>
        </div>
        <div style={{ background: 'rgba(56,189,248,0.10)', border: '1px solid rgba(56,189,248,0.25)', borderRadius: 16, padding: '14px 18px' }}>
          <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>Capitale stimato attivi</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#38bdf8' }}>{formatCurrency(capitaleStimato)}</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        <input style={filterInput} placeholder="Cerca book o intestatario..." value={profilazioneSearch} onChange={e => setProfilazioneSearch(e.target.value)} />
        <select style={filterInput} value={profilazioneFilter.livello} onChange={e => setProfilazioneFilter(p => ({ ...p, livello: e.target.value }))}>
          <option value="">Tutti i livelli</option>
          <option value="attivo">🟢 Attivi</option>
          <option value="mantenimento">🟡 Mantenimento</option>
          <option value="dormiente">⚫ Dormienti</option>
        </select>
        <select style={filterInput} value={profilazioneFilter.intestatario} onChange={e => setProfilazioneFilter(p => ({ ...p, intestatario: e.target.value }))}>
          <option value="">Tutti gli intestatari</option>
          {intestatari.map(i => <option key={i} value={i}>{i}</option>)}
        </select>
        <button style={tinyBlueButton} onClick={() => { setProfilazioneFilter({ intestatario: '', book: '', livello: '' }); setProfilazioneSearch('') }}>Pulisci</button>
      </div>

      <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 10 }}>{filteredProf.length} account visualizzati</div>

      <div style={tableWrap}>
        <table style={table}>
          <thead>
            <tr>
              <th style={th}>Book</th>
              <th style={th}>Intestatario</th>
              <th style={th}>Livello</th>
              <th style={th}>Protocollo</th>
              <th style={th}>Capitale min</th>
              <th style={th}>Inizio ciclo</th>
              <th style={thActions}>Azioni</th>
            </tr>
          </thead>
          <tbody>
            {filteredProf.map(book => {
              const proto = getProtocollo(book.nome)
              const badge = getLivelloBadge(book.profilo_livello)
              return (
                <tr key={book.id} style={tr}>
                  <td style={tdStrong}>{book.nome}</td>
                  <td style={td}>{book.intestatario || '-'}</td>
                  <td style={td}>
                    <span style={{ background: badge.bg, color: badge.color, padding: '4px 10px', borderRadius: 8, fontSize: 12, fontWeight: 700 }}>{badge.label}</span>
                  </td>
                  <td style={{ ...td, maxWidth: 280 }}>
                    <div style={{ fontSize: 12, color: '#94a3b8' }}>
                      <div style={{ color: '#38bdf8', fontWeight: 700, marginBottom: 4 }}>{proto.durata}</div>
                      {proto.azioni.map((a, i) => <div key={i} style={{ marginBottom: 2 }}>• {a}</div>)}
                    </div>
                  </td>
                  <td style={td}>{formatCurrency(proto.capitale_min)}</td>
                  <td style={{ ...td, fontSize: 12 }}>{book.profilo_ciclo_inizio || '—'}</td>
                  <td style={tdActions}>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button style={{ ...tinyGreenButton, opacity: book.profilo_livello === 'attivo' ? 0.4 : 1, fontSize: 11 }}
                        disabled={savingProfilo[book.id] || book.profilo_livello === 'attivo'}
                        onClick={() => updateProfiloLivello(book.id, 'attivo')}>Attivo</button>
                      <button style={{ ...tinyOrangeButton, opacity: book.profilo_livello === 'mantenimento-a' ? 0.4 : 1, fontSize: 11 }}
                        disabled={savingProfilo[book.id] || book.profilo_livello === 'mantenimento-a'}
                        onClick={() => updateProfiloLivello(book.id, 'mantenimento-a')}>Mant.A</button>
                      <button style={{ ...tinyOrangeButton, background: 'rgba(245,158,11,0.18)', opacity: book.profilo_livello === 'mantenimento-b' ? 0.4 : 1, fontSize: 11 }}
                        disabled={savingProfilo[book.id] || book.profilo_livello === 'mantenimento-b'}
                        onClick={() => updateProfiloLivello(book.id, 'mantenimento-b')}>Mant.B</button>
                      <button style={{ ...tinyOrangeButton, background: 'rgba(100,116,139,0.18)', color: '#94a3b8', opacity: book.profilo_livello === 'mantenimento-c' ? 0.4 : 1, fontSize: 11 }}
                        disabled={savingProfilo[book.id] || book.profilo_livello === 'mantenimento-c'}
                        onClick={() => updateProfiloLivello(book.id, 'mantenimento-c')}>Mant.C</button>
                      <button style={{ ...tinyRedButton, background: book.profilo_livello === 'dormiente' ? '#334155' : undefined, opacity: book.profilo_livello === 'dormiente' ? 0.4 : 1, fontSize: 11 }}
                        disabled={savingProfilo[book.id] || book.profilo_livello === 'dormiente'}
                        onClick={() => updateProfiloLivello(book.id, 'dormiente')}>Dorm.</button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
})()}
       {activeTab === 'clienti' && (
  <div style={tabContent}>
    <div style={sectionTopBar}>
      <div>
        <h2 style={sectionTitle}>Clienti</h2>
        <p style={sectionDescription}>Gestione clienti, SIM e scadenze</p>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button style={primaryButtonGreen} onClick={() => { setEditingCliente(null); setClienteForm({ nome: '', email: '', telefono: '', sim_operatore: '', sim_importo: '', sim_giorno_scadenza: '', note: '' }); setShowClienteModal(true) }}>+ Nuovo Cliente</button>
        <button
          onClick={async () => {
            setSyncInCorso(true)
            setSyncLog([])
            setShowSyncLog(true)
            let totSalvate = 0
            try {
              const emailsConToken = clientiEmail.filter(e => e.gmail_refresh_token)
              for (const emailRow of emailsConToken) {
                try {
                  setSyncLog(prev => [...prev, { email: emailRow.email, stato: '⏳ in corso...' }])
                  const res = await fetch(`/api/gmail/sync?secret=pt_cron_2026_sergio&email_id=${emailRow.id}`)
                  const data = await res.json()
                  const r = (data.risultati || [])[0] || {}
                  const riga = r.errore
                    ? { email: emailRow.email, stato: `❌ ${r.errore}` }
                    : { email: emailRow.email, stato: `✅ ${r.mailTrovate||0} mail · ${r.promozioniTrovate||0} promo · ${r.salvate||0} salvate · ${r.duplicate||0} duplicate` }
                  setSyncLog(prev => prev.map(l => l.email === emailRow.email ? riga : l))
                  totSalvate += r.salvate || 0
                } catch(e) {
                  setSyncLog(prev => prev.map(l => l.email === emailRow.email ? { email: emailRow.email, stato: `❌ ${String(e)}` } : l))
                }
              }
              await loadData({ preserveMessages: true })
              setMessage(totSalvate > 0 ? `📧 ${totSalvate} nuove promozioni trovate!` : '📧 Nessuna novità')
              setTimeout(() => setMessage(''), 4000)
            } finally {
              setSyncInCorso(false)
            }
          }}
          disabled={syncInCorso}
          style={{ padding: '10px 16px', borderRadius: 12, border: '1px solid rgba(56,189,248,0.5)', background: syncInCorso ? 'rgba(51,65,85,0.3)' : 'rgba(56,189,248,0.1)', color: syncInCorso ? '#64748b' : '#38bdf8', fontWeight: 800, fontSize: 13, cursor: syncInCorso ? 'not-allowed' : 'pointer' }}
        >{syncInCorso ? '⏳ Sincronizzazione...' : '🔄 Sincronizza tutto'}</button>
        {showSyncLog && syncLog.length > 0 && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: '#0f172a', border: '1px solid rgba(56,189,248,0.3)', borderRadius: 16, padding: 24, width: 600, maxHeight: '80vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ color: '#38bdf8', margin: 0 }}>📧 Log Sincronizzazione</h3>
                {!syncInCorso && <button onClick={() => setShowSyncLog(false)} style={{ background: 'rgba(239,68,68,0.2)', color: '#f87171', border: 'none', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontWeight: 700 }}>Chiudi</button>}
              </div>
              {syncLog.map((l, i) => (
                <div key={i} style={{ padding: '8px 12px', marginBottom: 6, background: 'rgba(255,255,255,0.04)', borderRadius: 8, fontSize: 12, fontFamily: 'monospace' }}>
                  <span style={{ color: '#94a3b8' }}>{l.email}</span>
                  <br/>
                  <span style={{ color: '#e2e8f0' }}>{l.stato}</span>
                </div>
              ))}
              {syncInCorso && <div style={{ color: '#38bdf8', textAlign: 'center', marginTop: 12, fontSize: 13 }}>⏳ Sincronizzazione in corso...</div>}
            </div>
          </div>
        )}
        {promozioni.length > 0 && (
          <button
            onClick={() => setShowPromozioniPopup(true)}
            style={{ padding: '10px 16px', borderRadius: 12, border: '1px solid rgba(239,68,68,0.5)', background: 'rgba(239,68,68,0.1)', color: '#f87171', fontWeight: 800, fontSize: 13, cursor: 'pointer', animation: 'blinkPrevisto 2s ease-in-out infinite' }}
          >🔥 {promozioni.filter(p => !p.letta).length} promozioni nuove</button>
        )}
      </div>
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
      {clienti.length === 0 && <p style={{ color: '#94a3b8' }}>Nessun cliente ancora. Clicca "+ Nuovo Cliente" per iniziare.</p>}
      {clienti.map(c => {
        const oggi = new Date()
        const meseKey = `${oggi.getFullYear()}-${String(oggi.getMonth() + 1).padStart(2, '0')}`
        const rinnovato = c.sim_rinnovato && c.sim_rinnovato_mese === meseKey
        return (
          <div key={c.id} style={{ background: 'rgba(11,18,32,0.85)', border: '1px solid rgba(51,65,85,0.8)', borderRadius: 14, padding: '14px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <span style={{ fontWeight: 900, fontSize: 15, color: '#f8fafc' }}>{c.nome}</span>
                  {c.sim_operatore && (
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: rinnovato ? 'rgba(34,197,94,0.15)' : 'rgba(251,191,36,0.12)', color: rinnovato ? '#22c55e' : '#fbbf24', fontWeight: 700 }}>
                      📱 {c.sim_operatore} {c.sim_importo ? `· ${Number(c.sim_importo).toFixed(2)}€` : ''} {c.sim_giorno_scadenza ? `· scad. g.${c.sim_giorno_scadenza}` : ''}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 13, color: '#94a3b8' }}>
                  {c.telefono && <span>📞 {c.telefono}</span>}
                  {c.note && <span style={{ color: '#64748b' }}>📝 {c.note}</span>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>
                  {clientiEmail.filter(e => e.cliente_id === c.id).map(em => (
                    <div key={em.id} style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 12, color: '#94a3b8' }}>✉️ {em.email}</span>
                      {em.label && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'rgba(51,65,85,0.6)', color: '#64748b' }}>{em.label}</span>}
                      <button
                        onClick={() => window.open(`/api/gmail/auth?email=${encodeURIComponent(em.email)}&email_id=${em.id}`, '_blank')}
                        style={{ padding: '3px 8px', borderRadius: 8, border: `1px solid ${em.gmail_access_token ? 'rgba(34,197,94,0.4)' : 'rgba(168,85,247,0.4)'}`, background: em.gmail_access_token ? 'rgba(34,197,94,0.08)' : 'rgba(168,85,247,0.08)', color: em.gmail_access_token ? '#22c55e' : '#a855f7', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}
                      >{em.gmail_access_token ? '✅ Auth' : '🔗 Autorizza'}</button>
                      {em.gmail_access_token && (
                        <button
                          onClick={async () => {
                            const res = await fetch(`/api/gmail/read?email_id=${em.id}`)
                            const data = await res.json()
                            setPromozioniManuali(data.promozioni || [])
                            setPromozioniManualiEmail(`${em.email} · ${data.totale_mail || 0} mail lette · ${data.salvate || 0} salvate`)
                            setShowPromozioniManualiPopup(true)
                            if (data.salvate > 0) await loadData({ preserveMessages: true })
                          }}
                          style={{ padding: '3px 8px', borderRadius: 8, border: '1px solid rgba(56,189,248,0.4)', background: 'rgba(56,189,248,0.08)', color: '#38bdf8', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}
                        >📬 Leggi</button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {c.sim_operatore && (
                  <button
                    onClick={() => toggleSimRinnovato(c)}
                    style={{ padding: '6px 12px', borderRadius: 10, border: `1px solid ${rinnovato ? 'rgba(34,197,94,0.5)' : 'rgba(251,191,36,0.4)'}`, background: rinnovato ? 'rgba(34,197,94,0.1)' : 'rgba(251,191,36,0.08)', color: rinnovato ? '#22c55e' : '#fbbf24', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
                  >{rinnovato ? '✅ Rinnovato' : '🔄 Segna rinnovato'}</button>
                )}
                <button onClick={() => { setEditingCliente(c); setClienteForm({ nome: c.nome, email: c.email || '', telefono: c.telefono || '', sim_operatore: c.sim_operatore || '', sim_importo: c.sim_importo || '', sim_giorno_scadenza: c.sim_giorno_scadenza || '', note: c.note || '' }); setShowClienteModal(true) }} style={{ padding: '6px 12px', borderRadius: 10, border: '1px solid rgba(56,189,248,0.4)', background: 'rgba(56,189,248,0.08)', color: '#38bdf8', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>✏️ Modifica</button>
                {c.email && (
                  <button
                    onClick={() => window.open(`/api/gmail/auth?email=${encodeURIComponent(c.email)}`, '_blank')}
                    style={{ padding: '6px 12px', borderRadius: 10, border: `1px solid ${c.gmail_access_token ? 'rgba(34,197,94,0.4)' : 'rgba(168,85,247,0.4)'}`, background: c.gmail_access_token ? 'rgba(34,197,94,0.08)' : 'rgba(168,85,247,0.08)', color: c.gmail_access_token ? '#22c55e' : '#a855f7', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
                  >{c.gmail_access_token ? '✅ Gmail OK' : '🔗 Autorizza Gmail'}</button>
                )}
                {c.gmail_access_token && (
                  <button
                    onClick={async () => {
                      const res = await fetch(`/api/gmail/read?cliente_id=${c.id}`)
                      const data = await res.json()
                      setPromozioniManuali(data.promozioni || [])
                      setPromozioniManualiEmail(`${c.nome} · ${data.totale_mail || 0} mail lette · ${data.salvate || 0} salvate`)
                      setShowPromozioniManualiPopup(true)
                      if (data.salvate > 0) await loadData({ preserveMessages: true })
                    }}
                    style={{ padding: '6px 12px', borderRadius: 10, border: '1px solid rgba(56,189,248,0.4)', background: 'rgba(56,189,248,0.08)', color: '#38bdf8', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
                  >📬 Leggi mail</button>
                )}
                <button onClick={() => { setDocCliente(c); setDocPassword(''); setDocPasswordOk(false); setDocPasswordError(''); setDocFiles([]); setDocLoading(false); setDocUploading(false) }} style={{ padding: '6px 12px', borderRadius: 10, border: '1px solid rgba(251,191,36,0.4)', background: 'rgba(251,191,36,0.08)', color: '#fbbf24', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>📁 Documenti</button>
                <button onClick={() => deleteCliente(c.id)} style={{ padding: '6px 12px', borderRadius: 10, border: '1px solid rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.08)', color: '#f87171', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>🗑️</button>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  </div>
)}

  
      {activeTab === 'matrice' && (
  <div style={tabContent}>
    <div style={sectionTopBar}>
      <div>
        <h2 style={sectionTitle}>📊 Matrice Bookmakers</h2>
        <p style={sectionDescription}>Stato apertura book per ogni cliente</p>
      </div>
    </div>

    {/* Statistiche */}
    <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
      {[
        { label: 'Totale DA APRIRE', value: matrice.filter(r => r.stato === 'DA APRIRE').length, color: '#f87171' },
        { label: 'Totale APERTI', value: matrice.filter(r => r.stato === 'APERTO').length, color: '#22c55e' },
        { label: 'Bookmaker', value: [...new Set(matrice.map(r => r.bookmaker))].length, color: '#38bdf8' },
        { label: 'Clienti', value: [...new Set(matrice.map(r => r.cliente))].length, color: '#a78bfa' },
      ].map(s => (
        <div key={s.label} style={{ background: 'rgba(15,23,42,0.8)', border: `1px solid ${s.color}33`, borderRadius: 12, padding: '10px 18px', minWidth: 140 }}>
          <div style={{ color: s.color, fontWeight: 800, fontSize: 20 }}>{s.value}</div>
          <div style={{ color: '#64748b', fontSize: 11 }}>{s.label}</div>
        </div>
      ))}
    </div>

    {/* Filtri */}
    <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
      <select value={matriceFiltroVista} onChange={e => setMatriceFiltroVista(e.target.value)}
        style={{ background: 'rgba(15,23,42,0.9)', border: '1px solid rgba(56,189,248,0.3)', color: '#f8fafc', borderRadius: 8, padding: '6px 10px', fontSize: 12 }}>
        <option value="cliente">Vista per Cliente</option>
        <option value="bookmaker">Vista per Bookmaker</option>
      </select>
      <select value={matriceFiltroStato} onChange={e => setMatriceFiltroStato(e.target.value)}
        style={{ background: 'rgba(15,23,42,0.9)', border: '1px solid rgba(56,189,248,0.3)', color: '#f8fafc', borderRadius: 8, padding: '6px 10px', fontSize: 12 }}>
        <option value="">Tutti</option>
        <option value="DA APRIRE">Solo DA APRIRE</option>
        <option value="APERTO">Solo APERTI</option>
      </select>
      {matriceFiltroVista === 'cliente' ? (
        <input value={matriceFiltroCliente} onChange={e => setMatriceFiltroCliente(e.target.value)}
          placeholder="Cerca cliente..." style={{ background: 'rgba(15,23,42,0.9)', border: '1px solid rgba(56,189,248,0.3)', color: '#f8fafc', borderRadius: 8, padding: '6px 10px', fontSize: 12, width: 160 }} />
      ) : (
        <input value={matriceFiltroBook} onChange={e => setMatriceFiltroBook(e.target.value)}
          placeholder="Cerca bookmaker..." style={{ background: 'rgba(15,23,42,0.9)', border: '1px solid rgba(56,189,248,0.3)', color: '#f8fafc', borderRadius: 8, padding: '6px 10px', fontSize: 12, width: 160 }} />
      )}
      {(matriceFiltroCliente || matriceFiltroBook) && (
        <button onClick={() => { setMatriceFiltroCliente(''); setMatriceFiltroBook('') }}
          style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.08)', color: '#f87171', fontSize: 11, cursor: 'pointer' }}>✕ Pulisci</button>
      )}
    </div>

    {/* Lista accordion */}
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {(() => {
        const gruppi = matriceFiltroVista === 'cliente'
          ? [...new Set(matrice.map(r => r.cliente))].filter(c => !matriceFiltroCliente || c.toLowerCase().includes(matriceFiltroCliente.toLowerCase())).sort()
          : [...new Set(matrice.map(r => r.bookmaker))].filter(b => !matriceFiltroBook || b.toLowerCase().includes(matriceFiltroBook.toLowerCase())).sort()

        return gruppi.map(gruppo => {
          const righe = matrice.filter(r =>
            (matriceFiltroVista === 'cliente' ? r.cliente === gruppo : r.bookmaker === gruppo) &&
            (!matriceFiltroStato || r.stato === matriceFiltroStato)
          )
          if (righe.length === 0) return null
          const daAprire = righe.filter(r => r.stato === 'DA APRIRE').length
          const expanded = matriceAperto === gruppo

          return (
            <div key={gruppo} style={{ background: 'rgba(11,18,32,0.85)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: 14 }}>
              <div onClick={() => setMatriceAperto(expanded ? null : gruppo)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontWeight: 800, color: '#f8fafc', fontSize: 14 }}>{gruppo}</span>
                  {daAprire > 0 && <span style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>{daAprire} da aprire</span>}
                  <span style={{ color: '#64748b', fontSize: 11 }}>{righe.length} totali</span>
                </div>
                <span style={{ color: '#64748b' }}>{expanded ? '▲' : '▼'}</span>
              </div>
              {expanded && (
                <div style={{ borderTop: '1px solid rgba(56,189,248,0.1)', padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {righe.map(r => (
                    <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', borderRadius: 8, background: r.stato === 'APERTO' ? 'rgba(34,197,94,0.05)' : 'rgba(239,68,68,0.05)', border: `1px solid ${r.stato === 'APERTO' ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: r.stato === 'APERTO' ? '#22c55e' : '#f87171' }}>{r.stato === 'APERTO' ? '✅' : '🔴'} {r.stato}</span>
                        <span style={{ color: '#e2e8f0', fontSize: 13 }}>{matriceFiltroVista === 'cliente' ? r.bookmaker : r.cliente}</span>
                      </div>
                      {r.stato === 'DA APRIRE' && (
                        <button onClick={async () => {
                          if (!window.confirm(`Segnare ${r.bookmaker} — ${r.cliente} come APERTO e creare il Book?`)) return
                          await supabase.from('matrice_bookmakers').update({ stato: 'APERTO', updated_at: new Date().toISOString() }).eq('id', r.id)
                          await supabase.from('books').insert([{ nome: r.bookmaker, intestatario: r.cliente, saldo: 0, note: 'Aperto da Matrice' }])
                          setMatrice(prev => prev.map(m => m.id === r.id ? { ...m, stato: 'APERTO' } : m))
                          setMessage(`✅ ${r.bookmaker} aperto per ${r.cliente}!`)
                          setTimeout(() => setMessage(''), 3000)
                        }}
                          style={{ padding: '4px 10px', borderRadius: 8, border: '1px solid rgba(34,197,94,0.4)', background: 'rgba(34,197,94,0.1)', color: '#22c55e', fontSize: 11, cursor: 'pointer', fontWeight: 700 }}>
                          ✅ Segna aperto
                        </button>
                      )}
                      {r.stato === 'APERTO' && (
                        <button onClick={async () => {
                          // Cerca il book corrispondente
                          const { data: bookTrovato } = await supabase.from('books').select('id').eq('nome', r.bookmaker).eq('intestatario', r.cliente).maybeSingle()
                          if (bookTrovato) {
                            // Controlla se ha transazioni
                            const { data: txBook } = await supabase.from('transactions').select('id').eq('book_id', bookTrovato.id).limit(1)
                            if (txBook && txBook.length > 0) {
                              window.alert(`⚠️ Il book ${r.bookmaker} — ${r.cliente} ha transazioni collegate e non può essere eliminato automaticamente. Eliminalo manualmente dalla sezione Books.`)
                              return
                            }
                          }
                          if (!window.confirm(`Chiudere ${r.bookmaker} — ${r.cliente}? Il book verrà eliminato.`)) return
                          await supabase.from('matrice_bookmakers').update({ stato: 'DA APRIRE', updated_at: new Date().toISOString() }).eq('id', r.id)
                          if (bookTrovato) await supabase.from('books').delete().eq('id', bookTrovato.id)
                          setMatrice(prev => prev.map(m => m.id === r.id ? { ...m, stato: 'DA APRIRE' } : m))
                          setMessage(`🔴 ${r.bookmaker} chiuso per ${r.cliente}`)
                          setTimeout(() => setMessage(''), 3000)
                        }}
                          style={{ padding: '4px 10px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.08)', color: '#f87171', fontSize: 11, cursor: 'pointer', fontWeight: 700 }}>
                          🔴 Chiudi
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })
      })()}
    </div>
  </div>
)}     
       {activeTab === 'archivio-mail' && (() => {
  const BOOK_PRINCIPALI = ['sisal','bet365','pokerstars','snai','lottomatica','eurobet','betfair','planetwin','goldbet']

  // Estrai tutti i mittenti unici dalle promozioni e costruisci lista colonne
  const tutteLePromo = promozioni
  const mittenteNormalizzato = (m) => {
    if (!m) return ''
    const s = m.toLowerCase()
    // estrai dominio o nome principale
    const match = s.match(/@([\w.-]+)/) || s.match(/([\w-]+)\.(it|com|eu|net)/)
    if (match) {
      const parts = match[1].split('.')
      return parts[parts.length - 1] || parts[0]
    }
    return s.split(' ')[0].replace(/[^a-z0-9]/g, '')
  }

  const bookmakerDaPromo = [...new Set(tutteLePromo.map(p => {
    const norm = mittenteNormalizzato(p.mittente)
    // Trova se corrisponde a un principale
    const principale = BOOK_PRINCIPALI.find(bp => norm.includes(bp) || p.mittente?.toLowerCase().includes(bp))
    return principale ? principale : (p.mittente || '').toLowerCase().trim()
  }))].filter(Boolean)

  const principaliPresenti = BOOK_PRINCIPALI.filter(bp => bookmakerDaPromo.includes(bp))
  const altriPresenti = bookmakerDaPromo
    .filter(b => !BOOK_PRINCIPALI.includes(b))
    .sort((a, b) => a.localeCompare(b))
  const colonneBook = [...principaliPresenti, ...altriPresenti]

  // Raggruppa promozioni per cliente + bookmaker
  const getBookKey = (mittente) => {
    if (!mittente) return ''
    const norm = mittenteNormalizzato(mittente)
    const principale = BOOK_PRINCIPALI.find(bp => norm.includes(bp) || mittente.toLowerCase().includes(bp))
    return principale ? principale : mittente.toLowerCase().trim()
  }

  // Clienti ordinati alfabeticamente
  const clientiOrdinati = [...clienti].sort((a, b) => a.nome.localeCompare(b.nome))

  // Filtro mittente (ricerca rapida)
  const colonneFiltered = archivioSearch
    ? colonneBook.filter(b => b.toLowerCase().includes(archivioSearch.toLowerCase()))
    : colonneBook

  return (
    <div style={tabContent}>
      <div style={{ marginBottom: 16 }}>
        <div style={sectionTopBar}>
          <div>
            <h2 style={sectionTitle}>📧 Archivio Mail</h2>
            <p style={sectionDescription}>Promozioni ricevute per cliente × bookmaker · clicca il numero per leggere le mail</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
          <input
            placeholder="🔍 Filtra bookmaker/mittente..."
            value={archivioSearch}
            onChange={e => setArchivioSearch(e.target.value)}
            style={{ ...filterInput, maxWidth: 200 }}
          />
          <input
            placeholder="👤 Filtra cliente..."
            value={archivioFiltroCliente}
            onChange={e => setArchivioFiltroCliente(e.target.value)}
            style={{ ...filterInput, maxWidth: 180 }}
          />
          <input
            type="date"
            value={archivioFiltroData}
            onChange={e => setArchivioFiltroData(e.target.value)}
            style={{ ...filterInput, maxWidth: 160 }}
          />
          {(archivioSearch || archivioFiltroCliente || archivioFiltroData) && (
            <button
              onClick={() => { setArchivioSearch(''); setArchivioFiltroCliente(''); setArchivioFiltroData('') }}
              style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.1)', color: '#f87171', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
            >✕ Azzera filtri</button>
          )}
        </div>
      </div>

      {colonneBook.length === 0 ? (
        <div style={{ marginTop: 32, color: '#94a3b8', textAlign: 'center', fontSize: 15 }}>
          Nessuna promozione in archivio. Sincronizza le mail dalla tab Clienti.
        </div>
      ) : (
        <div style={{ overflowX: 'auto', marginTop: 16, borderRadius: 16, border: '1px solid rgba(51,65,85,0.7)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: Math.max(600, 160 + colonneFiltered.length * 100) }}>
            <thead>
              <tr>
                <th style={{ ...th, position: 'sticky', left: 0, zIndex: 4, background: '#0b1220', minWidth: 140, borderRight: '1px solid rgba(51,65,85,0.7)' }}>
                  Cliente
                </th>
                {colonneFiltered.map(book => (
                  <th key={book} style={{ ...th, textAlign: 'center', minWidth: 90, padding: '12px 8px' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 7px',
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 800,
                      background: BOOK_PRINCIPALI.includes(book) ? 'rgba(56,189,248,0.12)' : 'rgba(51,65,85,0.4)',
                      color: BOOK_PRINCIPALI.includes(book) ? '#38bdf8' : '#94a3b8',
                      textTransform: 'capitalize'
                    }}>{book}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {clientiOrdinati
                .filter(c => !archivioFiltroCliente || c.nome.toLowerCase().includes(archivioFiltroCliente.toLowerCase()))
                .map(c => {
                const promoCliente = tutteLePromo.filter(p => {
                  if (p.cliente_id !== c.id && p.clienti?.nome !== c.nome) return false
                  if (archivioFiltroData) {
                    const dataMail = p.data_mail ? new Date(p.data_mail) : new Date(p.created_at)
                    const filtroDate = new Date(archivioFiltroData)
                    if (dataMail.toDateString() !== filtroDate.toDateString()) return false
                  }
                  return true
                })
                const haAlcunaPromo = colonneFiltered.some(book => promoCliente.filter(p => getBookKey(p.mittente) === book).length > 0)
                if (!haAlcunaPromo) return null
                return (
                  <tr key={c.id} style={{ ...tr }}>
                    <td style={{ ...tdStrong, position: 'sticky', left: 0, background: '#0b1220', zIndex: 2, borderRight: '1px solid rgba(51,65,85,0.7)', fontSize: 13 }}>
                      {c.nome}
                    </td>
                    {colonneFiltered.map(book => {
                      const mailCella = promoCliente.filter(p => getBookKey(p.mittente) === book)
                      const nonLette = mailCella.filter(p => !p.letta).length
                      return (
                        <td key={book} style={{ ...td, textAlign: 'center', padding: '10px 8px', verticalAlign: 'middle' }}>
                          {mailCella.length > 0 ? (
                            <button
                              onClick={() => setArchivioMailCella({ cliente: c, bookmaker: book, promo: mailCella })}
                              style={{
                                border: 'none',
                                borderRadius: 8,
                                padding: '4px 12px',
                                fontWeight: 900,
                                fontSize: 14,
                                cursor: 'pointer',
                                background: nonLette > 0 ? 'rgba(239,68,68,0.18)' : 'rgba(34,197,94,0.12)',
                                color: nonLette > 0 ? '#f87171' : '#4ade80',
                                minWidth: 36,
                                position: 'relative'
                              }}
                            >
                              {nonLette > 0 ? nonLette : mailCella.length}
                            </button>
                          ) : (
                            <span style={{ color: '#334155', fontSize: 13 }}>·</span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
              {/* Riga footer con nomi bookmaker ripetuti */}
              <tr style={{ ...tr, background: 'rgba(15,23,42,0.9)', borderTop: '2px solid rgba(51,65,85,0.7)' }}>
                <td style={{ ...tdStrong, position: 'sticky', left: 0, background: '#0b1220', zIndex: 2, borderRight: '1px solid rgba(51,65,85,0.7)', fontSize: 11, color: '#94a3b8' }}>MITTENTE</td>
                {colonneFiltered.map(book => (
                  <td key={book} style={{ ...td, textAlign: 'center', padding: '8px 4px' }}>
                    <span style={{ background: 'rgba(56,189,248,0.08)', color: '#38bdf8', padding: '2px 6px', borderRadius: 6, fontSize: 10, fontWeight: 700 }}>{book}</span>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Popup dettaglio cella */}
      {archivioMailCella && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(2,6,23,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2500, padding: 16 }}>
          <div style={{ width: '100%', maxWidth: 620, background: 'linear-gradient(180deg,rgba(15,23,42,0.99),rgba(2,6,23,1))', border: '2px solid rgba(56,189,248,0.4)', borderRadius: 22, padding: 24, maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, color: '#f8fafc', fontSize: 17 }}>
                  📧 {archivioMailCella.cliente.nome} · <span style={{ color: '#38bdf8', textTransform: 'capitalize' }}>{archivioMailCella.bookmaker}</span>
                </h3>
                <p style={{ margin: '4px 0 0', color: '#94a3b8', fontSize: 13 }}>{archivioMailCella.promo.length} mail in archivio</p>
              </div>
              <button
                style={{ border: '1px solid rgba(71,85,105,0.95)', background: 'rgba(15,23,42,0.82)', color: '#e2e8f0', width: 38, height: 38, borderRadius: 12, cursor: 'pointer', fontSize: 18 }}
                onClick={() => setArchivioMailCella(null)}>×</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {archivioMailCella.promo.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).map((p, idx) => (
                <div key={idx} style={{ background: 'rgba(11,18,32,0.85)', border: `1px solid ${!p.letta ? 'rgba(239,68,68,0.35)' : 'rgba(51,65,85,0.6)'}`, borderRadius: 12, padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 6, background: (p.priorita||'').toLowerCase() === 'alta' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.12)', color: (p.priorita||'').toLowerCase() === 'alta' ? '#f87171' : '#fbbf24' }}>
                        {(p.priorita||'media').toUpperCase()}
                      </span>
                      {!p.letta && <span style={{ fontSize: 10, fontWeight: 800, color: '#ef4444' }}>● NUOVA</span>}
                    </div>
                    <span style={{ fontSize: 11, color: '#64748b' }}>
                      {p.data_mail ? new Date(p.data_mail).toLocaleDateString('it-IT') : new Date(p.created_at).toLocaleDateString('it-IT')}
                    </span>
                  </div>
                  <div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{p.oggetto}</div>
                  <div style={{ color: '#64748b', fontSize: 11, marginBottom: 8 }}>Da: {p.mittente}</div>
                  <button
                    onClick={async () => {
                      setTestoLive('')
                      setPromozioneDettaglio(p)
                      if (!p.letta) {
                        setPromozioni(prev => prev.map(x => x.id === p.id ? { ...x, letta: true } : x))
                        setArchivioMailCella(prev => prev ? { ...prev, promo: prev.promo.map(x => x.id === p.id ? { ...x, letta: true } : x) } : null)
                        supabase.from('promozioni_clienti').update({ letta: true }).eq('id', p.id)
                      }
                      if (!p.testo_completo && p.gmail_message_id && p.email_id) {
                        setTestoLoading(true)
                        try {
                          const res = await fetch(`/api/gmail/read-single?email_id=${p.email_id}&message_id=${p.gmail_message_id}`)
                          const data = await res.json()
                          if (data.testo) setTestoLive(data.testo)
                        } catch {}
                        setTestoLoading(false)
                      }
                    }}
                    style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(56,189,248,0.4)', background: 'rgba(56,189,248,0.08)', color: '#38bdf8', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
                  >📖 Leggi testo completo</button>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <button
                style={{ padding: '10px 22px', borderRadius: 12, border: 'none', background: '#38bdf8', color: '#0f172a', cursor: 'pointer', fontSize: 13, fontWeight: 800 }}
                onClick={() => setArchivioMailCella(null)}>Chiudi</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
})()}

      {activeTab === 'punti-monete' && (() => {
  const ORDINE_CLIENTI = ['Ivan','Evaristo','Jonathan','Elia','Gabriela','Tatiana','Laura','Annarosa','Letizia','Nicola','Renato','Libero','Luisa','Samuele','Antonello','Paolo','Sergio','Italo','Ugo','Massi','Federico','Alfonso','Michela']

  const clientiOrdinati = [
    ...ORDINE_CLIENTI.map(nome => clienti.find(c => c.nome === nome || c.nome?.toLowerCase() === nome.toLowerCase())).filter(Boolean),
    ...clienti.filter(c => !ORDINE_CLIENTI.some(n => n.toLowerCase() === c.nome?.toLowerCase()))
  ]



  const getCellKey = (bookId, clienteNome) => `${bookId}__${clienteNome}`

  const calcolaTotaleBook = (book, applicaSconto = true) => {
    const totale = clientiOrdinati.reduce((sum, c) => {
      const punti = Number(pmSaldi[getCellKey(book.id, c.nome)] || 0)
      return sum + punti * Number(book.valorePunto)
    }, 0)
    const sconto = applicaSconto ? (SCONTO_BOOK?.[book.id] || 0) : 0
    return totale * (1 - sconto)
  }

  const SCONTO_BOOK = { 'sisal': 0.10 } // 10% sconto sul totale Sisal
  const BOOK_ID_FISSO = { 'sisal': '2' }  // book ID 2 = PUNTI E MONETE

  const aggiornaSaldoBookInBooks = async (book, totale) => {
    const bookId = book.bookId || BOOK_ID_FISSO[book.id] || null
    if (!bookId) return
    const sconto = SCONTO_BOOK[book.id] || 0
    const totaleScontato = totale * (1 - sconto)
    await supabase.from('books').update({ saldo: totaleScontato }).eq('id', bookId)
    setBooks(prev => prev.map(b => b.id === Number(bookId) ? { ...b, saldo: totaleScontato } : b))
  }

  const handlePuntiChange = async (book, clienteNome, valore) => {
    const nuoviPunti = valore === '' ? 0 : Number(valore)
    // Aggiorna stato locale subito
    setPmSaldi(prev => ({ ...prev, [getCellKey(book.id, clienteNome)]: nuoviPunti }))
    // Upsert su Supabase
    await supabase.from('punti_monete').upsert([{
      book_nome: book.nome,
      book_id: book.bookId ? Number(book.bookId) : null,
      valore_punto: Number(book.valorePunto),
      cliente_nome: clienteNome,
      punti: nuoviPunti,
      updated_at: new Date().toISOString()
    }], { onConflict: 'book_nome,cliente_nome' })
    // Aggiorna saldo book collegato
    const totale = clientiOrdinati.reduce((sum, c) => {
      const p = c.nome === clienteNome ? nuoviPunti : Number(pmSaldi[getCellKey(book.id, c.nome)] || 0)
      return sum + p * Number(book.valorePunto)
    }, 0)
    aggiornaSaldoBookInBooks(book, totale)
  }

  const handleValorePuntoChange = async (bookId, nuovoValore) => {
    const nuoviBooks = pmBooks.map(b => b.id === bookId ? { ...b, valorePunto: nuovoValore } : b)
    setPmBooks(nuoviBooks)
    const book = nuoviBooks.find(b => b.id === bookId)
    if (!book) return
    // Aggiorna valore_punto su tutte le righe del book
    await supabase.from('punti_monete').update({ valore_punto: Number(nuovoValore) }).eq('book_nome', book.nome)
    if (book.bookId) {
      const totale = clientiOrdinati.reduce((sum, c) => {
        return sum + Number(pmSaldi[getCellKey(bookId, c.nome)] || 0) * Number(nuovoValore)
      }, 0)
      aggiornaSaldoBookInBooks(book, totale)
    }
  }

  const handleAggiungiBook = async () => {
    if (!pmNuovoBook.nome.trim()) return
    const nuovoId = pmNuovoBook.nome.toLowerCase().replace(/\s+/g, '_')
    // Inserisci una riga per ogni cliente con 0 punti
    const righe = clientiOrdinati.map(c => ({
      book_nome: pmNuovoBook.nome.trim(),
      book_id: pmNuovoBook.bookId ? Number(pmNuovoBook.bookId) : null,
      valore_punto: Number(pmNuovoBook.valorePunto),
      cliente_nome: c.nome,
      punti: 0
    }))
    await supabase.from('punti_monete').insert(righe)
    setPmBooks(prev => [...prev, { id: nuovoId, nome: pmNuovoBook.nome.trim(), valorePunto: Number(pmNuovoBook.valorePunto), bookId: pmNuovoBook.bookId }])
    const nuoviSaldi = { ...pmSaldi }
    clientiOrdinati.forEach(c => { nuoviSaldi[`${nuovoId}__${c.nome}`] = 0 })
    setPmSaldi(nuoviSaldi)
    setPmNuovoBook({ nome: '', valorePunto: 0.001818, bookId: '' })
    setPmShowAggiungi(false)
  }

  const handleEliminaBook = async (book) => {
    if (!window.confirm(`Eliminare il book "${book.nome}" e tutti i punti associati?`)) return
    await supabase.from('punti_monete').delete().eq('book_nome', book.nome)
    setPmBooks(prev => prev.filter(b => b.id !== book.id))
    const nuoviSaldi = { ...pmSaldi }
    Object.keys(nuoviSaldi).forEach(k => { if (k.startsWith(book.id + '__')) delete nuoviSaldi[k] })
    setPmSaldi(nuoviSaldi)
  }

  if (pmLoading) return <div style={tabContent}><div style={{ color: '#94a3b8', marginTop: 40, textAlign: 'center' }}>⏳ Caricamento punti...</div></div>
  if (!pmLoading && pmBooks.length === 0) return (
    <div style={tabContent}>
      <div style={{ color: '#94a3b8', marginTop: 40, textAlign: 'center' }}>
        <p>Nessun dato trovato nella tabella <code>punti_monete</code>.</p>
        <p style={{ fontSize: 12, marginTop: 8 }}>Verifica che la tabella esista su Supabase e che le RLS permettano la lettura.</p>
        <button style={primaryButtonBlue} onClick={() => setPmLoading(true) || loadData()}>🔄 Ricarica</button>
      </div>
    </div>
  )

  return (
    <div style={tabContent}>
      <div style={sectionTopBar}>
        <div>
          <h2 style={sectionTitle}>🏆 Punti & Monete</h2>
          <p style={sectionDescription}>Saldo punti per cliente × bookmaker · il totale aggiorna automaticamente il saldo nel book</p>
        </div>
        <button style={primaryButtonBlue} onClick={() => setPmShowAggiungi(true)}>+ Aggiungi Book</button>
      </div>

      <div style={{ overflowX: 'auto', marginTop: 16, borderRadius: 16, border: '1px solid rgba(51,65,85,0.7)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: Math.max(400, 180 + pmBooks.length * 160) }}>
          <thead>
            <tr>
              <th style={{ ...th, position: 'sticky', left: 0, zIndex: 4, background: '#0b1220', minWidth: 150, borderRight: '1px solid rgba(51,65,85,0.7)' }}>Cliente</th>
              {pmBooks.map(book => (
                <th key={book.id} style={{ ...th, textAlign: 'center', minWidth: 150, padding: '10px 12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ color: '#38bdf8', fontWeight: 900, fontSize: 13, textTransform: 'capitalize' }}>{book.nome}</span>
                      <button onClick={() => handleEliminaBook(book)} style={{ border: 'none', background: 'transparent', color: '#475569', cursor: 'pointer', fontSize: 13, padding: '0 2px' }}>×</button>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontSize: 10, color: '#64748b' }}>€/punto:</span>
                      <input type="number" step="0.000001" min="0" value={book.valorePunto} onChange={e => handleValorePuntoChange(book.id, e.target.value)}
                        style={{ width: 72, background: '#0b1220', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)', borderRadius: 6, padding: '2px 6px', fontSize: 11, fontWeight: 800, textAlign: 'center', outline: 'none' }} />
                    </div>
                    <div style={{ fontSize: 11, color: '#4ade80', fontWeight: 700 }}>
                      Tot: {calcolaTotaleBook(book).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                      {SCONTO_BOOK[book.id] && <span style={{ fontSize: 10, color: '#f87171', marginLeft: 4 }}>(-{SCONTO_BOOK[book.id]*100}%)</span>}
                    </div>
                    {book.bookId && <div style={{ fontSize: 10, color: '#64748b' }}>→ {books.find(b => b.id === Number(book.bookId))?.nome || ''}</div>}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {clientiOrdinati.map((c, idx) => (
              <tr key={c.id} style={{ ...tr, background: idx % 2 === 0 ? 'transparent' : 'rgba(11,18,32,0.4)' }}>
                <td style={{ ...tdStrong, position: 'sticky', left: 0, background: idx % 2 === 0 ? '#020617' : '#0b1220', zIndex: 2, borderRight: '1px solid rgba(51,65,85,0.7)', fontSize: 13 }}>{c.nome}</td>
                {pmBooks.map(book => {
                  const punti = pmSaldi[getCellKey(book.id, c.nome)] || 0
                  const valore = Number(punti) * Number(book.valorePunto)
                  return (
                    <td key={book.id} style={{ ...td, textAlign: 'center', padding: '8px 10px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                        <input type="number" min="0" step="1"
                          value={punti || ''}
                          onChange={e => handlePuntiChange(book, c.nome, e.target.value)}
                          placeholder="0"
                          style={{ width: 90, background: '#0b1220', color: '#f8fafc', border: '1px solid rgba(51,65,85,0.6)', borderRadius: 8, padding: '5px 8px', fontSize: 13, fontWeight: 700, textAlign: 'center', outline: 'none' }}
                        />
                        {punti > 0 && <span style={{ fontSize: 10, color: '#4ade80', fontWeight: 700 }}>{valore.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</span>}
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: '2px solid rgba(56,189,248,0.3)' }}>
              <td style={{ ...tdStrong, position: 'sticky', left: 0, background: '#0b1220', zIndex: 2, borderRight: '1px solid rgba(51,65,85,0.7)', color: '#38bdf8', fontSize: 13 }}>TOTALE</td>
              {pmBooks.map(book => (
                <td key={book.id} style={{ ...td, textAlign: 'center', fontWeight: 900, color: '#4ade80', fontSize: 14 }}>
                  {calcolaTotaleBook(book).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>

      {pmShowAggiungi && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(2,6,23,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2500, padding: 16 }}>
          <div style={{ width: '100%', maxWidth: 440, background: 'linear-gradient(180deg,rgba(15,23,42,0.99),rgba(2,6,23,1))', border: '2px solid rgba(56,189,248,0.4)', borderRadius: 22, padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, color: '#f8fafc' }}>+ Nuovo Book Punti</h3>
              <button style={{ border: '1px solid rgba(71,85,105,0.95)', background: 'rgba(15,23,42,0.82)', color: '#e2e8f0', width: 38, height: 38, borderRadius: 12, cursor: 'pointer', fontSize: 18 }} onClick={() => setPmShowAggiungi(false)}>×</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4, display: 'block' }}>Nome bookmaker</label>
                <input value={pmNuovoBook.nome} onChange={e => setPmNuovoBook(p => ({ ...p, nome: e.target.value }))} placeholder="es. Goldbet" style={input} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4, display: 'block' }}>Valore punto (€)</label>
                <input type="number" step="0.000001" min="0" value={pmNuovoBook.valorePunto} onChange={e => setPmNuovoBook(p => ({ ...p, valorePunto: e.target.value }))} placeholder="es. 0.001818" style={input} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4, display: 'block' }}>Book collegato (per aggiornare saldo automaticamente)</label>
                <select value={pmNuovoBook.bookId} onChange={e => setPmNuovoBook(p => ({ ...p, bookId: e.target.value }))} style={{ ...input, marginBottom: 0 }}>
                  <option value="">— Nessuno —</option>
                  {books.map(b => <option key={b.id} value={b.id}>{b.nome} {b.intestatario ? `(${b.intestatario})` : ''}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
              <button style={secondaryButton} onClick={() => setPmShowAggiungi(false)}>Annulla</button>
              <button style={primaryButtonBlue} onClick={handleAggiungiBook}>Aggiungi</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
})()}

      {activeTab === 'stime-cassa' && canViewStimeCassa && (
  <div style={tabContent}>
    <div style={sectionTopBar}>
      <div>
        <h2 style={sectionTitle}>Contabilità</h2>
        <p style={sectionDescription}>Vista annuale a riquadri: almeno 4 mesi visibili, ogni mese modificabile</p>
      </div>
      {pendingRefresh && (
        <button
          onClick={() => loadData({ preserveMessages: true }).then(() => setPendingRefresh(false))}
          style={{
            background: 'linear-gradient(135deg, #f59e0b, #d97706)',
            color: '#0f172a',
            border: 'none',
            borderRadius: 12,
            padding: '10px 20px',
            fontWeight: 800,
            fontSize: 14,
            cursor: 'pointer',
            boxShadow: '0 0 16px rgba(245,158,11,0.45)',
            animation: 'blinkPrevisto 1.8s ease-in-out infinite'
          }}
        >
          🔄 Aggiorna dati
        </button>
      )}
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
            ref={isCurrentMonth ? currentMonthRef : null}
            style={{
              ...stimeMonthCard,
              border: isCurrentMonth
                ? '2px solid rgba(56,189,248,0.90)'
                : '1px solid rgba(51,65,85,0.95)',
              boxShadow: isCurrentMonth
                ? '0 0 18px rgba(56,189,248,0.25)'
                : undefined
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
               <div key={row.id} style={{
  ...stimeRow,
  ...(row.stato === 'previsto' ? {
    background: 'rgba(59,130,246,0.10)',
    border: '1px solid rgba(59,130,246,0.40)',
    borderRadius: 10,
    animation: 'blinkPrevisto 1.8s ease-in-out infinite'
  } : {})
}}>
                  <div style={stimeDoneCol}>
  <div style={stimeStatusButtons}>
    <button
      type='button'
      onClick={() => updateStatoStima(row, 'previsto')}
      style={{
        ...stimeStatusButton,
        ...(row.stato === 'previsto' ? stimeStatusButtonPrevisto : {})
      }}
    >
      Prev.
    </button>

    <button
      type='button'
      onClick={() => updateStatoStima(row, 'fatto')}
      style={{
        ...stimeStatusButton,
        ...(row.stato === 'fatto' ? stimeStatusButtonFatto : {})
      }}
    >
      Fatto
    </button>

    <button
      type='button'
      onClick={() => updateStatoStima(row, 'annullato')}
      style={{
        ...stimeStatusButton,
        ...(row.stato === 'annullato' ? stimeStatusButtonAnnullato : {})
      }}
    >
      Ann.
    </button>
  </div>
</div>

                  <div style={stimeImportoCol}>
                   <input
  defaultValue={row.importo ?? 0}
  onBlur={(e) => updateStimaCassa(row.id, 'importo', Number(e.target.value))}
  onKeyDown={(e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      updateStimaCassa(row.id, 'importo', Number(e.target.value))
      e.target.blur()
    }
    if (e.key === 'Escape') {
      e.target.value = row.importo ?? 0
      e.target.blur()
    }
  }}
  style={{
  ...stimeMiniInput,
  color: Number(row.importo || 0) < 0 ? '#f87171' : '#e2e8f0',
  fontWeight: row.stato === 'previsto' ? 900 : 700,
  textShadow: row.stato === 'previsto' ? '0 0 8px rgba(59,130,246,0.8)' : 'none',
  border: row.stato === 'previsto' ? '1px solid rgba(59,130,246,0.6)' : undefined
}}
/>
                  </div>

                  <div style={stimeVoceCol}>
                    <input
  defaultValue={row.voce || ''}
  onBlur={(e) => updateStimaCassa(row.id, 'voce', e.target.value)}
  onKeyDown={(e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      updateStimaCassa(row.id, 'voce', e.target.value)
      e.target.blur()
    }
    if (e.key === 'Escape') {
      e.target.value = row.voce || ''
      e.target.blur()
    }
  }}
  style={stimeMiniInput}
/>
                  </div>
                  {row.stato === 'previsto' && monthGroup.key === meseCorrenteKey && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 4 }}>
                      <input
                        type='number'
                        min='1'
                        max='31'
                        placeholder='gg'
                        defaultValue={(() => {
                          const m = String(row.note || '').match(/\[g:(\d+)\]/)
                          return m ? m[1] : ''
                        })()}
                        onBlur={(e) => {
                          const val = e.target.value.trim()
                          const noteBase = String(row.note || '').replace(/\[g:\d+\]/, '').trim()
                          const nuovaNota = val ? `${noteBase ? noteBase + ' ' : ''}[g:${val}]` : noteBase
                          updateStimaCassa(row.id, 'note', nuovaNota)
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') { e.preventDefault(); e.target.blur() }
                          if (e.key === 'Escape') { e.target.blur() }
                        }}
                        style={{
                          ...stimeMiniInput,
                          width: 44,
                          textAlign: 'center',
                          color: '#fbbf24',
                          fontWeight: 800,
                          border: '1px solid rgba(251,191,36,0.5)',
                          background: 'rgba(251,191,36,0.08)',
                          padding: '2px 4px'
                        }}
                      />
                      <span style={{ color: '#64748b', fontSize: 11 }}>gg</span>
                    </div>
                  )}
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
            <div style={sectionTopBar}><div><h2 style={sectionTitle}>Books</h2><p style={sectionDescription}>Archivio bookmaker con filtri, note e azioni rapide</p></div><div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>{Object.keys(pendingBookSaldi).some(id => { const b = books.find(b => b.id === Number(id)); return b && Number(String(pendingBookSaldi[id]).replace(',','.')) !== Number(b.saldo || 0) }) && (<button style={{ ...primaryButtonGreen, background: 'linear-gradient(135deg, #d97706, #f59e0b)', boxShadow: '0 0 14px rgba(245,158,11,0.4)', animation: 'blinkPrevisto 1.8s ease-in-out infinite' }} onClick={handleSalvaBookSaldi}>💾 Salva saldi ({Object.keys(pendingBookSaldi).filter(id => { const b = books.find(b => b.id === Number(id)); return b && Number(String(pendingBookSaldi[id]).replace(',','.')) !== Number(b.saldo || 0) }).length})</button>)}<button style={primaryButtonGreen} onClick={() => setShowBookModal(true)}>+ Nuovo Book</button></div></div>
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
                  {filteredBooks.map((book) => {
  const livBadge = book.profilo_livello === 'attivo' ? { bg: 'rgba(34,197,94,0.18)', color: '#22c55e', label: '🟢' } : (book.profilo_livello && book.profilo_livello.startsWith('mantenimento')) ? { bg: 'rgba(251,191,36,0.18)', color: '#fbbf24', label: '🟡' } : book.profilo_livello === 'dormiente' ? { bg: 'rgba(100,116,139,0.18)', color: '#94a3b8', label: '⚫' } : null
  const pendingVal = pendingBookSaldi[book.id]
  const displaySaldo = pendingVal !== undefined ? pendingVal : String(book.saldo ?? 0)
  const hasPending = pendingVal !== undefined && Number(String(pendingVal).replace(',','.')) !== Number(book.saldo || 0)
  const bookIndex = filteredBooks.indexOf(book)
  const isPuntiMoneteBook = puntiMoneteBooks.some(pb => pb.bookId && String(pb.bookId) === String(book.id)) || String(book.id) === '2'
  return <tr key={book.id} style={tr}><td style={td}>{book.id}</td><td style={tdStrong}><div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{livBadge && <span title={book.profilo_livello} style={{ background: livBadge.bg, color: livBadge.color, padding: '2px 7px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }} onClick={() => setActiveTab('profilazione')}>{livBadge.label}</span>}{book.nome}</div></td><td style={td}>{book.intestatario || '-'}</td><td style={td}>{isPuntiMoneteBook ? <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ fontSize: 14, fontWeight: 700, color: '#4ade80' }}>{Number(book.saldo || 0).toFixed(2)} €</span><span style={{ fontSize: 10, color: '#38bdf8', background: 'rgba(56,189,248,0.1)', padding: '2px 6px', borderRadius: 6, fontWeight: 700 }}>🏆 auto</span></div> : <input ref={el => { bookSaldoRefs.current[book.id] = el }} type="number" step="0.01" min="0" value={displaySaldo} onChange={e => setPendingBookSaldi(prev => ({ ...prev, [book.id]: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); const nextBook = filteredBooks[bookIndex + 1]; if (nextBook && bookSaldoRefs.current[nextBook.id]) { bookSaldoRefs.current[nextBook.id].focus(); bookSaldoRefs.current[nextBook.id].select() } } if (e.key === 'Escape') setPendingBookSaldi(prev => { const n = { ...prev }; delete n[book.id]; return n }) }} style={{ width: 110, background: hasPending ? 'rgba(251,191,36,0.08)' : '#0b1220', color: hasPending ? '#fbbf24' : '#e2e8f0', border: hasPending ? '1px solid rgba(251,191,36,0.7)' : '1px solid rgba(51,65,85,0.6)', borderRadius: 8, padding: '4px 8px', fontSize: 14, fontWeight: hasPending ? 800 : 600, outline: 'none' }} />}</td><td style={tdNote}><textarea defaultValue={book.note || ''} onBlur={(e) => updateNote('books', book.id, e.target.value)} style={{ ...noteTextarea, color: getNoteColor(book.note) }} /></td><td style={tdActions}><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><button style={tinyGreenButton} onClick={() => openQuickBookTx(book, 'versa')}>Versa</button><button style={tinyBlueButton} onClick={() => openQuickBookTx(book, 'preleva')}>Preleva</button><button style={tinyOrangeButton} onClick={() => { setSelectedBook(book); resetAdjustSaldoForm(book); setShowAdjustSaldoModal(true) }}>Correggi saldo</button><button style={tinyRedButton} onClick={() => handleDeleteBook(book)}>Elimina</button></div></td></tr>
})}
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
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
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
                {(() => {
                  const EMOJI = { 'Casa': '🏠', 'Auto': '🚗', 'Alimentari': '🛒', 'Ristoranti/Svago': '🍽️', 'Ristoranti/Svago/Viaggi': '✈️', 'Abbigliamento': '👕', 'Salute/Farmacia': '💊', 'Tecnologia/Abbonamenti': '📱', 'Famiglia': '👨‍👩‍👦', 'Attività Lavorativa': '💼', 'Altro': '📦', 'Spese Personali Sergio': '🚬' }
                  const COLORI = ['#38bdf8','#4ade80','#f87171','#fbbf24','#a78bfa','#fb923c','#34d399','#e879f9','#60a5fa','#94a3b8']
                  const meseCorrente = new Date().toISOString().slice(0, 7)
                  const isMeseCorrente = speseMeseSelezionato === meseCorrente

                  // Naviga al mese precedente/successivo
                  const navigaMese = async (delta) => {
                    const [y, m] = speseMeseSelezionato.split('-').map(Number)
                    const d = new Date(y, m - 1 + delta, 1)
                    const nuovoMese = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
                    setSpeseMeseSelezionato(nuovoMese)
                    if (!speseStorico[nuovoMese] && nuovoMese !== meseCorrente) {
                      const inizioMese = nuovoMese + '-01'
                      const fineMese = new Date(d.getFullYear(), d.getMonth() + 1, 1).toISOString()
                      const { data } = await supabase.from('transactions').select('id,note,importo,categoria_spesa,data,azione').eq('azione', 'wallet_to_external').gte('data', inizioMese).lt('data', fineMese)
                      if (data) setSpeseStorico(prev => ({ ...prev, [nuovoMese]: data }))
                    }
                  }

                  const txMese = isMeseCorrente ? speseCategoriaMese : (speseStorico[speseMeseSelezionato] || [])
                  const speseCategoria = txMese.filter(tx => tx.categoria_spesa).reduce((acc, tx) => { acc[tx.categoria_spesa] = (acc[tx.categoria_spesa] || 0) + Number(tx.importo || 0); return acc }, {})
                  const totaleCategorie = Object.values(speseCategoria).reduce((a, b) => a + b, 0)
                  const voci = Object.entries(speseCategoria).sort((a, b) => b[1] - a[1])
                  const sforati = voci.filter(([cat, imp]) => soglieBudget[cat] && imp > Number(soglieBudget[cat]))

                  return <>
                    <div style={panelHeader}>
                      <div><h2 style={panelTitle}>📊 Spese per Categoria</h2><p style={panelSubtitle}>Solo wallet → esterno categorizzate</p></div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <button style={{ ...secondaryButton, padding: '4px 10px', fontSize: 16 }} onClick={() => navigaMese(-1)}>‹</button>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#38bdf8', minWidth: 80, textAlign: 'center' }}>{speseMeseSelezionato}</span>
                        <button style={{ ...secondaryButton, padding: '4px 10px', fontSize: 16, opacity: isMeseCorrente ? 0.3 : 1 }} onClick={() => !isMeseCorrente && navigaMese(1)} disabled={isMeseCorrente}>›</button>
                        <button style={{ ...secondaryButton, fontSize: 11, padding: '4px 8px' }} onClick={() => setShowSoglieEditor(true)}>⚙️ Budget</button>
                      </div>
                    </div>

                    {sforati.length > 0 && (
                      <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 10, padding: '8px 12px', marginBottom: 12 }}>
                        <div style={{ fontSize: 12, fontWeight: 800, color: '#f87171', marginBottom: 4 }}>⚠️ Budget sforato!</div>
                        {sforati.map(([cat, imp]) => (
                          <div key={cat} style={{ fontSize: 11, color: '#fca5a5' }}>
                            {EMOJI[cat] || '📦'} {cat}: {imp.toLocaleString('it-IT', {minimumFractionDigits:2})} € / budget {Number(soglieBudget[cat]).toLocaleString('it-IT', {minimumFractionDigits:2})} € (+{(imp - Number(soglieBudget[cat])).toLocaleString('it-IT', {minimumFractionDigits:2})} €)
                          </div>
                        ))}
                      </div>
                    )}

                    {voci.length === 0
                      ? <div style={{ color: '#64748b', textAlign: 'center', padding: '24px 0', fontSize: 13 }}>Nessuna spesa categorizzata.<br/><span style={{ fontSize: 11 }}>Seleziona una categoria nei prelievi verso esterno.</span></div>
                      : <div style={{ padding: '0 4px 8px' }}>
                          {voci.map(([cat, importo], idx) => {
                            const perc = totaleCategorie > 0 ? (importo / totaleCategorie) * 100 : 0
                            const soglia = soglieBudget[cat] ? Number(soglieBudget[cat]) : null
                            const sforato = soglia && importo > soglia
                            const percSoglia = soglia ? Math.min((importo / soglia) * 100, 100) : null
                            return <div key={cat} style={{ marginBottom: 12 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span style={{ fontSize: 13, fontWeight: 700, color: sforato ? '#f87171' : '#e2e8f0' }}>{EMOJI[cat] || '📦'} {cat}</span>
                                  {sforato && <span style={{ fontSize: 10, fontWeight: 800, color: '#ef4444', background: 'rgba(239,68,68,0.15)', padding: '1px 5px', borderRadius: 4 }}>⚠️ SFORATO</span>}
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                  <span style={{ fontSize: 13, fontWeight: 900, color: sforato ? '#f87171' : COLORI[idx % COLORI.length] }}>{importo.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</span>
                                  {soglia && <span style={{ fontSize: 10, color: '#64748b', marginLeft: 4 }}>/ {soglia.toLocaleString('it-IT')} €</span>}
                                </div>
                              </div>
                              <div style={{ background: 'rgba(51,65,85,0.4)', borderRadius: 6, height: 8, overflow: 'hidden' }}>
                                <div style={{ width: `${perc}%`, height: '100%', background: sforato ? '#ef4444' : COLORI[idx % COLORI.length], borderRadius: 6, transition: 'width 0.5s ease' }} />
                              </div>
                              {soglia && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
                                  <span style={{ fontSize: 10, color: '#64748b' }}>{perc.toFixed(1)}% del totale</span>
                                  <span style={{ fontSize: 10, color: sforato ? '#f87171' : '#64748b' }}>{percSoglia?.toFixed(0)}% del budget</span>
                                </div>
                              )}
                              {!soglia && <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>{perc.toFixed(1)}% del totale</div>}
                            </div>
                          })}
                          <div style={{ borderTop: '1px solid rgba(51,65,85,0.6)', paddingTop: 10, marginTop: 6, display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8' }}>TOTALE CATEGORIZZATO</span>
                            <span style={{ fontSize: 14, fontWeight: 900, color: '#f87171' }}>{totaleCategorie.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</span>
                          </div>
                        </div>
                    }

                    {showSoglieEditor && (
                      <div style={{ position: 'fixed', inset: 0, background: 'rgba(2,6,23,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2500, padding: 16 }}>
                        <div style={{ width: '100%', maxWidth: 460, background: 'linear-gradient(180deg,rgba(15,23,42,0.99),rgba(2,6,23,1))', border: '2px solid rgba(56,189,248,0.4)', borderRadius: 22, padding: 24, maxHeight: '85vh', overflowY: 'auto' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <h3 style={{ margin: 0, color: '#f8fafc' }}>⚙️ Budget per Categoria</h3>
                            <button style={{ border: '1px solid rgba(71,85,105,0.95)', background: 'rgba(15,23,42,0.82)', color: '#e2e8f0', width: 38, height: 38, borderRadius: 12, cursor: 'pointer', fontSize: 18 }} onClick={() => setShowSoglieEditor(false)}>×</button>
                          </div>
                          <p style={{ fontSize: 12, color: '#64748b', marginBottom: 16 }}>Imposta un budget mensile per categoria. Se superi la soglia la barra diventa rossa.</p>
                          {['Casa','Auto','Alimentari','Ristoranti/Svago/Viaggi','Abbigliamento','Salute/Farmacia','Tecnologia/Abbonamenti','Famiglia','Attività Lavorativa','Spese Personali Sergio','Altro'].map(cat => (
                            <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                              <span style={{ fontSize: 13, flex: 1, color: '#e2e8f0' }}>{EMOJI[cat] || '📦'} {cat}</span>
                              <input
                                type="number" min="0" step="10"
                                value={soglieBudget[cat] || ''}
                                placeholder="Nessun limite"
                                onChange={e => {
                                  const nuove = { ...soglieBudget, [cat]: e.target.value }
                                  if (!e.target.value) delete nuove[cat]
                                  setSoglieBudget(nuove)
                                  supabase.from('dashboard_settings').update({ soglie_budget: nuove }).eq('id', 1)
                                }}
                                style={{ width: 110, background: '#0b1220', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)', borderRadius: 8, padding: '5px 8px', fontSize: 13, textAlign: 'right', outline: 'none' }}
                              />
                              <span style={{ fontSize: 12, color: '#64748b' }}>€</span>
                            </div>
                          ))}
                          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
                            <button style={primaryButtonBlue} onClick={() => setShowSoglieEditor(false)}>Salva e chiudi</button>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                })()}
              </div>
            </div>

            <div style={{ ...panel, marginTop: 16 }}>
                <div style={panelHeader}>
                  <div><h2 style={panelTitle}>Storico movimenti</h2><p style={panelSubtitle}>{txLoadAll ? 'Tutti i movimenti' : 'Ultimi 3 mesi'} · {filteredTransactions.length} righe</p></div>
                  {!txLoadAll && <button style={secondaryButton} onClick={async () => {
                    let all = []
                    let from = 0
                    const pageSize = 1000
                    while (true) {
                      const { data } = await supabase.from('transactions').select('*').order('data', { ascending: false }).range(from, from + pageSize - 1)
                      if (!data || data.length === 0) break
                      all = [...all, ...data]
                      if (data.length < pageSize) break
                      from += pageSize
                    }
                    if (all.length > 0) { setTransactions(all); setTxLoadAll(true) }
                  }}>📂 Carica tutto</button>}
                </div>
                <div style={filterRow}>
                  <select value={txFilters.tipo} onChange={(e) => setTxFilters({ ...txFilters, tipo: e.target.value })} style={filterInput}><option value=''>Tutti i tipi</option><option value='versa'>Versa</option><option value='preleva'>Preleva</option><option value='trasferisci'>Trasferisci</option><option value='correzione'>Correzione</option></select>
                  <select value={txFilters.azione} onChange={(e) => setTxFilters({ ...txFilters, azione: e.target.value })} style={filterInput}><option value=''>Tutte le azioni</option><option value='wallet_to_book'>wallet_to_book</option><option value='book_to_wallet'>book_to_wallet</option><option value='wallet_to_wallet'>wallet_to_wallet</option><option value='wallet_to_external'>wallet_to_external</option><option value='manual_balance_adjustment'>manual_balance_adjustment</option></select>
                  <input value={txFilters.importoMin} onChange={(e) => setTxFilters({ ...txFilters, importoMin: e.target.value })} placeholder='Importo min' style={filterInput} />
                  <input value={txFilters.importoMax} onChange={(e) => setTxFilters({ ...txFilters, importoMax: e.target.value })} placeholder='Importo max' style={filterInput} />
                  <input value={txFilters.testo} onChange={(e) => setTxFilters({ ...txFilters, testo: e.target.value })} placeholder='Cerca in riferimento, note, azione...' style={filterInputWide} />
                  <input type='date' value={txFilters.dataFrom} onChange={(e) => setTxFilters({ ...txFilters, dataFrom: e.target.value })} style={filterInput} title='Data dal' />
<input type='date' value={txFilters.dataTo} onChange={(e) => setTxFilters({ ...txFilters, dataTo: e.target.value })} style={filterInput} title='Data al' />
                  <button type='button' style={secondaryButton} onClick={clearTxFilters}>Pulisci</button>
                </div>
                <div style={tableWrap}>
                  <table style={tableLarge}><thead><tr><th style={th}>Data</th><th style={th}>Tipo</th><th style={th}>Importo</th><th style={th}>Riferimento</th><th style={th}>Azione</th><th style={th}>Note</th><th style={th}>Categoria</th><th style={thActions}>Azioni</th></tr></thead><tbody>
                    {filteredTransactions.map((tx) => <tr key={tx.id} style={tr}><td style={td}>{formatDate(tx.data)}</td><td style={td}><span style={badge(tx.tipo)}>{tx.tipo || '-'}</span></td><td style={td}>{formatCurrency(tx.importo)}</td><td style={td}>{tx.riferimento || '-'}</td><td style={td}>{tx.azione || '-'}</td><td style={tdNoteText}>{tx.note || '-'}</td><td style={td}>{tx.categoria_spesa ? <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: 'rgba(56,189,248,0.12)', color: '#38bdf8' }}>{tx.categoria_spesa}</span> : <span style={{ color: '#334155' }}>-</span>}</td><td style={tdActions}>{tx.azione !== 'manual_balance_adjustment' ? <button style={tinyRedButton} onClick={() => handleDeleteTransaction(tx)}>Elimina</button> : <span style={{ color: '#94a3b8', fontSize: 12 }}>Protetta</span>}</td></tr>)}
                  </tbody></table>
                </div>
            </div>
          </div>
        )}
                {activeTab === 'memo' && (
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
        )}
        {/* POPUP FILE MANAGER DOCUMENTI */}
        {docCliente && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(2,6,23,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000, padding: 16 }}>
            <div style={{ width: '100%', maxWidth: 680, background: 'linear-gradient(180deg,rgba(15,23,42,0.99),rgba(2,6,23,1))', border: '2px solid rgba(251,191,36,0.4)', borderRadius: 22, padding: 24, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
              
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <h3 style={{ margin: 0, color: '#f8fafc', fontSize: 18 }}>📁 Documenti — {docCliente.nome}</h3>
                  <p style={{ margin: '4px 0 0', color: '#94a3b8', fontSize: 13 }}>Accesso protetto da password</p>
                </div>
                <button onClick={() => { setDocCliente(null); setDocPasswordOk(false); setDocPassword(''); setDocFiles([]); setDocLoading(false); setDocUploading(false); setDocPasswordError('') }}
                  style={{ border: '1px solid rgba(71,85,105,0.95)', background: 'rgba(15,23,42,0.82)', color: '#e2e8f0', width: 38, height: 38, borderRadius: 12, cursor: 'pointer', fontSize: 18 }}>×</button>
              </div>

              {/* Form password */}
              {!docPasswordOk ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center', padding: '32px 0' }}>
                  <div style={{ fontSize: 40, marginBottom: 8 }}>🔒</div>
                  <p style={{ color: '#94a3b8', fontSize: 14, margin: 0 }}>Inserisci la password per accedere ai documenti</p>
                  <input
                    type="password"
                    value={docPassword}
                    onChange={e => setDocPassword(e.target.value)}
                    onKeyDown={async e => {
                      if (e.key === 'Enter') {
                        const res = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: docPassword }) })
                        if (res.ok) {
                          setDocPasswordOk(true)
                          setDocPasswordError('')
                          setDocLoading(true)
                          const r = await fetch(`/api/documenti?cliente=${encodeURIComponent(docCliente.nome)}`)
                          const d = await r.json()
                          setDocFiles(d.files || [])
                          setDocLoading(false)
                        } else {
                          setDocPasswordError('Password errata')
                        }
                      }
                    }}
                    placeholder="Password..."
                    autoFocus
                    style={{ padding: '12px 16px', borderRadius: 10, border: `1px solid ${docPasswordError ? 'rgba(239,68,68,0.5)' : 'rgba(51,65,85,0.95)'}`, background: '#0d0f14', color: '#f8fafc', fontSize: 15, outline: 'none', width: 280 }}
                  />
                  {docPasswordError && <span style={{ color: '#f87171', fontSize: 13 }}>{docPasswordError}</span>}
                  <button
                    onClick={async () => {
                      const res = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: docPassword }) })
                      if (res.ok) {
                        setDocPasswordOk(true)
                        setDocPasswordError('')
                        setDocLoading(true)
                        const r = await fetch(`/api/documenti?cliente=${encodeURIComponent(docCliente.nome)}`)
                        const d = await r.json()
                        setDocFiles(d.files || [])
                        setDocLoading(false)
                      } else {
                        setDocPasswordError('Password errata')
                      }
                    }}
                    style={{ padding: '12px 24px', borderRadius: 10, border: 'none', background: '#fbbf24', color: '#0d0f14', fontWeight: 800, fontSize: 15, cursor: 'pointer' }}>
                    Entra 🔓
                  </button>
                </div>
              ) : (
                /* File manager */
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1, overflow: 'hidden' }}>
                  
                  {/* Upload */}
                  <div style={{ border: '2px dashed rgba(251,191,36,0.3)', borderRadius: 12, padding: '14px 16px', textAlign: 'center', cursor: 'pointer', background: 'rgba(251,191,36,0.04)' }}
                    onDragOver={e => e.preventDefault()}
                    onDrop={async e => {
                      e.preventDefault()
                      const files = Array.from(e.dataTransfer.files)
                      for (const file of files) {
                        setDocUploading(true)
                        const formData = new FormData()
                        formData.append('file', file)
                        formData.append('cliente', docCliente.nome)
                        await fetch('/api/documenti', { method: 'POST', body: formData })
                        setDocUploading(false)
                      }
                      const r = await fetch(`/api/documenti?cliente=${encodeURIComponent(docCliente.nome)}`)
                      const d = await r.json()
                      setDocFiles(d.files || [])
                    }}
                    onClick={() => document.getElementById('docUploadInput').click()}
                  >
                    <input id="docUploadInput" type="file" multiple style={{ display: 'none' }} onChange={async e => {
                      const files = Array.from(e.target.files)
                      for (const file of files) {
                        setDocUploading(true)
                        const formData = new FormData()
                        formData.append('file', file)
                        formData.append('cliente', docCliente.nome)
                        await fetch('/api/documenti', { method: 'POST', body: formData })
                        setDocUploading(false)
                      }
                      const r = await fetch(`/api/documenti?cliente=${encodeURIComponent(docCliente.nome)}`)
                      const d = await r.json()
                      setDocFiles(d.files || [])
                      e.target.value = ''
                    }} />
                    {docUploading
                      ? <span style={{ color: '#fbbf24', fontSize: 13 }}>⏳ Caricamento...</span>
                      : <span style={{ color: '#94a3b8', fontSize: 13 }}>📤 Clicca o trascina qui per caricare file</span>
                    }
                  </div>

                  {/* Lista file */}
                  <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {docLoading ? (
                      <div style={{ textAlign: 'center', color: '#94a3b8', padding: 24 }}>Carico...</div>
                    ) : docFiles.length === 0 ? (
                      <div style={{ textAlign: 'center', color: '#94a3b8', padding: 24 }}>Nessun documento ancora</div>
                    ) : (
                      docFiles.map((f, idx) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(11,18,32,0.85)', border: '1px solid rgba(51,65,85,0.8)', borderRadius: 10, padding: '10px 14px' }}>
                          <span style={{ fontSize: 20 }}>{f.name.endsWith('.pdf') ? '📄' : f.name.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? '🖼️' : f.name.match(/\.(doc|docx)$/i) ? '📝' : f.name.match(/\.(xls|xlsx)$/i) ? '📊' : '📎'}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ color: '#f8fafc', fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</div>
                            <div style={{ color: '#64748b', fontSize: 11 }}>{f.size ? (f.size / 1024).toFixed(1) + ' KB' : ''} {f.created_at ? '· ' + new Date(f.created_at).toLocaleDateString('it-IT') : ''}</div>
                          </div>
                          <a href={f.url} target="_blank" rel="noreferrer"
                            style={{ padding: '5px 10px', borderRadius: 8, border: '1px solid rgba(34,197,94,0.4)', background: 'rgba(34,197,94,0.08)', color: '#22c55e', fontSize: 12, fontWeight: 700, textDecoration: 'none', cursor: 'pointer' }}>
                            👁️
                          </a>
                          <a href={f.url} download target="_blank" rel="noreferrer"
                            style={{ padding: '5px 10px', borderRadius: 8, border: '1px solid rgba(56,189,248,0.4)', background: 'rgba(56,189,248,0.08)', color: '#38bdf8', fontSize: 12, fontWeight: 700, textDecoration: 'none', cursor: 'pointer' }}>
                            ⬇️
                          </a>
                          <button onClick={async () => {
                            if (!confirm('Eliminare ' + f.name + '?')) return
                            await fetch(`/api/documenti?cliente=${encodeURIComponent(docCliente.nome)}&file=${encodeURIComponent(f.name)}`, { method: 'DELETE' })
                            const r = await fetch(`/api/documenti?cliente=${encodeURIComponent(docCliente.nome)}`)
                            const d = await r.json()
                            setDocFiles(d.files || [])
                          }} style={{ padding: '5px 10px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.08)', color: '#f87171', fontSize: 12, cursor: 'pointer' }}>
                            🗑️
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {showClienteModal && (
  <div style={modalOverlay} onClick={() => setShowClienteModal(false)}>
    <div style={modalCard} onClick={(e) => e.stopPropagation()}>
      <div style={modalHeader}>
        <div>
          <h3 style={modalTitle}>{editingCliente ? 'Modifica Cliente' : 'Nuovo Cliente'}</h3>
          <p style={modalSubtitle}>Dati cliente e SIM</p>
        </div>
        <button style={modalClose} onClick={() => setShowClienteModal(false)}>✕</button>
      </div>
      <form onSubmit={saveCliente}>
        <input value={clienteForm.nome} onChange={(e) => setClienteForm({ ...clienteForm, nome: e.target.value })} placeholder='Nome *' style={input} required />
        <input value={clienteForm.email} onChange={(e) => setClienteForm({ ...clienteForm, email: e.target.value })} placeholder='Email' style={input} />
        <input value={clienteForm.telefono} onChange={(e) => setClienteForm({ ...clienteForm, telefono: e.target.value })} placeholder='Telefono' style={input} />
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={clienteForm.sim_operatore} onChange={(e) => setClienteForm({ ...clienteForm, sim_operatore: e.target.value })} placeholder='Operatore SIM' style={{ ...input, flex: 2 }} />
          <input type='number' value={clienteForm.sim_importo} onChange={(e) => setClienteForm({ ...clienteForm, sim_importo: e.target.value })} placeholder='Importo €' style={{ ...input, flex: 1 }} />
          <input type='number' min='1' max='31' value={clienteForm.sim_giorno_scadenza} onChange={(e) => setClienteForm({ ...clienteForm, sim_giorno_scadenza: e.target.value })} placeholder='Giorno' style={{ ...input, flex: 1 }} />
        </div>
        <textarea value={clienteForm.note} onChange={(e) => setClienteForm({ ...clienteForm, note: e.target.value })} placeholder='Note' style={textarea} />
        <div style={modalActions}>
          <button type='button' style={secondaryButton} onClick={() => setShowClienteModal(false)}>Annulla</button>
          <button type='submit' style={primaryButtonGreen}>{editingCliente ? 'Salva Modifiche' : 'Crea Cliente'}</button>
        </div>
      </form>
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
        <select
          value={clienti.find(c => c.nome === bookForm.intestatario) ? bookForm.intestatario : ''}
          onChange={(e) => { if (e.target.value) setBookForm({ ...bookForm, intestatario: e.target.value }) }}
          style={{ ...input, marginBottom: 4 }}
        >
          <option value=''>— Seleziona da clienti —</option>
          {clienti.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
        </select>
        <input
          value={bookForm.intestatario}
          onChange={(e) => setBookForm({ ...bookForm, intestatario: e.target.value })}
          placeholder='O scrivi intestatario'
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
        <select
          value={clienti.find(c => c.nome === walletForm.intestatario) ? walletForm.intestatario : ''}
          onChange={(e) => { if (e.target.value) setWalletForm({ ...walletForm, intestatario: e.target.value }) }}
          style={{ ...input, marginBottom: 4 }}
        >
          <option value=''>— Seleziona da clienti —</option>
          {clienti.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
        </select>
        <input
          value={walletForm.intestatario}
          onChange={(e) => setWalletForm({ ...walletForm, intestatario: e.target.value })}
          placeholder='O scrivi intestatario'
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
 {/* MICROFONO VOCALE - fisso in basso a destra */}
<div style={{ position: 'fixed', bottom: 28, right: 28, zIndex: 2000, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
  {(voiceTranscript || voiceStatus || listBuffer) && (
    <div style={{ background: 'rgba(15,23,42,0.97)', border: '1px solid rgba(56,189,248,0.35)', borderRadius: 16, padding: '12px 16px', maxWidth: 340, boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
      {listBuffer && <div style={{ fontSize: 12, color: '#fde68a', marginBottom: 6, lineHeight: 1.4 }}>📋 {listBuffer}</div>}
      {voiceTranscript && <div style={{ fontSize: 13, color: '#7dd3fc', marginBottom: 4 }}>"{voiceTranscript}"</div>}
      {voiceStatus && <div style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 700 }}>{voiceStatus}</div>}
    </div>
  )}
  <div style={{ display: 'flex', gap: 10 }}>
    {isListeningContinuous ? (
      <button
        onClick={stopContinuousListening}
        style={{
          width: 60, height: 60, borderRadius: 999, border: 'none', cursor: 'pointer',
          background: 'linear-gradient(135deg, #dc2626, #ef4444)',
          boxShadow: '0 0 0 6px rgba(239,68,68,0.3)',
          fontSize: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.2s'
        }}
        title='Ferma modalità lista'
      >
        ⏹️
      </button>
    ) : (
      <button
        onClick={startContinuousListening}
        style={{
          width: 60, height: 60, borderRadius: 999, border: 'none', cursor: 'pointer',
          background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
          boxShadow: '0 8px 24px rgba(124,58,237,0.4)',
          fontSize: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.2s'
        }}
        title='Modalità lista (continua fino a "fatto")'
      >
        📋
      </button>
    )}
    <button
      onClick={startListening}
      style={{
        width: 60, height: 60, borderRadius: 999, border: 'none', cursor: 'pointer',
        background: isListening
          ? 'linear-gradient(135deg, #dc2626, #ef4444)'
          : 'linear-gradient(135deg, #2563eb, #38bdf8)',
        boxShadow: isListening ? '0 0 0 6px rgba(239,68,68,0.3)' : '0 8px 24px rgba(37,99,235,0.4)',
        fontSize: 26, display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.2s'
      }}
      title='Comando singolo'
    >
      🎤
    </button>
  </div>
</div>
    </div>
<button
  onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
  style={{
    position: 'fixed',
    bottom: 100,
    right: 28,
    zIndex: 2000,
    width: 44,
    height: 44,
    borderRadius: 999,
    border: 'none',
    cursor: 'pointer',
    background: 'linear-gradient(135deg, #16a34a, #22c55e)',
    color: '#fff',
    fontSize: 20,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 8px 24px rgba(34,197,94,0.4)',
  }}
  title='Torna su'
>
  ↑
</button>

 
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
  gridTemplateColumns: '170px 95px minmax(0, 1fr)',
  gap: 8,
  alignItems: 'center'
}

const stimeDoneCol = { minWidth: 170 }

const stimeStatusButtons = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: 6,
  width: '100%'
}

const stimeStatusButton = {
  border: '1px solid rgba(71,85,105,0.95)',
  background: 'rgba(15,23,42,0.82)',
  color: '#e2e8f0',
  fontWeight: 700,
  padding: '6px 8px',
  borderRadius: 10,
  cursor: 'pointer',
  fontSize: 11,
  width: '100%',
  textAlign: 'center'
}

const stimeStatusButtonPrevisto = {
  background: 'rgba(59,130,246,0.22)',
  border: '1px solid rgba(59,130,246,0.50)',
  color: '#dbeafe'
}

const stimeStatusButtonFatto = {
  background: 'rgba(34,197,94,0.22)',
  border: '1px solid rgba(34,197,94,0.50)',
  color: '#dcfce7'
}

const stimeStatusButtonAnnullato = {
  background: 'rgba(239,68,68,0.22)',
  border: '1px solid rgba(239,68,68,0.50)',
  color: '#fecaca'
}
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
const heroCard = {
  background: 'linear-gradient(135deg, rgba(34,197,94,0.12), rgba(56,189,248,0.08), rgba(15,23,42,0.96))',
  border: '1px solid rgba(56,189,248,0.22)',
  borderRadius: 26,
  padding: 24,
  boxShadow: '0 22px 52px rgba(0,0,0,0.28)',
  minHeight: 420,
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between'
}
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
