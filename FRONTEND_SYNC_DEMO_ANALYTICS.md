# Frontend Contract — Encuestas Pro (Public + Admin + Live)

Última actualización backend: 2026-02-24

Este documento es el contrato operativo para que el frontend quede sincronizado con backend en demo, analytics y encuestas sin pantallas blancas.

## 1) Demo Login (sector-first)

### Catalog
`GET /api/auth/demo/catalog`

Campos críticos:
- `frontend_contract_version`
- `onboarding.default_sector`
- `onboarding.sector_options[]`
- `frontend.demo_selector`
- `frontend.preload_before_login[]`

### Demo login
`POST /api/auth/demo`

Payloads sugeridos:
- Gobierno: `{ "sector": "gobierno" }`
- Empresas: `{ "sector": "empresas", "rubro": "<demo_key>" }`

Respuesta usar:
- `token`
- `tenant_slug`
- `tipo_chat`
- `sector`
- `marketplace`

---

## 2) Analytics Dashboards

### Overview
`GET /api/admin/analytics/overview?from=...&to=...&scope=municipio&tenant_slug=...`

Garantía backend:
- `payload.totals.total_interactions` siempre presente (fallback backend).

Guardrail frontend:
```ts
const totals = payload?.totals ?? {};
const totalInteractions = Number(totals.total_interactions ?? 0);
```

### Bundle (encuestas analytics)
`GET /api/encuestas/<encuesta_id>/analytics/dashboard`

Estructura esperada (resumida):
- `executive_summary`
- `visual_blueprint`
- `kpis`
- `cards`
- `modules`
- `ui_state`

No asumir campos obligatorios fuera de este set; usar defaults locales.

---

## 3) Encuestas públicas (nivel producción)

### Obtener encuesta pública
`GET /api/public/encuestas/<slug>`

### Resultados en vivo
`GET /api/public/encuestas/<slug>/live-results?include_heatmap=1&window_minutes=60&max_points=800&max_cells=120`

### Comentarios
`GET /api/public/encuestas/<slug>/comentarios?limit=50&offset=0`

Contrato de comentarios (render-safe):
- `id: number`
- `texto: string` (backend ya normaliza dict/list a string)
- `nombre_autor: string` (fallback "Anónimo")
- `fecha: string | null`
- `user_id: number | null`
- `anon_id: string | null`

### Publicar comentario
`POST /api/public/encuestas/<slug>/comentarios`
Body:
- `texto` (required)
- `nombre` o `nombre_autor` (optional)
- `anon_id` (optional)

---

## 4) Estados de error/reason_code relevantes

Demo/Aliases pueden devolver:
- `demo_catalog_unavailable`
- `demo_login_unavailable`
- `tenant_info_unavailable`
- `anon_id_unavailable`
- `auth_service_unavailable`

Encuestas públicas pueden devolver payload con:
- `reason_code: survey_not_published`
- `reason_code: survey_outside_active_window`

Frontend: mostrar fallback UX (mensaje + retry) y no crashear la vista.

---

## 5) Requisitos DB/backend para cero downtime

### Migración obligatoria
`enc_comentario.report_count` debe existir.

Comando:
```bash
flask db upgrade
```

Nota: backend tiene degradación temporal si falta columna, pero la corrección profesional definitiva es migración aplicada.

---

## 6) Checklist de release sincronizado (backend + frontend)

1. Deploy backend.
2. Ejecutar migraciones (`flask db upgrade`).
3. Smoke endpoints:
   - `/api/auth/demo/catalog`
   - `/api/auth/demo`
   - `/api/admin/analytics/overview`
   - `/api/public/encuestas/<slug>/comentarios`
4. Deploy frontend.
5. Validar UX:
   - Login demo municipio -> analytics sin white-screen.
   - Encuesta pública -> comentarios renderizan sin React #31.
