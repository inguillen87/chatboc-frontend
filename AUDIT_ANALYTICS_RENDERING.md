# AUDIT_ANALYTICS_RENDERING

## Alcance
Auditoría frontend sobre la experiencia de render en `/admin/encuestas/:id/analytics` con foco en:
- montaje de charts (`ResponsiveContainer` / layout)
- lifecycle de mapas (`MapLibre` / provider alternativo)
- consistencia de UX en estados de carga, vacío y error
- impacto operativo en el flujo de demo-seeding vinculado a analytics

---

## Diagnóstico ejecutivo
El backend entrega datos suficientes (series, hotspots, coordenadas y módulos), pero la capa de presentación tenía fallas de lifecycle/layout que producían:
1. charts montados antes de tener dimensiones válidas,
2. mapas renderizados en contenedores ocultos o sin reflow,
3. señales de operación confusas durante inyección demo.

Resultado: percepción de “analytics roto” aun cuando hay datos disponibles.

---

## Hallazgos principales

### H1. Contenedores inestables en primer render
- Los gráficos podían intentar renderizar con dimensiones no finales (paneles/tabs con layout incompleto).
- Síntoma esperado: warnings de ancho/alto inválidos y placeholders inconsistentes.

### H2. Lifecycle de mapa insuficiente para cambios de visibilidad/tamaño
- Mapas no siempre recibían `resize()` cuando el panel cambiaba de estado visual.
- Síntoma esperado: canvas vacío o recorte incorrecto luego de navegación/resize/orientación.

### H3. Flujo “100 demo” con señal operativa incompleta
- El seed masivo vía endpoint público podía generar `409` por deduplicación.
- Sin separación clara entre duplicados y fallas reales, la UX quedaba ruidosa.

---

## Cambios frontend aplicados (estado actual)

### C1. Guardas de montaje para visuales pesados
- Se encapsuló render seguro en contenedores medidos (`ChartMount` / guardas de visibilidad) para evitar montar charts/maps en dimensiones inválidas.
- Objetivo: no renderizar componentes costosos hasta tener tamaño útil.

### C2. Reflow activo de MapLibre
- Se agregó ciclo de `map.resize()` ante:
  - cambios de tamaño observados (`ResizeObserver`),
  - recuperación de visibilidad (`visibilitychange`),
  - cambios de orientación (`orientationchange`),
  - sincronización con `requestAnimationFrame`.
- Objetivo: reducir estados de mapa en blanco por lifecycle/layout.

### C3. Seed demo más robusto en analytics
- Se prioriza endpoint admin bulk cuando existe `survey.id`.
- En fallback público, `409` se clasifica como `duplicates` (no falla dura).
- Se expone progreso y resumen en UI (`processed/success/duplicates/failures`).

### C4. Claridad de etiquetas ejecutivas
- Se reemplazan claves técnicas visibles por labels configurables backend-first con fallback genérico.

---

## Riesgos pendientes / gaps
1. **Estandarización global de charts**: aún no todo el frontend usa un único `MeasuredChartContainer` transversal.
2. **Gobernanza de tabs/paneles**: falta política uniforme de “render only when active” para todos los módulos visuales.
3. **Paridad de provider maps**: MapLibre está más robusto; conviene reforzar pruebas de fallback con Google provider en escenarios de ocultamiento.
4. **Observabilidad funcional**: falta tablero de métricas de frontend sobre eventos de render fallido/sin dimensiones.

---

## Plan recomendado (Frontend)

## P0 (inmediato)
- Consolidar wrapper único `MeasuredChartContainer` y migrar todos los `ResponsiveContainer` críticos.
- Aplicar guard de panel activo en todos los charts avanzados de analytics.
- Mantener seed progress UX como estándar para acciones masivas de analytics.

## P1 (próxima iteración)
- Unificar `MapShell` cross-provider (MapLibre/Google) con contrato de `ready`, `resize`, `fitBounds` y fallback visual único.
- Estandarizar estados visuales (`loading/empty/error`) en todas las cards de analytics.
- Añadir telemetría de render (`chart_mount_skipped`, `map_resize_applied`, `map_ready_timeout`).

---

## KPIs de aceptación (frontend)
1. Warnings de tamaño inválido en charts: **0** en vista analytics durante navegación normal.
2. Mapa visible con datos geográficos válidos tras cambios de tamaño/visibilidad.
3. Acción “100 demo” con feedback en vivo y resumen final sin ambigüedad entre duplicados y fallas.
4. Etiquetas ejecutivas sin claves técnicas crudas en superficie de UI.

---

## Evidencia mínima esperada para cierre
- Build productiva exitosa.
- Smoke en ruta `/admin/encuestas/:id/analytics`.
- Captura visual de analytics/mobile según alcance de iteración.
- Registro de consola sin warnings críticos de layout/render en la vista auditada.
