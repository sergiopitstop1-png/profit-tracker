"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Upload, Trash2, X } from "lucide-react";
import { useCollaboratoreAttivo, CollaboratoreSelector } from "./CollaboratoreSelector";

function fmtDate(iso) {
  return new Date(iso + "T00:00:00").toLocaleDateString("it-IT", { day: "2-digit", month: "short" });
}

export default function PromoScreenshotsPanel() {
  const [giorno, setGiorno] = useState(new Date().toISOString().slice(0, 10));
  const [screens, setScreens] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [zoomed, setZoomed] = useState(null); // screenshot selezionato per la vista ingrandita
  const [mostraTutti, setMostraTutti] = useState(false); // vedi anche le promo degli altri collaboratori
  const fileInput = useRef(null);
  const { collaboratori, attivoId, setAttivo } = useCollaboratoreAttivo();

  const load = () => fetch(`/api/screenshots?giorno=${giorno}`).then((r) => r.json()).then((d) => setScreens(d.screenshots || []));
  useEffect(() => { load(); }, [giorno]);

  // Chiudi la vista ingrandita con il tasto Esc
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") setZoomed(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const upload = async (files) => {
    setUploading(true);
    for (const file of Array.from(files)) {
      const form = new FormData();
      form.append("file", file);
      form.append("giorno", giorno);
      if (attivoId) form.append("collaboratoreId", attivoId);
      await fetch("/api/screenshots", { method: "POST", body: form });
    }
    setUploading(false);
    load();
  };

  const remove = async (id) => {
    await fetch(`/api/screenshots?id=${id}`, { method: "DELETE" });
    if (zoomed?.id === id) setZoomed(null);
    load();
  };

  const screensVisibili = useMemo(() => {
    if (mostraTutti || !attivoId) return screens;
    return screens.filter((s) => s.collaboratore_id === attivoId);
  }, [screens, attivoId, mostraTutti]);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
        <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 600, margin: 0 }}>
          Promo del {fmtDate(giorno)}
        </h2>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input type="date" value={giorno} onChange={(e) => setGiorno(e.target.value)} style={{ background: "#14161A", border: "1px solid #2A2F38", borderRadius: 6, color: "#EDEEF0", padding: "7px 10px", fontSize: 13 }} />
          <CollaboratoreSelector collaboratori={collaboratori} attivoId={attivoId} onChange={setAttivo} />
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#8A8F98", cursor: "pointer" }}>
            <input type="checkbox" checked={mostraTutti} onChange={(e) => setMostraTutti(e.target.checked)} />
            Mostra anche gli altri collaboratori
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 6, background: "#E8A23D", color: "#14161A", border: "none", borderRadius: 7, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            <Upload size={14} /> {uploading ? "Caricamento..." : "Carica"}
            <input ref={fileInput} type="file" accept="image/*" multiple style={{ display: "none" }}
              onChange={(e) => { if (e.target.files?.length) upload(e.target.files); e.target.value = ""; }} />
          </label>
        </div>
      </div>

      {attivoId && !mostraTutti && (
        <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 12 }}>
          Stai vedendo solo le promo assegnate a te. Spunta "Mostra anche gli altri collaboratori" per vedere tutto.
        </div>
      )}

      {screensVisibili.length === 0 ? (
        <div style={{ fontSize: 13, color: "#6B7280", fontStyle: "italic", padding: 20, textAlign: "center", background: "#1A1D22", border: "1px dashed #2A2F38", borderRadius: 10 }}>
          Nessuno screenshot per questo giorno{attivoId && !mostraTutti ? " assegnato a te" : ""}.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 14 }}>
          {screensVisibili.map((s) => (
            <div key={s.id} style={{ background: "#1A1D22", border: "1px solid #2A2F38", borderRadius: 10, overflow: "hidden" }}>
              <div style={{ position: "relative", cursor: "zoom-in" }} onClick={() => s.url && setZoomed(s)}>
                {s.url && <img src={s.url} alt={s.label || "promo"} style={{ width: "100%", display: "block", maxHeight: 220, objectFit: "cover" }} />}
                <button onClick={(e) => { e.stopPropagation(); remove(s.id); }} style={{ position: "absolute", top: 6, right: 6, background: "rgba(20,22,26,0.85)", border: "none", borderRadius: 5, color: "#EDEEF0", cursor: "pointer", padding: 4 }}>
                  <Trash2 size={12} />
                </button>
              </div>
              <div style={{ padding: "6px 8px", fontSize: 11, color: "#8A8F98" }}>
                {s.label || "—"} {s.collaboratori?.nome && `· ${s.collaboratori.nome}`}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Vista ingrandita a schermo intero */}
      {zoomed && (
        <div
          onClick={() => setZoomed(null)}
          style={{
            position: "fixed", inset: 0, background: "rgba(10,11,13,0.92)", zIndex: 1000,
            display: "flex", alignItems: "center", justifyContent: "center", padding: 24, cursor: "zoom-out",
          }}
        >
          <button
            onClick={(e) => { e.stopPropagation(); setZoomed(null); }}
            style={{
              position: "absolute", top: 20, right: 24, background: "rgba(255,255,255,0.1)", border: "none",
              borderRadius: 8, color: "#EDEEF0", cursor: "pointer", padding: 8, display: "flex",
            }}
          >
            <X size={20} />
          </button>
          <img
            src={zoomed.url}
            alt={zoomed.label || "promo"}
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "92vw", maxHeight: "88vh", objectFit: "contain", borderRadius: 8, cursor: "default" }}
          />
          {zoomed.label && (
            <div style={{ position: "absolute", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "rgba(20,22,26,0.85)", color: "#EDEEF0", padding: "8px 16px", borderRadius: 8, fontSize: 13 }}>
              {zoomed.label}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
