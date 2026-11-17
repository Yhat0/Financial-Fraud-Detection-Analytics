# Patrones de diseño de software

Patrones **realmente presentes** en el código (no una lista aspiracional). Cada uno cita dónde
se ve y distingue lo que es GoF "de manual" de lo que está "en espíritu". Para la arquitectura
general (SOA), ver [ARQUITECTURA.md](ARQUITECTURA.md).

---

## 1. Catálogo GoF por categoría

### Creacionales

| Patrón | Dónde | Cómo se usa |
|--------|-------|-------------|
| **Singleton** | `AddSingleton(new AlertRepository(...))` [`Program.cs:11`](../api/FraudApi/Program.cs); `ART`/`STATE`/`RECENT` a nivel de módulo en [`service.py:15`](../Model/service.py) | Una única instancia compartida del repositorio / de los artefactos del modelo |
| **Factory Method** | `AddHttpClient("scoring", …)` y `f.CreateClient("scoring")` [`Program.cs:12,95`](../api/FraudApi/Program.cs) | La fábrica (`IHttpClientFactory`) crea el cliente HTTP configurado |
| **Builder** | `SqliteConnectionStringBuilder{…}` [`AlertRepository.cs:15`](../api/FraudApi/AlertRepository.cs); `WebApplication.CreateBuilder` [`Program.cs:7`](../api/FraudApi/Program.cs) | Construcción paso a paso de la cadena de conexión / la app |

### Estructurales

| Patrón | Dónde | Cómo se usa |
|--------|-------|-------------|
| **Proxy** (remoto) | `POST /api/score` [`Program.cs:80`](../api/FraudApi/Program.cs) | La .NET es un sustituto local del Servicio de Scoring |
| **Adapter** | `Map(SqliteDataReader) → AlertDto` [`AlertRepository.cs:26`](../api/FraudApi/AlertRepository.cs); adaptación camelCase → snake_case al llamar a Python [`Program.cs:87`](../api/FraudApi/Program.cs) | Traducir entre dos representaciones incompatibles |
| **Facade** | objeto `api` en [`api.ts:64`](../web/src/api.ts); `scoring.py` y los `run_*.py` sobre el pipeline | Interfaz simple que oculta complejidad (fetch/URLs/errores, o el pipeline ML) |

### De comportamiento

| Patrón | Dónde | Cómo se usa |
|--------|-------|-------------|
| **Observer** | `IntersectionObserver` [`Learn.tsx:15,23`](../web/src/components/Learn.tsx) | Observa el scroll para resaltar la lección activa y revelar lecciones |
| **Strategy** | `order = sort switch {…}` [`AlertRepository.cs:53`](../api/FraudApi/AlertRepository.cs); regla de coincidencia vs logística de fusión en [`fusion.py`](../Model/src/fusion.py) | Algoritmo intercambiable elegido en runtime (orden; forma de puntuar) |
| **Template Method** *(en espíritu)* | pares `fit_*` / `apply_*` en [`scoring.py`](../Model/src/scoring.py) | Mismo esqueleto: ajustar con train → aplicar a cualquier conjunto |

---

## 2. Patrones de nivel empresa (Fowler PoEAA / afines)

| Patrón | Dónde |
|--------|-------|
| **Repository** | [`AlertRepository.cs`](../api/FraudApi/AlertRepository.cs) — acceso a datos encapsulado, solo lectura |
| **Data Transfer Object (DTO)** | records en [`Models.cs`](../api/FraudApi/Models.cs); interfaces en [`api.ts`](../web/src/api.ts) |
| **Dependency Injection / IoC** | contenedor de servicios de ASP.NET ([`Program.cs`](../api/FraudApi/Program.cs)) |
| **Gateway** | objeto `api` en [`api.ts`](../web/src/api.ts) — puerta única al backend |
| **Pipes & Filters / Pipeline** | flujo `data_prep → signal_* → fusion → evaluate` en `Model/src/` |
| **Custom Hook** (React) | `useAsync` en [`ui.tsx:5`](../web/src/components/ui.tsx) — lógica de datos reutilizable |

---

## 3. Patrones por capa (resumen)

### Capa `Model/` (Python)
Configuración centralizada ([`config.py`](../Model/src/config.py)), **pipeline por etapas**,
**estimador fit/apply** (estilo scikit-learn), artefacto serializado (joblib), scripts
orquestadores, validación con Pydantic ([`service.py`](../Model/service.py)), carga única al arranque,
y el algoritmo **Union-Find** para episodios ([`fusion.py`](../Model/src/fusion.py)). Invariantes:
**anti-*leakage*** (ajuste solo con train) y **determinismo** (`RANDOM_STATE`).

### Capa `api/` (.NET)
Arquitectura por capas (endpoints → repositorio → DTOs), **Repository**, **DI**, **DTOs con
records**, genérico `PagedResult<T>`, Minimal APIs, Options/config, **Named HttpClient + Proxy**,
consultas parametrizadas y **degradación elegante** (`NoDb → 503`).

### Capa `web/` (React)
Componentes, **custom hook `useAsync`** (carga/error + anti-carrera), **cliente API tipado**
(Gateway), normalización de errores (`ApiError`), componentes presentacionales reutilizables y
**UI dirigida por datos** (array `TABS`).

---

## 4. Patrones transversales

- **Contrato explícito entre lenguajes:** DTOs en espejo (records C# ↔ interfaces TS ↔ dicts
  Python), JSON camelCase fijado en el servidor.
- **Separación batch/online (CQRS-lite):** lectura precalculada (`alertas.db`) vs cómputo en vivo.
- **Degradación elegante en cada frontera:** API caída (web), DB ausente (API → 503), servicio de
  scoring caído (API → 503).
- **Reproducibilidad y honestidad:** determinismo; el aviso del artefacto de PaySim se propaga del
  código a la UI.

---

## 5. Qué **no** se usó (honestidad)

Muchos patrones GoF clásicos **no aplican** a este alcance y por eso no están: *Decorator, Command,
State, Visitor, Composite, Chain of Responsibility, Mediator, Flyweight, Prototype*. La
serialización con `joblib` **no** es *Memento* (es persistencia simple). La capa `Model/` es en su
mayoría **funcional/procedural** (funciones puras + diccionarios), no orientada a objetos, así que
ahí casi no hay patrones GoF **por diseño**, no por descuido.
