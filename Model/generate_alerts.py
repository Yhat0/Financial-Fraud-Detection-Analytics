"""Fase 4A.2: puntua TODO el dataset con el modelo guardado y genera resultados/alertas.db (SQLite).

Tablas: alerts (solo ALTA/MEDIA), timeline (por dia), timeline_hourly (por step), summary (long).
timestamp sintetico = BASE_DATE (2024-01-01 00:00:00) + (step-1) horas.
Uso (desde Model/):  python generate_alerts.py   (requiere haber corrido train_and_export.py)
"""
import sqlite3
import time

import numpy as np
import pandas as pd

from src import config as C
from src import scoring as S
from src.evaluate import auprc

DB = C.RESULTS_DIR / "alertas.db"


def prf(sub: pd.DataFrame, flag: pd.Series, total_fraud: int) -> dict:
    n = int(flag.sum())
    tp = int(sub.loc[flag, "isFraud"].sum())
    return {"alertas": n, "fraudes_capturados": tp,
            "precision": tp / n if n else 0.0, "recall": tp / total_fraud if total_fraud else 0.0}


def main():
    t0 = time.time()
    art = S.load_artifacts()
    df, m_tr, m_te = S.load_dataset()
    assert abs(art["meta"]["big_amount"] - float(df.loc[m_tr, "amount"].quantile(C.BIG_AMOUNT_Q))) < 1e-3
    S.score_frame(art, df)
    print(f"[{time.time()-t0:.0f}s] dataset puntuado ({len(df):,} filas)")

    base = pd.Timestamp(S.BASE_DATE)
    df["timestamp"] = (base + pd.to_timedelta(df["step"].astype("int64") - 1, unit="h")).dt.strftime("%Y-%m-%d %H:%M:%S")
    df["split"] = np.where(m_tr, "train", "test")
    df["tx_id"] = np.arange(1, len(df) + 1)
    df["alerta"] = df["alert_level"] != "NINGUNA"

    # ---- alerts ----
    a = df[df["alerta"]]
    alerts = pd.DataFrame({
        "id": a["tx_id"], "timestamp": a["timestamp"], "step": a["step"].astype(int),
        "type": a["type"].astype(str), "amount": a["amount"].astype(float),
        "nameOrig": a["nameOrig_s"], "nameDest": a["nameDest_s"], "prob": a["prob"].astype(float),
        "alert_level": a["alert_level"], "maha_flag": a["maha_flag"].astype(int),
        "red_flag": a["red_flag"].astype(int), "score_maha": a["score_maha"].astype(float),
        "score_red": a["score_red"].astype(float), "fan_in": a["fan_in"].astype(int),
        "split": a["split"], "isFraud": a["isFraud"].astype(int),
        "oldbalanceOrg": a["oldbalanceOrg"].astype(float), "newbalanceOrig": a["newbalanceOrig"].astype(float),
        "oldbalanceDest": a["oldbalanceDest"].astype(float), "newbalanceDest": a["newbalanceDest"].astype(float),
    })

    # ---- timelines ----
    def agg(key):
        g = df.groupby(key)
        t = pd.DataFrame({
            "n_tx": g.size(),
            "n_alta": g["alert_level"].apply(lambda s: int((s == "ALTA").sum())),
            "n_media": g["alert_level"].apply(lambda s: int((s == "MEDIA").sum())),
            "n_fraudes": g["isFraud"].sum().astype(int),
            "monto_en_alerta": df["amount"].where(df["alerta"], 0.0).astype("float64").groupby(df[key]).sum(),
            "fraudes_en_alerta": df["isFraud"].where(df["alerta"], 0).groupby(df[key]).sum().astype(int),
        }).reset_index()
        return t
    df["dia"] = (df["step"].astype("int64") - 1) // 24
    tl = agg("dia")
    tl["fecha"] = (base + pd.to_timedelta(tl["dia"], unit="D")).dt.strftime("%Y-%m-%d")
    th = agg("step")
    th["timestamp"] = (base + pd.to_timedelta(th["step"].astype("int64") - 1, unit="h")).dt.strftime("%Y-%m-%d %H:%M:%S")

    # ---- summary (long) ----
    rows = []
    thr = art["meta"]["thresholds"]
    for k, v in thr.items():
        rows.append(("global", f"umbral_{k}", float(v)))
    rows += [("global", "base_date", S.BASE_DATE), ("global", "step_split", C.STEP_SPLIT),
             ("global", "aviso", "DEMO sobre PaySim: el fraude es detectable por artefacto de saldos; "
                                 "no es prueba cientifica de deteccion en datos reales.")]
    out_json = {}
    for scope, mask in [("all", np.ones(len(df), bool)), ("train", m_tr.to_numpy()), ("test", m_te.to_numpy())]:
        sub = df[mask]
        tf = int(sub["isFraud"].sum())
        vals = {"total_tx": len(sub), "total_fraudes": tf, "tasa_base": tf / len(sub),
                "auprc_prob": auprc(sub["isFraud"], sub["prob"])}
        for nm, flag in [("alta", sub["alert_level"] == "ALTA"), ("media", sub["alert_level"] == "MEDIA"),
                         ("alta_o_media", sub["alerta"])]:
            for k, v in prf(sub, flag, tf).items():
                vals[f"{nm}_{k}"] = v
        out_json[scope] = vals
        rows += [(scope, k, float(v)) for k, v in vals.items()]
    summary = pd.DataFrame(rows, columns=["scope", "metric", "value"]).astype({"value": "object"})
    summary["value"] = summary["value"].astype(str)

    # ---- escribir SQLite ----
    C.RESULTS_DIR.mkdir(exist_ok=True)
    if DB.exists():
        DB.unlink()
    con = sqlite3.connect(DB)
    alerts.to_sql("alerts", con, index=False)
    tl.to_sql("timeline", con, index=False)
    th.to_sql("timeline_hourly", con, index=False)
    summary.to_sql("summary", con, index=False)
    con.execute("CREATE INDEX ix_alerts_step ON alerts(step)")
    con.execute("CREATE INDEX ix_alerts_level ON alerts(alert_level)")
    con.execute("CREATE INDEX ix_alerts_ts ON alerts(timestamp)")
    con.commit()
    for t in ["alerts", "timeline", "timeline_hourly", "summary"]:
        n = con.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0]
        print(f"tabla {t}: {n} filas")
        print("   ", [r[1] + " " + r[2] for r in con.execute(f"PRAGMA table_info({t})")])
    print("alertas por nivel:", con.execute("SELECT alert_level, COUNT(*), SUM(isFraud) FROM alerts GROUP BY 1").fetchall())
    con.close()
    for scope, v in out_json.items():
        print(scope, {k: (round(x, 4) if isinstance(x, float) else x) for k, x in v.items()})
    print("umbrales:", thr)
    print(f"DB: {DB} ({DB.stat().st_size/1e6:.1f} MB)  [{time.time()-t0:.0f}s]")


if __name__ == "__main__":
    main()
