"use client";
import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { useCollaboratoreAttivo, CollaboratoreSelector } from "./CollaboratoreSelector";

function daysBetween(a, b) {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}

export default function ClientiMovimentazionePanel() {
  const [giorno, setGiorno] = useState(new Date().toISOString().slice(0, 10));
  const [conti, setConti] = useState([]);
  const { collaboratori, attivoId, setAttivo } = useCollaboratoreAttivo();

  const load = () => fetch(`/api/movimentazioni?giorno=${giorno}`).then((r) => r.json()).then((d) => setConti(d.clienti || []));
  useEffect(() => { load(); }, [giorno]);

  const avg = conti.length ? conti.reduce((s, c) => s + c.utilizziTotali, 0) / conti.length : 0;

  const toggle = async (c) => {
    if (!attivoId) { alert("Seleziona prima chi sei."); return; }
    const usatoOggi = c.usatoOggiDa.length > 0;
    if (usatoOggi) {
      await fetch(`/api/movimentazioni?bookId=${c.id}&giorno=${giorno}&collaboratoreId=${attivoId}`, { method: "DELETE" });
    } else {
      await fetch("/api/movimentazioni", {
        method: "POST",
        body: JSON.stringify({ bookId: c.id, giorno, collaboratoreId: attivoId }),
      });
    }
    load();
  };

  const sorted = [...conti].sort((a, b) => {
    if (!a.ultimoUtilizzo && !b.ultimoUtilizzo) return 0;
    if (!a.ultimoUtilizzo) return -1;
    if (!b.ultimoUtilizzo) return 1;
    return a.ultimoUtilizzo < b.ultimoUtilizzo ? -1 : 1;
  });

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, flexWrap: "wrap", gap: 10 }}>
        <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 600, margin: 0 }}>Conti da movimentare</h2>
        <div style={{ display: "flex", gap: 10 }}>
          <input type="date" value={giorno} onChange={(e) => setGiorno(e.target.value)} style={{ background: "#14161A", border: "1px solid #2A2F38", borderRadius: 6, color: "#EDEEF0", padding: "7px 10px", fontSize: 13 }} />
          <CollaboratoreSelector collaboratori={collaboratori} attivoId={attivoId} onChange={setAttivo} />
        </div>
      </div>
      <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 16 }}>
        Lista sincronizzata live dalla tabella "books" · un rigo per ogni conto (book + intestatario) · ordinata per chi va movimentato prima
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {sorted.map((c) => {
          const usatoOggi = c.usatoOggiDa.length > 0;
          const sinceLast = c.ultimoUtilizzo ? daysBetween(c.ultimoUtilizzo, giorno) : null;
          const overused = avg > 0 && c.utilizziTotali > avg * 1.4;
          const underused = avg > 0 && c.utilizziTotali < avg * 0.6;
          return (
            <div key={c.id} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
              background: "#1A1D22", border: usatoOggi ? "1px solid #4FA8A0" : "1px solid #2A2F38",
              borderRadius: 9, padding: "10px 14px", flexWrap: "wrap",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button onClick={() => toggle(c)} style={{
                  width: 18, height: 18, borderRadius: 5, border: "1px solid #4FA8A0",
                  background: usatoOggi ? "#4FA8A0" : "transparent", cursor: "pointer",
                }} />
                <div>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{c.nome}</span>
                  <span style={{ fontSize: 12, color: "#8A8F98" }}> · {c.intestatario}</span>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 11, color: "#8A8F98", fontFamily: "'IBM Plex Mono', monospace" }}>
                <span>Usi totali: {c.utilizziTotali}</span>
                <span>{sinceLast === null ? "Mai usato" : sinceLast === 0 ? "Usato oggi" : `Da ${sinceLast}g`}</span>
                {usatoOggi && <span style={{ color: "#4FA8A0", fontFamily: "Inter, sans-serif" }}>oggi: {c.usatoOggiDa.join(", ")}</span>}
                {overused && <span style={{ display: "flex", alignItems: "center", gap: 4, color: "#E8A23D" }}><AlertTriangle size={11} /> sovra-usato</span>}
                {underused && <span style={{ color: "#4FA8A0" }}>sotto-usato</span>}
              </div>
            </div>
          );
        })}
        {sorted.length === 0 && <div style={{ fontSize: 13, color: "#6B7280", fontStyle: "italic" }}>Nessun conto trovato nella tabella "books".</div>}
      </div>
    </div>
  );
}
