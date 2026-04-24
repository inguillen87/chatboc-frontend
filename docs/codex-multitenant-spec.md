# Especificación técnica para Codex – Refactor multitenant y widget

Este documento consolida los hallazgos reales y las acciones recomendadas para estabilizar la plataforma Chatboc como SaaS multitenant. Incluye los errores reproducidos hoy, rutas que fallan, causas probables, cambios en backend/frontend, rediseño de roles y marketplace, y un plan de ejecución listo para Codex.

## 0. Objetivo de plataforma
- Widget externo configurable por tenant (demo municipios/empresas) con login real y token persistente.
- Marketplace público + panel admin por tenant, con catálogo, carrito, puntos y pagos.
- Separación clara de vecinos/clientes vs. empleados/admins, con visibilidad de tickets por categoría.
- Pantalla de integración que genere el script del widget listo para copiar/pegar.
- Pipeline de conversación (texto/audio/emojis) que cree tickets automáticos cuando corresponda.

Repos y dominios activos:
- Frontend SaaS: chatboc-frontend (https://www.chatboc.ar/)
- Backend: chatbot-backend (Flask, https://<backend>.onrender.com/)
- Demo widget externo: https://chatboc-demo-widget-oigs.vercel.app/junin/municipiojunin.html

## 1. Reglas globales de multitenancy
- Toda petición debe incluir el tenant (slug o ID); nada crítico debe funcionar sin tenant.
- Backend: middleware `require_tenant` que lea en orden `X-Tenant`, `?tenant`, `/<tenant_slug>/` y devuelva 400 {error:"tenant requerido"} si falta.
- Frontend y widget: enviar siempre `X-Tenant` o `?tenant=<slug>` en fetch. El script embed recibe `data-tenant`.

Ejemplo de embed listo para copiar:
```html
<script
  src="https://cdn.chatboc.ar/widget.js"
  data-tenant="junin"
  data-primary-color="#009846"
  data-avatar="https://cdn.chatboc.ar/avatars/junin.png"
></script>
```

## 2. Módulo Widget externo + login real
### 2.1 Errores reproducidos hoy
En la demo `municipiojunin.html` el login falla con mensajes en DevTools:
- `[Violation] Potential permissions policy violation: identity-credentials-get is not allowed`
- `TypeError: Cannot assign to read-only property 'trunk' of object '#<Window>'`
- `TypeError: Cannot assign to read-only property 'params' of object '#<Window>'`

Interpretación: el script del widget intenta mutar propiedades de `window` o de un objeto inmutable, y el token no queda accesible fuera del iframe.

### 2.2 Objetivo funcional
- Widget carga estilos/avatar por tenant.
- Login (email/password o Google) contra backend real.
- Al loguear: guardar JWT, reenviarlo al host externo y enviar `Authorization` + `X-Tenant` en todas las llamadas.

### 2.3 Cambios recomendados (widget.js / iframe.js)
- Eliminar mutaciones de `window.*`; usar objeto interno `widgetConfig` (tenant, base/frontend/backend URLs).
- Implementar `apiFetch(path, options)` que agregue `X-Tenant` y `Authorization` si hay token.
- Token bridge con `postMessage` para persistir sesión fuera del iframe:
  - En widget (iframe):
    ```js
    function onLoginSuccess(token) {
      localStorage.setItem("auth_token", token);
      window.parent.postMessage({ type: "CHATBOC_AUTH_TOKEN", token }, "*");
    }
    ```
  - En host externo:
    ```js
    window.addEventListener("message", (event) => {
      if (event.data?.type === "CHATBOC_AUTH_TOKEN") {
        localStorage.setItem("chatboc_auth_token", event.data.token);
      }
    });
    ```
- Revisar uso de Google Identity/FedCM solo en HTTPS y con dominios permitidos.

## 3. Marketplace público y admin
### 3.1 Problemas actuales
- Rutas `/productos` y `/carrito` responden 400 "tenant requerido".
- No existe URL pública clara por tenant para catálogo/carrito.

### 3.2 Arquitectura deseada
Rutas frontend por tenant:
- Pública: `/{tenant}/market`
- Detalle: `/{tenant}/product/:slug`
- Checkout: `/{tenant}/checkout`
- Admin catálogo: `/admin/{tenant}/catalogo`

Rutas backend con middleware de tenant:
- `GET /api/<tenant_slug>/productos`
- `GET /api/<tenant_slug>/productos/<id_or_slug>`
- `POST/GET /api/<tenant_slug>/carrito`
- `POST /api/<tenant_slug>/checkout/mercadopago`
- `POST /api/<tenant_slug>/webhook/mercadopago`

Modelos mínimos: `Tenant`, `Producto`, `Pedido` (incluye `tenant_id`, `estado`, `puntos_usados`, `mp_preference_id`).

Frontend: crear páginas `[tenant]/market`, `[tenant]/product/[slug]`, `[tenant]/checkout` con `CartContext` por tenant y llamadas via `apiFetch` con `X-Tenant`.

## 4. Roles, empleados y tickets por categoría
### 4.1 Problema actual
- Tabla de usuarios mezcla vecinos/empleados; no hay roles fuertes ni visibilidad por categoría.

### 4.2 Modelo propuesto
- `Role` (citizen, agent, tenant_admin, platform_admin)
- `UserRole` (user_id, role_id, tenant_id opcional)
- `TicketCategory` (por tenant)
- `EmployeeCategoryAccess` (user_id, category_id)

### 4.3 Lógica de visibilidad de tickets
- `agent`: tickets del mismo tenant y categorías asignadas.
- `tenant_admin`: todos los tickets del tenant.
- `citizen`: solo sus tickets.

### 4.4 UI de Empleados (admin)
- Crear/editar empleado con: nombre, email, rol (agent/tenant_admin), categorías asignadas (checkbox múltiple). Persistir en `UserRole` + `EmployeeCategoryAccess`.

## 5. Pantalla de Integración (widget SaaS)
Objetivo: en el admin SaaS, sección “Integración” que permita configurar y previsualizar el widget por tenant y genere el script listo para copiar.

Modelo `WidgetSettings` (por tenant): colores, avatar, posición, mensaje de bienvenida. El `widget.js` debe leer `data-*` y aplicar estilo.

Ejemplo de embed generado:
```html
<script
  src="https://cdn.chatboc.ar/widget.js"
  data-tenant="junin"
  data-primary-color="#009846"
  data-secondary-color="#ffffff"
  data-avatar="https://cdn.chatboc.ar/avatars/juni.png"
  data-position="bottom-right"
  data-welcome="Hola, soy JUNI. ¿En qué puedo ayudarte?"
></script>
```

## 6. Pipeline de conversación (texto/audio/emojis)
- Entrada: mensaje texto o audio (speech-to-text), capturar emojis y sentimiento.
- Proceso: detección de intención (reclamo, sugerencia, compra, consulta) → prioridad si enojo/frustración → resolver con FAQ/intent o crear Ticket con categoría.
- Salida: tickets automáticos con transcripción y metadata (intención, emojis relevantes) visibles para empleados del tenant.

## 7. Plan de implementación por fases (orden recomendado)
1) Multitenancy consistente: middleware `require_tenant`; frontend/widget enviando `X-Tenant`.
2) Widget externo + login: refactor `widget.js/iframe.js`, `apiFetch`, `postMessage` de token; re-probar en `municipiojunin.html`.
3) Marketplace público/admin: endpoints `/<tenant>/productos` + páginas `[tenant]/market`, product, checkout con `CartContext` por tenant.
4) Roles y tickets: tablas de roles/categorías, filtros de tickets por rol/categoría, UI de empleados.
5) Integración: modelo `WidgetSettings`, UI con preview y script embed.
6) Conversación avanzada: pipeline de intención/sentimiento y creación automática de tickets.

Este spec puede copiarse directamente en prompts de Codex para implementar los cambios en frontend y backend.
