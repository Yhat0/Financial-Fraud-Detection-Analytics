"""Senal 2: grafo de destinos / mulas (Plan Maestro seccion 4).

REGLA ANTI-LEAKAGE: toda feature por nameDest usa SOLO transacciones anteriores
a la fila actual (orden: step y, dentro del mismo step, orden del archivo). La
fila actual nunca entra en su propio agregado. Se asume df ya ordenado por step
(estable), como lo deja data_prep.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression

from . import config as C


def add_graph_features(df: pd.DataFrame, m_train: pd.Series) -> dict:
    """Anade features causales por nameDest. Devuelve info (umbral de monto grande)."""
    n = len(df)
    dest = df["nameDest"].to_numpy()
    orig = df["nameOrig"].to_numpy()
    step = df["step"].to_numpy().astype("int64")
    amt = df["amount"].to_numpy().astype("float64")

    # Orden (nameDest, posicion original): mantiene el orden temporal dentro de cada destino.
    order = np.lexsort((np.arange(n), dest))
    d, o, s, a = dest[order], orig[order], step[order], amt[order]

    new_grp = np.r_[True, d[1:] != d[:-1]]
    grp_start = np.maximum.accumulate(np.where(new_grp, np.arange(n), 0))
    pos_in_grp = np.arange(n) - grp_start  # = n_tx_dest (exclusivo: filas previas del grupo)

    # fan_in: primera aparicion del par (dest, orig) en orden temporal; acumulado exclusivo
    first_pair = ~pd.DataFrame({"d": d, "o": o}).duplicated().to_numpy()
    cs = np.cumsum(first_pair.astype("int64"))
    base = cs[grp_start] - first_pair[grp_start]  # acumulado antes del grupo
    fan_in = cs - base - first_pair               # resta la marca de la fila actual

    # monto: sumas acumuladas exclusivas (float64)
    c1 = np.cumsum(a)
    c2 = np.cumsum(a * a)
    sum1 = c1 - (c1[grp_start] - a[grp_start]) - a
    sum2 = c2 - (c2[grp_start] - (a * a)[grp_start]) - a * a
    cnt = pos_in_grp.astype("float64")
    with np.errstate(divide="ignore", invalid="ignore"):
        mean = np.where(cnt > 0, sum1 / cnt, 0.0)
        var = np.where(cnt > 1, (sum2 - cnt * mean**2) / np.maximum(cnt - 1, 1), 0.0)
    std = np.sqrt(np.maximum(var, 0.0))

    # burst: filas PREVIAS del mismo destino con step >= step_actual - k.
    # keys ordenadas globalmente (dest, step); i - lo cuenta solo filas anteriores a i.
    big = 10_000
    keys = d.astype("int64") * big + s
    lo = np.searchsorted(keys, d.astype("int64") * big + (s - C.BURST_HOURS), side="left")
    burst = np.arange(n) - lo

    inv = np.empty(n, dtype="int64")
    inv[order] = np.arange(n)  # volver al orden original
    df["fan_in"] = fan_in[inv].astype("int32")
    df["n_tx_dest"] = pos_in_grp[inv].astype("int32")
    df["monto_total_in"] = sum1[inv].astype("float32")
    df["monto_medio_in"] = mean[inv].astype("float32")
    df["std_monto_in"] = std[inv].astype("float32")
    df["burst"] = burst[inv].astype("int32")

    big_amount = float(df.loc[m_train, "amount"].quantile(C.BIG_AMOUNT_Q))
    df["dest_sin_historial"] = ((df["n_tx_dest"] == 0) & (df["amount"] > big_amount)).astype("int8")
    return {"big_amount_threshold": big_amount}


def verify_no_leakage(df: pd.DataFrame, n_dest_check: int = 300) -> dict:
    """Aserciones anti-leakage. Lanza AssertionError si algo falla."""
    first = ~df["nameDest"].duplicated()  # primera tx de cada destino
    assert (df.loc[first, "fan_in"] == 0).all(), "fan_in != 0 en primera tx de un destino"
    assert (df.loc[first, "n_tx_dest"] == 0).all(), "n_tx_dest != 0 en primera tx"
    assert (df.loc[first, "burst"] == 0).all()
    assert (df["fan_in"] <= df["n_tx_dest"]).all(), "fan_in no puede superar n_tx_dest"

    # Fuerza bruta (bucle explicito, solo pasado) sobre destinos con >=2 transacciones
    rng = np.random.RandomState(C.RANDOM_STATE)
    vc = df["nameDest"].value_counts()
    cand = vc[vc >= 2].index.to_numpy()
    chosen = rng.choice(cand, min(n_dest_check, len(cand)), replace=False)
    sub = df[df["nameDest"].isin(chosen)]
    for _, g in sub.groupby("nameDest", sort=False):
        origs, amts, steps = set(), [], []
        for r in g.itertuples():
            assert r.fan_in == len(origs), "fan_in difiere del calculo causal"
            assert r.n_tx_dest == len(amts)
            assert np.isclose(r.monto_total_in, sum(amts), rtol=1e-4, atol=1e-2)
            assert r.burst == sum(1 for t in steps if t >= r.step - C.BURST_HOURS)
            origs.add(r.nameOrig)
            amts.append(r.amount)
            steps.append(r.step)
    return {"destinos_nuevos_verificados": int(first.sum()),
            "destinos_fuerza_bruta": int(len(chosen)), "passed": True}


def score_red_simple(df: pd.DataFrame, m_train: pd.Series) -> np.ndarray:
    """Variante 1: min-max (caps en P99.9 del TRAIN, sin mirar test) de fan_in y burst,
    mas dest_sin_historial; promedio simple."""
    parts = []
    for c in ["fan_in", "burst"]:
        cap = max(float(df.loc[m_train, c].quantile(0.999)), 1.0)
        parts.append((df[c].clip(upper=cap) / cap).to_numpy())
    parts.append(df["dest_sin_historial"].to_numpy().astype(float))
    return np.mean(parts, axis=0).astype("float32")


def score_red_logistic(df: pd.DataFrame, m_train: pd.Series):
    """Variante 2: regresion logistica entrenada SOLO con train (log1p + z-score del train)."""
    mt = m_train.to_numpy()
    X = np.log1p(df[C.GRAPH_FEATURES].to_numpy(dtype="float64").clip(min=0))
    mu, sd = X[mt].mean(0), X[mt].std(0)
    sd[sd == 0] = 1
    X = (X - mu) / sd
    clf = LogisticRegression(max_iter=1000, random_state=C.RANDOM_STATE)
    clf.fit(X[mt], df.loc[m_train, "isFraud"])
    coefs = dict(zip(C.GRAPH_FEATURES, map(float, clf.coef_[0])))
    return clf.decision_function(X).astype("float32"), coefs
