#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Lettore Telegram dell'Accademia del Profitto  (09/10/2026)

Legge i gruppi/canali che scegli (anche tutti i topic dei gruppi con i forum) con il TUO account
Telegram e manda ogni messaggio al Profit Tracker (/api/accademia/ingest).
SOLA LETTURA: non scrive mai nei gruppi, non segna i messaggi come letti, non esce da nessun gruppo.

Prima volta:
  1) pip install telethon
  2) python accademia_reader.py            -> crea accademia_config.json: compila api_id, api_hash, sito_url, segreto
  3) python accademia_reader.py --scegli   -> mostra i tuoi gruppi, scrivi i numeri di quelli dell'Accademia
  4) python accademia_reader.py --prova    -> legge gli ultimi messaggi e li mostra, SENZA mandare niente
  5) python accademia_reader.py            -> parte davvero: recupera gli ultimi giorni e poi resta in ascolto

Altre opzioni:
  --elenco          mostra tutti i gruppi e, per quelli con i forum, i topic (non cambia niente)
  --prova-immagine  prende l'ultima foto che rientra nelle regole "immagini", la fa leggere al sito
                    e mostra il testo trovato (costa meno di un centesimo, non salva niente)

Immagini (schede Profiliamo, segnalazioni promo): vedi la sezione "immagini" di accademia_config.json.
"""
import asyncio
import base64
import json
import os
import sys
import time
import traceback
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone

QUI = os.path.dirname(os.path.abspath(__file__))
CONFIG = os.path.join(QUI, "accademia_config.json")
STATO = os.path.join(QUI, "accademia_stato.json")      # ultimo messaggio inviato per ogni gruppo
CODA = os.path.join(QUI, "accademia_coda.jsonl")       # messaggi non ancora consegnati (sito irraggiungibile)
LOG = os.path.join(QUI, "accademia_reader.log")
SESSIONE = os.path.join(QUI, "accademia")              # Telethon aggiunge .session
STATO_IMM = os.path.join(QUI, "accademia_immagini.json")   # foto già lette (chat:messaggio)

MODELLO_CONFIG = {
    "api_id": "",
    "api_hash": "",
    "sito_url": "https://sergioapicella.it",
    "segreto": "",
    "giorni_indietro": 7,
    "gruppi": [],
    # Lettura delle immagini: solo per i gruppi il cui nome CONTIENE una di queste parole (anche in parte, senza
    # distinguere maiuscole) e per i topic il cui nome contiene una di queste. Costa circa 0,0004 $ a immagine.
    "immagini": {
        "attiva": True,
        "gruppi_contiene": ["profiliamo"],
        "topic_contiene": ["segnalazion"],
        "giorni_storico": 90,
    },
}

INVIO_MAX = 200          # messaggi per richiesta (il sito ne accetta al massimo 500)
INTERVALLO_INVIO = 5     # secondi tra un invio e l'altro in ascolto


# ───────────────────────── utilità ─────────────────────────

def log(testo):
    riga = f"{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}  {testo}"
    try:
        print(riga, flush=True)
    except Exception:
        pass  # senza console (pythonw) print non esiste
    try:
        with open(LOG, "a", encoding="utf-8") as f:
            f.write(riga + "\n")
        if os.path.getsize(LOG) > 2_000_000:  # il log non cresce all'infinito
            with open(LOG, "r", encoding="utf-8") as f:
                coda = f.readlines()[-2000:]
            with open(LOG, "w", encoding="utf-8") as f:
                f.writelines(coda)
    except Exception:
        pass


def leggi_json(percorso, predefinito):
    try:
        with open(percorso, "r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return predefinito
    except Exception as e:
        log(f"ATTENZIONE: non riesco a leggere {os.path.basename(percorso)}: {e}")
        return predefinito


def scrivi_json(percorso, dati):
    tmp = percorso + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(dati, f, ensure_ascii=False, indent=2)
    os.replace(tmp, percorso)


def carica_config():
    if not os.path.exists(CONFIG):
        scrivi_json(CONFIG, MODELLO_CONFIG)
        print("Ho creato accademia_config.json nella cartella del programma.")
        print("Aprilo con il Blocco note, compila api_id, api_hash e segreto, poi rilancia.")
        sys.exit(1)
    cfg = leggi_json(CONFIG, {})
    for k, v in MODELLO_CONFIG.items():
        cfg.setdefault(k, v)
    return cfg


def controlla_config(cfg, serve_sito=True):
    mancanti = [k for k in ("api_id", "api_hash") if not str(cfg.get(k, "")).strip()]
    if serve_sito:
        mancanti += [k for k in ("sito_url", "segreto") if not str(cfg.get(k, "")).strip()]
    if mancanti:
        print("Nel file accademia_config.json mancano: " + ", ".join(mancanti))
        sys.exit(1)


# ───────────────────────── messaggi ─────────────────────────

def nome_mittente(s):
    if s is None:
        return None
    titolo = getattr(s, "title", None)
    if titolo:
        return titolo
    nome = " ".join(p for p in (getattr(s, "first_name", None), getattr(s, "last_name", None)) if p)
    return nome or getattr(s, "username", None) or None


def tipo_media(msg):
    try:
        if msg.photo:
            return "foto"
        if msg.video or msg.video_note:
            return "video"
        if msg.voice or msg.audio:
            return "audio"
        if msg.sticker:
            return "sticker"
        if msg.poll:
            return "sondaggio"
        if msg.document:
            return "file"
    except Exception:
        pass
    return None


def topic_di(msg, e_forum):
    """Numero del topic a cui appartiene il messaggio (1 = Generale). None se il gruppo non ha forum."""
    if not e_forum:
        return None
    rt = getattr(msg, "reply_to", None)
    if rt is not None and getattr(rt, "forum_topic", False):
        return getattr(rt, "reply_to_top_id", None) or getattr(rt, "reply_to_msg_id", None) or 1
    return 1


def link_messaggio(entita, msg_id, topic_id):
    utente = getattr(entita, "username", None)
    base = f"https://t.me/{utente}" if utente else f"https://t.me/c/{entita.id}"
    if topic_id and topic_id != 1:
        return f"{base}/{topic_id}/{msg_id}"
    return f"{base}/{msg_id}"


class Gruppo:
    def __init__(self, peer_id, entita, e_forum):
        self.peer_id = peer_id
        self.entita = entita
        self.titolo = getattr(entita, "title", None) or str(peer_id)
        self.e_forum = e_forum
        self.topic = {}  # id topic -> titolo


def costruisci_record(msg, gruppo, mittente=None):
    """Trasforma un messaggio Telegram nel record da mandare al sito. None se non c'è niente da salvare."""
    if getattr(msg, "action", None) is not None:   # messaggi di servizio (entra, esce, nuovo topic...)
        return None
    testo = (getattr(msg, "message", None) or "").strip()
    media = tipo_media(msg)
    if not testo and not media:
        return None
    topic_id = topic_di(msg, gruppo.e_forum)
    if gruppo.e_forum and topic_id == 1 and 1 not in gruppo.topic:
        gruppo.topic[1] = "Generale"
    edit = getattr(msg, "edit_date", None)
    return {
        "chat_id": gruppo.peer_id,
        "chat_titolo": gruppo.titolo,
        "topic_id": topic_id,
        "topic_titolo": gruppo.topic.get(topic_id) if topic_id else None,
        "msg_id": msg.id,
        "data_msg": msg.date.astimezone(timezone.utc).isoformat(),
        "modificato_il": edit.astimezone(timezone.utc).isoformat() if edit else None,
        "mittente": mittente,
        "testo": testo or None,
        "media_tipo": media,
        "link": link_messaggio(gruppo.entita, msg.id, topic_id),
    }


# ───────────────────────── invio al sito ─────────────────────────

def invia_al_sito(cfg, messaggi):
    url = cfg["sito_url"].rstrip("/") + "/api/accademia/ingest"
    corpo = json.dumps({"messaggi": messaggi}).encode("utf-8")
    req = urllib.request.Request(
        url, data=corpo, method="POST",
        headers={"Content-Type": "application/json", "x-pt-segreto": cfg["segreto"], "User-Agent": "accademia-reader"},
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode("utf-8"))


class Spedizioniere:
    """Raccoglie i messaggi e li manda al sito a blocchi; se il sito non risponde li tiene da parte e riprova."""

    def __init__(self, cfg, prova=False):
        self.cfg = cfg
        self.prova = prova
        self.in_attesa = []
        self.stato = leggi_json(STATO, {})
        self.inviati = 0
        self.ultimo_errore = ""
        if not prova and os.path.exists(CODA):
            try:
                with open(CODA, "r", encoding="utf-8") as f:
                    self.in_attesa = [json.loads(r) for r in f if r.strip()]
                if self.in_attesa:
                    log(f"Recuperati {len(self.in_attesa)} messaggi non consegnati la volta scorsa")
            except Exception as e:
                log(f"ATTENZIONE: coda illeggibile: {e}")

    def aggiungi(self, record):
        if record is not None:
            self.in_attesa.append(record)

    def _salva_coda(self):
        if self.prova:
            return
        try:
            if self.in_attesa:
                with open(CODA, "w", encoding="utf-8") as f:
                    for r in self.in_attesa:
                        f.write(json.dumps(r, ensure_ascii=False) + "\n")
            elif os.path.exists(CODA):
                os.remove(CODA)
        except Exception as e:
            log(f"ATTENZIONE: non riesco a salvare la coda: {e}")

    async def svuota(self, tutto=True):
        """Manda i messaggi in attesa. Ritorna True se la coda è vuota."""
        loop = asyncio.get_running_loop()
        while self.in_attesa:
            blocco = self.in_attesa[:INVIO_MAX]
            if self.prova:
                self.in_attesa = self.in_attesa[len(blocco):]
                continue
            try:
                risposta = await loop.run_in_executor(None, invia_al_sito, self.cfg, blocco)
            except urllib.error.HTTPError as e:
                dettaglio = ""
                try:
                    dettaglio = e.read().decode("utf-8", "replace")[:200]
                except Exception:
                    pass
                self.ultimo_errore = f"HTTP {e.code} {dettaglio}"
                if e.code in (400, 401):   # chiave sbagliata o dati rifiutati: inutile riprovare all'infinito
                    log(f"ERRORE dal sito: {self.ultimo_errore}. Controlla sito_url e segreto in accademia_config.json")
                else:
                    log(f"Sito non raggiungibile ({self.ultimo_errore}): riprovo tra poco")
                self._salva_coda()
                return False
            except Exception as e:
                self.ultimo_errore = str(e)
                log(f"Sito non raggiungibile ({e}): riprovo tra poco")
                self._salva_coda()
                return False
            self.in_attesa = self.in_attesa[len(blocco):]
            self.inviati += len(blocco)
            for r in blocco:
                k = str(r["chat_id"])
                self.stato[k] = max(int(self.stato.get(k, 0)), int(r["msg_id"]))
            scrivi_json(STATO, self.stato)
            self._salva_coda()
            if not tutto:
                break
            log(f"Inviati {len(blocco)} messaggi (salvati dal sito: {risposta.get('salvati')}, scartati: {risposta.get('scartati')})")
        self._salva_coda()
        return True


# ───────────────────────── immagini ─────────────────────────

def e_immagine(msg):
    try:
        if msg.photo:
            return True
        d = msg.document
        return bool(d and (getattr(d, "mime_type", "") or "").startswith("image/"))
    except Exception:
        return False


def mime_immagine(msg):
    try:
        if msg.photo:
            return "image/jpeg"
        m = (getattr(msg.document, "mime_type", "") or "").lower()
        return m if m.startswith("image/") else "image/jpeg"
    except Exception:
        return "image/jpeg"


def vuole_immagine(cfg, titolo_gruppo, titolo_topic):
    c = cfg.get("immagini") or {}
    if not c.get("attiva", True):
        return False
    g = (titolo_gruppo or "").lower()
    t = (titolo_topic or "").lower()
    return (any(str(x).lower() in g for x in c.get("gruppi_contiene", []) if x)
            or any(str(x).lower() in t for x in c.get("topic_contiene", []) if x))


def invia_immagine(cfg, corpo):
    url = cfg["sito_url"].rstrip("/") + "/api/accademia/immagine"
    req = urllib.request.Request(
        url, data=json.dumps(corpo).encode("utf-8"), method="POST",
        headers={"Content-Type": "application/json", "x-pt-segreto": cfg["segreto"], "User-Agent": "accademia-reader"},
    )
    with urllib.request.urlopen(req, timeout=90) as r:
        return json.loads(r.read().decode("utf-8"))


class LettoreImmagini:
    """Scarica le foto dei gruppi scelti e le manda al sito, che le fa leggere. Le nuove hanno la precedenza sullo storico."""

    LAVORATORI = 3

    def __init__(self, client, cfg):
        self.client = client
        self.cfg = cfg
        self.coda = asyncio.PriorityQueue()
        self.n = 0
        self.fatte = set(leggi_json(STATO_IMM, []))
        self.in_coda = set()
        self.ferme = False
        self.lette = 0

    def accoda(self, msg, gr, topic_titolo, priorita, tentativi=0):
        k = f"{gr.peer_id}:{msg.id}"
        if k in self.fatte or (k in self.in_coda and tentativi == 0):
            return
        self.in_coda.add(k)
        self.n += 1
        self.coda.put_nowait((priorita, self.n, tentativi, msg, gr, topic_titolo))

    def _salva(self):
        try:
            scrivi_json(STATO_IMM, sorted(self.fatte))
        except Exception as e:
            log(f"ATTENZIONE: non riesco a salvare {os.path.basename(STATO_IMM)}: {e}")

    def _riprova(self, priorita, tentativi, msg, gr, topic, dopo):
        asyncio.get_running_loop().call_later(dopo, self.accoda, msg, gr, topic, priorita, tentativi + 1)

    async def lavora(self):
        loop = asyncio.get_running_loop()
        while not self.ferme:
            priorita, _, tentativi, msg, gr, topic = await self.coda.get()
            k = f"{gr.peer_id}:{msg.id}"
            nome = f"{gr.titolo}{' / ' + topic if topic else ''} #{msg.id}"
            try:
                dati = await self.client.download_media(msg, file=bytes)
                if not dati:
                    raise ValueError("download vuoto")
                if len(dati) > 3_500_000:
                    log(f"Immagine troppo grande, la salto: {nome}")
                    self.fatte.add(k)
                    self.in_coda.discard(k)
                    continue
                corpo = {"chat_id": gr.peer_id, "msg_id": msg.id, "immagine_base64": base64.b64encode(dati).decode("ascii"),
                         "mime": mime_immagine(msg), "gruppo": gr.titolo, "topic": topic or "",
                         "didascalia": (getattr(msg, "message", None) or "")[:300]}
                esito = await loop.run_in_executor(None, invia_immagine, self.cfg, corpo)
                self.fatte.add(k)
                self.in_coda.discard(k)
                self.lette += 1
                if self.lette % 5 == 0:
                    self._salva()
                if esito.get("gia_letta"):
                    continue
                log(f"Immagine letta: {nome} ({esito.get('caratteri')} caratteri)")
            except urllib.error.HTTPError as e:
                dettaglio = ""
                try:
                    dettaglio = e.read().decode("utf-8", "replace")[:200]
                except Exception:
                    pass
                if e.code == 401:
                    log(f"ERRORE immagini: chiave non accettata dal sito (401). Controlla segreto. Fermo la lettura immagini. {dettaglio}")
                    self.ferme = True
                    return
                if e.code == 500 and "LUCY_ANTHROPIC_API_KEY" in dettaglio:
                    log("ERRORE immagini: su Vercel manca LUCY_ANTHROPIC_API_KEY (o serve un Redeploy). Fermo la lettura immagini.")
                    self.ferme = True
                    return
                if e.code in (409, 429, 503) or e.code >= 500:
                    if tentativi < 6:
                        self._riprova(priorita, tentativi, msg, gr, topic, (15 if e.code == 409 else 60) * (tentativi + 1))
                        log(f"Immagine rimandata ({e.code}): {nome}")
                    else:
                        self.in_coda.discard(k)
                        log(f"Immagine non letta dopo vari tentativi ({e.code}): {nome}. Ci riprovo alla prossima partenza.")
                else:
                    self.in_coda.discard(k)
                    self.fatte.add(k)
                    log(f"Immagine rifiutata dal sito ({e.code} {dettaglio}): {nome}")
            except Exception as e:
                if tentativi < 3:
                    self._riprova(priorita, tentativi, msg, gr, topic, 30)
                else:
                    self.in_coda.discard(k)
                log(f"Errore sull'immagine {nome}: {e}")
            await asyncio.sleep(1)


async def accoda_storico_immagini(client, gruppi, lettore, cfg):
    from telethon.tl.types import InputMessagesFilterPhotos
    c = cfg.get("immagini") or {}
    da = datetime.now(timezone.utc) - timedelta(days=int(c.get("giorni_storico") or 90))
    totale = 0
    for gr in gruppi:
        try:
            async for msg in client.iter_messages(gr.entita, filter=InputMessagesFilterPhotos):
                if msg.date < da:
                    break
                tid = topic_di(msg, gr.e_forum)
                tit = gr.topic.get(tid) if tid else None
                if vuole_immagine(cfg, gr.titolo, tit):
                    lettore.accoda(msg, gr, tit, 1)
                    totale += 1
        except Exception as e:
            log(f"Non riesco a elencare le foto di '{gr.titolo}': {e}")
    log(f"Immagini da leggere dello storico (ultimi {c.get('giorni_storico', 90)} giorni): {totale}")


async def prova_immagine(client, gruppi, cfg):
    from telethon.tl.types import InputMessagesFilterPhotos
    for gr in gruppi:
        async for msg in client.iter_messages(gr.entita, filter=InputMessagesFilterPhotos, limit=40):
            tid = topic_di(msg, gr.e_forum)
            tit = gr.topic.get(tid) if tid else None
            if not vuole_immagine(cfg, gr.titolo, tit):
                continue
            dati = await client.download_media(msg, file=bytes)
            corpo = {"chat_id": gr.peer_id, "msg_id": msg.id, "immagine_base64": base64.b64encode(dati).decode("ascii"),
                     "mime": mime_immagine(msg), "gruppo": gr.titolo, "topic": tit or "",
                     "didascalia": (getattr(msg, "message", None) or "")[:300], "solo_prova": True}
            print(f"\nFoto di prova: {gr.titolo}{' / ' + tit if tit else ''} (messaggio {msg.id}, {len(dati) // 1024} KB)")
            loop = asyncio.get_running_loop()
            try:
                esito = await loop.run_in_executor(None, invia_immagine, cfg, corpo)
            except urllib.error.HTTPError as e:
                print(f"ERRORE dal sito: {e.code} {e.read().decode('utf-8', 'replace')[:300]}")
                return
            print("\n--- TESTO LETTO ---\n" + esito.get("testo", "") + f"\n--- costo stimato: {esito.get('costo_usd', 0):.5f} $ ---")
            return
    print("Non ho trovato nessuna foto che rientri nelle regole 'immagini' (gruppi_contiene / topic_contiene) tra gli ultimi messaggi.")


# ───────────────────────── Telegram ─────────────────────────

def importa_telethon():
    try:
        from telethon import TelegramClient, events, utils  # noqa: F401
        return True
    except ImportError:
        print("Manca Telethon. Apri il Prompt dei comandi e scrivi:  pip install telethon")
        sys.exit(1)


async def carica_topic(client, gruppo):
    try:
        from telethon.tl.functions.messages import GetForumTopicsRequest
        r = await client(GetForumTopicsRequest(peer=gruppo.entita, offset_date=None, offset_id=0, offset_topic=0, limit=100))
        gruppo.topic = {t.id: (getattr(t, "title", None) or str(t.id)) for t in r.topics}
    except Exception as e:
        log(f"Non riesco a leggere i topic di '{gruppo.titolo}': {e}")


async def elenco_dialoghi(client):
    from telethon import utils
    righe = []
    async for d in client.iter_dialogs():
        e = d.entity
        if not (d.is_group or d.is_channel):
            continue
        righe.append((utils.get_peer_id(e), e, bool(getattr(e, "forum", False))))
    return righe


async def comando_elenco(client, con_topic=True):
    righe = await elenco_dialoghi(client)
    for i, (pid, e, forum) in enumerate(righe, 1):
        print(f"{i:3d}. {e.title}{'   [con topic]' if forum else ''}   (id {pid})")
        if forum and con_topic:
            g = Gruppo(pid, e, True)
            await carica_topic(client, g)
            for tid, tit in g.topic.items():
                print(f"       - topic {tid}: {tit}")
    return righe


async def comando_scegli(client, cfg):
    righe = await elenco_dialoghi(client)
    for i, (pid, e, forum) in enumerate(righe, 1):
        print(f"{i:3d}. {e.title}{'   [con topic]' if forum else ''}")
    scelta = input("\nScrivi i numeri dei gruppi dell'Accademia, separati da virgola (es. 3,5,8): ")
    gruppi = []
    for n in scelta.replace(" ", "").split(","):
        if n.isdigit() and 1 <= int(n) <= len(righe):
            pid, e, _ = righe[int(n) - 1]
            gruppi.append({"id": pid, "titolo": e.title})
    if not gruppi:
        print("Nessun gruppo scelto, non cambio niente.")
        return
    cfg["gruppi"] = gruppi
    scrivi_json(CONFIG, cfg)
    print("\nSalvati:")
    for g in gruppi:
        print("  -", g["titolo"])


async def risolvi_gruppi(client, cfg):
    from telethon import utils
    await client.get_dialogs()  # riempie la memoria interna dei gruppi
    gruppi = []
    for g in cfg["gruppi"]:
        try:
            e = await client.get_entity(g["id"])
        except Exception as ex:
            log(f"Non trovo il gruppo '{g.get('titolo')}' ({g['id']}): {ex}")
            continue
        gr = Gruppo(utils.get_peer_id(e), e, bool(getattr(e, "forum", False)))
        if gr.e_forum:
            await carica_topic(client, gr)
        gruppi.append(gr)
    return gruppi


async def nome_di(msg):
    try:
        s = msg.sender or await msg.get_sender()
        return nome_mittente(s)
    except Exception:
        return None


async def recupera_arretrati(client, gruppi, sped, cfg, prova):
    since = datetime.now(timezone.utc) - timedelta(days=int(cfg.get("giorni_indietro") or 7))
    for gr in gruppi:
        ultimo = int(sped.stato.get(str(gr.peer_id), 0))
        n = 0
        if prova:
            it = client.iter_messages(gr.entita, limit=20)   # in prova: solo gli ultimi 20, mostrati a schermo
        elif ultimo:
            it = client.iter_messages(gr.entita, min_id=ultimo, reverse=True)
        else:
            it = client.iter_messages(gr.entita, offset_date=since, reverse=True)
        async for msg in it:
            rec = costruisci_record(msg, gr, await nome_di(msg))
            if rec is None:
                continue
            if prova:
                quando = rec["data_msg"][:16].replace("T", " ")
                topic = f" / {rec['topic_titolo'] or rec['topic_id']}" if rec["topic_id"] else ""
                anteprima = (rec["testo"] or f"[{rec['media_tipo']}]").replace("\n", " ")[:110]
                print(f"[{gr.titolo}{topic}] {quando} {rec['mittente'] or '?'}: {anteprima}")
            else:
                sped.aggiungi(rec)
                if len(sped.in_attesa) >= INVIO_MAX:
                    await sped.svuota(tutto=False)
            n += 1
        log(f"{gr.titolo}: {n} messaggi {'letti (prova)' if prova else 'recuperati'}")
        if not prova:
            await sped.svuota()


async def ascolta(client, gruppi, sped, lettore=None, cfg=None):
    from telethon import events
    per_id = {g.peer_id: g for g in gruppi}
    ids = list(per_id.keys())

    async def gestisci(ev):
        try:
            msg = ev.message
            chat = await ev.get_chat()
            from telethon import utils
            gr = per_id.get(utils.get_peer_id(chat))
            if gr is None:
                return
            topic_id = topic_di(msg, gr.e_forum)
            if topic_id and topic_id not in gr.topic:   # topic nuovo: aggiorno i nomi
                await carica_topic(client, gr)
            sped.aggiungi(costruisci_record(msg, gr, await nome_di(msg)))
            if lettore is not None and e_immagine(msg):
                tit = gr.topic.get(topic_id) if topic_id else None
                if vuole_immagine(cfg, gr.titolo, tit):
                    lettore.accoda(msg, gr, tit, 0)   # le nuove passano avanti allo storico
        except Exception:
            log("Errore su un messaggio:\n" + traceback.format_exc())

    client.add_event_handler(gestisci, events.NewMessage(chats=ids))
    client.add_event_handler(gestisci, events.MessageEdited(chats=ids))
    log(f"In ascolto su {len(gruppi)} gruppi: " + ", ".join(g.titolo for g in gruppi))

    async def ciclo_invio():
        while True:
            await asyncio.sleep(INTERVALLO_INVIO)
            if sped.in_attesa:
                if not await sped.svuota():
                    await asyncio.sleep(55)   # sito giù o chiave sbagliata: non intaso il log, riprovo dopo un minuto

    asyncio.ensure_future(ciclo_invio())
    await client.run_until_disconnected()


async def principale(modo):
    from telethon import TelegramClient
    cfg = carica_config()
    controlla_config(cfg, serve_sito=(modo in ("ascolto", "prova_img")))
    client = TelegramClient(SESSIONE, int(cfg["api_id"]), cfg["api_hash"])
    await client.start()   # la prima volta chiede numero di telefono e codice
    try:
        if modo == "elenco":
            await comando_elenco(client)
            return
        if modo == "scegli":
            await comando_scegli(client, cfg)
            return
        if modo == "prova_img":
            gruppi_p = await risolvi_gruppi(client, cfg)
            await prova_immagine(client, gruppi_p, cfg)
            return
        if not cfg["gruppi"]:
            print("Nessun gruppo scelto. Lancia:  python accademia_reader.py --scegli")
            return
        gruppi = await risolvi_gruppi(client, cfg)
        if not gruppi:
            print("Non trovo nessuno dei gruppi scelti. Rilancia --scegli.")
            return
        sped = Spedizioniere(cfg, prova=(modo == "prova"))
        await recupera_arretrati(client, gruppi, sped, cfg, prova=(modo == "prova"))
        if modo == "prova":
            print("\nProva finita: non ho mandato niente al sito.")
            return
        await sped.svuota()
        lettore = None
        if (cfg.get("immagini") or {}).get("attiva", True):
            lettore = LettoreImmagini(client, cfg)
            for _ in range(LettoreImmagini.LAVORATORI):
                asyncio.ensure_future(lettore.lavora())
            asyncio.ensure_future(accoda_storico_immagini(client, gruppi, lettore, cfg))
        await ascolta(client, gruppi, sped, lettore, cfg)
    finally:
        await client.disconnect()


def main(argv):
    importa_telethon()
    modo = "ascolto"
    if "--elenco" in argv:
        modo = "elenco"
    elif "--scegli" in argv:
        modo = "scegli"
    elif "--prova-immagine" in argv:
        modo = "prova_img"
    elif "--prova" in argv:
        modo = "prova"
    attesa = 10
    while True:
        try:
            asyncio.run(principale(modo))
            if modo != "ascolto":
                return
            log("Connessione chiusa: riparto tra 10 secondi")
        except KeyboardInterrupt:
            log("Fermato da tastiera")
            return
        except SystemExit:
            raise
        except Exception:
            log("ERRORE:\n" + traceback.format_exc())
            if modo != "ascolto":
                return
        time.sleep(attesa)
        attesa = min(attesa * 2, 300)


if __name__ == "__main__":
    main(sys.argv[1:])
