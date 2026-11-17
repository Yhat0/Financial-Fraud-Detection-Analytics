"""Fase 4A.1: entrena con TRAIN y persiste los artefactos en Model/models/.

Uso (desde Model/):  python train_and_export.py
"""
import time

import joblib
import numpy as np
import pandas as pd

from src import config as C
from src import fusion as F
from src import scoring as S
from src import signal_graph as G
from src.evaluate import auprc
from src.signal_mahalanobis import fit_normality_model, score as maha_score


def main():
    t0 = time.time()
    S.MODELS_DIR.mkdir(exist_ok=True)
    df, m_tr, m_te = S.load_dataset()
    print(f"[{time.time()-t0:.0f}s] filas={len(df):,} train={m_tr.sum():,} test={m_te.sum():,}")

    # 1) Mahalanobis (7 feats) solo legitimas-train
    X = df[C.MAHA_FEATURES].to_numpy("float64")
    legit = (m_tr & (df["isFraud"] == 0)).to_numpy()
    maha = fit_normality_model(X[legit])
    df["score_maha"] = maha_score(maha, X)

    # 2) logistica de grafo (solo train); verifica contra la implementacion de Fase 2
    graph = S.fit_graph_logit(df, m_tr)
    df["score_red"] = S.apply_graph_logit(graph, df).astype("float32")
    ref, _ = G.score_red_logistic(df, m_tr)
    assert np.allclose(df["score_red"], ref, atol=1e-4), "score_red difiere de signal_graph"

    # 3) fusion (solo train); verifica contra fusion.fit_fusion
    fus = S.fit_fusion_model(df, m_tr)
    z = S.apply_fusion(fus, df)
    ref_f, _, _ = F.fit_fusion(df, m_tr)
    assert np.allclose(z, ref_f, atol=1e-3), "fusion difiere de fusion.fit_fusion"
    df["prob"] = S.sigmoid(z)

    # 4) umbrales (todo desde train)
    tr = df[m_tr]
    leg_tr = tr[tr["isFraud"] == 0]
    thr = {
        "maha_p99_legit_train": float(np.percentile(leg_tr["score_maha"], 99)),
        "red_p99_legit_train": float(np.percentile(leg_tr["score_red"], 99)),
        "prob_alto": S.pick_threshold(tr["isFraud"], tr["prob"], S.TARGET_PREC_ALTO),
        "prob_medio": S.pick_threshold(tr["isFraud"], tr["prob"], S.TARGET_PREC_MEDIO),
        "target_precision_alto_train": S.TARGET_PREC_ALTO,
        "target_precision_medio_train": S.TARGET_PREC_MEDIO,
    }

    # 5) estado historico por nameDest al final de los datos (para el servicio en vivo)
    g = df.groupby("nameDest", sort=False)
    amt = df["amount"].astype("float64")
    st = pd.DataFrame({
        "nameDest": g["nameDest_s"].first(),
        "n_tx_dest": g.size().astype("int32"),
        "fan_in": g["nameOrig"].nunique().astype("int32"),
        "sum1": amt.groupby(df["nameDest"], sort=False).sum(),
        "sum2": (amt ** 2).groupby(df["nameDest"], sort=False).sum(),
    }).set_index("nameDest")
    max_step = int(df["step"].max())
    rec = df[df["step"] >= max_step - C.BURST_HOURS]
    recent = {k: v.astype("int16").tolist() for k, v in rec.groupby("nameDest_s")["step"]}

    meta = {"thresholds": thr, "max_step": max_step, "step_split": C.STEP_SPLIT,
            "big_amount": float(df.loc[m_tr, "amount"].quantile(C.BIG_AMOUNT_Q)),
            "base_date": S.BASE_DATE, "burst_hours": C.BURST_HOURS,
            "maha_features": C.MAHA_FEATURES, "graph_features": C.GRAPH_FEATURES,
            "fusion_features": F.FUSION_FEATURES,
            "fusion_coefs_std": dict(zip(F.FUSION_FEATURES, map(float, fus["coef"][0]))),
            "n_dest_state": int(len(st)), "n_dest_recent": len(recent),
            "auprc_test_fusion": auprc(df.loc[m_te, "isFraud"], df.loc[m_te, "prob"]),
            "aviso": "DEMO sobre PaySim; el fraude es detectable por artefacto de saldos (ver Fase 3.5)."}

    joblib.dump(maha, S.MODELS_DIR / "maha.joblib", compress=3)
    joblib.dump(graph, S.MODELS_DIR / "graph_logit.joblib", compress=3)
    joblib.dump(fus, S.MODELS_DIR / "fusion.joblib", compress=3)
    joblib.dump(meta, S.MODELS_DIR / "meta.joblib", compress=3)
    joblib.dump(st, S.MODELS_DIR / "dest_state.joblib", compress=3)
    joblib.dump(recent, S.MODELS_DIR / "dest_recent.joblib", compress=3)

    print("== Artefactos guardados en", S.MODELS_DIR)
    for p in sorted(S.MODELS_DIR.glob("*.joblib")):
        print(f"  {p.name:22s} {p.stat().st_size/1024:10.1f} KiB")
    print("umbrales:", thr)
    print("max_step:", max_step, "| destinos en estado:", len(st), "| destinos con steps recientes:", len(recent))
    print("coefs fusion (std):", meta["fusion_coefs_std"])
    print(f"AUPRC test fusion = {meta['auprc_test_fusion']:.4f}  [{time.time()-t0:.0f}s]")


if __name__ == "__main__":
    main()
