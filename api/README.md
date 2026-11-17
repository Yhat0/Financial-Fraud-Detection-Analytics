# API .NET (FraudApi)

ASP.NET Core (.NET 10, Minimal APIs, Microsoft.Data.Sqlite). Lee `resultados/alertas.db` en solo lectura y hace de proxy
al servicio de scoring Python.

```powershell
cd FraudApi
dotnet run --urls http://localhost:5055     # Swagger: http://localhost:5055/swagger
```

## Contrato v1
- Datos (requieren `X-API-Key`, 401 si falta/no coincide): `GET /api/v1/stats`, `/alerts`, `/alerts/{id}`, `/timeline[?granularity=hourly]`,
  `/summary`; `POST /api/v1/score` (proxy a `{PythonServiceUrl}/v1/score`, 503 si el scoring no responde).
- Health (sin auth): `GET /health` (estado + si existe la DB) y `GET /health/ready` (comprueba la DB y que el scoring responda; 503 si no).
- Config (`appsettings.json` o variables de entorno, p. ej. `ApiKey`): `AlertsDbPath`, `PythonServiceUrl`, `ApiKey`, `ScoringApiKey`, `CorsOrigins`.
- Claves DEV por defecto: `dev-key-change-me` (iguales en Python y web). **Cambiarlas en producción**; una SPA no puede ocultar su key.
- Docker: `api/Dockerfile` (la DB se monta en `/data/alertas.db`).
