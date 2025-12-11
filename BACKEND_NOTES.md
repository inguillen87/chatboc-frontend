# Frontend Integration Notes for Backend Team

The frontend has been updated to consume the following API features:

## 1. Widget Configuration
We are now fetching public widget configuration from:
`GET /api/public/tenants/:slug/widget-config`

Expected response fields:
- `cta_messages`: Array of strings or objects `{ text: string, action: string, payload: any }`.
- `theme_config`: Object `{ mode: 'light'|'dark'|'system', light: {...colors}, dark: {...colors} }`.
- `default_open`: Boolean.
- `logo_url`: String (URL).

## 2. Anonymous Sessions
The frontend generates a UUID v4 and sends it in the `X-Anon-Id` header for all requests to support persistent carts across sessions/reloads for anonymous users.

## 3. Hierarchical Demos
The frontend expects `/api/rubros` to return items with a `padre_id` field to build the hierarchy (Category -> Subcategory -> Tenant).
