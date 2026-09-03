"use client";
import React, { useEffect, useMemo, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { supabase } from '../profit-tracker/supabaseClient'
import PromoScreenshotsPanel from './PromoScreenshotsPanel'
import ClientiMovimentazionePanel from './ClientiMovimentazionePanel'
import RisultatiPanel from './RisultatiPanel'
import CollaboratoriManager from './CollaboratoriManager'
import { PostItTab, PostItFloatingWidget } from './PostItWidget'
import MemoTab from './MemoTab'
import DashboardTab from './DashboardTab'
import AccantonamentiTab from './AccantonamentiTab'
import SmsTab from './SmsTab'
import PropHedgeTab from './PropHedgeTab'
import Masaniello from './Masaniello'
import {
  container, pageWrap, header, title, subtitle, copyrightBox, tabsBar, tabButton,
  activeTabButton, successBox, errorBox, tabContent, statsGrid, statsGridCompact,
  stimeMonthsGrid, stimeMonthCard, stimeMonthHeader, stimeMonthTitle, stimeMonthTotal,
  stimeMonthBody, stimeRow, stimeDoneCol, stimeStatusButtons, stimeStatusButton,
  stimeStatusButtonPrevisto, stimeStatusButtonFatto, stimeStatusButtonAnnullato,
  stimeImportoCol, stimeVoceCol, stimeMiniInput, statCard, statLabel, statValue, statSub,
  heroGrid, heroSideGrid, dashboardGrid, transactionsLayout, panel, panelForm, heroCard,
  heroLabel, heroValue, heroSub, heroMiniRow, heroMiniBox, heroMiniLabel, heroMiniValue,
  panelHeader, panelTitle, panelSubtitle, sectionTopBar, sectionTitle, sectionDescription,
  primaryButtonGreen, primaryButtonBlue, secondaryButton, tinyGreenButton, tinyBlueButton,
  tinyOrangeButton, tinyOrangeButtonLarge, tinyRedButton, filterRow, input, textarea,
  filterInput, filterInputWide, tableWrap, table, tableLarge, th, thActions, tr, td,
  tdStrong, tdNote, tdNoteText, tdActions, noteTextarea, stackList, miniRowTitle,
  miniRowSub, rankRow, rankBadge, rankMain, rankValue, modalOverlay, modalCard,
  modalHeader, modalTitle, modalSubtitle, modalClose, modalActions, loadingScreen,
  loadingCard, hintBox
} from './styles'
const BASE_CASSA_MESE = 57229.62

export default function ProfitTrackerClient() {
  const formatMonthKey = (date = new Date()) => {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    return `${y}-${m}`
  }
  const [activeTab, setActiveTab] = useState('dashboard')
  const [teamSubTab, setTeamSubTab] = useState('promo')
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
const [postItNotes, setPostItNotes] = useState([])
const [nuovoPostIt, setNuovoPostIt] = useState('')
const [postItEditingId, setPostItEditingId] = useState(null)
const [postItEditText, setPostItEditText] = useState('')
const [postItFloatPos, setPostItFloatPos] = useState(() => {
  try {
    const saved = localStorage.getItem('postItFloatPos')
    return saved ? JSON.parse(saved) : { x: null, y: null }
  } catch { return { x: null, y: null } }
})
const [postItMinimized, setPostItMinimized] = useState(() => {
  try { return localStorage.getItem('postItMinimized') === '1' } catch { return false }
})
const [postItDragging, setPostItDragging] = useState(false)
const postItDragOffset = React.useRef({ x: 0, y: 0 })
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

  const [bookFilters, setBookFilters] = useState({ nome: '', intestatario: '', saldoMin: '', saldoMax: '', nota: '', soloConNota: false })
  const [walletFilters, setWalletFilters] = useState({ nome: '', intestatario: '', saldoMin: '', saldoMax: '', nota: '', soloConNota: false })
  const [txFilters, setTxFilters] = useState({ tipo: '', azione: '', categoria: '', testo: '', importoMin: '', importoMax: '', dataFrom: '', dataTo: '' })
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
const [docFiles, setDocFiles] = useState([]) // file del cliente
const [docLoading, setDocLoading] = useState(false)
const [docUploading, setDocUploading] = useState(false)
const [puntiMoneteBooks, setPuntiMoneteBooks] = useState([])
const [puntiMoneteSaldi, setPuntiMoneteSaldi] = useState({})
const [puntiMoneteLoading, setPuntiMoneteLoading] = useState(false)
const [pmBooks, setPmBooks] = useState([])
const [pmSaldi, setPmSaldi] = useState({})
const [pmLoading, setPmLoading] = useState(true)
const [puntiMonetaCaricata, setPuntiMonetaCaricata] = useState(false)
const [matriceCaricata, setMatriceCaricata] = useState(false)
const [smsCaricato, setSmsCaricato] = useState(false)
const [speseCategoriaMese, setSpeseCategoriaMese] = useState([])
const [txLoadAll, setTxLoadAll] = useState(false)
const [speseMeseSelezionato, setSpeseMeseSelezionato] = useState(() => new Date().toISOString().slice(0, 7))
const [speseStorico, setSpeseStorico] = useState({}) // { 'YYYY-MM': [...tx] }
const [soglieBudget, setSoglieBudget] = useState({})
const [showSoglieEditor, setShowSoglieEditor] = useState(false)
const [pmNuovoBook, setPmNuovoBook] = useState({ nome: '', valorePunto: 0.001818, bookId: '' })
const [pmShowAggiungi, setPmShowAggiungi] = useState(false)

// SMS state
const [smsSelezionato, setSmsSelezionato] = useState(null)
const [smsClienti, setSmsClienti] = useState([])
const [smsFiltroCliente, setSmsFiltroCliente] = useState('')
const [smsFiltroDa, setSmsFiltroDa] = useState('')
const [smsFiltroDal, setSmsFiltroDal] = useState('')
const [smsFiltroAl, setSmsFiltroAl] = useState('')
const [showSmsPopup, setShowSmsPopup] = useState(false)
const [smsNuovi, setSmsNuovi] = useState([])
  // Credenziali
const [credenziali, setCredenziali] = useState([])
const [credenzialiLoading, setCredenzialiLoading] = useState(false)
const [credenzialiFiltro, setCredenzialiFiltro] = useState('')
const [showCredenzialeModal, setShowCredenzialeModal] = useState(false)
const [credenzialeForm, setCredenzialeForm] = useState({ book_id: '', bookmaker_manuale: '', intestatario_manuale: '', username: '', password: '', data_iscrizione: '', risposta_segreta: '', limite_settimanale: '', invio_documenti: false, note: '' })
const [credenzialeRivelata, setCredenzialeRivelata] = useState(null)
const [credenzialeRivelataLoading, setCredenzialeRivelataLoading] = useState(null)
  const [editingCredenziale, setEditingCredenziale] = useState(null)
const [showImportModal, setShowImportModal] = useState(false)
const [testoCopiatoId, setTestoCopiatoId] = useState(null)
const [importTesto, setImportTesto] = useState('')
const [importInCorso, setImportInCorso] = useState(false)
const [importReport, setImportReport] = useState(null)
  useEffect(() => {
  loadData()
}, [])





const CLASSI_BOOK = {
  A: ['bet365','snai','sisal','lottomatica','goldbet','planetwin365','eurobet','pokerstars'],
  B: ['netbet','bwin','betsson','william hill','stanleybet','e-play24','betfair'],
  B_CASINO: ['gioco digitale','starcasino','betflag','tombola','zonagioco'],
  C: ['admiral','codere','betpoint','staryes','sportium','vincitu','marathonbet','domusbet','betpassion'],
}
const MANUTENZIONE = {
  A: { label: 'Serie A', frequenza: 'Bet 1 ogni 2 mesi (Slot 1 ogni 2 mesi se solo-casinò)', azioni: ['1 bet sportiva ogni 2 mesi (giorno random)', 'Se solo-casinò: 1 sessione slot 5-10€ ogni 2 mesi al posto della bet'] },
  B: { label: 'Serie B', frequenza: 'Bet 1 ogni 2 mesi (Slot 1 ogni 2 mesi se solo-casinò)', azioni: ['1 bet sportiva ogni 2 mesi (giorno random)', 'Se solo-casinò: 1 sessione slot 5-10€ ogni 2 mesi al posto della bet'] },
  C: { label: 'Serie C', frequenza: 'Bet 1 ogni 2 mesi (Slot 1 ogni 2 mesi se solo-casinò)', azioni: ['1 bet da 5-10€ ogni 2 mesi (giorno random)', 'Se solo-casinò: 1 sessione slot 5-10€ ogni 2 mesi al posto della bet'] }
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

// ============================================================
// NUOVI PROTOCOLLI ATTIVO — fonte: Profiliamo (aggiornamento luglio 2026)
// Si applicano SOLO a book con profilo_livello === 'attivo'.
// I book in mantenimento (A/B/C) restano sul sistema esistente sopra, invariato.
// ============================================================

const SLOT_CONSIGLIATE = {
  'Betsoft': ['Sugar Pop', 'Fruit Zen'],
  'Fazi': ['Tutte le "Hot 20, 40, 100"', 'Tutte le "Clover"', 'Tutte le "Crystal"', 'Tutte le "Turbo Hot"'],
  'Amusnet': ['Tutte le "Hot 20, 40, 100"', 'Golden Coins', 'Tutte le Extra Crown'],
  'Netent': ['Motorhead', 'Secret of Atlantis', 'Starburst', 'Tutte le Jack Hammer', 'Blood Suckers'],
  'Pragmatic': ['888 Dragon', 'Dragon Kingdom', 'Shining Hot 100'],
  'Endorphina': ['The Emirate Hit Slot'],
  'Habanero': ['Calaveras Explosivas', '12 Zodiac', 'Hot Summer'],
  'Thunderkick': ['1429 Uncharted Seas'],
  'Playtech': ['Halloween Fortune', 'Mr. Cashback', 'Desert Treasure', 'A Night Out', 'Lotto Madness'],
  'Games Global': ['9 Mask of Fire', '9 Pots of Gold', 'Diamond Inferno', 'Playboy Fortunes', '9 Mad Hats'],
  'Gioco Online': ['Pierino Tenta la Fortuna', 'Pigalle', 'Voodoo Curse'],
  'World Match': ['Re Mida', 'Banan King', 'Fruits Evolution', 'King Valley'],
  'Octavian': ['Scary Clown']
}

const PROTOCOLLO_STANDARD_SPORT = { ricarica: '50-100€', bet: '2-3 bet/sett da 10 a 25€', quotaMin: 1.35 }
const PROTOCOLLO_STANDARD_CASINO = { ricarica: '50-100€', slot: '50-100€ spin bassi' }
// CORREZIONE: quigioco, stanleybet, bwin, betfair, betpoint erano stati messi qui per errore —
// dal riscontro con gli screenshot originali hanno tutti template PROPRI, diversi dallo standard 50-100€.
const BOOK_STANDARD = [
  'marathon', 'zonagioco', 'perlaplay', 'sunbet', 'betpassion',
  'giochi24', 'codere', 'vincitu', 'domusbet', 'daznbet', 'netwin', 'elabet', 'gioca7',
  'casino di venezia', 'staryes', 'bgame', 'stake', 'e-play24', 'betitaly',
  'totosi'
]

// Planetwin365 — template "Casinò 200€" (diverso dallo standard 50-100€, condiviso concettualmente
// con la card base di Lottomatica/GoldBet, ma quei due usano già la VIP come protocollo primario)
const PROTOCOLLO_CASINO_200 = {
  ricarica: '200€', live: '200€', slot: '100-200€', sport: '100€',
  azioni: ['Ricarica almeno 200€ a inizio settimana', 'Un giorno gioca 200€ casinò live + 100-200€ slot spin basso', 'Un altro giorno gioca 100€ sport su 3/4 bet sport', 'Usa tutte le valide per tutti', 'Ripeti per 4 settimane', 'Usa le riservate che arrivano e ripeti ogni 2 mesi']
}
const BOOK_CASINO_200 = ['planetwin365']

// QuiGioco — template proprio (ciclo con fermo 14gg)
const PROTOCOLLO_QUIGIOCO = {
  ricarica: '50-100€', bet: '2-3 piccola da 10 a 25€ max', fermo: '14gg',
  azioni: ['Ricarica 50-100€', 'Gioca 2/3 bet piccola (da 10€ a 25€ max)', 'Sblocca il resto dei fondi su Virtuali come spiegato nella Entry, o Starburst/simili a spin basso', '2/3 giorni dopo: preleva e lascia tra 5€ e 20€ di saldo', 'Lascia il conto fermo e attendi', 'Se arrivano promo entro 14 giorni: falle e ripeti il giochino (già col saldo depositato per la promo)', 'Se NON arrivano: ripeti da capo fino a riceverle']
}

// Stanleybet — template proprio (ricarica min 50€, bet/gg, durata 1 mese)
const PROTOCOLLO_STANLEYBET = {
  ricaricaMin: '50€', betGg: '3-4', durata: '1 mese',
  azioniSport: ['Ricarica almeno 50€ a inizio settimana', 'Gioca 3/4 bet in un singolo giorno dopo la ricarica', 'Importo da 10 a 30€ massimo — quota minima 1.35, che si concludano in giornata/gg dopo', 'Ripeti per 1 mese ogni settimana', 'Utilizza le valide per tutti profittevoli'],
  azioniCasino: ['Ricarica almeno 50€ a inizio settimana', 'Gioca 50-100€ slot spin bassi (meglio 3/4 diverse) giorno dopo la ricarica', 'Ripeti per 1 mese ogni settimana', 'Utilizza le valide per tutti profittevoli'],
  gestione: ['Se vedi un calo nelle promozioni: ripeti da capo', 'Utilizza il buon senso nei prelievi'],
  recupero: ['Se limitato alle promozioni: vedi recupero stile Eurobet o Lottomatica e richiedi valutazione']
}

// Bwin — template proprio (ricarica min 30€, 3-4 bet/sett da 15-50€, 3 settimane)
const PROTOCOLLO_BWIN = {
  ricaricaMin: '30€', betSett: '3-4 da 15 a 50€', settimane: 3,
  azioni: ['Ricarica almeno 30€ a inizio settimana', 'Gioca 3/4 bet da 15 a massimo 50€ su incontri che giochi entro sera/gg dopo', 'Ripeti per 3 settimane', 'Utilizza le valide per tutti profittevoli'],
  gestione: ['Se non arrivano promozioni interessanti: preleva, lascia conto fermo con meno di 50€ e attendi 14gg', 'Se non arrivano promozioni interessanti: ripeti da capo', 'Utilizza il buon senso nei prelievi'],
  recupero: ['Se limitato alle promozioni: vedi recupero stile Eurobet o Lottomatica e richiedi valutazione', 'In alternativa se limitato alle puntate Sport: fai tante bet da 2€ in modo da sbloccarlo, successivamente chiedi in chat', 'Potresti anche attendere una promozione deposito e poi richiedere lo sblocco dei limiti, in quanto vuoi giocare allo Sport']
}

// Betfair / Betpoint — template Exchange proprio (20€ min, 2-3 bet/sett 5-20€, 3 settimane).
// NOTA: testo identico tra i due nello screenshot originale — probabile refuso Profiliamo,
// confermato da Sergio di tenerlo così com'è.
const PROTOCOLLO_BETFAIR = {
  ricaricaMin: '20€', betSett: '2-3 da 5-20€', settimane: 3,
  azioniSport: ['Ricarica almeno 20€', '2-3 scommesse a settimana da 5 a 20€ massimo', 'Ripetere per 3 settimane', 'Verificare eventuali promo in quanto non manda mail'],
  azioniCasino: ['Ricarica almeno 20€', '10-20€ slot per 3 giorni consecutivi a spin bassi', 'Ripetere per 3 settimane', 'Verificare eventuali promo in quanto non manda mail'],
  gestione: ['Da ripetere appena si vede un calo delle riservate, mediamente', "Tieni un Betfair che utilizzi solo per Exchange, così da non sbagliare e utilizzare match che giochi nello Sportbook e copri nell'Exchange"],
  recupero: ['Se limita alle promozioni: utilizza solo Exchange e tra un paio di mesi chiedi rivalutazione facendo lo gnorri (vedi esempi di Eurobet o Lotto)']
}
const BOOK_BETFAIR_EXCHANGE = ['betfair', 'betpoint']

const PROTOCOLLI_VIP_FASE12 = {
  'sisal': { ricaricaSett: '100€+', giocatoSett: '200€+', sportMese: '40-50€' },
  'pokerstars': { ricaricaSett: '100€+', giocatoSett: '200€+', sportMese: '40€' },
  'snai': { ricaricaSett: '100€+', giocatoSett: '200€+', sportMese: '40-50€' }
}
const AZIONI_VIP_FASE12 = {
  fase1: ['Ricarica almeno {ricaricaSett} ogni settimana (movimenta, lunedì mattina compresa la ricarica)', 'Fai le valide per tutti sia Sport che Casinò quando disponibili', 'Gioca almeno {giocatoSett} ogni settimana su 2/3 giorni consecutivi offline e Cas. Live (le valide per tutti entrano nel conteggio)', '1 volta al mese gioca almeno {sportMese} Sport', 'Ripeti ogni settimana — se arrivano promozioni usale per accumulare giocato', 'Se NON arrivano promo dopo 6 settimane: preleva, lascia meno di 50€ e stai fermo (nessun movimento)', 'N.B. Entra nel conto e verifica: raramente inviano mail per le promozioni'],
  fase2: ['Ricarica almeno {ricaricaSett} ogni settimana (movimenta, lunedì mattina compresa la ricarica)', 'Fai le valide per tutti sia Sport che Casinò', 'Aumenta i volumi oltre i 300€ a settimana su 2gg consecutivi — il resto dei giorni lascia sgonfiare il conto (offline e Cas. Live)', '1/2 volte al mese copri Sport da 50€ in su', 'Se arrivano promozioni: usale e accumula giocato', 'Se NON arrivano promo dopo 6 settimane: preleva, lascia meno di 50€ e stai fermo (nessun movimento)', 'N.B. Entra nel conto e verifica: raramente inviano mail per le promozioni'],
  alzarePromo: [
    'Metodo 1: preleva e lascia meno di 50€, lascia conto fermo 14gg, entra nel conto e verifica se sono arrivate promo nella inbox o si sono alzati i limiti; se dopo 14gg ancora non si sono alzati, procedi a usare il conto normalmente e fai 200€ slot a spin basso ogni settimana. Fallo a rotazione con gli amici così da non lasciare troppi conti fermi',
    'Metodo 2: utilizza ugualmente le promozioni, fai giocato 200€ slot extra tutte le settimane a spin basso'
  ]
}

const PROTOCOLLI_VIP_LOTTO = {
  'goldbet': { ricarica: '1000€', slot: '500€', sport: '300€' },
  'lottomatica': { ricarica: '1000€', slot: '500€', sport: '300€' }
}
const AZIONI_VIP_LOTTO = {
  lottoVipLive: ['Ricarica 500€ anche su diverse ricariche', 'GG1: 300€ casinò live + 200€ giochi offline (slot, bj, spin basso)', 'GG2: 300€ casinò live + 200€ giochi offline (slot, bj, spin basso)', 'GG3: 500€ casinò live totale su due bet + 300€ giochi offline (slot, bj, spin basso)', 'Fai tutte le valide per tutti', 'Ripeti altre 2 settimane', 'Settimana 4 preleva, lascia 100-200€', 'Fai almeno 2 conti in contemporanea', 'In fase profilativa accumula saldo (preleva prima se ne hai bisogno, ovviamente)', "Inizia la profilazione all'inizio del mese", 'Se il conto passa VIP ottimo, usa il conto e dosalo in base alla ricezione promozionale (vedi VIP senza Promo)', 'Se il conto NON diventa subito VIP, utilizza il conto normalmente e ripeti il mese successivo'],
  vipSenzaPromo: ['Ricarica almeno 1000€ su + ricariche', 'Gioca a sezioni come da esempi', 'Lunedì 300€ sport quota 2.50 in su', 'Mercoledì 300-400€ casinò live', 'Giovedì 500€ slot spin bassi + cashback', 'Domenica 150-200€ virtuali atteso su tante bet da 25', 'Lascia conto fermo con poco saldo e controllo inbox']
}

const PROTOCOLLO_STARCASINO = {
  ricarica: 500, live: 1000, slot: '200-300',
  fase1: ['Deposita almeno 500', 'Gioca 1000 totale (due colpi da 500) al Casinò Live', 'Fai volume di 200-300 slot scelte consigliate', 'Lascia conto fermo 14gg', "Consigliato iniziare Lunedì/Martedì", 'SE VINCI: dopo aver terminato il volume preleva e lascia meno di 50 — lascia conto fermo', 'SE PERDI: lascia conto fermo', 'Nei 14gg di fermo: se il conto risponde subito con promo Free Spin/Ricarica procedi a portarlo a casa; se il conto non risponde subito procedi col passaggio successivo', 'Una volta terminato: se il conto risponde, procedi a ripetere SOLO quando non arrivano promozioni in generale per almeno 1 mese; se il conto NON risponde, dai priorità ad altri conti e più avanti riprova'],
  gestioneConto: ['Se il conto dà parecchie promozioni settimanali (2 ricarica e free spin), salta qualche promozione ad esempio quella della domenica', 'Prima di prelevare fai un volume offline piccolo', "Quando è terminata la profilazione, evita di prelevare subito dopo il live", 'Prelievi consigliati quando ti servono i fondi, in quanto il prelievo è veloce'],
  recuperoContiLimitati: ['Limita solo la parte bonus', 'Puoi provare il recupero stile Lottomatica facendo un volume blando e richiedendo valutazione', 'Chiudere e riaprire al momento NON è consigliato', 'Quando parli con gli operatori fai lo gnorri', 'Cerca di far capire che vuoi giocare al loro sito su slot e giochi NON copribili', 'Accetta le promozioni anche se NON ti arriveranno i bonus']
}

const PROTOCOLLO_EUROBET = {
  tecnica: 'Multipla', livelloVip: 'Classic', utilizzo: '2-3 gg/sett',
  intro: 'Superata la fase di benvenuto (salta e attendi almeno 14gg), Eurobet regala promozioni senza grandi movimentazioni.',
  profilazione: ['Raggiungi il Livello VIP "Classic" facendo volume di gioco nel mese (verificabile nel conto gioco)', 'Per il volume TOTALE utilizza le promozioni valide per tutti / riservate per volumi su Sport/Casinò', 'Extra volume: 2/3 bet sportive da 20 a 60€ — con storico puoi arrivare a bet da 150€ per eventuale copertura', 'Raggiunto il VIP, usa le promozioni; se si conferma nuovamente bene, altrimenti torna allo status standard', 'Allo status standard, controlla e utilizza le promozioni riservate quando sfruttabili', 'Se arrivano promozioni: usale e accumula giocato', "Facendo questo 'sali e scendi' diventi un ottimo cliente e il conto si auto-alimenta", 'In fase iniziale con sola Sportiva, cerca un rating al 95% medio (controlla il match) o usalo come copertura', 'Se arrivano poche promozioni, rifai nuovamente il Classic e ritorna allo status standard il mese successivo', 'N.B. Non è obbligatorio fare e mantenere il Classic ogni mese — dosalo in base al punto del percorso in cui ti trovi', "Cerca di utilizzare il conto 2/3 giorni alla settimana e concentra l'operatività"],
  recupero: ["Pazienza, può volerci 1 tentativo o 10, dipende dall'operatore che trovi", "Se hai ricevuto limitazione con domicilio, procedi a prelevare in quanto è una verifica", 'Fai 2/3 ricariche nel mese da 20€ su varie sezioni (Sport, Slot, Virtuali, ecc.)', 'Fai un volume di gioco di 50-100€ su diversi giochi, comportati come se fossi un giocatore casuale', 'Cerca di fare bet "piccole" e volumi su diversi giochi, comportati come giocatore casuale', 'Accetta promozioni a caso, pur sapendo che non arriverà il bonus', 'Contatta tramite Chat o Mail per info sulle promozioni — dai pareri da GIOCATORE, giri intorno prima', 'Una volta ottenute le info, richiedi la rivalutazione del conto gioco per tornare a giocare', 'Se hai metodi di prelievo bloccati, chiedi anche lo sblocco nelle settimane successive per comodità', "Il conto può essere recuperato nel Tempo — se ricevi picche, ripeti da capo senza pensarci troppo"]
}

const PROTOCOLLO_BETFLAG = {
  ricarica: 2000, giocato: 3000,
  azioni: ['Deposita almeno 2000', 'Gioca almeno 3000 su giochi offline lo stesso giorno', 'Alla notte preleva e lascia conto fermo due mesi', 'Se dopo 2 mesi arrivano promozioni usale e mantieni il conto semplicemente sbloccando il saldo + bonus', 'Se dopo 2 mesi ancora no promo, ripeti la profilazione', 'NON usare il conto neanche per bancare', "Dato l'importo elevato di ricarica, fallo solo su conti sani e amici vicini in caso di richiesta documenti"]
}

const PROTOCOLLO_MYLOTTERYPLAY = {
  ricaricheMese: '4+', slot: '50-100€ spin bassi',
  azioni: ['Ricarica 50€ almeno 4 volte al mese anche se hai saldo', 'Fai tutte le valide per tutti', 'Gioca 50-100€ extra a settimana Slot spin bassi'],
  gestione: ['Tutte le valide per tutti puoi farle', 'Usa il buon senso nei prelievi'],
  recupero: ['Se limitato alle promozioni: vedi recupero stile Eurobet o Lottomatica e richiedi valutazione']
}

// Bet365 — Profilazione Sportiva "Superquote" (caso speciale, non era nello schema standard)
const PROTOCOLLO_BET365 = {
  tecnica: 'Superquote', betSett: '10-15', ricaricheSett: '5/sett',
  finteRiservate: ['Tieni il conto attivo', 'Fai almeno una ricarica al mese', 'Fai almeno una bet sportiva da 20€ in su nel mese'],
  aumentoSuperquote: ['Almeno 10-15 bet a settimana da 10 a 50€ (varia importo) — quota minima 1.35, se puoi farle live meglio ancora', 'Ricarica almeno 5 volte nella settimana (anche se hai saldo) di qualsiasi importo — le bet possono essere fatte anche in un singolo giorno', 'N.B. Usa le coperture di importo più alto come mezzo per abbattere i costi', "Una volta che sale l'importo, mantieni il conto con qualche copertura nel mese", 'Gioca 800€ a settimana in Doppia sfruttando il Bet365 Club'],
  aumentoSuperquotaA1: ['Fai coperture randomiche nel conto gioco', 'Almeno 2 a settimana e si rialzano in automatico'],
  recupero: ['NON DISPONIBILE se hai limitazione ai Bonus']
}

const PROTOCOLLI_EXPERT = {
  'betsson': {
    label: 'Betsson Expert',
    azioni: ['3/4 promo BJ a settimana', 'Cashback 100%', 'Almeno 2 ricariche a settimana da 50€ in su', 'Appena ricevi le riservate, continua a fare le VXT + ricariche']
  },
  'william hill': {
    label: 'William Hill Expert',
    azioni: ['Volume per tutti 2/3 settimane a ruotare', 'Sblocco saldo offline', 'Extra sblocco saldo 20-40€ su BJ offline', 'Se ricevi riservate weekend riduci i giocati generali']
  },
  'netbet': {
    label: 'NetBet Expert',
    azioni: ['Fai le promozioni VXT FUN 1/2 volte a settimana', 'Fai le cashback quando disponibili, almeno 1 volta a settimana', "Sblocca saldo su diversi giochi ad alto RTP o metodi soliti — cerca di evitare di fare l'occhino e movimenta leggermente di più", 'Fallo solo sui conti che possono fornire diversi documenti nel caso peggiore', 'Preleva dopo aver fatto tutto offline qualche giorno dopo', 'Finché manda VXT ripeti']
  },
  'admiral': {
    label: 'AdmiralBet Expert',
    azioni: ['Ricarica almeno 500€', 'Gioca 400-500€ almeno con 4 amici sui numeri (se meno puoi procedere ugualmente, ma con maggior rischio book)', 'Il vincitore giocherà 200-300€ slot extra a spin bassi subito dopo', 'Fai 1 promo cashback disponibile per un importo minore nello stesso giorno', 'Alla notte preleva e lascia meno di 50€'],
    dueScenari: ['Arrivano riservate: utilizza tutte le riservate inviate', 'NON arrivano riservate: ripeti la settimana successiva'],
    gestione: ['Tieni conto fermo in attesa di nuove riservate per massimo 14gg', 'Ripeti appena vedi un calo nelle promo riservate, mediamente una volta ogni 2 mesi'],
    recupero: ['Se limitato alle promozioni: vedi recupero stile Eurobet o Lottomatica e richiedi valutazione']
  }
}

function getNomeNormalizzato(nomeBook) {
  return (nomeBook || '').toLowerCase().replace(/\.it$/, '').trim()
}

function getTipoProtocolloAttivo(nomeBook) {
  const nome = getNomeNormalizzato(nomeBook)
  if (nome.includes('starcasino')) return 'starcasino'
  if (nome.includes('eurobet')) return 'eurobet'
  if (nome.includes('betflag')) return 'betflag'
  if (nome.includes('bet365')) return 'bet365'
  if (nome.includes('mylotteryplay') || nome.includes('my lottery')) return 'mylotteryplay'
  if (nome.includes('quigioco')) return 'quigioco'
  if (nome.includes('stanleybet')) return 'stanleybet'
  if (nome.includes('bwin')) return 'bwin'
  if (BOOK_BETFAIR_EXCHANGE.some(k => nome.includes(k))) return 'betfair_exchange'
  if (BOOK_CASINO_200.some(k => nome.includes(k))) return 'casino_200'
  if (['sisal', 'pokerstars', 'snai'].some(k => nome.includes(k))) return 'vip_fase12'
  if (['goldbet', 'lottomatica'].some(k => nome.includes(k))) return 'vip_lotto'
  if (['betsson', 'william hill', 'netbet', 'admiral'].some(k => nome.includes(k))) return 'expert'
  if (BOOK_STANDARD.some(k => nome.includes(k))) return 'standard'
  return null
}

function getAgendaAttivoV2(book, giorno, settimana) {
  const nome = getNomeNormalizzato(book.nome)
  const tipo = getTipoProtocolloAttivo(book.nome)
  if (!tipo) return null

  if (tipo === 'standard') {
    const giornoRicarica = [1, 2, 3][hashBook(book.id, settimana * 10 + 50) % 3]
    const giorniSlot = [0, 1, 2, 3, 4, 5, 6].filter(g => g !== giornoRicarica)
    const giornoSlot = giorniSlot[hashBook(book.id, settimana * 10 + 51) % giorniSlot.length]
    const giorniSport = [0, 1, 2, 3, 4, 5, 6].filter(g => g !== giornoRicarica && g !== giornoSlot)
    const giornoSport = giorniSport[hashBook(book.id, settimana * 10 + 52) % giorniSport.length]

    if (giorno === giornoRicarica) return [`Ricarica ${PROTOCOLLO_STANDARD_SPORT.ricarica}`]
    if (giorno === giornoSlot) return [`Gioca ${PROTOCOLLO_STANDARD_CASINO.slot}`]
    if (giorno === giornoSport) return [`Gioca ${PROTOCOLLO_STANDARD_SPORT.bet} — quota min ${PROTOCOLLO_STANDARD_SPORT.quotaMin}, refertazione entro sera/gg dopo`]
    return null
  }

  if (tipo === 'vip_fase12') {
    const chiave = Object.keys(PROTOCOLLI_VIP_FASE12).find(k => nome.includes(k))
    const p = PROTOCOLLI_VIP_FASE12[chiave]
    if (!p) return null
    const giornoRicarica = 1
    const startVolume = [2, 3, 4][hashBook(book.id, settimana * 10 + 53) % 3]
    const giorniVolume = [startVolume, startVolume + 1 > 6 ? 0 : startVolume + 1]
    const giorniRimanenti = [0, 1, 2, 3, 4, 5, 6].filter(g => g !== giornoRicarica && !giorniVolume.includes(g))
    const giornoSport = giorniRimanenti[hashBook(book.id, settimana * 10 + 54) % giorniRimanenti.length]
    const mostraSportOggi = giorno === giornoSport && (hashBook(book.id, settimana + 700) % 2 === 0)

    if (giorno === giornoRicarica) return [`Ricarica ${p.ricaricaSett} (movimenta, compresa la ricarica)`]
    if (giorniVolume.includes(giorno)) return [`Gioca ${p.giocatoSett} offline e Cas. Live (2/3gg consecutivi)`]
    if (mostraSportOggi) return [`Copri Sport da ${p.sportMese}`]
    return null
  }

  if (tipo === 'vip_lotto') {
    const chiave = Object.keys(PROTOCOLLI_VIP_LOTTO).find(k => nome.includes(k))
    const p = PROTOCOLLI_VIP_LOTTO[chiave]
    if (!p) return null
    const giornoRicarica = 1
    const gg1 = 2, gg2 = 3, gg3 = 4
    const giornoSport = [5, 6, 0][hashBook(book.id, settimana * 10 + 55) % 3]

    if (giorno === giornoRicarica) return [`Ricarica ${p.ricarica} (anche su diverse ricariche)`]
    if (giorno === gg1) return ['GG1: 300€ casinò live + 200€ giochi offline (slot, bj, spin basso)']
    if (giorno === gg2) return ['GG2: 300€ casinò live + 200€ giochi offline (slot, bj, spin basso)']
    if (giorno === gg3) return ['GG3: 500€ casinò live totale su due bet + 300€ giochi offline']
    if (giorno === giornoSport) return ['Sport quota 2.50+ (parte del giro VIP)']
    return null
  }

  if (tipo === 'starcasino') {
    const giornoRicarica = [1, 2][hashBook(book.id, settimana * 10 + 56) % 2]
    const giornoLive = giornoRicarica + 1 <= 6 ? giornoRicarica + 1 : giornoRicarica - 1
    const giorniSlot = [0, 1, 2, 3, 4, 5, 6].filter(g => g !== giornoRicarica && g !== giornoLive)
    const giornoSlot = giorniSlot[hashBook(book.id, settimana * 10 + 57) % giorniSlot.length]

    if (giorno === giornoRicarica) return [`Deposita almeno ${PROTOCOLLO_STARCASINO.ricarica}€ (Lun/Mar consigliato)`]
    if (giorno === giornoLive) return [`Gioca ${PROTOCOLLO_STARCASINO.live}€ totale (due colpi da 500) al Casinò Live`]
    if (giorno === giornoSlot) return [`Volume ${PROTOCOLLO_STARCASINO.slot}€ slot scelte consigliate`]
    return null
  }

  if (tipo === 'eurobet') {
    const giorniOperativi = [1, 3]
    const giornoExtra = [2, 4][hashBook(book.id, settimana * 10 + 58) % 2]
    if (giorno === giorniOperativi[0]) return ['Utilizza il conto (Livello VIP Classic) — controlla promo valide per tutti']
    if (giorno === giorniOperativi[1]) return ['Utilizza il conto — controlla riservate su Sport/Casinò']
    if (giorno === giornoExtra) return ['Extra: 2/3 bet sportive da 20 a 60€ (rating ~95%, o copertura)']
    return null
  }

  if (tipo === 'betflag') {
    const oggi = new Date()
    const GIORNO_ZERO = new Date('2026-05-18')
    const giorniDaZero = Math.floor((oggi - GIORNO_ZERO) / 86400000)
    const offset = hashBook(book.id, 999) % 60
    const isGiornoAttivo = (giorniDaZero - offset) % 60 === 0
    if (isGiornoAttivo) return [`Deposita ${PROTOCOLLO_BETFLAG.ricarica}€, gioca ${PROTOCOLLO_BETFLAG.giocato}€ offline stesso giorno, poi preleva e lascia fermo 2 mesi`]
    return null
  }

  if (tipo === 'bet365') {
    // Ricariche 5/sett + bet Superquote: copertura ampia (5 giorni operativi su 7)
    const tuttiGiorni = [0, 1, 2, 3, 4, 5, 6]
    const giornoDoppia = tuttiGiorni[hashBook(book.id, settimana * 10 + 70) % 7]
    const giorniRestanti = tuttiGiorni.filter(g => g !== giornoDoppia)
    const giornoCopertura = giorniRestanti[hashBook(book.id, settimana * 10 + 71) % giorniRestanti.length]
    const giorniOperativi = tuttiGiorni.filter(g => g !== giornoDoppia && g !== giornoCopertura)

    if (giorno === giornoDoppia) return ['Gioca 800€ a settimana in Doppia sfruttando il Bet365 Club']
    if (giorno === giornoCopertura) return ['Copertura randomica nel conto gioco (almeno 2/sett, per aumento Superquota a 1)']
    if (giorniOperativi.includes(giorno)) return ['Ricarica (5/sett) + 2-3 bet Superquote da 10-50€ — quota min 1.35, meglio se live']
    return null
  }

  if (tipo === 'casino_200') {
    const giornoRicarica = 1 // "a inizio settimana"
    const giorniRestanti = [0, 2, 3, 4, 5, 6]
    const giornoLive = giorniRestanti[hashBook(book.id, settimana * 10 + 80) % giorniRestanti.length]
    const giorniSportPossibili = giorniRestanti.filter(g => g !== giornoLive)
    const giornoSport = giorniSportPossibili[hashBook(book.id, settimana * 10 + 81) % giorniSportPossibili.length]

    if (giorno === giornoRicarica) return ['Ricarica almeno 200€ a inizio settimana']
    if (giorno === giornoLive) return ['Gioca 200€ casinò live + 100-200€ slot spin basso']
    if (giorno === giornoSport) return ['Gioca 100€ sport su 3/4 bet sport']
    return null
  }

  if (tipo === 'quigioco') {
    // Ciclo con fermo 14gg: 1 giorno ricarica+bet, poi 2/3gg dopo preleva, poi resta fermo.
    // Mostriamo solo il giorno "azione" settimanale (ricarica + bet); lo sblocco/preleva è gestione manuale.
    const giornoAzione = [1, 2][hashBook(book.id, settimana * 10 + 82) % 2]
    if (giorno === giornoAzione) return ['Ricarica 50-100€ + gioca 2/3 bet piccole (10-25€ max), poi sblocca resto su Virtuali/Starburst a spin basso']
    return null
  }

  if (tipo === 'stanleybet') {
    const giornoRicarica = 1 // "a inizio settimana"
    const giorniRestanti = [0, 2, 3, 4, 5, 6]
    const giornoAzione = giorniRestanti[hashBook(book.id, settimana * 10 + 83) % giorniRestanti.length] // giorno dopo ricarica, bet o slot
    const usaSlot = hashBook(book.id, settimana + 900) % 2 === 0 // alterna bet sportiva / slot tra le settimane

    if (giorno === giornoRicarica) return ['Ricarica almeno 50€ a inizio settimana']
    if (giorno === giornoAzione) return usaSlot
      ? ['Gioca 50-100€ slot spin bassi (meglio 3/4 diverse)']
      : ['Gioca 3/4 bet da 10 a 30€ max — quota minima 1.35']
    return null
  }

  if (tipo === 'bwin') {
    const giornoRicarica = 1
    const giorniRestanti = [0, 2, 3, 4, 5, 6]
    const giornoBet = giorniRestanti[hashBook(book.id, settimana * 10 + 84) % giorniRestanti.length]
    if (giorno === giornoRicarica) return ['Ricarica almeno 30€ a inizio settimana']
    if (giorno === giornoBet) return ['Gioca 3/4 bet da 15 a 50€ max su incontri che giochi entro sera/gg dopo']
    return null
  }

  if (tipo === 'betfair_exchange') {
    const giornoRicarica = 1
    const giorniRestanti = [0, 2, 3, 4, 5, 6]
    const giornoAzione = giorniRestanti[hashBook(book.id, settimana * 10 + 85) % giorniRestanti.length]
    if (giorno === giornoRicarica) return ['Ricarica almeno 20€ (usa solo Exchange)']
    if (giorno === giornoAzione) return ['2-3 scommesse Exchange da 5-20€ (sport) o 10-20€ slot 3gg consecutivi (casinò) — verifica promo, non manda mail']
    return null
  }

  if (tipo === 'mylotteryplay') {
    const giorniRicarica = [1, 2, 4, 5]
    const giornoRicaricaOggi = giorniRicarica[hashBook(book.id, settimana * 10 + 59) % giorniRicarica.length]
    const giornoSlot = [3, 6][hashBook(book.id, settimana * 10 + 60) % 2]
    if (giorno === giornoRicaricaOggi) return ['Ricarica 50€']
    if (giorno === giornoSlot) return [`Gioca ${PROTOCOLLO_MYLOTTERYPLAY.slot}`]
    return null
  }

  if (tipo === 'expert') {
    const chiave = Object.keys(PROTOCOLLI_EXPERT).find(k => nome.includes(k))
    const p = PROTOCOLLI_EXPERT[chiave]
    if (!p) return null
    const azioni = p.azioni
    const nGiorni = Math.min(azioni.length, 7)
    const giorniUsati = []
    let seedOffset = 60
    while (giorniUsati.length < nGiorni && seedOffset < 260) {
      const g = hashBook(book.id, settimana * 10 + seedOffset) % 7
      if (!giorniUsati.includes(g)) giorniUsati.push(g)
      seedOffset++
    }
    const idx = giorniUsati.indexOf(giorno)
    if (idx === -1) return null
    return [azioni[idx]]
  }

  return null
}

// Riassunto STATICO (non legato al giorno) del nuovo protocollo assegnato — usato nella colonna
// "Protocollo" della tabella Profilazione, solo per book con profilo_livello === 'attivo'.
function getRiassuntoProtocolloAttivo(nomeBook) {
  const tipo = getTipoProtocolloAttivo(nomeBook)
  if (!tipo) return null
  const nome = getNomeNormalizzato(nomeBook)

  if (tipo === 'expert') {
    const chiave = Object.keys(PROTOCOLLI_EXPERT).find(k => nome.includes(k))
    const p = PROTOCOLLI_EXPERT[chiave]
    if (!p) return null
    return { durata: p.label, capitale_min: null, azioni: p.azioni.slice(0, 3) }
  }

  const RIASSUNTI = {
    standard: { durata: 'Standard (Sport + Casinò)', capitale_min: 50, azioni: ['Ricarica 50-100€', '2-3 bet/sett — quota min 1.35', 'Slot 50-100€ spin bassi'] },
    vip_fase12: { durata: 'VIP Fase 1 & 2', capitale_min: 100, azioni: ['Ricarica 100€+/sett', 'Volume 200€+/sett offline + Cas. Live', 'Sport 40-50€, 1-2 volte/mese'] },
    vip_lotto: { durata: 'VIP Lotto Live', capitale_min: 1000, azioni: ['Ricarica 500-1000€', 'GG1-3: casinò live + giochi offline', 'Sport 300€ (quota 2.50+)'] },
    casino_200: { durata: 'Casinò 200€ (ciclo 4 sett.)', capitale_min: 200, azioni: PROTOCOLLO_CASINO_200.azioni.slice(0, 3) },
    quigioco: { durata: 'QuiGioco (ciclo fermo 14gg)', capitale_min: 50, azioni: PROTOCOLLO_QUIGIOCO.azioni.slice(0, 3) },
    stanleybet: { durata: 'Stanleybet (ciclo 1 mese)', capitale_min: 50, azioni: PROTOCOLLO_STANLEYBET.azioniSport.slice(0, 3) },
    bwin: { durata: 'Bwin (ciclo 3 settimane)', capitale_min: 30, azioni: PROTOCOLLO_BWIN.azioni.slice(0, 3) },
    betfair_exchange: { durata: 'Exchange (ciclo 3 settimane)', capitale_min: 20, azioni: PROTOCOLLO_BETFAIR.azioniSport.slice(0, 3) },
    starcasino: { durata: 'StarCasinò (a Fasi)', capitale_min: 500, azioni: PROTOCOLLO_STARCASINO.fase1.slice(0, 3) },
    eurobet: { durata: 'Eurobet (Multipla, VIP Classic)', capitale_min: null, azioni: PROTOCOLLO_EUROBET.profilazione.slice(0, 3) },
    betflag: { durata: 'BetFlag (ciclo 2 mesi)', capitale_min: 2000, azioni: PROTOCOLLO_BETFLAG.azioni.slice(0, 3) },
    bet365: { durata: 'Bet365 Superquote', capitale_min: null, azioni: PROTOCOLLO_BET365.aumentoSuperquote.slice(0, 3) },
    mylotteryplay: { durata: 'MyLotteryPlay (4+ ricariche/mese)', capitale_min: null, azioni: PROTOCOLLO_MYLOTTERYPLAY.azioni.slice(0, 3) }
  }
  return RIASSUNTI[tipo] || null
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

// Calcola lo stato di un "accantonamento a rate" (usato per figlio, Paolo, Michela):
// dato uno schedule di {day, amount, key}, dice quanto e' gia' maturato, quanto resta
// da pagare questo mese, e quali rate sono scadute ma non ancora segnate come pagate.
function calcolaRateAccantonamento(schedule, dashboardSettings) {
  const oggi = new Date()
  const giorno = oggi.getDate()
  const meseKey = `${oggi.getFullYear()}-${String(oggi.getMonth() + 1).padStart(2, '0')}`
  const totale = schedule.reduce((s, r) => s + r.amount, 0)
  const maturato = schedule.filter(r => r.day <= giorno).reduce((s, r) => s + r.amount, 0)
  const daPagare = schedule.filter(r => r.day <= giorno && dashboardSettings[r.key] !== meseKey)
  return { giorno, meseKey, totale, maturato, residuo: totale - maturato, daPagare }
}

// Come calcolaRateAccantonamento, ma per il totale generale: non guarda il giorno del mese,
// parte sempre dal totale pieno e scala solo quando una rata viene segnata "Pagato".
function totaleMenoPagato(schedule, dashboardSettings) {
  const oggi = new Date()
  const meseKey = `${oggi.getFullYear()}-${String(oggi.getMonth() + 1).padStart(2, '0')}`
  const totale = schedule.reduce((s, r) => s + r.amount, 0)
  const pagato = schedule.filter(r => dashboardSettings[r.key] === meseKey).reduce((s, r) => s + r.amount, 0)
  return totale - pagato
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
    // Nuovo sistema (Profiliamo, luglio 2026): prova prima i protocolli ri-profilati
    const tipoNuovo = getTipoProtocolloAttivo(book.nome)
    if (tipoNuovo) {
      const azioniV2 = getAgendaAttivoV2(book, giorno, settimana)
      if (!azioniV2 || azioniV2.length === 0) return null
      return {
        tipo: 'attivo',
        label: ['Dom','Lun','Mar','Mer','Gio','Ven','Sab'][giorno],
        azioni: azioniV2,
        badge: '🟢 Attivo'
      }
    }
    // Fallback: book non ancora ri-profilato -> vecchio sistema, invariato
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
      const soloCasino = isSoloCasino(book.nome)
      const offset = hashBook(book.id, 101) % 60
      const isAzioneDay = (giorniDaZero - offset) % 60 === 0
      if (isAzioneDay && soloCasino) return { tipo: 'manutenzione-a', azioni: ['Sessione slot 5-10€'], badge: '🟡 Mant. A' }
      if (isAzioneDay && !soloCasino) return { tipo: 'manutenzione-a', azioni: ['1 bet sportiva'], badge: '🟡 Mant. A' }
      return null
    }

    if (classeEffettiva === 'B' || classeEffettiva === 'B_CASINO') {
      const oggi2 = new Date()
      const GIORNO_ZERO = new Date('2026-05-18')
      const giorniDaZero = Math.floor((oggi2 - GIORNO_ZERO) / (1000 * 60 * 60 * 24))
      const soloCasino = isSoloCasino(book.nome)
      const offset = hashBook(book.id, 303) % 60
      const isAzioneDay = (giorniDaZero - offset) % 60 === 0
      if (isAzioneDay && soloCasino) return { tipo: 'manutenzione-b', azioni: ['Sessione slot 5-10€'], badge: '🟡 Mant. B' }
      if (isAzioneDay && !soloCasino) return { tipo: 'manutenzione-b', azioni: ['1 bet sportiva'], badge: '🟡 Mant. B' }
      return null
    }

    if (classeEffettiva === 'C') {
      const oggi2 = new Date()
      const GIORNO_ZERO = new Date('2026-05-18')
      const giorniDaZero = Math.floor((oggi2 - GIORNO_ZERO) / (1000 * 60 * 60 * 24))
      const soloCasino = isSoloCasino(book.nome)
      const offset = hashBook(book.id, 505) % 60
      const isAzioneDay = (giorniDaZero - offset) % 60 === 0
      if (isAzioneDay && soloCasino) return { tipo: 'manutenzione-c', azioni: ['Sessione slot 5-10€'], badge: '🟡 Mant. C' }
      if (isAzioneDay && !soloCasino) return { tipo: 'manutenzione-c', azioni: ['1 bet sportiva'], badge: '🟡 Mant. C' }
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

    // ── FASE 1: dati critici per la dashboard (parallelo) ──────────────────
    const sei_mesi_fa = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString()
    const anno_corrente = new Date().getFullYear() + '-01-01'
    const [
      booksRes, walletsRes, txRes, contRes,
      weeklyRes, monthlyRes, stimeRes,
      memoRoyaltyAccountsRes, memoRoyaltyEntriesRes,
      memoSavingsRowsRes, memoFutureNotesRes, memoFreeBoxesRes,
      dashboardSettingsRes, clientiRes, clientiEmailRes,
      esterniRes,
      postItRes,
    ] = await Promise.all([
      supabase.from('books').select('*').order('id', { ascending: true }),
      supabase.from('wallets').select('*').order('id', { ascending: true }),
      supabase.from('transactions').select('*').order('data', { ascending: false }).gte('data', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()).limit(2000),
      supabase.from('contabilita').select('*').order('data_movimento', { ascending: false }).gte('data_movimento', sei_mesi_fa),
      supabase.from('weekly_snapshots').select('*').order('snapshot_date', { ascending: true }),
      supabase.from('monthly_snapshots').select('*').order('snapshot_month', { ascending: true }),
      supabase.from('stime_cassa').select('*').order('anno', { ascending: true }).order('mese', { ascending: true }).order('ordine', { ascending: true }).order('id', { ascending: true }),
      supabase.from('memo_royalty_accounts').select('*').order('id', { ascending: true }),
      supabase.from('memo_royalty_entries').select('*').order('id', { ascending: true }),
      supabase.from('memo_savings_rows').select('*').order('id', { ascending: true }),
      supabase.from('memo_future_notes').select('*').order('ordine', { ascending: true }).order('id', { ascending: true }),
      supabase.from('memo_free_boxes').select('*').order('id', { ascending: true }),
      supabase.from('dashboard_settings').select('*').eq('id', 1).maybeSingle(),
      supabase.from('clienti').select('*').order('nome', { ascending: true }),
      supabase.from('clienti_email').select('*').order('cliente_id', { ascending: true }),
      supabase.from('transactions').select('importo').eq('azione', 'wallet_to_external').gte('data', anno_corrente),
      supabase.from('post_it_notes').select('*').order('fatto', { ascending: true }).order('created_at', { ascending: false }),
    ])

    // Applica subito i dati critici e togli il loading
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
    if (postItRes && postItRes.error) errors.push('post_it_notes'); else if (postItRes) setPostItNotes(postItRes.data || [])
    if (dashboardSettingsRes.error) {
      errors.push('dashboard_settings')
    } else {
      const ds = dashboardSettingsRes.data || { accantonamento_royalty: 0, risparmi_samu_massi: 0 }
      setDashboardSettings(ds)
      if (ds.soglie_budget) setSoglieBudget(ds.soglie_budget)
    }
    if (clientiRes && !clientiRes.error) setClienti(clientiRes.data || [])
    if (clientiEmailRes && !clientiEmailRes.error) setClientiEmail(clientiEmailRes.data || [])
    if (esterniRes && !esterniRes.error) {
      const sommaEsterni = (esterniRes.data || []).reduce((t, tx) => t + Number(tx.importo || 0), 0)
      setTotaleEsterni(sommaEsterni)
    }
    if (errors.length) setErrorMessage(`Errore caricamento: ${errors.join(', ')}`)

    // ── UI visibile subito ─────────────────────────────────────────────────
    setLoading(false)

    // ── FASE 2: dati leggeri in background (non bloccano la UI) ───────────
    // Nota: Matrice, Punti & Monete e SMS NON vengono più caricati qui:
    // partono solo quando apri la tab corrispondente (vedi loadMatrice/loadPuntiMonete/loadSms più sotto).
    const meseCorrenteISO = new Date().toISOString().slice(0, 7)
    supabase.from('transactions').select('id, note, importo, categoria_spesa, data, azione').eq('azione', 'wallet_to_external').gte('data', meseCorrenteISO + '-01').lt('data', new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString())
      .then(({ data }) => { if (data) setSpeseCategoriaMese(data) })
  }

  async function loadMatrice() {
    if (matriceCaricata) return
    const [m1, m2, m3] = await Promise.all([
      supabase.from('matrice_bookmakers').select('*').order('bookmaker', { ascending: true }).range(0, 999),
      supabase.from('matrice_bookmakers').select('*').order('bookmaker', { ascending: true }).range(1000, 1999),
      supabase.from('matrice_bookmakers').select('*').order('bookmaker', { ascending: true }).range(2000, 2999),
    ])
    setMatrice([...(m1.data || []), ...(m2.data || []), ...(m3.data || [])])
    setMatriceCaricata(true)
  }

  async function loadPuntiMonete() {
    if (puntiMonetaCaricata) return
    setPmLoading(true)
    const { data, error } = await supabase.from('punti_monete').select('*').order('book_nome').order('cliente_nome')
    if (!error && data && data.length > 0) {
      const bookMap = {}
      const saldiMap = {}
      data.forEach(r => {
        if (!bookMap[r.book_nome]) bookMap[r.book_nome] = { id: r.book_nome.toLowerCase(), nome: r.book_nome, valorePunto: Number(r.valore_punto), bookId: r.book_id ? String(r.book_id) : '' }
        saldiMap[`${r.book_nome.toLowerCase()}__${r.cliente_nome}`] = r.punti
      })
      const booksArr = Object.values(bookMap)
      setPuntiMoneteBooks(booksArr)
      setPmBooks(booksArr)
      setPmSaldi(saldiMap)
    }
    setPmLoading(false)
    setPuntiMonetaCaricata(true)
  }

  async function loadSms() {
    if (smsCaricato) return
    const { data, error } = await supabase.from('sms_clienti').select('*').order('data_ricezione', { ascending: false }).limit(500)
    if (!error && data) setSmsClienti(data)
    setSmsCaricato(true)
  }

  useEffect(() => {
    if (activeTab === 'matrice') loadMatrice()
    else if (activeTab === 'punti-monete') loadPuntiMonete()
    else if (activeTab === 'sms') loadSms()
  }, [activeTab])
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
// Dati storici fissi per gen/feb 2026 (non presenti nel DB)
// I valori _prelievi e _cashflow sono fissi; profit è cumulativo nella sequenza
const STORICO_FISSO = [
  { id: 'fisso-gen', snapshot_date: '2026-01-31', total_cash: 51532.70, base_cash_month: 57229.62, profit: 10052.56, _prelievi: 5859.65, _cashflow: 4192.91, _fisso: true },
  { id: 'fisso-feb', snapshot_date: '2026-02-28', total_cash: 57229.62, base_cash_month: 57229.62, profit: 16622.02, _prelievi: 5572.01, _cashflow: 997.45, _fisso: true },
]
// Per marzo: total_cash e profitto corretti fissi; prelievi e cashflow fissi
const MARZO_FIX = { total_cash: 60069.41, _profitto_periodo: 10930.56, _prelievi: 8090.77, _cashflow: 2839.79 }

// Sequenza normalizzata: inietta gen/feb se mancanti, fix marzo
const normalizedSnapshots = useMemo(() => {
  let snaps = [...weeklySnapshots]
  snaps = snaps.map(s => {
    if (s.snapshot_date && s.snapshot_date.startsWith('2026-03')) {
      return { ...s, ...MARZO_FIX }
    }
    return s
  })
  for (const fisso of STORICO_FISSO) {
    const mese = fisso.snapshot_date.slice(0, 7)
    if (!snaps.some(s => s.snapshot_date && s.snapshot_date.startsWith(mese))) {
      snaps.push(fisso)
    }
  }
  snaps.sort((a, b) => (a.snapshot_date || '').localeCompare(b.snapshot_date || ''))
  return snaps
}, [weeklySnapshots])

const weeklyChartData = useMemo(() => {
  return normalizedSnapshots.map((item, idx) => {
    let profitPeriodo
    if (item._fisso) {
      // righe fittizie: delta rispetto alla precedente (profit cumulativo proprio)
      const cur = Number(item.profit || 0)
      const prec = idx > 0 ? Number(normalizedSnapshots[idx - 1].profit || 0) : 0
      profitPeriodo = idx === 0 ? cur : cur - prec
    } else if (item._profitto_periodo !== undefined) {
      // marzo: usa il valore fisso corretto
      profitPeriodo = item._profitto_periodo
    } else {
      // DB normale: delta profit cumulativo, ma salta il "salto" causato dai fissi
      // trova l'ultimo snap non-fisso precedente per il delta corretto
      const cur = Number(item.profit || 0)
      const prec = idx > 0 ? Number(normalizedSnapshots[idx - 1].profit || 0) : 0
      profitPeriodo = idx === 0 ? cur : cur - prec
    }
    return {
      name: new Date(item.snapshot_date).toLocaleDateString('it-IT', {
        day: '2-digit',
        month: '2-digit'
      }),
      profit: profitPeriodo,
      totalCash: Number(item.total_cash || 0)
    }
  })
}, [normalizedSnapshots])

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

// Drag globale per il widget flottante Post-it
useEffect(() => {
  if (!postItDragging) return
  function onMove(e) {
    const x = e.clientX - postItDragOffset.current.x
    const y = e.clientY - postItDragOffset.current.y
    setPostItFloatPos({ x, y })
  }
  function onUp() {
    setPostItDragging(false)
    setPostItFloatPos(pos => {
      try { localStorage.setItem('postItFloatPos', JSON.stringify(pos)) } catch {}
      return pos
    })
  }
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
  return () => {
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
  }
}, [postItDragging])

function startPostItDrag(e) {
  const rect = e.currentTarget.parentElement.getBoundingClientRect()
  postItDragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
  setPostItDragging(true)
}

function togglePostItMinimized() {
  setPostItMinimized(prev => {
    const next = !prev
    try { localStorage.setItem('postItMinimized', next ? '1' : '0') } catch {}
    return next
  })
}

// Popup SMS agli orari fissi: 9, 13, 17, 21
useEffect(() => {
  if (smsClienti.length === 0) return

  const ORI_CONTROLLO = [9, 13, 17, 21]

  const controlla = () => {
    const ora = new Date().getHours()
    if (!ORI_CONTROLLO.includes(ora)) return

    // Chiave univoca per ora+giorno: evita popup multipli nella stessa ora
    const chiaveOra = `smsVistaOra_${new Date().toISOString().slice(0, 13)}`
    if (localStorage.getItem(chiaveOra)) return

    const ultimaVista = localStorage.getItem('smsUltimaVista')
    const ieri = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const ultimaData = ultimaVista ? new Date(Number(ultimaVista)).toISOString() : ieri
    const nuovi = smsClienti.filter(s => s.data_ricezione && s.data_ricezione > ultimaData)

    if (nuovi.length > 0) {
      setSmsNuovi(nuovi)
      setShowSmsPopup(true)
      localStorage.setItem(chiaveOra, '1')
    }
  }

  controlla()
  const interval = setInterval(controlla, 60 * 1000)
  return () => clearInterval(interval)
}, [smsClienti])
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
    const booksLocali = books.map(b => ({ ...b }))
    const nuoveTransazioni = []
    for (const correzione of cmd.correzioni) {
      const book = booksLocali.find(b =>
        (b.nome || '').toLowerCase().includes((cmd.book_nome || '').toLowerCase()) &&
        (b.intestatario || '').toLowerCase().includes((correzione.intestatario || '').toLowerCase())
      )
      if (!book) {
        errori.push(correzione.intestatario)
        continue
      }
      await updateSaldo('books', book.id, correzione.nuovo_saldo)
      const r = await salvaLogTransazione({
        tipo: 'correzione',
        importo: correzione.nuovo_saldo,
        riferimento: `book:${book.id}:${book.nome}:${book.intestatario}`,
        note: `Correzione saldo vocale → ${correzione.nuovo_saldo}`,
        azione: 'manual_balance_adjustment'
      })
      if (r.data) nuoveTransazioni.push(r.data)
      book.saldo = correzione.nuovo_saldo
      risultati.push(`${book.intestatario} → ${correzione.nuovo_saldo}€`)
    }
    if (risultati.length) {
      setBooks(booksLocali)
      if (nuoveTransazioni.length) setTransactions(prev => [...nuoveTransazioni, ...prev])
    }
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
    const walletsLocali = wallets.map(w => ({ ...w }))
    const booksLocali = books.map(b => ({ ...b }))
    const nuoveTransazioni = []
    for (const v of cmd.versamenti) {
      const wallet = walletsLocali.find(w =>
        (w.nome || '').toLowerCase().includes((v.wallet_nome || '').toLowerCase()) &&
        (w.intestatario || '').toLowerCase().includes((v.intestatario || '').toLowerCase())
      )
      const book = booksLocali.find(b =>
        (b.nome || '').toLowerCase().includes((cmd.book_nome || '').toLowerCase()) &&
        (b.intestatario || '').toLowerCase().includes((v.intestatario || '').toLowerCase())
      )
      if (!wallet || !book) { errori.push(v.intestatario); continue }
      if (Number(wallet.saldo) < v.importo) { errori.push(`${v.intestatario} (saldo insufficiente)`); continue }
      await updateSaldo('wallets', wallet.id, Number(wallet.saldo) - v.importo)
      await updateSaldo('books', book.id, Number(book.saldo) + v.importo)
      const r = await salvaLogTransazione({
        tipo: 'versa', importo: v.importo,
        riferimento: `wallet:${wallet.id}:${wallet.nome}:${wallet.intestatario} -> book:${book.id}:${book.nome}:${book.intestatario}`,
        note: `Versamento vocale da ${wallet.nome} a ${book.nome}`,
        azione: 'wallet_to_book'
      })
      if (r.data) nuoveTransazioni.push(r.data)
      wallet.saldo = Number(wallet.saldo) - v.importo
      book.saldo = Number(book.saldo) + v.importo
      risultati.push(`${v.intestatario} ${v.importo}€`)
    }
    if (risultati.length) {
      setWallets(walletsLocali)
      setBooks(booksLocali)
      if (nuoveTransazioni.length) setTransactions(prev => [...nuoveTransazioni, ...prev])
    }
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
    const nuovoSaldoWallet1 = Number(wallet.saldo) - cmd.importo
    const nuovoSaldoBook1 = Number(book.saldo) + cmd.importo
    await updateSaldo('wallets', wallet.id, nuovoSaldoWallet1)
    await updateSaldo('books', book.id, nuovoSaldoBook1)
    const rVersa = await salvaLogTransazione({
      tipo: 'versa', importo: cmd.importo,
      riferimento: `wallet:${wallet.id}:${wallet.nome}:${wallet.intestatario} -> book:${book.id}:${book.nome}:${book.intestatario}`,
      note: cmd.note || `Versamento vocale da ${wallet.nome} a ${book.nome}`,
      azione: 'wallet_to_book'
    })
    applyLocalWalletSaldo(wallet.id, nuovoSaldoWallet1)
    applyLocalBookSaldo(book.id, nuovoSaldoBook1)
    applyLocalNuovaTransazione(rVersa.data)
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
  const nuovoSaldoFrom2 = Number(walletFrom.saldo) - cmd.importo
  const nuovoSaldoTo2 = Number(walletTo.saldo) + cmd.importo
  await updateSaldo('wallets', walletFrom.id, nuovoSaldoFrom2)
  await updateSaldo('wallets', walletTo.id, nuovoSaldoTo2)
  const rTrasf = await salvaLogTransazione({
    tipo: 'trasferisci', importo: cmd.importo,
    riferimento: `wallet:${walletFrom.id}:${walletFrom.nome}:${walletFrom.intestatario} -> wallet:${walletTo.id}:${walletTo.nome}:${walletTo.intestatario}`,
    note: cmd.note || `Trasferimento vocale da ${walletFrom.nome} a ${walletTo.nome}`,
    azione: 'wallet_to_wallet'
  })
  applyLocalWalletSaldo(walletFrom.id, nuovoSaldoFrom2)
  applyLocalWalletSaldo(walletTo.id, nuovoSaldoTo2)
  applyLocalNuovaTransazione(rTrasf.data)
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
    const nuovoSaldoBook2 = Number(book.saldo) - cmd.importo
    const nuovoSaldoWallet2 = Number(wallet.saldo) + cmd.importo
    await updateSaldo('books', book.id, nuovoSaldoBook2)
    await updateSaldo('wallets', wallet.id, nuovoSaldoWallet2)
    const rPrelBook = await salvaLogTransazione({
      tipo: 'preleva', importo: cmd.importo,
      riferimento: `book:${book.id}:${book.nome}:${book.intestatario} -> wallet:${wallet.id}:${wallet.nome}:${wallet.intestatario}`,
      note: cmd.note || `Prelievo vocale da ${book.nome} a ${wallet.nome}`,
      azione: 'book_to_wallet'
    })
    applyLocalBookSaldo(book.id, nuovoSaldoBook2)
    applyLocalWalletSaldo(wallet.id, nuovoSaldoWallet2)
    applyLocalNuovaTransazione(rPrelBook.data)
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
    const nuovoSaldoWallet3 = Number(wallet.saldo) - cmd.importo
    await updateSaldo('wallets', wallet.id, nuovoSaldoWallet3)
    const riferimento = `wallet:${wallet.id}:${wallet.nome}:${wallet.intestatario} -> esterno`
    const rPrelEst = await salvaLogTransazione({
      tipo: 'preleva', importo: cmd.importo, riferimento,
      note: cmd.note || `Prelievo esterno vocale da ${wallet.nome}`,
      azione: 'wallet_to_external'
    })
    const rSpesa = await salvaSpesaGestione({ importo: cmd.importo, riferimento, note: cmd.note || `Prelievo esterno vocale da ${wallet.nome}` })
    applyLocalWalletSaldo(wallet.id, nuovoSaldoWallet3)
    applyLocalNuovaTransazione(rPrelEst.data)
    applyLocalNuovaContabilita(rSpesa.data)
    setTotaleEsterni(prev => prev + cmd.importo) // FIX: allinea subito il totale prelievi esterni (stesso bug del form manuale)
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
    const rCorrBook = await salvaLogTransazione({
      tipo: 'correzione', importo: cmd.nuovo_saldo,
      riferimento: `book:${book.id}:${book.nome}:${book.intestatario}`,
      note: `Correzione saldo vocale → ${cmd.nuovo_saldo}`,
      azione: 'manual_balance_adjustment'
    })
    applyLocalBookSaldo(book.id, cmd.nuovo_saldo)
    applyLocalNuovaTransazione(rCorrBook.data)
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
    applyLocalWalletSaldo(wallet.id, cmd.nuovo_saldo)
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
  const { data, error } = await supabase.from('memo_future_notes').insert([{
    data_reale: memoForm.data_reale || null,
    data_testo: memoForm.data_testo || memoForm.data_reale || '',
    importo: memoForm.importo ? Number(memoForm.importo) : 0,
    descrizione: memoForm.descrizione.trim(),
    colore: memoForm.colore,
    ordine: memoFutureNotes.length + 1
  }]).select().single()
  if (error) { setErrorMessage('Errore salvataggio memo'); return }
  if (data) setMemoFutureNotes(prev => [...prev, data])
  setMemoForm({ data_reale: '', data_testo: '', importo: '', descrizione: '', colore: 'normal' })
}

async function deleteMemoFutureNote(id) {
  if (!confirm('Eliminare questa memo?')) return
  const { error } = await supabase.from('memo_future_notes').delete().eq('id', id)
  if (error) { setErrorMessage('Errore eliminazione memo'); return }
  setMemoFutureNotes(prev => prev.filter(n => n.id !== id))
}
  async function updateMemoFutureNote(id, campo, valore) {
  const { error } = await supabase.from('memo_future_notes').update({ [campo]: valore }).eq('id', id)
  if (error) { setErrorMessage('Errore aggiornamento memo'); return }
  setMemoFutureNotes(prev => prev.map(n => n.id === id ? { ...n, [campo]: valore } : n))
}

async function addPostIt() {
  if (!nuovoPostIt.trim()) return
  const { data, error } = await supabase.from('post_it_notes').insert([{ testo: nuovoPostIt.trim() }]).select().single()
  if (error) { setErrorMessage('Errore salvataggio post-it'); return }
  if (data) setPostItNotes(prev => [data, ...prev])
  setNuovoPostIt('')
}

async function togglePostIt(id, fattoAttuale) {
  const { error } = await supabase.from('post_it_notes').update({ fatto: !fattoAttuale }).eq('id', id)
  if (error) { setErrorMessage('Errore aggiornamento post-it'); return }
  setPostItNotes(prev => prev.map(n => n.id === id ? { ...n, fatto: !fattoAttuale } : n))
}

async function deletePostIt(id) {
  const { error } = await supabase.from('post_it_notes').delete().eq('id', id)
  if (error) { setErrorMessage('Errore eliminazione post-it'); return }
  setPostItNotes(prev => prev.filter(n => n.id !== id))
}

function startEditPostIt(nota) {
  setPostItEditingId(nota.id)
  setPostItEditText(nota.testo)
}

function cancelEditPostIt() {
  setPostItEditingId(null)
  setPostItEditText('')
}

async function saveEditPostIt(id) {
  const testoTrim = postItEditText.trim()
  if (!testoTrim) { cancelEditPostIt(); return }
  const { error } = await supabase.from('post_it_notes').update({ testo: testoTrim }).eq('id', id)
  if (error) { setErrorMessage('Errore modifica post-it'); return }
  setPostItNotes(prev => prev.map(n => n.id === id ? { ...n, testo: testoTrim } : n))
  setPostItEditingId(null)
  setPostItEditText('')
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
    setBookFilters({ nome: '', intestatario: '', saldoMin: '', saldoMax: '', nota: '', soloConNota: false })
  }

  function clearWalletFilters() {
    setWalletFilters({ nome: '', intestatario: '', saldoMin: '', saldoMax: '', nota: '', soloConNota: false })
  }

  function clearTxFilters() {
  setTxFilters({ tipo: '', azione: '', categoria: '', testo: '', importoMin: '', importoMax: '', dataFrom: '', dataTo: '' })
}
  async function updateNote(table, id, newNote) {
    const { error } = await supabase.from(table).update({ note: newNote }).eq('id', id)
    if (error) { setErrorMessage(`Errore aggiornamento note ${table}`); return }
    if (table === 'books') setBooks(prev => prev.map(b => b.id === id ? { ...b, note: newNote } : b))
    else if (table === 'wallets') setWallets(prev => prev.map(w => w.id === id ? { ...w, note: newNote } : w))
  }

  async function updateSaldo(table, id, saldo) {
    return supabase.from(table).update({ saldo }).eq('id', id)
  }

  // ── Aggiornamenti locali dopo scritture su Supabase, senza ricaricare tutto con loadData() ──
  function applyLocalWalletSaldo(id, nuovoSaldo) {
    setWallets(prev => prev.map(w => w.id === id ? { ...w, saldo: nuovoSaldo } : w))
  }
  function applyLocalBookSaldo(id, nuovoSaldo) {
    setBooks(prev => prev.map(b => b.id === id ? { ...b, saldo: nuovoSaldo } : b))
  }
  function applyLocalNuovaTransazione(row) {
    if (row) setTransactions(prev => [row, ...prev])
  }
  function applyLocalRimuoviTransazione(id) {
    setTransactions(prev => prev.filter(t => t.id !== id))
  }
  function applyLocalNuovaContabilita(row) {
    if (row) setContabilita(prev => [row, ...prev])
  }
  function applyLocalRimuoviContabilita(id) {
    setContabilita(prev => prev.filter(c => c.id !== id))
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

  const { data, error } = await supabase
    .from('memo_royalty_entries')
    .insert([{
      account_id: Number(accountId),
      anno: Number(year),
      importo: Number(value),
      mese: '',
      nota: ''
    }])
    .select()
    .single()

  if (error) {
    setErrorMessage('Errore creazione voce royalty')
    return
  }

  if (data) setMemoRoyaltyEntries(prev => [...prev, data])
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

async function toggleAccantonamentoPagato(fieldKey) {
  const oggi = new Date()
  const meseKey = `${oggi.getFullYear()}-${String(oggi.getMonth() + 1).padStart(2, '0')}`
  const giaPagato = dashboardSettings[fieldKey] === meseKey
  const nuovoValore = giaPagato ? null : meseKey
  await supabase.from('dashboard_settings').update({ [fieldKey]: nuovoValore }).eq('id', 1)
  setDashboardSettings(prev => ({ ...prev, [fieldKey]: nuovoValore }))
}

async function togglePaoloAttivo() {
  const nuovoValore = !dashboardSettings.paolo_attivo
  await supabase.from('dashboard_settings').update({ paolo_attivo: nuovoValore }).eq('id', 1)
  setDashboardSettings(prev => ({ ...prev, paolo_attivo: nuovoValore }))
}

async function toggleClienteTerminato(cliente) {
  const nuovoTerminato = !cliente.terminato
  if (nuovoTerminato && !window.confirm(`Segnare "${cliente.nome}" come cliente terminato?`)) return
  await supabase.from('clienti').update({ terminato: nuovoTerminato }).eq('id', cliente.id)
  setClienti(prev => prev.map(c => c.id === cliente.id ? { ...c, terminato: nuovoTerminato } : c))
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
    }]).select().single()
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
    }]).select().single()
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


setBooks(prev => prev.filter(b => b.id !== book.id))
setMessage('Book eliminato correttamente')
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


setWallets(prev => prev.filter(w => w.id !== wallet.id))
setMessage('Wallet eliminato correttamente')
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
    let contMatchIdDaRimuovere = null

    if (tx.azione === 'wallet_to_book') {
      const wallet = findWallet(fromRef)
      const book = findBook(toRef)

      if (!wallet || !book) {
        throw new Error('Wallet o book non trovato per il rollback')
      }
      if (Number(book.saldo || 0) < importo) {
        throw new Error('Saldo book insufficiente per annullare il movimento')
      }

      const nuovoSaldoBook = Number(book.saldo) - importo
      const nuovoSaldoWallet = Number(wallet.saldo) + importo

      await runWithRetry(
        () => updateSaldo('books', book.id, nuovoSaldoBook),
        'Rollback saldo book'
      )

      await runWithRetry(
        () => updateSaldo('wallets', wallet.id, nuovoSaldoWallet),
        'Rollback saldo wallet'
      )

      applyLocalBookSaldo(book.id, nuovoSaldoBook)
      applyLocalWalletSaldo(wallet.id, nuovoSaldoWallet)
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

      const nuovoSaldoWallet = Number(wallet.saldo) - importo
      const nuovoSaldoBook = Number(book.saldo) + importo

      await runWithRetry(
        () => updateSaldo('wallets', wallet.id, nuovoSaldoWallet),
        'Rollback saldo wallet'
      )

      await runWithRetry(
        () => updateSaldo('books', book.id, nuovoSaldoBook),
        'Rollback saldo book'
      )

      applyLocalWalletSaldo(wallet.id, nuovoSaldoWallet)
      applyLocalBookSaldo(book.id, nuovoSaldoBook)
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

      const nuovoSaldoTo = Number(toWallet.saldo) - importo
      const nuovoSaldoFrom = Number(fromWallet.saldo) + importo

      await runWithRetry(
        () => updateSaldo('wallets', toWallet.id, nuovoSaldoTo),
        'Rollback saldo wallet destinazione'
      )

      await runWithRetry(
        () => updateSaldo('wallets', fromWallet.id, nuovoSaldoFrom),
        'Rollback saldo wallet origine'
      )

      applyLocalWalletSaldo(toWallet.id, nuovoSaldoTo)
      applyLocalWalletSaldo(fromWallet.id, nuovoSaldoFrom)
    }

    if (tx.azione === 'wallet_to_external') {
      const wallet = findWallet(fromRef)

      if (!wallet) {
        throw new Error('Wallet non trovato per il rollback')
      }

      const nuovoSaldoWallet = Number(wallet.saldo) + importo

      await runWithRetry(
        () => updateSaldo('wallets', wallet.id, nuovoSaldoWallet),
        'Rollback saldo wallet'
      )

      applyLocalWalletSaldo(wallet.id, nuovoSaldoWallet)

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
        contMatchIdDaRimuovere = contMatch.id
      }
    }

    await runWithRetry(
      () => supabase.from('transactions').delete().eq('id', tx.id),
      'Eliminazione transazione'
    )

    applyLocalRimuoviTransazione(tx.id)
    if (contMatchIdDaRimuovere) applyLocalRimuoviContabilita(contMatchIdDaRimuovere)

    setMessage('Movimento eliminato e saldi ripristinati')
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

if (data && data.length) setBooks(prev => [...prev, ...data])

setShowBookModal(false)
setBookForm({ nome: '', intestatario: '', saldo: '', note: '' })
setMessage('Book salvato correttamente')
  }
async function addRoyaltyAccount() {
  if (!newAccountName.trim()) {
    setErrorMessage('Inserisci un nome account')
    return
  }

  const { data, error } = await supabase
    .from('memo_royalty_accounts')
    .insert([{ nome: newAccountName.trim() }])
    .select()
    .single()

  if (error) {
    setErrorMessage('Errore creazione account')
    return
  }

  if (data) setMemoRoyaltyAccounts(prev => [...prev, data])
  setNewAccountName('')
  setMessage('Account aggiunto')
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

if (data && data.length) setWallets(prev => [...prev, ...data])

setShowWalletModal(false)
setWalletForm({ nome: '', intestatario: '', saldo: '', note: '' })
setMessage('Wallet salvato correttamente')
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

    applyLocalBookSaldo(selectedBook.id, nuovoSaldo)
    applyLocalNuovaTransazione(r.data)

    setShowAdjustSaldoModal(false)
    setSelectedBook(null)
    setMessage('Saldo corretto e transazione registrata')
  }
  async function handleSalvaBookSaldi() {
    const entries = Object.entries(pendingBookSaldi)
    if (entries.length === 0) return
    let errori = []
    const nuoveTransazioni = []
    const saldiAggiornati = {}
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
      if (r.error) { errori.push(`tx:${book.nome}`); continue }
      saldiAggiornati[id] = nuovoSaldo
      if (r.data) nuoveTransazioni.push(r.data)
    }
    if (Object.keys(saldiAggiornati).length) {
      setBooks(prev => prev.map(b => saldiAggiornati[b.id] !== undefined ? { ...b, saldo: saldiAggiornati[b.id] } : b))
    }
    if (nuoveTransazioni.length) setTransactions(prev => [...nuoveTransazioni, ...prev])
    setPendingBookSaldi({})
    if (errori.length > 0) setErrorMessage(`Errori: ${errori.join(', ')}`)
    else setMessage(`✅ ${entries.length} saldo/i aggiornati e transazioni registrate`)
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

  applyLocalWalletSaldo(wallet.id, nuovoSaldo)
  applyLocalNuovaTransazione(r.data)

  setMessage('Saldo wallet corretto e transazione registrata')
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

  applyLocalWalletSaldo(selectedWallet.id, nuovoSaldo)
  applyLocalNuovaTransazione(r.data)

  setShowAdjustWalletSaldoModal(false)
  setSelectedWallet(null)
  setMessage('Saldo wallet corretto e transazione registrata')
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
    let nuovoSaldoWallet, nuovoSaldoBook
    if (quickBookTxForm.tipo === 'versa') {
      if (Number(wallet.saldo || 0) < importo) return setErrorMessage('Saldo wallet insufficiente')
      nuovoSaldoWallet = Number(wallet.saldo) - importo
      nuovoSaldoBook = Number(book.saldo) + importo
      r = await updateSaldo('wallets', wallet.id, nuovoSaldoWallet)
      if (r.error) return setErrorMessage(r.error.message)
      r = await updateSaldo('books', book.id, nuovoSaldoBook)
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
      nuovoSaldoBook = Number(book.saldo) - importo
      nuovoSaldoWallet = Number(wallet.saldo) + importo
      r = await updateSaldo('books', book.id, nuovoSaldoBook)
      if (r.error) return setErrorMessage(r.error.message)
      r = await updateSaldo('wallets', wallet.id, nuovoSaldoWallet)
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

    applyLocalWalletSaldo(wallet.id, nuovoSaldoWallet)
    applyLocalBookSaldo(book.id, nuovoSaldoBook)
    applyLocalNuovaTransazione(r.data)

    setShowQuickBookTxModal(false)
    setSelectedBook(null)
    setMessage('Transazione rapida eseguita correttamente')
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

      const nuovoSaldoWallet = Number(wallet.saldo) - importo
      const nuovoSaldoBook = Number(book.saldo) + importo

      r = await updateSaldo('wallets', wallet.id, nuovoSaldoWallet)
      if (r.error) return setErrorMessage(r.error.message)
      r = await updateSaldo('books', book.id, nuovoSaldoBook)
      if (r.error) return setErrorMessage(r.error.message)
      r = await salvaLogTransazione({
  tipo: 'versa',
  importo,
  riferimento: `wallet:${wallet.id}:${wallet.nome}:${wallet.intestatario} -> book:${book.id}:${book.nome}:${book.intestatario}`,
  note: txForm.note || `Versa da wallet ${wallet.nome} a book ${book.nome}`,
  azione: 'wallet_to_book'
})
      if (r.error) return setErrorMessage(r.error.message)

      applyLocalWalletSaldo(wallet.id, nuovoSaldoWallet)
      applyLocalBookSaldo(book.id, nuovoSaldoBook)
      applyLocalNuovaTransazione(r.data)

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

        const nuovoSaldoBook = Number(book.saldo) - importo
        const nuovoSaldoWallet = Number(wallet.saldo) + importo

        r = await updateSaldo('books', book.id, nuovoSaldoBook)
        if (r.error) return setErrorMessage(r.error.message)
        r = await updateSaldo('wallets', wallet.id, nuovoSaldoWallet)
        if (r.error) return setErrorMessage(r.error.message)
        r = await salvaLogTransazione({
  tipo: 'preleva',
  importo,
  riferimento: `book:${book.id}:${book.nome}:${book.intestatario} -> wallet:${wallet.id}:${wallet.nome}:${wallet.intestatario}`,
  note: txForm.note || `Prelievo da book ${book.nome} a wallet ${wallet.nome}`,
  azione: 'book_to_wallet'
})
        if (r.error) return setErrorMessage(r.error.message)

        applyLocalBookSaldo(book.id, nuovoSaldoBook)
        applyLocalWalletSaldo(wallet.id, nuovoSaldoWallet)
        applyLocalNuovaTransazione(r.data)
      }

      if (txForm.da_tipo === 'wallet') {
        if (!txForm.da_id) return setErrorMessage('Seleziona wallet origine')
        const wallet = wallets.find((w) => String(w.id) === String(txForm.da_id))
        if (!wallet) return setErrorMessage('Wallet non trovato')
        if (Number(wallet.saldo || 0) < importo) return setErrorMessage('Saldo wallet insufficiente')

        const nuovoSaldoWallet = Number(wallet.saldo) - importo

        r = await updateSaldo('wallets', wallet.id, nuovoSaldoWallet)
        if (r.error) return setErrorMessage(r.error.message)
        const riferimento = `wallet:${wallet.id}:${wallet.nome}:${wallet.intestatario} -> esterno`
        r = await salvaLogTransazione({ tipo: 'preleva', importo, riferimento, note: txForm.note || `Prelievo esterno da wallet ${wallet.nome}`, azione: 'wallet_to_external', categoria_spesa: txForm.categoria_spesa || null })
        if (r.error) return setErrorMessage(r.error.message)
        const txRow = r.data
        r = await salvaSpesaGestione({ importo, riferimento, note: txForm.note || `Prelievo esterno da wallet ${wallet.nome}` })
        if (r.error) return setErrorMessage(r.error.message)

        applyLocalWalletSaldo(wallet.id, nuovoSaldoWallet)
        applyLocalNuovaTransazione(txRow)
        applyLocalNuovaContabilita(r.data)
        setTotaleEsterni(prev => prev + importo) // FIX: allinea subito il totale prelievi esterni, altrimenti il profitto scende finché non si ricarica la pagina
      }
    }

    if (txForm.tipo === 'trasferisci') {
      if (!txForm.da_id || !txForm.a_id) return setErrorMessage('Seleziona wallet origine e wallet destinazione')
      if (String(txForm.da_id) === String(txForm.a_id)) return setErrorMessage('Origine e destinazione non possono essere uguali')
      const from = wallets.find((w) => String(w.id) === String(txForm.da_id))
      const to = wallets.find((w) => String(w.id) === String(txForm.a_id))
      if (!from || !to) return setErrorMessage('Wallet non trovato')
      if (Number(from.saldo || 0) < importo) return setErrorMessage('Saldo wallet origine insufficiente')

      const nuovoSaldoFrom = Number(from.saldo) - importo
      const nuovoSaldoTo = Number(to.saldo) + importo

      r = await updateSaldo('wallets', from.id, nuovoSaldoFrom)
      if (r.error) return setErrorMessage(r.error.message)
      r = await updateSaldo('wallets', to.id, nuovoSaldoTo)
      if (r.error) return setErrorMessage(r.error.message)
      r = await salvaLogTransazione({ tipo: 'trasferisci', importo, riferimento: `wallet:${from.id}:${from.nome}:${from.intestatario} -> wallet:${to.id}:${to.nome}:${to.intestatario}`, note: txForm.note || `Trasferimento da wallet ${from.nome} a wallet ${to.nome}`, azione: 'wallet_to_wallet' })
      if (r.error) return setErrorMessage(r.error.message)

      applyLocalWalletSaldo(from.id, nuovoSaldoFrom)
      applyLocalWalletSaldo(to.id, nuovoSaldoTo)
      applyLocalNuovaTransazione(r.data)
    }


    resetTxForm()
    setMessage('Transazione eseguita correttamente')
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

// Guadagno annuo: somma profitti di periodo di tutti gli snapshot dell'anno corrente
const guadagnoAnnuo = useMemo(() => {
  const annoCorrente = new Date().getFullYear()
  const snapsAnno = normalizedSnapshots.filter(s => s.snapshot_date && s.snapshot_date.startsWith(String(annoCorrente)))
  return snapsAnno.reduce((tot, snap, i) => {
    const allIdx = normalizedSnapshots.indexOf(snap)
    if (snap._fisso) {
      const cur = Number(snap.profit || 0)
      const prec = allIdx > 0 ? Number(normalizedSnapshots[allIdx - 1].profit || 0) : 0
      return tot + (allIdx === 0 ? cur : cur - prec)
    }
    if (snap._profitto_periodo !== undefined) return tot + snap._profitto_periodo
    const cur = Number(snap.profit || 0)
    const prec = allIdx > 0 ? Number(normalizedSnapshots[allIdx - 1].profit || 0) : 0
    return tot + (allIdx === 0 ? cur : cur - prec)
  }, 0)
}, [normalizedSnapshots])

// Cash flow annuo: uguale a quello calcolato in periodi
const cashFlowAnnuo = useMemo(() => {
  const annoCorrente = new Date().getFullYear()
  const snapsAnno = normalizedSnapshots.filter(s => s.snapshot_date && s.snapshot_date.startsWith(String(annoCorrente)))
  return snapsAnno.reduce((tot, snap) => {
    if (snap._cashflow !== undefined) return tot + snap._cashflow
    const allIdx = normalizedSnapshots.indexOf(snap)
    const profitCur = Number(snap.profit || 0)
    const profitPrec = allIdx > 0 ? Number(normalizedSnapshots[allIdx - 1].profit || 0) : 0
    const profitPeriodo = allIdx === 0 ? profitCur : profitCur - profitPrec
    const preliCur = Number(snap.external_withdrawals || 0)
    const preliPrec = allIdx > 0 ? Number(normalizedSnapshots[allIdx - 1].external_withdrawals || 0) : 0
    const preliPeriodo = allIdx === 0 ? preliCur : preliCur - preliPrec
    return tot + (profitPeriodo - preliPeriodo)
  }, 0)
}, [normalizedSnapshots])
  
  const filteredBooks = useMemo(() =>
  books
    .filter((book) => {
      const nomeMatch = (book.nome || '').toLowerCase().includes(bookFilters.nome.toLowerCase())
      const intestatarioMatch = (book.intestatario || '').toLowerCase().includes(bookFilters.intestatario.toLowerCase())
      const saldoMinMatch = bookFilters.saldoMin === '' ? true : Number(book.saldo || 0) >= Number(bookFilters.saldoMin)
      const saldoMaxMatch = bookFilters.saldoMax === '' ? true : Number(book.saldo || 0) <= Number(bookFilters.saldoMax)
      const notaMatch = bookFilters.soloConNota ? !!(book.note && book.note.trim() !== '') : (book.note || '').toLowerCase().includes(bookFilters.nota.toLowerCase())
      return nomeMatch && intestatarioMatch && saldoMinMatch && saldoMaxMatch && notaMatch
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
      const notaMatch = walletFilters.soloConNota ? !!(wallet.note && wallet.note.trim() !== '') : (wallet.note || '').toLowerCase().includes(walletFilters.nota.toLowerCase())
      return nomeMatch && intestatarioMatch && saldoMinMatch && saldoMaxMatch && notaMatch
    })
    .sort((a, b) => Number(b.saldo || 0) - Number(a.saldo || 0))
, [wallets, walletFilters])

  const filteredTransactions = useMemo(() => transactions.filter((tx) => {
  const tipoMatch = txFilters.tipo ? tx.tipo === txFilters.tipo : true
  const azioneMatch = txFilters.azione ? (tx.azione || '') === txFilters.azione : true
  const categoriaMatch = txFilters.categoria ? (tx.categoria_spesa || '') === txFilters.categoria : true
  const text = `${tx.riferimento || ''} ${tx.note || ''} ${tx.azione || ''}`.toLowerCase()
  const testoMatch = text.includes(txFilters.testo.toLowerCase())
  const importoMinMatch = txFilters.importoMin === '' ? true : Number(tx.importo || 0) >= Number(txFilters.importoMin)
  const importoMaxMatch = txFilters.importoMax === '' ? true : Number(tx.importo || 0) <= Number(txFilters.importoMax)
  const txDate = tx.data ? new Date(tx.data) : null
  const dataFromMatch = txFilters.dataFrom === '' ? true : txDate && txDate >= new Date(txFilters.dataFrom + 'T00:00:00')
  const dataToMatch = txFilters.dataTo === '' ? true : txDate && txDate <= new Date(txFilters.dataTo + 'T23:59:59')
  return tipoMatch && azioneMatch && categoriaMatch && testoMatch && importoMinMatch && importoMaxMatch && dataFromMatch && dataToMatch
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
async function loadCredenziali() {
  setCredenzialiLoading(true)
  try {
    const res = await fetch('/api/credenziali')
    const data = await res.json()
    setCredenziali(data.credenziali || [])
  } catch (e) {
    console.error(e)
  } finally {
    setCredenzialiLoading(false)
  }
}

async function copiaTesto(testo, chiaveId) {
  try {
    await navigator.clipboard.writeText(testo)
    setTestoCopiatoId(chiaveId)
    setTimeout(() => setTestoCopiatoId(prev => (prev === chiaveId ? null : prev)), 1500)
  } catch (e) {
    alert('Non sono riuscito a copiare: ' + String(e))
  }
}

async function copiaPassword(c) {
  const chiaveId = `pw-${c.id}`
  if (credenzialeRivelata && credenzialeRivelata.id === c.id) {
    copiaTesto(credenzialeRivelata.password, chiaveId)
    return
  }
  setCredenzialeRivelataLoading(c.id)
  try {
    const res = await fetch(`/api/credenziali?reveal=${c.id}`)
    const data = await res.json()
    if (data.credenziale) {
      copiaTesto(data.credenziale.password, chiaveId)
    }
  } catch (e) {
    console.error(e)
  } finally {
    setCredenzialeRivelataLoading(null)
  }
}

async function rivelaCredenziale(id) {
  setCredenzialeRivelataLoading(id)
  try {
    const res = await fetch(`/api/credenziali?reveal=${id}`)
    const data = await res.json()
    if (data.credenziale) {
      setCredenzialeRivelata(data.credenziale)
    }
  } catch (e) {
    console.error(e)
  } finally {
    setCredenzialeRivelataLoading(null)
  }
}

async function salvaCredenziale(e) {
  e.preventDefault()
  try {
    const isEdit = !!editingCredenziale
    const res = await fetch('/api/credenziali', {
      method: isEdit ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(isEdit ? { ...credenzialeForm, id: editingCredenziale } : credenzialeForm)
    })
    const data = await res.json()
    if (data.ok) {
      setShowCredenzialeModal(false)
      setEditingCredenziale(null)
      setCredenzialeForm({ book_id: '', bookmaker_manuale: '', intestatario_manuale: '', username: '', password: '', data_iscrizione: '', risposta_segreta: '', limite_settimanale: '', invio_documenti: false, note: '' })
      setCredenzialeRivelata(null)
      loadCredenziali()
    } else {
      alert('Errore: ' + (data.error || 'sconosciuto'))
    }
  } catch (e) {
    alert('Errore: ' + String(e))
  }
}
async function apriModificaCredenziale(c) {
  setCredenzialeRivelataLoading(c.id)
  try {
    const res = await fetch(`/api/credenziali?reveal=${c.id}`)
    const data = await res.json()
    if (data.credenziale) {
      setEditingCredenziale(c.id)
      setCredenzialeForm({
        book_id: c.book_id ? String(c.book_id) : '',
        bookmaker_manuale: c.book_id ? '' : (c.bookmaker || ''),
        intestatario_manuale: c.book_id ? '' : (c.intestatario || ''),
        username: data.credenziale.username,
        password: data.credenziale.password,
        data_iscrizione: c.data_iscrizione || '',
        risposta_segreta: data.credenziale.risposta_segreta || '',
        limite_settimanale: c.limite_settimanale ?? '',
        invio_documenti: !!c.invio_documenti,
        note: c.note || ''
      })
      setShowCredenzialeModal(true)
    }
  } catch (e) {
    alert('Errore: ' + String(e))
  } finally {
    setCredenzialeRivelataLoading(null)
  }
}
function normalizzaTesto(s) {
  return String(s || '').trim().toLowerCase().replace(/\s+/g, ' ')
}

function parseDataItaliana(s) {
  const v = String(s || '').trim()
  if (!v) return null
  let m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
  m = v.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (m) {
    const a = parseInt(m[1], 10)
    const b = parseInt(m[2], 10)
    const anno = m[3]
    let giorno, mese
    if (a > 12 && b <= 12) { giorno = a; mese = b } // formato italiano gg/mm
    else if (b > 12 && a <= 12) { mese = a; giorno = b } // formato americano mm/gg
    else { giorno = a; mese = b } // ambiguo: default italiano gg/mm
    if (mese < 1 || mese > 12 || giorno < 1 || giorno > 31) return null
    return `${anno}-${String(mese).padStart(2, '0')}-${String(giorno).padStart(2, '0')}`
  }
  return null
}

function parseNumeroItaliano(s) {
  const v = String(s || '').trim().replace(/[€\s]/g, '').replace(',', '.')
  if (!v) return ''
  const n = parseFloat(v)
  return isNaN(n) ? '' : n
}

function parseBooleanoItaliano(s) {
  const v = normalizzaTesto(s)
  return ['si', 'sì', 'yes', 'true', 'x', '1'].includes(v)
}

async function eseguiImportazione() {
  setImportInCorso(true)
  setImportReport(null)
  try {
    const righeTesto = importTesto.split('\n').map(r => r.replace(/\r$/, '')).filter(r => r.trim() !== '')

    const righe = righeTesto
      .filter(riga => normalizzaTesto(riga.split('\t')[0]) !== 'nome') // salta eventuale riga di intestazione
      .map(riga => {
        const cols = riga.split('\t')
        const nome = (cols[0] || '').trim()
        const cognome = (cols[1] || '').trim()
        const dataIscrizione = cols[2] || ''
        const bookmaker = (cols[3] || '').trim()
        const username = (cols[4] || '').trim()
        const password = (cols[5] || '').trim()
        const rispostaSegreta = (cols[6] || '').trim()
        const limiteSettimanale = cols[7] || ''
        const invioDocumenti = cols[8] || ''
        const note = (cols[9] || '').trim()

        const nomeCompleto = `${nome} ${cognome}`.trim()
        const bookTrovato = books.find(b =>
          normalizzaTesto(b.intestatario) === normalizzaTesto(nomeCompleto) &&
          normalizzaTesto(b.nome) === normalizzaTesto(bookmaker)
        )

        return {
          username,
          password,
          data_iscrizione: parseDataItaliana(dataIscrizione),
          risposta_segreta: rispostaSegreta || null,
          limite_settimanale: parseNumeroItaliano(limiteSettimanale) || null,
          invio_documenti: parseBooleanoItaliano(invioDocumenti),
          note: note || null,
          book_id: bookTrovato ? bookTrovato.id : null,
          bookmaker_manuale: bookTrovato ? null : bookmaker,
          intestatario_manuale: bookTrovato ? null : nomeCompleto
        }
      })
      .filter(r => r.username && r.password)

    if (righe.length === 0) {
      alert('Nessuna riga valida trovata (serve almeno username e password per riga)')
      return
    }

    const res = await fetch('/api/credenziali/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ righe })
    })
    const data = await res.json()
    if (data.ok) {
      setImportReport(data)
      loadCredenziali()
    } else {
      alert('Errore: ' + (data.error || 'sconosciuto'))
    }
  } catch (e) {
    alert('Errore: ' + String(e))
  } finally {
    setImportInCorso(false)
  }
}

function credenzialeCorrisponde(c, filtro) {
  if (!filtro) return true
  const testoRiga = [c.intestatario, c.bookmaker, c.username, c.note].filter(Boolean).join(' ').toLowerCase()
  const parole = filtro.toLowerCase().trim().split(/\s+/)
  return parole.every(parola => testoRiga.includes(parola))
}

async function eliminaCredenziale(id) {
  if (!window.confirm('Eliminare questa credenziale?')) return
  try {
    await fetch(`/api/credenziali?id=${id}`, { method: 'DELETE' })
    loadCredenziali()
  } catch (e) {
    alert('Errore: ' + String(e))
  }
}
const currentMonthRef = React.useRef(null)
useEffect(() => {
  if (activeTab === 'contabilita' && currentMonthRef.current) {
    setTimeout(() => {
      currentMonthRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 150)
  }
}, [activeTab])
 useEffect(() => {
  if (activeTab === 'credenziali') {
    loadCredenziali()
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

// Media mensile residua: spese anno / mesi rimanenti (incluso mese corrente)
const mediaMensileResidua = useMemo(() => {
  const mesiRimanenti = 12 - meseCorrenteNum + 1
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
// Accantonamento rinnovo club: importo annuo modificabile da dashboard (default 3.500 €), scadenza 30/9.
// Le 4 rate reali (set-ott-nov-dic 2026) sono già in Contabilità: l'accantonamento sintetico parte da zero
// e non conta fino al 1° ottobre 2026, poi accumula 12 mesi per volta (ott->set) anche se si sovrappone
// alle rate reali dei mesi successivi (voluto, per prudenza).
const CLUB_RINNOVO_ANNUO = Number(dashboardSettings.rinnovo_club_annuo || 3500)
const mediaMensileClub = CLUB_RINNOVO_ANNUO / 12
const CLUB_CICLO_INIZIO = new Date(2026, 9, 1) // 1 ottobre 2026
const oggiClub = new Date()
let meseCicloClub = 0
let accantonamentoClub = 0
if (oggiClub >= CLUB_CICLO_INIZIO) {
  const mesiTrascorsiClub = (oggiClub.getFullYear() - CLUB_CICLO_INIZIO.getFullYear()) * 12 + (oggiClub.getMonth() - CLUB_CICLO_INIZIO.getMonth()) + 1
  meseCicloClub = ((mesiTrascorsiClub - 1) % 12) + 1
  accantonamentoClub = mediaMensileClub * meseCicloClub
}
// Accantonamenti a rate (figlio, Paolo, Michela): stessa logica del club, importi modificabili
// da interfaccia. I pagamenti reali finiscono anche in Contabilità quando li fai: l'accantonamento
// sintetico si sovrappone volutamente a quelle uscite (stessa scelta di prudenza del rinnovo club).
// Si azzerano da soli ogni mese perché seguono il giorno del calendario, non un ciclo custom.
const FIGLIO_G1 = Number(dashboardSettings.figlio_g1 ?? 100)
const FIGLIO_G7 = Number(dashboardSettings.figlio_g7 ?? 100)
const FIGLIO_G13 = Number(dashboardSettings.figlio_g13 ?? 350)
const FIGLIO_G20 = Number(dashboardSettings.figlio_g20 ?? 100)
const FIGLIO_G27 = Number(dashboardSettings.figlio_g27 ?? 100)
const FIGLIO_SCHEDULE = [
  { day: 2, amount: FIGLIO_G1, key: 'figlio_g1_pagato_mese', label: 'giorno 2' },
  { day: 7, amount: FIGLIO_G7, key: 'figlio_g7_pagato_mese', label: 'giorno 7' },
  { day: 13, amount: FIGLIO_G13, key: 'figlio_g13_pagato_mese', label: 'giorno 13' },
  { day: 20, amount: FIGLIO_G20, key: 'figlio_g20_pagato_mese', label: 'giorno 20' },
  { day: 27, amount: FIGLIO_G27, key: 'figlio_g27_pagato_mese', label: 'giorno 27' },
]
const rateFiglio = calcolaRateAccantonamento(FIGLIO_SCHEDULE, dashboardSettings)
const giornoFiglio = rateFiglio.giorno
const accantonamentoFiglio = rateFiglio.maturato
const totaleMensileFiglio = rateFiglio.totale
const rateFiglioDaPagare = rateFiglio.daPagare

// Paolo (collaboratore, bisettimanale): non ancora operativo -> non conta finché non lo attivi.
const PAOLO_ATTIVO = !!dashboardSettings.paolo_attivo
const PAOLO_R15 = Number(dashboardSettings.paolo_r15 ?? 1000)
const PAOLO_R30 = Number(dashboardSettings.paolo_r30 ?? 1000)
const PAOLO_SCHEDULE = [
  { day: 15, amount: PAOLO_R15, key: 'paolo_r15_pagato_mese', label: 'giorno 15' },
  { day: 30, amount: PAOLO_R30, key: 'paolo_r30_pagato_mese', label: 'giorno 30' },
]
const ratePaolo = calcolaRateAccantonamento(PAOLO_SCHEDULE, dashboardSettings)
const accantonamentoPaolo = PAOLO_ATTIVO ? ratePaolo.maturato : 0
const totaleMensilePaolo = ratePaolo.totale
const ratePaoloDaPagare = PAOLO_ATTIVO ? ratePaolo.daPagare : []

// Michela (spese di casa): 1.300€/mese in 4 rate da 325€.
const MICHELA_R1 = Number(dashboardSettings.michela_r1 ?? 325)
const MICHELA_R9 = Number(dashboardSettings.michela_r9 ?? 325)
const MICHELA_R17 = Number(dashboardSettings.michela_r17 ?? 325)
const MICHELA_R24 = Number(dashboardSettings.michela_r24 ?? 325)
const MICHELA_SCHEDULE = [
  { day: 1, amount: MICHELA_R1, key: 'michela_r1_pagato_mese', label: 'giorno 1' },
  { day: 9, amount: MICHELA_R9, key: 'michela_r9_pagato_mese', label: 'giorno 9' },
  { day: 17, amount: MICHELA_R17, key: 'michela_r17_pagato_mese', label: 'giorno 17' },
  { day: 24, amount: MICHELA_R24, key: 'michela_r24_pagato_mese', label: 'giorno 24' },
]
const rateMichela = calcolaRateAccantonamento(MICHELA_SCHEDULE, dashboardSettings)
const accantonamentoMichela = rateMichela.maturato
const totaleMensileMichela = rateMichela.totale
const rateMichelaDaPagare = rateMichela.daPagare

// Antonello: 1.050€ ogni 3 mesi (350€/mese equivalente). Settembre 2026 già pagato/in Contabilità,
// quindi il ciclo sintetico parte da ottobre 2026. Prossime rate reali: dic 2026, mar 2027, giu 2027,
// poi il contratto finisce -> da luglio 2027 in poi l'accantonamento torna a 0 in automatico.
const ANTONELLO_IMPORTO = Number(dashboardSettings.antonello_importo_trimestrale ?? 1050)
const ANTONELLO_INIZIO = new Date(2026, 9, 1)
const ANTONELLO_FINE = new Date(2027, 5, 30)
const oggiAntonello = new Date()
let meseCicloAntonello = 0
let accantonamentoAntonello = 0
let antonelloDaPagare = []
if (oggiAntonello >= ANTONELLO_INIZIO && oggiAntonello <= ANTONELLO_FINE) {
  const mesiTrascorsiAntonello = (oggiAntonello.getFullYear() - ANTONELLO_INIZIO.getFullYear()) * 12 + (oggiAntonello.getMonth() - ANTONELLO_INIZIO.getMonth()) + 1
  meseCicloAntonello = ((mesiTrascorsiAntonello - 1) % 3) + 1
  accantonamentoAntonello = (ANTONELLO_IMPORTO / 3) * meseCicloAntonello
  const meseKeyAntonello = `${oggiAntonello.getFullYear()}-${String(oggiAntonello.getMonth() + 1).padStart(2, '0')}`
  const giornoAntonello = oggiAntonello.getDate()
  if (meseCicloAntonello === 3 && giornoAntonello >= 15 && dashboardSettings.antonello_pagato_trimestre !== meseKeyAntonello) {
    antonelloDaPagare = [{ key: 'antonello_pagato_trimestre', amount: ANTONELLO_IMPORTO, label: 'rata trimestrale' }]
  }
}

const accantonamentiAvvisiCount = rateFiglioDaPagare.length + ratePaoloDaPagare.length + rateMichelaDaPagare.length + antonelloDaPagare.length

// Totale "da pagare questo mese" mostrato in Dashboard e in cima al tab Accantonamenti:
// parte dal totale mensile pieno e scala solo quando segni "Pagato" (non quando passa il giorno).
// Royalty e Club restano invariati: Royalty scala gi\xe0 da s\xe9 col pagato del Memo, Club non ha un pulsante "pagato".
const accantonamentiDaPagareTotale =
  accantonamentoRoyalty +
  accantonamentoClub +
  totaleMenoPagato(FIGLIO_SCHEDULE, dashboardSettings) +
  (PAOLO_ATTIVO ? totaleMenoPagato(PAOLO_SCHEDULE, dashboardSettings) : 0) +
  totaleMenoPagato(MICHELA_SCHEDULE, dashboardSettings) +
  accantonamentoAntonello
const massiRows = memoSavingsRows.filter(r => r.persona === 'massimiliano').sort((a, b) => a.ordine - b.ordine)
const samuRows = memoSavingsRows.filter(r => r.persona === 'samuele').sort((a, b) => a.ordine - b.ordine)
const massiMontante = massiRows.length > 0 ? Number(massiRows[massiRows.length - 1].montante || 0) : 0
const samuMontante = samuRows.length > 0 ? Number(samuRows[samuRows.length - 1].montante || 0) : 0
const risparmiSamuMassi = massiMontante + samuMontante

const cassaDisponibile =
  totaleCassa -
  prelievoDelMese -
  accantonamentiDaPagareTotale -
  risparmiSamuMassi

const targetCassa = Number(dashboardSettings.target_cassa || 0)
const mancaAlTarget = targetCassa > 0 ? targetCassa - cassaDisponibile : 0
const targetRaggiunto = targetCassa > 0 && cassaDisponibile >= targetCassa
  const totaleBooksFiltrati = useMemo(() => filteredBooks.reduce((t, b) => t + Number(b.saldo || 0), 0), [filteredBooks])
  const totaleWalletsFiltrati = useMemo(() => filteredWallets.reduce((t, w) => t + Number(w.saldo || 0), 0), [filteredWallets])
  const ultimeTransazioni = useMemo(() => transactions.slice(0, 8), [transactions])
  const topBooks = useMemo(() => [...books].sort((a, b) => Number(b.saldo || 0) - Number(a.saldo || 0)).slice(0, 5), [books])
  const topWallets = useMemo(() => [...wallets].sort((a, b) => Number(b.saldo || 0) - Number(a.saldo || 0)).slice(0, 5), [wallets])
  const walletsOrdinati = useMemo(() => [...wallets].sort((a, b) => (a.intestatario || '').localeCompare(b.intestatario || '') || (a.nome || '').localeCompare(b.nome || '')), [wallets])

  function renderOrigineSelect() {
    if (txForm.tipo === 'versa') {
      return <select name='da_id' value={txForm.da_id} onChange={handleTransactionChange} style={input}><option value=''>Seleziona wallet origine</option>{walletsOrdinati.map((wallet) => <option key={wallet.id} value={wallet.id}>{getEntityLabel(wallet)}</option>)}</select>
    }
    if (txForm.tipo === 'preleva' && txForm.da_tipo === 'book') {
      return <select name='da_id' value={txForm.da_id} onChange={handleTransactionChange} style={input}><option value=''>Seleziona book origine</option>{books.map((book) => <option key={book.id} value={book.id}>{getEntityLabel(book)}</option>)}</select>
    }
    if (txForm.tipo === 'preleva' && txForm.da_tipo === 'wallet') {
      return <>
        <select name='da_id' value={txForm.da_id} onChange={handleTransactionChange} style={input}><option value=''>Seleziona wallet origine</option>{walletsOrdinati.map((wallet) => <option key={wallet.id} value={wallet.id}>{getEntityLabel(wallet)}</option>)}</select>
        <select name='categoria_spesa' value={txForm.categoria_spesa} onChange={handleTransactionChange} style={{ ...input, borderColor: txForm.categoria_spesa ? 'rgba(56,189,248,0.6)' : 'rgba(51,65,85,0.6)', color: txForm.categoria_spesa ? '#38bdf8' : '#94a3b8' }}>
          <option value=''>📂 Categoria spesa (opzionale)</option>
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
      return <select name='da_id' value={txForm.da_id} onChange={handleTransactionChange} style={input}><option value=''>Seleziona wallet origine</option>{walletsOrdinati.map((wallet) => <option key={wallet.id} value={wallet.id}>{getEntityLabel(wallet)}</option>)}</select>
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
      const walletsCompatibili = bookOrigine ? walletsOrdinati.filter((wallet) => isSameOwner(wallet.intestatario, bookOrigine.intestatario)) : []
      return <select name='a_id' value={txForm.a_id} onChange={handleTransactionChange} style={input}><option value=''>{bookOrigine ? 'Seleziona wallet destinazione' : 'Prima seleziona book origine'}</option>{walletsCompatibili.map((wallet) => <option key={wallet.id} value={wallet.id}>{getEntityLabel(wallet)}</option>)}</select>
    }
    if (txForm.tipo === 'trasferisci') {
      const walletsDisponibili = walletsOrdinati.filter((wallet) => String(wallet.id) !== String(txForm.da_id))
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <a href="/" style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
              borderRadius: 10, border: '1px solid rgba(255,255,255,0.15)',
              background: 'rgba(255,255,255,0.05)', color: '#e8ecf5',
              fontWeight: 700, fontSize: 12, textDecoration: 'none',
            }}>🏠 Home</a>
            <a href="/admin/pronostici-manuale" style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
              borderRadius: 10, border: '1px solid rgba(200,241,53,0.4)',
              background: 'rgba(200,241,53,0.08)', color: '#c8f135',
              fontWeight: 700, fontSize: 12, textDecoration: 'none',
            }}>🎾 Esito manuale pronostici</a>
            <a href="/iscritti" style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
              borderRadius: 10, border: '1px solid rgba(56,139,253,0.4)',
              background: 'rgba(56,139,253,0.08)', color: '#388BFD',
              fontWeight: 700, fontSize: 12, textDecoration: 'none',
            }}>👥 Iscritti</a>
            <div style={copyrightBox}>© Sergio Apicella — Tutti i diritti riservati</div>
          </div>
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
          <button style={activeTab === 'accantonamenti' ? activeTabButton : tabButton} onClick={() => handleTabChange('accantonamenti')}>💰 Accantonamenti</button>
          <button style={activeTab === 'books' ? activeTabButton : tabButton} onClick={() => handleTabChange('books')}>Books</button>
          <button style={activeTab === 'wallets' ? activeTabButton : tabButton} onClick={() => handleTabChange('wallets')}>Wallets</button>
          <button style={activeTab === 'transactions' ? activeTabButton : tabButton} onClick={() => handleTabChange('transactions')}>Transactions</button>
          <button style={activeTab === 'periodi' ? activeTabButton : tabButton} onClick={() => handleTabChange('periodi')}>Periodi</button>
          <button style={activeTab === 'memo' ? activeTabButton : tabButton} onClick={() => handleTabChange('memo')}>Memo</button>
          <button style={activeTab === 'post-it' ? activeTabButton : tabButton} onClick={() => handleTabChange('post-it')}>📌 Post-it</button>
          <button style={activeTab === 'profilazione' ? activeTabButton : tabButton} onClick={() => handleTabChange('profilazione')}>Profilazione</button>
         <button
  style={activeTab === 'clienti' ? activeTabButton : tabButton}
  onClick={() => handleTabChange('clienti')}
>Clienti</button>

  <button style={activeTab === 'matrice' ? activeTabButton : tabButton} onClick={() => handleTabChange('matrice')}>Matrice</button>
          <button style={activeTab === 'punti-monete' ? activeTabButton : tabButton} onClick={() => handleTabChange('punti-monete')}>🏆 Punti &amp; Monete</button>
          <button style={activeTab === 'credenziali' ? activeTabButton : tabButton} onClick={() => handleTabChange('credenziali')}>🔑 Credenziali</button>
          <button style={activeTab === 'sms' ? activeTabButton : tabButton} onClick={() => handleTabChange('sms')}>📱 SMS</button>
          <button style={activeTab === 'team' ? activeTabButton : tabButton} onClick={() => handleTabChange('team')}>👥 Team</button>
          <button style={activeTab === 'prop-hedge' ? activeTabButton : tabButton} onClick={() => handleTabChange('prop-hedge')}>📈 Prop Hedge</button>
          <button style={activeTab === 'masaniello' ? activeTabButton : tabButton} onClick={() => handleTabChange('masaniello')}>🎲 Masaniello</button>
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
          <DashboardTab
            memoFutureNotes={memoFutureNotes}
            stimeCassa={stimeCassa}
            clienti={clienti}
            guadagnoCorrente={guadagnoCorrente}
            basePeriodo={basePeriodo}
            totaleUsciteEsterne={totaleUsciteEsterne}
            guadagnoAnnuo={guadagnoAnnuo}
            cashFlowAnnuo={cashFlowAnnuo}
            accantonamentiTotale={accantonamentiDaPagareTotale}
            accantonamentiAvvisiCount={accantonamentiAvvisiCount}
            goToAccantonamenti={() => handleTabChange('accantonamenti')}
            updateDashboardSetting={updateDashboardSetting}
            parseEuroInput={parseEuroInput}
            meseCorrenteNum={meseCorrenteNum}
            risparmiSamuMassi={risparmiSamuMassi}
            setDashboardSettings={setDashboardSettings}
            totaleCassa={totaleCassa}
            totaleBooks={totaleBooks}
            totaleWallets={totaleWallets}
            prelievoDelMese={prelievoDelMese}
            currentMonthLabel={currentMonthLabel}
            totaleSpeseProgrammateAnno={totaleSpeseProgrammateAnno}
            mediaMensileResidua={mediaMensileResidua}
            cassaDisponibile={cassaDisponibile}
            weeklyChartData={weeklyChartData}
            weeklyProfitColor={weeklyProfitColor}
            topBooks={topBooks}
            topWallets={topWallets}
            ultimeTransazioni={ultimeTransazioni}
            formatDate={formatDate}
            formatCurrency={formatCurrency}
            saveWeeklySnapshot={saveWeeklySnapshot}
          />
        )}
        {activeTab === 'accantonamenti' && (
          <AccantonamentiTab
            formatCurrency={formatCurrency}
            updateDashboardSetting={updateDashboardSetting}
            toggleAccantonamentoPagato={toggleAccantonamentoPagato}
            togglePaoloAttivo={togglePaoloAttivo}
            meseCorrenteNum={meseCorrenteNum}
            accantonamentoRoyalty={accantonamentoRoyalty}
            mediaMensileRoyalty={mediaMensileRoyalty}
            royaltyTotale2026={royaltyTotale2026}
            royaltyPagato2026={royaltyPagato2026}
            accantonamentoClub={accantonamentoClub}
            mediaMensileClub={mediaMensileClub}
            meseCicloClub={meseCicloClub}
            rinnovoClubAnnuo={CLUB_RINNOVO_ANNUO}
            accantonamentoFiglio={accantonamentoFiglio}
            totaleMensileFiglio={totaleMensileFiglio}
            giornoFiglio={giornoFiglio}
            figlioG1={FIGLIO_G1}
            figlioG7={FIGLIO_G7}
            figlioG13={FIGLIO_G13}
            figlioG20={FIGLIO_G20}
            figlioG27={FIGLIO_G27}
            rateFiglioDaPagare={rateFiglioDaPagare}
            paoloAttivo={PAOLO_ATTIVO}
            accantonamentoPaolo={accantonamentoPaolo}
            totaleMensilePaolo={totaleMensilePaolo}
            paoloR15={PAOLO_R15}
            paoloR30={PAOLO_R30}
            ratePaoloDaPagare={ratePaoloDaPagare}
            accantonamentoMichela={accantonamentoMichela}
            totaleMensileMichela={totaleMensileMichela}
            michelaR1={MICHELA_R1}
            michelaR9={MICHELA_R9}
            michelaR17={MICHELA_R17}
            michelaR24={MICHELA_R24}
            rateMichelaDaPagare={rateMichelaDaPagare}
            accantonamentoAntonello={accantonamentoAntonello}
            meseCicloAntonello={meseCicloAntonello}
            antonelloImporto={ANTONELLO_IMPORTO}
            antonelloDaPagare={antonelloDaPagare}
            accantonamentiTotale={accantonamentiDaPagareTotale}
          />
        )}
        {activeTab === 'prop-hedge' && <PropHedgeTab />}
        {activeTab === 'masaniello' && <Masaniello />}
        {activeTab === 'periodi' && (() => {
          const annoCorrente = new Date().getFullYear()
          const cashFlowAnno = cashFlowAnnuo
          return (
          <div style={tabContent}>
            <div style={sectionTopBar}>
              <div>
                <h2 style={sectionTitle}>Periodi</h2>
                <p style={sectionDescription}>Storico degli snapshot salvati con Salva Periodo</p>
              </div>
            </div>

            {/* Box cash flow annuale */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 16 }}>
              <div style={{ ...statCard, borderColor: cashFlowAnno >= 0 ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)' }}>
                <div style={statLabel}>Cash Flow {annoCorrente}</div>
                <div style={{ ...statValue, color: cashFlowAnno >= 0 ? '#4ade80' : '#f87171', fontSize: 32 }}>{formatCurrency(cashFlowAnno)}</div>
                <div style={statSub}>Variazione netta cassa anno in corso</div>
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
                      <th style={th}>Prelievi (periodo)</th>
                      <th style={th}>Profitto</th>
                      <th style={th}>Cash Flow</th>
                    </tr>
                  </thead>
                  <tbody>
                    {normalizedSnapshots.map((snap, idx) => {
                      // Se la riga ha valori fissi (_fisso o _profitto_periodo), li usa direttamente
                      // Altrimenti calcola i delta dal DB (aprile in poi)
                      const profitPeriodo = snap._fisso
                        ? (() => {
                            const cur = Number(snap.profit || 0)
                            const prec = idx > 0 ? Number(normalizedSnapshots[idx - 1].profit || 0) : 0
                            return idx === 0 ? cur : cur - prec
                          })()
                        : snap._profitto_periodo !== undefined
                          ? snap._profitto_periodo
                          : (() => {
                              const cur = Number(snap.profit || 0)
                              const prec = idx > 0 ? Number(normalizedSnapshots[idx - 1].profit || 0) : 0
                              return idx === 0 ? cur : cur - prec
                            })()

                      const preliPeriodo = snap._prelievi !== undefined
                        ? snap._prelievi
                        : (() => {
                            const cur = Number(snap.external_withdrawals || 0)
                            const prec = idx > 0 ? Number(normalizedSnapshots[idx - 1].external_withdrawals || 0) : 0
                            return idx === 0 ? cur : cur - prec
                          })()

                      const cashFlow = snap._cashflow !== undefined
                        ? snap._cashflow
                        : profitPeriodo - preliPeriodo

                      return (
                      <tr key={snap.id} style={tr}>
                        <td style={td}>{snap._fisso ? '-' : snap.id}</td>
                        <td style={td}>{snap.snapshot_date || '-'}</td>
                        <td style={td}>{snap._fisso ? '-' : formatDate(snap.created_at)}</td>
                        <td style={td}>{formatCurrency(snap.total_cash)}</td>
                        <td style={td}>{formatCurrency(preliPeriodo)}</td>
                        <td style={tdStrong}>{formatCurrency(profitPeriodo)}</td>
                        <td style={{ ...tdStrong, color: cashFlow >= 0 ? '#4ade80' : '#f87171' }}>{formatCurrency(cashFlow)}</td>
                      </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          )
        })()}
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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>

        {/* AGENDA rimpicciolita */}
        <div style={{ background: 'rgba(29,78,216,0.10)', border: '1px solid rgba(29,78,216,0.30)', borderRadius: 16, padding: '14px 16px' }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#93c5fd', marginBottom: 10 }}>📋 {giornoLabel} — {agendaOggi.length} account da movimentare oggi <span style={{ fontSize: 11, fontWeight: 400, color: '#64748b' }}>({agendaOggi.filter(x => x.agenda.tipo === 'attivo').length} attivi · {agendaOggi.filter(x => x.agenda.tipo !== 'attivo').length} mantenimento)</span></div>
          {agendaOggi.length === 0 ? (
            <div style={{ color: '#64748b', fontSize: 13 }}>Nessuna azione per oggi</div>
          ) : (() => {
            const gruppi = {}
            agendaOggi.forEach(({ book, agenda }) => {
              agenda.azioni.forEach(az => {
                if (!gruppi[az]) gruppi[az] = []
                gruppi[az].push({ book, badge: agenda.badge })
              })
            })
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {Object.entries(gruppi).map(([azione, items]) => {
                  const perBook = {}
                  items.forEach(({ book }) => {
                    if (!perBook[book.nome]) perBook[book.nome] = []
                    perBook[book.nome].push(book.intestatario)
                  })
                  const isOpen = agendaAperto === azione
                  return (
                    <div key={azione} style={{ background: 'rgba(11,18,32,0.7)', borderRadius: 10, border: `1px solid ${isOpen ? 'rgba(56,189,248,0.4)' : 'rgba(51,65,85,0.6)'}`, overflow: 'hidden' }}>
                      <div onClick={() => setAgendaAperto(agendaAperto === azione ? null : azione)}
                        style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
                        <span style={{ color: '#38bdf8', fontSize: 11, display: 'inline-block', transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
                        <span style={{ fontWeight: 700, color: '#f8fafc', fontSize: 12 }}>{azione}</span>
                        <span style={{ marginLeft: 'auto', fontSize: 11, background: 'rgba(56,189,248,0.12)', color: '#38bdf8', padding: '2px 7px', borderRadius: 6, fontWeight: 700 }}>{items.length}</span>
                      </div>
                      {isOpen && (
                        <div style={{ padding: '3px 12px 10px', borderTop: '1px solid rgba(51,65,85,0.4)', display: 'flex', flexDirection: 'column', gap: 2 }}>
                          {Object.entries(perBook).map(([bookNome, intestatari]) => (
                            <div key={bookNome} style={{ fontSize: 11, color: '#cbd5e1', padding: '2px 0' }}>
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

        {/* PROTOCOLLI DI MANTENIMENTO */}
        <div style={{ background: 'rgba(11,18,32,0.7)', border: '1px solid rgba(51,65,85,0.85)', borderRadius: 16, padding: '14px 16px' }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#f8fafc', marginBottom: 10 }}>📖 Protocolli di mantenimento</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

            <div style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: 10, padding: '10px 12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                <span style={{ fontSize: 11, fontWeight: 800, background: 'rgba(251,191,36,0.18)', color: '#fbbf24', padding: '2px 8px', borderRadius: 6 }}>Serie A</span>
                <span style={{ fontSize: 11, color: '#64748b' }}>bet365 · snai · sisal · lottomatica · goldbet · planetwin · eurobet · pokerstars</span>
              </div>
              <div style={{ fontSize: 12, color: '#e2e8f0', lineHeight: 1.5 }}>1 bet sportiva ogni 2 mesi (solo-casinò: 1 sessione slot 5-10€ ogni 2 mesi)</div>
            </div>

            <div style={{ background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.22)', borderRadius: 10, padding: '10px 12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                <span style={{ fontSize: 11, fontWeight: 800, background: 'rgba(56,189,248,0.15)', color: '#38bdf8', padding: '2px 8px', borderRadius: 6 }}>Serie B</span>
                <span style={{ fontSize: 11, color: '#64748b' }}>netbet · bwin · betsson · william hill · stanleybet · e-play24 · betfair</span>
              </div>
              <div style={{ fontSize: 12, color: '#e2e8f0', lineHeight: 1.5 }}>1 bet sportiva ogni 2 mesi (solo-casinò: 1 sessione slot 5-10€ ogni 2 mesi)</div>
            </div>

            <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.22)', borderRadius: 10, padding: '10px 12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                <span style={{ fontSize: 11, fontWeight: 800, background: 'rgba(34,197,94,0.15)', color: '#22c55e', padding: '2px 8px', borderRadius: 6 }}>B Casino</span>
                <span style={{ fontSize: 11, color: '#64748b' }}>gioco digitale · starcasino · betflag · tombola · zonagioco</span>
              </div>
              <div style={{ fontSize: 12, color: '#e2e8f0', lineHeight: 1.5 }}>1 sessione slot 5-10€ ogni 2 mesi (no bet sportiva)</div>
            </div>

            <div style={{ background: 'rgba(100,116,139,0.08)', border: '1px solid rgba(100,116,139,0.22)', borderRadius: 10, padding: '10px 12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                <span style={{ fontSize: 11, fontWeight: 800, background: 'rgba(100,116,139,0.18)', color: '#94a3b8', padding: '2px 8px', borderRadius: 6 }}>Serie C</span>
                <span style={{ fontSize: 11, color: '#64748b' }}>tutti gli altri bookmaker</span>
              </div>
              <div style={{ fontSize: 12, color: '#e2e8f0', lineHeight: 1.5 }}>1 bet 5-10€ ogni 2 mesi (solo-casinò: 1 sessione slot 5-10€ ogni 2 mesi)</div>
            </div>

          </div>
        </div>

      </div>

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
              const protoNuovo = book.profilo_livello === 'attivo' ? getRiassuntoProtocolloAttivo(book.nome) : null
              const proto = protoNuovo || getProtocollo(book.nome)
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
      </div>
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
      {clienti.length === 0 && <p style={{ color: '#94a3b8' }}>Nessun cliente ancora. Clicca "+ Nuovo Cliente" per iniziare.</p>}
      {[...clienti].sort((a, b) => {
        if (!!a.terminato !== !!b.terminato) return a.terminato ? 1 : -1
        const ga = a.sim_giorno_scadenza ? Number(a.sim_giorno_scadenza) : 9999
        const gb = b.sim_giorno_scadenza ? Number(b.sim_giorno_scadenza) : 9999
        return ga - gb
      }).map(c => {
        const oggi = new Date()
        const meseKey = `${oggi.getFullYear()}-${String(oggi.getMonth() + 1).padStart(2, '0')}`
        const rinnovato = c.sim_rinnovato && c.sim_rinnovato_mese === meseKey
        const terminato = !!c.terminato
        return (
          <div key={c.id} style={{
            background: terminato ? 'rgba(11,18,32,0.5)' : 'rgba(11,18,32,0.85)',
            border: terminato ? '1px solid rgba(239,68,68,0.35)' : '1px solid rgba(51,65,85,0.8)',
            borderLeft: terminato ? '4px solid #ef4444' : '1px solid rgba(51,65,85,0.8)',
            borderRadius: 14, padding: '14px 18px',
            opacity: terminato ? 0.6 : 1,
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 900, fontSize: 15, color: terminato ? '#94a3b8' : '#f8fafc' }}>{c.nome}</span>
                  {terminato && (
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: '#ef4444', color: '#fff', fontWeight: 800, letterSpacing: 0.3 }}>
                      ❌ TERMINATO
                    </span>
                  )}
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
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                {terminato ? (
                  <button
                    onClick={() => toggleClienteTerminato(c)}
                    style={{ padding: '6px 12px', borderRadius: 10, border: '1px solid rgba(34,197,94,0.5)', background: 'rgba(34,197,94,0.1)', color: '#22c55e', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
                  >♻️ Riattiva cliente</button>
                ) : (
                  <>
                    {c.sim_operatore && (
                      <button
                        onClick={() => toggleSimRinnovato(c)}
                        style={{ padding: '6px 12px', borderRadius: 10, border: `1px solid ${rinnovato ? 'rgba(34,197,94,0.5)' : 'rgba(251,191,36,0.4)'}`, background: rinnovato ? 'rgba(34,197,94,0.1)' : 'rgba(251,191,36,0.08)', color: rinnovato ? '#22c55e' : '#fbbf24', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
                      >{rinnovato ? '✅ Rinnovato' : '🔄 Segna rinnovato'}</button>
                    )}
                    <button onClick={() => { setEditingCliente(c); setClienteForm({ nome: c.nome, email: c.email || '', telefono: c.telefono || '', sim_operatore: c.sim_operatore || '', sim_importo: c.sim_importo || '', sim_giorno_scadenza: c.sim_giorno_scadenza || '', note: c.note || '' }); setShowClienteModal(true) }} style={{ padding: '6px 12px', borderRadius: 10, border: '1px solid rgba(56,189,248,0.4)', background: 'rgba(56,189,248,0.08)', color: '#38bdf8', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>✏️ Modifica</button>
                    <button onClick={async () => { setDocCliente(c); setDocFiles([]); setDocLoading(true); setDocUploading(false); const r = await fetch(`/api/documenti?cliente=${encodeURIComponent(c.nome)}`); const d = await r.json(); setDocFiles(d.files || []); setDocLoading(false) }} style={{ padding: '6px 12px', borderRadius: 10, border: '1px solid rgba(251,191,36,0.4)', background: 'rgba(251,191,36,0.08)', color: '#fbbf24', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>📁 Documenti</button>
                    <button onClick={() => toggleClienteTerminato(c)} style={{ padding: '6px 12px', borderRadius: 10, border: '1px solid rgba(239,68,68,0.4)', background: 'transparent', color: '#f87171', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>🚫 Termina</button>
                    <button onClick={() => deleteCliente(c.id)} style={{ padding: '6px 12px', borderRadius: 10, border: '1px solid rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.08)', color: '#f87171', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>🗑️</button>
                  </>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  </div>
)}

  {activeTab === 'credenziali' && (
  <div style={tabContent}>
    <div style={sectionTopBar}>
      <div>
        <h2 style={sectionTitle}>🔑 Credenziali</h2>
        <p style={sectionDescription}>Password e dati di accesso agli account, cifrati nel database</p>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button style={tinyBlueButton} onClick={() => { setImportTesto(''); setImportReport(null); setShowImportModal(true) }}>📋 Importa da Excel</button>
        <button style={primaryButtonGreen} onClick={() => { setEditingCredenziale(null); setCredenzialeForm({ book_id: '', bookmaker_manuale: '', intestatario_manuale: '', username: '', password: '', data_iscrizione: '', risposta_segreta: '', limite_settimanale: '', invio_documenti: false, note: '' }); setShowCredenzialeModal(true) }}>+ Nuova Credenziale</button>
      </div>
    </div>

    <div style={{ position: 'relative', maxWidth: 480 }}>
      <span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', fontSize: 15, color: '#64748b', pointerEvents: 'none' }}>🔍</span>
      <input
        value={credenzialiFiltro}
        onChange={(e) => setCredenzialiFiltro(e.target.value)}
        placeholder='Cerca per bookmaker, intestatario, username o note...'
        style={{
          width: '100%',
          boxSizing: 'border-box',
          background: '#0b1220',
          color: '#f8fafc',
          border: credenzialiFiltro ? '1px solid rgba(56,189,248,0.6)' : '1px solid rgba(51,65,85,0.95)',
          borderRadius: 14,
          padding: '12px 40px 12px 42px',
          fontSize: 14,
          outline: 'none',
          transition: 'border-color 0.15s ease'
        }}
      />
      {credenzialiFiltro && (
        <button
          onClick={() => setCredenzialiFiltro('')}
          style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'rgba(51,65,85,0.6)', border: 'none', color: '#cbd5e1', borderRadius: '50%', width: 22, height: 22, cursor: 'pointer', fontSize: 12, lineHeight: '22px', padding: 0 }}
        >✕</button>
      )}
    </div>

    {!credenzialiLoading && credenzialiFiltro && (
      <p style={{ color: '#64748b', fontSize: 12, margin: '-6px 0 0' }}>
        {credenziali.filter(c => credenzialeCorrisponde(c, credenzialiFiltro)).length} risultati trovati
      </p>
    )}

    {credenzialiLoading ? (
      <p style={{ color: '#94a3b8' }}>Caricamento...</p>
    ) : (
      <div style={{ overflowX: 'auto' }}>
        <table style={table}>
          <thead>
            <tr>
              <th style={th}>Intestatario</th>
              <th style={th}>Data iscrizione</th>
              <th style={th}>Bookmaker</th>
              <th style={th}>Username</th>
              <th style={th}>Password</th>
              <th style={th}>Risposta segreta</th>
              <th style={th}>Limite sett.</th>
              <th style={th}>Invio doc.</th>
              <th style={th}>Note</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {credenziali
              .filter(c => credenzialeCorrisponde(c, credenzialiFiltro))
              .map(c => (
                <tr key={c.id} style={tr}>
                  <td style={tdStrong}>{c.intestatario || '-'}{c.manuale && <span style={{ marginLeft: 6, fontSize: 10, color: '#fbbf24', fontWeight: 700 }}>✏️ manuale</span>}</td>
                  <td style={td}>{c.data_iscrizione || '-'}</td>
                  <td style={td}>{c.bookmaker || '-'}</td>
                  <td style={td}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>{c.username}</span>
                      <button
                        onClick={() => copiaTesto(c.username, `user-${c.id}`)}
                        title='Copia username'
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 13, padding: 2, color: testoCopiatoId === `user-${c.id}` ? '#4ade80' : '#64748b' }}
                      >{testoCopiatoId === `user-${c.id}` ? '✅' : '📋'}</button>
                    </div>
                  </td>
                  <td style={td}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {credenzialeRivelata && credenzialeRivelata.id === c.id
                        ? <span style={{ color: '#4ade80', fontFamily: 'monospace' }}>{credenzialeRivelata.password}</span>
                        : <button style={tinyBlueButton} onClick={() => rivelaCredenziale(c.id)} disabled={credenzialeRivelataLoading === c.id}>{credenzialeRivelataLoading === c.id ? '...' : '👁️ Mostra'}</button>}
                      <button
                        onClick={() => copiaPassword(c)}
                        disabled={credenzialeRivelataLoading === c.id}
                        title='Copia password'
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 13, padding: 2, color: testoCopiatoId === `pw-${c.id}` ? '#4ade80' : '#64748b' }}
                      >{testoCopiatoId === `pw-${c.id}` ? '✅' : '📋'}</button>
                    </div>
                  </td>
                  <td style={td}>
                    {credenzialeRivelata && credenzialeRivelata.id === c.id
                      ? (credenzialeRivelata.risposta_segreta || '-')
                      : '••••'}
                  </td>
                  <td style={td}>{c.limite_settimanale != null ? `${c.limite_settimanale} €` : '-'}</td>
                  <td style={td}>{c.invio_documenti ? '✅' : '❌'}</td>
                  <td style={tdNote}>{c.note || '-'}</td>
                  <td style={tdActions}>
                    <button style={tinyOrangeButton} onClick={() => apriModificaCredenziale(c)}>Modifica</button>
                    <button style={tinyRedButton} onClick={() => eliminaCredenziale(c.id)}>Elimina</button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    )}
  </div>
)}

{showCredenzialeModal && (
  <div style={modalOverlay} onClick={() => setShowCredenzialeModal(false)}>
    <div style={modalCard} onClick={(e) => e.stopPropagation()}>
      <div style={modalHeader}>
        <div>
          <h3 style={modalTitle}>{editingCredenziale ? 'Modifica Credenziale' : 'Nuova Credenziale'}</h3>
          <p style={modalSubtitle}>Dati di accesso account (verranno cifrati)</p>
        </div>
        <button style={modalClose} onClick={() => setShowCredenzialeModal(false)}>✕</button>
      </div>
      <form onSubmit={salvaCredenziale}>
        <select
          value={credenzialeForm.book_id}
          onChange={(e) => setCredenzialeForm({ ...credenzialeForm, book_id: e.target.value })}
          style={input}
        >
          <option value=''>— Nessun book collegato (inserisci a mano sotto) —</option>
          {books.map(b => <option key={b.id} value={b.id}>{b.nome} — {b.intestatario}</option>)}
        </select>
        {!credenzialeForm.book_id && (
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={credenzialeForm.bookmaker_manuale} onChange={(e) => setCredenzialeForm({ ...credenzialeForm, bookmaker_manuale: e.target.value })} placeholder='Bookmaker (a mano) *' style={{ ...input, flex: 1 }} required={!credenzialeForm.book_id} />
            <input value={credenzialeForm.intestatario_manuale} onChange={(e) => setCredenzialeForm({ ...credenzialeForm, intestatario_manuale: e.target.value })} placeholder='Intestatario (a mano) *' style={{ ...input, flex: 1 }} required={!credenzialeForm.book_id} />
          </div>
        )}
        <input value={credenzialeForm.username} onChange={(e) => setCredenzialeForm({ ...credenzialeForm, username: e.target.value })} placeholder='Username *' style={input} required />
        <input type='text' value={credenzialeForm.password} onChange={(e) => setCredenzialeForm({ ...credenzialeForm, password: e.target.value })} placeholder='Password *' style={input} required />
        <input type='date' value={credenzialeForm.data_iscrizione} onChange={(e) => setCredenzialeForm({ ...credenzialeForm, data_iscrizione: e.target.value })} style={input} />
        <input value={credenzialeForm.risposta_segreta} onChange={(e) => setCredenzialeForm({ ...credenzialeForm, risposta_segreta: e.target.value })} placeholder='Risposta segreta' style={input} />
        <input type='number' value={credenzialeForm.limite_settimanale} onChange={(e) => setCredenzialeForm({ ...credenzialeForm, limite_settimanale: e.target.value })} placeholder='Limite settimanale €' style={input} />
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#e2e8f0', margin: '8px 0' }}>
          <input type='checkbox' checked={credenzialeForm.invio_documenti} onChange={(e) => setCredenzialeForm({ ...credenzialeForm, invio_documenti: e.target.checked })} />
          Invio documenti effettuato
        </label>
        <textarea value={credenzialeForm.note} onChange={(e) => setCredenzialeForm({ ...credenzialeForm, note: e.target.value })} placeholder='Note' style={textarea} />
        <div style={modalActions}>
          <button type='button' style={secondaryButton} onClick={() => setShowCredenzialeModal(false)}>Annulla</button>
          <button type='submit' style={primaryButtonGreen}>{editingCredenziale ? 'Salva Modifiche' : 'Salva Credenziale'}</button>
        </div>
      </form>
    </div>
  </div>
)}

{showImportModal && (
  <div style={modalOverlay} onClick={() => { if (!importInCorso) setShowImportModal(false) }}>
    <div style={{ ...modalCard, width: 640, maxWidth: '92vw' }} onClick={(e) => e.stopPropagation()}>
      <div style={modalHeader}>
        <div>
          <h3 style={modalTitle}>📋 Importa da Excel</h3>
          <p style={modalSubtitle}>Incolla le righe copiate da Excel (colonne: Nome, Cognome, Data iscrizione, Bookmaker, Username, Password, Risposta segreta, Limite settimanale, Invio documenti, Note)</p>
        </div>
        <button style={modalClose} onClick={() => { if (!importInCorso) setShowImportModal(false) }}>✕</button>
      </div>

      <textarea
        value={importTesto}
        onChange={(e) => setImportTesto(e.target.value)}
        placeholder='Seleziona le celle in Excel (da Nome a Note), copia con Ctrl+C, e incolla qui con Ctrl+V...'
        style={{ ...textarea, minHeight: 220, fontFamily: 'monospace', fontSize: 12 }}
        disabled={importInCorso}
      />

      <p style={{ color: '#94a3b8', fontSize: 12, margin: '4px 0 12px' }}>
        Il sistema abbina automaticamente Nome+Cognome e Bookmaker ai book già presenti nel Profit Tracker. Se non trova una corrispondenza esatta, salva comunque la credenziale con bookmaker/intestatario scritti a mano (etichetta "✏️ manuale" nella tabella).
      </p>

      {importReport && (
        <div style={{ background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.3)', borderRadius: 12, padding: 14, marginBottom: 12 }}>
          <p style={{ margin: 0, color: '#4ade80', fontWeight: 800 }}>✅ {importReport.importate} / {importReport.totali} credenziali importate</p>
          {importReport.saltate > 0 && (
            <p style={{ margin: '4px 0 0', color: '#94a3b8', fontSize: 12 }}>ℹ️ {importReport.saltate} già presenti, saltate automaticamente (nessun doppione creato)</p>
          )}
          {importReport.errori && importReport.errori.length > 0 && (
            <div style={{ marginTop: 8, maxHeight: 160, overflowY: 'auto' }}>
              <p style={{ margin: '0 0 4px', color: '#f87171', fontWeight: 700, fontSize: 12 }}>⚠️ {importReport.errori.length} righe con errore:</p>
              {importReport.errori.slice(0, 50).map((e, i) => (
                <div key={i} style={{ fontSize: 11, color: '#fca5a5', fontFamily: 'monospace', marginBottom: 2 }}>
                  Riga {e.indice + 1} ({e.riga?.username || '?'}): {e.errore}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={modalActions}>
        <button type='button' style={secondaryButton} onClick={() => { if (!importInCorso) setShowImportModal(false) }}>Chiudi</button>
        <button type='button' style={primaryButtonGreen} onClick={eseguiImportazione} disabled={importInCorso || !importTesto.trim()}>
          {importInCorso ? '⏳ Importazione in corso...' : '📤 Importa'}
        </button>
      </div>
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

    {!matriceCaricata && (
      <p style={{ color: '#94a3b8', marginBottom: 12 }}>⏳ Caricamento matrice in corso...</p>
    )}

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
                <input value={bookFilters.nota} onChange={(e) => setBookFilters({ ...bookFilters, nota: e.target.value })} placeholder='Filtra per nota...' disabled={bookFilters.soloConNota} style={{ ...filterInput, opacity: bookFilters.soloConNota ? 0.5 : 1 }} />
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#94a3b8', fontSize: 13, whiteSpace: 'nowrap' }}>
                  <input type='checkbox' checked={bookFilters.soloConNota} onChange={(e) => setBookFilters({ ...bookFilters, soloConNota: e.target.checked })} />
                  Solo con nota
                </label>
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
  const clienteTerminato = clienti.find(c => {
    if (!c.terminato) return false
    const a = (c.nome || '').trim().toLowerCase()
    const b = (book.intestatario || '').trim().toLowerCase()
    if (!a || !b) return false
    return a === b || b.includes(a) || a.includes(b)
  })
  return <tr key={book.id} style={clienteTerminato ? { ...tr, background: 'rgba(239,68,68,0.07)', borderLeft: '3px solid #ef4444' } : tr}><td style={td}>{book.id}</td><td style={tdStrong}><div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{livBadge && <span title={book.profilo_livello} style={{ background: livBadge.bg, color: livBadge.color, padding: '2px 7px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }} onClick={() => setActiveTab('profilazione')}>{livBadge.label}</span>}{book.nome}</div></td><td style={td}><div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={clienteTerminato ? { color: '#94a3b8' } : undefined}>{book.intestatario || '-'}</span>{clienteTerminato && <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 6, background: '#ef4444', color: '#fff', fontWeight: 800 }}>❌ TERMINATO</span>}</div></td><td style={td}>{isPuntiMoneteBook ? <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ fontSize: 14, fontWeight: 700, color: '#4ade80' }}>{Number(book.saldo || 0).toFixed(2)} €</span><span style={{ fontSize: 10, color: '#38bdf8', background: 'rgba(56,189,248,0.1)', padding: '2px 6px', borderRadius: 6, fontWeight: 700 }}>🏆 auto</span></div> : <input ref={el => { bookSaldoRefs.current[book.id] = el }} type="number" step="0.01" min="0" value={displaySaldo} onChange={e => setPendingBookSaldi(prev => ({ ...prev, [book.id]: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); const nextBook = filteredBooks[bookIndex + 1]; if (nextBook && bookSaldoRefs.current[nextBook.id]) { bookSaldoRefs.current[nextBook.id].focus(); bookSaldoRefs.current[nextBook.id].select() } } if (e.key === 'Escape') setPendingBookSaldi(prev => { const n = { ...prev }; delete n[book.id]; return n }) }} style={{ width: 110, background: hasPending ? 'rgba(251,191,36,0.08)' : '#0b1220', color: hasPending ? '#fbbf24' : '#e2e8f0', border: hasPending ? '1px solid rgba(251,191,36,0.7)' : '1px solid rgba(51,65,85,0.6)', borderRadius: 8, padding: '4px 8px', fontSize: 14, fontWeight: hasPending ? 800 : 600, outline: 'none' }} />}</td><td style={tdNote}><textarea defaultValue={book.note || ''} onBlur={(e) => updateNote('books', book.id, e.target.value)} style={{ ...noteTextarea, color: getNoteColor(book.note) }} /></td><td style={tdActions}><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><button style={tinyGreenButton} onClick={() => openQuickBookTx(book, 'versa')}>Versa</button><button style={tinyBlueButton} onClick={() => openQuickBookTx(book, 'preleva')}>Preleva</button><button style={tinyOrangeButton} onClick={() => { setSelectedBook(book); resetAdjustSaldoForm(book); setShowAdjustSaldoModal(true) }}>Correggi saldo</button><button style={tinyRedButton} onClick={() => handleDeleteBook(book)}>Elimina</button></div></td></tr>
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
                <input value={walletFilters.nota} onChange={(e) => setWalletFilters({ ...walletFilters, nota: e.target.value })} placeholder='Filtra per nota...' disabled={walletFilters.soloConNota} style={{ ...filterInput, opacity: walletFilters.soloConNota ? 0.5 : 1 }} />
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#94a3b8', fontSize: 13, whiteSpace: 'nowrap' }}>
                  <input type='checkbox' checked={walletFilters.soloConNota} onChange={(e) => setWalletFilters({ ...walletFilters, soloConNota: e.target.checked })} />
                  Solo con nota
                </label>
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
                  // "Casa" e "Famiglia" sono state unificate: le transazioni storiche salvate come "Casa" confluiscono in "Famiglia"
                  const normalizzaCategoria = (cat) => cat === 'Casa' ? 'Famiglia' : cat
                  const speseCategoria = txMese.filter(tx => tx.categoria_spesa).reduce((acc, tx) => { const cat = normalizzaCategoria(tx.categoria_spesa); acc[cat] = (acc[cat] || 0) + Number(tx.importo || 0); return acc }, {})
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
                          {['Auto','Alimentari','Ristoranti/Svago/Viaggi','Abbigliamento','Salute/Farmacia','Tecnologia/Abbonamenti','Famiglia','Attività Lavorativa','Spese Personali Sergio','Altro'].map(cat => (
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
                  <select value={txFilters.categoria} onChange={(e) => setTxFilters({ ...txFilters, categoria: e.target.value })} style={filterInput}><option value=''>Tutte le categorie</option>{['Auto','Alimentari','Ristoranti/Svago/Viaggi','Abbigliamento','Salute/Farmacia','Tecnologia/Abbonamenti','Famiglia','Attività Lavorativa','Spese Personali Sergio','Altro'].map(cat => <option key={cat} value={cat}>{cat}</option>)}</select>
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
                  <MemoTab
                    newAccountName={newAccountName}
                    setNewAccountName={setNewAccountName}
                    addRoyaltyAccount={addRoyaltyAccount}
                    memoRoyaltyEntries={memoRoyaltyEntries}
                    mediaMensileRoyalty={mediaMensileRoyalty}
                    memoRoyaltyAccounts={memoRoyaltyAccounts}
                    upsertRoyaltyEntry={upsertRoyaltyEntry}
                    updateRoyaltyEntry={updateRoyaltyEntry}
                    formatCurrency={formatCurrency}
                    memoForm={memoForm}
                    setMemoForm={setMemoForm}
                    addMemoFutureNote={addMemoFutureNote}
                    memoFutureNotes={memoFutureNotes}
                    updateMemoFutureNote={updateMemoFutureNote}
                    deleteMemoFutureNote={deleteMemoFutureNote}
                    memoSavingsRows={memoSavingsRows}
                    savingsFormMassi={savingsFormMassi}
                    setSavingsFormMassi={setSavingsFormMassi}
                    savingsFormSamu={savingsFormSamu}
                    setSavingsFormSamu={setSavingsFormSamu}
                    addSavingsRow={addSavingsRow}
                  />
                )}

        {activeTab === 'post-it' && (
          <PostItTab
            postItNotes={postItNotes}
            nuovoPostIt={nuovoPostIt}
            setNuovoPostIt={setNuovoPostIt}
            postItEditingId={postItEditingId}
            postItEditText={postItEditText}
            setPostItEditText={setPostItEditText}
            addPostIt={addPostIt}
            togglePostIt={togglePostIt}
            deletePostIt={deletePostIt}
            startEditPostIt={startEditPostIt}
            cancelEditPostIt={cancelEditPostIt}
            saveEditPostIt={saveEditPostIt}
          />
        )}
        {/* POPUP FILE MANAGER DOCUMENTI */}
        {docCliente && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(2,6,23,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000, padding: 16 }}>
            <div style={{ width: '100%', maxWidth: 680, background: 'linear-gradient(180deg,rgba(15,23,42,0.99),rgba(2,6,23,1))', border: '2px solid rgba(251,191,36,0.4)', borderRadius: 22, padding: 24, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
              
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <h3 style={{ margin: 0, color: '#f8fafc', fontSize: 18 }}>📁 Documenti — {docCliente.nome}</h3>
                  <p style={{ margin: '4px 0 0', color: '#94a3b8', fontSize: 13 }}>Carica, scarica o elimina i documenti del cliente</p>
                </div>
                <button onClick={() => { setDocCliente(null); setDocFiles([]); setDocLoading(false); setDocUploading(false) }}
                  style={{ border: '1px solid rgba(71,85,105,0.95)', background: 'rgba(15,23,42,0.82)', color: '#e2e8f0', width: 38, height: 38, borderRadius: 12, cursor: 'pointer', fontSize: 18 }}>×</button>
              </div>

              {/* File manager */}
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
        {/* POPUP SMS ogni 4 ore */}
        {showSmsPopup && smsNuovi.length > 0 && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(2,6,23,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2200, padding: 16 }}>
            <div style={{ width: '100%', maxWidth: 560, background: 'linear-gradient(180deg,rgba(15,23,42,0.99),rgba(2,6,23,1))', border: '2px solid rgba(56,189,248,0.5)', borderRadius: 22, padding: 24, maxHeight: '80vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <h2 style={{ margin: 0, color: '#f8fafc', fontSize: 18 }}>📱 Nuovi SMS ricevuti</h2>
                  <p style={{ margin: '4px 0 0', color: '#94a3b8', fontSize: 13 }}>{smsNuovi.length} messaggi dall'ultima visita</p>
                </div>
                <button style={{ border: '1px solid rgba(71,85,105,0.95)', background: 'rgba(15,23,42,0.82)', color: '#e2e8f0', width: 38, height: 38, borderRadius: 12, cursor: 'pointer', fontSize: 18 }}
                  onClick={() => { setShowSmsPopup(false); localStorage.setItem('smsUltimaVista', String(Date.now())) }}>×</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {smsNuovi.map((sms) => (
                  <div key={sms.id} style={{ background: 'rgba(11,18,32,0.85)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: 12, padding: '10px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 6, background: sms.tipo === 'OTP' ? 'rgba(239,68,68,0.15)' : 'rgba(56,189,248,0.12)', color: sms.tipo === 'OTP' ? '#f87171' : '#38bdf8' }}>{sms.tipo}</span>
                      <span style={{ fontWeight: 700, color: '#f8fafc', fontSize: 13 }}>{sms.cliente}</span>
                      <span style={{ marginLeft: 'auto', fontSize: 11, color: '#64748b' }}>{sms.data_ricezione ? new Date(sms.data_ricezione).toLocaleString('it-IT') : ''}</span>
                    </div>
                    <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 2 }}>Da: {sms.mittente}</div>
                    <div style={{ color: '#e2e8f0', fontSize: 13 }}>{sms.testo}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
                <button style={{ padding: '10px 18px', borderRadius: 12, border: 'none', background: '#1D4ED8', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}
                  onClick={() => { setShowSmsPopup(false); localStorage.setItem('smsUltimaVista', String(Date.now())); handleTabChange('sms') }}>Vai ad Archivio SMS →</button>
                <button style={{ padding: '10px 18px', borderRadius: 12, border: '1px solid rgba(51,65,85,0.95)', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: 13 }}
                  onClick={() => { setShowSmsPopup(false); localStorage.setItem('smsUltimaVista', String(Date.now())) }}>Chiudi</button>
              </div>
            </div>
          </div>
        )}

        <SmsTab
            isActive={activeTab === 'sms'}
            smsCaricato={smsCaricato}
            smsClienti={smsClienti}
            setSmsClienti={setSmsClienti}
            smsFiltroCliente={smsFiltroCliente}
            setSmsFiltroCliente={setSmsFiltroCliente}
            smsFiltroDa={smsFiltroDa}
            setSmsFiltroDa={setSmsFiltroDa}
            smsFiltroDal={smsFiltroDal}
            setSmsFiltroDal={setSmsFiltroDal}
            smsFiltroAl={smsFiltroAl}
            setSmsFiltroAl={setSmsFiltroAl}
            setSmsNuovi={setSmsNuovi}
            setShowSmsPopup={setShowSmsPopup}
            smsSelezionato={smsSelezionato}
            setSmsSelezionato={setSmsSelezionato}
          />

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

{/* WIDGET FLOTTANTE POST-IT — visibile su tutte le tab, trascinabile */}
<PostItFloatingWidget
  postItFloatPos={postItFloatPos}
  postItMinimized={postItMinimized}
  postItDragging={postItDragging}
  postItNotes={postItNotes}
  nuovoPostIt={nuovoPostIt}
  setNuovoPostIt={setNuovoPostIt}
  postItEditingId={postItEditingId}
  postItEditText={postItEditText}
  setPostItEditText={setPostItEditText}
  addPostIt={addPostIt}
  togglePostIt={togglePostIt}
  deletePostIt={deletePostIt}
  startEditPostIt={startEditPostIt}
  cancelEditPostIt={cancelEditPostIt}
  saveEditPostIt={saveEditPostIt}
  startPostItDrag={startPostItDrag}
  togglePostItMinimized={togglePostItMinimized}
/>

        {activeTab === 'team' && (
          <div style={tabContent}>
            <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
              {[
                { key: 'promo', label: '🖼️ Promo' },
                { key: 'conti', label: '🔄 Conti' },
                { key: 'risultati', label: '📊 Risultati' },
                { key: 'gestione', label: '👤 Gestione collaboratori' },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setTeamSubTab(key)}
                  style={{
                    background: teamSubTab === key ? 'rgba(232,162,61,0.15)' : 'transparent',
                    border: teamSubTab === key ? '1px solid #E8A23D' : '1px solid rgba(51,65,85,0.6)',
                    color: teamSubTab === key ? '#E8A23D' : '#B0B4BA',
                    borderRadius: 8, padding: '7px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <div style={panel}>
              {teamSubTab === 'promo' && <PromoScreenshotsPanel />}
              {teamSubTab === 'conti' && <ClientiMovimentazionePanel />}
              {teamSubTab === 'risultati' && <RisultatiPanel />}
              {teamSubTab === 'gestione' && <CollaboratoriManager />}
            </div>
          </div>
        )}

 
  </div>
    )
}

