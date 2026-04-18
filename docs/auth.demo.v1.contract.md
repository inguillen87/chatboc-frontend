# Contract — `auth.demo.v1`

## Contexto
Cuando `ENABLE_DEMO_MODE=false`, endpoints demo deben responder 404 explícito y contractado.

## Endpoints
- `GET /auth/demo/catalog`
- `POST /auth/demo`

## Respuesta esperada (demo OFF)

```json
{
  "contract_version": "auth.demo.v1",
  "error": {
    "code": 404,
    "message": "Demo mode disabled"
  }
}
```

## Reglas FE
- Tratar 404 demo como estado controlado (sin crash, sin fallback implícito).
- Mostrar mensaje/CTA explícito para entornos sin demo.

