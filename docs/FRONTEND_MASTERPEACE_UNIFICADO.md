# Frontend Masterpiece Unificado — Chatboc Enterprise

Este es el **documento único** para frontend con:
1) lo que backend **ya dejó listo**,
2) lo que frontend **debería cerrar ahora**,
3) lo que queda **por fases** del Plan Maestro.

> Objetivo: ejecutar sin fricción FE/BE en modo SaaS multi-tenant (municipios + empresas), con foco en seguridad, operación y conversión comercial.

---

## 1) Estado actual que ya podés pasar al frontend (backend listo)

### 1.1 Seguridad multi-tenant y RBAC (base operativa)
- Endpoints enterprise con scope por tenant.
- Enforzamiento de acceso por rol/tenant en módulos admin.
- Denegación explícita de cruce de tenant (`403`).

### 1.2 Demo y onboarding
- `POST /auth/demo` disponible para entrada demo por rubro.
- Respuesta con `demo_mode` para condicionar UX (acciones sensibles, badges, etc.).
- Seguridad: el backend usa usuarios demo **aislados** por tenant (no reutiliza owner/admin real), útil para auditoría y trazabilidad en demos.

### 1.3 Analytics enterprise
- `POST /analytics/event`
- `GET /admin/analytics/overview (alias: /api/admin/analytics/overview)`
- `GET /admin/analytics/heatmap (alias: /api/admin/analytics/heatmap)`
- `GET /admin/analytics/export.csv (alias: /api/admin/analytics/export.csv)`
- `GET /admin/analytics/export.pdf (alias: /api/admin/analytics/export.pdf)`

### 1.4 IA enterprise
- `POST /admin/ai/executive-summary`
- `POST /admin/tickets/<ticket_id>/ai-summary`
- `POST /admin/ai/product-recommendations`
- `POST /admin/ai/order-draft-from-document`

### 1.5 Bot IA personalizable por tenant
- `GET /admin/bot/settings?tenant_id=<id>` (alias: `/api/admin/bot/settings`)
- `PUT /admin/bot/settings` (alias: `/api/admin/bot/settings`)
- Persistencia en `TenantProfile.configuracion.bot_settings`.
- Compatibilidad legacy: `branding.logo_url` sincroniza con `TenantProfile.logo_url`.

### 1.6 Checkout / MercadoPago / puntos
- Integración MP por tenant (incluye flujo admin y validación).
- Checkout monetario requiere token MP del tenant (sin fallback global).
- Webhook tenant-aware.
- Guardrails de puntos y resolución de tenant más estricta.
- Demo-mode para evitar efectos reales en entornos de prueba.

### 1.7 Catálogo avanzado y personalización de producto
- Backend expone `personalization_options` en productos de catálogo cuando existen en `extra_metadata`.
- Admin puede actualizar `personalization_options` via `PATCH /api/admin/tenants/<slug>/catalog/items/<item_id>`.
- Tipos soportados: `text`, `select`, `multiselect`, `number`, `boolean`.
- Cada opción puede incluir `required`, `values[]`, `max_length`, `max_select`, `help_text` y `price_delta` por valor.

---

## 2) Qué debe hacer frontend YA (plan de ejecución inmediato)

## Sprint FE-A (impacto comercial directo)
1. **Demo entry completo**
   - Botón “Probar Demo” en login/landing.
   - Selector de rubro.
   - Persistencia de sesión/token + tenant context.
2. **Banner de entorno demo**
   - Badge visible global “Modo Demo”.
   - Bloqueo/aviso de operaciones sensibles.
3. **Analytics dashboard productivo**
   - KPIs/cards con `/admin/analytics/overview`.
   - Heatmap temporal/geográfico con `/admin/analytics/heatmap`.
   - Export CSV/PDF conectado.
4. **Tracking base**
   - Emitir `dashboard_view`, `tab_click`, `export_click` a `/analytics/event`.

## Sprint FE-B (valor IA visible)
1. **Resumen ejecutivo IA** en vista Analytics.
2. **Resumen IA de ticket** en detalle operativo.
3. **Bloque recomendaciones** en catálogo/comercial.
4. **OCR draft de pedido**
   - Upload PDF/imagen,
   - tabla editable,
   - diferenciación matched/unmatched.

## Sprint FE-C (calidad enterprise)
1. Error boundaries por módulo crítico.
2. Estados `loading/empty/error/retry` homogéneos.
3. Toasts y mensajes de error normalizados (`400/403/404/500`).
4. Smoke tests FE mínimos de flujos críticos.


## 2.7 Portal UX de referencia (implementación frontend)

### Cards sugeridas para Home del portal
- **Mi actividad**: resumen de `summary.counts` (`orders`, `claims`, `surveys`, `suggestions`).
- **Mis puntos**: saldo actual + `summary.points_breakdown`.
- **Seguimiento de pedidos**: últimos `orders[]` usando `tracking.stage` + `tracking.eta`.
- **Novedades de mi red**: `network/feed` (tenant actual + tenants seguidos).

### Contrato sugerido para Timeline unificado
Normalizar visualmente `timeline[]` por `type`:
- `order`: badge por estado (`pending/preparing/shipped/delivered/cancelled`)
- `claim`: badge por estado del reclamo
- `points`: badge `earned/redeemed` + color por signo de `delta`
- `survey`: badge `submitted`
- `suggestion`: badge por `estado` (`nueva/revisada/implementada`)

### Ejemplo de payload (`GET /history`)
```json
{
  "summary": {
    "counts": {"orders": 3, "claims": 2, "surveys": 1, "suggestions": 1, "points_movements": 7},
    "points_breakdown": {
      "compras": 120,
      "encuestas": 50,
      "votaciones": 0,
      "sugerencias": 30,
      "reclamos": 20,
      "canjes": -70,
      "participacion": 0,
      "otros": 0
    }
  },
  "timeline": [
    {"type": "order", "status": "shipped", "at": "2026-02-14T12:00:00+00:00"},
    {"type": "points", "status": "earned", "at": "2026-02-14T11:30:00+00:00"},
    {"type": "suggestion", "status": "nueva", "at": "2026-02-13T18:00:00+00:00"}
  ]
}
```

### Ejemplo de payload (`GET /network/feed`)
```json
{
  "items": [
    {
      "id": 101,
      "type": "news",
      "title": "Nueva obra de pavimentación",
      "date": "2026-02-14T10:00:00+00:00",
      "tenant": {"slug": "mi-ciudad", "name": "Municipio X", "tipo": "municipio"},
      "link": "/mi-ciudad/noticias/101"
    }
  ],
  "tenants": [
    {"slug": "mi-ciudad", "name": "Municipio X", "tipo": "municipio"},
    {"slug": "pyme-favorita", "name": "Pyme Favorita", "tipo": "pyme"}
  ]
}
```

---

## 3) Contratos clave que frontend debe respetar

### 3.1 Contexto tenant obligatorio
Crear `tenantContext` global:
```ts
{
  tenantId: number;
  tenantSlug?: string;
  demoMode?: boolean;
}
```
Y enviar `tenant_id` explícito en endpoints admin enterprise.

### 3.2 Manejo de errores estándar
- `400`: input inválido → mensaje accionable.
- `403`: sin permiso/scope tenant → redirigir a contexto/tenant selector.
- `404`: recurso no encontrado/no resoluble → empty state.
- `500`: error genérico + retry.

### 3.3 Bot settings (nuevo)
Pantalla “Personalización Bot” con:
- Nombre bot,
- Tono,
- System prompt,
- Fallback behavior (`derivar_humano|auto_reply|silent`),
- Branding (`logo_url`, `primary_color`, `secondary_color`).

Validaciones FE recomendadas:
- impedir campos desconocidos,
- longitudes razonables,
- feedback inmediato si `fallback_behavior` inválido.

---

## 4) Matriz pantalla → endpoint (para implementación rápida)

### Auth / demo
- Demo login: `POST /auth/demo`

### Analytics
- KPIs: `GET /admin/analytics/overview (alias: /api/admin/analytics/overview)`
- Heatmap: `GET /admin/analytics/heatmap (alias: /api/admin/analytics/heatmap)`
- Export CSV: `GET /admin/analytics/export.csv (alias: /api/admin/analytics/export.csv)`
- Export PDF: `GET /admin/analytics/export.pdf (alias: /api/admin/analytics/export.pdf)`
- Tracking FE: `POST /analytics/event`

### Portal usuario (historial, tracking y fidelización)
- `GET /api/v1/portal/<tenant_slug>/orders` incluye `status_label`, `tracking.stage`, `tracking.eta` y `tracking.latest_event`.
- `GET /api/v1/portal/<tenant_slug>/orders/<order_id>` devuelve detalle con `tracking.timeline` y `items[]`.
- `GET /api/v1/portal/<tenant_slug>/history` expone historial unificado (`claims`, `orders`, `points`, `surveys`, `suggestions`, `timeline`) e incluye `summary.counts` + `summary.points_breakdown`.
- `GET /api/v1/portal/<tenant_slug>/network/feed` devuelve noticias/eventos del tenant actual + tenants seguidos por el usuario.
- `GET /api/v1/portal/<tenant_slug>/benefits` entrega beneficios canjeables + elegibilidad por puntos.
- `POST /api/v1/portal/<tenant_slug>/redeem` registra canje real (débito de puntos + metadata).
- `GET /api/v1/portal/<tenant_slug>/redeems` devuelve historial de canjes realizados.

### IA
- Resumen ejecutivo: `POST /admin/ai/executive-summary`
- Resumen ticket: `POST /admin/tickets/<ticket_id>/ai-summary`
- Recomendaciones: `POST /admin/ai/product-recommendations`
- OCR pedido: `POST /admin/ai/order-draft-from-document`
- Config bot: `GET/PUT /admin/bot/settings`

---

## 5) Qué ya está cubierto vs qué falta (checklist operativo)

### Backend: listo
- [x] Endpoints enterprise de analytics.
- [x] Endpoints IA admin.
- [x] Bot settings por tenant.
- [x] Tracking ingest endpoint.
- [x] Flujo demo backend.
- [x] Hardening tenant en pagos/puntos.

### Frontend: por cerrar
- [ ] Integración demo end-to-end + UX demo.
- [ ] Dashboard analytics completo (incluye exportables).
- [ ] Módulos IA visibles en UI de negocio.
- [ ] Pantalla de personalización de bot tenant.
- [ ] Manejo de errores enterprise consistente.
- [ ] Smoke tests FE automatizados.

---

## 6) Roadmap FE alineado al Plan Maestro

### Fase 0 (hardening)
- Asegurar scope tenant en toda request admin.
- Guardrails de auth y contexto persistente en navegación.

### Fase 1 (quick wins)
- Demo comercial impecable.
- Analytics + IA listos para mostrar valor.
- Personalización de bot y branding tenant.

### Fase 2 (operación)
- UX tickets avanzada (kanban/filtros/estado).
- Encuestas + puntos en experiencia de panel.

### Fase 3 (escala/IA avanzada)
- Flujos asistidos con OCR + recomendaciones evolucionadas.
- Asistente analítico para admins.

---

## 7) Definición de “listo para ventas enterprise”

Se considera listo cuando frontend cumpla:
1. Demo funcional end-to-end sin fricciones.
2. Dashboard con KPIs + heatmap + exportables.
3. Módulos IA visibles y operables.
4. Configuración de bot por tenant usable por negocio.
5. Sin fugas de contexto tenant en UX.
6. Manejo robusto de errores y estados vacíos.

---

## 8) Mensaje corto para pasar al equipo frontend

> “Backend enterprise ya está listo para demo, analytics, IA admin y personalización del bot por tenant. Priorizamos en frontend: demo entry + dashboard + features IA + pantalla de bot settings + hardening de errores/scope tenant. Con eso cerramos el paquete comercial enterprise de punta a punta.”


## 9) Bloque final para pasar al frontend (portal usuario)

Implementar en este orden:
1. **Home portal** con 4 widgets: actividad, puntos, pedidos, red de noticias.
2. **Timeline unificado** consumiendo `GET /api/v1/portal/<tenant_slug>/history`.
3. **Feed transversal** consumiendo `GET /api/v1/portal/<tenant_slug>/network/feed`.
4. **Canjes** (`benefits`, `redeem`, `redeems`) con feedback inmediato de saldo.

Criterio de calidad UX:
- estados vacíos elegantes,
- skeletons de carga,
- filtros por tipo en timeline,
- consistencia visual de badges de estado.
