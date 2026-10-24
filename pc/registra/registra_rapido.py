"""
REGISTRA AL VOLO — Profit Tracker (24/10/2026)
────────────────────────────────────────────────────────────────────────────
Piccola finestra sul desktop: premi ALT+R da qualsiasi programma (anche da Kiwi), scegli il conto, scrivi l'importo,
scegli il tipo e premi Salva (o Invio). La voce arriva al Profit Tracker, che la scrive nel Registro manuale
(entro un minuto, se hai la pagina del Profit Tracker aperta; altrimenti appena la apri: non si perde).

Uso:    Alt+R  → si apre · scrivi parte del nome (es. "giocodigitale emil") · Invio = scegli il primo risultato
        poi importo (10 oppure 5/15) · tipo · Invio = Salva · Esc = chiudi
Cambiare il tasto: in config.json aggiungi  "registra_scorciatoia": "alt+r"   (esempi: "ctrl+alt+g", "alt+shift+r")

Configurazione: usa lo stesso config.json di book_lavorati.py (api_url e segreto): metti questo programma NELLA STESSA CARTELLA.
Requisiti: Python 3.9+ e  pip install requests   (tkinter è già in Python per Windows)
Avvio: avvia_registra_rapido.bat (parte nascosto, nessuna finestra nera) · log in registra_rapido.log
Privacy: al server arrivano solo i conti scelti, l'importo, il tipo e la nota. Niente schermate, niente password.
"""
import ctypes
import json
import logging
import os
import queue
import re
import sys
import threading
import time
import tkinter as tk
import unicodedata
from logging.handlers import RotatingFileHandler

import requests

CARTELLA = os.path.dirname(os.path.abspath(__file__))
FILE_CONTI = os.path.join(CARTELLA, "registra_rapido_conti.json")        # copia locale dell'elenco conti
FILE_IN_ATTESA = os.path.join(CARTELLA, "registra_rapido_in_attesa.json")  # voci non ancora arrivate (se il sito non risponde)
TIPI = ["Sport", "Casinò / slot", "Ricarica", "Promo / VXT", "Altro"]
log = logging.getLogger("registra_rapido")

# colori (stessi del Profit Tracker)
SFONDO, PANNELLO, TESTO, GRIGIO, VIOLA, CAMPO, BORDO = "#0f172a", "#1e293b", "#e2e8f0", "#94a3b8", "#9333ea", "#020617", "#475569"


def configura_log():
    log.setLevel(logging.INFO)
    h = RotatingFileHandler(os.path.join(CARTELLA, "registra_rapido.log"), maxBytes=500_000, backupCount=2, encoding="utf-8")
    h.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
    log.addHandler(h)


def carica_config():
    with open(os.path.join(CARTELLA, "config.json"), encoding="utf-8") as f:
        c = json.load(f)
    for k in ("api_url", "segreto"):
        if not c.get(k):
            raise SystemExit(f"config.json: manca '{k}'")
    c["url"] = c["api_url"].replace("/book-lavorati", "/registra-rapido")
    if c["url"] == c["api_url"]:
        raise SystemExit("config.json: api_url deve finire con /book-lavorati")
    return c


def norm(t):
    t = unicodedata.normalize("NFD", str(t or "").lower())
    return "".join(c for c in t if not unicodedata.combining(c))


def cerca_conti(conti, testo, gia, massimo=8):
    """Tutte le parole devono comparire (in qualsiasi ordine) in 'book intestatario'. Ordine: intestatario, book."""
    parole = norm(testo).split()
    if len("".join(parole)) < 2:
        return []
    trovati = [c for c in conti if c["id"] not in gia and all(w in norm(c["nome"] + " " + c["intestatario"]) for w in parole)]
    trovati.sort(key=lambda c: (norm(c["intestatario"]), norm(c["nome"])))
    return trovati[:massimo]


# ── comunicazione con il Profit Tracker ─────────────────────────────────────────────────────────────
class Server:
    def __init__(self, cfg):
        self.url, self.h = cfg["url"], {"x-pt-segreto": cfg["segreto"]}
        self.conti = []
        self.aggiornati = 0.0
        self.lock = threading.Lock()
        try:
            with open(FILE_CONTI, encoding="utf-8") as f:
                self.conti = json.load(f)
        except Exception:
            pass

    def aggiorna_conti(self):
        try:
            r = requests.get(self.url, headers=self.h, timeout=(8, 30))
            if r.status_code != 200:
                raise RuntimeError(f"{r.status_code} {r.text[:120]}")
            conti = r.json().get("conti", [])
            if conti:
                with self.lock:
                    self.conti, self.aggiornati = conti, time.time()
                with open(FILE_CONTI, "w", encoding="utf-8") as f:
                    json.dump(conti, f, ensure_ascii=False)
                log.info("elenco conti aggiornato: %d", len(conti))
        except Exception as e:
            log.warning("elenco conti non aggiornato (%s): uso la copia salvata (%d conti)", e.__class__.__name__, len(self.conti))

    def invia(self, voce):
        """True = arrivata. Errore 400 (voce sbagliata) = scartata con avviso: ripeterla non servirebbe."""
        r = requests.post(self.url, json=voce, headers=self.h, timeout=(8, 20))
        if r.status_code == 200:
            return True
        if r.status_code in (400, 401):
            raise ValueError(r.json().get("error", r.text[:120]))
        raise RuntimeError(f"{r.status_code} {r.text[:120]}")


def leggi_attesa():
    try:
        with open(FILE_IN_ATTESA, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []


def scrivi_attesa(lista):
    try:
        with open(FILE_IN_ATTESA, "w", encoding="utf-8") as f:
            json.dump(lista, f, ensure_ascii=False)
    except Exception as e:
        log.error("non riesco a salvare le voci in attesa: %s", e)


# ── tasto globale (Windows: RegisterHotKey, nessuna libreria in più) ────────────────────────────────
MODS = {"alt": 0x0001, "ctrl": 0x0002, "shift": 0x0004, "win": 0x0008}


def leggi_scorciatoia(testo):
    """'alt+r' → (modificatori, codice tasto). Lettere e cifre."""
    parti = [p.strip().lower() for p in str(testo or "alt+r").split("+") if p.strip()]
    mod = 0
    for p in parti[:-1]:
        if p not in MODS:
            raise ValueError(f"modificatore sconosciuto: {p}")
        mod |= MODS[p]
    tasto = parti[-1]
    if len(tasto) != 1 or not tasto.isalnum():
        raise ValueError(f"tasto non valido: {tasto}")
    return mod, ord(tasto.upper())


def ascolta_tasto(scorciatoia, eventi, esito):
    """Thread col ciclo dei messaggi di Windows. Mette 'apri' in coda a ogni pressione."""
    user32 = ctypes.windll.user32
    mod, vk = leggi_scorciatoia(scorciatoia)
    if not user32.RegisterHotKey(None, 1, mod | 0x4000, vk):      # 0x4000 = non ripetere tenendo premuto
        esito.put(f"Il tasto {scorciatoia.upper()} è già usato da un altro programma. Cambialo in config.json (registra_scorciatoia).")
        return
    esito.put("")
    msg = ctypes.wintypes.MSG()
    while user32.GetMessageW(ctypes.byref(msg), None, 0, 0) != 0:
        if msg.message == 0x0312:       # WM_HOTKEY
            eventi.put("apri")


# ── finestra ────────────────────────────────────────────────────────────────────────────────────────
class Finestra:
    def __init__(self, server, eventi):
        self.server, self.eventi = server, eventi
        self.root = tk.Tk()
        self.root.title("Registra al volo")
        self.root.configure(bg=SFONDO)
        self.root.resizable(False, False)
        self.root.protocol("WM_DELETE_WINDOW", self.chiudi)
        self.scelti = []          # conti scelti (dizionari)
        self.suggeriti = []
        self.tipo = tk.StringVar(value=TIPI[0])
        self.costruisci()
        self.root.withdraw()
        self.root.after(150, self.controlla_eventi)

    def etichetta(self, genitore, testo, **kw):
        return tk.Label(genitore, text=testo, bg=kw.pop("bg", SFONDO), fg=kw.pop("fg", TESTO), anchor="w", **kw)

    def campo(self, genitore, **kw):
        return tk.Entry(genitore, bg=CAMPO, fg=TESTO, insertbackground=TESTO, relief="flat", highlightthickness=1,
                        highlightbackground=BORDO, highlightcolor=VIOLA, font=("Segoe UI", 11), **kw)

    def costruisci(self):
        r = self.root
        corpo = tk.Frame(r, bg=SFONDO, padx=14, pady=12)
        corpo.pack(fill="both", expand=True)
        self.etichetta(corpo, "✍️  Registra al volo", fg="#c084fc", font=("Segoe UI", 13, "bold")).pack(fill="x")
        self.chip = tk.Frame(corpo, bg=SFONDO)
        self.chip.pack(fill="x", pady=(8, 0))
        self.cerca = self.campo(corpo)
        self.cerca.pack(fill="x", ipady=5, pady=(8, 0))
        self.etichetta(corpo, "1) conto: parte del nome del book e/o dell'intestatario (es. giocodigitale emil)", fg=GRIGIO, font=("Segoe UI", 8)).pack(fill="x")
        self.lista = tk.Listbox(corpo, height=0, bg=PANNELLO, fg=TESTO, selectbackground=VIOLA, relief="flat", highlightthickness=1,
                                highlightbackground=BORDO, font=("Segoe UI", 10), activestyle="none")
        riga = tk.Frame(corpo, bg=SFONDO)
        riga.pack(fill="x", pady=(10, 0))
        riga.columnconfigure(1, weight=1)
        self.importo = self.campo(riga, width=10)
        self.importo.grid(row=0, column=0, ipady=5, sticky="w")
        self.nota = self.campo(riga)
        self.nota.grid(row=0, column=1, ipady=5, padx=(8, 0), sticky="ew")
        self.etichetta(riga, "2) importo € (10 oppure 5/15)", fg=GRIGIO, font=("Segoe UI", 8)).grid(row=1, column=0, sticky="w")
        self.etichetta(riga, "nota (facoltativa)", fg=GRIGIO, font=("Segoe UI", 8)).grid(row=1, column=1, sticky="w", padx=(8, 0))
        self.etichetta(corpo, "3) tipo", fg=GRIGIO, font=("Segoe UI", 8)).pack(fill="x", pady=(8, 0))
        tipi = tk.Frame(corpo, bg=SFONDO)
        tipi.pack(fill="x")
        for t in TIPI:
            tk.Radiobutton(tipi, text=t, value=t, variable=self.tipo, bg=SFONDO, fg=TESTO, selectcolor=PANNELLO, activebackground=SFONDO,
                           activeforeground=TESTO, indicatoron=False, relief="flat", padx=8, pady=3, borderwidth=1,
                           font=("Segoe UI", 9, "bold")).pack(side="left", padx=(0, 4))
        in_basso = tk.Frame(corpo, bg=SFONDO)
        in_basso.pack(fill="x", pady=(12, 0))
        self.stato = self.etichetta(in_basso, "Invio = salva · Esc = chiudi", fg=GRIGIO, font=("Segoe UI", 8))
        self.stato.pack(side="left")
        self.salva_btn = tk.Button(in_basso, text="✍️ Salva", command=self.salva, bg=VIOLA, fg="white", relief="flat", padx=16, pady=5,
                                   font=("Segoe UI", 10, "bold"), activebackground="#7e22ce", activeforeground="white", cursor="hand2")
        self.salva_btn.pack(side="right")
        tk.Button(in_basso, text="Annulla", command=self.chiudi, bg=PANNELLO, fg=TESTO, relief="flat", padx=12, pady=5,
                  font=("Segoe UI", 10), cursor="hand2").pack(side="right", padx=(0, 8))
        self.cerca.bind("<KeyRelease>", self.aggiorna_suggeriti)
        self.cerca.bind("<Down>", lambda e: self.lista.focus_set() if self.suggeriti else None)
        self.lista.bind("<Return>", lambda e: (self.scegli(self.lista.curselection()[0]) if self.lista.curselection() else None, "break")[1])
        self.lista.bind("<Double-Button-1>", lambda e: self.scegli(self.lista.nearest(e.y)))
        r.bind("<Return>", self.invio)
        r.bind("<Escape>", lambda e: self.chiudi())

    # ── logica ──
    def aggiorna_suggeriti(self, _e=None):
        gia = {c["id"] for c in self.scelti}
        with self.server.lock:
            conti = list(self.server.conti)
        self.suggeriti = cerca_conti(conti, self.cerca.get(), gia)
        self.lista.delete(0, "end")
        for c in self.suggeriti:
            self.lista.insert("end", f'{c["nome"]}   ·   {c["intestatario"] or "—"}')
        if self.suggeriti:
            self.lista.configure(height=len(self.suggeriti))
            self.lista.pack(fill="x", pady=(2, 0), after=self.cerca)
            self.lista.selection_clear(0, "end")
        else:
            self.lista.pack_forget()

    def scegli(self, i):
        if 0 <= i < len(self.suggeriti):
            self.scelti.append(self.suggeriti[i])
            self.cerca.delete(0, "end")
            self.aggiorna_suggeriti()
            self.disegna_chip()
            self.cerca.focus_set()

    def disegna_chip(self):
        for w in self.chip.winfo_children():
            w.destroy()
        for c in self.scelti:
            b = tk.Button(self.chip, text=f'{c["nome"]} · {c["intestatario"] or "—"}  ✕', bg=PANNELLO, fg=TESTO, relief="flat", padx=8, pady=2,
                          font=("Segoe UI", 9), cursor="hand2", command=lambda x=c: self.togli(x))
            b.pack(side="left", padx=(0, 4), pady=2)

    def togli(self, c):
        self.scelti = [x for x in self.scelti if x["id"] != c["id"]]
        self.disegna_chip()

    def invio(self, _e=None):
        if self.root.focus_get() is self.cerca and self.suggeriti:
            self.scegli(0)               # Invio nella ricerca = primo risultato
        elif self.root.focus_get() is self.cerca and not self.scelti:
            return
        elif self.root.focus_get() is self.cerca and not self.importo.get().strip():
            self.importo.focus_set()     # conto scelto, poi si passa all'importo
        else:
            self.salva()

    def messaggio(self, testo, colore=GRIGIO):
        self.stato.configure(text=testo, fg=colore)

    def salva(self):
        if not self.scelti:
            self.messaggio("Scegli almeno un conto (scrivi il nome e premi Invio)", "#f87171")
            self.cerca.focus_set()
            return
        importo = self.importo.get().replace(",", ".").strip()
        if importo and not re.fullmatch(r"\d+(\.\d+)?(\s*[/\-–]\s*\d+(\.\d+)?)?", importo):
            self.messaggio("Importo non valido: scrivi 10 oppure 5/15", "#f87171")
            self.importo.focus_set()
            return
        voce = {"libri": [c["id"] for c in self.scelti], "tipo_op": self.tipo.get(), "importo": importo, "nota": self.nota.get().strip()}
        nomi = ", ".join(f'{c["nome"]} ({c["intestatario"] or "—"})' for c in self.scelti)
        self.salva_btn.configure(state="disabled")
        self.messaggio("Invio…")
        threading.Thread(target=self.manda, args=(voce, nomi), daemon=True).start()

    def manda(self, voce, nomi):
        try:
            self.server.invia(voce)
            log.info("inviata: %s · %s · %s", nomi, voce["tipo_op"], voce["importo"] or "—")
            esito = ("ok", f"✅ Inviata: {nomi}")
        except ValueError as e:                         # voce rifiutata dal server: non si ripete
            log.error("voce rifiutata (%s): %s", e, voce)
            esito = ("errore", f"❌ {e}")
        except Exception as e:                          # sito non raggiungibile: la tengo e riprovo
            attesa = leggi_attesa()
            attesa.append(voce)
            scrivi_attesa(attesa)
            log.warning("sito non raggiungibile (%s): voce tenuta in attesa (%d)", e.__class__.__name__, len(attesa))
            esito = ("attesa", "📦 Sito non raggiungibile: la tengo qui e riprovo da sola")
        self.root.after(0, lambda: self.dopo_invio(*esito))

    def dopo_invio(self, tipo, testo):
        self.salva_btn.configure(state="normal")
        if tipo == "errore":
            self.messaggio(testo, "#f87171")
            return
        self.messaggio(testo, "#4ade80" if tipo == "ok" else "#fbbf24")
        self.root.after(900, self.chiudi)

    def apri(self):
        self.scelti = []
        self.disegna_chip()
        for c in (self.cerca, self.importo, self.nota):
            c.delete(0, "end")
        self.tipo.set(TIPI[0])
        self.aggiorna_suggeriti()
        self.messaggio("Invio = salva · Esc = chiudi")
        self.salva_btn.configure(state="normal")
        r = self.root
        r.deiconify()
        r.update_idletasks()
        w, h = 520, r.winfo_reqheight()
        r.geometry(f"{w}x{h}+{(r.winfo_screenwidth() - w) // 2}+{max(40, (r.winfo_screenheight() - h) // 3)}")
        r.attributes("-topmost", True)
        r.lift()
        r.focus_force()
        self.cerca.focus_force()
        if time.time() - self.server.aggiornati > 600:      # elenco conti più vecchio di 10 minuti: lo rinfresco in sottofondo
            threading.Thread(target=self.server.aggiorna_conti, daemon=True).start()

    def chiudi(self):
        self.root.withdraw()

    def controlla_eventi(self):
        try:
            while True:
                if self.eventi.get_nowait() == "apri":
                    self.apri()
        except queue.Empty:
            pass
        self.root.after(150, self.controlla_eventi)


def ripeti_in_attesa(server):
    """Ogni minuto prova a mandare le voci rimaste indietro (sito non raggiungibile)."""
    while True:
        time.sleep(60)
        attesa = leggi_attesa()
        if not attesa:
            continue
        rimaste = []
        for voce in attesa:
            try:
                server.invia(voce)
                log.info("voce in attesa inviata: %s", voce.get("libri"))
            except ValueError as e:
                log.error("voce in attesa scartata (%s): %s", e, voce)
            except Exception:
                rimaste.append(voce)
        scrivi_attesa(rimaste)


def una_sola_istanza():
    if sys.platform != "win32":
        return True
    ctypes.windll.kernel32.CreateMutexW(None, False, "Global\\RegistraRapidoProfitTracker")
    return ctypes.windll.kernel32.GetLastError() != 183       # 183 = esiste già


def main():
    configura_log()
    cfg = carica_config()
    if not una_sola_istanza():
        log.info("già in esecuzione: esco")
        return
    server = Server(cfg)
    threading.Thread(target=server.aggiorna_conti, daemon=True).start()
    threading.Thread(target=ripeti_in_attesa, args=(server,), daemon=True).start()
    eventi, esito = queue.Queue(), queue.Queue()
    scorciatoia = cfg.get("registra_scorciatoia", "alt+r")
    if sys.platform == "win32":
        import ctypes.wintypes  # noqa: F401  (serve per MSG)
        threading.Thread(target=ascolta_tasto, args=(scorciatoia, eventi, esito), daemon=True).start()
    finestra = Finestra(server, eventi)
    try:
        problema = esito.get(timeout=3) if sys.platform == "win32" else "Il tasto globale funziona solo su Windows."
    except queue.Empty:
        problema = ""
    log.info("avviato · tasto %s%s", scorciatoia.upper(), f" · PROBLEMA: {problema}" if problema else "")
    if problema:
        from tkinter import messagebox
        messagebox.showwarning("Registra al volo", problema + "\n\nLa finestra si apre comunque se avvii di nuovo il programma a mano.")
        finestra.eventi.put("apri")
    finestra.root.mainloop()


if __name__ == "__main__":
    main()
