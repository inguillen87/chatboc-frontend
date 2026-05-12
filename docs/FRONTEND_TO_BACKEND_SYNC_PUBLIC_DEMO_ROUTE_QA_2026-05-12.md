# Frontend to Backend Sync - Public Demo Route QA 2026-05-12

Fecha: 2026-05-12

Objetivo: cerrar los errores visibles en landing, demo, rutas publicas y widget embebido sin crear una app paralela. Frontend ya protege la experiencia con fallbacks locales, pero backend deberia devolver contratos JSON consistentes para que produccion no muestre 404/CORS ni mensajes legacy.

## QA frontend aplicado

- Slugs de marketing como `casos`, `pymes`, `empresas`, `municipios`, `gobiernos`, `colegios`, `sectores`, `precios` y `opinar` ya no se tratan como `tenant_slug`.
- `/casos`, `/casos-de-uso` y `/sectores` redirigen a `/demo`.
- `/pymes` y `/empresas` redirigen a `/demo?sector=empresas`.
- `/municipios` y `/gobiernos` redirigen a `/demo?sector=gobierno`.
- `/colegios` redirige a `/demo?sector=educacion`.
- Las rutas publicas tenant usan base `/t/{tenant_slug}` para no chocar con rutas de marketing.
- El widget filtra el selector legacy `Bienvenido al showroom interactivo de Chatboc` y no vuelve a pedir rubro si ya existe demo session, tenant o chat bootstrap.
- El demo colegio ahora muestra una experiencia integrada: chat, panel admin demo, recursos/catalogo e historial operativo.
- La landing ya no muestra copy tecnico ni placeholders vacios cuando faltan secciones del contrato.

## Pedido backend prioritario

### 1. Slugs publicos reservados

Si llega una llamada publica con `tenant_slug` igual a un slug de marketing, backend no deberia intentar resolverlo como tenant real.

Slugs reservados iniciales:

```json
[
  "demo",
  "casos",
  "casos-de-uso",
  "use-cases",
  "pymes",
  "empresas",
  "municipios",
  "gobiernos",
  "colegios",
  "escuelas",
  "sectores",
  "precios",
  "opinar"
]
```

Respuesta sugerida para endpoints tenant-aware cuando el slug es reservado:

```json
{
  "contract_version": "public.reserved_slug.v1",
  "ok": false,
  "reason_code": "reserved_public_route",
  "action_hint": "Use /demo, /api/v2/demo/catalog or a real tenant_slug.",
  "request_id": "req_..."
}
```

Debe responder con CORS OK, no con HTML ni preflight fallido.

### 2. Catalogo publico tenant

Frontend vio llamadas cacheadas a:

- `/api/public/tenants/casos/catalog?tenant_slug=casos&tenant=casos`
- `/public/tenants/casos/catalog?tenant_slug=casos&tenant=casos`

Pedido: responder JSON degradable para tenant no resuelto:

```json
{
  "contract_version": "public.catalog_resolution.v1",
  "ok": false,
  "reason_code": "tenant_resolution_failed",
  "items": [],
  "cart": { "enabled": false },
  "request_id": "req_..."
}
```

### 3. Demo session y CORS

Produccion debe confirmar:

- `POST /api/v2/demo/session` responde `demo.session.v2`.
- `GET /api/v2/demo/catalog` responde `demo.catalog.v2`.
- CORS permite `https://www.chatboc.ar`.
- Los aliases cacheados `/api/v1/demo/session`, `/v1/demo/session`, `/v2/demo/session`, `/api/auth/demo` y `/auth/demo` devuelven JSON con `method_not_allowed` o `route_moved`, no CORS rojo.
- Los catalogos cacheados `/api/auth/demo/catalog` y `/auth/demo/catalog` devuelven JSON con `route_moved` a `/api/v2/demo/catalog`.

Respuesta sugerida para alias viejo:

```json
{
  "contract_version": "demo.route_alias.v1",
  "ok": false,
  "reason_code": "route_moved",
  "canonical_endpoint": "/api/v2/demo/session",
  "request_id": "req_..."
}
```

Para catalogo legacy:

```json
{
  "contract_version": "demo.route_alias.v1",
  "ok": false,
  "reason_code": "route_moved",
  "canonical_endpoint": "/api/v2/demo/catalog",
  "request_id": "req_..."
}
```

## QA frontend adicional 2026-05-12

- `GET /api/auth/demo/catalog` ya no se usa desde el login; el frontend consulta `GET /api/v2/demo/catalog`.
- `POST /api/auth/demo` ya no se usa desde el login; el frontend usa `POST /api/v2/demo/session`.
- La pantalla `/login` ya no muestra el selector viejo `Municipio/PyME` como entrada publica principal. Muestra tres demos guiadas: colegio, gobierno y empresa.
- Si hay builds cacheados en produccion, backend deberia mantener `/api/auth/demo*` y `/auth/demo*` con CORS y JSON para evitar consola roja hasta que todo el trafico se renueve.

### 4. Demo admin publico por sector

Frontend hoy usa fallback local para que un colegio, municipio o empresa pueda ver una demo completa aunque backend no este desplegado. Para hacerlo backend-first, sugerimos:

`GET /api/v2/demo/admin-preview?sector=educacion|gobierno|empresas&tenant_slug=...`

Shape:

```json
{
  "contract_version": "demo.admin_preview.v1",
  "sector": "educacion",
  "title": "Panel demo para direccion escolar",
  "subtitle": "Colegio privado integral",
  "modules": [
    { "id": "summary", "label": "Resumen", "enabled": true },
    { "id": "cases", "label": "Casos escolares", "enabled": true }
  ],
  "cards": [
    { "label": "Casos abiertos", "value": "18", "detail": "inasistencias y documentacion" }
  ],
  "timeline": [
    { "label": "Familia inicia consulta", "status": "done" },
    { "label": "Secretaria recibe el caso", "status": "active" }
  ],
  "catalog": {
    "enabled": true,
    "title": "Colegio privado integral",
    "download_endpoint": "/api/v2/demo/catalog-assets/colegio-demo.pdf"
  },
  "frontend_contract": {
    "render_as": "demo_admin_preview"
  },
  "request_id": "req_..."
}
```

### 5. Navegacion publica tenant

Las botoneras `Inicio`, `Noticias`, `Eventos`, `Encuestas`, `Nuevo reclamo` no deben llevar a paginas rotas si el tenant o modulo no esta disponible.

Sugerencia:

`GET /api/public/tenants/{tenant_slug}/public-navigation`

```json
{
  "contract_version": "tenant.public_navigation.v1",
  "items": [
    {
      "id": "home",
      "label": "Inicio",
      "route": "/t/{tenant_slug}",
      "enabled": true
    },
    {
      "id": "news",
      "label": "Noticias",
      "route": "/t/{tenant_slug}/noticias",
      "enabled": false,
      "empty_state": "Todavia no hay noticias publicadas."
    }
  ],
  "request_id": "req_..."
}
```

Frontend debe ocultar o deshabilitar items con `enabled=false`.

### 6. Live chat schedule degradable

Para builds cacheados, backend deberia responder JSON con CORS OK en:

- `/api/{tenant_slug}/live-chat/schedule`
- `/{tenant_slug}/live-chat/schedule`
- `/api/public/tenants/{tenant_slug}/live-chat/schedule`

```json
{
  "contract_version": "live_chat.schedule.v1",
  "enabled": false,
  "available": false,
  "socket_enabled": false,
  "socket_transport_hint": "disabled",
  "fallback_mode": "http_chat",
  "request_id": "req_..."
}
```

## Aceptacion compartida

- No hay llamadas a `/api/public/tenants/casos/catalog` como tenant real.
- `/demo?sector=educacion` entra directo a demo colegio con chat y panel admin preview.
- El selector legacy no vuelve a aparecer despues de elegir pilar/rubro.
- Las botoneras publicas no navegan a 404.
- Todo error publico responde JSON con `request_id` y CORS OK.
