'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'

import { useRouter } from 'next/navigation'

type Canale = 'EMAIL' | 'SMS'

type Comunicazione = {
  id: string
  source_id: string | number
  canale: Canale

  data_mail: string | null
  cliente_nome: string | null
  bookmaker: string | null
  mittente: string | null
  destinatario_originale: string | null

  oggetto: string | null
  testo_completo: string | null

  categoria: string | null
  giudizio: string | null
  priorita: string | null
  confidenza: number | null

  tipo_offerta: string | null
  bonus_importo: number | null
  deposito_richiesto: number | null
  rollover: string | null
  scadenza: string | null
  condizioni: string | null
  motivazione_ai: string | null
  richiede_azione: boolean | null

  letta: boolean | null
  archiviata: boolean

  feedback_utente: string | null
  feedback_note: string | null
}

type Counters = {
  tutte: number
  opportunita: number
  accreditati: number
  da_valutare: number
  problemi: number
  ignora: number
  da_analizzare: number
  archiviate: number
}

type Vista =
  | 'opportunita'
  | 'accreditati'
  | 'da_valutare'
  | 'problemi'
  | 'ignora'
  | 'da_analizzare'
  | 'tutte'
  | 'archiviate'

const emptyCounters: Counters = {
  tutte: 0,
  opportunita: 0,
  accreditati: 0,
  da_valutare: 0,
  problemi: 0,
  ignora: 0,
  da_analizzare: 0,
  archiviate: 0,
}

const matrixColumns = Array.from(
  { length: 72 },
  (_, index) => {
    const patterns = [
      '010110101001011010010110100101',
      '101001101011010010110100101101',
      '001101001011010110100101101001',
      '110100101101001011010010110100',
      '011010010110100101101001011010',
      '100101101001011010010110100101',
      '010011010110010110100101101001',
      '101100101101001011010010110100',
    ]

    return patterns[index % patterns.length]
  }
)


/* =======================================================
   07/10/2026 — TESTO PULITO
   Toglie link di tracciamento, caratteri invisibili e
   segni di formattazione dalle email. L'originale resta
   nel database e si rivede col pulsante "Originale".
   ======================================================= */
function pulisciTesto(originale: string | null | undefined) {
  let t = String(originale || '').replace(/\r/g, '')
  let link = 0

  // [https://....]  e  <https://....>  (anche spezzati su più righe)
  t = t.replace(/\[\s*https?:\/\/[^\]]*\]/gi, () => { link++; return '\u0001' })
  t = t.replace(/<\s*https?:\/\/[^>]*>/gi, () => { link++; return '\u0001' })
  // indirizzi nudi
  t = t.replace(/https?:\/\/\S+/gi, () => { link++; return '\u0001' })

  // entità HTML (&euro; &ograve; &amp; &#8364; ...)
  const ENT: Record<string, string> = {
    euro: '€', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…',
    ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', laquo: '«', raquo: '»',
    copy: '©', reg: '®', deg: '°', middot: '·', bull: '•', ccedil: 'ç', Ccedil: 'Ç', szlig: 'ß', pound: '£',
  }
  const MARCHI: Record<string, string> = { grave: '\u0300', acute: '\u0301', circ: '\u0302', tilde: '\u0303', uml: '\u0308' }
  t = t.replace(/&#(\d+);/g, (_m, n) => { try { return String.fromCodePoint(Number(n)) } catch { return '' } })
  t = t.replace(/&#x([0-9a-f]+);/gi, (_m, h) => { try { return String.fromCodePoint(parseInt(h, 16)) } catch { return '' } })
  t = t.replace(/&([A-Za-z])(grave|acute|circ|tilde|uml);/g, (_m, l, mk) => (l + MARCHI[mk]).normalize('NFC'))
  t = t.replace(/&([A-Za-z]+);/g, (m, nome) => (ENT[nome] !== undefined ? ENT[nome] : m))

  // caratteri invisibili usati nelle newsletter per riempire l'anteprima
  t = t.replace(/[\u200b-\u200f\u2028\u2029\u202a-\u202e\u2060-\u2064\u00ad\u034f\u061c\ufeff]/g, '')
  t = t.replace(/&nbsp;/gi, ' ').replace(/\u00a0/g, ' ')

  // asterischi di formattazione (*testo*)
  t = t.replace(/(^|\s)\*+(?=\S)/gm, '$1')
  t = t.replace(/(?<=\S)\*+(?=\s|$|[.,;:!?)])/g, '')
  t = t.replace(/^[ \t*]+$/gm, '')        // righe fatte solo di asterischi
  t = t.replace(/[ \t]+\*+[ \t]*$/gm, '')  // asterischi isolati a fine riga

  // spazi in eccesso; righe fatte solo di link o simboli: via (le righe vuote restano)
  t = t
    .split('\n')
    .map(r => r.replace(/[ \t]+/g, ' ').trim())
    .filter(r => r === '' || !/^[\u0001\s|•·\-–—_=~.]*$/.test(r))
    .join('\n')

  // link doppi sulla stessa riga -> uno solo
  t = t.replace(/(\u0001[\s|•·\-–—]*){2,}/g, '\u0001')
  t = t.replace(/\u0001/g, '🔗')

  // righe vuote multiple
  t = t.replace(/\n{3,}/g, '\n\n').trim()

  return { testo: t, link }
}

export default function ArchivioLucyPage() {
  const router = useRouter()

  // 05/10/2026 · 📌 PROMO: apre la tab Promo del Profit Tracker con il modulo già compilato dai dati letti dall'AI
  function vaiAPromo(item: Comunicazione) {
    const q = new URLSearchParams({
      tab: 'promo',
      canale: item.canale || '',
      mail_id: String(item.id || ''),
      cliente: item.cliente_nome || '',
      book: item.bookmaker || '',
      tipo: item.tipo_offerta || '',
      bonus: item.bonus_importo != null ? String(item.bonus_importo) : '',
      deposito: item.deposito_richiesto != null ? String(item.deposito_richiesto) : '',
      rollover: item.rollover && !['null', 'none', 'nessuno', 'n/a', '-'].includes(String(item.rollover).trim().toLowerCase()) ? String(item.rollover) : '',
      scadenza: item.scadenza || '',
      oggetto: (item.oggetto || '').slice(0, 160),
    })
    router.push(`/profit-tracker?${q.toString()}`)
  }

  const [rows, setRows] =
    useState<Comunicazione[]>([])

  const [count, setCount] =
    useState(0)

  const [counters, setCounters] =
    useState<Counters>(emptyCounters)

  // 03/10/2026 — mittenti per il filtro con suggerimenti
  const [mittenti, setMittenti] = useState<string[]>([])
  const [suggerimentiAperti, setSuggerimentiAperti] = useState(false)

  const [clienti, setClienti] =
    useState<string[]>([])

  const [loading, setLoading] =
    useState(false)

  // 07/10/2026 — 👎: scelta di dove doveva andare la mail
  const [pannelloNo, setPannelloNo] = useState<string | null>(null)
  const [motivoNo, setMotivoNo] = useState('')

  const DESTINAZIONI: Array<{ chiave: string; etichetta: string }> = [
    { chiave: 'OPPORTUNITA', etichetta: '🔥 Opportunità' },
    { chiave: 'DA_VALUTARE', etichetta: '⚠️ Da valutare' },
    { chiave: 'PROBLEMI', etichetta: '🚨 Problemi' },
    { chiave: 'IGNORA', etichetta: '⚪ Ignora' },
  ]

  function etichettaDest(nota: string | null | undefined) {
    const m = String(nota || '').match(/^DOVEVA_ESSERE=([A-Z_]+)/)
    if (!m) return ''
    return DESTINAZIONI.find(d => d.chiave === m[1])?.etichetta || m[1]
  }

  function motivoDaNota(nota: string | null | undefined) {
    const m = String(nota || '').match(/\|\s*(.+)$/)
    return m ? m[1] : ''
  }

  const [mostraOriginale, setMostraOriginale] = useState(false)
  // 07/10/2026 — freccia "torna su", visibile in tutte le viste dopo un po' di scroll
  const [mostraSu, setMostraSu] = useState(false)

  useEffect(() => {
    const onScroll = () => setMostraSu(window.scrollY > 300)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const [avviso, setAvviso] = useState<{ testo: string; ok: boolean } | null>(null)

  function mostraAvviso(testo: string, ok: boolean) {
    setAvviso({ testo, ok })
    setTimeout(() => setAvviso(null), ok ? 2500 : 8000)
  }

  const [savingId, setSavingId] =
    useState<string | null>(null)

  const [
    comunicazioneAperta,
    setComunicazioneAperta,
  ] = useState<Comunicazione | null>(
    null
  )

  const [vista, setVista] =
    useState<Vista>('opportunita')

  const [periodo, setPeriodo] =
    useState('1m')

  const [canale, setCanale] =
    useState('TUTTI')

  const [f, setF] = useState({
    q: '',
    cliente: '',
    bookmaker: '',
    giudizio: '',
    categoria: '',
    priorita: '',
  })

  /* =======================================================
     CARICAMENTO
     ======================================================= */

  const load = useCallback(
    async (silenzioso: boolean = false) => {
      // 07/10/2026 — ricarica "silenziosa": niente scritta di caricamento, la pagina non salta
      if (!silenzioso) setLoading(true)

      try {
        const p =
          new URLSearchParams()

        if (vista !== 'tutte') {
          p.set('vista', vista)
        }

        Object.entries(f).forEach(
          ([key, value]) => {
            if (value) {
              p.set(key, value)
            }
          }
        )

        p.set('periodo', periodo)

        if (canale !== 'TUTTI') {
          p.set('canale', canale)
        }

        p.set('page_size', '100')

        const r = await fetch(
          '/api/lucy-mail/archive?' +
            p.toString(),
          {
            cache: 'no-store',
          }
        )

        const j = await r.json()

        if (!r.ok) {
          console.error(
            '[Lucy Archive]',
            j
          )
          return
        }

        setRows(j.data || [])
        setCount(j.count || 0)

        setCounters(
          j.counters ||
            emptyCounters
        )

        setClienti(
          j.clienti || []
        )

        setMittenti(
          j.mittenti || []
        )
      } catch (error) {
        console.error(
          '[Lucy Archive]',
          error
        )
      } finally {
        if (!silenzioso) setLoading(false)
      }
    },
    [
      f,
      vista,
      periodo,
      canale,
    ]
  )

  useEffect(() => {
    load()
  }, [load])

  /* =======================================================
     FEEDBACK
     ======================================================= */

  async function feedback(
    item: Comunicazione,
    value: string,
    nota: string | null = null,
    sposta: string | null = null
  ) {
    const motivoInviato = motivoNo
    setPannelloNo(null)
    setMotivoNo('')
    // 07/10/2026 — il voto si vede subito (aggiornamento immediato) e compare un avviso di conferma
    const precedente = item.feedback_utente
    const notaPrecedente = item.feedback_note
    setRows(prev =>
      sposta && vista !== 'tutte'
        ? prev.filter(r => r.id !== item.id)
        : prev.map(r =>
            r.id === item.id
              ? { ...r, feedback_utente: value, feedback_note: nota }
              : r
          )
    )
    if (sposta && vista !== 'tutte') {
      setCount(c => Math.max(0, c - 1))
    }
    if (comunicazioneAperta?.id === item.id) {
      setComunicazioneAperta({ ...comunicazioneAperta, feedback_utente: value, feedback_note: nota })
    }

    try {
      const r = await fetch(
        '/api/lucy-mail/archive',
        {
          method: 'PATCH',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify({
            id: item.id,
            source_id:
              item.source_id,
            canale:
              item.canale,
            feedback_utente:
              value,
            // i campi extra si mandano solo quando servono (alcune tabelle, es. SMS, potrebbero non avere la colonna note)
            ...(nota !== null || notaPrecedente
              ? { feedback_note: nota }
              : {}),
            ...(sposta
              ? { sposta_in: sposta, motivo: motivoInviato }
              : {}),
          }),
        }
      )

      if (!r.ok) {
        let dettaglio = ''
        try { dettaglio = (await r.json())?.error || '' } catch {}
        throw new Error('HTTP ' + r.status + (dettaglio ? ' · ' + dettaglio : ''))
      }

      if (sposta) {
        // la mail cambia vista: sparisce subito, poi si sincronizzano i contatori
        load(true)
      }

      mostraAvviso(
        value === 'UTILE'
          ? '👍 Voto registrato: classificazione corretta'
          : nota && nota.startsWith('DOVEVA_ESSERE=')
            ? '👎 Spostata in ' + etichettaDest(nota) + ' · Lucy ha imparato'
            : '👎 Voto registrato: classificazione errata',
        true
      )
    } catch (error) {
      console.error(
        '[Lucy feedback]',
        error
      )
      // ripristina il voto precedente
      setRows(prev =>
        prev.map(r =>
          r.id === item.id
            ? { ...r, feedback_utente: precedente, feedback_note: notaPrecedente }
            : r
        )
      )
      mostraAvviso('⚠️ Voto NON salvato: ' + String((error as Error)?.message || 'errore').slice(0, 140), false)
    }
  }

  /* =======================================================
     ARCHIVIA / RIPRISTINA
     ======================================================= */

  async function cambiaArchivio(
    item: Comunicazione,
    nuovoStato: boolean
  ) {
    if (savingId === item.id) {
      return
    }

    setSavingId(item.id)

    // 07/10/2026 — la riga sparisce SUBITO (senza ricaricare la pagina) e si chiude il popup
    setRows(prev => prev.filter(r => r.id !== item.id))
    setCount(c => Math.max(0, c - 1))
    setCounters(c => ({
      ...c,
      archiviate: Math.max(0, c.archiviate + (nuovoStato ? 1 : -1)),
    }))
    if (comunicazioneAperta?.id === item.id) {
      setComunicazioneAperta(null)
    }

    try {
      const r = await fetch(
        '/api/lucy-mail/archive',
        {
          method: 'PATCH',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify({
            id: item.id,
            source_id:
              item.source_id,
            canale:
              item.canale,
            archiviata:
              nuovoStato,
          }),
        }
      )

      if (!r.ok) {
        throw new Error('HTTP ' + r.status)
      }

      // allinea i contatori in background, senza muovere la pagina
      load(true)
    } catch (error) {
      console.error(
        '[Lucy archivio]',
        error
      )
      mostraAvviso('⚠️ Non archiviata, riprova', false)
      load(true) // la riga torna al suo posto
    } finally {
      setSavingId(null)
    }
  }

  /* =======================================================
     APERTURA COMUNICAZIONE
     ======================================================= */

  async function apriComunicazione(
    item: Comunicazione
  ) {
    setMostraOriginale(false)
    setComunicazioneAperta(item)

    try {
      await fetch(
        '/api/lucy-mail/archive',
        {
          method: 'PATCH',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify({
            id: item.id,
            source_id:
              item.source_id,
            canale:
              item.canale,
            letta: true,
          }),
        }
      )
    } catch (error) {
      console.error(
        '[Lucy lettura]',
        error
      )
    }
  }

  function cambiaVista(
    nuovaVista: Vista
  ) {
    setVista(nuovaVista)
  }

  /* =======================================================
     FORMATTAZIONE
     ======================================================= */

  function formatDate(
    value: string | null
  ) {
    if (!value) return '-'

    const date =
      new Date(value)

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return value
    }

    return date.toLocaleString(
      'it-IT'
    )
  }

  function priorityClass(
    priority: string | null
  ) {
    if (priority === 'alta') {
      return 'text-red-400 font-bold'
    }

    if (priority === 'media') {
      return 'text-amber-300 font-semibold'
    }

    return 'text-emerald-400'
  }

  function tabClass(
    key: Vista
  ) {
    const active =
      vista === key

    return `
      relative
      overflow-hidden
      rounded-xl
      border
      px-4
      py-3
      text-left
      transition-all
      duration-200
      ${
        active
          ? `
            border-green-400
            bg-green-500/15
            shadow-[0_0_22px_rgba(34,197,94,0.25)]
            text-green-300
          `
          : `
            border-green-900/70
            bg-[#07100a]
            text-slate-300
            hover:border-green-500
            hover:bg-green-950/40
          `
      }
    `
  }

  const periodLabel =
    useMemo(() => {
      if (periodo === '15g') {
        return 'Ultimi 15 giorni'
      }

      if (periodo === '3m') {
        return 'Ultimi 3 mesi'
      }

      if (periodo === 'tutto') {
        return 'Tutto'
      }

      return 'Ultimo mese'
    }, [periodo])

  /* =======================================================
     RENDER
     ======================================================= */

  return (
    <div
      className="
        min-h-screen
        bg-[#020604]
        text-slate-100
      "
    >
      {/* ==================================================
          MATRIX HERO
          ================================================== */}

      <header
        className="
          relative
          h-[230px]
          overflow-hidden
          border-b
          border-green-500/30
          bg-black
        "
      >
        <div
          className="
            absolute
            inset-0
            overflow-hidden
            pointer-events-none
            select-none
          "
          aria-hidden="true"
        >
          <div
            className="
              absolute
              inset-0
              bg-[radial-gradient(circle_at_center,rgba(22,163,74,0.22),transparent_72%)]
            "
          />

          {/* MATRIX PRINCIPALE */}

          <div
            className="
              absolute
              inset-0
              grid
              grid-cols-[repeat(72,minmax(0,1fr))]
              gap-[1px]
              opacity-80
              overflow-hidden
            "
          >
            {matrixColumns.map(
              (digits, index) => (
                <div
                  key={index}
                  className="
                    matrix-column
                    w-full
                    text-center
                    font-mono
                    text-[10px]
                    font-bold
                    leading-[12px]
                    text-green-300
                    whitespace-pre
                  "
                  style={{
                    animationDuration:
                      `${
                        5.2 +
                        (index % 9) *
                          0.55
                      }s`,
                    animationDelay:
                      `-${
                        (index % 13) *
                        0.47
                      }s`,
                  }}
                >
                  {digits
                    .repeat(7)
                    .split('')
                    .join('\n')}
                </div>
              )
            )}
          </div>

          {/* MATRIX SECONDO LIVELLO */}

          <div
            className="
              absolute
              inset-0
              grid
              grid-cols-[repeat(54,minmax(0,1fr))]
              gap-[2px]
              opacity-35
              overflow-hidden
              translate-x-2
            "
          >
            {matrixColumns
              .slice(0, 54)
              .map(
                (
                  digits,
                  index
                ) => (
                  <div
                    key={
                      'matrix-back-' +
                      index
                    }
                    className="
                      matrix-column
                      w-full
                      text-center
                      font-mono
                      text-[9px]
                      leading-[11px]
                      text-green-500
                      whitespace-pre
                    "
                    style={{
                      animationDuration:
                        `${
                          8 +
                          (index %
                            7) *
                            0.7
                        }s`,
                      animationDelay:
                        `-${
                          (index %
                            11) *
                          0.65
                        }s`,
                    }}
                  >
                    {digits
                      .repeat(8)
                      .split('')
                      .join('\n')}
                  </div>
                )
              )}
          </div>

          <div
            className="
              absolute
              inset-0
              bg-gradient-to-r
              from-black/72
              via-black/22
              to-black/48
            "
          />

          <div
            className="
              absolute
              inset-x-0
              bottom-0
              h-16
              bg-gradient-to-b
              from-transparent
              to-[#020604]
            "
          />
        </div>

        {/* HEADER CONTENT */}

        <div
          className="
            relative
            z-10
            max-w-[1800px]
            mx-auto
            h-full
            px-6
            flex
            items-center
            justify-between
            gap-6
          "
        >
          <div
            className="
              flex
              items-center
              gap-5
            "
          >
            <div
              className="
                relative
                shrink-0
              "
            >
              <div
                className="
                  absolute
                  -inset-2
                  rounded-2xl
                  bg-green-400/20
                  blur-xl
                "
              />

              <img
                src="/Lucy.png"
                alt="Lucy"
                className="
                  relative
                  w-28
                  h-28
                  object-cover
                  rounded-2xl
                  border
                  border-green-400
                  shadow-[0_0_30px_rgba(34,197,94,0.45)]
                "
              />
            </div>

            <div>
              <div
                className="
                  flex
                  items-center
                  gap-3
                "
              >
                <h1
                  className="
                    text-4xl
                    md:text-5xl
                    font-black
                    tracking-[0.18em]
                    text-green-400
                    drop-shadow-[0_0_12px_rgba(34,197,94,0.6)]
                  "
                >
                  LUCY
                </h1>

                <span
                  className="
                    hidden
                    md:inline-flex
                    items-center
                    rounded-full
                    border
                    border-green-500/50
                    bg-green-950/60
                    px-3
                    py-1
                    text-xs
                    font-bold
                    text-green-300
                  "
                >
                  ● ONLINE
                </span>
              </div>

              <div
                className="
                  mt-2
                  font-mono
                  text-green-300
                  text-sm
                  md:text-base
                "
              >
                AI OPERATIVA
              </div>

              <p
                className="
                  mt-2
                  text-slate-300
                  max-w-xl
                "
              >
                Analisi intelligente di
                email e SMS per trovare
                opportunità, bonus e
                comunicazioni importanti.
              </p>
            </div>
          </div>

          <div
            className="
              hidden
              sm:flex
              items-center
              gap-2
            "
          >
            <button
              onClick={() =>
                router.push(
                  '/profit-tracker'
                )
              }
              className="
                rounded-lg
                border
                border-green-500/50
                bg-black/70
                px-4
                py-2
                font-semibold
                text-green-300
                hover:bg-green-950
                hover:border-green-400
              "
            >
              🏠 Dashboard
            </button>

            <button
              onClick={() =>
                router.push('/profit-tracker?tab=promo')
              }
              className="
                rounded-lg
                border
                border-pink-500/50
                bg-pink-500/10
                px-4
                py-2
                font-semibold
                text-pink-300
                hover:bg-pink-500/20
              "
            >
              📌 Promo
            </button>

            <button
              onClick={() => load()}
              className="
                rounded-lg
                border
                border-green-500/50
                bg-green-500/10
                px-4
                py-2
                font-semibold
                text-green-300
                hover:bg-green-500/20
              "
            >
              ↻ Aggiorna
            </button>
          </div>
        </div>
      </header>

      {/* ==================================================
          CONTENUTO
          ================================================== */}

      <main
        className="
          max-w-[1800px]
          mx-auto
          px-6
          py-6
        "
      >
        {/* MOBILE */}

        <div
          className="
            sm:hidden
            flex
            gap-2
            mb-5
          "
        >
          <button
            onClick={() =>
              router.push(
                '/profit-tracker'
              )
            }
            className="
              flex-1
              rounded-lg
              border
              border-green-500/50
              bg-[#07100a]
              px-3
              py-2
              text-green-300
            "
          >
            🏠 Dashboard
          </button>

          <button
            onClick={() =>
              router.push('/profit-tracker?tab=promo')
            }
            className="
              flex-1
              rounded-lg
              border
              border-pink-500/50
              bg-[#07100a]
              px-3
              py-2
              text-pink-300
            "
          >
            📌 Promo
          </button>

          <button
            onClick={() => load()}
            className="
              flex-1
              rounded-lg
              border
              border-green-500/50
              bg-[#07100a]
              px-3
              py-2
              text-green-300
            "
          >
            ↻ Aggiorna
          </button>
        </div>

        {/* ==================================================
            CONTATORI
            ================================================== */}

        <div
          className="
            grid
            grid-cols-2
            md:grid-cols-4
            xl:grid-cols-8
            gap-3
            mb-6
          "
        >
          <button
            className={
              tabClass(
                'opportunita'
              )
            }
            onClick={() =>
              cambiaVista(
                'opportunita'
              )
            }
          >
            <div
              className="
                text-2xl
                font-black
                text-green-400
              "
            >
              {counters.opportunita}
            </div>

            <div className="mt-1 font-semibold">
              🔥 Opportunità
            </div>
          </button>

          <button
            className={tabClass('accreditati')}
            onClick={() => cambiaVista('accreditati')}
          >
            <div className="text-2xl font-black text-emerald-300">
              {counters.accreditati}
            </div>

            <div className="mt-1 font-semibold">
              💰 Bonus accreditati
            </div>
          </button>

          <button
            className={
              tabClass(
                'da_valutare'
              )
            }
            onClick={() =>
              cambiaVista(
                'da_valutare'
              )
            }
          >
            <div
              className="
                text-2xl
                font-black
                text-amber-300
              "
            >
              {counters.da_valutare}
            </div>

            <div className="mt-1 font-semibold">
              ⚠️ Da valutare
            </div>
          </button>

          <button
            className={
              tabClass(
                'problemi'
              )
            }
            onClick={() =>
              cambiaVista(
                'problemi'
              )
            }
          >
            <div
              className="
                text-2xl
                font-black
                text-red-400
              "
            >
              {counters.problemi}
            </div>

            <div className="mt-1 font-semibold">
              🚨 Problemi
            </div>
          </button>

          <button
            className={
              tabClass('ignora')
            }
            onClick={() =>
              cambiaVista('ignora')
            }
          >
            <div
              className="
                text-2xl
                font-black
                text-slate-400
              "
            >
              {counters.ignora}
            </div>

            <div className="mt-1 font-semibold">
              ⚪ Ignora
            </div>
          </button>

          <button
            className={
              tabClass(
                'da_analizzare'
              )
            }
            onClick={() =>
              cambiaVista(
                'da_analizzare'
              )
            }
          >
            <div
              className="
                text-2xl
                font-black
                text-cyan-300
              "
            >
              {counters.da_analizzare}
            </div>

            <div className="mt-1 font-semibold">
              ⏳ Da analizzare
            </div>
          </button>

          <button
            className={
              tabClass('tutte')
            }
            onClick={() =>
              cambiaVista('tutte')
            }
          >
            <div
              className="
                text-2xl
                font-black
                text-green-300
              "
            >
              {counters.tutte}
            </div>

            <div className="mt-1 font-semibold">
              📚 Tutte
            </div>
          </button>

          <button
            className={
              tabClass(
                'archiviate'
              )
            }
            onClick={() =>
              cambiaVista(
                'archiviate'
              )
            }
          >
            <div
              className="
                text-2xl
                font-black
                text-violet-300
              "
            >
              {counters.archiviate}
            </div>

            <div className="mt-1 font-semibold">
              📦 Archiviate
            </div>
          </button>
        </div>

        {/* ==================================================
            FILTRI
            ================================================== */}

        <section
          className="
            mb-5
            rounded-xl
            border
            border-green-900/70
            bg-[#07100a]
            p-4
            shadow-[0_0_20px_rgba(0,0,0,0.35)]
          "
        >
          <div
            className="
              mb-3
              flex
              flex-wrap
              items-center
              justify-between
              gap-3
            "
          >
            <div
              className="
                font-mono
                text-sm
                text-green-400
              "
            >
              &gt; LUCY_FILTER
            </div>

            <div
              className="
                flex
                flex-wrap
                gap-2
                text-xs
              "
            >
              <span
                className="
                  rounded-full
                  border
                  border-green-800
                  bg-black
                  px-3
                  py-1
                  text-green-300
                "
              >
                {count}{' '}
                {count === 1
                  ? 'comunicazione'
                  : 'comunicazioni'}
              </span>

              <span
                className="
                  rounded-full
                  border
                  border-green-800
                  bg-black
                  px-3
                  py-1
                  text-green-300
                "
              >
                {periodLabel}
              </span>

              <span
                className="
                  rounded-full
                  border
                  border-green-800
                  bg-black
                  px-3
                  py-1
                  text-green-300
                "
              >
                {canale === 'EMAIL'
                  ? '📧 Email'
                  : canale === 'SMS'
                    ? '📱 SMS'
                    : '📨 Email + SMS'}
              </span>

              {vista ===
                'archiviate' && (
                <span
                  className="
                    rounded-full
                    border
                    border-violet-700
                    bg-violet-950/30
                    px-3
                    py-1
                    text-violet-300
                  "
                >
                  📦 Archiviate
                </span>
              )}
            </div>
          </div>

          <div
            className="
              grid
              md:grid-cols-2
              xl:grid-cols-4
              2xl:grid-cols-8
              gap-2
            "
          >
            <input
              className="matrix-input"
              placeholder="🔎 Cerca..."
              value={f.q}
              onChange={e =>
                setF({
                  ...f,
                  q: e.target.value,
                })
              }
            />

            <select
              className="matrix-input"
              value={f.cliente}
              onChange={e =>
                setF({
                  ...f,
                  cliente:
                    e.target.value,
                })
              }
            >
              <option value="">
                👤 Tutti i clienti
              </option>

              {clienti.map(
                cliente => (
                  <option
                    key={cliente}
                    value={cliente}
                  >
                    {cliente}
                  </option>
                )
              )}
            </select>

            {/* 03/10/2026 — MITTENTE con suggerimenti: scrivi "aer" e compaiono i mittenti che contengono "aer" */}
            <div style={{ position: 'relative' }}>
              <input
                className="matrix-input"
                style={{ width: '100%' }}
                placeholder="✉️ Mittente"
                value={f.bookmaker}
                onFocus={() => setSuggerimentiAperti(true)}
                onBlur={() => setTimeout(() => setSuggerimentiAperti(false), 150)}
                onChange={e => {
                  setSuggerimentiAperti(true)
                  setF({
                    ...f,
                    bookmaker:
                      e.target.value,
                  })
                }}
              />
              {f.bookmaker && (
                <button
                  type="button"
                  title="Togli il filtro"
                  onMouseDown={e => { e.preventDefault(); setF({ ...f, bookmaker: '' }) }}
                  style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 0, color: '#86efac', cursor: 'pointer', fontSize: 14 }}
                >
                  ✕
                </button>
              )}
              {suggerimentiAperti && f.bookmaker.trim().length > 0 && (() => {
                const q = f.bookmaker.trim().toLowerCase()
                const trovati = mittenti.filter(m => m.toLowerCase().includes(q)).slice(0, 12)
                if (!trovati.length || (trovati.length === 1 && trovati[0] === f.bookmaker)) return null
                return (
                  <div style={{ position: 'absolute', zIndex: 50, top: '100%', left: 0, right: 0, marginTop: 4, maxHeight: 280, overflowY: 'auto', background: '#020617', border: '1px solid rgba(34,197,94,.5)', borderRadius: 10, boxShadow: '0 10px 30px rgba(0,0,0,.6)' }}>
                    {trovati.map(m => {
                      const i = m.toLowerCase().indexOf(q)
                      return (
                        <div
                          key={m}
                          onMouseDown={e => { e.preventDefault(); setF({ ...f, bookmaker: m }); setSuggerimentiAperti(false) }}
                          style={{ padding: '7px 10px', fontSize: 12, color: '#d1fae5', cursor: 'pointer', borderBottom: '1px solid rgba(34,197,94,.12)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                        >
                          {m.slice(0, i)}<b style={{ color: '#4ade80' }}>{m.slice(i, i + q.length)}</b>{m.slice(i + q.length)}
                        </div>
                      )
                    })}
                  </div>
                )
              })()}
            </div>

            <select
              className="matrix-input"
              value={periodo}
              onChange={e =>
                setPeriodo(
                  e.target.value
                )
              }
            >
              <option value="15g">
                📅 Ultimi 15 giorni
              </option>

              <option value="1m">
                📅 Ultimo mese
              </option>

              <option value="3m">
                📅 Ultimi 3 mesi
              </option>

              <option value="tutto">
                📅 Tutto l'archivio
              </option>
            </select>

            <select
              className="matrix-input"
              value={canale}
              onChange={e =>
                setCanale(
                  e.target.value
                )
              }
            >
              <option value="TUTTI">
                📨 Email + SMS
              </option>

              <option value="EMAIL">
                📧 Solo Email
              </option>

              <option value="SMS">
                📱 Solo SMS
              </option>
            </select>

            <select
              className="matrix-input"
              value={f.giudizio}
              onChange={e =>
                setF({
                  ...f,
                  giudizio:
                    e.target.value,
                })
              }
            >
              <option value="">
                Tutti i giudizi
              </option>

              <option value="UTILE">
                UTILE
              </option>

              <option value="DA_VALUTARE">
                DA_VALUTARE
              </option>

              <option value="IGNORA">
                IGNORA
              </option>

              <option value="DA_ANALIZZARE">
                DA_ANALIZZARE
              </option>
            </select>

            <select
              className="matrix-input"
              value={f.categoria}
              onChange={e =>
                setF({
                  ...f,
                  categoria:
                    e.target.value,
                })
              }
            >
              <option value="">
                Tutte le categorie
              </option>

              <option>BONUS</option>
              <option>FREEBET</option>
              <option>CASHBACK</option>
              <option>PROMO_DEPOSITO</option>
              <option>PROMO_CASINO</option>
              <option>PROMO_SLOT</option>
              <option>PROMO_PERSONALIZZATA</option>
              <option>RIMBORSO</option>
              <option>KYC</option>
              <option>LIMITAZIONE</option>
              <option>SOSPENSIONE</option>
              <option>PRELIEVO</option>
              <option>DEPOSITO</option>
              <option>SICUREZZA</option>
              <option>SCADENZA</option>
              <option>NEWSLETTER</option>
              <option>PUBBLICITA</option>
              <option>ALTRO</option>
            </select>

            <select
              className="matrix-input"
              value={f.priorita}
              onChange={e =>
                setF({
                  ...f,
                  priorita:
                    e.target.value,
                })
              }
            >
              <option value="">
                Tutte le priorità
              </option>

              <option value="alta">
                alta
              </option>

              <option value="media">
                media
              </option>

              <option value="bassa">
                bassa
              </option>
            </select>
          </div>
        </section>

        {/* ==================================================
            TABELLA
            ================================================== */}

        <div
          className="
            overflow-x-auto
            rounded-xl
            border
            border-green-900/70
            bg-[#040a06]
            shadow-[0_0_30px_rgba(0,0,0,0.45)]
          "
        >
          <table
            className="
              w-full
              text-sm
            "
          >
            <thead>
              <tr
                className="
                  border-b
                  border-green-800/60
                  bg-[#08140c]
                  text-left
                  font-mono
                  text-xs
                  uppercase
                  tracking-wider
                  text-green-400
                "
              >
                <th className="p-3">
                  Canale
                </th>

                <th className="p-3">
                  Data
                </th>

                <th className="p-3">
                  Cliente
                </th>

                <th className="p-3">
                  Book
                </th>

                <th className="p-3">
                  Comunicazione
                </th>

                <th className="p-3">
                  Lucy
                </th>

                <th className="p-3">
                  Valore
                </th>

                <th className="p-3">
                  Analisi
                </th>

                <th className="p-3">
                  Azioni
                </th>
              </tr>
            </thead>

            <tbody>
              {loading && (
                <tr>
                  <td
                    className="
                      p-8
                      text-center
                      font-mono
                      text-green-400
                    "
                    colSpan={9}
                  >
                    &gt; Lucy sta
                    caricando i dati...
                  </td>
                </tr>
              )}

              {!loading &&
                rows.map(item => (
                  <tr
                    key={item.id}
                    className="
                      border-b
                      border-green-950
                      align-top
                      text-slate-300
                      transition
                      hover:bg-green-950/20
                    "
                  >
                    {/* CANALE */}

                    <td
                      className="
                        p-3
                        whitespace-nowrap
                      "
                    >
                      <span
                        className={`
                          inline-flex
                          rounded-full
                          border
                          px-2.5
                          py-1
                          text-xs
                          font-bold
                          ${
                            item.canale ===
                            'SMS'
                              ? `
                                border-violet-500/40
                                bg-violet-500/10
                                text-violet-300
                              `
                              : `
                                border-cyan-500/40
                                bg-cyan-500/10
                                text-cyan-300
                              `
                          }
                        `}
                      >
                        {item.canale ===
                        'SMS'
                          ? '📱 SMS'
                          : '📧 EMAIL'}
                      </span>
                    </td>

                    {/* DATA */}

                    <td
                      className="
                        p-3
                        whitespace-nowrap
                        text-slate-400
                      "
                    >
                      {formatDate(
                        item.data_mail
                      )}
                    </td>

                    {/* CLIENTE */}

                    <td
                      className="
                        p-3
                        font-semibold
                        text-slate-200
                      "
                    >
                      {item.cliente_nome ||
                        '-'}

                      {/* 07/10/2026 — se il cliente non è stato riconosciuto si vede almeno il destinatario */}
                      {!item.cliente_nome && item.destinatario_originale && (
                        <div
                          className="mt-1 max-w-[200px] break-all text-xs font-normal text-amber-300/80"
                          title="Cliente non riconosciuto: questo indirizzo non risulta tra le email dei clienti"
                        >
                          ⚠️ {item.destinatario_originale}
                        </div>
                      )}
                    </td>

                    {/* BOOK */}

                    <td
                      className="
                        p-3
                        whitespace-nowrap
                        text-green-300
                      "
                    >
                      {/* 07/10/2026 — il mittente si vede sempre, sotto il nome del book */}
                      <div className="font-semibold">
                        {item.bookmaker ||
                          item.mittente ||
                          '-'}
                      </div>

                      {item.bookmaker &&
                        item.mittente &&
                        item.mittente.trim().toLowerCase() !==
                          item.bookmaker.trim().toLowerCase() && (
                          <div
                            className="mt-1 max-w-[220px] truncate text-xs font-normal text-slate-500"
                            title={item.mittente}
                          >
                            ✉️ {item.mittente}
                          </div>
                        )}
                    </td>

                    {/* COMUNICAZIONE */}

                    <td
                      className="
                        p-3
                        min-w-[280px]
                      "
                    >
                      <button
                        onClick={() =>
                          apriComunicazione(
                            item
                          )
                        }
                        className="
                          text-left
                          font-semibold
                          text-green-300
                          hover:text-green-200
                          hover:underline
                        "
                      >
                        {item.canale ===
                          'SMS'
                          ? item.testo_completo
                              ?.slice(
                                0,
                                110
                              ) ||
                            'SMS'
                          : item.oggetto ||
                            '(senza oggetto)'}
                      </button>

                      <div className="mt-2">
                        <button
                          onClick={() =>
                            apriComunicazione(
                              item
                            )
                          }
                          className="
                            rounded-md
                            border
                            border-green-800
                            bg-green-950/30
                            px-2
                            py-1
                            text-xs
                            font-semibold
                            text-green-400
                            hover:border-green-500
                          "
                        >
                          {item.canale ===
                          'SMS'
                            ? '📱 Apri SMS'
                            : '📧 Apri email'}
                        </button>
                      </div>
                    </td>

                    {/* LUCY */}

                    <td
                      className="
                        p-3
                        min-w-[150px]
                      "
                    >
                      <div
                        className="
                          font-bold
                          text-green-300
                        "
                      >
                        {item.giudizio ||
                          '-'}
                      </div>

                      <div
                        className="
                          mt-1
                          text-xs
                          text-slate-400
                        "
                      >
                        {item.categoria ||
                          '-'}
                      </div>

                      <div
                        className={`
                          mt-1
                          text-xs
                          ${priorityClass(
                            item.priorita
                          )}
                        `}
                      >
                        {item.priorita ||
                          '-'}
                      </div>
                    </td>

                    {/* VALORE */}

                    <td
                      className="
                        p-3
                        min-w-[150px]
                      "
                    >
                      {item.bonus_importo !=
                        null && (
                        <div
                          className="
                            font-bold
                            text-green-400
                          "
                        >
                          + €
                          {
                            item.bonus_importo
                          }
                        </div>
                      )}

                      {item.deposito_richiesto !=
                        null && (
                        <div className="mt-1">
                          Deposito €
                          {
                            item.deposito_richiesto
                          }
                        </div>
                      )}

                      {item.rollover && !['null', 'none', 'nessuno', 'n/a', '-'].includes(String(item.rollover).trim().toLowerCase()) && (
                        <div
                          className="
                            mt-1
                            text-slate-400
                          "
                        >
                          Rollover:{' '}
                          {item.rollover}
                        </div>
                      )}

                      {item.scadenza && (
                        <div
                          className="
                            mt-1
                            font-semibold
                            text-amber-300
                          "
                        >
                          ⏰{' '}
                          {formatDate(
                            item.scadenza
                          )}
                        </div>
                      )}

                      {item.bonus_importo ==
                        null &&
                        item.deposito_richiesto ==
                          null &&
                        !item.rollover &&
                        !item.scadenza &&
                        '-'}
                    </td>

                    {/* ANALISI */}

                    <td
                      className="
                        p-3
                        min-w-[330px]
                        text-slate-300
                      "
                    >
                      <div>
                        {item.motivazione_ai ||
                          'In attesa di analisi'}
                      </div>

                      {item.condizioni && (
                        <div
                          className="
                            mt-2
                            text-xs
                            text-slate-500
                          "
                        >
                          {item.condizioni}
                        </div>
                      )}

                      {item.richiede_azione && (
                        <div
                          className="
                            mt-2
                            font-bold
                            text-red-400
                          "
                        >
                          ⚡ Richiede azione
                        </div>
                      )}
                    </td>

                    {/* AZIONI */}

                    <td
                      className="
                        p-3
                        min-w-[180px]
                      "
                    >
                      <div
                        className="
                          flex
                          flex-wrap
                          items-center
                          gap-2
                        "
                      >
                        <button
                          onClick={() => feedback(item, 'UTILE')}
                          className={`rounded-md border px-2 py-1 text-lg hover:opacity-100 ${
                            item.feedback_utente === 'UTILE'
                              ? 'border-green-400 bg-green-500/30 opacity-100 ring-2 ring-green-400'
                              : 'border-green-900 bg-black opacity-60 hover:border-green-500'
                          }`}
                          title="Classificazione corretta"
                        >
                          👍
                        </button>

                        <button
                          onClick={() => { setMotivoNo(''); setPannelloNo(pannelloNo === item.id ? null : item.id) }}
                          className={`rounded-md border px-2 py-1 text-lg hover:opacity-100 ${
                            item.feedback_utente === 'INUTILE'
                              ? 'border-red-400 bg-red-500/30 opacity-100 ring-2 ring-red-400'
                              : 'border-green-900 bg-black opacity-60 hover:border-green-500'
                          }`}
                          title="Classificazione errata"
                        >
                          👎
                        </button>

                        {item.feedback_utente && (
                          <span
                            className={`w-full text-xs font-semibold ${
                              item.feedback_utente === 'UTILE'
                                ? 'text-green-400'
                                : 'text-red-400'
                            }`}
                          >
                            ✓ Voto registrato:{' '}
                            {item.feedback_utente === 'UTILE'
                              ? 'corretta'
                              : etichettaDest(item.feedback_note)
                                ? 'doveva stare in ' + etichettaDest(item.feedback_note)
                                : 'errata'}
                            {item.feedback_utente !== 'UTILE' && motivoDaNota(item.feedback_note)
                              ? ' — ' + motivoDaNota(item.feedback_note)
                              : ''}
                          </span>
                        )}

                        {pannelloNo === item.id && (
                          <div className="w-full rounded-lg border border-red-500/40 bg-red-950/20 p-3">
                            <div className="mb-2 text-xs font-bold text-red-300">
                              Dove doveva andare? La mail verrà spostata lì
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {DESTINAZIONI.map(d => (
                                <button
                                  key={d.chiave}
                                  onClick={() =>
                                    feedback(
                                      item,
                                      'INUTILE',
                                      'DOVEVA_ESSERE=' + d.chiave +
                                        (motivoNo.trim() ? ' | ' + motivoNo.trim().replace(/\s+/g, ' ').slice(0, 160) : ''),
                                      d.chiave
                                    )
                                  }
                                  className="rounded-md border border-red-500/50 bg-black px-2 py-1 text-xs font-bold text-red-200 hover:bg-red-500/20"
                                >
                                  {d.etichetta}
                                </button>
                              ))}
                            </div>
                            <input
                              className="matrix-input mt-2 !py-1 text-xs"
                              placeholder="Perché? (facoltativo, aiuta Lucy a imparare)"
                              value={motivoNo}
                              maxLength={160}
                              onChange={e => setMotivoNo(e.target.value)}
                            />
                            <button
                              onClick={() => feedback(item, 'INUTILE', null)}
                              className="mt-2 text-xs text-slate-400 underline hover:text-slate-200"
                            >
                              Solo sbagliata, non so dove
                            </button>
                          </div>
                        )}

                        {/* 05/10/2026 · 📌 salva come promo da ricordare */}
                        <button
                          onClick={() => vaiAPromo(item)}
                          title="Salva nella tab Promo (dati già compilati)"
                          className="rounded-md border border-pink-500/50 bg-pink-500/10 px-3 py-1.5 text-xs font-bold text-pink-300 hover:bg-pink-500/20"
                        >
                          📌 Promo
                        </button>

                        {vista ===
                        'archiviate' ? (
                          <button
                            disabled={
                              savingId ===
                              item.id
                            }
                            onClick={() =>
                              cambiaArchivio(
                                item,
                                false
                              )
                            }
                            className="
                              rounded-md
                              border
                              border-violet-500/50
                              bg-violet-500/10
                              px-3
                              py-1.5
                              text-xs
                              font-bold
                              text-violet-300
                              hover:bg-violet-500/20
                              disabled:opacity-40
                            "
                          >
                            {savingId ===
                            item.id
                              ? '...'
                              : '↩ Ripristina'}
                          </button>
                        ) : (
                          <button
                            disabled={
                              savingId ===
                              item.id
                            }
                            onClick={() =>
                              cambiaArchivio(
                                item,
                                true
                              )
                            }
                            className="
                              rounded-md
                              border
                              border-green-500/50
                              bg-green-500/10
                              px-3
                              py-1.5
                              text-xs
                              font-bold
                              text-green-300
                              hover:bg-green-500/20
                              disabled:opacity-40
                            "
                          >
                            {savingId ===
                            item.id
                              ? '...'
                              : '✓ Archivia'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}

              {!loading &&
                rows.length === 0 && (
                  <tr>
                    <td
                      className="
                        p-10
                        text-center
                        font-mono
                        text-slate-500
                      "
                      colSpan={9}
                    >
                      {vista ===
                      'archiviate'
                        ? '> Nessuna comunicazione archiviata.'
                        : '> Nessuna comunicazione trovata.'}
                    </td>
                  </tr>
                )}
            </tbody>
          </table>
        </div>
      </main>

      {/* ==================================================
          MODAL
          ================================================== */}

      {comunicazioneAperta && (
        <div
          className="
            fixed
            inset-0
            z-50
            flex
            items-center
            justify-center
            bg-black/85
            p-4
            backdrop-blur-sm
          "
          onClick={() =>
            setComunicazioneAperta(
              null
            )
          }
        >
          <div
            className="
              flex
              max-h-[90vh]
              w-full
              max-w-5xl
              flex-col
              overflow-hidden
              rounded-2xl
              border
              border-green-500/50
              bg-[#030805]
              text-slate-200
              shadow-[0_0_50px_rgba(34,197,94,0.18)]
            "
            onClick={e =>
              e.stopPropagation()
            }
          >
            {/* MODAL HEADER */}

            <div
              className="
                flex
                items-start
                justify-between
                gap-4
                border-b
                border-green-900
                bg-[#07100a]
                p-5
              "
            >
              <div
                className="
                  flex
                  items-center
                  gap-4
                "
              >
                <img
                  src="/Lucy.png"
                  alt="Lucy"
                  className="
                    h-14
                    w-14
                    rounded-xl
                    border
                    border-green-400
                    object-cover
                    shadow-[0_0_18px_rgba(34,197,94,0.35)]
                  "
                />

                <div>
                  <div
                    className="
                      font-mono
                      text-xs
                      font-bold
                      text-green-400
                    "
                  >
                    {comunicazioneAperta.canale ===
                    'SMS'
                      ? '📱 SMS // LUCY'
                      : '📧 EMAIL // LUCY'}
                  </div>

                  <h2
                    className="
                      mt-1
                      text-xl
                      font-bold
                      text-slate-100
                    "
                  >
                    {comunicazioneAperta.canale ===
                    'SMS'
                      ? comunicazioneAperta.bookmaker ||
                        comunicazioneAperta.mittente ||
                        'SMS'
                      : comunicazioneAperta.oggetto ||
                        '(senza oggetto)'}
                  </h2>
                </div>
              </div>

              <button
                onClick={() =>
                  setComunicazioneAperta(
                    null
                  )
                }
                className="
                  rounded-lg
                  border
                  border-green-700
                  bg-black
                  px-4
                  py-2
                  font-bold
                  text-green-300
                  hover:bg-green-950
                "
              >
                ✕
              </button>
            </div>

            {/* MODAL BODY */}

            <div
              className="
                overflow-y-auto
                p-6
              "
            >
              <div
                className="
                  mb-5
                  grid
                  gap-3
                  rounded-xl
                  border
                  border-green-900
                  bg-[#07100a]
                  p-4
                  text-sm
                  md:grid-cols-2
                "
              >
                <div>
                  <strong className="text-green-400">
                    Canale:
                  </strong>{' '}
                  {comunicazioneAperta.canale ===
                  'SMS'
                    ? '📱 SMS'
                    : '📧 Email'}
                </div>

                <div>
                  <strong className="text-green-400">
                    Cliente:
                  </strong>{' '}
                  {comunicazioneAperta.cliente_nome ||
                    '-'}
                </div>

                <div>
                  <strong className="text-green-400">
                    Book:
                  </strong>{' '}
                  {comunicazioneAperta.bookmaker ||
                    '-'}
                </div>

                <div>
                  <strong className="text-green-400">
                    Mittente:
                  </strong>{' '}
                  {comunicazioneAperta.mittente ||
                    '-'}
                </div>

                {comunicazioneAperta.canale ===
                  'EMAIL' && (
                  <div>
                    <strong className="text-green-400">
                      A:
                    </strong>{' '}
                    {comunicazioneAperta.destinatario_originale ||
                      '-'}
                  </div>
                )}

                <div>
                  <strong className="text-green-400">
                    Data:
                  </strong>{' '}
                  {formatDate(
                    comunicazioneAperta.data_mail
                  )}
                </div>
              </div>

              {/* ANALISI */}

              <div
                className="
                  mb-5
                  rounded-xl
                  border
                  border-green-500/40
                  bg-green-950/20
                  p-5
                "
              >
                <div
                  className="
                    mb-4
                    flex
                    items-center
                    gap-3
                    flex-wrap
                  "
                >
                  <div
                    className="
                      font-mono
                      font-black
                      tracking-wider
                      text-green-400
                    "
                  >
                    &gt; ANALISI LUCY
                  </div>

                  <span
                    className="
                      rounded-full
                      border
                      border-green-700
                      bg-black
                      px-2
                      py-1
                      text-xs
                      text-green-300
                    "
                  >
                    {comunicazioneAperta.giudizio ||
                      'DA_ANALIZZARE'}
                  </span>

                  {comunicazioneAperta.archiviata && (
                    <span
                      className="
                        rounded-full
                        border
                        border-violet-600
                        bg-violet-950/40
                        px-2
                        py-1
                        text-xs
                        font-bold
                        text-violet-300
                      "
                    >
                      📦 ARCHIVIATA
                    </span>
                  )}
                </div>

                <div
                  className="
                    text-lg
                    text-slate-200
                  "
                >
                  {comunicazioneAperta.motivazione_ai ||
                    'Analisi non ancora disponibile.'}
                </div>

                <div
                  className="
                    mt-4
                    flex
                    flex-wrap
                    gap-3
                  "
                >
                  {comunicazioneAperta.bonus_importo !=
                    null && (
                    <span
                      className="
                        rounded-lg
                        border
                        border-green-500/50
                        bg-green-500/10
                        px-3
                        py-2
                        font-bold
                        text-green-300
                      "
                    >
                      💰 Bonus €
                      {
                        comunicazioneAperta.bonus_importo
                      }
                    </span>
                  )}

                  {comunicazioneAperta.deposito_richiesto !=
                    null && (
                    <span
                      className="
                        rounded-lg
                        border
                        border-slate-700
                        bg-black
                        px-3
                        py-2
                      "
                    >
                      💳 Deposito €
                      {
                        comunicazioneAperta.deposito_richiesto
                      }
                    </span>
                  )}

                  {comunicazioneAperta.rollover && (
                    <span
                      className="
                        rounded-lg
                        border
                        border-slate-700
                        bg-black
                        px-3
                        py-2
                      "
                    >
                      🔁{' '}
                      {
                        comunicazioneAperta.rollover
                      }
                    </span>
                  )}

                  {comunicazioneAperta.scadenza && (
                    <span
                      className="
                        rounded-lg
                        border
                        border-amber-500/50
                        bg-amber-500/10
                        px-3
                        py-2
                        font-semibold
                        text-amber-300
                      "
                    >
                      ⏰{' '}
                      {formatDate(
                        comunicazioneAperta.scadenza
                      )}
                    </span>
                  )}
                </div>

                {comunicazioneAperta.condizioni && (
                  <div
                    className="
                      mt-4
                      border-t
                      border-green-900
                      pt-4
                      text-slate-400
                    "
                  >
                    <strong className="text-green-400">
                      Condizioni:
                    </strong>{' '}
                    {
                      comunicazioneAperta.condizioni
                    }
                  </div>
                )}

                {comunicazioneAperta.richiede_azione && (
                  <div
                    className="
                      mt-4
                      font-bold
                      text-red-400
                    "
                  >
                    ⚡ RICHIEDE AZIONE
                  </div>
                )}
              </div>

              {/* TESTO ORIGINALE */}

              <div>
                {(() => {
                  const isSms = comunicazioneAperta.canale === 'SMS'
                  const originale = comunicazioneAperta.testo_completo || ''
                  const pulito = isSms ? { testo: originale, link: 0 } : pulisciTesto(originale)
                  const mostraPulito = !isSms && !mostraOriginale
                  return (
                    <>
                      <div className="mb-3 flex flex-wrap items-center gap-3 font-mono font-bold text-green-400">
                        <span>
                          &gt; {isSms ? 'TESTO SMS' : mostraPulito ? 'TESTO DELLA MAIL' : 'MESSAGGIO ORIGINALE'}
                        </span>

                        {!isSms && (
                          <button
                            onClick={() => setMostraOriginale(v => !v)}
                            className="rounded-md border border-green-800 bg-green-950/30 px-2 py-1 text-xs font-semibold text-green-300 hover:border-green-500"
                          >
                            {mostraPulito ? 'Mostra originale' : 'Mostra testo pulito'}
                          </button>
                        )}

                        {mostraPulito && pulito.link > 0 && (
                          <span className="text-xs font-normal text-slate-500">
                            {pulito.link} link di tracciamento nascosti (🔗) · nell'originale ci sono tutti
                          </span>
                        )}
                      </div>

                      <div
                        className="
                          whitespace-pre-wrap
                          break-words
                          rounded-xl
                          border
                          border-green-900
                          bg-black
                          p-5
                          font-mono
                          text-sm
                          leading-relaxed
                          text-slate-300
                        "
                      >
                        {(mostraPulito ? pulito.testo : originale) ||
                          'Testo non disponibile.'}
                      </div>
                    </>
                  )
                })()}
              </div>
            </div>

            {/* MODAL FOOTER */}

            <div
              className="
                flex
                flex-wrap
                items-center
                justify-between
                gap-3
                border-t
                border-green-900
                bg-[#07100a]
                p-4
              "
            >
              <div
                className="
                  font-mono
                  text-xs
                  text-green-700
                "
              >
                LUCY // ARCHIVE SYSTEM
              </div>

              <div
                className="
                  flex
                  flex-wrap
                  gap-2
                "
              >
                {/* 05/10/2026 · 📌 salva come promo da ricordare */}
                <button
                  onClick={() => vaiAPromo(comunicazioneAperta)}
                  title="Salva nella tab Promo (dati già compilati)"
                  className="rounded-lg border border-pink-500/50 bg-pink-500/10 px-4 py-2 text-sm font-bold text-pink-300 hover:bg-pink-500/20"
                >
                  📌 Salva in Promo
                </button>

                {comunicazioneAperta.archiviata ? (
                  <button
                    disabled={
                      savingId ===
                      comunicazioneAperta.id
                    }
                    onClick={() =>
                      cambiaArchivio(
                        comunicazioneAperta,
                        false
                      )
                    }
                    className="
                      rounded-lg
                      border
                      border-violet-500
                      bg-violet-500/10
                      px-5
                      py-2
                      font-bold
                      text-violet-300
                      hover:bg-violet-500/20
                      disabled:opacity-40
                    "
                  >
                    {savingId ===
                    comunicazioneAperta.id
                      ? '...'
                      : '↩ Ripristina'}
                  </button>
                ) : (
                  <button
                    disabled={
                      savingId ===
                      comunicazioneAperta.id
                    }
                    onClick={() =>
                      cambiaArchivio(
                        comunicazioneAperta,
                        true
                      )
                    }
                    className="
                      rounded-lg
                      border
                      border-green-500
                      bg-green-500/10
                      px-5
                      py-2
                      font-bold
                      text-green-300
                      hover:bg-green-500/20
                      disabled:opacity-40
                    "
                  >
                    {savingId ===
                    comunicazioneAperta.id
                      ? '...'
                      : '✓ Archivia'}
                  </button>
                )}

                <button
                  onClick={() =>
                    setComunicazioneAperta(
                      null
                    )
                  }
                  className="
                    rounded-lg
                    bg-green-500
                    px-5
                    py-2
                    font-bold
                    text-black
                    hover:bg-green-400
                  "
                >
                  Chiudi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================
          STYLE
          ================================================== */}

      {mostraSu && !comunicazioneAperta && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          title="Torna in cima"
          aria-label="Torna in cima"
          className="fixed bottom-24 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-green-500 text-2xl font-black text-white shadow-[0_0_22px_rgba(34,197,94,0.55)] transition hover:scale-105 hover:bg-green-400"
        >
          ↑
        </button>
      )}

      {avviso && (
        <div
          className={`fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-xl border px-5 py-3 text-sm font-bold shadow-2xl ${
            avviso.ok
              ? 'border-green-400 bg-[#04120a] text-green-300'
              : 'border-red-400 bg-[#1a0606] text-red-300'
          }`}
        >
          {avviso.testo}
        </div>
      )}

      <style>{`
        @keyframes lucyMatrixRain {
          0% {
            transform: translateY(-75%);
          }

          100% {
            transform: translateY(20%);
          }
        }

        .matrix-column {
          animation-name: lucyMatrixRain;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
          text-shadow: 0 0 5px rgba(34, 197, 94, 0.85);
        }

        .matrix-input {
          width: 100%;
          border: 1px solid rgba(22, 101, 52, 0.85);
          border-radius: 0.5rem;
          background-color: #020604;
          color: #d1fae5;
          padding: 0.6rem 0.75rem;
          outline: none;
        }

        .matrix-input:focus {
          border-color: #22c55e;
        }

        .matrix-input::placeholder {
          color: #64748b;
        }

        .matrix-input option {
          background-color: #020604;
          color: #d1fae5;
        }
      `}</style>
    </div>
  )
}
