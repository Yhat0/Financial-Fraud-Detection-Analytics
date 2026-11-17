# Tablero web (React + Vite + TypeScript)

```powershell
npm install
npm run dev      # http://localhost:5173
npm run build    # salida en dist/
```

Variables (`.env`, ver `.env.example`): `VITE_API_URL` (por defecto `http://localhost:5055/api/v1`) y `VITE_API_KEY`
(por defecto la clave DEV `dev-key-change-me`, enviada como `X-API-Key`). Una SPA no puede ocultar su key: nivel demo.
Docker: `web/Dockerfile` (build estático servido con nginx; `VITE_*` se hornean en build).
