# Portal de usuario: contrato esperado desde backend

La app es multi-tenant y muestra exactamente lo que entregue el backend. Para conectar un backend real, estas son las estructuras que la UI espera.

## Endpoint principal de contenido
- **Ruta**: `GET /api/{tenant_slug}/portal-content?tenant_slug={tenant_slug}&tenant={tenant_slug}`
- **Respuesta**: objeto JSON con los siguientes campos (todas las listas pueden venir vacías). Los IDs deben ser únicos por elemento.

```jsonc
{
  "notifications": [
    {
      "id": "notif-01",
      "title": "string",
      "message": "string",
      "severity": "info|success|warning|error", // opcional
      "actionLabel": "string", // opcional
      "actionHref": "/ruta-o-url", // opcional
      "date": "string" // ej: "2024-08-10 12:00" o texto legible
    }
  ],
  "events": [
    {
      "id": "event-01",
      "title": "string",
      "date": "string",
      "location": "string",
      "status": "inscripcion|proximo|finalizado",
      "description": "string",
      "spots": 120, // opcional
      "registered": 45, // opcional
      "coverUrl": "https://..." // opcional
    }
  ],
  "news": [
    {
      "id": "news-01",
      "title": "string",
      "category": "string",
      "date": "string",
      "summary": "string",
      "link": "https://...", // opcional
      "featured": true, // opcional
      "coverUrl": "https://..." // opcional
    }
  ],
  "catalog": [
    {
      "id": "catalog-01",
      "title": "string",
      "description": "string",
      "category": "string",
      "priceLabel": "string", // opcional
      "status": "available|coming_soon|paused", // opcional
      "imageUrl": "https://..." // opcional
    }
  ],
  "activities": [
    {
      "id": "activity-01",
      "description": "string",
      "type": "string",
      "status": "string", // opcional
      "statusType": "success|warning|info|error", // opcional
      "date": "string", // opcional
      "link": "/ruta" // opcional
    }
  ],
  "surveys": [
    {
      "id": "survey-01",
      "title": "string",
      "link": "/ruta-o-url"
    }
  ],
  "loyaltySummary": {
    "points": 0,
    "surveysCompleted": 0,
    "suggestionsShared": 0,
    "claimsFiled": 0
  }
}
```

> Si algún bloque viene vacío, la UI muestra data demo local; al devolver datos reales, la demo se reemplaza automáticamente.

## Cómo sincronizar catálogos, eventos y noticias
- Publicar en este endpoint con la data normalizada anterior. Al actualizar la respuesta, el frontend cachea la versión más reciente en localStorage pero siempre prioriza los datos frescos.
- Para que llegue a todos los usuarios de un tenant (portal web, widget de chat, enlaces por WhatsApp), basta con servir la misma respuesta por `tenant_slug`.
- Recomendado: exponer `lastUpdatedAt` en la respuesta para invalidar caches cuando cambie el contenido.

## Notificaciones y recordatorios
- Los botones (`actionLabel` + `actionHref`) permiten abrir reclamos, pedidos, encuestas o links externos.
- La severidad (`info|success|warning|error`) controla el color del badge en las tarjetas.
- Puedes disparar las mismas notificaciones vía push, email, WhatsApp o el widget usando el mismo cuerpo que consume el portal.

## Consideraciones multi-tenant
- La UI siempre envía `tenant_slug` y `tenant` en los query params para que el backend identifique al inquilino.
- No se debe personalizar texto en el frontend: cualquier copy específico se debe entregar en la respuesta JSON.
- Mantén URLs relativas dentro del tenant (`/portal/...`) o absolutas si apuntan a otros servicios.
