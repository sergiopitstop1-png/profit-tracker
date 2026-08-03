"use client";
import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useCollaboratoreAttivo } from "./CollaboratoreSelector";

export default function CollaboratoriManager() {
  const [collaboratori, setCollaboratori] = useState([]);
  const [nome, setNome] = useState("");

  const load = () => fetch("/api/collaboratori").then((r) => r.json()).then((d) => setCollaboratori(d.collaboratori || []));
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!nome.trim()) return;
    await fetch("/api/collaboratori", { method: "POST", body: JSON.stringify({ nome }) });
    setNome("");
    load();
  };

  const remove = async (id) => {
    await fetch(`/api/collaboratori?id=${id}`, { method: "DELETE" });
    load();
  };

  return (
    <div style={{ background: "#1A1D22", border: "1px solid #2A2F38", borderRadius: 10, padding: 16 }}>
      <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 15, fontWeight: 600, margin: "0 0 12px" }}>
        Collaboratori
      </h3>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <input
          placeholder="Nome collaboratore"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          style={{ flex: 1, background: "#14161A", border: "1px solid #2A2F38", borderRadius: 6, color: "#EDEEF0", padding: "8px 10px", fontSize: 13 }}
        />
        <button onClick={add} style={{ display: "flex", alignItems: "center", gap: 6, background: "#E8A23D", color: "#14161A", border: "none", borderRadius: 6, padding: "8px 14px", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
          <Plus size={14} /> Aggiungi
        </button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {collaboratori.map((c) => (
          <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#20242B", border: "1px solid #2A2F38", borderRadius: 8, padding: "8px 12px" }}>
            <span style={{ fontSize: 13 }}>{c.nome}</span>
            <button onClick={() => remove(c.id)} style={{ background: "transparent", border: "none", color: "#8A8F98", cursor: "pointer" }}>
              <Trash2 size={13} />
            </button>
          </div>
        ))}
        {collaboratori.length === 0 && <div style={{ fontSize: 12, color: "#6B7280", fontStyle: "italic" }}>Nessun collaboratore ancora.</div>}
      </div>
    </div>
  );
}
