# auth.demo.v1

Contrato de disponibilidad de endpoints demo de autenticación.

Estado: **Activo**  
Última actualización: **2026-04-19**

## Endpoints

- `GET /auth/demo/catalog`
- `POST /auth/demo`
- `GET /api/auth/demo/catalog` (alias legacy)
- `POST /api/auth/demo` (alias legacy)

## Response 404 (demo mode desactivado)

```json
{
  "contract_version": "auth.demo.v1",
  "request_id": "uuid-or-forwarded-request-id",
  "error": {
    "code": 404,
    "message": "Demo mode disabled"
  }
}
```

## Regla operativa

- Si `ENABLE_DEMO_MODE=false`, los endpoints canónicos y los alias `/api/*` deben responder 404 con este contrato.
- Endpoints canónicos y alias `/api/*` deben devolver `X-Request-Id` para trazabilidad FE/BE.

## Headers esperados en respuesta

- `X-Request-Id: <uuid|forwarded>`
- `Content-Type: application/json`

## Guía FE (manejo recomendado)

1. Si recibe `404` con `contract_version=auth.demo.v1`, tratarlo como **estado controlado**, no como caída inesperada.
2. Loggear `request_id` + `X-Request-Id` para correlación con backend.
3. Mostrar UI de fallback amigable (“Demo mode desactivado”) con CTA alternativa (ej. login normal / contacto soporte).
