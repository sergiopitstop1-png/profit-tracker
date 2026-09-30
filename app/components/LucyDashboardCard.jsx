"use client";

import React, {
  useCallback,
  useEffect,
  useState,
} from "react";

export default function LucyDashboardCard() {
  const [data, setData] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const load = useCallback(
    async () => {
      try {
        const res = await fetch(
          "/api/lucy-mail/archive?vista=opportunita&page_size=10",
          {
            cache: "no-store",
          }
        );

        if (!res.ok) {
          throw new Error(
            "Errore caricamento Lucy"
          );
        }

        const json =
          await res.json();

        setData(json);
      } catch (error) {
        console.error(
          "[Lucy Dashboard]",
          error
        );
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    load();

    /*
     * Aggiorna il riquadro
     * automaticamente ogni minuto.
     * Non lancia l'AI:
     * legge soltanto i risultati
     * già presenti nell'archivio.
     */
    const timer =
      setInterval(
        load,
        60 * 1000
      );

    return () =>
      clearInterval(timer);
  }, [load]);

  if (loading) {
    return (
      <div style={styles.card}>
        <div style={styles.title}>
          🧠 Lucy
        </div>

        <div style={styles.muted}>
          Controllo opportunità…
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={styles.card}>
        <div style={styles.title}>
          🧠 Lucy
        </div>

        <div style={styles.muted}>
          Lucy non è disponibile
          in questo momento.
        </div>
      </div>
    );
  }

  const counters =
    data.counters || {};

  const rows =
    data.data || [];

  const top =
    rows.slice(0, 5);

  return (
    <div style={styles.card}>

      {/* HEADER */}

      <div style={styles.header}>
        <div>
          <div style={styles.title}>
            🧠 Lucy
          </div>

          <div style={styles.subtitle}>
            Controllo automatico
            delle email
          </div>
        </div>

        <div style={styles.live}>
          ● ATTIVA
        </div>
      </div>


      {/* CONTATORI */}

      <div style={styles.stats}>

        <div style={styles.stat}>
          <div style={styles.number}>
            🔥{" "}
            {
              counters.opportunita ||
              0
            }
          </div>

          <div style={styles.label}>
            Opportunità
          </div>
        </div>


        <div style={styles.stat}>
          <div style={styles.number}>
            🚨{" "}
            {
              counters.problemi ||
              0
            }
          </div>

          <div style={styles.label}>
            Problemi
          </div>
        </div>


        <div style={styles.stat}>
          <div style={styles.number}>
            ⚠️{" "}
            {
              counters.da_valutare ||
              0
            }
          </div>

          <div style={styles.label}>
            Da valutare
          </div>
        </div>


        <div style={styles.stat}>
          <div style={styles.number}>
            ⏳{" "}
            {
              counters.da_analizzare ||
              0
            }
          </div>

          <div style={styles.label}>
            In analisi
          </div>
        </div>

      </div>


      {/* MESSAGGIO LUCY */}

      <div style={styles.message}>

        {counters.opportunita > 0 ? (
          <>
            🔥 Ho trovato{" "}
            <strong>
              {
                counters.opportunita
              }{" "}
              opportunità
            </strong>
            .

            {counters.problemi > 0 && (
              <>
                {" "}
                Ci sono anche{" "}
                <strong>
                  {
                    counters.problemi
                  }{" "}
                  comunicazioni
                </strong>{" "}
                che richiedono
                attenzione.
              </>
            )}
          </>
        ) : (
          <>
            Nessuna nuova
            opportunità al momento.
          </>
        )}

      </div>


      {/* OPPORTUNITÀ */}

      {top.length > 0 && (
        <div style={styles.list}>

          <div
            style={
              styles.sectionTitle
            }
          >
            Opportunità recenti
          </div>

          {top.map(mail => (
            <div
              key={mail.id}
              style={styles.row}
            >

              <div
                style={
                  styles.rowMain
                }
              >

                <div
                  style={
                    styles.rowTitle
                  }
                >
                  🔥{" "}
                  {mail.bookmaker ||
                    "Bookmaker"}
                </div>

                <div
                  style={
                    styles.rowSubject
                  }
                >
                  {mail.oggetto ||
                    "Senza oggetto"}
                </div>

                <div
                  style={
                    styles.rowClient
                  }
                >
                  👤{" "}
                  {mail.cliente_nome ||
                    "Cliente non identificato"}
                </div>

              </div>


              <div
                style={
                  styles.rowRight
                }
              >

                {mail.bonus_importo !=
                  null && (
                  <div
                    style={
                      styles.bonus
                    }
                  >
                    +€
                    {
                      mail.bonus_importo
                    }
                  </div>
                )}

                <div
                  style={
                    styles.priority
                  }
                >
                  {mail.priorita ===
                  "alta"
                    ? "🔴 ALTA"
                    : mail.priorita ===
                      "media"
                    ? "🟠 MEDIA"
                    : "⚪ BASSA"}
                </div>

              </div>

            </div>
          ))}

        </div>
      )}


      {/* FOOTER */}

      <div style={styles.footer}>

        <a
          href="/profit-tracker/archivio-lucy"
          style={styles.button}
        >
          Apri Lucy →
        </a>

        <button
          onClick={load}
          style={styles.refresh}
        >
          ↻ Aggiorna
        </button>

      </div>

    </div>
  );
}


const styles = {

  card: {
    background:
      "linear-gradient(145deg,#111827,#0f172a)",
    border:
      "1px solid #334155",
    borderRadius: 18,
    padding: 20,
    color: "#f8fafc",
    marginBottom: 20,
    boxShadow:
      "0 12px 30px rgba(0,0,0,.18)",
  },

  header: {
    display: "flex",
    justifyContent:
      "space-between",
    alignItems: "center",
    gap: 16,
    marginBottom: 18,
  },

  title: {
    fontSize: 24,
    fontWeight: 900,
  },

  subtitle: {
    color: "#94a3b8",
    fontSize: 13,
    marginTop: 3,
  },

  live: {
    color: "#22c55e",
    fontWeight: 900,
    fontSize: 12,
  },

  stats: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit,minmax(120px,1fr))",
    gap: 10,
    marginBottom: 14,
  },

  stat: {
    background: "#0b1220",
    border:
      "1px solid #334155",
    borderRadius: 13,
    padding: 12,
  },

  number: {
    fontSize: 21,
    fontWeight: 900,
  },

  label: {
    color: "#94a3b8",
    fontSize: 12,
    marginTop: 4,
  },

  message: {
    background:
      "rgba(59,130,246,.10)",
    border:
      "1px solid rgba(59,130,246,.30)",
    borderRadius: 12,
    padding: 13,
    marginBottom: 16,
    lineHeight: 1.5,
  },

  list: {
    marginTop: 8,
  },

  sectionTitle: {
    fontWeight: 800,
    marginBottom: 8,
  },

  row: {
    display: "flex",
    justifyContent:
      "space-between",
    gap: 14,
    padding: "11px 0",
    borderBottom:
      "1px solid #263244",
  },

  rowMain: {
    minWidth: 0,
  },

  rowTitle: {
    fontWeight: 800,
  },

  rowSubject: {
    marginTop: 3,
    color: "#e2e8f0",
  },

  rowClient: {
    marginTop: 4,
    color: "#94a3b8",
    fontSize: 12,
  },

  rowRight: {
    textAlign: "right",
    flexShrink: 0,
  },

  bonus: {
    color: "#4ade80",
    fontWeight: 900,
    fontSize: 18,
  },

  priority: {
    fontSize: 11,
    fontWeight: 800,
    marginTop: 5,
  },

  footer: {
    display: "flex",
    justifyContent:
      "space-between",
    alignItems: "center",
    gap: 10,
    marginTop: 16,
  },

  button: {
    background: "#2563eb",
    color: "white",
    textDecoration: "none",
    padding: "10px 15px",
    borderRadius: 10,
    fontWeight: 800,
  },

  refresh: {
    background: "transparent",
    border:
      "1px solid #475569",
    color: "#e2e8f0",
    padding: "9px 13px",
    borderRadius: 10,
    cursor: "pointer",
  },

  muted: {
    color: "#94a3b8",
    marginTop: 8,
  },
};
