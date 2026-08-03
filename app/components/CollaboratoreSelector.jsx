"use client";
import { useEffect, useState } from "react";

// Selettore "chi sono" condiviso da tutti i pannelli. Login è unico/condiviso
// sul Profit Tracker, quindi distinguiamo il collaboratore attivo via
// localStorage (persiste sul browser/dispositivo di chi lo usa).
export function useCollaboratoreAttivo() {
  const [collaboratori, setCollaboratori] = useState([]);
  const [attivoId, setAttivoId] = useState("");

  useEffect(() => {
    fetch("/api/collaboratori")
      .then((r) => r.json())
      .then((d) => setCollaboratori(d.collaboratori || []));
    const saved = localStorage.getItem("pt_collaboratore_attivo");
    if (saved) setAttivoId(saved);
  }, []);

  const setAttivo = (id) => {
    setAttivoId(id);
    localStorage.setItem("pt_collaboratore_attivo", id);
  };

  return { collaboratori, attivoId, setAttivo };
}

export function CollaboratoreSelector({ collaboratori, attivoId, onChange }) {
  return (
    <select
      value={attivoId}
      onChange={(e) => onChange(e.target.value)}
      style={{
        background: "#14161A", border: "1px solid #2A2F38", borderRadius: 6,
        color: "#EDEEF0", padding: "7px 10px", fontSize: 13, fontFamily: "Inter, sans-serif",
      }}
    >
      <option value="">Chi sei? (seleziona)</option>
      {collaboratori.map((c) => (
        <option key={c.id} value={c.id}>{c.nome}</option>
      ))}
    </select>
  );
}
