'use client'

import {
  useCallback,
  useEffect,
  useState,
} from 'react'


type Mail = {
  id: number
  data_mail: string | null
  cliente_nome: string | null
  bookmaker: string | null
  mittente: string | null
  oggetto: string | null
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
  const [rows, setRows] =
    useState<Mail[]>([])

  const [count, setCount] =
    useState(0)

  const [counters, setCounters] =
    useState<Counters>(
      emptyCounters
    )

  const [loading, setLoading] =
    useState(false)

  /*
   * Apriamo Lucy direttamente
   * sulle opportunità.
   */
  const [vista, setVista] =
    useState<Vista>(
      'opportunita'
    )

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
    useCallback(
      async () => {
        setLoading(true)

        try {
          const p =
            new URLSearchParams()

          if (
            vista !==
            'tutte'
          ) {
            p.set(
              'vista',
              vista
            )
          }

          Object.entries(
            f
          ).forEach(
            ([key, value]) => {
              if (value) {
                p.set(
                  key,
                  value
                )
              }
            }
          )

          p.set(
            'page_size',
            '100'
          )

          const r =
            await fetch(
              '/api/lucy-mail/archive?' +
                p.toString(),
              {
                cache:
                  'no-store',
              }
            )

          const j =
            await r.json()

          setRows(
            j.data || []
          )

          setCount(
            j.count || 0
          )

          setCounters(
            j.counters ||
              emptyCounters
          )
        } finally {
          setLoading(false)
        }
      },
      [
        f,
        vista,
      ]
    )


  useEffect(() => {
    load()
  }, [load])


  /*
   * =======================================================
   * FEEDBACK
   * =======================================================
   */

  async function feedback(
    id: number,
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

        body:
          JSON.stringify({
            id,
            feedback_utente:
              value,
          }),
      }
    )

    load()
  }


  /*
   * =======================================================
   * CAMBIO VISTA
   * =======================================================
   */

  function cambiaVista(
    nuovaVista: Vista
  ) {
    setVista(
      nuovaVista
    )

    /*
     * Quando cambiamo
     * sezione azzeriamo
     * i filtri avanzati.
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
   * INPUT
   * =======================================================
   */

  const field = (
    key: keyof typeof f,
    placeholder: string
  ) => (
    <input
      className="
        border
        rounded-lg
        px-3
        py-2
        bg-white
        text-black
        w-full
      "
      placeholder={
        placeholder
      }
      value={f[key]}
      onChange={e =>
        setF({
          ...f,
          [key]:
            e.target.value,
        })
      }
    />
  )


  /*
   * =======================================================
   * STILE PULSANTI VISTA
   * =======================================================
   */

  function tabClass(
    key: Vista
  ) {
    const active =
      vista === key

    return `
      border
      rounded-xl
      px-4
      py-3
      text-left
      transition
      ${
        active
          ? 'bg-black text-white shadow-md'
          : 'bg-white text-black hover:bg-gray-50'
      }
    `
  }


  /*
   * =======================================================
   * COLORI PRIORITÀ
   * =======================================================
   */

  function priorityClass(
    priority:
      string | null
  ) {
    if (
      priority === 'alta'
    ) {
      return (
        'text-red-600 font-bold'
      )
    }

    if (
      priority === 'media'
    ) {
      return (
        'text-orange-600 font-semibold'
      )
    }

    return (
      'text-gray-500'
    )
  }


  /*
   * =======================================================
   * FORMATO DATA
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

    return date
      .toLocaleString(
        'it-IT'
      )
  }


  /*
   * =======================================================
   * RENDER
   * =======================================================
   */

  return (
    <main
      className="
        p-6
        max-w-[1700px]
        mx-auto
      "
    >

      {/* HEADER */}

      <div
        className="
          flex
          flex-wrap
          items-end
          justify-between
          gap-4
          mb-6
        "
      >
        <div>
          <h1
            className="
              text-3xl
              font-bold
            "
          >
            🧠 Lucy
          </h1>

          <p
            className="
              opacity-70
              mt-1
            "
          >
            Opportunità e
            comunicazioni dai
            tuoi account
          </p>
        </div>

        <button
          onClick={load}
          className="
            border
            rounded-lg
            px-4
            py-2
            bg-white
            text-black
          "
        >
          🔄 Aggiorna
        </button>
      </div>


      {/* ===================================================
          DASHBOARD
          =================================================== */}

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
              text-xl
              font-bold
            "
          >
            🔥 {
              counters
                .opportunita
            }
          </div>

          <div>
            Opportunità
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
              text-xl
              font-bold
            "
          >
            ⚠️ {
              counters
                .da_valutare
            }
          </div>

          <div>
            Da valutare
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
              text-xl
              font-bold
            "
          >
            🚨 {
              counters
                .problemi
            }
          </div>

          <div>
            Problemi
          </div>
        </button>


        <button
          className={
            tabClass(
              'ignora'
            )
          }
          onClick={() =>
            cambiaVista(
              'ignora'
            )
          }
        >
          <div
            className="
              text-xl
              font-bold
            "
          >
            ⚪ {
              counters
                .ignora
            }
          </div>

          <div>
            Ignora
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
              text-xl
              font-bold
            "
          >
            ⏳ {
              counters
                .da_analizzare
            }
          </div>

          <div>
            Da analizzare
          </div>
        </button>


        <button
          className={
            tabClass(
              'tutte'
            )
          }
          onClick={() =>
            cambiaVista(
              'tutte'
            )
          }
        >
          <div
            className="
              text-xl
              font-bold
            "
          >
            📚 {
              counters
                .tutte
            }
          </div>

          <div>
            Tutte
          </div>
        </button>

      </div>


      {/* RISULTATI */}

      <div
        className="
          mb-3
          font-semibold
        "
      >
        {count}{' '}
        {
          count === 1
            ? 'mail'
            : 'mail'
        }
      </div>


      {/* ===================================================
          FILTRI
          =================================================== */}

      <div
        className="
          grid
          md:grid-cols-3
          xl:grid-cols-6
          gap-2
          mb-5
        "
      >

        {field(
          'q',
          'Cerca testo...'
        )}

        {field(
          'cliente',
          'Cliente'
        )}

        {field(
          'bookmaker',
          'Bookmaker'
        )}


        <select
          className="
            border
            rounded-lg
            px-3
            py-2
            bg-white
            text-black
          "
          value={
            f.giudizio
          }
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

          <option>
            UTILE
          </option>

          <option>
            DA_VALUTARE
          </option>

          <option>
            IGNORA
          </option>

          <option>
            DA_ANALIZZARE
          </option>
        </select>


        <select
          className="
            border
            rounded-lg
            px-3
            py-2
            bg-white
            text-black
          "
          value={
            f.categoria
          }
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

          <option>
            BONUS
          </option>

          <option>
            FREEBET
          </option>

          <option>
            CASHBACK
          </option>

          <option>
            PROMO_DEPOSITO
          </option>

          <option>
            PROMO_CASINO
          </option>

          <option>
            PROMO_SLOT
          </option>

          <option>
            PROMO_PERSONALIZZATA
          </option>

          <option>
            RIMBORSO
          </option>

          <option>
            KYC
          </option>

          <option>
            LIMITAZIONE
          </option>

          <option>
            SOSPENSIONE
          </option>

          <option>
            PRELIEVO
          </option>

          <option>
            DEPOSITO
          </option>

          <option>
            SICUREZZA
          </option>

          <option>
            SCADENZA
          </option>

          <option>
            NEWSLETTER
          </option>

          <option>
            PUBBLICITA
          </option>

          <option>
            ALTRO
          </option>
        </select>


        <select
          className="
            border
            rounded-lg
            px-3
            py-2
            bg-white
            text-black
          "
          value={
            f.priorita
          }
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

          <option>
            alta
          </option>

          <option>
            media
          </option>

          <option>
            bassa
          </option>
        </select>

      </div>


      {/* ===================================================
          TABELLA
          =================================================== */}

      <div
        className="
          overflow-x-auto
          border
          rounded-xl
          bg-white
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
                bg-gray-50
              "
            >
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
                Oggetto
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
                  colSpan={8}
                >
                  Lucy sta
                  caricando…
                </td>
              </tr>
            )}


            {!loading &&
              rows.map(
                mail => (
                  <tr
                    key={
                      mail.id
                    }
                    className="
                      border-b
                      align-top
                      hover:bg-gray-50
                    "
                  >

                    {/* DATA */}

                    <td
                      className="
                        p-3
                        whitespace-nowrap
                      "
                    >
                      {
                        formatDate(
                          mail.data_mail
                        )
                      }
                    </td>


                    {/* CLIENTE */}

                    <td
                      className="
                        p-3
                        font-medium
                      "
                    >
                      {
                        mail
                          .cliente_nome ||
                        '-'
                      }
                    </td>


                    {/* BOOK */}

                    <td
                      className="
                        p-3
                        whitespace-nowrap
                      "
                    >
                      {
                        mail.bookmaker ||
                        mail.mittente ||
                        '-'
                      }
                    </td>


                    {/* OGGETTO */}

                    <td
                      className="
                        p-3
                        min-w-[240px]
                      "
                    >
                      {
                        mail.oggetto ||
                        '(senza oggetto)'
                      }
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
                        "
                      >
                        {
                          mail.giudizio
                        }
                      </div>

                      <div>
                        {
                          mail.categoria
                        }
                      </div>

                      <div
                        className={
                          priorityClass(
                            mail.priorita
                          )
                        }
                      >
                        {
                          mail.priorita
                        }
                      </div>
                    </td>


                    {/* VALORE */}

                    <td
                      className="
                        p-3
                        min-w-[150px]
                      "
                    >

                      {
                        mail.bonus_importo !=
                          null && (
                          <div
                            className="
                              font-bold
                              text-green-700
                            "
                          >
                            Bonus €
                            {
                              mail
                                .bonus_importo
                            }
                          </div>
                        )
                      }


                      {
                        mail.deposito_richiesto !=
                          null && (
                          <div>
                            Deposito €
                            {
                              mail
                                .deposito_richiesto
                            }
                          </div>
                        )
                      }


                      {
                        mail.rollover && (
                          <div>
                            Rollover:{' '}
                            {
                              mail.rollover
                            }
                          </div>
                        )
                      }


                      {
                        mail.scadenza && (
                          <div
                            className="
                              mt-1
                              font-semibold
                            "
                          >
                            ⏰{' '}
                            {
                              formatDate(
                                mail.scadenza
                              )
                            }
                          </div>
                        )
                      }


                      {
                        mail.bonus_importo ==
                          null &&
                        mail.deposito_richiesto ==
                          null &&
                        !mail.rollover &&
                        !mail.scadenza &&
                        '-'
                      }

                    </td>


                    {/* DETTAGLI */}

                    <td
                      className="
                        p-3
                        min-w-[320px]
                      "
                    >

                      <div>
                        {
                          mail
                            .motivazione_ai ||
                          'In attesa di analisi'
                        }
                      </div>


                      {
                        mail.condizioni && (
                          <div
                            className="
                              mt-2
                              text-gray-600
                            "
                          >
                            {
                              mail
                                .condizioni
                            }
                          </div>
                        )
                      }


                      {
                        mail.richiede_azione && (
                          <div
                            className="
                              mt-2
                              font-bold
                              text-red-600
                            "
                          >
                            ⚡ Richiede
                            azione
                          </div>
                        )
                      }

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
                            mail.id,
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
                            mail.id,
                            'INUTILE'
                          )
                        }
                        className="
                          text-lg
                        "
                        title="Lucy ha sbagliato"
                      >
                        👎
                      </button>

                    </td>

                  </tr>
                )
              )}


            {!loading &&
              rows.length ===
                0 && (
                <tr>
                  <td
                    className="p-6"
                    colSpan={8}
                  >
                    Nessuna mail
                    in questa sezione.
                  </td>
                </tr>
              )}

          </tbody>

        </table>

      </div>

    </main>
  )
}
