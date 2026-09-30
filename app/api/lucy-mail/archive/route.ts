'use client'

import {
  useCallback,
  useEffect,
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

  /*
   * Default: ultimo mese.
   */
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

  /*
   * =======================================================
   * CARICAMENTO
   * =======================================================
   */

  const load =
    useCallback(async () => {
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

        const r =
          await fetch(
            '/api/lucy-mail/archive?' +
              p.toString(),
            {
              cache: 'no-store',
            }
          )

        const j =
          await r.json()

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
      } finally {
        setLoading(false)
      }
    }, [
      f,
      vista,
      periodo,
      canale,
    ])

  useEffect(() => {
    load()
  }, [load])

  /*
   * =======================================================
   * FEEDBACK
   * =======================================================
   */

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

  /*
   * =======================================================
   * APERTURA COMUNICAZIONE
   * =======================================================
   */

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

  /*
   * =======================================================
   * CAMBIO VISTA
   * =======================================================
   */

  function cambiaVista(
    nuovaVista: Vista
  ) {
    setVista(nuovaVista)

    /*
     * Manteniamo periodo e canale.
     * Reset solo dei filtri specifici.
     */
    setF({
      q: '',
      cliente: '',
      bookmaker: '',
      giudizio: '',
      categoria: '',
      priorita: '',
    })
  }

  /*
   * =======================================================
   * CLASSI
   * =======================================================
   */

  function tabClass(
    key: Vista
  ) {
    const active =
      vista === key

    return `
      border
      border-sky-200
      rounded-xl
      px-4
      py-3
      text-left
      transition
      ${
        active
          ? 'bg-slate-900 text-white shadow-md border-slate-900'
          : 'bg-white text-slate-900 hover:bg-sky-50'
      }
    `
  }

  function priorityClass(
    priority: string | null
  ) {
    if (priority === 'alta') {
      return 'text-red-600 font-bold'
    }

    if (priority === 'media') {
      return 'text-orange-600 font-semibold'
    }

    return 'text-gray-500'
  }

  /*
   * =======================================================
   * DATA
   * =======================================================
   */

  function formatDate(
    value: string | null
  ) {
    if (!value) {
      return '-'
    }

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

  /*
   * =======================================================
   * RENDER
   * =======================================================
   */

  return (
    <div
      className="
        min-h-screen
        bg-sky-50
        text-slate-900
      "
    >
      <main
        className="
          p-6
          max-w-[1800px]
          mx-auto
        "
      >
        {/* HEADER */}

        <div
          className="
            flex
            flex-wrap
            items-center
            justify-between
            gap-4
            mb-6
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
                w-20
                h-20
                object-cover
                rounded-2xl
                shadow-lg
                border
                border-cyan-300
              "
            />

            <div>
              <h1
                className="
                  text-3xl
                  font-bold
                "
              >
                Lucy
              </h1>

              <p
                className="
                  text-slate-600
                  mt-1
                "
              >
                Opportunità e
                comunicazioni dai tuoi
                account
              </p>

              <div
                className="
                  text-xs
                  font-semibold
                  text-cyan-700
                  mt-1
                "
              >
                ● AI OPERATIVA
              </div>
            </div>
          </div>

          <div
            className="
              flex
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
                border
                border-sky-300
                rounded-lg
                px-4
                py-2
                bg-sky-600
                hover:bg-sky-700
                text-white
                font-semibold
                shadow-sm
              "
            >
              🏠 Dashboard
            </button>

            <button
              onClick={load}
              className="
                border
                border-sky-200
                rounded-lg
                px-4
                py-2
                bg-white
                hover:bg-sky-50
                text-slate-900
                font-semibold
              "
            >
              🔄 Aggiorna
            </button>
          </div>
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
            <div className="text-xl font-bold">
              🔥 {counters.opportunita}
            </div>
            <div>Opportunità</div>
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
            <div className="text-xl font-bold">
              ⚠️ {counters.da_valutare}
            </div>
            <div>Da valutare</div>
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
            <div className="text-xl font-bold">
              🚨 {counters.problemi}
            </div>
            <div>Problemi</div>
          </button>

          <button
            className={
              tabClass('ignora')
            }
            onClick={() =>
              cambiaVista('ignora')
            }
          >
            <div className="text-xl font-bold">
              ⚪ {counters.ignora}
            </div>
            <div>Ignora</div>
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
            <div className="text-xl font-bold">
              ⏳ {counters.da_analizzare}
            </div>
            <div>Da analizzare</div>
          </button>

          <button
            className={
              tabClass('tutte')
            }
            onClick={() =>
              cambiaVista('tutte')
            }
          >
            <div className="text-xl font-bold">
              📚 {counters.tutte}
            </div>
            <div>Tutte</div>
          </button>
        </div>

        {/* RIEPILOGO */}

        <div
          className="
            mb-3
            flex
            flex-wrap
            items-center
            gap-3
            font-semibold
            text-slate-700
          "
        >
          <span>
            {count}{' '}
            {count === 1
              ? 'comunicazione'
              : 'comunicazioni'}
          </span>

          <span
            className="
              text-xs
              bg-white
              border
              border-sky-200
              rounded-full
              px-3
              py-1
            "
          >
            {canale === 'EMAIL'
              ? '📧 Email'
              : canale === 'SMS'
                ? '📱 SMS'
                : '📨 Email + SMS'}
          </span>
        </div>

        {/* FILTRI */}

        <div
          className="
            grid
            md:grid-cols-2
            xl:grid-cols-4
            2xl:grid-cols-8
            gap-2
            mb-5
          "
        >
          {/* CERCA */}

          <input
            className="
              border
              border-sky-200
              rounded-lg
              px-3
              py-2
              bg-white
              text-black
              w-full
            "
            placeholder="Cerca testo..."
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
            className="
              border
              border-sky-200
              rounded-lg
              px-3
              py-2
              bg-white
              text-black
            "
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
              Tutti i clienti
            </option>

            {clienti.map(cliente => (
              <option
                key={cliente}
                value={cliente}
              >
                {cliente}
              </option>
            ))}
          </select>

          {/* BOOKMAKER */}

          <input
            className="
              border
              border-sky-200
              rounded-lg
              px-3
              py-2
              bg-white
              text-black
              w-full
            "
            placeholder="Bookmaker"
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
            className="
              border
              border-sky-200
              rounded-lg
              px-3
              py-2
              bg-white
              text-black
              font-semibold
            "
            value={periodo}
            onChange={e =>
              setPeriodo(
                e.target.value
              )
            }
          >
            <option value="15g">
              Ultimi 15 giorni
            </option>

            <option value="1m">
              Ultimo mese
            </option>

            <option value="3m">
              Ultimi 3 mesi
            </option>

            <option value="tutto">
              Tutto l'archivio
            </option>
          </select>

          {/* CANALE */}

          <select
            className="
              border
              border-sky-200
              rounded-lg
              px-3
              py-2
              bg-white
              text-black
              font-semibold
            "
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

          {/* GIUDIZIO */}

          <select
            className="
              border
              border-sky-200
              rounded-lg
              px-3
              py-2
              bg-white
              text-black
            "
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

          {/* CATEGORIA */}

          <select
            className="
              border
              border-sky-200
              rounded-lg
              px-3
              py-2
              bg-white
              text-black
            "
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

          {/* PRIORITÀ */}

          <select
            className="
              border
              border-sky-200
              rounded-lg
              px-3
              py-2
              bg-white
              text-black
            "
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

        {/* TABELLA */}

        <div
          className="
            overflow-x-auto
            border
            border-sky-200
            rounded-xl
            bg-white/90
            shadow-sm
          "
        >
          <table
            className="
              w-full
              text-sm
              text-black
            "
          >
            <thead>
              <tr
                className="
                  text-left
                  border-b
                  border-sky-200
                  bg-sky-100
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
                  Dettagli
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
                    className="p-5"
                    colSpan={9}
                  >
                    Lucy sta caricando…
                  </td>
                </tr>
              )}

              {!loading &&
                rows.map(item => (
                  <tr
                    key={item.id}
                    className="
                      border-b
                      border-sky-100
                      align-top
                      hover:bg-sky-50
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
                          items-center
                          rounded-full
                          px-2
                          py-1
                          text-xs
                          font-bold
                          ${
                            item.canale ===
                            'SMS'
                              ? 'bg-violet-100 text-violet-800'
                              : 'bg-blue-100 text-blue-800'
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
                        font-medium
                      "
                    >
                      {item.cliente_nome ||
                        '-'}
                    </td>

                    {/* BOOK */}

                    <td
                      className="
                        p-3
                        whitespace-nowrap
                      "
                    >
                      {item.bookmaker ||
                        item.mittente ||
                        '-'}
                    </td>

                    {/* COMUNICAZIONE */}

                    <td
                      className="
                        p-3
                        min-w-[260px]
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
                          text-blue-700
                          hover:text-blue-900
                          hover:underline
                        "
                      >
                        {item.canale ===
                          'SMS'
                          ? item.testo_completo
                              ?.slice(
                                0,
                                90
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
                            text-xs
                            bg-sky-100
                            hover:bg-sky-200
                            text-sky-800
                            px-2
                            py-1
                            rounded-md
                            font-semibold
                          "
                        >
                          {item.canale ===
                          'SMS'
                            ? '📱 Apri SMS'
                            : '📩 Apri email'}
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
                      <div className="font-bold">
                        {item.giudizio}
                      </div>

                      <div>
                        {item.categoria}
                      </div>

                      <div
                        className={
                          priorityClass(
                            item.priorita
                          )
                        }
                      >
                        {item.priorita}
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
                            text-green-700
                          "
                        >
                          Bonus €
                          {
                            item.bonus_importo
                          }
                        </div>
                      )}

                      {item.deposito_richiesto !=
                        null && (
                        <div>
                          Deposito €
                          {
                            item.deposito_richiesto
                          }
                        </div>
                      )}

                      {item.rollover && (
                        <div>
                          Rollover:{' '}
                          {item.rollover}
                        </div>
                      )}

                      {item.scadenza && (
                        <div
                          className="
                            mt-1
                            font-semibold
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

                    {/* DETTAGLI */}

                    <td
                      className="
                        p-3
                        min-w-[320px]
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
                            text-gray-600
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
                            text-red-600
                          "
                        >
                          ⚡ Richiede azione
                        </div>
                      )}
                    </td>

                    {/* FEEDBACK */}

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
                        "
                        title="Lucy ha classificato bene"
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
                        className="text-lg"
                        title="Lucy ha sbagliato"
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
                      className="p-6"
                      colSpan={9}
                    >
                      Nessuna
                      comunicazione in
                      questa sezione.
                    </td>
                  </tr>
                )}
            </tbody>
          </table>
        </div>
      </main>

      {/* ===============================================
          MODAL EMAIL / SMS
          =============================================== */}

      {comunicazioneAperta && (
        <div
          className="
            fixed
            inset-0
            z-50
            bg-black/60
            flex
            items-center
            justify-center
            p-4
          "
          onClick={() =>
            setComunicazioneAperta(
              null
            )
          }
        >
          <div
            className="
              bg-white
              text-slate-900
              rounded-2xl
              shadow-2xl
              w-full
              max-w-5xl
              max-h-[90vh]
              overflow-hidden
              flex
              flex-col
            "
            onClick={e =>
              e.stopPropagation()
            }
          >
            {/* HEADER MODAL */}

            <div
              className="
                bg-sky-100
                border-b
                border-sky-200
                p-5
                flex
                justify-between
                items-start
                gap-4
              "
            >
              <div>
                <div
                  className="
                    text-sm
                    text-sky-700
                    font-bold
                    mb-1
                  "
                >
                  {comunicazioneAperta.canale ===
                  'SMS'
                    ? '📱 SMS'
                    : '📧 EMAIL'}
                </div>

                <h2
                  className="
                    text-xl
                    font-bold
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

              <button
                onClick={() =>
                  setComunicazioneAperta(
                    null
                  )
                }
                className="
                  bg-slate-900
                  hover:bg-black
                  text-white
                  rounded-lg
                  px-4
                  py-2
                  font-bold
                  whitespace-nowrap
                "
              >
                ✕ Chiudi
              </button>
            </div>

            {/* CONTENUTO */}

            <div
              className="
                overflow-y-auto
                p-6
              "
            >
              {/* DATI */}

              <div
                className="
                  grid
                  md:grid-cols-2
                  gap-3
                  bg-slate-50
                  border
                  rounded-xl
                  p-4
                  mb-5
                  text-sm
                "
              >
                <div>
                  <strong>
                    Canale:
                  </strong>{' '}
                  {comunicazioneAperta.canale ===
                  'SMS'
                    ? '📱 SMS'
                    : '📧 Email'}
                </div>

                <div>
                  <strong>
                    Cliente:
                  </strong>{' '}
                  {comunicazioneAperta.cliente_nome ||
                    '-'}
                </div>

                <div>
                  <strong>
                    Book:
                  </strong>{' '}
                  {comunicazioneAperta.bookmaker ||
                    '-'}
                </div>

                <div>
                  <strong>
                    Mittente:
                  </strong>{' '}
                  {comunicazioneAperta.mittente ||
                    '-'}
                </div>

                {comunicazioneAperta.canale ===
                  'EMAIL' && (
                  <div>
                    <strong>A:</strong>{' '}
                    {comunicazioneAperta.destinatario_originale ||
                      '-'}
                  </div>
                )}

                <div>
                  <strong>
                    Data:
                  </strong>{' '}
                  {formatDate(
                    comunicazioneAperta.data_mail
                  )}
                </div>

                <div>
                  <strong>
                    Priorità:
                  </strong>{' '}
                  <span
                    className={
                      priorityClass(
                        comunicazioneAperta.priorita
                      )
                    }
                  >
                    {comunicazioneAperta.priorita ||
                      '-'}
                  </span>
                </div>
              </div>

              {/* ANALISI LUCY */}

              <div
                className="
                  bg-blue-50
                  border
                  border-blue-200
                  rounded-xl
                  p-4
                  mb-5
                "
              >
                <div
                  className="
                    flex
                    items-center
                    gap-3
                    mb-3
                  "
                >
                  <img
                    src="/Lucy.png"
                    alt="Lucy"
                    className="
                      w-11
                      h-11
                      object-cover
                      rounded-lg
                      border
                      border-cyan-300
                    "
                  />

                  <div
                    className="
                      font-bold
                      text-blue-900
                    "
                  >
                    Analisi Lucy
                  </div>
                </div>

                <div className="mb-2">
                  <strong>
                    {comunicazioneAperta.giudizio ||
                      'DA_ANALIZZARE'}
                  </strong>

                  {' · '}

                  {comunicazioneAperta.categoria ||
                    '-'}
                </div>

                {comunicazioneAperta.motivazione_ai && (
                  <div className="mb-3">
                    {
                      comunicazioneAperta.motivazione_ai
                    }
                  </div>
                )}

                <div
                  className="
                    flex
                    flex-wrap
                    gap-4
                    text-sm
                  "
                >
                  {comunicazioneAperta.bonus_importo !=
                    null && (
                    <div
                      className="
                        font-bold
                        text-green-700
                      "
                    >
                      💰 Bonus €
                      {
                        comunicazioneAperta.bonus_importo
                      }
                    </div>
                  )}

                  {comunicazioneAperta.deposito_richiesto !=
                    null && (
                    <div>
                      💳 Deposito €
                      {
                        comunicazioneAperta.deposito_richiesto
                      }
                    </div>
                  )}

                  {comunicazioneAperta.rollover && (
                    <div>
                      🔁 Rollover:{' '}
                      {
                        comunicazioneAperta.rollover
                      }
                    </div>
                  )}

                  {comunicazioneAperta.scadenza && (
                    <div
                      className="
                        font-semibold
                        text-red-700
                      "
                    >
                      ⏰ Scadenza:{' '}
                      {formatDate(
                        comunicazioneAperta.scadenza
                      )}
                    </div>
                  )}
                </div>

                {comunicazioneAperta.condizioni && (
                  <div
                    className="
                      mt-3
                      pt-3
                      border-t
                      border-blue-200
                    "
                  >
                    <strong>
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
                      mt-3
                      font-bold
                      text-red-600
                    "
                  >
                    ⚡ Questa
                    comunicazione
                    richiede un'azione.
                  </div>
                )}
              </div>

              {/* TESTO ORIGINALE */}

              <div>
                <div
                  className="
                    font-bold
                    text-lg
                    mb-3
                  "
                >
                  {comunicazioneAperta.canale ===
                  'SMS'
                    ? '📱 Testo SMS'
                    : '✉️ Testo originale'}
                </div>

                <div
                  className="
                    border
                    border-slate-200
                    bg-white
                    rounded-xl
                    p-5
                    whitespace-pre-wrap
                    break-words
                    leading-relaxed
                    text-sm
                  "
                >
                  {comunicazioneAperta.testo_completo ||
                    'Testo non disponibile.'}
                </div>
              </div>
            </div>

            {/* FOOTER */}

            <div
              className="
                border-t
                bg-slate-50
                p-4
                flex
                justify-between
                items-center
                gap-3
              "
            >
              <div
                className="
                  text-sm
                  text-slate-500
                "
              >
                {comunicazioneAperta.canale ===
                'SMS'
                  ? 'SMS archiviato da Lucy'
                  : 'Email archiviata da Lucy'}
              </div>

              <button
                onClick={() =>
                  setComunicazioneAperta(
                    null
                  )
                }
                className="
                  bg-sky-600
                  hover:bg-sky-700
                  text-white
                  rounded-lg
                  px-5
                  py-2
                  font-bold
                "
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
