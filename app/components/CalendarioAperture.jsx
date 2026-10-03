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

  const daAprire = useMemo(
    () => matrice.filter(r => r.stato === 'DA APRIRE'),
    [matrice]
  )

  const aperti = useMemo(
    () => matrice.filter(r => r.stato === 'APERTO'),
    [matrice]
  )

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
          c.data.map(r => [String(r.matrice_id), r])
        )
      )

      setLoaded(true)

    } catch (e) {
      setMsg('Errore caricamento: ' + e.message)
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

  async function salvaRegole() {
    setBusy(true)

    try {
      const { error } = await supabase
        .from('calendario_aperture_regole')
        .upsert(
          regole.map((quantita, giorno) => ({
            giorno,
            quantita,
            aggiornato_il: new Date().toISOString()
          }))
        )

      if (error) throw error

      setMsg(
        'Regole salvate. Premi Ricalcola per applicarle alle aperture future.'
      )

    } catch (e) {
      setMsg('Errore: ' + e.message)
    } finally {
      setBusy(false)
    }
  }

  async function salvaEccezione() {
    setBusy(true)

    try {
      const q = Number(override)

      if (!Number.isInteger(q) || q < 0 || q > 500) {
        throw Error('Inserisci una quantità da 0 a 500')
      }

      const { error } = await supabase
        .from('calendario_aperture_eccezioni')
        .upsert({
          data: date,
          quantita: q,
          aggiornato_il: new Date().toISOString()
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
        'Eccezione salvata. Ricalcola per aggiornare il piano.'
      )

    } catch (e) {
      setMsg('Errore: ' + e.message)
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
        'Eccezione eliminata. Ricalcola per aggiornare il calendario.'
      )

    } catch (e) {
      setMsg('Errore: ' + e.message)
    } finally {
      setBusy(false)
    }
  }

  async function ricalcola() {

    if (
      !window.confirm(
        'Ricalcolare tutte le aperture future non fissate? Le aperture fissate manualmente resteranno nelle loro date.'
      )
    ) return

    setBusy(true)

    try {

      const start = today()

      const rows = daAprire
        .filter(r => !piano[String(r.id)]?.bloccata)
        .sort((a, b) =>
          (piano[String(b.id)]?.priorita || 0) -
          (piano[String(a.id)]?.priorita || 0) ||

          String(a.cliente).localeCompare(
            String(b.cliente)
          ) ||

          String(a.bookmaker).localeCompare(
            String(b.bookmaker)
          )
        )

      const fixed = {}

      daAprire.forEach(r => {

        const p = piano[String(r.id)]

        if (
          p?.bloccata &&
          p.data_prevista &&
          p.data_prevista >= start
        ) {
          fixed[p.data_prevista] =
            (fixed[p.data_prevista] || 0) + 1
        }
      })

      let i = 0
      const updates = []

      for (
        let n = 0;
        n < 3660 && i < rows.length;
        n++
      ) {

        const day = addDays(start, n)

        const quota =
          eccezioni[day]?.quantita ??
          regole[weekday(day)] ??
          0

        const slots = Math.max(
          0,
          quota - (fixed[day] || 0)
        )

        for (
          let j = 0;
          j < slots && i < rows.length;
          j++
        ) {

          const r = rows[i]
          const old = piano[String(r.id)]

          updates.push({
            matrice_id: r.id,
            data_prevista: day,
            bloccata: false,
            priorita: old?.priorita || 0,
            aggiornato_il: new Date().toISOString()
          })

          i++
        }
      }

      if (i < rows.length) {
        throw Error(
          'Capienza insufficiente: aggiungi almeno un giorno con aperture prima di ricalcolare.'
        )
      }

      for (let k = 0; k < updates.length; k += 150) {

        const { error } = await supabase
          .from('calendario_aperture_piano')
          .upsert(
            updates.slice(k, k + 150)
          )

        if (error) throw error
      }

      setMsg(
        `Pianificate ${updates.length} aperture. Le aperture fissate sono rimaste invariate.`
      )

      await refresh()

    } catch (e) {

      setMsg(
        'Ricalcolo non completato: ' +
        e.message +
        ' (verifica il piano prima di riprovare)'
      )

    } finally {
      setBusy(false)
    }
  }

  async function cambiaSingola(
    r,
    nuovaData,
    locked = true
  ) {

    setBusy(true)

    try {

      const old =
        piano[String(r.id)] || {}

      const { error } = await supabase
        .from('calendario_aperture_piano')
        .upsert({
          matrice_id: r.id,
          data_prevista: nuovaData || null,
          bloccata: locked,
          priorita: old.priorita || 0,
          rinvii:
            (old.rinvii || 0) +
            (locked ? 1 : 0),
          nota: old.nota || null,
          aggiornato_il: new Date().toISOString()
        })

      if (error) throw error

      await refresh()

      setMsg(
        locked
          ? '🔒 Apertura fissata. I prossimi ricalcoli non la sposteranno.'
          : '🔓 Apertura sbloccata. Il prossimo ricalcolo potrà spostarla.'
      )

    } catch (e) {
      setMsg('Errore: ' + e.message)
    } finally {
      setBusy(false)
    }
  }

  async function segnaAperto(r) {

    if (!onSegnaAperto) {
      setMsg(
        'Funzione Segna aperto non collegata al ProfitTracker.'
      )
      return
    }

    setAperturaInCorso(r.id)

    try {

      const ok = await onSegnaAperto(r)

      if (!ok) return

      /*
       * Non cancelliamo la riga dal piano:
       * matrice diventa APERTO e quindi sparisce
       * automaticamente dalle aperture ancora da fare.
       * La pianificazione rimane nel database come traccia.
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

  const schedule = useMemo(
    () =>
      daAprire
        .filter(
          r =>
            !filtro ||
            `${r.cliente} ${r.bookmaker}`
              .toLowerCase()
              .includes(filtro.toLowerCase())
        )
        .sort((a, b) =>
          String(
            piano[String(a.id)]?.data_prevista ||
            '9999'
          ).localeCompare(
            String(
              piano[String(b.id)]?.data_prevista ||
              '9999'
            )
          )
        ),
    [daAprire, piano, filtro]
  )

  const scheduled = schedule.filter(
    r => piano[String(r.id)]?.data_prevista
  )

  const groups = Object.groupBy
    ? Object.groupBy(
        scheduled,
        r => piano[String(r.id)].data_prevista
      )
    : scheduled.reduce((o, r) => {

        const d =
          piano[String(r.id)].data_prevista

        ;(o[d] ??= []).push(r)

        return o
      }, {})

  return (
    <div style={{ color: '#e2e8f0' }}>

      {/* TESTATA */}

      <div style={box}>

        <strong>📅 Calendario aperture</strong>

        <p>
          {daAprire.length} da aprire
          {' · '}
          {aperti.length} aperti
          {' · '}
          {scheduled.length} programmati
        </p>

        {!loaded && 'Caricamento...'}

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

        <h3>Settimana tipo</h3>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 12
          }}
        >

          {[1, 2, 3, 4, 5, 6, 0].map(d => (

            <label
              key={d}
              style={{
                display: 'grid',
                gap: 5
              }}
            >

              {GIORNI[d]}

              <input
                aria-label={'Aperture ' + GIORNI[d]}
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
                    v.map((n, i) =>
                      i === d
                        ? Math.max(
                            0,
                            Math.min(
                              500,
                              Number(e.target.value) || 0
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
            onClick={salvaRegole}
          >
            Salva regole
          </button>

          <button
            style={btn}
            disabled={busy || !loaded}
            onClick={ricalcola}
          >
            🔄 Ricalcola calendario
          </button>

        </div>

      </div>

      {/* ECCEZIONE */}

      <div style={box}>

        <h3>Eccezione per singola data</h3>

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
                setDate(e.target.value)
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
                setOverride(e.target.value)
              }
            />
          </label>

          <button
            style={btn}
            disabled={busy}
            onClick={salvaEccezione}
          >
            Salva eccezione
          </button>

          {eccezioni[date] && (

            <button
              style={btn}
              disabled={busy}
              onClick={togliEccezione}
            >
              Ripristina settimana tipo
            </button>

          )}

        </div>

      </div>

      {/* APERTURE */}

      <div style={box}>

        <h3>Aperture programmate</h3>

        <input
          style={{
            ...field,
            width: '100%',
            maxWidth: 350
          }}
          placeholder="Cerca cliente o bookmaker"
          value={filtro}
          onChange={e =>
            setFiltro(e.target.value)
          }
        />

        {Object.entries(groups)
          .sort(([a], [b]) =>
            a.localeCompare(b)
          )
          .map(([day, rs]) => (

            <section
              key={day}
              style={{
                marginTop: 15
              }}
            >

              <h4>
                {day} · {rs.length}{' '}
                {rs.length === 1
                  ? 'apertura'
                  : 'aperture'}
              </h4>

              {rs.map(r => {

                const p =
                  piano[String(r.id)]

                const opening =
                  aperturaInCorso === r.id

                return (

                  <div
                    key={r.id}
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 10,
                      alignItems: 'center',
                      padding: 8,
                      borderBottom:
                        '1px solid #30435e'
                    }}
                  >

                    <span
                      style={{
                        flex: '1 1 250px'
                      }}
                    >

                      <strong>
                        {r.cliente}
                      </strong>

                      {' — '}

                      {r.bookmaker}

                      {p?.bloccata && ' 📌'}

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
                        p?.data_prevista || ''
                      }
                      onChange={e => {

                        if (e.target.value) {
                          cambiaSingola(
                            r,
                            e.target.value,
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
                      style={btnAperto}
                      disabled={
                        opening || busy
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

          ))}

        {!scheduled.length && (

          <p>
            Nessuna apertura pianificata.
            Imposta le regole e ricalcola.
          </p>

        )}

      </div>

    </div>
  )
}
