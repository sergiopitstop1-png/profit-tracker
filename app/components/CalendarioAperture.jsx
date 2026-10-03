'use client'

import React, { useEffect, useMemo, useState } from 'react'

const GIORNI = [
  'Domenica',
  'Lunedì',
  'Martedì',
  'Mercoledì',
  'Giovedì',
  'Venerdì',
  'Sabato'
]

const iso = d =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const addDays = (s, n) => {
  const [y, m, d] = s.split('-').map(Number)
  const dt = new Date(y, m - 1, d + n)
  return iso(dt)
}

const weekday = s => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d).getDay()
}

const today = () => iso(new Date())

const box = {
  background: '#111b30',
  border: '1px solid #30435e',
  borderRadius: 10,
  padding: 12,
  marginBottom: 12,
  color: '#e2e8f0'
}

const btn = {
  padding: '7px 12px',
  borderRadius: 7,
  border: '1px solid #5281a5',
  background: '#203955',
  color: '#fff',
  cursor: 'pointer'
}

const btnAperto = {
  padding: '7px 12px',
  borderRadius: 7,
  border: '1px solid rgba(34,197,94,0.5)',
  background: 'rgba(34,197,94,0.12)',
  color: '#22c55e',
  cursor: 'pointer',
  fontWeight: 800
}

const field = {
  background: '#0b1424',
  color: '#fff',
  border: '1px solid #476079',
  padding: 7,
  borderRadius: 6
}

export default function CalendarioAperture({
  supabase,
  matrice = [],
  onSegnaAperto
}) {

  const [regole, setRegole] = useState(Array(7).fill(0))
  const [eccezioni, setEccezioni] = useState({})
  const [piano, setPiano] = useState({})
  const [date, setDate] = useState(today())
  const [override, setOverride] = useState('0')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [filtro, setFiltro] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [aperturaInCorso, setAperturaInCorso] = useState(null)

  // =====================================================
  // MATRICE = FONTE DELLA VERITÀ
  // =====================================================

  const daAprire = useMemo(
    () => matrice.filter(r => r.stato === 'DA APRIRE'),
    [matrice]
  )

  const aperti = useMemo(
    () => matrice.filter(r => r.stato === 'APERTO'),
    [matrice]
  )

  // =====================================================
  // CARICAMENTO CALENDARIO
  // =====================================================

  async function refresh() {
    setBusy(true)

    try {
      const [a, b, c] = await Promise.all([
        supabase
          .from('calendario_aperture_regole')
          .select('*'),

        supabase
          .from('calendario_aperture_eccezioni')
          .select('*'),

        supabase
          .from('calendario_aperture_piano')
          .select('*')
          .range(0, 2999)
      ])

      for (const r of [a, b, c]) {
        if (r.error) throw r.error
      }

      const v = Array(7).fill(0)

      a.data.forEach(r => {
        v[r.giorno] = r.quantita
      })

      setRegole(v)

      setEccezioni(
        Object.fromEntries(
          b.data.map(r => [r.data, r])
        )
      )

      setPiano(
        Object.fromEntries(
          c.data.map(r => [
            String(r.matrice_id),
            r
          ])
        )
      )

      setLoaded(true)

    } catch (e) {
      setMsg(
        'Errore caricamento: ' +
        (e?.message || String(e))
      )
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  useEffect(() => {
    setOverride(
      String(
        eccezioni[date]?.quantita ??
        regole[weekday(date)] ??
        0
      )
    )
  }, [date, eccezioni, regole])

  // =====================================================
  // REGOLE SETTIMANALI
  // =====================================================

  async function salvaRegole() {
    setBusy(true)

    try {
      const { error } = await supabase
        .from('calendario_aperture_regole')
        .upsert(
          regole.map((quantita, giorno) => ({
            giorno,
            quantita,
            aggiornato_il:
              new Date().toISOString()
          }))
        )

      if (error) throw error

      setMsg(
        'Regole salvate. Premi Ricalcola per applicarle alle aperture future.'
      )

    } catch (e) {
      setMsg(
        'Errore: ' +
        (e?.message || String(e))
      )
    } finally {
      setBusy(false)
    }
  }

  // =====================================================
  // ECCEZIONI SINGOLA DATA
  // =====================================================

  async function salvaEccezione() {
    setBusy(true)

    try {
      const q = Number(override)

      if (
        !Number.isInteger(q) ||
        q < 0 ||
        q > 500
      ) {
        throw Error(
          'Inserisci una quantità da 0 a 500'
        )
      }

      const { error } = await supabase
        .from('calendario_aperture_eccezioni')
        .upsert({
          data: date,
          quantita: q,
          aggiornato_il:
            new Date().toISOString()
        })

      if (error) throw error

      setEccezioni(old => ({
        ...old,
        [date]: {
          data: date,
          quantita: q
        }
      }))

      setMsg(
        'Eccezione salvata. Premi Ricalcola per aggiornare il piano.'
      )

    } catch (e) {
      setMsg(
        'Errore: ' +
        (e?.message || String(e))
      )
    } finally {
      setBusy(false)
    }
  }

  async function togliEccezione() {
    setBusy(true)

    try {
      const { error } = await supabase
        .from('calendario_aperture_eccezioni')
        .delete()
        .eq('data', date)

      if (error) throw error

      setEccezioni(old => {
        const x = { ...old }
        delete x[date]
        return x
      })

      setMsg(
        'Eccezione eliminata. Premi Ricalcola per aggiornare il calendario.'
      )

    } catch (e) {
      setMsg(
        'Errore: ' +
        (e?.message || String(e))
      )
    } finally {
      setBusy(false)
    }
  }

  // =====================================================
  // RICALCOLO CALENDARIO
  //
  // REGOLE:
  //
  // 1. La Matrice decide quali book sono DA APRIRE.
  //
  // 2. Il cliente con PIÙ book DA APRIRE ha precedenza.
  //
  // 3. Una volta iniziato un cliente, tutte le sue
  //    aperture automatiche vengono pianificate
  //    consecutivamente prima di passare al successivo.
  //
  // 4. A parità di aperture, ordine alfabetico cliente.
  //
  // 5. Dentro lo stesso cliente, ordine bookmaker.
  //
  // 6. Le aperture fissate manualmente NON vengono
  //    spostate dal ricalcolo.
  //
  // 7. I book segnati APERTO direttamente dalla Matrice
  //    non entrano più nella pianificazione.
  // =====================================================

  async function ricalcola() {

    if (
      !window.confirm(
        'Ricalcolare tutte le aperture future non fissate? ' +
        'Il cliente con più book mancanti avrà precedenza e verrà completato prima di passare al successivo. ' +
        'Le aperture fissate manualmente resteranno nelle loro date.'
      )
    ) {
      return
    }

    setBusy(true)

    try {
      const start = today()

      // -----------------------------------------------
      // Raggruppamento per cliente
      // -----------------------------------------------

      const clientiMap = {}

      daAprire.forEach(r => {
        const cliente =
          r.cliente || 'Senza cliente'

        if (!clientiMap[cliente]) {
          clientiMap[cliente] = []
        }

        clientiMap[cliente].push(r)
      })

      // -----------------------------------------------
      // Ordine clienti:
      // prima chi ha più DA APRIRE.
      // A parità -> alfabetico.
      // -----------------------------------------------

      const clientiOrdinati =
        Object.entries(clientiMap)
          .sort(
            (
              [clienteA, righeA],
              [clienteB, righeB]
            ) => {

              if (
                righeB.length !==
                righeA.length
              ) {
                return (
                  righeB.length -
                  righeA.length
                )
              }

              return String(
                clienteA
              ).localeCompare(
                String(clienteB),
                'it'
              )
            }
          )

      // -----------------------------------------------
      // Costruiamo la coda automatica.
      //
      // Tutti i book del primo cliente,
      // poi tutti quelli del secondo, ecc.
      //
      // Le righe fissate manualmente vengono escluse
      // perché devono restare dove sono.
      // -----------------------------------------------

      const rows = []

      clientiOrdinati.forEach(
        ([cliente, righeCliente]) => {

          const automatiche =
            righeCliente
              .filter(
                r =>
                  !piano[String(r.id)]
                    ?.bloccata
              )
              .sort((a, b) => {

                const prioritaA =
                  piano[String(a.id)]
                    ?.priorita || 0

                const prioritaB =
                  piano[String(b.id)]
                    ?.priorita || 0

                if (
                  prioritaB !== prioritaA
                ) {
                  return (
                    prioritaB -
                    prioritaA
                  )
                }

                return String(
                  a.bookmaker
                ).localeCompare(
                  String(b.bookmaker),
                  'it'
                )
              })

          rows.push(...automatiche)
        }
      )

      // -----------------------------------------------
      // Contiamo gli slot già occupati
      // dalle aperture fissate.
      // -----------------------------------------------

      const fixed = {}

      daAprire.forEach(r => {
        const p =
          piano[String(r.id)]

        if (
          p?.bloccata &&
          p.data_prevista &&
          p.data_prevista >= start
        ) {
          fixed[p.data_prevista] =
            (fixed[p.data_prevista] || 0) +
            1
        }
      })

      // -----------------------------------------------
      // Distribuzione nelle date
      // -----------------------------------------------

      let i = 0
      const updates = []

      for (
        let n = 0;
        n < 3660 && i < rows.length;
        n++
      ) {

        const day =
          addDays(start, n)

        const quota =
          eccezioni[day]?.quantita ??
          regole[weekday(day)] ??
          0

        const slots =
          Math.max(
            0,
            quota -
            (fixed[day] || 0)
          )

        for (
          let j = 0;
          j < slots &&
          i < rows.length;
          j++
        ) {

          const r = rows[i]

          const old =
            piano[String(r.id)]

          updates.push({
            matrice_id: r.id,
            data_prevista: day,
            bloccata: false,
            priorita:
              old?.priorita || 0,
            aggiornato_il:
              new Date().toISOString()
          })

          i++
        }
      }

      if (i < rows.length) {
        throw Error(
          'Capienza insufficiente: imposta almeno un giorno della settimana con un numero di aperture maggiore di zero.'
        )
      }

      // -----------------------------------------------
      // Salvataggio a blocchi
      // -----------------------------------------------

      for (
        let k = 0;
        k < updates.length;
        k += 150
      ) {

        const { error } =
          await supabase
            .from(
              'calendario_aperture_piano'
            )
            .upsert(
              updates.slice(k, k + 150)
            )

        if (error) throw error
      }

      setMsg(
        `✅ Calendario ricalcolato: ${updates.length} aperture automatiche pianificate. Priorità ai clienti con più book da aprire.`
      )

      await refresh()

    } catch (e) {

      setMsg(
        'Ricalcolo non completato: ' +
        (e?.message || String(e))
      )

    } finally {
      setBusy(false)
    }
  }

  // =====================================================
  // MODIFICA MANUALE / FISSA APERTURA
  // =====================================================

  async function cambiaSingola(
    r,
    nuovaData,
    locked = true
  ) {

    setBusy(true)

    try {
      const old =
        piano[String(r.id)] || {}

      const { error } =
        await supabase
          .from(
            'calendario_aperture_piano'
          )
          .upsert({
            matrice_id: r.id,
            data_prevista:
              nuovaData || null,
            bloccata: locked,
            priorita:
              old.priorita || 0,
            rinvii:
              (old.rinvii || 0) +
              (locked ? 1 : 0),
            nota:
              old.nota || null,
            aggiornato_il:
              new Date().toISOString()
          })

      if (error) throw error

      await refresh()

      setMsg(
        locked
          ? '🔒 Apertura fissata. I prossimi ricalcoli non la sposteranno.'
          : '🔓 Apertura sbloccata. Il prossimo ricalcolo potrà spostarla.'
      )

    } catch (e) {

      setMsg(
        'Errore: ' +
        (e?.message || String(e))
      )

    } finally {
      setBusy(false)
    }
  }

  // =====================================================
  // SEGNA APERTO
  // =====================================================

  async function segnaAperto(r) {

    if (!onSegnaAperto) {
      setMsg(
        'Funzione Segna aperto non collegata al ProfitTracker.'
      )
      return
    }

    setAperturaInCorso(r.id)

    try {
      const ok =
        await onSegnaAperto(r)

      if (!ok) return

      /*
       * NON cancelliamo il record del piano.
       *
       * La Matrice passa ad APERTO.
       * Quindi questa riga sparisce automaticamente
       * dalla lista DA APRIRE.
       *
       * Il record calendario rimane come traccia
       * della pianificazione originaria.
       */

      setMsg(
        `✅ ${r.bookmaker} — ${r.cliente} segnato come APERTO`
      )

    } catch (e) {

      setMsg(
        'Errore apertura: ' +
        (e?.message || String(e))
      )

    } finally {
      setAperturaInCorso(null)
    }
  }

  // =====================================================
  // ELENCO APERTURE
  // =====================================================

  const schedule = useMemo(
    () =>
      daAprire
        .filter(
          r =>
            !filtro ||
            `${r.cliente} ${r.bookmaker}`
              .toLowerCase()
              .includes(
                filtro.toLowerCase()
              )
        )
        .sort((a, b) => {

          const dataA =
            piano[String(a.id)]
              ?.data_prevista ||
            '9999'

          const dataB =
            piano[String(b.id)]
              ?.data_prevista ||
            '9999'

          const confrontoData =
            String(dataA)
              .localeCompare(
                String(dataB)
              )

          if (confrontoData !== 0) {
            return confrontoData
          }

          const confrontoCliente =
            String(a.cliente)
              .localeCompare(
                String(b.cliente),
                'it'
              )

          if (
            confrontoCliente !== 0
          ) {
            return confrontoCliente
          }

          return String(
            a.bookmaker
          ).localeCompare(
            String(b.bookmaker),
            'it'
          )
        }),
    [
      daAprire,
      piano,
      filtro
    ]
  )

  const scheduled =
    schedule.filter(
      r =>
        piano[String(r.id)]
          ?.data_prevista
    )

  // Compatibilità anche con browser senza Object.groupBy
  const groups =
    scheduled.reduce(
      (o, r) => {

        const d =
          piano[String(r.id)]
            .data_prevista

        if (!o[d]) {
          o[d] = []
        }

        o[d].push(r)

        return o
      },
      {}
    )

  // =====================================================
  // INTERFACCIA
  // =====================================================

  return (
    <div
      style={{
        color: '#e2e8f0'
      }}
    >

      {/* TESTATA */}

      <div style={box}>

        <strong>
          📅 Calendario aperture
        </strong>

        <p>
          {daAprire.length}
          {' '}da aprire
          {' · '}
          {aperti.length}
          {' '}aperti
          {' · '}
          {scheduled.length}
          {' '}programmati
        </p>

        {!loaded &&
          'Caricamento...'}

        {msg && (
          <p
            role="status"
            style={{
              color: '#93c5fd',
              marginBottom: 0
            }}
          >
            {msg}
          </p>
        )}

      </div>

      {/* SETTIMANA TIPO */}

      <div style={box}>

        <h3>
          Settimana tipo
        </h3>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 12
          }}
        >

          {[1, 2, 3, 4, 5, 6, 0]
            .map(d => (

              <label
                key={d}
                style={{
                  display: 'grid',
                  gap: 5
                }}
              >

                {GIORNI[d]}

                <input
                  aria-label={
                    'Aperture ' +
                    GIORNI[d]
                  }
                  style={{
                    ...field,
                    width: 72
                  }}
                  type="number"
                  min="0"
                  max="500"
                  value={regole[d]}
                  onChange={e =>
                    setRegole(v =>
                      v.map(
                        (n, i) =>
                          i === d
                            ? Math.max(
                                0,
                                Math.min(
                                  500,
                                  Number(
                                    e.target
                                      .value
                                  ) || 0
                                )
                              )
                            : n
                      )
                    )
                  }
                />

              </label>

            ))}

        </div>

        <div
          style={{
            marginTop: 12,
            display: 'flex',
            gap: 8,
            flexWrap: 'wrap'
          }}
        >

          <button
            style={btn}
            disabled={busy}
            onClick={
              salvaRegole
            }
          >
            Salva regole
          </button>

          <button
            style={btn}
            disabled={
              busy || !loaded
            }
            onClick={
              ricalcola
            }
          >
            🔄 Ricalcola calendario
          </button>

        </div>

        <p
          style={{
            color: '#94a3b8',
            fontSize: 12,
            marginBottom: 0
          }}
        >
          Priorità automatica:
          prima il cliente con
          più bookmaker DA APRIRE.
          Una volta iniziato,
          viene completato prima
          di passare al cliente
          successivo.
        </p>

      </div>

      {/* ECCEZIONE */}

      <div style={box}>

        <h3>
          Eccezione per singola data
        </h3>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            alignItems: 'end'
          }}
        >

          <label>

            Data
            <br />

            <input
              style={field}
              type="date"
              value={date}
              onChange={e =>
                setDate(
                  e.target.value
                )
              }
            />

          </label>

          <label>

            Numero aperture
            <br />

            <input
              style={{
                ...field,
                width: 100
              }}
              type="number"
              min="0"
              max="500"
              value={override}
              onChange={e =>
                setOverride(
                  e.target.value
                )
              }
            />

          </label>

          <button
            style={btn}
            disabled={busy}
            onClick={
              salvaEccezione
            }
          >
            Salva eccezione
          </button>

          {eccezioni[date] && (

            <button
              style={btn}
              disabled={busy}
              onClick={
                togliEccezione
              }
            >
              Ripristina settimana tipo
            </button>

          )}

        </div>

      </div>

      {/* APERTURE PROGRAMMATE */}

      <div style={box}>

        <h3>
          Aperture programmate
        </h3>

        <input
          style={{
            ...field,
            width: '100%',
            maxWidth: 350
          }}
          placeholder=
            "Cerca cliente o bookmaker"
          value={filtro}
          onChange={e =>
            setFiltro(
              e.target.value
            )
          }
        />

        {Object.entries(groups)
          .sort(
            ([a], [b]) =>
              a.localeCompare(b)
          )
          .map(
            ([day, rs]) => (

              <section
                key={day}
                style={{
                  marginTop: 15
                }}
              >

                <h4>
                  {day}
                  {' · '}
                  {rs.length}
                  {' '}
                  {rs.length === 1
                    ? 'apertura'
                    : 'aperture'}
                </h4>

                {rs.map(r => {

                  const p =
                    piano[
                      String(r.id)
                    ]

                  const opening =
                    aperturaInCorso ===
                    r.id

                  return (

                    <div
                      key={r.id}
                      style={{
                        display:
                          'flex',
                        flexWrap:
                          'wrap',
                        gap: 10,
                        alignItems:
                          'center',
                        padding: 8,
                        borderBottom:
                          '1px solid #30435e'
                      }}
                    >

                      <span
                        style={{
                          flex:
                            '1 1 250px'
                        }}
                      >

                        <strong>
                          {r.cliente}
                        </strong>

                        {' — '}

                        {r.bookmaker}

                        {p?.bloccata &&
                          ' 📌'}

                      </span>

                      <input
                        aria-label={
                          'Sposta ' +
                          r.cliente +
                          ' ' +
                          r.bookmaker
                        }
                        style={field}
                        type="date"
                        value={
                          p?.data_prevista ||
                          ''
                        }
                        onChange={e => {

                          if (
                            e.target.value
                          ) {
                            cambiaSingola(
                              r,
                              e.target
                                .value,
                              true
                            )
                          }

                        }}
                      />

                      <button
                        style={btn}
                        disabled={busy}
                        onClick={() =>
                          cambiaSingola(
                            r,
                            p?.data_prevista,
                            !p?.bloccata
                          )
                        }
                      >

                        {p?.bloccata
                          ? '🔓 Sblocca'
                          : '🔒 Fissa apertura'}

                      </button>

                      <button
                        style={
                          btnAperto
                        }
                        disabled={
                          opening ||
                          busy
                        }
                        onClick={() =>
                          segnaAperto(r)
                        }
                      >

                        {opening
                          ? '⏳ Apertura...'
                          : '✅ APERTO'}

                      </button>

                    </div>

                  )
                })}

              </section>

            )
          )}

        {!scheduled.length && (

          <p>
            Nessuna apertura
            pianificata. Imposta
            le regole e premi
            Ricalcola calendario.
          </p>

        )}

      </div>

    </div>
  )
}
