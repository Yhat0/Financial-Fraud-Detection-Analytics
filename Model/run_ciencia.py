"""Fase 3.5: evaluacion cientifica honesta (aislar el artefacto de reconciliacion de PaySim).

Uso (desde Model/):  python run_ciencia.py
Todo ajuste (mu, Sigma, estandarizacion, logisticas, IsolationForest) usa SOLO train.
"""
import json
import time

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression

from src import config as C
from src import signal_graph as G
from src.data_prep import prepare
from src.evaluate import auprc, recall_at_precision
from src.signal_mahalanobis import fit_normality_model, score as maha_score

RECON = ["errorOrig", "errorDest", "vaciaCuenta"]
MAGN = ["log_amount", "log_oldbalanceOrg", "log_newbalanceOrig",
        "log_oldbalanceDest", "log_newbalanceDest", "ratioMonto"]
RED_EXTRA = ["fan_in", "n_tx_dest", "dest_sin_historial", "burst"]


def slog(x):
    x = np.asarray(x, dtype="float64")
    return np.sign(x) * np.log1p(np.abs(x))


def build_matrix(df, cols):
    """Transformaciones: errores -> log con signo; ratioMonto/conteos -> log1p; resto tal cual."""
    out = []
    for c in cols:
        v = df[c].to_numpy("float64")
        if c in ("errorOrig", "errorDest"):
            v = slog(v)
        elif c in ("ratioMonto", "fan_in", "n_tx_dest", "burst"):
            v = np.log1p(v.clip(min=0))
        out.append(v)
    return np.column_stack(out)


def fit_logit(df, m_tr, cols):
    mt = m_tr.to_numpy()
    X = build_matrix(df, cols)
    mu, sd = X[mt].mean(0), X[mt].std(0)
    sd[sd == 0] = 1
    Z = (X - mu) / sd
    clf = LogisticRegression(max_iter=3000, random_state=C.RANDOM_STATE)
    clf.fit(Z[mt], df.loc[m_tr, "isFraud"].to_numpy())
    return clf.decision_function(Z), dict(zip(cols, map(float, clf.coef_[0])))


def main():
    t0 = time.time()
    df, m_tr, m_te = prepare(with_names=True)
    G.add_graph_features(df, m_tr)
    G.verify_no_leakage(df)
    df["score_red"], _ = G.score_red_logistic(df, m_tr)
    y_te = df.loc[m_te, "isFraud"]
    base = float(y_te.mean())
    print(f"[{time.time()-t0:.0f}s] listo; test={m_te.sum():,} fraudes={int(y_te.sum())}")

    # maha original (7 features) para comparar
    legit = (m_tr & (df["isFraud"] == 0)).to_numpy()
    mo = fit_normality_model(df[C.MAHA_FEATURES].to_numpy("float64")[legit])
    df["score_maha"] = maha_score(mo, df[C.MAHA_FEATURES].to_numpy("float64"))

    # PASO 3: maha_clean (solo MAGNITUDES; ratioMonto en log1p por su cola pesada)
    df["log_ratioMonto"] = np.log1p(df["ratioMonto"].astype("float64").clip(lower=0))
    mc_feats = ["log_amount", "log_oldbalanceOrg", "log_newbalanceOrig",
                "log_oldbalanceDest", "log_newbalanceDest", "log_ratioMonto"]
    Xc = df[mc_feats].to_numpy("float64")
    mc = fit_normality_model(Xc[legit])
    df["maha_clean"] = maha_score(mc, Xc)
    mc_diag = mc["diagnostics"]

    # PASO 1: regla trivial de reconciliacion
    df["regla_recon"] = ((df["vaciaCuenta"] == 1) & (df["errorOrig"].abs() < 1)).astype("float32")
    te = df[m_te]
    pred = te["regla_recon"] == 1
    regla = {"alertas": int(pred.sum()), "fraudes_capturados": int(te.loc[pred, "isFraud"].sum()),
             "precision": float(te.loc[pred, "isFraud"].mean()),
             "recall": float(te.loc[pred, "isFraud"].sum() / te["isFraud"].sum()),
             "auprc": auprc(te["isFraud"], te["regla_recon"])}

    def metr(col):
        s = df.loc[m_te, col]
        return {"auprc": auprc(y_te, s), "recall_at_precision_0.9": recall_at_precision(y_te, s, 0.9),
                "recall_at_precision_0.5": recall_at_precision(y_te, s, 0.5)}

    rows, coefs = [], {}
    rows.append(("a) regla trivial reconciliacion (artefacto)", "regla_recon", None))
    rows.append(("0) maha original (7 feats, con errorOrig/errorDest)", "score_maha", None))
    rows.append(("b) maha_clean sola", "maha_clean", None))
    rows.append(("c) red sola (score_red)", "score_red", None))
    specs = [
        ("d) fusion(maha_clean + red)", ["maha_clean", "score_red"]),
        ("d2) fusion(maha_clean + red + fan_in,n_tx_dest,dest_sin_hist,burst)", ["maha_clean", "score_red"] + RED_EXTRA),
        ("x) logistica solo MAGNITUDES", MAGN),
        ("x2) logistica maha_clean + MAGNITUDES (sin red)", ["maha_clean"] + MAGN),
        ("e) fusion(maha_clean + red + MAGNITUDES)", ["maha_clean", "score_red"] + MAGN),
        ("e2) e + extras de red", ["maha_clean", "score_red"] + MAGN + RED_EXTRA),
        ("y) logistica solo RECONCILIACION", RECON),
        ("f) fusion completa (+ RECONCILIACION)", ["maha_clean", "score_red"] + MAGN + RED_EXTRA + RECON),
    ]
    for name, cols in specs:
        col = "_s_" + name.split(")")[0]
        df[col], cf = fit_logit(df, m_tr, cols)
        coefs[name] = cf
        rows.append((name, col, cols))

    tabla = []
    for name, col, cols in rows:
        tabla.append({"modelo": name, **metr(col)})
    tabla.insert(0, {"modelo": "baseline (tasa base)", "auprc": base,
                     "recall_at_precision_0.9": None, "recall_at_precision_0.5": None})
    T = pd.DataFrame(tabla)
    C.RESULTS_DIR.mkdir(exist_ok=True)
    T.to_csv(C.RESULTS_DIR / "ciencia_ablaciones.csv", index=False)
    A = {r["modelo"].split(")")[0]: r["auprc"] for r in tabla}

    # PASO 5: baselines de referencia (IsolationForest sobre MAGNITUDES, fit solo legitimas-train)
    extra = {}
    try:
        from sklearn.ensemble import IsolationForest
        rng = np.random.RandomState(C.RANDOM_STATE)
        idx = rng.choice(np.where(legit)[0], 200_000, replace=False)
        Xm = build_matrix(df, MAGN)
        iso = IsolationForest(n_estimators=100, random_state=C.RANDOM_STATE, n_jobs=1).fit(Xm[idx])
        df["iforest_magn"] = -iso.score_samples(Xm)
        extra["isolation_forest_magnitudes"] = metr("iforest_magn")
        Xr = build_matrix(df, MAGN + ["fan_in", "burst", "n_tx_dest", "dest_sin_historial"])
        iso2 = IsolationForest(n_estimators=100, random_state=C.RANDOM_STATE, n_jobs=1).fit(Xr[idx])
        df["iforest_magn_red"] = -iso2.score_samples(Xr)
        extra["isolation_forest_magnitudes+red"] = metr("iforest_magn_red")
    except Exception as e:
        extra["isolation_forest"] = f"omitido: {e}"

    marg = {
        "red_sobre_maha_clean (d - b)": A["d"] - A["b"],
        "red_sobre_maha_clean+magnitudes (e - x2)": A["e"] - A["x2"],
        "magnitudes_sobre_maha_clean+red (e - d)": A["e"] - A["d"],
        "reconciliacion_sobre_todo_lo_demas (f - e2)": A["f"] - A["e2"],
        "fraccion_de_f_que_es_artefacto (1 - e2/f)": 1 - A["e2"] / A["f"],
        "maha_clean - maha_original": A["b"] - A["0"],
    }
    concl = {
        "H3_honesta_fusion_limpia_supera_ambas_senales": bool(A["d"] > A["b"] and A["d"] > A["c"]),
        "auprc_d": A["d"], "auprc_b_maha_clean": A["b"], "auprc_c_red": A["c"],
    }
    met = {"baseline_auprc_test": base, "n_test": int(m_te.sum()), "fraudes_test": int(y_te.sum()),
           "regla_reconciliacion_test": regla, "maha_clean_features": mc_feats,
           "maha_clean_diagnostics": mc_diag, "auprc_maha_clean": A["b"],
           "auprc_maha_original": A["0"], "tabla": tabla, "aporte_marginal": marg,
           "coeficientes": coefs, "baselines_referencia": extra, "conclusion": concl,
           "nota_artefacto": ("La regla vaciaCuenta & |errorOrig|<1 explota la forma en que PaySim "
                              "genera saldos (fraude vacia la cuenta con saldos consistentes); no es "
                              "transferible a datos reales, donde el fraude no deja esa firma.")}
    with open(C.RESULTS_DIR / "ciencia_ablaciones.json", "w", encoding="utf-8") as f:
        json.dump(met, f, indent=2, ensure_ascii=False, default=float)
    pd.set_option("display.width", 200, "display.max_colwidth", 80)
    print(T.to_string())
    print("regla:", regla)
    print("marginales:", json.dumps(marg, indent=1))
    print("extra:", json.dumps(extra, indent=1, default=float))
    print("conclusion:", concl, "maha_clean diag:", mc_diag)
    print(f"[{time.time()-t0:.0f}s] fin")


if __name__ == "__main__":
    main()
