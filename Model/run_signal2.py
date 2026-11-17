"""Orquestador Fase 2: Senal 2 (grafo de destinos / mulas).

Uso (desde Model/):  python run_signal2.py [--sample-frac F]
"""
import argparse
import json
import time

import pandas as pd

from src import config as C
from src import signal_graph as G
from src.data_prep import prepare
from src.evaluate import auprc, recall_at_precision


def decile_by_value(df, col):
    """Deciles por cuantiles del VALOR (empates juntos; duplicates='drop' -> menos bins)."""
    b = pd.qcut(df[col], 10, duplicates="drop")
    g = df.groupby(b, observed=True).agg(n=("isFraud", "size"), fraudes=("isFraud", "sum"),
                                         vmin=(col, "min"), vmax=(col, "max"))
    g["tasa_fraude"] = g["fraudes"] / g["n"]
    g["lift"] = g["tasa_fraude"] / df["isFraud"].mean()
    g.index = range(1, len(g) + 1)
    g.index.name = "bin"
    return g.reset_index()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sample-frac", type=float, default=None)
    a = ap.parse_args()
    t0 = time.time()
    df, m_tr, m_te = prepare(sample_frac=a.sample_frac, with_names=True)
    print(f"[{time.time()-t0:.0f}s] filas={len(df):,} train={m_tr.sum():,} test={m_te.sum():,}")
    info = G.add_graph_features(df, m_tr)
    print(f"[{time.time()-t0:.0f}s] features de grafo listas")
    chk = G.verify_no_leakage(df)
    print(f"[{time.time()-t0:.0f}s] ANTI-LEAKAGE OK:", chk)

    df["score_red_simple"] = G.score_red_simple(df, m_tr)
    df["score_red_logit"], coefs = G.score_red_logistic(df, m_tr)
    te, tr = df[m_te], df[m_tr]
    met = {"anti_leakage": chk, **info, "n_test": int(len(te)),
           "baseline_auprc_test": float(te.isFraud.mean()), "logit_coefs": coefs}
    for name in ["score_red_simple", "score_red_logit", "fan_in", "burst"]:
        met[f"auprc_test_{name}"] = auprc(te.isFraud, te[name])
        met[f"auprc_train_{name}"] = auprc(tr.isFraud, tr[name])
    for name in ["score_red_simple", "score_red_logit"]:
        met[f"recall_at_prec0.9_test_{name}"] = recall_at_precision(te.isFraud, te[name], 0.9)

    C.RESULTS_DIR.mkdir(exist_ok=True)
    for col, tag in [("fan_in", "fan_in"), ("monto_total_in", "volumen_recibido"),
                     ("n_tx_dest", "n_tx_dest")]:
        for sub, nm in [(te, "test"), (df, "todo")]:
            t = decile_by_value(sub, col)
            t.to_csv(C.RESULTS_DIR / f"senal2_deciles_{tag}_{nm}.csv", index=False)
            met[f"deciles_{tag}_{nm}"] = t.to_dict("records")
            if nm == "test":
                print(f"--- deciles {tag} (test) ---")
                print(t.to_string())
    met["fan_in_dist_test"] = te.fan_in.describe(percentiles=[.5, .9, .99, .999]).to_dict()
    with open(C.RESULTS_DIR / "senal2_metricas.json", "w", encoding="utf-8") as f:
        json.dump(met, f, indent=2, ensure_ascii=False, default=float)
    print({k: v for k, v in met.items() if k.startswith(("auprc", "baseline", "recall"))})
    print("coefs:", coefs, f"\n[{time.time()-t0:.0f}s] fin")


if __name__ == "__main__":
    main()
