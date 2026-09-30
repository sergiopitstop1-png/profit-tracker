"use client";

import React, {
  useCallback,
  useEffect,
  useState,
} from "react";

export default function LucyDashboardCard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [aperta, setAperta] = useState(false);
  const [mailAperta, setMailAperta] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(
        "/api/lucy-mail/archive?vista=opportunita&page_size=10",
        { cache: "no-store" }
      );

      if (!res.ok) {
        throw new Error("Errore caricamento Lucy");
      }

      const json = await res.json();
      setData(json);

    } catch (error) {
      console.error(
        "[Lucy Dashboard]",
        error
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();

    const timer = setInterval(
      load,
      60 * 1000
    );

    return () =>
      clearInterval(timer);

  }, [load]);


  async function apriMail(mail) {
    setMailAperta(mail);

    try {
      await fetch(
        "/api/lucy-mail/archive",
        {
          method: "PATCH",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            id: mail.id,
            letta: true,
          }),
        }
      );
    } catch (error) {
      console.error(
        "[Lucy lettura]",
        error
      );
    }
  }


  function formatDate(value) {
    if (!value) return "-";

    const date =
      new Date(value);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return value;
    }

    return date.toLocaleString(
      "it-IT"
    );
  }


  const counters =
    data?.counters || {};

  const rows =
    data?.data || [];

  const top =
    rows.slice(0, 5);


  return (
    <>
      <div style={styles.card}>

        {/* BARRA COMPATTA */}

        <div style={styles.mainRow}>

          <div style={styles.identity}>

            <div style={styles.title}>
              🧠 Lucy
            </div>

            <div style={styles.status}>
              ● ATTIVA
            </div>

          </div>


          {loading ? (

            <div style={styles.loading}>
              Controllo email…
            </div>

          ) : (

            <div style={styles.stats}>

              <div style={styles.stat}>
                <span>🔥</span>

                <strong>
                  {counters.opportunita || 0}
                </strong>

                <span style={styles.statLabel}>
                  Opportunità
                </span>
              </div>


              <div style={styles.stat}>
                <span>🚨</span>

                <strong>
                  {counters.problemi || 0}
                </strong>

                <span style={styles.statLabel}>
                  Problemi
                </span>
              </div>


              <div style={styles.stat}>
                <span>⚠️</span>

                <strong>
                  {counters.da_valutare || 0}
                </strong>

                <span style={styles.statLabel}>
                  Da valutare
                </span>
              </div>


              <div style={styles.stat}>
                <span>⏳</span>

                <strong>
                  {counters.da_analizzare || 0}
                </strong>

                <span style={styles.statLabel}>
                  In analisi
                </span>
              </div>

            </div>
          )}


          <button
            onClick={() =>
              setAperta(v => !v)
            }
            style={styles.openButton}
          >
            {aperta
              ? "▲ Chiudi"
              : "▼ Apri"}
          </button>

        </div>


        {/* PARTE ESPANDIBILE */}

        {aperta && !loading && (

          <div style={styles.expanded}>

            <div style={styles.message}>

              {counters.opportunita > 0 ? (
                <>
                  🔥 Ho trovato{" "}

                  <strong>
                    {counters.opportunita} opportunità
                  </strong>.

                  {counters.problemi > 0 && (
                    <>
                      {" "}
                      Ci sono anche{" "}

                      <strong>
                        {counters.problemi} comunicazioni
                      </strong>{" "}

                      che richiedono attenzione.
                    </>
                  )}
                </>
              ) : (
                <>
                  Nessuna nuova opportunità al momento.
                </>
              )}

            </div>


            {top.length > 0 && (

              <div style={styles.list}>

                <div style={styles.sectionTitle}>
                  Opportunità recenti
                </div>


                {top.map(mail => (

                  <div
                    key={mail.id}
                    style={styles.row}
                  >

                    <div style={styles.rowMain}>

                      <div style={styles.rowTitle}>
                        🔥 {mail.bookmaker || "Bookmaker"}
                      </div>


                      {/* OGGETTO CLICCABILE */}

                      <button
                        onClick={() =>
                          apriMail(mail)
                        }
                        style={styles.subjectButton}
                        title="Apri la mail"
                      >
                        📩 {mail.oggetto || "Senza oggetto"}
                      </button>


                      <div style={styles.rowClient}>
                        👤 {mail.cliente_nome || "Cliente non identificato"}
                      </div>

                    </div>


                    <div style={styles.rowRight}>

                      {mail.bonus_importo != null && (

                        <div style={styles.bonus}>
                          +€{mail.bonus_importo}
                        </div>

                      )}


                      <div style={styles.priority}>

                        {mail.priorita === "alta"
                          ? "🔴 ALTA"
                          : mail.priorita === "media"
                          ? "🟠 MEDIA"
                          : "⚪ BASSA"}

                      </div>

                    </div>

                  </div>

                ))}

              </div>

            )}


            <div style={styles.footer}>

              <a
                href="/profit-tracker/archivio-lucy"
                style={styles.archiveButton}
              >
                Apri archivio Lucy →
              </a>


              <button
                onClick={load}
                style={styles.refresh}
              >
                ↻ Aggiorna
              </button>

            </div>

          </div>

        )}

      </div>


      {/* ==================================================
          LETTORE MAIL SOPRA IL PROFIT
          ================================================== */}

      {mailAperta && (

        <div
          style={styles.modalOverlay}
          onClick={() =>
            setMailAperta(null)
          }
        >

          <div
            style={styles.modal}
            onClick={e =>
              e.stopPropagation()
            }
          >

            {/* HEADER */}

            <div style={styles.modalHeader}>

              <div>

                <div style={styles.mailLabel}>
                  📩 MAIL
                </div>

                <div style={styles.modalTitle}>
                  {mailAperta.oggetto ||
                    "Senza oggetto"}
                </div>

              </div>


              <button
                onClick={() =>
                  setMailAperta(null)
                }
                style={styles.closeButton}
              >
                ✕ Chiudi
              </button>

            </div>


            {/* CONTENUTO */}

            <div style={styles.modalBody}>

              <div style={styles.mailInfo}>

                <div>
                  <strong>Cliente:</strong>{" "}
                  {mailAperta.cliente_nome || "-"}
                </div>

                <div>
                  <strong>Book:</strong>{" "}
                  {mailAperta.bookmaker || "-"}
                </div>

                <div>
                  <strong>Da:</strong>{" "}
                  {mailAperta.mittente || "-"}
                </div>

                <div>
                  <strong>A:</strong>{" "}
                  {mailAperta.destinatario_originale || "-"}
                </div>

                <div>
                  <strong>Data:</strong>{" "}
                  {formatDate(mailAperta.data_mail)}
                </div>

                <div>
                  <strong>Priorità:</strong>{" "}
                  {mailAperta.priorita || "-"}
                </div>

              </div>


              {/* ANALISI */}

              <div style={styles.analysis}>

                <div style={styles.analysisTitle}>
                  🧠 Analisi Lucy
                </div>

                <div style={styles.analysisType}>
                  {mailAperta.giudizio || "DA_ANALIZZARE"}
                  {" · "}
                  {mailAperta.categoria || "-"}
                </div>


                {mailAperta.motivazione_ai && (

                  <div style={styles.analysisReason}>
                    {mailAperta.motivazione_ai}
                  </div>

                )}


                <div style={styles.values}>

                  {mailAperta.bonus_importo != null && (

                    <div style={styles.valueBonus}>
                      💰 Bonus €{mailAperta.bonus_importo}
                    </div>

                  )}


                  {mailAperta.deposito_richiesto != null && (

                    <div>
                      💳 Deposito €{mailAperta.deposito_richiesto}
                    </div>

                  )}


                  {mailAperta.rollover && (

                    <div>
                      🔁 Rollover: {mailAperta.rollover}
                    </div>

                  )}


                  {mailAperta.scadenza && (

                    <div style={styles.expiry}>
                      ⏰ Scadenza:{" "}
                      {formatDate(mailAperta.scadenza)}
                    </div>

                  )}

                </div>


                {mailAperta.condizioni && (

                  <div style={styles.conditions}>

                    <strong>
                      Condizioni:
                    </strong>{" "}

                    {mailAperta.condizioni}

                  </div>

                )}


                {mailAperta.richiede_azione && (

                  <div style={styles.action}>
                    ⚡ Questa comunicazione richiede un'azione.
                  </div>

                )}

              </div>


              {/* TESTO ORIGINALE */}

              <div style={styles.originalTitle}>
                ✉️ Testo originale
              </div>

              <div style={styles.originalMail}>
                {mailAperta.testo_completo ||
                  "Testo della mail non disponibile."}
              </div>

            </div>


            {/* FOOTER */}

            <div style={styles.modalFooter}>

              <a
                href="/profit-tracker/archivio-lucy"
                style={styles.archiveButton}
              >
                Apri archivio Lucy →
              </a>


              <button
                onClick={() =>
                  setMailAperta(null)
                }
                style={styles.closeBottom}
              >
                Chiudi
              </button>

            </div>

          </div>

        </div>

      )}

    </>
  );
}


const styles = {

  card: {
    background: "#111827",
    border: "1px solid #334155",
    borderRadius: 14,
    padding: "12px 14px",
    color: "#f8fafc",
    marginBottom: 16,
  },

  mainRow: {
    display: "flex",
    alignItems: "center",
    gap: 18,
    flexWrap: "wrap",
  },

  identity: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    minWidth: 125,
  },

  title: {
    fontSize: 20,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },

  status: {
    color: "#22c55e",
    fontSize: 10,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },

  loading: {
    flex: 1,
    color: "#94a3b8",
    fontSize: 13,
  },

  stats: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },

  stat: {
    display: "flex",
    alignItems: "center",
    gap: 5,
    background: "#0b1220",
    border: "1px solid #263244",
    borderRadius: 9,
    padding: "7px 10px",
    fontSize: 13,
  },

  statLabel: {
    color: "#94a3b8",
    fontSize: 11,
  },

  openButton: {
    background: "#2563eb",
    color: "#ffffff",
    border: "none",
    borderRadius: 9,
    padding: "8px 14px",
    fontWeight: 800,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },

  expanded: {
    marginTop: 12,
    paddingTop: 12,
    borderTop: "1px solid #263244",
  },

  message: {
    background: "rgba(59,130,246,.10)",
    border: "1px solid rgba(59,130,246,.30)",
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
    fontSize: 13,
  },

  list: {
    marginTop: 6,
  },

  sectionTitle: {
    fontWeight: 800,
    marginBottom: 6,
    fontSize: 13,
  },

  row: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    padding: "8px 2px",
    borderBottom: "1px solid #263244",
  },

  rowMain: {
    minWidth: 0,
  },

  rowTitle: {
    fontWeight: 800,
    fontSize: 13,
  },

  subjectButton: {
    display: "block",
    marginTop: 3,
    padding: 0,
    border: "none",
    background: "transparent",
    color: "#7dd3fc",
    fontSize: 12,
    fontWeight: 700,
    textAlign: "left",
    cursor: "pointer",
  },

  rowClient: {
    marginTop: 4,
    color: "#94a3b8",
    fontSize: 11,
  },

  rowRight: {
    textAlign: "right",
    flexShrink: 0,
  },

  bonus: {
    color: "#4ade80",
    fontWeight: 900,
    fontSize: 15,
  },

  priority: {
    fontSize: 10,
    fontWeight: 800,
    marginTop: 3,
  },

  footer: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    marginTop: 12,
  },

  archiveButton: {
    background: "#2563eb",
    color: "#ffffff",
    textDecoration: "none",
    padding: "8px 12px",
    borderRadius: 9,
    fontWeight: 800,
    fontSize: 12,
  },

  refresh: {
    background: "transparent",
    border: "1px solid #475569",
    color: "#e2e8f0",
    padding: "7px 11px",
    borderRadius: 9,
    cursor: "pointer",
    fontSize: 12,
  },


  /* ============================
     MODAL MAIL
     ============================ */

  modalOverlay: {
    position: "fixed",
    inset: 0,
    zIndex: 9999,
    background: "rgba(0,0,0,.70)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },

  modal: {
    width: "min(1000px, 96vw)",
    maxHeight: "90vh",
    background: "#ffffff",
    color: "#0f172a",
    borderRadius: 16,
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    boxShadow: "0 25px 80px rgba(0,0,0,.45)",
  },

  modalHeader: {
    padding: 18,
    background: "#e0f2fe",
    borderBottom: "1px solid #bae6fd",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 15,
  },

  mailLabel: {
    color: "#0369a1",
    fontSize: 12,
    fontWeight: 900,
    marginBottom: 5,
  },

  modalTitle: {
    fontSize: 20,
    fontWeight: 900,
  },

  closeButton: {
    background: "#0f172a",
    color: "#ffffff",
    border: "none",
    borderRadius: 8,
    padding: "8px 13px",
    fontWeight: 800,
    cursor: "pointer",
  },

  modalBody: {
    padding: 20,
    overflowY: "auto",
  },

  mailInfo: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit,minmax(260px,1fr))",
    gap: 10,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    fontSize: 13,
  },

  analysis: {
    background: "#eff6ff",
    border: "1px solid #bfdbfe",
    borderRadius: 12,
    padding: 15,
    marginBottom: 18,
  },

  analysisTitle: {
    color: "#1e3a8a",
    fontWeight: 900,
    marginBottom: 7,
  },

  analysisType: {
    fontWeight: 900,
    marginBottom: 8,
  },

  analysisReason: {
    lineHeight: 1.5,
    marginBottom: 10,
  },

  values: {
    display: "flex",
    flexWrap: "wrap",
    gap: 15,
    fontSize: 13,
  },

  valueBonus: {
    color: "#15803d",
    fontWeight: 900,
  },

  expiry: {
    color: "#b91c1c",
    fontWeight: 800,
  },

  conditions: {
    marginTop: 12,
    paddingTop: 12,
    borderTop: "1px solid #bfdbfe",
    lineHeight: 1.5,
  },

  action: {
    marginTop: 12,
    color: "#dc2626",
    fontWeight: 900,
  },

  originalTitle: {
    fontSize: 17,
    fontWeight: 900,
    marginBottom: 10,
  },

  originalMail: {
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    padding: 16,
    lineHeight: 1.6,
    fontSize: 13,
  },

  modalFooter: {
    padding: 14,
    background: "#f8fafc",
    borderTop: "1px solid #e2e8f0",
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
  },

  closeBottom: {
    background: "#0284c7",
    color: "#ffffff",
    border: "none",
    borderRadius: 8,
    padding: "8px 16px",
    fontWeight: 800,
    cursor: "pointer",
  },
};
