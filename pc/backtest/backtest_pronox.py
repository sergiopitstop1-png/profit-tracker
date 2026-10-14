#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PronoX · BACKTEST contro il mercato (14/10/2026)

Risponde a una domanda sola: "il modello PronoX (Dixon-Coles, dc_v2) sa qualcosa che le quote non sanno già?"

Come: scarica gratis da football-data.co.uk i risultati e le quote di molte stagioni (Premier, Championship, Bundesliga,
La Liga, Serie A, Ligue 1, Eredivisie, Primeira Liga). Poi rifà, partita per partita, la previsione che PronoX avrebbe
fatto il giorno prima (usando solo le partite già giocate) e la confronta con:
  • la probabilità del mercato senza margine (di preferenza Pinnacle in chiusura, la più precisa che esista);
  • un pronostico ingenuo (la media storica).
Misure: log-loss e Brier (più basso = meglio), una mescola modello+mercato, e una simulazione "giocare le bet dove il
modello vede valore" alle quote di bet365.

Non scrive niente sul sito e non usa chiavi: legge file pubblici e crea due file nella cartella (report e dettaglio).
Serve solo Python 3 (nessun pacchetto da installare).

NOTA: il modello è la copia fedele di lib/pronox/footballModel.js (ratings pesati con exp(-giorni/90), forma, scontri
diretti, griglia Dixon-Coles). Restano fuori solo le notizie su infortuni/squalifiche (non esistono storiche) e la
"calibrazione" sui prior (nata su pochi esiti): qui si misura il modello grezzo.
"""
import argparse
import bisect
import csv
import datetime as dt
import io
import math
import os
import sys
import urllib.request

LEGHE = {
    'E0': 'Premier League', 'E1': 'Championship', 'D1': 'Bundesliga', 'SP1': 'La Liga',
    'I1': 'Serie A', 'F1': 'Ligue 1', 'N1': 'Eredivisie', 'P1': 'Primeira Liga',
}
STAGIONI_DEFAULT = ['2122', '2223', '2324', '2425', '2526', '2627']
URL = 'https://www.football-data.co.uk/mmz4281/{stag}/{lega}.csv'
CARTELLA = os.path.dirname(os.path.abspath(__file__))
DATI = os.path.join(CARTELLA, 'dati')

# quote del mercato "di riferimento" (in ordine di preferenza) e quote bet365 su cui si simula la giocata
SET_1X2 = [('PSCH', 'PSCD', 'PSCA', 'Pinnacle chiusura'), ('PSH', 'PSD', 'PSA', 'Pinnacle'),
           ('AvgCH', 'AvgCD', 'AvgCA', 'media chiusura'), ('AvgH', 'AvgD', 'AvgA', 'media'),
           ('B365H', 'B365D', 'B365A', 'bet365')]
SET_OU = [('PC>2.5', 'PC<2.5', 'Pinnacle chiusura'), ('P>2.5', 'P<2.5', 'Pinnacle'),
          ('AvgC>2.5', 'AvgC<2.5', 'media chiusura'), ('Avg>2.5', 'Avg<2.5', 'media'),
          ('B365>2.5', 'B365<2.5', 'bet365')]


# ───────────────────────── scarico e lettura dei file ─────────────────────────
def scarica(lega, stag, stagione_corrente):
    os.makedirs(DATI, exist_ok=True)
    path = os.path.join(DATI, f'{stag}_{lega}.csv')
    vecchio = (not os.path.exists(path)) or (stag == stagione_corrente and (dt.datetime.now().timestamp() - os.path.getmtime(path)) > 86400)
    if vecchio:
        try:
            req = urllib.request.Request(URL.format(stag=stag, lega=lega), headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=40) as r:
                dati = r.read()
            if len(dati) < 500:
                return None
            with open(path, 'wb') as f:
                f.write(dati)
        except Exception as e:
            if not os.path.exists(path):
                print(f'  (salto {lega} {stag}: {e})')
                return None
    return path


def leggi_csv(path):
    with open(path, 'rb') as f:
        grezzo = f.read()
    try:
        testo = grezzo.decode('utf-8-sig')
    except UnicodeDecodeError:
        testo = grezzo.decode('latin-1')
    return list(csv.DictReader(io.StringIO(testo)))


def data_da(s):
    s = (s or '').strip()
    for fmt in ('%d/%m/%Y', '%d/%m/%y'):
        try:
            return dt.datetime.strptime(s, fmt).date()
        except ValueError:
            pass
    return None


def numero(v):
    try:
        x = float(str(v).replace(',', '.'))
        return x if x > 1.0 else None
    except (TypeError, ValueError):
        return None


def prime_quote(riga, set_quote):
    for *cols, nome in set_quote:
        vals = [numero(riga.get(c)) for c in cols]
        if all(vals):
            return vals, nome
    return None, None


def carica_partite(leghe, stagioni):
    corrente = stagioni[-1]
    per_lega = {l: [] for l in leghe}
    for lega in leghe:
        for stag in stagioni:
            path = scarica(lega, stag, corrente)
            if not path:
                continue
            for r in leggi_csv(path):
                d = data_da(r.get('Date'))
                try:
                    hg, ag = int(float(r['FTHG'])), int(float(r['FTAG']))
                except (KeyError, TypeError, ValueError):
                    continue
                casa, osp = (r.get('HomeTeam') or '').strip(), (r.get('AwayTeam') or '').strip()
                if d is None or not casa or not osp:
                    continue
                q3, f3 = prime_quote(r, SET_1X2)
                qo, fo = prime_quote(r, SET_OU)
                b3 = [numero(r.get('B365H')), numero(r.get('B365D')), numero(r.get('B365A'))]
                bo = [numero(r.get('B365>2.5')), numero(r.get('B365<2.5'))]
                per_lega[lega].append({
                    'lega': lega, 'stag': stag, 'data': d, 'casa': casa, 'osp': osp, 'hg': hg, 'ag': ag,
                    'q3': q3, 'f3': f3, 'qo': qo, 'fo': fo,
                    'b3': b3 if all(b3) else None, 'bo': bo if all(bo) else None,
                })
        per_lega[lega].sort(key=lambda m: m['data'])
    return per_lega


# ───────────────────────── il modello PronoX (copia di footballModel.js) ─────────────────────────
def poisson(k, lam):
    p = math.exp(-lam)
    for i in range(1, k + 1):
        p *= lam / i
    return p


def dc_corr(i, j, lh, la, rho=-0.13):
    if i == 0 and j == 0:
        return 1 - lh * la * rho
    if i == 0 and j == 1:
        return 1 + lh * rho
    if i == 1 and j == 0:
        return 1 + la * rho
    if i == 1 and j == 1:
        return 1 - rho
    return 1


def calc_probs(lh, la, mx=8):
    h = d = a = o25 = mass = 0.0
    for i in range(mx + 1):
        for j in range(mx + 1):
            p = poisson(i, lh) * poisson(j, la) * dc_corr(i, j, lh, la)
            mass += p
            if i > j:
                h += p
            elif i == j:
                d += p
            else:
                a += p
            if i + j > 2.5:
                o25 += p
    tot = mass if mass > 0 else (h + d + a or 1)
    return (h / tot, d / tot, a / tot), o25 / tot


def calc_ratings(finestra, rif):
    squadre = {}
    sw_h = sw_a = tw_h = tw_a = 0.0
    for m in finestra:
        w = math.exp(-(rif - m['data']).days / 90)
        for nome in (m['casa'], m['osp']):
            if nome not in squadre:
                squadre[nome] = {'hGF': 0, 'hGA': 0, 'hW': 0, 'aGF': 0, 'aGA': 0, 'aW': 0, 'forma': []}
        c, o = squadre[m['casa']], squadre[m['osp']]
        c['hGF'] += m['hg'] * w; c['hGA'] += m['ag'] * w; c['hW'] += w
        o['aGF'] += m['ag'] * w; o['aGA'] += m['hg'] * w; o['aW'] += w
        rc = 3 if m['hg'] > m['ag'] else 1 if m['hg'] == m['ag'] else 0
        ro = 3 if m['ag'] > m['hg'] else 1 if m['ag'] == m['hg'] else 0
        c['forma'].append((m['data'], rc)); o['forma'].append((m['data'], ro))
        sw_h += m['hg'] * w; tw_h += w; sw_a += m['ag'] * w; tw_a += w
    lg_h = sw_h / tw_h if tw_h > 0 else 1.35
    lg_a = sw_a / tw_a if tw_a > 0 else 1.1
    for t in squadre.values():
        t['attH'] = (t['hGF'] / t['hW']) / lg_h if t['hW'] > 0 else 1
        t['defH'] = (t['hGA'] / t['hW']) / lg_a if t['hW'] > 0 else 1
        t['attA'] = (t['aGF'] / t['aW']) / lg_a if t['aW'] > 0 else 1
        t['defA'] = (t['aGA'] / t['aW']) / lg_h if t['aW'] > 0 else 1
        ultime = sorted(t['forma'], key=lambda x: x[0], reverse=True)[:5]
        t['formRating'] = (sum(p for _, p in ultime) / (len(ultime) * 3)) if ultime else 0.5
        h_avg = t['hGF'] / t['hW'] if t['hW'] > 0 else lg_h
        a_avg = t['aGF'] / t['aW'] if t['aW'] > 0 else lg_a
        t['homeAdv'] = h_avg / a_avg if h_avg > 0 and a_avg > 0 else 1.1
        t['n'] = len(t['forma'])
    return squadre, lg_h, lg_a


def h2h_bias(finestra, casa, osp):
    sc = [m for m in finestra if (m['casa'] == casa and m['osp'] == osp) or (m['casa'] == osp and m['osp'] == casa)][-6:]
    if not sc:
        return 0.0
    hw = aw = 0
    for m in sc:
        if m['casa'] == casa:
            hw += m['hg'] > m['ag']; aw += m['ag'] > m['hg']
        else:
            hw += m['ag'] > m['hg']; aw += m['hg'] > m['ag']
    return (hw - aw) / len(sc) * 0.08


def prevedi(finestra, casa, osp, rif, min_partite):
    """Restituisce ((h,d,a), over25) oppure None se non ci sono abbastanza dati sulle due squadre."""
    if len(finestra) < 20:
        return None
    squadre, lg_h, lg_a = calc_ratings(finestra, rif)
    th, ta = squadre.get(casa), squadre.get(osp)
    if not th or not ta or th['n'] < min_partite or ta['n'] < min_partite:
        return None
    lh = th['attH'] * ta['defA'] * lg_h
    la = ta['attA'] * th['defH'] * lg_a
    lh *= min(max(th['homeAdv'], 0.8), 1.4)
    lh *= 0.85 + th['formRating'] * 0.30
    la *= 0.85 + ta['formRating'] * 0.30
    b = h2h_bias(finestra, casa, osp)
    lh *= (1 + b); la *= (1 - b)
    lh = max(0.3, min(3.0, lh)); la = max(0.3, min(3.0, la))
    return calc_probs(lh, la)


# ───────────────────────── backtest ─────────────────────────
def senza_margine(quote):
    inv = [1 / q for q in quote]
    s = sum(inv)
    return [x / s for x in inv]


def esegui(per_lega, storico, min_partite):
    risultati = []
    for lega, partite in per_lega.items():
        date = [m['data'] for m in partite]
        for i, m in enumerate(partite):
            if not m['q3'] or not m['qo']:
                continue
            fine = bisect.bisect_left(date, m['data'])                              # solo partite prima di oggi
            inizio = bisect.bisect_left(date, m['data'] - dt.timedelta(days=400 if storico else 380))
            finestra = partite[inizio:fine]
            if not storico:
                finestra = [x for x in finestra if x['stag'] == m['stag']]          # come oggi: solo la stagione in corso
            pr = prevedi(finestra, m['casa'], m['osp'], m['data'], min_partite)
            if pr is None:
                continue
            (ph, pd_, pa), po = pr
            y = 0 if m['hg'] > m['ag'] else 1 if m['hg'] == m['ag'] else 2
            risultati.append({
                'lega': lega, 'stag': m['stag'], 'data': m['data'], 'casa': m['casa'], 'osp': m['osp'], 'y': y, 'over': int(m['hg'] + m['ag'] > 2.5),
                'pm': [ph, pd_, pa], 'pk': senza_margine(m['q3']), 'pmo': po, 'pko': senza_margine(m['qo'])[0],
                'f3': m['f3'], 'fo': m['fo'], 'b3': m['b3'], 'bo': m['bo'],
            })
    return risultati


def ll(p, k):
    return -math.log(max(p[k], 1e-12))


def brier3(p, k):
    return sum((p[j] - (1 if j == k else 0)) ** 2 for j in range(3))


def media_se(valori):
    n = len(valori)
    m = sum(valori) / n
    var = sum((v - m) ** 2 for v in valori) / max(n - 1, 1)
    return m, 1.96 * math.sqrt(var / n)


def analizza(ris, nome, out):
    n = len(ris)
    if n < 50:
        out(f'\n=== {nome}: troppo poche partite ({n}) ===')
        return
    out(f'\n=== {nome} · {n} partite ===')
    fonti = {}
    for r in ris:
        fonti[r['f3']] = fonti.get(r['f3'], 0) + 1
    out('Quote di riferimento usate per il mercato: ' + ', '.join(f'{k} {v}' for k, v in sorted(fonti.items(), key=lambda x: -x[1])))

    # naive: frequenze storiche di tutto il campione
    freq = [sum(1 for r in ris if r['y'] == k) / n for k in range(3)]
    fo = sum(r['over'] for r in ris) / n

    def blocco(titolo, f_mod, f_mer, f_nai, f_ll, f_br, mescola):
        lm = [f_ll(f_mod(r), r) for r in ris]; lk = [f_ll(f_mer(r), r) for r in ris]; ln = [f_ll(f_nai(r), r) for r in ris]
        bm = sum(f_br(f_mod(r), r) for r in ris) / n; bk = sum(f_br(f_mer(r), r) for r in ris) / n; bn = sum(f_br(f_nai(r), r) for r in ris) / n
        d_mk, se_mk = media_se([a - b for a, b in zip(lm, lk)])
        d_mn, se_mn = media_se([a - b for a, b in zip(lm, ln)])
        out(f'\n{titolo}')
        out(f'  log-loss  modello {sum(lm)/n:.4f} | mercato {sum(lk)/n:.4f} | ingenuo {sum(ln)/n:.4f}   (più basso = meglio)')
        out(f'  Brier     modello {bm:.4f} | mercato {bk:.4f} | ingenuo {bn:.4f}')
        out(f'  modello − mercato: {d_mk:+.4f} ± {se_mk:.4f} per partita   ({"PEGGIO del mercato" if d_mk - se_mk > 0 else "MEGLIO del mercato" if d_mk + se_mk < 0 else "indistinguibile dal mercato"})')
        out(f'  modello − ingenuo: {d_mn:+.4f} ± {se_mn:.4f} per partita   ({"sa qualcosa" if d_mn + se_mn < 0 else "non batte la media storica" if d_mn - se_mn > 0 else "indistinguibile"})')
        migliore = (0.0, sum(lk) / n)
        for w10 in range(1, 11):
            w = w10 / 10
            v = sum(f_ll(mescola(r, w), r) for r in ris) / n
            if v < migliore[1]:
                migliore = (w, v)
        if migliore[0] > 0:
            out(f'  mescola migliore: {int(migliore[0]*100)}% modello + {100-int(migliore[0]*100)}% mercato → log-loss {migliore[1]:.4f} (guadagno sul solo mercato {sum(lk)/n - migliore[1]:+.4f})')
        else:
            out('  mescola modello+mercato: nessun peso del modello migliora il mercato da solo')

    blocco('1X2 (casa / pareggio / ospite)',
           lambda r: r['pm'], lambda r: r['pk'], lambda r: freq, lambda p, r: ll(p, r['y']), lambda p, r: brier3(p, r['y']),
           lambda r, w: [w * a + (1 - w) * b for a, b in zip(r['pm'], r['pk'])])
    blocco('Over/Under 2.5 (probabilità dell\'Over)',
           lambda r: r['pmo'], lambda r: r['pko'], lambda r: fo,
           lambda p, r: -math.log(max(p if r['over'] else 1 - p, 1e-12)), lambda p, r: (p - r['over']) ** 2,
           lambda r, w: w * r['pmo'] + (1 - w) * r['pko'])

    # simulazione giocate a quote bet365: dove il modello vede valore (EV = prob*quota - 1)
    out('\nSimulazione: si gioca 1 unità dove il MODELLO vede valore, alla quota bet365 (e quanto valore ci vede anche il MERCATO)')
    out('  soglia EV   giocate   ROI      valore secondo il mercato   (ROI di chi gioca TUTTO: vedi ultima riga)')
    selezioni = []
    for r in ris:
        if r['b3']:
            for k in range(3):
                selezioni.append((r['pm'][k], r['pk'][k], r['b3'][k], 1 if r['y'] == k else 0))
        if r['bo']:
            selezioni.append((r['pmo'], r['pko'], r['bo'][0], r['over']))
            selezioni.append((1 - r['pmo'], 1 - r['pko'], r['bo'][1], 1 - r['over']))
    for soglia in (0.03, 0.05, 0.10):
        sc = [s for s in selezioni if s[0] * s[2] - 1 >= soglia]
        if len(sc) < 30:
            out(f'  ≥ {int(soglia*100):>2}%      {len(sc):>6}   (troppo poche)')
            continue
        roi = sum((s[2] - 1) if s[3] else -1 for s in sc) / len(sc)
        ev_mer = sum(s[1] * s[2] - 1 for s in sc) / len(sc)
        out(f'  ≥ {int(soglia*100):>2}%      {len(sc):>6}   {roi*100:+6.1f}%   {ev_mer*100:+6.1f}%')
    if selezioni:
        roi_tutti = sum((s[2] - 1) if s[3] else -1 for s in selezioni) / len(selezioni)
        out(f'  tutte le {len(selezioni)} selezioni: ROI {roi_tutti*100:+.1f}% (è il margine medio di bet365)')


def tabella_calibrazione(ris, out):
    out('\nCalibrazione "CASA VINCE" (quando il modello dice X%, quante volte succede davvero?)')
    out('  fascia      partite   modello   mercato   reale')
    fasce = [(0.0, 0.3), (0.3, 0.4), (0.4, 0.5), (0.5, 0.6), (0.6, 0.7), (0.7, 1.01)]
    for a, b in fasce:
        s = [r for r in ris if a <= r['pm'][0] < b]
        if len(s) < 20:
            continue
        out(f'  {int(a*100):>2}-{min(int(b*100),100):<3}%   {len(s):>6}   {sum(r["pm"][0] for r in s)/len(s)*100:6.1f}%   {sum(r["pk"][0] for r in s)/len(s)*100:6.1f}%   {sum(1 for r in s if r["y"]==0)/len(s)*100:6.1f}%')


def main():
    ap = argparse.ArgumentParser(description='Backtest PronoX contro il mercato')
    ap.add_argument('--leghe', default=','.join(LEGHE), help='codici separati da virgola (default: tutte)')
    ap.add_argument('--stagioni', default=','.join(STAGIONI_DEFAULT), help='es. 2223,2324,2425')
    ap.add_argument('--min-partite', type=int, default=4, help='partite minime già giocate da ciascuna squadra (default 4)')
    args = ap.parse_args()
    leghe = [x.strip() for x in args.leghe.split(',') if x.strip() in LEGHE]
    stagioni = [x.strip() for x in args.stagioni.split(',') if x.strip()]

    righe = []
    def out(t=''):
        print(t)
        righe.append(t)

    print('Scarico i dati (la prima volta ci mette un minuto)…')
    per_lega = carica_partite(leghe, stagioni)
    tot = sum(len(v) for v in per_lega.values())
    out(f'PRONOX · BACKTEST CONTRO IL MERCATO · {dt.date.today().strftime("%d/%m/%Y")}')
    out(f'Leghe: {", ".join(LEGHE[l] for l in leghe)} · stagioni {stagioni[0]}–{stagioni[-1]} · {tot} partite lette')
    if not tot:
        out('Nessun dato scaricato: controlla la connessione e riprova.')
        return

    for storico, nome in ((False, 'COME OGGI (solo la stagione in corso)'), (True, 'CON LA STAGIONE PRECEDENTE (ultimi 400 giorni)')):
        print(f'\nCalcolo: {nome}…')
        ris = esegui(per_lega, storico, args.min_partite)
        analizza(ris, nome, out)
        if ris:
            tabella_calibrazione(ris, out)
        if not storico:
            primo = ris
    # dettaglio per controllo
    try:
        with open(os.path.join(CARTELLA, 'dettaglio_backtest.csv'), 'w', newline='', encoding='utf-8') as f:
            w = csv.writer(f, delimiter=';')
            w.writerow(['data', 'lega', 'casa', 'ospite', 'esito(0=casa,1=x,2=ospite)', 'modello_casa', 'modello_x', 'modello_ospite', 'mercato_casa', 'mercato_x', 'mercato_ospite', 'modello_over25', 'mercato_over25', 'over25_reale'])
            for r in primo:
                w.writerow([r['data'], r['lega'], r['casa'], r['osp'], r['y']] + [f'{x:.4f}'.replace('.', ',') for x in r['pm'] + r['pk']] + [f'{r["pmo"]:.4f}'.replace('.', ','), f'{r["pko"]:.4f}'.replace('.', ','), r['over']])
    except Exception as e:
        print('Dettaglio non scritto:', e)
    out('\nCOME LEGGERE: se «modello − mercato» è PEGGIO e la mescola non migliora, PronoX oggi non sa nulla che le quote non sappiano:')
    out('non conviene giocarlo scoperto. Se la mescola migliora in modo chiaro, vale la pena costruire il modello partendo dal mercato.')
    try:
        with open(os.path.join(CARTELLA, 'report_backtest.txt'), 'w', encoding='utf-8') as f:
            f.write('\n'.join(righe) + '\n')
        print('\nSalvato: report_backtest.txt e dettaglio_backtest.csv (nella stessa cartella dello script).')
    except Exception as e:
        print('Report non salvato:', e)


if __name__ == '__main__':
    sys.exit(main())
