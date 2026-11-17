# Financial Fraud Detection Analytics

Sistema de **detección temprana de fraude** sobre el dataset PaySim. Calcula dos señales
estadísticas independientes (distancia de **Mahalanobis** + **novedad del destino** / grafo de
cuentas) y las combina con un **modelo de fusión** (regresión logística) que entrega una
**probabilidad de fraude por transacción**. Se expone en una **arquitectura orientada a servicios**:
modelo Python → API .NET → tablero web React, con alertas y una línea de tiempo de "cuándo hubo
que actuar".

> ⚠️ **Demo sobre datos sintéticos.** Las métricas altas (AUPRC ≈ 0.995) reflejan en gran parte un
> **artefacto del simulador PaySim**, no desempeño en datos reales. Sin ese atajo, las señales
> rinden AUPRC ≈ 0.19–0.27.

## Requisitos

Python 3.14 · .NET SDK 10 · Node.js 26. Además, descarga `paysim dataset.csv`
(ver [`planes/FUENTES.md`](planes/FUENTES.md)) y colócalo en `datos/paysim dataset.csv` (no se
versiona).

## Instalación y ejecución

```powershell
# 1) Modelo Python: entorno + artefactos + base de alertas
cd Model
py -m venv .venv
.\.venv\Scripts\python -m pip install -r requirements.txt
.\.venv\Scripts\python train_and_export.py   # -> Model/models/*.joblib
.\.venv\Scripts\python generate_alerts.py     # -> resultados/alertas.db
cd ..

# 2) Arrancar (2 terminales; la 3.ª es opcional para "Probar transacción")
cd api/FraudApi && dotnet run --urls http://localhost:5055       # API    :5055 (Swagger en /swagger)
cd web && npm install && npm run dev                             # Web    :5173
cd Model && .\.venv\Scripts\uvicorn service:app --port 8000         # Scoring :8000 (opcional)
```

Abre **http://localhost:5173**.

### Contrato entre servicios (SOA pragmática)

| Servicio         | Puerto | Rutas (versionadas)                                                                                                            | Auth                                                                                    |
| ---------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| Web (React)      | 5173   | SPA estática                                                                                                                  | -                                                                                       |
| API .NET         | 5055   | `/api/v1/{stats,alerts,alerts/{id},timeline,summary,score}`; `GET /health`, `GET /health/ready`; Swagger en `/swagger` | cabecera `X-API-Key` en `/api/v1/*` (401 si falta/no coincide); `/health` abierto |
| Scoring (Python) | 8000   | `GET /v1/health`, `POST /v1/score` (y `GET /health` abierto, solo liveness)                                              | cabecera `X-API-Key` (401)                                                            |

Flujo: web -> API .NET (`X-API-Key`) -> proxy a `{PythonServiceUrl}/v1/score` (la API reenvía su propia `ScoringApiKey`).

**Claves DEV (por defecto, idénticas en los 3 lados para que el demo arranque sin configurar):** `dev-key-change-me`.
Configurables con `SCORING_API_KEY` (Python), `ApiKey` y `ScoringApiKey` (API, `appsettings.json` o variables de entorno) y
`VITE_API_KEY` / `VITE_API_URL` (web, `.env`). **En producción deben cambiarse.** Ojo: una SPA no puede ocultar su key
(queda en el JS del navegador); esto es autenticación a nivel de demo, no seguridad real.

### Con Docker Compose

```powershell
# 1) Genera en el host los artefactos (el dataset y el entrenamiento NO van en las imágenes):
cd Model; .\.venv\Scripts\python train_and_export.py; .\.venv\Scripts\python generate_alerts.py; cd ..
# 2) Levanta scoring + api + web (monta Model/models y resultados/alertas.db en solo lectura):
docker compose up --build
# Web http://localhost:5173 · API http://localhost:5055 (health: /health, /health/ready) · scoring solo en red interna
```

Variables opcionales: `API_KEY`, `SCORING_API_KEY` (por defecto la clave DEV).

## Estructura

```
Model/      Servicio de modelo (Python): señales, fusión, scoring FastAPI
api/     Servicio de negocio (.NET): alertas, timeline, stats
web/     Cliente web (React + Vite): tablero + mini-curso "Aprende"
docs/    Documentación detallada (ver abajo)
planes/  Documentos de diseño · datos/ y resultados/ (no versionados)
```

## Documentación

- [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md) — arquitectura **orientada a servicios (SOA)** y
  por qué es la mejor opción.
- [`docs/PATRONES_DISENO.md`](docs/PATRONES_DISENO.md) — patrones de diseño de software usados.
- [`docs/NORMATIVAS.md`](docs/NORMATIVAS.md) — normas aplicadas (ISO 37003 / 27001 / 37001).
- [`docs/TEOREMAS.md`](docs/TEOREMAS.md) — teoremas y fundamento estadístico.

## Licencia y datos

Código bajo licencia **MIT** (ver [`LICENSE`](LICENSE)). **Los datasets no se incluyen** y
mantienen **sus propios términos** (PaySim y Credit Card Fraud son de Kaggle); revisa la licencia
original de cada uno antes de reutilizarlos.

> **Seguridad:** la API y el servicio de scoring **no tienen autenticación** (demo local). No los
> expongas en internet sin añadir autenticación y proteger los datos.
