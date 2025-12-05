# Backend Requirements for Chatboc Frontend (Updated)

This document outlines the API endpoints and data structures required by the frontend to fully support the User Portal, Multi-tenant features, and Chat Widget.

## 1. Public Portal Content (Multi-tenant)

**Endpoint:** `GET /api/portal/:tenant_slug/content`

**Purpose:** Provides dynamic content for the user portal dashboard, including notifications, events, news, catalog items, and activities. This allows the frontend to render a personalized and branded experience for each tenant (municipio or pyme).

**Response Body (JSON):**

```json
{
  "notifications": [
    {
      "id": "string",
      "title": "string",
      "message": "string",
      "severity": "info" | "success" | "warning" | "error",
      "actionLabel": "string (optional)",
      "actionHref": "string (optional)",
      "date": "string (optional)"
    }
  ],
  "events": [
    {
      "id": "string",
      "title": "string",
      "date": "string",
      "location": "string",
      "status": "inscripcion" | "proximo" | "finalizado",
      "description": "string",
      "spots": "number (optional)",
      "registered": "number (optional)",
      "coverUrl": "string (optional)"
    }
  ],
  "news": [
    {
      "id": "string",
      "title": "string",
      "category": "string",
      "date": "string",
      "summary": "string",
      "link": "string (optional)",
      "featured": "boolean (optional)",
      "coverUrl": "string (optional)"
    }
  ],
  "catalog": [
    {
      "id": "string",
      "title": "string",
      "description": "string",
      "category": "string",
      "priceLabel": "string (optional)",
      "status": "available" | "coming_soon" | "paused",
      "imageUrl": "string (optional)"
    }
  ],
  "activities": [
    {
      "id": "string",
      "description": "string",
      "type": "string",
      "status": "string (optional)",
      "statusType": "success" | "warning" | "info" | "error",
      "date": "string (optional)",
      "link": "string (optional)"
    }
  ],
  "surveys": [
    {
      "id": "string",
      "title": "string",
      "link": "string (optional)"
    }
  ],
  "loyaltySummary": {
     "points": 1250,
     "surveysCompleted": 5,
     "suggestionsShared": 2,
     "claimsFiled": 1,
     "levelName": "Vecino Activo",
     "nextLevelPoints": 2000
  }
}
```

**Notes:**
- If the tenant does not exist, return `404`.
- The frontend currently falls back to demo data if this endpoint fails or returns empty.
- `coverUrl` and `imageUrl` should be absolute URLs or relative paths that the frontend can resolve.

## 2. User Authentication & Registration

**Endpoint:** `POST /api/auth/register`

**Purpose:** Registers a new end-user (vecino/cliente).

**Request Body:**

```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "securePassword123",
  "telefono": "+1234567890",
  "acepto_terminos": true,
  "empresa_token": "ENTITY_TOKEN_OF_TENANT",
  "anon_id": "OPTIONAL_TRACKING_ID"
}
```

**Response Body:**

```json
{
  "id": 123,
  "token": "JWT_TOKEN",
  "name": "John Doe",
  "email": "john@example.com",
  "rol": "user",
  "tenantSlug": "municipio-demo"
}
```

**Notes:**
- `empresa_token` is crucial for assigning the user to the correct tenant.
- The backend should handle duplicate emails gracefully (409 Conflict).

## 3. Product Catalog & Cart (Marketplace)

**Endpoint:** `GET /pwa/public/:tenant_slug/productos`

**Purpose:** Retrieves the list of products for the marketplace.

**Response:** List of product objects (id, name, price, image_url, category, etc.).

**Endpoint:** `POST /pwa/public/:tenant_slug/orders`

**Purpose:** Submits an order.

**Request Body:**
```json
{
  "items": [{ "product_id": 1, "quantity": 2 }],
  "customer_details": { ... },
  "total": 100.00
}
```

## 4. Socket.IO Events (Real-time Updates)

**Namespace:** `/` (or configured path)

**Events to Emit to Client:**
- `tenant_content_update`: Triggers a refresh of the portal content.
- `news_update`: Triggers a refresh of news.
- `events_update`: Triggers a refresh of events.
- `catalog_update`: Triggers a refresh of the catalog.

**Client Connection Query Params:**
- `tenant`: `tenant_slug`
- `portal_user`: `true`

## 5. Tenant Configuration

**Endpoint:** `GET /pwa/tenant-info`

**Query Params:**
- `slug`: `tenant_slug` (optional if resolving by domain)
- `domain`: `hostname` (optional)

**Response:**
```json
{
  "slug": "municipio-demo",
  "nombre": "Municipio Demo",
  "tema": {
    "primaryColor": "#ff0000",
    "secondaryColor": "#00ff00"
  },
  "entity_token": "TOKEN_123"
}
```

## 6. Loyalty & Points (Gamification)

**Endpoint:** `GET /api/loyalty/summary`

**Headers:** `Authorization: Bearer <user_token>`

**Response:**
```json
{
  "points": 1200,
  "level": "Gold",
  "history": [...]
}
```
