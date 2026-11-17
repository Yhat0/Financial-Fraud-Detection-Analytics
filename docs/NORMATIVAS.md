# Normativas usadas

El proyecto se encuadra en normas internacionales de gestión, para dar **vocabulario estándar y
respaldo normativo** al sistema de detección. Es un **mapeo conceptual**, no una certificación.
Fuente ampliada: [`planes/MARCO_ISO37003.md`](../planes/MARCO_ISO37003.md).

---

## 1. ISO 37003:2025 — Sistemas de gestión del control del fraude (FCMS)

- **Qué es:** *Fraud control management systems — Guidance for organizations managing the risk of
  fraud.* Publicada el 29/05/2025 (comité ISO/TC 309). Es una norma de **orientación (guidance)**,
  **no certificable** por sí misma; ofrece buenas prácticas.
- **Los tres pilares del FCMS:** **Prevención**, **Detección temprana** y **Respuesta**.

> **Aquí vive el proyecto:** el pilar de **Detección temprana**. El objetivo declarado ("detectar
> la anomalía *antes* de que drene más dinero o se bloquee de más a un cliente") coincide
> literalmente con ese pilar.

### Mapeo proyecto ↔ ISO 37003

| Elemento de la norma | Cómo lo cubre el proyecto |
|----------------------|----------------------------|
| **Evaluación de riesgo de fraude** (4.5) | Se acota el riesgo al filtrar `TRANSFER`/`CASH_OUT` y al enfocar cuentas sospechosas (*parcial*: la evaluación formal es organizacional) |
| **Detección temprana** (pilar 2) | **Núcleo del proyecto:** señal de transacción (Mahalanobis) + señal de red, fusionadas para alertar pronto |
| **Enfoque basado en riesgo** | Priorización por *score*: alerta ALTA solo cuando el riesgo es mayor |
| **Analítica de datos como control** | Toda la aproximación estadística (χ², fan-in, fusión) |
| **Evaluación del desempeño** (cláusula 9) | AUPRC, split temporal, precisión/recall |
| **Respuesta** (pilar 3) | **Fuera de alcance técnico:** el modelo *alimenta* la decisión, no la ejecuta |
| **Política, roles, cultura** (cláusulas 5, 7) | **Fuera de alcance:** son medidas organizacionales |

---

## 2. ISO 27001:2022 — Seguridad de la información (SGSI)

- **Qué es:** sistema de gestión de la seguridad de la información (confidencialidad, integridad y
  disponibilidad). **Certificable**.
- **Relevancia:** es la **más relevante técnicamente** para este proyecto, porque consume datos
  transaccionales sensibles. Aplican sus controles de **control de acceso, integridad de datos,
  registro (logging) y gestión de incidentes**. Su **detección de anomalías** se solapa
  conceptualmente con nuestro sistema de detección.
- **En el código:** hoy la API y el servicio de scoring **no tienen autenticación** (es un demo
  local). Añadir autenticación, control de acceso y registro sería el camino para alinearse con
  ISO 27001 antes de un despliegue real (ver [ARQUITECTURA.md](ARQUITECTURA.md) §4 y el README).

---

## 3. ISO 37001:2025 — Sistemas de gestión antisoborno (ABMS)

- **Qué es:** gestiona **un subtipo de fraude: el soborno**. **Certificable**, con requisitos
  auditables estrictos.
- **Relevancia:** la **menos directa** — el soborno no es el fraude transaccional de PaySim. Se
  documenta como contexto de la **familia** de normas, por compartir el enfoque de gestión por
  riesgo.

---

## 4. Cómo se relacionan

Las tres comparten la **estructura armonizada ISO** (cláusulas 4–10), por lo que **se integran en
un único sistema de gestión**. Difieren en el alcance:

| Norma | Qué gestiona | Tipo | Rol frente al fraude |
|-------|--------------|------|----------------------|
| **ISO 37003:2025** | Riesgo de **fraude en general** | Guía (no certificable) | El paraguas: prevenir / detectar / responder |
| **ISO 37001:2025** | **Soborno** (subtipo) | Certificable | Primo especializado, requisitos estrictos |
| **ISO 27001:2022** | **Seguridad de la información** | Certificable | Cimiento técnico que protege datos y sistemas |

---

## 5. Posición del proyecto (en una frase)

> Este sistema implementa un **control de detección temprana basado en analítica de datos**
> (pilar 2 de ISO 37003:2025), enfocado por riesgo y evaluado con métricas adecuadas a eventos
> raros, que **se apoyaría en** los controles de ISO 27001 para que los datos y las alertas sean
> íntegros y confiables.

> **Honestidad:** el mapeo es **conceptual**, para estructurar y justificar el trabajo. No implica
> certificación ni auditoría de conformidad.
