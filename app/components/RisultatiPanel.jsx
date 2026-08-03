"use client";
import { useEffect, useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { useCollaboratoreAttivo, CollaboratoreSelector } from "./CollaboratoreSelector";

function fmtEuro(n) {
  return n.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}
function fmtDate(iso) {
  return new Date(iso + "T00:00:00").toLocaleDateString("it-IT", { day: "2-digit", month: "short" });
}
function monthKey(iso) { return iso.slice(0, 7); }

export default function RisultatiPanel() {
  const [risultati, setRisultati] = useState([]);
  const [form, setForm] = useState({ giorno: new Date().toISOString().slice(0, 10), book: "", valoreAtteso: "", numeroPromo: "" });
  const { collaboratori, attivoId, setAttivo } = useCollaboratoreAttivo();

  const currentMonth = monthKey(new Date().toISOString().slice(0, 10));
  const load = () => fetch(`/api/risultati?mese=${currentMonth}`).then((r) => r.json()).then((d) => setRisultati(d.risultati || []));
  useEffect(() => { load(); }, []);

  const addEntry = async () => {
    const va = parseFloat(form.valoreAtteso);
    const np = parseInt(form.numeroPromo, 10);
    if (!form.book.trim() || isNaN(va) || isNaN(np) || np <= 0) return;
    await fetch("/api/risultati", {
      method: "POST",
      body: JSON.stringify({ giorno: form.giorno, book: form.book.trim(), valoreAtteso: va, numeroPromo: np, collaboratoreId: attivoId || null }),
    });
    setForm({ ...form, book: "", valoreAtteso: "", numeroPromo: "" });
    load();
  };

  const remove = async (id) => {
    await fetch(`/api/risultati?id=${id}`, { method: "DELETE" });
    load();
  };

  const totaleValore = risultati.reduce((s, r) => s + Number(r.valore_atteso), 0);
  const totalePromo = risultati.reduce((s, r) => s + r.numero_promo, 0);
  const media = totalePromo ? totaleValore / totalePromo : 0;

  const byBook = useMemo(() => {
    const map = {};
    risultati.forEach((r) => {
      if (!map[r.book]) map[r.book] = { book: r.book, valore: 0, promo: 0 };
      map[r.book].valore += Number(r.valore_atteso);
      map[r.book].promo += r.numero_promo;
    });
    return Object.values(map).sort((a, b) => b.valore - a.valore);
  }, [risultati]);

  const input = { background: "#14161A", border: "1px solid #2A2F38", borderRadius: 6, color: "#EDEEF0", padding: "8px 10px", fontSize: 13 };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 600, margin: 0 }}>Risultati (mese corrente)</h2>
        <CollaboratoreSelector collaboratori={collaboratori} attivoId={attivoId} onChange={setAttivo} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
        <div style={{ background: "#1A1D22", border: "1px solid #2A2F38", borderRadius: 10, padding: 14 }}>
          <div style={{ fontSize: 10, color: "#8A8F98", textTransform: "uppercase", marginBottom: 6 }}>Valore atteso</div>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 20, fontWeight: 700, color: "#4FA8A0" }}>{fmtEuro(totaleValore)}</div>
        </div>
        <div style={{ background: "#1A1D22", border: "1px solid #2A2F38", borderRadius: 10, padding: 14 }}>
          <div style={{ fontSize: 10, color: "#8A8F98", textTransform: "uppercase", marginBottom: 6 }}>Promo eseguite</div>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 20, fontWeight: 700, color: "#E8A23D" }}>{totalePromo}</div>
        </div>
        <div style={{ background: "#1A1D22", border: "1px solid #2A2F38", borderRadius: 10, padding: 14 }}>
          <div style={{ fontSize: 10, color: "#8A8F98", textTransform: "uppercase", marginBottom: 6 }}>Media per promo</div>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 20, fontWeight: 700 }}>{fmtEuro(media)}</div>
        </div>
      </div>

      <div style={{ background: "#1D2128", border: "1px solid #2A2F38", borderRadius: 10, padding: 16, marginBottom: 22, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
        <input type="date" value={form.giorno} onChange={(e) => setForm((f) => ({ ...f, giorno: e.target.value }))} style={{ ...input, width: 150 }} />
        <input placeholder="Book" value={form.book} onChange={(e) => setForm((f) => ({ ...f, book: e.target.value }))} style={{ ...input, flex: 1, minWidth: 140 }} />
        <input type="number" step="0.01" placeholder="Valore atteso €" value={form.valoreAtteso} onChange={(e) => setForm((f) => ({ ...f, valoreAtteso: e.target.value }))} style={{ ...input, width: 140 }} />
        <input type="number" placeholder="N. promo" value={form.numeroPromo} onChange={(e) => setForm((f) => ({ ...f, numeroPromo: e.target.value }))} style={{ ...input, width: 100 }} />
        <button onClick={addEntry} style={{ background: "#E8A23D", color: "#14161A", border: "none", borderRadius: 6, padding: "9px 18px", fontWeight: 600, cursor: "pointer", fontSize: 13 }}>Aggiungi</button>
      </div>

      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, color: "#8A8F98", marginBottom: 8, fontWeight: 600, textTransform: "uppercase" }}>Ultime registrazioni</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {risultati.slice(0, 15).map((r) => (
            <div key={r.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#1A1D22", border: "1px solid #2A2F38", borderRadius: 8, padding: "8px 12px", fontSize: 12 }}>
              <span style={{ color: "#6B7280", width: 60 }}>{fmtDate(r.giorno)}</span>
              <span style={{ flex: 1 }}>{r.book}{r.collaboratori?.nome && ` · ${r.collaboratori.nome}`}</span>
              <span style={{ color: "#4FA8A0", width: 90, textAlign: "right" }}>{fmtEuro(Number(r.valore_atteso))}</span>
              <span style={{ color: "#8A8F98", width: 70, textAlign: "right" }}>{r.numero_promo} promo</span>
              <button onClick={() => remove(r.id)} style={{ background: "transparent", border: "none", color: "#8A8F98", cursor: "pointer" }}><Trash2 size={12} /></button>
            </div>
          ))}
          {risultati.length === 0 && <div style={{ fontSize: 13, color: "#6B7280", fontStyle: "italic" }}>Nessuna registrazione questo mese.</div>}
        </div>
      </div>

      <div style={{ background: "#1A1D22", border: "1px solid #2A2F38", borderRadius: 10, padding: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Riepilogo per book (mese corrente)</div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr>
              {["Book", "Valore atteso", "Promo", "Media/promo"].map((c) => (
                <th key={c} style={{ textAlign: "left", color: "#8A8F98", fontWeight: 500, padding: "6px 4px", borderBottom: "1px solid #2A2F38" }}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {byBook.map((b) => (
              <tr key={b.book}>
                <td style={{ padding: "6px 4px", borderBottom: "1px solid #22262D" }}>{b.book}</td>
                <td style={{ padding: "6px 4px", borderBottom: "1px solid #22262D", fontFamily: "'IBM Plex Mono', monospace" }}>{fmtEuro(b.valore)}</td>
                <td style={{ padding: "6px 4px", borderBottom: "1px solid #22262D", fontFamily: "'IBM Plex Mono', monospace" }}>{b.promo}</td>
                <td style={{ padding: "6px 4px", borderBottom: "1px solid #22262D", fontFamily: "'IBM Plex Mono', monospace" }}>{fmtEuro(b.promo ? b.valore / b.promo : 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {byBook.length === 0 && <div style={{ fontSize: 12, color: "#6B7280", fontStyle: "italic", marginTop: 6 }}>Nessun dato.</div>}
      </div>
    </div>
  );
}
