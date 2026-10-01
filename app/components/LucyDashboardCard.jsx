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

  const [
    comunicazioneAperta,
    setComunicazioneAperta,
  ] = useState(null);

  const [savingId, setSavingId] =
    useState(null);

  /* ======================================================
     CARICAMENTO
     ====================================================== */

  const load = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    load();

    const timer =
      setInterval(
        load,
        60 * 1000
      );

    return () =>
      clearInterval(timer);
  }, [load]);

  /* ======================================================
     APERTURA COMUNICAZIONE
     ====================================================== */

  async function apriComunicazione(
    item
  ) {
    setComunicazioneAperta(item);

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
            id: item.id,
            source_id:
              item.source_id,
            canale:
              item.canale,
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

  /* ======================================================
     ARCHIVIA
     ====================================================== */

  async function archivia(item) {
    if (
      savingId === item.id
    ) {
      return;
    }

    setSavingId(item.id);

    try {
      const res = await fetch(
        "/api/lucy-mail/archive",
        {
          method: "PATCH",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            id: item.id,
            source_id:
              item.source_id,
            canale:
              item.canale,
            archiviata: true,
          }),
        }
      );

      const json =
        await res.json();

      if (!res.ok) {
        console.error(
          "[Lucy archivia]",
          json
        );

        return;
      }

      /*
       * Se stiamo archiviando
       * la comunicazione aperta,
       * chiudiamo il popup.
       */
      if (
        comunicazioneAperta?.id ===
        item.id
      ) {
        setComunicazioneAperta(
          null
        );
      }

      /*
       * Ricarichiamo:
       * la comunicazione archiviata
       * sparirà automaticamente
       * dalla Dashboard.
       */
      await load();
    } catch (error) {
      console.error(
        "[Lucy archivia]",
        error
      );
    } finally {
      setSavingId(null);
    }
  }

  /* ======================================================
     FORMATTAZIONE
     ====================================================== */

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

  function titoloComunicazione(
    item
  ) {
    if (
      item.canale === "SMS"
    ) {
      return (
        item.testo_completo
          ?.slice(0, 95) ||
        "SMS"
      );
    }

    return (
      item.oggetto ||
      "Senza oggetto"
    );
  }

  /* ======================================================
     DATI
     ====================================================== */

  const counters =
    data?.counters || {};

  const rows =
    data?.data || [];

  const top =
    rows.slice(0, 5);

  /* ======================================================
     RENDER
     ====================================================== */

  return (
    <>
      <div style={styles.card}>

        {/* =========================
            BARRA COMPATTA
            ========================= */}

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
              Controllo comunicazioni…
            </div>

          ) : (

            <div style={styles.stats}>

              <div style={styles.stat}>
                <span>🔥</span>

                <strong>
                  {
                    counters.opportunita ||
                    0
                  }
                </strong>

                <span
                  style={
                    styles.statLabel
                  }
                >
                  Opportunità
                </span>
              </div>

              <div style={styles.stat}>
                <span>🚨</span>

                <strong>
                  {
                    counters.problemi ||
                    0
                  }
                </strong>

                <span
                  style={
                    styles.statLabel
                  }
                >
                  Problemi
                </span>
              </div>

              <div style={styles.stat}>
                <span>⚠️</span>

                <strong>
                  {
                    counters.da_valutare ||
                    0
                  }
                </strong>

                <span
                  style={
                    styles.statLabel
                  }
                >
                  Da valutare
                </span>
              </div>

              <div style={styles.stat}>
                <span>⏳</span>

                <strong>
                  {
                    counters.da_analizzare ||
                    0
                  }
                </strong>

                <span
                  style={
                    styles.statLabel
                  }
                >
                  In analisi
                </span>
              </div>

              <div style={styles.stat}>
                <span>📦</span>

                <strong>
                  {
                    counters.archiviate ||
                    0
                  }
                </strong>

                <span
                  style={
                    styles.statLabel
                  }
                >
                  Archiviate
                </span>
              </div>

            </div>
          )}

          <button
            onClick={() =>
              setAperta(
                value => !value
              )
            }
            style={
              styles.openButton
            }
          >
            {aperta
              ? "▲ Chiudi"
              : "▼ Apri"}
          </button>

        </div>

        {/* =========================
            PARTE ESPANDIBILE
            ========================= */}

        {aperta &&
          !loading && (

          <div
            style={
              styles.expanded
            }
          >

            <div
              style={
                styles.message
              }
            >

              {counters.opportunita >
              0 ? (
                <>
                  🔥 Ho trovato{" "}

                  <strong>
                    {
                      counters.opportunita
                    }{" "}
                    opportunità
                  </strong>
                  .

                  {counters.problemi >
                    0 && (
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
                  opportunità al
                  momento.
                </>
              )}

              {counters.da_analizzare >
                0 && (
                <div
                  style={
                    styles.analysisQueue
                  }
                >
                  ⏳{" "}
                  <strong>
                    {
                      counters.da_analizzare
                    }
                  </strong>{" "}
                  comunicazioni sono
                  ancora in attesa di
                  analisi.
                </div>
              )}

            </div>

            {top.length > 0 && (

              <div
                style={styles.list}
              >

                <div
                  style={
                    styles.sectionTitle
                  }
                >
                  Opportunità recenti
                </div>

                {top.map(
                  item => (

                  <div
                    key={item.id}
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
                        {item.bookmaker ||
                          item.mittente ||
                          "Bookmaker"}
                      </div>

                      <button
                        onClick={() =>
                          apriComunicazione(
                            item
                          )
                        }
                        style={
                          styles.subjectButton
                        }
                        title="Apri comunicazione"
                      >
                        {item.canale ===
                        "SMS"
                          ? "📱 "
                          : "📩 "}

                        {titoloComunicazione(
                          item
                        )}
                      </button>

                      <div
                        style={
                          styles.rowClient
                        }
                      >
                        👤{" "}
                        {item.cliente_nome ||
                          "Cliente non identificato"}
                      </div>

                    </div>

                    <div
                      style={
                        styles.rowRight
                      }
                    >

                      {item.bonus_importo !=
                        null && (

                        <div
                          style={
                            styles.bonus
                          }
                        >
                          +€
                          {
                            item.bonus_importo
                          }
                        </div>

                      )}

                      <div
                        style={
                          styles.priority
                        }
                      >

                        {item.priorita ===
                        "alta"
                          ? "🔴 ALTA"
                          : item.priorita ===
                            "media"
                          ? "🟠 MEDIA"
                          : "⚪ BASSA"}

                      </div>

                      <button
                        onClick={() =>
                          archivia(item)
                        }
                        disabled={
                          savingId ===
                          item.id
                        }
                        style={{
                          ...styles.archiveSmall,

                          opacity:
                            savingId ===
                            item.id
                              ? 0.5
                              : 1,
                        }}
                      >
                        {savingId ===
                        item.id
                          ? "..."
                          : "✓ Archivia"}
                      </button>

                    </div>

                  </div>

                ))}

              </div>

            )}

            <div
              style={
                styles.footer
              }
            >

              <a
                href="/profit-tracker/archivio-lucy"
                style={
                  styles.archiveButton
                }
              >
                Apri archivio Lucy →
              </a>

              <button
                onClick={load}
                style={
                  styles.refresh
                }
              >
                ↻ Aggiorna
              </button>

            </div>

          </div>

        )}

      </div>

      {/* ==================================================
          LETTORE COMUNICAZIONE
          ================================================== */}

      {comunicazioneAperta && (

        <div
          style={
            styles.modalOverlay
          }
          onClick={() =>
            setComunicazioneAperta(
              null
            )
          }
        >

          <div
            style={styles.modal}
            onClick={event =>
              event.stopPropagation()
            }
          >

            {/* HEADER */}

            <div
              style={
                styles.modalHeader
              }
            >

              <div>

                <div
                  style={
                    styles.mailLabel
                  }
                >
                  {comunicazioneAperta.canale ===
                  "SMS"
                    ? "📱 SMS"
                    : "📩 EMAIL"}
                </div>

                <div
                  style={
                    styles.modalTitle
                  }
                >
                  {comunicazioneAperta.canale ===
                  "SMS"
                    ? comunicazioneAperta.bookmaker ||
                      comunicazioneAperta.mittente ||
                      "SMS"
                    : comunicazioneAperta.oggetto ||
                      "Senza oggetto"}
                </div>

              </div>

              <button
                onClick={() =>
                  setComunicazioneAperta(
                    null
                  )
                }
                style={
                  styles.closeButton
                }
              >
                ✕ Chiudi
              </button>

            </div>

            {/* CONTENUTO */}

            <div
              style={
                styles.modalBody
              }
            >

              <div
                style={
                  styles.mailInfo
                }
              >

                <div>
                  <strong>
                    Cliente:
                  </strong>{" "}
                  {comunicazioneAperta.cliente_nome ||
                    "-"}
                </div>

                <div>
                  <strong>
                    Book:
                  </strong>{" "}
                  {comunicazioneAperta.bookmaker ||
                    "-"}
                </div>

                <div>
                  <strong>
                    Da:
                  </strong>{" "}
                  {comunicazioneAperta.mittente ||
                    "-"}
                </div>

                {comunicazioneAperta.canale ===
                  "EMAIL" && (
                  <div>
                    <strong>
                      A:
                    </strong>{" "}
                    {comunicazioneAperta.destinatario_originale ||
                      "-"}
                  </div>
                )}

                <div>
                  <strong>
                    Data:
                  </strong>{" "}
                  {formatDate(
                    comunicazioneAperta.data_mail
                  )}
                </div>

                <div>
                  <strong>
                    Priorità:
                  </strong>{" "}
                  {comunicazioneAperta.priorita ||
                    "-"}
                </div>

              </div>

              {/* ANALISI */}

              <div
                style={
                  styles.analysis
                }
              >

                <div
                  style={
                    styles.analysisTitle
                  }
                >
                  🧠 Analisi Lucy
                </div>

                <div
                  style={
                    styles.analysisType
                  }
                >
                  {comunicazioneAperta.giudizio ||
                    "DA_ANALIZZARE"}

                  {" · "}

                  {comunicazioneAperta.categoria ||
                    "-"}
                </div>

                {comunicazioneAperta.motivazione_ai && (

                  <div
                    style={
                      styles.analysisReason
                    }
                  >
                    {
                      comunicazioneAperta.motivazione_ai
                    }
                  </div>

                )}

                <div
                  style={
                    styles.values
                  }
                >

                  {comunicazioneAperta.bonus_importo !=
                    null && (

                    <div
                      style={
                        styles.valueBonus
                      }
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
                      🔁 Rollover:{" "}
                      {
                        comunicazioneAperta.rollover
                      }
                    </div>

                  )}

                  {comunicazioneAperta.scadenza && (

                    <div
                      style={
                        styles.expiry
                      }
                    >
                      ⏰ Scadenza:{" "}
                      {formatDate(
                        comunicazioneAperta.scadenza
                      )}
                    </div>

                  )}

                </div>

                {comunicazioneAperta.condizioni && (

                  <div
                    style={
                      styles.conditions
                    }
                  >

                    <strong>
                      Condizioni:
                    </strong>{" "}

                    {
                      comunicazioneAperta.condizioni
                    }

                  </div>

                )}

                {comunicazioneAperta.richiede_azione && (

                  <div
                    style={
                      styles.action
                    }
                  >
                    ⚡ Questa
                    comunicazione
                    richiede un'azione.
                  </div>

                )}

              </div>

              {/* TESTO ORIGINALE */}

              <div
                style={
                  styles.originalTitle
                }
              >
                {comunicazioneAperta.canale ===
                "SMS"
                  ? "📱 Testo SMS"
                  : "✉️ Testo originale"}
              </div>

              <div
                style={
                  styles.originalMail
                }
              >
                {comunicazioneAperta.testo_completo ||
                  "Testo non disponibile."}
              </div>

            </div>

            {/* FOOTER */}

            <div
              style={
                styles.modalFooter
              }
            >

              <a
                href="/profit-tracker/archivio-lucy"
                style={
                  styles.archiveButton
                }
              >
                Apri archivio Lucy →
              </a>

              <div
                style={
                  styles.modalActions
                }
              >

                <button
                  onClick={() =>
                    archivia(
                      comunicazioneAperta
                    )
                  }
                  disabled={
                    savingId ===
                    comunicazioneAperta.id
                  }
                  style={{
                    ...styles.archiveModal,

                    opacity:
                      savingId ===
                      comunicazioneAperta.id
                        ? 0.5
                        : 1,
                  }}
                >
                  {savingId ===
                  comunicazioneAperta.id
                    ? "Archiviazione..."
                    : "✓ Archivia"}
                </button>

                <button
                  onClick={() =>
                    setComunicazioneAperta(
                      null
                    )
                  }
                  style={
                    styles.closeBottom
                  }
                >
                  Chiudi
                </button>

              </div>

            </div>

          </div>

        </div>

      )}

    </>
  );
}

/* ========================================================
   STILI
   ======================================================== */

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
    background:
      "rgba(59,130,246,.10)",
    border:
      "1px solid rgba(59,130,246,.30)",
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
    fontSize: 13,
  },

  analysisQueue: {
    marginTop: 7,
    color: "#fbbf24",
    fontSize: 12,
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
    justifyContent:
      "space-between",
    gap: 12,
    padding: "9px 2px",
    borderBottom:
      "1px solid #263244",
  },

  rowMain: {
    minWidth: 0,
    flex: 1,
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
    background:
      "transparent",
    color: "#7dd3fc",
    fontSize: 12,
    fontWeight: 700,
    textAlign: "left",
    cursor: "pointer",
    overflowWrap: "anywhere",
  },

  rowClient: {
    marginTop: 4,
    color: "#94a3b8",
    fontSize: 11,
  },

  rowRight: {
    textAlign: "right",
    flexShrink: 0,
    minWidth: 95,
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

  archiveSmall: {
    marginTop: 7,
    background:
      "rgba(34,197,94,.10)",
    border:
      "1px solid rgba(34,197,94,.45)",
    color: "#86efac",
    borderRadius: 7,
    padding: "5px 8px",
    fontSize: 10,
    fontWeight: 900,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },

  footer: {
    display: "flex",
    justifyContent:
      "space-between",
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
    background:
      "transparent",
    border:
      "1px solid #475569",
    color: "#e2e8f0",
    padding: "7px 11px",
    borderRadius: 9,
    cursor: "pointer",
    fontSize: 12,
  },

  /* ============================
     MODAL
     ============================ */

  modalOverlay: {
    position: "fixed",
    inset: 0,
    zIndex: 9999,
    background:
      "rgba(0,0,0,.70)",
    display: "flex",
    alignItems: "center",
    justifyContent:
      "center",
    padding: 20,
  },

  modal: {
    width:
      "min(1000px, 96vw)",
    maxHeight: "90vh",
    background: "#ffffff",
    color: "#0f172a",
    borderRadius: 16,
    overflow: "hidden",
    display: "flex",
    flexDirection:
      "column",
    boxShadow:
      "0 25px 80px rgba(0,0,0,.45)",
  },

  modalHeader: {
    padding: 18,
    background: "#e0f2fe",
    borderBottom:
      "1px solid #bae6fd",
    display: "flex",
    justifyContent:
      "space-between",
    alignItems:
      "flex-start",
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
    border:
      "1px solid #e2e8f0",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    fontSize: 13,
  },

  analysis: {
    background: "#eff6ff",
    border:
      "1px solid #bfdbfe",
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
    borderTop:
      "1px solid #bfdbfe",
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
    overflowWrap:
      "anywhere",
    background: "#ffffff",
    border:
      "1px solid #e2e8f0",
    borderRadius: 12,
    padding: 16,
    lineHeight: 1.6,
    fontSize: 13,
  },

  modalFooter: {
    padding: 14,
    background: "#f8fafc",
    borderTop:
      "1px solid #e2e8f0",
    display: "flex",
    justifyContent:
      "space-between",
    alignItems: "center",
    gap: 10,
  },

  modalActions: {
    display: "flex",
    gap: 8,
    alignItems: "center",
  },

  archiveModal: {
    background: "#15803d",
    color: "#ffffff",
    border: "none",
    borderRadius: 8,
    padding: "8px 16px",
    fontWeight: 800,
    cursor: "pointer",
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
