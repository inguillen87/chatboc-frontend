# Backend Specifications for Chatboc User Portal

This document outlines the API endpoints and data structures required to support the "Professional User Portal" features (Dashboard, Catalog, News, Events, Notifications) for the Frontend.

## 1. Public Tenant Configuration & Widget
**Endpoint:** `GET /api/public/tenants/:tenantId/widget-config` (or equivalent used by `tenant-info`)
**Purpose:** Returns public branding, configuration, and enabled features for a specific tenant (municipio or pyme).

**Response:**
```json
{
  "slug": "municipio-demo",
  "name": "Municipio de Demo",
  "logo_url": "https://...",
  "theme": {
    "primaryColor": "#007bff",
    "secondaryColor": "#6c757d"
  },
  "features": {
    "catalog": true,
    "news": true,
    "events": true,
    "surveys": true
  },
  "contact": {
    "whatsapp": "+54911...",
    "email": "contacto@municipio.demo"
  }
}
```

## 2. Portal Content Aggregator
**Endpoint:** `GET /api/portal/:tenantSlug/content`
**Purpose:** Aggregates data for the User Dashboard to reduce round-trips. It should return recent news, upcoming events, active notifications, and a summary of user activity.

**Headers:**
- `Authorization`: Bearer <user_token> (Optional, but required for user-specific data like notifications/loyalty)

**Response:**
```json
{
  "notifications": [
    {
      "id": "n1",
      "title": "Welcome",
      "message": "Thanks for registering!",
      "severity": "info", // info, success, warning, error
      "actionLabel": "Profile",
      "actionHref": "/portal/account",
      "date": "2023-10-27T10:00:00Z"
    }
  ],
  "events": [
    {
      "id": "e1",
      "title": "Community Fair",
      "date": "2023-11-01T09:00:00Z",
      "location": "Central Square",
      "status": "upcoming",
      "coverUrl": "https://..."
    }
  ],
  "news": [
    {
      "id": "news1",
      "title": "New Recycling Program",
      "summary": "Learn how to recycle...",
      "coverUrl": "https://...",
      "date": "2023-10-25"
    }
  ],
  "catalog": [
    {
      "id": "p1",
      "title": "Cinema Ticket",
      "category": "beneficios",
      "price": 500,
      "imageUrl": "https://..."
    }
  ],
  "activities": [
    {
      "id": "ord-123",
      "description": "Order #123",
      "type": "Order", // or Claim, Survey
      "status": "Delivered",
      "statusType": "success",
      "date": "2023-10-20"
    }
  ],
  "surveys": [
    {
      "id": "s1",
      "title": "Service Satisfaction",
      "link": "/portal/surveys/s1"
    }
  ],
  "loyaltySummary": {
    "points": 120,
    "level": "Gold",
    "surveysCompleted": 5,
    "suggestionsShared": 2,
    "claimsFiled": 0
  }
}
```

## 3. Market & Catalog
**Endpoint:** `GET /api/:tenantSlug/productos`
**Purpose:** Returns the product/service catalog.

**Response:**
```json
{
  "products": [
    {
      "id": "1",
      "name": "Product A",
      "description": "...",
      "price": 100.0,
      "category": "General",
      "imageUrl": "https://...",
      "stock": 50
    }
  ],
  "categories": ["General", "Premium"]
}
```

**Endpoint:** `GET /api/:tenantSlug/carrito`
**Purpose:** Returns the current user's cart.

## 4. News & Events (Detailed)
**Endpoint:** `GET /api/public/news?tenant=:tenantSlug`
**Endpoint:** `GET /api/public/events?tenant=:tenantSlug`
**Purpose:** Returns paginated lists of news and events.

## 5. User Registration & Auth
**Endpoint:** `POST /api/auth/register`
**Payload:**
```json
{
  "name": "Juan Perez",
  "email": "juan@example.com",
  "password": "***",
  "empresa_token": "token-del-tenant", // Critical for associating user to tenant
  "telefono": "..."
}
```
**Response:**
```json
{
  "token": "jwt-token",
  "user": {
    "id": 1,
    "name": "Juan Perez",
    "role": "user",
    "tenantSlug": "municipio-demo"
  }
}
```

## Missing / Failing Endpoints Observed
The following endpoints were observed returning 404 in the logs and need implementation:
- `/api/public/tenants/...` (Used for initial widget config/tenant info)
- `/api/municipio/carrito` (Cart management)
- `/pwa/tenant-info` (Alternative tenant info endpoint)
