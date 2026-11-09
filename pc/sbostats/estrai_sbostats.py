"""Estrazione assistita delle tabelle Match Analysis di SBOStats (v2).

Novita' rispetto alla v1:
- le righe vengono riconosciute dal CONTENUTO (data + "xx.xx% (x.xx)"), non dal testo delle
  intestazioni: funziona anche se thead e tbody sono in tabelle separate (DataTables) o
  se le intestazioni non si chiamano come previsto;
- esito e risultato sono colonne separate;
- comando "auto N": legge N pagine di fila cambiando solo il parametro page= nell'URL
  (navigazione normale, nessun click, pausa tra una pagina e l'altra);
- se non trova nulla salva un file di debug con l'HTML della pagina.
"""
import csv
import re
import time
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse, parse_qsl, urlencode, urlunparse

from playwright.sync_api import sync_playwright

BASE = Path(__file__).resolve().parent
PROFILE = BASE / 'profilo_browser'
OUTPUT = BASE / 'esportazioni'
OUTPUT.mkdir(exist_ok=True)
START_URL = 'https://sbostats.com/match_analyst?page=1&sport=soccer'
COLUMNS = ['data', 'partita', 'campionato', 'pronostico', 'frequenza',
           'quota_teorica', 'risultato', 'esito', 'testo_originale']
PAUSA_AUTO = 1.5  # secondi tra una pagina e l'altra in modalita' auto

# Tutte le righe <tr> della pagina con almeno 5 celle <td>, testo con a-capo preservati.
JS_ROWS = r'''() => [...document.querySelectorAll('tr')]
  .map(tr => [...tr.querySelectorAll('td')].map(td => td.innerText))
  .filter(cells => cells.length >= 5)'''

RE_DATE = re.compile(r'\d{1,2}/\d{1,2}/\d{4}')
RE_FREQ = re.compile(r'(\d{1,3}(?:[.,]\d+)?)\s*%\s*\(\s*(\d+(?:[.,]\d+)?)\s*\)')
STATI = {'VINCENTE', 'PERDENTE', 'IN ATTESA', 'ANNULLATO', 'RIMBORSATO'}


def clean(s):
    return re.sub(r'\s+', ' ', str(s or '')).strip()


def lines(s):
    return [clean(x) for x in str(s or '').splitlines() if clean(x)]


def parse_row(row):
    """row = lista di testi delle celle. Ritorna dict o None se non e' una riga dati."""
    if len(row) < 5:
        return None
    date = clean(row[0])
    game = lines(row[1])
    pick = clean(row[2])
    m = RE_FREQ.search(clean(row[3]))
    if not (RE_DATE.search(date) and game and pick and m):
        return None
    out = lines(row[4])
    esito = next((x for x in out if x.upper() in STATI), out[-1] if out else '')
    risultato = ' '.join(x for x in out if x != esito)
    return {
        'data': date,
        'partita': game[0],
        'campionato': ' '.join(game[1:]),
        'pronostico': pick,
        'frequenza': m.group(1).replace(',', '.') + '%',
        'quota_teorica': m.group(2).replace(',', '.'),
        'risultato': risultato,
        'esito': esito,
        'testo_originale': ' | '.join(clean(x) for x in row),
    }


def read_rows(page):
    """Ritorna le righe valide trovate nella pagina (lista di dict)."""
    try:
        raw = page.evaluate(JS_ROWS)
    except Exception as ex:  # pagina chiusa / in navigazione
        print('  Pagina non leggibile:', str(ex)[:120])
        return []
    return [r for r in (parse_row(x) for x in raw) if r]


def add(records, rows):
    new = 0
    for rec in rows:
        key = (rec['data'], rec['partita'], rec['pronostico'])
        if key not in records:
            new += 1
        records[key] = rec
    return new


def dump_debug(page):
    dest = OUTPUT / ('debug_' + datetime.now().strftime('%H%M%S') + '.html')
    try:
        info = page.evaluate('''() => ({url: location.href, tables: document.querySelectorAll('table').length,
            tr: document.querySelectorAll('tr').length, td: document.querySelectorAll('td').length})''')
        dest.write_text(page.content(), encoding='utf-8')
        print(f"  DEBUG: {info} -> salvato {dest.name}")
    except Exception as ex:
        print('  Impossibile salvare il debug:', str(ex)[:100])


def with_page(url, n):
    parts = urlparse(url)
    q = dict(parse_qsl(parts.query, keep_blank_values=True))
    q['page'] = str(n)
    return urlunparse(parts._replace(query=urlencode(q)))


def current_page_number(url):
    q = dict(parse_qsl(urlparse(url).query, keep_blank_values=True))
    try:
        return int(q.get('page', '1'))
    except ValueError:
        return 1


def capture_auto(page, records, n_pages):
    """Legge n_pages pagine a partire da quella corrente, cambiando solo ?page=."""
    start = current_page_number(page.url)
    for i in range(n_pages):
        num = start + i
        if i > 0:
            page.goto(with_page(page.url, num), wait_until='domcontentloaded')
        try:
            page.wait_for_selector('tbody tr td', timeout=15000)
        except Exception:
            pass
        rows = read_rows(page)
        new = add(records, rows)
        print(f'  Pagina {num}: righe {len(rows)} | nuove {new} | totale {len(records)}')
        if not rows:
            print('  Nessuna riga: fine pagine o sessione scaduta. Mi fermo.')
            if not records:   # nessun dato in assoluto: salvo la pagina per capire perche'
                dump_debug(page)
            break
        if i > 0 and new == 0:
            print('  Pagina gia\' letta (nessuna riga nuova). Mi fermo.')
            break
        time.sleep(PAUSA_AUTO)


def launch(p):
    kwargs = dict(headless=False, viewport={'width': 1440, 'height': 900}, accept_downloads=False)
    try:  # usa il Chrome installato (piu' simile al browser normale); se manca usa Chromium
        return p.chromium.launch_persistent_context(str(PROFILE), channel='chrome', **kwargs)
    except Exception:
        return p.chromium.launch_persistent_context(str(PROFILE), **kwargs)


def save(records):
    if not records:
        print('\nNessun dato raccolto.')
        return
    dest = OUTPUT / ('sbostats_match_analysis_' + datetime.now().strftime('%Y%m%d_%H%M%S') + '.csv')
    with dest.open('w', newline='', encoding='utf-8-sig') as f:
        w = csv.DictWriter(f, fieldnames=COLUMNS, delimiter=';')
        w.writeheader()
        w.writerows(records.values())
    print('\nSALVATO:', dest, f'({len(records)} righe)')


def main():
    print('\n=== SBOStats Match Analysis - Estrattore locale v2 ===')
    print('Il login si fa solo nel browser: NON inserire password qui.\n')
    print('Nel browser accedi a SBOStats, apri Match Analysis e imposta i filtri.')
    print('Comandi (poi INVIO):')
    print('  (vuoto)  = legge la pagina visibile ora')
    print('  auto 20  = legge 20 pagine a partire da quella corrente (cambia solo ?page=)')
    print('  fine     = salva il CSV ed esce\n')
    records = {}
    with sync_playwright() as p:
        ctx = launch(p)
        page = ctx.pages[0] if ctx.pages else ctx.new_page()
        try:
            page.goto(START_URL, wait_until='domcontentloaded')
        except Exception as ex:
            print('Apertura automatica non riuscita, scrivi tu l\'indirizzo:', str(ex)[:80])
        try:
            while True:
                cmd = input('> ').strip().lower()
                if cmd in ('fine', 'stop', 'esci', 'q'):
                    break
                # usa la scheda attiva piu' recente che contiene dati
                tabs = [t for t in ctx.pages if not t.is_closed()]
                if not tabs:
                    print('Il browser e\' stato chiuso.')
                    break
                page = tabs[-1] if 'sbostats' in tabs[-1].url else page
                if cmd.startswith('auto'):
                    parts = cmd.split()
                    n = int(parts[1]) if len(parts) > 1 and parts[1].isdigit() else 5
                    capture_auto(page, records, n)
                    continue
                total, new = 0, 0
                for tab in tabs:
                    rows = read_rows(tab)
                    total += len(rows)
                    new += add(records, rows)
                print(f'Righe lette: {total} | Nuove: {new} | Totale uniche: {len(records)}')
                if not total:
                    print('Nessuna riga riconosciuta. Salvo un file di debug da inviare a Claude.')
                    dump_debug(page)
        except (KeyboardInterrupt, EOFError):
            print('\nInterrotto, salvo quello che ho.')
        finally:
            save(records)
            try:
                ctx.close()
            except Exception:
                pass
    input('Premi INVIO per chiudere...')


if __name__ == '__main__':
    main()
