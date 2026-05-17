# Frontend to Backend - Marketplace e Inventario Pro

Fecha: 2026-05-17

## Objetivo

Unificar catalogo, marketplace, carrito, pedidos, WhatsApp, widget y panel admin para que el frontend no calcule stock, precios finales ni disponibilidad comercial. El backend debe publicar el estado real y la trazabilidad de cada operacion.

## Regla principal

Frontend no confirma stock, precio final, envio, checkout ni pedido si backend no lo valida. En demo se puede mostrar el flujo, pero la confirmacion debe quedar marcada como demo o deshabilitada.

## 1. Demos

Cuando `demo_mode=true`:

- El catalogo demo puede mostrar recursos ilustrativos y descargables.
- Los botones de pedido muestran el flujo conversacional dentro del chat.
- No confirmar stock real, inventario, precio final ni disponibilidad comercial.
- No fabricar checkout, comprobantes, recibos, promociones ni totales.
- Si backend devuelve `amount_validated: false`, frontend no muestra monto final confirmado.
- Si backend devuelve `stock_status: "stock_unknown"` u `"out_of_stock"`, widget y WhatsApp no confirman compra.

Respuesta recomendada para pedido demo:

```json
{
  "success": true,
  "request_id": "req_...",
  "message": "Puedo tomar los datos del pedido para mostrarte el flujo. La confirmacion comercial queda deshabilitada en demo.",
  "data": {
    "order": {
      "status": "demo_pending_confirmation",
      "amount_validated": false,
      "stock_status": "stock_unknown",
      "items": []
    }
  }
}
```

## 2. Tenants pagos

Admin, widget, WhatsApp, chat profesional, carrito y pedidos deben usar el mismo catalogo backend.

Campos esperados por producto:

- `id`
- `sku`
- `name` o `nombre`
- `description` o `descripcion`
- `price` o `precio`
- `currency`
- `stock`
- `stock_quantity`
- `stock_status`
- `available_to_sell`
- `inventory`
- `catalog_version`
- `request_id`

Reglas:

- Frontend renderiza estos campos cuando vienen publicados.
- Frontend no calcula stock ni precio final.
- Pedido confirmado requiere validacion backend en el ultimo paso.
- Si `available_to_sell === false`, no mostrar accion de compra confirmada.
- Si `stock_status` es `stock_unknown` u `out_of_stock`, mostrar consulta o lead, no compra cerrada.

## 3. Endpoints a consumir

```txt
GET /api/admin/tenants/{tenant_slug}/catalog
GET /api/admin/tenants/{tenant_slug}/catalog/items
PATCH /api/admin/tenants/{tenant_slug}/catalog/items/{item_id}
POST /api/admin/catalog/import
GET /api/admin/catalog/import/{upload_id}
PUT /api/admin/catalog/import/{upload_id}
POST /api/admin/catalog/import/{upload_id}/commit
GET /api/v2/tenants/{tenant_slug}/catalog/quality
```

## 4. Importacion

Modos esperados:

- `upsert`: actualiza por SKU y crea faltantes.
- `replace`: reemplaza catalogo del tenant.
- `stock_only`: actualiza solo stock por SKU y no crea productos nuevos.

Payload recomendado:

```json
{
  "tenant_slug": "bodega",
  "mode": "stock_only",
  "source": "admin_upload",
  "mapping": {
    "sku": "SKU",
    "stock_quantity": "Stock",
    "price": "Precio"
  }
}
```

Respuesta recomendada:

```json
{
  "ok": true,
  "request_id": "req_...",
  "upload_id": "upl_...",
  "summary": {
    "created": 0,
    "updated": 120,
    "skipped": 3,
    "errors": 0
  },
  "warnings": []
}
```

## 5. Calidad del catalogo

`GET /api/v2/tenants/{tenant_slug}/catalog/quality` debe devolver datos accionables para admin:

```json
{
  "contract_version": "catalog.quality.v1",
  "request_id": "req_...",
  "tenant_slug": "bodega",
  "catalog_version": "cat_2026_05_17",
  "summary": {
    "items_total": 320,
    "items_sellable": 280,
    "missing_price": 12,
    "stock_unknown": 44,
    "missing_images": 31
  },
  "recommendations": [
    {
      "id": "stock_unknown",
      "label": "Completar stock",
      "description": "Hay productos sin estado de stock validado.",
      "severity": "warning"
    }
  ]
}
```

## 6. Widget y WhatsApp

Para acciones comerciales dentro del chat:

- `consultar_producto`: backend responde precio/disponibilidad si existe.
- `crear_pedido`: backend pide datos y valida pedido.
- `cotizar_envio`: backend calcula o publica cotizacion; frontend no calcula.
- `capturar_lead_comercial`: backend crea lead/ticket trazable.

Respuesta de pedido confirmado:

```json
{
  "success": true,
  "request_id": "req_...",
  "message": "Pedido confirmado.",
  "data": {
    "order": {
      "order_id": "O-123",
      "status": "confirmed",
      "amount_validated": true,
      "stock_status": "validated",
      "total": 12500,
      "currency": "ARS",
      "items": [
        {
          "sku": "SKU-1",
          "name": "Producto",
          "quantity": 2,
          "price": 6250
        }
      ]
    }
  }
}
```

Si no hay validacion:

```json
{
  "success": true,
  "request_id": "req_...",
  "message": "Solicitud registrada. El equipo va a validar stock y precio.",
  "data": {
    "order": {
      "status": "pending_validation",
      "amount_validated": false,
      "stock_status": "stock_unknown"
    }
  }
}
```

## 7. QA compartida

1. Tenant pago actualiza stock con `PATCH`.
2. Import `stock_only` actualiza stock por SKU y no crea productos nuevos.
3. Widget consulta producto y muestra solo precio/stock publicados por backend.
4. Widget no confirma compra si `stock_status` es `stock_unknown` u `out_of_stock`.
5. WhatsApp no confirma compra sin `amount_validated: true`.
6. Demo muestra flujo comercial pero no confirma stock/precio real.
7. Export o resumen admin incluye `catalog_version` y `request_id`.
