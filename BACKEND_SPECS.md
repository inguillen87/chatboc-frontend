# Backend Specifications for Chatboc User Portal

This document outlines the API endpoints required by the Frontend to fully support the User Portal, Multi-tenant features, and Catalog functionality.

## 1. Tenant Public Information
These endpoints allow the frontend to load branding, configuration, and tenant identity.

*   **GET** `/api/pwa/tenant-info` (or `/api/public/tenant`)
    *   **Query Params:** `tenant={slug}` or `widget_token={token}`
    *   **Response:**
        ```json
        {
          "slug": "municipio-godoy-cruz",
          "nombre": "Municipalidad de Godoy Cruz",
          "logo_url": "https://...",
          "tema": {
             "color_primary": "#3b82f6",
             "color_secondary": "#10b981"
          },
          "tipo": "municipio", // or 'pyme'
          "descripcion": "Descripción del espacio",
          "public_base_url": "https://chatboc.ar/municipio-godoy-cruz",
          "public_cart_url": "https://chatboc.ar/municipio-godoy-cruz/cart",
          "public_catalog_url": "https://chatboc.ar/municipio-godoy-cruz/productos"
        }
        ```

## 2. Product Catalog & Cart
These endpoints drive the `ProductCatalog` and `CartPage`.

*   **GET** `/api/:tenant_slug/productos`
    *   **Response:** List of products.
        ```json
        [
          {
            "id": 1,
            "nombre": "Producto Ejemplo",
            "precio_unitario": 1500,
            "precio_puntos": 500, // Optional for loyalty
            "modalidad": "venta", // 'venta', 'puntos', 'donacion'
            "imagen_url": "https://...",
            "categoria": "General"
          }
        ]
        ```

*   **GET** `/api/:tenant_slug/carrito`
    *   **Response:** Current user's cart.
        ```json
        {
          "items": [
            {
              "id": 1,
              "name": "Producto Ejemplo",
              "price": 1500,
              "quantity": 2,
              "imageUrl": "..."
            }
          ]
        }
        ```

*   **POST** `/api/:tenant_slug/carrito`
    *   **Body:** `{ "product_id": 1, "quantity": 1 }`
    *   **Purpose:** Add item to cart.

## 3. User Portal (Authenticated)
These endpoints serve the dashboard, news, and events.

*   **GET** `/api/:tenant_slug/public/news` (or `/public/news`)
    *   **Response:**
        ```json
        [
          {
            "id": 101,
            "titulo": "Noticia Importante",
            "resumen": "Resumen corto...",
            "cover_url": "https://...",
            "publicado_at": "2023-10-27T10:00:00Z"
          }
        ]
        ```

*   **GET** `/api/:tenant_slug/public/events` (or `/public/events`)
    *   **Response:**
        ```json
        [
          {
            "id": 202,
            "titulo": "Evento Comunitario",
            "descripcion": "Detalles...",
            "starts_at": "2023-11-01T15:00:00Z",
            "cover_url": "https://..."
          }
        ]
        ```

*   **GET** `/api/:tenant_slug/app/me/tenants`
    *   **Purpose:** List tenants followed by the user.

*   **POST** `/api/:tenant_slug/app/me/tenants/follow`
    *   **Body:** `{ "slug": "target-tenant-slug" }`
    *   **Purpose:** Follow a tenant.

## 4. Auth & User Profile
*   **POST** `/api/auth/login` (or `/api/:tenant_slug/auth/login`)
*   **POST** `/api/auth/register`
*   **GET** `/api/me` (User profile info)

## 5. Integration Notes
*   **CORS:** Ensure `Access-Control-Allow-Origin` allows the frontend domain.
*   **Error Handling:** Return structured errors (e.g., `{ "error_code": "TENANT_NOT_FOUND", "message": "..." }`) with appropriate 4xx status codes.
*   **HTML Fallback:** Do NOT return `index.html` for API 404s. Ensure API routes always return JSON.
