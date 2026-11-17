"""Orquestador Fase 3: fusion de senales (H3) + lente temprana.

Uso (desde Model/):  python run_fusion.py [--sample-frac F]
"""
import argparse
import json
import time

import numpy as np
import pandas as pd

from src import config as C
from src import fusion as F
from src import signal_graph as G
from src.data_prep import prepare
from src.evaluate import pr_curve_df
from src.signal_mahalanobis import add_score

SIGNALS = [("maha_sola", "score_maha"), ("red_sola", "score_red"),
           ("fusion_logistica", "score_fusion")]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sample-frac", type=float, default=None)
    a = ap.parse_args()
    t0 = time.time()
    df, m_tr, m_te = prepare(sample_frac=a.sample_frac, with_names=True)
    print(f"[{time.time()-t0:.0f}s] filas={len(df):,} train={m_tr.sum():,} test={m_te.sum():,}")
    _, thr_m = add_score(df, m_tr)
    G.add_graph_features(df, m_tr)
    chk = G.verify_no_leakage(df)
    df["score_red"], coefs_red = G.score_red_logistic(df, m_tr)
    print(f"[{time.time()-t0:.0f}s] senales listas; anti-leakage grafo OK")

    # B. fusion por modelo (solo train)
    df["score_fusion"], coefs, intercept = F.fit_fusion(df, m_tr)
    te, tr = df[m_te], df[m_tr]

    # Ablaciones (misma logistica, solo train): que aporta cada bloque de entradas
    abl = {}
    for nm, fs in [("solo_senales_maha+red", ["score_maha", "score_red"]),
                   ("solo_saldos_errorOrig+vacia+ratio", ["errorOrig", "vaciaCuenta", "ratioMonto"]),
                   ("saldos+red_(sin_maha)", ["score_red", "errorOrig", "vaciaCuenta", "ratioMonto", "fan_in", "burst"]),
                   ("saldos+maha_(sin_red)", ["score_maha", "errorOrig", "vaciaCuenta", "ratioMonto"]),
                   ("completa", F.FUSION_FEATURES)]:
        sc, cf, _ = F.fit_fusion(df, m_tr, fs)
        df["_abl"] = sc
        r = F.compare(df[m_te], {"x": "_abl"})["x"]
        abl[nm] = {**r, "coefs": cf}
    df.drop(columns="_abl", inplace=True)
    print("ABLACIONES:", json.dumps({k: {kk: vv for kk, vv in v.items() if kk != "coefs"} for k, v in abl.items()}, indent=1))

    # C. comparacion
    cmp_te = F.compare(te, dict(SIGNALS))
    cmp_tr = F.compare(tr, dict(SIGNALS))
    a_m, a_r, a_f = (cmp_te[k]["auprc"] for k in ["maha_sola", "red_sola", "fusion_logistica"])
    h3 = bool(a_f > a_m and a_f > a_r)

    # A. regla de coincidencia
    nivel, thr_rule = F.coincidence_rule(df, m_tr)
    tab = F.level_table(te, nivel)

    # salidas: curvas PR, tablas
    C.RESULTS_DIR.mkdir(exist_ok=True)
    curves = []
    for nm, c in SIGNALS:
        p = pr_curve_df(te["isFraud"], te[c])
        p.insert(0, "senal", nm)
        curves.append(p)
    pd.concat(curves).to_csv(C.RESULTS_DIR / "fusion_pr_curves_test.csv", index=False)
    tab.to_csv(C.RESULTS_DIR / "fusion_regla_coincidencia_test.csv", index=False)
    pd.DataFrame({"feature": list(coefs), "coef_estandarizado": list(coefs.values())}).to_csv(
        C.RESULTS_DIR / "fusion_coeficientes.csv", index=False)
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        fig, ax = plt.subplots(figsize=(6, 4.5))
        for p in curves:
            ax.plot(p["recall"], p["precision"], label=p["senal"].iloc[0])
        ax.axhline(te["isFraud"].mean(), ls=":", c="gray", label="baseline")
        ax.set(xlabel="Recall", ylabel="Precision", title="PR en test (step>323)")
        ax.legend()
        fig.tight_layout()
        fig.savefig(C.RESULTS_DIR / "fusion_pr_curves_test.png", dpi=120)
        plt.close(fig)
    except Exception as e:  # PNG opcional
        print("PNG omitido:", e)

    # Deteccion temprana (necesita nombres completos; no con muestreo)
    early = {}
    if a.sample_frac is None:
        names = F.load_names_aligned(df)
        fr_all = df[df["isFraud"] == 1].join(names)
        ep = F.build_episodes(fr_all)
        leg = m_tr & (df["isFraud"] == 0)
        thr_alert = {c: float(np.percentile(df.loc[leg, c], 99))
                     for c in ["score_maha", "score_red", "score_fusion"]}
        # episodios cuyo primer fraude cae en test (se evalua el episodio completo
        # solo si empieza en test, para que la "primera tx" sea realmente la primera)
        first_step = fr_all.assign(ep=ep).groupby("ep")["step"].min()
        ep_starts_test = ep[ep.map(first_step) > C.STEP_SPLIT]
        te_ep = te.loc[te.index.intersection(ep_starts_test.index)]
        sizes = ep.value_counts().value_counts().sort_index()
        early["episodios_tamano_dist_todo"] = {int(k): int(v) for k, v in sizes.items()}
        early["umbrales_alerta_P99_legit_train"] = thr_alert
        for nm, c in SIGNALS:
            early[nm] = F.early_metrics(te_ep, c, thr_alert[c], ep_starts_test)
        te2 = te_ep.copy()
        te2["regla_any"] = (nivel.loc[te2.index] != "SIN_ALERTA").astype(float)
        te2["regla_alta"] = (nivel.loc[te2.index] == "ALERTA_ALTA").astype(float)
        early["regla_coincidencia_ALTA+MEDIA"] = F.early_metrics(te2, "regla_any", 0.5, ep_starts_test)
        early["regla_coincidencia_ALTA"] = F.early_metrics(te2, "regla_alta", 0.5, ep_starts_test)
        pd.DataFrame({k: v for k, v in early.items() if isinstance(v, dict) and "episodios" in v}).T.to_csv(
            C.RESULTS_DIR / "fusion_temprana_test.csv")

    met = {
        "n_train": int(m_tr.sum()), "n_test": int(m_te.sum()),
        "fraudes_test": int(te["isFraud"].sum()),
        "anti_leakage_grafo": chk,
        "comparacion_test": cmp_te, "comparacion_train": cmp_tr,
        "H3_confirmada": h3, "ablaciones_test": abl,
        "fusion_coeficientes_estandarizados": coefs, "fusion_intercepto": intercept,
        "score_red_def": "logistica de grafo (signal_graph.score_red_logistic) entrenada con train",
        "score_red_coefs": coefs_red,
        "umbrales_maha": thr_m, "regla_coincidencia_umbrales": thr_rule,
        "regla_coincidencia_test": tab.to_dict("records"),
        "deteccion_temprana": early,
        "definicion_temprana": (
            "Episodio = componente de cuentas unidas por fraudes (TRANSFER A->B y CASH_OUT posterior "
            "desde B, union-find). Solo episodios cuyo primer fraude cae en test. Alerta = score > P99 "
            "de legitimas-train. frac_primera_tx_alertada = fraccion de episodios cuya PRIMERA tx se "
            "alerta; frac_monto_protegible = monto fraudulento desde la primera alerta / monto total."),
    }
    with open(C.RESULTS_DIR / "fusion_metricas.json", "w", encoding="utf-8") as f:
        json.dump(met, f, indent=2, ensure_ascii=False, default=float)

    print(json.dumps({"comparacion_test": cmp_te, "H3": h3}, indent=1, default=float))
    print("coefs:", coefs, "intercepto:", intercept)
    print(tab.to_string())
    print(json.dumps(early, indent=1, default=float))
    print(f"[{time.time()-t0:.0f}s] fin")


if __name__ == "__main__":
    main()
