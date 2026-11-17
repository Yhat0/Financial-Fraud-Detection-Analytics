"""Fase 4A: ajuste/persistencia y puntuacion del modelo de FUSION COMPLETO (demo sobre PaySim).

Modelo = Mahalanobis (7 feats) + logistica de grafo (score_red) + logistica de fusion sobre
[score_maha, score_red, errorOrig, vaciaCuenta, ratioMonto, fan_in, burst]. Todo se ajusta SOLO con
train (step<=STEP_SPLIT). Las features de red usan solo pasado (ver signal_graph).

AVISO: el fraude de PaySim es casi perfectamente detectable por el artefacto de reconciliacion de
saldos (ver Fase 3.5); este modelo es un DEMO, no evidencia cientifica de deteccion en datos reales.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import precision_recall_curve

from . import config as C
from . import fusion as F
from . import signal_graph as G
from .data_prep import add_features, prepare
from .signal_mahalanobis import fit_normality_model, score as maha_score

MODELS_DIR = C.ROOT / "Model" / "models"
BASE_DATE = "2024-01-01 00:00:00"  # step=1 -> BASE_DATE; timestamp = BASE_DATE + (step-1) horas
TARGET_PREC_ALTO = 0.95            # ALTA: menor umbral con precision>=0.95 en TRAIN
TARGET_PREC_MEDIO = 0.50           # MEDIA: menor umbral con precision>=0.50 en TRAIN


def load_dataset():
    """Dataset completo (TRANSFER+CASH_OUT, ordenado por step) con features causales y nombres str."""
    df, m_tr, m_te = prepare(with_names=True)
    G.add_graph_features(df, m_tr)
    raw = pd.read_csv(C.CSV_PATH, usecols=["step", "type", "nameOrig", "nameDest"],
                      dtype={"step": "int16", "type": "category"})
    raw = raw[raw["type"].isin(C.FRAUD_TYPES)].sort_values("step", kind="stable").reset_index(drop=True)
    assert len(raw) == len(df) and (raw["step"].to_numpy() == df["step"].to_numpy()).all(), \
        "nombres desalineados con data_prep"
    df["nameOrig_s"] = raw["nameOrig"].to_numpy()
    df["nameDest_s"] = raw["nameDest"].to_numpy()
    return df, m_tr, m_te


# ---------- ajuste ----------
def fit_graph_logit(df, m_tr) -> dict:
    mt = m_tr.to_numpy()
    X = np.log1p(df[C.GRAPH_FEATURES].to_numpy(dtype="float64").clip(min=0))
    mu, sd = X[mt].mean(0), X[mt].std(0)
    sd[sd == 0] = 1
    clf = LogisticRegression(max_iter=1000, random_state=C.RANDOM_STATE)
    clf.fit(((X - mu) / sd)[mt], df.loc[m_tr, "isFraud"])
    return {"mu": mu, "sd": sd, "coef": clf.coef_.copy(), "intercept": clf.intercept_.copy(),
            "features": list(C.GRAPH_FEATURES)}


def apply_graph_logit(art: dict, df) -> np.ndarray:
    X = np.log1p(df[art["features"]].to_numpy(dtype="float64").clip(min=0))
    return (((X - art["mu"]) / art["sd"]) @ art["coef"].T + art["intercept"]).ravel()


def fit_fusion_model(df, m_tr) -> dict:
    mt = m_tr.to_numpy()
    X = F._design(df)
    mu, sd = X[mt].mean(0), X[mt].std(0)
    sd[sd == 0] = 1.0
    clf = LogisticRegression(max_iter=2000, random_state=C.RANDOM_STATE)
    clf.fit(((X - mu) / sd)[mt], df.loc[m_tr, "isFraud"].to_numpy())
    return {"mu": mu, "sd": sd, "coef": clf.coef_.copy(), "intercept": clf.intercept_.copy(),
            "features": list(F.FUSION_FEATURES)}


def apply_fusion(art: dict, df) -> np.ndarray:
    Z = (F._design(df) - art["mu"]) / art["sd"]
    return (Z @ art["coef"].T + art["intercept"]).ravel()


def sigmoid(z):
    return 1.0 / (1.0 + np.exp(-np.clip(z, -50, 50)))


def pick_threshold(y, p, target_precision: float) -> float:
    """Menor umbral de probabilidad con precision >= target (sobre y,p dados)."""
    prec, _, thr = precision_recall_curve(y, p)
    ok = np.where(prec[:-1] >= target_precision)[0]
    return float(thr[ok[0]]) if len(ok) else float(thr[-1])


# ---------- puntuacion ----------
def score_frame(art: dict, df: pd.DataFrame) -> pd.DataFrame:
    """df debe tener features de saldo (add_features) y de grafo. Anade score_maha, score_red,
    prob, maha_flag, red_flag, alert_level."""
    X = df[C.MAHA_FEATURES].to_numpy(dtype="float64")
    df["score_maha"] = maha_score(art["maha"], X)
    df["score_red"] = apply_graph_logit(art["graph"], df).astype("float32")
    df["prob"] = sigmoid(apply_fusion(art["fusion"], df))
    t = art["meta"]["thresholds"]
    df["maha_flag"] = df["score_maha"] > t["maha_p99_legit_train"]
    df["red_flag"] = df["score_red"] > t["red_p99_legit_train"]
    df["alert_level"] = np.where(df["prob"] > t["prob_alto"], "ALTA",
                                 np.where(df["prob"] > t["prob_medio"], "MEDIA", "NINGUNA"))
    return df


def load_artifacts() -> dict:
    import joblib
    return {"maha": joblib.load(MODELS_DIR / "maha.joblib"),
            "graph": joblib.load(MODELS_DIR / "graph_logit.joblib"),
            "fusion": joblib.load(MODELS_DIR / "fusion.joblib"),
            "meta": joblib.load(MODELS_DIR / "meta.joblib")}


def live_features(state: pd.DataFrame, recent: dict, meta: dict, tx: dict) -> pd.DataFrame:
    """Construye 1 fila con todas las features para una transaccion nueva.
    state: DataFrame indexado por nameDest (n_tx_dest, fan_in, sum1, sum2); recent: nameDest -> steps."""
    df = pd.DataFrame([{k: tx[k] for k in ["amount", "oldbalanceOrg", "newbalanceOrig",
                                             "oldbalanceDest", "newbalanceDest"]}])
    df = add_features(df)
    name = tx["nameDest"]
    if name in state.index:
        r = state.loc[name]
        n, fan_in, s1, s2 = float(r["n_tx_dest"]), int(r["fan_in"]), float(r["sum1"]), float(r["sum2"])
    else:
        n, fan_in, s1, s2 = 0.0, 0, 0.0, 0.0
    mean = s1 / n if n > 0 else 0.0
    var = (s2 - n * mean ** 2) / max(n - 1, 1) if n > 1 else 0.0
    step = tx.get("step") or meta["max_step"] + 1
    burst = sum(1 for s in recent.get(name, []) if s >= step - C.BURST_HOURS)
    df["fan_in"], df["n_tx_dest"] = fan_in, int(n)
    df["monto_medio_in"], df["std_monto_in"] = mean, float(np.sqrt(max(var, 0.0)))
    df["burst"] = burst
    df["dest_sin_historial"] = int(n == 0 and tx["amount"] > meta["big_amount"])
    return df
