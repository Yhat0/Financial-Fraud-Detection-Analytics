"""Evaluacion de la Senal 1 (Plan Maestro secciones 3.4 y 6)."""
from __future__ import annotations

import json

import numpy as np
import pandas as pd
from sklearn.metrics import average_precision_score, precision_recall_curve

from . import config as C


def auprc(y, s) -> float:
    return float(average_precision_score(y, s))


def quartiles_by_class(df: pd.DataFrame, col: str = "score_maha") -> dict:
    out = {}
    for label, name in [(1, "fraude"), (0, "legitimo")]:
        q = df.loc[df["isFraud"] == label, col].quantile([.25, .5, .75])
        out[name] = {"Q1": float(q.iloc[0]), "Q2": float(q.iloc[1]), "Q3": float(q.iloc[2]),
                     "n": int((df["isFraud"] == label).sum())}
    return out


def decile_table(df: pd.DataFrame, col: str = "score_maha") -> pd.DataFrame:
    """Tasa de fraude por decil del score (decil 10 = score mas alto)."""
    dec = pd.qcut(df[col].rank(method="first"), 10, labels=range(1, 11))
    g = df.groupby(dec, observed=True).agg(
        n=("isFraud", "size"), fraudes=("isFraud", "sum"),
        score_min=(col, "min"), score_max=(col, "max"))
    g["tasa_fraude"] = g["fraudes"] / g["n"]
    g["lift"] = g["tasa_fraude"] / df["isFraud"].mean()
    g.index.name = "decil"
    return g.reset_index()


def pr_curve_df(y, s, max_points: int = 5000) -> pd.DataFrame:
    p, r, t = precision_recall_curve(y, s)
    p, r = p[:-1], r[:-1]  # alinear con t
    if len(t) > max_points:  # submuestreo uniforme para mantener el archivo pequeno
        idx = np.linspace(0, len(t) - 1, max_points).astype(int)
        p, r, t = p[idx], r[idx], t[idx]
    return pd.DataFrame({"precision": p, "recall": r, "threshold": t})


def recall_at_precision(y, s, min_precision: float) -> float:
    p, r, _ = precision_recall_curve(y, s)
    ok = p >= min_precision
    return float(r[ok].max()) if ok.any() else 0.0


def evaluate(df, m_train, m_test, thr, diagnostics) -> dict:
    C.RESULTS_DIR.mkdir(exist_ok=True)
    tr, te = df[m_train], df[m_test]
    metrics = {
        "n_train": int(len(tr)), "n_test": int(len(te)),
        "fraudes_train": int(tr["isFraud"].sum()), "fraudes_test": int(te["isFraud"].sum()),
        "auprc_test": auprc(te["isFraud"], te["score_maha"]),
        "auprc_train": auprc(tr["isFraud"], tr["score_maha"]),
        "baseline_auprc_test": float(te["isFraud"].mean()),
        "recall_at_precision_0.9_test": recall_at_precision(te["isFraud"], te["score_maha"], 0.9),
        "quartiles_test": quartiles_by_class(te),
        "quartiles_train": quartiles_by_class(tr),
        "thresholds": thr,
        "model_diagnostics": diagnostics,
    }
    # Fraude/legitimas por encima de cada umbral en test
    for name, t in [("p99", thr["p99_empirical"]), ("chi2", thr["chi2_threshold_d"])]:
        above = te["score_maha"] > t
        metrics[f"test_umbral_{name}"] = {
            "alertas": int(above.sum()),
            "fraudes_capturados": int(te.loc[above, "isFraud"].sum()),
            "precision": float(te.loc[above, "isFraud"].mean()) if above.any() else 0.0,
            "recall": float(te.loc[above, "isFraud"].sum() / max(te["isFraud"].sum(), 1)),
        }

    dec_te = decile_table(te)
    dec_te.to_csv(C.RESULTS_DIR / "senal1_deciles_test.csv", index=False)
    decile_table(tr).to_csv(C.RESULTS_DIR / "senal1_deciles_train.csv", index=False)
    pr_curve_df(te["isFraud"], te["score_maha"]).to_csv(
        C.RESULTS_DIR / "senal1_pr_curve_test.csv", index=False)
    metrics["deciles_test"] = dec_te.to_dict("records")

    # Muestra de scores (todo el fraude + 20k legitimas, determinista)
    fr = df[df["isFraud"] == 1]
    lg = df[df["isFraud"] == 0].sample(n=min(20000, int((df["isFraud"] == 0).sum())),
                                       random_state=C.RANDOM_STATE)
    pd.concat([fr, lg]).sort_values("step")[
        ["step", "type", "amount", "isFraud", "score_maha"]
    ].to_csv(C.RESULTS_DIR / "senal1_muestra_scores.csv", index=False)

    with open(C.RESULTS_DIR / "senal1_metricas.json", "w", encoding="utf-8") as f:
        json.dump(metrics, f, indent=2, ensure_ascii=False)

    _try_plot(te)
    return metrics


def _try_plot(te: pd.DataFrame) -> None:
    """PNG opcional de la curva PR; se omite si matplotlib no esta disponible."""
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
    except Exception:
        return
    pr = pr_curve_df(te["isFraud"], te["score_maha"])
    fig, ax = plt.subplots(figsize=(5, 4))
    ax.plot(pr["recall"], pr["precision"])
    ax.set(xlabel="Recall", ylabel="Precision", title="PR - Mahalanobis (test)")
    fig.tight_layout()
    fig.savefig(C.RESULTS_DIR / "senal1_pr_curve_test.png", dpi=120)
    plt.close(fig)
