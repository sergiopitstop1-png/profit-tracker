'use client'

import {
  useCallback,
  useEffect,
  useState,
} from 'react'

import { useRouter } from 'next/navigation'


type Mail = {
  id: number
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
    useState<Mail[]>([])

  const [count, setCount] =
    useState(0)

  const [counters, setCounters] =
    useState<Counters>(
      emptyCounters
    )

  const [loading, setLoading] =
    useState(false)

  const [mailAperta, setMailAperta] =
    useState<Mail | null>(null)

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
   * APERTURA MAIL
   * =======================================================
   */

  async function apriMail(
    mail: Mail
  ) {

    setMailAperta(mail)

    /*
     * Segniamo la mail come letta.
     */

    try {

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
              id: mail.id,
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

    setVista(
      nuovaVista
    )

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
        border-sky-200
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

      value={
        f[key]
      }

      onChange={
        e =>
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
   * PULSANTI VISTA
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


  /*
   * =======================================================
   * PRIORITÀ
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
          max-w-[1700px]
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
                text-slate-600
                mt-1
              "
            >
              Opportunità e comunicazioni
              dai tuoi account
            </p>

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
            className={tabClass('opportunita')}
            onClick={() =>
              cambiaVista('opportunita')
            }
          >
            <div className="text-xl font-bold">
              🔥 {counters.opportunita}
            </div>

            <div>
              Opportunità
            </div>
          </button>


          <button
            className={tabClass('da_valutare')}
            onClick={() =>
              cambiaVista('da_valutare')
            }
          >
            <div className="text-xl font-bold">
              ⚠️ {counters.da_valutare}
            </div>

            <div>
              Da valutare
            </div>
          </button>


          <button
            className={tabClass('problemi')}
            onClick={() =>
              cambiaVista('problemi')
            }
          >
            <div className="text-xl font-bold">
              🚨 {counters.problemi}
            </div>

            <div>
              Problemi
            </div>
          </button>


          <button
            className={tabClass('ignora')}
            onClick={() =>
              cambiaVista('ignora')
            }
          >
            <div className="text-xl font-bold">
              ⚪ {counters.ignora}
            </div>

            <div>
              Ignora
            </div>
          </button>


          <button
            className={tabClass('da_analizzare')}
            onClick={() =>
              cambiaVista('da_analizzare')
            }
          >
            <div className="text-xl font-bold">
              ⏳ {counters.da_analizzare}
            </div>

            <div>
              Da analizzare
            </div>
          </button>


          <button
            className={tabClass('tutte')}
            onClick={() =>
              cambiaVista('tutte')
            }
          >
            <div className="text-xl font-bold">
              📚 {counters.tutte}
            </div>

            <div>
              Tutte
            </div>
          </button>

        </div>


        <div
          className="
            mb-3
            font-semibold
            text-slate-700
          "
        >
          {count} mail
        </div>


        {/* FILTRI */}

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
                    Lucy sta caricando…
                  </td>

                </tr>

              )}


              {!loading &&
                rows.map(
                  mail => (

                    <tr
                      key={mail.id}
                      className="
                        border-b
                        border-sky-100
                        align-top
                        hover:bg-sky-50
                      "
                    >

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


                      <td
                        className="
                          p-3
                          font-medium
                        "
                      >
                        {
                          mail.cliente_nome ||
                          '-'
                        }
                      </td>


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


                      {/* OGGETTO CLICCABILE */}

                      <td
                        className="
                          p-3
                          min-w-[260px]
                        "
                      >

                        <button
                          onClick={() =>
                            apriMail(mail)
                          }
                          className="
                            text-left
                            font-semibold
                            text-blue-700
                            hover:text-blue-900
                            hover:underline
                          "
                          title="Apri la mail"
                        >
                          {
                            mail.oggetto ||
                            '(senza oggetto)'
                          }
                        </button>

                        <div className="mt-2">

                          <button
                            onClick={() =>
                              apriMail(mail)
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
                            📩 Apri mail
                          </button>

                        </div>

                      </td>


                      <td
                        className="
                          p-3
                          min-w-[150px]
                        "
                      >

                        <div className="font-bold">
                          {mail.giudizio}
                        </div>

                        <div>
                          {mail.categoria}
                        </div>

                        <div
                          className={
                            priorityClass(
                              mail.priorita
                            )
                          }
                        >
                          {mail.priorita}
                        </div>

                      </td>


                      <td
                        className="
                          p-3
                          min-w-[150px]
                        "
                      >

                        {
                          mail.bonus_importo != null && (

                            <div
                              className="
                                font-bold
                                text-green-700
                              "
                            >
                              Bonus €{mail.bonus_importo}
                            </div>

                          )
                        }


                        {
                          mail.deposito_richiesto != null && (

                            <div>
                              Deposito €{mail.deposito_richiesto}
                            </div>

                          )
                        }


                        {
                          mail.rollover && (

                            <div>
                              Rollover: {mail.rollover}
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
                              ⏰ {formatDate(mail.scadenza)}
                            </div>

                          )
                        }


                        {
                          mail.bonus_importo == null &&
                          mail.deposito_richiesto == null &&
                          !mail.rollover &&
                          !mail.scadenza &&
                          '-'
                        }

                      </td>


                      <td
                        className="
                          p-3
                          min-w-[320px]
                        "
                      >

                        <div>
                          {
                            mail.motivazione_ai ||
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
                              {mail.condizioni}
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
                              ⚡ Richiede azione
                            </div>

                          )
                        }

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
                rows.length === 0 && (

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


      {/* ===================================================
          MODAL LETTURA MAIL
          =================================================== */}

      {mailAperta && (

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
            setMailAperta(null)
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
                  📩 MAIL
                </div>

                <h2
                  className="
                    text-xl
                    font-bold
                  "
                >
                  {
                    mailAperta.oggetto ||
                    '(senza oggetto)'
                  }
                </h2>

              </div>


              <button
                onClick={() =>
                  setMailAperta(null)
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


            {/* CONTENUTO SCORREVOLE */}

            <div
              className="
                overflow-y-auto
                p-6
              "
            >

              {/* DATI MAIL */}

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
                  <strong>Cliente:</strong>{' '}
                  {
                    mailAperta.cliente_nome ||
                    '-'
                  }
                </div>

                <div>
                  <strong>Book:</strong>{' '}
                  {
                    mailAperta.bookmaker ||
                    '-'
                  }
                </div>

                <div>
                  <strong>Da:</strong>{' '}
                  {
                    mailAperta.mittente ||
                    '-'
                  }
                </div>

                <div>
                  <strong>A:</strong>{' '}
                  {
                    mailAperta.destinatario_originale ||
                    '-'
                  }
                </div>

                <div>
                  <strong>Data:</strong>{' '}
                  {
                    formatDate(
                      mailAperta.data_mail
                    )
                  }
                </div>

                <div>
                  <strong>Priorità:</strong>{' '}

                  <span
                    className={
                      priorityClass(
                        mailAperta.priorita
                      )
                    }
                  >
                    {
                      mailAperta.priorita ||
                      '-'
                    }
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
                    font-bold
                    text-blue-900
                    mb-2
                  "
                >
                  🧠 Analisi Lucy
                </div>

                <div className="mb-2">
                  <strong>
                    {
                      mailAperta.giudizio ||
                      'DA_ANALIZZARE'
                    }
                  </strong>

                  {' · '}

                  {
                    mailAperta.categoria ||
                    '-'
                  }
                </div>


                {
                  mailAperta.motivazione_ai && (

                    <div className="mb-3">
                      {
                        mailAperta.motivazione_ai
                      }
                    </div>

                  )
                }


                <div
                  className="
                    flex
                    flex-wrap
                    gap-4
                    text-sm
                  "
                >

                  {
                    mailAperta.bonus_importo != null && (

                      <div
                        className="
                          font-bold
                          text-green-700
                        "
                      >
                        💰 Bonus €
                        {
                          mailAperta.bonus_importo
                        }
                      </div>

                    )
                  }


                  {
                    mailAperta.deposito_richiesto != null && (

                      <div>
                        💳 Deposito €
                        {
                          mailAperta.deposito_richiesto
                        }
                      </div>

                    )
                  }


                  {
                    mailAperta.rollover && (

                      <div>
                        🔁 Rollover:{' '}
                        {
                          mailAperta.rollover
                        }
                      </div>

                    )
                  }


                  {
                    mailAperta.scadenza && (

                      <div
                        className="
                          font-semibold
                          text-red-700
                        "
                      >
                        ⏰ Scadenza:{' '}
                        {
                          formatDate(
                            mailAperta.scadenza
                          )
                        }
                      </div>

                    )
                  }

                </div>


                {
                  mailAperta.condizioni && (

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
                        mailAperta.condizioni
                      }
                    </div>

                  )
                }


                {
                  mailAperta.richiede_azione && (

                    <div
                      className="
                        mt-3
                        font-bold
                        text-red-600
                      "
                    >
                      ⚡ Questa comunicazione
                      richiede un'azione.
                    </div>

                  )
                }

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
                  ✉️ Testo originale
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
                  {
                    mailAperta.testo_completo ||
                    'Testo della mail non disponibile.'
                  }
                </div>

              </div>

            </div>


            {/* FOOTER MODAL */}

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
                Mail archiviata da Lucy
              </div>


              <button
                onClick={() =>
                  setMailAperta(null)
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
