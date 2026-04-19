# Auditoría integral Frontend + Backend (Encuestas, Demo Login, Analíticas y Geoespacial)

> Fecha: 2026-02-24  
> Alcance: flujo público `/e/:slug`, login demo `/auth/demo/catalog`, tablero admin `/admin/encuestas/:id/analytics`.

## 1) Diagnóstico de lo observado

## 1.1 Login Demo y autenticación
- Se observan errores intermitentes `502` en:
  - `GET /api/auth/demo/catalog`
  - `GET /api/app/me/tenants?...`
  - `POST /api/auth/admin/login?...`
- Conclusión: hay inestabilidad real del backend/proxy. El frontend debe degradar bien sin bloquear UX (botón demo activo + fallback de catálogo).

## 1.2 Encuesta pública (`/e/movilidad-y-transporte-junin`)
- En capturas y consola aparecen `403` para:
  - `/api/public/encuestas/:slug`
  - `/public/encuestas/:slug`
- Conclusión: hay casos donde ambas rutas públicas deniegan acceso (estado/ventana/permisos backend), por lo que frontend debe mostrar estado claro y acción de recuperación orientada a negocio (publicar/activar ventana en admin).

## 1.3 Dashboard analítico admin
- Logs backend muestran llamadas repetidas y pesadas sobre bbox:
  - `resumen`, `series`, `heatmap`, `dashboard` repetidas en ráfaga.
- Conclusión: el filtro por bbox se estaba enviando demasiado frecuente al mover/ajustar mapa.

## 1.4 Warnings de charts (Recharts)
- Consola: `The width(-1) and height(-1) of chart should be greater than 0` repetido.
- Conclusión: algunos contenedores responsive arrancan con dimensiones inválidas durante recalculado/layout.

## 1.5 Socket global
- Consola muestra `Global Socket connected/disconnected` en escenarios donde no aporta valor.
- Conclusión: hay rutas tenant-scoped que no estaban siendo detectadas por el bloqueador de socket global.

---

## 2) Cambios realizados en este ciclo

## 2.1 Menos ruido/carga por bbox (debounce)
- Se implementó debounce (350ms) al propagar cambios de bbox desde el mapa en analytics.
- Se limpian timers al desmontar componente.
- Beneficio: menos ráfagas de requests y menor presión en backend al pan/zoom del mapa.

## 2.2 Estabilidad de gráficos responsive
- Se agregaron `minWidth`/`minHeight` en `ResponsiveContainer` para evitar tamaños negativos al montar/reflow.
- Beneficio: reduce warnings de Recharts y mejora estabilidad visual.

## 2.3 Socket global: bloqueo robusto en rutas con tenant prefijado
- Se extendió la detección de rutas bloqueadas (`/admin/encuestas`, `/e`, `/encuestas`, etc.) para rutas con prefijo de tenant (ej. `/:tenant/admin/encuestas/...`).
- Beneficio: menos reconexiones/log spam en vistas donde no es necesario socket global.

---

## 3) Handoff claro para Frontend (cerrado para Stage 4)

## 3.1 Contrato único recomendado
Usar como endpoint principal:
- `GET /admin/encuestas/:id/analytics/dashboard`

Y tomar desde allí:
- `executive_summary.headline`
- `executive_summary.one_liner`
- `executive_summary.focus_points[]`
- `modules.summary`
- `modules.timeseries`
- `modules.heatmap`
- `modules.alerts`
- `modules.brief`
- `visual_blueprint` como contrato de render backend-driven

## 3.2 Fallback controlado
Si falla `dashboard`, recién ahí usar:
- `resumen`, `series`, `heatmap`, `alerts`, `brief` por separado.

## 3.3 Reglas UX de error (ventas/demo)
- Si `/auth/demo/catalog` falla: mantener CTA demo operativa con defaults.
- Si encuesta pública responde `403`: mostrar panel explicando que la encuesta no está activa para público y CTA de gestión (admin).

### Estado de cierre (2026-04-18)
- ✅ Contratos Stage4 documentados y versionados en `docs/frontend.stage4.handoff.md` y `docs/frontend.stage4.payload_examples.md`.
- ✅ Demo mode OFF definido con 404 contractado (`auth.demo.v1`).
- ✅ Identidad omnicanal (`X-Contact-Key`, `X-Conversation-Id`) consolidada en handoff/contratos.
- ✅ Coverage/funnel/event schema definidos como base FE para dashboards.

---

## 4) Handoff claro para Backend

1. **Reducir 502 intermitentes** en `auth/demo/catalog`, `app/me/tenants`, `auth/admin/login` (proxy/upstream).
2. **Confirmar política de 403 en pública**:
   - publicar/estado
   - ventana temporal
   - tenant/slug mapping
3. **Opcional fuerte**: devolver en 403 público un payload explícito de causa (`reason_code`) para UX.
4. **Optimización**: soportar `If-None-Match`/ETag para `dashboard` pesado si bbox no cambia materialmente.

---

## 5) Roadmap proactivo “nivel consultora” (siguiente sprint)

## Fase A (rápida, alto impacto)
- Priorizar carga del bloque ejecutivo (skeleton + first meaningful paint).
- Reducir consultas duplicadas: estrategia dashboard-first + fallback lazy.
- Estado vacío profesional por módulo (heatmap/charts/segmentación).

## Fase B (comercial)
- Vista “Executive mode” (solo resumen, alertas, focos, recomendación).
- Vista “Analyst mode” (detalle técnico completo).
- Puntuación de salud de encuesta (adopción, cobertura geo, ritmo, riesgo calidad).

## Fase C (avanzada)
- Capas geoespaciales enriquecidas (clusters, hexbin, hotspots temporales).
- Explainability en anomalías (por qué sube riesgo, qué variable pesa más).
- Storytelling automático para presentación comercial (resumen en 60s, 3 diapositivas exportables).

---

## 6) Checklist de validación post-deploy

- [ ] Login demo disponible aunque falle catálogo.
- [ ] Sin warnings masivos `width(-1)/height(-1)` en analytics.
- [ ] Menos llamadas por bbox al mover mapa.
- [ ] Sin reconexión de socket global en `/:tenant/admin/encuestas/*`.
- [ ] `dashboard` usable como fuente principal sin romper fallback.



## 7) Lectura puntual de las capturas enviadas

1. **Captura pública `/e/movilidad-y-transporte-junin`**
   - El frontend muestra error controlado de permisos, pero la consola confirma que ambos paths (`/api/public/...` y `/public/...`) devuelven 403.
   - Acción: mantener mensaje de estado y sumar `reason_code` backend para diagnóstico comercial.

2. **Capturas analytics con consola abierta**
   - Se observa warning reiterado de Recharts por dimensiones inválidas y reconexiones de socket global.
   - Acción aplicada: guardas de dimensiones mínimas + bloqueo de socket en rutas tenant-scoped de encuestas.

3. **Captura con valores huérfanos (`:24`, `:bajo`)**
   - Señal de labels backend ausentes renderizados con interpolación fija `label: value`.
   - Acción aplicada: render condicional de métricas para no mostrar prefijos vacíos.

4. **Captura “Últimas respuestas” vacía con 100 respuestas arriba**
   - Inconsistencia de percepción entre agregados y detalle reciente.
   - Acción aplicada: mensaje específico cuando hay total>0 pero aún no cargó el detalle.

5. **Captura mapa sin geometría visible**
   - El bloque puede quedar visualmente vacío aun con estado de filtro activo.
   - Acción recomendada: fallback explícito “sin geometría compatible” y tabla top puntos (ya disponible en el dashboard actual).
