# ML - Deteccion temprana de fraude (PaySim)

Fase 1: preparacion de datos + Senal 1 (distancia de Mahalanobis). Probado con Python 3.14.5.

## Entorno
```powershell
cd Model
py -3.14 -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
```

## Ejecucion
```powershell
# smoke test (20% de TRANSFER+CASH_OUT, determinista)
.venv\Scripts\python run_signal1.py --sample-frac 0.2
# run completo (6.3M filas)
.venv\Scripts\python run_signal1.py
# covarianza robusta (MinCovDet sobre submuestra de 100k legitimas)
.venv\Scripts\python run_signal1.py --robust
```

Salidas en `../resultados/`: `senal1_metricas.json`, `senal1_deciles_test.csv`,
`senal1_deciles_train.csv`, `senal1_pr_curve_test.csv`, `senal1_pr_curve_test.png`,
`senal1_muestra_scores.csv`.

## Estructura
- `src/config.py`: rutas, columnas, random_state.
- `src/data_prep.py`: carga, filtro TRANSFER/CASH_OUT, orden por step, split temporal, features.
- `src/signal_mahalanobis.py`: mu/Sigma solo con legitimas-train, SPD/regularizacion, score, umbrales P99 y chi2.
- `src/evaluate.py`: AUPRC, cuartiles por clase, deciles, curva PR, JSON de metricas.

## Senal 2 (grafo de destinos)
```powershell
.venv\Scripts\python run_signal2.py            # run completo (~30 s)
.venv\Scripts\python run_signal2.py --sample-frac 0.1   # smoke test
```
Features causales por `nameDest` (solo pasado): fan_in, n_tx_dest, monto_total/medio/std, dest_sin_historial, burst (24 h).
Incluye aserciones anti-leakage. Salidas: `resultados/senal2_metricas.json` y `senal2_deciles_*.csv`.

## Nota sobre el split temporal (STEP_SPLIT=323)
El split (train step<=323, test step>323, ~70/30 de filas) es principalmente un mecanismo
ANTI-LEAKAGE para las features de grafo (agregados solo con el pasado), no una simulacion de
drift: en PaySim el fraude es casi estacionario y el volumen legitimo cae tras step~400.

## Fase 4A: capa Python de la app (DEMO sobre PaySim)
Modelo de fusion completo (AUPRC test 0.995). OJO: es un DEMO; el fraude de PaySim se detecta casi solo
por el artefacto de saldos (ver Fase 3.5), no es prueba cientifica de deteccion en datos reales.
```powershell
.venv\Scripts\python train_and_export.py   # entrena con TRAIN y guarda Model/models/*.joblib (~20 s)
.venv\Scripts\python generate_alerts.py    # puntua todo y crea ../resultados/alertas.db (SQLite, ~20 s)
.venv\Scripts\uvicorn service:app --port 8000   # servicio en vivo (desde Model/)
```
- `GET /health`; `POST /score` con JSON `{type, amount, oldbalanceOrg, newbalanceOrig, oldbalanceDest, newbalanceDest, nameDest, step?}`
  -> `{prob, alert_level (ALTA|MEDIA|NINGUNA), maha_flag, red_flag, score_maha, score_red, destino_conocido, features}`.
- Features de red en vivo: se leen del estado historico por nameDest (`models/dest_state.joblib`, a step 743);
  destino desconocido = nuevo (fan_in=0). `step` por defecto = max_step+1.
- `alertas.db`: tablas `alerts` (solo ALTA/MEDIA), `timeline` (por dia), `timeline_hourly` (por step), `summary` (scope, metric, value).
- Timestamp sintetico = 2024-01-01 00:00:00 + (step-1) horas. Umbrales ALTA/MEDIA: menor prob con precision>=0.95 / >=0.50 en TRAIN.

## Servicio de scoring: contrato v1 y API key
Rutas: `POST /v1/score` y `GET /v1/health`, ambas exigen la cabecera `X-API-Key` (401 si falta o no coincide).
`GET /health` queda abierto (solo `{"status":"ok"}`, liveness). Clave desde la variable de entorno `SCORING_API_KEY`
(por defecto la clave DEV `dev-key-change-me`; **cambiarla en producción**).
```powershell
.venv\Scripts\uvicorn service:app --port 8000
curl -H "X-API-Key: dev-key-change-me" http://localhost:8000/v1/health
```
Docker: `Model/Dockerfile` (usa `requirements-service.txt`; los modelos se montan en `/app/Model/models`).
