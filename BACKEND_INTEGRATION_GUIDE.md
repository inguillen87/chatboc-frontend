# Guía de Integración Backend - Portal de Usuario

Este documento detalla los endpoints, formatos de respuesta y eventos de WebSocket necesarios para alimentar el Portal de Usuario (Cliente Final) de la plataforma Chatboc.

## 1. Contenido Unificado del Portal

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

El portal reutiliza la API del Market existente, pero requiere soporte de autenticación opcional (para usuarios invitados vs. registrados).

### Agregar al Carrito
**Endpoint:** `POST /public/market/:tenant_slug/carrito`

**Payload:**
```json
{
  "productId": "uuid-v4",
  "quantity": 1
}
```

### Obtener Carrito
**Endpoint:** `GET /public/market/:tenant_slug/carrito`

**Respuesta:**
```json
{
  "items": [
    {
      "id": "uuid-v4",
      "name": "Producto A",
      "price": 1500,
      "quantity": 2,
      "imageUrl": "..."
    }
  ],
  "totalAmount": 3000,
  "totalPoints": 0
}
```

## 3. WebSockets (Eventos en Tiempo Real)

El frontend se conecta al namespace `/socket.io` y se une a la room del tenant (`:tenant_slug`).

### Eventos Esperados (Emitidos por el Backend)

1.  **`tenant_content_update`**: Indica que hubo un cambio general en el contenido del portal. El frontend volverá a llamar a `GET /api/portal/:tenant_slug/content`.
2.  **`news_update`**: Cambio específico en noticias.
3.  **`events_update`**: Cambio específico en eventos.
4.  **`catalog_update`**: Cambio específico en el catálogo.

**Ejemplo de emisión (Python/Flask-SocketIO):**
```python
socketio.emit('tenant_content_update', {'timestamp': time.time()}, room=tenant_slug)
```

## 4. Notas de Implementación

*   **Autenticación:** El token JWT se envía en el header `Authorization`. Si no está presente, el backend debe asumir un usuario "invitado" y devolver contenido público genérico.
*   **Imágenes:** Se recomienda devolver URLs absolutas para `coverUrl` e `imageUrl`.
*   **Modo Demo:** Si el backend falla o devuelve error, el frontend automáticamente cambia a "Modo Demo" usando datos locales. Es vital que los endpoints respondan con códigos de error apropiados (4xx, 5xx) si fallan, para activar este fallback.
