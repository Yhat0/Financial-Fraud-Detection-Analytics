"""Senal 1: distancia de Mahalanobis (Plan Maestro seccion 3)."""
from __future__ import annotations

import numpy as np
import pandas as pd
from scipy.stats import chi2

from . import config as C


def fit_normality_model(X_legit: np.ndarray, robust: bool = False) -> dict:
    """Ajusta el modelo de normalidad con SOLO legitimas del train.

    1) Estandariza (media/sigma de legitimas-train; se reutiliza en test -> sin leakage).
    2) Estima mu y Sigma sobre los datos estandarizados (clasica o MinCovDet).
    3) Verifica SPD (Cholesky) y condicionamiento; si falla suma eps*I.
    Nota: tras estandarizar, Sigma (clasica) es la matriz de correlacion.
    """
    mean = X_legit.mean(axis=0)
    std = X_legit.std(axis=0)
    std[std == 0] = 1.0
    Z = (X_legit - mean) / std

    if robust:
        from sklearn.covariance import MinCovDet
        rng = np.random.RandomState(C.RANDOM_STATE)
        n = min(C.MCD_SUBSAMPLE, len(Z))
        idx = rng.choice(len(Z), n, replace=False)
        mcd = MinCovDet(random_state=C.RANDOM_STATE).fit(Z[idx])
        mu, sigma = mcd.location_, mcd.covariance_
    else:
        mu = Z.mean(axis=0)
        sigma = np.cov(Z, rowvar=False)

    sigma = (sigma + sigma.T) / 2  # fuerza simetria numerica
    cond = float(np.linalg.cond(sigma))
    eps_used = 0.0
    spd = True
    try:
        np.linalg.cholesky(sigma)
    except np.linalg.LinAlgError:
        spd = False
    if (not spd) or cond > C.COND_MAX:
        eps_used = C.COV_EPS
        sigma = sigma + eps_used * np.eye(sigma.shape[0])
        np.linalg.cholesky(sigma)  # debe ser SPD ahora (lanza si no)
    return {
        "mean": mean, "std": std, "mu": mu, "sigma": sigma,
        "sigma_inv": np.linalg.inv(sigma),
        "diagnostics": {
            "robust": robust, "spd_before_reg": spd, "cond_number": cond,
            "eps_regularization": eps_used,
            "min_eigenvalue": float(np.linalg.eigvalsh(sigma).min()),
        },
    }


def score(model: dict, X: np.ndarray, chunk: int = 1_000_000) -> np.ndarray:
    """d(x) = sqrt((x-mu)^T Sigma^-1 (x-mu)) en bloques (ahorra RAM)."""
    out = np.empty(len(X), dtype=np.float32)
    for i in range(0, len(X), chunk):
        Z = (X[i:i + chunk] - model["mean"]) / model["std"] - model["mu"]
        d2 = np.einsum("ij,jk,ik->i", Z, model["sigma_inv"], Z)
        out[i:i + chunk] = np.sqrt(np.maximum(d2, 0))
    return out


def add_score(df: pd.DataFrame, m_train: pd.Series, robust: bool = False):
    """Anade df['score_maha'] y devuelve (modelo, umbrales)."""
    X = df[C.MAHA_FEATURES].to_numpy(dtype="float64")
    legit_train = (m_train & (df["isFraud"] == 0)).to_numpy()
    model = fit_normality_model(X[legit_train], robust=robust)
    df["score_maha"] = score(model, X)

    k = len(C.MAHA_FEATURES)
    d_legit = df.loc[legit_train, "score_maha"].to_numpy()
    thr = {
        "p99_empirical": float(np.percentile(d_legit, 99)),
        "chi2_threshold_d": float(np.sqrt(chi2.ppf(C.CHI2_Q, k))),
        "chi2_threshold_d2": float(chi2.ppf(C.CHI2_Q, k)),
        "k": k,
        # fraccion de legitimas-train que supera el umbral chi2 (deberia ser 1% si fuera gaussiano)
        "frac_legit_above_chi2": float((d_legit > np.sqrt(chi2.ppf(C.CHI2_Q, k))).mean()),
    }
    return model, thr
