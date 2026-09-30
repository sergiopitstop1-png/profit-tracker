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
  motivazione_ai: string | null
  bonus_importo: number | null
  deposito_richiesto: number | null
  rollover: string | null
  scadenza: string | null
  condizioni: string | null
  richiede_azione: boolean | null
  feedback_utente: string | null
}

type Counters = {
  tutte: number
  opportunita: number
  da_valutare: number
  problemi: number
  ignora: number
  da_analizzare: number
}

type Vista =
  | 'opportunita'
  | 'da_valutare'
  | 'problemi'
  | 'ignora'
  | 'da_analizzare'
  | 'tutte'

const emptyCounters: Counters = {
  tutte: 0,
  opportunita: 0,
  da_valutare: 0,
  problemi: 0,
  ignora: 0,
  da_analizzare: 0,
}

const matrixColumns = [
  '010010110101001101001011',
  '101101001011010010110100',
  '001011010110010101101001',
  '110100101101001011010010',
  '010110100101101001011010',
  '101001011010010110100101',
  '011010010110100101101001',
  '100101101001011010010110',
  '001101001011010010110100',
  '110010110100101101001011',
  '010010110101001101001011',
  '101101001011010010110100',
  '001011010110010101101001',
  '110100101101001011010010',
  '010110100101101001011010',
  '101001011010010110100101',
  '011010010110100101101001',
  '100101101001011010010110',
]

export default function ArchivioLucyPage() {
  const router = useRouter()

  const [rows, setRows] =
    useState<Comunicazione[]>([])

  const [count, setCount] =
    useState(0)

  const [counters, setCounters] =
    useState<Counters>(emptyCounters)

  const [clienti, setClienti] =
    useState<string[]>([])

  const [loading, setLoading] =
    useState(false)

  const [
    comunicazioneAperta,
    setComunicazioneAperta,
  ] = useState<Comunicazione | null>(null)

  const [vista, setVista] =
    useState<Vista>('opportunita')

  const [periodo, setPeriodo] =
    useState('1m')

  const [canale, setCanale] =
    useState('TUTTI')

  const [f, setF] =
    useState({
      q: '',
      cliente: '',
      bookmaker: '',
      giudizio: '',
      categoria: '',
      priorita: '',
    })

  const load = useCallback(
    async () => {
      setLoading(true)

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
      } catch (error) {
        console.error(
          '[Lucy Archive]',
          error
        )
      } finally {
        setLoading(false)
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

  async function feedback(
    item: Comunicazione,
    value: string
  ) {
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
          feedback_utente:
            value,
        }),
      }
    )

    load()
  }

  async function apriComunicazione(
    item: Comunicazione
  ) {
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
        {/* MATRIX RAIN - SOLO HEADER */}

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
              bg-[radial-gradient(circle_at_center,rgba(22,163,74,0.12),transparent_65%)]
            "
          />

          <div
            className="
              absolute
              inset-0
              flex
              justify-around
              opacity-30
            "
          >
            {matrixColumns.map(
              (digits, index) => (
                <div
                  key={index}
                  className="
                    matrix-column
                    font-mono
                    text-[12px]
                    leading-[15px]
                    text-green-400
                    whitespace-pre-wrap
                    break-all
                    w-[18px]
                    text-center
                  "
                  style={{
                    animationDuration:
                      `${
                        7 +
                        (index % 6) *
                          1.3
                      }s`,
                    animationDelay:
                      `-${
                        (index % 8) *
                        1.1
                      }s`,
                  }}
                >
                  {digits
                    .repeat(5)
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
              from-black/95
              via-black/55
              to-black/90
            "
          />

          <div
            className="
              absolute
              inset-x-0
              bottom-0
              h-24
              bg-gradient-to-b
              from-transparent
              to-[#020604]
            "
          />
        </div>

        {/* CONTENUTO HEADER */}

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
              onClick={load}
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
          CONTENUTO OPERATIVO
          ================================================== */}

      <main
        className="
          max-w-[1800px]
          mx-auto
          px-6
          py-6
        "
      >
        {/* MOBILE BUTTONS */}

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
            onClick={load}
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

        {/* CONTATORI */}

        <div
          className="
            grid
            grid-cols-2
            md:grid-cols-3
            xl:grid-cols-6
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
        </div>

        {/* FILTRI */}

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
              className="
                matrix-input
              "
              placeholder="🔎 Cerca..."
              value={f.q}
              onChange={e =>
                setF({
                  ...f,
                  q: e.target.value,
                })
              }
            />

            {/* CLIENTE */}

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

            <input
              className="matrix-input"
              placeholder="🎰 Bookmaker"
              value={f.bookmaker}
              onChange={e =>
                setF({
                  ...f,
                  bookmaker:
                    e.target.value,
                })
              }
            />

            {/* PERIODO */}

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

            {/* CANALE */}

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

              <option>UTILE</option>
              <option>DA_VALUTARE</option>
              <option>IGNORA</option>
              <option>DA_ANALIZZARE</option>
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

              <option>alta</option>
              <option>media</option>
              <option>bassa</option>
            </select>
          </div>
        </section>

        {/* TABELLA */}

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
                  Feedback
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
                    analizzando i dati...
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

                    <td
                      className="
                        p-3
                        font-semibold
                        text-slate-200
                      "
                    >
                      {item.cliente_nome ||
                        '-'}
                    </td>

                    <td
                      className="
                        p-3
                        whitespace-nowrap
                        text-green-300
                      "
                    >
                      {item.bookmaker ||
                        item.mittente ||
                        '-'}
                    </td>

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

                      {item.rollover && (
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

                    <td
                      className="
                        p-3
                        whitespace-nowrap
                      "
                    >
                      <button
                        onClick={() =>
                          feedback(
                            item,
                            'UTILE'
                          )
                        }
                        className="
                          mr-3
                          text-lg
                          opacity-80
                          hover:opacity-100
                        "
                        title="Classificazione corretta"
                      >
                        👍
                      </button>

                      <button
                        onClick={() =>
                          feedback(
                            item,
                            'INUTILE'
                          )
                        }
                        className="
                          text-lg
                          opacity-80
                          hover:opacity-100
                        "
                        title="Classificazione errata"
                      >
                        👎
                      </button>
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
                      &gt; Nessuna
                      comunicazione trovata.
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
                    {
                      comunicazioneAperta.giudizio ||
                      'DA_ANALIZZARE'
                    }
                  </span>
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

              {/* TESTO */}

              <div>
                <div
                  className="
                    mb-3
                    font-mono
                    font-bold
                    text-green-400
                  "
                >
                  &gt;{' '}
                  {comunicazioneAperta.canale ===
                  'SMS'
                    ? 'TESTO SMS'
                    : 'MESSAGGIO ORIGINALE'}
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
                  {comunicazioneAperta.testo_completo ||
                    'Testo non disponibile.'}
                </div>
              </div>
            </div>

            {/* MODAL FOOTER */}

            <div
              className="
                flex
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
