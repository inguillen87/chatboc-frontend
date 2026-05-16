# Fullstack Handoff - Demo UX, Rubros, Widget y PWA

Fecha: 2026-05-16

## Objetivo

La experiencia publica debe permitir que un usuario anonimo entienda, pruebe y confie en Chatboc desde la landing hasta una demo operativa completa. La demo no puede sentirse como una maqueta: debe iniciar por sector, dejar elegir rubro cuando corresponde, abrir un chat real con contexto correcto, crear acciones trazables y mostrar el resultado en un panel demo usable.

Este handoff separa responsabilidades para que backend y frontend avancen sin adivinar contratos.

## Principios obligatorios

- Backend define rubros, menus, acciones, endpoints, capacidades, IDs, estado operativo y errores.
- Frontend renderiza la experiencia, navegacion, accesibilidad, animaciones y estados visuales sin inventar datos operativos.
- No se hardcodean rubros, categorias, tramites, productos, botones, respuestas ni CTAs operativos en React.
- Cada accion demo debe tener `request_id`, `demo_session_id`, `chat_session_id`, `tenant_slug` y `rubro_slug` cuando aplique.
- Si un rubro no esta listo, no debe aparecer como opcion clickeable.
- Si el usuario elige Empresas, el siguiente paso es elegir rubro. No debe entrar por defecto a Bodega, Ferreteria ni ningun tenant fijo.
- Si el usuario elige un rubro, el contexto del chat y del panel debe ser de ese rubro. Una bodega y una ferreteria pueden compartir estructura PyME, pero no deben sonar ni operar igual.

## Estado frontend ya aplicado

- `/demo?sector=empresas` carga catalogo y muestra selector de rubros antes de iniciar sesion.
- El selector soporta rubros enviados como arbol legacy o como lista plana de `GET /api/v2/demo/catalog`.
- Al elegir rubro, `POST /api/v2/demo/session` envia `sector`, `rubro`, `rubro_slug`, `category_slug` y `tenant_slug`.
- El widget global evita usar un `tenantSlug` viejo de `localStorage` en landing/demo.
- Las superficies publicas limpian tenant persistido para no caer en `junin-1` u otro tenant previo.
- El flujo verificado localmente: Empresas -> Ferreteria inicia workspace de ferreteria, no bodega.

## Backend debe entregar

### 1. Catalogo de demos completo

`GET /api/v2/demo/catalog`

Debe devolver sectores y rubros publicados con datos suficientes para que frontend renderice sin inventar.

```json
{
  "contract_version": "demo.catalog.v2",
  "sectors": ["educacion", "gobierno", "empresas"],
  "rubros": [
    {
      "sector": "empresas",
      "key": "ferreteria",
      "rubro_slug": "ferreteria",
      "category_slug": "ferreteria",
      "tenant_slug": "ferreteria",
      "label": "Ferreteria",
      "description": "Pedidos, stock, consultas, envios y postventa.",
      "demo_ready": true,
      "experience_type": "pyme",
      "capabilities": ["chat", "catalog", "cart", "lead", "order_tracking"],
      "session_payload": {
        "sector": "empresas",
        "rubro": "ferreteria",
        "tenant_slug": "ferreteria"
      }
    }
  ],
  "request_id": "req_..."
}
```

Reglas:

- `sector=empresas` debe traer varios rubros si existen.
- No publicar rubros con `demo_ready=false` como clickeables.
- `label`, `description`, `capabilities` y `session_payload` salen del backend.
- Mantener aliases para compatibilidad: `key`, `slug`, `rubro_slug`, `category_slug`.

### 2. Sesion demo robusta

`POST /api/v2/demo/session`

Si frontend manda solo:

```json
{ "sector": "empresas" }
```

Backend no debe elegir Bodega por defecto si hay multiples rubros. Debe responder una de estas dos opciones:

```json
{
  "contract_version": "demo.session.selection_required.v1",
  "requires_rubro_selection": true,
  "sector": "empresas",
  "options": [],
  "request_id": "req_..."
}
```

o crear sesion solo si el sector tiene un unico rubro listo.

Cuando frontend manda rubro:

```json
{
  "sector": "empresas",
  "rubro": "ferreteria",
  "rubro_slug": "ferreteria",
  "category_slug": "ferreteria",
  "tenant_slug": "ferreteria"
}
```

Respuesta obligatoria:

```json
{
  "contract_version": "demo.session.v2",
  "request_id": "req_...",
  "demo_session_id": "demo_...",
  "session_id": "demo_...",
  "tenant_slug": "ferreteria",
  "rubro_slug": "ferreteria",
  "workspace": {
    "title": "Ferreteria demo",
    "welcome_message": "Texto backend-driven",
    "quick_replies": [],
    "value_cards": [],
    "media_capabilities": {},
    "conversion_ctas": {},
    "chat_bootstrap": {
      "endpoint": "/api/ask/pyme",
      "headers": {
        "X-Demo-Session-Id": "demo_...",
        "X-Chat-Session-Id": "demo_...",
        "X-Tenant-Slug": "ferreteria"
      },
      "payload": {
        "sector": "empresas",
        "rubro": "ferreteria",
        "rubro_slug": "ferreteria",
        "vertical": "pyme"
      }
    }
  },
  "admin_preview_endpoint": "/api/v2/demo/admin-preview?demo_session_id=demo_..."
}
```

### 3. Menu PyME generico pero contextual

El backend puede usar una estructura comun para PyME, pero debe parametrizarla por rubro.

Ejemplo de estructura comun:

- Consultar productos o servicios.
- Pedir cotizacion.
- Ver promociones.
- Crear pedido o lead.
- Consultar estado.
- Hablar con una persona.

Ejemplo de contexto por rubro:

- Bodega: vinos, cajas, cepas, maridaje, promociones, entregas.
- Ferreteria: stock, medidas, herramientas, materiales, envio, cotizacion.
- Inmobiliaria: propiedades, visitas, requisitos, tasaciones, consultas.
- Clinica: turnos, especialidades, estudios, autorizaciones.

Regla: los botones y quick replies deben llegar en la respuesta del chat. Frontend solo renderiza.

### 4. Acciones trazables y panel demo vivo

Cuando el chat crea lead, ticket, pedido, caso o consulta operativa, la respuesta debe incluir snapshot suficiente para actualizar el panel demo sin inventar.

```json
{
  "contract_version": "chat.response.v1",
  "request_id": "req_...",
  "message": "Caso creado.",
  "actions": [],
  "created_entity": {
    "kind": "ticket",
    "id": "4",
    "label": "Reclamo creado",
    "status": "nuevo",
    "detail_endpoint": "/api/v2/inbox/omnichannel/4",
    "admin_preview_endpoint": "/api/v2/demo/admin-preview?demo_session_id=demo_...",
    "map": {
      "can_render": true,
      "lat": -34.585,
      "lng": -60.943
    }
  },
  "session_metrics": {
    "created_tickets": 1,
    "captured_locations": 1,
    "citizen_comments": 2
  }
}
```

Backend debe soportar:

- `GET /api/v2/demo/admin-preview?demo_session_id=...`
- `GET /api/v2/inbox/omnichannel/{ticket_id}` como detalle canonico.
- No devolver links que manden al navegador a `/api/v2/tickets/{id}` como pagina visual.
- Si existe `GET /api/v2/tickets/{id}`, debe responder JSON util, pero frontend no debe navegar ahi como vista.

### 4.1 Herramientas por rubro

Cada rubro debe declarar su set operativo en `workspace.rubro_tools` usando `demo.rubro_tools.v1`.

```json
{
  "contract_version": "demo.rubro_tools.v1",
  "sector": "empresas",
  "rubro": "ferreteria",
  "tenant_slug": "ferreteria",
  "display_name": "Ferreteria Demo",
  "enabled_tools": [
    {
      "id": "catalog",
      "kind": "rubro_tool",
      "label": "Catalogo",
      "description": "Recursos publicados para productos, servicios o tramites.",
      "enabled": true,
      "action_label": "Abrir catalogo",
      "action_url": "https://...",
      "items": [],
      "fields": [{ "label": "Recursos", "value": 24 }]
    },
    {
      "id": "location",
      "kind": "rubro_tool",
      "label": "Ubicacion",
      "description": "Direcciones con enlace operativo a Google Maps.",
      "enabled": true,
      "action_label": "Abrir Google Maps",
      "action_url": "https://www.google.com/maps/search/?api=1&query=...",
      "items": [
        {
          "label": "Sucursal centro",
          "address": "Av. San Martin 100",
          "lat": -34.585,
          "lng": -60.943,
          "maps_url": "https://www.google.com/maps/search/?api=1&query=-34.585%2C-60.943"
        }
      ]
    }
  ],
  "resources": [],
  "price_resources": [],
  "locations": [],
  "contact": {
    "phone": "+549...",
    "whatsapp": "+549...",
    "email": "ventas@...",
    "website": "https://..."
  },
  "hours": { "lunes_viernes": "09:00-18:00" },
  "faq_preview": [],
  "frontend_contract": {
    "render_as": "tool_tray",
    "source_path": "workspace.rubro_tools.enabled_tools",
    "hide_disabled_tools": true,
    "open_maps_with": "items[].maps_url",
    "do_not_invent_missing_tools": true
  }
}
```

Herramientas esperadas por rubro cuando existan datos:

- `catalog`: catalogo, productos, servicios o tramites.
- `price_list`: lista de precios, stock, PDF, Excel o recurso equivalente.
- `location`: direccion o coordenadas con Google Maps.
- `contact`: telefono, WhatsApp, email o web.
- `hours`: horarios de atencion.
- `faq`: consultas frecuentes del rubro.

Reglas:

- Frontend solo renderiza herramientas con `enabled=true`.
- Frontend no inventa `label`, `description`, `action_label` ni datos.
- Si backend no manda ubicacion, no se muestra mapa ni Google Maps.
- Si backend manda coordenadas o direccion, debe mandar `maps_url` o datos suficientes para construir Google Maps.
- El resumen para IA debe viajar en `chat_bootstrap.payload.rubro_tool_summary` para que el bot responda con contexto real del rubro.

### 5. Widget publico

`GET /api/public/widget-config`

Para la plataforma publica debe devolver opciones de onboarding con comportamiento explicito:

```json
{
  "contract_version": "public.widget_config.v1",
  "onboarding": {
    "contract_version": "public.widget_onboarding.v1",
    "mode": "platform_sector_selector",
    "quick_menu": [
      {
        "label": "Colegios",
        "sector": "educacion",
        "target_url": "/demo?sector=educacion",
        "selection_behavior": "navigate_to_demo_selector"
      },
      {
        "label": "Gobiernos",
        "sector": "gobierno",
        "target_url": "/demo?sector=gobierno",
        "selection_behavior": "navigate_to_demo_selector"
      },
      {
        "label": "Empresas",
        "sector": "empresas",
        "target_url": "/demo?sector=empresas",
        "selection_behavior": "navigate_to_demo_selector"
      }
    ]
  }
}
```

Regla: el widget global no debe quedar atado a un tenant viejo ni abrir un rubro final sin seleccion.

### 6. Accesibilidad y PWA

Backend debe exponer `ui_hints.accessibility` y `pwa` dentro de contratos publicos:

- `large_targets`
- `high_contrast`
- `reduced_motion`
- `captions`
- `simple_language`
- `dyslexia_friendly`
- `install_prompt`
- `offline_fallback`
- `safe_area_bottom`

Frontend renderiza esos hints. Backend no decide layout CSS, pero si declara capacidades y restricciones.

## Frontend debe ejecutar

### 1. Selector de rubro profesional

- Mostrar sector primero y rubros despues.
- Si `sector=empresas`, no iniciar sesion hasta elegir rubro.
- Usar `label`, `description`, `capabilities`, `demo_ready` y `session_payload` del backend.
- Si el catalogo no trae rubros, mostrar error accionable con reintento, no seleccionar un default invisible.

### 2. Chat demo contextual

- Preservar `demo_session_id`, `chat_session_id`, `tenant_slug` y `rubro_slug` en headers/payload.
- Renderizar quick replies, botones y acciones del backend.
- No insertar textos locales de bodega, ferreteria, municipio o colegio.
- Si backend pide ubicacion, abrir modal GPS.
- Si backend devuelve coordenadas, mostrar mapa.

### 3. Panel demo realmente operativo

Las tabs deben hacer trabajo real:

- Resumen: contadores desde `session_metrics` o `admin_preview`.
- Reclamos/casos/leads: lista desde entidad creada o endpoint.
- Mapa operativo: solo si backend devuelve ubicacion o zonas agregadas.
- Encuestas: solo si backend devuelve encuestas o estado vacio real.
- Vista 360: drawer con `detail_endpoint`, adjuntos, timeline, SLA, acciones permitidas.

Regla: no dejar botones con solo hover. Cada CTA visible debe navegar, abrir drawer, ejecutar accion o explicar por que no esta disponible.

### 4. Navegacion segura

- Nunca hacer `window.location` a una URL `/api/...` como si fuera pagina.
- Abrir detalle dentro de una ruta visual o drawer.
- Usar `detail_endpoint` solo para fetch JSON.
- Si no hay ruta visual, mostrar drawer local con datos del endpoint.

### 5. Widget responsive

- En mobile, launcher abajo con safe area.
- Chat abierto debe ocupar ancho alto suficiente y no tapar el demo del celular cuando el usuario esta en hero/demo.
- Si el usuario esta interactuando con un mockup central, el widget debe abrir como bottom sheet o pantalla casi completa.
- Targets tactiles minimos de 44px.
- Composer accesible con labels, foco visible y controles por icono.

### 6. Landing visual

- El telefono del hero debe mantener proporciones realistas.
- El headline no puede montarse sobre el telefono.
- La mascota flotante chica se mantiene; remover cualquier robot 3D que degrade la estetica.
- Animaciones con `prefers-reduced-motion` respetado.
- Ninguna seccion debe depender de hover para explicar funcionalidad.

### 7. PWA

- Instalar solo por gesto del usuario.
- No mostrar banner si no existe `beforeinstallprompt`.
- Offline fallback usable.
- Estado de instalacion claro.
- No tapar CTAs principales con el prompt de instalacion.

## QA fullstack minimo

### Demos

- Abrir `/demo?sector=empresas`.
- Confirmar que no hay `POST /api/v2/demo/session` antes de elegir rubro.
- Elegir Bodega y confirmar chat/menu/contexto de bodega.
- Volver y elegir Ferreteria; confirmar chat/menu/contexto de ferreteria.
- Confirmar que no persiste `junin-1` ni otro tenant viejo.
- Confirmar que el panel demo cambia al crear lead/ticket/pedido.

### Gobierno

- Abrir `/demo?sector=gobierno`.
- Crear reclamo con categoria, comentario y ubicacion.
- Confirmar que el resumen sube de 0 a 1.
- Confirmar que mapa aparece solo con coordenadas.
- Confirmar que detalle abre drawer 360, no `/api/v2/tickets/{id}` como pagina.

### Colegios

- Abrir `/demo?sector=educacion`.
- Elegir rubro/colegio.
- Crear consulta escolar.
- Confirmar contexto educativo y panel con caso escolar.

### Accesibilidad/mobile

- Mobile 360px y 390px: sin overflow horizontal.
- Widget abierto grande y usable.
- Foco visible por teclado.
- Contraste AA en textos y botones.
- `prefers-reduced-motion` reduce animaciones.
- PWA prompt no tapa demo ni CTA principal.

## Definition of done

- Frontend build verde.
- Tests focalizados para selector rubro, tenant persistido y demo session payload.
- Backend tests para catalogo, session selection required, chat response con entity snapshot y admin preview por `demo_session_id`.
- Smoke local fullstack: landing -> sector -> rubro -> chat -> entidad -> panel demo.
- Sin errores 404 por navegacion a rutas API como paginas.
- Sin demos con datos inventados en frontend.
