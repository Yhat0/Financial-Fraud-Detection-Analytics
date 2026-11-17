"""Fase 3: fusion de senales (Plan Maestro seccion 5 y 6, hipotesis H3).

Todas las entradas son causales: score_maha es por-transaccion (modelo ajustado con legitimas-train);
score_red/fan_in/burst usan SOLO pasado (ver signal_graph). La logistica y todos los umbrales
(escalado, P99, percentiles) se calculan SOLO con train.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression

from . import config as C
from .evaluate import auprc, recall_at_precision

FUSION_FEATURES = ["score_maha", "score_red", "errorOrig", "vaciaCuenta",
                   "ratioMonto", "fan_in", "burst"]


def _design(df: pd.DataFrame, feats=None) -> np.ndarray:
    """Matriz de entrada: asimetricas -> log1p (errorOrig: log1p con signo)."""
    eo = df["errorOrig"].to_numpy("float64")
    cols = [
        df["score_maha"].to_numpy("float64"),
        df["score_red"].to_numpy("float64"),
        np.sign(eo) * np.log1p(np.abs(eo)),
        df["vaciaCuenta"].to_numpy("float64"),
        np.log1p(df["ratioMonto"].to_numpy("float64").clip(min=0)),
        np.log1p(df["fan_in"].to_numpy("float64").clip(min=0)),
        np.log1p(df["burst"].to_numpy("float64").clip(min=0)),
    ]
    X = np.column_stack(cols)
    if feats is not None:
        X = X[:, [FUSION_FEATURES.index(f) for f in feats]]
    return X


def fit_fusion(df: pd.DataFrame, m_train: pd.Series, feats=None):
    """Logistica entrenada SOLO con train; z-score con media/desv del train."""
    mt = m_train.to_numpy()
    feats = feats or FUSION_FEATURES
    X = _design(df, feats)
    mu, sd = X[mt].mean(0), X[mt].std(0)
    sd[sd == 0] = 1.0
    Z = (X - mu) / sd
    clf = LogisticRegression(max_iter=2000, random_state=C.RANDOM_STATE)
    clf.fit(Z[mt], df.loc[m_train, "isFraud"].to_numpy())
    coefs = dict(zip(feats, map(float, clf.coef_[0])))
    return clf.decision_function(Z).astype("float32"), coefs, float(clf.intercept_[0])


def coincidence_rule(df: pd.DataFrame, m_train: pd.Series, q_m=0.99, q_r=0.99):
    """Variante A. Umbrales desde TRAIN: score_maha P99 de legitimas-train y
    score_red P99 de legitimas-train."""
    leg_tr = m_train & (df["isFraud"] == 0)
    thr_m = float(np.percentile(df.loc[leg_tr, "score_maha"], q_m * 100))
    thr_r = float(np.percentile(df.loc[leg_tr, "score_red"], q_r * 100))
    hm = df["score_maha"] > thr_m
    hr = df["score_red"] > thr_r
    nivel = np.where(hm & hr, "ALERTA_ALTA", np.where(hm | hr, "ALERTA_MEDIA", "SIN_ALERTA"))
    return pd.Series(nivel, index=df.index), {"umbral_maha": thr_m, "umbral_red": thr_r,
                                                "q_maha": q_m, "q_red": q_r}


def level_table(te: pd.DataFrame, nivel: pd.Series) -> pd.DataFrame:
    tot = int(te["isFraud"].sum())
    nv = nivel.loc[te.index]
    rows = []
    for lv, mask in [("ALERTA_ALTA", nv == "ALERTA_ALTA"), ("ALERTA_MEDIA", nv == "ALERTA_MEDIA"),
                     ("SIN_ALERTA", nv == "SIN_ALERTA"), ("ALTA+MEDIA", nv != "SIN_ALERTA")]:
        s = te[mask]
        f = int(s["isFraud"].sum())
        rows.append({"nivel": lv, "n": int(len(s)), "fraudes": f,
                     "precision": f / len(s) if len(s) else 0.0, "recall": f / tot})
    return pd.DataFrame(rows)


def compare(te: pd.DataFrame, cols: dict) -> dict:
    y = te["isFraud"]
    out = {"baseline": float(y.mean())}
    for name, c in cols.items():
        out[name] = {"auprc": auprc(y, te[c]),
                     "recall_at_precision_0.9": recall_at_precision(y, te[c], 0.9),
                     "recall_at_precision_0.5": recall_at_precision(y, te[c], 0.5)}
    return out


# ---------------- Deteccion temprana (episodios) ----------------
def load_names_aligned(df: pd.DataFrame) -> pd.DataFrame:
    """Relee nameOrig/nameDest con el MISMO filtro y orden que data_prep.prepare (sin muestreo)
    y los factoriza JUNTOS (mismo id para la misma cuenta en ambos roles), para poder enlazar
    TRANSFER (A->B) con el CASH_OUT posterior desde B."""
    raw = pd.read_csv(C.CSV_PATH, usecols=["step", "type", "nameOrig", "nameDest"],
                      dtype={"step": "int16", "type": "category"})
    raw = raw[raw["type"].isin(C.FRAUD_TYPES)].sort_values("step", kind="stable").reset_index(drop=True)
    assert len(raw) == len(df) and (raw["step"].to_numpy() == df["step"].to_numpy()).all(), \
        "desalineado con data_prep"
    codes, _ = pd.factorize(pd.concat([raw["nameOrig"], raw["nameDest"]], ignore_index=True))
    n = len(raw)
    return pd.DataFrame({"acc_orig": codes[:n].astype("int32"), "acc_dest": codes[n:].astype("int32")},
                        index=df.index)


def build_episodes(fr: pd.DataFrame) -> pd.Series:
    """Episodio de fraude = componente conexa (union-find) de cuentas unidas por transacciones
    fraudulentas: TRANSFER A->B y CASH_OUT posterior desde B caen en el mismo episodio.
    Devuelve el id de episodio por fila fraudulenta."""
    parent: dict = {}

    def find(x):
        parent.setdefault(x, x)
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    for o, d in zip(fr["acc_orig"].to_numpy(), fr["acc_dest"].to_numpy()):
        ro, rd = find(o), find(d)
        if ro != rd:
            parent[ro] = rd
    roots = [find(o) for o in fr["acc_orig"].to_numpy()]
    return pd.Series(pd.factorize(pd.Series(roots))[0], index=fr.index)


def early_metrics(te: pd.DataFrame, score_col: str, thr: float, ep: pd.Series) -> dict:
    """Por episodio de fraude (en test): fraccion cuya PRIMERA transaccion ya es alertada,
    fraccion alertada en algun momento, y 'monto protegible' = monto fraudulento desde la primera
    alerta del episodio (inclusive) / monto fraudulento total del episodio (se asume que la alerta
    bloquea desde ese punto)."""
    fr = te[te["isFraud"] == 1].copy()
    fr["ep"] = ep.loc[fr.index].to_numpy()
    fr["alert"] = fr[score_col] > thr
    fr = fr.sort_values(["ep", "step"], kind="stable")
    rows = []
    for _, g in fr.groupby("ep", sort=False):
        a = g["alert"].to_numpy()
        amt = g["amount"].to_numpy("float64")
        first = int(np.argmax(a)) if a.any() else None
        rows.append({"n_tx": len(g), "primera_alertada": bool(a[0]), "alguna_alertada": bool(a.any()),
                     "monto_total": float(amt.sum()),
                     "monto_protegible": float(amt[first:].sum()) if first is not None else 0.0})
    e = pd.DataFrame(rows)
    multi = e[e["n_tx"] >= 2]
    return {
        "episodios": int(len(e)), "episodios_multi_tx": int(len(multi)),
        "frac_primera_tx_alertada": float(e["primera_alertada"].mean()),
        "frac_alguna_tx_alertada": float(e["alguna_alertada"].mean()),
        "frac_primera_alertada_multi_tx": float(multi["primera_alertada"].mean()) if len(multi) else None,
        "frac_monto_protegible": float(e["monto_protegible"].sum() / e["monto_total"].sum()),
    }
