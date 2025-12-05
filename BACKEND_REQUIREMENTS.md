# Backend Requirements for User Portal & Public Site

To fully power the User Portal and ensure synchronization across all channels (WhatsApp, Web Widget, Portal), the backend must provide the following endpoints.

## Base URL Strategy
- **Public API:** `/api/public/...` (Accessible without auth, scoped by `tenantSlug` query param or URL path)
- **User Portal API:** `/api/v1/portal/:tenant_id/...` (Requires User Auth Token)

## 1. Public Tenant Data (Landing Page / Widget / Guest Mode)
These endpoints drive the `TenantHomePage` and the Chat Widget before login.

**Endpoint:** `GET /api/public/tenant?tenant_slug=:slug`
**Purpose:** Basic branding and configuration.
**Response:**
```json
{
  "slug": "municipio-demo",
  "nombre": "Municipio Demo",
  "logo_url": "...",
  "tipo": "municipio", // or "pyme"
  "tema": { "primaryColor": "#...", "secondaryColor": "#..." }
}
```

**Endpoint:** `GET /api/public/news?tenant_slug=:slug`
**Purpose:** Latest news for the landing page.
**Response:** Array of News objects (see Section 3).

**Endpoint:** `GET /api/public/events?tenant_slug=:slug`
**Purpose:** Upcoming events for the landing page.
**Response:** Array of Event objects (see Section 4).

**Endpoint:** `GET /api/public/encuestas?tenant_slug=:slug`
**Purpose:** Active public surveys.
**Response:** Array of Survey objects.

---

## 2. User Authentication & Registration

**Endpoint:** `POST /api/auth/register`
**Purpose:** Create a new end-user account associated with a specific tenant.
**Payload:**
```json
{
  "email": "user@example.com",
  "password": "securePassword",
  "nombre": "Juan Perez",
  "telefono": "12345678",
  "tenant_slug": "municipio-demo" // CRITICAL: Links user to this tenant
}
```
**Response:** `{ "token": "jwt...", "user": { "id": 1, ... } }`

**Endpoint:** `POST /api/auth/login`
**Payload:** `{ "email": "...", "password": "...", "tenant_slug": "..." }`
**Note:** Login should verify the user exists within the context of the requested tenant (or is a global user authorized for it).

---

## 3. Order Processing & Sync

**Endpoint:** `POST /api/v1/portal/:tenant_id/orders`
**Purpose:** Submit a new order/request (Pedido/Reclamo).
**Payload:** Standard cart payload (items, totals, shipping info).

**Endpoint:** `GET /api/v1/portal/:tenant_id/orders`
**Purpose:** List user's history.
**Response:** Array of orders.

**Important:** If a user creates a "Demo Order" as a guest (stored in local storage), the frontend might prompt them to "Sync" it after registration. The backend should support an endpoint to "Import" or "Claim" a guest order if implemented, OR simply rely on the user re-submitting the cart after login.

---

## 4. User Portal Dashboard (Authenticated)
**Endpoint:** `GET /api/v1/portal/:tenant_id/content`
**Purpose:** Fetches a consolidated summary for the user dashboard.
**Response JSON:**
```json
{
  "notifications": [
    {
      "id": "notif_123",
      "title": "Claim Update",
      "message": "Your claim #456 has been resolved.",
      "severity": "info",
      "date": "2023-10-27T10:00:00Z",
      "read": false,
      "actionLabel": "View Claim",
      "actionHref": "/portal/pedidos/456"
    }
  ],
  "news": [], // Top 3 news for user
  "events": [], // Top 3 upcoming events
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

## 5. News Structure
```json
{
  "id": "news_1",
  "title": "Festival de Jazz",
  "summary": "Join us for the annual Jazz Festival.",
  "body": "HTML content...",
  "cover_url": "https://example.com/image.jpg",
  "publicado_at": "2023-10-28T10:00:00Z",
  "tags": ["Cultura", "Eventos"]
}
```

## 6. Events Structure
```json
{
  "id": "evt_1",
  "title": "Vacunación Antirrábica",
  "descripcion": "Description...",
  "cover_url": "...",
  "starts_at": "2023-11-01T14:00:00Z",
  "ends_at": "2023-11-01T18:00:00Z",
  "lugar": "Plaza Central"
}
```

## 7. Integration Logic (WhatsApp & Widget)
- **WhatsApp:** The webhook handler should use the `tenant_id` associated with the phone number to fetch the same News/Events data and serve it via text/interactive messages.
- **Chat Widget:** The widget embeds the portal or specific flows. It should query these same endpoints using the `tenant_id` from the script tag configuration.
- **Admin Panel:** Changes made in the Admin Panel (creating news/events) must write to the database tables that back these endpoints.

## 8. Real-time Updates (Socket.IO)
**Room Name:** `tenant_slug` (e.g., "municipio")

**Events Emitted:**
*   `tenant_content_update`: Generic signal that something changed.
*   `news_update`: Signal that news items have changed.
*   `events_update`: Signal that events have changed.

**Triggers:**
*   `POST /municipal/posts` (Create/Update News/Events).
