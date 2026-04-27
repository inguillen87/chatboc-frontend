# Chatboc Frontend v2 — Guía técnica para Codex

## Objetivo

Elevar el frontend real de Chatboc a una experiencia SaaS más clara, vendible y operativa **sin migrar de stack**.

El frontend actual ya tiene valor: React/Vite, rutas, demo, widget, tenant discovery, Google OAuth, `apiFetch`, componentes de chat, tickets y encuestas. La tarea no es rehacerlo con Next.js, sino ordenarlo por features, reducir drift con backend y conectar progresivamente con `/api/v2`.

## Stack real que debe respetarse

- React
- Vite
- TypeScript
- Tailwind CSS
- shadcn/ui si ya está presente
- React Router o routing actual
- React Query si ya está presente
- stores/contextos existentes
- `apiFetch` existente como base
- Widget embebible actual

## Reglas no negociables

1. **No migrar a Next.js.**
2. **No reescribir toda la app.**
3. **No romper el widget.**
4. **No romper `/demo`, `/demo/:slug`, login ni rutas actuales.**
5. **No eliminar fallbacks legacy hasta que backend v2 esté completo.**
6. **Todo código nuevo debe ser tipado.**
7. **No agregar librerías grandes sin justificación.**
8. **La UX debe mostrar estados vacíos profesionales, no pantallas rotas.**

---

# Archivos que Codex debe inspeccionar primero

Antes de modificar código, inspeccionar:

```text
src/App.tsx
src/routesConfig.tsx
src/utils/api.ts
src/api/tenant.ts
src/pages/Demo.tsx
src/pages/DemoLandingPage.tsx
src/components/auth/GoogleLoginButton.tsx
src/components/
src/context/
src/store/
src/pages/admin/
src/pages/municipal/
src/pages/pyme/
src/types/
package.json
README.md
docs/
```

Buscar también:

```text
widget
iframe
ticket
encuesta
survey
analytics
tenant
apiFetch
GoogleLogin
chat
Socket
```

---

# Diagnóstico de base

Chatboc ya tiene:

- demo pública;
- demo por slug;
- widget embebible;
- tenant discovery;
- headers de entidad/tenant;
- Google OAuth;
- panel admin;
- tickets;
- encuestas;
- páginas municipales;
- páginas PyME;
- analytics prototipo;
- catálogo/productos;
- integración con rutas legacy.

El problema principal es **acoplamiento y dispersión**:

- `apiFetch` concentra demasiadas responsabilidades;
- tenant discovery tiene demasiados fallbacks;
- demo y landing demo duplican lógica;
- chat/widget/panel usan contratos parcialmente distintos;
- Google login usa opciones que pueden no estar tipadas;
- tickets, encuestas y analytics necesitan contratos v2 claros;
- el demo no vende todo el potencial SaaS.

---

# Arquitectura frontend objetivo

## Estructura por features

Crear gradualmente:

```text
src/api/
  v2/
    client.ts
    auth.ts
    tenants.ts
    demo.ts
    chat.ts
    tickets.ts
    surveys.ts
    analytics.ts
    contacts.ts
    webhooks.ts

src/features/
  demo/
    DemoWorkspace.tsx
    DemoSectorStep.tsx
    DemoRubroStep.tsx
    DemoValueCards.tsx
    DemoChatPreview.tsx
    demoTypes.ts
    demoApi.ts

  chat/
    ChatPanel.tsx
    ChatMessageList.tsx
    ChatComposer.tsx
    QuickReplies.tsx
    HandoffBanner.tsx
    ConversationRating.tsx
    ChatEmptyState.tsx
    chatTypes.ts
    chatApi.ts

  tickets/
    TicketsBoardPage.tsx
    TicketsTable.tsx
    TicketsKanban.tsx
    TicketDetailDrawer.tsx
    TicketSlaBadge.tsx
    TicketFilters.tsx
    ticketTypes.ts
    ticketsApi.ts

  surveys/
    SurveysPage.tsx
    SurveyBuilderPage.tsx
    SurveyQuestionEditor.tsx
    SurveyPreview.tsx
    SurveyPublishDialog.tsx
    SurveyAnalyticsPanel.tsx
    surveyTypes.ts
    surveysApi.ts

  analytics/
    AnalyticsHubPage.tsx
    KpiCard.tsx
    AnalyticsFilters.tsx
    analyticsTypes.ts
    analyticsApi.ts

  crm/
    ContactsPage.tsx
    ContactDetailDrawer.tsx
    ContactTimeline.tsx
    contactTypes.ts
    contactsApi.ts

  settings/
    SettingsPage.tsx
    IntegrationsPage.tsx
    WebhooksPage.tsx
```

No mover todo de golpe. Crear wrappers compatibles.

---

# API client v2

## Objetivo

Reducir complejidad de `src/utils/api.ts` sin romperlo.

Crear:

```text
src/api/v2/client.ts
```

Debe envolver `apiFetch`, no reemplazarlo de golpe.

## Contrato sugerido

```ts
export type V2ApiOptions = {
  tenantSlug?: string;
  accessToken?: string;
  demoSessionId?: string;
  widgetSessionId?: string;
  anonId?: string;
  signal?: AbortSignal;
  fallbackLegacy?: boolean;
};

export async function v2ApiFetch<T>(
  path: string,
  options?: {
    method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
    body?: unknown;
    headers?: Record<string, string>;
    context?: V2ApiOptions;
  }
): Promise<T> {
  // usar apiFetch actual
  // prefijar /api/v2
  // agregar X-Tenant-Slug si existe
  // no inventar tenant
}
```

## Clientes por dominio

```text
src/api/v2/auth.ts
src/api/v2/demo.ts
src/api/v2/tickets.ts
src/api/v2/surveys.ts
src/api/v2/analytics.ts
```

Ejemplo:

```ts
export async function getDemoCatalog() {
  return v2ApiFetch<DemoCatalogResponse>("/demo/catalog");
}

export async function createDemoSession(input: CreateDemoSessionInput) {
  return v2ApiFetch<CreateDemoSessionResponse>("/demo/session", {
    method: "POST",
    body: input,
  });
}
```

## Reglas

- `v2ApiFetch` no debe hacer tenant fallback implícito.
- Si falta tenant en operación tenant-aware, devolver error controlado.
- Los fallbacks legacy deben ser explícitos y locales.
- No ocultar errores de contrato.
- Tipar respuestas.

---

# Fase 1 — Frontend foundation v2

## Objetivo

Preparar estructura y API v2 sin romper app.

## Tareas

1. Crear `src/api/v2/client.ts`.
2. Crear `src/api/v2/demo.ts`.
3. Crear `src/api/v2/auth.ts`.
4. Crear tipos base.
5. Corregir drift en GoogleLoginButton/apiFetch.
6. Agregar `docs/frontend-v2.md`.
7. Mantener compatibilidad con rutas actuales.

---

## GoogleLoginButton

Revisar:

```text
src/components/auth/GoogleLoginButton.tsx
src/utils/api.ts
```

Si `GoogleLoginButton` pasa opciones no declaradas a `apiFetch`, corregir.

Opciones:

1. agregar opción tipada si realmente se usa:

```ts
sendEntityToken?: boolean;
```

2. o removerla si no tiene efecto.

Prioridad: TypeScript limpio y login no roto.

Endpoint preferido:

```text
POST /api/v2/auth/google
```

Fallback temporal:

```text
POST /api/google-login
```

---

## Rutas

Actualizar `src/routesConfig.tsx` sin romper rutas existentes.

Agregar o consolidar:

```text
/demo
/demo/:slug
/tickets
/surveys
/analytics
/crm
/settings
```

Si ya existen rutas equivalentes, crear wrappers o redirects suaves.

Usar lazy loading:

```tsx
const DemoWorkspace = lazy(() => import("@/features/demo/DemoWorkspace"));
const TicketsBoardPage = lazy(() => import("@/features/tickets/TicketsBoardPage"));
const SurveyBuilderPage = lazy(() => import("@/features/surveys/SurveyBuilderPage"));
const AnalyticsHubPage = lazy(() => import("@/features/analytics/AnalyticsHubPage"));
```

---

# Fase 2 — Demo SaaS vendible

## Problema

El demo debe mostrar valor de producto, no solo un chat. Tiene que permitir probar:

- sector gobierno;
- sector empresas;
- rubro;
- chat;
- tickets;
- encuestas;
- WhatsApp;
- analytics;
- CRM/contactos;
- handoff humano.

## Flujo v2

```text
/demo
  -> elegir sector
  -> elegir rubro
  -> crear sesión demo
  -> abrir workspace demo
  -> mostrar chat + quick replies + módulos de valor
```

## Componentes

```text
src/features/demo/DemoWorkspace.tsx
src/features/demo/DemoSectorStep.tsx
src/features/demo/DemoRubroStep.tsx
src/features/demo/DemoValueCards.tsx
src/features/demo/DemoChatPreview.tsx
```

## Estados

```ts
type DemoSector = "gobierno" | "empresas";

type DemoWorkspaceState = {
  sector: DemoSector | null;
  rubro: string | null;
  demoSessionId: string | null;
  tenantSlug: string | null;
  quickReplies: string[];
};
```

## Quick replies

### Gobierno

```text
Quiero hacer un reclamo
Consultar estado de un trámite
Ver encuestas disponibles
Ver eventos municipales
Hablar con una persona
```

### Empresas

```text
Consultar precios
Ver productos
Pedir presupuesto
Consultar estado de pedido
Hablar con ventas
```

## Tarjetas de valor

Mostrar en `DemoValueCards`:

```text
Chat inteligente
Tickets y reclamos
Encuestas/opinar.ar
WhatsApp
CRM/contactos
Analytics
Handoff humano
```

Cada tarjeta debe tener:

- título;
- descripción corta;
- estado demo;
- CTA interno si aplica.

## Integración API

Primero intentar:

```text
GET  /api/v2/demo/catalog
POST /api/v2/demo/session
```

Fallback:

- rubros actuales;
- endpoints demo legacy;
- datos mock locales si backend no está listo.

Pero el usuario debe ver algo útil siempre.

---

# Fase 3 — Chat UI v2 y widget

## Objetivo

Crear una UI de conversación reutilizable por:

- demo;
- widget público;
- panel/admin live chat;
- encuestas post-ticket;
- futuras integraciones WhatsApp.

## Componentes

```text
src/features/chat/ChatPanel.tsx
src/features/chat/ChatMessageList.tsx
src/features/chat/ChatComposer.tsx
src/features/chat/QuickReplies.tsx
src/features/chat/HandoffBanner.tsx
src/features/chat/ConversationRating.tsx
src/features/chat/ChatEmptyState.tsx
```

## Tipos

```ts
export type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "operator" | "system";
  content: string;
  createdAt: string;
  status?: "sending" | "sent" | "failed";
};

export type QuickReply = {
  id: string;
  label: string;
  payload?: Record<string, unknown>;
};

export type HandoffState = {
  required: boolean;
  reason?: string;
  availableChannels: Array<"ticket" | "whatsapp" | "live_chat">;
};
```

## UX obligatoria

- estado vacío con sugerencias;
- chips de quick replies;
- fallback si API falla;
- botón “hablar con una persona”;
- CTA para crear ticket;
- CTA WhatsApp si tenant lo tiene;
- rating de conversación;
- loading claro;
- error claro.

## Handoff

Mostrar `HandoffBanner` si:

- backend devuelve `handoff_required`;
- usuario pide humano;
- error repetido de IA/API;
- confianza baja;
- endpoint no responde.

No fingir live chat si no existe. Mostrar:

```text
Podemos crear un ticket o derivarte por WhatsApp.
```

## Widget

No romper atributos existentes:

```text
data-theme
data-domain
data-rubro
data-default-open
data-width
data-height
data-bottom
data-right
data-shadow-dom
```

Si se agrega atributo, documentarlo:

```text
data-sector
data-demo-session
data-tenant-slug
```

## Accesibilidad

- `aria-label` en botones;
- foco visible;
- navegación por teclado;
- contraste razonable;
- no usar solo íconos;
- `role="dialog"` si el widget abre modal/panel.

---

# Fase 4 — Tickets UI v2

## Objetivo

Convertir tickets en módulo operativo tipo CRM/reclamos.

## Componentes

```text
src/features/tickets/TicketsBoardPage.tsx
src/features/tickets/TicketsTable.tsx
src/features/tickets/TicketsKanban.tsx
src/features/tickets/TicketDetailDrawer.tsx
src/features/tickets/TicketSlaBadge.tsx
src/features/tickets/TicketFilters.tsx
```

## API

```text
GET    /api/v2/tickets
POST   /api/v2/tickets
GET    /api/v2/tickets/:id
PATCH  /api/v2/tickets/:id
POST   /api/v2/tickets/:id/comments
GET    /api/v2/tickets/:id/events
```

## Tipos

```ts
export type TicketStatus =
  | "open"
  | "in_progress"
  | "waiting_customer"
  | "waiting_internal"
  | "resolved"
  | "closed"
  | "cancelled"
  | "escalated";

export type TicketPriority = "low" | "medium" | "high" | "urgent";

export type Ticket = {
  id: string | number;
  title: string;
  description?: string;
  status: TicketStatus;
  priority: TicketPriority;
  category?: string;
  channel?: "web" | "widget" | "whatsapp" | "manual";
  assignee?: {
    id: string | number;
    name: string;
  };
  slaDueAt?: string | null;
  createdAt: string;
};
```

## Filtros

- estado;
- prioridad;
- categoría;
- operador;
- SLA;
- canal;
- fecha;
- búsqueda.

## SLA Badge

Estados:

```text
ok
due_today
overdue
paused
no_policy
```

UX:

- rojo si vencido;
- amarillo si vence hoy;
- gris si pausado;
- no bloquear si `slaDueAt` es null.

## Estados vacíos

- “Todavía no hay tickets.”
- “No hay tickets con estos filtros.”
- “La API de tickets v2 todavía no está disponible.”

Nunca pantalla rota.

---

# Fase 5 — Encuestas/opinar.ar frontend

## Objetivo

Crear un builder visual y panel de respuestas para encuestas.

## Componentes

```text
src/features/surveys/SurveysPage.tsx
src/features/surveys/SurveyBuilderPage.tsx
src/features/surveys/SurveyQuestionEditor.tsx
src/features/surveys/SurveyPreview.tsx
src/features/surveys/SurveyPublishDialog.tsx
src/features/surveys/SurveyAnalyticsPanel.tsx
```

## API

```text
GET    /api/v2/surveys
POST   /api/v2/surveys
GET    /api/v2/surveys/:id
PATCH  /api/v2/surveys/:id
POST   /api/v2/surveys/:id/publish
POST   /api/v2/surveys/:id/close
GET    /api/v2/surveys/:id/analytics

GET    /api/v2/public/surveys/:publicToken
POST   /api/v2/public/surveys/:publicToken/respond
```

## Tipos de pregunta

```text
single
multi
rating
text
nps
ranking
location
```

## UX builder

Debe permitir:

- título;
- descripción;
- agregar pregunta;
- reordenar preguntas;
- editar opciones;
- marcar requerida;
- preview;
- guardar draft;
- publicar;
- cerrar encuesta.

## Preview

Tabs:

```text
Web
Widget
WhatsApp
```

No hace falta implementación perfecta de WhatsApp en PR inicial; puede ser preview textual.

## Analytics encuesta

Mostrar:

- total respuestas;
- tasa de completitud;
- promedio rating;
- NPS si aplica;
- distribución por opción;
- comentarios recientes;
- fuente de respuesta.

---

# Fase 6 — Analytics hub

## Objetivo

Unificar panel de KPIs para SaaS.

## Ruta

```text
/analytics
```

## Componentes

```text
src/features/analytics/AnalyticsHubPage.tsx
src/features/analytics/KpiCard.tsx
src/features/analytics/AnalyticsFilters.tsx
src/features/analytics/analyticsApi.ts
```

## API

```text
GET /api/v2/analytics/overview
GET /api/v2/analytics/tickets
GET /api/v2/analytics/surveys
GET /api/v2/analytics/funnel
```

## KPIs mínimos

```text
Conversaciones
Tickets abiertos
Tickets vencidos
Tiempo promedio de primera respuesta
Tiempo promedio de resolución
Respuestas de encuestas
Satisfacción / CSAT
NPS
Handoff rate
```

## Estado vacío

Si no hay datos:

```text
Todavía no hay suficientes datos para mostrar métricas.
Cuando empiecen a llegar conversaciones, tickets y encuestas, vas a ver los indicadores acá.
```

---

# Fase 7 — CRM/contactos

## Objetivo

Crear base visual de CRM conversacional.

## Ruta

```text
/crm
```

## Componentes

```text
src/features/crm/ContactsPage.tsx
src/features/crm/ContactDetailDrawer.tsx
src/features/crm/ContactTimeline.tsx
```

## API

```text
GET   /api/v2/contacts
POST  /api/v2/contacts
GET   /api/v2/contacts/:id
PATCH /api/v2/contacts/:id
GET   /api/v2/contacts/:id/timeline
```

## UX

Mostrar:

- nombre;
- email;
- teléfono;
- tags;
- última interacción;
- tickets vinculados;
- encuestas respondidas;
- conversaciones.

---

# Fase 8 — Settings e integraciones

## Rutas

```text
/settings
/settings/integrations
/settings/webhooks
/settings/widget
/settings/billing
```

## Integraciones a mostrar

- WhatsApp/Twilio;
- Google OAuth;
- Webhooks;
- Mercado Pago;
- SMTP/email;
- Widget embed;
- API keys públicas.

## Widget settings

Mostrar snippet con:

```html
<script
  src="https://chatboc.ar/widget.js"
  data-domain="https://chatboc.ar"
  data-tenant-slug="TENANT"
  data-rubro="RUBRO"
></script>
```

No mostrar tokens reales si no corresponde.

---

# Manejo de errores UX

Crear helper común:

```text
src/components/common/ApiErrorState.tsx
src/components/common/EmptyState.tsx
src/components/common/LoadingState.tsx
```

Errores a manejar:

```text
401 sesión vencida
403 sin permisos
404 tenant/recurso no encontrado
409 conflicto
429 rate limit
500 backend caído
TypeError Failed to fetch / CORS
```

Mensajes sobrios, no técnicos para usuario final. Logs técnicos solo en consola/dev.

---

# Accesibilidad

Checklist:

- [ ] Botones con texto o `aria-label`.
- [ ] Inputs con `label`.
- [ ] Modales con foco inicial.
- [ ] Escape cierra drawer/modal.
- [ ] Tab navega correctamente.
- [ ] Contraste suficiente.
- [ ] No depender solo de color.
- [ ] Widget usable con teclado.
- [ ] `prefers-reduced-motion` respetado donde haya animaciones.

---

# QA frontend

## Build

```bash
npm run build
```

Debe pasar.

## Typecheck

Si existe:

```bash
npm run typecheck
```

Si no existe, evaluar agregar script.

## Tests

Si existe Vitest/Jest:

```bash
npm test
```

Agregar tests mínimos para:

- DemoSectorStep;
- QuickReplies;
- TicketSlaBadge;
- SurveyQuestionEditor;
- v2ApiFetch header tenant.

## E2E futuro

Agregar Playwright si no existe.

Flujos:

1. `/demo` gobierno:
   - elegir sector;
   - elegir rubro;
   - ver chat;
   - usar quick reply.

2. `/demo` empresas:
   - elegir sector;
   - elegir rubro;
   - pedir presupuesto.

3. Widget:
   - abrir burbuja;
   - ver chat;
   - cerrar.

4. Login:
   - credenciales inválidas;
   - error visible.

5. Tickets:
   - ver empty state o lista;
   - aplicar filtro.

6. Encuestas:
   - crear draft o ver empty state.

---

# Prompt general para Codex — Frontend

Usar este prompt al arrancar la implementación:

```text
Trabajá sobre el repo inguillen87/chatboc-frontend.

Objetivo: elevar el frontend real de Chatboc a una estructura SaaS v2 sin cambiar de stack.

Stack real obligatorio:
- React
- Vite
- TypeScript
- Tailwind/shadcn si ya está presente

No migres a Next.js.
No reescribas toda la app.
No rompas el widget, /demo, /demo/:slug, login ni rutas existentes.

Leé primero:
- src/App.tsx
- src/routesConfig.tsx
- src/utils/api.ts
- src/api/tenant.ts
- src/pages/Demo.tsx
- src/pages/DemoLandingPage.tsx
- src/components/auth/GoogleLoginButton.tsx
- componentes de chat/widget/tickets/encuestas
- package.json
- README/docs

Implementá por fases:
1. crear src/api/v2/client.ts y clientes demo/auth;
2. corregir drift GoogleLoginButton/apiFetch;
3. crear estructura src/features/demo;
4. unificar /demo en DemoWorkspace con sector -> rubro -> sesión demo -> chat;
5. crear ChatPanel reusable con quick replies, handoff y rating;
6. preparar tickets/surveys/analytics con API v2 y fallback legacy explícito;
7. mantener estados vacíos profesionales;
8. documentar en docs/frontend-v2.md.

Restricciones:
- No eliminar páginas existentes sin wrapper compatible.
- No romper build TypeScript.
- No agregar dependencias grandes sin justificación.
- No inventar tenant si no existe.
- No ocultar errores importantes.
- No romper widget ni atributos data-* existentes.

Criterios de aceptación:
- npm run build pasa.
- /demo funciona.
- /demo/:slug sigue funcionando.
- widget sigue abriendo y cerrando.
- Google login no queda con errores de tipos.
- tickets/surveys/analytics muestran lista o empty state sin romper.
- código nuevo agrupado por features.
- docs/frontend-v2.md actualizado.

Al terminar:
- listá archivos modificados;
- comandos ejecutados;
- tests/build;
- fallbacks legacy activos;
- riesgos pendientes.
```

---

# Roadmap recomendado para PRs frontend

## PR 1

```text
Frontend v2 API client + demo foundation
```

Incluye:

- `src/api/v2/client.ts`;
- `src/api/v2/demo.ts`;
- `src/api/v2/auth.ts`;
- fix GoogleLoginButton;
- docs.

## PR 2

```text
DemoWorkspace + ChatPanel reusable
```

Incluye:

- wizard sector/rubro;
- demo session;
- quick replies;
- handoff;
- rating;
- tarjetas de valor.

## PR 3

```text
Tickets UI v2
```

Incluye:

- board/table;
- filters;
- SLA badge;
- detail drawer;
- v2 API/fallback.

## PR 4

```text
Surveys builder v2
```

Incluye:

- builder;
- preview;
- publish dialog;
- analytics panel básico.

## PR 5

```text
Analytics hub + CRM shell
```

Incluye:

- KPI cards;
- filters;
- contacts page;
- timeline placeholder.

## PR 6

```text
Widget hardening + accessibility + E2E
```

Incluye:

- widget compatibility;
- accessibility;
- Playwright básico;
- error states.

---

# Documentación que debe quedar en el repo frontend

Crear o actualizar:

```text
docs/frontend-v2.md
docs/widget-v2.md
docs/demo-v2.md
docs/frontend-qa.md
```

## `docs/frontend-v2.md`

Debe incluir:

- estructura por features;
- API v2 client;
- rutas;
- fallbacks legacy;
- cómo correr build/tests.

## `docs/widget-v2.md`

Debe incluir:

- atributos soportados;
- snippet;
- permisos;
- limitaciones;
- compatibilidad.

## `docs/demo-v2.md`

Debe incluir:

- flujo sector/rubro;
- demo session;
- quick replies;
- cómo configurar tenants demo.

---

# Resultado esperado

Después de estas fases, el frontend debe quedar con:

- estructura por features;
- API v2 tipada;
- demo vendible;
- chat reusable;
- widget preservado;
- tickets con SLA visible;
- encuestas con builder;
- analytics hub;
- CRM shell;
- mejor accesibilidad;
- build TypeScript estable;
- menor dependencia de rutas legacy.
