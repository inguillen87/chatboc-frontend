# Backend Requirements for User Portal

To fully power the User Portal and ensure synchronization across all channels (WhatsApp, Web Widget, Portal), the backend must provide the following endpoints.

All endpoints should be prefixed with `/api/v1/portal/:tenant_id`.
The `tenant_id` (or slug) determines the context (Municipality or SME).

Authentication:
- Most endpoints require a Bearer Token (JWT) representing the logged-in user.
- Public endpoints (if any) should still be scoped by `tenant_id`.

## 1. Consolidated Content (Dashboard)
**Endpoint:** `GET /content`
**Purpose:** Fetches a summary of data for the dashboard to minimize round trips.
**Response JSON:**
```json
{
  "notifications": [
    {
      "id": "notif_123",
      "title": "Claim Update",
      "message": "Your claim #456 has been resolved.",
      "severity": "info", // info, warning, success, error
      "date": "2023-10-27T10:00:00Z",
      "read": false,
      "actionLabel": "View Claim",
      "actionHref": "/portal/pedidos/456"
    }
  ],
  "news": [
    {
      "id": "news_1",
      "title": "Festival de Jazz",
      "summary": "Join us for the annual Jazz Festival.",
      "coverUrl": "https://example.com/image.jpg",
      "date": "2023-10-28",
      "category": "Cultura",
      "featured": true,
      "link": "/portal/noticias/news_1"
    }
  ],
  "events": [
    {
      "id": "evt_1",
      "title": "Vacunación Antirrábica",
      "date": "2023-11-01",
      "location": "Plaza Central",
      "status": "inscripcion", // inscripcion, proximo, finalizado
      "coverUrl": "https://example.com/event.jpg"
    }
  ],
  "loyaltySummary": {
    "points": 1250,
    "surveysCompleted": 5,
    "suggestionsShared": 2,
    "claimsFiled": 1
  },
  "activities": [
    {
        "id": "act_1",
        "type": "RECLAMO",
        "description": "Poste de luz caído",
        "date": "03/08/2024",
        "status": "Recibido",
        "statusType": "info"
    }
  ]
}
```

## 2. News (Novedades)
**Endpoint:** `GET /news`
**Query Params:** `page`, `limit`, `category`
**Response JSON:**
```json
{
  "data": [
    {
      "id": "news_1",
      "title": "Title",
      "summary": "Short description...",
      "content": "Full HTML or Markdown content...",
      "coverUrl": "...",
      "date": "2023-10-27",
      "category": "General",
      "author": "Admin",
      "featured": false
    }
  ],
  "meta": {
    "total": 100,
    "page": 1,
    "limit": 10
  }
}
```

## 3. Events (Eventos)
**Endpoint:** `GET /events`
**Query Params:** `page`, `limit`, `status` (upcoming, past)
**Response JSON:**
```json
{
  "data": [
    {
      "id": "evt_1",
      "title": "Event Title",
      "description": "Description...",
      "coverUrl": "...",
      "date": "2023-11-01T14:00:00Z",
      "location": "Address or Link",
      "spots": 100,
      "registered": 45,
      "status": "inscripcion",
      "user_registered": false // true if the current user is signed up
    }
  ]
}
```

## 4. Catalog (Catálogo/Trámites)
**Endpoint:** `GET /catalog`
**Purpose:** Lists available services, products, or administrative procedures.
**Response JSON:**
```json
{
  "data": [
    {
      "id": "cat_1",
      "title": "Solicitud de Poda",
      "description": "Request tree trimming service.",
      "category": "Servicios Urbanos",
      "imageUrl": "...",
      "priceLabel": "Gratuito", // or "$500"
      "status": "available",
      "formSchema": {} // Optional: JSON schema for the request form
    }
  ]
}
```

## 5. Notifications (Centro de Notificaciones)
**Endpoint:** `GET /notifications`
**Endpoint:** `POST /notifications/:id/read` (Mark as read)

## 6. User Profile & Loyalty
**Endpoint:** `GET /profile`
**Response JSON:**
```json
{
  "id": "user_123",
  "name": "Juan Perez",
  "email": "juan@example.com",
  "points": 1200,
  "level": "Gold",
  "preferences": {
    "notifications_email": true,
    "notifications_push": false
  }
}
```

## Integration Logic
- **WhatsApp:** The webhook handler should use the `tenant_id` associated with the phone number to fetch the same News/Events data and serve it via text/interactive messages.
- **Chat Widget:** The widget embeds the portal or specific flows. It should query these same endpoints using the `tenant_id` from the script tag configuration.
- **Admin Panel:** Changes made in the Admin Panel (creating news/events) must write to the database tables that back these endpoints.

## 7. Real-time Updates (Socket.IO)
To ensure the User Portal updates instantly when an Admin posts content, the backend must emit Socket.IO events to the tenant's room.

**Room Name:** `tenant_slug` (e.g., "municipio", "ferreteria")

**Events Emitted:**
*   `tenant_content_update`: Generic signal that something changed. Payload: `{ "type": "news_update" }`
*   `news_update`: Signal that news items have changed. Payload: New/Updated Post object.
*   `events_update`: Signal that events have changed. Payload: New/Updated Post object.
*   `catalog_update`: Signal that catalog items have changed. Payload: `{}` or Item object.

**Triggers:**
*   `POST /municipal/posts` (Create/Update News/Events).
*   `POST /api/admin/market/catalog` (Create Product).
*   `PUT /api/admin/market/catalog/:id` (Update Product).
*   `DELETE /api/admin/market/catalog/:id` (Delete Product).
*   `POST /catalogo/upload` (Bulk Upload).
