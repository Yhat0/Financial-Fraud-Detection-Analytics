# Teoremas y fundamento estadístico

El diseño busca que los **umbrales y decisiones salgan de teoremas**, no de ajustes "a ojo". Aquí
se listan todos los teoremas considerados, con su idea simple, para qué sirven y su **estado real
en el proyecto**: *Aplicado* (está en el código), *Fundamento* (sustenta decisiones, sin cálculo
explícito) o *No usado* (documentado para saber por qué se descartó). Fuente ampliada:
[`planes/PLAN_MAESTRO_2-4.md`](../planes/PLAN_MAESTRO_2-4.md) §0.5.

---

## 1. Sustentan la Señal 1 (Mahalanobis)

### A1 — Mahalanobis² ∼ Chi-cuadrado (χ²) / Hotelling's T²  · **Aplicado** ✅
Bajo normalidad multivariada, el **cuadrado** de la distancia de Mahalanobis sigue una χ² con `k`
grados de libertad (`k` = nº de variables). Permite un umbral **con fundamento**: *alarma si
`d² > χ²₀.₉₉,k`*, en vez de un percentil arbitrario.
**En el código:** [`signal_mahalanobis.py`](../Model/src/signal_mahalanobis.py) calcula
`chi2.ppf(0.99, 7)` y lo compara con el percentil 99 empírico. *Hallazgo:* la nube legítima no es
gaussiana (más legítimas de lo esperado superan el umbral), así que el P99 empírico resultó más
fiable — justo lo que motiva el teorema A4.

### A2 — Teorema Central del Límite (TCL) · **Fundamento**
Sumas/promedios de muchas variables tienden a una normal. Es la justificación de fondo de
Mahalanobis (asume nube gaussiana). *Advertencia:* los montos crudos no son normales → de ahí la
transformación `log1p` antes de estandarizar.

### A3 — Desigualdad de Chebyshev (y Markov) · **No usado** (plan B)
Cota **sin supuesto de distribución**: a lo sumo `1/t²` de los datos está a más de `t`
desviaciones. Era el plan B de umbral si χ² no aplicaba; no se usó.

### A4 — Teoría de Valores Extremos (EVT): Fisher–Tippett–Gnedenko y Pickands–Balkema–de Haan · **Fundamento** (planeado)
En vez de modelar "lo normal", modela **la cola** directamente: los excesos sobre un umbral alto
convergen a una **Distribución de Pareto Generalizada (GPD)**. Permite umbrales del tipo "esto es
extremo con probabilidad p" de forma principista. *Estado:* es la mejora futura para fijar
umbrales (el código de hoy compara χ² vs P99; EVT/POT no está implementado).

---

## 2. Sustentan la decisión / la fusión

### B1 — Lema de Neyman–Pearson · **Fundamento** (parcial)
Para un nivel fijo de falsas alarmas, el test de razón de verosimilitud es **el más potente**
(máximo recall). Es la teoría del trade-off "dejar pasar fraude" vs "molestar clientes".
**Reflejado en:** los umbrales de alerta se eligen por **precisión objetivo** (ALTA con
precisión ≥ 0.95 en train) — un punto de operación, no un corte arbitrario. El test NP completo no
se implementa.

### B2 — Teorema de Bayes + falacia de la tasa base · **Fundamento**
Con fraude al ~0.13%, aunque el test sea bueno, muchas alarmas pueden ser falsas solo por la
rareza. Formaliza **por qué NO usamos accuracy** y por qué priorizamos precisión/AUPRC. Guía toda
la evaluación ([`evaluate.py`](../Model/src/evaluate.py)).

### B3 — Control de FDR: Benjamini–Hochberg · **No usado**
Controla la proporción de falsas alarmas al evaluar miles de casos a la vez. Útil para no saturar
a un equipo de revisión; no se implementó.

---

## 3. Sustentan la Señal 2 (red / grafo)

### B4 — Leyes de potencia / Pareto (cola pesada en grados de red) · **Fundamento / explorado**
El grado de entrada (fan-in) en redes de transacciones suele seguir una **ley de potencia**.
**En el proyecto:** se analizó la tasa de fraude por decil de `fan_in`. *Hallazgo:* aunque la
distribución de fan-in es de cola pesada, **el fraude NO se concentra en la cola** (va a destinos
nuevos). La hipótesis de "mula" se refutó.

### B5 — Teoría espectral de grafos / PageRank (Perron–Frobenius) · **No usado**
Garantiza un vector propio dominante positivo → base de PageRank para rankear cuentas. Era la
versión escalable del grafo; no se implementó.

### B6 — Ley de los Grandes Números · **Fundamento**
Las estadísticas por destino se **estabilizan** con suficiente historia; por eso se desconfía de un
destino con pocas transacciones (feature `dest_sin_historial`).

---

## 4. Mención honesta (documentados para saber por qué NO se usan)

### C1 — Ley de Benford (primer dígito) · **No usado**
Potente en fraude **contable**, pero débil sobre montos de transacciones sueltas y menos aún en
PaySim (sintético).

### C2 — Maldición de la dimensionalidad / concentración de la medida · **Guía de diseño**
En muchas dimensiones las distancias se parecen y Σ se estima mal. Por eso Mahalanobis usa **solo
~7 variables**, no decenas.

---

## 5. Resumen

| Teorema | Para qué | Estado |
|---------|----------|--------|
| A1 χ² / Hotelling T² | Umbral con fundamento para Mahalanobis | **Aplicado** |
| A2 TCL | Justifica Mahalanobis + transformación log | Fundamento |
| A3 Chebyshev | Umbral sin asumir normalidad | No usado |
| A4 EVT / GPD | Umbrales de cola, principistas | Fundamento (planeado) |
| B1 Neyman–Pearson | Punto de corte óptimo | Fundamento (parcial) |
| B2 Bayes / tasa base | Por qué AUPRC y no accuracy | Fundamento |
| B3 Benjamini–Hochberg | Control de falsas alarmas | No usado |
| B4 Ley de potencia | Cola pesada del fan-in | Explorado (refutado) |
| B5 PageRank / Perron–Frobenius | Rankear cuentas mula | No usado |
| B6 Ley de los Grandes Números | Desconfiar de poca historia | Fundamento |
| C1 Benford | (descartado) | No usado |
| C2 Maldición de dimensionalidad | Limitar a ~7 variables | Guía |
