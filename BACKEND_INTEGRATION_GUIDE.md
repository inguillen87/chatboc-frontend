# Guía de Integración Backend - Portal de Usuario

Este documento detalla los endpoints, formatos de respuesta y eventos de WebSocket necesarios para alimentar el Portal de Usuario (Cliente Final) de la plataforma Chatboc.

## 1. Contenido Unificado del Portal (Dashboard)

El frontend utiliza un endpoint centralizado para cargar el contenido inicial del portal.

**Endpoint:** `GET /api/portal/:tenant_slug/content`

**Cabeceras:**
*   `X-Tenant: <tenant_slug>` (Opcional, pero recomendado para redundancia)
*   `Authorization: Bearer <token>` (Si el usuario está logueado, para contenido personalizado)

**Respuesta Exitosa (200 OK):**

```json
{
  "notifications": [
    {
      "id": "uuid-v4",
      "title": "Recibe alertas personalizadas",
      "message": "Activa tus avisos para pedidos...",
      "severity": "info", // "info" | "success" | "warning" | "error"
      "actionLabel": "Configurar",
      "actionHref": "/portal/cuenta",
      "date": "Hace 2 h"
    }
  ],
  "events": [
    {
      "id": "uuid-v4",
      "title": "Sesión de onboarding",
      "date": "15/08/2024 · 18:00",
      "location": "Transmisión en vivo",
      "status": "inscripcion", // "inscripcion" | "proximo" | "finalizado"
      "description": "...",
      "spots": 200,
      "registered": 132,
      "coverUrl": "https://..."
    }
  ],
  "news": [
    {
      "id": "uuid-v4",
      "title": "Panel de usuario",
      "category": "plataforma",
      "date": "08/08/2024",
      "summary": "...",
      "featured": true,
      "coverUrl": "https://..."
    }
  ],
  "catalog": [
    {
      "id": "uuid-v4",
      "title": "Seguimiento de pedidos",
      "description": "...",
      "category": "gestiones",
      "priceLabel": "$ 1,500",
      "price": 1500, // IMPORTANTE: Valor numérico para el carrito
      "status": "available", // "available" | "coming_soon" | "paused"
      "imageUrl": "https://..."
    }
  ],
  "activities": [
    {
      "id": "uuid-v4",
      "description": "Revisaste el seguimiento...",
      "type": "Gestión",
      "status": "En seguimiento",
      "statusType": "info", // "info" | "success" | "warning" | "error"
      "date": "Hoy",
      "link": "/portal/pedidos"
    }
  ],
  "surveys": [
    {
      "id": "uuid-v4",
      "title": "Encuesta de satisfacción",
      "link": "/portal/encuestas"
    }
  ],
  "loyaltySummary": {
    "points": 1250,
    "level": "Oro",
    "surveysCompleted": 5,
    "suggestionsShared": 2,
    "claimsFiled": 1
  }
}
```

## 2. Carrito de Compras (Market API)

El portal reutiliza la API del Market existente.

### Rutas API

*   **Catálogo:** `GET /public/market/:tenant_slug/productos`
    *   Debe soportar query params `tenant` o `tenant_slug` para proxies.
*   **Carrito (Ver):** `GET /public/market/:tenant_slug/carrito`
*   **Carrito (Agregar):** `POST /public/market/:tenant_slug/carrito`
    *   Payload: `{"productId": "...", "quantity": 1}`
*   **Carrito (Remover):** `POST /public/market/:tenant_slug/carrito/remove`
    *   Payload: `{"productId": "..."}`
*   **Checkout (Iniciar):** `POST /public/market/:tenant_slug/checkout`
    *   Payload: `{"items": [...], "cliente": {...}, "envio": {...}}`

### Notas sobre Rutas

El frontend intentará usar `/api/municipio/carrito` si el slug es `municipio`, o `/api/junin/carrito` si el slug es `junin`.
El backend debe estar preparado para manejar el slug dinámico en la URL, o tener un rewrite rule que mapee `/api/:slug/...` a la lógica interna.

## 3. WebSockets (Eventos en Tiempo Real)

El frontend se conecta al namespace `/socket.io` y se une a la room del tenant (`:tenant_slug`).

### Eventos Esperados

1.  **`tenant_content_update`**: Indica que hubo un cambio general en el contenido del portal.
2.  **`news_update`**: Cambio específico en noticias.
3.  **`events_update`**: Cambio específico en eventos.
4.  **`catalog_update`**: Cambio específico en el catálogo.

**Ejemplo de emisión (Python/Flask-SocketIO):**
```python
socketio.emit('tenant_content_update', {'timestamp': time.time()}, room=tenant_slug)
```

## 4. Flujo de Usuario (Lifecycle)

1.  **Visitante:** Entra a `/portal/catalogo` (o `/catalogo`). Ve productos públicos.
2.  **Carrito:** Agrega productos. Se guardan en `localStorage` o en sesión anónima (`Anon-Id`).
3.  **Checkout:** Al confirmar, se le piden datos básicos.
    *   Si elige "Continuar", se registra el pedido.
    *   El frontend le ofrece "Crear cuenta para seguimiento" o "Iniciar Sesión".
4.  **Registro:** Al registrarse, el backend debe vincular el historial anónimo (usando `Anon-Id` o email coincidente) con el nuevo usuario.
5.  **Portal:** El usuario accede a `/portal/dashboard` y ve su pedido reciente en "Actividades".
