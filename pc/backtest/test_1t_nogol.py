#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PronoX · TEST su OVER 0.5 PRIMO TEMPO e NO GOL FINALE (05/11/2026)

Domanda: PronoX sa scegliere meglio della media le partite in cui nel 1T segna almeno un gol (Over 0.5 1T)
e quelle in cui finisce NO GOL (almeno una squadra a zero)? E sa qualcosa che le quote non sanno già?

Come: rifà partita per partita, usando SOLO le partite già giocate, la previsione di tre "cervelli" e le confronta
con quello che è successo davvero (gol del primo tempo e risultato finale, dal file di football-data.co.uk):
  • ingenuo   = la media storica del campionato (quante volte succede in generale);
  • PronoX    = il modello Dixon-Coles di oggi (copia fedele di lib/pronox/footballModel.js, come backtest_pronox.py).
                Per l'Over 0.5 1T si provano tre versioni: la formula del sito (0,18 + gol attesi × 0,14), i gol attesi
                del tempo pieno scalati al 1T, e un modello addestrato direttamente sui gol del 1T;
  • mercato   = i gol attesi che si ricavano dalle quote Pinnacle di chiusura (1X2 + Over/Under 2.5), poi scalati al 1T.
Le quote dell'Over 0.5 1T e del NoGol NON esistono nei file storici: il «mercato» qui è una STIMA ricavata dalle quote
del tempo pieno, non una quota vera.

Misure: log-loss e Brier (più basso = meglio), calibrazione, e il tasso di vittoria che si ottiene scegliendo solo le
partite che il modello giudica più sicure, confrontato col pareggio.
Non scrive niente sul sito e non usa chiavi: legge file pubblici (riusa i dati del backtest di PronoX).
"""
import argparse
import bisect
import csv
import datetime as dt
import math
import os
import sys

import backtest_pronox as bp

CARTELLA = os.path.dirname(os.path.abspath(__file__))
STAGIONI_DEFAULT = ['2021', '2122', '2223', '2324', '2425', '2526', '2627']


# ───────────────────────── caricamento (come backtest_pronox, più i gol del 1T) ─────────────────────────
def carica_partite(leghe, stagioni):
    corrente = stagioni[-1]
    per_lega = {l: [] for l in leghe}
    for lega in leghe:
        for stag in stagioni:
            path = bp.scarica(lega, stag, corrente)
            if not path:
                continue
            for r in bp.leggi_csv(path):
                d = bp.data_da(r.get('Date'))
                try:
                    hg, ag = int(float(r['FTHG'])), int(float(r['FTAG']))
                except (KeyError, TypeError, ValueError):
                    continue
                casa, osp = (r.get('HomeTeam') or '').strip(), (r.get('AwayTeam') or '').strip()
                if d is None or not casa or not osp:
                    continue
                try:
                    ht = (int(float(r['HTHG'])), int(float(r['HTAG'])))
                except (KeyError, TypeError, ValueError):
                    ht = None
                q3, f3 = bp.prime_quote(r, bp.SET_1X2)
                qo, fo = bp.prime_quote(r, bp.SET_OU)
                per_lega[lega].append({
                    'lega': lega, 'stag': stag, 'data': d, 'casa': casa, 'osp': osp, 'hg': hg, 'ag': ag,
                    'ht': ht, 'q3': q3, 'qo': qo, 'mk': None,
                })
        per_lega[lega].sort(key=lambda m: m['data'])
    return per_lega


# ───────────────────────── matematica (copia di footballModel.js) ─────────────────────────
_PMF = {}


def pmf(lam, mx=8):
    k = round(lam, 3)
    v = _PMF.get(k)
    if v is None:
        v = [math.exp(-k)]
        for i in range(1, mx + 1):
            v.append(v[-1] * k / i)
        _PMF[k] = v
    return v


def griglia(lh, la, mx=8):
    """(P casa, P pareggio, P ospite, P over2.5, P entrambe segnano) con la correzione Dixon-Coles e normalizzazione."""
    a, b = pmf(lh, mx), pmf(la, mx)
    h = d = aw = o25 = btts = mass = 0.0
    for i in range(mx + 1):
        pi = a[i]
        for j in range(mx + 1):
            p = pi * b[j]
            if i <= 1 and j <= 1:
                p *= bp.dc_corr(i, j, lh, la)
            mass += p
            if i > j:
                h += p
            elif i == j:
                d += p
            else:
                aw += p
            if i + j > 2.5:
                o25 += p
            if i > 0 and j > 0:
                btts += p
    tot = mass if mass > 0 else 1.0
    return h / tot, d / tot, aw / tot, o25 / tot, btts / tot


def lambda_pronox(finestra, casa, osp, rif, min_partite):
    """Gol attesi (casa, ospite) del modello PronoX sul tempo pieno; None se mancano dati."""
    if len(finestra) < 20:
        return None
    squadre, lg_h, lg_a = bp.calc_ratings(finestra, rif)
    th, ta = squadre.get(casa), squadre.get(osp)
    if not th or not ta or th['n'] < min_partite or ta['n'] < min_partite:
        return None
    lh = th['attH'] * ta['defA'] * lg_h
    la = ta['attA'] * th['defH'] * lg_a
    lh *= min(max(th['homeAdv'], 0.8), 1.4)
    lh *= 0.85 + th['formRating'] * 0.30
    la *= 0.85 + ta['formRating'] * 0.30
    b = bp.h2h_bias(finestra, casa, osp)
    lh *= (1 + b)
    la *= (1 - b)
    return max(0.3, min(3.0, lh)), max(0.3, min(3.0, la))


def lambda_primo_tempo(finestra_ht, casa, osp, rif, min_partite):
    """Stesso modello (attacco/difesa/fattore campo) ma addestrato sui gol del PRIMO TEMPO."""
    if len(finestra_ht) < 20:
        return None
    squadre, lg_h, lg_a = bp.calc_ratings(finestra_ht, rif)
    th, ta = squadre.get(casa), squadre.get(osp)
    if not th or not ta or th['n'] < min_partite or ta['n'] < min_partite:
        return None
    lh = th['attH'] * ta['defA'] * lg_h * min(max(th['homeAdv'], 0.8), 1.4)
    la = ta['attA'] * th['defH'] * lg_a
    return max(0.1, min(2.0, lh)), max(0.1, min(2.0, la))


def adatta_mercato(ph, pd_, pa, po):
    """Gol attesi (casa, ospite) che riproducono le probabilità del mercato (1X2 + Over 2.5). Ricerca locale, senza librerie."""
    lh, la = 1.4, 1.1

    def err(x, y):
        g = griglia(x, y)
        return (g[0] - ph) ** 2 + (g[1] - pd_) ** 2 + (g[2] - pa) ** 2 + (g[3] - po) ** 2

    best = err(lh, la)
    for passo in (0.4, 0.2, 0.1, 0.05, 0.02, 0.01, 0.005):
        for _ in range(40):
            migliorato = False
            for dh, da in ((passo, 0), (-passo, 0), (0, passo), (0, -passo), (passo, passo), (-passo, -passo), (passo, -passo), (-passo, passo)):
                x, y = round(lh + dh, 3), round(la + da, 3)
                if not (0.15 <= x <= 4.5 and 0.15 <= y <= 4.5):
                    continue
                e = err(x, y)
                if e < best - 1e-12:
                    best, lh, la, migliorato = e, x, y, True
            if not migliorato:
                break
    return lh, la, best


def mercato_partita(m):
    """Gol attesi impliciti nelle quote Pinnacle (calcolati una volta sola per partita)."""
    if m['mk'] is None:
        ph, pd_, pa = bp.senza_margine(m['q3'])
        po = bp.senza_margine(m['qo'])[0]
        lh, la, e = adatta_mercato(ph, pd_, pa, po)
        m['mk'] = (lh, la, e, griglia(lh, la)[4])
    return m['mk']


# ───────────────────────── backtest ─────────────────────────
def esegui(per_lega, storico, min_partite):
    ris = []
    for lega, partite in per_lega.items():
        date = [m['data'] for m in partite]
        vista_ht = [{'data': m['data'], 'stag': m['stag'], 'casa': m['casa'], 'osp': m['osp'],
                     'hg': m['ht'][0], 'ag': m['ht'][1], 'ft': m['hg'] + m['ag']} for m in partite if m['ht'] is not None]
        date_ht = [m['data'] for m in vista_ht]
        for m in partite:
            if m['ht'] is None or not m['q3'] or not m['qo']:
                continue
            giorni = dt.timedelta(days=400 if storico else 380)
            f_ft = partite[bisect.bisect_left(date, m['data'] - giorni):bisect.bisect_left(date, m['data'])]
            f_ht = vista_ht[bisect.bisect_left(date_ht, m['data'] - giorni):bisect.bisect_left(date_ht, m['data'])]
            if not storico:
                f_ft = [x for x in f_ft if x['stag'] == m['stag']]
                f_ht = [x for x in f_ht if x['stag'] == m['stag']]
            lam = lambda_pronox(f_ft, m['casa'], m['osp'], m['data'], min_partite)
            lam1 = lambda_primo_tempo(f_ht, m['casa'], m['osp'], m['data'], min_partite)
            if lam is None or lam1 is None:
                continue
            mk_h, mk_a, mk_err, mk_btts = mercato_partita(m)
            if mk_err > 0.01:           # il mercato non è riproducibile con un modello a due gol attesi: si scarta
                continue
            gol_ht = sum(x['hg'] + x['ag'] for x in f_ht)
            gol_ft = sum(x['ft'] for x in f_ht)
            f1 = min(max(gol_ht / gol_ft, 0.35), 0.55) if gol_ft > 0 else 0.45
            lh, la = lam
            g = griglia(lh, la)
            y1 = 1 if m['ht'][0] + m['ht'][1] >= 1 else 0
            y2 = 1 if (m['hg'] == 0 or m['ag'] == 0) else 0
            ris.append({
                'lega': lega, 'stag': m['stag'], 'data': m['data'], 'casa': m['casa'], 'osp': m['osp'], 'y1': y1, 'y2': y2,
                'p1': {
                    'ingenuo': sum(1 for x in f_ht if x['hg'] + x['ag'] >= 1) / len(f_ht),
                    'sito': min(0.18 + (lh + la) * 0.14, 0.96),
                    'tempo_pieno': 1 - math.exp(-(lh + la) * f1),
                    'primo_tempo': 1 - math.exp(-(lam1[0] + lam1[1])),
                    'mercato': 1 - math.exp(-(mk_h + mk_a) * f1),
                },
                'p2': {
                    'ingenuo': sum(1 for x in f_ft if x['hg'] == 0 or x['ag'] == 0) / len(f_ft),
                    'pronox': 1 - g[4],
                    'mercato': 1 - mk_btts,
                },
            })
    return ris


# ───────────────────────── misure ─────────────────────────
def ll_bin(p, y):
    p = min(max(p, 1e-6), 1 - 1e-6)
    return -math.log(p if y else 1 - p)


def ci(hit, n):
    return 1.96 * math.sqrt(hit * (1 - hit) / n) if n else 0.0


NOMI_P1 = {
    'ingenuo': 'media storica', 'sito': 'PronoX (formula del sito)', 'tempo_pieno': 'PronoX (gol attesi scalati al 1T)',
    'primo_tempo': 'PronoX addestrato sul 1T', 'mercato': 'mercato (stima da Pinnacle)',
}
NOMI_P2 = {'ingenuo': 'media storica', 'pronox': 'PronoX', 'mercato': 'mercato (stima da Pinnacle)'}


def confronto(ris, chiave_y, chiave_p, nomi, titolo, out):
    n = len(ris)
    out(f'\n{titolo}')
    out('  modello                               log-loss   Brier   previsto medio   successo reale')
    base_ll = None
    mercato_ll = None
    vals = {}
    for k, nome in nomi.items():
        lls = [ll_bin(r[chiave_p][k], r[chiave_y]) for r in ris]
        br = sum((r[chiave_p][k] - r[chiave_y]) ** 2 for r in ris) / n
        pm = sum(r[chiave_p][k] for r in ris) / n
        real = sum(r[chiave_y] for r in ris) / n
        vals[k] = lls
        out(f'  {nome:<36} {sum(lls)/n:.4f}    {br:.4f}   {pm*100:6.1f}%          {real*100:6.1f}%')
    for k in nomi:
        if k in ('ingenuo', 'mercato'):
            continue
        d_i, s_i = bp.media_se([a - b for a, b in zip(vals[k], vals['ingenuo'])])
        d_m, s_m = bp.media_se([a - b for a, b in zip(vals[k], vals['mercato'])])
        v_i = 'sa qualcosa più della media' if d_i + s_i < 0 else 'NON batte la media storica' if d_i - s_i > 0 else 'indistinguibile dalla media'
        v_m = 'MEGLIO del mercato' if d_m + s_m < 0 else 'PEGGIO del mercato' if d_m - s_m > 0 else 'indistinguibile dal mercato'
        out(f'  {nomi[k]}: vs media {d_i:+.4f}±{s_i:.4f} ({v_i}); vs mercato {d_m:+.4f}±{s_m:.4f} ({v_m})')


def selezione(ris, chiave_y, chiave_p, nomi, titolo, margine, out, scarta=()):
    """Gioca solo le partite che il modello giudica più sicure: tasso di vittoria vs pareggio (stimato dalla quota che darebbe il book)."""
    n = len(ris)
    out(f'\n{titolo}')
    out('  (pareggio = probabilità del mercato × (1 + margine del book), cioè la % di vittorie che serve per non perdere alla quota del book;')
    out('   «margine max del book» = il margine più alto che il book potrebbe applicare perché quelle scelte vadano in pari: sotto ~2% serve un book come Pinnacle)')
    out('  modello                               scelte    vittorie       mercato   pareggio   differenza   margine max del book')
    for k, nome in nomi.items():
        if k in scarta:
            continue
        ordinate = sorted(ris, key=lambda r: -r[chiave_p][k])
        for quota in (0.5, 0.3, 0.2, 0.1, 0.05):
            s = ordinate[:int(n * quota)]
            if len(s) < 100:
                continue
            hit = sum(r[chiave_y] for r in s) / len(s)
            mer = sum(r[chiave_p]['mercato'] for r in s) / len(s)
            par = sum(min(0.995, r[chiave_p]['mercato'] * (1 + margine / 100)) for r in s) / len(s)
            out(f'  {nome:<28} top {int(quota*100):>2}%   {len(s):>6}   {hit*100:5.1f}%±{ci(hit, len(s))*100:3.1f}   {mer*100:6.1f}%   {par*100:6.1f}%   {(hit-par)*100:+6.1f} pt   {(hit / mer - 1) * 100:+6.1f}%')
        out('')


def calibrazione(ris, chiave_y, chiave_p, k, nome, fasce, out):
    out(f'\nCalibrazione · {nome} (quando dice X%, quante volte succede davvero?)')
    out('  fascia      partite   previsto   reale')
    for a, b in fasce:
        s = [r for r in ris if a <= r[chiave_p][k] < b]
        if len(s) < 50:
            continue
        out(f'  {int(a*100):>2}-{min(int(b*100),100):<3}%   {len(s):>6}   {sum(r[chiave_p][k] for r in s)/len(s)*100:6.1f}%   {sum(r[chiave_y] for r in s)/len(s)*100:6.1f}%')


def per_lega(ris, out):
    out('\nPer campionato: quanto spesso succede in media (senza nessun modello)')
    out('  campionato              partite   Over 0.5 1T   NoGol finale')
    for lega in sorted({r['lega'] for r in ris}):
        s = [r for r in ris if r['lega'] == lega]
        out(f'  {bp.LEGHE.get(lega, lega):<22} {len(s):>7}   {sum(r["y1"] for r in s)/len(s)*100:9.1f}%   {sum(r["y2"] for r in s)/len(s)*100:10.1f}%')


def per_stagione(ris, chiave_y, chiave_p, k, nome, quota, out):
    n = len(ris)
    ordinate = sorted(ris, key=lambda r: -r[chiave_p][k])
    soglia = ordinate[int(n * quota) - 1][chiave_p][k]
    out(f'\nStabilità nel tempo · {nome}, scegliendo il {int(quota*100)}% più sicuro (soglia fissa {soglia*100:.1f}% valida per tutte le stagioni)')
    out('  stagione   scelte   vittorie   mediamente tutte le partite')
    for stag in sorted({r['stag'] for r in ris}):
        tutte = [r for r in ris if r['stag'] == stag]
        s = [r for r in tutte if r[chiave_p][k] >= soglia]
        if len(s) < 30:
            continue
        out(f'  {stag}      {len(s):>5}    {sum(r[chiave_y] for r in s)/len(s)*100:5.1f}%     {sum(r[chiave_y] for r in tutte)/len(tutte)*100:5.1f}%')


def analizza(ris, nome, margine1, margine2, out):
    n = len(ris)
    if n < 300:
        out(f'\n=== {nome}: troppo poche partite ({n}) ===')
        return
    out(f'\n{"=" * 78}\n{nome} · {n} partite\n{"=" * 78}')

    out('\n──────── OVER 0.5 PRIMO TEMPO (nel 1T segna almeno un gol) ────────')
    confronto(ris, 'y1', 'p1', NOMI_P1, 'Qualità delle previsioni', out)
    sito = [r for r in ris if r['p1']['sito'] > 0.90]
    out(f'\nLa regola attuale del sito (segnale se la formula supera 90%): scatta {len(sito)} volte su {n}'
        + (f', vittorie {sum(r["y1"] for r in sito)/len(sito)*100:.1f}%' if sito else ''))
    selezione(ris, 'y1', 'p1', NOMI_P1, 'Scegliendo solo le partite più sicure per ciascun modello (Over 0.5 1T)', margine1, out, scarta=('ingenuo',))
    calibrazione(ris, 'y1', 'p1', 'primo_tempo', 'PronoX addestrato sul 1T', [(0, .6), (.6, .65), (.65, .7), (.7, .75), (.75, .8), (.8, .85), (.85, 1.01)], out)
    calibrazione(ris, 'y1', 'p1', 'mercato', 'mercato (stima)', [(0, .6), (.6, .65), (.65, .7), (.7, .75), (.75, .8), (.8, .85), (.85, 1.01)], out)
    per_stagione(ris, 'y1', 'p1', 'primo_tempo', 'PronoX addestrato sul 1T', 0.2, out)
    per_stagione(ris, 'y1', 'p1', 'mercato', 'mercato (stima)', 0.2, out)

    out('\n──────── NO GOL FINALE (almeno una squadra non segna) ────────')
    confronto(ris, 'y2', 'p2', NOMI_P2, 'Qualità delle previsioni', out)
    selezione(ris, 'y2', 'p2', NOMI_P2, 'Scegliendo solo le partite più sicure per ciascun modello (NoGol)', margine2, out, scarta=('ingenuo',))
    calibrazione(ris, 'y2', 'p2', 'pronox', 'PronoX', [(0, .4), (.4, .45), (.45, .5), (.5, .55), (.55, .6), (.6, .65), (.65, 1.01)], out)
    per_stagione(ris, 'y2', 'p2', 'pronox', 'PronoX', 0.2, out)
    per_lega(ris, out)


def main():
    ap = argparse.ArgumentParser(description='Test di PronoX su Over 0.5 1T e NoGol finale')
    ap.add_argument('--leghe', default=','.join(bp.LEGHE), help='codici separati da virgola (default: tutte)')
    ap.add_argument('--stagioni', default=','.join(STAGIONI_DEFAULT), help='es. 2223,2324,2425')
    ap.add_argument('--min-partite', type=int, default=4, help='partite minime già giocate da ciascuna squadra (default 4)')
    ap.add_argument('--margine-1t', type=float, default=8.5, help='margine del book sull\'Over/Under 0.5 1T, in %% (default 8.5: Over 1,33 / Under 3,00)')
    ap.add_argument('--margine-nogol', type=float, default=6.0, help='margine del book sul NoGol, in %% (default 6)')
    ap.add_argument('--dati', default=None, help='cartella con i file già scaricati (facoltativa)')
    args = ap.parse_args()
    if args.dati:
        bp.DATI = args.dati
    leghe = [x.strip() for x in args.leghe.split(',') if x.strip() in bp.LEGHE]
    stagioni = [x.strip() for x in args.stagioni.split(',') if x.strip()]

    righe = []

    def out(t=''):
        print(t)
        righe.append(t)

    print('Leggo i dati (la prima volta li scarica, ci mette un minuto)…')
    per_l = carica_partite(leghe, stagioni)
    tot = sum(len(v) for v in per_l.values())
    con_ht = sum(1 for v in per_l.values() for m in v if m['ht'] is not None)
    out(f'PRONOX · OVER 0.5 1T e NO GOL FINALE · {dt.date.today().strftime("%d/%m/%Y")}')
    out(f'Leghe: {", ".join(bp.LEGHE[l] for l in leghe)} · stagioni {stagioni[0]}–{stagioni[-1]} · {tot} partite lette, {con_ht} con il risultato del primo tempo')
    if not tot:
        out('Nessun dato scaricato: controlla la connessione e riprova.')
        return 1

    primo = None
    for storico, nome in ((False, 'COME OGGI (solo la stagione in corso)'), (True, 'CON LA STAGIONE PRECEDENTE (ultimi 400 giorni)')):
        print(f'\nCalcolo: {nome}… (qualche minuto)')
        ris = esegui(per_l, storico, args.min_partite)
        analizza(ris, nome, args.margine_1t, args.margine_nogol, out)
        if storico:
            primo = ris

    out('\nCOME LEGGERE')
    out('- «vs media» e «vs mercato»: negativo = il modello è migliore. Se non batte la media, non sa scegliere le partite.')
    out('- «Scegliendo solo le partite più sicure»: confronta le vittorie con il pareggio. Con una differenza positiva e stabile')
    out('  (anche nelle singole stagioni) c\'è qualcosa; se la differenza è vicina a zero o negativa, il mercato prezza già tutto.')
    out('- Le quote vere dell\'Over 0.5 1T e del NoGol non sono nei file storici: il pareggio è una STIMA (probabilità del mercato × margine).')
    out('  La prova finale è l\'esperimento in tempo reale con le quote vere.')

    try:
        with open(os.path.join(CARTELLA, 'dettaglio_1t_nogol.csv'), 'w', newline='', encoding='utf-8') as f:
            w = csv.writer(f, delimiter=';')
            w.writerow(['data', 'lega', 'casa', 'ospite', 'over05_1T_reale', 'nogol_reale', 'p1_sito', 'p1_tempo_pieno', 'p1_primo_tempo', 'p1_mercato', 'p2_pronox', 'p2_mercato'])
            for r in primo or []:
                w.writerow([r['data'], r['lega'], r['casa'], r['osp'], r['y1'], r['y2']] +
                           [f'{r["p1"][k]:.4f}'.replace('.', ',') for k in ('sito', 'tempo_pieno', 'primo_tempo', 'mercato')] +
                           [f'{r["p2"][k]:.4f}'.replace('.', ',') for k in ('pronox', 'mercato')])
    except Exception as e:
        print('Dettaglio non scritto:', e)
    try:
        with open(os.path.join(CARTELLA, 'report_1t_nogol.txt'), 'w', encoding='utf-8') as f:
            f.write('\n'.join(righe) + '\n')
        print('\nSalvato: report_1t_nogol.txt e dettaglio_1t_nogol.csv (nella stessa cartella dello script).')
    except Exception as e:
        print('Report non salvato:', e)
    return 0


if __name__ == '__main__':
    sys.exit(main())
