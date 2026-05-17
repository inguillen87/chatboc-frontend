# Frontend to Backend - Widget Menu Runtime Hotfix

Fecha: 2026-05-17

## Objetivo

El widget debe poder mostrar y ejecutar menus de rubro, acciones rapidas y flujos escolares/pyme/municipio dentro del chat, sin navegar a rutas internas, sin mezclar tenants y sin quedar con respuestas mudas.

Frontend ya corrige:

- Normaliza endpoints publicados como `/ask/...` hacia `/api/ask/...` para evitar `405 Method Not Allowed` en produccion.
- Trata `interactive_sections`, `interactive_list.sections`, botones, cards y resultados operativos como contenido renderizable aunque no venga `respuesta`.
- Renderiza recursos descargables como links externos cuando backend publica `url`/`action_url`.
- Ejecuta herramientas operativas dentro del chat con `action_id`, sin simular resultados locales.

## Problema observado

En produccion se vieron estos casos:

- `POST https://www.chatboc.ar/ask?...` devuelve `405`.
- `POST /api/ask/pyme?tenant_slug=qa-colegio-sandbox...` devuelve `403` despues de varias acciones.
- Respuestas `200` del backend pueden llegar sin campos de texto normalizados, generando `Normalized payload produced no messages`.
- El widget muestra herramientas informativas, pero los menus accionables no siempre llegan como botones/chat actions claros.

## Requerimientos backend

### 1. Chat bootstrap siempre accionable

`POST /api/v2/demo/session` debe publicar `workspace.chat_bootstrap` y, por compatibilidad, puede publicarlo tambien en `chat_bootstrap`.

```json
{
  "workspace": {
    "chat_bootstrap": {
      "contract_version": "demo.chat_bootstrap.v1",
      "endpoint": "/api/ask/pyme",
      "same_origin_endpoint": "/api/ask/pyme",
      "fallback_endpoint": null,
      "method": "POST",
      "query": {
        "tenant_slug": "qa-colegio-sandbox",
        "tenant": "qa-colegio-sandbox"
      },
      "headers": {
        "X-Tenant-Slug": "qa-colegio-sandbox",
        "X-Chat-Session-Id": "sid_...",
        "X-Demo-Session-Id": "demo_...",
        "X-Anon-Id": "anon_..."
      },
      "payload": {
        "tenant_slug": "qa-colegio-sandbox",
        "tenant": "qa-colegio-sandbox",
        "tipo_chat": "pyme",
        "demo_mode": true
      }
    }
  }
}
```

Reglas:

- No publicar `/ask` como endpoint visual/publico si no acepta `POST` en produccion.
- `endpoint` y `same_origin_endpoint` deben ser `/api/ask`, `/api/ask/pyme` o `/api/ask/municipio`.
- `fallback_endpoint` debe ser `null` o una ruta `/api/ask/...`; nunca `/ask`.
- `X-Demo-Session-Id` y `X-Chat-Session-Id` no deben confundirse: el primero identifica la demo; el segundo la conversacion.
- Frontend debe usar el endpoint publicado. No debe probar bases alternativas despues de una respuesta de limite.

### 1.1 Request para acciones de menu

Cada click de menu se envia como `POST` al endpoint de `chat_bootstrap`.

```json
{
  "pregunta": "",
  "tenant_slug": "qa-colegio-sandbox",
  "tipo_chat": "pyme",
  "demo_mode": true,
  "action_id": "create_school_case",
  "education_context": { "is_education": true }
}
```

Regla backend importante:

- `pregunta=""` con `action_id` no es una solicitud de menu.
- Solo tratar como menu inicial cuando `action_id` este ausente y `pregunta` sea `""` o `"__INIT__"`, o cuando `action_id` sea `menu`, `menu_principal`, `menu_colegio` o `main_menu`.

### 2. Toda accion debe devolver contenido renderizable

Cuando frontend envia:

```json
{
  "pregunta": "",
  "tenant_slug": "qa-colegio-sandbox",
  "tipo_chat": "pyme",
  "demo_mode": true,
  "action_id": "create_school_case"
}
```

Backend debe responder con al menos uno de estos bloques:

- `message`, `respuesta`, `texto`, `message_to_user` o `message_body`.
- `messages[]`, `assistant_message.content`, `chat_messages[]` o `respuesta_usuario`.
- `botones` / `buttons` / `quick_replies`.
- `interactive_sections` o `interactive_list.sections`.
- `confirmation_card`.
- `data` con resultado operativo real: `ticket_id`, `chat_id`, `status`, `school_case`, `order`, `claim`, `lead` o `handoff`.

Ejemplo minimo:

```json
{
  "success": true,
  "request_id": "req_...",
  "message": "Decime que paso y, si queres, adjunta una foto o PDF.",
  "botones": [
    { "texto": "Hablar con secretaria", "action_id": "talk_secretary" }
  ],
  "data": {
    "status": "esperando_detalle",
    "school_case": {}
  }
}
```

Reglas frontend:

- No descartar botones por falta de `messages[]`.
- Si backend responde `200` sin texto pero con `data`, renderizar resultado operativo.
- Si backend responde `200` sin ningun bloque renderizable, mostrar estado vacio controlado y loggear warning compacto.

### 2.1 Lectura de mensajes

Orden recomendado:

1. `messages[].content`
2. `assistant_message.content`
3. `chat_messages[].content`
4. `message_body`
5. `message_to_user`
6. `respuesta`
7. `respuesta_usuario`
8. `texto`
9. `message`

### 3. Contrato de menu corto por rubro

Publicar menus accionables desde backend en alguno de estos paths:

- `workspace.default_menu.items`
- `workspace.quick_menu`
- `workspace.primary_actions`
- `workspace.government.primary_actions`
- `workspace.government.quick_menu`
- `workspace.gobierno.primary_actions`
- `workspace.gobierno.quick_menu`
- `workspace.municipio.primary_actions`
- `workspace.municipio.quick_menu`
- `workspace.education.primary_actions`
- `workspace.education.quick_menu`
- `workspace.education_profile.primary_actions`
- `workspace.education_profile.quick_menu`
- `workspace.pyme.primary_actions`
- `workspace.pyme.quick_menu`
- `workspace.business.primary_actions`
- `workspace.business.quick_menu`
- `workspace.commerce.primary_actions`
- `workspace.commerce.quick_menu`
- `workspace.operational_menu.primary_actions`
- `workspace.operational_menu.quick_menu`
- `workspace.verticals.<active_vertical>.actions`
- `experience_blueprint.conversion_ctas.actions`

Formato recomendado:

```json
{
  "label": "Crear caso escolar",
  "description": "Conta que paso y adjunta foto, audio o PDF si hace falta.",
  "action_id": "create_school_case",
  "payload": {
    "education_context": { "is_education": true }
  }
}
```

Reglas:

- Aliases frontend soportados:
  - label: `label`, `texto`, `title`, `cta_label`.
  - action id: `action_id`, `intent`, `action`, `id`, `key`.
  - descripcion: `description`, `descripcion`, `detail`.
- Deduplicar por `action_id`, `intent`, `action`, `id`, `key`, `label` o `title`.
- Renderizar solo `enabled !== false`.
- Menus operativos no deben traer `url` salvo que sean PDF, Excel, catalogo descargable o recurso externo.
- `label`, `description`, `action_id` y `payload` salen del backend.
- Para pyme/gobierno/colegio usar lenguaje del rubro. No mezclar textos municipales en colegio.
- El menu debe ser corto: 3 a 5 acciones principales. El resto puede venir como `interactive_sections` luego de que el usuario pida mas opciones.
- Si se conoce el nombre del visitante/contacto, backend puede publicar saludo personalizado. Si no se conoce, backend debe pedirlo dentro del flujo, no depender de texto local del frontend.

### 3.1 Gobiernos / Municipios

Acciones esperadas cuando el tenant las soporte:

```json
[
  {
    "label": "Crear reclamo",
    "description": "Contame que paso. Podes adjuntar foto, audio o ubicacion.",
    "action_id": "crear_reclamo",
    "payload": { "vertical": "municipio" }
  },
  {
    "label": "Consultar estado",
    "description": "Busca un reclamo por numero o datos de contacto.",
    "action_id": "consultar_estado_reclamo"
  },
  {
    "label": "Consultar tramite",
    "description": "Responde desde tramites publicados por el municipio.",
    "action_id": "consultar_tramite"
  },
  {
    "label": "Hablar con una persona",
    "description": "Deriva a mesa de atencion si esta disponible.",
    "action_id": "derivar_humano"
  }
]
```

Reglas:

- Foto, audio y ubicacion son entradas del chat, no paginas separadas.
- La confirmacion visual de reclamo requiere `ticket_id`, `chat_id`, `status` o comprobante real en `data`/`confirmation_card`.
- No mostrar mapa si backend no publica coordenadas, direccion, `geo_layers` o pedido explicito de GPS.

### 3.2 Colegios

Acciones esperadas cuando el tenant las soporte:

```json
[
  {
    "label": "Crear caso escolar",
    "description": "Conta que paso y adjunta foto, audio o PDF si hace falta.",
    "action_id": "create_school_case",
    "payload": { "education_context": { "is_education": true } }
  },
  {
    "label": "Justificar inasistencia",
    "description": "Carga alumno, curso, fecha, motivo y certificado si existe.",
    "action_id": "justify_absence"
  },
  {
    "label": "Hablar con secretaria",
    "description": "Crea espera para secretaria o muestra horario real.",
    "action_id": "talk_secretary"
  }
]
```

Reglas:

- Usar lenguaje escolar: familia, alumno, curso, secretaria, inasistencia, certificado, comunicado.
- `registrar_intencion_pago_colegio` no es pago realizado. Backend debe devolver estado y texto claro de intencion/checkout si aplica.
- Adjuntos escolares se tratan como evidencia de caso escolar, no como catalogo comercial.

### 3.3 Pymes / Empresas / Rubros comerciales

Acciones esperadas cuando el tenant las soporte:

```json
[
  {
    "label": "Consultar producto",
    "description": "Busca precio, disponibilidad o detalle publicado por el comercio.",
    "action_id": "consultar_producto"
  },
  {
    "label": "Crear pedido",
    "description": "Pide datos y confirma el pedido solo con respuesta del backend.",
    "action_id": "crear_pedido"
  },
  {
    "label": "Cotizar envio",
    "description": "Usa direccion o ubicacion enviada por el usuario.",
    "action_id": "cotizar_envio"
  },
  {
    "label": "Hablar con ventas",
    "description": "Deriva o registra lead comercial.",
    "action_id": "capturar_lead_comercial"
  }
]
```

Reglas:

- Catalogos, PDFs, listas de precio, Excel y promos descargables pueden abrirse fuera del chat.
- Pedido, checkout, cotizacion, contacto, imagen para reconocer producto y ubicacion deben continuar dentro del chat.
- Frontend no calcula totales, envio, stock ni precio final. Renderiza solo lo confirmado por backend.
- Si backend responde `amount_validated: false`, frontend no muestra monto final confirmado.
- Pedido confirmado requiere validacion backend en el ultimo paso.

### 3.4 Rubros nuevos o genericos

Cuando `active_vertical=general` o el rubro no sea municipio/pyme/colegio, backend debe publicar acciones genericas si quiere que el widget opere:

```json
[
  {
    "label": "Registrar consulta",
    "description": "Deja una solicitud trazable para el equipo.",
    "action_id": "registrar_solicitud_operativa",
    "payload": { "tipo_solicitud": "consulta" }
  },
  {
    "label": "Hablar con una persona",
    "description": "Pide datos de contacto y deriva al equipo.",
    "action_id": "derivar_humano"
  }
]
```

Regla: frontend no inventa certificados, boletas, pagos, turnos, precios ni resoluciones para rubros genericos.

### 4. Herramientas de rubro

`workspace.rubro_tools.enabled_tools` debe diferenciar:

- Descargables: `catalog`, `price_list`, `pdf`, `excel`, `resource` con `action_url` o `url`.
- Operativos dentro del chat: `contact`, `location`, `hours`, `faq`, `create_order`, `create_claim`, `school_case`, `human_handoff` con `action_id`.

Ejemplo:

```json
{
  "id": "faq",
  "kind": "rubro_tool",
  "label": "Consultas frecuentes",
  "description": "Preguntas frecuentes publicadas por el colegio.",
  "enabled": true,
  "action_label": "Consultar",
  "action_id": "faq"
}
```

Reglas:

- Recursos con `url` se abren como link externo.
- Recursos operativos con `action_id` se ejecutan dentro del chat.
- No convertir `/api/v2/demo/catalog-assets/...` ni `/media/demo_catalogs/...` en rutas SPA.
- No enviar un PDF como mensaje de chat.

### 5. Errores y limites de demo

Si la demo queda limitada, responder JSON estable:

```json
{
  "ok": false,
  "reason_code": "demo_message_limit_reached",
  "message": "Llegaste al limite de mensajes gratis de esta demo.",
  "request_id": "req_...",
  "trial_usage": {
    "channel": "chat",
    "limit": 5,
    "used": 5,
    "remaining": 0
  },
  "upgrade": {
    "title": "Ya viste la demo real. Sigamos con una prueba guiada.",
    "cta_label": "Dejar datos",
    "lead_capture_endpoint": "/api/public/lead-capture"
  }
}
```

Reglas:

- `403` solo debe usarse para token invalido, tenant bloqueado o limite real.
- Si hay `403`, incluir siempre `reason_code`, `message` y `request_id`.
- No devolver HTML ni stack traces.
- Reason codes esperados: `demo_message_limit_reached`, `anonymous_trial_limit_reached`, `anonymous_message_limit_reached`.
- Frontend bloquea composer y botones operativos, mantiene historial visible y muestra card comercial desde `upgrade`.
- Frontend no reintenta en `/ask`, `/api/ask/pyme` ni otra base.

### 6. Marketplace e inventario Pro

Documento completo: `docs/FRONTEND_TO_BACKEND_MARKETPLACE_INVENTORY_PRO_2026_05_17.md`.

Reglas para demos:

- `demo_mode=true` no confirma stock real, inventario, precio final ni disponibilidad comercial.
- El catalogo demo puede mostrar recursos ilustrativos y descargables.
- Botones de pedido en demo muestran el flujo, pero la confirmacion comercial real queda deshabilitada o marcada como demo.

Reglas para tenants pagos:

- Admin, widget, WhatsApp, chat profesional, carrito y pedidos usan el mismo catalogo backend.
- Frontend renderiza `stock`, `stock_quantity`, `stock_status`, `available_to_sell`, `inventory`, `catalog_version` y `request_id` cuando backend los publica.
- Frontend no calcula stock ni precio final.
- Pedido confirmado requiere validacion backend en el ultimo paso.

Endpoints a consumir:

- `GET /api/admin/tenants/{tenant_slug}/catalog`
- `GET /api/admin/tenants/{tenant_slug}/catalog/items`
- `PATCH /api/admin/tenants/{tenant_slug}/catalog/items/{item_id}`
- `POST /api/admin/catalog/import`
- `GET /api/admin/catalog/import/{upload_id}`
- `PUT /api/admin/catalog/import/{upload_id}`
- `POST /api/admin/catalog/import/{upload_id}/commit`
- `GET /api/v2/tenants/{tenant_slug}/catalog/quality`

Importacion:

- `mode=upsert`: actualiza por SKU y crea faltantes.
- `mode=replace`: reemplaza catalogo del tenant.
- `mode=stock_only`: actualiza solo stock por SKU y no crea productos nuevos.

### 7. Accesibilidad minima del widget

Base recomendada: WCAG 2.2 AA.

Requisitos minimos:

- El widget abierto debe tener `role="dialog"` o region equivalente, titulo accesible y cierre con `Escape`.
- Foco atrapado dentro del widget mientras esta abierto; al cerrar, vuelve al boton que lo abrio.
- Todos los botones iconicos tienen `aria-label`.
- Mensajes nuevos anuncian cambios con `aria-live="polite"`.
- Estados de carga usan `aria-busy`; botones bloqueados usan `aria-disabled`.
- Navegacion 100% por teclado: abrir, cerrar, escribir, enviar, adjuntar, menu tres puntos y elegir accion.
- Avatar/realtime con controles visibles: pausar animacion, silenciar, activar subtitulos/transcripcion y repetir ultimo mensaje.
- Respetar `prefers-reduced-motion`.
- Contraste suficiente en modo claro y oscuro; foco visible y no solo por color.
- Inputs con etiquetas reales, no solo placeholders.
- Adjuntos y ubicacion tienen descripciones accesibles.

## QA compartida

1. Abrir `/demo?sector=gobierno`, elegir municipio y abrir widget.
2. Ver menu corto municipal con acciones reales publicadas por backend.
3. `Crear reclamo` debe hacer `POST /api/ask/municipio` o endpoint publicado por `chat_bootstrap`, no `/ask`.
4. Foto/audio/ubicacion para reclamo deben seguir dentro del chat y mostrar confirmacion solo con ticket real.
5. Abrir `/demo?sector=educacion`, elegir colegio y abrir widget.
6. Ver menu corto escolar con acciones reales.
7. Click en `Crear caso escolar` debe hacer `POST /api/ask/pyme`, no `/ask`.
8. `Justificar inasistencia` debe aceptar texto, audio, imagen o PDF dentro del chat.
9. `Hablar con secretaria` debe devolver `status`, `live_chat` y `ticket_id/chat_id` cuando cree espera real.
10. Abrir `/demo?sector=empresas`, elegir bodega/ferreteria/almacen y abrir widget.
11. `Consultar producto`, `Crear pedido` y `Cotizar envio` deben operar dentro del chat. Catalogos y listas descargables abren como link externo.
12. La respuesta de cualquier accion debe mostrar mensaje, card, botones o resultado operativo, no warning de payload sin mensajes.
13. Agotar limite de demo debe mostrar card comercial, no error rojo ni reintento automatico.
14. Cambiar Empresas -> Colegios -> Gobiernos no conserva `tenant_slug`, `widget_token` ni `chat_bootstrap` anterior.
15. Colegios no muestra copy municipal.
16. Gobiernos no muestra copy comercial.
17. Empresas no muestra monto final si no fue validado por backend.
18. PDFs demo abren desde `/api/v2/demo/catalog-assets/...` sin pasar por React Router.
19. Widget se usa completo con teclado y lector de pantalla.
20. Tenant pago puede actualizar stock por `PATCH` y por import `stock_only`.
21. Widget/WhatsApp no confirma compra si `stock_status` es `stock_unknown` u `out_of_stock`.
