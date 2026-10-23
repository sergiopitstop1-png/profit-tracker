#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
risultati_partite.py  ·  23/10/2026

Cerca su API-Football il risultato finale delle partite dei segnali (Hunterbet e ScoreTrend) e lo scrive sul sito.
Il sito poi calcola da solo vinta/persa (quelli corretti a mano non vengono toccati).

COME SI USA
  python risultati_partite.py            → lavora davvero (è quello che lancia la pianificazione)
  python risultati_partite.py --prova    → NON scrive niente sul sito: mostra solo cosa troverebbe (serve per controllare la copertura)

Si lancia da solo agli orari decisi con  installa_pianificazione.ps1  (vedi LEGGIMI.txt).
Usa solo la libreria standard di Python: non serve installare niente.

CONFIGURAZIONE  (file  risultati_config.json  nella stessa cartella: la prima volta lo crea il programma, poi lo compili col Blocco note)
  "sito_url":         "https://sergioapicella.it"
  "segreto":          il valore di SEGNALI_SECRET su Vercel (lo stesso che hai messo nel lettore Accademia/Hunterbet)
  "api_football_key": la chiave dalla dashboard di API-Football
"""
import difflib
import json
import os
import re
import sys
import time
import unicodedata
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone

QUI = os.path.dirname(os.path.abspath(__file__))
FILE_CONFIG = os.path.join(QUI, 'risultati_config.json')
FILE_LOG = os.path.join(QUI, 'risultati_partite.log')

MAX_MINUTI_API = 150           # chiamate per leggere i gol (una per partita) in ogni esecuzione: le partite vecchie si recuperano a piccoli passi
MAX_CHIAMATE_API = 40          # tetto di sicurezza per ogni esecuzione (il piano Pro ne concede 7.500 al giorno)
SOGLIA_NOME = 0.55             # somiglianza minima di ciascuna squadra
SOGLIA_COPPIA = 0.72           # somiglianza media minima della partita
FINITA = {'FT', 'AET', 'PEN'}
ANNULLATA = {'PST', 'CANC', 'ABD', 'AWD', 'WO'}

ALIAS = {   # nomi che API-Football scrive in modo molto diverso da Hunterbet
    'wolves': 'wolverhampton wanderers', 'man utd': 'manchester united', 'man united': 'manchester united', 'man city': 'manchester city',
    'spurs': 'tottenham', 'inter': 'internazionale', 'atletico madrid': 'atletico madrid', 'atl madrid': 'atletico madrid',
    'psg': 'paris saint germain', 'paris sg': 'paris saint germain', 'bayern': 'bayern munich', 'bayern munchen': 'bayern munich',
    'leverkusen': 'bayer leverkusen', 'gladbach': 'borussia monchengladbach', 'sheffield utd': 'sheffield united', 'west brom': 'west bromwich albion',
    'milton keynes dons': 'milton keynes dons', 'mk dons': 'milton keynes dons', 'agf': 'aarhus', 'qpr': 'queens park rangers', 'brighton': 'brighton and hove albion',
}
GENERICHE = {'fc', 'cf', 'sc', 'ac', 'afc', 'cd', 'ud', 'sd', 'fk', 'sk', 'club', 'the'}


# ───────────────────────── configurazione e log ─────────────────────────
MODELLO_CONFIG = {'sito_url': 'https://sergioapicella.it', 'segreto': '', 'api_football_key': ''}


def carica_config():
    """Legge risultati_config.json (se manca lo crea vuoto). Le variabili d'ambiente SITO_URL, SEGNALI_SECRET, API_FOOTBALL_KEY, API_FOOTBALL_URL hanno la precedenza."""
    j = {}
    if os.path.exists(FILE_CONFIG):
        with open(FILE_CONFIG, encoding='utf-8-sig') as f:
            j = json.load(f)
    else:
        with open(FILE_CONFIG, 'w', encoding='utf-8') as f:
            json.dump(MODELLO_CONFIG, f, indent=2, ensure_ascii=False)
    cfg = {
        'SITO_URL': os.environ.get('SITO_URL') or j.get('sito_url') or MODELLO_CONFIG['sito_url'],
        'SEGNALI_SECRET': os.environ.get('SEGNALI_SECRET') or j.get('segreto') or '',
        'API_FOOTBALL_KEY': os.environ.get('API_FOOTBALL_KEY') or j.get('api_football_key') or '',
        'API_FOOTBALL_URL': os.environ.get('API_FOOTBALL_URL') or j.get('api_football_url') or 'https://v3.football.api-sports.io',
    }
    cfg['SITO_URL'] = cfg['SITO_URL'].rstrip('/')
    cfg['API_FOOTBALL_URL'] = cfg['API_FOOTBALL_URL'].rstrip('/')
    return cfg


def log(msg, solo_file=False):
    riga = f"{datetime.now().strftime('%d/%m %H:%M:%S')}  {msg}"
    if not solo_file:
        print(msg)
    try:
        if os.path.exists(FILE_LOG) and os.path.getsize(FILE_LOG) > 1_000_000:   # il file di log non cresce all'infinito
            os.replace(FILE_LOG, FILE_LOG + '.vecchio')
        with open(FILE_LOG, 'a', encoding='utf-8') as f:
            f.write(riga + '\n')
    except OSError:
        pass


# ───────────────────────── rete ─────────────────────────
class ErroreRete(Exception):
    pass


def chiama(url, metodo='GET', intestazioni=None, corpo=None, tentativi=3):
    """Chiamata HTTP con riprova: un'esitazione della rete (handshake lento, timeout) non deve far saltare l'esecuzione.
    Gli errori veri (401, 500, chiave rifiutata) NON si ripetono: si riprova solo quando la rete non risponde."""
    dati = json.dumps(corpo).encode('utf-8') if corpo is not None else None
    h = {'User-Agent': 'risultati-partite/1.0', 'Accept': 'application/json'}
    if dati is not None:
        h['Content-Type'] = 'application/json'
    h.update(intestazioni or {})
    ultimo = ''
    for n in range(1, tentativi + 1):
        req = urllib.request.Request(url, data=dati, headers=h, method=metodo)
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.loads(r.read().decode('utf-8'))
        except urllib.error.HTTPError as e:
            try:
                testo = e.read().decode('utf-8', 'replace')[:300]
            except Exception:
                testo = ''
            raise ErroreRete(f'errore {e.code} da {url.split("?")[0]} {testo}')
        except (urllib.error.URLError, TimeoutError, OSError) as e:
            ultimo = f'rete non raggiungibile ({url.split("?")[0]}): {e}'
            if n < tentativi:
                log(f'  la rete non ha risposto (tentativo {n} di {tentativi}), riprovo tra {5 * n} secondi…')
                time.sleep(5 * n)
        except ValueError as e:
            raise ErroreRete(f'risposta non valida da {url.split("?")[0]}: {e}')
    raise ErroreRete(ultimo)


def sito(cfg, percorso, metodo='GET', corpo=None):
    return chiama(cfg['SITO_URL'] + percorso, metodo, {'x-pt-segreto': cfg['SEGNALI_SECRET']}, corpo)


class ApiFootball:
    def __init__(self, cfg):
        self.base, self.chiave = cfg['API_FOOTBALL_URL'], cfg['API_FOOTBALL_KEY']
        self.chiamate = 0
        self.minuti = 0
        self.per_data = {}

    def partite_del(self, giorno):
        """Tutte le partite di un giorno (una sola chiamata per giorno, poi in memoria)."""
        if giorno in self.per_data:
            return self.per_data[giorno]
        if self.chiamate >= MAX_CHIAMATE_API:
            raise ErroreRete('raggiunto il tetto di chiamate per questa esecuzione')
        self.chiamate += 1
        j = chiama(f'{self.base}/fixtures?date={giorno}', intestazioni={'x-apisports-key': self.chiave})
        errori = j.get('errors')
        if errori:   # l'API risponde 200 anche quando rifiuta (chiave sbagliata, account sospeso, limite superato…)
            testo = json.dumps(errori, ensure_ascii=False) if isinstance(errori, (dict, list)) else str(errori)
            raise ErroreRete('API-Football ha risposto: ' + testo[:300])
        self.per_data[giorno] = j.get('response') or []
        return self.per_data[giorno]


    def partita_con_eventi(self, fixture_id):
        """Una partita con i suoi eventi (gol): una chiamata per partita."""
        if self.minuti >= MAX_MINUTI_API:
            raise ErroreRete('raggiunto il tetto di chiamate per leggere i gol (le altre partite alla prossima esecuzione)')
        self.minuti += 1
        j = chiama(f'{self.base}/fixtures?id={fixture_id}', intestazioni={'x-apisports-key': self.chiave})
        errori = j.get('errors')
        if errori:
            testo = json.dumps(errori, ensure_ascii=False) if isinstance(errori, (dict, list)) else str(errori)
            raise ErroreRete('API-Football ha risposto: ' + testo[:300])
        r = j.get('response') or []
        return r[0] if r else None


# ───────────────────────── confronto dei nomi ─────────────────────────
def norma(s):
    s = unicodedata.normalize('NFKD', str(s or '')).encode('ascii', 'ignore').decode('ascii').lower()
    s = s.replace('&', ' and ')
    s = re.sub(r'[^a-z0-9]+', ' ', s).strip()
    s = ALIAS.get(s, s)
    toks = [t for t in s.split() if t not in GENERICHE]
    return ' '.join(toks) if toks else s


def somiglianza(a, b):
    a, b = norma(a), norma(b)
    if not a or not b:
        return 0.0
    if a == b:
        return 1.0
    r = difflib.SequenceMatcher(None, a, b).ratio()
    ta, tb = set(a.split()), set(b.split())
    if ta and tb:
        inter = len(ta & tb)
        if inter and (ta <= tb or tb <= ta):                 # "Al Taawoun" dentro "Al Taawoun FC"
            r = max(r, 0.85)
        r = max(r, inter / max(len(ta), len(tb)))
    return r


def parse_data(testo):
    try:
        d = datetime.fromisoformat(str(testo).replace('Z', '+00:00'))
        return d if d.tzinfo else d.replace(tzinfo=timezone.utc)
    except (ValueError, TypeError):
        return None


def cerca_partita(riga, api):
    """Restituisce (partita, punteggio, migliori_candidati). partita è None se non trovata."""
    messaggio = parse_data(riga.get('data_msg'))
    if not messaggio:
        return None, 0, []
    giorni = {(messaggio + timedelta(days=d)).strftime('%Y-%m-%d') for d in (-1, 0, 1)}
    if riga.get('data_partita'):
        dp = parse_data(riga['data_partita'])
        if dp:
            giorni.add(dp.strftime('%Y-%m-%d'))
    candidati = []
    for g in sorted(giorni):
        for p in api.partite_del(g):
            inizio = parse_data((p.get('fixture') or {}).get('date'))
            if not inizio:
                continue
            ore = (inizio - messaggio).total_seconds() / 3600
            if ore < -4.5 or ore > 40:               # il segnale LIVE arriva a partita iniziata, il PRE-LIVE prima del calcio d'inizio
                continue
            t = p.get('teams') or {}
            sc = somiglianza(riga.get('casa'), (t.get('home') or {}).get('name'))
            so = somiglianza(riga.get('ospite'), (t.get('away') or {}).get('name'))
            candidati.append(((sc + so) / 2, sc, so, abs(ore), p))
    candidati.sort(key=lambda c: (-c[0], c[3]))
    if candidati and candidati[0][0] >= SOGLIA_COPPIA and candidati[0][1] >= SOGLIA_NOME and candidati[0][2] >= SOGLIA_NOME:
        return candidati[0][4], candidati[0][0], candidati[:3]
    return None, candidati[0][0] if candidati else 0, candidati[:3]


def risultato_da(partita):
    """(ht_casa, ht_ospite, ft_casa, ft_ospite, stato). Il finale è quello dei 90 minuti (score.fulltime), anche se la partita è andata ai supplementari."""
    stato = ((partita.get('fixture') or {}).get('status') or {}).get('short') or ''
    sc = partita.get('score') or {}
    ht, ft = sc.get('halftime') or {}, sc.get('fulltime') or {}
    if stato not in FINITA:
        return None, None, None, None, stato
    fc, fo = ft.get('home'), ft.get('away')
    if fc is None or fo is None:
        g = partita.get('goals') or {}
        fc, fo = (g.get('home'), g.get('away')) if stato == 'FT' else (None, None)
    return ht.get('home'), ht.get('away'), fc, fo, stato


def nome(r):
    return f"{r.get('casa') or '?'} – {r.get('ospite') or '?'}"


# ───────────────────────── minuti: gol vincente e minuto del segnale ─────────────────────────
def gol_dei_90(partita):
    """Gol dei 90 minuti in ordine: [(minuto, recupero, 'casa'|'ospite')]. None se non tornano col risultato finale (allora non si fida)."""
    ft = (partita.get('score') or {}).get('fulltime') or {}
    fc, fo = ft.get('home'), ft.get('away')
    if fc is None or fo is None:
        return None
    id_casa = ((partita.get('teams') or {}).get('home') or {}).get('id')

    def costruisci(autogol_invertito):
        out = []
        for e in partita.get('events') or []:
            if e.get('type') != 'Goal':
                continue
            det = e.get('detail') or ''
            if 'Missed' in det:                         # rigore sbagliato: non e' un gol
                continue
            t = e.get('time') or {}
            m = t.get('elapsed')
            if m is None or m > 90:                     # supplementari: il mercato vale 90 minuti
                continue
            casa = (e.get('team') or {}).get('id') == id_casa
            if 'Own' in det and autogol_invertito:      # l'autogol conta per la squadra avversaria
                casa = not casa
            out.append((m, t.get('extra') or 0, 'casa' if casa else 'ospite'))
        out.sort(key=lambda g: (g[0], g[1]))
        return out

    for invertito in (True, False):                     # API-Football non e' coerente sugli autogol: vale la lettura che torna col risultato
        g = costruisci(invertito)
        if (sum(1 for x in g if x[2] == 'casa'), sum(1 for x in g if x[2] == 'ospite')) == (fc, fo):
            return g
    return None


def minuti_segnale(riga, partita):
    """(minuto_gol, extra, minuto_stimato_segnale) per un segnale Gol casa/ospiti. Valori None quando non si puo' dire."""
    gol = gol_dei_90(partita)
    sc, so = riga.get('score_casa_segnale'), riga.get('score_ospite_segnale')
    if gol is None or sc is None or so is None:
        return None, None, None
    n0 = int(sc) + int(so)                              # gol gia' segnati quando e' arrivato il segnale
    if n0 > len(gol) or (sum(1 for x in gol[:n0] if x[2] == 'casa'), sum(1 for x in gol[:n0] if x[2] == 'ospite')) != (int(sc), int(so)):
        return None, None, None                         # il punteggio al segnale non torna con la sequenza dei gol
    lato = 'casa' if riga.get('tipo_segnale') == 'GOL_CASA' else 'ospite'
    vincente = next((g for g in gol[n0:] if g[2] == lato), None)
    mg, ex = (vincente[0], vincente[1] or None) if vincente else (None, None)

    # minuto del segnale: dall'orario del messaggio rispetto al calcio d'inizio (15' di intervallo), tenuto fra il gol precedente e il successivo
    stima = None
    inizio = parse_data((partita.get('fixture') or {}).get('date'))
    msg = parse_data(riga.get('data_msg'))
    if inizio and msg:
        d = (msg - inizio).total_seconds() / 60
        if d >= 0:
            m = d if d <= 46 else (45 if d <= 62 else d - 15)
            lo = gol[n0 - 1][0] if n0 > 0 else 0
            hi = gol[n0][0] if n0 < len(gol) else 95
            stima = int(round(max(lo, min(hi, m), 1)))
    return mg, ex, stima


def fase_minuti(cfg, api, elenco, prova):
    """Legge i gol delle partite gia' chiuse e scrive minuto del gol vincente e minuto stimato del segnale. Non blocca mai il resto."""
    if not elenco:
        return
    log(f'Minuti da leggere (partite Gol casa/ospiti gia\' finite): {len(elenco)}')
    righe, fatti = [], 0
    try:
        for r in elenco:
            fid = r.get('af_fixture_id') or r.get('fixture_id')
            partita = api.partita_con_eventi(fid)
            if not partita:
                righe.append({'msg_id': r['msg_id']})
                continue
            mg, ex, stima = minuti_segnale(r, partita)
            righe.append({'msg_id': r['msg_id'], 'minuto_gol': mg, 'minuto_gol_extra': ex, 'minuto_segnale_stimato': stima})
            fatti += 1
            if mg is not None or stima is not None:
                g = f"gol vincente al {mg}'" + (f"+{ex}" if ex else '') if mg is not None else 'nessun gol dopo il segnale'
                log(f"  {nome(r)}: {g}" + (f" · segnale ≈ {stima}'" if stima is not None else ''), solo_file=True)
    except ErroreRete as e:
        log('Minuti: mi fermo qui (' + str(e) + ')')
    log(f'Minuti letti: {len(righe)} partite' + ('  (PROVA: non scrivo)' if prova else ''))
    if prova or not righe:
        return
    try:
        for i in range(0, len(righe), 500):
            esito = sito(cfg, '/api/segnali/risultati', 'POST', {'azione': 'minuti', 'righe': righe[i:i + 500]})
            log(f"Sito (minuti): {esito.get('aggiornati', 0)} righe aggiornate", solo_file=True)
    except ErroreRete as e:
        log('Errore scrivendo i minuti sul sito: ' + str(e))


# ───────────────────────── programma ─────────────────────────
def main(argv):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass
    prova = '--prova' in argv
    cfg = carica_config()
    nomi = {'SEGNALI_SECRET': 'segreto', 'API_FOOTBALL_KEY': 'api_football_key'}
    mancano = [nomi[k] for k in nomi if not cfg.get(k)]
    if mancano:
        print(f'Apri con il Blocco note il file {FILE_CONFIG} e compila: ' + ', '.join(mancano))
        return 2

    log(f"=== {'PROVA (non scrive niente)' if prova else 'Avvio'} ===", solo_file=not prova)
    log(f"Leggo i segnali dal sito ({cfg['SITO_URL']})…")
    try:
        letti = sito(cfg, '/api/segnali/risultati')
        elenco = letti.get('mancanti') or []
        da_minuti = letti.get('minuti') or []
        if letti.get('minuti_errore'):
            log('Minuti non letti (lancia hunterbet_minuti.sql in Supabase): ' + str(letti['minuti_errore'])[:200])
    except ErroreRete as e:
        log('Non riesco a leggere i segnali dal sito: ' + str(e))
        return 1
    log(f'Segnali senza risultato da cercare: {len(elenco)}')

    api = ApiFootball(cfg)
    da_scrivere = {'hunterbet': [], 'scoretrend': []}
    trovati = non_finiti = non_trovati = 0
    try:
        for r in elenco:
            partita, punti, vicini = cerca_partita(r, api)
            if partita is None:
                non_trovati += 1
                riga_out = {'msg_id': r['msg_id'], 'non_trovata': True}
                da_scrivere[r['tabella']].append(riga_out)
                ex = ' | '.join(f"{(c[4].get('teams') or {}).get('home', {}).get('name')} – {(c[4].get('teams') or {}).get('away', {}).get('name')} ({c[0]:.2f})" for c in vicini)
                log(f"✗ non trovata  {nome(r)}" + (f'   [più simili: {ex}]' if ex else '   [nessuna partita vicina per orario]'))
                continue
            ht_c, ht_o, ft_c, ft_o, stato = risultato_da(partita)
            t = partita.get('teams') or {}
            chi = f"{(t.get('home') or {}).get('name')} – {(t.get('away') or {}).get('name')}"
            riga_out = {'msg_id': r['msg_id'], 'af_fixture_id': (partita.get('fixture') or {}).get('id'), 'af_stato': stato}
            if ft_c is not None and ft_o is not None:
                riga_out.update({'ft_casa': ft_c, 'ft_ospite': ft_o, 'ht_casa': ht_c, 'ht_ospite': ht_o})
                trovati += 1
                pt = f" (1°T {ht_c}-{ht_o})" if ht_c is not None and ht_o is not None else ''
                log(f"✓ {nome(r)}  →  {ft_c}-{ft_o}{pt}   [{chi}, somiglianza {punti:.2f}]")
            else:
                non_finiti += 1
                if stato in ANNULLATA:
                    log(f"– {nome(r)}  →  partita {stato} (rinviata/annullata)   [{chi}]")
                else:
                    log(f"… {nome(r)}  →  non ancora finita ({stato or 'stato sconosciuto'})   [{chi}]")
            da_scrivere[r['tabella']].append(riga_out)
    except ErroreRete as e:
        log('STOP: ' + str(e) + '\nNon scrivo niente di questa esecuzione (per non segnare come "non trovate" partite che non ho potuto cercare).')
        return 1

    log(f'Riepilogo: {trovati} con risultato, {non_finiti} non finite, {non_trovati} non trovate  ({api.chiamate} chiamate ad API-Football)')
    if prova:
        fase_minuti(cfg, api, da_minuti, True)
        print('PROVA: non ho scritto niente sul sito.')
        return 0

    try:
        for tabella, righe in da_scrivere.items():
            for i in range(0, len(righe), 500):
                esito = sito(cfg, '/api/segnali/risultati', 'POST', {'tabella': tabella, 'righe': righe[i:i + 500]})
                log(f"Sito ({tabella}): {esito.get('aggiornati', 0)} righe aggiornate", solo_file=True)
        chiusi = sito(cfg, '/api/segnali/risultati', 'POST', {'azione': 'chiudi_esiti'}).get('chiusi', 0)
        log(f'Esiti chiusi (vinta/persa) sul sito: {chiusi}')
    except ErroreRete as e:
        log('Errore scrivendo sul sito: ' + str(e))
        return 1
    # 24/10/2026: i minuti si leggono DOPO aver scritto i risultati, cosi' le partite appena chiuse in questa stessa esecuzione sono gia' incluse
    try:
        da_minuti = sito(cfg, '/api/segnali/risultati').get('minuti') or da_minuti
    except ErroreRete:
        pass
    fase_minuti(cfg, api, da_minuti, False)
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
