# Frontend to Backend - Widget Educacion, Live Handoff y Accesibilidad

Fecha: 2026-05-17

## Objetivo

Evitar mezcla de rubros en demos escolares y alinear widget web, WhatsApp sandbox y live handoff con contratos backend. Frontend no inventa textos, rutas, menus ni resultados operativos: renderiza lo publicado y envia acciones estructuradas.

## Contratos que frontend consume

- `experience_blueprint.experience_type === "education"`
- `workspace.education_profile.is_education === true`
- `workspace.education.profile.is_education === true`
- `workspace.education.quick_menu`
- `workspace.education.primary_actions`
- `workspace.education_profile.quick_menu`
- `workspace.education_profile.primary_actions`
- `workspace.education.whatsapp_playbook`
- `experience_blueprint.conversion_ctas.actions`
- `workspace.chat_bootstrap`

## Acciones escolares

Backend debe publicar las acciones principales cuando correspondan:

```json
[
  { "label": "Crear caso escolar", "action_id": "create_school_case" },
  { "label": "Justificar inasistencia", "action_id": "justify_absence" },
  { "label": "Hablar con secretaria", "action_id": "talk_secretary" }
]
```

Frontend ya envia esos clicks al endpoint del `chat_bootstrap` actual, sin navegacion local, preservando:

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

El orden de lectura del frontend para acciones escolares es:

1. `workspace.education.primary_actions`
2. `workspace.education.quick_menu`
3. `workspace.education_profile.primary_actions`
4. `workspace.education_profile.quick_menu`
5. `workspace.education.whatsapp_playbook.primary_actions`
6. `workspace.education.whatsapp_playbook.quick_menu`
7. `workspace.education.whatsapp_playbook.actions`
8. `experience_blueprint.conversion_ctas.actions`

Se deduplican por `action_id`, `action`, `intent`, `id`, `key`, `label` o `title`.

## WhatsApp sandbox

El launcher de WhatsApp lee el playbook escolar desde:

- `whatsapp_sandbox.whatsapp_playbook`
- `whatsapp_sandbox.education.whatsapp_playbook`
- `education.whatsapp_playbook`
- `workspace.education.whatsapp_playbook`

Campos soportados dentro del playbook:

- `primary_actions`
- `quick_menu`
- `actions`
- `starter_messages`

Frontend muestra solo labels/textos publicados por backend y los combina con `scenario_scripts` sin mezclar textos municipales ni comerciales.

Headers esperados:

```json
{
  "X-Chat-Session-Id": "sid_...",
  "X-Demo-Session-Id": "eyJ...",
  "X-Tenant-Slug": "qa-colegio-sandbox",
  "X-Anon-Id": "anon..."
}
```

## Live handoff escolar

Para `talk_secretary`, backend debe crear ticket/caso con estado trazable y publicar `data.live_chat`.

Estados esperados:

- disponible: mensaje y estado de espera publicados por backend.
- fuera de horario: descripcion de horarios publicada por backend.
- admin: nuevo ticket visible con categoria/alias escolar y estado `esperando_agente_en_vivo`.

Respuesta minima soportada:

```json
{
  "success": true,
  "request_id": "req_...",
  "fuente": "education_widget_live_handoff",
  "data": {
    "ticket_id": 123,
    "chat_id": "P-123456",
    "status": "esperando_agente_en_vivo",
    "live_chat": {},
    "school_case": {}
  }
}
```

Frontend normaliza `data.ticket_id`, `data.chat_id`, `data.status` y `data.school_case` como resultado operativo escolar. No inventa disponibilidad, horario ni contenido de secretaria si `data.live_chat` no lo publica.

## Adjuntos y casos escolares

Imagenes y PDFs en contexto escolar se tratan como adjuntos de caso escolar. Backend debe crear ticket `pyme` con alias `school_case` cuando corresponda y devolver identificador, estado, `request_id` y acciones siguientes.

Frontend no trata recursos escolares como catalogo comercial salvo que backend lo publique explicitamente.

## Assets demo

Backend debe publicar URLs demo bajo:

```txt
/api/v2/demo/catalog-assets/...
```

Frontend abre `resource.url` tal como viene, con link externo o descarga. No convierte esas URLs en rutas SPA.

## Accesibilidad

Base recomendada: WCAG 2.2 AA. El widget debe tratar chat, voz y avatar como superficies accesibles, no como decoracion.

Requisitos minimos:

- El widget abierto debe tener `role="dialog"` o region equivalente, titulo accesible y cierre con `Escape`.
- Foco atrapado dentro del widget mientras esta abierto; al cerrar, vuelve al boton que lo abrio.
- Todos los botones iconicos tienen `aria-label`.
- Mensajes nuevos anuncian cambios con `aria-live="polite"`.
- Estados de carga usan `aria-busy`; botones bloqueados usan `aria-disabled`.
- Navegacion 100% por teclado: abrir, cerrar, escribir, enviar, adjuntar, menu tres puntos y elegir accion.
- Avatar/realtime con controles visibles: pausar animacion, silenciar, activar subtitulos/transcripcion y repetir ultimo mensaje.
- Respetar `prefers-reduced-motion`; animaciones no deben ser obligatorias.
- Contraste suficiente en modo claro y oscuro; foco visible y no solo por color.
- Inputs con etiquetas reales, no solo placeholders.
- Adjuntos y ubicacion tienen descripciones accesibles.

Tooltip/ayuda contextual sugerida:

```txt
Chatboc tambien esta pensado para personas que no pueden o no quieren escribir. Podes usar voz, subtitulos, lectura, adjuntos y derivacion humana para comunicarte con una institucion o empresa sin quedar afuera.
```

No mostrarlo como modal invasivo. Usar tooltip/ayuda contextual cerca del boton de voz/avatar y una entrada clara en el menu de accesibilidad.

## Copy por rubro

Si `experience_blueprint.experience_type === "education"` no usar textos municipales como:

- reclamos urbanos
- turnos municipales
- vecino
- tramites express municipales

Usar lenguaje escolar solo si backend lo publica:

- caso escolar
- secretaria
- familia
- alumno/curso
- inasistencia
- certificado
- comunicado

## QA compartida

1. Cambiar de Empresas a Colegios no conserva token/owner anterior.
2. El primer saludo de Colegios no menciona municipio.
3. Los tres botones del menu rapido envian `action_id` al backend y reciben respuesta real.
4. Adjuntar imagen/PDF despues de `justify_absence` crea caso escolar.
5. `talk_secretary` crea ticket visible para admin con estado `esperando_agente_en_vivo`.
6. PDFs demo abren desde `/api/v2/demo/catalog-assets/...` sin 404 SPA.
7. Widget se usa completo con teclado y lector de pantalla.
8. Avatar/realtime tiene transcripcion, pausa y modo reducido.
