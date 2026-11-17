"""Fase 4A.3: servicio de scoring en vivo (FastAPI). DEMO sobre PaySim.

Arranque (desde Model/):  uvicorn service:app --port 8000
Requiere haber corrido train_and_export.py (artefactos en Model/models/).
"""
import os
import secrets
from typing import Literal, Optional

import joblib
from fastapi import APIRouter, Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

from src import scoring as S

# Clave DEV por defecto (identica en .NET y web para que el demo arranque sin configurar).
# En produccion: definir SCORING_API_KEY y cambiarla en los 3 servicios.
API_KEY = os.environ.get("SCORING_API_KEY", "dev-key-change-me")

app = FastAPI(title="Fraud scoring (demo PaySim)", version="1.0")


def require_key(x_api_key: Optional[str] = Header(default=None)) -> None:
    if not x_api_key or not secrets.compare_digest(x_api_key, API_KEY):
        raise HTTPException(status_code=401, detail="API key invalida o ausente (cabecera X-API-Key)")


v1 = APIRouter(prefix="/v1")

ART = S.load_artifacts()
STATE = joblib.load(S.MODELS_DIR / "dest_state.joblib")
RECENT = joblib.load(S.MODELS_DIR / "dest_recent.joblib")


class Tx(BaseModel):
    type: Literal["TRANSFER", "CASH_OUT"]
    amount: float = Field(ge=0)
    oldbalanceOrg: float
    newbalanceOrig: float
    oldbalanceDest: float
    newbalanceDest: float
    nameDest: str
    step: Optional[int] = Field(None, description="hora de la tx; por defecto max_step+1 (ahora)")


@v1.get("/health", dependencies=[Depends(require_key)])
def health():
    m = ART["meta"]
    return {"status": "ok", "max_step": m["max_step"], "destinos_en_estado": m["n_dest_state"],
            "umbrales": m["thresholds"], "aviso": m["aviso"]}


@v1.post("/score", dependencies=[Depends(require_key)])
def score(tx: Tx):
    d = tx.model_dump()
    df = S.live_features(STATE, RECENT, ART["meta"], d)
    S.score_frame(ART, df)
    r = df.iloc[0]
    return {
        "prob": float(r["prob"]), "alert_level": str(r["alert_level"]),
        "maha_flag": bool(r["maha_flag"]), "red_flag": bool(r["red_flag"]),
        "score_maha": float(r["score_maha"]), "score_red": float(r["score_red"]),
        "destino_conocido": d["nameDest"] in STATE.index,
        "features": {k: float(r[k]) for k in ["errorOrig", "errorDest", "vaciaCuenta", "ratioMonto",
                                              "fan_in", "n_tx_dest", "burst"]},
    }


app.include_router(v1)


@app.get("/health")
def health_legacy():
    """Compatibilidad / liveness sin auth (solo estado, sin detalles)."""
    return {"status": "ok"}
