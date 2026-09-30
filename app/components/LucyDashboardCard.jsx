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
      console.error("[Lucy Dashboard]", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();

    // Aggiorna automaticamente i dati ogni minuto.
    const timer = setInterval(load, 60 * 1000);

    return () => clearInterval(timer);
  }, [load]);

  const counters = data?.counters || {};
  const rows = data?.data || [];
  const top = rows.slice(0, 5);

  return (
    <div style={styles.card}>

      {/* BARRA COMPATTA SEMPRE VISIBILE */}
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
          onClick={() => setAperta(v => !v)}
          style={styles.openButton}
        >
          {aperta ? "▲ Chiudi" : "▼ Apri"}
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

                    <div style={styles.rowSubject}>
                      {mail.oggetto || "Senza oggetto"}
                    </div>

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

  rowSubject: {
    marginTop: 2,
    color: "#e2e8f0",
    fontSize: 12,
  },

  rowClient: {
    marginTop: 3,
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
};
