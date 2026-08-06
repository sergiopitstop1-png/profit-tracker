"use client";
import { useEffect, useState } from "react";

type Post = {
  id: string;
  slug: string;
  title: string;
  category: string;
  excerpt: string;
  content: string;
  cta_label: string | null;
  cta_url: string | null;
  published: boolean;
  created_at: string;
};

const bg = "#0d0f14";
const card = "#161920";
const border = "#2a2f3f";
const textDim = "#6b7490";
const textMain = "#e8ecf5";
const accent = "#c8f135";

const EMPTY_FORM = {
  id: "", slug: "", title: "", category: "", excerpt: "",
  content: "", cta_label: "", cta_url: "", published: true,
};

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // toglie accenti
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

const input = {
  width: "100%", background: "#0d0f14", border: `1px solid ${border}`,
  borderRadius: 8, padding: "10px 12px", color: textMain, fontSize: 14,
  outline: "none", boxSizing: "border-box" as const,
};
const label = { fontSize: 11, fontWeight: 700, color: textDim, letterSpacing: "0.05em", textTransform: "uppercase" as const, display: "block", marginBottom: 6 };

export default function AdminBlogPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<any>(EMPTY_FORM);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);

  const load = async () => {
    setLoading(true);
    const res = await fetch("/api/blog");
    const data = await res.json();
    setPosts(data.posts || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openNew = () => {
    setForm(EMPTY_FORM);
    setSlugTouched(false);
    setError("");
    setEditing(true);
  };

  const openEdit = (p: Post) => {
    setForm({ ...p, cta_label: p.cta_label || "", cta_url: p.cta_url || "" });
    setSlugTouched(true);
    setError("");
    setEditing(true);
  };

  const onTitleChange = (title: string) => {
    setForm((f: any) => ({ ...f, title, slug: slugTouched ? f.slug : slugify(title) }));
  };

  const save = async (publish: boolean) => {
    if (!form.title.trim() || !form.slug.trim()) {
      setError("Titolo e slug sono obbligatori.");
      return;
    }
    setSaving(true);
    setError("");
    const payload = { ...form, published: publish };
    if (!payload.id) delete payload.id;

    const res = await fetch("/api/blog", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setError(data.error || "Errore nel salvataggio."); return; }
    setEditing(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Eliminare questo articolo?")) return;
    await fetch(`/api/blog?id=${id}`, { method: "DELETE" });
    load();
  };

  return (
    <div style={{ background: bg, minHeight: "100vh", padding: "40px 20px", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>

        {!editing ? (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <h1 style={{ color: textMain, fontSize: 24, fontWeight: 900, margin: 0 }}>Articoli del blog</h1>
              <button onClick={openNew} style={{ padding: "10px 18px", borderRadius: 10, border: "none", background: accent, color: "#0d0f14", fontWeight: 800, fontSize: 13, cursor: "pointer" }}>
                + Nuovo articolo
              </button>
            </div>

            {loading && <p style={{ color: textDim }}>Caricamento...</p>}
            {!loading && posts.length === 0 && <p style={{ color: textDim }}>Nessun articolo ancora.</p>}

            {posts.map((p) => (
              <div key={p.id} style={{ background: card, border: `1px solid ${border}`, borderRadius: 12, padding: "14px 18px", marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ color: textMain, fontWeight: 700, fontSize: 14 }}>{p.title}</span>
                    {!p.published && (
                      <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 5, background: "rgba(251,191,36,0.15)", color: "#fbbf24", fontWeight: 700 }}>BOZZA</span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: textDim }}>{p.category} · /blog/{p.slug}</div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => openEdit(p)} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(56,189,248,0.4)", background: "rgba(56,189,248,0.08)", color: "#38bdf8", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>✏️ Modifica</button>
                  <button onClick={() => remove(p.id)} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(239,68,68,0.4)", background: "rgba(239,68,68,0.08)", color: "#f87171", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>🗑️</button>
                </div>
              </div>
            ))}
          </>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h1 style={{ color: textMain, fontSize: 22, fontWeight: 900, margin: 0 }}>
                {form.id ? "Modifica articolo" : "Nuovo articolo"}
              </h1>
              <button onClick={() => setEditing(false)} style={{ background: "transparent", border: "none", color: textDim, fontSize: 13, cursor: "pointer" }}>← torna all'elenco</button>
            </div>

            <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 14, padding: 22, display: "flex", flexDirection: "column", gap: 14 }}>

              <div>
                <label style={label}>Titolo</label>
                <input style={input} value={form.title} onChange={(e) => onTitleChange(e.target.value)} placeholder="Titolo dell'articolo" />
              </div>

              <div>
                <label style={label}>Slug (indirizzo web)</label>
                <input style={input} value={form.slug} onChange={(e) => { setSlugTouched(true); setForm({ ...form, slug: slugify(e.target.value) }); }} placeholder="titolo-articolo" />
                <div style={{ fontSize: 11, color: textDim, marginTop: 4 }}>sergioapicella.it/blog/{form.slug || "..."}</div>
              </div>

              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={label}>Categoria</label>
                  <input style={input} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Analisi Calcio, Strategie, PronoX..." />
                </div>
              </div>

              <div>
                <label style={label}>Riassunto (mostrato nell'elenco articoli)</label>
                <textarea style={{ ...input, minHeight: 60, resize: "vertical" as const, fontFamily: "inherit" }} value={form.excerpt} onChange={(e) => setForm({ ...form, excerpt: e.target.value })} placeholder="Due righe che riassumono l'articolo" />
              </div>

              <div>
                <label style={label}>Testo dell'articolo</label>
                <div style={{ fontSize: 11, color: textDim, marginBottom: 6, lineHeight: 1.5 }}>
                  Regole veloci: <code>## Titolo</code> per un'intestazione di sezione ·{" "}
                  <code>&gt; testo</code> per un box in evidenza (come l'introduzione) ·{" "}
                  <code>- voce</code> per un elenco puntato · <code>**testo**</code> per il grassetto ·
                  riga vuota = nuovo paragrafo.
                </div>
                <textarea style={{ ...input, minHeight: 360, resize: "vertical" as const, fontFamily: "monospace", fontSize: 13, lineHeight: 1.6 }} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder={"Scrivi qui il testo dell'articolo...\n\n## Un titolo di sezione\n\nUn paragrafo normale.\n\n> Un concetto messo in evidenza in un box."} />
              </div>

              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={label}>Bottone finale — testo (facoltativo)</label>
                  <input style={input} value={form.cta_label} onChange={(e) => setForm({ ...form, cta_label: e.target.value })} placeholder="Analizza le partite con PronoX" />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={label}>Bottone finale — link (facoltativo)</label>
                  <input style={input} value={form.cta_url} onChange={(e) => setForm({ ...form, cta_url: e.target.value })} placeholder="/oggi" />
                </div>
              </div>

              {error && <div style={{ color: "#ff5c5c", fontSize: 13 }}>{error}</div>}

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 6 }}>
                <button onClick={() => save(false)} disabled={saving} style={{ padding: "11px 20px", borderRadius: 10, border: `1px solid ${border}`, background: "transparent", color: textDim, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                  Salva come bozza
                </button>
                <button onClick={() => save(true)} disabled={saving} style={{ padding: "11px 20px", borderRadius: 10, border: "none", background: accent, color: "#0d0f14", fontWeight: 800, fontSize: 13, cursor: "pointer" }}>
                  {saving ? "Salvataggio..." : "🚀 Pubblica"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
