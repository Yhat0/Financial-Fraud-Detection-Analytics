"""Preparacion de datos (Plan Maestro seccion 2)."""
from __future__ import annotations

import numpy as np
import pandas as pd

from . import config as C


def load_raw(nrows: int | None = None, sample_frac: float | None = None,
             with_names: bool = False) -> pd.DataFrame:
    """Carga el CSV con dtypes compactos y solo las columnas necesarias.

    nrows: lee solo las primeras N filas (smoke test rapido).
    sample_frac: submuestreo aleatorio determinista (random_state fijo) tras
        filtrar por tipo; util para smoke test representativo.
    """
    cols = C.USE_COLS + (C.NAME_COLS if with_names else [])
    df = pd.read_csv(C.CSV_PATH, usecols=cols, dtype=dict(C.DTYPES), nrows=nrows)
    df = df[df["type"].isin(C.FRAUD_TYPES)]
    if with_names:
        # Cadenas -> ids enteros (ahorra RAM; solo importa la igualdad de cuentas)
        for c in C.NAME_COLS:
            df[c] = pd.factorize(df[c])[0].astype("int32")
    df["type"] = df["type"].cat.remove_unused_categories()
    if sample_frac is not None:
        df = df.sample(frac=sample_frac, random_state=C.RANDOM_STATE)
    # Orden temporal estable (critico para no filtrar futuro)
    return df.sort_values("step", kind="stable").reset_index(drop=True)


def add_features(df: pd.DataFrame) -> pd.DataFrame:
    """Anade features de saldo y transformaciones log1p."""
    # Calculo en float64 para evitar perdida de precision de float32 en restas.
    amt = df["amount"].astype("float64")
    oo = df["oldbalanceOrg"].astype("float64")
    no = df["newbalanceOrig"].astype("float64")
    od = df["oldbalanceDest"].astype("float64")
    nd = df["newbalanceDest"].astype("float64")

    df["errorOrig"] = (oo - amt - no).astype("float32")
    df["errorDest"] = (od + amt - nd).astype("float32")
    df["vaciaCuenta"] = ((no == 0) & (oo > 0)).astype("int8")
    df["ratioMonto"] = (amt / (oo + 1)).astype("float32")
    for c in C.RAW_BALANCE_COLS:
        df[f"log_{c}"] = np.log1p(df[c].astype("float64")).astype("float32")
    return df


def temporal_split(df: pd.DataFrame) -> tuple[pd.Series, pd.Series]:
    """Mascaras booleanas train (step<=552) y test (step>552). Nunca aleatorio."""
    train = df["step"] <= C.STEP_SPLIT
    return train, ~train


def prepare(nrows: int | None = None, sample_frac: float | None = None,
            with_names: bool = False):
    """Pipeline completo: devuelve (df, mask_train, mask_test)."""
    df = add_features(load_raw(nrows, sample_frac, with_names))
    m_train, m_test = temporal_split(df)
    return df, m_train, m_test
