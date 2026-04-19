# auth.demo.v1

Contrato de disponibilidad de endpoints demo de autenticación.

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
